import { mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import {
  type Browser,
  chromium,
  type Page,
  type Request,
  type Response,
} from "playwright";
import {
  dedupeFindings,
  defaultSiteBudget,
  defaultViewports,
  type InspectionArtifact,
  type InspectOptions,
  type SiteInspectionArtifact,
  type SiteInspectOptions,
  type SitePage,
  selectRoutes,
  type Viewport,
} from "../domain/inspection.js";
import type { AuditFinding, Severity } from "../domain/schemas.js";
import { writeJsonFile } from "./yamlStore.js";

type LinkRecord = {
  href: string | null;
  text: string;
};

type PageCapture = {
  artifact: InspectionArtifact;
  discoveredPaths: string[];
};

type CaptureOptions = {
  id: string;
  createdAt: string;
  /** Directory the page artifact JSON will live in (for relative paths). */
  artifactDir: string;
  screenshotDir: string;
  screenshotPrefix: string;
  pagePath: string;
};

export async function inspectUrl(
  url: string,
  options: InspectOptions,
): Promise<InspectionArtifact> {
  const createdAt = new Date().toISOString();
  const id = createInspectionId(url, createdAt);
  const inspectionDir = join(options.outputDir, id);
  const browser = await chromium.launch({ headless: true });
  try {
    const capture = await capturePage(browser, url, options, {
      id,
      createdAt,
      artifactDir: inspectionDir,
      screenshotDir: join(inspectionDir, "screenshots"),
      screenshotPrefix: "",
      pagePath: "/",
    });
    return capture.artifact;
  } finally {
    await browser.close();
  }
}

export async function inspectSite(
  url: string,
  options: SiteInspectOptions,
): Promise<SiteInspectionArtifact> {
  const budget = { ...defaultSiteBudget, ...options.budget };
  const pageOptions: InspectOptions = {
    ...options,
    timeoutMs: options.timeoutMs ?? budget.timeoutMsPerPage,
    maxInternalLinks: options.maxInternalLinks ?? budget.maxLinksPerPage,
  };
  const createdAt = new Date().toISOString();
  const id = createInspectionId(url, createdAt);
  const siteDir = join(options.outputDir, id);
  const pagesDir = join(siteDir, "pages");
  const screenshotDir = join(siteDir, "screenshots");
  await mkdir(pagesDir, { recursive: true });
  await mkdir(screenshotDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  try {
    const root = await capturePage(browser, url, pageOptions, {
      id: `${id}-home`,
      createdAt,
      artifactDir: pagesDir,
      screenshotDir,
      screenshotPrefix: "home-",
      pagePath: "/",
    });
    const pages: SitePage[] = [
      {
        slug: "home",
        path: "/",
        url: root.artifact.target.finalUrl ?? url,
        status: "inspected",
        artifactPath: "pages/home.json",
      },
    ];
    const artifacts: InspectionArtifact[] = [root.artifact];
    await writeJsonFile(join(siteDir, "pages/home.json"), root.artifact);

    const selected = selectRoutes(root.discoveredPaths, budget);
    for (const path of selected) {
      const slug = slugForPath(path);
      const pageUrl = new URL(path, root.artifact.target.finalUrl ?? url).href;
      try {
        const capture = await capturePage(browser, pageUrl, pageOptions, {
          id: `${id}-${slug}`,
          createdAt,
          artifactDir: pagesDir,
          screenshotDir,
          screenshotPrefix: `${slug}-`,
          pagePath: path,
        });
        await writeJsonFile(
          join(siteDir, `pages/${slug}.json`),
          capture.artifact,
        );
        artifacts.push(capture.artifact);
        pages.push({
          slug,
          path,
          url: capture.artifact.target.finalUrl ?? pageUrl,
          status: "inspected",
          artifactPath: `pages/${slug}.json`,
        });
      } catch (error) {
        pages.push({
          slug,
          path,
          url: pageUrl,
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return {
      version: 2,
      id,
      createdAt,
      target: {
        inputUrl: url,
        finalUrl: root.artifact.target.finalUrl,
      },
      title: root.artifact.page.title,
      provider: root.artifact.provider,
      budget,
      discovery: {
        considered: root.discoveredPaths.length,
        selected,
      },
      summary: {
        discovered: root.discoveredPaths.length,
        inspected: pages.filter((page) => page.status === "inspected").length,
        failed: pages.filter((page) => page.status === "failed").length,
      },
      pages,
      checks: aggregateChecks(artifacts),
      findings: dedupeFindings([
        ...artifacts.flatMap((artifact) => artifact.findings),
        ...pages
          .filter((page) => page.status === "failed")
          .map((page) =>
            finding(
              `page-load-failed-${page.slug}`,
              "error",
              "technical.performance",
              "Page failed to load during site inspection.",
              `${page.path}: ${page.error ?? "unknown error"}`,
              "navigation",
              page.path,
            ),
          ),
      ]),
    };
  } finally {
    await browser.close();
  }
}

async function capturePage(
  browser: Browser,
  url: string,
  options: InspectOptions,
  capture: CaptureOptions,
): Promise<PageCapture> {
  const viewports = options.viewports ?? defaultViewports;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxInternalLinks = options.maxInternalLinks ?? 12;
  const touchTargetMinimum = options.touchTargetMinimum ?? 44;
  await mkdir(capture.screenshotDir, { recursive: true });

  const findings: AuditFinding[] = [];
  const consoleMessages: InspectionArtifact["console"] = [];
  const failedRequests: InspectionArtifact["network"]["failedRequests"] = [];
  const badResponses: InspectionArtifact["network"]["badResponses"] = [];
  const pageErrors: string[] = [];
  const redirects: string[] = [];

  const firstViewport = viewports.at(0) ?? {
    id: "desktop",
    width: 1440,
    height: 1100,
  };
  const context = await browser.newContext({
    viewport: { width: firstViewport.width, height: firstViewport.height },
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(timeoutMs);
    page.on("console", (message) => {
      if (["error", "warning"].includes(message.type())) {
        consoleMessages.push({
          type: message.type(),
          text: message.text(),
          location: formatLocation(message.location()),
        });
      }
    });
    page.on("pageerror", (error) => pageErrors.push(error.message));
    page.on("requestfailed", (request) => {
      if (isRelevantNetworkResource(request)) {
        failedRequests.push({
          url: request.url(),
          method: request.method(),
          resourceType: request.resourceType(),
          errorText: request.failure()?.errorText,
        });
      }
    });
    page.on("response", (response) => {
      if (response.status() >= 400 && isRelevantResponse(response)) {
        badResponses.push({
          url: response.url(),
          status: response.status(),
          resourceType: response.request().resourceType(),
        });
      }
    });

    const startedAt = performance.now();
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout: timeoutMs,
    });
    const navigationMs = Math.round(performance.now() - startedAt);
    if (!response) {
      findings.push(
        finding(
          "navigation-no-response",
          "critical",
          "technical.performance",
          "Navigation completed without an HTTP response.",
          undefined,
          "navigation",
          capture.pagePath,
        ),
      );
    }
    for (const request of response?.request().redirectedFrom()
      ? collectRedirects(response.request())
      : []) {
      redirects.push(request.url());
    }

    const title = await page.title();
    const finalUrl = page.url();
    const viewportResults = [];

    for (const viewport of viewports) {
      await page.setViewportSize({
        width: viewport.width,
        height: viewport.height,
      });
      await page
        .waitForLoadState("networkidle", { timeout: timeoutMs })
        .catch(() => undefined);
      const metrics = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        bodyWidth: document.body.getBoundingClientRect().width,
      }));
      const screenshotPath = join(
        capture.screenshotDir,
        `${capture.screenshotPrefix}${viewport.id}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: true });
      viewportResults.push({
        ...viewport,
        screenshotPath: relative(capture.artifactDir, screenshotPath),
        ...metrics,
      });
      findings.push(
        ...(await detectOverflow(
          page,
          viewport,
          metrics.scrollWidth,
          metrics.clientWidth,
          capture.pagePath,
        )),
      );
      if (viewport.id === "mobile") {
        findings.push(
          ...(await detectSmallTouchTargets(
            page,
            viewport,
            touchTargetMinimum,
            capture.pagePath,
          )),
        );
      }
    }

    const linkInspection = await inspectLinks(
      page,
      finalUrl,
      maxInternalLinks,
      capture.pagePath,
    );
    const linkFindings = linkInspection.findings;
    findings.push(...linkFindings);
    await scrollThroughPage(page);
    findings.push(...(await detectBrokenImages(page, capture.pagePath)));
    findings.push(
      ...pageErrors.map((message, index) =>
        finding(
          `page-error-${index + 1}`,
          "error",
          "technical.performance",
          "Unhandled page exception.",
          message,
          "page-error",
          capture.pagePath,
        ),
      ),
    );
    findings.push(
      ...consoleMessages
        .filter(
          (message) =>
            message.type === "error" &&
            !isBrowserResourceConsoleNoise(message.text),
        )
        .map((message, index) =>
          finding(
            `console-error-${index + 1}`,
            "error",
            "technical.performance",
            "Console error detected.",
            message.text,
            "console-error",
            capture.pagePath,
          ),
        ),
    );
    findings.push(
      ...failedRequests.map((request, index) =>
        finding(
          `network-failure-${index + 1}`,
          networkSeverity(request.resourceType),
          "technical.performance",
          "Network request failed.",
          `${request.resourceType} ${request.url}: ${request.errorText ?? "unknown"}`,
          "network-failure",
          capture.pagePath,
        ),
      ),
    );
    findings.push(
      ...badResponses.map((item, index) =>
        finding(
          `bad-response-${index + 1}`,
          httpSeverity(item.status, item.resourceType),
          "technical.performance",
          `HTTP ${item.status} response detected.`,
          `${item.resourceType} ${item.url}`,
          "http-response",
          capture.pagePath,
        ),
      ),
    );

    const axe = await new AxeBuilder({ page }).analyze();
    for (const violation of axe.violations) {
      const severity = axeSeverity(violation.impact);
      findings.push(
        finding(
          `axe-${violation.id}`,
          severity,
          "technical.accessibilitySeo",
          `Accessibility violation: ${violation.help}.`,
          `${violation.nodes.length} node(s). ${violation.helpUrl}`,
          "axe-core",
          capture.pagePath,
        ),
      );
    }

    const seriousAccessibilityViolations = axe.violations.filter((violation) =>
      ["critical", "serious"].includes(violation.impact ?? ""),
    ).length;
    const horizontalOverflowViewports = viewportResults.filter(
      (viewport) => viewport.scrollWidth > viewport.clientWidth + 2,
    ).length;

    return {
      artifact: {
        version: 1,
        id: capture.id,
        createdAt: capture.createdAt,
        target: {
          inputUrl: url,
          finalUrl,
        },
        provider: {
          name: "playwright",
          version: chromium.name(),
        },
        page: {
          title,
          status: response?.status(),
          navigationMs,
          redirects,
        },
        viewports: viewportResults,
        checks: {
          linksChecked: linkInspection.checked,
          brokenInternalLinks: linkFindings.filter((item) =>
            item.id.startsWith("broken-internal-link"),
          ).length,
          brokenAnchors: linkFindings.filter((item) =>
            item.id.startsWith("broken-anchor"),
          ).length,
          brokenImages: findings.filter((item) =>
            item.id.startsWith("broken-image"),
          ).length,
          consoleErrors: findings.filter((item) =>
            item.id.startsWith("console-error"),
          ).length,
          pageErrors: pageErrors.length,
          networkFailures: failedRequests.length,
          badHttpResponses: badResponses.length,
          accessibilityViolations: axe.violations.length,
          seriousAccessibilityViolations,
          smallTouchTargets: findings.filter((item) =>
            item.id.startsWith("small-touch-target"),
          ).length,
          horizontalOverflowViewports,
        },
        console: consoleMessages,
        network: {
          failedRequests,
          badResponses,
        },
        findings: dedupeFindings(findings),
      },
      discoveredPaths: linkInspection.discovered,
    };
  } finally {
    await context.close();
  }
}

async function detectOverflow(
  page: Page,
  viewport: Viewport,
  scrollWidth: number,
  clientWidth: number,
  pagePath: string,
): Promise<AuditFinding[]> {
  if (scrollWidth <= clientWidth + 2) return [];
  const offenders = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    return Array.from(document.querySelectorAll("body *"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          selector: selectorFor(element),
          right: Math.round(rect.right),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          offscreen:
            getComputedStyle(element).position === "fixed" &&
            rect.left < -width * 0.5,
        };
      })
      .filter(
        (item) =>
          !item.offscreen &&
          item.width > 0 &&
          (item.right > width + 2 || item.left < -2),
      )
      .slice(0, 5);

    function selectorFor(element: Element): string {
      if (element.id) return `#${element.id}`;
      const testId = element.getAttribute("data-testid");
      if (testId) return `[data-testid="${testId}"]`;
      const className = Array.from(element.classList).slice(0, 2).join(".");
      return `${element.tagName.toLowerCase()}${className ? `.${className}` : ""}`;
    }
  });
  return [
    finding(
      `horizontal-overflow-${viewport.id}`,
      viewport.id === "mobile" ? "error" : "warning",
      "responsive.mobile",
      `Horizontal overflow detected on ${viewport.id}.`,
      `scrollWidth ${scrollWidth}px exceeds viewport ${clientWidth}px. Likely offenders: ${offenders
        .map((item) => `${item.selector} (${item.width}px)`)
        .join(", ")}`,
      "horizontal-overflow",
      pagePath,
    ),
  ];
}

async function detectSmallTouchTargets(
  page: Page,
  viewport: Viewport,
  minimum: number,
  pagePath: string,
): Promise<AuditFinding[]> {
  const targets = await page.evaluate((minSize) => {
    return Array.from(
      document.querySelectorAll(
        "a, button, input, select, textarea, [role='button'], [tabindex]",
      ),
    )
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const label =
          element.getAttribute("aria-label") ??
          element.textContent?.trim().slice(0, 80) ??
          element.tagName.toLowerCase();
        return {
          label,
          width: Math.round(rect.width),
          height: Math.round(rect.height),
          visible: rect.width > 0 && rect.height > 0,
        };
      })
      .filter(
        (item) => item.visible && item.width < minSize && item.height < minSize,
      )
      .slice(0, 10);
  }, minimum);
  return targets.map((target, index) =>
    finding(
      `small-touch-target-${viewport.id}-${index + 1}`,
      "warning",
      "responsive.mobile",
      "Interactive element is smaller than the configured mobile touch target.",
      `${target.label}: ${target.width}x${target.height}px, minimum ${minimum}px.`,
      "touch-target",
      pagePath,
    ),
  );
}

