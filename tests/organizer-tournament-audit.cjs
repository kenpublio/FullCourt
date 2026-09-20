const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = 'http://127.0.0.1:8767/api';
const webBase = 'http://127.0.0.1:5180';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const organizer = sessions.find((session) => session.user.role === 'organization_admin');
if (!organizer) throw new Error('Organizer demo account was not found.');

async function api(route) {
  const response = await fetch(apiBase + route, { headers: { Authorization: `Bearer ${organizer.token}` } });
  const payload = await response.json();
  if (!response.ok) throw new Error(`${route}: ${response.status} ${payload.message || ''}`);
  return payload.data;
}

(async () => {
  const [teamsData, scheduleData, bracketData, standingsData, awardsData, publicData] = await Promise.all([
    api('/tournaments/2/teams'), api('/tournaments/2/schedule'), api('/tournaments/2/bracket'),
    api('/tournaments/2/standings'), api('/tournaments/2/awards'),
    fetch(`${apiBase}/public/tournaments/2`).then((response) => response.json()).then((payload) => payload.data),
  ]);
  const teams = teamsData.teams || [];
  const schedule = scheduleData.schedule || [];
  const bracket = bracketData.matches || [];
  const standings = standingsData.standings || [];
  const awards = awardsData.awards || [];
  const mvp = awards.find((award) => award.name === 'Tournament MVP');
  const mythical = awards.filter((award) => award.name.startsWith('Mythical Five'));
  const firstRoster = teams[0] ? (await api(`/teams/${teams[0].id}/players`)).players || [] : [];

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const openAsOrganizer = async (route) => {
    const roleContext = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await roleContext.addInitScript((session) => {
      localStorage.setItem('sportsync_token', session.token);
      localStorage.setItem('sportsync_user', JSON.stringify(session.user));
    }, organizer);
    const rolePage = await roleContext.newPage();
    await rolePage.goto(`${webBase}${route}`, { waitUntil: 'domcontentloaded' });
    return { roleContext, rolePage };
  };
  let { roleContext: context, rolePage: page } = await openAsOrganizer('/brackets');
  await page.getByRole('heading', { name: 'Round 1', exact: true }).waitFor({ timeout: 20000 });
  const bracketVisible = await page.getByText('Barangay Cogon', { exact: true }).count() > 0;
  await context.close();
  const rosterPictures = firstRoster.filter((player) => player.avatar_url).length;
  const awardsVisible = publicData.awards?.some((award) => award.name === 'Tournament MVP')
    && publicData.awards?.filter((award) => award.name.startsWith('Mythical Five')).length === 5;
  await browser.close();

  const result = {
    teams: teams.length,
    completed_games: schedule.filter((match) => match.status === 'completed').length,
    bracket_games: bracket.length,
    standings_teams: standings.length,
    mvp: mvp?.full_name || null,
    mythical_five: mythical.map((award) => `${award.name.replace('Mythical Five - ', '')}: ${award.full_name}`),
    public_awards: publicData.awards?.length || 0,
    bracket_visible_in_organizer_ui: bracketVisible,
    roster_pictures_visible: rosterPictures,
    awards_visible_in_organizer_ui: awardsVisible,
  };
  console.log(JSON.stringify(result, null, 2));
  if (result.teams !== 8 || result.completed_games !== 7 || result.bracket_games !== 7 || result.standings_teams !== 8
    || !result.mvp || result.mythical_five.length !== 5 || result.public_awards < 6 || !bracketVisible || rosterPictures < 10 || !awardsVisible) {
    process.exit(2);
  }
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
