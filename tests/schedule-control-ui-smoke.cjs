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
  await page.getByRole('button', { name: /Ready games/ }).waitFor();
  const options = await tournament.locator('option').evaluateAll(nodes => nodes.map(node => node.value).filter(Boolean));
  let readyRows = 0;
  let selectedTournament = '';
  for (const value of options) {
    await tournament.selectOption(value);
    await page.waitForTimeout(350);
    readyRows = await page.locator('.schedule-table tbody tr').count();
    if (readyRows > 0) { selectedTournament = await tournament.locator('option:checked').textContent(); break; }
  }
  if (!readyRows) throw new Error('No tournament exposes a ready matchup for schedule-control verification.');
  if (await page.getByText('cancelled', { exact: true }).count()) throw new Error('Cancelled bracket placeholders remain visible.');
  await page.getByRole('button', { name: /Configure optimizer/ }).click();
  await page.getByRole('dialog', { name: 'Build the playable game slots' }).waitFor();
  const optimizerDate = await page.locator('.schedule-setup-form input[type="date"]').inputValue();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(optimizerDate)) throw new Error(`Optimizer did not provide a valid first game date: ${optimizerDate}.`);
  await page.getByText('Game start', { exact: true }).waitFor();
  await page.getByText('Court available until', { exact: true }).waitFor();
  await page.getByText('Games per team / day', { exact: true }).waitFor();
  await page.getByLabel('Complete game location').waitFor();
  const timeInputs=page.locator('.schedule-setup-form input[type="time"]');
  if(await timeInputs.count()!==2)throw new Error('Court opening and closing controls are incomplete.');
  await page.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: /Future rounds/ }).click();
  const futureRows = await page.locator('.schedule-table tbody tr').count();
  if (!futureRows) throw new Error('Future bracket rounds are not available in their separate view.');

  await page.getByRole('button', { name: /Ready games/ }).click();
  const editButtons = page.getByRole('button', { name: /Change time/ });
  const editableFixture = await editButtons.count() > 0;
  if (editableFixture) {
    await editButtons.first().click();
    await page.getByRole('dialog', { name: 'Change time or venue' }).waitFor();
    await page.getByText('Coaches will be notified').waitFor();
    await page.getByRole('button', { name: 'Cancel' }).click();
  }

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
  console.log(JSON.stringify({ tournament: selectedTournament?.trim(), ready_games: readyRows, future_round_rows: futureRows, tournament_start_default: optimizerDate, court_hours:true, games_per_day:true, edit_modal: editableFixture ? 'passed' : 'skipped: no editable scheduled fixture', mobile_layout: true }, null, 2));
  await browser.close();
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
