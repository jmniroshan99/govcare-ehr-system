import fs from "node:fs/promises";
import ts from "typescript";

// Use the project's TypeScript compiler, so Node 22 does not need native .ts imports.
export async function readThemeSource() {
  const source = await fs.readFile(new URL("../src/theme/colors.ts", import.meta.url), "utf8");
  const javascript = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(javascript).toString("base64")}`);
}
