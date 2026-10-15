const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const out = fs.openSync(path.join(root, "vite-detached.out.log"), "a");
const err = fs.openSync(path.join(root, "vite-detached.err.log"), "a");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");

const child = spawn(process.execPath, [vite, "--host", "127.0.0.1"], {
  cwd: root,
  detached: true,
  stdio: ["ignore", out, err],
  windowsHide: true,
  env: {
    ...process.env,
    BROWSER: "none",
  },
});

child.unref();
console.log(`GovCare Vite dev server started with PID ${child.pid}`);
