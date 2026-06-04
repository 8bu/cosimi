import { useRetrieval } from "../store";
import type { TuningParams } from "@/lib/api/types";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

const KNOBS: { key: keyof TuningParams; label: string; min: number; max: number; step: number }[] =
  [
    { key: "topK", label: "topK", min: 1, max: 50, step: 1 },
    { key: "seedK", label: "seedK", min: 1, max: 50, step: 1 },
    { key: "maxHops", label: "maxHops", min: 0, max: 5, step: 1 },
    { key: "minSimilarity", label: "minSimilarity", min: 0, max: 1, step: 0.05 },
  ];

export function TuningPanel() {
  const tuning = useRetrieval((s) => s.tuning);
  const setTuning = useRetrieval((s) => s.setTuning);
  return (
    <Card>
      <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {KNOBS.map((k) => (
          <div key={k.key} className="flex flex-col gap-1.5">
            <Label htmlFor={`knob-${k.key}`} className="font-normal text-muted-foreground">
              {k.label}
            </Label>
            <Input
              id={`knob-${k.key}`}
              type="number"
              min={k.min}
              max={k.max}
              step={k.step}
              value={tuning[k.key]}
              aria-label={k.label}
              onChange={(e) => setTuning(k.key, Number(e.target.value))}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
