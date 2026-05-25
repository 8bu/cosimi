import { sql, insertManyPairs, type InsertPairInput } from "@simlm/db";

export const SESSION_ID = "11111111-1111-1111-1111-111111111111";

export interface FixtureIds {
  exactPairId: number;
  helloPairId: number;
  deletedPairId: number;
  ftsPairIds: number[];
  pingPairIds: number[];
}

export async function loadFixtures(): Promise<FixtureIds> {
  const db = sql();

  // Start from a known-empty state. CASCADE handles the session_teaches →
  // teach_queue FK and the votes → pairs FK.
  await db`
    TRUNCATE pairs, session_teaches, sessions, teach_queue, import_batches, votes, unanswered
    RESTART IDENTITY CASCADE
  `;

  // All writes go through @simlm/db's canonical insertManyPairs path; that
  // keeps the test honest about the production code path (no direct
  // INSERT INTO pairs that bypasses normalization / generated columns).
  // Pre-Phase-11.1 rows are untagged (default 'und' at the column); the
  // locale-cascade tests append vi/en fixtures via seedLocaleFixtures().
  const rows: InsertPairInput[] = [
    { input: "Xin chào", response: "chào bạn!", source: "seed" },
    { input: "hello", response: "hi there", source: "seed" },
    // FTS-friendly: canonical phrase + near-variants so ts_rank has options.
    { input: "how are you doing today?", response: "i'm fine", source: "seed" },
    { input: "are you doing well today", response: "pretty good", source: "seed" },
    { input: "you doing alright", response: "all good", source: "seed" },
    // Soft-delete target — unique words so it doesn't get fuzzy-confused.
    { input: "reveal the secret password", response: "shh, classified", source: "seed" },
    // Random-pick: three rows with identical normalized_input.
    { input: "ping", response: "pong", source: "seed" },
    { input: "ping", response: "hi", source: "seed" },
    { input: "ping", response: "yo", source: "seed" },
  ];

  await insertManyPairs(rows);

  // `id::int AS id` mirrors the matcher tier SELECTs — BIGSERIAL ships as
  // a string through postgres.js by default, so the cast is what keeps
  // fixture ids as JS numbers matching MatchResult.pairId (also a number).
  const inserted = await db<{ id: number; input: string }[]>`
    SELECT id::int AS id, input FROM pairs ORDER BY id ASC
  `;
  const find = (input: string) => inserted.find((r) => r.input === input)!.id;
  const findAll = (input: string) => inserted.filter((r) => r.input === input).map((r) => r.id);

  const exactPairId = find("Xin chào");
  const helloPairId = find("hello");
  const deletedPairId = find("reveal the secret password");
  const ftsPairIds = [
    find("how are you doing today?"),
    find("are you doing well today"),
    find("you doing alright"),
  ];
  const pingPairIds = findAll("ping");

  // Soft-delete after insert so the row exists with a stable id we can assert on.
  await db`UPDATE pairs SET deleted_at = NOW() WHERE id = ${deletedPairId}`;

  return { exactPairId, helloPairId, deletedPairId, ftsPairIds, pingPairIds };
}

/**
 * Locale-aware fixtures for Phase 11.1 cascade tests. Layered on top of
 * loadFixtures() (which seeds 'und'-tagged rows by default) — we add a
 * mixed-locale slice: 'meo meo' has both a vi and en pair; 'cat sound'
 * exists only in en; 'only-und' exists only in 'und'. The cascade test
 * exercises:
 *   (a) vi primary against 'meo meo' returns the vi row
 *   (b) en primary against 'meo meo' returns the en row
 *   (c) vi primary against 'cat sound' falls through to en if the
 *       request includes en as a fallback locale
 *   (d) vi primary against 'only-und' returns the und row via the
 *       per-tier locale='und' overlap (no fallback iteration needed)
 */
export interface LocaleFixtureIds {
  meoViId: number;
  meoEnId: number;
  catEnId: number;
  onlyUndId: number;
}

export async function seedLocaleFixtures(): Promise<LocaleFixtureIds> {
  const rows: InsertPairInput[] = [
    { input: "meo meo", response: "bé mèo đáng iu", source: "seed", locale: "vi" },
    { input: "meo meo", response: "pusi pusi pusi", source: "seed", locale: "en" },
    { input: "cat sound", response: "meow!", source: "seed", locale: "en" },
    { input: "universal greeting", response: "hello, friend", source: "seed", locale: "und" },
  ];
  await insertManyPairs(rows);
  const db = sql();
  const inserted = await db<{ id: number; input: string; locale: string }[]>`
    SELECT id::int AS id, input, locale FROM pairs
    WHERE input IN ('meo meo', 'cat sound', 'universal greeting')
    ORDER BY id ASC
  `;
  const findBy = (input: string, locale: string) =>
    inserted.find((r) => r.input === input && r.locale === locale)!.id;
  return {
    meoViId: findBy("meo meo", "vi"),
    meoEnId: findBy("meo meo", "en"),
    catEnId: findBy("cat sound", "en"),
    onlyUndId: findBy("universal greeting", "und"),
  };
}

// session_teaches.teach_queue_id is NOT NULL with a real FK; create a queue row
// first. The values mirror what Phase 5's /teach endpoint will write — fine
// for testing the matcher's read path in isolation.
export async function seedSessionTeach(
  sessionId: string,
  normalizedInput: string,
  response: string,
): Promise<void> {
  const db = sql();
  const queue = await db<{ id: number }[]>`
    INSERT INTO teach_queue (input, normalized_input, response, submitted_by_session, status)
    VALUES (${normalizedInput}, ${normalizedInput}, ${response}, ${sessionId}::uuid, 'approved')
    RETURNING id
  `;
  await db`
    INSERT INTO session_teaches
      (session_id, normalized_input, response, teach_queue_id, expires_at)
    VALUES (
      ${sessionId}::uuid,
      ${normalizedInput},
      ${response},
      ${queue[0]!.id},
      NOW() + INTERVAL '10 minutes'
    )
  `;
}
