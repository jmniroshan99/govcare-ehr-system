const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const root = path.resolve(__dirname, "..");
const cache = new Map();
function loadTypeScript(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} };
  cache.set(absolute, module);
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = (name) => name.startsWith(".")
    ? loadTypeScript(path.resolve(path.dirname(absolute), name) + ".ts") : require(name);
  new Function("require", "exports", "module", code)(localRequire, module.exports, module);
  return module.exports;
}

const { allRoles } = loadTypeScript("src/lib/rbac.ts");
const { canAccessPath, defaultRouteByRole, rolesForPath } = loadTypeScript("src/lib/roleAccess.ts");
const { authorizationContextKey, defaultHomeForProfile, hasPermission, loginDestinationForProfile } = loadTypeScript("src/lib/accessControl.ts");
const profile = (role, permissions = ["DASHBOARD_VIEW"]) => ({ uid: "account-a", role, permissions, hospitalId: "hospital-a", status: "active", mustChangePassword: false });

for (const role of allRoles) {
  test(`${role}: authenticated landing route and shared profile are accessible`, () => {
    const account = profile(role);
    assert.equal(canAccessPath(account, defaultRouteByRole[role]), true);
    assert.equal(defaultHomeForProfile(account), defaultRouteByRole[role]);
    assert.equal(canAccessPath(account, "/profile"), true);
    assert.equal(loginDestinationForProfile({ ...account, mustChangePassword: true }), "/change-temporary-password");
    if (!["super_admin", "hospital_admin"].includes(role)) {
      assert.equal(canAccessPath(profile(role, ["*"]), "/admin/staff"), false);
    }
    if (role !== "super_admin") assert.equal(canAccessPath(profile(role, ["*"]), "/super-admin"), false);
  });
}

const workflows = [
  ["super_admin", "/admin/staff", "USER_MANAGE"], ["hospital_admin", "/admin/staff", "USER_MANAGE"],
  ["super_admin", "/admin/facilities", "HOSPITAL_MANAGE"],
  ["doctor", "/doctor/workspace", "CONSULTATION_VIEW"], ["nurse", "/nurse-notes", "WARD_VIEW"],
  ["receptionist", "/opd", "QUEUE_VIEW"], ["opd_officer", "/opd", "QUEUE_VIEW"],
  ["ward_manager", "/wards", "WARD_VIEW"], ["lab_technician", "/laboratory", "LAB_REQUEST_VIEW"],
  ["radiology_technician", "/radiology", "RADIOLOGY_REQUEST_VIEW"], ["pharmacist", "/pharmacy", "PRESCRIPTION_VIEW"],
  ["records_officer", "/patients/register", "PATIENT_CREATE"], ["patient", "/portal/appointments", "PATIENT_VIEW_SELF"],
  ["emergency_staff", "/emergency", "EMERGENCY_VIEW"], ["quality_officer", "/audit-logs", "AUDIT_VIEW"],
  ["ict_admin", "/settings", "SETTINGS_MANAGE"],
];
for (const [role, route, permission] of workflows) {
  test(`${role}: ${route} follows the API permission grant and revocation`, () => {
    assert.equal(canAccessPath(profile(role, [permission]), route), true);
    assert.equal(canAccessPath(profile(role, []), route), false);
    assert.equal(canAccessPath(profile(role, undefined), route), false);
    assert.equal(rolesForPath(route).includes(role), true);
  });
}

test("no role-based permission fallback or unrestricted unknown path exists", () => {
  assert.equal(hasPermission(profile("doctor", []), "MEDIA_UPLOAD"), false);
  for (const role of allRoles) {
    for (const route of ["/unknown", "/settings-malicious", "/doctor-extra", "//other.example", "https://other.example"]) {
      assert.equal(canAccessPath(profile(role, ["*"]), route), false, role + route);
    }
    assert.equal(canAccessPath({ ...profile(role, ["*"]), status: "suspended" }, "/"), false);
  }
  assert.equal(canAccessPath(null, "/"), false);
  assert.equal(canAccessPath(profile("unrecognized", ["*"]), "/profile"), false);
});

test("stale or unauthorized database defaults fall back to a permitted home", () => {
  assert.equal(defaultHomeForProfile({ ...profile("lab_technician"), defaultRoute: "/admin/staff" }), "/");
  assert.equal(defaultHomeForProfile({ ...profile("patient"), defaultRoute: "/super-admin" }), "/portal");
  assert.equal(defaultHomeForProfile({ ...profile("doctor"), defaultRoute: "//other.example" }), "/");
  assert.equal(defaultHomeForProfile(profile("doctor", [])), "/profile");
});

test("patient, guardian and nonclinical operational roles cannot reach clinical/admin modules", () => {
  for (const role of ["patient", "guardian", "inventory_officer", "finance_officer", "quality_officer", "ict_admin"]) {
    for (const route of ["/doctor/workspace", "/nurse-notes", "/patients/search", "/ai-cdss/ckd", "/pharmacy"]) {
      assert.equal(canAccessPath(profile(role, ["*"]), route), false, role + route);
    }
  }
  assert.equal(canAccessPath(profile("guardian", ["*"]), "/portal/reports"), false);
  assert.equal(canAccessPath(profile("lab_technician", ["*"]), "/doctor/documents"), false);
});

test("role, tenant, identity or permission changes produce a different data cache context", () => {
  const account = profile("doctor", ["DASHBOARD_VIEW", "CONSULTATION_VIEW"]);
  const initial = authorizationContextKey(account);
  for (const change of [{ role: "nurse" }, { hospitalId: "other" }, { departmentId: "ward-a" },
    { patientId: "patient-a" }, { permissions: [] }, { status: "blocked" }, { mustChangePassword: true }]) {
    assert.notEqual(authorizationContextKey({ ...account, ...change }), initial);
  }
  assert.equal(authorizationContextKey({ ...account, permissions: [...account.permissions].reverse() }), initial);
});

test("local setup rejects remote databases and preserves every existing account", async () => {
  const { localDatabaseConfig } = await import("./provision-local-role-accounts.mjs");
  assert.equal(localDatabaseConfig({ DB_URL: "jdbc:postgresql://localhost:5432/test_db" }).database, "test_db");
  assert.throws(() => localDatabaseConfig({ DB_URL: "jdbc:postgresql://hospital.example:5432/production" }), /localhost/);
  assert.throws(() => localDatabaseConfig({ DB_URL: "jdbc:postgresql://localhost:5432/test?sslmode=disable" }));
  const accounts = JSON.parse(fs.readFileSync(path.join(root, "database/postgresql/local-role-credentials.json"), "utf8"));
  assert.deepEqual([...new Set(accounts.map(a => a.role))].sort(), [...allRoles].sort());
  assert.equal(new Set(accounts.map(a => a.password)).size, allRoles.length);
  const sql = fs.readFileSync(path.join(root, "database/postgresql/local-role-accounts.sql"), "utf8");
  assert.match(sql, /on conflict\(email\) do nothing/i);
  assert.doesNotMatch(sql, /update\s+app_users|insert\s+into\s+patients|insert\s+into\s+hospitals/i);
  for (const account of accounts) {
    assert.ok(account.password.length >= 16);
    assert.ok(sql.includes(account.email) && sql.includes(account.password));
    assert.ok(account.email.endsWith(".local@govcare.test"));
  }
});
