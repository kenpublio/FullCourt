import React, { useEffect, useState } from 'react';
import contentService from '../services/contentService';
import LoadingSpinner from '../components/LoadingSpinner';

const SportsCategories = () => {
  const [sports, setSports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    contentService.getSportsWithCategories()
      .then(setSports)
      .catch(() => setError('Unable to load sports categories.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading sports..." />;

  return (
    <div className="landing-page sports-categories-page">
      <nav className="landing-nav container">
        <div className="landing-brand" to="/"><span><i className="bi bi-trophy-fill" /></span> FullCourt</div>
        <div className="d-flex gap-2"><a className="landing-signin-btn" href="/login"><i className="bi bi-box-arrow-in-right" /><span>Sign in</span></a><a className="btn btn-neon" href="/register">Join now</a></div>
      </nav>
      <main className="container py-5">
        <div className="section-eyebrow mb-2">EVSU SPORTS</div>
        <h1 className="fw-bold mb-2" style={{ fontFamily: 'var(--font-display)' }}>Sports & Event Categories</h1>
        <p className="text-muted mb-5">Browse every sport and its official event categories offered by EVSU-Ormoc.</p>
        {error && <div className="alert alert-danger">{error}</div>}
        <div className="row g-4">
          {sports.map(s => (
            <div className="col-md-6 col-lg-4" key={s.id}>
              <div className="card-custom h-100 p-4">
                <div className="d-flex justify-content-between align-items-start mb-3">
                  <h4 className="fw-bold mb-0">{s.name}</h4>
                  <span className="sport-chip">{s.sport_category}</span>
                </div>
                <p className="text-muted small mb-3">{s.rules_summary || 'Official EVSU competitive sports program.'}</p>
                <small className="text-muted fw-semibold d-block mb-2">Event categories ({s.event_count})</small>
                <ul className="list-unstyled mb-0">
                  {(s.events || []).map(ev => (
                    <li key={ev.id} className="d-flex justify-content-between py-1 border-bottom border-light">
                      <span>{ev.name}</span>
                      <span className="badge bg-light text-dark text-uppercase" style={{ fontSize: '0.65rem' }}>{ev.gender}</span>
                    </li>
                  ))}
                  {!s.events?.length && <li className="text-muted small">No event categories yet.</li>}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
};

export default SportsCategories;