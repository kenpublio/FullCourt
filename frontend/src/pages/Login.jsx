import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const account = await login(email, password);
      const homeByRole = {
        platform_admin: '/platform', admin: '/platform',
        organization_admin: '/organizer', tournament_organizer: '/organizer',
        coach: '/coach', coach_manager: '/coach', player: '/player',
        official: '/official', statistician: '/statistician',
      };
      navigate(homeByRole[account.role] || '/dashboard', { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-form auth-login-form">
      <div className="auth-page-heading mb-4">
        <span className="auth-page-icon"><i className="bi bi-person-check-fill" /></span>
        <span className="auth-page-kicker">Your courtside access</span>
        <h2>Welcome back.</h2>
        <p>Your team is waiting. Sign in to pick up where you left off.</p>
      </div>

      {error && (
        <div className="alert alert-danger py-2 px-3 small rounded-3 d-flex align-items-center gap-2 mb-3" role="alert">
          <i className="bi bi-exclamation-triangle-fill fs-5"></i>
          <div>{error}</div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="auth-field mb-3">
          <label htmlFor="login-contact">Email or mobile number</label>
          <div className="auth-input-wrap"><i className="bi bi-person" />
            <input
              type="text"
              id="login-contact"
              autoComplete="username"
              className="form-control"
              placeholder="name@gmail.com or 09XXXXXXXXX"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field mb-2">
          <label htmlFor="login-password">Password</label>
          <div className="auth-input-wrap"><i className="bi bi-lock" />
            <input
              type={showPassword ? 'text' : 'password'}
              id="login-password"
              autoComplete="current-password"
              className="form-control"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" className="auth-password-toggle" onClick={() => setShowPassword(value => !value)} aria-label="Show or hide password"><i className={`bi bi-eye${showPassword ? '-slash' : ''}`} /></button>
          </div>
        </div>
        <div className="text-end mb-4"><Link to="/forgot-password" className="auth-link small fw-semibold">Forgot password?</Link></div>

        <button
          type="submit"
          className="auth-primary-button w-100 mb-3"
          disabled={loading}
        >
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
              Authenticating...
            </>
          ) : (
            <>
              <i className="bi bi-box-arrow-in-right fs-5"></i>
              Sign in <i className="bi bi-arrow-right" />
            </>
          )}
        </button>
      </form>

      <div className="auth-register-prompt text-center mt-4">
        <span className="text-muted small">Don't have an account yet? </span>
        <Link to="/register" className="text-evsu-primary fw-semibold small text-decoration-none">
          Create an account <i className="bi bi-arrow-up-right" />
        </Link>
      </div>
      <div className="text-center mt-2"><Link to="/" className="text-muted small text-decoration-none"><i className="bi bi-arrow-left me-1"/>Back to home</Link></div>
    </div>
  );
};

export default Login;
