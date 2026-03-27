const DEFAULT_API_ORIGIN = "http://127.0.0.1:5001";

function normalizeOrigin(value) {
  const origin = typeof value === "string" ? value.trim() : "";
  return origin ? origin.replace(/\/+$/, "") : "";
}

export const API_ORIGIN = normalizeOrigin(import.meta.env.VITE_API_ORIGIN) || DEFAULT_API_ORIGIN;
export const API_BASE = `${API_ORIGIN}/api`;

export const AUTH_API_URL = `${API_BASE}/auth`;
export const SCANS_API_URL = `${API_BASE}/scans`;
export const PREDICT_API_URL = `${API_BASE}/predict`;
export const NEARBY_DOCTORS_API_URL = `${API_BASE}/nearby-doctors`;
export const MESSAGES_API_URL = `${API_BASE}/messages`;
export const REVIEW_REQUESTS_API_URL = `${API_BASE}/review-requests`;
export const DOCTORS_API_URL = `${API_BASE}/doctors`;

