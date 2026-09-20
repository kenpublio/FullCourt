import api from './api';

export const venueService = {
  async getVenues() {
    const res = await api.get('/venues');
    return res.data?.data || { venues: [], courts: [] };
  },

  async getVenue(id) {
    const res = await api.get(`/venues/${id}`);
    return res.data?.data || { venue: null, courts: [] };
  },

  async createVenue(data) {
    const res = await api.post('/venues', data);
    return res.data;
  },

  async updateVenue(id, data) {
    const res = await api.put(`/venues/${id}`, data);
    return res.data;
  },

  async deleteVenue(id) {
    const res = await api.delete(`/venues/${id}`);
    return res.data;
  },

  async reviewVenue(id, status, notes = '') {
    const res = await api.put(`/venues/${id}/review`, { status, notes });
    return res.data;
  },

  async createCourt(data) {
    const res = await api.post('/courts', data);
    return res.data;
  },

  async updateCourt(id, data) {
    const res = await api.put(`/courts/${id}`, data);
    return res.data;
  },

  async deleteCourt(id) {
    const res = await api.delete(`/courts/${id}`);
    return res.data;
  }
};

export default venueService;
