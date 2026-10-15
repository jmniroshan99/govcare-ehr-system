import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import apiPortTools from "./api-port.cjs";
import renalPortTools from "./renal-port.cjs";

const isWindows = process.platform === "win32";
const project = fileURLToPath(new URL("../spring-api/", import.meta.url));
const mode = process.argv[2] ?? "run";
if (mode !== "run" && mode !== "build") {
  console.error("Usage: node scripts/run-spring.mjs [run|build]");
  process.exit(1);
}

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
// The coordinated launcher chooses the port before either service starts.
// Apply its selection after backend .env loading so Vite and Spring agree.
if (mode === "run" && process.env.GOVCARE_API_PORT) {
  try {
    const selected = String(apiPortTools.validateApiPort(process.env.GOVCARE_API_PORT));
    env.GOVCARE_API_PORT = selected;
    env.PORT = selected;
    env.SERVER_PORT = selected;
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
// Keep the local ML service and Spring aligned when Windows blocks port 8001.
// The combined launcher's selection must survive this backend's .env file.
if (mode === "run" && process.env.GOVCARE_RENAL_ML_PORT) {
  try {
    const selected = renalPortTools.validateRenalPort(process.env.GOVCARE_RENAL_ML_PORT);
    env.GOVCARE_RENAL_ML_PORT = String(selected);
    env.GOVCARE_RENAL_ML_URL = renalPortTools.renalOrigin(selected);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
// The full-stack launcher selects a loopback port before Vite starts. Add just
// those two local origins after reading .env so a configured CORS list remains
// intact even when Windows reserves the usual frontend port.
if (env.GOVCARE_FRONTEND_PORT) {
  const port = Number(env.GOVCARE_FRONTEND_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error("GOVCARE_FRONTEND_PORT must be a number from 1 to 65535.");
    process.exit(1);
  }
  const origins = new Set((env.CORS_ORIGIN || "http://127.0.0.1:5300,http://localhost:5300,http://127.0.0.1:5173,http://localhost:5173")
    .split(",").map((origin) => origin.trim()).filter(Boolean));
  origins.add(`http://127.0.0.1:${port}`);
  origins.add(`http://localhost:${port}`);
  env.CORS_ORIGIN = [...origins].join(",");
}
// Always rebuild: extracted/copied projects can retain stale target/classes and
// Maven incremental-compiler metadata from a different source version.
const goals = mode === "build" ? ["clean", "package", "-DskipTests"] : ["clean", "spring-boot:run"];

// Windows batch files need cmd.exe. Only fixed goals above enter this command;
// paths and .env values are passed through cwd/env, not shell interpolation.
// Invoking cmd explicitly avoids Node's shell:true + args deprecation (DEP0190).
const command = isWindows ? (process.env.ComSpec || "cmd.exe") : "/bin/sh";
const args = isWindows
  ? ["/d", "/s", "/c", `mvnw.cmd ${goals.join(" ")}`]
  : ["./mvnw", ...goals];
console.log(`[GovCare] Maven: ${goals.join(" ")}`);
const child = spawn(command, args, {
  cwd: project,
  stdio: "inherit",
  shell: false,
  windowsVerbatimArguments: isWindows,
  env,
});
let launchFailed = false;
child.once("error", (error) => {
  launchFailed = true;
  console.error(`[GovCare] Unable to start Maven: ${error.message}`);
  console.error("Check the spring-api folder, Java 21, and Apache Maven 3.9+ in PATH.");
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}
child.once("close", (code, signal) => {
  const signalCode = signal === "SIGINT" ? 130 : signal === "SIGTERM" ? 143 : 1;
  process.exitCode = launchFailed ? 1 : (code ?? signalCode);
});
