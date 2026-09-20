import { useEffect, useState } from "react";
import tournamentService from "../services/tournamentService";
import engagementService from "../services/engagementService";
import "../styles/operations-polish.css";

const AwardsManagement = () => {
  const [tournaments, setTournaments] = useState([]),
    [selected, setSelected] = useState(""),
    [awards, setAwards] = useState([]),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  const apiRoot = (import.meta.env.VITE_API_URL || "http://127.0.0.1:8767/api").replace(/\/api\/?$/, "");
  const mediaUrl = (value) => value?.startsWith("http") ? value : `${apiRoot}${value}`;
  useEffect(() => {
    tournamentService.getTournaments().then((r) => {
      setTournaments(r.tournaments || []);
      if (r.tournaments?.[0]) setSelected(String(r.tournaments[0].id));
    });
  }, []);
  useEffect(() => {
    if (selected) engagementService.awards(selected).then(setAwards).catch(()=>setError("Unable to load tournament awards. Try again."));
  }, [selected]);
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
        <div>
          <span className="ops-eyebrow">PERFORMANCE HONORS</span><h3 className="fw-bold mb-1">
            <i className="bi bi-award-fill text-evsu-primary me-2" />
            Basketball Awards
          </h3>
          <p className="text-muted small mb-0">
            Data-backed leaders, official confirmation, and public publishing
          </p>
        </div>
        <div className="d-flex gap-2">
          <select
            className="form-select"
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
          >
            {tournaments.map((t) => (
              <option value={t.id} key={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <button
            className="btn btn-evsu text-nowrap"
            disabled={!selected || loading}
            onClick={recommend}
          >
            {loading ? "Computing…" : "Build Recommendations"}
          </button>
        </div>
      </div>
      {error && <div className="alert alert-danger d-flex justify-content-between align-items-center"><span><i className="bi bi-exclamation-triangle me-2"/>{error}</span><button className="btn btn-sm btn-outline-danger" onClick={()=>setError("")}>Dismiss</button></div>}
      <div className="row g-3">
        {awards.length === 0 ? (
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
                    <div className="d-flex justify-content-between align-items-center mt-4">
                      <span
                        className={`badge ${a.status === "confirmed" ? "bg-success" : "bg-warning text-dark"}`}
                      >
                        {a.status}
                      </span>
                      {a.status !== "confirmed" && a.award_id && (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => confirm(a.award_id)}
                        >
                          Confirm & Publish
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
