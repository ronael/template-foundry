import { mkdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { AxeBuilder } from "@axe-core/playwright";
import { chromium, type Page, type Request, type Response } from "playwright";
import {
  defaultViewports,
  type InspectionArtifact,
  type InspectOptions,
  type Viewport,
} from "../domain/inspection.js";
import type { AuditFinding, Severity } from "../domain/schemas.js";

type LinkRecord = {
  href: string | null;
  text: string;
};

export async function inspectUrl(
  url: string,
  options: InspectOptions,
): Promise<InspectionArtifact> {
  const viewports = options.viewports ?? defaultViewports;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const maxInternalLinks = options.maxInternalLinks ?? 12;
  const touchTargetMinimum = options.touchTargetMinimum ?? 44;
  const createdAt = new Date().toISOString();
  const id = createInspectionId(url, createdAt);
  const inspectionDir = join(options.outputDir, id);
  const screenshotDir = join(inspectionDir, "screenshots");
  await mkdir(screenshotDir, { recursive: true });

  const findings: AuditFinding[] = [];
  const consoleMessages: InspectionArtifact["console"] = [];
  const failedRequests: InspectionArtifact["network"]["failedRequests"] = [];
  const badResponses: InspectionArtifact["network"]["badResponses"] = [];
  const pageErrors: string[] = [];
  const redirects: string[] = [];

  const browser = await chromium.launch({ headless: true });
  try {
    const firstViewport = viewports.at(0) ?? {
      id: "desktop",
      width: 1440,
      height: 1100,
    };
    const context = await browser.newContext({
      viewport: { width: firstViewport.width, height: firstViewport.height },
    });
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
      const screenshotPath = join(screenshotDir, `${viewport.id}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      viewportResults.push({
        ...viewport,
        screenshotPath: relative(
          dirname(join(inspectionDir, "inspection.json")),
          screenshotPath,
        ),
        ...metrics,
      });
      findings.push(
        ...(await detectOverflow(
          page,
          viewport,
          metrics.scrollWidth,
          metrics.clientWidth,
        )),
      );
      if (viewport.id === "mobile") {
        findings.push(
          ...(await detectSmallTouchTargets(
            page,
            viewport,
            touchTargetMinimum,
          )),
        );
      }
    }

    const linkFindings = await inspectLinks(page, finalUrl, maxInternalLinks);
    findings.push(...linkFindings);
    await scrollThroughPage(page);
    findings.push(...(await detectBrokenImages(page)));
    findings.push(
      ...pageErrors.map((message, index) =>
        finding(
          `page-error-${index + 1}`,
          "error",
          "technical.performance",
          "Unhandled page exception.",
          message,
          "page-error",
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
      version: 1,
      id,
      createdAt,
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
        linksChecked: linkFindings.filter(
          (item) => item.provenance?.check === "internal-link",
        ).length,
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
    };
  } finally {
    await browser.close();
  }
}

async function detectOverflow(
  page: Page,
  viewport: Viewport,
  scrollWidth: number,
  clientWidth: number,
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
    ),
  ];
}

async function detectSmallTouchTargets(
  page: Page,
  viewport: Viewport,
  minimum: number,
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
    ),
  );
}

async function inspectLinks(
  page: Page,
  finalUrl: string,
  maxInternalLinks: number,
): Promise<AuditFinding[]> {
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
    .filter((link) => link.url.origin === final.origin)
    .slice(0, maxInternalLinks);

  for (const [index, link] of internal.entries()) {
    if (!link.href || link.href.trim() === "#") {
      findings.push(
        finding(
          `invalid-link-${index + 1}`,
          "warning",
          "responsive.navigation",
          "Invalid or empty link href.",
          link.text,
          "internal-link",
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
        ),
      );
    }
  }
  return findings;
}

async function detectBrokenImages(page: Page): Promise<AuditFinding[]> {
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

function finding(
  id: string,
  severity: Severity,
  criterion: string,
  message: string,
  evidence: string | undefined,
  check: string,
): AuditFinding {
  return {
    id,
    criterion,
    severity,
    message,
    evidence,
    source: `automated:playwright:${check}`,
    provenance: {
      kind: "observed",
      provider: "playwright",
      check,
    },
  };
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
  return /google-analytics|googletagmanager|facebook\.com\/tr|doubleclick|hotjar|plausible|vercel-insights/i.test(
    url,
  );
}

function isBrowserResourceConsoleNoise(text: string): boolean {
  return /favicon\.ico|Failed to load resource/i.test(text);
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

function dedupeFindings(findings: AuditFinding[]): AuditFinding[] {
  const seen = new Set<string>();
  return findings.filter((finding) => {
    const key = `${finding.id}:${finding.evidence ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
