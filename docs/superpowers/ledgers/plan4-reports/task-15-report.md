# Task 15 report — the expanded `status` report

## Review round — five fixes, addressed

The first review pass found three genuine correctness issues and two missing decisions, all reproduced and now fixed. Full detail below the original report.

1. **CRITICAL — review-queue count disagreed with `mycontext review` itself.** `status.ts` counted every draft in the merged project+global corpus; `review.ts`'s own `drafts()` deliberately excludes global-layer drafts (a global draft can never be promoted/discarded from a project). Fixed by delegating to the same `drafts()` function via a new exported `reviewQueueDrafts(ctx)`, instead of re-deriving the filter. Pinned with a `sandbox()`-based unit test (mirroring `review.test.ts`'s own test of `drafts()`) since reproducing a real global-layer draft end-to-end would require writing under the real `~/.my-context`, which this suite must never touch.
2. **IMPORTANT — the health line could show a phantom `index_stale` warning that `doctor`, run immediately after, would not reproduce.** `runChecks` (whose `checkIndexFreshness` stats `ws.dbPath`'s mtime) ran while `ctx.store` was still open; SQLite (WAL mode) only checkpoints the main database file's mtime on close, so the very first `status` run after an item was edited on disk saw the PRIOR checkpoint's mtime, not this invocation's own rebuild. Fixed by closing `ctx.store` right after reading `items`/`queueCount` and before `runChecks` runs (the same ordering `cmdQuery` already relies on for the identical reason). Reproduced and pinned with a test that bumps an item's mtime to real wall-clock "now" (not artificially into the future, which would produce genuine, unavoidable staleness that would defeat the point of the test) between two separate CLI invocations.
3. **IMPORTANT — `status` exits 0 while `doctor` exits 1 on the same corpus with error-level findings.** Decided explicitly: `status`'s exit code stays scoped to corpus LOAD errors only (the pre-existing, brief-mandated F2 contract, and the one `f2-registry.test.ts`'s `ALLOWED_NONZERO` allowlist already pins) — it does not widen to fail on doctor-level `error` findings, because that would be an untested, silent change to what a CI job calling `status` can rely on. Made explicit on screen instead: whenever `counts.errors > 0`, a `note:` line under the health summary states plainly that status's own exit code does not reflect those errors and points at `mycontext doctor` for a command that does. Pinned with a test that produces a real `session_id_mismatch` error-level finding, asserts `status` exits 0 while showing `1 error(s)` and the on-screen disclaimer, and asserts `doctor --quiet` exits 1 on the identical corpus.
4. **IMPORTANT — "the last 20 session(s)" was asserted unconditionally, even when the ledger holds only 1.** Added the identical hedge `mycontext decay` itself prints — `(only N session(s) recorded so far, so "cold" mostly means "new")` — gated on `0 < sessionsRecorded < DECAY_WINDOW`, using `DecayReport`'s own `sessionsRecorded`/`window` split.
5. **IMPORTANT — five mutants survived; two structural coverage gaps explained them.** No test drove `status` with a populated ledger (the non-zero-sessions branch of the usage line had zero coverage — a mutant hardcoding `decay.cold.length` to `0` passed the whole suite), and no test drove a partially-applied ingest session (only 0/2 and fully-done were exercised, so `const done = 0` also passed). Closed both: a populated-ledger test asserting a real, non-zero cold count (plus its sibling proving an injected item drops OUT of the cold count, so the number tracks real data in both directions) and a 1-of-2-anchors-applied test pinning the `done` fraction. Also closed, while auditing the same block: deletion of the unscoped subline, and deletion of the rule-candidate detail rows — both now have direct positive-case tests. All five mutants re-verified: fail against the mutant, pass against the fix (see the mutation table below).

