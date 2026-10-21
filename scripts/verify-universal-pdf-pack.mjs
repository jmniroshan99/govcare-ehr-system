// Read-only clinical verification: preview every fixture for two isolated synthetic patients.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {counts, query, sessionPath} from './pdf-reuse-qa-db.mjs';

const folder = 'output/pdf/GovCare_Clinical_PDF_Universal_Test_Pack_10';
const expected = JSON.parse(fs.readFileSync(path.join(folder, 'expected_results.json'), 'utf8'));
const session = JSON.parse(fs.readFileSync(sessionPath, 'utf8'));
const patients = [session.patient, session.mismatchPatient];
assert.equal(new Set(patients).size, 2);
for (const patient of patients) {
  assert.match(patient, /^[a-f0-9-]{36}$/);
  assert.equal(query(`select count(*) from patients p join hospitals h on h.id=p.hospital_id where p.id='${patient}' and h.code like 'QA-PDF-%'`), '1', 'Only isolated synthetic QA patients may be used');
}
const base = 'http://127.0.0.1:4002';
const login = await fetch(base + '/api/auth/local-login', {
  method: 'POST', headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({email: session.email, password: session.password}),
});
assert.equal(login.status, 200, 'Synthetic QA sign-in failed');
const {token} = await login.json();
const before = patients.map(counts);
const results = [];
for (const [index, patient] of patients.entries()) {
  const reports = [];
  for (const spec of expected.cases) {
    const form = new FormData();
    form.append('patientId', patient);
    form.append('file', new Blob([fs.readFileSync(path.join(folder, spec.file))], {type: 'application/pdf'}), spec.file);
    const response = await fetch(base + '/api/ai-cdss/pdf/extract', {
      method: 'POST', headers: {Authorization: `Bearer ${token}`}, body: form,
    });
    assert.equal(response.status, 200, spec.file);
    const actual = await response.json();
    assert.equal(actual.status, spec.expectedStatus, spec.file);
    assert.equal(actual.detectedCount, spec.expectedDetectedCount, spec.file);
    assert.equal(actual.identityStatus, 'UNVERIFIED', spec.file);
    assert.equal(actual.fingerprint, spec.sha256, spec.file);
    for (const name of ['PATIENT_ACCESS','PDF_VALIDATION','TEXT_EXTRACTION','OCR','IDENTIFIERS_AND_DATES','MEASUREMENT_RECOGNITION','NORMALIZATION_AND_VALIDATION','CONFLICT_REVIEW','CLINICIAN_REVIEW','PATIENT_IDENTITY','DUPLICATE_CHECK']) {
      assert.ok(actual.processingStages?.some(stage=>stage.stage===name), `${spec.file}: missing stage ${name}`);
    }
    for (const [feature, value] of Object.entries(spec.expectedNormalizedValues)) {
      const extracted = actual.extractedValues[feature];
      assert.ok(Math.abs(extracted?.value - value) < .0011, `${spec.file}: ${feature}`);
      assert.equal(extracted.clinicalDate, spec.specimenCollectionTime || undefined);
    }
    reports.push({file: spec.file, status: actual.status, identityStatus: actual.identityStatus,
      detectedCount: actual.detectedCount, fingerprint: actual.fingerprint, processingStages: actual.processingStages});
  }
  assert.equal(reports[0].fingerprint, reports[8].fingerprint);
  assert.notEqual(reports[0].fingerprint, reports[9].fingerprint);
  results.push({syntheticPatient: index + 1, reports});
}
const after = patients.map(counts);
assert.deepEqual(after, before, 'Preview must not write clinical records');
const evidence = {status: 'passed', scope: 'Ten patient-neutral fixtures previewed for each of two differently identified, authorized synthetic patients; no application, save or assessment performed',
  clinicalCountsUnchanged: true, clinicalCountsBefore: before, clinicalCountsAfter: after, results};
fs.writeFileSync(path.join(folder, 'live-import-verification.json'), JSON.stringify(evidence, null, 2));
console.log(JSON.stringify({status: 'passed', patientsTested: 2, previewsTested: 20,
  patientMismatchCount: 0, clinicalCountsUnchanged: true}));
