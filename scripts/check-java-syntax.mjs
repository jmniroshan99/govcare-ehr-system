import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java") : "java";
const result = spawnSync(java, [join(root, "scripts/test-support/JavaSyntaxCheck.java"), join(root, "spring-api/src")], { encoding: "utf8" });
process.stdout.write(result.stdout ?? "");
process.stderr.write(result.stderr ?? "");
if (result.error) { console.error(result.error.message); process.exit(1); }
process.exit(result.status ?? 1);
