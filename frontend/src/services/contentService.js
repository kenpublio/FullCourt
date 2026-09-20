import api from './api';

const contentService = {
  async getNews() { return (await api.get('/public/news')).data?.data?.news || []; },
  async getAnnouncements() { return (await api.get('/public/announcements')).data?.data?.announcements || []; },
  async getSportsWithCategories() { return (await api.get('/public/sports')).data?.data?.sports || []; },
  async getMyHistory() { return (await api.get('/players/history')).data?.data?.history || []; },
};

export default contentService;