import { useMemo, useState } from 'react';
import { CourtNav, CourtFooter, CourtEmpty, TournamentCard } from '../components/PublicCourt';
import { useCourtData } from '../hooks/useCourtData';
export default function PublicSportsPortal() {
 const { data, loading, error, retry }=useCourtData();
 const [query,setQuery]=useState('');
 const [status,setStatus]=useState('all');
 const live=data.matches.filter(match=>match.status==='in_progress').length;
 const tournaments=useMemo(()=>data.tournaments.filter(tournament=>{
   const matchesSearch=[tournament.name,tournament.description,tournament.season,tournament.format].filter(Boolean).join(' ').toLowerCase().includes(query.trim().toLowerCase());
   const value=String(tournament.status||'upcoming').toLowerCase();
   return matchesSearch&&(status==='all'||(status==='live'?['ongoing','in_progress'].includes(value):value===status));
 }),[data.tournaments,query,status]);
 return <div className="court-site"><CourtNav/>
 <header className="court-center-header"><div className="court-container court-center-title"><div><span className="court-kicker">FullCourt / Game center</span><h1>Every game. Right here.</h1><p>Follow the scores, fixtures, and teams. No account needed.</p><a className="court-button compact mt-3" href="/sports/schedule"><i className="bi bi-calendar3"/> Open daily schedule</a></div><div className="court-center-count"><div><b>{loading||error?'–':live}</b><span>Live games</span></div><div><b>{loading||error?'–':data.tournaments.length}</b><span>Published tournaments</span></div></div></div></header>
 <main className="court-container">{error&&<div role="alert" className="court-error">{error}<button onClick={retry}>Try again</button></div>}
 <section className="court-section court-tournament-picker"><div className="court-section-heading"><div><span className="court-kicker">The competitions</span><h2>Pick a tournament. Follow the story.</h2><p>Select a competition to view its teams, complete game schedule, bracket, scores, and standings.</p></div></div><div className="court-picker-features" aria-label="Available tournament information">{[['bi-people-fill','Teams'],['bi-calendar-event','Schedules & Scores'],['bi-diagram-3-fill','Bracket View'],['bi-bar-chart-fill','Standings']].map(([icon,label])=><span key={label}><i className={'bi '+icon}/>{label}</span>)}</div>
 <div className="court-tournament-tools"><label className="court-tournament-search"><i className="bi bi-search"/><span className="visually-hidden">Search tournaments</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search tournaments"/></label><div className="court-status-filters" aria-label="Filter tournaments by status">{[['all','All'],['live','Live'],['upcoming','Upcoming'],['completed','Completed']].map(([value,label])=><button type="button" key={value} className={status===value?'active':''} aria-pressed={status===value} onClick={()=>setStatus(value)}>{label}</button>)}</div></div>
 <div className="court-grid">{loading?Array.from({length:3},(_,index)=><div className="court-tournament-skeleton" aria-hidden="true" key={index}><span/><span/><span/><span/></div>):tournaments.length?tournaments.map((tournament,index)=><TournamentCard key={tournament.id} tournament={tournament} index={index}/>):<CourtEmpty>{data.tournaments.length?'No tournaments match your search or filter.':'No public tournaments have been announced yet.'}</CourtEmpty>}</div></section>
 </main><CourtFooter/></div>;
}
