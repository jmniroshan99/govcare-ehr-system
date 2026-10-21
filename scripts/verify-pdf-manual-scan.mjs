import assert from 'node:assert/strict';
import fs from 'node:fs';
import {counts,query,sessionPath} from './pdf-reuse-qa-db.mjs';
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8')),patient=session.patient,base='http://127.0.0.1:4002';
const auth=await fetch(base+'/api/auth/local-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:session.email,password:session.password})});assert.equal(auth.status,200);const {token}=await auth.json();
const report=query(`select id from clinical_reports where patient_id='${patient}' and hospital_id='${session.hospital}' and original_filename='07_image_only.pdf' and report_status='ACTIVE' order by created_at desc limit 1`);assert.match(report,/^[0-9a-f-]{36}$/);
async function verify(body,status=200){const response=await fetch(`${base}/api/ai-cdss/pdf/patients/${patient}/reports/${report}/verify`,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
const request={requestId:crypto.randomUUID(),confirmed:true,associationConfirmed:true,note:'SYNTHETIC QA: read Hb 10.8 g/dL directly from the image-only source; collection time verified for this test.',values:[{feature:'HemoglobinLevels',value:10.8,unit:'g/dL',observedAt:'2026-10-18T03:00:00Z'}]};
await verify({...request,values:[{...request.values[0],observedAt:'2099-01-01T00:00:00Z'}]},400);
await verify({...request,values:[{...request.values[0],unit:'ambiguous'}]},400);
const before=counts(patient),result=await verify(request);assert.equal(result.observations.length,1);assert.equal(result.observations[0].sourceVerified,true);assert.deepEqual(result.observations[0].originalExtraction,{});
const metadata=JSON.parse(query(`select source_metadata::text from clinical_observations where patient_id='${patient}' and id='${result.observations[0].observationId}'`));assert.equal(metadata.manualAddition,true);assert.equal(metadata.clinicianConfirmed,true);
assert.equal(counts(patient).predictions,before.predictions);
const after=counts(patient);assert.equal((await verify({...request,requestId:crypto.randomUUID()})).duplicate,true);assert.deepEqual(counts(patient),after);
fs.writeFileSync('verification/pdf-workflow-v59/manual-scan-verification.json',JSON.stringify({status:'passed',checks:['Image-only source without OCR supports actual explicit manual measurement verification and persistent source linkage','Future collection dates and ambiguous units rejected before saving','Manual source transcription is marked explicitly; repeat confirmation adds no observations or predictions']},null,2));console.log('Manual scan clinical verification: passed');
