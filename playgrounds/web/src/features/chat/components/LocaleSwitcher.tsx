import { usePreferences, SUPPORTED_LOCALES, type Locale } from "@/store/preferences";
import { loadLocale, useTranslate } from "@/lib/i18n";

// Display labels for the locale options. Each language's name is in its
// own language (autoglottonyms) — standard practice for switchers, so a
// user who landed on the wrong default can find their language without
// having to read the current one.
const OPTION_LABEL: Record<Locale, string> = {
  vi: "Tiếng Việt",
  en: "English",
};

/**
 * Native <select> is deliberate (see CLAUDE.md / spec): free a11y, free
 * mobile UX (each platform's native picker), zero JS. A custom popover
 * here would be all downside — focus traps, escape handling, RTL, etc.
 *
 * Styled as a quiet trailing chrome element (no border, transparent bg)
 * so it sits in the header without competing with the title.
 *
 * onChange awaits the dynamic-imported dict before flipping the
 * preference — atomic from the renderer's perspective, no flash of vi
 * strings while the en chunk is in-flight.
 */
export function LocaleSwitcher() {
  const primary = usePreferences((s) => s.primaryLocale);
  const setPrimary = usePreferences((s) => s.setPrimaryLocale);
  const t = useTranslate();
  return (
    <select
      value={primary}
      onChange={async (e) => {
        const target = e.target.value as Locale;
        await loadLocale(target);
        setPrimary(target);
      }}
      className="text-xs bg-transparent border-none outline-none cursor-pointer text-muted-foreground hover:text-foreground focus:ring-2 focus:ring-primary/40 rounded"
      aria-label={t("localeSwitcher.label")}
    >
      {SUPPORTED_LOCALES.map((l) => (
        <option key={l} value={l}>
          {OPTION_LABEL[l]}
        </option>
      ))}
    </select>
  );
}
