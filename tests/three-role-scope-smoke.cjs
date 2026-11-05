const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const base = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const account = role => sessions.find(item => item.user.role === role);

async function api(session, method, route, body, expected = 200) {
  const response = await fetch(base + route, { method, headers: { Authorization: `Bearer ${session.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (response.status !== expected) throw new Error(`${session.user.role} ${method} ${route}: expected ${expected}, received ${response.status} (${payload.message || 'no message'})`);
  return payload.data;
}

(async () => {
  const admin = account('platform_admin'), coach = account('coach'), staff = account('statistician');
  if (!admin || !coach || !staff) throw new Error('A required rehearsal account is missing.');
  const adminTournaments = (await api(admin, 'GET', '/tournaments')).tournaments;
  const staffTournaments = (await api(staff, 'GET', '/tournaments')).tournaments;
  const coachTeams = (await api(coach, 'GET', '/teams')).teams;
  const coachEligibility = (await api(coach, 'GET', '/eligibility')).players;
  await api(staff, 'POST', '/tournaments', { name: 'Forbidden staff tournament', start_date: '2026-11-01', end_date: '2026-11-02' }, 403);
  if (!coachTeams.length) throw new Error('Coach assigned team did not load.');
  if (coachTeams.some(team => Number(team.coach_user_id) !== Number(coach.user.id))) throw new Error('Coach can see a team assigned to another coach.');
  const ownTeamIds = new Set(coachTeams.map(team => Number(team.id)));
  if (coachEligibility.some(player => !ownTeamIds.has(Number(player.team_id)))) throw new Error('Coach eligibility list exposes another team roster.');
  if (staffTournaments.length > adminTournaments.length) throw new Error('Staff tournament scope is broader than Admin scope.');
  console.log(JSON.stringify({ staff_create_tournament_forbidden: true, staff_assigned_tournament_scope: staffTournaments.length, coach_team_scope: coachTeams.map(team => team.team_name), coach_roster_records: coachEligibility.length }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
