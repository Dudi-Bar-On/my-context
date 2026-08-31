/**
 * **The gap the audit log does not cover, asserted** — `plan:live seq:4`,
 * shaped by the measurement in `seq:5`.
 *
 * An item file edited by something that is not mycontext appends nothing to the
 * audit log, so nothing on the page's live channel can carry it. `seq:5`
 * measured `fs.watch` as the candidate for closing that gap and ruled it out on
 * this platform — it loses every named event in a burst of ~20 saved files and
 * missed a real item edit 10 times out of 10 with 60 files changing around it —
 * so what closes the gap is DISCLOSURE, and `measureCorpusDrift` is what keeps
 * that disclosure from being a permanent shrug.
 *
 * The three states the page has to be able to tell apart, and all three are
 * asserted below because `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * turns entirely on the difference between the second and the third:
 *
 *     drifted: true    something under items/ is newer than the log
 *     drifted: false   the sweep RAN and found nothing — a measured zero
 *     drifted: null    not known, and must never be drawn as "no"
 *
 * The endpoint half proves the fact reaches both channels the shell already
 * uses. It rides `/api/ping` because that is the only request a tab open since
 * the morning still makes, and `/api/meta` because that is the only one a tab
 * in its first minute has made — the same pair, for the same reason,
 * `staleCode` needed (`test/ui/code-skew.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { measureCorpusDrift, SWEEP_MAX_ENTRIES } from '../../src/core/corpus-drift.ts';

/**
 * A corpus with an audit log and `n` item files, all older than the log.
 *
 * Returns the `.my_context` directory, because that is what `projectRoot` is
 * everywhere in this product — `auditDir`, `dbPath` and `config.json` are all
 * derived from it, and the repository is `path.dirname` of it.
 */
function corpus(n: number): string {
  const tmp = mkdtempSync(path.join(tmpdir(), 'drift-'));
  const root = path.join(tmp, '.my_context');
  const items = path.join(root, 'items', 'task');
  const auditDir = path.join(root, '.audit');
  mkdirSync(items, { recursive: true });
  mkdirSync(auditDir, { recursive: true });
  for (let i = 0; i < n; i += 1) {
    writeFileSync(path.join(items, `TASK-${i}.md`), `---\nid: t-${i}\n---\n\n# t${i}\n`);
  }
  // The log is written LAST, which is the order every mycontext write uses: the
  // item file goes down, then the record is appended. So a corpus changed
  // THROUGH the product leaves the log at least as new as the item.
  writeFileSync(path.join(auditDir, 'audit.jsonl'), '{"at":"2026-08-31T00:00:00.000Z"}\n');
  return root;
}

/** Push a path's mtime `seconds` into the future, unambiguously past the log. */
function touchAhead(file: string, seconds: number): void {
  const when = new Date(Date.now() + seconds * 1000);
  utimesSync(file, when, when);
}

function cleanup(root: string): void {
  rmSync(path.dirname(root), { recursive: true, force: true });
}

test('a corpus written only through mycontext measures a ZERO, not an absence', () => {
  const root = corpus(12);
  try {
    const drift = measureCorpusDrift(root);
    // `false`, never `null`: the sweep ran, reached everything, and found
    // nothing newer. A page drawing this says "nothing has changed outside the
    // log", which is a finding — not "we cannot tell", which is a different one.
    assert.equal(drift.drifted, false);
    assert.equal(drift.aheadByMs, null);
    assert.equal(drift.truncated, false);
    assert.ok(drift.scanned > 12, `swept the files and the directories, got ${drift.scanned}`);
  } finally {
    cleanup(root);
  }
});

test('an item edited outside mycontext is SEEN, and how far ahead is disclosed', () => {
  const root = corpus(12);
  try {
    const edited = path.join(root, 'items', 'task', 'TASK-7.md');
    // The shape an editor's save leaves behind. What is under test is the
    // TIMESTAMP, not the bytes: the log did not move, the item did.
    writeFileSync(edited, '---\nid: t-7\n---\n\n# edited in vim\n');
    touchAhead(edited, 90);

    const drift = measureCorpusDrift(root);
    assert.equal(drift.drifted, true);
    assert.ok(drift.aheadByMs !== null && drift.aheadByMs > 60_000,
      `expected the corpus to be reported ~90s ahead of the log, got ${drift.aheadByMs}`);
    assert.equal(drift.truncated, false);
  } finally {
    cleanup(root);
  }
});

test('a NEW item file dropped in by another tool is seen', () => {
  const root = corpus(4);
  try {
    const added = path.join(root, 'items', 'task', 'TASK-from-elsewhere.md');
    writeFileSync(added, '---\nid: elsewhere\n---\n\n# arrived by rsync\n');
    touchAhead(added, 60);
    assert.equal(measureCorpusDrift(root).drifted, true);
  } finally {
    cleanup(root);
  }
});

