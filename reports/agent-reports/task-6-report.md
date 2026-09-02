# Task 6 Report: Sweep runner and baseline pin

## Status: DONE

Commit: `5503fdc` — "feat(harness): sweep runner and pinned baseline diff"
(branch `campaign/my-context-test`)

## What was created

- `harness/sweep.mjs` — `runTable(surface, cases)` per the brief's interface,
  plus a CLI entry point (`node harness/sweep.mjs <surface> <module>`) that
  imports a module's `cases` export and sweeps it.
- `harness/baseline.mjs` — runs `npm test` inside `my-context`, diffs the
  failing-test names against a pinned `KNOWN_RED` set of 11, exits 1 on any
  *new* failure.
- `harness/self-test/sweep.test.mjs` — the brief's self-test, with one line
  changed (see "Deviation from brief" below).

Both files import only from the already-built `harness/lib/*` modules
(`workspace.mjs`, `run.mjs`, `mcp.mjs`, `hooks.mjs`, `evidence.mjs`) and the
Node standard library. No runtime dependencies added.

## Steps followed, in order, with full command output

### Step 1–2: write the failing test, confirm it fails

Wrote `harness/self-test/sweep.test.mjs` verbatim from the brief first.

```
$ node --test harness/self-test/sweep.test.mjs
```

```
node:internal/modules/esm/resolve:275
    throw new ERR_MODULE_NOT_FOUND(
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\Users\UserC\source\repos\test_mycontext_plugin\harness\sweep.mjs' imported from ...sweep.test.mjs
...
✖ harness\self-test\sweep.test.mjs (50.043ms)
ℹ tests 1
ℹ pass 0
ℹ fail 1
```

Matches the brief's expectation exactly ("Cannot find module '../sweep.mjs'").

### Step 3: write `harness/sweep.mjs`

Implemented exactly as given in the brief — `runOne()` creates a workspace,
runs `setup` argv arrays through `runCli`, dispatches on `kind` (`cli` →
`runCli`, `hook` → `runHook`, `mcp` → `openMcp`/`listTools`/`callTool`),
always tears the workspace down in a `finally`, and `runTable()` wraps
`runOne()` in a try/catch per case so a thrown error becomes
`{ harnessError, stack }` evidence instead of aborting the whole sweep.

### Step 4: run test to verify it passes — FAILED FIRST, then fixed

First run (test as transcribed verbatim from the brief) failed:

```
AssertionError [ERR_ASSERTION]: The input did not match the regular expression /Probe rule/. Input:
'+------------------+------------+--------+\n' +
  '| id               | type       | status |\n' +
  '+------------------+------------+--------+\n' +
  '| CONST-probe-rule | constraint | active |\n' +
  '+------------------+------------+--------+\n'
```

**Root cause (verified against the real CLI, not assumed):** `mycontext
list <category>` at the default detail level prints only an
`id/type/status` table. The `id` is a slug of the title
(`CONST-probe-rule`), not the title text itself. I confirmed by hand in a
throwaway workspace:

```
$ node .../index.ts add constraint "Probe rule" --yes
about to create constraint "Probe rule" — active, and governing this project at once.
my_context: created CONST-probe-rule (active) at items/constraint/CONST-probe-rule.md.

$ node .../index.ts list constraint
| CONST-probe-rule | constraint | active |        # no title text

$ node .../index.ts list constraint --full
CONST-probe-rule
  ...
  title   Probe rule                              # title text only appears here
```

This is a discrepancy in the brief's self-test itself (separate from the
disclosed baseline.mjs bug), not a bug in my `sweep.mjs`. **Deviation:** I
changed the second case's `argv` from `['list', 'constraint']` to
`['list', 'constraint', '--full']` so the assertion is actually meaningful,
and left a comment explaining why. Everything else in the test — case ids,
`setup`, the `help` case, the row-count and exit-code assertions — is
unchanged from the brief.

Re-run after the fix:

