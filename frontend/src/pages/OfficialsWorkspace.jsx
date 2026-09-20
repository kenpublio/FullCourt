import { useCallback, useEffect, useMemo, useState } from "react";
import gameOperationsService from "../services/gameOperationsService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import QRCode from "qrcode";
import "../styles/operations-polish.css";

const OfficialsWorkspace = () => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("assignments");
  const [accessQr, setAccessQr] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [search, setSearch] = useState("");
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
    try {
      setAssignments(await gameOperationsService.assignments());
      if (isManager) setCorrections(await gameOperationsService.corrections());
    } finally {
      setLoading(false);
    }
  }, [isManager]);
  useEffect(() => {
    load();
  }, [load]);
  const respond = async (id, status) => {
    await gameOperationsService.respond(id, status);
    await load();
  };
  const review = async (id, status) => {
    await gameOperationsService.reviewCorrection(id, status);
    await load();
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
        <div><span className="ops-eyebrow">COURTSIDE OPERATIONS</span><h3 className="fw-bold mb-1">
          <i className="bi bi-whistle text-evsu-primary me-2" />
          Officials Workspace
        </h3>
        <p className="text-muted small mb-0">
          Referee, scorer, and statistician assignments with controlled score
          corrections
        </p></div><div className="ops-head-mark"><i className="bi bi-whistle"/></div>
      </div>
      <section className="officials-command-grid" aria-label="Officials operations summary">
        <article><span className="officials-stat-icon is-red"><i className="bi bi-clipboard2-check" /></span><div><small>Total duties</small><strong>{assignmentStats.total}</strong><p>All assigned game roles</p></div></article>
        <article><span className="officials-stat-icon is-green"><i className="bi bi-check2-circle" /></span><div><small>Confirmed</small><strong>{assignmentStats.accepted}</strong><p>Ready for courtside access</p></div></article>
        <article><span className="officials-stat-icon is-gold"><i className="bi bi-hourglass-split" /></span><div><small>Needs response</small><strong>{assignmentStats.pending}</strong><p>Pending confirmations</p></div></article>
        <article><span className="officials-stat-icon is-blue"><i className="bi bi-broadcast-pin" /></span><div><small>Today's games</small><strong>{assignmentStats.today}</strong><p>Scheduled duties today</p></div></article>
      </section>
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
          <label className="officials-search"><i className="bi bi-search"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team, tournament, venue, or official" /></label>
          <select aria-label="Filter assignment status" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option><option value="pending">Pending</option><option value="accepted">Accepted</option><option value="declined">Declined</option>
          </select>
          <select aria-label="Filter official role" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All official roles</option>{roles.map((role) => <option value={role} key={role}>{role}</option>)}
          </select>
        </div>
        <div className="row g-3">
          {assignments.length === 0 ? (
            <div className="ops-empty"><i className="bi bi-calendar2-x"/><strong>No game assignments</strong><p>Accepted referee, scorer, and statistician duties will appear here.</p>
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
                  <th />
                </tr>
              </thead>
              <tbody>
                {corrections.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center text-muted py-4">
                      No correction requests.
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
                <h5 className="fw-bold mb-0">One-time Official Game Access</h5>
                <button
                  className="btn-close"
                  onClick={() => setAccessQr(null)}
                />
              </div>
              <div className="modal-body text-center">
                <img
                  src={accessQr.image}
                  alt="Official game access QR"
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
