import { describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import { auditCandidate } from "../../src/domain/audit.js";
import type { Candidate } from "../../src/domain/schemas.js";

const baseEvaluations: Candidate["evaluations"] = {
  visual: {
    hierarchy: { score: 90, source: "manual" },
    typography: { score: 90, source: "manual" },
    spacing: { score: 90, source: "manual" },
    polish: { score: 90, source: "manual" },
  },
  technical: {
    structure: { score: 90, source: "manual" },
    components: { score: 90, source: "manual" },
    performance: { score: 90, source: "manual" },
    accessibilitySeo: { score: 90, source: "manual" },
  },
  responsive: {
    mobile: { score: 90, source: "manual" },
    tablet: { score: 90, source: "manual" },
    navigation: { score: 90, source: "manual" },
    contentFlow: { score: 90, source: "manual" },
  },
  customization: {
    brandSwap: { score: 90, source: "manual" },
    contentEditing: { score: 90, source: "manual" },
    cmsReadiness: { score: 90, source: "manual" },
    sectionFlexibility: { score: 90, source: "manual" },
  },
  originality: {
    differentiation: { score: 90, source: "manual" },
    similarityRisk: { score: 90, source: "manual" },
  },
  packaging: {
    pageCompleteness: { score: 90, source: "manual" },
    documentation: { score: 90, source: "manual" },
    demoContent: { score: 90, source: "manual" },
  },
};

function candidate(overrides: Partial<Candidate> = {}): Candidate {
  return {
    id: "candidate",
    name: "Candidate",
    type: "framer-template",
    metadata: {},
    pages: ["Home", "404"],
    breakpoints: ["desktop", "tablet", "mobile"],
    components: [],
    cms: { used: false, collections: [] },
    assets: { total: 1, missingRequired: 0 },
    flags: {
      criticalOverflow: false,
      missingRequiredAssets: false,
      marketplaceReady: true,
    },
    evaluations: baseEvaluations,
    findings: [],
    ...overrides,
  };
}

describe("auditCandidate", () => {
  it("calculates weighted score and READY verdict", () => {
    const result = auditCandidate(candidate(), defaultStandard);

    expect(result.overallScore).toBe(90);
    expect(result.verdict).toBe("READY");
  });

  it("does not let a strong average hide failed mobile quality", () => {
    const weakMobile = candidate({
      evaluations: {
        ...baseEvaluations,
        responsive: {
          ...baseEvaluations.responsive,
          mobile: { score: 65, source: "automated" },
        },
      },
    });

    const result = auditCandidate(weakMobile, defaultStandard);

    expect(result.overallScore).toBeGreaterThan(80);
    expect(
      result.gates.find((gate) => gate.id === "mobile-quality-minimum")?.status,
    ).toBe("FAIL");
    expect(result.verdict).toBe("NEEDS_WORK");
  });

  it("rejects critical findings", () => {
    const result = auditCandidate(
      candidate({
        findings: [
          {
            id: "missing-assets",
            severity: "critical",
            message: "Required assets are missing.",
          },
        ],
      }),
      defaultStandard,
    );

    expect(result.verdict).toBe("REJECTED");
  });
});
