const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

(async () => {
  const root = path.resolve(__dirname, '..');
  const out = path.join(root, 'output', 'design-polish');
  fs.mkdirSync(out, { recursive: true });
  const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd:root, encoding:'utf8' }));
  const routes = { platform_admin:'/tournaments', coach:'/coach', statistician:'/statistician' };
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  const results = [];
  for (const session of sessions) {
    const role = session.user.role;
    const context = await browser.newContext({ viewport:{ width:1440, height:960 } });
    await context.addInitScript(s => {
      localStorage.setItem('sportsync_token', s.token);
      localStorage.setItem('sportsync_user', JSON.stringify(s.user));
      localStorage.setItem('fullcourt-theme', 'light');
    }, session);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5180${routes[role]}`, { waitUntil:'networkidle' });
    await page.screenshot({ path:path.join(out, `${role}.png`), fullPage:true });
    const desktopOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    await page.setViewportSize({ width:390, height:844 });
    await page.waitForTimeout(250);
    await page.screenshot({ path:path.join(out, `${role}-mobile.png`), fullPage:true });
    const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
    results.push({ role, errors, desktopOverflow, mobileOverflow });
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error); process.exit(1); });
