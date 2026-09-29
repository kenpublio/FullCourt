import axios from 'axios';
import api from './api';

const API_BASE_URL=import.meta.env.VITE_API_URL||'http://127.0.0.1:8767/api';
const guest=axios.create({baseURL:API_BASE_URL,headers:{'Content-Type':'application/json'}});
const sessionConfig=token=>({headers:{Authorization:`Bearer ${token}`}});

const scoringAccessService={
  async create(matchId,payload){return(await api.post(`/matches/${matchId}/scoring-link`,payload)).data?.data?.access;},
  async revoke(id){return(await api.delete(`/scoring-links/${id}`)).data;},
  async activate(token,payload){return(await guest.post(`/public/scoring-links/${token}/activate`,payload)).data?.data;},
  async console(session){return(await guest.get('/scoring-session/console',sessionConfig(session))).data?.data;},
  async stat(session,payload){return(await guest.post('/scoring-session/stats',payload,sessionConfig(session))).data;},
  async updateClock(session,payload){return(await guest.put('/scoring-session/clock',payload,sessionConfig(session))).data?.data;},
};
export default scoringAccessService;
