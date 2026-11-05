const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.FULLCOURT_API_URL||'http://127.0.0.1:8767/api';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
const admin=sessions.find(row=>row.user.role==='platform_admin');const coach=sessions.find(row=>row.user.role==='coach');
if(!admin||!coach)throw new Error('Admin and Coach sessions are required.');
async function raw(route,{method='GET',body}={}){const response=await fetch(base+route,{method,headers:{Authorization:`Bearer ${admin.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const payload=await response.json();return{response,payload};}
async function api(route,options={}){const result=await raw(route,options);if(!result.response.ok)throw new Error(`${options.method||'GET'} ${route}: ${result.response.status} ${result.payload.message||''}`);return result.payload.data;}

(async()=>{
  const venueData=await api('/venues');const court=(venueData.venues||[]).flatMap(venue=>venue.courts||[]).find(row=>Number(row.is_available));if(!court)throw new Error('An available court is required.');
  const formats=[['single_elimination',5],['double_elimination',10],['round_robin',15],['group_stage',9],['league',15]];const created=[];const results=[];
  try{
    for(const [format,expectedGames] of formats){
      const stamp=Date.now()+created.length;const tournamentId=Number((await api('/tournaments',{method:'POST',body:{name:`Format Matrix ${format} ${stamp}`,format,start_date:'2026-12-10',end_date:'2026-12-20',registration_deadline:'2026-12-09',registration_fee:0,court_ids:[Number(court.id)]}})).id);created.push(tournamentId);
      const divisionId=Number((await api(`/tournaments/${tournamentId}/divisions`,{method:'POST',body:{name:'Open',age_group:'Open',gender_category:'open',format,max_roster_size:15}})).id);const ids=[];
      for(let i=1;i<=6;i++)ids.push(Number((await api('/teams',{method:'POST',body:{tournament_id:tournamentId,division_id:divisionId,team_name:`${format} Team ${i} ${stamp}`,short_name:`T${i}`,coach_user_id:Number(coach.user.id),status:'registered'}})).team_id));
      const generated=await api(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{team_ids:ids,format,groups:2,shuffle:false}});
      if(generated.bracket?.format!==format)throw new Error(`${format} saved as ${generated.bracket?.format||'unknown'}.`);
      await api(`/tournaments/${tournamentId}/schedule/auto`,{method:'POST',body:{start_date:'2026-12-10',start_time:'08:00:00'}});
      const completed=[];
      for(let pass=0;pass<40;pass++){
        const bracket=await api(`/tournaments/${tournamentId}/bracket`);const playable=bracket.matches.filter(match=>match.status==='scheduled'&&match.team1_id&&match.team2_id).sort((a,b)=>Number(a.round_number)-Number(b.round_number)||Number(a.match_number)-Number(b.match_number))[0];if(!playable)break;
        const home=10+(pass%5),away=5+(pass%3);await api(`/matches/${playable.id}/score`,{method:'POST',body:{team1_score:home,team2_score:away,current_period:'Q4',timer_seconds:0,is_timer_running:false}});await api(`/matches/${playable.id}/finalize`,{method:'POST',body:{winner_team_id:Number(playable.team1_id),team1_score:home,team2_score:away,expected_team1_score:home,expected_team2_score:away,current_period:'Q4',timer_seconds:0}});completed.push(Number(playable.id));
      }
      if(completed.length!==expectedGames)throw new Error(`${format}: expected ${expectedGames} completed games, received ${completed.length}.`);
      const final=await api(`/tournaments/${tournamentId}/bracket`);if(final.matches.some(match=>match.status==='scheduled'&&match.team1_id&&match.team2_id))throw new Error(`${format} still has playable unfinished matches.`);
      results.push({format,games_completed:completed.length,expected_games:expectedGames,passed:true});
    }
    console.log(JSON.stringify({all_formats_passed:true,formats:results},null,2));
  }finally{for(const id of created.reverse())await raw(`/tournaments/${id}`,{method:'DELETE'});}
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
