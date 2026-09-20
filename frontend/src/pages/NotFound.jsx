import React from 'react';
import { Link } from 'react-router-dom';

const NotFound = () => {
  return (
    <div className="text-center py-5">
      <h1 className="display-1 fw-bold text-evsu-primary">404</h1>
      <h3 className="fw-bold mb-3">Page Not Found</h3>
      <p className="text-muted mb-4">The requested page or resource could not be found.</p>
      <Link to="/dashboard" className="btn btn-evsu px-4 py-2 fw-bold">
        Return to Dashboard
      </Link>
    </div>
  );
};

export default NotFound;
