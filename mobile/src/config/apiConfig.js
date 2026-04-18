// Set EXPO_PUBLIC_API_URL in your .env file.
// Default: local backend for development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

// Base URL for static assets (avatars, videos) served by the backend.
// Derived by stripping /api/v1 from the API URL.
export const SERVER_BASE_URL = API_BASE_URL.replace('/api/v1', '');
