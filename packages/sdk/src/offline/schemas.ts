import * as v from "valibot";

const GenerationSchema = v.pipe(
  v.array(
    v.object({
      q: v.pipe(v.string(), v.minLength(1)),
      a: v.pipe(v.string(), v.minLength(1)),
    }),
  ),
  v.minLength(1), // nonempty; NO max — excess is sliced by the caller (spec §9)
);

const RelationSchema = v.array(
  v.object({
    from: v.number(),
    to: v.number(),
    type: v.picklist(["references", "elaborates", "contradicts"]),
  }),
);

const AuditSchema = v.object({
  verdict: v.picklist(["pass", "fail", "rewrite"]),
  reason: v.string(),
  rewritten_answer: v.nullable(v.string()),
});

export type GenerationPair = v.InferOutput<typeof GenerationSchema>[number];
export type Relation = v.InferOutput<typeof RelationSchema>[number];
export type AuditVerdict = v.InferOutput<typeof AuditSchema>;

/** Strip markdown code fences an LLM may wrap JSON in, then JSON.parse. */
function stripFences(raw: string): string {
  return raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
}

function safeParse<T>(schema: v.GenericSchema<unknown, T>, raw: string): T | null {
  let json: unknown;
  try {
    json = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
  const res = v.safeParse(schema, json);
  return res.success ? res.output : null;
}

export function parseGeneration(raw: string): GenerationPair[] | null {
  return safeParse(GenerationSchema, raw);
}

export function parseRelations(raw: string): Relation[] | null {
  return safeParse(RelationSchema, raw);
}

export function parseAudit(raw: string): AuditVerdict | null {
  return safeParse(AuditSchema, raw);
}

/** Reverse-check returns a raw question line, not JSON. */
export function parseReverse(raw: string): string | null {
  const q = raw.trim();
  return q.length > 0 ? q : null;
}
