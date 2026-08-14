# Task 13 report: Decay reporting from the ledger

## What was implemented

- `src/core/decay.ts` — pure `computeDecay(input)`, plus `DecayRow`/`DecayReport`/`DecayInput` types. Buckets eligible, normative items into `cold` (not injected in the window), `warm` (injected in the window), and `unscoped` (no scope and no `always: true`, so never JIT-injectable — reported separately, not as decay). Sorts each bucket coldest-first (never-used, then oldest `lastUsed`, then id).
- `src/cli/commands/decay.ts` — the `decay` command. Opens `Ledger` and a `MutationContext`, computes the report, and prints three sections plus a "cold mostly means new" caveat when `sessionsRecorded < window`. Registered via `registerCommand`.
- `src/cli/commands/index.ts` — added `import './decay.ts';`.
- `test/core/decay.test.ts` — 10 tests on the pure function, taken verbatim from the brief.
- `test/cli/decay.test.ts` — the brief's 7 CLI tests plus 3 I added (below) for a total of 10.

## TDD evidence

1. `node --test test/core/decay.test.ts` before `src/core/decay.ts` existed: **FAIL**, `ERR_MODULE_NOT_FOUND` on `src/core/decay.ts` — correct failure reason.
2. Implemented `src/core/decay.ts` verbatim from the brief. Re-ran: **10/10 pass**.
3. `node --test test/cli/decay.test.ts` before the command was registered: **FAIL** — `my_context: unknown command "decay"` (verified via the `--sessions`-rejection test surfacing the usage text instead) — correct failure reason.
4. Implemented `src/cli/commands/decay.ts` per the brief, wired into `index.ts`. Re-ran: initial 7/7 pass, then grew to 10/10 after the two fixes below.
5. `npx tsc --noEmit`: clean.
6. `npm test`: **1056/1056** (baseline 1036 + 20 new: 10 core + 10 CLI).

## Pre-flight defects: both already absent from this brief

The brief I was handed does **not** contain either defect described in the task:

1. No test named "the window is clamped to the number of sessions actually recorded" exists. The actual test ("the requested window and the recorded session count are reported separately") asserts `window === 20` and `sessionsRecorded === 4` as two independent, honestly-reported values — matching its name, and matching `computeDecay`'s behavior (nothing clamps). Confirmed by running it: passes, and I mutation-tested that neither field is silently coerced to the other (see below).
2. The CLI test ("an item injected in the window drops out of the cold list") already uses `assert.equal(out.includes('CONST-a'), false)` with an explanatory comment about why an anchored `/^CONST-a/m` would never match — not the broken regex. I ran this test as written and it correctly fails when the guard is mutated away (see mutation results).

So both defects were already corrected upstream of the brief I read; nothing to fix there.

## A third defect I found and fixed: the exit code broke F2

The brief's own `src/cli/commands/decay.ts` returns `errors.length ? 1 : 0` in both success paths (empty-report and full-report), after `emitLoadErrors`. That directly contradicts the plan invariant this task was told not to undo: *"Only `status` and `doctor` exit non-zero on corpus load errors; every other command reports and exits 0."* Every sibling command (`review.ts`, `lesson.ts`, `ingest.ts`) follows F2 and always returns 0 in that position, with a comment citing the rule.

