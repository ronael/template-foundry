import { describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import type {
  PagePerformanceEvidence,
  SitePerformanceEvidence,
} from "../../src/domain/performance.js";
import {
  aggregatePageScores,
  assessPerformance,
  formatBytes,
  thresholdScore,
  thresholdSeverity,
} from "../../src/domain/performanceAudit.js";

function evidence(
  overrides: Partial<PagePerformanceEvidence> = {},
): PagePerformanceEvidence {
  return {
    status: "measured",
    resourceViewport: "desktop",
    transfer: {
      status: "measured",
      totalRequests: 10,
      measuredRequests: 10,
      transferBytes: 2_000_000,
    },
    resources: [],
    breakdown: [],
    images: { count: 0, transferBytes: 0, resources: [] },
    fonts: { count: 0, transferBytes: 0, faces: [], resources: [] },
    javascript: { count: 0, transferBytes: 0, resources: [] },
    dom: { nodes: 500, maxDepth: 12 },
    lcp: [
      {
        viewport: "mobile",
        status: "not-evaluated",
        reason: "Unavailable in fixture",
        provenance: {
          provider: "performance-observer",
          check: "largest-contentful-paint",
          confidence: 0.8,
        },
      },
    ],
    provenance: {
      provider: "playwright-cdp",
      check: "cold-load-performance",
      confidence: 0.95,
      cacheDisabled: true,
      serviceWorkerBypassed: true,
    },
    ...overrides,
  };
}

describe("performance audit", () => {
  it("keeps bytes unambiguous and applies configured bands", () => {
    const threshold = { warningAbove: 1000, errorAbove: 2000 };
    expect(thresholdSeverity(1000, threshold)).toBeUndefined();
    expect(thresholdSeverity(1001, threshold)).toBe("warning");
    expect(thresholdSeverity(2001, threshold)).toBe("error");
    expect(thresholdScore(2001, threshold)).toBe(50);
    expect(formatBytes(1024)).toBe("1.0 KiB");
  });

  it("aggregates with the existing 70% mean and 30% worst strategy", () => {
    expect(aggregatePageScores([100, 50])).toBe(68);
    expect(aggregatePageScores([])).toBeUndefined();
  });

  it("excludes unavailable LCP and creates page-scoped evidence findings", () => {
    const policy = defaultStandard.performance;
    if (!policy) throw new Error("Missing default performance policy");
    const heavyPage = evidence({
      transfer: {
        status: "measured",
        totalRequests: 30,
        measuredRequests: 30,
        transferBytes: 8 * 1024 * 1024,
      },
      images: {
        count: 1,
        transferBytes: 3 * 1024 * 1024,
        resources: [
          {
            url: "https://cdn.example/hero.webp",
            transferBytes: 3 * 1024 * 1024,
            mimeType: "image/webp",
            renderedWidth: 390,
            renderedHeight: 300,
            intrinsicWidth: 2400,
            intrinsicHeight: 1600,
          },
        ],
      },
      resources: [
        {
          url: "https://cdn.example/hero.webp",
          category: "image",
          mimeType: "image/webp",
          transferBytes: 3 * 1024 * 1024,
          transferStatus: "measured",
          fromCache: false,
          thirdParty: true,
        },
      ],
    });
    const site: SitePerformanceEvidence = {
      pages: [
        { path: "/", evidence: evidence() },
        { path: "/pricing", evidence: heavyPage },
      ],
    };
    const result = assessPerformance(site, policy);

    expect(result.score).toBeLessThan(100);
    expect(result.summary.transfer?.worstPage).toBe("/pricing");
    expect(result.summary.lcp).toHaveLength(0);
    expect(
      result.findings.some(
        (finding) =>
          finding.page === "/pricing" &&
          finding.provenance?.check === "oversized-image",
      ),
    ).toBe(true);
    expect(result.findings.every((finding) => finding.confidence)).toBe(true);
  });

  it("returns no score when page performance itself is unavailable", () => {
    const policy = defaultStandard.performance;
    if (!policy) throw new Error("Missing default performance policy");
    const result = assessPerformance(
      {
        pages: [
          {
            path: "/",
            evidence: evidence({
              status: "not-evaluated",
              reason: "CDP was unavailable",
            }),
          },
        ],
      },
      policy,
    );

    expect(result.score).toBeUndefined();
    expect(result.findings).toHaveLength(0);
    expect(result.summary.pagesMeasured).toBe(0);
  });

  it("does not score an incomplete transfer total as zero or partial", () => {
    const policy = defaultStandard.performance;
    if (!policy) throw new Error("Missing default performance policy");
    const result = assessPerformance(
      {
        pages: [
          {
            path: "/",
            evidence: evidence({
              transfer: {
                status: "not-evaluated",
                reason: "One request did not finish",
                totalRequests: 10,
                measuredRequests: 9,
                transferBytes: 20 * 1024 * 1024,
              },
            }),
          },
        ],
      },
      policy,
    );

    expect(result.score).toBe(100);
    expect(result.summary.transfer).toBeUndefined();
    expect(
      result.findings.some(
        (finding) => finding.provenance?.check === "total-transfer",
      ),
    ).toBe(false);
  });
});
