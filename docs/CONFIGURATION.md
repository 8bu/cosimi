# Configuration

All env vars parsed by `@simlm/config` (valibot). Defaults in
parentheses; see [`../packages/config/src/index.ts`](../packages/config/src/index.ts)
for schema.

| Var | Default | Purpose |
|---|---|---|
| `NODE_ENV` | `development` | `development` \| `test` \| `production` |
| `DATABASE_URL` | *required* | Postgres connection string |
| `PORT` | `3000` | Public api port (binds `0.0.0.0`) |
| `ADMIN_PORT` | `3001` | Admin api port |
| `ADMIN_HOST` | `127.0.0.1` | Admin api bind host — see [Deployment security](./API.md#deployment-security) |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` |
| `GC_INTERVAL_MS` | `300000` | Sweeper period for expired sessions / session_teaches |
| `SESSION_TTL_HOURS` | `24` | Session lifetime |
| `SESSION_TEACH_TTL_MINUTES` | `10` | In-session teach override lifetime |
| `MATCH_FTS_MIN` | `0.1` | FTS `ts_rank` threshold |
| `MATCH_TRGM_MIN` | `0.4` | Trigram similarity threshold |
| `MATCH_TOP_K` | `5` | Random pick from top-K within winning tier |
| `EXPOSE_MATCH_INSIGHTS` | `false` | Include tier/score in `/chat` metadata events |
| `SSE_DELAY_MODE` | `token` | `char` \| `token` pacing for streamed replies |
| `SSE_DELAY_BASE_MS` | `30` | Base delay between SSE chunks |
| `SSE_DELAY_JITTER_MS` | `20` | Random jitter added to each chunk delay |
| `TEACH_RATE_LIMIT_PER_HOUR` | `10` | `/teach` calls per session per hour |
| `TEACH_MAX_LENGTH` | `500` | Max chars in `/teach` payload |
| `TEACH_BLOCKLIST_REGEX` | *empty* | Optional pattern rejecting teach payloads |
| `FALLBACK_MESSAGE` | `hmm idk, tell me more?` | Last-resort no-match reply |
| `PRUNE_SCORE_THRESHOLD` | `-3` | Net-vote threshold below which pair prune-worthy |

`FALLBACK_MESSAGE` = **last resort**. Chat handler first reads
`app_config['fallback_message_<locale>']`, falls back to
`app_config['fallback_message_und']` before env default. Add new
locale fallback via single `INSERT INTO app_config` migration; never
edit migration 010 in place.

## Logging & PII

- `LOG_LEVEL=info` (default) never writes raw `input` / `response` /
  `message` / `reply` fields. Pino path-based redact strips as
  `[REDACTED]`; `redactInput()` (in `@simlm/logger`) = explicit
  way to log non-reversible reference: `{ length, hash }`.
- `LOG_LEVEL=debug` lets handlers emit raw values, by convention under
  `*_dbg`-suffixed field names so redact list skips them.
- Both backend processes import same `@simlm/logger` — no divergence
  in PII policy between api and admin-api.