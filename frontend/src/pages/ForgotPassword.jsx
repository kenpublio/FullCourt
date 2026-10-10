import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import EmailOtpPanel from '../components/EmailOtpPanel';

const ForgotPassword = () => {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [developmentCode, setDevelopmentCode] = useState('');
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    if (codeSeconds <= 0) return undefined;
    const timer = window.setInterval(() => setCodeSeconds(value => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [codeSeconds]);

  const requestCode = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await authService.requestPasswordReset(email);
      const localCode = response.data?.development_code || '';
      setDevelopmentCode(localCode);
      if (localCode) setCode(localCode);
      setMessage(response.message || 'Verification code sent.');
      setCodeSeconds(180);
      setVerified(false);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Unable to send the reset code.');
    } finally { setLoading(false); }
  };

  const verifyCode = async () => {
    setError(''); setMessage('');
    if (code.length !== 6) return setError('Enter the complete 6-digit code.');
    setLoading(true);
    try {
      const response = await authService.verifyPasswordResetCode(email, code);
      setMessage(response.message);
      setVerified(true);
      window.setTimeout(() => setStep(3), 700);
    } catch (e) {
      setError(e.response?.data?.message || 'The reset code is invalid or expired.');
    } finally { setLoading(false); }
  };

  const reset = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (password.length < 8 || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[\W_]/.test(password)) return setError('Use at least 8 characters with an uppercase letter, number, and special character.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const response = await authService.resetPassword({ email, code, password });
      setMessage(response.message || 'Password reset successfully.');
      setDevelopmentCode(''); setStep(4);
    } catch (e) {
      setError(e.response?.data?.message || 'Unable to reset the password.');
    } finally { setLoading(false); }
  };

  return <div className="auth-form">
    <Link to="/" className="auth-back forgot-home-link"><span><i className="bi bi-house-door-fill" /></span><b>FullCourt home</b><i className="bi bi-arrow-up-right" /></Link>
    <div className="auth-heading"><span className="auth-icon"><i className="bi bi-key" /></span><h1 className="auth-form-title">Reset your password</h1><p>{step === 1 ? 'Enter your registered email address.' : step === 2 ? 'Confirm the verification code sent to your email.' : step === 3 ? 'Create your new password.' : 'Your password is ready.'}</p></div>
    {error && <div className="form-alert error"><i className="bi bi-exclamation-circle" />{error}</div>}
    {message && step < 4 && <div className="form-alert success"><i className="bi bi-check-circle" />{message}</div>}
    {step === 1 && <form className="forgot-email-form" onSubmit={(e) => { e.preventDefault(); requestCode(); }}><label className="forgot-email-field" htmlFor="reset-email"><span>Email address</span><div><i className="bi bi-envelope"/><input id="reset-email" className="modern-input" type="email" inputMode="email" autoComplete="email" placeholder="name@gmail.com" value={email} onChange={e => setEmail(e.target.value)} required /></div><small>We'll send a secure 6-digit reset code to this email.</small></label><button className="btn btn-neon w-100" disabled={loading}>{loading ? 'Sending…' : <><i className="bi bi-send-fill me-2"/>Send verification code</>}</button></form>}
    {step === 2 && <>{developmentCode && <div className="form-alert success"><i className="bi bi-code-slash" /><span>Local test code: <strong>{developmentCode}</strong></span></div>}<EmailOtpPanel email={email} value={code} onChange={setCode} seconds={codeSeconds} onResend={requestCode} onBack={() => { setStep(1); setCode(''); setMessage(''); setError(''); }} onVerify={verifyCode} loading={loading} verified={verified} /></>}
    {step === 3 && <form onSubmit={reset}><label>New password</label><input className="modern-input" type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required /><label className="mt-3">Confirm password</label><input className="modern-input" type="password" placeholder="Enter the same password" value={confirm} onChange={e => setConfirm(e.target.value)} required /><button className="btn btn-neon w-100 mt-3" disabled={loading}>{loading ? 'Resetting…' : 'Reset password'}</button></form>}
    {step === 4 && <div className="text-center"><div className="success-check"><i className="bi bi-check-lg" /></div><p>Password changed successfully. You can now sign in using your new password.</p><Link className="btn btn-neon w-100" to="/login">Return to sign in</Link></div>}
    {step !== 2 && step < 4 && <div className="forgot-signin-return"><span>Remembered your password?</span><Link to="/login"><i className="bi bi-arrow-left" /> Return to sign in</Link></div>}
  </div>;
};

export default ForgotPassword;
