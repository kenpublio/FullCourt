import api from './api';
const systemOperationsService={
  async health(){return (await api.get('/system/health')).data?.data?.health;},
  async backup(){return (await api.post('/system/backups')).data?.data?.backup;},
};
export default systemOperationsService;
