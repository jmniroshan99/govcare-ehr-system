const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),exportsObject={};
const code=ts.transpileModule(fs.readFileSync(path.join(root,'src/lib/ckdClinicalRiskDashboard.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
vm.runInNewContext(code,{exports:exportsObject,require:()=>({})});
const {clinicalCompleteness,clinicalMonitoringPresentation,clinicalTrendPoints}=exportsObject;
const moduleFor=(clinical,readiness={})=>({key:'anemia',status:'AVAILABLE',signal:'STABLE_HB',usablePoints:1,readiness:{ready:true,requirements:[],...readiness},clinicalAssessment:clinical});
test('unknown and absent monitoring evidence cannot become 100% complete or low risk',()=>{
 const empty=moduleFor(null,{ready:false});assert.equal(clinicalCompleteness(empty).percent,null);assert.equal(clinicalMonitoringPresentation(empty).status,'Data required');assert.equal(clinicalMonitoringPresentation(empty).risk,'Not assessed');
 const missing=moduleFor(null,{ready:false,requirements:[{required:true,satisfied:false},{required:true,satisfied:false}]});assert.equal(clinicalCompleteness(missing).percent,0);
});
test('one reassuring Hb snapshot is monitoring, not a demonstrated stable trajectory',()=>{
 const m=moduleFor({riskLevel:'Normal',featuresUsed:[{key:'hemoglobin',state:'AVAILABLE',observedAt:'2026-10-01'}],trend:{ready:false}});assert.equal(clinicalMonitoringPresentation(m).status,'Monitoring');assert.equal(clinicalTrendPoints(m).length,0);
});
test('historical evidence and urgent review signals remain explicit',()=>{
 const stale=moduleFor({riskLevel:'Normal',featuresUsed:[{key:'hemoglobin',state:'STALE',observedAt:'2026-01-01'}]});assert.equal(clinicalMonitoringPresentation(stale).status,'Verify measurement date');
 const high=moduleFor({riskLevel:'High',featuresUsed:[{key:'hemoglobin',state:'UNDATED',observedAt:null}]});assert.equal(clinicalMonitoringPresentation(high).status,'Source review recommended');assert.equal(clinicalMonitoringPresentation(high).tone,'danger');
});
test('all measured trend charts require a dated pair and use chronological observations',()=>{
 const m=moduleFor({featuresUsed:[],trend:{ready:true,points:[{value:11,observedAt:'2026-10-10'},{value:12,observedAt:'2026-09-10'},{value:NaN,observedAt:'2026-10-12'},{value:10,observedAt:null}]}});const points=clinicalTrendPoints(m);assert.equal(points.length,2);assert.equal(points[0].value,12);assert.equal(points[1].value,11);
});
test('readiness denominator follows the declared monitoring inputs rather than a risk score',()=>{
 const m=moduleFor({featuresUsed:[],dataReadiness:{availableCount:2,requiredCount:5,percent:40}});assert.equal(clinicalCompleteness(m).percent,40);assert.equal(clinicalCompleteness(m).missing,3);
});
