import { renderTemplate } from "@simlm/template";

// Single source of truth for the product/bot brand name as it appears in
// user-facing chrome. Importers should reference `BRAND.name` or use the
// `withBrand()` helper rather than hardcoding the string, so a future
// rebrand is a one-file edit here.
//
// What's in scope:
//   - product display name (page title, header h1)
//   - bot identity in UI chrome (role labels, composer placeholder)
//
// What's NOT in scope (deliberately):
//   - the localStorage key prefix `simlm.*` — that's a stable storage
//     contract, not chrome. Renaming it breaks every existing session.
//   - the server's `app_config.name` template substitution — server-
//     owned data, lives in a DB migration. If you want the bot's
//     self-introduction ("mình tên {{ name }}…") to follow the brand,
//     update that row separately.
//
// The role-label uppercase form (e.g. "SIMML" in the bot-message header)
// is rendered via CSS `text-transform: uppercase` at the call site —
// keeping a single canonical brand string here means a multi-cased name
// (mixed-case acronyms, special characters) renders consistently.

export const BRAND = {
  /** Canonical brand name, cased for prose: titles, headers, embedded in sentences. */
  name: "SimML",
} as const;

/**
 * Substitute `{{ brand }}` placeholders in a translated string. Uses the
 * shared `@simlm/template` engine — the same Mustache-ish syntax the
 * server uses for `{{ name }}` substitution in chat replies, so
 * contributors learn one interpolation convention.
 *
 * Use at the call site:
 *
 *   "composer.placeholder": "Message {{ brand }}…" + withBrand(t("composer.placeholder"))
 *
 * The renderer is case-insensitive on keys (`{{ Brand }}`, `{{ BRAND }}`
 * all resolve to `vars.brand`), so visual uppercase belongs in CSS
 * (`text-transform: uppercase`), not in a separate placeholder.
 */
export function withBrand(s: string): string {
  return renderTemplate(s, { brand: BRAND.name });
}
