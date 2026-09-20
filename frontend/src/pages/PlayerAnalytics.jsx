import React,{useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {useAuth} from '../hooks/useAuth';
import basketballAnalyticsService from '../services/basketballAnalyticsService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/performance-profiles.css';

const apiRoot=(import.meta.env.VITE_API_URL||'http://127.0.0.1:8767/api').replace(/\/api\/?$/,'');
const initials=name=>(name||'FC').split(' ').map(word=>word[0]).slice(0,2).join('').toUpperCase();

const PlayerAnalytics=()=>{
 const{id}=useParams();const{user}=useAuth();const[data,setData]=useState(null);const playerId=id||user?.id;
 useEffect(()=>{if(playerId)basketballAnalyticsService.player(playerId).then(setData);},[playerId]);
 if(!data)return <LoadingSpinner message="Preparing player performance..."/>;
 const p=data.profile;const avatar=p.avatar_url?(/^https?:\/\//.test(p.avatar_url)?p.avatar_url:`${apiRoot}/${p.avatar_url.replace(/^\//,'')}`):null;
 const cards=[
  {label:'Points / game',value:p.ppg,icon:'bi-bullseye'},{label:'Rebounds / game',value:p.rpg,icon:'bi-arrow-repeat'},
  {label:'Assists / game',value:p.apg,icon:'bi-diagram-3'},{label:'Minutes played',value:p.minutes_played||0,icon:'bi-stopwatch'},
  {label:'Field goal',value:`${p.fg_pct}%`,icon:'bi-circle'},{label:'Three point',value:`${p.three_pct}%`,icon:'bi-3-circle'},
  {label:'Free throw',value:`${p.ft_pct}%`,icon:'bi-record-circle'},{label:'Steals / blocks',value:`${p.steals||0} / ${p.blocks||0}`,icon:'bi-shield-check'}
 ];
 return <main className="performance-page">
  <section className="performance-hero player-hero">
   <div className="performance-identity"><div className="performance-photo">{avatar?<img src={avatar} alt={p.full_name}/>:initials(p.full_name)}</div><div><span className="performance-kicker"><i className="bi bi-lightning-charge-fill"/> Player performance</span><h1>{p.full_name}</h1><p>{p.primary_position||'Basketball Player'}</p><div className="performance-tags"><span><i className="bi bi-controller"/> {p.games_played||0} games</span>{p.height_cm&&<span><i className="bi bi-rulers"/> {p.height_cm} cm</span>}<span><i className="bi bi-shield-check"/> FIBA statistics</span></div></div></div>
   <div className="player-feature"><span>PER GAME IMPACT</span><strong>{p.ppg}<small> PTS</small></strong><p>{p.rpg} rebounds · {p.apg} assists</p></div>
  </section>
  <section className="performance-stat-grid player-stats">{cards.map(stat=><article key={stat.label}><span><i className={`bi ${stat.icon}`}/></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div></article>)}</section>
  <aside className="standards-note"><i className="bi bi-patch-check-fill"/><div><strong>{data.statistics_standard?.name}</strong><p>{data.statistics_standard?.note}</p></div></aside>
  <section className="performance-panel"><header><div><span>GAME LOG</span><h2>Recent performance</h2></div><i className="bi bi-activity"/></header>
   {data.last_five?.length?<div className="player-game-list">{data.last_five.map(game=><article key={game.id}><div className="game-date"><strong>{new Date(game.scheduled_start_time).toLocaleDateString(undefined,{day:'2-digit'})}</strong><span>{new Date(game.scheduled_start_time).toLocaleDateString(undefined,{month:'short'})}</span></div><div className="game-team"><strong>{game.team_name}</strong><span>{game.minutes_played||0} minutes</span></div><div className="game-metrics"><span><b>{game.points||0}</b> PTS</span><span><b>{game.rebounds||0}</b> REB</span><span><b>{game.assists||0}</b> AST</span></div></article>)}</div>:<div className="performance-empty"><i className="bi bi-person-workspace"/><strong>No finalized statistics yet</strong><p>This player’s game-by-game performance will appear after recorded games are finalized.</p></div>}
  </section>
 </main>;
};
export default PlayerAnalytics;
