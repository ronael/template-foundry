import type {
  InspectionArtifact,
  SiteInspectionArtifact,
} from "../domain/inspection.js";
import type { Candidate } from "../domain/schemas.js";

/**
 * Objective criteria a rendered page can prove. Everything else stays
 * not-evaluated so the audit engine excludes it from scoring.
 */
type PageCriterionScores = {
  performance: number;
  accessibilitySeo: number;
  mobile: number;
  tablet: number;
  navigation: number;
  pageCompleteness: number;
};

export function inspectionToCandidate(
  inspection: InspectionArtifact | SiteInspectionArtifact,
): Candidate {
  return inspection.version === 2
    ? siteToCandidate(inspection)
    : pageToCandidate(inspection);
}

function pageToCandidate(inspection: InspectionArtifact): Candidate {
  const checks = inspection.checks;
  const scores = pageCriterionScores(inspection);

  return {
    id: inspection.id,
    name:
      inspection.page.title ||
      inspection.target.finalUrl ||
      inspection.target.inputUrl,
    type: "framer-template",
    metadata: {
      auditedAt: inspection.createdAt,
      notes:
        "Generated from rendered-site inspection. Criteria that a rendered URL cannot prove (visual, originality, buyer editability) are marked not-evaluated and excluded from scoring.",
    },
    pages: [inspection.target.finalUrl ?? inspection.target.inputUrl],
    breakpoints: inspection.viewports.map((viewport) => viewport.id),
    components: [],
    cms: { used: false, collections: [] },
    assets: {
      total: 0,
      missingRequired: checks.brokenImages,
    },
    flags: {
      criticalOverflow: checks.horizontalOverflowViewports > 0,
      missingRequiredAssets: checks.brokenImages > 0,
      marketplaceReady: false,
    },
    evaluations: buildEvaluations(scores),
    findings: inspection.findings,
  };
}

function siteToCandidate(site: SiteInspectionArtifact): Candidate {
  const failedPages = site.pages.filter((page) => page.status === "failed");
  const inspectedPages = site.pages.filter(
    (page) => page.status === "inspected",
  );

  // Aggregation strategy: 70% mean + 30% worst page, so a single broken
  // page (broken pricing, overflowing about) cannot hide behind a polished
  // homepage. Site completeness rewards real route coverage and penalizes
  // pages that failed to load.
  const aggregation = aggregateSiteScores(
    site,
    inspectedPages.length,
    failedPages.length,
  );
  const scores = aggregation.scores;
  const checks = site.checks;

  return {
    id: site.id,
    name: site.title || site.target.finalUrl || site.target.inputUrl,
    type: "framer-template",
    metadata: {
      auditedAt: site.createdAt,
      notes: `Generated from multi-page rendered inspection (${inspectedPages.length} pages inspected, ${failedPages.length} failed). Criteria that a rendered URL cannot prove are marked not-evaluated and excluded from scoring.`,
    },
    inspection: {
      discoveredPages: site.summary?.discovered ?? site.discovery.considered,
      inspectedPages: inspectedPages.length,
      failedPages: failedPages.length,
      ...(aggregation.worstPage ? { worstPage: aggregation.worstPage } : {}),
    },
    pages: site.pages.map((page) => page.url),
    breakpoints: ["desktop", "tablet", "mobile"],
    components: [],
    cms: { used: false, collections: [] },
    assets: {
      total: 0,
      missingRequired: checks.brokenImages,
    },
    flags: {
      criticalOverflow: checks.horizontalOverflowViewports > 0,
      missingRequiredAssets: checks.brokenImages > 0,
      marketplaceReady: false,
    },
    evaluations: buildEvaluations(scores),
    findings: site.findings,
  };
}

function pageCriterionScores(
  inspection: InspectionArtifact,
): PageCriterionScores {
  const checks = inspection.checks;
  return {
    performance: scoreFromProblems(96, [
      [checks.networkFailures, 12],
      [checks.badHttpResponses, 10],
      [checks.consoleErrors, 8],
      [checks.pageErrors, 14],
    ]),
    accessibilitySeo: scoreFromProblems(96, [
      [checks.seriousAccessibilityViolations, 14],
      [checks.accessibilityViolations, 4],
      [checks.brokenImages, 8],
      [checks.brokenInternalLinks, 10],
      [checks.brokenAnchors, 8],
    ]),
    mobile: scoreFromProblems(100, [
      [checks.horizontalOverflowViewports, 18],
      [checks.smallTouchTargets, 3],
    ]),
    tablet: inspection.viewports.some(
      (viewport) =>
        viewport.id === "tablet" &&
        viewport.scrollWidth > viewport.clientWidth + 2,
    )
      ? 70
      : 84,
    navigation: scoreFromProblems(88, [
      [checks.brokenInternalLinks, 12],
      [checks.brokenAnchors, 8],
    ]),
    pageCompleteness: inspection.page.title.trim().length > 0 ? 82 : 68,
  };
}

