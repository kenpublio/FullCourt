const { execFileSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '..');
const base = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const byRole = Object.fromEntries(sessions.map((entry) => [entry.user.role, entry]));
const admin = byRole.platform_admin;
const coach = byRole.coach;
const staff = byRole.statistician;
const eligibilityUploadDir = path.join(root, 'backend', 'uploads', 'eligibility');
const uploadBaseline = new Set(fs.existsSync(eligibilityUploadDir) ? fs.readdirSync(eligibilityUploadDir) : []);
if (!admin || !coach || !staff) throw new Error('Admin, Coach, and Staff Admin demo sessions are required.');

async function api(session, method, route, body) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let payload; try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || text} ${payload.data ? JSON.stringify(payload.data) : ''}`);
  return payload;
}

async function uploadEligibility(playerId, type, birthDate = '') {
  const form = new FormData();
  form.append('document_type', type);
  if (birthDate) form.append('declared_birth_date', birthDate);
  form.append('document', new Blob(['%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n%%EOF'], { type: 'application/pdf' }), `${type.replaceAll(' ', '-').toLowerCase()}.pdf`);
  const response = await fetch(`${base}/eligibility/${playerId}/documents`, { method: 'POST', headers: { Authorization: `Bearer ${coach.token}` }, body: form });
  const payload = await response.json();
  if (!response.ok) throw new Error(`Eligibility upload failed: ${response.status} ${payload.message || ''}`);
  await api(admin, 'PUT', `/eligibility/documents/${payload.data.id}/review`, { status: 'verified', notes: 'Verified during automated launch rehearsal.' });
}

(async () => {
  const stamp = Date.now();
  const createdTournamentIds = [];
  try {
    const venuePayload = await api(admin, 'GET', '/venues');
    const venue = (venuePayload.data?.venues || []).find((row) => (row.courts || []).some((court) => Number(court.is_available)));
    const court = venue?.courts?.find((row) => Number(row.is_available));
    if (!court) throw new Error('At least one available Main Court is required for the rehearsal.');

    const createTournament = async (mode, suffix) => {
      const created = await api(admin, 'POST', '/tournaments', {
        name: `FullCourt ${suffix} ${stamp}`, operation_mode: mode, format: 'single_elimination',
        description: 'Automated three-role launch rehearsal. Safe to delete.', start_date: '2026-11-08', end_date: '2026-11-08',
        registration_deadline: '2026-11-07', registration_fee: 0, court_ids: [Number(court.id)],
        schedule_start_time: '08:00', schedule_end_time: '20:00', available_days: ['sun'],
      });
      createdTournamentIds.push(Number(created.data.id));
      return Number(created.data.id);
    };

    const officialId = await createTournament('official', 'Official Rehearsal');
    const practiceId = await createTournament('practice', 'Practice Rehearsal');
    let blockedPracticePublish = false;
    try { await api(admin, 'POST', `/tournaments/${practiceId}/publish`, {}); }
    catch (error) { blockedPracticePublish = /Practice tournaments stay private/i.test(error.message); }

    await api(admin, 'PUT', `/tournaments/${officialId}/staff`, { staff_user_id: Number(staff.user.id) });
    const division = await api(admin, 'POST', `/tournaments/${officialId}/divisions`, {
      name: 'Open Division', age_group: 'Open', gender_category: 'open', format: 'single_elimination', max_roster_size: 18,
      eligibility_requirements: 'Birth record and parent permit reviewed by Admin.',
    });

    const teamIds = [];
    for (const [index, name] of ['Red Falcons', 'Blue Waves', 'Gold Lions', 'Black Knights'].entries()) {
      const team = await api(admin, 'POST', '/teams', {
        tournament_id: officialId, division_id: Number(division.data.id), team_name: `${name} ${stamp}`,
        short_name: `${name.split(' ')[0].slice(0, 3).toUpperCase()}${index}`, primary_color: ['#cd2d17', '#2563eb', '#d4a72c', '#18181b'][index],
        secondary_color: '#ffffff', coach_user_id: Number(coach.user.id), status: 'registered',
      });
      teamIds.push(Number(team.data.team_id));
    }

    const playerIds = [];
    for (const [teamIndex, teamId] of teamIds.entries()) {
      const player = await api(coach, 'POST', '/eligibility/add-player', {
        team_id: teamId, player_name: `Rehearsal Player ${stamp}-${teamIndex + 1}`, birth_date: '2005-01-01', jersey_number: teamIndex + 1, position: 'Guard',
      });
      playerIds.push(Number(player.data.id));
      await uploadEligibility(Number(player.data.id), 'Birth Certificate / PSA', '2005-01-01');
      await uploadEligibility(Number(player.data.id), 'Parent Permit');
      await api(admin, 'PUT', `/eligibility/${player.data.id}`, { status: 'verified', remarks: 'Automated rehearsal record.' });
    }

    await api(admin, 'POST', `/tournaments/${officialId}/bracket/generate`, { format: 'single_elimination', shuffle: false });
    await api(admin, 'POST', `/tournaments/${officialId}/schedule/auto`, { start_date: '2026-11-08', start_time: '08:00:00' });
    const conflictPayload = await api(admin, 'POST', `/tournaments/${officialId}/schedule/conflicts`, {});
    const conflictCount = ['court_clashes', 'team_clashes', 'venue_violations'].reduce((count, key) => count + (conflictPayload.data?.[key]?.length || 0), 0);
    if (conflictCount === 0) await api(admin, 'POST', `/tournaments/${officialId}/schedule/publish`, {});

    const schedule = await api(admin, 'GET', `/tournaments/${officialId}/schedule`);
    const firstGame = schedule.data.schedule.find((game) => game.scheduled_start_time);
    if (!firstGame) throw new Error('Schedule optimizer did not create a playable fixture.');
    const assignment = await api(admin, 'POST', `/matches/${firstGame.id}/assignments`, { user_id: Number(staff.user.id), assignment_role: 'statistician' });
    await api(staff, 'PUT', `/game-assignments/${assignment.data.id}/respond`, { status: 'accepted' });

    const readiness = await api(admin, 'GET', `/tournaments/${officialId}/readiness`);
    if (!readiness.data.readiness.publish_ready) throw new Error(`Readiness gate unexpectedly blocked: ${JSON.stringify(readiness.data.readiness.checks)}`);
    await api(admin, 'POST', `/tournaments/${officialId}/publish`, {});

    const coachTournaments = await api(coach, 'GET', '/tournaments');
    const staffAssignments = await api(staff, 'GET', '/game-assignments');
    const publicResponse = await fetch(`${base}/public/tournaments/${officialId}`);
    const publicPayload = await publicResponse.json();
    const practicePublicResponse = await fetch(`${base}/public/tournaments/${practiceId}`);
    const result = {
      roles: ['Administrator', 'Coach', 'Staff Admin'], official_readiness: `${readiness.data.readiness.ready_count}/${readiness.data.readiness.total_count}`,
      teams: teamIds.length, verified_roster_records: playerIds.length, scheduled_games: schedule.data.schedule.filter((game) => game.scheduled_start_time).length,
      schedule_conflicts: conflictCount, coach_can_see_official: coachTournaments.data.tournaments.some((row) => Number(row.id) === officialId),
      staff_assignment_accepted: staffAssignments.data.assignments.some((row) => Number(row.match_id) === Number(firstGame.id) && row.status === 'accepted'),
      official_public: publicResponse.ok && publicPayload.status === true, practice_publish_blocked: blockedPracticePublish, practice_private: !practicePublicResponse.ok,
    };
    console.log(JSON.stringify(result, null, 2));
    const required = ['coach_can_see_official', 'staff_assignment_accepted', 'official_public', 'practice_publish_blocked', 'practice_private'];
    if (required.some((key) => !result[key])) process.exitCode = 2;
  } finally {
    for (const id of createdTournamentIds.reverse()) {
      try { await api(admin, 'DELETE', `/tournaments/${id}`); } catch (error) { console.error(`Cleanup warning for tournament ${id}: ${error.message}`); }
    }
    if (fs.existsSync(eligibilityUploadDir)) {
      for (const file of fs.readdirSync(eligibilityUploadDir)) {
        if (!uploadBaseline.has(file)) fs.rmSync(path.join(eligibilityUploadDir, file));
      }
    }
  }
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
