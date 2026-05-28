import { type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from "react";

interface ArtifactPanelProps {
  kicker: string;
  title: string;
  meta?: string;
  action?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Chrome wrapper for the artifact pane. Ported from
 * `docs/superpowers/artifacts/simlm2/project/flow-and-pages.jsx:273-306`.
 *
 * Renders BOTH the desktop `×` close button AND the mobile `← BACK` pill in
 * the DOM unconditionally. `layout.css` (Task 12) shows one per viewport via
 * media query. Both call onClose. Esc on a focused section also closes,
 * unless focus is inside an input/textarea/contentEditable.
 */
export function ArtifactPanel({ kicker, title, meta, action, onClose, children }: ArtifactPanelProps) {
  function onKeyDown(e: ReactKeyboardEvent<HTMLElement>) {
    if (e.key !== "Escape") return;
    const el = document.activeElement as HTMLElement | null;
    if (el) {
      const tag = el.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (el.isContentEditable) return;
    }
    onClose();
  }

  function handleKey(e: ReactKeyboardEvent<HTMLSpanElement>) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <section
      className="artifact-pane"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label="Artifact pane"
    >
      <div className="artifact-chrome">
        <div className="artifact-chrome-top">
          <span className="artifact-back" onClick={onClose} onKeyDown={handleKey} role="button" tabIndex={0}>
            ← BACK
          </span>
          <span className="artifact-kicker">{kicker}</span>
          {action && <div className="artifact-chrome-actions">{action}</div>}
          <span
            className="artifact-close"
            onClick={onClose}
            onKeyDown={handleKey}
            role="button"
            tabIndex={0}
            title="close artifact"
          >
            ×
          </span>
        </div>
      </div>
      <div className="artifact-panel-head">
        <div className="artifact-panel-title">{title}</div>
        {meta && <div className="artifact-panel-meta kbd">{meta}</div>}
      </div>
      <div className="artifact-panel-body">{children}</div>
    </section>
  );
}
