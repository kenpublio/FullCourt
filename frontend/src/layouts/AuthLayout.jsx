import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import '../styles/auth-experience.css';

const AuthLayout = () => {
  const isRegister = useLocation().pathname === '/register';
  return (
    <div className={`fc-auth auth-shell min-vh-100 d-flex align-items-center justify-content-center position-relative ${isRegister ? 'fc-auth-register' : ''}`}>
      <div className="auth-decoration auth-decoration-one" />
      <div className="auth-decoration auth-decoration-two" />
      <div className="container-fluid auth-container position-relative z-1">
        <div className="auth-web-card">
          <aside className="auth-story-panel">
            <Link to="/" className="auth-web-brand"><span><i className="bi bi-dribbble" /></span>FullCourt</Link>
            <div className="auth-story-copy">
              <span className="auth-eyebrow"><span className="fc-status-dot" /> Built around the game</span>
              <h1>{isRegister ? <>Your game.<br />Your team.<br /><em>Your next chapter.</em></> : <>More than<br />a game.<br /><em>Your court.</em></>}</h1>
              <p>{isRegister ? 'From your first roster to the final buzzer. Find your place in the FullCourt community.' : 'The people, the preparation, the moments that matter. Bring your basketball world together.'}</p>
              <div className="fc-court-art" aria-hidden="true">
                <svg viewBox="0 0 440 230" fill="none"><rect x="16" y="16" width="408" height="198" rx="6" /><path d="M220 16v198M16 65h64v100H16M424 65h-64v100h64M16 85h25v60H16M424 85h-25v60h25" /><circle cx="220" cy="115" r="40" /><path d="M80 85a30 30 0 0 1 0 60M360 85a30 30 0 0 0 0 60M16 29c157 0 157 172 0 172M424 29c-157 0-157 172 0 172" /><circle cx="49" cy="115" r="8" /><circle cx="391" cy="115" r="8" /></svg>
                <div className="fc-court-ball"><i className="bi bi-dribbble" /></div>
                <div className="fc-court-note"><i className="bi bi-check2-circle" /><span>Every role. One team.<small>Organize · Coach · Play</small></span></div>
              </div>
            </div>
            <small className="fc-story-footer"><span>BASKETBALL, CONNECTED.</span><i className="bi bi-arrow-up-right" /></small>
          </aside>
          <main className="auth-form-panel">
            <div className="auth-mobile-brand"><i className="bi bi-dribbble" /> FullCourt</div>
            <Outlet />
            <div className="auth-copyright">© {new Date().getFullYear()} FullCourt Basketball Management</div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
