import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Use an actual signed-in local operational fixture. No route mocks, fabricated
// API responses, direct database access or clinical-validation claims belong here.
// Start Spring, ML and Vite in the same exec_command network namespace before
// running this verifier. This script inspects reviews and cancels; it saves none.
const site = new URL(process.env.GOVCARE_VISUAL_URL ?? "http://127.0.0.1:5300");
const api = new URL(process.env.GOVCARE_VISUAL_API ?? "http://127.0.0.1:4002");
for (const url of [site, api]) {
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Use a local test installation.");
  assert.ok(["http:", "https:"].includes(url.protocol), "Use an HTTP local test installation.");
  assert.ok(!url.username && !url.password, "Do not put credentials in installation URLs.");
}
if (!process.env.GOVCARE_VISUAL_ACCOUNTS) {
  throw new Error("Set GOVCARE_VISUAL_ACCOUNTS to a private local JSON array containing an enabled {role:'doctor',email,password,patientId} fixture. Complete temporary-password changes and stage current Hb baseline/URR research snapshots first.");
}
const accounts = JSON.parse(await fs.readFile(process.env.GOVCARE_VISUAL_ACCOUNTS, "utf8"));
assert.ok(Array.isArray(accounts), "The private fixture account file must contain an array.");
const account = accounts.find(item => item.role === "doctor" && item.patientId);
assert.ok(account, "An enabled doctor fixture with an authorized patientId is required.");
assert.match(account.patientId, /^[0-9a-f-]{36}$/i, "Use a valid fixture patient identifier.");
assert.ok(typeof account.email === "string" && typeof account.password === "string", "The doctor fixture needs login credentials.");
const modulePath = process.env.GOVCARE_PLAYWRIGHT_MODULE
  ? pathToFileURL(resolve(process.env.GOVCARE_PLAYWRIGHT_MODULE)).href : "playwright";
const { chromium } = await import(modulePath);
const output = resolve(process.env.GOVCARE_VISUAL_OUTPUT ?? "verification/renal-screenshots");
await fs.mkdir(output, { recursive: true });

const report = {
  operationalFixturesNotClinicalValidation: true,
  scope: "Authenticated local doctor fixture; UI and operational workflow verification only",
  status: "running",
  checks: [],
  layouts: [],
  reviewActions: [],
  runtimeErrorCount: 0,
  consoleErrorCount: 0,
  renalWriteRequests: 0,
};
let currentCheck = "launch local browser";
const browser = await chromium.launch({
  ...(process.env.GOVCARE_CHROMIUM_EXECUTABLE ? {executablePath: process.env.GOVCARE_CHROMIUM_EXECUTABLE} : {}),
  args: process.env.GOVCARE_CHROMIUM_ARGS ? JSON.parse(process.env.GOVCARE_CHROMIUM_ARGS) : ['--disable-dev-shm-usage'],
});
report.browserVersion = browser.version();
const context = await browser.newContext({ viewport: { width: 1366, height: 1080 }, reducedMotion: "reduce", locale: "en-US", timezoneId: "Asia/Colombo" });
const page = await context.newPage();
let renalReadRequests = 0;
page.on("pageerror", () => { report.runtimeErrorCount++; });
page.on("console", message => { if (message.type() === "error") report.consoleErrorCount++; });
page.on("request", request => {
  const path = new URL(request.url()).pathname;
  if (path.includes("/renal-intelligence")) {
    if (["GET", "HEAD"].includes(request.method())) renalReadRequests++;
    else report.renalWriteRequests++;
  }
});
const record = (check, evidence = {}) => report.checks.push({ check, status: "passed", ...evidence });
const snapshotSummary = payload => payload.predictions.map(row => ({ id: row.id, state: row.review_state, version: row.review_version }))
  .sort((a, b) => a.id.localeCompare(b.id));
const latestFor = (payload, key) => payload.predictions.filter(row => row.model_key === key)
  .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];

