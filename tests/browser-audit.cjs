const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'output', 'browser-audit');
fs.mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:5180';
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const sessions = JSON.parse(execFileSync('php', [path.join(__dirname,'BrowserAuditSession.php')], {cwd:root,encoding:'utf8'}));
  const results = [];
  for (const session of [null,...sessions]) {
    const role = session?.user.role || 'public';
    const context = await browser.newContext({ viewport:{width:1440,height:1000} });
    if(session) await context.addInitScript(s => {
      localStorage.setItem('sportsync_token',s.token);
      localStorage.setItem('sportsync_user',JSON.stringify(s.user));
    },session);
    const page=await context.newPage();
    let errors=[],failures=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('response',r=>{if(r.status()>=400)failures.push({url:r.url(),status:r.status()});});
    page.on('dialog', d=>d.dismiss());
    const home = {platform_admin:'/platform',organization_admin:'/organizer',coach:'/coach',player:'/player'}[role]||'/';
    await page.goto(base+home); await page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{});
    if(session) await page.locator('.sidebar-menu').waitFor({timeout:45000});
    const routes = session ? await page.locator('.sidebar-menu a').evaluateAll(a=>[...new Set(a.map(n=>n.getAttribute('href')))]) : ['/','/login','/admin','/register','/forgot-password','/sports','/sports/tournaments/2'];
    for(const route of routes) {
      errors=[];failures=[];
      await page.goto(base+route); await page.waitForLoadState('networkidle',{timeout:45000}).catch(()=>{});
      if(session) await page.locator('.sidebar-menu').waitFor({timeout:45000});
      const info=await page.evaluate(()=>({title:document.querySelector('main h1,main h2,main h3,h1,h2,h3')?.innerText,
        overflow:document.documentElement.scrollWidth>innerWidth+2,
        buttons:[...document.querySelectorAll('main button')].map(b=>({text:b.innerText||b.getAttribute('aria-label')||b.title,disabled:b.disabled})),
        alerts:[...document.querySelectorAll('[role=alert],.alert-danger')].map(e=>e.innerText),
        brokenImages:[...document.images].filter(i=>!i.complete||i.naturalWidth===0).map(i=>i.getAttribute('src'))}));
      const name=role+route.replaceAll('/','-');
      await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
      await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
      const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
      await page.screenshot({path:path.join(out,name+'-mobile.png'),fullPage:true});
      await page.setViewportSize({width:1440,height:1000});
      const result={role,route,landed:new URL(page.url()).pathname,...info,mobileOverflow,errors:[...errors],failures:[...failures]};
      results.push(result);console.log(JSON.stringify({role,route,title:info.title,errors,failures,overflow:info.overflow,mobileOverflow}));
    }
    await context.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(results,null,2));
  await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1)});
