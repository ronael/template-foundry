#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { Command } from "commander";
import { ZodError } from "zod";
import {
  renderMarkdownReport,
  renderTerminalReport,
} from "../application/report.js";
import { initWorkspace } from "../application/workspace.js";
import { auditCandidate } from "../domain/audit.js";
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
  .command("audit")
  .description("Audit a candidate template against a Golden Standard.")
  .argument("<candidate>", "candidate YAML or JSON file")
  .requiredOption("-s, --standard <path>", "standard YAML or JSON file")
  .option("-o, --out <directory>", "directory for JSON and Markdown reports")
  .option("--json", "print full JSON audit result to stdout")
  .action(
    async (
      candidatePath: string,
      options: { standard: string; out?: string; json?: boolean },
    ) => {
      await run(async () => {
        const candidate = await readStructuredFile(
          resolve(candidatePath),
          candidateSchema,
        );
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
