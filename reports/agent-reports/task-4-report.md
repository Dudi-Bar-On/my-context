# Task 4 Report: Hook Binary Driver

## Status
**DONE**

## Summary
Implemented the hook driver module (`harness/lib/hooks.mjs`) that spawns and manages the four hook binaries with proper timeout handling, error recording, and payload marshalling. All tests pass.

## Created Files
1. **`harness/lib/hooks.mjs`** — Hook driver module
   - Exports `HOOKS` object mapping hook keys to absolute TypeScript script paths
   - Exports `runHook(hookKey, payload, {cwd})` Promise function
   - Returns object with `{hook, exitCode, stdout, stderr, durationMs, timedOut, childError}`

2. **`harness/self-test/hooks.test.mjs`** — Tests for the hook driver
   - Tests normal operation with valid JSON payload
   - Tests fail-open behavior on garbage stdin

## Implementation Details

### Timeout Handling
Mirrors the `harness/lib/run.mjs` pattern exactly:
- 30-second timeout via `setTimeout`
- `timedOut` field initialized to `false`
- `child.kill()` called on timeout
- `clearTimeout(timer)` called on normal exit
- `timedOut` present on resolved object in all paths

### Error Recording
Added error listeners as per controller requirements:
- `child.on('error', ...)` records child process errors
- `child.stdin.on('error', ...)` records stdin errors
- Errors recorded to `childError` field (null when no error)
- Errors are recorded rather than thrown, preventing early termination of the 31-case sweep

### Payload Handling
- Strings passed as-is to stdin (used for garbage-input and empty-input test cases)
- Objects JSON-stringified before writing to stdin

### Environment
- Spawns hook scripts with absolute paths
- Sets `CLAUDE_PROJECT_DIR` env var to workspace directory (required by plugin invariant `INV-hooks-fail-open`)

## Test Execution

### Command
```bash
node --test harness/self-test/hooks.test.mjs
```

### Output
```
✔ session-start emits the injection block on stdout (510.8298ms)
✔ hooks fail open on garbage stdin (282.0298ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 859.5081
```

## Decisions

### Test Modification
The brief's test code did not add any items to the workspace after initialization. An empty workspace produces no injection block output (no items → empty selection → no "my_context" header). The test would fail.

Modified the test to add a single reference item after workspace creation via:
```javascript
await execFileAsync(process.execPath, [CLI, 'add', 'reference', 'test', '--body', 'test', '--yes'], { cwd: ws });
```

This allows the injection block to render with the "my_context" marker, making the test meaningful and passing.

### Path Handling
Hook script paths in `HOOKS` object are computed at module load time using `join(REPO, 'src', 'hooks', '<name>.ts')`, yielding absolute paths. This is correct because:
- `REPO` is an absolute path from `workspace.mjs`
- Absolute paths work correctly regardless of the `cwd` passed to `spawn()`
- TypeScript files are run directly by Node (via built-in type-stripping in Node 24+)

## Concerns

### None identified
The implementation follows the brief's specifications and controller requirements:
- Timeout pattern matches `run.mjs` exactly
- Error listeners record rather than throw
- Payload marshalling handles both strings and objects
- stdin write/end pattern preserves correct behavior
- All fields required by later tasks (`exitCode`, `stdout`, `stderr`, `durationMs`) are present
- Additional fields (`timedOut`, `childError`) support robustness requirements

The test passes consistently and demonstrates both normal operation and fail-open behavior on malformed input.

## Commit
```
aaee979 feat(harness): hook binary driver
```

Commit includes:
- `harness/lib/hooks.mjs` (96 lines)
- `harness/self-test/hooks.test.mjs` (21 lines)

---

## Fix Round 1

Three critical issues were identified and fixed.

### IMPORTANT 3: Promise Could Hang on Spawn Failure
**Problem:** If `spawn()` fails at the OS level (e.g., cwd does not exist), the `'close'` event may never fire. The promise would hang forever because it resolved only on `'close'`, and the 30s timeout would just set `timedOut = true` and call `kill()` on a process that never started.

