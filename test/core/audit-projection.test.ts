import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AUDIT_MAX_BYTES, AUDIT_PROTOCOL, auditLogPath, filterAudit, readAudit, recordAudit,
  type AuditFilter,
} from '../../src/core/audit.ts';
import {
  auditDbPath, openProjection, projectionState, queryProjection, sessions, syncProjection,
  topItems,
} from '../../src/core/audit-db.ts';
import { runCli } from '../../src/cli/index.ts';
import { createItem } from '../../src/core/mutate.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox } from '../helpers/workspace.ts';

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-proj-'));
  return { root, dispose: () => removeTree(root) };
}

/** A corpus of records that exercises every filter at once. */
function seed(root: string): void {
  recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a',
    at: '2026-08-14T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-b', fields: ['body'],
    at: '2026-08-15T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
    at: '2026-08-15T11:00:00.000Z',
    injected: [{ id: 'RULE-a', tier: 'pinned' }, { id: 'RULE-c', tier: 'index' }],
    spilled: [{ id: 'RULE-d', tier: 'pinned', reason: 'budget exceeded (900 > 800)' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's2', hook: 'PreToolUse', path: 'src/db/w.ts',
    at: '2026-08-16T10:00:00.000Z',
    injected: [{ id: 'RULE-b', tier: 'jit' }],
  });
  recordAudit(root, {
    kind: 'hook', op: 'deny', sessionId: 's2', hook: 'PreToolUse', path: 'items/x.md',
    at: '2026-08-16T11:00:00.000Z', note: 'Write refused',
  });
  recordAudit(root, {
    kind: 'mutation', op: 'supersede', origin: 'ingest', itemId: 'RULE-a',
    at: '2026-08-16T12:00:00.000Z', note: 'by RULE-a-r2',
  });
}

/**
 * **The projection and the JSONL must give the SAME answer.** The CLI reads
 * the projection; its fallback path and the `audit_log` MCP tool read the
 * JSONL. Two implementations of one filter is precisely the drift this project
 * has found five times, so the agreement is executed over every filter rather
 * than read off the two sources.
 */
const FILTERS: AuditFilter[] = [
  {},
  { kind: 'mutation' },
  { kind: 'injection' },
  { kind: 'hook' },
  { op: 'create' },
  { op: 'jit' },
  { origin: 'agent' },
  { origin: 'ingest' },
  { sessionId: 's1' },
  { sessionId: 's2' },
  { itemId: 'RULE-a' },
  { itemId: 'RULE-b' },
  { itemId: 'RULE-c' },
  { itemId: 'RULE-d' },
  { itemId: 'RULE-nothing' },
  { since: '2026-08-15T11:00:00.000Z' },
  { until: '2026-08-16T00:00:00.000Z' },
  { since: '2026-08-15T00:00:00.000Z', until: '2026-08-16T11:00:00.000Z' },
  { limit: 2 },
  { limit: 1000 },
  { kind: 'injection', itemId: 'RULE-a' },
  { origin: 'human', op: 'create', limit: 1 },
];

test('the projection answers exactly what the JSONL answers, for every filter', () => {
  const b = box();
  seed(b.root);
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);
    const records = readAudit(b.root);
    for (const filter of FILTERS) {
      assert.deepEqual(
        queryProjection(db, filter), filterAudit(records, filter),
        `the projection and the log disagree for ${JSON.stringify(filter)}`,
      );
    }
  } finally {
    db.close();
    b.dispose();
  }
});

test('a record is stored whole, so a field nothing indexes is still readable back', () => {
  const b = box();
  recordAudit(b.root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/x.ts',
    injected: [{ id: 'RULE-a', tier: 'jit' }],
    spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }],
    note: 'a note nothing has a column for',
  });
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);
    const [record] = queryProjection(db, {});
    // `note`, `spilled` and the per-entry `tier` have no column of their own —
    // they come back because the whole record is stored as jsonb rather than
    // shredded into columns, which is what lets the record shape grow without
    // a migration.
    assert.equal(record.note, 'a note nothing has a column for');
    assert.deepEqual(record.spilled, [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }]);
    assert.deepEqual(record.injected, [{ id: 'RULE-a', tier: 'jit' }]);
  } finally {
    db.close();
    b.dispose();
  }
});

// --- staleness, and never a silent stale answer ------------------------------

test('a projection with nothing to do reports fresh, and does no work', () => {
  const b = box();
  seed(b.root);
  const db = openProjection(b.root);
  try {
    assert.equal(syncProjection(b.root, db), 'behind');
    assert.equal(projectionState(b.root, db), 'fresh');
    assert.equal(syncProjection(b.root, db), 'fresh');
  } finally {
    db.close();
    b.dispose();
  }
});

test('a log that has grown reads as behind, and syncing catches it up incrementally', () => {
  const b = box();
  seed(b.root);
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);
    const before = queryProjection(db, {}).length;

    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-new',
      at: '2026-08-17T10:00:00.000Z',
    });
    assert.equal(projectionState(b.root, db), 'behind');
    assert.equal(syncProjection(b.root, db), 'behind');

    const after = queryProjection(db, {});
    assert.equal(after.length, before + 1);
    // Appended, not re-read from scratch: the new record is last, and the
    // earlier ones kept their order.
    assert.equal(after[after.length - 1].itemId, 'RULE-new');
    assert.deepEqual(after, filterAudit(readAudit(b.root), {}));
  } finally {
    db.close();
    b.dispose();
  }
});