**Related, not changed:** Plan 1's `status` warned about every unscoped active item regardless of category tier; this version's unscoped count comes from `computeDecay`, scoped to `normative`-tier, eligible items only (Task 13's existing boundary, also used by `mycontext decay`) — so an unscoped active `lesson` (tier `rationale`) no longer triggers the line. This is a real, inherited behavior change from Plan 1, not introduced by this task, and correctly following the brief's specified interface (`computeDecay`) means keeping it rather than re-deriving a broader, untested filter. Pinned with a test documenting the current (narrower) behavior, with a comment explaining why, so a future change to `computeDecay`'s tier boundary is visible here too.

**MINOR items addressed:**
- `padEnd(44)`/`padEnd(40)` column collision (this repo has an 82-character rule-candidate title path and lesson ids well past 44 chars) — fixed by exporting and reusing `decay.ts`'s own `col()` helper (pads but never truncates/collides), applied to both the ingest-session row and the rule-candidate row.
- `registry.ts`'s comment claiming Task 15 "removes `status`... when it migrates for real" (future tense for what this task already did) — corrected to past tense, naming `src/cli/commands/status.ts`.
- `test/cli/status.test.ts` lacked `try/finally` cleanup and leaked temp projects on a failing assertion — the whole file now uses the same `withProject` pattern as `test/cli/review.test.ts`; confirmed zero leaked `myctx-*` temp directories after a full `npm test` run.
- The `0/2` column was unlabeled — now reads `0/2 chunk(s) applied`.

**MINOR items NOT addressed (out of this task's scope, per the coordinator's routing):**
- `mycontext status --json`, `--full`/`--short`/`--summary`, and column headers — the coordinator explicitly routed the user's standing tabular/JSON/detail-level requirement to Task 16, which owns the user command surface. Not touched here.

## What was implemented

- `src/cli/commands/status.ts` (new): registers `status` in the `COMMANDS` registry, replacing Plan 1's hardcoded `cmdStatus`. Reports, in order: item counts by category/status/origin, the review queue (drafts pending, `mycontext review`), unfinished ingest sessions (`sourceFile  done/total  sessionId`, via `listSessions` + `pendingAnchors`), pending rule candidates awaiting approval (filtered to `state === 'pending'`, via `listStaging`), a usage/decay line sourced from the ledger (wrapped in try/catch/finally so an unpopulated or absent ledger degrades to "no sessions recorded" rather than crashing), and a one-line doctor health summary (`runChecks` + `summarize`). Ends with `emitLoadErrors` and the F2 exemption: exits 1 iff there were corpus load errors.
- `src/cli/index.ts`: removed `cmdStatus` and its `case 'status'` arm; removed the hardcoded `status` line from `usage()`.
- `src/cli/commands/index.ts`: added `import './status.ts';`.
- `src/cli/commands/registry.ts`: removed `'status'` from `SHADOWED_BY_SWITCH`, since it is now a real registration, not a switch arm shadowing it.
- `test/cli/status.test.ts` (new): the brief's suite plus three tests added after mutation-testing (see below).
- `test/cli/e2e.test.ts` (new): the plan's scripted end-to-end walkthrough from the Verification section, with one correction (see below).
- `test/cli/f2-registry.test.ts`: added `status` to `ALLOWED_NONZERO` (alongside `doctor`) with an updated doc comment — `status` is now iterated by this registry-driven guard (it used to be explicitly excluded as a switch arm) and must stay exempt from the "always exits 0" rule, per the plan's `status`/`doctor` allowlist.
- `test/cli/registry.test.ts`: removed `'status'` from the list of names `registerCommand` is expected to refuse as switch-shadowed, since it no longer is.

## Interface deviations from the brief caught before they mattered

1. **`review promote` needs `--yes`.** The brief's own e2e walkthrough (Verification Step 2) calls `mycontext review promote <id> --scope ...` without a confirmation flag and expects exit code 0. Task 10 added a non-interactive confirmation gate (`confirmAction`) to `promote`/`discard` after that walkthrough text was drafted, so run non-interactively it now returns 1 ("refusing without confirmation — stdin is not interactive"). Reproduced by running the exact scripted sequence (see transcript below), then fixed by adding `--yes` and a comment explaining why. Everything else in the brief's `status.ts` and `e2e.test.ts` bodies matched the current source exactly (`runChecks`'s `{root, repoRoot, dbPath, items}` shape and six checks, `summarize`'s `{errors, warnings, infos}`, `computeDecay`'s `cold`/`warm`/`unscoped`, `listStaging`'s `(lessonId, key)`-keyed candidates).
2. **The F2 registry/registry-shadow tests needed updating**, since they hardcoded assumptions from the old world (`status` as a switch arm, not a `COMMANDS` entry). This wasn't mentioned in the brief but is required for `npm test` to stay green — the failures were self-explanatory (`f2-registry.test.ts`'s own guard fired exactly as designed, naming `status` as an uncovered registered command).

