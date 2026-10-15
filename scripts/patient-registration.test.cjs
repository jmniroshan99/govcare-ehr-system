const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");

const page = read("src/pages/PatientRegistration.tsx");
const validation = read("src/validations/patient.ts");
const styles = read("src/index.css");
const labels = read("src/components/ui/form-field-label.tsx");
const service = read("spring-api/src/main/java/lk/gov/health/govcare/patient/PatientService.java");
const controller = read("spring-api/src/main/java/lk/gov/health/govcare/patient/PatientController.java");
const migration = read("spring-api/src/main/resources/db/migration/V34__patient_registration_workflow.sql");

test("quick registration is the default and optional details are collapsed", () => {
  assert.match(page, /useState\(false\).*showAdditional|\[showAdditional, setShowAdditional\] = useState\(false\)/s);
  assert.match(page, />Quick Registration</);
  assert.match(page, /Additional patient details/);
  assert.match(page, /<details open=\{showAdditional\}/);
});

test("one conditional identifier maps to the existing PostgreSQL columns", () => {
  assert.match(page, /type IdentificationType = "nic" \| "passport" \| "birth_certificate"/);
  assert.match(page, /nic: type === "nic" \? identifier : undefined/);
  assert.match(page, /passportNo: type === "passport" \? identifier : undefined/);
  assert.match(page, /birthCertificateNo: type === "birth_certificate" \? identifier : undefined/);
  assert.match(page, /checkPatientDuplicate\(\{\s*\.\.\.identifiers/s);
});

test("minimum quick-registration fields are validated", () => {
  for (const field of ["identificationNumber", "firstName", "lastName", "dateOfBirth", "sex", "phone", "province", "district"]) {
    assert.match(validation, new RegExp(`${field}:`), `${field} must remain in the patient schema`);
  }
  assert.match(validation, /Enter a valid Sri Lankan NIC\./);
  assert.match(validation, /Date of birth is required\./);
  assert.match(validation, /Phone number is required\./);
  assert.match(validation, /Province is required\./);
  assert.match(validation, /District is required\./);
});

test("required state is visible and accessible without relying on an asterisk", () => {
  assert.match(labels, />\s*Required\s*</);
  assert.match(labels, /aria-label="Required field"/);
  assert.doesNotMatch(labels, /aria-label="required">\*</);
  assert.match(page, /aria-required="true"/);
  assert.match(page, /role="alert"/);
  assert.match(page, /Fields marked Required must be completed\./);
});

test("registration layout has one, two, and three columns but never four", () => {
  assert.match(styles, /\.registration-grid \{[^}]*grid-template-columns: minmax\(0, 1fr\)/s);
  assert.match(styles, /@media \(min-width: 768px\)[\s\S]*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(styles, /@media \(min-width: 1440px\)[\s\S]*repeat\(3, minmax\(0, 1fr\)\)/);
  assert.doesNotMatch(page, /xl:grid-cols-4/);
  assert.match(styles, /\.registration-field:focus-within/);
});

test("duplicate checking remains permission and hospital scoped", () => {
  assert.match(controller, /@PreAuthorize\("hasAuthority\('PATIENT_CREATE'\)"\)[\s\S]*duplicate/);
  assert.match(service, /from patients where hospital_id=:hospitalId and status<>'deleted'/);
  assert.match(page, /Duplicate patient detected — registration is blocked/);
});

test("registration type is persisted with a constrained backward-compatible default", () => {
  assert.match(migration, /registration_type text not null default 'walk_in'/);
  assert.match(migration, /check \(registration_type in \('walk_in','appointment','emergency','referral','transfer','newborn'\)\)/);
  assert.match(service, /REGISTRATION_TYPES = Set\.of\("walk_in", "appointment", "emergency", "referral", "transfer", "newborn"\)/);
  assert.match(service, /p\.setRegistrationType\(normalizeRegistrationType\(input\.registrationType\(\)\)\)/);
});

test("submission is guarded against loss and duplicate clicks without storing patient data locally", () => {
  assert.match(page, /beforeunload/);
  assert.match(page, /submissionLockRef\.current/);
  assert.match(page, /Clear this registration form\?/);
  assert.doesNotMatch(page, /localStorage/);
});