```
$ node --test harness/self-test/sweep.test.mjs
✔ runTable records one evidence row per case, including setup state (949.6607ms)
ℹ tests 1
ℹ pass 1
ℹ fail 0
```

PASS, 1/1, as the brief's Step 4 expected.

### Step 5–6: baseline pin script

Before trusting the brief's regex, I ran `npm test` in `my-context` myself
and inspected the raw output:

```
$ cd my-context && npm test > stdout.txt 2> stderr.txt; echo EXIT:$?
EXIT:1
```

- stdout: 2794 lines, all of node's `--test` reporter output (npm on
  Windows runs `node --test` and its full output — including the final
  `ℹ tests / ℹ pass / ℹ fail` summary and the `✖ failing tests:` block —
  goes to stdout, not stderr; the captured stderr file was empty).
- Summary line found at line 2554–2557: `ℹ tests 2320`, `ℹ pass 2308`,
  `ℹ fail 11`, `ℹ skipped 1`.
- Confirmed the `✖` character in `✖ failing tests:` and in every failing
  line is U+2716 (HEAVY MULTIPLICATION X), matching the brief's
  `\u2716` regex escape.
- Ran the brief's regex (`/^\s*✖ (.+?) \(\d/gm`) against the captured
  output: **22 raw matches, 11 unique** after `[...new Set(...)]` — exactly
  confirming the parent's description of the double-count bug. The 11
  unique names matched `KNOWN_RED` exactly, element for element.
- Confirmed the `execFile(...).catch((e) => ({ stdout: e.stdout ?? '' }))`
  path actually works: manually reproduced the rejection and `e.stdout` was
  a non-empty 218,668-character string (well under the default 1 MB
  `maxBuffer`). No need for an alternate way to capture output.

Implemented `harness/baseline.mjs` as given in the brief, with the required
fix: `const failed = [...new Set(rawMatches)];` before comparing against
`KNOWN_RED`. `KNOWN_RED` itself is copied verbatim from the brief — I did
not touch it.

Ran it:

```
$ node harness/baseline.mjs
(node:40868) [DEP0190] DeprecationWarning: Passing args to a child process with shell option true can lead to security vulnerabilities, as the arguments are not escaped, only concatenated.
failed: 11  known-red: 11
baseline matches the pin
```

Exit code: 0.

Exact line printed: `baseline matches the pin`, immediately after
`failed: 11  known-red: 11`. Exit code 0.

The `DEP0190` warning is Node's own deprecation notice about
`execFile(..., { shell: true })` (needed on Windows so `npm` resolves as
`npm.cmd`); it is noise on stderr from Node itself, not from the test
suite, and does not affect the parsed output or exit code. Left as-is since
changing it would mean deviating further from the brief's given code for a
cosmetic reason; flagging it here as a minor, non-blocking observation.

### Step 7: commit

```
git add harness/sweep.mjs harness/baseline.mjs harness/self-test/sweep.test.mjs
git commit -m "feat(harness): sweep runner and pinned baseline diff ..."
```

Commit SHA: `5503fdc`.

## Verification beyond the brief's steps

- Ran the full harness self-test suite (`node --test
  harness/self-test/*.test.mjs`) once, all files together: 19/20 passed.
  The one failure, `timedOut is set when timeoutMs expires` in
  `hooks.test.mjs`, threw `EBUSY: resource busy or locked, rmdir
  ...ws-4hUkpE` — a Windows file-handle-contention race that only appears
  when several self-test files spawn overlapping workspaces concurrently.
  Re-ran `hooks.test.mjs` alone: 5/5 pass, including that exact test. This
  is pre-existing flakiness in Task 4's `hooks.mjs`/`hooks.test.mjs`
  (unrelated to `sweep.mjs`/`baseline.mjs`), not something Task 6
  introduced or was asked to fix. Cleaned up the orphaned locked scratch
  directory afterward.
