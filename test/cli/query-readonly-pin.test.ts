/**
 * The structural pin on `query`'s read-only connection.
 *
 * **The behavioural route is a proven dead end, and it was re-proved before
 * this file was written.** Replace `Store.openReadOnly(ws.dbPath)` in
 * `cmdQuery` with `Store.open(ws.dbPath)` and the entire suite stays green,
 * because the only SQL that ever reaches that connection has already passed
 * `assertSelectOnly` — and a statement that passes `assertSelectOnly` does not
 * write to the tables in `dbPath` on this engine whether the connection is
 * read-only or not. There is no query you can send through `mycontext query`
 * whose OUTPUT differs between the two connections. That is precisely why the
 * mutant was invisible: the boundary is real, and its effect is unobservable
 * from outside.
 *
 * So it is pinned structurally instead. `Store.openReadOnly` is spied in
 * process, and the assertions are made about the connection `cmdQuery` itself
 * opened, reached through `runCli` rather than by re-implementing the command:
 *
 *   1. `cmdQuery` opens the read-only connection at all — swap it for
 *      `Store.open` and the spy records nothing.
 *   2. That connection is genuinely refused a write lock by the engine —
 *      change `openReadOnly`'s body to hand back a writable connection and the
 *      spy's own recording flips, even though the command's output does not.
 *
 * **What this does NOT claim.** Neither the connection nor this test makes
 * `query` incapable of writing anything anywhere: `VACUUM INTO '<path>'` runs
 * fine on a `{ readOnly: true }` connection and writes a full copy of the
 * database wherever it is told (see `test/core/store-readonly.test.ts`).
 * `assertSelectOnly` is the only barrier for that one statement. The boundary
 * here is a statement denylist plus a read-only connection, and this file pins
 * the second half of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-roquery-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', '--summary-omitted', 'lesson', 'Migrations need locks'], cwd, () => {});
  return cwd;
}

interface Spied {
  /** One entry per `Store.openReadOnly` call, holding what the engine said of it. */
  readOnly: boolean[];
  code: number;
  out: string;
}

/**
 * Runs `mycontext <args>` with `Store.openReadOnly` wrapped, and reports what
 * the command's own connection turned out to be.
 *
 * `isReadOnly` is asked immediately after the open and before the command uses
 * the connection, so the answer describes the connection `cmdQuery` will
 * actually read through — not one reconstructed afterwards from the same path.
 */
function spyRun(args: string[], cwd: string): Spied {
  const original = Store.openReadOnly;
  const readOnly: boolean[] = [];
  let out = '';
  let code: number;
  try {
    Store.openReadOnly = (dbPath: string): Store => {
      const store = original.call(Store, dbPath);
      readOnly.push(store.isReadOnly);
      return store;
    };
    code = runCli(args, cwd, (s) => { out += s + '\n'; });
  } finally {
    Store.openReadOnly = original;
  }
  return { readOnly, code, out };
}

test('query reads through Store.openReadOnly, and the engine refuses that connection a write lock', () => {
  const cwd = project();
  try {
    const result = spyRun(['query', 'SELECT id FROM items ORDER BY id'], cwd);

    assert.equal(result.code, 0, result.out);
    assert.match(result.out, /LESSON-migrations-need-locks/, 'the command really ran and returned rows');
    assert.deepEqual(
      result.readOnly, [true],
      'cmdQuery must open exactly one connection through Store.openReadOnly, and the engine ' +
      'must refuse that connection a write lock. Got ' + JSON.stringify(result.readOnly) + ' — ' +
      '[] means the read-only open was bypassed; [false] means openReadOnly handed back a ' +
      'connection that can write.',
    );
  } finally { removeTree(cwd); }
});

test('the same holds on the --json path, which is the one an agent reads', () => {
  const cwd = project();
  try {
    const result = spyRun(['query', '--json', 'SELECT COUNT(*) AS n FROM items'], cwd);
    assert.equal(result.code, 0, result.out);
    assert.deepEqual(result.readOnly, [true]);
  } finally { removeTree(cwd); }
});

/**
 * The refusal paths must not leave a connection open behind them either — a
 * query rejected before the open is a query that never reached the boundary,
 * and if one ever did open a connection first, this is where that would show.
 */
test('a refused query opens no read-only connection at all', () => {
  const cwd = project();
  try {
    const denied = spyRun(['query', 'SELECT id FROM items WHERE 1=1; DELETE FROM items'], cwd);
    assert.equal(denied.code, 1);
    assert.match(denied.out, /exactly one statement/);
    assert.deepEqual(denied.readOnly, []);

    const notSelect = spyRun(['query', 'DELETE FROM items'], cwd);
    assert.equal(notSelect.code, 1);
    assert.match(notSelect.out, /read-only/);
    assert.deepEqual(notSelect.readOnly, []);
  } finally { removeTree(cwd); }
});

/**
 * `isReadOnly` is the thing the pin above rests on, so it is checked against
 * both kinds of connection directly. If it answered `true` unconditionally the
 * pin above would pass with the mechanism gone.
 */
test('isReadOnly separates the two kinds of connection, and writes nothing either way', () => {
  const cwd = project();
  try {
    const dbPath = path.join(cwd, '.my_context', '.index.db');

    const writable = Store.open(dbPath);
    const idsBefore = writable.ids();
    assert.equal(writable.isReadOnly, false, 'a normal connection can take a write lock');
    assert.deepEqual(writable.ids(), idsBefore, 'and asking must not have changed anything');
    writable.close();

    const readonly = Store.openReadOnly(dbPath);
    assert.equal(readonly.isReadOnly, true);
    assert.deepEqual(readonly.ids(), idsBefore, 'the probe left the data readable and intact');
    readonly.close();

    // The probe rolled its transaction back rather than leaving one open: a
    // second writable connection can still take the lock.
    const after = Store.open(dbPath);
    assert.equal(after.isReadOnly, false);
    after.close();
  } finally { removeTree(cwd); }
});
