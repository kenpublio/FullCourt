import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import eligibilityService from '../services/eligibilityService';
import LoadingSpinner from '../components/LoadingSpinner';
import reportService from '../services/reportService';
import tournamentService from '../services/tournamentService';
import scheduleService from '../services/scheduleService';
import basketballAnalyticsService from '../services/basketballAnalyticsService';
import MatchupPrediction from '../components/MatchupPrediction';

const Dashboard = () => {
  const { user } = useAuth();
  const role = user?.role || 'player';
  const roleLabel = ['platform_admin','admin'].includes(role) ? 'Platform Administrator' : role.replaceAll('_', ' ');
  const dashboardMode = ['platform_admin','admin'].includes(role) ? 'admin' : ['organization_admin','tournament_organizer'].includes(role) ? 'organizer' : 'player';
  const roleIntro = dashboardMode === 'admin'
    ? 'Monitor organizations, accounts, approvals, and basketball operations across FullCourt.'
    : dashboardMode === 'organizer'
      ? 'Run competitions, watch active courts, and keep every game operation moving.'
      : 'Your team, next matchup, performance, and tournament journey—together in one place.';
  const roleEyebrow = dashboardMode === 'admin' ? 'PLATFORM CONTROL' : dashboardMode === 'organizer' ? 'COMPETITION CONTROL' : 'PLAYER COURTSIDE';
  const primaryAction = dashboardMode === 'admin' ? ['/organizations','Review organizations'] : dashboardMode === 'organizer' ? ['/tournaments','Open tournaments'] : ['/schedules','View my schedule'];
  const quickActions = dashboardMode === 'admin' ? [
    ['Organizations','/organizations','bi-buildings-fill'],['Users & Roles','/users','bi-shield-lock-fill'],['Approvals','/eligibility','bi-patch-check-fill'],['System Reports','/reports','bi-file-earmark-bar-graph-fill'],
  ] : dashboardMode === 'organizer' ? [
    ['Create Tournament','/tournaments','bi-trophy-fill'],['Manage Teams','/teams','bi-people-fill'],['Schedules','/schedules','bi-calendar-event-fill'],['Live Operations','/live-scoring','bi-broadcast-pin'],
  ] : [
    ['My Performance','/player/performance','bi-graph-up-arrow'],['My Schedule','/schedules','bi-calendar2-event-fill'],['Standings','/standings','bi-list-ol'],['Notifications','/notifications','bi-bell-fill'],
  ];
  const [membership, setMembership] = useState(null);
  const [membershipLoading, setMembershipLoading] = useState(role === 'player');
  const [analytics, setAnalytics] = useState(null);
  const [matches, setMatches] = useState([]);
  const [upcomingMatch, setUpcomingMatch] = useState(null);
  const [liveGames, setLiveGames] = useState([]);
  const [activeTournament, setActiveTournament] = useState(null);
  const [tournamentSchedule, setTournamentSchedule] = useState([]);
  const hasTeamAccess = role !== 'player' || membership?.has_team;

  useEffect(() => {
    if (role !== 'player') return;
    eligibilityService.getMyMembership()
      .then(setMembership)
      .catch(() => setMembership({ has_team: false, membership: null }))
      .finally(() => setMembershipLoading(false));
  }, [role]);

  useEffect(() => {
    if (role === 'player') return;
    reportService.getAnalytics().then(setAnalytics).catch(() => setAnalytics(null));
    if (['platform_admin','admin','organization_admin','tournament_organizer'].includes(role)) {
      basketballAnalyticsService.dispatchReminders().catch(()=>null);
      const loadLive=()=>basketballAnalyticsService.liveGames().then(setLiveGames).catch(()=>setLiveGames([]));
      loadLive();const timer=setInterval(loadLive,5000);return()=>clearInterval(timer);
    }
  }, [role]);

  // Load today's match schedule for the relevant tournament.
  useEffect(() => {
    let cancelled = false;
    const loadMatches = async () => {
      try {
        let tournamentId = null;
        if (role !== 'player' && !tournamentId) {
          const res = await tournamentService.getTournaments();
          const t = res.tournaments?.[0];
          if (t) { tournamentId = t.id; if (!cancelled) setActiveTournament(t); }
        }
        if (role === 'player') {
          if (membership?.membership?.tournament_id) {
            tournamentId = membership.membership.tournament_id;
          } else {
            if (!cancelled) setMatches([]);
            return;
          }
        }
        if (!tournamentId) return;
        const schedule = await scheduleService.getSchedule(tournamentId);
        if (!cancelled) setTournamentSchedule(schedule || []);
        const today = new Date().toISOString().slice(0, 10);
        const playerTeamId = Number(membership?.membership?.team_id || 0);
        const eligibleUpcoming = (schedule || [])
          .filter(m => m.team1_id && m.team2_id)
          .filter(m => ['scheduled', 'in_progress'].includes(m.status))
          .filter(m => role !== 'player' || Number(m.team1_id) === playerTeamId || Number(m.team2_id) === playerTeamId)
          .sort((a, b) => new Date(a.scheduled_start_time || '2999') - new Date(b.scheduled_start_time || '2999'));
        if (!cancelled) setUpcomingMatch(eligibleUpcoming[0] || null);
        const mapped = (schedule || [])
          .filter(m => !m.scheduled_start_time || m.scheduled_start_time.slice(0, 10) === today)
          .map(m => ({
            id: m.id,
            time: m.scheduled_start_time ? new Date(m.scheduled_start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'TBA',
            sport: m.sport_name || 'Sport',
            stage: m.stage_name || `Round ${m.round_number || 1}`,
            teams: `${m.team1_name || 'TBD'} vs ${m.team2_name || 'TBD'}`,
            score: (m.team1_score != null && m.team2_score != null) ? `${m.team1_score} - ${m.team2_score}` : null,
            venue: m.venue_name || m.court_name || 'TBA',
            status: m.status?.replaceAll('_', ' ') || 'scheduled',
            statusCls: m.status === 'completed' ? 'bg-secondary' : m.status === 'in_progress' ? 'bg-danger' : 'bg-primary',
          }));
        if (!cancelled) setMatches(mapped);
      } catch {
        if (!cancelled) setMatches([]);
        if (!cancelled) setUpcomingMatch(null);
      }
    };
    loadMatches();
    return () => { cancelled = true; };
  }, [role, membership?.membership?.tournament_id, membership?.membership?.team_id]);

  const activityTotal = role === 'player'
    ? (membership?.has_team ? 1 : 0)
    : Number(analytics?.sports_breakdown?.reduce((sum, item) => sum + Number(item.team_count || 0), 0) || 0);

  const kpiCards = role === 'player' ? [
    { label: 'Team Status', value: membership?.has_team ? 'Active' : 'Waiting', icon: 'bi-shield-fill-check', cls: 'kpi-icon-red', trend: membership?.membership?.team_name || 'Awaiting a coach invitation' },
    { label: 'Tournament', value: membership?.has_team ? '1' : '0', icon: 'bi-trophy-fill', cls: 'kpi-icon-yellow', trend: membership?.membership?.tournament_name || 'No active tournament' },
    { label: 'Games Today', value: String(matches.length), icon: 'bi-calendar2-event-fill', cls: 'kpi-icon-blue', trend: matches.length ? 'See today’s schedule below' : 'No assigned game today' },
    { label: 'Eligibility', value: membership?.has_team ? 'Ready' : 'Pending', icon: 'bi-patch-check-fill', cls: 'kpi-icon-green', trend: membership?.has_team ? 'Roster membership active' : 'Complete your player profile' },
  ] : [
    { label: 'Active Tournaments', value: role === 'player' ? (membership?.has_team ? '1' : '0') : String(analytics?.metrics?.active_tournaments || 0), icon: 'bi-trophy-fill', cls: 'kpi-icon-red', trend: role === 'player' ? (membership?.membership?.tournament_name || 'No active tournament') : 'Upcoming and ongoing' },
    { label: 'Registered Teams', value: role === 'player' ? (membership?.has_team ? '1' : '0') : String(analytics?.metrics?.registered_teams || 0), icon: 'bi-people-fill', cls: 'kpi-icon-green', trend: role === 'player' ? (membership?.membership?.team_name || 'No team yet') : 'Approved payments' },
    { label: 'Verified Players', value: role === 'player' ? '0' : String(analytics?.metrics?.verified_players || 0), icon: 'bi-patch-check-fill', cls: 'kpi-icon-yellow', trend: 'Approved roster players' },
    { label: 'Active Games', value: role === 'player' ? '0' : String(analytics?.metrics?.active_games || 0), icon: 'bi-broadcast-pin', cls: 'kpi-icon-blue', trend: 'Live courtside operations' },
  ];
  const adminSnapshot = [
    ['Total Accounts', analytics?.metrics?.total_users || 0, 'bi-person-vcard-fill', '/users'],
    ['All Tournaments', analytics?.metrics?.total_tournaments || 0, 'bi-trophy-fill', '/tournaments'],
    ['Recorded Matches', analytics?.metrics?.total_matches || 0, 'bi-clipboard-data-fill', '/schedules'],
    ['Pending Eligibility', analytics?.metrics?.pending_eligibility || 0, 'bi-hourglass-split', '/eligibility'],
  ];

  const sportIcon = (sport) => {
    if (sport.toLowerCase().includes('basket'))  return 'bi-dribbble';
    if (sport.toLowerCase().includes('volley'))  return 'bi-arrow-up-circle-fill';
    if (sport.toLowerCase().includes('esport'))  return 'bi-controller';
    return 'bi-trophy';
  };

  if (role === 'player' && membershipLoading) {
    return <LoadingSpinner message="Checking your team membership..." />;
  }

  return (
    <div className={`container-fluid p-0 page-enter role-dashboard role-dashboard-${dashboardMode}`}>

      {/* ── Welcome Banner ── */}
      <div className="welcome-banner">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div className="role-hero-topline mb-3">
            <span className="role-hero-eyebrow"><i className="bi bi-dribbble" /> {roleEyebrow}</span>
            <span className="role-hero-live"><i /> SYSTEM ONLINE</span>
          </div>
          <h3 className="fw-bold text-white mb-1" style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}>
            Welcome back, {user?.full_name?.split(' ')[0] || 'User'}! 👋
          </h3>
          <p className="mb-2" style={{ color: 'rgba(255,255,255,0.72)', fontSize: '0.9rem' }}>
            Signed in as&nbsp;
            <span className="badge" style={{ background: 'rgba(244,196,48,0.25)', color: '#fde68a', border: '1px solid rgba(244,196,48,0.4)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.04em' }}>
              {roleLabel}
            </span>
            &nbsp;· FullCourt
          </p>
          <p className="role-dashboard-intro mb-0">{roleIntro}</p>
          <div className="role-hero-actions">
            <Link to={primaryAction[0]} className="role-hero-primary">{primaryAction[1]} <i className="bi bi-arrow-up-right" /></Link>
            <span className="role-hero-date"><i className="bi bi-calendar3" /> {new Date().toLocaleDateString('en-PH',{weekday:'short',month:'short',day:'numeric'})}</span>
          </div>
        </div>
        <div className="welcome-banner-trophy d-none d-md-block">
          <i className="bi bi-trophy-fill" />
        </div>
      </div>

      <nav className="role-quick-actions mb-4" aria-label={`${roleLabel} quick actions`}>
        {quickActions.map(([label,path,icon])=><Link to={path} key={label}><span><i className={`bi ${icon}`}/></span><b>{label}</b><i className="bi bi-arrow-up-right"/></Link>)}
      </nav>

      {!hasTeamAccess && (
        <div className="player-dashboard-notice mb-4">
          <div className="player-waiting-icon"><i className="bi bi-envelope-paper-heart" /></div>
          <div>
            <span className="player-status-pill"><i className="bi bi-clock-history" /> Not on a team yet</span>
            <h5 className="fw-bold mb-1">Your player dashboard is ready</h5>
            <p className="mb-0 text-muted small">When a coach invites you, accept it from Notifications to see team eligibility and your match schedule.</p>
          </div>
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div className="row g-3 mb-4 role-kpi-grid">
        {kpiCards.filter(kpi => hasTeamAccess || kpi.label !== 'Verified Players').map((kpi, i) => (
          <div key={i} className="col-12 col-sm-6 col-xl-3" style={{ animationDelay: `${i * 0.08}s` }}>
            <div className="kpi-card">
              <div className={`kpi-icon ${kpi.cls}`}>
                <i className={`bi ${kpi.icon}`} />
              </div>
              <div>
                <div className="kpi-card-label">{kpi.label}</div>
                <div className="kpi-card-value">{kpi.value}</div>
                <div className="kpi-card-trend">
                  <i className="bi bi-arrow-up-short" />{kpi.trend}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {dashboardMode === 'organizer' && activeTournament && (()=>{const total=tournamentSchedule.length,scheduled=tournamentSchedule.filter(game=>game.scheduled_start_time).length,completed=tournamentSchedule.filter(game=>game.status==='completed').length;const stages=[['Registration',Number(analytics?.metrics?.registered_teams||0)>0,'/teams','Teams and rosters'],['Eligibility',Number(analytics?.metrics?.verified_players||0)>0&&Number(analytics?.metrics?.pending_eligibility||0)===0,'/eligibility','Player clearance'],['Scheduling',total>0&&scheduled===total,'/schedules','Courts and game times'],['Competition',total>0&&completed===total,'/brackets','Bracket results'],['Awards',total>0&&completed===total,'/awards','MVP and Mythical Five']];return <section className="organizer-journey card-custom mb-4"><header><div><span>TOURNAMENT WORKFLOW</span><h5>{activeTournament.name}</h5><p>Follow each stage from registration to official awards.</p></div><Link to="/tournaments">Open tournament <i className="bi bi-arrow-up-right"/></Link></header><div className="organizer-stage-track">{stages.map(([label,done,path,description],index)=><Link className={done?'is-complete':'needs-action'} to={path} key={label}><i className={`bi ${done?'bi-check-circle-fill':'bi-circle'}`}/><small>STEP {index+1}</small><b>{label}</b><span>{description}</span></Link>)}</div><footer><span><b>{analytics?.metrics?.registered_teams||0}</b> teams</span><span><b>{analytics?.metrics?.verified_players||0}</b> verified players</span><span><b>{completed}/{total}</b> games completed</span>{Number(analytics?.metrics?.pending_eligibility||0)>0&&<Link to="/eligibility"><i className="bi bi-exclamation-circle"/> {analytics.metrics.pending_eligibility} eligibility reviews need attention</Link>}</footer></section>})()}

      {dashboardMode === 'admin' && <section className="admin-operations-grid mb-4" aria-label="Platform operations overview">
        <article className="card-custom admin-overview-card">
          <header><div><span className="admin-card-kicker">PLATFORM SNAPSHOT</span><h5>Operations at a glance</h5></div><i className="bi bi-activity" /></header>
          <div className="admin-snapshot-list">
            {adminSnapshot.map(([label,value,icon,path])=><Link to={path} key={label}><span><i className={`bi ${icon}`} /></span><div><small>{label}</small><strong>{value}</strong></div><i className="bi bi-chevron-right" /></Link>)}
          </div>
        </article>
        <article className="card-custom admin-overview-card">
          <header><div><span className="admin-card-kicker">GAME PIPELINE</span><h5>Match status</h5></div><Link to="/schedules">View schedule</Link></header>
          <div className="admin-status-list">
            {(analytics?.match_outcomes || []).map(item=><div key={item.status}><span className={`admin-status-dot status-${item.status}`} /><b>{String(item.status).replaceAll('_',' ')}</b><strong>{item.count}</strong></div>)}
            {!analytics?.match_outcomes?.length&&<div className="admin-empty-line"><i className="bi bi-calendar2-x" /> No recorded match activity yet.</div>}
          </div>
        </article>
        <article className="card-custom admin-overview-card">
          <header><div><span className="admin-card-kicker">LEAGUE PULSE</span><h5>Top-performing teams</h5></div><Link to="/standings">Standings</Link></header>
          <div className="admin-ranking-list">
            {(analytics?.top_teams || []).slice(0,4).map((team,index)=><div key={`${team.team_name}-${index}`}><span>{String(index+1).padStart(2,'0')}</span><div><b>{team.team_name}</b><small>{team.tournament_name}</small></div><strong>{team.tournament_points || 0}<small> PTS</small></strong></div>)}
            {!analytics?.top_teams?.length&&<div className="admin-empty-line"><i className="bi bi-bar-chart" /> Rankings appear after completed games.</div>}
          </div>
        </article>
      </section>}

      {['platform_admin','admin','organization_admin','tournament_organizer'].includes(role) && <div className="card-custom p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3"><div><h5 className="fw-bold mb-1"><i className="bi bi-broadcast-pin text-danger me-2"/>Multi-Court Command Center</h5><small className="text-muted">All active and today&apos;s published basketball games · refreshes every 5 seconds</small></div><span className="live-badge">{liveGames.filter(g=>g.status==='in_progress').length} LIVE</span></div>
        <div className="row g-3">{liveGames.map(g=><div className="col-md-6 col-xl-4" key={g.id}><div className={`border rounded-3 p-3 h-100 ${g.status==='in_progress'?'border-danger':''}`}><div className="d-flex justify-content-between"><small className="fw-bold text-muted">{g.court_name||g.venue_name||'Court TBA'}</small><span className={`badge ${g.status==='in_progress'?'bg-danger':'bg-primary'}`}>{g.status.replaceAll('_',' ')}</span></div><div className="d-flex justify-content-between align-items-center my-3"><b>{g.home_team||'TBD'}</b><span className="fs-4 fw-bold">{g.home_score}–{g.away_score}</span><b className="text-end">{g.away_team||'TBD'}</b></div><small>{g.current_period||'Pre-game'} · {Math.floor((g.timer_seconds||0)/60)}:{String((g.timer_seconds||0)%60).padStart(2,'0')} · {g.officials_ready} officials ready</small></div></div>)}{!liveGames.length&&<div className="col-12 text-center text-muted py-3">No active or scheduled games today.</div>}</div>
      </div>}

      {/* ── Charts Row ── */}
      <div className="row g-4 mb-4">
        <div className="col-12">
          <div className="card-custom dashboard-activity-card h-100">
            <div className="dashboard-section-head">
              <div className="kpi-icon kpi-icon-red dashboard-section-icon">
                <i className="bi bi-bar-chart-fill" />
              </div>
              <div>
                <span className="dashboard-section-kicker">COMPETITION OVERVIEW</span>
                <h5>{role === 'player' ? 'My Basketball Participation' : 'Basketball Competition Activity'}</h5>
                <small className="text-muted">{role === 'player' ? (membership?.has_team ? `Approved for ${membership.membership.team_name}` : 'No team membership yet') : 'Registered teams across active basketball tournaments'}</small>
              </div>
              <div className="dashboard-section-total"><i className="bi bi-people-fill" /><div><strong>{activityTotal}</strong>{' '}<span>{role === 'player' ? 'Active team' : 'Registered teams'}</span></div></div>
            </div>
            {activityTotal > 0 ? <div className="competition-activity-visual"><div className="competition-sport-mark"><span><i className="bi bi-dribbble" /></span><div><small>ACTIVE SPORT</small><h6>Basketball</h6><p>100% of FullCourt competition activity</p></div></div><div className="competition-meter"><div><span>Competition coverage</span><b>100%</b></div><div className="competition-meter-track"><i /></div><small>All registered teams are competing in basketball tournaments.</small></div><div className="competition-mini-stats"><div><strong>{activityTotal}</strong><span>Teams</span></div><div><strong>{role==='player'?(membership?.has_team?1:0):(analytics?.metrics?.active_tournaments||0)}</strong><span>Active tournaments</span></div><div><strong>{role==='player'?(membership?.has_team?1:0):(analytics?.metrics?.verified_players||0)}</strong><span>Verified players</span></div></div></div> : <div className="dashboard-empty-state compact"><span><i className="bi bi-dribbble" /></span><div><h6>Competition activity will appear here</h6><p>Add teams to an active tournament to begin tracking basketball participation.</p></div>{dashboardMode!=='player'&&<Link to="/teams">Manage teams <i className="bi bi-arrow-right" /></Link>}</div>}
          </div>
        </div>

      </div>

      {role === 'player' && hasTeamAccess && upcomingMatch && (
        <div className="mb-4"><MatchupPrediction matchId={upcomingMatch.id} title="Your Next Matchup" /></div>
      )}

      {/* ── Today's Matches ── */}
      {hasTeamAccess && <div className="card-custom dashboard-matches-card">
        <div className="dashboard-section-head">
          <div className="d-flex align-items-center gap-3">
            <div className="kpi-icon kpi-icon-blue dashboard-section-icon">
              <i className="bi bi-calendar2-event-fill" />
            </div>
            <div>
              <span className="dashboard-section-kicker">COURTSIDE SCHEDULE</span>
              <h5>Today&apos;s Matches</h5>
              <small className="text-muted">Published basketball courts and venues</small>
            </div>
          </div>
          <div className="dashboard-match-status"><span className="live-badge">{matches.filter(match=>match.status==='in progress').length} LIVE</span><Link to="/schedules">Full schedule <i className="bi bi-arrow-up-right" /></Link></div>
        </div>

        {matches.length > 0 ? <div className="table-responsive">
          <table className="table table-modern align-middle mb-0">
            <thead>
              <tr>
                <th>Time</th>
                <th>Sport</th>
                <th>Stage</th>
                <th>Teams</th>
                <th>Venue</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i}>
                  <td>
                    <span className="fw-bold" style={{ color: 'var(--evsu-primary)', fontFamily: 'var(--font-display)' }}>
                      {m.time}
                    </span>
                  </td>
                  <td>
                    <span className="d-flex align-items-center gap-1">
                      <i className={`bi ${sportIcon(m.sport)} text-muted`} />
                      {m.sport}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.82rem' }}>{m.stage}</td>
                  <td>
                    <span className="fw-semibold">{m.teams}</span>
                    {m.score && (
                      <span className="ms-2 badge" style={{ background: 'var(--evsu-gold)', color: 'var(--evsu-dark)', fontFamily: 'var(--font-display)', fontWeight: 800 }}>
                        {m.score}
                      </span>
                    )}
                  </td>
                  <td className="text-muted" style={{ fontSize: '0.83rem' }}>{m.venue}</td>
                  <td>
                    <span className={`badge ${m.statusCls}`} style={{ borderRadius: 6 }}>{m.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div> : <div className="dashboard-empty-state matches-empty"><span><i className="bi bi-calendar2-check" /></span><div><small>NO GAMES ON DECK</small><h6>The court is clear today</h6><p>Published games scheduled for today will appear here with their court, matchup, and live status.</p></div><Link to="/schedules">View all schedules <i className="bi bi-arrow-right" /></Link></div>}
      </div>}

    </div>
  );
};

export default Dashboard;
