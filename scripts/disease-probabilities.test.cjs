const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const React = require("react"), { renderToStaticMarkup } = require("react-dom/server");
const root = path.resolve(__dirname, "..");
function loader() {
  const cache = new Map();
  function load(file) {
    const absolute = path.resolve(root, file);
    if (absolute.endsWith(".css")) return {};
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    const localRequire = name => {
      if (!name.startsWith(".")) return require(name);
      const base = path.resolve(path.dirname(absolute), name);
      return load([base, base + ".ts", base + ".tsx"].find(p => fs.existsSync(p)));
    };
    new Function("require", "exports", "module", code)(localRequire, module.exports, module);
    return module.exports;
  }
  return load;
}
const load = loader();
const { diseaseProbabilitySnapshot, probabilityText, hasProbability } = load("src/lib/diseaseProbabilities.ts");
const { DiseaseProbabilityPanel } = load("src/components/ai/DiseaseProbabilityPanel.tsx");
const model = "GOVCARE-CKD-LOGISTIC-1.0";
const base = { probability: .32145, confidence: .99, modelVersion: model };
const legacy = diseaseProbabilitySnapshot(base);
function captured() {
  const value = structuredClone(legacy); value.capturedAt = "2026-10-06T12:00:00Z";
  value.entries.slice(1).forEach(e => { e.status = "NOT_AVAILABLE"; e.modelVersion = "not-installed"; e.validationStatus = "NOT_INSTALLED"; });
  return value;
}

test("older API responses retain the CKD result and never backfill related disease risks", () => {
  assert.equal(legacy.entries[0].probability, .32145); assert.equal(legacy.capturedAt, null);
  assert.equal(legacy.entries.length, 7);
  legacy.entries.slice(1).forEach(e => { assert.equal(e.probability, null); assert.equal(e.status, "NOT_CAPTURED"); });
});
test("complete saved snapshot is retained without changing its probabilities", () => {
  const snapshot = captured();
  assert.deepEqual(diseaseProbabilitySnapshot({ ...base, diseaseProbabilities: snapshot }), snapshot);
  assert.equal(probabilityText(snapshot.entries[0].probability), "32.1%");
  assert.notEqual(snapshot.entries[0].probability, base.confidence);
});
for (const value of [null, undefined, NaN, Infinity, -.1, 1.1, 60, "0.5"]) {
  test(`unavailable or invalid value ${String(value)} is never displayed as a zero or percentage`, () => assert.equal(probabilityText(value), "Data unavailable"));
}
test("actual zero and one model outputs remain valid boundaries", () => {
  assert.equal(probabilityText(0), "0.0%"); assert.equal(probabilityText(1), "100.0%");
});
for (const status of ["NOT_AVAILABLE", "NOT_CAPTURED", "INSUFFICIENT_DATA", "SUPPRESSED"]) {
  test(`${status} cannot smuggle a numeric probability into the panel`, () => {
    const snapshot = captured(); snapshot.entries[1].status = status; snapshot.entries[1].probability = .8;
    const normalized = diseaseProbabilitySnapshot({ ...base, diseaseProbabilities: snapshot });
    assert.equal(normalized.capturedAt, null); assert.equal(normalized.entries[1].probability, null);
  });
}
test("a related percentage requires a validated versioned model and a time horizon", () => {
  const snapshot = captured(); const entry = snapshot.entries[1];
  Object.assign(entry, { status: "AVAILABLE", probability: .25, modelVersion: "SYNTHETIC-VALIDATED-TEST-MODEL", horizon: "12 months", validationStatus: "VALIDATED" });
  assert.equal(hasProbability(entry), true);
  assert.equal(diseaseProbabilitySnapshot({ ...base, diseaseProbabilities: snapshot }).entries[1].probability, .25);
  for (const alteration of [{ validationStatus: "RESEARCH" }, { modelVersion: "not-installed" }, { horizon: "" }, { probability: null }]) {
    const changed = structuredClone(snapshot); Object.assign(changed.entries[1], alteration);
    assert.equal(diseaseProbabilitySnapshot({ ...base, diseaseProbabilities: changed }).capturedAt, null);
  }
});
test("model version, probability, schema and capture time mismatches fail closed", () => {
  for (const alter of [s => s.schemaVersion = 2, s => s.capturedAt = "not-a-date", s => s.entries[0].modelVersion = "foreign-model", s => s.entries[0].probability = .9,
    s => s.entries[1] = s.entries[0], s => s.entries.pop(), s => s.entries[1].key = "unknown", s => s.entries[1].probability = "0.1"]) {
    const snapshot = captured(); alter(snapshot);
    assert.equal(diseaseProbabilitySnapshot({ ...base, diseaseProbabilities: snapshot }).capturedAt, null);
  }
});
test("PostgreSQL numeric rounding does not incorrectly discard a matching snapshot", () => {
  assert.notEqual(diseaseProbabilitySnapshot({ ...base, probability: .3214504, diseaseProbabilities: captured() }).capturedAt, null);
});
test("rendered cards include all six related outcomes, disclosures and unfiltered print rows", () => {
  const html = renderToStaticMarkup(React.createElement(DiseaseProbabilityPanel, { snapshot: captured() }));
  assert.equal((html.match(/class="gov-probability-card"/g) || []).length, 6);
  assert.equal((html.match(/<details/g) || []).length, 6);
  const table = html.split('class="gov-probability-print"')[1].split("</table>")[0];
  assert.equal((table.match(/<tr>/g) || []).length, 8); // header plus seven real model/capability entries
  assert.equal((table.match(/Data unavailable/g) || []).length, 6);
  assert.ok(table.includes("32.1%")); assert.ok(!table.includes("99.0%")); assert.ok(!table.includes("0.0%"));
  assert.ok(html.includes('aria-pressed="true"')); assert.ok(html.includes("Model &amp; evidence details"));
});
test("only valid model outputs render an accessible meter", () => {
  const snapshot = captured(); Object.assign(snapshot.entries[1], { status: "AVAILABLE", probability: .25,
    modelVersion: "SYNTHETIC-VALIDATED-TEST-MODEL", horizon: "12 months", validationStatus: "VALIDATED" });
  const html = renderToStaticMarkup(React.createElement(DiseaseProbabilityPanel, { snapshot }));
  assert.equal((html.match(/role="meter"/g) || []).length, 1);
  assert.ok(html.includes('aria-valuenow="25"')); assert.ok(html.includes("12 months"));
});
test("patient data and model labels are escaped in screen and print", () => {
  const snapshot = captured(); snapshot.entries[1].label = '<script>alert("test")</script>';
  const html = renderToStaticMarkup(React.createElement(DiseaseProbabilityPanel, { snapshot }));
  assert.ok(!html.includes("<script>")); assert.ok(html.includes("&lt;script&gt;"));
});
