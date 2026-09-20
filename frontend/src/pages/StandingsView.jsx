import React, { useEffect, useState } from "react";
import tournamentService from "../services/tournamentService";
import reportService from "../services/reportService";
import LoadingSpinner from "../components/LoadingSpinner";
import "../styles/operations-polish.css";

const StandingsView = () => {
  const [tournaments, setTournaments] = useState([]);
  const [tournamentId, setTournamentId] = useState("");
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    tournamentService
      .getTournaments()
      .then(({ tournaments = [] }) => {
        setTournaments(tournaments);
        if (tournaments[0]) setTournamentId(String(tournaments[0].id));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!tournamentId) return;
    setLoading(true);
    reportService
      .getStandings(tournamentId)
      .then(setStandings)
      .finally(() => setLoading(false));
  }, [tournamentId]);

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

  return (
    <div className="container-fluid p-0 page-enter ops-page standings-page">
      <div className="ops-page-head">
        <div>
          <span className="ops-eyebrow">COMPETITION TABLE</span><h3 className="fw-bold mb-1">
            <i className="bi bi-list-ol text-evsu-primary me-2" />
            Tournament Standings
          </h3>
          <p className="text-muted small mb-0">
            Current rankings based on finalized match results
          </p>
        </div>
        <select
          className="form-select w-auto"
          value={tournamentId}
          onChange={(e) => setTournamentId(e.target.value)}
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <LoadingSpinner message="Loading standings..." />
      ) : (
        <div className="ops-table-shell table-responsive">
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
                    <tr className={rankRowClass(rank)} key={s.id || s.team_id}>
                      <td className="fw-bold text-center">
                        {rankDisplay(rank)}
                      </td>
                      <td className="fw-semibold">
                        <span className="standings-team-mark">
                          {s.team_name?.charAt(0) || "T"}
                        </span>
                        {s.team_name}
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
      )}
    </div>
  );
};

export default StandingsView;
