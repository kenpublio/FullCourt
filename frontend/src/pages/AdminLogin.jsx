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
      const account = await login(identifier, password);
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
          <div className="admin-security-label"><i className="bi bi-shield-lock-fill" /> Restricted platform access</div>
          <h1>Control the league.<br /><em>Protect the game.</em></h1>
          <p>Review organizations, monitor platform activity, manage access, and keep every basketball competition secure.</p>
          <div className="admin-trust-row"><span><i className="bi bi-check-circle-fill" /> Role protected</span><span><i className="bi bi-check-circle-fill" /> Audited access</span></div>
        </div>

        <div className="admin-login-card">
          <div className="admin-login-icon"><i className="bi bi-person-badge-fill" /></div>
          <span className="admin-card-kicker">Platform console</span>
          <h2>Administrator sign in</h2>
          <p>Access organization oversight, platform security, and system-wide controls.</p>
          {error && <div className="admin-login-error"><i className="bi bi-exclamation-triangle-fill" /> {error}</div>}
          <form onSubmit={submit}>
            <label htmlFor="admin-identifier">Email or administrator account</label>
            <div className="admin-input-wrap"><i className="bi bi-person-fill" /><input id="admin-identifier" value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Enter authorized account" autoComplete="username" required /></div>
            <label htmlFor="admin-password">Password</label>
            <div className="admin-input-wrap"><i className="bi bi-key-fill" /><input id="admin-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter password" autoComplete="current-password" required /><button type="button" onClick={() => setShowPassword(!showPassword)} aria-label="Show or hide password"><i className={`bi bi-eye${showPassword ? '-slash' : ''}`} /></button></div>
            <button className="admin-login-submit" disabled={loading}>{loading ? <><span className="spinner-border spinner-border-sm" /> Verifying…</> : <>Open admin console <i className="bi bi-arrow-right" /></>}</button>
          </form>
          <div className="admin-login-links"><Link to="/forgot-password">Forgot password?</Link><Link to="/login"><i className="bi bi-arrow-left" /> User login</Link></div>
        </div>
      </section>
      <small className="admin-login-footer">FullCourt · Secure Administration</small>
    </main>
  );
};

export default AdminLogin;
