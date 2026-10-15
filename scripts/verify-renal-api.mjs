import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {resolve} from 'node:path';

// This verifier writes operational fixtures. Use a disposable local installation only.
const base = new URL(process.env.GOVCARE_VISUAL_API || 'http://127.0.0.1:4002');
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname));
assert.equal(process.env.GOVCARE_RENAL_TEST_MUTATIONS, 'disposable-local', 'Explicitly select a disposable local test installation.');
const accounts = JSON.parse(await fs.readFile(process.env.GOVCARE_VISUAL_ACCOUNTS, 'utf8'));
const output = resolve(process.env.GOVCARE_RENAL_API_REPORT || 'verification/renal-api-report.json');
const checks = [];
function check(name, condition) {assert.ok(condition, name); checks.push(name);}
async function request(path, token, body, expected = 200) {
  const response = await fetch(new URL(path, base), {method: body ? 'POST' : 'GET',
    headers: {...(token ? {Authorization: `Bearer ${token}`} : {}), ...(body ? {'Content-Type': 'application/json'} : {})},
    body: body ? JSON.stringify(body) : undefined});
  const payload = await response.json();
  assert.equal(response.status, expected, `${path}: ${response.status} ${payload.message || payload.error || ''}`);
  return payload;
}
const doctor = accounts.find(a => a.role === 'doctor');
assert.ok(doctor && doctor.patientId && doctor.forbiddenPatientId);
const endpoint = `/api/ai-cdss/ckd/patients/${doctor.patientId}/renal-intelligence`;
await request(endpoint, null, null, 401); checks.push('unauthenticated patient access denied');
const tokens = {};
for (const account of accounts) {
  tokens[account.role] = (await request('/api/auth/local-login', null, {email: account.email, password: account.password})).token;
  assert.ok(tokens[account.role]);
}
checks.push('real doctor/super_admin/patient password logins');
await request(endpoint, tokens.patient, null, 403); checks.push('patient role denied clinical renal access');
await request(`/api/ai-cdss/ckd/patients/${doctor.forbiddenPatientId}/renal-intelligence`, tokens.doctor, null, 403);
checks.push('unassigned patient denied');
let overview = await request(endpoint, tokens.doctor);
check('authorized patient association', overview.patientId === doctor.patientId);
const insufficient = await request(endpoint + '/predict', tokens.doctor, {requestId: randomUUID(), modelKey: 'hb'});
check('empty history persists insufficient status', insufficient.status === 'INSUFFICIENT_DATA' && insufficient.outputs.prediction === null);
const units = {hb: 'g/L', albumin: 'g/dL', calcium: 'mmol/L', sodium: 'mmol/L', potassium_pre: 'mmol/L', potassium_post: 'mmol/L',
  creatinine_pre: 'mg/dL', creatinine_post: 'mg/dL', urea_pre: 'mmol/L', urea_post: 'mmol/L', dry_weight: 'kg'};
const records = [32, 1].map((days, index) => ({requestId: randomUUID(), observedAt: new Date(Date.now() - days * 86400000).toISOString(),
  maintenanceHemodialysisVerified: true, sourceVerified: true, sourceNote: 'Operational API fixture; not a clinical validation subject.',
  measurements: {hb: index ? 108 : 112, albumin: 3.8, calcium: 2.1, sodium: 138, potassium_pre: 4.7, potassium_post: 3.4,
    creatinine_pre: 8, creatinine_post: 4, urea_pre: 22, urea_post: 7, dry_weight: 62}, units}));
for (const record of records) await request(endpoint + '/observations', tokens.doctor, record);
checks.push('two verified monthly observations persisted through real Spring HTTP');
const idem = await request(endpoint + '/observations', tokens.doctor, records[1]);
check('observation request idempotency', idem.saved === true);
await request(endpoint + '/observations', tokens.doctor, {...records[1], requestId: randomUUID()}, 409);
checks.push('duplicate observation timestamp rejected');
await request(endpoint + '/observations', tokens.doctor, {...records[1], requestId: randomUUID(), observedAt: new Date(Date.now() - 2 * 86400000).toISOString(), sourceVerified: false}, 400);
checks.push('unverified source rejected');
await request(endpoint + '/observations', tokens.doctor, {...records[1], requestId: randomUUID(), units: {...units, hb: 'unknown'}}, 400);
checks.push('unknown unit rejected');
overview = await request(endpoint, tokens.doctor);
check('current G5D requires explicit verified dialysis', overview.currentRenalStatus.stage === 'G5D');
check('history remains two observations', overview.observations.length === 2);
check('observation timestamps preserve submitted ISO instants', overview.observations.every(row =>
  typeof row.observed_at === 'string' && records.some(record => Date.parse(record.observedAt) === Date.parse(row.observed_at))));
