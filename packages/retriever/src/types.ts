import type postgres from "postgres";

/**
 * The postgres client accessor. Injected by the caller (the SDK threads the
 * consumer's adapter client here) so this package has no dependency on any
 * concrete adapter. It's the *accessor* (a function), not the client instance,
 * so Cloudflare Workers' request-scoped ALS resolution happens at call time —
 * exactly as the adapter's own `sql()` does.
 */
export type SqlAccessor = () => ReturnType<typeof postgres>;
