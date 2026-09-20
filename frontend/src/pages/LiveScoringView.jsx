import React, { useState, useEffect } from 'react';
import scoringService from '../services/scoringService';
import tournamentService from '../services/tournamentService';
import scheduleService from '../services/scheduleService';

const LiveScoringView = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [matches, setMatches] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [scoreData, setScoreData] = useState({
    team1_score: 0,
    team2_score: 0,
    current_period: 'Q1',
    timer_seconds: 600,
  });

  useEffect(() => {
    const load = async () => {
      const res = await tournamentService.getTournaments();
      setTournaments(res.tournaments || []);
      if (res.tournaments?.length > 0) setSelectedTournament(res.tournaments[0].id);
    };
    load();
  }, []);

  useEffect(() => {
    if (selectedTournament) {
      scheduleService.getSchedule(selectedTournament).then(setMatches);
    }
  }, [selectedTournament]);

  const selectMatchToScore = async (m) => {
    setActiveMatch(m);
    try {
      const sc = await scoringService.getScore(m.id);
      if (sc) {
        setScoreData({
          team1_score:    sc.team1_score    || 0,
          team2_score:    sc.team2_score    || 0,
          current_period: sc.current_period || 'Q1',
          timer_seconds:  sc.timer_seconds  || 600,
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleScoreChange = (team, delta) => {
    setScoreData(prev => ({ ...prev, [team]: Math.max(0, prev[team] + delta) }));
  };

  const saveScore = async () => {
    if (!activeMatch) return;
    try {
      await scoringService.updateScore(activeMatch.id, scoreData);
      alert('Score updated live!');
    } catch {
      alert('Error updating score');
    }
  };

  const handleFinalize = async (winnerId) => {
    if (!activeMatch || !winnerId) return;
    if (!window.confirm('Finalize match and advance winner?')) return;
    try {
      await scoringService.finalizeMatch(activeMatch.id, winnerId);
      alert('Match finalized!');
      setActiveMatch(null);
      scheduleService.getSchedule(selectedTournament).then(setMatches);
    } catch (err) {
      alert(err.response?.data?.message || 'Finalization failed');
    }
  };

  return (
    <div className="container-fluid p-0 page-enter">
      {/* Header */}
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            <i className="bi bi-broadcast-pin me-2" style={{ color: 'var(--evsu-primary)' }} />
            Live Scorekeeping Portal
          </h3>
          <p className="text-muted small mb-0">Real-time tournament score management</p>
        </div>
        <select
          className="form-select w-auto"
          style={{ borderColor: 'var(--surface-border)', borderRadius: 10 }}
          value={selectedTournament}
          onChange={e => setSelectedTournament(e.target.value)}
        >
          {tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      <div className="row g-4">
        {/* Match list */}
        <div className="col-md-5">
          <div className="card-custom p-3">
            <h6 className="fw-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
              <i className="bi bi-list-ul me-2 text-muted" />
              Select Match to Score
            </h6>
            <div className="d-flex flex-column gap-2">
              {matches.length === 0 && (
                <div className="text-center py-4 text-muted small">
                  <i className="bi bi-calendar-x display-6 d-block mb-2 opacity-40" />
                  No matches scheduled
                </div>
              )}
              {matches.map(m => (
                <div
                  key={m.id}
                  className={`match-item${activeMatch?.id === m.id ? ' active' : ''}`}
                  onClick={() => selectMatchToScore(m)}
                  role="button"
                  tabIndex={0}
                >
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="text-muted" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      {m.stage_name || `Round ${m.round_number}`}
                    </span>
                    <span className="badge bg-danger" style={{ fontSize: '0.68rem' }}>{m.status}</span>
                  </div>
                  <div className="fw-bold" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                    {m.team1_name || 'TBD'} <span style={{ color: 'var(--text-muted)' }}>vs</span> {m.team2_name || 'TBD'}
                  </div>
                  <small className="text-muted">
                    <i className="bi bi-geo-alt me-1" />
                    {m.court_name || 'Court A'}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="col-md-7">
          {activeMatch ? (
            <div className="live-scoreboard text-center">
              {/* Live badge */}
              <div className="d-flex justify-content-center mb-3">
                <span className="live-badge">
                  Live Scorekeeper · {activeMatch.stage_name}
                </span>
              </div>

              {/* Scores */}
              <div className="row align-items-center my-3">
                {/* Team 1 */}
                <div className="col-5">
                  <div className="score-team-name mb-1">{activeMatch.team1_name || 'Team 1'}</div>
                  <div className="score-number">{scoreData.team1_score}</div>
                  <div className="score-btn-group">
                    <button className="score-btn" onClick={() => handleScoreChange('team1_score', 1)}>+1</button>
                    <button className="score-btn" onClick={() => handleScoreChange('team1_score', 2)}>+2</button>
                    <button className="score-btn" onClick={() => handleScoreChange('team1_score', 3)}>+3</button>
                  </div>
                  <button
                    className="btn btn-outline-light btn-sm mt-2 px-3"
                    style={{ borderRadius: 8, fontSize: '0.75rem', opacity: 0.7 }}
                    onClick={() => handleScoreChange('team1_score', -1)}
                  >
                    <i className="bi bi-dash" /> Undo
                  </button>
                </div>

                {/* Divider */}
                <div className="col-2 score-divider">
                  <div className="score-vs">VS</div>
                  <div className="score-period-badge">{scoreData.current_period}</div>
                </div>

                {/* Team 2 */}
                <div className="col-5">
                  <div className="score-team-name mb-1">{activeMatch.team2_name || 'Team 2'}</div>
                  <div className="score-number">{scoreData.team2_score}</div>
                  <div className="score-btn-group">
                    <button className="score-btn" onClick={() => handleScoreChange('team2_score', 1)}>+1</button>
                    <button className="score-btn" onClick={() => handleScoreChange('team2_score', 2)}>+2</button>
                    <button className="score-btn" onClick={() => handleScoreChange('team2_score', 3)}>+3</button>
                  </div>
                  <button
                    className="btn btn-outline-light btn-sm mt-2 px-3"
                    style={{ borderRadius: 8, fontSize: '0.75rem', opacity: 0.7 }}
                    onClick={() => handleScoreChange('team2_score', -1)}
                  >
                    <i className="bi bi-dash" /> Undo
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div
                className="d-flex flex-wrap justify-content-center gap-2 mt-4 pt-3"
                style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
              >
                <button
                  className="btn btn-warning fw-bold px-4"
                  style={{ borderRadius: 10 }}
                  onClick={saveScore}
                >
                  <i className="bi bi-broadcast me-1" /> Update Live Score
                </button>
                <button
                  className="btn btn-success px-3"
                  style={{ borderRadius: 10, fontSize: '0.82rem' }}
                  onClick={() => handleFinalize(activeMatch.team1_id)}
                >
                  <i className="bi bi-trophy-fill me-1" />
                  {activeMatch.team1_name} Wins
                </button>
                <button
                  className="btn btn-success px-3"
                  style={{ borderRadius: 10, fontSize: '0.82rem' }}
                  onClick={() => handleFinalize(activeMatch.team2_id)}
                >
                  <i className="bi bi-trophy-fill me-1" />
                  {activeMatch.team2_name} Wins
                </button>
              </div>
            </div>
          ) : (
            <div className="card-custom p-5 text-center" style={{ minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
              <i className="bi bi-broadcast-pin" style={{ fontSize: '3.5rem', color: 'var(--evsu-primary)', opacity: 0.25, display: 'block', marginBottom: '1rem' }} />
              <h5 className="fw-bold text-muted">No Match Selected</h5>
              <p className="text-muted small mb-0">
                Pick a match from the left panel to launch the live scoreboard.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LiveScoringView;
