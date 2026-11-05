const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const staff = sessions.find(item => item.user.role === 'statistician');
if (!staff) throw new Error('Staff Admin audit session is unavailable.');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, staff);
  const page = await context.newPage();
  const failures = [];
  page.on('response', response => {
    if (/\/api\/teams\/\d+\/qr$/.test(response.url()) && response.status() >= 400) failures.push({ url: response.url(), status: response.status() });
  });
  await page.goto(`${base}/qr-attendance`);
  await page.getByRole('heading', { name: 'QR Game Access' }).waitFor();
  await page.getByRole('button', { name: /Printable Team QR/i }).click();
  await page.waitForTimeout(700);
  if (failures.length) throw new Error(`Assigned team QR access failed: ${JSON.stringify(failures)}`);
  await page.locator('.qr-team-pass img').waitFor();
  console.log(JSON.stringify({ staff_admin_qr_pass_visible: true, forbidden_requests: 0 }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
