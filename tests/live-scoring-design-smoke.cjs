const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd:root, encoding:'utf8' }));

(async () => {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const results=[];
  for (const role of ['platform_admin','statistician']) {
    const session=sessions.find(item=>item.user.role===role);
    if (!session) throw new Error(`${role} fixture is unavailable.`);
    const context=await browser.newContext({ viewport:{width:1440,height:960} });
    await context.addInitScript(value=>{
      localStorage.setItem('sportsync_token',value.token);
      localStorage.setItem('sportsync_user',JSON.stringify(value.user));
      localStorage.setItem('fullcourt-theme','light');
    },session);
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const route=role==='platform_admin'?'/live-scoring':'/scorekeeper';
    await page.goto(base+route,{waitUntil:'networkidle'});
    const firstMatch=page.locator('.match-item').first();
    let interaction='no scheduled fixture';
    if (role==='platform_admin' && await firstMatch.count()) {
      await firstMatch.click();
      await page.locator('.live-game-control').waitFor();
      const score=page.locator('.score-number').first();
      const before=Number(await score.textContent());
      await page.locator('.score-btn').first().click();
      const after=Number(await score.textContent());
      await page.getByRole('button',{name:/Undo last/i}).first().click();
      const restored=Number(await score.textContent());
      if (after!==before+1 || restored!==before) throw new Error('Score and true undo interaction failed.');
      await page.locator('.live-game-control input').first().fill('8');
      if (!await page.getByText(/Unsaved changes/i).count()) throw new Error('Unsaved score indicator did not appear.');
      interaction='score, undo, clock, and save-state controls passed';
    }
    const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(250);
    const mobileOverflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2);
    results.push({role,route,interaction,errors,desktopOverflow,mobileOverflow});
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results,null,2));
  if (results.some(result=>result.errors.length||result.desktopOverflow||result.mobileOverflow)) process.exit(2);
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
