import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function localDatabaseConfig(environment) {
  const connection = new URL((environment.DB_URL || "jdbc:postgresql://localhost:5432/govcare_ehr_v2").replace(/^jdbc:/, ""));
  if (connection.protocol !== "postgresql:" || !["localhost", "127.0.0.1", "[::1]"].includes(connection.hostname)) {
    throw new Error("Local role accounts require a PostgreSQL database on localhost.");
  }
  if (connection.username || connection.password || connection.search || connection.hash) {
    throw new Error("Use DB_USERNAME and DB_PASSWORD separately; DB_URL must contain only the local host, port and database.");
  }
  const database = decodeURIComponent(connection.pathname.slice(1));
  if (!database || database.includes("/")) throw new Error("A local database name is required.");
  return { host: connection.hostname.replace(/^\[|\]$/g, ""), port: connection.port || "5432", database,
    user: environment.DB_USERNAME || "postgres", password: environment.DB_PASSWORD };
}

function psqlExecutable(environment) {
  if (environment.GOVCARE_PSQL_PATH) return environment.GOVCARE_PSQL_PATH;
  if (process.platform !== "win32") return "psql";
  const base = join(environment.ProgramFiles || "C:\\Program Files", "PostgreSQL");
  if (existsSync(base)) {
    const versions = readdirSync(base).sort((a,b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) {
      const path = join(base, version, "bin", "psql.exe");
      if (existsSync(path)) return path;
    }
  }
  return "psql.exe";
}

export function runProvisioning() {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const environment = { ...process.env };
  const envPath = join(root, "spring-api", ".env");
  if (existsSync(envPath)) {
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && environment[match[1]] === undefined) environment[match[1]] = match[2].replace(/^(["'])(.*)\1$/, "$2");
    }
  }
  const config = localDatabaseConfig(environment);
  const sqlFile = join(root, "database", "postgresql", "local-role-accounts.sql");
  const args = ["-X", "-v", "ON_ERROR_STOP=1", "-v", "allow_local_accounts=true", "-h", config.host,
    "-p", config.port, "-U", config.user, "-d", config.database,
    "-v", `hospital_code=${environment.GOVCARE_LOCAL_HOSPITAL_CODE || "NHSL"}`,
    "-v", `patient_no=${environment.GOVCARE_LOCAL_PATIENT_NO || ""}`,
    "-v", `ward_department_code=${environment.GOVCARE_LOCAL_WARD_DEPARTMENT || ""}`, "-f", sqlFile];
  console.log(`Creating local test accounts in ${config.host}:${config.port}/${config.database}. Existing accounts are kept.`);
  const result = spawnSync(psqlExecutable(environment), args, {
    stdio: "inherit", shell: false,
    env: { ...environment, ...(config.password !== undefined ? { PGPASSWORD: config.password } : {}) },
  });
  if (result.error) throw new Error(`PostgreSQL command-line tools are required: ${result.error.message}`);
  if (result.status !== 0) throw new Error("Account setup failed. Check the PostgreSQL output above; the transaction was rolled back.");
  console.log("Usernames and initial passwords: LOCAL_ROLE_CREDENTIALS.md. Change the temporary password on first login.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { runProvisioning(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
