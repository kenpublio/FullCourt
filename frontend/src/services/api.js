import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8767/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach JWT Bearer Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('sportsync_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let refreshPromise = null;
const clearSession = () => {
  localStorage.removeItem('sportsync_token');
  localStorage.removeItem('sportsync_refresh_token');
  localStorage.removeItem('sportsync_user');
};

// Response interceptor: rotate the refresh token once and replay queued requests.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request=error.config;
    const credentialRequest = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/verify-reset-code', '/auth/verify-email-code', '/auth/reset-password', '/auth/change-password'].some(path => request?.url?.includes(path));
    if (error.response?.status === 401 && !credentialRequest && !request?._retried && !request?.url?.includes('/auth/refresh') && !request?.url?.includes('/auth/logout')) {
      const refreshToken=localStorage.getItem('sportsync_refresh_token');
      if(refreshToken){
        request._retried=true;
        try{
          refreshPromise ||= axios.post(`${API_BASE_URL}/auth/refresh`,{refresh_token:refreshToken});
          const response=await refreshPromise;refreshPromise=null;
          const next=response.data.data;localStorage.setItem('sportsync_token',next.token);localStorage.setItem('sportsync_refresh_token',next.refresh_token);localStorage.setItem('sportsync_user',JSON.stringify(next.user));
          request.headers.Authorization=`Bearer ${next.token}`;return api(request);
        }catch{refreshPromise=null;}
      }
      let adminSession = false;
      try { adminSession = ['platform_admin', 'admin'].includes(JSON.parse(localStorage.getItem('sportsync_user'))?.role); } catch { /* No saved session. */ }
      clearSession();
      if (!['/login', '/admin', '/register', '/forgot-password'].includes(window.location.pathname)) {
        window.location.href = adminSession ? '/admin' : '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
