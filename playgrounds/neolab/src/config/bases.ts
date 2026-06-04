// The two backends. In dev the Vite proxy maps these prefixes to :3000/:3001,
// so relative prefixes are all we need.
export const API_BASE = "/api"; // public retrieve api (:3000 via proxy)
export const ADMIN_BASE = "/admin"; // loopback ingest/admin api (:3001 via proxy)
