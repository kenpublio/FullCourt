const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const base = 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const byRole = Object.fromEntries(sessions.map(s => [s.user.role, s]));
const organizer = byRole.organization_admin;
const admin = byRole.platform_admin;
const coach = byRole.coach;
const player = byRole.player;
if (!organizer || !admin || !coach || !player) throw new Error('Demo role accounts are incomplete.');

async function api(session, method, route, body) {
  const response = await fetch(base + route, {
    method,
    headers: { Authorization: `Bearer ${session.token}`, ...(body ? {'Content-Type':'application/json'} : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let payload; try { payload = JSON.parse(text); } catch { payload = { message: text }; }
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${payload.message || text}`);
  return payload;
}

(async () => {
  let organizations = (await api(organizer,'GET','/organizations')).data.organizations;
  let organization = organizations.find(o => o.slug === 'ka-dayo-ormoc');
  if (!organization) {
    const createdOrganization = await api(organizer,'POST','/organizations',{
      name:'Ka-DAYO Ormoc Basketball', organization_type:'club', slug:'ka-dayo-ormoc',
      tagline:'One passion. Every barangay. One Ormoc basketball community.',
      primary_color:'#CD2D17', secondary_color:'#18181B'
    });
    organization = {id:createdOrganization.data.id,status:'pending'};
  }
  if (organization.status !== 'active') {
    await api(admin,'PUT',`/organizations/${organization.id}/review`,{status:'active',notes:'Approved for FullCourt end-to-end tournament test.'});
  }
  const name = 'Ormoc Inter-Barangay Basketball Tournament 2026';
  let listing = await api(organizer, 'GET', '/tournaments');
  let tournament = listing.data.tournaments.find(t => t.name === name);
  if (!tournament) {
    const created = await api(organizer, 'POST', '/tournaments', {
      name, format:'single_elimination', rules:'FIBA basketball rules and FullCourt eligibility requirements.',
      description:'City-wide basketball competition open to all barangays of Ormoc City.',
      start_date:'2026-10-10', end_date:'2026-10-25', registration_fee:1500, status:'upcoming'
    });
    tournament = { id: created.data.id, name };
  }
  const tournamentId = Number(tournament.id);

  let divisions = (await api(organizer,'GET',`/tournaments/${tournamentId}/divisions`)).data.divisions;
  let division = divisions.find(d => d.name === 'Open Division');
  if (!division) division = { id:(await api(organizer,'POST',`/tournaments/${tournamentId}/divisions`,{
    name:'Open Division', age_group:'Open', gender_category:'open', format:'single_elimination', max_roster_size:15,
    eligibility_requirements:'Valid ID or barangay certification; one active roster per team.'
  })).data.id };

  const barangays = ['Cogon','Linao','Can-adieng','Ipil','Valencia','San Antonio','Naungan','Punta'];
  let teams = (await api(organizer,'GET',`/tournaments/${tournamentId}/teams`)).data.teams;
  for (const [index, barangay] of barangays.entries()) {
    const teamName = `Barangay ${barangay}`;
    if (!teams.some(t => t.team_name === teamName)) {
      await api(organizer,'POST','/teams',{
        tournament_id:tournamentId, division_id:Number(division.id), team_name:teamName,
        short_name:barangay.slice(0,3).toUpperCase(), primary_color:['#CD2D17','#18181B','#D4A72C','#2563EB'][index%4],
        secondary_color:'#FFFFFF', coach_user_id:Number(coach.user.id), status:'registered'
      });
    }
  }
  teams = (await api(organizer,'GET',`/tournaments/${tournamentId}/teams`)).data.teams;

  const playerTeam = teams.find(t => t.team_name === 'Barangay Cogon');
  const roster = (await api(organizer,'GET',`/teams/${playerTeam.id}/players`)).data.players;
  let rosterPlayer = roster.find(p => Number(p.user_id) === Number(player.user.id));
  if (!rosterPlayer) {
    const invite = await api(coach,'POST','/eligibility/add-player',{
      team_id:Number(playerTeam.id), player_identifier:player.user.email, jersey_number:7, position:'Point Guard'
    });
    rosterPlayer = { id:invite.data.id, eligibility_status:'pending' };
  }
  if (rosterPlayer.eligibility_status === 'pending') {
    await api(player,'PUT',`/eligibility/invitations/${rosterPlayer.id}/respond`,{action:'accept'});
  }

  let bracket = await api(organizer,'GET',`/tournaments/${tournamentId}/bracket`);
  if (!(bracket.data?.matches?.length)) {
    bracket = await api(organizer,'POST',`/tournaments/${tournamentId}/bracket/generate`,{format:'single_elimination',shuffle:false});
  }
  await api(organizer,'POST',`/tournaments/${tournamentId}/schedule/auto`,{start_date:'2026-10-10',start_time:'08:00:00'});
  const conflicts = await api(organizer,'POST',`/tournaments/${tournamentId}/schedule/conflicts`,{});
  const count = ['court_clashes','team_clashes','venue_violations'].reduce((n,k)=>n+(conflicts.data?.[k]?.length||0),0);
  if (count === 0) await api(organizer,'POST',`/tournaments/${tournamentId}/schedule/publish`,{});

  const organizerView = await api(organizer,'GET','/tournaments');
  const adminView = await api(admin,'GET','/tournaments');
  const coachView = await api(coach,'GET','/teams');
  const playerView = await api(player,'GET','/eligibility/me');
  const publicView = await fetch(`${base}/public/tournaments/${tournamentId}`).then(r=>r.json());
  const schedule = await api(organizer,'GET',`/tournaments/${tournamentId}/schedule`);
  const result = {
    tournament_id:tournamentId, tournament:name, teams:teams.length,
    scheduled_games:schedule.data.schedule.filter(m=>m.scheduled_start_time).length, bracket_games:schedule.data.schedule.length, conflicts:count,
    organizer_can_see:organizerView.data.tournaments.some(t=>Number(t.id)===tournamentId),
    admin_can_see:adminView.data.tournaments.some(t=>Number(t.id)===tournamentId),
    coach_can_see_teams:coachView.data.teams.filter(t=>Number(t.tournament_id)===tournamentId).length,
    player_team:playerView.data.membership?.tournament_id == tournamentId ? playerView.data.membership.team_name : null,
    public_can_see:publicView.status === true,
  };
  console.log(JSON.stringify(result,null,2));
  if (!result.organizer_can_see || !result.admin_can_see || !result.public_can_see || result.teams < 8 || result.scheduled_games < 1) process.exit(2);
})().catch(error => { console.error(error.stack || error.message); process.exit(1); });
