import type { SuggestionChip } from "../data";

interface ChipRowProps {
  chips: ReadonlyArray<SuggestionChip>;
  onPick: (label: string) => void;
}

/**
 * V2 suggestion chip strip.
 *
 * Renders each chip as a real <button> (not <span>) so keyboard activation
 * and screen-reader semantics work without extra ARIA. The design source's
 * `<span>` rendering was illustrative; the click target needs proper button
 * semantics.
 *
 * Faithful to design source classes
 * (docs/superpowers/artifacts/cosimi2/project/primitives.jsx:143-155).
 */
export function ChipRow({ chips, onPick }: ChipRowProps) {
  return (
    <div className="chips">
      {chips.map((c) => (
        <button key={c.label} type="button" className="chip" onClick={() => onPick(c.label)}>
          <span className="chip-mark">{c.mark}</span>
          {c.label}
        </button>
      ))}
    </div>
  );
}
