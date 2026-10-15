const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(
  path.resolve(__dirname, "../src/pages/DoctorWorkspace.tsx"),
  "utf8",
);

test("patient profile can be explicitly collapsed without losing the safety identity strip", () => {
  assert.match(source, /patientDetailsExpanded, setPatientDetailsExpanded/);
  assert.match(source, /id="doctor-patient-details" hidden=\{!patientDetailsExpanded\}/);
  assert.match(source, /aria-expanded=\{patientDetailsExpanded\}/);
  assert.match(source, /Hide patient details/);
  assert.match(source, /Show patient details/);
  assert.match(source, /\{patient\.patientNo\}/);
});

test("focusing a consultation note collapses the large profile card", () => {
  assert.match(source, /onFocusCapture=\{\(event\) => \{/);
  assert.match(source, /event\.target instanceof HTMLTextAreaElement/);
  assert.match(source, /setPatientDetailsExpanded\(false\)/);
});

test("a newly selected patient restores the full identity check", () => {
  assert.match(source, /setPatientDetailsExpanded\(true\)/);
  assert.match(source, /\[patient\?\.patientUuid\]/);
});

test("advanced prescription entry uses a guided responsive workflow", () => {
  assert.match(source, /1\. Clinical indication/);
  assert.match(source, /2\. Select medicine/);
  assert.match(source, /3\. Dose and schedule/);
  assert.match(source, /4\. Patient instructions/);
  assert.match(source, /FormFieldLabel required/);
  assert.match(source, /Add to prescription/);
  assert.match(source, /Clear entry/);
});

test("medication entry exposes live completion and safety state", () => {
  assert.match(source, /medicationEntryStatus/);
  assert.match(source, /canAddMedicine/);
  assert.match(source, /aria-live="polite"/);
  assert.match(source, /Possible allergy conflict/);
  assert.match(source, /Already added to this prescription/);
});
