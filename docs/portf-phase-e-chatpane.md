# Phase E — V1 Chat + sidebar + threads (landed 2026-05-27)

- **`apps/portf` writes the per-thread messages blob with a hand-rolled
  debounced persist, NOT zustand's `persist` middleware.**
  `apps/portf/src/store/messages.ts` schedules a 200ms-debounced
  `localStorage.setItem('portf.messages', ...)` from token-accumulating
  actions (`appendBotToken`, `applyMetadata`, `applyNoMatch`) and flushes
  immediately on terminal transitions (`finishBot`, `clear`) and
  `beforeunload`. If a contributor swaps in `persist({...})` to
  "simplify," every streamed token will write to disk - measurable jank
  on long replies. The pattern is reusable for any future portf store
  with high-frequency state changes.

- **`apps/portf` chat streams run in the messages-store action, not in a
  route effect.** A module-level `Map<threadId, AbortController>`
  (`apps/portf/src/lib/inflight.ts`) holds per-thread cancellations;
  `window.beforeunload` calls `abortAllInflight()`. Switching threads
  mid-stream is NON-destructive - the stream keeps writing into
  `byThread[oldId]`. Returning to the thread later shows the settled
  reply. Any new chat-like surface in `apps/portf` follows this shape:
  stream lifecycle is data-shape-scoped (threadId), not view-scoped.

- **`apps/portf` uses per-thread server sessions** stored in
  `portf.sessions: Record<threadId, serverSessionId>`. First POST per
  thread sends no `X-Session-Id`; the response header is adopted into
  the store (`apps/portf/src/lib/streamChat.ts`); subsequent posts send
  the cached header. This preserves CLAUDE.md's server-canonical-session-id
  rule while giving each thread its own server-side session_teaches scope
  and rate-limit budget. Don't "consolidate" to one visitor session - it
  breaks the thread-isolation contract and surprises the server's
  per-session GC.

- **`threads.remove()` is a cross-store coordinator.** Removing a thread
  cascades into `sessionsStore.clear(id)` (synchronous static import) and
  `messagesStore.clear(id)` (dynamic import - keeps the messages store
  out of the threads-store module init graph). Any new portf store keyed
  by `threadId` MUST register a `clear(id)` action and be added to the
  cascade.

- **`apps/portf` has NO `/teach` plumbing and NO vote UI.** No
  `TEACH_PREFIX_RE` mirror, no `vote` field on the bot-message shape,
  no `teach_ack` UI surface (handled defensively as a no-op in the
  store's event reducer). If a visitor types literal `/teach …`, the
  server processes it normally and the bot bubble settles with empty
  text - accepted edge case. If a future phase ever enables /teach on
  portf, the parity surface is in `apps/web/src/features/chat/store.ts`
  (teach branch) and `apps/web/src/features/chat/tokens.ts` (regex).

- **`apps/portf/src/styles/layout.css` is the home for portf layout
  classes; `portfolio.css` stays verbatim.** Phase E's chat-shell grid,
  sidebar mobile drawer state (`.v1-sidebar.is-open`), backdrop,
  typing indicator (`.typing-indicator`), bubble `is-error` modifier,
  inline rename input, and thread-remove button styles all live in
  `layout.css`. The import order in `globals.css` is `portfolio.css`
  THEN `layout.css` - layout wins on selector tie. Adding new state
  classes MUST go to `layout.css`, never `portfolio.css`.

- **`apps/portf`'s `apiBase()` is a function, not a const.**
  `apps/portf/src/lib/apiBase.ts` returns
  `import.meta.env.VITE_PORTF_API_BASE ?? '/api'` on every call. Phase E
  doesn't ship a runtime switcher, but this matches the apps/admin
  runtime-config pattern (CLAUDE.md) so a future config UI can change
  behavior without a re-import. Don't refactor to
  `export const API_BASE = ...` - that snapshots at module init and
  breaks the future switcher.

- **The `consumedRef` pattern in `chat.$threadId.tsx`'s `initialPrompt`
  effect is the third use of the cancel-via-ref shape in `apps/portf`**
  (after Phase D's `Composer.runChipAnimation`'s `cancelRef`). React
  StrictMode double-mounts effects in development; state flags would
  let the second mount re-fire. Ref flag set synchronously inside the
  effect body, checked at the top - same shape every time. Any future
  async UI sequence with "do exactly once" semantics follows this
  pattern.

- **`apps/portf/package.json` adds `sonner ^1.7.0` in Phase E** (resolved
  to ^1.7.4 in workspace lock). Same caret range as `apps/web`. Already
  audited in `docs/dep-audit-2026-05-26.md`. Imported dynamically from
  the messages store's error paths (so unit tests don't need to mock it)
  and statically from `main.tsx` for the `<Toaster />` mount.

