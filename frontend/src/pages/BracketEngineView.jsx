import React, { useState, useEffect, useCallback } from 'react';
import bracketService from '../services/bracketService';
import tournamentService from '../services/tournamentService';
import LoadingSpinner from '../components/LoadingSpinner';
import '../styles/bracket-engine.css';

const BracketEngineView = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [bracketData, setBracketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const activeTournament = tournaments.find(t => String(t.id) === String(selectedTournament));
  const registeredTeamCount = Number(activeTournament?.registered_teams_count || 0);
  const canGenerate = selectedTournament && registeredTeamCount >= 2;
  const rounds = [...new Set((bracketData?.matches || []).map(match => match.round_number))];
  const completedMatches = (bracketData?.matches || []).filter(match => match.status === 'completed' || match.winner_team_id).length;
  const totalMatches = bracketData?.matches?.length || 0;
  const matchProgress = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;

  useEffect(() => {
    const load = async () => {
      const res = await tournamentService.getTournaments();
      setTournaments(res.tournaments || []);
      if (res.tournaments?.length > 0) {
        setSelectedTournament(res.tournaments[0].id);
      }
    };
    load();
  }, []);

  const fetchBracket = useCallback(async () => {
    try {
      setLoading(true);
      const data = await bracketService.getBracket(selectedTournament);
      setBracketData(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedTournament]);

  useEffect(() => {
    if (selectedTournament) fetchBracket();
  }, [selectedTournament, fetchBracket]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      await bracketService.generateBracket(selectedTournament);
      fetchBracket();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to generate bracket');
      setLoading(false);
    }
  };

  return (
    <div className="container-fluid p-0 bracket-ops-page">
      <header className="bracket-ops-hero">
        <div className="bracket-ops-title">
          <span>BRACKET &amp; COMPETITION PATH</span>
          <h1>Automated Bracket Engine</h1>
          <p>Build the tournament path, track each matchup, and see who advances to the final.</p>
          <small className="bracket-ops-note"><i className="bi bi-shield-check"/> Only approved teams are included. Winners advance when results are finalized.</small>
        </div>
        <div className="bracket-ops-controls">
          <label><span>Select tournament</span><select className="form-select" value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)} disabled={!tournaments.length}><option value="" disabled>{tournaments.length ? 'Choose a tournament' : 'No tournaments available'}</option>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
          <button className="btn btn-evsu" onClick={handleGenerate} disabled={!canGenerate || loading}><i className="bi bi-stars"></i><span>{loading?'Generating…':'Generate bracket'}</span></button>
        </div>
      </header>

      {activeTournament && (
        <section className="bracket-ops-summary">
          <article><i className="bi bi-trophy"></i><div><small>Format</small><strong>{(activeTournament.format || 'single_elimination').replaceAll('_', ' ')}</strong></div></article>
          <article><i className="bi bi-people"></i><div><small>Registered teams</small><strong>{registeredTeamCount}</strong></div></article>
          <article><i className="bi bi-layers"></i><div><small>Rounds</small><strong>{rounds.length || '—'}</strong></div></article>
          <article className="bracket-progress-stat"><i className="bi bi-check2-circle"></i><div><small>Match progress</small><strong>{completedMatches}<em> / {totalMatches} completed</em></strong><span className="bracket-progress-track"><i style={{width:`${matchProgress}%`}}/></span></div></article>
          {!canGenerate&&<div className="bracket-ops-warning"><i className="bi bi-exclamation-triangle"></i><span>Add at least two registered teams before generating this tournament’s bracket.</span></div>}
        </section>
      )}

      {loading ? (
        <LoadingSpinner message="Building bracket hierarchy..." />
      ) : bracketData?.matches?.length > 0 ? (
        <section className="bracket-engine-board">
          <div className="bracket-board-head"><div><span>LIVE BRACKET</span><h5>{activeTournament?.name}</h5></div><small><i className="bi bi-arrows-move"></i> Scroll sideways to view every round</small></div>
          <div className="bracket-rounds-track" role="region" aria-label="Tournament bracket rounds. Scroll horizontally to view each round." tabIndex={0}>
            {/* Rounds Column */}
            {rounds.map((r,roundIndex,allRounds) => (
              <div key={r} className={`bracket-round-column ${roundIndex===allRounds.length-1?'is-championship':''}`}>
                <div className="bracket-round-title"><span>{roundIndex===allRounds.length-1?'CHAMPIONSHIP':`ROUND ${r}`}</span><b>{bracketData.matches.filter(match=>match.round_number===r).length} match{bracketData.matches.filter(match=>match.round_number===r).length!==1?'es':''}</b></div>
                <div className="bracket-round-matches">
                  {bracketData.matches.filter(m => m.round_number === r).map(m => (
                    <article key={m.id} className={`bracket-match-card ${m.winner_team_id?'is-complete':''}`}>
                      <div className="bracket-match-meta"><span>{m.stage_name || `Match #${m.match_number}`}</span><b>{m.winner_team_id?'FINAL':(m.status || 'UPCOMING').replaceAll('_',' ')}</b></div>
                      <div className={`bracket-team-row ${m.winner_team_id === m.team1_id ? 'is-winner' : ''}`}>
                        <i>{(m.team1_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team1_name || 'TBD'}</span><strong>{m.team1_score ?? '—'}</strong>
                      </div>
                      <div className={`bracket-team-row ${m.winner_team_id === m.team2_id ? 'is-winner' : ''}`}>
                        <i>{(m.team2_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team2_name || 'TBD'}</span><strong>{m.team2_score ?? '—'}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bracket-ops-empty"><i className="bi bi-diagram-3"></i><span>{tournaments.length ? 'BRACKET AWAITS' : 'NO COMPETITIONS YET'}</span><h5>{tournaments.length ? 'No bracket generated yet' : 'No tournaments to display'}</h5><p>{tournaments.length ? canGenerate ? 'This tournament is ready. Generate its bracket to create the match path from opening round to championship.' : 'Add at least two approved teams to this tournament before generating seeded matchups.' : 'Once a basketball tournament is created, select it here to build and follow its bracket.'}</p>{tournaments.length > 0 && <button className="btn btn-evsu" onClick={handleGenerate} disabled={!canGenerate || loading}><i className="bi bi-stars me-1"></i> Generate bracket now</button>}</section>
      )}
    </div>
  );
};

export default BracketEngineView;
