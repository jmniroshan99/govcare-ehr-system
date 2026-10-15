const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { selectFrontendPort } = require("./frontend-port.cjs");

test("skips an occupied port and selects a bindable fallback", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const occupied = server.address().port;
    const selected = await selectFrontendPort(undefined, [occupied, 0]);
    assert.notEqual(selected, occupied);
    assert.ok(selected > 0 && selected <= 65535);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("explicit unavailable port fails instead of silently opening a different URL", async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    await assert.rejects(selectFrontendPort(String(server.address().port)), /No frontend port could be opened/);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("full-stack launcher passes the same port to Vite and the API", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "govcare-full-stack-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "node_modules", "concurrently"), { recursive: true });
  for (const file of ["frontend-port.cjs", "api-port.cjs", "run-full-stack.cjs"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(root, "scripts", file));
  }
  const bin = path.join(root, "node_modules", "concurrently");
  fs.writeFileSync(path.join(bin, "package.json"), JSON.stringify({ bin: { concurrently: "cli.cjs" } }));
  fs.writeFileSync(path.join(bin, "cli.cjs"), `
    require("node:fs").writeFileSync(process.env.GOVCARE_TEST_CAPTURE, JSON.stringify({
      port: process.env.GOVCARE_FRONTEND_PORT, args: process.argv.slice(2)
    }));
  `);
  const port = await selectFrontendPort(undefined, [0]);
  const capture = path.join(root, "capture.json");
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "run-full-stack.cjs")], {
    cwd: root,
    env: { ...process.env, GOVCARE_FRONTEND_PORT: String(port), GOVCARE_TEST_CAPTURE: capture },
    encoding: "utf8",
    timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const launched = JSON.parse(fs.readFileSync(capture, "utf8"));
  assert.equal(launched.port, String(port));
  assert.ok(launched.args.includes(`npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`));
  assert.ok(launched.args.includes("npm run spring:api"));
  assert.match(result.stdout, new RegExp(`127\\.0\\.0\\.1:${port}`));
});

test("an occupied configured API port gets a fallback shared with the frontend", async (t) => {
  const occupied = net.createServer();
  await new Promise((resolve) => occupied.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => occupied.close(resolve)));
  const occupiedPort = occupied.address().port;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "govcare-api-collision-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.mkdirSync(path.join(root, "spring-api"));
  fs.writeFileSync(path.join(root, "spring-api", ".env"), `PORT=${occupiedPort}\n`);
  const bin = path.join(root, "node_modules", "concurrently");
  fs.mkdirSync(bin, { recursive: true });
  for (const file of ["frontend-port.cjs", "api-port.cjs", "run-full-stack.cjs"]) {
    fs.copyFileSync(path.join(__dirname, file), path.join(root, "scripts", file));
  }
  fs.writeFileSync(path.join(bin, "package.json"), JSON.stringify({ bin: { concurrently: "cli.cjs" } }));
  fs.writeFileSync(path.join(bin, "cli.cjs"), `
    require("node:fs").writeFileSync(process.env.GOVCARE_TEST_CAPTURE, JSON.stringify({
      apiPort: process.env.GOVCARE_API_PORT, apiBase: process.env.VITE_API_BASE_URL,
      frontendPort: process.env.GOVCARE_FRONTEND_PORT
    }));
  `);
  const capture = path.join(root, "capture.json");
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "run-full-stack.cjs")], {
    cwd: root,
    env: { ...process.env, GOVCARE_API_PORT: "", SERVER_PORT: "", GOVCARE_FRONTEND_PORT: "", GOVCARE_TEST_CAPTURE: capture },
    encoding: "utf8", timeout: 10000,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const launched = JSON.parse(fs.readFileSync(capture, "utf8"));
  const selected = Number(launched.apiPort);
  assert.ok(Number.isInteger(selected) && selected > 0, "Launcher must select and share an available API port.");
  assert.notEqual(selected, occupiedPort);
  assert.notEqual(selected, Number(launched.frontendPort));
  assert.equal(launched.apiBase, `http://127.0.0.1:${selected}`);
  assert.ok(result.stdout.includes(`[GovCare] Spring API: ${launched.apiBase}`));
  assert.equal(occupied.listening, true, "The existing listener must be left running.");
});
