const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..'), base='http://127.0.0.1:5180';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const checks=[];
 for(const route of ['/legal/privacy','/legal/terms','/legal/cookies','/legal/accessibility','/legal/claims','/legal/responsible','/sports/tournaments/2']){
  const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[],failures=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`)});
  await page.goto(base+route);await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
  const value=await page.evaluate(()=>({title:document.querySelector('h1')?.innerText,overflow:document.documentElement.scrollWidth>innerWidth+2,footerLinks:document.querySelectorAll('.court-footer a').length}));
  checks.push({route,...value,errors,failures});await page.close();
 }
 for(const role of ['organization_admin','platform_admin']){
  const session=sessions.find(s=>s.user.role===role),context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.addInitScript(s=>{localStorage.setItem('sportsync_token',s.token);localStorage.setItem('sportsync_user',JSON.stringify(s.user));},session);
  const page=await context.newPage(),errors=[],failures=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400)failures.push(`${r.status()} ${r.url()}`)});
  await page.goto(base+'/tournaments');await page.waitForLoadState('networkidle',{timeout:30000}).catch(()=>{});
  checks.push({role,found:(await page.locator('body').innerText()).includes('Ormoc Inter-Barangay Basketball Tournament 2026'),errors,failures});await context.close();
 }
 console.log(JSON.stringify(checks,null,2));await browser.close();
 if(checks.some(c=>c.errors.length||c.failures.length||c.overflow||c.found===false||(!c.role&&(!c.title||c.footerLinks<7))))process.exit(2);
})().catch(e=>{console.error(e);process.exit(1)});
