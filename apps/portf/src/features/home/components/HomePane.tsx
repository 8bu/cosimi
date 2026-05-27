import { useRef } from "react";
import { ChipRow } from "./ChipRow";
import { Composer, type ComposerHandle } from "./Composer";
import { SpotlightHeadline } from "./SpotlightHeadline";
import { SUGGESTION_CHIPS } from "../data";

/**
 * V2 spotlight composition root.
 *
 * Centered headline + sub-line, composer, suggestion chips, hint line.
 * Faithful to design source layout
 * (docs/superpowers/artifacts/simlm2/project/variations-1-2.jsx:140-176)
 * minus the desktop frame chrome (Wordmark header + "Open for senior roles"
 * pill) — those land in Phase E as PortfShell concerns.
 *
 * Layout is inline-styled (flex, gap) rather than adding new classes to
 * portfolio.css, which is locked for verbatim preservation.
 */
export function HomePane() {
  const composerRef = useRef<ComposerHandle>(null);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "22px 28px",
        gap: 0,
      }}
    >
      <SpotlightHeadline />
      <div style={{ width: 560, maxWidth: "100%" }}>
        <Composer ref={composerRef} />
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: 18,
          }}
        >
          <ChipRow
            chips={SUGGESTION_CHIPS}
            onPick={(label) => composerRef.current?.runChipAnimation(label)}
          />
        </div>
        <div
          style={{
            marginTop: 20,
            textAlign: "center",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: "var(--ink-4)",
          }}
        >
          try · "show me your CV" · "what have you been writing?" · "give me
          your stack"
        </div>
      </div>
    </main>
  );
}
