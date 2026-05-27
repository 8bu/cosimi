type WordmarkProps = {
  size?: number;
  sub?: string | null;
};

/**
 * 8BU wordmark - single variant.
 *
 * Spec §7 fixes the logo to `blockcursor` (Silkscreen "8BU" badge + blinking
 * caret) for v1. The original design's other four logo variants are
 * intentionally not ported; if a runtime logo switcher is wanted later,
 * port them at that time. The CSS that styles `.wm-mark-blockcursor*` and
 * `.wm-blink-caret` lives in `apps/portf/src/styles/portfolio.css`.
 *
 * The `.wm-mark` block-level selector in portfolio.css sets `display: none`
 * by default and relies on a `[data-logo="…"] .wm-mark-<variant>` selector
 * to opt in. Since v1 ships only blockcursor, the JSX skips the wrapper
 * and renders the blockcursor markup with inline `display: inline-flex` to
 * bypass the default-hidden state.
 */
export function Wordmark({ size = 14, sub = "Senior Web Developer" }: WordmarkProps) {
  return (
    <span className="wm" style={{ fontSize: size }}>
      <span className="wm-mark wm-mark-blockcursor" style={{ display: "inline-flex" }}>
        <span className="wm-mark-blockcursor-badge" style={{ fontSize: size * 0.62 }}>
          8BU<span className="wm-blink-caret">_</span>
        </span>
      </span>
      <span className="wm-text" style={{ fontSize: size }}>
        Long NGUYỄN
      </span>
      {sub ? <span className="wm-sub">- {sub}</span> : null}
    </span>
  );
}