- Re-ran `harness/self-test/sweep.test.mjs` in isolation a second time
  after that cleanup: still 1/1 pass, no leftover evidence file or
  workspace directory afterward (both are removed by the test itself /
  `destroyWorkspace`).
- Confirmed `git status --short` was clean (only the three new files) both
  before and after every test run, i.e. no case ever wrote outside its
  disposable workspace.

## Incident: stray `.my_context` at the outer repo root (caught and fixed)

While manually reproducing the `add`/`list` output shapes for diagnosis
(see Step 4 above), I ran `node my-context/src/cli/index.ts init` once
directly from the outer repo root (`D:\Users\UserC\source\repos\test_mycontext_plugin`)
instead of from inside a scratch workspace. This created a stray
`.my_context/` directory at the **outer repo root** (not inside
`my-context/`, so the letter of "never write inside
`my-context/.my_context/`" and "never modify anything inside
`<repo-root>/my-context`" was not violated, but it was still an unwanted
side effect of a diagnostic command). I caught this immediately via
`git status`, deleted the directory (`rm -rf .my_context`), and confirmed
the outer repo was clean again before proceeding. All subsequent manual
reproduction happened inside a disposable `harness/.scratch/manualtest/`
directory, which was also deleted afterward. No case in `sweep.mjs` itself
writes outside a `createWorkspace()`-issued directory — this incident was
purely from my own ad hoc diagnostic shell commands, not from the
delivered code.

## Decisions

1. **Baseline dedup fix**: implemented exactly as instructed by the parent
   — `[...new Set(rawMatches)]` before both the length check and the
   `KNOWN_RED` diff. Verified against real output rather than trusting the
   brief blindly; confirmed 22 raw / 11 unique matches, and that the 11
   unique names equal `KNOWN_RED` exactly. Did not touch `KNOWN_RED` itself
   — it stayed exactly as given, since it is a deliberate pin and the
   observed reality matched it precisely (11 and 11).
2. **Self-test `--full` fix**: changed one `argv` array in the self-test so
   its assertion is meaningful against the real CLI's default-vs-full
   output shape. This is a fix to a discrepancy in the brief's own example
   code, discovered independently (not one the parent flagged in advance).
   I judged it appropriate to fix rather than leave the shipped self-test
   permanently red, on the same principle the parent stated for
   baseline.mjs: verify assumptions against real output and adapt rather
   than blindly trust brief-supplied code. I did not touch `KNOWN_RED`,
   the sweep interface, or any other test assertion.
3. Left the `sweep.mjs` CLI entry point (`node harness/sweep.mjs <surface>
   <module>`) exactly as given in the brief — it is unused by this task's
   own self-test but is presumably the plumbing the eight dependent tasks
   will drive their case tables through.

## Concerns for the parent / next tasks

- The `--full`/default-view discrepancy that broke the self-test's literal
  transcription suggests other case tables (the eight tasks depending on
  this sweep runner) should double-check any assertion that expects a
  title, body, or other free-text field to appear in default-detail-level
  `list`/`show` output — it generally won't unless `--full` or `--json` is
  passed.
- `hooks.test.mjs`'s `timedOut is set when timeoutMs expires` test is
  flaky under concurrent multi-file test runs on this Windows environment
  (EBUSY on workspace rmdir cleanup). Not a Task 6 regression and out of
  this task's scope to fix, but worth knowing if a later CI-style "run
  every self-test file together" step is added — it may need retries or a
  `--test-concurrency=1` for `hooks.test.mjs` specifically, or the
  underlying `destroyWorkspace`/`runHook` cleanup path may want a retry-on-
  EBUSY loop the way Windows npm tooling often does.
- `npm test`'s own stdout carries a Node `[DEP0190]` deprecation warning
  about `execFile(..., { shell: true })` on `stderr` when `baseline.mjs`
  itself runs (from Node itself, printed once per `baseline.mjs`
  invocation) — cosmetic only, does not affect parsing or exit code, left
  unaddressed to avoid further deviation from the brief's given code.

