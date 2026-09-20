import React, { useEffect, useState } from 'react';
import contentService from '../services/contentService';
import LoadingSpinner from '../components/LoadingSpinner';

const SportsHistory = () => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    contentService.getMyHistory()
      .then(setHistory)
      .catch(() => setError('Unable to load your sports history.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading your sports history..." />;

  return (
    <div className="container-fluid p-0 page-enter">
      <div className="d-flex align-items-center gap-2 mb-4">
        <div className="kpi-icon kpi-icon-red" style={{ width: 42, height: 42 }}>
          <i className="bi bi-clock-history" />
        </div>
        <div>
          <span className="section-eyebrow">MY RECORD</span>
          <h4 className="fw-bold mb-0">Sports History</h4>
          <small className="text-muted">Your basketball participation across organizations and tournaments</small>
        </div>
      </div>

      {error && <div className="alert alert-danger py-2">{error}</div>}
      {!history.length && !error && <div className="public-empty"><i className="bi bi-trophy display-5 d-block mb-2 opacity-25" />No participation records yet. Join a sport to build your history.</div>}

      <div className="row g-4">
        {history.map(record => (
          <div className="col-12" key={record.id}>
            <div className="card-custom p-4">
              <div className="d-flex flex-wrap align-items-center gap-2 mb-3">
                <span className="sport-chip">{record.sport_name}</span>
                <span className="badge" style={{ background: 'var(--evsu-gold)', color: 'var(--evsu-dark)' }}>{record.category_name || 'Open category'}</span>
                <span className={`badge ${record.eligibility_status === 'verified' ? 'bg-success' : 'bg-secondary'}`}>{record.eligibility_status}</span>
                <span className="ms-auto text-muted small"><i className="bi bi-calendar3 me-1" />{record.start_date} → {record.end_date}</span>
              </div>
              <h5 className="fw-bold mb-1">{record.tournament_name}</h5>
              <p className="text-muted small mb-3"><i className="bi bi-people-fill me-1" />{record.team_name}</p>

              {record.matches?.length ? (
                <div className="table-responsive">
                  <table className="table table-modern align-middle mb-0">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Stage</th>
                        <th>Opponent</th>
                        <th>Venue</th>
                        <th>Result</th>
                      </tr>
                    </thead>
                    <tbody>
                      {record.matches.map(m => (
                        <tr key={m.id}>
                          <td className="small">{m.scheduled_start_time ? new Date(m.scheduled_start_time).toLocaleString() : 'TBA'}</td>
                          <td className="small text-muted">{m.stage_name}</td>
                          <td className="small fw-semibold">{m.team1_name} vs {m.team2_name}</td>
                          <td className="small text-muted">{m.venue_name || m.court_name || 'TBA'}</td>
                          <td>
                            {m.status === 'completed'
                              ? <span className={`badge ${m.is_winner ? 'bg-success' : 'bg-danger'}`}>{m.is_winner ? 'Won' : 'Lost'}</span>
                              : <span className="badge bg-secondary">{m.status.replace('_', ' ')}</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-muted small mb-0"><i className="bi bi-info-circle me-1" />No recorded matches for this tournament yet.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SportsHistory;
