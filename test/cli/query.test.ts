import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { assertSelectOnly } from '../../src/cli/commands/query.ts';
import { removeTree } from '../helpers/tmp.ts';
import { cells, row } from '../helpers/table.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-query-'));
  runCli(['init'], cwd, () => {});
  // `--yes`: `add` gates a normative category behind a confirmation, and
  // stdin is not interactive under `node --test`.
  runCli(['add', 'constraint', 'Pool capped at 20', '--yes'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  return cwd;
}

test('assertSelectOnly accepts SELECT and WITH', () => {
  assertSelectOnly('SELECT * FROM items');
  assertSelectOnly('  select id from items  ');
  assertSelectOnly('WITH t AS (SELECT id FROM items) SELECT * FROM t');
  assertSelectOnly('SELECT * FROM items; ');
});

test('assertSelectOnly rejects every mutating statement, by whichever check fires first', () => {
  // Every one of these STARTS WITH its own forbidden keyword, so the prefix
  // check ("must start with SELECT or WITH") rejects it before the keyword
  // denylist below is ever reached — the name of this test used to imply
  // the denylist was exercised here, and it was not. See the next test for
  // cases that actually reach the denylist scan.
  for (const sql of [
    'DELETE FROM items',
    'UPDATE items SET status = "active"',
    'INSERT INTO items VALUES (1)',
    'DROP TABLE items',
    'CREATE TABLE x (a)',
    'ALTER TABLE items ADD COLUMN x',
    'VACUUM',
    'PRAGMA journal_mode = DELETE',
    'ATTACH DATABASE "other.db" AS other',
  ]) {
    assert.throws(() => assertSelectOnly(sql), /read-only|only SELECT/i, sql);
  }
});

test('assertSelectOnly\'s keyword denylist actually catches a mutating keyword nested inside a SELECT', () => {
  // Each of these starts with SELECT, so it clears the prefix check and the
  // keyword scan is what has to catch it — unlike the previous test, where
  // every case was rejected by the prefix check first and the denylist scan
  // was never reached. One case per FORBIDDEN keyword, so a keyword silently
  // dropped from the list (or a scan that stops early) shows up here.
  for (const keyword of [
    'INSERT INTO items VALUES (1)', 'UPDATE items SET x = 1', 'DELETE FROM items',
    'REPLACE INTO items VALUES (1)', 'DROP TABLE items', 'CREATE TABLE x (a)',
    'ALTER TABLE items ADD COLUMN x', 'TRUNCATE items', 'VACUUM',
    'PRAGMA journal_mode = WAL', 'ATTACH DATABASE \'x.db\' AS o', 'DETACH o',
    'REINDEX', 'ANALYZE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT s', 'RELEASE s',
  ]) {
    const sql = `SELECT * FROM (${keyword})`;
    assert.throws(() => assertSelectOnly(sql), /not allowed/i, sql);
  }
});

test('assertSelectOnly rejects VACUUM INTO, the one FORBIDDEN entry where it — not the read-only connection — is the actual write barrier', () => {
  // `VACUUM INTO '<path>'` writes a full copy of the database to an
  // arbitrary filesystem path. `new DatabaseSync(dbPath, { readOnly: true })`
  // does not stop that (see store-readonly.test.ts) because it never writes
  // to `dbPath` itself — so for this one statement, this function is the
  // whole defense, not a UX layer in front of the engine.
  assert.throws(() => assertSelectOnly("VACUUM INTO 'anywhere.db'"), /only SELECT/i);
  assert.throws(() => assertSelectOnly("SELECT * FROM (VACUUM INTO 'anywhere.db')"), /not allowed/i);
});

test('assertSelectOnly rejects a second statement, whatever it is', () => {
  // These hit the `;` check FIRST, so their message is "pass exactly one
  // statement" — not the read-only message. Asserting /read-only|only SELECT/
  // on them (as an earlier draft did for the BEGIN case) fails against this
  // implementation; each error is asserted where it is actually produced.
  for (const sql of ['SELECT 1; DELETE FROM items', 'BEGIN; DELETE FROM items; COMMIT']) {
    assert.throws(() => assertSelectOnly(sql), /one statement/i, sql);
  }
});

test('a bare BEGIN with no second statement is still refused as not-a-SELECT', () => {
  assert.throws(() => assertSelectOnly('BEGIN'), /only SELECT/i);
});

test('the parser only understands two of SQLite\'s four quoting styles', () => {
  // `strip` removes '…' and "…" but not [bracket] or `backtick` identifiers,
  // both of which SQLite accepts. This is pinned as a KNOWN limitation so a
  // later reader does not mistake silence for coverage — and it is why the
  // read-only connection, not this function, is the security boundary.
  assertSelectOnly('SELECT * FROM items WHERE title = "DELETE FROM items"');
  assert.throws(() => assertSelectOnly('SELECT [delete] FROM items'), /not allowed/i);
});

test('assertSelectOnly is not fooled by a comment or a string literal', () => {
  assert.throws(() => assertSelectOnly('-- harmless\nDELETE FROM items'), /only SELECT/i);
  assert.throws(() => assertSelectOnly('/* SELECT */ DROP TABLE items'), /only SELECT/i);
  assertSelectOnly("SELECT * FROM items WHERE title = 'DELETE FROM items'");
  assertSelectOnly("SELECT * FROM items WHERE title = 'a -- b'");
});

test('assertSelectOnly rejects empty and whitespace-only SQL', () => {
  assert.throws(() => assertSelectOnly('   '), /empty/i);
});

test('query prints an aligned table', () => {
  const cwd = project();
  const { code, out } = run(['query', 'SELECT id, type FROM items ORDER BY id'], cwd);
  assert.equal(code, 0);
  assert.match(out, row('id', 'type'));
  assert.match(out, cells('CONST-pool-capped-at-20', 'constraint'));
  assert.match(out, /2 row/);
  removeTree(cwd);
});

// `--json` is a DOCUMENT, not a bare array of rows, since the row cap landed
// (see test/cli/query-cap-and-flags.test.ts): `truncated` and `loadErrors`
// both have to travel with the rows, and an array has nowhere to put them —
// the same reason `status`, `list`, `review list` and `doctor` all emit a
// document. The rows themselves are unchanged, under `rows`.
test('query --json emits parseable JSON', () => {
  const cwd = project();
  const { out } = run(['query', 'SELECT type, COUNT(*) AS n FROM items GROUP BY type', '--json'], cwd);
  const parsed = JSON.parse(out) as { rows: { type: string; n: number }[]; truncated: boolean };
  assert.equal(parsed.truncated, false);
  assert.deepEqual(parsed.rows.sort((a, b) => a.type.localeCompare(b.type)),
    [{ type: 'constraint', n: 1 }, { type: 'lesson', n: 1 }]);
  removeTree(cwd);
});

test('query refuses to mutate and names the rule', () => {
  const cwd = project();
  const { code, out } = run(['query', 'DELETE FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /only SELECT/i);
  assert.equal(
    (JSON.parse(run(['list', '--json'], cwd).out) as { count: number }).count, 2,
    'nothing was deleted',
  );
  removeTree(cwd);
});

test('a SQL error is reported without a stack trace', () => {
  const cwd = project();
  const { code, out } = run(['query', 'SELECT nope FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /nope/);
  assert.equal(/at Object\./.test(out), false);
  removeTree(cwd);
});

test('a query returning nothing says so', () => {
  const cwd = project();
  const { code, out } = run(['query', "SELECT * FROM items WHERE type = 'adr'"], cwd);
  assert.equal(code, 0);
  assert.match(out, /0 row/);
  removeTree(cwd);
});

test('query reports an unrelated corpus load error, not just a 0 exit code', () => {
  // Regression pin for the F2 gap found in review: `cmdQuery` called
  // `rebuild` but discarded its `errors`, so it exited 0 while printing
  // nothing about a corrupt item elsewhere in the corpus — the exit-code
  // half of F2 without the reporting half.
  const cwd = project();
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');

  const { code, out } = run(['query', 'SELECT id FROM items'], cwd);
  assert.equal(code, 0);
  assert.match(out, /CONST-broken\.md/);
  removeTree(cwd);
});

test('updated_at is index write time, not a Markdown timestamp — two items created seconds apart get identical values, and an unchanged corpus advances every row on the next run', async () => {
  const cwd = project();

  const first = run(['query', 'SELECT id, updated_at FROM items ORDER BY id', '--json'], cwd);
  const firstRows = (JSON.parse(first.out) as { rows: { id: string; updated_at: string }[] }).rows;
  assert.equal(firstRows.length, 2);
  // Both items were created moments apart by `project()`, but every row's
  // updated_at was stamped by the SAME rebuild inside this one `query`
  // invocation, so they read identical rather than reflecting their real
  // creation order.
  assert.equal(firstRows[0].updated_at, firstRows[1].updated_at);

  await new Promise((resolve) => setTimeout(resolve, 1100));

  const second = run(['query', 'SELECT id, updated_at FROM items ORDER BY id', '--json'], cwd);
  const secondRows = (JSON.parse(second.out) as { rows: { id: string; updated_at: string }[] }).rows;
  // Nothing on disk changed between the two `query` calls, yet updated_at
  // advances on every row — it measures when `query` last ran, not when the
  // Markdown last changed.
  assert.notEqual(secondRows[0].updated_at, firstRows[0].updated_at);

  removeTree(cwd);
});

test('query with no SQL prints usage including the schema hint', () => {
  const cwd = project();
  const { code, out } = run(['query'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext query/);
  assert.match(out, /items\(id, type, title, status, always, has_scope, layer, file_path, updated_at, data\)/);
  assert.match(out, /updated_at is INDEX WRITE TIME/);
  removeTree(cwd);
});
