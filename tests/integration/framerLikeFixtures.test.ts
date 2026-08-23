import { describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import { auditCandidate } from "../../src/domain/audit.js";
import { candidateSchema } from "../../src/domain/schemas.js";
import { readStructuredFile } from "../../src/infrastructure/yamlStore.js";

async function auditFixture(path: string) {
  const candidate = await readStructuredFile(path, candidateSchema);
  return auditCandidate(candidate, defaultStandard);
}

describe("framer-like rendered-inspection fixtures", () => {
  it("rates a clean inspection as premium on the measured scope", async () => {
    const result = await auditFixture(
      "fixtures/candidates/framer-like-premium.yml",
    );

    expect(result.axes.find((axis) => axis.id === "visual")?.evaluated).toBe(
      false,
    );
    expect(
      result.gates.find((gate) => gate.id === "buyer-test-minimum")?.status,
    ).toBe("NOT_EVALUATED");
    expect(result.verdict).toBe("PREMIUM");
  });

  it("rejects an inspection with real technical defects", async () => {
    const result = await auditFixture(
      "fixtures/candidates/framer-like-problematic.yml",
    );

    expect(result.verdict).toBe("REJECTED");
    expect(
      result.findings.some((finding) => finding.severity === "critical"),
    ).toBe(true);
    expect(
      result.axes.find((axis) => axis.id === "technical")?.score,
    ).toBeLessThan(70);
  });
});
