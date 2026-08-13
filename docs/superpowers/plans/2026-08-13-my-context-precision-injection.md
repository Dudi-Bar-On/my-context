# my_context Precision Injection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make injection precise and durable — a session ledger that remembers what was injected, JIT activation of scope-matched items on `Read`/`Edit`/`Write`, a `PreCompact` snapshot that survives compaction and is re-injected at `SessionStart(compact)`, and a hard deny on agent writes into `.my_context/`.

**Architecture:** Plan 1 built a selector that only ever populates the `pinned` tier. This plan populates the remaining two full-text tiers (`jit`, `restored`) inside the same pure `select()` function — no new selection mechanism — and adds two thin hooks plus a ledger table in the same disposable SQLite file. The ledger answers exactly one question for the selector (`which item ids has this session already seen?`) and one for `PreCompact` (`which ids must survive?`).

**Tech Stack:** Node 24, TypeScript (no build step — Node 24 strips types natively), `node:sqlite`, `node:test`, `node:fs`. Zero runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-08-12-my-context-design.md` — §6.1 Active tier, §6.2 hook wiring, §6.6 ledger, §6.4 budgets and spill, §6.5 failure posture.

**Prerequisite:** Plan 1 (`docs/superpowers/plans/2026-08-12-my-context-foundation.md`) is complete and its suite is green. Every file this plan modifies was created there.

## Global Constraints

- **Zero runtime dependencies.** devDependencies stay limited to `typescript` and `@types/node`.
- **Node >= 24.0.0.** `node file.ts` runs TypeScript with no flag; every relative import carries an explicit `.ts` extension.
- **Only erasable TypeScript syntax** — no `enum`, no `namespace`, no parameter properties. `#private` fields and `private constructor` are erasable and permitted.
- **`node:sqlite` facts that are load-bearing:** booleans **cannot** be bound to `.run()` — convert to `1`/`0`; `.get()` returns `undefined` (never `null`) for a missing row and yields a **null-prototype** object, so never `assert.deepStrictEqual` a row against an object literal.
- **All stored paths are POSIX-normalized and repo-relative** (spec §5.4). Every path crosses `toPosix` / `normalizePosix` / `relPosix` / `matchesAnyGlob` from `src/core/paths.ts`. No backslash ever reaches a glob comparison.
- **Rendered Markdown and JSON snapshots use `\n` line endings** regardless of platform.
- **Hooks fail open:** exit 0, empty stdout, on any error. The latency ceiling is per hook kind, per Plan 1's amended reality: `PreToolUse`/JIT (this plan's `pre-tool-use.ts`, and `pre-compact.ts`) keep the 200 ms self-timeout and a p95 under 50 ms; `SessionStart` has no runtime self-timer (removed during Plan 1 hardening — `buildSessionStartOutput` is fully synchronous, so a timer set before calling it could only fire during the already-safe stdout drain) and its p95 ceiling is 500 ms, enforced by a performance test rather than a runtime cutoff.
- **`timeout` in `hooks/hooks.json` is in SECONDS**, not milliseconds.
- **`PreToolUse` hook output** is a single JSON object on stdout with a `hookSpecificOutput` member, supporting both `additionalContext` and `permissionDecision: 'allow' | 'deny' | 'ask'` with `permissionDecisionReason`.
- **The test script is `node --test "test/**/*.test.ts"` — the double quotes matter.** Unquoted, `sh` expands `**` as `*` and silently runs a subset with exit code 0.
- **TDD:** every task writes a failing test first, watches it fail, then implements.
- **Commit at the end of every task.**

---

## File Structure

| File | Responsibility | Status |
|---|---|---|
| `src/core/ledger.ts` | Session ledger table, `use_count`/`last_used` derivation, restore-snapshot read/write, transcript ID scan | **new** |
| `src/core/select.ts` | The selector. Gains the `jit` and `restored` tiers; signatures unchanged | modify |
| `src/core/store.ts` | Gains `has_scope` column, schema v2 migration, `activeScoped()` and `ids()` | modify |
| `src/hooks/io.ts` | Hook stdin parsing and `hookSpecificOutput` envelopes | **new** |
| `src/hooks/pre-tool-use.ts` | `PreToolUse` entry point: `.my_context/` write-deny, then JIT activation | **new** |
| `src/hooks/pre-compact.ts` | `PreCompact` entry point: write the restore snapshot | **new** |
| `src/hooks/session-start.ts` | Gains `compact` handling, snapshot read, ledger recording | modify |
| `hooks/hooks.json` | Registers `PreToolUse`, `PreCompact`, and the `compact` SessionStart matcher | modify |

**Why the ledger opens its own `DatabaseSync` connection** rather than extending `Store`: `Store` is a cache of the Markdown and `rebuild` empties it by layer on every session start. The ledger is *not* derivable from Markdown — it is session state — and must never be dropped by a rebuild. Keeping it in a separate class over the same file makes that distinction impossible to get wrong, and SQLite's WAL mode plus `busy_timeout` handles two connections in one process.

**Why `select()` still takes a plain `Item[]`:** it stays pure. The hooks decide *which* items to hand it (`activeScoped()` for the JIT path, `all()` for session start); the selector decides what is injected. That keeps 100% of the behavioural rules testable as data-in/data-out, exactly as spec §5.2 requires.

---

## Task 1: The session ledger

**Files:**
- Create: `src/core/ledger.ts`
- Test: `test/core/ledger.test.ts`

**Interfaces:**
- Consumes: `node:sqlite`
- Produces:
  - `type LedgerTier = 'pinned' | 'jit' | 'restored'`
  - `interface Usage { itemId: string; useCount: number; lastUsed: string | null }`
  - `class Ledger { static open(dbPath: string): Ledger; record(sessionId: string, itemId: string, tier: LedgerTier, at?: string): boolean; recordMany(sessionId: string, itemIds: string[], tier: LedgerTier, at?: string): string[]; seen(sessionId: string): string[]; entries(sessionId: string): { itemId: string; tier: LedgerTier; injectedAt: string }[]; usage(itemId: string): Usage; mostUsed(limit: number): Usage[]; close(): void }`

The table is keyed `(session_id, item_id, tier)` with `injected_at` as a value column. Putting `injected_at` in the key would defeat the entire purpose — a second injection at a different millisecond would be a different row, and once-per-session dedupe would never fire. `tier` **is** in the key deliberately: an item pinned at session start and later restored after a compact is two genuine events, and Task 9 depends on being able to record both.

- [ ] **Step 1: Write the failing test**

`test/core/ledger.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../../src/core/ledger.ts';

test('record returns true the first time and false on a repeat', () => {
  const ledger = Ledger.open(':memory:');
  assert.equal(ledger.record('s1', 'CONST-a', 'jit'), true);
  assert.equal(ledger.record('s1', 'CONST-a', 'jit'), false);
  ledger.close();
});

test('the same item in a different tier is a distinct event', () => {
  const ledger = Ledger.open(':memory:');
  assert.equal(ledger.record('s1', 'CONST-a', 'pinned'), true);
  assert.equal(ledger.record('s1', 'CONST-a', 'restored'), true);
  assert.equal(ledger.usage('CONST-a').useCount, 2);
  ledger.close();
});

test('seen is per session and deduplicated across tiers', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'pinned');
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.record('s1', 'CONST-b', 'jit');
  ledger.record('s2', 'CONST-c', 'jit');
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b']);
  assert.deepEqual(ledger.seen('s2'), ['CONST-c']);
  assert.deepEqual(ledger.seen('never-existed'), []);
  ledger.close();
});

test('recordMany returns only the ids it actually inserted', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit');
  const inserted = ledger.recordMany('s1', ['CONST-a', 'CONST-b', 'CONST-c'], 'jit');
  assert.deepEqual(inserted, ['CONST-b', 'CONST-c']);
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b', 'CONST-c']);
  ledger.close();
});

test('entries carry the tier and timestamp', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-13T10:00:00.000Z');
  const rows = ledger.entries('s1');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].itemId, 'CONST-a');
  assert.equal(rows[0].tier, 'jit');
  assert.equal(rows[0].injectedAt, '2026-08-13T10:00:00.000Z');
  ledger.close();
});

test('usage derives use_count and last_used across sessions', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-11T09:00:00.000Z');
  ledger.record('s2', 'CONST-a', 'jit', '2026-08-13T09:00:00.000Z');
  const usage = ledger.usage('CONST-a');
  assert.equal(usage.useCount, 2);
  assert.equal(usage.lastUsed, '2026-08-13T09:00:00.000Z');
  ledger.close();
});

test('usage of an unused item is zero, not undefined', () => {
  const ledger = Ledger.open(':memory:');
  assert.deepEqual(ledger.usage('CONST-never'), {
    itemId: 'CONST-never', useCount: 0, lastUsed: null,
  });
  ledger.close();
});

test('mostUsed ranks by use count then id', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-hot', 'jit');
  ledger.record('s2', 'CONST-hot', 'jit');
  ledger.record('s3', 'CONST-hot', 'jit');
  ledger.record('s1', 'CONST-warm', 'jit');
  ledger.record('s2', 'CONST-warm', 'jit');
  ledger.record('s1', 'CONST-cold', 'jit');
  assert.deepEqual(ledger.mostUsed(2).map((u) => u.itemId), ['CONST-hot', 'CONST-warm']);
  ledger.close();
});

test('the ledger survives being reopened on the same file', () => {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();
  // A second open on a fresh :memory: database must not throw on CREATE IF NOT EXISTS.
  const again = Ledger.open(':memory:');
  assert.deepEqual(again.seen('s1'), []);
  again.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/ledger.test.ts`
Expected: FAIL — `Cannot find module '../../src/core/ledger.ts'`

- [ ] **Step 3: Implement**

`src/core/ledger.ts`:

```typescript
import { DatabaseSync } from 'node:sqlite';

export type LedgerTier = 'pinned' | 'jit' | 'restored';

export interface LedgerEntry {
  itemId: string;
  tier: LedgerTier;
  injectedAt: string;
}

export interface Usage {
  itemId: string;
  useCount: number;
  lastUsed: string | null;
}

/**
 * `injected_at` is a value, not part of the key: a repeat injection a
 * millisecond later must collide, or once-per-session dedupe never fires.
 * `tier` is part of the key because pinned-then-restored is two real events.
 */
const LEDGER_SCHEMA = `
CREATE TABLE IF NOT EXISTS ledger (
  session_id  TEXT NOT NULL,
  item_id     TEXT NOT NULL,
  tier        TEXT NOT NULL,
  injected_at TEXT NOT NULL,
  PRIMARY KEY (session_id, item_id, tier)
);

