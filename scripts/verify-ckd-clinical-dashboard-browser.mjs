import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve(new URL('../',import.meta.url).pathname);
const fixturePath=process.env.GOVCARE_FEATURE_UI_FIXTURES;
if(!fixturePath)throw Error('Set GOVCARE_FEATURE_UI_FIXTURES to generated ClinicalFeatureUiAndPdfTest responses.');
const fixtures=JSON.parse(await fs.readFile(fixturePath,'utf8'));
const {chromium}=await import(process.env.GOVCARE_PLAYWRIGHT_MODULE||'playwright');
const site='http://127.0.0.1:5314',html=path.join(root,'ckd-dashboard-qa.html');
const output=path.resolve(process.env.GOVCARE_DASHBOARD_QA_OUTPUT||path.join(root,'verification/clinical-dashboard-v51'));
const identities=Object.fromEntries(Object.entries(fixtures).map(([key,data])=>[key,{id:data.patientId,hospital_id:data.hospitalId,full_name:'GovCare software demonstration',patient_no:'SYNTHETIC-CKD-QA'}]));
const errors=[],checks=[];let scenario='paired',readOnly=false,failed=false,reviewBody=null,measurement=null,sessionBody=null;
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
let browser,server;
try{
 await fs.mkdir(output,{recursive:true});
 await fs.writeFile(html,`<!doctype html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GovCare clinical dashboard QA</title></head><body><main id="root" style="max-width:1440px;margin:auto;padding:24px"></main><script type="module">import React from 'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import '/src/index.css';import{SriLankanRenalPanel}from'/src/components/ai/SriLankanRenalPanel.tsx';const identities=${JSON.stringify(identities)};const name=new URLSearchParams(location.search).get('case')||'paired';window.reportRequests=0;createRoot(document.getElementById('root')).render(React.createElement(MemoryRouter,null,React.createElement('p',{style:{fontSize:11,color:'#52657B',padding:'0 0 14px'}},'GOVCARE EHR · SYNTHETIC SOFTWARE DEMONSTRATION · NOT A CLINICAL RECORD'),React.createElement(SriLankanRenalPanel,{patient:identities[name],onGenerateReport:()=>{window.reportRequests++}})));</script></body></html>`);
 server=spawn(process.execPath,[path.join(root,'node_modules/vite/bin/vite.js'),'--host','127.0.0.1','--port','5314'],{cwd:root,stdio:'ignore'});
 for(let attempt=0;attempt<60;attempt++){try{if((await fetch(site)).ok)break}catch{}await new Promise(r=>setTimeout(r,200));}
 browser=await chromium.launch({headless:true,executablePath:process.env.GOVCARE_CHROMIUM_EXECUTABLE||undefined,args:JSON.parse(process.env.GOVCARE_CHROMIUM_ARGS||'[]')});
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai-cdss/ckd/**',async route=>{
  const request=route.request();if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
  if(request.method()==='GET'){
   if(failed){await route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({message:'Operational service failure',errorId:'QA-CLINICAL-DASHBOARD'})});return;}
   await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({...fixtures[scenario],canReview:!readOnly})});return;
  }
  const body=request.postDataJSON(),url=request.url();
  if(url.endsWith('/predictive-intelligence/reviews'))reviewBody=body;
  else if(url.endsWith('/renal-intelligence/observations')){sessionBody=body;scenario='hdSession';}
  else if(url.endsWith('/dialysis-status'))scenario='verified';
  else if(url.endsWith('/observations'))measurement=body;
  else throw Error('Unexpected mutation: '+url);
  await route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify({id:crypto.randomUUID(),saved:true,reviewVersion:1})});
 });
 const card=key=>page.locator(`[data-module="${key}"]`);
 const open=async(name,options={})=>{scenario=name;readOnly=Boolean(options.readOnly);failed=Boolean(options.failed);await page.goto(`${site}/ckd-dashboard-qa.html?case=${name}`);if(!failed)await page.locator('.renal-primary-grid').waitFor();};
 for(const width of [1440,900,390]){
  await page.setViewportSize({width,height:1000});await open('paired');
  assert.equal(await page.locator('.renal-primary-grid>.renal-module-card').count(),5);
  assert.equal(await page.locator('.renal-module-card').count(),7);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  const columns=await page.locator('.renal-primary-grid>.renal-module-card').evaluateAll(nodes=>new Set(nodes.map(n=>Math.round(n.getBoundingClientRect().x))).size);assert.equal(columns,width===1440?3:width===900?2:1);
  assert.match(await card('anemia').innerText(),/9\.8/);assert.match(await card('hyperkalemia').innerText(),/5\.8/);assert.match(await card('cardiovascular').innerText(),/Risk not estimated/);assert.match(await card('cardiovascular').innerText(),/80%/);
  assert.match(await card('renalDeterioration').innerText(),/\+25%/);assert.equal(await card('anemia').locator('.renal-module-spark').count(),1);
  await page.getByRole('button',{name:'Generate report',exact:true}).click();assert.equal(await page.evaluate(()=>window.reportRequests),1);
  await page.getByRole('button',{name:'Quick clinical summary for Anemia Monitoring'}).focus();await page.getByRole('tooltip').waitFor();assert.match(await page.getByRole('tooltip').innerText(),/Clinical review recommended/);await page.getByRole('button',{name:'Generate report',exact:true}).focus();
  await page.locator('.renal-modules').screenshot({path:path.join(output,`clinical-dashboard-${width}.png`)});
  checks.push(`${width}px: five colour-coded cards, truthful values/readiness, dated chart, responsive columns, keyboard summary and report callback`);
  await card('anemia').getByRole('button',{name:'Add blood parameters',exact:true}).click();const entry=page.getByRole('dialog');await entry.waitFor();assert.equal(await entry.getByLabel('Measurement',{exact:true}).inputValue(),'hemoglobin');await entry.getByLabel('Result',{exact:true}).fill('10.7');await entry.getByLabel('Measured date & time',{exact:true}).fill('2026-10-13T10:00');await entry.getByLabel('Verified source',{exact:true}).fill('Synthetic software test source');await entry.locator('input[type=checkbox]').check();await entry.getByRole('button',{name:'Save verified result',exact:true}).click();await entry.waitFor({state:'hidden'});assert.equal(measurement.metric,'hemoglobin');assert.equal(measurement.value,10.7);assert.ok(!('maintenanceHemodialysisVerified'in measurement));assert.ok(measurement.observedAt);
  await card('anemia').locator('.renal-module-details>summary').click();await card('anemia').getByRole('button',{name:'Clinician review',exact:true}).click();const drawer=page.locator('.renal-side-drawer[open]');await drawer.waitFor();await drawer.getByLabel('Action',{exact:true}).selectOption('MODIFY');await drawer.getByLabel('Clinical reason',{exact:false}).fill('Synthetic operational review');await drawer.getByLabel('Revised interpretation',{exact:false}).fill('Operational fixture interpretation');await drawer.getByLabel('Clinical note',{exact:false}).fill('Operational fixture note');await drawer.getByRole('button',{name:'Save review',exact:true}).click();await drawer.waitFor({state:'hidden'});assert.equal(reviewBody.snapshotId,fixtures.paired.snapshotId);assert.equal(reviewBody.moduleKey,'anemia');assert.equal(reviewBody.expectedVersion,0);
  await page.getByRole('button',{name:'Add missing data',exact:true}).click();await page.locator('.renal-side-drawer[open]').waitFor();assert.match(await page.locator('.renal-side-drawer').innerText(),/Clinical diabetes status/);assert.match(await page.locator('.renal-side-drawer').innerText(),/ferritin/);await page.keyboard.press('Escape');await page.locator('.renal-side-drawer').waitFor({state:'hidden'});
  checks.push(`${width}px: verified Hb entry preserves metric/date API; review preserves immutable snapshot/version and notes; missing-data drawer covers diabetes and iron studies`);
  await open('single');assert.equal(await card('anemia').locator('.renal-module-spark').count(),0);assert.match(await card('anemia').innerText(),/Verify measurement date|Source review recommended/);
  await card('hyperkalemia').locator('.renal-research-expand>summary').click();assert.equal(await card('hyperkalemia').getByRole('button',{name:'Run research prediction',exact:true}).isDisabled(),true);
  await card('dialysisAdequacy').getByRole('button',{name:'Add dialysis session',exact:true}).click();const session=page.getByRole('dialog');await session.waitFor();const source=fixtures.hdSession.observations.at(-1);await session.locator('[data-renal-entry=observedAt]').fill(source.observed_at.slice(0,16));await session.locator('[data-renal-entry=urea_pre]').fill('20');await session.locator('[data-renal-entry=urea_post]').fill('7');await session.getByLabel(/Source report or session/).fill('Synthetic verified dialysis source');await session.locator('input[type=checkbox]').first().check();await session.locator('input[type=checkbox]').last().check();await session.getByRole('button',{name:/Save.*source|Save.*result|Record.*result|Save.*observation/i}).click();await session.waitFor({state:'hidden'});await page.locator('.renal-primary-grid').waitFor();assert.equal(sessionBody.measurements.urea_pre,20);assert.equal(sessionBody.measurements.urea_post,7);assert.ok(!('creatinine_pre'in sessionBody.measurements));assert.match(await card('dialysisAdequacy').innerText(),/65/);
  checks.push(`${width}px: undated data has no invented chart, inference remains gated, and verified 20/7 same-session urea yields measured URR 65%`);
  await open('paired',{readOnly:true});assert.equal(await card('anemia').getByRole('button',{name:'Add blood parameters',exact:true}).isDisabled(),true);assert.equal(await card('hyperkalemia').getByRole('button',{name:'Add electrolyte results',exact:true}).isDisabled(),true);
  await open('paired',{failed:true});await page.getByRole('alert').waitFor();assert.equal(await page.locator('.renal-module-card').count(),0);assert.match(await page.getByRole('alert').innerText(),/QA-CLINICAL-DASHBOARD/);
  checks.push(`${width}px: read-only writes disabled; service errors retain a request reference and display no stale patient cards`);
 }
 await page.setViewportSize({width:1440,height:1000});await open('paired');await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.setViewportSize({width:1440,height:2800});await page.waitForTimeout(250);assert.match(await page.locator('.renal-ai-explanation').innerText(),/Why this result/);await page.locator('.renal-ai-explanation').scrollIntoViewIfNeeded();await page.waitForTimeout(100);await page.locator('.renal-modules').screenshot({path:path.join(output,'clinical-dashboard-dark.png')});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(errors,[]);const report={status:'passed',checks:checks.length+1,widths:[1440,900,390],runtimeErrors:errors,scope:'Actual React workspace and forms; responses generated by Java clinical rules; captured synthetic API mutations. No live hospital database or clinical validation.',checksDetail:checks};await fs.writeFile(path.join(output,'browser-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser?.close();server?.kill('SIGTERM');await fs.rm(html,{force:true});}
