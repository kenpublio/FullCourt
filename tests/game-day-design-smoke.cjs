const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.FULLCOURT_WEB_URL||'http://127.0.0.1:5180';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const results=[];
  for(const [role,route] of [['platform_admin','/game-day'],['coach','/coach']]){
    const session=sessions.find(item=>item.user.role===role);
    if(!session)throw new Error(`${role} fixture is unavailable.`);
    const context=await browser.newContext({viewport:{width:1365,height:900}});
    await context.addInitScript(value=>{localStorage.setItem('sportsync_token',value.token);localStorage.setItem('sportsync_user',JSON.stringify(value.user));},session);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base+route,{waitUntil:'networkidle'});
    if(role==='platform_admin'){
      await page.getByRole('button',{name:/Needs attention/i}).waitFor();
      await page.getByLabel('Search game-day fixtures').fill('unlikely-no-match-value');
      await page.getByText('No matching games').waitFor();
    }else{
      const readiness=await page.locator('.coach-readiness-board').textContent();
      if(readiness&&!/\d+\/18 players/.test(readiness))throw new Error('Coach readiness does not show the 18-player roster capacity.');
    }
    const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);
    const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    results.push({role,route,errors,desktopOverflow,mobileOverflow});await context.close();
  }
  await browser.close();console.log(JSON.stringify(results,null,2));
  if(results.some(result=>result.errors.length||result.desktopOverflow||result.mobileOverflow))process.exit(2);
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
