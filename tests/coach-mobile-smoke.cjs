const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const coach = sessions.find(item => item.user.role === 'coach');
if (!coach) throw new Error('Coach audit session is unavailable.');
const routes = ['/coach', '/teams', '/eligibility', '/schedules', '/standings', '/reports', '/payments', '/qr-attendance', '/notifications', '/profile', '/settings'];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = {};
  for (const width of [360, 390, 412]) {
    const context = await browser.newContext({ viewport: { width, height: 844 }, isMobile: true, hasTouch: true });
    await context.addInitScript(session => {
      localStorage.setItem('sportsync_token', session.token);
      localStorage.setItem('sportsync_user', JSON.stringify(session.user));
    }, coach);
    const page = await context.newPage();
    const errors = [];
    const failures = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 500) failures.push({ url: response.url(), status: response.status() }); });
    for (const route of routes) {
      await page.goto(`${base}${route}`);
      await page.locator('main, .app-page, .dashboard-wrapper, .container-fluid').first().waitFor({ timeout: 15000 });
      const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
      if (dimensions.page > dimensions.viewport + 2) throw new Error(`${route} overflows at ${width}px: ${dimensions.page}px page width.`);
    }
    if (errors.length) throw new Error(`Coach browser errors at ${width}px: ${errors.join(' | ')}`);
    if (failures.length) throw new Error(`Coach server failures at ${width}px: ${JSON.stringify(failures)}`);
    results[`${width}px`] = { routes: routes.length, overflow: false, browser_errors: 0, server_errors: 0 };
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
