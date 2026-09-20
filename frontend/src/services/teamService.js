import api from './api';

export const teamService = {
  async getTeams() {
    const res = await api.get('/teams');
    return res.data?.data?.teams || [];
  },

  async getTeamsByTournament(tournamentId) {
    const res = await api.get(`/tournaments/${tournamentId}/teams`);
    return res.data?.data?.teams || [];
  },

  async registerTeam(data) {
    const res = await api.post('/teams', data);
    return res.data;
  },

  async updateTeam(id, data) {
    const res = await api.put(`/teams/${id}`, data);
    return res.data;
  },

  async deleteTeam(id) {
    const res = await api.delete(`/teams/${id}`);
    return res.data;
  },

  async getRoster(id) {
    const res = await api.get(`/teams/${id}/players`);
    return res.data?.data || { team: null, players: [] };
  },

  async uploadLogo(id, file) {
    const formData = new FormData();
    formData.append('logo', file);
    const res = await api.post(`/teams/${id}/logo`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data?.data?.logo_url;
  }
};

export default teamService;
