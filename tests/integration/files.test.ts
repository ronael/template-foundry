import { describe, expect, it } from "vitest";
import {
  benchmarkReferenceSchema,
  candidateSchema,
  standardSchema,
} from "../../src/domain/schemas.js";
import { assertValidStandard } from "../../src/domain/validation.js";
import { readStructuredFile } from "../../src/infrastructure/yamlStore.js";

describe("fixture files", () => {
  it("loads and validates the standard", async () => {
    const standard = await readStructuredFile(
      "standards/golden-framer-v1.yml",
      standardSchema,
    );
    assertValidStandard(standard);
    expect(standard.id).toBe("golden-framer-v1");
  });

  it("loads candidate fixtures", async () => {
    const bad = await readStructuredFile(
      "fixtures/candidates/bad-template.yml",
      candidateSchema,
    );
    const acceptable = await readStructuredFile(
      "fixtures/candidates/acceptable-template.yml",
      candidateSchema,
    );
    const premium = await readStructuredFile(
      "fixtures/candidates/premium-template.yml",
      candidateSchema,
    );

    expect([bad.id, acceptable.id, premium.id]).toEqual([
      "bad-saas-template",
      "acceptable-saas-template",
      "premium-saas-template",
    ]);
  });

  it("loads benchmark reference notes", async () => {
    const benchmark = await readStructuredFile(
      "fixtures/benchmarks/framer-public-benchmark-notes.yml",
      benchmarkReferenceSchema,
    );

    expect(benchmark.licenseOrUsage).toContain("Analysis-only");
  });
});
