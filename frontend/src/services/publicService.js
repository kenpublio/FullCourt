import api from './api';

const publicService = {
  async getPortal() {
    const response = await api.get('/public/portal');
    return response.data?.data || { tournaments: [], matches: [], standings: [], leaders: [] };
  },
  async getTournament(id) {
    const response = await api.get(`/public/tournaments/${id}`);
    return response.data?.data;
  },
  async getOrganization(slug) {
    const response = await api.get(`/public/organizations/${slug}`);
    return response.data?.data;
  },
  async getLiveMatch(id) { return (await api.get(`/public/matches/${id}/live`)).data?.data; },
  async getDailySchedule() { return (await api.get('/public/schedule')).data?.data?.matches || []; },
  async getMatchDetails(id) { return (await api.get(`/public/matches/${id}/details`)).data?.data; },
};

export default publicService;
