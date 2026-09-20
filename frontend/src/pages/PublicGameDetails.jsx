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
    }),
    [pregame, setPregame] = useState({
      lineup: [],
      officials: [],
      comparison: {},
    }),
    [loading, setLoading] = useState(true),
    [updated, setUpdated] = useState(null);
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
    return [{ label: "Points", key: "points", player: top("points") }, { label: "Rebounds", key: "rebounds", player: top("rebounds") }, { label: "Assists", key: "assists", player: top("assists") }];
  }, [details.box_score]);
  const comparison = pregame.comparison || {};
  const home = comparison.team1 || {}, away = comparison.team2 || {}, head = comparison.head_to_head || {};
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
                    <span>GAME PERSONNEL</span>
                    <h2>Lineups &amp; officials</h2>
                  </div>
                  <i className="bi bi-people-fill" />
                </header>
                <div className="game-pregame-grid">
                  <article>
                    <h3>Starting lineups</h3>
                    {pregame.lineup.filter((p) => p.is_starter == 1).length ? (
                      <div className="game-lineup-list">
                        {pregame.lineup
                          .filter((p) => p.is_starter == 1)
                          .map((p) => (
                            <div key={`${p.team_name}-${p.full_name}`}>
                              <span>#{p.jersey_number || "–"}</span>
                              <b>{p.full_name}</b>
                              <small>
                                {p.team_name} · {p.position || "Player"}
                              </small>
                            </div>
                          ))}
                      </div>
                    ) : (
                      <p>
                        Starting lineups will appear after both teams confirm
                        their five starters.
                      </p>
                    )}
                  </article>
                  <article>
                    <h3>Assigned officials</h3>
                    {pregame.officials.length ? (
                      <div className="game-official-list">
                        {pregame.officials.map((o, index) => (
                          <div key={`${o.full_name}-${index}`}>
                            <i className="bi bi-patch-check-fill" />
                            <span>
                              <b>{o.full_name}</b>
                              <small>
                                {String(o.assignment_role).replaceAll("_", " ")}
                              </small>
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p>
                        Public official assignments have not been confirmed yet.
                      </p>
                    )}
                  </article>
                </div>
              </section>
              <section className="match-comparison">
                <header><div><span>HEAD-TO-HEAD</span><h2>Team comparison</h2></div><small>{head.meetings || 0} previous meetings</small></header>
                <div className="comparison-teams">
                  <article><b>{display.team1}</b><strong>{home.win_rate || 0}%</strong><span>Win rate · {home.wins || 0}–{home.losses || 0}</span></article>
                  <div className="comparison-metrics"><div><span>{home.points_per_game || 0}</span><b>POINTS / GAME</b><span>{away.points_per_game || 0}</span></div><div><span>{home.points_allowed || 0}</span><b>POINTS ALLOWED</b><span>{away.points_allowed || 0}</span></div><div><span>{head.team1_wins || 0}</span><b>H2H WINS</b><span>{head.team2_wins || 0}</span></div></div>
                  <article className="away"><b>{display.team2}</b><strong>{away.win_rate || 0}%</strong><span>Win rate · {away.wins || 0}–{away.losses || 0}</span></article>
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
                            {details.box_score.map((player) => (
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
                  <article className="game-play-log">
                    <header>
                      <div>
                        <span>LIVE FEED</span>
                        <h2>Play-by-play</h2>
                      </div>
                      <i className="bi bi-broadcast-pin" />
                    </header>
                    {details.events.length ? (
                      <div className="game-events">
                        {details.events.map((event) => (
                          <div key={event.id}>
                            <span>
                              {event.period || "GAME"}
                              <small>{gameClock(event.clock_seconds)}</small>
                            </span>
                            <i className="bi bi-circle-fill" />
                            <p>
                              <b>
                                {String(
                                  event.event_type || "game_event",
                                ).replaceAll("_", " ")}
                              </b>
                              <small>
                                {event.player_name ||
                                  event.team_name ||
                                  "Official game update"}
                              </small>
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="game-panel-empty">
                        Play-by-play events will appear when live scoring
                        begins.
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
      <CourtFooter />
    </div>
  );
}
