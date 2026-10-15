import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { localDatabaseConfig } from "./provision-local-role-accounts.mjs";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

export function demoEnvironment(environment = process.env, root = projectRoot) {
  const result = { ...environment };
  const envFile = join(root, "spring-api", ".env");
  if (existsSync(envFile)) {
    for (const line of readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && result[match[1]] === undefined) {
        result[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
      }
    }
  }
  return result;
}

export function findPsql(environment = process.env, platform = process.platform) {
  if (environment.GOVCARE_PSQL_PATH) return environment.GOVCARE_PSQL_PATH;
  if (platform === "win32") {
    const base = join(environment.ProgramFiles || "C:\\Program Files", "PostgreSQL");
    if (existsSync(base)) {
      for (const version of readdirSync(base).sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))) {
        const candidate = join(base, version, "bin", "psql.exe");
        if (existsSync(candidate)) return candidate;
      }
    }
  }
  return platform === "win32" ? "psql.exe" : "psql";
}

export function demoCommand(mode, environment = process.env, root = projectRoot) {
  if (!["seed", "verify"].includes(mode)) throw new Error("Use seed or verify mode.");
  const env = demoEnvironment(environment, root);
  if (env.NODE_ENV === "production" || /(^|[,\s])prod(uction)?([,\s]|$)/i.test(env.SPRING_PROFILES_ACTIVE || "")) {
    throw new Error("The demo dataset is for local development and QA. A production profile is not supported.");
  }
  const config = localDatabaseConfig(env);
  const args = ["-X", "--no-password", "-v", "ON_ERROR_STOP=1", "-h", config.host, "-p", config.port,
    "-U", config.user, "-d", config.database];
  if (mode === "seed") args.push("-c", "set govcare.allow_demo_seed = 'on'");
  args.push("-f", join(root, "database", "postgresql", mode === "seed" ? "seed-demo-network.sql" : "verify-demo-network.sql"));
  return { command: findPsql(env), args, cwd: root,
    env: { ...env, PGCLIENTENCODING: "UTF8", ...(config.password !== undefined ? { PGPASSWORD: config.password } : {}) }, config };
}

export function runDemo(mode = "seed") {
  const request = demoCommand(mode);
  console.log(`[GovCare] ${mode === "seed" ? "Loading" : "Checking"} demo network in ${request.config.host}:${request.config.port}/${request.config.database}.`);
  const result = spawnSync(request.command, request.args, { cwd: request.cwd, env: request.env, stdio: "inherit", shell: false });
  if (result.error) throw new Error(`PostgreSQL command-line tools are required. Set GOVCARE_PSQL_PATH if necessary: ${result.error.message}`);
  if (result.status !== 0) throw new Error(mode === "seed" ? "Demo setup failed and its transaction was rolled back. Read the PostgreSQL error above." : "Demo verification failed. Read the PostgreSQL error above.");
  if (mode === "seed") {
    console.log("Loaded 10 demo hospitals with 400 patients, 100 doctors and 100 wards each.");
    console.log("Initial logins: database/postgresql/demo-network-credentials.csv. Change the temporary password on first login.");
    console.log("Use a hospital's own admin or doctor login to view its records. Existing NHSL accounts keep their original hospital.");
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { runDemo(process.argv[2] ?? "seed"); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
