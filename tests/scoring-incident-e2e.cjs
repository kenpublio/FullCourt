const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');
if (!admin) throw new Error('Platform Admin demo session is unavailable.');

async function request(route, { method = 'GET', token = admin.token, body } = {}) {
  const response = await fetch(apiBase + route, {
    method,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || text}`);
  return payload.data;
}

(async () => {
  const tournaments = (await request('/tournaments')).tournaments || [];
  let fixture = null;
  for (const tournament of tournaments) {
    const data = await request(`/tournaments/${tournament.id}/schedule`);
    const game = (data.schedule || []).find((entry) =>
      entry.team1_id && entry.team2_id && !['completed', 'cancelled', 'awaiting_confirmation'].includes(entry.status));
    if (game) {
      fixture = { tournament, game };
      break;
    }
  }
  if (!fixture) throw new Error('No open scheduled game is available for the incident rehearsal.');

  const accessData = await request(`/matches/${fixture.game.id}/scoring-link`, {
    method: 'POST',
    body: { operator_label: 'Safety Rehearsal Scorer', expires_in_hours: 2 },
  });
  const access = accessData.access;
  if (!access?.token || !access?.pin) throw new Error('Secure scoring access was not created.');

  const activation = await request(`/public/scoring-links/${access.token}/activate`, {
    method: 'POST',
    token: null,
    body: {
      operator_name: 'Safety Rehearsal Scorer',
      pin: access.pin,
      device_id: `incident-rehearsal-${Date.now()}`,
    },
  });
  const guestToken = activation.session_token;
  const marker = Date.now();

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.addInitScript(({ token, sessionToken }) => {
    sessionStorage.setItem(`fc_score_${token}`, sessionToken);
  }, { token: access.token, sessionToken: guestToken });
  await page.goto(`${webBase}/score/${access.token}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Player injury/i }).waitFor();
  await page.getByRole('button', { name: /Fight \/ misconduct/i }).waitFor();
  const mobileOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  if (mobileOverflow) throw new Error('The incident controls overflow the mobile scoring console.');

  await page.getByRole('button', { name: /Player injury/i }).click();
  await page.getByLabel(/Affected player or team/i).selectOption({ index: 1 });
  await page.getByLabel(/What happened/i).fill(`Player landed awkwardly and reported an ankle injury. E2E-INJURY-${marker}`);
  await page.getByLabel(/Immediate action taken/i).fill('Clock stopped; first aid applied; player removed from the game.');
  await page.getByRole('button', { name: /Save incident report/i }).click();
  await page.getByRole('dialog').waitFor({ state: 'hidden' });

  await request('/scoring-session/incidents', {
    method: 'POST',
    token: guestToken,
    body: {
      incident_type: 'misconduct',
      severity: 'high',
      subject: 'Both teams · courtside altercation',
      description: `Players exchanged shoves after a hard foul. E2E-FIGHT-${marker}`,
      action_taken: 'Game paused; teams separated; staff and coaches restored order.',
    },
  });

  const overview = await request(`/tournaments/${fixture.tournament.id}/game-day`);
  const injury = (overview.incidents || []).find((entry) => String(entry.description).includes(`E2E-INJURY-${marker}`));
  const fight = (overview.incidents || []).find((entry) => String(entry.description).includes(`E2E-FIGHT-${marker}`));
  if (!injury || injury.incident_type !== 'injury' || injury.status !== 'open') throw new Error('Injury report did not reach the Incident Desk.');
  if (!fight || fight.incident_type !== 'misconduct' || fight.status !== 'open') throw new Error('Fight report did not reach the Incident Desk.');

  const notifications = (await request('/notifications')).notifications || [];
  const incidentNotices = notifications.filter((entry) => entry.notification_type === 'game_incident');
  if (!incidentNotices.some((entry) => String(entry.message).includes(`game #${fixture.game.id}`))) {
    throw new Error('Admin incident notification was not created.');
  }

  await browser.close();
  console.log(JSON.stringify({
    tournament: fixture.tournament.name,
    match_id: Number(fixture.game.id),
    mobile_console: 'PASS',
    injury_report: 'PASS',
    misconduct_report: 'PASS',
    incident_desk: 'PASS',
    admin_notification: 'PASS',
  }, null, 2));
})().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exit(1);
});
