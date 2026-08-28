/**
 * **The write path keeps the audit projection current** — plan:walk seq:28.
 *
 * WHAT WAS WRONG: every append left the projection one record further behind
 * and only `mycontext audit` caught it up. Measured on this repository
 * 2026-08-22, fresh to behind twice in forty minutes of ordinary work;
 * measured on the demo corpus 2026-08-24, the last forty records were all
 * `access`, so READS staled it too — a refusal is itself an audit record, so
 * one unauthenticated request was enough to put the read surface into refusal
 * over its own write.
 *
 * WHAT IS NOT THE FIX: letting a read surface sync. That boundary is
 * deliberate — syncing is a write — and it is untouched. The append is already
 * a write, so the record is projected by the thing that appended it, and there
 * is no boundary to cross.
 *
 * The three properties the ruling names are asserted here in its own order,
 * and the first two are asserted by BREAKING the projection rather than by
 * reading the code that is supposed to survive it:
 *
 *  1. the log append succeeds independently — a projection that cannot be
 *     written costs no record and is not reported as a lost one;
 *  2. a failed projection update does not fail the caller's command;
 *  3. it is not silent — `auditFailureNote` speaks a fault, and the state a
 *     non-fault leaves behind is the one the read surface already reports.
 *
 * And the restriction that keeps it affordable, asserted against the bytes:
 * this path NEVER rebuilds and NEVER creates a projection. The cost of one
 * append against a current projection is measured in
 * `test/perf/audit-latency.perf.ts`, not here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  AUDIT_MAX_BYTES, AUDIT_PROTOCOL, auditFailureNote, auditLogPath, auditSegments, filterAudit, readAudit,
  recordAudit,
} from '../../src/core/audit.ts';
import {
  auditDbPath, closeProjectionUpkeep, keepProjectionCurrent, openProjection, projectionState,
  queryProjection, syncProjection,
} from '../../src/core/audit-db.ts';
import { removeTree } from '../helpers/tmp.ts';
import { appendUnprojected } from '../helpers/unprojected-audit.ts';

function box(name: string): string {
  return mkdtempSync(path.join(tmpdir(), `myctx-projcur-${name}-`));
}

/** A corpus with a log and a projection built over it — what ordinary work leaves. */
function built(root: string): void {
  recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a',
    at: '2026-08-14T10:00:00.000Z',
  });
  const db = openProjection(root);
  syncProjection(root, db);
  db.close();
}

/** Reads the projection without any door that could repair it on the way in. */
function raw<T>(root: string, fn: (db: DatabaseSync) => T): T {
  const db = new DatabaseSync(auditDbPath(root), { readOnly: true });
  try {
    return fn(db);
  } finally {
    db.close();
  }
}

// --- the fix itself ---------------------------------------------------------

test('an append projects itself: the projection is current the instant the record lands', (t) => {
  const root = box('current');
  t.after(() => removeTree(root));
  built(root);

  const write = recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/db/w.ts',
    at: '2026-08-15T10:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'jit' }],
    spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }],
  });

  assert.equal(write.written, true);
  assert.equal(write.projection?.outcome, 'updated');
  assert.equal(write.projection?.applied, 1, 'exactly the one record just appended');

  // Against the disk, through a door that cannot sync: no `openProjection`,
  // no `syncProjection`, nothing that could make this true on the way in.
  raw(root, (db) => {
    assert.equal(projectionState(root, db), 'fresh');
    const records = queryProjection(db, {});
    assert.deepEqual(records, filterAudit(readAudit(root), {}));
    // The whole record, not a stub — the item roles a jsonb projection carries.
    assert.deepEqual(queryProjection(db, { itemId: 'RULE-b' }).map((r) => r.op), ['jit']);
  });
});

