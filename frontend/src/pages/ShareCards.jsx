import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import publicService from '../services/publicService';
import engagementService from '../services/engagementService';
import gameOperationsService from '../services/gameOperationsService';
import '../styles/share-cards.css';

const CARD_TYPES = [
  { value: 'final_score', label: 'Final score', icon: 'bi-trophy' },
  { value: 'standings', label: 'Tournament standings', icon: 'bi-bar-chart-line' },
  { value: 'player', label: 'Player spotlight', icon: 'bi-person-bounding-box' },
  { value: 'player_of_game', label: 'Player of the Game', icon: 'bi-stars' },
  { value: 'award', label: 'Award winner', icon: 'bi-award' },
];

const ShareCards = () => {
  const canvasRef = useRef(null);
  const [data, setData] = useState({ tournaments: [], matches: [], standings: [] });
  const [type, setType] = useState('final_score');
  const [tournamentId, setTournamentId] = useState('');
  const [matchId, setMatchId] = useState('');
  const [awards, setAwards] = useState([]);
  const [boxScore, setBoxScore] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    publicService.getPortal()
      .then((result) => {
        if (!active) return;
        setData({ tournaments: result.tournaments || [], matches: result.matches || [], standings: result.standings || [] });
        const tournament = result.tournaments?.[0];
        if (tournament) setTournamentId(String(tournament.id));
        const firstFinal = (result.matches || []).find(isFinal);
        if (firstFinal) setMatchId(String(firstFinal.id));
      })
      .catch(() => { if (active) setError('Could not load official tournament data. Try refreshing the page.'); });
    return () => { active = false; };
  }, []);

  const tournament = data.tournaments.find((item) => String(item.id) === tournamentId);
  const tournamentMatches = useMemo(() => data.matches.filter((match) => String(match.tournament_id) === tournamentId), [data.matches, tournamentId]);
  const finalMatches = useMemo(() => tournamentMatches.filter(isFinal), [tournamentMatches]);
  const selectedMatch = finalMatches.find((match) => String(match.id) === matchId);
  const tournamentStandings = useMemo(() => data.standings.filter((row) => row.tournament_name === tournament?.name || String(row.tournament_id) === tournamentId), [data.standings, tournament, tournamentId]);
  const confirmedAwards = useMemo(() => awards.filter((award) => award.status === 'confirmed' && award.user_id), [awards]);
  const selectedAward = confirmedAwards[0];
  const selectedPlayer = type === 'player_of_game' ? pickPlayerOfGame(boxScore) : boxScore[0];
  const needsFinalMatch = ['final_score', 'player', 'player_of_game'].includes(type);
  const ready = Boolean(tournament && (needsFinalMatch ? selectedMatch && (!['player', 'player_of_game'].includes(type) || selectedPlayer) : type === 'standings' ? tournamentStandings.length : type === 'award' ? selectedAward : selectedPlayer));

  useEffect(() => {
    if (!tournamentId) { setAwards([]); return undefined; }
    let active = true;
    engagementService.awards(tournamentId).then((rows) => { if (active) setAwards(rows || []); }).catch(() => { if (active) setAwards([]); });
    return () => { active = false; };
  }, [tournamentId]);

  useEffect(() => {
    if (!selectedMatch?.id) { setBoxScore([]); return undefined; }
    let active = true;
    gameOperationsService.boxScore(selectedMatch.id).then((rows) => { if (active) setBoxScore(rows || []); }).catch(() => { if (active) setBoxScore([]); });
    return () => { active = false; };
  }, [selectedMatch?.id]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    drawCard(ctx, { type, tournament, match: selectedMatch, standings: tournamentStandings, award: selectedAward, player: selectedPlayer });
  }, [type, tournament, selectedMatch, tournamentStandings, selectedAward, selectedPlayer]);

  useEffect(() => { draw(); }, [draw]);

  const download = () => {
    if (!ready || !canvasRef.current) return;
    draw();
    const link = document.createElement('a');
    link.download = `fullcourt-${slug(tournament?.name)}-${type}.png`;
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
    setNotice('Card downloaded at 1080 × 1080. Add the PNG to your Facebook post.');
    setError('');
  };

  const shareOnFacebook = () => {
    if (!ready) return;
    download();
    const url = tournament ? `${window.location.origin}/sports/tournaments/${tournament.id}` : window.location.origin;
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
  };

  const changeTournament = (value) => {
    setTournamentId(value);
    const firstFinal = data.matches.find((match) => String(match.tournament_id) === value && isFinal(match));
    setMatchId(firstFinal ? String(firstFinal.id) : '');
    setNotice('');
  };

  return (
    <div className="share-cards-page">
      <header className="share-cards-hero">
        <div className="share-hero-copy">
          <span className="share-eyebrow"><i className="bi bi-broadcast-pin" /> COURTSIDE SOCIAL STUDIO</span>
          <h1>Give the game<br /><em>something to share.</em></h1>
          <p>Make polished, post-ready basketball graphics from your tournament’s official results.</p>
        </div>
        <div className="share-hero-badge"><i className="bi bi-image" /><span>MADE FOR<br /><b>GAME DAY</b></span></div>
        <div className="share-orbit share-orbit-one" /><div className="share-orbit share-orbit-two" />
      </header>

      <div className="share-workspace">
        <section className="share-editor" aria-label="Share card settings">
          <div className="share-editor-heading"><span>01</span><div><h2>Build your card</h2><p>Choose what fans should see.</p></div></div>
          <label className="share-field"><span>Card style</span><select className="form-select" aria-label="Select share card style" value={type} onChange={(event) => { setType(event.target.value); setNotice(''); }}>
            {CARD_TYPES.map((card) => <option key={card.value} value={card.value}>{card.label}</option>)}
          </select></label>
          <label className="share-field"><span>Tournament</span><select className="form-select" aria-label="Select tournament for share card" value={tournamentId} onChange={(event) => changeTournament(event.target.value)}>
            {data.tournaments.length ? data.tournaments.map((item) => <option value={item.id} key={item.id}>{item.name}</option>) : <option value="">No tournaments available</option>}
          </select></label>
          {needsFinalMatch && <label className="share-field"><span>Completed game</span><select className="form-select" aria-label="Select completed game for share card" value={matchId} onChange={(event) => setMatchId(event.target.value)}>
            {finalMatches.length ? finalMatches.map((match) => <option value={match.id} key={match.id}>{match.team1_name} vs {match.team2_name}</option>) : <option value="">No completed games yet</option>}
          </select></label>}
          <div className="share-data-note"><i className="bi bi-patch-check-fill" /><span><b>Official data only</b><small>{type === 'player_of_game' ? 'Finalized game stats determine the performance leader.' : 'Scores, standings and confirmed honors.'}</small></span></div>
          <div className="share-editor-actions"><button className="btn share-download-btn" disabled={!ready} onClick={download}><i className="bi bi-download" /> Download PNG</button><button className="btn share-facebook-btn" disabled={!ready} onClick={shareOnFacebook}><i className="bi bi-facebook" /> Share on Facebook</button></div>
          {!ready && <p className="share-unavailable"><i className="bi bi-info-circle" />{unavailableMessage(type, data.tournaments.length, finalMatches.length, tournamentStandings.length, confirmedAwards.length, boxScore.length)}</p>}
          {notice && <p className="share-notice" role="status"><i className="bi bi-check-circle-fill" />{notice}</p>}
          {error && <p className="share-error" role="alert"><i className="bi bi-exclamation-triangle-fill" />{error}</p>}
        </section>

        <section className="share-preview-section" aria-label="Share card preview">
          <div className="share-preview-heading"><div><span>02 · LIVE PREVIEW</span><h2>Ready for the feed</h2></div><span className="share-size-tag"><i className="bi bi-aspect-ratio" /> 1080 × 1080</span></div>
          <div className="share-canvas-frame"><canvas ref={canvasRef} width="1080" height="1080" aria-label="Preview of the FullCourt social card" role="img" /></div>
          <p className="share-preview-caption"><i className="bi bi-lightning-charge-fill" /> Square format · crisp on Facebook and Instagram</p>
        </section>
      </div>
    </div>
  );
};

