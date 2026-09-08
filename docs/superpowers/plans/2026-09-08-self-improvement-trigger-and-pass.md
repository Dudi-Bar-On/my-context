# Self-improvement loop — Phase 2 (D36b): the trigger and the pass

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decide *when* to look at a session and *what to read*, and prove the
decision is cheap and never blocks the user — without proposing anything yet.

**Architecture:** A counter written where an audit row is already written, a
rubric that decides whether a firing is worth anything, and a detached child
that reads the whole transcript through the reader `restore/1` already built.
Phase 2 ends with a pass that **reads and reports and writes nothing** — so it
can run on real sessions for days before it is allowed to propose.

**Tech Stack:** TypeScript on Node 24 native type stripping, zero runtime
dependencies, `node:test`.

**Spec:** `docs/superpowers/specs/2026-09-08-self-improvement-loop-design.md`
— §2 (trigger), §3 (input), §5 (the fork), §11 (config).

**Depends on:** D36a. Do not start until the baseline in
`reports/2026-09-08-contribution-baseline.md` exists.

## Global Constraints

- **Node >= 24.0.0**, no build step; only erasable TypeScript; explicit `.ts`
  extensions on relative imports.
- **Zero runtime dependencies.**
- **`Stop` must never be blocked.** The child is `detached`, `stdio: 'ignore'`,
  and `.unref()`ed. Never awaited.
- **Never write to `.my_context/`** from a test; build fixtures in a temp dir.
- **Every test file carries `// @basis`**; `npm run check:basis` gates it.
- **Port 58888 is the owner's.** Never kill, restart or bind to it.
- **Off by default.** Nothing in this phase runs unless `review.enabled` is true.

---

### Task 1: The counter

**Files:**
- Create: `src/core/review-counter.ts`
- Test: `test/core/review-counter.test.ts`

**Interfaces:**
- Produces:
  - `export interface CounterState { calls: number; fires: number; sessionId: string | null }`
  - `export function readCounter(stateRoot: string): CounterState`
  - `export function bumpCounter(stateRoot: string, sessionId: string | undefined): CounterState`
  - `export function resetCounter(stateRoot: string, sessionId: string | undefined): CounterState`
- Storage: `<stateRoot>/state/review-counter.json`, written with the same
  atomic temp-file-and-rename pattern `src/core/ui-server-upkeep.ts` uses —
  **read that file first and copy it; do not invent a second write pattern.**

- [ ] **Step 1: Write the failing test**

```ts
// @basis none - counter mechanics; the ruling it serves is the spec's §2, which is not an item yet
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readCounter, bumpCounter, resetCounter } from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

test('a fresh workspace reads zero rather than throwing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    const got = readCounter(dir);
    assert.equal(got.calls, 0);
    assert.equal(got.fires, 0);
    assert.equal(got.sessionId, null);
  } finally { removeTree(dir); }
});

test('a new session id resets the count rather than inheriting it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    bumpCounter(dir, 'session-a');
    bumpCounter(dir, 'session-a');
    assert.equal(readCounter(dir).calls, 2);
    const moved = bumpCounter(dir, 'session-b');
    assert.equal(moved.calls, 1, 'a different session starts its own count');
    assert.equal(moved.fires, 0, 'and its own fire budget');
  } finally { removeTree(dir); }
});

test('resetting clears the calls and remembers the fire', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    bumpCounter(dir, 's');
    const after = resetCounter(dir, 's');
    assert.equal(after.calls, 0);
    assert.equal(after.fires, 1, 'fires is what maxFiresPerSession is measured against');
  } finally { removeTree(dir); }
});

test('an unreadable counter file reads as zero and does not throw', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-counter-'));
  try {
    const { mkdirSync, writeFileSync } = require('node:fs');
    mkdirSync(path.join(dir, 'state'), { recursive: true });
    writeFileSync(path.join(dir, 'state', 'review-counter.json'), '{ not json', 'utf8');
    assert.equal(readCounter(dir).calls, 0, 'a corrupt counter must never break a hook');
  } finally { removeTree(dir); }
});
```

- [ ] **Step 2: Run it, watch it fail**

