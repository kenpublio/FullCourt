import React, { useState, useEffect, useCallback } from 'react';
import scheduleService from '../services/scheduleService';
import tournamentService from '../services/tournamentService';
import LoadingSpinner from '../components/LoadingSpinner';
import { useAuth } from '../hooks/useAuth';
import '../styles/schedule-optimizer.css';

const ScheduleOptimizerView = () => {
  const { user } = useAuth();
  const canOptimize = ['platform_admin','admin','organization_admin','tournament_organizer'].includes(user?.role);
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [schedule, setSchedule] = useState([]);
  const [conflicts, setConflicts] = useState({ court_clashes: [], team_clashes: [], venue_violations: [] });
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ start: '', court_id: '' });
  const activeTournament=tournaments.find(t=>String(t.id)===String(selectedTournament));

  useEffect(() => {
    const load = async () => {
      const res = await tournamentService.getTournaments();
      setTournaments(res.tournaments || []);
      if (res.tournaments?.length > 0) setSelectedTournament(res.tournaments[0].id);
    };
    load();
  }, []);

  const fetchSchedule = useCallback(async () => {
    if (!selectedTournament) return;
    setLoading(true);
    try {
      const data = await scheduleService.getSchedule(selectedTournament);
      setSchedule(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [selectedTournament]);

  const fetchConflicts = async () => {
    try {
      const c = await scheduleService.getConflicts(selectedTournament);
      setConflicts(c);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchSchedule();
  }, [selectedTournament, fetchSchedule]);

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
      if (res?.conflicts?.length) {
        alert('Reschedule blocked by conflicts:\n' + JSON.stringify(res.conflicts, null, 2));
      } else {
        alert('Match slot updated.');
        fetchSchedule();
        fetchConflicts();
      }
    } catch (e) {
      alert(e.response?.data?.message || 'Reschedule failed');
    } finally {
      setEditingId(null);
    }
  };

  const totalConflicts = (conflicts.court_clashes || []).length
    + (conflicts.team_clashes || []).length + (conflicts.venue_violations || []).length;
  const scheduledCount=schedule.filter(match=>match.scheduled_start_time).length;
  const completedCount=schedule.filter(match=>match.status==='completed').length;
  const venueCount=new Set(schedule.map(match=>match.venue_name).filter(Boolean)).size;

  return (
    <div className="container-fluid p-0 schedule-ops-page">
      <header className="schedule-ops-hero"><div><span>COURT &amp; TIME COMMAND</span><h3>Schedule Optimization &amp; Venues</h3><p>Build conflict-free game times, balanced team rest, and reliable court assignments.</p></div><label><span>Select tournament</span><select className="form-select" value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name} ({t.sport_name})</option>)}</select></label></header>

      <section className="schedule-ops-stats">
        <article><i className="bi bi-calendar2-check"></i><div><small>Scheduled matches</small><strong>{scheduledCount}/{schedule.length}</strong></div></article>
        <article><i className="bi bi-check2-circle"></i><div><small>Completed</small><strong>{completedCount}</strong></div></article>
        <article><i className="bi bi-geo-alt"></i><div><small>Active venues</small><strong>{venueCount}</strong></div></article>
        <article className={totalConflicts?'has-conflict':''}><i className="bi bi-shield-check"></i><div><small>Detected conflicts</small><strong>{totalConflicts}</strong></div></article>
      </section>

      <section className="schedule-ops-toolbar"><div><span>ACTIVE SCHEDULE</span><b>{activeTournament?.name||'Select a tournament'}</b></div><div>{canOptimize&&<button className="btn schedule-outline" onClick={fetchConflicts}><i className="bi bi-exclamation-triangle"/> Detect conflicts</button>}<button className="btn btn-evsu" onClick={canOptimize?handleAutoSchedule:fetchSchedule} disabled={loading}><i className={`bi ${canOptimize?'bi-stars':'bi-arrow-clockwise'}`}/> {canOptimize?'Run optimizer':'Refresh schedule'}</button>{canOptimize&&<button className="btn schedule-publish" onClick={publish} disabled={loading||!schedule.length}><i className="bi bi-send-check"/> Publish schedule</button>}</div></section>

      {loading ? (
        <LoadingSpinner message={canOptimize ? 'Optimizing match timetable...' : 'Refreshing match schedule...'} />
      ) : (
        <section className="schedule-table-panel">
          <div className="table-responsive">
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
                  <tr><td colSpan={canOptimize ? 6 : 5} className="text-center py-4 text-muted">{canOptimize ? 'No scheduled matches yet. Click "Run Optimizer".' : 'No scheduled matches are available yet.'}</td></tr>
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
