// src/ui/public/lib/live-invalidation.js — WHICH audit record kinds make
// each screen's fetched data stale, AND what each screen does about it
// (`plan:live seq:2` for the first property, `plan:live seq:3` for the
// second). Declaration only: nothing here re-renders anything and nothing
// here IS the re-render or the affordance — `app.js` reads both properties
// off this one table and does the act; a screen's own `render()` never
// imports this file.
//
// `refresh` is the property `DEC-a-refresh-keeps-the-reader-s-place-or-it
// -asks` names: *"which of the two a screen does is a property the SCREEN
// DECLARES, not one the shell guesses — the shell cannot know whether a
// re-render will reorder rows under somebody."* `'auto'` means `app.js` may
// call the screen's own `render()` again, in place, the moment its declared
// kinds arrive; `'ask'` means it may not — it draws the shared affordance
// instead (`app.js`'s `showLiveAffordance`) and waits to be pressed. This is
// the SECOND property on each entry rather than a second map for the reason
// the task instruction states directly: a screen's staleness and a screen's
// safety are two facts about the SAME screen, read together by the SAME
// caller, and two tables would be two places for one screen's row to drift
// out of step with itself.
//
// ── WHY THIS IS DATA, KEPT SEPARATE FROM app.js AND EVERY screens/*.js ────
//
// `seq:1` gave every screen a door — `ctx.subscribeStream(kinds, onEvent)`,
// fanned out by `AuditKind`, never by screen name (`app.js` ·
// `dispatchLiveEvent` · ~926). What it did not give was an answer to "which
// kinds", and a screen that guessed its own would drift from its neighbours
// the day someone else changed what it fetches. One table, read by the shell
// and by the gate below, is the same argument `palette-defs.js`'s header
// makes about the command catalogue: "a hand-kept list... is a defect
// waiting to happen", so the list is kept anyway, and a companion test is
// what stops it drifting silently instead of a promise that it won't.
//
// **A browser module cannot import `core/audit.ts`'s `AuditKind`** — no
// bundler, no build step, and that file is TypeScript Node alone loads. So
// the seven kind strings are repeated here as literals rather than imported,
// and `test/ui/live-invalidation.test.ts` is what keeps them from silently
// disagreeing with `AUDIT_KINDS` (`src/core/audit.ts` · `export const
// AUDIT_KINDS: AuditKind[] = [` · ~385) — the same rule `port.js`'s own
// header states about repeating a closed vocabulary in two places.
//
// ── WHY A GATE, AND NOT A COMMENT PROMISING TO KEEP THIS CURRENT ──────────
//
// The task's own reasoning, restated because it is the reason this file
// exists at all: **"nothing invalidates me" is a legal and common answer,
// and it is indistinguishable from "nobody thought about this screen" unless
// it is written down.** `docs`, `tut` and `port` below are the three where
// that is the honest entry — the code proves it per-screen in the notes
// beneath — and the gate is what makes them readable as a decision rather
// than an omission. Same shape as `plan:rulings seq:50`'s complaint about a
// hand-maintained table nothing forces anyone to update: this one is forced,
// by `test/ui/live-invalidation.test.ts` failing the moment `app.js` routes
// a screen this object has no key for.
//
// ── HOW EACH ROW WAS DERIVED — read what the screen actually fetches, not
//    what its name suggests ─────────────────────────────────────────────
//
//   preview   `/api/items`, `/api/select`, `/api/simulate` — the corpus and
//             the gate ladder change under `mutation`; `/api/select`'s
//             `focus=off` branch reads "the focus the hook would apply"
//             (`ui/read-model.ts` · `Omit it to preview with the focus the
//             hook` · ~273), i.e. the SESSION focus `focus-set`/`focus-clear`
//             write — not `/api/graph`'s unrelated `focus=<item id>` query
//             parameter.
//             **AND `injection` AND `hook`, added 2026-08-28 — the clause the
//             two above could not supply, because they are about the CORPUS
//             and this screen is about an EVENT.** Everything derived above
//             asks what the three endpoints READ. It is right as far as it
//             goes and it is silent on the one input that is not corpus at
//             all: `/api/select` and `/api/simulate` resolve the SESSION's
//             own seen file and restore snapshot per request
//             (`ui/read-model.ts` · `const window = event === 'compact'` ·
//             ~317), so this screen's answer moves when the SESSION moves and
//             not one item has changed. A preview of an event is stale the
//             instant that event actually happens, and the record proving it
//             happened is exactly what was missing here. The four moments
//             that move it, each against `core/audit.ts`'s `KIND_OF`:
//             `session-start` and `compact-restore` are `injection`,
//             `post-compact` and `session-end` are `hook` — four ops, two
//             kinds, and neither kind was declared. Reported by the owner
//             twice, minutes apart, and then clarified: `compact` picked in
//             `#evsel`, a compaction fired, and NO region of the screen
//             moved without a hand reload — *"i meant it did not update at
//             all, at least it should be checked"* — ladder, ribbon,
//             Delivered and Why not alike, because a row carrying the wrong
//             kinds subscribes to a stream that never delivers.
//             The continuity lane is where this stops being staleness and
//             becomes a wrong statement: `plan:live seq:9` keys that tier's
//             dedupe on the WINDOW rather than the id (`core/seen-file.ts` ·
//             `export function continuityFor` · ~215), so its delivered /
//             not-delivered state flips at these four moments and at nothing
//             else. For the other four tiers a stale ribbon means the numbers
//             moved; for this one the screen says the guarantee is in force
//             when it is not, or the reverse.
//             `e2e/preview-compact-continuity.spec.ts` drives a real
//             compaction against a live preview and pins that flip.
//   coverage  `/api/coverage` — governance by path, over the current items.
//             `mutation` only; nothing here is session-scoped.
//   gaps      Same `/api/coverage` answer as coverage, through
//             `coverageGapRows`. `mutation`.
//   simulate  `/api/coverage`, `/api/simulate` (same focus reasoning as
//             preview) and `/api/watch/ratio`, whose two `topItems` calls
//             read the `injected`/`spilled` `audit_item.role`s — written only
//             by `injection`-kind records (`ui/watch-model.ts` ·
//             `apiWatchRatio` · ~613). `mutation`, `injection`, `focus`.
//   injected  `/api/session/:id/injected` reads the SEEN FILE directly —
//             the live record of what was injected, and nothing else.
//             `injection` only.
//   doctor    `/api/doctor` — `runChecks` findings over the current items.
//             `mutation`.
//   decay     `/api/decay` (`store.all()` plus the Ledger's injection
//             projection) and the heatstrip's own `/api/ask/audit`, sourced
//             from `audit_item.role` — "carrying `injected[]` and
//             `spilled[]` per record" (this file's own header). `mutation`
//             (which items exist, `always`) and `injection` (everything the
//             Ledger and the heatstrip project).
//   graph     `/api/items`, `/api/graph` — an ego-graph over `link`/`unlink`
//             relations, both `mutation` ops. `/api/graph`'s `focus` query
//             parameter names the CENTER ITEM, not the session focus the
//             `focus` `AuditKind` records — confirmed against `apiGraph`
//             (`ui/read-model.ts` · `~1476`), so this row does not carry
//             `focus`. `mutation`.
//   status    `/api/status` — `items.total`, `reviewQueue.drafts`,
//             `pendingRevisions.revisions`, all counts `create`/`stage`/
//             `promote`/`discard`/`accept` move. `mutation`.
//   learn     **Diverges from the "genuine nothing" set the task names as an
//             example.** `/api/help/:topic` answers, per topic, `corpus.
//             scoped[…].id`, `corpus.recent[…].id`, a category tally and
//             `{ drafts, pendingRevisions }` (`screens/learn.js`'s own header:
//             "The four help topics, each joined to an item in THIS corpus").
//             Every one of those four joins is corpus state that `mutation`
//             ops move. Read as written, this screen is not a "nothing" row;
//             see this task's report for the reasoning kept here in one
//             sentence and there in full.
//   watch     Unchanged — `seq:1`'s own subscriber, already `'*'`.
//   ask       Every tab is an audit-log view: `/api/ask/audit` (raw records,
//             any kind, filterable), `/api/ask/summary` (`summaryByOp` over
//             every op) and `/api/ask/corpus`. The screen's subject IS the
//             log, the same reason `watch` carries `'*'` — an enumerated
//             list here would need editing the day an eighth kind ships,
//             which is the exact staleness this file exists to refuse.
//   work      `/api/revisions` — the review queue's diff, and `changedSince`
//             is a straight compare of staged vs. current item text.
//             `mutation`.
//   palette   `/api/items`, `/api/review-queue`, `/api/revisions` (pickers)
//             plus `/api/config` (the picker's config-derived choices, e.g.
//             category defaults) — `mutation` for the corpus pickers,
//             `hook` for config: `.my_context/config.json` is watched by the
//             `file-changed` HOOK op, not `config-change` (that op is
//             Claude Code's OWN settings — `hooks/config-change.ts`'s own
//             header, in full).
//   config    `/api/config` only. `hook`, for the `file-changed` reason
//             above.
//   docs      `/api/help/scope` — but only `body.markdown` is drawn;
//             `screens/docs.js` says so explicitly ("`corpus` is fetched and
//             NOT drawn... duplicating it here would put the same fact on
//             two screens"). The prose itself is static. Nothing.
//   tut       Reads no endpoint at all (`screens/tut.js`'s own header:
//             "IT READS NO ENDPOINT, AND THAT IS A MEASUREMENT"). Nothing.
//   capture   `/api/config` (category picker, same `hook` reasoning as
//             palette) and `/api/capture?scope=…` (what already governs the
//             scope — `mutation`). `mutation`, `hook`.
//   proc      `/api/procedures`, `/api/procedure/:id` — step ticks come from
//             `procedureProgress` over `progress`-kind records
//             (`step-done`/`step-undone`/`step-reset`); the STAGE
//             (`active`→`done`) is written through `updateItem`, a
//             `mutation` op (`ui/proc-model.ts`'s own header, in full).
//             `mutation`, `progress`.
//   port      Every value `port-model.ts` serves is "a constant of THIS
//             BUILD" (its own header, in full) — no per-request corpus read
//             at all, pinned at compile time to `src/pack/`. Nothing.
//   packs     `/api/packs` joins the manifest to "the corpus as it is now" —
//             pack import runs through `createItem`/`updateItem`, both
//             `mutation` ops. `mutation`.
//
// ── THE THREE "NOTHING" ROWS, WRITTEN DOWN RATHER THAN LEFT ABSENT ────────
//
// `docs`, `tut` and `port` carry `kinds: []`, not a missing key. An empty
// array reads identically to "not yet declared" only if nothing enforces the
// difference; the gate below is that enforcement — a key holding `[]` passes
// it, an absent key does not. Their `refresh` is `'auto'` only because a
// value has to be SOMETHING and the gate below requires the real shape on
// every row; with `kinds: []` nothing ever arrives to act on, so the value is
// inert by construction, not a claim that re-rendering these three is safe.
//
// ── HOW `refresh` WAS DERIVED — read what the screen HOLDS, not only what
//    it shows, because the risk `'auto'` cannot take is losing STATE a
//    rebuild cannot recover: an id typed into a field, a slider mid-drag, an
//    open confirm holding a single-use nonce, rows a filter narrowed, a row
//    order a mutation could shuffle out from under an open item pane ─────
//
//   'auto'  injected  "One row per DELIVERY, in the file's own order.
//           Nothing is sorted, grouped or collapsed" (`screens/injected.js`'s
//           own header, verbatim) — the one screen in this product whose own
//           documentation already states the exact property `'auto'`
//           requires. A new delivery can only ever APPEND; no existing row's
//           position or identity moves. This is this task's own acceptance
//           screen for exactly that reason — see this task's report.
//   'auto'  status    Renders no row at all — `items.total`,
//           `reviewQueue.drafts`, `pendingRevisions.revisions`, three fixed
//           counts (`screens/status.js`), never a list a mutation could
//           reorder or a form a rebuild could clear.
//   'auto'  docs, tut, port  `kinds: []` — never triggered; see above.
//   'ask'   Every other screen — sixteen of them — for one of three reasons,
//           and most for more than one: (1) an EDITABLE field or an open
//           confirm a rebuild would wipe — `config`'s budget `<input>`s and
//           its single-use write nonce, `capture`'s draft form, `palette`'s
//           search text and picker selection; (2) CLIENT-ONLY interaction
//           state no fetch carries — `simulate`'s slider position and tier
//           pick, `proc`'s active run; (3) rows whose ORDER OR PRESENCE a
//           mutation can change under an open pane — `preview`, `coverage`,
//           `gaps`, `doctor`, `decay`, `graph`, `learn`, `work`, `packs`
//           filter, group, sort or page their rows by a value a mutation
//           moves, and `ask`'s own query filters plus its 200-row truncation
//           (`ask.truncated`) are exactly the "re-page under the reader" the
//           decision names. `watch` is listed for shape-completeness only —
//           it never reaches `app.js`'s generic wiring at all; see the
//           `EXCLUDED_FROM_GENERIC_LIVE_REFRESH` note in `app.js`.
export const SCREEN_INVALIDATION = {
  // `injection` and `hook` were MISSING here until 2026-08-28, and — unlike
  // `config`'s own missing `mutation` below — this row was never right. It was
  // derived from what the three endpoints READ, which is the corpus, and the
  // screen's subject is an EVENT. See the `preview` paragraph in this file's
  // derivation table for the four ops, the two kinds and the measurement.
  //
  // `refresh: 'ask'` is UNCHANGED and deliberately so — this is a declaration
  // of staleness, not of safety, and the two are separate properties on the
  // same row for exactly this reason. `DEC-a-refresh-keeps-the-reader-s-place
  // -or-it-asks` settles it: the screen holds an event pick and a session pick,
  // both reader state a silent rebuild would discard, so the owner gets the
  // affordance and decides when to spend it. Widening the kinds without
  // widening `refresh` is the whole shape of this fix.
  preview: { kinds: ['mutation', 'focus', 'injection', 'hook'], refresh: 'ask' },
  coverage: { kinds: ['mutation'], refresh: 'ask' },
  gaps: { kinds: ['mutation'], refresh: 'ask' },
  simulate: { kinds: ['mutation', 'injection', 'focus'], refresh: 'ask' },
  injected: { kinds: ['injection'], refresh: 'auto' },
  doctor: { kinds: ['mutation'], refresh: 'ask' },
  decay: { kinds: ['mutation', 'injection'], refresh: 'ask' },
  graph: { kinds: ['mutation'], refresh: 'ask' },
  status: { kinds: ['mutation'], refresh: 'auto' },
  learn: { kinds: ['mutation'], refresh: 'ask' },
  // Self-managed since before this task existed (`screens/watch.js`'s own
  // `ctx.subscribeStream('*', …)`) — it already redraws its own rows
  // incrementally off the shared stream. `app.js`'s generic wiring would be
  // a SECOND subscriber doing a wholesale re-render on top of the screen's
  // own fine-grained one, so it is excluded outright rather than given a
  // `refresh` this file would never honour. `kinds: '*'` stays for the gate
  // and for any future reader asking "what invalidates watch" — the honest
  // answer is still everything, whether or not this table is what acts on it.
  watch: { kinds: '*', refresh: 'auto' },
  ask: { kinds: '*', refresh: 'ask' },
  work: { kinds: ['mutation'], refresh: 'ask' },
  palette: { kinds: ['mutation', 'hook'], refresh: 'ask' },
  // `mutation` was MISSING here until 2026-08-28, and the omission was correct
  // when it was written: nothing could change a budget, so nothing this screen
  // draws could be stale from a mutation. `plan:budget seq:5` landed hours later
  // and audits a budget write as `kind: 'mutation'` — so the screen that PERFORMS
  // the write was the one screen that would not notice it.
  //
  // The owner's requirement is that Configure and the simulator agree whatever
  // the source of the change. They do not share a listener; they share this map,
  // and `simulate` already declared `mutation`. One of the two noticing a budget
  // change is worse than neither, because the two disagreeing is the state a
  // reader cannot detect by looking at either. `refresh: 'ask'` — not `'auto'` —
  // because this screen's budget cells are live `<input>`s and a save in
  // progress holds a single-use nonce; REQ-configure-and-the-simulator-agree
  // -on-the-budgets-whatever is met by both screens SURFACING the same
  // staleness the same way, not by either silently overwriting what the
  // reader is midway through typing. See this task's report for how this was
  // verified end to end.
  config: { kinds: ['hook', 'mutation'], refresh: 'ask' },
  docs: { kinds: [], refresh: 'auto' },
  tut: { kinds: [], refresh: 'auto' },
  capture: { kinds: ['mutation', 'hook'], refresh: 'ask' },
  proc: { kinds: ['mutation', 'progress'], refresh: 'ask' },
  port: { kinds: [], refresh: 'auto' },
  packs: { kinds: ['mutation'], refresh: 'ask' },
};

