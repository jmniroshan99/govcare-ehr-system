const major = Number.parseInt(process.versions.node.split(".")[0] ?? "0", 10);

if (major === 22 || major === 24) {
  console.log(`Node.js ${process.version} is supported for GovCare EHR PostgreSQL API setup.`);
  process.exit(0);
}

if (major >= 25) {
  console.warn(`Node.js ${process.version} detected. PostgreSQL API Functions may not support Node ${major} yet.`);
  console.warn("Use Node 22 LTS or Node 24 for this project.");
  process.exit(0);
}

if (major < 20) {
  console.error(`Node.js ${process.version} is too old. Use Node 22 LTS or Node 24.`);
  process.exit(1);
}

console.warn(`Node.js ${process.version} detected. Recommended: Node 22 LTS or Node 24.`);
