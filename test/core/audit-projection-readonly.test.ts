import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import {
  auditDbPath, openProjection, openProjectionReadOnlyChecked, projectionIsReadOnly,
  ProjectionAbsentError, ProjectionStaleError, queryProjection, sessions, summaryByOp,
  syncProjection, topItems,
} from '../../src/core/audit-db.ts';
import {
  AUDIT_PROTOCOL, auditDir, auditLogPath, recordAudit,
} from '../../src/core/audit.ts';
import { appendJsonlLine } from '../../src/core/jsonl-log.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `openProjectionReadOnlyChecked` exists BECAUSE it cannot write, so every
 * claim here is asserted of the ENGINE or of the BYTES on disk — never of the
 * fact that `{ readOnly: true }` was passed on the way in.
 *
 * The defect it closes is the second half of the v2 expert-review addendum
 * §2.3: `/api/ask/audit` calls `syncProjection`, `syncProjection` needs a
 * handle from `openProjection`, and `openProjection` creates the file, execs
 * the schema on every open, and `rmSync`s the database plus both sidecars on a
 * version mismatch or any failure. A GET could delete and rebuild a database.
 */

function box(name: string): string {
  return mkdtempSync(path.join(tmpdir(), `myctx-projro-${name}-`));
}

/**
 * The error a call threw. `assert.throws` returns `undefined`, so it cannot
 * hand the error back for the class comparisons these tests turn on.
 */
function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new assert.AssertionError({ message: 'expected a throw, and nothing was thrown' });
}

/** Records that exercise every column `queryProjection` filters on. */
function seed(root: string): void {
  recordAudit(root, {
    kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a',
    at: '2026-08-14T10:00:00.000Z',
  });
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
    at: '2026-08-15T11:00:00.000Z',
    injected: [{ id: 'RULE-a', tier: 'pinned' }],
    spilled: [{ id: 'RULE-d', tier: 'pinned', reason: 'budget exceeded (900 > 800)' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's2', hook: 'PreToolUse', path: 'src/db/w.ts',
    at: '2026-08-16T10:00:00.000Z',
    injected: [{ id: 'RULE-b', tier: 'jit' }],
  });
}

/** A corpus whose projection is built and current — what a read path wants. */
function built(root: string): void {
  const db = openProjection(root);
  syncProjection(root, db);
  db.close();
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

/** Every read the projection exports, so a sweep is a sweep and not a sample. */
function sweep(db: DatabaseSync): void {
  queryProjection(db, {});
  queryProjection(db, { kind: 'injection' });
  queryProjection(db, { op: 'jit' });
  queryProjection(db, { origin: 'human' });
  queryProjection(db, { sessionId: 's2' });
  queryProjection(db, { itemId: 'RULE-d' });
  queryProjection(db, { since: '2026-08-15T00:00:00.000Z', until: '2026-08-17T00:00:00.000Z' });
  queryProjection(db, { limit: 2 });
  summaryByOp(db, {});
  topItems(db, null, 10);
  topItems(db, 'spilled', 10);
  sessions(db, 10);
}

test('a healthy projection is served, and the ENGINE refuses every write through it', (t) => {
  const root = box('ok');
  t.after(() => removeTree(root));
  seed(root);
  built(root);

  const db = openProjectionReadOnlyChecked(root);
  try {
    // It really is a working projection: the reads answer, and answer right.
    assert.equal(queryProjection(db, {}).length, 3);
    assert.deepEqual(queryProjection(db, { op: 'jit' }).map((r) => r.sessionId), ['s2']);
    assert.deepEqual(queryProjection(db, { origin: 'human' }).map((r) => r.itemId), ['RULE-a']);
    // `RULE-d` was only ever SPILLED — it appears in no record's `itemId`, so
    // this answer exists only if `audit_item` is intact and joined.
    assert.equal(queryProjection(db, { itemId: 'RULE-d' }).length, 1);
    assert.deepEqual(sessions(db, 10).map((r) => r.label), ['s2', 's1']);
    assert.deepEqual(topItems(db, 'spilled', 10).map((r) => r.label), ['RULE-d']);

    // Asked of the engine, not of how the connection was opened.
    assert.equal(projectionIsReadOnly(db), true);

    // And asked again through the statements a caller could actually reach:
    // every one refused by SQLite itself.
    for (const sql of [
      `INSERT INTO audit (src, rec) VALUES ('x.jsonl', jsonb('{}'))`,
      'DELETE FROM audit',
      'DELETE FROM audit_item',
      `INSERT INTO audit_source (file, bytes, records) VALUES ('x.jsonl', 1, 1)`,
      `UPDATE audit_meta SET value = '99' WHERE key = 'version'`,
      'DROP TABLE audit_item',
      'CREATE TABLE smuggled (x)',
    ]) {
      assert.throws(() => db.exec(sql), /readonly|read-only/i, `not refused: ${sql}`);
    }
  } finally {
    db.close();
  }

  // Nothing above landed: a writable reopen sees exactly the built state.
  const check = openProjection(root);
  assert.equal(queryProjection(check, {}).length, 3);
  assert.deepEqual(
    (check.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]).map((r) => r.name),
    ['audit', 'audit_item', 'audit_meta', 'audit_source'],
  );
  check.close();
});

