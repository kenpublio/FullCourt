import React, { useState, useEffect } from "react";
import reportService from "../services/reportService";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import tournamentService from "../services/tournamentService";
import "../styles/reports-analytics.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

const ReportsAnalyticsView = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [reportLog, setReportLog] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportService.getAnalytics();
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    tournamentService.getTournaments().then((result) => {
      setTournaments(result.tournaments || []);
      if (result.tournaments?.[0])
        setSelectedTournament(String(result.tournaments[0].id));
    });
  }, []);

  const loadReportLog = async () => {
    try {
      setReportLog(await reportService.getReportLog());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (tab === "log") loadReportLog();
  }, [tab]);

  const handleExportCSV = async () => {
    if (!data) return;
    setExporting(true);
    setExportMessage("");
    setExportError("");
    const rows = [
      ["Metric", "Value"],
      ["Total Users", data.metrics?.total_users || 0],
      ["Total Tournaments", data.metrics?.total_tournaments || 0],
      ["Total Teams", data.metrics?.total_teams || 0],
      ["Registered Teams", data.metrics?.registered_teams || 0],
      ["Total Matches", data.metrics?.total_matches || 0],
      ["Verified Players", data.metrics?.verified_players || 0],
      [
        "Pending Eligibility",
        data.eligibility_stats?.find(
          (item) => item.eligibility_status === "pending",
        )?.count || 0,
      ],
    ];
    const csv = rows.map((r) => r.map((x) => `"${x}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    link.download = "FullCourt_Basketball_Analytics_Report.csv";
    link.click();
    try {
      await reportService.generateReport({
        report_type: "analytics",
        format: "csv",
        tournament_id: selectedTournament || null,
      });
      setExportMessage("CSV analytics report downloaded successfully.");
      if (tab === "log") await loadReportLog();
    } catch (error) {
      setExportError(
        error.response?.data?.message ||
          "CSV downloaded, but its report log could not be saved.",
      );
    } finally {
      setExporting(false);
    }
  };

  const handleExportPDF = async () => {
    if (!selectedTournament) return;
    setExporting(true);
    setExportMessage("");
    setExportError("");
    try {
      const blob =
        await reportService.downloadTournamentPdf(selectedTournament);
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `basketball-tournament-${selectedTournament}-report.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      setExportMessage("Tournament PDF downloaded successfully.");
      if (tab === "log") await loadReportLog();
    } catch (error) {
      setExportError(
        error.response?.data?.message ||
          "Unable to download the tournament PDF.",
      );
    } finally {
      setExporting(false);
    }
  };

  if (loading)
    return <LoadingSpinner message="Calculating analytics metrics..." />;

  const outcomeChart = {
    labels: data.match_outcomes?.map((m) => m.status) || [],
    datasets: [
      {
        label: "Matches",
        data: data.match_outcomes?.map((m) => m.count) || [],
        backgroundColor: "#1a1a2e",
      },
    ],
  };

  const sportsChart = {
    labels: ["Basketball"],
    datasets: [
      {
        label: "Tournaments",
        data: [data.metrics?.total_tournaments || 0],
        backgroundColor: "#c8102e",
      },
    ],
  };

  const revenueChart = {
    labels: ["Basketball Teams"],
    datasets: [
      {
        label: "Teams",
        data: [data.metrics?.total_teams || 0],
        backgroundColor: "#18181b",
      },
    ],
  };

  return (
    <div className="container-fluid p-0 reports-page">
      <div className="reports-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <span className="reports-eyebrow">BASKETBALL INTELLIGENCE</span>
            <h3
              className="fw-bold mb-1"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text-primary)",
              }}
            >
              <i className="bi bi-bar-chart-line-fill text-evsu-primary me-2" />
              Reports &amp; Performance Analytics
            </h3>
            <p className="text-muted small mb-0">
              Basketball operations analytics and real downloadable reports
            </p>
          </div>
          <div className="reports-controls">
            <select
              className="form-select form-select-sm"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
            >
              <option value="overview">Overview</option>
              <option value="leaderboard">Team Leaderboard</option>
              <option value="log">Report Log</option>
            </select>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={exporting}
            >
              <i className="bi bi-filetype-csv me-1" /> Export summary
            </button>
            <select
              className="form-select form-select-sm"
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
            >
              <option value="">Select tournament</option>
              {tournaments.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button
              className="btn btn-evsu btn-sm text-nowrap"
              onClick={handleExportPDF}
              disabled={!selectedTournament || exporting}
            >
              <i className="bi bi-file-earmark-pdf me-1" /> Tournament PDF
            </button>
          </div>
        </div>
      </div>

      {exportMessage && (
        <div className="alert alert-success mx-4 mt-3 mb-0 py-2">
          <i className="bi bi-check-circle-fill me-2" />
          {exportMessage}
        </div>
      )}
      {exportError && (
        <div className="alert alert-danger mx-4 mt-3 mb-0 py-2">
          <i className="bi bi-exclamation-triangle-fill me-2" />
          {exportError}
        </div>
      )}

      {tab === "overview" && (
        <div className="reports-content">
          <div className="row g-3 mb-4">
            <div className="col-6 col-md-3">
              <div className="report-kpi is-green">
                <i className="bi bi-patch-check-fill"/><div><span>
                  Verified Players
                </span><strong>
                  {data?.metrics?.verified_players || 0}
                </strong><small>Eligible competitors</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-red"><i className="bi bi-trophy-fill"/><div><span>Tournaments</span><strong>
                  {data?.metrics?.total_tournaments || 0}
                </strong><small>Managed competitions</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-blue"><i className="bi bi-people-fill"/><div><span>Teams</span><strong>
                  {data?.metrics?.total_teams || 0}
                </strong><small>Registered squads</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-gold"><i className="bi bi-calendar2-event-fill"/><div><span>Matches</span><strong>
                  {data?.metrics?.total_matches || 0}
                </strong><small>Scheduled game records</small></div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="report-chart-panel">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-bar-chart-fill text-evsu-primary" />
                  <h6
                    className="fw-bold mb-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Basketball Competitions
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={sportsChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="report-chart-panel">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-people-fill text-evsu-primary" />
                  <h6
                    className="fw-bold mb-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Registered Basketball Teams
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={revenueChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      indexAxis: "y",
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { beginAtZero: true, ticks: { precision: 0 } },
                        y: { grid: { display: false } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
            <div className="col-lg-6">
              <div className="report-chart-panel">
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-flag-fill text-evsu-primary" />
                  <h6
                    className="fw-bold mb-0"
                    style={{ color: "var(--text-primary)" }}
                  >
                    Match Outcomes
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={outcomeChart}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, ticks: { precision: 0 } },
                      },
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
          <div className="report-table-panel mt-4">
            <h5
              className="fw-bold mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              <i className="bi bi-person-lines-fill text-evsu-primary me-2" />
              Player Performance Leaders
            </h5>
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Team</th>
                    <th>Games</th>
                    <th>PTS</th>
                    <th>REB</th>
                    <th>AST</th>
                    <th>DEF</th>
                  </tr>
                </thead>
                <tbody>
                  {data.player_leaders?.length ? (
                    data.player_leaders.map((player, index) => (
                      <tr key={`${player.full_name}-${player.team_name}`}>
                        <td>
                          <span className="badge bg-dark me-2">
                            #{index + 1}
                          </span>
                          <b>{player.full_name}</b>
                        </td>
                        <td>{player.team_name}</td>
                        <td>{player.games_played}</td>
                        <td className="fw-bold text-evsu-primary">
                          {player.points}
                        </td>
                        <td>{player.rebounds}</td>
                        <td>{player.assists}</td>
                        <td>{player.defensive_plays}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="7" className="text-center text-muted py-4">
                        Record and finalize player statistics to populate
                        performance leaders.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {tab === "leaderboard" && (
        <div className="reports-content report-table-panel-wrap">
          <div className="report-table-panel">
          <h5 className="fw-bold mb-3" style={{ color: "var(--text-primary)" }}>
            <i className="bi bi-award me-2 text-muted" />
            Top Teams (all tournaments)
          </h5>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ background: "var(--evsu-primary-soft)" }}>
                <tr>
                  <th>Rank</th>
                  <th>Team</th>
                  <th>Tournament</th>
                  <th>Points</th>
                  <th>Net</th>
                </tr>
              </thead>
              <tbody>
                {data.top_teams?.length ? (
                  data.top_teams.map((t, i) => (
                    <tr key={`${t.tournament_name}-${t.team_name}`}>
                      <td className="fw-bold text-evsu-primary">#{i + 1}</td>
                      <td className="fw-semibold">{t.team_name}</td>
                      <td className="small text-muted">{t.tournament_name}</td>
                      <td>{t.tournament_points}</td>
                      <td>{t.net_points}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No standings yet. Finalize matches to populate the
                      leaderboard.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
          </div>
      )}

      {tab === "log" && (
        <div className="reports-content report-table-panel-wrap">
          <div className="report-table-panel">
          <h5 className="fw-bold mb-3" style={{ color: "var(--text-primary)" }}>
            <i className="bi bi-clock-history me-2 text-muted" />
            Report Generation Log
          </h5>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead style={{ background: "var(--evsu-primary-soft)" }}>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Format</th>
                  <th>Tournament</th>
                  <th>Generated By</th>
                </tr>
              </thead>
              <tbody>
                {reportLog.length ? (
                  reportLog.map((r) => (
                    <tr key={r.id}>
                      <td className="small text-muted">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                      <td>{r.report_type}</td>
                      <td>
                        <span className="badge bg-secondary">{r.format}</span>
                      </td>
                      <td className="small">{r.tournament_name || "—"}</td>
                      <td className="small">{r.generated_by || "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center text-muted py-4">
                      No report exports logged yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          </div>
          </div>
      )}
    </div>
  );
};

export default ReportsAnalyticsView;
