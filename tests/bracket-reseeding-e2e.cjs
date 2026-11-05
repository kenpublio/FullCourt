const { execFileSync } = require('node:child_process');
const path = require('node:path');

const root=path.resolve(__dirname,'..');
const apiBase=process.env.FULLCOURT_API_URL||'http://127.0.0.1:8767/api';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
const admin=sessions.find(item=>item.user.role==='platform_admin');
const coach=sessions.find(item=>item.user.role==='coach');
if(!admin||!coach)throw new Error('Admin or Coach rehearsal session is unavailable.');

async function raw(route,{method='GET',body}={}){
  const response=await fetch(apiBase+route,{method,headers:{Authorization:`Bearer ${admin.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
  const payload=await response.json();return{response,payload};
}
async function api(route,options={}){const result=await raw(route,options);if(!result.response.ok)throw new Error(`${options.method||'GET'} ${route}: ${result.response.status} ${result.payload.message||''}`);return result.payload.data;}

(async()=>{
  const run=Date.now();
  const venuePayload=await api('/venues');
  const venue=(venuePayload.venues||[]).find(row=>(row.courts||[]).some(court=>Number(court.is_available)));
  const court=venue?.courts?.find(row=>Number(row.is_available));
  if(!court)throw new Error('At least one available Main Court is required for the reseeding rehearsal.');
  const tournamentId=Number((await api('/tournaments',{method:'POST',body:{name:`Bracket Reseed Test ${run}`,format:'single_elimination',start_date:'2026-12-01',end_date:'2026-12-10',registration_fee:0,court_ids:[Number(court.id)]}})).id);
  try{
    const divisionId=Number((await api(`/tournaments/${tournamentId}/divisions`,{method:'POST',body:{name:'Test Division',age_group:'Open',gender_category:'open',format:'single_elimination',max_roster_size:15}})).id);
    const teamIds=[];
    for(const name of ['Alpha','Bravo','Charlie','Delta']){
      const data=await api('/teams',{method:'POST',body:{tournament_id:tournamentId,division_id:divisionId,team_name:`${name} ${run}`,short_name:name.slice(0,3).toUpperCase(),coach_user_id:Number(coach.user.id),status:'registered'}});
      teamIds.push(Number(data.team_id));
    }
    await api(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{team_ids:teamIds,shuffle:false}});
    const before=await api(`/tournaments/${tournamentId}/bracket`);
    const reversed=[...teamIds].reverse();
    await api(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{team_ids:reversed,shuffle:false}});
    const after=await api(`/tournaments/${tournamentId}/bracket`);
    const firstBefore=before.matches.filter(match=>Number(match.round_number)===1).sort((a,b)=>Number(a.match_number)-Number(b.match_number));
    const firstAfter=after.matches.filter(match=>Number(match.round_number)===1).sort((a,b)=>Number(a.match_number)-Number(b.match_number));
    if(Number(firstBefore[0].team1_id)!==teamIds[0]||Number(firstAfter[0].team1_id)!==reversed[0])throw new Error('Manual seed order did not change the opening placement.');
    const invalid=await raw(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{team_ids:[teamIds[0],teamIds[0]],shuffle:false}});
    if(invalid.response.status!==422)throw new Error(`Duplicate seed list should return 422, received ${invalid.response.status}.`);
    const opening=firstAfter[0];
    await api(`/matches/${opening.id}/score`,{method:'POST',body:{team1_score:2,team2_score:0,current_period:'Q1',timer_seconds:580,is_timer_running:false}});
    const locked=await raw(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{team_ids:teamIds,shuffle:false}});
    if(locked.response.status!==400||!/locked|started/i.test(locked.payload.message||''))throw new Error('Started bracket was not protected from reseeding.');
    console.log(JSON.stringify({manual_team_reordering:true,all_teams_required_once:true,opening_match_changed:true,started_game_lock:true,draft_regeneration_safe:true},null,2));
  }finally{
    await raw(`/tournaments/${tournamentId}`,{method:'DELETE'});
  }
})().catch(error=>{console.error(error.stack||error.message);process.exit(1);});
