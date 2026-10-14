import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import engagementService from "../services/engagementService";
import "../styles/operations-polish.css";

const NotificationsView = () => {
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");

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
  const unreadCount=items.filter(item=>!item.read_at).length;
  const visible=useMemo(()=>items.filter(item=>{
    const priority=priorityFor(item);
    return filter==='all'||filter==='unread'&&!item.read_at||filter===priority;
  }),[items,filter]);
  const todayKey=new Date().toDateString();
  const groups=[
    ['Today',visible.filter(item=>new Date(item.created_at).toDateString()===todayKey)],
    ['Earlier',visible.filter(item=>new Date(item.created_at).toDateString()!==todayKey)],
  ].filter(([,rows])=>rows.length);
  return (
    <div className="container-fluid p-0 ops-page notifications-page">
      <div className="ops-page-head">
        <div>
          <span className="ops-eyebrow">FULLCOURT INBOX · {unreadCount} UNREAD</span><h3 className="fw-bold mb-1">
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
          disabled={!unreadCount}
        >
          Mark all read
        </button>
      </div>
      <nav className="notification-filters" aria-label="Filter notifications">
        {[['all','All',items.length],['unread','Unread',unreadCount],['critical','Urgent',items.filter(item=>priorityFor(item)==='critical').length],['action','Action required',items.filter(item=>priorityFor(item)==='action').length]].map(([value,label,count])=><button type="button" className={filter===value?'active':''} aria-pressed={filter===value} onClick={()=>setFilter(value)} key={value}>{label}<b>{count}</b></button>)}
      </nav>
      <div className="card-custom overflow-hidden notification-stream">
        {visible.length === 0 ? (
          <div className="ops-empty"><i className="bi bi-bell"/><strong>{items.length?'No notifications in this filter':'You’re all caught up'}</strong><p>{items.length?'Choose another filter to see the rest of your FullCourt inbox.':'Schedules, invitations, results, and awards will appear here.'}</p>
          </div>
        ) : (
          groups.map(([group,rows])=><section className="notification-group" key={group}><header><span>{group}</span><b>{rows.length}</b></header>{rows.map((item) => {
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
              <div className="notification-row-actions">{item.action_url&&String(item.action_url).startsWith('/')&&<Link to={item.action_url} onClick={()=>!item.read_at&&markRead(item.id)}>Open <i className="bi bi-arrow-up-right"/></Link>}{!item.read_at&&<button className="btn btn-sm btn-link" onClick={() => markRead(item.id)}>{priority==='critical'?'Acknowledge':'Mark read'}</button>}</div>
            </div>
          )})}</section>)
        )}
      </div>
    </div>
  );
};

export default NotificationsView;
