const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5173';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
const coach = sessions.find((entry) => entry.user.role === 'coach');
if (!admin || !coach) throw new Error('Admin or Coach demo session is unavailable.');

async function request(route, { method = 'GET', token = admin.token, body } = {}) {
  const response = await fetch(apiBase + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || text}`);
  return payload.data;
}

async function requestForm(route, token, form) {
  const response = await fetch(apiBase + route, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(`POST ${route}: ${response.status} ${payload.message || ''}`);
  return payload.data;
}

(async () => {
  const staleTournaments = (await request('/tournaments')).tournaments
    .filter((entry) => String(entry.name || '').startsWith('FullCourt Scoring Link E2E'));
  for (const tournament of staleTournaments) {
    await request(`/tournaments/${tournament.id}`, { method: 'DELETE' });
  }
  const staleVenueData = await request('/venues');
  const staleVenues = (staleVenueData.venues || [])
    .filter((entry) => String(entry.name || '').startsWith('FullCourt E2E Arena'));
  for (const venue of staleVenues) {
    await request(`/venues/${venue.id}`, { method: 'DELETE' });
  }

  const venueData = await request('/venues');
  const approvedVenues = (venueData.venues || []).filter((venue) => venue.approval_status === 'approved');
  const approvedVenueIds = new Set(approvedVenues.map((venue) => Number(venue.id)));
  const nestedCourts = approvedVenues.flatMap((venue) => venue.courts || []);
  void nestedCourts;
  void approvedVenueIds;
  const runId = Date.now();
  const venueId = Number((await request('/venues', { method: 'POST', body: { name: `FullCourt E2E Arena ${runId}`, location: 'Barangay Linao, Ormoc City' } })).id);
  const courtId = Number((await request('/courts', { method: 'POST', body: { venue_id: venueId, court_name: 'Main Court', is_available: true } })).id);
  const court = { id: courtId };

  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const toDate = (value) => value.toISOString().slice(0, 10);
  const startDate = toDate(start);
  const endDate = toDate(end);

  const tournamentName = `FullCourt Scoring Link E2E ${runId}`;
  const tournamentId = Number((await request('/tournaments', {
    method: 'POST',
    body: {
      name: tournamentName, format: 'single_elimination', start_date: startDate, end_date: endDate,
      registration_fee: 0, rules: 'FullCourt automated scoring-link test.', description: 'End-to-end verification tournament.',
      court_ids: [Number(court.id)],
    },
  })).id);
  const divisionId = Number((await request(`/tournaments/${tournamentId}/divisions`, {
    method: 'POST', body: { name: 'Open Test Division', age_group: 'Open', gender_category: 'open', format: 'single_elimination', max_roster_size: 15 },
  })).id);
  const teamA = Number((await request('/teams', { method: 'POST', body: { tournament_id: tournamentId, division_id: divisionId, team_name: 'FullCourt Red Testers', short_name: 'RED', primary_color: '#CD2D17', coach_user_id: Number(coach.user.id), status: 'registered' } })).team_id);
  const teamB = Number((await request('/teams', { method: 'POST', body: { tournament_id: tournamentId, division_id: divisionId, team_name: 'FullCourt Gold Testers', short_name: 'GLD', primary_color: '#D4A72C', coach_user_id: Number(coach.user.id), status: 'registered' } })).team_id);
  const rosterPlayerId = Number((await request('/eligibility/add-player', {
    method: 'POST', token: coach.token,
    body: { team_id: teamA, player_name: 'Game Day Simulation Guard', birth_date: '2004-05-27', guardian_name: 'Simulation Guardian', guardian_contact: '09170000000', jersey_number: 7, position: 'Point Guard' },
  })).id);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlXcAAAAASUVORK5CYII=', 'base64');
  const identityForm = new FormData();
  identityForm.append('document_type', 'Birth Certificate / PSA');
  identityForm.append('declared_birth_date', '2004-05-27');
  identityForm.append('document', new Blob([png], { type: 'image/png' }), 'test-birth-record.png');
  const documentId = Number((await requestForm(`/eligibility/${rosterPlayerId}/documents`, coach.token, identityForm)).id);
  await request(`/eligibility/documents/${documentId}/review`, { method: 'PUT', body: { status: 'verified', notes: 'Automated matching birth-record fixture.' } });
  const permitForm = new FormData();
  permitForm.append('document_type', 'Parent Permit');
  permitForm.append('document', new Blob([png], { type: 'image/png' }), 'test-parent-permit.png');
  const permitId = Number((await requestForm(`/eligibility/${rosterPlayerId}/documents`, coach.token, permitForm)).id);
  await request(`/eligibility/documents/${permitId}/review`, { method: 'PUT', body: { status: 'verified', notes: 'Automated parent-permit fixture.' } });
  await request(`/eligibility/${rosterPlayerId}`, { method: 'PUT', body: { status: 'verified', remarks: 'Verified for automated scoring test.' } });
  await request(`/tournaments/${tournamentId}/bracket/generate`, { method: 'POST', body: { format: 'single_elimination', shuffle: false } });
  await request(`/tournaments/${tournamentId}/schedule/auto`, { method: 'POST', body: { start_date: startDate, start_time: '08:00:00' } });
  const schedule = (await request(`/tournaments/${tournamentId}/schedule`)).schedule;
  const game = schedule.find((entry) => entry.team1_id && entry.team2_id);
  if (!game || ![teamA, teamB].includes(Number(game.team1_id)) || ![teamA, teamB].includes(Number(game.team2_id))) throw new Error('Fresh tournament game was not generated correctly.');

  const access = (await request(`/matches/${game.id}/scoring-link`, {
    method: 'POST',
    body: { operator_label: 'Full E2E Statistician', expires_in_hours: 4 },
  })).access;
  if (!access?.token || !/^\d{6}$/.test(access.pin)) throw new Error('Scoring link did not return a token and 6-digit PIN.');

  const activation = await request(`/public/scoring-links/${access.token}/activate`, {
    method: 'POST', token: null, body: { operator_name: 'Full E2E Statistician', pin: access.pin, device_id: 'fullcourt-e2e-device-0001' },
  });
  const guestToken = activation.session_token;
  const blockedDevice = await fetch(`${apiBase}/public/scoring-links/${access.token}/activate`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({operator_name:'Unauthorized second device',pin:access.pin,device_id:'fullcourt-e2e-device-0002'}) });
  if(blockedDevice.status!==409)throw new Error(`Second scoring device should be blocked, received ${blockedDevice.status}.`);
  let consoleData = await request('/scoring-session/console', { token: guestToken });
  const beforeHome = Number(consoleData.game.team1_score || 0);
  const beforeAway = Number(consoleData.game.team2_score || 0);
  const eligible = consoleData.players.find((player) => player.eligibility_status === 'verified' && Number(player.is_present) === 1);
  if (!eligible) throw new Error('The scheduled game has no verified, present player for the statistic test.');

  await request('/scoring-session/clock', {
    method: 'PUT', token: guestToken,
    body: { action: 'start', current_period: 'Q2', minutes: 9, seconds: 30 },
  });
  await request('/scoring-session/clock', {
    method: 'PUT', token: guestToken,
    body: { action: 'pause', current_period: 'Q2', minutes: 9, seconds: 29 },
  });
  await request('/scoring-session/stats', {
    method: 'POST', token: guestToken,
    body: {
      event_uuid: crypto.randomUUID(), team_id: Number(eligible.team_id),
      team_player_id: Number(eligible.team_player_id), event_type: '2pt_made',
      current_period: 'Q2', game_clock_seconds: 569,
    },
  });
  consoleData = await request('/scoring-session/console', { token: guestToken });
  const scoredHome = Number(consoleData.game.team1_score || 0);
  const scoredAway = Number(consoleData.game.team2_score || 0);
  if (scoredHome + scoredAway !== beforeHome + beforeAway + 2) throw new Error('Made basket did not add two points to the live score.');
  if (consoleData.game.current_period !== 'Q2' || Number(consoleData.game.timer_seconds) !== 569) throw new Error('Quarter or clock did not persist.');
  if (!consoleData.box_score.some((row) => Number(row.team_player_id) === Number(eligible.team_player_id) && Number(row.points) >= 2)) throw new Error('Player statistic did not reach the box score.');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem('fc_scoring_device_id', 'fullcourt-e2e-device-0001'));
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${webBase}/score/${access.token}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Your name').fill('Browser E2E Statistician');
  await page.getByLabel('6-digit access PIN').fill(access.pin);
  await page.getByRole('button', { name: /Enter courtside console/i }).click();
  await page.getByText(/Quarter & game clock/i).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /More stats/i }).waitFor();
  if (await page.getByRole('button', { name: /Assist/i }).count()) throw new Error('Advanced statistics should be hidden in simple scoring mode.');
  await page.getByRole('button', { name: /More stats/i }).click();
  await page.getByRole('button', { name: /Assist/i }).waitFor();
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2);
  await browser.close();
  if (pageErrors.length || mobileOverflow) throw new Error(`Scoring UI issue: ${pageErrors.join('; ') || 'mobile horizontal overflow'}`);

  let finalHome = scoredHome;
  let finalAway = scoredAway;
  if (finalHome === finalAway) {
    await request('/scoring-session/stats', {
      method: 'POST', token: guestToken,
      body: { event_uuid: crypto.randomUUID(), team_id: Number(eligible.team_id), team_player_id: Number(eligible.team_player_id), event_type: 'ft_made', current_period: 'Q4', game_clock_seconds: 0 },
    });
    consoleData = await request('/scoring-session/console', { token: guestToken });
    finalHome = Number(consoleData.game.team1_score || 0);
    finalAway = Number(consoleData.game.team2_score || 0);
  }
  const winnerTeamId = finalHome > finalAway ? Number(game.team1_id) : Number(game.team2_id);
  const submission = await request('/scoring-session/submit-final', { method: 'POST', token: guestToken, body: {} });
  if (submission.status !== 'awaiting_confirmation') throw new Error('Guest scorer could not submit the final score for organizer confirmation.');
  await request(`/matches/${game.id}/finalize`, {
    method: 'POST',
    body: {
      winner_team_id: winnerTeamId, team1_score: finalHome, team2_score: finalAway,
      expected_team1_score: finalHome, expected_team2_score: finalAway,
      current_period: 'Q4', timer_seconds: 0,
    },
  });
  const published = await fetch(`${apiBase}/public/tournaments/${tournamentId}`).then((response) => response.json());
  const publishedMatch = published.data?.schedule?.find((entry) => Number(entry.id) === Number(game.id));
  if (!publishedMatch || publishedMatch.status !== 'completed') throw new Error('Final game result was not published to the public tournament feed.');

  console.log(JSON.stringify({
    tournament: tournamentName,
    venue: `FullCourt E2E Arena ${runId}`,
    tournament_created_and_approved: true,
    match_id: Number(game.id),
    scoring_link_created: true,
    guest_pin_activation: true,
    mobile_console_loaded: true,
    clock_and_quarter_saved: true,
    player_stat_recorded: true,
    guest_final_submission: true,
    organizer_confirmation: true,
    final_score: `${finalHome}-${finalAway}`,
    public_result_published: true,
  }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
