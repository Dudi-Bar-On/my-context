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
// it is written down.** `library` and `port` below are the two where
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
//             `mutation` only; nothing here is session-scoped. Carries the
//             empty-category card too (`/api/help/categories`) since
//             `gaps` retired 2026-09-04 (seq:22) and folded into this screen.
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
//   library   `/api/doc` and `/api/tutorials` walk the FILESYSTEM — the wide
//             glob over `docs/` and `reports/`, and the tutorial manifest —
//             and no audit kind is emitted when a `.md` file appears on disk,
//             so those two subscribe to nothing. **`/api/corpus` is different
//             and moved this row off `[]` on 2026-09-06** (`library/2`): its
//             roster is the INDEX's own `file_path` column for the project
//             layer, so every `create`, `promote`, `discard` and `supersede`
//             adds or removes a row the file tree draws — `mutation` ops, one
//             for one. A screen listing corpus files that did not notice a
//             captured item would be the staleness this table exists to end.
//             `refresh: 'ask'` and not `'auto'`, for `DEC-a-refresh-keeps-the-
//             reader-s-place-or-it-asks`: the browser holds reader state a
//             wholesale re-render destroys — which folder they descended into
//             and which folders they expanded — and `app.js`'s generic live
//             refresh restores `#screen`'s scrollTop and nothing else.
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
// ── THE "NOTHING" ROWS, WRITTEN DOWN RATHER THAN LEFT ABSENT ─────────────
//
// `port` carries `kinds: []`, not a missing key. (`library` did too until
// 2026-09-06, when `/api/corpus` gave it a corpus read; its row above records
// the move rather than leaving the change to be inferred from a diff.) An empty
// array reads identically to "not yet declared" only if nothing enforces the
// difference; the gate below is that enforcement — a key holding `[]` passes
// it, an absent key does not. Its `refresh` is `'auto'` only because a
// value has to be SOMETHING and the gate below requires the real shape on
// every row; with `kinds: []` nothing ever arrives to act on, so the value is
// inert by construction, not a claim that re-rendering it is safe.
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
//   'auto'  library, port    `kinds: []` — never triggered; see above.
//   'ask'   Every other screen — sixteen of them — for one of three reasons,
//           and most for more than one: (1) an EDITABLE field or an open
//           confirm a rebuild would wipe — `config`'s budget `<input>`s and
//           its single-use write nonce, `capture`'s draft form, `palette`'s
//           search text and picker selection; (2) CLIENT-ONLY interaction
//           state no fetch carries — `simulate`'s slider position and tier
//           pick, `proc`'s active run; (3) rows whose ORDER OR PRESENCE a
//           mutation can change under an open pane — `preview`, `coverage`,
//           `doctor`, `decay`, `graph`, `learn`, `work`, `packs`
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
  // same row for exactly this reason. Widening the kinds without widening
  // `refresh` is the whole shape of that fix.
  //
  // **THE STATED REASON CHANGED ON 2026-08-29, because the old one had stopped
  // being true and was never wholly true.** It read: *"the screen holds an
  // event pick and a session pick, both reader state a silent rebuild would
  // discard"*. Two things were wrong with it.
  //
  //   - **The session pick did not exist.** `ctx.session()` was `/api/sessions`'
  //     default and the screen offered no selector at all, so half the
  //     justification named a control nobody could touch. It exists now — the
  //     warm/cold question strip (`#qpick` in `screens/preview.js`) — so that
  //     clause became true by the screen gaining the thing, not by the sentence
  //     being right.
  //   - **"A rebuild would discard them" is no longer the reason, because a
  //     rebuild no longer discards them.** That WAS the behaviour, and it was a
  //     defect rather than a justification: taking the refresh reset the event
  //     to `session-start`, dropped the chosen path and returned the question to
  //     warm — throwing away the very state the asking existed to protect.
  //     `preview.js`'s `PICKED` holds all three across `render()` now.
  //
  // So the reason is restated as the one that survives: **a rebuild REORDERS
  // AND REPLACES rows under an open pane.** This screen's lists are the
  // selector's own admission and consideration orders over a corpus a mutation
  // moves, and `boundedList` re-pages them — which is reason (3) in the
  // derivation table above, the same one `coverage` and `ask` are
  // listed under. The reader gets the affordance and decides when to spend it;
  // what changed is that spending it now costs them nothing.
  preview: { kinds: ['mutation', 'focus', 'injection', 'hook'], refresh: 'ask' },
  coverage: { kinds: ['mutation'], refresh: 'ask' },
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
  library: { kinds: ['mutation'], refresh: 'ask' },
  capture: { kinds: ['mutation', 'hook'], refresh: 'ask' },
  proc: { kinds: ['mutation', 'progress'], refresh: 'ask' },
  port: { kinds: [], refresh: 'auto' },
  packs: { kinds: ['mutation'], refresh: 'ask' },
};

