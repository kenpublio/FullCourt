const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs = require('node:fs');
const path = require('node:path');

const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';

(async () => {
  const portal = await fetch(`${apiBase}/public/portal`).then((response) => response.json());
  const game = portal.data?.matches?.find((match) => match.status === 'completed');
  if (!game) throw new Error('No completed public rehearsal game is available.');
  const live = await fetch(`${apiBase}/public/matches/${game.id}/live`).then((response) => response.json());
  if ((live.data?.events || []).length < 13) throw new Error('Public play-by-play is not connected to the scoring events.');
  if ((live.data?.box_score || []).length < 1) throw new Error('Public player box score is empty.');
  if ((live.data?.period_scores || []).length < 4) throw new Error('Quarter-by-quarter totals are incomplete.');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${webBase}/sports/games/${game.id}?tournament=${game.tournament_id}`, { waitUntil: 'networkidle' });
  if (errors.length) throw new Error(`Public game runtime error: ${errors.join('; ')}`);
  if (!await page.getByRole('heading', { name: /Quarter breakdown/i }).count()) {
    throw new Error(`Quarter breakdown did not render. Page text: ${(await page.locator('body').innerText()).slice(0, 1200)}`);
  }
  await page.getByRole('heading', { name: /Quarter breakdown/i }).waitFor();
  await page.getByRole('heading', { name: /Team lineups/i }).waitFor();
  await page.locator('.game-team-lineups h3', { hasText: 'Barangay Linao Eagles' }).waitFor();
  await page.locator('.game-team-lineups h3', { hasText: 'Barangay Ipil Warriors' }).waitFor();
  if (await page.getByText(/Assigned statistician/i).count()) throw new Error('The internal statistician assignment is still exposed on the public page.');
  await page.getByRole('heading', { name: /Box score/i }).waitFor();
  const ipilTab = page.getByRole('tab', { name: /Barangay Ipil Warriors/i });
  const linaoTab = page.getByRole('tab', { name: /Barangay Linao Eagles/i });
  await ipilTab.waitFor();
  await linaoTab.waitFor();
  await ipilTab.click();
  await page.getByText(/Jules Bautista/i).last().waitFor();
  await linaoTab.click();
  await page.getByText(/Ken Repollo/i).last().waitFor();
  if (await page.getByRole('heading', { name: /Play-by-play/i }).count()) throw new Error('The public play-by-play section is still visible.');
  if (await page.getByText(/Ready for tip-off|Run every game from one court/i).count()) throw new Error('The generic promotional footer is still visible on the game page.');
  await page.getByRole('heading', { name: /Where do you want to go next/i }).waitFor();
  await page.getByRole('navigation', { name: /Game page shortcuts/i }).waitFor();
  await page.getByText(/Ken Repollo|Marco Villarin|Jules Bautista/i).first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  const output = path.resolve(__dirname, '..', 'output', 'browser-audit');
  fs.mkdirSync(output, { recursive: true });
  const screenshot = path.join(output, 'public-game-overview-mobile.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await browser.close();
  if (errors.length || overflow) throw new Error(errors.join('; ') || 'Public game overview has mobile horizontal overflow.');
  console.log(JSON.stringify({ game_id: game.id, tournament_id: game.tournament_id, score: `${game.team1_score}-${game.team2_score}`, public_play_by_play: live.data.events.length, quarter_rows: live.data.period_scores.length, box_score_players: live.data.box_score.length, mobile_overview_passed: true, screenshot }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
