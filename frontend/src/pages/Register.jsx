import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import authService from "../services/authService";
import EmailOtpPanel from "../components/EmailOtpPanel";

const steps = ["Profile details", "Email verification", "Security"];
const Register = () => {
  const [step, setStep] = useState(1),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [loading, setLoading] = useState(false),
    [show, setShow] = useState(false),
    [codeSeconds, setCodeSeconds] = useState(0),
    [verified, setVerified] = useState(false);
  const [form, setForm] = useState({
    playing_position: "Not Sure",
    height_cm: "",
    team_name: "",
    coaching_experience: "",
    organization_name: "",
    organization_address: "",
    role: "coach",
    first_name: "",
    middle_name: "",
    last_name: "",
    full_name: "",
    birth_date: "",
    age: "",
    address: "",
    email: "",
    department_course: "",
    year_level: "",
    phone_number: "",
    verification_code: "",
    password: "",
    confirmPassword: "",
  });
  const { register } = useAuth(),
    nav = useNavigate();
  const set = (event) => {
    const { name, value } = event.target;
    if (name === "birth_date") {
      const today = new Date(),
        birth = new Date(`${value}T00:00:00`);
      let age = today.getFullYear() - birth.getFullYear();
      const month = today.getMonth() - birth.getMonth();
      if (month < 0 || (month === 0 && today.getDate() < birth.getDate()))
        age--;
      setForm({
        ...form,
        birth_date: value,
        age: value && age >= 0 ? String(age) : "",
      });
      return;
    }
    setForm({ ...form, [name]: value });
  };
  const rules = useMemo(
    () => [
      { text: "At least 8 characters", ok: form.password.length >= 8 },
      { text: "One uppercase letter", ok: /[A-Z]/.test(form.password) },
      { text: "One number", ok: /\d/.test(form.password) },
      { text: "One special character", ok: /[^A-Za-z0-9]/.test(form.password) },
    ],
    [form.password],
  );
  useEffect(() => {
    if (codeSeconds <= 0) return;
    const timer = setInterval(
      () => setCodeSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => clearInterval(timer);
  }, [codeSeconds]);
  const requestCode = async () => {
    setError("");
    if (
      form.coaching_experience !== "" &&
      (!/^\d+$/.test(form.coaching_experience) ||
        Number(form.coaching_experience) > Number(form.age))
    )
      return setError(
        "Coaching experience must be a whole number between 0 and your age.",
      );
    if (
      !form.first_name.trim() ||
      !form.last_name.trim() ||
      !form.birth_date ||
      !form.address ||
      !form.email
    )
      return setError(
        "First name, last name, date of birth, email address, and complete address are required.",
      );
    if (!form.age || Number(form.age) < 1 || Number(form.age) > 120)
      return setError("Enter a valid date of birth.");
    const contact = form.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(contact))
      return setError(
        "Enter a valid email address to receive your verification code.",
      );
    const phone = form.phone_number.replace(/[\s-]/g, "");
    if (phone && !/^(09\d{9}|\+639\d{9})$/.test(phone))
      return setError(
        "Enter a valid Philippine mobile number or leave it blank.",
      );
    setLoading(true);
    try {
      const response = await authService.requestEmailCode(contact, phone);
      setForm((current) => ({
        ...current,
        full_name: [current.first_name, current.middle_name, current.last_name]
          .map((value) => value.trim())
          .filter(Boolean)
          .join(" "),
        phone_number: phone,
      }));
      setMessage(
        response.message +
          (response.data?.development_code
            ? ` Development code: ${response.data.development_code}`
            : ""),
      );
      setCodeSeconds(180);
      setVerified(false);
      setStep(2);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };
  const resend = async () => {
    if (codeSeconds > 0) return;
    setMessage("");
    await requestCode();
  };
  const verify = async () => {
    setError("");
    if (form.verification_code.length !== 6)
      return setError("Enter the complete 6-digit code.");
    setLoading(true);
    try {
      const response = await authService.verifyRegistrationCode(
        form.email,
        form.verification_code,
      );
      setMessage(response.message);
      setVerified(true);
      window.setTimeout(() => setStep(3), 700);
    } catch (e) {
      setError(e.response?.data?.message || "The code is invalid or expired.");
    } finally {
      setLoading(false);
    }
  };
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    if (!rules.every((rule) => rule.ok))
      return setError("Please meet all password requirements.");
    if (form.password !== form.confirmPassword)
      return setError("Passwords do not match.");
    setLoading(true);
    try {
      await register(form);
      setStep(4);
      setTimeout(() => nav("/login"), 1800);
    } catch (e) {
      setError(e.response?.data?.message || e.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="register-wrap">
      <Link to="/login" className="register-login-return">
        <span>
          <i className="bi bi-box-arrow-in-left" />
        </span>
        <b>Return to sign in</b>
        <i className="bi bi-arrow-up-right" />
      </Link>
      <div className="auth-page-heading register-heading mb-4">
        <span className="auth-page-icon">
          <i className="bi bi-person-plus-fill" />
        </span>
        <span className="auth-page-kicker">Coaching staff registration</span>
        <h1 className="auth-form-title">Join your team.</h1>
        <p>
          Create a Coach account to lead a roster, or an Assistant Coach account
          to support an assigned team.
        </p>
      </div>
      {step <= 3 && (
        <div className="stepper">
          {steps.map((label, index) => (
            <div
              className={`step ${index + 1 < step ? "done" : ""} ${index + 1 === step ? "active" : ""}`}
              key={label}
            >
              <span>
                {index + 1 < step ? (
                  <i className="bi bi-check-lg" />
                ) : (
                  index + 1
                )}
              </span>
              <small>{label}</small>
            </div>
          ))}
        </div>
      )}
      {error && (
        <div className="form-alert error" role="alert">
          <i className="bi bi-exclamation-circle" />
          {error}
        </div>
      )}
      {message && step === 2 && (
        <div className="form-alert success">
          <i className="bi bi-envelope-check" />
          {message}
        </div>
      )}
      <h2 className="visually-hidden">Coach account registration</h2>
      <h3 className="visually-hidden">Registration step {step}</h3>
      {step === 1 && (
        <section className="form-step">
          <div className="register-profile-intro">
            <span>
              <i className="bi bi-clipboard2-pulse-fill" />
            </span>
            <div>
              <small>
                {form.role === "assistant_coach" ? "ASSISTANT COACH" : "COACH"}{" "}
                ACCOUNT
              </small>
              <h4>Your profile</h4>
              <p>
                Use accurate details for tournament invitations and roster
                communication.
              </p>
            </div>
          </div>
          <fieldset className="register-role-picker">
            <legend>Account type</legend>
            <button
              type="button"
              className={form.role === "coach" ? "active" : ""}
              onClick={() =>
                setForm((current) => ({ ...current, role: "coach" }))
              }
            >
              <span>
                <i className="bi bi-person-badge-fill" />
              </span>
              <div>
                <b>Coach</b>
                <small>Register a team and manage its roster</small>
              </div>
              <i
                className={`bi bi-${form.role === "coach" ? "check-circle-fill" : "circle"}`}
              />
            </button>
            <button
              type="button"
              className={form.role === "assistant_coach" ? "active" : ""}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  role: "assistant_coach",
                  team_name: "",
                }))
              }
            >
              <span>
                <i className="bi bi-people-fill" />
              </span>
              <div>
                <b>Assistant Coach</b>
                <small>Support a team after Admin assignment</small>
              </div>
              <i
                className={`bi bi-${form.role === "assistant_coach" ? "check-circle-fill" : "circle"}`}
              />
            </button>
          </fieldset>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="register-last-name">Last Name</label>
              <input
                id="register-last-name"
                className="modern-input"
                name="last_name"
                autoComplete="family-name"
                placeholder="Dela Cruz"
                value={form.last_name}
                onChange={set}
              />
            </div>
            <div className="field">
              <label htmlFor="register-first-name">First Name</label>
              <input
                id="register-first-name"
                className="modern-input"
                name="first_name"
                autoComplete="given-name"
                placeholder="Juan"
                value={form.first_name}
                onChange={set}
              />
            </div>
            <div className="field full">
              <label htmlFor="register-middle-name">
                Middle Name <span className="text-muted">(optional)</span>
              </label>
              <input
                id="register-middle-name"
                className="modern-input"
                name="middle_name"
                autoComplete="additional-name"
                placeholder="Santos"
                value={form.middle_name}
                onChange={set}
              />
            </div>
            <div className="field">
              <label htmlFor="register-birth-date">Date of Birth</label>
              <input
                id="register-birth-date"
                className="modern-input"
                name="birth_date"
                type="date"
                max={new Date().toISOString().split("T")[0]}
                value={form.birth_date}
                onChange={set}
              />
            </div>
            <div className="field">
              <label htmlFor="register-age">Age</label>
              <input
                id="register-age"
                className="modern-input"
                name="age"
                type="number"
                value={form.age}
                readOnly
                aria-readonly="true"
              />
            </div>
            <div className="field full">
              <label htmlFor="register-email">Email Address</label>
              <input
                id="register-email"
                className="modern-input"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="name@gmail.com"
                value={form.email}
                onChange={set}
              />
              <small className="text-muted">
                Email and mobile duplicates are checked before a verification
                code is sent.
              </small>
            </div>
            <div className="field full">
              <label>Complete Address</label>
              <textarea
                className="modern-input registration-address compact-address-field"
                name="address"
                rows="1"
                placeholder="Enter your complete address"
                value={form.address}
                onChange={set}
              />
            </div>
            {form.role === "player" && (
              <>
                <div className="field">
                  <label htmlFor="playing-position">Playing Position</label>
                  <select
                    id="playing-position"
                    className="modern-input"
                    name="playing_position"
                    value={form.playing_position}
                    onChange={set}
                  >
                    {[
                      "Not Sure",
                      "Point Guard",
                      "Shooting Guard",
                      "Small Forward",
                      "Power Forward",
                      "Center",
                    ].map((position) => (
                      <option key={position}>{position}</option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="player-height">Height (cm, optional)</label>
                  <input
                    id="player-height"
                    className="modern-input"
                    type="number"
                    min="1"
                    max="300"
                    step="0.01"
                    name="height_cm"
                    placeholder="e.g. 175"
                    value={form.height_cm}
                    onChange={set}
                  />
                </div>
              </>
            )}
            {form.role === "coach" && (
              <>
                <div className="field">
                  <label htmlFor="coach-team">Team Name (optional)</label>
                  <input
                    id="coach-team"
                    className="modern-input"
                    name="team_name"
                    maxLength="150"
                    value={form.team_name}
                    onChange={set}
                  />
                  <small className="text-muted">
                    You can create or join a team after signing in.
                  </small>
                </div>
                <div className="field">
                  <label htmlFor="coach-experience">
                    Coaching Experience (years, optional)
                  </label>
                  <input
                    id="coach-experience"
                    className="modern-input"
                    name="coaching_experience"
                    type="number"
                    min="0"
                    max={form.age || 120}
                    step="1"
                    placeholder="0 for beginners"
                    value={form.coaching_experience}
                    onChange={set}
                  />
                </div>
              </>
            )}
            {form.role === "assistant_coach" && (
              <div className="field full">
                <div className="assistant-assignment-note">
                  <i className="bi bi-shield-check" />
                  <span>
                    <b>Assigned-team access</b>
                    <small>
                      After registration, an Admin assigns you to a team. Your
                      dashboard will show only that team, its schedule,
                      standings, and reports.
                    </small>
                  </span>
                </div>
              </div>
            )}
            {form.role === "organization_admin" && (
              <>
                <div className="field full">
                  <label htmlFor="org-name">Organization Name</label>
                  <input
                    id="org-name"
                    className="modern-input"
                    name="organization_name"
                    maxLength="150"
                    value={form.organization_name}
                    onChange={set}
                  />
                </div>
                <div className="field full">
                  <label htmlFor="org-address">Organization Address</label>
                  <textarea
                    id="org-address"
                    className="modern-input"
                    name="organization_address"
                    rows="2"
                    maxLength="1000"
                    value={form.organization_address}
                    onChange={set}
                  />
                </div>
                <div className="field full">
                  <small className="text-muted">
                    Your organization requires admin approval before you can
                    manage competitions.
                  </small>
                </div>
              </>
            )}
            <div className="field full">
              <label htmlFor="register-phone">
                Mobile Number <span className="text-muted">(optional)</span>
              </label>
              <input
                id="register-phone"
                className="modern-input"
                name="phone_number"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="09XXXXXXXXX"
                value={form.phone_number}
                onChange={set}
              />
              <small className="text-muted">
                Contact information only. Verification codes are sent by email.
              </small>
            </div>
          </div>
          <div className="step-actions register-profile-actions">
            <span>
              <i className="bi bi-shield-check" />{" "}
              {form.role === "assistant_coach"
                ? "Assistant Coach registration"
                : "Coach registration"}
            </span>
            <button
              className="btn btn-neon"
              onClick={requestCode}
              disabled={loading}
            >
              {loading ? "Sending code…" : "Send verification code"}
            </button>
          </div>
        </section>
      )}
      {step === 2 && (
        <EmailOtpPanel
          email={form.email}
          value={form.verification_code}
          onChange={(value) => setForm({ ...form, verification_code: value })}
          seconds={codeSeconds}
          onResend={resend}
          onBack={() => {
            setStep(1);
            setForm({ ...form, verification_code: "" });
            setMessage("");
            setError("");
          }}
          onVerify={verify}
          loading={loading}
          verified={verified}
        />
      )}
      {step === 3 && (
        <form className="form-step" onSubmit={submit}>
          <h4>Secure your account</h4>
          <div className="password-field">
            <input
              className="modern-input"
              name="password"
              type={show ? "text" : "password"}
              placeholder="Create a password"
              value={form.password}
              onChange={set}
            />
            <button type="button" onClick={() => setShow(!show)}>
              <i className={`bi bi-eye${show ? "-slash" : ""}`} />
            </button>
          </div>
          <div className="password-rules">
            {rules.map((rule) => (
              <span className={rule.ok ? "ok" : ""} key={rule.text}>
                <i
                  className={`bi bi-${rule.ok ? "check-circle-fill" : "circle"}`}
                />
                {rule.text}
              </span>
            ))}
          </div>
          <label>Confirm password</label>
          <input
            className="modern-input"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={set}
          />
          <div className="step-actions">
            <button
              type="button"
              className="btn btn-soft register-back-button"
              onClick={() => setStep(2)}
            >
              <i className="bi bi-arrow-left" /> Back
            </button>
            <button className="btn btn-neon" disabled={loading}>
              {loading ? "Creating…" : "Create account"}
            </button>
          </div>
        </form>
      )}
      {step === 4 && (
        <section className="form-step text-center">
          <div className="success-check">
            <i className="bi bi-check-lg" />
          </div>
          <h3>Welcome to FullCourt!</h3>
          <p>
            Your {form.role === "assistant_coach" ? "Assistant Coach" : "Coach"}{" "}
            account is ready. Redirecting you to sign in…
          </p>
        </section>
      )}
      <div className="register-member-prompt">
        <span>
          <i className="bi bi-person-check-fill" />
        </span>
        <div>
          <small>ALREADY A MEMBER?</small>
          <b>Continue with your FullCourt account</b>
        </div>
        <Link to="/login">
          Sign in <i className="bi bi-arrow-right" />
        </Link>
      </div>
    </div>
  );
};
export default Register;
