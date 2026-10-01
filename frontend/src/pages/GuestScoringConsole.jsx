import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import scoringAccessService from '../services/scoringAccessService';
import '../styles/scoring-console.css';

const actions = [
  ['2pt_made', '+2', '2PT Made'],
  ['2pt_missed', '2PT', 'Miss'],
  ['3pt_made', '+3', '3PT Made'],
  ['3pt_missed', '3PT', 'Miss'],
  ['ft_made', '+1', 'Free Throw'],
  ['ft_missed', 'FT', 'Miss'],
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
  const [subOut, setSubOut] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [clockBusy, setClockBusy] = useState(false);
  const [subBusy, setSubBusy] = useState(false);
  const [period, setPeriod] = useState('Q1');
  const [clockMinutes, setClockMinutes] = useState('10');
  const [clockSeconds, setClockSeconds] = useState('00');
  const clockLoadedFor = useRef(null);
  const clockSyncAt = useRef(Date.now());
  const [clockNow, setClockNow] = useState(Date.now());

  useEffect(() => {
    const ticker = setInterval(() => setClockNow(Date.now()), 250);
    return () => clearInterval(ticker);
  }, []);

  const load = useCallback(async (active = session) => {
    if (!active) return;
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
      setSubOut((current) => result.players.find((player) => player.team_player_id === current?.team_player_id && player.eligibility_status === 'verified' && Number(player.is_on_court) === 1) || null);
      setError('');
    } catch (loadError) {
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
      const result = await scoringAccessService.activate(token, { operator_name: name, pin });
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
    setBusy(true);
    try {
      await scoringAccessService.stat(session, {
        event_uuid: crypto.randomUUID(),
        team_id: selected.team_id,
        team_player_id: selected.team_player_id,
        event_type: eventType,
        period: periodNumber(data.game.current_period),
        game_clock_seconds: remainingSeconds,
      });
      setMessage(`${eventType.replaceAll('_', ' ')} recorded for ${selected.full_name}.`);
      await load();
    } catch (statError) {
      setError(statError.response?.data?.message || 'Unable to record the statistic.');
    } finally {
      setBusy(false);
    }
  };

  const substitute = async (playerIn) => {
    if (!subOut || !playerIn || subBusy) return;
    setSubBusy(true);
    setError('');
    setMessage('');
    try {
      await scoringAccessService.substitute(session, {
        player_out_id: Number(subOut.team_player_id),
        player_in_id: Number(playerIn.team_player_id),
        current_period: data.game.current_period || period,
        game_clock_seconds: remainingSeconds,
      });
      setMessage(`${subOut.full_name} subbed out; ${playerIn.full_name} subbed in.`);
      setSubOut(null);
      await load();
    } catch (subError) {
      setError(subError.response?.data?.message || 'Unable to record this substitution.');
    } finally {
      setSubBusy(false);
    }
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

  if (!session || !data) {
    return <main className="score-access-page"><section className="score-access-card">
      <div className="score-access-topbar"><div className="score-brand"><i className="bi bi-dribbble"/><b>FULLCOURT</b></div><span><i/> SECURE COURTSIDE ACCESS</span></div>
      <div className="score-access-copy">
        <div className="score-access-icon"><i className="bi bi-shield-lock-fill"/></div>
        <span className="score-kicker">INVITED GAME STATISTICIAN</span>
        <h1>Every point.<br/><em>On the record.</em></h1>
        <p>Use the name and private PIN provided by the competition organizer to open scoring for this game.</p>
        <div className="score-access-promises"><span><i className="bi bi-lock-fill"/> One-game access</span><span><i className="bi bi-clock-history"/> Time-limited</span><span><i className="bi bi-journal-check"/> Activity recorded</span></div>
      </div>
      <div className="score-access-form-panel">
        <div className="score-form-heading"><span>COURTSIDE SIGN-IN</span><h2>Open your console</h2><p>Enter the access details sent by your organizer.</p></div>
        {error && <div className="score-error" role="alert">{error}</div>}
        <form onSubmit={activate}>
          <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="Name of scorer / statistician" autoComplete="name" required/></label>
          <label>6-digit access PIN<input value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" pattern="\d{6}" placeholder="Enter your 6-digit PIN" autoComplete="one-time-code" required/></label>
          <button disabled={busy || pin.length !== 6}>{busy ? 'Verifying access…' : 'Enter courtside console'} <i className="bi bi-arrow-right"/></button>
        </form>
        <Link className="score-access-home" to="/"><i className="bi bi-arrow-left"/> Return to FullCourt</Link>
      </div>
      <footer className="score-access-footer"><i className="bi bi-shield-check"/><span>Protected game access</span><b>Only your organizer can issue or revoke this link.</b></footer>
    </section></main>;
  }

  const clockDisplay = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, '0')}`;

  return <main className="courtside-console">
    <header>
      <div className="courtside-brand"><i className="bi bi-dribbble"/><div><b>FULLCOURT</b><span>LIVE SCORING & STATISTICS</span></div></div>
      <div className="courtside-live"><i/> LIVE COURTSIDE</div>
      <div className="courtside-operator"><small>Operator</small><b>{data.operator_name}</b></div>
    </header>
    <section className="courtside-scoreboard">
      <article><small>HOME</small><h2>{teams[0]?.name || 'TBD'}</h2><strong>{teams[0]?.score || 0}</strong></article>
      <div className="courtside-clock"><span>{data.game.current_period || 'PRE-GAME'}</span><b>{clockDisplay}</b><em>GAME #{data.game.match_id}</em></div>
      <article><small>AWAY</small><h2>{teams[1]?.name || 'TBD'}</h2><strong>{teams[1]?.score || 0}</strong></article>
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
      <aside><span className="score-kicker">GAME ROSTERS</span><h3>Players &amp; substitutions</h3>
        <p className="courtside-roster-help">All roster players are shown. Only verified, present players can be scored.</p>
        {teams.map((team) => {
          const roster = data.players.filter((player) => Number(player.team_id) === Number(team.id));
          const available = roster.filter((player) => player.eligibility_status === 'verified' && Number(player.is_present) === 1);
          const onCourt = available.filter((player) => Number(player.is_on_court) === 1);
          const bench = available.filter((player) => Number(player.is_on_court) !== 1);
          const unavailable = roster.filter((player) => player.eligibility_status !== 'verified' || Number(player.is_present) !== 1);
          const playerRow = (player, location) => <div className={`courtside-roster-row ${player.eligibility_status !== 'verified' || Number(player.is_present) !== 1 ? 'is-locked' : ''}`} key={player.team_player_id}>
            <button type="button" disabled={player.eligibility_status !== 'verified' || Number(player.is_present) !== 1} className={`courtside-player-pick ${selected?.team_player_id === player.team_player_id ? 'active' : ''}`} onClick={() => setSelected(player)}>
              <span>#{player.jersey_number || '—'}</span><div><b>{player.full_name}</b><small>{player.position || 'Player'} · {Math.round((player.seconds_played || 0) / 6) / 10} min</small></div>
              {player.eligibility_status !== 'verified' || Number(player.is_present) !== 1
                ? <i className="roster-status">{player.eligibility_status === 'verified' ? 'ABSENT' : (player.eligibility_status || 'PENDING').replaceAll('_', ' ').toUpperCase()}</i>
                : <i className="roster-status is-ready">{location === 'court' ? 'ON COURT' : 'BENCH'}</i>}
            </button>
            {location === 'court' && player.eligibility_status === 'verified' && <button type="button" className={`roster-sub-action ${subOut?.team_player_id === player.team_player_id ? 'is-selected' : ''}`} disabled={subBusy} onClick={() => setSubOut(subOut?.team_player_id === player.team_player_id ? null : player)}>{subOut?.team_player_id === player.team_player_id ? 'Selected out' : 'Sub out'}</button>}
            {location === 'bench' && player.eligibility_status === 'verified' && <button type="button" className="roster-sub-action is-in" disabled={subBusy || !subOut || Number(subOut.team_id) !== Number(player.team_id)} onClick={() => substitute(player)}>{subBusy ? 'Saving…' : 'Swap in'}</button>}
          </div>;
          return <section className="courtside-team-roster" key={team.id}><h4>{team.name} <small>{available.length} eligible</small></h4>
            <div className="roster-group-heading">ON COURT <span>{onCourt.length}/5</span></div>
            {onCourt.length ? onCourt.map((player) => playerRow(player, 'court')) : <p className="roster-empty">Starting lineup not confirmed yet.</p>}
            <div className="roster-group-heading">BENCH <span>{bench.length}</span></div>
            {bench.length ? bench.map((player) => playerRow(player, 'bench')) : <p className="roster-empty">No eligible bench players.</p>}
            {!!unavailable.length && <><div className="roster-group-heading is-muted">NOT CLEARED <span>{unavailable.length}</span></div>{unavailable.map((player) => playerRow(player, 'locked'))}</>}
          </section>;
        })}
        <p className="courtside-sub-hint">{subOut ? `Choose a bench player from ${subOut.team_name} to complete the substitution.` : 'Choose “Sub out” beside an on-court player to make a substitution.'}</p>
      </aside>
      <section className="courtside-actions">
        <div className="selected-player"><div><span className="score-kicker">RECORDING FOR</span><h2>{selected ? `#${selected.jersey_number || '—'} ${selected.full_name}` : 'Select a player'}</h2><p>{selected?.team_name || 'Choose an active roster player to begin.'}</p></div><i className="bi bi-person-bounding-box"/></div>
        <div className="stat-action-grid">{actions.map(([type, mark, label]) => <button type="button" disabled={busy || !selected} className={type.includes('made') ? 'made' : type.includes('missed') ? 'missed' : ''} onClick={() => record(type)} key={type}><strong>{mark}</strong><span>{label}</span></button>)}</div>
      </section>
    </div>
    <footer><span><i className="bi bi-cloud-check"/> Every action is saved to the FullCourt game log.</span><button type="button" onClick={() => load()}><i className="bi bi-arrow-clockwise"/> Refresh</button></footer>
  </main>;
};

export default GuestScoringConsole;
