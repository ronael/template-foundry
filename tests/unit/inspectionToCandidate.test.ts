import { describe, expect, it } from "vitest";
import { inspectionToCandidate } from "../../src/application/inspectionToCandidate.js";
import type { InspectionArtifact } from "../../src/domain/inspection.js";

describe("inspectionToCandidate", () => {
  it("maps deterministic inspection defects into candidate flags and scores", () => {
    const candidate = inspectionToCandidate({
      version: 1,
      id: "fixture",
      createdAt: "2026-08-23T00:00:00.000Z",
      target: {
        inputUrl: "https://example.com",
        finalUrl: "https://example.com",
      },
      provider: { name: "playwright" },
      page: { title: "Fixture", status: 200, navigationMs: 120, redirects: [] },
      viewports: [
        {
          id: "mobile",
          width: 390,
          height: 844,
          screenshotPath: "screenshots/mobile.png",
          scrollWidth: 620,
          clientWidth: 390,
          bodyWidth: 390,
        },
      ],
      checks: {
        linksChecked: 2,
        brokenInternalLinks: 1,
        brokenAnchors: 1,
        brokenImages: 1,
        consoleErrors: 1,
        pageErrors: 1,
        networkFailures: 1,
        badHttpResponses: 1,
        accessibilityViolations: 2,
        seriousAccessibilityViolations: 1,
        smallTouchTargets: 2,
        horizontalOverflowViewports: 1,
      },
      console: [],
      network: { failedRequests: [], badResponses: [] },
      findings: [
        {
          id: "horizontal-overflow-mobile",
          severity: "error",
          criterion: "responsive.mobile",
          message: "Overflow",
          source: "automated:playwright:horizontal-overflow",
        },
      ],
    } satisfies InspectionArtifact);

    expect(candidate.flags.criticalOverflow).toBe(true);
    expect(candidate.flags.missingRequiredAssets).toBe(true);
    expect(candidate.evaluations.responsive.mobile.score).toBeLessThan(85);
    expect(candidate.evaluations.technical.accessibilitySeo.score).toBeLessThan(
      80,
    );
    expect(candidate.findings).toHaveLength(1);
    expect(candidate.evaluations.visual.hierarchy.source).toBe("not-evaluated");
    expect(candidate.evaluations.customization.brandSwap.source).toBe(
      "not-evaluated",
    );
    expect(candidate.evaluations.technical.performance.source).toBe(
      "automated",
    );
  });
});
