import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { readAudit } from '../../src/core/audit.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { Ledger, readSnapshotMeta, writeSnapshot } from '../../src/core/ledger.ts';
import { readSeen, restoredFor, seenFilePath, seenIds } from '../../src/core/seen-file.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inject-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

/** Like `pin`, but NOT always:true — eligible for the restored tier only. */
function pin2(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: false
---

# ${title}

Distinct restorable body sentence.
`);
}

function ledgerRowCount(cwd: string): number {
  const db = new DatabaseSync(path.join(cwd, '.my_context', '.index.db'));
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ledger (
      session_id TEXT NOT NULL, item_id TEXT NOT NULL,
      tier TEXT NOT NULL, injected_at TEXT NOT NULL,
      PRIMARY KEY (session_id, item_id, tier))`);
    const row = db.prepare('SELECT COUNT(*) AS n FROM ledger').get() as { n: number };
    return Number(row.n);
  } finally {
    db.close();
  }
}

/**
 * One selection, one renderer, one output: the manual event exists so
 * `load_context` never grows a second answer to "what gets injected".
 */
test('a manual injection is identical to the session-start injection', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.match(buildInjection(cwd, { event: 'manual' }), /CONST-pool/);
  assert.equal(buildInjection(cwd, { event: 'manual' }), buildSessionStartOutput(cwd));
  removeTree(cwd);
});

test('a session-start injection with a session id records in the seen file, never the ledger', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  buildSessionStartOutput(cwd, { source: 'startup', sessionId: 'abc-123' });
  const root = resolveWorkspace(cwd).projectRoot!;
  assert.deepEqual(seenIds(readSeen(root, 'abc-123')), ['CONST-pool']);
  // The hook writes NO ledger rows — the ledger is a projection now (design B).
  assert.equal(ledgerRowCount(cwd), 0);
  removeTree(cwd);
});

/**
 * The guard that makes the "no fabricated session key" decision structural
 * rather than merely conventional: even if a caller hands the manual path a
 * session id, it is dropped. The ledger's keys come from hook payloads only,
 * because only those are the id the PreCompact snapshot and the compaction
 * restore agree on.
 */
test('a manual injection ignores a session id and records nothing', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  buildInjection(cwd, { event: 'manual', sessionId: 'abc-123' });
  assert.equal(ledgerRowCount(cwd), 0);
  removeTree(cwd);
});

/**
 * `compact` is a SessionStart source, not a manual one. A manual injection
 * must never take the restore branch — it has no snapshot to restore from and
 * no session to key one by.
 */
test('a manual injection ignores a compact source', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.equal(
    buildInjection(cwd, { event: 'manual', source: 'compact', sessionId: 'abc-123' }),
    buildInjection(cwd, { event: 'manual' }),
  );
  assert.equal(ledgerRowCount(cwd), 0);
  removeTree(cwd);
});

test('a manual injection outside a workspace is empty, not a throw', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inject-bare-'));
  assert.equal(buildInjection(cwd, { event: 'manual' }), '');
  removeTree(cwd);
});

/**
 * The design's §0.2, as a test: the injection is computed from Markdown, so a
 * foreign process holding the index's write lock costs the best-effort index
 * refresh (disclosed), never the injection itself.
 */
test('SessionStart injects with the database HELD by a foreign write transaction', (t) => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pinned', 'Pool capped at 20');
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close(); // let a writer create the db first
  // Hold the write lock from a second connection, as a concurrent rebuild would:
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => {
    try { holder.exec('ROLLBACK'); } catch { /* done */ }
    holder.close();
    removeTree(cwd);
  });
  const started = performance.now();
  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-held' });
  const elapsed = performance.now() - started;
  // The injection must be produced — the whole point of the design — and it
  // must not have waited out HOOK_OPEN_PROFILE's full budget on the critical
  // path plus anything else pathological. The bound here is deliberately the
  // 10 s harness kill with margin, not a perf assertion (Task 12 owns those):
  assert.notEqual(output, '');
  assert.match(output, /CONST-pinned/);
  assert.ok(elapsed < 5000, `took ${elapsed}ms against the 10s kill`);
  // The dropped refresh is disclosed, not swallowed:
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'session-start').at(-1)?.note ?? '';
  assert.match(note, /index refresh dropped/);
});

test('restore idempotency now lives in the seen file: same compaction never restores twice', (t) => {
  const cwd = sandbox();
  // NOT always:true — a pinned item would land in the pinned tier (which wins
  // over restored in select), and this test needs a restored-tier line.
  pin2(cwd, 'CONST-restorable', 'Restored body text');
  const ws = resolveWorkspace(cwd);
  t.after(() => removeTree(cwd));
  writeSnapshot(ws.projectRoot!, 'sess-c', ['CONST-restorable']);
  const first = buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-c' });
  assert.match(first, /Distinct restorable body sentence\./);
  // The restored marker is a seen-file line stamped with the snapshot's capturedAt:
  const meta = readSnapshotMeta(ws.projectRoot!, 'sess-c')!;
  const state = readSeen(ws.projectRoot!, 'sess-c');
  assert.ok(restoredFor(state, meta.capturedAt).size > 0);
  // A repeat firing of the SAME compaction must not re-inject the restored tier:
  const second = buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-c' });
  assert.equal(/Distinct restorable body sentence\./.test(second), false);
  // ...and no ledger row exists anywhere:
  const ledger = Ledger.open(ws.dbPath);
  assert.deepEqual(ledger.seen('sess-c'), []);
  ledger.close();
});

