import api from './api';
export default {
  async get(){return (await api.get('/public/platform-settings')).data?.data?.settings;},
  async update(settings){return (await api.put('/platform-settings',settings)).data?.data?.settings;},
};
