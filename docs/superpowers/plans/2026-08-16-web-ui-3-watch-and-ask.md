# Web UI Plan 3 of 3 — Watch, Ask, and the status line bridge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Watch surface (the live audit stream with spills as its centrepiece, plus the status strip), the Ask surface (a structured query builder over the corpus and the audit projection — fields, operators and values, bound as parameters and composed on the server, with the composed SQL **shown read-only** — the owner kept it on 2026-08-20 and the mockup gained the pane first, `ask.sqlh`/`ask.sqln`; the no-SQL rule is about INPUT and is untouched: §0), and the opt-in `mycontext statusline` bridge that tees Claude Code's context figure to a per-session file the UI joins to the audit log on `session_id`.

**Architecture:** Watch tails the audit JSONL through a new `AuditTail` (per-segment byte offsets, complete lines only, resync on divergence) behind Plan 1's `kind: 'stream'` route slot — the slot that deliberately never touches the idle timer, so the 15-minute idle exit still fires with a stream open. Ask composes the shipped projection functions (`openProjection`/`syncProjection`/`queryProjection`/`summaryByOp`/`topItems`/`sessions`) and every audit answer catches up first or refuses — never a quiet partial. The bridge is a CLI command, not a UI endpoint: the one thing in this plan that writes a file, and it is opt-in with a print-and-ask installer.

**Tech Stack:** Node ≥ 24 built-ins only (`node:http`, `node:fs`, `node:sqlite` via existing core modules). No framework, no build step, no runtime dependency. Browser code is hand-written ES modules consuming Plan 1's `window.myctx` contract.

**Spec:** `docs/superpowers/specs/2026-08-16-web-ui-design.md` — the binding authority. This plan argues from it; executors read both. §4 (Watch), §4b (the bridge), §5 (the audit log), and the Ask entry in §4 are this plan's sections.

**Mockup — the UI specification:** `docs/design/web-ui-mockup.html`, rebuilt twice since this plan was written and now the design of record: 21 screens (the `data-p` sections `preview` … `learn`), a four-group rail, 18 restored graphical views, 326 unique `data-t` string keys each with a Hebrew pair, an item detail pane, a provenance bar and a print stylesheet. `INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` (active, always, 2026-08-20) makes it binding for the UI: **the mockup decides the screens that exist, what each one shows, where a control lives, what a chart plots, what an empty state looks like, and what the words are.** Do not add a screen, panel, control or field it does not show; do not drop one it does; do not render a weaker version of one; do not reword. An element marked `PROPOSED` is still specified.

`docs/superpowers/specs/2026-08-16-web-ui-design.md` remains the binding authority for everything that is **not** the rendered surface — the server, the security gate, the route contracts, the projection's staleness rule, §4b's arithmetic, the no-writes rule. Where it and the mockup disagree **about the UI**, that is not a licence to pick one: it is the case the instruction says to **stop and ask the owner**. §0 below lists every such disagreement this plan carries.

**Unresolved, for the owner:** the companion `docs/design/web-ui-mockup.md` still opens with "where this file and the spec disagree, the spec wins" and describes a mockup that shows "SQL as the input" and has "no `focus-set`/`focus-clear`" in its audit stream — a mockup two rebuilds old, and wrong about both. That file is outside this plan's edit scope and is left untouched; it needs the owner's pass before an implementer reads it as guidance.

**Scope split (binding):** This is plan 3 of 3.
- **Plan 1 (shipped first):** the server, security, idle, `/api/select`, Core/Navigate/Report/Learn, `registerRoute` with the `kind: 'stream'` slot, `readGitInfo`, `/api/sessions`, the string tables and `window.myctx`. This plan consumes its **Produces** blocks exactly and renames nothing.
- **Plan 2 (not here):** the mockup's `work`, `capture`, `palette` and `config` screens.
- **Plan 3 (this document):** **two** of the mockup's screens and no more — `watch` (`watch.h` **Audit stream**) and `ask` (`ask.h` **Ask**) — plus the §4b status line bridge and the footer strip.
- **Not this plan, though they share the mockup's `nav.ev` group:** `doctor`, `decay`, `graph` (Relations) and `status` are **plan 1's** — its Task 10 (status, doctor, decay), Task 11 (coverage, graph, items, help), Task 18 (the ego graph) and Task 19 (Report and Learn). This plan owns the **audit projection those screens read from**, which is not the same thing as owning the screens; the seam is recorded in §0.

**Execution prerequisite (verify before Task 1):** this plan is written against a tree where three lines of work are merged: **Plan 1's output** (the `src/ui/` server surface), **Phase 5's audit log** (`src/core/audit.ts`, `src/core/audit-db.ts`, `src/core/jsonl-log.ts`, currently on `phase-5/quality`), and **the injection token count** (`tokens` on `AuditRecord`, currently on `audit-injection-token-count`, one commit ahead of `phase-5/quality`: `c61bacc`). Task 1 Step 1 establishes the merged surface by executing, not by trusting this paragraph.

---

## Global Constraints

- **Zero runtime dependencies.** Node 24 native TypeScript type-stripping, no build step, `erasableSyntaxOnly`, explicit `.ts` import extensions. No framework, no bundler, no CDN.
- **The UI executes no writes, anywhere.** No `/api` route may reach a mutating function. Enforced by a static import-graph test, not by discipline.
- **Never write a comment, message, doc or corpus item asserting a property the code does not have.** This project has 30+ recorded instances; several were introduced by tasks fixing other instances.
- **Nothing is ever dropped silently.** A field accepted and ignored is the one unacceptable failure.
- **Guarantee claims carry their condition in the same sentence** (`STD-guarantee-claims-carry-their-condition-in-the-same-sentence`).
- **Every change needs a test that fails without it.** `npm run mutate` refuses a dirty tree — commit first.
- `npm test`, `npx tsc --noEmit`, `npm run test:perf` clean; `git status --porcelain` clean.
- **Both documents, always** for any README change: `README.md` and `docs/README.he.md`.
- RTL is not retrofitted: logical CSS properties from the first stylesheet, one string table per language with a key-parity test.

---

## 0. Corrections — what this plan asserted that no longer holds

