import React, { useState, useEffect, useMemo } from 'react';
import eligibilityService from '../services/eligibilityService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const EligibilityVerification = () => {
  const { user } = useAuth();
  const isCoach=['coach','coach_manager'].includes(user?.role);
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState('');
  const [documents,setDocuments]=useState([]);
  const [documentFile,setDocumentFile]=useState(null);
  const [documentType,setDocumentType]=useState('Birth Certificate / PSA');
  const [documentBirthDate,setDocumentBirthDate]=useState('');
  const [searchQuery,setSearchQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState('all');
  const [loadError,setLoadError]=useState('');

  const filteredPlayers=useMemo(()=>{
    const query=searchQuery.trim().toLowerCase();
    return players.filter(player=>{
      if(statusFilter!=='all'&&player.eligibility_status!==statusFilter)return false;
      if(!query)return true;
      return [
      player.user_full_name,
      player.user_email,
      player.student_id_number,
      player.team_name,
      player.tournament_name,
      player.jersey_number,
      player.position,
      player.eligibility_status,
      ].some(value=>String(value??'').toLowerCase().includes(query));
    });
  },[players,searchQuery,statusFilter]);

  const loadData = async () => {
    setLoadError('');
    try {
      setLoading(true);
      const data = await eligibilityService.getPendingPlayers();
      setPlayers(data);
    } catch (err) {
      console.error(err);
      setLoadError(err.response?.data?.message||'We could not load eligibility records. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const statusCounts=useMemo(()=>players.reduce((counts,player)=>{const status=player.eligibility_status||'pending';counts[status]=(counts[status]||0)+1;return counts;},{pending:0,verified:0,rejected:0}),[players]);

  const handleDecision = async (status) => {
    if (!selectedPlayer) return;
    try {
      await eligibilityService.verifyPlayer(selectedPlayer.id, status, remarks);
      setSelectedPlayer(null);
      setRemarks('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Verification update failed');
    }
  };

  const openReview = async (player) => {
    setSelectedPlayer(player);
    setJerseyNumber(player.jersey_number ?? '');
    setPosition(player.position ?? '');
    setRemarks(player.remarks ?? '');
    setDocuments(await eligibilityService.documents(player.id));
  };
  const upload=async()=>{if(!documentFile)return;try{await eligibilityService.uploadDocument(selectedPlayer.id,documentType,documentFile,documentType==='Birth Certificate / PSA'?documentBirthDate:'');setDocuments(await eligibilityService.documents(selectedPlayer.id));setDocumentFile(null);setDocumentBirthDate('');}catch(err){alert(err.response?.data?.message||'Document upload failed.');}};
  const reviewDocument=async(id,status)=>{await eligibilityService.reviewDocument(id,status,remarks);setDocuments(await eligibilityService.documents(selectedPlayer.id));};

  const saveRosterDetails = async () => {
    try {
      await eligibilityService.updateRoster(selectedPlayer.id, jerseyNumber, position);
      await loadData();
      setSelectedPlayer(current => ({ ...current, jersey_number: jerseyNumber, position }));
      alert('Jersey number and position saved.');
    } catch (err) {
      alert(err.response?.data?.message || 'Unable to update roster details.');
    }
  };

  return (
    <div className="container-fluid p-0 eligibility-page">
      <section className="eligibility-page-hero mb-4">
        <div className="eligibility-page-hero-copy">
          <span className="eligibility-page-kicker"><i className="bi bi-shield-check"/> ROSTER &amp; PLAYER SAFEGUARDING</span>
          <h1>{isCoach ? 'My Team Player Eligibility' : 'Player Eligibility Verification'}</h1>
          <p>{isCoach ? 'Review documents, jersey details, and eligibility for players on your assigned team.' : 'Securely review roster documents, guardian consent, jersey details, and player eligibility decisions.'}</p>
          <div className="eligibility-page-meta"><span><i className="bi bi-shield-lock-fill"/> Restricted reviewer access</span><span><i className="bi bi-person-check-fill"/> Human-reviewed decisions</span></div>
        </div>
        <div className="eligibility-page-tools">
          <div className="eligibility-trust-card"><span><i className="bi bi-lock-fill"/></span><div><small>PRIVATE RECORDS</small><b>{isCoach ? 'Assigned team only' : 'Authorized reviewers only'}</b></div></div>
          <button type="button" className="btn btn-outline-secondary eligibility-refresh" onClick={loadData} disabled={loading}><i className={`bi bi-arrow-clockwise me-2${loading?' spin':''}`}/>{isCoach ? 'Refresh roster' : 'Refresh records'}</button>
        </div>
        <i className="bi bi-patch-check-fill eligibility-hero-watermark" aria-hidden="true" />
      </section>

      {!loading&&!loadError&&<section className="coach-eligibility-stats eligibility-page-stats mb-4" aria-label="Roster eligibility summary">
        <div><i className="bi bi-people-fill"/><span><strong>{players.length}</strong><small>Roster records</small></span></div>
        <div><i className="bi bi-hourglass-split"/><span><strong>{statusCounts.pending||0}</strong><small>Need review</small></span></div>
        <div><i className="bi bi-patch-check-fill"/><span><strong>{statusCounts.verified||0}</strong><small>Verified</small></span></div>
        <div><i className="bi bi-exclamation-circle-fill"/><span><strong>{statusCounts.rejected||0}</strong><small>Needs correction</small></span></div>
      </section>}

      {loadError&&!loading ? <div className="eligibility-state-card" role="alert"><span className="eligibility-state-icon error"><i className="bi bi-wifi-off"/></span><h3>Roster could not load</h3><p>{loadError}</p><button className="btn btn-evsu" type="button" onClick={loadData}><i className="bi bi-arrow-clockwise me-2"/>Try again</button></div> : loading ? (
        <LoadingSpinner message="Loading player documents..." />
      ) : (
        <div className="card-custom p-3 p-md-4 eligibility-workspace-card">
          <div className="coach-eligibility-section-heading eligibility-page-section-heading"><div><span className="eligibility-section-kicker">PLAYER RECORDS</span><h2>{isCoach ? 'Assigned roster' : 'Eligibility review queue'}</h2><p>{isCoach ? 'Only players connected to your team appear here.' : 'Search and review submitted player records across the platform.'}</p></div><span className="coach-eligibility-count">{filteredPlayers.length} shown</span></div>
          <div className="eligibility-searchbar mb-3">
            <div className="eligibility-search-input">
              <i className="bi bi-search" aria-hidden="true"></i>
              <input
                type="search"
                aria-label="Search player eligibility records"
                placeholder={isCoach?'Search your players by name, ID, jersey, position, or status':'Search player, team, jersey, position, or status'}
                value={searchQuery}
                onChange={event=>setSearchQuery(event.target.value)}
              />
              {searchQuery&&<button type="button" aria-label="Clear search" onClick={()=>setSearchQuery('')}><i className="bi bi-x-lg"/></button>}
            </div>
            {!isCoach&&<span><strong>{filteredPlayers.length}</strong> of {players.length} records</span>}
          </div>
          <div className="eligibility-status-filters" role="group" aria-label="Filter eligibility status">
            {[['all','All players',players.length],['pending','Needs review',statusCounts.pending||0],['verified','Verified',statusCounts.verified||0],['rejected','Needs correction',statusCounts.rejected||0]].map(([value,label,count])=><button type="button" key={value} className={statusFilter===value?'active':''} onClick={()=>setStatusFilter(value)} aria-pressed={statusFilter===value}>{label}<span>{count}</span></button>)}
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0 eligibility-records-table">
              <thead className="table-light">
                <tr>
                  <th>Player Name</th>
                  <th>Player Contact</th>
                  <th>Team / Tournament</th>
                  <th>Jersey / Pos</th>
                  <th>Status</th>
                  <th className="text-end">Verification</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlayers.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-4 text-muted">{searchQuery||statusFilter!=='all'?'No roster records match these filters.':isCoach?'Your assigned team has no roster players yet.':'No player eligibility records found.'}</td></tr>
                ) : (
                  filteredPlayers.map(p => (
                    <tr key={p.id}>
                      <td><span className="eligibility-player-name"><i className="bi bi-person-fill"/><b>{p.user_full_name || 'Roster Player'}</b></span></td>
                      <td className="small">DOB: {p.birth_date || 'Not recorded'}<span className="d-block text-muted">{p.guardian_name || 'Guardian not recorded'}</span></td>
                      <td className="small">{p.team_name}<span className="d-block text-muted">{p.tournament_name}</span></td>
                      <td className="small">#{p.jersey_number || 'N/A'} ({p.position || 'Player'})</td>
                      <td>
                        <span className={`badge ${p.eligibility_status === 'verified' ? 'bg-success' : p.eligibility_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                          {p.eligibility_status}
                        </span>
                      </td>
                      <td className="text-end">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => openReview(p)}>
                          <i className={`bi ${isCoach?'bi-person-vcard':'bi-search'} me-1`}></i> {isCoach?'Review roster':'Review Player'}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered modal-xl">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">Review Eligibility: {selectedPlayer.user_full_name || selectedPlayer.student_id_number}</h5>
                <button type="button" className="btn-close" onClick={() => setSelectedPlayer(null)}></button>
              </div>
              <div className="modal-body">
                <div className="alert alert-light border mb-3 small">
                  <div><strong>Team:</strong> {selectedPlayer.team_name}</div>
                  <div><strong>Tournament:</strong> {selectedPlayer.tournament_name}</div>
                  <div><strong>Birth date:</strong> {selectedPlayer.birth_date || 'Not provided'}</div>
                  <div><strong>Guardian:</strong> {selectedPlayer.guardian_name || 'Not provided'} {selectedPlayer.guardian_contact ? `· ${selectedPlayer.guardian_contact}` : ''}</div>
                </div>

                <div className="mb-3">
                  <div className="row g-3 mb-3">
                    <div className="col-5"><label className="form-label small fw-semibold">Jersey Number</label><input type="number" min="0" max="999" className="form-control" value={jerseyNumber} onChange={e => setJerseyNumber(e.target.value)} placeholder="e.g. 23" readOnly={!isCoach} /></div>
                    <div className="col-7"><label className="form-label small fw-semibold">Player Position</label><input type="text" maxLength="50" className="form-control" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Point Guard" readOnly={!isCoach} /></div>
                  </div>
                  <label className="form-label small fw-semibold">Review Remarks</label>
                  <textarea className="form-control" rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add remarks or rejection reason..."></textarea>
                </div>
                <div className="border rounded-3 p-3"><h6 className="fw-bold">Protected Documents</h6>{isCoach?<p className="small text-muted">Upload the Birth Certificate/PSA and Parent Permit. Admin performs the final review.</p>:<p className="small text-muted">Documents are submitted by the assigned Coach. Review the birth-date match and supporting file before deciding.</p>}{documents.map(doc=><div className="eligibility-document-row" key={doc.id}><div><b className="small">{doc.document_type}</b><span className={`badge ms-2 ${doc.status==='verified'?'bg-success':doc.status==='rejected'?'bg-danger':'bg-warning text-dark'}`}>{doc.status}</span>{doc.declared_birth_date&&<small className="d-block text-muted">Document birth date: {doc.declared_birth_date}</small>}{doc.birthdate_match!==null&&<small className={`d-block fw-semibold ${doc.birthdate_match?'text-success':'text-danger'}`}>{doc.birthdate_match?'Roster and document birth dates match':'Birth date mismatch — admin review required'}</small>}</div><div className="d-flex gap-1 flex-wrap">{!isCoach&&<><button className="btn btn-success btn-sm" onClick={()=>reviewDocument(doc.id,'verified')}>Verify</button><button className="btn btn-outline-danger btn-sm" onClick={()=>reviewDocument(doc.id,'rejected')}>Reject</button></>}</div></div>)}{!documents.length&&<p className="small text-muted">No documents uploaded yet.</p>}{isCoach&&<div className="row g-2 mt-2"><div className="col-md-4"><select className="form-select" value={documentType} onChange={e=>setDocumentType(e.target.value)}><option>Birth Certificate / PSA</option><option>Parent Permit</option></select></div>{documentType==='Birth Certificate / PSA'&&<div className="col-md-3"><input type="date" className="form-control" value={documentBirthDate} onChange={e=>setDocumentBirthDate(e.target.value)} aria-label="Birth date shown on document" /></div>}<div className="col"><div className="input-group"><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-control" onChange={e=>setDocumentFile(e.target.files?.[0]||null)}/><button type="button" className="btn btn-outline-dark" onClick={upload} disabled={!documentFile||(documentType==='Birth Certificate / PSA'&&!documentBirthDate)}>Upload</button></div></div></div>}</div>
              </div>
              <div className="modal-footer border-top d-flex flex-wrap justify-content-between gap-2">
                {!isCoach&&<button type="button" className="btn btn-danger btn-sm" onClick={() => handleDecision('rejected')}>
                  <i className="bi bi-x-circle me-1"></i> Reject Eligibility
                </button>}
                <div className="d-flex flex-column gap-2">
                  {isCoach&&<button type="button" className="btn btn-primary btn-sm" onClick={saveRosterDetails}>
                    <i className="bi bi-floppy-fill me-1" /> Save Jersey &amp; Position
                  </button>}
                </div>
                {!isCoach&&<button type="button" className="btn btn-success btn-sm" onClick={() => handleDecision('verified')}>
                  <i className="bi bi-check-circle me-1"></i> Approve Eligibility
                </button>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EligibilityVerification;
