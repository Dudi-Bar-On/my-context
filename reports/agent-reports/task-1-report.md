# Task 1 Report: Disposable Workspace Module

## Summary
Successfully implemented disposable, isolated workspace creation and cleanup module for the mycontext test harness.

## What was created

### 1. `harness/lib/workspace.mjs`
- Exported `REPO`: Absolute path to the plugin clone under test (`D:\Users\UserC\source\repos\test_mycontext_plugin\my-context`)
- Exported `SCRATCH`: Absolute path to workspace directory (`harness/.scratch`)
- Exported `CLI`: Absolute path to plugin CLI entrypoint (`my-context/src/cli/index.ts`)
- Exported `createWorkspace()`: Async function that creates a fresh, initialized workspace via `mycontext init`
- Exported `destroyWorkspace(dir)`: Async function that safely removes a workspace after validating it lives in SCRATCH
- Uses Node.js standard library only (fs/promises, child_process, path, util, url)

### 2. `harness/self-test/workspace.test.mjs`
- Two test cases using Node's native test runner
- Test 1: Verifies `createWorkspace()` produces valid, isolated workspaces with `.my_context/config.json` and `.my_context/items/`
- Test 2: Verifies two workspaces are independent (one can be destroyed without affecting the other)
- Both tests verify the guard: workspaces do not live inside REPO

## Test Execution

### Initial run (Step 2)
```
$ node --test harness/self-test/workspace.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module '.../harness/lib/workspace.mjs'
✖ failing tests: 1
```

### Final run (Step 4)
```
$ node --test harness/self-test/workspace.test.mjs
✔ createWorkspace returns an initialised, isolated workspace (179.4522ms)
✔ two workspaces are independent (348.2911ms)
✔ tests 2
✔ suites 0
✔ pass 2
✔ fail 0
✔ duration_ms 589.8648
```

## Implementation Notes

**Decision:** The code was transcribed faithfully from the brief without modifications. The implementation uses:
- `mkdtemp()` with `join(SCRATCH, 'ws-')` prefix for unique workspace names
- `execFileAsync()` to invoke `node my-context/src/cli/index.ts init` in the workspace cwd
- A safety guard in `destroyWorkspace()` that throws if the path doesn't start with SCRATCH
- Direct TypeScript execution via Node 24's native type stripping (no build step required)

**Note on stderr:** The mycontext CLI emits `ExperimentalWarning: SQLite is an experimental feature` on stderr during `init`. This is expected and does not cause test failure.

**Windows paths:** The test assertion `!ws.startsWith(REPO)` correctly validates workspace isolation because REPO and SCRATCH are siblings — workspaces are created under `harness/.scratch`, not inside `my-context`.

## Commit
```
3872faf feat(harness): disposable mycontext workspaces
  2 files changed, 55 insertions(+)
  create mode 100644 harness/lib/workspace.mjs
  create mode 100644 harness/self-test/workspace.test.mjs
```

## Status (after Fix Round 1)
DONE. Task 1 is complete and ready for Task 2 dependencies.

---

## Fix Round 1: Guard Hardening

**Critical Issues Fixed:**
1. **Bypassable path prefix check**: The original guard `!dir.startsWith(SCRATCH)` had no path-separator boundary and did not resolve paths, allowing:
   - Sibling directory traversal (e.g., `SCRATCH + '-backup'` would pass while being outside SCRATCH)
   - Unresolved path traversal via `..` segments (e.g., `SCRATCH + '/..'` resolves outside the intended directory)

2. **No negative test**: The original two tests only exercised legitimate paths in SCRATCH, leaving the guard untested against actual bypass attempts.

**Changes Made:**

### harness/lib/workspace.mjs
- Added imports: `resolve`, `sep` from `node:path`
- Resolved `SCRATCH` at definition time: `export const SCRATCH = resolve(join(here, '..', '.scratch'))`
- Hardened `destroyWorkspace()`:
  ```javascript
  const resolved = resolve(dir);
  if (!resolved.startsWith(SCRATCH + sep)) {
    throw new Error(`refusing to remove a path outside SCRATCH: ${dir}`);
  }
  await rm(resolved, { recursive: true, force: true });
  ```
  This ensures:
  - Both sides are resolved to canonical paths
  - Separator boundary prevents sibling-path bypass
  - Rejects `destroyWorkspace(SCRATCH)` itself (would delete shared root)

### harness/self-test/workspace.test.mjs
- Added imports: `SCRATCH` from workspace module, `resolve` from `node:path`
- Added negative test: `destroyWorkspace refuses paths outside SCRATCH`
  - Tests sibling directory bypass: `SCRATCH + '-backup'`
  - Tests root deletion bypass: `SCRATCH` itself
  - Tests path traversal bypass: `join(SCRATCH, '..', '..', 'my-context')` (resolves to REPO)
  - Verifies rejection with `assert.rejects(/refusing to remove/)`
  - Confirms target still exists afterward (no accidental deletion)

**Test Results:**
```
$ node --test harness/self-test/workspace.test.mjs
✔ createWorkspace returns an initialised, isolated workspace (175.8658ms)
✔ two workspaces are independent (345.2014ms)
✔ destroyWorkspace refuses paths outside SCRATCH (0.6593ms)
ℹ tests 3
ℹ suites 0
ℹ pass 3
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 580.5748
```

**Fix Commit:**
```
0972da9 fix(harness): harden destroyWorkspace guard against path traversal bypasses
  2 files changed, 14 insertions(+)
  harness/lib/workspace.mjs: +3 imports, path resolution, boundary-checked guard
  harness/self-test/workspace.test.mjs: +2 imports, 1 new test with 3 bypass scenarios
```

**Verification:**
- Original tests still pass (isolation and independence verified)
- New guard test passes all three bypass attempts
- No regressions in createWorkspace or cleanup flow
