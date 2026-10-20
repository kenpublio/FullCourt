import api from './api';

export const tournamentService = {
  async getTournaments() {
    const res = await api.get('/tournaments');
    return res.data?.data || { tournaments: [], sports: [] };
  },

  async createTournament(data) {
    const res = await api.post('/tournaments', data);
    return res.data;
  },

  async reviewTournament(id, status, notes = '') {
    const res = await api.put(`/tournaments/${id}/review`, { status, notes });
    return res.data;
  },

  async deleteTournament(id) {
    const res = await api.delete(`/tournaments/${id}`);
    return res.data;
  },

  async setRosterLock(id, locked) {
    return (await api.put(`/tournaments/${id}/roster-lock`, { locked })).data;
  },

  async archiveTournament(id) {
    return (await api.post(`/tournaments/${id}/archive`)).data;
  },

  async assignStaff(id, staffUserId) {
    return (await api.put(`/tournaments/${id}/staff`, { staff_user_id: staffUserId || null })).data;
  },

  async getReadiness(id) {
    const res = await api.get(`/tournaments/${id}/readiness`);
    return res.data?.data?.readiness;
  },

  async publishTournament(id) {
    return (await api.post(`/tournaments/${id}/publish`)).data;
  }
};

export default tournamentService;