test('a log that SHRANK reads as diverged, and is rebuilt rather than appended to', () => {
  const b = box();
  seed(b.root);
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);

    // Truncating an append-only log cannot be an append. Rows already
    // projected from it can no longer be trusted to be in log order.
    const file = auditLogPath(b.root);
    const lines = readFileSync(file, 'utf8').split('\n').filter((l) => l !== '');
    writeFileSync(file, lines.slice(0, 2).join('\n') + '\n', 'utf8');

    assert.equal(projectionState(b.root, db), 'diverged');
    assert.equal(syncProjection(b.root, db), 'diverged');
    assert.deepEqual(queryProjection(db, {}), filterAudit(readAudit(b.root), {}));
    assert.equal(queryProjection(db, {}).length, 2);
  } finally {
    db.close();
    b.dispose();
  }
});

test('a rotation is survived: everything before and after it is still queryable in order', () => {
  const b = box();
  recordAudit(b.root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'BEFORE-a',
    at: '2026-08-14T10:00:00.000Z',
  });
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);

    const file = auditLogPath(b.root);
    const filler = JSON.stringify({
      protocol: AUDIT_PROTOCOL, at: '2026-08-15T00:00:00.000Z', kind: 'hook', op: 'deny',
    }) + '\n';
    while (statSync(file).size < AUDIT_MAX_BYTES) appendFileSync(file, filler.repeat(2000), 'utf8');

    recordAudit(b.root, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'AFTER-a',
      at: '2026-08-16T10:00:00.000Z',
    });

    // The live log was renamed out from under the projection, so this is a
    // divergence and a full rebuild — which is correct and self-healing.
    assert.equal(syncProjection(b.root, db), 'diverged');
    const ids = queryProjection(db, { op: 'create' }).map((r) => r.itemId);
    assert.deepEqual(ids, ['BEFORE-a', 'AFTER-a']);
  } finally {
    db.close();
    b.dispose();
  }
});

// --- disposability, and separation from the item index -----------------------

test('deleting the projection loses nothing — it rebuilds from the log', () => {
  const b = box();
  seed(b.root);
  let db = openProjection(b.root);
  syncProjection(b.root, db);
  const before = queryProjection(db, {});
  db.close();

  rmSync(auditDbPath(b.root), { force: true });
  rmSync(`${auditDbPath(b.root)}-wal`, { force: true });
  rmSync(`${auditDbPath(b.root)}-shm`, { force: true });
  assert.equal(existsSync(auditDbPath(b.root)), false);

  db = openProjection(b.root);
  try {
    syncProjection(b.root, db);
    assert.deepEqual(queryProjection(db, {}), before);
  } finally {
    db.close();
    b.dispose();
  }
});

test('a corrupt projection is discarded and rebuilt, not propagated', () => {
  const b = box();
  seed(b.root);
  let db = openProjection(b.root);
  syncProjection(b.root, db);
  db.close();

  writeFileSync(auditDbPath(b.root), 'this is not a SQLite database', 'utf8');

  db = openProjection(b.root);
  try {
    syncProjection(b.root, db);
    assert.deepEqual(queryProjection(db, {}), filterAudit(readAudit(b.root), {}));
  } finally {
    db.close();
    b.dispose();
  }
});

/**
 * **The trap the separate file exists to close.**
 *
 * Had audit records lived in `.index.db`, `mycontext rebuild` would destroy
 * audit history — and the product tells users to run it freely. This runs the
 * real command and checks the real records.
 */
test('mycontext rebuild does not touch the audit log or its projection', () => {
  const box_ = sandbox();
  try {
    createItem(box_.ctx, { type: 'rule', title: 'A rule', body: 'Body.', origin: 'human' });
    seed(box_.root);
    const before = readAudit(box_.root);
    assert.ok(before.length > 1);

    assert.equal(runCli(['rebuild'], box_.cwd, () => {}), 0);
    assert.deepEqual(readAudit(box_.root), before);

    // …and again after the projection exists, since `rebuild` deletes and
    // recreates index state and must not reach this one.
    const db = openProjection(box_.root);
    syncProjection(box_.root, db);
    db.close();
    assert.equal(runCli(['rebuild'], box_.cwd, () => {}), 0);
    assert.ok(existsSync(auditDbPath(box_.root)), 'rebuild removed the audit projection');
    assert.deepEqual(readAudit(box_.root), before);
  } finally {
    box_.dispose();
  }
});

// --- the predefined queries --------------------------------------------------

test('the predefined queries answer over the roles the log actually records', () => {
  const b = box();
  seed(b.root);
  const db = openProjection(b.root);
  try {
    syncProjection(b.root, db);

    // RULE-a is named three times: created, superseded, and injected once.
    const all = topItems(db, null, 10);
    assert.equal(all.find((r) => r.label === 'RULE-a')?.count, 3);
    // …but only once as an injected item, and RULE-d only ever as a spill.
    assert.equal(topItems(db, 'injected', 10).find((r) => r.label === 'RULE-a')?.count, 1);
    assert.deepEqual(topItems(db, 'spilled', 10).map((r) => r.label), ['RULE-d']);

    const found = sessions(db, 10);
    assert.deepEqual(found.map((r) => r.label), ['s2', 's1']); // most recent first
    assert.equal(found.find((r) => r.label === 's2')?.count, 2);
  } finally {
    db.close();
    b.dispose();
  }
});