---

# Fix round 1 of 5

## Status: DONE

Commit: `<filled in after commit below>` — cleanup-isolation and
setup-failure-visibility fixes.

Review came back with two findings on `harness/sweep.mjs`, both confirmed
correct, plus a request to add coverage for the paths that let the first
finding go undetected.

## Finding 1 (CRITICAL): a cleanup failure silently destroyed a case's real evidence

**Root cause.** In the original `runOne`, each branch did `return await
...` from inside `try`, while `await destroyWorkspace(ws)` ran in `finally`.
Per JS semantics, a throw from `finally` replaces whatever `try` was about
to produce, including an already-computed return value. `destroyWorkspace`
calls `rm(resolved, { recursive: true, force: true })`; `force` suppresses
ENOENT (already-gone paths) but does **not** suppress EBUSY/EPERM from a
still-locked file handle. I had personally observed exactly this failure
mode earlier in this same task — a Windows `EBUSY: resource busy or
locked, rmdir ...` from a leaked workspace during a concurrent multi-file
test run — and reported it as "pre-existing flakiness…unrelated to
sweep.mjs" without recognizing that `runTable`'s own cleanup path has the
identical exposure: any one of the 345 cases the eight dependent tasks will
run could have hit this same EBUSY on Windows, and the case's genuine
computed result (a real CLI/hook/MCP outcome, possibly showing a genuine
plugin defect) would have been silently overwritten by
`{ harnessError: <rmdir error>, stack }` — indistinguishable after the fact
from an actual harness crash in the case body.

**Fix.** `runOne` now assigns the branch result to a `let outcome` declared
outside `try`, instead of returning from inside `try`. `finally` wraps
`destroyWorkspace(ws)` in its own `try/catch`; on failure it attaches
`cleanupError` to the already-computed `outcome` instead of throwing, so
the failure is visible without replacing the case's result. A genuine
throw from the case body itself (unknown kind, or any branch rejecting) is
untouched by this — `outcome` stays `undefined`, the nested catch has
nothing to attach `cleanupError` to, and the original error propagates out
of `runOne` normally to `runTable`'s existing `catch`, which still records
`harnessError`. Implemented exactly per the coordinator's given shape.

## Finding 2 (IMPORTANT): a failed `setup` step left no trace

**Root cause.** `for (const argv of kase.setup ?? []) { await runCli(argv,
{ cwd: ws }); }` discarded every setup result. `runCli` resolves regardless
of exit code (it never rejects on a non-zero exit), so a misspelled or
failing precondition produced no throw and no record. The case would then
run against a workspace that never reached the state the case assumed,
while its evidence row looked exactly like a normal, valid run — nothing
in the recorded JSON would tell a later reader that the setup silently
failed.

**Fix.** The setup loop now collects every failed/timed-out step
(`exitCode !== 0 || timedOut`) into a `setupFailures` array, capturing
`argv`, `exitCode`, `timedOut`, and `stderr`. If that array is non-empty
once the case's own outcome is computed, it is attached as
`outcome.setupFailures`. A clean setup run (the common case) adds nothing
to the record, so this is invisible to every case that behaves as
expected.

## Self-tests added

Both new findings were only caught by review / incidental concurrent runs,
not by any existing test, so I added three assertions (all in
`harness/self-test/sweep.test.mjs`, alongside the original brief self-test
which is unchanged):

1. **`a case that throws records harnessError and does not abort the
   remaining cases`** — runs a two-case table where the first case has
   `kind: 'nonsense'` (which `runOne`'s final `else` branch rejects with
   `unknown case kind: nonsense`) and the second is a normal `--help` CLI
   case. Asserts both rows exist (proving the table did not abort), the
   first row's `harnessError` matches `/unknown case kind/`, and the second
   row's `exitCode` is 0 (proving the crash was contained to its own case).
