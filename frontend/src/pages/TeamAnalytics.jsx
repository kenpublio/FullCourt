import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import basketballAnalyticsService from '../services/basketballAnalyticsService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/performance-profiles.css';

const apiRoot=(import.meta.env.VITE_API_URL||'http://127.0.0.1:8767/api').replace(/\/api\/?$/,'');
const initials=name=>(name||'FC').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase();

const TeamAnalytics=()=>{
 const{teamId}=useParams();const[data,setData]=useState(null);
 useEffect(()=>{basketballAnalyticsService.team(teamId).then(setData);},[teamId]);
 if(!data)return <LoadingSpinner message="Preparing team performance..."/>;
 const team=data.team;const logo=team.logo_url?(/^https?:\/\//.test(team.logo_url)?team.logo_url:`${apiRoot}/${team.logo_url.replace(/^\//,'')}`):null;
 const stats=[
  {label:'Games played',value:team.games_played||0,icon:'bi-calendar2-check'},
  {label:'Wins',value:team.wins||0,icon:'bi-trophy'},
  {label:'Losses',value:team.losses||0,icon:'bi-graph-down-arrow'},
  {label:'Points per game',value:team.scoring_average||0,icon:'bi-bullseye'},
  {label:'Points allowed',value:team.opponent_average||0,icon:'bi-shield'},
  {label:'Point differential',value:Number(team.point_differential)>0?`+${team.point_differential}`:team.point_differential||0,icon:'bi-plus-slash-minus'}
 ];
 return <main className="performance-page">
  <section className="performance-hero" style={{'--team-accent':team.primary_color||'#e3331b'}}>
   <div className="performance-identity">
    <div className="performance-photo team-logo">{logo?<img src={logo} alt={`${team.team_name} logo`}/>:initials(team.team_name)}</div>
    <div><span className="performance-kicker"><i className="bi bi-bar-chart-line-fill"/> Team performance</span><h1>{team.team_name}</h1><p>{team.tournament_name||'FullCourt Tournament'}{team.division_name?` · ${team.division_name}`:''}</p><div className="performance-tags"><span><i className="bi bi-person-badge"/> Coach {team.coach_name||'Not assigned'}</span><span><i className="bi bi-people"/> {team.verified_players||0}/{team.roster_count||0} verified</span></div></div>
   </div>
   <div className="win-rate"><strong>{team.win_rate||0}%</strong><span>WIN RATE</span><div><i style={{width:`${Math.min(100,team.win_rate||0)}%`}}/></div><small>{team.wins||0} wins · {team.losses||0} losses</small></div>
  </section>
  <section className="performance-stat-grid">{stats.map(stat=><article key={stat.label}><span><i className={`bi ${stat.icon}`}/></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div></article>)}</section>
  <section className="performance-panel"><header><div><span>RECENT FORM</span><h2>Last five completed games</h2></div><i className="bi bi-clock-history"/></header>
   {data.recent_games?.length?<div className="recent-game-list">{data.recent_games.map(game=><article key={game.id}><span className={`result-badge ${Number(game.winner_team_id)===Number(team.id)?'win':'loss'}`}>{Number(game.winner_team_id)===Number(team.id)?'W':'L'}</span><div><strong>vs {game.opponent}</strong><small>{new Date(game.scheduled_start_time).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'})}</small></div><b>{game.team_score} <em>–</em> {game.opponent_score}</b></article>)}</div>:<div className="performance-empty"><i className="bi bi-clipboard2-data"/><strong>No completed games yet</strong><p>Results and team form will appear here after the first finalized game.</p></div>}
  </section>
 </main>;
};
export default TeamAnalytics;
