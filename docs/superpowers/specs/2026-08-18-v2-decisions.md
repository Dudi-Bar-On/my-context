# v2.0 — decisions taken on the expert review

**Date:** 2026-08-18
**Status:** decided by the owner, one question at a time
**Decides:** the seven open questions in `2026-08-18-v2-expert-review-addendum.md` §7
**Governs:** the amendment of `2026-08-16-web-ui-design.md`, the re-verification of the three
web-UI plans, the regeneration of `docs/design/web-ui-mockup.{md,html}`, and the contents of a
`1.0.2` release

---

## 0. What this document is

§7 of the expert review addendum ends with *"Nothing below is decided by this document."* This
one decides it. Each section states the question as §7 put it, the decision, and the reasoning
that produced it — including, where it applies, the evidence gathered while the question was on
the table.

Six findings below were established in the course of taking these decisions and are **new since
the expert review**. They are marked **[new]** and carry the usual provenance marks: **[V]**
verified against source, **[M]** measured or executed, **[R]** reasoned.

---

## 1. The plans are re-verified, and the spec is amended first

**§7.1 asked:** are the three plans patched, or re-verified?

**Decided: re-verified — and §8.2's spec amendments land before the plan passes begin.**

The panel recommended re-verification because the plans' base commits are off-lineage, making
citation errors a systematic unknown rather than a finite list. Two independent checks taken
while this question was open support that and sharpen it:

**[new] [V] The drift is large and lands in unrelated code.** The first two rows sampled from
plan 1's own *Verified facts* table:

| Plan 1 claims | Resolved at the HEAD of 2026-08-18 | Off by | Resolves today |
|---|---|---|---|
| `select(items, ctx, config): Selection` → `select.ts:324` | `select.ts:460` | 136 lines | `select.ts` · `export function select(` · ~1364 |
| `matchesScope(item, target, config)` → `select.ts:149` | `select.ts:191` | 42 lines | `select.ts` · `export function matchesScope(` · ~575 |

Neither cited line is near its subject; both land mid-comment in unrelated blocks. These were
the first two rows read, not the result of hunting. **The bare line numbers in the first two
columns are quoted evidence, not citations** — they are the form this section is about, and the
fourth column is the same two facts written in the form §2 decides on. That column has since
moved twice more, which is the argument in one line.

**[new] [M] The corpus carries 186 citations**, not the ~200 estimated: 58 in plan 1, 94 in
plan 2, 34 in plan 3.

**The ordering is the part §8 did not state.** §8.2's first spec amendment adds `focus` to the
function-and-parameter contract, and says of the omission that *"it originates here and
propagates into plan 1's endpoint."* Re-verifying plan 1 first would therefore carefully confirm
citations for an endpoint about to gain a parameter. Spec first.

---

## 2. Citations become symbol + verbatim fragment, and a checker enforces them

**§7.2 asked:** does `file:line` remain the citation form?

**Decided: no — symbol name + a verbatim source fragment + a `~line` hint, and a script that
resolves every fragment and fails when one does not.**

§8.1 step 2 already prescribed the first half. The checker is an addition to it, taken on this
reasoning: every option that changes only the notation fixes the present instance and leaves the
next drift as silent as this one was. The whole corpus went stale without any artifact noticing.

The project already holds the general form of this rule — `INV-nothing-is-dropped-silently`.
A citation that quietly stops resolving is that invariant's own failure, one layer up in the
documentation.

**The form:**

| Fact | Where verified |
|---|---|
| `select(items, ctx, config): Selection` | `select.ts` · `export function select(` · ~1364 |

**The constraint this imposes:** the quoted fragment must be **verbatim source**, never a
paraphrase, or the checker cannot resolve it. That is a real restriction on how the tables are
written and it is the price of enforcement.

**The script:** `scripts/verify-citations.ts`, run as `npm run verify:citations`. Zero
dependencies, native TS, consistent with the project's standing constraints. It reads each
plan's *Verified facts* table, resolves every fragment in the named file, exits non-zero naming
any row that misses, and rewrites the `~line` hint in place when a fragment has merely moved.
It runs locally, so the exhausted Actions quota does not affect it.

---

## 3. §0 stays where it is, and gains a `Class` column

**§7.3 asked:** does §0 become a standalone corrections log?

