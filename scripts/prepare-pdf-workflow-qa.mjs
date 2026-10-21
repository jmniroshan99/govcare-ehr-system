// Designate only the two pre-existing isolated QA patients; never infer test status from a name in production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {query,sessionPath} from './pdf-reuse-qa-db.mjs';
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8'));
for(const patient of [session.patient,session.mismatchPatient]){
 assert.match(patient,/^[a-f0-9-]{36}$/);
 assert.equal(query(`select count(*) from patients p join hospitals h on h.id=p.hospital_id where p.id='${patient}' and h.id='${session.hospital}' and h.code like 'QA-PDF-%'`),'1');
 query(`update patients set risk_flags=(select jsonb_agg(distinct value) from jsonb_array_elements(coalesce(risk_flags,'[]'::jsonb)||'["SYNTHETIC_RESEARCH_DEMONSTRATION","NOT_A_REAL_PATIENT"]'::jsonb)) where id='${patient}' and hospital_id='${session.hospital}'`);
}
if(!session.strictPatient){session.strictPatient=crypto.randomUUID();query(`insert into patients(id,hospital_id,patient_no,full_name,date_of_birth,gender,created_by) values('${session.strictPatient}','${session.hospital}','QA-STRICT-${session.strictPatient.slice(0,8)}','SYNTHETIC QA - strict identity policy control','1970-01-01','male','${session.user}')`);fs.writeFileSync(sessionPath,JSON.stringify(session,null,2),{mode:0o600});}
console.log('Two isolated QA patients designated synthetic; unmarked QA control retained for strict identity tests.');
