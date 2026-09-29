import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ADMIN_ROLES = ['platform_admin', 'admin'];

const AdminLogin = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const { login, logout, user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated && ADMIN_ROLES.includes(user?.role)) navigate('/platform', { replace: true });
  }, [isAuthenticated, user, navigate]);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const account = await login(identifier, password, 'admin');
      if (!ADMIN_ROLES.includes(account.role)) {
        logout();
        setError('This portal is reserved for platform administrators.');
        return;
      }
      navigate('/platform', { replace: true });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Administrator sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="admin-login-shell">
      <div className="admin-login-glow admin-login-glow-one" />
      <div className="admin-login-glow admin-login-glow-two" />
      <section className="admin-login-panel">
        <div className="admin-login-intro">
          <Link to="/" className="admin-login-brand"><span><i className="bi bi-dribbble" /></span> FullCourt</Link>
          <div className="admin-security-label"><i className="bi bi-shield-lock-fill" /> FullCourt Command Center</div>
          <h1>Run the platform.<br /><em>Guard every game.</em></h1>
          <p>A dedicated operations gateway for organization approvals, account security, tournament oversight, and system-wide basketball administration.</p>
          <div className="admin-capability-grid"><article><i className="bi bi-buildings-fill"/><div><b>Organization control</b><span>Review and manage competition operators</span></div></article><article><i className="bi bi-person-lock"/><div><b>Access governance</b><span>Roles, permissions, and account status</span></div></article><article><i className="bi bi-activity"/><div><b>Operations oversight</b><span>Monitor tournaments and active games</span></div></article></div>
          <div className="admin-trust-row"><span><i className="bi bi-check-circle-fill" /> Role protected</span><span><i className="bi bi-check-circle-fill" /> Audited access</span><span><i className="bi bi-check-circle-fill" /> Encrypted session</span></div>
        </div>

        <div className="admin-login-card">
          <div className="admin-card-top"><div className="admin-login-icon"><i className="bi bi-person-badge-fill" /></div><div className="admin-system-state"><i/> SYSTEM ONLINE</div></div>
          <span className="admin-card-kicker">Restricted gateway</span>
          <h2>Platform Administrator</h2>
          <p>Verify your administrator credentials to continue to the FullCourt command center.</p>
          {error && <div className="admin-login-error"><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}
          <form onSubmit={submit}>
            <label htmlFor="admin-identifier">Email or administrator account</label>
            <div className="admin-input-wrap"><i className="bi bi-person-fill" /><input id="admin-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter authorized account" autoComplete="username" required /></div>
            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrap"><i className="bi bi-key-fill" /><input id="admin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} onKeyUp={(event)=>setCapsLock(event.getModifierState('CapsLock'))} placeholder="Enter password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password"><i className={`bi bi-eye${showPassword ? '-slash' : ''}`} /></button></div>
            {capsLock&&<div className="admin-caps-warning"><i className="bi bi-capslock-fill"/> Caps Lock is on</div>}
            <button className="admin-login-submit" disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm" /> Verifying…</> : <>Open admin console <i className="bi bi-arrow-right" /></>}</button>
          </form>
          <div className="admin-login-links"><Link to="/forgot-password">Forgot password?</Link><Link to="/"><i className="bi bi-arrow-left" /> Return to website</Link></div>
          <div className="admin-authorized-note"><i className="bi bi-lock-fill"/><div><b>Authorized administrators only</b><span>Access attempts and administrative activity are recorded for platform security.</span></div></div>
        </div>
      </section>
      <small className="admin-login-footer">FullCourt Platform Security · Protected Administrative Gateway</small>
    </main>
  );
};

export default AdminLogin;
