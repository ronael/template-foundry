import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
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

describe("multi-page inspection smoke workflow", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer(
      join(process.cwd(), "tests/fixtures/multisite"),
    );
  });

  afterAll(async () => {
    await server.close();
  });

  it("inspects a whole template site and audits the aggregated artifact", async () => {
    const workspace = await mkdtemp(
      join(tmpdir(), "template-foundry-multipage-"),
    );
    const inspectResult = await execFileAsync("node", [
      cli,
      "inspect",
      server.url,
      "--out",
      join(workspace, "inspections"),
    ]);
    expect(inspectResult.stdout).toContain("Site inspection:");
    expect(inspectResult.stdout).toContain("/pricing.html");

    const match = inspectResult.stdout.match(/Wrote: (.+site\.json)/);
    expect(match?.[1]).toBeTruthy();
    const sitePath = match?.[1] ?? "";
    const site = JSON.parse(await readFile(sitePath, "utf8"));
    expect(site.version).toBe(2);
    expect(site.pages.length).toBeGreaterThanOrEqual(4);

    const audit = await execFileAsync("node", [
      cli,
      "audit",
      sitePath,
      "--standard",
      standard,
      "--out",
      join(workspace, "reports"),
    ]).catch((error: { stdout: string; code: number }) => error);

    expect(audit.stdout).toContain("Verdict:");
    // The pricing page carries a broken image (critical finding).
    expect(audit.stdout).toContain("REJECTED");
  }, 90_000);
});
