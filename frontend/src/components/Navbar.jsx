import React from 'react';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';

const roleBadgeClass = (role) => {
  switch (role) {
    case 'admin':               return 'bg-danger text-white';
    case 'tournament_organizer':return 'bg-warning text-dark';
    case 'coach_manager':       return 'bg-primary text-white';
    case 'finance_officer':     return 'bg-success text-white';
    case 'player':              return 'bg-dark text-white';
    default:                    return 'bg-secondary text-white';
  }
};

const Navbar = ({ onMenuClick, adminTheme, onThemeToggle }) => {
  const { user, logout } = useAuth();
  const handleLogout = () => {
    const isPlatformAdmin = ['platform_admin', 'admin'].includes(user?.role);
    logout();
    window.location.replace(isPlatformAdmin ? '/admin' : '/login');
  };

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const roleLabel = user?.role
    ? (user.role === 'admin' ? 'Administrator' : user.role.replaceAll('_', ' '))
    : '';

  return (
    <header className="top-navbar">
      {/* Left — Brand */}
      <div className="navbar-brand-name">
        <button className="mobile-menu-btn" onClick={onMenuClick} aria-label="Open navigation">
          <i className="bi bi-list" />
        </button>
        <div className="navbar-brand-icon">
          <i className="bi bi-trophy-fill" />
        </div>
        <span className="d-none d-sm-inline">FullCourt</span>
      </div>

      {/* Right — User section */}
      <div className="navbar-user-section">
        {adminTheme && <button type="button" className="admin-theme-toggle" onClick={onThemeToggle} title={`Switch to ${adminTheme === 'dark' ? 'light' : 'dark'} mode`} aria-label="Toggle admin color theme"><i className={`bi bi-${adminTheme === 'dark' ? 'sun-fill' : 'moon-stars-fill'}`} /></button>}
        {/* Notification bell */}
        <Link
          to="/notifications"
          className="navbar-notification-btn text-decoration-none"
          title="Notifications"
          id="navbar-notifications-btn"
        >
          <i className="bi bi-bell-fill" style={{ fontSize: '1rem' }} />
          <span className="navbar-notification-dot" />
        </Link>

        {user && (
          <>
            {/* User info */}
            <div className="navbar-user-info d-none d-md-block">
              <div className="navbar-user-name">{user.full_name}</div>
              <span className={`navbar-user-badge badge ${roleBadgeClass(user.role)}`}>
                {roleLabel}
              </span>
            </div>

            {/* Avatar */}
            <div className="navbar-avatar" title={user.full_name}>
              {initials}
            </div>

            {/* Logout */}
            <button
              onClick={handleLogout}
              className="btn-logout"
              title="Sign Out"
              id="navbar-logout-btn"
            >
              <i className="bi bi-box-arrow-right" />
              <span className="d-none d-md-inline">Logout</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
