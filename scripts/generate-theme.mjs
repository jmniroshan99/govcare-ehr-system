import fs from "node:fs/promises";
import { readThemeSource } from "./theme-source.mjs";

const { themeVariables } = await readThemeSource();

const block = (selector, theme) => `${selector} {\n${Object.entries(themeVariables(theme)).map(([name, value]) => `  ${name}: ${value};`).join("\n")}\n}`;
const css = `/* Generated from colors.ts by npm run theme:generate. Do not edit directly. */\n@layer base {\n${block(":root", "light")}\n${block(":root.dark", "dark")}\n}\n@media print {\n${block(".ckd-result-print", "light")}\n}\n`;
const target = new URL("../src/theme/tokens.css", import.meta.url);
if (process.argv.includes("--check")) {
  if (await fs.readFile(target, "utf8") !== css) throw new Error("Theme CSS is stale. Run npm run theme:generate.");
} else {
  await fs.writeFile(target, css);
}
