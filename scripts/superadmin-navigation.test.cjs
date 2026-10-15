const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");
function load(file, apiRequest) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => name === "./apiClient" ? { apiRequest }
    : name.startsWith(".") ? load(path.relative(root, path.resolve(path.dirname(path.join(root, file)), name + ".ts")), apiRequest) : require(name);
  new Function("require", "exports", "module", code)(localRequire, module.exports, module);
  return module.exports;
}
const { clinicalAssessmentHref } = load("src/utils/patientNavigation.ts");
const patient = "04d46a8d-66aa-4e68-8d45-2a56cc5e3dbd";
test("AI links from search, registration and unrelated pages do not invent a patient id", () => {
  for (const route of ["/patients/search", "/patients/register", "/patients", "/patients/123", "/super-admin", "/ai-cdss/ckd"])
    assert.equal(clinicalAssessmentHref(route), "/ai-cdss/ckd");
});
test("patient profiles and document routes keep the real UUID in the AI link", () => {
  for (const route of [`/patients/${patient}`, `/patients/${patient}/documents`])
    assert.equal(clinicalAssessmentHref(route), `/ai-cdss/ckd?patientId=${patient}`);
});
test("clinical directory propagates authorization and server errors without a demographics fallback", async () => {
  for (const status of [403, 500]) {
    const calls = [];
    const denied = new Error(`HTTP ${status}`);
    const service = load("src/services/patientService.ts", async url => { calls.push(url); throw denied; });
    await assert.rejects(service.searchAuthorizedPatients("test"), e => e === denied);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].startsWith("/api/ai-cdss/ckd/patients?"));
  }
});
test("network paging, hospital filtering and cancellation reach the clinical endpoint", async () => {
  let request;
  const data = { items: [], total: 401, page: 2, pageSize: 50, hasNext: true, scope: "network" };
  const service = load("src/services/patientService.ts", async (url, options) => { request = { url, options }; return data; });
  const controller = new AbortController();
  assert.equal(await service.searchAuthorizedPatientPage(" A&B ", { hospitalId: patient, page: 2, pageSize: 50, signal: controller.signal }), data);
  const url = new URL(request.url, "http://test.invalid");
  assert.equal(url.pathname, "/api/ai-cdss/ckd/patients");
  assert.equal(url.searchParams.get("search"), "A&B");
  assert.equal(url.searchParams.get("hospitalId"), patient);
  assert.equal(url.searchParams.get("page"), "2");
  assert.equal(request.options.signal, controller.signal);
});
test("direct clinical patient loading uses the UUID endpoint, even beyond the first page", async () => {
  const calls = [];
  const record = { id: patient, hospital_id: patient, full_name: "Unit test patient" };
  const service = load("src/services/patientService.ts", async url => { calls.push(url); return { patient: record }; });
  assert.equal(await service.getAuthorizedPatient(patient), record);
  assert.deepEqual(calls, [`/api/ai-cdss/ckd/patients/${patient}`]);
});
