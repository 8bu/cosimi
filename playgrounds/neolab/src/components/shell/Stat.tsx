import type { ReactNode } from "react";

/** A stat cell. `delta` is optional — when absent (the common case against the
   real backend, which has no deltas) no delta line renders (honest blank). */
export function Stat({
  k,
  v,
  delta,
  dir = "flat",
}: {
  k: ReactNode;
  v: ReactNode;
  delta?: ReactNode;
  dir?: "up" | "down" | "flat";
}) {
  return (
    <div className="stat">
      <div className="stat-k">{k}</div>
      <div className="stat-v">{v}</div>
      {delta && (
        <div className={"stat-d " + dir}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {delta}
        </div>
      )}
    </div>
  );
}
