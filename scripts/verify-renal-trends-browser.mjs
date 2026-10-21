import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const root=process.cwd(),output=path.resolve('verification/renal-trends-v56');
const fixtures=JSON.parse(await fs.readFile(path.join(output,'ui-fixtures.json'),'utf8'));
const {chromium}=await import(process.env.GOVCARE_PLAYWRIGHT_MODULE?pathToFileURL(process.env.GOVCARE_PLAYWRIGHT_MODULE).href:'playwright');
const html=path.join(root,`renal-trends-qa-${crypto.randomUUID()}.html`),site=process.env.GOVCARE_VISUAL_URL||'http://127.0.0.1:5300';
const patient={id:fixtures.paired.patientId,hospital_id:fixtures.paired.hospitalId,patient_no:'TRENDS-SOFTWARE-QA',full_name:'Operational software QA; not a clinical subject'};
const errors=[],checks=[],headers={'access-control-allow-origin':'*','access-control-allow-headers':'Content-Type,Cache-Control,Pragma,X-Request-ID,Authorization','access-control-allow-methods':'GET,POST,OPTIONS'};
const widths=process.env.GOVCARE_TRENDS_WIDTHS?JSON.parse(process.env.GOVCARE_TRENDS_WIDTHS):[1366,768,375];
let browser,page;
try{
 await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
 await fs.writeFile(html,`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="root"></div><script type="module">import React,{useState}from'react';import{createRoot}from'react-dom/client';import{MemoryRouter}from'react-router-dom';import'/src/index.css';import{SriLankanRenalPanel}from'/src/components/ai/SriLankanRenalPanel.tsx';const patient=${JSON.stringify(patient)};function App(){const[p,setP]=useState(patient);return React.createElement(MemoryRouter,null,React.createElement('p',{style:{padding:12,fontSize:12}},'OPERATIONAL SOFTWARE QA — simulated test records; not clinical patient data'),React.createElement('button',{onClick:()=>setP({...patient,id:'00000000-0000-4000-8000-000000000003'})},'Switch authorized patient'),React.createElement(SriLankanRenalPanel,{patient:p}))}createRoot(document.getElementById('root')).render(React.createElement(App));</script></body></html>`,{flag:'wx'});
 browser=await chromium.launch({headless:true,executablePath:process.env.GOVCARE_CHROMIUM_EXECUTABLE||undefined});page=await browser.newPage({timezoneId:"Asia/Colombo",locale:"en-GB"});page.on('pageerror',e=>errors.push(e.message));
 let scenario='paired',gets=0,failed=false;
 await page.route('**/api/ai-cdss/ckd/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  assert.ok(route.request().url().endsWith('/predictive-intelligence'));
  gets++;if(failed)return route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({message:'Operational service outage',errorId:'TRENDS-QA-503'})});
  const data=structuredClone(fixtures[scenario]);data.patientId=route.request().url().match(/patients\/([^/]+)/)[1];
  return route.fulfill({status:200,headers,contentType:'application/json',body:JSON.stringify(data)});
 });
 const open=async name=>{scenario=name;await page.goto(new URL(path.basename(html),site).href);await page.locator('.renal-trends').waitFor();};
 for(const width of widths)for(const theme of ['light','dark']){
  await page.setViewportSize({width,height:900});await open('paired');await page.evaluate(t=>document.documentElement.classList.toggle('dark',t==='dark'),theme);
  const panel=page.locator('.renal-trends');assert.equal(await panel.getByRole('button',{name:/Hemoglobin/}).count(),1);
  assert.match(await panel.innerText(),/10\.2/);assert.equal(await panel.locator('.recharts-line-dots').first().locator('circle').count(),2);
  for(const value of await panel.getByLabel('Renal trend measurement',{exact:true}).locator('option').evaluateAll(options=>options.map(o=>o.value))){await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption(value);assert.ok((await panel.locator('.renal-trends-plot-heading h4').innerText()).endsWith('Trend'));}
  await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption('hemoglobin');
  const svg=panel.locator('.recharts-surface').first();assert.ok(await svg.isVisible());
  await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption('creatinine');assert.match(await panel.getByRole('heading',{name:'Serum Creatinine Trend'}).innerText(),/Creatinine/);
  await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption('hemoglobin');
  for(const range of ['30','3','6','12','all']){await panel.getByLabel('Renal trend time range').selectOption(range);assert.equal(await panel.locator('.recharts-line-dots').first().locator('circle').count(),range==='30'?1:2);}
  await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption('hemoglobin');
  await panel.screenshot({path:path.join(output,'screenshots',`renal-trends-${theme}-${width}.png`)});
  await panel.getByRole('button',{name:'View clinical history',exact:true}).click();assert.equal(await panel.locator('.renal-trends-sources').getAttribute('open'),'');assert.equal(await panel.locator('tbody tr').count(),10);
  await panel.getByRole('button',{name:'Add laboratory result',exact:true}).click();assert.equal(await page.getByRole('dialog').count(),1);await page.keyboard.press('Escape');
  for(const key of ['urea','albumin','sodium','calcium']){await panel.getByLabel('Renal trend measurement',{exact:true}).selectOption(key);await panel.getByRole('button',{name:'Add laboratory result',exact:true}).click();assert.equal(await page.getByRole('dialog').getByLabel('Measurement',{exact:true}).inputValue(),key);await page.keyboard.press('Escape');}
  const before=gets;await panel.getByRole('button',{name:'Refresh trends',exact:true}).click();await page.waitForFunction(()=>Boolean(document.querySelector('.renal-trends')));assert.ok(gets>before);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`${width}px ${theme} page overflow`);
  checks.push(`${width}px ${theme}: dated chart, selector, all ranges, source table, entry dialog, refresh, no page overflow`);
 }
 await open('one');assert.equal(await page.locator('.renal-trends .recharts-line-dots').first().locator('circle').count(),1);assert.match(await page.locator('.renal-trends').innerText(),/Single measured point/);assert.match(await page.locator('.renal-trends').innerText(),/A trend requires a second comparable date/);
 await open('empty');assert.match(await page.locator('.renal-trends').innerText(),/Historical graph not ready/);assert.equal(await page.locator('.renal-trends-chart').count(),0);assert.match(await page.locator('.renal-trends').innerText(),/0\/2 dated results/);await page.locator('.renal-trends').screenshot({path:path.join(output,'screenshots','renal-trends-empty-375.png')});
 await open('excluded');await page.locator('.renal-trends').getByRole('button',{name:'View clinical history',exact:true}).click();const text=await page.locator('.renal-trends-sources').innerText();for(const reason of ['missing collection date','invalid value or unit','source not verified'])assert.ok(text.includes(reason));
 await open('paired');scenario='empty';await page.getByRole('button',{name:'Switch authorized patient',exact:true}).click();await page.locator('.renal-trends-empty').waitFor();assert.equal(await page.locator('.renal-trends-chart').count(),0);
 failed=true;await page.locator('.renal-trends').getByRole('button',{name:'Refresh trends',exact:true}).click();await page.getByRole('alert').waitFor();assert.equal(await page.locator('.renal-trends').count(),0);assert.match(await page.getByRole('alert').innerText(),/TRENDS-QA-503/);
 checks.push('One point, compact zero state, exclusion reasons, patient switching and recoverable API failure');assert.deepEqual(errors,[]);
 const report={status:'passed',scope:'Production SriLankanRenalPanel and entry dialog; Java assembler fixtures at HTTP boundary. Operational synthetic test records are never used as patient results. Native authentication is checked separately.',widths,themes:['light','dark'],runtimeErrors:errors,checks};
 await fs.writeFile(path.join(output,'browser.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}catch(error){console.error(JSON.stringify({errors,overflow:await page?.evaluate(()=>[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).slice(0,25).map(e=>({tag:e.tagName,class:e.getAttribute('class'),right:e.getBoundingClientRect().right,overflow:getComputedStyle(e).overflowX,width:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth}))).catch(()=>[]),message:error.message}));await page?.screenshot({path:path.join(output,'screenshots','qa-failure.png')}).catch(()=>{});throw error;}finally{await browser?.close();await fs.rm(html,{force:true});}
