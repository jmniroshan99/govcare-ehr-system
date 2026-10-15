const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "govcare-renal-config-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "scripts"));
  fs.copyFileSync(path.join(__dirname, "configure-renal-local.cjs"), path.join(root, "scripts", "configure-renal-local.cjs"));
  for (const directory of ["spring-api", "ML_Server"]) {
    fs.mkdirSync(path.join(root, directory));
    fs.writeFileSync(path.join(root, directory, ".env.example"), "EXISTING_SETTING=preserve-me\nGOVCARE_RENAL_JWT_SECRET=\n");
  }
  const files = ["spring-api", "ML_Server"].map(directory => path.join(root, directory, ".env"));
  const run = () => spawnSync(process.execPath, [path.join(root, "scripts", "configure-renal-local.cjs")], { encoding: "utf8" });
  return { root, files, run };
}

test("renal setup creates matching dedicated secrets without printing them", t => {
  const { files, run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0);
  const contents = files.map(file => fs.readFileSync(file, "utf8"));
  const secrets = contents.map(text => text.match(/^GOVCARE_RENAL_JWT_SECRET=(.+)$/m)[1]);
  assert.equal(secrets[0], secrets[1]);
  assert.ok(Buffer.byteLength(secrets[0]) >= 32);
  for (const text of contents) assert.ok(text.includes("EXISTING_SETTING=preserve-me\n"));
  assert.ok(!(result.stdout + result.stderr).includes(secrets[0]));
  if (process.platform !== "win32") {
    for (const file of files) assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  }
});

test("repeated renal setup preserves existing configuration and credential bytes", t => {
  const { files, run } = fixture(t);
  assert.equal(run().status, 0);
  const before = files.map(file => fs.readFileSync(file));
  assert.equal(run().status, 0);
  assert.deepEqual(files.map(file => fs.readFileSync(file)), before);
});

test("mismatched existing renal credentials fail without overwriting either service", t => {
  const { files, run } = fixture(t);
  const secrets = [crypto.randomBytes(48).toString("hex"), crypto.randomBytes(48).toString("hex")];
  files.forEach((file, index) => fs.writeFileSync(file, `EXISTING_SETTING=preserve-me\nGOVCARE_RENAL_JWT_SECRET=${secrets[index]}\n`));
  const before = files.map(file => fs.readFileSync(file));
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /existing renal service secrets differ/);
  assert.deepEqual(files.map(file => fs.readFileSync(file)), before);
  for (const secret of secrets) assert.ok(!(result.stdout + result.stderr).includes(secret));
});
