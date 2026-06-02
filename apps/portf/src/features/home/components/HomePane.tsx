import { useRef } from "react";
import { Wordmark } from "@/components/Wordmark";
import { ChipRow } from "./ChipRow";
import { Composer, type ComposerHandle } from "./Composer";
import { SpotlightHeadline } from "./SpotlightHeadline";
import { useSampledChips } from "../use-sampled-chips";

/**
 * V2 spotlight composition root.
 *
 * Shape ported from the design source's `V2Desktop`
 * (`docs/superpowers/artifacts/cosimi2/project/variations-1-2.jsx`
 * line 140–189): full-height flex column, top bar (Wordmark + status
 * pill, space-between), centered headline block in a 560px column
 * (Composer + Chips + hint line) inside a `flex: 1` middle.
 *
 * Wordmark uses default props (size=14, sub="Senior Web Developer")
 * to match the design's V2 placement - distinct from the sidebar's
 * compact `sub={null} size={13}` call. Layout is inline-styled rather
 * than adding classes to portfolio.css (which is locked for verbatim
 * preservation).
 */
export function HomePane() {
  const composerRef = useRef<ComposerHandle>(null);
  const chips = useSampledChips(5);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100%",
        padding: "22px 28px",
      }}
    >
      {/* Top bar - Wordmark left, "open for roles" status pill right. */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Wordmark />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-3)",
          }}
        >
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--coral)",
              display: "inline-block",
            }}
          />
          <span>Open for senior roles · Q3 '26</span>
        </div>
      </div>

      {/* Middle - centered headline + composer column. */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 60,
        }}
      >
        <SpotlightHeadline />
        <div style={{ width: 720, maxWidth: "100%" }}>
          <Composer ref={composerRef} />
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              marginTop: 18,
            }}
          >
            <ChipRow
              chips={chips}
              onPick={(label) => composerRef.current?.runChipAnimation(label)}
            />
          </div>
          <div
            style={{
              marginTop: 20,
              textAlign: "center",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "var(--ink-4)",
            }}
          >
            try · "show me your CV" · "what have you been writing?" · "give me your stack"
          </div>
        </div>
      </div>
    </main>
  );
}
