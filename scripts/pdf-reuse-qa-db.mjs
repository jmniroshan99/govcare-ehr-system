// Native local PostgreSQL QA. Credentials stay outside the project and delivery archive.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {localDatabaseConfig} from './provision-local-role-accounts.mjs';
const env={...process.env};
for(const line of fs.readFileSync('spring-api/.env','utf8').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);if(m&&env[m[1]]===undefined)env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const db=localDatabaseConfig(env);
export const sessionPath=process.env.GOVCARE_PDF_QA_SESSION||path.join(os.homedir(),'.codex/tmp/govcare-pdf-reuse-session.json');
assert.ok(!path.resolve(sessionPath).startsWith(path.resolve('.')+path.sep),'Keep QA credentials outside the project.');
export function query(sql){
 const r=spawnSync(env.GOVCARE_PSQL_PATH||'C:/Program Files/PostgreSQL/18/bin/psql.exe',['-X','-v','ON_ERROR_STOP=1','-At','-h',db.host,'-p',db.port,'-U',db.user,'-d',db.database],{input:sql,encoding:'utf8',shell:false,env:{...env,PGPASSWORD:db.password||''}});
 assert.equal(r.status,0,`Native QA database operation failed: ${r.stderr.replace(/DETAIL:[\s\S]*/,'')}`);return r.stdout.trim();
}
export function counts(patient){assert.match(patient,/^[a-f0-9-]{36}$/);return JSON.parse(query(`select json_build_object('reports',(select count(*) from clinical_reports where patient_id='${patient}'),'documents',(select count(*) from patient_documents where patient_id='${patient}'),'observations',(select count(*) from clinical_observations where patient_id='${patient}'),'fhirObservations',(select count(*) from fhir_resource where patient_id='${patient}' and resource_type='Observation'),'documentReferences',(select count(*) from fhir_resource where patient_id='${patient}' and resource_type='DocumentReference'),'provenance',(select count(*) from fhir_resource where patient_id='${patient}' and resource_type='Provenance'),'predictions',(select count(*) from ai_ckd_predictions where patient_id='${patient}'));`));}
if(process.argv.includes('--match-printed-name')){
 const s=JSON.parse(fs.readFileSync(sessionPath,'utf8'));assert.match(s.patient,/^[a-f0-9-]{36}$/);
 query(`update patients set full_name='TEST PATIENT' where id='${s.patient}' and hospital_id in(select id from hospitals where code like 'QA-PDF-%')`);
 console.log('Dedicated QA name matches the printed PDF; synthetic facility label retained.');
}
if(process.argv.includes('--provision')){
 assert.ok(!fs.existsSync(sessionPath),'Synthetic QA session already exists; reuse it.');
 const id=()=>crypto.randomUUID(),hospital=id(),department=id(),patient=id(),mismatchPatient=id(),user=id(),doctor=id();
 const tag=id().slice(0,8),email=`pdf-qa-${tag}@govcare.test`,doctorEmail=`pdf-denied-${tag}@govcare.test`,password=`QA-${id()}-aA7!`;
 query(`begin;
 insert into hospitals(id,code,name) values('${hospital}','QA-PDF-${tag}','SYNTHETIC SOFTWARE QA — PDF reuse; not a clinical facility');
 insert into departments(id,hospital_id,code,name) values('${department}','${hospital}','QA','Software QA');
 insert into app_users(id,auth_uid,hospital_id,department_id,role,role_id,full_name,email,password_hash,permissions,status,employee_no,job_title,employment_type,joining_date,work_status,must_change_password,credentials_version)
 select '${user}','qa-pdf-${tag}','${hospital}','${department}','super_admin',id,'SYNTHETIC SOFTWARE QA','${email}',crypt('${password}',gen_salt('bf',12)),'[]','active',next_staff_employee_no(),'Software QA','temporary',current_date,'active',false,0 from roles where code='super_admin';
 insert into app_users(id,auth_uid,hospital_id,department_id,role,role_id,full_name,email,password_hash,permissions,status,employee_no,job_title,employment_type,joining_date,work_status,must_change_password,credentials_version)
 select '${doctor}','qa-denied-${tag}','${hospital}','${department}','doctor',id,'SYNTHETIC UNASSIGNED DOCTOR','${doctorEmail}',crypt('${password}',gen_salt('bf',12)),'[]','active',next_staff_employee_no(),'Software QA','temporary',current_date,'active',false,0 from roles where code='doctor';
 insert into patients(id,hospital_id,patient_no,full_name,date_of_birth,gender,created_by) values('${patient}','${hospital}','TEST-PAT-001','TEST PATIENT','1970-01-01','male','${user}'),('${mismatchPatient}','${hospital}','PDF-MISMATCH-${tag}','SYNTHETIC MISMATCH QA','1980-01-01','female','${user}');
 commit;`);
 fs.mkdirSync(path.dirname(sessionPath),{recursive:true});fs.writeFileSync(sessionPath,JSON.stringify({hospital,department,patient,mismatchPatient,user,doctor,email,doctorEmail,password},null,2),{mode:0o600,flag:'wx'});
 console.log('Created isolated synthetic QA facility, patients and two test accounts. Existing accounts and patient records were preserved.');
}