// Reuse the JDBC statement beyond its server-prepare threshold. An incomplete
// PostgreSQL wire handshake can decode integer binary dates as year 2000.
for (let read = 0; read < 6; read++) {
  overview = await request(endpoint, tokens.doctor);
  assert.ok(overview.observations.every(row => typeof row.observed_at === 'string' &&
    records.some(record => Date.parse(record.observedAt) === Date.parse(row.observed_at))),
    'Repeated history reads must preserve measured dates after server-side statement preparation.');
}
checks.push('reused JDBC history reads preserve measured dates');
const predictionRequest = {requestId: randomUUID(), modelKey: 'hb'};
const hb = await request(endpoint + '/predict', tokens.doctor, predictionRequest);
check('real Spring JWT to Django Hb inference', hb.status === 'AVAILABLE' && Math.abs(hb.outputs.prediction - 10.8) < 0.0001);
check('Hb serves honest persistence baseline', hb.outputs.method === 'PERSISTENCE_BASELINE' && hb.outputs.explanation.method === 'BASELINE');
check('Hb no fabricated probability or SHAP', hb.outputs.probability === null && hb.outputs.explanation.top_factors.every(f => f.contribution === null));
const repeated = await request(endpoint + '/predict', tokens.doctor, predictionRequest);
check('prediction request idempotency', repeated.id === hb.id);
await request(endpoint + '/predict', tokens.doctor, {...predictionRequest, modelKey: 'urr'}, 409);
checks.push('idempotency key cannot change model');
const urr = await request(endpoint + '/predict', tokens.doctor, {requestId: randomUUID(), modelKey: 'urr'});
check('real Spring JWT to Django URR inference', urr.status === 'AVAILABLE' && Number.isFinite(urr.outputs.prediction));
check('real SHAP contributions', urr.outputs.explanation.method === 'SHAP' && urr.outputs.explanation.top_factors.some(f => Number.isFinite(f.contribution)));
check('research and governance status visible', urr.outputs.clinical_validation === 'NOT_COMPLETED' && urr.outputs.dataset_permission_status === 'UNVERIFIED' && urr.outputs.requires_clinician_review === true);
check('artifact and source provenance', /^[a-f0-9]{64}$/.test(urr.outputs.artifact_sha256) && /^[a-f0-9]{64}$/.test(urr.outputs.source_dataset_sha256));
const hyper = await request(endpoint + '/predict', tokens.doctor, {requestId: randomUUID(), modelKey: 'hyperkalemia'});
check('Sri Lankan hyperkalemia research classifier available', hyper.status === 'AVAILABLE' && hyper.outputs.prediction === null && Number.isFinite(hyper.outputs.probability));
check('hyperkalemia probability contract bounded and nonclinical', hyper.outputs.probability >= 0 && hyper.outputs.probability <= 1 && hyper.outputs.risk_category === 'RESEARCH_RISK_SCORE' && hyper.outputs.clinical_validation === 'NOT_COMPLETED');
check('hyperkalemia calibration limitation explicit', hyper.outputs.explanation.limitations.some(x => /not clinically calibrated/i.test(x)));
overview = await request(endpoint, tokens.doctor);
check('renal deterioration composite returned', overview.deteriorationComposite && ['INSUFFICIENT_DATA','NO_ADVERSE_DIRECTION_DETECTED','MIXED_TRAJECTORY','MULTIDOMAIN_WORSENING_SIGNAL'].includes(overview.deteriorationComposite.status));
const dry = await request(endpoint + '/predict', tokens.doctor, {requestId: randomUUID(), modelKey: 'dry-weight'});
check('dry weight unavailable without a defensible model', dry.status === 'INSUFFICIENT_DATA' && dry.outputs.prediction === null);
const reviewEndpoint = `/api/ai-cdss/ckd/renal-intelligence/predictions/${urr.id}/review`;
await request(reviewEndpoint, tokens.doctor, {patientId: doctor.patientId, requestId: randomUUID(), expectedVersion: 0, action: 'ACCEPT', reason: ''}, 400);
checks.push('clinical review reason required');
for (const [index, action] of ['ACCEPT', 'MODIFY', 'DEFER', 'DISMISS'].entries()) {
  const result = await request(reviewEndpoint, tokens.doctor, {patientId: doctor.patientId, requestId: randomUUID(), expectedVersion: index,
    action, reason: 'Operational fixture review only; no clinical validation.', note: 'Testing append-only review provenance.',
    ...(action === 'MODIFY' ? {modifiedInterpretation: 'Research forecast acknowledged; no treatment recommendation.'} : {})});
  check(`persist ${action} with optimistic version`, result.reviewState === action && result.reviewVersion === index + 1);
}
await request(reviewEndpoint, tokens.doctor, {patientId: doctor.patientId, requestId: randomUUID(), expectedVersion: 0, action: 'ACCEPT', reason: 'Stale operational fixture version'}, 409);
checks.push('stale clinician review rejected');
overview = await request(endpoint, tokens.doctor);
check('stored review projects in overview', overview.predictions.find(p => p.id === urr.id).review_state === 'DISMISS');
check('snapshot and review timestamps preserve current ISO instants', overview.predictions.every(row =>
  typeof row.created_at === 'string' && Math.abs(Date.now() - Date.parse(row.created_at)) < 600000) &&
  typeof overview.predictions.find(row => row.id === urr.id).reviewed_at === 'string' &&
  Math.abs(Date.now() - Date.parse(overview.predictions.find(row => row.id === urr.id).reviewed_at)) < 600000);
