# Task 6 report: the CLI command registry and the ingest CLI commands

Commits: `571c5d0` (initial), `604f77b` (review round 1 fixes), `2b0a3f2` (review round 2 fixes)

## Review round 2 — addendum

Round 1's "3/3 red under the old key" claim was corrected by the reviewer:
the real rate, measured with real cross-process runs, is closer to 50%
(4/8 in their measurement; I independently re-measured 6/8 red / 2/8 green
this round). Noted so this isn't repeated as if it were strong evidence —
a 50% detector is a coin flip, not a pin, and this shaped everything below.

Two new Importants, both inside `acquireApplyLock` itself:

1. **The create/write window was stealable.** `openSync(file, 'wx')` creates
   the lock file EMPTY; the pid payload lands on a separate, later
   `writeSync`. A concurrent acquirer's `EEXIST` can land exactly inside that
   gap and see an unparseable payload — which `isStaleLock` treated as
   unconditionally stale, stealing the live holder's lock (reviewer measured:
   an empty `apply.lock` stolen in 0ms; a real double-hold once in 300
   cross-process acquisitions). **Fix:** a short write-race grace period,
   `LOCK_WRITE_GRACE_MS` (500ms) — an unparseable payload is now trusted to
   still be mid-write until it's been sitting there longer than any real
   `open`+`write`+`close` could plausibly take, falling through to the
   existing `LOCK_STALE_MS` mtime backstop if it never becomes parseable.
   This also closes the MINOR item (PID reuse wedging the lock forever): the
   mtime backstop is now an OR across both branches, not only the
   unparseable-payload `else` — a lock whose recorded pid was reused by an
   unrelated live process is now still eventually reclaimed.
2. **Windows returns `EPERM`, not `EEXIST`/`EBUSY`, for `open(path, 'wx')`
   against a delete-pending file** — a real window around every
   `release()`'s `rmSync`. `acquireApplyLock` rethrew anything not `EEXIST`,
   so a legitimate caller could get a hard exit 1 under contention (reviewer
   measured 5/8 racers dying this way under a synthetic hammer). **Fix:**
   extracted `isRetryableLockError(code)`, now `EEXIST || EPERM`, with a
   direct unit test and a new 8-process acquire/release hammer test
   (`test/fixtures/hammer-apply-lock.ts`) as a real-world check — 8/8 clean
   across every run performed this round.

