const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {HOST, selectFrontendPort} = require('./frontend-port.cjs');
const {selectApiPort} = require('./api-port.cjs');
const {selectRenalPort, renalOrigin} = require('./renal-port.cjs');
const root = path.resolve(__dirname, '..');

async function main() {
  const manifest = path.join(root, 'node_modules', 'concurrently', 'package.json');
  if (!fs.existsSync(manifest)) throw new Error('Run npm ci first.');
  const bin = JSON.parse(fs.readFileSync(manifest, 'utf8')).bin;
  const cli = path.resolve(path.dirname(manifest), typeof bin === 'string' ? bin : bin.concurrently);
  // Choose all three ports before launching any service. The existing inner
  // frontend/API launcher verifies these exact choices again before it starts.
  const frontendPort = await selectFrontendPort();
  const apiPort = await selectApiPort({root, exclude: [frontendPort]});
  const mlPort = await selectRenalPort({root, exclude: [frontendPort, apiPort], onUnavailable: (port, reason) => {
    console.log(`[GovCare] Renal ML port ${port || 'automatic'} unavailable (${reason}).`);
  }});
  const env = {
    ...process.env,
    GOVCARE_FRONTEND_PORT: String(frontendPort), GOVCARE_API_PORT: String(apiPort),
    VITE_API_BASE_URL: `http://${HOST}:${apiPort}`,
    GOVCARE_RENAL_ML_PORT: String(mlPort), GOVCARE_RENAL_ML_URL: renalOrigin(mlPort),
  };
  console.log(`[GovCare] Renal ML: ${env.GOVCARE_RENAL_ML_URL} (available local port)`);
  console.log(`[GovCare] Renal ML health: ${env.GOVCARE_RENAL_ML_URL}/health/`);
  const child = spawn(process.execPath, [cli, '-k', '-n', 'GOVCARE,RENAL_ML', '-c', 'cyan,magenta', 'npm run dev:full', 'npm run renal:ml'], {cwd: root, stdio: 'inherit', env});
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.once('error', error => {console.error(error.message); process.exitCode = 1;});
  child.once('close', (code, signal) => {process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);});
}

main().catch(error => {
  console.error(`[GovCare] ${error.message}`);
  process.exitCode = 1;
});
