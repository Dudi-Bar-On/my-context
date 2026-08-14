import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { assertSelectOnly } from '../../src/cli/commands/query.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-query-'));
  runCli(['init'], cwd, () => {});
  runCli(['add', 'constraint', 'Pool capped at 20'], cwd, () => {});
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  return cwd;
}

test('assertSelectOnly accepts SELECT and WITH', () => {
  assertSelectOnly('SELECT * FROM items');
  assertSelectOnly('  select id from items  ');
  assertSelectOnly('WITH t AS (SELECT id FROM items) SELECT * FROM t');
  assertSelectOnly('SELECT * FROM items; ');
});

test('assertSelectOnly rejects every mutating statement', () => {
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
  assert.match(out, /^id\s+type$/m);
  assert.match(out, /CONST-pool-capped-at-20\s+constraint/);
  assert.match(out, /2 row/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query --json emits parseable JSON', () => {
  const cwd = project();
  const { out } = run(['query', 'SELECT type, COUNT(*) AS n FROM items GROUP BY type', '--json'], cwd);
  const parsed = JSON.parse(out) as { type: string; n: number }[];
  assert.deepEqual(parsed.sort((a, b) => a.type.localeCompare(b.type)),
    [{ type: 'constraint', n: 1 }, { type: 'lesson', n: 1 }]);
  rmSync(cwd, { recursive: true, force: true });
});

test('query refuses to mutate and names the rule', () => {
  const cwd = project();
  const { code, out } = run(['query', 'DELETE FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /only SELECT/i);
  assert.equal(run(['list'], cwd).out.trim().split('\n').length, 2, 'nothing was deleted');
  rmSync(cwd, { recursive: true, force: true });
});

test('a SQL error is reported without a stack trace', () => {
  const cwd = project();
  const { code, out } = run(['query', 'SELECT nope FROM items'], cwd);
  assert.equal(code, 1);
  assert.match(out, /nope/);
  assert.equal(/at Object\./.test(out), false);
  rmSync(cwd, { recursive: true, force: true });
});

test('a query returning nothing says so', () => {
  const cwd = project();
  const { code, out } = run(['query', "SELECT * FROM items WHERE type = 'adr'"], cwd);
  assert.equal(code, 0);
  assert.match(out, /0 row/);
  rmSync(cwd, { recursive: true, force: true });
});

test('query with no SQL prints usage including the schema hint', () => {
  const cwd = project();
  const { code, out } = run(['query'], cwd);
  assert.equal(code, 1);
  assert.match(out, /usage: mycontext query/);
  assert.match(out, /items\(id, type, title, status, always, layer, file_path, updated_at, data\)/);
  rmSync(cwd, { recursive: true, force: true });
});
