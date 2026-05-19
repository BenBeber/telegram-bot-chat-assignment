const fallbackWsUrl = () => {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.hostname}:8000/ws`;
};

export const WS_URL = import.meta.env.VITE_WS_URL ?? fallbackWsUrl();
export const PENDING_TTL_MS = 5_000;
export const RECONNECT_INITIAL_MS = 1_000;
export const RECONNECT_MAX_MS = 30_000;
export const MAX_MESSAGES = 500;