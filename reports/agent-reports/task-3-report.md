# Task 3 Report: MCP stdio JSON-RPC client

## Status
DONE (with one deliberate deviation from the brief's literal code — see Decisions below)

## What was created

- `harness/lib/mcp.mjs` — exports `openMcp(cwd)`, returning
  `{ initializeResult, listTools(), callTool(name, args), stderr(), close() }`.
  Transcribed from the brief verbatim, with one addition inside `close()`
  (see Decisions).
- `harness/self-test/mcp.test.mjs` — the two tests from the brief, transcribed
  verbatim:
  1. `handshake succeeds and lists 14 tools`
  2. `an undeclared argument is refused`

Both files were staged and committed together per the brief's Step 5.

## Steps followed

1. **Wrote the failing test** (`harness/self-test/mcp.test.mjs`) exactly as
   given in the brief.
2. **Ran it to confirm failure**:
   `node --test harness/self-test/mcp.test.mjs`
   → `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...harness\lib\mcp.mjs'`
   as expected (1 failing test).
3. **Wrote `harness/lib/mcp.mjs`** transcribing the brief's implementation.
4. **Ran the test again** — it failed consistently (not flaky) with `EBUSY:
   resource busy or locked, rmdir '...harness\.scratch\ws-xxxx'` on both
   tests. Root-caused and fixed (see Decisions), then reran to green.
5. **Committed** exactly per the brief's message:
   `feat(harness): MCP stdio JSON-RPC client`
   Commit: `24e291b`
   Files: `harness/lib/mcp.mjs`, `harness/self-test/mcp.test.mjs` (no other
   files touched; `my-context/` untouched — confirmed via `git status` before
   and after).

## Exact test command and full output (final, passing run)

```
$ node --test harness/self-test/mcp.test.mjs
✔ handshake succeeds and lists 14 tools (342.3728ms)
✔ an undeclared argument is refused (335.4958ms)
ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 737.7919
```

Reran 4 additional times (5 total) to rule out flakiness — all green,
durations consistently ~700-750ms total.

Also ran the full harness self-test suite (`node --test
harness/self-test/*.test.mjs`) to confirm no regression in the previously
built `workspace.mjs` / `run.mjs` tests: **8/8 pass** (2 new + 6 existing).

## Decisions made

1. **`close()` now waits for the child to actually exit, not just for
   `kill()` to be called.** The brief's literal code was:
   ```javascript
   async close() {
     rl.close();
     child.stdin.end();
     child.kill();
   }
   ```
   On Windows this is a real, 100%-reproducible bug in the test harness
   flow (not a protocol issue): `mcp.close()` is immediately followed by
   `destroyWorkspace(ws)` in both brief tests. `child.kill()` returns before
   the OS has actually torn down the process, and on Windows a live child
   process holds an open handle on its cwd. `destroyWorkspace`'s `rm(...,
   {recursive: true})` on that same directory then fails with `EBUSY:
   resource busy or locked, rmdir`. I verified this was deterministic (two
   consecutive full runs, both failing identically) before changing anything.

   Fix — wait for the `'exit'` event before resolving, guarding against the
   (rare) case the child already exited:
   ```javascript
   async close() {
     rl.close();
     child.stdin.end();
     if (child.exitCode === null && child.signalCode === null) {
       const exited = new Promise((resolve) => child.once('exit', resolve));
       child.kill();
       await exited;
     }
   },
   ```
   This does not change the public interface (`close()` still returns a
   `Promise<void>`, same call sites work unmodified), does not change any
   exported names, and does not touch protocol behavior — it only fixes a
   process-lifecycle race that is specific to Windows. Given the task's
   explicit "later tasks import these exact names" constraint, I limited
   the change to this one internal fix rather than altering any exported
   shape. Reran the test suite 5x after the fix; consistently green.

   I did not change `request()`'s stdin-write, the `rl.on('line', ...)`
   parser, or any of the JSON-RPC framing — those matched the protocol
   facts exactly on first try (see verification below).

2. Everything else was transcribed verbatim from the brief, including the
   `callTool` resolve-not-throw design and its explanatory comment.

## Verification against the brief's protocol facts

Ran ad hoc probes (not committed, just interactive verification) confirming:

- `initializeResult.serverInfo` → `{"name":"mycontext","version":"0.1.0"}`,
  matching the brief exactly.
- `tools/list` returns exactly 14 tools, including `load_context`.
- `stderr()` captures:
  `(node:NNNNN) ExperimentalWarning: SQLite is an experimental feature and
  might change at any time\n(Use \`node --trace-warnings ...\` to show
  where the warning was created)\n`
  — present and observable via the accessor, not suppressed, matching the
  brief's expectation.
- A tool-level refusal (`load_context` called with `{nope: 1}`) comes back
  as a **normal JSON-RPC result** (no `msg.error`), shaped as:
  ```json
  {
    "content": [{ "type": "text", "text": "my_context: load_context does not take \"nope\". It accepts: (no arguments). Nothing was written — an argument this tool cannot act on is refused rather than ignored." }],
    "isError": true
  }
  ```
  This confirms why `callTool` resolving (not throwing) matters: the
  refusal is delivered as `result.isError === true` with the message in
  `content[0].text`, so `request()` resolves normally and `callTool`
  returns it untouched — no exception path is even hit for tool-level
  refusals. The `try/catch` inside `callTool` exists for genuine
  JSON-RPC-level protocol errors (rejected `request()` promises), which is
  a distinct failure mode from tool-level `isError` refusals. Both are
  captured as resolved values, never thrown, which is exactly the
  guarantee later tasks (driving ~20 refusal cases) need.

## Concerns

- The Windows `close()`/EBUSY issue above is worth flagging to whoever
  reviews later tasks: if any later task independently reimplements a
  similar "kill and immediately clean up cwd" pattern (e.g., a different
  MCP-adjacent helper), it will hit the same race on Windows. This client's
  `close()` is now safe; nothing else needed changing.
- Cleaned up four leftover `.scratch/ws-*` directories from the earlier
  failing runs (orphaned before the `close()` fix, since `destroyWorkspace`
  itself had thrown). `.scratch/` is gitignored so this had no effect on
  the commit; noted for completeness.
- No other concerns. Zero runtime dependencies maintained (only
  `node:child_process`, `node:path`, `node:readline`, plus the sibling
  `workspace.mjs` import). stdout/stderr remain independently captured
  (`stderr` accumulated separately from the `readline`-parsed stdout
  stream; never merged).

---

# Fix round 1 of 5

Review flagged two Important findings against `harness/lib/mcp.mjs`.
Rationale from the review: a later task drives 54 sequential MCP cases
through this client (~20 deliberate refusals); a single bad case turning
into a whole-run hang or crash would be far worse than a single recorded
failure. Both are fixed below, both are covered by new tests, and no
regressions were introduced.

## Finding A — `request()` could hang forever

**Problem.** If a response for a pending `id` never arrived (server hangs,
sends a malformed line that never resolves the id, etc.), the promise
returned by `request()` never settled. That would hang `listTools()`,
`callTool()`, and even the `initialize` handshake inside `openMcp()`
itself, with zero diagnostic — indistinguishable from the test runner
simply being slow.

**Fix.** Mirrored the timeout-guard pattern `run.mjs` already uses for CLI
invocations (Task 2): a 30-second timer per request that clears on
settlement and otherwise rejects with a message naming the timed-out
method:

```javascript
const REQUEST_TIMEOUT_MS = 30_000;
```

`pending.set(id, { resolve, reject })` was changed to wrap both callbacks
so the timer is cleared on whichever path fires first (server response
races with `setTimeout`), preventing a leaked timer on the happy path.

Confirmed the existing `callTool` try/catch still wraps this: a timed-out
`request()` rejection is caught and converted to `{ protocolError: ... }`,
so a hung tool call now still comes back as a recorded value within 30s
instead of hanging the whole 54-case sweep indefinitely. No change was
needed to `callTool` itself for this — the wrapping was already correct
per the brief's original design.

## Finding B — an unhandled `'error'` event could crash the whole run

**Problem.** Neither `child` nor `child.stdin` had an `'error'` listener.
Node's default behavior for an unhandled `'error'` event is to throw,
which — for a `spawn()`ed child or its stdin — would abort the entire
process running the test/harness sweep, not just fail one case. This is
reachable if the server process dies between requests: the *next*
`child.stdin.write()` triggers a write-after-end/EPIPE-style error.

**Fix, three parts:**

1. **Recording listeners** added on both `child` and `child.stdin`, per the
   review's suggested shape:
   ```javascript
   let childError = null;
   child.on('error', (err) => { childError = err; });
   child.stdin.on('error', (err) => { childError = err; });
   ```
   Exposed via a new `childError()` accessor alongside `stderr()`. The five
   original members (`initializeResult`, `listTools`, `callTool`, `stderr`,
   `close`) keep their exact names and signatures; `childError` is
   additive.

2. **Drain `pending` on `'exit'`**, rejecting every in-flight request with
   a message naming the exit code/signal (or the recorded `childError` if
   one fired first), so a server that dies mid-flight fails those specific
   calls immediately instead of leaving them to hang until their own
   30-second timeout:
   ```javascript
   child.on('exit', (code, signal) => {
     const reason = childError
       ? `MCP server process error: ${childError.message}`
       : `MCP server exited (code=${code}, signal=${signal})`;
     for (const [id, { reject }] of pending) {
       pending.delete(id);
       reject(new Error(reason));
     }
   });
   ```

3. **Fail fast on `request()` for a server that's already dead**, rather
   than relying purely on the write-error / exit-drain paths (which are
   asynchronous and, in the specific case of calling `callTool` *after*
   `close()`, would otherwise leave the new request waiting on an `'exit'`
   event that already fired before this request even started — closer to
   a silent hang than a clean rejection). Added an upfront guard inside the
   `request()` executor, before touching `pending` or `stdin`:
   ```javascript
   const alreadyDead = child.exitCode !== null || child.signalCode !== null || !child.stdin.writable;
   if (alreadyDead) { reject(...); return; }
   ```
   and, for defense in depth against a write that fails despite passing
   that guard (e.g. a race right at process teardown), the `stdin.write()`
   call now takes a completion callback that rejects the specific pending
   entry on error rather than leaving it to the timeout:
   ```javascript
   child.stdin.write(json, (err) => {
     if (err && pending.has(id)) { pending.delete(id); clearTimeout(timer); reject(err); }
   });
   ```

All three pieces funnel into the same place: `callTool`'s existing
try/catch, so every one of these failure modes (timeout, dead-before-call,
dies-mid-call, write error) surfaces as `{ protocolError: <message> }`,
never as a thrown exception or a hang.

## Tests added

Both required tests were added to `harness/self-test/mcp.test.mjs`,
alongside the two from Task 3:

1. **`a JSON-RPC top-level error round-trips to a protocolError`** — calls
   `mcp.callTool('no_such_tool', {})`. Verified against
   `my-context/src/mcp/protocol.ts` first: unknown tool names hit
   `fail(id, ERROR_INVALID_PARAMS, 'Unknown tool: ${name}')` where
   `ERROR_INVALID_PARAMS = -32602` (protocol.ts lines 42, 131), returned as
   a top-level `{ jsonrpc, id, error: { code, message } }` via the `fail()`
   helper (lines 91-97) — i.e. `msg.error` is set, so the existing
   `rl.on('line', ...)` handler rejects and `callTool`'s catch converts it.
   Asserts the call resolves (doesn't throw) and that the resolved
   `protocolError` string contains both `-32602` and `no_such_tool`.
2. **`a dead child does not crash the process`** — closes the client, then
   calls `mcp.callTool('load_context', {})` again on the now-dead process.
   Asserts it resolves with a `protocolError` rather than throwing or
   hanging. This is the test that specifically exercises the
   "already-dead" fast-fail guard in `request()`.

## Test commands and full output

```
$ node --test harness/self-test/mcp.test.mjs
✔ handshake succeeds and lists 14 tools (322.0637ms)
✔ an undeclared argument is refused (326.3023ms)
✔ a JSON-RPC top-level error round-trips to a protocolError (335.1504ms)
✔ a dead child does not crash the process (322.4349ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1365.3999
```

Reran 2 more times — consistently 4/4 pass, ~1.37-1.38s total each time.

```
$ node --test harness/self-test/*.test.mjs
✔ handshake succeeds and lists 14 tools (397.5363ms)
✔ an undeclared argument is refused (381.2111ms)
✔ a JSON-RPC top-level error round-trips to a protocolError (374.4027ms)
✔ a dead child does not crash the process (358.624ms)
✔ bare invocation exits 1, --help exits 0 (654.6174ms)
✔ stdout and stderr are captured separately (407.1304ms)
✔ a command that reads stdin terminates instead of hanging (397.8786ms)
✔ createWorkspace returns an initialised, isolated workspace (216.6249ms)
✔ two workspaces are independent (455.5799ms)
✔ destroyWorkspace refuses paths outside SCRATCH (0.9027ms)
ℹ tests 10
ℹ suites 0
ℹ pass 10
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 1573.1473
```

10/10 pass across the full harness self-test suite — no regressions in the
Task 1/2 tests (`workspace.mjs`, `run.mjs`) or the original two Task 3
tests.

## Concerns after this round

- None new. `git status` before committing showed only
  `harness/lib/mcp.mjs` and `harness/self-test/mcp.test.mjs` modified;
  `my-context/` remains untouched; `.scratch/` left clean after the run
  (all workspaces destroyed successfully, including in the dead-child
  test, since `destroyWorkspace` runs after the process has already fully
  exited in every path).