**Decided: no. §0 remains section zero of the spec and gains a fourth column naming the class
of error each row is an instance of. That form is what §8.1 step 3 replicates into each plan.**

§7.3's stated reason for promoting it was that it is *"the single highest-value section and the
easiest to skip."* That reason does not survive inspection, and the mechanism of the recurrence
it cites is different from the one it names.

**[new] [V] §0 did not fail by being skipped. It failed by recording an instance.** Row 6 of
its third-pass table reads: *"`/api/select?event=tool&path=X` … omits `seen`, so it previews a
different selection and a different spill set."* Critical 2.1 is that the same endpoint **also
never passes `focus`** — the identical defect, one parameter over. A reader who had read §0
attentively would still not have caught `focus`, because §0 recorded *"`seen` is missing"* and
not *"this endpoint must accept every narrowing input `select()` consumes."*

Relocating a section does not change what its rows contain. And a separate file is, if
anything, easier to skip than section zero of the document already open.

**The form, with the fourth column, applied to the row in question:**

| Was | Is | Class | Where |
|---|---|---|---|
| `/api/select` omits `seen` | The endpoint takes a session | **The preview endpoint must accept every narrowing input `select()` consumes** | §3, §4 |

Written that way in the third pass, the class column names `focus` before anyone looks for it.

**Scope of the change:** one column; the eleven existing rows backfilled; and the same four
columns required of every `§0` that §8.1 step 3 creates in a plan.

---

## 4. Sequencing defers tasks; it does not re-cut the plans

**§7.4 asked:** release sequencing.

**Decided: keep the three-plan cut. Reach the UI/UX review's value ordering by deferring three
plan-1 tasks, never by re-cutting.**

| Wave | Contents |
|---|---|
| **1** | Plan 1 Tasks 1–17, plus the coverage map from Task 18 |
| **2** | Plan 2 whole — the palette, then Work (T11), then Configure (T13) |
| **3** | Plan 3 whole, plus plan 1's deferred Tasks 18 (ego graph) and 19 (Report, Learn) |

**Why not adopt the UI/UX sequencing as written.** It cuts across the plan boundaries in two
places that the recommendation does not acknowledge:

- **[new] [V]** It places *Learn, Doctor, Decay and Relations* in a second wave, but Learn and
  Report are plan 1 **Task 19**, and the doctor/decay/coverage/graph read models are plan 1
  **Tasks 10–11**. Following it literally re-cuts plan 1.
- **[new] [V]** It specifies *"Work with stream-driven refresh"*, but the stream route and
  `window.myctx.stream()` are plan 3 **Tasks 6 and 11**. That pulls a plan-3 dependency into
  wave 2.

**The governing reason for deferral over re-cutting:** deferring a task does not invalidate a
re-verified plan. Re-cutting does — and under Decision 1 the re-verification is about to happen.
Re-cutting would have to precede it, roughly doubling the cost of both.

**The accepted divergence, stated as a divergence:** Work ships in wave 2 **without**
stream-driven refresh. It gains the stream in wave 3 with the rest of plan 3.

**[new] [V] One mismatch this exposed, which neither document reconciles:** spec §4 lists the
scope coverage map under **Core**; plan 1 implements it in **Task 18, Navigate**. Wave 1 takes
the spec's grouping — the coverage map ships in wave 1, the ego graph does not. §8.2 should
record the regrouping so the two documents stop disagreeing.

---

## 5. The landing screen is the injection preview

**§7.5 asked:** `route()` defaults to Status — the one screen §4 grades as an exception.

**Decided: `route()` defaults to `preview`, at `event=session-start` on the most recent
session, rendering with no user input.**

This decision stopped being a matter of taste when Decision 4 was taken.

**[new] [V] In wave 1, the current default target does not exist.** Plan 1's File Structure
annotates `screens/status.js` as *"Report: landing screen (the recorded exception)"*, and its
`NAV` groups it as `['nav.report', ['status', 'doctor', 'decay']]` — all built by **Task 19**,
which wave 1 defers. Plan 1's `route()` hard-defaults to it twice:

```js
const name = (location.hash.replace(/^#\//, '') || 'status');
const loader = SCREENS[name] || SCREENS.status;
```

The wave-1 screens are `preview`, `simulate`, `injected` and `coverage`. The landing screen has
to change regardless of preference.

