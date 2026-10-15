const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const requestedRoles = [
  "super_admin", "hospital_admin", "doctor", "nurse", "receptionist", "opd_officer",
  "ward_manager", "lab_technician", "radiology_technician", "pharmacist",
  "inventory_officer", "finance_officer", "records_officer", "patient", "guardian",
  "emergency_staff", "quality_officer", "ict_admin",
];

test("all requested access roles have a frontend dashboard route", () => {
  const router = read("src/dashboard/DashboardRouter.tsx");
  for (const role of requestedRoles) assert.match(router, new RegExp(`case \\\"${role}\\\"`), `${role} is missing`);
});

test("new operational roles are additive in Java and Flyway RBAC", () => {
  const javaRoles = read("spring-api/src/main/java/lk/gov/health/govcare/security/UserRole.java");
  const migration = read("spring-api/src/main/resources/db/migration/V31__role_intelligence_dashboards.sql");
  for (const role of ["opd_officer", "ward_manager", "inventory_officer", "finance_officer", "emergency_staff", "quality_officer"]) {
    assert.match(javaRoles, new RegExp(`\\b${role}\\b`));
    assert.match(migration, new RegExp(`'${role}'`));
  }
  assert.match(migration, /on conflict do nothing/i);
});

test("backend chooses role from principal and enforces sensitive scopes", () => {
  const service = read("spring-api/src/main/java/lk/gov/health/govcare/dashboard/DashboardIntelligenceService.java");
  assert.match(service, /profileFor\(actor\.role\(\)\)/);
  assert.match(service, /DASHBOARD_VIEW permission is required/);
  assert.match(service, /doctor_id=:actorId/);
  assert.match(service, /patient_id=:patientId/);
  assert.match(service, /release_status='released'/);
  assert.match(service, /You cannot view another hospital's dashboard/);
  assert.doesNotMatch(service, /requestedRole|roleOverride/);
});

test("unsupported clinical and finance metrics are explicit unavailable states", () => {
  const service = read("spring-api/src/main/java/lk/gov/health/govcare/dashboard/DashboardIntelligenceService.java");
  for (const capability of ["Medication administration records", "billing, invoice or payment", "triage encounter", "uptime history"]) {
    assert.match(service.toLowerCase(), new RegExp(capability.toLowerCase()));
  }
  assert.match(service, /unavailableMetric/);
  assert.match(service, /no_source/);
});

test("new dashboard interface text exists in every supported locale", () => {
  for (const locale of ["en", "si", "ta"]) {
    const messages = JSON.parse(read(`src/i18n/locales/${locale}.json`));
    assert.equal(typeof messages.intelligence?.refresh, "string");
    assert.equal(typeof messages.intelligence?.unavailable, "string");
    assert.equal(typeof messages.intelligence?.reason?.no_source, "string");
    assert.equal(typeof messages.intelligence?.sourceReadiness, "string");
  }
  assert.equal(JSON.parse(read("src/i18n/locales/en.json")).intelligence.unavailable, "Data unavailable");
});

test("chart code is split behind React lazy loading and exposes a table alternative", () => {
  const page = read("src/dashboard/RoleDashboardPage.tsx");
  const chart = read("src/dashboard/DashboardChart.tsx");
  assert.match(page, /lazy\(\(\) => import\("\.\/DashboardChart"\)\)/);
  assert.match(chart, /ScreenReaderTable/);
  assert.match(chart, /<caption>/);
});

test("dashboard layout includes mobile, tablet and command-center responsive states", () => {
  const page = read("src/dashboard/RoleDashboardPage.tsx");
  const css = read("src/index.css");
  assert.match(page, /sm:grid-cols-2 xl:grid-cols-4/);
  assert.match(page, /2xl:grid-cols-2/);
  assert.match(page, /md:hidden/);
  assert.match(page, /hidden overflow-x-auto md:block/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
});