test('the record is projected, not merely counted — every filter finds it', (t) => {
  const root = box('filters');
  t.after(() => removeTree(root));
  built(root);
  for (let i = 0; i < 20; i++) {
    recordAudit(root, {
      kind: 'mutation', op: 'update', origin: 'agent', itemId: `RULE-${i}`, fields: ['body'],
      sessionId: 's2', at: `2026-08-16T10:00:${String(i).padStart(2, '0')}.000Z`,
    });
  }
  raw(root, (db) => {
    assert.equal(projectionState(root, db), 'fresh');
    assert.deepEqual(queryProjection(db, {}), filterAudit(readAudit(root), {}));
    assert.equal(queryProjection(db, { sessionId: 's2' }).length, 20);
    assert.equal(queryProjection(db, { itemId: 'RULE-19' }).length, 1);
    assert.equal(queryProjection(db, { op: 'update', limit: 5 }).length, 5);
  });
});

test('the projection still holds nothing the log does not — deleting it loses nothing', (t) => {
  const root = box('derived');
  t.after(() => removeTree(root));
  built(root);
  for (let i = 0; i < 10; i++) {
    recordAudit(root, {
      kind: 'hook', op: 'deny', sessionId: 's3', hook: 'PreToolUse', path: `items/${i}.md`,
      at: `2026-08-17T10:00:0${i}.000Z`, note: 'Write refused',
    });
  }
  const incremental = raw(root, (db) => queryProjection(db, {}));

  // The invariant the refusal message states: delete it and lose nothing. A
  // projection maintained one row at a time must be the same projection a
  // rebuild produces, or the incremental path has invented something.
  //
  // `closeProjectionUpkeep` first, because the appends above left this process
  // holding a write connection to the file about to be removed, and on Windows
  // an open handle pins it — `EPERM` from `rmSync`, which is what this line
  // measured before it was here. That is not a hedge around a flake: it is the
  // documented recovery being performed by hand, and the documented recovery is
  // something a person does with nothing running.
  closeProjectionUpkeep();
  for (const f of [auditDbPath(root), `${auditDbPath(root)}-wal`, `${auditDbPath(root)}-shm`]) {
    rmSync(f, { force: true });
  }
  const db = openProjection(root);
  syncProjection(root, db);
  const rebuilt = queryProjection(db, {});
  db.close();

  assert.deepEqual(incremental, rebuilt);
  assert.deepEqual(incremental, filterAudit(readAudit(root), {}));
});

// --- what it must NOT do ----------------------------------------------------

test('a workspace with no projection does not get one built by an append', (t) => {
  const root = box('unbuilt');
  t.after(() => removeTree(root));

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a',
    at: '2026-08-14T10:00:00.000Z',
  });

  assert.equal(write.written, true);
  assert.equal(write.projection?.outcome, 'unbuilt');
  assert.equal(existsSync(auditDbPath(root)), false,
    'an append conjured a projection. "never built" is an empty state the Watch screen names ' +
    'as itself, and building one here would pay for the whole log on the first append.');
  // The log is untouched by any of that.
  assert.equal(readAudit(root).length, 1);
  assert.equal(auditFailureNote(write), '', 'an empty state is not a fault and must not speak');
});

test('a DIVERGED projection is reported and left alone — a write path may not rebuild', (t) => {
  const root = box('diverged');
  t.after(() => removeTree(root));
  built(root);
  recordAudit(root, {
    kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-a', fields: ['body'],
    at: '2026-08-15T10:00:00.000Z',
  });

  // Truncating an append-only log cannot be an append. It must drop BELOW the
  // consumed offset to be a divergence rather than a coincidence, which is why
  // both records above are projected before one of them is removed.
  // `syncProjection` answers this by DELETEing every row and rebuilding; that
  // is a rebuild, and a rebuild on the append path would put the cost of the
  // whole log on one tool call.
  const log = auditLogPath(root);
  const lines = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
  assert.equal(lines.length, 2);
  writeFileSync(log, `${lines.slice(0, 1).join('\n')}\n`, 'utf8');

  const rowsBefore = raw(root, (db) => queryProjection(db, {}).length);
  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-c',
    at: '2026-08-16T10:00:00.000Z',
  });

  assert.equal(write.written, true, 'a divergence may never cost a record');
  assert.equal(write.projection?.outcome, 'diverged');
  assert.equal(write.projection?.applied, 0);
  assert.equal(raw(root, (db) => queryProjection(db, {}).length), rowsBefore,
    'the write path deleted rows to repair a divergence — that is a rebuild');
  assert.equal(auditFailureNote(write), '',
    'a divergence is a state the read surface reports precisely; it is not this caller s fault');
  // And the record IS in the log, which is the whole point of the ordering.
  assert.equal(readAudit(root).some((r) => r.itemId === 'RULE-c'), true);
});

