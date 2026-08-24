import { execFile } from "node:child_process";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type PerformanceFixtureServer,
  startPerformanceFixtureServer,
} from "../helpers/performanceFixtureServer.js";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "dist/cli/index.js");
const standard = join(process.cwd(), "standards/golden-framer-v1.yml");

describe("performance evidence smoke workflow", () => {
  let server: PerformanceFixtureServer;

  beforeAll(async () => {
    server = await startPerformanceFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("flows from URL evidence to the existing audit report", async () => {
    const workspace = await mkdtemp(
      join(tmpdir(), "tfoundry-performance-e2e-"),
    );
    const inspected = await execFileAsync("node", [
      cli,
      "inspect",
      server.url,
      "--out",
      join(workspace, "inspections"),
      "--max-pages",
      "2",
    ]);
    const sitePath = inspected.stdout.match(/Wrote: (.+site\.json)/)?.[1];
    expect(sitePath).toBeTruthy();
    const site = JSON.parse(await readFile(sitePath ?? "", "utf8"));
    expect(site.performance.pages).toHaveLength(2);

    const audited = await execFileAsync("node", [
      cli,
      "audit",
      sitePath ?? "",
      "--standard",
      standard,
      "--out",
      join(workspace, "reports"),
    ]).catch((error: { stdout: string; code: number }) => error);

    expect(audited.stdout).toContain("Performance:");
    expect(audited.stdout).toContain("Pages measured    2");
    expect(audited.stdout).toContain("Transfer worst");
    expect(audited.stdout).toContain("Heavy assets");
  }, 120_000);
});
