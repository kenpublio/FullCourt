import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import scoringService from '../services/scoringService';
import tournamentService from '../services/tournamentService';
import scheduleService from '../services/scheduleService';

const LiveScoringView = () => {
  const { user } = useAuth();
  const canReviewScores = ['platform_admin', 'admin', 'organization_admin', 'tournament_organizer'].includes(user?.role);
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
  const [scoreSnapshot, setScoreSnapshot] = useState({ team1_score: 0, team2_score: 0 });
  const [confirmingWinnerId, setConfirmingWinnerId] = useState(null);
  const [finalizing, setFinalizing] = useState(false);
  const liveMatchCount = matches.filter((item) => item.status === 'in_progress').length;
  const awaitingReviews = matches.filter((item) => item.status === 'awaiting_confirmation');

  const refreshMatches = useCallback(async (tournamentId = selectedTournament) => {
    if (!tournamentId) return;
    try {
      setMatches(await scheduleService.getSchedule(tournamentId));
    } catch (err) {
      console.error('Unable to refresh live scoring schedule', err);
    }
  }, [selectedTournament]);

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
      refreshMatches(selectedTournament);
      const timer = setInterval(() => refreshMatches(selectedTournament), 10000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [selectedTournament, refreshMatches]);

  const selectMatchToScore = async (m) => {
    setConfirmingWinnerId(null);
    setActiveMatch(m);
    setScoreData({ team1_score: 0, team2_score: 0, current_period: 'Q1', timer_seconds: 600 });
    setScoreSnapshot({ team1_score: 0, team2_score: 0 });
    try {
      const sc = await scoringService.getScore(m.id);
      if (sc) {
        const loadedScore = {
          team1_score:    Number(sc.team1_score)    || 0,
          team2_score:    Number(sc.team2_score)    || 0,
          current_period: sc.current_period || 'Q1',
          timer_seconds:  sc.timer_seconds  || 600,
        };
        setScoreData(loadedScore);
        setScoreSnapshot({ team1_score: loadedScore.team1_score, team2_score: loadedScore.team2_score });
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
      setScoreSnapshot({ team1_score: Number(scoreData.team1_score), team2_score: Number(scoreData.team2_score) });
      alert('Score updated live!');
    } catch {
      alert('Error updating score');
    }
  };

  const handleFinalize = async (winnerId) => {
    if (!activeMatch || !winnerId) return;
    setConfirmingWinnerId(winnerId);
  };

  const confirmFinalScore = async () => {
    if (!activeMatch || !confirmingWinnerId || finalizing) return;
    setFinalizing(true);
    try {
      await scoringService.finalizeMatch(activeMatch.id, confirmingWinnerId, scoreData, scoreSnapshot);
      alert('Final score confirmed. It is now official and available in Live Games and Share Cards.');
      setConfirmingWinnerId(null);
      setActiveMatch(null);
      await refreshMatches(selectedTournament);
    } catch (err) {
      alert(err.response?.data?.message || 'Finalization failed');
    } finally {
      setFinalizing(false);
    }
  };

  const confirmingWinner = activeMatch && [activeMatch.team1_id, activeMatch.team2_id]
    .map((id, index) => ({ id, name: index === 0 ? activeMatch.team1_name : activeMatch.team2_name }))
    .find((team) => Number(team.id) === Number(confirmingWinnerId));
  const scoresAreTied = Number(scoreData.team1_score) === Number(scoreData.team2_score);
  const selectedIsPendingReview = activeMatch?.status === 'awaiting_confirmation';
  const scoreWinnerId = Number(scoreData.team1_score) > Number(scoreData.team2_score) ? activeMatch?.team1_id : activeMatch?.team2_id;
  const winnerDoesNotMatchScore = !scoresAreTied && Number(scoreWinnerId) !== Number(confirmingWinnerId);

  return (
    <div className="container-fluid p-0 page-enter live-scoring-page">
      {/* Header */}
      <header className="live-scoring-hero mb-4">
        <div className="live-scoring-heading">
          <span className="live-scoring-kicker"><i className="bi bi-broadcast-pin"/> GAME-DAY CONTROL</span>
          <h1>Live Scorekeeping Portal</h1>
          <p>Update the game score and keep every result current as the action happens.</p>
          <div className="live-scoring-meta"><span><i className="bi bi-dribbble"/> Basketball</span><span><i className="bi bi-broadcast"/> {liveMatchCount} live {liveMatchCount === 1 ? 'game' : 'games'}</span></div>
        </div>
        <select
          aria-label="Select tournament for live scoring"
          className="form-select live-scoring-tournament"
          value={selectedTournament}
          onChange={e => setSelectedTournament(e.target.value)}
          disabled={!tournaments.length}
        >
          {tournaments.length ? tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>) : <option value="">No tournaments available</option>}
        </select>
        <i className="bi bi-basketball live-scoring-watermark" aria-hidden="true" />
      </header>

      {canReviewScores && <section className="final-score-review" aria-labelledby="final-score-review-title">
        <header>
          <div><span><i className="bi bi-shield-check"/> OFFICIAL RESULT CHECK</span><h2 id="final-score-review-title">Final Score Review</h2><p>Check submitted results before they count in standings or appear on share cards.</p></div>
          <b>{awaitingReviews.length} waiting</b>
        </header>
        {awaitingReviews.length ? <div className="final-score-review-list">{awaitingReviews.map((match) => <article key={match.id}>
          <div className="final-review-round"><i className="bi bi-hourglass-split"/><span>Awaiting confirmation</span></div>
          <div className="final-review-game"><strong>{match.team1_name || 'TBD'}</strong><b>{match.team1_score ?? 0}<i>–</i>{match.team2_score ?? 0}</b><strong>{match.team2_name || 'TBD'}</strong></div>
          <div className="final-review-meta"><span>{match.tournament_name || tournaments.find((t) => String(t.id) === String(selectedTournament))?.name || 'Selected tournament'}</span><span>{match.stage_name || `Round ${match.round_number || 1}`}</span></div>
          <button type="button" onClick={() => selectMatchToScore(match)}><i className="bi bi-search me-1"/> Review score</button>
        </article>)}</div> : <div className="final-review-empty"><i className="bi bi-check2-circle"/><span><strong>Nothing waiting for approval</strong>Submitted final scores will appear here for review.</span></div>}
      </section>}

      <div className="row g-4">
        {/* Match list */}
        <div className="col-md-5">
          <div className="card-custom p-3 live-scoring-match-panel">
            <div className="live-scoring-panel-heading"><div><span>GAME LIST</span><h2>Select a match</h2></div><b>{matches.length}</b></div>
            <div className="d-flex flex-column gap-2">
              {matches.length === 0 && (
                <div className="live-scoring-empty">
                  <i className="bi bi-calendar2-x" />
                  <b>{tournaments.length ? 'No games scheduled yet' : 'No tournament available'}</b>
                  <span>{tournaments.length ? 'Games will appear after the tournament schedule is created.' : 'Create or publish a tournament schedule to begin scorekeeping.'}</span>
                </div>
              )}
              {matches.map(m => (
                <button type="button"
                  key={m.id}
                  className={`match-item${activeMatch?.id === m.id ? ' active' : ''}`}
                  onClick={() => selectMatchToScore(m)}
                  aria-pressed={activeMatch?.id === m.id}
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
                    {m.court_name || m.venue_name || 'Court TBA'}
                  </small>
                  {m.scheduled_start_time && <small className="d-block text-muted mt-1"><i className="bi bi-clock me-1"/>{new Date(m.scheduled_start_time).toLocaleString([], {dateStyle:'medium',timeStyle:'short'})}</small>}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scoreboard */}
        <div className="col-md-7">
          {activeMatch ? (
            <div className="live-scoreboard live-scoreboard-enhanced text-center">
              {/* Live badge */}
              <div className="d-flex justify-content-center mb-3">
                <span className="live-badge">
                  Courtside console · {activeMatch.stage_name || `Round ${activeMatch.round_number}`}
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
                {!selectedIsPendingReview && <button
                  className="btn btn-warning fw-bold px-4"
                  style={{ borderRadius: 10 }}
                  onClick={saveScore}
                >
                  <i className="bi bi-broadcast me-1" /> Update Live Score
                </button>}
                {selectedIsPendingReview && <span className="final-review-score-note"><i className="bi bi-lock-fill"/> Scoring is paused while you review this submitted result.</span>}
                {canReviewScores && <button
                  className="btn btn-success px-3"
                  style={{ borderRadius: 10, fontSize: '0.82rem' }}
                  onClick={() => handleFinalize(activeMatch.team1_id)}
                >
                  <i className="bi bi-patch-check-fill me-1" /> Review: {activeMatch.team1_name} wins
                </button>}
                {canReviewScores && <button
                  className="btn btn-success px-3"
                  style={{ borderRadius: 10, fontSize: '0.82rem' }}
                  onClick={() => handleFinalize(activeMatch.team2_id)}
                >
                  <i className="bi bi-patch-check-fill me-1" /> Review: {activeMatch.team2_name} wins
                </button>}
              </div>
            </div>
          ) : (
            <div className="card-custom live-score-placeholder text-center">
              <i className="bi bi-broadcast-pin" style={{ fontSize: '3.5rem', color: 'var(--evsu-primary)', opacity: 0.25, display: 'block', marginBottom: '1rem' }} />
              <h5 className="fw-bold text-muted">No Match Selected</h5>
              <p className="text-muted small mb-0">
                Pick a match from the left panel to launch the live scoreboard.
              </p>
            </div>
          )}
        </div>
      </div>
      {confirmingWinner && activeMatch && (
        <div className="score-confirm-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !finalizing) setConfirmingWinnerId(null); }}>
          <section className="score-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="score-confirm-title">
            <span className="score-confirm-kicker"><i className="bi bi-shield-check" /> OFFICIAL RESULT REVIEW</span>
            <h2 id="score-confirm-title">Confirm the final score</h2>
            <p>Please check the scoreboard before making this result official. Confirmed results update the public live center, standings, and share cards.</p>
            <div className="score-confirm-matchup">
              <div><small>{activeMatch.team1_name || 'Home'}</small><strong>{scoreData.team1_score}</strong></div>
              <span>FINAL</span>
              <div><small>{activeMatch.team2_name || 'Away'}</small><strong>{scoreData.team2_score}</strong></div>
            </div>
            {scoresAreTied
              ? <div className="score-confirm-warning" role="alert"><i className="bi bi-exclamation-circle" /> The score is tied. Update the game score before confirming a winner.</div>
              : winnerDoesNotMatchScore
                ? <div className="score-confirm-warning" role="alert"><i className="bi bi-exclamation-circle" /> The selected winner does not match the higher score. Go back and choose the correct team.</div>
                : <div className="score-confirm-winner"><i className="bi bi-trophy-fill" /> Winner to record: <strong>{confirmingWinner.name}</strong></div>}
            <div className="score-confirm-actions">
              <button type="button" className="score-confirm-cancel" disabled={finalizing} onClick={() => setConfirmingWinnerId(null)}>Go back</button>
              <button type="button" className="score-confirm-submit" disabled={finalizing || scoresAreTied || winnerDoesNotMatchScore} onClick={confirmFinalScore}>
                {finalizing ? 'Confirming…' : <><i className="bi bi-check2-circle" /> Confirm official result</>}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

export default LiveScoringView;
