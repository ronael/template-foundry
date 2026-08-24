import type { AuditResult } from "../domain/audit.js";

export function renderTerminalReport(result: AuditResult): string {
  const commonIssues = summarizeCommonIssues(result);
  const inspectionLines = result.inspection
    ? [
        `Pages inspected   ${result.inspection.inspectedPages}`,
        `Pages failed      ${result.inspection.failedPages}`,
        `Routes discovered ${result.inspection.discoveredPages}`,
        `Worst page        ${result.inspection.worstPage ?? "unknown"}`,
        `Critical findings ${result.findings.filter((finding) => finding.severity === "critical").length}`,
        "Common issues:",
        ...(commonIssues.length > 0
          ? commonIssues.map((issue) => `- ${issue}`)
          : ["- None repeated across pages."]),
        "",
      ]
    : [];
  const axisLines = result.axes
    .map(
      (axis) =>
        `${axis.name.padEnd(18)} ${axis.evaluated ? axis.score.toFixed(1) : "n/e"}`,
    )
    .join("\n");
  const gateLines = result.gates
    .map((gate) => `${gate.status.padEnd(13)} ${gate.id} - ${gate.message}`)
    .join("\n");
  const issueLines = result.findings
    .slice(0, 5)
    .map(
      (finding, index) =>
        `${index + 1}. [${finding.severity}]${finding.page ? ` ${finding.page}` : ""} ${finding.message}`,
    )
    .join("\n");

  return [
    `Template: ${result.candidate.name}`,
    `Standard: ${result.standard.id} v${result.standard.version}`,
    "",
    `Overall           ${result.overallScore.toFixed(1)}`,
    axisLines,
    "",
    ...inspectionLines,
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
  const commonIssues = summarizeCommonIssues(result);
  const inspectionSection = result.inspection
    ? `## Site Coverage

- Pages inspected: ${result.inspection.inspectedPages}
- Pages failed: ${result.inspection.failedPages}
- Routes discovered: ${result.inspection.discoveredPages}
- Worst page: ${result.inspection.worstPage ?? "unknown"}
- Critical findings: ${result.findings.filter((finding) => finding.severity === "critical").length}

Common issues:
${commonIssues.length > 0 ? commonIssues.map((issue) => `- ${issue}`).join("\n") : "- None repeated across pages."}

`
    : "";
  const axisRows = result.axes
    .map(
      (axis) =>
        `| ${axis.name} | ${axis.evaluated ? axis.score.toFixed(1) : "n/e"} | ${axis.evaluated ? axis.weightedScore.toFixed(1) : "n/e"} |`,
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
        `| ${finding.severity} | ${finding.page ?? "-"} | ${finding.criterion ?? "-"} | ${finding.message} | ${finding.suggestedFix ?? "-"} |`,
    )
    .join("\n");
  const recommendations = result.recommendations
    .map((item) => `- ${item}`)
    .join("\n");

  return `# Audit Report: ${result.candidate.name}

Standard: \`${result.standard.id}\` v${result.standard.version}

Verdict: **${result.verdict}**

Overall score: **${result.overallScore.toFixed(1)}**

${inspectionSection}## Axis Scores

| Axis | Score | Weighted |
| --- | ---: | ---: |
${axisRows}

## Quality Gates

| Status | Gate | Severity | Evidence |
| --- | --- | --- | --- |
${gateRows}

## Findings

| Severity | Page | Criterion | Message | Suggested fix |
| --- | --- | --- | --- | --- |
${findingRows || "| info | - | - | No findings. | - |"}

## Recommendations

${recommendations || "- No action required."}
`;
}

function summarizeCommonIssues(result: AuditResult): string[] {
  const pagesByIssue = new Map<string, Set<string>>();
  for (const finding of result.findings) {
    if (!finding.page) continue;
    const label = finding.message.replace(/\.$/, "");
    const pages = pagesByIssue.get(label) ?? new Set<string>();
    pages.add(finding.page);
    pagesByIssue.set(label, pages);
  }
  return [...pagesByIssue.entries()]
    .filter(([, pages]) => pages.size > 1)
    .sort(([labelA, pagesA], [labelB, pagesB]) =>
      pagesB.size === pagesA.size
        ? labelA.localeCompare(labelB)
        : pagesB.size - pagesA.size,
    )
    .slice(0, 3)
    .map(([label, pages]) => `${label} (${pages.size} pages)`);
}
