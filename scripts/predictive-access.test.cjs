const test = require("node:test"), assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), ts = require("typescript");
const root=path.resolve(__dirname,".."),cache=new Map();
function load(file) {
  const absolute=path.resolve(root,file);if(cache.has(absolute))return cache.get(absolute).exports;
  const module={exports:{}};cache.set(absolute,module);
  const code=ts.transpileModule(fs.readFileSync(absolute,"utf8"),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const localRequire=name=>name.startsWith(".")?load(path.resolve(path.dirname(absolute),name)+".ts"):require(name);
  new Function("require","exports","module",code)(localRequire,module.exports,module);return module.exports;
}
const {allRoles}=load("src/lib/rbac.ts"),{canAccessPath}=load("src/lib/roleAccess.ts");
const route="/ai-cdss/ckd/predictive-intelligence",clinicians=new Set(["super_admin","doctor","surgeon","anesthetist"]);
for(const role of allRoles) test(`Clinical intelligence route follows server clinical-role boundary: ${role}`,()=>{
  const profile={uid:"test",role,hospitalId:"tenant-test",status:"active",permissions:["PATIENT_VIEW_CLINICAL"]};
  assert.equal(canAccessPath(profile,route),clinicians.has(role));
  assert.equal(canAccessPath({...profile,permissions:[]},route),false);
  assert.equal(canAccessPath({...profile,status:"suspended"},route),false);
  assert.equal(canAccessPath({...profile,permissions:["*"]},route),clinicians.has(role));
  assert.equal(canAccessPath(profile,route+"-lookalike"),false);
});
