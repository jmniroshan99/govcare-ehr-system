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
const flyway=query("select version||'|'||success::text from flyway_schema_history where version='42' order by installed_rank desc limit 1;");
assert.equal(flyway[0],'42|true','Flyway V42 is not recorded as a successful migration.');
const registry=query("select model_key||'|'||version||'|'||status||'|'||coalesce(validation_status,'') from predictive_model_registry where model_key='hyperkalemia' and version='1.0.0';");
assert.ok(registry.some(x=>x.startsWith('hyperkalemia|1.0.0|RESEARCH|INTERNAL_RESEARCH_EVALUATION')),'Hyperkalemia registry row is missing or inconsistent.');
const constraints=query("select conname||'|'||pg_get_constraintdef(oid) from pg_constraint where conname in ('predictive_horizon','predictive_prediction_output_shape','renal_review_model') order by conname;");
assert.equal(constraints.length,3,'Expected V42 constraints were not all found.');
assert.ok(constraints.find(x=>x.startsWith('predictive_prediction_output_shape|'))?.includes('hyperkalemia'),'Prediction-output constraint does not include hyperkalemia.');
assert.ok(constraints.find(x=>x.startsWith('renal_review_model|'))?.includes('hyperkalemia'),'Renal-review constraint does not include hyperkalemia.');
console.log(JSON.stringify({status:'passed',databaseEngine:'PostgreSQL',database,flywayVersion:'42',model:'LK-RENAL-HYPERK-1.0',constraints:['predictive_horizon','predictive_prediction_output_shape','renal_review_model']},null,2));