The recurring I3-class defect ("a guard is correct but the test can't prove
it"), found by the reviewer INSIDE round 1's own fix:

3. **The live-pid staleness test couldn't fail on its own claim.** The old
   version only asserted the child eventually exited 0, which is true whether
   it waited or stole. Rewrote it to assert TIMING: the child's own `gotAt`
   (reported over stdout, via a rewritten `hold-apply-lock.ts` that now emits
   an `ACQUIRED` line the instant it holds the lock) must not precede the
   moment the fake live-pid lock was actually removed. Confirmed this
   distinction matters by re-mutating `!isProcessAlive(payload.pid)` to
   always `true` — the old exit-code-only test still passed; the new
   timing-based one goes red.
4. **Both flagship concurrency tests were ~50% detectors.** The exclusion
   test used to spawn both racers together and sort by OBSERVED acquisition
   time — genuinely contending only on whichever run happened to overlap.
   Rewritten to be deterministic BY CONSTRUCTION: `hold-apply-lock.ts` now
   prints `ACQUIRED` the instant it holds the lock, and the test awaits that
   signal before spawning the second racer at all, so contention is real on
   every run, not luck. Measured 8/8 clean afterward. But this alone still
   didn't catch the "delete the `writeSync` payload line" mutant reliably —
   traced it to a genuine scope gap, not a flaky test: a 400ms hold always
   finishes and releases before the 500ms write-grace period elapses,
   mutant or not, so that specific test literally cannot observe the bug
   regardless of how deterministic its ordering is. Added a SECOND exclusion
   test at a 700ms hold (past the grace period) specifically to close this;
   verified it directly — 8/8 red under the mutant, where the 400ms version
   is 0/8 red (confirmed, not assumed). The cross-anchor content test's own
   ~50% figure is a property of the REAL defect it exercises (genuine
   process-scheduling overlap), not of the test's construction; with the
   workspace-scoped lock in place it is deterministic (8/8 clean, measured
   this round and previously by the reviewer).

MINOR items also addressed: the mtime-backstop/PID-reuse fix is covered
above (folded into fix #1, not a separate code path). `cmdIngest` now
distinguishes `ENOENT` (the expected "no such file" message) from any other
`statSync` failure (`EACCES`, `ELOOP`, ...) via the shared `toCliMessage`,
rather than collapsing every failure into a message that implies "create it
and retry" even when the real problem is a permission or symlink loop.

**New tests added this round**, all in `test/cli/ingest-lock.test.ts` unless
noted: the 700ms-hold exclusion variant; three payload-shape tests (`empty`,
`truncated`, `null`) confirming none is stolen inside the write-grace window;
a cross-workspace independence test (two different `.my_context` roots must
not block each other — measured workspace B's acquire at ~90ms while
workspace A held its own lock for 1500ms); the `isRetryableLockError` unit
test; the acquire/release hammer test; `test/fixtures/hammer-apply-lock.ts`
(new fixture). `hold-apply-lock.ts` was modified to emit the `ACQUIRED`
synchronization signal.

**Pass-rate measurements requested by the review**, all measured this round
by hand (no mutation-testing framework in this zero-dependency repo):

| Test | Guard present | Guard removed / key reverted |
|---|---|---|
| `ingest-lock.test.ts` full file | 8/8 clean (ran the whole file 8 times) | — |
| Cross-anchor content test, alone | 8/8 clean (implied by full-file runs) | 2/8 pass, 6/8 red, under the reverted per-`(session,anchor)` key |
| Exclusion test (400ms hold) | 8/8 clean | 0/8 red under the empty-payload mutant (confirmed: this variant cannot detect it by construction, hence the 700ms variant) |
| Exclusion test (700ms hold, new) | 8/8 clean (4 runs performed, all clean; combined with the full-file 8x this round, no failure observed) | 8/8 red under the empty-payload (`writeSync` deleted) mutant |
| Live-pid staleness test (timing-based) | passes | fails when `isProcessAlive` mutated to always return `false`-negation (every live pid declared stale) |

`npm test` run twice this round: 872/872 both times (865 prior + 7 net new —
`test/cli/ingest-lock.test.ts` went from 4 tests to 11: the exclusion test
split into two (400ms + the new 700ms variant), plus 3 payload-shape tests,
1 cross-workspace test, 1 `isRetryableLockError` unit test, and 1 hammer
test; the pre-existing dead-process and live-pid tests were modified in
place, not added). `npx tsc --noEmit` clean. `git status --porcelain`
clean. Stray temp
directories from this round's manual mutation runs (all `myctx-ing-lock-*`,
from repeatedly running the lock test file by hand) were identified and
removed before the commit; the reviewer's own note that they cleared 12 from
round 1 is acknowledged — this round's cleanup was done proactively before
handing back rather than left for the next reviewer.

Second commit: `2b0a3f2`.

## Review round 1 — addendum

Two Criticals came back:

1. **The lock was keyed on `(sessionId, anchor)`, but the ids `applyCandidates`
   collides on come from `ctx.store.all()` — the whole workspace.** The
   reviewer reproduced the loss with two real processes and ZERO injected
   delay by racing two *different anchors of the same session* whose
   candidates shared a title. Fixed by making `acquireApplyLock` a single
   workspace-wide lock (`<root>/.ingest/apply.lock`), held for the whole
   read-decide-write critical section of any `ingest-apply` call in that
   workspace, regardless of session or anchor. Verified the fix is both
   necessary and sufficient with zero injected delay: reverting to the old
   per-anchor key reliably reproduced the failure 3/3 runs in
   `test/cli/ingest-lock.test.ts`'s cross-anchor test; the workspace-scoped
   version passes reliably.
2. **`ingest-apply` exited 1 on an unrelated corpus load error**, which
   contradicted the F2 ruling already shipped for `add`/`list`/`show`/`rebuild`
   (pinned in `test/cli/cli.test.ts`): a command that did what it was asked
   exits 0 and reports the problem as a warning; only `status`/`doctor` exit
   non-zero. Fixed the code (both `return errors.length ? 1 : 0` sites now
   `return 0`), the brief's prose paragraph and embedded pseudocode (added
   correction notes rather than silently rewriting the historical snippet),
   and the pinned test assertion (`test/cli/ingest.test.ts`, renamed to
   *"ingest-apply reports a corrupt unrelated item file as a warning but
   still succeeds"*, now also checks via `ingest-status` that the anchor
   genuinely advanced rather than being silently skipped).