<!-- retired-phrases
private readFrom
its one call site
readFrom` to `readCompleteLines`
The spec outranks it
Spec outranks it
with the SQL it runs shown
the mockup's filters and rows cover only three record kinds
it has no structured filters, which the spec requires
'branch {branch} @ {commit}'
'detached HEAD @ {commit}'
'in sync with origin/{branch}'
'differs from origin/{branch}'
/api/watch/volume?hours=
injectionVolume
Injections, last {hours}h
answers from the ledger
fn: (store: Store, ledger: Ledger) => T
opens `Store` before `Ledger`, closes both
name controls the mockup does not have and must not ship
.textContent = t(
${t('
-->

**Re-verified 2026-08-18** against `master`, per `2026-08-18-v2-decisions.md` §1. This plan was written
on `plan/web-ui-watch`, reading audit files from the branches named in its own table. Fewer of its
facts moved than plans 1 and 2 — it was written last and against the most settled surface — and its
external Claude Code table was already established by execution and version-pinned, which is the
standard the other two should have met.

Every row names the **class** of error, not only the instance (`2026-08-18-v2-decisions.md` §3).

| Was | Is | Class | Where |
|---|---|---|---|
| The offset reader is `readFrom`, **private** at `audit-db.ts:178` | **It is `readSegmentFrom`, and it is already `export`ed.** Half of Task 1's first seam is therefore already done | A task that exists to expose a symbol re-checks whether it is still hidden; work already landed is not work to plan | **Task 1** |
| `readSegmentFrom` has one caller, inside `audit-db.ts` | **It has a second, in `core/ledger-replay.ts`** — a module that did not exist when this plan was written, created when the Ledger became a replayed projection. Renaming it to `readCompleteLines` is a **two-file** change, not one | A rename's blast radius is re-measured at execution time; a caller list is a snapshot, not a property | **Task 1** |
| `audit_item.role` is constrained to `('subject','injected','spilled')` | **The schema declares only `role TEXT NOT NULL`.** The three roles are a convention the writer upholds and the *comment* documents, not a constraint the database enforces | A value set enforced by convention is described as a convention; calling it a constraint invites a reader to trust the database for it | Tasks 1, 7 |
| `AuditRecord` and `tokens?` are read "on `audit-injection-token-count`" | **Both are on `master`.** That branch merged; the field shipped as `tokens?: number` with its absence-means-not-recorded doc comment intact | A fact cited to a branch is re-cited to the mainline once the branch lands, or the citation slowly becomes archaeology | Tasks 6, 11 |
| §4b's "neither side produces a per-turn identifier" is stale — Claude Code 2.1.233 produces `prompt_id` | **Still true, and the spec has now been amended.** `2026-08-16-web-ui-design.md` §4b scopes the claim to what this repository can assert, and writes down the condition under which a finer join becomes possible. Nothing in this plan depended on either reading | A drift a plan finds in its own spec is escalated to the spec, not carried as a footnote in the plan | §4b |

**What this plan got right that the other two did not, recorded because it is the standard:** its
external-dependency table states *how* each fact was established (string extraction from the installed
binary), pins the version (`2.1.233`, `GIT_SHA f8d5756…`), and makes Task 3 Step 1 **re-run the
extraction on the executor's machine**. A fact about someone else's software carries its provenance and
its own re-check. That is the shape `2026-08-18-v2-decisions.md` §2 generalises into a checker.

### Re-verified 2026-08-20 against the rebuilt mockup

The mockup was rebuilt twice after this plan was written — its own header records the latest pass
(`Regenerated 2026-08-19 (third pass) after a twelve-expert panel.`) — and
`INSTR-the-mockup-is-the-ui-specification-build-it-exactly-and-ask` then made it the UI
specification. Rows below are places this plan told an implementer something the rebuilt mockup
contradicts, which under that instruction is an instruction to violate it. Anchors are `data-p` /
`data-s` values, element ids, screen titles and `data-t` string keys in
`docs/design/web-ui-mockup.html`.

| Was | Is | Class | Where |
|---|---|---|---|
| "**The spec outranks it**" in the preamble, and "Spec outranks it" on Tasks 11 and 12 | **The mockup outranks the spec on the rendered surface.** The spec keeps everything that is not rendered — routes, the gate, the staleness rule, §4b's arithmetic. A UI disagreement between the two is escalated to the owner, not resolved locally | A precedence sentence copied into three places is three places to correct when the precedence changes; the rank of a document is a fact with an expiry date | Preamble, Tasks 11, 12 |
| "the mockup's filters and rows cover only three record kinds (no focus records)" | **It covers four, and draws the fourth differently on purpose.** `#wfilters` has five buttons — `all`, `mutation`, `injection`, `hook`, **`focus`** — and `watch.sub` says "Four record kinds — mutations, injections, hook actions and focus changes. A focus change is a **regime change**, drawn as a rule across the feed rather than as one row." The renderer implements it: a `focus` record becomes a full-width `regime` row labelled *regime change · …*, never an ordinary row | A gap named in an old reading of a document is re-checked against the document before it is planned around | Task 11 |
| "its strip shows the context number unconditionally — the spec conditions it on the bridge and adds 'not yet known'/'unknown' states the mockup lacks" | **The strip has all three states.** `#ctx` cycles them: the known figure, "context not yet known — no response since the compact", and "context unknown — status line bridge not installed". The mockup's own control is titled *"Click to cycle the three states the spec requires"* | Same class. The mockup was regenerated *against* the spec; the divergences the plan inherited were fixed there before they were fixed here | Task 11 |
| Ask renders "the generated SQL shown so it teaches" — a SQL pane, `'ask.sqlCaption'`, and "the SQL pane displays what the server returns" | **The mockup's Ask screen has no SQL anywhere on it.** It is `ask.field` / operator / value selects, a **Run** button (`ask.run`), a three-column result table (`th.when` At · `th.item` Item · `th.role` Role) and two disclosures. `ask.sub`: "Fields, operators and values — bound as parameters, composed on the server. **No query text crosses the wire.**" The spec's own retired-phrases block already declares *"with the generated SQL shown so it teaches"* retired (`check:retired` still reports it present in the spec body at the time of writing — that is spec/plan-1 work in flight, not this plan's) | A panel the design does not draw is a panel that is not built, however defensible it is on its own terms. "Displaying the SQL" and "accepting SQL" are different, and only the second was ever the security argument — which is exactly why the first survived unexamined | Design decision 10, Tasks 9, 12 |
| The mockup's query builder "has no structured filters, which the spec requires", and shows "predefined queries on the left" | **Backwards.** Structured filters are the whole of that screen now; there are **no** predefined queries on it. `'ask.predefined'`, `'ask.predefined.ops'`, `'ask.predefined.spilled'`, `'ask.predefined.injected'` and `'ask.predefined.sessions'` in Task 9 name a control the design does not have | A description of another document is re-read before it is relied on | Tasks 9, 12 |
| Watch is "the strip, the spills pane, the live feed", with "Spills sit ABOVE the feed" and an "Injections, last {hours}h" volume chart | **The mockup's Audit stream has neither a spills pane nor a volume chart.** It is one card: the **activity pulse** (`#pulse`, `watch.pulsen`), the five filters, the record table, an `aria-live` count, and `watch.voidn`. Spills appear in this product's UI on **plan 1's** screens — the injection preview's ghost lane, the simulator's diverging ratio bar, the decay heatstrip — and inside a Watch row's own text ("4 delivered, 1 spilled"). `mockup.md` records the same ruling for volume: *"the spec puts injection volume in the Watch status strip, not on a Core screen"* — and the strip is where the mockup puts it | Adding a panel the mockup does not show is the first thing the instruction forbids, and a screen's headline question is the design's call, not the plan's | Tasks 6, 11 |
| Watch's motion comes from the record table alone | **The mockup adds the activity pulse and says why**: `watch.pulsen` — "one column per ten seconds, newest at the reading-end edge. Height is records in that column, colour is the record kind. **It is the only thing that makes a live stream feel live**, and the time buckets it needs are already indexed by `idx_audit_at`." This plan has no view for it | Dropping a graphical view the mockup draws is the failure that was caught late once already — a whole regeneration lost 18 of them | Tasks 6, 10, 11 |
| The absent-`tokens` case is a sentence — `'watch.tokensNotRecorded'` | **The mockup draws it.** An injection row carries a gold bar of its cost against the 6,000-token budget; where `tokens` is absent the row draws a **hatched void** *and* says so (`watch.voidn`: "A zero-length bar would be a claim the record does not make"). Design decision 3 is right and stays; its rendering is a mark, not only a string | A label where the mockup discloses a graphical fact is the "weaker version" the instruction forbids | Tasks 10, 11 |
| Task 11 adds a Watch NAV group; Task 12 adds an Ask NAV entry | **The rail is four groups by tense, fixed**: `nav.inj`, `nav.ev` "Evidence — why it did or didn't", `nav.ch`, `nav.read`. `watch` and `ask` are the first two entries of `nav.ev`, beside `doctor`, `decay`, `graph` and `status`; neither gets a group of its own | Navigation structure is part of what the mockup specifies | Tasks 11, 12 |
| The strip's keys are `strip.branch`/`strip.detached`/`strip.inSync`/`strip.differs`/… | **The mockup's footer carries more than git and context**: `strip.sync`, `strip.items` (a corpus count), `strip.append` with `strip.meas` (the **measured** 0.55 ms audit-append p95, the one real number in the file) and `strip.rt`. Whether those belong to this plan's strip or to plan 1's shell is not answered by either document — open question 4 | A shared surface with two owners has a seam, and a seam nobody wrote down is a thing both sides drop | Tasks 9, 11 |
| Task 9 declares the strip's git keys with plain slots — `'strip.branch': 'branch {branch} @ {commit}'`, `'strip.inSync': 'in sync with origin/{branch}'`, `'strip.differs': 'differs from origin/{branch}'`, `'strip.detached': 'detached HEAD @ {commit}'` | **The mockup declares all four as MONOSPACE value slots** — `{mv:branch}`, `{mv:commit}` — and the shipped tables now carry them that way. A branch name and a SHA-1 are data, not prose; inside an RTL paragraph a plain `{branch}` is laid out as Hebrew text. Task 9's block and the strip's own rendering follow the mockup | A distinction the design declares and the transcription rule then throws away is a regression the design cannot see. `{mv:…}` transcribes as `{mv:name}`, never as `{name}` | Tasks 9, 11 |

**On the decay caption — this plan makes no stale claim, and owns the data behind the corrected one.**
The mockup's Decay screen was corrected to say the **ledger** holds first-injections only, so its
unit is sessions and not a clock (`dec.sub`; the comb's own comment: *"the ledger collides repeat
injections inside one session, so it holds first-injections rather than a time series"*), while the
**audit projection** carries the real series: `dec.heatn` names the source as `audit_item.role`
joined to `audit.at`, "both indexed, with the `since` / `until` filters that already ship", and the
item pane's twelve-week sparkline (`pane.histn`) says "from the audit projection". Neither this plan
nor plan 2 ever asserted "there is no series to plot" — checked 2026-08-20 — so there is nothing to
retract here. What follows instead is a **seam**: the screens are plan 1's, the projection is this
plan's, and **no plan defines the per-item time-bucketed rollup either view needs** — see open
question 3. `audit-db.ts` exports `summaryByOp`, `topItems` and `sessions`, all of which are counts,
and `queryProjection`, which returns records; there is no bucketed series function anywhere
(`core/audit-db.ts` · `export function topItems(db: DatabaseSync, role: string | null, limit: number): SummaryRow[] {`).

#### Open questions for the owner — recorded, not resolved

1. **Where does the activity pulse get its data? — RULED 2026-08-20 (A2). The DATA half is answered;
   the DRAWING half is not.** The pulse needs **record counts by kind in ten-second buckets over the
   last twenty minutes** (120 columns). The owner ruled the source is the **audit projection**, not
   the ledger: `at` and `kind` are two generated columns of the same `audit` row, each indexed, and
   the ledger has neither four kinds nor a repeatable time series at all. Task 6 respecifies
   `/api/watch/volume` as exactly that endpoint — `?minutes=` / `?bucket=`, defaulting to the
   mockup's own 120 × 10 s — so this plan now designs it. **What is still not designed is the
   drawing**: the pulse element, its per-kind colouring and its place in the Watch card are the row
   above ("This plan has no view for it"), still owed by Tasks 10 and 11.
2. **Does anything of the spills work survive? — half answered.** `/api/watch/volume` now has a home:
   it is the pulse's endpoint (A2 above), and the pulse is drawn on `watch` by the mockup.
   `apiWatchSpills` is the half still without one — tested, pure and cheap, but the mockup gives it
   no place on `watch`. It may belong to plan 1's screens, to the strip, or nowhere yet. Until the
   owner rules, **build the endpoint and render no spills pane.**
3. **The decay heatstrip and the item-pane sparkline need a rollup no plan defines** — per item, per
   day (90 cells) and per week (12 cells), delivered against spilled. The mockup names the source
   exactly (`dec.heatn`, `pane.histn`) and the indexes exist (`idx_audit_at`,
   `idx_audit_item_id`). The screens are plan 1's; the projection is this plan's. **Reported, not
   designed.**
4. **Who owns the footer strip?** The mockup's footer carries git state, a corpus item count, the
   measured audit-append p95 with its `measured` chip, the context figure and a
   reduced-transparency simulation toggle. This plan's Task 9 claims `strip.*`; plan 1 builds the
   shell the footer lives in. Unsplit.
5. **Wording.** The mockup carries 326 EN keys each with a Hebrew pair, checked in both directions.
   Task 9's block contains sentences with no counterpart there, and the mockup contains sentences
   Task 9 has no key for — `watch.pulsen`, `watch.voidn`, `ask.whyq`, `ask.why`, `ask.recallq`,
   `ask.recall1`, `ask.recall2`, `strip.items`, `strip.append`, `strip.meas`, `strip.rt`, `ex.msg`,
   `ex.ok`. That reconciliation is a pass of its own and is **not** done in this edit.

   **PENDING THE MOCKUP, not condemned — 2026-08-20.** Four families this document declares and the
   mockup did not carry when the rows above were written are **being added to the mockup now**: the
   `strip.ctx.*` states, `strip.myctx*`, `ask.sqlCaption` and `ask.predefined*` — fourteen keys by
   this document's own count of Task 9's block. They are therefore **kept exactly as declared: not
   removed, and not restated anywhere new either.** Every judgement above and below that reads them
   as keys "the mockup does not have" is pending rather than settled, and the two rows that read the
   Ask screen as having no SQL pane and no predefined list are the ones that will move — the goal
   statement already records that the owner kept the SQL pane on 2026-08-20 and that the mockup
   gained `ask.sqlh` / `ask.sqln` first.
6. **`docs/design/web-ui-mockup.md` is stale and still says the spec wins.** Outside this plan's edit
   scope; flagged for the owner.
7. **Does `t()` return a string or nodes? — ANSWERED 2026-08-20: NODES.** The mockup answered it for
   the RENDERING — `{m:…}` and `{mv:name}` are monospace, bidi-isolated ELEMENTS, and a string
   cannot carry an element — and plan 1 is respecifying `t()` to return an **array of nodes** to
   match. Plan 1 Task 16's old `t(strings, key, subs)` replaced a `\{(\w+)\}` match with a
   substituted string: it returned a string, parsed no marker, and `\w` did not match the colon in
   `{mv:branch}`, so that slot would have reached the screen with its braces intact. Task 11's git
   block was already written against the node contract; **the rest of this plan's screens are
   converted to it in this edit** — see the correction row below. The contract itself still belongs
   to the file that defines it, and this document still names no helper plan 1 has not published.

### Corrected 2026-08-20 — one owner ruling, and the contracts that moved underneath this plan

The first two rows are the owner's ruling **A2**, which also settles open question 1's data half. The
rest are contracts this document quoted from plan 1 or from core — `withStores`, `t()` — and then went
on instructing an implementer to rely on, after they had moved, plus the one slot the monospace sweep
of 2026-08-20 turned up.

| Was | Is | Class | Where |
|---|---|---|---|
| `/api/watch/volume` sources from `Ledger.history()` — `injectionVolume(events: InjectionEvent[], …)`, injections only, in hourly buckets | **It sources from the audit projection.** The mockup is the UI specification and its activity pulse is coloured **by record kind** over buckets "already indexed by `idx_audit_at`" (`watch.pulsen`) — four kinds, which the ledger does not have. The `audit` table carries both facts on ONE row, each with its own index, so there is no join to make: `at` (`core/audit-db.ts` · `(rec ->> '$.at')` · ~64) and `kind` (`core/audit-db.ts` · `(rec ->> '$.kind')` · ~65). The endpoint is now `?minutes=` / `?bucket=` and returns a per-kind breakdown | A view's data source is chosen by what the view has to draw, not by which reader happened to be written first | Tasks 6, 10, 11; open questions 1-2 |
| `Ledger.history()` is a defensible source for a time series | **It cannot be one, and its own docstring now says so.** The ledger's primary key is `(session_id, item_id, tier)` with `injected_at` merely a value, so a repeat injection inside one session collides into the row already there and any series drawn from it undercounts by exactly those repeats (`core/ledger.ts` · `from it undercounts by exactly the repeats the key swallowed. Which stamp` · ~452). It has no kind column at all, so it could not colour a single column of the pulse either | A read returning one row per key is a set of MARKERS, not a stream of events; counting markers over time answers a different question and says nothing about the difference | Task 6 |
| `withStores<T>(ws, fn: (store: Store, ledger: Ledger) => T): T` — "opens `Store` before `Ledger`, closes both" — quoted verbatim and relied on | **Both handles open READ-ONLY and checked, and the ledger is `Ledger \| null`.** `Store.openReadOnlyChecked` and the `Ledger.openReadOnlyChecked` shipped in `1cb968a` (`core/ledger.ts` · `static openReadOnlyChecked(dbPath: string): Ledger {` · ~222). The null is the **never-injected corpus** — an empty state told from damage by CLASS, `LedgerUninitializedError` (`core/ledger.ts` · `export class LedgerUninitializedError extends Error {}` · ~91), never by message. The owner ruled it renders as the mockup's **zero-data view** | A signature quoted from another document is re-read at execution time; a nullable value destructured without a check is the silent drop, one type away | Task 6 Steps 1 and 4 |
| `'ask.projection.caughtUp'` declares its slot as a plain `{state}` | **`{mv:state}`.** It substitutes a `ProjectionState` literal — `fresh` / `behind` / `diverged` — which this product never translates, so in the Hebrew sentence it is an untranslated Latin run inside RTL prose: the case `{mv:…}` exists for. Swept 2026-08-20 against every other slot Task 9 declares; the rest substitute a count, a percentage, an age or an error sentence, and stay plain | The monospace-slot rule is applied to what a slot SUBSTITUTES, not to which keys were noticed during the pass that introduced it | Task 9 |
| Roughly fifty call sites consume `t()` as a **string** — `.textContent = t(…)` and template concatenation — "only harmless for keys carrying no monospace run" | **`t()` returns an array of NODES**, because the mockup's `{m:…}` / `{mv:name}` slots are monospace, bidi-isolated elements and a string cannot carry one. Both of those consumption forms **flatten** the isolated run back to text, which is precisely the regression the marker exists to prevent. Every site now appends nodes; the screens' local `el()` helper takes either a string or a node list, so the change is one helper plus the handful of sites that concatenated. Attribute values (`aria-label`, `title`) are the exception and take plan 1's flattening companion, **described here and deliberately not named** | A dependency's contract change is applied at every call site in one pass, not only at the ones carrying a marker today — "harmless for these keys" is a property of this week's wording, not of the code | Tasks 11, 12; open question 7 |

---

## Verified facts this plan builds on

**Re-verified against `master` on 2026-08-18.** Citations are `file` · `verbatim fragment` · `~line`,
per `2026-08-18-v2-decisions.md` §2: the **fragment is the identity** and the line is a hint that may
go stale. `npm run verify:citations` resolves every fragment here.

### This repository

| Fact | Where verified |
|---|---|
| `AuditRecord { protocol; at; kind; op; origin?; itemId?; fields?; sessionId?; hook?; injected?; tokens?; spilled?; path?; note? }` | `core/audit.ts` · `export interface AuditRecord {` · ~161 |
| `tokens?: number` — absent means "not recorded", never zero | `core/audit.ts` · `tokens?: number;` · ~206 |
| `InjectedRef { id; tier; at? }` | `core/audit.ts` · `export interface InjectedRef {` · ~139 |
| `SpilledRef extends InjectedRef { reason: string }` | `core/audit.ts` · `export interface SpilledRef extends InjectedRef {` · ~157 |
| `AuditKind = 'mutation' \| 'injection' \| 'hook' \| 'focus'` | `core/audit.ts` · `export type AuditKind = 'mutation' \| 'injection' \| 'hook' \| 'focus' \| 'access' \| 'progress';` · ~80 |
| `AUDIT_KINDS` exported | `core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~121 |
| `FOCUS_OPS = ['focus-set', 'focus-clear']` | `core/audit.ts` · `export const FOCUS_OPS = ['focus-set', 'focus-clear'] as const;` · ~112 |
| `recordAudit(root, input)` — appends, never throws | `core/audit.ts` · `export function recordAudit(root: string, input: AuditInput): AuditWriteResult {` · ~383 |
| `readAudit(root)` | `core/audit.ts` · `export function readAudit(root: string): AuditRecord[] {` · ~413 |
| `filterAudit(records, filter)` | `core/audit.ts` · `export function filterAudit(records: AuditRecord[], filter: AuditFilter): AuditRecord[] {` · ~487 |
| `AuditFilter { since?; until?; itemId?; sessionId?; kind?; op?; origin?; limit? }` | `core/audit.ts` · `export interface AuditFilter {` · ~458 |
| `parseWhen(raw, flagName)` | `core/audit.ts` · `export function parseWhen(raw: string, flagName: string): string {` · ~439 |
| `auditSegments(root)` — every segment oldest first, live `audit.jsonl` last | `core/audit.ts` · `export function auditSegments(root: string): string[] {` · ~265 |
| Audit log lives under `<projectRoot>/.audit/` | `core/audit.ts` · `export function auditDir(root: string): string {` · ~218 |
| `openProjection(root)` — discards and recreates on corruption or version mismatch | `core/audit-db.ts` · `export function openProjection(root: string): DatabaseSync {` · ~291 |
| `syncProjection(root, db)` — returns the state it FOUND; catches up incrementally; rebuilds only on divergence | `core/audit-db.ts` · `export function syncProjection(root: string, db: DatabaseSync): ProjectionState {` · ~230 |
| `projectionState(root, db)` — pure comparison; a shrunken or vanished segment is `diverged` | `core/audit-db.ts` · `export function projectionState(root: string, db: DatabaseSync): ProjectionState {` · ~145 |
| `queryProjection(db, filter)` — **the WHERE builder is still inline here**, which is what Task 1 extracts | `core/audit-db.ts` · `export function queryProjection(db: DatabaseSync, filter: AuditFilter): AuditRecord[] {` · ~371 |
| `summaryByOp(db, filter?)` | `core/audit-db.ts` · `export function summaryByOp(db: DatabaseSync, filter: AuditFilter = {}): SummaryRow[] {` · ~419 |
| `topItems(db, role, limit)` | `core/audit-db.ts` · `export function topItems(db: DatabaseSync, role: string \| null, limit: number): SummaryRow[] {` · ~432 |
| `sessions(db, limit)` | `core/audit-db.ts` · `export function sessions(db: DatabaseSync, limit: number): SummaryRow[] {` · ~447 |
| `audit_item` side table — `role` is `TEXT NOT NULL`, **not** a CHECK-constrained enum | `core/audit-db.ts` · `  role    TEXT NOT NULL,` · ~88 |
| The three roles are documented in the schema comment | `core/audit-db.ts` · `and did not fit, and counting those by item is how a user finds a budget` · ~83 |
| **`readSegmentFrom(file, offset)` — already `export`ed**, formerly `readFrom` | `core/audit-db.ts` · `export function readSegmentFrom(file: string, offset: number): { text: string; consumed: number } {` · ~182 |
| **It has a second consumer outside `audit-db.ts`** | `core/ledger-replay.ts` · `import { readSegmentFrom } from './audit-db.ts';` · ~2 |
| `ensureLogDir(dir)` — creates the dir and writes `*` into its `.gitignore` | `core/jsonl-log.ts` · `export function ensureLogDir(dir: string): string {` · ~78 |
| `LedgerTier = 'pinned' \| 'jit' \| 'restored'` | `core/ledger.ts` · `export type LedgerTier = 'pinned' \| 'jit' \| 'restored';` · ~10 |
| `Status = 'active' \| 'draft' \| 'superseded' \| 'deprecated' \| 'validated'` | `core/types.ts` · `export type Status = 'active' \| 'draft' \| 'superseded' \| 'deprecated' \| 'validated';` · ~2 |
| `Layer = 'project' \| 'global'` | `core/types.ts` · `export type Layer = 'project' \| 'global';` · ~5 |
| `Origin = 'human' \| 'agent' \| 'ingest'` | `core/types.ts` · `export type Origin = 'human' \| 'agent' \| 'ingest';` · ~4 |
| `store.raw(sql)` — **no bind-parameter support today**, which Task 7 adds | `core/store.ts` · `raw(sql: string): Record<string, unknown>[] {` · ~460 |
| `Store.openReadOnly(dbPath)` — and see §2: `readOnly: true` does **not** stop `VACUUM INTO` | `core/store.ts` · `static openReadOnly(dbPath: string): Store {` · ~382 |
| `assertSelectOnly(sql)` — the barrier the connection does not provide | `cli/commands/query.ts` · `export function assertSelectOnly(sql: string): void {` · ~114 |
| `updated_at` is INDEX WRITE TIME, not a Markdown timestamp | `cli/commands/query.ts` · `updated_at is INDEX WRITE TIME, not a Markdown timestamp: every query rebuilds the` · ~47 |
| `readStdin()` — synchronous `readFileSync(0)`, `''` when no stdin | `hooks/io.ts` · `export function readStdin(): string {` · ~52 |
| `registerCommand(def)` | `cli/commands/registry.ts` · `export function registerCommand(def: CommandDef): void {` · ~46 |
| `CommandFn = (ws, args, out, cwd) => number` — synchronous | `cli/commands/registry.ts` · `export type CommandFn = (ws: Workspace, args: string[], out: Emit, cwd: string) => number;` · ~6 |
| `Workspace { projectRoot; globalRoot; dbPath; config }` | `core/workspace.ts` · `export interface Workspace {` · ~9 |
| `GLOBAL_DIR = ~/.my-context` | `core/workspace.ts` · `export const GLOBAL_DIR = path.join(homedir(), '.my-context');` · ~7 |

**Task-1 preconditions, re-run against `master` on 2026-08-18** — §8.1 step 4. Executed, not read:

| Precondition | Result |
|---|---|
| The offset reader exists and is exported | ✅ as **`readSegmentFrom`**, exported — half of this task is already done |
| Its "only complete lines are consumed, a torn tail waits" behaviour | ✅ **executed**: given `{"a":1}
{"b":2}
{"c":3` it returned exactly the first two lines and `consumed: 16`, leaving the torn tail. Resuming from that offset after the tail completed returned `{"c":3}
` and nothing else |
| It has exactly one caller | ❌ **two** — `audit-db.ts` itself and `core/ledger-replay.ts`. A rename is a two-file change |
| The filter-to-SQL builder is still inline in `queryProjection` | ✅ the `where`/`params` arrays are built in its body; `filterSelect` does not exist anywhere in `src/` |
| `readCompleteLines` / `filterSelect` do not already exist | ✅ neither appears anywhere in `src/` — both are this task's output |

**Consumed from plan 1 as published interfaces** (they do not exist until plan 1 executes; their names
are binding): `Ledger.sessionSummaries(limit)` (Task 7); `withStores<T>(ws, fn: (store: Store, ledger: Ledger | null) => T): T`
— **both handles read-only and checked, the ledger nullable** (§0, Task 6 Step 1);
`startUiServer` refusing to start without `ws.projectRoot`, so route handlers see it non-null
(Task 13); stream routes skipping `idle.touch()`, and idle exit and `close()` both calling
`server.closeAllConnections()` (Task 13); `window.myctx = { api, t, session, onSessionChange, navigate }`
where **`t()` returns an ARRAY OF NODES**, not a string (§0, open question 7), together with the
flattening companion plan 1 publishes beside it for attribute values;
and the `SCREENS`/`NAV` maps (Tasks 16–17); `GET /api/meta → { version, projectRoot, repoRoot, git }`
(Tasks 4, 13); the string tables and their parity test (Task 1).

`Ledger.history(): InjectionEvent[]` **was on this list and is no longer consumed by this plan at
all**: ruling A2 moved its one reader, `/api/watch/volume`, to the audit projection (§0). The method
still exists and plan 1 still publishes it; nothing here calls it.

### Claude Code's status line payload — external, established by execution, version-pinned

Spec §4b requires these claims be marked external and re-checked against the build at hand. They were established for this plan **by string-extraction from the installed Claude Code binary** (`~/.local/bin/claude`, a compiled executable whose embedded JS is greppable), not by transcribing documentation. The binary self-identifies as `VERSION: "2.1.233"`, `GIT_SHA: "f8d57569aaf350fe25dc4dfa10cad59db8ea4d45"` — the same version the spec recorded, independently confirmed. **Task 3 Step 1 repeats this extraction on the executor's machine** and updates this table if the fields moved.

| Fact | How established |
|---|---|
| The status line payload's base fields include `session_id`, `transcript_path`, `cwd`, and an optional `prompt_id` | The shared payload-base function in the binary: `return{session_id:e.id,transcript_path:vj(e.id),cwd:t,prompt_id:uot()??void 0,…}` |
| `context_window` is built as `{total_input_tokens, total_output_tokens, context_window_size, current_usage, used_percentage, remaining_percentage}` | The construction function, verbatim from the binary: `function TAw(e,t){let r=wMo(e,t);return{total_input_tokens:e?e.input_tokens+e.cache_creation_input_tokens+e.cache_read_input_tokens:0,total_output_tokens:e?.output_tokens??0,context_window_size:t,current_usage:e,used_percentage:r.used,remaining_percentage:r.remaining}}` |
| `total_input_tokens` **is exactly** the spec's input-only formula (`input + cache_creation + cache_read`) — **and it is `0`, not null, when `current_usage` is null.** So "not yet known" is detected by `current_usage === null` and by nothing else; a reader keying on `total_input_tokens === 0` would render the post-compact state as zero, the exact lie §4b's constraint 2 forbids | Same function: the `e?…:0` branch |
| `current_usage` is nullable and is the raw usage object (`input_tokens`, `cache_creation_input_tokens`, `cache_read_input_tokens`, `output_tokens`) | Same function; nullability visible in `e?`/`e?.` guards |
| `used_percentage` is documented in the binary's own embedded help as `number \| null … null if no messages yet` | Embedded docstring string in the binary |
| The full payload also carries `model: {id, display_name}`, `workspace: {current_dir, project_dir, …}`, `version` (the plain string `"2.1.233"`), `cost: {total_cost_usd, …}`, `exceeds_200k_tokens`, optional `rate_limits` | The payload-assembly function in the binary (`kAw`), read in full |
| The `statusLine` setting is `{type: "command", command: string, refreshInterval?: number, padding?: …}`; `refreshInterval` is **seconds**, minimum 1, described as "Re-run the status line command every N seconds in addition to event-driven updates" | The setting's schema string in the binary |
| `CLAUDE_CONFIG_DIR` overrides the `~/.claude` settings directory | 33 references in the binary |
| The status line command is **skipped when workspace trust is not accepted**, and only `type: "command"` runs | The guard in the binary: `if(kmt()){…"Skipping StatusLine command execution - workspace trust not accepted"…}` |

**One spec drift found and flagged, not silently corrected:** §4b states the join is on `session_id` alone because "a finer join … would need a per-turn identifier that **neither side produces**." As of 2.1.233 Claude Code **does** produce one — `prompt_id`, optional, in both hook and status line payload bases. mycontext's side still declares no such field (`hooks/io.ts` · `export interface HookInput {` · ~3), so the join in this plan stays on `session_id` exactly as specified. **The spec has since been amended** — `2026-08-16-web-ui-design.md` §4b now scopes the claim to what this repository can assert and writes down the condition under which a finer join becomes possible, citing this plan as where the drift was found. Nothing in this plan depends on either reading.

---

## Design decisions this plan fixes (so no implementer has to guess)

1. **The stream carries new records only; history is a query.** On connect the stream emits a `hello` event and then `record` events as lines land. The screen loads its backlog through `GET /api/ask/audit` after opening the stream. A record landing in the overlap window can appear in both; the client dedupes by full-record serialized identity (`dedupeKey`, Task 10) — records carry no id, and inventing one server-side would be a second truth.
2. **Divergence resyncs; it never replays.** When a segment shrinks or vanishes under the tail (rotation is the common cause), `AuditTail` resets its offsets to the current EOFs and reports `resync: true`; the stream forwards a `resync` event and the screen refetches its backlog. Re-emitting from byte 0 would show every record around a rotation twice — in an audit view.
3. **A missing `tokens` field renders as "not recorded", never as zero.** Enforced in the one place records become view rows (`describeRecord`, Task 10, tested), and worded in the strings (`watch.tokensNotRecorded`). Zero is a real measurement; absence is a state. This is the field's own contract (`audit.ts:201`) applied to reading.
4. **Every audit answer syncs first, then answers, and says what it found.** `apiAskAudit`, `apiAskSummary`, `apiWatchSpills` and the `mycontext statusline` printed line all call `syncProjection` before reading and return/render the state it found (`fresh`/`behind`/`diverged`). If sync throws, the answer is a refusal (HTTP 503; `myctx unavailable` on the printed line) — never a quiet partial (spec §5's staleness constraint, met by the mechanism `syncProjection` actually has: incremental catch-up, rebuild only on divergence).
5. **The bridge installer asks by two-step, not by prompt.** `CommandFn` is synchronous and the CLI has no interactive prompt; the project's consent token is `--yes` (README §7: legibility, "an explicit, greppable token in the transcript"). So `mycontext statusline install` **prints the existing `statusLine` setting and the exact replacement and exits without writing**; only `… install --yes` writes. The replaced value is saved to `<globalRoot>/statusline-replaced.json` and `mycontext statusline uninstall --yes` restores it — replacement is reversible, not merely announced.
6. **The tee stores the payload whole.** `{ receivedAt, payload }`, payload verbatim — shredding fields at write time is how a growing external schema gets silently dropped (INV-nothing-is-dropped-silently); classification happens at read time (`classifyContext`). `receivedAt` is stamped by the command and is what "as of" ages are computed from; `refreshInterval: 60` in the installed setting keeps it fresh while a session idles (spec §4b, Compatibility).
7. **`session_id` becomes a filename by refusal, not by mangling.** `sanitizeSessionId` accepts `[A-Za-z0-9._-]` (≤128 chars, no leading dot) and otherwise the tee is skipped with the reason returned — mangling could collide two sessions into one file, which would show one session's context as another's, the exact failure keying-by-session exists to prevent.
8. **The context percentage is computed input-only from `current_usage`'s three fields** (`input_tokens + cache_creation_input_tokens + cache_read_input_tokens`, over `context_window_size`) — spec §4b constraint 3, and verified above to be the same arithmetic Claude Code's own `total_input_tokens` performs. The gate for "not yet known" is `current_usage === null`; a payload with no `context_window` object at all is "unknown". Three distinct states, three distinct renderings, none of them zero.
9. **Ask's corpus queries never rebuild the index** — Plan 1's design decision 1 carried: the server reads what the hooks read. The `updated_at` trap (`query.ts:46-49`) is therefore *worse* here than in the CLI (the CLI rebuilds first; the UI does not), and the Ask screen says so in its own caveat string (`ask.updatedAtTrap`) rather than in a doc nobody reads.
10. **One SQL builder, and the screen shows none of it.** `filterSelect` is still extracted from `queryProjection` (Task 1) and `corpusSelect` (Task 7) still both builds and runs — that is the no-second-spelling rule, and it is what makes the mockup's `ask.sub` claim ("bound as parameters, composed on the server") true rather than aspirational. The endpoints still **return** `sql` and `params`: they are the seam a test pins and a maintainer reads. **The Ask screen does not render them.** The mockup's Ask has no SQL pane (`ask.whyq` — "Why there is no SQL box"; `ask.sub` — "No query text crosses the wire"), and the spec's own retired-phrases block already declares "with the generated SQL shown so it teaches" retired. The `LIMIT` is still one more than the cap — the truncation probe — and the screen still discloses truncation, in words (`ask.truncated`), which is what it was always for.
11. **The stream accepts a `poll` parameter (50–10000 ms, default 1000)** so the E2E suite runs in tens of milliseconds; any other unknown parameter is still refused with 400.
12. **`Store.raw` gains bind parameters** (`raw(sql, params?)`, Task 7) rather than this plan inlining values into SQL strings. Inlining is the injection-shaped alternative; extending the read path is two lines.

---

## File Structure

New files:

```
src/core/audit-tail.ts            # AuditTail — per-segment offsets, complete lines only, resync on divergence
src/core/statusline-tee.ts        # tee dir/path, sanitizeSessionId, writeTee/readTee, classifyContext
src/cli/commands/statusline.ts    # `mycontext statusline` + `install`/`uninstall` — the bridge (CLI, never a UI endpoint)
src/ui/watch-model.ts             # /api/watch/* handlers + the stream route; registerWatchRoutes()
src/ui/ask-model.ts               # /api/ask/* handlers; registerAskRoutes()
src/ui/public/lib/sse.js          # incremental SSE-frame parser (pure)
src/ui/public/screens/watch.js    # Watch: status strip, live stream, spills pane
src/ui/public/screens/ask.js      # Ask: query builder (corpus + audit), SQL pane, predefined queries
test/core/audit-tail.test.ts
test/core/statusline-tee.test.ts
test/cli/statusline.test.ts
test/ui/watch-model.test.ts
test/ui/ask-model.test.ts
test/ui/watch-e2e.test.ts         # spawned server: stream over HTTP; idle fires WITH a stream open
```

Modified files:

```
src/core/audit-db.ts              # rename the ALREADY-EXPORTED readSegmentFrom (2 call sites); extract+export filterSelect (Task 1)
src/core/store.ts                 # raw(sql, params?) — bind parameters on the existing read path (Task 7)
src/ui/server.ts                  # registerReadRoutes() additionally calls registerWatchRoutes(), registerAskRoutes() (Task 8)
src/ui/public/app.js              # SCREENS/NAV entries for watch+ask; window.myctx.stream() (Tasks 11-12)
src/ui/public/lib/viewmodel.js    # describeRecord, dedupeKey, sparkline, formatAge, contextStripState (Task 10)
src/ui/public/strings/en.js       # + watch.*, ask.*, strip.*, nav.watch, nav.ask keys (Task 9)
src/ui/public/strings/he.js       # same keys, Hebrew (Task 9)
README.md, docs/README.he.md      # Watch/Ask docs + the bridge, opt-in, with its condition (Task 13)
```

---

## Task 1: Export the two seams from `audit-db.ts` — `readCompleteLines` and `filterSelect`

Two pieces of `audit-db.ts` are rules this plan must not re-spell. The offset reader — **`readSegmentFrom`, and already `export`ed** (`core/audit-db.ts` · `export function readSegmentFrom(file: string, offset: number): { text: string; consumed: number } {` · ~182; §0 records that this plan called it `readFrom` and private) — is the "only complete lines are consumed, a torn tail waits" rule — `AuditTail` needs exactly it. The filter-to-SQL builder still lives inline in `queryProjection` (`core/audit-db.ts` · `export function queryProjection(db: DatabaseSync, filter: AuditFilter): AuditRecord[] {` · ~371) — Ask must *show* the SQL it runs, and a second spelling of the WHERE clause is the drift this project has found five times. Spec §3's instruction for `isNormative` governs: "either call it, or export it — but not both, and never neither." Both are exported; neither is copied. **`readSegmentFrom` is already exported, so that half is a rename rather than an export — and a rename with a second consumer, `core/ledger-replay.ts`, which did not exist when this plan was written.** Renaming is optional; leaving the shipped name and skipping the churn is the cheaper reading, and §0 states the choice rather than assuming it.

**Files:**
- Modify: `src/core/audit-db.ts`
- Test: `test/core/audit-db-seams.test.ts`

**Interfaces:**
- Consumes: the shipped `audit-db.ts` (see Execution prerequisite).
- Produces:
  - `readCompleteLines(file: string, offset: number): { text: string; consumed: number }` — the former **`readSegmentFrom`**, renamed, behaviour identical. **It is already exported and has two call sites** (`audit-db.ts` itself and `core/ledger-replay.ts`), so a rename updates both or does not happen: reads `file` from `offset` to EOF, returns only whole lines, leaves a torn tail unconsumed.
  - `filterSelect(filter: AuditFilter): { sql: string; params: (string | number)[] }` — the exact SELECT `queryProjection` prepares (including the newest-n-reordered form when `limit` is set); `queryProjection` now calls it.

- [ ] **Step 1: Establish the merged audit surface by executing**

Run:

```bash
node -e "import('./src/core/audit.ts').then(m => console.log(typeof m.recordAudit, typeof m.readAudit, typeof m.filterAudit, m.AUDIT_KINDS.join(',')))"
node -e "import('./src/core/audit-db.ts').then(m => console.log(typeof m.openProjection, typeof m.syncProjection, typeof m.queryProjection, typeof m.summaryByOp, typeof m.topItems, typeof m.sessions))"
node -e "import('./src/core/audit.ts').then(m => { const src = require('fs').readFileSync('src/core/audit.ts','utf8'); console.log(/tokens\?: number/.test(src) ? 'tokens field present' : 'TOKENS FIELD MISSING — merge audit-injection-token-count first'); })"
```

Expected: `function` six times, the four kinds, and `tokens field present`. If any line fails, **stop**: the prerequisite merge has not happened, and this plan cannot execute against this tree.

- [ ] **Step 2: Write the failing test**

```ts
// test/core/audit-db-seams.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readCompleteLines, filterSelect, openProjection, syncProjection, queryProjection } from '../../src/core/audit-db.ts';
import { recordAudit } from '../../src/core/audit.ts';

test('readCompleteLines returns whole lines only and leaves a torn tail unconsumed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    const file = path.join(dir, 'log.jsonl');
    writeFileSync(file, 'one\ntwo\n');
    const first = readCompleteLines(file, 0);
    assert.equal(first.text, 'one\ntwo\n');
    assert.equal(first.consumed, 8);

    appendFileSync(file, 'torn');           // no newline — a writer mid-append
    const second = readCompleteLines(file, first.consumed);
    assert.equal(second.text, '');
    assert.equal(second.consumed, first.consumed);  // not advanced past the tear

    appendFileSync(file, '-done\n');
    const third = readCompleteLines(file, second.consumed);
    assert.equal(third.text, 'torn-done\n');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('filterSelect is the SQL queryProjection runs — pinned by executing both against one projection', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    recordAudit(dir, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 40 });
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b', fields: ['body'] });
    const db = openProjection(dir);
    try {
      syncProjection(dir, db);
      const filter = { sessionId: 's1', kind: 'injection' as const };
      const { sql, params } = filterSelect(filter);
      const direct = (db.prepare(sql).all(...params) as { rec: string }[]).map((r) => JSON.parse(r.rec));
      assert.deepEqual(direct, queryProjection(db, filter));
      assert.equal(direct.length, 1);
      assert.match(sql, /SELECT json\(rec\)/);
    } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('filterSelect with a limit keeps the newest n, oldest-first — same as queryProjection', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    for (let i = 0; i < 5; i++) {
      recordAudit(dir, { kind: 'hook', op: 'post-tool-use', sessionId: `s${i}`, hook: 'PostToolUse' });
    }
    const db = openProjection(dir);
    try {
      syncProjection(dir, db);
      const { sql, params } = filterSelect({ limit: 2 });
      const direct = (db.prepare(sql).all(...params) as { rec: string }[]).map((r) => JSON.parse(r.rec));
      assert.deepEqual(direct, queryProjection(db, { limit: 2 }));
      assert.deepEqual(direct.map((r) => r.sessionId), ['s3', 's4']);
    } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `node --test test/core/audit-db-seams.test.ts`
Expected: FAIL — `readCompleteLines` / `filterSelect` are not exported.

- [ ] **Step 4: Implement — a rename and an extraction, no behaviour change**

In `src/core/audit-db.ts`:

(a) Rename the already-exported `readSegmentFrom` to `readCompleteLines` and update **both** call sites — `syncProjection` in this file and `core/ledger-replay.ts`, a module that did not exist when this plan was written. It needs no `export` added; §0 records that half of this seam was already done. Extend its comment with one sentence: `Exported for the UI's live audit tail (web-ui plan 3), which must consume lines under exactly this torn-tail rule rather than re-spelling it.`

(b) Extract the SQL-building body of `queryProjection` (the `where`/`params` accumulation and the two `sql` forms) into:

```ts
/**
 * The SELECT `queryProjection` runs, exposed so the UI's query builder can
 * SHOW the SQL it executes (web-ui plan 3) without a second spelling of the
 * filter — two implementations of one filter is exactly the drift this
 * project keeps finding. The limit form selects the newest n and re-orders
 * oldest-first, like every other read of this log.
 */
export function filterSelect(filter: AuditFilter): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filter.since !== undefined) { where.push('at >= ?'); params.push(filter.since); }
  if (filter.until !== undefined) { where.push('at < ?'); params.push(filter.until); }
  if (filter.kind !== undefined) { where.push('kind = ?'); params.push(filter.kind); }
  if (filter.op !== undefined) { where.push('op = ?'); params.push(filter.op); }
  if (filter.origin !== undefined) { where.push('origin = ?'); params.push(filter.origin); }
  if (filter.sessionId !== undefined) { where.push('session_id = ?'); params.push(filter.sessionId); }
  if (filter.itemId !== undefined) {
    where.push('seq IN (SELECT seq FROM audit_item WHERE item_id = ?)');
    params.push(filter.itemId);
  }

  const clause = where.length === 0 ? '' : `WHERE ${where.join(' AND ')}`;
  const limited = filter.limit !== undefined && filter.limit > 0;
  const sql = limited
    ? `SELECT json(rec) AS rec FROM (
         SELECT seq, rec FROM audit ${clause} ORDER BY seq DESC LIMIT ?
       ) ORDER BY seq ASC`
    : `SELECT json(rec) AS rec FROM audit ${clause} ORDER BY seq ASC`;
  if (limited) params.push(filter.limit!);
  return { sql, params };
}

export function queryProjection(db: DatabaseSync, filter: AuditFilter): AuditRecord[] {
  const { sql, params } = filterSelect(filter);
  const rows = db.prepare(sql).all(...params) as { rec: string }[];
  return rows.map((r) => JSON.parse(r.rec) as AuditRecord);
}
```

(The bodies above are the shipped `queryProjection`'s own lines, moved. If the shipped text drifts from this plan, **the shipped text wins** — move what is there.)

- [ ] **Step 5: Run the new test, the audit suite, and the typecheck**

Run: `node --test test/core/audit-db-seams.test.ts && node --test test/core/audit-projection.test.ts && npx tsc --noEmit`
Expected: all green — the projection's own suite proves the extraction changed nothing.

- [ ] **Step 6: Commit**

```bash
git add src/core/audit-db.ts test/core/audit-db-seams.test.ts
git commit -m "feat(audit-db): export readCompleteLines and filterSelect for the web UI"
```

---
## Task 2: `src/core/audit-tail.ts` — the live tail

**Files:**
- Create: `src/core/audit-tail.ts`
- Test: `test/core/audit-tail.test.ts`

**Interfaces:**
- Consumes: `auditSegments`, `parseAudit` (`audit.ts`), `readCompleteLines` (Task 1), `node:fs`.
- Produces:
  - `interface TailResult { records: AuditRecord[]; resync: boolean }`
  - `class AuditTail { constructor(root: string); poll(): TailResult }` — the constructor primes offsets at every segment's current EOF, so `poll()` yields **only records appended after construction**. On divergence (a known file shrank or vanished — a rotation, a moved segment), offsets reset to the current EOFs and the result is `{ records: [], resync: true }`; nothing is replayed. `poll()` **throws** what `parseAudit` throws — a damaged complete line is a refusal, not a skip, per the audit log's own read contract.

- [ ] **Step 1: Write the failing test**

```ts
// test/core/audit-tail.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, renameSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { AuditTail } from '../../src/core/audit-tail.ts';
import { recordAudit, auditLogPath, auditDir } from '../../src/core/audit.ts';

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-tail-'));
}

test('records before construction are not emitted; records after are, in order', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-old', fields: ['body'] });
    const tail = new AuditTail(dir);
    assert.deepEqual(tail.poll(), { records: [], resync: false });

    recordAudit(dir, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }], tokens: 55 });
    recordAudit(dir, { kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });
    const result = tail.poll();
    assert.equal(result.resync, false);
    assert.deepEqual(result.records.map((r) => r.op), ['jit', 'focus-set']);
    assert.equal(result.records[0].spilled?.[0].reason, 'budget exceeded');
    assert.equal(result.records[0].tokens, 55);
    assert.deepEqual(tail.poll(), { records: [], resync: false });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a torn tail is not emitted until the line completes', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    recordAudit(dir, { kind: 'hook', op: 'deny', sessionId: 's1', hook: 'PreToolUse' });
    const file = auditLogPath(dir);
    const whole = readFileSync(file, 'utf8');
    const line = whole.trimEnd();
    writeFileSync(file, whole + line.slice(0, 20)); // a second record, torn mid-append
    const first = tail.poll();
    assert.deepEqual(first.records.map((r) => r.op), ['deny']); // the whole line only
    appendFileSync(file, line.slice(20) + '\n');
    const second = tail.poll();
    assert.deepEqual(second.records.map((r) => r.op), ['deny']); // now complete
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a rotation is a resync, never a replay', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    const tail = new AuditTail(dir);
    // Simulate what rotateIfFull does: rename the live log, start a fresh one.
    renameSync(auditLogPath(dir), path.join(auditDir(dir), 'audit.20260816T000000000Z-1.jsonl'));
    recordAudit(dir, { kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a', fields: ['title'] });
    const result = tail.poll();
    assert.equal(result.resync, true);
    assert.deepEqual(result.records, []); // nothing replayed — the client refetches its backlog
    // After the resync, tailing continues from the new EOFs.
    recordAudit(dir, { kind: 'mutation', op: 'link', origin: 'human', itemId: 'RULE-a', fields: ['relations'] });
    const next = tail.poll();
    assert.equal(next.resync, false);
    assert.deepEqual(next.records.map((r) => r.op), ['link']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a damaged complete line throws — the tail refuses rather than skips', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    recordAudit(dir, { kind: 'hook', op: 'deny', sessionId: 's1', hook: 'PreToolUse' });
    appendFileSync(auditLogPath(dir), 'not json\n');
    assert.throws(() => tail.poll(), /cannot be trusted/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an empty workspace (no .audit yet) polls quietly until the first record', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    assert.deepEqual(tail.poll(), { records: [], resync: false });
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    assert.deepEqual(tail.poll().records.map((r) => r.op), ['create']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/core/audit-tail.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/core/audit-tail.ts
import { statSync } from 'node:fs';
import { auditSegments, parseAudit, type AuditRecord } from './audit.ts';
import { readCompleteLines } from './audit-db.ts';

/**
 * A live tail over the audit log for the web UI's Watch stream (web-ui plan 3).
 *
 * The JSONL is the truth and this reads it directly — no projection sits
 * between an append and the screen. Offsets are per segment file; only
 * COMPLETE lines are consumed (`readCompleteLines`, the projection's own
 * rule), so a hook killed mid-append never puts half a record on a screen.
 *
 * **Divergence resyncs; it never replays.** When a file this tail has
 * consumed shrinks or vanishes — a rotation renaming the live log is the
 * ordinary cause — the byte offsets can no longer be trusted to mean "already
 * emitted". Re-reading from zero would show every record around the rotation
 * twice, in an audit view. So the tail resets to the current EOFs and reports
 * `resync: true`; the consumer (the stream route, then the screen) refetches
 * its backlog through the query surface, which reads the projection and is
 * immune to the rename. Nothing is dropped silently: the resync is an event
 * the screen renders, not a condition it swallows.
 *
 * `poll()` throws what `parseAudit` throws: a damaged COMPLETE line means the
 * log cannot be trusted, and the audit read contract (audit.ts, `specFor`)
 * refuses rather than skips. The stream route turns that into a disclosed
 * `fault` event and ends the stream.
 */
export interface TailResult {
  records: AuditRecord[];
  resync: boolean;
}

function sizeOf(file: string): number {
  try {
    return statSync(file).size;
  } catch {
    return -1; // gone
  }
}

export class AuditTail {
  #root: string;
  #offsets = new Map<string, number>();

  constructor(root: string) {
    this.#root = root;
    for (const file of auditSegments(root)) this.#offsets.set(file, sizeOf(file));
  }

  #resetToEof(files: string[]): void {
    this.#offsets = new Map();
    for (const file of files) this.#offsets.set(file, sizeOf(file));
  }

  poll(): TailResult {
    const files = auditSegments(this.#root);
    const present = new Set(files);

    for (const [file, offset] of this.#offsets) {
      if (!present.has(file) || sizeOf(file) < offset) {
        this.#resetToEof(files);
        return { records: [], resync: true };
      }
    }

    const records: AuditRecord[] = [];
    for (const file of files) {
      // A file not yet known is a brand-new live log (first record in an
      // empty workspace): read it from 0. A ROTATED segment can never appear
      // here unknown — rotation renames the live log, which the divergence
      // check above catches first.
      const offset = this.#offsets.get(file) ?? 0;
      const { text, consumed } = readCompleteLines(file, Math.max(0, offset));
      if (text !== '') records.push(...parseAudit(text, file));
      this.#offsets.set(file, consumed);
    }
    return { records, resync: false };
  }
}
```

- [ ] **Step 4: Run the test and see it pass**

Run: `node --test test/core/audit-tail.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/audit-tail.ts test/core/audit-tail.test.ts
git commit -m "feat(audit): AuditTail — offset tail with resync-on-divergence for the Watch stream"
```

---
## Task 3: `src/core/statusline-tee.ts` — the tee file and the three context states

**Files:**
- Create: `src/core/statusline-tee.ts`
- Test: `test/core/statusline-tee.test.ts`

**Interfaces:**
- Consumes: `ensureLogDir` (`jsonl-log.ts:74`), `node:fs`, `node:path`.
- Produces (the CLI command writes through this; the UI's `apiWatchContext` reads through it — one spelling of the file format and the state rules):
  - `statuslineDir(root: string): string` — `<root>/.statusline`, gitignored the way `.audit` is.
  - `sanitizeSessionId(id: string): string | null` — the id itself when it matches `/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/`, else `null`. Refusal, not mangling (design decision 7).
  - `teePath(root: string, sessionId: string): string | null`
  - `writeTee(root: string, payload: unknown, receivedAt?: string): { written: boolean; reason?: string }` — stores `{ receivedAt, payload }` whole, atomically (tmp + rename).
  - `readTee(root: string, sessionId: string): { receivedAt: string; payload: unknown } | null` — `null` when no sample exists (bridge not installed, or session never sampled) **or the session id is unsafe**; an unreadable/unparseable file is also `null` (a half-written sample from a killed process must read as "no sample", not as a crash).
  - `type ContextState = 'unknown' | 'not-yet-known' | 'known'`
  - `interface ContextSample { state: ContextState; usedTokens: number | null; windowSize: number | null; percent: number | null }`
  - `classifyContext(payload: unknown): ContextSample` — the §4b state machine, in one tested place. `known` computes input-only per design decision 8.

- [ ] **Step 1: Re-establish the payload shape on THIS machine**

The external-facts table above was built by grepping the installed Claude Code binary. Repeat it here, because the executor's build may be newer:

```bash
claude --version
grep -aoE 'total_input_tokens:e\?e\.input_tokens\+e\.cache_creation_input_tokens\+e\.cache_read_input_tokens:0' "$(which claude)" | head -1
grep -aoE 'context_window_size:t,current_usage:e,used_percentage' "$(which claude)" | head -1
```

Expected: the version prints, and both greps match (the construction is unchanged). If either grep is empty, the payload construction moved: re-extract it (`grep -aoE '.{0,120}total_input_tokens.{0,300}' "$(which claude)"`), update the external-facts table in this plan **and the recorded version in the spec §4b**, and adjust `classifyContext` only if the field names actually changed.

- [ ] **Step 2: Write the failing test**

```ts
// test/core/statusline-tee.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  sanitizeSessionId, statuslineDir, teePath, writeTee, readTee, classifyContext,
} from '../../src/core/statusline-tee.ts';

/** A payload in the shape Claude Code 2.1.233 actually sends (see the plan's external-facts table). */
function payload(contextWindow: unknown): Record<string, unknown> {
  return {
    session_id: 'sess-abc123',
    transcript_path: '/tmp/t.jsonl',
    cwd: '/repo',
    version: '2.1.233',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: '/repo', project_dir: '/repo' },
    cost: { total_cost_usd: 0.42 },
    ...(contextWindow === undefined ? {} : { context_window: contextWindow }),
  };
}

test('sanitizeSessionId refuses rather than mangles', () => {
  assert.equal(sanitizeSessionId('sess-abc123'), 'sess-abc123');
  assert.equal(sanitizeSessionId('a'.repeat(128)), 'a'.repeat(128));
  assert.equal(sanitizeSessionId('a'.repeat(129)), null);
  assert.equal(sanitizeSessionId('../escape'), null);
  assert.equal(sanitizeSessionId('.hidden'), null);
  assert.equal(sanitizeSessionId('has space'), null);
  assert.equal(sanitizeSessionId(''), null);
});

test('writeTee stores the payload WHOLE and readTee returns it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const p = payload({ total_input_tokens: 5, context_window_size: 10, current_usage: null });
    const result = writeTee(root, p, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(result, { written: true });
    const back = readTee(root, 'sess-abc123');
    assert.equal(back?.receivedAt, '2026-08-16T10:00:00.000Z');
    assert.deepEqual(back?.payload, p); // whole — nothing shredded at write time
    // The dir is gitignored like .audit is.
    assert.equal(readFileSync(path.join(statuslineDir(root), '.gitignore'), 'utf8').trim(), '*');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a payload without session_id, or with an unsafe one, is refused with the reason', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    const noId = writeTee(root, { cwd: '/x' });
    assert.equal(noId.written, false);
    assert.match(noId.reason!, /session_id/);
    const badId = writeTee(root, { session_id: '../../etc/passwd' });
    assert.equal(badId.written, false);
    assert.equal(existsSync(statuslineDir(root)) && existsSync(path.join(root, '..', 'etc')), false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('readTee: no sample is null; a half-written sample is null, not a crash', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-tee-'));
  try {
    assert.equal(readTee(root, 'sess-abc123'), null);
    assert.equal(readTee(root, '../escape'), null);
    mkdirSync(statuslineDir(root), { recursive: true });
    writeFileSync(teePath(root, 'sess-abc123')!, '{"receivedAt": "2026');
    assert.equal(readTee(root, 'sess-abc123'), null);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('classifyContext: no context_window at all is UNKNOWN — an older Claude Code build', () => {
  assert.deepEqual(classifyContext(payload(undefined)), {
    state: 'unknown', usedTokens: null, windowSize: null, percent: null,
  });
  assert.equal(classifyContext(payload(null)).state, 'unknown');
  assert.equal(classifyContext(payload('junk')).state, 'unknown');
});

test('classifyContext: current_usage null is NOT-YET-KNOWN — never zero (post-compact state)', () => {
  // Claude Code sends total_input_tokens: 0 in this state (verified in the
  // binary: the `e?…:0` branch). Keying on that 0 would render the state as
  // zero — the lie-toward-reassurance §4b constraint 2 names. The gate is
  // current_usage === null and nothing else.
  const sample = classifyContext(payload({
    total_input_tokens: 0, total_output_tokens: 0,
    context_window_size: 200000, current_usage: null,
    used_percentage: null, remaining_percentage: null,
  }));
  assert.equal(sample.state, 'not-yet-known');
  assert.equal(sample.usedTokens, null);
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, null);
});

test('classifyContext: KNOWN computes input-only from current_usage — the §4b constraint-3 formula', () => {
  const sample = classifyContext(payload({
    total_input_tokens: 47000, total_output_tokens: 9000,
    context_window_size: 200000,
    current_usage: {
      input_tokens: 1000, cache_creation_input_tokens: 6000,
      cache_read_input_tokens: 40000, output_tokens: 9000,
    },
    used_percentage: 23.5, remaining_percentage: 76.5,
  }));
  assert.equal(sample.state, 'known');
  assert.equal(sample.usedTokens, 47000);          // 1000 + 6000 + 40000 — output NOT folded in
  assert.equal(sample.windowSize, 200000);
  assert.equal(sample.percent, 23.5);
});

test('classifyContext: a current_usage missing its fields is UNKNOWN, not a guess', () => {
  const sample = classifyContext(payload({
    context_window_size: 200000, current_usage: { input_tokens: 5 },
  }));
  assert.equal(sample.state, 'unknown');
  assert.equal(sample.usedTokens, null);
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `node --test test/core/statusline-tee.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/core/statusline-tee.ts
import { readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { ensureLogDir } from './jsonl-log.ts';

// --- The status line tee ----------------------------------------------------
//
// `mycontext statusline` (the §4b bridge) receives Claude Code's status-line
// JSON on stdin and tees it here, one file per session, so the web UI can
// join the real context number to what the audit log says mycontext injected
// — on `session_id`, the key the ledger and the audit records already use.
//
// The payload is stored WHOLE, verbatim, wrapped as { receivedAt, payload }.
// Shredding fields at write time is how an external schema that grows gets
// silently dropped (INV-nothing-is-dropped-silently); interpretation happens
// at read time, in `classifyContext`, the one tested spelling of §4b's three
// states. `receivedAt` is stamped by the bridge command and is what every
// "as of" age is computed from.
//
// EXTERNAL SCHEMA, marked as such (spec §4b): everything `classifyContext`
// knows about the payload — `context_window`, `current_usage` and its three
// input fields — is a claim about Claude Code's interface, established by
// reading the installed 2.1.233 binary, and no test here fails when Claude
// Code changes it. The states are ordered so that every unrecognised shape
// degrades to 'unknown', never to a number.

export function statuslineDir(root: string): string {
  return path.join(root, '.statusline');
}

/**
 * A session id becomes a filename by REFUSAL, not by mangling: mangling two
 * distinct ids into one name would show one session's context as another's —
 * the exact failure keying by session exists to prevent. No leading dot, no
 * separators, ≤128 chars.
 */
export function sanitizeSessionId(id: string): string | null {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id) ? id : null;
}

export function teePath(root: string, sessionId: string): string | null {
  const safe = sanitizeSessionId(sessionId);
  return safe === null ? null : path.join(statuslineDir(root), `${safe}.json`);
}

export function writeTee(
  root: string,
  payload: unknown,
  receivedAt: string = new Date().toISOString(),
): { written: boolean; reason?: string } {
  const sid = (payload as { session_id?: unknown } | null)?.session_id;
  if (typeof sid !== 'string') {
    return { written: false, reason: 'the payload carries no string session_id' };
  }
  const file = teePath(root, sid);
  if (file === null) {
    return { written: false, reason: `session_id ${JSON.stringify(sid)} is not a safe filename — refusing rather than renaming it` };
  }
  try {
    ensureLogDir(statuslineDir(root));
    // Atomic: the UI reads this file while Claude Code rewrites it on every
    // response. A rename is whole-or-old; a plain overwrite can be read torn.
    const tmp = `${file}.tmp-${process.pid}`;
    writeFileSync(tmp, JSON.stringify({ receivedAt, payload }));
    renameSync(tmp, file);
    return { written: true };
  } catch (err) {
    return { written: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * `null` means "no sample": bridge not installed, session never sampled, an
 * unsafe id, or a file a killed process left unreadable. All of those must
 * render as the no-sample state, not crash a screen.
 */
export function readTee(root: string, sessionId: string): { receivedAt: string; payload: unknown } | null {
  const file = teePath(root, sessionId);
  if (file === null) return null;
  try {
    const parsed = JSON.parse(readFileSync(file, 'utf8')) as { receivedAt?: unknown; payload?: unknown };
    if (typeof parsed.receivedAt !== 'string' || parsed.payload === undefined) return null;
    return { receivedAt: parsed.receivedAt, payload: parsed.payload };
  } catch {
    return null;
  }
}

/**
 * §4b's three states, in one place:
 *  - 'unknown':        the payload has no usable `context_window` (older
 *                      Claude Code build, or a shape this code does not
 *                      recognise). An absent measurement is a state, not 0.
 *  - 'not-yet-known':  `current_usage` is null — after a compact, before the
 *                      next API call. Claude Code sends total_input_tokens: 0
 *                      here; the gate is `current_usage === null` and never
 *                      that 0 (§4b constraint 2).
 *  - 'known':          computed INPUT-ONLY — input + cache_creation +
 *                      cache_read over context_window_size — matching what
 *                      Claude Code itself displays (§4b constraint 3; the
 *                      binary's own total_input_tokens does this arithmetic).
 */
export type ContextState = 'unknown' | 'not-yet-known' | 'known';

export interface ContextSample {
  state: ContextState;
  usedTokens: number | null;
  windowSize: number | null;
  percent: number | null;
}

const UNKNOWN: ContextSample = { state: 'unknown', usedTokens: null, windowSize: null, percent: null };

export function classifyContext(payload: unknown): ContextSample {
  const cw = (payload as { context_window?: unknown } | null)?.context_window;
  if (cw === null || cw === undefined || typeof cw !== 'object') return UNKNOWN;
  const win = cw as { context_window_size?: unknown; current_usage?: unknown };
  const windowSize = typeof win.context_window_size === 'number' ? win.context_window_size : null;
  if (win.current_usage === null || win.current_usage === undefined) {
    return { state: 'not-yet-known', usedTokens: null, windowSize, percent: null };
  }
  if (typeof win.current_usage !== 'object') return UNKNOWN;
  const usage = win.current_usage as Record<string, unknown>;
  const num = (key: string): number | null => (typeof usage[key] === 'number' ? (usage[key] as number) : null);
  const input = num('input_tokens');
  const cacheCreation = num('cache_creation_input_tokens');
  const cacheRead = num('cache_read_input_tokens');
  if (input === null || cacheCreation === null || cacheRead === null) return UNKNOWN;
  const usedTokens = input + cacheCreation + cacheRead;
  const percent = windowSize !== null && windowSize > 0 ? (usedTokens / windowSize) * 100 : null;
  return { state: 'known', usedTokens, windowSize, percent };
}
```

- [ ] **Step 5: Run the test and see it pass**

Run: `node --test test/core/statusline-tee.test.ts && npx tsc --noEmit`
Expected: PASS (8 tests).

- [ ] **Step 6: Commit**

```bash
git add src/core/statusline-tee.ts test/core/statusline-tee.test.ts
git commit -m "feat(statusline): per-session tee file and the three context states of spec 4b"
```

---
## Task 4: `mycontext statusline` — the bridge command (print + tee)

> **This task ships with a perf test, and does not land without one.** The command runs on Claude Code's **per-message** path — more often than the PreToolUse hook, which is held to a 50 ms p95 ceiling and has `jit-latency.perf.ts` to prove it. `2026-08-18-v2-expert-review-addendum.md` §8.4 raised this as a fix to shipped code; it is not one, because no `statusline` command exists yet. It is a condition of building this task. Measure the print path and the tee write separately, on a 5,000-item corpus, and record the numbers in the test the way `audit-latency.perf.ts` and `focus-latency.perf.ts` do — taking them rather than asserting a ratio.

**Files:**
- Create: `src/cli/commands/statusline.ts`
- Modify: `src/cli/commands/index.ts` (add `import './statusline.ts';` beside the existing command imports)
- Test: `test/cli/statusline.test.ts`

**Interfaces:**
- Consumes: `readStdin` (`hooks/io.ts`), `writeTee`/`classifyContext` (Task 3), `openProjection`/`syncProjection`/`queryProjection` (`audit-db.ts`), `resolveWorkspace`, `registerCommand`.
- Produces:
  - The registered `statusline` command. With no subcommand: reads one JSON payload from stdin, tees it (when a project workspace is resolvable and the payload is safe), prints one line, exits 0. This is what the installed `statusLine.command` runs on every assistant message.
  - `statusLineText(sample: ContextSample, model: string | null, myctx: MyctxShare | null, myctxNote: string | null): string` — exported pure formatter, tested directly.
  - `interface MyctxShare { tokens: number; injections: number; unrecorded: number }`
  - `myctxShare(projectRoot: string, sessionId: string): MyctxShare` — the §4b numerator: injection records for the session from the projection (synced first), `tokens` summed **where recorded**, absences counted, never defaulted to zero. Throws when the projection cannot answer; the caller prints `myctx unavailable`, never a stale number.

The printed line, state by state (the §4b honesty constraints applied to the CLI surface — the same wording rules the UI strip uses):

| State | Line |
|---|---|
| known | `Opus 4.5 \| ctx 23.5% (47.0k/200.0k) \| myctx 6.2k of it (3 injections)` |
| known, some records unrecorded | `… \| myctx ≥6.2k of it (3 injections, 2 not recorded)` |
| not-yet-known | `Opus 4.5 \| ctx not yet known (no API call since the last compact) \| myctx …` |
| unknown | `Opus 4.5 \| ctx unknown (this Claude Code sends no context_window) \| myctx …` |
| projection failure | `… \| myctx unavailable (<reason>)` |
| no project workspace | `Opus 4.5 \| ctx 23.5% (47.0k/200.0k)` — no tee, no myctx half, nothing invented |

- [ ] **Step 1: Write the failing tests**

```ts
// test/cli/statusline.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { readTee, classifyContext } from '../../src/core/statusline-tee.ts';
import { statusLineText, myctxShare } from '../../src/cli/commands/statusline.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-sl-'));
  runCli(['init'], dir, () => {});
  return dir;
}

function payload(sessionId: string): Record<string, unknown> {
  return {
    session_id: sessionId,
    cwd: '/repo',
    version: '2.1.233',
    model: { id: 'claude-opus-4-5', display_name: 'Opus 4.5' },
    workspace: { current_dir: '/repo', project_dir: '/repo' },
    context_window: {
      total_input_tokens: 47000, total_output_tokens: 9000, context_window_size: 200000,
      current_usage: {
        input_tokens: 1000, cache_creation_input_tokens: 6000,
        cache_read_input_tokens: 40000, output_tokens: 9000,
      },
      used_percentage: 23.5, remaining_percentage: 76.5,
    },
  };
}

test('statusLineText renders each state without ever inventing a number', () => {
  const known = classifyContext(payload('s'));
  assert.equal(
    statusLineText(known, 'Opus 4.5', { tokens: 6200, injections: 3, unrecorded: 0 }, null),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k) | myctx 6.2k of it (3 injections)',
  );
  assert.equal(
    statusLineText(known, 'Opus 4.5', { tokens: 6200, injections: 3, unrecorded: 2 }, null),
    'Opus 4.5 | ctx 23.5% (47.0k/200.0k) | myctx ≥6.2k of it (3 injections, 2 not recorded)',
  );
  assert.equal(
    statusLineText({ state: 'not-yet-known', usedTokens: null, windowSize: 200000, percent: null }, 'Opus 4.5', null, null),
    'Opus 4.5 | ctx not yet known (no API call since the last compact)',
  );
  assert.equal(
    statusLineText({ state: 'unknown', usedTokens: null, windowSize: null, percent: null }, null, null, 'projection sync failed'),
    'ctx unknown (this Claude Code sends no context_window) | myctx unavailable (projection sync failed)',
  );
});

test('myctxShare sums recorded tokens and COUNTS absences — never defaults them to zero', () => {
  const dir = project();
  const root = path.join(dir, '.my_context');
  try {
    recordAudit(root, { kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart', injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 4000 });
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts', injected: [{ id: 'RULE-b', tier: 'jit' }], tokens: 2200 });
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/b.ts', injected: [{ id: 'RULE-c', tier: 'jit' }] }); // pre-tokens record
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 'OTHER', hook: 'PreToolUse', path: 'src/c.ts', injected: [{ id: 'RULE-d', tier: 'jit' }], tokens: 999 });
    assert.deepEqual(myctxShare(root, 's1'), { tokens: 6200, injections: 3, unrecorded: 1 });
    assert.deepEqual(myctxShare(root, 'never-seen'), { tokens: 0, injections: 0, unrecorded: 0 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the command tees the payload keyed by session and prints the line (spawned, real stdin)', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: JSON.stringify(payload('sess-e2e')), encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Opus 4\.5 \| ctx 23\.5% \(47\.0k\/200\.0k\)/);
    const tee = readTee(path.join(dir, '.my_context'), 'sess-e2e');
    assert.equal((tee?.payload as { session_id?: string }).session_id, 'sess-e2e');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unparseable stdin prints a diagnosis line and exits 0 — a status line must not crash-loop', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: 'not json', encoding: 'utf8',
    });
    assert.equal(result.status, 0);
    assert.match(result.stdout, /unreadable status payload/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('run bare with no stdin, it explains itself and exits 1', () => {
  const dir = project();
  try {
    const result = spawnSync(process.execPath, [CLI, 'statusline'], {
      cwd: dir, input: '', encoding: 'utf8',
    });
    assert.equal(result.status, 1);
    assert.match(result.stdout, /status-line JSON on stdin/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test test/cli/statusline.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// src/cli/commands/statusline.ts
import path from 'node:path';
import { openProjection, queryProjection, syncProjection } from '../../core/audit-db.ts';
import { classifyContext, writeTee, type ContextSample } from '../../core/statusline-tee.ts';
import { resolveWorkspace } from '../../core/workspace.ts';
import { readStdin } from '../../hooks/io.ts';
import { registerCommand, type Emit } from './registry.ts';
import type { Workspace } from '../../core/workspace.ts';
import { cmdStatuslineInstall, cmdStatuslineUninstall } from './statusline-install.ts'; // Task 5

// --- The status line bridge (spec §4b) --------------------------------------
//
// Claude Code runs the configured statusLine command on every assistant
// message and pipes a JSON payload to its stdin. This command does two things
// with it: TEES it whole to a per-session file (core/statusline-tee.ts) so
// the web UI can join the context number to the audit log on session_id, and
// PRINTS one line for Claude Code to display.
//
// This is the ONE thing in the web-ui plans that writes a file, and it is a
// CLI command the user installs deliberately (`statusline install`, opt-in,
// print-and-ask) — never a UI endpoint. The UI itself remains read-only.

export interface MyctxShare {
  tokens: number;
  injections: number;
  unrecorded: number;
}

/**
 * The §4b numerator: what mycontext put into this session, from injection
 * records' `tokens` — the estimate frozen at injection time, never re-derived
 * from today's corpus. Records that predate the field are COUNTED as
 * unrecorded, not summed as zero (`audit.ts`, the field's own contract).
 * Synced first; throws when the projection cannot answer, and the caller
 * prints "unavailable" rather than a stale number.
 */
export function myctxShare(projectRoot: string, sessionId: string): MyctxShare {
  const db = openProjection(projectRoot);
  try {
    syncProjection(projectRoot, db);
    const records = queryProjection(db, { sessionId, kind: 'injection' });
    let tokens = 0;
    let unrecorded = 0;
    for (const record of records) {
      if (typeof record.tokens === 'number') tokens += record.tokens;
      else unrecorded++;
    }
    return { tokens, injections: records.length, unrecorded };
  } finally {
    db.close();
  }
}

function fmtK(n: number): string {
  return `${(n / 1000).toFixed(1)}k`;
}

/** One line, one spelling per state — the same honesty rules the UI strip renders. */
export function statusLineText(
  sample: ContextSample,
  model: string | null,
  myctx: MyctxShare | null,
  myctxNote: string | null,
): string {
  const parts: string[] = [];
  if (model !== null) parts.push(model);
  if (sample.state === 'known' && sample.usedTokens !== null) {
    const pct = sample.percent !== null ? `${sample.percent.toFixed(1)}%` : '?%';
    const size = sample.windowSize !== null ? fmtK(sample.windowSize) : '?';
    parts.push(`ctx ${pct} (${fmtK(sample.usedTokens)}/${size})`);
  } else if (sample.state === 'not-yet-known') {
    parts.push('ctx not yet known (no API call since the last compact)');
  } else {
    parts.push('ctx unknown (this Claude Code sends no context_window)');
  }
  if (myctx !== null) {
    const approx = myctx.unrecorded > 0 ? '≥' : '';
    const suffix = myctx.unrecorded > 0
      ? ` (${myctx.injections} injections, ${myctx.unrecorded} not recorded)`
      : ` (${myctx.injections} injections)`;
    if (myctx.injections > 0) parts.push(`myctx ${approx}${fmtK(myctx.tokens)} of it${suffix}`);
  } else if (myctxNote !== null) {
    parts.push(`myctx unavailable (${myctxNote})`);
  }
  return parts.join(' | ');
}

function cmdStatusline(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (args[0] === 'install') return cmdStatuslineInstall(ws, args.slice(1), out);
  if (args[0] === 'uninstall') return cmdStatuslineUninstall(ws, args.slice(1), out);

  const raw = readStdin();
  if (raw.trim() === '') {
    out(
      'my_context: `mycontext statusline` expects Claude Code\'s status-line JSON on stdin. ' +
      'It is installed as a statusLine command by `mycontext statusline install` — see that ' +
      'subcommand, which prints your existing setting and asks before writing anything.',
    );
    return 1;
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    // The line IS the surface here: a thrown error would make Claude Code's
    // status line flicker between runs. Diagnose in the line, exit 0.
    out('mycontext: unreadable status payload (not JSON)');
    return 0;
  }

  // Resolve the workspace from where the payload says the session lives, not
  // from this process's cwd — Claude Code documents no cwd for statusLine
  // commands, and the payload carries the truth.
  const p = payload as { cwd?: unknown; workspace?: { project_dir?: unknown }; session_id?: unknown; model?: { display_name?: unknown; id?: unknown } };
  const sessionCwd =
    typeof p.workspace?.project_dir === 'string' ? p.workspace.project_dir
    : typeof p.cwd === 'string' ? p.cwd
    : cwd;
  const sessionWs = resolveWorkspace(sessionCwd);

  const sample = classifyContext(payload);
  const model =
    typeof p.model?.display_name === 'string' ? p.model.display_name
    : typeof p.model?.id === 'string' ? p.model.id
    : null;

  let myctx: MyctxShare | null = null;
  let myctxNote: string | null = null;
  if (sessionWs.projectRoot !== null) {
    const tee = writeTee(sessionWs.projectRoot, payload);
    if (!tee.written && tee.reason !== undefined) myctxNote = tee.reason;
    if (typeof p.session_id === 'string') {
      try {
        myctx = myctxShare(sessionWs.projectRoot, p.session_id);
      } catch (err) {
        myctx = null;
        myctxNote = err instanceof Error ? err.message : String(err);
      }
    }
  }

  out(statusLineText(sample, model, myctx, myctxNote));
  return 0;
}

registerCommand({
  name: 'statusline',
  usage: 'statusline [install|uninstall] [--yes]',
  summary: 'the opt-in status line bridge: tee Claude Code’s context figure for the web UI',
  run: cmdStatusline,
});
```

Note the import of `./statusline-install.ts` — Task 5 creates it. To keep this task independently green, create it now as the two-function stub that Task 5 replaces with the real body:

```ts
// src/cli/commands/statusline-install.ts  (Task 4 stub — Task 5 replaces the bodies)
import type { Workspace } from '../../core/workspace.ts';
import type { Emit } from './registry.ts';

export function cmdStatuslineInstall(_ws: Workspace, _args: string[], out: Emit): number {
  out('my_context: `statusline install` is not available in this build.');
  return 1;
}

export function cmdStatuslineUninstall(_ws: Workspace, _args: string[], out: Emit): number {
  out('my_context: `statusline uninstall` is not available in this build.');
  return 1;
}
```

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/cli/statusline.test.ts && npm test && npx tsc --noEmit`
Expected: PASS (5 tests), suite green.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/statusline.ts src/cli/commands/statusline-install.ts src/cli/commands/index.ts test/cli/statusline.test.ts
git commit -m "feat(cli): mycontext statusline — tee the payload per session, print the joined line"
```

---
## Task 5: `statusline install` / `uninstall` — print, ask, then write; reversibly

The spec's binding constraint (§4b, §8's risk row): *opt-in, never installed as a side effect; the installer prints the user's existing `statusLine` setting and what it would replace it with, and asks, before writing anything.* `CommandFn` is synchronous and this CLI has no interactive prompt, so "asks" takes the project's own consent form: without `--yes` the command prints both settings and **exits without writing**; `--yes` — the greppable consent token README §7 already gives that meaning — applies it. The replaced value is saved and `uninstall --yes` restores it, so a replacement is reversible rather than merely announced.

**Files:**
- Modify: `src/cli/commands/statusline-install.ts` (replace the Task 4 stub bodies)
- Test: extend `test/cli/statusline.test.ts`

**Interfaces:**
- Consumes: `node:fs`, `node:path`, `node:os`, `Workspace.globalRoot`.
- Produces:
  - `cmdStatuslineInstall(ws, args, out): number` — flags: `--yes`, `--settings <path>` (override for tests and for project-level settings files; default `$CLAUDE_CONFIG_DIR/settings.json` else `~/.claude/settings.json` — `CLAUDE_CONFIG_DIR` is honoured by Claude Code itself, see the external-facts table).
  - `cmdStatuslineUninstall(ws, args, out): number` — same flags; restores the saved previous value (or removes the key if none was saved), only with `--yes`.
  - `claudeSettingsPath(env: Record<string, string | undefined>): string` — exported, tested.
  - The backup file: `<ws.globalRoot>/statusline-replaced.json` as `{ replacedAt: string; settingsPath: string; previous: unknown }` (`previous` is `null` when there was no `statusLine` key).
  - The installed value, exactly: `{ "type": "command", "command": "mycontext statusline", "refreshInterval": 60 }` — `refreshInterval` per spec §4b's Compatibility note, so the tee stays fresh while a session idles and the UI's "as of" age does not drift for no reason.

- [ ] **Step 1: Write the failing tests** (append to `test/cli/statusline.test.ts`)

```ts
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { claudeSettingsPath } from '../../src/cli/commands/statusline-install.ts';

test('claudeSettingsPath honours CLAUDE_CONFIG_DIR and falls back to ~/.claude', () => {
  assert.equal(claudeSettingsPath({ CLAUDE_CONFIG_DIR: '/cfg' }), path.join('/cfg', 'settings.json'));
  assert.ok(claudeSettingsPath({}).endsWith(path.join('.claude', 'settings.json')));
});

function settingsFixture(dir: string, body: unknown): string {
  const file = path.join(dir, 'settings.json');
  writeFileSync(file, JSON.stringify(body, null, 2));
  return file;
}

test('install without --yes prints both settings and WRITES NOTHING', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inst-'));
  try {
    const file = settingsFixture(dir, { statusLine: { type: 'command', command: 'bash my-line.sh' }, model: 'opus' });
    const before = readFileSync(file, 'utf8');
    const lines: string[] = [];
    const code = runCli(['statusline', 'install', '--settings', file], dir, (s) => lines.push(s));
    assert.equal(code, 0);
    const text = lines.join('\n');
    assert.match(text, /bash my-line\.sh/);            // the existing setting, shown
    assert.match(text, /mycontext statusline/);        // the replacement, shown
    assert.match(text, /--yes/);                       // how to consent
    assert.equal(readFileSync(file, 'utf8'), before);  // NOT written
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('install --yes writes the setting, preserves every other key, and saves the previous value', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inst-'));
  try {
    runCli(['init'], dir, () => {});
    const file = settingsFixture(dir, { statusLine: { type: 'command', command: 'bash my-line.sh' }, model: 'opus' });
    const code = runCli(['statusline', 'install', '--settings', file, '--yes'], dir, () => {});
    assert.equal(code, 0);
    const after = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(after.statusLine, { type: 'command', command: 'mycontext statusline', refreshInterval: 60 });
    assert.equal(after.model, 'opus'); // untouched
    const ws = resolveWorkspace(dir);
    const backup = JSON.parse(readFileSync(path.join(ws.globalRoot, 'statusline-replaced.json'), 'utf8'));
    assert.deepEqual(backup.previous, { type: 'command', command: 'bash my-line.sh' });

    const uncode = runCli(['statusline', 'uninstall', '--settings', file, '--yes'], dir, () => {});
    assert.equal(uncode, 0);
    const restored = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(restored.statusLine, { type: 'command', command: 'bash my-line.sh' });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('install --yes on a settings file with NO statusLine records previous: null; uninstall removes the key', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inst-'));
  try {
    runCli(['init'], dir, () => {});
    const file = settingsFixture(dir, { model: 'opus' });
    runCli(['statusline', 'install', '--settings', file, '--yes'], dir, () => {});
    runCli(['statusline', 'uninstall', '--settings', file, '--yes'], dir, () => {});
    const restored = JSON.parse(readFileSync(file, 'utf8'));
    assert.equal('statusLine' in restored, false);
    assert.equal(restored.model, 'opus');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an unparseable settings file is refused untouched — never clobbered', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inst-'));
  try {
    const file = path.join(dir, 'settings.json');
    writeFileSync(file, '{ not json');
    const lines: string[] = [];
    const code = runCli(['statusline', 'install', '--settings', file, '--yes'], dir, (s) => lines.push(s));
    assert.equal(code, 1);
    assert.match(lines.join('\n'), /could not be parsed/);
    assert.equal(readFileSync(file, 'utf8'), '{ not json');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('a missing settings file installs into a fresh one (a user who never configured Claude Code)', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-inst-'));
  try {
    runCli(['init'], dir, () => {});
    const file = path.join(dir, 'nested', 'settings.json');
    const code = runCli(['statusline', 'install', '--settings', file, '--yes'], dir, () => {});
    assert.equal(code, 0);
    const after = JSON.parse(readFileSync(file, 'utf8'));
    assert.deepEqual(after.statusLine, { type: 'command', command: 'mycontext statusline', refreshInterval: 60 });
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
```

(Add `resolveWorkspace` to the test file's imports from `../../src/core/workspace.ts`.)

- [ ] **Step 2: Run and see the new tests fail**

Run: `node --test test/cli/statusline.test.ts`
Expected: the new tests FAIL against the Task 4 stub ("not available in this build"); the Task 4 tests still pass.

- [ ] **Step 3: Implement — replace the stub bodies**

```ts
// src/cli/commands/statusline-install.ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import type { Workspace } from '../../core/workspace.ts';
import { hasFlag, flag, type Emit } from './registry.ts';

// --- Installing the bridge (spec §4b: opt-in; §8: never clobber) ------------
//
// The binding rule: installing mycontext never touches a status line; asking
// for the bridge does, and only after the existing setting has been shown.
// `CommandFn` is synchronous and this CLI has no interactive prompt, so "ask"
// is the project's own consent form: WITHOUT --yes this prints the existing
// setting and the exact replacement and exits without writing; --yes — the
// greppable consent token README §7 defines — applies it. The replaced value
// is saved to <globalRoot>/statusline-replaced.json and `uninstall --yes`
// restores it: a replacement is reversible, not merely announced.

const INSTALLED = { type: 'command', command: 'mycontext statusline', refreshInterval: 60 } as const;

/** Where Claude Code reads settings: CLAUDE_CONFIG_DIR, else ~/.claude (both honoured by Claude Code itself). */
export function claudeSettingsPath(env: Record<string, string | undefined>): string {
  const dir = env.CLAUDE_CONFIG_DIR !== undefined && env.CLAUDE_CONFIG_DIR !== ''
    ? env.CLAUDE_CONFIG_DIR
    : path.join(homedir(), '.claude');
  return path.join(dir, 'settings.json');
}

function backupPath(ws: Workspace): string {
  return path.join(ws.globalRoot, 'statusline-replaced.json');
}

function readSettings(file: string, out: Emit): { ok: true; value: Record<string, unknown> } | { ok: false } {
  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return { ok: true, value: {} }; // no file yet: a user who never configured Claude Code
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    return { ok: true, value: parsed as Record<string, unknown> };
  } catch {
    out(
      `my_context: ${file} exists but could not be parsed as a JSON object. Refusing to touch it — ` +
      `fix the file first. Nothing was written.`,
    );
    return { ok: false };
  }
}

function writeSettings(file: string, value: Record<string, unknown>): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function cmdStatuslineInstall(ws: Workspace, args: string[], out: Emit): number {
  const file = flag(args, 'settings')?.value ?? claudeSettingsPath(process.env);
  const settings = readSettings(file, out);
  if (!settings.ok) return 1;
  const previous = 'statusLine' in settings.value ? settings.value.statusLine : null;

  out(`Settings file:      ${file}`);
  out(`Current statusLine: ${previous === null ? '(none)' : JSON.stringify(previous)}`);
  out(`Would install:      ${JSON.stringify(INSTALLED)}`);

  if (!hasFlag(args, 'yes')) {
    out('');
    out(
      'Nothing was written. Re-run with --yes to replace the setting shown above. The replaced ' +
      'value is saved and `mycontext statusline uninstall --yes` restores it.',
    );
    return 0;
  }

  mkdirSync(ws.globalRoot, { recursive: true });
  writeFileSync(backupPath(ws), `${JSON.stringify({
    replacedAt: new Date().toISOString(), settingsPath: file, previous,
  }, null, 2)}\n`);
  writeSettings(file, { ...settings.value, statusLine: INSTALLED });
  out('');
  out(
    'Installed. Claude Code will run `mycontext statusline` on every assistant message; the web ' +
    'UI can now show the real context number for a session — as of its last response, and only ' +
    'while this bridge stays installed. `mycontext statusline uninstall --yes` restores the ' +
    'setting shown above.',
  );
  return 0;
}

export function cmdStatuslineUninstall(ws: Workspace, args: string[], out: Emit): number {
  const fileFlag = flag(args, 'settings')?.value;
  let saved: { settingsPath: string; previous: unknown } | null = null;
  try {
    saved = JSON.parse(readFileSync(backupPath(ws), 'utf8')) as { settingsPath: string; previous: unknown };
  } catch {
    saved = null;
  }
  const file = fileFlag ?? saved?.settingsPath ?? claudeSettingsPath(process.env);
  const settings = readSettings(file, out);
  if (!settings.ok) return 1;

  const restoreTo = saved?.previous ?? null;
  out(`Settings file:      ${file}`);
  out(`Current statusLine: ${'statusLine' in settings.value ? JSON.stringify(settings.value.statusLine) : '(none)'}`);
  out(`Would restore:      ${restoreTo === null ? '(remove the statusLine key)' : JSON.stringify(restoreTo)}`);
  if (!hasFlag(args, 'yes')) {
    out('');
    out('Nothing was written. Re-run with --yes to apply the restore shown above.');
    return 0;
  }

  const next = { ...settings.value };
  if (restoreTo === null) delete next.statusLine;
  else next.statusLine = restoreTo;
  writeSettings(file, next);
  out('');
  out('Restored. The web UI now shows only what mycontext injected, and says so (spec §7).');
  return 0;
}
```

(`flag`/`hasFlag` are the registry's existing helpers — `src/cli/commands/registry.ts`. If `flag`'s return shape differs from `?.value` on this tree, read the registry and match it; every other command in `src/cli/commands/` is the reference.)

- [ ] **Step 4: Run the tests and the suite**

Run: `node --test test/cli/statusline.test.ts && npm test && npx tsc --noEmit`
Expected: PASS (10 tests in the file), suite green.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/statusline-install.ts test/cli/statusline.test.ts
git commit -m "feat(cli): statusline install/uninstall — print the existing setting, ask, write reversibly"
```

---
## Task 6: `src/ui/watch-model.ts` — spills, the pulse's volume, context, and the stream route

> **One of these four still has no home on the mockup's Watch screen — 2026-08-20.** `data-p="watch"`
> holds one card: the **activity pulse** (`#pulse`, `watch.pulsen`), five kind filters including
> `focus`, the record table, an `aria-live` count, and `watch.voidn`. There is **no spills pane** on
> it. `apiWatchSpills` stays in this task — it is pure, tested and cheap, and the spills record is
> still the only answer to "why didn't Claude see this item" — but **Task 11 renders no spills
> pane**, pending the owner (§0, open question 2). `apiWatchContext` and the stream route are
> unaffected: both are drawn.
>
> **`/api/watch/volume` IS the pulse's endpoint, and it reads the AUDIT projection — owner ruling
> A2, 2026-08-20.** The pulse needs record counts **by kind**, in **ten-second** buckets, over 120
> columns. The ledger supplies neither half. It has no kind column; and its primary key
> `(session_id, item_id, tier)` keeps `injected_at` as a mere value, so a repeat injection inside
> one session collides into the row already there and a series drawn from it undercounts by exactly
> those repeats — `Ledger.history()`'s own docstring says so
> (`core/ledger.ts` · `from it undercounts by exactly the repeats the key swallowed. Which stamp` · ~452).
> The audit projection carries both facts on the SAME row, each indexed, so **no join is required**:
> `at` (`core/audit-db.ts` · `(rec ->> '$.at')` · ~64) under `idx_audit_at`, and `kind`
> (`core/audit-db.ts` · `(rec ->> '$.kind')` · ~65) under `idx_audit_kind`. Both are VIRTUAL
> generated columns over the stored `rec` blob; `audit_item` — the side table that WOULD need a
> join — answers a per-item question, not this one. This task designs that endpoint.
>
> **What is still not designed here is the DRAWING.** The pulse element, its per-kind colouring and
> its place in the Watch card belong to Tasks 10 and 11 and remain the §0 row recording that this
> plan has no view for it. A bucketed rollup done in SQL rather than in JS remains open question 3's
> territory: this endpoint reads records through the shipped `queryProjection` and buckets them in a
> pure function, and its column cap is what keeps that read bounded.

The screen this plan exists for. Spills are its centre: a `spilled` entry is the only record anywhere of an item that was **selected and did not fit the budget**, and "why didn't Claude see this item" is answered by it and by nothing else (spec §5; `audit-db.ts`'s own `audit_item` comment).

**Files:**
- Create: `src/ui/watch-model.ts`
- Test: `test/ui/watch-model.test.ts`

**Interfaces:**
- Consumes: `AuditTail` (Task 2), `readTee`/`classifyContext` (Task 3), `openProjection`/`syncProjection`/`queryProjection`/`topItems` (`audit-db.ts`), `AUDIT_KINDS`/`AuditKind` (`core/audit.ts` · `export const AUDIT_KINDS: AuditKind[] = [` · ~121 — the pulse's six colours, taken from the one declaration rather than respelled), `registerRoute`/`ApiContext`/`JsonResult` (Plan 1 Task 8 — `kind: 'stream'` gets its first caller here), and Plan 1 read-model's refusal helpers (Step 1 establishes their export). **No ledger read remains in this task** — ruling A2 moved `/api/watch/volume` off `Ledger.history`.
- Produces:
  - `registerWatchRoutes(): void` — registers `GET /api/watch/volume`, `GET /api/watch/context`, `GET /api/watch/spills` (all `kind: 'json'`) and `GET /api/watch/stream` (`kind: 'stream'` — **the route the idle rule was built for**: the dispatch loop never `touch()`es it, Plan 1 Task 13).
  - `recordVolume(rows: { at: string; kind: string }[], bucketMs: number, buckets: number, now: number): { start: string; total: number; byKind: Record<AuditKind, number> }[]` — pure. Every one of `AUDIT_KINDS` appears on every bucket, at zero where nothing happened: an absent key would leave the pulse unable to tell "no records of that kind" from "that kind is unknown here", which is design decision 3's absence-is-not-zero rule read in the other direction.
  - `apiWatchVolume(ws, url): JsonResult` — `?minutes=` 1–1440 default **20** and `?bucket=` seconds 1–3600 default **10** (the mockup's own 120 × 10 s), refusing a window that does not divide into whole buckets and any pair asking for more than 1440 columns → `{ minutes, bucketSeconds, buckets, projectionStateBeforeSync }`. Sourced from the **audit projection**, synced first and refusing with 503 when it cannot catch up — design decision 4, the same rule `apiWatchSpills` follows.
  - `apiWatchContext(ws, url): JsonResult` — `?session=` required → `{ session, sample, mycontext, mycontextError }` where `sample` is `null` (no tee — bridge not installed or session never sampled) or `{ receivedAt, model, version, context: ContextSample }`; `mycontext` is `{ tokens, injections, unrecorded } | null` with `mycontextError` carrying the reason when null. The client owns the wording; this endpoint owns never inventing a number.
  - `apiWatchSpills(ws, url): JsonResult` — `?item=` optional, `?limit=` 1–500 default 50 → `{ spills, topSpilled, recordWindow, projectionStateBeforeSync }`; each spill is `{ at, sessionId, hook, path, id, tier, reason, tokens }` (`tokens` is the parent record's field: `number` or `null` for "not recorded"). Projection sync failure → 503, never a partial list.
  - `STREAM_POLL_MS = 1000`; the stream accepts `?poll=` 50–10000 (design decision 11). SSE frames over `text/event-stream`: `hello {pollMs}`, `record <AuditRecord>`, `resync {}`, `fault {error}` (then the stream ends).

- [ ] **Step 1: Establish the refusal helpers, and export them if private**

Plan 1's `read-model.ts` has `unknownParams(url, allowed)` and `badRequest(msg)` (its tasks call them). Run:

```bash
node -e "import('./src/ui/read-model.ts').then(m => console.log(typeof m.unknownParams, typeof m.badRequest, typeof m.withStores))"
```

If any prints `undefined`, add `export` to it in `src/ui/read-model.ts` (a one-word diff each; they are the refusal rule and the store-open rule — a second spelling in this module is the drift §3 bans). The two this task calls are `unknownParams(url: URL, allowed: string[]): string | null` and `badRequest(msg: string): JsonResult`.

**`withStores` has moved, and after ruling A2 this task no longer calls it.** Its corrected shape is:

```ts
withStores<T>(ws: Workspace, fn: (store: Store, ledger: Ledger | null) => T): T
```

**Both handles are opened READ-ONLY and checked, and both are closed** — `Store.openReadOnlyChecked` and `Ledger.openReadOnlyChecked` (`core/ledger.ts` · `static openReadOnlyChecked(dbPath: string): Ledger {` · ~222), the second shipped in `1cb968a`. It is no longer "Store before Ledger for the corruption self-heal": a read-only open cannot create a database and never triggers a self-heal, so that ordering constraint is gone; the Store is still opened first only because its `schema_version` check is what proves the file is a my_context index at all.

**The ledger argument is NULLABLE, and the null is a STATE rather than a failure.** A corpus no hook has ever injected into has no `ledger`/`ledger_source` tables, because those are created by `Ledger.open`, which is a write a read-only caller never performs. That one state is marked by **class** — `LedgerUninitializedError` (`core/ledger.ts` · `export class LedgerUninitializedError extends Error {}` · ~91) — so it is never told from damage by a message; only that class is swallowed, and a corrupt file, a truncated one or half a ledger all propagate.

**The owner ruled how the null renders (2026-08-20): as the mockup's zero-data view** — what the `∅` header toggle shows, whose pattern is the `.empty` block: a bold headline naming the state, one small sentence saying it is the normal state of a new workspace rather than a wall of warnings, and the command that ends it. `cov.e1` / `cov.e2` is the worked example. **Never an empty chart, and never an error.** Any handler that destructures the ledger without checking for `null` is the silent drop, one type away.

None of this task's four handlers opens a ledger any more — `apiWatchVolume` moved to the audit projection under A2, and the other three were never ledger reads — so the shape above is recorded here for the §0 correction log it belongs to and for the next task that wants a ledger read, not because Step 4 calls it. If the shipped names differ, use the shipped names throughout this task and record them in the commit message — do not invent parallel ones.

- [ ] **Step 2: Write the failing tests**

```ts
// test/ui/watch-model.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import {
  recordVolume, apiWatchVolume, apiWatchContext, apiWatchSpills,
} from '../../src/ui/watch-model.ts';

function workspace(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-'));
  runCli(['init'], dir, () => {});
  return { dir, root: path.join(dir, '.my_context'), done: () => rmSync(dir, { recursive: true, force: true }) };
}

function url(pathname: string, qs = ''): URL {
  return new URL(`http://127.0.0.1:1${pathname}${qs === '' ? '' : `?${qs}`}`);
}

test('recordVolume buckets by kind and drops nothing inside the window', () => {
  const now = Date.parse('2026-08-16T12:00:00.000Z');
  const rows = [
    { at: '2026-08-16T11:30:00.000Z', kind: 'injection' },
    { at: '2026-08-16T11:45:00.000Z', kind: 'focus' },
    { at: '2026-08-16T10:30:00.000Z', kind: 'injection' },
    { at: '2026-08-16T10:31:00.000Z', kind: 'mutation' },
    { at: '2026-08-10T10:30:00.000Z', kind: 'hook' }, // outside the window
  ];
  const buckets = recordVolume(rows, 3_600_000, 2, now);
  assert.equal(buckets.length, 2);
  assert.deepEqual(buckets.map((b) => b.total), [2, 2]);
  assert.equal(buckets[0].start, '2026-08-16T10:00:00.000Z');
  // Every kind on every bucket, at zero. An absent key would be
  // indistinguishable from a kind this build does not know.
  assert.deepEqual(buckets[0].byKind, { mutation: 1, injection: 1, hook: 0, focus: 0 });
  assert.deepEqual(buckets[1].byKind, { mutation: 0, injection: 1, hook: 0, focus: 1 });
});

test('/api/watch/volume validates its window and answers from the audit projection', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    // The kind the LEDGER could never have supplied — it records injections
    // and nothing else, which is half of why A2 moved this endpoint.
    recordAudit(root, { kind: 'focus', op: 'focus-set', sessionId: 's1', note: 'src/**' });

    const ok = apiWatchVolume(ws, url('/api/watch/volume', 'minutes=20&bucket=10'));
    assert.equal(ok.status, 200);
    const body = ok.body as {
      minutes: number; bucketSeconds: number;
      buckets: { total: number; byKind: Record<string, number> }[];
    };
    assert.equal(body.minutes, 20);
    assert.equal(body.bucketSeconds, 10);
    assert.equal(body.buckets.length, 120);      // the mockup's 120 columns, exactly
    assert.equal(body.buckets.reduce((n, b) => n + b.total, 0), 2);
    assert.equal(body.buckets.reduce((n, b) => n + b.byKind.focus, 0), 1);

    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=0')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=99999')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'bucket=0')).status, 400);
    // 20 minutes does not divide into 7-second buckets: refused, not rounded.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=20&bucket=7')).status, 400);
    // 1440 minutes at one-second buckets is 86,400 columns: refused, not sliced.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'minutes=1440&bucket=1')).status, 400);
    // The retired parameter is not quietly tolerated either.
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'hours=2')).status, 400);
    assert.equal(apiWatchVolume(ws, url('/api/watch/volume', 'bogus=1')).status, 400);
  } finally { done(); }
});

test('/api/watch/context: no tee is sample null — the no-bridge state, not zero', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiWatchContext(ws, url('/api/watch/context', 'session=sess-1'));
    assert.equal(result.status, 200);
    const body = result.body as { sample: unknown; mycontext: { injections: number } | null };
    assert.equal(body.sample, null);
    assert.equal(body.mycontext?.injections, 0);
    assert.equal(apiWatchContext(ws, url('/api/watch/context')).status, 400); // session required
  } finally { done(); }
});

test('/api/watch/context joins the tee sample to the audit tokens, absences counted', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    writeTee(root, {
      session_id: 'sess-1', version: '2.1.233', model: { display_name: 'Opus 4.5' },
      context_window: {
        context_window_size: 200000,
        current_usage: { input_tokens: 1000, cache_creation_input_tokens: 0, cache_read_input_tokens: 46000, output_tokens: 1 },
      },
    }, '2026-08-16T10:00:00.000Z');
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 'sess-1', hook: 'PreToolUse', path: 'a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 6200 });
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 'sess-1', hook: 'PreToolUse', path: 'b.ts', injected: [{ id: 'RULE-b', tier: 'jit' }] });

    const body = apiWatchContext(ws, url('/api/watch/context', 'session=sess-1')).body as {
      sample: { receivedAt: string; model: string; context: { state: string; usedTokens: number } };
      mycontext: { tokens: number; injections: number; unrecorded: number };
    };
    assert.equal(body.sample.receivedAt, '2026-08-16T10:00:00.000Z');
    assert.equal(body.sample.model, 'Opus 4.5');
    assert.equal(body.sample.context.state, 'known');
    assert.equal(body.sample.context.usedTokens, 47000);
    assert.deepEqual(body.mycontext, { tokens: 6200, injections: 2, unrecorded: 1 });
  } finally { done(); }
});

test('/api/watch/spills flattens spilled refs with their reasons, item filter narrows, tokens absence is null', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded (900 > 800 estimated tokens)' }],
      tokens: 40,
    });
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's2', hook: 'SessionStart',
      injected: [], spilled: [{ id: 'RULE-c', tier: 'pinned', reason: 'budget exceeded' }],
    });

    const all = apiWatchSpills(ws, url('/api/watch/spills')).body as {
      spills: { id: string; reason: string; tokens: number | null }[];
      topSpilled: { label: string; count: number }[];
    };
    assert.deepEqual(all.spills.map((s) => s.id), ['RULE-b', 'RULE-c']);
    assert.match(all.spills[0].reason, /budget exceeded/);
    assert.equal(all.spills[0].tokens, 40);
    assert.equal(all.spills[1].tokens, null); // not recorded — never zero
    assert.deepEqual(all.topSpilled.map((t) => t.label).sort(), ['RULE-b', 'RULE-c']);

    const one = apiWatchSpills(ws, url('/api/watch/spills', 'item=RULE-c')).body as { spills: { id: string }[] };
    assert.deepEqual(one.spills.map((s) => s.id), ['RULE-c']);

    assert.equal(apiWatchSpills(ws, url('/api/watch/spills', 'limit=0')).status, 400);
  } finally { done(); }
});
```

- [ ] **Step 3: Run and see them fail**

Run: `node --test test/ui/watch-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

```ts
// src/ui/watch-model.ts
import type { ServerResponse } from 'node:http';
import { AUDIT_KINDS, type AuditKind } from '../core/audit.ts';
import { openProjection, queryProjection, syncProjection, topItems, type ProjectionState } from '../core/audit-db.ts';
import { AuditTail } from '../core/audit-tail.ts';
import { classifyContext, readTee } from '../core/statusline-tee.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

// --- Watch: the live view (spec §4 Watch, §5) -------------------------------
//
// Spills are the centre of this module, not a detail. A `spilled` entry is
// the ONLY record anywhere of an item that was selected and did not fit the
// budget — the ledger records deliveries only — so "why didn't Claude see
// this item" is answered here and nowhere else.
//
// Staleness rule (spec §5): every projection read here syncs first and
// reports what it found; a sync failure is a refusal (503), never a quiet
// partial. The live stream reads the JSONL itself (AuditTail) and is exempt
// from that rule only because it never claims completeness — it is "what has
// landed since you connected", with `resync` disclosing any discontinuity.
//
// NOTHING HERE OPENS A LEDGER. The activity pulse's series comes from the
// audit projection (owner ruling A2, §0): `at` and `kind` are two generated
// columns of the same audit row, both indexed. The ledger has no kind at all,
// and its `(session_id, item_id, tier)` key collides repeat injections inside
// a session, so a series drawn from it undercounts by exactly those repeats —
// see `Ledger.history()`'s own docblock, which says so.

export const STREAM_POLL_MS = 1000;

/**
 * Pure: `buckets` intervals of `bucketMs` ending at `now`, oldest first, each
 * carrying a total and a per-kind breakdown — the pulse's column height and
 * its colour.
 *
 * Every kind in `AUDIT_KINDS` is present on every bucket, at zero. A key left
 * out where nothing happened would leave a reader unable to tell "no records
 * of that kind" from "this build does not know that kind" — design decision
 * 3's absence-is-not-zero rule, read in the other direction.
 */
export function recordVolume(
  rows: { at: string; kind: string }[], bucketMs: number, buckets: number, now: number,
): { start: string; total: number; byKind: Record<AuditKind, number> }[] {
  const begin = now - bucketMs * buckets;
  const out = Array.from({ length: buckets }, (_, i) => ({
    start: new Date(begin + i * bucketMs).toISOString(),
    total: 0,
    byKind: Object.fromEntries(AUDIT_KINDS.map((k) => [k, 0])) as Record<AuditKind, number>,
  }));
  for (const row of rows) {
    const t = Date.parse(row.at);
    if (Number.isNaN(t) || t < begin || t >= now) continue;
    const bucket = out[Math.floor((t - begin) / bucketMs)]!;
    // A kind this build does not know still COUNTS toward the column height
    // and is simply absent from the breakdown: the pulse stays honest about
    // how much happened, and says nothing it cannot colour.
    bucket.total++;
    if (row.kind in bucket.byKind) bucket.byKind[row.kind as AuditKind]++;
  }
  return out;
}

function intParam(url: URL, name: string, min: number, max: number, fallback: number): number | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

/**
 * The most columns this endpoint will draw. The mockup's pulse asks for 120;
 * the cap is where a request stops being a pulse and starts being a scan, and
 * it is what bounds the projection read below.
 */
const MAX_VOLUME_COLUMNS = 1440;

export function apiWatchVolume(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['minutes', 'bucket']);
  if (bad) return badRequest(bad);
  const minutes = intParam(url, 'minutes', 1, 1440, 20);
  if (minutes === null) return badRequest('minutes must be an integer between 1 and 1440');
  const bucketSeconds = intParam(url, 'bucket', 1, 3600, 10);
  if (bucketSeconds === null) {
    return badRequest('bucket must be a whole number of seconds between 1 and 3600');
  }
  const seconds = minutes * 60;
  if (seconds % bucketSeconds !== 0) {
    return badRequest(
      `minutes=${minutes} does not divide into whole ${bucketSeconds}-second buckets. This ` +
      'endpoint refuses rather than rounding: a window quietly shortened to fit its buckets ' +
      'reports a span it did not measure.',
    );
  }
  const columns = seconds / bucketSeconds;
  if (columns > MAX_VOLUME_COLUMNS) {
    return badRequest(
      `minutes=${minutes} at bucket=${bucketSeconds}s is ${columns} columns; this endpoint draws ` +
      `at most ${MAX_VOLUME_COLUMNS}. It refuses rather than truncating, because a series silently ` +
      'shortened is a series that lies about its window.',
    );
  }
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const now = Date.now();
  const since = new Date(now - seconds * 1000).toISOString();
  try {
    const db = openProjection(root);
    try {
      // Design decision 4: catch up first, then answer, and say what was found.
      const state = syncProjection(root, db);
      // `since` becomes `at >= ?` — the predicate `idx_audit_at` exists to
      // serve, and the only thing bounding this read, which is why the column
      // cap above is a refusal rather than a slice. `at` and `kind` are two
      // generated columns of the SAME row, so nothing is joined here;
      // `audit_item`, the table that would need a join, answers a per-item
      // question and not this one.
      const records = queryProjection(db, { since });
      return {
        status: 200,
        body: {
          minutes,
          bucketSeconds,
          buckets: recordVolume(records, bucketSeconds * 1000, columns, now),
          projectionStateBeforeSync: state,
        },
      };
    } finally { db.close(); }
  } catch (err) {
    // The staleness rule again: catch up or SAY SO.
    return { status: 503, body: { error: `the audit projection could not catch up with its log: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

/** The §4b numerator, shared with `mycontext statusline` in shape: recorded tokens summed, absences counted. */
function share(records: { tokens?: number }[]): { tokens: number; injections: number; unrecorded: number } {
  let tokens = 0;
  let unrecorded = 0;
  for (const r of records) {
    if (typeof r.tokens === 'number') tokens += r.tokens;
    else unrecorded++;
  }
  return { tokens, injections: records.length, unrecorded };
}

export function apiWatchContext(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['session']);
  if (bad) return badRequest(bad);
  const session = url.searchParams.get('session');
  if (session === null || session === '') return badRequest('session is required');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } }; // startUiServer refuses this earlier

  const tee = readTee(root, session);
  const sample = tee === null ? null : {
    receivedAt: tee.receivedAt,
    model: modelName(tee.payload),
    version: versionOf(tee.payload),
    context: classifyContext(tee.payload),
  };

  let mycontext: { tokens: number; injections: number; unrecorded: number } | null = null;
  let mycontextError: string | null = null;
  try {
    const db = openProjection(root);
    try {
      syncProjection(root, db);
      mycontext = share(queryProjection(db, { sessionId: session, kind: 'injection' }));
    } finally { db.close(); }
  } catch (err) {
    mycontextError = err instanceof Error ? err.message : String(err);
  }
  return { status: 200, body: { session, sample, mycontext, mycontextError } };
}

function modelName(payload: unknown): string | null {
  const m = (payload as { model?: { display_name?: unknown; id?: unknown } } | null)?.model;
  if (typeof m?.display_name === 'string') return m.display_name;
  if (typeof m?.id === 'string') return m.id;
  return null;
}

function versionOf(payload: unknown): string | null {
  const v = (payload as { version?: unknown } | null)?.version;
  return typeof v === 'string' ? v : null;
}

/** How many newest injection records the spill list is drawn from — disclosed in the response. */
const SPILL_RECORD_WINDOW = 1000;

export function apiWatchSpills(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['item', 'limit']);
  if (bad) return badRequest(bad);
  const limit = intParam(url, 'limit', 1, 500, 50);
  if (limit === null) return badRequest('limit must be an integer between 1 and 500');
  const item = url.searchParams.get('item');
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  let state: ProjectionState;
  try {
    const db = openProjection(root);
    try {
      state = syncProjection(root, db);
      const records = queryProjection(db, {
        kind: 'injection',
        ...(item === null ? {} : { itemId: item }),
        limit: SPILL_RECORD_WINDOW,
      });
      const spills: object[] = [];
      for (const record of records) {
        for (const s of record.spilled ?? []) {
          if (item !== null && s.id !== item) continue;
          spills.push({
            at: record.at,
            sessionId: record.sessionId ?? null,
            hook: record.hook ?? null,
            path: record.path ?? null,
            id: s.id,
            tier: s.tier,
            reason: s.reason,
            // The PARENT record's estimate; null means "not recorded" (a
            // record predating the tokens field), and the client renders it
            // as that state — never as zero.
            tokens: typeof record.tokens === 'number' ? record.tokens : null,
          });
        }
      }
      return {
        status: 200,
        body: {
          spills: spills.slice(-limit),
          topSpilled: topItems(db, 'spilled', 10),
          recordWindow: SPILL_RECORD_WINDOW,
          projectionStateBeforeSync: state,
        },
      };
    } finally { db.close(); }
  } catch (err) {
    // The staleness rule: catch up or SAY SO — never a quiet partial answer.
    return { status: 503, body: { error: `the audit projection could not catch up with its log: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

// --- The stream -------------------------------------------------------------

function sseSend(res: ServerResponse, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function streamHandler(ctx: ApiContext, res: ServerResponse): void {
  const bad = unknownParams(ctx.url, ['poll']);
  const poll = intParam(ctx.url, 'poll', 50, 10_000, STREAM_POLL_MS);
  if (bad !== null || poll === null || ctx.ws.projectRoot === null) {
    res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: bad ?? 'poll must be an integer between 50 and 10000' }));
    return;
  }
  const root = ctx.ws.projectRoot;

  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    // NO CORS headers, deliberately — their absence is the defence (spec §2).
  });
  const tail = new AuditTail(root);
  sseSend(res, 'hello', { pollMs: poll });

  // Unref'd: this timer must never be what keeps the process alive. The idle
  // monitor exits the server WITH this stream open (an open stream is not
  // activity — spec §2), and server.closeAllConnections() destroys the
  // socket, which fires 'close' below and clears the timer.
  const timer = setInterval(() => {
    let result;
    try {
      result = tail.poll();
    } catch (err) {
      // A damaged audit line: refuse loudly, on-stream, and end. The screen
      // renders the fault; it never reconnects on its own (spec §2).
      sseSend(res, 'fault', { error: err instanceof Error ? err.message : String(err) });
      res.end();
      return;
    }
    if (result.resync) sseSend(res, 'resync', {});
    for (const record of result.records) sseSend(res, 'record', record);
  }, poll);
  timer.unref();
  res.on('close', () => clearInterval(timer));
}

export function registerWatchRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/watch/volume', json(apiWatchVolume));
  registerRoute('GET', '/api/watch/context', json(apiWatchContext));
  registerRoute('GET', '/api/watch/spills', json(apiWatchSpills));
  registerRoute('GET', '/api/watch/stream', { kind: 'stream', handle: streamHandler });
}
```

- [ ] **Step 5: Run the tests and the typecheck**

Run: `node --test test/ui/watch-model.test.ts && npx tsc --noEmit`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add src/ui/watch-model.ts test/ui/watch-model.test.ts src/ui/read-model.ts
git commit -m "feat(ui): watch model — spills, volume, context join, and the audit stream route"
```

---
## Task 7: `Store.raw` bind parameters, and `src/ui/ask-model.ts` — the query builder's server half

**Files:**
- Modify: `src/core/store.ts` (extend `raw` — read path only)
- Create: `src/ui/ask-model.ts`
- Test: `test/ui/ask-model.test.ts`

**Interfaces:**
- Consumes: `Store.openReadOnly` (`store.ts:332`), `openProjection`/`syncProjection`/`queryProjection`/`filterSelect`/`summaryByOp`/`topItems`/`sessions` (`audit-db.ts` + Task 1), `parseWhen`/`AUDIT_KINDS`/`AUDIT_OPS` (`audit.ts`), `unknownParams`/`badRequest` (Task 6 Step 1), `registerRoute`.
- Produces:
  - `Store.raw(sql: string, params?: (string | number)[])` — the existing method with bind parameters; every existing caller (`query.ts:319`) is untouched by the default.
  - `corpusSelect(f: CorpusFilter): { sql: string; params: (string | number)[] }` — pure; `interface CorpusFilter { type?: string; status?: Status; layer?: Layer; always?: boolean; scoped?: boolean; titleContains?: string; limit: number }`. The SQL ends `LIMIT ?` bound to `limit + 1` — the truncation probe, disclosed on screen (design decision 10).
  - `apiAskCorpus(ws, url): JsonResult` — `GET /api/ask/corpus?type=&status=&layer=&always=&scoped=&title=&limit=` → `{ rows, sql, params, truncated }`. **Never rebuilds** (design decision 9); reads through `Store.openReadOnly`.
  - `apiAskAudit(ws, url): JsonResult` — `GET /api/ask/audit?since=&until=&kind=&op=&origin=&item=&session=&limit=` → `{ records, sql, params, projection: { stateBeforeSync, syncedAt } }`; sync failure → 503 (the staleness rule).
  - `apiAskSummary(ws, url): JsonResult` — `GET /api/ask/summary?report=ops|items|sessions&role=&limit=` → `{ report, rows: SummaryRow[] }` — the predefined queries, straight from `summaryByOp`/`topItems`/`sessions`.
  - `registerAskRoutes(): void`.

- [ ] **Step 1: Write the failing tests**

```ts
// test/ui/ask-model.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { Store } from '../../src/core/store.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { corpusSelect, apiAskCorpus, apiAskAudit, apiAskSummary } from '../../src/ui/ask-model.ts';

function workspace(): { dir: string; root: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ask-'));
  runCli(['init'], dir, () => {});
  runCli(['add', 'rule', 'Scoped rule', '--scope', 'src/**', '--body', 'B.'], dir, () => {});
  runCli(['add', 'rule', 'Pinned rule', '--always', '--body', 'B.'], dir, () => {});
  runCli(['add', 'decision', 'A decision', '--body', 'B.'], dir, () => {});
  return { dir, root: path.join(dir, '.my_context'), done: () => rmSync(dir, { recursive: true, force: true }) };
}

function url(pathname: string, qs = ''): URL {
  return new URL(`http://127.0.0.1:1${pathname}${qs === '' ? '' : `?${qs}`}`);
}

test('Store.raw binds parameters', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const store = Store.openReadOnly(ws.dbPath);
    const rows = store.raw('SELECT id FROM items WHERE type = ? ORDER BY id', ['decision']);
    assert.equal(rows.length, 1);
    store.close();
  } finally { done(); }
});

test('corpusSelect builds the SQL it claims, with the +1 truncation probe', () => {
  const { sql, params } = corpusSelect({ type: 'rule', scoped: true, titleContains: 'Sco', limit: 10 });
  assert.match(sql, /WHERE type = \?/);
  assert.match(sql, /has_scope = 1/);
  assert.match(sql, /title LIKE \? ESCAPE '\\'/);
  assert.match(sql, /LIMIT \?$/);
  assert.deepEqual(params, ['rule', '%Sco%', 11]);
});

test('/api/ask/corpus runs the shown SQL and reports truncation honestly', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const all = apiAskCorpus(ws, url('/api/ask/corpus'));
    assert.equal(all.status, 200);
    const body = all.body as { rows: { id: string }[]; sql: string; truncated: boolean };
    assert.equal(body.rows.length, 3);
    assert.equal(body.truncated, false);
    assert.match(body.sql, /FROM items/);

    const capped = apiAskCorpus(ws, url('/api/ask/corpus', 'limit=2')).body as { rows: unknown[]; truncated: boolean };
    assert.equal(capped.rows.length, 2);
    assert.equal(capped.truncated, true);

    const filtered = apiAskCorpus(ws, url('/api/ask/corpus', 'type=rule&scoped=1')).body as { rows: { id: string }[] };
    assert.equal(filtered.rows.length, 1);

    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'status=nonsense')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'sesion=typo')).status, 400);
    assert.equal(apiAskCorpus(ws, url('/api/ask/corpus', 'always=maybe')).status, 400);
  } finally { done(); }
});

test('/api/ask/audit answers from a synced projection, shows its SQL, and validates every filter', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }], tokens: 40 });
    recordAudit(root, { kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });

    const result = apiAskAudit(ws, url('/api/ask/audit', 'kind=injection&session=s1'));
    assert.equal(result.status, 200);
    const body = result.body as {
      records: { op: string }[]; sql: string; params: unknown[];
      projection: { stateBeforeSync: string; syncedAt: string };
    };
    assert.deepEqual(body.records.map((r) => r.op), ['jit']);
    assert.match(body.sql, /SELECT json\(rec\)/);
    assert.equal(body.projection.stateBeforeSync, 'behind'); // first sync of a fresh projection
    // The spill filter: item=RULE-b matches the record that SPILLED it.
    const spilled = apiAskAudit(ws, url('/api/ask/audit', 'item=RULE-b')).body as { records: unknown[] };
    assert.equal(spilled.records.length, 1);

    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'kind=nonsense')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'op=nonsense')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'since=not-a-date')).status, 400);
    assert.equal(apiAskAudit(ws, url('/api/ask/audit', 'bogus=1')).status, 400);
  } finally { done(); }
});

test('/api/ask/summary serves the three predefined reports', () => {
  const { dir, root, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }] });
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'b.ts', injected: [{ id: 'RULE-a', tier: 'jit' }] });

    const ops = apiAskSummary(ws, url('/api/ask/summary', 'report=ops')).body as { rows: { label: string; count: number }[] };
    assert.deepEqual(ops.rows[0], { label: 'jit', count: 2, last: ops.rows[0].last });

    const spilledTop = apiAskSummary(ws, url('/api/ask/summary', 'report=items&role=spilled')).body as { rows: { label: string }[] };
    assert.deepEqual(spilledTop.rows.map((r) => r.label), ['RULE-b']);

    const sessions = apiAskSummary(ws, url('/api/ask/summary', 'report=sessions')).body as { rows: { label: string }[] };
    assert.deepEqual(sessions.rows.map((r) => r.label), ['s1']);

    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=nonsense')).status, 400);
    assert.equal(apiAskSummary(ws, url('/api/ask/summary', 'report=ops&role=spilled')).status, 400); // role only with items
  } finally { done(); }
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/ask-model.test.ts`
Expected: FAIL — module not found (and the `Store.raw` test fails on arity).

- [ ] **Step 3: Extend `Store.raw`**

In `src/core/store.ts:375`, change the signature and the `.all()` call; nothing else:

```ts
  /** Arbitrary SELECT with optional bind parameters. Callers are responsible for validating the SQL. */
  raw(sql: string, params: (string | number)[] = []): Record<string, unknown>[] {
    const rows = this.#db.prepare(sql).all(...params) as Record<string, unknown>[];
    // node:sqlite yields null-prototype objects; spread them so callers can
    // treat rows as ordinary objects (JSON.stringify, deepEqual, Object.keys).
    return rows.map((row) => ({ ...row }));
  }
```

- [ ] **Step 4: Implement `ask-model.ts`**

```ts
// src/ui/ask-model.ts
import { AUDIT_KINDS, AUDIT_OPS, parseWhen, type AuditFilter, type AuditKind, type AuditOp } from '../core/audit.ts';
import {
  filterSelect, openProjection, queryProjection, sessions, summaryByOp, syncProjection, topItems,
} from '../core/audit-db.ts';
import { Store } from '../core/store.ts';
import type { Layer, Origin, Status } from '../core/types.ts';
import type { Workspace } from '../core/workspace.ts';
import { badRequest, unknownParams } from './read-model.ts';
import { registerRoute, type ApiContext, type JsonResult } from './routes.ts';

// --- Ask: structured queries with the SQL shown (spec §4 Ask) ---------------
//
// The builder's promise is that the SQL on screen IS the SQL that ran. For
// audit queries that is `filterSelect` — extracted from queryProjection so
// display and execution share one spelling (Task 1). For corpus queries it is
// `corpusSelect` below, executed through Store.openReadOnly with bind
// parameters — never inlined values.
//
// Corpus queries NEVER rebuild the index (plan 1 design decision 1: the
// server reads what the hooks read). The CLI's `query` rebuilds first; this
// surface does not, which makes the documented updated_at trap (query.ts:46)
// STRICTER here — the Ask screen's caveat string says so.
//
// Audit queries never read the JSONL directly (spec §4 Ask): they read the
// projection, synced first, and every answer carries what the sync found. A
// sync that throws is a 503 — a partial audit answer presented as complete is
// worse than no audit view (spec §5).

const STATUSES: Status[] = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const LAYERS: Layer[] = ['project', 'global'];
const ORIGINS: Origin[] = ['human', 'agent', 'ingest'];

export interface CorpusFilter {
  type?: string;
  status?: Status;
  layer?: Layer;
  always?: boolean;
  scoped?: boolean;
  titleContains?: string;
  limit: number;
}

const CORPUS_COLUMNS = 'id, type, title, status, always, has_scope, layer, file_path, updated_at';

/** Pure. The final `LIMIT ?` binds limit + 1 — the truncation probe, disclosed on screen. */
export function corpusSelect(f: CorpusFilter): { sql: string; params: (string | number)[] } {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (f.type !== undefined) { where.push('type = ?'); params.push(f.type); }
  if (f.status !== undefined) { where.push('status = ?'); params.push(f.status); }
  if (f.layer !== undefined) { where.push('layer = ?'); params.push(f.layer); }
  if (f.always !== undefined) where.push(`always = ${f.always ? 1 : 0}`);
  if (f.scoped !== undefined) where.push(`has_scope = ${f.scoped ? 1 : 0}`);
  if (f.titleContains !== undefined) {
    where.push(`title LIKE ? ESCAPE '\\'`);
    params.push(`%${f.titleContains.replace(/[\\%_]/g, (c) => `\\${c}`)}%`);
  }
  const clause = where.length === 0 ? '' : `\nWHERE ${where.join('\n  AND ')}`;
  params.push(f.limit + 1);
  return { sql: `SELECT ${CORPUS_COLUMNS}\nFROM items${clause}\nORDER BY id\nLIMIT ?`, params };
}

function boolParam(url: URL, name: string): boolean | undefined | null {
  const raw = url.searchParams.get(name);
  if (raw === null) return undefined;
  if (raw === '1') return true;
  if (raw === '0') return false;
  return null; // invalid
}

export function apiAskCorpus(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['type', 'status', 'layer', 'always', 'scoped', 'title', 'limit']);
  if (bad) return badRequest(bad);

  const status = url.searchParams.get('status');
  if (status !== null && !STATUSES.includes(status as Status)) {
    return badRequest(`status must be one of ${STATUSES.join(', ')}`);
  }
  const layer = url.searchParams.get('layer');
  if (layer !== null && !LAYERS.includes(layer as Layer)) {
    return badRequest(`layer must be one of ${LAYERS.join(', ')}`);
  }
  const always = boolParam(url, 'always');
  const scoped = boolParam(url, 'scoped');
  if (always === null || scoped === null) return badRequest('always and scoped accept 1 or 0');
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 100 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return badRequest('limit must be an integer between 1 and 1000');
  }
  const type = url.searchParams.get('type');
  const title = url.searchParams.get('title');

  const filter: CorpusFilter = {
    ...(type === null ? {} : { type }),
    ...(status === null ? {} : { status: status as Status }),
    ...(layer === null ? {} : { layer: layer as Layer }),
    ...(always === undefined ? {} : { always }),
    ...(scoped === undefined ? {} : { scoped }),
    ...(title === null ? {} : { titleContains: title }),
    limit,
  };
  const { sql, params } = corpusSelect(filter);
  const store = Store.openReadOnly(ws.dbPath);
  try {
    const fetched = store.raw(sql, params);
    const truncated = fetched.length > limit;
    return {
      status: 200,
      body: { rows: truncated ? fetched.slice(0, limit) : fetched, sql, params, truncated },
    };
  } finally {
    store.close();
  }
}

export function apiAskAudit(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['since', 'until', 'kind', 'op', 'origin', 'item', 'session', 'limit']);
  if (bad) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };

  const filter: AuditFilter = {};
  try {
    const since = url.searchParams.get('since');
    if (since !== null) filter.since = parseWhen(since, 'since');
    const until = url.searchParams.get('until');
    if (until !== null) filter.until = parseWhen(until, 'until');
  } catch (err) {
    return badRequest(err instanceof Error ? err.message : String(err));
  }
  const kind = url.searchParams.get('kind');
  if (kind !== null) {
    if (!AUDIT_KINDS.includes(kind as AuditKind)) return badRequest(`kind must be one of ${AUDIT_KINDS.join(', ')}`);
    filter.kind = kind as AuditKind;
  }
  const op = url.searchParams.get('op');
  if (op !== null) {
    if (!AUDIT_OPS.includes(op as AuditOp)) return badRequest(`op must be one of ${AUDIT_OPS.join(', ')}`);
    filter.op = op as AuditOp;
  }
  const origin = url.searchParams.get('origin');
  if (origin !== null) {
    if (!ORIGINS.includes(origin as Origin)) return badRequest(`origin must be one of ${ORIGINS.join(', ')}`);
    filter.origin = origin as Origin;
  }
  const item = url.searchParams.get('item');
  if (item !== null) filter.itemId = item;
  const session = url.searchParams.get('session');
  if (session !== null) filter.sessionId = session;
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 200 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 2000) {
    return badRequest('limit must be an integer between 1 and 2000');
  }
  filter.limit = limit;

  try {
    const db = openProjection(root);
    try {
      const stateBeforeSync = syncProjection(root, db);
      const { sql, params } = filterSelect(filter);
      return {
        status: 200,
        body: {
          records: queryProjection(db, filter),
          sql,
          params,
          projection: { stateBeforeSync, syncedAt: new Date().toISOString() },
        },
      };
    } finally { db.close(); }
  } catch (err) {
    return { status: 503, body: { error: `the audit projection could not catch up with its log: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

export function apiAskSummary(ws: Workspace, url: URL): JsonResult {
  const bad = unknownParams(url, ['report', 'role', 'limit']);
  if (bad) return badRequest(bad);
  const root = ws.projectRoot;
  if (root === null) return { status: 500, body: { error: 'no project workspace' } };
  const report = url.searchParams.get('report');
  if (report !== 'ops' && report !== 'items' && report !== 'sessions') {
    return badRequest('report must be one of ops, items, sessions');
  }
  const role = url.searchParams.get('role');
  if (role !== null && report !== 'items') return badRequest('role applies only to report=items');
  if (role !== null && !['subject', 'injected', 'spilled'].includes(role)) {
    return badRequest('role must be one of subject, injected, spilled');
  }
  const rawLimit = url.searchParams.get('limit');
  const limit = rawLimit === null ? 20 : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return badRequest('limit must be an integer between 1 and 200');
  }

  try {
    const db = openProjection(root);
    try {
      const stateBeforeSync = syncProjection(root, db);
      const rows =
        report === 'ops' ? summaryByOp(db)
        : report === 'items' ? topItems(db, role, limit)
        : sessions(db, limit);
      return { status: 200, body: { report, rows, projection: { stateBeforeSync, syncedAt: new Date().toISOString() } } };
    } finally { db.close(); }
  } catch (err) {
    return { status: 503, body: { error: `the audit projection could not catch up with its log: ${err instanceof Error ? err.message : String(err)}` } };
  }
}

export function registerAskRoutes(): void {
  const json = (fn: (ws: Workspace, url: URL) => JsonResult) =>
    ({ kind: 'json' as const, handle: (ctx: ApiContext) => fn(ctx.ws, ctx.url) });
  registerRoute('GET', '/api/ask/corpus', json(apiAskCorpus));
  registerRoute('GET', '/api/ask/audit', json(apiAskAudit));
  registerRoute('GET', '/api/ask/summary', json(apiAskSummary));
}
```

(`summaryByOp` takes no limit — it reports every op, at most a couple of dozen. `topItems`' `role: null` form answers report=items with no role.)

- [ ] **Step 5: Run the tests, the store suite, and the typecheck**

Run: `node --test test/ui/ask-model.test.ts && node --test test/core/ && npx tsc --noEmit`
Expected: PASS; the store and audit suites prove `raw`'s default keeps every existing caller working.

- [ ] **Step 6: Commit**

```bash
git add src/core/store.ts src/ui/ask-model.ts test/ui/ask-model.test.ts
git commit -m "feat(ui): ask model — corpus and audit query builders that show the SQL they run"
```

---
## Task 8: Server wiring, and the E2E proof that idle fires with a stream open

Plan 1 built the `kind: 'stream'` slot and the dispatch that skips `idle.touch()` for it, but shipped no stream route — so §2's central promise ("an open stream connection is explicitly **not** activity") has never been *executed*. This task registers the plan-3 routes and writes the test that can only exist now: a server whose only client holds an open stream **exits on idle anyway**.

**Files:**
- Modify: `src/ui/server.ts` (two imports, two calls — nothing else)
- Test: `test/ui/watch-e2e.test.ts`

**Interfaces:**
- Consumes: `registerWatchRoutes` (Task 6), `registerAskRoutes` (Task 7), Plan 1's `startUiChild`/`redeemNonce` harness (`test/ui/helpers.ts`) and `TOKEN_HEADER`.
- Produces: the full plan-3 HTTP surface live behind Plan 1's security gate (every route registered through `registerRoute` sits behind it — Plan 1 Task 8's binding note), and the executed §2 idle-with-stream guarantee later plans can rely on.

- [ ] **Step 1: Wire the routes**

In `src/ui/server.ts`, add beside the existing read-model imports:

```ts
import { registerWatchRoutes } from './watch-model.ts';
import { registerAskRoutes } from './ask-model.ts';
```

and inside the `if (!routesRegistered)` block, after `registerReadRoutes()`:

```ts
    registerWatchRoutes();
    registerAskRoutes();
```

- [ ] **Step 2: Write the failing E2E tests**

```ts
// test/ui/watch-e2e.test.ts
/**
 * Spawned-process E2E for the Watch stream and the Ask surface (spec §6:
 * real process, real requests). The idle test here is THE §2 test: a server
 * whose only client is an open stream exits on idle anyway, because an open
 * stream is not activity. It could not be written until a stream route
 * existed — this file is why plan 1 left the slot deliberately uncalled.
 *
 * The rendering limit (spec §6) is stated in test/ui/server-e2e.test.ts and
 * applies here identically: these tests verify the wire contract, not pixels.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import { startUiChild, redeemNonce, type UiHarness } from './helpers.ts';

function project(): { dir: string; root: string; drop: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-watch-e2e-'));
  runCli(['init'], dir, () => {});
  return { dir, root: path.join(dir, '.my_context'), drop: () => rmSync(dir, { recursive: true, force: true }) };
}

/** Reads SSE frames off a fetch body until `predicate` matches or the stream ends. */
async function readUntil(
  body: ReadableStream<Uint8Array>,
  predicate: (event: string, data: unknown) => boolean,
): Promise<{ matched: boolean; events: [string, unknown][] }> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const events: [string, unknown][] = [];
  let buffer = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return { matched: false, events };
    buffer += decoder.decode(value, { stream: true });
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      const parsed: [string, unknown] = [event, data === '' ? null : JSON.parse(data)];
      events.push(parsed);
      if (predicate(parsed[0], parsed[1])) { await reader.cancel(); return { matched: true, events }; }
    }
  }
}

test('the stream delivers a record appended after connect — spills, reason and tokens intact', async () => {
  const { dir, root, drop } = project();
  let h: UiHarness | null = null;
  try {
    h = await startUiChild(dir);
    const token = await redeemNonce(h.port, h.nonce);
    const response = await fetch(`http://127.0.0.1:${h.port}/api/watch/stream?poll=50`, {
      headers: { [TOKEN_HEADER]: token },
    });
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type') ?? '', /text\/event-stream/);

    const pending = readUntil(response.body!, (event) => event === 'record');
    // Give the child a beat to prime the tail, then append.
    await new Promise((r) => setTimeout(r, 200));
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts',
      injected: [{ id: 'RULE-a', tier: 'jit' }],
      spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded (900 > 800 estimated tokens)' }],
      tokens: 123,
    });
    const { matched, events } = await pending;
    assert.equal(matched, true, JSON.stringify(events));
    const record = events.find(([e]) => e === 'record')![1] as {
      spilled: { id: string; reason: string }[]; tokens: number;
    };
    assert.equal(record.spilled[0].id, 'RULE-b');
    assert.match(record.spilled[0].reason, /budget exceeded/);
    assert.equal(record.tokens, 123);
  } finally { await h?.stop(); drop(); }
});

