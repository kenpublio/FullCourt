import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import publicService from '../services/publicService';
import '../styles/scoring-console.css';

const GymScoreboard = () => {
  const { matchId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const fetchMatch = () => {
      if (!matchId) return;
      publicService.getLiveMatch(matchId)
        .then((res) => {
          if (active && res?.score) setData(res.score);
        })
        .catch((err) => {
          if (active) setError(err.response?.data?.message || 'Unable to load gym scoreboard.');
        });
    };

    fetchMatch();
    const interval = setInterval(fetchMatch, 3000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [matchId]);

  if (error) {
    return (
      <div className="gym-scoreboard-page text-center d-flex align-items-center justify-content-center">
        <div>
          <h2 className="text-danger mb-3">{error}</h2>
          <Link to="/" className="btn btn-outline-light">Back to Home</Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="gym-scoreboard-page text-center d-flex align-items-center justify-content-center">
        <h2 className="text-muted">Loading Gym Scoreboard...</h2>
      </div>
    );
  }

  const seconds = Number(data.timer_seconds) || 0;
  const timeFormatted = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="gym-scoreboard-page">
      <header className="gym-header">
        <div className="gym-brand">
          <i className="bi bi-dribbble" /> FULLCOURT ARENA
        </div>
        <div className="gym-tournament-name">
          {data.tournament_name || 'Basketball Championship'} &bull; GAME #{data.match_id || matchId}
        </div>
      </header>

      <main className="gym-board-grid">
        {/* Team 1 Card */}
        <section className="gym-team-card team-1">
          <div className="gym-team-name">{data.team1_name || 'HOME'}</div>
          <div className="gym-team-score">{data.team1_score ?? 0}</div>
        </section>

        {/* Center Timer & Period */}
        <section className="gym-center-timer">
          <div className="gym-period-badge">
            {data.current_period || 'PERIOD 1'}
          </div>
          <div className="gym-clock">
            {timeFormatted}
          </div>
          <span className="badge bg-danger text-uppercase px-3 py-2 fs-6">
            {data.is_timer_running ? '● LIVE CLOCK' : 'STOPPED'}
          </span>
        </section>

        {/* Team 2 Card */}
        <section className="gym-team-card team-2">
          <div className="gym-team-name">{data.team2_name || 'AWAY'}</div>
          <div className="gym-team-score">{data.team2_score ?? 0}</div>
        </section>
      </main>

      <footer className="gym-footer">
        <div>Official Match Scoreboard &bull; Auto-sync every 3 seconds</div>
        <div>Press F11 for Fullscreen Display</div>
      </footer>
    </div>
  );
};

export default GymScoreboard;
