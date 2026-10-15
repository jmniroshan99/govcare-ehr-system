import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
const dir=new URL('../spring-api/src/main/resources/db/migration/',import.meta.url);
const db=new PGlite({extensions:{pgcrypto}}),h=crypto.randomUUID(),other=crypto.randomUUID(),patient=crypto.randomUUID(),second=crypto.randomUUID(),actor=crypto.randomUUID();
let checks=0;const reject=async(sql,args=[])=>{await assert.rejects(db.query(sql,args));checks++;};
try {
  const names=(await readdir(dir)).filter(f=>/^V\d+__/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
  for(const file of names)await db.exec(await readFile(new URL(file,dir),'utf8'));
  await db.query("insert into hospitals(id,code,name) values($1,'OUTLOOK-QA','Synthetic outlook test'),($2,'OUTLOOK-OTHER','Other synthetic tenant')",[h,other]);
  await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'OUTLOOK-P','SYNTHETIC SOFTWARE FIXTURE','1961-02-01'),($3,$2,'OUTLOOK-Q','SECOND SYNTHETIC FIXTURE','1970-01-01')",[patient,h,second]);
  await db.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Synthetic verifier','outlook-db@example.invalid','NOT_A_LOGIN_HASH','doctor')",[actor,h]);
  const insert="insert into ckd_outlook_snapshots(id,hospital_id,patient_id,requested_by,request_id,request_fingerprint,evidence_fingerprint,status,model_version,outputs) values($1,$2,$3,$4,$5,$6,$6,$7,'KFRE4-NNA-2016-GOVCARE-1.0',$8)";
  const snapshot=(id,p=patient,hospital=h,status='AVAILABLE',two=.09,five=.30)=>({id,patientId:p,hospitalId:hospital,status,model:{version:'KFRE4-NNA-2016-GOVCARE-1.0'},evidence:{},twoYearRisk:two,fiveYearRisk:five});
  const save=async(options={})=>{const {id=crypto.randomUUID(),p=patient,hospital=h,status='AVAILABLE',two=.09,five=.30,request=crypto.randomUUID(),body}=options;await db.query(insert,[id,hospital,p,actor,request,'a'.repeat(64),status,JSON.stringify(body??snapshot(id,p,hospital,status,two,five))]);return id;};
  const id=await save();assert.equal((await db.query('select count(*)::int n from ckd_outlook_snapshots where hospital_id=$1 and patient_id=$2',[h,patient])).rows[0].n,1);checks++;
  assert.equal((await db.query('select count(*)::int n from ckd_outlook_snapshots where hospital_id=$1',[other])).rows[0].n,0);checks++;
  await assert.rejects(save({hospital:other}));checks++;
  const malformed=crypto.randomUUID();await assert.rejects(save({id:malformed,body:snapshot(malformed,second)}));checks++;
  for(const [two,five] of [[-.1,.3],[.2,1.1],[.8,.2],[null,.3],[.1,null]]){await assert.rejects(save({two,five}));checks++;}
  await assert.rejects(save({status:'INSUFFICIENT_DATA',two:0,five:0}));checks++;
  await save({status:'INSUFFICIENT_DATA',two:null,five:null});checks++;
  await reject('update ckd_outlook_snapshots set outputs=jsonb_set(outputs,\'{fiveYearRisk}\',\'1\') where id=$1',[id]);
  await reject('delete from ckd_outlook_snapshots where id=$1',[id]);
  const request=crypto.randomUUID();await save({request});await assert.rejects(save({request}));checks++;
  const review="insert into ckd_outlook_reviews(hospital_id,patient_id,snapshot_id,actor_id,request_id,action,reason,modified_interpretation,milestones,review_version,input_fingerprint) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)";
  await db.query(review,[h,patient,id,actor,crypto.randomUUID(),'ACCEPT','Synthetic review',null,JSON.stringify([{year:1,title:'Clinician-defined review'}]),1,'b'.repeat(64)]);checks++;
  await reject(review,[h,second,id,actor,crypto.randomUUID(),'ACCEPT','Wrong patient',null,'[]',2,'b'.repeat(64)]);
  await reject(review,[other,patient,id,actor,crypto.randomUUID(),'ACCEPT','Wrong hospital',null,'[]',2,'b'.repeat(64)]);
  await reject(review,[h,patient,id,actor,crypto.randomUUID(),'MODIFY','Missing interpretation',null,'[]',2,'b'.repeat(64)]);
  await reject(review,[h,patient,id,actor,crypto.randomUUID(),'ACCEPT','',null,'[]',2,'b'.repeat(64)]);
  await reject(review,[h,patient,id,actor,crypto.randomUUID(),'ACCEPT','Duplicate version',null,'[]',1,'b'.repeat(64)]);
  await reject('update ckd_outlook_reviews set reason=\'overwrite\' where snapshot_id=$1',[id]);
  await reject('delete from ckd_outlook_reviews where snapshot_id=$1',[id]);
  const report={status:'passed',checks,migrations:names.length,lastMigration:names.at(-1),engine:'PGlite PostgreSQL WASM; native Windows PostgreSQL not verified',scope:'Additive schema, immutable evidence/reviews, tenant/patient foreign keys, idempotency, explicit null risks, ordered 2/5-year probabilities'};
  const output=new URL('../verification/ckd-outlook-v54/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('database-report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await db.close();}
