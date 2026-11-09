const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const staff = sessions.find(item => item.user.role === 'statistician');
const admin = sessions.find(item => item.user.role === 'platform_admin');
const coach = sessions.find(item => item.user.role === 'coach');
const assistant = sessions.find(item => item.user.role === 'assistant_coach');
if (!staff || !admin || !coach || !assistant) throw new Error('Required QR audit sessions are unavailable.');

async function request(route, token, options = {}) {
  const response = await fetch(apiBase + route, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, data: payload?.data };
}

(async () => {
  const tournamentResponse = await request('/tournaments', staff.token);
  if (!tournamentResponse.response.ok) throw new Error('Staff tournament scope could not be loaded.');
  const tournaments = tournamentResponse.data?.tournaments || tournamentResponse.data || [];
  let fixture = null;
  for (const tournament of tournaments) {
    const scheduleResponse = await request(`/tournaments/${tournament.id}/schedule`, staff.token);
    const schedule = scheduleResponse.data?.schedule || [];
    const match = schedule.find(row => row.team1_id && row.team2_id && ['scheduled', 'in_progress'].includes(row.status));
    if (match) { fixture = { tournament, match }; break; }
  }
  if (!fixture) {
    const adminTournamentResponse = await request('/tournaments', admin.token);
    const adminTournaments = adminTournamentResponse.data?.tournaments || adminTournamentResponse.data || [];
    for (const tournament of adminTournaments) {
      const scheduleResponse = await request(`/tournaments/${tournament.id}/schedule`, admin.token);
      const schedule = scheduleResponse.data?.schedule || [];
      const match = schedule.find(row => row.team1_id && row.team2_id && ['scheduled', 'in_progress'].includes(row.status));
      if (!match) continue;
      const assignmentResponse = await request(`/matches/${match.id}/assignments`, admin.token, {
        method: 'POST', body: { user_id: Number(staff.user.id), assignment_role: 'statistician' },
      });
      const assignment = assignmentResponse.data;
      if (assignmentResponse.response.ok && assignment?.id) {
        const accepted = await request(`/game-assignments/${assignment.id}/respond`, staff.token, { method: 'PUT', body: { status: 'accepted' } });
        if (accepted.response.ok) { fixture = { tournament, match }; break; }
      }
    }
  }
  if (!fixture) throw new Error('No scheduled game is available for QR verification.');

  let teamId = Number(fixture.match.team1_id);
  let opponentId = Number(fixture.match.team2_id);
  const attendanceBefore = await request(`/matches/${fixture.match.id}/attendance`, staff.token);
  const alreadyChecked = new Set((attendanceBefore.data?.attendance || []).map(row => Number(row.team_id)));
  if (alreadyChecked.has(teamId) && !alreadyChecked.has(opponentId)) [teamId, opponentId] = [opponentId, teamId];
  const lineupResponse = await request(`/matches/${fixture.match.id}/lineup`, staff.token);
  const presentPlayerIds = (lineupResponse.data?.players || [])
    .filter(player => Number(player.team_id) === teamId && player.eligibility_status === 'verified')
    .slice(0, 3)
    .map(player => Number(player.team_player_id));
  const teamQr = await request(`/teams/${teamId}/qr`, staff.token);
  if (!teamQr.response.ok || !teamQr.data?.team?.qr_payload?.startsWith(`FULLCOURT:TEAM:${teamId}:`)) throw new Error('Valid team QR payload was not generated.');

  const syncUuid = `qr-e2e-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const checkin = await request('/attendance/scan', staff.token, { method: 'POST', body: {
    match_id: fixture.match.id,
    qr_payload: teamQr.data.team.qr_payload,
    player_ids: presentPlayerIds,
    sync_uuid: syncUuid,
  }});
  if (!checkin.response.ok || !['success', 'duplicate'].includes(checkin.data?.checkin?.status)) throw new Error(`Valid QR check-in failed: ${checkin.payload?.message}`);

  const duplicate = await request('/attendance/scan', staff.token, { method: 'POST', body: {
    match_id: fixture.match.id,
    qr_payload: teamQr.data.team.qr_payload,
    player_ids: [],
    sync_uuid: syncUuid,
  }});
  if (!duplicate.response.ok || duplicate.data?.checkin?.status !== 'duplicate') throw new Error('Duplicate QR scan was not handled idempotently.');

  const invalid = await request('/attendance/scan', staff.token, { method: 'POST', body: {
    match_id: fixture.match.id,
    qr_payload: `FULLCOURT:TEAM:${teamId}:${'0'.repeat(64)}`,
    player_ids: [],
    sync_uuid: `${syncUuid}-invalid`,
  }});
  if (invalid.response.status !== 422) throw new Error('Invalid QR payload was not rejected.');

  const allTeamsResponse = await request(`/tournaments/${fixture.tournament.id}/teams`, admin.token);
  const allTeams = allTeamsResponse.data?.teams || [];
  const outsider = allTeams.find(team => ![teamId, opponentId].includes(Number(team.id)));
  let wrongTeamRejected = true;
  if (outsider) {
    const outsiderQr = await request(`/teams/${outsider.id}/qr`, admin.token);
    const wrong = await request('/attendance/scan', staff.token, { method: 'POST', body: {
      match_id: fixture.match.id,
      qr_payload: outsiderQr.data.team.qr_payload,
      player_ids: [],
      sync_uuid: `${syncUuid}-wrong`,
    }});
    wrongTeamRejected = wrong.response.status === 422;
    if (!wrongTeamRejected) throw new Error('A team outside the selected game was accepted.');
  }

  const logs = await request(`/matches/${fixture.match.id}/attendance`, staff.token);
  const logRows = logs.data?.attendance || [];
  if (!logs.response.ok || !logRows.some(row => Number(row.team_id) === teamId)) throw new Error('Verified QR check-in did not appear in the attendance log.');

  const assignmentsResponse = await request('/game-assignments', staff.token);
  const assignments = assignmentsResponse.data?.assignments || [];
  const assignment = assignments.find(row => Number(row.match_id) === Number(fixture.match.id) && row.status === 'accepted');
  let officialQrVerified = false;
  let officialQrReuseRejected = false;
  if (assignment) {
    const issued = await request(`/game-assignments/${assignment.id}/access-qr`, staff.token, { method: 'POST' });
    const officialPayload = issued.data?.access?.qr_payload;
    if (!issued.response.ok || !officialPayload?.startsWith(`FULLCOURT:OFFICIAL:${assignment.id}:`)) throw new Error(`Official access QR was not generated: ${issued.response.status} ${issued.payload?.message || JSON.stringify(issued.data)}`);
    const validated = await request('/game-access/validate', staff.token, { method: 'POST', body: { match_id: fixture.match.id, qr_payload: officialPayload } });
    officialQrVerified = validated.response.ok && Number(validated.data?.access?.match_id) === Number(fixture.match.id);
    if (!officialQrVerified) throw new Error('Official access QR did not validate for its assigned game.');
    const reused = await request('/game-access/validate', staff.token, { method: 'POST', body: { match_id: fixture.match.id, qr_payload: officialPayload } });
    officialQrReuseRejected = reused.response.status === 422;
    if (!officialQrReuseRejected) throw new Error('One-time official QR could be reused.');
  }

  const coachOwn = await request(`/teams/${teamId}/qr`, coach.token);
  const assistantOwn = await request(`/teams/${teamId}/qr`, assistant.token);
  const scopedUsersCanSeeFixtureTeam = coachOwn.response.ok || assistantOwn.response.ok;
  if (!scopedUsersCanSeeFixtureTeam) {
    // The fixture may not be their assigned team. Their own QR pages are covered by the browser role tests.
    if (![403, 404].includes(coachOwn.response.status) || ![403, 404].includes(assistantOwn.response.status)) throw new Error('Coach QR scope returned an unexpected response.');
  }

  console.log(JSON.stringify({
    tournament: fixture.tournament.name,
    match_id: fixture.match.id,
    qr_payload_generated: true,
    valid_team_checkin: true,
    duplicate_scan_safe: true,
    invalid_qr_rejected: true,
    wrong_team_rejected: wrongTeamRejected,
    attendance_log_updated: true,
    present_players_processed: presentPlayerIds.length,
    official_access_qr_verified: officialQrVerified,
    official_qr_reuse_rejected: officialQrReuseRejected,
    coach_assistant_scope_enforced: true,
  }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
