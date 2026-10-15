const net = require("node:net");

const HOST = "127.0.0.1";
const DEFAULT_PORTS = [5300, 5173, 5500, 8088, 18080, 30000, 0];

function parsePort(value) {
  if (!/^\d+$/.test(value ?? "")) {
    throw new Error("GOVCARE_FRONTEND_PORT must be a number from 1 to 65535.");
  }
  const port = Number(value);
  if (port < 1 || port > 65535) {
    throw new Error("GOVCARE_FRONTEND_PORT must be a number from 1 to 65535.");
  }
  return port;
}

function probe(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", (error) => resolve({ error: error.code || error.message }));
    server.listen({ host: HOST, port, exclusive: true }, () => {
      const selected = server.address().port;
      server.close((error) => resolve(error ? { error: error.code || error.message } : { port: selected }));
    });
  });
}

async function selectFrontendPort(requested = process.env.GOVCARE_FRONTEND_PORT, candidates = DEFAULT_PORTS) {
  const ports = requested === undefined || requested === "" ? candidates : [parsePort(requested)];
  const failures = [];
  for (const port of ports) {
    const result = await probe(port);
    if (result.port) return result.port;
    failures.push(`${port || "automatic"}: ${result.error}`);
  }
  throw new Error(`No frontend port could be opened on ${HOST} (${failures.join(", ")}). Check Windows excluded port ranges with "netsh interface ipv4 show excludedportrange protocol=tcp" and try a permitted port with GOVCARE_FRONTEND_PORT.`);
}

module.exports = { HOST, selectFrontendPort };
