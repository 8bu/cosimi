import { useMemo } from "react";
import { usePreferences, type Locale } from "@/store/preferences";
import { en } from "./en";
import type { vi } from "./vi";

// en is the eager baseline + runtime fallback (matches DEFAULT_LOCALE in
// preferences.ts — whichever locale is the default should be eagerly
// bundled so first paint never blocks on a chunk load). vi remains the
// *type-level* canonical key source — its `as const`-style object shape
// is what en.ts's `typeof vi` annotation enforces — but it's imported
// type-only here, so it doesn't ship in the main chunk. vi loads lazily
// on demand.

type Dict = typeof vi;

// Lazy loaders. en resolves synchronously from the eager import; vi
// dynamic-imports its chunk on first need (Vite emits a separate
// vi-*.js). Add a 3rd locale by appending here + the `Locale` union in
// preferences.ts; everything else cascades.
const LOADERS: Record<Locale, () => Promise<Dict>> = {
  en: () => Promise.resolve(en),
  vi: () => import("./vi").then((m) => m.vi),
};

// Module-level cache. en is pre-seeded so the very first render (and any
// translate() call before loadLocale awaits) gets a populated baseline.
const CACHE: Partial<Record<Locale, Dict>> = { en };

/**
 * Idempotently load `locale`'s dict and cache it. Subsequent calls return
 * the cached dict synchronously (wrapped in a resolved Promise). Call
 * this before flipping `primaryLocale` in the preferences store — the
 * LocaleSwitcher awaits this, so by the time the store update fires,
 * translate() / getLoadedDict() can read the dict synchronously.
 *
 * App boot (main.tsx) also awaits this for the *persisted* locale so the
 * first render is correct (no flash from baseline-en → persisted-vi).
 */
export async function loadLocale(locale: Locale): Promise<Dict> {
  const cached = CACHE[locale];
  if (cached) return cached;
  const dict = await LOADERS[locale]();
  CACHE[locale] = dict;
  return dict;
}

/**
 * Synchronous read of a loaded dict. Falls back to en when the requested
 * locale hasn't been loaded yet — the right call for `translate()`'s
 * runtime safety (a missed preload returns sensible text, not undefined).
 */
export function getLoadedDict(locale: Locale): Dict {
  return CACHE[locale] ?? en;
}

// TranslationKey excludes keys whose value is an array — those are pools,
// not chrome strings, and translate() is string-typed. Pool reads go
// through getLoadedDict() (see chat store's no_match handling).
type StringKeys<T> = { [K in keyof T]: T[K] extends string ? K : never }[keyof T];
export type TranslationKey = StringKeys<Dict>;

/**
 * Pure translation helper — testable without a React renderer. Resolution
 * order: requested locale → en (eager baseline fallback) → the key itself
 * (escape hatch for development; a missing key is visible at a glance
 * instead of rendering an empty string).
 */
export function translate(locale: Locale, key: TranslationKey | string): string {
  const dict = getLoadedDict(locale) as Record<string, unknown>;
  const fallback = en as Record<string, unknown>;
  const v = dict[key] ?? fallback[key];
  return typeof v === "string" ? v : key;
}

/**
 * Hook wrapper. The returned `t` is memoized per-locale so a parent
 * component re-rendering doesn't churn child memo deps. Interpolation
 * (`{count}`, `{input}`, …) stays caller-side via String.prototype.replace
 * — see CLAUDE.md "i18n helper doesn't ship a vars overload."
 */
export function useTranslate(): (key: TranslationKey) => string {
  const locale = usePreferences((s) => s.primaryLocale);
  return useMemo(() => (key: TranslationKey) => translate(locale, key), [locale]);
}
