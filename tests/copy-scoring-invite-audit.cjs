const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const manager = sessions.find(({ user }) => ['organization_admin', 'tournament_organizer'].includes(user.role));
if (!manager) throw new Error('No active organizer demo account is available for this browser check.');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'] });
  await context.addInitScript((session) => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, manager);
  const page = await context.newPage();
  await page.route('**/api/tournaments', (route) => route.fulfill({ json: { data: { tournaments: [{ id: 9901, name: 'Clipboard UI Test' }] } } }));
  await page.route('**/api/tournaments/9901/schedule', (route) => route.fulfill({ json: { data: { schedule: [{ id: 9902, team1_name: 'Test Home', team2_name: 'Test Away' }] } } }));
  await page.route('**/api/matches/9902/scoring-link', (route) => route.fulfill({ json: { data: { access: {
    id: 9903,
    token: 'a'.repeat(64),
    pin: '123456',
    operator_label: 'Clipboard Test Scorer',
    expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  } } } }));

  try {
    await page.goto(`${base}/officials`);
    await page.getByLabel('1. Tournament').selectOption('9901');
    await page.getByLabel('Scorer name').fill('Clipboard Test Scorer');
    await page.getByRole('button', { name: /Generate secure link/ }).click();
    await page.getByRole('button', { name: /Copy invitation/ }).click();
    await page.getByRole('status').filter({ hasText: /copied/i }).waitFor();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    for (const expected of ['http://127.0.0.1:5180/score/', 'PIN: 123456', 'Clipboard Test Scorer']) {
      if (!copied.includes(expected)) throw new Error(`Clipboard text is missing expected content: ${expected}`);
    }
    console.log('PASS: copy-invitation button copied the private link, PIN, and scorer label.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