test('projectionIsReadOnly can actually fail — it is false on a writable connection, and leaves no probe behind', (t) => {
  const root = box('probe');
  t.after(() => removeTree(root));
  seed(root);

  // Without this the `true` above could be a checker that can never fail:
  // a probe that always reported "refused" would look identical.
  const db = openProjection(root);
  syncProjection(root, db);
  assert.equal(projectionIsReadOnly(db), false, 'a writable connection must NOT report read-only');
  // The probe is rolled back, so it is side-effect-free — verified by
  // execution rather than by reading the rollback.
  assert.deepEqual(
    (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all() as { name: string }[]).map((r) => r.name),
    ['audit', 'audit_item', 'audit_meta', 'audit_source'],
  );
  db.close();
});

test('an absent projection is an EMPTY STATE, and the read door builds nothing — no db, no .audit', (t) => {
  const root = box('absent');
  t.after(() => removeTree(root));

  // Nothing at all: no `.audit` directory either. `openProjection` would call
  // `ensureLogDir` and create both, which is the whole reason this door exists.
  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionAbsentError, true,
    `got ${err.constructor.name}: ${err.message}`);
  assert.match(err.message, /has never been built/);
  assert.equal(existsSync(auditDir(root)), false, 'a read must not conjure the .audit directory');
  assert.equal(existsSync(auditDbPath(root)), false);
  assert.equal(existsSync(`${auditDbPath(root)}-wal`), false);
  assert.equal(existsSync(`${auditDbPath(root)}-shm`), false);

  // And the realistic shape of the same state: a corpus with a live audit log
  // that nobody has ever run `mycontext audit` against.
  seed(root);
  assert.equal(existsSync(auditLogPath(root)), true);
  const err2 = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err2 instanceof ProjectionAbsentError, true);
  assert.equal(existsSync(auditDbPath(root)), false,
    'a GET may not create the projection for a corpus that has a log but no index');
});

test('a projection BEHIND the log is disclosed, not caught up — the bytes prove it was not touched', (t) => {
  const root = box('behind');
  t.after(() => removeTree(root));
  seed(root);
  built(root);

  const file = auditDbPath(root);
  // Both writable handles are closed, so the WAL is checkpointed away — the
  // state a read path actually finds on disk.
  assert.equal(existsSync(`${file}-wal`), false);
  const before = sha256(file);
  const mtimeBefore = statSync(file).mtimeMs;

  // **Appended around `recordAudit`, on purpose.** `recordAudit` keeps the
  // projection current now (`core/audit-db.ts` · `keepProjectionCurrent`), so
  // it no longer manufactures this state — which is the point of that change
  // and not a reason to stop testing this one. `behind` is still reachable and
  // must still be refused: a record appended by a build older than that change,
  // a log copied in from elsewhere, an append whose upkeep returned `failed`,
  // or a projection left behind by a `diverged` this path may not repair. This
  // writes the line the way all of those leave it — in the log, not in the
  // projection.
  appendJsonlLine(auditDir(root), auditLogPath(root), {
    protocol: AUDIT_PROTOCOL, at: '2026-08-17T10:00:00.000Z',
    kind: 'mutation', op: 'update', origin: 'agent', itemId: 'RULE-b', fields: ['body'],
  });

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionStaleError, true,
    `got ${err.constructor.name}: ${err.message}`);
  assert.equal((err as ProjectionStaleError).state, 'behind',
    'the state is on the error so a caller reports WHICH staleness without re-deriving it');
  assert.match(err.message, /the log has grown/);
  assert.match(err.message, /is a WRITE/);

  // Owner ruling C1, asserted against the disk rather than the intent: the
  // projection was neither synced nor rebuilt.
  assert.equal(sha256(file), before, 'a refused read must leave the projection byte-identical');
  assert.equal(statSync(file).mtimeMs, mtimeBefore);
  const raw = new DatabaseSync(file, { readOnly: true });
  assert.equal(queryProjection(raw, {}).length, 3, 'the fourth record must NOT have been absorbed');
  raw.close();
});

