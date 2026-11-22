import axios from 'axios';
import { BASE_URL } from '../config/urls';

const http = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const fullUrl = error.config?.url || '';
    const normalizedUrl = fullUrl.replace(BASE_URL, '');
    const sessionExpired = status === 401 && !normalizedUrl.startsWith('/auth/') && window.location.pathname !== '/';

    if (sessionExpired) {
      const from = window.location.pathname + window.location.search;
      window.location.replace(`/?from=${encodeURIComponent(from)}`);
    }

    return Promise.reject(error);
  }
);

export default http;
