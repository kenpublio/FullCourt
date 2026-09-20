import { useEffect, useState } from 'react';
import publicService from '../services/publicService';

export function useCourtData() {
  const [data, setData] = useState({ tournaments: [], matches: [], standings: [], leaders: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await publicService.getPortal();
        if (active) {
          setData({ tournaments: response.tournaments || [], matches: response.matches || [], standings: response.standings || [], leaders: response.leaders || [] });
          setError('');
        }
      } catch {
        if (active) setError('Game updates are temporarily unavailable. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { active = false; clearInterval(timer); };
  }, [attempt]);

  return { data, loading, error, retry: () => setAttempt(value => value + 1) };
}
