import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import userService from '../services/userService';
import eligibilityService from '../services/eligibilityService';
import '../styles/admin-profile.css';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [phoneNumber, setPhoneNumber] = useState(user?.phone_number || '');
  const [address, setAddress] = useState(user?.address || '');
  const [message, setMessage] = useState('');
  const [membership, setMembership] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const fileRef = useRef(null);
  const isPlatformAdmin=['platform_admin','admin'].includes(user?.role);

  const apiRoot = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8767/api').replace(/\/api\/?$/, '');
  const photoUrl = user?.avatar_url
    ? (user.avatar_url.startsWith('http') ? user.avatar_url : `${apiRoot}${user.avatar_url}`)
    : '';
  const roleLabel = isPlatformAdmin ? 'Platform Administrator' : (user?.role?.replaceAll('_', ' ') || 'Player');
  const accountActive = user?.is_active !== 0 && user?.is_active !== undefined;

  useEffect(() => {
    if (user?.role === 'player') {
      eligibilityService.getMyMembership()
        .then(setMembership)
        .catch(() => setMembership({ has_team: false, membership: null }));
    }
  }, [user?.role]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const updated = await userService.updateProfile({ full_name: fullName, phone_number: phoneNumber, address });
      updateUser(updated);
      setMessage('Profile updated successfully!');
      setIsEditing(false);
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to update profile.');
    }
    setTimeout(() => setMessage(''), 3000);
  };

  const cancelEditing = () => {
    setFullName(user?.full_name || '');
    setPhoneNumber(user?.phone_number || '');
    setAddress(user?.address || '');
    setIsEditing(false);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const avatarUrl = await userService.uploadPhoto(file);
      updateUser({ ...user, avatar_url: avatarUrl });
      setMessage('Profile photo updated!');
    } catch (error) {
      setMessage(error.response?.data?.message || 'Unable to upload photo.');
    }
    setUploading(false);
    setTimeout(() => setMessage(''), 3000);
  };

  return (
    <div className="container-fluid p-0 page-enter" style={{ maxWidth: '900px' }}>
      <section className="profile-avatar-card mb-4">
        <div className="profile-avatar-img position-relative">
          {photoUrl
            ? <img src={photoUrl} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }} />
            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(user?.full_name || 'U').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
              </div>}
          {isEditing && <button className="btn btn-sm btn-light rounded-circle position-absolute shadow" style={{ bottom: 4, right: 4, width: 36, height: 36 }}
            onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload photo" title="Upload photo">
            <i className={`bi ${uploading ? 'bi-arrow-repeat spin' : 'bi-camera-fill'}`} />
          </button>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={handlePhoto} />
        </div>
        <div className="position-relative">
          <div className="profile-name-display">{user?.full_name || 'Basketball User'}</div>
          <div className="text-white-50 small mb-2">{user?.email}</div>
          <div className="d-flex flex-wrap gap-2">
            <span className="profile-role-pill"><i className="bi bi-shield-check me-1" />{roleLabel}</span>
            <span className={`badge ${accountActive ? 'bg-success' : 'bg-danger'}`}>
              <i className={`bi ${accountActive ? 'bi-check-circle' : 'bi-x-circle'} me-1`} />{accountActive ? 'Active' : 'Deactivated'}
            </span>
          </div>
        </div>
        <i className="bi bi-dribbble profile-hero-icon" aria-hidden="true" />
      </section>

      {user?.role === 'player' && membership?.membership && (
        <div className="card-custom p-4 mb-4">
          <h4 className="fw-bold text-dark mb-3"><i className="bi bi-trophy-fill text-evsu-primary me-2" />Selected Sport</h4>
          <div className="row g-3">
            <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Sport</label><input type="text" className="form-control" value={membership.membership.sport_name || 'N/A'} disabled /></div>
            <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Team</label><input type="text" className="form-control" value={membership.membership.team_name || 'N/A'} disabled /></div>
            <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Tournament</label><input type="text" className="form-control" value={membership.membership.tournament_name || 'N/A'} disabled /></div>
            <div className="col-md-6"><label className="form-label small fw-semibold text-secondary">Membership Status</label><input type="text" className="form-control text-uppercase fw-bold" value={membership.membership.eligibility_status || 'N/A'} disabled /></div>
          </div>
        </div>
      )}

      <div className="card-custom p-4 mb-4">
        <div className="d-flex justify-content-between align-items-center mb-3"><h4 className="fw-bold text-dark mb-0"><i className="bi bi-person-circle text-evsu-primary me-2"></i>User Profile</h4>{!isEditing&&<button type="button" className="btn btn-evsu rounded-pill px-4 py-2 fw-semibold shadow-sm d-flex align-items-center gap-2" onClick={()=>setIsEditing(true)}><i className="bi bi-pencil-square"/>Edit Profile</button>}</div>

        {message && <div className="alert alert-success py-2 px-3 small rounded-3">{message}</div>}

        <form onSubmit={handleSubmit}>
          {isPlatformAdmin&&<section className="admin-profile-summary mb-4"><article><i className="bi bi-person-badge"/><div><small>Account ID</small><b>ADMIN-{String(user?.id||0).padStart(4,'0')}</b></div></article><article><i className="bi bi-shield-lock"/><div><small>Permission scope</small><b>Full Platform Control</b></div></article><article><i className="bi bi-envelope-check"/><div><small>Authentication</small><b>Email &amp; Password</b></div></article><article><i className="bi bi-check-circle"/><div><small>Account status</small><b>{accountActive?'Active':'Deactivated'}</b></div></article></section>}

          <div className="row g-3 mb-3">
            <div className="col-12">
              <label className="form-label small fw-semibold text-secondary">Assigned System Role</label>
              <input type="text" className="form-control text-uppercase fw-bold text-evsu-primary" value={user?.role === 'admin' ? 'Administrator' : (user?.role?.replaceAll('_', ' ') || 'PLAYER')} disabled />
            </div>
          </div>

          <div className="mb-3">
            <label htmlFor="profile-full-name" className="form-label small fw-semibold text-secondary">Full Name</label>
            <input id="profile-full-name" type="text" className="form-control" value={fullName} onChange={(e) => setFullName(e.target.value)} disabled={!isEditing} required />
          </div>

          <div className="mb-3">
            <label className="form-label small fw-semibold text-secondary">Email Address</label>
            <input type="email" className="form-control" value={user?.email || ''} disabled />
          </div>

          {user?.role === 'player' && <div className="row g-3 mb-3">
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary">Date of Birth</label>
              <input type="date" className="form-control" value={user?.birth_date || ''} disabled />
            </div>
            <div className="col-md-6">
              <label className="form-label small fw-semibold text-secondary">Current Age</label>
              <input type="text" className="form-control" value={user?.birth_date ? new Date().getFullYear() - new Date(user.birth_date).getFullYear() - (new Date() < new Date(new Date().getFullYear(), new Date(user.birth_date).getMonth(), new Date(user.birth_date).getDate()) ? 1 : 0) : 'N/A'} disabled />
            </div>
          </div>}

          {!isPlatformAdmin&&<><div className="mb-3"><label htmlFor="profile-address" className="form-label small fw-semibold text-secondary">Complete Address</label><textarea id="profile-address" className="form-control" rows="2" value={address} onChange={(e) => setAddress(e.target.value)} disabled={!isEditing} /></div><div className="mb-4"><label htmlFor="profile-phone-number" className="form-label small fw-semibold text-secondary">Phone Number</label><input id="profile-phone-number" type="text" className="form-control" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} disabled={!isEditing} /></div></>}

          {isEditing&&<div className="d-flex flex-wrap gap-2"><button type="submit" className="btn btn-evsu rounded-pill px-4 py-2 fw-semibold shadow-sm"><i className="bi bi-check2-circle me-2" />Save Changes</button><button type="button" className="btn btn-outline-secondary rounded-pill px-4 py-2 fw-semibold" onClick={cancelEditing}><i className="bi bi-x-lg me-2"/>Cancel</button></div>}
        </form>
      </div>
    </div>
  );
};

export default Profile;
