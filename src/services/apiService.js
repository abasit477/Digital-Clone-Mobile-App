import axios from 'axios';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * API Service — Axios instance pre-configured for the backend.
 * Automatically attaches the Cognito JWT token to every request.
 *
 * Replace BASE_URL with your actual backend API endpoint.
 */
const BASE_URL = 'https://api.your-backend.com/v1'; // TODO: replace with real URL

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ─── Request Interceptor ────────────────────────────────────────────────────
// Attach the Cognito JWT access token on every outbound request.
apiClient.interceptors.request.use(
  async (config) => {
    try {
      const session = await fetchAuthSession();
      const token = session?.tokens?.accessToken?.toString();
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (_) {
      // No authenticated session — proceed without auth header
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ─── Response Interceptor ───────────────────────────────────────────────────
// Normalise error responses and handle 401 globally.
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message =
      error?.response?.data?.message ||
      error?.message ||
      'An unexpected error occurred.';

    if (status === 401) {
      // Token expired / invalid — the AuthStore will redirect to Login
      console.warn('[API] 401 Unauthorized — session may have expired.');
    }

    return Promise.reject({ status, message, raw: error });
  },
);

// ─── Typed helpers ──────────────────────────────────────────────────────────
export const api = {
  get:    (url, config)         => apiClient.get(url, config),
  post:   (url, data, config)   => apiClient.post(url, data, config),
  put:    (url, data, config)   => apiClient.put(url, data, config),
  patch:  (url, data, config)   => apiClient.patch(url, data, config),
  delete: (url, config)         => apiClient.delete(url, config),
};

export default apiClient;
