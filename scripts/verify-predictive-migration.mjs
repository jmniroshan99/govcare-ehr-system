import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

// Ephemeral PostgreSQL-compatible engine. No connection to a hospital database.
const db = new PGlite({ extensions: { pgcrypto } });
const migrationDir = new URL("../spring-api/src/main/resources/db/migration/",import.meta.url);
const hospital="00000000-0000-4000-8000-000000000001", otherHospital="00000000-0000-4000-8000-000000000002";
const patient="00000000-0000-4000-8000-000000000003", actor="00000000-0000-4000-8000-000000000004";
const recommendation="00000000-0000-4000-8000-000000000005", request="00000000-0000-4000-8000-000000000006";
let checks=0;
const check = (condition,message) => { assert.ok(condition,message); checks++; };
const rejects = async (sql,params,message) => { await assert.rejects(db.query(sql,params),undefined,message); checks++; };
try {
  const migrations=(await readdir(migrationDir)).filter(f=>/^V\d+__.*\.sql$/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
  for(const file of migrations) { await db.exec(await readFile(new URL(file,migrationDir),"utf8")); console.log(`Applied ${file}`); }
  check(migrations.some(file=>file.startsWith("V40__"))&&migrations.at(-1).startsWith("V41__"),"Complete migration chain through V41 applied with governed V40 preserved");
  await db.query("insert into hospitals(id,code,name) values($1,'PCI-TEST','Clinical test hospital'),($2,'PCI-OTHER','Other test hospital')",[hospital,otherHospital]);
  await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'PCI-PATIENT','Synthetic migration patient','1970-01-01')",[patient,hospital]);
  await db.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Synthetic test clinician','predictive-test@govcare.test','NOT_A_LOGIN_HASH','doctor')",[actor,hospital]);
  const models=await db.query("select * from predictive_model_registry");
  const trajectoryV2=models.rows.find(r=>r.model_key==="egfr_trajectory"&&r.version==="trend-linear-2.0");
  check(Boolean(trajectoryV2&&trajectoryV2.model_type==="TREND_PROJECTION"&&trajectoryV2.runtime_status==="ACTIVE"&&trajectoryV2.validation_status==="STATISTICAL_PROJECTION_NOT_CLINICALLY_VALIDATED"),"Governed eGFR trajectory v2 is active and explicitly not clinically validated");
  check(models.rows.some(r=>r.model_key==="egfr_trajectory"&&r.version==="trend-linear-1.0"&&r.runtime_status==="RETIRED"),"Unsafe trajectory v1 is retained for provenance and retired");
  check(models.rows.filter(r=>r.version==="not-installed"&&(r.model_type==="VALIDATED_EQUATION"||r.model_type==="RESEARCH_MODEL")).every(r=>r.runtime_status==="NOT_INSTALLED"),"Original uninstalled disease-probability adapters remain uninstalled");
  check(models.rows.filter(r=>["hb","urr"].includes(r.model_key)).every(r=>r.research_only&&r.status==="RESEARCH"&&r.local_validation_status==="NOT_CLINICALLY_VALIDATED"),"New available renal registry entries remain explicitly research only");
  check(models.rows.some(r=>r.model_key==="dry-weight"&&r.research_only&&r.status==="NOT_AVAILABLE"&&r.runtime_status==="NOT_INSTALLED"),"Unverifiable dry-weight model remains uninstalled");
  await db.query("insert into predictive_recommendations(id,hospital_id,patient_id,rule_key,rule_version,evidence_fingerprint,finding_snapshot) values($1,$2,$3,'test-rule','1','test-fingerprint','{}')",[recommendation,hospital,patient]);
  await rejects("insert into predictive_recommendations(id,hospital_id,patient_id,rule_key,rule_version,evidence_fingerprint,finding_snapshot) values(gen_random_uuid(),$1,$2,'foreign','1','fp','{}')",[otherHospital,patient],"Composite patient/hospital FK rejects tenant mismatch");
  await rejects("insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,evidence_fingerprint,review_version) values($1,$2,$3,$4,$5,'ACCEPT','   ','fp',1)",[hospital,patient,recommendation,actor,request],"Blank clinical reason rejected");
  await rejects("insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,evidence_fingerprint,review_version) values($1,$2,$3,$4,$5,'MODIFY','clinical reason','fp',1)",[hospital,patient,recommendation,actor,request],"Modify cannot omit revised text");
  await rejects("insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,reason_code,evidence_fingerprint,review_version) values($1,$2,$3,$4,gen_random_uuid(),'ACCEPT','clinical reason','INVENTED_CODE','fp',1)",[hospital,patient,recommendation,actor],"Unknown clinician feedback reason code rejected");
  await db.query("update predictive_recommendations set review_state='ACCEPT',version=version+1 where id=$1 and version=0",[recommendation]);
  const stale=await db.query("update predictive_recommendations set review_state='DISMISS',version=version+1 where id=$1 and version=0 returning id",[recommendation]);
  check(stale.rows.length===0,"Optimistic locking rejects stale review version");
  await db.query("insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,evidence_fingerprint,review_version) values($1,$2,$3,$4,$5,'ACCEPT','Reviewed source result','fp',1)",[hospital,patient,recommendation,actor,request]);
  await rejects("update predictive_clinician_feedback set reason='rewrite history' where patient_id=$1",[patient],"Feedback UPDATE blocked");
  await rejects("delete from predictive_clinician_feedback where patient_id=$1",[patient],"Feedback DELETE blocked");
  await rejects("insert into predictive_clinician_feedback(hospital_id,patient_id,recommendation_id,actor_id,request_id,action,reason,evidence_fingerprint,review_version) values($1,$2,$3,$4,$5,'ACCEPT','duplicate','fp',1)",[hospital,patient,recommendation,actor,request],"Duplicate request ID cannot add a second feedback event");
  const forecastInsert="insert into predictive_prediction_snapshots(id,hospital_id,patient_id,requested_by,request_id,horizon_months,model_id,status,input_snapshot,quality_snapshot,safety_snapshot,explanation,outputs) values(gen_random_uuid(),$1,$2,$3,gen_random_uuid(),$4,$5,$6,'{}','{}','{}','No model installed',$7)";
  await db.query(forecastInsert,[hospital,patient,actor,6,models.rows[0].id,"NOT_AVAILABLE","[]"]);
  await rejects(forecastInsert,[hospital,patient,actor,9,models.rows[0].id,"NOT_AVAILABLE","[]"],"Unsupported horizon rejected");
  await rejects(forecastInsert,[hospital,patient,actor,6,models.rows[0].id,"NOT_AVAILABLE",'[0.75]'],"Unavailable snapshot cannot contain fake probability");
  await rejects("delete from predictive_prediction_snapshots where patient_id=$1",[patient],"Prediction history DELETE blocked");
  await db.query("insert into predictive_model_monitoring(hospital_id,model_id,prediction_count,failure_count,latency_total_ms,input_missing_rate,model_version) values($1,$2,1,0,12,.25,'trend-linear-2.0')",[hospital,trajectoryV2.id]);
  await rejects("insert into predictive_model_monitoring(hospital_id,model_id,prediction_count,failure_count,input_missing_rate,model_version) values($1,$2,1,2,1.1,'bad')",[hospital,trajectoryV2.id],"Invalid monitoring counters and missing-rate rejected");
  await db.query("insert into predictive_audit_events(hospital_id,patient_id,actor_id,event_type) values($1,$2,$3,'TEST')",[hospital,patient,actor]);
  await rejects("update predictive_audit_events set event_type='rewritten' where patient_id=$1",[patient],"Audit UPDATE blocked");
  await rejects("delete from predictive_audit_events where patient_id=$1",[patient],"Audit DELETE blocked");
  const service=await readFile(new URL("../spring-api/src/main/java/lk/gov/health/govcare/ai/PredictiveIntelligenceService.java",import.meta.url),"utf8");
  const measurementId="00000000-0000-4000-8000-000000000007";
  const values={id:measurementId,ids:recommendation,h:hospital,p:patient,actor,request:"00000000-0000-4000-8000-000000000008",metric:"egfr",label:"eGFR",value:60,unit:"mL/min/1.73m2",normalized:60,normalizedUnit:"mL/min/1.73m2",time:"2026-10-04T10:00:00Z",low:null,high:null,fingerprint:"measurement-test-fingerprint",note:"Verified synthetic test report",model:trajectoryV2.id,elapsed:8,missing:.25,status:"AVAILABLE",version:"trend-linear-2.0"};
  const executeNamed=async(text)=>{
    const names=[],parameters=[];
    const query=text.replace(/(?<!:):([A-Za-z][A-Za-z0-9_]*)/g,(_,name)=>{if(!names.includes(name)){assert.ok(name in values,`Unknown SQL parameter ${name}`);names.push(name);parameters.push(values[name]);}return `$${names.indexOf(name)+1}`;});
    return db.query(query,parameters);
  };
  const writeBlocks=[...service.matchAll(/sql\.update\("""\n((?:(?!""")[\s\S])*?)""",\s*params\)/g)];
  const measurementQuery=writeBlocks.find(m=>m[1].includes("insert into clinical_observations"));
  const journalQuery=writeBlocks.find(m=>m[1].includes("insert into predictive_observation_entries"));
  assert.ok(measurementQuery&&journalQuery,"Production measurement writes found");
  await executeNamed(measurementQuery[1]);await executeNamed(journalQuery[1]);checks+=2;
  const savedMeasurement=await db.query("select value_numeric,effective_at,source_type from clinical_observations where id=$1",[measurementId]);
  check(Number(savedMeasurement.rows[0].value_numeric)===60&&savedMeasurement.rows[0].effective_at!=null&&savedMeasurement.rows[0].source_type==="CLINICIAN_ENTERED","Verified measurement preserves a real clinical date and source");
  await rejects("update predictive_observation_entries set source_note='rewritten' where patient_id=$1",[patient],"Measurement provenance journal UPDATE blocked");
  await rejects("delete from predictive_observation_entries where patient_id=$1",[patient],"Measurement provenance journal DELETE blocked");
  const monitoringBlock=[...service.matchAll(/sql\.update\("""\n((?:(?!""")[\s\S])*?)""",\s*values\)/g)]
    .find(match=>match[1].includes("insert into predictive_model_monitoring"));
  assert.ok(monitoringBlock,"Production monitoring upsert found");
  await executeNamed(monitoringBlock[1]);
  await executeNamed(monitoringBlock[1]);
  const monitoring=await db.query("select prediction_count,risk_distribution from predictive_model_monitoring where hospital_id=$1 and model_id=$2",[hospital,trajectoryV2.id]);
  check(Number(monitoring.rows[0].prediction_count)===3&&Number(monitoring.rows[0].risk_distribution.AVAILABLE)===2,"Repeated forecast statuses increment rather than overwrite monitoring distribution counts");
  const queryBlocks=[...service.matchAll(/sql\.list\("""\n((?:(?!""")[\s\S])*?)""",\s*params\)/g)];
  for(const match of queryBlocks) { await executeNamed(match[1]);checks++; }
  check(queryBlocks.length>=2,"Production observation/timeline queries execute against actual migrated schema");

  // Exercise the actual upgrade boundary with an immutable V37-era forecast already present.
  const upgradeDb=new PGlite({extensions:{pgcrypto}});
  try {
    for(const file of migrations.filter(file=>Number(file.match(/^V(\d+)/)[1])<40)) await upgradeDb.exec(await readFile(new URL(file,migrationDir),"utf8"));
    await upgradeDb.query("insert into hospitals(id,code,name) values($1,'UPGRADE','Upgrade test hospital')",[hospital]);
    await upgradeDb.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'UPGRADE-P','Upgrade fixture','1970-01-01')",[patient,hospital]);
    await upgradeDb.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Upgrade clinician','upgrade@govcare.test','NOT_A_LOGIN_HASH','doctor')",[actor,hospital]);
    const v1=(await upgradeDb.query("select id from predictive_model_registry where model_key='egfr_trajectory' and version='trend-linear-1.0'")).rows[0];
    const oldSnapshot="00000000-0000-4000-8000-000000000099";
    await upgradeDb.query("insert into predictive_prediction_snapshots(id,hospital_id,patient_id,requested_by,request_id,horizon_months,model_id,status,input_snapshot,quality_snapshot,safety_snapshot,outputs,explanation) values($1,$2,$3,$4,gen_random_uuid(),6,$5,'AVAILABLE','{}','{}','{}','{}','Historical v1 output')",[oldSnapshot,hospital,patient,actor,v1.id]);
    await upgradeDb.exec(await readFile(new URL(migrations.find(file=>file.startsWith("V40__")),migrationDir),"utf8"));
    const preserved=(await upgradeDb.query("select status,explanation,model_id from predictive_prediction_snapshots where id=$1",[oldSnapshot])).rows[0];
    check(preserved?.status==="AVAILABLE"&&preserved?.explanation==="Historical v1 output"&&preserved?.model_id===v1.id,"V39-to-V40 upgrade preserves immutable historical forecasts and their v1 provenance");
    const upgradedModels=(await upgradeDb.query("select version,runtime_status from predictive_model_registry where model_key='egfr_trajectory' order by version")).rows;
    check(upgradedModels.some(r=>r.version==="trend-linear-1.0"&&r.runtime_status==="RETIRED")&&upgradedModels.some(r=>r.version==="trend-linear-2.0"&&r.runtime_status==="ACTIVE"),"V40 retires v1 and activates v2 without deleting either registry record");
  } finally { await upgradeDb.close(); }
  console.log(`Predictive migration/database checks passed: ${checks}; ${migrations.length} migrations.`);
} finally { await db.close(); }