const intelligencePath=`/api/ai-cdss/ckd/patients/${doctor.patientId}/predictive-intelligence`;
const six=await request(intelligencePath,tokens.doctor);
check('six-module patient identity and order',six.patientId===doctor.patientId && JSON.stringify(six.moduleOrder)===JSON.stringify(['renalTrajectory','kidneyFailureStatus','hyperkalemia','anemia','dialysisAdequacy','renalDeterioration']));
check('Hb method and hyperkalemia score match actual stored inference',six.anemia.method==='Persistence Baseline' && Math.abs(six.hyperkalemia.researchRiskScore-hyper.outputs.probability)<1e-10);
check('G5D requires verified source and no invented failure probability',six.kidneyFailureStatus.renalStatus==='G5D' && six.kidneyFailureStatus.researchRiskScore===null);
check('read reuses immutable intelligence snapshot',(await request(intelligencePath,tokens.doctor)).snapshotId===six.snapshotId);
const moduleReview={snapshotId:six.snapshotId,requestId:randomUUID(),moduleKey:'renalTrajectory',expectedVersion:0,action:'DEFER',reason:'Operational test only; source review required.',note:'No clinical validation',modifiedInterpretation:''};
const moduleResult=await request(intelligencePath+'/reviews',tokens.doctor,moduleReview);
check('module review saves optimistic version',moduleResult.saved && moduleResult.reviewVersion===1);
check('module review is idempotent',(await request(intelligencePath+'/reviews',tokens.doctor,moduleReview)).id===moduleResult.id);
await request(intelligencePath+'/reviews',tokens.doctor,{...moduleReview,requestId:randomUUID()},409);
check('review state returns without rerunning ML',(await request(intelligencePath,tokens.doctor)).renalTrajectory.moduleReviewState==='DEFER');
await fs.mkdir(resolve(output, '..'), {recursive: true});
await fs.writeFile(output, JSON.stringify({operationalFixturesNotClinicalValidation: true, clinicalValidationSubjects: 0,
  checks, passed: checks.length, predictions: {hb: {method: hb.outputs.method, prediction: hb.outputs.prediction}, urr: {method: urr.outputs.method, prediction: urr.outputs.prediction}, hyperkalemia: {method: hyper.outputs.method, probability: hyper.outputs.probability}},
  databaseEngine: process.env.GOVCARE_VERIFICATION_DB_ENGINE || 'user supplied disposable database'}, null, 2) + '\n');
console.log(`Live renal HTTP checks passed: ${checks.length}; clinical validation subjects=0.`);