Run: `node --test test/core/review-counter.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Read the atomic-write pattern before implementing**

Run: `grep -n "writeState\|renameSync\|tmp" src/core/ui-server-upkeep.ts | head -20`

That file already solved atomic state writing here, **including unlinking the
temp file on failure**. Copy its shape.

- [ ] **Step 4: Implement**

Key behaviours, each pinned by a test above:
- reads return zeros on a missing **or unparseable** file — a corrupt counter
  must never break `PostToolUse`;
- a different `sessionId` resets `calls` **and** `fires`;
- `resetCounter` zeroes `calls` and increments `fires`;
- writes are atomic and never throw out of the hook path.

- [ ] **Step 5: Run and watch pass**

Run: `node --test test/core/review-counter.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/core/review-counter.ts test/core/review-counter.test.ts
git commit -m "review: a counter that cannot break the hook it lives in"
```

---

### Task 2: Increment it where a row is already written

**Files:**
- Modify: `src/hooks/post-tool-use.ts`
- Test: `test/hooks/post-tool-use.test.ts` (add a case; do not create a file)

**Interfaces:**
- Consumes: `bumpCounter` from Task 1.

- [ ] **Step 1: Read the hook first**

Run: `sed -n '1,60p' src/hooks/post-tool-use.ts`

It already resolves the workspace and writes an audit row. **The counter goes
in that same place** — the resolution is already paid for.

- [ ] **Step 2: Write the failing test**

Assert that after a `PostToolUse` invocation in a temp workspace with
`review.enabled: true`, `readCounter(dir).calls === 1`; and that with
`review.enabled` absent or false, it stays `0`.

- [ ] **Step 3: Run it, watch it fail**

- [ ] **Step 4: Implement, guarded by config**

The bump is inside the existing workspace-resolved branch, wrapped so a counter
failure cannot fail the hook. **The hook's existing behaviour must not change
when `review.enabled` is false** — that is what the second assertion pins.

- [ ] **Step 5: Run the whole hook suite**

Run: `node --test "test/hooks/*.test.ts"`
Expected: no new failures.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/post-tool-use.ts test/hooks/post-tool-use.test.ts
git commit -m "review: count tool calls where the audit row is already written"
```

---

### Task 3: The rubric — decide whether a firing is worth anything

**Files:**
- Create: `src/review/rubric.ts`
- Test: `test/review/rubric.test.ts`

**Interfaces:**
- Consumes: the record shape `src/core/session-summary.ts` already extracts.
- Produces:
  - `export interface RubricVerdict { fire: boolean; because: string }`
  - `export function worthAPass(points: { category: string; who: string }[]): RubricVerdict`

**Why this exists:** a fixed counter is measured *inferior* to a rubric-gated
trigger — **+6.3 points on BrowseComp at 30–70% lower token cost**
(arXiv:2606.23525) — because fixed thresholds "pay no heed to trajectory
structure" and fire mid-derivation. The counter says *consider*; this decides.

- [ ] **Step 1: Write the failing test**

```ts
// @basis none - implements the spec's §2 rubric; no corpus item exists for it yet
test('a stretch with a correction in it is worth a pass', () => {
  const got = worthAPass([{ category: 'correction', who: 'OWNER' }]);
  assert.equal(got.fire, true);
  assert.match(got.because, /correction/i, 'the reason must name what made it worth firing');
});

test('measurements alone are not worth a pass', () => {
  const got = worthAPass([
    { category: 'measurement', who: 'agent' },
    { category: 'measurement', who: 'agent' },
  ]);
  assert.equal(got.fire, false);
  assert.match(got.because, /.+/, 'a refusal must say why, so a quiet loop is explicable');
});

test('nothing at all is not worth a pass', () => {
  assert.equal(worthAPass([]).fire, false);
});
```

- [ ] **Step 2: Run it, watch it fail**

- [ ] **Step 3: Implement**

Fire when the window contains a **correction**, a **decision**, or a **failure
that was then resolved**. Do not fire on measurements alone, or on nothing.
**Return the reason in every case, including refusals** — a loop that declines
to fire and cannot say why is a loop nobody can debug.

- [ ] **Step 4: Run and watch pass**

- [ ] **Step 5: Commit**

```bash
git add src/review/rubric.ts test/review/rubric.test.ts
git commit -m "review: a rubric decides, because a fixed counter fires mid-derivation"
```

---

### Task 4: The input — whole transcript, subagents, incremental

**Files:**
- Create: `src/review/input.ts`
- Test: `test/review/input.test.ts`

**Interfaces:**
- Consumes: `src/core/session-summary.ts`'s reader (D34, already landed:
  26,673 records in 533 ms, structural filter, byte-offset snapshot).
- Produces:
  - `export interface PassInput { points: Point[]; readTo: number; sources: string[] }`
  - `export function gather(opts: { transcript: string; sinceByte: number; includeSubagents: boolean; taskDir: string | null }): PassInput`

- [ ] **Step 1: Read the existing reader first**

Run: `grep -n "^export " src/core/session-summary.ts`

**Do not write a second scanner.** A second walk over the same JSONL would drift
from the first — the failure this project spent 2026-09-07 measuring.

- [ ] **Step 2: Write the failing test**

