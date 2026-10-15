import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// Isolated static research component: no clinical fixtures, API mocks or patient writes.
// Run Vite locally first. Playwright is an optional verification dependency.
const root = fileURLToPath(new URL("../", import.meta.url));
const site = new URL(process.env.GOVCARE_INFOGRAPHIC_SITE ?? "http://127.0.0.1:5300");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(site.hostname), "Use a local development installation.");
assert.ok(["http:", "https:"].includes(site.protocol) && !site.username && !site.password);
const modulePath = process.env.GOVCARE_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.GOVCARE_PLAYWRIGHT_MODULE)).href : "playwright";
const { chromium } = await import(modulePath);
const fixtureName = `.govcare-infographic-${process.pid}.html`;
const fixture = resolve(root, fixtureName);
const output = resolve(process.env.GOVCARE_INFOGRAPHIC_OUTPUT ?? "verification/renal-infographic-browser-v45.json");
const errors = [];
const report = { scope: "Isolated real research component; no authenticated clinical workflow or clinical validation", checks: [], layouts: [], assetResponses: [], requestFailures: [] };
let browser;

try {
  await fs.writeFile(fixture, `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research infographic verification</title><style>*{box-sizing:border-box}body{margin:16px;font-family:Arial,sans-serif;background:#edf3f8}main{width:100%;max-width:1320px;margin:auto}</style></head><body><main id="root"></main><script type="module">import {createElement} from "react";import {createRoot} from "react-dom/client";import {RenalResearchInfographic} from "/src/components/ai/RenalResearchInfographic.tsx";createRoot(document.getElementById("root")).render(createElement(RenalResearchInfographic));</script></body></html>`, { flag: "wx" });
  browser = await chromium.launch({
    ...(process.env.GOVCARE_CHROMIUM_EXECUTABLE ? { executablePath: process.env.GOVCARE_CHROMIUM_EXECUTABLE } : {}),
    args: process.env.GOVCARE_CHROMIUM_ARGS ? JSON.parse(process.env.GOVCARE_CHROMIUM_ARGS) : ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  const context = await browser.newContext({ acceptDownloads: true, reducedMotion: "reduce" });
  const page = await context.newPage();
  let clinicalRequests = 0;
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/")) clinicalRequests++; });
  page.on("response", response => {
    const path = new URL(response.url()).pathname;
    if (path.startsWith("/research/")) report.assetResponses.push({ path, status: response.status() });
  });
  page.on("requestfailed", request => report.requestFailures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  const pageUrl = new URL(`/${fixtureName}`, site).href;
  const record = check => report.checks.push({ check, status: "passed" });

  for (const width of [1366, 768, 375]) {
    await page.setViewportSize({ width, height: 1100 });
    await page.goto(pageUrl);
    // Vite may reload a cold page after dependency optimization finishes.
    await page.waitForLoadState("networkidle");
    if (!(await page.locator(".renal-research-figure").evaluate(el => el.open))) await page.locator(".renal-research-figure summary").click();
    const image = page.locator(".renal-research img");
    await image.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const image = document.querySelector(".renal-research img");
      return image?.complete && image.naturalWidth > 0;
    });
    const sizes = await image.evaluate(image => ({ width: image.naturalWidth, height: image.naturalHeight }));
    assert.ok(Math.abs(sizes.width / sizes.height - 16 / 9) < .003, "Presentation illustration should be widescreen.");
    await page.locator(".renal-research-transcript summary").click();
    for (const title of ["Anemia / Hb Deterioration", "Hyperkalemia Monitoring", "Dialysis Adequacy / URR", "Renal Clinical Deterioration"]) {
      assert.equal(await page.getByRole("heading", { name: title, exact: true }).isVisible(), true);
    }
    assert.equal(await page.getByText("URR = ((Pre-HD Urea − Post-HD Urea) / Pre-HD Urea) × 100", { exact: true }).isVisible(), true);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    assert.equal(overflow, false, `Unexpected horizontal overflow at ${width}px`);
    report.layouts.push({ width, status: "passed", horizontalOverflow: false, imageSize: sizes });
    if (process.env.GOVCARE_INFOGRAPHIC_SCREENSHOTS) {
      const directory = resolve(process.env.GOVCARE_INFOGRAPHIC_SCREENSHOTS);
      await fs.mkdir(directory, { recursive: true });
      await page.screenshot({ path: resolve(directory, `research-${width}.png`), fullPage: true });
    }
  }
  record("Desktop, tablet and mobile layouts show all four readable module descriptions without horizontal overflow");

  const toggle = page.locator(".renal-research-figure summary");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => !document.querySelector(".renal-research-figure").open);
  assert.equal(await page.locator(".renal-research img").isVisible(), false);
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => document.querySelector(".renal-research-figure").open);
  assert.equal(await page.locator(".renal-research img").isVisible(), true);
  record("Keyboard activation collapses and reopens the real infographic");

  const fullSize = page.getByRole("link", { name: "Open full size", exact: true });
  assert.equal(await fullSize.getAttribute("target"), "_blank");
  assert.match(await fullSize.getAttribute("rel"), /noopener/);
  const [popup] = await Promise.all([context.waitForEvent("page"), fullSize.click()]);
  await popup.waitForLoadState();
  assert.match(popup.url(), /ckd-risk-predictive-intelligence-v45\.png$/);
  await popup.close();
  record("Full-size viewing opens the packaged PNG in a protected new tab");

  for (const [label, signature, filename] of [
    ["Download PNG", [137, 80, 78, 71], "GovCare_CKD_Research_Infographic.png"],
    ["Presentation PDF", [37, 80, 68, 70], "GovCare_CKD_Research_Infographic.pdf"],
  ]) {
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("link", { name: label, exact: true }).click()]);
    assert.equal(download.suggestedFilename(), filename);
    const bytes = await fs.readFile(await download.path());
    assert.deepEqual([...bytes.subarray(0, 4)], signature);
    assert.ok(bytes.length > 100000);
    record(`${label} returns a genuine packaged file with the expected filename and signature`);
  }
  assert.deepEqual(errors, []);
  assert.equal(clinicalRequests, 0);
  record("The research component produces no runtime errors and makes no clinical API calls");

  const fallback = await context.newPage();
  await fallback.route("**/research/ckd-risk-predictive-intelligence-v45.png", route => route.abort());
  await fallback.goto(pageUrl);
  await fallback.locator(".renal-research-figure summary").click();
  await fallback.getByRole("status").waitFor();
  assert.match(await fallback.getByRole("status").innerText(), /complete module descriptions remain available/);
  await fallback.locator(".renal-research-transcript summary").click();
  assert.equal(await fallback.getByRole("heading", { name: "Hyperkalemia Monitoring", exact: true }).isVisible(), true);
  record("An unavailable image leaves an accessible fallback and readable research descriptions");
  await fallback.close();
  report.status = "passed";
  report.runtimeErrors = errors.length;
  report.clinicalApiRequests = clinicalRequests;
  report.browserVersion = browser.version();
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  report.runtimeErrors = errors;
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  await fs.rm(fixture, { force: true });
  await fs.mkdir(resolve(output, ".."), { recursive: true });
  await fs.writeFile(output, JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