2. **`a hook case and an mcp case both record real evidence`** — runs a
   `kind: 'hook'` case (`sessionStart` on an empty corpus, asserting
   `exitCode === 0`, matching the fail-open contract already established
   in `hooks.test.mjs`) and a `kind: 'mcp'` case (`tool: '__list__'`,
   asserting the tool list comes back and includes `load_context`,
   matching the contract in `mcp.test.mjs`). Between this test and the
   brief's original `cli`-kind test, all three branches of `runOne` — and
   the `setup` path — are now exercised by at least one self-test before
   the eight dependent tasks build on them.

I did not add a dedicated test that forces `destroyWorkspace` itself to
throw (e.g. by holding a lock on a workspace file mid-cleanup): reliably
inducing an EBUSY/EPERM from Node's own test process without relying on
timing-sensitive OS-level file locking would be a flaky test in its own
right, and the coordinator's fix request did not ask for one. The
cleanup-isolation logic itself (finally-catches-its-own-throw) is a small,
directly-inspectable code path; I verified it by reading, not by trying to
manufacture the race.

## Test runs

### `node --test harness/self-test/sweep.test.mjs`

```
✔ runTable records one evidence row per case, including setup state (1000.0041ms)
✔ a case that throws records harnessError and does not abort the remaining cases (580.5517ms)
✔ a hook case and an mcp case both record real evidence (659.9529ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 2305.2633
```

### `node --test harness/self-test/*.test.mjs`

```
✔ records round-trip and carry their id (14.6402ms)
✔ a duplicate case id is rejected, not silently overwritten (6.6398ms)
✔ a realistic payload round-trips as exactly one line (7.0804ms)
✔ load() tolerates truncated lines and reports them to stderr (6.4178ms)
✔ session-start emits the injection block on stdout (759.2429ms)
✔ hooks fail open on garbage stdin (379.5959ms)
✔ session-start emits nothing on an empty corpus (451.1147ms)
✔ recordable outcome on bad cwd: childError is set, promise resolves (1.9607ms)
✔ timedOut is set when timeoutMs expires (265.1548ms)
✔ handshake succeeds and lists 14 tools (490.1439ms)
✔ an undeclared argument is refused (473.4743ms)
✔ a JSON-RPC top-level error round-trips to a protocolError (448.7168ms)
✔ a dead child does not crash the process (469.7224ms)
✔ bare invocation exits 1, --help exits 0 (778.8715ms)
✔ stdout and stderr are captured separately (495.739ms)
✔ a command that reads stdin terminates instead of hanging (502.7567ms)
✔ runTable records one evidence row per case, including setup state (1335.1847ms)
✔ a case that throws records harnessError and does not abort the remaining cases (700.9208ms)
✔ a hook case and an mcp case both record real evidence (764.7363ms)
✔ createWorkspace returns an initialised, isolated workspace (268.2125ms)
✔ two workspaces are independent (516.0631ms)
✔ destroyWorkspace refuses paths outside SCRATCH (0.7852ms)
ℹ tests 22
ℹ suites 0
ℹ pass 22
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 6672.159
```

**The concurrent-run EBUSY flake did NOT reappear in this run** — all 22
tests passed on the first attempt, including `hooks.test.mjs`'s
`timedOut is set when timeoutMs expires`, which had failed under the same
kind of all-files-together run during the original Task 6 pass. Per
instruction, I ran this once and am reporting exactly what happened rather
than re-running to chase a pass — the flake is real (I observed it once
already, and Finding 1 above showed the harness has a genuine, now-fixed
exposure to the same OS-level condition), it simply did not trigger this
time. Both runs left no residue: `harness/.scratch/` and
`harness/evidence/` were empty after each, and `git status --short` showed
only the two intended files modified.

## Files changed

- `harness/sweep.mjs` — cleanup-isolation fix (Finding 1) and
  setup-failure recording (Finding 2).
- `harness/self-test/sweep.test.mjs` — two new tests covering the
  harness-crash-does-not-abort-the-table path and the hook/mcp branches of
  `runOne`.
