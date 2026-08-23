/**
 * The read-only guard must tell a WRITE STATEMENT apart from a SCALAR FUNCTION
 * that happens to share its name.
 *
 * `replace()` is a SQLite string function. `REPLACE INTO` is SQLite's upsert.
 * The guard scanned for the bare token `REPLACE` and so refused
 * `SELECT replace(title,'a','b') FROM items`, a statement that writes nothing:
 *
 *   my_context: query is read-only — "REPLACE" is not allowed. Use the CLI
 *   commands to change items; the index is rebuilt from Markdown anyway.
 *
 * That refusal is not merely a CLI annoyance. `DEC-the-ask-screen-accepts-typed-
 * sql-reversing-shown-never-typed` rules that the web Ask screen will accept
 * typed SQL and MUST reuse this guard rather than grow a second one, so every
 * false positive here becomes a refusal a reader meets in a browser.
 *
 * The relaxation is deliberately the narrowest one that fixes it: a FORBIDDEN
 * keyword is still refused everywhere EXCEPT when it is immediately applied as
 * a function call (`name (`). No SQLite write statement has that shape —
 * `REPLACE` in statement position is always followed by `INTO` — so the write
 * forms below must all still be refused. Half this file exists to prove that:
 * a guard that admits a write is far worse than one that refuses a function.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { assertSelectOnly } from '../../src/cli/commands/query.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-guardfn-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  return cwd;
}

test('assertSelectOnly accepts replace(), the scalar string function', () => {
  assertSelectOnly("SELECT replace(title, 'a', 'b') FROM items");
  assertSelectOnly("SELECT REPLACE(title, 'a', 'b') FROM items");
  // SQLite accepts whitespace between a function name and its `(`, so the
  // guard has to as well or the false positive just moves.
  assertSelectOnly("SELECT replace (title, 'a', 'b') FROM items");
  assertSelectOnly("SELECT id FROM items WHERE replace(id, '-', ' ') LIKE '%locks%'");
});

test('query runs a replace() query end to end and returns the replaced value', () => {
  const cwd = project();
  try {
    const { code, out } = run(
      ['query', "SELECT replace(type, 'lesson', 'LESSON') AS t FROM items", '--json'],
      cwd,
    );
    assert.equal(code, 0, out);
    const parsed = JSON.parse(out) as { rows: { t: string }[] };
    assert.deepEqual(parsed.rows, [{ t: 'LESSON' }], 'replace() really ran in the engine');
  } finally { removeTree(cwd); }
});

test('REPLACE INTO — the write the guard is actually for — is still refused', () => {
  // The statement form, at the top of the statement: caught by the prefix check.
  assert.throws(() => assertSelectOnly('REPLACE INTO items VALUES (1)'), /only SELECT/i);
  // The statement form nested where the prefix check cannot see it: this is the
  // keyword scan's own job, and it is the case a careless relaxation breaks.
  assert.throws(() => assertSelectOnly('SELECT * FROM (REPLACE INTO items VALUES (1))'), /not allowed/i);
  assert.throws(() => assertSelectOnly("SELECT * FROM (REPLACE INTO items(id) VALUES ('x'))"), /not allowed/i);
  // Line break between REPLACE and INTO, so a fix that only looked at the next
  // character on the same line does not slip.
  assert.throws(() => assertSelectOnly('SELECT * FROM (REPLACE\n  INTO items VALUES (1))'), /not allowed/i);
  // `INSERT OR REPLACE INTO` — the other spelling of the same write.
  assert.throws(() => assertSelectOnly('SELECT * FROM (INSERT OR REPLACE INTO items VALUES (1))'), /not allowed/i);
});

test('a REPLACE INTO typed at the CLI is refused and writes nothing', () => {
  const cwd = project();
  try {
    const before = (JSON.parse(run(['list', '--json'], cwd).out) as { count: number }).count;
    const { code, out } = run(['query', "REPLACE INTO items(id, type, title) VALUES ('X', 'lesson', 'X')"], cwd);
    assert.equal(code, 1);
    assert.match(out, /read-only/i);
    const after = (JSON.parse(run(['list', '--json'], cwd).out) as { count: number }).count;
    assert.equal(after, before, 'nothing was written');
  } finally { removeTree(cwd); }
});

/**
 * The census behind `ALSO_A_FUNCTION_NAME` being a one-element set.
 *
 * `SELECT name FROM pragma_function_list` on this engine (SQLite 3.51.2) lists
 * 166 functions, and `replace` is the only one whose name the keyword scan's
 * `\bWORD\b` regex hits. The near-misses below are the ones a reader would
 * expect to collide and that do NOT, because `_` is a word character and so
 * blocks the boundary. They are asserted rather than asserted-about: if a
 * future widening of the scan (say, to substring matching) broke them, this is
 * where it would show, and every one of them is a real read-only statement.
 */
