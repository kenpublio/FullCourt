const { execFileSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const apiBase = process.env.API_URL || 'http://127.0.0.1:8767/api';
const sessions = JSON.parse(execFileSync('php', [path.join(__dirname, 'BrowserAuditSession.php')], { cwd: root, encoding: 'utf8' }));
const coach = sessions.find(item => item.user.role === 'coach');
const admin = sessions.find(item => item.user.role === 'platform_admin');

async function request(route, session, options={}) {
  const response=await fetch(apiBase+route,{method:options.method||'GET',headers:{Authorization:`Bearer ${session.token}`,...(options.body?{'Content-Type':'application/json'}:{})},body:options.body?JSON.stringify(options.body):undefined});
  const payload=await response.json().catch(()=>({}));return{response,payload,data:payload?.data};
}

(async()=>{
  const teams=(await request('/teams',coach)).data?.teams||[];
  let fixture=null;
  for(const team of teams){const schedule=(await request(`/tournaments/${team.tournament_id}/schedule`,coach)).data?.schedule||[];const match=schedule.find(row=>[Number(row.team1_id),Number(row.team2_id)].includes(Number(team.id))&&!['completed','cancelled'].includes(row.status));if(match){fixture={team,match};break;}}
  if(!fixture)throw new Error('Coach has no upcoming assigned-team game for availability verification.');
  const lineup=(await request(`/matches/${fixture.match.id}/lineup`,coach)).data?.players?.filter(row=>Number(row.team_id)===Number(fixture.team.id))||[];
  if(lineup.length<4)throw new Error('At least four roster players are required for availability verification.');
  const statuses=['available','absent','injured','suspended'];
  const entries=lineup.map((player,index)=>({team_player_id:Number(player.team_player_id),status:statuses[index]||'available'}));
  try{
    const saved=await request(`/matches/${fixture.match.id}/availability`,coach,{method:'PUT',body:{team_id:Number(fixture.team.id),players:entries}});
    if(!saved.response.ok||Number(saved.data?.saved)!==entries.length)throw new Error(`Coach availability save failed: ${saved.payload?.message||saved.response.status}`);
    const adminLineup=(await request(`/matches/${fixture.match.id}/lineup`,admin)).data?.players||[];
    for(let index=0;index<4;index++){const row=adminLineup.find(player=>Number(player.team_player_id)===entries[index].team_player_id);if(row?.availability_status!==statuses[index])throw new Error(`${statuses[index]} did not reach the game lineup.`);if(statuses[index]!=='available'&&Number(row.is_present)!==0)throw new Error(`${statuses[index]} player was not excluded from scoring presence.`);}
    const opponentId=Number(fixture.match.team1_id)===Number(fixture.team.id)?Number(fixture.match.team2_id):Number(fixture.match.team1_id);
    const denied=await request(`/matches/${fixture.match.id}/availability`,coach,{method:'PUT',body:{team_id:opponentId,players:[]}});
    if(denied.response.status!==403)throw new Error('Coach was allowed to change the opponent availability.');
    console.log(JSON.stringify({match_id:fixture.match.id,team:fixture.team.team_name,available:true,absent:true,injured:true,suspended:true,scoring_lineup_connected:true,opponent_scope_blocked:true},null,2));
  }finally{
    await request(`/matches/${fixture.match.id}/availability`,coach,{method:'PUT',body:{team_id:Number(fixture.team.id),players:lineup.map(player=>({team_player_id:Number(player.team_player_id),status:'available'}))}});
  }
})().catch(error=>{console.error(error.stack||error);process.exit(1);});
