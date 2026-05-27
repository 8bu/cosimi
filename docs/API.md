# API Reference

Two processes: public `apps/api` port 3000, internal `apps/admin-api` port 3001 (`127.0.0.1`). See [Deployment security](#deployment-security) — split = auth contract.

## Public API (port 3000)

```bash
# Chat (SSE — streams session → metadata → token… → done)
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -d '{"message":"xin chào"}'

# Same session, second turn (echoes session id via response header)
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid from prior response>' \
  -d '{"message":"how are you?"}'

# Inline teach (after a turn that got "I don't know")
curl -N -X POST http://localhost:3000/chat \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid>' \
  -d '{"message":"/teach pretty good, thanks!"}'

# Feedback (thumbs)
curl -X POST http://localhost:3000/feedback \
  -H 'content-type: application/json' \
  -H 'x-session-id: <uuid>' \
  -d '{"pair_id": 42, "value": 1}'

# Public stats
curl http://localhost:3000/stats

# Health (DB ping with 1s budget; 503 when Postgres is down)
curl http://localhost:3000/healthz
```

## Admin API (port 3001, 127.0.0.1)

> Admin endpoints on **separate process** at `127.0.0.1:3001`. No `/admin/*` prefix — whole process = admin surface (see [Deployment security](#deployment-security)).

```bash
# Top unanswered prompts
curl http://127.0.0.1:3001/unanswered

# Add a pair directly (bypasses the teach queue + atomically clears
# matching unanswered rows server-side)
curl -X POST http://127.0.0.1:3001/pairs \
  -H 'content-type: application/json' \
  -d '{"input":"hi","response":"hello!","topic":"greetings"}'

# Approve a single queued teach
curl -X POST http://127.0.0.1:3001/teach-queue/7/approve

# Bulk approve / reject
curl -X POST http://127.0.0.1:3001/teach-queue/batch \
  -H 'content-type: application/json' \
  -d '{"ids":[1,2,3,4,5],"action":"approve"}'

# List pairs filtered by an import batch
curl 'http://127.0.0.1:3001/pairs?batch_id=42&limit=50'

# LLM bulk import (newline-delimited JSON; one pair per line). Streamed
# server-side so 10k-row imports stay OOM-safe.
curl -X POST "http://127.0.0.1:3001/import?source=llm&topic=humor" \
  -H 'content-type: application/x-ndjson' \
  --data-binary @humor.jsonl
# → { batch_id, count }

# Roll back an import batch (soft-deletes every pair from that batch).
# Re-running with the same body is a no-op; restore individually from
# the Pairs view if needed.
curl -X POST http://127.0.0.1:3001/rollback \
  -H 'content-type: application/json' \
  -d '{"batch_id": 42}'

# Admin process health
curl http://127.0.0.1:3001/healthz
```

LLM import file format: see [`./LLM_IMPORT_FORMAT.md`](./LLM_IMPORT_FORMAT.md).

## Deployment security

> 🛑 **Admin API = separate process, NO auth.**

`apps/admin-api` runs own port, binds `127.0.0.1` default, controlled by `ADMIN_HOST` / `ADMIN_PORT`. Threat model:

- ✅ Public `apps/api` port `3000` (`0.0.0.0`) — exposes only chat / feedback / stats / health.
- ✅ Admin `apps/admin-api` port `3001` (`127.0.0.1`) — admin surface, unreachable from outside host.
- ⚠️ Setting `ADMIN_HOST=0.0.0.0` exposes admin surface to anyone on network. Process logs `warn` line on startup when this happens. **Don't do this without a network-layer gate** (Cloudflare Zero Trust, VPN, Tailscale, mTLS, etc.) in front. No per-route auth — adding it would imply admin routes safe to expose externally, which false.

Misconfiguring *public* API network (e.g. exposing port 3000 publicly) does **not** expose admin — different process, socket, port. Security = property of *where admin process binds*, not route-mounting in code.