async function inspectLinks(
  page: Page,
  finalUrl: string,
  maxInternalLinks: number,
  pagePath: string,
): Promise<{
  findings: AuditFinding[];
  checked: number;
  discovered: string[];
}> {
  const links = (await page.$$eval("a", (elements) =>
    elements.map((element) => ({
      href: element.getAttribute("href"),
      text: element.textContent?.trim().slice(0, 100) ?? "",
    })),
  )) as LinkRecord[];
  const findings: AuditFinding[] = [];
  const final = new URL(finalUrl);
  const internal = links
    .filter(
      (link) =>
        link.href &&
        !link.href.startsWith("mailto:") &&
        !link.href.startsWith("tel:"),
    )
    .map((link) => ({ ...link, url: new URL(link.href ?? "", finalUrl) }))
    .filter((link) => link.url.origin === final.origin);
  const discovered = [
    ...new Set(
      internal
        .map((link) => link.url.pathname)
        .filter((path) => !isLikelyAssetPath(path)),
    ),
  ];
  const toCheck = internal.slice(0, maxInternalLinks);

  for (const [index, link] of toCheck.entries()) {
    if (!link.href || link.href.trim() === "#") {
      findings.push(
        finding(
          `invalid-link-${index + 1}`,
          "warning",
          "responsive.navigation",
          "Invalid or empty link href.",
          link.text,
          "internal-link",
          pagePath,
        ),
      );
      continue;
    }
    if (link.url.pathname === final.pathname && link.url.hash) {
      const exists = await page
        .locator(link.url.hash)
        .count()
        .catch(() => 0);
      if (exists === 0) {
        findings.push(
          finding(
            `broken-anchor-${index + 1}`,
            "warning",
            "responsive.navigation",
            "Internal anchor target is missing.",
            link.url.href,
            "internal-link",
            pagePath,
          ),
        );
      }
      continue;
    }
    const response = await page.request
      .get(link.url.href, { timeout: 5000, maxRedirects: 2 })
      .catch(() => null);
    if (!response || response.status() >= 400) {
      findings.push(
        finding(
          `broken-internal-link-${index + 1}`,
          "error",
          "responsive.navigation",
          "Internal link returns an error.",
          `${link.url.href} -> ${response?.status() ?? "request failed"}`,
          "internal-link",
          pagePath,
        ),
      );
    }
  }
  return { findings, checked: toCheck.length, discovered };
}

