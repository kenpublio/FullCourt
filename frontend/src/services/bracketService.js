import api from './api';

export const bracketService = {
  async generateBracket(tournamentId) {
    const res = await api.post(`/tournaments/${tournamentId}/bracket/generate`);
    return res.data?.data || {};
  },

  async getBracket(tournamentId) {
    const res = await api.get(`/tournaments/${tournamentId}/bracket`);
    return res.data?.data || {};
  }
};

export default bracketService;
