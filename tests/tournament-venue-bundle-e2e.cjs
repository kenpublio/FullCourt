const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
if (!admin) throw new Error('Administrator demo session is unavailable.');

async function request(route, { method = 'GET', token = admin.token, body } = {}) {
  const response = await fetch(apiBase + route, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || ''}`);
  return payload.data;
}

(async () => {
  const stamp = Date.now();
  const venueName = `FullCourt Bundled Venue ${stamp}`;
  const tournamentName = `FullCourt Bundled Tournament ${stamp}`;
  let venueId;
  let tournamentId;
  try {
    venueId = Number((await request('/venues', { method: 'POST', body: { name: venueName, location: 'Ormoc City, Leyte' } })).id);
    const courtId = Number((await request('/courts', { method: 'POST', body: { venue_id: venueId, court_name: 'Main Court', is_available: true } })).id);
    tournamentId = Number((await request('/tournaments', { method: 'POST', body: {
      name: tournamentName, format: 'single_elimination', start_date: '2026-10-10', end_date: '2026-10-12',
      registration_fee: 0, court_ids: [courtId], schedule_start_time: '09:00', schedule_end_time: '18:00',
      default_match_duration_minutes: 75, default_break_minutes: 15, min_rest_minutes_between_games: 120,
      max_games_per_team_per_day: 2,
    } })).id);
    const venue = (await request(`/venues/${venueId}`)).venue;
    if (!venue?.id) throw new Error('Admin-managed venue was not saved with its tournament.');
    const php = `require 'backend/config/database.php'; $db=(new Database())->getConnection(); $q=$db->prepare('SELECT daily_start_time,daily_end_time,default_match_duration_minutes FROM schedule_constraints WHERE tournament_id=:id'); $q->execute([':id'=>${tournamentId}]); echo json_encode($q->fetch());`;
    const timing = JSON.parse(execFileSync('php', ['-r', php], { cwd: root, encoding: 'utf8' }));
    if (!String(timing.daily_start_time).startsWith('09:00') || !String(timing.daily_end_time).startsWith('18:00') || Number(timing.default_match_duration_minutes) !== 75) {
      throw new Error(`Tournament timing was not saved correctly: ${JSON.stringify(timing)}`);
    }
    console.log(JSON.stringify({ bundled_submission: true, admin_managed_venue: true, saved_playing_window: '09:00–18:00', game_minutes: 75 }, null, 2));
  } finally {
    if (tournamentId) await request(`/tournaments/${tournamentId}`, { method: 'DELETE' }).catch(() => {});
    if (venueId) await request(`/venues/${venueId}`, { method: 'DELETE' }).catch(() => {});
  }
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
