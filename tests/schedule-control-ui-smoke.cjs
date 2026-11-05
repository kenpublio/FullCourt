const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find(item => item.user.role === 'platform_admin');
if (!admin) throw new Error('Platform Admin audit session is unavailable.');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, admin);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));

  await page.goto(`${base}/schedules`);
  await page.getByRole('heading', { name: 'Game Schedule & Venue Assignment' }).waitFor();
  const tournament = page.locator('.schedule-ops-hero select');
  await tournament.selectOption({ label: 'Linao Inter-Purok Under 21' });
  await page.getByRole('button', { name: /Ready games/ }).waitFor();
  await page.waitForTimeout(400);

  const readyRows = await page.locator('.schedule-table tbody tr').count();
  if (readyRows !== 5) throw new Error(`Expected 5 ready games, found ${readyRows}.`);
  if (await page.getByText('cancelled', { exact: true }).count()) throw new Error('Cancelled bracket placeholders remain visible.');
  const optimizerDate = await page.locator('.schedule-run-fields input[type="date"]').inputValue();
  if (optimizerDate !== '2026-11-15') throw new Error(`Optimizer date should start at tournament date, found ${optimizerDate}.`);
  await page.getByText('Court opens / first tip-off', { exact: true }).waitFor();
  await page.getByText('Court closes', { exact: true }).waitFor();
  await page.getByText('Games per team/day', { exact: true }).waitFor();
  const timeInputs=page.locator('.schedule-run-fields input[type="time"]');
  if(await timeInputs.count()!==2)throw new Error('Court opening and closing controls are incomplete.');

  await page.getByRole('button', { name: /Future rounds/ }).click();
  const futureRows = await page.locator('.schedule-table tbody tr').count();
  if (!futureRows) throw new Error('Future bracket rounds are not available in their separate view.');

  await page.getByRole('button', { name: /Ready games/ }).click();
  await page.getByRole('button', { name: /Change time/ }).first().click();
  await page.getByRole('dialog', { name: 'Change time or venue' }).waitFor();
  await page.getByText('Coaches will be notified').waitFor();
  await page.getByRole('button', { name: 'Cancel' }).click();

  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await mobile.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, admin);
  const mobilePage = await mobile.newPage();
  await mobilePage.goto(`${base}/schedules`);
  await mobilePage.getByRole('heading', { name: 'Game Schedule & Venue Assignment' }).waitFor();
  const bodyWidth = await mobilePage.locator('body').evaluate(node => node.scrollWidth);
  if (bodyWidth > 410) throw new Error(`Mobile schedule page has unintended page overflow (${bodyWidth}px).`);

  if (errors.length) throw new Error(`Browser errors: ${errors.join(' | ')}`);
  console.log(JSON.stringify({ ready_games: readyRows, future_round_rows: futureRows, tournament_start_default: optimizerDate, court_hours:true, games_per_day:true, edit_modal: true, mobile_layout: true }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
