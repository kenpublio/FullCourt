import React, { useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import authService from "../services/authService";
import platformSettingsService from "../services/platformSettingsService";
import '../styles/settings-center.css';

const defaults = {
  gameReminders: true,
  scheduleChanges: true,
  teamInvitations: true,
  scoreUpdates: true,
  announcements: true,
  reminderTime: "30",
  appearance: "system",
  publicProfile: false,
  publicStats: true,
  playerApplications: true,
};
const Toggle = ({ id, label, description, checked, onChange }) => (
  <div className="d-flex justify-content-between align-items-center gap-3 py-3 border-bottom">
    <label htmlFor={id} className="mb-0">
      <span className="d-block fw-semibold">{label}</span>
      <small className="text-muted">{description}</small>
    </label>
    <div className="form-check form-switch m-0">
      <input
        id={id}
        className="form-check-input"
        type="checkbox"
        checked={checked}
        onChange={onChange}
      />
    </div>
  </div>
);

const SettingsView = () => {
  const { user } = useAuth();
  const isAdmin=['platform_admin','admin'].includes(user?.role);
  const storageKey = `fullcourt_settings_${user?.id || "guest"}`;
  const [settings, setSettings] = useState(defaults),
    [saved, setSaved] = useState(false);
  const [showPassword, setShowPassword] = useState(false),
    [passwords, setPasswords] = useState({
      current: "",
      next: "",
      confirm: "",
    }),
    [passwordMessage, setPasswordMessage] = useState(""),
    [passwordError, setPasswordError] = useState("");
  const [platformSettings,setPlatformSettings]=useState({maintenance_enabled:false,maintenance_message:'FullCourt is being improved. Some features may be temporarily unavailable.',registration_enabled:true});
  const [platformSaving,setPlatformSaving]=useState(false),[platformMessage,setPlatformMessage]=useState('');
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey));
      if (stored) setSettings({ ...defaults, ...stored });
    } catch {
      setSettings(defaults);
    }
  }, [storageKey]);
  useEffect(()=>{if(isAdmin)platformSettingsService.get().then(data=>data&&setPlatformSettings(data)).catch(()=>{});},[isAdmin]);
  useEffect(()=>{const dark=settings.appearance==='dark'||(settings.appearance==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);const resolvedTheme=dark?'dark':'light';document.documentElement.dataset.fullcourtTheme=resolvedTheme;document.documentElement.dataset.bsTheme=resolvedTheme;},[settings.appearance]);
  const toggle = (key) =>
    setSettings((value) => ({ ...value, [key]: !value[key] }));
  const save = () => {
    localStorage.setItem(storageKey, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };
  const isPlayer = user?.role === "player",
    isCoach = ["coach", "coach_manager"].includes(user?.role);
  const savePlatform=async()=>{setPlatformSaving(true);setPlatformMessage('');try{const data=await platformSettingsService.update(platformSettings);setPlatformSettings(data);setPlatformMessage('Platform operations settings saved.');window.dispatchEvent(new CustomEvent('fullcourt-platform-settings',{detail:data}));}catch(error){setPlatformMessage(error.response?.data?.message||'Unable to save platform operations settings.');}finally{setPlatformSaving(false);}};
  const changePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordMessage("");
    if (passwords.next !== passwords.confirm)
      return setPasswordError("New passwords do not match.");
    try {
      const response = await authService.changePassword({
        current_password: passwords.current,
        new_password: passwords.next,
      });
      setPasswordMessage(response.message);
      setPasswords({ current: "", next: "", confirm: "" });
      setShowPassword(false);
    } catch (error) {
      setPasswordError(
        error.response?.data?.message || "Unable to change password.",
      );
    }
  };
  return (
    <div className="container-fluid p-0 page-enter settings-center">
      <header className="settings-hero"><div><span>ACCOUNT CONTROL CENTER</span><h3>Settings</h3><p>Control your FullCourt alerts, reminders, privacy, and account preferences.</p></div><i className="bi bi-sliders2"/></header>
      {saved && (
        <div className="alert alert-success d-flex align-items-center gap-2">
          <i className="bi bi-check-circle-fill" />
          Settings saved successfully.
        </div>
      )}
      <div className="row g-4">
        {isAdmin&&<div className="col-12"><section className="settings-platform-panel"><header><div><span>PLATFORM OPERATIONS</span><h5>Maintenance &amp; Access Control</h5><p>Manage temporary service notices and new account access across FullCourt.</p></div><i className="bi bi-tools"/></header><div className="settings-platform-grid"><Toggle id="maintenanceMode" label="Maintenance notice" description="Show a system-wide maintenance banner while updates are in progress." checked={Boolean(platformSettings.maintenance_enabled)} onChange={()=>setPlatformSettings(value=>({...value,maintenance_enabled:!value.maintenance_enabled}))}/><Toggle id="registrationEnabled" label="Allow new registrations" description="Turn this off temporarily to prevent new accounts from being created." checked={Boolean(platformSettings.registration_enabled)} onChange={()=>setPlatformSettings(value=>({...value,registration_enabled:!value.registration_enabled}))}/><label className="settings-maintenance-message"><span>Maintenance message</span><textarea className="form-control" rows="2" maxLength="240" value={platformSettings.maintenance_message||''} onChange={event=>setPlatformSettings(value=>({...value,maintenance_message:event.target.value}))} disabled={!platformSettings.maintenance_enabled}/><small>{(platformSettings.maintenance_message||'').length}/240 characters</small></label></div><footer>{platformMessage&&<span><i className="bi bi-check-circle"/> {platformMessage}</span>}<button className="btn btn-evsu" disabled={platformSaving} onClick={savePlatform}><i className="bi bi-cloud-check"/> {platformSaving?'Saving…':'Save platform controls'}</button></footer></section></div>}
        <div className="col-lg-7">
          <section className="card-custom p-4 mb-4">
            <h5 className="fw-bold mb-1">
              <i className="bi bi-bell-fill text-warning me-2" />
              Notifications
            </h5>
            <p className="text-muted small">
              Choose the updates you want to receive.
            </p>
            <Toggle
              id="gameReminders"
              label="Game reminders"
              description="Alert me before a scheduled game."
              checked={settings.gameReminders}
              onChange={() => toggle("gameReminders")}
            />
            <Toggle
              id="scheduleChanges"
              label="Schedule changes"
              description="Notify me when a game time, venue, or court changes."
              checked={settings.scheduleChanges}
              onChange={() => toggle("scheduleChanges")}
            />
            <Toggle
              id="teamInvitations"
              label={isCoach ? "Roster responses" : "Team invitations"}
              description={
                isCoach
                  ? "Notify me when a player responds to an invitation."
                  : "Notify me when a coach invites me to a team."
              }
              checked={settings.teamInvitations}
              onChange={() => toggle("teamInvitations")}
            />
            <Toggle
              id="scoreUpdates"
              label="Score and result updates"
              description="Receive final-score and match-result notifications."
              checked={settings.scoreUpdates}
              onChange={() => toggle("scoreUpdates")}
            />
            <Toggle
              id="announcements"
              label="Tournament announcements"
              description="Receive important organizer announcements."
              checked={settings.announcements}
              onChange={() => toggle("announcements")}
            />
            <div className="mt-3">
              <label className="form-label fw-semibold">
                Game reminder time
              </label>
              <select
                className="form-select"
                value={settings.reminderTime}
                onChange={(e) =>
                  setSettings({ ...settings, reminderTime: e.target.value })
                }
                disabled={!settings.gameReminders}
              >
                <option value="15">15 minutes before</option>
                <option value="30">30 minutes before</option>
                <option value="60">1 hour before</option>
              </select>
            </div>
          </section>
          {isPlayer && (
            <section className="card-custom p-4 mb-4">
              <h5 className="fw-bold mb-1">
                <i className="bi bi-eye-fill text-primary me-2" />
                Player Privacy
              </h5>
              <p className="text-muted small">
                Control what appears on public tournament pages.
              </p>
              <Toggle
                id="publicProfile"
                label="Public player profile"
                description="Allow visitors to see my player profile."
                checked={settings.publicProfile}
                onChange={() => toggle("publicProfile")}
              />
              <Toggle
                id="publicStats"
                label="Public performance statistics"
                description="Show my tournament statistics and awards."
                checked={settings.publicStats}
                onChange={() => toggle("publicStats")}
              />
            </section>
          )}
          {isCoach && (
            <section className="card-custom p-4 mb-4">
              <h5 className="fw-bold mb-1">
                <i className="bi bi-people-fill text-success me-2" />
                Coach Preferences
              </h5>
              <Toggle
                id="playerApplications"
                label="Player application alerts"
                description="Notify me when a player applies or accepts an invitation."
                checked={settings.playerApplications}
                onChange={() => toggle("playerApplications")}
              />
            </section>
          )}
          <button
            className="btn btn-evsu rounded-pill px-4 py-2 fw-semibold shadow-sm"
            onClick={save}
          >
            <i className="bi bi-check2-circle me-2" />
            Save Settings
          </button>
        </div>
        <div className="col-lg-5">
          <section className="card-custom p-4 mb-4">
            <h5 className="fw-bold">
              <i className="bi bi-palette-fill text-evsu-primary me-2" />
              Appearance
            </h5>
            <label className="form-label small fw-semibold">Color mode</label>
            <div className="d-grid gap-2">
              {[
                ["system", "bi-laptop", "Use device setting"],
                ["light", "bi-sun-fill", "Light mode"],
                ["dark", "bi-moon-stars-fill", "Dark mode"],
              ].map(([value, icon, label]) => (
                <button
                  key={value}
                  type="button"
                  className={`btn text-start ${settings.appearance === value ? "btn-evsu" : "btn-light border"}`}
                  onClick={() =>
                    setSettings({ ...settings, appearance: value })
                  }
                >
                  <i className={`bi ${icon} me-2`} />
                  {label}
                </button>
              ))}
            </div>
            <small className="text-muted d-block mt-2">
              Your selection is saved for this account.
            </small>
          </section>
          <section className="card-custom p-4">
            <h5 className="fw-bold">
              <i className="bi bi-shield-lock-fill text-success me-2" />
              Account Security
            </h5>
            <p className="text-muted small">
              Update your password using your current password.
            </p>
            {passwordMessage && (
              <div className="alert alert-success py-2 small">
                {passwordMessage}
              </div>
            )}
            {passwordError && (
              <div className="alert alert-danger py-2 small">
                {passwordError}
              </div>
            )}
            {!showPassword ? (
              <button
                type="button"
                className="btn btn-outline-dark rounded-pill w-100"
                onClick={() => setShowPassword(true)}
              >
                <i className="bi bi-key-fill me-2" />
                Change Password
              </button>
            ) : (
              <form onSubmit={changePassword}>
                <label className="form-label small fw-semibold">
                  Current password
                </label>
                <input
                  type="password"
                  className="form-control mb-3"
                  value={passwords.current}
                  onChange={(e) =>
                    setPasswords({ ...passwords, current: e.target.value })
                  }
                  required
                />
                <label className="form-label small fw-semibold">
                  New password
                </label>
                <input
                  type="password"
                  className="form-control mb-3"
                  value={passwords.next}
                  onChange={(e) =>
                    setPasswords({ ...passwords, next: e.target.value })
                  }
                  required
                />
                <label className="form-label small fw-semibold">
                  Confirm new password
                </label>
                <input
                  type="password"
                  className="form-control mb-3"
                  value={passwords.confirm}
                  onChange={(e) =>
                    setPasswords({ ...passwords, confirm: e.target.value })
                  }
                  required
                />
                <div className="d-flex gap-2">
                    <button className="btn btn-evsu btn-sm rounded-pill px-4">
                    Update Password
                  </button>
                  <button
                    type="button"
                    className="btn btn-light border"
                    onClick={() => {
                      setShowPassword(false);
                      setPasswordError("");
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};
export default SettingsView;
