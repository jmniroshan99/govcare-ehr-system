import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const api = new URL(process.env.GOVCARE_TEST_API_URL || "http://127.0.0.1:4002");
if (!["127.0.0.1", "localhost", "[::1]"].includes(api.hostname)) throw new Error("Use the local test API for role login verification.");
const file = process.env.GOVCARE_ROLE_CREDENTIALS || fileURLToPath(new URL("../database/postgresql/local-role-credentials.json", import.meta.url));
const accounts = JSON.parse(readFileSync(file, "utf8"));
const results = [];
for (const account of accounts) {
  try {
    const response = await fetch(new URL("/api/auth/local-login", api), {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: account.email, password: account.password }), signal: AbortSignal.timeout(10_000),
    });
    const session = await response.json();
    if (!response.ok || !session.token) throw new Error(`Login returned HTTP ${response.status}`);
    if (session.user.role !== account.role) throw new Error("Unexpected authenticated role");
    const headers = { Authorization: `Bearer ${session.token}` };
    const dashboard = await fetch(new URL("/api/dashboard/intelligence", api), { headers, signal: AbortSignal.timeout(10_000) });
    if (session.user.mustChangePassword) {
      if (dashboard.status !== 403) throw new Error("Temporary-password gate failed");
      results.push({ role: account.role, login: "PASS", dashboard: "Password change required" });
      continue;
    }
    const payload = await dashboard.json();
    if (!dashboard.ok || payload.role !== account.role) throw new Error("Dashboard role selection failed");
    if (account.role !== "super_admin") {
      const forbidden = await fetch(new URL(`/api/dashboard/intelligence?hospitalId=${crypto.randomUUID()}`, api), { headers, signal: AbortSignal.timeout(10_000) });
      if (forbidden.status !== 403) throw new Error("Cross-hospital access was not rejected");
    }
    if (!["super_admin", "hospital_admin"].includes(account.role)) {
      const forbidden = await fetch(new URL("/api/admin/staff", api), { headers, signal: AbortSignal.timeout(10_000) });
      if (forbidden.status !== 403) throw new Error("Unauthorized staff administration was not rejected");
    }
    results.push({ role: account.role, login: "PASS", dashboard: "PASS" });
  } catch (error) {
    results.push({ role: account.role, login: "FAIL", dashboard: error.message });
  }
}
console.table(results);
if (results.some(r => r.login === "FAIL" || r.dashboard !== "PASS")) process.exitCode = 1;
