import { useEffect, useState } from "react";
import tournamentService from "../services/tournamentService";
import engagementService from "../services/engagementService";
import "../styles/operations-polish.css";

const AwardsManagement = () => {
  const [tournaments, setTournaments] = useState([]),
    [selected, setSelected] = useState(""),
    [awards, setAwards] = useState([]),
    [loading, setLoading] = useState(false),
    [initializing, setInitializing] = useState(true),
    [loadingAwards, setLoadingAwards] = useState(false),
    [error, setError] = useState("");
  const apiRoot = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8767/api").replace(/\/api\/?$/, "");
  const mediaUrl = (value) => value?.startsWith("http") ? value : `${apiRoot}${value}`;
  useEffect(() => {
    tournamentService.getTournaments().then((r) => {
      setTournaments(r.tournaments || []);
      if (r.tournaments?.[0]) setSelected(String(r.tournaments[0].id));
    }).catch(() => setError("Unable to load tournaments. Refresh the page and try again."))
      .finally(() => setInitializing(false));
  }, []);
  useEffect(() => {
    if (!selected) { setAwards([]); return; }
    let active = true;
    setLoadingAwards(true);
    setError("");
    engagementService.awards(selected)
      .then((rows) => { if (active) setAwards(rows); })
      .catch(() => { if (active) setError("Unable to load tournament awards. Try again."); })
      .finally(() => { if (active) setLoadingAwards(false); });
    return () => { active = false; };
  }, [selected]);
  const confirmedCount = awards.filter((award) => award.status === "confirmed").length;
  const pendingCount = awards.filter((award) => award.user_id && award.status !== "confirmed").length;
  const categoryCount = new Set(awards.map((award) => award.name).filter(Boolean)).size;
  const recommend = async () => {
    setLoading(true);
    setError("");
    try {
      setAwards(await engagementService.recommend(selected));
    } catch {
      setError("Recommendations could not be rebuilt. Confirm that finalized game statistics are available.");
    } finally {
      setLoading(false);
    }
  };
  const confirm = async (id) => {
    await engagementService.confirm(id, true);
    setAwards(await engagementService.awards(selected));
  };
  return (
    <div className="container-fluid p-0 ops-page awards-page">
      <div className="ops-page-head">
        <div className="awards-title">
          <span className="ops-eyebrow">PERFORMANCE HONORS</span><h1 className="fw-bold mb-1">
            <i className="bi bi-award-fill text-evsu-primary me-2" />
            Basketball Awards
          </h1>
          <p className="text-muted small mb-0">
            Data-backed leaders, official confirmation, and public publishing
          </p>
        </div>
        <div className="awards-toolbar">
          <label className="awards-tournament-select">
            <span>Tournament</span>
            <select
              aria-label="Select tournament for awards"
              className="form-select"
              value={selected}
              disabled={initializing || tournaments.length === 0}
              onChange={(e) => setSelected(e.target.value)}
            >
              {tournaments.length === 0 && <option value="">No tournaments available</option>}
              {tournaments.map((t) => (
                <option value={t.id} key={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="btn btn-evsu text-nowrap"
            disabled={!selected || loading || initializing || loadingAwards}
            onClick={recommend}
          >
            <i className={`bi ${loading ? "bi-arrow-repeat awards-spin" : "bi-stars"} me-2`} />
            {loading ? "Building…" : "Build recommendations"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger d-flex justify-content-between align-items-center"><span><i className="bi bi-exclamation-triangle me-2"/>{error}</span><button className="btn btn-sm btn-outline-danger" onClick={()=>setError("")}>Dismiss</button></div>}
      {selected && awards.length > 0 && <section className="awards-summary" aria-label="Awards overview">
        <div className="awards-summary-copy"><span>TOURNAMENT AWARDS BOARD</span><strong>{tournaments.find((t) => String(t.id) === selected)?.name || "Selected tournament"}</strong><small>Recommendations are based on recorded game performance.</small></div>
        <div className="awards-summary-stat"><i className="bi bi-award"/><span><b>{categoryCount}</b>Categories</span></div>
        <div className="awards-summary-stat is-pending"><i className="bi bi-hourglass-split"/><span><b>{pendingCount}</b>Awaiting review</span></div>
        <div className="awards-summary-stat is-confirmed"><i className="bi bi-patch-check"/><span><b>{confirmedCount}</b>Confirmed</span></div>
      </section>}
      <div className="awards-list-heading"><div><span>HONORS & LEADERS</span><h2>{awards.length ? "Recommended award recipients" : "Tournament award board"}</h2></div>{awards.length > 0 && <span className="awards-total">{awards.length} {awards.length === 1 ? "award" : "awards"}</span>}</div>
      <div className="row g-3">
        {loadingAwards || initializing ? (
          <div className="ops-empty awards-empty"><span className="awards-loading-mark"><i className="bi bi-arrow-repeat awards-spin"/></span><strong>Loading tournament awards</strong><p>Gathering the latest confirmed results for this competition.</p></div>
        ) : tournaments.length === 0 ? (
          <div className="ops-empty awards-empty"><span className="awards-empty-mark"><i className="bi bi-calendar2-x"/></span><strong>No tournaments to review</strong><p>Create or approve a tournament before building its awards board.</p></div>
        ) : awards.length === 0 ? (
          <div className="ops-empty"><i className="bi bi-trophy"/><strong>No award recommendations yet</strong><p>Choose a tournament and build recommendations from finalized statistics.</p>
          </div>
        ) : (
          awards.map((a, i) => (
            <div className="col-md-6 col-xl-4" key={`${a.category_id}-${i}`}>
              <article className={`award-card award-profile h-100 ${a.name==='Tournament MVP'?'award-mvp':a.name.startsWith('Mythical Five')?'award-mythical':''}`}><span className="award-rank">{String(i+1).padStart(2,'0')}</span>
                <div className="award-profile-top"><div className="award-avatar">{a.avatar_url?<img src={mediaUrl(a.avatar_url)} alt={`${a.full_name} profile`}/>:<i className="bi bi-person-fill"/>}</div><div><span className="award-type">{a.name==='Tournament MVP'?'MOST VALUABLE PLAYER':a.name.startsWith('Mythical Five')?'MYTHICAL FIVE':'STAT LEADER'}</span><h5 className="fw-bold mb-0">{a.name}</h5></div></div>
                {a.user_id ? (
                  <>
                    <div className="fs-5 fw-semibold mt-3">{a.full_name}</div>
                    <div className="text-muted small">#{a.jersey_number || "—"} · {a.position || "Player"} · {a.team_name || "Team"}</div>
                    <div className="award-stat-strip"><span><b>{a.points}</b>PTS</span><span><b>{a.rebounds}</b>REB</span><span><b>{a.assists}</b>AST</span><span><b>{a.defense}</b>DEF</span></div>
                    <p className="award-reason"><i className="bi bi-stars"/> Selected from {a.games_played} official game{Number(a.games_played)===1?'':'s'} using a performance rating of <b>{a.rating}</b>.</p>
                    <div className="award-card-footer">
                      <span
                        className={`award-status ${a.status === "confirmed" ? "is-confirmed" : "is-pending"}`}
                      >
                        <i className={`bi ${a.status === "confirmed" ? "bi-patch-check-fill" : "bi-clock-history"}`} />
                        {a.status === "confirmed" ? "Confirmed & published" : "Pending confirmation"}
                      </span>
                      {a.status !== "confirmed" && a.award_id && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={async () => {
                            try { await confirm(a.award_id); }
                            catch { setError("This award could not be confirmed. Please try again."); }
                          }}
                        >
                          <i className="bi bi-check2-circle me-1"/>Confirm & publish
                        </button>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-muted">
                    No eligible finalized statistics yet.
                  </p>
                )}
              </article>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default AwardsManagement;
