import api from './api';

export const scoringService = {
  async getScore(matchId) {
    const res = await api.get(`/matches/${matchId}/score`);
    return res.data?.data?.score || null;
  },

  async updateScore(matchId, scoreData) {
    const res = await api.post(`/matches/${matchId}/score`, scoreData);
    return res.data;
  },

  async finalizeMatch(matchId, winnerTeamId) {
    const res = await api.post(`/matches/${matchId}/finalize`, { winner_team_id: winnerTeamId });
    return res.data;
  }
};

export default scoringService;
