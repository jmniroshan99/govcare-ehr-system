import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import ts from "typescript";
import { readThemeSource } from "./theme-source.mjs";

const { themeColors, exportColors } = await readThemeSource();

// WCAG relative luminance is an independent oracle for visible text and chart marks.
function rgb(color) {
  if (color.startsWith("#")) return color.slice(1).match(/../g).map((v) => parseInt(v, 16));
  return color.match(/[\d.]+/g).map(Number);
}
function composite(top, bottom) {
  const a = rgb(top), b = rgb(bottom), alpha = a[3] ?? 1;
  return a.slice(0, 3).map((value, i) => value * alpha + b[i] * (1 - alpha));
}
function luminance(values) {
  const linear = values.map((value) => value / 255).map((value) => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722;
}
function contrast(a, b) {
  const [hi, lo] = [luminance(typeof a === "string" ? rgb(a) : a), luminance(typeof b === "string" ? rgb(b) : b)].sort((x, y) => y - x);
  return (hi + .05) / (lo + .05);
}
function visible(foreground, background, threshold, label) {
  const ratio = contrast(foreground, background);
  assert.ok(ratio >= threshold, `${label}: contrast ${ratio.toFixed(2)} is below ${threshold}`);
}

for (const mode of ["light", "dark"]) {
  test(`${mode}: body, cards, heroes and glass have readable primary and secondary text`, () => {
    const c = themeColors[mode];
    for (const [name, background] of Object.entries({ body: c.background, surface: c.surface, muted: c.surfaceMuted, card: composite(c.card, c.surface), glass: composite(c.glass, c.background), heroStart: c.heroStart, heroEnd: c.heroEnd })) {
      visible(c.text, background, 4.5, `${mode} ${name} primary text`);
      visible(c.muted, background, 4.5, `${mode} ${name} secondary text`);
    }
  });
  test(`${mode}: actions, badges and clinical alerts have accessible foregrounds`, () => {
    const c = themeColors[mode];
    visible(c.onAction, c.action, 4.5, `${mode} action`);
    visible(c.onAction, c.actionHover, 4.5, `${mode} action hover`);
    for (const [name, tone] of Object.entries(c.tones)) {
      visible(tone.text, tone.surface, 4.5, `${mode} ${name} status`);
      visible(exportColors.paper, tone.solid, 4.5, `${mode} ${name} solid control`);
    }
  });
  test(`${mode}: chart axes and all eight series remain visible on chart surfaces`, () => {
    const c = themeColors[mode];
    for (const background of [c.surface, composite(c.card, c.surface)]) {
      visible(c.chartAxis, background, 4.5, `${mode} chart axis`);
      c.chartSeries.forEach((color, i) => visible(color, background, 3, `${mode} chart series ${i + 1}`));
    }
    visible(c.text, c.heatmapHigh, 4.5, `${mode} heatmap strongest cell`);
  });
}

let instance = 0;
async function createStore(t, { stored, osDark = true, blocked = false } = {}) {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const classes = new Set(), values = new Map(stored ? [["govcare-theme", stored]] : []), events = new Map();
  const media = { matches: osDark, addEventListener: (name, fn) => events.set(`media:${name}`, fn) };
  globalThis.document = { documentElement: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) }, dataset: {}, style: {} } };
  globalThis.window = {
    localStorage: { getItem: (key) => { if (blocked) throw new Error("Storage denied"); return values.get(key) ?? null; }, setItem: (key, value) => { if (blocked) throw new Error("Storage denied"); values.set(key, value); } },
    matchMedia: () => media, addEventListener: (name, fn) => events.set(name, fn),
  };
  t.after(() => { globalThis.window = previousWindow; globalThis.document = previousDocument; });
  const source = await fs.readFile(new URL("../src/theme/themeStore.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } }).outputText;
  const store = await import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}#${instance++}`);
  return { store, classes, values, media, events };
}

test("saved light mode overrides a dark operating system and toggles all consumers together", async (t) => {
  const { store, classes, values } = await createStore(t, { stored: "light" });
  store.initializeTheme();
  assert.equal(store.getThemeSnapshot(), "light");
  assert.equal(classes.has("dark"), false);
  const snapshots = [[], []];
  const detach = snapshots.map((rows) => store.subscribeTheme(() => rows.push(store.getThemeSnapshot())));
  store.setTheme((previous) => previous === "light" ? "dark" : "light");
  assert.equal(classes.has("dark"), true);
  assert.equal(document.documentElement.dataset.theme, "dark");
  assert.equal(document.documentElement.style.colorScheme, "dark");
  assert.equal(values.get("govcare-theme"), "dark");
  store.setTheme("light");
  assert.equal(classes.has("dark"), false);
  assert.deepEqual(snapshots, [["dark", "light"], ["dark", "light"]]);
  detach.forEach((fn) => fn());
});

test("theme follows system changes only without a saved choice and synchronizes across tabs", async (t) => {
  const { store, media, events, values } = await createStore(t, { osDark: false });
  store.initializeTheme();
  media.matches = true; events.get("media:change")();
  assert.equal(store.getThemeSnapshot(), "dark");
  store.setTheme("light"); events.get("media:change")();
  assert.equal(store.getThemeSnapshot(), "light");
  values.set("govcare-theme", "dark"); events.get("storage")({ key: "govcare-theme" });
  assert.equal(store.getThemeSnapshot(), "dark");
});

test("a blocked preference store cannot prevent login rendering or theme changes", async (t) => {
  const { store, classes } = await createStore(t, { blocked: true });
  assert.doesNotThrow(() => store.initializeTheme());
  assert.equal(classes.has("dark"), true);
  assert.doesNotThrow(() => store.setTheme("light"));
  assert.equal(classes.has("dark"), false);
});

test("QR printing keeps a high contrast paper palette independent of display theme", () => {
  visible(exportColors.qrInk, exportColors.paper, 7, "QR code");
});
