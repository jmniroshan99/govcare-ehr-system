const fs = require('node:fs');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {HOST, loadEnvFile, selectRenalPort, renalOrigin} = require('./renal-port.cjs');

const root = path.resolve(__dirname, '..');
const mlRoot = path.join(root, 'ML_Server');

async function main() {
  const compatible = path.join(root, '.venv-cdss312', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
  const python = process.env.GOVCARE_RENAL_PYTHON || (fs.existsSync(compatible) ? compatible : path.join(mlRoot, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python'));
  if (!fs.existsSync(python)) throw new Error('Renal Python environment missing. Follow RUN_SRI_LANKAN_RENAL.md or set GOVCARE_RENAL_PYTHON to an absolute Python path.');
  const envPath = path.join(mlRoot, '.env');
  if (!fs.existsSync(envPath)) throw new Error('ML_Server/.env is missing. Run npm run renal:configure or setup-renal-ml-windows.bat first.');
  const env = loadEnvFile(envPath, process.env);
  const secret = env.GOVCARE_RENAL_JWT_SECRET || '';
  if (Buffer.byteLength(secret, 'utf8') < 32) throw new Error('GOVCARE_RENAL_JWT_SECRET must be configured in ML_Server/.env with at least 32 UTF-8 bytes.');
  const port = await selectRenalPort({root, env: process.env, allowFallback: false});
  console.log(`[Renal ML] Starting on ${renalOrigin(port)}`);
  const child = spawn(python, ['manage.py', 'runserver', `${HOST}:${port}`, '--noreload'], {
    cwd: mlRoot,
    stdio: 'inherit',
    env: {...env, GOVCARE_RENAL_ML_PORT: String(port), GOVCARE_RENAL_ML_URL: renalOrigin(port), OPENBLAS_NUM_THREADS: '1', OMP_NUM_THREADS: '1'},
  });
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
  child.once('error', error => {console.error(error.message); process.exitCode = 1;});
  child.once('close', (code, signal) => {process.exitCode = code ?? (signal === 'SIGINT' ? 130 : 1);});
}

if (require.main === module) main().catch(error => {
  console.error(`[Renal ML] ${error.message}`);
  process.exitCode = 1;
});
module.exports = { loadEnvFile };