test('THE §2 TEST: the server idles out and exits WITH a stream open', async () => {
  const { dir, drop } = project();
  let h: UiHarness | null = null;
  try {
    h = await startUiChild(dir, ['--idle-ms', '400']);
    const token = await redeemNonce(h.port, h.nonce);
    const response = await fetch(`http://127.0.0.1:${h.port}/api/watch/stream?poll=50`, {
      headers: { [TOKEN_HEADER]: token },
    });
    assert.equal(response.status, 200);

    const exited = new Promise<void>((resolve) => h!.child.once('exit', () => resolve()));
    // No further requests. The ONLY thing connected is the stream — which
    // must not count as activity. The child must exit on its own.
    const timeout = new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), 10_000));
    const outcome = await Promise.race([exited.then(() => 'exited' as const), timeout]);
    assert.equal(outcome, 'exited', 'an open stream held the server up — the §2 idle rule is broken');

    // And the stream ended from the client's point of view.
    const { matched } = await readUntil(response.body!, () => false);
    assert.equal(matched, false); // the reader ran to done
  } finally { await h?.stop(); drop(); }
});

test('the ask surface answers over HTTP behind the token gate', async () => {
  const { dir, root, drop } = project();
  let h: UiHarness | null = null;
  try {
    recordAudit(root, { kind: 'injection', op: 'jit', sessionId: 's9', hook: 'PreToolUse', path: 'a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 7 });
    h = await startUiChild(dir);
    const token = await redeemNonce(h.port, h.nonce);

    const denied = await fetch(`http://127.0.0.1:${h.port}/api/ask/audit?session=s9`);
    assert.equal(denied.status, 401); // no token header — the gate covers plan-3 routes too

    const ok = await fetch(`http://127.0.0.1:${h.port}/api/ask/audit?session=s9`, {
      headers: { [TOKEN_HEADER]: token },
    });
    assert.equal(ok.status, 200);
    const body = await ok.json() as { records: { tokens?: number }[]; sql: string; projection: { stateBeforeSync: string } };
    assert.equal(body.records.length, 1);
    assert.equal(body.records[0].tokens, 7);
    assert.match(body.sql, /SELECT json\(rec\)/);
    assert.ok(['fresh', 'behind', 'diverged'].includes(body.projection.stateBeforeSync));
  } finally { await h?.stop(); drop(); }
});
```

- [ ] **Step 3: Run and see the suite fail before wiring, pass after**

Run: `node --test test/ui/watch-e2e.test.ts`
Expected with Step 1 undone: 404s on `/api/watch/stream` (route not registered). With Step 1 applied: PASS (3 tests).

- [ ] **Step 4: Run the no-writes import-graph test — the plan-3 graph is inside it now**

Run: `node --test test/ui/no-writes.test.ts && npm test && npx tsc --noEmit`
Expected: green. `server.ts` now reaches `watch-model.ts` → `audit-tail.ts`/`audit-db.ts`/`audit.ts`/`jsonl-log.ts`/`statusline-tee.ts` and `ask-model.ts` — none of which import `mutate.ts` or `revision.ts`, none of which contain `require(` or a dynamic `import(`. If this test fails, the fix is in the plan-3 module, never in the test.

(`recordAudit` and `writeTee` ARE write functions — in the CLI and in tests. They are not in the banned set and not reachable *as writes* from any route: `watch-model.ts` imports only `readTee`/`classifyContext` from the tee module and only `AuditTail`/read functions from the audit modules. The statusline command's write path lives in `src/cli/commands/`, which the server never imports.)

- [ ] **Step 5: Commit**

```bash
git add src/ui/server.ts test/ui/watch-e2e.test.ts
git commit -m "feat(ui): register watch/ask routes; prove idle exit fires with a stream open"
```

---
## Task 9: The Watch/Ask string keys — both tables, one commit

**Files:**
- Modify: `src/ui/public/strings/en.js`
- Modify: `src/ui/public/strings/he.js`
- Test: `test/ui/strings-parity.test.ts` (existing — no edits; it fails on any asymmetry)

**Interfaces:**
- Consumes: Plan 1 Task 1's table shape (`export const strings`, dot-namespaced keys, and the mockup's
  three brace markers: `{name}` for a plain value slot, `{mv:name}` for a monospace one, `{m:…}` for a
  monospace literal — see the grammar block above `const HE=` in the mockup).
- Produces: every key Tasks 11-12 reference. Screens must use exactly these keys — `t()` throws on a missing key (Plan 1 Task 16), so a drifted key is a loud failure, not a blank.

> **The mockup is now the wording of record — 2026-08-20.** It carries 326 EN keys each with a
> Hebrew pair, checked in both directions, and every user-visible sentence on `watch` and `ask` is one
> of them. Two consequences for the block below, neither resolved in this edit (§0, open question 5):
> **keys with no counterpart in the mockup** — `ask.sqlCaption`, the five `ask.predefined*` keys, the
> five `strip.ctx.*` states and the three `strip.myctx*` keys; and **sentences the mockup has and
> this block has no key for** — `watch.pulsen`, `watch.voidn`, `ask.whyq`,
> `ask.why`, `ask.recallq`, `ask.recall1`, `ask.recall2`, `strip.items`, `strip.append`,
> `strip.meas`, `strip.rt`, `ex.msg`, `ex.ok` — are strings this task currently drops. Reconcile
> against the mockup's table before writing either file; do not translate a sentence the mockup
> already has a Hebrew pair for.
>
> **Those fourteen are PENDING the mockup, not condemned — 2026-08-20.** A pass is adding
> `strip.ctx.*`, `strip.myctx*`, `ask.sqlCaption` and `ask.predefined*` to the mockup right now.
> They stay in the block below **exactly as declared: not removed, and not restated anywhere else in
> this document either.** An earlier reading of this blockquote said the Ask pair "must not ship";
> that was true of a mockup which did not yet carry them and is superseded — this plan's own goal
> statement records the owner keeping the SQL pane on 2026-08-20 and the mockup gaining `ask.sqlh` /
> `ask.sqln` first. Re-read the mockup's table at execution time and take its wording wherever it
> now has some.

> **The slot grammar is the mockup's, and it has three markers, not two — 2026-08-20.** `{name}` is
> substituted as a TEXT node. `{m:…}` is a monospace, bidi-isolated ELEMENT around a literal.
> `{mv:name}` is that same element around the substituted value, and it is what an id, a branch, a
> commit SHA, a path, a glob or a scope takes. `{mv:name}` does **not** transcribe to `{name}`: the
> tables shipped nine of these slots as plain `{name}` until 2026-08-20, and `cap.already` and
> `pr.item` — a glob and an item id inside RTL prose — visibly lost isolation they already had. Any
> key added below whose value is data of that kind takes `{mv:…}`; a count, a percentage or an error
> sentence does not.

- [ ] **Step 1: Add the keys to `en.js`**

Append inside `strings` (every wording below carries its §4b/§5 condition in the sentence — do not "tighten" them into unconditional claims):

```js
  'nav.watch': 'Watch',
  'nav.ask': 'Ask',
  'watch.title': 'Watch',
  'watch.stream': 'Live audit stream',
  'watch.streamWaiting': 'connected — waiting for the next record',
  'watch.streamEnded':
    'the stream has ended — the server has exited or closed the connection. Restart it with `mycontext ui`; this page never reconnects on its own.',
  'watch.streamFault': 'the stream refused to continue: {error}',
  'watch.resync': 'the log rotated or moved — continuing from now; the history list below was refetched',
  'watch.kind.mutation': 'mutation',
  'watch.kind.injection': 'injection',
  'watch.kind.hook': 'hook',
  'watch.kind.focus': 'focus',
  'watch.injected': '{n} injected',
  'watch.spilledCount': '{n} spilled',
  'watch.tokens': '{n} tokens, estimated at injection time',
  'watch.tokensNotRecorded': 'tokens not recorded — this record predates the token field; not zero',
  'watch.spills.title': 'Spills — selected, and did not fit the budget',
  'watch.spills.why': 'This is the only record of why an item was not shown. The ledger records deliveries; a spill is recorded here and nowhere else.',
  'watch.spills.top': 'Most-spilled items',
  'watch.spills.window': 'drawn from the last {n} injection records',
  'watch.spills.none': 'no spills recorded — everything selected has fit the budget',
  // Ruling A2: this series is EVERY record kind, off the audit projection,
  // over a window measured in minutes — not injections, and not hours. The
  // mockup's own caption for the same series is `watch.pulsen`, which this
  // block still has no key for (§0, open question 5); this key names the
  // strip's reduced drawing of it.
  'watch.volume.title': 'Records, last {minutes}m',
  // A branch name and a commit SHA are DATA, not prose: `{mv:…}`, the monospace
  // value slot, exactly as the mockup declares these four keys. Not `{branch}`.
  'strip.branch': 'branch {mv:branch} @ {mv:commit}',
  'strip.detached': 'detached HEAD @ {mv:commit}',
  'strip.inSync': 'in sync with origin/{mv:branch}',
  'strip.differs': 'differs from origin/{mv:branch}',
  'strip.noUpstream': 'no upstream',
  'strip.notARepo': 'not a git repository',
  'strip.ctx.known': 'context {pct}% ({used} of {size}) — as of last response, {age} ago',
  'strip.ctx.notYetKnown': 'context not yet known — no API call since the last compact',
  'strip.ctx.unknown': 'context unknown — this Claude Code build sends no context_window',
  'strip.ctx.noBridge':
    'showing only what mycontext injected — that is all this number is. The status line bridge is not installed; `mycontext statusline install` shows what installing would change, and asks.',
  'strip.ctx.cold': 'cold session — a hypothetical has no live context number',
  'strip.myctx': '{tokens} of it from project knowledge ({injections} injections)',
  'strip.myctxPartial': '≥{tokens} of it from project knowledge ({injections} injections, {unrecorded} not recorded)',
  'strip.myctxUnavailable': 'project-knowledge share unavailable: {error}',
  'ask.title': 'Ask',
  'ask.tab.corpus': 'Corpus',
  'ask.tab.audit': 'Audit history',
  'ask.sqlCaption':
    'the SQL this answer ran — shown so it teaches. The final LIMIT binds one row more than the cap: that extra row is the truncation signal, dropped before display.',
  'ask.filters': 'Filters',
  'ask.run': 'Run',
  'ask.rows': '{n} row(s)',
  'ask.truncated': 'capped at {n} rows — more matched; raise the limit to see them',
  'ask.noRows': 'no rows matched',
  'ask.updatedAtTrap':
    'updated_at is INDEX WRITE TIME, not a content timestamp — and this surface never rebuilds the index (it reads exactly what the hooks read), so rows are as the last hook or CLI run left them.',
  'ask.projection.fresh': 'the audit projection was already current',
  // `{mv:state}`, not `{state}`: the value is a `ProjectionState` literal —
  // `fresh` / `behind` / `diverged` — a machine token this product never
  // translates, so inside the Hebrew sentence it is a Latin run that needs the
  // same isolation a branch name gets. Every other slot in this block is a
  // count, a percentage, an age or an error sentence, and those stay plain.
  'ask.projection.caughtUp': 'the audit projection was {mv:state} and caught up before answering',
  'ask.projection.failed': 'the audit projection could not catch up — no partial answer is shown: {error}',
  'ask.predefined': 'Predefined queries',
  'ask.predefined.ops': 'Operations by count',
  'ask.predefined.spilled': 'Most-spilled items',
  'ask.predefined.injected': 'Most-injected items',
  'ask.predefined.sessions': 'Sessions',
  'ask.field.kind': 'Kind',
  'ask.field.op': 'Operation',
  'ask.field.origin': 'Origin',
  'ask.field.item': 'Item id',
  'ask.field.session': 'Session',
  'ask.field.since': 'Since',
  'ask.field.until': 'Until',
  'ask.field.type': 'Category',
  'ask.field.status': 'Status',
  'ask.field.layer': 'Layer',
  'ask.field.always': 'Pinned (always)',
  'ask.field.scoped': 'Has scope',
  'ask.field.title': 'Title contains',
  'ask.field.limit': 'Limit',
  'ask.field.any': '(any)',
```

- [ ] **Step 2: Add the same keys to `he.js`, translated**

Every key above, with real Hebrew values (the register of `docs/README.he.md`; code-like fragments — `mycontext ui`, `context_window`, `origin/`, `updated_at` — stay untranslated inside the Hebrew sentences, per spec §3's paths-are-not-prose rule). A slot may still MOVE: the mockup's own Hebrew for `strip.inSync` is `{mv:branch} ב‑origin`, not `origin/{mv:branch}`, because a bare `origin/` immediately before an isolated run resolves to the wrong visual order in an RTL paragraph. Untranslated is not unmoved. Example of the first entries so the shape is unambiguous:

```js
  'nav.watch': 'צפייה',
  'nav.ask': 'שאילתות',
  'watch.title': 'צפייה',
  'watch.stream': 'זרם ביקורת חי',
  // … every remaining key from en.js, translated. The parity test enforces the set.
```

(The literal file must contain every key — the comment is for this plan only.)

- [ ] **Step 3: Run the parity test**

Run: `node --test test/ui/strings-parity.test.ts`
Expected: PASS — equal key sets, no empty values.

- [ ] **Step 4: Commit**

```bash
git add src/ui/public/strings/en.js src/ui/public/strings/he.js
git commit -m "feat(ui): Watch/Ask/strip string keys in both languages"
```

---

## Task 10: Browser pure logic — the SSE parser and the Watch/Ask view-models

**Files:**
- Create: `src/ui/public/lib/sse.js`
- Modify: `src/ui/public/lib/viewmodel.js`
- Test: extend `test/ui/viewmodel.test.ts`

**Interfaces:**
- Consumes: nothing at runtime (pure browser modules, imported by `node --test` exactly as Plan 1's are).
- Produces (Tasks 11-12 use these; all pure):
  - `sse.js`: `createSseParser(onEvent: (event: string, data: unknown) => void): (chunk: string) => void` — incremental; buffers partial frames across chunks.
  - `viewmodel.js` additions:
    - `describeRecord(record)` → `{ at, kind, op, sessionId, injected: number, spilled: {id,tier,reason}[], tokens: number | 'not-recorded' | null, itemId, origin, path, note }` — `tokens` is `'not-recorded'` when the record is an injection **without** the field, the number when present, `null` for non-injection kinds. The one place absence-vs-zero is decided for the DOM.
    - `dedupeKey(record)` → stable string (sorted-key JSON) — design decision 1's client half.
    - `formatAge(ms)` → `'12s' | '3m' | '2h' | '5d'`.
    - `contextStrip(body, isCold)` → `{ state: 'cold' | 'no-bridge' | 'unknown' | 'not-yet-known' | 'known', pct, used, size, age: null, receivedAt, myctx: { tokens, injections, unrecorded } | null, myctxError }` — the strip's decision table; the DOM only maps `state` to a string key.
    - `sparkline(buckets: {total:number}[], width, height)` → SVG polyline `points` string. `total`, not `count`: `/api/watch/volume` returns a per-kind breakdown beside the column height under ruling A2, and this single-series drawing plots the height.

- [ ] **Step 1: Write the failing tests** (append to `test/ui/viewmodel.test.ts`)

```ts
test('createSseParser assembles frames across chunk boundaries', async () => {
  const { createSseParser } = await import('../../src/ui/public/lib/sse.js');
  const seen: [string, unknown][] = [];
  const feed = createSseParser((event, data) => seen.push([event, data]));
  feed('event: hello\ndata: {"pollMs":50}\n\nevent: rec');
  feed('ord\ndata: {"op":"jit"}\n\n');
  assert.deepEqual(seen, [['hello', { pollMs: 50 }], ['record', { op: 'jit' }]]);
});

test('describeRecord: tokens absence is the not-recorded STATE, zero is the number zero', async () => {
  const { describeRecord } = await import('../../src/ui/public/lib/viewmodel.js');
  const base = { protocol: 'my_context/audit@1', at: '2026-08-16T10:00:00.000Z' };
  const withTokens = describeRecord({ ...base, kind: 'injection', op: 'jit', sessionId: 's1', injected: [{ id: 'A', tier: 'jit' }], spilled: [], tokens: 0 });
  assert.equal(withTokens.tokens, 0); // a real measurement — everything spilled
  const without = describeRecord({ ...base, kind: 'injection', op: 'jit', sessionId: 's1', injected: [{ id: 'A', tier: 'jit' }] });
  assert.equal(without.tokens, 'not-recorded');
  const mutation = describeRecord({ ...base, kind: 'mutation', op: 'update', origin: 'human', itemId: 'A', fields: ['body'] });
  assert.equal(mutation.tokens, null);
  assert.equal(mutation.itemId, 'A');
  const focus = describeRecord({ ...base, kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });
  assert.equal(focus.note, 'scope=src/**');
});

test('dedupeKey is stable under key order', async () => {
  const { dedupeKey } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.equal(dedupeKey({ a: 1, b: [2, { c: 3 }] }), dedupeKey({ b: [2, { c: 3 }], a: 1 }));
  assert.notEqual(dedupeKey({ a: 1 }), dedupeKey({ a: 2 }));
});

test('contextStrip decides the five states', async () => {
  const { contextStrip } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.equal(contextStrip(null, true).state, 'cold');
  assert.equal(contextStrip({ sample: null, mycontext: { tokens: 0, injections: 0, unrecorded: 0 }, mycontextError: null }, false).state, 'no-bridge');
  const known = contextStrip({
    sample: { receivedAt: '2026-08-16T10:00:00.000Z', model: 'Opus 4.5', version: '2.1.233',
      context: { state: 'known', usedTokens: 47000, windowSize: 200000, percent: 23.5 } },
    mycontext: { tokens: 6200, injections: 3, unrecorded: 1 }, mycontextError: null,
  }, false);
  assert.equal(known.state, 'known');
  assert.equal(known.pct, 23.5);
  assert.equal(known.receivedAt, '2026-08-16T10:00:00.000Z');
  assert.deepEqual(known.myctx, { tokens: 6200, injections: 3, unrecorded: 1 });
  assert.equal(contextStrip({ sample: { receivedAt: 'x', model: null, version: null, context: { state: 'not-yet-known', usedTokens: null, windowSize: null, percent: null } }, mycontext: null, mycontextError: 'e' }, false).state, 'not-yet-known');
  assert.equal(contextStrip({ sample: { receivedAt: 'x', model: null, version: null, context: { state: 'unknown', usedTokens: null, windowSize: null, percent: null } }, mycontext: null, mycontextError: null }, false).state, 'unknown');
});

test('formatAge and sparkline', async () => {
  const { formatAge, sparkline } = await import('../../src/ui/public/lib/viewmodel.js');
  assert.equal(formatAge(12_000), '12s');
  assert.equal(formatAge(190_000), '3m');
  assert.equal(formatAge(7_300_000), '2h');
  assert.equal(formatAge(200_000_000), '2d');
  const points = sparkline([{ total: 0 }, { total: 2 }, { total: 1 }], 30, 10);
  assert.equal(points.split(' ').length, 3);
  assert.match(points, /^0,10 15,0 30,5$/);
});
```

- [ ] **Step 2: Run and see them fail**

Run: `node --test test/ui/viewmodel.test.ts`
Expected: the new tests FAIL (module/exports missing); Plan 1's pass.

- [ ] **Step 3: Implement**

```js
// src/ui/public/lib/sse.js
// Incremental SSE-frame parsing for a fetch()-reader stream. The page cannot
// use EventSource: EventSource sends no custom headers, and the token travels
// in X-Mycontext-Token on EVERY /api request (spec §2) — so the stream is a
// token-carrying fetch and this parser does what EventSource would have.
// No auto-reconnect lives here or anywhere: a closed stream is rendered as
// closed (spec §2 — silent reconnection reintroduces the daemon).

export function createSseParser(onEvent) {
  let buffer = '';
  return (chunk) => {
    buffer += chunk;
    let split;
    while ((split = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, split);
      buffer = buffer.slice(split + 2);
      let event = 'message';
      let data = '';
      for (const line of frame.split('\n')) {
        if (line.startsWith('event: ')) event = line.slice(7);
        else if (line.startsWith('data: ')) data += line.slice(6);
      }
      onEvent(event, data === '' ? null : JSON.parse(data));
    }
  };
}
```

Append to `src/ui/public/lib/viewmodel.js`:

```js
// --- Watch/Ask view-models (web-ui plan 3) ----------------------------------

// The one place absence-vs-zero is decided for the DOM: an injection record
// without `tokens` predates the field and means NOT RECORDED — never zero.
// Zero is a real measurement (everything selected spilled). audit.ts pins
// this on the field itself; this function is that contract applied to
// rendering, and the test pins both directions.
export function describeRecord(record) {
  const injection = record.kind === 'injection';
  return {
    at: record.at,
    kind: record.kind,
    op: record.op,
    sessionId: record.sessionId ?? null,
    injected: injection ? (record.injected ?? []).length : 0,
    spilled: injection ? (record.spilled ?? []) : [],
    tokens: !injection ? null : (typeof record.tokens === 'number' ? record.tokens : 'not-recorded'),
    itemId: record.itemId ?? null,
    origin: record.origin ?? null,
    path: record.path ?? null,
    note: record.note ?? null,
  };
}

function sortedJson(value) {
  if (Array.isArray(value)) return `[${value.map(sortedJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${sortedJson(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

// Records carry no id; the stream-vs-backlog overlap is deduped by full
// serialized identity (plan 3 design decision 1).
export function dedupeKey(record) {
  return sortedJson(record);
}

export function formatAge(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// The strip's decision table (spec §4b + §7): five states, each its own
// rendering, never a number invented for a state that lacks one. `age` is
// computed by the caller from receivedAt at render time so it ticks.
export function contextStrip(body, isCold) {
  if (isCold || body === null) {
    return { state: 'cold', pct: null, used: null, size: null, receivedAt: null, myctx: null, myctxError: null };
  }
  const myctx = body.mycontext ?? null;
  const myctxError = body.mycontextError ?? null;
  if (body.sample === null) {
    return { state: 'no-bridge', pct: null, used: null, size: null, receivedAt: null, myctx, myctxError };
  }
  const c = body.sample.context;
  return {
    state: c.state,                    // 'known' | 'not-yet-known' | 'unknown'
    pct: c.percent,
    used: c.usedTokens,
    size: c.windowSize,
    receivedAt: body.sample.receivedAt,
    myctx,
    myctxError,
  };
}

// One series from the volume endpoint's columns: the HEIGHT only. The
// per-kind breakdown each bucket also carries is the pulse's colouring, and
// the pulse is not drawn by this plan yet (§0, open question 1).
export function sparkline(buckets, width, height) {
  const max = Math.max(1, ...buckets.map((b) => b.total));
  const step = buckets.length > 1 ? width / (buckets.length - 1) : 0;
  return buckets
    .map((b, i) => `${Math.round(i * step)},${Math.round(height - (b.total / max) * height)}`)
    .join(' ');
}
```

- [ ] **Step 4: Run the tests**

Run: `node --test test/ui/viewmodel.test.ts && node --test test/ui/strings-parity.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/sse.js src/ui/public/lib/viewmodel.js test/ui/viewmodel.test.ts
git commit -m "feat(ui): SSE parser and Watch/Ask view-models — absence is a state, never zero"
```

---
## Task 11: `screens/watch.js` and `window.myctx.stream()` — the Watch screen

> **Mockup — binding for this screen.** `data-p="watch"`; heading `watch.h` **Audit stream**; verdict
> `watch.v` "the only record of what spilled"; subtitle `watch.sub` "Four record kinds — mutations,
> injections, hook actions and focus changes. A focus change is a **regime change**, drawn as a rule
> across the feed rather than as one row." **One card**, top to bottom:
>
> 1. The **activity pulse** (`#pulse`) — one column per ten seconds, newest at the reading-end edge,
>    height = records in that column, colour = record kind. `watch.pulsen` states why it exists.
> 2. **Five** filter buttons — `all` (`watch.all`), `mutation`, `injection`, `hook`, **`focus`**.
> 3. The record table — `th.when` At · `th.kind` Kind · `th.what` What. A `focus` record is **not** a
>    row: it is a full-width `regime` rule labelled *regime change · …*, because everything below it
>    was selected from a different corpus.
> 4. An `aria-live="polite"` count of the rows shown.
> 5. `watch.voidn` — an injection row carries a gold bar of its cost against the 6,000-token budget,
>    and where `tokens` is absent it draws a **hatched void** and says so. Design decision 3's rule,
>    as a mark rather than only a sentence.
>
> **No spills pane appears on this screen** (§0, open question 2), so "the strip, the spills pane,
> the live feed" and "Spills sit ABOVE the feed" below no longer describe what is built. The two
> earlier cautions — that the mockup covers only three record kinds and shows the context number
> unconditionally — were true of a file two rebuilds old and are retired in §0: it now has the
> `focus` filter, the regime rule, and all three `#ctx` states.
>
> **`t()` RETURNS NODES, and this screen appends them everywhere — 2026-08-20.** Plan 1 is
> respecifying `t()` to return an array of nodes (§0, open question 7, now answered), because the
> mockup's `{m:…}` and `{mv:name}` slots are monospace, bidi-isolated ELEMENTS and a string cannot
> carry one. Assigning a node list to `.textContent`, or interpolating it into a template literal,
> flattens the isolated run straight back to text — the exact regression the marker exists to
> prevent, and invisible in English. So: the local `el()` helper below takes **either** a string
> **or** a node list, every `el(tag, class, t(…))` keeps working unchanged, and the three sites that
> assigned or concatenated are rewritten to append.
>
> **Two places cannot take nodes, and they are not exceptions to be argued with.** An
> **attribute value** holds characters and nothing else — the mockup translates `aria-label`
> through `data-t-aria` (its filter group is `aria-label="Filter"` / `data-t-aria="aria.wfilters"`),
> and a `title` is the same shape. Those sites need `t()`'s **flattening companion**: the same
> lookup and the same substitution, joined into one plain string, with the marker's element dropped
> because an attribute cannot render an element. **Plan 1 owns that helper and this document
> deliberately does not name it** — inventing a name that turns out not to match the shipped one is
> the drift §3 bans. Read the shipped strings module, use the name it exports beside `t`, and if it
> exports none, say so in the commit rather than flattening by hand here. The **`<option>`** case is
> narrower and is handled in Task 12: a text node is legal `<option>` content, so appending works,
> but only for a key that carries no monospace slot — one that does takes the same companion.

**Files:**
- Create: `src/ui/public/screens/watch.js`
- Modify: `src/ui/public/app.js` (add `watch` to `SCREENS` and to the **existing** `nav.ev` rail group — "Evidence — why it did or didn't" — and **not** to a group of its own; add `myctx.stream()`)
- Test: none new — the DOM glue is the spec-§6 rendering gap, stated in `test/ui/viewmodel.test.ts`'s docstring; every decision this screen makes lives in Task 10's tested view-models and Task 6's tested endpoints.

**Interfaces:**
- Consumes: `window.myctx` (Plan 1 Task 16), `createSseParser` (Task 10), `describeRecord`/`dedupeKey`/`formatAge`/`contextStrip`/`sparkline` (Task 10), `GET /api/meta`, `/api/watch/*`, `/api/ask/audit` (backlog).
- Produces:
  - `window.myctx.stream(path, onEvent, onEnd): () => void` — added in `app.js` beside `api()`: a token-carrying fetch whose body feeds `createSseParser`; `onEnd(reason)` fires exactly once when the stream closes (`'closed'` or `'fault'`); the returned function aborts. **It never reconnects** — the same §2 rule `api()` already implements for fetch failures.
  - The `watch` screen module: `export async function render(root, ctx)` matching Plan 1 Task 17's screen contract.

Screen layout, top to bottom — the strip, then the single Watch card in the order the mockup draws it: pulse, filters, table, live count, token-void note. **No spills pane is built here** (§0, open question 2). Spec §5's point stands — a spill record is the only answer to "why didn't Claude see this item" — and in the mockup that answer is carried by the injection row's own text and by plan 1's ghost lane, ratio bar and heatstrip; where else it belongs is the owner's call, not this task's.

**The volume series is a different case after ruling A2, and the code below is honest about being behind the mockup.** `/api/watch/volume` is now the **activity pulse's** endpoint — every record kind, in ten-second buckets, off the audit projection — and the pulse is drawn on `watch` by the mockup, so this is no longer a chart with no home. What Step 2 renders is still the **strip sparkline this plan already had**: one line of the column heights, in the footer, ignoring the `byKind` breakdown each bucket carries. That is a weaker drawing than `#pulse`, in the wrong place, and the instruction forbids shipping a weaker version of what the mockup draws — so it is **an interim, not the target.** The target is the §0 row this plan still owes (Tasks 10 and 11: the pulse element, coloured by kind, inside the Watch card). Recorded rather than designed here, exactly as open question 1's second half says.

- [ ] **Step 1: Add `stream()` to `app.js`**

Beside `api()` (which closes over `token`):

```js
function stream(path, onEvent, onEnd) {
  const controller = new AbortController();
  let ended = false;
  const end = (reason) => { if (!ended) { ended = true; onEnd(reason); } };
  fetch(path, { headers: { 'X-Mycontext-Token': token }, signal: controller.signal })
    .then(async (response) => {
      if (!response.ok) { end('fault'); return; }
      const { createSseParser } = await import('/lib/sse.js');
      const feed = createSseParser((event, data) => {
        if (event === 'fault') { end('fault'); return; }
        onEvent(event, data);
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        feed(decoder.decode(value, { stream: true }));
      }
      // The server exited or closed the stream. Say so; NEVER reconnect —
      // silent reconnection would reintroduce the daemon by another name (§2).
      end('closed');
    })
    .catch(() => end(controller.signal.aborted ? 'aborted' : 'closed'));
  return () => { controller.abort(); ended = true; };
}
```

Add `stream` to the `window.myctx` object literal, add to `SCREENS`:

```js
  watch: () => import('/screens/watch.js'),
```

and extend `NAV` with a Watch group (before the Learn group):

```js
  ['nav.watch', ['watch']],
```

- [ ] **Step 2: Write the screen**

```js
// src/ui/public/screens/watch.js
// Watch (spec §4): the status strip, the spills pane, the live audit stream.
// Everything decided here is decided in a TESTED view-model (lib/viewmodel.js)
// or a tested endpoint; this file is DOM glue, and per spec §6 the glue
// itself is the stated rendering-coverage gap.
import {
  contextStrip, describeRecord, dedupeKey, formatAge, sparkline,
} from '/lib/viewmodel.js';

const FEED_CAP = 200;

// `content` is EITHER a plain string OR the node list t() returns. t() does
// not return a string: the mockup's `{m:…}` and `{mv:name}` slots are
// monospace, bidi-isolated elements, and `.textContent = …` or a template
// literal would flatten them back to text — silently discarding the isolation
// those slots exist to give a branch name, a SHA or an item id inside RTL
// prose. Taking both shapes here is what keeps every `el(tag, class, t(…))`
// call site below unchanged.
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof content === 'string') node.textContent = content;
  else if (content !== undefined && content !== null) node.append(...content);
  return node;
}

export async function render(root, ctx) {
  const { api, t, session, onSessionChange } = window.myctx;
  root.textContent = '';
  root.append(el('h1', null, t('watch.title')));

  // --- The status strip ------------------------------------------------------
  const strip = el('div', 'strip');
  root.append(strip);
  const seen = new Set();

  async function renderStrip() {
    strip.textContent = '';
    // Git: rendered from /api/meta's GitInfo — read from .git as files server-
    // side; three-valued upstream, no ahead/behind, no working-tree status
    // (spec §4's constraint on the strip, enforced by GitInfo's own type).
    const meta = await api('/api/meta');
    const git = meta.git;
    const gitSpan = el('span', 'strip-git');
    // These four keys carry `{mv:…}`, so t() hands back NODES and they are
    // APPENDED. Neither `.textContent =` nor a template literal can be used
    // here: both flatten the run to text, which discards the isolation the
    // monospace slot exists to give a branch name and a SHA inside RTL prose,
    // and a t() that never parsed the marker would print `{mv:branch}` intact.
    if (git === null) gitSpan.append(...t('strip.notARepo'));
    else {
      const commit = (git.commit ?? '').slice(0, 8) || '?';
      if (git.detached) gitSpan.append(...t('strip.detached', { commit }));
      else {
        gitSpan.append(...t('strip.branch', { branch: git.branch, commit }), ' · ');
        gitSpan.append(...(
          git.upstream === 'in-sync' ? t('strip.inSync', { branch: git.branch })
          : git.upstream === 'differs' ? t('strip.differs', { branch: git.branch })
          : t('strip.noUpstream')));
      }
    }
    strip.append(gitSpan);

    // The activity pulse's series, drawn here as a single-line sparkline.
    // Its source is the AUDIT projection under ruling A2 — every record kind,
    // in ten-second buckets — so this is NOT "injections over time" and must
    // not be labelled as one. The mockup draws the same series properly, as
    // `#pulse` inside the Watch card, coloured by kind; that drawing is the §0
    // row this plan still owes (open question 1's second half), and until it
    // lands the strip carries the reduced version below. Each bucket also
    // carries `byKind`, which nothing here reads yet.
    const volume = await api('/api/watch/volume?minutes=20&bucket=10');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 120 16');
    svg.setAttribute('class', 'strip-spark');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    line.setAttribute('points', sparkline(volume.buckets, 120, 16));
    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', 'currentColor');
    svg.append(line);
    const volumeBox = el('span', 'strip-volume');
    volumeBox.append(el('span', 'dim', t('watch.volume.title', { minutes: volume.minutes })), svg);
    strip.append(volumeBox);

    // The context number — §4b, every claim with its condition attached.
    const current = session();
    const cold = current === 'cold' || current === null;
    const body = cold ? null : await api(`/api/watch/context?session=${encodeURIComponent(current)}`);
    const s = contextStrip(body, cold);
    const ctxSpan = el('span', 'strip-ctx');
    // `replaceChildren(...nodes)`, not `.textContent =`: t() hands back a node
    // list, and assigning one to textContent would stringify it.
    if (s.state === 'cold') ctxSpan.replaceChildren(...t('strip.ctx.cold'));
    else if (s.state === 'no-bridge') ctxSpan.replaceChildren(...t('strip.ctx.noBridge'));
    else if (s.state === 'not-yet-known') ctxSpan.replaceChildren(...t('strip.ctx.notYetKnown'));
    else if (s.state === 'unknown') ctxSpan.replaceChildren(...t('strip.ctx.unknown'));
    else {
      // "As of last response", with the sample's age — never interpolated or
      // extrapolated between samples (§4b constraint 1).
      ctxSpan.replaceChildren(...t('strip.ctx.known', {
        pct: s.pct === null ? '?' : s.pct.toFixed(1),
        used: s.used === null ? '?' : `${(s.used / 1000).toFixed(1)}k`,
        size: s.size === null ? '?' : `${(s.size / 1000).toFixed(1)}k`,
        age: formatAge(Date.now() - Date.parse(s.receivedAt)),
      }));
    }
    strip.append(ctxSpan);
    if (s.myctx !== null && s.myctx.injections > 0 && s.state !== 'cold') {
      const key = s.myctx.unrecorded > 0 ? 'strip.myctxPartial' : 'strip.myctx';
      strip.append(el('span', 'strip-myctx', t(key, {
        tokens: `${(s.myctx.tokens / 1000).toFixed(1)}k`,
        injections: s.myctx.injections,
        unrecorded: s.myctx.unrecorded,
      })));
    } else if (s.myctxError !== null) {
      strip.append(el('span', 'strip-myctx dim', t('strip.myctxUnavailable', { error: s.myctxError })));
    }
  }

  // --- The spills pane -------------------------------------------------------
  const spillsBox = el('section', 'spills');
  root.append(spillsBox);

  async function renderSpills() {
    const data = await api('/api/watch/spills?limit=50');
    spillsBox.textContent = '';
    spillsBox.append(el('h2', null, t('watch.spills.title')));
    spillsBox.append(el('p', 'dim', t('watch.spills.why')));
    if (data.spills.length === 0) {
      spillsBox.append(el('p', null, t('watch.spills.none')));
    } else {
      const table = el('table', 'spill-table');
      for (const spill of data.spills.slice().reverse()) {
        const row = el('tr');
        row.append(el('td', 'dim', formatAge(Date.now() - Date.parse(spill.at))));
        const id = el('td');
        const link = el('a', 'path', spill.id);
        link.href = `#item/${spill.id}`;
        id.append(link);
        row.append(id);
        row.append(el('td', null, spill.tier));
        row.append(el('td', 'spill', spill.reason));
        table.append(row);
      }
      spillsBox.append(table);
      spillsBox.append(el('p', 'dim', t('watch.spills.window', { n: data.recordWindow })));
      // The label is a node list and the item ids are data, so the two are
      // APPENDED rather than concatenated: a template literal would flatten
      // whatever the label carries.
      const top = el('p', null);
      top.append(...t('watch.spills.top'), `: ${
        data.topSpilled.map((r) => `${r.label} (${r.count})`).join(', ')}`);
      spillsBox.append(top);
    }
  }

  // --- The live feed ---------------------------------------------------------
  root.append(el('h2', null, t('watch.stream')));
  const status = el('p', 'dim', t('watch.streamWaiting'));
  root.append(status);
  const feed = el('ol', 'feed');
  root.append(feed);

  function renderRecord(record) {
    const key = dedupeKey(record);
    if (seen.has(key)) return;      // stream/backlog overlap — decision 1
    seen.add(key);
    const d = describeRecord(record);
    const li = el('li', `rec rec-${d.kind}`);
    li.append(el('span', 'dim', d.at));
    li.append(el('span', 'rec-kind', t(`watch.kind.${d.kind}`)));
    li.append(el('span', null, d.op));
    if (d.kind === 'injection') {
      li.append(el('span', null, t('watch.injected', { n: d.injected })));
      if (d.spilled.length > 0) li.append(el('span', 'spill', t('watch.spilledCount', { n: d.spilled.length })));
      for (const s of d.spilled) li.append(el('span', 'spill', `${s.id} — ${s.reason}`));
      li.append(el('span', 'dim',
        d.tokens === 'not-recorded' ? t('watch.tokensNotRecorded') : t('watch.tokens', { n: d.tokens })));
      if (d.path !== null) li.append(el('span', 'path', d.path));
    } else if (d.kind === 'mutation') {
      if (d.itemId !== null) li.append(el('span', 'path', d.itemId));
      if (d.origin !== null) li.append(el('span', 'dim', d.origin));
    } else if (d.kind === 'focus' && d.note !== null) {
      // Focus records in the stream are what keep injections from appearing
      // to vanish for no visible cause (spec §5).
      li.append(el('span', null, d.note));
    }
    feed.prepend(li);
    while (feed.children.length > FEED_CAP) feed.lastChild.remove();
  }

  async function loadBacklog() {
    const backlog = await api('/api/ask/audit?limit=50');
    for (const record of backlog.records) renderRecord(record);
  }

  const stop = window.myctx.stream('/api/watch/stream', (event, data) => {
    if (event === 'record') renderRecord(data);
    else if (event === 'resync') {
      status.replaceChildren(...t('watch.resync'));
      loadBacklog();
      renderSpills();
    }
  }, (reason) => {
    status.replaceChildren(...(reason === 'fault'
      ? t('watch.streamFault', { error: '' })
      : t('watch.streamEnded')));
    status.className = 'spill';
  });

  await renderStrip();
  await renderSpills();
  await loadBacklog();
  onSessionChange(() => { renderStrip(); });
  ctx.onLeave?.(() => stop());
}
```

(`ctx.onLeave` — if Plan 1's screen contract exposes a different teardown hook, use the shipped one; read `screens/preview.js` first. If no teardown hook exists, register the abort on `hashchange` once: `window.addEventListener('hashchange', stop, { once: true })`.)

- [ ] **Step 3: Add the strip/feed styles — logical properties only**

Append to `src/ui/public/styles.css`:

```css
.strip { display: flex; flex-wrap: wrap; gap: 1rem; align-items: center;
  padding-block: 0.5rem; padding-inline: 0.75rem; border: 1px solid var(--line); }
.strip-spark { inline-size: 120px; block-size: 16px; color: var(--accent); }
.feed { list-style: none; padding-inline-start: 0; }
.feed li { display: flex; flex-wrap: wrap; gap: 0.5rem;
  padding-block: 0.25rem; border-block-end: 1px solid var(--line); }
.rec-kind { color: var(--accent); }
.spill-table td { border: none; padding-inline-end: 0.75rem; }
```

- [ ] **Step 4: Look at it**

Run: `node src/ui/server.ts --port 4820` in a workspace with items, open the printed URL, navigate to Watch. Trigger records (run `mycontext` commands, or a Claude session with the hooks) and watch them land. This is the manual half; the wire contract is Task 8's E2E.

- [ ] **Step 5: Run the suite and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add src/ui/public/screens/watch.js src/ui/public/app.js src/ui/public/styles.css
git commit -m "feat(ui): the Watch screen — status strip, spills pane, live audit feed"
```

---
## Task 12: `screens/ask.js` — the query builder

> **Mockup — binding for this screen.** `data-p="ask"`; heading `ask.h` **Ask**; verdict `ask.v`
> "filters, for people who do not write SQL"; subtitle `ask.sub` "Fields, operators and values —
> bound as parameters, composed on the server. **No query text crosses the wire.**" One card:
>
> 1. One filter row — `ask.field` **Field** select, an operator select (`is` / `is not`), a value
>    select, and a **Run** button (`ask.run`).
> 2. A disclosure, **"Why there is no SQL box"** (`ask.whyq` / `ask.why`): a `readOnly:true`
>    connection still permits `VACUUM INTO '<any path>'`; the keyword scan that would stop it cannot
>    see keywords inside backtick or bracket identifiers; removing the input removes the problem.
> 3. The result table — `th.when` At · `th.item` Item · `th.role` Role, the role as a chip.
> 4. A second disclosure, **"Why a search can return nothing"** (`ask.recallq`, `ask.recall1`,
>    `ask.recall2`) — literal matching today, full-text with a stemmer decided but `PROPOSED`, behind
>    `search` and `query_items` only and never in `select()`, and the case being recall rather than
>    ranking.
>
> **There is no predefined-query list and no tab strip on this screen**, and the SQL pane is the
> owner's on 2026-08-20 (the mockup carries `ask.sqlh` / `ask.sqln`). The earlier reading —
> "predefined queries on the left, the generated SQL and result table on the right … it has no
> structured filters" — is backwards in every clause and is retired in §0. The endpoints still
> return `sql`/`params` (design decision 10). The keys this screen references that the mockup did
> not carry — `ask.sqlCaption` and `ask.predefined*` — are being added to the mockup now and are
> **kept as declared, pending it** (§0, open question 5).
>
> **`t()` returns NODES here too — 2026-08-20.** Same contract change as Task 11 and the same
> treatment: `el()` takes a string or a node list, and the two sites that assigned to
> `.textContent` or concatenated into a template literal now append. Two shapes on this screen
> deserve naming. A **result cell** may now hold a node list, because `describeRecord`'s "tokens not
> recorded" state comes from `t()` — `renderRows` must append an array rather than
> `JSON.stringify` it, which is what `typeof value === 'object'` would otherwise do to one. And an
> **`<option>`** holds text: a text node is legal content there, so appending t()'s list works, but
> **only for a key with no monospace slot** — a key carrying `{m:…}` or `{mv:name}` must not be used
> as an option label, and takes the flattening companion Task 11's note describes and does not name.

**Files:**
- Create: `src/ui/public/screens/ask.js`
- Modify: `src/ui/public/app.js` (add `ask` to `SCREENS` and to the **existing** `nav.ev` rail group, beside `watch`)
- Test: none new — same §6 rendering gap; the builder's semantics are Task 7's tested endpoints, and the screen computes nothing of its own.

**Interfaces:**
- Consumes: `window.myctx.api`/`t`, `GET /api/ask/corpus`, `GET /api/ask/audit`, `GET /api/ask/summary`.
- Produces: the `ask` screen module (`export async function render(root, ctx)`).

The builder "swaps SQL as you build it" by re-querying on every filter change and rendering the **returned** `sql` and `params` — one source, the server's, so the SQL shown is by construction the SQL that ran (design decision 10). No client-side SQL assembly exists to drift.

- [ ] **Step 1: Write the screen**

```js
// src/ui/public/screens/ask.js
// Ask (spec §4): structured queries over the corpus and the audit history,
// with the generated SQL shown so it teaches. The SQL pane renders the
// server's response verbatim — display and execution cannot drift because
// there is only one builder, server-side (filterSelect / corpusSelect).

// `content` is EITHER a plain string OR the node list t() returns — see the
// note in screens/watch.js: t() cannot return a string, because the mockup's
// `{m:…}` / `{mv:name}` slots are monospace, bidi-isolated elements.
function el(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (typeof content === 'string') node.textContent = content;
  else if (content !== undefined && content !== null) node.append(...content);
  return node;
}

// `label` is t()'s node list; `el` appends it.
function field(label, input) {
  const node = el('label', 'ask-field');
  node.append(el('span', 'dim', label), input);
  return node;
}

function select(options, anyLabel) {
  const node = document.createElement('select');
  // An `<option>` renders TEXT and nothing else. A text node is legal content
  // there, so t()'s list appends cleanly — but only because `ask.field.any`
  // carries no monospace slot. A key that carries one may not be used as an
  // option label: it needs t()'s flattening companion instead, because the
  // element the slot produces has nowhere to render inside an option.
  const any = el('option', null, anyLabel);
  any.value = '';
  node.append(any);
  for (const option of options) {
    const o = el('option', null, option);
    o.value = option;
    node.append(o);
  }
  return node;
}

function text(placeholder) {
  const node = document.createElement('input');
  node.type = 'text';
  node.placeholder = placeholder ?? '';
  return node;
}

const AUDIT_KINDS = ['mutation', 'injection', 'hook', 'focus', 'access', 'progress'];
const AUDIT_OPS = [
  'create', 'update', 'stage', 'promote', 'discard', 'supersede', 'accept', 'refresh',
  'link', 'unlink', 'session-start', 'compact-restore', 'jit', 'manual',
  'pre-compact', 'post-tool-use', 'deny', 'focus-set', 'focus-clear',
];
const STATUSES = ['active', 'draft', 'superseded', 'deprecated', 'validated'];
const ORIGINS = ['human', 'agent', 'ingest'];

export async function render(root) {
  const { api, t } = window.myctx;
  root.textContent = '';
  root.append(el('h1', null, t('ask.title')));

  const tabs = el('div', 'ask-tabs');
  const corpusTab = el('button', 'active', t('ask.tab.corpus'));
  const auditTab = el('button', null, t('ask.tab.audit'));
  tabs.append(corpusTab, auditTab);
  root.append(tabs);

  const filters = el('form', 'ask-filters');
  const sqlPane = el('pre', 'ask-sql');
  const sqlCaption = el('p', 'dim', t('ask.sqlCaption'));
  const noteLine = el('p', 'dim');
  const results = el('div', 'ask-results');
  root.append(filters, sqlCaption, sqlPane, noteLine, results);

  let mode = 'corpus';

  // Category options come from the corpus itself rather than a hardcoded list.
  const items = await api('/api/items');
  const types = [...new Set((items.items ?? items.rows ?? []).map((i) => i.type))].sort();

  const corpusInputs = {
    type: select(types, t('ask.field.any')),
    status: select(STATUSES, t('ask.field.any')),
    layer: select(['project', 'global'], t('ask.field.any')),
    always: select(['1', '0'], t('ask.field.any')),
    scoped: select(['1', '0'], t('ask.field.any')),
    title: text(),
    limit: text('100'),
  };
  const auditInputs = {
    kind: select(AUDIT_KINDS, t('ask.field.any')),
    op: select(AUDIT_OPS, t('ask.field.any')),
    origin: select(ORIGINS, t('ask.field.any')),
    item: text(),
    session: text(),
    since: text('7d'),
    until: text(),
    limit: text('200'),
  };
  const CORPUS_LABELS = {
    type: 'ask.field.type', status: 'ask.field.status', layer: 'ask.field.layer',
    always: 'ask.field.always', scoped: 'ask.field.scoped', title: 'ask.field.title',
    limit: 'ask.field.limit',
  };
  const AUDIT_LABELS = {
    kind: 'ask.field.kind', op: 'ask.field.op', origin: 'ask.field.origin',
    item: 'ask.field.item', session: 'ask.field.session', since: 'ask.field.since',
    until: 'ask.field.until', limit: 'ask.field.limit',
  };

  function buildQuery(inputs) {
    const params = new URLSearchParams();
    for (const [name, input] of Object.entries(inputs)) {
      const value = input.value.trim();
      if (value !== '') params.set(name, value);
    }
    return params.toString();
  }

  function renderRows(rows) {
    results.textContent = '';
    if (rows.length === 0) { results.append(el('p', 'dim', t('ask.noRows'))); return; }
    const table = el('table');
    const head = el('tr');
    for (const key of Object.keys(rows[0])) head.append(el('th', null, key));
    table.append(head);
    for (const row of rows) {
      const tr = el('tr');
      for (const value of Object.values(row)) {
        // A cell may now hold t()'s NODE LIST — the "tokens not recorded"
        // state below is one — so arrays are appended. Without this branch
        // `typeof value === 'object'` would JSON.stringify a list of DOM nodes
        // into the table.
        tr.append(el('td', null, Array.isArray(value) ? value
          : value === null ? '—'
          : typeof value === 'object' ? JSON.stringify(value)
          : String(value)));
      }
      table.append(tr);
    }
    results.append(el('p', 'dim', t('ask.rows', { n: rows.length })), table);
  }

  async function run() {
    try {
      if (mode === 'corpus') {
        const body = await api(`/api/ask/corpus?${buildQuery(corpusInputs)}`);
        sqlPane.textContent = `${body.sql}\n-- params: ${JSON.stringify(body.params)}`;
        // Appended, not concatenated: a template literal would flatten both
        // node lists into text.
        noteLine.replaceChildren(...(body.truncated
          ? [...t('ask.truncated', { n: body.rows.length }), ' · ', ...t('ask.updatedAtTrap')]
          : t('ask.updatedAtTrap')));
        renderRows(body.rows);
      } else {
        const body = await api(`/api/ask/audit?${buildQuery(auditInputs)}`);
        sqlPane.textContent = `${body.sql}\n-- params: ${JSON.stringify(body.params)}`;
        noteLine.replaceChildren(...(body.projection.stateBeforeSync === 'fresh'
          ? t('ask.projection.fresh')
          : t('ask.projection.caughtUp', { state: body.projection.stateBeforeSync })));
        renderRows(body.records.map((r) => ({
          at: r.at, kind: r.kind, op: r.op, session: r.sessionId ?? null,
          item: r.itemId ?? null, injected: (r.injected ?? []).length || null,
          spilled: (r.spilled ?? []).map((s) => `${s.id}: ${s.reason}`).join('; ') || null,
          tokens: r.kind !== 'injection' ? null
            : typeof r.tokens === 'number' ? r.tokens : t('watch.tokensNotRecorded'),
          origin: r.origin ?? null, path: r.path ?? null, note: r.note ?? null,
        })));
      }
    } catch (err) {
      sqlPane.textContent = '';
      noteLine.replaceChildren(...t('ask.projection.failed', { error: err.message }));
      results.textContent = '';
    }
  }

  function renderFilters() {
    filters.textContent = '';
    const inputs = mode === 'corpus' ? corpusInputs : auditInputs;
    const labels = mode === 'corpus' ? CORPUS_LABELS : AUDIT_LABELS;
    for (const [name, input] of Object.entries(inputs)) {
      filters.append(field(t(labels[name]), input));
      input.onchange = run;
    }
    const runButton = el('button', null, t('ask.run'));
    runButton.type = 'button';
    runButton.onclick = run;
    filters.append(runButton);

    if (mode === 'audit') {
      const predefined = el('div', 'ask-predefined');
      predefined.append(el('span', 'dim', t('ask.predefined')));
      const canned = [
        ['ask.predefined.ops', 'report=ops'],
        ['ask.predefined.spilled', 'report=items&role=spilled'],
        ['ask.predefined.injected', 'report=items&role=injected'],
        ['ask.predefined.sessions', 'report=sessions'],
      ];
      for (const [key, qs] of canned) {
        const button = el('button', null, t(key));
        button.type = 'button';
        button.onclick = async () => {
          const body = await api(`/api/ask/summary?${qs}`);
          sqlPane.textContent = '';
          noteLine.replaceChildren(...(body.projection.stateBeforeSync === 'fresh'
            ? t('ask.projection.fresh')
            : t('ask.projection.caughtUp', { state: body.projection.stateBeforeSync })));
          renderRows(body.rows);
        };
        predefined.append(button);
      }
      filters.append(predefined);
    }
  }

  corpusTab.onclick = () => { mode = 'corpus'; corpusTab.className = 'active'; auditTab.className = ''; renderFilters(); run(); };
  auditTab.onclick = () => { mode = 'audit'; auditTab.className = 'active'; corpusTab.className = ''; renderFilters(); run(); };

  renderFilters();
  await run();
}
```

(`/api/items`' body shape is Plan 1 Task 11's — read `apiItems` in the shipped `read-model.ts` and use its actual field name; the `items.items ?? items.rows` fallback above is a placeholder for exactly that check and must be replaced by the real single name.)

- [ ] **Step 2: Register the screen and add its styles**

In `app.js`: add `ask: () => import('/screens/ask.js')` to `SCREENS` and `['nav.ask', ['ask']]` to `NAV` (after the Watch group). Append to `styles.css`:

```css
.ask-filters { display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: end; }
.ask-field { display: flex; flex-direction: column; gap: 0.25rem; }
.ask-sql { border: 1px solid var(--line); padding-block: 0.5rem; padding-inline: 0.75rem;
  overflow-x: auto; }
.ask-tabs button.active { text-decoration: underline; }
.ask-predefined { display: flex; gap: 0.5rem; align-items: center; }
```

- [ ] **Step 3: Look at it**

Run: `node src/ui/server.ts --port 4820`, open Ask; flip filters and watch the SQL pane change with the rows; run the predefined spilled-items query.

- [ ] **Step 4: Run the suite and commit**

Run: `npm test && npx tsc --noEmit`

```bash
git add src/ui/public/screens/ask.js src/ui/public/app.js src/ui/public/styles.css
git commit -m "feat(ui): the Ask screen — filter builder with the executed SQL shown"
```

---

## Task 13: Documentation — both documents, always

**Files:**
- Modify: `README.md`
- Modify: `docs/README.he.md`
- Test: `test/docs/parity.test.ts` (existing)

**Interfaces:**
- Consumes: everything shipped above.
- Produces: user documentation for Watch, Ask and the bridge — every guarantee with its condition in the same sentence.

- [ ] **Step 1: Write the English section**

In `README.md`, inside the web-UI section Plan 1 added (extend it; do not open a second one), add:

```markdown
### Watch and Ask

**Watch** streams the audit log live: injections with what they *spilled*, mutations,
hook actions, and focus changes. A spill entry is the only record anywhere of an item
that was selected and did not fit the budget — "why didn't Claude see this item" is
answered on this screen and nowhere else. Injection records made before the token
count existed show "tokens not recorded", never zero. An open Watch tab does not keep
the server alive: the stream does not count as activity, and the 15-minute idle exit
fires with it open; the page then says the server has exited and does not reconnect.

**Ask** builds structured queries over the corpus and over the audit history, showing
the exact SQL each answer ran. Corpus rows are read as the hooks last left them — Ask
never rebuilds the index, and `updated_at` is index write time, not a content
timestamp. Audit answers are served from the projection after it has caught up with
the log; when it cannot catch up, Ask refuses rather than answering from stale data.

### The status line bridge (opt-in)

The UI cannot measure Claude's context by itself; Claude Code hands that number to a
*status line command*. `mycontext statusline install` shows your current `statusLine`
setting and exactly what would replace it, and writes nothing until you re-run it with
`--yes`; the replaced value is saved, and `mycontext statusline uninstall --yes`
restores it. Installing mycontext never touches your status line — only this command,
run by you, does.

Once installed, `mycontext statusline` runs on each assistant message: it prints the
model, the context in use, and how much of it came from project knowledge, and tees
the payload to a per-session file the web UI reads. **When the bridge is installed,
the UI shows Claude's real context number, labelled "as of last response" with the
sample's age; without the bridge, it shows only what mycontext injected and says
so.** After a compact the number reads "not yet known" until the next API call, and
an older Claude Code that sends no `context_window` reads "unknown" — neither is ever
shown as zero. The audit log is local to this machine, so the "from project
knowledge" share covers this machine's sessions only.
```

- [ ] **Step 2: Mirror it in Hebrew**

Add the structurally identical section to `docs/README.he.md` inside `<div dir="rtl">`, matching the existing document's register; command names, flag names and field names (`mycontext statusline install`, `--yes`, `statusLine`, `context_window`, `updated_at`) stay in Latin script.

- [ ] **Step 3: Run the parity test and the suite**

Run: `node --test test/docs/parity.test.ts && npm test && npx tsc --noEmit && git status --porcelain`
Expected: green, clean tree after the commit below.

- [ ] **Step 4: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: Watch, Ask and the opt-in status line bridge — both documents"
```

---

## Produces summary — the interface this plan adds

```ts
// src/core/audit-db.ts additions
function readCompleteLines(file: string, offset: number): { text: string; consumed: number };
function filterSelect(filter: AuditFilter): { sql: string; params: (string | number)[] };

// src/core/audit-tail.ts
class AuditTail { constructor(root: string); poll(): { records: AuditRecord[]; resync: boolean } }

// src/core/statusline-tee.ts
function statuslineDir(root: string): string;
function sanitizeSessionId(id: string): string | null;      // refusal, never mangling
function writeTee(root, payload, receivedAt?): { written: boolean; reason?: string };
function readTee(root, sessionId): { receivedAt: string; payload: unknown } | null;
type ContextState = 'unknown' | 'not-yet-known' | 'known';
function classifyContext(payload: unknown): { state; usedTokens; windowSize; percent };

// src/cli/commands/statusline.ts (+ statusline-install.ts)
// `mycontext statusline` — stdin tee + printed line (the §4b bridge, CLI-only)
// `mycontext statusline install|uninstall [--yes] [--settings <path>]` — print, ask, write reversibly
function statusLineText(sample, model, myctx, myctxNote): string;
function myctxShare(projectRoot, sessionId): { tokens; injections; unrecorded };
function claudeSettingsPath(env): string;

// src/core/store.ts
Store.raw(sql: string, params?: (string | number)[]);        // default keeps existing callers

// HTTP surface (behind Plan 1's gate; unknown params → 400)
GET /api/watch/volume?minutes=&bucket=
                                  → { minutes, bucketSeconds, buckets: {start,total,byKind}[], projectionStateBeforeSync } | 503
                                    (the activity pulse's series — AUDIT projection, at + kind; ruling A2)
GET /api/watch/context?session=   → { session, sample|null, mycontext|null, mycontextError }
GET /api/watch/spills?item=&limit= → { spills, topSpilled, recordWindow, projectionStateBeforeSync } | 503
GET /api/watch/stream?poll=       → SSE: hello / record / resync / fault   (kind:'stream' — never idle-touched)
GET /api/ask/corpus?…             → { rows, sql, params, truncated }
GET /api/ask/audit?…              → { records, sql, params, projection } | 503
GET /api/ask/summary?report=…     → { report, rows, projection } | 503

// browser
window.myctx.stream(path, onEvent, onEnd): () => void;       // token-carrying; never reconnects
lib/sse.js: createSseParser(onEvent);
lib/viewmodel.js: describeRecord, dedupeKey, formatAge, contextStrip, sparkline;
screens: watch.js, ask.js;  strings: watch.*, ask.*, strip.*, nav.watch, nav.ask (both tables)
```

Execution: `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans`, in order — 1→2 (tail needs `readCompleteLines`), 3→4→5 (bridge chain), 6 and 7 after 1-3, 8 after 6-7, 9 before 11-12, 10 before 11, 13 last.