Assert: reading with `sinceByte` past the file's size yields no points and a
`readTo` equal to the size; that `includeSubagents: false` yields only the
session's own `sources`; and that a marked summary (the loop guard,
`SESSION_SUMMARY_MARKER`) is excluded from the points.

- [ ] **Step 3: Run it, watch it fail**

- [ ] **Step 4: Implement**

Whole-file read, incremental **send**: the read is half a second, so read it
all; `sinceByte` bounds what is *returned*, not what is scanned. Subagent
transcripts come from the task directory when `includeSubagents` is true.

**The hazard, and it must be in the code as a comment, not only here:** a
subagent transcript contains false starts and abandoned hypotheses as well as
the recovery. Capturing "a lane believed X" as knowledge records a mistake. The
anti-learning rules apply doubly, and Phase 3 enforces them.

- [ ] **Step 5: Run it against the real session and read the output**

Run: `node -e "…"` gathering from this repository's own transcript.
**Look at the points.** If they are dominated by machinery or by the model
quoting the owner back, the filter is wrong and Phase 3 will inherit it.

- [ ] **Step 6: Commit**

```bash
git add src/review/input.ts test/review/input.test.ts
git commit -m "review: gather the whole transcript, subagents included, through the reader that exists"
```

---

### Task 5: The detached pass — reads, reports, writes nothing

**Files:**
- Create: `src/review/pass.ts`
- Modify: `src/hooks/stop.ts`
- Modify: `src/core/config.ts` (add the `review` block from §11)
- Test: `test/review/pass.test.ts`, `test/hooks/stop.test.ts`

**Interfaces:**
- Consumes: Tasks 1, 3, 4.
- Produces: `export async function runPass(opts: { workspace: string; transcript: string; dryRun: true }): Promise<void>`

**Phase 2 ends here deliberately: `dryRun` is the ONLY mode.** The pass writes a
report to `state/review-last-pass.json` and creates nothing. It can then run on
real sessions for days before Phase 3 lets it propose.

- [ ] **Step 1: Read how a detached child is spawned here**

Run: `grep -n "spawn" src/ui/open.ts`

That is the pattern: `detached: true`, `stdio: 'ignore'`, `.unref()`.

- [ ] **Step 2: Write the failing test for the hook**

The load-bearing assertion, and it is the one that protects the user:

```ts
test('Stop returns without waiting for the pass', () => {
  // fire the hook in a workspace configured to pass, and assert the hook
  // process exits in well under the time the pass would take.
  const started = Date.now();
  runStopHook(dir, { session_id: 's', transcript_path: big });
  assert.ok(Date.now() - started < 500,
    'Stop is the hook where a person is staring at a prompt; it must never await the pass');
});
```

- [ ] **Step 3: Run it, watch it fail**

- [ ] **Step 4: Implement**

`stop.ts` reads the counter; if `review.enabled`, over threshold, under
`maxFiresPerSession`, and the rubric fires — reset and spawn detached, then
**return immediately**. `PreCompact` fires the same path.

**The kill switch must actually kill.** Upstream's issue #82708 is a switch that
did not: zeroing one interval left another path creating anyway. **One switch,
one subsystem, and a test asserting that with `enabled: false` no child is
spawned at all.**

- [ ] **Step 5: Run the hook suites**

Run: `node --test "test/hooks/*.test.ts" "test/review/*.test.ts"`
Expected: green.

- [ ] **Step 6: Turn it on here and watch it for a day**

Set `review.enabled: true` in this workspace, work normally, then read
`state/review-last-pass.json`. **It writes nothing to the corpus in this phase**,
so the only risk is wasted tokens — which is the point of stopping here.

- [ ] **Step 7: Commit**

```bash
git add src/review/pass.ts src/hooks/stop.ts src/core/config.ts test/review/pass.test.ts test/hooks/stop.test.ts
git commit -m "review: a detached pass that reads and reports and writes nothing"
```

---

## Self-review

**Spec coverage.** §2 (Tasks 1–3, 5), §3 (Task 4), §5a and the never-await rule
(Task 5), §11 config and kill switch (Task 5). §5b dedupe and §5c relevance are
Phase 3, where there is something to dedupe.

**Placeholders.** The two steps that say "read X first" both name the file and
the command, and forbid inventing a second pattern — that is instruction, not a
gap.

**Type consistency.** `CounterState`, `RubricVerdict` and `PassInput` are
defined once and consumed unchanged. `SESSION_SUMMARY_MARKER` is imported from
`src/core/session-summary.ts` rather than re-spelled.

**The risk named rather than hidden:** Task 4 depends on the reader's extraction
being good enough. Step 5 says to *look at the output on the real session*
before continuing, because Phase 3 inherits whatever it produces.
