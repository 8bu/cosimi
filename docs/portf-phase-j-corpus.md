# Phase J — Corpus discovery

Per-phase discovery doc (Phase E pattern). Append rules as learned.

## J1 INVENTORY — gap analysis (2026-05-28)

### Sources audited

- `seeds/portf/about-long.yaml` — 362 pairs, 30 sections, 1250 lines (operator-authored baseline)
- `seeds/portf/_smoke_artifact.yaml` — 8 pairs across 2 artifact topics (`wegopro`, `longnguyen-2026`)
- `seeds/portf/interview-todo.md` — 30 prompts across 11 categories (A-K). NOT FILLED — frozen this session per operator
- `seeds/vi/about-long.yaml` — 207 VI pairs. OUT OF SCOPE (Phase H owns vi)

### Coverage vs 10 themes

| # | Theme | Existing topics | Pairs | Verdict |
|---|---|---|---|---|
| 01 | IDENTITY | identity, age, location, languages, personal, contact | ~84 | DENSE |
| 02 | CAREER | role, wegopro, whats-next, history | ~54 | DENSE — "why this industry" thin |
| 03 | STACK (facts) | stack, stack-{vue,react,ts,css,ui,be}, ai-tools, dev-env, ops, infra | ~79 | DENSE on facts |
| 03 | STACK (opinions) | — | 0 | **MISSING** — hot takes, would-never-touch, preferences (operator self-flagged "CV bare facts — no opinions" in section comments) |
| 04 | PROCESS | testing, ops (collab tools) | ~16 | **SPARSE** — code review, docs, async/sync, meetings missing (interview-todo.md A-section) |
| 05 | PROJECTS DEEP (facts) | wegopro, blockdevs, multiplier, superlauncher, motorist, letterink, freelance, migration-nuxt, oss, cosimi, web3 | ~91 | DENSE on facts |
| 05 | PROJECTS DEEP (narrative) | — | ~3 (only migration-nuxt) | **SPARSE** — most projects = "what is X" only, no shipped-what/wall/fix arc |
| 06 | LIFE OFFLINE | hobbies, style, personal | ~27 | MEDIUM — music/food/reading depth TBD |
| 07 | HIRING SIGNALS | whats-next, availability | ~12 | **SPARSE** — comp, visa, dealbreakers, team shape missing (interview-todo.md F/G) |
| 08 | OPINIONS | — | 0 | **MISSING ENTIRELY** — Vue vs React, Tailwind vs SCSS, AI tools opinions (interview-todo.md H) |
| 09 | VOICE / TEXTING | (meta-rule, no topic) | — | **NO STYLE GUIDE** — J4 deliverable |
| 10 | DEFLECTIONS | — | 0 | **MISSING ENTIRELY** — refused-answer scripts for salary/politics/etc (interview-todo.md J) |

### Totals

- 362 pairs across 30 sections
- ~84% on themes 01/02/03-facts/05-facts
- ~10% on 06
- ~4% on 04/07
- **0%** on 08, 10 + missing voice guide for 09

### Gaps requiring NEW pairs (J3 DISTILL targets)

Priority order:
1. **08 OPINIONS** — 0 pairs. High operator-personality signal. Needs operator answers (interview-todo.md H).
2. **10 DEFLECTIONS** — 0 pairs. Sensitive Q handling. Polite scripts.
3. **03 STACK opinions** — 0 pairs. Hot takes, would-never-touch.
4. **04 PROCESS** — 16 pairs only. Code review, docs philosophy.
5. **07 HIRING SIGNALS** — 12 pairs. Comp/visa/dealbreakers/team shape.
6. **05 PROJECTS NARRATIVE** — facts present but no shipped/wall/fix arc per project.

Themes 1/2/3-facts/6 already at floor (~30+ pairs) — no urgent gap-fill.

### Duplicates / contradictions audit

Not yet performed. Spot-check during J3 distill.

### CV inconsistencies (interview-todo.md items 26-30)

To resolve via TUI this session:
- 26: Multiplier.finance dates (`2013-2016` vs BlockDevs `2019-2022`)
- 27: Motorist.sg country (Singapore vs HCMC role)
- 28: Letterink description (agency removed)
- 29: English fluency level (currently "for work")
- 30: Cosimi identity claim (currently removed — is Cosimi actually powering this chat?)

### Topic naming audit

All existing topics follow `portfolio/<sub-key>` (legacy single-level). Phase G locked NEW pairs into:
- `portfolio/artifact/<slug>` — fires artifact card
- `portfolio/experience/<slug>` — answer-only project narrative
- `portfolio/<theme>/<sub-key>` — non-artifact-bound (new convention)

