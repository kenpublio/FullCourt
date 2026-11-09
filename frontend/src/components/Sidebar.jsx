import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const menuItems = [
  { section: 'Main', items: [
    { title: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
  ]},
  { section: 'Management', items: [
    { title: 'Accounts & Staff', path: '/users', icon: 'bi-shield-lock-fill', roles: ['platform_admin','admin'] },
    { title: 'Tournaments', path: '/tournaments', icon: 'bi-trophy-fill', roles: ['platform_admin','admin','coach','statistician'] },
    { title: 'Teams & Players', path: '/teams', icon: 'bi-people-fill', roles: ['platform_admin','admin','coach','statistician'] },
    { title: 'Eligibility', path: '/eligibility', icon: 'bi-patch-check-fill', roles: ['platform_admin','admin','coach','statistician'] },
    { title: 'Brackets', path: '/brackets', icon: 'bi-diagram-3-fill', roles: ['platform_admin','admin','statistician'] },
  ]},
  { section: 'Live Ops', items: [
    { title: 'Scoring Access', path: '/officials', icon: 'bi-person-badge-fill', roles: ['platform_admin','admin','statistician'] },
    { title: 'Schedules & Venues', path: '/schedules', icon: 'bi-calendar-event-fill', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
    { title: 'Score Review', path: '/live-scoring', icon: 'bi-broadcast-pin', roles: ['platform_admin','admin'] },
    { title: 'Standings', path: '/standings', icon: 'bi-list-ol', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
  ]},
  { section: 'Insights', items: [
    { title: 'Awards', path: '/awards', icon: 'bi-award-fill', roles: ['platform_admin','admin'] },
    { title: 'Share Cards', path: '/share-cards', icon: 'bi-image-fill', roles: ['platform_admin','admin'] },
    { title: 'Reports', path: '/reports', icon: 'bi-file-earmark-bar-graph-fill', roles: ['platform_admin','admin','coach','assistant_coach'] },
  ]},
  { section: 'Operations', items: [
    { title: 'Payments', path: '/payments', icon: 'bi-credit-card-fill', roles: ['platform_admin','admin','coach'] },
    { title: 'QR Game Access', path: '/qr-attendance', icon: 'bi-qr-code-scan', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
    { title: 'Incident Reports', path: '/game-day', icon: 'bi-shield-exclamation', roles: ['platform_admin','admin','statistician'] },
  ]},
  { section: 'Account', items: [
    { title: 'Notifications', path: '/notifications', icon: 'bi-bell-fill', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
    { title: 'My Profile', path: '/profile', icon: 'bi-person-circle', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
    { title: 'Settings', path: '/settings', icon: 'bi-gear-fill', roles: ['platform_admin','admin','coach','assistant_coach','statistician'] },
  ]},
];

const Sidebar = ({ open = false, onClose }) => {
  const { user } = useAuth();
  const role = user?.role || 'coach';

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const roleLabel = role === 'platform_admin' || role === 'admin' ? 'Administrator' : role === 'statistician' ? 'Staff Admin' : role === 'assistant_coach' ? 'Assistant Coach' : role.replaceAll('_', ' ');
  const roleHome = ['platform_admin','admin'].includes(role) ? '/platform'
    : ['coach','assistant_coach'].includes(role) ? '/coach' : '/dashboard';

  return (
    <aside className={`sidebar-wrapper${open ? ' is-open' : ''}`} aria-label="Primary navigation">
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-logo">
          <i className="bi bi-trophy-fill" />
        </div>
        <div className="sidebar-brand-text">
          <h5>FullCourt</h5>
          <span className="sidebar-subtitle">Basketball Operations</span>
        </div>
      </div>

      {/* User mini card */}
      {user && (
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name">{user.full_name || 'User'}</div>
            <div className="sidebar-user-role">{roleLabel}</div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <ul className="sidebar-menu">
        {menuItems.map(section => {
          const visible = section.items.filter(i => i.roles.includes(role));
          if (!visible.length) return null;
          return (
            <React.Fragment key={section.section}>
              <li>
                <div className="sidebar-section-label">{section.section}</div>
              </li>
              {visible.map((item, idx) => {
                const destination = item.title === 'Dashboard' ? roleHome : item.path;
                const label = item.title === 'Dashboard' ? (role === 'assistant_coach' ? 'Assistant Coach Home' : role === 'coach' ? 'Coach Workspace' : item.title) : item.title;
                return (
                <li key={idx} className="sidebar-item">
                  <NavLink
                    to={destination}
                    className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
                    onClick={onClose}
                  >
                    <i className={`bi ${item.icon}`} />
                    <span>{label}</span>
                  </NavLink>
                </li>
                );
              })}
            </React.Fragment>
          );
        })}
      </ul>

      {/* Footer */}
      <div className="sidebar-footer">
        FullCourt v1.0 &copy; {new Date().getFullYear()}
      </div>
    </aside>
  );
};

export default Sidebar;
