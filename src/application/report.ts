import type { AuditResult } from "../domain/audit.js";

export function renderTerminalReport(result: AuditResult): string {
  const axisLines = result.axes
    .map((axis) => `${axis.name.padEnd(18)} ${axis.score.toFixed(1)}`)
    .join("\n");
  const gateLines = result.gates
    .map((gate) => `${gate.status.padEnd(13)} ${gate.id} - ${gate.message}`)
    .join("\n");
  const issueLines = result.findings
    .slice(0, 5)
    .map(
      (finding, index) =>
        `${index + 1}. [${finding.severity}] ${finding.message}`,
    )
    .join("\n");

  return [
    `Template: ${result.candidate.name}`,
    `Standard: ${result.standard.id} v${result.standard.version}`,
    "",
    `Overall           ${result.overallScore.toFixed(1)}`,
    axisLines,
    "",
    "Gates:",
    gateLines || "No gates declared.",
    "",
    "Verdict:",
    result.verdict,
    "",
    "Top issues:",
    issueLines || "No issues found.",
  ].join("\n");
}

export function renderMarkdownReport(result: AuditResult): string {
  const axisRows = result.axes
    .map(
      (axis) =>
        `| ${axis.name} | ${axis.score.toFixed(1)} | ${axis.weightedScore.toFixed(1)} |`,
    )
    .join("\n");
  const gateRows = result.gates
    .map(
      (gate) =>
        `| ${gate.status} | ${gate.id} | ${gate.severity} | ${gate.message} |`,
    )
    .join("\n");
  const findingRows = result.findings
    .map(
      (finding) =>
        `| ${finding.severity} | ${finding.criterion ?? "-"} | ${finding.message} | ${finding.suggestedFix ?? "-"} |`,
    )
    .join("\n");
  const recommendations = result.recommendations
    .map((item) => `- ${item}`)
    .join("\n");

  return `# Audit Report: ${result.candidate.name}

Standard: \`${result.standard.id}\` v${result.standard.version}

Verdict: **${result.verdict}**

Overall score: **${result.overallScore.toFixed(1)}**

## Axis Scores

| Axis | Score | Weighted |
| --- | ---: | ---: |
${axisRows}

## Quality Gates

| Status | Gate | Severity | Evidence |
| --- | --- | --- | --- |
${gateRows}

## Findings

| Severity | Criterion | Message | Suggested fix |
| --- | --- | --- | --- |
${findingRows || "| info | - | No findings. | - |"}

## Recommendations

${recommendations || "- No action required."}
`;
}