test('a DIVERGED projection is disclosed as diverged, and its rows are not deleted', (t) => {
  const root = box('diverged');
  t.after(() => removeTree(root));
  seed(root);
  built(root);

  const file = auditDbPath(root);
  const before = sha256(file);

  // Truncating an append-only log cannot be an append. `syncProjection` answers
  // this by DELETEing every row and rebuilding; a read may not.
  const log = auditLogPath(root);
  const lines = readFileSync(log, 'utf8').split('\n').filter((l) => l !== '');
  writeFileSync(log, `${lines.slice(0, 1).join('\n')}\n`, 'utf8');

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionStaleError, true);
  assert.equal((err as ProjectionStaleError).state, 'diverged',
    'diverged is not "worse behind" — a screen that collapses them loses the interesting half');
  assert.match(err.message, /shrank or vanished/);

  assert.equal(sha256(file), before, 'the rebuild `syncProjection` would have done must not happen');
  const raw = new DatabaseSync(file, { readOnly: true });
  assert.equal(queryProjection(raw, {}).length, 3, 'no row may be deleted by a read');
  raw.close();
});

test('the never-built empty state and a damaged file are NEVER the same verdict', (t) => {
  const root = box('apart');
  t.after(() => removeTree(root));

  const absentRoot = path.join(root, 'absent');
  const corruptRoot = path.join(root, 'corrupt');
  const emptyRoot = path.join(root, 'empty');
  for (const r of [corruptRoot, emptyRoot]) seed(r); // creates .audit/
  writeFileSync(auditDbPath(corruptRoot), 'not a sqlite database at all', 'utf8');
  writeFileSync(auditDbPath(emptyRoot), '', 'utf8');

  const absentErr = thrown(() => openProjectionReadOnlyChecked(absentRoot));
  const corruptErr = thrown(() => openProjectionReadOnlyChecked(corruptRoot));
  const emptyErr = thrown(() => openProjectionReadOnlyChecked(emptyRoot));

  assert.equal(absentErr instanceof ProjectionAbsentError, true);
  assert.equal(corruptErr instanceof ProjectionAbsentError, false,
    'a corrupt projection must never be reported as one that was simply never built');
  // A zero-length file is a VALID empty SQLite database — it opens, and
  // `sqlite_master` is simply empty (measured: `page_count` is 0) — so "no
  // tables" ALONE would have reported a file truncated to nothing as the
  // never-built state.
  assert.equal(emptyErr instanceof ProjectionAbsentError, false,
    'a truncated projection must never be reported as one that was simply never built');
  assert.match(emptyErr.message, /no database pages at all/);
  // Nor is either of them stale: damage is not a staleness a sync would fix.
  assert.equal(corruptErr instanceof ProjectionStaleError, false);
  assert.equal(emptyErr instanceof ProjectionStaleError, false);
});

test('a corrupt projection is reported and NOT discarded — the rmSync belongs to writers', (t) => {
  const root = box('corrupt');
  t.after(() => removeTree(root));
  seed(root);
  const file = auditDbPath(root);
  writeFileSync(file, 'this is not a database', 'utf8');

  assert.throws(() => openProjectionReadOnlyChecked(root));
  // `openProjection`'s `discard()` deletes the file and both sidecars, then
  // rebuilds. A read door must leave every one of them as it found them.
  assert.equal(readFileSync(file, 'utf8'), 'this is not a database');
  assert.equal(existsSync(`${file}-wal`), false);
  assert.equal(existsSync(`${file}-shm`), false);

  // And the handle was closed before the throw escaped: on Windows an open
  // handle PINS the file, so a leaked one makes this `rmSync` fail with EPERM.
  rmSync(file);
  assert.equal(existsSync(file), false);
});

test('half a projection is damage — the four tables are created together, so a subset is not a partial build', (t) => {
  const root = box('half');
  t.after(() => removeTree(root));
  seed(root);
  built(root);

  const db = new DatabaseSync(auditDbPath(root));
  db.exec('DROP TABLE audit_item');
  db.close();

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionAbsentError, false);
  assert.equal(err instanceof ProjectionStaleError, false);
  assert.match(err.message, /is missing audit_item/);
});

