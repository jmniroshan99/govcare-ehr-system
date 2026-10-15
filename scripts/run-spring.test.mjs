import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const sourceRoot = fileURLToPath(new URL("../", import.meta.url));
const isWindows = process.platform === "win32";

// These exercise the real Node launcher and Maven wrapper. Only the external
// Maven executable is a fixture; no Java build or database is simulated as real.
function fixture(t) {
  const temp = mkdtempSync(join(tmpdir(), "govcare-startup-"));
  t.after(() => rmSync(temp, { recursive: true, force: true }));
  const root = join(temp, "JM PC (startup test)");
  const api = join(root, "spring-api");
  const bin = join(temp, "maven bin");
  mkdirSync(join(root, "scripts"), { recursive: true });
  mkdirSync(api);
  mkdirSync(bin);
  copyFileSync(join(sourceRoot, "scripts", "run-spring.mjs"), join(root, "scripts", "run-spring.mjs"));
  copyFileSync(join(sourceRoot, "scripts", "api-port.cjs"), join(root, "scripts", "api-port.cjs"));
  copyFileSync(join(sourceRoot, "scripts", "renal-port.cjs"), join(root, "scripts", "renal-port.cjs"));
  for (const name of ["mvnw", "mvnw.cmd"]) {
    writeFileSync(join(api, name), readFileSync(join(sourceRoot, "spring-api", name)), { mode: 0o755 });
  }
  const capture = join(temp, "maven-invocation.json");
  const program = join(bin, "maven-fixture.cjs");
  writeFileSync(program, `
    const fs = require("node:fs");
    fs.writeFileSync(process.env.GOVCARE_TEST_CAPTURE, JSON.stringify({
      args: process.argv.slice(2), cwd: process.cwd(),
      port: process.env.PORT, serverPort: process.env.SERVER_PORT, marker: process.env.GOVCARE_TEST_MARKER,
      cors: process.env.CORS_ORIGIN, renalUrl: process.env.GOVCARE_RENAL_ML_URL,
      renalPort: process.env.GOVCARE_RENAL_ML_PORT
    }));
    process.exit(Number(process.env.GOVCARE_TEST_EXIT || 0));
  `);
  writeFileSync(join(bin, isWindows ? "mvn.cmd" : "mvn"), isWindows
    ? '@echo off\r\n"%GOVCARE_TEST_NODE%" "%GOVCARE_TEST_FIXTURE%" %*\r\nexit /b %errorlevel%\r\n'
    : '#!/bin/sh\nexec "$GOVCARE_TEST_NODE" "$GOVCARE_TEST_FIXTURE" "$@"\n', { mode: 0o755 });
  const env = { ...process.env };
  // Keep just one PATH key on Windows, where environment keys ignore case.
  const pathKey = Object.keys(env).find((key) => key.toLowerCase() === "path") || "PATH";
  const inheritedPath = env[pathKey] || "";
  for (const key of Object.keys(env)) if (key.toLowerCase() === "path") delete env[key];
  Object.assign(env, {
    [pathKey]: `${bin}${delimiter}${inheritedPath}`,
    GOVCARE_TEST_NODE: process.execPath,
    GOVCARE_TEST_FIXTURE: program,
    GOVCARE_TEST_CAPTURE: capture,
    GOVCARE_TEST_EXIT: "0",
  });
  return {
    root, api, capture, env,
    run(mode = "run", options = {}) {
      return spawnSync(process.execPath, [join(root, "scripts", "run-spring.mjs"), mode], {
        cwd: root, env, encoding: "utf8", timeout: 10000, ...options,
      });
    },
    invocation() { return JSON.parse(readFileSync(capture, "utf8")); },
  };
}

