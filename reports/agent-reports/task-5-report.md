# Task 5 Implementation Report: Evidence Store

## Summary
Successfully implemented the JSONL evidence store module with complete test coverage. All tests pass. Implementation follows the brief specification exactly.

## Files Created
1. `harness/lib/evidence.mjs` - Evidence store module (32 lines)
2. `harness/self-test/evidence.test.mjs` - Test suite (24 lines)

## Implementation Details

### Module: `harness/lib/evidence.mjs`
Provides three key exports:
- `EVIDENCE_DIR` - Path to evidence directory (`harness/evidence`)
- `record(surface, caseId, data)` - Appends evidence record to JSONL file, returns evidence id
- `load(surface)` - Loads all records for a surface from JSONL file

**Key design decisions:**
- Evidence IDs are formatted as `<surface>/<caseId>` to enable citation and lookup
- Duplicate ID detection throws with message containing "duplicate" to ensure correctness
- Records stored as single-line JSON via `JSON.stringify()` to maintain valid JSONL format
- No runtime dependencies (Node.js stdlib only)
- Pure ES modules (.mjs) with no external imports

**Duplicate-ID Refusal Enforcement:**
The implementation checks all existing records before appending. If a duplicate ID is found, it throws an Error with the message "duplicate evidence id: {id}". This is non-negotiable correctness enforcement: silently overwriting or appending would break traceability — a finding citing an id could resolve to the wrong run data.

### Test Suite: `harness/self-test/evidence.test.mjs`
Two test cases:

**Test 1: records round-trip and carry their id**
- Records a single evidence entry
- Verifies returned id matches expected format
- Loads records back from JSONL
- Confirms data round-trips correctly

**Test 2: a duplicate case id is rejected, not silently overwritten**
- Records initial evidence with a case id
- Attempts to record duplicate with different data
- Verifies operation rejects with error matching `/duplicate/` regex
- No silent overwrite or append occurs

## Test Execution

### Step 2: Initial test run (module not yet created)
```
$ node --test harness/self-test/evidence.test.mjs
Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'D:\Users\UserC\source\repos\test_mycontext_plugin\harness\lib\evidence.mjs'
Exit code 1
```
✓ Fails as expected

### Step 4: Test run after implementation
```
$ node --test harness/self-test/evidence.test.mjs
✔ records round-trip and carry their id (7.9482ms)
✔ a duplicate case id is rejected, not silently overwritten (4.4482ms)

ℹ tests 2
ℹ suites 0
ℹ pass 2
ℹ fail 0
```
✓ Both tests pass

## Commit Details
```
Commit SHA: 07e5f7c596962fdb48b481481be06d4e38083374
Message: feat(harness): JSONL evidence store with duplicate-id refusal
Files:
  - harness/lib/evidence.mjs (created)
  - harness/self-test/evidence.test.mjs (created)
Branch: campaign/my-context-test
```

## Design Rationale

### Append-Only Architecture
Records are appended to JSONL files rather than rewritten. This preserves all historical evidence and prevents accidental data loss. Each surface has its own JSONL file (e.g., `cli-capture.jsonl`).

### Duplicate Detection Upfront
Rather than lazy validation, the module checks all existing records before writing. This catches id collisions immediately during the sweep and fails fast, maintaining campaign integrity.

### JSONL Format
Single-line JSON records ensure:
- Valid line-delimited format for external tooling
- Proper escaping of newlines in stdout/stderr via `JSON.stringify`
- Easy append operations without rewriting the file
- Each record remains exactly one line

### Evidence ID Structure
Format `<surface>/<caseId>` enables:
- Citation in findings (e.g., "cli-capture/add-body-and-file-conflict")
- Lookup by readers (exact string match to locate record)
- Human-readable surface identification

## Dependencies and Constraints
- Node.js >= 24.0.0 (verified at build time)
- Zero runtime dependencies (stdlib only)
- No external modules imported
- Filesystem isolation (only touches `harness/evidence/` directory)
- No modifications to `my-context` directory

## Later Integration Points
- Eight tasks will call `record()` to append evidence
- Three tasks will call `load()` to retrieve records
- Signatures remain stable across all integrations

## Concerns
None. Implementation is minimal, correct, and fully tested.

---

# Fix Round 1: Critical and Important Findings

## Issues Addressed

### CRITICAL: Truncated Final Line Permanently Blocks Evidence File
**Problem:** `load()` threw on first unparseable line, rejecting entire JSONL file. Since `record()` calls `load()` internally for duplicate checking, a single truncated line (e.g., from a run killed mid-`appendFile`) permanently blocked all future `record()` and `load()` calls for that surface, making prior evidence unreachable.

**Solution:** Made `load()` tolerant of malformed lines:
- Parses line by line, collecting errors
- Skips unparseable lines but reports them to stderr with line numbers
- Returns all successfully parsed records
- Violates no campaign rule: truncation is explicitly noted, not silently dropped

