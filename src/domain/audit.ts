import type {
  AuditFinding,
  Candidate,
  QualityGate,
  QualityStandard,
  Verdict,
} from "./schemas.js";
import {
  assertCandidateCoversStandard,
  assertValidStandard,
} from "./validation.js";

export type GateResult = {
  id: string;
  name: string;
  status: "PASS" | "FAIL" | "MANUAL" | "NOT_EVALUATED";
  severity: QualityGate["severity"];
  message: string;
};

export type CriterionScore = {
  id: string;
  name: string;
  score: number;
  weightedScore: number;
  source: string;
  evaluated: boolean;
};

export type AxisScore = {
  id: string;
  name: string;
  score: number;
  weightedScore: number;
  evaluated: boolean;
  criteria: CriterionScore[];
};

export type AuditResult = {
  candidate: {
    id: string;
    name: string;
  };
  standard: {
    id: string;
    version: number;
    name: string;
  };
  overallScore: number;
  axes: AxisScore[];
  gates: GateResult[];
  findings: AuditFinding[];
  verdict: Verdict;
  recommendations: string[];
  inspection?: Candidate["inspection"];
};

export function auditCandidate(
  candidate: Candidate,
  standard: QualityStandard,
): AuditResult {
  assertValidStandard(standard);
  assertCandidateCoversStandard(candidate, standard);

  const axes = standard.axes.map((axis) => {
    const criteria = axis.criteria.map((criterion) => {
      const evaluation = candidate.evaluations[axis.id]?.[criterion.id];
      if (!evaluation) {
        throw new Error(`Missing evaluation ${axis.id}.${criterion.id}`);
      }
      const evaluated = evaluation.source !== "not-evaluated";
      return {
        id: criterion.id,
        name: criterion.name,
        score: round(evaluation.score),
        weightedScore: round(evaluation.score * criterion.weight),
        source: evaluation.source,
        evaluated,
      };
    });
    const evaluatedCriteria = criteria.filter(
      (criterion) => criterion.evaluated,
    );
    const evaluatedWeight = axis.criteria
      .filter((criterion) =>
        evaluatedCriteria.some((score) => score.id === criterion.id),
      )
      .reduce((total, criterion) => total + criterion.weight, 0);
    const score =
      evaluatedWeight > 0
        ? evaluatedCriteria.reduce(
            (total, criterion) => total + criterion.weightedScore,
            0,
          ) / evaluatedWeight
        : 0;
    return {
      id: axis.id,
      name: axis.name,
      score: round(score),
      weightedScore: round(score * axis.weight),
      evaluated: evaluatedCriteria.length > 0,
      criteria,
    };
  });

  const evaluatedAxisWeight = standard.axes
    .filter((axis) => axes.find((score) => score.id === axis.id)?.evaluated)
    .reduce((total, axis) => total + axis.weight, 0);
  const overallScore = round(
    evaluatedAxisWeight > 0
      ? axes.reduce((total, axis) => total + axis.weightedScore, 0) /
          evaluatedAxisWeight
      : 0,
  );
  const gates = standard.gates.map((gate) =>
    evaluateGate(gate, candidate, axes),
  );
  const findings = deriveFindings(candidate, standard, axes, gates);
  const verdict = decideVerdict(overallScore, standard, axes, gates, findings);
  const recommendations = buildRecommendations(findings, gates);

  return {
    candidate: { id: candidate.id, name: candidate.name },
    standard: {
      id: standard.id,
      version: standard.version,
      name: standard.name,
    },
    overallScore,
    axes,
    gates,
    findings,
    verdict,
    recommendations,
    ...(candidate.inspection ? { inspection: candidate.inspection } : {}),
  };
}

function evaluateGate(
  gate: QualityGate,
  candidate: Candidate,
  axes: AxisScore[],
): GateResult {
  if (gate.status === "manual") {
    return {
      id: gate.id,
      name: gate.name,
      status: "MANUAL",
      severity: gate.severity,
      message: "Manual gate is declared but not evaluated by the V0 engine.",
    };
  }
  if (gate.status === "not_evaluated") {
    return {
      id: gate.id,
      name: gate.name,
      status: "NOT_EVALUATED",
      severity: gate.severity,
      message: "Gate is intentionally tracked but not evaluated in V0.",
    };
  }

  const condition = gate.condition;
  if (condition.kind === "candidateFlag") {
    const actual = candidate.flags[condition.path ?? ""];
    const expected = condition.expected ?? true;
    const passed = actual === expected;
    return gateResult(
      gate,
      passed,
      `${condition.path} expected ${expected}, got ${String(actual)}`,
    );
  }
  if (condition.kind === "axisMinimum") {
    const axis = axes.find((item) => item.id === condition.axis);
    const minimum = condition.minimum ?? 0;
    if (axis && !axis.evaluated) {
      return {
        id: gate.id,
        name: gate.name,
        status: "NOT_EVALUATED",
        severity: gate.severity,
        message: `${condition.axis} has no evaluated criteria; gate skipped.`,
      };
    }
    return gateResult(
      gate,
      Boolean(axis && axis.score >= minimum),
      `${condition.axis} minimum ${minimum}, got ${axis?.score ?? "missing"}`,
    );
  }
  const axis = axes.find((item) => item.id === condition.axis);
  const criterion = axis?.criteria.find(
    (item) => item.id === condition.criterion,
  );
  const minimum = condition.minimum ?? 0;
  if (criterion && !criterion.evaluated) {
    return {
      id: gate.id,
      name: gate.name,
      status: "NOT_EVALUATED",
      severity: gate.severity,
      message: `${condition.axis}.${condition.criterion} is not evaluated; gate skipped.`,
    };
  }
  return gateResult(
    gate,
    Boolean(criterion && criterion.score >= minimum),
    `${condition.axis}.${condition.criterion} minimum ${minimum}, got ${criterion?.score ?? "missing"}`,
  );
}

