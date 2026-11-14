const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
if (!admin) throw new Error('Admin session unavailable.');

(async () => {
  const stamp = Date.now();
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addInitScript((session) => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, admin);
  const page = await context.newPage();
  page.on('dialog', async (dialog) => { console.log(`DIALOG: ${dialog.message()}`); await dialog.dismiss(); });
  await page.goto(`${webBase}/tournaments`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: /Create Tournament/i }).first().click();
  const dialog = page.locator('.tournament-create-dialog');
  await dialog.getByPlaceholder(/Barangay Summer Basketball/i).fill(`UI Create Verification ${stamp}`);
  const dateInputs = dialog.locator('input[type="date"]');
  await dateInputs.nth(0).fill('2026-12-10');
  if (!await dialog.locator('.tournament-court-choice.is-checked').count()) {
    if (await dialog.getByRole('button', { name: 'Use venue' }).count()) {
      await dialog.getByRole('button', { name: 'Use venue' }).first().click();
    } else {
      await dialog.getByPlaceholder(/Ormoc City Superdome/i).fill(`UI Create Venue ${stamp}`);
      await dialog.getByPlaceholder(/Street, barangay, city/i).fill('Ormoc City, Leyte');
      const attachButton = dialog.getByRole('button', { name: /Save and use venue/i });
      await attachButton.click();
      await dialog.locator('.tournament-court-choice.is-checked').first().waitFor({ timeout: 60000 });
      if (!await dialog.locator('.tournament-court-choice.is-checked').count()) {
        throw new Error(`Attach venue failed: ${(await dialog.locator('.tournament-inline-message').allTextContents()).join(' | ') || 'no message'}`);
      }
    }
  }
  if (!await dialog.locator('.tournament-court-choice.is-checked').count()) {
    const firstCourt = dialog.locator('.tournament-court-choice input[type="checkbox"]').first();
    if (await firstCourt.count()) await firstCourt.evaluate((element) => element.click());
  }
  await page.waitForFunction(() => document.querySelectorAll('.tournament-create-dialog .tournament-court-choice.is-checked').length > 0, null, { timeout: 30000 });
  await dialog.locator('.tournament-availability-actions').getByRole('button', { name: /Save availability/i }).click();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/tournaments') && response.request().method() === 'POST');
  await dialog.getByRole('button', { name: /Save tournament/i }).click();
  const response = await responsePromise;
  const payload = await response.json();
  const tournamentId = payload?.data?.id;
  console.log(JSON.stringify({ status: response.status(), tournament_created: Boolean(tournamentId), one_court_selected: true, payload }, null, 2));
  if (tournamentId) await fetch(`http://127.0.0.1:8767/api/tournaments/${tournamentId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` } });
  const venuesResponse = await fetch('http://127.0.0.1:8767/api/venues', { headers: { Authorization: `Bearer ${admin.token}` } });
  const venuesPayload = await venuesResponse.json();
  const temporaryVenue = venuesPayload.data?.venues?.find((venue) => venue.name === `UI Create Venue ${stamp}`);
  if (temporaryVenue) await fetch(`http://127.0.0.1:8767/api/venues/${temporaryVenue.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${admin.token}` } });
  await browser.close();
  if (!response.ok()) process.exit(2);
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
