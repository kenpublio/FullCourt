import React, { useState, useEffect, useMemo } from 'react';
import eligibilityService from '../services/eligibilityService';
import LoadingSpinner from '../components/LoadingSpinner';

const EligibilityVerification = () => {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [position, setPosition] = useState('');
  const [documents,setDocuments]=useState([]);
  const [documentFile,setDocumentFile]=useState(null);
  const [identityPreview,setIdentityPreview]=useState(null);
  const [searchQuery,setSearchQuery]=useState('');

  const filteredPlayers=useMemo(()=>{
    const query=searchQuery.trim().toLowerCase();
    if(!query)return players;
    return players.filter(player=>[
      player.user_full_name,
      player.user_email,
      player.user_phone,
      player.student_id_number,
      player.team_name,
      player.tournament_name,
      player.jersey_number,
      player.position,
      player.eligibility_status,
    ].some(value=>String(value??'').toLowerCase().includes(query)));
  },[players,searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await eligibilityService.getPendingPlayers();
      setPlayers(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

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
    setIdentityPreview(null);
    setDocuments(await eligibilityService.documents(player.id));
  };
  const upload=async()=>{if(!documentFile)return;await eligibilityService.uploadDocument(selectedPlayer.id,'Eligibility Supporting Document',documentFile);setDocuments(await eligibilityService.documents(selectedPlayer.id));setDocumentFile(null);};
  const reviewDocument=async(id,status)=>{await eligibilityService.reviewDocument(id,status,remarks);setDocuments(await eligibilityService.documents(selectedPlayer.id));};
  const previewIdentity=async doc=>{try{if(identityPreview){URL.revokeObjectURL(identityPreview.id);URL.revokeObjectURL(identityPreview.selfie);}const[id,selfie]=await Promise.all([eligibilityService.privateImage(doc.id),eligibilityService.privateImage(doc.id,true)]);setIdentityPreview({id,selfie,doc});}catch(err){alert(err.response?.data?.message||'Private identity images could not be opened.');}};

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
    <div className="container-fluid p-0">
      <div className="mb-4">
        <h3 className="fw-bold text-dark mb-1">
          <i className="bi bi-patch-check-fill text-evsu-primary me-2"></i>
          Player Eligibility Verification
        </h3>
        <p className="text-muted small mb-0">Secure roster documents, guardian consent, jersey details, and eligibility decisions</p>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading player documents..." />
      ) : (
        <div className="card-custom p-4">
          <div className="eligibility-searchbar mb-3">
            <div className="eligibility-search-input">
              <i className="bi bi-search" aria-hidden="true"></i>
              <input
                type="search"
                aria-label="Search player eligibility records"
                placeholder="Search player, team, contact, jersey, position, or status"
                value={searchQuery}
                onChange={event=>setSearchQuery(event.target.value)}
              />
              {searchQuery&&<button type="button" aria-label="Clear search" onClick={()=>setSearchQuery('')}><i className="bi bi-x-lg"/></button>}
            </div>
            <span><strong>{filteredPlayers.length}</strong> of {players.length} records</span>
          </div>
          <div className="table-responsive">
            <table className="table table-hover align-middle mb-0">
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
                  <tr><td colSpan="6" className="text-center py-4 text-muted">{searchQuery?'No eligibility records match your search.':'No pending player eligibility records found.'}</td></tr>
                ) : (
                  filteredPlayers.map(p => (
                    <tr key={p.id}>
                      <td className="fw-bold text-dark">{p.user_full_name || 'Roster Player'}</td>
                      <td className="small">
                        {p.user_email || p.user_phone || 'Not provided'}
                      </td>
                      <td className="small">{p.team_name}<span className="d-block text-muted">{p.tournament_name}</span></td>
                      <td className="small">#{p.jersey_number || 'N/A'} ({p.position || 'Player'})</td>
                      <td>
                        <span className={`badge ${p.eligibility_status === 'verified' ? 'bg-success' : p.eligibility_status === 'rejected' ? 'bg-danger' : 'bg-warning text-dark'}`}>
                          {p.eligibility_status}
                        </span>
                      </td>
                      <td className="text-end">
                        <button className="btn btn-outline-primary btn-sm" onClick={() => openReview(p)}>
                          <i className="bi bi-search me-1"></i> Review Player
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
                  <div><strong>Contact:</strong> {selectedPlayer.user_email || selectedPlayer.user_phone || 'Not provided'}</div>
                </div>

                <div className="mb-3">
                  <div className="row g-3 mb-3">
                    <div className="col-5"><label className="form-label small fw-semibold">Jersey Number</label><input type="number" min="0" max="999" className="form-control" value={jerseyNumber} onChange={e => setJerseyNumber(e.target.value)} placeholder="e.g. 23" /></div>
                    <div className="col-7"><label className="form-label small fw-semibold">Player Position</label><input type="text" maxLength="50" className="form-control" value={position} onChange={e => setPosition(e.target.value)} placeholder="e.g. Point Guard" /></div>
                  </div>
                  <label className="form-label small fw-semibold">Review Remarks</label>
                  <textarea className="form-control" rows="2" value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Add remarks or rejection reason..."></textarea>
                </div>
                <div className="border rounded-3 p-3"><h6 className="fw-bold">Protected Documents</h6>{documents.map(doc=><div className="d-flex align-items-center justify-content-between gap-2 border-bottom py-2" key={doc.id}><div><b className="small">{doc.document_type}</b><span className={`badge ms-2 ${doc.status==='verified'?'bg-success':doc.status==='rejected'?'bg-danger':'bg-warning text-dark'}`}>{doc.status}</span>{doc.id_type&&<small className="d-block text-muted">{doc.id_type} • ID ending in ••••{doc.id_number_last4} • ID birthdate: {doc.id_birth_date}</small>}{doc.birthdate_match!==null&&<small className={`d-block fw-semibold ${doc.birthdate_match?'text-success':'text-danger'}`}>{doc.birthdate_match?'Registered and ID birthdates match':'Birthdate mismatch—do not approve until resolved'}</small>}</div><div className="d-flex gap-1">{doc.selfie_mime_type&&<button className="btn btn-outline-primary btn-sm" onClick={()=>previewIdentity(doc)}><i className="bi bi-eye me-1"/>Compare</button>}<button className="btn btn-success btn-sm" onClick={()=>reviewDocument(doc.id,'verified')}>Verify</button><button className="btn btn-outline-danger btn-sm" onClick={()=>reviewDocument(doc.id,'rejected')}>Reject</button></div></div>)}{!documents.length&&<p className="small text-muted">No supporting documents uploaded.</p>}<div className="input-group mt-3"><input type="file" accept=".pdf,.jpg,.jpeg,.png" className="form-control" onChange={e=>setDocumentFile(e.target.files?.[0]||null)}/><button className="btn btn-outline-dark" onClick={upload} disabled={!documentFile}>Upload</button></div></div>
                {identityPreview&&<div className="border rounded-4 p-3 mt-3"><div className="d-flex justify-content-between align-items-center mb-3"><div><h6 className="fw-bold mb-0">Manual Face Comparison</h6><small className="text-muted">Compare the ID portrait with the live selfie. No automatic face-recognition decision is being claimed.</small></div><button className="btn-close" onClick={()=>setIdentityPreview(null)}/></div><div className="row g-3"><div className="col-md-6"><div className="small fw-bold mb-2">ID PHOTO</div><img src={identityPreview.id} alt="Player identification" className="w-100 rounded-3 border" style={{height:300,objectFit:'contain',background:'#111'}}/></div><div className="col-md-6"><div className="small fw-bold mb-2">LIVE SELFIE</div><img src={identityPreview.selfie} alt="Player live selfie" className="w-100 rounded-3 border" style={{height:300,objectFit:'contain',background:'#111'}}/></div></div></div>}
              </div>
              <div className="modal-footer border-top d-flex flex-wrap justify-content-between gap-2">
                <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDecision('rejected')}>
                  <i className="bi bi-x-circle me-1"></i> Reject Eligibility
                </button>
                <div className="d-flex flex-column gap-2">
                  <button type="button" className="btn btn-primary btn-sm" onClick={saveRosterDetails}>
                    <i className="bi bi-floppy-fill me-1" /> Save Jersey &amp; Position
                  </button>
                </div>
                <button type="button" className="btn btn-success btn-sm" onClick={() => handleDecision('verified')}>
                  <i className="bi bi-check-circle me-1"></i> Approve Eligibility
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EligibilityVerification;
