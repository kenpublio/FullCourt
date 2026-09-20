import React from 'react';

const LoadingSpinner = ({ message = 'Loading basketball data...' }) => (
  <div className="ss-spinner-wrap branded-loader" role="status" aria-live="polite">
    <div className="loader-mark" style={{ position: 'relative', width: 60, height: 60 }}>
      <div className="ss-spinner" />
      <div style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <i className="bi bi-trophy-fill" style={{ color: 'var(--evsu-primary)', fontSize: '1.1rem' }} />
      </div>
    </div>
    <p className="ss-spinner-label">{message}</p>
    <div className="loader-progress"><span /></div>
  </div>
);

export default LoadingSpinner;
