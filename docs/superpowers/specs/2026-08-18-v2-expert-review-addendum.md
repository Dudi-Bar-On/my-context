# v2.0 expert review — consolidated addendum

**Date:** 2026-08-18
**Status:** findings and recommendations. Nothing here is decided; §7 lists what needs the owner's call.
**Base:** `master` at `c15fd98` (`v1.0.1-9`).
**Binds:** `specs/2026-08-16-web-ui-design.md`, `plans/2026-08-16-web-ui-{1,2,3}-*.md`,
`docs/design/web-ui-mockup.{html,md}`.
**Companion:** `specs/2026-08-18-v2-review-addendum.md` — a verification pass covering the
never-miss work. This document supersedes none of it; that one records what was *executed*,
this one records what ten specialist reviews *found*.

**Method.** Ten independent reviews, each with a different professional lens and none able to
see the others: architecture, UI/UX and information architecture, CSS/RTL/i18n, frontend
performance, client state, security, silent failures, test strategy, API contracts, and
corpus coherence. Each was given authority to override any decision, design, plan, or the
mockup itself, and each was told not to summarise the documents back.

---

## 0. Provenance

Every finding below was re-verified against the shipped source by the coordinator before it
was written down. Ranked claims carry one of three marks:

| Mark | Meaning |
|---|---|
| **[V]** | Verified by the coordinator: source read, or command run, at `c15fd98` |
| **[M]** | Measured — a number produced by executing code during this review |
| **[R]** | A reviewer's reasoning, endorsed but not independently executed |

Nothing marked **[V]** or **[M]** rests on a reviewer's report alone. Where a reviewer's
claim did not survive checking, it was dropped rather than softened.

**Two findings changed status during verification.** The shell-quoting defect (§2.4) arrived
as reasoning and was promoted to **[M]** after being demonstrated. The claim that the
`/api/select` parity test "could be written to pass" was checked and found stronger than
stated: it *cannot fail* on any of the five divergences below.

---

## 1. The root cause: three divergent lineages

Almost every citation defect in this corpus has one cause, and it is structural rather than
careless. **[V]**

```
plan 1 base  a866fc8   NOT an ancestor of HEAD
plan 2 base  20ed4f4   NOT an ancestor of HEAD
plan 3 base  plan/web-ui-watch + audit-injection-token-count   not ancestors
spec base    origin/phase-5/quality   IS an ancestor
```

The plans were not written *behind* a shared trunk — they were written on **branches that
diverged and never merged back**. Three real refactors landed on the line that became
`master` and are invisible to all three plans:

1. `relations.ts` split out of `mutate.ts` — `linkItems`, `unlinkItems`, `RELATION_TYPES`
   moved; `STATUSES` moved to `validate.ts`. **[V]**
2. The JIT hook's dedupe moved off the Ledger to a per-session **seen file**, keyed on
   `session_id` + `agent_id`. **[V]**
3. The Ledger itself became a **replayed projection** of the audit log, topped up by
   `topUpLedger` — whose only callers are `status`, `decay` and `audit replay-ledger`. **[V]**

The corpus makes roughly 200 `file:line` citations. The accurate ones are the ones that
happened not to move.

**This is not a documentation-hygiene problem.** Four of the six critical findings below are
direct consequences of it, and each one produces a screen that is confidently wrong.

---

## 2. Critical — a build should not start on these

### 2.1 `/api/select` never passes `focus` **[V]**

The hooks pass it — `pre-tool-use.ts` · `focus: focusState.focus },` · ~314 and
`inject.ts` · `focus: focusState.focus,` · ~576 — and
`select.ts` · `const eligible = isFocusActive(focus)` · ~1375 narrows
the eligible set by `focusHides` **before every tier and before budgeting**:

```ts
const focus = ctx.focus ?? null;
const eligible = isFocusActive(focus)
  ? eligibleAll.filter((i) => !focusHides(i, focus, config))
  : eligibleAll;
```

Plan 1's `parseSelectQuery` (`:1673-1677`) sets `event`, `path`, `restore`, `seen` — never
`focus`. So with a focus active the preview shows a different **delivered set and a different
spill set** than the hook produces, and `Selection.focus` is populated only when a focus is
active, so the response always carries `focus: null` and the screen renders no focus block.

The screen is captioned `'Exactly what Claude gets'`.