test('a lost VIRTUAL column is refused — and pragma_table_info cannot see it, which is why xinfo is used', (t) => {
  const root = box('virtual');
  t.after(() => removeTree(root));
  seed(root);
  built(root);
  const file = auditDbPath(root);

  const db = new DatabaseSync(file);
  // `origin` is a generated column with no index over it, so SQLite lets it
  // go. `queryProjection`'s `filter.origin` reads it, so losing it silently
  // breaks a filter.
  db.exec('ALTER TABLE audit DROP COLUMN origin');
  // THE POINT OF THIS TEST, asserted rather than argued: the pragma the ledger
  // door uses is blind to the damage. A shape check built on `table_info`
  // would have been green here — a checker that could never fail for six of
  // the seven columns every filter reads.
  assert.deepEqual(
    (db.prepare('SELECT name FROM pragma_table_info(?)').all('audit') as { name: string }[])
      .map((r) => r.name),
    ['seq', 'src', 'rec'],
    'pragma_table_info sees the same three columns before and after the drop',
  );
  assert.equal(
    (db.prepare('SELECT name FROM pragma_table_xinfo(?)').all('audit') as { name: string }[])
      .some((r) => r.name === 'origin'),
    false,
    'pragma_table_xinfo is the one that notices',
  );
  db.close();

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionAbsentError, false);
  assert.equal(err instanceof ProjectionStaleError, false);
  assert.match(err.message, /never migrates a projection into shape/);
  assert.match(err.message, /session_id, src/, 'the message shows the shape it actually found');
});

test('an extra column is refused too — a column this build does not read is a different writer', (t) => {
  const root = box('extra');
  t.after(() => removeTree(root));
  seed(root);
  built(root);

  const db = new DatabaseSync(auditDbPath(root));
  db.exec('ALTER TABLE audit_item ADD COLUMN note TEXT');
  db.close();

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionAbsentError, false);
  assert.match(err.message, /audit_item\(/);
  assert.match(err.message, /note/);
});

test('a projection version this build does not read is refused, in EITHER direction', (t) => {
  const root = box('version');
  t.after(() => removeTree(root));
  seed(root);
  built(root);
  const file = auditDbPath(root);

  for (const stamped of ['2', '0']) {
    const db = new DatabaseSync(file);
    db.exec(`UPDATE audit_meta SET value = '${stamped}' WHERE key = 'version'`);
    db.close();

    const err = thrown(() => openProjectionReadOnlyChecked(root));
    assert.equal(err instanceof ProjectionAbsentError, false);
    assert.equal(err instanceof ProjectionStaleError, false);
    assert.match(err.message, new RegExp(`projection version ${stamped} `));
    assert.match(err.message, /never migrate/);
  }
});

test('an unstamped projection is served only when it has consumed nothing — the pair syncProjection actually produces', (t) => {
  const root = box('unstamped');
  t.after(() => removeTree(root));

  // Half one: a workspace where `mycontext audit` ran before any hook fired.
  // `syncProjection` returns at `state === 'fresh'` BEFORE stamping
  // `audit_meta`, so this correct, current projection carries no version row.
  // Refusing it would report an up-to-date projection as damage.
  built(root);
  const db = openProjectionReadOnlyChecked(root);
  try {
    assert.equal(
      (db.prepare('SELECT COUNT(*) AS n FROM audit_meta').get() as { n: number }).n, 0,
      'this test is only meaningful while the empty-log sync really does leave no stamp',
    );
    assert.deepEqual(queryProjection(db, {}), []);
  } finally {
    db.close();
  }

  // Half two: rows without a stamp. `syncProjection` writes both in one
  // transaction, so this was not written by it, and provenance is exactly what
  // a version exists to establish.
  seed(root);
  built(root);
  const w = new DatabaseSync(auditDbPath(root));
  w.exec(`DELETE FROM audit_meta WHERE key = 'version'`);
  w.close();

  const err = thrown(() => openProjectionReadOnlyChecked(root));
  assert.equal(err instanceof ProjectionAbsentError, false);
  assert.equal(err instanceof ProjectionStaleError, false);
  assert.match(err.message, /consumed 1 segment\(s\) but carries no/);
});