function isFinal(match) { return ['completed', 'final', 'finished'].includes(String(match.status || '').toLowerCase()); }
function slug(value) { return String(value || 'tournament').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''); }
function unavailableMessage(type, tournaments, games, standings, awards, players = 0) {
  if (!tournaments) return 'Create or publish a tournament to start a share card.';
  if (type === 'final_score' && !games) return 'A card becomes available when a game has an official final score.';
  if (type === 'standings' && !standings) return 'Standings will appear after teams have recorded results.';
  if (type === 'award' && !awards) return 'Only confirmed award recipients can be published.';
  if (['player', 'player_of_game'].includes(type) && !games) return 'Player cards are available after an official game is finalized.';
  if (type === 'player_of_game' && !players) return 'The Player of the Game card needs official player statistics from the selected final.';
  if (type === 'player') return 'Player spotlight will be available when official game stats are recorded.';
  return 'Select available official tournament data to continue.';
}

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath(); ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke(); }
}
function fitText(ctx, value, x, y, maxWidth, maxSize, color = '#fff', weight = 700) {
  let size = maxSize;
  ctx.textAlign = 'left';
  do { ctx.font = `${weight} ${size}px Arial, sans-serif`; size -= 2; } while (ctx.measureText(String(value)).width > maxWidth && size > 24);
  ctx.fillStyle = color; ctx.fillText(String(value), x, y);
}
function drawCard(ctx, { type, tournament, match, standings, award, player }) {
  const red = '#e13722'; const gold = '#f1c65b';
  ctx.clearRect(0, 0, 1080, 1080);
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080); bg.addColorStop(0, '#111114'); bg.addColorStop(.58, '#1c1b1d'); bg.addColorStop(1, '#101012');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 1080, 1080);
  const glow = ctx.createRadialGradient(880, 160, 20, 850, 180, 700); glow.addColorStop(0, 'rgba(225,55,34,.35)'); glow.addColorStop(1, 'rgba(225,55,34,0)'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 1080, 1080);
  ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 2;
  for (let x = 30; x < 1080; x += 52) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 1080); ctx.stroke(); }
  roundedRect(ctx, 45, 45, 990, 990, 32, 'rgba(16,16,18,.22)', 'rgba(255,255,255,.12)');
  roundedRect(ctx, 78, 78, 10, 98, 5, red);
  ctx.fillStyle = '#fff'; ctx.font = '900 37px Arial, sans-serif'; ctx.fillText('FULLCOURT', 112, 119);
  ctx.fillStyle = gold; ctx.font = '700 16px Arial, sans-serif'; ctx.fillText('BASKETBALL · COMMUNITY · EVERY GAME', 112, 151);
  roundedRect(ctx, 803, 91, 220, 43, 22, 'rgba(225,55,34,.15)', 'rgba(225,55,34,.48)');
  ctx.fillStyle = '#ff806d'; ctx.font = '800 15px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('OFFICIAL GAME DATA', 913, 118); ctx.textAlign = 'left';
  const title = tournament?.name || 'Basketball tournament';
  fitText(ctx, title, 80, 238, 900, 44, '#fff', 800);
  ctx.fillStyle = '#96939a'; ctx.font = '600 18px Arial, sans-serif'; ctx.fillText('ORMOC CITY  ·  TOURNAMENT SERIES', 82, 278);
  ctx.fillStyle = red; ctx.fillRect(82, 312, 916, 3);

  if (type === 'final_score' && match) drawFinal(ctx, match, red, gold);
  else if (type === 'standings' && standings.length) drawStandings(ctx, standings, red, gold);
  else if (type === 'award' && award) drawAward(ctx, award, red, gold);
  else if (type === 'player_of_game' && player) drawPlayerOfGame(ctx, player, match, red, gold);
  else if (type === 'player' && player) drawPlayer(ctx, player, red, gold);
  else drawEmptyCard(ctx, type, red, gold);

  ctx.fillStyle = '#9b989e'; ctx.font = '600 16px Arial, sans-serif'; ctx.fillText('FULLCOURT · THE HOME OF EVERY GAME', 82, 982);
  ctx.textAlign = 'right'; ctx.fillStyle = '#d7d3d5'; ctx.fillText('FOLLOW THE ACTION  →', 998, 982); ctx.textAlign = 'left';
}
function drawFinal(ctx, match, red, gold) {
  ctx.fillStyle = gold; ctx.font = '800 19px Arial'; ctx.fillText('FINAL  ·  OFFICIAL RESULT', 82, 376);
  roundedRect(ctx, 82, 420, 916, 390, 24, 'rgba(255,255,255,.045)', 'rgba(255,255,255,.1)');
  fitText(ctx, match.team1_name || 'Home', 122, 535, 530, 42, '#fff', 800); fitText(ctx, match.team2_name || 'Away', 122, 695, 530, 42, '#fff', 800);
  ctx.textAlign = 'right'; ctx.font = '900 90px Arial'; ctx.fillStyle = '#fff'; ctx.fillText(String(match.team1_score ?? 0), 950, 545); ctx.fillText(String(match.team2_score ?? 0), 950, 705); ctx.textAlign = 'left';
  ctx.fillStyle = red; ctx.fillRect(122, 576, 830, 2); ctx.fillStyle = '#a6a2a6'; ctx.font = '600 19px Arial'; ctx.fillText(match.court_name || 'FULLCOURT · GAME DAY', 122, 768);
}
function drawStandings(ctx, rows, red, gold) {
  ctx.fillStyle = gold; ctx.font = '800 19px Arial'; ctx.fillText('LEAGUE TABLE  ·  CURRENT RANKINGS', 82, 376);
  roundedRect(ctx, 82, 411, 916, 58, 15, 'rgba(255,255,255,.075)');
  ctx.fillStyle = '#a7a2a8'; ctx.font = '700 15px Arial'; ctx.fillText('RANK  TEAM', 112, 447); ctx.textAlign = 'right'; ctx.fillText('W  ·  L', 954, 447); ctx.textAlign = 'left';
  rows.slice(0, 5).forEach((row, index) => {
    const y = 486 + index * 91;
    roundedRect(ctx, 82, y, 916, 75, 14, index === 0 ? 'rgba(225,55,34,.17)' : 'rgba(255,255,255,.035)', index === 0 ? 'rgba(225,55,34,.42)' : 'rgba(255,255,255,.045)');
    ctx.fillStyle = index === 0 ? gold : '#a29da3'; ctx.font = '900 24px Arial'; ctx.fillText(String(index + 1).padStart(2, '0'), 108, y + 47);
    fitText(ctx, row.team_name || 'Team', 172, y + 47, 610, 27, '#fff', 700);
    ctx.textAlign = 'right'; ctx.fillStyle = '#fff'; ctx.font = '800 23px Arial'; ctx.fillText(`${row.won ?? 0}  ·  ${row.lost ?? 0}`, 954, y + 47); ctx.textAlign = 'left';
  });
}
function drawAward(ctx, award, red, gold) {
  ctx.fillStyle = gold; ctx.font = '800 19px Arial'; ctx.fillText('OFFICIAL TOURNAMENT HONOR', 82, 376);
  roundedRect(ctx, 82, 416, 916, 390, 24, 'rgba(255,255,255,.045)', 'rgba(241,198,91,.3)');
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = '900 105px Arial'; ctx.fillText('★', 540, 550);
  fitText(ctx, award.name || 'Award winner', 160, 630, 760, 42, '#f1c65b', 800);
  fitText(ctx, award.full_name || 'Official recipient', 140, 710, 800, 52, '#fff', 900);
  ctx.fillStyle = '#c3bdc2'; ctx.font = '700 22px Arial'; ctx.fillText(award.team_name || 'FullCourt tournament', 540, 762); ctx.textAlign = 'left';
}
function drawPlayer(ctx, player, red, gold) {
  ctx.fillStyle = gold; ctx.font = '800 19px Arial'; ctx.fillText('PLAYER SPOTLIGHT  ·  OFFICIAL STATS', 82, 376);
  fitText(ctx, player.full_name || 'Top performer', 82, 474, 900, 48, '#fff', 900);
  ctx.fillStyle = '#aaa4a9'; ctx.font = '700 22px Arial'; ctx.fillText(player.team_name || 'Tournament player', 84, 520);
  const metrics = [['PTS', player.points], ['REB', player.rebounds], ['AST', player.assists], ['STL', player.steals]];
  metrics.forEach(([label, value], index) => {
    const x = 82 + index * 232;
    roundedRect(ctx, x, 590, 210, 190, 20, 'rgba(255,255,255,.055)', 'rgba(255,255,255,.1)');
    ctx.fillStyle = red; ctx.font = '900 58px Arial'; ctx.fillText(String(value ?? 0), x + 22, 685);
    ctx.fillStyle = '#c9c4c8'; ctx.font = '800 17px Arial'; ctx.fillText(label, x + 24, 737);
  });
}
function pickPlayerOfGame(players) {
  return [...players].sort((a, b) => impactScore(b) - impactScore(a)
    || Number(b.points || 0) - Number(a.points || 0)
    || Number(b.rebounds || 0) - Number(a.rebounds || 0)
    || String(a.full_name || '').localeCompare(String(b.full_name || '')))[0] || null;
}
function impactScore(player) {
  return Number(player.points || 0) + Number(player.rebounds || 0) * 1.2
    + Number(player.assists || 0) * 1.5 + Number(player.steals || 0) * 2
    + Number(player.blocks || 0) * 2 - Number(player.turnovers || 0);
}
function drawPlayerOfGame(ctx, player, match, red, gold) {
  ctx.fillStyle = gold; ctx.font = '800 19px Arial'; ctx.fillText('PLAYER OF THE GAME  ·  STATISTICAL LEADER', 82, 376);
  roundedRect(ctx, 82, 410, 916, 400, 24, 'rgba(255,255,255,.045)', 'rgba(241,198,91,.3)');
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = '900 76px Arial'; ctx.fillText('★', 540, 510);
  fitText(ctx, player.full_name || 'Game leader', 130, 585, 820, 48, '#fff', 900);
  ctx.fillStyle = '#c3bdc2'; ctx.font = '700 22px Arial'; ctx.fillText(`${player.team_name || 'Tournament player'}  ·  #${player.jersey_number || '–'}`, 540, 630);
  const metrics = [['PTS', player.points], ['REB', player.rebounds], ['AST', player.assists], ['STL', player.steals]];
  metrics.forEach(([label, value], index) => {
    const x = 111 + index * 222;
    roundedRect(ctx, x, 665, 194, 105, 16, 'rgba(255,255,255,.055)', 'rgba(255,255,255,.1)');
    ctx.fillStyle = red; ctx.font = '900 40px Arial'; ctx.fillText(String(value ?? 0), x + 97, 716);
    ctx.fillStyle = '#c9c4c8'; ctx.font = '800 14px Arial'; ctx.fillText(label, x + 97, 747);
  });
  ctx.textAlign = 'left'; ctx.fillStyle = '#aaa4a9'; ctx.font = '700 17px Arial';
  ctx.fillText(`${match?.team1_name || 'Home'}  ${match?.team1_score ?? 0}  —  ${match?.team2_score ?? 0}  ${match?.team2_name || 'Away'}`, 82, 862);
  ctx.fillStyle = '#817b82'; ctx.font = '600 14px Arial'; ctx.fillText('Performance leader calculated from the finalized box score.', 82, 896);
}
function drawEmptyCard(ctx, type, red, gold) {
  ctx.textAlign = 'center'; ctx.fillStyle = gold; ctx.font = '900 78px Arial'; ctx.fillText('◎', 540, 525);
  ctx.fillStyle = '#fff'; ctx.font = '800 35px Arial'; ctx.fillText('THE NEXT BIG MOMENT', 540, 600);
  ctx.fillStyle = '#b8b2b8'; ctx.font = '500 23px Arial';
  const message = type === 'award' ? 'Official honors will appear here once confirmed.' : type === 'standings' ? 'Team rankings will appear as final results come in.' : type === 'player' ? 'Player stats will appear after the game is recorded.' : 'Final scores will appear here when the game is complete.';
  ctx.fillText(message, 540, 650); ctx.textAlign = 'left';
}

export default ShareCards;
