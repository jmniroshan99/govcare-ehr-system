import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const env={...process.env};
const envPath=join(root,'spring-api','.env');
if(!existsSync(envPath)) throw new Error('spring-api/.env is required for native PostgreSQL verification.');
for(const raw of readFileSync(envPath,'utf8').split(/\r?\n/)){
  const m=raw.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
  if(m && env[m[1]]===undefined) env[m[1]]=m[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/,'$1$2');
}
const url=new URL((env.DB_URL||'jdbc:postgresql://localhost:5432/govcare_ehr_v2').replace(/^jdbc:/,''));
assert.equal(url.protocol,'postgresql:');
assert.ok(['localhost','127.0.0.1','[::1]'].includes(url.hostname),'Native verifier only runs against a loopback PostgreSQL database.');
assert.ok(!url.username && !url.password && !url.search && !url.hash,'Keep DB credentials in DB_USERNAME/DB_PASSWORD, not DB_URL.');
const database=decodeURIComponent(url.pathname.slice(1));
assert.ok(database && !database.includes('/'));
function psql(){
  if(env.GOVCARE_PSQL_PATH) return env.GOVCARE_PSQL_PATH;
  if(process.platform!=='win32') return 'psql';
  const base=join(env.ProgramFiles||'C:\\Program Files','PostgreSQL');
  if(existsSync(base)){
    for(const version of readdirSync(base).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))){
      const candidate=join(base,version,'bin','psql.exe'); if(existsSync(candidate)) return candidate;
    }
  }
  return 'psql.exe';
}
function query(sql){
  const args=['-X','-v','ON_ERROR_STOP=1','-At','-F','|','-h',url.hostname.replace(/^\[|\]$/g,''),'-p',url.port||'5432','-U',env.DB_USERNAME||'postgres','-d',database,'-c',sql];
  const r=spawnSync(psql(),args,{encoding:'utf8',shell:false,env:{...env,...(env.DB_PASSWORD!==undefined?{PGPASSWORD:env.DB_PASSWORD}:{})}});
  if(r.error) throw new Error(`Unable to execute psql: ${r.error.message}`);
  if(r.status!==0) throw new Error((r.stderr||'PostgreSQL verification failed.').trim());
  return (r.stdout||'').trim().split(/\r?\n/).filter(Boolean);
}
const flyway=query("select version||'|'||success::text from flyway_schema_history where version='45' order by installed_rank desc limit 1;");
assert.equal(flyway[0],'45|true','Flyway V45 is not recorded as a successful migration.');
const tables=query("select tablename from pg_tables where schemaname='public' and tablename='clinical_prediction_features';");
assert.equal(tables.length,1,'The unified clinical feature table is missing.');
const columns=query("select column_name from information_schema.columns where table_schema='public' and table_name='clinical_prediction_features' and column_name in ('id','hospital_id','patient_id','source_assessment_id','observation_date','creatinine','egfr','acr','potassium','hemoglobin','hba1c','proteinuria','source','raw_inputs','feature_metadata') order by column_name;");
assert.equal(columns.length,15,'Expected feature values and lineage columns were not all found.');
const constraints=query("select conname from pg_constraint where conname in ('clinical_prediction_feature_source','clinical_prediction_feature_shape','clinical_prediction_feature_date','clinical_prediction_feature_bounds') order by conname;");
assert.equal(constraints.length,4,'Feature safety constraints are missing.');
const triggers=query("select trigger_name from information_schema.triggers where trigger_name='immutable_clinical_prediction_features' group by trigger_name;");
assert.equal(triggers.length,1,'The immutable feature projection trigger is missing.');
const counts=query("select (select count(*) from ai_ckd_predictions)::text||'|'||(select count(*) from clinical_prediction_features)::text;");
const [assessments,features]=counts[0].split('|').map(Number);assert.equal(features,assessments,'Existing CKD assessments were not all projected.');
console.log(JSON.stringify({status:'passed',databaseEngine:'Native PostgreSQL',database,flywayVersion:'45',tables,columns,constraints,triggers,assessmentCount:assessments,featureProjectionCount:features,scope:'Read-only schema/backfill verification; no patient values are printed'},null,2));