**Code change:**
```javascript
export async function load(surface) {
  const path = file(surface);
  if (!existsSync(path)) return [];
  const text = await readFile(path, 'utf8');
  const records = [];
  const malformed = [];
  text.split('\n').forEach((line, i) => {
    if (!line) return;
    try {
      records.push(JSON.parse(line));
    } catch {
      malformed.push(i + 1);
    }
  });
  if (malformed.length) {
    process.stderr.write(
      `evidence: ${surface}.jsonl has ${malformed.length} unparseable line(s) at ${malformed.join(', ')} — skipped\n`,
    );
  }
  return records;
}
```

### IMPORTANT A: Payload Key Overwrites Lookup Key
**Problem:** Spread order `{ id, surface, caseId, ...data }` meant that if caller's `data` contained `id`, `surface`, or `caseId`, it would overwrite the computed values. Stored id would not match the id `record()` returned or findings cite, breaking traceability.

**Solution:** Reversed spread order to `{ ...data, id, surface, caseId }` so computed keys always win.

### IMPORTANT B: No Serialization Per Surface
**Problem:** Two concurrent `record()` calls for the same surface could both pass the duplicate check before either appends, creating a race condition. While sweeps run sequentially today, this module is the campaign's traceability guarantee and should not depend on caller discipline.

**Solution:** Serialized `record()` operations per surface using a promise chain:
```javascript
const chains = new Map();

export function record(surface, caseId, data) {
  const prev = chains.get(surface) ?? Promise.resolve();
  const next = prev.then(() => appendRecord(surface, caseId, data));
  // Keep the chain alive even if this write rejects, so one failure
  // does not wedge every later record() for the surface.
  chains.set(surface, next.catch(() => {}));
  return next;
}
```

Duplicate check and append now happen atomically per surface. One failure does not wedge later records.

## Test Coverage Added

**Test 3: a realistic payload round-trips as exactly one line**
- Records entry with multiline stdout, special characters, control codes
- Verifies payload occupies exactly one line in JSONL (no embedded newlines)
- Confirms byte-for-byte round-trip after parse

**Test 4: load() tolerates truncated lines and reports them to stderr**
- Records a good entry
- Manually appends truncated JSON line to file
- Confirms load() returns good record, not throws
- Verifies truncation reported to stderr

## Test Execution

### Full evidence test suite
```
$ node --test harness/self-test/evidence.test.mjs
✔ records round-trip and carry their id (7.6917ms)
✔ a duplicate case id is rejected, not silently overwritten (6.1377ms)
✔ a realistic payload round-trips as exactly one line (4.4743ms)
✔ load() tolerates truncated lines and reports them to stderr (5.3496ms)

ℹ tests 4
ℹ suites 0
ℹ pass 4
ℐ fail 0
```

### Full harness test suite (all 19 tests)
```
$ node --test harness/self-test/*.test.mjs
✔ records round-trip and carry their id (11.5679ms)
✔ a duplicate case id is rejected, not silently overwritten (6.0761ms)
✔ a realistic payload round-trips as exactly one line (6.1157ms)
✔ load() tolerates truncated lines and reports them to stderr (6.0721ms)
✔ session-start emits the injection block on stdout (643.7564ms)
✔ hooks fail open on garbage stdin (338.9136ms)
✔ session-start emits nothing on an empty corpus (359.6047ms)
✔ recordable outcome on bad cwd: childError is set, promise resolves (1.9948ms)
✔ timedOut is set when timeoutMs expires (208.5313ms)
✔ handshake succeeds and lists 14 tools (408.1827ms)
✔ an undeclared argument is refused (388.2854ms)
✔ a JSON-RPC top-level error round-trips to a protocolError (352.2596ms)
✔ a dead child does not crash the process (376.1466ms)
✔ bare invocation exits 1, --help exits 0 (638.4125ms)
✔ stdout and stderr are captured separately (421.4122ms)
✔ a command that reads stdin terminates instead of hanging (432.2859ms)
✔ createWorkspace returns an initialised, isolated workspace (234.8435ms)
✔ two workspaces are independent (435.82ms)
✔ destroyWorkspace refuses paths outside SCRATCH (1.1667ms)

ℹ tests 19
ℹ suites 0
ℹ pass 19
ℹ fail 0
ℹ duration_ms 6415.4961
```

All tests pass. No regressions.

## Fix Commit
```
Commit SHA: 8f9100980d9c79d170f3e0e1f6b7ded2feee1429
Message: fix(harness): tolerant load, key-order protection, and per-surface serialization
- Make load() tolerant of truncated lines (logs to stderr, continues)
- Reverse spread order to protect id/surface/caseId from payload overwrite
- Serialize record() calls per surface to prevent concurrent duplicate-check races
- Add tests for realistic payloads and truncated line recovery
```
