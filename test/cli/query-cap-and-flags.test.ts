import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { parseQueryArgs } from '../../src/cli/commands/query.ts';
import { computeItemChecksum } from '../../src/core/item.ts';
import { parseItem } from '../../src/core/item.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Three review findings against `mycontext query`, pinned here:
 *
 * I11 — no row cap. A 300-item corpus with a plausible missing-join typo ran
 * ~50s and then aborted the process with `FATAL ERROR: Reached heap limit` and
 * a full V8 native stack trace, in a command whose own suite asserts that SQL
 * errors are reported WITHOUT one.
 *
 * I12 — unknown flags were silently swallowed: `--full`, `--summary` and
 * `--bogusflag` were all accepted and ignored (verified against the old
 * `positionals(args, [])` parse before the fix).
 *
 * Peer finding — SQL beginning with a `--` line comment was dropped by that
 * same parse, so the user got the usage banner as though they had passed no
 * SQL at all (verified: `positionals(['-- c\nSELECT id FROM items'], [])`
 * returned `[]`).
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

/**
 * Items are written as files with a correct checksum rather than created via
 * `mycontext add`, so this suite is independent of `add`'s own flag surface.
 * The rendered shape matches what `writeItem` produces closely enough for
 * `parseItem` to read it back, which is all the index needs.
 */
function writeItems(cwd: string, count: number): void {
  const dir = path.join(cwd, '.my_context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  for (let i = 0; i < count; i++) {
    const id = `CONST-item-${String(i).padStart(4, '0')}`;
    const file = path.join(dir, `${id}.md`);
    const text =
      `---\nid: ${id}\ntype: constraint\ntitle: Item ${i}\nstatus: active\n---\n\n# Item ${i}\n\nBody ${i}.\n`;
    const item = parseItem(text, `items/constraint/${id}.md`, 'project');
    writeFileSync(
      file,
      text.replace('status: active\n', `status: active\nchecksum: ${computeItemChecksum(item)}\n`),
      'utf8',
    );
  }
}

