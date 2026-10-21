// Preview-only verification against the actual importer; clinical record counts must stay unchanged.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {counts,sessionPath} from './pdf-reuse-qa-db.mjs';
const folder='output/pdf/GovCare_Clinical_PDF_Test_Pack_10';
const expected=JSON.parse(fs.readFileSync(path.join(folder,'expected_results.json'),'utf8'));
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8'));
const base='http://127.0.0.1:4002';
const login=await fetch(base+'/api/auth/local-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:session.email,password:session.password})});
assert.equal(login.status,200,'Synthetic QA sign-in failed');const{token}=await login.json();
const before=counts(session.patient),batch={reports:[]};
// Match the application's independent file requests, rather than an aggregate multipart upload.
for(const spec of expected.cases){
 const form=new FormData();form.append('patientId',session.patient);form.append('file',new Blob([fs.readFileSync(path.join(folder,spec.file))],{type:'application/pdf'}),spec.file);
 const response=await fetch(base+'/api/ai-cdss/pdf/extract',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:form});
 assert.equal(response.status,200,spec.file);batch.reports.push(await response.json());
}
assert.equal(batch.reports.length,10);
const results=[];
for(let i=0;i<10;i++){
 const spec=expected.cases[i],actual=batch.reports[i];assert.equal(actual.status,spec.expectedStatus,`${spec.file}: ${JSON.stringify(actual)}`);assert.equal(actual.detectedCount,spec.expectedDetectedCount,spec.file);
 assert.equal(actual.fingerprint,spec.sha256,spec.file);
 for(const[feature,value]of Object.entries(spec.expectedNormalizedValues)){
  assert.ok(Math.abs(actual.extractedValues[feature]?.value-value)<.0011,`${spec.file} ${feature}: expected ${value}, got ${actual.extractedValues[feature]?.value}`);
  if(spec.specimenCollectionTime)assert.equal(actual.extractedValues[feature].clinicalDate,spec.specimenCollectionTime);else assert.equal(actual.extractedValues[feature].clinicalDate,undefined);
 }
 results.push({file:spec.file,status:actual.status,detectedCount:actual.detectedCount,identityStatus:actual.identityStatus,normalizedValues:Object.fromEntries(Object.entries(actual.extractedValues).map(([key,value])=>[key,value.value]))});
}
assert.equal(batch.reports[0].fingerprint,batch.reports[8].fingerprint);assert.notEqual(batch.reports[0].fingerprint,batch.reports[9].fingerprint);assert.deepEqual(counts(session.patient),before);
const evidence={status:'passed',scope:'All ten generated files previewed against the running Spring importer and native PostgreSQL synthetic QA patient; no source save or assessment executed',results,clinicalCountsBefore:before,clinicalCountsAfter:counts(session.patient)};
fs.writeFileSync(path.join(folder,'live-import-verification.json'),JSON.stringify(evidence,null,2));console.log(JSON.stringify({status:evidence.status,results,clinicalCountsUnchanged:true},null,2));
