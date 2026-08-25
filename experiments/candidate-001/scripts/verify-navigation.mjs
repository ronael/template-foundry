import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const baseUrl = "http://127.0.0.1:4401";
const outputDirectory = fileURLToPath(new URL("../evaluation/qa/navigation-audit-20260825/", import.meta.url));

await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const consoleErrors = [];
page.setDefaultTimeout(8_000);
page.on("console", (message) => {
  if (message.type() === "error") consoleErrors.push(message.text());
});

async function expectActive(label, value) {
  const currentItems = page.locator("nav [aria-current]");
  assert.equal(await currentItems.count(), 1, `Expected exactly one active navigation item for ${label}`);
  const item = currentItems.first();
  assert.equal((await item.textContent()).trim(), label);
  assert.equal(await item.getAttribute("aria-current"), value);
}

async function capture(name) {
  await page.screenshot({ path: `${outputDirectory}/${name}.png` });
}

try {
  await page.goto(`${baseUrl}/product`, { waitUntil: "networkidle" });
  await expectActive("Platform", "page");
  await capture("01-platform-active");

  await page.locator('.nav a[href="/product#docs"]').click({ noWaitAfter: true });
  await page.waitForURL("**/product#docs");
  await expectActive("Docs", "location");
  await capture("02-docs-active");

  await page.goBack();
  await page.waitForURL("**/product");
  await expectActive("Platform", "page");
  await page.goForward();
  await page.waitForURL("**/product#docs");
  await expectActive("Docs", "location");

  await page.goto(baseUrl, { waitUntil: "networkidle" });
  assert.equal(await page.locator("nav [aria-current]").count(), 0);
  await page.locator('.nav a[href="/#workflow"]').click({ noWaitAfter: true });
  await page.waitForURL("**/#workflow");
  await expectActive("Solutions", "location");
  await capture("03-solutions-active");

  await page.locator('.nav a[href="/#proof"]').click({ noWaitAfter: true });
  await page.waitForURL("**/#proof");
  await expectActive("Resources", "location");
  await capture("04-resources-active");

  await page.locator('.nav a[href="/pricing"]').click();
  await page.waitForURL("**/pricing");
  await expectActive("Pricing", "page");
  await capture("05-pricing-active");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/product`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(350);
  await expectActive("Platform", "page");
  await capture("06-mobile-platform-active");

  await page.locator('.nav a[href="/product#docs"]').click({ noWaitAfter: true });
  await page.waitForURL("**/product#docs");
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.waitForTimeout(350);
  await expectActive("Docs", "location");
  await capture("07-mobile-docs-active");

  assert.deepEqual(consoleErrors, []);
  console.log("Navigation QA passed: 7 captured states, history, desktop, and mobile.");
} finally {
  await browser.close();
}
