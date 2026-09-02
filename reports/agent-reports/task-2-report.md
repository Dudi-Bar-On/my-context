# Task 2 Report: Case Runner with Separated Streams

**Status:** DONE  
**Commit SHA:** f14d53c6d42cf062f6db50f465c2e1f4bda38401  
**Branch:** campaign/my-context-test

## Summary
Implemented the CLI case runner module (`harness/lib/run.mjs`) and comprehensive test suite (`harness/self-test/run.test.mjs`) with strict separation of stdout and stderr capture. Both tests pass (2/2).

## Files Created

### 1. `harness/lib/run.mjs`
Exports `runCli(args, { cwd, env = {} })` function that:
- Spawns the mycontext CLI via `process.execPath` and `CLI` path
- Captures stdout and stderr **separately** into distinct string buffers
- Pinned environment variables (`MYCONTEXT_WIDTH: '100'`, `MYCONTEXT_ASCII: '1'`) to ensure deterministic terminal output
- Returns a promise resolving with result object:
  - `argv`: command arguments
  - `cwd`: working directory
  - `exitCode`: process exit code (not discarded)
  - `stdout`: accumulated stdout string
  - `stderr`: accumulated stderr string
  - `durationMs`: execution duration

### 2. `harness/self-test/run.test.mjs`
Two test cases using Node's built-in `node:test` module:

**Test 1: "bare invocation exits 1, --help exits 0"**
- Verifies `mycontext` with no args exits code 1
- Verifies `mycontext --help` exits code 0
- Validates exit code distinction is preserved

**Test 2: "stdout and stderr are captured separately"**
- Invokes `mycontext status` command
- Asserts `ExperimentalWarning: SQLite is an experimental feature` lands only on stderr
- Asserts stdout remains clean (no contamination from stderr)
- Validates critical separation property

## Test Execution

### Step 2: Initial Failure (Expected)
```bash
$ node --test harness/self-test/run.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\Users\UserC\source\repos\test_mycontext_plugin\harness\lib\run.mjs'
```
✓ Failed as expected

### Step 4: Success After Implementation
```bash
$ node --test harness/self-test/run.test.mjs
✔ bare invocation exits 1, --help exits 0 (532.8968ms)
✔ stdout and stderr are captured separately (365.5769ms)

ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 959.3389
```
✓ Both tests passing

## Design Decisions

1. **Separate Stream Capture**
   - Used `child.stdout.on('data')` and `child.stderr.on('data')` with distinct buffers
   - String concatenation for each chunk (not buffering as arrays)
   - This is the critical property: the brief emphasizes a past defect stemmed from merged streams

2. **Environment Pinning**
   - Pinned `MYCONTEXT_WIDTH=100` and `MYCONTEXT_ASCII=1` to ensure reproducible table output
   - Merges with process.env and explicit overrides for determinism
   - Prevents terminal-dependent formatting variations

3. **Zero Dependencies**
   - Used only Node standard library (`node:child_process`, `node:test`, `node:assert/strict`)
   - No third-party modules (constraint satisfied)

4. **Exit Code as First-Class Result**
   - Exit code explicitly captured and returned (not discarded)
   - Brief notes plugin distinguishes exit codes deliberately

5. **Duration Tracking**
   - Captures millisecond-precision execution time for performance profiling

## Concerns

None. The implementation:
- Faithfully transcribes the brief's exact code
- Passes both test cases immediately
- Satisfies all global constraints (Node >= 24, ES modules, zero dependencies, separated streams, exit codes preserved)
- Properly handles the expected `ExperimentalWarning: SQLite` on stderr
- Does not modify anything in `my-context/` plugin directory

## Verification Checklist
- [x] Test file created at exact path
- [x] Implementation file created at exact path
- [x] Test fails before implementation (Step 2)
- [x] Test passes after implementation (Step 4)
- [x] Both tests passing (2/2)
- [x] Stdout and stderr captured separately (validated by test)
- [x] Exit codes preserved and distinct (bare=1, --help=0)
- [x] Committed with exact message
- [x] No runtime dependencies beyond Node stdlib
- [x] ES modules used (`.mjs` extension)

---

## Fix Round 1: Hang Guard for stdin-reading Commands

**Fix Commit SHA:** 9a4eaa66d8a34294f081d518f27e9c3b3c8c1f8c

### Problem Identified
The initial implementation left stdin open as a pipe. Commands that explicitly read from stdin (like `mycontext ingest-apply <id> --anchor <a> --stdin` and `mycontext lesson-stage <id> --stdin`) would block indefinitely waiting for input that never arrives, causing:
- Promise never resolves or rejects
- Test hangs instead of completing
- Entire CLI sweep stalls

### Solution Applied

#### 1. Close stdin immediately
Added `child.stdin.end()` right after spawn to signal EOF to commands expecting input. This forces commands reading stdin to receive EOF instead of blocking.

#### 2. Add 30-second timeout guard
Implemented timeout mechanism:
- Set 30-second timer on spawn
- If timeout fires, kill the child and mark `timedOut: true`
- Clear timeout on process close
- Converts hangs into evidence (not silent stalls)

#### 3. Extend result object
Added `timedOut` boolean field (7th field, alongside existing 6) so downstream tasks can:
- Detect when a command hung
- Distinguish timeout from normal exit
- Report hangs in coverage reports

#### 4. Add test proving stdin is closed
New test: "a command that reads stdin terminates instead of hanging"
- Invokes `mycontext ingest-apply ING-nope --anchor x --stdin`
- Asserts `timedOut === false` (command completes, not hung)
- Validates stdin closure works end-to-end

### Test Execution After Fix
```bash
$ node --test harness/self-test/run.test.mjs
✔ bare invocation exits 1, --help exits 0 (522.6203ms)
✔ stdout and stderr are captured separately (385.5887ms)
✔ a command that reads stdin terminates instead of hanging (357.9426ms)

ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1325.4883
```

### Changes Made
- `harness/lib/run.mjs`: Added stdin close, timeout logic, `timedOut` field
- `harness/self-test/run.test.mjs`: Added stdin test case

### Critical Properties Preserved
- Exit codes still first-class (not impacted by timeout/hang logic)
- stdout/stderr still captured separately (timeout guard is independent)
- All 6 original result fields kept exactly as-is (8 later tasks read them)
- Timeout is 30 seconds (adequate margin for legitimate slow commands)

### Concerns
None. The fix:
- Prevents silent hangs (hangs become visible via `timedOut`)
- Allows stdin-reading commands to complete gracefully
- Does not affect exit code semantics or stream separation
- Maintains full backward compatibility (new field is additive)
