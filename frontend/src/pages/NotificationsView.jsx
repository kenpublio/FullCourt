import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import engagementService from "../services/engagementService";
import contentService from "../services/contentService";
import tournamentService from "../services/tournamentService";
import { useAuth } from "../hooks/useAuth";
import "../styles/operations-polish.css";

const NotificationsView = () => {
  const { user } = useAuth();
  const isTeamStaff = ["coach", "assistant_coach"].includes(user?.role);
  const canPublish = ["platform_admin", "admin", "statistician"].includes(user?.role);
  const [items, setItems] = useState([]);
  const [filter, setFilter] = useState("all");
  const [announcements,setAnnouncements]=useState([]),[tournaments,setTournaments]=useState([]),[publishing,setPublishing]=useState(false),[publishNotice,setPublishNotice]=useState('');
  const [announcement,setAnnouncement]=useState({tournament_id:'',title:'',message:'',priority:'important',expires_in_hours:72});

  const loadNotifications = useCallback(
    async () => setItems(await engagementService.notifications()),
    [],
  );
  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);
  useEffect(()=>{if(!canPublish)return;Promise.all([contentService.getManagedAnnouncements(),tournamentService.getTournaments()]).then(([rows,data])=>{setAnnouncements(rows);const list=data.tournaments||[];setTournaments(list);setAnnouncement(current=>({...current,tournament_id:current.tournament_id||String(list[0]?.id||'')}));}).catch(()=>setPublishNotice('Announcement tools could not be loaded.'));},[canPublish]);

  const publishAnnouncement=async(event)=>{event.preventDefault();setPublishing(true);setPublishNotice('');try{const result=await contentService.publishAnnouncement({...announcement,tournament_id:announcement.tournament_id?Number(announcement.tournament_id):null,expires_in_hours:Number(announcement.expires_in_hours)});setPublishNotice(`Announcement published${result?.notifications_created?` · ${result.notifications_created} team staff notified`:''}.`);setAnnouncement(current=>({...current,title:'',message:''}));setAnnouncements(await contentService.getManagedAnnouncements());await loadNotifications();}catch(error){setPublishNotice(error.response?.data?.message||'Announcement could not be published.');}finally{setPublishing(false);}};

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
          <span className="ops-eyebrow">FULLCOURT INBOX · {unreadCount} UNREAD</span><h1 className="h3 fw-bold mb-1">
            <i className="bi bi-bell-fill text-evsu-primary me-2" />
            Notifications
          </h1>
          <p className="text-muted small mb-0">
            {isTeamStaff
              ? "Schedule, eligibility, payment, and result updates for your assigned team only."
              : "Schedule changes, eligibility, payments, assignments, results, and awards"}
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
      {canPublish&&<section className="card-custom p-4 mb-4 announcement-composer"><div className="d-flex flex-wrap justify-content-between gap-3 align-items-start mb-3"><div><span className="ops-eyebrow">TOURNAMENT COMMUNICATIONS</span><h2 className="h5 fw-bold mb-1">Publish an announcement</h2><p className="text-muted small mb-0">Send one clear update to the selected tournament. It also appears on the public home page until it expires.</p></div><span className="badge rounded-pill text-bg-light">{announcements.length} published</span></div><form className="row g-3" onSubmit={publishAnnouncement}><label className="col-lg-4 form-label small fw-bold">Tournament<select className="form-select mt-1" value={announcement.tournament_id} onChange={event=>setAnnouncement(current=>({...current,tournament_id:event.target.value}))} required={user?.role==='statistician'}>{user?.role!=='statistician'&&<option value="">All tournaments</option>}{tournaments.map(row=><option value={row.id} key={row.id}>{row.name}</option>)}</select></label><label className="col-lg-5 form-label small fw-bold">Title<input className="form-control mt-1" maxLength="180" value={announcement.title} onChange={event=>setAnnouncement(current=>({...current,title:event.target.value}))} placeholder="Example: Venue changed for Saturday" required/></label><label className="col-lg-3 form-label small fw-bold">Priority<select className="form-select mt-1" value={announcement.priority} onChange={event=>setAnnouncement(current=>({...current,priority:event.target.value}))}><option value="normal">Normal</option><option value="important">Important</option><option value="urgent">Urgent</option></select></label><label className="col-lg-9 form-label small fw-bold">Message<textarea className="form-control mt-1" rows="3" maxLength="1500" value={announcement.message} onChange={event=>setAnnouncement(current=>({...current,message:event.target.value}))} placeholder="Write the exact update coaches and team staff need to know." required/></label><label className="col-lg-3 form-label small fw-bold">Visible for<select className="form-select mt-1" value={announcement.expires_in_hours} onChange={event=>setAnnouncement(current=>({...current,expires_in_hours:event.target.value}))}><option value="24">24 hours</option><option value="72">3 days</option><option value="168">7 days</option><option value="720">30 days</option></select></label><div className="col-12 d-flex flex-wrap align-items-center justify-content-between gap-2">{publishNotice?<span className="small fw-semibold" role="status">{publishNotice}</span>:<span className="text-muted small">Only assigned tournament staff and Admin can publish.</span>}<button className="btn btn-evsu" disabled={publishing||!announcement.title.trim()||!announcement.message.trim()||user?.role==='statistician'&&!announcement.tournament_id}><i className="bi bi-megaphone-fill me-2"/>{publishing?'Publishing…':'Publish announcement'}</button></div></form></section>}
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
