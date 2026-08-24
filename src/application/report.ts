import type { AuditResult } from "../domain/audit.js";
import { formatBytes } from "../domain/performanceAudit.js";

export function renderTerminalReport(result: AuditResult): string {
  const commonIssues = summarizeCommonIssues(result);
  const performanceLines = result.performance
    ? renderTerminalPerformance(result.performance)
    : [];
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
    ...performanceLines,
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
  const performanceSection = result.performance
    ? renderMarkdownPerformance(result.performance)
    : "";
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
        `| ${finding.severity} | ${finding.page ?? "-"} | ${finding.viewport ?? "-"} | ${finding.criterion ?? "-"} | ${finding.message} | ${finding.suggestedFix ?? "-"} |`,
    )
    .join("\n");
  const recommendations = result.recommendations
    .map((item) => `- ${item}`)
    .join("\n");

  return `# Audit Report: ${result.candidate.name}

Standard: \`${result.standard.id}\` v${result.standard.version}

Verdict: **${result.verdict}**

Overall score: **${result.overallScore.toFixed(1)}**

${inspectionSection}${performanceSection}## Axis Scores

| Axis | Score | Weighted |
| --- | ---: | ---: |
${axisRows}

## Quality Gates

| Status | Gate | Severity | Evidence |
| --- | --- | --- | --- |
${gateRows}

## Findings

| Severity | Page | Viewport | Criterion | Message | Suggested fix |
| --- | --- | --- | --- | --- | --- |
${findingRows || "| info | - | - | - | No findings. | - |"}

## Recommendations

${recommendations || "- No action required."}
`;
}

function renderTerminalPerformance(
  performance: NonNullable<AuditResult["performance"]>,
): string[] {
  const mobileLcp =
    performance.lcp.find((item) => item.viewport === "mobile") ??
    performance.lcp[0];
  return [
    "Performance:",
    `Pages measured    ${performance.pagesMeasured}`,
    ...(performance.transfer
      ? [
          `Transfer avg      ${formatBytes(performance.transfer.averageBytes)}`,
          `Transfer worst    ${formatBytes(performance.transfer.worstBytes)} (${performance.transfer.worstPage})`,
        ]
      : ["Transfer           n/e"]),
    ...(mobileLcp
      ? [
          `LCP ${mobileLcp.viewport.padEnd(12)} ${(mobileLcp.averageMs / 1000).toFixed(2)} s avg; ${(mobileLcp.worstMs / 1000).toFixed(2)} s worst (${mobileLcp.worstPage})`,
        ]
      : ["LCP                n/e"]),
    `Heavy assets      ${performance.heavyImages} image(s), ${performance.heavyScripts} first-party script(s)`,
    ...performance.commonHeavyResources.map(
      (resource) =>
        `Common heavy      ${resource.category} ${formatBytes(resource.maxTransferBytes)} on ${resource.pages.length} pages (${shortResource(resource.url)})`,
    ),
    "",
  ];
}

function renderMarkdownPerformance(
  performance: NonNullable<AuditResult["performance"]>,
): string {
  const lcpRows = performance.lcp
    .map(
      (item) =>
        `| ${item.viewport} | ${(item.averageMs / 1000).toFixed(2)} s | ${(item.worstMs / 1000).toFixed(2)} s (${item.worstPage}) | ${item.measuredPages} | ${item.notEvaluatedPages} |`,
    )
    .join("\n");
  return `## Performance Evidence

- Pages measured: ${performance.pagesMeasured}
- Average transfer: ${performance.transfer ? formatBytes(performance.transfer.averageBytes) : "n/e"}
- Worst transfer: ${performance.transfer ? `${formatBytes(performance.transfer.worstBytes)} (${performance.transfer.worstPage})` : "n/e"}
- Heavy assets: ${performance.heavyImages} image(s), ${performance.heavyScripts} first-party script(s)
- Common heavy resources: ${performance.commonHeavyResources.length > 0 ? performance.commonHeavyResources.map((resource) => `${resource.category} ${formatBytes(resource.maxTransferBytes)} on ${resource.pages.length} pages (${shortResource(resource.url)})`).join("; ") : "none"}

| LCP viewport | Average | Worst | Measured pages | Not evaluated |
| --- | ---: | ---: | ---: | ---: |
${lcpRows || "| - | n/e | n/e | 0 | 0 |"}

`;
}

function shortResource(value: string): string {
  try {
    const url = new URL(value);
    return `${url.hostname}${url.pathname}`.slice(0, 100);
  } catch {
    return value.slice(0, 100);
  }
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
