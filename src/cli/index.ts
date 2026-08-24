#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { ZodError } from "zod";
import { inspectionToCandidate } from "../application/inspectionToCandidate.js";
import {
  renderMarkdownReport,
  renderTerminalReport,
} from "../application/report.js";
import { initWorkspace } from "../application/workspace.js";
import { auditCandidate } from "../domain/audit.js";
import {
  defaultSiteBudget,
  defaultViewports,
  inspectionArtifactSchema,
  siteInspectionArtifactSchema,
} from "../domain/inspection.js";
import {
  benchmarkReferenceSchema,
  candidateSchema,
  standardSchema,
} from "../domain/schemas.js";
import {
  assertValidStandard,
  DomainValidationError,
} from "../domain/validation.js";
import {
  inspectSite,
  inspectUrl,
} from "../infrastructure/playwrightInspector.js";
import {
  readStructuredFile,
  writeJsonFile,
  writeTextFile,
} from "../infrastructure/yamlStore.js";

const program = new Command();

program
  .name("tfoundry")
  .description("Quality engine for digital template factory workflows.")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a local template-foundry workspace.")
  .argument("[directory]", "workspace directory", ".")
  .action(async (directory: string) => {
    await run(async () => {
      const created = await initWorkspace(resolve(directory));
      console.log(
        `Initialized template-foundry workspace:\n${created.map((path) => `- ${path}`).join("\n")}`,
      );
    });
  });

const standardCommand = program
  .command("standard")
  .description("Manage Golden Standards.");

standardCommand
  .command("validate")
  .description("Validate a Golden Standard YAML or JSON file.")
  .argument("<standard>", "path to standard file")
  .option("--json", "print machine-readable output")
  .action(async (standardPath: string, options: { json?: boolean }) => {
    await run(async () => {
      const standard = await readStructuredFile(
        resolve(standardPath),
        standardSchema,
      );
      assertValidStandard(standard);
      const payload = { ok: true, id: standard.id, version: standard.version };
      console.log(
        options.json
          ? JSON.stringify(payload, null, 2)
          : `Valid standard: ${standard.id} v${standard.version}`,
      );
    });
  });

const benchmarkCommand = program
  .command("benchmark")
  .description("Manage benchmark references.");

benchmarkCommand
  .command("validate")
  .description("Validate a benchmark reference file.")
  .argument("<benchmark>", "path to benchmark file")
  .action(async (benchmarkPath: string) => {
    await run(async () => {
      const benchmark = await readStructuredFile(
        resolve(benchmarkPath),
        benchmarkReferenceSchema,
      );
      console.log(`Valid benchmark: ${benchmark.name} (${benchmark.type})`);
    });
  });

program
  .command("inspect")
  .description(
    "Inspect a rendered template/site URL and write a reusable inspection artifact.",
  )
  .argument("<url>", "URL to inspect")
  .option(
    "-o, --out <directory>",
    "inspection output directory",
    ".template-foundry/inspections",
  )
  .option(
    "--timeout <ms>",
    "navigation and check timeout in milliseconds (legacy alias)",
    parseInteger,
  )
  .option(
    "--timeout-per-page <ms>",
    "navigation and check timeout per page in milliseconds",
    parseInteger,
  )
  .option(
    "--max-internal-links <count>",
    "maximum internal links to verify per page (legacy alias)",
    parseInteger,
  )
  .option(
    "--max-links-per-page <count>",
    "maximum internal links to verify per page",
    parseInteger,
  )
  .option(
    "--max-pages <count>",
    "maximum pages to inspect (1 = single-page artifact)",
    parseInteger,
  )
  .option(
    "--max-depth <depth>",
    "discovery depth (0 = root only, 1 = root links; maximum 1)",
    parseDepth,
  )
  .option("--json", "print full inspection JSON to stdout")
  .action(
    async (
      url: string,
      options: {
        out: string;
        timeout?: number;
        timeoutPerPage?: number;
        maxInternalLinks?: number;
        maxLinksPerPage?: number;
        maxPages?: number;
        maxDepth?: number;
        json?: boolean;
      },
    ) => {
      await run(async () => {
        const timeoutMs = options.timeoutPerPage ?? options.timeout;
        const maxLinksPerPage =
          options.maxLinksPerPage ??
          options.maxInternalLinks ??
          defaultSiteBudget.maxLinksPerPage;
        const inspectOptions = {
          outputDir: resolve(options.out),
          viewports: defaultViewports,
          ...(timeoutMs ? { timeoutMs } : {}),
          maxInternalLinks: maxLinksPerPage,
        };
        const maxPages = options.maxPages ?? defaultSiteBudget.maxPages;
        if (maxPages === 1) {
          const inspection = await inspectUrl(url, inspectOptions);
          const path = join(
            resolve(options.out),
            inspection.id,
            "inspection.json",
          );
          await writeJsonFile(path, inspection);
          if (options.json) {
            console.log(JSON.stringify(inspection, null, 2));
          } else {
            console.log(renderInspectionSummary(inspection, path));
          }
          return;
        }
        const site = await inspectSite(url, {
          ...inspectOptions,
          budget: {
            maxPages,
            maxDepth: options.maxDepth ?? defaultSiteBudget.maxDepth,
            maxLinksPerPage,
            timeoutMsPerPage: timeoutMs ?? defaultSiteBudget.timeoutMsPerPage,
          },
        });
        const path = join(resolve(options.out), site.id, "site.json");
        await writeJsonFile(path, site);
        if (options.json) {
          console.log(JSON.stringify(site, null, 2));
        } else {
          console.log(renderSiteSummary(site, path));
        }
      });
    },
  );

