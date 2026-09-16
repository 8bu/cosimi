/* Stateless shell atoms — ported from the design prototype (components.jsx).
   Token-driven; no hardcoded colors. */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { Icon, type IconName } from "@/lib/icon";

/* ── Checkbox ─────────────────────────────────────────────────── */
export function Ck({ on, onClick }: { on: boolean; onClick?: () => void }) {
  return (
    <span
      className={"ck" + (on ? " on" : "")}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {on && <Icon name="check" size={11} />}
    </span>
  );
}

/* ── Status badge ─────────────────────────────────────────────── */
const STATUS_MAP: Record<string, { cls: string; label: string }> = {
  indexed: { cls: "badge-ok", label: "Indexed" },
  processing: { cls: "badge-accent", label: "Processing" },
  queued: { cls: "badge", label: "Queued" },
  failed: { cls: "badge-err", label: "Failed" },
  open: { cls: "badge-err", label: "Open" },
  triaged: { cls: "badge-warn", label: "Triaged" },
  resolved: { cls: "badge-ok", label: "Resolved" },
  dismissed: { cls: "badge", label: "Dismissed" },
  pass: { cls: "badge-ok", label: "Pass" },
  fail: { cls: "badge-err", label: "Fail" },
  flagged: { cls: "badge-warn", label: "Flagged" },
};
export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] ?? { cls: "badge", label: status };
  const showDot = status === "processing" || status === "queued";
  return (
    <span className={"badge " + s.cls}>
      {showDot && <span className="dot" />}
      {s.label}
    </span>
  );
}

/* ── Doctype glyph chip ───────────────────────────────────────── */
export function DType({ type }: { type: string }) {
  return <span className={"dtype " + type}>{type}</span>;
}

/* ── Meter / score bar ────────────────────────────────────────── */
export function scoreClass(s: number): string {
  return s >= 0.7 ? "s-hi" : s >= 0.5 ? "s-mid" : "s-lo";
}
export function Meter({ value, showNum = false }: { value: number; showNum?: boolean }) {
  const pct = Math.round(value * 100);
  return (
    <span className="score" style={{ width: "100%" }}>
      <span className={"meter " + scoreClass(value)} style={{ maxWidth: 120 }}>
        <span style={{ width: pct + "%" }} />
      </span>
      {showNum && <span className="num">{value.toFixed(2)}</span>}
    </span>
  );
}

/* ── Button ───────────────────────────────────────────────────── */
type BtnProps = {
  kind?: "" | "pri" | "ghost" | "danger";
  sm?: boolean;
  icon?: IconName;
  iconR?: IconName;
  children?: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>;
export function Btn({ kind = "", sm, icon, iconR, children, className = "", ...rest }: BtnProps) {
  const cls = ["btn", kind && "btn-" + kind, sm && "btn-sm", !children && "btn-icon", className]
    .filter(Boolean)
    .join(" ");
  return (
    <button className={cls} {...rest}>
      {icon && <Icon name={icon} size={sm ? 14 : 15} />}
      {children}
      {iconR && <Icon name={iconR} size={sm ? 14 : 15} />}
    </button>
  );
}

/* ── Field wrapper ────────────────────────────────────────────── */
export function Field({
  label,
  hint,
  children,
  style,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  style?: CSSProperties;
}) {
  return (
    <label className="field" style={style}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

/* ── Native select with token caret ───────────────────────────── */
type Opt = string | { value: string; label: string };
export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Opt[];
  disabled?: boolean;
}) {
  return (
    <span className="select-wrap">
      <select
        className="select"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          const val = typeof o === "string" ? o : o.value;
          const lab = typeof o === "string" ? o : o.label;
          return (
            <option key={val} value={val}>
              {lab}
            </option>
          );
        })}
      </select>
    </span>
  );
}

/* ── Inline neutral mono chip ─────────────────────────────────── */
export function Tag({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <span className="tag" style={style}>
      {children}
    </span>
  );
}

/* ── Empty state ──────────────────────────────────────────────── */
export function EmptyPane({
  icon = "layers",
  title,
  desc,
}: {
  icon?: IconName;
  title: ReactNode;
  desc?: ReactNode;
}) {
  return (
    <div className="empty-pane">
      <div className="empty-pane-in">
        <Icon name={icon} size={38} className="empty-ico" style={{ margin: "0 auto 12px" }} />
        <div className="empty-t">{title}</div>
        {desc && <div className="empty-d">{desc}</div>}
      </div>
    </div>
  );
}

/* ── Sparkline (CSS bars) ─────────────────────────────────────── */
export function Spark({ data, hotLast = true }: { data: number[]; hotLast?: boolean }) {
  const max = Math.max(...data, 1);
  return (
    <span className="spark">
      {data.map((d, i) => (
        <span
          key={i}
          className={hotLast && i === data.length - 1 ? "hot" : ""}
          style={{ height: Math.max(2, (d / max) * 26) }}
        />
      ))}
    </span>
  );
}
