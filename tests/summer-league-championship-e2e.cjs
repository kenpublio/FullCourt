const { chromium } = require('C:/Users/ACER/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apiBase = process.env.FULLCOURT_API_URL || 'http://127.0.0.1:8767/api';
const webBase = process.env.FULLCOURT_WEB_URL || 'http://127.0.0.1:5180';
const fixture = JSON.parse(execFileSync('php', [path.join(root, 'backend/cli/seed_summer_league_u16.php')], { cwd: root, encoding: 'utf8' }));

async function api(route, { method = 'GET', token, body } = {}) {
  const response = await fetch(apiBase + route, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload;
  try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || text}`);
  return payload.data;
}

async function login(email, portal = 'user') {
  return api('/auth/login', { method: 'POST', body: { email, password: fixture.password, portal } });
}

(async () => {
  const [admin, nova] = await Promise.all([
    login('platform.admin@fullcourt.local', 'admin'),
    login(fixture.staff_admin.email),
  ]);
  const tournamentId = Number(fixture.tournament_id);
  const allPlayers = (await api('/eligibility', { token: admin.token })).players;
  const rosters = new Map();
  for (const player of allPlayers) {
    const teamId = Number(player.team_id);
    if (!rosters.has(teamId)) rosters.set(teamId, []);
    rosters.get(teamId).push(Number(player.id));
  }
  const seededSchedule = (await api(`/tournaments/${tournamentId}/schedule`, { token: admin.token })).schedule;
  const seededGame = seededSchedule.find((game) => game.court_id);
  if (!seededGame) throw new Error('Tournament court was not attached.');
  const courtId = Number(seededGame.court_id);
  const testedTeamIds = new Set();
  const completedGames = [];
  const scoringControls = new Set();
  const scoreTargets = [[58,47],[64,52],[71,65],[55,48],[68,61],[76,69],[62,57],[73,66],[81,74]];
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const browserErrors = [];
  let uiButtonClicks = 0;

  for (let gameIndex = 0; gameIndex < 12; gameIndex += 1) {
    const schedule = (await api(`/tournaments/${tournamentId}/schedule`, { token: admin.token })).schedule;
    const ready = schedule
      .filter((game) => game.team1_id && game.team2_id && !['completed', 'cancelled'].includes(game.status))
      .sort((a, b) => Number(a.round_number) - Number(b.round_number) || Number(a.match_number) - Number(b.match_number))[0];
    if (!ready) break;
    const matchId = Number(ready.id);
    const team1 = Number(ready.team1_id), team2 = Number(ready.team2_id);
    testedTeamIds.add(team1); testedTeamIds.add(team2);
    const slotDate = new Date('2026-11-16T08:00:00+08:00');
    slotDate.setDate(slotDate.getDate() + (gameIndex * 2));
    const slotDay = `${slotDate.getFullYear()}-${String(slotDate.getMonth() + 1).padStart(2, '0')}-${String(slotDate.getDate()).padStart(2, '0')}`;
    await api(`/matches/${matchId}/slot`, {
      method: 'PUT', token: nova.token,
      body: { scheduled_start_time: `${slotDay} 08:00:00`, court_id: courtId, reason: 'Full championship rehearsal schedule' },
    });
    for (const teamId of [team1, team2]) {
      const roster = rosters.get(teamId) || [];
      if (roster.length !== 15) throw new Error(`Team ${teamId} has ${roster.length}/15 players.`);
      await api(`/matches/${matchId}/lineup`, {
        method: 'PUT', token: admin.token,
        body: { players: roster.map((team_player_id, index) => ({ team_player_id, is_present: true, is_starter: index < 5 })) },
      });
    }
    const link = (await api(`/matches/${matchId}/scoring-link`, {
      method: 'POST', token: admin.token, body: { operator_label: `Nova Serato · Game ${gameIndex + 1}`, expires_in_hours: 12 },
    })).access;
    const guest = await api(`/public/scoring-links/${link.token}/activate`, {
      method: 'POST', body: { operator_name: 'Nova Serato', pin: link.pin, device_id: `championship-device-${matchId}` },
    });
    const consoleData = await api('/scoring-session/console', { token: guest.session_token });
    const home = consoleData.players.filter((player) => Number(player.team_id) === team1 && Number(player.is_present) === 1);
    const away = consoleData.players.filter((player) => Number(player.team_id) === team2 && Number(player.is_present) === 1);
    if (home.length !== 15 || away.length !== 15) throw new Error(`Match ${matchId} does not expose both 15-player lineups.`);

    async function stat(player, eventType, period, seconds) {
      await api('/scoring-session/stats', {
        method: 'POST', token: guest.session_token,
        body: { event_uuid: crypto.randomUUID(), team_id: Number(player.team_id), team_player_id: Number(player.team_player_id), event_type: eventType, current_period: `Q${period}`, game_clock_seconds: seconds },
      });
      scoringControls.add(eventType);
    }
    const deviceId = `championship-device-${matchId}`;
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const scorePage = await context.newPage();
    scorePage.on('pageerror', (error) => browserErrors.push(`match ${matchId}: ${error.message}`));
    await scorePage.addInitScript((id) => localStorage.setItem('fc_scoring_device_id', id), deviceId);
    await scorePage.goto(`${webBase}/score/${link.token}`, { waitUntil: 'domcontentloaded', timeout: 45000 });
    await scorePage.getByLabel('Your name').fill('Nova Serato UI Rehearsal');
    await scorePage.getByLabel('6-digit access PIN').fill(link.pin);
    await scorePage.getByRole('button', { name: /Enter courtside console/i }).click();
    await scorePage.getByText(/Quarter & game clock/i).waitFor({ timeout: 30000 });
    const controls = [
      ['2PT Made','2pt_made'],['2PT Miss','2pt_missed'],['3PT Made','3pt_made'],['3PT Miss','3pt_missed'],
      ['Free Throw','ft_made'],['Free Throw Miss','ft_missed'],['Off. Rebound','off_rebound'],['Def. Rebound','def_rebound'],
      ['Assist','assist'],['Steal','steal'],['Block','block'],['Turnover','turnover'],['Personal Foul','personal_foul'],
    ];
    for (const player of [home[0], away[0]]) {
      await scorePage.getByRole('button', { name: new RegExp(player.full_name, 'i') }).first().click();
      for (const [label,eventType] of controls) {
        await scorePage.getByRole('button', { name: label, exact: true }).click();
        scoringControls.add(eventType); uiButtonClicks += 1;
      }
    }
    await scorePage.waitForTimeout(300);
    await context.close();

    const distribute = (total) => {
      const base=Math.floor(total/4), remainder=total%4;
      return Array.from({length:4},(_,index)=>base+(index<remainder?1:0));
    };
    async function addPoints(players, amount, quarter) {
      let remaining=amount,index=0;
      while(remaining>0){
        const eventType=remaining===1?'ft_made':remaining===2?'2pt_made':'3pt_made';
        await stat(players[index%players.length],eventType,quarter,520-((index%7)*55));
        remaining-=eventType==='3pt_made'?3:eventType==='2pt_made'?2:1;index+=1;
      }
    }
    const [targetHome,targetAway]=scoreTargets[gameIndex];
    const homeQuarterTargets=distribute(targetHome),awayQuarterTargets=distribute(targetAway);
    const afterUi=(await api(`/public/matches/${matchId}/live`)).period_scores||[];
    for(let quarter=1;quarter<=4;quarter+=1){
      const current=afterUi.find(row=>Number(row.period)===quarter)||{};
      await addPoints(home,homeQuarterTargets[quarter-1]-Number(current.team1_score||0),quarter);
      await addPoints(away,awayQuarterTargets[quarter-1]-Number(current.team2_score||0),quarter);
    }
    const finalConsole = await api('/scoring-session/console', { token: guest.session_token });
    const homeScore = Number(finalConsole.game.team1_score), awayScore = Number(finalConsole.game.team2_score);
    if (homeScore !== targetHome || awayScore !== targetAway) throw new Error(`Unexpected score in match ${matchId}: ${homeScore}-${awayScore}; expected ${targetHome}-${targetAway}.`);
    const quarterRows = (await api(`/public/matches/${matchId}/live`)).period_scores || [];
    if (quarterRows.length < 4 || quarterRows.some((row) => Number(row.team1_score) <= 0 || Number(row.team2_score) <= 0)) throw new Error(`Quarter scoring is incomplete for match ${matchId}.`);
    await api('/scoring-session/submit-final', { method: 'POST', token: guest.session_token, body: {} });
    await api(`/matches/${matchId}/finalize`, {
      method: 'POST', token: admin.token,
      body: { winner_team_id: team1, team1_score: homeScore, team2_score: awayScore, expected_team1_score: homeScore, expected_team2_score: awayScore, current_period: 'Q4', timer_seconds: 0 },
    });
    completedGames.push({ id: matchId, round: Number(ready.round_number), team1, team2, score: `${homeScore}-${awayScore}` });
  }

  if (completedGames.length !== 9) throw new Error(`Expected 9 played games for 10 teams, completed ${completedGames.length}.`);
  if (testedTeamIds.size !== 10) throw new Error(`Only ${testedTeamIds.size}/10 teams reached a scored game.`);
  const expectedControls = ['2pt_made','2pt_missed','3pt_made','3pt_missed','ft_made','ft_missed','off_rebound','def_rebound','assist','steal','block','turnover','personal_foul'];
  for (const control of expectedControls) if (!scoringControls.has(control)) throw new Error(`Scoring function not exercised: ${control}`);
  if(uiButtonClicks!==9*2*13)throw new Error(`Expected 234 real UI scoring clicks, recorded ${uiButtonClicks}.`);

  const finalSchedule = (await api(`/tournaments/${tournamentId}/schedule`, { token: admin.token })).schedule;
  const championship = finalSchedule.find((game) => Number(game.round_number) === 4);
  if (!championship || championship.status !== 'completed' || !championship.winner_team_id) throw new Error('Championship did not complete.');
  const championTeam = Number(championship.winner_team_id);
  const publicData = await api(`/public/tournaments/${tournamentId}`);
  const teams = publicData.teams;
  if (teams.length !== 10) throw new Error('Public tournament lost a team.');
  const standings = publicData.standings || [];
  if (standings.length !== 10) throw new Error(`Public standings show ${standings.length}/10 teams.`);
  for (const team of standings) {
    const wins = Number(team.won || 0), losses = Number(team.lost || 0);
    if (wins + losses < 1) throw new Error(`${team.team_name} has no played-game record.`);
  }
  const winSum = standings.reduce((sum, team) => sum + Number(team.won || 0), 0);
  const lossSum = standings.reduce((sum, team) => sum + Number(team.lost || 0), 0);
  if (winSum !== 9 || lossSum !== 9) throw new Error(`Win-loss totals are wrong: ${winSum}-${lossSum}.`);
  const champion = standings.find((team) => Number(team.team_id) === championTeam);
  if (!champion || Number(champion.won) !== 3 || Number(champion.lost) !== 0) throw new Error('Champion record should be 3-0 after a first-round bye.');

  const gameDetails = await api(`/public/matches/${championship.id}/details`);
  for (const side of ['team1', 'team2']) {
    const row = gameDetails.comparison[side];
    const expected = row.games ? Math.round((Number(row.wins) / Number(row.games)) * 1000) / 10 : 0;
    if (Number(row.win_rate) !== expected) throw new Error(`${side} win rate ${row.win_rate}% should be ${expected}%.`);
  }
  const live = await api(`/public/matches/${championship.id}/live`);
  if ((live.period_scores || []).length < 4 || (live.box_score || []).length < 10) throw new Error('Championship public statistics are incomplete.');

  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${webBase}/sports/games/${championship.id}?tournament=${tournamentId}`, { waitUntil: 'networkidle', timeout: 45000 });
  await page.getByText('Season snapshot').waitFor();
  await page.getByText('WIN RATE').first().waitFor();
  await page.getByText(/Record \d+–\d+/).first().waitFor();
  await page.getByText('Box score').waitFor();
  await page.getByRole('tab', { name: new RegExp(championship.team1_name, 'i') }).waitFor();
  await page.getByRole('tab', { name: new RegExp(championship.team2_name, 'i') }).click();
  await page.getByText('Q1').first().waitFor();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 3);
  await browser.close();
  if (pageErrors.length || browserErrors.length || overflow) throw new Error([...browserErrors,...pageErrors].join('; ') || 'Championship mobile page overflows horizontally.');

  console.log(JSON.stringify({
    tournament_id: tournamentId,
    tournament: fixture.tournament,
    teams_tested: testedTeamIds.size,
    games_completed: completedGames.length,
    bracket_reached_championship: true,
    champion: champion.team_name,
    champion_record: `${champion.won}-${champion.lost}`,
    total_wins_losses: `${winSum}-${lossSum}`,
    all_quarters_scored_every_game: true,
    all_13_scoring_functions_tested: true,
    actual_scoring_ui_button_clicks: uiButtonClicks,
    both_15_player_lineups_loaded_every_game: true,
    public_win_rate_verified: true,
    public_box_score_verified: true,
    mobile_championship_page_passed: true,
    championship_game_id: Number(championship.id),
    championship_url: `${webBase}/sports/games/${championship.id}?tournament=${tournamentId}`,
    game_results: completedGames,
  }, null, 2));
})().catch((error) => { console.error(error.stack || error.message); process.exit(1); });
