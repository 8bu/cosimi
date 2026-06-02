import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { closeDb, sql } from "@cosimi/adapter-postgres";

import { sweepOnce } from "../src/lib/gc";
import { newSessionId, resetDb } from "./helpers";

/**
 * GC sweeper integration test. Real Postgres via the shared `cosimi_test`
 * database (see test/global-setup.ts). We seed expired and live rows
 * across both target tables, run sweepOnce, and assert the affected counts
 * + the surviving set.
 */
describe("gc.sweepOnce", () => {
  beforeEach(async () => {
    await resetDb();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns {0,0} when nothing is expired", async () => {
    const sid = newSessionId();
    await sql()`
      INSERT INTO sessions (session_id, expires_at)
      VALUES (${sid}, NOW() + INTERVAL '1 hour')
    `;

    const result = await sweepOnce();

    expect(result).toEqual({ sessions: 0, teaches: 0 });
    const live = await sql()<{ count: string }[]>`SELECT COUNT(*)::text FROM sessions`;
    expect(live[0]?.count).toBe("1");
  });

  it("deletes expired sessions", async () => {
    const expired = newSessionId();
    const live = newSessionId();
    await sql()`
      INSERT INTO sessions (session_id, expires_at) VALUES
        (${expired}, NOW() - INTERVAL '1 minute'),
        (${live},    NOW() + INTERVAL '1 hour')
    `;

    const result = await sweepOnce();

    expect(result.sessions).toBe(1);
    expect(result.teaches).toBe(0);
    const survivors = await sql()<{ session_id: string }[]>`
      SELECT session_id FROM sessions ORDER BY session_id
    `;
    expect(survivors.map((r) => r.session_id)).toEqual([live]);
  });

  it("deletes expired session_teaches", async () => {
    // session_teaches.teach_queue_id is a NOT NULL FK; spin up a minimal
    // queue row to satisfy it. The GC doesn't care about teach_queue itself.
    const submitter = newSessionId();
    const [queueRow] = await sql()<{ id: number }[]>`
      INSERT INTO teach_queue (input, normalized_input, response, submitted_by_session)
      VALUES ('hi', 'hi', 'hello!', ${submitter})
      RETURNING id::int AS id
    `;
    const queueId = queueRow!.id;

    const owner = newSessionId();
    await sql()`
      INSERT INTO session_teaches (session_id, normalized_input, response, teach_queue_id, expires_at)
      VALUES
        (${owner}, 'a', 'A', ${queueId}, NOW() - INTERVAL '1 minute'),
        (${owner}, 'b', 'B', ${queueId}, NOW() + INTERVAL '10 minutes')
    `;

    const result = await sweepOnce();

    expect(result.sessions).toBe(0);
    expect(result.teaches).toBe(1);
    const survivors = await sql()<{ normalized_input: string }[]>`
      SELECT normalized_input FROM session_teaches ORDER BY normalized_input
    `;
    expect(survivors.map((r) => r.normalized_input)).toEqual(["b"]);
  });

  it("sweeps both tables in one call", async () => {
    const sid = newSessionId();
    const submitter = newSessionId();
    const [queueRow] = await sql()<{ id: number }[]>`
      INSERT INTO teach_queue (input, normalized_input, response, submitted_by_session)
      VALUES ('hi', 'hi', 'hello!', ${submitter})
      RETURNING id::int AS id
    `;
    const queueId = queueRow!.id;

    await sql()`
      INSERT INTO sessions (session_id, expires_at) VALUES (${sid}, NOW() - INTERVAL '1 minute')
    `;
    await sql()`
      INSERT INTO session_teaches (session_id, normalized_input, response, teach_queue_id, expires_at)
      VALUES (${sid}, 'x', 'X', ${queueId}, NOW() - INTERVAL '1 minute')
    `;

    expect(await sweepOnce()).toEqual({ sessions: 1, teaches: 1 });
    expect(await sweepOnce()).toEqual({ sessions: 0, teaches: 0 });
  });
});
