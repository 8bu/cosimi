import React from "react";

interface OgCardProps {
  title: string;
  kicker: string;
  period?: string;
  summary: string;
  watermark: string;
}

const BG = "#0a0a0a";
const FG = "#f5f5f0";
const ACCENT = "#e0c97f";
const MUTED = "#a0a098";

/**
 * 1200x630 og card layout. Satori-targeted JSX (subset of CSS) - every
 * node uses `display: "flex"` since satori does not implement default
 * block layout. Returns a plain React element that the generate-og
 * script feeds to `satori()` for SVG output.
 */
export function OgCard({ title, kicker, period, summary, watermark }: OgCardProps) {
  const trimmed = summary.length > 140 ? summary.slice(0, 137) + "..." : summary;
  return (
    <div
      style={{
        width: 1200,
        height: 630,
        background: BG,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        fontFamily: "Inter",
        color: FG,
      }}
    >
      <div
        style={{
          display: "flex",
          fontFamily: "Inter",
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: 4,
          textTransform: "uppercase",
          color: ACCENT,
        }}
      >
        {kicker}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontFamily: "Source Serif 4",
            fontWeight: 700,
            fontSize: 88,
            lineHeight: 1.05,
            color: FG,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "Inter",
            fontSize: 30,
            lineHeight: 1.35,
            color: MUTED,
            maxWidth: 980,
          }}
        >
          {trimmed}
        </div>
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: "Inter",
          fontSize: 24,
          color: MUTED,
        }}
      >
        <div style={{ display: "flex" }}>{period ?? ""}</div>
        <div style={{ display: "flex", color: FG, fontWeight: 600 }}>{watermark}</div>
      </div>
    </div>
  );
}
