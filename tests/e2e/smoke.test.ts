import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const cli = join(process.cwd(), "dist/cli/index.js");
const standard = join(process.cwd(), "standards/golden-framer-v1.yml");
const execFileAsync = promisify(execFile);

describe("CLI smoke workflow", () => {
  it("initializes, validates, audits, and writes reports", async () => {
    const workspace = await mkdtemp(join(tmpdir(), "template-foundry-"));

    await execFileAsync("node", [cli, "init", workspace]);
    await execFileAsync("node", [
      cli,
      "standard",
      "validate",
      join(workspace, ".template-foundry/standards/golden-framer-v1.yml"),
    ]);

    const result = await execFileAsync("node", [
      cli,
      "audit",
      join(process.cwd(), "fixtures/candidates/acceptable-template.yml"),
      "--standard",
      standard,
      "--out",
      join(workspace, ".template-foundry/reports"),
    ]);

    expect(result.stdout.toString()).toContain("Verdict:");
    expect(result.stdout.toString()).toContain("NEEDS_WORK");

    const jsonReport = await readFile(
      join(
        workspace,
        ".template-foundry/reports/acceptable-saas-template-audit.json",
      ),
      "utf8",
    );
    expect(JSON.parse(jsonReport).candidate.id).toBe(
      "acceptable-saas-template",
    );
  });
});
