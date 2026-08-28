// src/ui/public/lib/live-invalidation.js — WHICH audit record kinds make
// each screen's fetched data stale (`plan:live seq:2`). Declaration only:
// nothing here re-renders anything, and nothing here decides what a screen
// does on arrival — a refresh that keeps the reader's place, or one that
// asks first, is `plan:live seq:3`'s question about ONE screen at a time,
// not a rule this file could state for all twenty-one.
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
// `docs`, `tut` and `port` carry `[]`, not a missing key. An empty array
// reads identically to "not yet declared" only if nothing enforces the
// difference; the gate below is that enforcement — a key holding `[]` passes
// it, an absent key does not.
export const SCREEN_INVALIDATION = {
  preview: ['mutation', 'focus'],
  coverage: ['mutation'],
  gaps: ['mutation'],
  simulate: ['mutation', 'injection', 'focus'],
  injected: ['injection'],
  doctor: ['mutation'],
  decay: ['mutation', 'injection'],
  graph: ['mutation'],
  status: ['mutation'],
  learn: ['mutation'],
  watch: '*',
  ask: '*',
  work: ['mutation'],
  palette: ['mutation', 'hook'],
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
  // reader cannot detect by looking at either.
  config: ['hook', 'mutation'],
  docs: [],
  tut: [],
  capture: ['mutation', 'hook'],
  proc: ['mutation', 'progress'],
  port: [],
  packs: ['mutation'],
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
