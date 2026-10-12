const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find(item => item.user.role === 'platform_admin');
if (!admin) throw new Error('Platform admin test account is unavailable.');

async function api(method, route, body) {
  const response = await fetch(base + route, {
    method,
    headers: { Authorization: `Bearer ${admin.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || 'Request failed'}`);
  return payload;
}

(async () => {
  const rows = (await api('GET', '/tournaments')).data.tournaments || [];
  let selected;
  let game;
  for (const tournament of rows) {
    const overview = (await api('GET', `/tournaments/${tournament.id}/game-day`)).data;
    if (overview.games?.length) { selected = tournament; game = overview.games[0]; break; }
  }
  if (!selected || !game) throw new Error('No scheduled game is available for the operations smoke test.');

  await api('PUT', `/tournaments/${selected.id}/roster-lock`, { locked: true });
  const locked = (await api('GET', `/tournaments/${selected.id}`)).data.tournament;
  if (!locked.roster_locked_at) throw new Error('Roster lock was not persisted.');
  await api('PUT', `/tournaments/${selected.id}/roster-lock`, { locked: false });

  const originalStatus = ['scheduled', 'in_progress'].includes(game.status) ? game.status : 'scheduled';
  const reason = `Operations smoke test ${Date.now()}`;
  const changed = await api('PUT', `/matches/${game.id}/operational-status`, { status: 'postponed', reason });
  const refreshed = (await api('GET', `/tournaments/${selected.id}/game-day`)).data.games.find(row => Number(row.id) === Number(game.id));
  if (refreshed.status !== 'postponed' || refreshed.operational_status_reason !== reason) throw new Error('Emergency game status was not persisted.');
  await api('PUT', `/matches/${game.id}/operational-status`, { status: originalStatus, reason: 'Operations smoke test restored the original state.' });

  console.log(JSON.stringify({
    tournament: selected.name,
    roster_lock_and_unlock: true,
    emergency_status_and_restore: true,
    coach_notifications_dispatched: changed.data.coaches_notified,
  }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