This is the identical defect §0 already corrected once for `seen` — one field over, one layer
down. `select.ts`'s own docblock states the rule: *"Focus is applied HERE and nowhere else…
a second place that decides what a session sees would be the fifth [defect]."*

### 2.2 `seen` is read from a projection nothing in the UI updates **[V]**

Spec §3 and Plan 1 (`:1360`, `:1425`) both said that `/api/select` passes
`seen: ledger.seen(session)` **"exactly as the hook does (`pre-tool-use.ts:138`)"** — which was
that call verbatim on plan 1's base `a866fc8`:
`pre-tool-use.ts` · `{ event: 'tool', path: target, seen: ledger.seen(sessionId) },` · ~138. <!-- historical-citation: quotes the line plan 1's pointer named on its own base `a866fc8`; the Ledger left this path before `c15fd98`, so the line is gone from `master` -->
Both documents have since retired the phrase — plan 1's contract now reads
`seen: seenIds(readSeen(ws.projectRoot, session))`.

Eighteen lines further down the same file, on `master`, the hook says:

> *"The Ledger is gone from this path entirely: session dedupe state lives in the
> per-session seen file, so this hook has no reason left to write SQLite."*

Three failures follow:

- **Wrong source.** The hook reads `readSeen(root, dedupeKey)`. The ledger table is populated
  only by `topUpLedger`, called by `status`, `decay` and `audit replay-ledger` — **no hook,
  and no route in any plan**. During a live session the preview's `seen` is as fresh as
  whenever a human last ran a CLI command in another terminal.
- **Wrong key.** The seen file is keyed `session_id::agent_id`; the audit record carries the
  bare `session_id`. So a replayed ledger **unions a subagent's deliveries into the parent's
  seen set** — the exact bug `io.ts` · `subagent's deliveries as if the parent had seen them, silently dropping the` · ~203 documents having already been paid for once.
- **Undetectable by the proposed test.** Plan 1's parity test seeds `ledger.record(...)` and
  asserts against `ledger.seen(...)` — a closed loop over the same wrong source.

*Three of the ten reviews reached this independently, by different routes.*

### 2.3 The no-writes guarantee is enforced against the wrong things **[V]**

Two distinct gaps under one claim — §2's *"There is no POST that changes state on disk."*

