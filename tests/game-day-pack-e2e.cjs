const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const api = process.env.API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));

async function json(route, session) {
  const response = await fetch(api + route, { headers: { Authorization: `Bearer ${session.token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${session.user.role} ${route}: ${response.status} ${payload.message || ''}`);
  return payload.data;
}

(async () => {
  const results = {};
  for (const role of ['platform_admin', 'statistician', 'coach', 'assistant_coach']) {
    const session = sessions.find(item => item.user.role === role);
    if (!session) continue;
    const tournaments = (await json('/tournaments', session)).tournaments || [];
    if (!tournaments.length) { results[role] = 'skipped_no_assigned_tournament'; continue; }
    let verified = null;
    for (const tournament of tournaments) {
      const response = await fetch(`${api}/reports/tournaments/${tournament.id}/game-day-pack.pdf`, { headers: { Authorization: `Bearer ${session.token}` } });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.ok && bytes.subarray(0, 4).equals(Buffer.from('%PDF')) && bytes.length >= 1000) { verified = { tournament, bytes }; break; }
      if (response.status !== 403) throw new Error(`${role} could not generate a valid Game-Day Pack PDF (${response.status}, ${bytes.length} bytes).`);
    }
    if (!verified) { results[role] = 'skipped_no_assigned_tournament'; continue; }
    results[role] = { tournament: verified.tournament.name, pdf_bytes: verified.bytes.length, passed: true };
  }
  console.log(JSON.stringify(results, null, 2));
})().catch(error => { console.error(error.stack || error); process.exit(1); });
