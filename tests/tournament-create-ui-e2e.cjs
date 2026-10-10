const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5173';
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
  await page.getByPlaceholder(/Barangay Summer Basketball/i).fill(`UI Create Verification ${stamp}`);
  const dateInputs = page.locator('.tournament-create-dialog input[type="date"]');
  await dateInputs.nth(0).fill('2026-10-10');
  if (!await page.locator('.tournament-court-choice.is-checked').count()) {
    if (await page.getByRole('button', { name: 'Use venue' }).count()) {
      await page.getByRole('button', { name: 'Use venue' }).first().click();
    } else {
      await page.getByPlaceholder(/Ormoc City Sports Complex/i).fill(`UI Create Venue ${stamp}`);
      await page.getByPlaceholder(/Street, barangay, city/i).fill('Ormoc City, Leyte');
      const attachButton = page.getByRole('button', { name: /Attach venue/i });
      await attachButton.click();
      await page.waitForFunction(() => !document.querySelector('.tournament-inline-venue .btn')?.disabled, null, { timeout: 60000 });
      if (!await page.locator('.tournament-court-choice.is-checked').count()) {
        throw new Error(`Attach venue failed: ${(await page.locator('.tournament-inline-message').allTextContents()).join(' | ') || 'no message'}`);
      }
    }
  }
  await page.locator('.tournament-availability-actions').getByRole('button', { name: /Save availability/i }).click();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/tournaments') && response.request().method() === 'POST');
  await page.getByRole('button', { name: /Save tournament/i }).click();
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