**Why the preview, and why it needs no input.** §4 calls Core *"the reason to build it"* and
grades the injection preview ✅, noting *"this screen is wrong in a way nobody would notice
without it."* The objection that it requires a file and a session before it can render does not
hold: `SelectContext` declares `path?` optional, and §9 already pins one global session selector
defaulting to `recentSessions(1)[0]`. So the first paint is *"exactly what Claude got at the
start of your most recent session,"* with the budget bar and the spill set, before the user has
touched anything. Choosing a file then refines that view rather than being a precondition for it.

**Empty state required:** no sessions yet → *"run Claude once, or pick a file to preview a tool
event."* Not the wall of dashed warning dots §8.3 already records against the coverage map.

**Consequence for §4:** `status`'s ⚠️ Exception is currently justified by *"kept because it is
the landing screen and something must be."* It is no longer the landing screen, so that
justification is spent. §8.2 must either re-justify the screen on its own merits or drop it.

---

## 6. A `1.0.2`, carrying three shipped fixes

**§7.6 asked:** does `fix/audit-note-visible` warrant a `1.0.2`?

**Decided: yes, and it is not the most important thing in it.**

| | Change | Class |
|---|---|---|
| 1 | `mycontext audit` marks a record carrying a note, and prints a legend when any row is marked | already committed on `fix/audit-note-visible` |
| 2 | Ids read from disk are checked against `ID_GRAMMAR` before they can be echoed into a copyable command | **[new] [M]** — see below |
| 3 | Compiled globs are cached in `paths.ts` | §8.4, 2.6–3× **[M]**, benefits `doctor` today |
| 4 | ~~A `statusline` perf test~~ — **withdrawn from this release; see below** | §8.4, misfiled |

**Correction to §8.4, found while implementing this.** Its third item — *"Add a `statusline` perf test — it is on Claude Code's per-message path and is unmeasured"* — is listed under *fixes worth making in shipped code, independent of v2.0*. **There is no `statusline` command in shipped code.** It is plan 3 **Task 4**, unbuilt. The requirement is right and its placement is wrong: it belongs in plan 3 Task 4 as a condition of that task, not in a patch release. Recorded in plan 3 rather than dropped, because the reason it was raised — a per-message path shipping unmeasured — is exactly the thing a task can forget.

**And the glob-cache figure is larger than §8.4 recorded.** §8.4 says 2.6× to 3×. Measured here on a monorepo-shaped input — 4,000 paths against 12 authored scope globs — **28.0 ms → ~2.7 ms, about tenfold**. Not a disagreement: the gain scales with subjects-per-pattern, so a review measuring fewer paths per pattern correctly saw less. Neither figure generalises, which is why the shipped perf test asserts a ceiling rather than a ratio.

All are PATCH under `VERSIONING.md` — *"the program is made to do what it already said it did."*

### 6.1 The finding that changed this decision **[new] [M]**

Critical 2.4 describes composed commands executing corpus content, and rests on `quoteArg`'s
`SAFE` class. Checking whether that reaches shipped code produced a split result:

**[V] `quoteArg` does not exist in `src/` or `test/`.** It is purely plan 2's `lib/command.js`.
The shell-substitution half of 2.4 is a v2.0 design defect, not a shipped one.

**[M] The shipped half is real, and needs no `quoteArg` at all.** Demonstrated end to end in a
throwaway workspace on `1.0.1`:

1. `validateExplicitId` has exactly one call site — `mutate.ts` · `if (input.id !== undefined) validateExplicitId(input.id,` · ~436, the explicit-mint path.
   `item.ts` takes the id straight off the file — `item.ts` · `const id = requireString(fm, rawBlock, 'id');` · ~488 — with no such guard.
2. A file written directly into `.my_context/items/decision/` with `id: DEC-$(echo PWNED)` and
   **no `checksum:` field at all** loads with no error and appears in `mycontext list`. The
   checksum guard only fires on files the CLI itself wrote and someone later edited — against
   README §7's documented shell-redirect route it does nothing.
3. `mycontext supersede` then printed, verbatim:

   ```
   nothing will govern in DEC-the-old-way's place until that changes — promote it
   with `mycontext review promote DEC-$(echo SUBSTITUTED)`
   ```

A copy-paste-ready command carrying an unvalidated id read from disk. The substitution runs in
the user's own interactive shell, where none of the fourteen deny rules apply — they govern the
agent's Bash tool, not the human's terminal.