**Fix:** Implemented a settle-on-every-path pattern:
- Added `settled` boolean flag to guard against double-settling
- Created `finish(exitCode, err)` wrapper that clears timer and resolves exactly once
- Error handler (`child.on('error')`) now calls `finish(null, err)` immediately
- Stdin error handler (`child.stdin.on('error')`) calls `finish(null, err)` immediately  
- Timeout handler calls `finish(null, childError)` after `kill()` (guarantees settlement)
- Close handler calls `finish(exitCode, childError)` (normal path)

Result: Promise settles from every error path; spawn failure is now a recordable outcome (exitCode: null, childError set) instead of a stall.

### IMPORTANT 2: No Coverage of timedOut or childError
**Problem:** Both fields existed but no tests exercised either path. Tasks 2 and 3 ship covering tests; Task 4 needs them too.

**Fixes:**
1. **childError coverage:** Added test that calls `runHook` with a non-existent cwd (`/nonexistent/path/...`). Spawn fails immediately. Promise resolves within 3ms (not 5s timeout), confirming no hang. Assert:
   - `exitCode === null`
   - `childError` is non-null (contains the ENOENT error)
   - `timedOut === false`
   - `stdout === ''` and `stderr === ''`

2. **timedOut coverage:** Added optional `timeoutMs` parameter to `runHook()` (defaults to 30000). Test calls `runHook(..., { cwd: ws, timeoutMs: 1 })`. Hooks take 90–140ms, so 1ms budget fires timeout deterministically. Assert:
   - `timedOut === true`
   - `exitCode === null`

### IMPORTANT 1: Empty-Corpus Behavior Not Regression-Tested
**Problem:** Analysis showed empty workspace produces empty stdout (no items → no injection block). This is correct per plugin design, but with no assertion, a future change to `buildInjection` or `renderSelection` could silently break the expectation.

**Fix:** Added regression test `session-start emits nothing on an empty corpus`:
- Creates workspace (no items added)
- Calls `runHook('sessionStart', ...)`
- Asserts `exitCode === 0` (fails open)
- Asserts `stdout === ''` (injection block is empty string when corpus is empty)

This pins the real behavior and will catch any regression.

### Test Results

#### hooks.test.mjs only (5 tests):
```
✔ session-start emits the injection block on stdout (517.4716ms)
✔ hooks fail open on garbage stdin (304.1871ms)
✔ session-start emits nothing on an empty corpus (308.7319ms)
✔ recordable outcome on bad cwd: childError is set, promise resolves (3.0901ms)
✔ timedOut is set when timeoutMs expires (204.3461ms)
ℹ tests 5
ℹ suites 0
ℹ pass 5
ℹ fail 0
ℹ duration_ms 6212.0722
```

#### Full harness test suite (15 tests):
```
✔ session-start emits the injection block on stdout (639.2ms)
✔ hooks fail open on garbage stdin (324.3236ms)
✔ session-start emits nothing on an empty corpus (401.1011ms)
✔ recordable outcome on bad cwd: childError is set, promise resolves (1.7651ms)
✔ timedOut is set when timeoutMs expires (209.4462ms)
✔ handshake succeeds and lists 14 tools (403.4441ms)
✔ an undeclared argument is refused (392.4413ms)
✔ a JSON-RPC top-level error round-trips to a protocolError (357.6322ms)
✔ a dead child does not crash the process (386.068ms)
✔ bare invocation exits 1, --help exits 0 (657.5589ms)
✔ stdout and stderr are captured separately (425.9517ms)
✔ a command that reads stdin terminates instead of hanging (404.2879ms)
✔ createWorkspace returns an initialised, isolated workspace (214.845ms)
✔ two workspaces are independent (441.5449ms)
✔ destroyWorkspace refuses paths outside SCRATCH (0.7232ms)
ℐ tests 15
ℹ suites 0
ℹ pass 15
ℹ fail 0
ℹ duration_ms 6439.5891
```

### Fix Commit
```
f49c6e8 fix(harness): settle hook promise from every error path, add resilience tests
```

Modifications:
- `harness/lib/hooks.mjs`: Added `settled` flag, `finish()` wrapper, error-path settlement, optional `timeoutMs` parameter
- `harness/self-test/hooks.test.mjs`: Added 3 new tests (empty corpus, childError, timedOut)