CREATE INDEX IF NOT EXISTS idx_ledger_session ON ledger(session_id);
CREATE INDEX IF NOT EXISTS idx_ledger_item    ON ledger(item_id);
`;

export class Ledger {
  #db: DatabaseSync;

  private constructor(db: DatabaseSync) {
    this.#db = db;
  }

  static open(dbPath: string): Ledger {
    const db = new DatabaseSync(dbPath);
    db.exec('PRAGMA busy_timeout = 3000;');
    db.exec(LEDGER_SCHEMA);
    return new Ledger(db);
  }

  /** True when this is the first time the item was injected in this session and tier. */
  record(
    sessionId: string, itemId: string, tier: LedgerTier,
    at: string = new Date().toISOString(),
  ): boolean {
    const result = this.#db.prepare(`
      INSERT INTO ledger (session_id, item_id, tier, injected_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(session_id, item_id, tier) DO NOTHING
    `).run(sessionId, itemId, tier, at);
    return Number(result.changes) > 0;
  }

  /** Records a batch in one transaction. Returns only the ids newly inserted. */
  recordMany(
    sessionId: string, itemIds: string[], tier: LedgerTier,
    at: string = new Date().toISOString(),
  ): string[] {
    const inserted: string[] = [];
    this.#db.exec('BEGIN');
    try {
      for (const id of itemIds) {
        if (this.record(sessionId, id, tier, at)) inserted.push(id);
      }
      this.#db.exec('COMMIT');
    } catch (err) {
      this.#db.exec('ROLLBACK');
      throw err;
    }
    return inserted;
  }

  /** Every item id this session has already been shown, in any tier. */
  seen(sessionId: string): string[] {
    const rows = this.#db.prepare(
      'SELECT DISTINCT item_id FROM ledger WHERE session_id = ? ORDER BY item_id',
    ).all(sessionId) as { item_id: string }[];
    return rows.map((r) => r.item_id);
  }

  entries(sessionId: string): LedgerEntry[] {
    const rows = this.#db.prepare(
      'SELECT item_id, tier, injected_at FROM ledger WHERE session_id = ? ORDER BY injected_at, item_id',
    ).all(sessionId) as { item_id: string; tier: string; injected_at: string }[];
    return rows.map((r) => ({
      itemId: r.item_id, tier: r.tier as LedgerTier, injectedAt: r.injected_at,
    }));
  }

  /**
   * An aggregate query always returns exactly one row, even with no matches —
   * `count` is then 0 and `last` is NULL, which is why this needs no
   * `undefined` branch beyond defensive typing.
   */
  usage(itemId: string): Usage {
    const row = this.#db.prepare(
      'SELECT COUNT(*) AS n, MAX(injected_at) AS last FROM ledger WHERE item_id = ?',
    ).get(itemId) as { n: number; last: string | null } | undefined;
    return {
      itemId,
      useCount: row ? Number(row.n) : 0,
      lastUsed: row?.last ?? null,
    };
  }

  mostUsed(limit: number): Usage[] {
    const rows = this.#db.prepare(`
      SELECT item_id, COUNT(*) AS n, MAX(injected_at) AS last
      FROM ledger
      GROUP BY item_id
      ORDER BY n DESC, item_id ASC
      LIMIT ?
    `).all(limit) as { item_id: string; n: number; last: string | null }[];
    return rows.map((r) => ({
      itemId: r.item_id, useCount: Number(r.n), lastUsed: r.last ?? null,
    }));
  }

  close(): void {
    this.#db.close();
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/ledger.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/ledger.test.ts
git commit -m "feat: add the session ledger with once-per-session dedupe and usage derivation"
```

---

## Task 2: Restore snapshot and transcript scan

**Files:**
- Modify: `src/core/ledger.ts` (append — the class is unchanged)
- Test: `test/core/snapshot.test.ts`

**Interfaces:**
- Consumes: `Ledger` from Task 1; `node:fs`, `node:path`
- Produces:
  - `interface Snapshot { sessionId: string; capturedAt: string; itemIds: string[] }`
  - `sanitizeSessionId(sessionId: string): string`
  - `snapshotPath(root: string, sessionId: string): string`
  - `writeSnapshot(root: string, sessionId: string, itemIds: string[]): string` — absolute path written
  - `readSnapshot(root: string, sessionId: string): string[]` — `[]` on missing or corrupt
  - `scanTranscriptIds(transcriptPath: string | null | undefined, knownIds: Set<string>): string[]`

`root` here is the `.my_context` directory (what Plan 1's `resolveWorkspace` returns as `projectRoot`), so snapshots land at `.my_context/state/<session_id>.restore.json`.

Two safety properties this code must have, both tested:

- **The session id is sanitized before it becomes a filename.** It arrives from hook stdin; a value containing `../` would write outside the workspace.
- **The transcript scan only accepts ids that already exist in the index.** A raw regex over a transcript full of prose and code would otherwise resurrect anything shaped like `TODO-something`.

- [ ] **Step 1: Write the failing test**

`test/core/snapshot.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  readSnapshot, sanitizeSessionId, scanTranscriptIds, snapshotPath, writeSnapshot,
} from '../../src/core/ledger.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-snap-'));
}

test('a snapshot round-trips through the state directory', () => {
  const root = sandbox();
  writeSnapshot(root, 'abc-123', ['CONST-b', 'CONST-a']);
  assert.deepEqual(readSnapshot(root, 'abc-123'), ['CONST-a', 'CONST-b']);
  rmSync(root, { recursive: true, force: true });
});

test('the snapshot lands under state/ with a .restore.json suffix', () => {
  const root = sandbox();
  const written = writeSnapshot(root, 'abc-123', ['CONST-a']);
  assert.equal(written, path.join(root, 'state', 'abc-123.restore.json'));
  assert.equal(snapshotPath(root, 'abc-123'), written);
  rmSync(root, { recursive: true, force: true });
});

test('ids are deduplicated and sorted for a stable diff', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-b', 'CONST-a', 'CONST-b']);
  assert.deepEqual(readSnapshot(root, 's'), ['CONST-a', 'CONST-b']);
  rmSync(root, { recursive: true, force: true });
});

test('the state directory ignores itself in git', () => {
  const root = sandbox();
  writeSnapshot(root, 's', []);
  assert.equal(readFileSync(path.join(root, 'state', '.gitignore'), 'utf8'), '*\n');
  rmSync(root, { recursive: true, force: true });
});

test('a traversal-shaped session id cannot escape the state directory', () => {
  const root = sandbox();
  const written = writeSnapshot(root, '../../etc/evil', ['CONST-a']);
  assert.equal(path.dirname(written), path.join(root, 'state'));
  assert.equal(existsSync(written), true);
  rmSync(root, { recursive: true, force: true });
});

test('sanitizeSessionId keeps safe characters and replaces the rest', () => {
  assert.equal(sanitizeSessionId('a1B2-c3_d4.e5'), 'a1B2-c3_d4.e5');
  assert.equal(sanitizeSessionId('a/b\\c:d'), 'a_b_c_d');
  assert.equal(sanitizeSessionId(''), 'unknown');
});

test('a missing snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  assert.deepEqual(readSnapshot(root, 'never-written'), []);
  rmSync(root, { recursive: true, force: true });
});

test('a corrupt snapshot reads as empty rather than throwing', () => {
  const root = sandbox();
  writeSnapshot(root, 's', ['CONST-a']);
  writeFileSync(snapshotPath(root, 's'), '{ not json');
  assert.deepEqual(readSnapshot(root, 's'), []);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan returns only ids that exist in the index', () => {
  const root = sandbox();
  const transcript = path.join(root, 'transcript.jsonl');
  writeFileSync(transcript, [
    '{"role":"user","content":"why is CONST-pg-pool-cap set to 20?"}',
    '{"role":"assistant","content":"see ADR-sqlite-jsonb and NOTREAL-made-up"}',
    '{"role":"assistant","content":"CONST-pg-pool-cap again"}',
  ].join('\n'));

  const known = new Set(['CONST-pg-pool-cap', 'ADR-sqlite-jsonb', 'LESSON-unmentioned']);
  assert.deepEqual(scanTranscriptIds(transcript, known),
    ['ADR-sqlite-jsonb', 'CONST-pg-pool-cap']);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan is safe on a missing path, null, and a directory', () => {
  const root = sandbox();
  const known = new Set(['CONST-a']);
  assert.deepEqual(scanTranscriptIds(null, known), []);
  assert.deepEqual(scanTranscriptIds(undefined, known), []);
  assert.deepEqual(scanTranscriptIds(path.join(root, 'nope.jsonl'), known), []);
  assert.deepEqual(scanTranscriptIds(root, known), []);
  rmSync(root, { recursive: true, force: true });
});

test('the transcript scan reads the tail of an oversized transcript', () => {
  const root = sandbox();
  const transcript = path.join(root, 'big.jsonl');
  const filler = 'x'.repeat(9 * 1024 * 1024);
  writeFileSync(transcript, `CONST-buried-at-the-start\n${filler}\nCONST-near-the-end\n`);
  const known = new Set(['CONST-buried-at-the-start', 'CONST-near-the-end']);
  assert.deepEqual(scanTranscriptIds(transcript, known), ['CONST-near-the-end']);
  rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/snapshot.test.ts`
Expected: FAIL — `writeSnapshot is not a function` / export not found

- [ ] **Step 3: Implement**

Add to the **top** of `src/core/ledger.ts`, alongside the existing import:

```typescript
import {
  closeSync, mkdirSync, openSync, readFileSync, readSync,
  renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import path from 'node:path';
```

Then append to `src/core/ledger.ts`:

```typescript
export interface Snapshot {
  sessionId: string;
  capturedAt: string;
  itemIds: string[];
}

/** Session ids arrive from hook stdin and become filenames. Never trust them. */
export function sanitizeSessionId(sessionId: string): string {
  const safe = sessionId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_').slice(0, 128);
  return safe === '' ? 'unknown' : safe;
}

/** `root` is the `.my_context` directory. */
export function snapshotPath(root: string, sessionId: string): string {
  return path.join(root, 'state', `${sanitizeSessionId(sessionId)}.restore.json`);
}

/** Atomic: temp file then rename, so a crash mid-write never leaves a truncated snapshot. */
export function writeSnapshot(root: string, sessionId: string, itemIds: string[]): string {
  const target = snapshotPath(root, sessionId);
  const dir = path.dirname(target);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');

  const snapshot: Snapshot = {
    sessionId,
    capturedAt: new Date().toISOString(),
    itemIds: [...new Set(itemIds)].sort(),
  };

  const tmp = `${target}.tmp-${process.pid}`;
  try {
    writeFileSync(tmp, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function readSnapshot(root: string, sessionId: string): string[] {
  try {
    const parsed = JSON.parse(readFileSync(snapshotPath(root, sessionId), 'utf8')) as
      Partial<Snapshot>;
    if (!Array.isArray(parsed.itemIds)) return [];
    return parsed.itemIds.filter((v): v is string => typeof v === 'string');
  } catch {
    return [];
  }
}

const MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;

/**
 * Uppercase category prefix, hyphen, lowercase slug body — the shape guaranteed
 * by `makeId`. Matches are still filtered against the real index, because prose
 * and code contain plenty of tokens with this shape.
 */
const ID_PATTERN = /\b[A-Z][A-Z0-9]{1,11}-[a-z0-9][a-z0-9-]*\b/g;

function readTail(file: string): string {
  const { size } = statSync(file);
  if (size <= MAX_TRANSCRIPT_BYTES) return readFileSync(file, 'utf8');
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(MAX_TRANSCRIPT_BYTES);
    readSync(fd, buffer, 0, MAX_TRANSCRIPT_BYTES, size - MAX_TRANSCRIPT_BYTES);
    return buffer.toString('utf8');
  } finally {
    closeSync(fd);
  }
}

/** Item ids mentioned anywhere in the transcript that also exist in the index. */
export function scanTranscriptIds(
  transcriptPath: string | null | undefined, knownIds: Set<string>,
): string[] {
  if (!transcriptPath || knownIds.size === 0) return [];
  let text: string;
  try {
    if (!statSync(transcriptPath).isFile()) return [];
    text = readTail(transcriptPath);
  } catch {
    return [];
  }

  const found = new Set<string>();
  for (const match of text.matchAll(ID_PATTERN)) {
    if (knownIds.has(match[0])) found.add(match[0]);
  }
  return [...found].sort();
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/core/snapshot.test.ts && node --test test/core/ledger.test.ts && npx tsc --noEmit`
Expected: PASS — Task 1's tests still pass, unchanged

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/snapshot.test.ts
git commit -m "feat: add atomic restore snapshots and index-filtered transcript scanning"
```

---

## Task 3: The JIT tier in the selector

**Files:**
- Modify: `src/core/select.ts` (add imports, rewrite the body of `select`)
- Test: `test/core/select-jit.test.ts`

**Interfaces:**
- Consumes: `SelectContext`, `SelectionEntry`, `Selection`, `isEligible`, `mergeLayers`, `fitToBudget` from Plan 1's `select.ts`; `matchesAnyGlob`, `normalizePosix` from `paths.ts`
- Produces: no new exports. `select(items, ctx, config)` keeps its exact Plan 1 signature and now honours `ctx.event === 'tool'` with `ctx.path`, emitting `SelectionEntry` values whose `tier` is `'jit'`.

Three behaviours change inside `select`, each with a reason:

1. **Tiers are gated on the event.** Plan 1 always computed `pinned`; a `tool` event must not re-inject the pinned set on every file read.
2. **`seen` filters candidates *before* the budget is applied**, not after. Plan 1 filtered afterwards, which let an already-injected item consume JIT budget and silently spill a fresh one.
3. **The bounded index is built only for session-level events.** The index is defined as "every session" (spec §6.1), not every tool call — and on a 5,000-item corpus building it is the single most expensive thing `select` does, which Task 10 measures.

- [ ] **Step 1: Write the failing test**

`test/core/select-jit.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('a scope match on a tool event injects in the jit tier', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-db']);
  assert.equal(sel.full[0].tier, 'jit');
});

test('a non-matching path injects nothing', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/api/handler.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('an item with no scope is inert — it never JIT-activates', () => {
  const sel = select(
    [item({ id: 'CONST-noscope', scope: [] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a tool event never injects the pinned set', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true, scope: [] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a tool event emits no index — that cost belongs to session start', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' }), item({ id: 'CONST-b', scope: ['src/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.index, {
    normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {},
  });
});

test('a session start still emits the index and the pinned tier', () => {
  const sel = select(
    [item({ id: 'CONST-pinned', always: true }), item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'session-start' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-pinned']);
  assert.equal(sel.index.counts.lesson, 1);
});

test('ledger-seen items are not re-injected by JIT', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-db'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a seen item does not consume JIT budget and spill a fresh one', () => {
  const big = 'x'.repeat(1600); // ~400 tokens each
  const items = [
    item({ id: 'CONST-seen', scope: ['src/db/**'], body: big }),
    item({ id: 'CONST-fresh', scope: ['src/db/**'], body: big }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts', seen: ['CONST-seen'] }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-fresh']);
  assert.deepEqual(sel.spilled, []);
});

test('over the JIT budget, hard severity wins and the rest are logged as spilled', () => {
  const big = 'x'.repeat(1600);
  const items = [
    item({ id: 'CONST-soft', scope: ['src/**'], severity: 'soft', body: big }),
    item({ id: 'CONST-hard', scope: ['src/**'], severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { jit: 420 } });
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts' }, cfg);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.equal(sel.spilled[0].tier, 'jit');
});

test('rationale categories never JIT-activate however well they match', () => {
  const sel = select(
    [item({ id: 'LESSON-db', type: 'lesson', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('draft and superseded items never JIT-activate', () => {
  const items = [
    item({ id: 'CONST-draft', scope: ['src/**'], status: 'draft' }),
    item({ id: 'CONST-old', scope: ['src/**'], status: 'superseded' }),
  ];
  const sel = select(items, { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.deepEqual(sel.full, []);
});

test('a disabled category never JIT-activates', () => {
  const cfg = resolveConfig({ categories: { constraint: { enabled: false } } });
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src/db/writer.ts' },
    cfg,
  );
  assert.deepEqual(sel.full, []);
});

test('a backslash path is normalized before the glob is applied', () => {
  const sel = select(
    [item({ id: 'CONST-db', scope: ['src/db/**'] })],
    { event: 'tool', path: 'src\\db\\writer.ts' },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-db']);
});

test('a tool event with no path selects nothing', () => {
  const items = [item({ id: 'CONST-db', scope: ['src/db/**'] })];
  assert.deepEqual(select(items, { event: 'tool' }, CONFIG).full, []);
  assert.deepEqual(select(items, { event: 'tool', path: null }, CONFIG).full, []);
  assert.deepEqual(select(items, { event: 'tool', path: '' }, CONFIG).full, []);
});

test('project items shadow global items on the JIT path too', () => {
  const sel = select([
    item({ id: 'CONST-db', title: 'global', layer: 'global', scope: ['src/db/**'] }),
    item({ id: 'CONST-db', title: 'project', layer: 'project', scope: ['src/db/**'] }),
  ], { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.equal(sel.full.length, 1);
  assert.equal(sel.full[0].item.title, 'project');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/select-jit.test.ts`
Expected: FAIL — the tool event returns the pinned tier and an index; `sel.full` is empty where a JIT item is expected

- [ ] **Step 3: Implement**

> **Reconciliation note:** Plan 1's hardening already rewrote `select()` around
> `eligible` → `pinnedCandidates` → `fitToBudget`, filtering `seen` *before*
> budgeting, and `buildIndex` now returns `{ summary, spilled }` (index-budget
> spill is real and must be preserved) rather than a bare `IndexSummary`. The
> rewrite below is a **delta against that current function**, not a
> from-scratch replacement: it generalizes "pinned candidates" into
> "injectable candidates, gated by event" and adds the `jit` block. The
> seen-before-budgeting order, the `mergeLayers`-first step, and the index
> budget enforced inside `buildIndex` are untouched — do not revert them.

Add to the imports at the top of `src/core/select.ts` (alongside the existing `Config`/`render-item.ts`/`Item` imports):

```typescript
import { matchesAnyGlob, normalizePosix } from './paths.ts';
```

Add this helper next to `isNormative`:

```typescript
/**
 * Scope is inert by default (spec §3.2): an item with no globs is indexed and
 * searchable but never JIT-injected. Defaulting to global would refill the
 * context window as the corpus grows — the exact failure this design prevents.
 */
function matchesScope(item: Item, target: string): boolean {
  return item.scope.length > 0 && matchesAnyGlob(target, item.scope);
}

/** IndexSummary's full current shape (Plan 1 added retired/truncated/ineligible). */
const EMPTY_INDEX: IndexSummary = {
  normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {},
};
```

Replace the whole `select` function with:

```typescript
export function select(items: Item[], ctx: SelectContext, config: Config): Selection {
  const merged = mergeLayers(items);
  const eligible = merged.filter((i) => isEligible(i, config));
  const injectable = eligible.filter((i) => isNormative(i, config));

  // Seen items are removed before budgeting, not after — this is Plan 1's
  // hardening and must not be reverted: an already-injected item must not
  // consume budget and spill a fresh one in its place.
  const seen = new Set(ctx.seen ?? []);
  const fresh = injectable.filter((i) => !seen.has(i.id));

  const entries: SelectionEntry[] = [];
  const spilled: Spill[] = [];

  if (ctx.event === 'session-start' || ctx.event === 'compact' || ctx.event === 'manual') {
    const result = fitToBudget(fresh.filter((i) => i.always), config.budgets.pinned, 'pinned');
    entries.push(...result.entries);
    spilled.push(...result.spilled);
  }

  if (ctx.event === 'tool') {
    const target = ctx.path ? normalizePosix(ctx.path) : '';
    if (target !== '') {
      const result = fitToBudget(
        fresh.filter((i) => matchesScope(i, target)), config.budgets.jit, 'jit',
      );
      entries.push(...result.entries);
      spilled.push(...result.spilled);
    }
  }

  // The bounded index — and its own budget accounting inside buildIndex — is
  // a per-session cost, not a per-tool-call cost.
  if (ctx.event === 'tool') {
    return { full: entries, index: EMPTY_INDEX, spilled };
  }
  const { summary: index, spilled: indexSpilled } = buildIndex(eligible, merged, config);
  return { full: entries, index, spilled: [...spilled, ...indexSpilled] };
}
```

- [ ] **Step 4: Run the selector suites and typecheck**

Run: `node --test test/core/select.test.ts test/core/select-layers.test.ts test/core/select-jit.test.ts && npx tsc --noEmit`
Expected: PASS — Plan 1's two selector suites are unchanged and must stay green

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select-jit.test.ts
git commit -m "feat: populate the JIT tier by scope match on tool events"
```

---

## Task 4: The restored tier in the selector

**Files:**
- Modify: `src/core/select.ts` (extend the body of `select`)
- Test: `test/core/select-restore.test.ts`

**Interfaces:**
- Consumes: everything from Task 3
- Produces: no new exports. `select(items, ctx, config)` now honours `ctx.restore` when `ctx.event === 'compact'`, emitting entries with `tier: 'restored'`.

Ordering note: spec §6.4 orders spill by `(severity, last_used desc)`. `last_used` lives in the ledger, and the selector is pure with no database access, so it orders by `(severity, layer, id)` via Plan 1's `byPriority`. Feeding `last_used` in through `SelectContext` would change the Plan 1 signature; decay-aware ordering therefore belongs to the decay reporting work in Plan 4.

- [ ] **Step 1: Write the failing test**

`test/core/select-restore.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('a compact event injects the snapshot ids in full', () => {
  const sel = select([
    item({ id: 'CONST-restored' }),
    item({ id: 'CONST-untouched' }),
  ], { event: 'compact', restore: ['CONST-restored'] }, CONFIG);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-restored']);
  assert.equal(sel.full[0].tier, 'restored');
});

test('a compact event injects the pinned tier as well, without duplicating', () => {
  const sel = select([
    item({ id: 'CONST-pinned', always: true }),
    item({ id: 'CONST-restored' }),
  ], { event: 'compact', restore: ['CONST-pinned', 'CONST-restored'] }, CONFIG);

  assert.deepEqual(sel.full.map((e) => e.item.id).sort(), ['CONST-pinned', 'CONST-restored']);
  assert.equal(sel.full.filter((e) => e.item.id === 'CONST-pinned').length, 1);
  assert.equal(sel.full.find((e) => e.item.id === 'CONST-pinned')?.tier, 'pinned');
});

test('a compact event still emits the index header', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'compact', restore: [] },
    CONFIG,
  );
  assert.equal(sel.index.counts.lesson, 1);
});

test('restore ids that no longer resolve are dropped silently', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-deleted-since', 'CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-a']);
});

test('a superseded item is not restored — supersession is the pruning mechanism', () => {
  const sel = select(
    [item({ id: 'CONST-old', status: 'superseded' })],
    { event: 'compact', restore: ['CONST-old'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('a rationale item is never restored in full', () => {
  const sel = select(
    [item({ id: 'LESSON-a', type: 'lesson' })],
    { event: 'compact', restore: ['LESSON-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('over the restored budget, hard severity wins and the rest spill', () => {
  const big = 'x'.repeat(4000); // ~1000 tokens each
  const items = [
    item({ id: 'CONST-soft', severity: 'soft', body: big }),
    item({ id: 'CONST-hard', severity: 'hard', body: big }),
  ];
  const cfg = resolveConfig({ budgets: { restored: 1200 } });
  const sel = select(items, {
    event: 'compact', restore: ['CONST-soft', 'CONST-hard'],
  }, cfg);

  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-hard']);
  assert.deepEqual(sel.spilled.map((s) => s.id), ['CONST-soft']);
  assert.equal(sel.spilled[0].tier, 'restored');
});

test('restore ids are ignored on a normal session start', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'session-start', restore: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('restore ids are ignored on a tool event', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'tool', path: 'src/db/writer.ts', restore: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});

test('seen ids still suppress a restore', () => {
  const sel = select(
    [item({ id: 'CONST-a' })],
    { event: 'compact', restore: ['CONST-a'], seen: ['CONST-a'] },
    CONFIG,
  );
  assert.deepEqual(sel.full, []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/select-restore.test.ts`
Expected: FAIL — `sel.full` is empty wherever a restored entry is expected

- [ ] **Step 3: Implement**

In `src/core/select.ts`, insert this block into `select` **between** the pinned block and the tool block (this is the only change Task 4 makes — the pinned block, the seen-before-budgeting filter, the tool/jit block, and the index gating from Task 3 are untouched):

```typescript
  if (ctx.event === 'compact') {
    const restoreIds = new Set(ctx.restore ?? []);
    const alreadyChosen = new Set(entries.map((e) => e.item.id));
    const result = fitToBudget(
      fresh.filter((i) => restoreIds.has(i.id) && !alreadyChosen.has(i.id)),
      config.budgets.restored,
      'restored',
    );
    entries.push(...result.entries);
    spilled.push(...result.spilled);
  }
```

**Do not restate the whole function.** The block above is the only change: insert it
after the pinned-tier block and before the JIT block. Task 3 already established the
rest of `select()`, and a second full copy in the plan is what let Plan 1 ship a fix
applied to only one of two copies. If you need to see the assembled function, read
`src/core/select.ts` after Task 3 lands — the source is the reference, not this file.

- [ ] **Step 4: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — all four selector suites green

- [ ] **Step 5: Commit**

```bash
git add src/core/select.ts test/core/select-restore.test.ts
git commit -m "feat: populate the restored tier from the compact snapshot"
```

---

## Task 5: A scoped-item query in the store

**Files:**
- Modify: `src/core/store.ts` (schema, `SCHEMA_VERSION`, `open`, `upsert`; add `activeScoped` and `ids`)
- Test: `test/core/store-scoped.test.ts`

**Interfaces:**
- Consumes: `Item`, `Layer` from `types.ts`
- Produces, added to the existing `Store` class:
  - `activeScoped(): Item[]` — active items that declare at least one scope glob, ordered by id
  - `ids(): string[]` — every indexed item id, ordered

**Why this exists:** the JIT hook runs on every `Read`, `Edit` and `Write`, under a 50 ms p95 ceiling, and must not rebuild. `store.all()` on a 5,000-item corpus deserializes the whole corpus to find the handful of items that declare a scope. An indexed `has_scope` column turns that into a scan over the only rows that can possibly match. `ids()` exists for the `PreCompact` transcript scan, which needs the id set without any item bodies.

`has_scope` is stored as `1`/`0`, never as a boolean — `node:sqlite` throws `Provided value cannot be bound to SQLite parameter` on a bound boolean.

**Migration:** `SCHEMA_VERSION` goes to 2. The index is disposable (spec §5.2), so the migration drops and recreates `items` and lets the next `rebuild` refill it from Markdown. It must **not** touch `ledger` — that table is session state and is not derivable from Markdown.

- [ ] **Step 1: Write the failing test**

`test/core/store-scoped.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';

function makeItem(id: string, over: Partial<Item> = {}): Item {
  const base = parseItem(
    `---\nid: ${id}\ntype: constraint\ntitle: ${id} title\nstatus: active\n---\n\n# ${id} title\n`,
    `items/constraint/${id}.md`,
    'project',
  );
  return { ...base, ...over };
}

test('activeScoped returns only active items that declare a scope', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-scoped', { scope: ['src/db/**'] }));
  store.upsert(makeItem('CONST-inert', { scope: [] }));
  store.upsert(makeItem('CONST-draft', { scope: ['src/**'], status: 'draft' }));
  store.upsert(makeItem('CONST-old', { scope: ['src/**'], status: 'superseded' }));

  assert.deepEqual(store.activeScoped().map((i) => i.id), ['CONST-scoped']);
  store.close();
});

test('activeScoped round-trips the full item, not a projection', () => {
  const store = Store.open(':memory:');
  const item = makeItem('CONST-scoped', { scope: ['src/db/**'] });
  store.upsert(item);
  assert.deepEqual(store.activeScoped()[0], item);
  store.close();
});

test('re-upserting an item that lost its scope removes it from activeScoped', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-a', { scope: ['src/**'] }));
  assert.equal(store.activeScoped().length, 1);
  store.upsert(makeItem('CONST-a', { scope: [] }));
  assert.equal(store.activeScoped().length, 0);
  store.close();
});

test('ids lists every item cheaply, in order', () => {
  const store = Store.open(':memory:');
  store.upsert(makeItem('CONST-b'));
  store.upsert(makeItem('CONST-a', { status: 'draft' }));
  assert.deepEqual(store.ids(), ['CONST-a', 'CONST-b']);
  store.close();
});

test('opening a stale schema rebuilds items and preserves the ledger', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-migrate-'));
  const dbPath = path.join(dir, 'index.db');

  const store = Store.open(dbPath);
  store.upsert(makeItem('CONST-a', { scope: ['src/**'] }));
  store.close();

  const ledger = Ledger.open(dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();

  // Pretend the file was written by an older release.
  const raw = new DatabaseSync(dbPath);
  raw.prepare('UPDATE schema_version SET version = ?').run(1);
  raw.close();

  const reopened = Store.open(dbPath);
  assert.deepEqual(reopened.all(), [], 'items are dropped and await a rebuild');
  reopened.close();

  const ledgerAgain = Ledger.open(dbPath);
  assert.deepEqual(ledgerAgain.seen('s1'), ['CONST-a'], 'session state must survive migration');
  ledgerAgain.close();

  rmSync(dir, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/store-scoped.test.ts`
Expected: FAIL — `store.activeScoped is not a function`

- [ ] **Step 3: Implement**

> **Reconciliation note:** Plan 1 hardened `Store.open` well beyond what this
> task originally assumed: `tryOpen` (schema init/version-check) is wrapped by
> a `Store.open` that recovers from a genuinely corrupt file by deleting it
> and retrying once, throws a dedicated `NewerSchemaError` without ever
> touching data when the on-disk schema is newer than this code understands,
> and re-throws lock/busy errors unchanged. None of that is Plan 2's to
> redo — the delta below only touches `SCHEMA_VERSION`, the `items` table
> definition, and the one branch inside `tryOpen` that handles an *older*
> on-disk schema. Everything else in `tryOpen` and all of `Store.open`,
> `transaction`, and `close` stays exactly as built.
>
> One correction to the original plan's assumption: `CREATE TABLE IF NOT
> EXISTS items (...)` is a no-op when `items` already exists with the old
> (no `has_scope`) column set — SQLite does not add columns that way. Simply
> deleting rows (`DELETE FROM items`, what the pre-Plan-2 code already did
> for a stale schema) would leave the column missing and break every
> `upsert`. The older-schema branch must therefore drop and recreate `items`,
> not merely empty it. `ledger` — opened over the same file by a separate
> connection — is untouched by any of this, in both the old and new code:
> it is session state, not derivable from Markdown.

In `src/core/store.ts`, change the version constant and the `items` table:

```typescript
const SCHEMA_VERSION = 2;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL);

CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  type        TEXT NOT NULL,
  title       TEXT NOT NULL,
  status      TEXT NOT NULL,
  always      INTEGER NOT NULL,
  has_scope   INTEGER NOT NULL DEFAULT 0,
  layer       TEXT NOT NULL,
  file_path   TEXT NOT NULL,
  updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  data        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_items_type   ON items(type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_layer  ON items(layer);
CREATE INDEX IF NOT EXISTS idx_items_scoped ON items(status, has_scope);
`;
```

Inside `tryOpen`, change only the older-schema branch — the fresh-database branch, the `NewerSchemaError` branch, and everything around this block (the try/catch, the PRAGMAs, `Store.open`'s corruption recovery) are unchanged:

```typescript
    } else {
      // Existing database: enforce version compatibility
      if (row.version < SCHEMA_VERSION) {
        // Older schema. The index is a disposable cache of the Markdown, so
        // migration is discard-and-refill — but a column-adding change like
        // `has_scope` needs the table actually recreated: `CREATE TABLE IF
        // NOT EXISTS` above is a no-op once `items` already exists with the
        // old columns, so a plain `DELETE FROM items` would leave the new
        // column missing. `ledger`, opened over the same file by a separate
        // connection, is untouched: it is session state and cannot be
        // recovered from files.
        db.exec('DROP TABLE IF EXISTS items;');
        db.exec(SCHEMA);
        db.prepare('UPDATE schema_version SET version = ?').run(SCHEMA_VERSION);
      } else if (row.version > SCHEMA_VERSION) {
        // Newer schema: cannot downgrade, must upgrade my_context
        throw new NewerSchemaError(
          `my_context: database schema version ${row.version} is newer than this code understands (${SCHEMA_VERSION}). ` +
          'Upgrade my_context or delete the index file to have it rebuilt.'
        );
      }
    }
```

Replace `upsert` so it writes the new column:

```typescript
  upsert(item: Item): void {
    this.#db.prepare(`
      INSERT INTO items (id, type, title, status, always, has_scope, layer, file_path, data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type, title = excluded.title, status = excluded.status,
        always = excluded.always, has_scope = excluded.has_scope, layer = excluded.layer,
        file_path = excluded.file_path, data = excluded.data,
        updated_at = CURRENT_TIMESTAMP
    `).run(
      item.id, item.type, item.title, item.status,
      item.always ? 1 : 0, item.scope.length > 0 ? 1 : 0,
      item.layer, item.filePath, JSON.stringify(item),
    );
  }
```

Add the two new methods next to `all()`:

```typescript
  /**
   * Active items that declare at least one scope glob — the only rows the JIT
   * hook can possibly inject. Deserializing the whole corpus on every Read
   * would not fit the 50ms budget.
   */
  activeScoped(): Item[] {
    const rows = this.#db.prepare(
      "SELECT data FROM items WHERE status = 'active' AND has_scope = 1 ORDER BY id",
    ).all() as { data: string }[];
    return rows.map((r) => JSON.parse(r.data) as Item);
  }

  /** Every indexed id, without deserializing any bodies. */
  ids(): string[] {
    const rows = this.#db.prepare('SELECT id FROM items ORDER BY id').all() as { id: string }[];
    return rows.map((r) => r.id);
  }
```

- [ ] **Step 4: Run the store suites and typecheck**

Run: `node --test test/core/store.test.ts test/core/store-scoped.test.ts test/core/rebuild.test.ts && npx tsc --noEmit`
Expected: PASS — Plan 1's store and rebuild suites are unchanged and must stay green

- [ ] **Step 5: Commit**

```bash
git add src/core/store.ts test/core/store-scoped.test.ts
git commit -m "feat: add an indexed scoped-item query and a schema v2 migration"
```

---

## Task 6: PreToolUse plumbing and the `.my_context/` write-deny

**Files:**
- Create: `src/hooks/io.ts`, `src/hooks/pre-tool-use.ts`
- Modify: `hooks/hooks.json`
- Test: `test/hooks/pre-tool-use-deny.test.ts`

**Interfaces:**
- Consumes: `toPosix`, `normalizePosix`, `matchesAnyGlob` from `core/paths.ts`
- Produces:
  - from `io.ts`: `interface HookInput { session_id?: string; transcript_path?: string; cwd?: string; hook_event_name?: string; source?: string; tool_name?: string; tool_input?: Record<string, unknown> }`, `readStdin(): string`, `parseHookInput(raw: string): HookInput`, `preToolUseContext(text: string): string`, `preToolUseDeny(reason: string): string`
  - from `pre-tool-use.ts`: `extractFilePath(input: HookInput): string | null`, `managedSplit(absPosix: string): { root: string; rel: string } | null`, `denyReason(absNative: string): string | null`, `runPreToolUse(raw: string, fallbackCwd: string): string`

This is the **sole** exception to fail-open (spec §6.5): a deliberate `permissionDecision: 'deny'`. Everything else in this hook still returns an empty string on any error.

The reason string is the highest-leverage documentation channel in the system (spec §9) — it reaches the model at the exact moment it is wrong. It must therefore name a command the model can actually run. Plan 1 ships no `mycontext` binary, so the reasons spell out `node src/cli/index.ts …`; Plan 3 may shorten them once a bin entry exists.

- [ ] **Step 1: Write the failing test**

`test/hooks/pre-tool-use-deny.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { denyReason, extractFilePath, runPreToolUse } from '../../src/hooks/pre-tool-use.ts';

const CWD = path.resolve('/repo');

function hookInput(toolName: string, filePath: string): string {
  return JSON.stringify({
    session_id: 's1',
    hook_event_name: 'PreToolUse',
    cwd: CWD,
    tool_name: toolName,
    tool_input: { file_path: filePath },
  });
}

function decision(raw: string): Record<string, unknown> {
  const parsed = JSON.parse(raw) as { hookSpecificOutput: Record<string, unknown> };
  return parsed.hookSpecificOutput;
}

test('writing an item file is denied and names the add command', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  const d = decision(out);
  assert.equal(d.hookEventName, 'PreToolUse');
  assert.equal(d.permissionDecision, 'deny');
  assert.match(String(d.permissionDecisionReason), /src\/cli\/index\.ts add/);
});

test('editing an item file is denied too', () => {
  const out = runPreToolUse(
    hookInput('Edit', path.join(CWD, '.my_context/items/adr/ADR-a.md')), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('writing the index database is denied and names the rebuild command', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/.index.db')), CWD);
  assert.match(String(decision(out).permissionDecisionReason), /src\/cli\/index\.ts rebuild/);
});

test('writing anything else under .my_context is denied with the general reason', () => {
  const out = runPreToolUse(hookInput('Write', path.join(CWD, '.my_context/config.json')), CWD);
  const reason = String(decision(out).permissionDecisionReason);
  assert.match(reason, /config\.json/);
  assert.match(reason, /managed by my_context/i);
});

test('the global layer is protected as well', () => {
  const out = runPreToolUse(
    hookInput('Write', path.join(path.resolve('/home/u'), '.my-context/items/rule/RULE-a.md')),
    CWD,
  );
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('a relative path is resolved against the hook cwd before the check', () => {
  const out = runPreToolUse(hookInput('Write', '.my_context/items/rule/RULE-a.md'), CWD);
  assert.equal(decision(out).permissionDecision, 'deny');
});

test('a native Windows path is normalized before the check', () => {
  assert.notEqual(denyReason('C:\\repo\\.my_context\\items\\rule\\RULE-a.md'), null);
});

test('Read is never denied — reading an item is legitimate', () => {
  const out = runPreToolUse(
    hookInput('Read', path.join(CWD, '.my_context/items/constraint/CONST-a.md')), CWD);
  assert.equal(out, '');
});

test('writes outside .my_context are not denied', () => {
  assert.equal(runPreToolUse(hookInput('Write', path.join(CWD, 'src/db/writer.ts')), CWD), '');
  assert.equal(denyReason(path.join(CWD, 'src/my_context_notes.md')), null);
});

test('a directory merely named my_context is not protected', () => {
  assert.equal(denyReason(path.join(CWD, 'my_context/items/x.md')), null);
});

test('extractFilePath accepts the three tool input shapes and rejects the rest', () => {
  assert.equal(extractFilePath({ tool_input: { file_path: 'a.ts' } }), 'a.ts');
  assert.equal(extractFilePath({ tool_input: { path: 'b.ts' } }), 'b.ts');
  assert.equal(extractFilePath({ tool_input: { notebook_path: 'c.ipynb' } }), 'c.ipynb');
  assert.equal(extractFilePath({ tool_input: { file_path: '   ' } }), null);
  assert.equal(extractFilePath({ tool_input: {} }), null);
  assert.equal(extractFilePath({}), null);
});

test('malformed or empty stdin produces empty output, never a throw', () => {
  assert.equal(runPreToolUse('', CWD), '');
  assert.equal(runPreToolUse('{ not json', CWD), '');
  assert.equal(runPreToolUse('[]', CWD), '');
  assert.equal(runPreToolUse('null', CWD), '');
  assert.equal(runPreToolUse(JSON.stringify({ tool_name: 'Write' }), CWD), '');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/pre-tool-use-deny.test.ts`
Expected: FAIL — `Cannot find module '../../src/hooks/pre-tool-use.ts'`

- [ ] **Step 3: Implement the shared hook I/O**

`src/hooks/io.ts`:

```typescript
import { readFileSync } from 'node:fs';

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  /** SessionStart only: startup | clear | resume | compact. */
  source?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

/** Reads fd 0 to EOF. Returns '' when there is no stdin (interactive runs). */
export function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export function parseHookInput(raw: string): HookInput {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value as HookInput;
  } catch {
    return {};
  }
}

export function preToolUseContext(text: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text },
  });
}

export function preToolUseDeny(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}
```

- [ ] **Step 4: Implement the hook**

`src/hooks/pre-tool-use.ts`:

```typescript
import path from 'node:path';
import { isMainEntry, matchesAnyGlob, normalizePosix, toPosix } from '../core/paths.ts';
import { parseHookInput, preToolUseDeny, readStdin, type HookInput } from './io.ts';

const FILE_PATH_KEYS = ['file_path', 'path', 'notebook_path'];

export function extractFilePath(input: HookInput): string | null {
  const toolInput = input.tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) return null;
  for (const key of FILE_PATH_KEYS) {
    const value = (toolInput as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/** Matches a whole path segment, so `src/my_context_notes.md` is not protected. */
const MANAGED_SEGMENT = /(^|\/)(\.my_context|\.my-context)(\/|$)/;

/** Splits an absolute POSIX path at the managed directory, if it crosses one. */
export function managedSplit(absPosix: string): { root: string; rel: string } | null {
  const match = MANAGED_SEGMENT.exec(absPosix);
  if (!match) return null;
  const end = match.index + match[1].length + match[2].length;
  return {
    root: absPosix.slice(0, end),
    rel: normalizePosix(absPosix.slice(end).replace(/^\/+/, '')),
  };
}

/**
 * The one deliberate exception to fail-open. The reason must name a runnable
 * command: it reaches the model at the exact moment it is wrong, which is the
 * cheapest possible moment to correct it.
 */
export function denyReason(absNative: string): string | null {
  const split = managedSplit(toPosix(absNative));
  if (!split) return null;
  const { rel } = split;

  if (matchesAnyGlob(rel, ['items/**'])) {
    return 'my_context: `.my_context/items/` is managed by my_context. Writing the file ' +
      'directly leaves the SQLite index and the item checksum stale. Create items with ' +
      '`mycontext add <category> "<title>"`, and read them with ' +
      '`mycontext show <id>`.';
  }

  if (matchesAnyGlob(rel, ['.index.db*', 'state/**'])) {
    return `my_context: \`.my_context/${rel}\` is generated state, not source. It is derived ` +
      'from the Markdown in `.my_context/items/` — run `mycontext rebuild` to ' +
      'regenerate it instead of editing it.';
  }

  return `my_context: \`.my_context/${rel}\` is managed by my_context and must not be written ` +
    'directly. Use `mycontext add <category> "<title>"` to create an item, ' +
    '`node src/cli/index.ts list` and `show <id>` to read, and ' +
    '`mycontext rebuild` to refresh the index. Configuration changes to ' +
    '`.my_context/config.json` are the user\'s to make — ask, do not edit.';
}

/** Returns the JSON to print on stdout, or '' for "no opinion". */
export function runPreToolUse(raw: string, fallbackCwd: string): string {
  try {
    const input = parseHookInput(raw);
    const cwd = input.cwd ?? fallbackCwd;
    const filePath = extractFilePath(input);
    if (!filePath) return '';

    if (/Edit|Write/.test(input.tool_name ?? '')) {
      const reason = denyReason(path.resolve(cwd, filePath));
      if (reason) return preToolUseDeny(reason);
    }

    return '';
  } catch {
    return '';
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No self-limiting timer. An unref()d timer cannot preempt synchronous work, so it
  // is dead code advertising a bound that does not exist. The real bound is the
  // hooks.json timeout; the latency budget is enforced by Task 10's performance test.
  try {
    const output = runPreToolUse(readStdin(), process.cwd());
    if (output) process.stdout.write(output);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
```

`isMainEntry` (not a raw `import.meta.filename === process.argv[1]` comparison) is Plan 1's fix for `npm link` on Windows, where the installed command is a symlink — the CLI already uses it, and every hook entry point in this plan does too.

- [ ] **Step 5: Register the hook**

`hooks/hooks.json` — replace the whole file:

```json
{
  "description": "my_context knowledge injection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-tool-use.ts\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

`timeout` is in **seconds**. 10 s is the only real bound: an in-code self-limiting timer was tried and removed twice on this project, because an `unref()`d timer cannot preempt synchronous work. The 50 ms budget is enforced by Task 10's performance test, not at runtime.

- [ ] **Step 6: Verify the deny end to end from a shell**

Run:

```bash
echo '{"session_id":"s1","cwd":".","tool_name":"Write","tool_input":{"file_path":".my_context/items/rule/RULE-x.md"}}' | node src/hooks/pre-tool-use.ts
```

Expected: one line of JSON containing `"permissionDecision":"deny"` and the `add` command, exit code 0.

- [ ] **Step 7: Run tests and typecheck**

Run: `node --test test/hooks/pre-tool-use-deny.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/hooks/io.ts src/hooks/pre-tool-use.ts hooks/hooks.json test/hooks/pre-tool-use-deny.test.ts
git commit -m "feat: deny agent writes under .my_context with a correcting reason"
```

---

## Task 7: JIT activation in the PreToolUse hook

**Files:**
- Modify: `src/hooks/pre-tool-use.ts` (add `buildJitOutput`, extend `runPreToolUse`)
- Test: `test/hooks/pre-tool-use-jit.test.ts`

**Interfaces:**
- Consumes: `Store.activeScoped` (Task 5), `Ledger.open`/`seen`/`recordMany` (Task 1), `select` with `event: 'tool'` (Task 3), `renderSelection` from `core/render.ts`, `resolveWorkspace` from `core/workspace.ts`, `relPosix` from `core/paths.ts`, `preToolUseContext` from `io.ts`
- Produces: `buildJitOutput(input: HookInput, cwd: string, filePath: string): string` — the injectable text, `''` for nothing to say

Design points, each of which a test pins down:

- **No rebuild.** `SessionStart` rebuilds the index; this hook performs a single indexed read. That is what makes the 50 ms ceiling reachable.
- **Scope globs are repo-relative.** `resolveWorkspace().projectRoot` is the `.my_context` directory, so the repo root is its parent, and the tool's path is made relative to that before matching.
- **A path outside the repo selects nothing** rather than matching by accident against a `..`-prefixed relative path.
- **The ledger is written only for what was actually injected** — never for spilled items, or the spilled item could never be injected later.

- [ ] **Step 1: Write the failing test**

`test/hooks/pre-tool-use-jit.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-jit-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, type: string, scope: string[], body: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  const scopeBlock = scope.length
    ? `scope:\n${scope.map((s) => `  - "${s}"`).join('\n')}\n`
    : 'scope: []\n';
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
severity: hard
always: false
${scopeBlock}---

# ${id} title

${body}
`);
}

/** Index the workspace the way SessionStart would, so the JIT hook can read it. */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function toolInput(cwd: string, sessionId: string, filePath: string, tool = 'Read'): string {
  return JSON.stringify({
    session_id: sessionId,
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: tool,
    tool_input: { file_path: filePath },
  });
}

function context(raw: string): string {
  const parsed = JSON.parse(raw) as {
    hookSpecificOutput: { additionalContext?: string };
  };
  return parsed.hookSpecificOutput.additionalContext ?? '';
}

test('reading a file in scope injects the matching item once', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const text = context(out);
  assert.match(text, /CONST-pool/);
  assert.match(text, /Pool capped at 20\./);

  rmSync(cwd, { recursive: true, force: true });
});

test('the second read in the same session injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  const first = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(first), /CONST-pool/);

  const second = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/reader.ts')), cwd);
  assert.equal(second, '');

  rmSync(cwd, { recursive: true, force: true });
});

test('a different session gets its own first injection', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);

  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  const other = runPreToolUse(toolInput(cwd, 's2', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(other), /CONST-pool/);

  rmSync(cwd, { recursive: true, force: true });
});

test('the injection is recorded in the ledger under the jit tier', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  const entries = ledger.entries('s1');
  assert.deepEqual(entries.map((e) => [e.itemId, e.tier]), [['CONST-pool', 'jit']]);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside every scope injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'docs/readme.md')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a file outside the repository injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);
  const outside = path.join(tmpdir(), 'elsewhere', 'file.ts');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', outside), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('an unscoped item never activates', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-inert', 'constraint', [], 'No scope, no injection.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a rationale item never activates however well it matches', () => {
  const cwd = sandbox();
  addItem(cwd, 'LESSON-db', 'lesson', ['src/db/**'], 'Migrations need locks.');
  index(cwd);
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a write to .my_context is denied and injects nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-any', 'constraint', ['**'], 'Applies everywhere.');
  index(cwd);

  const out = runPreToolUse(
    toolInput(cwd, 's1', path.join(cwd, '.my_context/items/rule/RULE-x.md'), 'Write'), cwd);
  const parsed = JSON.parse(out) as {
    hookSpecificOutput: { permissionDecision?: string; additionalContext?: string };
  };
  assert.equal(parsed.hookSpecificOutput.permissionDecision, 'deny');
  assert.equal(parsed.hookSpecificOutput.additionalContext, undefined);

  rmSync(cwd, { recursive: true, force: true });
});

test('an unindexed workspace injects nothing rather than throwing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Never indexed.');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a corrupt config yields empty output rather than a throw', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  writeFileSync(path.join(cwd, '.my_context', 'config.json'), '{ not json');
  assert.equal(runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing session id injects nothing — there would be nowhere to dedupe', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pool', 'constraint', ['src/db/**'], 'Pool capped at 20.');
  index(cwd);
  const raw = JSON.stringify({
    cwd, tool_name: 'Read', tool_input: { file_path: path.join(cwd, 'src/db/writer.ts') },
  });
  assert.equal(runPreToolUse(raw, cwd), '');
  rmSync(cwd, { recursive: true, force: true });
});

test('a spilled item is not recorded as seen, so it can still arrive later', () => {
  const cwd = sandbox();
  const big = 'x'.repeat(4000); // ~1000 tokens, over the 500 default JIT budget
  addItem(cwd, 'CONST-huge', 'constraint', ['src/db/**'], big);
  index(cwd);

  const out = runPreToolUse(toolInput(cwd, 's1', path.join(cwd, 'src/db/writer.ts')), cwd);
  assert.match(context(out), /omitted/i);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('s1'), []);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/pre-tool-use-jit.test.ts`
Expected: FAIL — `runPreToolUse` returns `''` where an `additionalContext` payload is expected

- [ ] **Step 3: Implement**

Extend the imports at the top of `src/hooks/pre-tool-use.ts`:

```typescript
import path from 'node:path';
import { Ledger } from '../core/ledger.ts';
import { matchesAnyGlob, normalizePosix, relPosix, toPosix } from '../core/paths.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, preToolUseContext, preToolUseDeny, readStdin, type HookInput } from './io.ts';
```

Add `buildJitOutput` above `runPreToolUse`:

```typescript
/**
 * Single indexed SQLite read, no rebuild, no LLM, no network (spec §6.5).
 * Returns '' — never throws — so a corrupt index means "no items today"
 * rather than a blocked edit.
 */
export function buildJitOutput(input: HookInput, cwd: string, filePath: string): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return '';

    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // projectRoot is the `.my_context` directory; scope globs are repo-relative.
    const repoRoot = path.dirname(ws.projectRoot);
    const target = relPosix(repoRoot, path.resolve(cwd, filePath));
    if (target === '' || target.startsWith('..')) return '';

    store = Store.open(ws.dbPath);
    ledger = Ledger.open(ws.dbPath);

    const selection = select(
      store.activeScoped(),
      { event: 'tool', path: target, seen: ledger.seen(sessionId) },
      ws.config,
    );
    if (selection.full.length === 0) return '';

    // Only what is actually injected is recorded: a spilled item must stay
    // eligible for a later activation.
    ledger.recordMany(sessionId, selection.full.map((e) => e.item.id), 'jit');
    return renderSelection(selection);
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}
```

Replace the body of `runPreToolUse`:

```typescript
export function runPreToolUse(raw: string, fallbackCwd: string): string {
  try {
    const input = parseHookInput(raw);
    const cwd = input.cwd ?? fallbackCwd;
    const filePath = extractFilePath(input);
    if (!filePath) return '';

    if (/Edit|Write/.test(input.tool_name ?? '')) {
      const reason = denyReason(path.resolve(cwd, filePath));
      if (reason) return preToolUseDeny(reason);
    }

    const text = buildJitOutput(input, cwd, filePath);
    return text ? preToolUseContext(text) : '';
  } catch {
    return '';
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `node --test test/hooks/pre-tool-use-jit.test.ts test/hooks/pre-tool-use-deny.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/hooks/pre-tool-use.ts test/hooks/pre-tool-use-jit.test.ts
git commit -m "feat: inject scope-matched items once per session on file tools"
```

---

## Task 8: The PreCompact snapshot

**Files:**
- Create: `src/hooks/pre-compact.ts`
- Modify: `hooks/hooks.json`
- Test: `test/hooks/pre-compact.test.ts`

**Interfaces:**
- Consumes: `Ledger.seen`, `writeSnapshot`, `scanTranscriptIds` from `core/ledger.ts`; `Store.ids` from `core/store.ts`; `resolveWorkspace`; `parseHookInput`, `readStdin` from `hooks/io.ts`
- Produces: `buildRestoreSnapshot(input: HookInput, fallbackCwd: string): { path: string; itemIds: string[] } | null`

The snapshot is the **union** of two independent signals, and it needs both:

- The **ledger** knows what my_context injected, which the model may have acted on without ever naming.
- The **transcript scan** catches items the user or the model cited by id — an item pulled up with `mycontext show` and discussed at length never passed through the ledger at all.

`PreCompact` produces no injectable output. It writes a file and exits 0.

- [ ] **Step 1: Write the failing test**

`test/hooks/pre-compact.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger, readSnapshot } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-precompact-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, type = 'constraint'): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
---

# ${id} title

Body.
`);
}

function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

function input(cwd: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { session_id: 's1', hook_event_name: 'PreCompact', cwd, ...extra };
}

test('the snapshot captures everything the ledger recorded this session', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  addItem(cwd, 'CONST-b');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.record('s2', 'CONST-b', 'jit');
  ledger.close();

  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);
  assert.deepEqual(readSnapshot(ws.projectRoot!, 's1'), ['CONST-a']);

  rmSync(cwd, { recursive: true, force: true });
});

test('the snapshot unions the ledger with ids cited in the transcript', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-injected');
  addItem(cwd, 'CONST-discussed');
  addItem(cwd, 'CONST-never-mentioned');
  index(cwd);

  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-injected', 'jit');
  ledger.close();

  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript,
    '{"role":"user","content":"remind me what CONST-discussed says"}\n');

  const result = buildRestoreSnapshot(input(cwd, { transcript_path: transcript }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-discussed', 'CONST-injected']);

  rmSync(cwd, { recursive: true, force: true });
});

test('transcript tokens that are not real item ids are ignored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-real');
  index(cwd);

  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript,
    '{"content":"CONST-real plus TODO-invented and RFC-2119-ish talk"}\n');

  const result = buildRestoreSnapshot(input(cwd, { transcript_path: transcript }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-real']);

  rmSync(cwd, { recursive: true, force: true });
});

test('an empty session still writes an empty snapshot', () => {
  const cwd = sandbox();
  index(cwd);
  const result = buildRestoreSnapshot(input(cwd), cwd);
  assert.deepEqual(result?.itemIds, []);
  const ws = resolveWorkspace(cwd);
  assert.deepEqual(readSnapshot(ws.projectRoot!, 's1'), []);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing transcript path degrades to the ledger alone', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-a');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-a', 'jit');
  ledger.close();

  const result = buildRestoreSnapshot(
    input(cwd, { transcript_path: path.join(cwd, 'gone.jsonl') }), cwd);
  assert.deepEqual(result?.itemIds, ['CONST-a']);

  rmSync(cwd, { recursive: true, force: true });
});

test('ids that have since left the index are not carried forward', () => {
  const cwd = sandbox();
  index(cwd);
  const ws = resolveWorkspace(cwd);
  const ledger = Ledger.open(ws.dbPath);
  ledger.record('s1', 'CONST-deleted-since', 'jit');
  ledger.close();

  assert.deepEqual(buildRestoreSnapshot(input(cwd), cwd)?.itemIds, []);
  rmSync(cwd, { recursive: true, force: true });
});

test('no workspace, no session id, and malformed input all return null', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  assert.equal(buildRestoreSnapshot({ session_id: 's1', cwd: bare }, bare), null);

  const cwd = sandbox();
  index(cwd);
  assert.equal(buildRestoreSnapshot({ cwd }, cwd), null);

  rmSync(bare, { recursive: true, force: true });
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/pre-compact.test.ts`
Expected: FAIL — `Cannot find module '../../src/hooks/pre-compact.ts'`

- [ ] **Step 3: Implement**

`src/hooks/pre-compact.ts`:

```typescript
import { Ledger, scanTranscriptIds, writeSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The union of two independent signals, because each misses what the other
 * catches: the ledger knows what my_context injected, the transcript knows what
 * was cited by id after being fetched some other way. Both are filtered against
 * the live index so a deleted or renamed item is not resurrected.
 */
export function buildRestoreSnapshot(
  input: HookInput, fallbackCwd: string,
): { path: string; itemIds: string[] } | null {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return null;

    const ws = resolveWorkspace(input.cwd ?? fallbackCwd);
    if (!ws.projectRoot) return null;

    store = Store.open(ws.dbPath);
    ledger = Ledger.open(ws.dbPath);

    const known = new Set(store.ids());
    const fromLedger = ledger.seen(sessionId).filter((id) => known.has(id));
    const fromTranscript = scanTranscriptIds(input.transcript_path, known);
    const itemIds = [...new Set([...fromLedger, ...fromTranscript])].sort();

    return { path: writeSnapshot(ws.projectRoot, sessionId, itemIds), itemIds };
  } catch {
    return null;
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No self-limiting timer. An unref()d timer cannot preempt synchronous work, so it
  // is dead code advertising a bound that does not exist. The real bound is the
  // hooks.json timeout; the latency budget is enforced by Task 10's performance test.
  try {
    buildRestoreSnapshot(parseHookInput(readStdin()), process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
```

- [ ] **Step 4: Register the hook**

`hooks/hooks.json` — replace the whole file:

```json
{
  "description": "my_context knowledge injection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|resume",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-tool-use.ts\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-compact.ts\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

`PreCompact` carries no matcher — it fires for both manual and automatic compaction, and both need the snapshot.

- [ ] **Step 5: Run tests and typecheck**

Run: `node --test test/hooks/pre-compact.test.ts && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/hooks/pre-compact.ts hooks/hooks.json test/hooks/pre-compact.test.ts
git commit -m "feat: capture a restore snapshot from the ledger and transcript at PreCompact"
```

---

## Task 9: Restore at SessionStart(compact)

**Files:**
- Modify: `src/hooks/session-start.ts`, `hooks/hooks.json`
- Test: `test/hooks/session-start-restore.test.ts`

**Interfaces:**
- Consumes: `readSnapshot`, `Ledger` from `core/ledger.ts`; `select` with `event: 'compact'` (Task 4); `parseHookInput`, `readStdin` from `hooks/io.ts`
- Produces: `buildSessionStartOutput(cwd: string, options?: { source?: string; sessionId?: string }): string` — Plan 1's one-argument calls keep working, because `options` has a default

Two decisions worth stating, both tested:

- **`seen` is deliberately not consulted on a compact.** The ledger still holds this session's rows — the session id survives compaction — but the *context* was thrown away. Filtering by `seen` would guarantee that nothing is ever restored, which is precisely the failure this tier exists to prevent.
- **Restored injections are recorded under the `restored` tier**, which is why `tier` is part of the ledger's primary key. An item injected as `jit` before the compact and restored after it produces two rows and no conflict, and a second compact in the same session will not re-restore what the first one already restored.

- [ ] **Step 1: Write the failing test**

`test/hooks/session-start-restore.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { Ledger, writeSnapshot } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-restore-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string, opts: {
  type?: string; always?: boolean; status?: string; body?: string;
} = {}): void {
  const type = opts.type ?? 'constraint';
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: ${opts.status ?? 'active'}
severity: hard
always: ${opts.always ?? false}
---

# ${id} title

${opts.body ?? 'Body text.'}
`);
}

function root(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

test('a compact session restores the snapshotted items in full', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Pool capped at 20.' });
  addItem(cwd, 'CONST-other', { body: 'Unrelated rule.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-restored/);
  assert.match(out, /Pool capped at 20\./);
  assert.equal(/Unrelated rule\./.test(out), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('a compact session also re-injects the pinned tier', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-pinned/);
  assert.match(out, /CONST-restored/);

  rmSync(cwd, { recursive: true, force: true });
});

test('a startup session ignores any snapshot lying around', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const out = buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' });
  assert.equal(/Restored body\./.test(out), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('restoring is not blocked by the ledger rows from before the compact', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  ledger.record('s1', 'CONST-restored', 'jit');
  ledger.close();

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(out, /CONST-restored/);

  rmSync(cwd, { recursive: true, force: true });
});

test('what is injected is recorded under the tier it was injected in', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true });
  addItem(cwd, 'CONST-restored');
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);
  buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  const tiers = new Map(ledger.entries('s1').map((e) => [e.itemId, e.tier]));
  ledger.close();
  assert.equal(tiers.get('CONST-pinned'), 'pinned');
  assert.equal(tiers.get('CONST-restored'), 'restored');

  rmSync(cwd, { recursive: true, force: true });
});

test('a second compact does not re-restore what the first already restored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-restored', { body: 'Restored body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-restored']);

  const first = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.match(first, /CONST-restored/);
  const second = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.equal(/Restored body\./.test(second), false);

  rmSync(cwd, { recursive: true, force: true });
});

test('a pinned item injected at startup is not re-injected by JIT later', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true });
  buildSessionStartOutput(cwd, { source: 'startup', sessionId: 's1' });

  const ledger = Ledger.open(resolveWorkspace(cwd).dbPath);
  assert.deepEqual(ledger.seen('s1'), ['CONST-pinned']);
  ledger.close();

  rmSync(cwd, { recursive: true, force: true });
});

test('without a session id the hook still injects, it just records nothing', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  const out = buildSessionStartOutput(cwd);
  assert.match(out, /CONST-pinned/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a missing snapshot degrades to an ordinary session start', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-pinned', { always: true, body: 'Always applies.' });
  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 'never-snapshotted' });
  assert.match(out, /CONST-pinned/);
  rmSync(cwd, { recursive: true, force: true });
});

test('a snapshotted item that was superseded meanwhile is not restored', () => {
  const cwd = sandbox();
  addItem(cwd, 'CONST-old', { status: 'superseded', body: 'Retired body.' });
  writeSnapshot(root(cwd), 's1', ['CONST-old']);
  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });
  assert.equal(/Retired body\./.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/hooks/session-start-restore.test.ts`
Expected: FAIL — `buildSessionStartOutput` ignores the second argument, so nothing is restored

- [ ] **Step 3: Implement**

> **Reconciliation note:** Plan 1 already hardened `session-start.ts` past
> what this task originally assumed — it uses `isMainEntry` (not a raw
> `import.meta.filename === process.argv[1]` comparison), already threads
> `ws.config` through as `rebuild`'s third argument, and **deliberately
> removed** the 200ms runtime self-timer: `buildSessionStartOutput` is fully
> synchronous, so a timer set before calling it could only ever fire during
> the stdout drain that follows, where its only reachable effect would be
> truncating output that is already safe. Do not reintroduce that timer. The
> replacement below keeps all of that and layers `SessionStartOptions`, the
> compact/restore branch, and per-tier ledger recording on top.

Replace `src/hooks/session-start.ts` in full:

```typescript
import { existsSync } from 'node:fs';
import { Ledger, readSnapshot } from '../core/ledger.ts';
import { isMainEntry } from '../core/paths.ts';
import { rebuild } from '../core/rebuild.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { parseHookInput, readStdin } from './io.ts';

export interface SessionStartOptions {
  /** startup | clear | resume | compact */
  source?: string;
  sessionId?: string;
}

/**
 * Build the text injected at SessionStart. Returns '' rather than throwing:
 * a knowledge base that breaks a session is worse than one that says nothing.
 */
export function buildSessionStartOutput(
  cwd: string, options: SessionStartOptions = {},
): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    store = Store.open(ws.dbPath);
    rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config);

    const compacting = options.source === 'compact';
    const sessionId = options.sessionId;

    // `seen` is deliberately not passed on a compact: the ledger rows survive
    // compaction but the context they describe does not, and filtering by them
    // would mean nothing is ever restored.
    const restore = compacting && sessionId ? readSnapshot(ws.projectRoot, sessionId) : [];
    const selection = select(
      store.all(),
      { event: compacting ? 'compact' : 'session-start', restore },
      ws.config,
    );

    if (sessionId && selection.full.length > 0) {
      ledger = Ledger.open(ws.dbPath);
      const at = new Date().toISOString();
      for (const entry of selection.full) {
        ledger.record(sessionId, entry.item.id, entry.tier, at);
      }
    }

    return renderSelection(selection);
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: buildSessionStartOutput is fully
  // synchronous, so a timer set before calling it can only ever fire during
  // the stdout drain that follows — where its sole reachable effect would be
  // truncating already-computed, already-safe injected context. The 500ms
  // session-start latency budget (see test/hooks/session-start.test.ts) is
  // enforced by that performance test, not by a runtime cutoff.
  try {
    const input = parseHookInput(readStdin());
    const text = buildSessionStartOutput(input.cwd ?? process.cwd(), {
      source: input.source,
      sessionId: input.session_id,
    });
    if (text) process.stdout.write(text);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
```

The second compact in the same session injects nothing because the first recorded `(s1, CONST-restored, 'restored')`, and `select` filters `seen` before budgeting — so the dedupe still holds *within* a tier while the cross-tier restore remains possible.

- [ ] **Step 4: Register the compact matcher**

`hooks/hooks.json` — replace the whole file:

```json
{
  "description": "my_context knowledge injection",
  "hooks": {
    "SessionStart": [
      {
        "matcher": "startup|clear|resume|compact",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/session-start.ts\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Read|Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-tool-use.ts\"",
            "timeout": 10
          }
        ]
      }
    ],
    "PreCompact": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node \"${CLAUDE_PLUGIN_ROOT}/src/hooks/pre-compact.ts\"",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

One entry now covers all four sources; the script branches on the `source` field it reads from stdin. Spec §6.2 notes there is no `PostCompact` event — `SessionStart` with `source: "compact"` is the post-compaction moment.

- [ ] **Step 5: Verify the round trip from a shell**

Run:

```bash
node src/cli/index.ts init
mycontext add constraint "Pool capped at 20"
echo '{"session_id":"demo","cwd":".","source":"startup"}' | node src/hooks/session-start.ts
echo '{"session_id":"demo","cwd":".","hook_event_name":"PreCompact"}' | node src/hooks/pre-compact.ts
cat .my_context/state/demo.restore.json
echo '{"session_id":"demo","cwd":".","source":"compact"}' | node src/hooks/session-start.ts
```

Expected: the snapshot file lists the ids injected during the session, and the final command re-prints them in full. Every command exits 0.

- [ ] **Step 6: Run the full suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — including Plan 1's `test/hooks/session-start.test.ts`, whose one-argument calls still work

- [ ] **Step 7: Commit**

```bash
git add src/hooks/session-start.ts hooks/hooks.json test/hooks/session-start-restore.test.ts
git commit -m "feat: restore the compact snapshot at SessionStart and record every injection"
```

---

## Task 10: The 50 ms p95 ceiling on a 5,000-item corpus

**Files:**
- Create: `test/perf/jit-latency.test.ts`
- Test: itself

**Interfaces:**
- Consumes: `runPreToolUse` (Task 7), `select` (Task 3), `Store` (Task 5), `Ledger` (Task 1), `runCli`, `resolveWorkspace`
- Produces: no source changes — this task exists to make a regression fail CI rather than merely annoy the user into disabling the plugin (spec §11)

The corpus is written straight into the index rather than through the CLI: this measures the hook's steady-state read path, which is what runs on every `Read`, and building 5,000 Markdown files would dominate the test's runtime without measuring anything the hook does.

Each iteration uses a **fresh session id**, so every iteration performs the full work — ledger lookup, selection, render, and ledger write — rather than short-circuiting on dedupe after the first.

- [ ] **Step 1: Write the failing test**

`test/perf/jit-latency.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runPreToolUse } from '../../src/hooks/pre-tool-use.ts';
import { runCli } from '../../src/cli/index.ts';
import { select } from '../../src/core/select.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { Store } from '../../src/core/store.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import type { Item } from '../../src/core/types.ts';

const CORPUS_SIZE = 5000;
const SCOPED_ITEMS = 10;
const ITERATIONS = 200;
const CEILING_MS = 50;

function item(over: Partial<Item>): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'A body of roughly forty characters.', observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

/** 5,000 items, of which only a handful declare a scope — the realistic shape. */
function corpus(): Item[] {
  const items: Item[] = [];
  for (let i = 0; i < SCOPED_ITEMS; i++) {
    items.push(item({
      id: `CONST-scoped-${i}`, type: 'constraint', scope: ['src/db/**'],
      filePath: `items/constraint/CONST-scoped-${i}.md`,
    }));
  }
  for (let i = items.length; i < CORPUS_SIZE; i++) {
    items.push(item({
      id: `LESSON-${i}`, type: 'lesson', title: `Lesson ${i}`,
      filePath: `items/lesson/LESSON-${i}.md`,
    }));
  }
  return items;
}

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('the JIT hook stays under the 50ms p95 ceiling on a 5000-item corpus', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  for (const entry of corpus()) store.upsert(entry);
  assert.equal(store.ids().length, CORPUS_SIZE);
  assert.equal(store.activeScoped().length, SCOPED_ITEMS);
  store.close();

  const target = path.join(cwd, 'src', 'db', 'writer.ts');
  const samples: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const raw = JSON.stringify({
      session_id: `perf-${i}`, cwd, tool_name: 'Read', tool_input: { file_path: target },
    });
    const started = process.hrtime.bigint();
    const out = runPreToolUse(raw, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.match(out, /additionalContext/, `no injection on iteration ${i}`);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `JIT p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms)`,
  );

  rmSync(cwd, { recursive: true, force: true });
});

test('a non-matching path is just as cheap — the miss case is the common case', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-miss-'));
  runCli(['init'], cwd, () => {});

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  for (const entry of corpus()) store.upsert(entry);
  store.close();

  const target = path.join(cwd, 'docs', 'readme.md');
  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const raw = JSON.stringify({
      session_id: `perf-miss-${i}`, cwd, tool_name: 'Read', tool_input: { file_path: target },
    });
    const started = process.hrtime.bigint();
    assert.equal(runPreToolUse(raw, cwd), '');
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(measured < CEILING_MS, `JIT miss p95 was ${measured.toFixed(1)}ms`);
  rmSync(cwd, { recursive: true, force: true });
});

test('the selector itself stays well inside the hook budget on 5000 items', () => {
  const items = corpus();
  const config = resolveConfig({});
  const samples: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const selection = select(items, { event: 'tool', path: 'src/db/writer.ts' }, config);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(selection.full.length > 0, true);
  }

  const measured = p95(samples);
  assert.ok(measured < 10, `select p95 was ${measured.toFixed(1)}ms on ${items.length} items`);
});

test('the ledger stays fast once a long session has accumulated rows', () => {
  const ledger = Ledger.open(':memory:');
  for (let i = 0; i < CORPUS_SIZE; i++) ledger.record('long-session', `LESSON-${i}`, 'jit');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    const seen = ledger.seen('long-session');
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
    assert.equal(seen.length, CORPUS_SIZE);
  }
  ledger.close();

  const measured = p95(samples);
  assert.ok(measured < 25, `ledger seen() p95 was ${measured.toFixed(1)}ms`);
});
```

- [ ] **Step 2: Run the test**

Run: `node --test test/perf/jit-latency.test.ts`
Expected: PASS. If the first test fails, the cause is almost always one of three things, in order of likelihood: `select` is building the bounded index on the tool path (Task 3, Step 3), the hook is calling `store.all()` instead of `store.activeScoped()` (Task 7), or `rebuild` has crept into the hook. Fix the cause; do not raise the ceiling.

- [ ] **Step 3: Confirm the whole suite runs, not a subset**

Run: `npm test`
Expected: PASS, and the reported test-file count equals the number of files under `test/`. A lower count means the `**` glob was expanded by the shell rather than by Node — check that `package.json` still double-quotes the pattern.

- [ ] **Step 4: Commit**

```bash
git add test/perf/jit-latency.test.ts
git commit -m "test: enforce the 50ms p95 JIT ceiling on a 5000-item corpus"
```

---

## Task 11: Ledger read methods for decay reporting

**Files:**
- Modify: `src/core/ledger.ts`
- Test: `test/core/ledger-queries.test.ts`

**Interfaces:**
- Consumes: the `ledger` table and `Usage` type from Task 1
- Produces, added to `class Ledger`:
  - `allUsage(): Usage[]` — one row per item id ever injected
  - `recentSessions(limit: number): string[]` — distinct session ids, newest first
  - `itemsUsedIn(sessionIds: string[]): string[]` — distinct item ids injected in any of them
  - `sessionCount(): number` — how many distinct sessions the ledger has recorded

**Why this task exists.** Plan 4's decay report answers "which items have not been activated in the last N sessions", which needs session-level queries this plan's `Ledger` does not expose — `usage(itemId)` and `mostUsed(limit)` cannot express it. The table owned here already holds every column required, so the read methods belong here rather than being reinvented against a table Plan 4 does not own. They are read-only and additive; nothing in Tasks 1–10 changes.

- [ ] **Step 1: Write the failing test**

`test/core/ledger-queries.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ledger } from '../../src/core/ledger.ts';

function seeded(): Ledger {
  const ledger = Ledger.open(':memory:');
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-10T10:00:00.000Z');
  ledger.record('s2', 'CONST-a', 'jit', '2026-08-11T10:00:00.000Z');
  ledger.record('s2', 'CONST-b', 'pinned', '2026-08-11T10:00:01.000Z');
  ledger.record('s3', 'CONST-c', 'jit', '2026-08-12T10:00:00.000Z');
  return ledger;
}

test('allUsage returns one row per item with counts and last use', () => {
  const ledger = seeded();
  const rows = ledger.allUsage().sort((a, b) => a.itemId.localeCompare(b.itemId));
  assert.deepEqual(rows.map((r) => r.itemId), ['CONST-a', 'CONST-b', 'CONST-c']);
  assert.equal(rows[0].useCount, 2);
  assert.equal(rows[0].lastUsed, '2026-08-11T10:00:00.000Z');
  ledger.close();
});

test('allUsage omits items that were never injected', () => {
  const ledger = seeded();
  assert.equal(ledger.allUsage().some((r) => r.itemId === 'CONST-never'), false);
  ledger.close();
});

test('recentSessions returns distinct sessions newest first', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.recentSessions(2), ['s3', 's2']);
  assert.deepEqual(ledger.recentSessions(10), ['s3', 's2', 's1']);
  ledger.close();
});

test('itemsUsedIn returns distinct ids across the given sessions', () => {
  const ledger = seeded();
  assert.deepEqual(ledger.itemsUsedIn(['s2', 's3']).sort(), ['CONST-a', 'CONST-b', 'CONST-c']);
  assert.deepEqual(ledger.itemsUsedIn([]), []);
  ledger.close();
});

test('sessionCount counts distinct sessions', () => {
  const ledger = seeded();
  assert.equal(ledger.sessionCount(), 3);
  ledger.close();
});

test('an empty ledger answers every query without throwing', () => {
  const ledger = Ledger.open(':memory:');
  assert.deepEqual(ledger.allUsage(), []);
  assert.deepEqual(ledger.recentSessions(5), []);
  assert.deepEqual(ledger.itemsUsedIn(['nope']), []);
  assert.equal(ledger.sessionCount(), 0);
  ledger.close();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test test/core/ledger-queries.test.ts`
Expected: FAIL — `ledger.allUsage is not a function`

- [ ] **Step 3: Implement**

Add these three methods to `class Ledger` in `src/core/ledger.ts`, using the `#db` private field established in Task 1 (do not add a second field):

```typescript
  /** One row per item id that has ever been injected. */
  allUsage(): Usage[] {
    const rows = this.#db.prepare(`
      SELECT item_id AS itemId, COUNT(*) AS useCount, MAX(injected_at) AS lastUsed
      FROM ledger
      GROUP BY item_id
      ORDER BY item_id
    `).all() as { itemId: string; useCount: number; lastUsed: string | null }[];
    return rows.map((r) => ({
      itemId: r.itemId, useCount: r.useCount, lastUsed: r.lastUsed ?? null,
    }));
  }

  /** Distinct session ids, most recent first. */
  recentSessions(limit: number): string[] {
    if (limit <= 0) return [];
    const rows = this.#db.prepare(`
      SELECT session_id AS sessionId
      FROM ledger
      GROUP BY session_id
      ORDER BY MAX(injected_at) DESC
      LIMIT ?
    `).all(limit) as { sessionId: string }[];
    return rows.map((r) => r.sessionId);
  }

  /** Distinct item ids injected during any of the given sessions. */
  itemsUsedIn(sessionIds: string[]): string[] {
    if (sessionIds.length === 0) return [];
    const placeholders = sessionIds.map(() => '?').join(', ');
    const rows = this.#db.prepare(`
      SELECT DISTINCT item_id AS itemId
      FROM ledger
      WHERE session_id IN (${placeholders})
      ORDER BY item_id
    `).all(...sessionIds) as { itemId: string }[];
    return rows.map((r) => r.itemId);
  }

  /** How many distinct sessions the ledger has recorded. */
  sessionCount(): number {
    const row = this.#db.prepare(
      'SELECT COUNT(DISTINCT session_id) AS n FROM ledger',
    ).get() as { n: number } | undefined;
    return row?.n ?? 0;
  }
```

- [ ] **Step 4: Run the whole suite and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS, with Tasks 1–10 unaffected

- [ ] **Step 5: Commit**

```bash
git add src/core/ledger.ts test/core/ledger-queries.test.ts
git commit -m "feat: add ledger read methods for decay reporting"
```

---

## Verification

After Task 10, confirm the plan's goal is met:

```bash
npm test                 # every suite passes on this platform
npm run typecheck        # no type errors
```

Then exercise the four behaviours in a real session:

```bash
claude --plugin-dir .
```

1. Create a constraint, set its `scope` to `src/**`, then ask Claude to read a file under `src/` — the constraint should appear in context exactly once, however many files it reads afterwards.
2. Ask Claude to edit a file under `.my_context/items/` — the tool call should be denied, with a reason naming the `add` command.
3. Force a compaction, then confirm the items in play before it reappear afterwards, and that `.my_context/state/<session>.restore.json` lists them.
4. Confirm every hook still exits 0 with an empty index: `rm .my_context/.index.db` and repeat step 1 — nothing should be injected, and nothing should break.

## What this plan does not cover

Deliberately out of scope, so the boundaries are explicit:

- **Plan 3:** The MCP server and its eight tools, `mycontext_help`, `mycontext_examples`, the `SKILL.md`, the `PostToolUse` capture nudge on `watchedDocs`, and the `/LoadMyContext` command. `SelectEvent` includes `'manual'` and `select` treats it exactly like a session start, but nothing invokes it yet.
- **Plan 4:** Batch ingestion, lesson→rule generation with its approval gate, `doctor`, supersession and mutation commands, checksum drift detection, and decay reporting.

Specific capabilities this plan builds the foundation for but does not deliver:

- **Decay reporting.** `Ledger.usage` and `Ledger.mostUsed` exist and are tested, but no command surfaces them. Spec §6.4's spill ordering by `last_used desc` therefore remains unimplemented: `select` is pure and has no ledger access, so it orders by `(severity, layer, id)`. Wiring usage into the ordering means extending `SelectContext`, which belongs with the reporting work that makes the data visible.
- **The spill log as a table.** Spec §6.6 lists the spill log among the ledger's jobs. Spills are surfaced in every rendered selection (Plan 1's `renderSelection`) and returned in `Selection.spilled`, but they are not persisted — persisting them is only useful once `doctor` and the decay report can read them, in Plan 4.
- **Snapshot cleanup.** `.my_context/state/` accumulates one small JSON file per compacted session and is gitignored by `writeSnapshot`. Pruning belongs with `doctor` in Plan 4, which is where installation-health maintenance lives.
- **Enforcement beyond the `.my_context/` deny.** Spec §12 keeps `severity: hard` blocking of violating edits deferred until the corpus has proven itself. The deny implemented here protects my_context's own storage; it never blocks work on the user's code.
- **Concurrency testing.** `busy_timeout` is set on both the `Store` and `Ledger` connections, and two connections to one file are now genuinely in play, but no test exercises two processes writing at once. The realistic contention arrives when the MCP server can write while a hook reads, so that test belongs in Plan 3 where it can exercise the real thing rather than a synthetic one.
