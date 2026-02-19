/**
 * App config - reads from Vite env vars (VITE_*).
 * In dev, API calls are proxied to the server via Vite proxy.
 */
export const config = {
  apiUrl: import.meta.env.VITE_API_URL || '',
};
