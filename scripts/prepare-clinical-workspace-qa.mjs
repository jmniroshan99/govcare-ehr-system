import fs from 'node:fs';
import {query,sessionPath} from './pdf-reuse-qa-db.mjs';
const s=JSON.parse(fs.readFileSync(sessionPath,'utf8'));
if(!s.secondHospital){const hospital=crypto.randomUUID(),patient=crypto.randomUUID(),tag=hospital.slice(0,8);query(`begin;insert into hospitals(id,code,name) values('${hospital}','QA-PDF2-${tag}','SYNTHETIC SOFTWARE QA - second hospital');insert into patients(id,hospital_id,patient_no,full_name,date_of_birth,gender,risk_flags,created_by) values('${patient}','${hospital}','SYNTH-SECOND-${tag}','SYNTHETIC CROSS-HOSPITAL PDF QA','1962-01-01','male','["SYNTHETIC_RESEARCH_DEMONSTRATION","NOT_A_REAL_PATIENT"]'::jsonb,'${s.user}');commit;`);s.secondHospital=hospital;s.secondHospitalPatient=patient;fs.writeFileSync(sessionPath,JSON.stringify(s,null,2),{mode:0o600});}
console.log('Dedicated second synthetic QA hospital/patient ready; existing patient records were not modified.');
