import React, { useCallback, useEffect, useState } from "react";
import engagementService from "../services/engagementService";
import "../styles/operations-polish.css";

const NotificationsView = () => {
  const [items, setItems] = useState([]);

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

  const priorityFor = item => {
    const text=`${item.title||''} ${item.message||''}`.toLowerCase();
    if (/today|venue change|schedule change|rescheduled|rejected|mismatch/.test(text)) return 'critical';
    if (/payment|eligibility|assignment|action required/.test(text)) return 'action';
    return 'info';
  };
  return (
    <div className="container-fluid p-0 ops-page notifications-page">
      <div className="ops-page-head">
        <div>
          <span className="ops-eyebrow">FULLCOURT INBOX</span><h3 className="fw-bold mb-1">
            <i className="bi bi-bell-fill text-evsu-primary me-2" />
            Notifications
          </h3>
          <p className="text-muted small mb-0">
            Schedule changes, eligibility, payments, assignments, results, and awards
          </p>
        </div>
        <button
          className="btn btn-outline-secondary btn-sm"
          onClick={markAllRead}
        >
          Mark all read
        </button>
      </div>
      <div className="card-custom overflow-hidden notification-stream">
        {items.length === 0 ? (
          <div className="ops-empty"><i className="bi bi-bell"/><strong>You’re all caught up</strong><p>Schedules, invitations, results, and awards will appear here.</p>
          </div>
        ) : (
          items.map((item) => {
            const priority=priorityFor(item);
            return (
            <div
              key={item.id}
              className={`notification-priority-row priority-${priority} ${item.read_at ? "is-read" : "is-unread"}`}
            >
              <i
                className={`bi ${item.read_at ? "bi-bell" : "bi-bell-fill"} text-evsu-primary fs-4`}
              />
              <div className="flex-grow-1">
                <span className={`notification-priority-label priority-${priority}`}>{priority==='critical'?'Urgent':priority==='action'?'Action required':'Update'}</span>
                <div className="fw-bold mt-1">{item.title}</div>
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
                  {priority==='critical'?'Acknowledge':'Mark read'}
                </button>
              )}
            </div>
          )})
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
