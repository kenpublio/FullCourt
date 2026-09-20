import { Link, NavLink } from 'react-router-dom';
import courtDate from '../utils/courtDate';
import '../styles/public-court.css';

export function CourtNav() {
  return <nav className="court-nav court-container" aria-label="Main navigation">
    <Link to="/" className="court-brand"><span><i className="bi bi-dribbble" aria-hidden="true" /></span>FULLCOURT<span className="court-brand-dot">.</span></Link>
    <div className="court-nav-links"><NavLink to="/" end>Home</NavLink><NavLink to="/sports">Game center</NavLink><NavLink to="/sports/schedule">Schedule</NavLink></div>
    <div className="court-nav-account"><Link to="/login" className="court-signin">Sign in</Link><Link to="/register" className="court-button compact">Join now <i className="bi bi-arrow-up-right" aria-hidden="true"/></Link></div>
  </nav>;
}
export function CourtFooter() {
  return <footer className="court-footer-shell">
    <div className="court-footer-cta court-container">
      <div><span>READY FOR TIP-OFF?</span><h2>Run every game from one court.</h2><p>Teams, schedules, live scores, standings, and performance analytics—together in FullCourt.</p></div>
      <div className="court-footer-actions"><Link to="/register" className="court-button">Join FullCourt <i className="bi bi-arrow-up-right" /></Link><Link to="/sports" className="court-footer-secondary">Explore games <i className="bi bi-arrow-right" /></Link></div>
    </div>
    <div className="court-footer court-container">
      <div className="court-footer-brand">
        <Link to="/" className="court-brand"><span><i className="bi bi-dribbble" aria-hidden="true" /></span>FULLCOURT<span className="court-brand-dot">.</span></Link>
        <p>Basketball. Community. Every game.</p>
        <span className="court-footer-status"><i className="bi bi-broadcast-pin" /> Built for live basketball operations</span>
      </div>
      <div className="court-footer-links">
        <nav aria-label="Explore FullCourt"><b>Explore</b><Link to="/">Home</Link><Link to="/sports">Game center</Link><Link to="/login">Sign in</Link><Link to="/register">Create account</Link></nav>
        <nav aria-label="Legal information"><b>Trust &amp; Legal</b><Link to="/legal/privacy">Privacy</Link><Link to="/legal/terms">Terms</Link><Link to="/legal/cookies">Cookies</Link><Link to="/legal/accessibility">Accessibility</Link><Link to="/legal/claims">Claims</Link><Link to="/legal/responsible">Responsible use</Link></nav>
      </div>
    </div>
    <div className="court-footer-bottom court-container"><span>© {new Date().getFullYear()} FullCourt Basketball Management</span><span>One passion <i className="bi bi-dribbble" /> Every court <i className="bi bi-dribbble" /> One community</span></div>
  </footer>;
}
export function CourtEmpty({ children }) { return <div className="court-empty"><i className="bi bi-dribbble" aria-hidden="true"/><p>{children}</p></div>; }
export function CourtStatus({ status }) {
  const labels={in_progress:'Live',scheduled:'Scheduled',starting_soon:'Starting soon',halftime:'Halftime',delayed:'Delayed',postponed:'Postponed',cancelled:'Cancelled',completed:'Final',under_review:'Under review'};
  return <span className={`court-status ${['in_progress','ongoing','halftime'].includes(status) ? 'is-live' : ''}`}>{labels[status]||String(status||'Upcoming').replaceAll('_',' ')}</span>;
}
export function MatchCard({ match, sheet = false }) {
  const showScore = ['in_progress','completed'].includes(match.status);
  const apiBase = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8767/api';
  return <article className={`court-match ${match.status === 'in_progress' ? 'live-match' : ''}`}>
    <div className="court-match-top"><span>{match.tournament_name}</span><CourtStatus status={match.status}/></div>
    {[['team1_name','team1_score'],['team2_name','team2_score']].map(([name,score], index) => <div className="court-team" key={name}><span className={`court-team-avatar team-${index}`}>{(match[name] || 'TBD').slice(0,2).toUpperCase()}</span><strong>{match[name] || 'To be determined'}</strong><b>{showScore ? (match[score] ?? '–') : '–'}</b></div>)}
    <div className="court-match-meta"><span><i className="bi bi-clock"/> {courtDate(match.scheduled_start_time, true)}</span><span><i className="bi bi-geo-alt"/> {match.court_name || 'Court to be announced'}</span></div>
    <div className="court-match-bottom"><Link to={`/sports/games/${match.id}?tournament=${match.tournament_id}`}>{match.status==='in_progress'?'Watch live':'Game details'} <i className="bi bi-arrow-right"/></Link>{sheet && <a href={`${apiBase}/reports/matches/${match.id}/score-sheet.pdf`} aria-label={`Download score sheet for ${match.team1_name || 'team one'} vs ${match.team2_name || 'team two'}`}><i className="bi bi-file-earmark-pdf"/> Score sheet</a>}</div>
  </article>;
}
export function TournamentCard({ tournament, index = 0 }) {
  return <Link to={`/sports/tournaments/${tournament.id}`} className="court-tournament">
    <div className="court-tournament-cover"><span className="court-tournament-number">{String(index + 1).padStart(2,'0')}</span><i className="bi bi-trophy" aria-hidden="true"/><CourtStatus status={tournament.status}/><span className="court-tournament-sport">BASKETBALL / {String(tournament.format || 'Tournament').replaceAll('_',' ')}</span></div>
    <div className="court-tournament-body"><h3>{tournament.name}</h3><p>{tournament.description || 'Follow the teams, fixtures, standings, and results.'}</p><div className="court-tournament-facts"><span className="court-tournament-date"><i className="bi bi-calendar3"/> {courtDate(tournament.start_date)}</span>{tournament.end_date&&<span><i className="bi bi-flag"/> Ends {courtDate(tournament.end_date)}</span>}{tournament.team_count!=null&&<span><i className="bi bi-people"/> {tournament.team_count} teams</span>}</div><div className="court-tournament-link">Explore tournament <i className="bi bi-arrow-up-right"/></div></div>
  </Link>;
}
