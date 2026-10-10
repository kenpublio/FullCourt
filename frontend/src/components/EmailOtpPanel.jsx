import { useEffect, useMemo, useRef } from 'react';
import '../styles/email-otp.css';

const maskEmail = (email = '') => {
  const [name = '', domain = ''] = email.trim().split('@');
  if (!domain) return email;
  const visible = name.slice(0, Math.min(3, Math.max(1, name.length - 1)));
  return `${visible}${'*'.repeat(Math.max(3, name.length - visible.length))}@${domain}`;
};

const EmailOtpPanel = ({
  email,
  value,
  onChange,
  seconds,
  onResend,
  onBack,
  onVerify,
  loading = false,
  verified = false,
}) => {
  const refs = useRef([]);
  const digits = useMemo(() => Array.from({ length: 6 }, (_, index) => value[index] || ''), [value]);
  const expired = seconds <= 0;
  const timer = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  useEffect(() => {
    if (!verified) refs.current[Math.min(value.length, 5)]?.focus();
  }, [verified, value.length]);

  const updateDigit = (index, nextValue) => {
    const digit = nextValue.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange(next.join(''));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  const handleKeyDown = (event, index) => {
    if (event.key === 'Enter' && value.length === 6 && !loading && !expired) {
      event.preventDefault();
      onVerify();
      return;
    }
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = '';
      onChange(next.join(''));
      refs.current[index - 1]?.focus();
    }
    if (event.key === 'ArrowLeft' && index > 0) refs.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < 5) refs.current[index + 1]?.focus();
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    onChange(pasted);
    refs.current[Math.min(pasted.length, 6) - 1]?.focus();
  };

  if (verified) {
    return <section className="fc-otp-card fc-otp-verified" aria-live="polite">
      <div className="fc-otp-success-mark"><i className="bi bi-check-lg" /></div>
      <span className="fc-otp-kicker">EMAIL CONFIRMED</span>
      <h2>Verified</h2>
      <p>Securing your FullCourt session…</p>
    </section>;
  }

  return <section className="fc-otp-card">
    <div className="fc-otp-heading">
      <span className="fc-otp-icon"><i className="bi bi-envelope-check-fill" /></span>
      <span className="fc-otp-kicker">FULLCOURT EMAIL CHECK</span>
      <h2>Enter your code</h2>
      <p>We sent a 6-digit verification code to <strong>{maskEmail(email)}</strong>.</p>
    </div>

    <div className="fc-otp-deck" role="group" aria-label="6-digit email verification code" onPaste={handlePaste}>
      {digits.map((digit, index) => <input
        key={index}
        ref={(element) => { refs.current[index] = element; }}
        type="text"
        inputMode="numeric"
        autoComplete={index === 0 ? 'one-time-code' : 'off'}
        maxLength="1"
        value={digit}
        aria-label={`Verification digit ${index + 1}`}
        disabled={loading || expired}
        onChange={(event) => updateDigit(index, event.target.value)}
        onKeyDown={(event) => handleKeyDown(event, index)}
      />)}
    </div>

    <div className={`fc-otp-timer ${expired ? 'expired' : ''}`} aria-live="polite">
      <i className={`bi bi-${expired ? 'exclamation-circle' : 'clock-history'}`} />
      {expired ? 'Code expired' : `Expires in ${timer}`}
    </div>

    <button type="button" className="btn btn-neon fc-otp-submit" onClick={onVerify} disabled={loading || expired || value.length !== 6}>
      {loading ? <><span className="spinner-border spinner-border-sm" /> Checking code…</> : <>Verify email <i className="bi bi-arrow-right" /></>}
    </button>

    <div className="fc-otp-resend">
      <span>Didn't receive the email?</span>
      <button type="button" onClick={onResend} disabled={loading || !expired}>
        {expired ? 'Resend code' : `Resend in ${timer}`}
      </button>
    </div>

    <button type="button" className="fc-otp-back" onClick={onBack} disabled={loading}>
      <span><i className="bi bi-envelope-fill" /></span><b>Change email address</b><i className="bi bi-pencil-square" />
    </button>
  </section>;
};

export default EmailOtpPanel;