IMPORTANT items also addressed:

3. `test/cli/ingest-lock.test.ts` is rescoped. It now has a dedicated test —
   `acquireApplyLock excludes: a second acquirer cannot start before the
   first releases` — using a new fixture (`test/fixtures/hold-apply-lock.ts`)
   that acquires, holds, and releases the lock directly, independent of any
   content-loss race. Mutation-verified: `openSync(file, 'wx')` → `'w'` now
   makes this test fail (it didn't before, on the old content-only test).
   The content-preserving test is retained but rescoped to the reviewer's
   exact cross-anchor reproduction.
4. `LOCK_RETRY_MS` is now used with linear backoff (`min(RETRY_MS * attempt,
   MAX_RETRY_MS)`), and the doc comment's "backing-off" claim is now true
   rather than describing a fixed interval.
5. Staleness detection added: the lock file's payload records `{pid, at}`;
   on `EEXIST`, a lock whose recorded pid is no longer alive (checked via
   `process.kill(pid, 0)`, which works cross-platform including Windows) or
   whose file is unreadable/corrupt is reclaimed immediately; one whose
   mtime exceeds a 5-minute backstop is reclaimed as a fallback for a
   readable-but-otherwise-ambiguous case. Chose PID+mtime over a signal
   handler: this codebase has none anywhere in `src/`, and a lock file
   already needed to be readable cross-process, so recording the pid in it
   was the smaller addition. Two new tests pin both directions (a dead-pid
   lock is reclaimed in well under 2s instead of the full 15s timeout; a
   live-pid lock — this test process's own pid — is NOT reclaimed).
6. `registerCommand` now refuses a name already claimed by
   `src/cli/index.ts`'s hardcoded switch (`SHADOWED_BY_SWITCH`), so a
   registration that would be silently dead-yet-advertised throws instead.
   New `test/cli/registry.test.ts` pins this plus the two previously-unpinned
   survivors the review named (`positionals`' value-flag skip,
   `flag`'s `--name=value` branch) plus `hasFlag`.

MINOR items also addressed: `registry.ts` now has a test file; `hasFlag` is
now actually called (the `--stdin` detection below); `CommandFn`'s "never
throws" is now literally true for `cmdIngest`/`cmdIngestApply` — both wrap
their bodies in their own try/catch using a new shared `toCliMessage` helper
(moved from `src/cli/index.ts` into `src/cli/commands/context.ts`, one owner,
same pattern as `emitLoadErrors`) rather than relying on `runCli`'s top-level
catch; verified this matters by calling the registered `CommandFn` directly
(via `COMMANDS.get('ingest-apply')!.run(...)`, bypassing `runCli` entirely) —
removing the outer catch made that direct-call test fail even though the
equivalent `runCli`-mediated test still passed, confirming `runCli`'s own
catch had been silently doing the work and masking the missing contract.
`"2 candidate rejected"` is now pluralized. `ingest` on a directory now
reports "not a file" instead of a raw `EISDIR`. `ingest-apply` now requires
`--file` or `--stdin` explicitly — confirmed the prior behavior actually hung
(not just "wrong message") by disabling the check and watching the whole test
file time out at the harness level, not fail an assertion.

All fixes were TDD'd (test written/updated first, watched fail, implemented)
and mutation-tested by introducing the described mutant, confirming the
specific new test caught it, then reverting. `npm test` run twice: 865/865
both times (833 baseline + 32 new across `ingest.test.ts` (18),
`ingest-lock.test.ts` (4), `registry.test.ts` (9, new file), `context.test.ts`
(1, from round 1)). `npx tsc --noEmit` clean. `git status --porcelain` clean;
stray temp directories from red mutation runs were identified and removed
before each commit.

Second commit: `604f77b`.

## Original report (round 1)

Commit: `571c5d0`

## What was implemented

- `src/cli/commands/registry.ts` — `Emit`, `CommandFn`, `CommandDef`, `COMMANDS` map,
  `registerCommand`, `flag`, `hasFlag`, `positionals`. Matches the brief verbatim.
- `src/cli/commands/context.ts` — `emitLoadErrors` (moved out of `src/cli/index.ts`,
  which now imports it back — one owner of the `my_context: error  <file>: ` prefix),
  `openMutateContext`, `readPayload`.
- `src/cli/commands/ingest.ts` — `cmdIngest`, `cmdIngestApply`, `cmdIngestStatus`,
  registered as `ingest`, `ingest-apply`, `ingest-status`; plus the per-anchor lock
  (`acquireAnchorLock`/`anchorLockPath`).
- `src/cli/commands/index.ts` — side-effect import of `./ingest.ts`.
- `src/cli/index.ts` — added the three registry imports, appended `${registered}` to
  the existing `usage(config)` (kept its config-driven `categories:` line — the brief's
  literal `usage()`/`CATEGORIES` pseudocode was already superseded by the shipped
  per-workspace-config version; see "Where the brief disagreed" below), removed the
  local `emitLoadErrors` in favor of the import, and changed the `default` switch arm
  to fall back to `COMMANDS.get(command)` before reporting "unknown command".
- `test/cli/ingest.test.ts` — the brief's test file, verbatim.
- `test/cli/context.test.ts` (new, not in the brief) — targeted regression test for
  the "stale store" dogfooding defect, proving `openMutateContext` sees an item
  written to disk without ever going through `createItem`/the index.
- `test/cli/ingest-lock.test.ts` + `test/fixtures/concurrent-ingest-apply.ts` (new,
  not in the brief) — two real child processes racing `ingest-apply` on the same
  session anchor with different bodies for the same title (same `ingestKey`), proving
  the lock keeps both bodies.

## TDD evidence

1. Wrote `test/cli/ingest.test.ts` verbatim from the brief. Ran
   `node --test test/cli/ingest.test.ts` before any `src/cli/commands/*` files
   existed: 13 of 14 failed (`code 1 !== 0` / "unknown command \"ingest\"" — the
   registry fallback and `ingest.ts` did not exist yet). The one passing test
   ("usage still lists...") passed trivially because it doesn't touch the new
   commands. This is the correct RED: the failure is "command doesn't exist", not a
   typo or wrong assertion.
2. Implemented `registry.ts`, `context.ts`, `ingest.ts`, `commands/index.ts`, wired
   `src/cli/index.ts`. Reran: all 14 pass (GREEN).
3. `npx tsc --noEmit`: clean.
4. `npm test`: 848/848 (833 baseline + 15 new from this task's first pass:
   14 `ingest.test.ts` + a first version of the lock test). After adding
   `context.test.ts`, final total is 849/849, all green.

## Mutation testing — every guard, by hand (no dependency available; zero-runtime-deps repo)

For each, I introduced the mutant, confirmed the specific test(s) went RED for the
right reason, then reverted and reconfirmed GREEN + `git status --porcelain` clean.

1. **Load-error exit code in `cmdIngestApply`** (`return errors.length ? 1 : 0;`,
   both occurrences) → mutated to `return 0;`. Killed by
   *"a corrupt item file is reported and fails the command rather than being
   dropped"*.
2. **`saveSession(root, session)` immediately after `applyCandidates`** → removed
   the call. Killed by three tests: *"re-running ingest on an unchanged document
   resumes and skips applied chunks"*, *"ingest reports completion once every chunk
   is applied"*, *"ingest-status lists sessions with their progress"* — all three
   depend on the applied log reflecting the just-completed chunk immediately, not
   after some later, hypothetical batched save.
3. **`rebuild` call inside `openMutateContext`** → replaced with `errors = []` and no
   rebuild. Killed by the new *"openMutateContext sees an item written to disk
   without going through the index first"* test (`ctx.store.get(...)` returned
   `null`).
4. **The per-anchor lock itself** — see the dedicated section below; killed by
   `ingest-lock.test.ts` under an artificially widened race window.

I did not find a guard that a mutant survives — every one of the above died on the
first correctly-targeted test. Per the task's own caveat, I stayed alert to the two
failure classes mutation testing can't surface on its own (a correct guard in the
wrong place; a hazard fixed at one call site but not a private accessor's other call
sites) — see "Concerns" below for where I judged those risks acceptable rather than
closed.

## The per-anchor lock: implementation and verification with two real processes

**Implementation** (`acquireAnchorLock` in `src/cli/commands/ingest.ts`): a lock file
at `<projectRoot>/.ingest/<sessionId>.<anchor>.lock`, created with
`openSync(file, 'wx')` — an atomic exclusive-create that fails `EEXIST` if the file
already exists, on both POSIX and Windows, unlike a separate exists-check-then-create
pair of syscalls. `cmdIngestApply` acquires it before calling `openMutateContext`,
and releases it (`rmSync`, best-effort) in a `finally` that wraps the whole
open-context/apply/save/close sequence — so the lock covers the entire
read-decide-write critical section, not just the write. A caller that can't acquire
it within 15s gets a `my_context:`-prefixed message rather than hanging forever
behind a crashed holder.

**Verification with two real processes.** `test/fixtures/concurrent-ingest-apply.ts`
spawns as a genuinely separate OS process (`node:child_process.spawn`), waits on a
wall-clock barrier (the same `startAt` technique `test/fixtures/concurrent-opener.ts`
already uses), writes its own candidate JSON, and calls `ingest-apply` for the same
session and anchor as its sibling, with the same candidate *title* (so both hit the
supersede branch against the same predecessor, `ingestKey`-keyed) but a different
*body* (so `candidateHash` differs and neither dedupes against the other) — this is
exactly the shape of the hazard the brief names.

With the lock in place, two racers reliably both succeed and both bodies survive on
disk (`test/cli/ingest-lock.test.ts`, run repeatedly, always green).

I then tried to force the *actual* collision — both processes computing the identical
next revision id from stale reads — by disabling the lock and racing with only the
process-spawn/OS-scheduling jitter as the synchronization source. That did **not**
reproduce the hazard, even at 6 concurrent racers across 3 trials: every racer picked
a distinct id and no content was lost. I judge this is because `openMutateContext`'s
mandatory `rebuild()` call (itself a hard requirement of this task) runs inside a
SQLite write transaction (`store.transaction` in `rebuild.ts`), and that transaction's
locking incidentally serializes enough of each process's "catch up to current disk
state" step that the specific window the brief describes (both reads landing before
either write) rarely opens naturally in this environment.

