import postgres from "postgres";

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
interface SpikeEnv {
  HYPERDRIVE: { connectionString: string };
}

/**
 * Veto-gate spike: prove postgres.js -> Hyperdrive -> Neon before building on
 * the real worker. Returns JSON with a literal SELECT and a parameterized
 * SELECT (the latter exercises prepared statements, which can fail behind a
 * transaction pooler - if `paramOk` is false with a prepared-statement error,
 * the real worker's @cosimi/db client needs `prepare: false`).
 */
export default {
  async fetch(_req: Request, env: SpikeEnv, _ctx: ExecutionContext): Promise<Response> {
    const sql = postgres(env.HYPERDRIVE.connectionString, { max: 1, idle_timeout: 10 });
    try {
      const [{ one }] = await sql`SELECT 1 AS one`;
      const probe = 42;
      const [{ echoed }] = await sql`SELECT ${probe}::int AS echoed`;
      return Response.json({ ok: true, one, paramOk: echoed === probe });
    } catch (err) {
      return Response.json(
        { ok: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 },
      );
    } finally {
      await sql.end();
    }
  },
};
