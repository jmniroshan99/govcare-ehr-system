const { spawn } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { HOST, selectFrontendPort } = require("./frontend-port.cjs");
const { selectApiPort } = require("./api-port.cjs");

const root = path.resolve(__dirname, "..");

async function main() {
  const port = await selectFrontendPort();
  const apiPort = await selectApiPort({ root, exclude: [port] });
  const origin = `http://${HOST}:${port}`;
  const apiOrigin = `http://${HOST}:${apiPort}`;
  const manifest = path.join(root, "node_modules", "concurrently", "package.json");
  if (!fs.existsSync(manifest)) {
    throw new Error("Dependencies are missing. Run npm install before npm run dev:full.");
  }
  const bin = JSON.parse(fs.readFileSync(manifest, "utf8")).bin;
  const executable = path.resolve(path.dirname(manifest), typeof bin === "string" ? bin : bin.concurrently);
  console.log(`[GovCare] Frontend: ${origin} (available local port)`);
  console.log(`[GovCare] Spring API: ${apiOrigin}`);
  console.log("[GovCare] Press Ctrl+C to stop both services.");
  const child = spawn(process.execPath, [
    executable, "-k", "-n", "FRONTEND,SPRING_API", "-c", "cyan,green",
    `npm run dev -- --host ${HOST} --port ${port} --strictPort`,
    "npm run spring:api",
  ], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, GOVCARE_FRONTEND_PORT: String(port), GOVCARE_API_PORT: String(apiPort), VITE_API_BASE_URL: apiOrigin },
  });
  child.once("error", (error) => {
    console.error(`[GovCare] Could not start services: ${error.message}`);
    process.exitCode = 1;
  });
  child.once("close", (code, signal) => {
    process.exitCode = code ?? (signal === "SIGINT" ? 130 : 1);
  });
}

main().catch((error) => {
  console.error(`[GovCare] ${error.message}`);
  process.exitCode = 1;
});
