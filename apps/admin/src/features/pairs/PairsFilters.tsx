import type { Source } from "@cosimi/types";
import { Input } from "@/components/ui/input";

export interface Filters {
  source: Source | undefined;
  topic: string;
  q: string;
  includeDeleted: boolean;
}

interface Props {
  value: Filters;
  onChange: (next: Filters) => void;
}

const SOURCE_OPTIONS: { value: "" | Source; label: string }[] = [
  { value: "", label: "All sources" },
  { value: "seed", label: "Seed" },
  { value: "user", label: "User" },
  { value: "chat", label: "Chat (Teach)" },
  { value: "llm", label: "LLM" },
];

/**
 * Native <select> for the source picker — same rule that earned
 * apps/web's LocaleSwitcher its native primitive. Native checkbox for
 * the include-deleted toggle, same reason: a11y, mobile, RTL all free.
 *
 * The search input is the *only* control that updates `q` on each
 * keystroke. The parent debounces before threading the value into
 * usePairs() — debouncing at the call site (PairsView) keeps the input
 * itself instantly responsive while the query lags.
 */
export function PairsFilters({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-card px-4 py-3">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Source
        <select
          value={value.source ?? ""}
          onChange={(e) =>
            onChange({
              ...value,
              source: e.target.value ? (e.target.value as Source) : undefined,
            })
          }
          className="h-9 rounded-md border bg-background px-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
        >
          {SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Topic
        <Input
          value={value.topic}
          onChange={(e) => onChange({ ...value, topic: e.target.value })}
          placeholder="e.g. greetings"
          className="h-9 w-40"
        />
      </label>
      <label className="flex flex-1 min-w-[14rem] flex-col gap-1 text-xs text-muted-foreground">
        Search
        <Input
          value={value.q}
          onChange={(e) => onChange({ ...value, q: e.target.value })}
          placeholder="Fuzzy-match normalized input…"
          className="h-9"
        />
      </label>
      <label className="flex items-center gap-2 text-xs text-muted-foreground pb-2">
        <input
          type="checkbox"
          checked={value.includeDeleted}
          onChange={(e) => onChange({ ...value, includeDeleted: e.target.checked })}
        />
        Include deleted
      </label>
    </div>
  );
}
