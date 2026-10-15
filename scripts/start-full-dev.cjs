const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { HOST, selectFrontendPort } = require("./frontend-port.cjs");
const { selectApiPort } = require("./api-port.cjs");

const root = path.resolve(__dirname, "..");
const logsDir = path.join(root, "logs");
fs.mkdirSync(logsDir, { recursive: true });

function logFile(name) {
  return fs.openSync(path.join(logsDir, name), "a");
}

function startProcess(label, command, args, cwd = root, env = process.env) {
  const out = logFile(`${label}.out.log`);
  const err = logFile(`${label}.err.log`);
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
    env: {
      ...env,
      BROWSER: "none",
    },
  });
  child.unref();
  console.log(`${label} started with PID ${child.pid}. Logs: logs/${label}.out.log`);
}

async function waitFor(url, label, timeoutMs = 30000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${label} is ready: ${url}`);
        return true;
      }
    } catch {
      // Retry until timeout.
    }
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  console.warn(`${label} did not respond within ${Math.round(timeoutMs / 1000)} seconds. Check logs/ for details.`);
  return false;
}

function openBrowser(url) {
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], { detached: true, stdio: "ignore", windowsHide: true }).unref();
    return;
  }
  const opener = process.platform === "darwin" ? "open" : "xdg-open";
  spawn(opener, [url], { detached: true, stdio: "ignore" }).unref();
}

async function main() {
  const port = await selectFrontendPort();
  const apiPort = await selectApiPort({ root, exclude: [port] });
  const origin = `http://${HOST}:${port}`;
  const apiOrigin = `http://${HOST}:${apiPort}`;
  const frontendUrl = `${origin}/login`;
  const backendEnv = { ...process.env, GOVCARE_FRONTEND_PORT: String(port), GOVCARE_API_PORT: String(apiPort), VITE_API_BASE_URL: apiOrigin };
  console.log(`Frontend: ${origin}`);
  console.log(`Spring API: ${apiOrigin}`);
  if (process.platform === "win32") {
    startProcess("spring-api", "cmd.exe", ["/c", "npm run spring:api"], root, backendEnv);
    startProcess("frontend", "cmd.exe", ["/c", `npm run dev -- --host ${HOST} --port ${port} --strictPort`], root, backendEnv);
  } else {
    const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
    startProcess("spring-api", "npm", ["run", "spring:api"], root, backendEnv);
    startProcess("frontend", process.execPath, [viteBin, "--host", HOST, "--port", String(port), "--strictPort"], root, backendEnv);
  }

  const apiReady = await waitFor(`${apiOrigin}/health`, "Spring Boot API");
  if (!apiReady) {
    console.error("The frontend may load, but login/data requests will fail until PostgreSQL and the Spring API are running.");
  }
  const frontendReady = await waitFor(origin, "Frontend");
  if (frontendReady) openBrowser(frontendUrl);

  console.log("GovCare local stack requested. To stop the services, close them from Task Manager or stop the Node.js and Java processes started for this project.");
  windowlessExit();
}

function windowlessExit() {
  setTimeout(() => process.exit(0), 250);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
