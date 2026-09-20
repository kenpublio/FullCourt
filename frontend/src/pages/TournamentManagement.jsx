import React, { useState, useEffect, useCallback } from "react";
import tournamentService from "../services/tournamentService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import operationsService from "../services/operationsService";
import teamService from "../services/teamService";
import scheduleService from "../services/scheduleService";
import { Link } from "react-router-dom";

const TournamentManagement = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [divisionTournament, setDivisionTournament] = useState(null);
  const [detailTournament, setDetailTournament] = useState(null);
  const [detailData, setDetailData] = useState({ divisions: [], teams: [], matches: [] });
  const [detailLoading, setDetailLoading] = useState(false);
  const [divisions, setDivisions] = useState([]);
  const [divisionForm, setDivisionForm] = useState({
    name: "",
    age_group: "",
    min_age: "",
    max_age: "",
    gender_category: "open",
    format: "round_robin",
    max_roster_size: 15,
    eligibility_requirements: "",
  });

  const [formData, setFormData] = useState({
    name: "",
    sport_id: "",
    format: "single_elimination",
    start_date: "",
    end_date: "",
    registration_fee: 0,
    rules: "",
    description: "",
    status: "upcoming",
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const res = await tournamentService.getTournaments();
      setTournaments(res.tournaments || []);
      const basketballSports = (res.sports || []).filter(
        (s) => s.name.toLowerCase() === "basketball",
      );
      if (basketballSports.length > 0) {
        setFormData((prev) => prev.sport_id ? prev : ({ ...prev, sport_id: basketballSports[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await tournamentService.createTournament(formData);
      setMsg("Tournament created successfully!");
      setShowModal(false);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Error creating tournament");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this tournament?")) return;
    try {
      await tournamentService.deleteTournament(id);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || "Error deleting tournament");
    }
  };

  const openDivisions = async (tournament) => {
    setDivisionTournament(tournament);
    setDivisions(await operationsService.divisions(tournament.id));
  };
  const openDetails = async (tournament) => {
    setDetailTournament(tournament);
    setDetailLoading(true);
    try {
      const [divisionRows, teamRows, matchRows] = await Promise.all([
        operationsService.divisions(tournament.id).catch(()=>[]),
        teamService.getTeams().catch(()=>[]),
        scheduleService.getSchedule(tournament.id).catch(()=>[]),
      ]);
      setDetailData({ divisions: divisionRows, teams: teamRows.filter(team=>Number(team.tournament_id)===Number(tournament.id)), matches: matchRows });
    } finally { setDetailLoading(false); }
  };
  const createDivision = async (event) => {
    event.preventDefault();
    await operationsService.createDivision(divisionTournament.id, divisionForm);
    setDivisions(await operationsService.divisions(divisionTournament.id));
    setDivisionForm({
      ...divisionForm,
      name: "",
      age_group: "",
      eligibility_requirements: "",
    });
  };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-trophy-fill text-evsu-primary me-2"></i>
            Tournament Operations
          </h3>
          <p className="text-muted small mb-0">
            {['coach', 'coach_manager'].includes(user?.role)
              ? 'View competitions, divisions, formats, and registration details'
              : 'Create and manage basketball leagues, divisions, and tournament formats'}
          </p>
        </div>
        {[
          "platform_admin",
          "admin",
          "organization_admin",
          "tournament_organizer",
        ].includes(user?.role) && (
          <button className="btn btn-evsu" onClick={() => setShowModal(true)}>
            <i className="bi bi-plus-lg me-1"></i> Create Tournament
          </button>
        )}
      </div>

      {msg && (
        <div className="alert alert-success py-2 px-3 small rounded-3 mb-3">
          {msg}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading tournaments..." />
      ) : (
        <div className="row g-3">
          {tournaments.map((t) => (
            <div key={t.id} className="col-12 col-md-6 col-xl-4">
              <div className="card-custom p-4 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="d-flex justify-content-between align-items-start mb-2">
                    <span className="badge bg-evsu-gold text-dark text-uppercase">
                      <i className="bi bi-dribbble me-1" /> Basketball
                    </span>
                    <span
                      className={`badge ${t.status === "ongoing" ? "bg-danger" : t.status === "completed" ? "bg-secondary" : "bg-success"}`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <h5 className="fw-bold text-dark mb-2">{t.name}</h5>
                  <p className="text-muted small mb-3">
                    {t.description || "No description provided."}
                  </p>

                  <div className="small text-secondary mb-2">
                    <i className="bi bi-diagram-3 me-2"></i>Format:{" "}
                    <strong className="text-dark">
                      {t.format.replace("_", " ")}
                    </strong>
                  </div>
                  <div className="small text-secondary mb-2">
                    <i className="bi bi-calendar2-range me-2"></i>Dates:{" "}
                    <strong className="text-dark">
                      {t.start_date} to {t.end_date}
                    </strong>
                  </div>
                  <div className="small text-secondary mb-2">
                    <i className="bi bi-cash-stack me-2"></i>Fee:{" "}
                    <strong className="text-success">
                      ₱{parseFloat(t.registration_fee).toFixed(2)}
                    </strong>
                  </div>
                  <div className="small text-secondary">
                    <i className="bi bi-people me-2"></i>Registered Teams:{" "}
                    <strong className="text-dark">
                      {t.registered_teams_count}
                    </strong>
                  </div>
                </div>

                {[ 
                  "platform_admin",
                  "admin",
                  "organization_admin",
                  "tournament_organizer",
                ].includes(user?.role) && (
                  <div className="mt-4 pt-3 border-top d-flex justify-content-end gap-2 flex-wrap">
                    <button className="btn btn-evsu btn-sm" onClick={()=>openDetails(t)}><i className="bi bi-eye me-1"/>View Tournament</button>
                    <button
                      className="btn btn-outline-dark btn-sm"
                      onClick={() => openDivisions(t)}
                    >
                      <i className="bi bi-layers me-1" />
                      Divisions
                    </button>
                    <button
                      className="btn btn-outline-danger btn-sm"
                      onClick={() => handleDelete(t.id)}
                    >
                      <i className="bi bi-trash"></i> Delete
                    </button>
                  </div>
                )}
                {!['platform_admin','admin','organization_admin','tournament_organizer'].includes(user?.role)&&<div className="mt-4 pt-3 border-top"><button className="btn btn-evsu btn-sm w-100" onClick={()=>openDetails(t)}><i className="bi bi-eye me-1"/>View Tournament</button></div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {detailTournament && <div className="modal show d-block tournament-detail-modal" style={{backgroundColor:'rgba(0,0,0,.72)'}} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable"><div className="modal-content card-custom border-0 overflow-hidden">
          <header className="tournament-detail-hero"><button className="btn-close btn-close-white" aria-label="Close" onClick={()=>setDetailTournament(null)}/><span className="tournament-detail-kicker"><i className="bi bi-dribbble"/> FULLCOURT TOURNAMENT</span><h3>{detailTournament.name}</h3><p>{detailTournament.description||'Basketball tournament managed through FullCourt.'}</p><div className="tournament-detail-chips"><span><i className="bi bi-diagram-3"/>{String(detailTournament.format).replaceAll('_',' ')}</span><span><i className="bi bi-calendar-range"/>{detailTournament.start_date} – {detailTournament.end_date}</span><span><i className="bi bi-circle-fill"/>{detailTournament.status}</span></div></header>
          <div className="modal-body tournament-detail-body">
            {detailLoading?<LoadingSpinner message="Loading tournament contents..."/>:<>
              <div className="tournament-detail-stats"><div><i className="bi bi-people-fill"/><strong>{detailData.teams.length}</strong><span>Registered teams</span></div><div><i className="bi bi-layers-fill"/><strong>{detailData.divisions.length}</strong><span>Divisions</span></div><div><i className="bi bi-calendar2-event-fill"/><strong>{detailData.matches.length}</strong><span>Scheduled games</span></div><div><i className="bi bi-cash-stack"/><strong>₱{Number(detailTournament.registration_fee||0).toLocaleString()}</strong><span>Registration fee</span></div></div>
              <div className="row g-4 mt-1"><div className="col-lg-7"><section className="tournament-content-panel"><header><div><small>PARTICIPANTS</small><h5>Registered Teams</h5></div><Link to="/teams">Manage teams <i className="bi bi-arrow-up-right"/></Link></header><div className="tournament-team-grid">{detailData.teams.map(team=><article key={team.id}><span style={{background:team.primary_color||'#cd2d17'}}>{team.logo_url?<img src={team.logo_url} alt=""/>:team.team_name.slice(0,2).toUpperCase()}</span><div><b>{team.team_name}</b><small>{team.division_name||'Open division'} · {team.status}</small></div></article>)}{!detailData.teams.length&&<p className="tournament-detail-empty">No registered teams yet.</p>}</div></section></div><div className="col-lg-5"><section className="tournament-content-panel"><header><div><small>COMPETITION STRUCTURE</small><h5>Divisions</h5></div></header><div className="tournament-division-list">{detailData.divisions.map(division=><div key={division.id}><span><i className="bi bi-layers"/></span><div><b>{division.name}</b><small>{division.age_group||'Open age'} · {division.gender_category} · {division.team_count} teams</small></div></div>)}{!detailData.divisions.length&&<p className="tournament-detail-empty">No divisions created yet.</p>}</div></section></div></div>
            </>}
          </div>
          <footer className="modal-footer"><Link to={`/sports/tournaments/${detailTournament.id}`} className="btn btn-outline-secondary btn-sm" target="_blank"><i className="bi bi-box-arrow-up-right me-1"/>Public tournament page</Link><button className="btn btn-light btn-sm" onClick={()=>setDetailTournament(null)}>Close</button></footer>
        </div></div>
      </div>}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">
                  Create New Tournament
                </h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowModal(false)}
                  aria-label="Close create tournament form"
                ></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Tournament Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="e.g. Barangay Summer Basketball League 2026"
                    />
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">
                        Competition
                      </label>
                      <input
                        className="form-control"
                        value="Basketball"
                        disabled
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">
                        Format
                      </label>
                      <select
                        className="form-select"
                        value={formData.format}
                        onChange={(e) =>
                          setFormData({ ...formData, format: e.target.value })
                        }
                      >
                        <option value="single_elimination">
                          Single Elimination
                        </option>
                        <option value="double_elimination">
                          Double Elimination
                        </option>
                        <option value="round_robin">Round Robin</option>
                        <option value="group_stage">Group Stage</option>
                        <option value="league">League</option>
                      </select>
                    </div>
                  </div>
                  <div className="row g-2 mb-3">
                    <div className="col-6">
                      <label className="form-label small fw-semibold">
                        Start Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.start_date}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            start_date: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-6">
                      <label className="form-label small fw-semibold">
                        End Date
                      </label>
                      <input
                        type="date"
                        className="form-control"
                        required
                        value={formData.end_date}
                        onChange={(e) =>
                          setFormData({ ...formData, end_date: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">
                      Registration Fee (₱)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="form-control"
                      value={formData.registration_fee}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          registration_fee: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button
                    type="button"
                    className="btn btn-light btn-sm"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-evsu btn-sm">
                    Create Tournament
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {divisionTournament && (
        <div
          className="modal show d-block"
          style={{ backgroundColor: "rgba(0,0,0,.55)" }}
        >
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header">
                <div>
                  <h5 className="fw-bold mb-0">Tournament Divisions</h5>
                  <small className="text-muted">
                    {divisionTournament.name}
                  </small>
                </div>
                <button
                  className="btn-close"
                  onClick={() => setDivisionTournament(null)}
                />
              </div>
              <div className="modal-body">
                <div className="row g-2 mb-4">
                  {divisions.map((d) => (
                    <div className="col-md-6" key={d.id}>
                      <div className="border rounded-3 p-3">
                        <div className="d-flex justify-content-between">
                          <b>{d.name}</b>
                          <span className="badge bg-dark">
                            {d.team_count} teams
                          </span>
                        </div>
                        <small className="text-muted">
                          {d.age_group || "Open age"} · {d.gender_category} ·{" "}
                          {d.format.replaceAll("_", " ")}
                        </small>
                        {(d.min_age !== null || d.max_age !== null) && <div className="small text-success mt-1"><i className="bi bi-shield-check me-1"/>Auto-validation: ages {d.min_age ?? 0}–{d.max_age ?? 'and above'}</div>}
                      </div>
                    </div>
                  ))}
                  {divisions.length === 0 && (
                    <p className="text-muted">No divisions yet.</p>
                  )}
                </div>
                <form onSubmit={createDivision}>
                  <h6 className="fw-bold">Add Division</h6>
                  <div className="row g-2">
                    <div className="col-md-6">
                      <input
                        required
                        className="form-control"
                        placeholder="Division name"
                        value={divisionForm.name}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            name: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        className="form-control"
                        placeholder="Age group, e.g. Under 18"
                        value={divisionForm.age_group}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            age_group: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4">
                      <select
                        className="form-select"
                        value={divisionForm.gender_category}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            gender_category: e.target.value,
                          })
                        }
                      >
                        <option value="open">Open</option>
                        <option value="mens">Men's</option>
                        <option value="womens">Women's</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <select
                        className="form-select"
                        value={divisionForm.format}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            format: e.target.value,
                          })
                        }
                      >
                        <option value="round_robin">Round Robin</option>
                        <option value="single_elimination">
                          Single Elimination
                        </option>
                        <option value="group_playoffs">Group + Playoffs</option>
                      </select>
                    </div>
                    <div className="col-md-4">
                      <input
                        type="number"
                        min="5"
                        max="20"
                        className="form-control"
                        value={divisionForm.max_roster_size}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            max_roster_size: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="col-md-4"><input type="number" min="0" max="99" className="form-control" placeholder="Minimum age" value={divisionForm.min_age} onChange={e=>setDivisionForm({...divisionForm,min_age:e.target.value})}/></div>
                    <div className="col-md-4"><input type="number" min="0" max="99" className="form-control" placeholder="Maximum age" value={divisionForm.max_age} onChange={e=>setDivisionForm({...divisionForm,max_age:e.target.value})}/></div>
                    <div className="col-12">
                      <textarea
                        className="form-control"
                        placeholder="Eligibility requirements"
                        value={divisionForm.eligibility_requirements}
                        onChange={(e) =>
                          setDivisionForm({
                            ...divisionForm,
                            eligibility_requirements: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <button className="btn btn-evsu mt-3">Add Division</button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TournamentManagement;