- **The messages-store `done` event handler is guarded against
  overwriting an `error` status.** A preceding `error` event sets
  `status: 'error'`; if a `done` event follows in the same stream
  (server emits both), naive handling would settle back to `'settled'`
  and lose the error indicator. The `case "done"` arm in
  `apps/portf/src/store/messages.ts` checks the current bot status
  and skips `finishBot('settled')` when it's already `'error'`. Any
  future event-reducer arm that calls `finishBot('settled')` must
  follow the same guard.

- **DO NOT pre-implement portf components from spec text - port the
  prebuilt JSX from `docs/superpowers/artifacts/simlm2/project/`.** The
  design artifact IS the source of truth: `primitives.jsx`
  (`UserBubble` / `AssistantBubble` / `InputRow` / `Chips` / `Wordmark`
  / `Anno`), `variations-1-2.jsx` (`V1Sidebar` / `V1Conversation` chat
  layout - Today/Earlier grouping, footer avatar, header title +
  status, chips-above-composer), `variations-3-4.jsx` (artifact pane
  shapes for Phase G), `styles.css` (verbatim-ported to
  `apps/portf/src/styles/portfolio.css`). Each component there is a
  complete JSX shape with the exact class-name structure that
  portfolio.css styles. The Phase E rev (2026-05-27 evening) had to
  redo MessageBubble, ChatComposer, Sidebar, ChatPane because the
  initial implementation invented its own shapes from spec text
  instead of porting these. The contract for any future portf phase:
  open the relevant artifact file, copy the JSX, then plug the data
  layer (props, store hooks, navigate, etc.) into the same nodes -
  DO NOT redesign the markup, DO NOT rename the classes, DO NOT
  rewrite from imagination. Only logic is freshly written; markup is
  ported. If the artifact and the spec disagree on shape, the
  artifact wins; if the artifact is missing, STOP and ask before
  inventing.

- **Subagents working in a git worktree MUST anchor cwd before any
  file write.** Phase E Task 5 (sessions store) created
  `apps/portf/src/store/__tests__/sessions.test.ts` in the MAIN
  worktree at `/Users/8bu/Projects/simlm/` instead of the active
  worktree at `/Users/8bu/Projects/simlm/.claude/worktrees/zazzy-
  munching-dragon/`. Cause: a Write tool call resolved against an
  ambient cwd that was not the intended worktree (subagent did not
  explicitly `cd` first OR a follow-up tool call lost the cd).
  Required guard for every subagent dispatch: the prompt must say
  `Work from: <absolute-worktree-path>` AND the subagent should run
  `cd "$(git rev-parse --show-toplevel)"` (or `pwd` to confirm) at
  the top of its session before any Write / Edit / Bash that
  creates files. Any task that creates a NEW file path should also
  verify the file lands under the expected worktree by reading it
  back from the absolute worktree path.

- **Phase E discovery log lives at `docs/portf-phase-e-chatpane.md`
  (and `docs/portf-phase-{a,b,c,d}-*.md` for earlier phases).** This
  replaces the old `CLAUDE.note.md` single-file convention from
  Phases A-D. New per-phase format: one file per phase under
  `docs/portf-phase-{x}-{slug}.md`, each containing only that phase's
  discipline-rule entries. The next phase (F) writes to its own
  `docs/portf-phase-f-{slug}.md`. Curation pass that folds rules into
  `CLAUDE.md` reads every `docs/portf-phase-*.md` file at once.
  Discipline unchanged: do NOT edit `CLAUDE.md` from feature work.