## TDD evidence

- Step 2 (brief): `node --test test/cli/status.test.ts` before implementation — failed with 4 of 11 assertions unmet (`/health:.../`, `/by origin/`, `/no sessions recorded|0 session/`, etc.) against the old Plan-1-only output, for the right reason (the new sections don't exist yet).
- After implementing `status.ts` and moving the switch arm: `node --test test/cli/status.test.ts test/cli/cli.test.ts` — 35/35 pass, including both of Plan 1's pinned assertions (`status reports counts by category and status`, `status surfaces a rebuild error for a corrupt item and exits non-zero`).
- `npx tsc --noEmit` — clean throughout.
- `node --test test/cli/e2e.test.ts` — 3/3 pass after the `--yes` fix.
- `npm test` (full suite) — 1112/1112 pass (baseline 1096 + 9 status tests + 3 e2e tests + 3 mutation-derived regression tests + the f2/registry test file edits, net +16... actual observed count 1112, i.e. +16 over the 1096 baseline once the registry/f2 test edits and all new files are counted).
- `npm run typecheck` (`npx tsc --noEmit`) — clean.

## Mutation testing — every guard in `status.ts`

Six mutations applied one at a time (source edited, tests run, reverted immediately after observing the result), plus three additional regression tests added because the first pass caught real, previously-uncovered gaps.

| # | Mutation | Caught by existing tests? | Action |
|---|---|---|---|
| 1 | `return errors.length ? 1 : 0` → always `return 0` | **Yes** — `status.test.ts`'s "a corrupt item file is reported and exits 1" | none needed |
| 2 | Dropped the `emitLoadErrors(errors, out)` call entirely | **Yes** — both the new test and `cli.test.ts`'s pinned "status surfaces a rebuild error..." | none needed |
| 3 | Review queue line only printed `if (drafts.length)` (omit when zero, instead of printing "0 draft(s)") | **Yes** — "a clean corpus says the queue is empty rather than omitting the section" | none needed |
| 4 | `pendingRules` stopped filtering on `c.state === 'pending'` (would double-count accepted/discarded candidates as still awaiting approval forever) | **No** — nothing exercised a staging file with a mix of settled and pending candidates | **Gap closed**: added "an accepted rule candidate does not keep counting as awaiting approval," verified it fails against the mutant and passes against the fix |
| 5 | Ingest-sessions list stopped filtering on `pendingAnchors(s).length > 0` (a fully-applied session would still be reported "unfinished" forever) | **No** — no test drove a session to completion and then checked it disappears from status | **Gap closed**: added "a fully-applied ingest session is not listed as unfinished," verified fail/pass |
| 6 | `repoRoot: path.dirname(ws.projectRoot)` → `repoRoot: ws.projectRoot` (health check would scan inside `.my_context/` instead of the real repository root) | **No** — the brief's own "doctor summary" test used a scope glob (`src/gone/**`) that matches nothing under *either* candidate root, so the two code paths were indistinguishable | **Gap closed**: added "health checks the repository root, not the .my_context directory itself," using a scope glob that matches a real file one level above `.my_context` so the wrong-root case is distinguishable; verified fail/pass |

All three closed gaps are now in `test/cli/status.test.ts`; final mutation re-run confirms all six mutants are caught by the current suite. `npm test` is green at 1112/1112 with the fixes in place (mutants were always reverted before moving to the next one; nothing landed mid-mutation).

## Real-corpus output (this repo's own `.my_context/`)

Command: `node --experimental-strip-types src/cli/index.ts status` (worktree root)

```
my_context: 39 item(s), profile "standard"

by category
  adr             3
  constraint      2
  decision        3
  invariant       6
  lesson          7
  non_goal        2
  open_question   3
  requirement     6
  rule            5
  standard        2

by status
  active          38
  superseded      1

by origin
  human           39

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

Exit code: `0`.

This matches the brief's stated expectation exactly: 39 items, a clean doctor (0/0/0), and an empty ledger ("no sessions recorded"), and there is no `ingest:` or rule-approval section because both queues are genuinely empty (verified by their filters, not merely absent from the corpus by luck — see mutations #4/#5 above).

## Judging it as the screen a user actually reads

- The count sections (category/status/origin) are exactly what Plan 1 shipped, unchanged, plus the new `by origin` breakdown — this is the cheapest and most trustworthy part of the screen, since it's a direct tally over `store.all()`.
- The review-queue and ingest lines are unconditionally present (never silently omitted at zero), which the brief explicitly required and which mutation #3 confirmed is enforced.
- The decay/usage line is deliberately hedged: it says "not injected in the last 20 session(s) — not evidence they are unused, only that they were not selected. See `mycontext decay`," rather than any language implying staleness or a recommendation to act. This mirrors the correction task-13 had to make to `computeDecay`'s own report (the ledger records injection, not use) and avoids re-introducing that same overclaim one layer up, on the one screen a user is most likely to skim and trust at a glance.
- The health line is a pure count (`errors`/`warnings`/`notes`) with a pointer to `mycontext doctor` for detail — it does not try to summarize *which* checks fired, so it can't misrepresent doctor's findings, only under-inform (which the "run doctor for detail" pointer addresses).
- One structural limitation, not a defect: `runChecks`'s `index_missing` finding (level `info`) is unreachable through any command per the brief's own note, because `openMutateContext` always creates the index via `rebuild` before `status` calls `runChecks`. `status`'s health line can therefore never show that particular note; this is inherited from `doctor`, not introduced here, and isn't something `status` can fix on its own.
- The `updated_at`/mtime caveat from the task instructions doesn't surface literally anywhere in `status`'s own output — `status` never renders a raw `updated_at` value or claims freshness from it directly (that's `doctor`'s `index_stale`/`checkSourceDrift`, referenced only by count). No number on this screen is derived from `updated_at` in a way that could be misread as authorship recency.
- Tabular/detail-level request: the brief specifies fixed single-level, line-oriented text output (no `--full`/`--short`/`--summary` flags, no `--json`), and that is what was implemented — the brief's spec is narrower than the user's general ask for multi-level tabular/JSON output. This is a gap between the user's stated general preference and what Task 15's brief actually asks for; flagging it rather than silently expanding scope beyond the brief's Interfaces/Files list.

## Concerns

- The `by origin`/`by category`/`by status` sections use fixed-width `padEnd(16)` columns with no header row and no `--json` mode; a long category or origin name (nothing today, but a custom profile could add one) would misalign the columns rather than wrapping. Cosmetic, not a correctness issue.
- `status` now duplicates `runChecks`'s full invocation (root/repoRoot/dbPath/items) that `doctor.ts` also makes — no code is shared between the two call sites beyond `summarize`. Not a bug, but a second copy of "how to correctly call `runChecks`" that a future signature change would need to be applied to twice, the same shape of hazard the task brief warned about elsewhere in this plan ("a hazard fixed in one file reappearing three times").

## Review-round mutation table (all re-verified fail-then-pass)

| Fix | Mutation | Before this round | After this round |
|---|---|---|---|
| review-queue count | re-introduce `items.filter(i => i.status === 'draft')` instead of `reviewQueueDrafts(ctx)` | not caught (no global-layer scenario existed) | caught by `reviewQueueDrafts excludes a global-layer draft, exactly as review() does` (`sandbox()`-based) |
| store-close ordering | move `ctx.store.close()` back to a single `finally` at the end of the function (store stays open through `runChecks`) | not caught | caught by `the health line does not falsely flag staleness the index's own rebuild just resolved` |
| exit-code / health disagreement | (design decision, not a code mutation) | no test exercised an error-level finding at all | caught by `an error-level doctor finding is shown but does not fail status's own exit code — and the gap is stated on screen`, which also cross-checks `doctor --quiet` exits 1 on the same corpus |
| decay hedge | (missing feature, not a code mutation) | no test asserted the hedge text | `the usage line reports a real, non-zero cold count once the ledger has sessions` asserts the hedge verbatim |
| `decay.cold.length` → `0` | hardcode the cold count | not caught (no populated-ledger test existed) | caught by `the usage line reports a real, non-zero cold count once the ledger has sessions` |
| `const done = 0` | hardcode the applied-fraction | not caught (only 0/2 and fully-done were exercised) | caught by `a partially-applied ingest session shows the real fraction, not a constant` |
| delete the unscoped subline (`if (false && decay.unscoped.length)`) | suppress the subline | not caught (no positive-case test) | caught by `an unscoped active normative item is called out by name-free count` |
| delete the rule-candidate detail-row loop | drop per-candidate output | not caught (only the summary count was asserted) | caught by `pending rule approvals are surfaced, with the candidate detail row` |

Each mutation above was applied to `src/cli/commands/status.ts`, run against `test/cli/status.test.ts` alone to observe the failure, then reverted before moving to the next one — nothing landed mid-mutation.

## Re-run evidence

- `npx tsc --noEmit` — clean.
- `node --test test/cli/status.test.ts` — 21/21 pass (was 13; 8 new tests from this round: global-layer draft exclusion, partial-ingest fraction, rule-candidate detail row, store-close ordering, populated-ledger cold count with its "not cold when injected" sibling, unscoped-normative-only behavior with its non-normative-is-silent sibling, and the exit-code/health disagreement).
- `npm test` (full suite) — **1120/1120**, run twice, both times clean, both times 1120.
- Leaked-temp-directory check after the full run: `readdirSync(os.tmpdir())` filtered to `myctx-*` → **0** (was 21 during the reviewer's mutation runs against the pre-fix suite; the whole file now uses `withProject`'s try/finally).

## Real-corpus output, re-run after all fixes

Command: `node --experimental-strip-types src/cli/index.ts status` (worktree root)

```
my_context: 39 item(s), profile "standard"

by category
  adr             3
  constraint      2
  decision        3
  invariant       6
  lesson          7
  non_goal        2
  open_question   3
  requirement     6
  rule            5
  standard        2

by status
  active          38
  superseded      1

by origin
  human           39

review queue: 0 draft(s) pending review — walk it with `mycontext review`.

usage: no sessions recorded yet — decay reporting starts once items begin to be injected.

health: 0 error(s), 0 warning(s), 0 note(s) — details from `mycontext doctor`.
```

Exit code: `0`. Cross-checked against `mycontext doctor --quiet` on the identical corpus immediately after: `0 error(s), 0 warning(s), 0 note(s) across 0 finding(s)`, exit `0` — the two commands now agree on this repo's real corpus, which is exactly the property that was broken before this round (issue #2 above) and is now covered by a regression test rather than resting on this one manual check.
