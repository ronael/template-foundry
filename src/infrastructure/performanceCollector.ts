import type { Browser, BrowserContext, CDPSession, Page } from "playwright";
import type { Viewport } from "../domain/inspection.js";
import {
  type LcpEvidence,
  type PagePerformanceEvidence,
  type PerformanceResource,
  type ResourceCategory,
  resourceCategorySchema,
} from "../domain/performance.js";

type CdpResponse = {
  url: string;
  mimeType: string;
  fromDiskCache?: boolean;
  fromPrefetchCache?: boolean;
  fromServiceWorker?: boolean;
};

type CdpResponseReceived = {
  requestId: string;
  type: string;
  response: CdpResponse;
};

type CdpLoadingFinished = {
  requestId: string;
  encodedDataLength: number;
};

type CdpRequestWillBeSent = {
  requestId: string;
  request: { url: string };
};

type MutableResource = {
  url: string;
  category: ResourceCategory;
  mimeType?: string;
  transferBytes: number;
  transferStatus: "measured" | "not-evaluated";
  fromCache: boolean;
};

export type NetworkPerformanceCollector = {
  finish: (
    page: Page,
    pageUrl: string,
    resourceViewport: string,
    lcp: LcpEvidence[],
  ) => Promise<PagePerformanceEvidence>;
  dispose: () => Promise<void>;
};

export async function installLcpObserver(
  context: BrowserContext,
): Promise<void> {
  await context.addInitScript(() => {
    const state = globalThis as typeof globalThis & {
      __tfLcp:
        | {
            valueMs: number;
            element?: {
              tag: string;
              selector?: string;
              url?: string;
              text?: string;
            };
          }
        | undefined;
    };
    state.__tfLcp = undefined;
    if (!("PerformanceObserver" in globalThis)) return;
    try {
      const observer = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const entry = entries.at(-1) as PerformanceEntry & {
          element?: Element;
          url?: string;
        };
        if (!entry) return;
        const element = entry.element;
        const tag = element?.tagName.toLowerCase();
        const id = element?.id;
        const classes = element
          ? Array.from(element.classList).slice(0, 2).join(".")
          : "";
        const selector = tag
          ? `${tag}${id ? `#${id}` : classes ? `.${classes}` : ""}`
          : undefined;
        const text = element?.textContent
          ?.trim()
          .replace(/\s+/g, " ")
          .slice(0, 120);
        state.__tfLcp = {
          valueMs: entry.startTime,
          ...(tag
            ? {
                element: {
                  tag,
                  ...(selector ? { selector } : {}),
                  ...(entry.url ? { url: entry.url } : {}),
                  ...(text ? { text } : {}),
                },
              }
            : {}),
        };
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      // Unsupported observers become explicit not-evaluated evidence later.
    }
  });
}

export async function startNetworkPerformanceCollection(
  page: Page,
): Promise<NetworkPerformanceCollector> {
  const session = await page.context().newCDPSession(page);
  const resources = new Map<string, MutableResource>();
  const completedBytes = new Map<string, number>();
  let totalRequests = 0;

  session.on("Network.requestWillBeSent", (event: CdpRequestWillBeSent) => {
    if (isNetworkUrl(event.request.url)) totalRequests += 1;
  });
  session.on("Network.responseReceived", (event: CdpResponseReceived) => {
    if (!isNetworkUrl(event.response.url)) return;
    resources.set(event.requestId, {
      url: event.response.url,
      category: mapResourceCategory(event.type),
      ...(event.response.mimeType ? { mimeType: event.response.mimeType } : {}),
      transferBytes: completedBytes.get(event.requestId) ?? 0,
      transferStatus: completedBytes.has(event.requestId)
        ? "measured"
        : "not-evaluated",
      fromCache: Boolean(
        event.response.fromDiskCache ||
          event.response.fromPrefetchCache ||
          event.response.fromServiceWorker,
      ),
    });
  });
  session.on("Network.loadingFinished", (event: CdpLoadingFinished) => {
    const bytes = Math.max(0, Math.round(event.encodedDataLength));
    completedBytes.set(event.requestId, bytes);
    const resource = resources.get(event.requestId);
    if (resource) {
      resource.transferBytes = bytes;
      resource.transferStatus = "measured";
    }
  });

  await session.send("Network.enable");
  await session.send("Network.clearBrowserCache");
  await session.send("Network.setCacheDisabled", { cacheDisabled: true });
  await session.send("Network.setBypassServiceWorker", { bypass: true });

  return {
    finish: async (loadedPage, pageUrl, resourceViewport, lcp) =>
      buildEvidence(
        loadedPage,
        pageUrl,
        resourceViewport,
        totalRequests,
        [...resources.values()],
        lcp,
      ),
    dispose: () => detachQuietly(session),
  };
}

