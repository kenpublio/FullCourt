import { useEffect, useMemo, useState } from "react";
import gameOperationsService from "../services/gameOperationsService";
import scorekeeperService from "../services/scorekeeperService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import "../styles/operations-polish.css";

const statGroups = [
  [
    "Shooting",
    [
      ["2pt_made", "2PT Made"],
      ["2pt_missed", "2PT Miss"],
      ["3pt_made", "3PT Made"],
      ["3pt_missed", "3PT Miss"],
      ["ft_made", "FT Made"],
      ["ft_missed", "FT Miss"],
    ],
  ],
  [
    "Playmaking",
    [
      ["assist", "Assist"],
      ["turnover", "Turnover"],
      ["steal", "Steal"],
      ["block", "Block"],
    ],
  ],
  [
    "Rebounds",
    [
      ["off_rebound", "Off. Rebound"],
      ["def_rebound", "Def. Rebound"],
      ["personal_foul", "Personal Foul"],
    ],
  ],
];
const BasketballStatistician = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]),
    [match, setMatch] = useState(null),
    [board, setBoard] = useState(null),
    [players, setPlayers] = useState([]),
    [selected, setSelected] = useState(null),
    [subOut, setSubOut] = useState(""),
    [subIn, setSubIn] = useState(""),
    [loading, setLoading] = useState(true),
    [message, setMessage] = useState(""),
    [tournamentFilter, setTournamentFilter] = useState("all");
  const isStatistician = user?.role === "statistician";
  const statisticianAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.assignment_role === "statistician"),
    [assignments],
  );
  const tournamentNames = useMemo(
    () => [...new Set(statisticianAssignments.map((assignment) => assignment.tournament_name).filter(Boolean))],
    [statisticianAssignments],
  );
  const oversightRows = useMemo(
    () => statisticianAssignments.filter((assignment) => tournamentFilter === "all" || assignment.tournament_name === tournamentFilter),
    [statisticianAssignments, tournamentFilter],
  );
  useEffect(() => {
    gameOperationsService
      .assignments()
      .then((rows) => setAssignments(isStatistician ? rows.filter((row) => row.assignment_role === "statistician" && row.status === "accepted") : rows))
      .finally(() => setLoading(false));
  }, [isStatistician]);
  const open = async (assignment) => {
    setMatch(assignment);
    const [score, lineup] = await Promise.all([
      scorekeeperService.getScoreboard(assignment.match_id),
      gameOperationsService.lineup(assignment.match_id),
    ]);
    setBoard(score);
    setPlayers(lineup);
    setSelected(lineup[0] || null);
  };
  const refresh = async () => {
    if (!match) return;
    setBoard(await scorekeeperService.getScoreboard(match.match_id));
    setPlayers(await gameOperationsService.lineup(match.match_id));
  };
  const record = async (eventType) => {
    if (!selected || !board) return setMessage("Select a player first.");
    await gameOperationsService.recordStat(match.match_id, {
      event_uuid: crypto.randomUUID(),
      team_id: selected.team_id,
      team_player_id: selected.team_player_id,
      event_type: eventType,
      period:
        Number(String(board.score.current_period).replace(/\D/g, "")) || 1,
      game_clock_seconds: board.score.timer_seconds,
    });
    setMessage(
      `${eventType.replaceAll("_", " ")} recorded for ${selected.full_name}.`,
    );
    await refresh();
  };
  const toggleStarter = (id) =>
    setPlayers((rows) =>
      rows.map((p) =>
        p.team_player_id === id
          ? { ...p, is_starter: Number(!Number(p.is_starter)) }
          : p,
      ),
    );
  const confirm = async () => {
    const starters = players.filter((p) => Number(p.is_starter));
    if (starters.length !== 10)
      return setMessage(
        "Select exactly five starters for each team (10 total).",
      );
    const teamCounts = Object.values(
      starters.reduce(
        (a, p) => ({ ...a, [p.team_id]: (a[p.team_id] || 0) + 1 }),
        {},
      ),
    );
    if (teamCounts.some((n) => n !== 5))
      return setMessage("Each team must have exactly five starters.");
    for (const teamId of [...new Set(players.map((p) => p.team_id))])
      await gameOperationsService.confirmLineup(
        match.match_id,
        players.filter((p) => p.team_id === teamId),
      );
    setMessage("Both starting lineups confirmed.");
    await refresh();
  };
  const substitute = async () => {
    if (!subOut || !subIn)
      return setMessage("Select the player going out and the player going in.");
    try {
      await gameOperationsService.substitute(match.match_id, {
        player_out_id: Number(subOut),
        player_in_id: Number(subIn),
        period:
          Number(String(board.score.current_period).replace(/\D/g, "")) || 1,
        game_clock_seconds: board.score.timer_seconds,
      });
      setSubOut("");
      setSubIn("");
      setMessage("Substitution and player minutes recorded.");
      await refresh();
    } catch (e) {
      setMessage(e.response?.data?.message || "Unable to record substitution.");
    }
  };
  if (loading)
    return <LoadingSpinner message="Loading courtside assignments..." />;
  if (!isStatistician) {
    const uniqueGames = new Set(oversightRows.map((assignment) => assignment.match_id)).size;
    const accepted = oversightRows.filter((assignment) => assignment.status === "accepted").length;
    const pending = oversightRows.filter((assignment) => assignment.status === "pending").length;
    const active = new Set(oversightRows.filter((assignment) => assignment.match_status === "in_progress").map((assignment) => assignment.match_id)).size;
    return (
      <div className="container-fluid p-0 ops-page statistician-oversight-page">
        <div className="ops-page-head">
          <div><span className="ops-eyebrow">GAME DATA CONTROL</span><h3 className="fw-bold mb-1"><i className="bi bi-clipboard-data-fill text-evsu-primary me-2"/>Statistics Operations Oversight</h3><p className="text-muted small mb-0">Monitor assigned statisticians, courtside readiness, and game-statistics coverage across tournaments.</p></div>
          <select className="form-select" aria-label="Filter tournament" value={tournamentFilter} onChange={(event) => setTournamentFilter(event.target.value)}><option value="all">All tournaments</option>{tournamentNames.map((name) => <option value={name} key={name}>{name}</option>)}</select>
        </div>
        <section className="officials-command-grid" aria-label="Statistics operations summary">
          <article><span className="officials-stat-icon is-red"><i className="bi bi-calendar2-event"/></span><div><small>Covered games</small><strong>{uniqueGames}</strong><p>Games with statistician assignment</p></div></article>
          <article><span className="officials-stat-icon is-green"><i className="bi bi-person-check"/></span><div><small>Confirmed</small><strong>{accepted}</strong><p>Accepted statistician duties</p></div></article>
          <article><span className="officials-stat-icon is-gold"><i className="bi bi-hourglass-split"/></span><div><small>Needs response</small><strong>{pending}</strong><p>Pending confirmations</p></div></article>
          <article><span className="officials-stat-icon is-blue"><i className="bi bi-broadcast-pin"/></span><div><small>Live coverage</small><strong>{active}</strong><p>Games currently in progress</p></div></article>
        </section>
        <div className="ops-table-shell">
          <div className="stat-oversight-title"><div><span>STATISTICIAN COVERAGE</span><h5>Game assignments and courtside readiness</h5></div><span className="badge rounded-pill text-bg-dark">{oversightRows.length} assignments</span></div>
          <div className="table-responsive"><table className="table table-modern align-middle mb-0"><thead><tr><th>Game</th><th>Tournament</th><th>Statistician</th><th>Schedule & venue</th><th>Duty status</th><th>Game status</th></tr></thead><tbody>
            {oversightRows.map((assignment) => <tr key={assignment.id}><td><b>{assignment.home_team || "TBD"} vs {assignment.away_team || "TBD"}</b><small className="d-block text-muted">Game #{assignment.match_id}</small></td><td>{assignment.tournament_name}</td><td><i className="bi bi-person-badge me-2 text-evsu-primary"/>{assignment.assignee_name || "Not assigned"}</td><td>{assignment.scheduled_start_time ? new Date(assignment.scheduled_start_time).toLocaleString() : "Schedule pending"}<small className="d-block text-muted">{assignment.court_name || assignment.venue_name || "Court TBA"}</small></td><td><span className={`badge ${assignment.status === "accepted" ? "bg-success" : assignment.status === "declined" ? "bg-danger" : "bg-warning text-dark"}`}>{assignment.status}</span></td><td><span className="stat-game-status">{String(assignment.match_status || "scheduled").replaceAll("_", " ")}</span></td></tr>)}
            {!oversightRows.length && <tr><td colSpan="6"><div className="ops-empty border-0"><i className="bi bi-clipboard-x"/><strong>No statistician coverage found</strong><p>No statistician assignments are available for the selected tournament.</p></div></td></tr>}
          </tbody></table></div>
        </div>
        <div className="venue-role-notice"><i className="bi bi-shield-lock-fill"/><div><b>Administrator oversight mode</b><span>Only an assigned statistician can open the courtside console and record player events. Administrators monitor coverage and review submitted data.</span></div></div>
      </div>
    );
  }
  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between mb-4">
        <div>
          <h3 className="fw-bold mb-1">
            <i className="bi bi-clipboard-data-fill text-evsu-primary me-2" />
            Courtside Statistician
          </h3>
          <p className="text-muted small mb-0">
            Player-level shooting, rebounds, assists, defense, fouls, and
            offline-safe event IDs
          </p>
        </div>
        {board && (
          <span className="live-badge">
            {board.score.current_period} ·{" "}
            {Math.floor(board.score.timer_seconds / 60)}:
            {String(board.score.timer_seconds % 60).padStart(2, "0")}
          </span>
        )}
      </div>
      {message && <div className="alert alert-info py-2">{message}</div>}
      <div className="row g-4">
        <div className="col-lg-3">
          <div className="card-custom p-3">
            <h6 className="fw-bold">Assigned Games</h6>
            {assignments.map((a) => (
              <button
                className={`btn text-start w-100 border mb-2 ${match?.id === a.id ? "btn-evsu" : "btn-light"}`}
                key={a.id}
                onClick={() => open(a)}
              >
                <b>
                  {a.home_team || "TBD"} vs {a.away_team || "TBD"}
                </b>
                <small className="d-block">
                  {a.assignment_role} · {a.status}
                </small>
              </button>
            ))}
            {!assignments.length && (
              <p className="text-muted small">No assigned games.</p>
            )}
          </div>
        </div>
        <div className="col-lg-9">
          {!board ? (
            <div className="card-custom p-5 text-center text-muted">
              Select an assigned game to open the courtside console.
            </div>
          ) : (
            <>
              <div className="card-custom p-4 mb-3 text-center">
                <div className="row align-items-center">
                  <div className="col-5">
                    <h4 className="fw-bold">{board.score.team1_name}</h4>
                    <div className="display-2 fw-bold text-evsu-primary">
                      {board.score.team1_score}
                    </div>
                  </div>
                  <div className="col-2 text-muted">VS</div>
                  <div className="col-5">
                    <h4 className="fw-bold">{board.score.team2_name}</h4>
                    <div className="display-2 fw-bold text-evsu-primary">
                      {board.score.team2_score}
                    </div>
                  </div>
                </div>
              </div>
              <div className="card-custom p-3 mb-3">
                <div className="d-flex justify-content-between">
                  <h6 className="fw-bold">Lineup & Player Selection</h6>
                  <button
                    className="btn btn-outline-success btn-sm"
                    onClick={confirm}
                  >
                    Confirm Starting Fives
                  </button>
                </div>
                <div className="row g-2">
                  {players.map((p) => (
                    <div className="col-md-6" key={p.team_player_id}>
                      <div
                        className={`border rounded-3 p-2 d-flex align-items-center gap-2 ${selected?.team_player_id === p.team_player_id ? "border-warning bg-warning bg-opacity-10" : ""}`}
                        onClick={() => setSelected(p)}
                        role="button"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(Number(p.is_starter))}
                          onChange={() => toggleStarter(p.team_player_id)}
                          onClick={(e) => e.stopPropagation()}
                        />
                        <span className="badge bg-dark">
                          #{p.jersey_number || "—"}
                        </span>
                        <div>
                          <b>{p.full_name}</b>
                          <small className="d-block text-muted">
                            {p.team_name} · {p.position || "Player"}
                          </small>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {selected && (
                <div className="card-custom p-3">
                  <h5 className="fw-bold">
                    Recording for #{selected.jersey_number} {selected.full_name}
                  </h5>
                  <div className="border rounded-3 p-3 mb-3">
                    <div className="fw-bold small mb-2">Substitution & Minutes</div>
                    <div className="row g-2">
                      <div className="col-md-5"><select className="form-select form-select-sm" value={subOut} onChange={e=>{setSubOut(e.target.value);setSubIn('');}}><option value="">Player out (on court)</option>{players.filter(p=>Number(p.is_on_court)).map(p=><option value={p.team_player_id} key={p.team_player_id}>{p.full_name} · {Math.round((p.seconds_played||0)/6)/10} min</option>)}</select></div>
                      <div className="col-md-5"><select className="form-select form-select-sm" value={subIn} onChange={e=>setSubIn(e.target.value)}><option value="">Player in (bench)</option>{players.filter(p=>!Number(p.is_on_court)&&(!subOut||p.team_id===players.find(x=>String(x.team_player_id)===String(subOut))?.team_id)).map(p=><option value={p.team_player_id} key={p.team_player_id}>{p.full_name}</option>)}</select></div>
                      <div className="col-md-2"><button className="btn btn-warning btn-sm w-100" onClick={substitute}>Sub</button></div>
                    </div>
                  </div>
                  {statGroups.map((group) => (
                    <div className="mb-3" key={group[0]}>
                      <small className="text-uppercase fw-bold text-muted">
                        {group[0]}
                      </small>
                      <div className="d-flex flex-wrap gap-2 mt-2">
                        {group[1].map((action) => (
                          <button
                            className={`btn btn-sm ${action[0].includes("made") ? "btn-success" : action[0].includes("missed") ? "btn-outline-danger" : "btn-outline-dark"}`}
                            onClick={() => record(action[0])}
                            key={action[0]}
                          >
                            {action[1]}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
export default BasketballStatistician;