test('a DELETE outside the log is seen, through the directory mtime', () => {
  const root = corpus(6);
  try {
    const dir = path.join(root, 'items', 'task');
    rmSync(path.join(dir, 'TASK-3.md'));
    // A removed file raises no surviving FILE's mtime — only the directory's.
    // Sweeping directories too is the only reason this shape is visible at all,
    // and an item that vanished is a corpus change like any other.
    touchAhead(dir, 60);
    assert.equal(measureCorpusDrift(root).drifted, true);
  } finally {
    cleanup(root);
  }
});

test('no audit log at all is UNKNOWN, never a clean bill of health', () => {
  const root = path.join(mkdtempSync(path.join(tmpdir(), 'drift-')), '.my_context');
  try {
    mkdirSync(path.join(root, 'items', 'task'), { recursive: true });
    writeFileSync(path.join(root, 'items', 'task', 'TASK-0.md'), '# x\n');
    const drift = measureCorpusDrift(root);
    // There is nothing to be behind, and nothing was measured. `false` here
    // would be a page claiming a corpus is in step with a log that does not
    // exist.
    assert.equal(drift.drifted, null);
    assert.equal(drift.aheadByMs, null);
  } finally {
    cleanup(root);
  }
});

test('no project workspace is UNKNOWN and does not throw', () => {
  const drift = measureCorpusDrift(null);
  assert.equal(drift.drifted, null);
  assert.equal(drift.scanned, 0);
});

test('a corpus that cannot be swept is UNKNOWN and does not throw', () => {
  const root = corpus(0);
  try {
    // The log exists; `items/` does not. A missing corpus is not a clean one.
    rmSync(path.join(root, 'items'), { recursive: true, force: true });
    const drift = measureCorpusDrift(root);
    assert.equal(drift.drifted, null);
  } finally {
    cleanup(root);
  }
});

test('the sweep is BOUNDED, and a truncated sweep that found nothing answers null', () => {
  const root = corpus(0);
  try {
    const dir = path.join(root, 'items', 'task');
    // Past the ceiling, with every file older than the log — so the sweep runs
    // out of budget before it can have an answer.
    for (let i = 0; i < SWEEP_MAX_ENTRIES + 200; i += 1) {
      writeFileSync(path.join(dir, `TASK-bulk-${i}.md`), `# ${i}\n`);
    }
    const log = path.join(root, '.audit', 'audit.jsonl');
    touchAhead(log, 300);

    const drift = measureCorpusDrift(root);
    assert.equal(drift.truncated, true);
    // The load-bearing assertion. `false` would be a claim about the whole
    // corpus made from the part that fit in the budget — the silent truncation
    // `INV-nothing-is-dropped-silently` calls the one unacceptable failure.
    assert.equal(drift.drifted, null);
    assert.ok(drift.scanned <= SWEEP_MAX_ENTRIES + 1,
      `the bound must hold: scanned ${drift.scanned} against ${SWEEP_MAX_ENTRIES}`);
  } finally {
    cleanup(root);
  }
});

test('the sweep stops early once it has its evidence, so drift is the CHEAP case', () => {
  const root = corpus(0);
  try {
    const dir = path.join(root, 'items', 'task');
    for (let i = 0; i < 400; i += 1) writeFileSync(path.join(dir, `TASK-${i}.md`), `# ${i}\n`);
    // Everything is newer than the log, so the first entry examined settles it.
    const log = path.join(root, '.audit', 'audit.jsonl');
    const past = new Date(Date.now() - 600_000);
    utimesSync(log, past, past);

    const drift = measureCorpusDrift(root);
    assert.equal(drift.drifted, true);
    assert.ok(drift.scanned < 400,
      `an early stop is the whole point: swept ${drift.scanned} of 400+ entries`);
  } finally {
    cleanup(root);
  }
});

test('the sweep WRITES NOTHING — /api/ping must stay a read', () => {
  const root = corpus(8);
  try {
    const dir = path.join(root, 'items', 'task');
    const before = statSync(dir).mtimeMs;
    const file = path.join(dir, 'TASK-0.md');
    const fileBefore = statSync(file).mtimeMs;

    measureCorpusDrift(root);
    measureCorpusDrift(root);

    assert.equal(statSync(dir).mtimeMs, before);
    assert.equal(statSync(file).mtimeMs, fileBefore);
    // A sweep that touched atimes or created anything would be a route that
    // writes, and would also make the NEXT sweep report drift against itself.
    assert.equal(measureCorpusDrift(root).drifted, false);
  } finally {
    cleanup(root);
  }
});
