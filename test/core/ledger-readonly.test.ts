import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Ledger, LedgerUninitializedError } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `Ledger.openReadOnlyChecked` is security-adjacent: its whole purpose is that
 * it cannot write. So every claim here is asserted of the ENGINE or of the
 * BYTES on disk, never of the fact that `{ readOnly: true }` was passed.
 */

function fixture(name: string): { dir: string; dbPath: string } {
  const dir = mkdtempSync(join(tmpdir(), `myctx-ledro-${name}-`));
  return { dir, dbPath: join(dir, '.index.db') };
}

/**
 * The error a call threw. `assert.throws` returns `undefined`, so it cannot
 * hand the error back for the class comparison these tests turn on.
 */
function thrown(fn: () => unknown): Error {
  try {
    fn();
  } catch (err) {
    return err as Error;
  }
  throw new assert.AssertionError({ message: 'expected a throw, and nothing was thrown' });
}

/** A corpus a hook has injected into: Store schema, ledger tables, rows. */
function seeded(dbPath: string): void {
  const store = Store.open(dbPath);
  const ledger = Ledger.open(dbPath);
  ledger.record('s1', 'CONST-a', 'jit', '2026-08-01T10:00:00.000Z');
  ledger.setSourceBytes('audit-2026-08.jsonl', 42);
  ledger.close();
  store.close();
}

/** A fresh corpus: `Store.open` has run, no hook ever has. No ledger tables. */
function storeOnly(dbPath: string): void {
  Store.open(dbPath).close();
}

