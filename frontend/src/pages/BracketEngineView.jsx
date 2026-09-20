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
          <span>TOURNAMENT STRUCTURE</span>
          <h3>Automated Bracket Engine</h3>
          <p>Generate seeded matchups and follow every team’s path to the championship.</p>
        </div>
        <div className="bracket-ops-controls">
          <label><span>Select tournament</span><select className="form-select" value={selectedTournament} onChange={e => setSelectedTournament(e.target.value)}>{tournaments.map(t => <option key={t.id} value={t.id}>{t.name} — {t.sport_name}</option>)}</select></label>
          <button className="btn btn-evsu" onClick={handleGenerate} disabled={!canGenerate || loading}><i className="bi bi-stars"></i><span>{loading?'Generating…':'Generate bracket'}</span></button>
        </div>
      </header>

      {activeTournament && (
        <section className="bracket-ops-summary">
          <article><i className="bi bi-trophy"></i><div><small>Format</small><strong>{(activeTournament.format || 'single_elimination').replaceAll('_', ' ')}</strong></div></article>
          <article><i className="bi bi-people"></i><div><small>Registered teams</small><strong>{registeredTeamCount}</strong></div></article>
          <article><i className="bi bi-layers"></i><div><small>Rounds</small><strong>{rounds.length || '—'}</strong></div></article>
          <article><i className="bi bi-check2-circle"></i><div><small>Match progress</small><strong>{completedMatches}/{bracketData?.matches?.length || 0}</strong></div></article>
          {!canGenerate&&<div className="bracket-ops-warning"><i className="bi bi-exclamation-triangle"></i><span>Add at least two registered teams before generating this tournament’s bracket.</span></div>}
        </section>
      )}

      {loading ? (
        <LoadingSpinner message="Building bracket hierarchy..." />
      ) : bracketData?.matches?.length > 0 ? (
        <section className="bracket-engine-board">
          <div className="bracket-board-head"><div><span>LIVE BRACKET</span><h5>{activeTournament?.name}</h5></div><small><i className="bi bi-arrows-move"></i> Scroll sideways to view every round</small></div>
          <div className="bracket-rounds-track">
            {/* Rounds Column */}
            {rounds.map((r,roundIndex,allRounds) => (
              <div key={r} className={`bracket-round-column ${roundIndex===allRounds.length-1?'is-championship':''}`}>
                <div className="bracket-round-title"><span>{roundIndex===allRounds.length-1?'CHAMPIONSHIP':`ROUND ${r}`}</span><b>{bracketData.matches.filter(match=>match.round_number===r).length} match{bracketData.matches.filter(match=>match.round_number===r).length!==1?'es':''}</b></div>
                <div className="bracket-round-matches">
                  {bracketData.matches.filter(m => m.round_number === r).map(m => (
                    <article key={m.id} className={`bracket-match-card ${m.winner_team_id?'is-complete':''}`}>
                      <div className="bracket-match-meta"><span>{m.stage_name || `Match #${m.match_number}`}</span><b>{m.winner_team_id?'FINAL':(m.status || 'UPCOMING').replaceAll('_',' ')}</b></div>
                      <div className={`bracket-team-row ${m.winner_team_id === m.team1_id ? 'is-winner' : ''}`}>
                        <i>{(m.team1_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team1_name || 'TBD'}</span><strong>{m.team1_score ?? 0}</strong>
                      </div>
                      <div className={`bracket-team-row ${m.winner_team_id === m.team2_id ? 'is-winner' : ''}`}>
                        <i>{(m.team2_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team2_name || 'TBD'}</span><strong>{m.team2_score ?? 0}</strong>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bracket-ops-empty"><i className="bi bi-diagram-3"></i><span>BRACKET AWAITS</span><h5>No bracket generated yet</h5><p>Select a tournament with at least two registered teams, then build its seeded matchups.</p><button className="btn btn-evsu" onClick={handleGenerate} disabled={!canGenerate}><i className="bi bi-stars me-1"></i> Generate bracket now</button></section>
      )}
    </div>
  );
};

export default BracketEngineView;
