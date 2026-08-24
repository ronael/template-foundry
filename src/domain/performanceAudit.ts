import type {
  PagePerformanceEvidence,
  PerformancePolicy,
  PerformanceSummary,
  SitePerformanceEvidence,
} from "./performance.js";
import type { AuditFinding, Severity } from "./schemas.js";

type Threshold = PerformancePolicy["totalTransferBytes"];

export type PerformanceAssessment = {
  score?: number;
  findings: AuditFinding[];
  summary: PerformanceSummary;
};

export function assessPerformance(
  site: SitePerformanceEvidence,
  policy: PerformancePolicy,
): PerformanceAssessment {
  const measured = site.pages.filter(
    (page) => page.evidence.status === "measured",
  );
  const pageScores = measured.map((page) => ({
    path: page.path,
    score: scorePage(page.evidence, policy),
  }));
  const availableScores = pageScores.filter(
    (page): page is { path: string; score: number } => page.score !== undefined,
  );
  const score = aggregatePageScores(availableScores.map((page) => page.score));
  const findings = measured.flatMap((page) =>
    performanceFindings(page.path, page.evidence, policy),
  );

  return {
    ...(score !== undefined ? { score } : {}),
    findings,
    summary: buildSummary(site, policy),
  };
}

export function thresholdSeverity(
  value: number,
  threshold: Threshold,
): Severity | undefined {
  if (value > threshold.errorAbove) return "error";
  if (value > threshold.warningAbove) return "warning";
  return undefined;
}

export function thresholdScore(value: number, threshold: Threshold): number {
  const severity = thresholdSeverity(value, threshold);
  if (severity === "error") return 50;
  if (severity === "warning") return 75;
  return 100;
}

export function aggregatePageScores(scores: number[]): number | undefined {
  if (scores.length === 0) return undefined;
  const mean = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  const worst = Math.min(...scores);
  return Math.round(mean * 0.7 + worst * 0.3);
}

function scorePage(
  evidence: PagePerformanceEvidence,
  policy: PerformancePolicy,
): number | undefined {
  if (evidence.status !== "measured") return undefined;
  const scores = [thresholdScore(evidence.dom.nodes, policy.domNodes)];
  if (evidence.transfer.status === "measured") {
    scores.push(
      thresholdScore(
        evidence.transfer.transferBytes,
        policy.totalTransferBytes,
      ),
      thresholdScore(evidence.images.transferBytes, policy.imageTransferBytes),
      thresholdScore(
        evidence.javascript.transferBytes,
        policy.javascriptTransferBytes,
      ),
      thresholdScore(evidence.fonts.transferBytes, policy.fontTransferBytes),
    );
  }
  const preferredLcp =
    evidence.lcp.find(
      (item) => item.viewport === "mobile" && item.status === "measured",
    ) ?? evidence.lcp.find((item) => item.status === "measured");
  if (preferredLcp?.valueMs !== undefined) {
    scores.push(thresholdScore(preferredLcp.valueMs, policy.lcpMs));
  }
  return Math.round(
    scores.reduce((sum, metricScore) => sum + metricScore, 0) / scores.length,
  );
}

