import React, { useState, useEffect, useCallback } from 'react';
import scheduleService from '../services/scheduleService';
import tournamentService from '../services/tournamentService';
import eligibilityService from '../services/eligibilityService';
import teamService from '../services/teamService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import '../styles/schedule-optimizer.css';

const ScheduleOptimizerView = () => {
  const { user } = useAuth();
  const isPlayer = user?.role === 'player';
  const isCoach = ['coach','coach_manager'].includes(user?.role);
  const canOptimize = ['platform_admin','admin','organization_admin','tournament_organizer'].includes(user?.role);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [conflicts, setConflicts] = useState({ court_clashes: [], team_clashes: [], venue_violations: [] });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ start: '', court_id: '' });
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

  const fetchSchedule = useCallback(async () => {
    if (!selectedTournament) { setSchedule([]); return; }
    setLoading(true);
    setLoadError('');
    try {
      const data = await scheduleService.getSchedule(selectedTournament);
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

  const handleAutoSchedule = async () => {
    try {
      setLoading(true);
      const startDate = new Date().toLocaleDateString('sv-SE').slice(0, 10);
      const startTime = '08:00:00';
      await scheduleService.autoSchedule(selectedTournament, startDate, startTime);
      await fetchSchedule();
      await fetchConflicts();
    } catch (e) {
      alert(e.response?.data?.message || 'Schedule optimization failed');
    } finally {
      setLoading(false);
    }
  };
  const publish=async()=>{if(!window.confirm('Publish this schedule and notify participants?'))return;try{const response=await scheduleService.publish(selectedTournament);alert(response.message);await fetchSchedule();}catch(e){alert(e.response?.data?.message||'Schedule publication failed.');}};

  const startEdit = (m) => {
    if (m.status === 'completed' || m.status === 'cancelled') return;
    setEditingId(m.id);
    setDraft({
      start: m.scheduled_start_time ? m.scheduled_start_time.slice(0, 16) : '',
      court_id: m.court_id || '',
    });
  };

  const saveSlot = async (m) => {
    if (!window.confirm('Reschedule this match? This checks for conflicts.')) return;
    try {
      const res = await scheduleService.updateSlot(m.id, draft.start, draft.court_id ? Number(draft.court_id) : null);
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

  const totalConflicts = (conflicts.court_clashes || []).length
    + (conflicts.team_clashes || []).length + (conflicts.venue_violations || []).length;
  const scheduledCount=schedule.filter(match=>match.scheduled_start_time).length;
  const scheduleProgress=schedule.length?Math.round((scheduledCount/schedule.length)*100):0;
  const completedCount=schedule.filter(match=>match.status==='completed').length;
  const venueCount=new Set(schedule.map(match=>match.venue_name).filter(Boolean)).size;
  const upcomingCount=schedule.filter(match=>match.status==='scheduled'||match.status==='upcoming').length;

  return (
    <div className="container-fluid p-0 schedule-ops-page">
      <header className="schedule-ops-hero"><div><span>{isPlayer?'MY GAME SCHEDULE':isCoach?'MY TEAM SCHEDULE':'COURT & TIME COMMAND'}</span><h1>{isPlayer||isCoach?'Schedule & Venues':'Schedule Optimization & Venues'}</h1><p>{isPlayer||isCoach?'View only your team’s official game times, venues, courts, and schedule updates.':'Build conflict-free game times, balanced team rest, and reliable court assignments.'}</p><div className="schedule-ops-meta"><span><i className="bi bi-clock-history"/> Balanced rest windows</span><span><i className="bi bi-shield-check"/> Court &amp; team conflict checks</span></div></div>{isPlayer||isCoach?<div className="schedule-ops-assignment"><small>Assigned competition</small><strong>{activeTournament?.name||'No assigned tournament'}</strong><span>Automatically based on your assigned team</span></div>:<label><span>Select tournament</span><select className="form-select" value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}><option value="">Select tournament</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</header>

      <section className="schedule-ops-stats">
        <article className="schedule-coverage-stat"><i className="bi bi-calendar2-check"></i><div><small>Schedule coverage</small><strong>{scheduledCount}<em> / {schedule.length} matches</em></strong><span className="schedule-coverage-track"><i style={{width:`${scheduleProgress}%`}}/></span></div></article>
        <article><i className="bi bi-check2-circle"></i><div><small>Completed</small><strong>{completedCount}</strong></div></article>
        <article><i className="bi bi-geo-alt"></i><div><small>Active venues</small><strong>{venueCount}</strong></div></article>
        {isPlayer?<article><i className="bi bi-clock-history"></i><div><small>Upcoming games</small><strong>{upcomingCount}</strong></div></article>:<article className={totalConflicts?'has-conflict':''}><i className="bi bi-shield-check"></i><div><small>Detected conflicts</small><strong>{totalConflicts}</strong></div></article>}
      </section>

      <section className="schedule-ops-toolbar"><div><span>{isPlayer||isCoach?'TEAM SCHEDULE':'ACTIVE SCHEDULE'}</span><b>{activeTournament?.name||'Select a tournament'}</b></div><div>{canOptimize&&<button className="btn schedule-outline" onClick={fetchConflicts} disabled={!selectedTournament||loading}><i className="bi bi-shield-check"/> Check conflicts</button>}<button className="btn btn-evsu" onClick={canOptimize?handleAutoSchedule:fetchSchedule} disabled={!selectedTournament||loading}><i className={`bi ${canOptimize?'bi-stars':'bi-arrow-clockwise'}`}/> {canOptimize?'Run optimizer':'Refresh schedule'}</button>{canOptimize&&<button className="btn schedule-publish" onClick={publish} disabled={!selectedTournament||loading||!schedule.length}><i className="bi bi-send-check"/> Publish schedule</button>}</div></section>

      {loadError && <div className="alert alert-danger d-flex align-items-center justify-content-between gap-3" role="alert"><span><i className="bi bi-exclamation-triangle-fill me-2"/>{loadError}</span><button className="btn btn-sm btn-outline-danger" onClick={fetchSchedule}>Try again</button></div>}

      {!selectedTournament && !loadError ? (
        <section className="schedule-table-panel text-center py-5"><div className="team-selection-empty"><i className="bi bi-calendar2-x"/><h4>{isPlayer || isCoach ? 'No team tournament yet' : 'No tournaments available'}</h4><p>{isPlayer || isCoach ? 'Your team schedule will show here after your coach joins a tournament and the organizer publishes games.' : 'Create or select a tournament before building its schedule.'}</p>{canOptimize && <a className="btn btn-evsu btn-sm" href="/tournaments"><i className="bi bi-trophy me-1"/>Open tournaments</a>}</div></section>
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
                {schedule.length === 0 ? (
                  <tr><td colSpan={canOptimize ? 6 : 5} className="text-center py-4"><div className="team-selection-empty"><i className="bi bi-calendar2-week"/><h5>{canOptimize ? 'No games scheduled yet' : 'The schedule is not published yet'}</h5><p className="mb-0">{canOptimize ? 'Generate the bracket first, then run the schedule optimizer to create game times and court assignments.' : 'The organizer has not published games for this tournament. Check back later or refresh the schedule.'}</p></div></td></tr>
                ) : schedule.map(s => {
                  const locked = s.status === 'completed' || s.status === 'cancelled';
                  const hasConflict = (conflicts.court_clashes || []).some(c => c.match_ids.includes(s.id))
                    || (conflicts.team_clashes || []).some(c => c.match_ids.includes(s.id));
                  return (
                    <tr key={s.id} className={hasConflict ? 'table-danger' : ''}>
                      <td className="schedule-time">
                        {editingId === s.id ? (
                          <input
                            type="datetime-local"
                            className="form-control form-control-sm"
                            style={{ minWidth: 220 }}
                            value={draft.start}
                            onChange={e => setDraft({ ...draft, start: e.target.value })}
                          />
                        ) : (
                          s.scheduled_start_time ? new Date(s.scheduled_start_time).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : 'Unassigned'
                        )}
                      </td>
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
                         editingId === s.id ? (
                           <>
                             <button className="btn btn-sm btn-success me-1" style={{ borderRadius: 6 }} onClick={() => saveSlot(s)}>Save</button>
                             <button className="btn btn-sm btn-outline-secondary" style={{ borderRadius: 6 }} onClick={() => setEditingId(null)}>Cancel</button>
                           </>
                         ) : (
                           <button className="schedule-edit" onClick={() => startEdit(s)} title="Edit match schedule">
                             <i className="bi bi-pencil-square" /><span>Edit</span>
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
    </div>
  );
};

export default ScheduleOptimizerView;
