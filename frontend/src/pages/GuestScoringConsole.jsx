import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import scoringAccessService from '../services/scoringAccessService';
import ConfirmActionDialog from '../components/ConfirmActionDialog';
import '../styles/scoring-console.css';

const actions = [
  ['2pt_made', '+2', '2PT Made'],
  ['2pt_missed', '2PT', '2PT Miss'],
  ['3pt_made', '+3', '3PT Made'],
  ['3pt_missed', '3PT', '3PT Miss'],
  ['ft_made', '+1', 'Free Throw'],
  ['ft_missed', 'FT', 'Free Throw Miss'],
  ['off_rebound', 'OREB', 'Off. Rebound'],
  ['def_rebound', 'DREB', 'Def. Rebound'],
  ['assist', 'AST', 'Assist'],
  ['steal', 'STL', 'Steal'],
  ['block', 'BLK', 'Block'],
  ['turnover', 'TO', 'Turnover'],
  ['personal_foul', 'PF', 'Personal Foul'],
];

const periodNumber = (period) => {
  if (/^Q[1-4]$/.test(period)) return Number(period.slice(1));
  if (/^OT[1-5]$/.test(period)) return 4 + Number(period.slice(2));
  return 1;
};

const GuestScoringConsole = () => {
  const { token } = useParams();
  const [session, setSession] = useState(() => sessionStorage.getItem(`fc_score_${token}`) || '');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clockBusy, setClockBusy] = useState(false);
  const [period, setPeriod] = useState('Q1');
  const [clockMinutes, setClockMinutes] = useState('10');
  const [clockSeconds, setClockSeconds] = useState('00');
  const [shotClock, setShotClock] = useState(24);
  const [shotClockRunning, setShotClockRunning] = useState(false);
  const [possession, setPossession] = useState('team1'); // 'team1' or 'team2'
  const clockLoadedFor = useRef(null);
  const clockSyncAt = useRef(Date.now());
  const [clockNow, setClockNow] = useState(Date.now());
  const queueKey = `fc_score_queue_${token}`;
  const deviceId = useMemo(() => { let value=localStorage.getItem('fc_scoring_device_id');if(!value){value=crypto.randomUUID();localStorage.setItem('fc_scoring_device_id',value);}return value; }, []);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pendingEvents, setPendingEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); } catch { return []; }
  });
  const [lastSavedAt, setLastSavedAt] = useState(null);
  const [showFinalReview, setShowFinalReview] = useState(false);
  const [submittedFinal, setSubmittedFinal] = useState(null);
  const [undoBusy, setUndoBusy] = useState(false);
  const [pendingUndo, setPendingUndo] = useState(null);
  const [incidentType, setIncidentType] = useState('');
  const [incidentSubject, setIncidentSubject] = useState('');
  const [incident, setIncident] = useState({ severity: 'medium', description: '', action_taken: '' });
  const [incidentBusy, setIncidentBusy] = useState(false);

  const saveQueue = useCallback((items) => {
    localStorage.setItem(queueKey, JSON.stringify(items));
    setPendingEvents(items);
  }, [queueKey]);

  useEffect(() => {
    let shotTimer;
    if (shotClockRunning) {
      shotTimer = setInterval(() => {
        setShotClock((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    }
    return () => clearInterval(shotTimer);
  }, [shotClockRunning]);

  useEffect(() => {
    const ticker = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener('online', connected);
    window.addEventListener('offline', disconnected);
    return () => { window.removeEventListener('online', connected); window.removeEventListener('offline', disconnected); };
  }, []);

  const load = useCallback(async (active = session) => {
    if (!active) return;
    if (!navigator.onLine) {
      setOnline(false);
      return;
    }
    try {
      const result = await scoringAccessService.console(active);
      clockSyncAt.current = Date.now();
      if (clockLoadedFor.current !== result.game.match_id) {
        clockLoadedFor.current = result.game.match_id;
        const seconds = Number(result.game.timer_seconds) || 0;
        setPeriod(result.game.current_period || 'Q1');
        setClockMinutes(String(Math.floor(seconds / 60)));
        setClockSeconds(String(seconds % 60).padStart(2, '0'));
      }
      setData(result);
      const eligiblePlayers = result.players.filter((player) => player.eligibility_status === 'verified' && Number(player.is_present) === 1);
      setSelected((current) => eligiblePlayers.find((player) => player.team_player_id === current?.team_player_id) || eligiblePlayers[0] || null);
      setError('');
    } catch (loadError) {
      if (!loadError.response) {
        setOnline(false);
        setMessage('Connection unavailable. Your scoring session and queued actions are preserved on this device.');
        return;
      }
      setError(loadError.response?.data?.message || 'This scoring session is unavailable.');
      setSession('');
      sessionStorage.removeItem(`fc_score_${token}`);
    }
  }, [session, token]);

  useEffect(() => {
    if (session) load(session);
  }, [session, load]);

  const remainingSeconds = data ? Math.max(0, Number(data.game.timer_seconds || 0) - (Number(data.game.is_timer_running) === 1 ? Math.floor((clockNow - clockSyncAt.current) / 1000) : 0)) : 0;

  useEffect(() => {
    if (!session) return undefined;
    const timer = setInterval(() => load(session), 8000);
    return () => clearInterval(timer);
  }, [session, load]);

  const activate = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await scoringAccessService.activate(token, { operator_name: name, pin, device_id: deviceId });
      sessionStorage.setItem(`fc_score_${token}`, result.session_token);
      setSession(result.session_token);
    } catch (activationError) {
      setError(activationError.response?.data?.message || 'Unable to open this scoring link.');
    } finally {
      setBusy(false);
    }
  };

  const record = async (eventType) => {
    if (!selected || selected.eligibility_status !== 'verified' || Number(selected.is_present) !== 1) return setMessage('Only an eligible, present player can be selected for statistics.');
    const payload = {
      event_uuid: crypto.randomUUID(),
      team_id: selected.team_id,
      team_player_id: selected.team_player_id,
      event_type: eventType,
      period: periodNumber(data.game.current_period),
      game_clock_seconds: remainingSeconds,
    };
    if (!navigator.onLine) {
      saveQueue([...pendingEvents, payload]);
      setMessage(`${eventType.replaceAll('_', ' ')} queued offline for ${selected.full_name}. It will sync when the connection returns.`);
      return;
    }
    setBusy(true);
    try {
      await scoringAccessService.stat(session, payload);
      setMessage(`${eventType.replaceAll('_', ' ')} recorded for ${selected.full_name}.`);
      setLastSavedAt(new Date());
      await load();
    } catch (statError) {
      if (!statError.response) {
        saveQueue([...pendingEvents, payload]);
        setMessage('Connection lost. The statistic was saved on this device and will sync automatically.');
      } else setError(statError.response?.data?.message || 'Unable to record the statistic.');
    } finally {
      setBusy(false);
    }
  };

  const undoLastAction = async () => {
    const last=data?.recent_actions?.[0];
    if(!last||undoBusy)return;
    setUndoBusy(true);setError('');setMessage('');
    try{await scoringAccessService.undoStat(session,last.id);setMessage('Last action removed. The scoreboard and player statistics were corrected.');setLastSavedAt(new Date());await load();}
    catch(undoError){setError(undoError.response?.data?.message||'Unable to undo the last action.');}
    finally{setUndoBusy(false);setPendingUndo(null);}
  };

  const syncPending = useCallback(async () => {
    if (!session || !navigator.onLine || !pendingEvents.length) return;
    const remaining=[];let synced=0;
    for (const payload of pendingEvents) {
      try { await scoringAccessService.stat(session,payload); synced+=1; }
      catch (syncError) { if (!syncError.response) remaining.push(payload); }
    }
    saveQueue(remaining);
    if (synced) { setLastSavedAt(new Date()); setMessage(`${synced} offline statistic${synced===1?'':'s'} synchronized.`); await load(); }
  }, [load, pendingEvents, saveQueue, session]);

  useEffect(() => { if (online && pendingEvents.length) syncPending(); }, [online, pendingEvents.length, syncPending]);

  const submitFinal = async () => {
    if (!data || busy || pendingEvents.length) return;
    setBusy(true);setError('');setMessage('');
    try {
      const result=await scoringAccessService.submitFinal(session);
      setSubmittedFinal(result);setShowFinalReview(false);
      sessionStorage.removeItem(`fc_score_${token}`);
    } catch (finalError) { setError(finalError.response?.data?.message||'Unable to submit the final score.');setShowFinalReview(false); }
    finally { setBusy(false); }
  };

  const openIncident = (type) => {
    setIncidentType(type);
    setIncidentSubject(selected ? `#${selected.jersey_number || '—'} ${selected.full_name} · ${selected.team_name}` : 'Game incident');
    setIncident({ severity: type === 'injury' ? 'medium' : 'high', description: '', action_taken: '' });
  };

  const reportIncident = async () => {
    if (!session || !incidentType || !incident.description.trim() || incidentBusy) return;
    setIncidentBusy(true);setError('');setMessage('');
    try {
      await scoringAccessService.reportIncident(session, { incident_type: incidentType, subject: incidentSubject, ...incident });
      setMessage(`${incidentType === 'injury' ? 'Injury' : 'Fight / misconduct'} report saved and sent to tournament operations.`);
      setIncidentType('');
    } catch (incidentError) {
      setError(incidentError.response?.data?.message || 'Unable to save the incident report.');
    } finally { setIncidentBusy(false); }
  };

  const saveClock = async (event) => {
    event.preventDefault();
    const minutes = Number(clockMinutes);
    const seconds = Number(clockSeconds);
    if (!Number.isInteger(minutes) || !Number.isInteger(seconds) || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      setError('Enter a valid remaining time: minutes and seconds must each be from 0 to 59.');
      return;
    }
    setClockBusy(true);
    setError('');
    setMessage('');
    try {
      const updatedClock = await scoringAccessService.updateClock(session, {
        action: 'start',
        current_period: period,
        minutes,
        seconds,
      });
      clockSyncAt.current = Date.now();
      setData((current) => current ? {
        ...current,
        game: { ...current.game, ...updatedClock, match_status: 'in_progress' },
      } : current);
      setMessage(`${period} clock saved and started at ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.`);
    } catch (clockError) {
      setError(clockError.response?.data?.message || 'Unable to update the game clock.');
    } finally {
      setClockBusy(false);
    }
  };

  const toggleClock = async () => {
    if (!data || clockBusy) return;
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const action = Number(data.game.is_timer_running) === 1 ? 'pause' : 'resume';
    setClockBusy(true);
    setError('');
    setMessage('');
    try {
      const updatedClock = await scoringAccessService.updateClock(session, {
        action,
        current_period: data.game.current_period || period,
        minutes,
        seconds,
      });
      clockSyncAt.current = Date.now();
      setData((current) => current ? { ...current, game: { ...current.game, ...updatedClock } } : current);
      setPeriod(updatedClock.current_period);
      setClockMinutes(String(minutes));
      setClockSeconds(String(seconds).padStart(2, '0'));
      setMessage(action === 'pause' ? `Clock paused at ${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.` : 'Clock resumed.');
    } catch (clockError) {
      setError(clockError.response?.data?.message || 'Unable to control the game clock.');
    } finally {
      setClockBusy(false);
    }
  };

  const teams = useMemo(() => data ? [
    { id: data.game.team1_id, name: data.game.team1_name, score: data.game.team1_score },
    { id: data.game.team2_id, name: data.game.team2_name, score: data.game.team2_score },
  ] : [], [data]);

  if (submittedFinal) return <main className="score-access-page"><section className="score-access-card score-final-success">
    <div className="score-access-topbar"><div className="score-brand"><i className="bi bi-dribbble"/><b>FULLCOURT</b></div><span><i/> SCORE SUBMITTED</span></div>
    <div className="score-final-success-icon"><i className="bi bi-shield-check"/></div><span className="score-kicker">ORGANIZER REVIEW</span><h1>Game recorded.</h1>
    <p>The final score <b>{submittedFinal.team1_score}-{submittedFinal.team2_score}</b> is locked and waiting for the Admin to confirm. Once confirmed, it will appear in Live Games, standings, reports, awards, and share cards.</p>
    <Link className="score-access-home" to="/"><i className="bi bi-arrow-left"/> Return to FullCourt</Link>
  </section></main>;

  if (!session || !data) {
    return <main className="score-access-page"><section className="score-access-card">
      <div className="score-access-topbar"><div className="score-brand"><i className="bi bi-dribbble"/><b>FULLCOURT</b></div><span><i/> SECURE COURTSIDE ACCESS</span></div>
      <div className="score-access-copy">
        <div className="score-access-icon"><i className="bi bi-shield-lock-fill"/></div>
        <span className="score-kicker">INVITED GAME STATISTICIAN</span>
        <h1>Every point.<br/><em>On the record.</em></h1>
        <p>Use the name and private PIN provided by the Admin or Staff Admin to open scoring for this game.</p>
        <div className="score-access-promises"><span><i className="bi bi-lock-fill"/> One-game access</span><span><i className="bi bi-clock-history"/> Time-limited</span><span><i className="bi bi-journal-check"/> Activity recorded</span></div>
      </div>
      <div className="score-access-form-panel">
        <div className="score-form-heading"><span>COURTSIDE SIGN-IN</span><h2>Open your console</h2><p>Enter the access details sent by the tournament staff.</p></div>
        {error && <div className="score-error" role="alert">{error}</div>}
        <form onSubmit={activate}>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name of scorer / statistician" autoComplete="name" required/></label>
          <label>6-digit access PIN<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="\d{6}" placeholder="Enter your 6-digit PIN" autoComplete="one-time-code" required/></label>
          <button disabled={busy || pin.length !== 6}>{busy ? 'Verifying access…' : 'Enter courtside console'} <i className="bi bi-arrow-right"/></button>
        </form>
        <Link className="score-access-home" to="/"><i className="bi bi-arrow-left"/> Return to FullCourt</Link>
      </div>
      <footer className="score-access-footer"><i className="bi bi-shield-check"/><span>Protected game access</span><b>Only an Admin can issue or revoke this link.</b></footer>
    </section></main>;
  }

  const clockDisplay = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  return <main className="courtside-console">
    <header>
      <div className="courtside-brand"><i className="bi bi-dribbble"/><div><b>FULLCOURT</b><span>LIVE SCORING & STATISTICS</span></div></div>
      <div className="courtside-live"><i/> LIVE COURTSIDE</div>
      <div className="courtside-operator"><small>Operator</small><b>{data.operator_name}</b></div>
    </header>
    <div className={`courtside-sync-bar ${online?'is-online':'is-offline'}`} role="status"><span><i className={`bi ${online?'bi-cloud-check':'bi-cloud-slash'}`}/>{online?'Online - game actions are syncing':'Offline - player statistics will queue on this device'}</span><span>{pendingEvents.length?`${pendingEvents.length} waiting to sync`:lastSavedAt?`Last saved ${lastSavedAt.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'})}`:'Ready'}</span>{pendingEvents.length>0&&online&&<button type="button" onClick={syncPending}>Sync now</button>}</div>
    <section className="courtside-scoreboard">
      <article>
        <small>HOME</small>
        <h2>{teams[0]?.name || 'TBD'}</h2>
        <strong>{teams[0]?.score || 0}</strong>
      </article>
      <div className="courtside-clock">
        <span>{data.game.current_period || 'PRE-GAME'}</span>
        <b>{clockDisplay}</b>
        <em>GAME #{data.game.match_id}</em>
      </div>
      <article>
        <small>AWAY</small>
        <h2>{teams[1]?.name || 'TBD'}</h2>
        <strong>{teams[1]?.score || 0}</strong>
      </article>
    </section>

    {/* FIBA Controls: 24s/14s Shot Clock & Alternating Possession Arrow */}
    <div className="courtside-shotclock-box">
      <div className="shotclock-display">
        <span className="shotclock-label">Shot Clock</span>
        <span className={`shotclock-val ${shotClock <= 5 ? 'danger' : ''}`}>{shotClock}s</span>
      </div>
      <div className="shotclock-btn-group">
        <button
          type="button"
          className="shotclock-btn"
          onClick={() => { setShotClock(24); setShotClockRunning(true); }}
        >
          24s Reset
        </button>
        <button
          type="button"
          className="shotclock-btn"
          onClick={() => { setShotClock(14); setShotClockRunning(true); }}
        >
          14s Reset
        </button>
        <button
          type="button"
          className="shotclock-btn"
          onClick={() => setShotClockRunning(!shotClockRunning)}
        >
          {shotClockRunning ? 'Stop' : 'Start'}
        </button>
      </div>

      <div className="possession-arrow-group">
        <span className="shotclock-label">Possession</span>
        <button
          type="button"
          className={`possession-arrow-btn ${possession === 'team1' ? 'active' : ''}`}
          onClick={() => setPossession('team1')}
          title="Possession to Team 1"
        >
          &larr; {teams[0]?.name ? teams[0].name.slice(0, 8) : 'HOME'}
        </button>
        <button
          type="button"
          className={`possession-arrow-btn ${possession === 'team2' ? 'active' : ''}`}
          onClick={() => setPossession('team2')}
          title="Possession to Team 2"
        >
          {teams[1]?.name ? teams[1].name.slice(0, 8) : 'AWAY'} &rarr;
        </button>
      </div>
    </div>
    <section className="courtside-period-board" aria-label="Quarter score breakdown">
      <div className="period-board-label"><span>QUARTER SCORE</span><b>Live breakdown</b></div>
      <div className="period-board-table"><div className="period-board-head"><span>Team</span>{['Q1','Q2','Q3','Q4','OT','Total'].map(label=><b key={label}>{label}</b>)}</div>{teams.map((team,teamIndex)=><div className="period-board-row" key={team.id}><strong>{team.name}</strong>{[1,2,3,4].map(q=><span key={q}>{data.period_scores?.find(row=>Number(row.period)===q)?.[`team${teamIndex+1}_score`]||0}</span>)}<span>{(data.period_scores||[]).filter(row=>Number(row.period)>4).reduce((sum,row)=>sum+Number(row[`team${teamIndex+1}_score`]||0),0)}</span><em>{team.score||0}</em></div>)}</div>
    </section>
    <form className="courtside-clock-editor" onSubmit={saveClock} aria-label="Game period and clock controls">
      <div className="courtside-clock-copy"><span className="score-kicker">GAME CONTROL</span><h3>Quarter &amp; game clock</h3><p>Set the time, then save and start. Pause or resume any time.</p></div>
      <label>Quarter / period<select value={period} onChange={(event) => setPeriod(event.target.value)}>
        <option value="Q1">1st Quarter</option><option value="Q2">2nd Quarter</option><option value="Q3">3rd Quarter</option><option value="Q4">4th Quarter</option>
        <option value="OT1">Overtime 1</option><option value="OT2">Overtime 2</option><option value="OT3">Overtime 3</option><option value="OT4">Overtime 4</option><option value="OT5">Overtime 5</option>
      </select></label>
      <div className="courtside-time-inputs"><label>Minutes<input type="number" min="0" max="59" inputMode="numeric" value={clockMinutes} onChange={(event) => setClockMinutes(event.target.value)} required/></label><span>:</span><label>Seconds<input type="number" min="0" max="59" inputMode="numeric" value={clockSeconds} onChange={(event) => setClockSeconds(event.target.value)} required/></label></div>
      <div className="courtside-clock-actions">
        <button type="submit" disabled={clockBusy}>{clockBusy ? 'Saving…' : <><i className="bi bi-play-fill"/> Save &amp; Start</>}</button>
        <button type="button" className="courtside-clock-toggle" disabled={clockBusy} onClick={toggleClock}>
          {Number(data.game.is_timer_running) === 1 ? <><i className="bi bi-pause-fill"/> Pause</> : <><i className="bi bi-play-fill"/> Resume</>}
        </button>
      </div>
    </form>
    {(message || error) && <div className={`courtside-alert ${error ? 'is-error' : ''}`} role={error ? 'alert' : 'status'}><i className={`bi ${error ? 'bi-exclamation-triangle' : 'bi-check-circle'}`}/>{error || message}<button type="button" onClick={() => { setError(''); setMessage(''); }}>×</button></div>}
    <div className="courtside-workspace">
      <aside className="courtside-roster-picker"><span className="score-kicker">CHOOSE A PLAYER</span><h3>Tap a team, then a player</h3>
        <p className="courtside-roster-help">Both teams are separated below. Tap any cleared player to record a game action.</p>
        <div className="courtside-roster-teams">{teams.map((team) => {
          const roster = data.players.filter((player) => Number(player.team_id) === Number(team.id));
          const available = roster.filter((player) => player.eligibility_status === 'verified' && Number(player.is_present) === 1);
          const unavailable = roster.filter((player) => player.eligibility_status !== 'verified' || Number(player.is_present) !== 1);
          const playerRow = (player) => <div className={`courtside-roster-row ${player.eligibility_status !== 'verified' || Number(player.is_present) !== 1 ? 'is-locked' : ''}`} key={player.team_player_id}>
            <button type="button" disabled={player.eligibility_status !== 'verified' || Number(player.is_present) !== 1} className={`courtside-player-pick ${selected?.team_player_id === player.team_player_id ? 'active' : ''}`} onClick={() => setSelected(player)}>
              <span>#{player.jersey_number || '—'}</span><div><b>{player.full_name}</b><small>{player.position || 'Player'}</small></div>
              {player.eligibility_status !== 'verified' || Number(player.is_present) !== 1
                ? <i className="roster-status">{player.eligibility_status === 'verified' ? 'ABSENT' : (player.eligibility_status || 'PENDING').replaceAll('_', ' ').toUpperCase()}</i>
                : <i className="roster-status is-ready">SELECT</i>}
            </button>
          </div>;
          return <section className="courtside-team-roster" key={team.id}><h4><span>{team.name}</span><small>{available.length} cleared</small></h4>
            <div className="roster-group-heading">PLAYERS <span>{available.length}</span></div>
            {available.length ? available.map(playerRow) : <p className="roster-empty">No cleared players.</p>}
            {!!unavailable.length && <details className="roster-not-cleared"><summary>Not cleared <span>{unavailable.length}</span></summary>{unavailable.map(playerRow)}</details>}
          </section>;
        })}</div>
      </aside>
      <section className="courtside-actions">
        <div className="selected-player"><div><span className="score-kicker">RECORDING FOR</span><h2>{selected ? `#${selected.jersey_number || '—'} ${selected.full_name}` : 'Select a player'}</h2><p>{selected?.team_name || 'Choose an active roster player to begin.'}</p></div><i className="bi bi-person-bounding-box"/></div>
        <div className="courtside-action-heading"><div><span className="score-kicker">COMPLETE GAME STATS</span><p>Record scoring, missed shots, rebounds, assists, defense, turnovers, and fouls for the selected player.</p></div><span className="courtside-stat-ready"><i className="bi bi-grid-3x3-gap-fill"/> All controls ready</span></div>
        <div className="stat-action-grid">{actions.map(([type, mark, label]) => <button type="button" aria-label={label} disabled={busy || !selected} className={type.includes('made') ? 'made' : type.includes('missed') ? 'missed' : ''} onClick={() => record(type)} key={type}><strong>{mark}</strong><span>{label}</span></button>)}</div>
        <section className="courtside-recent"><header><div><span className="score-kicker">ACTION CONTROL</span><h3>Recent game actions</h3></div><button type="button" disabled={undoBusy||!data.recent_actions?.length} onClick={()=>setPendingUndo(data.recent_actions?.[0]||null)}><i className="bi bi-arrow-counterclockwise"/> {undoBusy?'Undoing…':'Undo last action'}</button></header>{data.recent_actions?.length?<ol>{data.recent_actions.slice(0,5).map(action=><li key={action.id}><span><b>{String(action.event_type).replaceAll('_',' ')}</b><small>#{action.jersey_number||'—'} {action.player_name||action.team_name}</small></span><em>Q{Math.min(Number(action.period)||1,4)} · {Math.floor(Number(action.game_clock_seconds||0)/60)}:{String(Number(action.game_clock_seconds||0)%60).padStart(2,'0')}</em></li>)}</ol>:<p>No game actions recorded yet.</p>}</section>
      </section>
    </div>
    <section className="courtside-finalize"><div><span className="score-kicker">END OF GAME</span><h3>Submit the final score</h3><p>Review the scoreboard first. Submission locks scoring until the Admin confirms the official result.</p></div><button type="button" disabled={busy||pendingEvents.length>0||Number(teams[0]?.score)===Number(teams[1]?.score)} onClick={()=>setShowFinalReview(true)}><i className="bi bi-flag-fill"/> Review final score</button>{pendingEvents.length>0&&<small>Sync all pending actions before ending the game.</small>}{Number(teams[0]?.score)===Number(teams[1]?.score)&&<small>A tied score cannot be submitted. Continue to overtime.</small>}</section>
    <section className="courtside-safety courtside-safety-bottom"><div><span className="score-kicker">PLAYER SAFETY</span><h3>Report a game incident</h3><p>Use only when a player is injured or a fight/misconduct happens.</p></div><div><button type="button" className="injury" onClick={()=>openIncident('injury')}><i className="bi bi-bandaid-fill"/> Player injury</button><button type="button" className="fight" onClick={()=>openIncident('misconduct')}><i className="bi bi-shield-exclamation"/> Fight / misconduct</button></div></section>
    <footer><span><i className="bi bi-cloud-check"/> Every action is saved to the FullCourt game log.</span><button type="button" onClick={() => load()}><i className="bi bi-arrow-clockwise"/> Refresh</button></footer>
    {showFinalReview&&<div className="courtside-final-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!busy)setShowFinalReview(false)}}><section className="courtside-final-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-final-title"><span className="score-kicker">FINAL SCORE REVIEW</span><h2 id="guest-final-title">Confirm before submitting</h2><div className="courtside-final-score"><span><small>{teams[0]?.name}</small><b>{teams[0]?.score||0}</b></span><em>FINAL</em><span><small>{teams[1]?.name}</small><b>{teams[1]?.score||0}</b></span></div><p>This will pause the clock, lock the scoring link, and send the result to the Admin for official confirmation.</p><div><button type="button" className="secondary" disabled={busy} onClick={()=>setShowFinalReview(false)}>Go back</button><button type="button" disabled={busy} onClick={submitFinal}>{busy?'Submitting…':'Submit final score'}</button></div></section></div>}
    {incidentType&&<div className="courtside-final-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget&&!incidentBusy)setIncidentType('')}}><section className="courtside-incident-dialog" role="dialog" aria-modal="true" aria-labelledby="incident-dialog-title"><span className="score-kicker">COURTSIDE SAFETY REPORT</span><h2 id="incident-dialog-title">{incidentType==='injury'?'Player injury':'Fight / misconduct'}</h2><p>Save the facts only. Tournament operations will receive this protected report for follow-up.</p><label>Affected player or team<select value={incidentSubject} onChange={event=>setIncidentSubject(event.target.value)}><option value="Game incident">Whole game / multiple people</option>{teams.map(team=><option value={team.name} key={`team-${team.id}`}>{team.name}</option>)}{data.players.map(player=><option value={`#${player.jersey_number||'—'} ${player.full_name} · ${player.team_name}`} key={player.team_player_id}>#{player.jersey_number||'—'} {player.full_name} · {player.team_name}</option>)}</select></label><label>Severity<select value={incident.severity} onChange={event=>setIncident(current=>({...current,severity:event.target.value}))}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical / emergency</option></select></label><label>What happened?<textarea rows="3" value={incident.description} onChange={event=>setIncident(current=>({...current,description:event.target.value}))} placeholder={incidentType==='injury'?'Example: Player landed awkwardly and reported ankle pain.':'Example: Players exchanged punches after a hard foul.'}/></label><label>Immediate action taken<textarea rows="2" value={incident.action_taken} onChange={event=>setIncident(current=>({...current,action_taken:event.target.value}))} placeholder="Example: Game paused; first aid provided; players separated."/></label><div><button type="button" className="secondary" disabled={incidentBusy} onClick={()=>setIncidentType('')}>Cancel</button><button type="button" disabled={incidentBusy||!incident.description.trim()} onClick={reportIncident}>{incidentBusy?'Saving…':'Save incident report'}</button></div></section></div>}
    <ConfirmActionDialog open={Boolean(pendingUndo)} eyebrow="SCORING CORRECTION" title="Undo the last action?" message={pendingUndo ? <><b>{String(pendingUndo.event_type).replaceAll('_',' ')}</b> for {pendingUndo.player_name||pendingUndo.team_name} will be removed and all totals recalculated.</> : null} confirmLabel="Undo action" confirmIcon="bi-arrow-counterclockwise" onCancel={()=>setPendingUndo(null)} onConfirm={undoLastAction}/>
  </main>;
};

export default GuestScoringConsole;
