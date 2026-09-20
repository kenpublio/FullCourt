import api from './api';

const gameOperationsService = {
  async assignments() { return (await api.get('/game-assignments')).data?.data?.assignments || []; },
  async assign(matchId, userId, assignmentRole) { return (await api.post(`/matches/${matchId}/assignments`, { user_id:userId, assignment_role:assignmentRole })).data; },
  async respond(id, status) { return (await api.put(`/game-assignments/${id}/respond`, { status })).data; },
  async confirmLineup(matchId, players) { return (await api.put(`/matches/${matchId}/lineup`, { players })).data; },
  async lineup(matchId) { return (await api.get(`/matches/${matchId}/lineup`)).data?.data?.players || []; },
  async recordStat(matchId, payload) { return (await api.post(`/matches/${matchId}/basketball-stats`, payload)).data; },
  async substitute(matchId, payload) { return (await api.post(`/matches/${matchId}/substitutions`, payload)).data; },
  async voidStat(matchId, eventId) { return (await api.delete(`/matches/${matchId}/basketball-stats/${eventId}`)).data; },
  async boxScore(matchId) { return (await api.get(`/matches/${matchId}/box-score`)).data?.data?.players || []; },
  async corrections() { return (await api.get('/score-corrections')).data?.data?.corrections || []; },
  async requestCorrection(matchId, payload) { return (await api.post(`/matches/${matchId}/score-corrections`, payload)).data; },
  async reviewCorrection(id, status) { return (await api.put(`/score-corrections/${id}/review`, { status })).data; },
  async issueAccessQR(id) { return (await api.post(`/game-assignments/${id}/access-qr`)).data?.data?.access; },
};

export default gameOperationsService;
