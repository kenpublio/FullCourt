const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.FULLCOURT_WEB_URL||'http://127.0.0.1:5180';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const checks=[];
  for(const [role,route] of [['coach','/coach'],['coach','/notifications'],['platform_admin','/notifications']]){
    const session=sessions.find(item=>item.user.role===role);
    const context=await browser.newContext({viewport:{width:1365,height:900}});
    await context.addInitScript(value=>{localStorage.setItem('sportsync_token',value.token);localStorage.setItem('sportsync_user',JSON.stringify(value.user));},session);
    const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+route,{waitUntil:'networkidle'});
    const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    const legacyCopy=await page.getByText(/Team Invitations|Player Applications|player dashboard/i).count();
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);
    const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    checks.push({role,route,errors,desktopOverflow,mobileOverflow,legacyCopy});await context.close();
  }
  await browser.close();console.log(JSON.stringify(checks,null,2));
  if(checks.some(check=>check.errors.length||check.desktopOverflow||check.mobileOverflow||check.legacyCopy))process.exit(2);
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
