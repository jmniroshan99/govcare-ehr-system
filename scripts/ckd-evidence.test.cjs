const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
function load(relative,require=()=>({})){const exports={};const code=ts.transpileModule(fs.readFileSync(path.join(__dirname,'..',relative),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;vm.runInNewContext(code,{exports,require,Date,JSON,encodeURIComponent});return exports;}
const {renalProgressionDomains}=load('src/lib/ckdClinicalRiskDashboard.ts');
test('dated history establishes a measured domain without relabeling an undated snapshot',()=>{
 const current={available:true,state:'UNDATED',value:3,observedAt:null},history=[{available:true,value:1,observedAt:'2026-09-01',label:'Creatinine',unit:'mg/dL'},{available:true,value:1.5,observedAt:'2026-10-01',label:'Creatinine',unit:'mg/dL'}];
 const data={renalDeterioration:{domains:[]},clinicalFeatureData:{current:{creatinine:current},history:{creatinine:history}}};
 const d=renalProgressionDomains(data)[0];assert.equal(d.evaluable,true);assert.equal(d.currentValue,1.5);assert.equal(d.previousValue,1);assert.equal(d.trendDirection,'RISING');assert.equal(current.value,3);assert.equal(current.observedAt,null);
});
test('one dated value or an invalid current source cannot establish the domain',()=>{
 for(const current of [{available:true,state:'UNDATED',value:3},{available:false,state:'INVALID',value:null}]) {const data={renalDeterioration:{domains:[]},clinicalFeatureData:{current:{creatinine:current},history:{creatinine:[{available:true,value:1,observedAt:'2026-09-01'}]}}};assert.equal(renalProgressionDomains(data)[0].evaluable,false);}
});
test('evidence API sends exact source values and dates through scoped endpoints',async()=>{
 const calls=[],api=load('src/services/ckdClinicalEvidenceService.ts',()=>({apiRequest:async(url,options)=>{calls.push({url,options});return {saved:true};}}));
 const input={requestId:'root-retry-id',metric:'creatinine',unit:'µmol/L',baselineValue:176.8,baselineAt:'2026-09-01T00:00:00Z',baselineSource:'Synthetic source A',currentValue:265.2,currentAt:'2026-10-01T00:00:00Z',currentSource:'Synthetic source B',sourceVerified:true};
 await api.establishClinicalTrend('patient/id',input);assert.equal(calls[0].url,'/api/ai-cdss/ckd/patients/patient%2Fid/clinical-evidence/trends');assert.equal(calls[0].options.method,'POST');assert.deepEqual(JSON.parse(calls[0].options.body),input);
 await api.verifyCkdDiabetesContext('p',{status:'UNCONFIRMED',requestId:'retry',sourceVerified:true,verifiedAt:input.currentAt,sourceNote:'Synthetic context'});assert.equal(JSON.parse(calls[1].options.body).status,'UNCONFIRMED');
});
test('synthetic creation requires its explicit marker and patient banners use the reserved prefix',async()=>{
 const calls=[],api=load('src/services/ckdClinicalEvidenceService.ts',()=>({apiRequest:async(url,options)=>{calls.push({url,options});return {synthetic:true,patients:[]};}}));
 await api.createCkdResearchDemonstrations('retry');assert.deepEqual(JSON.parse(calls[0].options.body),{requestId:'retry',acknowledgedSyntheticData:true});
 assert.equal(api.isSyntheticCkdPatient({patient_no:'SYNTH-CKD-ND-123'}),true);assert.equal(api.isSyntheticCkdPatient({patient_no:'P-123'}),false);assert.equal(api.isSyntheticCkdPatient({}),false);
});
