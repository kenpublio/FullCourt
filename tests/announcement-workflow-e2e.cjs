const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find(({ user }) => user.role === 'platform_admin');
const staff = sessions.find(({ user }) => user.role === 'statistician');
const coach = sessions.find(({ user }) => user.role === 'coach');
if (!admin || !staff || !coach) throw new Error('Admin, Staff Admin, and Coach sessions are required.');

async function request(route, session, options = {}) {
  const response = await fetch(apiBase + route, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${session.token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload, data: payload?.data };
}

(async () => {
  const tournamentResult = await request('/tournaments', staff);
  const tournaments = tournamentResult.data?.tournaments || tournamentResult.data || [];
  if (!tournamentResult.response.ok || !tournaments.length) throw new Error('Staff Admin has no assigned tournament for the announcement test.');
  const tournament = tournaments[0];
  const stamp = Date.now();
  const title = `Game-day communication test ${stamp}`;
  const message = 'This is an automated FullCourt workflow check. No action is required.';

  const published = await request('/announcements', staff, {
    method: 'POST',
    body: { tournament_id: Number(tournament.id), title, message, priority: 'normal', expires_in_hours: 1 },
  });
  if (!published.response.ok || !published.data?.id) throw new Error(`Staff announcement failed: ${published.payload?.message || published.response.status}`);

  const globalDenied = await request('/announcements', staff, {
    method: 'POST', body: { title: 'Unauthorized global test', message, expires_in_hours: 1 },
  });
  if (globalDenied.response.status !== 422) throw new Error('Staff Admin was allowed to publish a global announcement.');

  const publicResult = await fetch(`${apiBase}/public/announcements`).then(async response => ({ response, payload: await response.json() }));
  const publicRows = publicResult.payload?.data?.announcements || [];
  if (!publicResult.response.ok || !publicRows.some(row => row.title === title && Number(row.id) === Number(published.data.id))) {
    throw new Error('Published announcement is missing from the public feed.');
  }

  const managed = await request('/announcements', staff);
  if (!managed.response.ok || !(managed.data?.announcements || []).some(row => Number(row.id) === Number(published.data.id))) {
    throw new Error('Staff Admin cannot see the announcement it published.');
  }

  const adminManaged = await request('/announcements', admin);
  if (!adminManaged.response.ok || !(adminManaged.data?.announcements || []).some(row => Number(row.id) === Number(published.data.id))) {
    throw new Error('Admin cannot audit the published announcement.');
  }

  const coachNotifications = await request('/notifications', coach);
  const notificationRows = coachNotifications.data?.notifications || coachNotifications.data || [];
  const coachWasRecipient = notificationRows.some(row => row.title === title);

  console.log(JSON.stringify({
    passed: true,
    tournament: tournament.name,
    announcement_id: published.data.id,
    notifications_created: published.data.notifications_created,
    public_feed: true,
    staff_global_publish_blocked: true,
    admin_audit_visible: true,
    sampled_coach_notified: coachWasRecipient,
  }, null, 2));
})().catch(error => { console.error(error.stack || error); process.exit(1); });