test('a projection from a schema version this build does not read is declined, not discarded', (t) => {
  const root = box('version');
  t.after(() => removeTree(root));
  built(root);

  const bump = new DatabaseSync(auditDbPath(root));
  bump.exec(`UPDATE audit_meta SET value = '999' WHERE key = 'version'`);
  bump.close();
  const before = statSync(auditDbPath(root)).size;

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b',
    at: '2026-08-15T10:00:00.000Z',
  });

  assert.equal(write.written, true);
  assert.equal(write.projection?.outcome, 'foreign',
    'a version this build does not read is neither a fault nor a workspace that never built one');
  assert.equal(auditFailureNote(write), '');
  assert.equal(existsSync(auditDbPath(root)), true,
    '`openProjection` discards a version it cannot read and rebuilds; the append path may not, ' +
    'because discarding is the owner s remedy and a hook is not the owner');
  assert.equal(statSync(auditDbPath(root)).size, before);
});

// --- the failure mode is the design ----------------------------------------

test('a projection that cannot be written costs no record, no command, and no silence', (t) => {
  const root = box('failed');
  t.after(() => removeTree(root));
  built(root);

  // Not a database. `openProjectionForUpkeep` probes the shape by reading
  // `audit_meta`, so this is the ordinary corrupt-projection path rather than
  // an exotic one — and it must decline rather than `rmSync` it, which is what
  // `openProjection` would do.
  //
  // It must also not report this as `unbuilt`. Damage and "never built" are the
  // two states `ProjectionAbsentError` exists to keep apart on the read side,
  // and collapsing them here would leave a user with a projection that quietly
  // stopped tracking the log and nothing anywhere saying so. The first draft of
  // this path did exactly that; this assertion is what caught it.
  writeFileSync(auditDbPath(root), 'this is not a database', 'utf8');
  const before = readFileSync(auditDbPath(root), 'utf8');

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b',
    at: '2026-08-15T10:00:00.000Z',
  });

  // 1. The log append succeeded independently.
  assert.equal(write.written, true);
  assert.equal(write.error, undefined);
  assert.equal(readAudit(root).some((r) => r.itemId === 'RULE-b'), true);
  // 2. It did not fail the command: nothing threw, and `written` is true.
  // 3. It is not silent — but it is also not reported as a LOST RECORD, which
  //    is a different and much worse claim about a user's audit trail.
  assert.equal(readFileSync(auditDbPath(root), 'utf8'), before,
    'a damaged projection was repaired or deleted by an append');
  assert.equal(write.projection?.outcome, 'failed');
  assert.notEqual(write.projection?.error, undefined);
  const note = auditFailureNote(write);
  assert.match(note, /audit PROJECTION could not be updated/);
  assert.match(note, /No record was lost/);
  assert.match(note, /mycontext audit/);
  assert.doesNotMatch(note, /could NOT be written/,
    'the projection failure is wearing the lost-record failure s words');
});

test('keepProjectionCurrent never throws, whatever it is pointed at', (t) => {
  const root = box('nothrow');
  t.after(() => removeTree(root));
  // A directory where the database should be: not missing, not a database, not
  // openable, not removable by anything this path is allowed to do.
  assert.equal(keepProjectionCurrent(path.join(root, 'nope')).outcome, 'unbuilt');
  built(root);
  writeFileSync(auditDbPath(root), '', 'utf8');
  assert.equal(keepProjectionCurrent(root).outcome, 'unbuilt', 'a zero-length file is not damage');
});

