import React, { useState, useEffect, useCallback, useMemo } from 'react';
import scheduleService from '../services/scheduleService';
import tournamentService from '../services/tournamentService';
import eligibilityService from '../services/eligibilityService';
import teamService from '../services/teamService';
import venueService from '../services/venueService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import '../styles/schedule-optimizer.css';

const ScheduleOptimizerView = () => {
  const { user } = useAuth();
  const isPlayer = user?.role === 'player';
  const isCoach = ['coach','assistant_coach','coach_manager'].includes(user?.role);
  const canOptimize = ['platform_admin','admin','statistician'].includes(user?.role);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [coachTeamIds, setCoachTeamIds] = useState([]);
  const [scheduleView, setScheduleView] = useState('all');
  const [conflicts, setConflicts] = useState({ court_clashes: [], team_clashes: [], venue_violations: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ start: '', court_id: '', reason: '' });
  const [organizationCourts, setOrganizationCourts] = useState([]);
  const [managerView, setManagerView] = useState('ready');
  const [optimizerDate, setOptimizerDate] = useState('');
  const [optimizerTime, setOptimizerTime] = useState('08:00');
  const [courtCloseTime, setCourtCloseTime] = useState('20:00');
  const [gamesPerDay, setGamesPerDay] = useState('1');
  const [optimizerCourtId, setOptimizerCourtId] = useState('');
  const [showOptimizerSetup, setShowOptimizerSetup] = useState(false);
  const activeTournament=tournaments.find(t=>String(t.id)===String(selectedTournament));

  useEffect(() => {
    const load = async () => {
      setLoadError('');
      try {
        const res = await tournamentService.getTournaments();
        const available = res.tournaments || [];
        if (isPlayer) {
          const membership = await eligibilityService.getMyMembership();
          const tournamentId = membership?.membership?.tournament_id;
          const assigned = available.find(t => String(t.id) === String(tournamentId));
          setTournaments(assigned ? [assigned] : []);
          setSelectedTournament(assigned?.id || '');
          return;
        }
        if (isCoach) {
          const coachTeams = await teamService.getTeams();
          setCoachTeamIds(coachTeams.map(team => Number(team.id)));
          const ids = new Set(coachTeams.map(team => String(team.tournament_id)));
          const assigned = available.filter(t => ids.has(String(t.id)));
          setTournaments(assigned);setSelectedTournament(assigned[0]?.id || '');return;
        }
        setTournaments(available);
        if (available.length > 0) setSelectedTournament(available[0].id);
      } catch (e) {
        setTournaments([]);setSelectedTournament('');
        setLoadError(e.response?.data?.message || 'Could not load your tournament list. Check your connection and try again.');
      }
    };
    load();
  }, [isPlayer, isCoach]);

  useEffect(() => {
    if (!canOptimize) return;
    venueService.getVenues().then((data) => {
      const courts = (data.venues || []).flatMap((venue) => (venue.courts || [])
        .filter((court) => Boolean(Number(court.is_available)))
        .map((court) => ({ ...court, venue_name: venue.name })));
      setOrganizationCourts(courts);
    }).catch(() => setOrganizationCourts([]));
  }, [canOptimize]);

  const fetchSchedule = useCallback(async () => {
    if (!selectedTournament) { setSchedule([]); return; }
    setLoading(true);
    setLoadError('');
    try {
      const data = await scheduleService.getSchedule(selectedTournament, 'all');
      setSchedule(data);
    } catch (e) {
      console.error(e);
      setSchedule([]);
      setLoadError(e.response?.data?.message || 'Could not load the schedule. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedTournament]);

  const fetchConflicts = useCallback(async () => {
    if (!selectedTournament) return;
    try {
      const c = await scheduleService.getConflicts(selectedTournament);
      setConflicts(c);
    } catch (e) {
      console.error(e);
      setLoadError(e.response?.data?.message || 'Could not check schedule conflicts. Try again.');
    }
  }, [selectedTournament]);

  useEffect(() => {
    fetchSchedule();
    if (selectedTournament) fetchConflicts();
    else setConflicts({ court_clashes: [], team_clashes: [], venue_violations: [] });
  }, [selectedTournament, fetchSchedule, fetchConflicts]);

  useEffect(()=>{
    if(!activeTournament)return;
    setOptimizerDate(activeTournament.start_date?.slice(0,10) || new Date().toLocaleDateString('sv-SE').slice(0,10));
    setOptimizerTime(String(activeTournament.schedule_start_time||'08:00').slice(0,5));
    setCourtCloseTime(String(activeTournament.schedule_end_time||'20:00').slice(0,5));
    setGamesPerDay(String(activeTournament.max_games_per_team_per_day||1));
    setOptimizerCourtId(String(activeTournament.schedule_court_id||''));
    setManagerView('ready');
  },[activeTournament]);

  const handleAutoSchedule = async () => {
    try {
      setLoading(true);
      const startDate = optimizerDate || activeTournament?.start_date?.slice(0,10);
      const startTime = `${optimizerTime || '08:00'}:00`;
      if(!startDate){alert('Choose the first game date.');return;}
      if(!optimizerTime||!courtCloseTime||courtCloseTime<=optimizerTime){alert('Court closing time must be later than the first tip-off.');return;}
      if(!optimizerCourtId){alert('Choose the venue and court for this schedule.');return;}
      await scheduleService.saveConstraints(selectedTournament,{max_games_per_team_per_day:Number(gamesPerDay)||1,min_rest_minutes_between_games:120,default_match_duration_minutes:90,default_break_minutes:15,daily_start_time:optimizerTime,daily_end_time:courtCloseTime,court_id:Number(optimizerCourtId)});
      await scheduleService.autoSchedule(selectedTournament, startDate, startTime);
      await fetchSchedule();
      await fetchConflicts();
      const res=await tournamentService.getTournaments();
      setTournaments(res.tournaments||[]);
      setShowOptimizerSetup(false);
    } catch (e) {
      alert(e.response?.data?.message || 'Schedule optimization failed');
    } finally {
      setLoading(false);
    }
  };
  const saveOptimizerSetup = async () => {
    if(!optimizerDate){alert('Choose the first game date.');return;}
    if(!optimizerTime||!courtCloseTime||courtCloseTime<=optimizerTime){alert('Court closing time must be later than the first tip-off.');return;}
    if(!optimizerCourtId){alert('Choose the venue and court for this schedule.');return;}
    try{
      setLoading(true);
      await scheduleService.saveConstraints(selectedTournament,{max_games_per_team_per_day:Number(gamesPerDay)||1,min_rest_minutes_between_games:120,default_match_duration_minutes:90,default_break_minutes:15,daily_start_time:optimizerTime,daily_end_time:courtCloseTime,court_id:Number(optimizerCourtId)});
      const res=await tournamentService.getTournaments();
      setTournaments(res.tournaments||[]);
      setShowOptimizerSetup(false);
    }catch(error){alert(error.response?.data?.message||'Could not save the optimizer setup.');}
    finally{setLoading(false);}
  };
  const publish=async()=>{if(!window.confirm('Publish this schedule and notify participants?'))return;try{const response=await scheduleService.publish(selectedTournament);alert(response.message);await fetchSchedule();}catch(e){alert(e.response?.data?.message||'Schedule publication failed.');}};

  const startEdit = (m) => {
    if (m.status === 'completed' || m.status === 'cancelled') return;
    setEditingId(m.id);
    setDraft({
      start: m.scheduled_start_time ? m.scheduled_start_time.slice(0, 16) : '',
      court_id: m.court_id || '',
      reason: '',
    });
  };

  const saveSlot = async (m) => {
    const reason=draft.reason.trim();
    if(!draft.start){alert('Choose the new game date and time.');return;}
    if(!draft.court_id){alert('Choose the new venue and court.');return;}
    if(reason.length<5){alert('Add a short reason before saving the schedule change.');return;}
    if (!window.confirm('Save this game time and venue? FullCourt will check conflicts and notify affected Coaches.')) return;
    try {
      const res = await scheduleService.updateSlot(m.id, draft.start, draft.court_id ? Number(draft.court_id) : null,reason.trim());
      const conflicts = res?.data?.conflicts || res?.conflicts || [];
      if (conflicts.length || res?.data?.scheduled === false) {
        alert('Reschedule blocked by conflicts:\n' + JSON.stringify(conflicts, null, 2));
      } else {
        alert(`${res?.message || 'Match slot updated.'} (${res?.data?.participants_notified || 0} in-app notifications sent).`);
        fetchSchedule();
        fetchConflicts();
      }
    } catch (e) {
      const conflictDetails = e.response?.data?.data?.conflicts;
      alert(conflictDetails?.length
        ? `${e.response?.data?.message || 'Reschedule blocked by conflicts.'}\n${conflictDetails.map(item => `${item.type}${item.match_id ? ` with game #${item.match_id}` : ''}`).join('\n')}`
        : e.response?.data?.message || 'Reschedule failed. Check your connection and try again.');
    } finally {
      setEditingId(null);
    }
  };

  const activeSchedule = useMemo(()=>schedule.filter(match=>match.status!=='cancelled'),[schedule]);
  const visibleSchedule = useMemo(() => {
    let rows=activeSchedule;
    if (isCoach) rows=rows.filter(match=>Boolean(match.team1_id&&match.team2_id));
    if (isCoach && scheduleView !== 'all') {
      const assigned = new Set(coachTeamIds);
      rows=rows.filter(match => assigned.has(Number(match.team1_id)) || assigned.has(Number(match.team2_id)));
    }
    if(canOptimize)rows=rows.filter(match=>managerView==='future'?!match.team1_id||!match.team2_id:Boolean(match.team1_id&&match.team2_id));
    return rows;
  }, [activeSchedule, isCoach, scheduleView, coachTeamIds, canOptimize, managerView]);
  const totalConflicts = (conflicts.court_clashes || []).length
    + (conflicts.team_clashes || []).length + (conflicts.venue_violations || []).length;
  const scheduledCount=visibleSchedule.filter(match=>match.scheduled_start_time).length;
  const scheduleProgress=visibleSchedule.length?Math.round((scheduledCount/visibleSchedule.length)*100):0;
  const completedCount=visibleSchedule.filter(match=>match.status==='completed').length;
  const venueCount=new Set(visibleSchedule.map(match=>match.venue_name).filter(Boolean)).size;
  const upcomingCount=visibleSchedule.filter(match=>match.status==='scheduled'||match.status==='upcoming').length;
  const readyCount=activeSchedule.filter(match=>match.team1_id&&match.team2_id).length;
  const futureCount=activeSchedule.filter(match=>!match.team1_id||!match.team2_id).length;
  const publishableCount=activeSchedule.filter(match=>match.team1_id&&match.team2_id&&match.scheduled_start_time&&match.court_id).length;
  const editableMatch=schedule.find(match=>Number(match.id)===Number(editingId));

  return (
    <div className="container-fluid p-0 schedule-ops-page">
      <header className="schedule-ops-hero"><div><span>{isPlayer?'MY GAME SCHEDULE':isCoach?'TOURNAMENT SCHEDULE':'SCHEDULE CONTROL'}</span><h1>{isPlayer||isCoach?'Schedule & Venues':'Game Schedule & Venue Assignment'}</h1><p>{isCoach?'View every official game in your tournament, then switch to your team-only schedule when needed.':isPlayer?'View your team’s official game times, venues, courts, and schedule updates.':'Choose a tournament, review its matchups, then assign conflict-free game times and courts.'}</p></div>{isPlayer||isCoach?<div className="schedule-ops-assignment"><small>Assigned competition</small><strong>{activeTournament?.name||'No assigned tournament'}</strong><span>Automatically based on your assigned team</span></div>:<label><span>Select tournament</span><select className="form-select" value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}><option value="">Select tournament</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</header>

      {!isCoach && <section className="schedule-ops-stats">
        <article className="schedule-coverage-stat"><i className="bi bi-calendar2-check"></i><div><small>Schedule coverage</small><strong>{scheduledCount}<em> / {visibleSchedule.length} matches</em></strong><span className="schedule-coverage-track"><i style={{width:`${scheduleProgress}%`}}/></span></div></article>
        <article><i className="bi bi-check2-circle"></i><div><small>Completed</small><strong>{completedCount}</strong></div></article>
        <article><i className="bi bi-geo-alt"></i><div><small>Active venues</small><strong>{venueCount}</strong></div></article>
        {isPlayer?<article><i className="bi bi-clock-history"></i><div><small>Upcoming games</small><strong>{upcomingCount}</strong></div></article>:<article className={totalConflicts?'has-conflict':''}><i className="bi bi-shield-check"></i><div><small>Detected conflicts</small><strong>{totalConflicts}</strong></div></article>}
      </section>}

      {canOptimize&&selectedTournament&&<section className="schedule-run-panel"><div className="schedule-run-copy"><span><i className="bi bi-stars"/></span><div><small>STEP 1 · BUILD PLAYABLE SLOTS</small><h2>Schedule ready matchups</h2><p>{readyCount} confirmed games. Review the venue, court hours, first game date, and daily limit before running the optimizer.</p><div className="schedule-run-summary"><span><i className="bi bi-geo-alt-fill"/>{activeTournament?.schedule_venue_name||'Venue not selected'} · {activeTournament?.schedule_court_name||'Court not selected'}</span><span><i className="bi bi-clock-fill"/>{optimizerTime}–{courtCloseTime}</span><span><i className="bi bi-calendar2-check-fill"/>Max {gamesPerDay} game{Number(gamesPerDay)===1?'':'s'} per team/day</span></div></div></div><button type="button" className="schedule-configure-button" onClick={()=>setShowOptimizerSetup(true)} disabled={loading}><i className="bi bi-sliders2"/> Configure optimizer</button></section>}

      <section className="schedule-ops-toolbar"><div><span>{isCoach?(scheduleView==='all'?'FULL TOURNAMENT SCHEDULE':'MY TEAM SCHEDULE'):isPlayer?'TEAM SCHEDULE':managerView==='ready'?'READY MATCHUPS':'FUTURE BRACKET ROUNDS'}</span><b>{activeTournament?.name||'Select a tournament'}</b></div><div>{isCoach&&<div className="btn-group schedule-view-toggle" role="group" aria-label="Choose schedule view"><button type="button" className={`btn ${scheduleView==='all'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setScheduleView('all')}><i className="bi bi-calendar3"/> All games <span className="badge text-bg-light">{activeSchedule.length}</span></button><button type="button" className={`btn ${scheduleView==='mine'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setScheduleView('mine')}><i className="bi bi-people-fill"/> My team <span className="badge text-bg-light">{activeSchedule.filter(match=>coachTeamIds.includes(Number(match.team1_id))||coachTeamIds.includes(Number(match.team2_id))).length}</span></button></div>}{canOptimize&&<div className="btn-group schedule-view-toggle" role="group" aria-label="Choose bracket schedule stage"><button type="button" className={`btn ${managerView==='ready'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setManagerView('ready')}><i className="bi bi-people-fill"/> Ready games <span className="badge text-bg-light">{readyCount}</span></button><button type="button" className={`btn ${managerView==='future'?'btn-dark':'btn-outline-secondary'}`} onClick={()=>setManagerView('future')}><i className="bi bi-diagram-3"/> Future rounds <span className="badge text-bg-light">{futureCount}</span></button></div>}{canOptimize&&<button className="btn schedule-outline" onClick={fetchConflicts} disabled={!selectedTournament||loading}><i className="bi bi-shield-check"/> Check conflicts</button>}<button className="btn btn-outline-secondary" onClick={fetchSchedule} disabled={!selectedTournament||loading}><i className="bi bi-arrow-clockwise"/> Refresh</button>{canOptimize&&<button className="btn schedule-publish" onClick={publish} disabled={!selectedTournament||loading||!publishableCount}><i className="bi bi-send-check"/> Publish schedule</button>}</div></section>

      {loadError && <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert"><span><i className="bi bi-exclamation-triangle-fill me-2"/>{loadError}</span><button className="btn btn-sm btn-outline-danger" onClick={fetchSchedule}>Try again</button></div>}

      {!selectedTournament && !loadError ? (
        <section className="schedule-table-panel text-center py-5"><div className="team-selection-empty"><i className="bi bi-calendar2-x"/><h4>{isPlayer || isCoach ? 'No team tournament yet' : 'No tournaments available'}</h4><p>{isPlayer || isCoach ? 'Your team schedule will show here after your team joins and the Admin publishes the games.' : 'Create or select a tournament before building its schedule.'}</p>{canOptimize && <a className="btn btn-evsu btn-sm" href="/tournaments"><i className="bi bi-trophy me-1"/>Open tournaments</a>}</div></section>
      ) : loading ? (
        <LoadingSpinner message={canOptimize ? 'Optimizing match timetable...' : 'Refreshing match schedule...'} />
      ) : (
        <section className="schedule-table-panel">
          <div className="table-responsive" role="region" aria-label="Basketball game schedule table" tabIndex={0}>
            <table className="table align-middle mb-0 schedule-table">
              <thead className="table-light">
                <tr>
                  <th>Scheduled Time</th>
                  <th>Match</th>
                  <th>Teams</th>
                  <th>Venue &amp; Court</th>
                  <th>Status</th>
                  {canOptimize && <th className="text-end">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {visibleSchedule.length === 0 ? (
                  <tr><td colSpan={canOptimize ? 6 : 5} className="text-center py-4"><div className="team-selection-empty"><i className="bi bi-calendar2-week"/><h5>{canOptimize ? 'No games scheduled yet' : 'The schedule is not published yet'}</h5><p className="mb-0">{canOptimize ? 'Generate the bracket first, then run the schedule optimizer to create game times and court assignments.' : 'The Admin has not published games for this tournament. Check back later or refresh the schedule.'}</p></div></td></tr>
                ) : visibleSchedule.map(s => {
                  const locked = ['in_progress','completed','cancelled'].includes(s.status);
                  const hasConflict = (conflicts.court_clashes || []).some(c => c.match_ids.includes(s.id))
                    || (conflicts.team_clashes || []).some(c => c.match_ids.includes(s.id));
                  return (
                    <tr key={s.id} className={`${hasConflict ? 'table-danger' : ''} ${editingId === s.id ? 'is-editing' : ''}`}>
                      <td className="schedule-time">{s.scheduled_start_time ? new Date(s.scheduled_start_time).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : 'Unassigned'}</td>
                      <td><span className="schedule-stage">{s.stage_name || `Round ${s.round_number}`}</span></td>
                      <td><div className="schedule-matchup"><strong>{s.team1_name || 'TBD'}</strong><span>vs</span><strong>{s.team2_name || 'TBD'}</strong></div></td>
                      <td><div className="schedule-venue"><i className="bi bi-geo-alt"></i><span>{s.court_name || 'Unassigned Court'}<small>{s.venue_name || 'Venue TBA'}</small></span></div></td>
                      <td>
                        <span className={`schedule-status ${s.status}`}>
                          {s.status}
                        </span>
                        {hasConflict && <span className="badge bg-warning text-dark ms-1" style={{ fontSize: '0.65rem' }}>conflict</span>}
                      </td>
                      {canOptimize && <td className="text-end small">
                        {locked ? <i className="bi bi-lock-fill text-muted" title="Completed matches cannot be rescheduled" /> :
                         (
                           <button className="schedule-edit" onClick={() => startEdit(s)} title="Change game time, venue, or court">
                             <i className="bi bi-pencil-square" /><span>Change time / venue</span>
                           </button>
                         )}
                      </td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {canOptimize && totalConflicts > 0 && (
            <div className="schedule-conflicts">
              <h6 className="fw-bold mb-2 text-danger"><i className="bi bi-exclamation-octagon me-1" />Detected schedule conflicts</h6>
              <ul className="list-unstyled small mb-0">
                {conflicts.team_clashes.map((c, i) => (
                  <li key={`tc-${i}`} className="mb-1">Team clash between matches {c.match_ids.join(' & ')} (team {c.team_id}, ~{Math.round(c.overlap_minutes)} min overlap)</li>
                ))}
                {conflicts.court_clashes.map((c, i) => (
                  <li key={`cc-${i}`} className="mb-1">Court clash between matches {c.match_ids.join(' & ')} (court {c.court_id})</li>
                ))}
                {conflicts.venue_violations.map((c, i) => (
                  <li key={`vv-${i}`} className="mb-1">Venue {c.venue_id} unavailable on {c.date}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
      {canOptimize&&showOptimizerSetup&&<div className="schedule-setup-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setShowOptimizerSetup(false);}}><section className="schedule-setup-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-setup-title"><header><div><span>SCHEDULE OPTIMIZER</span><h2 id="schedule-setup-title">Build the playable game slots</h2><p>Set the court, available hours, and daily workload before FullCourt places the ready matchups.</p></div><button type="button" aria-label="Close optimizer settings" onClick={()=>setShowOptimizerSetup(false)}>×</button></header><div className="schedule-setup-form"><label className="full"><span>Venue &amp; court</span><select value={optimizerCourtId} onChange={event=>setOptimizerCourtId(event.target.value)}><option value="">Choose the court to use</option>{organizationCourts.map(court=><option key={court.id} value={court.id}>{court.venue_name} — {court.court_name}</option>)}</select><small>This becomes the default court for newly optimized games. Existing game assignments can still be changed individually.</small></label><label><span>First game date</span><input type="date" value={optimizerDate} onChange={event=>setOptimizerDate(event.target.value)}/></label><label><span>First tip-off</span><input type="time" value={optimizerTime} onChange={event=>setOptimizerTime(event.target.value)}/></label><label><span>Court available until</span><input type="time" value={courtCloseTime} onChange={event=>setCourtCloseTime(event.target.value)}/></label><label><span>Games per team / day</span><select value={gamesPerDay} onChange={event=>setGamesPerDay(event.target.value)}>{[1,2,3,4].map(value=><option key={value} value={value}>{value} game{value===1?'':'s'}</option>)}</select></label><div className="schedule-setup-note full"><i className="bi bi-shield-check"/><span><b>Conflict checks stay active</b><small>FullCourt will respect court availability, avoid overlapping teams, and preserve the configured rest window.</small></span></div></div><footer><button type="button" className="btn btn-outline-secondary" onClick={()=>setShowOptimizerSetup(false)}>Cancel</button><button type="button" className="btn schedule-save-settings" onClick={saveOptimizerSetup} disabled={loading||!optimizerCourtId}><i className="bi bi-check2"/> Save settings</button><button type="button" className="btn btn-evsu" onClick={handleAutoSchedule} disabled={loading||!optimizerCourtId||!readyCount}><i className="bi bi-stars"/> Save &amp; run optimizer</button></footer></section></div>}
      {canOptimize&&editableMatch&&<div className="schedule-edit-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditingId(null);}}><section className="schedule-edit-dialog" role="dialog" aria-modal="true" aria-labelledby="schedule-edit-title"><header><div><span>EDIT GAME SLOT</span><h2 id="schedule-edit-title">Change time or venue</h2><p>{editableMatch.team1_name||'TBD'} <b>vs</b> {editableMatch.team2_name||'TBD'} · {editableMatch.stage_name}</p></div><button type="button" aria-label="Close schedule editor" onClick={()=>setEditingId(null)}>×</button></header><div className="schedule-edit-form"><label><span>Game date &amp; time</span><input type="datetime-local" value={draft.start} onChange={event=>setDraft({...draft,start:event.target.value})}/></label><label><span>Venue &amp; court</span><select value={draft.court_id} onChange={event=>setDraft({...draft,court_id:event.target.value})}><option value="">Choose venue and court</option>{organizationCourts.map(court=><option key={court.id} value={court.id}>{court.venue_name} — {court.court_name}</option>)}</select></label><label className="full"><span>Reason for the change</span><textarea rows="3" value={draft.reason} onChange={event=>setDraft({...draft,reason:event.target.value})} placeholder="Example: Venue requested a later tip-off time"/></label><div className="schedule-notify-note full"><i className="bi bi-bell-fill"/><span><b>Coaches will be notified</b><small>FullCourt checks court, team, and rest conflicts before saving.</small></span></div></div><footer><button type="button" className="btn btn-outline-secondary" onClick={()=>setEditingId(null)}>Cancel</button><button type="button" className="btn btn-evsu" onClick={()=>saveSlot(editableMatch)}><i className="bi bi-check2-circle me-2"/>Save &amp; notify</button></footer></section></div>}
    </div>
  );
};

export default ScheduleOptimizerView;
