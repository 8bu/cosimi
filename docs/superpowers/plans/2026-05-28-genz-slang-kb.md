# Gen-Z Slang KB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `seeds/vi/genz-slang.yaml` (~250 pairs), seed it into Postgres, smoke-test that the matcher returns slang replies for sample inputs.

**Architecture:** Single YAML seed file authored by the assistant (LLM-as-crowd per the project thesis), imported via the existing `pnpm seed` pipeline. No code changes — only data + a header comment.

**Tech Stack:** YAML (flat array per `seeds/vi/*.yaml` convention), `@simlm/db` seed CLI, Postgres FTS + trigram via the running `apps/api` dev server.

---

## File structure

- Create: `seeds/vi/genz-slang.yaml`
- Touch: none (no code, no migrations, no docs beyond the spec already committed)
- Verify: `apps/api` chat endpoint (already running per user)

---

### Task 1: Author the YAML

**Files:**
- Create: `/Users/8bu/Projects/simlm/seeds/vi/genz-slang.yaml`

- [ ] **Step 1: Draft file content**

Header comment + flat array of `{input, response, topic}` objects.

Shape per row:
```yaml
- input: "<lowercase phrase>"
  response: "<reply, may include casual punctuation>"
  topic: "slang-def" | "slang-react" | "slang-trans" | "slang-banter"
```

Header:
```yaml
# Vietnamese Gen-Z slang KB. Hand-curated-by-LLM per the project thesis
# (see README.md "Why I built this"). Register: casual, profanity allowed
# (vcl/sml/đm). No slurs, no targeted hate. Topics:
#   slang-def    user asks "X là gì?"; bot defines briefly
#   slang-react  user uses slang; bot replies slangy in kind
#   slang-trans  user asks for plain-Vietnamese equivalent
#   slang-banter generic Gen-Z banter, no anchor term
```

Coverage target per spec: 30–40 base terms × 6–8 rows each ≈ 210 anchored rows + ~40 banter = ~250 total.

Base terms (working list):
flex, gato, ét o ét, ô dề, u là trời, mlem mlem, xỉu up xỉu down, ml², trẩu, trầm cảm, đỉnh chóp, peak, slay, vibe, drama, toxic, suy, chằm Zn, ship, simp, real, sml, vcl, đm, vl, pha ke, gấu, tóp tóp, ngân ép xi, j z chòi, chếc, ngon, hong, gòi.

Per term: mix of slang-def + slang-react + slang-trans rows. Within each row purpose, mix unique pairs and input-phrasing variants (~40% variants) so fuzzy matching has coverage.

- [ ] **Step 2: Sanity-check structure (grep-based, no deps)**

Run from repo root:
```bash
echo "rows: $(grep -c '^- input:' seeds/vi/genz-slang.yaml)"
echo "responses: $(grep -c '^  response:' seeds/vi/genz-slang.yaml)"
echo "topics: $(grep -c '^  topic:' seeds/vi/genz-slang.yaml)"
echo "---topic breakdown---"
grep '^  topic:' seeds/vi/genz-slang.yaml | sort | uniq -c
echo "---duplicate inputs---"
grep '^- input:' seeds/vi/genz-slang.yaml | sort | uniq -d
```

Expected:
- `rows`, `responses`, `topics` all equal, between 200 and 300.
- Topic breakdown shows the four `slang-*` values, all four non-zero.
- Duplicate inputs section is empty (no output after the header).

If counts mismatch, a row is missing `response` or `topic` — fix the YAML.
If duplicates show up, dedupe by editing.

(Post-normalization duplicates aren't caught here — `@simlm/normalizer`
will produce them at insert time. Pure-string dupes are the only practical
author-time check.)

---

### Task 2: Seed into Postgres

**Files:**
- None (pipeline only)

- [ ] **Step 1: Confirm DB is up + migrated**

```bash
pnpm db:up --wait && pnpm migrate
```

Expected: docker container healthy, migrations apply or report "no pending".

- [ ] **Step 2: Run the seed**

```bash
pnpm seed seeds/vi/genz-slang.yaml --locale=vi
```