// --- the connection this path holds, and what it must not hold on to --------
//
// One write connection per projection is kept open for the life of the process:
// measured, and the alternative was ~10 ms per record on a path that runs on
// every tool call (`core/audit-db.ts` · `interface UpkeepHandle`). A held
// handle is a liability as well as a saving, and these are the two ways it goes
// wrong — both found by running the suite, neither by reading the code.

test('discarding a projection releases the handle this path holds over it', (t) => {
  const root = box('rebuilt');
  t.after(() => removeTree(root));
  built(root);
  recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b',
    at: '2026-08-15T10:00:00.000Z',
  });
  // The upkeep connection is now held over this file. `openProjection` is
  // entitled to discard and rebuild it — that is its documented answer to a
  // version it cannot read — and on Windows an open handle makes `rmSync`
  // silently remove nothing, so `fresh()` would reopen the very database the
  // discard was called to be rid of. Nothing here calls
  // `closeProjectionUpkeep`: what is under test is that `discard()` releases
  // it without being asked.
  const bump = new DatabaseSync(auditDbPath(root));
  bump.exec(`UPDATE audit_meta SET value = '999' WHERE key = 'version'`);
  bump.close();

  const rebuilt = openProjection(root);
  syncProjection(root, rebuilt);
  const version = rebuilt.prepare(`SELECT value FROM audit_meta WHERE key = 'version'`)
    .get() as { value: string };
  rebuilt.close();
  assert.notEqual(version.value, '999', 'the discard did not take — the old database is still here');

  // And the append path picks up the NEW file rather than carrying on writing
  // into the old one, which is the failure the cache is keyed by file identity
  // to prevent: `updated` reported for rows nothing will ever read.
  const write = recordAudit(root, {
    kind: 'mutation', op: 'supersede', origin: 'human', itemId: 'RULE-c',
    at: '2026-08-16T10:00:00.000Z',
  });
  assert.equal(write.projection?.outcome, 'updated');
  raw(root, (db) => {
    assert.equal(projectionState(root, db), 'fresh');
    assert.deepEqual(queryProjection(db, {}).map((r) => r.itemId),
      ['RULE-a', 'RULE-b', 'RULE-c']);
  });
});

test('a diverged projection is not held open — the rebuild that ends it needs the file', (t) => {
  const root = box('divergedhandle');
  t.after(() => removeTree(root));
  built(root);
  recordAudit(root, {
    kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-a', fields: ['body'],
    at: '2026-08-15T10:00:00.000Z',
  });
  const log = auditLogPath(root);
  const lines = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
  writeFileSync(log, `${lines.slice(0, 1).join('\n')}\n`, 'utf8');

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-c',
    at: '2026-08-16T10:00:00.000Z',
  });
  assert.equal(write.projection?.outcome, 'diverged');

  // Repairing a divergence is a rebuild and belongs to `mycontext audit`, in
  // another process. A connection held here would pin the file that rebuild
  // has to discard — this path holding the door shut on its own remedy.
  //
  // Asserted as a REMOVE that succeeds, which is a real assertion on Windows
  // (an open handle makes `rmSync` raise `EPERM`, which is how the same problem
  // was found on two other tests) and a vacuous one on POSIX, where unlinking
  // an open file is legal. Said plainly rather than dressed up: on POSIX this
  // is a smoke test, and the property it names is checked on Windows.
  rmSync(auditDbPath(root), { maxRetries: 20, retryDelay: 25 });
  assert.equal(existsSync(auditDbPath(root)), false);
});

// --- catching up, and rotation ----------------------------------------------

