import React, { useState, useEffect, useCallback } from "react";
import tournamentService from "../services/tournamentService";
import LoadingSpinner from "../components/LoadingSpinner";
import { useAuth } from "../hooks/useAuth";
import operationsService from "../services/operationsService";
import teamService from "../services/teamService";
import scheduleService from "../services/scheduleService";
import { Link } from "react-router-dom";

const divisionPresets = {
  custom: { name: "", min_age: "", max_age: "" },
  "12u": { name: "12 Under", min_age: "", max_age: 12 },
  "14u": { name: "14 Under", min_age: "", max_age: 14 },
  "16u": { name: "16 Under", min_age: "", max_age: 16 },
  "18u": { name: "18 Under", min_age: "", max_age: 18 },
  junior: { name: "Junior Category", min_age: 13, max_age: 21 },
  senior: { name: "Senior Category", min_age: 25, max_age: "" },
  open: { name: "Open Age", min_age: "", max_age: "" },
};

const ageRangeLabel = (division) => {
  if (division.min_age === null && division.max_age === null) return "Open age · no age restriction";
  if (division.min_age === null) return `Age ${division.max_age} and below`;
  if (division.max_age === null) return `Age ${division.min_age} and above`;
  return `Ages ${division.min_age}–${division.max_age}`;
};

