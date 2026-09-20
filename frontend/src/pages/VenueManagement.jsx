import React, { useEffect, useState } from 'react';
import venueService from '../services/venueService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import '../styles/operations-polish.css';

const VenueManagement = () => {
  const { user } = useAuth();
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ type: '', text: '' });
  const [showVenueModal, setShowVenueModal] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [venueForm, setVenueForm] = useState({ name: '', location: '' });
  const [showCourtModal, setShowCourtModal] = useState(false);
  const [courtForm, setCourtForm] = useState({ venue_id: '', court_name: '', sport_id: '', is_available: true });
  const isPlatformAdmin = ['platform_admin', 'admin'].includes(user?.role);
  const totalCourts = venues.reduce((sum, venue) => sum + (venue.courts || []).length, 0);
  const availableCourts = venues.reduce((sum, venue) => sum + (venue.courts || []).filter(court => Boolean(Number(court.is_available))).length, 0);
  const pendingVenues = venues.filter(venue => (venue.approval_status || 'approved') === 'pending').length;

  const load = async () => {
    try {
      setLoading(true);
      const res = await venueService.getVenues();
      setVenues(res.venues || []);
    } catch (err) {
      setMsg({ type: 'danger', text: err.response?.data?.message || 'Unable to load venues.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const notify = (text, type = 'success') => {
    setMsg({ type, text });
    setTimeout(() => setMsg({ type: '', text: '' }), 4000);
  };

  const openVenueModal = (venue = null) => {
    setEditingVenue(venue);
    setVenueForm(venue ? { name: venue.name, location: venue.location } : { name: '', location: '' });
    setShowVenueModal(true);
  };

  const saveVenue = async (e) => {
    e.preventDefault();
    try {
      if (editingVenue) {
        await venueService.updateVenue(editingVenue.id, venueForm);
        notify('Venue updated.');
      } else {
        await venueService.createVenue(venueForm);
        notify('Venue created.');
      }
      setShowVenueModal(false);
      load();
    } catch (err) {
      notify(err.response?.data?.message || 'Unable to save venue.', 'danger');
    }
  };

  const deleteVenue = async (venue) => {
    if (!window.confirm(`Delete venue "${venue.name}" and its courts?`)) return;
    try {
      await venueService.deleteVenue(venue.id);
      notify('Venue deleted.');
      load();
    } catch (err) {
      notify(err.response?.data?.message || 'Unable to delete venue.', 'danger');
    }
  };

  const openCourtModal = (venueId) => {
    setCourtForm({ venue_id: venueId, court_name: '', sport_id: '', is_available: true });
    setShowCourtModal(true);
  };

  const saveCourt = async (e) => {
    e.preventDefault();
    try {
      await venueService.createCourt(courtForm);
      notify('Court added.');
      setShowCourtModal(false);
      load();
    } catch (err) {
      notify(err.response?.data?.message || 'Unable to add court.', 'danger');
    }
  };

  const deleteCourt = async (court) => {
    if (!window.confirm(`Delete court "${court.court_name}"?`)) return;
    try {
      await venueService.deleteCourt(court.id);
      notify('Court deleted.');
      load();
    } catch (err) {
      notify(err.response?.data?.message || 'Unable to delete court.', 'danger');
    }
  };

  const reviewVenue = async (venue, status) => {
    const notes = window.prompt(`${status === 'approved' ? 'Approval' : 'Review'} notes (optional):`, venue.review_notes || '');
    if (notes === null) return;
    try {
      await venueService.reviewVenue(venue.id, status, notes);
      notify(`Venue ${status}.`);
      load();
    } catch (err) {
      notify(err.response?.data?.message || 'Unable to review venue.', 'danger');
    }
  };

  return (
    <div className="container-fluid p-0 page-enter">
      <div className="ops-page-head venue-page-head">
        <div>
          <span className="ops-eyebrow">{isPlatformAdmin ? 'PLATFORM OVERSIGHT' : 'COMPETITION SETUP'}</span>
          <h3 className="fw-bold mb-1"><i className="bi bi-geo-alt-fill text-evsu-primary me-2" />{isPlatformAdmin ? 'Venue & Court Oversight' : 'Venue & Court Management'}</h3>
          <p className="text-muted small mb-0">{isPlatformAdmin ? 'Monitor organizer-submitted basketball venues, court availability, and scheduling readiness.' : 'Add the venues and playable courts that will be used by your tournament schedules.'}</p>
        </div>
        {!isPlatformAdmin && <button className="btn btn-evsu text-nowrap" onClick={() => openVenueModal()}><i className="bi bi-plus-lg me-1" />Add Venue</button>}
        {isPlatformAdmin && <div className="ops-head-mark"><i className="bi bi-shield-check" /></div>}
      </div>

      <div className="venue-summary-grid">
        <article><i className="bi bi-buildings"/><div><small>Registered venues</small><strong>{venues.length}</strong></div></article>
        <article><i className="bi bi-grid-3x3-gap"/><div><small>Total courts</small><strong>{totalCourts}</strong></div></article>
        <article><i className="bi bi-check2-circle"/><div><small>Available courts</small><strong>{availableCourts}</strong></div></article>
        <article><i className="bi bi-hourglass-split"/><div><small>Pending review</small><strong>{pendingVenues}</strong></div></article>
      </div>

      {isPlatformAdmin && <div className="venue-role-notice"><i className="bi bi-info-circle-fill"/><div><b>Administrator review mode</b><span>Organizers submit venues and courts. Approve valid venues before they become available to the scheduling engine.</span></div></div>}

      {msg.text && <div className={`alert alert-${msg.type} py-2 px-3 small rounded-3 mb-3`}>{msg.text}</div>}

      {loading ? <LoadingSpinner message="Loading venues and courts..." /> : (
        <div className="card-custom p-4">
          {venues.length === 0 ? (
            <div className="text-center text-muted py-5"><i className="bi bi-geo-alt display-5 d-block mb-2 opacity-25" />No venues configured yet. Add a venue to get started.</div>
          ) : (
            <div className="row g-3">
              {venues.map(v => (
                <div className="col-12 col-md-6 col-xl-4" key={v.id}>
                  <div className="border rounded-3 p-3 h-100 d-flex flex-column">
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <div>
                        <h5 className="fw-bold mb-0">{v.name}</h5>
                        <small className="text-muted"><i className="bi bi-geo me-1" />{v.location}</small>
                        <small className="d-block text-muted mt-1">{v.organization_name || 'Organization not specified'}</small>
                      </div>
                      <span className="badge bg-light text-dark border">{v.court_count || 0} courts</span>
                    </div>
                    <div className="d-flex align-items-center justify-content-between gap-2 mt-2"><span className={`badge ${v.approval_status === 'approved' ? 'bg-success' : v.approval_status === 'rejected' || v.approval_status === 'suspended' ? 'bg-danger' : 'bg-warning text-dark'}`}>{(v.approval_status || 'approved').replaceAll('_',' ')}</span>{v.review_notes && <small className="text-muted text-truncate" title={v.review_notes}>{v.review_notes}</small>}</div>
                    <div className="mt-2 flex-grow-1">
                      {(v.courts || []).length === 0 ? (
                        <small className="text-muted">No courts yet.</small>
                      ) : (
                        <ul className="list-unstyled small mb-0">
                          {v.courts.map(c => (
                            <li key={c.id} className="d-flex justify-content-between align-items-center border-bottom py-1">
                              <span>{c.court_name}{c.sport_name ? ` · ${c.sport_name}` : ''}{!c.is_available && <span className="text-danger"> · offline</span>}</span>
                              {!isPlatformAdmin && <button className="btn btn-sm btn-outline-danger py-0 px-1" title="Delete court" aria-label={`Delete court ${c.court_name}`} onClick={() => deleteCourt(c)}><i className="bi bi-trash" /></button>}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    {!isPlatformAdmin && <div className="d-flex gap-2 mt-3">
                      <button className="btn btn-outline-primary btn-sm" onClick={() => openCourtModal(v.id)}><i className="bi bi-plus-lg me-1" />Add Court</button>
                      <button className="btn btn-outline-secondary btn-sm ms-auto" onClick={() => openVenueModal(v)}><i className="bi bi-pencil me-1" />Edit</button>
                      <button className="btn btn-outline-danger btn-sm" aria-label={`Delete venue ${v.name}`} title={`Delete ${v.name}`} onClick={() => deleteVenue(v)}><i className="bi bi-trash" /></button>
                    </div>}
                    {isPlatformAdmin && <div className="d-flex flex-wrap gap-2 mt-3"><button className="btn btn-success btn-sm" onClick={() => reviewVenue(v,'approved')}><i className="bi bi-check2 me-1"/>Approve</button><button className="btn btn-outline-danger btn-sm" onClick={() => reviewVenue(v,'rejected')}><i className="bi bi-x-lg me-1"/>Reject</button><button className="btn btn-outline-warning btn-sm ms-auto" onClick={() => reviewVenue(v,'suspended')}><i className="bi bi-pause-circle me-1"/>Suspend</button></div>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Venue Modal */}
      {showVenueModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">{editingVenue ? 'Edit Venue' : 'Add Venue'}</h5>
                <button type="button" className="btn-close" aria-label="Close venue form" onClick={() => setShowVenueModal(false)}></button>
              </div>
              <form onSubmit={saveVenue}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Venue Name</label>
                    <input type="text" className="form-control" required value={venueForm.name} onChange={e => setVenueForm({ ...venueForm, name: e.target.value })} placeholder="e.g. Barangay Main Gymnasium" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Location</label>
                    <input type="text" className="form-control" required value={venueForm.location} onChange={e => setVenueForm({ ...venueForm, location: e.target.value })} placeholder="e.g. Main Campus, Ormoc City" />
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowVenueModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm">{editingVenue ? 'Save Changes' : 'Add Venue'}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Court Modal */}
      {showCourtModal && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="fw-bold text-dark mb-0">Add Court</h5>
                <button type="button" className="btn-close" aria-label="Close court form" onClick={() => setShowCourtModal(false)}></button>
              </div>
              <form onSubmit={saveCourt}>
                <div className="modal-body">
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Court Name</label>
                    <input type="text" className="form-control" required value={courtForm.court_name} onChange={e => setCourtForm({ ...courtForm, court_name: e.target.value })} placeholder="e.g. Gym Court A (Basketball)" />
                  </div>
                  <div className="mb-3">
                    <label className="form-label small fw-semibold">Primary Sport (optional)</label>
                    <input type="text" className="form-control" value={courtForm.sport_id} onChange={e => setCourtForm({ ...courtForm, sport_id: e.target.value })} placeholder="Sport ID (blank = any)" />
                  </div>
                  <div className="form-check form-switch">
                    <input className="form-check-input" type="checkbox" id="courtAvailable" checked={courtForm.is_available} onChange={e => setCourtForm({ ...courtForm, is_available: e.target.checked })} />
                    <label className="form-check-label small fw-semibold" htmlFor="courtAvailable">Available for scheduling</label>
                  </div>
                </div>
                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setShowCourtModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm">Add Court</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VenueManagement;
