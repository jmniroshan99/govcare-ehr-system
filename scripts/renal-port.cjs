const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');

const HOST = '127.0.0.1';
const DEFAULT_PORTS = [8001, 8002, 8003, 8011, 18001, 0];

function loadEnvFile(file, base = process.env) {
  const env = {...base};
  if (!fs.existsSync(file)) return env;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const index = line.indexOf('=');
    if (index <= 0) continue;
    const key = line.slice(0, index).trim();
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) continue;
    const value = line.slice(index + 1).trim();
    env[key] = value.replace(/^(["'])(.*)\1$/, '$2');
  }
  return env;
}

function validateRenalPort(value) {
  if (!/^\d+$/.test(String(value ?? ''))) throw new Error('GOVCARE_RENAL_ML_PORT must be a number from 1 to 65535.');
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('GOVCARE_RENAL_ML_PORT must be a number from 1 to 65535.');
  return port;
}

function renalOrigin(port) {
  return `http://${HOST}:${validateRenalPort(port)}`;
}

function configuredRenalPort(root, env) {
  const ml = loadEnvFile(path.join(root, 'ML_Server', '.env'), {});
  if (ml.GOVCARE_RENAL_ML_PORT) return validateRenalPort(ml.GOVCARE_RENAL_ML_PORT);
  const spring = loadEnvFile(path.join(root, 'spring-api', '.env'), env);
  let url;
  try { url = new URL(spring.GOVCARE_RENAL_ML_URL || renalOrigin(8001)); } catch {
    throw new Error('GOVCARE_RENAL_ML_URL is invalid. Use a local HTTP base URL for npm run dev:renal.');
  }
  if (url.protocol !== 'http:' || ![HOST, 'localhost'].includes(url.hostname) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('The local renal launcher requires a loopback HTTP ML base URL. Use npm run dev:full for a separately hosted ML service, or set GOVCARE_RENAL_ML_PORT for this local stack.');
  }
  return validateRenalPort(url.port || 80);
}

function probeRenalPort(port) {
  return new Promise(resolve => {
    const server = net.createServer();
    server.once('error', error => resolve({error: error.code || error.message}));
    // Probe the same IPv4 loopback address used by Django, including Windows
    // permission errors on reserved ports. Never connect to or kill the owner.
    server.listen({host: HOST, port, exclusive: true}, () => {
      const selected = server.address().port;
      server.close(error => resolve(error ? {error: error.code || error.message} : {port: selected}));
    });
  });
}

async function selectRenalPort({root = path.resolve(__dirname, '..'), env = process.env, candidates, exclude = [], allowFallback = true, probePort = probeRenalPort, onUnavailable = () => {}} = {}) {
  const requested = env.GOVCARE_RENAL_ML_PORT;
  const explicit = requested !== undefined && requested !== '';
  const preferred = explicit ? [validateRenalPort(requested)] : candidates ?? [configuredRenalPort(root, env), ...DEFAULT_PORTS];
  // A standalone ML start cannot update an already running Spring process.
  // Only the combined launcher may switch to another port automatically.
  const ports = explicit || allowFallback ? preferred : preferred.slice(0, 1);
  const skipped = new Set(exclude.map(Number));
  const failures = [];
  for (const value of new Set(ports)) {
    const port = value === 0 ? 0 : validateRenalPort(value);
    const result = skipped.has(port) ? {error: 'reserved for another GovCare service'} : await probePort(port);
    if (result.port && !skipped.has(result.port)) return result.port;
    const reason = result.error || 'reserved for another GovCare service';
    failures.push(`${port || 'automatic'}: ${reason}`);
    onUnavailable(port, reason);
  }
  throw new Error(`No Renal ML port could be opened on ${HOST} (${failures.join(', ')}). Choose a free GOVCARE_RENAL_ML_PORT, or unset it and use npm run dev:renal for coordinated automatic selection. Existing processes were left running.`);
}

module.exports = {HOST, loadEnvFile, validateRenalPort, renalOrigin, configuredRenalPort, probeRenalPort, selectRenalPort};