function performanceFindings(
  page: string,
  evidence: PagePerformanceEvidence,
  policy: PerformancePolicy,
): AuditFinding[] {
  const findings: AuditFinding[] = [];
  if (evidence.transfer.status === "measured") {
    addMetricFinding(
      findings,
      page,
      "total-transfer",
      evidence.transfer.transferBytes,
      policy.totalTransferBytes,
      `Page transferred ${formatBytes(evidence.transfer.transferBytes)} across ${evidence.transfer.totalRequests} requests.`,
      evidence.provenance,
    );
    addMetricFinding(
      findings,
      page,
      "image-weight",
      evidence.images.transferBytes,
      policy.imageTransferBytes,
      `${evidence.images.count} image resources transferred ${formatBytes(evidence.images.transferBytes)}.`,
      evidence.provenance,
    );
    addMetricFinding(
      findings,
      page,
      "javascript-weight",
      evidence.javascript.transferBytes,
      policy.javascriptTransferBytes,
      `${evidence.javascript.count} scripts transferred ${formatBytes(evidence.javascript.transferBytes)}.`,
      evidence.provenance,
    );
    addMetricFinding(
      findings,
      page,
      "font-weight",
      evidence.fonts.transferBytes,
      policy.fontTransferBytes,
      `${evidence.fonts.count} font resources transferred ${formatBytes(evidence.fonts.transferBytes)}.`,
      evidence.provenance,
    );
  }
  addMetricFinding(
    findings,
    page,
    "dom-size",
    evidence.dom.nodes,
    policy.domNodes,
    `DOM contains ${evidence.dom.nodes} elements with maximum depth ${evidence.dom.maxDepth}.`,
    evidence.provenance,
    "elements",
  );

  for (const lcp of evidence.lcp) {
    if (lcp.status !== "measured" || lcp.valueMs === undefined) continue;
    const severity = thresholdSeverity(lcp.valueMs, policy.lcpMs);
    if (!severity) continue;
    findings.push({
      id: `performance-lcp-${slug(page)}-${slug(lcp.viewport)}`,
      criterion: "technical.performance",
      severity,
      message: `Largest Contentful Paint exceeds the configured ${severity} threshold.`,
      evidence: `${Math.round(lcp.valueMs)} ms on ${page} at ${lcp.viewport}${lcp.element?.selector ? `; element ${lcp.element.selector}` : ""}.`,
      suggestedFix:
        "Prioritize the largest above-the-fold element and reduce render-blocking work.",
      source: `automated:${lcp.provenance.provider}:${lcp.provenance.check}`,
      confidence: lcp.provenance.confidence,
      page,
      viewport: lcp.viewport,
      provenance: {
        kind: "observed",
        provider: lcp.provenance.provider,
        check: lcp.provenance.check,
      },
    });
  }

  for (const [index, image] of evidence.images.resources.entries()) {
    if (evidence.transfer.status !== "measured") continue;
    const severity = thresholdSeverity(
      image.transferBytes,
      policy.oversizedImageBytes,
    );
    if (!severity) continue;
    const source = evidence.resources.find(
      (resource) => resource.url === image.url,
    );
    findings.push({
      id: `performance-oversized-image-${slug(page)}-${index + 1}`,
      criterion: "technical.performance",
      severity,
      message: "Image resource exceeds the configured transfer threshold.",
      evidence: `${shortUrl(image.url)} transferred ${formatBytes(image.transferBytes)} on ${page}${image.renderedWidth !== undefined ? `; rendered ${image.renderedWidth}x${image.renderedHeight}px, intrinsic ${image.intrinsicWidth}x${image.intrinsicHeight}px` : ""}.`,
      suggestedFix:
        "Resize and compress the image for its rendered dimensions and delivery format.",
      source: `automated:${evidence.provenance.provider}:oversized-image`,
      confidence: source?.thirdParty ? 0.9 : 0.97,
      page,
      provenance: {
        kind: "observed",
        provider: evidence.provenance.provider,
        check: "oversized-image",
      },
    });
  }

  for (const [index, script] of evidence.javascript.resources.entries()) {
    if (evidence.transfer.status !== "measured") continue;
    const source = evidence.resources.find(
      (resource) => resource.url === script.url,
    );
    if (source?.thirdParty) continue;
    const severity = thresholdSeverity(
      script.transferBytes,
      policy.oversizedScriptBytes,
    );
    if (!severity) continue;
    findings.push({
      id: `performance-oversized-script-${slug(page)}-${index + 1}`,
      criterion: "technical.performance",
      severity,
      message: "First-party script exceeds the configured transfer threshold.",
      evidence: `${shortUrl(script.url)} transferred ${formatBytes(script.transferBytes)} on ${page}.`,
      suggestedFix: "Split or reduce the first-party JavaScript payload.",
      source: `automated:${evidence.provenance.provider}:oversized-script`,
      confidence: 0.97,
      page,
      provenance: {
        kind: "observed",
        provider: evidence.provenance.provider,
        check: "oversized-script",
      },
    });
  }
  return findings;
}

function addMetricFinding(
  findings: AuditFinding[],
  page: string,
  check: string,
  value: number,
  threshold: Threshold,
  evidence: string,
  provenance: PagePerformanceEvidence["provenance"],
  unit = "bytes",
): void {
  const severity = thresholdSeverity(value, threshold);
  if (!severity) return;
  findings.push({
    id: `performance-${check}-${slug(page)}`,
    criterion: "technical.performance",
    severity,
    message: `${humanize(check)} exceeds the configured ${severity} threshold.`,
    evidence: `${evidence} Threshold: ${threshold[severity === "error" ? "errorAbove" : "warningAbove"]} ${unit}.`,
    suggestedFix: "Reduce this page-level performance cost before release.",
    source: `automated:${provenance.provider}:${check}`,
    confidence: 0.95,
    page,
    provenance: {
      kind: "observed",
      provider: provenance.provider,
      check,
    },
  });
}

