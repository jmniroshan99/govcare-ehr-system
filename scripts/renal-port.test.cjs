const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const {configuredRenalPort, probeRenalPort, selectRenalPort, validateRenalPort} = require('./renal-port.cjs');

function project(t, spring = '', ml = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'govcare-ml-port-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  for (const [dir, text] of [['spring-api', spring], ['ML_Server', ml]]) {
    fs.mkdirSync(path.join(root, dir));
    fs.writeFileSync(path.join(root, dir, '.env'), text);
  }
  return root;
}

test('default and configured local ML addresses provide the preferred port', t => {
  assert.equal(configuredRenalPort(project(t), {}), 8001);
  assert.equal(configuredRenalPort(project(t, 'GOVCARE_RENAL_ML_URL="http://localhost:18001/"\r\n'), {}), 18001);
  assert.equal(configuredRenalPort(project(t), {GOVCARE_RENAL_ML_URL: 'http://127.0.0.1:18002'}), 18002);
});

test('local port preference and Spring .env precedence are consistent with the child launchers', t => {
  const root = project(t, 'GOVCARE_RENAL_ML_URL=http://127.0.0.1:18001\n');
  assert.equal(configuredRenalPort(root, {GOVCARE_RENAL_ML_URL: 'http://127.0.0.1:18002'}), 18001);
  const preferred = project(t, 'GOVCARE_RENAL_ML_URL=http://127.0.0.1:18001\n', 'GOVCARE_RENAL_ML_PORT="18003"\n');
  assert.equal(configuredRenalPort(preferred, {}), 18003);
});

test('the local launcher rejects remote or invalid ML URLs without echoing their contents', t => {
  for (const url of ['not a URL', 'https://localhost:8001', 'http://ml.internal:8001', 'http://user:private-value@localhost:8001', 'http://localhost:8001/api', 'http://localhost:8001/?secret=private-value']) {
    assert.throws(() => configuredRenalPort(project(t, `GOVCARE_RENAL_ML_URL=${url}\n`), {}), error => {
      assert.doesNotMatch(error.message, /private-value/);
      return /ML base URL|local HTTP/.test(error.message);
    });
  }
});

test('the real loopback probe detects an occupied ML port without stopping its owner', async t => {
  const busy = net.createServer();
  await new Promise(resolve => busy.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => busy.close(resolve)));
  const result = await probeRenalPort(busy.address().port);
  assert.equal(result.error, 'EADDRINUSE');
  const port = await selectRenalPort({env: {}, candidates: [busy.address().port, 0]});
  assert.notEqual(port, busy.address().port);
  assert.equal(busy.listening, true);
  const verification = net.createServer();
  await new Promise(resolve => verification.listen(port, '127.0.0.1', resolve));
  await new Promise(resolve => verification.close(resolve));
});

test('permission-denied and occupied defaults fall back to a permitted ML port', async () => {
  const attempts = [];
  const reasons = [];
  const port = await selectRenalPort({env: {}, candidates: [8001, 8002, 8003, 18001], probePort: async candidate => {
    attempts.push(candidate);
    const error = {8001: 'EACCES', 8002: 'EPERM', 8003: 'EADDRINUSE'}[candidate];
    return error ? {error} : {port: candidate};
  }, onUnavailable: (candidate, reason) => reasons.push([candidate, reason])});
  assert.equal(port, 18001);
  assert.deepEqual(attempts, [8001, 8002, 8003, 18001]);
  assert.deepEqual(reasons, [[8001, 'EACCES'], [8002, 'EPERM'], [8003, 'EADDRINUSE']]);
});

test('OS-selected port is used if all preferred defaults are blocked', async () => {
  const port = await selectRenalPort({env: {}, candidates: [8001, 8002, 0], probePort: async candidate => candidate === 0 ? {port: 49321} : {error: 'EACCES'}});
  assert.equal(port, 49321);
});

test('frontend and API ports are excluded even if they are otherwise available', async () => {
  const attempts = [];
  const port = await selectRenalPort({env: {}, candidates: [8001, 8002, 8003], exclude: [8001, 8002], probePort: async candidate => {
    attempts.push(candidate);
    return {port: candidate};
  }});
  assert.equal(port, 8003);
  assert.deepEqual(attempts, [8003]);
});

test('an explicit ML port overrides local preferences and is never silently changed', async t => {
  const root = project(t, 'GOVCARE_RENAL_ML_URL=http://127.0.0.1:8001\n', 'GOVCARE_RENAL_ML_PORT=8002\n');
  const attempts = [];
  const options = {root, env: {GOVCARE_RENAL_ML_PORT: '18001'}, candidates: [18002], probePort: async port => {
    attempts.push(port);
    return {error: 'EACCES'};
  }};
  await assert.rejects(selectRenalPort(options), /18001: EACCES/);
  assert.deepEqual(attempts, [18001]);
  assert.equal(await selectRenalPort({...options, probePort: async port => ({port})}), 18001);
});

test('standalone ML selection fails rather than leave a running Spring process pointing elsewhere', async () => {
  const attempts = [];
  await assert.rejects(selectRenalPort({env: {}, candidates: [8001, 8002], allowFallback: false, probePort: async port => {
    attempts.push(port);
    return {error: 'EACCES'};
  }}), /npm run dev:renal/);
  assert.deepEqual(attempts, [8001]);
});

test('a completely blocked range returns useful diagnostics', async () => {
  await assert.rejects(selectRenalPort({env: {}, candidates: [8001, 0], probePort: async () => ({error: 'EACCES'})}), /8001: EACCES, automatic: EACCES/);
});

test('invalid ML ports fail validation before any bind attempt', async () => {
  for (const value of ['', '0', '65536', '-1', '8.5', '8001;other', '8001$(command)', 'abc']) {
    assert.throws(() => validateRenalPort(value), /GOVCARE_RENAL_ML_PORT must be/);
  }
  await assert.rejects(selectRenalPort({env: {GOVCARE_RENAL_ML_PORT: 'invalid'}, probePort: async () => assert.fail('No socket should open.')}), /GOVCARE_RENAL_ML_PORT must be/);
});
