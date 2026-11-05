const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${webBase}/sports`, { waitUntil: 'networkidle' });
  if (await page.getByRole('button', { name: /^Live$/i }).count()) throw new Error('The removed tournament Live filter is still visible.');
  const tournamentCard = page.locator('.court-tournament').first();
  await tournamentCard.waitFor();
  await tournamentCard.click();
  await page.getByRole('tab', { name: /Teams/i }).waitFor();
  await page.locator('.hub-team-card').first().click();
  await page.getByRole('heading', { name: /Verified players/i }).waitFor();
  if (!await page.locator('.hub-public-roster article').count()) throw new Error('The selected team public roster is empty.');

  await page.goto(`${webBase}/sports/schedule`, { waitUntil: 'networkidle' });
  await page.getByRole('heading', { name: /Select a tournament/i }).waitFor();
  const picker = page.getByLabel('Select tournament schedule');
  await picker.waitFor();
  if (await page.locator('.daily-list').count()) throw new Error('Schedule loaded before a tournament was selected.');
  await picker.selectOption({ index: 1 });
  await page.locator('.daily-list article').first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  await browser.close();
  if (errors.length || overflow) throw new Error(errors.join('; ') || 'Public tournament flow has mobile overflow.');
  console.log(JSON.stringify({ tournament_required: true, complete_schedule_visible: true, live_filter_removed: true, public_roster_visible: true, mobile_passed: true }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
