import type { Candidate, QualityAxis, QualityStandard } from "./schemas.js";

const EPSILON = 0.0001;

export class DomainValidationError extends Error {
  constructor(
    message: string,
    readonly issues: string[],
  ) {
    super(message);
    this.name = "DomainValidationError";
  }
}

export function assertValidStandard(standard: QualityStandard): void {
  const issues: string[] = [];
  assertUnique(
    "axis",
    standard.axes.map((axis) => axis.id),
    issues,
  );
  assertWeightSum("standard axes", standard.axes, issues);

  for (const axis of standard.axes) {
    assertUnique(
      `${axis.id} criteria`,
      axis.criteria.map((criterion) => criterion.id),
      issues,
    );
    assertWeightSum(`${axis.id} criteria`, axis.criteria, issues);
  }

  assertUnique(
    "gates",
    standard.gates.map((gate) => gate.id),
    issues,
  );

  const thresholds = standard.thresholds;
  if (
    !(
      thresholds.rejectedBelow < thresholds.needsWorkBelow &&
      thresholds.needsWorkBelow < thresholds.readyBelow &&
      thresholds.readyBelow <= thresholds.premiumAtLeast
    )
  ) {
    issues.push(
      "thresholds must be ordered: rejectedBelow < needsWorkBelow < readyBelow <= premiumAtLeast",
    );
  }

  for (const gate of standard.gates) {
    if (gate.condition.kind === "axisMinimum" && !gate.condition.axis) {
      issues.push(`gate ${gate.id} must declare condition.axis`);
    }
    if (
      gate.condition.kind === "criterionMinimum" &&
      (!gate.condition.axis || !gate.condition.criterion)
    ) {
      issues.push(
        `gate ${gate.id} must declare condition.axis and condition.criterion`,
      );
    }
    if (gate.condition.kind === "candidateFlag" && !gate.condition.path) {
      issues.push(`gate ${gate.id} must declare condition.path`);
    }
  }

  if (issues.length > 0) {
    throw new DomainValidationError("Invalid quality standard", issues);
  }
}

export function assertCandidateCoversStandard(
  candidate: Candidate,
  standard: QualityStandard,
): void {
  const issues: string[] = [];
  for (const axis of standard.axes) {
    const candidateAxis = candidate.evaluations[axis.id];
    if (!candidateAxis) {
      issues.push(`candidate missing evaluations.${axis.id}`);
      continue;
    }
    for (const criterion of axis.criteria) {
      if (!candidateAxis[criterion.id]) {
        issues.push(`candidate missing evaluations.${axis.id}.${criterion.id}`);
      }
    }
  }
  if (issues.length > 0) {
    throw new DomainValidationError(
      "Candidate does not cover the quality standard",
      issues,
    );
  }
}

function assertWeightSum(
  label: string,
  items: Array<Pick<QualityAxis, "weight">>,
  issues: string[],
): void {
  const sum = items.reduce((total, item) => total + item.weight, 0);
  if (Math.abs(sum - 1) > EPSILON) {
    issues.push(`${label} weights must sum to 1.0, got ${sum.toFixed(4)}`);
  }
}

function assertUnique(label: string, values: string[], issues: string[]): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      issues.push(`duplicate ${label} id: ${value}`);
    }
    seen.add(value);
  }
}
