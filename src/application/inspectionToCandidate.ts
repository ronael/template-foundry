import type { InspectionArtifact } from "../domain/inspection.js";
import type { Candidate } from "../domain/schemas.js";

export function inspectionToCandidate(
  inspection: InspectionArtifact,
): Candidate {
  const checks = inspection.checks;
  const responsiveMobile = scoreFromProblems(100, [
    [checks.horizontalOverflowViewports, 18],
    [checks.smallTouchTargets, 3],
  ]);
  const technicalReliability = scoreFromProblems(96, [
    [checks.networkFailures, 12],
    [checks.badHttpResponses, 10],
    [checks.consoleErrors, 8],
    [checks.pageErrors, 14],
  ]);
  const accessibilitySeo = scoreFromProblems(96, [
    [checks.seriousAccessibilityViolations, 14],
    [checks.accessibilityViolations, 4],
    [checks.brokenImages, 8],
    [checks.brokenInternalLinks, 10],
    [checks.brokenAnchors, 8],
  ]);
  const packagingCompleteness =
    inspection.page.title.trim().length > 0 ? 82 : 68;

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
        "Generated from rendered-site inspection. Visual, originality, and buyer-editability scores are conservative placeholders until dedicated evaluators exist.",
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
    evaluations: {
      visual: {
        hierarchy: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
        typography: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
        spacing: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
        polish: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
      },
      technical: {
        structure: {
          score: 78,
          source: "automated",
          notes: "Rendered page only; editable structure not inspected.",
        },
        components: {
          score: 75,
          source: "imported",
          notes: "Component reuse requires editable-template access.",
        },
        performance: { score: technicalReliability, source: "automated" },
        accessibilitySeo: { score: accessibilitySeo, source: "automated" },
      },
      responsive: {
        mobile: { score: responsiveMobile, source: "automated" },
        tablet: {
          score: inspection.viewports.some(
            (viewport) =>
              viewport.id === "tablet" &&
              viewport.scrollWidth > viewport.clientWidth + 2,
          )
            ? 70
            : 84,
          source: "automated",
        },
        navigation: {
          score: scoreFromProblems(88, [
            [checks.brokenInternalLinks, 12],
            [checks.brokenAnchors, 8],
          ]),
          source: "automated",
        },
        contentFlow: {
          score: responsiveMobile < 75 ? 72 : 82,
          source: "inferred",
        },
      },
      customization: {
        brandSwap: {
          score: 72,
          source: "imported",
          notes: "Requires buyer test in editor.",
        },
        contentEditing: {
          score: 72,
          source: "imported",
          notes: "Requires buyer test in editor.",
        },
        cmsReadiness: {
          score: 70,
          source: "imported",
          notes: "Rendered URL cannot prove CMS editability.",
        },
        sectionFlexibility: {
          score: 72,
          source: "imported",
          notes: "Requires buyer test in editor.",
        },
      },
      originality: {
        differentiation: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
        similarityRisk: {
          score: 75,
          source: "imported",
          notes: "Not evaluated by rendered-site V1.",
        },
      },
      packaging: {
        pageCompleteness: { score: packagingCompleteness, source: "automated" },
        documentation: {
          score: 70,
          source: "imported",
          notes: "Documentation is not discoverable from rendered URL.",
        },
        demoContent: {
          score: 75,
          source: "imported",
          notes: "Demo content quality needs human or LLM review.",
        },
      },
    },
    findings: inspection.findings,
  };
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
