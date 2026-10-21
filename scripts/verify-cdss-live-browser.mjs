// Real HTTP boundaries against the isolated synthetic QA database; no mocked API.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const context=JSON.parse(await fs.readFile(process.env.GOVCARE_CDSS_LIVE_CONTEXT,'utf8'));
const {chromium}=await import(process.env.GOVCARE_PLAYWRIGHT_MODULE||'playwright');
const {selectFrontendPort}=await import('./frontend-port.cjs');const port=context.frontendPort||await selectFrontendPort(undefined,[0]);
const html=path.join(root,'cdss-live-qa.html');let server,browser;const errors=[],requests=[];
try{
 await fs.writeFile(html,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root"></main><script type="module">import React from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import'/src/index.css';import{CkdFiveYearOutlook}from'/src/components/ai/CkdFiveYearOutlook.tsx';createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement(CkdFiveYearOutlook,{patient:${JSON.stringify(context.patient)}})));</script></body></html>`);
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port',String(port),'--strictPort'],{cwd:root,env:{...process.env,VITE_API_BASE_URL:context.origin},stdio:'ignore'});
 const site=`http://127.0.0.1:${port}`;
 for(let i=0;i<90;i++){try{if((await fetch(site)).ok)break;}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,executablePath:process.env.GOVCARE_CHROMIUM_EXECUTABLE||undefined});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 page.on('requestfailed',r=>requests.push({url:r.url(),failure:r.failure()?.errorText}));
 page.on('response',r=>{if(r.url().includes('/api/'))requests.push({url:r.url(),status:r.status()});});
 page.on('console',m=>{if(m.type()==='error')requests.push({consoleError:m.text()});});
 page.on('request',r=>{if(r.url().endsWith('/download'))void r.allHeaders().then(h=>requests.push({downloadOrigin:h.origin,cacheControl:h['cache-control'],mode:h['sec-fetch-mode']}));});
 await page.addInitScript(token=>localStorage.setItem('govcare-api-token',token),context.token);
 await page.goto(site+'/cdss-live-qa.html',{waitUntil:'domcontentloaded'});await page.locator('.co-probability-dial').waitFor();
 assert.match(await page.locator('.co-probability-dial').innerText(),/30\.6%/);
 const response=await page.evaluate(async({origin,token,patient})=>{const r=await fetch(origin+`/api/ai-cdss/ckd/patients/${patient}/renal-intelligence/predict`,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({requestId:crypto.randomUUID(),modelKey:'hb'})});return {status:r.status,body:await r.json()};},{origin:context.origin,token:context.token,patient:context.hdPatient});
 assert.equal(response.status,200);assert.equal(response.body.status,'AVAILABLE');
 await page.getByRole('button',{name:'Review & plan',exact:true}).click();const dialog=page.getByRole('dialog');
 await dialog.getByLabel('Clinical reason',{exact:true}).fill('SYNTHETIC LIVE BROWSER REVIEW');
 await dialog.getByLabel('Clinician notes',{exact:true}).fill('Synthetic browser persistence test');
 await dialog.getByRole('button',{name:'Save review & plan',exact:true}).click();await dialog.waitFor({state:'hidden'});
 await page.reload();await page.locator('.co-outcome').waitFor();
 const download=page.waitForEvent('download',{timeout:20000}).then(d=>d.saveAs(path.join(context.output,'browser-export.pdf')));
 try{await Promise.all([download,page.getByRole('button',{name:'Generate report',exact:true}).click({noWaitAfter:true})]);}
 catch(error){await page.screenshot({path:path.join(context.output,'browser-failure.png'),fullPage:true});console.log(JSON.stringify({requests,alerts:await page.getByRole('alert').allTextContents(),warnings:await page.locator('.co-warning').allTextContents()}));throw error;}
 await page.getByLabel('Learned five-year research model readiness',{exact:true}).locator('summary').click();
 await page.screenshot({path:path.join(context.output,'browser.png'),fullPage:true});assert.deepEqual(errors,[]);
 await fs.writeFile(path.join(context.output,'browser-report.json'),JSON.stringify({status:'passed',scope:'Unmocked live HTTP, synthetic isolated PostgreSQL database',checks:['Stored KFRE rendered','Browser → Spring → Django inference','Review persisted and page reloaded','Stored PDF downloaded','Learned readiness explained'],runtimeErrors:errors},null,2));
}finally{await browser?.close();server?.kill();await fs.rm(html,{force:true});}