async function detectBrokenImages(
  page: Page,
  pagePath: string,
): Promise<AuditFinding[]> {
  const images = await page.$$eval("img", (elements) =>
    elements
      .map((image) => ({
        src: image.currentSrc || image.src,
        alt: image.alt,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      }))
      .filter((image) => image.naturalWidth === 0 || image.naturalHeight === 0),
  );
  return images.map((image, index) =>
    finding(
      `broken-image-${index + 1}`,
      "critical",
      "technical.accessibilitySeo",
      "Image failed to load.",
      `${image.src} alt="${image.alt}"`,
      "broken-image",
      pagePath,
    ),
  );
}

async function scrollThroughPage(page: Page): Promise<void> {
  await page
    .evaluate(async () => {
      const step = Math.max(window.innerHeight * 0.8, 400);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
      window.scrollTo(0, 0);
    })
    .catch(() => undefined);
}

const checkConfidence: Record<string, number> = {
  navigation: 0.95,
  "horizontal-overflow": 0.98,
  "touch-target": 0.7,
  "internal-link": 0.9,
  "broken-image": 0.95,
  "page-error": 0.95,
  "console-error": 0.9,
  "network-failure": 0.9,
  "http-response": 0.9,
  "axe-core": 0.85,
};

function finding(
  id: string,
  severity: Severity,
  criterion: string,
  message: string,
  evidence: string | undefined,
  check: string,
  page?: string,
): AuditFinding {
  return {
    id,
    criterion,
    severity,
    message,
    evidence,
    source: `automated:playwright:${check}`,
    confidence: checkConfidence[check],
    page,
    provenance: {
      kind: "observed",
      provider: "playwright",
      check,
    },
  };
}

