import { useEffect, useState } from 'react';
import operationsService from '../services/operationsService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

const initialForm = { name:'', organization_type:'barangay', slug:'', tagline:'', primary_color:'#F97316', secondary_color:'#18181B' };

const OrganizationManagement = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingOrganization, setViewingOrganization] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const isPlatformAdmin = ['platform_admin','admin'].includes(user?.role);
  const canApplyForOrganization = ['organization_admin','tournament_organizer'].includes(user?.role);

  const load = () => operationsService.organizations().then(setOrganizations).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const setName = value => setForm(current => ({ ...current, name:value, slug:value.toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') }));
  const submit = async event => {
    event.preventDefault();
    try {
      await operationsService.createOrganization(form);
      setForm(initialForm); setShowForm(false); setMessage('Organization application submitted for platform review.'); await load();
    } catch (error) { setMessage(error.response?.data?.message || 'Unable to submit organization.'); }
  };
  const review = async (id, status) => {
    try {
      await operationsService.reviewOrganization(id, status);
      setMessage(`Organization ${status === 'active' ? 'approved' : status === 'rejected' ? 'rejected' : 'suspended'}.`);
      await load();
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update this organization. Please try again.');
    }
  };

  return <div className="container-fluid p-0">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><h3 className="fw-bold mb-1"><i className="bi bi-buildings-fill text-evsu-primary me-2"/>Basketball Organizations</h3><p className="text-muted small mb-0">Independent workspaces for LGUs, barangays, schools, clubs, and community leagues</p></div>
      {canApplyForOrganization && <button className="btn btn-evsu" onClick={()=>setShowForm(true)}><i className="bi bi-plus-lg me-1"/>Apply for Organization</button>}
    </div>
    {message && <div className="alert alert-info">{message}</div>}
    {loading ? <LoadingSpinner message="Loading organizations..."/> : <div className="row g-3">
      {organizations.length === 0 && <div className="col-12"><div className="card-custom p-5 text-center text-muted"><i className="bi bi-buildings fs-1 d-block mb-3"/>No organization workspace yet.</div></div>}
      {organizations.map(org => <div className="col-md-6 col-xl-4" key={org.id}><article className="card-custom p-4 h-100" style={{borderTop:`4px solid ${org.primary_color}`}}>
        <div className="d-flex justify-content-between gap-2"><span className="badge bg-dark text-uppercase">{org.organization_type.replaceAll('_',' ')}</span><span className={`badge ${org.status==='active'?'bg-success':org.status==='pending'?'bg-warning text-dark':'bg-secondary'}`}>{org.status}</span></div>
        <h5 className="fw-bold mt-3 mb-1">{org.name}</h5><p className="small text-muted">{org.tagline || 'Basketball organization workspace'}</p>
        <div className="small"><i className="bi bi-link-45deg me-1"/>/public/{org.slug}</div>
        <div className="d-flex flex-wrap align-items-center justify-content-between gap-2 mt-4 pt-3 border-top">
          <button className="btn btn-outline-secondary btn-sm" onClick={()=>setViewingOrganization(org)}><i className="bi bi-eye me-1"/>View details</button>
          {isPlatformAdmin && org.status === 'pending' && <div className="d-flex gap-2"><button className="btn btn-success btn-sm" onClick={()=>review(org.id,'active')}><i className="bi bi-check2-circle me-1"/>Approve</button><button className="btn btn-outline-danger btn-sm" onClick={()=>review(org.id,'rejected')}><i className="bi bi-x-circle me-1"/>Reject</button></div>}
          {isPlatformAdmin && org.status === 'active' && <button className="btn btn-outline-danger btn-sm" onClick={()=>review(org.id,'suspended')}><i className="bi bi-pause-circle me-1"/>Suspend</button>}
          {isPlatformAdmin && org.status === 'suspended' && <button className="btn btn-outline-success btn-sm" onClick={()=>review(org.id,'active')}><i className="bi bi-arrow-counterclockwise me-1"/>Reactivate</button>}
        </div>
      </article></div>)}
    </div>}
    {viewingOrganization && <div className="modal show d-block" style={{background:'rgba(0,0,0,.58)'}} role="dialog" aria-modal="true" aria-labelledby="organization-details-title" onMouseDown={event=>{if(event.target===event.currentTarget)setViewingOrganization(null);}}>
      <div className="modal-dialog modal-dialog-centered modal-lg"><section className="modal-content card-custom border-0">
        <header className="modal-header"><div><span className="small text-uppercase fw-bold text-evsu-primary">Organization record</span><h2 className="modal-title fs-5 fw-bold mt-1" id="organization-details-title">{viewingOrganization.name}</h2></div><button type="button" className="btn-close" aria-label="Close organization details" onClick={()=>setViewingOrganization(null)}/></header>
        <div className="modal-body">
          <div className="d-flex flex-wrap gap-2 mb-4"><span className="badge bg-dark text-uppercase">{viewingOrganization.organization_type.replaceAll('_',' ')}</span><span className={`badge ${viewingOrganization.status==='active'?'bg-success':viewingOrganization.status==='pending'?'bg-warning text-dark':viewingOrganization.status==='rejected'?'bg-danger':'bg-secondary'}`}>{viewingOrganization.status}</span></div>
          {viewingOrganization.tagline && <p className="text-secondary mb-4">{viewingOrganization.tagline}</p>}
          <dl className="row g-3 mb-0">
            <div className="col-sm-6"><dt className="small text-muted">Public portal</dt><dd className="mb-0"><Link to={`/public/${viewingOrganization.slug}`} target="_blank" rel="noreferrer">/public/{viewingOrganization.slug}<i className="bi bi-box-arrow-up-right ms-2"/></Link></dd></div>
            <div className="col-sm-6"><dt className="small text-muted">Organization owner / applicant</dt><dd className="mb-0">{viewingOrganization.creator_name || 'Not recorded'}</dd></div>
            <div className="col-sm-6"><dt className="small text-muted">Active members</dt><dd className="mb-0">{Number(viewingOrganization.member_count || 0)}</dd></div>
            <div className="col-sm-6"><dt className="small text-muted">Submitted</dt><dd className="mb-0">{viewingOrganization.created_at || 'Not recorded'}</dd></div>
            {viewingOrganization.reviewed_at && <div className="col-sm-6"><dt className="small text-muted">Last reviewed</dt><dd className="mb-0">{viewingOrganization.reviewed_at}</dd></div>}
            {viewingOrganization.address && <div className="col-12"><dt className="small text-muted">Address</dt><dd className="mb-0">{viewingOrganization.address}</dd></div>}
            {viewingOrganization.application_notes && <div className="col-12"><dt className="small text-muted">Review notes</dt><dd className="mb-0">{viewingOrganization.application_notes}</dd></div>}
          </dl>
        </div>
        <footer className="modal-footer"><button className="btn btn-light" onClick={()=>setViewingOrganization(null)}>Close</button></footer>
      </section></div>
    </div>}
    {showForm && <div className="modal show d-block" style={{background:'rgba(0,0,0,.55)'}}><div className="modal-dialog modal-dialog-centered"><form className="modal-content card-custom border-0" onSubmit={submit}>
      <div className="modal-header"><h5 className="fw-bold mb-0">Organization Application</h5><button type="button" className="btn-close" onClick={()=>setShowForm(false)}/></div>
      <div className="modal-body"><label className="form-label">Organization name</label><input required className="form-control mb-3" value={form.name} onChange={e=>setName(e.target.value)}/><label className="form-label">Type</label><select className="form-select mb-3" value={form.organization_type} onChange={e=>setForm({...form,organization_type:e.target.value})}>{['lgu','barangay','school','sports_club','community_league','commercial_organizer','other'].map(type=><option value={type} key={type}>{type.replaceAll('_',' ')}</option>)}</select><label className="form-label">Public portal slug</label><div className="input-group mb-3"><span className="input-group-text">/public/</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="form-control" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></div><label className="form-label">Tagline</label><input className="form-control" value={form.tagline} onChange={e=>setForm({...form,tagline:e.target.value})}/></div>
      <div className="modal-footer"><button type="button" className="btn btn-light" onClick={()=>setShowForm(false)}>Cancel</button><button className="btn btn-evsu">Submit Application</button></div>
    </form></div></div>}
  </div>;
};

export default OrganizationManagement;
