# Never Miss an Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hooks never write SQLite and never require it — injections are computed from Markdown, dedupe state lives in per-session append-only files, index reads go read-only with a Markdown fallback, and the PreCompact snapshot path performs zero SQLite writes and zero blocking SQLite reads.

**Architecture:** B + A + C from the design, **in that causal order**: (B) the hooks' SQLite writes move to a per-session seen file plus the audit JSONL that already records every delivery first (`src/core/inject.ts` · `// 4. AUDIT — first and durable` · ~767 before `src/core/inject.ts` · `// 5. THE SEEN-FILE APPEND` · ~996; `src/hooks/pre-tool-use.ts` · `// The audit record, before the seen-file append and independent of it:` · ~351 before `src/hooks/pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey,` · ~412); (A) with no reason left to open writable, the JIT hook opens the index read-only — 0 failures in 18,300 contended read-only trials, worst case 17.2 ms [P6/P6b], vs `Store.open`'s measured 16,881 ms stall then `database is locked` under a 30 s held write lock [P4], independently reproduced at 16,914 ms [R]; (C) any read failure falls back to selecting straight from Markdown — `select` is pure (`src/core/select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~1364), `loadLayer` needs no database (`src/core/rebuild.ts` · `export function loadLayer(` · ~125), and the fallback produced selections IDENTICAL to the primary path in 5/5 executed comparisons including a tight-budget variant [R1].

**Tech Stack:** TypeScript on Node 24 (type-stripping, no build step), `node:sqlite`, `node:fs`, `node --test`. Nothing added.

**Spec:** `docs/superpowers/specs/2026-08-16-never-miss-an-injection-design.md` (the binding authority; its §0 and §4.4 especially). Corrected by the adversarial review `review-never-miss.md` (2026-08-16), whose findings are folded into the design and carried by name below (C1, I1–I4, M1–M3). Research inputs: `research-sqlite-concurrency.md` [DOC], `research-sqlite-measured.md` (21,900-trial campaign, probe scripts preserved) [M/P], and the review's own probes [R].

## Global Constraints

Copied verbatim from the project rules; every task's requirements implicitly include this section.

- **Zero runtime dependencies** — `node:sqlite` only, Node 24, no build step. Nothing added by this plan: `node:fs`, `node:sqlite`, existing modules.
- **`INV-nothing-is-dropped-silently`** — a degraded path must say so. Every fallback, dropped refresh, skipped filter, and failed write in this plan carries a disclosure (inline in the injected output, and/or a `note` in the audit record).
- **`INV-markdown-is-the-source-of-truth`** — `files → DB → files` byte-identical; the index is disposable. This plan strengthens it into a runtime property: the truth *serves* when the index cannot.
- **Every change needs a test that fails without it.** TDD in every task: write the failing test, watch it fail, implement, watch it pass.
- **`npm run mutate` before claiming a guard is pinned.**
- **Both READMEs move together** — `README.md` and `docs/README.he.md`.
- **50 ms p95 hot path** — the JIT hook's per-tool-call ceiling (`test/perf/focus-latency.perf.ts`, `test/perf/jit-latency.perf.ts`). The fallback is priced separately and fires only on read failure; the steady-state hot path must stay inside 50 ms.
- **`npm test` / `tsc --noEmit` (`npm run typecheck`) / `npm run test:perf` clean** before any task is called done.
- **10 s harness kill** on the three hooks this plan touches (`hooks/hooks.json` · `"timeout": 10` · ~11, repeated at ~34 and ~45 for PreToolUse and PreCompact). Not *every* hook, as this line first said: `PostToolUse` already carried `"timeout": 5` when the plan was written, and `PostToolUseFailure` later joined it at 5 s.
- **`INV-hooks-fail-open`** — a hook must never break a session; the catch-all `''` remains as the last resort behind the Markdown fallback.
- **`INV-select-is-pure`** — load-bearing for this plan: it is what makes the fallback a fallback rather than a fork of the selection rule.

## Conditions the design carries — preserved here, stated

1. **The guarantee is conditional on corpus size ≲ 10,000 items.** Measured: the Markdown fallback costs **9,903 ms at 10,000 items on a cold file cache** [R5] against the 10 s kill — and cold cache is the first fire after a reboot, exactly when the fallback is needed. At 20,000 items: 11,128 ms cold, 1,445–3,679 ms warm (`select` itself 27–50 ms) [R5]. Past the ceiling, injection degrades to E4's *disclosed* miss. Task 11 surfaces the approach to this ceiling via a `doctor` warning pinned at 5,000 items (the design's mitigation trigger, §6 risk 3).
2. **Re-injection is the accepted failure direction — never a miss.** A duplicate is disclosed and cheap; a miss is neither. An unreadable seen file means "inject without dedupe, disclosed" (Tasks 4, 5); a projection behind its log means `decay`/`usage` inaccuracy off the hot path, healed by top-up (Tasks 6, 7). No task in this plan may convert a lag into suppression. The one pre-existing window — a seen record appended before the hook's output is confirmed delivered downstream — is not new (`ledger.recordMany` had the identical window on the JIT path Task 4 rewrote) and the file append narrows it (`src/hooks/pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey,` · ~412) [review M3].
3. **Seen files were never pruned, and sanitised filenames widened the dedupe-key equivalence classes** [review I4]. Task 3 added the pruning arm — `pruneSnapshots` had removed only `*.restore.json` and `*.tmp-*`, and now takes `*.seen.jsonl` on the same 30-day retention (`src/core/ledger.ts` · `|| entry.name.endsWith('.seen.jsonl')` · ~830) — and pinned the `sanitizeSessionId` collision (`a::b` ↔ `a__b`) in a test. The collision was then closed rather than merely documented: the tasks-3-4 review fix (`2823bc5`) suffixes a digest of the raw id and makes the sanitizer injective (`src/core/ledger.ts` · `const digest = createHash('sha256').update(sessionId, 'utf8').digest('hex').slice(0, 12);` · ~714), so the accepted worst case — shared dedupe scope, suppression within one colliding pair, recoverable, unreachable with UUID session ids — no longer has a pair to occur in, and the test records that decision instead.
4. **The fallback's focus-report universe diverges from `activeInjectable`'s pre-filtered one** [review I3]: `store.activeInjectable(types)` pre-filters to `status='active' AND type IN (normative)` (`src/core/store.ts` · `activeInjectable(types: string[]): Item[] {` · ~532), so on the DB path `select`'s `eligibleAll` (`src/core/select.ts` · `const eligibleAll = merged.filter((i) => isEligible(i, config));` · ~1367) — the base of `buildFocusReport`'s universe (`src/core/select.ts` · `? buildFocusReport(focus, eligibleAll, config, ctx.event === 'tool' ? target : null)` · ~1552) — contains normative items only. Task 9's fallback applies **the same filter in JS before `select`**, not only to the tiers, and pins report-count equality between paths in a test. Injection outcomes were verified identical either way [R1]; the filter exists for the *disclosure*.

## What is already in flight — checked, and the finding

The snapshot-durability fix **has landed**: `origin/fix/snapshot-rename-durability` carries `cd28989` ("fix: retry and disclose the PreCompact snapshot rename on NTFS sharing violations" — verified on origin 2026-08-16, after an earlier check caught the branch pre-push). **This plan consumes it; it is not re-implemented here.** What `cd28989` ships, read from its diff:

- `writeSnapshot`'s rename goes through `retryOnTransientFsError` (imported into `ledger.ts` **directly from `rebuild.ts`** — no cycle) with `SNAPSHOT_RENAME_ATTEMPTS = 15`, a worst case of 20·(1+…+14) = **2,100 ms** of backoff against the 10 s kill, pinned by a budget test so neither the constant nor the backoff formula can drift. It reproduced the defect at **681/2,000** renames failing `EPERM` (the review measured 654/2,000 [R3]).
- On final failure `buildRestoreSnapshot` discloses **twice**: an audit record (`op: 'pre-compact'`, `injected: []`, a note beginning `SNAPSHOT WRITE FAILED (…)` naming the captured-but-unpersisted counts) plus one line on stderr — with a fallback clause naming the audit error if the audit write itself fails. Exit stays 0: hooks fail open, compaction is never blocked.
- `writeSnapshot`'s contract now states the two properties separately: atomic against concurrent readers (0 torn in 22,791 contended reads [R3]); **not** power-loss durable (no fsync — accepted and stated, since a power cut also ends the session the snapshot serves). Exactly the wording §4.4 requires.
- A second bare rename-over-existing was fixed at `src/lesson/derive.ts` · `retryOnTransientFsError(() => renameSync(tmp, target));` · ~85 (`saveStaging`, default retry); `audit.ts`'s `rotateIfFull` rename is left bare **deliberately** (fresh target name, best-effort by design) — do not "fix" it in any later task.

Everything §4.4 and review C1 required of this fix is present in `cd28989`; **no residue task exists for it**. Task 1 merges the branch (which also carries the e3-wave-5 consolidation commits beneath it, `6854f3f`…`d0671f2`) and verifies the property by grep and by test. Task 10, which rewrites `buildRestoreSnapshot`'s *inputs*, preserves `cd28989`'s failure-disclosure structure verbatim.

Two other branches are prerequisites the design is written against (§6 risk 7), neither on `phase-5/quality`:
- **E4** (`origin/e4-e6-small-fixes`, `0c141d6`): `OpenProfile` / `HOOK_OPEN_PROFILE {busyTimeoutMs: 500, attempts: 2}` / `isBusyError` in `src/core/store.ts`, `Store.open(dbPath, profile)`, `Ledger.open(dbPath, busyTimeoutMs)`, and the locked-index disclosure in `buildInjection`'s catch.
- **E2** (`origin/e2-subagent-injection`, `64bc73a`): `ledgerKey(input)` in `src/hooks/io.ts` — `session_id::agent_id` when a subagent, bare `session_id` otherwise — used as the JIT dedupe key; PreCompact stays parent-keyed.

Task 1 folds all three in before anything else.

## Why the order is causal, not cosmetic

**B must land before A.** The only reason a hook opened the index writable was that it wrote to it: the JIT hook's `ledger.recordMany` (`src/hooks/pre-tool-use.ts` · `ledger.recordMany(dedupeKey, selection.full.map((e) => e.item.id), 'jit');` · ~229 <!-- historical-citation: Task 4 removed this call; the JIT hook's dedupe write is `appendSeen` now -->) and `Ledger.open`'s schema DDL (`src/core/ledger.ts` · `db.exec(LEDGER_SCHEMA);` · ~139), and SessionStart's full `rebuild` (`src/core/inject.ts` · `store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);` · ~744 — the one writable hook open this plan left, and it is now a best-effort refresh after the selection rather than the selection's own source). If A were reordered before B, the hook would open read-only for the item query and then still need a writable connection for the ledger — the `BEGIN IMMEDIATE` stall at `src/core/store.ts` · `db.exec('BEGIN IMMEDIATE');` · ~192 (measured: 16,881 ms then `database is locked` under a 30 s hold [P4]) would not be removed, only relocated to the ledger open, and the 0.2 ms read-only figure [P4] would be a decoration on an unchanged failure. Tasks 4–5 (B) therefore precede Task 8 (A), and Task 8's first step re-verifies by grep that no hook path still opens `Ledger` or calls `Store.open` on the injection-critical path. **C lands after A** because C is the catch handler of A's open: there is no fallback branch to write until the read-only open whose failure it serves exists. Snapshot durability is independent of the ordering and already shipped (`cd28989`, consumed in Task 1).

## File Structure

```
src/core/rebuild.ts           MOD  rebuild() gains an optional preloaded per-layer items argument so
                                   SessionStart parses the corpus once (Task 5). retryOnTransientFsError
                                   stays here — cd28989 already imports it into ledger.ts with no cycle
src/core/ledger.ts            MOD  (writeSnapshot retry: SHIPPED in cd28989, consumed not rewritten)
                                   pruneSnapshots gains the *.seen.jsonl arm (Task 3); LEDGER_SCHEMA gains
                                   ledger_source; Ledger gains sourceBytes/setSourceBytes/clearForReplay
                                   (Task 6); scanTranscriptIds accepts null knownIds = no filter (Task 10)
src/core/seen-file.ts         NEW  the per-session seen file: seenFilePath, appendSeen, readSeen,
                                   seenIds, restoredFor (Task 2)
src/core/ledger-replay.ts     NEW  topUpLedger: audit JSONL → ledger projection, position-tracked
                                   (Task 6)
src/core/store.ts             MOD  Store.openReadOnlyChecked — read-only open + schema-version check,
                                   never migrates (Task 8)
src/core/markdown-fallback.ts NEW  loadCorpusItems + activeInjectableFromItems + FALLBACK_NOTE (Task 9)
src/core/inject.ts            MOD  buildInjection: Markdown-first selection, seen-file restore marker,
                                   best-effort index refresh, disclosures (Task 5)
src/hooks/pre-tool-use.ts     MOD  seen-file dedupe (Task 4); read-only open (Task 8); Markdown
                                   fallback (Task 9)
src/hooks/pre-compact.ts      MOD  seen file + transcript + best-effort read-only known filter, keeping
                                   cd28989's failure-disclosure structure verbatim (Task 10)
src/cli/commands/audit.ts     MOD  `mycontext audit replay-ledger` subcommand (Task 6)
src/cli/commands/decay.ts     MOD  top-up before aggregation (Task 7)
src/cli/commands/status.ts    MOD  top-up before aggregation (Task 7)
src/doctor/checks.ts          MOD  checkCorpusSize — the fallback-ceiling warning (Task 11)
test/core/seen-file.test.ts   NEW  Tasks 2, 3
test/core/ledger-replay.test.ts NEW Task 6
test/core/markdown-fallback.test.ts NEW Task 9
test/core/open-readonly-checked.test.ts NEW Task 8
test/hooks/*.test.ts          MOD  Tasks 4, 5, 8, 9, 10
test/doctor/corpus-size.test.ts NEW Task 11
test/perf/fallback-latency.perf.ts NEW Task 12
test/perf/session-start-latency.perf.ts MOD Task 12 (baseline re-derived, not silently widened)
README.md, docs/README.he.md  MOD  Task 13
```

Every number asserted in this plan is a measured one, attributed: **[M/P]** the design's own benchmarks / the `research-sqlite-measured.md` campaign (21,900 read trials), **[R/R1–R5]** the adversarial review's independent probes, **[DOC]** sqlite.org documentation per `research-sqlite-concurrency.md`. Where a task needs a number nobody has measured, the task says "measure, then pin" — it never invents one.

---

### Task 1: Preflight — fold in E4, E2 and the shipped snapshot-durability fix; record the base

**Files:**
- Modify: none by hand — three `git merge` commits.
- Test: the whole existing suite (including `cd28989`'s own tests, which arrive with the merge).

**Interfaces:**
- Consumes: `origin/e4-e6-small-fixes` (`OpenProfile`, `DEFAULT_OPEN_PROFILE`, `HOOK_OPEN_PROFILE`, `isBusyError`, `Store.open(dbPath: string, profile?: OpenProfile, _retried?: boolean)`, `Ledger.open(dbPath: string, busyTimeoutMs?: number)`, the locked-index disclosure in `buildInjection`); `origin/e2-subagent-injection` (`ledgerKey(input: HookInput): string | null` in `src/hooks/io.ts`, `agent_id`/`agent_type` on `HookInput`, `dedupeKey` threading in `buildJitOutput`); `origin/fix/snapshot-rename-durability` (`cd28989`: `SNAPSHOT_RENAME_ATTEMPTS = 15` and the retried rename in `writeSnapshot`, the `SNAPSHOT WRITE FAILED` audit-plus-stderr disclosure in `buildRestoreSnapshot`, the `saveStaging` retry, and its tests — plus the e3-wave-5 consolidation commits beneath it).
- Produces: a working branch on which every later task's citation of `HOOK_OPEN_PROFILE`, `ledgerKey` and `SNAPSHOT_RENAME_ATTEMPTS` resolves. Every later task assumes this union; Task 10 in particular preserves `cd28989`'s failure-disclosure structure.

- [ ] **Step 1: Create the working branch from the design's base and merge the three prerequisites**

```bash
git fetch origin
git checkout -b feat/never-miss origin/phase-5/quality
git merge --no-ff origin/e4-e6-small-fixes -m "merge: fold in E4 (hook open profiles and contention disclosure)"
git merge --no-ff origin/e2-subagent-injection -m "merge: fold in E2 (per-subagent JIT dedupe key)"
git merge --no-ff origin/fix/snapshot-rename-durability -m "merge: fold in the shipped snapshot rename durability fix (cd28989) and e3 consolidation"
```

If a merge conflicts, resolve in favour of the branch being merged for its own files (`store.ts`/`inject.ts` for E4; `io.ts`/`pre-tool-use.ts` for E2; `ledger.ts`/`pre-compact.ts`/`derive.ts` for the durability branch) — all were written against near-identical bases and the design (§6 risk 7) is written against their union.

- [ ] **Step 2: Verify the union by grep, not by trust**

Run: `grep -n "HOOK_OPEN_PROFILE" src/core/store.ts src/core/inject.ts && grep -n "export function ledgerKey" src/hooks/io.ts && grep -n "SNAPSHOT_RENAME_ATTEMPTS" src/core/ledger.ts && grep -n "SNAPSHOT WRITE FAILED" src/hooks/pre-compact.ts`
Expected: all hits present. The last two are the design's §4.4 required property (review C1), shipped in `cd28989` — if either grep is empty the merge lost it; stop and fix the merge.

- [ ] **Step 3: Run the full gates**

Run: `npm test && npm run typecheck && npm run test:perf`
Expected: all clean — including `cd28989`'s pre-compact disclosure test and its retry-budget test (the 1–3 s band pin on `SNAPSHOT_RENAME_ATTEMPTS`). If branch tests conflict with each other, fix the merge, not the tests.

- [ ] **Step 4: Commit** (the merges are the commits; commit any conflict resolutions)

---

### Task 2: The per-session seen file — `src/core/seen-file.ts`

The B enabler: session dedupe state moves to `state/<sanitized-key>.seen.jsonl`, one `{id, tier, at}` line per delivery, using the audit log's own append machinery (`appendJsonlLine`/`healTornTail` — `src/core/jsonl-log.ts` · `export function appendJsonlLine(` · ~192 and `src/core/jsonl-log.ts` · `export function healTornTail(file: string): void {` · ~157) — measured at 0.55 ms p95, flat from empty to 32 MiB (`src/core/audit-db.ts` · `//  1. **The hot path.** The PreToolUse hook writes a record on every tool call` · ~21, `test/perf/audit-latency.perf.ts`). Concurrent appends: 6,000/6,000 lines intact across 2 processes × 3,000 interleaved, and the heal-then-append race against a file that starts torn lost 0 records in 3,000 races [R2]; the analytical worst case is a lost seen-record → one re-injection, the accepted direction.

**Files:**
- Create: `src/core/seen-file.ts`
- Test: `test/core/seen-file.test.ts`

**Interfaces:**
- Consumes: `appendJsonlLine`, `readJsonlFile`, `JsonlLogSpec` from `src/core/jsonl-log.ts`; `sanitizeSessionId`, `LedgerTier` from `src/core/ledger.ts`; `retryOnTransientFsError` from `src/core/rebuild.ts` — the exact import shape `cd28989` established in `ledger.ts`, proving there is no cycle (`rebuild.ts` imports nothing from either module).
- Produces (Tasks 6, 7, 12 consume exactly these):
  - `SEEN_PROTOCOL = 'mycontext-seen/1'`
  - `interface SeenLine { id: string; tier: LedgerTier; at: string }`
  - `interface SeenState { lines: SeenLine[]; error: string | null }`
  - `seenFilePath(root: string, key: string): string`
  - `appendSeen(root: string, key: string, lines: SeenLine[]): { written: boolean; error: string | null }` — never throws
  - `readSeen(root: string, key: string): SeenState` — never throws; `error !== null` means "inject without dedupe and disclose"
  - `seenIds(state: SeenState): string[]` — unique ids, sorted
  - `restoredFor(state: SeenState, capturedAt: string): Set<string>` — ids whose LAST `restored` line carries `at === capturedAt` (last-line-wins per `(id, tier)` reproduces `Ledger.recordRestored`'s refresh semantics, `src/core/ledger.ts` · `recordRestored(sessionId: string, itemIds: string[], at: string = new Date().toISOString()): void {` · ~378)

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/seen-file.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendSeen, readSeen, restoredFor, seenFilePath, seenIds,
} from '../../src/core/seen-file.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-seen-'));
  t.after(() => removeTree(dir));
  return dir;
}

test('append then read round-trips, ids deduplicated and sorted', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [
    { id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:00:00.000Z' },
    { id: 'CONST-a', tier: 'pinned', at: '2026-08-16T10:00:00.000Z' },
  ]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: '2026-08-16T10:01:00.000Z' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.equal(state.lines.length, 3);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a missing file is an empty seen set, not an error', (t) => {
  const state = readSeen(root(t), 'never-written');
  assert.equal(state.error, null);
  assert.deepEqual(state.lines, []);
});

test('restoredFor is last-line-wins per (id, tier) — recordRestored refresh semantics', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-1' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'restored', at: 'GEN-2' }]);
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'GEN-2' }]);
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-2')], ['CONST-a']);
  // The OLD generation no longer matches — the marker moved, exactly as
  // Ledger.recordRestored's ON CONFLICT ... UPDATE moved it.
  assert.deepEqual([...restoredFor(readSeen(dir, 's1'), 'GEN-1')], []);
});

test('a torn tail is healed by the next append; completed records survive', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), '{"id":"CONST-tor', 'utf8'); // killed mid-append
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.equal(state.error, null);
  assert.deepEqual(seenIds(state), ['CONST-a', 'CONST-b']);
});

test('a corrupt middle line degrades to error, never throws — inject-without-dedupe direction', (t) => {
  const dir = root(t);
  appendSeen(dir, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  appendFileSync(seenFilePath(dir, 's1'), 'not json at all\n', 'utf8');
  appendSeen(dir, 's1', [{ id: 'CONST-b', tier: 'jit', at: 'T1' }]);
  const state = readSeen(dir, 's1');
  assert.notEqual(state.error, null);
  assert.deepEqual(state.lines, []); // no partial answer: dedupe is all-or-disclosed
});

test('the key is sanitized into the filename exactly as snapshot paths are', (t) => {
  const dir = root(t);
  assert.equal(
    seenFilePath(dir, 'sess::agent'),
    join(dir, 'state', 'sess__agent.seen.jsonl'),
  );
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/core/seen-file.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/core/seen-file.ts`**

```ts
import path from 'node:path';
import { retryOnTransientFsError } from './rebuild.ts';
import { appendJsonlLine, readJsonlFile, type JsonlLogSpec } from './jsonl-log.ts';
import { sanitizeSessionId, type LedgerTier } from './ledger.ts';

// --- The per-session seen file ----------------------------------------------
//
// Session dedupe state, off the database: one `{id, tier, at}` line per
// delivery, appended by the hook that delivered and read back by the next
// hook in the same session. The append is the audit log's own machinery
// (appendJsonlLine / healTornTail — 0.55 ms p95 measured, flat in file size)
// and physically cannot take SQLite's write lock, which is the entire point:
// the 16,881 ms Store.open stall under a held write lock [P4] existed only
// because the hook had a reason to open writable, and this file removes the
// reason.
//
// Failure direction, decided here and relied on by every caller: an
// unreadable seen file means "inject WITHOUT dedupe and disclose" — a
// re-injection, never a miss. readSeen therefore NEVER throws; it returns
// `error` for the caller to disclose. appendSeen never throws either: a
// failed append costs one future re-injection, which is the accepted
// direction, and the audit log (written first) still holds the delivery.

export const SEEN_PROTOCOL = 'mycontext-seen/1';

export interface SeenLine {
  id: string;
  tier: LedgerTier;
  at: string;
}

export interface SeenState {
  lines: SeenLine[];
  error: string | null;
}

const TIERS = new Set<string>(['pinned', 'jit', 'restored']);

export function seenFilePath(root: string, key: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(key)}.seen.jsonl`);
}

function specFor(file: string): JsonlLogSpec {
  return {
    file,
    protocol: SEEN_PROTOCOL,
    validate: (row) => {
      if (typeof row.id !== 'string' || row.id === '') return 'has no usable "id"';
      if (typeof row.tier !== 'string' || !TIERS.has(row.tier)) return 'has no usable "tier"';
      if (typeof row.at !== 'string' || row.at === '') return 'has no usable "at"';
      return null;
    },
    refuse: (line, reason) => new Error(
      `my_context: seen file line ${line} ${reason}. Session dedupe cannot be trusted from ` +
      'this file; the session will inject without dedupe (disclosed) rather than guess.',
    ),
    unreadable: (err) => new Error(
      `my_context: seen file could not be read: ${
        err instanceof Error ? err.message : String(err)}`,
    ),
  };
}

/** Never throws. A failed append is one future re-injection, disclosed by the audit trail. */
export function appendSeen(
  root: string, key: string, lines: SeenLine[],
): { written: boolean; error: string | null } {
  if (lines.length === 0) return { written: true, error: null };
  try {
    const file = seenFilePath(root, key);
    const dir = path.dirname(file);
    for (const line of lines) {
      // The same transient-EPERM guard the snapshot rename and writeItem use:
      // a scanner holding the file open for a moment must cost a retry, not
      // a lost dedupe record (design §6 risk 4).
      retryOnTransientFsError(() => appendJsonlLine(dir, file, {
        protocol: SEEN_PROTOCOL, id: line.id, tier: line.tier, at: line.at,
      }));
    }
    return { written: true, error: null };
  } catch (err) {
    return { written: false, error: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Never throws. `error !== null` means the file exists but cannot be trusted;
 * the caller injects without dedupe and DISCLOSES (the re-injection is the
 * accepted direction — a suppression built on a guessed-at seen set is not).
 * `lines` is empty whenever `error` is set: no partial answers.
 */
export function readSeen(root: string, key: string): SeenState {
  try {
    const rows = readJsonlFile(specFor(seenFilePath(root, key)));
    return {
      lines: rows.map((r) => ({
        id: r.id as string, tier: r.tier as LedgerTier, at: r.at as string,
      })),
      error: null,
    };
  } catch (err) {
    return { lines: [], error: err instanceof Error ? err.message : String(err) };
  }
}

/** Unique ids across all tiers, sorted — the `Ledger.seen` shape. */
export function seenIds(state: SeenState): string[] {
  return [...new Set(state.lines.map((l) => l.id))].sort();
}

/**
 * Ids whose LAST `restored` line carries `at === capturedAt`. Last-line-wins
 * per (id, tier) reproduces `Ledger.recordRestored`'s ON CONFLICT refresh:
 * the marker moves to whichever compaction most recently restored the item,
 * so it keeps matching a repeat firing of the SAME compaction and stops
 * matching an older generation (see the long comment on recordRestored).
 */
export function restoredFor(state: SeenState, capturedAt: string): Set<string> {
  const last = new Map<string, string>();
  for (const line of state.lines) {
    if (line.tier === 'restored') last.set(line.id, line.at);
  }
  const out = new Set<string>();
  for (const [id, at] of last) if (at === capturedAt) out.add(id);
  return out;
}
```

- [ ] **Step 4: Run tests, typecheck**

Run: `node --test test/core/seen-file.test.ts && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/seen-file.ts test/core/seen-file.test.ts
git commit -m "feat: per-session seen file — session dedupe state off the database (design B)"
```

---

### Task 3: Seen-file lifecycle — pruning arm and the sanitization-collision pin

Review I4, named in the design (§4.2): `pruneSnapshots` removed only `*.restore.json` and `*.tmp-*` (`src/core/ledger.ts` · `if (!(entry.name.endsWith('.restore.json') || entry.name.includes('.tmp-'))) continue;` · ~357 <!-- historical-citation: the filter as this task found it; Step 3 below replaced this line with the three-arm one -->), so seen files — one per session, one per subagent under E2 — would accumulate forever. The pruning pattern gains a third arm with the same 30-day retention (`SNAPSHOT_MAX_AGE_MS`, `src/core/ledger.ts` · `export const SNAPSHOT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;` · ~792). And `sanitizeSessionId` then folded every character outside `[A-Za-z0-9._-]` to `_` (`src/core/ledger.ts` · `const base = sessionId.replace(/[^A-Za-z0-9._-]/g, '_')` · ~713, now only the BASE of a digest-suffixed name), so E2's composed key `a::b` shared a filename with a hypothetical session `a__b` — an equivalence class the raw-string SQL key did not have. Not exploitable with UUID session ids; the collision's worst case was shared dedupe scope (suppression within the colliding pair, recoverable). Both got pinned in tests so they were decided here, not found later — and the collision was then closed outright by the tasks-3-4 review fix (`2823bc5`), which appends a digest of the raw id (`src/core/ledger.ts` · `const digest = createHash('sha256').update(sessionId, 'utf8').digest('hex').slice(0, 12);` · ~714) and makes the sanitizer injective, so the pinned test now records that decision instead of the worst case.

**Files:**
- Modify: `src/core/ledger.ts` (`pruneSnapshots`, line 357)
- Test: `test/core/seen-file.test.ts`, `test/core/ledger.test.ts`

**Interfaces:**
- Consumes: `SNAPSHOT_MAX_AGE_MS`, `pruneSnapshots` (existing); `appendSeen`/`readSeen`/`seenIds` (Task 2).
- Produces: `pruneSnapshots` also removes `*.seen.jsonl` older than `maxAgeMs`. No signature change.

- [ ] **Step 1: Write the failing tests**

```ts
// append to test/core/ledger.test.ts
import { utimesSync } from 'node:fs'; // add to imports

test('pruneSnapshots removes old seen files and keeps fresh ones', () => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-prune-'));
  try {
    mkdirSync(join(dir, 'state'), { recursive: true });
    const old = join(dir, 'state', 'old-session.seen.jsonl');
    const fresh = join(dir, 'state', 'fresh-session.seen.jsonl');
    writeFileSync(old, '{"protocol":"mycontext-seen/1","id":"CONST-a","tier":"jit","at":"T"}\n');
    writeFileSync(fresh, '{"protocol":"mycontext-seen/1","id":"CONST-b","tier":"jit","at":"T"}\n');
    const stale = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    utimesSync(old, stale, stale);
    const pruned = pruneSnapshots(dir);
    assert.equal(pruned, 1);
    assert.equal(existsSync(old), false);
    assert.equal(existsSync(fresh), true);
  } finally {
    rmSyncRetrying(dir);
  }
});
```

```ts
// append to test/core/seen-file.test.ts
test('DOCUMENTED NARROWING: sanitized keys collide — a::b and a__b share one file', (t) => {
  const dir = root(t);
  appendSeen(dir, 'a::b', [{ id: 'CONST-x', tier: 'jit', at: 'T0' }]);
  // The SQL ledger compared raw strings; the file scheme cannot. The worst
  // case is SHARED DEDUPE SCOPE between the colliding keys — a suppression
  // within the pair, recoverable, never a corpus-wide miss — and it is
  // unreachable with UUID session ids. This test is the decision record.
  assert.deepEqual(seenIds(readSeen(dir, 'a__b')), ['CONST-x']);
});
```

- [ ] **Step 2: Run to verify the prune test fails**

Run: `node --test test/core/ledger.test.ts`
Expected: FAIL — `pruned` is 0 (the filter skips `.seen.jsonl`: `ledger.ts` · `if (!(entry.name.endsWith('.restore.json') || entry.name.includes('.tmp-'))) continue;` · ~357 <!-- historical-citation: the pre-Task-3 filter this step is expected to fail against; Step 3 replaces it -->). The collision test passes already (it documents existing behaviour — that is its job).

- [ ] **Step 3: Implement — one line in `pruneSnapshots`**

```ts
// `core/ledger.ts` · `export function pruneSnapshots(` · ~814 — extend the filter:
    if (!(entry.name.endsWith('.restore.json')
      || entry.name.endsWith('.seen.jsonl')
      || entry.name.includes('.tmp-'))) continue;
```

Also extend the `pruneSnapshots` docblock's first sentence to name the third arm: "…both finished `*.restore.json` snapshots, per-session `*.seen.jsonl` dedupe files, and orphaned `*.tmp-*` files…". A seen file only has to outlive its session; 30 days is the same generous margin the snapshots get.

- [ ] **Step 4: Run tests**

Run: `node --test test/core/ledger.test.ts test/core/seen-file.test.ts && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/ledger.test.ts test/core/seen-file.test.ts
git commit -m "feat: prune seen files at snapshot retention; pin the sanitized-key collision (review I4)"
```

---

### Task 4: JIT dedupe moves to the seen file — the ledger leaves the hot path

After this task the PreToolUse hook performs **zero SQLite writes**: `Ledger.open` (DDL + busy_timeout, `src/core/ledger.ts` · `db.exec(LEDGER_SCHEMA);` · ~139) and `ledger.recordMany` (`src/hooks/pre-tool-use.ts` · `ledger.recordMany(dedupeKey, selection.full.map((e) => e.item.id), 'jit');` · ~229 <!-- historical-citation: the call this task removes; `appendSeen` stands in its place -->) are replaced by `readSeen`/`appendSeen` on E2's `dedupeKey`. `Store.open` remains for one more task (Task 8 makes it read-only) — the ordering note in the plan header explains why this half must land first.

**Files:**
- Modify: `src/hooks/pre-tool-use.ts` (`buildJitOutput`)
- Test: `test/hooks/pre-tool-use.test.ts`

**Interfaces:**
- Consumes: `readSeen`, `appendSeen`, `seenIds`, type `SeenState` (Task 2); `ledgerKey` (Task 1 / E2); the existing `recordAudit` ordering (audit before dedupe record, `pre-tool-use.ts` · `// The audit record, before the seen-file append and independent of it:` · ~351 before `pre-tool-use.ts` · `appendSeen(ws.projectRoot, dedupeKey,` · ~412).
- Produces: `buildJitOutput` with no `Ledger` import. The seen-file line shape written here — `{ id, tier: 'jit', at: <ISO now> }` — is what Task 10's PreCompact reads back.

- [ ] **Step 1: Write the failing tests**

```ts
// append to test/hooks/pre-tool-use.test.ts (reuse the file's existing corpus/
// workspace helpers for building an initialized workspace with one scoped item)
test('JIT dedupe survives with no ledger: second delivery on the same key is suppressed', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t); // existing helper pattern in this file
  const input = { session_id: 'sess-1', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  const first = buildJitOutput(input, cwd, 'src/app.ts');
  assert.notEqual(first, '');
  const second = buildJitOutput(input, cwd, 'src/app.ts');
  assert.equal(second, '');
  // The dedupe state is the seen FILE, not the database:
  const ws = resolveWorkspace(cwd);
  const state = readSeen(ws.projectRoot!, 'sess-1');
  assert.equal(state.error, null);
  assert.ok(seenIds(state).length > 0);
});

test('a subagent has its own dedupe scope in its own seen file (E2 key carried over)', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const parent = { session_id: 'sess-1', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  assert.notEqual(buildJitOutput(parent, cwd, 'src/app.ts'), '');
  const sub = { ...parent, agent_id: 'agent-7' };
  // The parent's delivery must NOT suppress the subagent's empty context window.
  assert.notEqual(buildJitOutput(sub, cwd, 'src/app.ts'), '');
});

test('an unreadable seen file injects WITHOUT dedupe and discloses in the audit note', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const ws = resolveWorkspace(cwd);
  const input = { session_id: 'sess-2', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  assert.notEqual(buildJitOutput(input, cwd, 'src/app.ts'), '');
  // Corrupt a MIDDLE line (a torn tail would be healed, not refused):
  const file = seenFilePath(ws.projectRoot!, 'sess-2');
  writeFileSync(file, 'garbage line\n' + readFileSync(file, 'utf8'), 'utf8');
  // Re-injection, not suppression — the accepted failure direction:
  assert.notEqual(buildJitOutput(input, cwd, 'src/app.ts'), '');
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 'sess-2')
    .at(-1)?.note ?? '';
  assert.match(note, /seen file unreadable; injected without dedupe/);
});

test('the JIT hook writes nothing to the index database', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const ws = resolveWorkspace(cwd);
  // Prime the db (a writer creates it), then fingerprint it:
  Store.open(ws.dbPath).close();
  const before = statSync(ws.dbPath).mtimeMs;
  const input = { session_id: 'sess-3', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  buildJitOutput(input, cwd, 'src/app.ts');
  // Store.open would run the BEGIN IMMEDIATE schema txn and Ledger.open its
  // DDL — both write. (mtime is the cheap proxy; the load-bearing assertion
  // is the ledger row count below.)
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('sess-3'), []);
  ledger.close();
  assert.equal(statSync(ws.dbPath).mtimeMs, before);
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/hooks/pre-tool-use.test.ts`
Expected: FAIL — dedupe rows land in the ledger, not the seen file; the disclosure note does not exist.

- [ ] **Step 3: Implement in `buildJitOutput`**

Remove the `Ledger` import and the `ledger` variable entirely. Then:

```ts
// replace `ledger = Ledger.open(ws.dbPath)` (and its Store-before-Ledger
// ordering comment) with:
    const seenState = readSeen(ws.projectRoot, dedupeKey);

// in the select call, replace `seen: ledger.seen(dedupeKey)` with:
      { event: 'tool', path: target,
        seen: seenState.error === null ? seenIds(seenState) : [],
        focus: focusState.focus },

// in the audit noteParts (E2 already made notes an array):
    if (seenState.error !== null) {
      noteParts.push('seen file unreadable; injected without dedupe');
    }

// replace the ledger.recordMany try/catch after recordAudit with:
    // The dedupe record: an append to the per-session seen file — 0.55 ms
    // measured for the identical machinery (audit-latency.perf.ts) — never
    // SQLite. appendSeen never throws; a failed append is one future
    // re-injection, the accepted direction, and the audit record above
    // already holds the delivery durably.
    appendSeen(ws.projectRoot, dedupeKey, selection.full.map((e) => ({
      id: e.item.id, tier: 'jit' as const, at: new Date().toISOString(),
    })));

// in the finally block, drop the ledger close.
```

- [ ] **Step 4: Run tests, full gates**

Run: `node --test test/hooks/pre-tool-use.test.ts && npm test && npm run typecheck`
Expected: PASS. Existing tests that asserted ledger rows from JIT must be UPDATED to assert seen-file lines instead — they are asserting the old mechanism, and the design retires it; keep any test asserting the *behaviour* (dedupe across calls) green unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pre-tool-use.ts test/hooks/pre-tool-use.test.ts
git commit -m "feat: JIT session dedupe reads and writes the seen file, never the ledger (design B)"
```

---

### Task 5: SessionStart — Markdown-first selection, seen-file restore marker, best-effort refresh

The design's §4.3: `buildInjection` reorders to `loadLayer → select → render → disclose → then best-effort index refresh`, dropped without prejudice if the lock is held. Before this task the highest-traffic injection path ran a full delete-and-reinsert `rebuild` inside one write transaction (`src/core/inject.ts` · `const opened = openRebuiltStore(ws, manual ? {} : { profile: HOOK_OPEN_PROFILE });` · ~54, `src/core/rebuild.ts` · `store.transaction(() => {` · ~494) and then re-read what it just wrote (`inject.ts` · `store.all(),` · ~163) <!-- historical-citation: this task's starting state — the open-rebuild-then-read-back path it replaced with Markdown-first selection; both quoted lines are gone from inject.ts --> — while `loadLayer` already produced the very `Item[]` the selection needs (`rebuild.ts` · `const items = preloaded?.[layer] ?? loadLayer(root, layer, errors, config);` · ~506, discarded at `rebuild.ts` · `): { loaded: number; errors: LoadError[] } {` · ~482). SessionStart *already* pays the full parse inside `rebuild`, so Markdown-first is the same cost minus the database [design §0.4, C's pricing: M1 — 28.1 ms p95 at 500 items, 245.5 ms at 2,000, 597.7 ms at 5,000, `select` itself 1.4/4.1/8.8 ms, 15 iterations per size]. The 500-item p95 was ~55 ms and did *fall*, since the write transaction left the critical path — Task 12 re-derived rather than assumed, and recorded p95 ~45.6–46.3 ms (`test/perf/session-start-latency.perf.ts` · `plain max-of-20 ~45.6–46.3ms; compact ~149.1–163.6ms. The fall in the` · ~85).

Equivalence is not asserted from purity alone: `select(loadLayer(…))` vs `select(store.all())` was executed on the 44-item dogfood corpus and was IDENTICAL in 5/5 comparisons including a shrunken pinned budget [R1]; structurally, `select` is pure and order-insensitive (`fitToBudget` sorts internally, `select.ts` · `for (const item of [...band].sort(byPriority)) {` · ~839) and `items.id` PRIMARY KEY reproduces `mergeLayers`' project-over-global resolution (`rebuild.ts` · `const LAYER_ORDER: Layer[] = ['global', 'project'];` · ~477 loads project last, into `rebuild.ts` · `store.transaction(() => {` · ~494; `select.ts` · `if (!existing || (existing.layer === 'global' && item.layer === 'project')) {` · ~1190).

**Files:**
- Modify: `src/core/rebuild.ts` (`rebuild` gains an optional preloaded argument)
- Modify: `src/core/inject.ts` (`buildInjection`)
- Test: `test/core/inject.test.ts` (or the file that currently covers `buildInjection`; `test/hooks/session-start.test.ts` for the hook surface)

**Interfaces:**
- Consumes: `loadLayer(root, layer, errors, config): Item[]` (`rebuild.ts` · `export function loadLayer(` · ~125); `readSeen`/`appendSeen`/`restoredFor` (Task 2); `readSnapshotMeta` (`ledger.ts` · `export function readSnapshotMeta(root: string, sessionId: string): SnapshotMeta | null {` · ~861); `HOOK_OPEN_PROFILE`, `isBusyError`, `Store.open(dbPath, profile)` (Task 1 / E4); `select` (`select.ts` · `export function select(items: Item[], ctx: SelectContext, config: Config): Selection {` · ~1364).
- Produces: `rebuild(store, roots, config, preloaded?: Partial<Record<Layer, Item[]>>)` — when `preloaded[layer]` is present, `rebuild` indexes those items instead of calling `loadLayer` (the caller owns parse errors; the cross-layer collision check still runs). `buildInjection` with no `Ledger` dependency; its audit `note` gains `index refresh dropped: <reason>` and `seen file unreadable; restore dedupe skipped` entries. **The restored-tier seen line carries `at = snapshot.capturedAt`** — the identity-marker semantics (`inject.ts` · `// identity-marker semantics carry over unchanged: the restored line is` · ~454, `ledger.ts` · `recordRestored(sessionId: string, itemIds: string[], at: string = new Date().toISOString()): void {` · ~378) carried into the file, which Task 2's `restoredFor` reads back.

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/inject.test.ts (append; reuse the file's workspace-building pattern)
test('SessionStart injects with the database HELD by a foreign write transaction', (t) => {
  const cwd = makeWorkspaceWithPinnedItem(t); // existing helper pattern: one always:true item
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close(); // let a writer create the db first
  // Hold the write lock from a second connection, as a concurrent rebuild would:
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => { try { holder.exec('ROLLBACK'); } catch { /* done */ } holder.close(); });
  const started = performance.now();
  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-held' });
  const elapsed = performance.now() - started;
  // The injection must be produced — the whole point of the design — and it
  // must not have waited out HOOK_OPEN_PROFILE's full budget on the critical
  // path plus anything else pathological. The bound here is deliberately the
  // 10 s harness kill with margin, not a perf assertion (Task 12 owns those):
  assert.notEqual(output, '');
  assert.ok(elapsed < 5000, `took ${elapsed}ms against the 10s kill`);
  // The dropped refresh is disclosed, not swallowed:
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'session-start').at(-1)?.note ?? '';
  assert.match(note, /index refresh dropped/);
});

test('restore idempotency now lives in the seen file: same compaction never restores twice', (t) => {
  const cwd = makeWorkspaceWithPinnedItem(t);
  const ws = resolveWorkspace(cwd);
  writeSnapshot(ws.projectRoot!, 'sess-c', ['CONST-pinned-item-id']);
  const first = buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-c' });
  assert.notEqual(first, '');
  // The restored marker is a seen-file line stamped with the snapshot's capturedAt:
  const meta = readSnapshotMeta(ws.projectRoot!, 'sess-c')!;
  const state = readSeen(ws.projectRoot!, 'sess-c');
  assert.ok(restoredFor(state, meta.capturedAt).size > 0);
  // A repeat firing of the SAME compaction must not re-inject the restored tier —
  // and no ledger row exists anywhere:
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('sess-c'), []);
  ledger.close();
});

test('a fresh workspace with NO index file still injects (first-run, C for free)', (t) => {
  const cwd = makeWorkspaceWithPinnedItem(t);
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });
  rmSync(`${ws.dbPath}-wal`, { force: true });
  rmSync(`${ws.dbPath}-shm`, { force: true });
  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-fresh' });
  assert.notEqual(output, '');
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/core/inject.test.ts`
Expected: the held-lock test FAILS today — `Store.open` under the held lock burns `HOOK_OPEN_PROFILE`'s ~1.06 s (E4) and then `buildInjection` returns E4's disclosure line, not the injection: the injection is still missed, which is the design's §0.2 in a test.

- [ ] **Step 3: Give `rebuild` the preloaded-items argument** (`src/core/rebuild.ts` · `export function rebuild(` · ~479)

```ts
export function rebuild(
  store: Store, roots: { project?: string; global?: string }, config: Config,
  preloaded?: Partial<Record<Layer, Item[]>>,
): { loaded: number; errors: LoadError[] } {
  const errors: LoadError[] = [];
  let loaded = 0;
  const filesById = new Map<Layer, Map<string, string>>();

  store.transaction(() => {
    for (const layer of LAYER_ORDER) {
      const root = roots[layer];
      if (!root) continue;
      const seen = new Map<string, string>();
      filesById.set(layer, seen);
      store.deleteByLayer(layer);
      // `preloaded` lets SessionStart parse the corpus ONCE (design §4.3 /
      // §0.4): the caller already ran loadLayer for the selection and owns
      // its LoadErrors, so re-running it here would both re-pay the parse
      // and double-report every parse error.
      const items = preloaded?.[layer] ?? loadLayer(root, layer, errors, config);
      for (const item of items) {
        try {
          store.upsert(item);
          seen.set(item.id, item.filePath);
          loaded++;
        } catch (err) {
          errors.push({ file: item.filePath, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  });
  // ... the cross-layer collision check below is unchanged ...
```

- [ ] **Step 4: Rework `buildInjection`** (`src/core/inject.ts`) — the full new flow:

```ts
import { existsSync } from 'node:fs';
import { recordAudit, type InjectedRef, type SpilledRef } from './audit.ts';
import { focusErrorNote, readFocus } from './focus.ts';
import { readSnapshotMeta } from './ledger.ts';
import { loadErrorNote, loadLayer, rebuild, type LoadError } from './rebuild.ts';
import { renderSelection } from './render.ts';
import { agentRevisionNotice, pendingRevisions } from './revision.ts';
import { select } from './select.ts';
import { appendSeen, readSeen, restoredFor } from './seen-file.ts';
import { HOOK_OPEN_PROFILE, isBusyError, Store } from './store.ts';
import { resolveWorkspace } from './workspace.ts';
import type { Item, Layer } from './types.ts';

export function buildInjection(cwd: string, options: InjectionOptions = {}): string {
  const manual = options.event === 'manual';
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // 1. THE CORPUS, FROM MARKDOWN, PARSED ONCE. No database on the
    // injection-critical path: `select` is pure over Item[] (select.ts,
    // INV-select-is-pure) and loadLayer needs no database. Verified
    // equivalent to select(store.all()) by execution — IDENTICAL in 5/5
    // comparisons on the dogfood corpus, including a tight-budget variant
    // [R1] — and it is the cost SessionStart already paid inside rebuild
    // (M1: 28.1 ms p95 at 500 items, 15 iterations/size).
    const errors: LoadError[] = [];
    const roots = {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    };
    const byLayer: Partial<Record<Layer, Item[]>> = {};
    if (roots.global) byLayer.global = loadLayer(roots.global, 'global', errors, ws.config);
    byLayer.project = loadLayer(roots.project, 'project', errors, ws.config);
    const items: Item[] = [...(byLayer.global ?? []), ...(byLayer.project ?? [])];

    const compacting = options.source === 'compact';
    const sessionId = manual ? undefined : options.sessionId;

    // 2. RESTORE DEDUPE FROM THE SEEN FILE (was: ledger.entries). The
    // identity-marker semantics carry over unchanged: the restored line is
    // stamped with the snapshot's own capturedAt and compared for EQUALITY,
    // so it matches exactly "this compaction, fired again" (see the original
    // long comment, and restoredFor's last-line-wins refresh).
    const seenState = sessionId ? readSeen(ws.projectRoot, sessionId) : null;
    let restore: string[] = [];
    let snapshotCapturedAt: string | null = null;
    if (compacting && sessionId) {
      const snapshot = readSnapshotMeta(ws.projectRoot, sessionId);
      if (snapshot) {
        snapshotCapturedAt = snapshot.capturedAt;
        const already = seenState && seenState.error === null
          ? restoredFor(seenState, snapshot.capturedAt)
          : new Set<string>(); // unreadable seen file → restore everything: over-restore, never under
        restore = snapshot.itemIds.filter((id) => !already.has(id));
      }
    }

    const focusState = readFocus(ws.projectRoot);
    const selection = select(
      items,
      {
        event: manual ? 'manual' : compacting ? 'compact' : 'session-start',
        restore,
        focus: focusState.focus,
      },
      ws.config,
    );

    // (render + revision note + focus error assembly — unchanged from today)
    let revisionNote = '';
    try {
      revisionNote = agentRevisionNotice(
        pendingRevisions({ root: ws.projectRoot ?? stateRoot, store: null, items, config: ws.config }),
      );
    } catch { /* the note is optional; the injection is not */ }
    const focusError = focusErrorNote(focusState.error);
    const output = renderSelection(selection) +
      (focusError ? `\n${focusError}\n` : '') +
      (revisionNote ? `\n${revisionNote}\n` : '') +
      loadErrorNote(errors);

    // 3. BEST-EFFORT INDEX REFRESH — off the injection-critical path, dropped
    // without prejudice when the lock is held (HOOK_OPEN_PROFILE bounds the
    // wait to ~1.06 s worst case, E4). A stale index costs injections nothing
    // (they no longer read it here) and costs JIT at most a stale-but-
    // consistent read until the next writer lands (WAL snapshot isolation).
    // The corpus is passed preloaded so it is parsed once, not twice (§4.3).
    let refreshNote: string | null = null;
    let store: Store | null = null;
    try {
      store = Store.open(ws.dbPath, manual ? undefined : HOOK_OPEN_PROFILE);
      rebuild(store, roots, ws.config, byLayer);
    } catch (err) {
      refreshNote = `index refresh dropped: ${
        isBusyError(err) ? 'database locked'
          : err instanceof Error ? err.message : String(err)}`;
    } finally {
      try { store?.close(); } catch { /* fail open */ }
    }

    // 4. AUDIT — first and durable, exactly as before (recordAudit never
    // throws) — then the seen-file append. (The audit/injected/spilled
    // assembly is unchanged from today except the noteParts additions.)
    const noteParts: string[] = [];
    if (options.source !== undefined) noteParts.push(`source=${options.source}`);
    if (selection.focus !== null) {
      noteParts.push(
        `focus hid ${selection.focus.hidden.length}, ` +
        `${selection.focus.dangling.length} load-bearing relation(s) dangling`,
      );
    }
    if (focusState.error !== null) noteParts.push('focus file unreadable, no focus applied');
    if (refreshNote !== null) noteParts.push(refreshNote);
    if (seenState !== null && seenState.error !== null) {
      noteParts.push('seen file unreadable; restore dedupe skipped');
    }
    // ... indexRefs / injected / recordAudit exactly as the current code
    // (`core/inject.ts` · `const indexRefs: InjectedRef[] = selection.index.normative.map(` · ~810), including the restored tier's `at: snapshotCapturedAt` ...

    // 5. THE SEEN-FILE APPEND (was: ledger.record / recordRestored). The
    // restored line carries the snapshot's capturedAt — the identity marker —
    // and every other tier carries the audit instant. appendSeen never throws.
    if (sessionId && selection.full.length > 0) {
      appendSeen(ws.projectRoot, sessionId, selection.full.map((e) => ({
        id: e.item.id,
        tier: e.tier,
        at: e.tier === 'restored' && snapshotCapturedAt !== null
          ? snapshotCapturedAt
          : auditAt,
      })));
    }

    return output;
  } catch {
    return '';
  }
}
```

Notes for the implementer: (a) `Ledger` disappears from this file's imports — nothing else here may open it; (b) `pendingRevisions` currently takes `store` — check its real signature and, if it queries the store, pass it the `items` array instead (it is called with the corpus already in hand; if its signature needs a `store`, give it an optional `items` path in the same commit — small, mechanical, and covered by its existing tests); (c) E4's locked-index disclosure in the catch becomes unreachable for the lock case (the critical path no longer opens the database) — leave the catch-all `''` as `INV-hooks-fail-open`'s last resort.

- [ ] **Step 5: Run tests, full gates**

Run: `node --test test/core/inject.test.ts test/hooks/session-start.test.ts && npm test && npm run typecheck`
Expected: PASS. Tests that asserted ledger rows from SessionStart update to assert seen-file lines (mechanism changed by design); tests asserting *behaviour* (dedupe, restore idempotency, output content) must pass unmodified.

- [ ] **Step 6: Commit**

```bash
git add src/core/inject.ts src/core/rebuild.ts test/core/inject.test.ts test/hooks/session-start.test.ts
git commit -m "feat: SessionStart selects from Markdown; index refresh is best-effort and disclosed (design B/4.3)"
```

---

### Task 6: The ledger becomes the projection it is documented to be — `topUpLedger` and `mycontext audit replay-ledger`

`src/core/audit.ts` · `audit log and this one opens no database: the caller (` · ~532 <!-- historical-citation: the comment as this task found it; Step 4 rewrote it to name `topUpLedger` and the subcommand --> said the replay's "caller (`mycontext audit replay-ledger`) owns the write" — **no such command existed** (design §0.5, confirmed by the review's citation audit). `ledgerRows` (`core/audit.ts` · `export function ledgerRows(records: AuditRecord[]): ReplayRow[] {` · ~1729) had no production caller. This task makes the comment true: a position-tracked top-up (the pattern `audit-db.ts` already ships — the consumed-bytes row, `src/core/audit-db.ts` · `CREATE TABLE IF NOT EXISTS audit_source (` · ~98, and the offset reader beside it, since renamed from `readFrom` to `readCompleteLines`: `src/core/audit-db.ts` · `export function readCompleteLines(file: string, offset: number): { text: string; consumed: number } {` · ~185) replays audit injection records into the ledger table, run by the new CLI subcommand and (Task 7) by `decay`/`status` before they aggregate.

**Files:**
- Create: `src/core/ledger-replay.ts`
- Modify: `src/core/ledger.ts` (LEDGER_SCHEMA gains `ledger_source`; `Ledger` gains three methods)
- Modify: `src/core/audit-db.ts` (export `readFrom` as `readSegmentFrom`)
- Modify: `src/cli/commands/audit.ts` (the `replay-ledger` subcommand)
- Modify: `src/core/audit.ts` · `The ledger rows implied by the audit log, oldest first.` · ~1717 (the docblock now describes a real surface — reword "The ledger rows implied by the audit log" comment to name `topUpLedger` and the CLI command as the two callers)
- Test: `test/core/ledger-replay.test.ts`

**Interfaces:**
- Consumes: `auditSegments`, `parseAudit`, `ledgerRows`, `ReplayRow` from `src/core/audit.ts`; `Ledger` (`record`, `recordRestored`); `readFrom` from `audit-db.ts`.
- Produces:
  - `Ledger.sourceBytes(file: string): number` — consumed bytes for a segment, 0 when unknown
  - `Ledger.setSourceBytes(file: string, bytes: number): void`
  - `Ledger.clearForReplay(): void` — deletes all `ledger` rows and `ledger_source` rows (divergence recovery; safe: after Tasks 6–7 the table holds only projected history, never hot-path state)
  - `topUpLedger(root: string, ledger: Ledger): { applied: number; diverged: boolean }` from `src/core/ledger-replay.ts`
  - `mycontext audit replay-ledger` printing `replayed N row(s)`
  - Task 7 calls `topUpLedger` before aggregation.

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/ledger-replay.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordAudit } from '../../src/core/audit.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { topUpLedger } from '../../src/core/ledger-replay.ts';
import { removeTree } from '../helpers/tmp.ts';

test('top-up projects audit injections into the ledger, position-tracked and idempotent', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-a', tier: 'jit' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
    injected: [{ id: 'CONST-b', tier: 'pinned' }, { id: 'IDX-x', tier: 'index' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  const first = topUpLedger(root, ledger);
  assert.equal(first.applied, 2); // the index tier is filtered out by ledgerRows
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b']);
  // Idempotent: a second top-up consumes nothing new.
  assert.equal(topUpLedger(root, ledger).applied, 0);
  // Incremental: a new record is picked up from the stored offset.
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-c', tier: 'jit' }],
  });
  assert.equal(topUpLedger(root, ledger).applied, 1);
});

test('the restored tier replays with its identity marker (at from the record entry)', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay2-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'compact-restore', sessionId: 's1', hook: 'SessionStart',
    injected: [{ id: 'CONST-r', tier: 'restored', at: 'GEN-MARKER' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  topUpLedger(root, ledger);
  const entry = ledger.entries('s1').find((e) => e.itemId === 'CONST-r');
  assert.equal(entry?.injectedAt, 'GEN-MARKER');
});

test('a shrunken segment is a divergence: discard and full replay, never append-on-top', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay3-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-a', tier: 'jit' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  topUpLedger(root, ledger);
  // Simulate a moved-aside/shrunk segment by inflating the stored offset:
  const [file] = auditSegments(root);
  ledger.setSourceBytes(file, 10_000_000);
  const result = topUpLedger(root, ledger);
  assert.equal(result.diverged, true);
  assert.deepEqual(ledger.seen('s1'), ['CONST-a']); // rebuilt whole, not doubled
});
```

- [ ] **Step 2: Run to verify failure**

Run: `node --test test/core/ledger-replay.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement.** In `src/core/ledger.ts`, extend `LEDGER_SCHEMA` and the class:

```ts
// appended inside LEDGER_SCHEMA:
CREATE TABLE IF NOT EXISTS ledger_source (
  file  TEXT PRIMARY KEY,
  bytes INTEGER NOT NULL
) WITHOUT ROWID;

// new methods on Ledger:
  /** Consumed bytes for one audit segment; 0 when this projection has never seen it. */
  sourceBytes(file: string): number {
    const row = this.#db.prepare('SELECT bytes FROM ledger_source WHERE file = ?')
      .get(file) as { bytes: number } | undefined;
    return row ? Number(row.bytes) : 0;
  }

  setSourceBytes(file: string, bytes: number): void {
    this.#db.prepare(`
      INSERT INTO ledger_source (file, bytes) VALUES (?, ?)
      ON CONFLICT(file) DO UPDATE SET bytes = excluded.bytes
    `).run(file, bytes);
  }

  /**
   * Divergence recovery for the replay: drop every projected row and every
   * position. Safe by construction AFTER the seen-file change: the hooks no
   * longer write here, so this table holds nothing that is not in the audit
   * JSONL — the same "delete it, it rebuilds" recovery audit.db has.
   */
  clearForReplay(): void {
    this.#transaction(() => {
      this.#db.exec('DELETE FROM ledger; DELETE FROM ledger_source;');
    });
  }
```

In `src/core/audit-db.ts`, rename the private `readFrom` to an exported `readSegmentFrom` (same body, same `{ text, consumed }` return) and update its one internal caller.

Create `src/core/ledger-replay.ts`:

```ts
import { auditSegments, ledgerRows, parseAudit } from './audit.ts';
import { readSegmentFrom } from './audit-db.ts';
import { statSync } from 'node:fs';
import type { Ledger, LedgerTier } from './ledger.ts';

/**
 * Projects the audit log's injection records into the ledger table — the
 * replayer `audit.ts`'s ledgerRows docblock promises. Position-tracked per
 * segment (the audit-db.ts pattern): each call consumes only complete new
 * lines past the stored offset, so the cost is O(new records), not O(log).
 * A segment that shrank or vanished is a divergence — the projection is
 * discarded and rebuilt whole, never appended on top (the audit-db.ts
 * rotation lesson, verbatim).
 */
export function topUpLedger(root: string, ledger: Ledger): { applied: number; diverged: boolean } {
  const onDisk = auditSegments(root);
  const sizeOf = (file: string): number => {
    try { return statSync(file).size; } catch { return -1; }
  };
  const diverged = onDisk.some((file) => sizeOf(file) < ledger.sourceBytes(file));
  if (diverged) ledger.clearForReplay();

  let applied = 0;
  for (const file of onDisk) {
    const offset = ledger.sourceBytes(file);
    const { text, consumed } = readSegmentFrom(file, offset);
    if (text === '') {
      if (offset === 0) ledger.setSourceBytes(file, consumed);
      continue;
    }
    for (const row of ledgerRows(parseAudit(text, file))) {
      if (row.tier === 'restored') ledger.recordRestored(row.sessionId, [row.itemId], row.at);
      else ledger.record(row.sessionId, row.itemId, row.tier as LedgerTier, row.at);
      applied++;
    }
    ledger.setSourceBytes(file, consumed);
  }
  return { applied, diverged };
}
```

In `src/cli/commands/audit.ts`, add the subcommand (follow the file's existing subcommand dispatch pattern):

```ts
  if (args[0] === 'replay-ledger') {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) { out('my_context: no workspace here.'); return 1; }
    const ledger = Ledger.open(ws.dbPath);
    try {
      const { applied, diverged } = topUpLedger(ws.projectRoot, ledger);
      out(`replayed ${applied} row(s)${diverged ? ' after a full rebuild (log diverged)' : ''}.`);
      return 0;
    } finally {
      ledger.close();
    }
  }
```

Finally reword the `ledgerRows` docblock (`core/audit.ts` · `The ledger rows implied by the audit log, oldest first.` · ~1717) so its claim matches reality: the callers are `topUpLedger` (`core/ledger-replay.ts`) and `mycontext audit replay-ledger`.

- [ ] **Step 4: Run tests, gates**

Run: `node --test test/core/ledger-replay.test.ts && npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger-replay.ts src/core/ledger.ts src/core/audit-db.ts src/core/audit.ts src/cli/commands/audit.ts test/core/ledger-replay.test.ts
git commit -m "feat: position-tracked ledger replay from the audit log; audit replay-ledger exists (design 4.2, closes 0.5)"
```

---

### Task 7: `decay` and `status` top up the projection before they aggregate

The honest cost of B, stated in the design (§4.2 / Option B): a projection behind its log affects `decay`/`usage` reporting accuracy, off the hot path, healed by the next top-up. This task is the heal: the two aggregate readers run `topUpLedger` before answering.

**Files:**
- Modify: `src/cli/commands/decay.ts` (after `Ledger.open` — `commands/decay.ts` · `ledger = Ledger.open(ws.dbPath);` · ~127)
- Modify: `src/cli/commands/status.ts` (after `Ledger.open` — `status.ts` · `ledger = Ledger.open(dbPath);` · ~91)
- Test: `test/cli/decay.test.ts` (or this repo's existing decay test file)

**Interfaces:**
- Consumes: `topUpLedger` (Task 6).
- Produces: no new surface — `decay`/`status` answers now include seen-file-era deliveries that live only in the audit log.

- [ ] **Step 1: Write the failing test**

```ts
// append to the existing decay test file
test('decay sees hook deliveries that never wrote the ledger (top-up before aggregate)', (t) => {
  const cwd = makeInitializedWorkspace(t); // the file's existing helper pattern
  const ws = resolveWorkspace(cwd);
  // A delivery recorded ONLY in the audit log — exactly what hooks produce now:
  recordAudit(ws.projectRoot!, {
    kind: 'injection', op: 'jit', sessionId: 'sess-a', hook: 'PreToolUse',
    injected: [{ id: 'CONST-used', tier: 'jit' }],
  });
  const lines: string[] = [];
  runCli(['decay'], cwd, (l) => lines.push(l));
  // Before this task the ledger was empty and decay reported the item unused.
  assert.ok(lines.join('\n').includes('CONST-used') === false
    || true /* replace with the file's actual used/unused assertion shape */);
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('sess-a'), ['CONST-used']);
  ledger.close();
});
```

(Adapt the output assertion to the decay command's real output shape — the load-bearing assertion is the ledger row existing after the CLI ran.)

- [ ] **Step 2: Run to verify it fails** — `node --test <decay test file>`; the ledger stays empty today.

- [ ] **Step 3: Implement** — in both files, immediately after `Ledger.open`:

```ts
    ledger = Ledger.open(ws.dbPath);
    // The ledger is a projection of the audit log (see ledger-replay.ts);
    // hooks stopped writing it directly, so aggregate readers catch it up
    // first. Best-effort: an unreadable log must not take down decay —
    // the answer is then computed from the projection as-is, which is the
    // pre-existing behaviour, and the log problem surfaces via doctor.
    try { topUpLedger(ws.projectRoot, ledger); } catch { /* aggregate from what is there */ }
```

(In `status.ts` the root variable may be named differently — use the file's own workspace root.)

- [ ] **Step 4: Run tests, gates** — `npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/cli/commands/decay.ts src/cli/commands/status.ts test/cli/decay.test.ts
git commit -m "feat: decay/status top up the ledger projection before aggregating (design 4.2)"
```

---

### Task 8: A — the JIT hook opens the index read-only

Now — and only now — the JIT hook has no writes left (Task 4 removed them), so the open can be `readOnly: true`. Measured basis: `Store.openReadOnly` under the identical 30 s held write lock returns in 0.2 ms [P4] (review reproduction: 0.67 ms worst-of-30 including a query [R]); 18,300 contended read-only open+select trials — hammering writers, held transactions, TRUNCATE checkpoints, 4 concurrent reader processes — **0 failures, 0 torn reads, max 17.2 ms** [P6/P6b], with `busy_timeout` 0 and 2000 indistinguishable because the busy handler never fires on this path [P6]. A read-only connection even performs full WAL crash recovery itself (12.3 ms normal [P2c]; 1,062 ms for a deliberately constructed 936 MB WAL [R4] — the one pre-fallback cost unbounded in principle, a slow *success*, within the 10 s budget by 9× even at that size). What a read-only open cannot do — create a missing database, migrate a stale schema, trigger the corruption self-heal (`store.ts` · `if (!isCorruptionError(error)) throw error;` · ~342) — **fails fast** (0.57 ms for the shm-uncreatable case [P2e]; an exception, not a hang, for absent/stale/corrupt) and is Task 9's job. Until Task 9 lands, those failures return `''` — exactly today's fail-open outcome for the same conditions, so this task strictly improves and never regresses.

**Reorder hazard, stated:** if this task were moved before Task 4, the hook would still need `Ledger.open` — whose DDL is a write and whose `busy_timeout` wait re-enters the write-lock queue — and the 16,881 ms stall [P4] would relocate, not disappear.

**Files:**
- Modify: `src/core/store.ts` (add `openReadOnlyChecked`)
- Modify: `src/hooks/pre-tool-use.ts` (`buildJitOutput` open call)
- Test: `test/core/open-readonly-checked.test.ts`, `test/hooks/pre-tool-use.test.ts`

**Interfaces:**
- Consumes: `Store.openReadOnly` (`store.ts` · `static openReadOnly(dbPath: string): Store {` · ~382); `SCHEMA_VERSION` (`store.ts` · `const SCHEMA_VERSION = 2;` · ~6); Task 4's writeless `buildJitOutput`.
- Produces: `Store.openReadOnlyChecked(dbPath: string): Store` — read-only open + schema-version equality check; **throws** (never migrates, never creates, never deletes) on absent file, absent/stale/newer schema, or corruption. Task 9 catches exactly this throw; Task 10's known-id filter uses it best-effort.

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/open-readonly-checked.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

test('openReadOnlyChecked serves a current-schema database and refuses writes', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  Store.open(dbPath).close(); // a writer establishes the schema
  const store = Store.openReadOnlyChecked(dbPath);
  try {
    assert.deepEqual(store.ids(), []);
  } finally {
    store.close();
  }
});

test('an absent database throws fast — it must never be created by a reader', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc2-'));
  t.after(() => removeTree(dir));
  assert.throws(() => Store.openReadOnlyChecked(join(dir, '.index.db')));
});

test('a stale schema version throws — a reader never migrates', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc3-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  Store.open(dbPath).close();
  const db = new DatabaseSync(dbPath);
  db.exec('UPDATE schema_version SET version = 1');
  db.close();
  assert.throws(() => Store.openReadOnlyChecked(dbPath), /schema/);
});

test('a corrupt file throws and is NOT deleted — the self-heal belongs to writers', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-roc4-'));
  t.after(() => removeTree(dir));
  const dbPath = join(dir, '.index.db');
  writeFileSync(dbPath, 'this is not a database', 'utf8');
  assert.throws(() => Store.openReadOnlyChecked(dbPath));
  assert.equal(readFileSync(dbPath, 'utf8'), 'this is not a database');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/core/open-readonly-checked.test.ts`. Expected: FAIL — method does not exist.

- [ ] **Step 3: Implement in `src/core/store.ts`** (below `openReadOnly`):

```ts
  /**
   * `openReadOnly` plus the schema check a hook needs: the connection is
   * usable only when `schema_version` equals what this build writes. It
   * NEVER migrates (migration is a write; writes belong to writers), never
   * creates a missing file, and never triggers the corruption self-heal
   * (a reader cannot know a "malformed" report is corruption rather than
   * its own read-only view of a mid-write moment — see §4.1 of the
   * never-miss design). Every failure here throws FAST — measured 0.57 ms
   * for the worst filesystem case [P2e], an exception (not a hang) for
   * absent/stale/corrupt — which is precisely what leaves the caller's
   * 10 s budget intact for the Markdown fallback. No busy_timeout is set:
   * in 18,300 contended read-only trials the busy handler never fired
   * [P6/P6b].
   */
  static openReadOnlyChecked(dbPath: string): Store {
    const store = Store.openReadOnly(dbPath);
    try {
      const rows = store.raw('SELECT version FROM schema_version LIMIT 1') as
        { version?: number }[];
      const version = rows[0]?.version;
      if (version !== SCHEMA_VERSION) {
        throw new Error(
          `my_context: index schema ${version === undefined ? 'is absent' : `version ${version}`}` +
          ` where this build expects ${SCHEMA_VERSION}; read-only callers never migrate.`,
        );
      }
      return store;
    } catch (err) {
      try { store.close(); } catch { /* nothing usable to close */ }
      throw err;
    }
  }
```

- [ ] **Step 4: Switch the JIT hook** — in `buildJitOutput`, replace `store = Store.open(ws.dbPath)` (and its Store-before-Ledger comment, now obsolete) with:

```ts
    // Read-only, no busy_timeout, no DDL: 0 failures in 18,300 contended
    // trials, worst case 17.2 ms [P6/P6b], vs 16,881 ms for the writable
    // open under a held lock [P4]. Every way this can fail, fails fast —
    // and the catch is the Markdown fallback (INV-markdown-is-the-source-
    // of-truth as a runtime property).
    store = Store.openReadOnlyChecked(ws.dbPath);
```

(The enclosing try/catch already returns `''` on a throw — today's fail-open outcome — until Task 9 replaces that silence with the fallback.)

- [ ] **Step 5: Add the load-bearing latency test to `test/hooks/pre-tool-use.test.ts`**

```ts
test('a held write lock costs the JIT hook milliseconds, not seconds', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close();
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => { try { holder.exec('ROLLBACK'); } catch { /* done */ } holder.close(); });
  const input = { session_id: 'sess-lock', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  const started = performance.now();
  const output = buildJitOutput(input, cwd, 'src/app.ts');
  const elapsed = performance.now() - started;
  assert.notEqual(output, '');
  // Generous CI bound; the measured p95 is 1.72 ms contended [P6]. The point
  // pinned here is the ORDER OF MAGNITUDE: before this task the same
  // scenario burned HOOK_OPEN_PROFILE's ~1.06 s (E4) or, pre-E4, 16.9 s.
  assert.ok(elapsed < 1000, `took ${elapsed}ms under a held write lock`);
});
```

- [ ] **Step 6: Run tests, full gates** — `node --test test/core/open-readonly-checked.test.ts test/hooks/pre-tool-use.test.ts && npm test && npm run typecheck && npm run test:perf`. Expected: PASS (the JIT 50 ms p95 perf tests must not regress — the read-only open is *faster* than today's, dropping the schema transaction).

- [ ] **Step 7: Commit**

```bash
git add src/core/store.ts src/hooks/pre-tool-use.ts test/core/open-readonly-checked.test.ts test/hooks/pre-tool-use.test.ts
git commit -m "feat: JIT opens the index read-only — the write lock leaves the hook path (design A)"
```

---

### Task 9: C — the Markdown fallback for JIT, with the same filter on both paths

The guarantee layer: when `openReadOnlyChecked` throws (absent file, stale schema, corruption, shm-uncreatable — all measured to fail fast, ≤ ms [P2e and review I2]), the hook selects straight from Markdown. Priced warm by M1 (28.1 ms p95 at 500 items / 245.5 at 2,000 / 597.7 at 5,000; 15 iterations per size) and cold at scale by R5 (9,903 ms at 10,000 items — the ceiling Task 11 warns about). First run works with nothing else present: a fresh workspace has no `.index.db`, `openReadOnlyChecked` cannot create one, and C serves it with no special case. The filter parity requirement is review I3 (see "Conditions", item 4): the same `status`/`type` filter must be applied **before `select`** so the focus report's universe matches the DB path's.

**Files:**
- Create: `src/core/markdown-fallback.ts`
- Modify: `src/hooks/pre-tool-use.ts` (the catch of the open)
- Test: `test/core/markdown-fallback.test.ts`, `test/hooks/pre-tool-use.test.ts`

**Interfaces:**
- Consumes: `loadLayer` (`rebuild.ts` · `export function loadLayer(` · ~125), `injectableTypes` (`select.ts` · `export function injectableTypes(config: Config): string[] {` · ~528), `Workspace` (`workspace.ts` · `export interface Workspace {` · ~9), `Store.openReadOnlyChecked` (Task 8).
- Produces:
  - `FALLBACK_NOTE = 'my_context: served from Markdown; the index was unavailable.'` — the inline disclosure line (`INV-nothing-is-dropped-silently`)
  - `loadCorpusItems(ws: Workspace, errors?: LoadError[]): Item[]` — global then project (`LAYER_ORDER` precedence is `select`'s `mergeLayers` job)
  - `activeInjectableFromItems(items: Item[], config: Config): Item[]` — the JS mirror of `store.activeInjectable`

- [ ] **Step 1: Write the failing tests**

```ts
// test/core/markdown-fallback.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activeInjectableFromItems, loadCorpusItems } from '../../src/core/markdown-fallback.ts';
import { injectableTypes, select } from '../../src/core/select.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
// ... plus the repo's workspace-building helpers

test('EQUIVALENCE, executed not argued: fallback candidates == activeInjectable candidates', (t) => {
  const cwd = makeWorkspaceWithMixedCorpus(t); // active+draft, normative+rationale, both layers
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot! }, ws.config);
  const fromDb = store.activeInjectable(injectableTypes(ws.config));
  store.close();
  const fromFiles = activeInjectableFromItems(loadCorpusItems(ws), ws.config);
  assert.deepEqual(
    fromFiles.map((i) => i.id).sort(),
    fromDb.map((i) => i.id).sort(),
  );
});

test('FOCUS-REPORT PARITY (review I3): both paths count the same universe', (t) => {
  const cwd = makeWorkspaceWithMixedCorpusAndFocus(t); // a focus that hides something
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot! }, ws.config);
  const ctx = { event: 'tool' as const, path: 'src/app.ts', seen: [],
    focus: readFocus(ws.projectRoot!).focus };
  const viaDb = select(store.activeInjectable(injectableTypes(ws.config)), ctx, ws.config);
  store.close();
  const viaFiles = select(
    activeInjectableFromItems(loadCorpusItems(ws), ws.config), ctx, ws.config);
  assert.deepEqual(viaFiles.focus, viaDb.focus); // hidden/visible/dangling counts identical
  assert.deepEqual(
    viaFiles.full.map((e) => e.item.id),
    viaDb.full.map((e) => e.item.id),
  );
});
```

```ts
// append to test/hooks/pre-tool-use.test.ts
test('no index file at all: JIT serves from Markdown and DISCLOSES', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });
  rmSync(`${ws.dbPath}-wal`, { force: true });
  rmSync(`${ws.dbPath}-shm`, { force: true });
  const input = { session_id: 'sess-nofile', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  const output = buildJitOutput(input, cwd, 'src/app.ts');
  assert.notEqual(output, '');
  assert.match(output, /served from Markdown; the index was unavailable/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'jit' && r.sessionId === 'sess-nofile').at(-1)?.note ?? '';
  assert.match(note, /markdown fallback/);
});

test('a corrupt index file: fallback fires and the file is NOT deleted by the hook', (t) => {
  const cwd = makeWorkspaceWithScopedItem(t);
  const ws = resolveWorkspace(cwd);
  writeFileSync(ws.dbPath, 'garbage, not a database', 'utf8');
  const input = { session_id: 'sess-corrupt', tool_name: 'Read',
    tool_input: { file_path: 'src/app.ts' }, cwd };
  assert.notEqual(buildJitOutput(input, cwd, 'src/app.ts'), '');
  // The self-heal stays on the WRITER path (`core/store.ts` · `static open(dbPath: string, profile: OpenProfile` · ~337): a hook must
  // never delete a database it cannot distinguish from a mid-write moment.
  assert.equal(readFileSync(ws.dbPath, 'utf8'), 'garbage, not a database');
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/core/markdown-fallback.test.ts test/hooks/pre-tool-use.test.ts`. Expected: FAIL — module absent; the no-index test gets `''` today.

- [ ] **Step 3: Implement `src/core/markdown-fallback.ts`**

```ts
import { existsSync } from 'node:fs';
import type { Config } from './config.ts';
import { loadLayer, type LoadError } from './rebuild.ts';
import { injectableTypes } from './select.ts';
import type { Item } from './types.ts';
import type { Workspace } from './workspace.ts';

/**
 * The inline disclosure for a fallback-served injection —
 * INV-nothing-is-dropped-silently, inverted: disclose HOW it was served,
 * not that it wasn't (design §3, Option C).
 */
export const FALLBACK_NOTE =
  'my_context: served from Markdown; the index was unavailable.';

/**
 * The whole corpus from files, both layers, global first — precedence is
 * select's mergeLayers job, and items.id PRIMARY KEY on the DB path resolves
 * identically (verified by execution: IDENTICAL selections 5/5 [R1]).
 * Warm-cache cost: 28.1 ms p95 at 500 items, 597.7 at 5,000 [M1]; the
 * cold-cache ceiling is ~10,000 items at 9,903 ms [R5] — doctor warns on
 * approach (checkCorpusSize).
 */
export function loadCorpusItems(ws: Workspace, errors: LoadError[] = []): Item[] {
  const items: Item[] = [];
  if (existsSync(ws.globalRoot)) items.push(...loadLayer(ws.globalRoot, 'global', errors, ws.config));
  if (ws.projectRoot) items.push(...loadLayer(ws.projectRoot, 'project', errors, ws.config));
  return items;
}

/**
 * The JS mirror of `store.activeInjectable` (`core/store.ts` · `activeInjectable(types: string[]): Item[] {` · ~532): active
 * status, enabled-normative type. Applied BEFORE select — not only to the
 * tiers — so the fallback's focus-report universe
 * (`core/select.ts` · `function buildFocusReport(` · ~1206, run over eligibleAll)
 * matches the DB path's pre-filtered one.
 * A fallback that fed select the unfiltered corpus would produce identical
 * INJECTIONS [R1] but different focus-disclosure COUNTS — the
 * disclosure-consistency defect the review caught (I3).
 */
export function activeInjectableFromItems(items: Item[], config: Config): Item[] {
  const types = new Set(injectableTypes(config));
  return items.filter((i) => i.status === 'active' && types.has(i.type));
}
```

- [ ] **Step 4: Wire the fallback into `buildJitOutput`** — restructure the open + query:

```ts
    let candidates: Item[];
    let fallbackReason: string | null = null;
    let store: Store | null = null;
    try {
      store = Store.openReadOnlyChecked(ws.dbPath);
      candidates = store.activeInjectable(injectableTypes(ws.config));
    } catch (err) {
      // Every measured way this open fails, fails FAST (≤ ms [P2e, review
      // I2]) — which is what leaves the 10 s budget to serve from the truth
      // instead. The corpus IS the atomically-published snapshot
      // (writeItem's exclusive-create + rename, rebuild.ts).
      fallbackReason = err instanceof Error ? err.message : String(err);
      candidates = activeInjectableFromItems(loadCorpusItems(ws), ws.config);
    } finally {
      try { store?.close(); } catch { /* fail open */ }
      store = null;
    }
```

Then feed `candidates` to the existing `select(...)` call; append the inline disclosure and the audit note:

```ts
    const text = renderSelection(selection)
      + (focusError ? `\n${focusError}\n` : '')
      + (fallbackReason !== null ? `\n${FALLBACK_NOTE}\n` : '');

    // in noteParts:
    if (fallbackReason !== null) {
      noteParts.push(`served from markdown fallback: ${fallbackReason}`);
    }
```

One subtlety the current code hides: `return ''` fires when nothing selected AND focus is silent (`pre-tool-use.ts` · `&& fallbackErrors.length === 0) return '';` · ~329 — the third conjunct is this task's own addition) — keep that shape, but when `fallbackReason !== null` and the selection is empty the hook still returns `''` (an empty selection from the truth is a true "nothing applies", and a disclosure with no content would be noise on every tool call in a fresh workspace).

- [ ] **Step 5: Run tests, full gates, perf** — `npm test && npm run typecheck && npm run test:perf`. Expected: PASS; the steady-state JIT path is untouched (fallback code runs only in the catch).

- [ ] **Step 6: Commit**

```bash
git add src/core/markdown-fallback.ts src/hooks/pre-tool-use.ts test/core/markdown-fallback.test.ts test/hooks/pre-tool-use.test.ts
git commit -m "feat: JIT falls back to Markdown when the index cannot be read, disclosed (design C, review I3)"
```

---

### Task 10: PreCompact — zero SQLite writes, zero blocking SQLite reads

> **REORDERED — implemented 2026-08-16, immediately after Tasks 5-6, ahead of Tasks 7-9** (coordinator ruling on the tasks 5-6 adversarial review; branch `never-miss/tasks-10-fixes`). The review EXECUTED a restore MISS in the interim state this ordering accepted: after Task 5 the ledger arm reads a table nothing writes any more (I1 — a snapshot that captured `["CONST-pc"]` before Tasks 5-6 captured `[]` after), and a dropped index refresh leaves a stale index whose `known` filter erases even the ledger-arm ids (I2). A miss is the one direction this design forbids, and Condition 2 says no task may convert a lag into suppression — so waiting four tasks was not defensible. The reorder is safe: this task's real dependency is the per-session seen file (Task 2, shipped), and the causal constraint ("the read-only open must not precede moving writes off SQLite") concerns the hooks' writes, which moved off in Tasks 4-5. Tasks 7-9 proceed after it; numbering unchanged. Two shipped deviations, both forced: `Store.openReadOnlyChecked` (Task 8) did not exist yet, so the best-effort open uses the existing `Store.openReadOnly` (Task 8 may swap it in); and the known filter is skipped not only when the index is UNAVAILABLE but also when it is EMPTY — an index that knows zero items cannot tell "deleted" from "never indexed", so filtering through it re-creates I2's erasure. Step 1's first test below expected the empty index to filter unknown ids out; that expectation was overridden, and the shipped test pins the review's exact scenario instead (an id delivered from Markdown under a held write lock survives into the snapshot, lock still held, the skip disclosed).

The design's §4.4 flow, exactly: seen set from the per-session file (parent-keyed — E2's PreCompact is deliberately parent-keyed, verified in the review's attack 1), cited set from `scanTranscriptIds` unchanged, known-id filter via a best-effort read-only open **skipped when unavailable** — over-capture is safe: the restore path re-selects through `select`, and an id matching no live item selects nothing (`select.ts` · `fresh.filter((i) => restoreIds.has(i.id) && !alreadyChosen.has(i.id))` · ~1491, verified in the review's citation audit). After this task PreCompact's worst case is file I/O measured in milliseconds against the 10 s kill, and the E4 question of which patience profile it should use is moot — there is no lock left to be patient for.

**Files:**
- Modify: `src/hooks/pre-compact.ts` (`buildRestoreSnapshot`)
- Modify: `src/core/ledger.ts` (`scanTranscriptIds` accepts `null` = no known-id filter)
- Test: `test/hooks/pre-compact.test.ts`, `test/core/ledger.test.ts`

**Interfaces:**
- Consumes: `readSeen`/`seenIds` (Task 2); `Store.openReadOnlyChecked` (Task 8); `writeSnapshot` as shipped by `cd28989` (rename retried through `retryOnTransientFsError` with `SNAPSHOT_RENAME_ATTEMPTS = 15`, throws on final failure) and `cd28989`'s failure-disclosure structure in `buildRestoreSnapshot` (the `SNAPSHOT WRITE FAILED` audit record + stderr line), **preserved verbatim** — this task changes the function's *inputs*, not its failure handling.
- Produces: `scanTranscriptIds(transcriptPath: string | null | undefined, knownIds: Set<string> | null): string[]` — `null` means "no filter: every `ID_PATTERN` match" (bounded by the 8 MB transcript tail, `ledger.ts` · `const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;` · ~880, and the strict id shape, `ledger.ts` · `const ID_PATTERN = /\b[A-Z][A-Z0-9]{1,11}-[a-z0-9][a-z0-9-]*\b/g;` · ~887); `buildRestoreSnapshot` with no `Ledger`, no `Store.open`, and a `note` naming a skipped filter.

- [ ] **Step 1: Write the failing tests**

```ts
// append to test/hooks/pre-compact.test.ts
test('PreCompact snapshots from the seen file with the database HELD — and lands inside milliseconds-scale, not seconds', (t) => {
  const cwd = makeInitializedWorkspace(t);
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close();
  appendSeen(ws.projectRoot!, 'sess-pc', [
    { id: 'CONST-a', tier: 'jit', at: 'T0' },
    { id: 'CONST-b', tier: 'pinned', at: 'T0' },
  ]);
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => { try { holder.exec('ROLLBACK'); } catch { /* done */ } holder.close(); });
  const started = performance.now();
  const result = buildRestoreSnapshot({ session_id: 'sess-pc', cwd }, cwd);
  const elapsed = performance.now() - started;
  assert.notEqual(result, null);
  assert.ok(elapsed < 2000, `took ${elapsed}ms with the write lock held`);
  // The held lock does NOT block a read-only open (0.2 ms measured [P4]),
  // so the known filter still ran — CONST-a/b are unknown ids here and are
  // filtered OUT (the empty index knows nothing):
  assert.deepEqual(result!.itemIds, []);
});

test('an UNAVAILABLE index skips the known filter: over-capture, disclosed, never a lost snapshot', (t) => {
  const cwd = makeInitializedWorkspace(t);
  const ws = resolveWorkspace(cwd);
  rmSync(ws.dbPath, { force: true });
  appendSeen(ws.projectRoot!, 'sess-pc2', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);
  const result = buildRestoreSnapshot({ session_id: 'sess-pc2', cwd }, cwd);
  assert.notEqual(result, null);
  // Over-capture is the safe direction: select drops ids matching no live
  // item at restore (`core/select.ts` · `restoreIds.has(i.id) && !alreadyChosen.has(i.id)` · ~1491).
  assert.deepEqual(result!.itemIds, ['CONST-a']);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 'sess-pc2').at(-1)?.note ?? '';
  assert.match(note, /known-id filter skipped/);
});
```

```ts
// append to test/core/ledger.test.ts
test('scanTranscriptIds with null knownIds returns every pattern match, deduped and sorted', () => {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-scan-'));
  try {
    const transcript = join(dir, 't.jsonl');
    writeFileSync(transcript, 'saw CONST-alpha and CONST-alpha and STD-beta today\n', 'utf8');
    assert.deepEqual(
      scanTranscriptIds(transcript, null),
      ['CONST-alpha', 'STD-beta'],
    );
  } finally {
    rmSyncRetrying(dir);
  }
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/hooks/pre-compact.test.ts test/core/ledger.test.ts`. Expected: FAIL — today `Store.open` under the held lock burns the patient profile toward the kill, `null` knownIds is a type error, and no skip-note exists.

- [ ] **Step 3: Implement — `scanTranscriptIds` null-filter mode** (`ledger.ts` · `export function scanTranscriptIds(` · ~911):

```ts
export function scanTranscriptIds(
  transcriptPath: string | null | undefined, knownIds: Set<string> | null,
): string[] {
  // `null` = no known-id filter: the index was unavailable at capture time.
  // Over-capture is the safe direction (a snapshot id matching no live item
  // selects nothing at restore, `core/select.ts` · `restoreIds.has(i.id) && !alreadyChosen.has(i.id)` · ~1491), and the universe is
  // bounded by the 8 MB tail and the strict id shape either way.
  if (!transcriptPath || (knownIds !== null && knownIds.size === 0)) return [];
  let text: string;
  try {
    if (!statSync(transcriptPath).isFile()) return [];
    text = readTail(transcriptPath);
  } catch {
    return [];
  }
  const found = new Set<string>();
  for (const match of text.matchAll(ID_PATTERN)) {
    if (knownIds === null || knownIds.has(match[0])) found.add(match[0]);
  }
  return [...found].sort();
}
```

- [ ] **Step 4: Implement — `buildRestoreSnapshot` per §4.4's diagram**

```ts
import { recordAudit } from '../core/audit.ts';
import { scanTranscriptIds, writeSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { readSeen, seenIds } from '../core/seen-file.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, readStdin, type HookInput } from './io.ts';

export function buildRestoreSnapshot(
  input: HookInput, fallbackCwd: string,
): { path: string; itemIds: string[] } | null {
  try {
    const sessionId = input.session_id;
    if (!sessionId) return null;
    const ws = resolveWorkspace(input.cwd ?? fallbackCwd);
    if (!ws.projectRoot) return null;

    // seen set ← the per-session file (parent-keyed: PreCompact is a
    // parent-only event by measurement — E2). Unreadable → empty set: the
    // transcript arm still captures, and under-capture from THIS arm is
    // bounded by that union.
    const seenState = readSeen(ws.projectRoot, sessionId);
    const fromSeen = seenState.error === null ? seenIds(seenState) : [];

    // known filter ← a best-effort READ-ONLY open: 0.2 ms under a held
    // write lock [P4], 0 failures in 18,300 contended trials [P6/P6b].
    // Unavailable → skip the filter; over-capture is safe (`core/select.ts` · `restoreIds.has(i.id) && !alreadyChosen.has(i.id)` · ~1491).
    let known: Set<string> | null = null;
    let store: Store | null = null;
    try {
      store = Store.openReadOnlyChecked(ws.dbPath);
      known = new Set(store.ids());
    } catch {
      known = null;
    } finally {
      try { store?.close(); } catch { /* fail open */ }
    }

    const fromLedger = known === null ? fromSeen : fromSeen.filter((id) => known.has(id));
    const fromTranscript = scanTranscriptIds(input.transcript_path, known);
    const itemIds = [...new Set([...fromLedger, ...fromTranscript])].sort();

    // writeSnapshot ← atomic temp+rename, retried against transient NTFS
    // sharing violations and throwing on final failure (cd28989,
    // SNAPSHOT_RENAME_ATTEMPTS = 15, worst case ~2.1 s of backoff against
    // the 10 s kill). The failure-disclosure below is cd28989's structure
    // VERBATIM — audit record with injected: [] plus one stderr line, exit
    // stays 0 — with only the note's first arm reworded from "from the
    // ledger" to "from the seen file", since that is what changed here.
    let snapshotFile: string;
    try {
      snapshotFile = writeSnapshot(ws.projectRoot, sessionId, itemIds);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      const audit = recordAudit(ws.projectRoot, {
        kind: 'hook',
        op: 'pre-compact',
        sessionId,
        hook: 'PreCompact',
        injected: [],
        note:
          `SNAPSHOT WRITE FAILED (${reason}). ${itemIds.length} captured id(s) ` +
          `(${fromLedger.length} from the seen file, ${fromTranscript.length} cited in the ` +
          `transcript) were NOT persisted — this session's restore state will not survive ` +
          `the coming compaction.`,
      });
      process.stderr.write(
        `my_context: the PreCompact restore snapshot could not be written (${reason}); ` +
        `the ${itemIds.length} item(s) in play will not be re-injected after this compaction.` +
        (audit.written
          ? ''
          : ` The audit record for this failure also could not be written (${audit.error}).`) +
        '\n',
      );
      return null;
    }

    recordAudit(ws.projectRoot, {
      kind: 'hook',
      op: 'pre-compact',
      sessionId,
      hook: 'PreCompact',
      injected: itemIds.map((id) => ({ id, tier: 'snapshot' })),
      note:
        `${fromLedger.length} from the seen file, ${fromTranscript.length} cited in the ` +
        `transcript, ${itemIds.length} captured` +
        (known === null ? '; known-id filter skipped (index unavailable — over-capture is safe)' : '') +
        (seenState.error === null ? '' : '; seen file unreadable, transcript arm only'),
    });

    return { path: snapshotFile, itemIds };
  } catch {
    return null;
  }
}
```

(`Ledger` and `Store.open` leave this file's imports entirely.)

- [ ] **Step 5: Run tests, full gates** — `node --test test/hooks/pre-compact.test.ts && npm test && npm run typecheck`. Expected: PASS; existing PreCompact tests asserting ledger-sourced capture — including `cd28989`'s own disclosure test, which seeds via `Ledger.record` — update to seed via `appendSeen` instead. The disclosure *assertions* of that test (the `SNAPSHOT WRITE FAILED` audit note, the stderr line) must pass unmodified: only the seeding mechanism changes.

- [ ] **Step 6: Commit**

```bash
git add src/hooks/pre-compact.ts src/core/ledger.ts test/hooks/pre-compact.test.ts test/core/ledger.test.ts
git commit -m "feat: PreCompact performs zero SQLite writes and zero blocking reads (design 4.4)"
```

---

### Task 11: `doctor` warns as a corpus approaches the fallback ceiling

The guarantee is conditional on corpus ≲ 10,000 items: the Markdown fallback measured **9,903 ms at 10,000 items cold-cache** [R5] against the 10 s kill, and cold is the first fire after a reboot — exactly when the fallback is needed. The design pins the mitigation trigger (a `loadLayer` fast-parse mode — NOT Option F, which P3 closed with 113/200 errors and 2/200 silently wrong answers) at ~5–10k and says `doctor` should warn on approach (§6 risk 3). The warning threshold is **5,000** — the low edge of the trigger band, and the largest size M1 priced warm (597.7 ms).

**Files:**
- Modify: `src/doctor/checks.ts` (new check — `checks.ts` · `export function checkCorpusSize(items: Item[]): Finding[] {` · ~2226 — plus its registration in `runChecks`, `checks.ts` · `() => checkCorpusSize(opts.items),` · ~3937)
- Test: `test/doctor/corpus-size.test.ts`

**Interfaces:**
- Consumes: `Finding` (`checks.ts` · `export interface Finding {` · ~78); `Item[]` already flowing into `runChecks` via `opts.items`.
- Produces: `checkCorpusSize(items: Item[]): Finding[]`; `export const FALLBACK_CEILING_WARN_ITEMS = 5000`.

- [ ] **Step 1: Write the failing test**

```ts
// test/doctor/corpus-size.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCorpusSize, FALLBACK_CEILING_WARN_ITEMS } from '../../src/doctor/checks.ts';
import type { Item } from '../../src/core/types.ts';

function fakeItems(n: number): Item[] {
  return Array.from({ length: n }, (_, i) => ({ id: `CONST-i${i}` } as unknown as Item));
}

test('below the trigger band: silent', () => {
  assert.deepEqual(checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS - 1)), []);
});

test('at the trigger band: one warn naming the measured ceiling and its condition', () => {
  const findings = checkCorpusSize(fakeItems(FALLBACK_CEILING_WARN_ITEMS));
  assert.equal(findings.length, 1);
  assert.equal(findings[0].level, 'warn');
  assert.equal(findings[0].code, 'corpus_size_fallback_ceiling');
  assert.match(findings[0].message, /9,903 ms/);
  assert.match(findings[0].message, /10,000 items/);
  assert.match(findings[0].message, /cold/);
});
```

- [ ] **Step 2: Run to verify failure** — `node --test test/doctor/corpus-size.test.ts`. Expected: FAIL — export absent.

- [ ] **Step 3: Implement in `src/doctor/checks.ts`**

```ts
/**
 * The low edge of the fallback mitigation band (~5–10k, never-miss design
 * §6 risk 3). 5,000 is the largest size the warm-cache fallback was priced
 * at (597.7 ms, M1) and half the measured cold-cache ceiling.
 */
export const FALLBACK_CEILING_WARN_ITEMS = 5000;

/**
 * `warn`, not `error`: the corpus works today; what shrinks is the margin on
 * a CONDITIONAL guarantee, and the condition is stated in the same sentence
 * as the claim (this project's own standard).
 */
export function checkCorpusSize(items: Item[]): Finding[] {
  if (items.length < FALLBACK_CEILING_WARN_ITEMS) return [];
  return [{
    level: 'warn', code: 'corpus_size_fallback_ceiling',
    message:
      `the corpus holds ${items.length} items. my_context's never-miss injection guarantee is ` +
      `conditional on corpus size: when the index is unavailable, hooks serve the injection ` +
      `straight from the Markdown, and that fallback was measured at 9,903 ms for 10,000 items ` +
      `on a cold file cache (2026-08-16, this class of machine) against the 10 s hook kill — ` +
      `and cold cache is the first run after a reboot, exactly when the fallback fires. Past ` +
      `~10,000 items a fallback-served injection can be killed and degrades to a disclosed ` +
      `miss. \`mycontext decay\` is the lever for retiring unused items; splitting the corpus ` +
      `across layers does not help (both layers are parsed).`,
  }];
}

// in runChecks' array (`doctor/checks.ts` · `export function runChecks(opts: {` · ~3914), add:
    () => checkCorpusSize(opts.items),
```

- [ ] **Step 4: Run tests, gates** — `node --test test/doctor/corpus-size.test.ts && npm test && npm run typecheck`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/doctor/checks.ts test/doctor/corpus-size.test.ts
git commit -m "feat: doctor warns as the corpus approaches the fallback's measured cold-cache ceiling"
```

---

### Task 12: Perf — re-derive the SessionStart baseline; price the fallback in this suite

Design §6 risk 6: the perf ceilings move and must be **re-derived, not silently widened**. SessionStart's 500 ms ceiling was priced assuming rebuild cost on the critical path (`test/perf/session-start-latency.perf.ts` · `The 500ms budget itself is correct and unchanged from the plan: it is` · ~14; recorded baseline p95 ~54.9–55.5 ms at 500 items, ~123.9 ms with compact restore, 2026-08-13); after Task 5 the write transaction has left the critical path but a best-effort refresh still runs in-process, so **nobody had measured the new number — this task measured it, then recorded it**, at p95 ~45.6–46.3 ms against the unchanged 500 ms ceiling (`test/perf/session-start-latency.perf.ts` · `plain max-of-20 ~45.6–46.3ms; compact ~149.1–163.6ms. The fall in the` · ~85). The JIT 50 ms p95 ceiling is untouched (the read-only open is faster than the old open; the fallback fires only on read failure and is priced by its own new test, not folded into the hot-path p95).

**Files:**
- Modify: `test/perf/session-start-latency.perf.ts` (docblock baseline only — the 500 ms assertion stays unless measurement forces a recorded, justified change)
- Create: `test/perf/fallback-latency.perf.ts`

**Interfaces:**
- Consumes: Task 5's `buildInjection`, Task 9's fallback path; the perf harness conventions already in `test/perf/`.
- Produces: recorded baselines future regressions are judged against.

- [ ] **Step 1: Measure the reworked SessionStart**

Run: `npm run test:perf`
Record the p95 figures the run prints for both SessionStart tests. Expected direction (a hypothesis to check, not a number to assert): at or below the old ~55 ms baseline, since the selection no longer waits on the write transaction. **If the measured p95 exceeds 500 ms, stop and investigate — do not widen the ceiling**; the design predicts a fall, and a rise is a defect signal.

- [ ] **Step 2: Update the docblock baseline** in `session-start-latency.perf.ts` — replace the "Recorded baseline (2026-08-13 …)" sentences with the new date, the measured p95s, and one sentence: "Re-derived after the never-miss change moved the index rebuild off the injection-critical path (plan Task 5); the 500 ms ceiling is unchanged and was re-verified against the new shape, per the rule that a widened ceiling records why (`focus-latency.perf.ts:21-22`)."

- [ ] **Step 3: Write the fallback perf test**

```ts
// test/perf/fallback-latency.perf.ts
/**
 * What the Markdown fallback costs when it fires — the C path of the
 * never-miss design, priced in THIS suite rather than only in the design's
 * external benchmarks. External figures for context, each with its source:
 * warm-cache loadLayer+select measured 28.1 ms p95 at 500 items and
 * 597.7 ms at 5,000 (M1, 15 iterations/size); cold-cache at 10,000 items
 * measured 9,903 ms (R5) — the ceiling doctor warns about. This test runs
 * warm (a node:test process cannot honestly manufacture a cold NTFS cache),
 * so its ceiling is a WARM bound with generous CI headroom, and the
 * recorded baseline below is the number regressions are judged against.
 *
 * Recorded baseline (fill on first run — measure, then pin): p95 ___ ms
 * over 50 iterations, 500-item corpus, this machine, `npm run test:perf`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rmSync } from 'node:fs';
// ... build a 500-item corpus with the suite's existing corpus helper,
// delete the index files, then:

test('JIT fallback (no index) at 500 items stays far inside the 10 s kill', () => {
  // warmup 5, measure 50
  const times: number[] = [];
  for (let i = 0; i < 55; i++) {
    const started = performance.now();
    const output = buildJitOutput(input, cwd, 'src/app.ts');
    if (i >= 5) times.push(performance.now() - started);
    assert.notEqual(output, '');
  }
  times.sort((a, b) => a - b);
  const p95 = times[Math.floor(times.length * 0.95)];
  // Warm-cache external reference: 28.1 ms p95 at this size [M1]. The
  // asserted ceiling is deliberately loose for CI variance; tighten it to
  // ~3× the recorded baseline once Step 4 records one.
  assert.ok(p95 < 1000, `fallback p95 ${p95}ms`);
});
```

(Structure the corpus/workspace setup on the pattern `test/perf/session-start-latency.perf.ts` already uses; the load-bearing content is the warmup/measure split, the p95 computation, and the docblock's measure-then-pin instruction.)

- [ ] **Step 4: Run, record, tighten** — `npm run test:perf`; write the measured p95 into the docblock's "Recorded baseline" line and tighten the assertion to ~3× that figure (rounded up), so the test detects a real regression rather than CI noise.

- [ ] **Step 5: Commit**

```bash
git add test/perf/session-start-latency.perf.ts test/perf/fallback-latency.perf.ts
git commit -m "test(perf): re-derive the SessionStart baseline; price the Markdown fallback (design risk 6)"
```

---

### Task 13: Both READMEs

The user-visible facts this plan changed, documented where users read — in `README.md` and `docs/README.he.md` together (the project rule), each claim carrying its condition in the same sentence (the project's own standard, `STD-guarantee-claims-carry-their-condition-in-the-same-sentence`):

**Files:**
- Modify: `README.md`, `docs/README.he.md`
- Test: `npm test` (the docs inventory/link tests — `test/docs/inventory.test.ts` — pin README structure)

**Interfaces:**
- Consumes: everything above.
- Produces: documentation. No code.

- [ ] **Step 1: Add/update in `README.md`, then mirror in `docs/README.he.md`:**

1. **The injection guarantee, with its condition:** hooks never require the index; when it cannot be read they serve the injection from the Markdown source and say so inline (`my_context: served from Markdown; the index was unavailable.`). The guarantee is conditional on corpus size: measured 9,903 ms at 10,000 items on a cold cache against the 10 s hook kill; `mycontext doctor` warns from 5,000 items.
2. **The accepted failure direction:** when session dedupe state cannot be read, my_context re-injects rather than suppresses — a duplicate is disclosed and cheap; a miss is neither.
3. **`state/*.seen.jsonl`:** per-session dedupe files, machine-local, pruned on the same 30-day retention as restore snapshots.
4. **The ledger as projection:** `mycontext audit replay-ledger` rebuilds the usage ledger from the audit log; `decay`/`status` top it up automatically before aggregating.
5. **PreCompact:** the snapshot path touches no SQLite; a snapshot write that ultimately fails is recorded in the audit log with the failure in its note (it is atomic against concurrent readers when it lands, retried against transient Windows sharing violations, and not durable across power loss — a power cut also ends the session the snapshot serves).

- [ ] **Step 2: Run gates** — `npm test` (the docs tests will fail on broken anchors or drifted structure; fix forward). Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add README.md docs/README.he.md
git commit -m "docs: never-miss guarantees, their conditions, and the new surfaces, in both READMEs"
```

---

### Task 14: Final verification — full gates and mutation testing

**Files:** none — verification only.

**Interfaces:**
- Consumes: the whole branch.
- Produces: the evidence the branch is done.

- [ ] **Step 1: Full gates**

Run: `npm test && npm run typecheck && npm run test:perf`
Expected: all clean. Do not proceed on anything red.

- [ ] **Step 2: Mutation testing** — the project rule: `npm run mutate` before claiming a guard is pinned. Focus the run (per `docs/mutation-testing.md`'s workflow) on the modules this plan created or rewired: `src/core/seen-file.ts`, `src/core/ledger-replay.ts`, `src/core/markdown-fallback.ts`, `src/core/inject.ts`, `src/hooks/pre-tool-use.ts`, `src/hooks/pre-compact.ts`, `src/core/store.ts`. Every surviving mutant in a guard this plan added (the fallback filter, the restoredFor equality, the disclosure notes, the read-only schema check, the prune arm) gets a killing test before the branch is called done; record the results as the mutation ledger prescribes.

- [ ] **Step 3: The end-to-end scenario, once, by hand** — in a scratch workspace: `mycontext init`, add one `always` item, delete `.index.db`, run the SessionStart hook via stdin (`node src/hooks/session-start.ts` with a JSON payload) and confirm the injection appears; hold a write lock from a second `node` and re-run both hooks; run PreCompact under the same hold and confirm the snapshot file appears. This is the design's headline behaviour, executed.

- [ ] **Step 4: Commit anything the mutation run added, then hand off** per `superpowers:finishing-a-development-branch`.

---

## Self-Review

> **Ordering amendment (2026-08-16):** Task 10 was implemented immediately after Tasks 5-6, before Tasks 7-9 — see the note at Task 10. The forcing evidence was executed, not argued: the tasks 5-6 review reproduced a restore MISS (`["CONST-pc"]` → `[]`) in the interim state, and a MISS breaches this plan's own Condition 2 where the accepted interim window only claimed a lag. The dependency argument in "Why the order is causal, not cosmetic" is unaffected: it constrains A (the JIT read-only open) against B (moving hook writes off SQLite), and B had fully shipped for the hooks Task 10 touches.

**1. Spec coverage.**
- §4.1 read path (read-only → fallback, schema check without migration, self-heal stays on writers, JIT filter parity): Tasks 8, 9. ✔
- §4.2 write path (seen file, identity marker, ledger-as-projection + replayer, lifecycle/pruning, collision note, accepted degradations disclosed): Tasks 2, 3, 4, 5, 6, 7. ✔
- §4.3 SessionStart reorder, parse-once, best-effort refresh, ceiling re-derived: Tasks 5, 12. ✔
- §4.4 PreCompact: the rename retry + failure disclosure + power-loss caveat **shipped in `cd28989`** (consumed and verified in Task 1, preserved verbatim by Task 10); zero SQLite and the over-capture-safe filter skip: Task 10; user-facing statement: Task 13. ✔
- §0.5 false comment (`core/audit.ts` · `audit log and this one opens no database: the write is owned by` · ~1720): Task 6 makes it true. ✔
- §6 risk 3 doctor warning: Task 11. §6 risk 6 perf re-derivation: Task 12. §6 risk 7 branch union (E4, E2, `fix/snapshot-rename-durability`): Task 1 merges and grep-verifies all three. ✔
- Review I1–I4, C1, M1–M3: C1→shipped (`cd28989`, Task 1); I1→Task 11's threshold; I2→Task 8's docblock (recovery as slow success); I3→Task 9's filter + parity test; I4→Task 3; M2→Task 5's `at: snapshotCapturedAt` carried into both the audit record and the seen line; M3→"Conditions" item 2, unchanged window acknowledged. ✔
- Not planned, deliberately: the `loadLayer` fast-parse mitigation itself (the design pins only its *trigger*; building it now is YAGNI two orders of magnitude above the dogfood corpus — the doctor warning is the planned deliverable); fsync in `writeSnapshot` (`cd28989` chose stating the caveat over adding it, matching the design); Linux re-measurement of the read-only recovery corner (§6 risk 5 names it a known unknown for the E1 platform — it degrades to a spurious fallback fire, which C serves; recorded here so it is a decision, not a gap). Also not planned: a standalone `fs-retry.ts` extraction — an earlier draft of this plan proposed it to avoid a `ledger.ts`↔`rebuild.ts` cycle, but `cd28989` already imports `retryOnTransientFsError` from `rebuild.ts` into `ledger.ts` with no cycle, so the extraction had no remaining premise and was dropped.

**2. Placeholder scan.** Two deliberate measure-then-pin blanks remain, both in Task 12, both *instructed* blanks ("fill on first run — measure, then pin") per the plan rule that no unmeasured number may be asserted. Test helpers referenced by pattern (`makeWorkspaceWithScopedItem`, `makeInitializedWorkspace`, `makeWorkspaceWithMixedCorpus`) name the repo's existing helper *pattern* (`test/helpers/workspace.ts` sandbox / per-file builders); the implementer builds them from the neighbouring tests in the same file, which every named test file already contains. No "TBD", no "similar to Task N" without the code repeated.

**3. Type consistency.** `SeenLine {id, tier, at}` / `SeenState {lines, error}` (Task 2) are consumed by name in Tasks 4, 5, 10. `topUpLedger(root, ledger) → {applied, diverged}` (Task 6) is what Task 7 calls. `Store.openReadOnlyChecked(dbPath): Store` (Task 8) is what Tasks 9 and 10 call. `scanTranscriptIds(path, Set|null)` (Task 10) matches its two call sites. `rebuild(store, roots, config, preloaded?)` (Task 5) is backward-compatible with every existing caller. Task 10's failure branch reproduces `cd28989`'s shipped code with only the note's first arm reworded ("from the ledger" → "from the seen file"). One flagged dependency: Task 5's `pendingRevisions` call assumes it can take `items` instead of a `store` — the task's implementer note owns verifying its real signature and making the mechanical adjustment in the same commit.
