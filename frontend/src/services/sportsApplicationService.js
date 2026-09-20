import api from './api';

const sportsApplicationService = {
  async getAvailableSports() { return (await api.get('/sports/applications')).data?.data?.sports || []; },
  async apply(teamId, categoryId) { return (await api.post('/sports/applications', { team_id: teamId, category_id: categoryId })).data; },
  async getCoachApplications() { return (await api.get('/sports/applications/coach')).data?.data?.applications || []; },
  async getMyUpdates() { return (await api.get('/sports/applications/updates')).data?.data?.updates || []; },
  async respond(id, decision) { return (await api.put(`/sports/applications/${id}/respond`, { decision })).data; },
};

export default sportsApplicationService;
