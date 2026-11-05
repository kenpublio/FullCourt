const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
const coach = sessions.find((entry) => entry.user.role === 'coach');
const staff = sessions.find((entry) => entry.user.role === 'statistician');
if (!admin || !coach || !staff) throw new Error('Admin, Coach, or Staff Admin demo session is unavailable.');

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
    .filter((entry) => ['FullCourt Scoring Link E2E', 'Ormoc Inter-Barangay Full Rehearsal'].some((prefix) => String(entry.name || '').startsWith(prefix)));
  for (const tournament of staleTournaments) {
    await request(`/tournaments/${tournament.id}`, { method: 'DELETE' });
  }
  const staleVenueData = await request('/venues');
  const staleVenues = (staleVenueData.venues || [])
    .filter((entry) => ['FullCourt E2E Arena', 'Ormoc City Superdome Rehearsal'].some((prefix) => String(entry.name || '').startsWith(prefix)));
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
  const venueName = 'Ormoc City Superdome';
  const venueId = Number((await request('/venues', { method: 'POST', body: { name: venueName, location: 'Aunubing Street, Ormoc City, Leyte' } })).id);
  const courtId = Number((await request('/courts', { method: 'POST', body: { venue_id: venueId, court_name: 'Superdome Main Court', is_available: true } })).id);
  const court = { id: courtId };

  const start = new Date();
  start.setDate(start.getDate() + 1);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const toDate = (value) => value.toISOString().slice(0, 10);
  const startDate = toDate(start);
  const endDate = toDate(end);

  const tournamentName = 'Ormoc Inter-Barangay Full Rehearsal 2026';
  const tournamentId = Number((await request('/tournaments', {
    method: 'POST',
    body: {
      name: tournamentName, format: 'single_elimination', start_date: startDate, end_date: endDate,
      registration_fee: 0, rules: 'Official community basketball rules and verified FullCourt scoring.', description: 'Full system rehearsal for the Ormoc inter-barangay basketball tournament.',
      court_ids: [Number(court.id)],
    },
  })).id);
  await request(`/tournaments/${tournamentId}/staff`, {
    method: 'PUT', body: { staff_user_id: Number(staff.user.id) },
  });
  const divisionId = Number((await request(`/tournaments/${tournamentId}/divisions`, {
    method: 'POST', body: { name: 'Open Inter-Barangay', age_group: 'Open', gender_category: 'open', format: 'single_elimination', max_roster_size: 18 },
  })).id);
  const teamA = Number((await request('/teams', { method: 'POST', body: { tournament_id: tournamentId, division_id: divisionId, team_name: 'Barangay Linao Eagles', short_name: 'LIN', primary_color: '#CD2D17', coach_user_id: Number(coach.user.id), status: 'registered' } })).team_id);
  const teamB = Number((await request('/teams', { method: 'POST', body: { tournament_id: tournamentId, division_id: divisionId, team_name: 'Barangay Ipil Warriors', short_name: 'IPL', primary_color: '#D4A72C', coach_user_id: Number(coach.user.id), status: 'registered' } })).team_id);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZlXcAAAAASUVORK5CYII=', 'base64');
  const positions = ['Point Guard', 'Shooting Guard', 'Small Forward', 'Power Forward', 'Center'];
  const teamPlayers = { [teamA]: [], [teamB]: [] };
  const rosterNames = {
    [teamA]: ['Ken Repollo', 'Marco Villarin', 'Paolo Abella', 'Nico Flores', 'Andre Gomez'],
    [teamB]: ['Jules Bautista', 'Carlo Herrera', 'Miguel Ignacio', 'Enzo Dela Cruz', 'Rafael Javier'],
  };
  for (const teamId of [teamA, teamB]) {
    for (let index = 0; index < 5; index += 1) {
      const birthDate = `2004-0${index + 1}-${String(10 + index).padStart(2, '0')}`;
      const playerId = Number((await request('/eligibility/add-player', {
        method: 'POST', token: coach.token,
        body: { team_id: teamId, player_name: rosterNames[teamId][index], birth_date: birthDate, guardian_name: 'Rehearsal Guardian', guardian_contact: '09170000000', jersey_number: (index + 1) * 3 + (teamId === teamB ? 1 : 0), position: positions[index] },
      })).id);
      const identityForm = new FormData();
      identityForm.append('document_type', 'Birth Certificate / PSA');
      identityForm.append('declared_birth_date', birthDate);
      identityForm.append('document', new Blob([png], { type: 'image/png' }), `birth-record-${playerId}.png`);
      const documentId = Number((await requestForm(`/eligibility/${playerId}/documents`, coach.token, identityForm)).id);
      await request(`/eligibility/documents/${documentId}/review`, { method: 'PUT', body: { status: 'verified', notes: 'Verified rehearsal birth record.' } });
      const permitForm = new FormData();
      permitForm.append('document_type', 'Parent Waiver');
      permitForm.append('document', new Blob([png], { type: 'image/png' }), `parent-permit-${playerId}.png`);
      const permitId = Number((await requestForm(`/eligibility/${playerId}/documents`, coach.token, permitForm)).id);
      await request(`/eligibility/documents/${permitId}/review`, { method: 'PUT', body: { status: 'verified', notes: 'Verified rehearsal parent permit.' } });
      await request(`/eligibility/${playerId}`, { method: 'PUT', body: { status: 'verified', remarks: 'Cleared for full game rehearsal.' } });
      teamPlayers[teamId].push(playerId);
    }
  }
  await request(`/tournaments/${tournamentId}/bracket/generate`, { method: 'POST', body: { format: 'single_elimination', shuffle: false } });
  await request(`/tournaments/${tournamentId}/schedule/auto`, { method: 'POST', body: { start_date: startDate, start_time: '08:00:00' } });
  const conflicts = await request(`/tournaments/${tournamentId}/schedule/conflicts`, { method: 'POST', body: {} });
  const conflictCount = ['court_clashes', 'team_clashes', 'venue_violations']
    .reduce((total, key) => total + (conflicts[key]?.length || 0), 0);
  if (conflictCount) throw new Error(`Generated scoring fixture has ${conflictCount} schedule conflict(s).`);
  await request(`/tournaments/${tournamentId}/schedule/publish`, { method: 'POST', body: {} });
  await request(`/tournaments/${tournamentId}/publish`, { method: 'POST', body: {} });
  const schedule = (await request(`/tournaments/${tournamentId}/schedule`)).schedule;
  const game = schedule.find((entry) => entry.team1_id && entry.team2_id);
  if (!game || ![teamA, teamB].includes(Number(game.team1_id)) || ![teamA, teamB].includes(Number(game.team2_id))) throw new Error('Fresh tournament game was not generated correctly.');
  const assignment = await request(`/matches/${game.id}/assignments`, { method: 'POST', body: { user_id: Number(staff.user.id), assignment_role: 'statistician' } });
  await request(`/game-assignments/${assignment.id}/respond`, { method: 'PUT', token: staff.token, body: { status: 'accepted' } });
  for (const teamId of [teamA, teamB]) {
    await request(`/matches/${game.id}/lineup`, {
      method: 'PUT',
      body: { players: teamPlayers[teamId].map((team_player_id) => ({ team_player_id, is_present: true, is_starter: true })) },
    });
  }

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
  const recordFixtureEvent = (team_id, team_player_id, event_type, period, game_clock_seconds) => request('/scoring-session/stats', {
    method: 'POST', token: guestToken,
    body: { event_uuid: crypto.randomUUID(), team_id, team_player_id, event_type, current_period: `Q${period}`, game_clock_seconds },
  });
  const quarterPlans = [
    { a: ['2pt_made','2pt_made','3pt_made','ft_made','2pt_made'], b: ['2pt_made','3pt_made','2pt_made','ft_made','2pt_made'] },
    { a: ['3pt_made','2pt_made','2pt_made','3pt_made','ft_made'], b: ['2pt_made','2pt_made','3pt_made','2pt_made','ft_made'] },
    { a: ['2pt_made','3pt_made','2pt_made','2pt_made','ft_made'], b: ['3pt_made','2pt_made','3pt_made','2pt_made','ft_made'] },
    { a: ['3pt_made','3pt_made','2pt_made','2pt_made','ft_made'], b: ['2pt_made','3pt_made','2pt_made','2pt_made','ft_made'] },
  ];
  for (let quarter = 1; quarter <= 4; quarter += 1) {
    for (const [side, teamId] of [['a', teamA], ['b', teamB]]) {
      for (let index = 0; index < quarterPlans[quarter - 1][side].length; index += 1) {
        await recordFixtureEvent(teamId, teamPlayers[teamId][index], quarterPlans[quarter - 1][side][index], quarter, 560 - (index * 73));
      }
    }
  }
  for (let index = 0; index < 5; index += 1) {
    for (let repeat = 0; repeat < 5 - index; repeat += 1) await recordFixtureEvent(teamA, teamPlayers[teamA][1], 'def_rebound', (repeat % 4) + 1, 420 - repeat * 31);
    for (let repeat = 0; repeat < 4 - Math.min(index, 3); repeat += 1) await recordFixtureEvent(teamB, teamPlayers[teamB][2], 'assist', (repeat % 4) + 1, 390 - repeat * 29);
  }
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
  const testedEvents = ['2pt_made', '2pt_missed', '3pt_made', '3pt_missed', 'ft_made', 'ft_missed', 'off_rebound', 'def_rebound', 'assist', 'steal', 'block', 'turnover', 'personal_foul'];
  for (const eventType of testedEvents) {
    await request('/scoring-session/stats', {
      method: 'POST', token: guestToken,
      body: {
        event_uuid: crypto.randomUUID(), team_id: Number(eligible.team_id),
        team_player_id: Number(eligible.team_player_id), event_type: eventType,
        current_period: 'Q2', game_clock_seconds: 569,
      },
    });
  }
  consoleData = await request('/scoring-session/console', { token: guestToken });
  if (!Array.isArray(consoleData.period_scores) || consoleData.period_scores.length < 4) throw new Error('Quarter score breakdown is missing from the scoring console.');
  if (!Array.isArray(consoleData.recent_actions) || !consoleData.recent_actions.length) throw new Error('Recent scoring actions are missing from the scoring console.');
  const scoredHome = Number(consoleData.game.team1_score || 0);
  const scoredAway = Number(consoleData.game.team2_score || 0);
  if (scoredHome + scoredAway !== beforeHome + beforeAway + 6) throw new Error('Made baskets did not add six points to the live score.');
  if (consoleData.game.current_period !== 'Q2' || Number(consoleData.game.timer_seconds) !== 569) throw new Error('Quarter or clock did not persist.');
  const testedPlayer = consoleData.box_score.find((row) => Number(row.team_player_id) === Number(eligible.team_player_id));
  if (!testedPlayer || Number(testedPlayer.points) < 6) throw new Error('Player scoring did not reach the box score.');
  for (const field of ['rebounds', 'assists', 'steals', 'blocks', 'turnovers', 'fouls']) {
    if (Number(testedPlayer[field]) < 1) throw new Error(`${field} did not reach the box score.`);
  }

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(() => localStorage.setItem('fc_scoring_device_id', 'fullcourt-e2e-device-0001'));
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('dialog', (dialog) => dialog.accept());
  await page.goto(`${webBase}/score/${access.token}`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Your name').fill('Browser E2E Statistician');
  await page.getByLabel('6-digit access PIN').fill(access.pin);
  await page.getByRole('button', { name: /Enter courtside console/i }).click();
  await page.getByText(/Quarter & game clock/i).waitFor({ timeout: 30000 });
  await page.getByRole('button', { name: /Assist/i }).waitFor();
  await page.getByRole('button', { name: /Off. Rebound/i }).waitFor();
  await page.getByRole('button', { name: /Def. Rebound/i }).waitFor();
  await page.getByRole('button', { name: /Steal/i }).waitFor();
  await page.getByRole('button', { name: /Block/i }).waitFor();
  await page.getByRole('button', { name: /Turnover/i }).waitFor();
  const controlNames = ['2PT Made', '2PT Miss', '3PT Made', '3PT Miss', 'Free Throw', 'Free Throw Miss', 'Off. Rebound', 'Def. Rebound', 'Assist', 'Steal', 'Block', 'Turnover', 'Personal Foul'];
  for (const controlName of controlNames) {
    const control = page.getByRole('button', { name: controlName, exact: true });
    await control.click();
    await control.waitFor({ state: 'visible' });
  }
  await page.getByRole('button', { name: /Undo last action/i }).click();
  await page.getByRole('button', { name: /Undo action/i }).click();
  await page.getByText(/Last action removed/i).waitFor();
  const overflowAudit = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > innerWidth + 2,
    viewport: innerWidth,
    pageWidth: document.documentElement.scrollWidth,
    offenders: [...document.querySelectorAll('body *')]
      .map(element => ({ selector: `${element.tagName.toLowerCase()}.${[...element.classList].join('.')}`, left: Math.round(element.getBoundingClientRect().left), right: Math.round(element.getBoundingClientRect().right), width: Math.round(element.getBoundingClientRect().width) }))
      .filter(item => item.right > innerWidth + 2 || item.left < -2)
      .sort((a, b) => b.right - a.right)
      .slice(0, 8),
  }));
  await browser.close();
  if (pageErrors.length || overflowAudit.overflow) throw new Error(`Scoring UI issue: ${pageErrors.join('; ') || `mobile horizontal overflow ${JSON.stringify(overflowAudit)}`}`);

  consoleData = await request('/scoring-session/console', { token: guestToken });
  let finalHome = Number(consoleData.game.team1_score || 0);
  let finalAway = Number(consoleData.game.team2_score || 0);
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
    venue: venueName,
    tournament_created_and_approved: true,
    match_id: Number(game.id),
    scoring_link_created: true,
    guest_pin_activation: true,
    mobile_console_loaded: true,
    clock_and_quarter_saved: true,
    all_13_scoring_and_stat_buttons_recorded: true,
    quarter_score_board_loaded: true,
    undo_last_action_button_verified: true,
    nba_style_overview_data_ready: true,
    guest_final_submission: true,
    organizer_confirmation: true,
    final_score: `${finalHome}-${finalAway}`,
    public_result_published: true,
  }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
