import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
const directory=new URL('../spring-api/src/main/resources/db/migration/',import.meta.url);
const db=new PGlite({extensions:{pgcrypto}});
const h=crypto.randomUUID(),other=crypto.randomUUID(),patient=crypto.randomUUID(),second=crypto.randomUUID(),actor=crypto.randomUUID();
let checks=0;
const rejects=async(operation)=>{await assert.rejects(operation);checks++;};
try {
 const migrations=(await readdir(directory)).filter(n=>/^V\d+__/.test(n)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
 for(const file of migrations)await db.exec(await readFile(new URL(file,directory),'utf8'));
 await db.query("insert into hospitals(id,code,name) values($1,'EVIDENCE-QA','Synthetic evidence test'),($2,'EVIDENCE-OTHER','Other synthetic tenant')",[h,other]);
 await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'SYNTH-EVIDENCE-P','SYNTHETIC SOFTWARE FIXTURE','1961-07-15'),($3,$4,'SYNTH-EVIDENCE-Q','OTHER SYNTHETIC FIXTURE','1971-07-15')",[patient,h,second,other]);
 await db.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Synthetic verifier','evidence-db@example.invalid','NOT_A_LOGIN_HASH','doctor')",[actor,h]);
 const insert="insert into ckd_diabetes_context_events(id,hospital_id,patient_id,actor_id,request_id,context_status,verified_at,source_note,input_fingerprint,created_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)";
 const save=(o={})=>db.query(insert,[o.id??crypto.randomUUID(),o.h??h,o.p??patient,actor,o.request??crypto.randomUUID(),o.status??'NO_KNOWN_DIABETES',o.at??'2026-10-10T00:00:00Z',o.note??'SYNTHETIC reviewed clinical source','a'.repeat(64),o.created??'2026-10-11T00:00:00Z']);
 assert.equal((await db.query('select count(*)::int n from ckd_diabetes_context_events')).rows[0].n,0);checks++;
 const id=crypto.randomUUID(),request=crypto.randomUUID();await save({id,request});checks++;
 for(const o of [{request},{h:other},{status:'INFERRED_FROM_HBA1C'},{note:'   '},{note:'x'.repeat(2001)},{at:'2026-10-12T00:00:00Z'}])await rejects(()=>save(o));
 await rejects(()=>db.query("update ckd_diabetes_context_events set context_status='CONFIRMED_DIABETES' where id=$1",[id]));
 await rejects(()=>db.query('delete from ckd_diabetes_context_events where id=$1',[id]));
 await save({status:'CONFIRMED_DIABETES',at:'2026-10-12T00:00:00Z',created:'2026-10-13T00:00:00Z'});checks++;
 const context="select context_status from ckd_diabetes_context_events where hospital_id=$1 and patient_id=$2 and created_at<=$3 order by verified_at desc,created_at desc,id desc limit 1";
 assert.equal((await db.query(context,[h,patient,'2026-10-11T12:00:00Z'])).rows[0].context_status,'NO_KNOWN_DIABETES');checks++;
 assert.equal((await db.query(context,[h,patient,'2026-10-14T00:00:00Z'])).rows[0].context_status,'CONFIRMED_DIABETES');checks++;
 assert.equal((await db.query(context,[other,patient,'2026-10-14T00:00:00Z'])).rows.length,0);checks++;
 await save({status:'UNCONFIRMED',at:'2026-10-14T00:00:00Z',created:'2026-10-15T00:00:00Z'});assert.equal((await db.query(context,[h,patient,'2026-10-15T12:00:00Z'])).rows[0].context_status,'UNCONFIRMED');checks++;
 const demo="insert into ckd_research_demo_runs(id,hospital_id,actor_id,request_id,outputs) values($1,$2,$3,$4,$5)";
 const run=crypto.randomUUID(),runRequest=crypto.randomUUID();const outputs=JSON.stringify({synthetic:true,label:'SYNTHETIC SOFTWARE FIXTURE',patients:[]});
 await db.query(demo,[run,h,actor,runRequest,outputs]);checks++;
 await rejects(()=>db.query(demo,[crypto.randomUUID(),h,actor,runRequest,outputs]));
 for(const value of [{synthetic:false},{},[],null])await rejects(()=>db.query(demo,[crypto.randomUUID(),h,actor,crypto.randomUUID(),JSON.stringify(value)]));
 await rejects(()=>db.query("update ckd_research_demo_runs set outputs='{}' where id=$1",[run]));
 await rejects(()=>db.query('delete from ckd_research_demo_runs where id=$1',[run]));
 for(const table of ['clinical_observations','sri_lankan_renal_observations','ai_ckd_predictions']){assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,0);checks++;}
 const report={status:'passed',checks,migrations:migrations.length,lastMigration:migrations.at(-1),engine:'PGlite PostgreSQL WASM; native Windows PostgreSQL not verified',scope:'All migrations, immutable clinical context and synthetic-demo runs, tenant/patient scope, idempotency, historical report cutoff, source/status constraints; no lab or prediction data manufactured by migration'};
 const output=new URL('../verification/ckd-evidence-v55/',import.meta.url);await mkdir(output,{recursive:true});await writeFile(new URL('database-report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await db.close();}
