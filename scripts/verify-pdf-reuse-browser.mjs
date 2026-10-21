import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {counts,query,sessionPath} from './pdf-reuse-qa-db.mjs';
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8')),out='verification/pdf-reuse-v57',site='http://127.0.0.1:5300';
const playwright=process.env.GOVCARE_PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs');
const {chromium}=await import(pathToFileURL(playwright).href);
const names=fs.readdirSync(`${out}/fixtures`).filter(n=>n.endsWith('.pdf')).sort(),errors=[],checks=[],responses=[];
fs.mkdirSync(`${out}/screenshots`,{recursive:true});
const browser=await chromium.launch({headless:true,channel:process.env.GOVCARE_CHROME_CHANNEL||undefined});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Colombo',locale:'en-GB'});
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.url().includes('/api/ai-cdss/pdf/'))responses.push({route:new URL(r.url()).pathname,status:r.status()});});
 await page.goto(site,{waitUntil:"domcontentloaded"});await page.locator('input[type="email"]').fill(session.email);await page.locator('input[type="password"]').fill(session.password);
 await page.locator('form').filter({has:page.locator('input[type="email"]')}).getByRole('button',{name:/sign in|log in|login/i}).click();
 await page.waitForURL(u=>!u.pathname.includes('login'),{timeout:30000});
 await page.goto(`${site}/ai-cdss/ckd?patientId=${session.patient}`,{waitUntil:"domcontentloaded"});const workspace=page.getByRole('region',{name:'Clinical PDF sources'});await workspace.waitFor({timeout:30000});
 await page.locator('#ckd-input-SerumCreatinine').fill('2.1');
 const baseline=counts(session.patient);let predictionRequests=0;page.on('request',r=>{if(r.url().endsWith('/api/ai-cdss/ckd/predict'))predictionRequests++;});
 await workspace.getByLabel('Browse clinical PDFs').setInputFiles(names.map(n=>path.resolve(out,'fixtures',n)));
 const readAll=()=>workspace.getByRole('button',{name:/^(Read All Reports Automatically|Re-read selected reports)$/});
 for(let attempt=0;attempt<3;attempt++){
  await readAll().click();await workspace.getByRole('heading',{name:'PDF Extraction Summary'}).waitFor();await page.waitForFunction(()=>document.querySelector('.pdf-import')?.getAttribute('aria-busy')==='false');
  assert.equal(await workspace.locator('.pdf-import-queue article').count(),5);assert.match(await workspace.locator('.pdf-import-summary').innerText(),/5 previously imported/);assert.match(await workspace.innerText(),/OCR required/);
  assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.1');assert.equal(await page.locator('#ckd-input-GFR').inputValue(),'');assert.deepEqual(counts(session.patient),baseline);
 }
 console.log('Browser checkpoint');checks.push('Real browser five-file read repeated three times; no form changes or clinical persistence');
 assert.equal(await workspace.getByLabel('Source for Serum creatinine',{exact:true}).inputValue(),'');
 assert.equal(await workspace.getByLabel('Source for eGFR',{exact:true}).inputValue(),'');
 await workspace.getByRole('button',{name:'Approve unambiguous empty fields'}).click();assert.equal(await workspace.getByLabel('Approve Serum creatinine',{exact:true}).isChecked(),false);
 assert.equal(await workspace.getByRole('button',{name:'Apply approved values'}).isDisabled(),true);
 await workspace.locator('.pdf-import-identity input').check();
 for(const field of ['Serum creatinine','eGFR','HbA1c','Urine albumin/creatinine ratio (ACR)']){
  const select=workspace.getByLabel(`Source for ${field}`,{exact:true});const option=await select.locator('option').evaluateAll(options=>options.find(o=>o.textContent.includes('01_full_ckd_text_report.pdf'))?.value);assert.ok(option);await select.selectOption(option);await workspace.getByLabel(`Approve ${field}`,{exact:true}).check();
 }
 assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.1');
 await workspace.getByRole('button',{name:'Apply approved values'}).click();assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'1.4');assert.equal(await page.locator('#ckd-input-GFR').inputValue(),'54');
 assert.equal(await page.locator('#ckd-input-BUNLevels').inputValue(),'');
 await page.locator('#ckd-input-SerumCreatinine').fill('2');await page.locator('#ckd-input-SerumCreatinine').fill('2.2');
 const field=page.locator('label.gov-clinical-field').filter({has:page.locator('#ckd-input-SerumCreatinine')});assert.match(await field.innerText(),/MANUAL_OVERRIDE/);assert.match(await field.innerText(),/Imported: 1.4 mg\/dL/);
 await readAll().click();await page.waitForFunction(()=>document.querySelector('.pdf-import')?.getAttribute('aria-busy')==='false');assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.2');assert.match(await field.innerText(),/MANUAL_OVERRIDE/);
 console.log('Browser checkpoint');checks.push('Competing sources need explicit selection and approval; original value survives repeated manual edits and re-read');
 const run=page.getByRole('button',{name:'Validate data & run CKD risk assessment'});await run.click();assert.match(await page.locator('body').innerText(),/Cannot run CKD assessment/);assert.equal(predictionRequests,0);
 await workspace.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved securely to the database.',{exact:false}).first().waitFor({timeout:10000}).catch(()=>{});
 for(const width of [1440,375]){
  await page.setViewportSize({width,height:1000});await workspace.scrollIntoViewIfNeeded();
  await page.screenshot({path:`${out}/screenshots/pdf-import-${width}.png`,fullPage:true});
  await workspace.locator('.pdf-import-results').scrollIntoViewIfNeeded();await page.screenshot({path:`${out}/screenshots/pdf-review-${width}.png`});
  const overflow=await page.evaluate(()=>({screen:innerWidth,document:document.documentElement.scrollWidth,body:document.body.scrollWidth}));assert.ok(overflow.document<=width+2,`Page overflows at ${width}: ${JSON.stringify(overflow)}`);
 }
 console.log('Browser checkpoint');checks.push('Desktop and mobile page fit; review table scrolls within its container');
 await page.setViewportSize({width:1440,height:1000});
 await workspace.getByRole('button',{name:'Clear current selection'}).click();assert.equal(await workspace.locator('.pdf-import-queue article').count(),0);assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.2');assert.deepEqual(counts(session.patient),baseline);
 await workspace.getByLabel('Search authorized EHR reports').fill('01_full');const saved=workspace.locator(`.pdf-import-saved-list input[value="${session.saved[0].documentId}"]`);assert.equal(await saved.count(),1);await saved.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));await saved.check();await readAll().click();await page.waitForFunction(()=>document.querySelector('.pdf-import')?.getAttribute('aria-busy')==='false');assert.match(await workspace.innerText(),/Previously imported report detected/);assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.2');
 // Open the actual authorized file endpoint through the application's normal Blob viewer.
 const popup=page.waitForEvent('popup');const content=page.waitForResponse(r=>r.url().includes('/documents/')&&r.url().endsWith('/preview'));await workspace.getByRole('button',{name:'Open saved report'}).click();const opened=await popup;const previewResponse=await content;assert.equal(previewResponse.status(),200);assert.equal(Buffer.from((await previewResponse.json()).contentBase64,'base64').subarray(0,5).toString(),'%PDF-');if(process.env.GOVCARE_CHROME_CHANNEL)await opened.waitForURL(u=>u.protocol==='blob:',{timeout:15000});else await page.waitForTimeout(300);await opened.close();
 console.log('Browser checkpoint');checks.push('Clear selection keeps form/database; searchable saved EHR report can be re-read and opened');
 if(process.env.GOVCARE_PDF_BROWSER_READ_ONLY){
  await workspace.getByRole('button',{name:'Clear current selection'}).click();
  await workspace.getByLabel('Browse clinical PDFs').setInputFiles([{name:'broken.pdf',mimeType:'application/pdf',buffer:Buffer.from('not a PDF')},{name:names[1],mimeType:'application/pdf',buffer:fs.readFileSync(path.resolve(out,'fixtures',names[1]))}]);
  await readAll().click();await page.waitForFunction(()=>document.querySelector('.pdf-import')?.getAttribute('aria-busy')==='false');
  assert.match(await workspace.innerText(),/Extraction failed/);assert.equal(await workspace.locator('.pdf-import-queue article').count(),2);assert.equal(await workspace.getByLabel('Source for eGFR',{exact:true}).locator('option').count(),2);assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.2');assert.deepEqual(counts(session.patient),baseline);
  checks.push('Malformed file fails independently while the healthy file remains reviewable and manual overrides are preserved');
  await workspace.getByRole('button',{name:'Save draft',exact:true}).click();await page.getByText('Draft saved securely to the database.',{exact:false}).first().waitFor();
  await page.reload({waitUntil:'domcontentloaded'});await page.getByRole('button',{name:'Restore draft',exact:true}).waitFor();
  // Wait past the autosave debounce: merely opening a patient must not overwrite the saved draft.
  await page.waitForTimeout(1500);await page.getByRole('button',{name:'Restore draft',exact:true}).click();assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.2');
  assert.match(await page.locator('label.gov-clinical-field').filter({has:page.locator('#ckd-input-SerumCreatinine')}).innerText(),/MANUAL_OVERRIDE/);
  checks.push('Partial draft restores manual override and source values after reload; initial load does not overwrite it');
 }
 if(!process.env.GOVCARE_PDF_BROWSER_READ_ONLY){
 for(const[key,value]of Object.entries({FastingBloodSugar:110,BUNLevels:18,ProteinInUrine:10,SerumElectrolytesPotassium:4.5}))await page.locator(`#ckd-input-${key}`).fill(String(value));
 for(const key of ['Edema','FamilyHistoryKidneyDisease','PreviousAcuteKidneyInjury'])await page.locator(`#ckd-input-${key}`).selectOption('0');
 await page.locator('#ckd-input-NSAIDsUse').selectOption('UNKNOWN');await run.click();assert.equal(predictionRequests,0);
 await page.locator('#ckd-input-NSAIDsUse').selectOption('0');
 const missing=await page.locator('[id^=ckd-input-]').evaluateAll(inputs=>inputs.filter(el=>!el.value).map(el=>el.id));assert.deepEqual(missing,[]);
 const predicted=page.waitForResponse(r=>r.url().endsWith('/api/ai-cdss/ckd/predict'));await run.click();const prediction=await predicted;assert.equal(prediction.status(),200);const data=await prediction.json();assert.equal(data.patientId,session.patient);assert.equal(predictionRequests,1);assert.equal(counts(session.patient).predictions,baseline.predictions+1);
 const inputMeta=JSON.parse(query(`select source_metadata from ai_assessment_inputs where assessment_id='${data.predictionId}' and feature_key='SerumCreatinine'`));assert.equal(inputMeta.source,'MANUAL_OVERRIDE');assert.equal(inputMeta.originalValue,1.4);assert.equal(inputMeta.importReviewed,true);assert.equal(inputMeta.sourceVerified,false);
 console.log('Browser checkpoint');checks.push('Incomplete and Unknown fields block model calls; completing reviewed 17 inputs produces one real assessment with original-value provenance');
 await page.screenshot({path:`${out}/screenshots/ckd-assessment-success.png`,fullPage:true});
 }
 assert.deepEqual(errors,[]);assert.equal(responses.filter(r=>r.status===400).length,process.env.GOVCARE_PDF_BROWSER_READ_ONLY?1:0);assert.ok(responses.every(r=>r.status===200||r.status===400));
 fs.writeFileSync(`${out}/${process.env.GOVCARE_PDF_BROWSER_READ_ONLY?"browser-repeat":"browser"}.json`,JSON.stringify({status:'passed',scope:'Actual application login, route, frontend, Spring and PostgreSQL; no request mocks',checks,responses,runtimeErrors:errors,clinicalRecordsBeforeRead:baseline,clinicalRecordsAfterExplicitAssessment:counts(session.patient)},null,2));
 fs.rmSync(`${out}/browser-failure.txt`,{force:true});console.log(JSON.stringify({status:'passed',checks,runtimeErrors:errors},null,2));
}catch(e){fs.writeFileSync(`${out}/browser-failure.txt`,String(e.stack));throw e;}finally{await browser.close();}