function succeeded(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test("startup cleans stale Maven output before launching Spring Boot", (t) => {
  const f = fixture(t);
  const result = f.run();
  succeeded(result);
  assert.deepEqual(f.invocation().args, ["clean", "spring-boot:run"]);
  assert.equal(f.invocation().cwd, f.api);
  assert.doesNotMatch(result.stderr, /DEP0190/);
});

test("Maven failure reaches npm as the original nonzero exit code", (t) => {
  const f = fixture(t);
  f.env.GOVCARE_TEST_EXIT = "7";
  const result = f.run();
  assert.ifError(result.error);
  assert.equal(result.status, 7, result.stderr || result.stdout);
});

test("startup works when ZIP extraction loses the wrapper's executable bit", { skip: isWindows }, (t) => {
  const f = fixture(t);
  chmodSync(join(f.api, "mvnw"), 0o644);
  succeeded(f.run());
});

test("build mode retains clean package and skipTests behavior", (t) => {
  const f = fixture(t);
  succeeded(f.run("build"));
  assert.deepEqual(f.invocation().args, ["clean", "package", "-DskipTests"]);
});

test("launch from another directory still uses this project's backend and .env", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.api, ".env"), "# local config\r\nPORT=4002\r\nGOVCARE_TEST_MARKER=local=value\r\n");
  succeeded(f.run("run", { cwd: tmpdir() }));
  assert.equal(f.invocation().cwd, f.api);
  assert.equal(f.invocation().port, "4002");
  assert.equal(f.invocation().marker, "local=value");
});

test("full-stack port is appended to configured CORS origins after loading backend .env", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.api, ".env"), "CORS_ORIGIN=http://localhost:5300\n");
  f.env.GOVCARE_FRONTEND_PORT = "18080";
  succeeded(f.run());
  assert.deepEqual(f.invocation().cors.split(","), [
    "http://localhost:5300", "http://127.0.0.1:18080", "http://localhost:18080",
  ]);
});

test("selected API port survives backend .env overrides and keeps both Spring bindings aligned", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.api, ".env"), "PORT=4002\nSERVER_PORT=4002\nGOVCARE_API_PORT=4002\n");
  f.env.GOVCARE_API_PORT = "14002";
  succeeded(f.run());
  assert.equal(f.invocation().port, "14002");
  assert.equal(f.invocation().serverPort, "14002");
});

test("invalid selected API port fails before invoking Maven", (t) => {
  const f = fixture(t);
  f.env.GOVCARE_API_PORT = "4003;anything";
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /API port must be/);
  assert.equal(existsSync(f.capture), false);
});

test("selected renal ML address survives the backend .env and reaches Spring", (t) => {
  const f = fixture(t);
  writeFileSync(join(f.api, ".env"), "GOVCARE_RENAL_ML_URL=http://127.0.0.1:8001\nGOVCARE_RENAL_ML_PORT=8001\n");
  f.env.GOVCARE_RENAL_ML_PORT = "18001";
  succeeded(f.run());
  assert.equal(f.invocation().renalUrl, "http://127.0.0.1:18001");
  assert.equal(f.invocation().renalPort, "18001");
});

test("a separately started Spring API preserves its configured remote ML service", (t) => {
  const f = fixture(t);
  delete f.env.GOVCARE_RENAL_ML_PORT;
  writeFileSync(join(f.api, ".env"), "GOVCARE_RENAL_ML_URL=https://ml.internal.example\n");
  succeeded(f.run());
  assert.equal(f.invocation().renalUrl, "https://ml.internal.example");
});

test("invalid selected renal ML port fails before invoking Maven", (t) => {
  const f = fixture(t);
  f.env.GOVCARE_RENAL_ML_PORT = "8001;anything";
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /GOVCARE_RENAL_ML_PORT must be/);
  assert.equal(existsSync(f.capture), false);
});

test("an unknown mode fails before invoking Maven", (t) => {
  const f = fixture(t);
  const result = f.run("unknown");
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage:/);
  assert.equal(existsSync(f.capture), false);
});

test("missing Maven returns a readable error and a failure status", (t) => {
  const f = fixture(t);
  const pathKey = Object.keys(f.env).find((key) => key.toLowerCase() === "path");
  const system32 = join(process.env.SystemRoot || "C:\\Windows", "System32");
  const shellOnly = join(f.root, "shell-only");
  if (!isWindows) {
    mkdirSync(shellOnly);
    symlinkSync("/bin/sh", join(shellOnly, "sh"));
  }
  const result = f.run("run", {
    env: { ...f.env, [pathKey]: isWindows ? system32 : shellOnly },
  });
  assert.equal(result.status, 1);
  assert.match(result.stdout + result.stderr, /Maven is not installed/);
});

test("failure to spawn the launcher reports a controlled error", (t) => {
  const f = fixture(t);
  rmSync(f.api, { recursive: true });
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Unable to start Maven/);
  assert.doesNotMatch(result.stderr, /Unhandled 'error' event/);
});
