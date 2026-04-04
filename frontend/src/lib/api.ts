import axios from 'axios';

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4001',
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('shop_os_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      // Don't redirect for optional/background endpoints
      const url = err.config?.url || '';
      const isOptional = url.includes('/ai/') || url.includes('/analytics/') || url.includes('/menu/');
      if (!isOptional) {
        localStorage.removeItem('shop_os_token');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
export { api };