test('an append catches up whatever the log got ahead by, by appending and never rebuilding', (t) => {
  const root = box('catchup');
  t.after(() => removeTree(root));
  built(root);

  // The log ahead of its projection by forty records — an older build, a log
  // copied in, or a run of appends whose upkeep failed. The catch-up must be
  // the APPEND half of a sync, so the rows already there keep their seq.
  for (let i = 0; i < 40; i++) {
    appendUnprojected(root, {
      kind: 'hook', op: 'deny', sessionId: 's4', hook: 'PreToolUse', path: `items/${i}.md`,
      at: `2026-08-15T10:00:${String(i).padStart(2, '0')}.000Z`,
    });
  }
  const seqBefore = raw(root, (db) =>
    db.prepare('SELECT seq FROM audit ORDER BY seq').all() as { seq: number }[]);

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'AFTER-a',
    at: '2026-08-16T10:00:00.000Z',
  });
  assert.equal(write.projection?.outcome, 'updated');
  assert.equal(write.projection?.applied, 41, 'the forty it was behind by, plus its own');

  raw(root, (db) => {
    assert.equal(projectionState(root, db), 'fresh');
    assert.deepEqual(queryProjection(db, {}), filterAudit(readAudit(root), {}));
    const seqAfter = db.prepare('SELECT seq FROM audit ORDER BY seq LIMIT ?')
      .all(seqBefore.length) as { seq: number }[];
    assert.deepEqual(seqAfter, seqBefore,
      'the existing rows moved, so this was a rebuild wearing an append s name');
  });
});

test('a rotation this process performed carries the projection across it', (t) => {
  const root = box('rotate');
  t.after(() => removeTree(root));
  built(root);
  const file = auditLogPath(root);

  // Past the 8 MiB cap, so the next `recordAudit` renames this file to a dated
  // segment and starts a fresh one. Written through the log rather than
  // through `recordAudit` so the fill is one write, not 30,000 projections.
  const filler = `${JSON.stringify({
    protocol: AUDIT_PROTOCOL, at: '2026-08-15T00:00:00.000Z', kind: 'hook', op: 'deny',
  })}\n`;
  while (statSync(file).size < AUDIT_MAX_BYTES) appendFileSync(file, filler.repeat(4000), 'utf8');
  const rotatedSize = statSync(file).size;
  const db0 = openProjection(root);
  syncProjection(root, db0);
  db0.close();

  const write = recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'AFTER-a',
    at: '2026-08-16T10:00:00.000Z',
  });

  const segments = auditSegments(root);
  assert.equal(segments.length, 2, 'the log did not rotate, so this test proves nothing');
  const [rotated, live] = segments as [string, string];
  assert.equal(live, file);
  assert.equal(statSync(rotated).size, rotatedSize);

  // **The rename is followed rather than treated as a divergence.** Without
  // that, every 8 MiB of log diverges the projection by its own writer's hand
  // and leaves it there until someone runs `mycontext audit`.
  assert.equal(write.projection?.outcome, 'updated');
  assert.equal(write.projection?.applied, 1, 'a rotation must not re-consume the renamed bytes');
  raw(root, (db) => {
    assert.equal(projectionState(root, db), 'fresh');
    const sources = db.prepare('SELECT file, bytes FROM audit_source ORDER BY file')
      .all() as { file: string; bytes: number }[];
    assert.deepEqual(sources.map((r) => r.file).sort(), [live, rotated].sort());
    assert.equal(sources.find((r) => r.file === rotated)?.bytes, rotatedSize,
      'the offset did not travel with the bytes, so the next sync re-reads or skips them');
    // Provenance follows the bytes too: no row may name a path that is gone.
    const srcs = db.prepare('SELECT DISTINCT src FROM audit').all() as { src: string }[];
    for (const row of srcs) assert.equal(existsSync(row.src), true, `${row.src} no longer exists`);
    assert.deepEqual(queryProjection(db, { op: 'create' }).map((r) => r.itemId),
      ['RULE-a', 'AFTER-a']);
  });
});