function buildSummary(
  site: SitePerformanceEvidence,
  policy: PerformancePolicy,
): PerformanceSummary {
  const measured = site.pages.filter(
    (page) => page.evidence.status === "measured",
  );
  const transfers = measured.flatMap((page) =>
    page.evidence.transfer.status === "measured"
      ? [{ path: page.path, value: page.evidence.transfer.transferBytes }]
      : [],
  );
  const worstTransfer = [...transfers].sort((a, b) => b.value - a.value)[0];
  const viewports = [
    ...new Set(
      site.pages.flatMap((page) =>
        page.evidence.lcp.map((lcp) => lcp.viewport),
      ),
    ),
  ];
  const lcp = viewports.flatMap((viewport) => {
    const values = site.pages.flatMap((page) => {
      const item = page.evidence.lcp.find(
        (candidate) => candidate.viewport === viewport,
      );
      return item?.status === "measured" && item.valueMs !== undefined
        ? [{ path: page.path, value: item.valueMs }]
        : [];
    });
    if (values.length === 0) return [];
    const worst = [...values].sort((a, b) => b.value - a.value)[0];
    if (!worst) return [];
    return [
      {
        viewport,
        averageMs: Math.round(
          values.reduce((sum, item) => sum + item.value, 0) / values.length,
        ),
        worstMs: worst.value,
        worstPage: worst.path,
        measuredPages: values.length,
        notEvaluatedPages: site.pages.length - values.length,
      },
    ];
  });
  return {
    pagesMeasured: measured.length,
    ...(worstTransfer
      ? {
          transfer: {
            averageBytes: Math.round(
              transfers.reduce((sum, item) => sum + item.value, 0) /
                transfers.length,
            ),
            worstBytes: worstTransfer.value,
            worstPage: worstTransfer.path,
          },
        }
      : {}),
    lcp,
    heavyImages: measured.reduce((count, page) => {
      if (page.evidence.transfer.status !== "measured") return count;
      return (
        count +
        page.evidence.images.resources.filter(
          (image) =>
            image.transferBytes > policy.oversizedImageBytes.warningAbove,
        ).length
      );
    }, 0),
    heavyScripts: measured.reduce((count, page) => {
      if (page.evidence.transfer.status !== "measured") return count;
      return (
        count +
        page.evidence.javascript.resources.filter(
          (script) =>
            script.transferBytes > policy.oversizedScriptBytes.warningAbove &&
            !page.evidence.resources.find(
              (resource) => resource.url === script.url,
            )?.thirdParty,
        ).length
      );
    }, 0),
    commonHeavyResources: commonHeavyResources(measured, policy),
  };
}

function commonHeavyResources(
  pages: SitePerformanceEvidence["pages"],
  policy: PerformancePolicy,
): PerformanceSummary["commonHeavyResources"] {
  const byUrl = new Map<
    string,
    {
      category: "image" | "script";
      pages: Set<string>;
      maxTransferBytes: number;
    }
  >();
  for (const page of pages) {
    if (page.evidence.transfer.status !== "measured") continue;
    const candidates = [
      ...page.evidence.images.resources
        .filter(
          (resource) =>
            resource.transferBytes > policy.oversizedImageBytes.warningAbove,
        )
        .map((resource) => ({ ...resource, category: "image" as const })),
      ...page.evidence.javascript.resources
        .filter(
          (resource) =>
            resource.transferBytes > policy.oversizedScriptBytes.warningAbove &&
            !page.evidence.resources.find((item) => item.url === resource.url)
              ?.thirdParty,
        )
        .map((resource) => ({ ...resource, category: "script" as const })),
    ];
    for (const resource of candidates) {
      const existing = byUrl.get(resource.url) ?? {
        category: resource.category,
        pages: new Set<string>(),
        maxTransferBytes: 0,
      };
      existing.pages.add(page.path);
      existing.maxTransferBytes = Math.max(
        existing.maxTransferBytes,
        resource.transferBytes,
      );
      byUrl.set(resource.url, existing);
    }
  }
  return [...byUrl.entries()]
    .filter(([, resource]) => resource.pages.size > 1)
    .sort(
      ([urlA, resourceA], [urlB, resourceB]) =>
        resourceB.maxTransferBytes - resourceA.maxTransferBytes ||
        urlA.localeCompare(urlB),
    )
    .slice(0, 3)
    .map(([url, resource]) => ({
      url,
      category: resource.category,
      pages: [...resource.pages].sort(),
      maxTransferBytes: resource.maxTransferBytes,
    }));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}

function humanize(value: string): string {
  return value
    .split("-")
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function slug(value: string): string {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "home";
}

function shortUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.slice(0, 180);
  } catch {
    return value.slice(0, 180);
  }
}
