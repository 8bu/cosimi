/* Bespoke icon set — 1.6px stroke, 24×24 grid, currentColor (SPEC §3.4).
   Ported verbatim from the design prototype; do NOT swap for an icon font. */
import type { CSSProperties } from "react";

export const ICON = {
  docs: "M4 3h9l4 4v14H4zM13 3v4h4",
  corpus: "M3 4h7v16H3zM12 4h9v7h-9zM12 13h9v7h-9z",
  ingest: "M12 15V3M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  fallback:
    "M12 9v4M12 17h.01M3.2 18 11 4a1.2 1.2 0 0 1 2 0l7.8 14a1.2 1.2 0 0 1-1 1.8H4.2a1.2 1.2 0 0 1-1-1.8z",
  retrieve: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.3-4.3",
  rail: "M4 5h16M4 12h16M4 19h16",
  check: "M5 12l4 4L19 7",
  chevR: "M9 6l6 6-6 6",
  chevD: "M6 9l6 6 6-6",
  arrowR: "M5 12h14M13 6l6 6-6 6",
  close: "M6 6l12 12M18 6L6 18",
  plus: "M12 5v14M5 12h14",
  filter: "M3 5h18l-7 8v6l-4-2v-4z",
  dots: "M12 6h.01M12 12h.01M12 18h.01",
  upload: "M12 15V3M8 7l4-4 4 4M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  external: "M14 4h6v6M20 4l-9 9M19 13v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  copy: "M9 9h11v11H9zM5 15H4V4h11v1",
  doc2: "M5 3h9l5 5v13H5zM14 3v5h5",
  layers: "M12 3 3 8l9 5 9-5zM3 13l9 5 9-5",
  sliders: "M4 6h10M18 6h2M4 12h2M10 12h10M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4",
  bolt: "M13 2 4 14h7l-1 8 9-12h-7z",
  link: "M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1",
  clock: "M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
  inbox: "M3 13h5l2 3h4l2-3h5M5 5h14l2 8v6H3v-6z",
  spark: "M3 17l5-5 4 3 8-9",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
} as const;

export type IconName = keyof typeof ICON;

export function Icon({
  name,
  size = 18,
  style,
  className,
}: {
  name: IconName;
  size?: number;
  style?: CSSProperties;
  className?: string;
}) {
  const d = ICON[name] ?? "";
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      {d
        .split("M")
        .filter(Boolean)
        .map((seg, i) => (
          <path key={i} d={"M" + seg} />
        ))}
    </svg>
  );
}
