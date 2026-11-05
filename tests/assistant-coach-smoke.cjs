const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const assistant = sessions.find(item => item.user.role === 'assistant_coach');
if (!assistant) throw new Error('Assistant Coach audit account is unavailable.');

const routes = ['/coach', '/schedules', '/standings', '/reports', '/qr-attendance', '/notifications', '/profile', '/settings'];
const restrictedRoutes = ['/teams', '/eligibility', '/payments', '/live-scoring'];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await context.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, assistant);
  const page = await context.newPage();
  const pageErrors = [];
  const serverFailures = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => { if (response.status() >= 500) serverFailures.push({ url: response.url(), status: response.status() }); });

  for (const route of routes) {
    await page.goto(`${base}${route}`);
    await page.locator('main, .app-page, .dashboard-wrapper, .container-fluid').first().waitFor({ timeout: 15000 });
    if (new URL(page.url()).pathname !== route) throw new Error(`${route} redirected to ${page.url()}.`);
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
    if (dimensions.page > dimensions.viewport + 2) throw new Error(`${route} overflows on mobile: ${dimensions.page}px page width.`);
  }

  for (const route of restrictedRoutes) {
    await page.goto(`${base}${route}`);
    await page.waitForTimeout(300);
    if (new URL(page.url()).pathname === route) throw new Error(`Assistant Coach can access restricted route ${route}.`);
  }
  if (pageErrors.length) throw new Error(`Browser errors: ${pageErrors.join(' | ')}`);
  if (serverFailures.length) throw new Error(`Server failures: ${JSON.stringify(serverFailures)}`);

  console.log(JSON.stringify({ role: 'assistant_coach', accessible_routes: routes.length, restricted_routes: restrictedRoutes.length, mobile_overflow: false, browser_errors: 0, server_errors: 0 }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
