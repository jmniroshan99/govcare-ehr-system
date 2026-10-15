import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Live UI verification only: no fabricated patients, API interception or authentication bypass.
const site = new URL(process.env.GOVCARE_VISUAL_URL ?? "http://127.0.0.1:5300");
if (!["localhost", "127.0.0.1", "[::1]"].includes(site.hostname)) throw new Error("Use a local GovCare test installation.");
const accountsFile = process.env.GOVCARE_VISUAL_ACCOUNTS;
if (!accountsFile) throw new Error("Set GOVCARE_VISUAL_ACCOUNTS to a private JSON array of {role,email,password} for enabled test accounts with completed password changes.");
const accounts = JSON.parse(await fs.readFile(accountsFile, "utf8"));
for (const role of ["super_admin", "doctor", "patient"]) assert.ok(accounts.some((account) => account.role === role), `${role} screenshot account is required`);
const module = process.env.GOVCARE_PLAYWRIGHT_MODULE ? pathToFileURL(resolve(process.env.GOVCARE_PLAYWRIGHT_MODULE)).href : "playwright";
const { chromium } = await import(module);
const output = resolve(process.env.GOVCARE_VISUAL_OUTPUT ?? "verification/screenshots");
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch();
const report = [];
try {
  for (const account of accounts) {
    assert.match(account.role, /^[a-z_]+$/);
    const context = await browser.newContext({ colorScheme: "dark", reducedMotion: "reduce", viewport: { width: 1366, height: 900 } });
    try {
      await context.addInitScript(() => { localStorage.setItem("govcare-theme", "light"); localStorage.setItem("i18nextLng", "en"); });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(error.message));
      let dashboardRequests = 0;
      page.on("request", (request) => { if (new URL(request.url()).pathname === "/api/dashboard/intelligence") dashboardRequests++; });
      await page.goto(new URL("/login", site).href);
      await page.locator('input[type="email"]').first().fill(account.email);
      await page.locator('input[type="password"]').first().fill(account.password);
      const responsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === "/api/dashboard/intelligence", { timeout: 30000 });
      await page.getByRole("button", { name: "Login", exact: true }).click();
      const response = await responsePromise;
      assert.equal(response.status(), 200, `${account.role} dashboard access`);
      const dashboard = await response.json();
      assert.equal(dashboard.role, account.role, "Backend must select the authenticated role");
      await page.locator(".intelligence-hero h1").waitFor();
      assert.equal(await page.locator(".intelligence-hero h1").innerText(), dashboard.title);
      if (dashboard.charts.some((chart) => chart.available && chart.data.length && !["heatmap", "timeline"].includes(chart.type))) await page.locator(".recharts-wrapper").first().waitFor();
      for (const width of [375, 768, 1366, 1920]) {
        await page.setViewportSize({ width, height: 1080 });
        for (const mode of ["dark", "light"]) {
          const current = await page.locator("html").getAttribute("data-theme");
          const requestsBefore = dashboardRequests;
          if (current !== mode) await page.getByRole("button", { name: `Switch to ${mode} mode`, exact: true }).click();
          await page.waitForFunction((expected) => document.documentElement.dataset.theme === expected, mode);
          await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
          const layout = await page.evaluate(() => {
            const html = document.documentElement, hero = document.querySelector(".intelligence-hero");
            return { viewport: html.clientWidth, content: html.scrollWidth, primary: getComputedStyle(html).getPropertyValue("--text-primary").trim(), heroText: getComputedStyle(hero).color, heading: getComputedStyle(hero.querySelector("h1")).color, clipped: [...document.querySelectorAll(".intelligence-hero h1,.intelligence-metric p,.intelligence-panel h3")].filter((element) => element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === "hidden").map((element) => element.textContent) };
          });
          assert.ok(layout.content <= layout.viewport + 1, `${account.role}/${mode}/${width} viewport overflow: ${layout.content}`);
          assert.equal(layout.heading, layout.heroText, "Hero heading must use its theme foreground");
          assert.equal(layout.clipped.length, 0, `${account.role}/${mode}/${width} clipped text`);
          assert.equal(dashboardRequests, requestsBefore, "Changing theme must not refetch dashboard data");
          assert.equal(errors.length, 0, "Browser runtime errors");
          const filename = `${account.role}-${mode}-${width}.png`;
          await page.screenshot({ path: resolve(output, filename), fullPage: true, animations: "disabled" });
          report.push({ role: account.role, theme: mode, width, dashboardKey: dashboard.dashboardKey, screenshot: filename, layout });
        }
      }
    } finally { await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(resolve(output, "browser-report.json"), JSON.stringify(report, null, 2));
}
console.log(`Verified ${report.length} live dashboard layouts. Screenshots: ${output}`);
