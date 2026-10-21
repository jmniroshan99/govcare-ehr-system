// Synthetic software QA; runs the established browser suite with additional gates.
import fs from 'node:fs/promises';
const original=new URL('./verify-ckd-outlook-browser.mjs',import.meta.url);
const temporary=new URL('./.verify-cdss-browser.generated.mjs',import.meta.url);
let source=await fs.readFile(original,'utf8');
source=source.replace('key:p.id,patient:p','patient:p'); // Exercise switching without a React remount.
source=source.replace('checks:checks.length','additionalChecks:["Visible observation plot at all three widths","Expanded learned-model readiness and next action","Patient switching without React remount"],checks:checks.length');
source=source.replace("await page.locator('.ckd-outlook').screenshot",`await page.getByLabel('Learned five-year research model readiness',{exact:true}).locator('summary').click();
  await page.getByText('Next action:',{exact:true}).waitFor();
  assert.match(await page.getByLabel('Learned five-year research model readiness',{exact:true}).innerText(),/no adjudicated first-kidney-failure endpoint/);
  await page.locator('.co-history-chart').scrollIntoViewIfNeeded();
  try {await page.locator('.co-history-chart svg').waitFor({timeout:3000});}
  catch(error) {console.log(await page.locator('.co-history-chart svg').evaluate(svg=>{let n=svg;const a=[];while(n){const s=getComputedStyle(n),b=n.getBoundingClientRect();a.push({tag:n.tagName,class:n.getAttribute('class'),display:s.display,visibility:s.visibility,width:b.width,height:b.height});n=n.parentElement;}return a;}));throw error;}
  assert.equal(await page.locator('.co-history-chart .recharts-line').count(),1);
  await page.locator('.ckd-outlook').screenshot`);
try {await fs.writeFile(temporary,source);await import(temporary.href);}
finally {await fs.rm(temporary,{force:true});}
