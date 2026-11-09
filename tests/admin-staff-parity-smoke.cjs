const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const roles = [
  { key: 'platform_admin', session: sessions.find(item => item.user.role === 'platform_admin') },
  { key: 'staff_admin', session: sessions.find(item => item.user.role === 'statistician') },
];
const shared = [
  ['/teams', 'Team Roster Management'],
  ['/brackets', 'Automated Bracket Engine'],
  ['/officials', 'Scoring Access'],
  ['/schedules', 'Game Schedule & Venue Assignment'],
  ['/standings', 'Tournament Standings'],
  ['/qr-attendance', 'QR'],
  ['/game-day', 'Incident'],
];

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const results = {};
  for (const role of roles) {
    if (!role.session) throw new Error(`${role.key} session is unavailable.`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(session => {
      localStorage.setItem('sportsync_token', session.token);
      localStorage.setItem('sportsync_user', JSON.stringify(session.user));
    }, role.session);
    const page = await context.newPage();
    const pageErrors = [];
    const serverFailures = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('response', response => { if (response.status() >= 500) serverFailures.push({ url: response.url(), status: response.status() }); });
    for (const [route, heading] of shared) {
      await page.goto(`${base}${route}`);
      await page.getByRole('heading', { name: new RegExp(heading, 'i') }).first().waitFor({ timeout: 15000 });
    }
    await page.goto(`${base}/schedules`);
    await page.getByRole('button', { name: /Ready games/i }).waitFor();
    await page.getByRole('button', { name: /Future rounds/i }).waitFor();
    await page.getByRole('button', { name: /Check conflicts/i }).waitFor();
    await page.goto(`${base}/officials`);
    await page.getByRole('button', { name: /Generate secure link/i }).waitFor();
    if (pageErrors.length) throw new Error(`${role.key} browser errors: ${pageErrors.join(' | ')}`);
    if (serverFailures.length) throw new Error(`${role.key} server failures: ${JSON.stringify(serverFailures)}`);
    results[role.key] = { shared_operations: shared.length, schedule_controls: true, scoring_link_controls: true };
    await context.close();
  }

  const adminContext = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await adminContext.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, roles[0].session);
  const adminPage = await adminContext.newPage();
  await adminPage.goto(`${base}/users`);
  await adminPage.getByRole('heading', { name: 'User & Role Management' }).waitFor();
  await adminPage.goto(`${base}/payments`);
  await adminPage.getByRole('heading', { name: /Team Payment Review/i }).waitFor();
  results.platform_admin.admin_only_oversight = true;
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
