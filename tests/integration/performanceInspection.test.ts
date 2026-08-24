import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import { inspectionToCandidate } from "../../src/application/inspectionToCandidate.js";
import { auditCandidate } from "../../src/domain/audit.js";
import { inspectSite } from "../../src/infrastructure/playwrightInspector.js";
import {
  type PerformanceFixtureServer,
  startPerformanceFixtureServer,
} from "../helpers/performanceFixtureServer.js";

describe("performance inspection", () => {
  let server: PerformanceFixtureServer;

  beforeAll(async () => {
    server = await startPerformanceFixtureServer();
  });

  afterAll(async () => {
    await server.close();
  });

  it("collects page evidence and evaluates it through the standard", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "tfoundry-performance-"));
    const site = await inspectSite(server.url, {
      outputDir,
      budget: { maxPages: 2, timeoutMsPerPage: 15_000 },
    });

    expect(site.performance?.pages).toHaveLength(2);
    const home = site.performance?.pages.find((page) => page.path === "/");
    expect(home?.evidence.resourceViewport).toBe("desktop");
    expect(home?.evidence.transfer.status).toBe("measured");
    expect(home?.evidence.transfer.totalRequests).toBeGreaterThanOrEqual(4);
    expect(home?.evidence.transfer.transferBytes).toBeGreaterThan(1_500_000);
    expect(home?.evidence.images.transferBytes).toBeGreaterThan(1_000_000);
    expect(home?.evidence.javascript.transferBytes).toBeGreaterThan(500_000);
    expect(home?.evidence.fonts.count).toBe(0);
    expect(home?.evidence.dom.nodes).toBeGreaterThan(1_500);
    expect(
      home?.evidence.breakdown.find((item) => item.category === "image")
        ?.largestResource,
    ).toMatchObject({ url: expect.stringContaining("heavy.svg") });
    expect(
      home?.evidence.lcp.find((item) => item.viewport === "desktop")?.status,
    ).toBe("measured");
    expect(
      home?.evidence.lcp.find((item) => item.viewport === "mobile")?.status,
    ).toBe("measured");

    const homeArtifactPath = join(outputDir, site.id, "pages/home.json");
    const homeArtifact = JSON.parse(await readFile(homeArtifactPath, "utf8"));
    expect(homeArtifact.performance.provenance).toMatchObject({
      provider: "playwright-cdp",
      cacheDisabled: true,
      serviceWorkerBypassed: true,
    });

    const result = auditCandidate(inspectionToCandidate(site), defaultStandard);
    expect(result.performance?.pagesMeasured).toBe(2);
    expect(result.performance?.heavyImages).toBe(2);
    expect(result.performance?.heavyScripts).toBe(2);
    expect(
      result.performance?.commonHeavyResources
        .map((resource) => resource.category)
        .sort(),
    ).toEqual(["image", "script"]);
    expect(
      result.axes
        .find((axis) => axis.id === "technical")
        ?.criteria.find((criterion) => criterion.id === "performance")?.score,
    ).toBeLessThan(100);
    expect(
      result.findings.some(
        (finding) =>
          finding.page === "/" &&
          finding.provenance?.check === "oversized-image",
      ),
    ).toBe(true);
  }, 90_000);
});
