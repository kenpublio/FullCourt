const {execFileSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=process.env.FULLCOURT_API_URL||'http://127.0.0.1:8767/api';
const sessions=JSON.parse(execFileSync('php',[path.join(__dirname,'BrowserAuditSession.php')],{cwd:root,encoding:'utf8'}));
const admin=sessions.find(row=>row.user.role==='platform_admin');
const coach=sessions.find(row=>row.user.role==='coach');
if(!admin||!coach)throw new Error('Admin and Coach sessions are required.');

async function raw(route,{method='GET',body}={}){const response=await fetch(base+route,{method,headers:{Authorization:`Bearer ${admin.token}`,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});const payload=await response.json();return{response,payload};}
async function api(route,options={}){const result=await raw(route,options);if(!result.response.ok)throw new Error(`${options.method||'GET'} ${route}: ${result.response.status} ${result.payload.message||''}`);return result.payload.data;}

(async()=>{
  const stamp=Date.now();let tournamentId=0;
  try{
    const venueData=await api('/venues');
    const courts=(venueData.venues||[]).flatMap(venue=>(venue.courts||[]).filter(court=>Number(court.is_available)).map(court=>({...court,venue_name:venue.name})));
    if(courts.length<2)throw new Error('Two available courts are required for the venue-change rehearsal.');
    const original=courts[0],replacement=courts.find(court=>Number(court.id)!==Number(original.id));
    tournamentId=Number((await api('/tournaments',{method:'POST',body:{name:`Venue Change Rehearsal ${stamp}`,format:'single_elimination',start_date:'2026-12-20',end_date:'2026-12-20',registration_deadline:'2026-12-19',registration_fee:0,court_ids:[Number(original.id)],schedule_start_time:'08:00',schedule_end_time:'20:00',available_days:['sun']}})).id);
    const divisionId=Number((await api(`/tournaments/${tournamentId}/divisions`,{method:'POST',body:{name:'Open',age_group:'Open',gender_category:'open',format:'single_elimination',max_roster_size:15}})).id);
    for(const name of ['Venue Alpha','Venue Bravo'])await api('/teams',{method:'POST',body:{tournament_id:tournamentId,division_id:divisionId,team_name:`${name} ${stamp}`,short_name:name.slice(-5).toUpperCase(),coach_user_id:Number(coach.user.id),status:'registered'}});
    await api(`/tournaments/${tournamentId}/bracket/generate`,{method:'POST',body:{shuffle:false}});
    await api(`/tournaments/${tournamentId}/schedule/auto`,{method:'POST',body:{start_date:'2026-12-20',start_time:'08:00:00'}});
    await api(`/tournaments/${tournamentId}/schedule/publish`,{method:'POST',body:{}});
    const schedule=await api(`/tournaments/${tournamentId}/schedule`);
    const game=schedule.schedule[0];
    const changed=await api(`/matches/${game.id}/slot`,{method:'PUT',body:{scheduled_start_time:String(game.scheduled_start_time).replace(' ','T').slice(0,16),court_id:Number(replacement.id),reason:'Venue changed for court availability'}});
    const history=await api(`/tournaments/${tournamentId}/schedule/history`);
    const attached=await api(`/tournaments/${tournamentId}`);
    const tournamentCourts=(attached.courts||attached.tournament?.courts||[]).map(court=>Number(court.id||court.court_id));
    if(Number(changed.court_id)!==Number(replacement.id))throw new Error('Replacement court was not saved.');
    if(!(history.history||[]).some(row=>Number(row.new_court_id)===Number(replacement.id)))throw new Error('Venue change history was not recorded.');
    if(tournamentCourts.length&&!tournamentCourts.includes(Number(replacement.id)))throw new Error('Replacement court was not attached to the tournament.');
    console.log(JSON.stringify({venue_changed:true,from:`${original.venue_name} — ${original.court_name}`,to:`${replacement.venue_name} — ${replacement.court_name}`,history_recorded:true,participants_notified:Number(changed.participants_notified)>=1},null,2));
  }finally{if(tournamentId)await raw(`/tournaments/${tournamentId}`,{method:'DELETE'});}
})().catch(error=>{console.error(error);process.exit(1);});