test('an unreadable seen file means over-restore, DISCLOSED — never a guessed suppression', (t) => {
  const cwd = sandbox();
  pin2(cwd, 'CONST-restorable', 'Restorable rule');
  const ws = resolveWorkspace(cwd);
  t.after(() => removeTree(cwd));
  writeSnapshot(ws.projectRoot!, 'sess-u', ['CONST-restorable']);
  // First restore records the marker...
  buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-u' });
  // ...then the seen file is corrupted: the dedupe state cannot be trusted.
  writeFileSync(seenFilePath(ws.projectRoot!, 'sess-u'), 'not jsonl at all\n');
  const again = buildInjection(cwd, { event: 'session-start', source: 'compact', sessionId: 'sess-u' });
  // Re-injection is the accepted failure direction; a suppression built on a
  // guessed-at seen set is not.
  assert.match(again, /Distinct restorable body sentence\./);
  // And the degraded dedupe is disclosed, not swallowed:
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'compact-restore').at(-1)?.note ?? '';
  assert.match(note, /seen file unreadable; restore dedupe skipped/);
});

test('a fresh workspace with NO index file still injects (first-run, C for free)', (t) => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pinned', 'Pool capped at 20');
  const ws = resolveWorkspace(cwd);
  t.after(() => removeTree(cwd));
  rmSync(ws.dbPath, { force: true });
  rmSync(`${ws.dbPath}-wal`, { force: true });
  rmSync(`${ws.dbPath}-shm`, { force: true });
  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-fresh' });
  assert.match(output, /CONST-pinned/);
});

// --- the pinned spill on the audit row --------------------------------------

/** Set one budget on a sandbox's config, leaving every other key as `init` wrote it. */
function setBudget(cwd: string, key: string, value: number): void {
  const file = path.join(cwd, '.my_context', 'config.json');
  const config = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  config.budgets = { ...(config.budgets as Record<string, number> ?? {}), [key]: value };
  writeFileSync(file, `${JSON.stringify(config, null, 2)}\n`);
}

/**
 * **The log has to answer "what did this session NOT get" on its own.**
 *
 * Re-deriving it later is not an option and that is the whole reason this is a
 * recorded field: the corpus MOVES. An item edited, pinned, unpinned or retired
 * after the injection re-costs differently or does not exist, so a figure
 * recomputed over today's items is wrong for exactly the corpus being
 * maintained most actively — the same argument `AuditRecord.tokens` carries.
 *
 * The per-item `spilled` rows already name the ids. What they cannot answer
 * without a reader parsing an English reason apart is the pair of numbers, and
 * a screen that parsed them would be a second implementation of `select`'s
 * decision — the defect this project has paid for most often.
 */
test('a partial pinned delivery is recorded on the injection row, with the numbers', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  pin(cwd, 'CONST-alpha', 'Alpha');
  pin(cwd, 'CONST-beta', 'Beta');
  pin(cwd, 'CONST-gamma', 'Gamma');
  // Small enough that not all three fit, large enough that one does: the
  // PARTIAL case, which is the one that reads as success.
  // Each fixture item costs ~13 estimated tokens, so 20 admits one and spills two.
  setBudget(cwd, 'pinned', 20);

  const text = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-spill' });
  const ws = resolveWorkspace(cwd);
  const record = readAudit(ws.projectRoot!).filter((r) => r.op === 'session-start').at(-1);

  assert.ok(record, 'an injection that spilled must leave a record');
  const delivered = (record.injected ?? []).filter((i) => i.tier === 'pinned').map((i) => i.id);
  assert.ok(delivered.length > 0 && delivered.length < 3,
    `fixture must be partial, delivered ${delivered.length} of 3`);
  assert.match(text, new RegExp(delivered[0]));

  assert.ok(record.pinnedSpill, 'the row must carry the pinned spill');
  assert.equal(record.pinnedSpill.budget, 20);
  assert.ok(record.pinnedSpill.cost > 20,
    'the recorded cost is the whole tier, so it must exceed the budget it spilled against');
  assert.deepEqual(
    [...record.pinnedSpill.ids].sort(),
    ['CONST-alpha', 'CONST-beta', 'CONST-gamma'].filter((id) => !delivered.includes(id)),
  );
  // Beside `injected` and beside `spilled`, not instead of either: the per-item
  // rows keep feeding the audit projection's `role = 'spilled'`.
  assert.deepEqual(
    (record.spilled ?? []).filter((s) => s.tier === 'pinned').map((s) => s.id).sort(),
    [...record.pinnedSpill.ids].sort(),
  );
});

test('an injection whose pinned tier fitted records no pinned spill', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  pin(cwd, 'CONST-alpha', 'Alpha');
  buildInjection(cwd, { event: 'session-start', sessionId: 'sess-fits' });
  const ws = resolveWorkspace(cwd);
  const record = readAudit(ws.projectRoot!).filter((r) => r.op === 'session-start').at(-1);
  assert.ok(record);
  assert.equal(record.pinnedSpill, undefined,
    'absent means "nothing spilled", and it must never be an empty-shaped claim');
});
