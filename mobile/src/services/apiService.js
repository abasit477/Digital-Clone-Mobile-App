import axios from 'axios';
import authService from './authService';
import { API_BASE_URL } from '../config/apiConfig';

const BASE_URL = API_BASE_URL;

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach Cognito JWT access token on every outbound request
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const { data: session } = await authService.getSession();
      // ID token is used so the backend can read email, name, and custom:role claims
      const token = session?.getIdToken?.()?.getJwtToken?.();
      if (token) config.headers.Authorization = `Bearer ${token}`;
    } catch (_) {}
    return config;
  },
  (error) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status  = error?.response?.status;
    const message = error?.response?.data?.message || error?.message || 'An unexpected error occurred.';
    if (status === 401) console.warn('[API] 401 Unauthorized — session may have expired.');
    return Promise.reject({ status, message, raw: error });
  },
);

export const api = {
  get:    (url, config)       => apiClient.get(url, config),
  post:   (url, data, config) => apiClient.post(url, data, config),
  put:    (url, data, config) => apiClient.put(url, data, config),
  patch:  (url, data, config) => apiClient.patch(url, data, config),
  delete: (url, config)       => apiClient.delete(url, config),
};

export default apiClient;