I changed both `return errors.length ? 1 : 0;` sites in `src/cli/commands/decay.ts` to `return 0;`, added a comment citing F2, and added two new CLI tests (`plantUnrelatedCorruptItem`, mirroring `test/cli/review.test.ts`'s fixture) that exercise an unrelated corrupt item file through both the empty-report and full-report paths, asserting exit code 0 and that the load error is still printed. I confirmed via mutation (reintroducing `errors.length ? 1 : 0`) that both new tests fail without the fix and pass with it.

## Mutation results (all guards killed)

Core (`src/core/decay.ts`):
| Mutant | Result |
|---|---|
| Remove `isEligible` filter | killed — draft/superseded/disabled-category items leaked into buckets |
| Remove normative-tier filter | killed — a `lesson`-type item leaked in |
| Drop the `!item.always &&` half of the unscoped condition | killed — an `always:true`, no-scope item wrongly landed in `unscoped` |
| Flip `recent.has(item.id) ? warm : cold` | killed — warm/cold buckets swapped, crashing/failing multiple tests |
| Flip the `lastUsed === null` ordering branches in `byColdest` | killed — sort order test failed |

CLI (`src/cli/commands/decay.ts`):
| Mutant | Result |
|---|---|
| Disable `--sessions` numeric/positivity validation | killed — SQLite `datatype mismatch` surfaced instead of the friendly message |
| Remove `hasFlag(args, 'all')` gate on the warm section | killed — warm item leaked into non-`--all` output |
| Disable the "nothing to report" empty-check | killed — empty-corpus test expected `/nothing/i`, got the full report header instead |
| Remove the `sessionsRecorded < window` caveat line | **initially survived** — no test asserted on it. I added `'when the ledger holds fewer sessions than the requested window, the report says so'`, re-ran the mutant: now killed. |
| Reintroduce `errors.length ? 1 : 0` (both sites) | killed by the two new F2 tests (see above) |

All mutants I introduced across both files ended up killed; the two gaps found (the caveat line, the F2 exit code) were closed with new tests before finishing.

## What the ledger genuinely supports concluding — versus what the report might imply

This is the part I want to flag explicitly, per the task's request.

**What the ledger actually knows:** an item id was *injected* into a session's context at a given tier, at a given timestamp. That's it.

**What "cold" in this report does NOT mean, and where a reader could over-conclude:**

- **Injection ≠ use.** The ledger records that an item was placed in front of the model, not that the model read it, needed it, or acted on it. A "warm" item injected 7 times in the last 20 sessions could still be dead weight the model has ignored every time; the report has no way to distinguish "used" from "merely present." Conversely a "cold" item that was actually relied on via manual `show`/search rather than auto-injection (e.g. a human reads it directly from the Markdown, or an MCP `get_item` call) leaves no ledger trace at all and will read as cold regardless of its real value.
- **`always: true` items are permanently warm regardless of relevance.** They're injected every session by construction, so they can never appear in `cold` — the report's `computeDecay` correctly puts them in `cold` only when genuinely absent from `recentlyUsed`, but in the real CLI wiring an `always: true` item will virtually always be in every session's ledger rows, meaning "warm" for an always-pinned item conveys nothing about whether it's still useful — it says "pinned," not "used." The report doesn't (and structurally can't) distinguish "warm because pinned" from "warm because actually needed."
- **Unscoped items are a config gap, not decay** — the brief already gets this right by giving them their own bucket rather than folding them into `cold`. I kept this separation and it's the report's one clear piece of epistemic honesty: it does not claim "unscoped = unused," it says "unscoped = cannot even be evaluated for decay."
- **A brand-new item has no history, and looks identical to a genuinely abandoned one.** `computeDecay` gives both `useCount: 0, lastUsed: null` and sorts them first (coldest). The command's caveat (`only N recorded, so "cold" mostly means "new"`) partially addresses this, but only when `sessionsRecorded < window` — a corpus that's been running for 200 sessions with an item added yesterday will show that item as maximally cold with no textual distinction from an item nobody has touched in a year. The report has no "item age" or "days since creation" signal to separate "too new to judge" from "actually abandoned," even once the ledger itself has plenty of history.
- **The window is sessions, not calendar time**, and a "session" here is whatever string a hook or test passed as `session_id` — nothing in this task validates that sessions are evenly spaced, meaningfully bounded, or non-synthetic (a burst of 20 short test sessions in one afternoon looks identical, window-wise, to 20 sessions over six months).

**Net:** the command's own copy is appropriately hedged where it can be (the "cold mostly means new" line, the separate unscoped bucket, the "candidates for supersession or re-scoping" wording rather than "delete these"). But nothing in the report or its output distinguishes "provably unused" from "never had the chance to be used, or used a channel the ledger doesn't see." A user who reads "cold (12) — candidates for supersession" and starts superseding items without checking `always`/JIT eligibility per item and without corroborating against actual git/session history could retire load-bearing knowledge that simply wasn't exercised via the paths the ledger tracks. I did not change the report's wording beyond the brief's own hedges (adding more caveats felt out of scope for a task defined as "read the ledger, bucket the items"), but this is the concrete "false confidence" risk to flag for whoever reviews the UX copy next.

## Files touched

