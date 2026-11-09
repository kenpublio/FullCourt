import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import bracketService from '../services/bracketService';
import tournamentService from '../services/tournamentService';
import teamService from '../services/teamService';
import LoadingSpinner from '../components/LoadingSpinner';
import ConfirmActionDialog from '../components/ConfirmActionDialog';
import '../styles/bracket-engine.css';

const hasTeam = teamId => teamId !== null && teamId !== undefined && teamId !== '' && Number(teamId) > 0;
const isByeMatch = match => {
  const hasTeamOne = hasTeam(match.team1_id);
  const hasTeamTwo = hasTeam(match.team2_id);
  return hasTeam(match.winner_team_id) && hasTeamOne !== hasTeamTwo;
};
const isActualWinner = (match, teamId) => (
  !isByeMatch(match)
  && hasTeam(match.winner_team_id)
  && hasTeam(teamId)
  && Number(match.winner_team_id) === Number(teamId)
);
const isStructuralEmpty = match => (
  match.status === 'cancelled'
  && !hasTeam(match.team1_id)
  && !hasTeam(match.team2_id)
  && !hasTeam(match.winner_team_id)
);

const BracketEngineView = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState('');
  const [bracketData, setBracketData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState([]);
  const [seedOrder, setSeedOrder] = useState([]);
  const [editingSeeds, setEditingSeeds] = useState(false);
  const [savingSeeds, setSavingSeeds] = useState(false);
  const [notice, setNotice] = useState(null);
  const activeTournament = tournaments.find(t => String(t.id) === String(selectedTournament));
  const registeredTeamCount = Number(activeTournament?.registered_teams_count || 0);
  const canGenerate = selectedTournament && registeredTeamCount >= 2;
  const visibleMatches = (bracketData?.matches || []).filter(match => !isStructuralEmpty(match));
  const rounds = [...new Set(visibleMatches.map(match => match.round_number))];
  const completedMatches = visibleMatches.filter(match => match.status === 'completed' && !isByeMatch(match)).length;
  const totalMatches = visibleMatches.filter(match => !isByeMatch(match)).length;
  const matchProgress = totalMatches ? Math.round((completedMatches / totalMatches) * 100) : 0;
  const placementLocked = (bracketData?.matches || []).some(match =>
    ['in_progress','completed'].includes(match.status)
    || Number(match.team1_score || 0) > 0 || Number(match.team2_score || 0) > 0
  );

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
    if (selectedTournament) {
      fetchBracket();
      teamService.getTeamsByTournament(selectedTournament).then(setTeams).catch(() => setTeams([]));
    }
  }, [selectedTournament, fetchBracket]);

  const openSeedEditor = () => {
    if (placementLocked) return;
    const firstRound=[...(bracketData?.matches || [])]
      .filter(match=>Number(match.round_number)===1)
      .sort((a,b)=>Number(a.match_number)-Number(b.match_number));
    const orderedIds=[
      ...firstRound.map(match=>Number(match.team1_id||0)),
      ...firstRound.map(match=>Number(match.team2_id||0)).reverse(),
    ].filter(Boolean);
    const teamById=new Map(teams.map(team=>[Number(team.id),team]));
    const bracketTeams=orderedIds.map(id=>teamById.get(id)).filter(Boolean);
    const missing=teams.filter(team=>!orderedIds.includes(Number(team.id)));
    setSeedOrder([...bracketTeams,...missing]);
    setEditingSeeds(true);
  };

  const moveSeed = (index, direction) => {
    const target=index+direction;
    if(target<0||target>=seedOrder.length)return;
    setSeedOrder(current=>{const next=[...current];[next[index],next[target]]=[next[target],next[index]];return next;});
  };

  const setSeedTeam = (index, teamId) => {
    const selectedIndex=seedOrder.findIndex(team=>String(team.id)===String(teamId));
    if(selectedIndex<0||selectedIndex===index)return;
    setSeedOrder(current=>{const next=[...current];[next[index],next[selectedIndex]]=[next[selectedIndex],next[index]];return next;});
  };

  const saveSeedOrder = async () => {
    if(seedOrder.length!==teams.length)return;
    if(!window.confirm('Save this placement? Draft match schedules and unused scoring links will be recreated.'))return;
    try{
      setSavingSeeds(true);
      const data=await bracketService.saveTeamPlacement(selectedTournament,seedOrder.map(team=>Number(team.id)));
      setBracketData(data);setEditingSeeds(false);
    }catch(error){setNotice(error.response?.data?.message||'Team placement could not be updated.');}
    finally{setSavingSeeds(false);}
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      await bracketService.generateBracket(selectedTournament);
      fetchBracket();
    } catch (err) {
      setNotice(err.response?.data?.message || 'Failed to generate bracket');
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

      {notice&&<ConfirmActionDialog open eyebrow="BRACKET UPDATE" title="Bracket changes are unavailable" message={notice} confirmLabel="Got it" confirmIcon="bi-check2" danger={false} hideCancel onCancel={()=>setNotice(null)} onConfirm={()=>setNotice(null)}/>}      {loading ? (
        <LoadingSpinner message="Building bracket hierarchy..." />
      ) : bracketData?.matches?.length > 0 ? (
        <section className="bracket-engine-board">
          <div className="bracket-board-head"><div><span>LIVE BRACKET</span><h5>{activeTournament?.name}</h5></div><div className="bracket-board-actions"><small><i className="bi bi-arrows-move"></i> Scroll sideways to view every round</small><button type="button" className="btn btn-outline-secondary" onClick={openSeedEditor} disabled={placementLocked||!teams.length} title={placementLocked?'Team placement locks after the first game starts.':'Change the opening bracket placement'}><i className={`bi ${placementLocked?'bi-lock-fill':'bi-shuffle'}`}/>{placementLocked?' Placement locked':' Edit team placement'}</button></div></div>
          <div className="bracket-rounds-track" role="region" aria-label="Tournament bracket rounds. Scroll horizontally to view each round." tabIndex={0}>
            {/* Rounds Column */}
            {rounds.map((r,roundIndex,allRounds) => (
              <div key={r} className={`bracket-round-column ${roundIndex===allRounds.length-1?'is-championship':''}`}>
                <div className="bracket-round-title"><span>{roundIndex===allRounds.length-1?'CHAMPIONSHIP':`ROUND ${r}`}</span><b>{visibleMatches.filter(match=>match.round_number===r).length} match{visibleMatches.filter(match=>match.round_number===r).length!==1?'es':''}</b></div>
                <div className="bracket-round-matches">
                  {visibleMatches.filter(m => m.round_number === r).map(m => {
                    const bye = isByeMatch(m);
                    const complete = m.status === 'completed' && !bye;
                    const teamOneWinner = isActualWinner(m, m.team1_id);
                    const teamTwoWinner = isActualWinner(m, m.team2_id);
                    return (
                      <article key={m.id} className={`bracket-match-card ${complete?'is-complete':''} ${bye?'is-bye':''}`}>
                        <div className="bracket-match-meta"><span>{m.stage_name || `Match #${m.match_number}`}</span><b>{bye?'BYE':complete?'FINAL':(m.status || 'UPCOMING').replaceAll('_',' ')}</b></div>
                        <div className={`bracket-team-row ${teamOneWinner?'is-winner':''} ${bye&&hasTeam(m.team1_id)?'is-advance':''}`}>
                          <i>{(m.team1_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team1_name || 'TBD'}</span><strong>{bye||!hasTeam(m.team1_id)?'—':(m.team1_score ?? '—')}</strong>
                        </div>
                        <div className={`bracket-team-row ${teamTwoWinner?'is-winner':''} ${bye&&hasTeam(m.team2_id)?'is-advance':''}`}>
                          <i>{(m.team2_name || 'TBD').slice(0,2).toUpperCase()}</i><span>{m.team2_name || (bye?'No opponent':'TBD')}</span><strong>{bye||!hasTeam(m.team2_id)?'—':(m.team2_score ?? '—')}</strong>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="bracket-ops-empty"><i className="bi bi-diagram-3"></i><span>{tournaments.length ? 'BRACKET AWAITS' : 'NO COMPETITIONS YET'}</span><h5>{tournaments.length ? 'No bracket generated yet' : 'No tournaments to display'}</h5><p>{tournaments.length ? canGenerate ? 'This tournament is ready. Generate its bracket to create the match path from opening round to championship.' : 'Add at least two approved teams to this tournament before generating seeded matchups.' : 'Once a basketball tournament is created, select it here to build and follow its bracket.'}</p>{tournaments.length > 0 && <button className="btn btn-evsu" onClick={handleGenerate} disabled={!canGenerate || loading}><i className="bi bi-stars me-1"></i> Generate bracket now</button>}</section>
      )}
      {editingSeeds&&createPortal(<div className="bracket-seed-backdrop" role="presentation" onMouseDown={event=>{if(event.target===event.currentTarget)setEditingSeeds(false);}}>
        <section className="bracket-seed-dialog" role="dialog" aria-modal="true" aria-labelledby="seed-editor-title">
          <header><div><span>OPENING MATCHUPS EDITOR</span><h2 id="seed-editor-title">Arrange Round 1</h2><p>Choose a team for every seed. The preview updates immediately so you can confirm every opening matchup before saving.</p></div><button type="button" aria-label="Close team placement editor" onClick={()=>setEditingSeeds(false)}>×</button></header>
          <div className="bracket-seed-warning"><i className="bi bi-exclamation-triangle"/><span>Available only before tip-off. Saving recreates draft matches, schedules, and unused scoring links.</span></div>
          <div className="bracket-draw-workspace">
            <section className="bracket-seed-panel"><div className="bracket-draw-heading"><span>TEAM ORDER</span><small>Choose a team for each numbered slot</small></div><ol className="bracket-seed-list">{seedOrder.map((team,index)=><li key={`${team.id}-${index}`}><b>{index+1}</b><label><span>Slot {index+1}</span><select aria-label={`Team for seed ${index+1}`} value={team.id} onChange={event=>setSeedTeam(index,event.target.value)}>{seedOrder.map(option=><option key={option.id} value={option.id}>{option.team_name}</option>)}</select></label><div><button type="button" aria-label={`Move ${team.team_name} up`} onClick={()=>moveSeed(index,-1)} disabled={index===0}><i className="bi bi-arrow-up"/></button><button type="button" aria-label={`Move ${team.team_name} down`} onClick={()=>moveSeed(index,1)} disabled={index===seedOrder.length-1}><i className="bi bi-arrow-down"/></button></div></li>)}</ol></section>
            <section className="bracket-matchup-preview"><div className="bracket-draw-heading"><span>ROUND 1 PREVIEW</span><small>{Math.floor(seedOrder.length/2)} games · every team competes</small></div><div>{seedOrder.slice(0,Math.ceil(seedOrder.length/2)).map((home,index)=>{const away=seedOrder[seedOrder.length-1-index];if(!away||home.id===away.id)return <article className="is-bye-preview" key={home.id}><span><b>{index+1}</b>{home.team_name}</span><em>BYE</em></article>;return <article key={`${home.id}-${away.id}`}><span><b>{index+1}</b>{home.team_name}</span><i>VS</i><span><b>{seedOrder.length-index}</b>{away.team_name}</span></article>;})}</div><p><i className="bi bi-info-circle"/> Highest seed faces lowest seed. For 10 teams, Round 1 contains five actual games and no auto-advance.</p></section>
          </div>
          <footer><button type="button" className="btn btn-outline-secondary" onClick={()=>setEditingSeeds(false)}>Cancel</button><button type="button" className="btn btn-evsu" onClick={saveSeedOrder} disabled={savingSeeds||seedOrder.length!==teams.length}>{savingSeeds?'Saving matchups…':'Save opening matchups'}</button></footer>
        </section>
      </div>,document.body)}
    </div>
  );
};

export default BracketEngineView;
