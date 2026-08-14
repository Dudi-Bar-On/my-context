# Task 7 report: the `ingest_document` MCP tool

Commit: `dcadaa9` — "feat: register the ingest_document MCP tool with the two-phase protocol"
Follow-up commit: see "Review round 2" section at the end of this report.

## What was implemented

1. **Shared lock module — `src/ingest/lock.ts` (new).** The ingest-apply lock
   (previously private to `src/cli/commands/ingest.ts`) was extracted into its
   own module so both entry points — the CLI's `ingest-apply` command and the
   new MCP `ingest_document` tool's phase two — import the *same*
   `acquireApplyLock`, not two copies. `src/cli/commands/ingest.ts` now imports
   it; all three lock-related test fixtures
   (`test/fixtures/hold-apply-lock.ts`, `hammer-apply-lock.ts`,
   `concurrent-ingest-apply.ts`) and `test/cli/ingest-lock.test.ts` were
   repointed at the new location.

2. **Lock construction hardened per the brief's prerequisite.** Replaced
   `openSync(file, 'wx')` + a separate `writeSync` with: write the full pid
   payload to a uniquely-named temp file, then `linkSync` that temp file into
   place, then unlink the temp file's own directory entry. `linkSync` only
   ever creates a new directory entry pointing at an inode that is *already
   fully written*, so there is no window in which the lock file exists but is
   empty or partial. This let me delete `LOCK_WRITE_GRACE_MS` and the
   unparseable-payload special case in `isStaleLock` entirely — a corrupt
   payload found there now just falls through to the ordinary
   `LOCK_STALE_MS` mtime backstop, the same as a parseable payload with no
   usable `pid`, since the only way to produce one now is genuine
   corruption, not a construction race.

3. **`release()` ownership check — added.** `release()` now reads the lock
   file back and only removes it if it still names *this process's* pid;
   otherwise it leaves the file alone. This closes the cascade the brief
   describes: an unconditional `rmSync` would let a stolen-from holder's
   `release()` delete a legitimate new holder's lock. Decision: I chose "skip
   removal silently" over "throw" for the not-mine case, since `release()`
   runs in a `finally` and must never itself introduce a new failure mode on
   an already-completed (successful or failed) apply; a leaked lock file in
   this specific scenario is still bounded by `LOCK_STALE_MS`/PID-liveness
   staleness detection on the next acquirer.

4. **`src/mcp/tools/ingest.ts` (new).** `INGEST_DOCUMENT_SCHEMA` and
   `runIngestDocument(ctx, args)`, phase-selected by which of `path` /
   `session` is present, exactly as the brief specifies. Phase two wraps
   `loadSession` → `applyCandidates` → `saveSession` in
   `acquireApplyLock`/`release()` in a `try/finally`, mirroring the CLI's
   `cmdIngestApply`.

5. **Registration.** `ingest_document` added as the 11th entry in `SPECS`
   (`src/mcp/tools.ts`); dropped from `RESERVED_TOOLS`
   (`src/help/index.ts`, now `[]`); real description added to
   `src/help/topics/capture.md`'s `## Tools` section (verified ≤200 chars,
   carries `Not for:`).

