# Web UI Plan 1 of 3 — the server and the read surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `mycontext ui` — a loopback-only, token-guarded, read-only `node:http` server plus the hand-written browser app for **ten of the mockup's twenty-one screens** — injection preview, scope coverage, coverage gaps, budget simulator, injected now, doctor, decay, relations, status, learn — with the **two** tests that make "the UI executes no writes" enforced rather than promised: a **static** import-graph test over `src/ui/` (Task 14) and a **runtime** assertion that every read route leaves a real corpus byte-identical (Task 13). §0.5 records why one of them is not enough.

**Architecture:** A standalone server entry (`src/ui/server.ts`) whose runtime import graph reaches only read functions; every `/api` route composes the nine functions §3 of the spec names and never reimplements a rule. The browser app is hand-written ES modules and CSS (logical properties only, English/Hebrew string tables with a key-parity test), served statically by the same process. Ephemerality is an idle monitor that counts only non-stream `/api` requests; the token travels by a one-shot handoff nonce, never on a process command line.

**Tech Stack:** Node ≥ 24 built-ins only (`node:http`, `node:crypto`, `node:fs`, `node:sqlite` via existing core modules). No framework, no build step, no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` — the authority for the server, the
security model and the read-only contract. Executors read both it and the mockup.

**Mockup — the UI specification:** `docs/design/web-ui-mockup.html` (third pass, 2026-08-19). Open it
in a browser. **For anything a user sees — which screens exist, what each shows, where a control lives,
what a chart plots, what an empty state looks like, and what the words are — the mockup decides**, per
the active corpus instruction `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`. Its
*data* is fabricated (all of it but one measured number); its *design* is the record. **Where the
mockup does not answer, or answers something the code cannot do, stop and ask the owner** — §0.4 lists
what this pass found and did not resolve, and §0.3 lists every graphical view whose data does not yet
exist. Read §0.2 before treating `docs/design/web-ui-mockup.md` as current; it describes an earlier
pass of the file.

**Scope split (binding):** This is plan 1 of 3.
- **Plan 1 (this document):** §3 architecture (server, token, nonce, browser opening, string tables), §2 security (loopback, header token, Origin/Host, ephemerality/idle), `/api/select` with `seen` and the labelled cold-session variant, the ten read-only screens named in the Goal (the whole `nav.inj` group, four of `nav.ev`, and `learn` from `nav.read`), and §6's write enforcement in **both** halves — the static import-graph test scoped to `src/ui/` (Task 14) and the runtime byte-identical-corpus assertion (Task 13).
- **Plan 2 (not here):** the command palette, Work (review queue + diffs, overlap detection), Configure. Where plan 2 touches this surface it consumes the **Produces** blocks below (`registerRoute`, `ApiContext`, the string-table shape, `src/core/revision-log.ts`).
- **Plan 3 (not here):** Watch (audit live stream, status strip), Ask, the status line bridge (§4b). Plan 3 consumes `registerRoute` with `kind: 'stream'` (defined here, deliberately never called here), `readGitInfo` (built and tested here because it is a foundation read), and the session selector contract (`/api/sessions`).

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native TypeScript type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` import extensions. No framework, no bundler, no CDN.
- **The UI executes no writes on any path it serves a read on.** Enforced in **two halves**, not by discipline (owner ruling 2026-08-20, §0.5). **Static** (Task 14): the set of write symbols bound under `src/ui/` is *exactly* one — `src/ui/security.ts` binding `recordAudit` for the refusal record §0.6 rules in — resolved through re-export chains to the defining module, so a second binding fails and so does none. **Runtime** (Task 13): the spawned-process E2E snapshots a real corpus, exercises **every** read route with **every request authorised**, and asserts the corpus is **byte-identical** afterwards; a second test exercises the refusal path and asserts that the one append it makes is the *only* thing that changed. Neither half subsumes the other, and the plan says so in both places: a static import walk can prove only which symbols the UI *binds* — a core read that writes internally is invisible to it — and a green runtime run proves this corpus, this route set, this once.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** This project has 30+ recorded instances; several were introduced by tasks fixing other instances.
- **Nothing is ever dropped silently.** A field accepted and ignored is the one unacceptable failure.
- **Guarantee claims carry their condition in the same sentence** (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit first.
- **A test temp directory is removed with `removeTree` from `test/helpers/tmp.ts`, never with a bare `rmSync`.** `test/no-bare-rmsync.test.ts` fails the suite on any `rmSync(…, { recursive: true …})` written in a test file: `force: true` suppresses "does not exist" and nothing else — `maxRetries` defaults to `0` — so on Windows a handle that outlives the call that closed it (SQLite's `-wal`/`-shm`, a spawned child's cwd, Defender) throws `EPERM` **from a cleanup line**, reddening whichever test was unlucky rather than the one that leaked. 403 call sites were converted for that reason. Every fixture below is written with `removeTree(dir)` and an `import { removeTree } from '../helpers/tmp.ts';`; a task that writes its own cleanup instead is a red suite, not a style difference.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.
- RTL is not retrofitted: logical CSS properties from the first stylesheet, one string table per language with a key-parity test.

---

## 0. Corrections — what this plan asserted that no longer holds

<!-- retired-phrases
ledger.seen(session) exactly as the hook does
seen: ledger.seen(sessionId)
|| 'status'
SCREENS.status;
pre-tool-use.ts:138
createItem `mutate.ts:1047`
Spec outranks it
The spec outranks it
Core/Navigate/Watch/Work/Configure/Report/Ask & learn
'nav.core': 'Core',
'learn.title': 'Help',
the default screen is `status`
ledger.entries(params.session)
no module reachable from the UI
no reachable module **binds** a symbol on the write list
Task 14 cannot be marked done
template.replace(/\{(\w+)\}/g
`t(strings, key, subs): string`
tNodes
two grammars, not one
error: gate.reason
binds a symbol on the write list
the UI binds no write symbol
{b:
four markers
four run markers
a text node
-->

**These corrections are enforced, not merely recorded.** The block above lists the phrases this
pass retired; `npm run check:retired` fails if any of them reappears anywhere below §0. That check
exists because the first attempt at this pass wrote §0 and left four task bodies still saying
`seen: ledger.seen(session)` "exactly as the hook does", and `route()` twenty tasks later still
defaulting to a screen wave 1 does not build. A correct §0 tells you nothing about whether the body
agrees with it.

**Re-verified 2026-08-18** against `master`, per `2026-08-18-v2-decisions.md` §1. This plan was written
on `plan/web-ui-server`, based on `origin/spec/web-ui-amend` at `a866fc8` — **which is not an ancestor
of `master`.** It was written on a line that diverged and never merged back, so three refactors that
landed on the line that became `master` were invisible to it. Every citation below was re-resolved.

Every row names the **class** of error, not only the instance — the §0 discipline as
`2026-08-18-v2-decisions.md` §3 fixes it. A correction that does not generalise does not prevent its
own recurrence.

| Was | Is | Class | Where |
|---|---|---|---|
| The hook passes `seen: ledger.seen(sessionId)` | **The Ledger is gone from that path entirely.** The hook reads the **per-session seen file**: `readSeen(root, ledgerKey(input))` then `seenIds(state)`. `Ledger.seen` still exists and is a replayed projection topped up by `status`, `decay` and `audit replay-ledger` | A plan names the function the code calls today, not the one that answered the question when the plan was written | Tasks 7, 8 |
| The hook opens `Store` before `Ledger` (corruption self-heal ordering) and never rebuilds | **It opens `Store.openReadOnlyChecked` and no `Ledger` at all.** The comment on that line says the Ledger is gone from the path because dedupe state moved to the seen file, and that this hook "has no reason left to write SQLite" | An ordering constraint between two components is re-checked when either leaves the path | Tasks 7, 8 |
| The eight mutating functions all live in `mutate.ts` / `revision.ts`, at the lines listed | **`linkItems` and `unlinkItems` moved to `relations.ts`.** Every line number in that row was also wrong by hundreds of lines — `createItem` was cited at `mutate.ts:1047` in a file 878 lines long | An enforcement list names **symbols**; a list of files or line numbers silently stops covering a symbol that moves | Task 14 |
| `SelectContext { event; path?; seen?; restore? }` | **It declares five inputs.** `focus?: Focus \| null` is applied before every tier and before budgeting | A parameter list is re-read whole, not diffed from memory — an omitted input is a different function | Tasks 8, 17 |
| `Selection { full; index; spilled }` | **It also carries `focus: FocusReport \| null` and `tokens: number`** — the focus disclosure, and the estimated tokens the budgets were charged | A return shape is re-read whole; fields added since are exactly the ones a screen will not render | Tasks 8, 17 |
| `helpTopic(topic, config)` | **`helpTopic(topic, config, locale?)`** — it gained a locale parameter | A signature is re-resolved, not assumed stable, when the plan calls it | Task 11 |
| `Store.open(dbPath)` is the UI's entry point | **`Store.openReadOnlyChecked(dbPath)` is.** `Store.open` self-heals by `rmSync`-ing the database and both journals; the read-only open "never triggers the corruption self-heal" and is what the hooks already use | A read path uses the narrowest open that answers the question | Tasks 8–13 |
| Swapping that one call is the whole of the correction | **It could not be, until `Ledger.openReadOnlyChecked` existed.** Task 8's `withStores` hands out a `Store` **and** a `Ledger`, and `Ledger` had exactly one open — a writable one that execs `LEDGER_SCHEMA` (two `CREATE TABLE IF NOT EXISTS` and two indexes) on every call, so opening a `Ledger` **is** a schema write. Changing only the `Store` call would have left a writable ledger connection creating tables in a database the read path never prepared: worse than the state it replaced. The row above was **unsatisfiable, not ignored**, until the read-only ledger door landed | A correction that renames one component's entry point is unsatisfiable until **every handle the corrected path hands out** has an equivalent door — a §0 row is checked against the code it commands, not only against the code it cites | Tasks 8–13 |

**Two facts moved far enough to be worth naming, though the fact itself held:** `select()` was cited at
`select.ts:324` and is at `~460`; `matchesScope` at `:149` and is at `~191`. Both cited lines now land
mid-comment in unrelated blocks. They are the two that were sampled; the rest of this table's rows were
re-resolved mechanically rather than spot-checked.

### 0.2 The mockup pass — 2026-08-20, against the rebuilt `web-ui-mockup.html`

**What changed outside this plan.** `docs/design/web-ui-mockup.html` has been rebuilt **twice** since
this plan was written on 2026-08-16, most recently on 2026-08-19 (its header comment says *"Regenerated
2026-08-19 (third pass) after a twelve-expert panel"*). It now carries **21 screens** in a **four-group
rail**, **18 restored graphical views**, an **item detail pane** (`<aside class="pane" id="pane">`), a
**provenance bar** (`<div class="prov" id="prov">`), and **329 `data-t` string keys** with a complete
Hebrew table.

**And the corpus instruction `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`
(active, `always: true`, valid from 2026-08-20) makes that file the UI specification**: *"the mockup
decides: the screens that exist, what each one shows, where a control lives, what a chart plots, what a
state looks like when it is empty, and what the words are"*, and *"when the mockup does not answer, or
answers something the code cannot do — STOP AND ASK THE OWNER."*

**So the deference this plan repeated in every screen task is now inverted, and repeating it instructs
an implementer to violate an active instruction.** Four task blockquotes said *"Spec outranks it"* and
sent the reader to `docs/design/web-ui-mockup.md` for a divergence list. That companion document still
opens with *"Authority it defers to: … the spec"* and *"Where it and the spec disagree, the spec
wins"*, and its divergence table still describes the **first-pass** mockup — *"the mockup opens on
Status"*, *"no focus anywhere"*, *"the global search box is decoration"* — none of which is true of the
file on disk. **Neither that file nor the mockup's own header comment is this plan's to change; both are
recorded as open questions in 0.4 below.** Within this plan, the mockup governs UI decisions, per the
instruction.

| Was | Is | Class | Where |
|---|---|---|---|
| *"Spec outranks it (`docs/design/web-ui-mockup.md`)"* on every screen task; the mockup is a *"visual reference"* whose divergences are listed elsewhere | **The mockup is the specification.** `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` names it *"the design of record"* and forbids adding, dropping, restyling or rewording anything it shows | A precedence rule between two documents is re-read when either is republished — a plan that quotes yesterday's precedence quietly authorises building against the wrong record | Tasks 16, 17, 18, 19 |
| The rail is grouped **Core / Navigate / Watch / Work / Configure / Report / Ask & learn** (seven), and `NAV` ships four groups keyed `nav.core`, `nav.navigate`, `nav.report`, `nav.learn` | **Four groups, grouped by tense, keyed `nav.inj`, `nav.ev`, `nav.ch`, `nav.read`**: *"Injection — what arrives"*, *"Evidence — why it did or didn't"*, *"Change — composed, never run"*, *"Read"*. Neither the count, the keys, the names nor the membership survived | A navigation taxonomy is copied from the design of record, never from an earlier draft of it — the group names are the product's own explanation of why a screen is where it is | Tasks 1, 16 |
| Screen titles `Scope coverage map`, `Relation graph`, `Currently injected`, `Help` | **`Scope coverage` (`cov.h`), `Relations` (`gr.h`), `Injected now` (`inj.h`), `Learn` (`ln.h`).** The rail labels are `s.coverage`, `s.graph`, `s.injected`, `s.learn` | A user-visible string is quoted from the string table, not paraphrased — a paraphrase is an untranslated string and a parity failure | Tasks 1, 16, 19 |
| Coverage gaps is a panel inside the coverage screen (`coverage.js`, `coverageGaps()`) | **`Coverage gaps` is its own screen** — `<section data-p="gaps">`, with its own rail button `s.gaps` carrying a count badge, its own three-column table (*Where / What / Next*) and its own third state, `not examined` | A screen list is enumerated from the design's own section elements, not inferred from what a module could render | Tasks 16, 18 |
| `route()`'s *"default screen is `status` — the recorded landing-screen exception"* (the routing note, twenty tasks after §0 recorded the opposite) | **The landing screen is the injection preview.** The mockup opens on it — `<section data-p="preview">` is the one section without `hidden`, and its rail button carries `aria-current="page"` — and Status now says so in its own body text: *"Not the landing screen, and no longer justified by being one"* (`st.sub`) | A prose note beside code is checked against the code it describes; §0 recorded this once and the note twenty tasks later still said the old thing | Task 16 |
| `apiInjected` reads `ledger.entries(session)` and joins titles | **It must read the per-session seen file.** The screen's own subtitle is *"from the per-session seen file — the parent thread's, keyed as the hook keys it"* and its note says *"Read from the seen file, not `Ledger.seen` — that is a replayed projection nothing here updates, and it would show a different number"* (`inj.note`). `Ledger.entries` is that same projection, read a row at a time. `SeenLine { id, tier, at }` carries exactly the three columns the screen draws | §0 recorded that the Ledger left the hook's path **for `/api/select`** and stopped; the same fact retires every other ledger read that claims to show live delivery | Task 9 |
| The string table is ~55 keys, `{name}` placeholders, `nav.core`-style namespacing | **329 keys**, screen-prefixed as the mockup names them, with **`{m:…}` slots** marking LTR identifier runs inside Hebrew prose, substituted **as nodes** and not as string interpolation | A table's size, key set and placeholder grammar are all one decision, taken in the design of record | Task 1 |

**One correction the mockup makes to this plan's favour, recorded so it is not "fixed" back:** Task 5
exports `itemCost` from `select.ts`, and the mockup's budget simulator states the same thing in its own
body text — *"The per-item costs it needs are `itemCost`, which is private in `select.ts` today: one
export, and this chart is live"* (`sim.stairn`). The two agree; nothing in Task 5 changes.

### 0.3 The eighteen graphical views — what this plan's read models can and cannot serve

**This table is a survey, not a design.** Per the instruction, an endpoint the mockup needs and this
plan does not have is **reported, never invented**. Every row names a `data-p` section or an element id
in the mockup so the claim can be checked, and says which plan owns the screen the view sits on.

Plan 1's read surface, in full: `/api/select`, `/api/render`, `/api/simulate` (Task 8);
`/api/sessions`, `/api/session/:session/injected` (Task 9); `/api/status`, `/api/doctor`, `/api/decay`
(Task 10); `/api/coverage`, `/api/graph`, `/api/items`, `/api/item/:id`, `/api/help/:topic` (Task 11);
`/api/meta`, `/api/ping`, `/api/handoff` (Task 13).

| # | View | Where in the mockup | Screen owner | Served? | The gap, stated exactly |
|---|---|---|---|---|---|
| 1 | Admission staircase | `data-p="simulate"` · `#stair` · `sim.stair` | **Plan 1** | ⚠️ **partly** | The rungs are computable — `/api/simulate`'s `costs` gives every candidate cost, and one further `/api/simulate` call per rung re-runs the real selector, which is what makes the sweep *"exact, not sampled"* (`sim.stairn`). But that is **N+1 round trips** for one chart, and the rung set is derived in the browser from a rule that lives in `select.ts`. **Needs: a sweep response — the rung list and the admitted set at each rung, computed server-side in one call.** Not designed here. |
| 2 | Threshold ladder | `data-p="simulate"` · `#ladder` · `sim.thresh`, `sim.snap` | **Plan 1** | ⚠️ **partly** | Same source as row 1, plus one thing it does not have: a rung must be marked **red when it is an eviction** — *"more budget, fewer items"* (`sim.snap`). That is a comparison between two adjacent rungs' admitted sets, so it falls out of the sweep in row 1 and out of nothing else. **Same gap, same endpoint.** |
| 3 | Four-tier ribbon with ghost lane | `data-p="preview"` · `#ribbons` · `preview.ribbon`, `preview.ribbonn` | **Plan 1** | ⚠️ **partly** | Three of four parts are served. Admitted segments: `Selection.full` carries `tier` per entry (`core/select.ts` · `export interface SelectionEntry {` · ~41) and `/api/simulate`'s `costs` sizes them. Ghost lane: `Selection.spilled` carries `id`, `tier` and `reason` (`core/select.ts` · `export interface Spill {` · ~46), and **its array order already is the order the selector considered each item** — Task 8 must state that the order is load-bearing and must never be re-sorted client-side. **Two gaps.** (a) *"A tier this event never reaches is drawn as **absent**, hatched and named; an empty track would claim it ran and delivered nothing, which is a different fact"* — **nothing in `Selection` says which tiers ran.** It is a pure function of `ctx.event` in `select()`, so deriving it in the browser means re-implementing the selector's own dispatch — the defect Task 5 exists to prevent. **Needs: `tiersRun` on the `/api/simulate` response, from `select.ts`.** (b) The fourth track is `index`, whose admitted content is `Selection.index.normative` **lines**, not items; `costs` is per item, so **the index track has no per-line width.** `Selection.tokens`' own docstring says index lines are charged *"per-line estimates"* — **needs: those per-line figures exposed.** |
| 4 | Spill-ratio bar | `data-p="simulate"` · `#ratio` · `sim.ratio`, `sim.ration` | **Plan 1** | ❌ **no** | The mockup names its source and it is not the ledger: *"The two numbers come from `audit_item.role` through `topItems` — already exported, already indexed, called twice"*. `topItems` exists (`core/audit-db.ts` · `export function topItems(` · ~432) and `audit_item(item_id, role)` is indexed. **Plan 1 has no audit endpoint at all** — the audit surface is plan 3's. **Needs: a delivered-vs-spilled tally over `audit_item.role`, reachable from a plan-1 screen.** Cross-plan: the view sits on plan 1's simulator and its data sits behind plan 3's boundary. |
| 5 | Tier fits chips | `data-p="simulate"` · `#simtbl` · `sim.fits`, `sim.chipn` | **Plan 1** | ✅ **yes** | *"The fits column is a **ratio**, not a count: '2 of 6'"*. Numerator and denominator are both in `/api/simulate`'s `selection`: fitted is `full` filtered by `tier`, eligible is that plus `spilled` filtered by the same `tier`. The chip's boundary flip is presentation. Nothing new. |
| 6 | Token bar with a not-recorded void | `data-p="watch"` · `watch.voidn` | Plan 3 | ❌ **no** | Needs `AuditRecord.tokens`, which is **optional** (`core/audit.ts` · `tokens?: number;` · ~206) — the whole point of the view is that *"records written before 1.0.1 never had it"* and absence draws a hatched void rather than a zero-length bar. Plan 1 has no audit endpoint; plan 3's must carry `tokens` as `number \| undefined` and never coerce it to `0`. **Reported to plan 3, not designed here.** |
| 7 | Recency comb | `data-p="decay"` · `#comb` · `dec.comb` | **Plan 1** | ✅ **yes** | One tooth per item, *"never bucketed"*: last-injection per item comes from `/api/decay`'s `series` (`Ledger.history()`, Task 7); warm / cold / unrestricted come from `report` (`DecayReport { window; sessionsRecorded; cold; warm; unrestricted }`); **never injected** is `/api/items` minus the ids in `series`; **pinned and cold** is that set intersected with `always` on `/api/items`. Both joins are presentation over two endpoints this plan already ships. |
| 8 | 90-day heatstrip | `data-p="decay"` · `#heat` · `dec.heat`, `dec.heatn` | **Plan 1** | ❌ **no** | The mockup rules out this plan's source by name: *"Its source is **not** the ledger, which records deliveries only: it is `audit_item.role` joined to `audit.at`, both indexed, with the `since` / `until` filters that already ship."* `/api/decay` returns ledger deliveries, so it can draw intensity but **cannot draw the hatched spilled days**, which is the one thing the view exists for (*"the one view that separates 'quiet' from 'selected and thrown away repeatedly'"*). **Needs: a per-item, per-day delivered/spilled series over `audit_item.role` × `audit.at`, with `since`/`until`.** |
| 9 | Per-item sparkline | item detail pane · `#panespark` · `pane.hist`, `pane.histn` | **Plan 1** (the pane is global) | ❌ **no** | Twelve weekly buckets, *"hatched where the item was **spilled** that week and grey where nothing was delivered"*. `/api/item/:id` returns `{ item, injection, usage }` and `Usage` is a **count**, not a series — and a count cannot carry the spilled state at all. **Needs: a weekly delivered/spilled series on `/api/item/:id`, from the same audit projection as row 8.** This is the sharpest one: *"the one history that belongs on **every** item rather than on a screen of its own"*, so it blocks the detail pane on every screen that links an id, not one chart. |
| 10 | Activity pulse | `data-p="watch"` · `#pulse` · `watch.pulsen` | Plan 3 | ❌ **no** | Ten-second columns over `idx_audit_at` (`core/audit-db.ts` · `idx_audit_at` · ~73), coloured by record kind. Plan 3's stream. **Reported, not designed here.** |
| 11 | Regime boundary | `data-p="watch"` · `watch.sub` · `#wfilters` `data-k="focus"` | Plan 3 | ❌ **no** | *"Four record kinds — mutations, injections, hook actions and **focus** changes. A focus change is a **regime change**, drawn as a rule across the feed rather than as one row."* Plan 1 ships `readFocus` into `/api/select` (Task 8) but records nothing over time. **Reported to plan 3, which must carry the `focus` kind and a boundary marker, not a row.** |
| 12 | Per-directory coverage magnitude | `data-p="coverage"` · `.mini` bars in `#tree` · `cov.magn` | **Plan 1** | ⚠️ **partly** | Two of three segments are served: `governed` and `ungoverned` fall out of `/api/coverage`'s `files[].governs` through Task 18's `buildTree` (`fileCount`, `governedCount`), and the count *"governed of total"* with them. **The third segment is `not examined`, and it is not served.** `/api/coverage` reports a single global `truncated: boolean`; the view needs it **per directory**, and the gaps screen prints it per path (`vendor/` — *"not examined — past the file limit"*). `gaps.note` makes it binding: *"**Not examined** is a third state, never folded into 'gap'. A file the walk did not reach is not a file nothing governs."* **Needs: `/api/coverage` to name which paths `listRepoFiles` did not reach, not merely that it stopped.** |
| 13 | Live glob strip | `data-p="palette"` · `#globtree` · `pal.globn` | Plan 2 | ✅ **for its half** | The file list it lights is already `/api/coverage`'s `files[].path`. The matching is not plan 1's and must not become it: *"Matching goes through the same `globToRegExp` cache the selector uses, over `listRepoFiles`"* — i.e. server-side, plan 2's `/api/glob`. Recorded here only so no plan-1 screen re-implements glob matching in the browser. |
| 14 | Ego-graph legend | `data-p="graph"` · `#ego` + `.legend` · `gr.lbear`, `gr.lref`, `gr.ldang`, `gr.note` | **Plan 1** | ⚠️ **partly** | Node states are served: `focus` (the response's `focus`), `missing`, `superseded` (via `status`), and `+N more` (`omitted`). **Edge severity is not.** The legend has three line styles — load-bearing, referential, dangling — and `/api/graph`'s edges carry `type` and `dangling` but no severity. The mockup names the function: *"`isLoadBearing` already classifies the vocabulary, so a dangling `relates_to` reads as noise and a dangling `constrains` reads as an alarm. Without that, a graph can only show breakage, never how much it matters."* It exists (`core/focus.ts` · `export function isLoadBearing(type: string): boolean {` · ~165) and is **already exported**, so the browser could call it — but the browser cannot import a `.ts` core module, and re-listing the vocabulary in `.js` is the copied-rule defect. **Needs: `loadBearing: boolean` on each edge in `/api/graph`, from `isLoadBearing`.** This is the cheapest gap in the table and the one that changes a view from decorative to diagnostic. |
| 15 | Before/after delta rows | `data-p="config"` · `#cfgdelta` · `cfg.deltan` | Plan 2 | n/a | *"Each row is the **pair**, not the direction alone."* Plan 2's `/api/config`. Recorded so plan 1's status screen does not grow a config delta ahead of it. |
| 16 | Word-level revision diff | `data-p="work"` · `work.diffn` | Plan 2 | n/a | Real `<ins>`/`<del>` elements, per field, with the stale field refusing promote. Plan 1's contribution is Task 6's `src/core/revision-log.ts` — the read boundary plan 2 builds the diff on. Nothing further owed here. |
| 17 | Gate ladder — the first gate that failed | `data-p="preview"` · `#gates` · `preview.why`, `preview.whyn` | **Plan 1** | ❌ **no** | **The largest gap in this plan, and it is on its flagship screen.** The view wants the six gates *"in `select()`'s own order — eligible, tier, focus, scope, seen, budget"*, with rungs above the binding one shown as passed, the binding rung carrying the diagnosis, and everything below shown as ***not reached* rather than passed**. What exists: `injection(item, config)` returns `{ phrase, injected }` and covers only the first two gates, in **English prose** — five different sentences, no code (`cli/commands/injection.ts` · `export function injection(` · ~42); and `Spill.reason` is likewise a string, and only for the budget gate. Nothing discloses focus, scope or seen per item. The mockup says so itself: *"Composing the fix needs a stable code on `injection()`; today the five causes differ only in English prose."* **Needs: a per-item gate-ladder read model returning the ordered gates with stable codes and a passed / binds / not-reached state each.** Reported. |
| 18 | `scopePolicy` blast radius | `data-p="config"` · `#spout` · `.blast` · `cfg.spn` | Plan 2 | n/a | *"The border colour and the count **are** the blast radius."* Plan 1 uses `scopePolicyFor` only in `/api/help/scope`'s `unscoped[].policy` (Task 11), which is adjacent and not the same view. Plan 2's. |

**Summary, for the owner:** of the ten views on plan-1 screens, **two are served as designed** (5, 7),
**four need one added field or response each** (1+2 share one, 3, 12, 14), and **four cannot be served
at all** by any endpoint in this plan or its siblings as currently written (4, 8, 9, 17). Rows 4, 8 and
9 all want the same thing — **an audit-projection read of `audit_item.role` joined to `audit.at`** —
which is one endpoint answering three views, and it sits behind plan 3's boundary while three plan-1
screens draw it. Row 17 wants something no module in `src/` produces today.

### 0.4 Open questions — recorded, not resolved

Per the instruction: *"When the mockup does not answer, or answers something the code cannot do — STOP
AND ASK THE OWNER. Do not resolve it yourself and do not pick the reading that is easiest to build."*

1. **The mockup contradicts the instruction about its own status.** Its header comment reads *"a VISUAL
   REFERENCE, not a specification"* and *"where this file and the spec disagree, the spec wins"*, and
   `docs/design/web-ui-mockup.md` says the same at greater length. `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask`
   says the opposite and is the newer record. **This plan follows the instruction.** Two files need
   changing to agree with it and neither is this one; both are named here so the discrepancy has an
   owner.
2. **`docs/design/web-ui-mockup.md`'s divergence table describes a mockup that no longer exists** — it
   still says *"the mockup opens on Status"*, *"no focus anywhere"* and *"the global search box is
   decoration"*. The file on disk opens on `data-p="preview"`, ships a focus picker (`#focuspop`) and
   has no search box. A stale divergence list is worse than none, because every screen task pointed at
   it.
3. **Three mockup screens are unassigned across all three plans.** `data-p="gaps"` (*Coverage gaps*),
   `data-p="docs"` (*Documentation* — the repository's README rendered and addressed by **heading
   ordinal**, `dv.sub`) and `data-p="tut"` (*Tutorials* — six of them, `tu.1`–`tu.6`, with per-language
   ✅ / *to write* status). Plans 1, 2 and 3 build fourteen screens between them; the mockup shows
   twenty-one. Gaps is folded into plan 1's coverage screen (Task 18) and is corrected below to be its
   own screen; **Documentation and Tutorials belong to no plan and are not claimed here.**
4. **The item detail pane is global and unowned.** `<aside class="pane" id="pane">` is the destination
   of every `button.linkid` on every screen, in all four rail groups. Plan 1's Task 11 ships
   `/api/item/:id`, which is most of its `<dl>`, but no task builds the pane itself and its sparkline
   cannot be served at all (0.3 row 9). Which plan owns it is a question, not an assumption.
5. **The provenance bar (`<div class="prov" id="prov">`) is unowned**, and the mockup does not state
   what it renders — it is populated entirely by `paintProv()` in script. Its data contract is not
   derivable from the file.
6. **The empty-state view is a first-class state in the mockup and is not in this plan.** The top bar
   carries a `∅` toggle (`#empty`, *"Toggle the zero-data view"*) and coverage ships a whole alternate
   section (`#covempty`: *"Nothing governs this project yet"*, `cov.e1`/`cov.e2`). Plan 1 names empty
   states only for sessions (`session.empty`). Whether every plan-1 screen owes a drawn empty state, or
   only the ones the mockup draws one for, is the owner's call.
7. **Four rail entries are marked `PROPOSED`** — `s.proc`, `s.port`, `s.packs`, and the `carried` tier
   chip inside the injection preview's delivered table (`tier.carried`). The instruction says
   `PROPOSED` *"is still specified; it is marked because the capability behind it is not built"*. The
   `carried` row sits **inside a plan-1 screen** and this plan has no capability behind it — the
   *"3 index lines carried from session"* line (`preview.carried`) has no read model in Task 8. Whether
   plan 1 draws it as a marked-unbuilt state or omits it is a question.
8. **`/api/select` cannot grow any of the fields 0.3 needs**, by this plan's own Design decision 7: it
   returns *"`select()`'s JSON serialization and nothing else"* and a parity test enforces it. Every
   added field in 0.3 is therefore routed to `/api/simulate` or a new endpoint. That is a constraint on
   the answers, not an answer.
9. **Nothing caps how many refusal records one process can be made to write** (§0.6). The refusal path
   is by definition the *unauthenticated* path, so anything that can reach the port can make the log
   grow. Three things bound it and none of them is a cap: the server binds `127.0.0.1` only, it exits
   on its idle window, and `AUDIT_MAX_BYTES` rotation bounds any one **file**
   (`core/audit.ts` · `export const AUDIT_MAX_BYTES = 8 * 1024 * 1024;` · ~250) — total growth is not
   bounded, and `doctor`'s `audit_log_size` check is what reports it. Whether a per-process refusal cap
   is wanted, and whether repeated identical refusals should coalesce, is the owner's call. **Recorded,
   not decided, and not silently mitigated.**
10. **A refused handoff nonce is not covered by the audit ruling.** `POST /api/handoff` refuses an
    invalid, expired or already-used nonce in its own branch, not through `validateApiRequest`, so it
    produces no `access` record — the four `RefusalCheck` values are the gate's four exits and nothing
    else. A replayed nonce is arguably exactly what an audit log is for. Extending the vocabulary with
    a fifth member is the obvious shape; it is the owner's call and is **not** taken here.

### 0.5 The no-writes ban is scoped, and it grows a runtime half — OWNER RULING, 2026-08-20

**This resolves the open question Task 14 recorded and no longer carries.** That question asked whether
the symbol ban should stay whole-graph. It should not, and the reason is a fact about this repository
rather than a preference.

**What was red on day one.** The whole-graph form of the ban failed against `master` before a line of
`src/ui/` was written, on three modules this plan's read model imports *on purpose*:
`src/core/focus.ts` binds `recordAudit`
(`core/focus.ts` · `import { recordAudit, type AuditWriteResult } from './audit.ts';` · ~3) and calls
it inside `setFocus` and `unsetFocus`; `src/core/seen-file.ts` binds `appendJsonlLine`
(`core/seen-file.ts` · `import { appendJsonlLine, readJsonlFile, type JsonlLogSpec } from './jsonl-log.ts';` · ~3)
and calls it inside `appendSeen`; and `src/core/audit.ts` calls `appendJsonlLine` itself
(`core/audit.ts` · `appendJsonlLine(auditDir(root), file, record);` · ~399). But
`readFocus` (`core/focus.ts` · `export function readFocus(root: string): FocusState {` · ~321) and
`readSeen` (`core/seen-file.ts` · `export function readSeen(root: string, key: string): SeenState {` · ~109)
contain **zero write calls** — verified by reading both bodies whole, not by grepping their modules.
Task 8 needs the first; Tasks 8 and 9 need the second and `seenIds`. So the whole-graph ban was red by
**guilt by co-location** — a fact about which functions share a file, never a fact about whether the UI
writes. Stretching a test until it is unsatisfiable does not make it stricter; it makes it red, and a
red gate stops being read.

**The ruling, in two halves.** The unit of the ban stays the **symbol**; only its **scope** changes,
and a second, different kind of proof is added beside it.

| Was | Is | Class | Where |
|---|---|---|---|
| The symbol ban applies to **every module reachable from `src/ui/server.ts`**, so a core module that binds a writer anywhere in it fails the test | **It applies to modules under `src/ui/` and its re-export reach.** Importing `readFocus` passes; importing `setFocus` fails. Core modules the UI *calls* are out of scope, and Task 14 states that limitation in the task and in the test file rather than leaving it implicit | An enforcement scope is set by the property being proved, not by how much the analyser can walk — a check widened past what it can honestly conclude fails on facts that are not the property | Task 14; Design decision 3 |
| The static import-graph test is the whole of the enforcement | **It is one half.** Task 13's spawned-process E2E gains a no-write assertion: snapshot the corpus, exercise **every** read route, assert byte-identical afterwards | A static property and a runtime property are proved by different instruments; one instrument answering for both is a claim the plan cannot cash | Tasks 13, 14; Global Constraints |

**Why both, stated so neither is over-read.** A static import walk can prove exactly one thing: *the UI
does not BIND a writer.* It can never prove *the UI does not write.* A read that writes internally is
invisible to it — and **that class is real in this codebase, not hypothetical**: `Store.open` self-heals
on corruption by deleting the database and both journals
(`core/store.ts` · `rmSync(dbPath, { force: true });` · ~345), which is why the row above at §0 routes
this server to `Store.openReadOnlyChecked`. No import line discloses that; only running the routes and
looking at the bytes does. The runtime assertion is what proves the actual invariant, and the static
one is what proves it *before* a route exists to run.

**What was rejected, and why — recorded so it is not reopened:**

1. **Pinning the `(module → writer)` pairs as a set that must not change.** It is the allow-list under
   another name. It churns as core evolves — every unrelated addition to `focus.ts`, `seen-file.ts` or
   `audit.ts` reddens a UI test — and it still proves nothing about writing, only about importing.
2. **Extracting the readers out of `focus.ts` / `seen-file.ts` / `audit.ts`** the way Task 6 did for
   `revision-log.ts`. Structurally the purest of the three, and rejected on cost against yield: it buys
   only what the runtime half already proves, at the price of a refactor of `audit.ts` — the largest of
   the three and sitting directly on the injection path — for a static claim that would still stop at
   the import line.

**The limitation this leaves, said once here and again in Task 14 and in the test file:** nothing in
this plan proves that a core read function does not write. Task 14 proves the UI binds no writer beyond
the one refusal record §0.6 rules in; Task 13 proves the corpus survived one full sweep of the read
routes unchanged. A route that writes only on a corpus state the fixture does not contain is outside
both, and neither test may be quoted as ruling it out.

### 0.6 Three owner rulings — 2026-08-20

**Nothing below went stale. The owner decided three things this plan had decided differently**, and the
rows are written in the form §0 already uses, so `npm run check:retired` keeps these applied to the body
exactly as it keeps the earlier ones. Every phrase these rulings retire is declared in the block at the
top of §0.

| Was | Is | Class | Where |
|---|---|---|---|
| `t()` returns a **string** — `template.replace` over a `\w`-only placeholder — and a second renderer exists for the strings that need elements | **`t()` returns `Node[]`, and there is no second renderer.** A string cannot carry an element, so the bidi isolation is flattened at the one moment it is needed; and `\w` does not match a colon, so a monospace **value** slot matches nothing and reaches the screen **with its braces visible**. Callers append: `el.append(...t(key, vals))` | A renderer's return type is decided by the richest thing it must return, not by the commonest — a type that cannot express one case does not "mostly work", it drops that case in silence | Tasks 1, 16; Produces summary |
| An attribute string comes from calling the string-returning `t()` | **It comes from `tFlat()`** — the same parse, then flattened — **and the flattening is named as deliberate at the sink.** An `aria-label`, a `title` and an `<option>` label cannot hold an element, so the isolation cannot survive there whatever the renderer does; on screen the same flattening is the defect. The mockup needs the same helper and has it (`flat`, beside its `applyLang`) | A lossy conversion is justified where it happens, or it is indistinguishable from the bug it resembles | Tasks 1, 16 |
| Two placeholder grammars, one of them a value slot | **Four markers, three of them value slots** — `{name}` a text node, `{m:text}` a monospace isolated element around a literal, `{mv:name}` that same element around a substituted value, and `{b:name}` an isolated **non**-monospace element for text of unknown direction. `{b:…}` is ruled but not yet in the mockup: `t()` honours it from the start and **no string table may use it until the mockup declares it** | A placeholder grammar is transcribed whole from the design of record, and a marker ruled ahead of the design goes into the engine, never into the table | Task 1; Task 16 |
| A refused `/api` request answers `{ error: gate.reason }` | **It answers the status code and nothing else — no body at all**, from a helper with no parameter to put a reason in. Ruling 11 had already made those reasons developer-facing fixed strings carrying no submitted input, but a comment saying *"do not render this"* cannot stop a later task rendering it. **Nothing can render what is never sent** | A property held by instruction holds until someone reads past the instruction; the same property held by structure needs no reader | Task 13; Task 16's `api()` |
| A refused request leaves no trace anywhere | **It is recorded in the audit log**: the check that refused, and the submitted `Host`/`Origin` — which is where ruling 11 said the submitted value belongs. It is the **one** write this read-only surface performs, it happens on the **refusal path only and never on a served read**, and both halves of §0.5's enforcement are amended to say so rather than to look away | A value worth keeping and a value worth returning are different questions; dropping an echo without giving the value somewhere to go loses it twice | Tasks 2, 13, 14; §0.5 |

#### The refusal record — the tension, stated, and resolved

**The tension is real and is not softened here.** This plan's premise is that the UI is a read-only
surface, and §0.5's two halves exist to prove it. This ruling puts one write inside it. Both stand
together only because the write is bounded in a way that can be **checked** rather than promised:

- It happens **only when a request is refused** — only when `validateApiRequest` returns `ok: false`.
  A request that passes the gate is served without touching a byte, and that is exactly what Task 13's
  byte-identical assertion goes on proving, because **every request in its sweep is authorised** and the
  sweep already fails on any response that is not `200` or `404`.
- It is **one append to the existing audit log**, through the same `recordAudit`
  (`core/audit.ts` · `export function recordAudit(root: string, input: AuditInput): AuditWriteResult {` · ~383)
  every other subsystem uses. No new file, no new format, no new writer.
- It is what makes the dropped echo recoverable. Ruling 11 removed the submitted value from the string
  handed back to the sender and said where it belonged instead — *"it belongs in an audit record, not
  in a string handed back to the party that supplied it"*
  (`ui/security.ts` · `belongs in an audit record, not in a string handed back to the` · ~94). This is
  that record.

**The shape, exactly, because a later task implements from this and not from the paragraph above.**

```ts
// src/core/audit.ts — a FIFTH kind, and its one op. A refused request changed
// no item, was shown no corpus text and ran in no hook, so filing it under
// `mutation`, `injection` or `hook` would make `mycontext audit --kind …` a
// question with a wrong answer — the same reasoning this module already applies
// to `focus` being a kind of its own.
export const ACCESS_OPS = ['ui-refused'] as const;
export type AccessOp = (typeof ACCESS_OPS)[number];
export type AuditKind = 'mutation' | 'injection' | 'hook' | 'focus' | 'access' | 'progress';

/** Which gate check refused. Closed: `validateApiRequest` has exactly four refusing exits. */
export type RefusalCheck = 'host' | 'origin' | 'token-missing' | 'token-mismatch';

// …and `validateApiRequest`'s failure shape names it, so the caller does not
// have to infer the check from the status code — 403 is returned by three of
// the four exits, so inferring it is not possible anyway:
//   { ok: false; status: number; check: RefusalCheck; reason: string }

export interface RefusalDetail {
  check: RefusalCheck;
  /** The code the sender received, so the log and the wire cannot disagree. */
  status: 401 | 403;
  method: string;
  /** `url.pathname`. NEVER `url.search` — see the field rules below. */
  route: string;
  /** As submitted. `null` when the header was absent; `''` when it was sent empty. */
  host: string | null;
  origin: string | null;
}

// added to AuditRecord, and to nothing else:
//   /** `access` records only: what the gate refused, and what it was handed. */
//   refusal?: RefusalDetail;

// src/ui/security.ts — the one write this surface performs.
export const REFUSAL_VALUE_MAX = 256;
export function recordRefusal(root: string, refusal: RefusalDetail): AuditWriteResult;
```

**The field rules, each of which is a decision and not a formatting note:**

1. **`check`, not `reason`.** The developer string stays out of the record. `reason` is prose *about*
   the check; `check` **is** the check, it is a closed vocabulary, and a reader filtering the log wants
   the value it can filter on. The four values map one-to-one onto `validateApiRequest`'s four refusing
   returns, in its own order: `host`, `origin`, `token-missing`, `token-mismatch`.
2. **`host` and `origin` are recorded as submitted, and absence is distinguished from emptiness.**
   `null` means the header was not sent — normal for `Origin` on a same-origin GET, and itself the fact
   a reader needs — and `''` means it was sent empty. Where the gate read the **first** value of a
   repeated header, the record carries that same first value, so the log says what the gate judged
   rather than what the socket carried.
3. **Both are capped at `REFUSAL_VALUE_MAX` characters**, and a capped value is stored as its first 256
   characters followed by `'…'`, so a truncated value is visibly truncated and cannot be misread as
   what was sent. `route` takes the same cap for the same reason: a refused path is caller-supplied
   text.
4. **`url.search` is not recorded.** The route is what identifies the request; a query string is
   unbounded caller-supplied data answering no question this record asks.
5. **The token is never recorded, in any form** — not the submitted value, not its length, not a
   prefix, not a hash. It is the secret the gate exists to protect, and an audit log is a file on disk.
   Task 13's E2E asserts its absence from the serialized record rather than trusting this sentence.
6. **`AuditRecord.origin` and `RefusalDetail.origin` are different things.** The first is the `Origin`
   of a mutation — who made it; the second is the HTTP `Origin` header. Nesting is what keeps them
   apart, and a flat `origin` on the record would collide with a field that already means something
   else. An `access` record carries no `AuditRecord.origin`, no `itemId` and no `sessionId`: a refused
   request has none of them.
7. **The write happens before the response is sent**, so a refusal cannot be answered and then lost.
   `recordAudit` is a synchronous append, not a read-modify-write.
8. **The result is discarded.** `recordAudit` never throws and returns `{ written: false, error }` on
   failure; the server does with it what the hooks do — nothing — because there is no one to tell, and
   telling the refused party would be the echo ruling 11 removed. A log that has stopped being writable
   is still discoverable through `doctor`'s `audit_log_size` check.

**What this does to §0.5's static half — which the ruling does not mention and which must not be left
implicit.** `recordAudit` is on Task 14's banned-symbol list, and this ruling binds it in
`src/ui/security.ts`. The ban as written and this ruling cannot both stand. **The ban is not relaxed
into an allow-list** — that was rejected twice above, for a reason that has not changed. It is made
**exact**: Task 14's assertion 2 now asserts that the set of write bindings under `src/ui/` is
*precisely* `src/ui/security.ts` binding `recordAudit`, and nothing else. A second write binding fails.
So does **zero** — deleting the refusal record fails the test too, which is what keeps this ruling
applied rather than merely recorded.

### 0.7 The marker grammar, corrected — OWNER RULING, 2026-08-20 (amends §0.6)

**This amends an amendment, and it is recorded that way on purpose.** §0.6's other four rows stand
whole: `t()` returns `Node[]`, there is no second renderer, `tFlat()` is still the flattening helper
for the attribute and text-only sinks that cannot hold an element, and both refusal rulings are
untouched. Two details *inside* its **third** row — the placeholder grammar — were wrong. Editing that
row into quiet agreement with this one would destroy the only thing a correction log is for: it would
leave a §0 that has never itself been wrong, which is precisely the claim §0 exists to disprove. So
that row keeps saying what it said, and the two below say what replaced it.

| Was | Is | Class | Where |
|---|---|---|---|
| §0.6: **four markers**, the fourth `{b:name}` an isolated non-monospace element for text of unknown direction — ruled ahead of the mockup, honoured by `t()` from the start, and forbidden in any string table until the mockup declares it | **Three markers. `{b:…}` is DROPPED, not deferred.** Its premise was that a plain `{name}` hands its value the paragraph's direction, so direction-unknown text needed a marker of its own. **The premise was false when it was written**: the mockup renders *every* value slot as `<span class="v">` and gives `.v` `unicode-bidi: isolate` — *"a count or an id sitting inside RTL prose must keep its own direction"* — so a plain slot was **already isolated** and `{b:…}` only duplicated `{v:…}`. This is a **removal, not a migration**, and the rule that kept the marker out of the tables is what makes it one: nothing was ever allowed to carry it, and a grep of the two shipped tables finds no `{b:` in either. A leftover would not render, either: with the marker gone `t()` reads `{b:err}` as a plain slot NAMED `b:err`, finds no such substitution, and throws — the removal fails loudly instead of shipping braces to the screen | A marker ruled ahead of the design is checked against what the design's CODE does, not only against what its prose says — a treatment invented to cover a defect the specification had already covered is duplication wearing the clothes of a fix | Tasks 1, 16; Produces summary |
| §0.6: `{name}` builds **a text node**, so a substituted value takes the paragraph's direction like any other prose | **`{name}` builds `span.v`** — isolated, deliberately not monospace, around the substituted value: what the mockup's `slotNode` builds and what its sheet styles. A count, a session id or a branch name inside Hebrew prose keeps its own direction whether or not it is monospace. `styles.css` therefore ships `.v` beside `.m`, and `t()`'s contract is **three markers, two treatments** — `{name}` isolated; `{m:text}` and `{mv:name}` monospace and isolated, differing only in whether the run's text comes from the table or from the data | Where a design file's prose and its code disagree about a runtime contract, the code is the design — a specification is read off what the artefact DOES, and a sentence in it the artefact contradicts is the sentence that is wrong | Tasks 1, 16 |

**The `bdi` rule §0.6 added to `styles.css` goes with the marker, and the reason is worth stating
rather than leaving to inference.** It was added as *"what a `{b:…}` run builds"*; with `{b:…}` gone,
**nothing in this plan constructs a `<bdi>` element**, so the rule selects nothing. It is also the
browser's own default for `<bdi>`, so it never did work the UA sheet was not already doing — it
asserted a treatment rather than applying one. `.v` replaces it and is load-bearing in exactly the way
the `bdi` rule was not: `t()` builds a `span.v` wherever any string substitutes a value, and a
`span.v` with no rule in the sheet is an isolation that exists in the DOM and not on the glass.

**One thing this ruling does not fix, recorded rather than closed.** The mockup also wraps
direction-unknown *corpus* text — an item title, an audit cell, a chip — in a `<bdi>` built by a helper
of its own. That is a different mechanism from the string grammar: it is not a marker, and no ruling
here reaches it. Tasks 17-19 render that same corpus text with `textContent` into plain elements (an
item's `title`, the seen file's own error text, a doctor finding's message), so it is **not** isolated
today. The gap is real, it predates both this ruling and §0.6, and closing it changes three tasks'
rendering rather than the marker grammar. **It is reported to the owner here and not resolved, which is
what §0.4 requires of a question the mockup answers and this plan does not** — and it is emphatically
not licence for a task to start wrapping corpus text on its own.

---

## Verified facts this plan builds on

**Re-verified against `master` on 2026-08-18.** Citations are `file` · `verbatim fragment` · `~line`,
per `2026-08-18-v2-decisions.md` §2: the **fragment is the identity** and the line is a hint that may
go stale. `npm run verify:citations` resolves every fragment in this table and exits non-zero on a
miss. Where the plan needs a fact it could not verify, the task says "establish by executing" instead
of asserting it.

| Fact | Where verified |
|---|---|
| `select(items, ctx, config): Selection` | `core/select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~460 |
| `SelectContext` declares **five** inputs: `event`, `path?`, `seen?`, `restore?`, **`focus?`** | `core/select.ts` · `export interface SelectContext {` · ~19 |
| `SelectEvent = 'session-start' \| 'compact' \| 'tool' \| 'manual'` | `core/select.ts` · `export type SelectEvent = 'session-start' \| 'compact' \| 'tool' \| 'manual';` · ~17 |
| `Selection { full; index; spilled; focus; tokens }` | `core/select.ts` · `export interface Selection {` · ~72 |
| Seen items filtered **before** budgeting; comment says "must not be reverted" | `core/select.ts` · `hardening and must not be reverted: an already-injected item must not` · ~476 |
| Focus narrows the eligible set before every tier and before budgeting | `core/select.ts` · `const focus = ctx.focus ?? null;` · ~469 |
| The hook reads the **per-session seen file**, not the Ledger | `hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183 |
| The dedupe key carries `agent_id` when present — `session_id::agent_id` for a subagent, the bare id for the parent | `hooks/io.ts` · `export function ledgerKey(input: HookInput): string \| null {` · ~46 |
| The hook opens the index **read-only and schema-checked**, and no Ledger | `hooks/pre-tool-use.ts` · `store = Store.openReadOnlyChecked(ws.dbPath);` · ~175 |
| The hook passes the focus it read | `hooks/pre-tool-use.ts` · `const focusState = readFocus(ws.projectRoot);` · ~199 |
| `matchesScope(item, target, config)` | `core/select.ts` · `export function matchesScope(item: Item, target: string, config: Config): boolean {` · ~191 |
| `isEligible(item, config)` | `core/select.ts` · `export function isEligible(item: Item, config: Config): boolean {` · ~123 |
| `isNormative` is **private** (no `export`) | `core/select.ts` · `function isNormative(item: Item, config: Config): boolean {` · ~129 |
| `itemCost` is **private** — Task 5 exports it | `core/select.ts` · `function itemCost(item: Item): number {` · ~119 |
| `estimateTokens(text)` — chars/4 | `core/select.ts` · `export function estimateTokens(text: string): number {` · ~106 |
| `reviewQueue(items, type?)` — takes a plain `Item[]` | `core/select.ts` · `export function reviewQueue(items: Item[], type: string \| null = null): Item[] {` · ~344 |
| `mergeLayers(items)` exported | `core/select.ts` · `export function mergeLayers(items: Item[]): Item[] {` · ~411 |
| `injectableTypes(config)` exported | `core/select.ts` · `export function injectableTypes(config: Config): string[] {` · ~144 |
| `injection(item, config): { phrase, injected }` | `cli/commands/injection.ts` · `export function injection(` · ~42 |
| `scopePolicyFor(config, type)` | `core/config.ts` · `export function scopePolicyFor(config: Config, type: string): ScopePolicy {` · ~138 |
| `agentEditsFor(config, type)` | `core/config.ts` · `export function agentEditsFor(config: Config, type: string): AgentEdits {` · ~160 |
| `resolveConfig(raw): Config` | `core/config.ts` · `export function resolveConfig(raw: unknown): Config {` · ~408 |
| `Config { profile; categories; budgets; watchedDocs }` | `core/config.ts` · `export interface Config {` · ~166 |
| `Budgets { pinned; jit; restored; index }` | `core/config.ts` · `export interface Budgets {` · ~5 |
| `Ledger.seen(sessionId)` — **a replayed projection, not live dedupe state** | `core/ledger.ts` · `seen(sessionId: string): string[] {` · ~179 |
| `Ledger.recentSessions(limit)` — ties broken `session_id DESC` | `core/ledger.ts` · `recentSessions(limit: number): string[] {` · ~242 |
| `Ledger.entries(sessionId): LedgerEntry[]` | `core/ledger.ts` · `entries(sessionId: string): LedgerEntry[] {` · ~186 |
| `Ledger.allUsage()` | `core/ledger.ts` · `allUsage(): Usage[] {` · ~225 |
| `Ledger.itemsUsedIn(sessionIds)` | `core/ledger.ts` · `itemsUsedIn(sessionIds: string[]): string[] {` · ~263 |
| `Ledger.sessionCount()` | `core/ledger.ts` · `sessionCount(): number {` · ~314 |
| Ledger schema: `PRIMARY KEY (session_id, item_id, tier)`, `injected_at` a value | `core/ledger.ts` · `PRIMARY KEY (session_id, item_id, tier)` · ~35 |
| `Ledger.open` relies on a writable open having run first against the same path | `core/ledger.ts` · `static open(dbPath: string, busyTimeoutMs = 3000): Ledger {` · ~76 |
| `readSnapshotMeta(root, sessionId)` reads a compact snapshot's item ids | `core/ledger.ts` · `export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta \| null {` · ~503 |
| `renderSelection(selection)` renders the injected text | `core/render.ts` · `export function renderSelection(selection: Selection): string {` · ~139 |
| **`Store.openReadOnlyChecked(dbPath)` — what this server must use** | `core/store.ts` · `static openReadOnlyChecked(dbPath: string): Store {` · ~402 |
| `Store.open(dbPath)` — **self-heals by deleting the file; not for a read path** | `core/store.ts` · `static open(dbPath: string, profile: OpenProfile = DEFAULT_OPEN_PROFILE, _retried = false): Store {` · ~337 |
| `store.all()` | `core/store.ts` · `all(): Item[] {` · ~489 |
| `store.activeInjectable(types)` | `core/store.ts` · `activeInjectable(types: string[]): Item[] {` · ~511 |
| `assertSelectOnly(sql)` — the barrier `readOnly: true` does **not** provide | `cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~114 |
| `resolveWorkspace(cwd): Workspace` | `core/workspace.ts` · `export function resolveWorkspace(cwd: string): Workspace {` · ~27 |
| `Workspace { projectRoot; globalRoot; dbPath; config }` | `core/workspace.ts` · `export interface Workspace {` · ~9 |
| `runChecks(opts): Finding[]` | `doctor/checks.ts` · `export function runChecks(opts: {` · ~748 |
| `Finding { level; code; message; item? }` | `doctor/checks.ts` · `export interface Finding {` · ~13 |
| `listRepoFiles(repoRoot, limit)` exported; skips `.git`, `node_modules`, … | `doctor/checks.ts` · `export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {` · ~73 |
| `computeDecay(input): DecayReport` | `core/decay.ts` · `export function computeDecay(input: DecayInput): DecayReport {` · ~93 |
| `DecayReport { window; sessionsRecorded; cold; warm; unrestricted }` | `core/decay.ts` · `export interface DecayReport {` · ~24 |
| `helpTopic(topic, config, locale?)` — **three parameters now** | `help/index.ts` · `export function helpTopic(topic: string, config: Config, locale?: HelpLocale): string {` · ~112 |
| `HELP_TOPICS = ['categories','scope','capture','workflow']` | `help/index.ts` · `export const HELP_TOPICS: HelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~11 |
| `registerCommand(def)` | `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46 |
| `CommandFn = (ws, args, out, cwd) => number` | `cli/commands/registry.ts` · `export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;` · ~6 |
| CLI main sets `process.exitCode` (never `process.exit`), so a live server keeps the process alive | `cli/index.ts` · `process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));` · ~838 |
| `createItem` | `core/mutate.ts` · `export function createItem(` · ~184 |
| `updateItem` | `core/mutate.ts` · `export function updateItem(` · ~451 |
| `supersedeItem` | `core/mutate.ts` · `export function supersedeItem(ctx: MutationContext, input: SupersedeInput): MutationResult {` · ~746 |
| `linkItems` — **`relations.ts`, not `mutate.ts`** | `core/relations.ts` · `export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~74 |
| `unlinkItems` — **`relations.ts`, not `mutate.ts`** | `core/relations.ts` · `export function unlinkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~244 |
| `stageRevision` | `core/revision.ts` · `export function stageRevision(` · ~865 |
| `promoteRevision` | `core/revision.ts` · `export function promoteRevision(` · ~1071 |
| `discardRevision` | `core/revision.ts` · `export function discardRevision(` · ~1176 |
| `revision.ts` imports `updateItem` from `mutate.ts` at runtime, so importing anything from `revision.ts` pulls `mutate.ts` in | `core/revision.ts` · `import { updateItem, type MutationContext, type MutationResult } from './mutate.ts';` · ~7 |
| `readLog(root)` — **`revision-log.ts`, not `revision.ts`**, after Task 6's extraction | `core/revision-log.ts` · `export function readLog(root: string): LogLine[] {` · ~116 |
| `pendingRevisionCounts(revs)` — **`revision-log.ts`, not `revision.ts`**, after Task 6's extraction | `core/revision-log.ts` · `export function pendingRevisionCounts(` · ~221 |
| `pendingRevisionLine(revs)` | `core/revision.ts` · `export function pendingRevisionLine(revs: PendingRevision[]): string {` · ~685 |
| `Item` has **no creation timestamp** | `core/types.ts` · `export interface Item {` · ~33 |
| `Relation { type: string; target: string }` | `core/types.ts` · `export interface Relation {` · ~28 |
| `VERSION` is read from `package.json`, not transcribed | `core/version.ts` · `export const VERSION = parseVersion(readFileSync(MANIFEST, 'utf8'), 'package.json');` · ~75 |
| tsconfig: `erasableSyntaxOnly` | `tsconfig.json` · `"erasableSyntaxOnly": true,` · ~10 |
| tsconfig: `allowImportingTsExtensions` | `tsconfig.json` · `"allowImportingTsExtensions": true,` · ~6 |
| tsconfig: `verbatimModuleSyntax` | `tsconfig.json` · `"verbatimModuleSyntax": true,` · ~9 |

**Facts that are absences, and cannot carry a fragment.** These are re-checked by execution, not by
citation — `verify-citations.ts` has nothing to resolve for a thing that does not exist:

| Fact | How it was re-checked |
|---|---|
| No `child_process` use anywhere in `src/` | `grep -rn child_process src/` — no matches, 2026-08-18 |
| `package.json` has no `dependencies` key | read; `devDependencies` holds only `typescript` and `@types/node` |
| `runChecks`' import graph reaches `rebuild.ts` (via `ingest/session.ts`) but **not** `mutate.ts`/`revision.ts` | import headers of `doctor/checks.ts`, `ingest/session.ts`, `ingest/chunk.ts`, `core/rebuild.ts` |
| E2E test pattern: spawn a real child, readiness-gated harness | `test/mcp/server-e2e.test.ts`, `test/helpers/stdio.ts` |
| Docs parity pattern, and its honesty docstring | `test/docs/parity.test.ts` |

**Task-1 preconditions, re-run against `master` on 2026-08-18** — §8.1 step 4. Executed, not read:

| Precondition | Result |
|---|---|
| `src/ui/` does not exist | ✅ absent — Task 1 starts clean |
| `test/ui/` does not exist | ✅ absent |
| `npm test`'s glob reaches a new `test/ui/` directory | ✅ `test/**/*.test.ts` |
| A plain browser `.js` module with named exports imports into `node --test` **without a build step** — the assumption the whole no-build-step string-table design rests on | ✅ **executed**: a probe module exporting `strings`/`dir`/`lang` was imported from a `node --test` file and all three named exports resolved. It works because `package.json` declares `"type": "module"`; that field is load-bearing for Task 1 and was not named in the original plan |

**The worktree fact this plan must not get wrong:** in a git worktree, `<repo>/.git` is a **file**
containing `gitdir: <path>`, not a directory. The developer building this works in worktrees daily
(this plan was itself written inside one, where `.git` is exactly such a file). Task 4 handles both
shapes and tests both.

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **The server never rebuilds the index.** The hook reads the store as-is (`pre-tool-use.ts:129-138`); the flagship screen's promise is "see exactly what Claude gets", so `/api/select` must read exactly what the hook reads. Staleness is not hidden: `/api/doctor` surfaces `index_stale` (`doctor/checks.ts:146`), and the status screen renders it.
2. **The server opens `Store` before `Ledger` on every request that needs the ledger**, for the reason documented at `src/core/ledger.ts:74-88`.
3. **The import-graph test bans write SYMBOLS, not the files that contain them, and it is scoped to `src/ui/` — OWNER RULING** (Task 14 carries it in full; §0.5 records the 2026-08-20 scope amendment). The invariant is *"the UI cannot write"*, not *"the UI cannot import a file that contains a writer"*: `src/core/revision-log.ts` imports only `readJsonlFile` from `jsonl-log.ts`, which also exports three writers, and `focus.ts`/`seen-file.ts` are imported for `readFocus`/`readSeen` and likewise export writers. A module ban would need an allow-list for each, and **an allow-list was rejected** — it grows, and each entry becomes a hole nobody re-examines. The test therefore asserts: (a) the write-list symbols bound under `src/ui/` are **exactly** the one the owner ruled in — `src/ui/security.ts` binding `recordAudit` for the refusal record (§0.6) — with every binding resolved through **re-export chains** to the module that defines it (`revision.ts` re-exports `revision-log.ts`'s reads in the two-statement `import … ; export { … };` form, so this is real); the assertion is an exact set rather than an emptiness check, so a second write binding fails **and so does deleting the ruled one**; (b) no `export *` or `import * as` inside the graph, because neither leaves a per-symbol fact to check; (c) no reachable module contains `require(` or a dynamic `import(` — which is what makes the static analysis sound. Type-only imports are erased by `verbatimModuleSyntax` and are skipped. **The module ban is not lost where it mattered:** a `src/ui/` module that binds `updateItem` — directly, renamed, or laundered through a re-exporting module — trips, for the real reason rather than by filename. Importing `readLog` from `revision.ts` does **not** trip, because the resolver places it in `revision-log.ts` and a reader is not a writer; Task 6's boundary is a design rule this plan keeps (a read surface should not load `mutate.ts`), not a thing this test enforces. **Core modules the UI calls are out of scope, and that is a limitation, not a gap in the ban:** a static walk can only conclude that the UI does not *bind* a writer. **The other half is runtime and lives in Task 13's existing spawned-process E2E, not in a harness of its own** — snapshot the corpus, exercise every read route through the real HTTP surface, assert the corpus is byte-identical afterwards. That is the half that can observe a read which writes internally, the class `Store.open`'s corruption self-heal belongs to (§0, §0.5), and it is the only half that proves the invariant rather than a proxy for it. A second spawn harness would be a second thing to keep true, so it goes in `test/ui/server-e2e.test.ts` beside the security assertions.
4. **Consequence of 3:** the status screen's pending-revisions count cannot come from `revision.ts`. Task 6 extracts the read-only log-reading half of `revision.ts` into `src/core/revision-log.ts` (no `mutate.ts` import), with `revision.ts` re-importing from it so every existing caller is untouched. This is a move, not a rewrite.
5. **Two nonce lifetimes, both one-shot.** The browser-opener URL carries a 10-second nonce (§3: visible in a process list for its lifetime). The `--no-open` / spawn-fallback URL is *printed*, never on a command line, so its nonce gets 10 minutes — long enough to paste into a browser by hand, still one-shot, still dead on server exit. The spec fixes only the opener's 10 seconds; the printed-URL lifetime is this plan's decision and the on-screen text says which URL kind it is.
6. **Unknown query parameters are refused with 400**, per INV-nothing-is-dropped-silently. `/api/select?sesion=x` answering the cold question because a typo dropped the session would be this project's canonical defect in a new medium.
7. **`/api/select` returns `select()`'s JSON serialization and nothing else** — the §6 parity test demands `assert.deepEqual(JSON.parse(body), JSON.parse(JSON.stringify(select(items, ctx, config))))`, so budget bars and rendered text come from two sibling endpoints (`/api/simulate`, `/api/render`) rather than from fields bolted onto the parity endpoint.
8. **Per-item cost comes from `select.ts` itself.** Task 5 exports the existing private `itemCost` (spec §3's "export it — but not both, and never neither" logic, applied to the cost rule instead of copying its one-line body into the simulator).
9. **The Learn screen's "most recent captures" cross-link uses the item file's mtime, labelled as such.** `Item` carries no creation timestamp (`types.ts:33-58`) and the ledger records injection, not capture. File mtime is the only recency signal that exists; the label carries the condition in the same sentence.
10. **Every string key in Tasks 17–19's illustrative code is resolved against the mockup before it is typed** (§0.2). Those samples were written against the retired ~55-key table; this pass corrected the ten screen headings and `btn.copy` to their mockup keys, and **left the rest as they stand, marked here rather than silently remapped.** Any remaining `ctx.t('…')` in a code sample below — `preview.pickFile`, `preview.spilled`, `preview.nothing`, `preview.renderedText`, `simulate.budget`, `simulate.fits`, `simulate.spills`, `injected.none`, `coverage.governs`, `coverage.wouldInject`, `coverage.gapDirs`, `coverage.emptyCategories`, `coverage.print`, `coverage.truncated`, `graph.focus`, `graph.radius`, `graph.more`, `graph.dangling`, `status.items`, `status.drafts`, `status.revisions`, `status.health`, `doctor.repair`, `decay.caveat`, `learn.corpusLinks`, `learn.recentCaptures`, `common.loading` — **is a placeholder, not a key.** Resolve each against the mockup's 329 `data-t` keys at implementation time. **Where the mockup has no counterpart, that is an open question for the owner and not a licence to add one**: the parity test in Task 1 fails on an invented key by design, and the instruction is explicit that *"if it seems obviously missing, it is a question, not a licence."* Guessing a mapping here would be inventing UI text on paper, which is the same defect as inventing it in code.
11. **A screen the mockup draws as a chart is not shipped as a table.** Where §0.3 records that a view's data does not exist, the screen **stops and the question is escalated** — it does not render a weaker substitute. The instruction names this failure directly: *"Dropping one it does show, or quietly rendering a weaker version — a table where it draws a chart, a number where it draws a distribution, a label where it discloses a reason. This has already happened twice."* Four views on plan-1 screens are in that state (§0.3 rows 4, 8, 9, 17).

---

## File Structure

New files (created by this plan):

```
src/ui/
  server.ts            # entry point; http server, routing dispatch, security gate,
                       #   handoff, ping, idle wiring; also runnable as a main module
  routes.ts            # route table + registerRoute() — the extension point plans 2/3 consume
  security.ts          # token mint, constant-time compare, NonceStore, request validation
  idle.ts              # IdleMonitor — 15-minute idle exit, injectable clock
  git-info.ts          # readGitInfo(): branch/commit/upstream from .git *files*,
                       #   handling .git-as-file (worktree) and .git-as-directory
  open.ts              # per-platform browser opener; first child_process use in src/
  static.ts            # static asset serving for src/ui/public, traversal-proof
  read-model.ts        # every /api read handler as a pure, HTTP-free function
  public/
    index.html         # app shell
    styles.css         # logical properties ONLY (no left/right); print stylesheet
    app.js             # router, session selector, language switch, heartbeat, exit banner
    lib/
      bootstrap.js     # fragment-nonce → token exchange; history.replaceState
      heartbeat.js     # visibility-gated 60s ping
      i18n.js          # string-table selection, <html dir>/lang
      viewmodel.js     # pure screen view-models (coverage tree, graph layout, decay series)
    strings/
      en.js            # English string table
      he.js            # Hebrew string table (identical key set — tested)
    screens/           # one file per mockup `data-p` section, named for it
      preview.js       # nav.inj: injection preview — gate ladder + four-tier ribbon
      coverage.js      # nav.inj: scope coverage — tree with magnitude bars, detail pane, print
      gaps.js          # nav.inj: coverage gaps — its OWN screen (`data-p="gaps"`), not a panel
      simulate.js      # nav.inj: budget simulator — staircase, ladder, fits chips, ratio bar
      injected.js      # nav.inj: injected now — from the SEEN FILE (Task 9)
      doctor.js        # nav.ev:  findings grouped by code, three levels kept distinct
      decay.js         # nav.ev:  recency comb + 90-day heatstrip
      graph.js         # nav.ev:  relations — ego-graph (radius 1-2, 60-node cap, layered)
      status.js        # nav.ev:  status — the recorded table exception, NOT the landing screen
      learn.js         # nav.read: help topics cross-linked to the corpus
src/core/revision-log.ts   # read-only revision-log reading, extracted from revision.ts
src/cli/commands/ui.ts     # `mycontext ui [--port N] [--no-open]`
test/ui/
  strings-parity.test.ts
  security.test.ts
  idle.test.ts
  git-info.test.ts
  read-model.test.ts       # select parity matrix + every read endpoint's pure function
  static.test.ts
  server-e2e.test.ts       # spawned process, real HTTP: security + handoff + ping + idle,
                           #   AND the runtime no-write assertion (corpus byte-identical
                           #   after every read route) — the other half of §0.5's ruling
  no-writes.test.ts        # THE import-graph test, scoped to src/ui/ (§0.5)
  helpers.ts               # spawn-server harness (readiness-gated, like test/helpers/stdio.ts)
test/core/revision-log.test.ts
```

**Ten screens, and the mockup shows twenty-one** (§0.2). The eleven this plan does not build:
`watch`, `ask` (plan 3); `work`, `capture`, `palette`, `config` (plan 2); `proc`, `port`, `packs`
(marked `PROPOSED` in the rail — still specified, no capability behind them yet); and **`docs` and
`tut`, which no plan claims** (§0.4 item 3). Two shared surfaces are also unbuilt by any plan: the
item detail pane (`aside.pane#pane`) and the provenance bar (`div.prov#prov`). None of the eleven is
claimed here.

Modified files:

```
src/core/select.ts             # export itemCost (Task 5) — nothing else changes
src/core/revision.ts           # imports the moved read functions from revision-log.ts (Task 6)
src/core/ledger.ts             # + history(), sessionSummaries(limit) — read-only additions (Task 7)
src/cli/commands/index.ts      # + import './ui.ts'
README.md, docs/README.he.md   # document `mycontext ui` (Task 20, both documents)
```

---

## Task 1: The string tables and their key-parity test

**Files:**
- Create: `src/ui/public/strings/en.js`
- Create: `src/ui/public/strings/he.js`
- Test: `test/ui/strings-parity.test.ts`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `strings` — a default-less named export from each of `src/ui/public/strings/en.js` and `he.js`: `export const strings = { [key: string]: string }`, plus `export const dir = 'ltr' | 'rtl'` and `export const lang = 'en' | 'he'`. Plans 2 and 3 add keys to **both** files in the same commit; the parity test fails on any asymmetric key.

**The key set is the mockup's, not this task's invention** (§0.2). `docs/design/web-ui-mockup.html`
carries **329 distinct `data-t` keys** and a Hebrew table (`const HE = {…}`) covering every one of them.
That is the starting set, and its namespacing is the mockup's own: rail groups are `nav.inj`, `nav.ev`,
`nav.ch`, `nav.read`; rail labels are `s.preview` … `s.learn`; per-screen keys carry the screen's short
prefix and the mockup's own suffixes (`preview.h` the heading, `preview.sub` the subtitle, `preview.v`
the verdict, `preview.ribbonn` the note beneath the ribbon); shared table headers are `th.item`,
`th.tier`, `th.when`, `th.kind`, `th.what`, `th.role`, `th.where`, `th.act`; shared affordances are
`btn.copy`, `help.why`, `help.more`, `help.land`. **Do not re-namespace them.** A key is how a
translation is found, and renaming one silently orphans its Hebrew value.

**Placeholders — three markers, two treatments.** The grammar is the mockup's, in the comment above
`const HE=` in `docs/design/web-ui-mockup.html`, and its central sentence is that **the marker is the
treatment**: what a marker means is *how the run is rendered*, so the marker travels into
the shipped table and a monospace value slot never transcribes down to a plain one. The mockup states
the transcription for its own three explicitly — *"`{m:text}` → `{m:text}` the literal, and the marker,
kept; `{v:name=sample}` → `{name}`; `{mv:name=sample}` → `{mv:name}` NOT `{name}`: the monospace is the
point"* — and records what happened when it did not: `cap.already` shipped as `Already governing
{scope}` and `pr.item` as `{item}`, *"a glob and an item id inside RTL prose, with the isolation
removed."*

| In the shipped table | Substitutes | What `t()` builds |
|---|---|---|
| `{name}` | yes, from `subs` | `span.v` — isolated (`unicode-bidi: isolate`) and deliberately **not** monospace, around the substituted value |
| `{m:text}` | no; the text is literal and identical in both languages | `span.m` — monospace, `direction: ltr`, `unicode-bidi: isolate`, around the literal |
| `{mv:name}` | yes, from `subs` | a `span` with `class="m v"` — that same monospace isolated run, around the **substituted** value |

**Two treatments, not three: a plain slot builds an element too** (owner ruling, §0.7). The mockup's
code is the specification for all three markers and it is unambiguous: `slotNode` builds `{m:…}` as
`span.m`, a value slot as `span.v`, and a monospace value slot as a `span` with `class="m v"`; the
sheet gives `.m` its font, `direction: ltr` and `unicode-bidi: isolate`, and gives `.v` the isolation
alone — *"A VALUE SLOT: text the shipped app fills from real data, never from the string table. Isolated
for the same reason .m is — a count or an id sitting inside RTL prose must keep its own direction.
Carries no other styling, so marking a value changes nothing on screen."* So the markers differ in
**two** ways only: whether the run is monospace, and whether its text comes from the table or from
`subs`. **There is no unisolated case**, and therefore no marker for direction-unknown text: isolation
is exactly what such a marker would have added, and a plain `{name}` already has it.

**The parity test's value-slot assertion already covers both value forms, and needs nothing added.** It
matches **whole markers** rather than bare names — `{name}` and `{mv:name}` are different slots — so a
Hebrew value that transcribes `{mv:branch}` down to `{branch}` is a reported mismatch and not a silent
loss of the monospace isolation, which is the regression the mockup records by name. It compares the set
of markers rather than their order, because a slot legitimately sits elsewhere in a Hebrew sentence; the
`{m:…}` assertion beside it compares positionally, because a literal is an identifier and must be the
same text in the same places in both languages.

**`t()` therefore returns nodes — `Node[]`, for every key, marked or not.** Two facts force it and both
are the mockup's own record. A **string cannot carry an element**, so a string-returning renderer
flattens the isolation at exactly the moment it is needed; the file's header comment records that as a
shipped defect — `el.textContent = …` *"flattens just as thoroughly: the English side was captured as a
STRING, so the seven `data-t` elements holding `.m` spans lost them on the first toggle and never got
them back."* And a `\w`-based placeholder pattern **cannot even see** `{mv:branch}`, because `\w`
excludes the colon: the run matches nothing, is substituted by nothing, and reaches the screen with its
braces showing. Where a string has to become an attribute or an `<option>` label, `tFlat()` performs the
same parse and then flattens it **deliberately** — an attribute cannot hold an element, so that is the
one place the flattening is not the bug. Task 16 defines both (§0.6).

The string files are plain browser ES modules (`.js`, no types) so both the browser and `node --test` can import them unmodified — this is why the parity test can exist without a build step.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/strings-parity.test.ts
/**
 * Parity between the English and Hebrew UI string tables, and between both of
 * them and the design of record, in the spirit of test/docs/parity.test.ts.
 *
 * BOTH DIRECTIONS, on both axes, because a one-directional check misses the
 * two failures the corpus instruction names by name — a string INVENTED (in a
 * table, absent from the mockup) and a string DROPPED (in the mockup, absent
 * from a table). "en is a subset of he" would pass while either happened.
 *
 * Every check that walks a set COLLECTS and asserts ONCE at the end. An
 * assertion inside the loop throws on the first offender and never reaches the
 * rest, so a Hebrew omission stays invisible until the English one is fixed —
 * one key per run. A parity failure is worth reporting whole.
 *
 * What this test cannot do, stated so a green suite is not mistaken for
 * verified Hebrew: it compares KEY COVERAGE and SLOT STRUCTURE only, never
 * translation freshness. A Hebrew value left stale by an English edit passes
 * every assertion here. Translation freshness is a review obligation, not a
 * tested one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const MOCKUP = path.join(import.meta.dirname, '../../docs/design/web-ui-mockup.html');

/**
 * Every `data-t` key the design of record declares. The count is DERIVED, never
 * pinned: it was 326 when this plan was written and is 329 on the file today,
 * and a test that remembers a number fails for the wrong reason the next time
 * a screen gains a label.
 */
function mockupKeys(): Set<string> {
  const html = readFileSync(MOCKUP, 'utf8');
  return new Set([...html.matchAll(/data-t="([^"]+)"/g)].map((m) => m[1]));
}

/** The `{m:…}` runs in a value, in order — the LTR-isolated identifiers. */
function slots(value: string): string[] {
  return [...value.matchAll(/\{m:([^}]*)\}/g)].map((m) => m[1]);
}

test('en and he string tables declare identical key sets — in both directions', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const he = await import('../../src/ui/public/strings/he.js');
  const enKeys = new Set(Object.keys(en.strings));
  const heKeys = new Set(Object.keys(he.strings));
  assert.deepEqual([...enKeys].filter((k) => !heKeys.has(k)), [], 'in en, missing from he');
  assert.deepEqual([...heKeys].filter((k) => !enKeys.has(k)), [], 'in he, missing from en');
});

test('the tables and the mockup declare the same keys — in both directions', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const design = mockupKeys();
  const shipped = new Set(Object.keys(en.strings));
  // DROPPED: the mockup shows a string the product does not have. The
  // instruction calls this "quietly rendering a weaker version".
  assert.deepEqual([...design].filter((k) => !shipped.has(k)).sort(), [],
    'declared by the mockup, missing from the string tables');
  // INVENTED: a string with no design entry. Every such string is also an
  // untranslated one, which is why this is a parity test and not a lint.
  assert.deepEqual([...shipped].filter((k) => !design.has(k)).sort(), [],
    'in the string tables, not shown by the mockup — invent a screen, invent a string');
});

test('the {m:…} slots match key for key, so an identifier is isolated in both languages', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const he = await import('../../src/ui/public/strings/he.js');
  // The literal text between the braces is the SAME in both languages: it is
  // an identifier, a path or a command, not prose. A Hebrew value that drops
  // the slot renders the identifier as RTL text; one that renames it names a
  // symbol that does not exist.
  const mismatched: { key: string; en: string[]; he: string[] }[] = [];
  for (const [key, value] of Object.entries(en.strings)) {
    const heValue = he.strings[key];
    // A key missing from he is the FIRST test's failure, not this one's — and
    // reading slots off `undefined` would throw here instead of reporting it
    // there. Skipped so both reports survive the same run.
    if (typeof heValue !== 'string') continue;
    const a = slots(value);
    const b = slots(heValue);
    if (a.length !== b.length || a.some((s, i) => s !== b[i])) mismatched.push({ key, en: a, he: b });
  }
  assert.deepEqual(mismatched, [], 'monospace slots differ between the two tables');
});

test('each table declares its direction and language', async () => {
  const en = await import('../../src/ui/public/strings/en.js');
  const he = await import('../../src/ui/public/strings/he.js');
  assert.equal(en.dir, 'ltr');
  assert.equal(en.lang, 'en');
  assert.equal(he.dir, 'rtl');
  assert.equal(he.lang, 'he');
});

test('no string value is empty — an empty translation is a dropped string', async () => {
  const empty: string[] = [];
  for (const mod of ['en', 'he']) {
    const { strings } = await import(`../../src/ui/public/strings/${mod}.js`);
    for (const [key, value] of Object.entries(strings)) {
      if (typeof value !== 'string' || value.trim() === '') empty.push(`${mod}:${key}`);
    }
  }
  assert.deepEqual(empty, [], 'empty string values');
});
```

**On the mockup-parity test, before objecting to it.** It couples a test to a design file, which is
unusual — and it is the only mechanism that catches the two regressions this project has already
suffered. The mockup's own header records them: *"a regeneration dropped six screens, and a later one
kept the screens and lost the 18 graphical views inside them. Both were caught late."* The instruction
forbids both directions of drift; nothing but a checker enforces a prohibition. **If the mockup and the
product are agreed to diverge, the mockup changes first** (the instruction is explicit: *"If a change to
the mockup is agreed, the mockup changes first"*), and this test goes green by that route rather than by
being relaxed.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/strings-parity.test.ts`
Expected: FAIL — cannot find module `src/ui/public/strings/en.js`.

- [ ] **Step 3: Write the two tables — by transcription, not by authorship**

**Both tables already exist.** The English values are the text content of the mockup's 329 `data-t`
elements; the Hebrew values are the mockup's `const HE = {…}` object, which covers all 329. Task 1
**transcribes** them into `en.js` and `he.js`. It does not compose new sentences: *"Every user-visible
string is in the mockup's table with a Hebrew pair. Inventing a new sentence creates an untranslated
string and a parity failure."*

Mechanically, for `he.js`: lift `const HE` out of the mockup's `<script>`, drop its two non-string
members (`_dir`, `_lang` — they become the `dir` and `lang` exports), and export the rest as `strings`.
For `en.js`: take each `data-t` element's rendered English text, collapsing any `<span class="m">`
child it contains into a `{m:…}` slot, which is precisely the inverse of what the mockup's `slots()`
does on the Hebrew side. **Where an English string contains a `.m` span, its `{m:…}` slot content must
equal the Hebrew's** — the third test above is what enforces it.

**Four shared keys carry more than one English text in the mockup, so "the English value" is not
defined for them — reported, not resolved.** Measured against `docs/design/web-ui-mockup.html`: `th.item`
is *"Item"* on three elements and *"Example"* on a fourth; `th.when` is *"When"* twice and *"At"* once;
`th.what` is *"What"*, *"State"* and *"Bucket"*; and `help.why` is *"Why these are not in the tree"*,
*"Why raising a budget can remove an item"* and *"What \"cold\" does and does not mean"* — **three
`<summary>` elements, three different sentences, one key.** The Hebrew table gives each of the four a
single short value (`help.why` is `'למה'`), so the shipped English side reads `'Why'`, which is a
translation of the Hebrew and not a transcription of any of the three English texts. **This is the
mockup not answering, which §0.4's rule sends to the owner** — either the key set needs splitting or the
three summaries need one wording, and neither is this plan's to decide. Task 1's parity test compares
key coverage only and cannot see it.

The shape below is verbatim from the mockup **except** for those four keys, and every value is written
whole: **a value truncated with an ellipsis is a value an implementer can transcribe truncated**, which
is how a user-visible string gets silently shortened.

```js
// src/ui/public/strings/en.js
export const lang = 'en';
export const dir = 'ltr';
export const strings = {
  // rail groups — by tense, and the group name is part of the explanation
  'nav.inj': 'Injection — what arrives',
  'nav.ev': "Evidence — why it did or didn't",
  'nav.ch': 'Change — composed, never run',
  'nav.read': 'Read',
  // rail labels — one per screen the mockup shows
  's.preview': 'Injection preview',
  's.coverage': 'Scope coverage',
  's.gaps': 'Coverage gaps',
  's.simulate': 'Budget simulator',
  's.injected': 'Injected now',
  's.doctor': 'Doctor',
  's.decay': 'Decay',
  's.graph': 'Relations',
  's.status': 'Status',
  's.learn': 'Learn',
  // per screen: `.h` heading, `.v` verdict, `.sub` subtitle, then its own keys
  'preview.h': 'Injection preview',
  'preview.v': 'exactly what Claude gets',
  'preview.sub': 'What the most recent session was given at its start. Pick a file to preview a '
    + 'tool event instead; the session and focus above narrow this the way the hook does.',
  'preview.ribbon': 'Budget ribbon — four tiers, and what fell out of each',
  'preview.ribbonn': 'One segment per admitted item, sized by its real {m:itemCost}. Beneath each '
    + 'track is the ghost lane: every spilled item at the width it would have taken, in the '
    + 'position the selector considered it. A wide ghost followed by a narrow fill is first-fit '
    + 'being honest — drawing spills as a tail would misrepresent the algorithm. A tier this event '
    + 'never reaches is drawn as absent, hatched and named; an empty track would claim it ran and '
    + 'delivered nothing, which is a different fact. Follows the event selector above rather than '
    + 'adding a second one.',
  // shared table headers and affordances — declared once, used by every screen.
  // th.item / th.when / th.what are three of the four keys the mockup gives more
  // than one English text; these are the majority spelling, pending the owner.
  'th.item': 'Item', 'th.tier': 'Tier', 'th.when': 'When', 'th.kind': 'Kind',
  'th.what': 'What', 'th.role': 'Role', 'th.where': 'Where', 'th.act': 'Next',
  'btn.copy': 'Copy',
  // help.why is the fourth: the mockup spells it three ways and none of them is
  // 'Why' — this value is the Hebrew's ('למה'), not a transcription. Owner call.
  'help.why': 'Why', 'help.more': 'What decides this', 'help.land': 'How you will know it worked',
  // … 329 keys in total. The mockup is the list; the parity test is the check.
};
```

```js
// src/ui/public/strings/he.js
export const lang = 'he';
export const dir = 'rtl';
export const strings = {
  'nav.inj': 'הזרקה — מה מגיע',
  'nav.ev': 'ראיות — למה כן או לא',
  'nav.ch': 'שינוי — מורכב, לא מורץ',
  'nav.read': 'קריאה',
  's.preview': 'תצוגת הזרקה',
  's.coverage': 'כיסוי היקף',
  's.gaps': 'פערי כיסוי',
  's.simulate': 'סימולטור תקציב',
  's.injected': 'מוזרק כעת',
  'preview.h': 'תצוגת הזרקה',
  'preview.v': 'בדיוק מה ש‑Claude מקבל',
  // … every key from en.js. The parity tests enforce the set AND the {m:…} slots.
};
```

(The literal files must contain every key — the ellipsis comments are for this plan only and must not
appear as a substitute for keys.)

**Two keys this plan needs that the mockup does not declare, and what to do about them.** The exit
banner (`ex.msg`, `ex.ok`) *is* in the mockup, but the heartbeat and the language-picker label are not:
the mockup switches language with an unlabelled `א/A` icon button and has no server-exit reconnection
text beyond `ex.msg`. **Both are open questions for the owner, not licence** (§0.4): an accessible name
for that button is an accessibility fix, and the instruction routes those through the mockup first —
*"an accessibility or correctness fix that the mockup contradicts is still worth making — but it is
raised, agreed, and applied to the mockup first, like anything else."* Until that happens, the parity
test's "invented" assertion will fail on any key added here, which is the correct outcome: it stops the
plan rather than the reader.

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/strings-parity.test.ts`
Expected: PASS (5 tests) — the five the block above defines, including the one that resolves the tables against `docs/design/web-ui-mockup.html` in **both** directions. (The shipped file adds a sixth: a guard that the mockup is readable and declares keys at all, so a moved or corrupted mockup fails as itself rather than as an empty key set that makes every assertion below pass while saying nothing.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/strings test/ui/strings-parity.test.ts
git commit -m "feat(ui): English and Hebrew string tables with key-parity test"
```

---

## Task 2: `security.ts` — token, nonce store, request validation

**Files:**
- Create: `src/ui/security.ts`
- Test: `test/ui/security.test.ts`

**Interfaces:**
- Consumes: `node:crypto` only.
- Produces (plans 2 and 3 call none of these directly — the server gate applies them to every route, theirs included — but the signatures are fixed here):
  - `mintToken(): string` — 32 random bytes, hex (64 chars).
  - `TOKEN_HEADER = 'x-mycontext-token'` (Node lower-cases incoming header names; the browser sends `X-Mycontext-Token`).
  - `class NonceStore { mint(ttlMs: number, now?: number): string; redeem(nonce: string, now?: number): boolean }` — one-shot: `redeem` returns `true` at most once per nonce, and `false` after expiry.
  - `validateApiRequest(req: { headers: Record<string, string | string[] | undefined> }, expected: { token: string; port: number }): { ok: true } | { ok: false; status: number; check: RefusalCheck; reason: string }` — checks `Host`, `Origin` (when present), and the token header, in that order. **`check` was added by ruling B4** (§0.6): three of the four exits return `403`, so a caller cannot infer which check refused from the status, and the audit record needs exactly that.
  - **Added by owner ruling B4, 2026-08-20 (§0.6): `recordRefusal(root, refusal): AuditWriteResult`, and `REFUSAL_VALUE_MAX`.** A refused request is recorded in the audit log with the check that refused and the submitted `Host`/`Origin` — the destination ruling 11 named for the submitted value when it took it out of `reason`. **§0.6 carries the record's exact shape, its eight field rules and the tension it creates with §0.5**; this module is where it is implemented, and this binding of `recordAudit` is the single write binding Task 14's exact-set assertion expects to find under `src/ui/`. `reason` stays what it is — developer-facing, fixed, never rendered, and, from ruling A4, **never sent to the browser at all**.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/security.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mintToken, NonceStore, TOKEN_HEADER, validateApiRequest,
} from '../../src/ui/security.ts';

test('mintToken returns 64 hex chars and never repeats across calls', () => {
  const a = mintToken();
  const b = mintToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
});

test('a nonce redeems exactly once', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 1_000), true);
  assert.equal(store.redeem(nonce, 1_001), false);
});

test('a nonce is dead after its window', () => {
  const store = new NonceStore();
  const nonce = store.mint(10_000, 0);
  assert.equal(store.redeem(nonce, 10_001), false);
});

test('an unknown nonce never redeems', () => {
  const store = new NonceStore();
  store.mint(10_000, 0);
  assert.equal(store.redeem('not-a-nonce', 0), false);
});

function req(headers: Record<string, string>): { headers: Record<string, string> } {
  return { headers };
}

const EXPECT = { token: 'a'.repeat(64), port: 4111 };
const HOST = '127.0.0.1:4111';

test('the exact token with the right Host passes', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(verdict, { ok: true });
});

test('a wrong token is 403', () => {
  const verdict = validateApiRequest(
    req({ host: HOST, [TOKEN_HEADER]: 'b'.repeat(64) }), EXPECT,
  );
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 403);
});

test('a missing token header is 401', () => {
  const verdict = validateApiRequest(req({ host: HOST }), EXPECT);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 401);
});

test('a wrong Host is 403 even with the right token', () => {
  const verdict = validateApiRequest(
    req({ host: 'evil.example:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.equal(verdict.status, 403);
});

test('a cross-origin Origin is 403; the loopback Origin and an absent Origin pass', () => {
  const bad = validateApiRequest(
    req({ host: HOST, origin: 'https://evil.example', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(bad.ok, false);
  const good = validateApiRequest(
    req({ host: HOST, origin: `http://${HOST}`, [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.deepEqual(good, { ok: true });
});

test('localhost is not 127.0.0.1 — the page is only ever served on 127.0.0.1, so a localhost Host is refused', () => {
  const verdict = validateApiRequest(
    req({ host: 'localhost:4111', [TOKEN_HEADER]: EXPECT.token }), EXPECT,
  );
  assert.equal(verdict.ok, false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/security.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/security.ts
import { randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * The session token: 32 random bytes, minted per invocation, held in memory
 * on both sides and nowhere else. It is required in a custom header on every
 * /api request — the custom header is the CSRF defence: a cross-origin form
 * post cannot set one, and with no CORS headers the browser blocks the fetch
 * outright (spec §2).
 */
export function mintToken(): string {
  return randomBytes(32).toString('hex');
}

/** Node lower-cases incoming header names; the page sends `X-Mycontext-Token`. */
export const TOKEN_HEADER = 'x-mycontext-token';

/**
 * One-shot handoff nonces (spec §3, "Opening the browser"). A nonce is minted
 * with its own ttl — 10 seconds for a URL that transits a process command
 * line, longer for a URL that is only ever printed — and redeems at most
 * once. Redeemed and expired nonces are deleted; the store never grows past
 * the handful a single invocation mints.
 */
export class NonceStore {
  #nonces = new Map<string, number>(); // nonce -> expiry epoch ms

  mint(ttlMs: number, now: number = Date.now()): string {
    const nonce = randomBytes(16).toString('hex');
    this.#nonces.set(nonce, now + ttlMs);
    return nonce;
  }

  redeem(nonce: string, now: number = Date.now()): boolean {
    const expiry = this.#nonces.get(nonce);
    if (expiry === undefined) return false;
    this.#nonces.delete(nonce); // one-shot: spent OR expired, it is gone either way
    return now <= expiry;
  }
}

/** Constant-time comparison; length mismatch short-circuits (length is not secret here). */
function tokenEquals(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function headerValue(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * The per-request gate (spec §2): Host validated always, Origin validated
 * when the browser sends one (same-origin GETs may omit it; a PRESENT
 * mismatched Origin is always refused), token validated last. The server
 * binds 127.0.0.1 and the page is only ever opened on 127.0.0.1, so
 * `localhost` spellings are refused rather than aliased — an allowance for a
 * second spelling is a second thing to audit.
 */
export function validateApiRequest(
  req: { headers: Record<string, string | string[] | undefined> },
  expected: { token: string; port: number },
): { ok: true } | { ok: false; status: number; reason: string } {
  const wantHost = `127.0.0.1:${expected.port}`;
  const host = headerValue(req.headers.host);
  if (host !== wantHost) {
    return { ok: false, status: 403, reason: `Host ${JSON.stringify(host ?? '')} is not ${wantHost}` };
  }
  const origin = headerValue(req.headers.origin);
  if (origin !== undefined && origin !== `http://${wantHost}`) {
    return { ok: false, status: 403, reason: `Origin ${JSON.stringify(origin)} is not http://${wantHost}` };
  }
  const token = headerValue(req.headers[TOKEN_HEADER]);
  if (token === undefined) {
    return { ok: false, status: 401, reason: `missing ${TOKEN_HEADER} header` };
  }
  if (!tokenEquals(token, expected.token)) {
    return { ok: false, status: 403, reason: 'wrong token' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/security.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/security.ts test/ui/security.test.ts
git commit -m "feat(ui): token mint, one-shot nonce store and per-request validation"
```

---

## Task 3: `idle.ts` — the idle monitor

**Files:**
- Create: `src/ui/idle.ts`
- Test: `test/ui/idle.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `class IdleMonitor { constructor(idleMs: number, onIdle: () => void); touch(now?: number): void; expired(now?: number): boolean; start(): void; stop(): void }`. The server calls `touch()` for every **non-stream** `/api` request and never for anything else; plan 3's stream route is `kind: 'stream'` in the route table and the dispatch loop skips `touch()` for it — which is the whole §2 fix ("an open stream connection is explicitly not activity"). `IDLE_MS = 15 * 60_000` exported.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/idle.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdleMonitor, IDLE_MS } from '../../src/ui/idle.ts';

test('IDLE_MS is fifteen minutes — the number the spec fixes', () => {
  assert.equal(IDLE_MS, 15 * 60_000);
});

test('expired() is false inside the window and true past it, measured from the last touch', () => {
  const monitor = new IdleMonitor(1_000, () => {});
  monitor.touch(0);
  assert.equal(monitor.expired(999), false);
  assert.equal(monitor.expired(1_001), true);
  monitor.touch(1_000);
  assert.equal(monitor.expired(1_999), false);
  assert.equal(monitor.expired(2_001), true);
});

test('start() fires onIdle once real time passes with no touch, and stop() cancels', async () => {
  let fired = 0;
  const monitor = new IdleMonitor(50, () => { fired++; });
  monitor.touch();
  monitor.start();
  await new Promise((r) => setTimeout(r, 150));
  assert.equal(fired, 1);
  monitor.stop();
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/idle.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/idle.ts
/**
 * Ephemerality (spec §2): idle means NO non-stream /api request for fifteen
 * minutes. The caller decides what counts as activity — this class only
 * measures the gap since the last `touch()`. An open stream holding a
 * connection never calls `touch()`, so it cannot hold the server up; the
 * page's visibility-gated heartbeat (GET /api/ping, Task 16) is what keeps a
 * server alive exactly as long as a tab is actually visible.
 */
export const IDLE_MS = 15 * 60_000;

export class IdleMonitor {
  #idleMs: number;
  #onIdle: () => void;
  #lastTouch: number = Date.now();
  #timer: NodeJS.Timeout | null = null;

  constructor(idleMs: number, onIdle: () => void) {
    this.#idleMs = idleMs;
    this.#onIdle = onIdle;
  }

  touch(now: number = Date.now()): void {
    this.#lastTouch = now;
  }

  expired(now: number = Date.now()): boolean {
    return now - this.#lastTouch > this.#idleMs;
  }

  /**
   * Polls rather than re-arming a precise timeout on every touch: touches
   * arrive per request and a heartbeat arrives every minute, so a coarse
   * check every `idleMs / 10` (bounded below at 10ms so tests can use short
   * windows; production's 15-minute window polls every 90s) is exact enough —
   * the server exits within 10% past the idle window, never before it. The
   * timer is unref'd so it can never be the thing keeping the process alive.
   */
  start(): void {
    if (this.#timer) return;
    const interval = Math.max(10, Math.floor(this.#idleMs / 10));
    this.#timer = setInterval(() => {
      if (this.expired()) {
        this.stop();
        this.#onIdle();
      }
    }, interval);
    this.#timer.unref();
  }

  stop(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/idle.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/ui/idle.ts test/ui/idle.test.ts
git commit -m "feat(ui): idle monitor — non-stream requests only, 15-minute window"
```

---

## Task 4: `git-info.ts` — branch and commit from `.git` as files, worktree-safe

The status strip that renders this is **plan 3's** (§4 Watch). The reader is built and tested here because it is a pure read, because plan 3 must consume a tested interface rather than build one, and because the one way to get it wrong — assuming `.git` is a directory — breaks in the exact environment this repository is developed in (worktrees, where `.git` is a file containing `gitdir: …`).

**Files:**
- Create: `src/ui/git-info.ts`
- Test: `test/ui/git-info.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.
- Produces (plan 3 consumes this exactly):

```ts
export interface GitInfo {
  /** null when HEAD is detached. */
  branch: string | null;
  /** Full hex hash, or null when it cannot be resolved from files. */
  commit: string | null;
  /**
   * Spec §4 fixes the vocabulary: no ahead/behind counts, because those need
   * a revision walk and this reader only reads files.
   */
  upstream: 'in-sync' | 'differs' | 'no-upstream';
  detached: boolean;
}
export function readGitInfo(repoRoot: string): GitInfo | null; // null: not a git repo
```

Also exposed over HTTP in this plan as part of `GET /api/meta` (Task 13) so plan 3's strip is a pure rendering task.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/git-info.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { readGitInfo } from '../../src/ui/git-info.ts';

const HASH = 'a'.repeat(40);
const OTHER = 'b'.repeat(40);

function repo(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-git-'));
}

/** A normal repository: .git is a directory, the ref is loose. */
function normalRepo(root: string, opts: { upstreamHash?: string | null } = {}): void {
  const git = path.join(root, '.git');
  mkdirSync(path.join(git, 'refs', 'heads'), { recursive: true });
  writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(git, 'refs', 'heads', 'main'), `${HASH}\n`);
  if (opts.upstreamHash !== undefined && opts.upstreamHash !== null) {
    mkdirSync(path.join(git, 'refs', 'remotes', 'origin'), { recursive: true });
    writeFileSync(path.join(git, 'refs', 'remotes', 'origin', 'main'), `${opts.upstreamHash}\n`);
  }
}

test('a repository with a loose ref and a matching upstream: in-sync', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: HASH });
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { removeTree(root); }
});

test('an upstream at a different commit: differs', () => {
  const root = repo();
  try {
    normalRepo(root, { upstreamHash: OTHER });
    assert.equal(readGitInfo(root)?.upstream, 'differs');
  } finally { removeTree(root); }
});

test('no remote ref at all: no-upstream', () => {
  const root = repo();
  try {
    normalRepo(root);
    assert.equal(readGitInfo(root)?.upstream, 'no-upstream');
  } finally { removeTree(root); }
});

test('a packed ref resolves when the loose file is absent, for both branch and upstream', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(git, 'packed-refs'),
      '# pack-refs with: peeled fully-peeled sorted \n' +
      `${HASH} refs/heads/main\n` +
      `${HASH} refs/remotes/origin/main\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: 'main', commit: HASH, upstream: 'in-sync', detached: false,
    });
  } finally { removeTree(root); }
});

test('a WORKTREE: .git is a FILE containing gitdir, refs live in the commondir', () => {
  const root = repo();
  try {
    // Layout: <root>/main-repo/.git (real), <root>/wt (worktree checkout).
    const mainGit = path.join(root, 'main-repo', '.git');
    const wtGitDir = path.join(mainGit, 'worktrees', 'wt');
    mkdirSync(path.join(mainGit, 'refs', 'heads'), { recursive: true });
    mkdirSync(wtGitDir, { recursive: true });
    writeFileSync(path.join(mainGit, 'HEAD'), 'ref: refs/heads/main\n');
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'main'), `${OTHER}\n`);
    writeFileSync(path.join(mainGit, 'refs', 'heads', 'feature'), `${HASH}\n`);
    writeFileSync(path.join(wtGitDir, 'HEAD'), 'ref: refs/heads/feature\n');
    writeFileSync(path.join(wtGitDir, 'commondir'), '../..\n');

    const wt = path.join(root, 'wt');
    mkdirSync(wt, { recursive: true });
    writeFileSync(path.join(wt, '.git'), `gitdir: ${wtGitDir}\n`);

    assert.deepEqual(readGitInfo(wt), {
      branch: 'feature', commit: HASH, upstream: 'no-upstream', detached: false,
    });
  } finally { removeTree(root); }
});

test('a detached HEAD: branch null, the hash is the commit', () => {
  const root = repo();
  try {
    const git = path.join(root, '.git');
    mkdirSync(git, { recursive: true });
    writeFileSync(path.join(git, 'HEAD'), `${HASH}\n`);
    assert.deepEqual(readGitInfo(root), {
      branch: null, commit: HASH, upstream: 'no-upstream', detached: true,
    });
  } finally { removeTree(root); }
});

test('not a git repository: null, never a throw', () => {
  const root = repo();
  try {
    assert.equal(readGitInfo(root), null);
  } finally { removeTree(root); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/git-info.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/ui/git-info.ts
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Branch, commit and upstream state, read from `.git` AS FILES — no shell-out,
 * no `git` binary, no porcelain parsing (spec §4, Watch). The vocabulary is
 * deliberately three-valued: ahead/behind counts need a revision walk, which
 * is not a file read, so 'differs' is as precise as this reader can honestly be.
 *
 * `.git` itself is a DIRECTORY in a normal checkout and a FILE in a worktree
 * (`gitdir: <path>`, absolute or relative to the checkout root). In a
 * worktree the per-worktree gitdir holds HEAD, and a `commondir` file names
 * the shared .git (relative to the gitdir) where refs/ and packed-refs live.
 * This repository is developed in worktrees, so the file shape is the one
 * this function will meet first.
 */
export interface GitInfo {
  branch: string | null;
  commit: string | null;
  upstream: 'in-sync' | 'differs' | 'no-upstream';
  detached: boolean;
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The per-checkout git directory: `.git` as a directory, or resolved through `.git` the file. */
function resolveGitDir(repoRoot: string): string | null {
  const dotGit = path.join(repoRoot, '.git');
  let stats;
  try {
    stats = statSync(dotGit);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return dotGit;
  const content = readText(dotGit);
  const match = content?.match(/^gitdir:\s*(.+?)\s*$/m);
  if (!match) return null;
  return path.resolve(repoRoot, match[1]);
}

/** Where refs/ and packed-refs live: the gitdir itself, or the worktree's commondir. */
function resolveCommonDir(gitDir: string): string {
  const common = readText(path.join(gitDir, 'commondir'));
  if (common === null) return gitDir;
  return path.resolve(gitDir, common.trim());
}

const HASH_RE = /^[0-9a-f]{40,64}$/; // sha1 or sha256 repositories

/** A loose ref file, else the packed-refs line for `ref`, else null. */
function resolveRef(commonDir: string, ref: string): string | null {
  const loose = readText(path.join(commonDir, ...ref.split('/')));
  if (loose !== null) {
    const hash = loose.trim();
    return HASH_RE.test(hash) ? hash : null;
  }
  const packed = readText(path.join(commonDir, 'packed-refs'));
  if (packed === null) return null;
  for (const line of packed.split('\n')) {
    if (line.startsWith('#') || line.startsWith('^')) continue;
    const [hash, name] = line.trim().split(/\s+/);
    if (name === ref && hash !== undefined && HASH_RE.test(hash)) return hash;
  }
  return null;
}

export function readGitInfo(repoRoot: string): GitInfo | null {
  const gitDir = resolveGitDir(repoRoot);
  if (gitDir === null) return null;
  const head = readText(path.join(gitDir, 'HEAD'));
  if (head === null) return null;

  const refMatch = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/m);
  if (!refMatch) {
    const hash = head.trim();
    return {
      branch: null,
      commit: HASH_RE.test(hash) ? hash : null,
      upstream: 'no-upstream',
      detached: true,
    };
  }

  const branch = refMatch[1];
  const commonDir = resolveCommonDir(gitDir);
  const commit = resolveRef(commonDir, `refs/heads/${branch}`);
  // Spec §4 names the comparison target in its own words: "differs from
  // `origin/<branch>`". The remote name is fixed to `origin` because reading
  // the branch's real remote needs `.git/config` INI parsing — a fourth file
  // format for a decoration — and the strip's own label (plan 3) names
  // origin/<branch> explicitly, so what is compared is what is claimed.
  const upstreamTip = resolveRef(commonDir, `refs/remotes/origin/${branch}`);
  const upstream: GitInfo['upstream'] =
    upstreamTip === null ? 'no-upstream'
    : upstreamTip === commit ? 'in-sync'
    : 'differs';
  return { branch, commit, upstream, detached: false };
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/git-info.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Also run it against THIS repository by hand (a worktree), as a smoke check**

Run: `node -e "import('./src/ui/git-info.ts').then(m => console.log(m.readGitInfo(process.cwd())))"`
Expected: an object with the current branch name — not null, not a throw. (Not a committed test: it depends on the developer's checkout shape. The committed worktree test above is the pinned behaviour.)

- [ ] **Step 6: Commit**

```bash
git add src/ui/git-info.ts test/ui/git-info.test.ts
git commit -m "feat(ui): read branch/commit/upstream from .git as files, worktree-safe"
```

---

## Task 5: Export `itemCost` from `select.ts`

The budget simulator must show per-item cost. The cost rule is `itemCost` (`src/core/select.ts:122-124`), currently private. Spec §3's instruction for `isNormative` — "either call `injection()`, which already encapsulates it, or export it — but not both, and never neither" — is the governing logic: the UI must not copy the one-line body, so the function is exported.

**Checked against the mockup, 2026-08-20 — the two agree, and the mockup says so in its own body text.**
`data-p="simulate"`, beneath the admission staircase (`sim.stairn`): *"The per-item costs it needs are
`itemCost`, which is **private in `select.ts`** today: one export, and this chart is live."* The same
figure sizes every segment of the budget ribbon on `data-p="preview"` (`preview.ribbonn`: *"One segment
per admitted item, sized by its real `itemCost`"*). Two of the eighteen graphical views are blocked on
this one export, and both name it. **Nothing in this task changes.** It is recorded here because §0.3's
survey turned on it: `itemCost` is the single dependency that is already correctly planned, and a later
pass must not "simplify" it back to a copied one-liner.

**Files:**
- Modify: `src/core/select.ts:122` (add `export` to `itemCost`; update its comment)
- Test: extend `test/ui/read-model.test.ts`? No — this precedes read-model. Test: `test/core/select-itemcost.test.ts`

**Interfaces:**
- Consumes: existing `estimateTokens`, `renderItemBlock`.
- Produces: `itemCost(item: Item): number` — exported from `src/core/select.ts`. The number is the exact figure `select()` budgets with (rendered block + separator), so a UI bar built from it can never disagree with the selector.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/select-itemcost.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemCost, estimateTokens, select } from '../../src/core/select.ts';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'RULE-example', type: 'rule', title: 'Example', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'Body text.', observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-example.md',
    ...overrides,
  };
}

test('itemCost is the rendered block plus the block separator — the figure select budgets with', () => {
  const i = item();
  assert.equal(itemCost(i), estimateTokens(renderItemBlock(i)) + estimateTokens('\n\n'));
});

test('an item spills exactly when itemCost says it cannot fit', () => {
  const i = item({ always: true });
  const config = resolveConfig({ budgets: { pinned: itemCost(i) - 1 } });
  const sel = select([i], { event: 'session-start' }, config);
  assert.equal(sel.full.length, 0);
  assert.equal(sel.spilled.some((s) => s.id === i.id), true);

  const roomy = resolveConfig({ budgets: { pinned: itemCost(i) } });
  const sel2 = select([i], { event: 'session-start' }, roomy);
  assert.equal(sel2.full.length, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/select-itemcost.test.ts`
Expected: FAIL — `itemCost` is not exported.

- [ ] **Step 3: Implement — the whole diff**

In `src/core/select.ts`, change line 122's `function itemCost(` to `export function itemCost(` and extend the comment above it with one sentence: `Exported for the UI's budget simulator (web-ui plan 1), which must show the same per-item figure select budgets with rather than re-deriving one.`

- [ ] **Step 4: Run the test and the full suite**

Run: `node --test test/core/select-itemcost.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, suite green, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select-itemcost.test.ts
git commit -m "feat(select): export itemCost so the UI cannot re-derive the cost rule"
```

---

## Task 6: Extract read-only revision-log reading into `src/core/revision-log.ts`

**Why (read this before objecting to the refactor):** the status screen must show the pending-revisions line (spec §4, *Report*). Its count lives behind `readLog`/`foldLog` in `src/core/revision.ts` — and `revision.ts` imports `updateItem` from `mutate.ts` at runtime (`src/core/revision.ts:7`), so any server module importing anything from `revision.ts` loads `mutate.ts` into the server process. **Since the 2026-08-20 scope ruling (§0.5) that is a design rule this plan keeps, not something Task 14's test catches:** a `src/ui/` module importing `readLog` from `revision.ts` resolves through the re-export chain to `revision-log.ts`, a reader, and passes — the ban is about binding a writer, not about which file a read was spelled from. The rule stands on its own merits, and this task is the reason it can be followed. The read half moves to a module with no mutating import; `revision.ts` imports it back so every existing caller is untouched. Plan 2's review-queue screen consumes this module too (and anything it needs beyond counts — decorated revisions, staleness — is plan 2's problem to solve on this same boundary, stated here so plan 2 does not import `revision.ts` from the server either).

**Files:**
- Create: `src/core/revision-log.ts`
- Modify: `src/core/revision.ts` (delete the moved code; import it from the new module; keep re-exports)
- Test: `test/core/revision-log.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path` (whatever the moved code already used — nothing else).
- Produces (server and plan 2 import from `src/core/revision-log.ts`; existing callers keep importing from `revision.ts`, which re-exports):
  - `REVISION_PROTOCOL: string`
  - `revisionDir(root: string): string`, `revisionLogPath(root: string): string`
  - `readLog(root: string): LogLine[]` — exactly the shipped behaviour, now at `revision-log.ts:116-144`: ENOENT → `[]`, unreadable → throw, damaged non-final line → throw, torn final line tolerated.
  - `foldLog(lines: LogLine[])` — moved as-is, exported.
  - `pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[]` — new thin composition: `foldLog(readLog(root))` filtered to `state === 'pending'` (the same filter `pendingRevisions` applies at `revision.ts:490-492`), WITHOUT the store-touching decoration.
  - `pendingRevisionCounts(revs: { itemId: string }[]): { revisions: number; items: number }` — moved; parameter widened from `PendingRevision[]` to the two fields it actually reads (`revision-log.ts:221-225`), so undecorated summaries and decorated revisions both satisfy it.

- [ ] **Step 1: Establish the move set by executing, then write the failing test**

The exact helper set `foldLog` needs was not enumerated when this plan was written. Establish it: open `src/core/revision.ts`, find `foldLog`, and list every function/constant/type it and `readLog` reference that is not already in the move list (`REVISION_PROTOCOL`, `LogLine`, `revisionDir`, `revisionLogPath`). **`lastRowIndex` is not in that list and must not be put back in it:** it left `revision.ts` in Phase 5, when the append-only JSONL mechanics were extracted into `src/core/jsonl-log.ts` (`core/jsonl-log.ts` · `function lastRowIndex(rows: string[]): number {` · ~183), where it is **private** — `revision.ts` reaches the log through `readJsonlFile`, not through it. A move list that names a symbol which is no longer in the file it is being moved out of is this plan's own §0 defect: it names the code that answered the question when the plan was written, not the code today. Anything in that closure that touches `mutate.ts`, the `Store`, or the filesystem beyond reading the log stays behind — if such a dependency exists, split at the boundary above it and record what stayed in the module docstring. Then write:

```ts
// test/core/revision-log.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  pendingRevisionSummaries, pendingRevisionCounts, revisionLogPath,
} from '../../src/core/revision-log.ts';

test('revision-log.ts imports nothing from mutate.ts or revision.ts — the reason it exists', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', 'revision-log.ts'), 'utf8');
  assert.doesNotMatch(source, /from '\.\/mutate\.ts'/);
  assert.doesNotMatch(source, /from '\.\/revision\.ts'/);
});

test('an absent log means no pending revisions; a staged line means one; a discard settles it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-revlog-'));
  try {
    assert.deepEqual(pendingRevisionSummaries(root), []);

    // Write log lines in the shipped shape. Establish the exact line shape by
    // reading `appendLine` and `stageRevision`'s appended record in
    // revision.ts during implementation, and use THAT shape here — the test
    // must stage through the same serialization the product writes. If the
    // shape cannot be reproduced by hand safely, stage through the real
    // `stageRevision` in a scratch workspace instead and copy the log file.
    mkdirSync(path.dirname(revisionLogPath(root)), { recursive: true });
    // <lines written per the establish-by-executing note above>
    // After one staged revision on item RULE-x:
    //   assert.equal(pendingRevisionSummaries(root).length, 1);
    // After appending its discard line:
    //   assert.deepEqual(pendingRevisionSummaries(root), []);
  } finally {
    removeTree(root);
  }
});

test('pendingRevisionCounts counts revisions and distinct items', () => {
  assert.deepEqual(
    pendingRevisionCounts([{ itemId: 'A' }, { itemId: 'A' }, { itemId: 'B' }]),
    { revisions: 3, items: 2 },
  );
});
```

The second test's commented assertions are not placeholders to skip — they are the assertions to write once the line shape has been read out of `stageRevision`; the test is not done until both fire against real serialized lines.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/revision-log.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Move the code**

Create `src/core/revision-log.ts` with a module docstring:

```ts
// src/core/revision-log.ts
/**
 * Read-only access to the staged-revision log — extracted from revision.ts
 * (web-ui plan 1, Task 6) so that a read-only surface can count and list
 * pending revisions WITHOUT importing revision.ts, which imports updateItem
 * from mutate.ts at runtime. The UI server's no-writes test (test/ui/
 * no-writes.test.ts) bans write SYMBOLS from modules under src/ui/, resolved
 * through re-export chains, so a src/ui/ module binding updateItem — however
 * it is spelled — is a failure. Reading the queue through revision.ts would
 * still drag mutate.ts into a read-only process, which is the rule this
 * module exists to make followable.
 *
 * Everything here is moved verbatim from revision.ts; behaviour changes are
 * none, and revision.ts re-imports these symbols so its callers are untouched.
 */
```

Then: cut `REVISION_PROTOCOL`, the `LogLine` type, `revisionDir`, `revisionLogPath`, `readLog`, `foldLog` (plus the closure established in Step 1) and `pendingRevisionCounts` out of `revision.ts` and paste them here unchanged, except:

- `pendingRevisionCounts(revs: PendingRevision[])` becomes `pendingRevisionCounts(revs: { itemId: string }[])` — same body.
- Add the new composition:

```ts
/** The pending queue as (revisionId, itemId) — no store, no staleness decoration. */
export function pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[] {
  return foldLog(readLog(root))
    .filter((r) => r.state === 'pending')
    .map((r) => ({ revisionId: r.revisionId, itemId: r.itemId }));
}
```

In `src/core/revision.ts`, replace the moved definitions with:

```ts
import {
  foldLog, pendingRevisionCounts, readLog, revisionDir, revisionLogPath,
  REVISION_PROTOCOL, type LogLine,
} from './revision-log.ts';
export {
  foldLog, pendingRevisionCounts, readLog, revisionDir, revisionLogPath, REVISION_PROTOCOL,
};
export type { LogLine };
```

(Adjust the exact import/export list to the closure Step 1 established; every symbol previously exported from `revision.ts` must still be importable from `revision.ts` — `git grep -n "from './revision.ts'"` and `from '../../core/revision.ts'` enumerate the callers to hold harmless.)

- [ ] **Step 4: Run the new test and the whole suite**

Run: `node --test test/core/revision-log.test.ts && npm test && npx tsc --noEmit`
Expected: all green. The full suite is the proof the move changed nothing.

- [ ] **Step 5: Commit**

```bash
git add src/core/revision-log.ts src/core/revision.ts test/core/revision-log.test.ts
git commit -m "refactor(revision): extract read-only log reading so a no-writes surface can count the queue"
```

---

## Task 7: Ledger read additions — `history()` and `sessionSummaries()`

The audit stream and the provenance surfaces need the raw per-`(session_id, item_id, tier)` injection
stream the ledger holds, and the session picker needs "each session's last injection time" (spec §3).
Neither read exists (`ledger.ts` has per-session `entries()` and id-only `recentSessions()`); both are
pure reads added beside the existing ones.

**What `history()` is not — OWNER RULING, and the mockup says it twice.** The spec's *"injections per
item over time is a real series"* (§4) was read as making `history()` the decay chart's data. **It is
not.** The mockup is the UI specification (§0.2) and it rules the ledger out for that view in two
places, in its own body text:

- the decay screen's subtitle, `dec.sub` (`docs/design/web-ui-mockup.html`, `data-p="decay"` · `data-t="dec.sub"`, ≈983 — `verify:citations` does not resolve `.html`, so this is a pointer to check by opening the file, not a checked citation): *"The unit is **sessions**, not weeks: the ledger holds one row per (session, item, tier) and a repeat injection inside one session collides, so what it stores is **a set of first-injections, not an event stream** — and an axis against a clock would be wrong here even where it would look better. The delivery history in the second card is a different measurement from a different source."*
- the *"90-day delivery, per item"* card's note, `dec.heatn` (`docs/design/web-ui-mockup.html`, `data-p="decay"` · `data-t="dec.heatn"`, ≈1008 — same, a pointer rather than a checked citation): *"Its source is **not** the ledger, which records deliveries only: it is `audit_item.role` joined to `audit.at`, both indexed, with the `since` / `until` filters that already ship."*

**The ruling: the method stays exactly as specified below; only its stated purpose changes.**
`history()` is the raw per-`(session, item, tier)` stream, and what it feeds is the **audit stream and
the provenance surfaces**. Nothing in this task's signatures, ordering contract or tests moves. The one
decay view this plan can serve from it is the recency comb's per-item last injection (§0.3 row 7), and
that is one derived figure — not "the decay chart's raw data". The 90-day heatstrip and the per-item
sparkline stay unserved for the reason §0.3 rows 8 and 9 already record.

**Files:**
- Modify: `src/core/ledger.ts` (two new methods on `Ledger`, two new interfaces)
- Test: `test/core/ledger-reads.test.ts`

**Interfaces:**
- Consumes: the existing `Ledger` and its schema (`ledger.ts:43-64`).
- Produces:
  - `interface InjectionEvent { sessionId: string; itemId: string; tier: LedgerTier; injectedAt: string }` (exported from `ledger.ts`)
  - `Ledger.history(): InjectionEvent[]` — every row, ordered `injected_at, session_id, item_id` (total and repeatable).
  - `interface SessionSummary { sessionId: string; lastInjectedAt: string; itemCount: number }`
  - `Ledger.sessionSummaries(limit: number): SessionSummary[]` — same ordering contract as `recentSessions` (`MAX(injected_at) DESC, session_id DESC`, `ledger.ts:285-300`), so `sessionSummaries(n).map(s => s.sessionId)` equals `recentSessions(n)` — asserted, so the picker and the default can never disagree.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/ledger-reads.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';

function open(): { ledger: Ledger; dir: string; close: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ledger-'));
  const dbPath = path.join(dir, '.index.db');
  const store = Store.open(dbPath); // Ledger.open relies on Store.open first (ledger.ts:74-88)
  const ledger = Ledger.open(dbPath);
  return { ledger, dir, close: () => { ledger.close(); store.close(); } };
}

test('history() returns every row in a total, repeatable order', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    assert.deepEqual(ledger.history(), [
      { sessionId: 's1', itemId: 'RULE-a', tier: 'pinned', injectedAt: '2026-08-01T10:00:00.000Z' },
      { sessionId: 's1', itemId: 'RULE-b', tier: 'jit', injectedAt: '2026-08-01T11:00:00.000Z' },
      { sessionId: 's2', itemId: 'RULE-a', tier: 'jit', injectedAt: '2026-08-02T10:00:00.000Z' },
    ]);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries agrees with recentSessions on order, and carries last time and item count', () => {
  const { ledger, dir, close } = open();
  try {
    ledger.record('s1', 'RULE-a', 'pinned', '2026-08-01T10:00:00.000Z');
    ledger.record('s1', 'RULE-b', 'jit', '2026-08-01T11:00:00.000Z');
    ledger.record('s2', 'RULE-a', 'jit', '2026-08-02T10:00:00.000Z');
    const summaries = ledger.sessionSummaries(20);
    assert.deepEqual(summaries.map((s) => s.sessionId), ledger.recentSessions(20));
    assert.deepEqual(summaries, [
      { sessionId: 's2', lastInjectedAt: '2026-08-02T10:00:00.000Z', itemCount: 1 },
      { sessionId: 's1', lastInjectedAt: '2026-08-01T11:00:00.000Z', itemCount: 2 },
    ]);
  } finally { close(); removeTree(dir); }
});

test('sessionSummaries(0) and an empty ledger both answer []', () => {
  const { ledger, dir, close } = open();
  try {
    assert.deepEqual(ledger.sessionSummaries(0), []);
    assert.deepEqual(ledger.sessionSummaries(5), []);
    assert.deepEqual(ledger.history(), []);
  } finally { close(); removeTree(dir); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/ledger-reads.test.ts`
Expected: FAIL — `ledger.history is not a function`.

- [ ] **Step 3: Implement — added to `ledger.ts` beside the existing reads**

Top-level, beside `LedgerEntry`:

```ts
export interface InjectionEvent {
  sessionId: string;
  itemId: string;
  tier: LedgerTier;
  injectedAt: string;
}

export interface SessionSummary {
  sessionId: string;
  lastInjectedAt: string;
  itemCount: number;
}
```

On the `Ledger` class, beside `recentSessions` (`:290`):

```ts
  /**
   * Every recorded injection, ordered (injected_at, session_id, item_id) so
   * the series is total and repeatable across runs. Nothing is filtered,
   * capped or aggregated.
   *
   * This is the raw per-(session, item, tier) injection stream, and it feeds
   * the AUDIT STREAM and the PROVENANCE surfaces. It is NOT the decay chart's
   * raw data: the mockup rules the ledger out for that view by name, because
   * `injected_at` is a value and not part of the key (see `LEDGER_SCHEMA`), so
   * a repeat injection inside one (session, item, tier) COLLIDES — what comes
   * back is the set of first-injections, not an event stream. That is also why
   * the decay screen's unit is sessions rather than weeks.
   *
   * The other caveat every consumer inherits, likewise a property of the table
   * and not of this query: the ledger records INJECTION, not reading or
   * reliance.
   */
  history(): InjectionEvent[] {
    const rows = this.#db.prepare(`
      SELECT session_id, item_id, tier, injected_at
      FROM ledger
      ORDER BY injected_at, session_id, item_id
    `).all() as { session_id: string; item_id: string; tier: string; injected_at: string }[];
    return rows.map((r) => ({
      sessionId: r.session_id, itemId: r.item_id,
      tier: r.tier as LedgerTier, injectedAt: r.injected_at,
    }));
  }

  /**
   * `recentSessions`, with the two fields the UI's session picker shows.
   * SAME ordering clause as recentSessions — the test pins the agreement,
   * so the picker's list and the default session can never disagree.
   */
  sessionSummaries(limit: number): SessionSummary[] {
    if (limit <= 0) return [];
    const rows = this.#db.prepare(`
      SELECT session_id, MAX(injected_at) AS last, COUNT(DISTINCT item_id) AS n
      FROM ledger
      GROUP BY session_id
      ORDER BY MAX(injected_at) DESC, session_id DESC
      LIMIT ?
    `).all(limit) as { session_id: string; last: string; n: number }[];
    return rows.map((r) => ({
      sessionId: r.session_id, lastInjectedAt: r.last, itemCount: Number(r.n),
    }));
  }
```

- [ ] **Step 4: Run the test and the full suite**

Run: `node --test test/core/ledger-reads.test.ts && npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/ledger-reads.test.ts
git commit -m "feat(ledger): history() and sessionSummaries() read methods for the UI"
```

---

## Task 8: `routes.ts`, and the select/render/simulate read model

**Files:**
- Create: `src/ui/routes.ts`
- Create: `src/ui/read-model.ts`
- Test: `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `select`, `itemCost` (Task 5), `renderSelection`, `Store`, `Ledger`, `Workspace`.
- Produces — **the route extension surface plans 2 and 3 build against**:

```ts
// src/ui/routes.ts
export interface ApiContext {
  ws: Workspace;
  repoRoot: string;
  url: URL;                          // parsed request URL
  params: Record<string, string>;    // :name segments from the route path
  body: unknown;                     // parsed JSON body on POST, else undefined
}
export interface JsonResult { status: number; body: unknown }
export type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };
export function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void;
export function matchRoute(method: string, pathname: string):
  { handler: RouteHandler; params: Record<string, string> } | null;
```

Notes fixed here, binding on all three plans: a `path` is literal segments plus `:name` parameters (`/api/item/:id`); registering a duplicate `(method, path)` throws (nothing is silently replaced); **`kind: 'stream'` exists for plan 3's audit stream and is deliberately unused in this plan** — the server dispatch (Task 13) skips the idle `touch()` for stream routes, which is how §2's "an open stream is not activity" is implemented before the stream exists; **every handler, theirs included, sits behind the Task 2 security gate — registering a route can never bypass it.**

- Produces — read-model functions (each pure of HTTP, testable directly):

```ts
// src/ui/read-model.ts
export function apiSelect(ws: Workspace, url: URL): JsonResult;    // GET /api/select
export function apiRender(ws: Workspace, url: URL): JsonResult;    // GET /api/render
export function apiSimulate(ws: Workspace, url: URL): JsonResult;  // GET /api/simulate
```

Query grammar (shared by the three, refused loudly on violation):
- `event` required: `session-start | compact | tool | manual`.
- `path` required iff `event=tool` (select ignores it otherwise — accepting it there would be accepted-and-ignored).
- exactly one of `session=<id>` or `cold=1`. `session` → `seen: seenIds(readSeen(ws.projectRoot, session))` exactly as the hook does (`hooks/pre-tool-use.ts` · `const seenState = readSeen(ws.projectRoot, dedupeKey);` · ~183). **NOT `ledger.seen(session)`** — §0 records why: the Ledger left that path entirely, and what remains is a replayed projection nothing in the UI updates. An unreadable seen file is a **disclosed** state, never an empty one.
- `focus`: the endpoint reads `readFocus(ws.projectRoot).focus` and passes it, and the response carries `Selection.focus`. `focus=off` passes `null` and is labelled as a different question, exactly as `cold=1` is. **Omitting it previews a different selection and a different spill set** — §0's first row.
- `cold=1` → no `seen`, and it is the caller's job to label it (the strings table already carries `session.cold`).
- `restore=<comma-separated ids>` allowed iff `event=compact` (spec §3: "`compact` additionally takes `restore`").
- `/api/simulate` additionally accepts `pinned`, `jit`, `restored`, `index` (non-negative integers) overriding `config.budgets`.
- any other parameter → `400` naming the parameter (INV-nothing-is-dropped-silently).

Response shapes:
- `/api/select` → the JSON serialization of `select(store.all(), ctx, config)` and **nothing else** — the §6 parity test depends on it. (`store.all()` rather than `activeInjectable`: the prefilter is a perf superset, documented at `select.ts:96-100`; `select` applies the real rules itself, and the index summary needs the unfiltered set.)
- `/api/render` → `{ text: renderSelection(selection) }` — the literal bytes a hook would inject.
- `/api/simulate` → `{ selection, budgets, costs, tiersRun }` where `costs: { id: string; tokens: number }[]` has one entry per id in `selection.full` ∪ `selection.spilled`, each `itemCost(item)` (Task 5), and `tiersRun: ('pinned' | 'jit' | 'restored' | 'index')[]` names the tiers this event actually reached.

**`tiersRun`, and why it is a field rather than a client-side rule** (§0.3 row 3). The budget ribbon on
`data-p="preview"` draws four tracks and distinguishes two states this response otherwise conflates:
*"A tier this event never reaches is drawn as **absent**, hatched and named; an empty track would claim
it ran and delivered nothing, which is a different fact"* (`preview.ribbonn`). Which tiers run is
decided by `ctx.event` inside `select()` — `pinned` on `session-start`/`compact`/`manual`, `restored`
only on `compact`, `jit` only on `tool` with a path, the bounded index only on non-`tool` — so a browser
that derives it re-implements the selector's dispatch, which is the defect Task 5 exists to prevent.
It goes on `/api/simulate` and **not** on `/api/select`, because Design decision 7 pins `/api/select` to
`select()`'s serialization and nothing else.

**Two things about `selection.spilled` that the ribbon makes load-bearing.** (a) **Its array order is
the order the selector considered each item**, tier by tier, and the ghost lane draws each spill *"in
the position the selector considered it"*. **The client must never re-sort it**; a plan-2 or plan-3
screen that sorts spills by size or id is drawing a different algorithm. (b) `Spill.tier` includes
`'index'` while `SelectionEntry.tier` does not, so the index track's admitted content is
`selection.index.normative` — **lines, not items** — and `costs` therefore sizes three of the four
tracks. Per-line index costs are **not exposed by any endpoint here**; recorded as a gap in §0.3, not
designed.

**Not served by these three endpoints, and named so no implementer improvises it:** the preview
screen's gate ladder (`data-p="preview"` · `#gates` · `preview.whyn`) needs the six gates in
`select()`'s own order with a stable code each and a passed / binds / not-reached state. `Selection`
carries `Spill.reason` — an English string, and only for the budget gate — and `injection()` returns
prose for two more. See §0.3 row 17. **Do not synthesise the ladder from the strings.**

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/read-model.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { select } from '../../src/core/select.ts';
import { apiSelect, apiRender, apiSimulate } from '../../src/ui/read-model.ts';
import { registerRoute, matchRoute } from '../../src/ui/routes.ts';

/** A real workspace with real items, built through the real CLI. */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.'], dir, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned body.'], dir, () => {});
  runCli(['add', 'decision', 'We chose sqlite', '--body', 'Rationale body.'], dir, () => {});
  return { dir, done: () => removeTree(dir) };
}

function url(qs: string): URL {
  return new URL(`http://127.0.0.1:1/api/select?${qs}`);
}

test('/api/select equals select() as JSON, for a matrix of events, paths and seen sets', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const items = store.all();

    const matrix: { qs: string; ctx: Parameters<typeof select>[1] }[] = [
      { qs: 'event=session-start&cold=1', ctx: { event: 'session-start' } },
      { qs: 'event=manual&cold=1', ctx: { event: 'manual' } },
      { qs: 'event=tool&path=src/a.ts&cold=1', ctx: { event: 'tool', path: 'src/a.ts' } },
    ];
    for (const { qs, ctx } of matrix) {
      const result = apiSelect(ws, url(qs));
      assert.equal(result.status, 200, qs);
      assert.deepEqual(
        JSON.parse(JSON.stringify(result.body)),
        JSON.parse(JSON.stringify(select(items, ctx, ws.config))),
        qs,
      );
    }

    // The seen case, via a real seen-file append — the endpoint must pass
    // seenIds(readSeen(root, key)) exactly as the hook does. A ledger row would
    // NOT do: the Ledger is a replayed projection and is not what the hook reads.
    const ruleId = items.find((i) => i.title === 'Always use POSIX paths')!.id;
    ledger.record('sess-1', ruleId, 'jit');
    const seenResult = apiSelect(ws, url('event=tool&path=src/a.ts&session=sess-1'));
    assert.deepEqual(
      JSON.parse(JSON.stringify(seenResult.body)),
      JSON.parse(JSON.stringify(
        select(items, { event: 'tool', path: 'src/a.ts',
                        seen: seenIds(readSeen(ws.projectRoot, 'sess-1')),
                        focus: readFocus(ws.projectRoot).focus }, ws.config),
      )),
    );
    // And it differs from the cold answer — the correction §3 exists for.
    assert.notDeepEqual(
      JSON.parse(JSON.stringify(seenResult.body)),
      JSON.parse(JSON.stringify(apiSelect(ws, url('event=tool&path=src/a.ts&cold=1')).body)),
    );

    ledger.close();
    store.close();
  } finally { done(); }
});

test('unknown, missing and contradictory parameters are refused, never dropped', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    for (const bad of [
      'event=tool&path=x&cold=1&sesion=typo',       // unknown param
      'event=nope&cold=1',                           // bad event
      'event=tool&cold=1',                           // tool without path
      'event=session-start&path=x&cold=1',           // path outside tool
      'event=session-start',                         // neither session nor cold
      'event=session-start&session=s&cold=1',        // both
      'event=tool&path=x&cold=1&restore=RULE-a',     // restore outside compact
    ]) {
      const result = apiSelect(ws, url(bad));
      assert.equal(result.status, 400, bad);
      assert.ok(typeof (result.body as { error?: string }).error === 'string', bad);
    }
  } finally { done(); }
});

test('/api/render returns the rendered selection text', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiRender(ws, new URL('http://x/api/render?event=session-start&cold=1'));
    assert.equal(result.status, 200);
    const text = (result.body as { text: string }).text;
    assert.match(text, /Pin me/); // the pinned rule's block is in the injected text
  } finally { done(); }
});

test('/api/simulate applies budget overrides and prices every full and spilled id', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const tight = apiSimulate(ws, new URL('http://x/api/simulate?event=session-start&cold=1&pinned=1'));
    assert.equal(tight.status, 200);
    const body = tight.body as {
      selection: { full: unknown[]; spilled: { id: string }[] };
      budgets: { pinned: number };
      costs: { id: string; tokens: number }[];
    };
    assert.equal(body.budgets.pinned, 1);
    assert.equal(body.selection.full.length, 0); // nothing fits a 1-token pinned budget
    assert.ok(body.selection.spilled.length >= 1);
    const priced = new Set(body.costs.map((c) => c.id));
    for (const s of body.selection.spilled) assert.ok(priced.has(s.id));
    for (const c of body.costs) assert.ok(Number.isInteger(c.tokens) && c.tokens > 0);
  } finally { done(); }
});

test('registerRoute refuses a duplicate and matchRoute extracts :params', () => {
  registerRoute('GET', '/api/test-dup/:id', { kind: 'json', handle: () => ({ status: 200, body: {} }) });
  assert.throws(() =>
    registerRoute('GET', '/api/test-dup/:id', { kind: 'json', handle: () => ({ status: 200, body: {} }) }));
  const match = matchRoute('GET', '/api/test-dup/RULE-x');
  assert.ok(match);
  assert.deepEqual(match?.params, { id: 'RULE-x' });
  assert.equal(matchRoute('POST', '/api/test-dup/RULE-x'), null);
});
```

Non-vacuity note on the seen-differs assertion: if, when run, the seen body does NOT differ from the cold body (budgets roomy enough that removing the seen item changes `full` without changing `spilled`, and `full` differs anyway — then it does differ; the only way they can coincide is an empty selection both ways), the fixture is too thin: add a fourth `runCli(['add', 'rule', …, '--scope', 'src/**'])` item with a long body so the seen set demonstrably changes the outcome. The committed test must contain a passing, non-vacuous inequality — verify by commenting out the `ledger.record` line and watching `notDeepEqual` fail, then restore it.

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `routes.ts`**

```ts
// src/ui/routes.ts
import type { ServerResponse } from 'node:http';
import type { Workspace } from '../core/workspace.ts';

/**
 * The route table — the ONE extension point. Plans 2 and 3 add routes by
 * calling registerRoute from their own modules (imported by server.ts); they
 * never touch the dispatch loop, and NOTHING a route registers can bypass
 * the security gate, which runs before dispatch (server.ts).
 *
 * `kind: 'stream'` exists for plan 3's audit stream. This plan registers no
 * stream route; the dispatch loop already treats stream routes as NOT
 * activity for the idle monitor (spec §2: an open stream never resets the
 * timer), so plan 3 inherits the ephemerality rule instead of remembering it.
 */
export interface ApiContext {
  ws: Workspace;
  repoRoot: string;
  url: URL;
  params: Record<string, string>;
  body: unknown;
}

export interface JsonResult { status: number; body: unknown }

export type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };

interface Route { method: string; segments: string[]; handler: RouteHandler }

const routes: Route[] = [];

export function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void {
  const segments = path.split('/').filter((s) => s !== '');
  const duplicate = routes.some((r) =>
    r.method === method && r.segments.length === segments.length &&
    r.segments.every((s, i) => s === segments[i]));
  if (duplicate) {
    throw new Error(`mycontext ui: route ${method} ${path} is already registered.`);
  }
  routes.push({ method, segments, handler });
}

export function matchRoute(method: string, pathname: string):
  { handler: RouteHandler; params: Record<string, string> } | null {
  const parts = pathname.split('/').filter((s) => s !== '');
  for (const route of routes) {
    if (route.method !== method || route.segments.length !== parts.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const seg = route.segments[i];
      if (seg.startsWith(':')) params[seg.slice(1)] = decodeURIComponent(parts[i]);
      else if (seg !== parts[i]) { ok = false; break; }
    }
    if (ok) return { handler: route.handler, params };
  }
  return null;
}
```

- [ ] **Step 4: Implement the shared plumbing and the three handlers in `read-model.ts`**

```ts
// src/ui/read-model.ts
import { Ledger, LedgerUninitializedError } from '../core/ledger.ts';
import { renderSelection } from '../core/render.ts';
import {
  itemCost, select, type SelectContext, type SelectEvent, type Selection,
} from '../core/select.ts';
import { Store } from '../core/store.ts';
import type { Config } from '../core/config.ts';
import type { Item } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import type { JsonResult } from './routes.ts';

/**
 * Every /api read handler, as a pure function of (workspace, url) — no HTTP
 * types, so each is testable by calling it. Composition only: the rules are
 * select, matchesScope, isEligible, injection, scopePolicyFor, estimateTokens,
 * Ledger reads (spec §3's table). An endpoint here MAY NOT reimplement one.
 *
 * The server never rebuilds: the hook reads the store as-is
 * (pre-tool-use.ts:129-138), and "see exactly what Claude gets" means reading
 * exactly what the hook reads. Staleness is doctor's index_stale finding,
 * surfaced by the status screen — never silently repaired here.
 */

export const badRequest = (error: string): JsonResult => ({ status: 400, body: { error } });

/** Refuse any query parameter this endpoint does not act on. */
export function unknownParams(url: URL, allowed: string[]): string | null {
  for (const key of url.searchParams.keys()) {
    if (!allowed.includes(key)) {
      return `unknown parameter "${key}" — this endpoint accepts: ${allowed.join(', ')}. ` +
        'A parameter accepted and ignored would silently answer a different question.';
    }
  }
  return null;
}

/**
 * **Both handles read-only, and both checked.** `Store.openReadOnlyChecked`
 * per §0 — and `Ledger.openReadOnlyChecked`
 * (`core/ledger.ts` · `static openReadOnlyChecked(dbPath: string): Ledger {` · ~222),
 * which had to be built before §0's row could be satisfied at all. `Ledger`
 * used to have exactly one open and it was writable: `Ledger.open` execs
 * `LEDGER_SCHEMA` on every call
 * (`core/ledger.ts` · `db.exec(LEDGER_SCHEMA);` · ~126), so opening a `Ledger`
 * the old way IS a schema write, and swapping only the `Store` call here would
 * have left this function handing out a writable ledger connection creating
 * tables in a database the read path never prepared — worse than before, not
 * better.
 *
 * **`Ledger.open`'s "`Store.open` must have run first" prerequisite no longer
 * applies, and NEITHER HALF of it does.** It existed only to make a WRITABLE
 * ledger safe: `Store.open`'s corruption self-heal had to have
 * deleted-and-recreated a corrupt file first, because `Ledger.open` has no
 * self-heal of its own; and `Store.open` had to have set `journal_mode = WAL`
 * first, because `Ledger.open` CREATES a missing database and would create it
 * in rollback-journal mode. A read-only open can commit neither error — it
 * cannot create a database at all (an absent path throws `SQLITE_CANTOPEN`),
 * so there is no journal mode to get wrong, and throwing on a corrupt file is
 * the CORRECT answer for a read path rather than something to heal. The Store
 * is still opened first, but only because its `schema_version` check is what
 * says this file is a my_context index at all; nothing about the ledger open
 * depends on it any more.
 *
 * **`ledger` is `Ledger | null`, and the null is a STATE, not a failure.** A
 * corpus no hook has ever injected into has `schema_version` and `items` but
 * no `ledger`/`ledger_source` tables at all — those are created by
 * `Ledger.open`, a write nothing has performed. Refusing to serve the UI
 * against a fresh corpus would be wrong, so `Ledger.openReadOnlyChecked`
 * marks that one state with its own class, `LedgerUninitializedError`, and
 * only that class is swallowed here. A corrupt file, a truncated one, half a
 * ledger, or a table shape this build does not read all propagate —
 * `INV-nothing-is-dropped-silently` cuts both ways, and reporting damage as an
 * empty ledger is the same failure as refusing a fresh corpus.
 *
 * **OPEN QUESTION for the owner, recorded here rather than decided:** what
 * each screen renders when `ledger` is null — an empty chart, an explicit
 * "nothing has been injected in this corpus yet" state, or a per-screen
 * mixture. Every caller below that USES the ledger argument inherits it. That
 * is a product decision about ten screens, not a property of the open, and
 * this function does not settle it.
 */
export function withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T {
  const store = Store.openReadOnlyChecked(ws.dbPath);
  let ledger: Ledger | null = null;
  try {
    try {
      ledger = Ledger.openReadOnlyChecked(ws.dbPath);
    } catch (err) {
      // The never-injected empty state, and only it. Everything else is a
      // fault and must reach the caller.
      if (!(err instanceof LedgerUninitializedError)) throw err;
    }
    return fn(store, ledger);
  } finally {
    try { ledger?.close(); } catch { /* already closed */ }
    try { store.close(); } catch { /* already closed */ }
  }
}

const SELECT_EVENTS: SelectEvent[] = ['session-start', 'compact', 'tool', 'manual'];

/** The shared grammar of /api/select, /api/render and /api/simulate. */
function parseSelectQuery(
  ws: Workspace, url: URL, extraAllowed: string[] = [],
): { ctx: SelectContext } | { error: string } {
  const bad = unknownParams(url, ['event', 'path', 'session', 'cold', 'restore', ...extraAllowed]);
  if (bad) return { error: bad };

  const event = url.searchParams.get('event');
  if (event === null || !SELECT_EVENTS.includes(event as SelectEvent)) {
    return { error: `event must be one of ${SELECT_EVENTS.join(', ')} (got ${JSON.stringify(event)})` };
  }

  const target = url.searchParams.get('path');
  if (event === 'tool' && (target === null || target === '')) {
    return { error: 'event=tool requires path=<repo-relative file>' };
  }
  if (event !== 'tool' && target !== null) {
    return {
      error: `path is only meaningful with event=tool — select ignores it for ${event}, ` +
        'and this endpoint refuses what it would ignore',
    };
  }

  const session = url.searchParams.get('session');
  const cold = url.searchParams.get('cold');
  if ((session === null) === (cold === null)) {
    return {
      error: 'pass exactly one of session=<id> (this session\'s preview) or cold=1 ' +
        '(a brand-new session\'s answer — a different question, labelled as one)',
    };
  }
  if (cold !== null && cold !== '1') return { error: 'cold takes exactly the value 1' };

  const restoreRaw = url.searchParams.get('restore');
  if (restoreRaw !== null && event !== 'compact') {
    return { error: 'restore is only meaningful with event=compact' };
  }

  const ctx: SelectContext = { event: event as SelectEvent };
  if (event === 'tool') ctx.path = target;
  if (restoreRaw !== null) ctx.restore = restoreRaw.split(',').filter((s) => s !== '');
  if (session !== null) {
    const state = readSeen(ws.projectRoot, session);
    ctx.seen = state.error === null ? seenIds(state) : [];
    // Disclosed, not swallowed: the hook records
    // 'seen file unreadable; injected without dedupe' and so must this.
    if (state.error !== null) ctx.seenUnreadable = true;
  }
  // Focus is the fifth narrowing input. Read it the way the hook does.
  ctx.focus = focusOff ? null : readFocus(ws.projectRoot).focus;
  return { ctx };
}

function runSelect(ws: Workspace, ctx: SelectContext): { items: Item[]; selection: Selection } {
  return withStores(ws, (store) => {
    const items = store.all();
    return { items, selection: select(items, ctx, ws.config) };
  });
}

export function apiSelect(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return { status: 200, body: runSelect(ws, parsed.ctx).selection };
}

export function apiRender(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url);
  if ('error' in parsed) return badRequest(parsed.error);
  return { status: 200, body: { text: renderSelection(runSelect(ws, parsed.ctx).selection) } };
}

const BUDGET_KEYS = ['pinned', 'jit', 'restored', 'index'] as const;

export function apiSimulate(ws: Workspace, url: URL): JsonResult {
  const parsed = parseSelectQuery(ws, url, [...BUDGET_KEYS]);
  if ('error' in parsed) return badRequest(parsed.error);

  const budgets = { ...ws.config.budgets };
  for (const key of BUDGET_KEYS) {
    const raw = url.searchParams.get(key);
    if (raw === null) continue;
    const value = Number(raw);
    if (!Number.isInteger(value) || value < 0) {
      return badRequest(`${key} must be a non-negative integer (got ${JSON.stringify(raw)})`);
    }
    budgets[key] = value;
  }
  const config: Config = { ...ws.config, budgets };

  return withStores(ws, (store) => {
    const items = store.all();
    const selection = select(items, { ...parsed.ctx }, config);
    const byId = new Map(items.map((i) => [i.id, i]));
    const ids = [...new Set([
      ...selection.full.map((e) => e.item.id),
      ...selection.spilled.map((s) => s.id),
    ])];
    const costs = ids.flatMap((id) => {
      const item = byId.get(id);
      return item ? [{ id, tokens: itemCost(item) }] : [];
    });
    return { status: 200, body: { selection, budgets, costs } };
  });
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS. Execute the non-vacuity check from Step 1's note (comment out the `ledger.record` line, confirm the `notDeepEqual` fails, restore).

- [ ] **Step 6: Commit**

```bash
git add src/ui/routes.ts src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): route table and the select/render/simulate read model with select() parity"
```

---

## Task 9: Read model — sessions and current injections

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `Ledger.sessionSummaries` (Task 7), `Ledger.recentSessions`, `readSeen`/`seenIds` (`core/seen-file.ts`), `withStores`.
- Produces:
  - `apiSessions(ws: Workspace, url: URL): JsonResult` — `GET /api/sessions` → `{ default: string | null; sessions: SessionSummary[] }`. `default` is `Ledger.recentSessions(1)[0] ?? null` (spec §3 item 1); `sessions` is `sessionSummaries(20)` (spec §3 item 2). An empty ledger yields `{ default: null, sessions: [] }` and the client shows only the labelled cold option (spec §3 item 4). No parameters accepted.
  - `apiInjected(ws: Workspace, url: URL, params: { session: string }): JsonResult` — `GET /api/session/:session/injected` → `{ lines: { id: string; tier: LedgerTier; at: string; title: string | null }[]; error: string | null }` — **the per-session seen file's lines**, each joined to the item's current title, `title: null` when the item no longer exists (never dropped from the list: an injection of a since-deleted item still happened). `error` is `SeenState.error` verbatim: an unreadable seen file is a **disclosed** state, never an empty one — the same rule `/api/select` follows in Task 8.

**Corrected 2026-08-20 (§0.2): this endpoint read `ledger.entries(session)` and must not.** The screen
it feeds is `data-p="injected"`, and it states its own source twice. Its subtitle: *"What this context
window actually received, **from the per-session seen file** — the parent thread's, keyed as the hook
keys it"* (`inj.sub`). Its note: *"Read from the seen file, not `Ledger.seen` — that is a replayed
projection nothing here updates, and it would show a different number"* (`inj.note`). `Ledger.entries`
is that same replayed projection read one session at a time, so the note rules it out on its own
reasoning. §0's first row recorded the Ledger leaving the hook's path; that fact retires **every**
ledger read that claims to show live delivery, not only the one in `/api/select`.

**The seen file carries exactly the three columns the screen draws.** `core/seen-file.ts` ·
`export interface SeenLine {` · ~26 declares `{ id; tier; at }`, against the mockup's table headers
`th.item` / `th.tier` / `th.when` and its `09:14:02`-shaped timestamps. Nothing has to be synthesised,
and nothing the ledger offered is lost.

**Which key, and why the bare session id.** `readSeen(root, key)` takes the dedupe key, and
`ledgerKey(input)` yields `session_id::agent_id` for a subagent and the bare id for the parent
(`hooks/io.ts` · `export function ledgerKey(input: HookInput): string \| null {` · ~46). The mockup
fixes the choice: *"Previews are of the **parent thread**. A subagent has its own dedupe key and its
deliveries are not folded in here"* (`sess.parent`). So `:session` is the **bare** id and this endpoint
must not merge subagent files into it. Whether a subagent's deliveries are reachable at all is not
answered by the mockup and is **not** decided here.

`Ledger.entries` stays exported and stays used by `status`, `decay` and `audit replay-ledger`. It is
this screen's use of it that is retired, not the function.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiSessions, apiInjected } from '../../src/ui/read-model.ts';

test('/api/sessions defaults to the most recent session and lists summaries', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const empty = apiSessions(ws, new URL('http://x/api/sessions'));
    assert.deepEqual(empty.body, { default: null, sessions: [] });

    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const anyId = store.all()[0].id;
    ledger.record('s-old', anyId, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.record('s-new', anyId, 'jit', '2026-08-02T10:00:00.000Z');
    const result = apiSessions(ws, new URL('http://x/api/sessions'));
    const body = result.body as { default: string; sessions: { sessionId: string }[] };
    assert.equal(body.default, 's-new');
    assert.deepEqual(body.sessions.map((s) => s.sessionId), ['s-new', 's-old']);
    ledger.close(); store.close();
  } finally { done(); }
});

test('/api/session/:session/injected reads the SEEN FILE, joins titles, keeps vanished items', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const item = store.all()[0];
    store.close();

    // The seen file is what the hook appends to, so the fixture appends to it.
    // Establish by executing: read `core/seen-file.ts`'s append helper and use
    // it rather than writing JSONL by hand — the protocol line matters.
    appendSeen(ws.projectRoot, 's1', { id: item.id, tier: 'pinned', at: '2026-08-01T09:14:02.000Z' });
    appendSeen(ws.projectRoot, 's1', { id: 'RULE-gone', tier: 'jit', at: '2026-08-01T09:22:41.000Z' });

    const result = apiInjected(ws, new URL('http://x/api/session/s1/injected'), { session: 's1' });
    const body = result.body as {
      lines: { id: string; tier: string; at: string; title: string | null }[];
      error: string | null;
    };
    assert.equal(body.lines.length, 2);
    assert.equal(body.error, null);
    // All three columns the screen draws come off the file, not off a join.
    assert.equal(body.lines[0].tier, 'pinned');
    assert.equal(body.lines[0].at, '2026-08-01T09:14:02.000Z');
    assert.equal(body.lines.find((l) => l.id === item.id)?.title, item.title);
    assert.equal(body.lines.find((l) => l.id === 'RULE-gone')?.title, null);
  } finally { done(); }
});

test('/api/session/:session/injected does NOT answer from the ledger', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const item = store.all()[0];
    // A ledger row and NO seen file: the replayed projection says one thing,
    // the live dedupe state says nothing. The screen shows the live state.
    ledger.record('s2', item.id, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.close(); store.close();

    const result = apiInjected(ws, new URL('http://x/api/session/s2/injected'), { session: 's2' });
    assert.deepEqual((result.body as { lines: unknown[] }).lines, []);
  } finally { done(); }
});

test('an unreadable seen file is disclosed, never rendered as "nothing was injected"', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // Establish by executing: write a file at `seenFilePath(ws.projectRoot, 's3')`
    // that violates the protocol line, per `core/seen-file.ts`'s own validator.
    corruptSeenFile(ws.projectRoot, 's3');
    const body = apiInjected(ws, new URL('http://x/api/session/s3/injected'), { session: 's3' })
      .body as { lines: unknown[]; error: string | null };
    assert.equal(typeof body.error, 'string');
    assert.notEqual(body.error, '');
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: the two new tests FAIL (`apiSessions` not exported); the rest pass.

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`)

```ts
export function apiSessions(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (_store, ledger) => ({
    status: 200,
    body: {
      default: ledger.recentSessions(1)[0] ?? null,
      sessions: ledger.sessionSummaries(20),
    },
  }));
}

export function apiInjected(
  ws: Workspace, url: URL, params: { session: string },
): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  // The SEEN FILE, not the Ledger: this screen shows live delivery state, and
  // the Ledger is a replayed projection nothing here updates (§0.2). The key
  // is the BARE session id — a subagent has its own dedupe key and its
  // deliveries are not folded in (mockup, `sess.parent`).
  const state = readSeen(ws.projectRoot, params.session);
  return withStores(ws, (store) => {
    const titles = new Map(store.all().map((i) => [i.id, i.title]));
    const lines = state.lines.map((l) => ({
      ...l,
      // null, not dropped: the injection of a since-deleted item still happened.
      title: titles.get(l.id) ?? null,
    }));
    // Disclosed, never swallowed: an unreadable seen file is a different fact
    // from an empty one, and the screen says which it is.
    return { status: 200, body: { lines, error: state.error } };
  });
}
```

(`withStores`' ledger argument goes unused here — if its signature requires the callback to take both,
open only the `Store`; the read no longer needs a `Ledger` at all, which is the point.)

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): sessions read model, and injected-now from the per-session seen file"
```

---

## Task 10: Read model — status, doctor, decay

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `reviewQueue` (`select.ts:247`), `pendingRevisionSummaries`/`pendingRevisionCounts` (Task 6), `runChecks` (`doctor/checks.ts:675`), `computeDecay` (`decay.ts:93`), `Ledger.history` (Task 7), `VERSION` (`core/version.ts`).
- Produces:
  - `apiStatus(ws, url): JsonResult` — `GET /api/status` →

    ```ts
    {
      version: string;
      profile: string;
      items: { total: number; byCategory: Record<string, number>;
               byStatus: Record<string, number>; byOrigin: Record<string, number> };
      reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
      pendingRevisions: { revisions: number; items: number };
      health: { errors: number; warnings: number; infos: number };
    }
    ```

    Field semantics match `status --json` (`src/cli/commands/status.ts:209-280`): `reviewQueue.drafts` is the **project-layer** queue via core `reviewQueue(items)` — never a raw draft tally — with `globalLayerDrafts` named beside it exactly as `status` names it (`status.ts:163`). `health` is a level tally of `runChecks` findings (a presentation count, not a rule; the rule set is `runChecks` itself). The screen is the recorded §4 exception ("kept because it is the landing screen"), and this endpoint keeps it honest by composing the same functions `status` composes.
  - `apiDoctor(ws, url): JsonResult` — `GET /api/doctor` → `{ findings: Finding[] }`, `runChecks` verbatim, unfiltered, ungrouped — grouping by `code` and composing repair commands is the client's presentation (Task 19), so no finding can be dropped between the checker and the screen.
  - `apiDecay(ws, url): JsonResult` — `GET /api/decay?window=N` (default 20, positive integer) → `{ report: DecayReport; series: InjectionEvent[] }`. `report` is `computeDecay` fed exactly as `status.ts:182-189` feeds it; `series` is `Ledger.history()`. The chart's caveat text lives in the string tables and carries the window and sessions-recorded figures the chart must disclose.

**What this serves on `data-p="decay"`, and what it does not** (§0.3 rows 7–8). The decay screen draws
**two** charts, from **two different measurements**, and its own subtitle says so: *"The delivery
history in the second card is a different measurement from a different source"* (`dec.sub`).

- **The recency comb** (`#comb` · `dec.comb` — *"one tooth per item, never bucketed"*) **is served.**
  Its five states all fall out of this response joined to `/api/items`: warm and cold from
  `DecayReport`, `unrestricted` from the same, **never injected** from the item ids absent from
  `series`, and **pinned and cold** — *"a defect signal, not decay"* (`dec.badpin`) — from `always` on
  `/api/items` intersected with `report.cold`. The unit is sessions, not days, and `dec.sub` makes that
  binding: *"an axis against a clock would be wrong here even where it would look better."*
- **The 90-day heatstrip** (`#heat` · `dec.heat`) **is not served, and cannot be by this endpoint.**
  The mockup rules the ledger out by name: *"Its source is **not** the ledger, which records deliveries
  only: it is `audit_item.role` joined to `audit.at`, both indexed, with the `since` / `until` filters
  that already ship."* The hatched cells are **spilled** days, and a delivery ledger has no row for a
  spill — so this response can draw intensity and must not draw the strip. See §0.3 row 8. **Do not
  approximate it from `series`**: a heatstrip with no hatching is the *"quiet"* reading of a corpus
  being selected and thrown away repeatedly, which is the one thing the view exists to distinguish.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiStatus, apiDoctor, apiDecay } from '../../src/ui/read-model.ts';

test('/api/status composes the same queue and counts status --json reports', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiStatus(ws, new URL('http://x/api/status'));
    assert.equal(result.status, 200);
    const body = result.body as {
      version: string; profile: string;
      items: { total: number; byStatus: Record<string, number> };
      reviewQueue: { drafts: number; always: number; globalLayerDrafts: number };
      pendingRevisions: { revisions: number; items: number };
      health: { errors: number; warnings: number; infos: number };
    };
    assert.equal(body.items.total, 3);
    assert.equal(body.profile, ws.config.profile);
    // `mycontext add` through the CLI stamps origin human → active, so the
    // project-layer queue is empty and byStatus shows 3 active. (If this
    // fixture assumption is wrong when run, read the actual statuses from
    // store.all() and assert the DERIVED relationship instead: drafts equals
    // reviewQueue(items).length — that is the invariant, not the raw number.)
    assert.equal(body.reviewQueue.drafts + body.items.byStatus.active, 3 + body.reviewQueue.drafts);
    assert.deepEqual(body.pendingRevisions, { revisions: 0, items: 0 });
    assert.ok(body.health.errors >= 0);
  } finally { done(); }
});

test('/api/doctor returns runChecks findings verbatim', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiDoctor(ws, new URL('http://x/api/doctor'));
    assert.equal(result.status, 200);
    const findings = (result.body as { findings: { level: string; code: string; message: string }[] }).findings;
    assert.ok(Array.isArray(findings));
    for (const f of findings) {
      assert.ok(['error', 'warn', 'info'].includes(f.level));
      assert.equal(typeof f.code, 'string');
    }
  } finally { done(); }
});

test('/api/decay returns the report and the raw series, and validates window', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ledger = Ledger.open(ws.dbPath);
    const anyId = store.all()[0].id;
    ledger.record('s1', anyId, 'jit', '2026-08-01T10:00:00.000Z');
    ledger.close(); store.close();

    const result = apiDecay(ws, new URL('http://x/api/decay'));
    assert.equal(result.status, 200);
    const body = result.body as {
      report: { window: number; sessionsRecorded: number; cold: unknown[] };
      series: { itemId: string; injectedAt: string }[];
    };
    assert.equal(body.report.window, 20);
    assert.equal(body.report.sessionsRecorded, 1);
    assert.equal(body.series.length, 1);
    assert.equal(body.series[0].itemId, anyId);

    assert.equal(apiDecay(ws, new URL('http://x/api/decay?window=0')).status, 400);
    assert.equal(apiDecay(ws, new URL('http://x/api/decay?window=abc')).status, 400);
    assert.equal(apiDecay(ws, new URL('http://x/api/decay?windw=5')).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: new tests FAIL (not exported).

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`; add the imports shown)

```ts
import path from 'node:path';
import { computeDecay } from '../core/decay.ts';
import { pendingRevisionCounts, pendingRevisionSummaries } from '../core/revision-log.ts';
import { reviewQueue } from '../core/select.ts';
import { VERSION } from '../core/version.ts';
import { runChecks } from '../doctor/checks.ts';

function tally(items: Item[], key: (i: Item) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) counts[key(item)] = (counts[key(item)] ?? 0) + 1;
  return counts;
}

export function apiStatus(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    // The project-layer queue, via the ONE definition (select.ts reviewQueue) —
    // never a raw draft tally; the difference is named, as status.ts:163 names it.
    const queue = reviewQueue(items);
    const globalLayerDrafts = items.filter((i) => i.status === 'draft').length - queue.length;
    const findings = runChecks({
      root: projectRoot,
      repoRoot: path.dirname(projectRoot),
      dbPath: ws.dbPath,
      items,
      config: ws.config,
    });
    return {
      status: 200,
      body: {
        version: VERSION,
        profile: ws.config.profile,
        items: {
          total: items.length,
          byCategory: tally(items, (i) => i.type),
          byStatus: tally(items, (i) => i.status),
          byOrigin: tally(items, (i) => i.origin),
        },
        reviewQueue: {
          drafts: queue.length,
          always: queue.filter((i) => i.always).length,
          globalLayerDrafts,
        },
        pendingRevisions: pendingRevisionCounts(pendingRevisionSummaries(projectRoot)),
        health: {
          errors: findings.filter((f) => f.level === 'error').length,
          warnings: findings.filter((f) => f.level === 'warn').length,
          infos: findings.filter((f) => f.level === 'info').length,
        },
      },
    };
  });
}

export function apiDoctor(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => ({
    status: 200,
    body: {
      findings: runChecks({
        root: projectRoot,
        repoRoot: path.dirname(projectRoot),
        dbPath: ws.dbPath,
        items: store.all(),
        config: ws.config,
      }),
    },
  }));
}

export function apiDecay(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['window']);
  if (bad) return badRequest(bad);
  const raw = url.searchParams.get('window');
  const window = raw === null ? 20 : Number(raw);
  if (!Number.isInteger(window) || window <= 0) {
    return badRequest(`window must be a positive integer (got ${JSON.stringify(raw)})`);
  }
  return withStores(ws, (store, ledger) => {
    const items = store.all();
    const report = computeDecay({
      items,
      config: ws.config,
      usage: ledger.allUsage(),
      recentlyUsed: ledger.itemsUsedIn(ledger.recentSessions(window)),
      window,
      sessionsRecorded: ledger.sessionCount(),
    });
    return { status: 200, body: { report, series: ledger.history() } };
  });
}
```

(If `computeDecay`'s `DecayInput` field names differ from this call when typechecked — the shape was read from `src/core/decay.ts:60` and `status.ts:183-189` — follow the type, not this prose.)

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npx tsc --noEmit`
Expected: PASS. If the status fixture assumption (3 active items) fails, apply the derived-relationship fallback written in the test comment — and delete the raw-number assertion, not the invariant.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): status, doctor and decay read model"
```

---

## Task 11: Read model — coverage, graph, items, help

**Files:**
- Modify: `src/ui/read-model.ts`
- Test: extend `test/ui/read-model.test.ts`

**Interfaces:**
- Consumes: `matchesScope` (`select.ts:149`), `injection` (`cli/commands/injection.ts:42`), `listRepoFiles` (`doctor/checks.ts:72`), `helpTopic`/`HELP_TOPICS` (`help/index.ts`), `scopePolicyFor` (`config.ts:138`), `isLoadBearing` (`core/focus.ts`), `Ledger.usage`.
- Produces:
  - `apiCoverage(ws, url): JsonResult` — `GET /api/coverage` →

    ```ts
    {
      files: { path: string; governs: string[] }[];   // ids of governing scoped/unscoped items per file
      pinned: string[];                                // always-items: govern every session, path-independent
      items: { id: string; type: string; title: string; scope: string[];
               always: boolean; injected: boolean; phrase: string }[];
      truncated: boolean;                              // listRepoFiles hit its 20k bound — the map is partial
    }
    ```

    **Gap recorded, not designed (§0.3 row 12): `truncated` is a single global boolean and the screen
    needs the fact per path.** The coverage tree draws a three-segment magnitude bar per directory —
    governed / ungoverned / **not examined** (`data-p="coverage"` · `.mini` · `cov.magn`) — and the
    gaps screen prints the third state against a named path (`vendor/` — *"**not examined** — past the
    file limit"*). `gaps.note` makes the distinction binding: *"**Not examined** is a third state, never
    folded into 'gap'. A file the walk did not reach is not a file nothing governs."* This response can
    say the walk stopped; it cannot say **where**, so the third segment cannot be drawn from it and
    `buildTree`/`coverageGaps` (Task 18) must not infer it. **Needs: the paths `listRepoFiles` did not
    reach.** Reported to the owner.

    **The rule composition §3 fixes, exactly:** an item colours a file iff `injection(item, config).injected` (which already encapsulates `isEligible`, the normative-tier test and `emptyScopeInjection` in `select`'s own order) **and** `matchesScope(item, file, config)`. **Never `matchesAnyGlob`** — that is the defect `select.ts:127-129` documents by name. Pinned (`always`) items are reported separately because they govern sessions, not paths. Coverage *gaps* (directories with no governing item; empty categories) are derived client-side from `files` + `/api/status` `byCategory` — a presentation over this data, not a second matcher.
  - `apiGraph(ws, url): JsonResult` — `GET /api/graph?focus=<id>&radius=1|2` →

    ```ts
    {
      focus: string;
      nodes: { id: string; title: string | null; type: string | null;
               status: string | null; missing: boolean }[];
      edges: { from: string; to: string; type: string;
               dangling: boolean; loadBearing: boolean }[];
      omitted: number;   // nodes beyond the 60 cap — explicit, never silent (spec §4)
    }
    ```

    Ego-graph only (spec §4): BFS from `focus` over `relations` in **both** directions, radius ≤ 2, deterministic order (neighbours sorted by relation type then id), hard cap 60 nodes with `omitted` counting the rest. A relation whose target is not in the corpus yields a `missing: true` node and a `dangling: true` edge — the thing worth seeing after a supersede. Unknown `focus` → 404. Layout is the client's (deterministic layered, Task 18); the server ships no coordinates.

    **`loadBearing` added 2026-08-20 (§0.3 row 14).** The mockup's legend has **three** line styles, not
    two — load-bearing, referential, dangling (`data-p="graph"` · `.legend` · `gr.lbear`, `gr.lref`,
    `gr.ldang`) — and `gr.note` says why the third fact is not decoration: *"Every edge carries its
    **relation type** and its line style carries severity, because those are two different facts:
    `isLoadBearing` already classifies the vocabulary, so a dangling `relates_to` reads as noise and a
    dangling `constrains` reads as an alarm. Without that, a graph can only show breakage, never how
    much it matters — which is why the dangling edges need no separate table."* The classifier already
    exists and is already exported (`core/focus.ts` · `export function isLoadBearing(type: string): boolean {` · ~165);
    it is called **here**, server-side, because a browser `.js` module cannot import a core `.ts` module
    and re-listing the relation vocabulary in the client is the copied-rule defect Task 5 exists to
    prevent. **The node states the legend also names are already served:** `focus` (the response's own
    `focus`), `missing`, superseded (via `status`), and *"+N more"* (`omitted`).
  - `apiItems(ws, url): JsonResult` — `GET /api/items` → `{ items: { id; type; title; status; always; scope; injected; phrase }[] }` sorted by id — the link target for every screen.
  - `apiItem(ws, url, params: { id }): JsonResult` — `GET /api/item/:id` → `{ item: Item; injection: { phrase: string; injected: boolean }; usage: Usage }` (`Ledger.usage`, `ledger.ts:187`). Unknown id → 404.

    **This is the item detail pane's read, and it is short of it by one field (§0.3 row 9).** The
    mockup's `<aside class="pane" id="pane">` is the destination of every `button.linkid` on every
    screen; its `<dl>` (`pane.type`, `pane.status`, `pane.tier`, `pane.scope`, `pane.gov`, `pane.file`)
    is served by `item` + `injection` above. Its **sparkline** (`#panespark` · `pane.hist` — *"Delivered
    — twelve weeks"*) is not: `Usage` is a count, and the view needs twelve weekly buckets *"hatched
    where the item was **spilled** that week and grey where nothing was delivered"* (`pane.histn`). A
    count cannot carry the spilled state at all. **Needs: a weekly delivered/spilled series from the
    audit projection — the same source as §0.3 rows 4 and 8.** Because `pane.histn` calls it *"the one
    history that belongs on **every** item rather than on a screen of its own"*, this gap is not one
    chart: it is every screen that links an id. Reported to the owner; **who builds the pane itself is
    open** (§0.4 item 4).
  - `apiHelp(ws, url, params: { topic }): JsonResult` — `GET /api/help/:topic` → `{ topic; markdown; corpus }` where `markdown` is `helpTopic(topic, ws.config)` and `corpus` is the §4 Learn cross-link data — the join that justifies the screen ("built without it, this screen is a documentation viewer and should be cut"):
    - `scope` topic: `{ scoped: { id; title; scope }[]; unscoped: { id; title; policy: ScopePolicy }[] }` — policy via `scopePolicyFor`, so what an empty scope means is stated per item under **this** project's config.
    - `categories` topic: `{ counts: Record<string, number>; empty: string[] }` — enabled categories with zero items.
    - `capture` topic: `{ recent: { id; title; mtime: string }[] }` — five most recent **by file modification time** (`Item` has no creation timestamp — `types.ts:33-58`; the label in the strings table carries that condition: `learn.recentCaptures`).
    - `workflow` topic: `{ drafts: number; pendingRevisions: { revisions: number; items: number } }`.
    - Unknown topic → 404 listing `HELP_TOPICS`.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/read-model.test.ts`)

```ts
import { apiCoverage, apiGraph, apiItems, apiItem, apiHelp } from '../../src/ui/read-model.ts';
import { writeFileSync, mkdirSync } from 'node:fs';

test('/api/coverage colours files with matchesScope + injection(), never a bare glob', () => {
  const { dir, done } = workspace();
  try {
    mkdirSync(path.join(dir, 'src'), { recursive: true });
    writeFileSync(path.join(dir, 'src', 'a.ts'), '');
    writeFileSync(path.join(dir, 'top.md'), '');
    const ws = resolveWorkspace(dir);
    const result = apiCoverage(ws, new URL('http://x/api/coverage'));
    assert.equal(result.status, 200);
    const body = result.body as {
      files: { path: string; governs: string[] }[];
      pinned: string[];
      items: { id: string; type: string; injected: boolean }[];
    };
    const store = Store.open(ws.dbPath);
    const items = store.all();
    store.close();
    const scopedRule = items.find((i) => i.title === 'Always use POSIX paths')!;
    const pinnedRule = items.find((i) => i.title === 'Pin me')!;
    const decision = items.find((i) => i.title === 'We chose sqlite')!;

    const srcFile = body.files.find((f) => f.path === 'src/a.ts')!;
    const topFile = body.files.find((f) => f.path === 'top.md')!;
    // The scoped rule governs src/** only; the pinned rule is path-independent;
    // the decision is RATIONALE tier — injection().injected is false, so it
    // must colour NOTHING (the false statement the spec names in §3).
    assert.ok(srcFile.governs.includes(scopedRule.id));
    assert.ok(!topFile.governs.includes(scopedRule.id));
    assert.deepEqual(body.pinned, [pinnedRule.id]);
    for (const f of body.files) assert.ok(!f.governs.includes(decision.id));
    assert.equal(body.items.find((i) => i.id === decision.id)?.injected, false);
  } finally { done(); }
});

test('/api/graph is an ego graph with dangling edges visible and a hard cap', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.open(ws.dbPath);
    const ids = store.all().map((i) => i.id).sort();
    store.close();
    // Link two real items, then point a relation at a missing id by superseding
    // nothing — instead, use the CLI link command if present; otherwise this
    // fixture writes relations through `runCli(['add', …])`? Neither exists as
    // a read — so ESTABLISH BY EXECUTING: find how relations are created in
    // tests today (grep test/ for `relations:` fixtures or a link command) and
    // create: ids[0] -> ids[1] (real) and ids[0] -> 'RULE-ghost' (dangling).
    // The assertions below are the contract; the fixture mechanics follow the
    // codebase's existing pattern.
    const result = apiGraph(ws, new URL(`http://x/api/graph?focus=${ids[0]}&radius=1`));
    assert.equal(result.status, 200);
    const body = result.body as {
      nodes: { id: string; missing: boolean }[];
      edges: { from: string; to: string; dangling: boolean }[];
      omitted: number;
    };
    assert.ok(body.nodes.some((n) => n.id === ids[0] && !n.missing));
    assert.equal(typeof body.omitted, 'number');

    assert.equal(apiGraph(ws, new URL('http://x/api/graph?focus=NOPE&radius=1')).status, 404);
    assert.equal(apiGraph(ws, new URL(`http://x/api/graph?focus=${ids[0]}&radius=3`)).status, 400);
  } finally { done(); }
});

test('/api/items and /api/item/:id carry the injection phrase; unknown id is 404', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const list = apiItems(ws, new URL('http://x/api/items'));
    const items = (list.body as { items: { id: string; phrase: string }[] }).items;
    assert.ok(items.length === 3);
    for (const i of items) assert.equal(typeof i.phrase, 'string');

    const one = apiItem(ws, new URL(`http://x/api/item/${items[0].id}`), { id: items[0].id });
    assert.equal(one.status, 200);
    const body = one.body as { item: { id: string }; usage: { useCount: number } };
    assert.equal(body.item.id, items[0].id);
    assert.equal(body.usage.useCount, 0);

    assert.equal(apiItem(ws, new URL('http://x/api/item/NOPE'), { id: 'NOPE' }).status, 404);
  } finally { done(); }
});

test('/api/help/:topic joins the topic to this corpus; unknown topic is 404', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const scope = apiHelp(ws, new URL('http://x/api/help/scope'), { topic: 'scope' });
    assert.equal(scope.status, 200);
    const body = scope.body as {
      markdown: string;
      corpus: { scoped: { id: string }[]; unscoped: { id: string; policy: string }[] };
    };
    assert.ok(body.markdown.length > 0);
    assert.equal(body.corpus.scoped.length, 1);   // the src/** rule
    assert.equal(body.corpus.unscoped.length, 2); // pinned rule + decision
    for (const u of body.corpus.unscoped) assert.ok(['global', 'required', 'inert'].includes(u.policy));

    const categories = apiHelp(ws, new URL('http://x/api/help/categories'), { topic: 'categories' });
    const cats = categories.body as { corpus: { counts: Record<string, number>; empty: string[] } };
    assert.equal(cats.corpus.counts.rule, 2);
    assert.ok(cats.corpus.empty.includes('constraint'));

    assert.equal(apiHelp(ws, new URL('http://x/api/help/nope'), { topic: 'nope' }).status, 404);
  } finally { done(); }
});
```

The graph fixture's establish-by-executing note is a real instruction: how a test creates a relation (a `relations:` frontmatter fixture, a link CLI command, or the MCP tool) must be read out of the existing tests (`grep -rn "relations" test/ --include="*.ts" -l`), and the fixture written the way the codebase already writes them. The dangling-edge and cap-60 assertions must both end up in the committed test with real fixtures behind them (cap 60: create a focus item with 61+ relations in a loop and assert `omitted >= 1` and `nodes.length <= 60`).

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/ui/read-model.test.ts`
Expected: new tests FAIL.

- [ ] **Step 3: Implement** (append to `src/ui/read-model.ts`; add imports: `matchesScope` from `select.ts`, `injection` from `../cli/commands/injection.ts`, `listRepoFiles` from `../doctor/checks.ts`, `helpTopic, HELP_TOPICS` from `../help/index.ts`, `scopePolicyFor` from `../core/config.ts`, `statSync` from `node:fs`)

```ts
const FILE_WALK_LIMIT = 20_000; // listRepoFiles' own default bound (doctor/checks.ts:43)

export function apiCoverage(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const repoRoot = path.dirname(ws.projectRoot);
  return withStores(ws, (store) => {
    const items = store.all();
    // injection() composes isEligible + the normative-tier test +
    // emptyScopeInjection(scopePolicyFor(...)) in select's own order
    // (cli/commands/injection.ts:42). NOT matchesAnyGlob — the defect
    // select.ts:127-129 documents by name.
    const decorated = items.map((item) => ({ item, verdict: injection(item, ws.config) }));
    const governing = decorated.filter((d) => d.verdict.injected && !d.item.always);
    const pinned = decorated.filter((d) => d.verdict.injected && d.item.always)
      .map((d) => d.item.id);
    const files = listRepoFiles(repoRoot);
    const coloured = files.map((file) => ({
      path: file,
      governs: governing
        .filter((d) => matchesScope(d.item, file, ws.config))
        .map((d) => d.item.id),
    }));
    return {
      status: 200,
      body: {
        files: coloured,
        pinned,
        items: decorated.map((d) => ({
          id: d.item.id, type: d.item.type, title: d.item.title,
          scope: d.item.scope, always: d.item.always,
          injected: d.verdict.injected, phrase: d.verdict.phrase,
        })),
        truncated: files.length >= FILE_WALK_LIMIT,
      },
    };
  });
}

const GRAPH_NODE_CAP = 60;

export function apiGraph(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['focus', 'radius']);
  if (bad) return badRequest(bad);
  const focus = url.searchParams.get('focus');
  if (!focus) return badRequest('focus=<item id> is required');
  const radiusRaw = url.searchParams.get('radius') ?? '1';
  const radius = Number(radiusRaw);
  if (radius !== 1 && radius !== 2) {
    return badRequest(`radius must be 1 or 2 (got ${JSON.stringify(radiusRaw)}) — an ego graph, not a hairball`);
  }
  return withStores(ws, (store) => {
    const items = store.all();
    const byId = new Map(items.map((i) => [i.id, i]));
    if (!byId.has(focus)) return { status: 404, body: { error: `no item ${focus}` } };

    // Adjacency in BOTH directions, deterministic: relation type, then id.
    const neighbours = new Map<string, { other: string; type: string; from: string; to: string }[]>();
    const push = (key: string, entry: { other: string; type: string; from: string; to: string }) => {
      const list = neighbours.get(key) ?? [];
      list.push(entry);
      neighbours.set(key, list);
    };
    for (const item of items) {
      for (const rel of item.relations) {
        push(item.id, { other: rel.target, type: rel.type, from: item.id, to: rel.target });
        push(rel.target, { other: item.id, type: rel.type, from: item.id, to: rel.target });
      }
    }
    for (const list of neighbours.values()) {
      list.sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.other < b.other ? -1 : 1);
    }

    const kept = new Set<string>([focus]);
    const edges: { from: string; to: string; type: string; dangling: boolean }[] = [];
    const edgeKeys = new Set<string>();
    let omitted = 0;
    let frontier = [focus];
    for (let depth = 0; depth < radius; depth++) {
      const next: string[] = [];
      for (const id of frontier) {
        for (const n of neighbours.get(id) ?? []) {
          if (!kept.has(n.other)) {
            if (kept.size >= GRAPH_NODE_CAP) { omitted++; continue; }
            kept.add(n.other);
            next.push(n.other);
          }
          const key = `${n.from}${n.to}${n.type}`;
          if (kept.has(n.from) && kept.has(n.other) && !edgeKeys.has(key)) {
            edgeKeys.add(key);
            edges.push({ from: n.from, to: n.to, type: n.type, dangling: !byId.has(n.to) });
          }
        }
      }
      frontier = next;
    }

    const nodes = [...kept].map((id) => {
      const item = byId.get(id);
      return item
        ? { id, title: item.title, type: item.type, status: item.status, missing: false }
        : { id, title: null, type: null, status: null, missing: true };
    });
    return { status: 200, body: { focus, nodes, edges, omitted } };
  });
}

export function apiItems(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store) => ({
    status: 200,
    body: {
      items: store.all()
        .sort((a, b) => a.id < b.id ? -1 : 1)
        .map((i) => {
          const verdict = injection(i, ws.config);
          return {
            id: i.id, type: i.type, title: i.title, status: i.status,
            always: i.always, scope: i.scope,
            injected: verdict.injected, phrase: verdict.phrase,
          };
        }),
    },
  }));
}

export function apiItem(ws: Workspace, url: URL, params: { id: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  return withStores(ws, (store, ledger) => {
    const item = store.all().find((i) => i.id === params.id);
    if (!item) return { status: 404, body: { error: `no item ${params.id}` } };
    return {
      status: 200,
      body: { item, injection: injection(item, ws.config), usage: ledger.usage(item.id) },
    };
  });
}

export function apiHelp(ws: Workspace, url: URL, params: { topic: string }): JsonResult {
  const bad = unknownParams(url, []);
  if (bad) return badRequest(bad);
  if (!(HELP_TOPICS as string[]).includes(params.topic)) {
    return { status: 404, body: { error: `no topic ${params.topic} — topics: ${HELP_TOPICS.join(', ')}` } };
  }
  if (!ws.projectRoot) return { status: 404, body: { error: 'no workspace here' } };
  const projectRoot = ws.projectRoot;
  return withStores(ws, (store) => {
    const items = store.all();
    const markdown = helpTopic(params.topic, ws.config);
    let corpus: unknown;
    switch (params.topic) {
      case 'scope': {
        corpus = {
          scoped: items.filter((i) => i.scope.length > 0)
            .map((i) => ({ id: i.id, title: i.title, scope: i.scope })),
          unscoped: items.filter((i) => i.scope.length === 0)
            .map((i) => ({ id: i.id, title: i.title, policy: scopePolicyFor(ws.config, i.type) })),
        };
        break;
      }
      case 'categories': {
        const counts: Record<string, number> = {};
        for (const i of items) counts[i.type] = (counts[i.type] ?? 0) + 1;
        const empty = Object.values(ws.config.categories)
          .filter((c) => c.enabled && (counts[c.name] ?? 0) === 0)
          .map((c) => c.name);
        corpus = { counts, empty };
        break;
      }
      case 'capture': {
        // By file mtime, labelled as such in the UI: Item carries no creation
        // timestamp (types.ts:33-58), and the ledger records injection, not
        // capture — mtime is the only recency signal that exists.
        const recent = items
          .map((i) => {
            try {
              return { id: i.id, title: i.title,
                mtime: statSync(path.join(projectRoot, i.filePath)).mtime.toISOString() };
            } catch {
              return null;
            }
          })
          .filter((r): r is { id: string; title: string; mtime: string } => r !== null)
          .sort((a, b) => b.mtime < a.mtime ? -1 : 1)
          .slice(0, 5);
        corpus = { recent };
        break;
      }
      default: { // 'workflow'
        corpus = {
          drafts: reviewQueue(items).length,
          pendingRevisions: pendingRevisionCounts(pendingRevisionSummaries(projectRoot)),
        };
      }
    }
    return { status: 200, body: { topic: params.topic, markdown, corpus } };
  });
}
```

`capture`'s mtime lookup joins against the **project layer** path; a global-layer item's `filePath` is relative to the global root, so restrict `recent` to `i.layer === 'project'` (add `.filter((i) => i.layer === 'project')` before the map) — a stat against the wrong root must not silently produce a wrong date; the try/catch above degrades a missing file to exclusion, and the layer filter makes the path base correct rather than lucky.

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test test/ui/read-model.test.ts && npm test && npx tsc --noEmit`
Expected: PASS, suite green.

- [ ] **Step 5: Commit**

```bash
git add src/ui/read-model.ts test/ui/read-model.test.ts
git commit -m "feat(ui): coverage, ego-graph, items and corpus-joined help read model"
```

---

## Task 12: `static.ts` — asset serving, traversal-proof

**Files:**
- Create: `src/ui/static.ts`
- Test: `test/ui/static.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`.
- Produces: `serveStatic(pathname: string, publicDir: string): { status: number; contentType: string; body: Buffer } | null` — `null` for "not a static asset" (the caller 404s). `/` serves `index.html`. Static responses carry `Cache-Control: no-store` (the caller sets it; a token-guarded ephemeral app must not leave assets in a shared cache) — static GETs are **not** `/api` requests and never touch the idle monitor (§2's idle definition counts `/api` requests only).

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/static.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { serveStatic } from '../../src/ui/static.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

test('/ serves index.html as text/html', () => {
  const result = serveStatic('/', PUBLIC);
  assert.ok(result);
  assert.equal(result?.status, 200);
  assert.equal(result?.contentType, 'text/html; charset=utf-8');
});

test('a JS module and the stylesheet serve with correct types', () => {
  assert.equal(serveStatic('/strings/en.js', PUBLIC)?.contentType, 'text/javascript; charset=utf-8');
  assert.equal(serveStatic('/styles.css', PUBLIC)?.contentType, 'text/css; charset=utf-8');
});

test('path traversal cannot escape the public directory', () => {
  for (const evil of [
    '/../server.ts', '/..%2Fserver.ts', '/%2e%2e/server.ts',
    '/strings/../../security.ts', '/..\\server.ts',
  ]) {
    assert.equal(serveStatic(evil, PUBLIC), null, evil);
  }
});

test('a missing file is null, not a throw', () => {
  assert.equal(serveStatic('/nope.js', PUBLIC), null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/static.test.ts`
Expected: FAIL — module not found. (`index.html`, `styles.css` and `strings/en.js` must exist for the type tests; `strings/en.js` does since Task 1 — `index.html`/`styles.css` arrive in Step 3 as minimal placeholders that Task 16 replaces with the real shell, each containing one comment line saying Task 16 owns the content.)

- [ ] **Step 3: Implement**

```ts
// src/ui/static.ts
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/**
 * Static assets for the UI page. Decode-then-resolve-then-containment-check:
 * the resolved absolute path must stay inside publicDir, so no encoding of
 * `..` (raw, %2F, %2e) can escape — the check is on the RESOLVED path, not on
 * the spelling. Unknown extensions are refused (null) rather than served as
 * octet-streams: this directory contains exactly four kinds of file, and a
 * fifth kind appearing is a mistake to surface, not content to ship.
 */
export function serveStatic(
  pathname: string, publicDir: string,
): { status: number; contentType: string; body: Buffer } | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const relative = decoded === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  if (relative.includes('\\')) return null; // never let win32 separators into the resolve
  const root = path.resolve(publicDir);
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  const contentType = CONTENT_TYPES[path.extname(resolved)];
  if (!contentType) return null;
  try {
    return { status: 200, contentType, body: readFileSync(resolved) };
  } catch {
    return null;
  }
}
```

Also create the two placeholder assets (real content in Task 16):

`src/ui/public/index.html`:

```html
<!doctype html>
<!-- Shell content is Task 16's; this file exists so static serving is testable first. -->
<html lang="en" dir="ltr"><head><meta charset="utf-8"><title>mycontext</title></head>
<body></body></html>
```

`src/ui/public/styles.css`:

```css
/* Real stylesheet is Task 16's. Logical properties ONLY — see the plan's Global Constraints. */
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/ui/static.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/static.ts src/ui/public/index.html src/ui/public/styles.css test/ui/static.test.ts
git commit -m "feat(ui): traversal-proof static serving for the app shell"
```

---

## Task 13: `server.ts` — wiring, handoff, ping, meta; the spawned-process E2E suite

**Files:**
- Create: `src/ui/server.ts`
- Create: `test/ui/helpers.ts`
- Test: `test/ui/server-e2e.test.ts`

**Interfaces:**
- Consumes: everything above (`routes`, `read-model`, `security`, `idle`, `static`, `git-info`), `resolveWorkspace`, `isMainEntry` (`core/paths.ts:161`).
- Produces — **the server contract plans 2 and 3 run inside**:

```ts
// src/ui/server.ts
export interface UiServerOptions {
  cwd: string;                       // workspace resolution root
  port?: number;                     // default 0 = OS-assigned
  host?: string;                     // MUST be '127.0.0.1'; anything else throws (spec §2.1)
  idleMs?: number;                   // default IDLE_MS; tests shrink it
  onExit?: (reason: 'idle' | 'closed') => void;
}
export interface RunningUiServer {
  port: number;
  /** URL carrying a fresh one-shot handoff nonce in the FRAGMENT. */
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}
export function startUiServer(options: UiServerOptions): Promise<RunningUiServer>;
export const OPENER_NONCE_TTL_MS = 10_000;    // spec §3: ten seconds, command-line-visible
export const PRINTED_NONCE_TTL_MS = 600_000;  // plan decision 5: printed URLs, never on a command line
```

Built-in endpoints registered here (all others come from `read-model` registrations below; plans 2/3 add theirs the same way):
- `POST /api/handoff` `{ nonce }` → `{ token }` — **exempt from the token check** (it is how the page first gets the token; it is still Host/Origin-checked), one-shot, in-memory only; there is no POST that changes state on disk (§2).
- `GET /api/ping` → `{ ok: true }` — the heartbeat target; counts as activity.
- `GET /api/meta` → `{ version, projectRoot, repoRoot, git: GitInfo | null }` — `readGitInfo` (Task 4); plan 3's strip renders `git` and adds nothing server-side.

Dispatch order per request, binding: (1) non-`/api` paths → `serveStatic` (no token — the page itself must load; it contains no secrets, and `Cache-Control: no-store`); (2) `/api/handoff` → Host/Origin check then nonce exchange; (3) every other `/api` path → full `validateApiRequest` gate, **then** `idle.touch()` iff the matched route is not `kind: 'stream'`, then the handler. JSON bodies: `Content-Type: application/json; charset=utf-8`, no CORS headers of any kind (§2 — their absence is the defence).

**A refusal answers with its status code and NOTHING ELSE — owner ruling A4, 2026-08-20 (§0.6).** This
task used to put the gate's developer-facing `reason` into an `error` field in the body it sent back to
the sender. Ruling 11 had already made every one of those reasons a fixed literal carrying no submitted
input, and the module says so at length — but a comment saying *"do not render this"* cannot stop a
later task rendering it, and this plan has thirty-odd recorded instances of exactly that. **Nothing can render what is never sent.** So the refusal goes out through
`sendRefusal(res, status)`, a helper that takes no body and therefore has no parameter a reason could be
passed in; the property is structural instead of requested. Two consequences, both stated here rather
than discovered: the browser's `api()` (Task 16) must not assume a body on a failure, and the E2E
asserts the refusal body is **empty** so the ruling is checked rather than described.

**And a refusal is RECORDED — owner ruling B4, 2026-08-20 (§0.6).** Before the status goes out,
`recordRefusal` (Task 2, `src/ui/security.ts`) appends one `access` record naming the check that refused
and the submitted `Host`/`Origin`. **This is the one write this surface performs**, it is on the refusal
path only, and §0.6 carries its exact shape, the eight field rules and what it does to §0.5's static
half. The `/api/handoff` nonce refusal is a different branch and is deliberately **not** covered — §0.4
item 10.

**This task also produces the RUNTIME half of the no-writes enforcement (owner ruling 2026-08-20, §0.5),
and — since 2026-08-20 — the boundary that keeps it honest (§0.6).** The corpus assertion below is
scoped to the **served-read path**: every request in its sweep is authorised, and the sweep already
fails on any status that is not `200` or `404`, so the one ruled refusal write cannot occur inside it.
`.audit/` is therefore **not** excluded from the snapshot and must never be — excluding it is the one
change that would blind this assertion to a *served read* writing an audit record, which is precisely
the class of defect it exists to catch. The refusal write gets a test of its own, immediately after,
asserting that the append it makes is the **only** thing in the corpus that changed.
Task 14's static test proves that no module under `src/ui/` *binds* a writer; it cannot prove that no
route *writes*, because a core read that writes internally leaves no import line to look at, and that
class is real here (`Store.open`'s corruption self-heal — §0, §0.5). The proof of the actual invariant
is behavioural and belongs where the real process already runs: **snapshot the corpus, exercise every
read route over real HTTP, assert the corpus is byte-identical afterwards.** It goes in the E2E file
below rather than in a harness of its own — a second spawn harness is a second thing to keep true, and
this one already builds a corpus, spawns the server and holds a token. Plans 2 and 3 extend `READ_ROUTES`
with every route they register: **a route absent from that list is a route this assertion does not
cover**, which is the one way this test can quietly stop meaning anything.

- [ ] **Step 1: Write the spawn harness and the failing E2E tests**

```ts
// test/ui/helpers.ts
/**
 * Spawns `src/ui/server.ts` as a real child process (the way test/mcp/
 * server-e2e.test.ts spawns the MCP server) and waits for its readiness
 * line. The server prints exactly one line to stdout when listening:
 *   mycontext ui: http://127.0.0.1:<port>/#<nonce>
 * The harness parses port and nonce; the TEST exchanges the nonce for the
 * token over HTTP, which exercises the handoff path on every run.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SERVER = fileURLToPath(new URL('../../src/ui/server.ts', import.meta.url));

export interface UiHarness {
  port: number;
  nonce: string;
  child: ChildProcessWithoutNullStreams;
  stop(): Promise<void>;
}

export function startUiChild(cwd: string, extraArgs: string[] = []): Promise<UiHarness> {
  const child = spawn(process.execPath, [SERVER, '--port', '0', ...extraArgs], { cwd });
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(() => reject(new Error(`ui server never became ready; output so far: ${buffer}`)), 30_000);
    child.stdout.on('data', (chunk: Buffer) => {
      buffer += chunk.toString();
      const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)\/#([0-9a-f]+)/);
      if (match) {
        clearTimeout(timer);
        resolve({
          port: Number(match[1]),
          nonce: match[2],
          child,
          stop: () => new Promise((done) => { child.once('exit', () => done()); child.kill(); }),
        });
      }
    });
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`ui server exited early (${code}): ${buffer}`));
    });
  });
}

export async function redeemNonce(port: number, nonce: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (response.status !== 200) throw new Error(`handoff refused: ${response.status}`);
  return ((await response.json()) as { token: string }).token;
}
```

```ts
// test/ui/server-e2e.test.ts
/**
 * Endpoints tested as the MCP server is: spawn a real process, make real
 * requests (spec §6). Security assertions are first-class here.
 *
 * A limit stated rather than papered over (spec §6): these tests exercise
 * every /api contract and the security gate; the browser-side RENDERING has
 * no test, because testing it would need a browser dependency this project
 * does not have. The view-model logic is tested in Node (test/ui/
 * viewmodel.test.ts); what the DOM looks like is not, and a green suite here
 * must not be read as pixels verified.
 *
 * This file also carries the RUNTIME half of the no-writes enforcement
 * (owner ruling 2026-08-20, plan §0.5): `the read surface changes not one
 * byte of the corpus` below. Task 14's static test proves which write symbols
 * src/ui/ BINDS; it cannot prove that no route WRITES, because a core read
 * that writes internally leaves no import line to look at — and that class is
 * real here (Store.open self-heals by rmSync-ing the database and both
 * journals). Only running the routes and comparing bytes answers the
 * invariant the spec actually states.
 *
 * THE SCOPE OF THAT ASSERTION, because it is a boundary and not a footnote
 * (owner ruling B4, 2026-08-20, plan §0.6). The read surface performs exactly
 * one write, on the REFUSAL path: a refused request is recorded in the audit
 * log with the check that refused and the submitted Host/Origin. The sweep
 * below makes only AUTHORISED requests — it fails on any status that is not
 * 200 or 404, which is what keeps a refusal out of it — so `.audit/` stays
 * INSIDE the snapshot. Excluding it would be the one edit that lets a served
 * read write an audit record unnoticed. The refusal write is proved, and
 * bounded, by `a refused request is recorded, and it is the only write` below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { DIR_NAME } from '../../src/core/workspace.ts';
import { HELP_TOPICS } from '../../src/help/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiChild, redeemNonce, type UiHarness } from './helpers.ts';

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-e2e-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Pin me', '--always', '--body', 'Pinned.'], dir, () => {});
  return dir;
}

async function api(h: UiHarness, token: string, pathname: string, headers: Record<string, string> = {}) {
  return fetch(`http://127.0.0.1:${h.port}${pathname}`, {
    headers: { [TOKEN_HEADER]: token, ...headers },
  });
}

test('handoff → token → authenticated read; the nonce is one-shot', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);
    await assert.rejects(() => redeemNonce(h.port, h.nonce)); // second use refused (spec §6)

    const ok = await api(h, token, '/api/select?event=session-start&cold=1');
    assert.equal(ok.status, 200);
    const body = await ok.json() as { full: unknown[]; index: unknown; spilled: unknown[] };
    assert.ok(Array.isArray(body.full));
  } finally { await h.stop(); removeTree(cwd); }
});

test('wrong token 403, missing header 401, bad Origin 403 — and no CORS headers anywhere', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const token = await redeemNonce(h.port, h.nonce);

    const wrong = await api(h, 'f'.repeat(64), '/api/ping');
    assert.equal(wrong.status, 403);

    const missing = await fetch(`http://127.0.0.1:${h.port}/api/ping`);
    assert.equal(missing.status, 401);

    const badOrigin = await api(h, token, '/api/ping', { origin: 'https://evil.example' });
    assert.equal(badOrigin.status, 403);

    // Owner ruling A4: a refusal is a STATUS AND NOTHING ELSE. Asserted on all
    // three, because the property is that no refusing exit has a body — not
    // that one of them happens not to. A `reason` that cannot be sent cannot
    // be rendered by a later task that decides refusals should be friendlier.
    for (const refused of [wrong, missing, badOrigin]) {
      assert.equal(await refused.text(), '', 'a refusal must carry no body at all');
    }

    const good = await api(h, token, '/api/ping');
    assert.equal(good.status, 200);
    assert.equal(good.headers.get('access-control-allow-origin'), null);
  } finally { await h.stop(); removeTree(cwd); }
});

test('an expired nonce is refused after its window', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--nonce-ttl-ms', '50']); // test-only flag, see Step 2
  try {
    await new Promise((r) => setTimeout(r, 200));
    await assert.rejects(() => redeemNonce(h.port, h.nonce));
  } finally { await h.stop(); removeTree(cwd); }
});

test('the page and static assets serve without a token; /api/meta carries git info', async () => {
  const cwd = project();
  const h = await startUiChild(cwd);
  try {
    const page = await fetch(`http://127.0.0.1:${h.port}/`);
    assert.equal(page.status, 200);
    assert.match(page.headers.get('content-type') ?? '', /text\/html/);
    assert.equal(page.headers.get('cache-control'), 'no-store');

    const token = await redeemNonce(h.port, h.nonce);
    const meta = await api(h, token, '/api/meta');
    const body = await meta.json() as { version: string; git: unknown };
    assert.equal(typeof body.version, 'string');
    assert.ok('git' in body); // null in a tmpdir with no .git — present either way
  } finally { await h.stop(); removeTree(cwd); }
});

test('idle: with no /api request for the window, the process exits on its own', async () => {
  const cwd = project();
  const h = await startUiChild(cwd, ['--idle-ms', '300']); // test-only flag, see Step 2
  try {
    const token = await redeemNonce(h.port, h.nonce);
    assert.equal((await api(h, token, '/api/ping')).status, 200);
    const exited = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 5_000);
      h.child.once('exit', () => { clearTimeout(timer); resolve(true); });
    });
    assert.equal(exited, true, 'server did not exit after its idle window');
  } finally { await h.stop(); removeTree(cwd); }
});

test('non-loopback bind is refused at startup, not warned about', async () => {
  const cwd = project();
  await assert.rejects(() => startUiChild(cwd, ['--host', '0.0.0.0']));
  removeTree(cwd);
});

// --- The runtime half of the no-writes enforcement (§0.5) -------------------

/**
 * Every read route this plan registers, with concrete parameters. **Plans 2
 * and 3 append theirs here.** A route missing from this list is a route this
 * assertion does not cover, and that is the one way this test can quietly stop
 * meaning anything — so `/api/help` is generated from HELP_TOPICS rather than
 * typed out, and the id and session come from the corpus at run time.
 *
 * `:id` and `:session` are each probed twice, once with a value that exists
 * and once with one that does not, because "the file is not there" is the case
 * that tempts a read into creating it.
 */
const READ_ROUTES = (from: { item: string; session: string | null }): string[] => [
  '/api/ping',
  '/api/meta',
  '/api/select?event=session-start&cold=1',
  '/api/select?event=tool&path=src/index.ts&cold=1',
  '/api/render?event=session-start&cold=1',
  '/api/simulate?event=session-start&cold=1&pinned=100',
  '/api/sessions',
  '/api/status',
  '/api/doctor',
  '/api/decay',
  '/api/decay?window=30',
  '/api/coverage',
  '/api/graph',
  `/api/graph?focus=${encodeURIComponent(from.item)}&radius=2`,
  '/api/items',
  `/api/item/${encodeURIComponent(from.item)}`,
  '/api/item/RULE-no-such-item',
  ...(from.session === null ? [] : [`/api/session/${encodeURIComponent(from.session)}/injected`]),
  '/api/session/never-seen-session/injected',
  ...HELP_TOPICS.map((topic) => `/api/help/${topic}`),
];

/**
 * `.index.db-wal` and `.index.db-shm` are named here rather than skipped
 * silently, because the reason they are excluded is exactly the reason this
 * test needs care.
 *
 * Their PRESENCE is not a write: opening an existing WAL database read-only
 * creates both, and `core/store.ts` records the measurement beside
 * `openReadOnlyChecked` — "the main file's bytes and mtime stay untouched".
 * Their CONTENT is a different matter for `-wal`, and it is asserted
 * separately below. `-shm` is SQLite's shared-memory index and holds no user
 * data at all, so it is excluded outright.
 */
const SIDECARS = new Set(['.index.db-wal', '.index.db-shm']);

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const key = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) { walk(full, key); continue; }
      if (SIDECARS.has(key)) continue;
      out[key] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root, '');
  return out;
}

/** Bytes in the WAL, or 0 when there is no WAL. See the assertion below. */
function walBytes(root: string): number {
  try { return statSync(path.join(root, '.index.db-wal')).size; } catch { return 0; }
}

/**
 * SCOPE (owner ruling B4, 2026-08-20, plan §0.6): the SERVED-READ path. Every
 * request this test makes is authorised, and the status guard below refuses
 * anything that is not 200 or 404 — so the one write this surface performs,
 * the refusal record, cannot happen inside this sweep. That is why `.audit/`
 * is NOT excluded from `snapshot()`: a served read writing an audit record is
 * exactly what this assertion is here to catch, and excluding the directory
 * would be the single edit that hides it.
 */
test('the read surface changes not one byte of the corpus', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const before = snapshot(corpus);          // taken with nothing holding the database
  try {
    const h = await startUiChild(cwd);
    try {
      const token = await redeemNonce(h.port, h.nonce);

      // The parameters come from the corpus through the server's own listings,
      // so a renamed fixture cannot silently reduce this test to the
      // parameterless routes. Both listings are themselves read routes and are
      // hit again below.
      const items = (await (await api(h, token, '/api/items')).json()) as
        { items: { id: string }[] };
      assert.ok(items.items.length > 0,
        'the fixture corpus is empty — this assertion would be measuring nothing');
      const sessions = (await (await api(h, token, '/api/sessions')).json()) as
        { sessions: { sessionId: string }[] };

      for (const route of READ_ROUTES({
        item: items.items[0]!.id,
        session: sessions.sessions[0]?.sessionId ?? null,
      })) {
        const response = await api(h, token, route);
        // 401/403 are excluded ON PURPOSE and not only because they prove
        // nothing: a refusal WRITES (plan §0.6), so a refused request inside
        // this sweep would redden the byte-identical assertion below for the
        // right reason at the wrong time. This line is what keeps the sweep
        // authorised, and it fails as ITSELF rather than as a mystery diff.
        assert.ok(response.status === 200 || response.status === 404,
          `${route} answered ${response.status}; this sweep is authorised throughout — a refusal `
          + 'here writes an audit record, and a route that errored proves nothing');
        await response.arrayBuffer(); // drain, so the handler has certainly finished
      }
    } finally {
      await h.stop(); // the child exits, so SQLite is no longer holding the file
    }

    assert.deepEqual(snapshot(corpus), before,
      'a SERVED READ changed the corpus — including .audit/, which is inside this snapshot on '
      + 'purpose (plan §0.6: the one ruled write is on the refusal path, and no request in this '
      + 'sweep was refused). This is precisely what the static test in Task 14 cannot see: it '
      + 'proves which symbols src/ui/ BINDS, never that no route WRITES.');

    // A page written in WAL mode lands in `-wal` first and only reaches
    // `.index.db` at a checkpoint — and `stop()` KILLS the child rather than
    // closing it, so no checkpoint is guaranteed. A non-empty WAL is therefore
    // a write that the hash comparison above would otherwise have missed.
    assert.equal(walBytes(corpus), 0,
      'the WAL holds frames after a read-only sweep: something wrote pages');
  } finally { removeTree(cwd); }
});

/**
 * The other side of the same boundary (owner ruling B4, 2026-08-20, plan §0.6).
 * The test above proves a SERVED read writes nothing. This one proves the
 * refusal path writes exactly one thing, that it is the audit record the
 * ruling names, and that it carries what the ruling says and nothing more.
 *
 * It is an equality on the CHANGED SET, not a "the log grew" check: a refusal
 * that also touched an item file, the index or a seen file would satisfy "the
 * log grew" and fail this. And the fixture already HAS an audit log — `add`
 * wrote a mutation record — so this compares CONTENT, not appearance.
 */
test('a refused request is recorded, and it is the only write', async () => {
  const cwd = project();
  const corpus = path.join(cwd, DIR_NAME);
  const before = snapshot(corpus);
  const h = await startUiChild(cwd);
  let token = '';
  try {
    token = await redeemNonce(h.port, h.nonce);
    const refused = await api(h, token, '/api/ping', { origin: 'https://evil.example' });
    assert.equal(refused.status, 403);
    assert.equal(await refused.text(), '');   // ruling A4, again, on the audited path
  } finally { await h.stop(); }

  try {
    const after = snapshot(corpus);
    const changed = Object.keys({ ...before, ...after })
      .filter((k) => before[k] !== after[k]).sort();
    assert.deepEqual(changed, ['.audit/audit.jsonl'],
      'a refusal wrote something other than the one audit record the ruling allows');

    const access = readAudit(corpus).filter((r) => r.kind === 'access');
    assert.equal(access.length, 1, 'one refused request, one record');
    const record = access[0]!;
    assert.equal(record.op, 'ui-refused');
    assert.deepEqual(record.refusal, {
      check: 'origin',
      status: 403,
      method: 'GET',
      route: '/api/ping',
      host: `127.0.0.1:${h.port}`,          // as submitted — and it MATCHED; the Origin is what failed
      origin: 'https://evil.example',        // the submitted value, kept where ruling 11 said it belongs
    });
    // The token is the secret the gate exists to protect. Asserted against the
    // whole serialized record, not against the fields we remembered to check.
    assert.ok(!JSON.stringify(record).includes(token),
      'the refusal record must never carry the token, in any form');
  } finally { removeTree(cwd); }
});
```

**What this proves and what it does not, stated here so a green run is not over-read.** It proves that
this corpus survived one full sweep of every registered read route with every byte intact, and that one
refused request added exactly one audit record and touched nothing else. It does not prove that a route
will not write against a corpus state this fixture does not contain — a self-heal that fires only on
corruption is the obvious example, and `Store.open` has one (§0.5). It does not prove anything about a
refusal shape this fixture does not exercise: **one** of the gate's four exits is measured here, and the
other three are covered for their status and their empty body but not for their record. Neither this
test nor Task 14's may be quoted as ruling any of that out.

- [ ] **Step 2: Run and see it fail**

Run: `node --test test/ui/server-e2e.test.ts`
Expected: FAIL — `src/ui/server.ts` does not exist.

- [ ] **Step 3: Implement `server.ts`**

```ts
// src/ui/server.ts
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import { resolveWorkspace, type Workspace } from '../core/workspace.ts';
import { VERSION } from '../core/version.ts';
import { readGitInfo } from './git-info.ts';
import { IdleMonitor, IDLE_MS } from './idle.ts';
import {
  apiCoverage, apiDecay, apiDoctor, apiGraph, apiHelp, apiInjected, apiItem, apiItems,
  apiRender, apiSelect, apiSessions, apiSimulate, apiStatus,
} from './read-model.ts';
import type { RefusalCheck } from '../core/audit.ts';
import { matchRoute, registerRoute, type ApiContext, type JsonResult } from './routes.ts';
import { mintToken, NonceStore, recordRefusal, TOKEN_HEADER, validateApiRequest } from './security.ts';
import { serveStatic } from './static.ts';

/** Ten seconds: the nonce that transits a process command line (spec §3). */
export const OPENER_NONCE_TTL_MS = 10_000;
/** Ten minutes: the nonce in a PRINTED url (--no-open / spawn fallback) — never on a command line. */
export const PRINTED_NONCE_TTL_MS = 600_000;

export interface UiServerOptions {
  cwd: string;
  port?: number;
  host?: string;
  idleMs?: number;
  onExit?: (reason: 'idle' | 'closed') => void;
  /** Test-only override for handoff nonce ttl; production callers omit it. */
  nonceTtlMs?: number;
}

export interface RunningUiServer {
  port: number;
  urlWithNonce(ttlMs: number): string;
  close(): Promise<void>;
}

const PUBLIC_DIR = path.join(import.meta.dirname, 'public');

function registerReadRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/select', json(apiSelect));
  registerRoute('GET', '/api/render', json(apiRender));
  registerRoute('GET', '/api/simulate', json(apiSimulate));
  registerRoute('GET', '/api/sessions', json(apiSessions));
  registerRoute('GET', '/api/status', json(apiStatus));
  registerRoute('GET', '/api/doctor', json(apiDoctor));
  registerRoute('GET', '/api/decay', json(apiDecay));
  registerRoute('GET', '/api/coverage', json(apiCoverage));
  registerRoute('GET', '/api/graph', json(apiGraph));
  registerRoute('GET', '/api/items', json(apiItems));
  registerRoute('GET', '/api/session/:session/injected', {
    kind: 'json',
    handle: (ctx) => apiInjected(ctx.ws, ctx.url, { session: ctx.params.session }),
  });
  registerRoute('GET', '/api/item/:id', {
    kind: 'json', handle: (ctx) => apiItem(ctx.ws, ctx.url, { id: ctx.params.id }),
  });
  registerRoute('GET', '/api/help/:topic', {
    kind: 'json', handle: (ctx) => apiHelp(ctx.ws, ctx.url, { topic: ctx.params.topic }),
  });
}

let routesRegistered = false;

function sendJson(res: ServerResponse, result: JsonResult): void {
  const body = JSON.stringify(result.body);
  res.writeHead(result.status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    // Deliberately NO CORS headers: their absence is the cross-origin defence (spec §2).
  });
  res.end(body);
}

/**
 * A refusal: the status line and NOTHING ELSE (owner ruling A4, plan §0.6).
 *
 * There is no `body` parameter, and that absence is the whole point. The gate's
 * `reason` is a developer-facing fixed literal that carries no submitted input
 * (ruling 11) and a comment on it says it is never rendered — but a comment
 * cannot stop a later task rendering it, and NOTHING CAN RENDER WHAT IS NEVER
 * SENT. A helper you cannot pass a reason to holds the property structurally.
 *
 * No content-type either: there is no content. `Cache-Control` stays, because a
 * cached refusal is still a refusal someone could serve twice.
 */
function sendRefusal(res: ServerResponse, status: number): void {
  res.writeHead(status, { 'cache-control': 'no-store' });
  res.end();
}

/** The FIRST value of a repeated header — the same value the gate judged. */
const headerFirst = (v: string | string[] | undefined): string | null =>
  v === undefined ? null : Array.isArray(v) ? v[0] ?? null : v;

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 64 * 1024) reject(new Error('body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export function startUiServer(options: UiServerOptions): Promise<RunningUiServer> {
  const host = options.host ?? '127.0.0.1';
  if (host !== '127.0.0.1') {
    // Refuse to start, not warn (spec §2.1): a bind beyond loopback exposes
    // the corpus to the network, and a warning is a property claim nobody reads.
    return Promise.reject(new Error(
      `mycontext ui: refusing to bind ${host} — the UI serves 127.0.0.1 only.`,
    ));
  }
  const ws = resolveWorkspace(options.cwd);
  if (!ws.projectRoot) {
    return Promise.reject(new Error('mycontext ui: no workspace here. Run `mycontext init` first.'));
  }
  const corpusRoot = ws.projectRoot;   // narrowed here so the refusal recorder below has a string
  const repoRoot = path.dirname(ws.projectRoot);
  const token = mintToken();
  const nonces = new NonceStore();
  const nonceTtl = options.nonceTtlMs;

  if (!routesRegistered) {
    registerReadRoutes();
    routesRegistered = true;
  }

  const server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      sendJson(res, { status: 500, body: { error: err instanceof Error ? err.message : String(err) } });
    });
  });

  const idle = new IdleMonitor(options.idleMs ?? IDLE_MS, () => {
    // On idle the server closes; open sockets (a stream, in plan 3) are
    // destroyed so close() completes and the page's next fetch fails, which
    // is what triggers the "server has exited" banner (no auto-reconnect).
    server.close(() => options.onExit?.('idle'));
    server.closeAllConnections();
  });

  /**
   * The ONE write this server performs, and then the status (plan §0.6,
   * rulings A4 and B4). Recorded BEFORE the response goes out, so a refusal
   * cannot be answered and then lost; `recordAudit` is a synchronous append,
   * not a read-modify-write.
   *
   * The `AuditWriteResult` is DISCARDED, exactly as the hooks discard theirs:
   * there is no one to tell, and telling the refused party would be the echo
   * ruling 11 removed. A log that has stopped being writable is discoverable
   * through `doctor`'s `audit_log_size` check.
   *
   * `url.pathname`, never `url.search`. Capping and the absent-versus-empty
   * distinction live in `recordRefusal` (§0.6), so every caller gets them.
   */
  function refuse(
    req: IncomingMessage, url: URL, gate: { status: number; check: RefusalCheck },
    res: ServerResponse,
  ): void {
    recordRefusal(corpusRoot, {
      check: gate.check,
      status: gate.status as 401 | 403,
      method: req.method ?? 'GET',
      route: url.pathname,
      host: headerFirst(req.headers.host),
      origin: headerFirst(req.headers.origin),
    });
    sendRefusal(res, gate.status);
  }

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const port = (server.address() as { port: number }).port;
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${port}`);

    if (!url.pathname.startsWith('/api/')) {
      const asset = serveStatic(url.pathname, PUBLIC_DIR);
      if (!asset) { res.writeHead(404, { 'cache-control': 'no-store' }); res.end(); return; }
      res.writeHead(asset.status, { 'content-type': asset.contentType, 'cache-control': 'no-store' });
      res.end(asset.body);
      return;
    }

    // Host/Origin are validated for EVERY /api request, handoff included; the
    // token check is what handoff alone is exempt from (it is how the page
    // first obtains the token).
    const gate = validateApiRequest(req as { headers: Record<string, string | string[] | undefined> },
      { token, port });
    if (url.pathname === '/api/handoff' && req.method === 'POST') {
      if (!gate.ok && gate.status !== 401) { refuse(req, url, gate, res); return; }
      let nonce: unknown;
      try { nonce = (JSON.parse(await readBody(req)) as { nonce?: unknown }).nonce; } catch { nonce = undefined; }
      if (typeof nonce !== 'string' || !nonces.redeem(nonce)) {
        sendJson(res, { status: 403, body: { error: 'invalid, expired or already-used handoff nonce' } });
        return;
      }
      sendJson(res, { status: 200, body: { token } });
      return;
    }
    if (!gate.ok) { refuse(req, url, gate, res); return; }

    if (url.pathname === '/api/ping' && req.method === 'GET') {
      idle.touch();
      sendJson(res, { status: 200, body: { ok: true } });
      return;
    }
    if (url.pathname === '/api/meta' && req.method === 'GET') {
      idle.touch();
      sendJson(res, {
        status: 200,
        body: { version: VERSION, projectRoot: ws.projectRoot, repoRoot, git: readGitInfo(repoRoot) },
      });
      return;
    }

    const match = matchRoute(req.method ?? 'GET', url.pathname);
    if (!match) { sendJson(res, { status: 404, body: { error: `no route ${req.method} ${url.pathname}` } }); return; }

    let body: unknown;
    if (req.method === 'POST') {
      try { body = JSON.parse(await readBody(req)); } catch { body = undefined; }
    }
    const ctx: ApiContext = { ws, repoRoot, url, params: match.params, body };

    if (match.handler.kind === 'stream') {
      // NOT idle.touch(): an open stream is not activity (spec §2). Plan 3's
      // stream route inherits this without remembering it.
      match.handler.handle(ctx, res);
      return;
    }
    idle.touch();
    sendJson(res, await match.handler.handle(ctx));
  }

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => {
      idle.touch();
      idle.start();
      const port = (server.address() as { port: number }).port;
      resolve({
        port,
        urlWithNonce: (ttlMs: number) =>
          `http://127.0.0.1:${port}/#${nonces.mint(nonceTtl ?? ttlMs)}`,
        close: () => new Promise<void>((done) => {
          idle.stop();
          server.close(() => { options.onExit?.('closed'); done(); });
          server.closeAllConnections();
        }),
      });
    });
  });
}

/** Main-module entry: what `test/ui/helpers.ts` spawns and what Task 15's command reuses. */
if (isMainEntry(import.meta.filename, process.argv[1])) {
  const argv = process.argv.slice(2);
  const flag = (name: string): string | null => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] ?? null : null;
  };
  const port = flag('port');
  const idleMs = flag('idle-ms');
  const nonceTtlMs = flag('nonce-ttl-ms');
  const host = flag('host');
  startUiServer({
    cwd: process.cwd(),
    port: port === null ? 0 : Number(port),
    ...(host === null ? {} : { host }),
    ...(idleMs === null ? {} : { idleMs: Number(idleMs) }),
    ...(nonceTtlMs === null ? {} : { nonceTtlMs: Number(nonceTtlMs) }),
    onExit: () => process.exit(0),
  }).then((running) => {
    console.log(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
  }).catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run the E2E suite and see it pass**

Run: `node --test test/ui/server-e2e.test.ts && npx tsc --noEmit`
Expected: PASS (8 tests). The idle test takes under a second (300ms window, 30ms poll).

**Prove the no-write assertion red before believing it** — the same discipline Task 14 Step 2 applies,
and for the same reason (`check-retired.ts` shipped a checker that could not fail). **Plant a write that
Task 14 cannot see**, so the two halves are shown to be different instruments rather than one test
twice: add `writeFileSync(path.join(ws.projectRoot!, 'state', 'probe.json'), '{}')` to `apiStatus`.
It binds nothing from the write list — `node:fs` is a bare specifier the static walk skips by design —
so `no-writes.test.ts` stays **green** while `the read surface changes not one byte of the corpus`
fails, naming the added `state/probe.json` in the diff. Record both outputs in the commit message body,
then revert and confirm `git status --porcelain` is empty. That pair is the evidence for §0.5's claim
that neither half subsumes the other.

**Prove the refusal pair red too, in both directions**, because a test that can only pass is the shape
this project keeps catching (§0.6, ruling B4). (i) Drop the `recordRefusal` call from `refuse()`:
`a refused request is recorded, and it is the only write` must fail on `access.length`, and Task 14's
exact-set assertion must fail as well, on the now-missing binding — that pair is the evidence that
deleting the ruled write is caught and not merely tolerated. (ii) Move the `recordRefusal` call up so it
runs on **every** request rather than on refusals: `the read surface changes not one byte of the corpus`
must fail, naming `.audit/audit.jsonl`, which is the evidence that keeping `.audit/` inside that
snapshot is what makes the scoping real rather than decorative. Record all four outputs, revert, and
confirm `git status --porcelain` is empty.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add src/ui/server.ts test/ui/helpers.ts test/ui/server-e2e.test.ts
git commit -m "feat(ui): http server with security gate, handoff nonce, ping, meta and idle exit

Carries the RUNTIME half of the no-writes enforcement (owner ruling
2026-08-20, plan §0.5): every read route is exercised against a real corpus
and the corpus is asserted byte-identical afterwards, with a separate
assertion that the WAL holds no frames. Proven red with a writeFileSync
plant in apiStatus that no-writes.test.ts stays green on; output in the task
record.

A refusal answers with its status code and NOTHING else -- no body, from a
helper with no body parameter, so a later task cannot put the reason back
(owner ruling A4, plan section 0.6). And a refusal is RECORDED: one `access`
audit record naming the check that refused and the submitted Host/Origin,
which is where ruling 11 said the submitted value belongs. That is the one
write this read-only surface performs; it is on the refusal path only, the
byte-identical assertion is scoped to the served-read path to say so, and
.audit/ stays inside its snapshot deliberately. Proven red four ways: the
write removed, the write made unconditional, and both halves of the static
pair; output in the task record."
```

---

## Task 14: The static import-graph test — **the enforcement of "no UI writes"**

This is the static half of the "no UI writes" enforcement (spec §6, §8's risk table): it turns *"the UI binds exactly the writers the owner ruled in, and no others"* from discipline into a property, checked before a single route exists to run. It must fail if anyone, in any later plan, binds a mutating function in a module under `src/ui/` — and equally if the one binding the owner *did* rule in disappears. **It is half, not the whole** — the runtime half is Task 13's byte-identical corpus assertion, and §0.5 records the 2026-08-20 ruling that put them side by side. **Since ruling B4 (§0.6) the ruled set is not empty**: it holds one member, and the assertion is an equality on the set rather than a check that it is empty, so a second write binding fails and so does deleting the one.

**Files:**
- Test: `test/ui/no-writes.test.ts`

**Interfaces:**
- Consumes: the server entry path `src/ui/server.ts`; the filesystem.
- Produces: the invariant plans 2 and 3 must design within — **their route modules live under `src/ui/` and are therefore inside the ban's scope.** A plan-2 screen that needs revision data uses `src/core/revision-log.ts` (Task 6), never `revision.ts`; a screen that needs anything from `mutate.ts` cannot exist as specified and must go back to the spec. **What the scoped ban does and does not catch there, said exactly:** a `src/ui/` module importing `stageRevision`/`promoteRevision`/`discardRevision` from `revision.ts` fails, and so does one importing `updateItem` through any chain. A `src/ui/` module importing `readLog` from `revision.ts` **passes** — the resolver places it in `revision-log.ts`, which is a reader, and the invariant is about writing, not about which file the read was spelled from. Task 6's boundary is therefore a design rule the plan keeps for its own reasons (a read surface should not load `mutate.ts` at all), and it is **not** what this test enforces.

### The unit of the ban is the SYMBOL, not the file — OWNER RULING

**This task previously banned two modules.** It asserted that neither `src/core/mutate.ts` nor
`src/core/revision.ts` appears in the server's runtime import graph, on the reasoning that a module
containing a writer puts a writer in reach. **That is now wrong, and a concrete case broke it.**

`src/core/revision-log.ts` (Task 6, merged) imports **one** symbol from `src/core/jsonl-log.ts`
(`core/revision-log.ts` · `import { readJsonlFile, type JsonlRow } from './jsonl-log.ts';` · ~2).
`jsonl-log.ts` also exports `appendJsonlLine`, `ensureLogDir` and `healTornTail` — three writers. Under
a module-level ban, Task 14 either fails against a module that only ever reads, or `jsonl-log.ts` gets
allow-listed.

**The owner ruled: the ban is symbol-aware.** The invariant is *"the UI cannot write"*, not *"the UI
cannot import a file that contains a writer."* **An allow-list was rejected**, and the reason is the
one this project keeps recording: a list of exemptions grows, and every entry becomes a hole that
nobody re-examines. `src/core/audit.ts` is the next module this would have hit, and it is larger.

The §0 table already states the general rule this is an instance of: *"An enforcement list names
**symbols**; a list of files or line numbers silently stops covering a symbol that moves."*

**A symbol ban is not weaker than the module ban where it mattered.** `revision.ts` itself imports
`updateItem` at runtime
(`core/revision.ts` · `import { updateItem, type MutationContext, type MutationResult } from './mutate.ts';` · ~7),
so a `src/ui/` module that binds `updateItem` through any chain still trips — for the real reason,
rather than by name. What changes is that `jsonl-log.ts`, which imports no writer, stops being
collateral damage.

### The SCOPE of the ban is `src/ui/` and its re-export reach — OWNER RULING, 2026-08-20

**The symbol ruling above was right and is unchanged. Its scope was not.** As first written, assertion 2
applied to *every* module reachable from `src/ui/server.ts`, which made it **red on day one**, before
`src/ui/read-model.ts` existed: `src/core/focus.ts` binds `recordAudit`, `src/core/seen-file.ts` binds
`appendJsonlLine`, and `src/core/audit.ts` binds it too — while `readFocus` and `readSeen`, the two
functions Tasks 8 and 9 actually call, contain **no write calls at all**. §0.5 carries the verification
and the citations. The whole-graph form failed on **guilt by co-location**: a fact about which functions
share a file, never a fact about whether the UI writes.

**The ban now applies to modules under `src/ui/`, and to the re-export chains their bindings resolve
through.** Concretely, for assertion 2:

- Every `import`/`export … from` statement **in a file under `src/ui/`** is checked. That is the whole
  directory, not only `server.ts` — a helper under `src/ui/` that binds a writer for a route to call is
  the exact thing this test exists to catch.
- Each binding is resolved through re-export chains to its **defining** module, wherever that lands.
  Importing `readFocus` from `focus.ts` passes; importing `setFocus` from the same file fails; importing
  `setFocus` laundered through a re-exporting module fails at the importer, naming `focus.ts`.
- **Modules outside `src/ui/` are not themselves checked for bindings.** `focus.ts` may go on binding
  `recordAudit`, because `focus.ts` is not the UI.

**The limitation this creates, stated in the task because it must not be left implicit.** A static
import walk can conclude exactly one thing: *the UI does not BIND a writer.* It can never conclude *the
UI does not write.* A core read function that writes internally is invisible to it, and **that class is
real in this codebase**: `Store.open` self-heals on corruption by deleting the database and both
journals (`core/store.ts` · `rmSync(dbPath, { force: true });` · ~345), which is why §0 routes this
server to `Store.openReadOnlyChecked` — a routing decision no import line discloses. Widening the walk
until it *looked* like it covered that case did not cover it; it only made the test red on facts that
were not the property. **The gap is closed by a different instrument, not a bigger regex:** Task 13's
E2E snapshots a real corpus, exercises every read route and asserts it is byte-identical afterwards.
Read the two together, and neither alone.

**Rejected, so it is not reopened** (the full reasoning is in §0.5):

1. **Pinning the three `(module → writer)` pairs as a set that must not change** — the allow-list under
   another name, churning with every unrelated change to `focus.ts`, `seen-file.ts` or `audit.ts`, and
   still proving nothing about writing.
2. **Extracting the readers out of `focus.ts` / `seen-file.ts` / `audit.ts`** as Task 6 did for
   `revision-log.ts` — structurally purest, but it buys only what the runtime half already proves, and
   `audit.ts` is the largest of the three and sits on the injection path.

**The banned set, as (defining module → symbols).** Every entry writes to disk or to SQLite. The
pairing is deliberate: the module named is where the symbol is **defined**, which is where the resolver
below lands after following re-export chains — not necessarily where an importer names it.

| Defining module | Banned symbols | What they write |
|---|---|---|
| `src/core/mutate.ts` | `createItem`, `updateItem`, `supersedeItem` | item files and the index |
| `src/core/relations.ts` | `linkItems`, `unlinkItems` | item files (§0: these two are **not** in `mutate.ts`) |
| `src/core/revision.ts` | `stageRevision`, `promoteRevision`, `discardRevision` | the revision log; `promote` also calls `updateItem` |
| `src/core/jsonl-log.ts` | `appendJsonlLine`, `ensureLogDir`, `healTornTail` | an append, a `mkdir` plus a `.gitignore`, and a truncating heal |
| `src/core/audit.ts` | `recordAudit` | the audit log |
| `src/core/focus.ts` | `writeFocus`, `clearFocus`, `setFocus`, `unsetFocus` | the focus state file |
| `src/core/seen-file.ts` | `appendSeen` | the per-session seen file |

The last three rows are the point of the ruling: `audit.ts`, `focus.ts` and `seen-file.ts` are modules
**this plan's read model imports on purpose** — `readFocus` in Task 8, `readSeen`/`seenIds` in Task 9 —
and each also exports a writer. A module ban would have to exempt all three wholesale. **Those same
three rows are why the scope ruling above exists**: they are the modules whose *own* internal bindings
made the whole-graph form unsatisfiable, and the rows survive unchanged because the ban still fires the
moment a `src/ui/` module names one of these symbols.

### The one ruled write, and why the assertion is an EQUALITY — OWNER RULING B4, 2026-08-20

**The ban's set is no longer empty, and pretending otherwise would be the defect this task exists to
prevent.** Ruling B4 (§0.6) records a refused request in the audit log — the check that refused and the
submitted `Host`/`Origin` — and puts the implementation in `src/ui/security.ts`. `recordAudit` is on the
table above. So the ban as first written and that ruling cannot both stand, and one of them has to give
in public rather than in silence.

**What did not give: the allow-list stayed rejected.** §0.5 rejected an exemption list twice, for the
reason this project keeps re-recording — a list of exemptions grows, and every entry becomes a hole
nobody re-examines. What changed instead is the *form of the assertion*:

| | Before | After |
|---|---|---|
| The claim | the set of write bindings under `src/ui/` is **empty** | the set of write bindings under `src/ui/` is **exactly** `{ src/ui/security.ts → recordAudit }` |
| A second write binding | fails | fails |
| Deleting the ruled write | passes | **fails** |

**That last row is the whole reason for the shape.** An allow-list is a list of things a test agrees not
to look at, and it can only ever get longer. An exact set is a pinned fact that fails in *both*
directions: adding a write fails, and so does removing the one the owner ruled in — which is what keeps
ruling B4 applied rather than merely recorded, exactly as `check:retired` does for a §0 row. A second
entry cannot be added without an owner ruling and a §0 row, because the diff that adds it is a diff to
this constant and reads as one.

**What it still does not prove.** Nothing here changes the limitation above: the exact set is a fact
about which symbols are BOUND, never about when they are CALLED. That `recordAudit` is called only on
the refusal path — never on a served read — is a runtime fact, and Task 13 is where it is proved, by two
tests that hold the boundary from opposite sides.

### Re-export chains: a writer must not be laundered through a third module

**This is real in this repository, not hypothetical.** `src/core/revision.ts` re-exports
`src/core/revision-log.ts`'s reads, and it does it in the **two-statement** form that an
`export … from` regex does not see at all:

```ts
import {
  foldLog, pendingRevisionCounts, readLog, revisionDir, revisionLogPath, REVISION_PROTOCOL,
  type LogLine, type RevisionChanges, type RevisionRecord,
} from './revision-log.ts';
// … seventy lines later …
export {
  foldLog, pendingRevisionCounts, readLog, revisionDir, revisionLogPath, REVISION_PROTOCOL,
};
```

So the analyser resolves an imported binding to its **defining** module through three chain shapes, and
refuses rather than guessing when it cannot:

1. `export { X } from './m.ts'` / `export { X as Y } from './m.ts'` — the one-statement form.
2. `import { X } from './m.ts'` … `export { X };` — the two-statement form above, which is the one
   that actually occurs here.
3. A local declaration (`export function X`, `export const X`, `export class X`) — the chain ends.

**`export * from` and `import * as ns from` are refused inside the graph**, both for the same reason:
neither leaves a per-symbol fact for the resolver to check, and a star form the analyser silently
treats as "no symbols" is a checker that passes by looking at nothing. `INV-nothing-is-dropped-silently`
applies to the checker itself. Refusing them constrains the UI's own new code, which can be written
without either.

**An unresolvable binding fails the test.** If a module under `src/ui/` imports `X` from `./m.ts` and
`m.ts` neither declares nor re-exports `X`, the analyser reports it and fails. A symbol it cannot place
is a hole in the analysis, not a pass.

### Everything static, no parser dependency

Zero runtime dependencies and `erasableSyntaxOnly`: the analyser is plain Node reading source with
regexes, no parser library. That is sound only because the graph it walks contains **no dynamic escape
hatches**, which is assertion 3 below — no `require(` and no dynamic `import(` in any reachable module.
Type-only imports (`import type`, and per-specifier `type X`) are erased by `verbatimModuleSyntax` and
are skipped: a type cannot be called.

**Two scopes, deliberately different, and the test says which is which.** Assertion 2 — the ban — is
scoped to `src/ui/` and the chains its bindings resolve through, per the ruling above. Assertions 1 and
3 — no star forms, no dynamic escape hatches — stay over the **whole reachable graph**, because they are
not the ban: they are what makes reading source with a regex a sound way to answer any question at all.
Verified against `master` while writing this amendment: `src/` contains **zero** occurrences of
`require(`, dynamic `import(`, `export *` and `import * as`, so the wider scope costs nothing today and
fails loudly the day something reaches for one.

- [ ] **Step 1: Write the test**

```ts
// test/ui/no-writes.test.ts
/**
 * The STATIC half of the no-writes enforcement (spec §2, §6): the write
 * symbols bound under src/ui/ are exactly the ones the owner ruled in, and
 * there is one. This is the mechanism behind the §8 risk row
 * "a UI write silently voids the user's Bash deny rules" — the deny rules
 * match command STRINGS, an HTTP route is not a command string, so the only
 * acceptable number of write-capable routes is zero.
 *
 * The unit of the ban is the SYMBOL, not the file (owner ruling, Task 14).
 * `revision-log.ts` imports only `readJsonlFile` from `jsonl-log.ts`, which
 * also exports three writers; `focus.ts` and `seen-file.ts` are imported for
 * `readFocus` and `readSeen` and also export writers. Banning the files would
 * need an allow-list, and an allow-list grows into a row of holes nobody
 * re-examines.
 *
 * The SCOPE of the ban is src/ui/ and the re-export chains its bindings
 * resolve through (owner ruling 2026-08-20, plan §0.5). Applied to the whole
 * reachable graph it was red on day one, on focus.ts binding recordAudit and
 * seen-file.ts binding appendJsonlLine — while readFocus and readSeen, the
 * functions the read model actually calls, write nothing. That is guilt by
 * co-location, not evidence that the UI writes.
 *
 * Bindings are resolved to the module that DEFINES them, through re-export
 * chains, because `revision.ts` re-exports `revision-log.ts`'s reads in the
 * two-statement `import … ; export { … };` form. A resolver that only knew
 * `export … from` would see nothing there.
 *
 * SINCE OWNER RULING B4 (2026-08-20, plan §0.6) THE RULED SET IS NOT EMPTY.
 * A refused request is recorded in the audit log, and that binding lives in
 * src/ui/security.ts. Assertion 2 is therefore an EQUALITY on the set of
 * write bindings, not an emptiness check: a second one fails, and so does
 * deleting this one. An allow-list was rejected twice (plan §0.5) and is not
 * what this is — a list of exemptions only grows, while an exact set fails in
 * both directions and cannot be extended without a diff that reads as one.
 *
 * WHAT THIS CANNOT SEE, said plainly so a green run is not over-read. It
 * proves WHICH symbols a module under src/ui/ BINDS. It cannot prove when
 * they are CALLED, nor that the UI does not otherwise WRITE: a core read
 * function that writes internally, or a
 * module that wrote at import time, leaves no import line to look at. That is
 * not hypothetical here — Store.open self-heals on corruption by rmSync-ing
 * the database and both journals, which is why this server is routed to
 * Store.openReadOnlyChecked. The invariant itself is proved at RUNTIME, in
 * test/ui/server-e2e.test.ts: `the read surface changes not one byte of the
 * corpus`. Neither test may be quoted for the other's claim.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const abs = (name: string): string => path.join(REPO, ...name.split('/'));
const rel = (file: string): string => path.relative(REPO, file).split(path.sep).join('/');

const ENTRY = abs('src/ui/server.ts');

/**
 * The ban's scope: a file is IN it when it lives under src/ui/. Chains
 * resolved OUT of it (into src/core/) are followed to place a symbol — that
 * is the "re-export reach" — but a core module's own bindings are not
 * themselves checked. Owner ruling 2026-08-20; the reasoning and the
 * limitation it accepts are in the header above and in plan §0.5.
 */
const UI_PREFIX = 'src/ui/';
const isUiModule = (file: string): boolean => rel(file).startsWith(UI_PREFIX);

/** (defining module → the symbols in it that write). The table in the plan. */
const WRITERS: Record<string, string[]> = {
  'src/core/mutate.ts': ['createItem', 'updateItem', 'supersedeItem'],
  'src/core/relations.ts': ['linkItems', 'unlinkItems'],
  'src/core/revision.ts': ['stageRevision', 'promoteRevision', 'discardRevision'],
  'src/core/jsonl-log.ts': ['appendJsonlLine', 'ensureLogDir', 'healTornTail'],
  'src/core/audit.ts': ['recordAudit'],
  'src/core/focus.ts': ['writeFocus', 'clearFocus', 'setFocus', 'unsetFocus'],
  'src/core/seen-file.ts': ['appendSeen'],
};

const isWriter = (module: string, symbol: string): boolean =>
  (WRITERS[module] ?? []).includes(symbol);

/**
 * The write bindings under src/ui/ that the owner has ruled in — the WHOLE
 * set, in the exact form assertion 2 builds. Owner ruling B4, 2026-08-20,
 * plan §0.6: a refused request is recorded in the audit log with the check
 * that refused and the submitted Host/Origin, and that is the one write this
 * read-only surface performs.
 *
 * This is NOT an allow-list. An allow-list is a set the test agrees not to
 * look at, and it only grows. This is an EQUALITY: adding a second write
 * binding fails, and so does deleting this one — which is what keeps the
 * ruling applied instead of merely recorded. Extending it takes an owner
 * ruling and a plan §0 row, and the diff that extends it is a diff to this
 * constant, which reads as exactly what it is.
 *
 * It says nothing about WHEN recordAudit is called. That it runs only on the
 * refusal path and never on a served read is proved in
 * test/ui/server-e2e.test.ts, by two tests holding the boundary from opposite
 * sides.
 */
const RULED_WRITES = [
  'src/ui/security.ts binds recordAudit (defined in src/core/audit.ts)',
];

/**
 * One static `import`/`export … from` statement. Whole-statement `import type`
 * and `export type` are excluded by the negative lookahead; a per-specifier
 * `type X` is dropped in `parseClause`.
 */
const STATEMENT =
  /(?:^|\n)[ \t]*(import|export)[ \t]+(?!type\b)([\s\S]*?)[ \t]*from[ \t]*['"]([^'"]+)['"]/g;

function parseClause(clause: string): {
  named: { exported: string; local: string }[]; star: boolean;
} {
  if (/^\s*\*/.test(clause)) return { named: [], star: true };
  const braces = /\{([\s\S]*)\}/.exec(clause);
  if (braces === null) return { named: [], star: false };
  const named: { exported: string; local: string }[] = [];
  for (const piece of braces[1]!.split(',')) {
    const spec = piece.trim();
    if (spec === '' || /^type\b/.test(spec)) continue; // erased at runtime
    const as = /^(\S+)\s+as\s+(\S+)$/.exec(spec);
    if (as) named.push({ exported: as[1]!, local: as[2]! });
    else named.push({ exported: spec, local: spec });
  }
  return { named, star: false };
}

/** Every module reachable from `entry`, with its source. */
function graph(entry: string): Map<string, string> {
  const files = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (files.has(file)) continue;
    const source = readFileSync(file, 'utf8');
    files.set(file, source);
    for (const m of source.matchAll(STATEMENT)) {
      const spec = m[3]!;
      if (!spec.startsWith('.')) continue; // node: builtins; the project has no bare deps
      queue.push(path.resolve(path.dirname(file), spec));
    }
  }
  return files;
}

/**
 * The module that DEFINES `symbol`, following re-export chains. `null` when
 * the chain cannot be followed — which every caller treats as a failure, never
 * as an absence.
 */
function definedIn(
  module: string, symbol: string, read: (f: string) => string, seen = new Set<string>(),
): string | null {
  const key = `${module}#${symbol}`;
  if (seen.has(key)) return null; // a cycle: refuse rather than loop
  seen.add(key);
  const text = read(module);
  const declared = new RegExp(
    `^\\s*(?:export\\s+)?(?:async\\s+)?(?:function|const|let|class)\\s+${symbol}\\b`, 'm');

  // 1. `export { X } from './m.ts'` / `export { X as Y } from './m.ts'`.
  for (const m of text.matchAll(STATEMENT)) {
    if (m[1] !== 'export') continue;
    const hit = parseClause(m[2]!).named.find((n) => n.local === symbol);
    if (hit) return definedIn(path.resolve(path.dirname(module), m[3]!), hit.exported, read, seen);
  }

  // 2. `import { X } from './m.ts'` … `export { X };` — the two-statement
  //    form `revision.ts` actually uses.
  const bare = [...text.matchAll(/(?:^|\n)[ \t]*export[ \t]*\{([^}]*)\}[ \t]*;/g)];
  const laundered = bare.some((m) => m[1]!.split(',').some(
    (p) => p.trim() === symbol || p.trim().endsWith(` as ${symbol}`)));
  if (laundered && !declared.test(text)) {
    for (const m of text.matchAll(STATEMENT)) {
      if (m[1] !== 'import') continue;
      const hit = parseClause(m[2]!).named.find((n) => n.local === symbol);
      if (hit) return definedIn(path.resolve(path.dirname(module), m[3]!), hit.exported, read, seen);
    }
  }

  // 3. Declared here: the chain ends.
  return declared.test(text) ? module : null;
}

test('src/ui/ binds exactly the write symbols the owner ruled in, and no others', () => {
  const files = graph(ENTRY);
  const read = (f: string): string => files.get(f) ?? readFileSync(f, 'utf8');

  // 1. No star forms: neither leaves a per-symbol fact to check.
  const stars: string[] = [];
  for (const [file, text] of files) {
    for (const m of text.matchAll(STATEMENT)) {
      if (!m[3]!.startsWith('.')) continue;
      if (parseClause(m[2]!).star) stars.push(`${rel(file)}: ${m[1]} ${m[2]!.trim()} from '${m[3]}'`);
    }
  }
  assert.deepEqual(stars, [],
    'star imports/re-exports inside the UI graph: the symbol resolver cannot see through them');

  // 2. The ban, resolved through re-export chains to the DEFINING module.
  //    SCOPED to src/ui/ (owner ruling 2026-08-20, §0.5): the question is
  //    whether the UI binds a writer, not whether a core module does. The
  //    chains are still followed OUT of src/ui/, so a writer laundered through
  //    a re-exporting module is caught at the importer and named at its home.
  //    A core read that writes INTERNALLY is invisible here by construction —
  //    that is Task 13's runtime assertion, not this one.
  const uiFiles = [...files].filter(([file]) => isUiModule(file));
  assert.ok(uiFiles.length > 0, 'no src/ui/ module in the graph — this test is scanning nothing');
  const bound: string[] = [];
  const unresolved: string[] = [];
  for (const [file, text] of uiFiles) {
    for (const m of text.matchAll(STATEMENT)) {
      const spec = m[3]!;
      if (!spec.startsWith('.')) continue;
      const target = path.resolve(path.dirname(file), spec);
      for (const { exported, local } of parseClause(m[2]!).named) {
        const home = definedIn(target, exported, read);
        if (home === null) {
          unresolved.push(`${rel(file)} imports ${exported} from ${spec}`);
          continue;
        }
        if (isWriter(rel(home), exported)) {
          bound.push(
            `${rel(file)} binds ${exported}${local === exported ? '' : ` as ${local}`} `
            + `(defined in ${rel(home)})`);
        }
      }
    }
  }
  assert.deepEqual(unresolved, [],
    'these bindings could not be traced to a defining module — an unplaced symbol is a hole in this '
    + 'analysis, not a pass');
  assert.deepEqual(bound.sort(), RULED_WRITES,
    'the write bindings under src/ui/ are not exactly the ruled set. MORE than RULED_WRITES: '
    + 'something new writes, and it needs an owner ruling and a plan §0 row, not an entry added '
    + 'here. FEWER: the ruled refusal record (plan §0.6) has been deleted, which is a ruling '
    + 'silently dropped. Either way this is NOT proof that the UI never writes — see the header, '
    + 'and test/ui/server-e2e.test.ts for the runtime half.');

  // 3. Soundness: no dynamic escape hatches inside the graph. Whole-graph on
  //    purpose, unlike assertion 2: this is not the ban, it is what makes
  //    reading source with a regex a sound way to answer anything.
  const dynamic: string[] = [];
  for (const [file, text] of files) {
    if (/\brequire\s*\(/.test(text)) dynamic.push(`${rel(file)}: require()`);
    if (/[^.\w]import\s*\(/.test(text)) dynamic.push(`${rel(file)}: dynamic import()`);
  }
  assert.deepEqual(dynamic, [], 'the static walk cannot see through these');

  // 4. The graph is real: it must contain the read model and the core
  //    selector, or this test is scanning nothing.
  assert.ok(files.has(abs('src/ui/read-model.ts')), 'read-model.ts is not in the graph');
  assert.ok(files.has(abs('src/core/select.ts')), 'select.ts is not in the graph');
});

test('every banned symbol is still exported by the module the ban names', () => {
  // A ban entry naming a symbol that has since moved stops covering it and
  // says nothing — the §0 defect this whole table exists to avoid ("linkItems
  // and unlinkItems moved to relations.ts"). This makes the list fail loudly
  // instead of quietly shrinking.
  const missing: string[] = [];
  for (const [module, symbols] of Object.entries(WRITERS)) {
    const text = readFileSync(abs(module), 'utf8');
    for (const symbol of symbols) {
      const exported = new RegExp(
        `^\\s*export\\s+(?:async\\s+)?(?:function|const|class)\\s+${symbol}\\b`, 'm');
      if (!exported.test(text)) missing.push(`${module} no longer exports ${symbol}`);
    }
  }
  assert.deepEqual(missing, [], 'the ban names symbols that are not there any more');
});

test('the resolver follows the two-statement re-export chain that actually exists', () => {
  // revision.ts imports readLog from revision-log.ts and re-exports it in a
  // separate `export { … };`. That is the shape an `export … from` regex
  // misses entirely, and it is why assertion 2 resolves rather than matches.
  const read = (f: string): string => readFileSync(f, 'utf8');
  assert.equal(
    definedIn(abs('src/core/revision.ts'), 'readLog', read),
    abs('src/core/revision-log.ts'),
    'readLog imported from revision.ts must resolve to revision-log.ts, not to revision.ts',
  );
});
```

- [ ] **Step 2: PROVE IT RED — with an `appendJsonlLine` import, not a `createItem` one**

**A checker that has never failed is a checker nobody has verified, and this project has already
shipped one that could not fail.** `scripts/check-retired.ts` tested each line against its own
declaration-block pattern after wrapping the line in the comment delimiters — *"a template that matches
for EVERY possible line, so the checker skipped the whole document and could not fail"*
(`scripts/check-retired.ts` · `for EVERY possible line, so the checker skipped the whole document and` · ~98).
It was caught only *"by reintroducing a real retired phrase and watching it pass: a checker is not
verified until it has been made red."* **Do not skip this step, and do not substitute reading the code
for running it.**

The violation to plant is **`appendJsonlLine`**, not `createItem`. `createItem` would have fired under
the old module ban too and therefore proves nothing about the change made here; `appendJsonlLine` lives
in `jsonl-log.ts`, a module the graph legitimately contains, so only a symbol-aware check can catch it.

Three plants, each run and each output recorded in the commit message body:

1. **Direct.** Add `import { appendJsonlLine } from '../core/jsonl-log.ts';` to `src/ui/read-model.ts`.
   Run: assertion 2 must name
   `src/ui/read-model.ts binds appendJsonlLine (defined in src/core/jsonl-log.ts)`. Remove it.
2. **Renamed.** Add `import { appendJsonlLine as append } from '../core/jsonl-log.ts';`.
   Run: assertion 2 must still fire, naming the export and the local alias. Remove it.
3. **Laundered through a re-export chain.** Create a scratch `src/ui/launder.ts` containing
   `export { appendJsonlLine } from '../core/jsonl-log.ts';`, import it from `read-model.ts`, and run.
   Assertion 2 must fire on the importer with `defined in src/core/jsonl-log.ts` — this is the
   assertion the module ban never made. Delete the scratch file.

**A fourth plant, in the other direction** (owner ruling B4, §0.6): **delete** the `recordAudit` import
from `src/ui/security.ts` and run. Assertion 2 must fail with **fewer** bindings than `RULED_WRITES`,
naming the ruled refusal record as missing. That is the run which shows this is an equality and not an
allow-list — a list of exemptions cannot fail this way, and a ruling nothing can fail on is a ruling
that will be dropped by the first person who finds the write inconvenient. Restore it.

**All four plants go in `src/ui/`, because that is where the ban applies** (owner ruling 2026-08-20).
The same import added to a module in `src/core/` is deliberately **not** caught, and that is the scope
working as ruled rather than a hole: what covers that direction is Task 13's runtime assertion, whose
own red-proof plants a `writeFileSync` the static test cannot see. Run the pair once and the two halves
have each been shown to fail on something the other misses.

Then run once more against a clean tree: PASS. `git status --porcelain` must be empty before Step 3.

- [ ] **Step 3: Run the whole suite**

Run: `npm test && npx tsc --noEmit`
Expected: green.

- [ ] **Step 4: Commit**

```bash
git add test/ui/no-writes.test.ts
git commit -m "test(ui): symbol-level import-graph proof of exactly which writers src/ui/ binds

The ban is per SYMBOL, resolved through re-export chains to the defining
module, so jsonl-log.ts, focus.ts and seen-file.ts stay importable for their
read halves without an allow-list. Its scope is src/ui/ and that reach: a
core module's own bindings are not the UI's, and the whole-graph form was
red on day one against focus.ts and seen-file.ts (owner ruling 2026-08-20,
plan section 0.5).

The set is an EQUALITY, not an emptiness check, and it holds one member: the
refusal record the owner ruled in on 2026-08-20 (plan section 0.6), bound in
src/ui/security.ts. An allow-list was rejected twice; an exact set fails in
both directions, so deleting the ruled write is caught too.

Proven red four ways before committing: a direct appendJsonlLine import, a
renamed one, one laundered through a re-exporting module, and the ruled
refusal binding deleted. Output recorded in the task record; tree clean
before commit.

This is the static half. The runtime half is in test/ui/server-e2e.test.ts."
```

**The scope question this task used to carry is answered.** The blockquoted OPEN QUESTION that stood
here — whether the ban should stay whole-graph or narrow to `src/ui/` — was resolved by the owner on
**2026-08-20** in favour of narrowing, with a runtime assertion added beside it. §0.5 is the correction
log entry: what was red and why, the two halves as ruled, the alternatives rejected (pinning the
`(module → writer)` pairs; extracting readers out of `focus.ts` / `seen-file.ts` / `audit.ts`), and the
limitation the static half accepts. **Task 14 is implementable as written; nothing here is waiting on an
answer.**

---

## Task 15: `open.ts` and the `mycontext ui` command

**Files:**
- Create: `src/ui/open.ts`
- Create: `src/cli/commands/ui.ts`
- Modify: `src/cli/commands/index.ts` (add `import './ui.ts';`)
- Test: `test/ui/open.test.ts`

**Interfaces:**
- Consumes: `startUiServer`, `OPENER_NONCE_TTL_MS`, `PRINTED_NONCE_TTL_MS` (Task 13), `registerCommand` (`registry.ts:34`).
- Produces:
  - `openBrowser(url: string, platform?: NodeJS.Platform, spawnFn?: typeof spawn): { command: string; args: string[] } | null` — returns what it spawned (for tests and for the fallback decision), `null` when the spawn failed. **This is the first `child_process` use in `src/`** — there were none before (verified by grep); zero dependencies is intact, "zero moving parts" is not, and this comment says so in the module rather than letting a reader assume it (spec §3).
  - The `ui` command: `mycontext ui [--port N] [--no-open]`, registered via `registerCommand` (the name is neither registered nor shadowed — `registry.ts:30-32`). The command starts the server in-process; the CLI main sets `process.exitCode` and never calls `process.exit` (`cli/index.ts:761-762`), so the live server keeps the event loop — and the process — alive until idle exit or Ctrl-C.

Token-channel rules, restated where they are implemented: the **spawned** URL carries a 10-second nonce (`OPENER_NONCE_TTL_MS`); the **printed** URL (`--no-open`, or fallback when the spawn fails) carries a `PRINTED_NONCE_TTL_MS` nonce; the token itself appears in neither, and never on any process command line.

- [ ] **Step 1: Write the failing test**

```ts
// test/ui/open.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openBrowser } from '../../src/ui/open.ts';

function fakeSpawn(): { calls: { command: string; args: string[] }[]; fn: any } {
  const calls: { command: string; args: string[] }[] = [];
  return {
    calls,
    fn: (command: string, args: string[]) => {
      calls.push({ command, args });
      return { unref() {}, on() {} };
    },
  };
}

test('win32 spawns cmd /c start with an empty title argument', () => {
  const { calls, fn } = fakeSpawn();
  const result = openBrowser('http://127.0.0.1:1/#n', 'win32', fn);
  assert.deepEqual(result, { command: 'cmd', args: ['/c', 'start', '', 'http://127.0.0.1:1/#n'] });
  assert.equal(calls.length, 1);
});

test('darwin uses open, linux uses xdg-open', () => {
  const { fn } = fakeSpawn();
  assert.equal(openBrowser('u', 'darwin', fn)?.command, 'open');
  assert.equal(openBrowser('u', 'linux', fn)?.command, 'xdg-open');
});

test('a spawn failure returns null — never a throw, never a hang (spec §3)', () => {
  const result = openBrowser('u', 'linux', () => { throw new Error('ENOENT'); });
  assert.equal(result, null);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/ui/open.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `open.ts`**

```ts
// src/ui/open.ts
import { spawn } from 'node:child_process';

/**
 * THE FIRST child_process USE IN src/. There were none before this module
 * (spec §3 says so and it was re-verified by grep at implementation time).
 * Zero runtime DEPENDENCIES is intact; "zero moving parts" is not, and this
 * comment exists so nobody assumes otherwise.
 *
 * The URL handed to this function carries a one-shot ~10-second handoff
 * nonce, never the token: on Windows the command line below is readable by
 * every local account for the lifetime of the spawn (spec §2 point 4), which
 * is exactly why the token must not be in it.
 *
 * The empty '' after `start` is the TITLE argument — `start` would otherwise
 * consume the quoted URL as a window title and open nothing (spec §3).
 */
export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
  spawnFn: typeof spawn = spawn,
): { command: string; args: string[] } | null {
  const [command, args] =
    platform === 'win32' ? ['cmd', ['/c', 'start', '', url] as string[]]
    : platform === 'darwin' ? ['open', [url]]
    : ['xdg-open', [url]];
  try {
    const child = spawnFn(command, args, { stdio: 'ignore', detached: true });
    child.unref();
    return { command, args };
  } catch {
    return null; // the caller prints the URL instead — never an error, never a hang
  }
}
```

- [ ] **Step 4: Implement the command**

```ts
// src/cli/commands/ui.ts
import type { Workspace } from '../../core/workspace.ts';
import { openBrowser } from '../../ui/open.ts';
import {
  OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS, startUiServer,
} from '../../ui/server.ts';
import { flag, hasFlag, registerCommand, type Emit } from './registry.ts';

/**
 * Read-only web UI (web-ui spec). The server binds 127.0.0.1 only and exits
 * after 15 idle minutes — idle counts /api requests other than a stream, so
 * a forgotten background tab does not hold it up. Every write shown in the
 * UI is composed and pasted into the user's own shell; none executes here.
 */
function cmdUi(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  let port: number;
  try {
    const raw = flag(args, 'port');
    port = raw === null ? 0 : Number(raw);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      out(`my_context: --port must be an integer 0-65535 (got ${JSON.stringify(raw)})`);
      return 1;
    }
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
  const noOpen = hasFlag(args, 'no-open');

  // The server outlives this function: runCli returns, the CLI main sets
  // process.exitCode without calling process.exit (cli/index.ts:761-762),
  // and the listening socket keeps the event loop alive until idle exit.
  startUiServer({ cwd, port, onExit: () => process.exit(0) })
    .then((running) => {
      if (noOpen) {
        out(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
        return;
      }
      const spawned = openBrowser(running.urlWithNonce(OPENER_NONCE_TTL_MS));
      if (spawned === null) {
        // Fallback IS the --no-open path (spec §3): print, never error.
        out(`mycontext ui: could not open a browser — visit ` +
          `${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
      } else {
        out(`mycontext ui: serving on 127.0.0.1:${running.port} (idle exit after 15 minutes)`);
      }
    })
    .catch((err) => {
      out(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
  return 0;
}

registerCommand({
  name: 'ui',
  usage: 'ui [--port N] [--no-open]',
  summary: 'read-only web UI on 127.0.0.1 — preview, coverage, reports',
  run: cmdUi,
});
```

Add to `src/cli/commands/index.ts`, in alphabetical position:

```ts
import './ui.ts';
```

Add a registration test (append to `test/ui/open.test.ts`):

```ts
import '../../src/cli/commands/index.ts';
import { COMMANDS } from '../../src/cli/commands/registry.ts';

test('mycontext ui is a registered command with the documented flags in its usage', () => {
  const def = COMMANDS.get('ui');
  assert.ok(def);
  assert.match(def!.usage, /--port/);
  assert.match(def!.usage, /--no-open/);
});
```

- [ ] **Step 5: Run the tests, the suite, and the typecheck**

Run: `node --test test/ui/open.test.ts && npm test && npx tsc --noEmit`
Expected: green. Note the no-writes test (Task 14) still passes: `cmd/ui.ts` imports `server.ts`, but the graph walked starts AT `server.ts`, and `server.ts` does not import the CLI. `src/cli/commands/ui.ts` is also outside the ban's `src/ui/` scope (§0.5) — it is a CLI command, and CLI commands are allowed to write.

- [ ] **Step 6: Commit**

```bash
git add src/ui/open.ts src/cli/commands/ui.ts src/cli/commands/index.ts test/ui/open.test.ts
git commit -m "feat(cli): mycontext ui command with per-platform browser opening and printed-URL fallback"
```

---

## Task 16: The app shell — bootstrap, heartbeat, i18n, router, exit banner

> **Mockup — the specification for this task** (§0.2), `docs/design/web-ui-mockup.html`, third pass:
> a top bar (`header.top`) carrying a focus picker (`#focuspop`), a session picker (`#sesspop`), a
> zero-data toggle (`#empty`), a language button (`#lang`) and a theme button (`#theme`); a **four-group
> rail** (`nav.rail`) grouped **by tense** — `nav.inj` *"Injection — what arrives"*, `nav.ev`
> *"Evidence — why it did or didn't"*, `nav.ch` *"Change — composed, never run"*, `nav.read` *"Read"*;
> a `<main class="body">` holding **21** `data-p` sections; a global **item detail pane**
> (`aside.pane#pane`); a **provenance bar** (`div.prov#prov`); a footer strip (`footer.strip`); and the
> exit banner this plan needed and the first pass lacked — `<div class="banner" id="exited">` with
> `ex.msg` and `ex.ok`. Its CSS is already written in logical properties (`padding-inline`,
> `margin-block-start`, `inline-size`) with one deliberate physical exception that names its own mirror
> (`td.stale` / `[dir="rtl"] td.stale`), so this plan's rule and the mockup agree. **Two things it still
> does not answer are open questions, not licence:** the heartbeat, and an accessible name for the
> `א/A` language button (§0.4, Task 1 Step 3).
>
> **Superseded caution, recorded rather than deleted:** this blockquote used to warn that the mockup had
> *"a global search box"* that was decoration, opened on Status, showed no focus, and had *"no exit
> banner, heartbeat or language switch"*. **None of that describes the file on disk.** It described the
> first pass, and `docs/design/web-ui-mockup.md`'s divergence table still does too (§0.4 item 2).

Browser code is plain `.js` ES modules (no types — the browser cannot strip them). The pure logic lives in `lib/` modules that `node --test` imports directly; the DOM glue is thin and, per spec §6, untested — the test file says so.

**Files:**
- Create: `src/ui/public/lib/bootstrap.js`, `src/ui/public/lib/heartbeat.js`, `src/ui/public/lib/i18n.js`
- Replace: `src/ui/public/index.html`, `src/ui/public/styles.css` (the Task 12 placeholders)
- Create: `src/ui/public/app.js`
- Test: `test/ui/viewmodel.test.ts` (starts here; Tasks 17-19 extend it)

**Interfaces:**
- Consumes: `POST /api/handoff`, `GET /api/ping`, `GET /api/sessions`, `GET /api/meta`, the string tables (Task 1).
- Produces (screens in Tasks 17-19, and plans 2/3's screens, use these):
  - `bootstrap.js`: `extractNonce(hash: string): string | null` (pure), and `exchangeNonce(fetchFn, nonce): Promise<string | null>`.
  - `heartbeat.js`: `shouldPing(visibilityState: string): boolean` (pure — the §2 rule in one line), `startHeartbeat(doc, pingFn, intervalMs)`.
  - `i18n.js`: `pickLanguage(stored, navigatorLang): 'en' | 'he'` (pure), `t(strings, key, subs, doc?): Node[]` (**the only renderer** — it parses Task 1's three run markers and returns nodes for *every* key, marked or not; a missing key **throws**, and so does a missing substitution, so neither a blank nor a visible `{brace}` can reach the screen), `tFlat(strings, key, subs): string` (the same parse, then **deliberately** flattened, for attribute and text-only sinks), `applyLanguage(documentEl, table)` sets `<html dir>` and `lang` (spec §3).

    **`t()` returns nodes because it cannot do otherwise — owner ruling A1, 2026-08-20 (§0.6).** A
    string cannot carry an element, and **all three markers build one** — a plain `{name}` builds an
    isolated `span.v`, not a bare run of text (§0.7). The mockup's header comment records the bug this
    prevents: capturing a translated string and assigning it with
    `textContent` *"flattens just as thoroughly … the seven `data-t` elements holding `.m` spans lost
    them on the first toggle and never got them back"*, leaving *"English isolated and Hebrew not,
    exactly backwards"*. And the string form could not even see the monospace **value** slot: its
    `\w`-based pattern excludes the colon, so `{mv:branch}` matched nothing and would have reached the
    screen with its braces showing. **Callers append — `el.append(...ctx.t(key, vals))` — everywhere,
    including Tasks 17-19 and plans 2 and 3.** The one exception is a sink that cannot hold an element
    at all, and it takes `tFlat` and says so at the call site.
  - `app.js`: `window.myctx = { api(path): Promise<any>, t(key, subs): Node[], tFlat(key, subs): string, session(): string | null | 'cold', onSessionChange(fn), navigate(hash) }` — the screen contract. `api()` adds the token header; any network failure (server gone) renders the `app.serverExited` banner and **does not reconnect** (spec §2: silent reconnection would reintroduce the daemon by another name). **A refused request answers with a status and no body at all** (Task 13, ruling A4), so `api()` must not assume a failure carries one.

- [ ] **Step 1: Write the failing tests for the pure logic**

```ts
// test/ui/viewmodel.test.ts
/**
 * Pure browser-module logic, tested in Node. THE LIMIT, stated rather than
 * papered over (spec §6): the DOM rendering in app.js and screens/*.js has no
 * test — that would need a browser dependency this project does not have. A
 * green run here verifies the view-models, not the pixels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('extractNonce reads the fragment and rejects junk', async () => {
  const { extractNonce } = await import('../../src/ui/public/lib/bootstrap.js');
  assert.equal(extractNonce('#abc123'), 'abc123');
  assert.equal(extractNonce(''), null);
  assert.equal(extractNonce('#'), null);
  assert.equal(extractNonce('#not hex!'), null);
});

test('shouldPing is the visibility rule and nothing else', async () => {
  const { shouldPing } = await import('../../src/ui/public/lib/heartbeat.js');
  assert.equal(shouldPing('visible'), true);
  assert.equal(shouldPing('hidden'), false);
  assert.equal(shouldPing('prerender'), false);
});

/**
 * `t()` returns NODES (owner ruling A1, §0.6). The stand-in `doc` is why this
 * runs under `node --test` at all: `t()` touches nothing on the document but
 * the two factory methods, so two methods are all a test has to supply.
 */
test('t() returns nodes, and each marker builds the element the grammar names', async () => {
  const { t } = await import('../../src/ui/public/lib/i18n.js');
  const doc = {
    createTextNode: (text) => ({ kind: 'text', textContent: text }),
    createElement: (tag) => ({ kind: 'element', tag, className: '', textContent: '' }),
  };
  const strings = {
    'a.plain': 'hello {name}, {n} items',
    'a.mono': 'run {m:mycontext ui} first',
    'a.monoValue': 'in sync with origin/{mv:branch}',
  };
  const plain = t(strings, 'a.plain', { name: 'x', n: 3 }, doc);
  assert.deepEqual(plain.map((n) => n.textContent), ['hello ', 'x', ', ', '3', ' items']);
  // A plain slot is an ISOLATED ELEMENT — span.v — and not a bare run of text
  // (§0.7). `.v` carries `unicode-bidi: isolate` and nothing else, so a count
  // or an id keeps its own direction inside RTL prose and looks unchanged.
  assert.deepEqual(plain.map((n) => n.kind), ['text', 'element', 'text', 'element', 'text']);
  assert.deepEqual([plain[1].tag, plain[1].className], ['span', 'v']);

  const mono = t(strings, 'a.mono', {}, doc);
  assert.deepEqual([mono[1].kind, mono[1].tag, mono[1].className, mono[1].textContent],
    ['element', 'span', 'm', 'mycontext ui']);

  // {mv:…} is the one a string-returning t() could not even SEE: \w excludes
  // the colon, so it matched nothing and shipped its braces to the screen. It
  // is both at once — monospace like {m:…}, substituted like {name} — and the
  // pair of classes it carries is how it says so.
  const value = t(strings, 'a.monoValue', { branch: 'feature/x' }, doc);
  assert.deepEqual([value[1].tag, value[1].className, value[1].textContent],
    ['span', 'm v', 'feature/x']);

  assert.throws(() => t(strings, 'a.missing', {}, doc));           // an undeclared key
  assert.throws(() => t(strings, 'a.plain', { name: 'x' }, doc));  // a missing substitution
});

test('tFlat flattens the same three markers, and that is what attributes get', async () => {
  const { tFlat } = await import('../../src/ui/public/lib/i18n.js');
  const strings = { 'a.aria': 'in sync with origin/{mv:branch}, run {m:mycontext ui}' };
  // The isolation is GONE, on purpose: an aria-label cannot hold an element.
  assert.equal(tFlat(strings, 'a.aria', { branch: 'main' }),
    'in sync with origin/main, run mycontext ui');
});

test('pickLanguage prefers the stored choice, then the navigator, then en', async () => {
  const { pickLanguage } = await import('../../src/ui/public/lib/i18n.js');
  assert.equal(pickLanguage('he', 'en-US'), 'he');
  assert.equal(pickLanguage(null, 'he-IL'), 'he');
  assert.equal(pickLanguage(null, 'fr-FR'), 'en');
  assert.equal(pickLanguage('nonsense', 'he-IL'), 'he'); // junk storage is ignored, not honoured
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/viewmodel.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the lib modules**

```js
// src/ui/public/lib/bootstrap.js
// The page receives a one-shot handoff NONCE in the URL fragment — never the
// token, and the fragment is never sent to the server or a referrer (spec §2).
// It exchanges the nonce once, then history.replaceState()s the fragment away.

export function extractNonce(hash) {
  const value = hash.startsWith('#') ? hash.slice(1) : '';
  return /^[0-9a-f]+$/.test(value) ? value : null;
}

export async function exchangeNonce(fetchFn, nonce) {
  const response = await fetchFn('/api/handoff', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (!response.ok) return null;
  return (await response.json()).token;
}
```

```js
// src/ui/public/lib/heartbeat.js
// The page heartbeats ONLY while visible (spec §2): a tab in a background
// window stops pinging, so a forgotten tab stops holding the server up
// within one idle window.

export function shouldPing(visibilityState) {
  return visibilityState === 'visible';
}

export function startHeartbeat(doc, pingFn, intervalMs) {
  const timer = setInterval(() => {
    if (shouldPing(doc.visibilityState)) pingFn();
  }, intervalMs);
  return () => clearInterval(timer);
}
```

```js
// src/ui/public/lib/i18n.js
export function pickLanguage(stored, navigatorLang) {
  if (stored === 'en' || stored === 'he') return stored;
  return String(navigatorLang || '').toLowerCase().startsWith('he') ? 'he' : 'en';
}

// The three run markers, exactly as Task 1 transcribes them from the mockup's
// grammar block. `mv` is listed before `m`, as the mockup's own `SLOT` pattern
// lists it: the longer marker is tried first, so `{mv:branch}` is read as the
// monospace VALUE slot and never as an `{m:…}` literal. The payload cannot
// contain `}` — the same limit the mockup's own `slots()` has, stated here
// rather than discovered later.
const RUN = /\{(?:(mv|m):)?([^}]*)\}/g;

/**
 * A translated string, AS NODES. Never as a string. (Owner ruling A1, §0.6.)
 *
 * A string cannot carry an element, and ALL THREE markers build one: `{m:…}`
 * and `{mv:name}` are monospace and bidi-isolated, and a plain `{name}` is
 * bidi-isolated as well — `span.v`, the isolation without the monospace, which
 * is what the mockup's `slotNode` builds (§0.7). Its header comment records what
 * a string-returning renderer costs — assigning a captured translation with
 * `textContent` "flattens just as thoroughly … the seven `data-t` elements
 * holding `.m` spans lost them on the first toggle and never got them back",
 * leaving "English isolated and Hebrew not, exactly backwards". So this returns
 * Node[] for EVERY key, marked or not, and callers append:
 *
 *     heading.append(...t(strings, 'preview.h'));
 *
 * `doc` exists so `node --test` can pass a two-method stand-in; the browser
 * never passes it, and nothing else in this module touches the DOM.
 *
 * TWO ways to fail loudly, both deliberate. A missing KEY throws, so a screen
 * naming an undeclared key fails in development instead of rendering blank. A
 * missing SUBSTITUTION throws too: leaving `{n}` in place puts braces on the
 * screen, which is the same defect wearing a different marker — and it is
 * exactly what the old `\w`-based pattern did to every `{mv:…}` run, silently.
 */
export function t(strings, key, subs = {}, doc = globalThis.document) {
  const template = strings[key];
  if (template === undefined) throw new Error(`missing string key: ${key}`);
  const value = (name) => {
    if (!Object.prototype.hasOwnProperty.call(subs, name)) {
      throw new Error(`missing substitution {${name}} for string key: ${key}`);
    }
    return String(subs[name]);
  };
  // `m` is monospace + direction:ltr + unicode-bidi:isolate; `v` is the
  // isolation alone. These are the mockup's `slotNode` classes, exactly.
  const run = (className, text) => {
    const el = doc.createElement('span');
    el.className = className;
    el.textContent = text;
    return el;
  };
  const out = [];
  let last = 0;
  RUN.lastIndex = 0;
  for (let m = RUN.exec(template); m !== null; m = RUN.exec(template)) {
    if (m.index > last) out.push(doc.createTextNode(template.slice(last, m.index)));
    const marker = m[1];
    const payload = m[2];
    if (marker === 'm') out.push(run('m', payload));                // a literal
    else if (marker === 'mv') out.push(run('m v', value(payload))); // a value, same treatment
    else out.push(run('v', value(payload)));                        // a value, isolated, not mono
    last = RUN.lastIndex;
  }
  if (last < template.length) out.push(doc.createTextNode(template.slice(last)));
  return out;
}

/** The two methods `t()` uses. Enough for `tFlat`, and enough for a test. */
const FLAT_DOC = {
  createTextNode: (text) => ({ textContent: text }),
  createElement: () => ({ className: '', textContent: '' }),
};

/**
 * The same three markers, parsed the same way, and then FLATTENED to a string.
 *
 * **The flattening is deliberate, and saying so is the reason this is a
 * separate function rather than a shrug at a call site.** An `aria-label`, a
 * `title` and an `<option>` label are attributes or text-only sinks: they
 * cannot hold an element, so the isolation an `{m:…}`, `{mv:…}` or a plain
 * `{name}` run carries CANNOT survive there, whatever the renderer does. On
 * screen the same flattening is the defect the mockup records as shipped; in an
 * attribute it is the only thing an attribute can hold. The mockup needs and
 * has this helper
 * for the same reason, beside its `applyLang`: "An aria-label is an ATTRIBUTE,
 * not child nodes."
 *
 * A caller reaching for this to fill an ELEMENT is the bug. Use `t()` there.
 */
export function tFlat(strings, key, subs = {}) {
  return t(strings, key, subs, FLAT_DOC).map((n) => n.textContent).join('');
}

export function applyLanguage(documentEl, table) {
  documentEl.setAttribute('lang', table.lang);
  documentEl.setAttribute('dir', table.dir); // <html dir> follows the language (spec §3)
}
```

- [ ] **Step 4: Write the shell**

`src/ui/public/index.html` (replaces the placeholder):

```html
<!doctype html>
<html lang="en" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>mycontext</title>
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <header id="topbar">
    <!-- The wordmark is not a translated string: the mockup renders it as a
         bare <b>mycontext</b> with no data-t, and a product name is not
         translated. -->
    <div class="logo"><span class="mark"></span><b>mycontext</b></div>
    <div class="topr">
      <button class="sel" id="focusbtn" aria-haspopup="dialog" aria-expanded="false">
        <span id="focus-label"></span> <b id="focuslbl"></b>
      </button>
      <button class="sel" id="sessbtn" aria-haspopup="dialog" aria-expanded="false">
        <span class="live"></span> <span id="session-label"></span> <b id="sesslbl"></b>
      </button>
      <button class="icon" id="lang" title="English / עברית">א/A</button>
      <button class="icon" id="theme" title="Theme">◐</button>
    </div>
  </header>
  <nav class="rail" id="nav" aria-label="Screens"></nav>
  <main class="body" id="screen"></main>
  <!-- The exit banner IS in the mockup: <div class="banner" id="exited"> with
       ex.msg and ex.ok. Use its markup, not a bare div. -->
  <div class="banner" id="exited" hidden role="alert"></div>
  <script type="module" src="/app.js"></script>
</body>
</html>
```

`src/ui/public/styles.css` (replaces the placeholder) — **logical properties only; a physical `left`/`right`/`margin-left`/`text-align: left` anywhere in this file is a defect** (spec §3). The full starting stylesheet:

```css
:root {
  --ink: #1a1a1a; --paper: #ffffff; --line: #d0d0d0;
  --accent: #205a9e; --warn: #a05a00; --bad: #a01a1a; --dim: #6a6a6a;
}
* { box-sizing: border-box; }
body {
  margin: 0; color: var(--ink); background: var(--paper);
  font: 15px/1.5 system-ui, sans-serif;
}
#topbar {
  display: flex; align-items: center; gap: 1rem;
  padding-block: 0.5rem; padding-inline: 1rem;
  border-block-end: 1px solid var(--line);
}
#nav { display: flex; gap: 0.75rem; margin-inline-end: auto; }
#nav a { color: var(--accent); text-decoration: none; }
#nav a.active { text-decoration: underline; }
#screen { padding-block: 1rem; padding-inline: 1rem; max-inline-size: 72rem; }
#banner {
  padding-block: 0.75rem; padding-inline: 1rem;
  background: var(--bad); color: var(--paper);
  position: sticky; inset-block-start: 0;
}
table { border-collapse: collapse; }
td, th { border: 1px solid var(--line); padding-block: 0.25rem; padding-inline: 0.5rem; text-align: start; }
code, pre { font-family: ui-monospace, monospace; }
/* Direction KNOWN ltr: what a `{m:…}` or `{mv:…}` run builds (Task 1). The
   mockup calls its equivalent "the single most important rule in the sheet",
   and it is UNCONDITIONAL in both languages on purpose: isolating only under
   [dir="rtl"] is how that file's earlier pass ended up with English isolated
   and Hebrew not, exactly backwards. A span.m with no rule here is a t() whose
   ruling is cosmetically void. */
.m { font-family: ui-monospace, monospace; direction: ltr; unicode-bidi: isolate; }
/* A VALUE SLOT: what a plain `{name}` run builds, and what `{mv:name}` carries
   alongside `.m` (§0.7). The isolation and NOTHING else — the mockup's own
   words: "a count or an id sitting inside RTL prose must keep its own
   direction. Carries no other styling, so marking a value changes nothing on
   screen." Unconditional in both languages, for the reason `.m` is. §0.6 put a
   `bdi` rule here instead, for a marker that no longer exists; nothing in this
   plan builds a <bdi>, and `unicode-bidi: isolate` is the browser's own default
   for that element, so it selected nothing and asserted nothing. This rule is
   load-bearing: t() builds a span.v wherever a string substitutes a value. */
.v { unicode-bidi: isolate; }
/* Paths and code stay LTR inside an RTL page — a path is not prose (spec §3,
   "honestly out of scope"), a decision and not a bug. */
[dir="rtl"] code, [dir="rtl"] pre, [dir="rtl"] .path { direction: ltr; unicode-bidi: isolate; }
.spill { color: var(--warn); }
.gap { color: var(--bad); }
.dim { color: var(--dim); }
.bar { block-size: 1rem; background: var(--accent); }
.bar-track { inline-size: 100%; background: var(--line); }
@media print {
  /* The coverage map's printable rendering (spec §4: the onboarding view
     survives as the map's print stylesheet — same artefact, no second
     implementation, still the thing you screenshot). */
  #topbar, #banner, .no-print { display: none; }
  #screen { max-inline-size: none; }
}
```

`src/ui/public/app.js`:

```js
import { extractNonce, exchangeNonce } from '/lib/bootstrap.js';
import { startHeartbeat } from '/lib/heartbeat.js';
import { applyLanguage, pickLanguage, t as translate, tFlat as flat } from '/lib/i18n.js';

// Screen names are the mockup's `data-p` values, so `#/gaps` and
// <section data-p="gaps"> are the same identifier read twice (§0.2).
const SCREENS = {
  preview: () => import('/screens/preview.js'),
  coverage: () => import('/screens/coverage.js'),
  gaps: () => import('/screens/gaps.js'),
  simulate: () => import('/screens/simulate.js'),
  injected: () => import('/screens/injected.js'),
  doctor: () => import('/screens/doctor.js'),
  decay: () => import('/screens/decay.js'),
  graph: () => import('/screens/graph.js'),
  status: () => import('/screens/status.js'),
  learn: () => import('/screens/learn.js'),
};
// FOUR groups, by TENSE, in the mockup's own order. Plans 2 and 3 add their
// screens INTO these groups — they do not add groups. `watch` and `ask` join
// `nav.ev` (plan 3); `work`, `capture`, `palette`, `config` join `nav.ch`
// (plan 2). `docs` and `tut` belong to `nav.read` and are unassigned (§0.4).
const NAV = [
  ['nav.inj', ['preview', 'coverage', 'gaps', 'simulate', 'injected']],
  ['nav.ev', ['doctor', 'decay', 'graph', 'status']],
  ['nav.ch', []],
  ['nav.read', ['learn']],
];

let token = null;
let table = null;
let sessionValue = 'cold';
const sessionListeners = [];

// Takes NODES, because translate() returns nodes: a string cannot carry the
// isolated runs the string tables mark, and flattening one on screen is the
// defect the mockup records as shipped (§0.6).
function banner(...nodes) {
  const el = document.getElementById('banner');
  el.replaceChildren(...nodes);
  el.hidden = false;
}

async function api(path) {
  let response;
  try {
    response = await fetch(path, { headers: { 'X-Mycontext-Token': token } });
  } catch {
    // The server has exited (idle or closed). Say so; NEVER reconnect —
    // silent reconnection would reintroduce the daemon by another name (§2).
    banner(...translate(table.strings, 'app.serverExited'));
    stopHeartbeat();
    throw new Error('server exited');
  }
  if (!response.ok) {
    // A refusal from the security gate carries the STATUS AND NOTHING ELSE
    // (Task 13, ruling A4): there is no body, so this must not assume one —
    // response.json() on an empty body throws, and it would throw HERE,
    // outside the catch above, turning a clean 403 into a mystery. Other
    // failures (an unknown route, a handler error) still answer a JSON
    // `error`, so read a body only when there IS one.
    const raw = await response.text();
    let detail = '';
    if (raw !== '') { try { detail = String(JSON.parse(raw).error ?? ''); } catch { detail = ''; } }
    throw new Error(detail === '' ? String(response.status) : detail);
  }
  return await response.json();
}

let stopHeartbeat = () => {};

function currentSession() { return sessionValue; }

async function loadSessions() {
  const picker = document.getElementById('session-picker');
  const data = await api('/api/sessions');
  picker.innerHTML = '';
  const cold = document.createElement('option');
  cold.value = 'cold';
  // `flat` (tFlat), not translate: an <option> holds text and nothing else, so
  // an isolated run cannot survive here whatever the renderer does. That is
  // the sink tFlat exists for, and naming it is what keeps this
  // distinguishable from the accidental flattening one line of screen code
  // away (§0.6).
  cold.textContent = flat(table.strings, 'session.cold');
  for (const s of data.sessions) {
    const opt = document.createElement('option');
    opt.value = s.sessionId;
    opt.textContent = `${s.sessionId} — ${flat(table.strings, 'session.lastInjection', { when: s.lastInjectedAt })}`;
    picker.append(opt);
  }
  picker.append(cold); // cold is last, explicitly labelled — never the default when a session exists
  if (data.sessions.length === 0) {
    cold.textContent = flat(table.strings, 'session.empty');
    sessionValue = 'cold';
  } else {
    sessionValue = data.default; // Ledger.recentSessions(1)[0] — repeatable across loads (§3)
  }
  picker.value = sessionValue;
  picker.onchange = () => {
    sessionValue = picker.value;
    for (const fn of sessionListeners) fn(sessionValue);
  };
}

function renderNav() {
  const nav = document.getElementById('nav');
  nav.replaceChildren();               // never innerHTML — see i18n above
  for (const [groupKey, names] of NAV) {
    // A group with nothing in it yet renders as nothing, not as a bare
    // heading: `nav.ch` is empty until plan 2 lands. Plan 2 and plan 3 add
    // names INTO these four groups; neither adds a fifth.
    if (names.length === 0) continue;
    const group = document.createElement('div');
    group.className = 'grp';
    const label = document.createElement('p');
    label.append(...translate(table.strings, groupKey));
    group.append(label);
    for (const name of names) {
      const a = document.createElement('a');
      a.href = `#/${name}`;
      // The RAIL LABEL, from the string table — `s.<name>` — not the route
      // name. `preview` is a URL; "Injection preview" is the product's word
      // for it, and it has a Hebrew pair.
      a.append(...translate(table.strings, `s.${name}`));
      a.className = location.hash === `#/${name}` ? 'active' : '';
      if (a.className === 'active') a.setAttribute('aria-current', 'page');
      group.append(a);
    }
    nav.append(group);
  }
}

async function route() {
  // Decision 5: the landing screen is the injection preview, at
  // event=session-start on the most recent session, rendering with no input.
  // NOT 'status' -- that screen is built by Task 19 and deferred to wave 3.
  const name = (location.hash.replace(/^#\//, '') || 'preview');
  const loader = SCREENS[name] || SCREENS.preview;
  renderNav();
  const root = document.getElementById('screen');
  root.replaceChildren(...translate(table.strings, 'common.loading'));
  const mod = await loader();
  await mod.render(root, window.myctx);
}

async function main() {
  const lang = pickLanguage(localStorage.getItem('myctx-lang'), navigator.language);
  table = await import(`/strings/${lang}.js`);
  applyLanguage(document.documentElement, table);
  // The wordmark is not a translated string: the mockup renders it as a bare
  // <b>mycontext</b> with no `data-t`, and a product name is not translated.
  document.getElementById('session-label').append(...translate(table.strings, 'top.session'));
  document.getElementById('focus-label').append(...translate(table.strings, 'top.focus'));
  // The language control is an ICON BUTTON in the mockup (`#lang`, "א/A"), not
  // a labelled <select>. Its accessible name is an OPEN QUESTION (§0.4) — do
  // not invent a key for it here; raise it, change the mockup, then add it to
  // both string tables.
  const langButton = document.getElementById('lang');
  langButton.onclick = () => {
    localStorage.setItem('myctx-lang', lang === 'he' ? 'en' : 'he');
    location.reload();
  };

  const nonce = extractNonce(location.hash);
  if (nonce !== null) {
    token = await exchangeNonce(fetch.bind(window), nonce);
    history.replaceState(null, '', location.pathname); // the fragment dies here (§2)
  }
  if (token === null) {
    banner(...translate(table.strings, 'app.serverExited'));
    return;
  }

  window.myctx = {
    api,
    // Nodes. Screens append: `el.append(...ctx.t(key, vals))`. The flattened
    // form is a SEPARATE call, so reaching for it is a visible decision.
    t: (key, subs) => translate(table.strings, key, subs),
    tFlat: (key, subs) => flat(table.strings, key, subs),
    session: currentSession,
    onSessionChange: (fn) => sessionListeners.push(fn),
    navigate: (hash) => { location.hash = hash; },
  };

  await loadSessions();
  stopHeartbeat = startHeartbeat(document, () => api('/api/ping').catch(() => {}), 60_000);
  window.addEventListener('hashchange', route);
  await route();
}

main();
```

Routing note: the nonce arrives in the fragment, so `route()` runs only after the exchange (`main` awaits it before wiring `hashchange`). **The default screen is `preview`**, as `route()`'s own comment says and as the mockup shows — `<section data-p="preview">` is the only section rendered without `hidden`, and its rail button carries `aria-current="page"`. Status is no longer justified as the landing screen and says so itself: *"Not the landing screen, and no longer justified by being one. It is where the header's corpus counts lead"* (`st.sub`). **Corrected 2026-08-20** — §0 had recorded this on 2026-08-18 and this note twenty tasks later still said the old thing, which is exactly the failure `npm run check:retired` exists to catch; the phrase is now declared retired in §0's block.

- [ ] **Step 5: Run the pure-logic tests and the suite**

Run: `node --test test/ui/viewmodel.test.ts && npm test`
Expected: green (the server E2E from Task 13 still passes — it fetches `/`, which now serves the real shell).

- [ ] **Step 6: Smoke it by hand once**

Run: `node src/cli/index.ts ui --no-open` in this repository, open the printed URL, and confirm: the shell loads, the session picker shows cold (or sessions), Hebrew flips `dir` to rtl, and killing the server makes the next click show the exit banner without reconnecting. (Manual because rendering is untestable — the limit §6 states.)

- [ ] **Step 7: Commit**

```bash
git add src/ui/public test/ui/viewmodel.test.ts
git commit -m "feat(ui): app shell — nonce bootstrap, visibility-gated heartbeat, i18n with RTL, exit banner"
```

---

## Task 17: `nav.inj` screens — injection preview, budget simulator, injected now

> **Mockup — the specification for these three screens** (§0.2): `data-p="preview"`, `data-p="simulate"`
> and `data-p="injected"` in `docs/design/web-ui-mockup.html`. Build what they show. Its **data** is
> fabricated and its **simulator logic** is a demo loop — the real screens call `/api/select`,
> `/api/simulate` and `/api/session/:session/injected` — but its **composition, its charts and its
> words** are the record.
>
> **Six graphical views live on these three screens, and four of them are not fully served** (§0.3):
> the **gate ladder** (`#gates`, row 17 — **no read model exists**, do not synthesise it from
> `Spill.reason`), the **four-tier ribbon with ghost lane** (`#ribbons`, row 3 — needs `tiersRun` and
> per-line index costs), the **admission staircase** and **threshold ladder** (`#stair`, `#ladder`,
> rows 1–2 — servable at N+1 round trips, no sweep response), the **spill-ratio bar** (`#ratio`, row 4
> — **audit-backed, unreachable from this plan**), and the **tier fits chips** (`#simtbl`, row 5 —
> fully served). **Where a view cannot be drawn, stop and ask; do not draw a weaker one.** The
> instruction names that failure exactly: *"quietly rendering a weaker version — a table where it draws
> a chart, a number where it draws a distribution."*
>
> `injected.js` reads the **seen file** and shows `id` / `tier` / `at`, per the corrected Task 9.

**Files:**
- Create: `src/ui/public/screens/preview.js`, `src/ui/public/screens/simulate.js`, `src/ui/public/screens/injected.js`
- Create: `src/ui/public/lib/viewmodel.js` (shared pure helpers; grows in Tasks 18-19)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `window.myctx` (Task 16), `/api/select`, `/api/render`, `/api/simulate`, `/api/coverage` (file list for the picker), `/api/session/:id/injected`.
- Produces: each screen module exports `render(root: HTMLElement, ctx): Promise<void>`; `viewmodel.js` exports `selectQuery(event, path, session, extra?): string` (pure — builds the query string all three `nav.inj` selection screens share, cold labelled by construction) and `budgetBar(used, budget): { pct: number, over: boolean }` (pure).

- [ ] **Step 1: Failing tests for the pure helpers** (append to `test/ui/viewmodel.test.ts`)

```ts
test('selectQuery builds the shared grammar, cold vs session', async () => {
  const { selectQuery } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.equal(selectQuery('tool', 'src/a.ts', 'cold'), 'event=tool&path=src%2Fa.ts&cold=1');
  assert.equal(selectQuery('session-start', null, 's1'), 'event=session-start&session=s1');
  assert.equal(selectQuery('tool', 'a b.ts', 's1', { jit: 100 }), 'event=tool&path=a+b.ts&session=s1&jit=100');
});

test('budgetBar computes fill and overflow', async () => {
  const { budgetBar } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.deepEqual(budgetBar(50, 200), { pct: 25, over: false });
  assert.deepEqual(budgetBar(300, 200), { pct: 100, over: true });
  assert.deepEqual(budgetBar(0, 0), { pct: 0, over: false });
});
```

- [ ] **Step 2: See them fail, then implement `viewmodel.js`**

```js
// src/ui/public/lib/viewmodel.js
export function selectQuery(event, path, session, extra = {}) {
  const qs = new URLSearchParams();
  qs.set('event', event);
  if (path !== null && path !== undefined) qs.set('path', path);
  if (session === 'cold') qs.set('cold', '1');
  else qs.set('session', session);
  for (const [key, value] of Object.entries(extra)) qs.set(key, String(value));
  return qs.toString();
}

export function budgetBar(used, budget) {
  if (budget <= 0) return { pct: 0, over: used > 0 ? true : false };
  return { pct: Math.min(100, Math.round((used / budget) * 100)), over: used > budget };
}
```

- [ ] **Step 3: Implement the three screens**

```js
// src/ui/public/screens/preview.js
// nav.inj: pick a file and a session; see exactly what Claude gets, with the
// budget bar and what spilled. Rests on /api/select WITH seen — wrong in a
// way nobody would notice without it (spec §3).
import { selectQuery, budgetBar } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('preview.h'));
  root.append(h);

  const coverage = await ctx.api('/api/coverage');
  const picker = document.createElement('select');
  for (const f of coverage.files) {
    const opt = document.createElement('option');
    opt.value = f.path; opt.textContent = f.path; opt.className = 'path';
    picker.append(opt);
  }
  const label = document.createElement('label');
  label.append(...ctx.t('preview.pickFile'), ': ', picker);
  root.append(label);

  const out = document.createElement('div');
  root.append(out);

  async function show() {
    out.replaceChildren(...ctx.t('common.loading'));
    const qs = selectQuery('tool', picker.value, ctx.session());
    const [selection, sim, rendered] = await Promise.all([
      ctx.api(`/api/select?${qs}`),
      ctx.api(`/api/simulate?${qs}`),
      ctx.api(`/api/render?${qs}`),
    ]);
    out.innerHTML = '';
    if (selection.full.length === 0 && selection.spilled.length === 0) {
      out.append(...ctx.t('preview.nothing'));
      return;
    }
    const used = sim.costs
      .filter((c) => selection.full.some((e) => e.item.id === c.id))
      .reduce((sum, c) => sum + c.tokens, 0);
    const bar = budgetBar(used, sim.budgets.jit);
    const track = document.createElement('div');
    track.className = 'bar-track';
    const fill = document.createElement('div');
    fill.className = 'bar';
    fill.style.inlineSize = `${bar.pct}%`;
    track.append(fill);
    out.append(track, `${used} / ${sim.budgets.jit}`);

    const list = document.createElement('ul');
    for (const entry of selection.full) {
      const li = document.createElement('li');
      const cost = sim.costs.find((c) => c.id === entry.item.id);
      li.append(`${entry.item.id} [${entry.tier}] ${entry.item.title} (${cost ? cost.tokens : '?'})`);
      list.append(li);
    }
    out.append(list);

    if (selection.spilled.length > 0) {
      const sh = document.createElement('h2');
      sh.append(...ctx.t('preview.spilled'));
      out.append(sh);
      const spills = document.createElement('ul');
      for (const s of selection.spilled) {
        const li = document.createElement('li');
        li.className = 'spill';
        li.append(`${s.id} [${s.tier}] — ${s.reason}`);
        spills.append(li);
      }
      out.append(spills);
    }

    const th = document.createElement('h2');
    th.append(...ctx.t('preview.renderedText'));
    const pre = document.createElement('pre');
    pre.textContent = rendered.text;
    out.append(th, pre);
  }

  picker.onchange = show;
  ctx.onSessionChange(show);
  await show();
}
```

```js
// src/ui/public/screens/simulate.js
// nav.inj: drag the budget, watch what fits — the screen that would have made
// the 1.0 default-budget change a five-second exercise.
import { selectQuery } from '/lib/viewmodel.js';

const TIERS = [['pinned', 'session-start'], ['jit', 'tool']];

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('sim.h'));
  root.append(h);

  const coverage = await ctx.api('/api/coverage');
  const firstPath = coverage.files.length > 0 ? coverage.files[0].path : null;

  for (const [tier, event] of TIERS) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.append(...ctx.t('simulate.budget', { tier }));
    const slider = document.createElement('input');
    slider.type = 'range'; slider.min = '0'; slider.max = '20000'; slider.step = '100';
    const value = document.createElement('span');
    const result = document.createElement('p');
    section.append(title, slider, value, result);
    root.append(section);

    async function run() {
      value.textContent = ` ${slider.value}`;
      if (event === 'tool' && firstPath === null) { result.textContent = ''; return; }
      const qs = selectQuery(event, event === 'tool' ? firstPath : null, ctx.session(),
        { [tier]: slider.value });
      const sim = await ctx.api(`/api/simulate?${qs}`);
      result.replaceChildren(
        ...ctx.t('simulate.fits', { n: sim.selection.full.length }), ', ',
        ...ctx.t('simulate.spills', { n: sim.selection.spilled.length }));
    }
    let pending = null;
    slider.oninput = () => { clearTimeout(pending); pending = setTimeout(run, 150); };
    const defaults = await ctx.api(`/api/simulate?${selectQuery(event, event === 'tool' ? firstPath : null, 'cold')}`);
    slider.value = String(defaults.budgets[tier]);
    await run();
  }
}
```

```js
// src/ui/public/screens/injected.js
// nav.inj: live state for the selected session, from the SEEN FILE (Task 9) —
// not a hypothetical, and not the Ledger's replayed projection.
export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('inj.h'));
  root.append(h);
  const out = document.createElement('div');
  root.append(out);

  async function show() {
    const session = ctx.session();
    if (session === 'cold') { out.replaceChildren(...ctx.t('injected.none')); return; }
    const data = await ctx.api(`/api/session/${encodeURIComponent(session)}/injected`);
    out.replaceChildren();
    // A read error is DISCLOSED before the rows, never rendered as "nothing
    // was injected" — an unreadable seen file and an empty one are two facts.
    if (data.error !== null) {
      const note = document.createElement('p');
      note.className = 'small';
      note.textContent = data.error;   // the seen file's own words, not a paraphrase
      out.append(note);
    }
    if (data.lines.length === 0) { out.append(...ctx.t('injected.none')); return; }
    // Item / Tier / When — the mockup's three columns (`th.item`, `th.tier`,
    // `th.when`), each straight off a SeenLine. No join invents a column.
    const table = document.createElement('table');
    for (const l of data.lines) {
      const tr = document.createElement('tr');
      for (const cell of [l.id, l.tier, l.at, l.title ?? '—']) {
        const td = document.createElement('td');
        td.textContent = String(cell);
        tr.append(td);
      }
      table.append(tr);
    }
    out.append(table);
  }
  ctx.onSessionChange(show);
  await show();
}
```

- [ ] **Step 4: Run tests, suite, and smoke**

Run: `node --test test/ui/viewmodel.test.ts && npm test`, then repeat Task 16's manual smoke on the three screens.
Expected: green; screens render against this repository's own corpus.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/viewmodel.js src/ui/public/screens test/ui/viewmodel.test.ts
git commit -m "feat(ui): nav.inj screens — preview with seen and focus, budget simulator, injected now from the seen file"
```

---

## Task 18: Scope coverage with detail pane and print mode; coverage gaps; relations

> **Mockup — the specification for these three screens** (§0.2): `data-p="coverage"`, `data-p="gaps"`
> and `data-p="graph"` in `docs/design/web-ui-mockup.html`. **Three screens, not two:** *Coverage gaps*
> has its own `<section>`, its own rail button (`s.gaps`, with a count badge) and its own three-column
> table — *Where / What / Next* (`th.where`, `th.what`, `th.act`). Folding it into the coverage screen
> as a panel drops a screen the mockup shows.
>
> **Titles, from the string table:** *Scope coverage* (`cov.h`), *Coverage gaps* (`gaps.h`),
> *Relations* (`gr.h`) — not "Coverage map", "Relation graph".
>
> **Two of its graphical views are short a field** (§0.3): the per-directory **magnitude bar**
> (`.mini`, row 12) draws governed / ungoverned / **not examined** and `/api/coverage` cannot say which
> paths were not examined; the **ego-graph legend** (row 14) needs `loadBearing` per edge, added to
> `/api/graph` in Task 11. **The pinned hoist is not optional:** `always:true` items are drawn in their
> own card *above* the tree, never coloured per path, *"which is why a directory that is governed used
> to render as a gap"* (`cov.pinhelp`). **The empty state is drawn**, not omitted: `#covempty` —
> *"Nothing governs this project yet"* (`cov.e1`), said once, not per row.

**Files:**
- Create: `src/ui/public/screens/coverage.js`, `src/ui/public/screens/gaps.js`, `src/ui/public/screens/graph.js`
- Modify: `src/ui/public/lib/viewmodel.js` (tree building, gap derivation, layered layout — all pure)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `/api/coverage`, `/api/graph`, `/api/select` (detail pane), `/api/items`.
- Produces (pure, in `viewmodel.js`):
  - `buildTree(files: { path, governs }[]): TreeNode` where `TreeNode = { name, path, children: TreeNode[], governs: string[], fileCount: number, governedCount: number }` — directories aggregate; a directory's `governs` is the union of its files'.
  - `coverageGaps(tree: TreeNode): string[]` — directory paths whose `governedCount === 0` (the §4 inverse view; empty categories come from `/api/status`).
  - `layoutGraph(nodes, edges, focusId): { id, x, y }[]` — deterministic layered layout: focus at column 0, neighbours in columns by BFS depth, rows sorted by (relation type of the connecting edge, id) — no force simulation, no physics (spec §4).

- [ ] **Step 1: Failing tests** (append to `test/ui/viewmodel.test.ts`)

```ts
test('buildTree aggregates governance up directories; coverageGaps names the ungoverned', async () => {
  const { buildTree, coverageGaps } = await import('../../src/ui/public/lib/viewmodel.js');
  const tree = buildTree([
    { path: 'src/a.ts', governs: ['RULE-1'] },
    { path: 'src/b.ts', governs: [] },
    { path: 'docs/x.md', governs: [] },
  ]);
  const src = tree.children.find((c) => c.name === 'src');
  const docs = tree.children.find((c) => c.name === 'docs');
  assert.deepEqual(src?.governs, ['RULE-1']);
  assert.equal(src?.fileCount, 2);
  assert.equal(src?.governedCount, 1);
  assert.equal(docs?.governedCount, 0);
  assert.deepEqual(coverageGaps(tree), ['docs']);
});

test('layoutGraph is deterministic and layered by BFS depth', async () => {
  const { layoutGraph } = await import('../../src/ui/public/lib/viewmodel.js');
  const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];
  const edges = [
    { from: 'A', to: 'B', type: 'supersedes' },
    { from: 'A', to: 'C', type: 'relates' },
  ];
  const first = layoutGraph(nodes, edges, 'A');
  const second = layoutGraph(nodes, edges, 'A');
  assert.deepEqual(first, second); // deterministic — run twice, same pixels
  const a = first.find((p) => p.id === 'A');
  const b = first.find((p) => p.id === 'B');
  const c = first.find((p) => p.id === 'C');
  assert.equal(a?.x, 0);
  assert.equal(b?.x, 1);
  assert.equal(c?.x, 1);
  assert.notEqual(b?.y, c?.y);
});
```

- [ ] **Step 2: See them fail, implement the view-models** (append to `viewmodel.js`)

```js
export function buildTree(files) {
  const root = { name: '', path: '', children: [], governs: [], fileCount: 0, governedCount: 0 };
  const dirs = new Map([['', root]]);
  const ensureDir = (dirPath) => {
    if (dirs.has(dirPath)) return dirs.get(dirPath);
    const idx = dirPath.lastIndexOf('/');
    const parent = ensureDir(idx === -1 ? '' : dirPath.slice(0, idx));
    const node = {
      name: idx === -1 ? dirPath : dirPath.slice(idx + 1),
      path: dirPath, children: [], governs: [], fileCount: 0, governedCount: 0,
    };
    parent.children.push(node);
    dirs.set(dirPath, node);
    return node;
  };
  for (const file of files) {
    const idx = file.path.lastIndexOf('/');
    const dir = ensureDir(idx === -1 ? '' : file.path.slice(0, idx));
    const leaf = {
      name: idx === -1 ? file.path : file.path.slice(idx + 1),
      path: file.path, children: [], governs: [...file.governs].sort(),
      fileCount: 1, governedCount: file.governs.length > 0 ? 1 : 0,
    };
    dir.children.push(leaf);
    for (let d = dir; d; d = dirs.get(d.path.includes('/') ? d.path.slice(0, d.path.lastIndexOf('/')) : (d.path === '' ? null : ''))) {
      d.fileCount += 1;
      if (leaf.governedCount) d.governedCount += 1;
      for (const id of leaf.governs) if (!d.governs.includes(id)) d.governs.push(id);
      if (d.path === '') break;
    }
  }
  const sortRec = (node) => {
    node.children.sort((a, b) => (a.children.length > 0) !== (b.children.length > 0)
      ? (a.children.length > 0 ? -1 : 1)
      : a.name < b.name ? -1 : 1);
    node.governs.sort();
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root;
}

export function coverageGaps(tree) {
  const gaps = [];
  const walk = (node) => {
    if (node.path !== '' && node.children.some((c) => c.children.length > 0 || c.fileCount === 1) &&
        node.children.length > 0 && node.governedCount === 0) {
      gaps.push(node.path);
      return; // the deepest ungoverned ancestor is the useful name; children add noise
    }
    node.children.filter((c) => c.children.length > 0).forEach(walk);
  };
  walk(tree);
  return gaps.sort();
}

export function layoutGraph(nodes, edges, focusId) {
  const depth = new Map([[focusId, 0]]);
  const adjacency = new Map();
  for (const e of edges) {
    for (const [a, b] of [[e.from, e.to], [e.to, e.from]]) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      adjacency.get(a).push({ other: b, type: e.type });
    }
  }
  for (const list of adjacency.values()) {
    list.sort((a, b) => a.type < b.type ? -1 : a.type > b.type ? 1 : a.other < b.other ? -1 : 1);
  }
  const order = [focusId];
  for (let i = 0; i < order.length; i++) {
    for (const n of adjacency.get(order[i]) ?? []) {
      if (!depth.has(n.other) && nodes.some((node) => node.id === n.other)) {
        depth.set(n.other, depth.get(order[i]) + 1);
        order.push(n.other);
      }
    }
  }
  const rows = new Map();
  return order.map((id) => {
    const x = depth.get(id);
    const y = rows.get(x) ?? 0;
    rows.set(x, y + 1);
    return { id, x, y };
  });
}
```

Run the two tests; if `buildTree`'s upward aggregation loop proves wrong against them (the parent-walk is the fiddly part), fix the loop until the assertions pass — the assertions, not the loop, are the contract.

- [ ] **Step 3: Implement the two screens**

```js
// src/ui/public/screens/coverage.js
// The coverage map (spec §3/§4): matchesScope + injection() SERVER-side —
// this module renders and never re-derives a matching rule. The gaps are the
// point; the print stylesheet is the onboarding view; the detail pane is the
// file browser, merged (spec §4).
import { buildTree, coverageGaps, selectQuery } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('cov.h'));
  root.append(h);

  const data = await ctx.api('/api/coverage');
  if (data.truncated) {
    const warn = document.createElement('p');
    warn.className = 'spill';
    warn.append(...ctx.t('coverage.truncated', { n: data.files.length }));
    root.append(warn);
  }
  const status = await ctx.api('/api/status');
  const tree = buildTree(data.files);
  const itemsById = new Map(data.items.map((i) => [i.id, i]));

  const printBtn = document.createElement('button');
  printBtn.className = 'no-print';
  printBtn.append(...ctx.t('coverage.print'));
  printBtn.onclick = () => print();
  root.append(printBtn);

  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.gap = '2rem';
  const treeBox = document.createElement('div');
  const detail = document.createElement('div');
  wrap.append(treeBox, detail);
  root.append(wrap);

  function nodeLine(node) {
    const line = document.createElement('div');
    const label = document.createElement('span');
    label.className = node.governedCount === 0 ? 'gap path' : 'path';
    label.textContent = `${node.name || '/'} `;
    const meta = document.createElement('span');
    meta.className = 'dim';
    meta.textContent = `(${node.governedCount}/${node.fileCount})`;
    line.append(label, meta);
    label.style.cursor = 'pointer';
    label.onclick = () => showDetail(node);
    return line;
  }

  function renderTree(node, into, indent) {
    const line = nodeLine(node);
    line.style.paddingInlineStart = `${indent}rem`;
    into.append(line);
    for (const child of node.children) renderTree(child, into, indent + 1);
  }
  renderTree(tree, treeBox, 0);

  async function showDetail(node) {
    detail.innerHTML = '';
    const t1 = document.createElement('h2');
    t1.append(...ctx.t('coverage.governs'));
    detail.append(t1);
    const list = document.createElement('ul');
    for (const id of node.governs) {
      const item = itemsById.get(id);
      const li = document.createElement('li');
      const a = document.createElement('a');
      a.href = '#/graph';
      a.onclick = () => sessionStorage.setItem('myctx-focus', id);
      a.textContent = `${id} — ${item ? item.title : ''}`;
      li.append(a, ` (${item ? item.phrase : ''})`);
      list.append(li);
    }
    detail.append(list);
    if (node.children.length === 0) {
      const t2 = document.createElement('h2');
      t2.append(...ctx.t('coverage.wouldInject'));
      detail.append(t2);
      const sel = await ctx.api(`/api/select?${selectQuery('tool', node.path, ctx.session())}`);
      const ul = document.createElement('ul');
      for (const e of sel.full) {
        const li = document.createElement('li');
        li.textContent = `${e.item.id} [${e.tier}]`;
        ul.append(li);
      }
      detail.append(ul);
    }
  }

  const gapsH = document.createElement('h2');
  gapsH.append(...ctx.t('gaps.h'));
  root.append(gapsH);
  const gapDirs = document.createElement('p');
  gapDirs.append(...ctx.t('coverage.gapDirs'), `: ${coverageGaps(tree).join(', ') || '—'}`);
  gapDirs.className = 'path';
  const emptyCats = Object.entries(status.items.byCategory).length >= 0
    ? Object.values(await ctx.api('/api/help/categories').then((r) => r.corpus.empty)) : [];
  const catLine = document.createElement('p');
  catLine.append(...ctx.t('coverage.emptyCategories'), `: ${emptyCats.join(', ') || '—'}`);
  root.append(gapDirs, catLine);
}
```

```js
// src/ui/public/screens/graph.js
// An ego-graph, not a hairball (spec §4): one focus, radius 1-2, layered
// deterministic layout, 60-node cap with an explicit "+N more", no physics.
import { layoutGraph } from '/lib/viewmodel.js';

const CELL_X = 220; const CELL_Y = 48;

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('gr.h'));
  root.append(h);

  const items = await ctx.api('/api/items');
  const picker = document.createElement('select');
  for (const i of items.items) {
    const opt = document.createElement('option');
    opt.value = i.id; opt.textContent = `${i.id} — ${i.title}`;
    picker.append(opt);
  }
  const stored = sessionStorage.getItem('myctx-focus');
  if (stored && items.items.some((i) => i.id === stored)) picker.value = stored;
  sessionStorage.removeItem('myctx-focus');

  const radius = document.createElement('select');
  for (const r of ['1', '2']) {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = r;
    radius.append(opt);
  }
  const controls = document.createElement('p');
  controls.append(...ctx.t('graph.focus'), ': ', picker, ' ', ...ctx.t('graph.radius'), ': ', radius);
  root.append(controls);
  const box = document.createElement('div');
  root.append(box);

  async function show() {
    box.innerHTML = '';
    const data = await ctx.api(
      `/api/graph?focus=${encodeURIComponent(picker.value)}&radius=${radius.value}`);
    const placed = layoutGraph(data.nodes, data.edges, data.focus);
    const pos = new Map(placed.map((p) => [p.id, p]));
    const width = (Math.max(...placed.map((p) => p.x)) + 1) * CELL_X;
    const height = (Math.max(...placed.map((p) => p.y)) + 1) * CELL_Y;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('width', String(width));
    for (const e of data.edges) {
      const a = pos.get(e.from); const b = pos.get(e.to);
      if (!a || !b) continue;
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', String(a.x * CELL_X + 100));
      line.setAttribute('y1', String(a.y * CELL_Y + 14));
      line.setAttribute('x2', String(b.x * CELL_X + 100));
      line.setAttribute('y2', String(b.y * CELL_Y + 14));
      line.setAttribute('stroke', e.dangling ? '#a01a1a' : '#888');
      if (e.dangling) line.setAttribute('stroke-dasharray', '4 3');
      svg.append(line);
    }
    for (const p of placed) {
      const node = data.nodes.find((n) => n.id === p.id);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', String(p.x * CELL_X));
      text.setAttribute('y', String(p.y * CELL_Y + 18));
      // tFlat, not t: an SVG <text> cannot hold an HTML span, so an isolated
      // run cannot survive here whatever the renderer does — the same sink
      // class as an attribute (§0.6). Named, so it reads as a decision.
      text.textContent = node.missing ? `${p.id} (${ctx.tFlat('graph.dangling')})` : p.id;
      if (node.missing) text.setAttribute('fill', '#a01a1a');
      svg.append(text);
    }
    box.append(svg);
    if (data.omitted > 0) {
      const more = document.createElement('p');
      more.append(...ctx.t('graph.more', { n: data.omitted }));
      box.append(more);
    }
  }
  picker.onchange = show;
  radius.onchange = show;
  await show();
}
```

- [ ] **Step 4: Run tests, suite, smoke (including print preview for the coverage map)**

Run: `node --test test/ui/viewmodel.test.ts && npm test`; manual smoke per Task 16 Step 6.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/screens/coverage.js src/ui/public/screens/gaps.js src/ui/public/screens/graph.js src/ui/public/lib/viewmodel.js test/ui/viewmodel.test.ts
git commit -m "feat(ui): scope coverage with detail pane and print mode, coverage gaps as its own screen, deterministic ego graph"
```

---

## Task 19: Doctor, Decay, Status and Learn screens

> **Mockup — the specification for these four screens** (§0.2): `data-p="doctor"`, `data-p="decay"`,
> `data-p="status"` and `data-p="learn"` in `docs/design/web-ui-mockup.html`. The Learn screen's title
> is **`Learn`** (`ln.h`, `s.learn`), not "Help".
>
> **Doctor** groups by finding code with the three levels kept in **separate cards** — `error`,
> `warning`, `notice` (`doc.notice`) — each with a composed, never-run repair command
> (`doc.h`/`doc.sub`). **Decay draws two charts from two sources** and the second is not servable here:
> the **recency comb** (`#comb`, §0.3 row 7) is fully served; the **90-day heatstrip** (`#heat`, row 8)
> needs the audit projection and **must not be approximated from the ledger** — a heatstrip with no
> hatched spill days asserts the opposite of what the view exists to show. **Status is a table and a
> recorded exception** (its verdict chip is ⚠️, not ✅) and it is **not the landing screen**: *"Not the
> landing screen, and no longer justified by being one. It is where the header's corpus counts lead"*
> (`st.sub`). It lists **five** rows and says why — *"There are **four** unfinished-work queues, not
> one"* (`st.four`). **Learn** is the four help topics joined to items in this corpus (`ln.c`, `ln.s`,
> `ln.p`, `ln.w`); that join is the whole justification for the screen.

**Files:**
- Create: `src/ui/public/screens/status.js`, `src/ui/public/screens/doctor.js`, `src/ui/public/screens/decay.js`, `src/ui/public/screens/learn.js`
- Modify: `src/ui/public/lib/viewmodel.js` (+ `groupFindings`, `decayBuckets`, `renderMarkdown` — pure)
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: `/api/status`, `/api/doctor`, `/api/decay`, `/api/help/:topic`, `/api/item/:id`.
- Produces (pure): `groupFindings(findings): Map<code, Finding[]>` (level order error→warn→info inside each group); `repairCommandFor(code, item): string | null` — the **composed, never run** repair command per doctor code (`index_stale` → `mycontext rebuild`, `source_drift`/`source_missing` → `mycontext repair <id>`, `orphan_relation` → `mycontext repair <id>`, others → null; establish the exact command per code by reading `src/doctor/checks.ts`'s finding messages during implementation — each message already names its remedy, and the composed command must match the message's own recommendation, not this table); `decayBuckets(series, days): { day: string; count: number }[]`; `renderMarkdown(md): string` (minimal, safe: headings, fenced code, lists, inline code, paragraphs — all text escaped; no raw HTML pass-through).

- [ ] **Step 1: Failing tests** (append to `test/ui/viewmodel.test.ts`)

```ts
test('groupFindings groups by code and keeps level order', async () => {
  const { groupFindings } = await import('../../src/ui/public/lib/viewmodel.js');
  const groups = groupFindings([
    { level: 'info', code: 'b', message: 'i' },
    { level: 'error', code: 'a', message: 'e' },
    { level: 'warn', code: 'a', message: 'w' },
  ]);
  assert.deepEqual([...groups.keys()], ['a', 'b']); // error-bearing groups first
  assert.deepEqual(groups.get('a')!.map((f) => f.level), ['error', 'warn']);
});

test('decayBuckets counts injections per UTC day', async () => {
  const { decayBuckets } = await import('../../src/ui/public/lib/viewmodel.js');
  const buckets = decayBuckets([
    { injectedAt: '2026-08-01T10:00:00.000Z' },
    { injectedAt: '2026-08-01T23:59:00.000Z' },
    { injectedAt: '2026-08-03T00:00:00.000Z' },
  ]);
  assert.deepEqual(buckets, [
    { day: '2026-08-01', count: 2 },
    { day: '2026-08-03', count: 1 },
  ]);
});

test('renderMarkdown escapes HTML and renders structure', async () => {
  const { renderMarkdown } = await import('../../src/ui/public/lib/viewmodel.js');
  const html = renderMarkdown('# T\n\n<script>x</script>\n\n- a\n- b\n\n`code`');
  assert.match(html, /<h1>T<\/h1>/);
  assert.ok(!html.includes('<script>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /<li>a<\/li>/);
  assert.match(html, /<code>code<\/code>/);
});
```

- [ ] **Step 2: See them fail, implement the view-models** (append to `viewmodel.js`)

```js
const LEVEL_ORDER = { error: 0, warn: 1, info: 2 };

export function groupFindings(findings) {
  const groups = new Map();
  for (const f of findings) {
    if (!groups.has(f.code)) groups.set(f.code, []);
    groups.get(f.code).push(f);
  }
  for (const list of groups.values()) list.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
  return new Map([...groups.entries()].sort((a, b) => {
    const worst = (list) => Math.min(...list.map((f) => LEVEL_ORDER[f.level]));
    return worst(a[1]) - worst(b[1]) || (a[0] < b[0] ? -1 : 1);
  }));
}

export function decayBuckets(series) {
  const counts = new Map();
  for (const e of series) {
    const day = e.injectedAt.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  return [...counts.entries()].sort().map(([day, count]) => ({ day, count }));
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderMarkdown(md) {
  const lines = md.replaceAll('\r\n', '\n').split('\n');
  const out = [];
  let inCode = false; let inList = false; let paragraph = [];
  const flushP = () => {
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  };
  const closeList = () => { if (inList) { out.push('</ul>'); inList = false; } };
  const inline = (text) =>
    escapeHtml(text).replace(/`([^`]+)`/g, (m, code) => `<code>${code}</code>`);
  for (const line of lines) {
    if (line.startsWith('```')) {
      flushP(); closeList();
      out.push(inCode ? '</pre>' : '<pre>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(escapeHtml(line)); continue; }
    const heading = line.match(/^(#{1,4})\s+(.*)$/);
    if (heading) {
      flushP(); closeList();
      const n = heading[1].length;
      out.push(`<h${n}>${inline(heading[2])}</h${n}>`);
      continue;
    }
    if (line.startsWith('- ')) {
      flushP();
      if (!inList) { out.push('<ul>'); inList = true; }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }
    if (line.trim() === '') { flushP(); closeList(); continue; }
    paragraph.push(line);
  }
  flushP(); closeList();
  if (inCode) out.push('</pre>');
  return out.join('\n');
}

export function repairCommandFor(code, item) {
  // Composed, never run (spec §4 Report): the exact remedy per code was
  // established by reading src/doctor/checks.ts's finding messages — each
  // message names its own remedy, and this mapping must agree with it.
  if (code === 'index_stale' || code === 'index_missing') return 'mycontext rebuild';
  if ((code === 'source_drift' || code === 'source_missing' || code === 'orphan_relation') && item) {
    return `mycontext repair ${item}`;
  }
  return null;
}
```

(`repairCommandFor`'s mapping is the establish-by-executing point: verify each code's remedy against the message text in `src/doctor/checks.ts` — e.g. `:146`, `:171`, `:225`, `:239` — and correct the mapping to what the messages themselves recommend before committing; add a unit assertion per corrected row.)

- [ ] **Step 3: Implement the four screens**

```js
// src/ui/public/screens/status.js
// The landing screen — §4's recorded EXCEPTION: a table is a terminal's home
// ground, kept because something has to be the landing screen. It stays a
// table and claims nothing more.
export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('st.h'));
  root.append(h);
  const s = await ctx.api('/api/status');
  const meta = await ctx.api('/api/meta');
  // Each entry is an ARRAY OF NODES, because `ctx.t` returns nodes (§0.6), so
  // the loop spreads instead of assigning. The untranslated `mycontext
  // <version>` is appended BESIDE the translated part rather than interpolated
  // into it: a template literal cannot carry an isolated run, and building one
  // here is how a `{mv:…}` gets flattened three tasks after the renderer was
  // fixed.
  const lines = [
    [`mycontext ${s.version} — `, ...ctx.t('status.items', { n: s.items.total }),
      `, profile ${s.profile}`],
    ctx.t('status.drafts', { n: s.reviewQueue.drafts }),
    ctx.t('status.revisions', s.pendingRevisions),
    ctx.t('status.health', s.health),
  ];
  for (const nodes of lines) {
    const p = document.createElement('p');
    p.append(...nodes);
    root.append(p);
  }
  for (const [title, counts] of [['byCategory', s.items.byCategory], ['byStatus', s.items.byStatus], ['byOrigin', s.items.byOrigin]]) {
    const table = document.createElement('table');
    for (const [name, n] of Object.entries(counts)) {
      const tr = document.createElement('tr');
      const td1 = document.createElement('td'); td1.textContent = name;
      const td2 = document.createElement('td'); td2.textContent = String(n);
      tr.append(td1, td2);
      table.append(tr);
    }
    const cap = document.createElement('h2');
    cap.textContent = title;
    root.append(cap, table);
  }
  // meta.git is plan 3's strip data; the landing screen shows nothing of it
  // here — rendering it is Watch's task, and this line exists so nobody
  // "helpfully" adds it to this screen ahead of plan 3.
  void meta;
}
```

```js
// src/ui/public/screens/doctor.js
// Findings grouped by code, three levels visually distinct, each linked to
// the item it names and to the command that repairs it — COMPOSED, NOT RUN
// (spec §4): a findings list flattened to "exit 1" is what a terminal loses.
import { groupFindings, repairCommandFor } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('doc.h'));
  root.append(h);
  const data = await ctx.api('/api/doctor');
  for (const [code, findings] of groupFindings(data.findings)) {
    const section = document.createElement('section');
    const title = document.createElement('h2');
    title.textContent = code;
    section.append(title);
    const list = document.createElement('ul');
    for (const f of findings) {
      const li = document.createElement('li');
      li.className = f.level === 'error' ? 'gap' : f.level === 'warn' ? 'spill' : 'dim';
      li.append(`[${f.level}] ${f.message}`);
      const repair = repairCommandFor(code, f.item);
      if (repair) {
        const cmdBox = document.createElement('div');
        const cmd = document.createElement('code');
        cmd.textContent = repair;
        const note = document.createElement('span');
        note.className = 'dim';
        note.append(' — ', ...ctx.t('doctor.repair'));
        const copy = document.createElement('button');
        copy.append(...ctx.t('btn.copy'));
        copy.onclick = () => navigator.clipboard.writeText(repair);
        cmdBox.append(cmd, ' ', copy, note);
        li.append(cmdBox);
      }
      list.append(li);
    }
    section.append(list);
    root.append(section);
  }
}
```

```js
// src/ui/public/screens/decay.js
// Decay over time is a chart, not a table (spec §4) — and the chart carries
// decay's own caveat about its window, because a report that hides its
// measurement window overstates its confidence.
import { decayBuckets } from '/lib/viewmodel.js';

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('dec.h'));
  root.append(h);
  const data = await ctx.api('/api/decay');
  const caveat = document.createElement('p');
  caveat.className = 'dim';
  caveat.append(...ctx.t('decay.caveat', {
    window: data.report.window, recorded: data.report.sessionsRecorded,
  }));
  root.append(caveat);

  const buckets = decayBuckets(data.series);
  const max = Math.max(1, ...buckets.map((b) => b.count));
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  const W = Math.max(300, buckets.length * 14); const H = 120;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', String(W));
  buckets.forEach((b, i) => {
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    const height = Math.round((b.count / max) * 100);
    rect.setAttribute('x', String(i * 14));
    rect.setAttribute('y', String(H - height));
    rect.setAttribute('width', '10');
    rect.setAttribute('height', String(height));
    rect.setAttribute('fill', '#205a9e');
    const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
    title.textContent = `${b.day}: ${b.count}`;
    rect.append(title);
    svg.append(rect);
  });
  root.append(svg);

  const cold = document.createElement('h2');
  cold.textContent = 'cold';
  root.append(cold);
  const list = document.createElement('ul');
  for (const row of data.report.cold) {
    const li = document.createElement('li');
    li.textContent = `${row.id} (${row.type}) — last: ${row.lastUsed ?? '—'}`;
    list.append(li);
  }
  root.append(list);
}
```

```js
// src/ui/public/screens/learn.js
// §4's conditional pass: every topic cross-links to YOUR corpus — the join is
// the whole justification; without it this is a documentation viewer and
// should be cut.
import { renderMarkdown } from '/lib/viewmodel.js';

const TOPICS = ['categories', 'scope', 'capture', 'workflow'];

export async function render(root, ctx) {
  root.innerHTML = '';
  const h = document.createElement('h1');
  h.append(...ctx.t('ln.h'));
  root.append(h);
  const picker = document.createElement('select');
  for (const topic of TOPICS) {
    const opt = document.createElement('option');
    opt.value = topic; opt.textContent = topic;
    picker.append(opt);
  }
  root.append(picker);
  const doc = document.createElement('article');
  const corpusBox = document.createElement('aside');
  root.append(doc, corpusBox);

  async function show() {
    const data = await ctx.api(`/api/help/${picker.value}`);
    doc.innerHTML = renderMarkdown(data.markdown); // escaped inside renderMarkdown
    corpusBox.innerHTML = '';
    const ch = document.createElement('h2');
    ch.append(...ctx.t('learn.corpusLinks'));
    corpusBox.append(ch);
    const list = document.createElement('ul');
    const c = data.corpus;
    if (picker.value === 'scope') {
      for (const i of c.scoped) list.append(li(`${i.id} — ${i.scope.join(', ')}`));
      for (const i of c.unscoped) list.append(li(`${i.id} — (no scope; policy: ${i.policy})`));
    } else if (picker.value === 'categories') {
      for (const [name, n] of Object.entries(c.counts)) list.append(li(`${name}: ${n}`));
      list.append(li(...ctx.t('coverage.emptyCategories'), `: ${c.empty.join(', ') || '—'}`));
    } else if (picker.value === 'capture') {
      const label = document.createElement('p');
      label.className = 'dim';
      label.append(...ctx.t('learn.recentCaptures'));
      corpusBox.append(label);
      for (const r of c.recent) list.append(li(`${r.id} — ${r.mtime}`));
    } else {
      list.append(li(...ctx.t('status.drafts', { n: c.drafts })));
      list.append(li(...ctx.t('status.revisions', c.pendingRevisions)));
    }
    corpusBox.append(list);
  }
  // Nodes and strings, because ctx.t returns nodes (§0.6) and append takes
  // both. Assigning textContent here would flatten every isolated run the
  // string tables mark, which is the defect this renderer exists to prevent.
  function li(...nodes) {
    const el = document.createElement('li');
    el.append(...nodes);
    return el;
  }
  picker.onchange = show;
  await show();
}
```

Add any string keys these screens introduced to **both** tables (the parity test enforces it).

- [ ] **Step 4: Run everything**

Run: `node --test test/ui/viewmodel.test.ts && npm test && npx tsc --noEmit`; manual smoke of all four screens, both languages.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public test/ui/viewmodel.test.ts
git commit -m "feat(ui): doctor, decay, status and corpus-joined Learn"
```

---

## Task 20: Documentation — both documents, always

**Files:**
- Modify: `README.md` (new subsection under the CLI commands section: `mycontext ui`)
- Modify: `docs/README.he.md` (the same subsection, same position, Hebrew, inside `<div dir="rtl">` as the document already does)

**Interfaces:**
- Consumes: everything shipped above.
- Produces: user documentation; `test/docs/parity.test.ts` (existing) holds the two structures equal.

- [ ] **Step 1: Establish the insertion point by executing**

Run `git grep -n "## " README.md | head -50` and find where commands are documented; place the new heading at the same depth and position in both documents. The parity test (structure and order) is the failing-test half of this task: adding the section to one document and running `npm test` shows the parity failure; adding it to the other clears it.

- [ ] **Step 2: Write the section (English), covering exactly what shipped**

Content requirements (prose, not a spec dump — write it in the README's own register):
- `mycontext ui [--port N] [--no-open]` — read-only web UI on `127.0.0.1`.
- **What it can never do, with the mechanism in the same sentence:** the UI executes no writes — no `/api` route reaches a mutating function, enforced by a static import-graph test — and every write it shows is composed for pasting into your own shell, so your Bash permission rules keep matching command strings.
- The token model in two sentences: per-invocation token, custom header, one-shot handoff nonce in the URL fragment; the token never appears on a process command line.
- Ephemerality: exits after 15 minutes with no `/api` request; a page in a background window stops heartbeating; the page says when the server has exited and does not reconnect.
- The screens, one line each (preview with per-session `seen`, coverage map with gaps and print mode, budget simulator, current injections, ego graph, status/doctor/decay, corpus-linked help; English and Hebrew).
- Condition-carrying claims only (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`): e.g. "the preview equals the hook's selection **when given the same session**; the cold option answers a different question and is labelled as one."

- [ ] **Step 3: Run the parity test and see it fail (one document updated), then write the Hebrew section and see it pass**

Run: `npm test` (specifically `test/docs/parity.test.ts`) — fail, then green.

- [ ] **Step 4: Full gate**

Run: `npm test && npx tsc --noEmit && npm run test:perf && git status --porcelain`
Expected: all green, tree clean after commit. (`test:perf` guards the hook budget; nothing in this plan touches the hook path, and the run proves it.)

- [ ] **Step 5: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: document mycontext ui in both READMEs"
```

---

## Self-Review

Performed against the spec with fresh eyes after writing, per the writing-plans skill.

**1. Spec coverage (plan-1 scope only):**

| Spec requirement | Task |
|---|---|
| §2.1 loopback only, refuse otherwise | 13 (throw), E2E test `non-loopback bind is refused` |
| §2.2 token, custom header, Origin/Host, no CORS, fragment handoff | 2, 13, 16 |
| §2.3 idle = no non-stream /api for 15 min; stream not activity; heartbeat while visible; exit banner, no reconnect | 3, 8 (stream kind), 13, 16 |
| §3 zero deps, no framework/build; compose-don't-reimplement; the nine named functions | Global Constraints; 8-11 compose them; `isNormative` handled via `injection()` (11), `itemCost` exported not copied (5) |
| §3 `/api/select` with `seen`, session selector contract, cold labelled, empty-ledger case | 8, 9, 16 |
| §3 English/Hebrew structurally mirrored; logical CSS; `<html dir>`; LTR paths inside RTL | 1, 16 (styles.css + i18n) |
| §3 browser opening: per-platform spawn, empty title arg, first child_process in src/, nonce not token in URL, `--no-open` prints and spawn-failure falls back | 15 |
| `nav.inj`: injection preview, scope coverage (+detail pane, print), coverage gaps **as its own screen**, budget simulator, injected now | 17, 18 |
| `nav.ev`: relations ego graph (radius, 60 cap, "+N more", no physics, dangling **and** load-bearing edges), doctor grouped by code with composed repairs, decay's two charts, status as the recorded table exception | 10, 11, 19 |
| `nav.read`: `learn` — topics cross-linked to the corpus, or cut | 11, 19 |
| The mockup's 329-key EN/HE table, both-direction parity, all three run markers rendered as nodes | 1, 16 |
| **The eighteen graphical views** — which are served, which need a field, which need an endpoint that does not exist | **§0.3 — surveyed, not designed. Four cannot be served at all.** |
| §4 Watch status strip's git constraint (read `.git` as files, no ahead/behind, no working tree) | 4 builds and tests the reader + `/api/meta` (13); rendering is plan 3's |
| §6 endpoints tested by spawning a real process; security assertions first-class; nonce refused on reuse and after window | 13 |
| §6 the inverted write test — **two halves** (§0.5): a static import graph scoped to `src/ui/` and asserting the ruled write set exactly, and a runtime byte-identical-corpus assertion scoped to the served-read path with the refusal write proved and bounded beside it (§0.6) | 14 (static), 13 (runtime) |
| §6 `/api/select` = `select()` as JSON structural equality incl. a seen-changes-outcome case | 8 |
| §6 string-table parity with the honesty docstring | 1 |
| §6 the rendering-untested limit stated in the test file | 13 (E2E header), 16 (viewmodel header) |
| §7 "not a write path at all", "not a git client", single-user/localhost/ephemeral | 13, 14, 4 |
| §8 risk rows in plan-1 scope | each maps to the tasks above |
| §9 decisions 3 and 5 | 11 (matchesScope+injection), 9/16 (session selector) |

Out of plan-1 scope, deliberately: §4 Work/Configure (plan 2); §4 Watch audit stream, §4b bridge, Ask, §5 entirely (plan 3 — the audit log's *projection* and its stream are plan 3's). **Corrected 2026-08-20:** this line used to say the audit log itself "does not exist on this branch" and that `src/core/audit.ts` "is on `phase-5/quality`". It is on `master`, with `recordAudit`, `readAudit`, rotation and a `doctor` size check — which is why ruling B4 (§0.6) can put the refusal record in the existing log instead of inventing one, and why `audit.ts` is already a row in Task 14's banned-symbol table. A scope note that names a branch is re-read when the branch merges.

**2. Placeholder scan:** the plan contains four **explicit establish-by-executing points**, each with the concrete procedure and the assertion that must exist afterwards (Task 6 log-line shape and `foldLog` closure; Task 11 graph-relation fixture mechanics and the cap-60 fixture; Task 19 `repairCommandFor` mapping verified against checks.ts messages; Task 20 insertion point). These are not TBDs: each names what to execute, what to read, and what the committed artefact must contain. No "add error handling", no "similar to Task N", no test named without its code.

**3. Type consistency:** `JsonResult` is defined once (routes.ts, Task 8) and consumed by read-model and server; `SessionSummary`/`InjectionEvent` defined in Task 7 and consumed in 9/10; `GitInfo` defined in Task 4 and consumed in 13; `RouteHandler.kind` spelling (`'json' | 'stream'`) is identical in 8 and 13; the eight banned names in Task 14 match the grep-verified export list in the Verified Facts table; `TOKEN_HEADER` lower-case server-side (2), sent as `X-Mycontext-Token` by app.js (16) — Node lower-cases on receipt, stated in Task 2. `pendingRevisionCounts`'s widened parameter (Task 6) is consumed with summaries in Task 10 and with the same shape in Task 11.

**Known deviations from the spec, named rather than silent:**
- The printed-URL nonce lifetime (10 minutes) is a plan decision the spec does not fix; the spec fixes only the opener's 10 seconds (Design decision 5).
- `localhost` spellings are refused, not aliased (Task 2) — the spec says loopback-only and names `127.0.0.1` throughout; one accepted spelling is one thing to audit.
- The Learn screen's "most recent captures" uses file mtime with an on-screen label, because no creation timestamp exists anywhere in the item schema (Design decision 9) — the honest rendering of a spec sentence whose data does not exist.
- **The UI is no longer *"not a write path at all"* in the spec's absolute words** (§7). Owner ruling B4, 2026-08-20 (§0.6): a **refused** request appends one `access` record to the audit log, naming the check that refused and the submitted `Host`/`Origin`. It is one write, on the refusal path, never on a served read, and both halves of the §0.5 enforcement are amended to assert exactly that rather than to look away from it. Named here because the spec sentence is quoted three tasks above this line, and a ruling that contradicts a quoted spec sentence without saying so is how a plan starts asserting a property its code does not have.

**Known deviations from the mockup, named rather than silent (added 2026-08-20):** this plan **cannot
render four of the eighteen graphical views** — the gate ladder on its own flagship screen, the
spill-ratio bar, the 90-day heatstrip and the per-item sparkline (§0.3 rows 17, 4, 8, 9). Three of them
want one endpoint that does not exist in any of the three plans; one wants a disclosure no module in
`src/` produces. **The instruction's response to that is to stop and ask, not to ship a weaker view**,
so those four are escalated in §0.4 rather than approximated here. Four further views need one added
field each, all of which this pass added to the plan's own endpoints (`tiersRun`, `loadBearing`) or
recorded as a required change to one (`/api/coverage`'s unexamined paths, per-line index costs).

---

## Produces summary — the interface plans 2 and 3 consume

```ts
// src/ui/routes.ts
interface ApiContext { ws: Workspace; repoRoot: string; url: URL; params: Record<string, string>; body: unknown }
interface JsonResult { status: number; body: unknown }
type RouteHandler =
  | { kind: 'json'; handle(ctx: ApiContext): JsonResult | Promise<JsonResult> }
  | { kind: 'stream'; handle(ctx: ApiContext, res: ServerResponse): void };  // plan 3's stream slot; never idle-touched
function registerRoute(method: 'GET' | 'POST', path: string, handler: RouteHandler): void;

// src/ui/server.ts
function startUiServer(options: UiServerOptions): Promise<RunningUiServer>;
const OPENER_NONCE_TTL_MS = 10_000; const PRINTED_NONCE_TTL_MS = 600_000;

// src/ui/git-info.ts  (plan 3 renders it; /api/meta already serves it)
interface GitInfo { branch: string | null; commit: string | null; upstream: 'in-sync' | 'differs' | 'no-upstream'; detached: boolean }
function readGitInfo(repoRoot: string): GitInfo | null;

// src/core/revision-log.ts  (plan 2 reads the queue from HERE, never revision.ts)
function readLog(root: string): LogLine[];
function foldLog(lines: LogLine[]): /* folded records; state/'pending' filterable */;
function pendingRevisionSummaries(root: string): { revisionId: string; itemId: string }[];
function pendingRevisionCounts(revs: { itemId: string }[]): { revisions: number; items: number };

// src/core/ledger.ts additions
Ledger.history(): InjectionEvent[];              // { sessionId; itemId; tier; injectedAt }
Ledger.sessionSummaries(limit): SessionSummary[]; // { sessionId; lastInjectedAt; itemCount }

// src/core/select.ts addition
function itemCost(item: Item): number;

// HTTP surface (all GET unless noted; token header X-Mycontext-Token; unknown params → 400)
POST /api/handoff { nonce } → { token }
GET  /api/ping → { ok: true }
GET  /api/meta → { version, projectRoot, repoRoot, git: GitInfo | null }
GET  /api/select?event=&path=&session=|cold=1[&restore=] → Selection (select() JSON, exactly)
GET  /api/render?…same → { text }
GET  /api/simulate?…same[&pinned=&jit=&restored=&index=] → { selection, budgets, costs, tiersRun }
GET  /api/sessions → { default, sessions }
GET  /api/session/:session/injected → { lines, error }   // the SEEN FILE, not the Ledger (§0.2)
GET  /api/status | /api/doctor | /api/decay?window= | /api/coverage | /api/graph?focus=&radius= |
     /api/items | /api/item/:id | /api/help/:topic
//   /api/graph edges carry `loadBearing` as well as `dangling` (§0.3 row 14).

// browser modules (plans 2/3 screens)
window.myctx = { api(path), t(key, subs) /* → Node[] */, tFlat(key, subs) /* → string */, session(), onSessionChange(fn), navigate(hash) };
//   t() RETURNS NODES, always: `el.append(...ctx.t(key, vals))`. tFlat() is the same parse
//   flattened, and is for attributes and <option> labels only — the sinks that cannot hold an
//   element. THREE run markers, TWO treatments: {name} an isolated span.v around a substituted
//   value, {m:text} a monospace isolated span.m around a literal, {mv:name} that same monospace
//   isolated span (class "m v") around a substituted value. A plain slot is isolated too — there is
//   no unisolated case, and no fourth marker. A missing key throws; so does a missing substitution.
strings tables: src/ui/public/strings/{en,he}.js — add keys to BOTH; parity tests enforce the key
sets in both directions, AND against the `data-t` keys in docs/design/web-ui-mockup.html, AND the
marker structure key for key. A string with no mockup entry fails the suite: the mockup is
the UI specification, so a new sentence is a design change and the mockup changes first.
NAV has FOUR groups — nav.inj, nav.ev, nav.ch, nav.read. Plans 2 and 3 add screens INTO them:
`work`, `capture`, `palette`, `config` → nav.ch;  `watch`, `ask` → nav.ev.  Neither adds a group.
```

**Three read models plans 2 and 3 will look for and will not find here** (§0.3): a per-item
delivered-vs-spilled series from the audit projection (`audit_item.role` × `audit.at`), which three
plan-1 views need and only plan 3 is near; a budget **sweep** response for the simulator's staircase and
threshold ladder; and a gate-ladder disclosure for the injection preview. None is designed in this plan
and none should be improvised in another — they are escalations, listed in §0.4.

Execution: use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`, task by task, in order — Tasks 1-7 are independent of each other except 5→8 and 6→10; 8-11 build read-model incrementally; 12-13-14-15 must run in that order; 16-19 need 13; 20 last.
