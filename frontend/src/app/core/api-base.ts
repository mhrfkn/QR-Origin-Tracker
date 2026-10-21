/**
 * Returns the API base URL at runtime.
 *
 * - When accessed via localhost (Angular dev proxy) → empty string so relative
 *   paths like /api/... are proxied by the dev server to localhost:8080.
 * - When accessed via any external hostname (Serveo tunnel, LAN IP, etc.)
 *   → points directly at the backend Serveo tunnel so mobile phones and
 *   external devices can reach the API without going through the dev proxy.
 *
 * The backend tunnel URL is injected by start-serveo.ps1 into
 * src/environments/api-url.ts at startup.
 */
export function apiBase(): string {
  if (typeof window === 'undefined') return '';
  const host = window.location.hostname;
  // localhost or 127.x.x.x → use dev proxy (relative URLs)
  if (host === 'localhost' || host === '127.0.0.1') return '';
  // Any external host → use backend tunnel URL baked in at startup
  return (window as any).__BACKEND_API_URL__ ?? '';
}