6. **Repair-loop ordering hazard — resolved.** The brief's Step-3 code
   listing emits the rejected-candidate report *and* the next chunk's
   extraction request in the same response whenever any candidates were
   accepted alongside rejects (an anchor with partial success is still
   marked "applied", so `pendingAnchors` moves on). I did not implement it
   that way. `phaseTwo` in `src/mcp/tools/ingest.ts` returns **only** the
   rejection report — with an explicit "do not request the next chunk yet…
   call again with session X, anchor Y" instruction — whenever
   `result.issues.length > 0`, and only ever advertises the next chunk's
   request when there were no rejects. This makes "fix and resubmit against
   the same anchor" always the single next action, never a parallel option
   next to starting a new chunk. I applied this fix only to the new MCP tool
   (Task 7's actual scope); the CLI's `cmdIngestApply` (shipped in Task 6)
   still emits both in one response. Flagging this as a known inconsistency
   between the two entry points, not silently left as-is.

## TDD evidence

- Wrote `test/mcp/ingest-tool.test.ts` verbatim from the brief first.
- `node --test test/mcp/ingest-tool.test.ts` before any implementation:
  failed with `Cannot find module '.../src/mcp/tools/ingest.ts'` —
  the expected failure.
- After implementing: `node --test test/mcp/ingest-tool.test.ts
  test/mcp/tools.test.ts` → 79/79 pass. `npx tsc --noEmit` → clean.

## Baseline count correction

The brief states the surface "currently has nine registered." I verified
against the actual pre-Task-7 `TOOL_NAMES` (via `git stash`) and found **ten**
already registered (`load_context` was already live), plus `ingest_document`
reserved — eleven documented names total, confirmed by the pre-existing
(and already-passing) test titled `'the registry exposes exactly the ten
implemented tools'`. I updated the count-based tests to **eleven** rather
than ten, since that is what's actually true of this codebase. I also found
and fixed two more shipped assertions hard-coding the old count in
`test/mcp/server-e2e.test.ts` (not listed in the brief's Files section, but
broken by this change): `tools.length` assertions at lines 124 and 237,
both `10 → 11`.

## Mutation testing — every concurrency-related guard

All mutants below were hand-injected into `src/ingest/lock.ts`, run against
`test/cli/ingest-lock.test.ts`, then reverted (verified restored file passes
15/15 before moving to the next mutant).

| Mutant | Result |
|---|---|
| Delete the ownership check in `release()` (unconditional `rmSync`) | **Caught** — new test `release() does not delete a lock file that no longer names this process as the holder` fails |
| Reintroduce the old non-atomic `openSync('wx')` + delayed `writeSync` construction, with a 700ms injected stall (the exact reviewer repro) | **Caught** — `ingest-apply locks in two different workspaces do not block each other` and `a tight multi-process acquire/release hammer never throws an uncaught lock error` both fail |
| `isProcessAlive` check short-circuited to always "alive" (`!true` instead of `!isProcessAlive(...)`) | **Caught** — `a lock left behind by a dead process is reclaimed quickly, not after the full timeout` fails (times out near 15s instead of near-instant) |
| `isRetryableLockError` drops the `EPERM` case | **Caught** — the direct unit test `isRetryableLockError treats EEXIST and EPERM as retryable, nothing else` fails immediately |

I added one new regression test specifically for the `release()` ownership
check (`release() does not delete a lock file that no longer names this
process as the holder`) since none of the shipped tests exercised that
scenario before this task — it simulates the cascade directly against the
lock file (acquire, overwrite with a different pid's payload, release, assert
survival) rather than trying to trigger a genuine staleness misjudgment.

### Pass rate over 8 runs (unmutated code)

- `test/cli/ingest-lock.test.ts` (15 tests, all concurrency-related):
  **8/8 runs, 15/15 passing every run** (`PowerShell` loop).
- `test/mcp/ingest-tool.test.ts` + `test/mcp/tools.test.ts` (79 tests):
  **8/8 runs, 79/79 passing every run.**

## Lock construction — how exclusion was verified

- All 15 tests in `test/cli/ingest-lock.test.ts` pass, including the two
  deterministic cross-process exclusion tests (`spawnHolder`'s
  `ACQUIRED`-signal pattern, unchanged from Task 6) at both a 400ms and a
  longer hold.
- Rewrote the three `BAD_PAYLOADS` (`empty`, `truncated`, `null`) tests: the
  old versions asserted a bounded reclaim window justified by
  `LOCK_WRITE_GRACE_MS`, which no longer exists. Replaced with two tests per
  payload: (a) a corrupt payload **backdated** past `LOCK_STALE_MS` via
  `utimesSync` is reclaimed near-instantly (mtime backstop), and (b) a
  corrupt payload with a **fresh** mtime is *not* treated as stale — proven
  by spawning a real acquirer against it, confirming it is still blocked
  after 250ms, then removing the file and confirming it unblocks
  immediately after removal (same technique the existing live-pid test
  uses).
- Directly injected the reviewer's exact repro (700ms stall between empty
  creation and payload write) as a mutant against the *old* construction
  shape and confirmed the current suite kills it (see table above).

## Concerns

1. **CLI/MCP repair-loop ordering inconsistency.** As noted above, the CLI's
   `ingest-apply` command still emits the rejection report and the next
   chunk's request together, unlike the MCP tool. This wasn't in Task 7's
   file list to fix, but it's the same UX hazard on the other entry point —
   worth a follow-up task or at minimum a decision on whether to unify.
2. **`release()`'s ownership check** trusts a `readFileSync` + `JSON.parse`
   immediately before `rmSync`; there is a small window between that read
   and the delete where the file could theoretically change again. Given
   the lock's own serialization guarantees this is not exploitable by two
   *legitimate* holders (only by a prior staleness misjudgment, which this
   check is a mitigation for, not a full fix for), but it's not a
   linearizable check-then-act.
3. The MCP tool's `phaseOne`/`phaseTwo` split doesn't hold the lock during
   `phaseOne` (session open + first request) — only `phaseTwo` (the actual
   apply) takes it, matching `applyCandidates`' own documented contract that
   only the read-decide-write-record section needs serialization. Confirmed
   this matches the CLI's behavior (`cmdIngest` vs `cmdIngestApply`).

