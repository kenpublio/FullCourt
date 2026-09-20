const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '..');
  const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const checks = [];
  for (const [role, route] of [['coach', '/coach'], ['player', '/player']]) {
    const session = sessions.find(item => item.user.role === role);
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await context.addInitScript(value => {
      localStorage.setItem('sportsync_token', value.token);
      localStorage.setItem('sportsync_user', JSON.stringify(value.user));
    }, session);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:5180${route}`);
    const card = page.locator('.matchup-probability-card');
    await card.waitFor({ timeout: 30000 });
    await card.getByText(/Performance estimate only/i).waitFor({ timeout: 30000 });
    checks.push({ role, visible: await card.isVisible(), hasPercentages: (await card.textContent()).includes('%'), errors });
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(checks));
  if (checks.some(check => !check.visible || !check.hasPercentages || check.errors.length)) process.exit(1);
})().catch(error => { console.error(error); process.exit(1); });
