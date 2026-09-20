import api from './api';

export const scorekeeperService = {
  async getAssigned() {
    const res = await api.get('/scorekeeper/assigned');
    return res.data?.data?.matches || [];
  },

  async getScoreboard(matchId) {
    const res = await api.get(`/matches/${matchId}/scoreboard`);
    return res.data?.data || null;
  },

  async recordEvent(matchId, payload) {
    const res = await api.post(`/matches/${matchId}/events`, payload);
    return res.data;
  },

  async undoEvent(matchId, eventId) {
    const res = await api.delete(`/matches/${matchId}/events/${eventId}`);
    return res.data;
  },

  async assignScorekeeper(matchId, userId) {
    const res = await api.post(`/matches/${matchId}/assign-scorekeeper`, { user_id: userId });
    return res.data;
  }
};

export default scorekeeperService;