## Full suite

`npm test` → **887 passed, 0 failed** (baseline was 872; net +15 from the
new `ingest-tool.test.ts` file (12 tests), the new `release()` ownership
test (1), and the `BAD_PAYLOADS` test split from 3 tests to 6 (+3), minus
one hold-duration test renamed in place, no net count change there).
`npx tsc --noEmit` clean. `git status --porcelain` is empty apart from the
intended changes (verified before commit).

## Review round 2 — fixes for I-1, I-5, I-4

### I-1 — `linkSync` on a filesystem without hard-link support

Confirmed the reviewer's finding: `linkSync` has no equivalent on
exFAT/FAT32 removable media, some SMB/NFS mounts, and some container volume
drivers, Node commonly surfaces the failure as `EPERM`, and
`isRetryableLockError` already treats `EPERM` as ordinary contention (it has
to, for the genuine Windows delete-pending case) — so the old code spun the
full 15s retry budget and then threw "another process may be applying
candidates," which is false on such a filesystem, on every single apply.

**Fix chosen: fall back to `openSync(file, 'wx')` + `writeSync`, not just a
clearer error.** Rationale: rethrowing with a better message still leaves
`ingest_document`/`ingest-apply` completely unusable on such a filesystem;
falling back keeps ingestion working there, at the cost of reintroducing the
empty/truncated-payload construction window ONLY on filesystems where
`linkSync` cannot work at all. That residual window is not a new hazard
beyond what this module already tolerates for any other corrupt payload:
`isStaleLock` treats an unparseable payload the same regardless of cause,
falling through to the `LOCK_STALE_MS` mtime backstop (errs toward NOT
stealing a possibly-live lock) rather than a dedicated grace period — so the
fallback is strictly safer than the pre-Task-7 two-step construction was,
just slower to recover from a crash mid-write on that specific class of
filesystem (already documented as a deliberate, user-visible trade-off —
see M-1 below).

**Detection**: after `linkSync(tmp, file)` throws, if the code is not
`EEXIST` AND `existsSync(file)` is false, the failure is structural (nothing
was actually created) rather than contention, and is not retried as
contention — a module-level `hardLinksSupported` flag latches to `false` so
later calls in this process skip straight to the fallback construction
instead of re-paying one guaranteed-failing `linkSync` attempt each time.

**How I verified it, and a real methodology problem I had to fix first**:
my first attempt at a test monkeypatched `node:fs`'s `linkSync` by
reassigning the property on the default-imported `fs` object from a test
fixture. It silently did nothing — `lock.ts` called `linkSync` via a
destructured named import (`import { linkSync } from 'node:fs'`), which
resolves to a value at import time, not a live binding, so the mock never
took effect and my first version of this test was passing by accident (it
never exercised the failure path at all). Verified this directly with a
minimal two-file repro (`fs.linkSync = mock` does NOT affect a
`{ linkSync }` named import elsewhere; it DOES affect a call written as
`fs.linkSync(...)` through the same default-imported object). Fixed by
changing the one call site in `lock.ts` to `fs.linkSync(tmp, file)` via a
default import kept alongside the existing named imports, with a comment
explaining why. `test/fixtures/force-linksync-failure.ts` now forces a real
`EPERM` from that exact call.

Confirmed the fix both ways:
- **Fixed code**: acquiring under a forced `linkSync` failure completed in
  ~90–105ms (measured across several runs), not ~15s, and two acquirers
  under the same forced failure still correctly excluded each other
  (`test/cli/ingest-lock.test.ts`, two new tests).
- **Mutant (detection removed)**: reran with the `hardLinksSupported`
  latch/fallback deleted — reproduced the reviewer's exact number almost
  precisely: **15,230ms**, then `Error: my_context: could not acquire the
  ingest-apply lock (...) after 15000ms. Another process may be applying
  candidates in this workspace — try again shortly.` Confirms the new test
  genuinely detects the regression, not merely a coincidentally-fast pass.

### I-5 — the repair-loop deviation was untested

Added `'a rejection response never also advertises the next chunk, and says
what to do instead'` to `test/mcp/ingest-tool.test.ts`:
`assert.doesNotMatch(out, /EXTRACTION REQUEST/)` plus a match on `/Do not
request the next chunk yet/`.

Mutation-tested by reverting `phaseTwo` to the brief's original body
(rejection report and next-chunk request emitted unconditionally together).
Result: **11/12 tests in the file still passed** — only the new test failed,
confirming the reviewer's claim precisely (they said 11/11 against the then
11-test file; the file now has 12 tests including this one, so 11 pass /
1 fails is the equivalent result).

### I-4 — CLI and MCP taught opposite next actions for the same event

