import axios from 'axios';

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: `${BASE}/api/v1`,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request logging (dev only) ──────────────────────────────────────────
api.interceptors.request.use((config) => {
  if (import.meta.env.DEV) console.debug(`[API] ${config.method?.toUpperCase()} ${config.url}`);
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg = err.response?.data?.detail || err.message || 'Unknown error';
    console.error(`[API Error] ${msg}`);
    return Promise.reject(new Error(msg));
  }
);

// ── Endpoints ───────────────────────────────────────────────────────────

export const simulateShipments = () =>
  api.post('/simulate-shipments').then((r) => r.data);

export const getShipments = () =>
  api.get('/shipments').then((r) => r.data.shipments);

export const getShipment = (id) =>
  api.get(`/shipments/${id}`).then((r) => r.data);

export const predictRisk = (id) =>
  api.get(`/predict-risk/${id}`).then((r) => r.data);

export const optimizeRoute = (payload) =>
  api.post('/optimize-route', payload).then((r) => r.data);

export const getHealth = () =>
  api.get('/health').then((r) => r.data);

export const getWeather = () =>
  api.get('/weather').then((r) => r.data.weather);

export default api;
