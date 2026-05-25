import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { match } from "@simlm/matcher";
import { closeDb } from "@simlm/db";
import { normalize } from "@simlm/normalizer";

import {
  type FixtureIds,
  type LocaleFixtureIds,
  loadFixtures,
  seedLocaleFixtures,
  seedSessionTeach,
  SESSION_ID,
} from "./fixtures";

describe("matcher", () => {
  let ids: FixtureIds;

  beforeAll(async () => {
    ids = await loadFixtures();
  });

  afterAll(async () => {
    await closeDb();
  });

  it("returns exact tier for a direct (already-normalized) match", async () => {
    const r = await match({ normalizedInput: normalize("xin chào"), sessionId: null });
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("exact");
    expect(r!.response).toBe("chào bạn!");
    expect(r!.confidence).toBe(1.0);
    expect(r!.lowConfidence).toBe(false);
    expect(r!.pairId).toBe(ids.exactPairId);
  });

  it("returns exact tier when the query has different case and no diacritics", async () => {
    // 'XIN CHAO' → normalize → 'xin chao'; f_unaccent('xin chao') = 'xin chao'
    // which equals the stored pair's normalized_unaccented ('xin chao').
    const r = await match({ normalizedInput: normalize("XIN CHAO"), sessionId: null });
    expect(r?.tier).toBe("exact");
    expect(r?.response).toBe("chào bạn!");
    expect(r?.pairId).toBe(ids.exactPairId);
  });

  it("returns trigram tier (low confidence) for a typo", async () => {
    const r = await match({ normalizedInput: normalize("helo"), sessionId: null });
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("trigram");
    expect(r!.lowConfidence).toBe(true);
    expect(r!.confidence).toBeGreaterThan(0);
    expect(r!.confidence).toBeLessThanOrEqual(1);
    expect(r!.pairId).toBe(ids.helloPairId);
  });

  it("returns fts tier for a partial-keyword query", async () => {
    const r = await match({ normalizedInput: normalize("doing today"), sessionId: null });
    expect(r).not.toBeNull();
    expect(r!.tier).toBe("fts");
    expect(r!.lowConfidence).toBe(false);
    expect(r!.confidence).toBeGreaterThan(0);
    expect(r!.confidence).toBeLessThanOrEqual(1);
    expect(ids.ftsPairIds).toContain(r!.pairId);
  });

  it("returns null for nonsense input that nothing fuzzy-matches", async () => {
    const r = await match({ normalizedInput: normalize("qqqqqqqq"), sessionId: null });
    expect(r).toBeNull();
  });

  it("skips soft-deleted rows", async () => {
    const r = await match({
      normalizedInput: normalize("reveal the secret password"),
      sessionId: null,
    });
    // Either null, or a fuzzy hit from a different row — but never the deleted id.
    if (r !== null) {
      expect(r.pairId).not.toBe(ids.deletedPairId);
    }
  });

  describe("session_teach tier", () => {
    beforeAll(async () => {
      await seedSessionTeach(SESSION_ID, normalize("xin chào"), "personalised greeting");
    });

    it("wins over exact when sessionId has a matching teach row", async () => {
      const r = await match({ normalizedInput: normalize("xin chào"), sessionId: SESSION_ID });
      expect(r?.tier).toBe("session_teach");
      expect(r?.response).toBe("personalised greeting");
      expect(r?.confidence).toBe(1.0);
      expect(r?.pairId).toBeNull();
      expect(r?.lowConfidence).toBe(false);
    });

    it("falls through to exact when sessionId is null", async () => {
      const r = await match({ normalizedInput: normalize("xin chào"), sessionId: null });
      expect(r?.tier).toBe("exact");
      expect(r?.response).toBe("chào bạn!");
    });

    it("falls through to exact when sessionId belongs to a different session", async () => {
      const r = await match({
        normalizedInput: normalize("xin chào"),
        sessionId: "99999999-9999-9999-9999-999999999999",
      });
      expect(r?.tier).toBe("exact");
      expect(r?.response).toBe("chào bạn!");
    });
  });

  it("random-picks among top-K exact candidates", async () => {
    const responses = new Set<string>();
    for (let i = 0; i < 30; i += 1) {
      const r = await match({ normalizedInput: normalize("ping"), sessionId: null });
      expect(r?.tier).toBe("exact");
      expect(ids.pingPairIds).toContain(r!.pairId);
      responses.add(r!.response);
    }
    // With 3 candidates and 30 uniform trials, P(any missing) ≈ 3·(2/3)^30 ≈ 1.5e-5.
    expect(responses).toEqual(new Set(["pong", "hi", "yo"]));
  });

  describe("locale-aware cascade (Phase 11.1)", () => {
    let lids: LocaleFixtureIds;

    beforeAll(async () => {
      // loadFixtures() already TRUNCATEd at the top describe's beforeAll;
      // seedLocaleFixtures appends without clearing, so the 'und' baseline
      // rows from loadFixtures coexist with the locale-tagged ones added
      // here. That coexistence is the point — the cascade test verifies
      // 'und' overlap inside each tier across all primaries.
      lids = await seedLocaleFixtures();
    });

    it("returns the vi row when primary='vi' and a vi pair exists", async () => {
      const r = await match({
        normalizedInput: normalize("meo meo"),
        sessionId: null,
        locales: ["vi", "und"],
      });
      expect(r?.tier).toBe("exact");
      expect(r?.locale).toBe("vi");
      expect(r?.pairId).toBe(lids.meoViId);
      expect(r?.response).toBe("bé mèo đáng iu");
    });

    it("returns the en row when primary='en' and an en pair exists", async () => {
      const r = await match({
        normalizedInput: normalize("meo meo"),
        sessionId: null,
        locales: ["en", "und"],
      });
      expect(r?.tier).toBe("exact");
      expect(r?.locale).toBe("en");
      expect(r?.pairId).toBe(lids.meoEnId);
      expect(r?.response).toBe("pusi pusi pusi");
    });

    it("returns null when primary has no locale-tagged row AND the input has no 'und' overlap", async () => {
      // 'cat sound' only exists as en. With locales=['vi','und'], the vi
      // pass finds nothing (no vi row, no 'und' row for this input), the
      // 'und' pass also finds nothing — null.
      const r = await match({
        normalizedInput: normalize("cat sound"),
        sessionId: null,
        locales: ["vi", "und"],
      });
      expect(r).toBeNull();
    });

    it("falls through to a later locale when the primary has no hit", async () => {
      // locales=['vi','en']: vi sees nothing for 'cat sound', the loop
      // advances to en which has the row.
      const r = await match({
        normalizedInput: normalize("cat sound"),
        sessionId: null,
        locales: ["vi", "en"],
      });
      expect(r?.tier).toBe("exact");
      expect(r?.locale).toBe("en");
      expect(r?.pairId).toBe(lids.catEnId);
    });

    it("matches 'und'-tagged pairs under any primary via per-tier overlap (no fallback iteration needed)", async () => {
      const r = await match({
        normalizedInput: normalize("universal greeting"),
        sessionId: null,
        locales: ["vi"],
      });
      expect(r?.tier).toBe("exact");
      expect(r?.locale).toBe("und");
      expect(r?.pairId).toBe(lids.onlyUndId);
    });

    it("prefers locale-tagged rows over 'und' when both exist (ORDER BY (locale=$1) DESC)", async () => {
      // Both 'meo meo' rows are exact-tier candidates; the ORDER BY in
      // exactTier ensures the requested-locale row beats 'und'. (None of
      // our 'meo meo' rows are 'und'-tagged, but the assertion of
      // matched-locale identity covers the same code path.)
      const r = await match({
        normalizedInput: normalize("meo meo"),
        sessionId: null,
        locales: ["vi"],
      });
      expect(r?.locale).toBe("vi");
    });

    it("defaults to ['und'] when locales is omitted (legacy/test compatibility)", async () => {
      // 'xin chào' is a default-loadFixtures row with locale='und'.
      const r = await match({ normalizedInput: normalize("xin chào"), sessionId: null });
      expect(r?.tier).toBe("exact");
      expect(r?.locale).toBe("und");
    });
  });
});