- `src/core/decay.ts` (new)
- `src/cli/commands/decay.ts` (new, with the F2 exit-code fix vs. the brief)
- `src/cli/commands/index.ts` (added `import './decay.ts';`)
- `test/core/decay.test.ts` (new, verbatim from brief)
- `test/cli/decay.test.ts` (new: brief's 7 tests + 3 added — the sessions-caveat test and two F2/load-error tests)

## Concerns for review

1. The brief's own reference implementation for `src/cli/commands/decay.ts` violates the plan's stated F2 invariant (exits 1 on an unrelated corpus load error). I fixed it in the delivered code; flagging in case the brief itself needs correcting for future re-reads of this plan.
2. The epistemic gap described above (injection vs. use, pinned-vs-relevant, new-vs-abandoned) is inherent to what the ledger tracks, not something this task's scope lets me close by writing different code — it would need either a new signal (e.g., explicit "item age" from git or frontmatter `validFrom`) or copy changes elsewhere. Noting it rather than silently shipping a report that could read as more authoritative than it is.

---

## Round 2 (post-review): the copy fix WAS in scope, plus three test gaps, plus the structural F2 guard

The review confirmed the computation, ordering, and F2 fix were sound, and that my epistemic analysis was accurate — but scored me wrong for treating the fix as out of scope. It wasn't: it's three lines of report copy in the one file this task owns, and the reviewer demonstrated the cost directly by running `decay` against this repo's own corpus — 25 items listed as "candidates for supersession or re-scoping", including `CONST-zero-runtime-dependencies` and `RULE-erasable-syntax-only`, both enforced by CI on this branch. Below is everything addressed in response, all in `src/cli/commands/decay.ts` and its tests (`src/core/decay.ts`, the pure computation, was untouched — it was already correct).

### CRITICAL #1 — the epistemic hedge was gated on `sessionsRecorded < window`, suppressed exactly when trust was highest

Fixed by making the hedge **unconditional** — it now prints on every non-empty report, regardless of ledger maturity — and by strengthening its wording and adding an explicit "do not act on this alone" line:

```
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused —
  the ledger records injection, not reading or reliance, so a new item, and any item
  consulted via `show`, MCP `get_item`, or the Markdown file directly, look exactly like an
  abandoned one here.
  Do not supersede or deprecate anything below on this list alone — verify real usage first.
```

The old `(only N recorded, so "cold" mostly means "new")` line still prints, but now as an ADDITIONAL detail when the ledger is genuinely immature, not the only hedge that exists.

New test: `'the ledger-records-injection-not-use hedge is unconditional, not suppressed once the ledger looks mature'` — seeds 10 sessions against a 5-session window (`sessionsRecorded(10) >= window(5)`, i.e. "mature" by the old gating condition), asserts the hedge and the "do not act alone" line both still appear, and asserts the OLD gated line does NOT appear. Mutation: re-gating the hedge behind `sessionsRecorded < window` — killed, this new test fails immediately.

### CRITICAL #2 — `cold: none — every scoped item activated inside the window.` was false on an empty ledger with zero scoped items, and used "activated" (the ledger only knows "injected")

Fixed by splitting the message on whether anything was actually measurable:

```ts
out(report.warm.length > 0
  ? 'cold: none — every scoped item was injected inside the window.'
  : 'cold: none — no scoped, normative item exists yet to measure.');
```

New tests: `'"cold: none" distinguishes "every scoped item is warm" from "no scoped item exists at all"'` and `'"cold: none" on a corpus with zero scoped items says so, not "activated"'`. Mutation results:
- Replacing the whole `out(...)` call with `out('bananas')` — killed (both new tests fail).
- Flipping the condition to `report.warm.length >= 0` (always true, so the "no scoped item" branch becomes unreachable) — killed (the zero-scoped-items test fails).

This closes what the reviewer called "occurrence #20 of this project's characteristic defect" — an untested string a mutant could freely rewrite.

### IMPORTANT #3 — `--sessions` had no behavioural test; `recentSessions(window)` could become `recentSessions(9999)` with the suite green

New test: `'decay --sessions actually narrows which sessions count as recent, not just the printed number'` — seeds 3 sessions with an item injected only in the oldest, asserts it is `cold` under `--sessions 1` and `warm` (via `--all`) under `--sessions 3`. Mutation: `ledger.recentSessions(window)` → `ledger.recentSessions(9999)` — killed (the item is warm under both window values, so the narrow-window assertion fails).

### IMPORTANT #4 — no assertion on `useCount`/`lastUsed` rendering

New test: `'the cold list prints the exact use count and date, not an off-by-one or truncated one'` — records an item 3 times at known timestamps, asserts the exact substring `3x, last 2026-06-01`. Mutation results:
- `${row.useCount}x` → `${row.useCount + 1}x` — killed (`4x` printed, assertion expects `3x`).
- `row.lastUsed.slice(0, 10)` → `row.lastUsed.slice(0, 4)` — killed (`2026` printed, assertion expects the full date).

### MINOR — `padEnd(44)` column collision, and `Ledger.open` outside the `try`

- Added `col(s, width)`: pads to `width` normally, but appends a plain two-space gap instead of truncating/colliding when `s.length >= width`. New test: `'a long id gets its own column gap instead of colliding with the type column'`, using an id longer than 44 chars. Mutation: reverting `col` to a bare `s.padEnd(width)` — killed, reproduces exactly the real-corpus symptom the reviewer flagged (`INV-a-validator...constraint` glued together with no gap).
- Moved `Ledger.open(ws.dbPath)` inside the same `try` that already wraps `ctx.store` usage, with `ledger` declared as `let ledger: Ledger | undefined` outside it so the `finally` (`ledger?.close(); ctx.store.close();`) always runs regardless of where a throw originates — mirroring the `finally`-closes-everything-opened-so-far pattern already used elsewhere in this plan (e.g. `openMutateContext`'s own store-close-on-throw). I did not add a forcing unit test for this specific leak: unlike `ingest.ts`'s analogous test (which can make `Store.open` fail by pointing `dbPath` at a directory, because that failure happens BEFORE any handle is open), here `openMutateContext` already succeeds and opens `ctx.store` on the same `dbPath` before `Ledger.open` runs on it — reliably making `Ledger.open` fail differently than the `Store.open` that just succeeded on the identical path needs DB-internal corruption I could not trigger portably (Windows + Linux CI) without dependency injection this task doesn't otherwise need. Flagging as verified by code inspection and the restructuring itself, not by a red/green test.

### The most valuable item: a registry-driven structural test retiring the whole F2 defect class

New file: `test/cli/f2-registry.test.ts`. It imports the actual `COMMANDS` map from `src/cli/commands/registry.ts` and, for every registered command except an explicit `ALLOWED_NONZERO = new Set(['doctor'])` allowlist (`status` isn't in `COMMANDS` at all — it's a hardcoded case in the dispatch switch, per `registry.ts`'s own `SHADOWED_BY_SWITCH` comment), builds a fresh project, drives that command through its own legitimate success path via a per-command `SETUPS` table, plants one unrelated corrupt item file (`items/constraint/CONST-broken.md` with no frontmatter), and asserts exit code 0.

Coverage: `decay`, `ingest`, `ingest-apply`, `ingest-status`, `lesson`, `lesson-stage`, `lesson-accept`, `lesson-discard`, `review` — all 9 non-`doctor` registered commands, each with a `SETUPS` entry that gets it to a genuine success path (staged lesson candidates, an ingest session with matching extraction candidates, etc.), not just "ran with no args" (several commands exit 1 on missing arguments before ever reaching `openMutateContext`, which would have made a naive "assert exit 0" pass for the wrong reason).

Two structural safety nets beyond the per-command checks:
- `'every command registered in COMMANDS is covered by this file (allowlisted or set up)'` — asserts no registered command name is missing from both `ALLOWED_NONZERO` and `SETUPS`. A new command added to the registry without an entry here fails this test by name, loudly, rather than being silently skipped by the `for` loop.
- `'the registry actually has more than one command — this guard would be vacuous against an empty registry'` — a `COMMANDS.size > 1` sanity check, so an import-order regression that left the registry empty (which would make the whole file's `for` loop generate zero tests and pass trivially) cannot pass silently.

Mutation-tested against `decay.ts` specifically: reintroducing `return errors.length ? 1 : 0;` in `decay.ts`'s final return **did not initially get caught** — the registry test's original `decay` setup (empty corpus) only ever exercised the OTHER exit point (the empty-report branch, which was already correct), never the mutated one. Fixed by changing the `decay` setup to add a scoped item first (`run(['add', 'constraint', ...], cwd)`) so it exercises the full-report code path, the one that actually contains the second `return`. Re-ran: the mutant is now caught — `"decay" exited 1 on an unrelated corpus load error`. This is exactly the kind of "which branch does the fixture actually reach" gap the plan's mutation-testing instruction warns about, and it would have made the new structural guard blind to the specific bug it exists to catch, on the specific command it was inspired by.

### Full verification

- `node --test test/core/decay.test.ts test/cli/decay.test.ts test/cli/f2-registry.test.ts`: **37/37 pass**.
- `npx tsc --noEmit`: clean.
- `npm test`, run twice: **1073/1073 pass** both times (baseline 1056 → +17: 6 new assertions/tests in `test/cli/decay.test.ts` bringing it to 16, plus the new `test/cli/f2-registry.test.ts` at 11 tests — 1056 + 6 + 11 = 1073).
- All mutants introduced this round (hedge-gating, `cold: none` wording ×2, `col()` overflow, `useCount`/`lastUsed` rendering ×1 combined mutant, `recentSessions(window)` → `recentSessions(9999)`, and the F2 exit code reintroduced specifically against the registry test) were killed by the tests added to catch them.

### `decay` against this repo's own `.my_context/` corpus, after the fix

```
my_context decay — items not injected in the last 20 session(s). The ledger holds 0 session(s).
  "cold" means: not auto-injected in the last window of sessions. It does NOT mean unused — the ledger records injection, not reading or reliance, so a new item, and any item consulted via `show`, MCP `get_item`, or the Markdown file directly, look exactly like an abandoned one here.
  Do not supersede or deprecate anything below on this list alone — verify real usage first.
  (only 0 session(s) recorded so far, so "cold" mostly means "new")

cold (25) — not auto-injected in the window; check before acting:
  CONST-node-24-no-build-step                 constraint    never injected          Node 24 or newer, and no build step
  CONST-zero-runtime-dependencies             constraint    never injected          The shipped plugin has zero runtime dependencies
  INV-a-validator-that-gates-writes-must-be-a-complete  invariant     never injected          A validator that gates writes must be a complete precondition for the write
  INV-hooks-fail-open                         invariant     never injected          Hooks fail open, always
  INV-markdown-is-the-source-of-truth         invariant     never injected          Markdown is the source of truth; the SQLite index is disposable
  INV-nothing-is-dropped-silently             invariant     never injected          Nothing is ever dropped silently
  INV-posix-normalized-paths                  invariant     never injected          Every stored path is POSIX-normalized
  INV-select-is-pure                          invariant     never injected          core/select is a pure function
  NOGOAL-no-agent-hard-delete                 non_goal      never injected          Agents never get a hard-delete tool
  NOGOAL-not-a-claude-mem-replacement         non_goal      never injected          my_context does not replace claude-mem
  OPENQ-how-do-filters-respect-dependencies   open_question never injected          When a filter excludes an item something else depends on, what happens?
  OPENQ-which-mcp-revision-does-claude-code-speak  open_question never injected          Which MCP protocol revision does Claude Code actually negotiate?
  REQ-an-item-must-be-editable                requirement   never injected          There must be a supported way to edit an item
  REQ-changes-are-timestamped-and-audited     requirement   never injected          Every change is timestamped, and operations are auditable
  REQ-cli-output-is-tabular-with-detail-levels  requirement   never injected          Human-facing output is tabular, with selectable detail levels
  REQ-items-carry-a-domain                    requirement   never injected          Items carry a domain — a declared grouping above category
  REQ-plan-2-precision-injection              requirement   never injected          Injection must survive compaction and activate by scope
  REQ-session-focus-controls-what-loads       requirement   never injected          A session can focus on domains, controlling what loads into context
  RULE-erasable-syntax-only                   rule          never injected          Do not use non-erasable TypeScript syntax
  RULE-filter-seen-before-budgeting           rule          never injected          Filter already-seen items before budgeting, never after
  RULE-never-bind-a-boolean-to-sqlite         rule          never injected          Never bind a JavaScript boolean to a node:sqlite statement
  RULE-never-weaken-byte-identity             rule          never injected          Never weaken a byte-identity or round-trip assertion to make it pass
  RULE-quote-the-test-glob                    rule          never injected          Keep the test glob double-quoted in package.json
  STD-answered-questions-are-superseded       standard      never injected          An answered open_question is superseded, never deleted and never left active
  STD-error-message-conventions               standard      never injected          Error messages are prefixed once and name the file once
```

The list content is unchanged (still 25 "never injected" items, correctly — this repo has never run a real session against its own ledger, so every eligible normative item genuinely has zero injection history). What changed is that the report now states, unconditionally and right above the list, that "cold" means "not auto-injected," explicitly not "unused," names the exact channels the ledger cannot see (`show`, MCP `get_item`, direct Markdown reads), and tells the reader not to act on the list alone — rather than reading, unqualified, as 25 "candidates for supersession". The long `INV-a-validator-that-gates-writes-must-be-a-complete` id also no longer runs into its `invariant` column.

### Remaining concern

Given the fix was in scope after all, I want to flag directly: I initially mis-scoped this — I diagnosed the epistemic gap correctly but drew the wrong boundary around what counts as "this task's job" when the fix was report copy in the exact file the task already owned. Noted for calibration on later tasks in this plan with a similar shape (a computation task that also owns a small amount of user-facing copy).

## Commit

`c03afe1` — includes the round-2 fixes above (copy, formatting, `Ledger.open` restructuring) and the new `test/cli/f2-registry.test.ts`.
