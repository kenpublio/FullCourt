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

  async deleteTournament(id) {
    const res = await api.delete(`/tournaments/${id}`);
    return res.data;
  }
};

export default tournamentService;