To get an unambiguous verification rather than relying on an environment-dependent
race, I *temporarily* instrumented `src/ingest/apply.ts` with an env-var-gated
`sleepMs` immediately after `const everything = ctx.store.all();` — widening the
window between the read and the write to 200ms — and re-ran the two-racer test twice:

- **Lock disabled + 200ms injected delay:** racer B's `ingest-apply` call failed
  outright: `"REQ-passwords-are-at-least-12-characters-r2" already exists with
  different content."` — i.e. both racers independently computed id `...-r2` from
  their pre-delay reads, and B's own `createItem` call refused the second write.
  (This is a real, reproducible defect on its own — a legitimate racer's whole
  command fails and its content is lost — even though the *specific* silent-overwrite
  shape described in the brief did not fire in this exact trial; SQLite's own
  `busy`/retry semantics or ordering meant `createItem` saw enough of a conflict this
  time to refuse rather than silently replace. Either outcome is a correctness
  failure for a caller with no lock.)
- **Lock enabled + same 200ms injected delay:** both racers succeeded, both bodies
  present on disk, no lock files left behind.

I then removed all instrumentation (`git status --porcelain` confirmed no leftover
diff in `src/ingest/apply.ts` or the `MYCTX_PROBE_*` env checks) before the final
commit — the delay was never part of `src/ingest/apply.ts`'s shipped code, only a
temporary local experiment to force the window open for observation. The permanent
regression test (`test/cli/ingest-lock.test.ts`) races without the injected delay,
relying on real process/timing jitter, which is why it always passes today (lock
present) but is not, by itself, proof that removing the lock would turn it red in
every environment — the 200ms-delay experiment above is the actual proof, on this
machine, in this session.

