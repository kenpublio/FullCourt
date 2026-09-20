import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import teamService from "../services/teamService";
import eligibilityService from "../services/eligibilityService";
import scheduleService from "../services/scheduleService";
import LoadingSpinner from "../components/LoadingSpinner";
import MatchupPrediction from "../components/MatchupPrediction";

const CoachDashboard = () => {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]),
    [players, setPlayers] = useState([]),
    [schedule, setSchedule] = useState([]),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const teamRows = await teamService.getTeams();
        if (!active) return;
        setTeams(teamRows);
        const playerRows = await eligibilityService
          .getPendingPlayers()
          .catch(() => []);
        if (active) setPlayers(playerRows);
        const tournamentId = teamRows[0]?.tournament_id;
        if (tournamentId) {
          const rows = await scheduleService
            .getSchedule(tournamentId)
            .catch(() => []);
          if (active) setSchedule(rows);
        }
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  const teamIds = useMemo(
    () => new Set(teams.map((t) => Number(t.id))),
    [teams],
  );
  const roster = players.filter((p) => teamIds.has(Number(p.team_id))),
    verified = roster.filter((p) => p.eligibility_status === "verified").length,
    pending = roster.filter((p) => p.eligibility_status === "pending").length;
  const nextGame = schedule
    .filter(
      (m) => teamIds.has(Number(m.team1_id)) || teamIds.has(Number(m.team2_id)),
    )
    .filter((m) => ["scheduled", "in_progress"].includes(m.status))
    .sort(
      (a, b) =>
        new Date(a.scheduled_start_time || "2999") -
        new Date(b.scheduled_start_time || "2999"),
    )[0];
  if (loading)
    return <LoadingSpinner message="Preparing your coach workspace..." />;
  return (
    <div className="container-fluid p-0 page-enter role-dashboard role-dashboard-coach">
      <section className="welcome-banner mb-4">
        <div style={{ position: "relative", zIndex: 1 }}>
          <div className="role-hero-topline mb-3">
            <span className="role-hero-eyebrow"><i className="bi bi-clipboard2-pulse" /> COACH COMMAND</span>
            <span className="role-hero-live"><i /> ROSTER READY</span>
          </div>
          <h3 className="fw-bold text-white mb-1">
            Welcome, {user?.full_name || "Coach"}
          </h3>
          <p className="role-dashboard-intro mb-0">
            Your team, roster, and next-game overview in one place.
          </p>
          <div className="role-hero-actions">
            <Link to="/teams" className="role-hero-primary">Manage roster <i className="bi bi-arrow-up-right" /></Link>
            <span className="role-hero-date"><i className="bi bi-calendar3" /> {new Date().toLocaleDateString("en-PH",{weekday:"short",month:"short",day:"numeric"})}</span>
          </div>
        </div>
        <i className="bi bi-clipboard2-pulse welcome-banner-trophy d-none d-md-block" />
      </section>
      <nav className="role-quick-actions mb-4" aria-label="Coach quick actions">
        {[["Manage Roster","/teams","bi-people-fill"],["Player Eligibility","/eligibility","bi-patch-check-fill"],["Team Schedule","/schedules","bi-calendar-event-fill"],["Team Reports","/reports","bi-bar-chart-fill"]].map(([label,path,icon])=><Link to={path} key={label}><span><i className={`bi ${icon}`}/></span><b>{label}</b><i className="bi bi-arrow-up-right"/></Link>)}
      </nav>
      <div className="row g-3 mb-4">
        {[
          ["My Teams", teams.length, "bi-shield-fill-check", "kpi-icon-red"],
          [
            "Verified Players",
            verified,
            "bi-person-check-fill",
            "kpi-icon-green",
          ],
          [
            "Pending Invitations",
            pending,
            "bi-hourglass-split",
            "kpi-icon-yellow",
          ],
          [
            "Upcoming Games",
            schedule.filter(
              (m) =>
                ["scheduled", "in_progress"].includes(m.status) &&
                (teamIds.has(Number(m.team1_id)) ||
                  teamIds.has(Number(m.team2_id))),
            ).length,
            "bi-calendar-event-fill",
            "kpi-icon-blue",
          ],
        ].map(([label, value, icon, cls]) => (
          <div className="col-6 col-xl-3" key={label}>
            <div className="kpi-card h-100">
              <div className={`kpi-icon ${cls}`}>
                <i className={`bi ${icon}`} />
              </div>
              <div>
                <div className="kpi-card-label">{label}</div>
                <div className="kpi-card-value">{value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="row g-4">
        <div className="col-lg-7">
          <div className="card-custom p-4 h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h5 className="fw-bold mb-1">My Teams</h5>
                <small className="text-muted">
                  Teams currently assigned to you
                </small>
              </div>
              <Link
                className="btn btn-evsu btn-sm rounded-pill px-3"
                to="/teams"
              >
                <i className="bi bi-people-fill me-1" />
                Manage Roster
              </Link>
            </div>
            {teams.length ? (
              <div className="row g-3">
                {teams.map((team) => (
                  <div className="col-md-6" key={team.id}>
                    <div className="border rounded-3 p-3 h-100">
                      <div className="d-flex align-items-center gap-3">
                        <span
                          className="rounded-circle border"
                          style={{
                            width: 38,
                            height: 38,
                            backgroundColor: team.primary_color || "orange",
                          }}
                        />
                        <div>
                          <b>{team.team_name}</b>
                          <small className="d-block text-muted">
                            {team.division_name || "Open division"} ·{" "}
                            {team.tournament_name}
                          </small>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted py-5">
                <i className="bi bi-shield-plus display-5 d-block mb-2 opacity-25" />
                No team assigned yet.
                <div>
                  <Link
                    to="/teams"
                    className="btn btn-outline-primary btn-sm mt-2"
                  >
                    Register a Team
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="col-lg-5">
          <div className="card-custom p-4 mb-4">
            <h5 className="fw-bold">
              <i className="bi bi-calendar2-check text-evsu-primary me-2" />
              Next Game
            </h5>
            {nextGame ? (
              <>
                <div className="text-muted small mb-2">
                  {nextGame.scheduled_start_time
                    ? new Date(nextGame.scheduled_start_time).toLocaleString()
                    : "Schedule TBA"}{" "}
                  · {nextGame.court_name || nextGame.venue_name || "Venue TBA"}
                </div>
                <div className="border rounded-3 p-3 text-center fw-bold">
                  {nextGame.team1_name || "TBD"}{" "}
                  <span className="text-muted mx-2">VS</span>{" "}
                  {nextGame.team2_name || "TBD"}
                </div>
              </>
            ) : (
              <p className="text-muted mb-0">
                No upcoming game scheduled for your team.
              </p>
            )}
          </div>
          {nextGame?.team1_id && nextGame?.team2_id && (
            <div className="mb-4"><MatchupPrediction matchId={nextGame.id} title="Next Game Win Probability" /></div>
          )}
          <div className="card-custom p-4">
            <h5 className="fw-bold mb-3">Quick Actions</h5>
            <div className="d-grid gap-2">
              <Link to="/teams" className="btn btn-light border text-start">
                <i className="bi bi-person-plus-fill text-primary me-2" />
                Invite a Player
              </Link>
              <Link
                to="/eligibility"
                className="btn btn-light border text-start"
              >
                <i className="bi bi-patch-check-fill text-success me-2" />
                Review Eligibility
              </Link>
              <Link to="/schedules" className="btn btn-light border text-start">
                <i className="bi bi-calendar-event-fill text-warning me-2" />
                View Schedule
              </Link>
              <Link to="/reports" className="btn btn-light border text-start">
                <i className="bi bi-bar-chart-fill text-danger me-2" />
                Team Reports
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default CoachDashboard;
