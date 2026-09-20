import React, { useEffect, useState } from 'react';
import sportsApplicationService from '../services/sportsApplicationService';
import LoadingSpinner from './LoadingSpinner';

const PlayerSportsApplications = () => {
  const [sports, setSports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [categories, setCategories] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const load = () => sportsApplicationService.getAvailableSports().then(setSports).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const setCategory = (teamId, categoryId) => setCategories(prev => ({ ...prev, [teamId]: categoryId }));
  const apply = async (teamId, categoryId) => {
    try { const response = await sportsApplicationService.apply(teamId, categoryId); setMessage(response.message); setSelected(null); await load(); }
    catch (error) { setMessage(error.response?.data?.message || 'Unable to submit application.'); }
  };
  if (loading) return <LoadingSpinner message="Loading available basketball competitions..." />;
  return <section className="player-sports-section mb-4">
    <div className="d-flex justify-content-between align-items-end mb-3"><div><span className="section-eyebrow">FULLCOURT BASKETBALL</span><h4 className="fw-bold mb-1">Find your team</h4><p className="text-muted small mb-0">Review available teams and submit an application to the coach. Pick your division where available.</p></div></div>
    {message && <div className="alert alert-info py-2">{message}</div>}
    <div className="player-sports-grid">{sports.map(item => { const slots = Math.max(0, Number(item.max_players_per_team)-Number(item.approved_players)); const cats = item.event_categories || []; return <article className="player-sport-card" key={item.team_id}><div className="d-flex justify-content-between"><div className="player-sport-icon"><i className="bi bi-trophy-fill" /></div><span className={`application-pill ${item.application_status || 'open'}`}>{item.application_status ? item.application_status.replace('_',' ') : 'Open'}</span></div><h5>{item.sport_name}</h5><p>{item.sport_description || item.tournament_description || 'Official FullCourt basketball competition.'}</p>{cats.length > 0 && <div className="mb-2"><small className="text-muted fw-semibold">Division</small><select className="form-select form-select-sm mt-1" value={categories[item.team_id] || ''} onChange={(e) => setCategory(item.team_id, Number(e.target.value))}>{cats.map(c => <option key={c.id} value={c.id}>{c.name}{c.gender !== 'open' ? ` (${c.gender})` : ''}</option>)}</select></div>}<dl><div><dt>Available slots</dt><dd>{slots} of {item.max_players_per_team}</dd></div><div><dt>Team</dt><dd>{item.team_name}</dd></div><div><dt>Coach</dt><dd>{item.coach_name}</dd></div><div><dt>Schedule</dt><dd>{item.next_schedule || `${item.start_date} onward`}</dd></div><div><dt>Venue</dt><dd>{item.venue_name || item.court_name || 'To be announced'}</dd></div></dl><div className="d-flex gap-2"><button className="btn btn-outline-secondary flex-grow-1" onClick={() => setSelected(item)}>View details</button><button className="btn btn-evsu flex-grow-1" disabled={slots===0 || ['pending','verified'].includes(item.application_status)} onClick={() => apply(item.team_id, categories[item.team_id])}>{item.application_status==='pending'?'Pending Approval':item.application_status==='verified'?'Approved':'Apply'}</button></div></article>})}</div>
    {!sports.length && <div className="public-empty">No sports applications are open right now.</div>}
    {selected && <div className="modal show d-block" style={{background:'rgba(20,4,4,.6)'}}><div className="modal-dialog modal-dialog-centered modal-lg"><div className="modal-content card-custom border-0"><div className="modal-header"><div><span className="sport-chip">{selected.sport_name}</span><h4 className="fw-bold mt-2 mb-0">{selected.team_name}</h4></div><button className="btn-close" aria-label="Close team details" onClick={() => setSelected(null)} /></div><div className="modal-body"><p>{selected.sport_description || 'Official FullCourt basketball competition.'}</p><div className="row g-3"><div className="col-md-6"><b>Coach / Manager</b><p>{selected.coach_name}</p></div><div className="col-md-6"><b>Tournament</b><p>{selected.tournament_name}</p></div><div className="col-md-6"><b>Training / Game Schedule</b><p>{selected.next_schedule || `${selected.start_date} – ${selected.end_date}`}</p></div><div className="col-md-6"><b>Assigned Venue</b><p>{selected.venue_name || selected.court_name || 'To be announced'}</p></div><div className="col-12"><b>Requirements</b><p>Proof of age or identity, personal details, medical clearance when required, and an ID photo for eligibility review.</p></div></div></div><div className="modal-footer"><button className="btn btn-light" onClick={() => setSelected(null)}>Close</button><button className="btn btn-evsu" disabled={['pending','verified'].includes(selected.application_status)} onClick={() => apply(selected.team_id, categories[selected.team_id])}>Apply for this team</button></div></div></div></div>}
  </section>;
};

export default PlayerSportsApplications;
