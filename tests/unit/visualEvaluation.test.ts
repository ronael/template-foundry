import { describe, expect, it } from "vitest";
import { inspectionToCandidate } from "../../src/application/inspectionToCandidate.js";
import type { InspectionArtifact } from "../../src/domain/inspection.js";
import {
  applyVisualEvaluation,
  visualEvaluationSchema,
} from "../../src/domain/visualEvaluation.js";

const scores = {
  hierarchy: 84,
  typography: 82,
  spacing: 80,
  composition: 81,
  color: 88,
  components: 79,
  responsive: 76,
  motion: 72,
  polish: 78,
  differentiation: 87,
  similarityRisk: 91,
};

function evaluation(overrides: Record<string, unknown> = {}) {
  return {
    version: 1,
    candidateId: "visual-fixture",
    createdAt: "2026-08-25T10:00:00.000Z",
    status: "evaluated",
    evaluator: {
      kind: "llm",
      provider: "test-provider",
      name: "visual-quality",
    },
    referenceSet: "premium-ai-saas-v1",
    screenshots: [{ page: "/", viewport: "desktop", path: "home.png" }],
    scores,
    findings: [
      {
        id: "visual-hero-density",
        criterion: "visual.hierarchy",
        severity: "warning",
        message: "Hero support copy competes with the primary action.",
        evidence: "Desktop screenshot home.png.",
        suggestedFix: "Shorten support copy and increase the action gap.",
        confidence: 0.9,
        page: "/",
        viewport: "desktop",
        source: "llm",
        provenance: {
          kind: "subjective",
          provider: "test-provider",
          check: "visual-quality",
        },
      },
    ],
    strengths: ["Distinct editorial direction."],
    sellability: {
      verdict: "NEEDS_POLISH",
      rationale: "Strong direction with one visible hierarchy issue.",
      blockers: ["Hero density"],
    },
    ...overrides,
  };
}

function candidate() {
  return inspectionToCandidate({
    version: 1,
    id: "visual-fixture",
    createdAt: "2026-08-25T10:00:00.000Z",
    target: {
      inputUrl: "https://example.test",
      finalUrl: "https://example.test",
    },
    page: { title: "Fixture", status: 200, navigationMs: 10 },
    viewports: [
      {
        id: "desktop",
        width: 1440,
        height: 900,
        screenshotPath: "home.png",
        scrollWidth: 1440,
        clientWidth: 1440,
      },
    ],
    checks: {
      consoleErrors: 0,
      pageErrors: 0,
      networkFailures: 0,
      badHttpResponses: 0,
      accessibilityViolations: 0,
      seriousAccessibilityViolations: 0,
      horizontalOverflowViewports: 0,
      smallTouchTargets: 0,
      brokenInternalLinks: 0,
      brokenAnchors: 0,
      brokenImages: 0,
    },
    links: [],
    findings: [],
  } as InspectionArtifact);
}

describe("visual evaluation", () => {
  it("requires screenshots and scores for an evaluated review", () => {
    expect(() =>
      visualEvaluationSchema.parse(
        evaluation({ screenshots: [], scores: undefined }),
      ),
    ).toThrow(/screenshot|criterion scores/i);
  });

  it("accepts an explicit not-evaluated result without screenshots", () => {
    const result = visualEvaluationSchema.parse(
      evaluation({
        status: "not-evaluated",
        screenshots: [],
        scores: undefined,
        sellability: undefined,
      }),
    );
    expect(result.status).toBe("not-evaluated");
  });

  it("projects subjective scores and findings without changing technical evidence", () => {
    const base = candidate();
    const result = applyVisualEvaluation(
      base,
      visualEvaluationSchema.parse(evaluation()),
    );
    expect(result.evaluations.visual.hierarchy).toMatchObject({
      score: 84,
      source: "llm",
    });
    expect(result.evaluations.visual.polish.score).toBe(79);
    expect(result.evaluations.originality.similarityRisk.score).toBe(91);
    expect(result.evaluations.technical).toEqual(base.evaluations.technical);
    expect(result.findings.at(-1)?.provenance?.kind).toBe("subjective");
  });

  it("rejects an evaluation for another candidate", () => {
    expect(() =>
      applyVisualEvaluation(
        candidate(),
        visualEvaluationSchema.parse(evaluation({ candidateId: "other" })),
      ),
    ).toThrow(/targets other/);
  });
});
