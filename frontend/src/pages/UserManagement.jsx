import React, { useState, useEffect } from 'react';
import userService from '../services/userService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users'); // 'users' or 'logs'
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState(null);
  const [viewingUser, setViewingUser] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', phone_number: '', address: '', role: '' });
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await userService.getUsers();
      setUsers(data);
    } catch (err) {
      setActionMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to fetch users.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const logs = await userService.getAuditLogs();
      setAuditLogs(logs);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchAuditLogs();
  }, []);

  const handleToggleStatus = async (targetUser) => {
    const newStatus = !targetUser.is_active;
    const confirmMsg = `Are you sure you want to ${newStatus ? 'activate' : 'deactivate'} ${targetUser.full_name}?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await userService.toggleUserStatus(targetUser.id, newStatus);
      setActionMessage({ type: 'success', text: res.message });
      fetchUsers();
      fetchAuditLogs();
    } catch (err) {
      setActionMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to change user status.' });
    }
  };

  const openEditor = (targetUser) => {
    setSelectedUser(targetUser);
    setEditForm({ full_name: targetUser.full_name || '', email: targetUser.email || '', phone_number: targetUser.phone_number || '', address: targetUser.address || '', role: targetUser.role || 'player' });
  };

  const handleUserUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await userService.updateUser(selectedUser.id, editForm);
      setActionMessage({ type: 'success', text: res.message || 'User account updated successfully.' });
      setSelectedUser(null);
      await fetchUsers();
      fetchAuditLogs();
    } catch (err) {
      setActionMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to update user account.' });
    }
  };

  const handleDelete = async (targetUser) => {
    if (!window.confirm(`Remove ${targetUser.full_name} from active access? Historical tournament records will be retained.`)) return;
    try {
      const res = await userService.deleteUser(targetUser.id);
      setActionMessage({ type: 'success', text: res.message });
      await fetchUsers();
      fetchAuditLogs();
    } catch (err) {
      setActionMessage({ type: 'danger', text: err.response?.data?.message || 'Failed to remove user account.' });
    }
  };

  const getRoleBadge = (role) => {
    switch (role) {
      case 'admin': return 'bg-danger';
      case 'tournament_organizer': return 'bg-warning text-dark';
      case 'coach_manager': return 'bg-primary';
      case 'finance_officer': return 'bg-success';
      case 'player': return 'bg-dark';
      default: return 'bg-secondary';
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.phone_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          u.address?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="container-fluid p-0">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
        <div>
          <h3 className="fw-bold text-dark mb-1">
            <i className="bi bi-shield-lock-fill text-evsu-primary me-2"></i>
            User &amp; Role Management
          </h3>
          <p className="text-muted small mb-0">
            Control user permissions, role authorizations, and platform audit security logs
          </p>
        </div>

        <div className="btn-group" role="group">
          <button
            type="button"
            className={`btn btn-sm px-3 fw-semibold ${activeTab === 'users' ? 'btn-evsu' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('users')}
          >
            <i className="bi bi-people-fill me-1"></i> User Directory ({users.length})
          </button>
          <button
            type="button"
            className={`btn btn-sm px-3 fw-semibold ${activeTab === 'logs' ? 'btn-evsu' : 'btn-outline-secondary'}`}
            onClick={() => setActiveTab('logs')}
          >
            <i className="bi bi-journal-text me-1"></i> Security Audit Logs ({auditLogs.length})
          </button>
        </div>
      </div>

      {actionMessage.text && (
        <div className={`alert alert-${actionMessage.type} alert-dismissible fade show py-2 px-3 mb-3 small rounded-3`} role="alert">
          <i className="bi bi-info-circle-fill me-2"></i>
          {actionMessage.text}
          <button type="button" className="btn-close py-2" onClick={() => setActionMessage({ type: '', text: '' })}></button>
        </div>
      )}

      {activeTab === 'users' ? (
        <div className="card-custom p-4">
          {/* Filters Bar */}
          <div className="row g-3 mb-4">
            <div className="col-md-6 col-lg-4">
              <div className="input-group input-group-sm">
                <span className="input-group-text bg-light border-end-0">
                  <i className="bi bi-search text-muted"></i>
                </span>
                <input
                  type="text"
                  className="form-control border-start-0"
                  placeholder="Search by name, email, or mobile number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="col-md-6 col-lg-4 ms-auto">
              <div className="d-flex align-items-center gap-2">
                <label className="small text-muted fw-semibold text-nowrap">Filter Role:</label>
                <select
                  className="form-select form-select-sm"
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="platform_admin">Platform Administrator</option>
                  <option value="organization_admin">Organization Administrator</option>
                  <option value="tournament_organizer">Tournament Organizer</option>
                  <option value="coach">Coach</option>
                  <option value="official">Official / Referee</option>
                  <option value="statistician">Statistician</option>
                  <option value="player">Player</option>
                </select>
              </div>
            </div>
          </div>

          {/* User Data Table */}
          {loading ? (
            <LoadingSpinner message="Loading user directory..." />
          ) : (
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="table-light">
                  <tr>
                    <th>ID / Name</th>
                    <th>Mobile Number</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Address</th>
                    <th>Status</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-4 text-muted">
                        No user accounts match the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id}>
                        <td>
                          <div className="fw-semibold text-dark">{u.full_name}</div>
                          <small className="text-muted" style={{ fontSize: '0.75rem' }}>User #{u.id}</small>
                        </td>
                        <td className="text-nowrap">
                          <span className={`user-mobile-value ${u.phone_number ? '' : 'is-empty'}`}>
                            <i className="bi bi-phone" /> {u.phone_number || 'Not provided'}
                          </span>
                        </td>
                        <td className="small">{u.email}</td>
                        <td>
                          <span className={`badge badge-role ${getRoleBadge(u.role)}`}>
                            {u.role?.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="small text-muted">{u.address || 'Not specified'}</td>
                        <td>
                          {u.is_active ? (
                            <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill">
                              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i> Active
                            </span>
                          ) : (
                            <span className="badge bg-danger-subtle text-danger border border-danger-subtle rounded-pill">
                              <i className="bi bi-circle-fill me-1" style={{ fontSize: '0.5rem' }}></i> Deactivated
                            </span>
                          )}
                        </td>
                        <td className="text-end">
                          {['platform_admin','admin'].includes(currentUser?.role) ? (
                            <div className="user-row-actions">
                              <button type="button" className="user-action-btn view" title="View account" onClick={()=>setViewingUser(u)}><i className="bi bi-eye"/><span>View</span></button>
                              <button
                                type="button"
                                className="user-action-btn edit"
                                title="Edit account"
                                onClick={() => openEditor(u)}
                              >
                                <i className="bi bi-pencil-square"></i><span>Edit</span>
                              </button>
                              {!['platform_admin','admin'].includes(u.role) && <button
                                type="button"
                                className="user-action-btn delete"
                                title="Delete account access"
                                onClick={() => handleDelete(u)}
                                disabled={u.id === currentUser?.id}
                              >
                                <i className="bi bi-trash3"></i><span>Delete</span>
                              </button>}
                              {!u.is_active&&<button type="button" className="btn btn-sm btn-outline-success" onClick={()=>handleToggleStatus(u)}><i className="bi bi-person-check"/><span>Restore</span></button>}
                            </div>
                          ) : (
                            <span className="text-muted small">View Only</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* Audit Security Logs Tab */
        <div className="card-custom p-4">
          <h5 className="fw-bold text-dark mb-3">
            <i className="bi bi-shield-check text-success me-2"></i>
            System Security Audit Trail
          </h5>
          <div className="table-responsive">
            <table className="table table-sm table-striped align-middle mb-0" style={{ fontSize: '0.85rem' }}>
              <thead className="table-dark">
                <tr>
                  <th>Timestamp</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Performed By</th>
                  <th>Audit Details</th>
                  <th>IP Address</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="text-center py-3 text-muted">No audit log records found.</td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="text-nowrap text-muted">{log.created_at}</td>
                      <td>
                        <span className="badge bg-dark font-monospace">{log.action}</span>
                      </td>
                      <td>
                        <span className="badge bg-secondary">{log.module}</span>
                      </td>
                      <td className="fw-semibold text-dark">
                        {log.full_name ? `${log.full_name} (${log.role})` : 'System / Guest'}
                      </td>
                      <td className="text-wrap">{log.details}</td>
                      <td className="font-monospace text-muted" style={{ fontSize: '0.75rem' }}>{log.ip_address}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {viewingUser && <div className="modal show d-block user-view-modal" style={{ backgroundColor:'rgba(0,0,0,.68)' }} role="dialog" aria-modal="true" aria-labelledby="user-view-title">
        <div className="modal-dialog modal-dialog-centered"><div className="modal-content card-custom border-0 overflow-hidden">
          <div className="user-view-hero"><button type="button" className="btn-close btn-close-white" aria-label="Close" onClick={()=>setViewingUser(null)}/><span className="user-view-avatar">{viewingUser.full_name?.split(' ').map(part=>part[0]).join('').slice(0,2).toUpperCase()}</span><div><small>FULLCOURT ACCOUNT</small><h4 id="user-view-title">{viewingUser.full_name}</h4><span className={`badge badge-role ${getRoleBadge(viewingUser.role)}`}>{viewingUser.role?.replaceAll('_',' ')}</span></div></div>
          <div className="modal-body user-view-details">
            <div><span><i className="bi bi-phone"/> Mobile Number</span><strong>{viewingUser.phone_number||'Not provided'}</strong></div>
            <div><span><i className="bi bi-envelope"/> Email / Login</span><strong>{viewingUser.email||'Not provided'}</strong></div>
            <div className="full"><span><i className="bi bi-geo-alt"/> Address</span><strong>{viewingUser.address||'Not specified'}</strong></div>
            <div><span><i className="bi bi-calendar3"/> Registered</span><strong>{viewingUser.created_at ? new Date(viewingUser.created_at).toLocaleDateString('en-PH') : 'Not available'}</strong></div>
            <div><span><i className="bi bi-shield-check"/> Account Status</span><strong className={viewingUser.is_active?'text-success':'text-danger'}>{viewingUser.is_active?'Active':'Deactivated'}</strong></div>
          </div>
          <div className="modal-footer"><button type="button" className="btn btn-light btn-sm" onClick={()=>setViewingUser(null)}>Close</button><button type="button" className="btn btn-evsu btn-sm" onClick={()=>{setViewingUser(null);openEditor(viewingUser);}}><i className="bi bi-pencil-square me-1"/>Edit Account</button></div>
        </div></div>
      </div>}

      {/* Edit User Modal */}
      {selectedUser && (
        <div className="modal show d-block" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content card-custom border-0">
              <div className="modal-header border-bottom">
                <h5 className="modal-header-title fw-bold text-dark mb-0">
                  Edit User Account
                </h5>
                <button type="button" className="btn-close" onClick={() => setSelectedUser(null)}></button>
              </div>
              <form onSubmit={handleUserUpdate}>
                <div className="modal-body">
                  <p className="small text-muted mb-3">
                    Update contact information and platform access for {selectedUser.full_name}.
                  </p>
                  <div className="row g-3">
                  <div className="col-12"><label className="form-label small fw-semibold">Full Name</label><input className="form-control" value={editForm.full_name} onChange={e=>setEditForm({...editForm,full_name:e.target.value})} required /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold">Email / Login</label><input className="form-control" value={editForm.email} onChange={e=>setEditForm({...editForm,email:e.target.value})} required /></div>
                  <div className="col-md-6"><label className="form-label small fw-semibold">Mobile Number</label><input className="form-control" value={editForm.phone_number} onChange={e=>setEditForm({...editForm,phone_number:e.target.value})} placeholder="09XXXXXXXXX" /></div>
                  <div className="col-12"><label className="form-label small fw-semibold">Address</label><textarea className="form-control" rows="2" value={editForm.address} onChange={e=>setEditForm({...editForm,address:e.target.value})} placeholder="Complete address" /></div>
                  <div className="col-12">
                    <label className="form-label small fw-semibold text-secondary">Role &amp; Permissions</label>
                    <select
                      className="form-select"
                      value={editForm.role}
                      onChange={(e) => setEditForm({...editForm,role:e.target.value})}
                      required
                    >
                      <option value="platform_admin">Platform Administrator</option>
                      <option value="organization_admin">Organization Administrator</option>
                      <option value="tournament_organizer">Tournament Organizer</option>
                      <option value="coach">Coach</option>
                      <option value="official">Official / Referee</option>
                      <option value="statistician">Statistician</option>
                      <option value="player">Player</option>
                    </select>
                  </div>
                  </div>
                </div>

                <div className="modal-footer border-top">
                  <button type="button" className="btn btn-light btn-sm" onClick={() => setSelectedUser(null)}>Cancel</button>
                  <button type="submit" className="btn btn-evsu btn-sm"><i className="bi bi-check2-circle me-1"/>Save User Changes</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
