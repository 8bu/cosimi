/**
 * Base URL for every admin-api call. Same convention as apps/web — '/api'
 * default routes through the Vite dev proxy (which targets
 * http://127.0.0.1:3001 and strips the prefix). In production this must
 * be served behind a reverse proxy that:
 *
 *   1. Refuses external traffic on the /api/* path entirely (admin-api is
 *      operator-only), OR
 *   2. Sits behind an authenticated tunnel (Tailscale / Cloudflare Access
 *      / VPN) and forwards /api/* → loopback:3001 with the same /api strip.
 *
 * Override VITE_API_BASE only when the admin SPA is served from a
 * different origin than apps/admin-api — in which case CORS becomes a
 * concern too.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
