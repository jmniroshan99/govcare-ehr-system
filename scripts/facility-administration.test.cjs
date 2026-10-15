const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

test("facility API is restricted to Super Admin plus HOSPITAL_MANAGE", () => {
  const controller = read("spring-api/src/main/java/lk/gov/health/govcare/facility/FacilityAdministrationController.java");
  assert.match(controller, /hasRole\('SUPER_ADMIN'\)/);
  assert.match(controller, /hasAuthority\('HOSPITAL_MANAGE'\)/);
  assert.match(controller, /@PostMapping\("\/hospitals"\)/);
});

test("Flyway grants hospital management through RBAC without bypassing permissions", () => {
  const migration = read("spring-api/src/main/resources/db/migration/V33__superadmin_facility_administration.sql");
  assert.match(migration, /'HOSPITAL_MANAGE'/);
  assert.match(migration, /r\.code='super_admin'/);
  assert.match(migration, /role_permissions/);
  assert.doesNotMatch(migration, /disable|bypass|drop table/i);
});

test("hospital creation is transactional, location-validated and audit recorded", () => {
  const service = read("spring-api/src/main/java/lk/gov/health/govcare/facility/FacilityAdministrationService.java");
  assert.match(service, /@Transactional\s+public Map<String, Object> createHospital/);
  assert.match(service, /SriLankaLocationPolicy\.resolve/);
  assert.match(service, /HOSPITAL_CREATED/);
  assert.match(service, /on conflict\(hospital_id,code\) do nothing/i);
});

test("bulk beds are bounded, capacity checked, deduplicated and inserted server-side", () => {
  const dto = read("spring-api/src/main/java/lk/gov/health/govcare/ward/WardDtos.java");
  const service = read("spring-api/src/main/java/lk/gov/health/govcare/ward/WardBedService.java");
  assert.match(dto, /@Min\(1\) @Max\(200\) int count/);
  assert.match(service, /maximum bed capacity/);
  assert.match(service, /generated bed numbers or codes already exist/);
  assert.match(service, /from generate_series\(0,:count-1\)/);
  assert.match(service, /BEDS_BULK_CREATED/);
  assert.match(service, /selected department does not belong to this hospital/i);
});

test("Super Admin UI exposes the complete hospital to ward to bed sequence", () => {
  const page = read("src/pages/admin/FacilityAdministration.tsx");
  const dashboard = read("src/dashboard/dashboardDefinitions.ts");
  const shell = read("src/components/layout/AppShell.tsx");
  for (const label of ["Add hospital", "Add ward", "Add beds in one batch"]) assert.ok(page.includes(label));
  assert.ok(dashboard.includes("Add hospitals, wards and beds"));
  assert.ok(shell.includes("Hospital Setup"));
});

test("PostgreSQL 18 dashboard date axes avoid the DAY alias grammar failure", () => {
  const service = read("spring-api/src/main/java/lk/gov/health/govcare/dashboard/DashboardIntelligenceService.java");
  assert.doesNotMatch(service, /::date day\b/);
  assert.doesNotMatch(service, /using\(day\)/);
  assert.doesNotMatch(service, /:today::date/);
  assert.match(service, /activity_day/);
});
