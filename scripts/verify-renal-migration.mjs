import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,readdir} from 'node:fs/promises';

// Disposable database fixtures are operational tests, never clinical validation subjects.
const db=new PGlite({extensions:{pgcrypto}}),dir=new URL('../spring-api/src/main/resources/db/migration/',import.meta.url);
const h='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
const p='00000000-0000-4000-8000-000000000003',actor='00000000-0000-4000-8000-000000000004';
const session='00000000-0000-4000-8000-000000000005',prediction='00000000-0000-4000-8000-000000000006';
let checks=0;
const check=(v,m)=>{assert.ok(v,m);checks++;};
const rejects=async(query,args,m)=>{await assert.rejects(db.query(query,args),undefined,m);checks++;};
try {
  const migrations=(await readdir(dir)).filter(f=>/^V\d+__/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
  for(const f of migrations)await db.exec(await readFile(new URL(f,dir),'utf8'));
  await db.query("insert into hospitals(id,code,name) values($1,'RENAL-TEST','Operational renal fixture'),($2,'RENAL-OTHER','Other tenant')",[h,other]);
  await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'RENAL-TEST-P','Operational fixture — not clinical cohort','1970-01-01')",[p,h]);
  await db.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Operational clinician','renal-test@govcare.test','NOT_A_LOGIN_HASH','doctor')",[actor,h]);
  const observedAt=new Date(Date.now()-86400000).toISOString();
  const obsSql="insert into sri_lankan_renal_observations(id,hospital_id,patient_id,observed_at,maintenance_hemodialysis_verified,measurements,units,source_note,source_verified,actor_id,request_id,input_fingerprint) values($1,$2,$3,$5,true,'{\"hb\":10.5}','{\"hb\":\"g/dL\"}','Verified operational fixture',true,$4,gen_random_uuid(),repeat('a',64))";
  await db.query(obsSql,[session,h,p,actor,observedAt]);check(true,'Verified source observation persists');
  await rejects(obsSql,[crypto.randomUUID(),other,p,actor,observedAt],'Tenant mismatch denied');
  await rejects(obsSql,[crypto.randomUUID(),h,p,actor,observedAt],'Duplicate patient session date denied');
  await rejects("update sri_lankan_renal_observations set source_note='changed' where id=$1",[session],'Measured source rows append only');
  await rejects("delete from sri_lankan_renal_observations where id=$1",[session],'Measured source delete denied');
  const model=(await db.query("select id from predictive_model_registry where model_key='hb' and version='1.0.0'")).rows[0].id;
  const out={model_key:'hb',status:'AVAILABLE',model_version:'1.0.0',prediction:10.5,probability:null,clinical_validation:'NOT_COMPLETED',dataset_permission_status:'UNVERIFIED',requires_clinician_review:true};
  const insert="insert into predictive_prediction_snapshots(id,hospital_id,patient_id,requested_by,request_id,horizon_months,model_id,model_key,status,input_snapshot,quality_snapshot,safety_snapshot,outputs,explanation,model_version) values($1,$2,$3,$4,gen_random_uuid(),1,$5,'hb','AVAILABLE','{}','{}','{}',$6,'Research fixture','1.0.0')";
  await db.query(insert,[prediction,h,p,actor,model,JSON.stringify(out)]);check(true,'Structured prediction persists with no fake probability');
  for(const bad of [{...out,probability:.9},{...out,prediction:null},{...out,prediction:99},{...out,clinical_validation:'CLINICALLY_VALIDATED'},{...out,requires_clinician_review:false},{...out,model_key:'urr'},{model_key:'hb',status:'AVAILABLE'}])
    await rejects(insert,[crypto.randomUUID(),h,p,actor,model,JSON.stringify(bad)],'Unsafe or incomplete output contract rejected');
  const hyperModel=(await db.query("select id from predictive_model_registry where model_key='hyperkalemia' and version='1.0.0'")).rows[0].id;
  const hyperOut={model_key:'hyperkalemia',status:'AVAILABLE',model_version:'1.0.0',prediction:null,probability:.42,risk_category:'RESEARCH_RISK_SCORE',clinical_validation:'NOT_COMPLETED',dataset_permission_status:'UNVERIFIED',requires_clinician_review:true};
  const hyperInsert="insert into predictive_prediction_snapshots(id,hospital_id,patient_id,requested_by,request_id,horizon_months,model_id,model_key,status,input_snapshot,quality_snapshot,safety_snapshot,outputs,explanation,model_version) values($1,$2,$3,$4,gen_random_uuid(),1,$5,'hyperkalemia','AVAILABLE','{}','{}','{}',$6,'Research hyperkalemia fixture','1.0.0')";
  const hyperPrediction=crypto.randomUUID();
  await db.query(hyperInsert,[hyperPrediction,h,p,actor,hyperModel,JSON.stringify(hyperOut)]);check(true,'Hyperkalemia research probability persists with explicit null numeric prediction');
  for(const bad of [{...hyperOut,probability:1.1},{...hyperOut,probability:-.1},{...hyperOut,prediction:5.8},{...hyperOut,risk_category:'HIGH'},{...hyperOut,clinical_validation:'CLINICALLY_VALIDATED'},{...hyperOut,requires_clinician_review:false}])
    await rejects(hyperInsert,[crypto.randomUUID(),h,p,actor,hyperModel,JSON.stringify(bad)],'Unsafe hyperkalemia probability contract rejected');
  const review="insert into sri_lankan_renal_review_events(hospital_id,patient_id,prediction_id,actor_id,request_id,action,reason,review_version,input_fingerprint,model_key,model_version,prediction_snapshot,modified_interpretation) values($1,$2,$3,$4,gen_random_uuid(),$5,$6,$7,repeat('b',64),'hb','1.0.0',$8,$9)";
  await rejects(review,[h,p,prediction,actor,'ACCEPT',' ',1,JSON.stringify(out),null],'Blank review reason denied');
  await rejects(review,[h,p,prediction,actor,'MODIFY','Reason',1,JSON.stringify(out),null],'Modify requires interpretation');
  await rejects(review,[other,p,prediction,actor,'ACCEPT','Reason',1,JSON.stringify(out),null],'Cross-tenant feedback denied');
  await db.query(review,[h,p,prediction,actor,'ACCEPT','Operational review only',1,JSON.stringify(out),null]);
  const hyperReview="insert into sri_lankan_renal_review_events(hospital_id,patient_id,prediction_id,actor_id,request_id,action,reason,review_version,input_fingerprint,model_key,model_version,prediction_snapshot,modified_interpretation) values($1,$2,$3,$4,gen_random_uuid(),'DEFER','Research calibration review',1,repeat('c',64),'hyperkalemia','1.0.0',$5,null)";
  await db.query(hyperReview,[h,p,hyperPrediction,actor,JSON.stringify(hyperOut)]);check(true,'Hyperkalemia output supports append-only clinician review');
  await rejects(review,[h,p,prediction,actor,'DEFER','Reason',1,JSON.stringify(out),null],'Duplicate review version denied');
  await rejects("update sri_lankan_renal_review_events set reason='changed' where prediction_id=$1",[prediction],'Feedback immutable');
  await rejects("delete from predictive_prediction_snapshots where id=$1",[prediction],'Prediction immutable');
  check((await db.query('select count(*)::int n from sri_lankan_renal_review_events')).rows[0].n===2,'Exactly two immutable feedback events');
  console.log(`Renal migration persistence checks passed: ${checks}; full ${migrations.length}-migration chain.`);
}finally{await db.close();}