// ══ THE SHELL'S OWN CHROME — THE STATUS STRIP AND THE PROVENANCE BAR ═══════
//
// Owner, this morning: *"the refresh mechanism you already implemented should
// include also the status line."*
//
// ── WHY A SECOND EXPORT IN THIS FILE, AND NOT A KEY IN THE TABLE ABOVE ────
//
// `SCREEN_INVALIDATION` is keyed by SCREEN NAME, and that is not decoration:
// `test/ui/live-invalidation.test.ts` reads the screen list out of `app.js`'s
// own `SCREENS` object and holds the table to it in BOTH directions — a routed
// screen with no key fails, and a key `app.js` routes no screen for fails too
// ("declared, but app.js routes no such screen"). A `strip` key in that object
// is an orphan by that gate's own definition, and loosening the gate to admit
// it would cost exactly the check that catches a renamed screen.
//
// The header above argues for ONE TABLE read by the shell and by the gate, and
// that argument is kept rather than dodged: what it forbids is a screen's
// STALENESS and a screen's SAFETY living in two maps that can drift out of
// step about the same row. This is not a second map about those rows. It is
// the same declaration, in the same file, under the same gate, about a
// DIFFERENT SUBJECT — chrome that is not a screen, has no route, is built once
// and outlives every navigation. One file, read by the shell and by the gate;
// two tables only because the two subjects are keyed by different things and a
// single key space would have to lie about one of them.
//
// ── WHY PER GROUP, AND NOT ONE ROW FOR "THE STRIP" ───────────────────────
//
// Because the strip has four sources and one row cannot carry four answers.
// The segments do not share a blocker (`app.js`'s `renderChrome` header
// records that assuming they did is how forty missing segments were explained
// by two) and they do not share a source either, so a single row would be the
// widest of the four applied to all of them: the git group refetched on every
// item write, flickering for a fact no audit record can move. Keyed by the
// group as the strip itself is grouped — `repo`, `corpus`, `session`, `audit`
// — plus `prov` for the provenance bar above it, which is the same chrome, the
// same fill pass and the same argument.
//
// ── HOW EACH ROW WAS DERIVED — from the endpoint each segment reads, the
//    same method the screen table's own derivation block uses ─────────────
//
//   repo     `#gitstate`, filled by `fillGit` from `/api/meta` — branch,
//            short commit and the upstream chip. Git state is moved by
//            committing, checking out and fetching, and NO op in
//            `core/audit.ts` records any of them: `MUTATION_OPS` is ten item
//            edits, `HOOK_OPS` sixteen Claude Code events, and the remaining
//            five kinds are injections, focus, refusals, step ticks and
//            command runs. Nothing this log can carry changes what this
//            segment says, so the honest entry is `[]` — the same
//            written-down "nothing" `library` and `port` carry above,
//            and the direct answer to "do not refetch what has not changed":
//            an item write must not make the git group flicker, and with no
//            kind declared it cannot.
//   corpus   `#stripitems`, filled by `fillItems` from `/api/status` —
//            `items.total`, a count over `store.all()`. The `status` SCREEN
//            row above derives the identical dependency from the identical
//            endpoint and lands on `['mutation']`; this segment draws one of
//            the three counts that screen draws, so it inherits that
//            derivation rather than re-deriving it differently.
//   session  `#ctx`, filled by `fillContext` from `/api/watch/context`. Two
//            halves, and only one of them is reachable from this log.
//            The context PERCENTAGE comes from the status-line tee
//            (`watch-model.ts`'s `readTee`), written by `mycontext
//            statusline` on Claude Code's own per-message hook — a command
//            that records NO audit record at all (checked: `statusline.ts`
//            reads the projection and never appends to the log), so no kind
//            announces it and this table may not pretend one does.
//            The project-knowledge share IS reachable: it is
//            `queryProjection(db, { sessionId, kind: 'injection' })`, summed
//            — `injection` records and nothing else move that number.
//            `['injection']`, for the half the stream can actually speak
//            for.
//   audit    `#auditstate` and `#auditlog` — the injection count and the
//            audit clock. Both were `[]` and one of them was permanently
//            `strip.unmeasured`, on the reasoning that no endpoint on this
//            read surface exposed an aggregate over the audit log. That was
//            true of the clock until 2026-09-01 and was never true of the
//            count: `/api/watch/context` had been serving
//            `mycontext.injections` all along. Both are drawn from that one
//            body now, so this row subscribes and shares the session group's
//            call — see `CHROME_INVALIDATION` below for why the kinds are `*`.
//   rail     the two `.cnt` badges beside Doctor and Review queue, painted by
//            `paintRailCounts` from `/api/status` (the health counts, and
//            `pendingRevisions.revisions + reviewQueue.drafts`). A third,
//            Coverage gaps, was painted from `/api/coverage` until that
//            screen and its rail entry retired 2026-09-04 (seq:22). Added
//            2026-08-31 with `plan:walk seq:120`, whose owner report is one
//            sentence about three defects:
//            `paintRailCounts()` was called from `route()` and from NOWHERE
//            ELSE, so the gold count beside Review queue was correct at the
//            moment a screen was opened and never moved again. The strip's
//            groups had refreshed live since this table landed; this row is why
//            the rail did not.
//
//            It belongs in THIS table and not the one above by every test that
//            separates them: the rail has no route, `SCREENS` does not list it,
//            `renderNav()` builds it once per language change rather than per
//            visit, and it outlives every navigation. `['mutation']` is derived
//            the way `corpus` above is — from the endpoints it reads. Both
//            `/api/status`'s three counts and `/api/coverage`'s tree are
//            functions of the items on disk, and the `status` SCREEN row lands
//            on `['mutation']` for the identical dependency; this inherits that
//            derivation rather than re-deriving it differently. `auto`, because
//            a badge holds no reader state whatsoever: it is three characters
//            of ambient count, and waiting to be pressed would leave the wrong
//            number beside the screen the reader is deciding whether to open.
//   prov     `#provproj`, filled by `fillProvenance` from `/api/watch/volume`
//            — asked for its `projectionState` and not for its series. `'*'`,
//            and the derivation is worth writing out because the obvious
//            version of it is WRONG. Every record of every kind is a line
//            appended to a segment on disk, and `projectionState`
//            (`core/audit-db.ts`) answers `behind` the moment a segment is
//            larger than the bytes the projection consumed — but `recordAudit`
//            does not stop at the append: it calls `keepProjectionCurrent` in
//            the same call, so in the ORDINARY case the projection is caught
//            up before anyone can read it and this bar's answer does not move
//            at all. What makes the row `'*'` is the other case, which is the
//            one the bar exists for: that upkeep is best-effort and returns
//            `unbuilt`, `foreign`, `diverged` or `failed` without repairing
//            anything (`keepProjectionCurrent` "never rebuilds, and never
//            creates a projection that does not exist"), and a read surface
//            may not catch a projection up either, because syncing is a write.
//            So a record is the ONLY moment this bar's answer can change, and
//            whether it DID change is precisely what the frame cannot say —
//            the difference between the two cases is on disk, not in the
//            record. Asking again is one indexed row and one column; not
//            asking means an upkeep that silently failed goes unreported until
//            somebody reloads, over a projection every other screen is being
//            refused from. This row's subject is the LOG ITSELF, the same
//            reason `watch` and `ask` carry `'*'` above, and an enumerated
//            list would be seven strings meaning "all of them" plus an edit
//            due on the day an eighth kind ships.
//
// **Why `session` is not `'*'` for the same reason `prov` is.** The share the
// context group draws also becomes UNAVAILABLE when the projection cannot be
// read (`/api/watch/context` answers 200 with `mycontextError` rather than
// refusing), so a case can be made that any kind moves it too. It is not made
// here: the freshness of the projection is a single fact about the shell, the
// provenance bar exists to state it, and `prov` states it on every kind. A
// second segment refetching on every record to redraw the same disclosure one
// line lower is the wasteful blanket this task's own bounds refuse. `session`
// declares what moves its VALUE; `prov` declares what moves its AVAILABILITY,
// once, where the reader is already looking for it.
//
// ── `auto`, ON EVERY ROW, AND THE ARGUMENT FOR IT ────────────────────────
//
// The property `DEC-a-refresh-keeps-the-reader-s-place-or-it-asks` names, and
// `'auto'` is only safe where a rebuild can discard NOTHING. The header above
// lists what makes a screen `'ask'`: an editable field or an open confirm
// holding a single-use nonce, client-only interaction state no fetch carries,
// and rows whose order or presence a mutation can change under an open pane.
// The strip holds none of the three, and this was checked against what
// `renderChrome`/`fillChrome` actually build rather than assumed from its size:
// every segment is a label, a value, a chip or a retry button, all of them
// rebuilt from the same fetch that drew them; there is no input, no selection,
// no filter, no ordering, no scroll container (`.strip` is its own grid row,
// outside `.body`'s `overflow-y:auto`) and no pane. Sixteen screens are `'ask'`
// because a rebuild there costs a reader something; a rebuild here costs
// nothing, and it is ambient provenance a reader SCANS rather than a place a
// reader is working. Waiting to be pressed would leave the wrong number on the
// bar whose entire job is to be right about the moment.
//
// The per-segment Refresh control is untouched by that and is not the same
// affordance: live refresh answers "the data moved", `strip.unread` answers
// "the call failed and I want to retry", and only the second is a thing a
// reader asks for.
//
// **`'ask'` HAS NO IMPLEMENTATION FOR CHROME, DELIBERATELY, AND THE GATE SAYS
// SO.** `app.js`'s `showLiveAffordance` is the SCREEN's affordance: one line
// and one control in this same strip, driven by a single `pendingScreenRefresh`
// slot that belongs to whichever screen is on show. A chrome row set to `'ask'`
// would either clobber that slot — taking back a screen refresh the reader has
// not pressed yet — or need a new visible control in the strip, which is a
// PRESENTATION change and the mockup is edited first. So the shell skips a
// chrome row that is not `'auto'` rather than guessing, and
// `test/ui/live-invalidation.test.ts` fails on any row that is not `'auto'`:
// the day one needs to ask, the affordance gets designed before the row
// changes, instead of the row changing and nothing happening.
export const CHROME_INVALIDATION = {
  repo: { kinds: [], refresh: 'auto' },
  corpus: { kinds: ['mutation'], refresh: 'auto' },
  session: { kinds: ['injection'], refresh: 'auto' },
  // `'*'` since 2026-09-01, when the group gained the audit clock and, later
  // the same day, a source for its injection count. It was `[]` while both
  // were drawn as permanently unmeasured. The clock reports that the log
  // moved, so every kind is its event; subscribing to a subset would be a
  // clock that stops for the kinds nobody listed. It shares
  // the session group's one call, so this costs no second endpoint.
  audit: { kinds: '*', refresh: 'auto' },
  prov: { kinds: '*', refresh: 'auto' },
  rail: { kinds: ['mutation'], refresh: 'auto' },
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
//
// **The chrome above reuses this value rather than declaring a second one**,
// and for a stronger reason than tidiness: one act writing several rows is
// exactly the case that hits the strip hardest, because a single
// `mycontext add` run through Execute, above, is a `mutation` the corpus
// group wants AND two `execution`
// rows the provenance bar wants, all inside one turnaround. Two independent
// numbers would let those two segments settle at different moments and show a
// reader a strip that is half old, for a burst that was one thing happening.
// Each SUBSCRIPTION keeps its own timer — a per-group burst must not hold up
// another group's refill — and every one of them counts to this.
export const LIVE_INVALIDATION_DEBOUNCE_MS = 500;

/**
 * **The server's own tail interval, mirrored by NAME rather than imported.**
 *
 * `src/ui/watch-model.ts` declares `STREAM_POLL_MS = 1000` and sends it to
 * every client in the `hello` frame; this file is a browser ES module and
 * cannot import a `.ts` module, so the value is restated here the way
 * `lib/command-actions.js` restates `EXECUTION_RESIDUAL`'s constant — by name,
 * with the original named beside it.
 *
 * It exists here for ONE consumer: `app.js`'s `EXECUTE_SETTLED_WINDOW_MS`,
 * which is how long after a run settles its own trailing records may still
 * arrive. That is a function of exactly two clocks — this poll, and the debounce
 * above — and a window derived from them moves when either moves, where a
 * hand-picked number would silently stop covering the path the day the tail
 * slowed down.
 *
 * A client that wants the REAL interval for a particular connection has it:
 * `hello` carries `pollMs` and `describeStreamEvent` surfaces it. This is the
 * default, which is what a window sized before any connection exists can use.
 */
export const STREAM_POLL_MS = 1000;
