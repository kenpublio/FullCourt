import api from './api';
const gameDayService={
  async overview(tournamentId){return (await api.get(`/tournaments/${tournamentId}/game-day`)).data?.data||{games:[],incidents:[]};},
  async saveReadiness(matchId,data){return (await api.put(`/matches/${matchId}/readiness`,data)).data;},
  async reportIncident(matchId,data){return (await api.post(`/matches/${matchId}/incidents`,data)).data;},
  async resolveIncident(id){return (await api.put(`/game-incidents/${id}/resolve`)).data;},
};
export default gameDayService;
