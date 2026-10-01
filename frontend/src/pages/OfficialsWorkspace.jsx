import { useCallback, useEffect, useMemo, useState } from "react";
import gameOperationsService from "../services/gameOperationsService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import QRCode from "qrcode";
import tournamentService from "../services/tournamentService";
import scheduleService from "../services/scheduleService";
import scoringAccessService from "../services/scoringAccessService";
import "../styles/operations-polish.css";
import "../styles/scorer-access.css";

const copyToClipboard = async (text) => {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall back for browsers that block clipboard access on this page.
    }
  }
  const field = document.createElement('textarea');
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.position = 'fixed';
  field.style.opacity = '0';
  field.style.pointerEvents = 'none';
  document.body.appendChild(field);
  field.focus();
  field.select();
  field.setSelectionRange(0, field.value.length);
  let copied = false;
  try { copied = document.execCommand('copy'); } catch { copied = false; }
  field.remove();
  return copied;
};

const OfficialsWorkspace = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState("assignments");
  const [accessQr, setAccessQr] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [tournaments, setTournaments] = useState([]);
  const [matches, setMatches] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState("");
  const [selectedMatch, setSelectedMatch] = useState("");
  const [assignmentMessage, setAssignmentMessage] = useState("");
  const [linkOperator, setLinkOperator] = useState("");
  const [linkHours, setLinkHours] = useState("8");
  const [scoringAccess, setScoringAccess] = useState(null);
  const [linkBusy, setLinkBusy] = useState(false);
  const managers = [
    "platform_admin",
    "admin",
    "organization_admin",
    "tournament_organizer",
  ];
  const isManager = managers.includes(user?.role);
  const assignmentStats = useMemo(() => ({
    total: assignments.length,
    accepted: assignments.filter((item) => item.status === "accepted").length,
    pending: assignments.filter((item) => item.status === "pending").length,
    today: assignments.filter((item) => item.scheduled_start_time && new Date(item.scheduled_start_time).toDateString() === new Date().toDateString()).length,
  }), [assignments]);
  const roles = useMemo(() => [...new Set(assignments.map((item) => item.assignment_role).filter(Boolean))], [assignments]);
  const visibleAssignments = useMemo(() => {
    const term = search.trim().toLowerCase();
    return assignments.filter((item) => {
      const text = [item.home_team, item.away_team, item.tournament_name, item.venue_name, item.court_name, item.assignee_name];
      return (statusFilter === "all" || item.status === statusFilter)
        && (roleFilter === "all" || item.assignment_role === roleFilter)
        && (!term || text.some((value) => String(value || "").toLowerCase().includes(term)));
    });
  }, [assignments, roleFilter, search, statusFilter]);
  const load = useCallback(async () => {
    setLoadError('');
    try {
      const [nextAssignments, nextCorrections] = await Promise.all([
        gameOperationsService.assignments(),
        isManager ? gameOperationsService.corrections() : Promise.resolve([]),
      ]);
      setAssignments(nextAssignments);
      if (isManager) setCorrections(nextCorrections);
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not load game operations. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [isManager]);
  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!isManager) return;
    tournamentService.getTournaments().then((tournamentData) => {
      const tournamentRows = tournamentData.tournaments || [];
      setTournaments(tournamentRows);
      setSelectedTournament(tournamentRows[0] ? String(tournamentRows[0].id) : "");
    }).catch((error) => {
      setLoadError(error.response?.data?.message || 'Could not load tournaments. Try again.');
    });
  }, [isManager]);
  useEffect(() => {
    if (!selectedTournament) { setMatches([]); setSelectedMatch(""); setAssignmentMessage(""); return; }
    let active = true;
    setAssignmentMessage("");
    scheduleService.getSchedule(selectedTournament).then((rows) => {
      if (!active) return;
      setMatches(rows);
      setSelectedMatch(rows[0] ? String(rows[0].id) : "");
    }).catch((error) => {
      if (!active) return;
      setMatches([]);
      setSelectedMatch("");
      setAssignmentMessage(error.response?.data?.message || 'Could not load scheduled games for this tournament.');
    });
    return () => { active = false; };
  }, [selectedTournament]);
  const respond = async (id, status) => {
    await gameOperationsService.respond(id, status);
    await load();
  };
  const generateScoringLink = async (event) => {
    event.preventDefault();
    if (!selectedMatch || !linkOperator.trim()) return;
    setLinkBusy(true);setAssignmentMessage("");
    try {
      const access=await scoringAccessService.create(Number(selectedMatch),{operator_label:linkOperator.trim(),expires_in_hours:Number(linkHours)});
      setScoringAccess({...access,url:`${window.location.origin}/score/${access.token}`});
    } catch(error) { setAssignmentMessage(error.response?.data?.message||"Unable to generate the scoring link."); }
    finally { setLinkBusy(false); }
  };
  const copyScoringInvite = async () => {
    if(!scoringAccess)return;
    const copied = await copyToClipboard(`FullCourt scoring access\nLink: ${scoringAccess.url}\nPIN: ${scoringAccess.pin}\nFor: ${scoringAccess.operator_label}\nDo not forward this private game link.`);
    setAssignmentMessage(copied
      ? "Scoring link and PIN copied. You can now send them through Messenger or email."
      : "Copy was blocked by this browser. Select the link or PIN above and copy it manually.");
  };
  const revokeScoringLink = async () => {
    if(!scoringAccess)return;await scoringAccessService.revoke(scoringAccess.id);setScoringAccess(null);setAssignmentMessage("The scoring link has been revoked and can no longer be used.");
  };
  const review = async (id, status) => {
    try {
      await gameOperationsService.reviewCorrection(id, status);
      await load();
    } catch (error) {
      setLoadError(error.response?.data?.message || 'Could not save the correction decision. Try again.');
    }
  };
  const generateAccess = async (assignment) => {
    const access = await gameOperationsService.issueAccessQR(assignment.id);
    setAccessQr({
      ...access,
      image: await QRCode.toDataURL(access.qr_payload, {
        width: 360,
        margin: 2,
      }),
    });
  };
  if (loading) return <LoadingSpinner message="Loading game assignments..." />;
  return (
    <div className="container-fluid p-0 ops-page officials-page">
      <div className="ops-page-head">
        <div><span className="ops-eyebrow">COURTSIDE OPERATIONS</span><h1 className="fw-bold mb-1">
          <i className="bi bi-whistle text-evsu-primary me-2" />
          Statistician Assignments
        </h1>
        <p className="text-muted small mb-0">
          Assign one statistician to record the live score and player statistics
        </p><div className="officials-head-meta"><span><i className="bi bi-basketball"/> Basketball game-day crew</span><span><i className="bi bi-clipboard2-data"/> Scores &amp; player stats</span></div></div><div className="ops-head-mark"><i className="bi bi-whistle"/></div>
      </div>
      {loadError && <div className="alert alert-danger d-flex justify-content-between align-items-center gap-3" role="alert"><span><i className="bi bi-exclamation-triangle-fill me-2"/>{loadError}</span><button className="btn btn-sm btn-outline-danger" onClick={load}>Try again</button></div>}
      <section className="officials-command-grid" aria-label="Statistician assignment summary">
        <article><span className="officials-stat-icon is-red"><i className="bi bi-clipboard2-check" /></span><div><small>Total duties</small><strong>{assignmentStats.total}</strong><p>All statistician assignments</p></div></article>
        <article><span className="officials-stat-icon is-green"><i className="bi bi-check2-circle" /></span><div><small>Confirmed</small><strong>{assignmentStats.accepted}</strong><p>Ready for courtside access</p></div></article>
        <article><span className="officials-stat-icon is-gold"><i className="bi bi-hourglass-split" /></span><div><small>Needs response</small><strong>{assignmentStats.pending}</strong><p>Pending confirmations</p></div></article>
        <article><span className="officials-stat-icon is-blue"><i className="bi bi-broadcast-pin" /></span><div><small>Today's games</small><strong>{assignmentStats.today}</strong><p>Scheduled duties today</p></div></article>
      </section>
      {isManager && <section className="card-custom p-3 p-md-4 scorer-access-card">
        <div className="d-flex justify-content-between align-items-start gap-3 mb-3"><div><span className="ops-eyebrow">ONE GAME-DAY WORKFLOW</span><h5 className="fw-bold mb-1">Create a scoring link</h5><p className="text-muted small mb-0">Choose the tournament and scheduled game, then send the scorer a private link and PIN.</p></div><i className="bi bi-clipboard-data fs-3 text-danger"/></div>
        {assignmentMessage && <div className="alert alert-info py-2" role="status">{assignmentMessage}</div>}
        <div className="row g-3 mb-3">
          <div className="col-md-5"><label htmlFor="assignment-tournament" className="form-label small fw-semibold">1. Tournament</label><select id="assignment-tournament" className="form-select" value={selectedTournament} onChange={(event) => setSelectedTournament(event.target.value)}><option value="">Select tournament</option>{tournaments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
          <div className="col-md-7"><label htmlFor="assignment-game" className="form-label small fw-semibold">2. Scheduled game</label><select id="assignment-game" className="form-select" value={selectedMatch} onChange={(event) => setSelectedMatch(event.target.value)} disabled={!matches.length}><option value="">{matches.length ? "Select a game" : "No scheduled games"}</option>{matches.map((item) => <option key={item.id} value={item.id}>{item.team1_name || "TBD"} vs {item.team2_name || "TBD"}</option>)}</select></div>
        </div>
        {!matches.length && selectedTournament && <div className="scorer-empty-hint"><i className="bi bi-calendar2-x"/><span><b>No games scheduled yet.</b> Create or publish the tournament schedule first, then return here to give a scorer access.</span></div>}
        <div className="scorer-mode-heading"><span className="form-label small fw-semibold mb-0">3. Add scorer details</span><small>No FullCourt account needed</small></div>
        <form onSubmit={generateScoringLink} className="scorer-method-form scoring-link-form">
          <label><span>Scorer name</span><input value={linkOperator} onChange={event=>setLinkOperator(event.target.value)} placeholder="Enter the person recording the game" required/></label>
          <label><span>Link expires after</span><select value={linkHours} onChange={event=>setLinkHours(event.target.value)}><option value="4">4 hours</option><option value="8">8 hours</option><option value="12">12 hours</option><option value="24">24 hours</option></select></label>
          <button disabled={linkBusy||!selectedMatch||!linkOperator.trim()}>{linkBusy?"Generating…":<><i className="bi bi-send-fill"/> Generate secure link</>}</button>
        </form>
        {scoringAccess&&<div className="scoring-invite-card"><div><small>READY TO SEND</small><h5>{scoringAccess.operator_label}</h5><p>Expires {new Date(scoringAccess.expires_at).toLocaleString()}</p></div><label><span>Secure game link</span><input readOnly value={scoringAccess.url}/></label><div className="scoring-pin"><span>ACCESS PIN</span><strong>{scoringAccess.pin}</strong></div><div className="scoring-invite-actions"><button type="button" onClick={copyScoringInvite}><i className="bi bi-copy"/> Copy invitation</button><a href={scoringAccess.url} target="_blank" rel="noreferrer"><i className="bi bi-box-arrow-up-right"/> Preview</a><button type="button" className="danger" onClick={revokeScoringLink}><i className="bi bi-x-circle"/> Revoke</button></div><p className="scoring-link-warning"><i className="bi bi-exclamation-triangle"/> Send the link and PIN only to the designated scorer. Creating another link for this game automatically disables the previous one.</p></div>}
      </section>}
      <div className="nav nav-pills gap-2 mb-4">
        <button
          className={`nav-link ${tab === "assignments" ? "active" : ""}`}
          onClick={() => setTab("assignments")}
        >
          Game Assignments <span className="officials-tab-count">{assignments.length}</span>
        </button>
        {isManager && (
          <button
            className={`nav-link ${tab === "corrections" ? "active" : ""}`}
            onClick={() => setTab("corrections")}
          >
            Score Corrections <span className="officials-tab-count">{corrections.length}</span>
          </button>
        )}
      </div>
      {tab === "assignments" && (
        <>
        <div className="officials-toolbar">
          <label className="officials-search"><i className="bi bi-search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team, tournament, venue, or statistician" /></label>
          <select aria-label="Filter assignment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="declined">Declined</option>
          </select>
          <select aria-label="Filter statistician assignments" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">Statistician</option>{roles.map((role) => <option value={role} key={role}>{role}</option>)}
          </select>
        </div>
        <div className="officials-list-heading"><div><span>GAME-DAY CREW</span><h2>{isManager ? 'All statistician assignments' : 'Your game assignments'}</h2></div><small>{visibleAssignments.length} {visibleAssignments.length === 1 ? 'assignment' : 'assignments'}</small></div>
        <div className="row g-3">
          {assignments.length === 0 ? (
            <div className="ops-empty"><i className="bi bi-calendar2-x"/><strong>No game assignments</strong><p>Statistician assignments will appear here.</p>
            </div>
          ) : visibleAssignments.length === 0 ? (
            <div className="ops-empty"><i className="bi bi-funnel"/><strong>No matching assignments</strong><p>Try changing the search text or filters.</p><button className="btn btn-outline-danger btn-sm mt-2" onClick={() => { setSearch(""); setStatusFilter("all"); setRoleFilter("all"); }}>Clear filters</button></div>
          ) : (
            visibleAssignments.map((a) => (
              <div className="col-md-6 col-xl-4" key={a.id}>
                <article className="official-assignment-card h-100">
                  <div className="d-flex justify-content-between">
                    <span className="badge bg-dark">{a.assignment_role}</span>
                    <span
                      className={`badge ${a.status === "accepted" ? "bg-success" : a.status === "declined" ? "bg-danger" : "bg-warning text-dark"}`}
                    >
                      {a.status}
                    </span>
                  </div>
                  <h5 className="fw-bold mt-3">
                    {a.home_team || "TBD"} vs {a.away_team || "TBD"}
                  </h5>
                  <p className="small text-muted mb-2">{a.tournament_name}</p>
                  <div className="small mb-1">
                    <i className="bi bi-calendar3 me-2" />
                    {a.scheduled_start_time
                      ? new Date(a.scheduled_start_time).toLocaleString()
                      : "To be scheduled"}
                  </div>
                  <div className="small">
                    <i className="bi bi-geo-alt me-2" />
                    {a.venue_name || a.court_name || "Court TBA"}
                  </div>
                  {!isManager && a.status === "pending" && (
                    <div className="d-flex gap-2 mt-4">
                      <button
                        className="btn btn-success btn-sm"
                        onClick={() => respond(a.id, "accepted")}
                      >
                        Accept
                      </button>
                      <button
                        className="btn btn-outline-danger btn-sm"
                        onClick={() => respond(a.id, "declined")}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                  {a.status === "accepted" && (
                    <button
                      className="btn btn-outline-warning btn-sm mt-3 w-100"
                      onClick={() => generateAccess(a)}
                    >
                      <i className="bi bi-qr-code me-2" />
                      Generate one-time access QR
                    </button>
                  )}
                  {isManager && (
                    <div className="small text-muted mt-3">
                      Assigned to: {a.assignee_name}
                    </div>
                  )}
                </article>
              </div>
            ))
          )}
        </div>
        </>
      )}
      {tab === "corrections" && (
        <div className="card-custom p-3">
          <div className="table-responsive">
            <table className="table table-modern align-middle">
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Original</th>
                  <th>Requested</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Audit history</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-4">
                      <div className="ops-empty"><i className="bi bi-journal-check"/><strong>No score corrections yet</strong><p>When a scorer requests a score change, its original score, requested score, reason, decision, and reviewer will be recorded here.</p></div>
                    </td>
                  </tr>
                ) : (
                  corrections.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <b>
                          {c.home_team} vs {c.away_team}
                        </b>
                        <small className="d-block text-muted">
                          {c.tournament_name}
                        </small>
                      </td>
                      <td>
                        {c.original_home_score}–{c.original_away_score}
                      </td>
                      <td className="fw-bold text-evsu-primary">
                        {c.requested_home_score}–{c.requested_away_score}
                      </td>
                      <td>{c.reason}</td>
                      <td>
                        <span
                          className={`badge ${c.status === "approved" ? "bg-success" : c.status === "rejected" ? "bg-danger" : "bg-warning text-dark"}`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="small">
                        <div><b>Requested:</b> {c.requester_name || 'Unknown'}<br/><span className="text-muted">{c.created_at ? new Date(c.created_at).toLocaleString() : 'Time unavailable'}</span></div>
                        {c.reviewed_at && <div className="mt-1"><b>Reviewed:</b> {c.reviewer_name || 'Unknown'}<br/><span className="text-muted">{new Date(c.reviewed_at).toLocaleString()}</span></div>}
                        {c.supporting_notes && <div className="mt-1"><b>Notes:</b> {c.supporting_notes}</div>}
                      </td>
                      <td className="text-end">
                        {c.status === "pending" && (
                          <div className="btn-group">
                            <button
                              className="btn btn-success btn-sm"
                              onClick={() => review(c.id, "approved")}
                            >
                              Approve
                            </button>
                            <button
                              className="btn btn-outline-danger btn-sm"
                              onClick={() => review(c.id, "rejected")}
                            >
                              Reject
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {accessQr && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,.7)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header">
                <h5 className="fw-bold mb-0">One-time Statistician Game Access</h5>
                <button
                  className="btn-close"
                  onClick={() => setAccessQr(null)}
                />
              </div>
              <div className="modal-body text-center">
                <img
                  src={accessQr.image}
                  alt="Statistician game access QR"
                  className="img-fluid border rounded-3"
                  style={{ maxWidth: 320 }}
                />
                <h5 className="fw-bold mt-3">
                  {accessQr.home_team} vs {accessQr.away_team}
                </h5>
                <p className="text-muted small mb-1">
                  {accessQr.assignment_role}
                </p>
                <div className="alert alert-warning small mt-3">
                  Expires in {accessQr.expires_in_hours} hours and can only be
                  used once. Generate a new code if this one is lost.
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfficialsWorkspace;
