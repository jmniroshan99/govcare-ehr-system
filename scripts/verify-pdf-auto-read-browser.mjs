import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {counts,sessionPath} from './pdf-reuse-qa-db.mjs';
const session=JSON.parse(fs.readFileSync(sessionPath,'utf8'));
const out='verification/pdf-auto-read',folder=process.env.GOVCARE_PDF_TEST_PACK||'output/pdf/GovCare_Clinical_PDF_Test_Pack_10',site='http://127.0.0.1:5300';
const {chromium}=await import(pathToFileURL(process.env.GOVCARE_PLAYWRIGHT_MODULE||path.join(process.env.USERPROFILE,'.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs')).href);
const names=fs.readdirSync(folder).filter(n=>n.endsWith('.pdf')).sort();assert.equal(names.length,10);
fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({headless:true});let page;
const errors=[],checks=[],requests=[];
try{
 page=await browser.newPage({viewport:{width:1440,height:1000},timezoneId:'Asia/Colombo'});page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{const url=new URL(r.url());if(url.pathname.startsWith('/api/ai-cdss/'))requests.push({path:url.pathname,method:r.method()});});
 await page.goto(site,{waitUntil:'domcontentloaded'});await page.locator('input[type=email]').fill(session.email);await page.locator('input[type=password]').fill(session.password);await page.locator('form').filter({has:page.locator('input[type=email]')}).getByRole('button',{name:/sign in|log in|login/i}).click();await page.waitForURL(u=>!u.pathname.includes('login'));
 await page.goto(`${site}/ai-cdss/ckd?patientId=${session.patient}`,{waitUntil:'domcontentloaded'});const workspace=page.getByRole('region',{name:'Clinical PDF sources'});await workspace.waitFor();
 await page.locator('#ckd-input-SerumCreatinine').fill('2.25');const baseline=counts(session.patient);
 const input=workspace.getByLabel('Browse clinical PDFs'),queue=workspace.locator('.pdf-import-queue article');
 const settled=async expected=>{await page.waitForFunction(n=>{const area=document.querySelector('.pdf-import');return area?.getAttribute('aria-busy')==='false'&&area.querySelectorAll('.pdf-import-queue article').length===n&&area.querySelectorAll('.pdf-import-queue article').length>0&&area.querySelector('.pdf-import-summary')?.textContent?.includes(`${n} PDFs selected`)},expected);};
 const unchanged=async()=>{assert.equal(await page.locator('#ckd-input-SerumCreatinine').inputValue(),'2.25');assert.equal(await page.locator('#ckd-input-GFR').inputValue(),'');assert.deepEqual(counts(session.patient),baseline);};
 const files=(...indices)=>indices.map(i=>path.resolve(folder,names[i]));
 // No Read button is clicked when adding files in any scenario below.
 await input.setInputFiles(files(1));await settled(1);assert.match(await queue.first().innerText(),/Extraction complete/);assert.equal(await workspace.getByLabel('Source for eGFR',{exact:true}).locator('option').count(),2);await unchanged();checks.push('File picker starts extraction without clicking Read');
 await input.setInputFiles(files(0,2));await settled(3);assert.equal(await queue.count(),3);assert.match(await workspace.locator('.pdf-import-summary').innerText(),/25 measurements recognized/);assert.equal(await workspace.getByLabel('Source for eGFR',{exact:true}).locator('option').count(),3);await unchanged();checks.push('Appending files reads only new files and retains earlier previews');
 await workspace.getByRole('button',{name:'Clear current selection'}).click();
 const transfer=await page.evaluateHandle(({name,base64})=>{const dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(atob(base64),c=>c.charCodeAt(0))],name,{type:'application/pdf'}));return dt},{name:names[1],base64:fs.readFileSync(files(1)[0]).toString('base64')});
 await workspace.locator('.pdf-import-upload').dispatchEvent('drop',{dataTransfer:transfer});await settled(1);await unchanged();checks.push('Drag and drop starts extraction automatically');
 await workspace.getByRole('button',{name:'Clear current selection'}).click();await workspace.getByLabel('Search authorized EHR reports').fill('01_full_ckd_text_report.pdf');const saved=workspace.locator(`.pdf-import-saved-list input[value="${session.saved[0].documentId}"]`);await saved.evaluate(el=>el.scrollIntoView({block:'center'}));await saved.check();await settled(1);assert.match(await workspace.innerText(),/Previously imported report detected/);await unchanged();checks.push('Selecting an authorized saved report starts a reusable read automatically');
 const beforeReread=requests.filter(r=>r.path.endsWith('/extract')).length;await workspace.getByRole('button',{name:'Re-read selected reports',exact:true}).click();await settled(1);assert.equal(requests.filter(r=>r.path.endsWith('/extract')).length,beforeReread+1);await unchanged();checks.push('Explicit re-read remains available');
 await workspace.getByRole('button',{name:'Clear current selection'}).click();await input.setInputFiles(names.map(n=>path.resolve(folder,n)));await settled(10);
 assert.equal(await queue.count(),10);assert.match(await workspace.innerText(),/OCR required/);assert.match(await workspace.innerText(),/Patient mismatch/);assert.match(await workspace.innerText(),/No supported measurements/);assert.match(await workspace.locator('.pdf-import-summary').innerText(),/55 measurements recognized/);await unchanged();checks.push('All ten generated PDFs auto-read with independent OCR, mismatch and unsupported states');
 assert.equal(await workspace.getByRole('button',{name:'Apply approved values'}).isDisabled(),true);
 assert.ok(!requests.some(r=>r.path.endsWith('/save')||r.path.endsWith('/predict')));assert.deepEqual(errors,[]);
 await workspace.scrollIntoViewIfNeeded();await page.screenshot({path:out+'/desktop.png',fullPage:true});await page.setViewportSize({width:375,height:900});await page.screenshot({path:out+'/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 const result={status:'passed',scope:'Real application login and file picker, drag/drop and saved-file checkbox against Spring and native PostgreSQL; no request mocks',checks,requests,runtimeErrors:errors,clinicalCountsBefore:baseline,clinicalCountsAfter:counts(session.patient)};fs.writeFileSync(out+'/browser.json',JSON.stringify(result,null,2));console.log(JSON.stringify({status:result.status,checks,clinicalCountsUnchanged:true},null,2));
}catch(e){await page?.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});throw e;}finally{await browser.close();}
