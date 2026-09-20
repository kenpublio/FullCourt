import api from './api';

export const userService = {
  async getUsers() {
    const response = await api.get('/users');
    return response.data?.data?.users || [];
  },

  async updateUserRole(userId, role) {
    const response = await api.put(`/users/${userId}/role`, { role });
    return response.data;
  },

  async toggleUserStatus(userId, isActive) {
    const response = await api.put(`/users/${userId}/status`, { is_active: isActive });
    return response.data;
  },
  async updateUser(userId, data) {
    const response = await api.put(`/users/${userId}`, data);
    return response.data;
  },
  async deleteUser(userId) {
    const response = await api.delete(`/users/${userId}`);
    return response.data;
  },

  async getAuditLogs() {
    const response = await api.get('/users/audit-logs');
    return response.data?.data?.logs || [];
  },
  async updateProfile(data) {
    const response = await api.put('/users/profile', data);
    return response.data?.data?.user;
  },

  async uploadPhoto(file) {
    const formData = new FormData();
    formData.append('photo', file);
    const response = await api.post('/users/profile/photo', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data?.data?.avatar_url;
  }
};

export default userService;
