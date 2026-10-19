const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, 'tmp', 'pdfs', 'system-guide-screens');
const base = process.env.APP_URL || 'http://127.0.0.1:5173';
const sessions = JSON.parse(execFileSync('php', [path.join(root, 'tests', 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));

const captures = [
  { name: '01-public-home', route: '/', role: null },
  { name: '02-public-game-center', route: '/sports', role: null },
  { name: '03-public-schedule', route: '/sports/schedule', role: null },
  { name: '04-admin-dashboard', route: '/platform', role: 'platform_admin' },
  { name: '05-admin-tournaments', route: '/tournaments', role: 'platform_admin' },
  { name: '06-admin-schedule', route: '/schedules', role: 'platform_admin' },
  { name: '07-coach-dashboard', route: '/coach', role: 'coach' },
  { name: '08-coach-roster', route: '/teams', role: 'coach' },
  { name: '09-staff-dashboard', route: '/dashboard', role: 'statistician' },
  { name: '10-staff-scoring', route: '/scorekeeper', role: 'statistician' },
];
const selectedNames = new Set((process.env.SCREEN_NAMES || '').split(',').map((value) => value.trim()).filter(Boolean));
const selectedCaptures = selectedNames.size ? captures.filter((item) => selectedNames.has(item.name)) : captures;

(async () => {
  if (!selectedNames.size) fs.rmSync(output, { recursive: true, force: true });
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  for (const item of selectedCaptures) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    if (item.role) {
      const session = sessions.find((entry) => entry.user.role === item.role);
      if (!session) throw new Error(`Missing browser session for ${item.role}`);
      await context.addInitScript((value) => {
        localStorage.setItem('sportsync_token', value.token);
        localStorage.setItem('sportsync_user', JSON.stringify(value.user));
        if (value.user.role === 'platform_admin') localStorage.setItem('admin_console_theme', 'light');
      }, session);
    }
    const page = await context.newPage();
    await page.goto(base + item.route, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(700);
    if (process.env.DEBUG_SELECTOR) {
      const debug = await page.locator(process.env.DEBUG_SELECTOR).first().evaluate((element) => ({
        color: getComputedStyle(element).color,
        className: element.className,
        ancestors: [...function* () { let node = element.parentElement; while (node) { yield node.className; node = node.parentElement; } }()],
      })).catch(() => null);
      console.log(JSON.stringify({ selector: process.env.DEBUG_SELECTOR, debug }));
    }
    await page.screenshot({ path: path.join(output, `${item.name}.png`), fullPage: false });
    console.log(`${item.name}: ${page.url()}`);
    await context.close();
  }

  await browser.close();
})().catch((error) => {
  console.error(error.stack || error.message);
  process.exit(1);
});
