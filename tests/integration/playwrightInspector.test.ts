import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { inspectUrl } from "../../src/infrastructure/playwrightInspector.js";
import {
  type FixtureServer,
  startFixtureServer,
} from "../helpers/fixtureServer.js";

describe("inspectUrl", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer(
      join(process.cwd(), "tests/fixtures/site"),
    );
  });

  afterAll(async () => {
    await server.close();
  });

  it("captures deterministic findings and screenshots for a rendered site", async () => {
    const outputDir = await mkdtemp(
      join(tmpdir(), "template-foundry-inspect-"),
    );
    const inspection = await inspectUrl(server.url, {
      outputDir,
      timeoutMs: 10_000,
      maxInternalLinks: 8,
    });

    expect(inspection.page.status).toBe(200);
    expect(inspection.page.title).toBe("Template Foundry Fixture");
    expect(inspection.viewports.map((viewport) => viewport.id)).toEqual([
      "desktop",
      "tablet",
      "mobile",
    ]);
    expect(inspection.checks.horizontalOverflowViewports).toBeGreaterThan(0);
    expect(inspection.checks.brokenImages).toBeGreaterThan(0);
    expect(inspection.checks.brokenInternalLinks).toBeGreaterThan(0);
    expect(inspection.checks.brokenAnchors).toBeGreaterThan(0);
    expect(inspection.checks.consoleErrors).toBeGreaterThan(0);
    expect(inspection.checks.pageErrors).toBeGreaterThan(0);
    expect(inspection.checks.accessibilityViolations).toBeGreaterThan(0);

    for (const viewport of inspection.viewports) {
      await expect(
        stat(join(outputDir, inspection.id, viewport.screenshotPath)),
      ).resolves.toMatchObject({
        size: expect.any(Number),
      });
    }
  }, 30_000);
});
