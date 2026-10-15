const assert = require("node:assert/strict");
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { selectApiPort, validateApiPort } = require("./api-port.cjs");

async function listener(t) {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => server.listening ? new Promise((resolve) => server.close(resolve)) : undefined);
  return server;
}

function project(t, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "govcare-api-port-"));
  fs.mkdirSync(path.join(root, "spring-api"));
  fs.writeFileSync(path.join(root, "spring-api", ".env"), config);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("API wildcard probe detects an existing loopback listener and chooses a fallback", async (t) => {
  const server = await listener(t);
  const selected = await selectApiPort({ env: {}, candidates: [server.address().port, 0] });
  assert.notEqual(selected, server.address().port);
  assert.ok(selected > 0 && selected <= 65535);
  assert.equal(server.listening, true);
});

test("an explicitly requested occupied API port fails without reusing or stopping its owner", async (t) => {
  const server = await listener(t);
  await assert.rejects(selectApiPort({ env: { GOVCARE_API_PORT: String(server.address().port) }, candidates: [0] }), /No Spring API port could be opened/);
  assert.equal(server.listening, true);
});

test("API selection excludes the frontend port", async (t) => {
  const server = await listener(t);
  const frontend = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const selected = await selectApiPort({ env: {}, candidates: [frontend, 0], exclude: [frontend] });
  assert.notEqual(selected, frontend);
});

test("configured backend PORT is preferred when available", async (t) => {
  const server = await listener(t);
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const root = project(t, `PORT=${port}\n`);
  assert.equal(await selectApiPort({ root, env: { PORT: "4002" } }), port);
});

test("Spring SERVER_PORT takes precedence over its PORT placeholder", async (t) => {
  const server = await listener(t);
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const root = project(t, `PORT=4002\nSERVER_PORT="${port}"\n`);
  assert.equal(await selectApiPort({ root, env: {} }), port);
});

test("explicit API selection overrides a different backend configuration", async (t) => {
  const server = await listener(t);
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  const root = project(t, "PORT=4002\nSERVER_PORT=4002\n");
  assert.equal(await selectApiPort({ root, env: { GOVCARE_API_PORT: String(port) } }), port);
});

test("invalid API port values fail validation before launching anything", () => {
  for (const value of ["0", "65536", "-1", "3.5", "not-a-port", "4003;other-command"]) {
    assert.throws(() => validateApiPort(value), /API port must be/);
  }
});
