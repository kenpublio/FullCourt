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

  async finalizeMatch(matchId, winnerTeamId, scoreData, expectedScore) {
    const res = await api.post(`/matches/${matchId}/finalize`, {
      winner_team_id: winnerTeamId,
      team1_score: scoreData.team1_score,
      team2_score: scoreData.team2_score,
      current_period: scoreData.current_period,
      timer_seconds: scoreData.timer_seconds,
      expected_team1_score: expectedScore.team1_score,
      expected_team2_score: expectedScore.team2_score,
    });
    return res.data;
  }
};

export default scoringService;
