import { execFile } from "node:child_process";
import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type FixtureServer,
  startFixtureServer,
} from "../helpers/fixtureServer.js";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "dist/cli/index.js");
const standard = join(process.cwd(), "standards/golden-framer-v1.yml");

describe("browser inspection smoke workflow", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer(
      join(process.cwd(), "tests/fixtures/site"),
    );
  });

  afterAll(async () => {
    await server.close();
  });

  it("inspects a URL, writes screenshots, and audits the reusable artifact", async () => {
    const workspace = await mkdtemp(
      join(tmpdir(), "template-foundry-browser-"),
    );
    const inspectResult = await execFileAsync("node", [
      cli,
      "inspect",
      server.url,
      "--out",
      join(workspace, "inspections"),
    ]);
    expect(inspectResult.stdout).toContain("Findings:");

    const match = inspectResult.stdout.match(/Wrote: (.+inspection\.json)/);
    expect(match?.[1]).toBeTruthy();
    const inspectionPath = match?.[1] ?? "";
    const inspection = JSON.parse(await readFile(inspectionPath, "utf8"));
    expect(inspection.checks.brokenImages).toBeGreaterThan(0);
    await expect(
      stat(
        join(workspace, "inspections", inspection.id, "screenshots/mobile.png"),
      ),
    ).resolves.toBeTruthy();

    const audit = await execFileAsync("node", [
      cli,
      "audit",
      inspectionPath,
      "--standard",
      standard,
      "--out",
      join(workspace, "reports"),
    ]).catch((error: { stdout: string; code: number }) => error);

    expect(audit.stdout).toContain("Verdict:");
    expect(audit.stdout).toContain("REJECTED");
  }, 40_000);
});
