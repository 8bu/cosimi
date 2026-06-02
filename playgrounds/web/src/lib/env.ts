/**
 * Base URL for every backend call.
 *
 * Defaults to '/api' so dev hits the Vite proxy (which strips '/api' and
 * forwards to http://localhost:3000). In production set VITE_API_BASE to
 * an absolute origin only if the SPA is served from a different host than
 * apps/api — co-located reverse-proxy deployments should keep the default
 * and route /api/* server-side. CORS becomes a concern only when this is
 * cross-origin; see SPEC_PHASE_10.md.
 */
export const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
