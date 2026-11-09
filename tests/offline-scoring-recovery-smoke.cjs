const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const admin = sessions.find((entry) => entry.user.role === 'platform_admin');

async function api(route, { method = 'GET', token = admin?.token, body } = {}) {
  const response = await fetch(apiBase + route, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || ''}`);
  return payload.data;
}

(async () => {
  const tournaments = (await api('/tournaments')).tournaments || [];
  let game;
  for (const tournament of tournaments) {
    const schedule = (await api(`/tournaments/${tournament.id}/schedule`)).schedule || [];
    game = schedule.find((row) => row.team1_id && row.team2_id && !['completed', 'cancelled', 'awaiting_confirmation'].includes(row.status));
    if (game) break;
  }
  if (!game) throw new Error('No playable game is available for offline scoring recovery.');
  const access = (await api(`/matches/${game.id}/scoring-link`, { method: 'POST', body: { operator_label: 'Offline Recovery Test', expires_in_hours: 2 } })).access;
  const activation = await api(`/public/scoring-links/${access.token}/activate`, { method: 'POST', token: null, body: { operator_name: 'Offline Recovery Test', pin: access.pin, device_id: `offline-${Date.now()}` } });

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.addInitScript(({ linkToken, sessionToken }) => sessionStorage.setItem(`fc_score_${linkToken}`, sessionToken), { linkToken: access.token, sessionToken: activation.session_token });
  await page.goto(`${webBase}/score/${access.token}`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /2PT Made/i }).waitFor();
  await context.setOffline(true);
  await page.getByRole('button', { name: /2PT Made/i }).click();
  await page.getByText(/queued offline|saved on this device/i).waitFor();
  await page.waitForTimeout(9000);
  const offlineState = await page.evaluate((linkToken) => ({ session: sessionStorage.getItem(`fc_score_${linkToken}`), queue: JSON.parse(localStorage.getItem(`fc_score_queue_${linkToken}`) || '[]') }), access.token);
  if (!offlineState.session || offlineState.queue.length !== 1) throw new Error('Offline scoring session or queued action was not preserved.');
  await context.setOffline(false);
  await page.getByText(/synchronized/i).waitFor({ timeout: 20000 });
  const remaining = await page.evaluate((linkToken) => JSON.parse(localStorage.getItem(`fc_score_queue_${linkToken}`) || '[]').length, access.token);
  if (remaining !== 0) throw new Error('Queued scoring action did not synchronize after reconnection.');
  await browser.close();
  console.log(JSON.stringify({ session_preserved_offline: true, action_queued_offline: true, automatic_reconnect_sync: true }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
