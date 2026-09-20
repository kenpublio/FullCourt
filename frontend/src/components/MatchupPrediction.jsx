import React, { useEffect, useState } from 'react';
import basketballAnalyticsService from '../services/basketballAnalyticsService';

const MatchupPrediction = ({ matchId, title = 'Matchup Win Probability' }) => {
  const [outlook, setOutlook] = useState(null);
  const [loading, setLoading] = useState(Boolean(matchId));

  useEffect(() => {
    let active = true;
    if (!matchId) { setOutlook(null); setLoading(false); return () => { active = false; }; }
    setLoading(true);
    basketballAnalyticsService.outlook(matchId)
      .then(data => { if (active) setOutlook(data); })
      .catch(() => { if (active) setOutlook(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [matchId]);

  if (!matchId) return null;
  if (loading) return <div className="card-custom p-4 matchup-probability-card"><span className="spinner-border spinner-border-sm me-2" />Calculating matchup estimate…</div>;
  if (!outlook) return null;

  const home = Number(outlook.home_win_probability || 50);
  const away = Number(outlook.away_win_probability || 50);
  const completed = Number(outlook.data_used?.total_completed_games || 0);
  return (
    <section className="card-custom p-4 matchup-probability-card" aria-labelledby={`matchup-title-${matchId}`}>
      <div className="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
        <div><span className="matchup-eyebrow"><i className="bi bi-graph-up-arrow me-1" /> PERFORMANCE ANALYTICS</span><h5 id={`matchup-title-${matchId}`} className="fw-bold mb-1">{title}</h5><small className="text-muted">Based only on completed games recorded in FullCourt</small></div>
        <span className={`badge ${outlook.confidence === 'moderate' ? 'bg-success' : 'bg-warning text-dark'}`}>{outlook.confidence} confidence</span>
      </div>
      <div className="matchup-team-row">
        <div><b>{outlook.home_team || 'Team 1'}</b><strong>{home}%</strong><small>{outlook.home_record?.wins || 0}–{outlook.home_record?.losses || 0} · {outlook.home_record?.win_rate ?? 50}% win rate · {outlook.home_ppg || 0} PPG</small></div>
        <span className="matchup-vs">VS</span>
        <div className="text-end"><b>{outlook.away_team || 'Team 2'}</b><strong>{away}%</strong><small>{outlook.away_record?.wins || 0}–{outlook.away_record?.losses || 0} · {outlook.away_record?.win_rate ?? 50}% win rate · {outlook.away_ppg || 0} PPG</small></div>
      </div>
      <div className="matchup-meter my-3" aria-label={`${outlook.home_team} ${home} percent, ${outlook.away_team} ${away} percent`}><span style={{ width: `${home}%` }} /></div>
      <div className="d-flex flex-wrap justify-content-between gap-2 small text-muted"><span><i className="bi bi-database-check me-1" />{completed} completed game{completed === 1 ? '' : 's'} used</span><span>Estimated favorite: <b>{outlook.favored_team || 'Even matchup'}</b></span></div>
      <details className="matchup-details mt-3"><summary>How this estimate works</summary><p className="mb-1 mt-2">{outlook.formula}</p><p className="mb-0"><b>Limitations:</b> {(outlook.limitations || []).join(' ')}</p></details>
      <div className="matchup-disclaimer mt-3"><i className="bi bi-info-circle-fill me-2" />{outlook.disclaimer}</div>
    </section>
  );
};
export default MatchupPrediction;