// ── THE DEBOUNCE, STATED RATHER THAN TUNED ─────────────────────────────────
//
// One mutation is several rows, already true of code that ships today: a
// single `mycontext add` run through Palette's Execute writes `execute`
// BEFORE the run, the CLI's own `create` row DURING it, and `execute-done`
// AFTER (`ui/execute.ts` · "TWO ops, because a run is a two-phase fact and
// this log cannot be amended" · ~34) — three `record` frames off the one
// connection for one click. An agent's own tool call carries the same shape
// one layer down: the mutation the tool performs and the `post-tool-use` HOOK
// row that observes it are two frames for one act, in the order MUTATION_OPS'
// own comment describes ("One record per act, not per write" — `core/
// audit.ts` · ~166). A subscriber that acted on the first frame of either
// pair and again on the second would refresh twice for one thing happening.
//
// 500ms is not a measured figure — nothing in this task instruments the gap
// between two rows of one act — it is a bound picked to sit comfortably above
// that gap (the rows above are written back-to-back, inside one synchronous
// hook or one child-process turnaround, not seconds apart) while staying
// under the threshold a person reads as "the page is slow to notice" rather
// than "the page just updated". Not configurable: a per-screen or per-kind
// value would turn "the burst is coalesced" into a second variable every
// screen's author has to reason about, for a number nothing here claims to
// have tuned.
export const LIVE_INVALIDATION_DEBOUNCE_MS = 500;
