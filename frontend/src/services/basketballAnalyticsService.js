import api from './api';
const basketballAnalyticsService={
 async player(id){return (await api.get(`/analytics/players/${id}`)).data?.data;},
 async team(id){return (await api.get(`/analytics/teams/${id}`)).data?.data;},
 async outlook(matchId){return (await api.get(`/analytics/matches/${matchId}/outlook`)).data?.data;},
 async liveGames(){return (await api.get('/analytics/live-games')).data?.data?.games||[];},
 async dispatchReminders(){return (await api.post('/notifications/game-reminders/dispatch')).data?.data;},
};
export default basketballAnalyticsService;
