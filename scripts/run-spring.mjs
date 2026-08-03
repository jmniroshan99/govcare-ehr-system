import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const isWindows = process.platform === "win32";
const project = join(process.cwd(), "spring-api");
const env = { ...process.env };
const envFile = join(project, ".env");
if (existsSync(envFile)) {
  for (const raw of readFileSync(envFile, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index > 0) env[line.slice(0, index).trim()] = line.slice(index + 1).trim();
  }
}
const command = isWindows ? "mvnw.cmd" : "./mvnw";
const mode = process.argv[2] ?? "run";
const args = mode === "build" ? ["clean", "package", "-DskipTests"] : ["spring-boot:run"];
const child = spawn(command, args, { cwd: project, stdio: "inherit", shell: isWindows, env });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
child.on("exit", (code) => process.exit(code ?? 1));
