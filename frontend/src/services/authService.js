import api from './api';

export const authService = {
  async login(email, password) {
    const response = await api.post('/auth/login', { email, password });
    if (response.data && response.data.data) {
      const { token, refresh_token: refreshToken, user } = response.data.data;
      localStorage.setItem('sportsync_token', token);
      localStorage.setItem('sportsync_refresh_token', refreshToken);
      localStorage.setItem('sportsync_user', JSON.stringify(user));
      return { token, user };
    }
    throw new Error(response.data.message || 'Login failed');
  },

  async register(data) {
    const response = await api.post('/auth/register', data);
    return response.data;
  },
  async requestEmailCode(email) { return (await api.post('/auth/email-code', { email, purpose: 'registration' })).data; },
  async requestPasswordReset(email) { return (await api.post('/auth/forgot-password', { email })).data; },
  async verifyPasswordResetCode(email, code) { return (await api.post('/auth/verify-reset-code', { email, code })).data; },
  async verifyRegistrationCode(email, code) { return (await api.post('/auth/verify-email-code', { email, code })).data; },
  async resetPassword(data) { return (await api.post('/auth/reset-password', data)).data; },
  async changePassword(data) { return (await api.post('/auth/change-password', data)).data; },

  async getCurrentUser() {
    const response = await api.get('/auth/me');
    if (response.data && response.data.data) {
      const user = response.data.data.user;
      localStorage.setItem('sportsync_user', JSON.stringify(user));
      return user;
    }
    return null;
  },

  logout() {
    const refreshToken=localStorage.getItem('sportsync_refresh_token');
    if(refreshToken)api.post('/auth/logout',{refresh_token:refreshToken}).catch(()=>{});
    localStorage.removeItem('sportsync_token');
    localStorage.removeItem('sportsync_refresh_token');
    localStorage.removeItem('sportsync_user');
  },

  getStoredUser() {
    const userStr = localStorage.getItem('sportsync_user');
    try {
      return userStr ? JSON.parse(userStr) : null;
    } catch {
      return null;
    }
  },

  getStoredToken() {
    return localStorage.getItem('sportsync_token');
  }
};

export default authService;