const TournamentManagement = () => {
  const { user } = useAuth();
  const [tournaments, setTournaments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [joinTournament, setJoinTournament] = useState(null);
  const [joinLogo, setJoinLogo] = useState(null);
  const [joinForm, setJoinForm] = useState({ team_name: '', short_name: '', primary_color: 'red' });
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
    age_cutoff_date: "",
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

  const submitTeamApplication = async (event) => {
    event.preventDefault();
    try {
      const response=await teamService.registerTeam({...joinForm,tournament_id:joinTournament.id});
      const teamId=response?.data?.team_id;
      if (joinLogo && teamId) await teamService.uploadLogo(teamId,joinLogo);
      setMsg('Team application submitted. Wait for the organizer to approve your team.');
      setJoinTournament(null);
      setJoinLogo(null);
      setJoinForm({team_name:'',short_name:'',primary_color:'red'});
      await loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to submit the team application.');
    }
  };

  const applicationLabel=(status)=>status==='draft'?'Application Pending':status==='registered'?'Team Approved':status==='disqualified'?'Application Rejected':'Join Tournament';

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
    try {
      await operationsService.createDivision(divisionTournament.id, divisionForm);
      setDivisions(await operationsService.divisions(divisionTournament.id));
      setDivisionForm({ ...divisionForm, name: "", age_group: "", min_age: "", max_age: "", age_cutoff_date: "", eligibility_requirements: "" });
      setMsg("Division added successfully.");
    } catch (error) {
      setMsg(error.response?.data?.message || "Unable to add the division.");
    }
  };

  const applyDivisionPreset = (presetKey) => {
    const preset = divisionPresets[presetKey];
    if (!preset) return;
    setDivisionForm((current) => ({ ...current, ...preset, age_group: presetKey === "open" ? "Open age" : preset.name }));
  };

  const tournamentStats = {
    total: tournaments.length,
    ongoing: tournaments.filter((t) => t.status === "ongoing").length,
    upcoming: tournaments.filter((t) => t.status === "upcoming").length,
    teams: tournaments.reduce((sum, t) => sum + Number(t.registered_teams_count || 0), 0),
  };
  const canManageTournaments = [
    "platform_admin",
    "admin",
    "organization_admin",
    "tournament_organizer",
  ].includes(user?.role);

  return (
    <div className="container-fluid p-0 tournament-operations-page">
      <section className="tournament-ops-hero">
        <div className="tournament-ops-copy">
          <span className="tournament-ops-eyebrow"><i className="bi bi-dribbble" /> BASKETBALL COMPETITIONS</span>
          <h1>Tournament Operations</h1>
          <p>
            {['coach', 'coach_manager'].includes(user?.role)
              ? 'View competitions, divisions, formats, and registration details'
              : 'Create and manage basketball leagues, divisions, and tournament formats'}
          </p>
          <div className="tournament-ops-meta"><span><i className="bi bi-trophy" /> One place for every competition</span><span><i className="bi bi-shield-check" /> Organized tournament details</span></div>
        </div>
        <div className="tournament-ops-hero-side">
          <span className="tournament-ops-emblem"><i className="bi bi-trophy-fill" /></span>
          {canManageTournaments && <button className="btn btn-evsu tournament-ops-create" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg me-1" /> Create Tournament</button>}
        </div>
        <i className="bi bi-dribbble tournament-ops-watermark" aria-hidden="true" />
      </section>

      {!loading && <section className="tournament-ops-summary" aria-label="Tournament summary">
        <div><span className="tournament-ops-stat-icon"><i className="bi bi-trophy" /></span><span><b>{tournamentStats.total}</b><small>Total tournaments</small></span></div>
        <div><span className="tournament-ops-stat-icon is-live"><i className="bi bi-broadcast" /></span><span><b>{tournamentStats.ongoing}</b><small>Live competitions</small></span></div>
        <div><span className="tournament-ops-stat-icon is-upcoming"><i className="bi bi-calendar-event" /></span><span><b>{tournamentStats.upcoming}</b><small>Upcoming</small></span></div>
        <div><span className="tournament-ops-stat-icon is-teams"><i className="bi bi-people" /></span><span><b>{tournamentStats.teams}</b><small>Registered teams</small></span></div>
      </section>}

      {msg && (
        <div className="alert alert-success py-2 px-3 small rounded-3 mb-3">
          {msg}
        </div>
      )}

      {loading ? (
        <LoadingSpinner message="Loading tournaments..." />
      ) : (
        <>
        <div className="tournament-ops-list-heading"><div><span>COMPETITION DIRECTORY</span><h2>{['coach', 'coach_manager'].includes(user?.role) ? 'Available tournaments' : 'Your tournaments'}</h2></div><small>{tournaments.length} {tournaments.length === 1 ? 'tournament' : 'tournaments'}</small></div>
        {tournaments.length ? <div className="row g-3 tournament-ops-grid">
          {tournaments.map((t) => (
            <div key={t.id} className="col-12 col-md-6 col-xl-4">
              <div className="card-custom tournament-ops-card p-4 h-100 d-flex flex-column justify-content-between">
                <div>
                  <div className="tournament-ops-card-top">
                    <span className="tournament-ops-sport"><i className="bi bi-dribbble" /> BASKETBALL</span>
                    <span className={`tournament-ops-status ${t.status === 'ongoing' ? 'is-live' : t.status === 'completed' ? 'is-complete' : 'is-upcoming'}`}><i className="bi bi-circle-fill" /> {t.status || 'upcoming'}</span>
                  </div>
                  <h3 className="tournament-ops-card-title">{t.name}</h3>
                  <p className="tournament-ops-card-description">
                    {t.description || "No description provided."}
                  </p>

                  <div className="tournament-ops-facts">
                    <div><span><i className="bi bi-diagram-3" /> Format</span><b>{String(t.format || 'Not set').replaceAll('_', ' ')}</b></div>
                    <div><span><i className="bi bi-calendar2-range" /> Dates</span><b>{t.start_date || 'TBD'} <em>to</em> {t.end_date || 'TBD'}</b></div>
                    <div><span><i className="bi bi-cash-stack" /> Entry fee</span><b className="fee">₱{Number(t.registration_fee || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</b></div>
                    <div><span><i className="bi bi-people" /> Teams</span><b>{Number(t.registered_teams_count || 0)} registered</b></div>
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
                {['coach','coach_manager'].includes(user?.role)&&<div className="mt-4 pt-3 border-top">
                  {t.application_team_id ? <>
                    <div className={`alert py-2 px-3 small mb-2 ${t.application_status==='registered'?'alert-success':t.application_status==='disqualified'?'alert-danger':'alert-warning'}`}>
                      <i className={`bi me-2 ${t.application_status==='registered'?'bi-check-circle-fill':t.application_status==='disqualified'?'bi-x-circle-fill':'bi-hourglass-split'}`}/>
                      <b>{applicationLabel(t.application_status)}</b>{t.application_team_name ? ` · ${t.application_team_name}` : ''}
                    </div>
                    {t.application_status==='registered'&&<button className="btn btn-evsu btn-sm w-100" onClick={()=>openDetails(t)}><i className="bi bi-eye me-1"/>View Tournament</button>}
                  </> : <button className="btn btn-evsu btn-sm w-100" onClick={()=>setJoinTournament(t)}><i className="bi bi-box-arrow-in-right me-1"/>Join Tournament</button>}
                </div>}
              </div>
            </div>
          ))}
        </div> : <div className="tournament-ops-empty"><span><i className="bi bi-trophy" /></span><h3>No tournaments yet</h3><p>{canManageTournaments ? 'Create your first basketball competition to get divisions, teams, and schedules organized.' : 'There are no competitions to show right now. Check back when an organizer publishes one.'}</p>{canManageTournaments && <button className="btn btn-evsu" onClick={() => setShowModal(true)}><i className="bi bi-plus-lg me-1" /> Create first tournament</button>}</div>}
        </>
      )}

      {/* Create Modal */}
      {joinTournament&&<div className="modal show d-block" style={{backgroundColor:'rgba(0,0,0,.72)'}} role="dialog" aria-modal="true">
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content card-custom border-0 overflow-hidden">
          <div className="modal-header border-bottom"><div><small className="text-danger fw-bold">TEAM APPLICATION</small><h5 className="fw-bold mb-0">Join {joinTournament.name}</h5></div><button className="btn-close" onClick={()=>setJoinTournament(null)} aria-label="Close"/></div>
          <form onSubmit={submitTeamApplication}><div className="modal-body">
            <div className="alert alert-light border small"><i className="bi bi-info-circle-fill text-danger me-2"/>Submit your team first. After approval, complete your roster, player eligibility, and payment requirements.</div>
            <div className="mb-3"><label className="form-label small fw-semibold">Team Name</label><input required className="form-control" value={joinForm.team_name} onChange={e=>setJoinForm({...joinForm,team_name:e.target.value})} placeholder="e.g. Barangay Cogon Ballers"/></div>
            <div className="mb-3"><label className="form-label small fw-semibold">Team Short Name</label><input required maxLength="20" className="form-control" value={joinForm.short_name} onChange={e=>setJoinForm({...joinForm,short_name:e.target.value})} placeholder="e.g. COGON"/></div>
            <div className="mb-3"><label className="form-label small fw-semibold">Jersey Color</label><div className="d-flex gap-2 align-items-center"><span className="rounded-circle border" style={{width:34,height:34,background:joinForm.primary_color}}/><input required className="form-control" list="application-colors" value={joinForm.primary_color} onChange={e=>setJoinForm({...joinForm,primary_color:e.target.value})}/><datalist id="application-colors"><option value="red"/><option value="blue"/><option value="black"/><option value="white"/><option value="green"/><option value="yellow"/><option value="maroon"/><option value="navy"/></datalist></div></div>
            <div><label className="form-label small fw-semibold">Team Logo <span className="text-muted">(optional)</span></label><input type="file" className="form-control" accept="image/jpeg,image/png,image/webp" onChange={e=>setJoinLogo(e.target.files?.[0]||null)}/></div>
          </div><div className="modal-footer border-top"><button type="button" className="btn btn-light" onClick={()=>setJoinTournament(null)}>Cancel</button><button className="btn btn-evsu"><i className="bi bi-send me-1"/>Submit Application</button></div></form>
        </div></div>
      </div>}
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
                        <div className="small text-success mt-1"><i className="bi bi-shield-check me-1"/>Auto-validation: {ageRangeLabel(d)}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-calendar-check me-1"/>Cutoff: {d.age_cutoff_date || divisionTournament.start_date || "Tournament start date"}</div>
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
                    <div className="col-12">
                      <label htmlFor="division-preset" className="form-label small fw-semibold">Quick preset</label>
                      <select id="division-preset" className="form-select" defaultValue="custom" onChange={(e) => applyDivisionPreset(e.target.value)}>
                        <option value="custom">Custom division</option>
                        <option value="12u">12 Under</option>
                        <option value="14u">14 Under</option>
                        <option value="16u">16 Under</option>
                        <option value="18u">18 Under</option>
                        <option value="junior">Junior Category (13–21)</option>
                        <option value="senior">Senior Category (25 and above)</option>
                        <option value="open">Open Age</option>
                      </select>
                      <div className="form-text">Presets fill the fields below. You can still edit the name and age limits.</div>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="division-name" className="form-label small fw-semibold">Division name</label>
                      <input
                        id="division-name"
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
                      <label htmlFor="division-age-label" className="form-label small fw-semibold">Display label (optional)</label>
                      <input
                        id="division-age-label"
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
                    <div className="col-md-4"><label htmlFor="division-min-age" className="form-label small fw-semibold">Minimum age</label><input id="division-min-age" type="number" min="0" max="99" className="form-control" placeholder="No minimum" value={divisionForm.min_age} onChange={e=>setDivisionForm({...divisionForm,min_age:e.target.value})}/></div>
                    <div className="col-md-4"><label htmlFor="division-max-age" className="form-label small fw-semibold">Maximum age</label><input id="division-max-age" type="number" min="0" max="99" className="form-control" placeholder="No maximum" value={divisionForm.max_age} onChange={e=>setDivisionForm({...divisionForm,max_age:e.target.value})}/></div>
                    <div className="col-md-4"><label htmlFor="division-cutoff" className="form-label small fw-semibold">Age cutoff date</label><input id="division-cutoff" type="date" className="form-control" value={divisionForm.age_cutoff_date} onChange={e=>setDivisionForm({...divisionForm,age_cutoff_date:e.target.value})}/><div className="form-text">Blank uses tournament start date.</div></div>
                    <div className="col-12"><div className="alert alert-light border py-2 mb-0 small"><i className="bi bi-info-circle me-2 text-primary"/>{divisionForm.min_age === "" && divisionForm.max_age === "" ? "Open age: no automatic age restriction." : divisionForm.min_age === "" ? `Eligible up to age ${divisionForm.max_age}.` : divisionForm.max_age === "" ? `Eligible from age ${divisionForm.min_age} and above.` : `Eligible from age ${divisionForm.min_age} to ${divisionForm.max_age}.`}</div></div>
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
