import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner message="Verifying session security..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    const role = user?.role;
    const home = ['platform_admin','admin'].includes(role) ? '/platform'
      : ['organization_admin','tournament_organizer'].includes(role) ? '/organizer'
      : ['coach','coach_manager'].includes(role) ? '/coach'
      : role === 'player' ? '/player' : role === 'statistician' ? '/statistician' : '/official';
    return <Navigate to={home} replace />;
  }

  return children;
};

export default ProtectedRoute;
