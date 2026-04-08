// Set EXPO_PUBLIC_API_URL in your .env file.
// Default: local backend for development.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';
