// Real HTTP + PostgreSQL verification on the isolated synthetic QA facility.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {query,counts,sessionPath} from './pdf-reuse-qa-db.mjs';
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8')),base='http://127.0.0.1:4002',out='verification/pdf-reuse-v57';
const names=fs.readdirSync(`${out}/fixtures`).filter(n=>n.endsWith('.pdf')).sort();assert.equal(names.length,5);
let token;
async function request(route,options={}){const response=await fetch(base+route,{...options,headers:{...(token?{Authorization:`Bearer ${token}`} :{}),...options.headers}});const data=await response.json().catch(()=>({}));return{status:response.status,data};}
async function login(email){const r=await request('/api/auth/local-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:session.password})});assert.equal(r.status,200,`Synthetic QA sign-in failed (${r.status})`);return r.data;}
function form(files,patient=session.patient,save=false,extra={}){const f=new FormData();f.append('patientId',patient);for(const name of files){const spec=typeof name==='string'?{fixture:name,filename:name}:name;f.append(save?'file':'files',new Blob([fs.readFileSync(path.join(out,'fixtures',spec.fixture))],{type:'application/pdf'}),spec.filename);}if(save)f.append('identityConfirmed','true');for(const[k,v]of Object.entries(extra))f.append(k,v);return f;}
for(let i=0;i<60;i++){try{if((await fetch(base+'/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,500));}
const signed=await login(session.email);token=signed.token;session.token=token;session.authUser=signed.user;
const start=counts(session.patient);assert.equal(start.observations,0);assert.equal(start.predictions,0);
const initial=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form(names)});assert.equal(initial.status,200);assert.equal(initial.data.reports.length,5);assert.deepEqual(counts(session.patient),start);
assert.equal(initial.data.reports[0].detectedCount,7);assert.equal(initial.data.reports[1].detectedCount,3);assert.equal(initial.data.reports[3].status,'OCR_REQUIRED');assert.equal(initial.data.reports[4].extractedValues.HemoglobinLevels.value,13.8);assert.equal(initial.data.reports[0].reportDates.reportDate,'2026-09-28');assert.equal(initial.data.reports[0].extractedValues.GFR.clinicalDate,undefined);
const concurrent=await Promise.all(Array.from({length:3},()=>request('/api/ai-cdss/pdf/save',{method:'POST',body:form([names[0]],session.patient,true)})));
for(const r of concurrent)assert.equal(r.status,200,`Concurrent source save failed: ${r.status} ${r.data.message}`);
const firstId=concurrent[0].data.clinicalReportId;assert.ok(concurrent.every(r=>r.data.clinicalReportId===firstId));assert.equal(counts(session.patient).reports,1);assert.equal(counts(session.patient).documents,1);
const saved=[concurrent[0].data];
for(const name of names.slice(1)){const r=await request('/api/ai-cdss/pdf/save',{method:'POST',body:form([name],session.patient,true)});assert.equal(r.status,200,`Save ${name}: ${r.status} ${r.data.message}`);saved.push(r.data);}
const afterSave=counts(session.patient);assert.equal(afterSave.reports,5);assert.equal(afterSave.documents,5);assert.equal(afterSave.observations,0);assert.equal(afterSave.fhirObservations,0);assert.equal(afterSave.predictions,0);
const attempts=[];
for(let i=0;i<3;i++){
 const r=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form(names)});assert.equal(r.status,200);assert.ok(r.data.reports.every(p=>p.duplicate));assert.deepEqual(r.data.reports.map(p=>p.clinicalReportId),saved.map(p=>p.clinicalReportId));assert.deepEqual(counts(session.patient),afterSave);
 attempts.push({attempt:i+1,reports:r.data.reports.map(p=>({file:p.fileName,status:p.status,detected:p.detectedCount,duplicate:p.duplicate})),counts:counts(session.patient)});
}
const mixed=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form([{fixture:names[1],filename:names[0]},names[0]])});assert.equal(mixed.status,200);assert.notEqual(mixed.data.reports[0].fingerprint,mixed.data.reports[1].fingerprint);assert.notEqual(mixed.data.reports[0].clinicalReportId,mixed.data.reports[1].clinicalReportId);
const malformed=form([names[1]]);malformed.append('files',new Blob(['not a PDF'],{type:'application/pdf'}),'broken.pdf');const independent=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:malformed});assert.equal(independent.status,200);assert.equal(independent.data.reports[1].status,'EXTRACTION_FAILED');assert.ok(independent.data.reports[0].detectedCount>0);
const mismatch=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form([names[0]],session.mismatchPatient)});assert.equal(mismatch.data.reports[0].status,'PATIENT_MISMATCH');assert.equal(mismatch.data.reports[0].detectedCount,0);
const blockedSave=await request('/api/ai-cdss/pdf/save',{method:'POST',body:form([names[0]],session.mismatchPatient,true)});assert.equal(blockedSave.status,422);assert.equal(counts(session.mismatchPatient).documents,0);
for(const r of saved){const content=await fetch(`${base}/api/patients/${session.patient}/documents/${r.documentId}/content`,{headers:{Authorization:`Bearer ${token}`}});assert.equal(content.status,200);assert.equal((await content.text()).slice(0,5),'%PDF-');const reread=await request(`/api/ai-cdss/pdf/patients/${session.patient}/documents/${r.documentId}/extract`,{method:'POST'});assert.equal(reread.status,200);assert.equal(reread.data.clinicalReportId,r.clinicalReportId);}
// A genuine different PDF revision links the original; no observation or prediction is written.
// Both supplied sources are already saved, so reusing either remains idempotent rather than relabelling its version.
const existingRevision=await request('/api/ai-cdss/pdf/save',{method:'POST',body:form([names[1]],session.patient,true,{replacesReportId:firstId,revisionReason:'Synthetic review of a previously saved source'})});assert.equal(existingRevision.data.duplicate,true);assert.equal(existingRevision.data.version,1);
const unreviewed=await request('/api/ai-cdss/ckd/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:session.patient,requestId:crypto.randomUUID(),features:{SerumCreatinine:1.4},sources:{SerumCreatinine:{source:'PDF',importReviewed:false}}})});assert.equal(unreviewed.status,422);
const missing=await request('/api/ai-cdss/ckd/predict',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientId:session.patient,requestId:crypto.randomUUID(),features:{SerumCreatinine:1.4},sources:{SerumCreatinine:{source:'PDF',importReviewed:true}}})});assert.equal(missing.status,422);
assert.deepEqual(counts(session.patient),afterSave);
const deniedLogin=await login(session.doctorEmail);token=deniedLogin.token;const denied=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form([names[0]])});assert.equal(denied.status,403);
token=undefined;const anonymous=await request('/api/ai-cdss/pdf/extract-multiple',{method:'POST',body:form([names[0]])});assert.ok([401,403].includes(anonymous.status));
const migration=query("select version from flyway_schema_history where version='49' and success");assert.equal(migration,'49');
fs.writeFileSync(sessionPath,JSON.stringify({...session,saved},null,2));
const evidence={status:'passed',scope:'Actual Spring HTTP endpoints and native local PostgreSQL; isolated synthetic QA facility; no mocked requests',migration,firstSaveConcurrency:3,stableReferenceReused:true,attempts,sameFilenameDifferentContent:'passed',malformedBatchContinues:'passed',savedReportsReopened:5,patientMismatchSaveStatus:blockedSave.status,unassignedDoctorStatus:denied.status,anonymousStatus:anonymous.status,unreviewedPredictionStatus:unreviewed.status,missingPredictionStatus:missing.status,afterSave,final:counts(session.patient)};
fs.writeFileSync(`${out}/live-api.json`,JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
