import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const java = tool => process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", tool + (process.platform === "win32" ? ".exe" : "")) : tool;
const output = mkdtempSync(join(tmpdir(), "govcare-disease-probability-"));
try {
  const annotationRoot = join(process.env.M2_REPOSITORY || join(homedir(), ".m2", "repository"),
    "com", "fasterxml", "jackson", "core", "jackson-annotations");
  const annotationJar = existsSync(annotationRoot)
    ? readdirSync(annotationRoot, { withFileTypes: true }).filter(entry => entry.isDirectory())
      .map(entry => join(annotationRoot, entry.name, `jackson-annotations-${entry.name}.jar`))
      .filter(existsSync).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1)
    : null;
  if (!annotationJar) throw new Error("Jackson annotations are unavailable. Run the Spring dependency setup before this domain check.");
  const sources = ["src/main/java/lk/gov/health/govcare/ai/DiseaseProbabilitySnapshot.java", "src/test/java/lk/gov/health/govcare/ai/DiseaseProbabilityChecks.java"];
  for (const [tool, args] of [["javac", ["--release", "21", "-classpath", annotationJar, "-d", output, ...sources.map(p => join(root, "spring-api", p))]],
    ["java", ["-cp", `${output}${delimiter}${annotationJar}`, "lk.gov.health.govcare.ai.DiseaseProbabilityChecks"]]]) {
    const result = spawnSync(java(tool), args, { encoding: "utf8" });
    process.stdout.write(result.stdout ?? ""); process.stderr.write(result.stderr ?? "");
    if (result.error || result.status !== 0) throw new Error(result.error?.message ?? `${tool} failed.`);
  }
} finally { rmSync(output, { recursive: true, force: true }); }
