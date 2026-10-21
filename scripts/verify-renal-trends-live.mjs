import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const output=path.resolve('verification/renal-trends-v56');fs.mkdirSync(output,{recursive:true});
const env={...process.env};
for(const line of fs.readFileSync('spring-api/.env','utf8').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&env[m[1]]===undefined)env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const url=new URL((env.DB_URL||'jdbc:postgresql://localhost:5432/govcare_ehr_v2').replace(/^jdbc:/,''));
assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname));
const psql=env.GOVCARE_PSQL_PATH||'C:/Program Files/PostgreSQL/18/bin/psql.exe';
const sql=`select json_build_object(
 'renal_verified_sessions',(select count(*) from sri_lankan_renal_observations where source_verified),
 'ckd_assessments',(select count(*) from ai_ckd_predictions),
 'clinical_features',(select count(*) from clinical_prediction_features),
 'clinical_observations',(select count(*) from clinical_observations where status='FINAL'),
 'clinical_observations_without_collection_date',(select count(*) from clinical_observations o left join clinical_reports r on r.id=o.report_id where o.status='FINAL' and coalesce(o.effective_at,r.specimen_collected_at) is null),
 'verified_manual_entries',(select count(*) from predictive_observation_entries),
 'lab_results',(select count(*) from lab_results where status not in ('deleted','cancelled')),
 'lab_results_with_verified_collection',(select count(*) from lab_results l join lab_requests q on q.id=l.lab_request_id where l.verified_by is not null and l.verified_at is not null and q.sample_collected_at is not null),
 'cbc_reports',(select count(*) from lab_blood_reports where status<>'CANCELLED'),
 'cbc_with_verified_collection',(select count(*) from lab_blood_reports where verified_by is not null and verified_at is not null and collected_at is not null and status in ('VERIFIED','RELEASED')),
 'fhir_observations',(select count(*) from fhir_resource where resource_type='Observation'));`;
const result=spawnSync(psql,['-X','-v','ON_ERROR_STOP=1','-At','-h',url.hostname,'-p',url.port||'5432','-U',env.DB_USERNAME||'postgres','-d',url.pathname.slice(1),'-c',sql],{encoding:'utf8',shell:false,env:{...env,PGPASSWORD:env.DB_PASSWORD||''}});
assert.equal(result.status,0,result.stderr);const sourceCounts=JSON.parse(result.stdout.trim());
fs.writeFileSync(path.join(output,'source-audit.json'),JSON.stringify({scope:'Read-only aggregate counts across the local database; no patient identifiers or measurements exported.',sourceCounts},null,2));
// Execute the exact production source queries, read-only, without exporting clinical rows.
function query(statement){
 const r=spawnSync(psql,['-X','-v','ON_ERROR_STOP=1','-At','-h',url.hostname,'-p',url.port||'5432','-U',env.DB_USERNAME||'postgres','-d',url.pathname.slice(1),'-c',statement],{encoding:'utf8',shell:false,env:{...env,PGPASSWORD:env.DB_PASSWORD||''}});
 assert.equal(r.status,0,r.stderr);return r.stdout.trim();
}
const [patientId,hospitalId]=query('select p.id,p.hospital_id from patients p left join clinical_observations o on o.patient_id=p.id and o.hospital_id=p.hospital_id group by p.id,p.hospital_id order by count(o.id) desc,p.id limit 1').split('|');
assert.match(patientId,/^[a-f0-9-]{36}$/);assert.match(hospitalId,/^[a-f0-9-]{36}$/);
const source=fs.readFileSync('spring-api/src/main/java/lk/gov/health/govcare/ai/ClinicalPredictionFeatureService.java','utf8');
const queries=[...source.matchAll(/sql\.list\("""([\s\S]*?)""",p\)/g)].map(m=>m[1]);assert.equal(queries.length,3);
const nativeQueries=queries.map((q,index)=>({query:index+1,returnedRows:Number(query(`select count(*) from (${q.replace(/:h\b/g,`'${hospitalId}'::uuid`).replace(/:p\b/g,`'${patientId}'::uuid`).replace(/:cutoff\b/g,'null')}) source_audit`))}));
fs.writeFileSync(path.join(output,'native-source-queries.json'),JSON.stringify({status:'passed',scope:'Exact three production clinical/laboratory/FHIR SQL statements executed read-only against native PostgreSQL. Counts only; no patient identifiers or clinical values exported.',nativeQueries},null,2));
const accounts=JSON.parse(fs.readFileSync(process.env.GOVCARE_TRENDS_ACCOUNTS||'database/postgresql/local-role-credentials.json','utf8').replace(/^\uFEFF/,''));
const doctor=accounts.find(a=>a.role==='doctor');assert.ok(doctor);
const base=process.env.GOVCARE_TRENDS_API||'http://127.0.0.1:4012';let token;
async function request(route,options={}){
 const response=await fetch(new URL(route,base),{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})}});
 let data;try{data=await response.json();}catch{}
 return {response,data};
}
let r=await request('/api/auth/local-login',{method:'POST',body:JSON.stringify({email:doctor.email,password:doctor.password})});
if(r.response.status!==200){const report={status:'blocked',sourceQueries:'passed',boundary:'Local doctor sign-in',httpStatus:r.response.status,reason:'Saved local doctor credentials were rejected. No passwords or account permissions changed. Authenticated patient/API/PDF flow is not claimed as verified.'};fs.writeFileSync(path.join(output,'live-api.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));process.exitCode=1;}else{
token=r.data.token;assert.ok(token);
r=await request('/api/ai-cdss/ckd/patients?page=0&size=10');assert.equal(r.response.status,200);assert.ok(r.data.items.length);
const results=[];
for(const patient of r.data.items.slice(0,3)){
 const history=await request(`/api/ai-cdss/ckd/patients/${patient.id}/predictive-intelligence`);assert.equal(history.response.status,200,`Authorized timeline failed: HTTP ${history.response.status}; reference ${history.data?.errorId||'unavailable'}`);
 assert.equal(history.data.patientId,patient.id);assert.ok(history.data.renalTimeline?.version);
 const t=history.data.renalTimeline;for(const rows of Object.values(t.series))for(const row of rows){assert.equal(row.sourceVerified,true);assert.equal(row.included,true);assert.ok(Number.isFinite(Date.parse(row.observedAt)));}
 results.push({patientIndex:results.length+1,status:t.status,sources:t.sourceCount,verifiedDatedCount:t.verifiedDatedCount,assessmentCount:history.data.clinicalFeatureData?.assessmentCount});
}
const denied=await request('/api/ai-cdss/ckd/patients/00000000-0000-4000-8000-000000000099/predictive-intelligence');assert.ok([403,404].includes(denied.response.status));
token=undefined;const unauthenticated=await request(`/api/ai-cdss/ckd/patients/${r.data.items[0].id}/predictive-intelligence`);assert.ok([401,403].includes(unauthenticated.response.status));
const report={status:'passed',scope:'Native PostgreSQL + authenticated Spring API; existing authorized records only. No laboratory or prediction mutations. Existing overview writes normal audit/module snapshot records.',patientsChecked:results,unauthorizedStatus:denied.response.status,unauthenticatedStatus:unauthenticated.response.status};
fs.writeFileSync(path.join(output,'live-api.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({status:report.status,patients:results.length,sourceCounts}));
}