Expected log line ends with: `seeded <count> pairs from seeds/vi/genz-slang.yaml under batch #<N> (locale=vi)`.

Record the batch_id from that line — used in Task 3.

If the command fails on a pair (e.g. valibot rejecting a 2000+ char response), edit the offending row in the YAML and re-run. **Do not pass `--source=user`** — leave default `seed` so the source field is correct.

- [ ] **Step 3: Verify row count in DB**

```bash
pnpm --filter @simlm/db exec psql "$DATABASE_URL" -c "SELECT topic, count(*) FROM pairs WHERE locale = 'vi' AND batch_id = <batch_id_from_step_2> GROUP BY topic ORDER BY topic;"
```

Expected: four rows, one per topic, sums to the seeded count.

(If `psql` not installed locally, substitute any postgres client. Or use the admin API: `curl 'http://127.0.0.1:3001/pairs?batch_id=<N>&limit=5'` to spot-check.)

---

### Task 3: Smoke-test against the running API

**Files:**
- None (read-only HTTP)

User already has dev server running per their message. Public API on `:3000`.

- [ ] **Step 1: Hit `/chat` with 3 sampled inputs across topics**

Pick one input each from `slang-def`, `slang-react`, `slang-trans`. Example trio:

```bash
curl -N -s -X POST http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"gato là gì","locales":["vi"]}' | head -c 800; echo
curl -N -s -X POST http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"đỉnh chóp","locales":["vi"]}' | head -c 800; echo
curl -N -s -X POST http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"dịch \"flex\" sang tiếng phổ thông","locales":["vi"]}' | head -c 800; echo
```

Expected: each response stream contains a `token` event with content matching the seeded responses (or a near-fuzzy reply). None should hit the `fallback_message_vi`.

Use the actual inputs from the YAML (case-normalized client-side is fine — matcher normalizes).

- [ ] **Step 2: Hit one fuzzy variant the YAML didn't include**

```bash
curl -N -s -X POST http://localhost:3000/chat -H 'content-type: application/json' -d '{"message":"gat0 nghia la gi","locales":["vi"]}' | head -c 800; echo
```

Expected: trigram tier matches (likely a `slang-def` reply for `gato`). If it falls back, the variant density per term was too thin — flag and add 1–2 phrasing rows in a follow-up.

- [ ] **Step 3: Confirm admin-api shows the batch**

```bash
curl -s 'http://127.0.0.1:3001/pairs?batch_id=<N>&limit=5' | head -c 600; echo
```

Expected: JSON with 5 rows from the seeded batch, each carrying `locale: "vi"` and one of the four topics.

---

### Task 4: Commit

**Files:**
- New: `seeds/vi/genz-slang.yaml`

- [ ] **Step 1: Stage + commit**

```bash
git add seeds/vi/genz-slang.yaml
git commit -m "feat(seeds): vietnamese gen-z slang kb (~250 pairs)"
```

Verify clean:
```bash
git status
git log --oneline -1
```

- [ ] **Step 2: Report to user**

Surface to the user:
- final pair count
- per-topic breakdown
- batch_id (for rollback if regret: `curl -X POST http://127.0.0.1:3001/rollback -H 'content-type: application/json' -d '{"batch_id": <N>}'`)
- which sample inputs returned what reply during smoke-test

---

## Risks / fallback paths

- **Seed CLI rejects a row.** Valibot caps `response` at 2000 chars. Spec response style is short (<200 chars typical), so this should not fire. If it does, trim the offending response.
- **A row has a duplicate normalized input.** Postgres unique constraint on `normalized_input` will throw mid-insert. The seed runs in one batch — partial inserts leave a populated `import_batches` row with mismatched count. Recovery: `curl -X POST http://127.0.0.1:3001/rollback` against the bad batch_id, dedupe the YAML, re-run.
- **Profanity in admin UI.** Pre-flagged in spec. Operator awareness only; no mitigation in v1.
- **Smoke-test returns fallback for every probe.** Means the seed didn't land (count mismatch) or locale tagging is off. Re-run `psql` count check from Task 2 Step 3 before assuming the matcher is broken.