function aggregateSiteScores(
  site: SiteInspectionArtifact,
  inspectedCount: number,
  failedCount: number,
): { scores: PageCriterionScores; worstPage?: string } {
  // Reconstruct per-page scores from the merged findings so the worst page
  // is visible. Findings carry their origin page since inspection V2.
  const perPage = new Map<string, PageCriterionScores>();
  for (const page of site.pages) {
    if (page.status !== "inspected") continue;
    perPage.set(
      page.path,
      pageScoresFromFindings(
        site.findings.filter((finding) => finding.page === page.path),
      ),
    );
  }
  const failedPage = site.pages.find((page) => page.status === "failed");
  const worstInspectedPage = [...perPage.entries()].sort(
    ([pathA, scoresA], [pathB, scoresB]) =>
      pageQuality(scoresA) - pageQuality(scoresB) || pathA.localeCompare(pathB),
  )[0]?.[0];
  const worstPage = failedPage?.path ?? worstInspectedPage;
  const criteria: (keyof PageCriterionScores)[] = [
    "performance",
    "accessibilitySeo",
    "mobile",
    "tablet",
    "navigation",
    "pageCompleteness",
  ];
  const aggregated = {} as PageCriterionScores;
  for (const criterion of criteria) {
    const values = [...perPage.values()].map((scores) => scores[criterion]);
    if (values.length === 0) {
      aggregated[criterion] = criterion === "pageCompleteness" ? 60 : 50;
      continue;
    }
    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    const worst = Math.min(...values);
    aggregated[criterion] = Math.round(mean * 0.7 + worst * 0.3);
  }
  aggregated.pageCompleteness = clamp(
    60 + 6 * inspectedCount - 10 * failedCount,
    0,
    92,
  );
  return {
    scores: aggregated,
    ...(worstPage ? { worstPage } : {}),
  };
}

function pageScoresFromFindings(
  pageFindings: SiteInspectionArtifact["findings"],
): PageCriterionScores {
  return {
    performance: scoreFromProblems(96, [
      [countPrefix(pageFindings, "network-failure-"), 12],
      [countPrefix(pageFindings, "bad-response-"), 10],
      [countPrefix(pageFindings, "console-error-"), 8],
      [countPrefix(pageFindings, "page-error-"), 14],
    ]),
    accessibilitySeo: scoreFromProblems(96, [
      [
        pageFindings.filter(
          (finding) =>
            finding.id.startsWith("axe-") &&
            ["critical", "error"].includes(finding.severity),
        ).length,
        14,
      ],
      [
        pageFindings.filter((finding) => finding.id.startsWith("axe-")).length,
        4,
      ],
      [countPrefix(pageFindings, "broken-image-"), 8],
      [countPrefix(pageFindings, "broken-internal-link-"), 10],
      [countPrefix(pageFindings, "broken-anchor-"), 8],
    ]),
    mobile: scoreFromProblems(100, [
      [
        pageFindings.filter((finding) =>
          finding.id.startsWith("horizontal-overflow-"),
        ).length,
        18,
      ],
      [countPrefix(pageFindings, "small-touch-target-"), 3],
    ]),
    tablet: pageFindings.some(
      (finding) => finding.id === "horizontal-overflow-tablet",
    )
      ? 70
      : 84,
    navigation: scoreFromProblems(88, [
      [countPrefix(pageFindings, "broken-internal-link-"), 12],
      [countPrefix(pageFindings, "broken-anchor-"), 8],
    ]),
    pageCompleteness: 82,
  };
}

function pageQuality(scores: PageCriterionScores): number {
  const values = Object.values(scores);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildEvaluations(
  scores: PageCriterionScores,
): Candidate["evaluations"] {
  const notEvaluated = (notes: string) => ({
    score: 0,
    source: "not-evaluated" as const,
    notes,
  });
  return {
    visual: {
      hierarchy: notEvaluated("Not evaluated by rendered-site V1."),
      typography: notEvaluated("Not evaluated by rendered-site V1."),
      spacing: notEvaluated("Not evaluated by rendered-site V1."),
      polish: notEvaluated("Not evaluated by rendered-site V1."),
    },
    technical: {
      structure: notEvaluated(
        "Rendered page only; editable structure not inspected.",
      ),
      components: notEvaluated(
        "Component reuse requires editable-template access.",
      ),
      performance: { score: scores.performance, source: "automated" },
      accessibilitySeo: { score: scores.accessibilitySeo, source: "automated" },
    },
    responsive: {
      mobile: { score: scores.mobile, source: "automated" },
      tablet: { score: scores.tablet, source: "automated" },
      navigation: { score: scores.navigation, source: "automated" },
      contentFlow: notEvaluated("Content flow requires human or LLM review."),
    },
    customization: {
      brandSwap: notEvaluated("Requires buyer test in editor."),
      contentEditing: notEvaluated("Requires buyer test in editor."),
      cmsReadiness: notEvaluated("Rendered URL cannot prove CMS editability."),
      sectionFlexibility: notEvaluated("Requires buyer test in editor."),
    },
    originality: {
      differentiation: notEvaluated("Not evaluated by rendered-site V1."),
      similarityRisk: notEvaluated("Not evaluated by rendered-site V1."),
    },
    packaging: {
      pageCompleteness: {
        score: scores.pageCompleteness,
        source: "automated",
      },
      documentation: notEvaluated(
        "Documentation is not discoverable from rendered URL.",
      ),
      demoContent: notEvaluated(
        "Demo content quality needs human or LLM review.",
      ),
    },
  };
}

function countPrefix(findings: { id: string }[], prefix: string): number {
  return findings.filter((finding) => finding.id.startsWith(prefix)).length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scoreFromProblems(
  base: number,
  deductions: Array<[count: number, penalty: number]>,
): number {
  return Math.max(
    0,
    Math.round(
      deductions.reduce(
        (score, [count, penalty]) => score - count * penalty,
        base,
      ),
    ),
  );
}