## Where the brief disagreed with the built code

- `src/cli/index.ts`'s pre-existing `usage()` already took a `config: Config`
  parameter and derived its `categories:` line from `Object.values(config.categories)
  .filter(c => c.enabled)`, not from a static `CATEGORIES` import as the brief's Step
  6 pseudocode showed. `test/cli/cli.test.ts`'s *"usage lists only categories the
  workspace actually accepts"* pins this. I kept that behavior and only added the
  `${registered}` block and the doc comment about Task 15, rather than replacing the
  function with the brief's literal (and, for this codebase, regressive) version.
- The brief's Step 6 also showed `usage()` with no parameters; the real signature
  (`usage(config)`) was left as-is for the same reason.
- Everything else (interfaces, `openMutateContext`, `readPayload`, the command
  bodies) matched the brief and the verified source signatures exactly; no other
  divergence was needed.

## Concerns

- The per-anchor lock only serializes `ingest-apply` CLI invocations against each
  other. `applyCandidates`'s own doc comment already disclaims protection against
  *other* callers (e.g. a future MCP `ingest_document` tool in Task 7) — that tool
  will need to go through the same `acquireAnchorLock` mechanism (or a shared one) or
  the hazard reopens from a second entry point. I did not export the lock helpers
  from `ingest.ts`, since nothing outside this module needs them yet; Task 7 should
  either import them or duplicate the mechanism deliberately, not silently skip it.
- I could not force the *exact* silent-overwrite shape the brief's hard-requirement
  #1 describes (both processes reporting success, one body lost with no error) in
  this environment — only a variant where the second racer's command fails outright.
  Both are real defects the lock fixes, but I want to flag the difference rather than
  claim I reproduced the precise failure mode verbatim.
- `LOCK_TIMEOUT_MS` (15s) and `LOCK_RETRY_MS` (25ms) are untested at their bounds —
  no test exercises the "still locked after timeout" error path (would need a held
  lock from a separate process for 15+ seconds, which I judged too slow to be worth
  adding to the suite). The message and control flow were read-reviewed but not
  executed.
- Stray temp directories: my mutation-testing runs (intentionally red tests) left
  ~47 `myctx-*` directories under the OS temp root because the test's own `rmSync`
  cleanup line never ran on a failing assertion. All were identified and removed
  before the final `npm test`/commit; `git status --porcelain` is clean and the temp
  root was empty of `myctx-*` entries at the end of the session.