### 6.2 The honest edge, which this release must state

Under `VERSIONING.md`: *"a `PATCH` here can still change what a session sees … Anything in that
class is called out in `CHANGELOG.md` under **Fixed** with what changes in practice — a version
number cannot carry that, so the changelog has to."*

An item whose id falls outside `[A-Za-z0-9][A-Za-z0-9._-]*` loads today and will stop loading.
That is correct and it is still a surprise on a Tuesday. It goes in the changelog in those terms.

---

## 7. The id grammar is applied at the load boundary

**Decided: `item.ts` validates the id against `ID_GRAMMAR` when reading from disk. A violating
item is excluded and its file named; the rest of the corpus still loads.**

§8.4 offered *"the disk-load path, or inside any command composition."* Two facts decided it.

**[new] [V] Composition is not two sites — it is roughly fifteen**, none behind a common
funnel: `cli/commands/edit.ts` ×5, `cli/commands/review.ts` ×4, `cli/commands/supersede.ts`,
`core/mutate.ts` ×4, `core/revision.ts` ×2, `core/trust.ts`, `doctor/checks.ts` ×2,
`ingest/request.ts`, `lesson/derive.ts` ×3. Patching them is fifteen edits and a standing bet
that no sixteenth is ever written.

**[V] The codebase already states the principle, in the comment above `ID_GRAMMAR` itself:**

> *"This is insurance against the surface that forwards one next, **taken at the boundary rather
> than at whichever future call site first does it**."*

The boundary reasoning was already accepted; it had simply never been applied to the **read**
boundary, because the threat modelled there was path traversal on write — for which the comment
is right to say *"it is not an exploit."* The paste-into-shell path is a different threat, and
it is reachable today.

**The comment's own objection does not apply to this change.** It declines a stricter rule
because *"the slug grammar would additionally reject ids this system already accepts from disk —
an uppercase or underscored id in a hand-authored or older corpus."* That objection is to
`slugify`'s grammar. `ID_GRAMMAR` is `/^[A-Za-z0-9][A-Za-z0-9._-]*$/` — it **accepts** uppercase,
underscore and dot, and rejects `$`, backtick, space, parentheses, path separators and `..`.
It rejects the dangerous shapes and keeps the legacy ones.

**Failure behaviour:** per-item, not per-corpus. One unusable id must not make a workspace
unreadable. This follows the shape the checksum-mismatch error already uses — reported per file,
loading continues — with the difference that the item is **excluded** rather than admitted,
because the id is the thing that is dangerous.

---

## 8. The resulting work order

1. **Spec** — `2026-08-16-web-ui-design.md`: §8.2's six amendments, plus the §0 `Class` column
   and eleven backfilled rows (Decision 3), the Core/Navigate coverage-map regrouping
   (Decision 4), and the landing-screen change with `status`'s exception re-justified or
   dropped (Decision 5).
2. **`scripts/verify-citations.ts`** and its npm script, written before the plan passes so each
   pass can be checked as it lands (Decision 2).
3. **Plans** — §8.1's four-step pass on each, in wave order: plan 1, plan 2, plan 3. Each gains
   a `§0` in the four-column form. Plan 1's two NUL bytes at line 2338 are removed in the same
   pass — **[new] [V]** they make `grep` treat the file as binary and truncate its own output.
4. **Mockup** — §8.3: fix its self-audit's false claim about the 0.55 ms p95 first, then
   regenerate against the decisions above, landing on the injection preview.
5. **`1.0.2`** — the four changes in Decision 6, per `VERSIONING.md § Cutting a release`, with
   the honest-edge entry of §6.2.

Items 1–4 are v2.0 documentation and block no shipped code. Item 5 is independent of all of them
and can proceed in parallel.

---

## 9. What these decisions do not settle

- **Every §9 pinned decision stands.** The panel confirmed each on its merits; nothing here
  reopens one.
- **The re-verification will find things.** Decision 1 was taken precisely because the citation
  errors are a systematic unknown; the passes are expected to produce corrections, and those go
  into each plan's `§0` in the four-column form, not into this document.
- **Whether the mockup's regeneration changes any screen's grading** is a question for the
  regenerated mockup, not for this document.
- **Wave 2 and wave 3 scheduling** — Decision 4 fixes the contents and the order, not the dates.
