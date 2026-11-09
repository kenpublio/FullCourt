const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find(item => item.user.role === 'platform_admin');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const result = {};
  for (const [label, viewport] of Object.entries({ desktop: { width: 1280, height: 900 }, mobile: { width: 390, height: 844 } })) {
    const context = await browser.newContext({ viewport });
    await context.addInitScript(session => {
      localStorage.setItem('sportsync_token', session.token);
      localStorage.setItem('sportsync_user', JSON.stringify(session.user));
    }, admin);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/brackets`);
    await page.getByText('How to use the bracket', { exact: true }).waitFor();
    const guide = page.locator('.bracket-guide').first();
    await page.waitForTimeout(700);
    if (!(await guide.locator('.bracket-guide-body').isVisible())) await guide.locator('summary').click();
    await guide.locator('.bracket-guide-body').waitFor();
    for (const heading of ['Select the tournament', 'Generate the match path', 'Review Round 1', 'Finalize games to advance']) {
      await guide.getByRole('heading', { name: heading }).waitFor();
    }
    const guideText = await guide.textContent();
    if (!/TBD means the team depends/i.test(guideText || '')) throw new Error(`${label} bracket status explanation is missing.`);
    const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: document.documentElement.clientWidth }));
    if (dimensions.page > dimensions.viewport + 2) throw new Error(`${label} bracket guide overflows (${dimensions.page}/${dimensions.viewport}).`);
    if (errors.length) throw new Error(`${label} browser errors: ${errors.join(' | ')}`);
    result[label] = { guide_visible: true, overflow: false, errors: 0 };
    await context.close();
  }
  await browser.close();
  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.stack || error); process.exit(1); });
