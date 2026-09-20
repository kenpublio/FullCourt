import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';

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

  const requestCode = async () => {
    setLoading(true); setError(''); setMessage('');
    try {
      const response = await authService.requestPasswordReset(email);
      const localCode = response.data?.development_code || '';
      setDevelopmentCode(localCode);
      if (localCode) setCode(localCode);
      setMessage(response.message || 'Verification code sent.');
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.message || e.message || 'Unable to send the reset code.');
    } finally { setLoading(false); }
  };

  const verifyCode = async (e) => {
    e.preventDefault(); setError(''); setMessage('');
    if (code.length !== 6) return setError('Enter the complete 6-digit code.');
    setLoading(true);
    try {
      const response = await authService.verifyPasswordResetCode(email, code);
      setMessage(response.message);
      setStep(3);
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
    <Link to="/" className="auth-back"><i className="bi bi-arrow-left" /> Home</Link>
    <div className="auth-heading"><span className="auth-icon"><i className="bi bi-key" /></span><h2>Reset your password</h2><p>{step === 1 ? 'Enter your registered email or mobile number.' : step === 2 ? 'Confirm the verification code sent to your registered contact.' : step === 3 ? 'Create your new password.' : 'Your password is ready.'}</p></div>
    {error && <div className="form-alert error"><i className="bi bi-exclamation-circle" />{error}</div>}
    {message && step < 4 && <div className="form-alert success"><i className="bi bi-check-circle" />{message}</div>}
    {step === 1 && <form onSubmit={(e) => { e.preventDefault(); requestCode(); }}><label>Email or mobile number</label><input className="modern-input" type="text" inputMode="email" placeholder="name@gmail.com or 09XXXXXXXXX" value={email} onChange={e => setEmail(e.target.value)} required /><button className="btn btn-neon w-100 mt-3" disabled={loading}>{loading ? 'Sending…' : 'Send verification code'}</button></form>}
    {step === 2 && <form onSubmit={verifyCode}>{developmentCode && <div className="form-alert success"><i className="bi bi-code-slash" /><span>Local test code: <strong>{developmentCode}</strong></span></div>}<label>6-digit code</label><input className="modern-input code-input" inputMode="numeric" maxLength="6" placeholder="000000" value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required /><button className="btn btn-neon w-100 mt-3" disabled={loading}>{loading ? 'Checking…' : 'Verify code'}</button><button type="button" className="btn btn-outline-secondary w-100 mt-2" onClick={requestCode} disabled={loading}><i className="bi bi-arrow-clockwise me-2" />{loading ? 'Sending…' : 'Resend Code'}</button></form>}
    {step === 3 && <form onSubmit={reset}><label>New password</label><input className="modern-input" type="password" placeholder="At least 8 characters" value={password} onChange={e => setPassword(e.target.value)} required /><label className="mt-3">Confirm password</label><input className="modern-input" type="password" placeholder="Enter the same password" value={confirm} onChange={e => setConfirm(e.target.value)} required /><button className="btn btn-neon w-100 mt-3" disabled={loading}>{loading ? 'Resetting…' : 'Reset password'}</button></form>}
    {step === 4 && <div className="text-center"><div className="success-check"><i className="bi bi-check-lg" /></div><p>Password changed successfully. You can now sign in using your new password.</p><Link className="btn btn-neon w-100" to="/login">Return to sign in</Link></div>}
    {step < 4 && <div className="mt-4"><Link to="/login" className="btn btn-light border w-100"><i className="bi bi-arrow-left me-2" />Back to Sign In</Link></div>}
  </div>;
};

export default ForgotPassword;