test('a full read sweep leaves the projection byte-identical; the sidecars it creates are not the projection', (t) => {
  const root = box('bytes');
  t.after(() => removeTree(root));
  seed(root);
  built(root);
  const file = auditDbPath(root);
  assert.equal(existsSync(`${file}-wal`), false, 'the writable close checkpointed the WAL away');

  const before = sha256(file);
  const mtimeBefore = statSync(file).mtimeMs;
  const sizeBefore = statSync(file).size;

  const db = openProjectionReadOnlyChecked(root);
  sweep(db);
  db.close();

  assert.equal(sha256(file), before, 'the projection must be byte-identical after a read sweep');
  assert.equal(statSync(file).size, sizeBefore);
  assert.equal(statSync(file).mtimeMs, mtimeBefore,
    'and untouched by mtime, not merely equal in content');

  // MEASURED, not assumed — and the measurement is why a no-write assertion
  // must lean on the MAIN file rather than on the sidecars.
  // `Store.openReadOnlyChecked` says a read-only open creates "empty
  // `-shm`/`-wal` sidecars"; only `-wal` is empty. `-shm` is a 32 KiB
  // shared-memory WAL index (32768 bytes here, on every one of three
  // consecutive open/close cycles against this projection, matching what the
  // ledger door measured against `.index.db`).
  assert.equal(existsSync(`${file}-wal`), true, 'the read-only open creates a -wal sidecar');
  assert.equal(statSync(`${file}-wal`).size, 0, 'and it is empty');
  assert.equal(existsSync(`${file}-shm`), true, 'and a -shm sidecar');
  assert.ok(statSync(`${file}-shm`).size > 0,
    'which is NOT empty — it is the shared-memory WAL index, measured at 32768 bytes');
});

test('there is no unchecked read-only door — the checked one never needed it as a step', async () => {
  // A DECISION test, the one `ledger.ts` also carries. `Store` exports both
  // `openReadOnly` and `openReadOnlyChecked` because two call sites genuinely
  // want the unchecked one; nothing wants an unchecked projection open, and an
  // exported door that skips the check is a hole in an API whose entire
  // purpose is that it cannot write. If a caller ever needs one, this is where
  // the decision gets re-argued rather than quietly reversed.
  const surface = await import('../../src/core/audit-db.ts') as unknown as
    Record<string, unknown>;
  assert.equal(typeof surface.openProjectionReadOnlyChecked, 'function');
  assert.equal(surface.openProjectionReadOnly, undefined);
});

test('the read door contains no write, and openProjection contains every one of them', () => {
  // `openProjectionReadOnlyChecked` returns a bare `DatabaseSync`, so there is
  // no wrapper to interrogate for "did you set a busy_timeout" or "did you exec
  // the schema". The decisions are pinned at the source instead, the way
  // `no-bare-rmsync.test.ts` pins its rule and `ledger-readonly.test.ts` pins
  // the busy_timeout one.
  const source = readFileSync(new URL('../../src/core/audit-db.ts', import.meta.url), 'utf8');

  const slice = (signature: string): string => {
    const start = source.indexOf(signature);
    assert.ok(start > 0, `${signature} must be findable in the source`);
    const end = source.indexOf('\n/**', start);
    assert.ok(end > start, 'the function body must be delimited by the next doc comment');
    return source.slice(start, end);
  };

  const door = slice('export function openProjectionReadOnlyChecked(');
  const writer = slice('export function openProjection(root: string): DatabaseSync {');

  // Each of these is one of the writes `openProjection` performs on every
  // call, and every one of them must be absent from the door.
  const writes: [string, RegExp][] = [
    ['rmSync — the discard that deletes the database and both sidecars', /rmSync/],
    ['ensureLogDir — creating the .audit directory', /ensureLogDir/],
    ['exec(SCHEMA) — four CREATE TABLE and six CREATE INDEX', /SCHEMA/],
    ['journal_mode — a write to the database header', /journal_mode/],
    // A read-only connection takes no write lock, so it has nothing to wait
    // for; `Store.openReadOnlyChecked` sets none over 18,300 contended trials.
    ['busy_timeout — a write-path knob', /busy_timeout/],
  ];
  for (const [what, pattern] of writes) {
    assert.equal(pattern.test(door), false, `the read door must not contain ${what}`);
    // And the check is discriminating rather than vacuously green: the writable
    // open, which DOES all of them, is found by the same slicing. If this half
    // goes red the slicing is broken, not the decision.
    assert.equal(pattern.test(writer), true, `openProjection must still contain ${what}`);
  }

  // The ruling itself: the door must not be able to reach the sync either.
  assert.equal(/syncProjection\(/.test(door), false,
    'a read may not bring the projection up to date — that is the write ruling C1 forbids');
});