function withProject(count: number, fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-qcap-'));
  runCli(['init'], cwd, () => {});
  writeItems(cwd, count);
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

// ── I11: the row cap ─────────────────────────────────────────────────────────

test('a runaway missing-join query is capped instead of exhausting the heap', () => {
  // 300 items, not 40, and the number is the whole point. At 40 the three-way
  // product is 64,000 rows: SQLite materializes that in milliseconds, so
  // removing the engine-side cap and trimming the rows in JS instead produced
  // BYTE-IDENTICAL output and the run cost 46ms against a 20s bound — the
  // test was named after a property it could not observe, and the mutant that
  // removes the cap survived a full suite run.
  //
  // 300 is the corpus size at which the uncapped form actually reproduces the
  // reviewed failure: 27,000,000 rows, ~50s, then `FATAL ERROR: Reached heap
  // limit` and a V8 native stack trace. Capped, the same query returns in
  // ~220ms because the engine stops STEPPING at the limit — measured on this
  // fixture before the bound below was chosen. So the bound is what
  // distinguishes an engine-side cap from an output-side one, and a mutant
  // that moves the cap out of the engine fails here either by blowing the
  // bound or by aborting the process outright. An abort is an ugly failure
  // mode for a test file; it is also the honest one, since it is exactly what
  // the cap exists to prevent.
  withProject(300, (cwd) => {
    const started = Date.now();
    const { code, out } = run(
      ['query', 'SELECT a.id AS x, b.id AS y, c.id AS z FROM items a, items b, items c'],
      cwd,
    );
    const elapsed = Date.now() - started;
    assert.equal(code, 0);
    assert.match(out, /1000 row\(s\) shown — capped, there are more/);
    assert.ok(
      elapsed < 10_000,
      `the query took ${elapsed}ms over a 27,000,000-row product: the cap must stop the engine ` +
      'stepping, not trim rows after the fact',
    );
  });
});

test('the cap is announced in words, never applied silently', () => {
  withProject(40, (cwd) => {
    const { out } = run(['query', 'SELECT a.id AS x, b.id AS y FROM items a, items b'], cwd);
    assert.match(out, /CAPPED at 1000 row\(s\)/);
    assert.match(out, /not the whole answer/);
    assert.match(out, /--limit 10000/, 'the notice must say how to raise the cap, with a usable value');
  });
});

test('a result that fits under the cap says nothing about capping', () => {
  withProject(5, (cwd) => {
    const { code, out } = run(['query', 'SELECT id FROM items ORDER BY id'], cwd);
    assert.equal(code, 0);
    assert.match(out, /^5 row\(s\)$/m);
    assert.doesNotMatch(out, /capped/i);
  });
});

test('a result of exactly the cap size is not falsely reported as capped', () => {
  // The off-by-one that a naive `rows.length === limit` check gets wrong: the
  // extra row fetched beyond the cap is what distinguishes "exactly n" from
  // "more than n".
  withProject(7, (cwd) => {
    const { out } = run(['query', '--limit', '7', 'SELECT id FROM items'], cwd);
    assert.match(out, /^7 row\(s\)$/m);
    assert.doesNotMatch(out, /capped/i);
  });
});

test('--limit raises the cap and the extra rows really arrive', () => {
  withProject(40, (cwd) => {
    const { out } = run(['query', '--limit', '1500', 'SELECT a.id AS x, b.id AS y FROM items a, items b'], cwd);
    assert.match(out, /1500 row\(s\) shown — capped, there are more/);
  });
});

test('--limit lowers the cap too, and the notice names the number actually used', () => {
  withProject(5, (cwd) => {
    const { out } = run(['query', '--limit=2', 'SELECT id FROM items ORDER BY id'], cwd);
    assert.match(out, /2 row\(s\) shown — capped, there are more/);
    assert.match(out, /CAPPED at 2 row\(s\)/);
  });
});

test('the caller\'s own LIMIT is preserved, not overridden by the cap', () => {
  withProject(40, (cwd) => {
    const { out } = run(['query', 'SELECT id FROM items ORDER BY id LIMIT 3'], cwd);
    assert.match(out, /^3 row\(s\)$/m);
    assert.doesNotMatch(out, /capped/i);
  });
});

test('ORDER BY survives the cap wrapper — the capped rows are the first ones, not an arbitrary 1000', () => {
  withProject(5, (cwd) => {
    const { out } = run(['query', '--limit', '2', 'SELECT id FROM items ORDER BY id DESC'], cwd);
    assert.match(out, /CONST-item-0004/);
    assert.doesNotMatch(out, /CONST-item-0000/);
  });
});

test('--limit refuses a value that cannot mean a row count', () => {
  withProject(2, (cwd) => {
    for (const value of ['0', '-1', 'all', '1.5', '']) {
      const { code, out } = run(['query', '--limit', value, 'SELECT id FROM items'], cwd);
      assert.equal(code, 1, `--limit ${JSON.stringify(value)} was accepted`);
      assert.match(out, /--limit takes a whole number of rows/);
      assert.match(out, /no unlimited setting/);
    }
  });
});

test('--json carries the truncation flag inside the document, so a machine cannot read a capped answer as complete', () => {
  withProject(40, (cwd) => {
    const { code, out } = run(['query', '--json', 'SELECT a.id AS x, b.id AS y FROM items a, items b'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out) as { rows: unknown[]; rowCount: number; truncated: boolean; limit: number };
    assert.equal(doc.truncated, true);
    assert.equal(doc.limit, 1000);
    assert.equal(doc.rowCount, 1000);
    assert.equal(doc.rows.length, 1000);
  });
});

test('--json says truncated:false when nothing was cut', () => {
  withProject(3, (cwd) => {
    const { out } = run(['query', '--json', 'SELECT id FROM items ORDER BY id'], cwd);
    const doc = JSON.parse(out) as { rows: { id: string }[]; rowCount: number; truncated: boolean };
    assert.equal(doc.truncated, false);
    assert.equal(doc.rowCount, 3);
    assert.equal(doc.rows[0].id, 'CONST-item-0000');
  });
});

test('--json stays parseable when the corpus has a load error, which is when a consumer most needs it', () => {
  withProject(2, (cwd) => {
    writeFileSync(
      path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'),
      'no frontmatter here\n', 'utf8',
    );
    const { code, out } = run(['query', '--json', 'SELECT id FROM items'], cwd);
    assert.equal(code, 0, 'F2: query answered the question it was asked');
    const doc = JSON.parse(out) as { loadErrors: { file: string; message: string }[] };
    assert.equal(doc.loadErrors.length, 1);
    assert.match(doc.loadErrors[0].file, /CONST-broken\.md/);
  });
});

// ── I12: flags are refused, not swallowed ────────────────────────────────────

test('query refuses the detail levels instead of accepting and ignoring them', () => {
  withProject(2, (cwd) => {
    for (const level of ['--full', '--short', '--summary']) {
      const { code, out } = run(['query', level, 'SELECT id FROM items'], cwd);
      assert.equal(code, 1, `${level} was swallowed`);
      assert.match(out, new RegExp(`unknown flag "${level}"`));
      assert.match(out, /--json and --limit/, 'the refusal must name what query does accept');
      assert.match(out, /do not apply to a SQL result set/);
    }
  });
});

test('query refuses an unknown flag rather than running a query the caller did not ask for', () => {
  withProject(2, (cwd) => {
    const { code, out } = run(['query', '--full', '--summary', '--bogusflag', 'SELECT 1'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown flag "--full"/);
  });
});

test('an unknown flag spelled with a value is refused by name, without the value', () => {
  withProject(2, (cwd) => {
    const { code, out } = run(['query', '--bogus=3', 'SELECT id FROM items'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown flag "--bogus"/);
  });
});

test('the flags query does accept still work', () => {
  withProject(2, (cwd) => {
    assert.equal(run(['query', '--json', 'SELECT id FROM items'], cwd).code, 0);
    assert.equal(run(['query', '--limit', '5', 'SELECT id FROM items'], cwd).code, 0);
    assert.equal(run(['query', '--limit=5', '--json', 'SELECT id FROM items'], cwd).code, 0);
  });
});

// ── Peer finding: SQL that begins with a `--` comment ────────────────────────

test('SQL beginning with a line comment is reachable through the -- separator', () => {
  withProject(3, (cwd) => {
    const { code, out } = run(['query', '--', '-- find every item\nSELECT id FROM items ORDER BY id'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /^3 row\(s\)$/m);
    assert.match(out, /CONST-item-0000/);
  });
});

test('flags before the -- separator still apply', () => {
  withProject(3, (cwd) => {
    const { out } = run(['query', '--json', '--limit', '2', '--', '-- a comment\nSELECT id FROM items'], cwd);
    const doc = JSON.parse(out) as { rowCount: number; truncated: boolean; limit: number };
    assert.equal(doc.limit, 2);
    assert.equal(doc.rowCount, 2);
    assert.equal(doc.truncated, true);
  });
});

test('after the -- separator, a flag-looking token is SQL, not a flag', () => {
  withProject(3, (cwd) => {
    // `--json` here is part of the comment text, so the output must be the
    // text table, not a JSON document.
    const { code, out } = run(['query', '--', '-- --json is not a flag here\nSELECT id FROM items'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /^3 row\(s\)$/m);
    assert.doesNotMatch(out, /"rows":/);
  });
});

test('without the separator, comment-leading SQL is refused with a message that names the way through', () => {
  withProject(3, (cwd) => {
    const { code, out } = run(['query', '-- find every item\nSELECT id FROM items'], cwd);
    assert.equal(code, 1);
    assert.match(out, /mycontext query -- /, 'the refusal must name the -- separator');
  });
});

// ── parseQueryArgs, directly ─────────────────────────────────────────────────

test('parseQueryArgs pins the parse itself, independent of any corpus', () => {
  assert.deepEqual(
    parseQueryArgs(['SELECT id FROM items']),
    { sql: 'SELECT id FROM items', json: false, limit: 1000 },
  );
  assert.deepEqual(
    parseQueryArgs(['--json', '--limit', '7', 'SELECT 1']),
    { sql: 'SELECT 1', json: true, limit: 7 },
  );
  // The value of --limit must not leak into the SQL.
  assert.equal(parseQueryArgs(['--limit', '7', 'SELECT 1']).sql, 'SELECT 1');
  assert.equal(parseQueryArgs(['--', '--json']).sql, '--json');
  assert.equal(parseQueryArgs(['--', '--json']).json, false);
  assert.throws(() => parseQueryArgs(['--nope', 'SELECT 1']), /unknown flag "--nope"/);
  assert.throws(() => parseQueryArgs(['--limit']), /--limit needs a value/);
});