export async function buildUnavailableNetworkEvidence(
  page: Page,
  pageUrl: string,
  resourceViewport: string,
  lcp: LcpEvidence[],
  reason: string,
): Promise<PagePerformanceEvidence> {
  return buildEvidence(page, pageUrl, resourceViewport, 0, [], lcp, reason);
}

export async function readLcp(
  page: Page,
  viewport: string,
): Promise<LcpEvidence> {
  const observed = await page
    .evaluate(() => {
      const state = globalThis as typeof globalThis & {
        __tfLcp:
          | {
              valueMs: number;
              element?: {
                tag: string;
                selector?: string;
                url?: string;
                text?: string;
              };
            }
          | undefined;
      };
      return state.__tfLcp;
    })
    .catch(() => undefined);
  if (!observed || !Number.isFinite(observed.valueMs)) {
    return {
      viewport,
      status: "not-evaluated",
      reason: "Largest Contentful Paint was not exposed by the browser.",
      provenance: {
        provider: "performance-observer",
        check: "largest-contentful-paint",
        confidence: 0.8,
      },
    };
  }
  return {
    viewport,
    status: "measured",
    valueMs: Math.round(observed.valueMs),
    ...(observed.element ? { element: observed.element } : {}),
    provenance: {
      provider: "performance-observer",
      check: "largest-contentful-paint",
      confidence: 0.85,
    },
  };
}

export async function measureColdLcp(
  browser: Browser,
  url: string,
  viewport: Viewport,
  timeoutMs: number,
): Promise<LcpEvidence> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
  });
  try {
    await installLcpObserver(context);
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    const session = await page.context().newCDPSession(page);
    try {
      await session.send("Network.enable");
      await session.send("Network.clearBrowserCache");
      await session.send("Network.setCacheDisabled", { cacheDisabled: true });
      await session.send("Network.setBypassServiceWorker", { bypass: true });
      await page.goto(url, { waitUntil: "networkidle", timeout: timeoutMs });
      await page.waitForTimeout(100);
      return await readLcp(page, viewport.id);
    } finally {
      await detachQuietly(session);
    }
  } catch (error) {
    return {
      viewport: viewport.id,
      status: "not-evaluated",
      reason: `LCP measurement failed: ${error instanceof Error ? error.message : String(error)}`,
      provenance: {
        provider: "performance-observer",
        check: "largest-contentful-paint",
        confidence: 0.8,
      },
    };
  } finally {
    await context.close();
  }
}

