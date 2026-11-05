import api from './api';

export const bracketService = {
  async generateBracket(tournamentId) {
    const res = await api.post(`/tournaments/${tournamentId}/bracket/generate`);
    return res.data?.data || {};
  },

  async saveTeamPlacement(tournamentId, teamIds) {
    const res = await api.post(`/tournaments/${tournamentId}/bracket/generate`, { team_ids: teamIds, shuffle: false });
    return res.data?.data || {};
  },

  async getBracket(tournamentId) {
    const res = await api.get(`/tournaments/${tournamentId}/bracket`);
    return res.data?.data || {};
  }
};

export default bracketService;
