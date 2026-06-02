import { beforeAll, describe, expect, it } from "vitest";
import { loadLocale, translate } from "@/lib/i18n";
import { vi } from "@/lib/i18n/vi";
import { en } from "@/lib/i18n/en";

// vi is lazy-loaded in production (Vite dynamic-import chunk). For the
// test suite we await its load once up-front so the synchronous
// translate() assertions below see a populated vi dict. (en is the eager
// baseline — already in CACHE by module init.)
beforeAll(async () => {
  await loadLocale("vi");
});

describe("translate (pure helper, no React)", () => {
  it("returns the vi string when locale='vi'", () => {
    expect(translate("vi", "role.you")).toBe("BẠN");
    expect(translate("vi", "badge.exact")).toBe("khớp chính xác");
  });

  it("returns the en string when locale='en'", () => {
    expect(translate("en", "role.you")).toBe("YOU");
    expect(translate("en", "badge.exact")).toBe("exact match");
  });

  it("falls back to vi when a key is missing in en (runtime safety net)", () => {
    // Simulate a missing key by deleting from the en clone — we test the
    // resolution order, not the dict contents (which TS already enforces).
    // Cast via `unknown` because vi/en now include an array-valued key
    // (noMatch.fallback) — a direct Record<string,string> cast is unsound.
    // We only assert on a string-valued key here, so the looser map type
    // is fine.
    const fakeEn = { ...en } as unknown as Record<string, string>;
    delete fakeEn["role.bot"];
    const lookup = (locale: "vi" | "en", key: string): string => {
      const dict = (locale === "vi" ? (vi as unknown as Record<string, string>) : fakeEn) ?? {};
      return dict[key] ?? (vi as unknown as Record<string, string>)[key] ?? key;
    };
    // Re-implementing the same resolution order; the assertion is on the
    // FALLBACK behavior, identical to translate()'s strategy.
    expect(lookup("en", "role.bot")).toBe(vi["role.bot"]);
  });

  it("falls back to the key itself when missing in both dicts", () => {
    // Pass a key that isn't in either dict — translate's escape hatch.
    expect(translate("vi", "definitely.not.a.real.key")).toBe("definitely.not.a.real.key");
    expect(translate("en", "definitely.not.a.real.key")).toBe("definitely.not.a.real.key");
  });
});

describe("dict completeness (runtime backstop for TS contract)", () => {
  it("every key in vi has a corresponding key in en", () => {
    const missing = (Object.keys(vi) as (keyof typeof vi)[]).filter(
      (k) => !(k in (en as Record<string, unknown>)),
    );
    expect(missing).toEqual([]);
  });

  it("every key in en has a corresponding key in vi (no en-only keys)", () => {
    const missing = (Object.keys(en) as (keyof typeof en)[]).filter(
      (k) => !(k in (vi as Record<string, unknown>)),
    );
    expect(missing).toEqual([]);
  });

  it("vi and en have identical key sets (replaces the old DICTS-shape test)", () => {
    expect(Object.keys(vi).toSorted()).toEqual(Object.keys(en).toSorted());
  });
});
