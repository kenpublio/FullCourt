import React, { useCallback, useEffect, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import eligibilityService from "../services/eligibilityService";
import LoadingSpinner from "../components/LoadingSpinner";
import sportsApplicationService from "../services/sportsApplicationService";
import engagementService from "../services/engagementService";
import "../styles/operations-polish.css";

const NotificationsView = () => {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(user?.role === "player");
  const [message, setMessage] = useState("");
  const [coachApplications, setCoachApplications] = useState([]);
  const [applicationUpdates, setApplicationUpdates] = useState([]);

  const loadNotifications = useCallback(
    async () => setItems(await engagementService.notifications()),
    [],
  );
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const markRead = async (id) => {
    await engagementService.read(id);
    await loadNotifications();
  };
  const markAllRead = async () => {
    await engagementService.readAll();
    await loadNotifications();
  };

  const loadInvitations = useCallback(async () => {
    if (user?.role !== "player") return setLoading(false);
    try {
      setInvitations(await eligibilityService.getMyInvitations());
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  const loadCoachApplications = useCallback(async () => {
    if (user?.role === "coach_manager")
      setCoachApplications(
        await sportsApplicationService.getCoachApplications(),
      );
  }, [user?.role]);
  useEffect(() => {
    loadCoachApplications();
  }, [loadCoachApplications]);

  const loadApplicationUpdates = useCallback(async () => {
    if (user?.role === "player")
      setApplicationUpdates(await sportsApplicationService.getMyUpdates());
  }, [user?.role]);
  useEffect(() => {
    loadApplicationUpdates();
  }, [loadApplicationUpdates]);

  const respond = async (id, action) => {
    try {
      const response = await eligibilityService.respondToInvitation(id, action);
      setMessage(response.message);
      await loadInvitations();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Unable to respond to the invitation.",
      );
    }
  };

  const reviewApplication = async (id, decision) => {
    try {
      const response = await sportsApplicationService.respond(id, decision);
      setMessage(response.message);
      await loadCoachApplications();
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Unable to review the application.",
      );
    }
  };

  if (loading) return <LoadingSpinner message="Loading team invitations..." />;
  return (
    <div className="container-fluid p-0 ops-page notifications-page">
      <div className="ops-page-head">
        <div>
          <span className="ops-eyebrow">FULLCOURT INBOX</span><h3 className="fw-bold mb-1">
            <i className="bi bi-bell-fill text-evsu-primary me-2" />
            Notifications
          </h3>
          <p className="text-muted small mb-0">
            Basketball invitations, approvals, assignments, schedules, results,
            and awards
          </p>
        </div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={markAllRead}
        >
          Mark all read
        </button>
      </div>
      {message && <div className="alert alert-info">{message}</div>}
      {applicationUpdates.length > 0 && (
        <div className="card-custom overflow-hidden mb-4">
          <div className="p-3 bg-evsu-primary text-white fw-bold">
            <i className="bi bi-megaphone-fill me-2" />
            Application Updates
          </div>
          {applicationUpdates.map((update) => (
            <div
              key={update.id}
              className={`p-4 border-bottom d-flex gap-3 ${update.eligibility_status === "verified" ? "notification-approved" : "notification-rejected"}`}
            >
              <div className="notification-team-icon">
                <i
                  className={`bi ${update.eligibility_status === "verified" ? "bi-check-circle-fill" : "bi-x-circle-fill"}`}
                />
              </div>
              <div>
                <div className="fw-bold">
                  {update.eligibility_status === "verified"
                    ? `You were accepted into ${update.team_name}`
                    : `Your application to ${update.team_name} was not approved`}
                </div>
                <div className="text-muted small">
                  {update.sport_name} · {update.tournament_name} · Coach{" "}
                  {update.coach_name}
                </div>
                <small className="text-secondary">
                  {update.eligibility_status === "verified"
                    ? "Your team and tournament are now connected to your dashboard."
                    : update.remarks ||
                      "You may apply to another available sport."}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
      {coachApplications.length > 0 && (
        <div className="card-custom overflow-hidden mb-4">
          <div className="p-3 bg-evsu-primary text-white fw-bold">
            <i className="bi bi-clipboard2-check-fill me-2" />
            Player Applications
          </div>
          {coachApplications.map((app) => (
            <div
              key={app.id}
              className="p-4 border-bottom d-flex flex-column flex-md-row gap-3 align-items-md-center"
            >
              <div className="notification-team-icon">
                <i className="bi bi-person-running" />
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold">
                  {app.full_name} applied for {app.sport_name}
                </div>
                <div className="text-muted small">
                  {app.team_name} · {app.email || "Mobile-account player"}
                </div>
                <small className="text-secondary">
                  {app.approved_players}/{app.max_players_per_team} approved
                  player slots used
                </small>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => reviewApplication(app.id, "approve")}
                >
                  <i className="bi bi-check-lg me-1" />
                  Approve
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => reviewApplication(app.id, "reject")}
                >
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {invitations.length > 0 && (
        <div className="card-custom overflow-hidden mb-4">
          <div className="p-3 bg-evsu-primary text-white fw-bold">
            <i className="bi bi-person-plus-fill me-2" />
            Team Invitations
          </div>
          {invitations.map((invite) => (
            <div
              key={invite.id}
              className="p-4 border-bottom d-flex flex-column flex-md-row gap-3 align-items-md-center"
            >
              <div className="notification-team-icon">
                <i className="bi bi-people-fill" />
              </div>
              <div className="flex-grow-1">
                <div className="fw-bold">
                  {invite.coach_name} invited you to {invite.team_name}
                </div>
                <div className="text-muted small">
                  {invite.sport_name} · {invite.tournament_name}
                </div>
                <small className="text-secondary">
                  Accept to join the roster and unlock your team dashboard.
                </small>
              </div>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-success btn-sm"
                  onClick={() => respond(invite.id, "accept")}
                >
                  <i className="bi bi-check-lg me-1" />
                  Accept
                </button>
                <button
                  className="btn btn-outline-danger btn-sm"
                  onClick={() => respond(invite.id, "decline")}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="card-custom overflow-hidden notification-stream">
        {items.length === 0 ? (
          <div className="ops-empty"><i className="bi bi-bell"/><strong>You’re all caught up</strong><p>Schedules, invitations, results, and awards will appear here.</p>
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className={`p-4 border-bottom d-flex gap-3 ${item.read_at ? "" : "bg-warning bg-opacity-10"}`}
            >
              <i
                className={`bi ${item.read_at ? "bi-bell" : "bi-bell-fill"} text-evsu-primary fs-4`}
              />
              <div className="flex-grow-1">
                <div className="fw-bold">{item.title}</div>
                <div className="text-muted small">{item.message}</div>
                <small className="text-secondary">
                  {new Date(item.created_at).toLocaleString()}
                </small>
              </div>
              {!item.read_at && (
                <button
                  className="btn btn-sm btn-link"
                  onClick={() => markRead(item.id)}
                >
                  Mark read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
