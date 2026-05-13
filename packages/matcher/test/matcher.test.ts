import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { match } from "@simlm/matcher";
import { closeDb } from "@simlm/db";
import { normalize } from "@simlm/normalizer";

import { type FixtureIds, loadFixtures, seedSessionTeach, SESSION_ID } from "./fixtures";

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
});
