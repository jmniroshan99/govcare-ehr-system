import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { readFile,readdir,writeFile } from 'node:fs/promises';

// Isolated persisted CKD assessment fixtures; no private/live patient database is modified.
const db=new PGlite({extensions:{pgcrypto}}),dir=new URL('../spring-api/src/main/resources/db/migration/',import.meta.url);
const h='00000000-0000-4000-8000-000000000002',p='00000000-0000-4000-8000-000000000001',undated='00000000-0000-4000-8000-000000000003',actor=crypto.randomUUID(),other=crypto.randomUUID();
let checks=0;const ok=(condition,message)=>{assert.ok(condition,message);checks++;};
const reject=async(query,args)=>{await assert.rejects(db.query(query,args));checks++;};
const units={Age:'years',BMI:'kg/m²',SystolicBP:'mmHg',DiastolicBP:'mmHg',FastingBloodSugar:'mg/dL',HbA1c:'%',SerumCreatinine:'mg/dL',BUNLevels:'mg/dL',GFR:'mL/min/1.73m²',ProteinInUrine:'mg/dL',ACR:'mg/g',SerumElectrolytesPotassium:'mmol/L',HemoglobinLevels:'g/dL',Edema:'boolean',FamilyHistoryKidneyDisease:'boolean',PreviousAcuteKidneyInjury:'boolean',NSAIDsUse:'assessment scale'};
const current={Age:56,BMI:28,SystolicBP:148,DiastolicBP:92,FastingBloodSugar:140,HbA1c:7.1,SerumCreatinine:2,BUNLevels:30,GFR:35,ProteinInUrine:2,ACR:420,SerumElectrolytesPotassium:5.8,HemoglobinLevels:9.8,Edema:0,FamilyHistoryKidneyDisease:0,PreviousAcuteKidneyInjury:0,NSAIDsUse:3};
const now=Date.now(),date=days=>new Date(now-days*86400000).toISOString();
const ids=[];
async function assessment(patient,values,measured,recorded){
 const id=crypto.randomUUID();ids.push(id);
 await db.query("insert into ai_ckd_predictions(id,hospital_id,patient_id,probability,risk_category,confidence,predicted_class,input_data,model_version,request_id,created_by,created_at) values($1::uuid,$2,$3,.5,'MODERATE',0,'1',$4,'OPERATIONAL-SOFTWARE-QA',$1::uuid::text,$5,$6)",[id,h,patient,JSON.stringify(values),actor,recorded]);
 await db.query("insert into ai_assessments(id,hospital_id,patient_id,assessment_type,model_name,model_version,created_by,created_at) values($1,$2,$3,'CKD_RISK_ASSESSMENT','Operational QA','SOFTWARE-VERIFICATION',$4,$5)",[id,h,patient,actor,recorded]);
 for(const [key,value] of Object.entries(values)){
  const observation=crypto.randomUUID();await db.query("insert into clinical_observations(id,hospital_id,patient_id,feature_key,display_name,value_numeric,unit,source_type,created_by,effective_at,created_at) values($1,$2,$3,$4,$4,$5,$6,'MANUAL',$7,$8,$9)",[observation,h,patient,key,value,units[key],actor,measured,recorded]);
  await db.query("insert into ai_assessment_inputs(assessment_id,feature_key,observation_id,value_numeric,unit,source_type,source_metadata) values($1,$2,$3,$4,$5,'MANUAL',$6)",[id,key,observation,value,units[key],JSON.stringify(measured?{clinicalDate:measured}:{})]);
 }
 return id;
}
try{
 const migrations=(await readdir(dir)).filter(f=>/^V\d+__/.test(f)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
 for(const name of migrations.filter(f=>Number(f.match(/^V(\d+)/)[1])<45))await db.exec(await readFile(new URL(name,dir),'utf8'));
 await db.query("insert into hospitals(id,code,name) values($1,'FEATURE-QA','Operational feature test'),($2,'FEATURE-OTHER','Other tenant')",[h,other]);
 await db.query("insert into patients(id,hospital_id,patient_no,full_name,date_of_birth) values($1,$2,'FEATURE-DATED','Operational dated fixture; not a clinical subject','1970-01-01'),($3,$2,'FEATURE-UNDATED','Operational undated fixture; not a clinical subject','1970-01-01')",[p,h,undated]);
 await db.query("insert into app_users(id,hospital_id,full_name,email,password_hash,role) values($1,$2,'Operational clinician','features@govcare.test','NOT_A_LOGIN_HASH','doctor')",[actor,h]);
 await assessment(p,{...current,SerumCreatinine:1.6,GFR:45,ACR:180,SerumElectrolytesPotassium:5,HemoglobinLevels:11.3},date(31),date(30));
 await assessment(p,current,date(1),new Date(now-60000).toISOString());
 await assessment(undated,current,null,new Date(now-30000).toISOString());
 const legacyBefore=(await db.query('select id,input_data,probability,created_at from ai_ckd_predictions order by id')).rows;
 await db.exec(await readFile(new URL('V45__unified_clinical_prediction_features.sql',dir),'utf8'));
 const projection=(await db.query('select * from clinical_prediction_features where hospital_id=$1 order by patient_id,recorded_at desc',[h])).rows;
 ok(projection.length===3,'All three existing assessment snapshots backfilled');
 const latest=projection.find(x=>x.source_assessment_id===ids[1]);
 for(const [key,expected] of Object.entries({creatinine:2,egfr:35,acr:420,potassium:5.8,hemoglobin:9.8,hba1c:7.1,proteinuria:2}))ok(Number(latest[key])===expected,`${key} uses the saved CKD value`);
 ok(projection.find(x=>x.source_assessment_id===ids[2]).observation_date===null,'Undated assessments keep their clinical date null');
 assert.deepEqual((await db.query('select id,input_data,probability,created_at from ai_ckd_predictions order by id')).rows,legacyBefore);checks++;
 ok((await db.query('select count(*)::int count from sri_lankan_renal_observations')).rows[0].count===0,'No dialysis values manufactured');
 ok((await db.query('select count(*)::int count from clinical_prediction_features where hospital_id=$1',[other])).rows[0].count===0,'Tenant-scoped lookup excludes another hospital');
 const insert="insert into clinical_prediction_features(id,hospital_id,patient_id,source_assessment_id,recorded_at,source,raw_inputs,normalization_version) values($1,$2,$3,$4,now(),'CKD_ASSESSMENT','{}','GOVCARE-CLINICAL-FEATURES-1.0')";
 await reject(insert,[crypto.randomUUID(),h,p,ids[1]]);await reject(insert,[crypto.randomUUID(),other,p,ids[1]]);await reject(insert,[crypto.randomUUID(),h,undated,ids[1]]);
 await reject('update clinical_prediction_features set creatinine=99 where id=$1',[latest.id]);await reject('delete from clinical_prediction_features where id=$1',[latest.id]);
 for(const [key,raw,unit,expected] of [['SerumCreatinine','176.8','µmol/L',2],['HemoglobinLevels','100','g/L',10],['ACR','10','mg/mmol',88.4],['SerumElectrolytesPotassium','5.5','mEq/L',5.5],['SystolicBP','120','mm[Hg]',120]])ok(Math.abs(Number((await db.query('select govcare_normalize_prediction_feature($1,$2,$3) value',[key,raw,unit])).rows[0].value)-expected)<1e-6,'Physical units normalized');
 for(const [key,raw,unit] of [['SerumCreatinine','0','mg/dL'],['HemoglobinLevels','99','g/dL'],['SerumElectrolytesPotassium','-1','mmol/L'],['ACR','garbage','mg/g'],['SerumCreatinine','2','unknown'],['HbA1c','-10','mmol/mol']])ok((await db.query('select govcare_normalize_prediction_feature($1,$2,$3) value',[key,raw,unit])).rows[0].value===null,'Invalid values stay null');
 for(const input of ['2099-01-01T00:00:00Z','2026-01-01','garbage'])ok((await db.query('select govcare_clinical_feature_date($1) value',[input])).rows[0].value===null,'Ambiguous or future dates are not imputed');
 const fixture={patientId:p,hospitalId:h,undatedPatientId:undated,generatedAt:new Date(now).toISOString(),rows:projection,scope:'Persisted operational CKD fixtures in an isolated PostgreSQL-compatible database; no private clinical subjects or prediction validation.'};
 if(process.env.GOVCARE_FEATURE_DB_FIXTURES)await writeFile(process.env.GOVCARE_FEATURE_DB_FIXTURES,JSON.stringify(fixture,null,2));
 const report={status:'passed',checks,migrationCount:migrations.length,lastMigration:migrations.at(-1),engine:'PGlite PostgreSQL WASM; not native Windows PostgreSQL',scope:'Real existing-table CKD rows migrated to immutable, tenant-scoped feature projections, with saved dates/units, no dialysis fabrication, FK/idempotence and preservation checks'};
 if(process.env.GOVCARE_FEATURE_DB_REPORT)await writeFile(process.env.GOVCARE_FEATURE_DB_REPORT,JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await db.close();}
