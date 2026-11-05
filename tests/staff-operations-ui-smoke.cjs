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

  await page.goto(`${base}/officials`);
  await page.getByRole('heading', { name: 'Scoring Access' }).waitFor();
  await page.getByRole('link', { name: /Open Courtside Statistician/i }).waitFor();
  await page.getByRole('button', { name: /Generate secure link/i }).waitFor();

  await page.goto(`${base}/standings`);
  await page.getByRole('heading', { name: 'Tournament Standings' }).waitFor();
  await page.getByRole('link', { name: /Open Courtside Statistician/i }).waitFor();
  await page.getByRole('link', { name: /Manage scoring links/i }).waitFor();

  await page.goto(`${base}/venues`);
  await page.getByRole('heading', { name: /Venue & Court Management/i }).waitFor();
  await page.getByRole('button', { name: /Edit/i }).first().waitFor({ timeout: 15000 });
  const editVenueButtons = await page.getByRole('button', { name: /Edit/i }).count();
  if (!editVenueButtons) throw new Error('Assigned Staff Admin has no venue edit control.');

  await page.goto(`${base}/brackets`);
  await page.locator('.bracket-engine-board').waitFor();
  const byeCards = page.locator('.bracket-match-card.is-bye');
  const byeCount = await byeCards.count();
  if (await byeCards.locator('.bracket-team-row.is-winner').count()) throw new Error('A bye is still styled as an actual winner.');
  if (await page.locator('.bracket-team-row').filter({ hasText: /^TBD/ }).locator('.is-winner').count()) throw new Error('A TBD team is styled as a winner.');
  if (byeCount) {
    await byeCards.first().getByText('BYE', { exact: true }).waitFor();
    await byeCards.first().getByText('AUTO-ADVANCE', { exact: false }).waitFor();
  }

  const qrFailures = [];
  page.on('response', response => {
    if (/\/api\/teams\/\d+\/qr$/.test(response.url()) && response.status() >= 400) qrFailures.push({ url: response.url(), status: response.status() });
  });
  await page.goto(`${base}/qr-attendance`);
  await page.getByRole('heading', { name: 'QR Game Access' }).waitFor();
  await page.getByRole('button', { name: /Printable Team QR/i }).click();
  await page.waitForTimeout(500);
  if (qrFailures.length) throw new Error(`Assigned Staff Admin QR access failed: ${JSON.stringify(qrFailures)}`);

  console.log(JSON.stringify({ scoring_choices: true, standings_scoring_hub: true, assigned_venue_controls: editVenueButtons, bye_cards_in_assigned_bracket: byeCount, bye_not_counted_as_winner: true, assigned_team_qr_access: true }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
