import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import contentService from "../services/contentService";
import {
  CourtNav,
  CourtFooter,
  CourtEmpty,
  MatchCard,
  TournamentCard,
} from "../components/PublicCourt";
import { useCourtData } from "../hooks/useCourtData";
import courtDate from "../utils/courtDate";

export default function Home() {
  const { data, loading, error, retry } = useCourtData();
  const [news, setNews] = useState([]),
    [announcements, setAnnouncements] = useState([]),
    [leaderTournament, setLeaderTournament] = useState(""),
    [playerQuery, setPlayerQuery] = useState("");
  useEffect(() => {
    let active = true;
    contentService
      .getNews()
      .then((items) => active && setNews(items))
      .catch(() => {});
    contentService
      .getAnnouncements()
      .then((items) => active && setAnnouncements(items))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const featured = (() => {
    const byDate = (a, b) =>
      new Date(a.scheduled_start_time || 0) -
      new Date(b.scheduled_start_time || 0);
    const live = data.matches
      .filter((match) => match.status === "in_progress")
      .sort(byDate);
    const upcoming = data.matches
      .filter((match) => ["scheduled", "starting_soon"].includes(match.status))
      .sort(byDate);
    const finals = data.matches
      .filter((match) => match.status === "completed")
      .sort((a, b) => byDate(b, a));
    return [...live, ...upcoming, ...finals]
      .filter(
        (match, index, rows) =>
          rows.findIndex((row) => row.id === match.id) === index,
      )
      .slice(0, 3);
  })();
  const liveCount = data.matches.filter(
    (match) => match.status === "in_progress",
  ).length;
  const teamsCount = new Set(
    [
      ...data.standings.map((row) => row.team_name),
      ...data.leaders.map((row) => row.team_name),
    ].filter(Boolean),
  ).size;
  const leaderTournaments = [...new Map(
    data.leaders
      .filter((player) => player.tournament_id)
      .map((player) => [String(player.tournament_id), {
        id: String(player.tournament_id),
        name: player.tournament_name || "Tournament",
      }]),
  ).values()];
  useEffect(() => {
    if (!leaderTournament && leaderTournaments.length) {
      setLeaderTournament(leaderTournaments[0].id);
    }
  }, [leaderTournament, leaderTournaments]);
  const visibleLeaders = data.leaders
    .filter((player) => String(player.tournament_id) === leaderTournament)
    .filter((player) =>
      `${player.full_name} ${player.team_name}`
        .toLowerCase()
        .includes(playerQuery.trim().toLowerCase()),
    )
    .slice(0, 6);
  const apiRoot = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8767/api").replace(/\/api\/?$/, "");
  return (
    <div className="court-site court-home-dark">
      <main>
        <div className="court-home-top">
          <CourtNav />
          <div className="court-container court-hero">
            <div className="court-hero-copy">
              <span className="court-kicker">Community basketball, connected</span>
              <h1>
                EVERY GAME.
                <br />
                EVERY TEAM.
                <br />
                <em>FULLCOURT.</em>
              </h1>
              <p>
                Follow official tournaments, upcoming games, live scores, standings, and verified player performances in one clear courtside home.
              </p>
              <div className="court-hero-actions">
                <Link
                  to="/sports"
                  className="court-button court-explore-button"
                >
                  <span className="court-explore-icon">
                    <i className="bi bi-broadcast-pin" />
                  </span>
                  <span>View Tournaments</span>
                  <i className="bi bi-arrow-right court-explore-arrow" />
                </Link>
                <Link
                  to="/sports/schedule"
                  className="court-button outline court-hero-join"
                >
                  <span className="court-hero-join-icon">
                    <i className="bi bi-calendar3" />
                  </span>
                  <span>View Schedule</span>
                  <i className="bi bi-arrow-right court-hero-join-arrow" />
                </Link>
              </div>
              <div className="court-hero-note">
                <i className="bi bi-patch-check-fill" />
                <span>
                  Public schedules and scores &bull; No account needed
                </span>
              </div>
            </div>
            <div className="court-hero-showcase">
              <figure className="court-hero-art">
                <img
                  src="/fullcourt-hero-art.png"
                  alt="FullCourt basketball arena with live-score and tournament graphics"
                  width="1120"
                  height="1400"
                />
                <span className="court-art-stamp">BUILT FOR BASKETBALL.</span>
                <figcaption>
                  <span>FULLCOURT PLATFORM</span>
                  <span>GAME DAY EXPERIENCE ↗</span>
                </figcaption>
              </figure>
              <div className="court-hero-metrics">
                <article>
                  <strong>{data.tournaments.length}</strong>
                  <span>Competitions</span>
                </article>
                <article>
                  <strong>{teamsCount}</strong>
                  <span>Teams</span>
                </article>
                <article>
                  <strong>{liveCount}</strong>
                  <span>Live now</span>
                </article>
              </div>
            </div>
          </div>
        </div>
        <section className="court-container court-section court-home-tournaments">
          <div className="court-section-heading">
            <div>
              <span className="court-kicker">Active Competitions</span>
              <h2>Tournament Central</h2>
              <p className="text-muted small mt-1">Select an active league or tournament to track official standings, brackets, and games.</p>
            </div>
            <Link className="court-text-link" to="/sports">
              View all tournaments →
            </Link>
          </div>
          <div className="court-grid">
            {loading ? (
              <CourtEmpty>Loading tournaments…</CourtEmpty>
            ) : data.tournaments.length ? (
              data.tournaments
                .slice(0, 3)
                .map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                  />
                ))
            ) : (
              !error && (
                <CourtEmpty>
                  Tournament announcements will appear here once published.
                </CourtEmpty>
              )
            )}
          </div>
        </section>
        <section
          className="court-container court-section court-home-games"
          style={{ paddingTop: 0 }}
        >
          <div className="court-section-heading">
            <div>
              <span className="court-kicker">Latest &amp; next</span>
              <h2>On the court.</h2>
              <p className="text-muted small mt-1">Recent results and upcoming games, with teams, time, and venue easy to scan.</p>
            </div>
            <Link className="court-text-link" to="/sports/schedule">
              Full schedule & results →
            </Link>
          </div>
          {error && (
            <div role="alert" className="court-error">
              {error}
              <button onClick={retry}>Try again</button>
            </div>
          )}
          <div className="court-grid">
            {loading ? (
              <CourtEmpty>Loading game updates…</CourtEmpty>
            ) : featured.length ? (
              featured.map((match) => (
                <MatchCard key={match.id} match={match} />
              ))
            ) : (
              !error && (
                <CourtEmpty>
                  No published games yet. Check back for the next tip-off.
                </CourtEmpty>
              )
            )}
          </div>
        </section>
        {data.leaders.length > 0 && <section
          className="court-container court-section court-player-spotlight"
          style={{ paddingTop: 0 }}
        >
          <div className="court-section-heading">
            <div>
              <span className="court-kicker">Tournament leaders</span>
              <h2>Choose a tournament. See its leaders.</h2>
              <p>
                Select a competition to view its official points, rebounds, and assists.
              </p>
            </div>
            <div className="court-player-tools">
              <label className="court-player-tournament-select">
                <i className="bi bi-trophy" />
                <select
                  value={leaderTournament}
                  onChange={(event) => {
                    setLeaderTournament(event.target.value);
                    setPlayerQuery("");
                  }}
                  aria-label="Select tournament for player leaders"
                >
                  <option value="">Select a tournament</option>
                  {leaderTournaments.map((tournament) => (
                    <option value={tournament.id} key={tournament.id}>
                      {tournament.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="court-player-search">
                <i className="bi bi-search" />
                <input
                  value={playerQuery}
                  onChange={(event) => setPlayerQuery(event.target.value)}
                  placeholder="Find a player or team"
                  aria-label="Search selected tournament leaders"
                  disabled={!leaderTournament}
                />
              </label>
            </div>
          </div>
          {visibleLeaders.length ? (
            <div className="court-player-grid">
              {visibleLeaders.map((player, index) => (
                <article key={`${player.tournament_id}-${player.full_name}-${player.team_name}`}>
                  <span className="court-player-photo">
                    <img
                      src={player.avatar_url ? `${apiRoot}${player.avatar_url}` : "/player-silhouette.svg"}
                      alt={player.avatar_url ? `${player.full_name} profile` : ""}
                      loading="lazy"
                      className={player.avatar_url ? "" : "is-placeholder"}
                      onError={(event) => {
                        event.currentTarget.src = "/player-silhouette.svg";
                        event.currentTarget.alt = "";
                        event.currentTarget.classList.add("is-placeholder");
                      }}
                    />
                  </span>
                  <span className="court-player-rank">#{index + 1}</span>
                  <div>
                    <h3>{player.full_name}</h3>
                    <p>{player.team_name}</p>
                    <Link className="court-player-tournament" to={`/sports/tournaments/${player.tournament_id}`}>
                      <i className="bi bi-trophy-fill" /> {player.tournament_name || "Tournament"}
                    </Link>
                  </div>
                  <dl>
                    <div>
                      <dt>PTS</dt>
                      <dd>{player.points || 0}</dd>
                    </div>
                    <div>
                      <dt>REB</dt>
                      <dd>{player.rebounds || 0}</dd>
                    </div>
                    <div>
                      <dt>AST</dt>
                      <dd>{player.assists || 0}</dd>
                    </div>
                  </dl>
                </article>
              ))}
            </div>
          ) : <CourtEmpty>{leaderTournament ? "No approved player matches that search." : "Select a tournament above to view its official player leaders."}</CourtEmpty>}
        </section>}
        <section
          className="court-container court-section court-home-community-section"
          style={{ paddingTop: 0 }}
        >
          <div className="court-home-community">
            <div>
              <span className="court-kicker">
                Tournament Architecture
              </span>
              <h2>
                Built for Competitive Basketball.
              </h2>
              <p>
                FullCourt integrates automated single/double elimination brackets,
                smart conflict-aware scheduling, courtside official scoring, and verified player rosters.
              </p>
              <Link to="/sports/schedule" className="court-button">
                View official schedule <i className="bi bi-calendar3" />
              </Link>
            </div>
            <div className="court-feature-list">
              {[
                [
                  "bi-eye",
                  "For the public",
                  "Follow schedules, scores, standings, brackets, and approved player statistics without an account.",
                ],
                [
                  "bi-clipboard2-pulse",
                  "For the coaches",
                  "Register one team, follow its official roster limit, and prepare eligibility requirements.",
                ],
                [
                  "bi-trophy",
                  "For game operations",
                  "Run tournaments, automated brackets, schedules, notifications, and secure live scoring.",
                ],
              ].map(([icon, title, copy]) => (
                <article key={title}>
                  <i className={"bi " + icon} />
                  <div>
                    <h3>{title}</h3>
                    <p>{copy}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
        {(announcements.length > 0 || news.length > 0) && (
          <section
            className="court-container court-section court-home-news"
            style={{ paddingTop: 0 }}
          >
            <div className="court-section-heading">
              <div>
                <span className="court-kicker">Off the court</span>
                <h2>From the community.</h2>
              </div>
            </div>
            <div className="court-grid">
              {announcements.map((item) => (
                <article key={"a" + item.id} className="court-news-card">
                  <span className="court-status">
                    {item.priority || "Announcement"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.message}</p>
                  <small>{courtDate(item.published_at)}</small>
                </article>
              ))}
              {news.map((item) => (
                <article key={"n" + item.id} className="court-news-card">
                  <span className="court-status">
                    {item.sport_name || "Basketball news"}
                  </span>
                  <h3>{item.title}</h3>
                  <p>{item.summary}</p>
                  <small>{courtDate(item.published_at)}</small>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <CourtFooter />
    </div>
  );
}