try {
  currentCheck = "sign in with the local doctor fixture";
  await page.goto(new URL("/login", site).href);
  await page.locator('input[type="email"]').fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(url => !url.pathname.endsWith("/login"), { timeout: 30000 });
  const token = await page.evaluate(() => localStorage.getItem("govcare-api-token"));
  assert.ok(token, "A real signed-in API token is required.");
  const headers = { Authorization: `Bearer ${token}` };
  const endpoint = `/api/ai-cdss/ckd/patients/${account.patientId}/renal-intelligence`;
  const read = () => context.request.get(new URL(endpoint, api).href, { headers });

  currentCheck = "read the scoped real renal API and current operational forecasts";
  const response = await read();
  assert.equal(response.status(), 200, "The signed-in doctor must be authorized for this fixture patient.");
  const before = await response.json();
  assert.equal(before.patientId, account.patientId, "The backend patient association must match.");
  assert.ok(before.hospitalId, "The backend hospital association is required.");
  assert.equal(before.canReview, true, "The fixture doctor must have clinical write permission for review-control inspection.");
  assert.ok(before.observations.length > 0, "Stage dated dialysis observations before running the verifier.");
  assert.ok(before.observations.every(row => typeof row.observed_at === "string" && Number.isFinite(Date.parse(row.observed_at))), "Measured dates must be explicit valid ISO timestamps.");
  assert.ok(before.predictions.every(row => typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at))), "Snapshot creation dates must be explicit valid ISO timestamps.");
  assert.ok(before.observations.some(row => Number.isFinite(row.measurements?.urr)), "The backend must return measured URR derived from its paired urea source.");
  const hb = latestFor(before, "hb"), urr = latestFor(before, "urr");
  for (const snapshot of [hb, urr]) {
    assert.ok(snapshot, "Stage both Hb and URR prediction snapshots through the actual application API.");
    assert.equal(snapshot.status, "AVAILABLE", "The current operational forecast fixture must be AVAILABLE.");
    assert.equal(snapshot.outputs.status, "AVAILABLE", "The output must agree with its snapshot status.");
    assert.ok(Number.isFinite(snapshot.outputs.prediction), "The available forecast must have a finite continuous estimate.");
    assert.equal(snapshot.outputs.probability, null, "Continuous forecasts must not masquerade as disease probabilities.");
    assert.equal(snapshot.outputs.clinical_validation, "NOT_COMPLETED", "The operational fixture does not establish clinical validation.");
    assert.equal(snapshot.outputs.dataset_permission_status, "UNVERIFIED", "Dataset permission remains explicitly unverified.");
    assert.ok(Number.isFinite(Date.parse(snapshot.outputs.forecast_origin_date)) && Number.isFinite(Date.parse(snapshot.outputs.forecast_date)), "The chart needs explicit forecast origin and target dates.");
    assert.equal(Date.parse(snapshot.outputs.forecast_origin_date), Math.max(...before.observations.map(row => Date.parse(row.observed_at))), "The forecast origin must agree with the actual latest measured timestamp after repeated API reads.");
  }
  assert.equal(hb.outputs.method, "PERSISTENCE_BASELINE", "The Hb fixture must exercise the failed-improvement persistence gate.");
  assert.equal(hb.outputs.explanation.method, "BASELINE", "Hb persistence must not report SHAP.");
  assert.equal(urr.outputs.method, "RESEARCH_MODEL", "The URR fixture must exercise the research model.");
  assert.equal(urr.outputs.explanation.method, "SHAP", "The URR fixture must exercise actual model explanation.");
  assert.ok(urr.outputs.explanation.top_factors.length > 0, "The URR research fixture needs SHAP factors.");
  record("Authenticated scoped backend read", { observations: before.observations.length, patientAssociation: "matched", hospitalAssociation: "present", clinicalWritePermission: true });
  record("Current AVAILABLE continuous forecast contracts", { hbMethod: hb.outputs.method, urrMethod: urr.outputs.method, probabilities: "null", clinicalValidation: "NOT_COMPLETED", datasetPermission: "UNVERIFIED" });

  currentCheck = "open renal intelligence inside the integrated CKD workspace";
  await page.goto(new URL(`/ai-cdss/ckd?patientId=${account.patientId}&view=intelligence`, site).href);
  await page.locator(".pci-summary-grid").waitFor({ timeout: 30000 });
  const panel = page.locator(".sri-renal");
  await panel.waitFor();
  await page.waitForFunction(() => document.querySelector(".sri-renal")?.getAttribute("aria-busy") === "false");
  currentCheck = "verify that displayed source dates preserve their actual ISO timestamps";
  const displayedDates = await panel.locator(".sri-renal-latest time").evaluateAll(elements => elements.map(element => {
    const timestamp = element.getAttribute("datetime");
    return { timestamp, rendered: element.textContent,
      parsedIso: timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toISOString() : null,
      browserFormatted: timestamp && Number.isFinite(Date.parse(timestamp)) ? new Date(timestamp).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : null };
  }));
  if (process.env.GOVCARE_RENAL_BROWSER_DEBUG) await fs.writeFile(resolve(process.env.GOVCARE_RENAL_BROWSER_DEBUG) + "-dates.json", JSON.stringify({ apiObservationDates: before.observations.map(row => row.observed_at), apiCreatedDates: before.predictions.map(row => row.created_at), displayedDates }, null, 2));
  for (const date of displayedDates) {
    assert.ok(before.observations.some(row => row.observed_at === date.timestamp), "The displayed source timestamp must come from the authorized history.");
    const expected = new Date(date.timestamp).toLocaleDateString("en-US", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" });
    assert.equal(date.rendered, expected, "The displayed lab date must match the actual measured instant.");
  }
  record("Measured source date display", { verifiedSourceDates: displayedDates.length });
  assert.equal(await panel.locator(".sri-renal-message-error").count(), 0, "The live renal panel must load without an API error.");
  assert.equal(await panel.locator(".sri-renal-model").count(), 4, "Hb, URR, hyperkalemia and dry-weight status cards must share the existing workspace.");
  const hbCard = panel.locator(".sri-renal-model").filter({ has: page.getByRole("heading", { name: "Hemoglobin", exact: true }) });
  const urrCard = panel.locator(".sri-renal-model").filter({ has: page.getByRole("heading", { name: "Urea reduction ratio", exact: true }) });
  const hyperCard = panel.locator(".sri-renal-model").filter({ has: page.getByRole("heading", { name: "Next-period hyperkalemia research risk", exact: true }) });
  const dryCard = panel.locator(".sri-renal-model").filter({ has: page.getByRole("heading", { name: "Dry weight", exact: true }) });
  assert.equal(await hyperCard.count(), 1, "The Sri Lankan hyperkalemia research model card must be present.");
  assert.notEqual((await hbCard.locator(".sri-renal-model-value strong").innerText()).trim(), "Unavailable", "Hb baseline should expose its available numeric estimate.");
  assert.notEqual((await urrCard.locator(".sri-renal-model-value strong").innerText()).trim(), "Unavailable", "URR research should expose its available numeric estimate.");
  assert.equal((await dryCard.locator(".sri-renal-model-value strong").innerText()).trim(), "Unavailable", "Dry weight must remain unavailable.");
  assert.equal(await dryCard.getByRole("button", { name: "Model unavailable", exact: true }).isDisabled(), true, "The unavailable dry-weight model cannot run.");
  assert.match(await dryCard.innerText(), /patient\/date cohort/, "The source-cohort limitation must be visible.");
  record("Integrated cards and unavailable dry-weight gate");

  currentCheck = "inspect baseline and SHAP explanations without substituting fake explanations";
  await hbCard.locator("summary").click();
  assert.match(await hbCard.innerText(), /Persistence baseline/);
  assert.match(await hbCard.innerText(), /No learned-model SHAP contributions apply/);
  assert.doesNotMatch(await hbCard.innerText(), /SHAP contributions to model output/);
  await urrCard.locator("summary").click();
  assert.match(await urrCard.innerText(), /SHAP contributions to model output/);
  assert.match(await urrCard.innerText(), /model associations, not causal effects/);
  assert.ok(await urrCard.locator(".sri-renal-explanation-body tbody tr").count() > 0, "Actual SHAP factors should render in the explanation table.");
  for (const [card, snapshot] of [[hbCard, hb], [urrCard, urr]]) {
    const created = card.locator(".sri-renal-explanation-body dl time");
    assert.equal(await created.getAttribute("datetime"), snapshot.created_at, "The created date must identify the actual immutable snapshot timestamp.");
    assert.equal(await created.innerText(), new Date(snapshot.created_at).toLocaleDateString("en-US", { timeZone: "Asia/Colombo", day: "numeric", month: "short", year: "numeric" }), "Snapshot creation dates must display correctly.");
  }
  record("Snapshot creation date display", { verifiedSnapshots: 2, forecastOrigins: "match latest measured timestamp" });
  record("Explanation method separation", { hb: "baseline without SHAP", urr: "SHAP factors with association limitation" });

  currentCheck = "inspect measured and forecast series labels and measurement selectors";
  const chartSelector = panel.getByRole("combobox", { name: "Renal trend measurement", exact: true });
  assert.deepEqual(await chartSelector.locator("option").evaluateAll(options => options.map(option => option.value)), ["hb", "urr", "creatinine_pre", "urea_pre", "potassium_pre", "albumin", "dry_weight"]);
  for (const metric of ["hb", "urr"]) {
    await chartSelector.selectOption(metric);
    await panel.locator(".sri-renal-chart").scrollIntoViewIfNeeded();
    await panel.locator(".sri-renal-chart svg.recharts-surface").waitFor({state: 'visible'});
    const chartBounds = await panel.locator(".sri-renal-chart svg.recharts-surface").boundingBox();
    assert.ok(chartBounds && chartBounds.width > 100 && chartBounds.height > 100,
      "The actual SVG must retain a visible responsive width and height.");
    assert.equal(await panel.locator(".sri-renal-chart-key > span").filter({hasText: /Measured\s*·/}).isVisible(), true, "Measured source values must have their own legend.");
    assert.equal(await panel.locator(".sri-renal-chart-key").getByText("Research forecast · not a lab result", { exact: true }).isVisible(), true, "Predicted values must have a separate research legend.");
    const forecastLine = panel.locator('.sri-renal-chart path[stroke-dasharray="7 6"]');
    await forecastLine.waitFor({ state: "attached" });
    // A correct persistence forecast is horizontal. Its SVG bounding box has
    // zero height despite a visible painted stroke, so Playwright's element
    // visibility heuristic alone cannot verify this line.
    const paintedForecast = await forecastLine.evaluate(path => ({ length: path.getTotalLength(),
      stroke: getComputedStyle(path).stroke, strokeWidth: Number.parseFloat(getComputedStyle(path).strokeWidth),
      display: getComputedStyle(path).display, visibility: getComputedStyle(path).visibility }));
    assert.ok(paintedForecast.length > 100 && paintedForecast.stroke !== "none" && paintedForecast.strokeWidth > 0 &&
      paintedForecast.display !== "none" && paintedForecast.visibility === "visible", "The research forecast must have a painted dashed stroke, including horizontal persistence forecasts.");
    const forecastDots = panel.locator('.sri-renal-chart circle.recharts-line-dot[name="Research forecast"]');
    assert.equal(await forecastDots.count(), 2, "The forecast must retain its origin and future endpoint.");
    assert.equal(await forecastDots.first().isVisible(), true, "The forecast origin marker must be visible.");
    assert.equal(await forecastDots.last().isVisible(), true, "The future forecast marker must be visible.");
    assert.match(await panel.locator(".sri-renal-chart-note").first().innerText(), /empirical residual interval.*not clinically calibrated/);
  }
  const convertedHbSources = before.observations.filter(row => row.units?.hb?.trim().toLowerCase() === "g/l");
  if (convertedHbSources.length) {
    await chartSelector.selectOption("hb");
    assert.match(await panel.locator(".sri-renal-chart").getAttribute("aria-label"), /measurements in g\/dL/);
    assert.match(await panel.locator(".sri-renal-chart-card").innerText(), /converted to g\/dL for this chart/);
    await panel.locator(".sri-renal-sources summary").click();
    for (const row of convertedHbSources) {
      const formatted = row.measurements.hb.toLocaleString("en-US", { maximumFractionDigits: 2 });
      assert.ok((await panel.locator(".sri-renal-sources").innerText()).includes(`Hemoglobin: ${formatted} ${row.units.hb}`),
        "The source table must retain the recorded Hb value and source unit.");
    }
    await panel.locator(".sri-renal-sources summary").click();
    record("Mixed-unit Hb chart and preserved source table", {
      sourceUnit: "g/L", chartUnit: "g/dL", sourceValuesAndUnits: "unchanged", convertedSources: convertedHbSources.length,
    });
  }
  await chartSelector.selectOption("creatinine_pre");
  assert.equal(await panel.locator(".sri-renal-chart-key .sri-renal-line-dashed").count(), 0, "Creatinine history must not acquire an unrelated Hb or URR prediction.");
  await chartSelector.selectOption("urr");
  record("Measured and forecast series separation", { checkedForecastMetrics: ["hb", "urr"], unrelatedCreatinineForecast: "absent", residualInterval: "explicitly not clinically calibrated" });

  currentCheck = "inspect review actions, required fields and keyboard focus without saving";
  const reviewButton = hbCard.getByRole("button", { name: "Review output", exact: true });
  await reviewButton.focus();
  await reviewButton.press("Enter");
  const dialog = page.getByRole("dialog", { name: "Review renal research output", exact: true });
  await dialog.waitFor();
  assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, "Keyboard opening must move focus into the dialog.");
  const decision = dialog.getByRole("combobox", { name: "Clinical decision", exact: true });
  assert.deepEqual((await decision.locator("option").evaluateAll(options => options.map(option => option.value))).sort(), ["ACCEPT", "DEFER", "DISMISS", "MODIFY"]);
  for (const action of ["ACCEPT", "MODIFY", "DEFER", "DISMISS"]) {
    await decision.selectOption(action);
    const reason = dialog.getByRole("textbox", { name: /^Clinical reason/ });
    await reason.fill("");
    assert.equal(await reason.evaluate(element => element.required), true, "Every review action needs a clinical reason.");
    assert.equal(await dialog.locator("form").evaluate(form => form.checkValidity()), false, "An empty reason must invalidate the review form.");
    await reason.fill("Operational UI inspection only; no review will be submitted.");
    if (action === "MODIFY") {
      const modified = dialog.getByRole("textbox", { name: /^Modified interpretation/ });
      assert.equal(await modified.evaluate(element => element.required), true, "Modify needs a modified clinical interpretation.");
      assert.equal(await dialog.locator("form").evaluate(form => form.checkValidity()), false, "An empty modified interpretation must invalidate Modify.");
      await modified.fill("Operational fixture inspection only; not a clinical decision.");
    }
    assert.equal(await dialog.locator("form").evaluate(form => form.checkValidity()), true, "Required inspection-only fields should make the form valid without submitting it.");
    report.reviewActions.push({ action, reasonRequired: true, modifiedInterpretationRequired: action === "MODIFY", submitted: false });
  }
  const tabStops = await dialog.locator("button:not(:disabled),select:not(:disabled),textarea:not(:disabled),input:not(:disabled)").count();
  for (let index = 0; index < tabStops + 2; index++) {
    await page.keyboard.press("Tab");
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, "Native modal focus must remain inside the review dialog.");
  }
  for (let index = 0; index < tabStops + 2; index++) {
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.evaluate(element => element.contains(document.activeElement)), true, "Reverse tab traversal must remain inside the review dialog.");
  }
  currentCheck = "close the review dialog with Escape and restore focus";
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await reviewButton.evaluate(element => document.activeElement === element), true, "Escape must restore focus to the initiating review button.");
  currentCheck = "reopen the review dialog immediately after Escape";
  await reviewButton.press("Enter");
  await dialog.waitFor();
  currentCheck = "cancel the reopened review dialog and restore focus";
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await reviewButton.evaluate(element => document.activeElement === element), true, "Cancel must restore focus to the initiating review button.");
  assert.equal(report.renalWriteRequests, 0, "Review inspection must not issue a clinical write.");
  record("Review keyboard and focus", { actions: "ACCEPT/MODIFY/DEFER/DISMISS", tabFocus: "contained", reverseTabFocus: "contained", escapeFocus: "restored", cancelFocus: "restored", writes: 0 });

  currentCheck = "check responsive renal layouts and light/dark themes";
  for (const width of [375, 768, 1366]) {
    await page.setViewportSize({ width, height: 1080 });
    for (const mode of ["dark", "light"]) {
      const readsBefore = renalReadRequests;
      if (await page.locator("html").getAttribute("data-theme") !== mode) {
        await page.getByRole("button", { name: `Switch to ${mode} mode`, exact: true }).click();
      }
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, mode);
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      const futurePoint = panel.locator('.sri-renal-chart circle.recharts-line-dot[name="Research forecast"]').last();
      await futurePoint.hover();
      const tooltip = panel.locator('.sri-renal-chart .recharts-tooltip-wrapper');
      await tooltip.waitFor({ state: "visible" });
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.match(await tooltip.innerText(), /Research forecast \(not measured\)/, "The active tooltip must distinguish forecasts from measured sources.");
      const tooltipBounds = await tooltip.boundingBox();
      assert.ok(tooltipBounds && tooltipBounds.x >= 0 && tooltipBounds.x + tooltipBounds.width <= width + 1,
        "Visible renal tooltips must fit the viewport after desktop/mobile resizing.");
      await page.mouse.move(2, 2);
      await tooltip.waitFor({ state: "hidden" });
      const layout = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        content: document.documentElement.scrollWidth,
        theme: document.documentElement.dataset.theme,
        clippedHeadingCount: [...document.querySelectorAll(".sri-renal h2,.sri-renal h3,.sri-renal-model-value strong")]
          .filter(element => element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1 && getComputedStyle(element).overflowX === "hidden").length,
      }));
      assert.ok(layout.content <= layout.viewport + 1, `Renal layout ${mode}/${width} must not cause horizontal page overflow.`);
      assert.equal(layout.clippedHeadingCount, 0, "Renal headings and forecast values must remain readable.");
      assert.equal(renalReadRequests, readsBefore, "Changing the theme must not refetch renal clinical data.");
      assert.equal(report.runtimeErrorCount, 0, "No browser runtime errors are allowed.");
      const evidence = { mode, width, ...layout, tooltipFitsViewport: true, hiddenTooltipOverflow: false, runtimeErrorCount: report.runtimeErrorCount };
      if ([375, 1366].includes(width)) {
        const filename = `doctor-renal-${mode}-${width}.png`;
        await page.screenshot({ path: resolve(output, filename), fullPage: true, animations: "disabled" });
        evidence.screenshot = filename;
      }
      report.layouts.push(evidence);
    }
  }
  record("Responsive light/dark layouts", { widths: [375, 768, 1366], screenshotWidths: [375, 1366], themeRefetches: 0 });

  currentCheck = "verify that canceled review inspections preserved backend review snapshots";
  const afterResponse = await read();
  assert.equal(afterResponse.status(), 200, "The authenticated post-inspection read must succeed.");
  const after = await afterResponse.json();
  assert.equal(after.patientId, before.patientId, "The inspected patient must remain associated correctly.");
  assert.deepEqual(snapshotSummary(after), snapshotSummary(before), "Review state and versions must be unchanged after inspection-only cancellation.");
  assert.deepEqual(after.observations, before.observations, "Rendering and canceled dialogs must preserve the source observations and units.");
  assert.equal(report.renalWriteRequests, 0, "The verifier must not save observations, forecasts or reviews.");
  assert.equal(report.runtimeErrorCount, 0, "No browser runtime errors are allowed.");
  record("Authoritative backend state after canceled inspections", { snapshots: after.predictions.length, reviewStatesAndVersions: "unchanged", writes: 0 });
  report.status = "passed";
} catch (failure) {
  report.status = "failed";
  report.failedCheck = currentCheck;
  if (process.env.GOVCARE_RENAL_BROWSER_DEBUG) {
    const debugPath = resolve(process.env.GOVCARE_RENAL_BROWSER_DEBUG);
    let detail = failure instanceof Error ? failure.message : String(failure);
    for (const value of [account.email, account.password]) detail = detail.replaceAll(value, '[redacted]');
    detail = detail.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[redacted JWT]');
    await fs.writeFile(debugPath + '.txt', detail);
    const layout = await page.evaluate(() => {
      const viewport = document.documentElement.clientWidth;
      return { viewport, content: document.documentElement.scrollWidth,
        overflow: [...document.querySelectorAll("body *")].map(element => {
          const bounds = element.getBoundingClientRect(), style = getComputedStyle(element);
          return { tag: element.tagName, classes: element.getAttribute("class"), right: bounds.right,
            width: bounds.width, clientWidth: element.clientWidth, scrollWidth: element.scrollWidth,
            overflowX: style.overflowX, minWidth: style.minWidth, display: style.display };
        }).filter(item => item.width > 0 && item.right > viewport + 1).slice(0, 45) };
    });
    await fs.writeFile(debugPath + '-layout.json', JSON.stringify(layout, null, 2));
    await page.screenshot({path: debugPath + '.png', fullPage: true}).catch(() => {});
  }
  // Avoid serializing Playwright call logs, account details, headers or tokens.
  throw new Error(`Live renal browser verification failed at: ${currentCheck}. ${failure instanceof assert.AssertionError ? failure.message : "The browser step did not complete; inspect the local test installation."}`);
} finally {
  if (process.env.GOVCARE_RENAL_BROWSER_DEBUG) {
    const chart = await page.locator('.sri-renal-chart').evaluate(element => ({bounds: element.getBoundingClientRect().toJSON(),
      descendants: [...element.querySelectorAll('.recharts-responsive-container,.recharts-wrapper,svg')].map(item => ({tag: item.tagName, classes: item.getAttribute('class'), bounds: item.getBoundingClientRect().toJSON()})),
      html: element.innerHTML.slice(0, 16000)})).catch(() => null);
    await fs.writeFile(resolve(process.env.GOVCARE_RENAL_BROWSER_DEBUG) + '-chart.json', JSON.stringify(chart, null, 2));
  }
  await context.close();
  await browser.close();
  await fs.writeFile(resolve(output, "browser-report.json"), JSON.stringify(report, null, 2));
}
console.log(`Live renal UI checks passed. Operational fixtures are not clinical validation. Report: ${output}`);
