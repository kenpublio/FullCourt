import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const menuItems = [
  { section: 'Main', items: [
    { title: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player','official','statistician'] },
  ]},
  { section: 'Management', items: [
    { title: 'Organizations', path: '/organizations', icon: 'bi-buildings-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
    { title: 'User & Role Ops', path: '/users', icon: 'bi-shield-lock-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
    { title: 'Tournaments', path: '/tournaments', icon: 'bi-trophy-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager'] },
    { title: 'Teams & Players', path: '/teams', icon: 'bi-people-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager'] },
    { title: 'Eligibility', path: '/eligibility', icon: 'bi-patch-check-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager'] },
    { title: 'Brackets', path: '/brackets', icon: 'bi-diagram-3-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
  ]},
  { section: 'Live Ops', items: [
    { title: 'Officials & Assignments', path: '/officials', icon: 'bi-person-badge-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','official','statistician'] },
    { title: 'Schedules & Venues', path: '/schedules', icon: 'bi-calendar-event-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player','official','statistician'] },
    { title: 'Venues & Courts', path: '/venues', icon: 'bi-geo-alt-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
    { title: 'Live Scoring', path: '/live-scoring', icon: 'bi-broadcast-pin', roles: ['platform_admin','admin','organization_admin','tournament_organizer','statistician'] },
    { title: 'Statistician Console', path: '/scorekeeper', icon: 'bi-clipboard-data-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','statistician'] },
    { title: 'Standings', path: '/standings', icon: 'bi-list-ol', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player','official','statistician'] },
  ]},
  { section: 'Insights', items: [
    { title: 'My Performance', path: '/player/performance', icon: 'bi-graph-up-arrow', roles: ['player'] },
    { title: 'Awards', path: '/awards', icon: 'bi-award-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
    { title: 'Share Cards', path: '/share-cards', icon: 'bi-image-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
    { title: 'Reports', path: '/reports', icon: 'bi-file-earmark-bar-graph-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager'] },
  ]},
  { section: 'Operations', items: [
    { title: 'QR Game Access', path: '/qr-attendance', icon: 'bi-qr-code-scan', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager'] },
    { title: 'Game-Day Control', path: '/game-day', icon: 'bi-clipboard2-pulse-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer'] },
  ]},
  { section: 'Account', items: [
    { title: 'Eligibility Documents', path: '/player/documents', icon: 'bi-file-earmark-lock-fill', roles: ['player'] },
    { title: 'Notifications', path: '/notifications', icon: 'bi-bell-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player','official','statistician'] },
    { title: 'Basketball History',      path: '/history',       icon: 'bi-clock-history',         roles: ['player'] },
    { title: 'My Profile', path: '/profile', icon: 'bi-person-circle', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player','official','statistician'] },
    { title: 'Settings', path: '/settings', icon: 'bi-gear-fill', roles: ['platform_admin','admin','organization_admin','tournament_organizer','coach','coach_manager','player'] },
  ]},
];

const Sidebar = ({ open = false, onClose }) => {
  const { user } = useAuth();
  const role = user?.role || 'player';

  const initials = user?.full_name
    ? user.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : 'U';

  const roleLabel = role === 'platform_admin' || role === 'admin' ? 'Platform Administrator' : role.replaceAll('_', ' ');
  const roleHome = ['platform_admin','admin'].includes(role) ? '/platform'
    : ['organization_admin','tournament_organizer'].includes(role) ? '/organizer'
    : ['coach','coach_manager'].includes(role) ? '/coach'
    : role === 'player' ? '/player' : role === 'statistician' ? '/statistician' : '/official';

  return (
    <aside className={`sidebar-wrapper${open ? ' is-open' : ''}`}>
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
                const label = item.title === 'Dashboard' ? (role === 'player' ? 'Player Home' : ['coach','coach_manager'].includes(role) ? 'Coach Workspace' : item.title) : item.title;
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
