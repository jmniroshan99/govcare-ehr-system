const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root = path.resolve(__dirname, ".."), cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const localRequire = name => name.startsWith(".") ? load(path.resolve(path.dirname(absolute), name) + ".ts") : require(name);
  new Function("require", "exports", "module", code)(localRequire, module.exports, module);
  return module.exports;
}
const { allRoles } = load("src/lib/rbac.ts");
const { canUsePredictiveWorkspace, resolveCkdWorkspaceView, integratedCkdHref } = load("src/lib/ckdWorkspace.ts");
const { PatientOperationScope } = load("src/lib/patientOperationScope.ts");
const clinicians = new Set(["super_admin", "doctor", "surgeon", "anesthetist"]);
for (const role of allRoles) test(`Embedded intelligence retains the clinical boundary for ${role}`, () => {
  const profile = { uid: "test-account", role, hospitalId: "test-tenant", status: "active", permissions: ["PATIENT_VIEW_CLINICAL"] };
  const expected = clinicians.has(role);
  assert.equal(canUsePredictiveWorkspace(profile), expected);
  assert.equal(resolveCkdWorkspaceView("intelligence", profile), expected ? "intelligence" : "assessment");
  assert.equal(resolveCkdWorkspaceView("outlook", profile), expected ? "outlook" : "assessment");
  assert.equal(canUsePredictiveWorkspace({ ...profile, permissions: [] }), false);
  assert.equal(canUsePredictiveWorkspace({ ...profile, permissions: ["*"] }), expected);
  assert.equal(canUsePredictiveWorkspace({ ...profile, status: "suspended" }), false);
  assert.equal(resolveCkdWorkspaceView("unknown", profile), "assessment");
});
test("anonymous and inactive contexts cannot select the intelligence view", () => {
  assert.equal(canUsePredictiveWorkspace(null), false);
  assert.equal(resolveCkdWorkspaceView("intelligence", undefined), "assessment");
  assert.equal(resolveCkdWorkspaceView("outlook", undefined), "assessment");
});
test("old clinical links preserve a valid identifier and request the integrated view", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  const url = new URL(integratedCkdHref(`?patientId=${id}&view=assessment&role=super_admin`), "https://test.invalid");
  assert.equal(url.pathname, "/ai-cdss/ckd");
  assert.equal(url.searchParams.get("view"), "intelligence");
  assert.equal(url.searchParams.get("patientId"), id);
  assert.equal(url.searchParams.has("role"), false);
});
test("malformed identifiers and unknown query fields do not propagate through the alias", () => {
  for (const search of ["", "?patientId=not-a-uuid", "?patientId=%3Cscript%3E&hospitalId=another-tenant"]) {
    assert.equal(integratedCkdHref(search), "/ai-cdss/ckd?view=intelligence");
  }
});
test("switching patient aborts all old reads and writes", () => {
  const scope = new PatientOperationScope(), requests = [scope.begin(), scope.begin(), scope.begin()];
  requests.forEach(request => assert.equal(scope.accepts(request), true));
  scope.dispose();
  requests.forEach(request => { assert.equal(request.signal.aborted, true); assert.equal(scope.accepts(request), false); });
  assert.equal(scope.begin().signal.aborted, true);
});
test("a late response is rejected even when the transport ignores cancellation", async () => {
  const oldScope = new PatientOperationScope(), oldRequest = oldScope.begin();
  let resolve; const response = new Promise(done => { resolve = done; }), displayed = [];
  const apply = response.then(value => { if (oldScope.accepts(oldRequest)) displayed.push(value); });
  oldScope.dispose();
  const nextScope = new PatientOperationScope(), nextRequest = nextScope.begin();
  resolve("previous patient's result"); await apply;
  assert.deepEqual(displayed, []);
  assert.equal(nextScope.accepts(nextRequest), true);
  assert.equal(nextScope.accepts(oldRequest), false);
  nextScope.dispose();
});
test("completed or separately aborted requests cannot update the workspace", () => {
  const scope = new PatientOperationScope(), completed = scope.begin(), cancelled = scope.begin();
  scope.finish(completed); cancelled.abort();
  assert.equal(scope.accepts(completed), false); assert.equal(scope.accepts(cancelled), false);
  assert.equal(scope.isLive(), true); scope.dispose(); assert.equal(scope.isLive(), false);
});
