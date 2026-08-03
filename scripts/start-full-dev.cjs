const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const logsDir = path.join(root, "logs");
fs.mkdirSync(logsDir, { recursive: true });

function logFile(name) {
  return fs.openSync(path.join(logsDir, name), "a");
}

function startProcess(label, command, args, cwd = root) {
  const out = logFile(`${label}.out.log`);
  const err = logFile(`${label}.err.log`);
  const child = spawn(command, args, {
    cwd,
    detached: true,
    stdio: ["ignore", out, err],
    windowsHide: true,
    env: {
      ...process.env,
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
  const frontendUrl = "http://127.0.0.1:5300/login";
  if (process.platform === "win32") {
    startProcess("spring-api", "cmd.exe", ["/c", "npm run spring:api"], root);
    startProcess("frontend", "cmd.exe", ["/c", "npm run dev -- --host 127.0.0.1 --port 5300 --strictPort"]);
  } else {
    const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");
    startProcess("spring-api", "npm", ["run", "spring:api"], root);
    startProcess("frontend", process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5300", "--strictPort"]);
  }

  await waitFor("http://127.0.0.1:4001/health", "Spring Boot API");
  const frontendReady = await waitFor("http://127.0.0.1:5300", "Frontend");
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