**The ban list points at files that no longer hold the functions.**
`BANNED_MODULES = ['src/core/mutate.ts', 'src/core/revision.ts']`, but `linkItems` is at
`relations.ts` · `export function linkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~74,
`unlinkItems` at `relations.ts` · `export function unlinkItems(ctx: MutationContext, input: LinkInput): MutationResult {` · ~340,
and `mutate.ts` contains **zero** of them.
`relations.ts` is unbanned, so a namespace import (`import * as relations from …`) passes
both assertions — precisely the hole the test's own self-check was written to close for
`revision.ts`.

**And reads write.** Plan 1's `withStores` (`:1194`, `:1405`, `:1622`) calls `Store.open` and
`Ledger.open`, both write-capable. `Ledger.open` execs DDL on every open. `Store.open`'s
corruption self-heal `rmSync`s the database and its sidecars, and its own comment says this
*"discards not just the disposable `items` cache but also whatever `ledger` rows the file
held."* `/api/ask/audit` additionally calls `syncProjection`, creating `.audit.db` on a GET.
The hook the UI claims to mirror uses `openReadOnlyChecked`
(`pre-tool-use.ts` · `store = Store.openReadOnlyChecked(ws.dbPath);` · ~278).

The honest restatement: **the UI is not read-only, it is mutator-free.**

### 2.4 Composed commands execute corpus content **[M]**

`quoteArg`'s `SAFE` class contains no `$` and no backtick, so any value carrying one takes the
double-quote branch, which escapes `\` and `"` only. Demonstrated:

```
double-quoted →  shell delivers:  Retry on SUBSTITUTED failures
single-quoted →  shell delivers:  Retry on $(echo SUBSTITUTED) failures
```

Item titles are free text through `create_item`. Ids parsed from disk **were** taken verbatim —
`validateExplicitId` has exactly one call site
(`core/mutate.ts` · `if (input.id !== undefined) validateExplicitId(input.id, '"id"');` · ~436),
on the explicit-mint path only, and the read boundary had no guard at all. **That half has since
been closed**: `parseItem` now runs the same grammar over an id arriving from disk
(`item.ts` · `validateLoadedId(id, filePath);` · ~489), and `validateLoadedId`'s docblock records
this finding — including the `DEC-$(echo SUBSTITUTED)` id demonstrated on 1.0.1 — as its reason.
**The title half is untouched**, and README §7 still documents the
shell-redirect-into-`.my_context/` route as open.

So: an agent authors a title, the UI composes
`mycontext review promote "$(…)" --yes`, the user clicks Copy and pastes — and the
substitution runs **in the user's interactive shell, where none of the fourteen deny rules
apply.** Those rules govern the agent's Bash tool, not the human's terminal.

**Removing writes from HTTP relocated them to the clipboard.** That is defensible; what is
not defensible is that the clipboard's contents are assembled from semi-trusted data by a
fifteen-line module the spec never mentions.

### 2.5 The flagship test cannot fail **[V]**

```ts
assert.deepEqual(JSON.parse(body), JSON.parse(JSON.stringify(select(items, ctx, config))));
```

Both sides derive from the same function and the same `ctx`. It stays green through every one
of: the wrong `seen` source (2.2), the missing `focus` (2.1), a candidate set differing from
the hook's, a `seen` passed to `session-start` where the real path passes none, and a rendered
preview missing the fallback, focus-error and load-error lines the hook appends.

> It is not comparing the UI to the product; it is comparing the UI to a second copy of the
> UI's own assumptions, and calling the agreement parity.

The spec cites this test twice and §8's risk table marks the risk it covers as *"Mitigated."*

### 2.6 The coverage map will hang on a real repository **[M]**

`globToRegExp` compiles `new RegExp(...)` fresh on every call and `matchesAnyGlob` calls it
inside `patterns.some(...)`. There is **zero caching** in `paths.ts`. Composed as §3
instructs — `matchesScope` per file per item — measured:

| Shape | Time |
|---|---|
| 5,000 items, 0% scoped, 500 files | 37 ms |
| 5,000 items, 100% scoped, 500 files | **4,169 ms** |
| 200 items, 30% scoped, 10,000 files | **960 ms** |
| the same, with a compiled-regex cache | 371 ms |

The second-to-last row is the *realistic* one — a modest corpus against a monorepo's file
count, which is exactly where mycontext is most valuable and exactly the screen §1 builds the
entire justification on. It has no cache, no budget and no perf test.

`/api/status`, the landing screen, inherits the same cost through `runChecks`.

---

## 3. The pattern under most of the rest: the API is honest, the view drops it

Nine fields are computed, **asserted in tests**, and rendered by no screen. **[R]**

| Field | Consequence |
|---|---|
| `pinned` | the coverage map colours a pinned-governed directory as an **uncovered gap** |
| `spilled` (detail pane) | "What would be injected" shows `full` only |
| `note` (all kinds but focus) | Watch shows four degraded runs identically |
| `projectionState`, `report.warm`, `globalLayerDrafts`, `fileWalkTruncated`, `governing.unchanged`, `agentEdits` names | disclosure computed, never shown |

The sharpest instance: `assert.deepEqual(body.pinned, [pinnedRule.id])` **proves the API is
honest while the screen colours that directory a gap.** Both plans exempt the DOM from
testing by explicit design, so this entire family is structurally invisible to the suite.

**The Watch `note` case is a regression of a fix shipped hours ago.** `detailCell` in
`audit.ts` was corrected on 2026-08-18 after four degraded runs printed identically; Plan 3's
feed renders `note` for `kind === 'focus'` only, and has no `hook` branch at all. Ask renders
it; Watch does not; nothing says Watch omitted it.

Two more in the same family, both **[R]**:

- **`watch.spills.none`** claims *"no spills recorded — everything selected has fit the
  budget"* while the window qualifier `drawn from the last {n} injection records` renders in
  the `else` branch only. The unconditional claim is made in precisely the branch that
  withholds its condition.
- **`preview.nothing`** — *"Nothing would be injected here."* — is the single rendering for
  five distinct causes, one of which is **a disabled or misspelled category**, the invariant's
  own first recorded Critical bug. `select` returns a zeroed `IndexSummary` on tool events, so
  the disclosure channel is structurally empty on exactly that screen.

---

## 4. Security

The HTTP work is genuinely good — Host validation, custom-header token, no CORS,
refuse-not-warn on non-loopback, and an idle definition that correctly excludes streams. The
findings are about where risk *moved* when writes left HTTP.

**The one control to add: a Content-Security-Policy header.** **[V]** Zero mentions of any
security header across all four documents. No CSP, no `nosniff`, no `Referrer-Policy`, no
`frame-ancestors`. Three lines, no dependency.

The chain that makes it matter: `127.0.0.1` is a **secure context**, so injected script gets
`navigator.clipboard.writeText` *and* `window.myctx.api` — it can silently replace what Copy
puts on the clipboard while the displayed `<code>` still shows what the user read. That
chains directly into §2.4. No live XSS was found, but the safety is discipline across ~1,500
hand-written lines with no test, no lint and no header behind it, and `escapeHtml` omits `"`
and `'`.

**Three §2 claims that do not hold** **[R]**:

- *"A nonce visible in a process list for ten seconds and already spent"* — it is **not spent**
  while it is on the command line. It is spent 1–10 seconds later, after the browser
  cold-starts and POSTs the exchange. A local process watching process creation redeems first
  and holds the real token for the server's lifetime, while the legitimate page renders *"the
  server has exited"* — misattributing theft as a crash.
- *"A stolen token buys reading a corpus the thief could read off disk anyway"* — fails for
  exactly the two attackers §2 itself introduces. A browser extension or page-resident script
  has **no filesystem access**. And it buys more than the corpus: `/api/coverage` returns up
  to 20,000 repository file paths, `/api/meta` returns branch and commit, and the
  audit-plus-ledger join is a behavioural timeline nothing else aggregates.
- **The idle promise is defeated by a visible tab.** `visibilityState` is `'visible'` for an
  unfocused or fully occluded window; Firefox and Safari do not report occlusion. A tab parked
  on a second monitor heartbeats forever.

**`statusline install` needs bounding.** A second `install --yes` overwrites its own backup,
so the reversibility promise holds for exactly one install. It writes
`~/.claude/settings.json` — the file holding the deny rules — and neither document says §7's
deny recipe must grow to cover `mycontext ui` and `mycontext statusline`.

---

## 5. CSS, RTL and i18n

**The conversion is much smaller than the spec fears — and the expensive part is not the part
the rule covers.** **[R]**

~14 physical-property rule-sites across ~180 lines of CSS; under two hours including
both-direction verification. The layout is already Grid and Flexbox, which mirror
automatically. Two sites need restructuring rather than renaming: `box-shadow: inset 2px 0 0`
has **no logical form at any spec level** and must be re-authored as `border-inline-start`,
with the transparent border on the base rule so toggling state doesn't shift content.

**What actually costs days:**

- **Bidi isolation is entirely absent** — zero `dir=`, `unicode-bidi` or `bdi` anywhere. The
  spec has a *policy* ("paths stay LTR") and no *technique*. The box-drawing CLI output is the
  sharp case: those glyphs are Unicode neutrals and will shatter under RTL without isolation.
- **The SVG ego-graph cannot be fixed in CSS at all.** Nine hand-positioned `translate()`
  calls; logical properties have no reach into SVG geometry. It needs coordinate mirroring at
  the render layer, and **no CSS audit will ever find it.**

**One elegant lever:** the existing `.m` class already marks technical content, so
`.m, code, .term { direction: ltr; unicode-bidi: isolate; }` covers most of the surface — with
two compound selectors (`.sel b`, `.strip .it b`) refactored to use it so there is one place
the rule lives.

**And the structural fix worth taking:** make the `t()` helper auto-wrap any argument typed as
a path, id, hash or SQL fragment in `<bdi dir="ltr">`, so isolation is a property of the
interpolation function rather than a discipline every contributor must remember at dozens of
call sites.

**The boundary should be an operational test, not a category list:** *anything a user would
copy-paste into a shell, a search box, or a `git`/`mycontext` command stays LTR and isolated —
because the test is not "is this technical" but "must this string round-trip byte-for-byte if
copied."*

---

## 6. Testing

**The plans fail an existing test on their first commit.** **[V]**
`test/no-bare-rmsync.test.ts` asserts *"no test file removes a tree with a bare rmSync —
removeTree is the one owner."* The three plans contain **59 `rmSync` occurrences and zero uses
of `removeTree`.** That helper exists because a spawned child pins its own cwd on Windows,
which is exactly what the UI's E2E harness does.

**`sanitizeSessionId` now has two incompatible implementations.** **[V]**
`ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~711 mangles with
a sha256 digest and **never returns null**; plan 3's new one has since shipped —
`statusline-tee.ts` · `export function sanitizeSessionId(id: string): string | null {` · ~41 —
and **returns null on refusal**. Same name, same repo, opposite failure mode —
and the UI joins the tee file, the seen file and audit records on that identifier.

**The replacement for the flagship test.** Assert byte-identity against **the hook**, not
against `select()`: drive `runPreToolUse()` in-process, compare the rendered text, over a
five-cell matrix — fresh session; after one hook call; with a focus set; with a subagent
payload; with an unparseable item file. *"Cells 2–5 are the ones that must be watched failing
before the endpoint is fixed. Cell 1 alone is worthless: it passes against every one of the
five broken implementations."*

**The single highest-value missing test:** a filesystem-snapshot assertion. Hash every path
under the repo root, exercise every registered route, hash again, assert the diff is empty
except an explicit allow-list. That is what makes "read-only" a checked property rather than a
reviewed one — and it is what would have caught §2.3.

**A devDependency was considered and refused**, correctly: a DOM shim verifies none of CSS
logical properties, RTL rendering, `visibilitychange` or `history.replaceState` — the four
things that would actually break — and Playwright puts a 200 MB binary behind a plugin whose
premise is dropping into any repo with no fetch.

---

## 7. For the owner to decide

Nothing below is decided by this document.

**7.1 Whether the three plans are patched or re-verified.** The panel's recommendation, which
I endorse: **re-verify, do not patch.** Their base commits are off-lineage, so the citation
errors are not a finite list to fix but a systematic unknown — every one of ~200 citations is
suspect until checked. §8 proposes the mechanical form.

**7.2 Whether `file:line` remains the citation form.** A line number degrades on any edit
above it. A quoted symbol name survives a refactor and breaks only when the *fact* changes —
which is the failure you actually want surfaced.

**7.3 Whether §0 becomes a standalone corrections log.** It is the single highest-value
section and the easiest to skip — and skipping it is exactly how the `seen` defect recurred
one layer down after §0 had already corrected it once.

**7.4 Scope.** Every screen passes §4's grading and every §9 decision held under inspection.
The open question is release sequencing, not justification. The UI/UX review's recommendation:
**Core, then Work with stream-driven refresh, then Configure**; Watch, Ask, Doctor, Decay,
Relations and Learn in a second wave.

**7.5 The landing screen.** `route()` defaults to Status — the one screen §4 grades as a
⚠️ exception because *"a table is a terminal's home ground."* The first five seconds of the
product show the screen whose own authors concede a terminal does it just as well.

---

## 8. Recommended actions, concretely

### 8.1 The plans — a re-verification pass before any implementation

Not a rewrite. A mechanical pass, per plan:

1. Rebase the plan's stated base onto `master` and record the real base commit.
2. For every `file:line` in its "Verified facts" table: resolve it, and replace it with
   **symbol name + a quoted fragment** plus the current line as a hint.
3. Delete every fact that no longer holds, and record what replaced it — the §0 discipline,
   applied to the plans.
4. Re-run each plan's Task-1 preconditions against `master`.

**Known corrections to fold in** (all **[V]** unless marked): `linkItems`/`unlinkItems` →
`relations.ts`; `STATUSES` → `validate.ts`; `RELATION_TYPES` → `relations.ts`;
`fieldsOf` is `changedFields` and is **exported**, so plan 2 Task 1's "delete it" would break two
consumers **[R]** — it has since left `revision.ts` for
`core/revision-log.ts` · `export function changedFields(changes: RevisionChanges): RevisionField[] {` · ~394,
re-exported from `revision.ts` so no importer notices; `readFrom` was already exported — as
`readSegmentFrom` when this was written, and as
`core/audit-db.ts` · `export function readCompleteLines(file: string, offset: number): { text: string; consumed: number } {` · ~185 since **[R]**;
`trustedStatus` lives in
`core/trust.ts` · `export function trustedStatus(origin: Origin, tier: Tier, requested: Status): Status {` · ~267,
not in `mutate.ts` — the spec's §2 cites it as `mutate.ts:376` twice.

### 8.2 The spec — six amendments

| § | Change |
|---|---|
| §3 | Add `focus` to the function-and-parameter contract. The omission originates here and propagates into plan 1's endpoint. |
| §3 / §9.5 | State that the seen file is keyed `session_id` + `agent_id`, that `Ledger.seen` is a replayed projection, and that the preview is of the **parent thread**. |
| §2 | Restate the guarantee as *mutator-free*, not *read-only*; add the CSP/header requirement; state what happens on page reload. |
| §5 | Remove the quoted README sentence — it does not exist in the file, and its fact is now false. Retire the two dead deferrals (the hot-path cost is measured; `tokens` has merged). |
| §4b | Close the `prompt_id` loop: plan 3 re-verified that Claude Code now carries one and mycontext's `HookInput` does not. |
| header | "Target: v2.0, after 1.0.0 ships / pending user review" — 1.0.0 and 1.0.1 have both shipped. |

Also: the sibling `never-miss-an-injection-design.md` header still reads *"Nothing here is
implemented."* It shipped in 1.0.0.

### 8.3 The mockup — regenerate, and fix its audit first

The mockup is the right *kind* of artifact and its self-audit is the right *shape*. Both need
work before either is used as a template.

- **Fix the audit's own false claim** — it lists the 0.55 ms p95 among fabricated numbers; it
  is real and shipped (`audit-latency.perf.ts` · `**It is small.** ~0.55 ms against a 50 ms ceiling` · ~19). **[V]** The document written to prevent
  asserting properties the code lacks asserted the absence of one it has.
- **Regenerate the CSS** against the logical-property rule, with the two `box-shadow` sites
  restructured, `.m`-based bidi isolation, and `light-dark()` collapsing the duplicated
  17-token dark block.
- **Add what the spec requires and the mockup lacks**: a Hebrew rendering and language switch,
  the session-selector contract, focus records in the audit stream, the bridge's conditional
  context number, server lifecycle states, a real print stylesheet.
- **Remove or label what it shows and the spec does not commit to**: the global search box and
  ⌘K (decoration with no handler), toasts, the Volume chart on a Core screen.
- **Add the empty states** — a fresh `mycontext init` currently renders the coverage tree as a
  wall of dashed warning dots for what is a completely normal state.
- **Mirror the SVG graph** at the render layer, since CSS cannot reach it.

### 8.4 Fixes worth making in shipped code, independent of v2.0

- Cache compiled globs in `paths.ts` — 2.6× to 3× on the measured shapes, and it benefits
  `doctor` today. **[M]**
- Apply the id grammar on the disk-load path, or inside any command composition. **[V]**
- Add a `statusline` perf test — it is on Claude Code's per-message path and is unmeasured.

---

## 9. What the panel confirmed as sound

A review that reports only defects misrepresents what it read.

- **Every §9 pinned decision held** under direct code inspection. The no-writes rule, the
  compose-don't-promote rule, `matchesScope` over `matchesAnyGlob`, JSONL-truth, and the
  session selector are all correctly specified and correctly carried into the plans.
- **The three-way plan split is the right seam**, and plan 3's separation is a genuine hard
  dependency, not scope management.
- **The live-watch design is one of the better-thought-through parts** — SSE over
  token-carrying `fetch` because `EventSource` cannot send the header; unref'd interval;
  cleared on close; excluded from `idle.touch()`; resync-not-replay on rotation.
- **Polling over `fs.watch` is the right call** (measured µs), **no-bundler ES modules are fine
  on loopback** (0.4 ms/file), and **audit append is flat** regardless of log size. That is
  work nobody now has to do. **[M]**
- **The read-only decision survived security review on its merits**, with the rejected
  alternative correctly rejected.
- **The compose-and-paste treatment, the review queue's per-field staleness, the ego-graph
  constraints, the "as of last response" labelling and the recorded exceptions** are all
  faithful in the mockup and worth building from.
- **No orphaned decision and no plan-invented screen.** Coverage between spec and plans is
  complete.

---

## 10. What this pass did not cover

No code was executed from the proposed UI — it does not exist. Browser behaviour, real RTL
rendering, and actual bidi output were not observed. No review covered accessibility beyond
the bidi and `lang`/`dir` requirements. Nothing here measures the UI against real user
behaviour, because there is no UI.

And one honest note on this document's predecessor: the coordinator's first pass at reviewing
this corpus raised three "load-bearing decisions" that §9.5, §4 and §3 had already decided,
because it read §0, §2 and a list of headings rather than the documents. That failure is
recorded in the companion addendum's §6. The ten reviews consolidated here were briefed to
read everything, and the difference in what they found is the argument for doing so.
