const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.APP_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find(row => row.user.role === 'platform_admin');
const staff = sessions.find(row => row.user.role === 'statistician');
if (!admin || !staff) throw new Error('Admin or Staff Admin audit session is unavailable.');

async function api(route, token = admin.token, options = {}) {
  const response = await fetch(apiBase + route, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) return { response, payload: null };
  return { response, payload: await response.json() };
}

(async () => {
  const result = {};

  const health = await api('/system/health');
  if (!health.response.ok || health.payload?.data?.health?.database !== 'online') throw new Error('Admin system health did not report an online database.');
  result.system_health = true;
  result.verified_backup_visible = Boolean(health.payload?.data?.health?.last_backup);

  const publicAnnouncements = await fetch(`${apiBase}/public/announcements`);
  if (!publicAnnouncements.ok) throw new Error('Public announcement feed failed.');
  result.public_announcement_feed = true;

  const tournaments = (await api('/tournaments')).payload?.data?.tournaments || [];
  let completed = null;
  for (const tournament of tournaments) {
    const schedule = (await api(`/tournaments/${tournament.id}/schedule`)).payload?.data?.schedule || [];
    const match = schedule.find(row => ['completed', 'final', 'finished'].includes(String(row.status).toLowerCase()) && row.team1_id && row.team2_id);
    if (match) { completed = { tournament, match }; break; }
  }
  if (!completed) throw new Error('No completed game is available for correction, PDF, and Player-of-the-Game tests.');

  const scoreSheet = await fetch(`${apiBase}/reports/matches/${completed.match.id}/score-sheet.pdf`, { headers: { Authorization: `Bearer ${admin.token}` } });
  const scoreSheetBytes = Buffer.from(await scoreSheet.arrayBuffer());
  if (!scoreSheet.ok || !scoreSheetBytes.subarray(0, 4).equals(Buffer.from('%PDF'))) throw new Error('Official score-sheet PDF was not generated.');
  result.score_sheet_pdf = true;

  const staffTournaments = (await api('/tournaments', staff.token)).payload?.data?.tournaments || [];
  let staffFinal = null;
  for (const tournament of staffTournaments) {
    const schedule = (await api(`/tournaments/${tournament.id}/schedule`, staff.token)).payload?.data?.schedule || [];
    const match = schedule.find(row => ['completed', 'final', 'finished'].includes(String(row.status).toLowerCase()) && row.team1_id && row.team2_id);
    if (match) { staffFinal = match; break; }
  }
  if (staffFinal) {
    const originalHome = Number(staffFinal.team1_score || 0);
    const originalAway = Number(staffFinal.team2_score || 0);
    const correction = await api(`/matches/${staffFinal.id}/score-corrections`, staff.token, { method: 'POST', body: {
      home_score: originalHome,
      away_score: originalAway,
      reason: 'Automated workflow verification - no score change requested.',
      supporting_notes: 'This request is rejected immediately after verifying the audit workflow.',
    }});
    const correctionId = Number(correction.payload?.data?.id);
    if (!correction.response.ok || !correctionId) throw new Error('Staff score-correction request failed.');
    const review = await api(`/score-corrections/${correctionId}/review`, admin.token, { method: 'PUT', body: { status: 'rejected' } });
    if (!review.response.ok) throw new Error('Admin correction review failed.');
    result.score_correction_request_and_review = true;
  } else {
    result.score_correction_request_and_review = 'skipped_no_assigned_final';
  }

  const today = new Date();
  const start = new Date(today); start.setDate(start.getDate() + 60);
  const end = new Date(start); end.setDate(end.getDate() + 1);
  const date = value => value.toISOString().slice(0, 10);
  const venueRows = (await api('/venues')).payload?.data?.venues || [];
  const mainCourt = venueRows.flatMap(venue => venue.courts || []).find(court => Number(court.is_available) !== 0);
  if (!mainCourt) throw new Error('No available Main Court exists for the archive workflow test.');
  const created = await api('/tournaments', admin.token, { method: 'POST', body: {
    name: `Archive Workflow Test ${Date.now()}`,
    description: 'Temporary automated archive verification.',
    format: 'single_elimination',
    start_date: date(start), end_date: date(end), registration_fee: 0,
    rules: 'Test-only tournament. No teams or official records.', court_ids: [Number(mainCourt.id)],
  }});
  const temporaryTournamentId = Number(created.payload?.data?.id);
  if (!created.response.ok || !temporaryTournamentId) throw new Error(`Temporary archive test tournament could not be created: ${created.response.status} ${created.payload?.message || ''}`);
  const archived = await api(`/tournaments/${temporaryTournamentId}/archive`, admin.token, { method: 'POST' });
  if (!archived.response.ok) throw new Error('Tournament archive action failed.');
  result.tournament_archive = true;

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  await context.addInitScript(session => {
    localStorage.setItem('sportsync_token', session.token);
    localStorage.setItem('sportsync_user', JSON.stringify(session.user));
  }, admin);
  const page = await context.newPage();
  const browserErrors = [];
  page.on('pageerror', error => browserErrors.push(error.message));
  await page.goto(`${webBase}/share-cards`);
  await page.getByRole('heading', { name: /Give the game/i }).waitFor({ timeout: 15000 });
  await page.getByLabel('Select share card style').selectOption('player_of_game');
  await page.getByLabel('Select tournament for share card').selectOption(String(completed.tournament.id));
  await page.waitForTimeout(500);
  const completedGamePicker = page.getByLabel('Select completed game for share card');
  if (await completedGamePicker.count()) await completedGamePicker.selectOption(String(completed.match.id));
  await page.waitForTimeout(800);
  const downloadButton = page.getByRole('button', { name: /Download PNG/i });
  if (!(await downloadButton.isEnabled())) throw new Error('Player-of-the-Game card is not ready despite finalized player statistics.');
  const [download] = await Promise.all([page.waitForEvent('download'), downloadButton.click()]);
  if (!download.suggestedFilename().endsWith('.png')) throw new Error('Player-of-the-Game download did not produce a PNG.');
  const canvasReady = await page.locator('canvas').evaluate(canvas => canvas.width === 1080 && canvas.height === 1080);
  if (!canvasReady || browserErrors.length) throw new Error(`Player-of-the-Game canvas failed: ${browserErrors.join(' | ')}`);
  result.player_of_game_card = true;
  await browser.close();

  console.log(JSON.stringify(result, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
