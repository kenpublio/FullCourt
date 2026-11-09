const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tmp', 'pdfs', 'screens');
const web = 'http://127.0.0.1:5180';
const api = 'http://127.0.0.1:8767/api';
fs.mkdirSync(out, { recursive: true });
const sessions = JSON.parse(execFileSync('php', [path.join(root, 'tests', 'BrowserAuditSession.php')], { encoding: 'utf8' }));
const byRole = role => sessions.find(item => item.user.role === role);

async function apiCall(route, token, options = {}) {
  const response = await fetch(api + route, {
    method: options.method || 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${route}: ${payload.message}`);
  return payload.data;
}

async function authenticatedContext(browser, session, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  await context.addInitScript(value => {
    localStorage.setItem('sportsync_token', value.token);
    localStorage.setItem('sportsync_user', JSON.stringify(value.user));
  }, session);
  return context;
}

async function shot(page, name, locator = null) {
  await page.waitForTimeout(500);
  const target = locator ? page.locator(locator).first() : page;
  if (locator) await target.scrollIntoViewIfNeeded();
  await target.screenshot({ path: path.join(out, `${name}.png`) });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });

  const publicContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const publicPage = await publicContext.newPage();
  await publicPage.goto(web, { waitUntil: 'networkidle' });
  await shot(publicPage, '01-public-home');
  await publicPage.goto(`${web}/login`, { waitUntil: 'networkidle' });
  await shot(publicPage, '18-login');
  await publicPage.goto(`${web}/register`, { waitUntil: 'networkidle' });
  await shot(publicPage, '19-register-coach');
  const assistantChoice = publicPage.getByText('Assistant Coach', { exact: true }).first();
  if (await assistantChoice.count()) await assistantChoice.click();
  await shot(publicPage, '20-register-assistant');
  await publicPage.goto(`${web}/forgot-password`, { waitUntil: 'networkidle' });
  await shot(publicPage, '21-forgot-password');
  await publicPage.goto(`${web}/sports`, { waitUntil: 'networkidle' });
  await shot(publicPage, '02-public-tournaments');
  const tournamentHref = await publicPage.locator('a[href^="/sports/tournaments/"]').first().getAttribute('href');
  if (tournamentHref) {
    await publicPage.goto(web + tournamentHref, { waitUntil: 'networkidle' });
    await shot(publicPage, '22-public-tournament-details');
  }
  await publicPage.goto(`${web}/sports/schedule`, { waitUntil: 'networkidle' });
  await shot(publicPage, '03-public-schedule');
  const gameLink = publicPage.locator('a[href^="/sports/games/"]').first();
  const gameHref = await gameLink.count() ? await gameLink.getAttribute('href') : null;
  if (gameHref) {
    await publicPage.goto(web + gameHref, { waitUntil: 'networkidle' });
    await shot(publicPage, '23-public-game-details');
  } else {
    console.log('Public game detail screenshot skipped: no published game link is currently available.');
  }
  await publicContext.close();

  const admin = byRole('platform_admin');
  const adminContext = await authenticatedContext(browser, admin);
  const adminPage = await adminContext.newPage();
  for (const [route, name, heading] of [
    ['/platform', '04-admin-dashboard', /Administrator/i],
    ['/users', '24-admin-accounts', /User & Role Management/i],
    ['/tournaments', '25-admin-tournaments', /Tournament/i],
    ['/teams', '05-admin-teams', /Team Roster Management/i],
    ['/eligibility', '06-admin-eligibility', /Player Eligibility Verification/i],
    ['/brackets', '07-admin-bracket', /Automated Bracket Engine/i],
    ['/schedules', '08-admin-schedule', /Game Schedule & Venue Assignment/i],
    ['/awards', '09-admin-awards', /Basketball Awards/i],
    ['/payments', '26-admin-payments', /Payment/i],
    ['/qr-attendance', '27-admin-qr', /QR Game Access/i],
    ['/game-day', '28-admin-incidents', /Incident/i],
    ['/reports', '29-admin-reports', /Reports/i],
    ['/notifications', '49-admin-notifications', /Notifications/i],
    ['/settings', '50-admin-settings', /Settings/i],
  ]) {
    await adminPage.goto(web + route, { waitUntil: 'networkidle' });
    await adminPage.getByText(heading).first().waitFor({ timeout: 20000 }).catch(() => {});
    await shot(adminPage, name);
  }
  await adminContext.close();

  const staff = byRole('statistician');
  const staffContext = await authenticatedContext(browser, staff);
  const staffPage = await staffContext.newPage();
  await staffPage.goto(`${web}/officials`, { waitUntil: 'networkidle' });
  await shot(staffPage, '10-staff-scoring-access');
  await staffPage.goto(`${web}/statistician`, { waitUntil: 'networkidle' });
  await shot(staffPage, '11-staff-statistician');
  for (const [route, name] of [
    ['/dashboard', '30-staff-dashboard'],
    ['/teams', '31-staff-teams'],
    ['/eligibility', '32-staff-eligibility'],
    ['/brackets', '33-staff-brackets'],
    ['/schedules', '34-staff-schedules'],
    ['/standings', '35-staff-standings'],
    ['/qr-attendance', '36-staff-qr'],
    ['/game-day', '37-staff-incidents'],
    ['/notifications', '51-staff-notifications'],
    ['/settings', '52-staff-settings'],
  ]) {
    await staffPage.goto(web + route, { waitUntil: 'networkidle' });
    await shot(staffPage, name);
  }
  await staffContext.close();

  const coach = byRole('coach');
  const coachContext = await authenticatedContext(browser, coach, { width: 390, height: 844 });
  const coachPage = await coachContext.newPage();
  await coachPage.goto(`${web}/coach`, { waitUntil: 'networkidle' });
  await shot(coachPage, '12-coach-mobile-dashboard');
  await coachPage.goto(`${web}/teams`, { waitUntil: 'networkidle' });
  await shot(coachPage, '13-coach-mobile-roster');
  for (const [route, name] of [
    ['/eligibility', '38-coach-eligibility'],
    ['/schedules', '39-coach-schedule'],
    ['/standings', '40-coach-standings'],
    ['/reports', '41-coach-reports'],
    ['/qr-attendance', '42-coach-qr'],
    ['/notifications', '43-coach-notifications'],
    ['/profile', '53-coach-profile'],
    ['/settings', '54-coach-settings'],
  ]) {
    await coachPage.goto(web + route, { waitUntil: 'networkidle' });
    await shot(coachPage, name);
  }
  await coachContext.close();

  const assistant = byRole('assistant_coach');
  const assistantContext = await authenticatedContext(browser, assistant, { width: 390, height: 844 });
  const assistantPage = await assistantContext.newPage();
  for (const [route, name] of [
    ['/coach', '44-assistant-dashboard'],
    ['/schedules', '45-assistant-schedule'],
    ['/standings', '46-assistant-standings'],
    ['/reports', '47-assistant-reports'],
    ['/qr-attendance', '48-assistant-qr'],
    ['/notifications', '55-assistant-notifications'],
    ['/profile', '56-assistant-profile'],
    ['/settings', '57-assistant-settings'],
  ]) {
    await assistantPage.goto(web + route, { waitUntil: 'networkidle' });
    await shot(assistantPage, name);
  }
  await assistantContext.close();

  const tournaments = (await apiCall('/tournaments', admin.token)).tournaments || [];
  let fixture;
  for (const tournament of tournaments) {
    const schedule = (await apiCall(`/tournaments/${tournament.id}/schedule`, admin.token)).schedule || [];
    const game = schedule.find(row => row.team1_id && row.team2_id && !['completed', 'cancelled', 'awaiting_confirmation'].includes(row.status));
    if (game) { fixture = { tournament, game }; break; }
  }
  if (!fixture) throw new Error('No open game is available for the scoring screenshots.');
  const access = (await apiCall(`/matches/${fixture.game.id}/scoring-link`, admin.token, { method: 'POST', body: { operator_label: 'Kadayo Review', expires_in_hours: 2 } })).access;
  const activation = await fetch(`${api}/public/scoring-links/${access.token}/activate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ operator_name: 'Kadayo Review', pin: access.pin, device_id: `pdf-review-${Date.now()}` }),
  }).then(response => response.json());
  const scoringContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await scoringContext.addInitScript(value => sessionStorage.setItem(`fc_score_${value.token}`, value.session), { token: access.token, session: activation.data.session_token });
  const scoringPage = await scoringContext.newPage();
  await scoringPage.goto(`${web}/score/${access.token}`, { waitUntil: 'networkidle' });
  await shot(scoringPage, '14-live-scoreboard', '.courtside-scoreboard');
  await shot(scoringPage, '15-two-team-player-picker', '.courtside-roster-picker');
  await shot(scoringPage, '16-stat-controls', '.courtside-actions');
  await shot(scoringPage, '17-safety-and-final', '.courtside-safety-bottom');
  await scoringContext.close();

  await browser.close();
  console.log(JSON.stringify({ output: out, screenshots: fs.readdirSync(out).filter(name => name.endsWith('.png')).length }, null, 2));
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
