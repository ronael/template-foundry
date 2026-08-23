import { mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defaultStandard } from "../../src/application/defaults.js";
import { inspectionToCandidate } from "../../src/application/inspectionToCandidate.js";
import { auditCandidate } from "../../src/domain/audit.js";
import { inspectSite } from "../../src/infrastructure/playwrightInspector.js";
import {
  type FixtureServer,
  startFixtureServer,
} from "../helpers/fixtureServer.js";

describe("inspectSite", () => {
  let server: FixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer(
      join(process.cwd(), "tests/fixtures/multisite"),
    );
  });

  afterAll(async () => {
    await server.close();
  });

  it("inspects discovered pages and attaches findings to each page", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "template-foundry-site-"));
    const site = await inspectSite(server.url, {
      outputDir,
      budget: { maxPages: 5, timeoutMsPerPage: 10_000 },
    });

    expect(site.version).toBe(2);
    expect(site.pages.map((page) => page.path).sort()).toEqual([
      "/",
      "/about.html",
      "/contact.html",
      "/pricing.html",
    ]);
    expect(site.pages.every((page) => page.status === "inspected")).toBe(true);

    // Per-page artifacts exist and stay auditable on their own.
    for (const page of site.pages) {
      await expect(
        stat(join(outputDir, site.id, page.artifactPath ?? "")),
      ).resolves.toMatchObject({ size: expect.any(Number) });
    }
    const pricingArtifact = JSON.parse(
      await readFile(
        join(
          outputDir,
          site.id,
          site.pages.find((page) => page.path === "/pricing.html")
            ?.artifactPath ?? "",
        ),
        "utf8",
      ),
    );
    const pricingMobile = pricingArtifact.viewports.find(
      (viewport: { id: string }) => viewport.id === "mobile",
    );
    await expect(
      stat(join(outputDir, site.id, "pages", pricingMobile.screenshotPath)),
    ).resolves.toBeTruthy();

    // Defects land on the page that caused them.
    const pricingFindings = site.findings.filter(
      (finding) => finding.page === "/pricing.html",
    );
    expect(
      pricingFindings.some((finding) => finding.id.startsWith("broken-image")),
    ).toBe(true);
    expect(
      pricingFindings.some((finding) => finding.id.startsWith("console-error")),
    ).toBe(true);
    const aboutFindings = site.findings.filter(
      (finding) => finding.page === "/about.html",
    );
    expect(
      aboutFindings.some((finding) =>
        finding.id.startsWith("horizontal-overflow"),
      ),
    ).toBe(true);

    // Aggregated checks cover the whole site.
    expect(site.checks.brokenImages).toBeGreaterThan(0);
    expect(site.checks.linksChecked).toBeGreaterThan(0);

    // The same artifact feeds the unchanged audit engine.
    const candidate = inspectionToCandidate(site);
    const result = auditCandidate(candidate, defaultStandard);
    // Broken image = critical finding -> REJECTED regardless of the average.
    expect(result.verdict).toBe("REJECTED");
  }, 60_000);

  it("respects the page budget", async () => {
    const outputDir = await mkdtemp(join(tmpdir(), "template-foundry-budget-"));
    const site = await inspectSite(server.url, {
      outputDir,
      budget: { maxPages: 2, timeoutMsPerPage: 10_000 },
    });

    expect(site.pages).toHaveLength(2);
    expect(site.pages[0]?.path).toBe("/");
  }, 60_000);
});
