import * as v from "valibot";

/**
 * Shared limit/offset valibot fragment. Inputs arrive as query strings, so
 * the schema takes the raw `string` and coerces with `decimal()` + transform.
 * Default `limit=50`, max `200` — keeps the admin UI fast and the wire
 * payload bounded.
 */
export const PaginationSchema = v.object({
  limit: v.optional(
    v.pipe(
      v.string(),
      v.decimal(),
      v.transform(Number),
      v.integer(),
      v.minValue(1),
      v.maxValue(200),
    ),
    "50",
  ),
  offset: v.optional(
    v.pipe(v.string(), v.decimal(), v.transform(Number), v.integer(), v.minValue(0)),
    "0",
  ),
});

export type Pagination = v.InferOutput<typeof PaginationSchema>;
