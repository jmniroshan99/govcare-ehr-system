const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");

// Invoke the real TypeScript clients. Only the HTTP boundary is captured.
function client(relative) {
  const calls = [];
  const module = { exports: {} };
  const source = fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  const code = ts.transpileModule(source, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
  } }).outputText;
  new Function("require", "exports", "module", code)((name) => {
    assert.equal(name, "./apiClient");
    return { apiRequest: (url, options) => { calls.push({ url, options }); return Promise.resolve({}); } };
  }, module.exports, module);
  return { api: module.exports, calls };
}

const patientId = "00000000-0000-4000-8000-000000000001";
test("clinical overview uses the existing intelligence endpoint and forwards cancellation", async () => {
  const { api, calls } = client("src/services/predictiveIntelligenceService.ts");
  const { signal } = new AbortController();
  await api.getPredictiveOverview(patientId, signal);
  await api.getClinicalIntelligence(patientId, signal);
  assert.equal(calls.length, 2);
  for (const call of calls) {
    assert.equal(call.url, `/api/ai-cdss/ckd/patients/${patientId}/intelligence`);
    assert.equal(call.options.signal, signal);
  }
});

test("six-module overview retains the predictive-intelligence endpoint", async () => {
  const { api, calls } = client("src/services/renalIntelligenceService.ts");
  const { signal } = new AbortController();
  await api.getRenalPredictiveIntelligence(patientId, signal);
  assert.equal(calls[0].url, `/api/ai-cdss/ckd/patients/${patientId}/predictive-intelligence`);
  assert.equal(calls[0].options.signal, signal);
});

test("six-module clinician review posts the unchanged review payload to its dedicated route", async () => {
  const { api, calls } = client("src/services/renalIntelligenceService.ts");
  const payload = { snapshotId: patientId, requestId: patientId, moduleKey: "renalTrajectory", expectedVersion: 0,
    action: "DEFER", reason: "Await source verification", note: "", modifiedInterpretation: "" };
  const { signal } = new AbortController();
  await api.reviewRenalModule(patientId, payload, signal);
  assert.equal(calls[0].url, `/api/ai-cdss/ckd/patients/${patientId}/predictive-intelligence/reviews`);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.signal, signal);
  assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});

test("clinical dialysis verification uses its patient-scoped endpoint without fabricated lab values",async()=>{
 const {api,calls}=client("src/services/renalIntelligenceService.ts");const {signal}=new AbortController();
 const body={requestId:patientId,status:"MAINTENANCE_HD",verifiedAt:"2026-10-11T02:00:00Z",sourceNote:"Operational source verification",sourceVerified:true};
 await api.verifyRenalDialysisStatus(patientId,body,signal);
 assert.equal(calls[0].url,`/api/ai-cdss/ckd/patients/${patientId}/renal-intelligence/dialysis-status`);
 assert.equal(calls[0].options.method,"POST");assert.equal(calls[0].options.signal,signal);
 assert.deepEqual(JSON.parse(calls[0].options.body),body);assert.equal('measurements' in body,false);
});