test('the guarded words embedded in other function names never collided, and still do not', () => {
  assertSelectOnly("SELECT json_replace(data, '$.a', 1) FROM items");
  assertSelectOnly("SELECT jsonb_replace(data, '$.a', 1) FROM items");
  assertSelectOnly('SELECT last_insert_rowid()');
  assertSelectOnly("SELECT name FROM pragma_table_info('items')");
  assertSelectOnly('SELECT name FROM pragma_function_list');
});

test('json_replace and pragma_table_info really run through the command', () => {
  const cwd = project();
  try {
    const j = run(['query', `SELECT json_replace('{"a":1}', '$.a', 2) AS j`, '--json'], cwd);
    assert.equal(j.code, 0, j.out);
    assert.equal((JSON.parse(j.out) as { rows: { j: string }[] }).rows[0].j, '{"a":2}');

    const p = run(['query', "SELECT name FROM pragma_table_info('items')", '--json'], cwd);
    assert.equal(p.code, 0, p.out);
    assert.deepEqual(
      (JSON.parse(p.out) as { rows: { name: string }[] }).rows.map((r) => r.name)[0], 'id',
    );
  } finally { removeTree(cwd); }
});

/**
 * A KNOWN, MEASURED false positive that is deliberately NOT fixed here.
 *
 * Probed one keyword at a time against the real engine: SQLite accepts
 * REPLACE, TRUNCATE, VACUUM, PRAGMA, ATTACH, DETACH, REINDEX, ANALYZE, BEGIN,
 * ROLLBACK, SAVEPOINT and RELEASE as ordinary unquoted IDENTIFIERS (alias, CTE
 * name, table name) — only INSERT, UPDATE, DELETE, DROP, CREATE, ALTER and
 * COMMIT are hard keywords it refuses there. So `WITH analyze AS (SELECT 1 AS n)
 * SELECT * FROM analyze` is a perfectly read-only statement that this guard
 * refuses, and `analyze` is a plausible name for a CTE.
 *
 * It is left refused because telling identifier position from statement
 * position needs a real parser, not a lookahead: `ANALYZE items` (the write)
 * and `FROM analyze` (the read) differ only in what a grammar knows about the
 * surrounding clause. This function is the SOLE barrier for
 * `VACUUM INTO '<path>'`, so a half-parser here is how a hole gets made. Pinned
 * so the next reader finds a measurement rather than rediscovering it, and so
 * that a fix — if one is ever made properly — has to come here and change it.
 */
test('KNOWN LIMITATION: a guarded word used as a bare identifier is still refused', () => {
  assert.throws(() => assertSelectOnly('WITH analyze AS (SELECT 1 AS n) SELECT * FROM analyze'), /not allowed/i);
  assert.throws(() => assertSelectOnly('SELECT 1 AS vacuum'), /not allowed/i);
  // Double-quoting is the workaround, and it works because `strip` blanks
  // `"…"` before the scan — so a reader who hits the above has a way through.
  assertSelectOnly('WITH "analyze" AS (SELECT 1 AS n) SELECT * FROM "analyze"');
  assertSelectOnly('SELECT 1 AS "vacuum"');
});

test('every other FORBIDDEN keyword is still refused in its real statement form', () => {
  // One case per FORBIDDEN entry, in the nested position where the keyword scan
  // — not the prefix check — is what must catch it. This duplicates the older
  // pin in query.test.ts on purpose: it is the direct regression guard for the
  // relaxation this file introduces, so a future widening of the exemption
  // fails HERE, next to the reason it exists.
  for (const statement of [
    'INSERT INTO items VALUES (1)', 'UPDATE items SET x = 1', 'DELETE FROM items',
    'REPLACE INTO items VALUES (1)', 'DROP TABLE items', 'CREATE TABLE x (a)',
    'ALTER TABLE items ADD COLUMN x', 'TRUNCATE items', 'VACUUM',
    "VACUUM INTO 'anywhere.db'",
    'PRAGMA journal_mode = WAL', "ATTACH DATABASE 'x.db' AS o", 'DETACH o',
    'REINDEX', 'ANALYZE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT s', 'RELEASE s',
  ]) {
    assert.throws(() => assertSelectOnly(`SELECT * FROM (${statement})`), /not allowed/i, statement);
  }
});
