import { createRequire } from 'node:module';
import { readFile,readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Opt-in, memory-only software fixture. Never connects to a patient database.
// Install the fixture tools separately; existing application dependencies are unchanged.
const toolsDirectory=process.argv[2];
if(!toolsDirectory)throw new Error('Provide the external QA tools directory containing its node_modules.');
const require=createRequire(pathToFileURL(resolve(toolsDirectory,'package.json')));
const { PGlite }=await import(pathToFileURL(require.resolve('@electric-sql/pglite')));
const { pgcrypto }=await import(pathToFileURL(require.resolve('@electric-sql/pglite/contrib/pgcrypto')));
const { PGLiteSocketServer }=await import(pathToFileURL(require.resolve('@electric-sql/pglite-socket')));
const db=new PGlite({extensions:{pgcrypto}});
let server;
try{
 const dir=new URL('../../spring-api/src/main/resources/db/migration/',import.meta.url);
 const files=(await readdir(dir)).filter(x=>/^V\d+__/.test(x)).sort((a,b)=>Number(a.match(/^V(\d+)/)[1])-Number(b.match(/^V(\d+)/)[1]));
 for(const file of files)await db.exec(await readFile(new URL(file,dir),'utf8'));
 await db.exec("create table govcare_ckd_submission_qa_marker(purpose text not null); insert into govcare_ckd_submission_qa_marker values('DISPOSABLE_CKD_SUBMISSION_QA')");
 server=new PGLiteSocketServer({db,port:55450,host:'127.0.0.1'});await server.start();
 console.log(JSON.stringify({ready:true,migrationCount:files.length,engine:'PGlite PostgreSQL WASM; not native Windows PostgreSQL',jdbcUrl:'jdbc:postgresql://127.0.0.1:55450/postgres?sslmode=disable&gssEncMode=disable&prepareThreshold=0&preferQueryMode=simple',scope:'Fresh memory-only QA database; press Ctrl+C after tests.'}));
 const shutdown=async()=>{await server.stop();await db.close();process.exit(0);};
 process.once('SIGINT',shutdown);process.once('SIGTERM',shutdown);
}catch(error){if(server)await server.stop();await db.close();throw error;}
