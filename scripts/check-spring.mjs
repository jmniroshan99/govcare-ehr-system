import { spawnSync } from "node:child_process";
for (const [label, command, args] of [["Java 21+", "java", ["-version"]], ["Maven 3.9+", "mvn", ["-version"]]]) {
  const result = spawnSync(command, args, { stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) { console.error(`${label} is required but was not found.`); process.exit(1); }
}
console.log("Spring Boot backend prerequisites are available.");