Reworded `cmdIngestApply`'s rejection message in `src/cli/commands/ingest.ts`
to match `phaseTwo`'s: "fix and resubmit ONLY these... before doing anything
else," plus an explicit "Do not request the next chunk yet" instruction
naming the exact `mycontext ingest-apply` re-invocation. Gated the
next-chunk request (and the "every chunk is applied" completion message) on
`result.issues.length === 0`, same condition the MCP tool now gates on.

Extended the existing CLI test `'ingest-apply reports issues and still keeps
the good candidates'` (which uses a session with a second pending anchor, so
it previously would have printed the next chunk's ~40-line request right
after the rejection) with the same two assertions used on the MCP side:
`assert.doesNotMatch(out, /EXTRACTION REQUEST/)` and a match on `/Do not
request the next chunk yet/`. Both surfaces now teach the same next action
for the same event.

### Full-suite verification (run twice, per instructions)

`npm test` — **890 passed, 0 failed**, both runs. (887 baseline for the
first commit + 2 new `linkSync`-fallback tests + 1 new I-5 test = 890; the
I-4 fix extended an existing test rather than adding a new one.)
`npx tsc --noEmit` clean. `git status --porcelain` shows only the intended
changes:

```
 M src/cli/commands/ingest.ts
 M src/ingest/lock.ts
 M test/cli/ingest-lock.test.ts
 M test/cli/ingest.test.ts
 M test/mcp/ingest-tool.test.ts
?? test/fixtures/force-linksync-failure.ts
```

One temp root per run throughout (each test's `project()`/`mkdtempSync` call
is paired with its own `rmSync(..., { recursive: true, force: true })`);
scratch files used for the nested-try/catch-semantics sanity check and the
named-vs-default-import mocking repro were written and removed outside the
worktree's tracked paths and confirmed gone before finishing.

### Follow-ups recorded, not fixed (per coordinator instruction)

- **I-2/I-3**: `release()`'s ownership check is pid-granular and the lock's
  mtime is set once at construction and never refreshed, so a holder whose
  critical section exceeds `LOCK_STALE_MS` is judged stale despite a live
  pid, and two acquisitions by the same process are indistinguishable to the
  check. Not fixed this round. A per-acquisition nonce plus either an mtime
  heartbeat or pid-only staleness would close both; left for a follow-up
  task since it changes the payload shape and staleness contract, not a
  same-shape fix.
- **I-6**: no concurrency test touches the MCP entry point directly, and a
  naive one would not be sharp enough — `store.all()` inside
  `applyCandidates` is a live SQLite read, so removing the lock alone does
  not reliably reproduce a double-hold without a sharper trigger (e.g. an
  injected stall between the read and the write, mirroring how the CLI-side
  concurrency tests are constructed).
- **M-2**: three known-surviving mutants in the new code: deleting the
  `rmSync(tmp)` cleanup (the `lockFiles()` test helper only checks
  `.endsWith('.lock')`, so a leaked `.tmp-*` file is invisible to it);
  `tempCounter` uniqueness is untested; and the `LOCK_STALE_MS` backstop for
  a *parseable, live-pid* payload (the actual pid-reuse rationale) has no
  direct test. Also unresolved: a process killed between `openSync(tmp)` and
  the `finally` leaks a temp file nothing ever reclaims, and
  `.my_context/.ingest/` is not in `.gitignore`.
- **M-4**: the MCP path rebuilds outside the lock (`withWorkspace` rebuilds
  before calling `runIngestDocument`, which only then acquires the lock
  inside `phaseTwo`) while the CLI rebuilds inside it
  (`acquireApplyLock` is taken before `openMutateContext`, which rebuilds).
  `lock.ts`'s own comment describes the critical section as starting at
  context open — the MCP path does not currently match that description.
  Not fixed this round; needs a decision on whether `withWorkspace`'s rebuild
  timing can move, since it is shared by all ten other tools.
- **M-1**: recoverability for a genuinely corrupt lock went from 500ms
  (the old grace period) to 5 minutes (`LOCK_STALE_MS`, the mtime backstop
  now handling that case too). Deliberate, and now also user-visible on the
  `linkSync`-unsupported fallback path (I-1) whenever a payload is
  observed mid-write. Recorded in `acquireApplyLock`'s doc comment; still
  worth a explicit callout the next time this module's user-facing behavior
  is documented outside the source.
- **M-5** (arithmetic correction from round 1): the original report's "872 +
  12 + 1 + 3" breakdown for the first commit was wrong in its parts — the
  `ingest-tool.test.ts` file has 11 tests, not 12 (it gained a 12th only in
  this round, via I-5). The 887 total for the first commit was correct; only
  the itemized breakdown was not.