function aggregateChecks(
  artifacts: InspectionArtifact[],
): InspectionArtifact["checks"] {
  const total = (key: keyof InspectionArtifact["checks"]) =>
    artifacts.reduce((sum, artifact) => sum + artifact.checks[key], 0);
  return {
    linksChecked: total("linksChecked"),
    brokenInternalLinks: total("brokenInternalLinks"),
    brokenAnchors: total("brokenAnchors"),
    brokenImages: total("brokenImages"),
    consoleErrors: total("consoleErrors"),
    pageErrors: total("pageErrors"),
    networkFailures: total("networkFailures"),
    badHttpResponses: total("badHttpResponses"),
    accessibilityViolations: total("accessibilityViolations"),
    seriousAccessibilityViolations: total("seriousAccessibilityViolations"),
    smallTouchTargets: total("smallTouchTargets"),
    horizontalOverflowViewports: total("horizontalOverflowViewports"),
  };
}

function slugForPath(path: string): string {
  if (path === "/") return "home";
  const slug = path
    .replace(/^\//, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return slug || "page";
}

function createInspectionId(url: string, createdAt: string): string {
  const safeHost = new URL(url).hostname
    .replace(/[^a-z0-9]+/gi, "-")
    .toLowerCase();
  return `${safeHost}-${createdAt.replace(/[^0-9]/g, "").slice(0, 14)}`;
}

function collectRedirects(request: Request): Request[] {
  const requests: Request[] = [];
  let current: Request | null = request;
  while (current) {
    requests.unshift(current);
    current = current.redirectedFrom();
  }
  return requests.slice(0, -1);
}

function formatLocation(location: {
  url: string;
  lineNumber: number;
  columnNumber: number;
}): string | undefined {
  return location.url
    ? `${location.url}:${location.lineNumber}:${location.columnNumber}`
    : undefined;
}

function isRelevantNetworkResource(request: Request): boolean {
  if (isLikelyThirdPartyNoise(request.url())) return false;
  return [
    "document",
    "script",
    "stylesheet",
    "image",
    "font",
    "xhr",
    "fetch",
  ].includes(request.resourceType());
}

function isRelevantResponse(response: Response): boolean {
  if (isLikelyThirdPartyNoise(response.url())) return false;
  return [
    "document",
    "script",
    "stylesheet",
    "image",
    "font",
    "xhr",
    "fetch",
  ].includes(response.request().resourceType());
}

function isLikelyThirdPartyNoise(url: string): boolean {
  return /google-analytics|googletagmanager|facebook\.com\/tr|doubleclick|hotjar|plausible|vercel-insights|edit\.framer\.com/i.test(
    url,
  );
}

function isLikelyAssetPath(path: string): boolean {
  return /\.(png|jpe?g|webp|gif|svg|ico|css|js|woff2?|pdf|zip)$/i.test(path);
}

function isBrowserResourceConsoleNoise(text: string): boolean {
  return /favicon\.ico|Failed to load resource|edit\.framer\.com/i.test(text);
}

function networkSeverity(resourceType: string): Severity {
  return ["document", "script", "stylesheet"].includes(resourceType)
    ? "error"
    : "warning";
}

function httpSeverity(status: number, resourceType: string): Severity {
  if (status >= 500) return "error";
  return ["document", "script", "stylesheet", "image"].includes(resourceType)
    ? "error"
    : "warning";
}

function axeSeverity(impact: string | null | undefined): Severity {
  if (impact === "critical") return "critical";
  if (impact === "serious") return "error";
  if (impact === "moderate") return "warning";
  return "info";
}
