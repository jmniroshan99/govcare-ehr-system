const assert = require('node:assert/strict');
const {spawn, spawnSync} = require('node:child_process');
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const {setTimeout: delay} = require('node:timers/promises');
const test = require('node:test');
const {selectRenalPort} = require('./renal-port.cjs');

const sourceRoot = path.resolve(__dirname, '..');
const python = process.env.GOVCARE_RENAL_PYTHON || path.join(sourceRoot, 'ML_Server', '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');

test('real Django starts on the coordinated fallback, serves health, and retains service authentication', {
  skip: !fs.existsSync(python) && 'Prepare ML_Server/.venv or set GOVCARE_RENAL_PYTHON to run the live service check.',
  timeout: 30000,
}, async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'govcare live renal '));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'scripts'));
  for (const file of ['run-renal-ml.cjs', 'renal-port.cjs']) fs.copyFileSync(path.join(__dirname, file), path.join(root, 'scripts', file));
  fs.cpSync(path.join(sourceRoot, 'ML_Server'), path.join(root, 'ML_Server'), {
    recursive: true, filter: source => !['.venv', '.env', '__pycache__'].includes(path.basename(source)),
  });
  for (const dir of ['preprocessing', 'explainability', 'artifacts']) {
    fs.cpSync(path.join(sourceRoot, 'ml-training', dir), path.join(root, 'ml-training', dir), {
      recursive: true, filter: source => path.basename(source) !== '__pycache__',
    });
  }
  fs.copyFileSync(path.join(sourceRoot, 'ml-training', 'serving_input_contract.json'), path.join(root, 'ml-training', 'serving_input_contract.json'));
  const occupied = net.createServer();
  await new Promise(resolve => occupied.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => occupied.close(resolve)));
  const busyPort = occupied.address().port;
  const secret = crypto.randomBytes(48).toString('hex');
  fs.writeFileSync(path.join(root, 'ML_Server', '.env'), `GOVCARE_RENAL_JWT_SECRET=${secret}\nGOVCARE_RENAL_ML_PORT=${busyPort}\n`, {mode: 0o600});
  const env = {...process.env, GOVCARE_RENAL_PYTHON: python, GOVCARE_RENAL_ML_PORT: '', GOVCARE_RENAL_ML_URL: '', PYTHONUNBUFFERED: '1'};
  const failed = spawnSync(process.execPath, [path.join(root, 'scripts', 'run-renal-ml.cjs')], {cwd: root, env, encoding: 'utf8', timeout: 10000});
  assert.ifError(failed.error);
  assert.equal(failed.status, 1);
  assert.match(failed.stderr, /EADDRINUSE/);
  const selected = await selectRenalPort({root, env});
  assert.notEqual(selected, busyPort);
  env.GOVCARE_RENAL_ML_PORT = String(selected);
  const child = spawn(process.execPath, [path.join(root, 'scripts', 'run-renal-ml.cjs')], {cwd: root, env, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe']});
  let output = '';
  let closed = false;
  child.stdout.on('data', chunk => {output += chunk;});
  child.stderr.on('data', chunk => {output += chunk;});
  const exited = new Promise(resolve => child.once('close', code => {closed = true; resolve(code);}));
  t.after(async () => {
    if (!closed) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], {stdio: 'ignore', timeout: 5000});
      else {try {process.kill(-child.pid, 'SIGTERM');} catch (error) {if (error.code !== 'ESRCH') throw error;}}
      await Promise.race([exited, delay(5000, undefined, {ref: false})]);
    }
  });
  const origin = `http://127.0.0.1:${selected}`;
  let health;
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline && !closed) {
    try {
      const response = await fetch(`${origin}/health/`, {signal: AbortSignal.timeout(500)});
      if (response.ok) {health = await response.json(); break;}
    } catch {}
    await delay(100);
  }
  assert.ok(health, `Django did not become healthy. Service output: ${output}`);
  assert.equal(health.status, 'ready');
  assert.equal(health.authentication_configured, true);
  assert.equal(health.clinical_prediction_ready, false);
  const denied = await fetch(`${origin}/api/ml/models/`);
  assert.equal(denied.status, 401);
  assert.deepEqual(await denied.json(), {error: 'AUTHENTICATION_REQUIRED'});
  assert.ok(!output.includes(secret));
  assert.equal(occupied.listening, true);
});
