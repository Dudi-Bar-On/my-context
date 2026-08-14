import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Two defects found in the whole-branch review of `doctor`, pinned here:
 *
 * I4 — `runChecks` used to run BEFORE `ctx.store.close()` (the close sat in a
 * `finally` after it), so `checkIndexFreshness`'s `statSync(dbPath)` read the
 * main database file's mtime through a still-open WAL connection, i.e. from
 * before this invocation's own rebuild, and reported `index_stale` on a corpus
 * doctor had just rebuilt. `status` already closes first and carries the
 * comment explaining why (status.ts); `doctor` now does the same.
 *
 * I5 — the summary line counted only FINDINGS while the exit code counted
 * findings AND corpus load errors, so one unparseable item printed
 * "0 error(s) … across 0 finding(s)" and then exited 1: a line that reads
 * clean in a CI log tail attached to a failing run.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-doc2-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

function writeItemFile(cwd: string, id: string, type: string): void {
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    `---\nid: ${id}\ntype: ${type}\ntitle: ${id}\nstatus: active\n---\n\n# ${id}\n\nBody.\n`,
    'utf8',
  );
}

function plantUnparseableItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'),
    'no frontmatter here\n',
    'utf8',
  );
}

// ── I4 ───────────────────────────────────────────────────────────────────────

/**
 * The state `checkIndexFreshness` actually compares: an index file that was
 * last checkpointed BEFORE the newest item file was written. `rebuild`
 * creates and checkpoints `.index.db`; an item file is then written, and the
 * index's mtime is pushed 5s into the past so the ordering is unambiguous on
 * any filesystem's timestamp granularity (no sleep, so no flake). This is a
 * faithful stand-in for "someone edited an item since the last command ran",
 * which is the everyday case — not a contrived one.
 *
 * From here, doctor's OWN rebuild brings the index up to date, but that write
 * lands in the write-ahead log; the main file's mtime only moves when the
 * connection closes and SQLite checkpoints. Verified directly before writing
 * this test: with the store still open `checkIndexFreshness` returns
 * `["index_stale"]`, and after `close()` it returns `[]`, on the same corpus
 * in the same process.
 */
function indexOlderThanItems(cwd: string): void {
  run(['rebuild'], cwd);
  writeItemFile(cwd, 'CONST-edited-after-the-index', 'constraint');
  const db = path.join(cwd, '.my_context', '.index.db');
  const backdated = new Date(statSync(db).mtimeMs - 5000);
  utimesSync(db, backdated, backdated);
}

test('doctor does not report index_stale against a corpus its own rebuild just indexed', () => {
  withProject((cwd) => {
    indexOlderThanItems(cwd);

    const { code, out } = run(['doctor'], cwd);
    assert.doesNotMatch(
      out, /index_stale/,
      'doctor rebuilt this corpus itself moments earlier — reporting it stale is a phantom finding ' +
      'produced by statting the database through a connection that has not checkpointed yet',
    );
    assert.doesNotMatch(out, /Run `mycontext rebuild`/);
    assert.equal(code, 0);
  });
});

test('doctor and status agree on the warning count for the same corpus', () => {
  // The concrete symptom from the review: doctor reported one more warning
  // than status on a byte-identical corpus, because status closes its store
  // before running the same checks and doctor did not.
  withProject((cwd) => {
    indexOlderThanItems(cwd);

    const doctor = run(['doctor'], cwd);
    const status = run(['status'], cwd);
    const doctorWarnings = /doctor: \d+ error\(s\), (\d+) warning\(s\)/.exec(doctor.out);
    const statusWarnings = /health: \d+ error\(s\), (\d+) warning\(s\)/.exec(status.out);
    assert.ok(doctorWarnings, `no doctor summary line in:\n${doctor.out}`);
    assert.ok(statusWarnings, `no status health line in:\n${status.out}`);
    assert.equal(doctorWarnings[1], statusWarnings[1]);
  });
});

// ── I5 ───────────────────────────────────────────────────────────────────────

for (const [label, args] of [
  ['--quiet', ['--quiet']],
  ['--summary', ['--summary']],
  ['--short (default)', []],
  ['--full', ['--full']],
] as [string, string[]][]) {
  test(`doctor ${label}: the summary line's error count matches the exit code when the only error is a load error`, () => {
    withProject((cwd) => {
      plantUnparseableItem(cwd);
      const { code, out } = run(['doctor', ...args], cwd);
      assert.equal(code, 1, 'an unparseable item file fails doctor');
      assert.doesNotMatch(
        out, /doctor: 0 error\(s\)/,
        `"0 error(s)" printed above a run that exits 1 reads clean in a CI log tail. Output:\n${out}`,
      );
      assert.match(out, /doctor: 1 error\(s\)/);
      // The count is not merely inflated: the line says which kind of error
      // it is counting, so "1 error(s) … across 0 finding(s)" is not itself
      // the next contradiction.
      assert.match(out, /1 of the error\(s\) are corpus load errors/);
      assert.match(out, /CONST-broken\.md/);
    });
  });

  test(`doctor ${label}: a clean corpus still says 0 error(s) and exits 0`, () => {
    withProject((cwd) => {
      writeItemFile(cwd, 'CONST-a', 'constraint');
      const { code, out } = run(['doctor', ...args], cwd);
      assert.equal(code, 0);
      assert.match(out, /doctor: 0 error\(s\)/);
      assert.doesNotMatch(out, /corpus load errors/);
    });
  });
}

