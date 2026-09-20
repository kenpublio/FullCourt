import api from './api';

const engagementService={
  async notifications(){return (await api.get('/notifications')).data?.data?.notifications||[];},
  async read(id){return (await api.put(`/notifications/${id}/read`)).data;},
  async readAll(){return (await api.put('/notifications/read-all')).data;},
  async awards(tournamentId){return (await api.get(`/tournaments/${tournamentId}/awards`)).data?.data?.awards||[];},
  async recommend(tournamentId){return (await api.post(`/tournaments/${tournamentId}/awards/recommend`)).data?.data?.awards||[];},
  async confirm(id,publish=true){return (await api.put(`/awards/${id}/confirm`,{publish})).data;},
};
export default engagementService;
