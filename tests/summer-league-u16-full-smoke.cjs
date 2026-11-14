const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const fixture = JSON.parse(execFileSync('php', [path.join(root, 'backend/cli/seed_summer_league_u16.php')], { cwd: root, encoding: 'utf8' }));

async function raw(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(apiBase + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  return { response, payload };
}

async function api(route, options = {}) {
  const result = await raw(route, options);
  if (!result.response.ok) throw new Error(`${options.method || 'GET'} ${route}: ${result.response.status} ${result.payload.message || ''}`);
  return result.payload.data;
}

async function login(email, portal = 'user') {
  const data = await api('/auth/login', { method: 'POST', body: { email, password: fixture.password, portal } });
  return data;
}

(async () => {
  const [admin, staff, coach] = await Promise.all([
    login('platform.admin@fullcourt.local', 'admin'),
    login(fixture.staff_admin.email),
    login(fixture.coach_accounts[0].email),
  ]);
  const tournamentId = Number(fixture.tournament_id);

  const adminTournaments = (await api('/tournaments', { token: admin.token })).tournaments;
  const staffTournaments = (await api('/tournaments', { token: staff.token })).tournaments;
  const coachTeams = (await api('/teams', { token: coach.token })).teams;
  const coachRoster = (await api('/eligibility', { token: coach.token })).players;
  if (!adminTournaments.some((item) => Number(item.id) === tournamentId)) throw new Error('Admin cannot see the Summer League.');
  const expectedStaffTournamentIds = adminTournaments
    .filter((item) => Number(item.assigned_staff_id) === Number(staff.user.id))
    .map((item) => Number(item.id))
    .sort((a, b) => a - b);
  const visibleStaffTournamentIds = staffTournaments.map((item) => Number(item.id)).sort((a, b) => a - b);
  if (!visibleStaffTournamentIds.includes(tournamentId)) throw new Error('Nova cannot see the assigned Summer League.');
  if (JSON.stringify(visibleStaffTournamentIds) !== JSON.stringify(expectedStaffTournamentIds)) {
    throw new Error(`Nova tournament scope mismatch. Expected assigned ${expectedStaffTournamentIds.join(',')}, received ${visibleStaffTournamentIds.join(',')}.`);
  }
  if (coachTeams.length !== 1 || coachTeams[0].team_name !== fixture.coach_accounts[0].team) throw new Error('Coach does not see exactly one assigned team.');
  if (coachRoster.length !== 15 || coachRoster.some((row) => Number(row.team_id) !== Number(coachTeams[0].id))) throw new Error('Coach roster scope is not exactly 15 own-team players.');
  const forbidden = await raw('/tournaments', { method: 'POST', token: staff.token, body: { name: 'Staff must not create this', start_date: '2026-11-01', end_date: '2026-11-02' } });
  if (forbidden.response.status !== 403) throw new Error(`Staff tournament creation expected 403, got ${forbidden.response.status}.`);

  const publicTournament = await api(`/public/tournaments/${tournamentId}`);
  if (publicTournament.teams.length !== 10) throw new Error('Public page does not show all 10 Summer League teams.');
  if (publicTournament.teams.some((team) => Number(team.max_roster_size) !== 15 || team.roster.length !== 15)) throw new Error('Public team roster is not 15/15.');
  const publicGames = publicTournament.schedule.filter((game) => game.team1_id && game.team2_id);
  if (publicGames.length < 2) throw new Error('Opening games were not published.');

  const access = fixture.scoring_link;
  const activation = await api(`/public/scoring-links/${access.url.split('/').pop()}/activate`, {
    method: 'POST', body: { operator_name: 'Nova Serato E2E', pin: access.pin, device_id: 'summer-u16-e2e-device' },
  });
  const guestToken = activation.session_token;
  let consoleData = await api('/scoring-session/console', { token: guestToken });
  const homePlayer = consoleData.players.find((row) => Number(row.team_id) === Number(consoleData.game.team1_id) && Number(row.is_present) === 1);
  const awayPlayer = consoleData.players.find((row) => Number(row.team_id) === Number(consoleData.game.team2_id) && Number(row.is_present) === 1);
  if (!homePlayer || !awayPlayer) throw new Error('Both confirmed lineups did not reach the scoring console.');

  const events = [
    [homePlayer, '2pt_made'], [awayPlayer, '3pt_made'], [homePlayer, 'ft_made'],
    [homePlayer, '2pt_missed'], [awayPlayer, '3pt_missed'], [homePlayer, 'ft_missed'],
    [homePlayer, 'off_rebound'], [awayPlayer, 'def_rebound'], [homePlayer, 'assist'],
    [awayPlayer, 'steal'], [homePlayer, 'block'], [awayPlayer, 'turnover'], [homePlayer, 'personal_foul'],
  ];
  for (const [player, eventType] of events) {
    await api('/scoring-session/stats', {
      method: 'POST', token: guestToken,
      body: { event_uuid: crypto.randomUUID(), team_id: Number(player.team_id), team_player_id: Number(player.team_player_id), event_type: eventType, current_period: 'Q1', game_clock_seconds: 540 },
    });
  }
  consoleData = await api('/scoring-session/console', { token: guestToken });
  const homeBox = consoleData.box_score.find((row) => Number(row.team_player_id) === Number(homePlayer.team_player_id));
  const awayBox = consoleData.box_score.find((row) => Number(row.team_player_id) === Number(awayPlayer.team_player_id));
  if (Number(homeBox.points) !== 3 || Number(awayBox.points) !== 3) throw new Error('Player points and team scores did not synchronize.');
  for (const [row, fields] of [[homeBox, ['rebounds', 'assists', 'blocks', 'fouls']], [awayBox, ['rebounds', 'steals', 'turnovers']]]) {
    for (const field of fields) if (Number(row[field]) < 1) throw new Error(`${field} was not recorded in the box score.`);
  }
  const awards = (await api(`/tournaments/${tournamentId}/awards/recommend`, { method: 'POST', token: admin.token, body: {} })).awards;
  if (!Array.isArray(awards)) throw new Error('Awards recommendation failed for roster-only players.');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(({ token, refreshToken, user }) => {
    localStorage.setItem('sportsync_token', token);
    localStorage.setItem('sportsync_refresh_token', refreshToken || '');
    localStorage.setItem('sportsync_user', JSON.stringify(user));
    localStorage.setItem('fc_scoring_device_id', 'summer-u16-e2e-device');
  }, { token: coach.token, refreshToken: coach.refresh_token, user: coach.user });
  for (const route of ['/coach', '/teams', '/eligibility', '/schedules', '/reports', '/qr-attendance']) {
    await page.goto(webBase + route, { waitUntil: 'networkidle', timeout: 45000 });
    if (await page.getByText(/couldn.t finish loading|cannot read properties/i).count()) {
      const diagnostic = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 900);
      throw new Error(`Coach page failed: ${route} :: ${diagnostic}`);
    }
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3)) throw new Error(`Coach mobile overflow: ${route}`);
  }
  await page.goto(`${webBase}/score/${access.url.split('/').pop()}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Your name').fill('Nova Serato Browser Test');
  await page.getByLabel('6-digit access PIN').fill(access.pin);
  await page.getByRole('button', { name: /Enter courtside console/i }).click();
  await page.getByText(/Quarter & game clock/i).waitFor({ timeout: 30000 });
  for (const controlName of ['2PT Made', '2PT Miss', '3PT Made', '3PT Miss', 'Free Throw', 'Free Throw Miss', 'Off. Rebound', 'Def. Rebound', 'Assist', 'Steal', 'Block', 'Turnover', 'Personal Foul']) {
    if (!(await page.getByRole('button', { name: controlName, exact: true }).isVisible())) throw new Error(`Scoring control missing: ${controlName}`);
  }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3)) throw new Error('Scoring console has mobile horizontal overflow.');
  await browser.close();
  if (errors.length) throw new Error(`Browser errors: ${errors.join('; ')}`);

  console.log(JSON.stringify({
    tournament_id: tournamentId,
    tournament: fixture.tournament,
    teams: publicTournament.teams.length,
    roster_per_team: 15,
    coach_accounts: fixture.coach_accounts.length,
    nova_assignment_isolated: true,
    nova_assigned_tournaments: visibleStaffTournamentIds.length,
    staff_create_tournament_forbidden: true,
    coach_team_and_roster_isolated: true,
    public_schedule_and_rosters_connected: true,
    complete_13_action_scoring_recorded: true,
    awards_support_roster_players: true,
    coach_mobile_pages_passed: true,
    scoring_link: access,
  }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
