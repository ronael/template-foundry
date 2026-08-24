import { describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import { inspectionToCandidate } from "../../src/application/inspectionToCandidate.js";
import { auditCandidate } from "../../src/domain/audit.js";
import type { SiteInspectionArtifact } from "../../src/domain/inspection.js";
import type { AuditFinding } from "../../src/domain/schemas.js";

function siteFinding(
  id: string,
  severity: AuditFinding["severity"],
  page: string,
  criterion = "technical.performance",
): AuditFinding {
  return {
    id,
    severity,
    criterion,
    message: id,
    page,
    source: `automated:playwright:test`,
  };
}

function siteArtifact(
  findings: AuditFinding[],
  checks?: Partial<SiteInspectionArtifact["checks"]>,
): SiteInspectionArtifact {
  return {
    version: 2,
    id: "site-fixture",
    createdAt: "2026-08-23T00:00:00.000Z",
    target: {
      inputUrl: "https://example.com",
      finalUrl: "https://example.com/",
    },
    provider: { name: "playwright" },
    title: "Site Fixture",
    budget: {
      maxPages: 5,
      maxDepth: 1,
      maxLinksPerPage: 20,
      timeoutMsPerPage: 15_000,
    },
    discovery: { considered: 4, selected: ["/pricing", "/about"] },
    pages: [
      {
        slug: "home",
        path: "/",
        url: "https://example.com/",
        status: "inspected",
        artifactPath: "pages/home.json",
      },
      {
        slug: "pricing",
        path: "/pricing",
        url: "https://example.com/pricing",
        status: "inspected",
        artifactPath: "pages/pricing.json",
      },
      {
        slug: "about",
        path: "/about",
        url: "https://example.com/about",
        status: "failed",
        error: "Timeout",
      },
    ],
    checks: {
      linksChecked: 20,
      brokenInternalLinks: 1,
      brokenAnchors: 0,
      brokenImages: 1,
      consoleErrors: 2,
      pageErrors: 0,
      networkFailures: 0,
      badHttpResponses: 0,
      accessibilityViolations: 2,
      seriousAccessibilityViolations: 1,
      smallTouchTargets: 0,
      horizontalOverflowViewports: 0,
      ...checks,
    },
    findings,
  };
}

describe("inspectionToCandidate (site)", () => {
  it("lets a broken secondary page pull the score down below the mean", () => {
    // Home is clean; /pricing carries a console error, a broken image and a
    // broken internal link; /about failed to load.
    const findings = [
      siteFinding("console-error-1", "error", "/pricing"),
      siteFinding(
        "broken-image-1",
        "critical",
        "/pricing",
        "technical.accessibilitySeo",
      ),
      siteFinding(
        "broken-internal-link-1",
        "error",
        "/pricing",
        "responsive.navigation",
      ),
      siteFinding("page-load-failed-about", "error", "/about"),
    ];
    const candidate = inspectionToCandidate(siteArtifact(findings));

    // Mean of performance (home 96, pricing 88) would be 92; the worst-page
    // penalty (30% weight on the worst page) must pull it below that.
    expect(candidate.evaluations.technical.performance.score).toBeLessThan(92);
    expect(candidate.flags.missingRequiredAssets).toBe(true);
    // One failed page penalizes completeness: 60 + 6*2 - 10*1 = 62.
    expect(candidate.evaluations.packaging.pageCompleteness.score).toBe(62);
    expect(candidate.findings.every((finding) => finding.page)).toBe(true);
    expect(candidate.inspection).toEqual({
      discoveredPages: 4,
      inspectedPages: 2,
      failedPages: 1,
      worstPage: "/about",
    });
  });

  it("audits a multi-page artifact without relaunching a browser", () => {
    const candidate = inspectionToCandidate(
      siteArtifact([siteFinding("console-error-1", "error", "/pricing")], {
        brokenImages: 0,
        brokenInternalLinks: 0,
        accessibilityViolations: 0,
        seriousAccessibilityViolations: 0,
        consoleErrors: 1,
      }),
    );
    const result = auditCandidate(candidate, defaultStandard);

    expect(result.verdict).toBe("NEEDS_WORK");
    expect(result.findings.some((finding) => finding.page === "/pricing")).toBe(
      true,
    );
    expect(result.inspection?.inspectedPages).toBe(2);
  });
});
