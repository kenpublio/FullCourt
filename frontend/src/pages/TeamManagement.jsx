import React, { useState, useEffect, useMemo } from 'react';
import teamService from '../services/teamService';
import tournamentService from '../services/tournamentService';
import LoadingSpinner from '../components/LoadingSpinner';
import eligibilityService from '../services/eligibilityService';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import operationsService from '../services/operationsService';

const TeamManagement = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [divisions, setDivisions] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [selectedDivision, setSelectedDivision] = useState('');
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [formData, setFormData] = useState({ team_name: '', short_name:'', tournament_id: '', division_id:'', primary_color:'#F97316' });
  const [inviteTeam, setInviteTeam] = useState(null);
  const [playerIdentifier, setPlayerIdentifier] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [pageMessage, setPageMessage] = useState('');
  const [logoFile, setLogoFile] = useState(null);
  const [rosterTeam, setRosterTeam] = useState(null);
  const [rosterPlayers, setRosterPlayers] = useState([]);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [editingRosterPlayer, setEditingRosterPlayer] = useState(null);
  const [rosterJersey, setRosterJersey] = useState('');
  const [rosterPosition, setRosterPosition] = useState('');
  const apiRoot = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8767/api').replace(/\/api\/?$/, '');
  const mediaUrl = (path) => path?.startsWith('http') ? path : `${apiRoot}${path}`;
  const isCoach = ['coach','coach_manager'].includes(user?.role);
  const tournamentTeams = useMemo(() => isCoach ? teams : teams.filter(team => String(team.tournament_id) === String(selectedTournament)), [teams, selectedTournament, isCoach]);
  const filterDivisions = useMemo(() => [...new Map(tournamentTeams.filter(team => team.division_id).map(team => [String(team.division_id), {id:team.division_id,name:team.division_name || 'Division'}])).values()], [tournamentTeams]);
  const visibleTeams = useMemo(() => selectedDivision ? tournamentTeams.filter(team => String(team.division_id) === String(selectedDivision)) : tournamentTeams, [tournamentTeams, selectedDivision]);

  const loadData = async () => {
    try {
      setLoading(true);
      const tData = await teamService.getTeams();
      const tourRes = await tournamentService.getTournaments();
      setTeams(tData);
      setTournaments(tourRes.tournaments || []);
      if (tourRes.tournaments?.length > 0) {
        setFormData(prev => ({ ...prev, tournament_id: tourRes.tournaments[0].id }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!formData.tournament_id) return setDivisions([]);
    operationsService.divisions(formData.tournament_id).then(rows => {
      setDivisions(rows);
      if (rows[0]) setFormData(current => current.division_id ? current : ({...current, division_id:rows[0].id}));
    });
  }, [formData.tournament_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let teamId;
      if (editingTeam) {
        await teamService.updateTeam(editingTeam.id, formData);
        teamId = editingTeam.id;
        setPageMessage('Team updated successfully.');
      } else {
        const response = await teamService.registerTeam(formData);
        teamId = response?.data?.team_id;
        setPageMessage('Team registered successfully.');
      }
      if (logoFile && teamId) await teamService.uploadLogo(teamId, logoFile);
      setShowModal(false);
      setEditingTeam(null);
      setLogoFile(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Error registering team');
    }
  };

  const openCreate = () => {
    setEditingTeam(null);
    setLogoFile(null);
    setFormData({
      team_name: '',
      short_name: '',
      tournament_id: selectedTournament || tournaments[0]?.id || '',
      division_id: '',
      primary_color: '#F97316',
    });
    setShowModal(true);
  };

  const openEdit = (team) => {
    setEditingTeam(team);
    setLogoFile(null);
    setFormData({
      team_name: team.team_name || '',
      short_name: team.short_name || '',
      tournament_id: team.tournament_id || '',
      division_id: team.division_id || '',
      primary_color: team.primary_color || '#F97316',
    });
    setShowModal(true);
  };

  const viewRoster = async (team) => {
    setRosterTeam(team);
    setRosterPlayers([]);
    setRosterLoading(true);
    try {
      const data = await teamService.getRoster(team.id);
      setRosterTeam(data.team || team);
      setRosterPlayers(data.players || []);
    } catch (err) {
      setPageMessage(err.response?.data?.message || 'Unable to load the team roster.');
      setRosterTeam(null);
    } finally {
      setRosterLoading(false);
    }
  };

  const startRosterEdit = (player) => {
    setEditingRosterPlayer(player);
    setRosterJersey(player.jersey_number ?? '');
    setRosterPosition(player.position ?? '');
  };

  const saveRosterPlayer = async (e) => {
    e.preventDefault();
    if (!editingRosterPlayer) return;
    try {
      await eligibilityService.updateRoster(editingRosterPlayer.id, rosterJersey, rosterPosition);
      setRosterPlayers(players => players.map(player => player.id === editingRosterPlayer.id
        ? { ...player, jersey_number: rosterJersey, position: rosterPosition }
        : player));
      setEditingRosterPlayer(null);
      setPageMessage('Player jersey number and position updated.');
    } catch (err) {
      setPageMessage(err.response?.data?.message || 'Unable to update the roster player.');
    }
  };

  const deleteTeam = async (team) => {
    if (!window.confirm(`Delete ${team.team_name}? This will also remove its roster and invitations.`)) return;
    try {
      await teamService.deleteTeam(team.id);
      setPageMessage('Team deleted successfully.');
      await loadData();
    } catch (err) {
      setPageMessage(err.response?.data?.message || 'Unable to delete this team.');
    }
  };

  const sendInvitation = async (e) => {
    e.preventDefault();
    setInviteMessage('');
    try {
      const response = await eligibilityService.addPlayer({
        team_id: inviteTeam.id,
        player_identifier: playerIdentifier,
      });
      setInviteMessage(response.message || 'Invitation sent.');
      setPlayerIdentifier('');
    } catch (err) {
      setInviteMessage(err.response?.data?.message || 'Unable to send invitation.');
    }
  };

  return (
    <div className="container-fluid p-0">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-people-fill text-evsu-primary me-2"></i>
            Team Roster Management
          </h3>
          <p className="text-muted small mb-0">Manage registered teams, logos, coaches, and rosters</p>
        </div>
        <button className="btn btn-evsu align-self-start align-self-lg-center rounded-pill px-4" onClick={openCreate} disabled={!isCoach && !selectedTournament}>
          <i className="bi bi-plus-lg me-1"></i> New Team
        </button>
      </div>

      {pageMessage && (
        <div className="alert alert-info alert-dismissible fade show py-2" role="status">
          {pageMessage}
          <button type="button" className="btn-close" onClick={() => setPageMessage('')} aria-label="Close" />
        </div>
      )}

      {!isCoach && <section className="card-custom p-3 p-md-4 mb-4 team-tournament-picker">
        <div className="row g-3 align-items-end">
          <div className="col-md-7"><label className="form-label small fw-bold"><i className="bi bi-trophy me-2 text-evsu-primary"/>Select Tournament</label><select className="form-select" value={selectedTournament} onChange={e=>{setSelectedTournament(e.target.value);setSelectedDivision('');}}><option value="">Choose a tournament to manage</option>{tournaments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          <div className="col-md-5"><label className="form-label small fw-bold"><i className="bi bi-diagram-3 me-2 text-evsu-primary"/>Division</label><select className="form-select" value={selectedDivision} disabled={!selectedTournament||!filterDivisions.length} onChange={e=>setSelectedDivision(e.target.value)}><option value="">All divisions</option>{filterDivisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
        </div>
        {selectedTournament&&<div className="team-picker-summary mt-3"><span><b>{visibleTeams.length}</b> teams displayed</span><span><b>{visibleTeams.reduce((sum,team)=>sum+Number(team.total_players||0),0)}</b> rostered players</span></div>}
      </section>}

      {loading ? (
        <LoadingSpinner message="Loading team directory..." />
      ) : (!isCoach && !selectedTournament) ? (
        <div className="team-selection-empty"><i className="bi bi-trophy"/><h4>Select a tournament first</h4><p>Choose a tournament above to view and manage its registered teams, logos, coaches, and rosters.</p></div>
      ) : visibleTeams.length === 0 ? (
        <div className="team-selection-empty"><i className="bi bi-people"/><h4>No teams found</h4><p>No registered teams match the selected tournament and division.</p><button className="btn btn-evsu btn-sm" onClick={openCreate}><i className="bi bi-plus-lg me-1"/>Register the first team</button></div>
      ) : (
        <>
        <div className="d-grid gap-3 d-md-none">
          {visibleTeams.map(tm => (
            <article className="card-custom team-mobile-card p-3" key={tm.id}>
              <div className="d-flex align-items-start gap-3">
                <div className="team-logo-thumb team-logo-mobile" style={{ backgroundColor: tm.primary_color || '#F97316' }}>
                  {tm.logo_url
                    ? <img src={`${apiRoot}${tm.logo_url}`} alt={`${tm.team_name} logo`} />
                    : (tm.short_name || tm.team_name).slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-grow-1 min-width-0">
                  <div className="d-flex align-items-start justify-content-between gap-2">
                    <div>
                      <h5 className="fw-bold text-dark mb-1">{tm.team_name}</h5>
                      <div className="small text-muted"><i className="bi bi-trophy me-1" />{tm.tournament_name}</div>
                      <div className="small text-muted"><i className="bi bi-diagram-3 me-1" />{tm.division_name || 'Open division'}</div>
                    </div>
                    <span className={`badge ${tm.status === 'registered' ? 'bg-success' : 'bg-warning text-dark'}`}>
                      {tm.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>
              <div className="team-mobile-footer mt-3 pt-3">
                <button type="button" className="btn btn-light btn-sm rounded-pill px-3" onClick={() => viewRoster(tm)}>
                  <i className="bi bi-people-fill me-1" />Roster ({tm.total_players || 0})
                </button>
                <div className="d-flex gap-2">
                  <button className="btn btn-evsu team-action-btn" onClick={() => { setInviteTeam(tm); setInviteMessage(''); }} aria-label={`Invite player to ${tm.team_name}`} title="Invite player"><i className="bi bi-person-plus-fill" /></button>
                  <button className="btn team-action-btn team-edit-btn" onClick={() => openEdit(tm)} aria-label={`Edit ${tm.team_name}`} title="Edit team"><i className="bi bi-pencil-square" /></button>
                  <button className="btn btn-outline-danger team-action-btn" onClick={() => deleteTeam(tm)} aria-label={`Delete ${tm.team_name}`} title="Delete team"><i className="bi bi-trash3" /></button>
                </div>
              </div>
            </article>
          ))}
        </div>

        <div className="card-custom p-4 d-none d-md-block">
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
              <thead className="table-light">
                <tr>
                  <th>Team Name</th>
                  <th>Tournament / Division</th>
                  <th className="d-none d-md-table-cell">Coach</th>
                  <th className="d-none d-md-table-cell">Players</th>
                  <th>Status</th>
                  <th className="team-actions-column">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleTeams.map(tm => (
                  <tr key={tm.id}>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="team-logo-thumb" style={{ backgroundColor: tm.primary_color || '#F97316' }}>
                          {tm.logo_url
                            ? <img src={`${apiRoot}${tm.logo_url}`} alt={`${tm.team_name} logo`} />
                            : (tm.short_name || tm.team_name).slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="fw-bold text-dark">{tm.team_name}</div>
                          <button type="button" className="btn btn-link btn-sm p-0 text-decoration-none" onClick={() => viewRoster(tm)}>
                            <i className="bi bi-people me-1" />View roster
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="small">{tm.tournament_name}<span className="d-block text-muted">{tm.division_name || 'Open division'}</span></td>
                    <td className="small d-none d-md-table-cell">{tm.coach_name}</td>
                    <td className="small d-none d-md-table-cell"><span className="badge bg-light text-dark border">{tm.total_players || 0} players</span></td>
                    <td>
                      <span className={`badge ${tm.status === 'registered' ? 'bg-success' : 'bg-warning text-dark'}`}>
                        {tm.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="text-nowrap team-actions-column">
                      {['platform_admin','admin','organization_admin','coach','coach_manager'].includes(user?.role) ? (
                        <div className="d-inline-flex align-items-center gap-2 team-action-group">
                          <button className="btn btn-evsu team-action-btn" onClick={() => { setInviteTeam(tm); setInviteMessage(''); }} aria-label={`Invite player to ${tm.team_name}`} title="Invite player">
                            <i className="bi bi-person-plus-fill" />
                          </button>
                          <button className="btn team-action-btn team-edit-btn" onClick={() => openEdit(tm)} aria-label={`Edit ${tm.team_name}`} title="Edit team">
                            <i className="bi bi-pencil-square" />
                          </button>
                          <button className="btn btn-outline-danger team-action-btn" onClick={() => deleteTeam(tm)} aria-label={`Delete ${tm.team_name}`} title="Delete team">
                            <i className="bi bi-trash3" />
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-outline-danger btn-sm" onClick={() => navigate('/eligibility')}>
                          <i className="bi bi-people-fill me-1" />View Players
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {showModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">{editingTeam ? 'Edit Team' : 'Register New Team'}</h5>
                <button type="button" className="btn-close" onClick={() => { setShowModal(false); setEditingTeam(null); }}></button>
              </div>
              <form onSubmit={handleSubmit}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Team Name</label>
                    <input type="text" className="form-control" required value={formData.team_name} onChange={e => setFormData({...formData, team_name: e.target.value})} placeholder="e.g. Linaw Ballers" />
                  </div>
                  <div className="mb-3"><label className="form-label small fw-semibold">Short Name</label><input maxLength="20" className="form-control" value={formData.short_name} onChange={e=>setFormData({...formData,short_name:e.target.value})} placeholder="e.g. LIN"/></div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Select Tournament</label>
                    <select className="form-select" value={formData.tournament_id} onChange={e => setFormData({...formData, tournament_id: e.target.value})}>
                      {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div className="mb-3"><label className="form-label small fw-semibold">Division</label><select className="form-select" value={formData.division_id} onChange={e=>setFormData({...formData,division_id:e.target.value})}><option value="">Open / Unassigned</option>{divisions.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
                  <div><label className="form-label small fw-semibold">Jersey Color</label><div className="d-flex align-items-center gap-3"><span className="rounded-circle border flex-shrink-0" style={{width:32,height:32,backgroundColor:formData.primary_color}}/><input className="form-control" list="jersey-color-options" value={formData.primary_color} onChange={e=>setFormData({...formData,primary_color:e.target.value})} placeholder="Type a color, e.g. navy or skyblue"/><datalist id="jersey-color-options"><option value="red"/><option value="blue"/><option value="black"/><option value="white"/><option value="green"/><option value="yellow"/><option value="orange"/><option value="maroon"/><option value="navy"/><option value="skyblue"/><option value="violet"/><option value="gray"/></datalist></div><small className="text-muted">Type any valid color name or choose a suggestion.</small></div>
                  <div className="mt-3"><label className="form-label small fw-semibold">Team Logo</label><input type="file" className="form-control" accept="image/jpeg,image/png,image/webp" onChange={e => setLogoFile(e.target.files?.[0] || null)} /><small className="text-muted">JPG, PNG, or WEBP up to 3MB.</small></div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => { setShowModal(false); setEditingTeam(null); }}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm">{editingTeam ? 'Save Changes' : 'Submit Registration'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {inviteTeam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <div><h5 className="fw-bold mb-0">Invite a Player</h5><small className="text-muted">{inviteTeam.team_name}</small></div>
                <button type="button" className="btn-close" onClick={() => setInviteTeam(null)} />
              </div>
              <form onSubmit={sendInvitation}>
                <div className="modal-body">
                  {inviteMessage && <div className="alert alert-info py-2">{inviteMessage}</div>}
                  <label className="form-label small fw-semibold">Player email or mobile number</label>
                  <input className="form-control" value={playerIdentifier} onChange={e => setPlayerIdentifier(e.target.value)} placeholder="player@ or 09XXXXXXXXX" autoComplete="off" required />
                  <small className="text-muted d-block mt-2">The player will receive an invitation in FullCourt Notifications.</small>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light" onClick={() => setInviteTeam(null)}>Close</button>
                  <button className="btn btn-evsu"><i className="bi bi-send me-1" />Send Invitation</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {rosterTeam && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <div>
                  <h5 className="fw-bold mb-0">{rosterTeam.team_name} Roster</h5>
                  <small className="text-muted">Players, jersey numbers, positions, and eligibility</small>
                </div>
                <button type="button" className="btn-close" onClick={() => setRosterTeam(null)} aria-label="Close" />
              </div>
              <div className="modal-body">
                {rosterLoading ? <LoadingSpinner message="Loading team roster..." /> : rosterPlayers.length === 0 ? (
                  <div className="text-center py-5 text-muted"><i className="bi bi-person-plus fs-1 d-block mb-2" />No players in this roster yet.</div>
                ) : (
                  <>
                  <div className="d-grid gap-3 d-md-none">
                    {rosterPlayers.map(player => (
                      <article className="roster-player-card" key={player.id}>
                        <div className="d-flex align-items-center gap-3">
                          <div className="roster-list-avatar roster-card-avatar">
                            {player.avatar_url
                              ? <img src={mediaUrl(player.avatar_url)} alt="" />
                              : (player.full_name || 'P').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div className="flex-grow-1 min-width-0">
                            <h6 className="fw-bold text-dark mb-1 text-truncate">{player.full_name || 'Invited Player'}</h6>
                            <div className="small text-muted text-truncate">{player.email || player.phone_number || 'No contact provided'}</div>
                          </div>
                          <button className="btn team-action-btn team-edit-btn flex-shrink-0" onClick={() => startRosterEdit(player)} aria-label={`Edit ${player.full_name || 'player'}`}><i className="bi bi-pencil-square" /></button>
                        </div>
                        <div className="roster-card-details mt-3 pt-3">
                          <div><span>Jersey</span><strong>{player.jersey_number ? `#${player.jersey_number}` : '—'}</strong></div>
                          <div><span>Position</span><strong>{player.position || 'Not assigned'}</strong></div>
                          <div><span>Status</span><span className={`badge ${player.eligibility_status === 'verified' ? 'bg-success' : player.eligibility_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{player.eligibility_status}</span></div>
                        </div>
                      </article>
                    ))}
                  </div>
                  <div className="table-responsive d-none d-md-block">
                    <table className="table table-hover align-middle mb-0">
                      <thead><tr><th>Player</th><th>Contact</th><th>Jersey</th><th>Position</th><th>Status</th><th className="text-end">Action</th></tr></thead>
                      <tbody>{rosterPlayers.map(player => (
                        <tr key={player.id}>
                          <td>
                            <div className="d-flex align-items-center gap-2">
                              <div className="roster-list-avatar">
                                {player.avatar_url
                                  ? <img src={mediaUrl(player.avatar_url)} alt="" />
                                  : (player.full_name || 'P').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                              </div>
                              <span className="fw-semibold">{player.full_name || 'Invited Player'}</span>
                            </div>
                          </td>
                          <td className="small">{player.email || player.phone_number || 'Not provided'}</td>
                          <td>{player.jersey_number ? `#${player.jersey_number}` : '—'}</td>
                          <td>{player.position || 'Not assigned'}</td>
                          <td><span className={`badge ${player.eligibility_status === 'verified' ? 'bg-success' : player.eligibility_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>{player.eligibility_status}</span></td>
                          <td className="text-end text-nowrap">
                            <button className="btn team-action-btn team-edit-btn" onClick={() => startRosterEdit(player)} aria-label={`Edit ${player.full_name || 'player'}`} title="Edit jersey and position"><i className="bi bi-pencil-square" /></button>
                          </td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                  </>
                )}
              </div>
              <div className="modal-footer border-top"><button className="btn btn-light" onClick={() => setRosterTeam(null)}>Close</button></div>
            </div>
          </div>
        </div>
      )}

      {editingRosterPlayer && (
        <div className="modal show d-block roster-edit-modal" style={{ backgroundColor: 'rgba(0,0,0,0.72)' }}>
          <div className="modal-dialog modal-dialog-centered modal-sm">
            <div className="modal-content card-custom border-0 overflow-hidden">
              <div className="roster-edit-header p-4 text-white">
                <div className="d-flex align-items-center gap-3">
                  <div className="roster-player-icon">
                    {editingRosterPlayer.avatar_url
                      ? <img src={mediaUrl(editingRosterPlayer.avatar_url)} alt={`${editingRosterPlayer.full_name || 'Player'} profile`} />
                      : <i className="bi bi-person-fill" />}
                  </div>
                  <div><small className="text-white-50">EDIT ROSTER PLAYER</small><h5 className="fw-bold mb-0">{editingRosterPlayer.full_name || 'Invited Player'}</h5></div>
                </div>
              </div>
              <form onSubmit={saveRosterPlayer}>
                <div className="modal-body p-4">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Jersey Number</label>
                    <div className="input-group"><span className="input-group-text">#</span><input type="number" min="0" max="999" className="form-control" value={rosterJersey} onChange={e => setRosterJersey(e.target.value)} placeholder="23" /></div>
                  </div>
                  <div>
                    <label className="form-label small fw-semibold">Playing Position</label>
                    <select className="form-select" value={rosterPosition} onChange={e => setRosterPosition(e.target.value)}>
                      <option value="">Select position</option>
                      <option>Point Guard</option><option>Shooting Guard</option><option>Small Forward</option><option>Power Forward</option><option>Center</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer border-top p-3">
                  <button type="button" className="btn btn-light rounded-pill px-3" onClick={() => setEditingRosterPlayer(null)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu rounded-pill px-3"><i className="bi bi-check2-circle me-1" />Save Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
