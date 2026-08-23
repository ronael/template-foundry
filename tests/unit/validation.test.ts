import { describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import {
  assertValidStandard,
  DomainValidationError,
} from "../../src/domain/validation.js";

describe("assertValidStandard", () => {
  it("accepts the bundled default standard", () => {
    expect(() => assertValidStandard(defaultStandard)).not.toThrow();
  });

  it("rejects invalid axis weights", () => {
    const invalid = structuredClone(defaultStandard);
    const firstAxis = invalid.axes.at(0);
    if (!firstAxis) {
      throw new Error("Default standard must contain at least one axis");
    }
    firstAxis.weight = 0.2;

    expect(() => assertValidStandard(invalid)).toThrow(DomainValidationError);
  });
});
