import React, { useEffect, useMemo, useState } from "react";
import tournamentService from "../services/tournamentService";
import reportService from "../services/reportService";
import eligibilityService from "../services/eligibilityService";
import teamService from "../services/teamService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import "../styles/operations-polish.css";

const StandingsView = () => {
  const { user } = useAuth();
  const isPlayer = user?.role === "player";
  const isCoach = ["coach","coach_manager"].includes(user?.role);
  const [tournaments, setTournaments] = useState([]);
  const [tournamentId, setTournamentId] = useState("");
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [myTeamIds, setMyTeamIds] = useState([]);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const { tournaments = [] } = await tournamentService.getTournaments();
        if (isPlayer) {
          const membership = await eligibilityService.getMyMembership();
          const assignedId = membership?.membership?.tournament_id;
          const assigned = tournaments.find(t => String(t.id) === String(assignedId));
          if (membership?.membership?.team_id) setMyTeamIds([Number(membership.membership.team_id)]);
          setTournaments(assigned ? [assigned] : []);
          setTournamentId(assigned ? String(assigned.id) : "");
          return;
        }
        if (isCoach) {
          const teams = await teamService.getTeams();
          const registeredTeams = teams.filter(team => team.status === 'registered');
          const assignedIds = [...new Set(registeredTeams.map(team => String(team.tournament_id)))];
          const assignedTournaments = tournaments.filter(tournament => assignedIds.includes(String(tournament.id)));
          setMyTeamIds(registeredTeams.map(team => Number(team.id)));
          setTournaments(assignedTournaments);
          setTournamentId(current => assignedTournaments.some(tournament => String(tournament.id) === current) ? current : (assignedTournaments[0] ? String(assignedTournaments[0].id) : ""));
          return;
        }
        setTournaments(tournaments);
        if (tournaments[0]) setTournamentId(String(tournaments[0].id));
      } catch (error) {
        setLoadError(error.response?.data?.message || 'Could not load tournament information. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [isPlayer, isCoach, retryKey]);

  useEffect(() => {
    if (!tournamentId) { setStandings([]); return; }
    let current = true;
    setLoadError('');
    setLoading(true);
    reportService
      .getStandings(tournamentId)
      .then(rows => { if (current) setStandings(rows); })
      .catch(error => { if (current) { setStandings([]); setLoadError(error.response?.data?.message || 'Standings could not be loaded. Please try again.'); } })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [tournamentId, retryKey]);

  const rankDisplay = (rank) => {
    if (rank === 1)
      return (
        <span className="rank-medal" aria-label="First place">
          🥇
        </span>
      );
    if (rank === 2)
      return (
        <span className="rank-medal" aria-label="Second place">
          🥈
        </span>
      );
    if (rank === 3)
      return (
        <span className="rank-medal" aria-label="Third place">
          🥉
        </span>
      );
    return <span className="rank-number">{rank}</span>;
  };

  const rankRowClass = (rank) => {
    if (rank === 1) return "standings-row-gold";
    if (rank === 2) return "standings-row-silver";
    if (rank === 3) return "standings-row-bronze";
    return "";
  };
  const activeTournament = tournaments.find(t => String(t.id) === String(tournamentId));
  const myTeamIdSet = useMemo(() => new Set(myTeamIds.map(Number)), [myTeamIds]);
  const myTeamRows = standings.filter(team => myTeamIdSet.has(Number(team.team_id)));
  const completedGames = Math.round(standings.reduce((sum, team) => sum + Number(team.played || 0), 0) / 2);
  const tournamentLeader = standings[0];
  const myTeamRank = myTeamRows.length ? Number(myTeamRows[0].rank_position || standings.indexOf(myTeamRows[0]) + 1) : null;

  return (
    <div className="container-fluid p-0 page-enter ops-page standings-page">
      <div className={`ops-page-head standings-hero ${isCoach ? 'standings-hero-coach' : ''}`}>
        <div>
          <span className="ops-eyebrow">COMPETITION TABLE</span><h1 className="fw-bold mb-1">
            <i className="bi bi-list-ol text-evsu-primary me-2" />
            Tournament Standings
          </h1>
          <p className="text-muted small mb-0">
            {isCoach ? 'Track your team’s position against every team in its tournament.' : 'Current rankings based on finalized match results'}
          </p>
        </div>
        {isPlayer || isCoach ? <div className="standings-tournament-control">{tournaments.length > 1 ? <><label htmlFor="standings-tournament">My team competition</label><select id="standings-tournament" className="form-select" value={tournamentId} onChange={event => setTournamentId(event.target.value)}>{tournaments.map(tournament => <option key={tournament.id} value={tournament.id}>{tournament.name}</option>)}</select></> : <div className="ops-assigned-competition"><small>{isCoach?'MY TEAM COMPETITION':'MY COMPETITION'}</small><strong>{activeTournament?.name || "No team tournament yet"}</strong><span>{isCoach?'Showing the full tournament table':'Based on your verified roster'}</span></div>}</div> : <div className="standings-tournament-control"><label htmlFor="standings-tournament-admin">Standings for</label><select id="standings-tournament-admin"
          aria-label="Select tournament for standings"
          className="form-select"
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
        >
          {tournaments.length ? tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          )) : <option value="">No tournaments available</option>}
        </select></div>}
      </div>
      {!loading&&activeTournament&&<section className="standings-overview-grid" aria-label="Tournament standings overview">
        <article><span className="standings-overview-icon"><i className="bi bi-people-fill"/></span><div><small>Teams ranked</small><strong>{standings.length}</strong></div></article>
        <article><span className="standings-overview-icon"><i className="bi bi-calendar2-check-fill"/></span><div><small>Games completed</small><strong>{completedGames}</strong></div></article>
        <article><span className="standings-overview-icon leader"><i className="bi bi-trophy-fill"/></span><div><small>Current leader</small><strong className="standings-overview-name">{tournamentLeader?.team_name || '—'}</strong></div></article>
        <article className={myTeamRows.length ? 'my-team-standing-card' : ''}><span className={`standings-overview-icon ${myTeamRows.length ? 'mine' : ''}`}><i className={`bi ${myTeamRows.length ? 'bi-shield-fill-check' : 'bi-bar-chart-fill'}`}/></span><div><small>{myTeamRows.length ? 'Your team position' : 'Leader points'}</small><strong>{myTeamRows.length ? `#${myTeamRank}` : Number(tournamentLeader?.tournament_points || 0)}</strong></div></article>
      </section>}
      {loadError&&!loading ? <div className="ops-empty standings-empty"><i className="bi bi-wifi-off"/><strong>Standings unavailable</strong><p>{loadError}</p><button type="button" className="btn btn-evsu btn-sm" onClick={()=>setRetryKey(value=>value+1)}><i className="bi bi-arrow-clockwise me-2"/>Try again</button></div> : loading ? (
        <LoadingSpinner message="Loading standings..." />
      ) : !tournamentId ? <div className="ops-empty standings-empty"><i className="bi bi-trophy"/><strong>{isCoach||isPlayer?'No tournament is linked to your account yet.':'No tournaments available.'}</strong><p>{isCoach?'Once your team is approved into a tournament, its standings will appear here.':'Standings will appear when a tournament and teams are available.'}</p></div> : (
        <>
        <div className="standings-table-heading"><div><span className="ops-eyebrow">{activeTournament?.name || 'TOURNAMENT'}</span><h2>League table</h2><p>Rankings are calculated from finalized match results.</p></div>{myTeamRows[0]?<span className="standings-my-team-key"><i/> Your team highlighted</span>:<span className="standings-updated-note"><i className="bi bi-arrow-repeat"/> Updates after results are finalized</span>}</div>
        <div className="ops-table-shell table-responsive standings-desktop-table" role="region" aria-label="Tournament standings table" tabIndex={0}>
          <table className="table table-modern align-middle mb-0">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Team</th>
                <th>Played</th>
                <th>Won</th>
                <th>Lost</th>
                <th>Draw</th>
                <th>For</th>
                <th>Against</th>
                <th>Difference</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {standings.length ? (
                standings.map((s, i) => {
                  const rank = Number(s.rank_position || i + 1);
                  return (
                    <tr className={`${rankRowClass(rank)} ${myTeamIdSet.has(Number(s.team_id))?'standings-my-team-row':''}`} key={s.id || s.team_id}>
                      <td className="fw-bold text-center">
                        {rankDisplay(rank)}
                      </td>
                      <td className="fw-semibold">
                        <span className="standings-team-mark">
                          {s.team_name?.charAt(0) || "T"}
                        </span>
                        {s.team_name}{myTeamIdSet.has(Number(s.team_id))&&<span className="standings-you-tag">YOUR TEAM</span>}
                      </td>
                      <td>{s.played}</td>
                      <td className="text-success fw-semibold">{s.won}</td>
                      <td>{s.lost}</td>
                      <td>{s.drawn}</td>
                      <td>{s.points_scored}</td>
                      <td>{s.points_against}</td>
                      <td>{s.net_points}</td>
                      <td>
                        <span className="standings-points">
                          {s.tournament_points}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="10" className="text-center text-muted py-5">
                    <i className="bi bi-trophy display-5 d-block mb-2 opacity-25" />
                    No standings available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="standings-mobile-list" aria-label="Tournament standings">
          {standings.length ? standings.map((team,index)=>{const rank=Number(team.rank_position||index+1);const mine=myTeamIdSet.has(Number(team.team_id));return <article className={`standings-mobile-card ${mine?'is-mine':''}`} key={team.id||team.team_id}><div className="standings-mobile-rank">{rankDisplay(rank)}</div><div className="standings-mobile-main"><div className="standings-mobile-team">{team.team_name}{mine&&<span className="standings-you-tag">YOUR TEAM</span>}</div><small>{team.played} GP · {team.won} W · {team.lost} L · {team.drawn} D</small></div><div className="standings-mobile-points"><strong>{team.tournament_points}</strong><small>PTS</small></div><div className="standings-mobile-diff">{Number(team.net_points)>0?'+':''}{team.net_points}</div></article>;}) : <div className="ops-empty standings-empty"><i className="bi bi-bar-chart-line"/><strong>No standings published yet</strong><p>Rankings appear after finalized tournament games.</p></div>}
        </div>
        </>
      )}
    </div>
  );
};

export default StandingsView;
