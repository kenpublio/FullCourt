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
import teamService from "../services/teamService";
import { useAuth } from "../hooks/useAuth";
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
  const { user } = useAuth();
  const isCoach=["coach","coach_manager"].includes(user?.role);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [reportLog, setReportLog] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [teamsLoaded, setTeamsLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [exportMessage, setExportMessage] = useState("");
  const [exportError, setExportError] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let active=true;
    if(isCoach){
      teamService.getTeams().then(assignedTeams=>{
        if(!active)return;
        setTeams(assignedTeams);
        setSelectedTeamId(current=>assignedTeams.some(team=>String(team.id)===current)?current:(assignedTeams[0]?String(assignedTeams[0].id):''));
      }).catch(error=>{if(active)setLoadError(error.response?.data?.message||'Could not load your assigned team.');}).finally(()=>{if(active){setTeamsLoaded(true);setLoading(false);}});
    }else{
      Promise.all([reportService.getAnalytics(),tournamentService.getTournaments()]).then(([analytics,result])=>{
        if(!active)return;
        setData(analytics);
        const available=result.tournaments||[];
        setTournaments(available);
        if(available[0])setSelectedTournament(String(available[0].id));
      }).catch(error=>{if(active)setLoadError(error.response?.data?.message||'Could not load basketball reports.');}).finally(()=>{if(active)setLoading(false);});
    }
    return()=>{active=false;};
  },[isCoach]);

  useEffect(()=>{
    if(!isCoach||!teamsLoaded)return;
    if(!selectedTeamId){setData(null);setLoading(false);return;}
    let active=true;
    setLoading(true);setLoadError('');
    reportService.getAnalytics(selectedTeamId).then(analytics=>{if(active)setData(analytics);}).catch(error=>{if(active){setData(null);setLoadError(error.response?.data?.message||'Could not load this team’s performance records.');}}).finally(()=>{if(active)setLoading(false);});
    return()=>{active=false;};
  },[isCoach,teamsLoaded,selectedTeamId]);

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
    if(isCoach&&!selectedTeamId){setExportError('Choose your assigned team before exporting.');return;}
    setExporting(true);
    setExportMessage("");
    setExportError("");
    const selectedTeam=teams.find(team=>String(team.id)===String(selectedTeamId));
    const selectedTeamTournament=tournaments.find(tournament=>String(tournament.id)===String(selectedTeam?.tournament_id));
    const metricRows=isCoach?[
      ["Roster players",data.metrics?.total_users||0],
      ["Verified players",data.metrics?.verified_players||0],
      ["Pending eligibility",data.metrics?.pending_eligibility||0],
      ["Games recorded",data.metrics?.total_matches||0],
      ["Games in progress",data.metrics?.active_games||0],
      ["Current standing points",data.top_teams?.[0]?.tournament_points||0],
      ["Point differential",data.top_teams?.[0]?.net_points||0],
    ]:[
      ["Total Users", data.metrics?.total_users || 0],
      ["Total Tournaments", data.metrics?.total_tournaments || 0],
      ["Total Teams", data.metrics?.total_teams || 0],
      ["Registered Teams", data.metrics?.registered_teams || 0],
      ["Total Matches", data.metrics?.total_matches || 0],
      ["Verified Players", data.metrics?.verified_players || 0],
      ["Pending Eligibility",data.eligibility_stats?.find(item=>item.eligibility_status==="pending")?.count||0],
    ];
    const rows=isCoach?[
      ["FULLCOURT · TEAM PERFORMANCE SUMMARY"],
      ["Team",selectedTeam?.team_name||"Assigned team"],
      ["Tournament",selectedTeamTournament?.name||selectedTeam?.tournament_name||"—"],
      ["Report scope","Assigned team only · official recorded data"],
      ["Generated",new Date().toLocaleString()],
      [],["Metric","Value"],...metricRows,
      [],["TEAM PLAYER LEADERS"],["Player","Team","Games","PTS","REB","AST","DEF"],...(data.player_leaders||[]).map(player=>[player.full_name,player.team_name,player.games_played,player.points,player.rebounds,player.assists,player.defensive_plays]),
      [],["TEAM STANDING"],["Team","Tournament","Points","Point differential","Rank"],...(data.top_teams||[]).map(team=>[team.team_name,team.tournament_name,team.tournament_points,team.net_points,team.rank_position]),
    ]:[["FULLCOURT · BASKETBALL OPERATIONS ANALYTICS"],["Report scope","Platform-wide basketball overview"],["Generated",new Date().toLocaleString()],["Note","Tournament-specific results are available in the Tournament PDF export."],[],["PLATFORM METRICS"],["Metric","Value"],...metricRows,[],["TEAM LEADERBOARD"],["Team","Tournament","Points","Point differential","Rank"],...(data.top_teams||[]).map(team=>[team.team_name,team.tournament_name,team.tournament_points,team.net_points,team.rank_position]),[],["PLAYER PERFORMANCE LEADERS"],["Player","Team","Games","PTS","REB","AST","DEF"],...(data.player_leaders||[]).map(player=>[player.full_name,player.team_name,player.games_played,player.points,player.rebounds,player.assists,player.defensive_plays]),[],["MATCH OUTCOMES"],["Status","Games"],...(data.match_outcomes||[]).map(item=>[item.status,item.count])];
    const csv = "\uFEFF"+rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const link = document.createElement("a");
    const csvUrl=URL.createObjectURL(new Blob([csv],{type:"text/csv;charset=utf-8"}));
    link.href = csvUrl;
    const safeTeamName=(selectedTeam?.team_name||'Assigned_Team').normalize('NFKD').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'');
    link.download = isCoach?`FullCourt_${safeTeamName}_Performance_Summary.csv`:"FullCourt_Basketball_Operations_Analytics.csv";
    link.click();
    window.setTimeout(()=>URL.revokeObjectURL(csvUrl),1000);
    try {
      await reportService.generateReport({
        report_type: isCoach ? "team_performance_summary" : "analytics",
        format: "csv",
        tournament_id: isCoach ? (selectedTeam?.tournament_id || null) : null,
        filters: isCoach ? {team_id:Number(selectedTeamId),scope:'assigned_team_only'} : undefined,
      });
      setExportMessage(isCoach?`Team-only CSV downloaded for ${selectedTeam?.team_name||'your assigned team'}.`:'Platform-wide basketball analytics CSV downloaded. Use Tournament PDF for a tournament-specific report.');
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
      const tournamentName=tournaments.find(item=>String(item.id)===String(selectedTournament))?.name||`tournament-${selectedTournament}`;
      const safeTournamentName=tournamentName.normalize('NFKD').replace(/[^\w-]+/g,'_').replace(/^_+|_+$/g,'');
      link.download = `FullCourt_${safeTournamentName}_Report.pdf`;
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
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

  if(loadError)return <div className="container-fluid p-0 reports-page"><section className="reports-hero"><span className="reports-eyebrow">{isCoach?'MY TEAM INTELLIGENCE':'BASKETBALL INTELLIGENCE'}</span><h1>{isCoach?'Team Reports & Performance':'Reports & Performance Analytics'}</h1><p>{loadError}</p><button type="button" className="btn btn-evsu btn-sm" onClick={()=>window.location.reload()}><i className="bi bi-arrow-clockwise me-2"/>Try again</button></section></div>;

  if(isCoach&&teamsLoaded&&!selectedTeamId)return <div className="container-fluid p-0 reports-page"><section className="reports-hero reports-coach-hero"><span className="reports-eyebrow">MY TEAM INTELLIGENCE</span><h1>Team Reports &amp; Performance</h1><p>Analytics and performance records for your assigned team only.</p></section><section className="reports-empty-team"><span className="reports-empty-icon"><i className="bi bi-people"/></span><div><span className="reports-eyebrow">TEAM ACCESS</span><h2>No team assigned yet</h2><p>Once an organizer assigns you to a team, its roster, match activity, and performance reports will appear here.</p></div><a className="btn btn-outline-secondary" href="/teams">Open team workspace <i className="bi bi-arrow-right ms-1"/></a></section></div>;

  const outcomeChart = {
    labels: data?.match_outcomes?.map((m) => m.status) || [],
    datasets: [
      {
        label: "Matches",
        data: data?.match_outcomes?.map((m) => m.count) || [],
        backgroundColor: "#1a1a2e",
      },
    ],
  };

  const sportsChart = {
    labels: ["Basketball"],
    datasets: [
      {
        label: "Tournaments",
        data: [data?.metrics?.total_tournaments || 0],
        backgroundColor: "#c8102e",
      },
    ],
  };

  const revenueChart = {
    labels: ["Basketball Teams"],
    datasets: [
      {
        label: "Teams",
        data: [data?.metrics?.total_teams || 0],
        backgroundColor: "#18181b",
      },
    ],
  };

  return (
    <div className="container-fluid p-0 reports-page">
      <div className="reports-hero">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
          <div>
            <span className="reports-eyebrow">{isCoach?'MY TEAM INTELLIGENCE':'BASKETBALL INTELLIGENCE'}</span>
            <h1
              className="fw-bold mb-1"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--text-primary)",
              }}
            >
              <i className="bi bi-bar-chart-line-fill text-evsu-primary me-2" />
              {isCoach?'Team Reports & Performance':'Reports & Performance Analytics'}
            </h1>
            <p className="text-muted small mb-0">
              {isCoach?`Analytics and performance records for your assigned team only · ${teams.find(team=>String(team.id)===String(selectedTeamId))?.team_name||'Select a team'}`:'Basketball operations analytics and real downloadable reports'}
            </p>
          </div>
          <div className="reports-controls">
            <select
              aria-label="Choose analytics report section"
              className="form-select form-select-sm"
              value={tab}
              onChange={(e) => setTab(e.target.value)}
            >
              <option value="overview">Overview</option>
              <option value="leaderboard">{isCoach?'Team Performance':'Team Leaderboard'}</option>
              <option value="log">Report Log</option>
            </select>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={handleExportCSV}
              disabled={exporting||!data||(isCoach&&!selectedTeamId)}
            >
              <i className="bi bi-file-earmark-spreadsheet me-1" /> Download CSV
            </button>
            {isCoach?<select aria-label="Choose your assigned team" className="form-select form-select-sm" value={selectedTeamId} onChange={event=>setSelectedTeamId(event.target.value)} disabled={!teams.length}><option value="">{teams.length?'Select your team':'No assigned team'}</option>{teams.map(team=><option value={team.id} key={team.id}>{team.team_name}</option>)}</select>:<select
              aria-label="Select tournament for report export"
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
            </select>}
            {!isCoach&&<button
              className="btn btn-evsu btn-sm text-nowrap"
              onClick={handleExportPDF}
              disabled={!selectedTournament || exporting}
            >
              <i className="bi bi-file-earmark-pdf me-1" /> Tournament PDF
            </button>}
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
                  {isCoach?'Verified team players':'Verified Players'}
                </span><strong>
                  {data?.metrics?.verified_players || 0}
                </strong><small>{isCoach?'On your assigned roster':'Eligible competitors'}</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-red"><i className="bi bi-trophy-fill"/><div><span>{isCoach?'Team tournament':'Tournaments'}</span><strong>
                  {data?.metrics?.total_tournaments || 0}
                </strong><small>{isCoach?'Competition linked to this team':'Managed competitions'}</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-blue"><i className="bi bi-people-fill"/><div><span>{isCoach?'Roster players':'Teams'}</span><strong>
                  {isCoach?(data?.metrics?.total_users||0):(data?.metrics?.total_teams||0)}
                </strong><small>{isCoach?'Assigned team only':'Registered squads'}</small></div>
              </div>
            </div>
            <div className="col-6 col-md-3">
              <div className="report-kpi is-gold"><i className="bi bi-calendar2-event-fill"/><div><span>{isCoach?'Team matches':'Matches'}</span><strong>
                  {data?.metrics?.total_matches || 0}
                </strong><small>{isCoach?'Games involving your team':'Scheduled game records'}</small></div>
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
                    {isCoach?'Your Team Tournament':'Basketball Competitions'}
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={sportsChart}
                    aria-label="Bar chart showing the number of basketball competitions"
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
                    {isCoach?'Assigned Team Roster':'Registered Basketball Teams'}
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={revenueChart}
                    aria-label="Bar chart showing the number of registered basketball teams"
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
                    {isCoach?'Your Team Match Outcomes':'Match Outcomes'}
                  </h6>
                </div>
                <div style={{ height: 210 }}>
                  <Bar
                    data={outcomeChart}
                    aria-label="Bar chart showing match outcomes"
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
              {isCoach?'Your Team Player Leaders':'Player Performance Leaders'}
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
            {isCoach?'Assigned Team Performance':'Top Teams (all tournaments)'}
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

function csvCell(value) {
  let text=String(value??"");
  if(typeof value==="string"&&/^[=+@\-\t\r]/.test(text))text=`'${text}`;
  return `"${text.replaceAll('"','""')}"`;
}

export default ReportsAnalyticsView;
