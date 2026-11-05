import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import publicService from "../services/publicService";
import {
  CourtEmpty,
  CourtFooter,
  CourtNav,
  CourtStatus,
} from "../components/PublicCourt";
import courtDate from "../utils/courtDate";
import "../styles/public-game.css";
import "../styles/game-pregame.css";
import "../styles/match-insights.css";
import "../styles/period-scores.css";

const gameClock = (seconds) =>
  `${String(Math.floor(Number(seconds || 0) / 60)).padStart(2, "0")}:${String(Number(seconds || 0) % 60).padStart(2, "0")}`;

export default function PublicGameDetails() {
  const { gameId } = useParams();
  const [params] = useSearchParams();
  const tournamentId = params.get("tournament");
  const [game, setGame] = useState(null),
    [score, setScore] = useState(null),
    [details, setDetails] = useState({
      events: [],
      fouls: [],
      timeouts: [],
      box_score: [],
      period_scores: [],
    }),
    [pregame, setPregame] = useState({
      lineup: [],
      officials: [],
      comparison: {},
    }),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState(null);
  const [boxScoreTeam, setBoxScoreTeam] = useState("team1");
  useEffect(() => {
    let active = true;
    const loadGame = async () => {
      try {
        const info = await publicService.getMatchDetails(gameId);
        if (active) {
          setGame(info.game);
          setPregame({
            lineup: info.lineup || [],
            officials: info.officials || [],
            comparison: info.comparison || {},
          });
        }
      } catch {
        if (!tournamentId) return;
        try {
          const data = await publicService.getTournament(tournamentId);
          if (active)
            setGame(
              (data.schedule || []).find(
                (item) => String(item.id) === String(gameId),
              ) || null,
            );
        } catch {
          /* Game shell remains usable without metadata. */
        }
      }
    };
    const loadScore = async () => {
      try {
        const data = await publicService.getLiveMatch(gameId);
        if (active) {
          setScore(data.score);
          setDetails({
            events: data.events || [],
            fouls: data.fouls || [],
            timeouts: data.timeouts || [],
            box_score: data.box_score || [],
            period_scores: data.period_scores || [],
          });
          setUpdated(new Date());
        }
      } catch {
        if (active) setScore(null);
      } finally {
        if (active) setLoading(false);
      }
    };
    loadGame();
    loadScore();
    const timer = setInterval(loadScore, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [gameId, tournamentId]);
  const display = useMemo(
    () => ({
      team1: score?.team1_name || game?.team1_name || "Team One",
      team2: score?.team2_name || game?.team2_name || "Team Two",
      score1: score?.team1_score ?? game?.team1_score ?? 0,
      score2: score?.team2_score ?? game?.team2_score ?? 0,
      status: score?.match_status || game?.status || "scheduled",
    }),
    [score, game],
  );
  const gameLeaders = useMemo(() => {
    const players = details.box_score || [];
    const top = (key) => [...players].sort((a, b) => Number(b[key] || 0) - Number(a[key] || 0))[0];
    return [
      { label: "Points", key: "points", player: top("points") },
      { label: "Rebounds", key: "rebounds", player: top("rebounds") },
      { label: "Assists", key: "assists", player: top("assists") },
      { label: "Steals", key: "steals", player: top("steals") },
      { label: "Blocks", key: "blocks", player: top("blocks") },
    ];
  }, [details.box_score]);
  const comparison = pregame.comparison || {};
  const home = comparison.team1 || {}, away = comparison.team2 || {}, head = comparison.head_to_head || {};
  const selectedBoxTeamId = boxScoreTeam === "team1" ? score?.team1_id || game?.team1_id : score?.team2_id || game?.team2_id;
  const selectedBoxPlayers = details.box_score.filter((player) => Number(player.team_id) === Number(selectedBoxTeamId));
  return (
    <div className="court-site public-game-page">
      <CourtNav />
      <main className="game-stage">
        <div className="court-container">
          <Link
            className="game-back"
            to={
              tournamentId ? `/sports/tournaments/${tournamentId}` : "/sports"
            }
          >
            <i className="bi bi-arrow-left" /> Back to tournament
          </Link>
          {loading ? (
            <CourtEmpty>Preparing the game scoreboard…</CourtEmpty>
          ) : (
            <>
              <header className="game-stage-head">
                <div>
                  <span className="court-kicker">FullCourt / Game center</span>
                  <h1>{game?.stage_name || "Official Game Scoreboard"}</h1>
                  <p>{game?.tournament_name || "Live basketball coverage"}</p>
                </div>
                <div className="game-live-state">
                  <CourtStatus status={display.status} />
                  <small>
                    {updated
                      ? `Updated ${updated.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit", second: "2-digit" })}`
                      : "Waiting for live updates"}
                  </small>
                </div>
              </header>
              <section
                className={`game-scoreboard ${display.status === "in_progress" ? "is-live" : ""}`}
                aria-label={`${display.team1} versus ${display.team2}`}
              >
                <div className="game-board-top">
                  <span>
                    {display.status === "in_progress" ? (
                      <>
                        <i className="bi bi-broadcast" /> LIVE GAME
                      </>
                    ) : (
                      "OFFICIAL MATCH CENTER"
                    )}
                  </span>
                  <b>FULLCOURT</b>
                </div>
                <div className="game-board-main">
                  <article>
                    <span className="game-team-mark">
                      {display.team1
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <h2>{display.team1}</h2>
                    <small>HOME</small>
                  </article>
                  <div className="game-score">
                    <span>{display.score1}</span>
                    <i>–</i>
                    <span>{display.score2}</span>
                    <div className="game-clock">
                      <b>{score?.current_period || "PRE-GAME"}</b>
                      <strong>{gameClock(score?.timer_seconds)}</strong>
                      {score?.is_timer_running == 1 && (
                        <small>
                          <i className="bi bi-circle-fill" /> CLOCK RUNNING
                        </small>
                      )}
                    </div>
                  </div>
                  <article>
                    <span className="game-team-mark away">
                      {display.team2
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((word) => word[0])
                        .join("")}
                    </span>
                    <h2>{display.team2}</h2>
                    <small>AWAY</small>
                  </article>
                </div>
                <footer>
                  <span>
                    <i className="bi bi-calendar3" />{" "}
                    {courtDate(game?.scheduled_start_time, true)}
                  </span>
                  <span>
                    <i className="bi bi-geo-alt" />{" "}
                    {[game?.venue_name, game?.court_name]
                      .filter(Boolean)
                      .join(" • ") || "Venue to be announced"}
                  </span>
                </footer>
              </section>
              {score && (
                <section className="game-period-breakdown" aria-labelledby="period-score-title">
                  <header>
                    <div><span>SCORING BY PERIOD</span><h2 id="period-score-title">Quarter breakdown</h2></div>
                    <small>Official live totals</small>
                  </header>
                  <div className="game-period-scroll">
                    <table>
                      <thead><tr><th>Team</th>{details.period_scores.map((period) => <th key={period.label}>{period.label}</th>)}<th>T</th></tr></thead>
                      <tbody>
                        <tr><th>{display.team1}</th>{details.period_scores.map((period) => <td key={period.label}>{period.team1_score}</td>)}<td><strong>{display.score1}</strong></td></tr>
                        <tr><th>{display.team2}</th>{details.period_scores.map((period) => <td key={period.label}>{period.team2_score}</td>)}<td><strong>{display.score2}</strong></td></tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
              {!score && (
                <div className="game-waiting">
                  <i className="bi bi-hourglass-split" />
                  <div>
                    <b>Live scoring has not started yet.</b>
                    <span>
                      This page will update automatically when the official
                      scorer opens the game.
                    </span>
                  </div>
                </div>
              )}
              <section className="game-pregame">
                <header>
                  <div>
                    <span>STARTING FIVE</span>
                    <h2>Team lineups</h2>
                  </div>
                  <i className="bi bi-people-fill" />
                </header>
                <div className="game-team-lineups">
                  {[display.team1, display.team2].map((teamName, teamIndex) => {
                    const starters = pregame.lineup.filter((player) => player.is_starter == 1 && player.team_name === teamName);
                    return <article key={teamName} className={teamIndex === 1 ? "away" : ""}>
                      <header><span>{teamIndex === 0 ? "HOME" : "AWAY"}</span><h3>{teamName}</h3><small>{starters.length}/5 confirmed</small></header>
                      {starters.length ? <div className="game-lineup-list">{starters.map((player) => <div key={`${player.team_name}-${player.full_name}`}>
                        <span>#{player.jersey_number || "–"}</span><b>{player.full_name}</b><small>{player.position || "Player"}</small>
                      </div>)}</div> : <p>Starting five will appear after the team confirms its lineup.</p>}
                    </article>;
                  })}
                </div>
              </section>
              <section className="match-comparison">
                <header><div><span>NBA-STYLE MATCHUP</span><h2>Season snapshot</h2></div><small>{head.meetings || 0} recorded matchup{Number(head.meetings) === 1 ? '' : 's'}</small></header>
                <div className="comparison-teams">
                  <article><b>{display.team1}</b><strong>{home.win_rate || 0}%</strong><span>WIN RATE</span><em>Record {home.wins || 0}–{home.losses || 0}</em></article>
                  <div className="comparison-metrics"><div><span>{home.points_per_game || 0}</span><b>POINTS / GAME</b><span>{away.points_per_game || 0}</span></div><div><span>{home.points_allowed || 0}</span><b>POINTS ALLOWED</b><span>{away.points_allowed || 0}</span></div><div><span>{head.team1_wins || 0}</span><b>H2H WINS</b><span>{head.team2_wins || 0}</span></div></div>
                  <article className="away"><b>{display.team2}</b><strong>{away.win_rate || 0}%</strong><span>WIN RATE</span><em>Record {away.wins || 0}–{away.losses || 0}</em></article>
                </div><p className="comparison-note"><i className="bi bi-info-circle" /> Based only on completed official games recorded in FullCourt.</p>
              </section>
              {details.box_score.length > 0 && <section className="game-leaders"><header><div><span>ON-COURT IMPACT</span><h2>Game leaders</h2></div><i className="bi bi-stars" /></header><div>{gameLeaders.map((item) => <article key={item.label}><span>{item.label}</span><strong>{item.player?.[item.key] || 0}</strong><b>{item.player?.full_name || "No player data"}</b><small>{item.player?.team_name || "Official statistics"}</small></article>)}</div></section>}
              {score && (
                <section className="game-detail-panels">
                  <article className="game-box-score">
                    <header>
                      <div>
                        <span>OFFICIAL STATISTICS</span>
                        <h2>Box score</h2>
                      </div>
                      <i className="bi bi-bar-chart-fill" />
                    </header>
                    <div className="game-box-team-tabs" role="tablist" aria-label="Select a team box score">
                      {[{ key: "team1", name: display.team1, score: display.score1 }, { key: "team2", name: display.team2, score: display.score2 }].map((team) => <button type="button" role="tab" aria-selected={boxScoreTeam === team.key} className={boxScoreTeam === team.key ? "active" : ""} onClick={() => setBoxScoreTeam(team.key)} key={team.key}>
                        <span>{team.name}</span><strong>{team.score}</strong>
                      </button>)}
                    </div>
                    {details.box_score.length ? (
                      <div className="game-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Player</th>
                              <th>MIN</th>
                              <th>PTS</th>
                              <th>REB</th>
                              <th>AST</th>
                              <th>STL</th>
                              <th>BLK</th>
                              <th>TO</th>
                              <th>PF</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedBoxPlayers.map((player) => (
                              <tr key={player.team_player_id}>
                                <td>
                                  <b>
                                    #{player.jersey_number || "–"}{" "}
                                    {player.full_name}
                                  </b>
                                  <small>
                                    {player.team_name} ·{" "}
                                    {player.position || "Player"}
                                  </small>
                                </td>
                                <td>{player.minutes_played}</td>
                                <td>
                                  <strong>{player.points}</strong>
                                </td>
                                <td>{player.rebounds}</td>
                                <td>{player.assists}</td>
                                <td>{player.steals}</td>
                                <td>{player.blocks}</td>
                                <td>{player.turnovers}</td>
                                <td>{player.fouls}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="game-panel-empty">
                        Player statistics will appear after the statistician
                        records game events.
                      </div>
                    )}
                  </article>
                </section>
              )}
              <section className="game-info-grid">
                <article>
                  <i className="bi bi-arrow-repeat" />
                  <div>
                    <b>Automatic updates</b>
                    <span>
                      Scores and the game clock refresh every three seconds.
                    </span>
                  </div>
                </article>
                <article>
                  <i className="bi bi-shield-check" />
                  <div>
                    <b>Official game data</b>
                    <span>
                      Information comes directly from the authorized FullCourt
                      scorekeeper.
                    </span>
                  </div>
                </article>
                <article>
                  <i className="bi bi-phone" />
                  <div>
                    <b>Built for every screen</b>
                    <span>
                      Follow the game clearly from mobile, tablet, or desktop.
                    </span>
                  </div>
                </article>
              </section>
            </>
          )}
        </div>
      </main>
      <section className="game-next-stop">
        <div className="court-container game-next-stop-inner">
          <div className="game-next-stop-copy">
            <span>KEEP FOLLOWING THE TOURNAMENT</span>
            <h2>Where do you want to go next?</h2>
            <p>Check the tournament overview or find the next scheduled game.</p>
          </div>
          <nav className="game-next-stop-links" aria-label="Game page shortcuts">
            {tournamentId && (
              <Link className="is-primary" to={`/sports/tournaments/${tournamentId}`}>
                <i className="bi bi-trophy" aria-hidden="true" /> Tournament
              </Link>
            )}
            <Link to="/sports">
              <i className="bi bi-broadcast" aria-hidden="true" /> Game center
            </Link>
            <Link to="/sports/schedule">
              <i className="bi bi-calendar3" aria-hidden="true" /> Full schedule
            </Link>
          </nav>
        </div>
      </section>
      <CourtFooter showCta={false} />
    </div>
  );
}