program
  .command("audit")
  .description(
    "Audit a candidate or inspection artifact against a Golden Standard.",
  )
  .argument("<input>", "candidate or inspection YAML/JSON file")
  .requiredOption("-s, --standard <path>", "standard YAML or JSON file")
  .option("-o, --out <directory>", "directory for JSON and Markdown reports")
  .option("--json", "print full JSON audit result to stdout")
  .action(
    async (
      inputPath: string,
      options: { standard: string; out?: string; json?: boolean },
    ) => {
      await run(async () => {
        const candidate = await readCandidateOrInspection(resolve(inputPath));
        const standard = await readStructuredFile(
          resolve(options.standard),
          standardSchema,
        );
        const result = auditCandidate(candidate, standard);

        if (options.out) {
          const outDir = resolve(options.out);
          const baseName = `${candidate.id}-audit`;
          await writeJsonFile(join(outDir, `${baseName}.json`), result);
          await writeTextFile(
            join(outDir, `${baseName}.md`),
            renderMarkdownReport(result),
          );
        }

        console.log(
          options.json
            ? JSON.stringify(result, null, 2)
            : renderTerminalReport(result),
        );
        if (result.verdict === "REJECTED") {
          process.exitCode = 2;
        }
      });
    },
  );

program
  .command("report")
  .description("Render a Markdown report from an audit JSON file.")
  .argument("<auditJson>", "audit JSON file")
  .option("-o, --out <path>", "output Markdown path")
  .action(async (auditJson: string, options: { out?: string }) => {
    await run(async () => {
      const raw = JSON.parse(
        await import("node:fs/promises").then((fs) =>
          fs.readFile(resolve(auditJson), "utf8"),
        ),
      );
      const markdown = renderMarkdownReport(raw);
      if (options.out) {
        await writeFile(resolve(options.out), markdown, "utf8");
        console.log(`Wrote ${resolve(options.out)}`);
      } else {
        console.log(markdown);
      }
    });
  });

await program.parseAsync(process.argv);

async function readCandidateOrInspection(path: string) {
  const raw = await readStructuredFile(path, candidateSchema).catch(() => null);
  if (raw) return raw;
  const site = await readStructuredFile(
    path,
    siteInspectionArtifactSchema,
  ).catch(() => null);
  if (site) return inspectionToCandidate(site);
  const inspection = await readStructuredFile(path, inspectionArtifactSchema);
  return inspectionToCandidate(inspection);
}

function renderSiteSummary(
  site: Awaited<ReturnType<typeof inspectSite>>,
  path: string,
): string {
  return [
    `Site inspection: ${site.id}`,
    `Target: ${site.target.inputUrl}`,
    `Final URL: ${site.target.finalUrl ?? "unknown"}`,
    `Budget: maxPages=${site.budget.maxPages} maxDepth=${site.budget.maxDepth} maxLinksPerPage=${site.budget.maxLinksPerPage} timeoutMsPerPage=${site.budget.timeoutMsPerPage}`,
    "",
    `Pages (${site.pages.length}):`,
    ...site.pages.map(
      (page) =>
        `- ${page.path} [${page.status}]${page.error ? ` ${page.error}` : ""}`,
    ),
    "",
    `Findings: ${site.findings.length}`,
    `Wrote: ${path}`,
  ].join("\n");
}

function renderInspectionSummary(
  inspection: Awaited<ReturnType<typeof inspectUrl>>,
  path: string,
): string {
  return [
    `Inspection: ${inspection.id}`,
    `Target: ${inspection.target.inputUrl}`,
    `Final URL: ${inspection.target.finalUrl ?? "unknown"}`,
    `Title: ${inspection.page.title || "(empty)"}`,
    `Status: ${inspection.page.status ?? "unknown"}`,
    `Navigation: ${inspection.page.navigationMs}ms`,
    "",
    "Viewports:",
    ...inspection.viewports.map(
      (viewport) =>
        `- ${viewport.id} ${viewport.width}x${viewport.height} screenshot=${viewport.screenshotPath}`,
    ),
    "",
    `Findings: ${inspection.findings.length}`,
    `Wrote: ${path}`,
  ].join("\n");
}

function parseInteger(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Expected a positive integer, got ${value}`);
  }
  return parsed;
}

function parseDepth(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1) {
    throw new Error(`Expected max depth 0 or 1, got ${value}`);
  }
  return parsed;
}

async function run(task: () => Promise<void>): Promise<void> {
  try {
    await task();
  } catch (error) {
    process.exitCode = 1;
    if (error instanceof ZodError) {
      console.error("Validation error:");
      for (const issue of error.issues) {
        console.error(
          `- ${issue.path.join(".") || "<root>"}: ${issue.message}`,
        );
      }
      return;
    }
    if (error instanceof DomainValidationError) {
      console.error(error.message);
      for (const issue of error.issues) {
        console.error(`- ${issue}`);
      }
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
  }
}