Migration consideration: rename existing `portfolio/wegopro` → `portfolio/experience/wegopro`? Or keep flat. Decide during J3 split (Task #3).

## J3 DISTILL — partial execution (2026-05-29)

Operator's `interview-todo.md` frozen this session. Only themes NOT requiring new operator opinions filled.

### Filled

- **deflections.yaml** — 37 pairs, 7 sub-topics (`portfolio/deflection/{comp,expectations,politics,religion,why-leave,personal,health,lowball,cocky}`). Polite refusal scripts. NO fabricated opinions — these decline rather than claim.

### Blocked (operator interview required)

- **opinions.yaml** — Vue vs React, Tailwind vs SCSS, AI tools rankings, daily-driver preferences. Cannot fabricate.
- **hiring.yaml** — comp range, visa, dealbreakers, team shape, remote vs hybrid choice. Existing whats-next/availability pairs in `career.yaml` cover the openness signal; hiring.yaml stays stub until operator fills items 12-16 of interview-todo.md.
- **process.yaml gap-fill** — code review philosophy, docs approach, async/sync mix. Existing 16 pairs cover testing + collab tools facts only.
- **projects-deep narrative** — facts present, but the shipped/wall/fix arc per project needs operator answers (interview-todo item 22).

## J4 VOICE TUNE — executed (2026-05-29)

Voice-style guide: `docs/superpowers/specs/2026-05-29-portf-voice-guide.md`.

### Sweeps applied

- **em-dash** ` — ` → ` - ` mechanical replace across 9 files. 149 instances. All surrounded by spaces (safe pattern).
- **en-dash** audit: 11 instances, all date ranges (2013–2016, Mar 2016 – Dec 2017 etc.). Kept per voice-guide rule.
- **AI-generic phrase scan** (happy to / feel free / passionate / leverage / robust / seamlessly / cutting-edge): 0 hits.
- **enthusiasm scan** (`!` / "absolutely" / "amazing" / "fantastic" / "delighted"): 0 hits.
- **filler scan** (basically / honestly / sort of / kind of / "I would say"): 0 hits.

### Findings

Operator's authored corpus was already voice-tight on every dimension EXCEPT em-dash usage. Single-pass mechanical sweep sufficed. No line-by-line rewrites required.

## Rules learned

- **Empty starter yaml files crash seed CLI.** `parseYamlFlat` throws `expected top-level YAML list` on null parse (comments-only file → `parseYaml` returns null). Empty starter files MUST contain `[]` literal. Documented; J3 stubs use this.
- **Em-dash mechanical sweep safe pattern.** Confirmed via `grep -hoE "[^ ]?—[^ ]?"` — 100% of 149 em-dashes were ` — ` with surrounding spaces. `sed -i '' 's/ — / - /g'` covers all cases without false positives. Future operators can apply same sweep on new corpus batches.
- **Operator voice has two registers**, not one. Chat-INPUT register (lowercase, "u", "wat", no apostrophes, fragments) ≠ corpus-RESPONSE register (proper capitalization, terse but full sentences, hyphen always). Both must mirror Long's actual style. Voice guide documents both.
- **Existing topics use legacy single-level `portfolio/<sub>`.** Phase G locked NEW pairs into `portfolio/artifact/<slug>`, `portfolio/experience/<slug>`, `portfolio/<theme>/<sub>`. Deflections file followed new convention (`portfolio/deflection/<sub>`). Migration of legacy topics to new convention NOT done this phase — operator can decide whether to rename during future J3 batches.
- **CV inconsistencies (interview-todo items 26-30) resolution:** Motorist Singapore + remote HCMC, Letterink agency/studio claim, Cosimi identity restored. Multiplier dates only in PDF (separate ticket per Phase B note). English level kept neutral.
- **Phase J is data-only — gates only protect against accidental code touch.** All 473 tests across 9 packages pass after the corpus split + em-dash sweep + CV-fix MDX edits. No new tests required.

## Final corpus state

| File | Pairs | Status |
|---|---|---|
| identity.yaml | 84 | populated |
| career.yaml | 85 | populated |
| stack.yaml | 70 | populated |
| process.yaml | 16 | sparse — operator-blocked |
| projects-deep.yaml | 86 | populated (facts), narrative blocked |
| life-offline.yaml | 28 | populated |
| hiring.yaml | 0 | stub `[]` — operator-blocked |
| opinions.yaml | 0 | stub `[]` — operator-blocked |
| deflections.yaml | 37 | populated (J3 partial) |
| _smoke_artifact.yaml | 8 | unchanged (artifact triggers) |
| **TOTAL** | **414** | |

## Smoke (J6) deferred

Operator-driven. Run `pnpm seed:portf` then ad-hoc browser queries. Verify:
- (a) tier ≠ no_match for the question variations
- (b) artifact-bound questions still fire the right card (wegopro, cv)
- (c) experience-bound questions do NOT fire artifact card (topic prefix mismatch)
- (d) responses sound like Long (voice-guide compliant)
- (e) markdown renders cleanly
- (f) line breaks render

If smoke surfaces voice-tune misses or seed-glob regressions, append findings here.
