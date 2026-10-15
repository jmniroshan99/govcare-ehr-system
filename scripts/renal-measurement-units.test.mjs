import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

// Execute the actual chart unit module without requiring Node's TS loader.
const source = await readFile(new URL("../src/lib/renalMeasurementUnits.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const { normalizeRenalChartMeasurement: normalize, renalChartUnit, renalUnitName } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

test("all supported measured series retain values already in their chart unit", () => {
  const units = {
    hb: "g/dL", albumin: "g/L", calcium: "mmol/L", sodium: "mmol/L",
    potassium_pre: "mmol/L", potassium_post: "mmol/L",
    creatinine_pre: "umol/L", creatinine_post: "umol/L",
    urea_pre: "mmol/L", urea_post: "mmol/L", dry_weight: "kg", urr: "%",
  };
  for (const [metric, unit] of Object.entries(units)) {
    assert.equal(renalChartUnit(metric), unit);
    assert.deepEqual(normalize(metric, 12.5, unit), { value: 12.5, unit, converted: false });
  }
});

test("Hb in g/L aligns with the g/dL research forecast", () => {
  assert.deepEqual(normalize("hb", 108, "g/L"), { value: 10.8, unit: "g/dL", converted: true });
});

test("albumin in g/dL converts to g/L", () => {
  assert.deepEqual(normalize("albumin", 3.8, "g/dL"), { value: 38, unit: "g/L", converted: true });
});

test("pre/post creatinine conversion uses the explicit mg/dL unit", () => {
  for (const metric of ["creatinine_pre", "creatinine_post"]) {
    assert.deepEqual(normalize(metric, 1, "mg/dL"), { value: 88.4, unit: "umol/L", converted: true });
    assert.equal(normalize(metric, 88.4, "μmol/L").converted, false);
    assert.equal(normalize(metric, 88.4, "µmol/L").converted, false);
  }
});

test("whole urea conversion applies equally to explicit pre/post measurements", () => {
  for (const metric of ["urea_pre", "urea_post"]) {
    assert.deepEqual(normalize(metric, 6.006, "mg/dL"), { value: 1, unit: "mmol/L", converted: true });
    assert.equal(normalize(metric, 6.006, "BUN mg/dL"), null);
    assert.equal(normalize(metric, 6.006, "mg/dL nitrogen"), null);
  }
});

test("unsupported or missing units never acquire inferred conversions", () => {
  for (const unit of [undefined, null, "", "unknown", "mg/L", "fraction", "ratio"]) {
    assert.equal(normalize("hb", 108, unit), null);
    assert.equal(normalize("urr", 0.65, unit), null);
  }
  assert.equal(normalize("potassium_pre", 4.7, "mg/dL"), null);
  assert.equal(normalize("dry_weight", 62, "lb"), null);
});

test("unit aliases normalize spelling while invalid numeric inputs stay unresolved", () => {
  assert.equal(renalUnitName("  μMOL/L  "), "umol/l");
  assert.deepEqual(normalize("hb", 108, "  G/L  "), { value: 10.8, unit: "g/dL", converted: true });
  for (const value of [undefined, null, "108", NaN, Infinity, -Infinity]) {
    assert.equal(normalize("hb", value, "g/L"), null);
  }
});

test("chart normalization preserves source measurement values and units", () => {
  const observation = Object.freeze({
    measurements: Object.freeze({ hb: 108, albumin: 3.8, creatinine_pre: 8 }),
    units: Object.freeze({ hb: "g/L", albumin: "g/dL", creatinine_pre: "mg/dL" }),
  });
  const original = JSON.stringify(observation);
  for (const metric of Object.keys(observation.measurements)) {
    assert.ok(normalize(metric, observation.measurements[metric], observation.units[metric]));
  }
  assert.equal(JSON.stringify(observation), original);
});
