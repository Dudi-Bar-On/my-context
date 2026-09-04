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
  runCli(['add', '--summary-omitted', 'lesson', 'Migrations need locks'], cwd, () => {});
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
 * THE FALSE REFUSAL THIS SPLIT EXISTS TO END, and the measurement behind it.
 *
 * Probed one keyword at a time against the real engine: SQLite accepts
 * REPLACE, TRUNCATE, VACUUM, PRAGMA, ATTACH, DETACH, REINDEX, ANALYZE, BEGIN,
 * ROLLBACK, SAVEPOINT and RELEASE as ordinary unquoted IDENTIFIERS (alias, CTE
 * name, table name) — only INSERT, UPDATE, DELETE, DROP, CREATE, ALTER and
 * COMMIT are hard keywords it refuses there. The guard used to refuse all
 * nineteen WHEREVER THEY APPEARED, so `WITH analyze AS (SELECT 1 AS n) SELECT
 * * FROM analyze` — a statement that reads nothing and writes nothing — was
 * refused for being English.
 *
 * That was not theoretical. Measured against the live corpus this project
 * keeps on itself (717 items): `release` is a TAG in use, and two item ids
 * carry a guarded word as an ordinary word —
 * `TASK-the-version-number-for-the-release-is-the-owner-s-call-the` and
 * `TASK-the-query-read-only-guard-rejects-replace-a-scalar-function`. Naming a
 * CTE after the thing you are asking about is the obvious spelling of that
 * question, and it was the one spelling the guard refused.
 *
 * WHAT CHANGED, and why it is not the half-parser the risk analysis warned of.
 * The list did not shrink: all nineteen keywords are still refused in every
 * write form (the sweep below, and `query.test.ts`'s). What changed is that
 * for the keywords the READ-ONLY CONNECTION ALREADY REFUSES, the scan no
 * longer answers a question the engine has answered — a one-token lookback
 * says whether the word sits where SQLite requires a NAME. Being wrong there
 * costs a defence-in-depth layer, never the barrier.
 *
 * The four where the connection is NOT a backstop — VACUUM, PRAGMA, ATTACH,
 * DETACH — get no positional exemption at all and are still refused wherever
 * they appear. `VACUUM INTO '<path>'` writes a full copy of the database to a
 * caller-named path and SUCCEEDS on a `{ readOnly: true }` connection, so for
 * that one statement this function is the whole defence.
 */
test('a guarded word in IDENTIFIER position is accepted where the engine is the real barrier', () => {
  // The eight the engine backstops. Each is a name SQLite itself accepts —
  // verified through `mycontext query` against the live index, not assumed.
  for (const word of [
    'replace', 'truncate', 'reindex', 'analyze',
    'begin', 'rollback', 'savepoint', 'release',
  ]) {
    assertSelectOnly(`WITH ${word} AS (SELECT 1 AS n) SELECT * FROM ${word}`);
    assertSelectOnly(`SELECT id AS ${word} FROM items`);
    assertSelectOnly(`SELECT 1 AS n FROM items ORDER BY ${word}`);
    // `AS` before the alias: a bare `FROM items release` puts an ordinary
    // identifier before the guarded word, which the lookback cannot vouch for
    // and therefore still refuses. Recorded rather than hidden.
    assertSelectOnly(`SELECT ${word}.id FROM items AS ${word}`);
  }
  // The corpus-shaped question that was refused: name the CTE after the tag.
  assertSelectOnly(
    "WITH release AS (SELECT i.id FROM items i, json_each(i.data, '$.tags') t" +
    " WHERE t.value = 'release') SELECT count(*) AS tagged FROM release",
  );
});

test('the four the read-only connection does not backstop are refused wherever they appear', () => {
  for (const word of ['vacuum', 'pragma', 'attach', 'detach']) {
    assert.throws(() => assertSelectOnly(`WITH ${word} AS (SELECT 1 AS n) SELECT * FROM ${word}`), /not allowed/i, word);
    assert.throws(() => assertSelectOnly(`SELECT 1 AS ${word}`), /not allowed/i, word);
    // Double-quoting is the way through, and it works because `strip` blanks
    // `"…"` before the scan. It is the unblocking condition a reader who hits
    // one of these four needs, and the refusal names it — see the test below.
    assertSelectOnly(`SELECT 1 AS "${word}"`);
    assertSelectOnly(`WITH "${word}" AS (SELECT 1 AS n) SELECT * FROM "${word}"`);
  }
});

/**
 * `RULE-a-refusal-states-its-unblocking-condition` — named by `plan:rulings
 * seq:46`, which fixed the false refusals above and stopped at the wording
 * because it does not hold the strings. This is that wording: the refusal for
 * one of the four absolute keywords, used as an ordinary name, must say the
 * one thing that gets a caller through — double-quote it — not only what is
 * forbidden.
 */
test('the refusal for one of the four absolute keywords names the double-quote escape', () => {
  for (const word of ['vacuum', 'pragma', 'attach', 'detach']) {
    assert.throws(
      () => assertSelectOnly(`SELECT 1 AS ${word}`),
      (err: Error) => {
        assert.match(err.message, new RegExp(`"${word.toUpperCase()}" is not allowed`));
        assert.match(
          err.message,
          new RegExp(`If you meant it as a name, double-quote it: "${word}"\\.$`),
          `${word}'s refusal does not name the unblocking condition: ${err.message}`,
        );
        return true;
      },
      word,
    );
  }
});

/**
 * The other fifteen FORBIDDEN keywords already have a positional escape
 * (`NAME_FOLLOWS`) for the ordinary-name case, so the double-quote sentence —
 * which is specifically about the four this scan stops unconditionally — must
 * not be tacked onto every refusal regardless of which keyword triggered it.
 */
test('an ordinary write keyword\'s refusal does not carry the double-quote sentence', () => {
  assert.throws(
    () => assertSelectOnly('DELETE FROM items'),
    (err: Error) => {
      assert.doesNotMatch(err.message, /double-quote/);
      return true;
    },
  );
});

test('the CTE named after a corpus tag runs end to end, and the engine agrees it is read-only', () => {
  // The guard is now permissive here, so the claim that these are real reads
  // is checked against the ENGINE rather than against the guard that stopped
  // asking. Each runs on the read-only connection `cmdQuery` opens; a write
  // would be refused there, and a syntax error would fail the exit code.
  const cwd = project();
  try {
    for (const word of [
      'replace', 'truncate', 'reindex', 'analyze',
      'begin', 'rollback', 'savepoint', 'release',
    ]) {
      const { code, out } = run(
        [`query`, `WITH ${word} AS (SELECT id FROM items) SELECT count(*) AS n FROM ${word}`, `--json`],
        cwd,
      );
      assert.equal(code, 0, `${word}: ${out}`);
      assert.equal((JSON.parse(out) as { rows: { n: number }[] }).rows[0].n, 1, word);
    }
  } finally { removeTree(cwd); }
});

test('identifier position is a LOOKBACK, not a licence: a write after `)` is still refused', () => {
  // `WITH x AS (…) DELETE FROM y` is legal SQLite and puts `)` — not `AS` —
  // before the write keyword, which is exactly why the lookback set may not
  // contain `(` or `)`. These are the shapes that would turn the relaxation
  // into a hole, and every one of them must stay refused.
  assert.throws(() => assertSelectOnly('WITH x AS (SELECT 1) DELETE FROM items'), /not allowed/i);
  assert.throws(() => assertSelectOnly('WITH x AS (SELECT 1) INSERT INTO items VALUES (1)'), /not allowed/i);
  assert.throws(() => assertSelectOnly('WITH release AS (SELECT 1) REPLACE INTO items VALUES (1)'), /not allowed/i);
  assert.throws(() => assertSelectOnly('SELECT * FROM (REINDEX)'), /not allowed/i);
  assert.throws(() => assertSelectOnly('SELECT * FROM items WHERE 1 = (SELECT 1) ROLLBACK TO SAVEPOINT s'), /not allowed/i);
  // `AS` before a keyword is an alias, but `TO` before one is not a name
  // position — `ROLLBACK TO SAVEPOINT s` must not be laundered through it.
  assert.throws(() => assertSelectOnly('SELECT 1 AS n FROM items ROLLBACK TO SAVEPOINT s'), /not allowed/i);
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
