import api from './api';

const contentService = {
  async getNews() { return (await api.get('/public/news')).data?.data?.news || []; },
  async getAnnouncements() { return (await api.get('/public/announcements')).data?.data?.announcements || []; },
  async getManagedAnnouncements() { return (await api.get('/announcements')).data?.data?.announcements || []; },
  async publishAnnouncement(payload) { return (await api.post('/announcements', payload)).data?.data; },
  async getSportsWithCategories() { return (await api.get('/public/sports')).data?.data?.sports || []; },
  async getMyHistory() { return (await api.get('/players/history')).data?.data?.history || []; },
};

export default contentService;
