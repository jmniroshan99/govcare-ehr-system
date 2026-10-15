const assert = require('node:assert/strict');
const {spawnSync} = require('node:child_process');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

function fixture(t, config) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'govcare renal stack '));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.mkdirSync(path.join(root, 'spring-api'));
  fs.mkdirSync(path.join(root, 'ML_Server'));
  fs.writeFileSync(path.join(root, 'spring-api', '.env'), config);
  for (const file of ['run-renal-stack.cjs', 'frontend-port.cjs', 'api-port.cjs', 'renal-port.cjs']) {
    fs.copyFileSync(path.join(__dirname, file), path.join(root, 'scripts', file));
  }
  const bin = path.join(root, 'node_modules', 'concurrently');
  fs.mkdirSync(bin, {recursive: true});
  fs.writeFileSync(path.join(bin, 'package.json'), JSON.stringify({bin: {concurrently: 'cli.cjs'}}));
  fs.writeFileSync(path.join(bin, 'cli.cjs'), `
    require('node:fs').writeFileSync(process.env.GOVCARE_TEST_CAPTURE, JSON.stringify({
      args: process.argv.slice(2), port: process.env.GOVCARE_RENAL_ML_PORT,
      url: process.env.GOVCARE_RENAL_ML_URL, frontend: process.env.GOVCARE_FRONTEND_PORT,
      api: process.env.GOVCARE_API_PORT, apiUrl: process.env.VITE_API_BASE_URL
    }));
  `);
  const capture = path.join(root, 'capture.json');
  const env = {...process.env, GOVCARE_FRONTEND_PORT: '', GOVCARE_API_PORT: '', GOVCARE_RENAL_ML_PORT: '', GOVCARE_RENAL_ML_URL: '', GOVCARE_TEST_CAPTURE: capture};
  return {
    root, env, capture,
    run() {return spawnSync(process.execPath, [path.join(root, 'scripts', 'run-renal-stack.cjs')], {cwd: os.tmpdir(), env, encoding: 'utf8', timeout: 10000});},
  };
}

test('combined launcher skips an occupied ML port and shares one address with both child services', async t => {
  const busy = net.createServer();
  await new Promise(resolve => busy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => busy.close(resolve)));
  const occupiedPort = busy.address().port;
  const f = fixture(t, `GOVCARE_RENAL_ML_URL=http://127.0.0.1:${occupiedPort}\n`);
  const result = f.run();
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const child = JSON.parse(fs.readFileSync(f.capture, 'utf8'));
  const selected = Number(child.port);
  assert.ok(Number.isInteger(selected) && selected > 0 && selected <= 65535, 'The launcher must select and share a usable ML port.');
  assert.notEqual(selected, occupiedPort);
  assert.notEqual(selected, Number(child.frontend));
  assert.notEqual(selected, Number(child.api));
  assert.equal(child.url, `http://127.0.0.1:${selected}`);
  assert.equal(child.apiUrl, `http://127.0.0.1:${child.api}`);
  assert.ok(child.args.includes('npm run dev:full'));
  assert.ok(child.args.includes('npm run renal:ml'));
  assert.ok(result.stdout.includes(`[GovCare] Renal ML: ${child.url}`));
  assert.equal(busy.listening, true, 'The existing service must remain running.');
});

test('a pinned occupied ML port fails before starting frontend, Spring or Django', async t => {
  const busy = net.createServer();
  await new Promise(resolve => busy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => busy.close(resolve)));
  const f = fixture(t, 'GOVCARE_RENAL_ML_URL=http://127.0.0.1:8001\n');
  f.env.GOVCARE_RENAL_ML_PORT = String(busy.address().port);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /No Renal ML port could be opened/);
  assert.match(result.stderr, /EADDRINUSE/);
  assert.equal(fs.existsSync(f.capture), false);
  assert.equal(busy.listening, true);
});
