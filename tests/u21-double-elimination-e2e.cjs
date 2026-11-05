const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.FULLCOURT_API_URL||'http://127.0.0.1:8767/api';
const seed=()=>JSON.parse(execFileSync('php',[path.join(root,'backend/cli/seed_linao_inter_purok_u21.php')],{cwd:root,encoding:'utf8'}));
let fixture=seed();
async function raw(route,{method='GET',token,body}={}){const response=await fetch(base+route,{method,headers:{...(token?{Authorization:`Bearer ${token}`}:{}) ,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const payload=await response.json();return{response,payload};}
async function api(route,options={}){const result=await raw(route,options);if(!result.response.ok)throw new Error(`${options.method||'GET'} ${route}: ${result.response.status} ${result.payload.message||''}`);return result.payload.data;}

(async()=>{
  try{
    const login=await api('/auth/login',{method:'POST',body:{email:'platform.admin@fullcourt.local',password:fixture.password,portal:'admin'}});const token=login.token;
    const tournamentId=Number(fixture.tournament_id);
    const teamPayload=await api('/teams',{token});const teams=teamPayload.teams||teamPayload;
    const tournamentTeams=Array.isArray(teams)?teams.filter(team=>Number(team.tournament_id)===tournamentId):[];
    const teamIds=tournamentTeams.map(team=>Number(team.id));
    if(teamIds.length!==10)throw new Error(`Expected 10 U21 teams, found ${teamIds.length}.`);
    await api(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',token,body:{team_ids:teamIds,format:'double_elimination',shuffle:false}});
    let bracket=await api(`/tournaments/${tournamentId}/bracket`,{token});
    const stages=bracket.matches.map(match=>match.stage_name);
    if(!stages.some(stage=>stage.startsWith('Winners'))||!stages.some(stage=>stage.startsWith('Losers'))||!stages.includes('Grand Final')||!stages.includes('Grand Final Reset'))throw new Error('Complete double-elimination stages were not generated.');
    const opening=bracket.matches.filter(match=>match.stage_name==='Winners · Round 1'&&match.team1_id&&match.team2_id);
    const openingTeams=new Set(opening.flatMap(match=>[Number(match.team1_id),Number(match.team2_id)]));
    if(opening.length!==5||openingTeams.size!==10)throw new Error(`Opening round must contain five played matchups covering all ten teams; found ${opening.length} games and ${openingTeams.size} teams.`);
    if(bracket.matches.some(match=>match.stage_name==='Winners · Round 1'&&match.winner_team_id))throw new Error('Opening round contains an automatic winner before any game is played.');
    await api(`/tournaments/${tournamentId}/schedule/auto`,{method:'POST',token,body:{start_date:'2026-11-15',start_time:'08:00:00'}});
    const completed=[];
    for(let pass=0;pass<40;pass++){
      bracket=await api(`/tournaments/${tournamentId}/bracket`,{token});
      const playable=bracket.matches.filter(match=>match.status==='scheduled'&&match.team1_id&&match.team2_id).sort((a,b)=>Number(a.round_number)-Number(b.round_number)||Number(a.match_number)-Number(b.match_number))[0];
      if(!playable)break;
      await api(`/matches/${playable.id}/score`,{method:'POST',token,body:{team1_score:20,team2_score:10,current_period:'Q4',timer_seconds:0,is_timer_running:false}});
      await api(`/matches/${playable.id}/finalize`,{method:'POST',token,body:{winner_team_id:Number(playable.team1_id),team1_score:20,team2_score:10,expected_team1_score:20,expected_team2_score:10,current_period:'Q4',timer_seconds:0}});
      completed.push({id:Number(playable.id),stage:playable.stage_name,winner:Number(playable.team1_id),loser:Number(playable.team2_id)});
    }
    bracket=await api(`/tournaments/${tournamentId}/bracket`,{token});
    const grand=bracket.matches.find(match=>match.stage_name==='Grand Final');
    const reset=bracket.matches.find(match=>match.stage_name==='Grand Final Reset');
    if(grand?.status!=='completed'||!grand.winner_team_id)throw new Error('Grand Final did not complete.');
    if(reset?.status!=='cancelled')throw new Error('Grand Final Reset should cancel when the undefeated finalist wins.');
    const losses=new Map();for(const game of completed)losses.set(game.loser,(losses.get(game.loser)||0)+1);
    const champion=Number(grand.winner_team_id);
    if((losses.get(champion)||0)!==0)throw new Error('The undefeated champion unexpectedly has a loss.');
    const twiceEliminated=teamIds.filter(id=>(losses.get(id)||0)===2);
    if(twiceEliminated.length!==9)throw new Error(`${twiceEliminated.length}/9 non-champions received exactly two losses. Losses: ${JSON.stringify(Object.fromEntries(teamIds.map(id=>[id,losses.get(id)||0])))}; games=${JSON.stringify(completed)}`);
    if(completed.length!==18)throw new Error(`Expected 18 played games when no reset is needed, completed ${completed.length}.`);
    console.log(JSON.stringify({tournament:'Linao Inter-Purok Under 21',teams:10,opening_round_games:opening.length,all_teams_play_round_one:true,winners_bracket:true,losers_bracket:true,grand_final:true,conditional_reset:true,games_completed:completed.length,all_non_champions_lost_twice:true,schedule_optimizer_started:true},null,2));
  }finally{if(process.env.KEEP_U21_TEST!=='1')fixture=seed();}
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
