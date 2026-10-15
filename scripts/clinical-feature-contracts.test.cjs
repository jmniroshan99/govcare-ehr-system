const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..');
function service(file){const calls=[],exports={};const code=ts.transpileModule(fs.readFileSync(path.join(root,file),'utf8').replaceAll('import.meta.env','__env'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 vm.runInNewContext(code,{exports,__env:{},require:name=>name.includes('apiClient')?{apiRequest:async(url,options)=>{calls.push({url,options});return{saved:true};}}:{},crypto:{randomUUID:()=>"00000000-0000-4000-8000-000000000007"},localStorage:{getItem:()=>null},URLSearchParams,console});return{exports,calls};}
const patient='00000000-0000-4000-8000-000000000001';
test('CKD assessment save retains the real feature/source/date payload at its existing endpoint',async()=>{
 const {exports:s,calls}=service('src/services/aiCdssService.ts');const values={SerumCreatinine:2,GFR:35,ACR:420,SerumElectrolytesPotassium:5.8,HemoglobinLevels:9.8};const sources={SerumCreatinine:{source:'MANUAL',clinicalDate:'2026-10-11T08:00:00Z'}};await s.predictCkd(patient,values,sources);
 assert.equal(calls[0].url,'/api/ai-cdss/ckd/predict');const body=JSON.parse(calls[0].options.body);assert.deepEqual(body.features,values);assert.deepEqual(body.sources,sources);assert.equal(body.patientId,patient);
});
test('Historical generic creatinine is sent through the existing verified-measurement API without HD relabeling',async()=>{
 const {exports:s,calls}=service('src/services/predictiveIntelligenceService.ts');const input={metric:'creatinine',value:1.6,unit:'mg/dL',observedAt:'2026-09-11T08:00:00Z',sourceVerified:true,sourceNote:'Operational source',referenceLow:null,referenceHigh:null};await s.recordVerifiedMeasurement(patient,input,'request',undefined);
 assert.equal(calls[0].url,`/api/ai-cdss/ckd/patients/${patient}/observations`);const body=JSON.parse(calls[0].options.body);assert.equal(body.metric,'creatinine');assert.equal(body.value,1.6);assert.ok(!('maintenanceHemodialysisVerified' in body));assert.ok(!('creatinine_pre' in body));
});
test('The schema-three feature mapping uses the existing six-module API path',async()=>{
 const {exports:s,calls}=service('src/services/renalIntelligenceService.ts');await s.getRenalPredictiveIntelligence(patient);assert.equal(calls[0].url,`/api/ai-cdss/ckd/patients/${patient}/predictive-intelligence`);
});