async function buildEvidence(
  page: Page,
  pageUrl: string,
  resourceViewport: string,
  totalRequests: number,
  collected: MutableResource[],
  lcp: LcpEvidence[],
  networkUnavailableReason?: string,
): Promise<PagePerformanceEvidence> {
  const targetOrigin = new URL(pageUrl).origin;
  const resources: PerformanceResource[] = collected.map((resource) => ({
    ...resource,
    thirdParty: safeOrigin(resource.url) !== targetOrigin,
  }));
  const measuredRequests = resources.filter(
    (resource) => resource.transferStatus === "measured",
  ).length;
  const dom = await page.evaluate(() => {
    const root = document.documentElement;
    if (!root) return { nodes: 0, maxDepth: 0 };
    let nodes = 0;
    let maxDepth = 0;
    const stack: Array<[Element, number]> = [[root, 1]];
    while (stack.length > 0) {
      const [element, depth] = stack.pop() as [Element, number];
      nodes += 1;
      maxDepth = Math.max(maxDepth, depth);
      for (const child of element.children) stack.push([child, depth + 1]);
    }
    return { nodes, maxDepth };
  });
  const imageDimensions = await page.$$eval("img", (images) =>
    images.map((image) => {
      const rect = image.getBoundingClientRect();
      return {
        url: image.currentSrc || image.src,
        renderedWidth: Math.round(rect.width),
        renderedHeight: Math.round(rect.height),
        intrinsicWidth: image.naturalWidth,
        intrinsicHeight: image.naturalHeight,
      };
    }),
  );
  const imageDimensionByUrl = new Map(
    imageDimensions.map((image) => [image.url, image]),
  );
  const fontFaces = await page.evaluate(() =>
    Array.from(document.fonts)
      .filter((font) => font.status === "loaded")
      .map((font) => ({
        family: font.family,
        style: font.style,
        weight: font.weight,
      })),
  );
  const categories = resourceCategorySchema.options;
  const breakdown = categories.map((category) => {
    const matching = resources.filter(
      (resource) => resource.category === category,
    );
    const largest = largestResource(matching);
    return {
      category,
      count: matching.length,
      transferBytes: sumBytes(matching),
      ...(largest ? { largestResource: largest } : {}),
    };
  });
  const images = resources.filter((resource) => resource.category === "image");
  const fonts = resources.filter((resource) => resource.category === "font");
  const scripts = resources.filter(
    (resource) => resource.category === "script",
  );
  return {
    status: "measured",
    resourceViewport,
    transfer: {
      status:
        !networkUnavailableReason && measuredRequests === resources.length
          ? "measured"
          : "not-evaluated",
      ...(networkUnavailableReason
        ? { reason: networkUnavailableReason }
        : measuredRequests !== resources.length
          ? {
              reason:
                "One or more CDP resource transfers did not finish before collection ended.",
            }
          : {}),
      totalRequests,
      measuredRequests,
      transferBytes: sumBytes(resources),
    },
    resources,
    breakdown,
    images: {
      count: images.length,
      transferBytes: sumBytes(images),
      resources: images
        .map((resource) => ({
          url: resource.url,
          transferBytes: resource.transferBytes,
          ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
          ...(imageDimensionByUrl.get(resource.url) ?? {}),
        }))
        .sort((a, b) => b.transferBytes - a.transferBytes),
    },
    fonts: {
      count: fonts.length,
      transferBytes: sumBytes(fonts),
      faces: fontFaces,
      resources: fonts
        .map(toLargestResource)
        .sort((a, b) => b.transferBytes - a.transferBytes),
    },
    javascript: {
      count: scripts.length,
      transferBytes: sumBytes(scripts),
      resources: scripts
        .map(toLargestResource)
        .sort((a, b) => b.transferBytes - a.transferBytes),
    },
    dom,
    lcp,
    provenance: {
      provider: "playwright-cdp",
      check: "cold-load-performance",
      confidence: 0.95,
      cacheDisabled: true,
      serviceWorkerBypassed: true,
    },
  };
}

function largestResource(resources: PerformanceResource[]) {
  const largest = resources.reduce<PerformanceResource | undefined>(
    (largest, resource) =>
      !largest || resource.transferBytes > largest.transferBytes
        ? resource
        : largest,
    undefined,
  );
  return largest ? toLargestResource(largest) : undefined;
}

function toLargestResource(resource: PerformanceResource) {
  return {
    url: resource.url,
    transferBytes: resource.transferBytes,
    ...(resource.mimeType ? { mimeType: resource.mimeType } : {}),
  };
}

function sumBytes(resources: Array<{ transferBytes: number }>): number {
  return resources.reduce((sum, resource) => sum + resource.transferBytes, 0);
}

function safeOrigin(url: string): string | undefined {
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}

function isNetworkUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function mapResourceCategory(type: string): ResourceCategory {
  const normalized = type.toLowerCase();
  if (resourceCategorySchema.options.includes(normalized as ResourceCategory)) {
    return normalized as ResourceCategory;
  }
  return "other";
}

async function detachQuietly(session: CDPSession): Promise<void> {
  await session.detach().catch(() => undefined);
}
