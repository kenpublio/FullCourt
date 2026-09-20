import React from 'react';

const Footer = () => (
  <footer className="app-footer">
    <div>
      <strong>FullCourt</strong>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span className="app-footer-badge">
        <i className="bi bi-shield-check" />
        FullCourt v1.0
      </span>
      <span>&copy; {new Date().getFullYear()}</span>
    </div>
  </footer>
);

export default Footer;
