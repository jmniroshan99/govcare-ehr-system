const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");

const DEFAULT_PORTS = [4002, 4003, 4004, 4010, 14002, 0];

function validateApiPort(value) {
  if (!/^\d+$/.test(String(value ?? ""))) throw new Error("API port must be a number from 1 to 65535.");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("API port must be a number from 1 to 65535.");
  return port;
}

function configuredApiPort(root, env) {
  const local = {};
  const file = path.join(root, "spring-api", ".env");
  if (fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
      const match = line.trim().match(/^(PORT|SERVER_PORT)\s*=\s*(.*)$/);
      if (match) local[match[1]] = match[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    }
  }
  // Spring's direct SERVER_PORT binding takes precedence over the PORT placeholder.
  return validateApiPort(local.SERVER_PORT || env.SERVER_PORT || local.PORT || env.PORT || "4002");
}

function bindProbe(port, host) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve({ error: error.code || error.message }));
    // Spring listens on wildcard interfaces by default. A loopback-only probe
    // could miss another process bound to a different local interface.
    server.listen({ port, ...(host ? {host} : {}), exclusive: true }, () => {
      const selected = server.address().port;
      server.close((error) => resolve(error ? { error: error.code || error.message } : { port: selected }));
    });
  });
}

async function probe(port) {
  const wildcard = await bindProbe(port);
  if (!wildcard.port) return wildcard;
  const ipv4 = await bindProbe(wildcard.port, "0.0.0.0");
  if (!ipv4.port) return ipv4;
  // Windows wildcard binds can coexist with a specific loopback listener.
  // Also test the exact address used by the browser and service clients.
  return bindProbe(ipv4.port, "127.0.0.1");
}

async function selectApiPort({ root = path.resolve(__dirname, ".."), env = process.env, candidates, exclude = [] } = {}) {
  const requested = env.GOVCARE_API_PORT;
  const explicit = requested !== undefined && requested !== "";
  const ports = explicit ? [validateApiPort(requested)] : candidates ?? [configuredApiPort(root, env), ...DEFAULT_PORTS];
  const skipped = new Set(exclude);
  const failures = [];
  for (const port of new Set(ports)) {
    if (skipped.has(port)) { failures.push(`${port}: reserved for frontend`); continue; }
    const result = await probe(port);
    if (result.port && !skipped.has(result.port)) return result.port;
    failures.push(`${port || "automatic"}: ${result.error || "reserved for frontend"}`);
  }
  throw new Error(`No Spring API port could be opened (${failures.join(", ")}). Close your previous GovCare instance or choose a free port with GOVCARE_API_PORT. Existing processes were left running.`);
}

module.exports = { validateApiPort, selectApiPort };