// ── I5, applied to `status`, the other command allowed to fail on a load
// error. The fix above landed on `doctor` only; `status` kept printing
// `health: 0 error(s), 0 warning(s), 0 note(s)` — which reads clean — and
// then exiting 1. `status`'s health line cannot simply absorb the load errors
// the way doctor's summary does: it is the FINDINGS tally, and status's exit
// code is derived from the load errors ALONE (its own comment says so, and
// f2-registry pins it), so the guard here is that the two numbers are both on
// screen and the failing one is named. ──────────────────────────────────────

for (const [label, args] of [
  ['--summary', ['--summary']],
  ['--short (default)', []],
  ['--full', ['--full']],
] as [string, string[]][]) {
  test(`status ${label}: a run that exits 1 does not leave "0 error(s)" as its last word on health`, () => {
    withProject((cwd) => {
      plantUnparseableItem(cwd);
      const { code, out } = run(['status', ...args], cwd);
      assert.equal(code, 1, 'an unparseable item file fails status');
      assert.match(out, /health: 0 error\(s\)/, 'the health line is still the findings tally');
      assert.match(
        out, /corpus load\s+error\(s\)[\s\S]*?what makes this command\s+exit 1/,
        `status exited 1 while its health line said 0 error(s) and nothing said why. Output:\n${out}`,
      );
      assert.match(out, /CONST-broken\.md/);
    });
  });

  test(`status ${label}: a clean corpus says nothing about load errors and exits 0`, () => {
    withProject((cwd) => {
      writeItemFile(cwd, 'CONST-a', 'constraint');
      const { code, out } = run(['status', ...args], cwd);
      assert.equal(code, 0);
      assert.match(out, /health: 0 error\(s\)/);
      assert.doesNotMatch(out, /corpus load/);
    });
  });
}

test('status --json: the document a machine reads cannot say 0 errors beside exitCode 1', () => {
  withProject((cwd) => {
    plantUnparseableItem(cwd);
    const { code, out } = run(['status', '--json'], cwd);
    const doc = JSON.parse(out) as {
      health: { errors: number };
      loadErrorCount: number;
      exitCode: number;
      loadErrors: { file: string }[];
    };
    assert.equal(code, 1);
    assert.equal(doc.exitCode, 1, 'the exit code must be reported, not re-derived by the consumer');
    assert.equal(doc.loadErrorCount, 1, 'loadErrorCount is what status\'s exit code is derived from');
    assert.equal(doc.health.errors, 0, 'health stays the findings tally');
    assert.equal(doc.loadErrors.length, 1);
    assert.match(doc.loadErrors[0].file, /CONST-broken\.md/);
  });
});

test('status --json: a clean corpus reports exitCode 0 and no load errors', () => {
  withProject((cwd) => {
    writeItemFile(cwd, 'CONST-a', 'constraint');
    const { code, out } = run(['status', '--json'], cwd);
    const doc = JSON.parse(out) as { loadErrorCount: number; exitCode: number };
    assert.equal(code, 0);
    assert.equal(doc.exitCode, 0);
    assert.equal(doc.loadErrorCount, 0);
  });
});

test('doctor --full counts a load error and a real finding together', () => {
  withProject((cwd) => {
    // One error-level FINDING (a source document that no longer exists) plus
    // one load error: the summary must total both, not pick one.
    const file = path.join(cwd, '.my_context', 'items', 'requirement', 'REQ-a.md');
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(
      file,
      `---\nid: REQ-a\ntype: requirement\ntitle: A\nstatus: active\n` +
      `source_file: docs/gone.md\nsource_anchor: x\nsource_checksum: abc123\n---\n\n# A\n\nBody.\n`,
      'utf8',
    );
    plantUnparseableItem(cwd);

    const { code, out } = run(['doctor', '--full'], cwd);
    assert.equal(code, 1);
    assert.match(out, /doctor: 2 error\(s\)/);
    assert.match(out, /across 1 finding\(s\)/);
    assert.match(out, /1 of the error\(s\) are corpus load errors/);
  });
});

test('doctor --json: the document a machine reads cannot say 0 errors beside exitCode 1', () => {
  withProject((cwd) => {
    plantUnparseableItem(cwd);
    const { code, out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as {
      counts: { errors: number };
      loadErrorCount: number;
      totalErrors: number;
      exitCode: number;
      loadErrors: { file: string }[];
    };
    assert.equal(code, 1);
    assert.equal(doc.exitCode, 1);
    assert.equal(doc.loadErrorCount, 1);
    assert.equal(doc.totalErrors, 1, 'totalErrors is what the exit code is derived from');
    assert.ok(doc.totalErrors > 0, 'a nonzero exit code must be accompanied by a nonzero error total');
    assert.equal(doc.loadErrors.length, 1);
    assert.match(doc.loadErrors[0].file, /CONST-broken\.md/);
  });
});

test('doctor --json: a clean corpus reports zero on every error field and exitCode 0', () => {
  withProject((cwd) => {
    writeItemFile(cwd, 'CONST-a', 'constraint');
    const { code, out } = run(['doctor', '--json'], cwd);
    const doc = JSON.parse(out) as {
      counts: { errors: number }; loadErrorCount: number; totalErrors: number; exitCode: number;
    };
    assert.equal(code, 0);
    assert.deepEqual(
      [doc.counts.errors, doc.loadErrorCount, doc.totalErrors, doc.exitCode],
      [0, 0, 0, 0],
    );
  });
});
