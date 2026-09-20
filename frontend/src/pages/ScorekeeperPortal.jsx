import React, { useState, useEffect, useRef, useCallback } from 'react';
import scorekeeperService from '../services/scorekeeperService';

const formatTime = (sec) => {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
};

const ScorekeeperPortal = () => {
  const [assigned, setAssigned] = useState([]);
  const [activeMatch, setActiveMatch] = useState(null);
  const [board, setBoard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef(null);

  const loadAssigned = async () => {
    setLoading(true);
    try {
      const m = await scorekeeperService.getAssigned();
      setAssigned(m);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadBoard = useCallback(async () => {
    if (!activeMatch) return;
    try {
      const b = await scorekeeperService.getScoreboard(activeMatch.id);
      setBoard(b);
    } catch (e) {
      // Bracket not generated yet etc.
      console.error(e);
      if (e.response?.status === 404) {
        setBoard(null);
      }
    }
  }, [activeMatch]);

  useEffect(() => { loadAssigned(); }, []);

  useEffect(() => {
    if (!activeMatch) return;
    loadBoard();
  }, [activeMatch, loadBoard]);

  // Background polling (real-time-ish, socket-ready) while a match is open.
  useEffect(() => {
    if (!activeMatch) return;
    setPolling(true);
    pollRef.current = setInterval(loadBoard, 5000);
    return () => { setPolling(false); clearInterval(pollRef.current); };
  }, [activeMatch, loadBoard]);

  const send = async (payload) => {
    if (!activeMatch) return;
    try {
      await scorekeeperService.recordEvent(activeMatch.id, payload);
      loadBoard();
    } catch (e) {
      alert(e.response?.data?.message || 'Event could not be recorded');
    }
  };

  const setManual = () => {
    const t1 = prompt('Team 1 score:', board.score.team1_score);
    const t2 = prompt('Team 2 score:', board.score.team2_score);
    if (t1 !== null && t2 !== null) send({ event_type: 'score_manual', team1_score: Number(t1), team2_score: Number(t2) });
  };
  const toggleClock = () => send(board.score.is_timer_running ? { event_type: 'clock_pause' } : { event_type: 'clock_start', clock_seconds: board.score.timer_seconds });
  const resetClock = () => send({ event_type: 'clock_reset' });
  const prevPeriod = () => {
    const order = ['Q1','Q2','Q3','Q4','OT1','OT2'];
    const idx = order.indexOf(board.score.current_period);
    if (idx > 0) send({ event_type: 'period_start', period: order[idx - 1] });
  };
  const nextPeriod = () => {
    const order = ['Q1','Q2','Q3','Q4','OT1','OT2'];
    const idx = order.indexOf(board.score.current_period);
    if (idx < order.length - 1) send({ event_type: 'period_start', period: order[idx + 1] });
  };
  const endGame = () => {
    const winner = prompt('Enter winning team id\n' + `${board.score.team1.team_id || 'Team1'} or ${board.score.team2.team_id || 'Team2'}`);
    if (winner) send({ event_type: 'game_end', winner_team_id: Number(winner), team_id: board.score.team1?.team_id });
  };
  const addTimeout = async () => {
    const teamId = prompt('Timeout for team id (1 or 2):');
    if (!teamId) return;
    await send({ event_type: 'timeout', team_id: Number(teamId), duration_seconds: 60 });
  };
  const addFoul = async () => {
    const pid = prompt('Player user_id:');
    const tid = prompt('Team id (1 or 2):');
    const type = prompt('Foul type (personal/technical/unsportsmanlike/disqualification):', 'personal');
    if (!pid || !tid) return;
    await send({ event_type: 'foul', player_id: Number(pid), team_id: Number(tid), foul_type: type });
  };
  const addSubstitution = async () => {
    const pin = prompt('Player IN user_id:');
    const pout = prompt('Player OUT user_id:');
    const tid = prompt('Team id (1 or 2):');
    if (!pin || !pout || !tid) return;
    await send({ event_type: 'substitution', player_in_id: Number(pin), player_out_id: Number(pout), team_id: Number(tid) });
  };
  const undo = async (eventId) => {
    if (!window.confirm('Remove this event?')) return;
    try { await scorekeeperService.undoEvent(activeMatch.id, eventId); loadBoard(); } catch (e) { alert(e.response?.data?.message || 'Undo failed'); }
  };

  if (loading) {
    return (
      <div className="container-fluid py-4">
        <div className="text-center py-5 text-muted">
          <i className="bi bi-broadcast-pin display-4 d-block mb-3 opacity-25" />
          <p className="small">Loading your assigned matches…</p>
        </div>
      </div>
    );
  }

  const renderScoreboard = () => {
    const placeholder = (icon, title, subtitle) => (
      <div className="card-custom p-5 text-center" style={{ minHeight: 340, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <i className={`bi ${icon}`} style={{ fontSize: '3.5rem', color: 'var(--evsu-primary)', opacity: 0.2, display: 'block', marginBottom: '1rem' }} />
        <h5 className="fw-bold text-muted">{title}</h5>
        <p className="text-muted small mb-0">{subtitle}</p>
      </div>
    );

    if (!activeMatch) return placeholder('bi-broadcast-pin', 'Select a Match', 'Choose one of your assigned matches from the left panel to launch the scoreboard.');
    if (!board) return placeholder('bi-exclamation-triangle-fill', 'No Scoreboard Yet', 'The bracket must be generated before live scorekeeping can begin.');

    const s = board.score;
    const t1Id = s.team1_id;
    const t2Id = s.team2_id;
    const locked = board.score.match_status === 'completed' || board.score.match_status === 'cancelled';
    const disabled = locked ? { disabled: true } : {};
    const maybeSend = (payload) => { if (locked) return; send(payload); };
    const t1Fouls = board.fouls.filter(f => f.team_id === t1Id).length;
    const t2Fouls = board.fouls.filter(f => f.team_id === t2Id).length;
    const t1TOs = board.timeouts.filter(t => t.team_id === t1Id).length;
    const t2TOs = board.timeouts.filter(t => t.team_id === t2Id).length;

    const scoreControls = (team) => (
      <div className="score-btn-group">
        <button className="score-btn" {...disabled} onClick={() => maybeSend({ event_type: `score_${team}`, value: 1 })}>+1</button>
        <button className="score-btn" {...disabled} onClick={() => maybeSend({ event_type: `score_${team}`, value: 2 })}>+2</button>
        <button className="score-btn" {...disabled} onClick={() => maybeSend({ event_type: `score_${team}`, value: 3 })}>+3</button>
        <div className="d-grid gap-2 mt-2">
          <button className="btn btn-outline-danger btn-sm" style={{ borderRadius: 8, fontSize: '0.72rem' }} {...disabled} onClick={() => maybeSend({ event_type: `score_${team}`, value: -1 })}>−1</button>
        </div>
      </div>
    );

    return (
      <div className="live-scoreboard text-center">
        <div className="d-flex justify-content-center mb-3">
          <span className="live-badge">
            Live Scorekeeper · {activeMatch.stage_name} · {activeMatch.tournament_name}
          </span>
        </div>

        <div className="row align-items-center my-3">
          {/* Team 1 */}
          <div className="col-5">
            <div className="score-team-name mb-1">{s.team1_name || 'Team 1'}</div>
            <div className="score-number">{s.team1_score}</div>
            {scoreControls(1)}
          </div>

          {/* Center */}
          <div className="col-2 score-divider">
            <div className="score-vs">VS</div>
            <div className="score-period-badge">
              {s.current_period}
              <div className="small text-muted" style={{ opacity: 0.7 }}>{formatTime(s.timer_seconds)}</div>
            </div>
            <div className="mt-2 small" style={{ color: 'var(--text-muted)' }}>
              Fouls {t1Fouls} / TOs {t1TOs}
            </div>
          </div>

          {/* Team 2 */}
          <div className="col-5">
            <div className="score-team-name mb-1">{s.team2_name || 'Team 2'}</div>
            <div className="score-number">{s.team2_score}</div>
            {scoreControls(2)}
          </div>
        </div>

        {/* Clock + period controls */}
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mb-3">
          {locked && (
            <span className="badge bg-secondary" style={{ fontSize: '0.7rem' }}>
              <i className="bi bi-lock-fill me-1" /> Match completed — scoreboard locked
            </span>
          )}
          <button className="btn btn-evsu-primary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={toggleClock}>
            <i className={`bi ${s.is_timer_running ? 'bi-pause' : 'bi-play'} me-1`} />
            {s.is_timer_running ? 'Pause' : 'Start'}
          </button>
          <button className="btn btn-outline-secondary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={resetClock}>
            <i className="bi bi-arrow-counterclockwise me-1" /> Reset Clock
          </button>
          <button className="btn btn-outline-secondary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={prevPeriod}>
            <i className="bi bi-skipstart-fill me-1" /> Prev Period
          </button>
          <button className="btn btn-outline-secondary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={nextPeriod}>
            <i className="bi bi-skipend-fill me-1" /> Next Period
          </button>
        </div>

        {/* Advanced controls */}
        <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
          <button className="btn btn-warning px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={setManual}>
            <i className="bi bi-pen me-1" /> Manual Score
          </button>
          <button className="btn btn-outline-primary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={addFoul}>
            <i className="bi bi-emoji-frown me-1" /> Foul
          </button>
          <button className="btn btn-outline-primary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={addTimeout}>
            <i className="bi bi-stopwatch me-1" /> Timeout
          </button>
          <button className="btn btn-outline-primary px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={addSubstitution}>
            <i className="bi bi-arrow-left-right me-1" /> Substitution
          </button>
          <button className="btn btn-danger px-3" style={{ borderRadius: 10, fontSize: '0.8rem' }} {...disabled} onClick={endGame}>
            <i className="bi bi-flag-fill me-1" /> End Game
          </button>
        </div>

        {/* Fouls summary */}
        <div className="row g-3 mt-1">
          <div className="col-6">
            <div className="card-custom p-2">
              <div className="fw-bold" style={{ color: 'var(--text-primary)' }}>{s.team1_name || 'Team 1'}</div>
              <div className="text-muted small">Fouls: {t1Fouls} · Timeouts used: {t1TOs}</div>
            </div>
          </div>
          <div className="col-6">
            <div className="card-custom p-2">
              <div className="fw-bold" style={{ color: 'var(--text-primary)' }}>{s.team2_name || 'Team 2'}</div>
              <div className="text-muted small">Fouls: {t2Fouls} · Timeouts used: {t2TOs}</div>
            </div>
          </div>
        </div>

        {/* Event log */}
        <div className="mt-4 text-start">
          <h6 className="fw-bold" style={{ color: 'var(--text-primary)' }}><i className="bi bi-list-ul me-2 text-muted" />Event Log</h6>
          <div className="table-responsive" style={{ maxHeight: 280, overflowY: 'auto' }}>
            <table className="table table-sm table-borderless mb-0">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                  <th className="small text-muted">Time</th>
                  <th className="small text-muted">Event</th>
                  <th className="small text-muted">Player</th>
                  <th className="small text-muted">Detail</th>
                  <th className="small text-muted text-end">Undo</th>
                </tr>
              </thead>
              <tbody>
                {board.events.length === 0 ? (
                  <tr><td colSpan={5} className="text-center text-muted small py-3">No events recorded yet.</td></tr>
                ) : board.events.map(ev => (
                  <tr key={ev.id} className="align-middle">
                    <td className="small text-muted">{new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</td>
                    <td className="small" style={{ color: 'var(--text-primary)' }}>{ev.event_type.replace(/_/g, ' ')}</td>
                    <td className="small text-muted">{ev.player_name || '—'}</td>
                    <td className="small text-muted text-truncate" style={{ maxWidth: 200 }}>{JSON.stringify(ev.detail_json ?? '')}</td>
                    <td className="small text-end">
                      <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6, fontSize: '0.68rem' }} onClick={() => undo(ev.id)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="container-fluid p-0 page-enter">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
        <div>
          <h3 className="fw-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}>
            <i className="bi bi-trophy-fill me-2" style={{ color: 'var(--evsu-primary)' }} />
            Scorekeeper Portal
          </h3>
          <p className="text-muted small mb-0">FullCourt · Real-time match control</p>
        </div>
        {polling && (
          <span className="badge bg-evsu-primary" style={{ fontSize: '0.72rem' }}>
            <i className="bi bi-wifi-repeat me-1" /> Live
          </span>
        )}
      </div>

      <div className="row g-4">
        {/* Assigned matches */}
        <div className="col-lg-4">
          <div className="card-custom p-3 h-100" style={{ overflowY: 'auto' }}>
            <h6 className="fw-bold mb-3" style={{ color: 'var(--text-primary)' }}>
              <i className="bi bi-calendar-event me-2 text-muted" />My Assigned Matches
            </h6>
            {assigned.length === 0 ? (
              <div className="text-center py-4 text-muted small">
                <i className="bi bi-calendar-x display-6 d-block mb-2 opacity-30" />
                No matches currently assigned to you.
              </div>
            ) : (
              <div className="d-flex flex-column gap-2">
                {assigned.map(m => (
                  <div
                    key={m.id}
                    className={`match-item${activeMatch?.id === m.id ? ' active' : ''}`}
                    onClick={() => setActiveMatch(m)}
                    role="button" tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && setActiveMatch(m)}
                  >
                    <div className="d-flex justify-content-between align-items-center mb-1">
                      <span className="text-muted small" style={{ fontWeight: 600 }}>
                        {m.stage_name || `Round ${m.round_number}`}
                      </span>
                      <span className="badge bg-danger" style={{ fontSize: '0.68rem' }}>{m.status}</span>
                    </div>
                    <div className="fw-bold" style={{ color: 'var(--text-primary)' }}>
                      {m.team1_name || 'TBD'} <span style={{ color: 'var(--text-muted)' }}>vs</span> {m.team2_name || 'TBD'}
                    </div>
                    <small className="text-muted">
                      <i className="bi bi-clock me-1" /> {format(new Date(m.scheduled_start_time))} · {m.venue_name || m.court_name || '—'}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Scoreboard */}
        <div className="col-lg-8">
          {renderScoreboard()}
        </div>
      </div>
    </div>
  );
};

export default ScorekeeperPortal;
