---
"@cosimi/sdk": minor
---

SP1 — extract the Cosimi SDK constellation. `@cosimi/sdk` exposes
`createCosimi(config)` with a `MatchService` over an injected, runtime-portable
`sql` accessor (Workers-safe, no module-level state). The match cascade is a
`TierHandler` registry (Tier 1 ships; Tier 2/3 extend via `config.tiers`).
Repository ports live in `@cosimi/db-core`; the postgres adapter in
`@cosimi/adapter-postgres`. Runtime (`.`) and Node-only offline (`./offline`)
split via the exports map. Lockstep release across the `@cosimi/*` constellation.
