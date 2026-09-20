import { useEffect, useState } from 'react';
import operationsService from '../services/operationsService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const initialForm = { name:'', organization_type:'barangay', slug:'', tagline:'', primary_color:'#F97316', secondary_color:'#18181B' };

const OrganizationManagement = () => {
  const { user } = useAuth();
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const isPlatformAdmin = ['platform_admin','admin'].includes(user?.role);

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
  const review = async (id, status) => { await operationsService.reviewOrganization(id, status); await load(); };

  return <div className="container-fluid p-0">
    <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div><h3 className="fw-bold mb-1"><i className="bi bi-buildings-fill text-evsu-primary me-2"/>Basketball Organizations</h3><p className="text-muted small mb-0">Independent workspaces for LGUs, barangays, schools, clubs, and community leagues</p></div>
      <button className="btn btn-evsu" onClick={()=>setShowForm(true)}><i className="bi bi-plus-lg me-1"/>Apply for Organization</button>
    </div>
    {message && <div className="alert alert-info">{message}</div>}
    {loading ? <LoadingSpinner message="Loading organizations..."/> : <div className="row g-3">
      {organizations.length === 0 && <div className="col-12"><div className="card-custom p-5 text-center text-muted"><i className="bi bi-buildings fs-1 d-block mb-3"/>No organization workspace yet.</div></div>}
      {organizations.map(org => <div className="col-md-6 col-xl-4" key={org.id}><article className="card-custom p-4 h-100" style={{borderTop:`4px solid ${org.primary_color}`}}>
        <div className="d-flex justify-content-between gap-2"><span className="badge bg-dark text-uppercase">{org.organization_type.replaceAll('_',' ')}</span><span className={`badge ${org.status==='active'?'bg-success':org.status==='pending'?'bg-warning text-dark':'bg-secondary'}`}>{org.status}</span></div>
        <h5 className="fw-bold mt-3 mb-1">{org.name}</h5><p className="small text-muted">{org.tagline || 'Basketball organization workspace'}</p>
        <div className="small"><i className="bi bi-link-45deg me-1"/>/public/{org.slug}</div>
        {isPlatformAdmin && <div className="d-flex gap-2 mt-4 pt-3 border-top"><button className="btn btn-success btn-sm" onClick={()=>review(org.id,'active')}>Approve</button><button className="btn btn-outline-danger btn-sm" onClick={()=>review(org.id,'suspended')}>Suspend</button></div>}
      </article></div>)}
    </div>}
    {showForm && <div className="modal show d-block" style={{background:'rgba(0,0,0,.55)'}}><div className="modal-dialog modal-dialog-centered"><form className="modal-content card-custom border-0" onSubmit={submit}>
      <div className="modal-header"><h5 className="fw-bold mb-0">Organization Application</h5><button type="button" className="btn-close" onClick={()=>setShowForm(false)}/></div>
      <div className="modal-body"><label className="form-label">Organization name</label><input required className="form-control mb-3" value={form.name} onChange={e=>setName(e.target.value)}/><label className="form-label">Type</label><select className="form-select mb-3" value={form.organization_type} onChange={e=>setForm({...form,organization_type:e.target.value})}>{['lgu','barangay','school','sports_club','community_league','commercial_organizer','other'].map(type=><option value={type} key={type}>{type.replaceAll('_',' ')}</option>)}</select><label className="form-label">Public portal slug</label><div className="input-group mb-3"><span className="input-group-text">/public/</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" className="form-control" value={form.slug} onChange={e=>setForm({...form,slug:e.target.value})}/></div><label className="form-label">Tagline</label><input className="form-control" value={form.tagline} onChange={e=>setForm({...form,tagline:e.target.value})}/></div>
      <div className="modal-footer"><button type="button" className="btn btn-light" onClick={()=>setShowForm(false)}>Cancel</button><button className="btn btn-evsu">Submit Application</button></div>
    </form></div></div>}
  </div>;
};

export default OrganizationManagement;