function gateResult(
  gate: QualityGate,
  passed: boolean,
  message: string,
): GateResult {
  return {
    id: gate.id,
    name: gate.name,
    status: passed ? "PASS" : "FAIL",
    severity: gate.severity,
    message,
  };
}

function deriveFindings(
  candidate: Candidate,
  standard: QualityStandard,
  axes: AxisScore[],
  gates: GateResult[],
): AuditFinding[] {
  const findings: AuditFinding[] = [...candidate.findings];

  for (const axis of standard.axes) {
    const axisScore = axes.find((item) => item.id === axis.id);
    if (
      axis.minimum !== undefined &&
      axisScore?.evaluated &&
      axisScore.score < axis.minimum
    ) {
      findings.push({
        id: `${axis.id}-below-minimum`,
        criterion: axis.id,
        severity: "error",
        message: `${axis.name} score ${axisScore.score} is below required minimum ${axis.minimum}.`,
        suggestedFix: `Improve the lowest scoring ${axis.name.toLowerCase()} criteria before averaging can produce a READY verdict.`,
        source: "rule",
      });
    }
    for (const criterion of axis.criteria) {
      const criterionScore = axisScore?.criteria.find(
        (item) => item.id === criterion.id,
      );
      if (
        criterion.minimum !== undefined &&
        criterionScore?.evaluated &&
        criterionScore.score < criterion.minimum
      ) {
        findings.push({
          id: `${axis.id}-${criterion.id}-below-minimum`,
          criterion: `${axis.id}.${criterion.id}`,
          severity: criterionScore.score < 60 ? "critical" : "error",
          message: `${criterion.name} scored ${criterionScore.score}, below minimum ${criterion.minimum}.`,
          suggestedFix: criterion.description,
          source: "rule",
        });
      }
    }
  }

  for (const gate of gates.filter((item) => item.status === "FAIL")) {
    findings.push({
      id: `gate-${gate.id}`,
      severity: gate.severity,
      message: `Quality gate failed: ${gate.name}.`,
      evidence: gate.message,
      suggestedFix:
        "Resolve the blocking gate before treating the template as sellable.",
      source: "gate",
    });
  }

  return findings.sort(
    (a, b) => severityRank(b.severity) - severityRank(a.severity),
  );
}

function decideVerdict(
  overallScore: number,
  standard: QualityStandard,
  axes: AxisScore[],
  gates: GateResult[],
  findings: AuditFinding[],
): Verdict {
  if (findings.some((finding) => finding.severity === "critical")) {
    return "REJECTED";
  }
  // Known error-severity defects (console errors, serious accessibility
  // violations, broken links) must be fixed before a template is sellable.
  if (findings.some((finding) => finding.severity === "error")) {
    return "NEEDS_WORK";
  }
  if (
    gates.some(
      (gate) =>
        gate.status === "FAIL" && ["critical", "error"].includes(gate.severity),
    )
  ) {
    return "NEEDS_WORK";
  }
  if (axes.some((axis) => axis.evaluated && axis.score < 70)) {
    return "NEEDS_WORK";
  }
  const thresholds = standard.thresholds;
  if (overallScore < thresholds.rejectedBelow) return "REJECTED";
  if (overallScore < thresholds.needsWorkBelow) return "NEEDS_WORK";
  if (overallScore < thresholds.readyBelow) return "READY";
  if (overallScore >= thresholds.premiumAtLeast) return "PREMIUM";
  return "READY";
}

function buildRecommendations(
  findings: AuditFinding[],
  gates: GateResult[],
): string[] {
  const fromFindings = findings
    .filter((finding) => finding.severity !== "info")
    .slice(0, 5)
    .map((finding) => finding.suggestedFix ?? finding.message);
  const manualGates = gates
    .filter((gate) => gate.status === "MANUAL")
    .map((gate) => `Manually evaluate gate: ${gate.name}.`);
  return [...fromFindings, ...manualGates].slice(0, 6);
}

function severityRank(severity: AuditFinding["severity"]): number {
  return { info: 0, warning: 1, error: 2, critical: 3 }[severity];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
