const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { selectFrontendPort } = require('./frontend-port.cjs');
const { loadEnvFile } = require('./run-renal-ml.cjs');

test('renal ML launcher loads local .env without printing or dropping its service secret', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'govcare-renal-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, '# local only\nGOVCARE_RENAL_JWT_SECRET="abcdefghijklmnopqrstuvwxyz0123456789"\nRENAL_ML_ALLOWED_HOSTS=localhost,127.0.0.1\n');
  const env = loadEnvFile(file, {EXISTING: 'kept'});
  assert.equal(env.EXISTING, 'kept');
  assert.equal(env.GOVCARE_RENAL_JWT_SECRET, 'abcdefghijklmnopqrstuvwxyz0123456789');
  assert.equal(env.RENAL_ML_ALLOWED_HOSTS, 'localhost,127.0.0.1');
  fs.rmSync(dir, {recursive: true, force: true});
});

test('renal ML binds the selected loopback port after loading a stale local port', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'govcare-renal launcher '));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'ML_Server'));
  for (const file of ['run-renal-ml.cjs', 'renal-port.cjs']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(root, 'scripts', file));
  }
  const secret = 'test-only-renal-service-secret-0123456789';
  fs.writeFileSync(path.join(root, 'ML_Server', '.env'), `GOVCARE_RENAL_JWT_SECRET=${secret}\nGOVCARE_RENAL_ML_PORT=8001\n`);
  // Node stands in for the external Python executable and records its arguments.
  // This fixture tests the actual launcher, not a Django or inference response.
  fs.writeFileSync(path.join(root, 'ML_Server', 'manage.py'), `
    require('node:fs').writeFileSync(process.env.GOVCARE_TEST_CAPTURE, JSON.stringify({
      args: process.argv.slice(2), port: process.env.GOVCARE_RENAL_ML_PORT,
      url: process.env.GOVCARE_RENAL_ML_URL, secret: process.env.GOVCARE_RENAL_JWT_SECRET
    }));
  `);
  const port = await selectFrontendPort(undefined, [0]);
  const capture = path.join(root, 'capture.json');
  const result = spawnSync(process.execPath, [path.join(root, 'scripts', 'run-renal-ml.cjs')], {
    cwd: os.tmpdir(), encoding: 'utf8', timeout: 10000,
    env: {...process.env, GOVCARE_RENAL_PYTHON: process.execPath, GOVCARE_RENAL_ML_PORT: String(port), GOVCARE_TEST_CAPTURE: capture},
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const launched = JSON.parse(fs.readFileSync(capture, 'utf8'));
  assert.deepEqual(launched.args, ['runserver', `127.0.0.1:${port}`, '--noreload']);
  assert.equal(launched.port, String(port));
  assert.equal(launched.url, `http://127.0.0.1:${port}`);
  assert.equal(launched.secret, secret);
  assert.ok(!(result.stdout + result.stderr).includes(secret));
});