function sha256(file: string): string {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

test('openReadOnlyChecked serves a seeded corpus, and the ENGINE refuses every write through it', (t) => {
  const { dir, dbPath } = fixture('ok');
  t.after(() => removeTree(dir));
  seeded(dbPath);

  const ledger = Ledger.openReadOnlyChecked(dbPath);
  try {
    // It really is a working ledger: the reads answer, and answer correctly.
    assert.deepEqual(ledger.seen('s1'), ['CONST-a']);
    assert.equal(ledger.sessionCount(), 1);
    assert.equal(ledger.history().length, 1);
    assert.equal(ledger.sourceBytes('audit-2026-08.jsonl'), 42);

    // Asked of the engine, not of how the connection was opened.
    assert.equal(ledger.isReadOnly, true);

    // And asked again through the class's OWN writes, which are what a caller
    // could actually reach: each must be refused by SQLite itself.
    assert.throws(() => ledger.record('s2', 'CONST-b', 'jit'), /readonly|read-only/i);
    assert.throws(() => ledger.recordMany('s2', ['CONST-b'], 'jit'), /readonly|read-only/i);
    assert.throws(() => ledger.recordRestored('s2', ['CONST-b']), /readonly|read-only/i);
    assert.throws(() => ledger.setSourceBytes('x.jsonl', 1), /readonly|read-only/i);
    assert.throws(() => ledger.clearForReplay(), /readonly|read-only/i);
  } finally {
    ledger.close();
  }

  // Nothing above landed: the writable reopen sees exactly the seeded state.
  const check = Ledger.open(dbPath);
  assert.deepEqual(check.seen('s1'), ['CONST-a']);
  assert.equal(check.sessionCount(), 1);
  assert.deepEqual(check.sourceFiles(), ['audit-2026-08.jsonl']);
  check.close();
});

test('ledger tables present but empty is READY, not the never-injected state', (t) => {
  const { dir, dbPath } = fixture('emptytables');
  t.after(() => removeTree(dir));
  // A hook has run — the tables exist — but recorded nothing.
  const store = Store.open(dbPath);
  Ledger.open(dbPath).close();
  store.close();

  const ledger = Ledger.openReadOnlyChecked(dbPath);
  try {
    assert.deepEqual(ledger.history(), []);
    assert.equal(ledger.sessionCount(), 0);
    assert.deepEqual(ledger.sourceFiles(), []);
  } finally {
    ledger.close();
  }
});

test('a corpus with no ledger tables is an EMPTY STATE, not a fault — and the door creates none', (t) => {
  const { dir, dbPath } = fixture('fresh');
  t.after(() => removeTree(dir));
  storeOnly(dbPath);

  const before = sha256(dbPath);
  const err = thrown(() => Ledger.openReadOnlyChecked(dbPath));
  // Told apart by CLASS, so no caller has to match on a message — but the
  // message still has to name the state rather than sounding like damage.
  assert.equal(err instanceof LedgerUninitializedError, true, `got ${err.constructor.name}: ${err.message}`);
  assert.match(err.message, /no ledger tables yet/);
  assert.match(err.message, /nothing has ever been injected/);

  // `Ledger.open` would have CREATEd the tables here — that is the whole
  // reason this door exists. Prove it did not, in two independent ways.
  assert.equal(sha256(dbPath), before, 'the read-only open must not write a page');
  const db = new DatabaseSync(dbPath, { readOnly: true });
  const tables = (db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all() as { name: string }[]).map((r) => r.name);
  db.close();
  assert.equal(tables.includes('ledger'), false);
  assert.equal(tables.includes('ledger_source'), false);
});

test('the never-injected empty state and a damaged file are NEVER the same verdict', (t) => {
  const { dir } = fixture('apart');
  t.after(() => removeTree(dir));

  const fresh = join(dir, 'fresh.db');
  storeOnly(fresh);
  const corrupt = join(dir, 'corrupt.db');
  writeFileSync(corrupt, 'not a sqlite database at all', 'utf8');
  const empty = join(dir, 'empty.db');
  writeFileSync(empty, '', 'utf8');

  const freshErr = thrown(() => Ledger.openReadOnlyChecked(fresh));
  const corruptErr = thrown(() => Ledger.openReadOnlyChecked(corrupt));
  const emptyErr = thrown(() => Ledger.openReadOnlyChecked(empty));

  assert.equal(freshErr instanceof LedgerUninitializedError, true);
  assert.equal(corruptErr instanceof LedgerUninitializedError, false,
    'a corrupt file must never be reported as a corpus nobody has injected into');
  // A zero-length file is a VALID empty SQLite database — it opens and
  // `sqlite_master` is simply empty — so "no tables" ALONE would have
  // reported a file truncated to nothing as that same empty state.
  assert.equal(emptyErr instanceof LedgerUninitializedError, false,
    'a truncated file must never be reported as a corpus nobody has injected into');
  assert.match(emptyErr.message, /no database pages at all/);
});

test('half a ledger is damage, not the never-injected empty state', (t) => {
  const { dir, dbPath } = fixture('half');
  t.after(() => removeTree(dir));
  seeded(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec('DROP TABLE ledger_source');
  db.close();

  const err = thrown(() => Ledger.openReadOnlyChecked(dbPath));
  assert.equal(err instanceof LedgerUninitializedError, false);
  assert.match(err.message, /Half a ledger is damage/);
  assert.match(err.message, /ledger_source/);
});

test('a shape this build does not read is refused — the shape is the only version there is', (t) => {
  const { dir, dbPath } = fixture('shape');
  t.after(() => removeTree(dir));
  seeded(dbPath);

  const db = new DatabaseSync(dbPath);
  db.exec('ALTER TABLE ledger ADD COLUMN note TEXT');
  db.close();

  const err = thrown(() => Ledger.openReadOnlyChecked(dbPath));
  assert.equal(err instanceof LedgerUninitializedError, false);
  assert.match(err.message, /no schema_version/);
  assert.match(err.message, /note/);
});

test('a corrupt file throws and is NOT healed — the self-heal belongs to writers', (t) => {
  const { dir, dbPath } = fixture('corrupt');
  t.after(() => removeTree(dir));
  writeFileSync(dbPath, 'this is not a database', 'utf8');

  assert.throws(() => Ledger.openReadOnlyChecked(dbPath));
  assert.equal(readFileSync(dbPath, 'utf8'), 'this is not a database');
  // `Store.open`'s recovery deletes the file and both journals. A read door
  // must leave every one of them exactly as it found them.
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.equal(existsSync(`${dbPath}-shm`), false);
});

test('an absent database throws and is NOT created — the read door has no journal mode to get wrong', (t) => {
  const { dir, dbPath } = fixture('absent');
  t.after(() => removeTree(dir));

  assert.throws(() => Ledger.openReadOnlyChecked(dbPath));
  // `Ledger.open` here would create the file — in rollback-journal mode,
  // which is the second half of the prerequisite this door does not need.
  assert.equal(existsSync(dbPath), false);
  assert.equal(existsSync(`${dbPath}-wal`), false);
  assert.equal(existsSync(`${dbPath}-shm`), false);
});

test('a failed check closes the handle rather than leaking it', (t) => {
  const { dir, dbPath } = fixture('leak');
  t.after(() => removeTree(dir));
  writeFileSync(dbPath, 'this is not a sqlite file', 'utf8');

  assert.throws(() => Ledger.openReadOnlyChecked(dbPath));
  // On Windows an open handle PINS the file, so a leaked one makes this throw
  // EPERM. Deleting the file is the observable form of "the handle was closed
  // before the throw escaped" — the same detector `ledger.test.ts` uses for
  // `Ledger.open` and `open-readonly-checked.test.ts` for `Store`.
  rmSync(dbPath);
  assert.equal(existsSync(dbPath), false);
});

test('a full read sweep leaves the database byte-identical; the sidecars it creates are not the corpus', (t) => {
  const { dir, dbPath } = fixture('bytes');
  t.after(() => removeTree(dir));
  seeded(dbPath);
  // Both writable handles are closed, so the WAL is checkpointed away — the
  // state the UI actually finds on disk.
  assert.equal(existsSync(`${dbPath}-wal`), false);

  const before = sha256(dbPath);
  const mtimeBefore = statSync(dbPath).mtimeMs;
  const sizeBefore = statSync(dbPath).size;

  const ledger = Ledger.openReadOnlyChecked(dbPath);
  ledger.seen('s1');
  ledger.entries('s1');
  ledger.usage('CONST-a');
  ledger.mostUsed(10);
  ledger.allUsage();
  ledger.history();
  ledger.recentSessions(10);
  ledger.sessionSummaries(10);
  ledger.itemsUsedIn(['s1']);
  ledger.sourceBytes('audit-2026-08.jsonl');
  ledger.sourceFiles();
  ledger.sessionCount();
  ledger.close();

  assert.equal(sha256(dbPath), before, 'the main database must be byte-identical after a read sweep');
  assert.equal(statSync(dbPath).size, sizeBefore);
  assert.equal(statSync(dbPath).mtimeMs, mtimeBefore,
    'and untouched by mtime, not merely equal in content');

  // The distinction Task 13's runtime assertion depends on: opening a WAL
  // database read-only DOES create sidecars, and they survive the close. They
  // are not the corpus, and a byte-identical check that swept them in would go
  // red for a read that wrote nothing.
  //
  // MEASURED, not assumed — and the measurement corrects the wording on
  // `Store.openReadOnlyChecked`, which says the read-only open "does create
  // empty `-shm`/`-wal` sidecars". Only `-wal` is empty. `-shm` is a 32 KiB
  // shared-memory WAL index (32768 bytes here, on every one of three
  // consecutive open/close cycles). So "the sidecars are empty" is not the
  // fact a no-write assertion can lean on; "the MAIN file's bytes and mtime
  // are unchanged" — asserted above — is.
  assert.equal(existsSync(`${dbPath}-wal`), true, 'the read-only open creates a -wal sidecar');
  assert.equal(statSync(`${dbPath}-wal`).size, 0, 'and it is empty');
  assert.equal(existsSync(`${dbPath}-shm`), true, 'and a -shm sidecar');
  assert.ok(statSync(`${dbPath}-shm`).size > 0,
    'which is NOT empty — it is the shared-memory WAL index, measured at 32768 bytes');
});

test('there is no unchecked read-only door — the checked one never needed it as a step', () => {
  // A DECISION test. `Store` exports both `openReadOnly` and
  // `openReadOnlyChecked` because two call sites genuinely want the unchecked
  // one (`cmdQuery`, `pre-compact.ts`). Nothing wants an unchecked ledger
  // open, and an exported door that skips the shape check is a hole in an API
  // whose entire purpose is that it cannot write. If a caller ever needs one,
  // this is where the decision gets re-argued rather than quietly reversed.
  const surface = Ledger as unknown as Record<string, unknown>;
  assert.equal(typeof surface.openReadOnlyChecked, 'function');
  assert.equal(surface.openReadOnly, undefined);
});

test('the read door sets no busy_timeout, and does not inherit Ledger.open\'s', () => {
  // `Ledger` exposes no arbitrary-SQL door and `#db` is a real private field,
  // so `PRAGMA busy_timeout` cannot be read back off the connection from a
  // test — widening the class to make it readable would be adding API for a
  // test. The decision is pinned at the source instead, the way
  // `no-bare-rmsync.test.ts` pins its rule.
  //
  // WHY none: a read-only connection takes no write lock, so it has nothing
  // to wait for, and `Store.openReadOnlyChecked` — measured over 18,300
  // contended read-only trials against this same `.index.db`, since `items`
  // and `ledger` share one file — sets none for that reason. `Ledger.open`'s
  // `busyTimeoutMs` is a WRITE-path knob (a hook failing open in ~1s instead
  // of waiting 3s per statement). Copying it here would buy a hang budget
  // that was measured not to be needed, at the cost of the fail-fast property
  // a read door exists to have.
  const source = readFileSync(new URL('../../src/core/ledger.ts', import.meta.url), 'utf8');

  const roStart = source.indexOf('  static openReadOnlyChecked(');
  assert.ok(roStart > 0, 'openReadOnlyChecked must be findable in the source');
  const roEnd = source.indexOf('\n  /**', roStart);
  assert.ok(roEnd > roStart, 'the method body must be delimited by the next doc comment');
  assert.equal(/busy_timeout/i.test(source.slice(roStart, roEnd)), false,
    'openReadOnlyChecked must set no busy_timeout — see the reasoning on the method');

  // And the check is discriminating rather than vacuously green: the writable
  // open, which DOES set one, is found by the same slicing.
  const openStart = source.indexOf('  static open(dbPath: string, busyTimeoutMs');
  assert.ok(openStart > 0, 'Ledger.open must be findable in the source');
  const openEnd = source.indexOf('\n  /**', openStart);
  assert.equal(/busy_timeout/i.test(source.slice(openStart, openEnd)), true,
    'Ledger.open still sets one — if this goes red the slicing is broken, not the decision');
});
