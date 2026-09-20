import api from './api';

const operationsService = {
  async dashboard() { return (await api.get('/operations/dashboard')).data?.data || {}; },
  async organizations() { return (await api.get('/organizations')).data?.data?.organizations || []; },
  async createOrganization(payload) { return (await api.post('/organizations', payload)).data; },
  async reviewOrganization(id, status, notes = '') { return (await api.put(`/organizations/${id}/review`, { status, notes })).data; },
  async divisions(tournamentId) { return (await api.get(`/tournaments/${tournamentId}/divisions`)).data?.data?.divisions || []; },
  async createDivision(tournamentId, payload) { return (await api.post(`/tournaments/${tournamentId}/divisions`, payload)).data; },
};

export default operationsService;
