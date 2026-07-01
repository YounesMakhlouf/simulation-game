// Central client configuration.
//
// The API base URL is resolved with the following priority:
//   1. Build-time API_BASE_URL, injected by webpack's DefinePlugin (set the
//      API_BASE_URL environment variable when building for deployment).
//   2. HTTPS host heuristic for GitHub Codespaces (swap the 8080 UI port for
//      the 8000 API port).
//   3. http://localhost:8000 for local development.

const BUILD_TIME_API_URL =
  typeof API_BASE_URL !== "undefined" ? API_BASE_URL : "";

export function getApiBaseUrl() {
  if (BUILD_TIME_API_URL) {
    return BUILD_TIME_API_URL;
  }

  const { protocol, hostname } = window.location;
  if (protocol === "https:") {
    return `https://${hostname.replace("8080", "8000")}`;
  }
  return "http://localhost:8000";
}

export function getWebSocketBaseUrl() {
  // Derive the WebSocket URL from the API URL so http->ws and https->wss stay
  // in sync (the old code always used ws://, which breaks under HTTPS).
  return getApiBaseUrl().replace(/^http/, "ws");
}

// --- Networking timings (milliseconds) ---
export const REQUEST_TIMEOUT_MS = 15000;
export const POLL_INTERVAL_MS = 5000;
// Stop polling for a new round after this many attempts (~5 min at 5s each).
export const POLL_MAX_ATTEMPTS = 60;
// Give up if this many consecutive polls fail to reach the server.
export const POLL_MAX_CONSECUTIVE_FAILURES = 3;
