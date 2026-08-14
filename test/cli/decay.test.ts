import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-decay-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function scoped(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: constraint\ntitle: ${title}\nstatus: active\nscope:\n  - "src/**"\n---\n\n# ${title}\n\nBody.\n`, 'utf8');
}

function openLedger(cwd: string): Ledger {
  return Ledger.open(resolveWorkspace(cwd).dbPath);
}

/** Plants a corrupt, unrelated item file so `openMutateContext`'s rebuild
 * reports a load error that has nothing to do with the command under test —
 * the same fixture `test/cli/review.test.ts` uses for the identical F2
 * assertion on its own commands. */
function plantUnrelatedCorruptItem(cwd: string): void {
  mkdirSync(path.join(cwd, '.my_context', 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-broken.md'), 'no frontmatter here\n');
}

test('decay lists items never injected in the window', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /CONST-a/);
    assert.match(out, /never/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an item injected in the window drops out of the cold list', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Used recently');
    scoped(cwd, 'CONST-b', 'Never used');

    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['decay'], cwd);
    assert.match(out, /CONST-b/);
    // Every row is indented (`  ${line(row)}`), so an anchored /^CONST-a/m could
    // never match and would pass no matter what the command printed. A plain
    // containment check is the assertion that can actually fail: without --all,
    // a warm item appears nowhere in the output.
    assert.equal(out.includes('CONST-a'), false);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('unscoped normative items are reported separately from decay', () => {
  const cwd = project();
  try {
    run(['add', 'constraint', 'No scope at all', '--yes'], cwd);
    const { out } = run(['decay'], cwd);
    assert.match(out, /never auto-injected/i);
    assert.match(out, /CONST-no-scope-at-all/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('decay --sessions narrows the window and says so', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const { out } = run(['decay', '--sessions', '5'], cwd);
    assert.match(out, /last 5 session/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('decay --sessions actually narrows which sessions count as recent, not just the printed number', () => {
  // Regression guard for a mutant that ignored `window` entirely by calling
  // `recentSessions(9999)` regardless of the requested value — the printed
  // sentence would still say "last 1 session(s)" while the actual
  // classification kept using every session ever recorded. Only a real
  // cold/warm flip across two different `--sessions` values catches that.
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Used only in the oldest session');
    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', '2026-01-01T00:00:00.000Z');
    ledger.record('s2', 'PLACEHOLDER', 'jit', '2026-02-01T00:00:00.000Z');
    ledger.record('s3', 'PLACEHOLDER', 'jit', '2026-03-01T00:00:00.000Z');
    ledger.close();

    const narrow = run(['decay', '--sessions', '1'], cwd).out;
    assert.match(narrow, /cold \(1\)/);
    assert.match(narrow, /CONST-a/);

    const wide = run(['decay', '--sessions', '3'], cwd).out;
    assert.match(wide, /cold: none/);
    assert.equal(wide.includes('CONST-a'), false, 'now warm, so hidden without --all');

    const wideAll = run(['decay', '--sessions', '3', '--all'], cwd).out;
    assert.match(wideAll, /CONST-a/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('the cold list prints the exact use count and date, not an off-by-one or truncated one', () => {
  // Regression guard for mutants producing `${useCount + 1}x` or
  // `lastUsed.slice(0, 4)` — both survived until this assertion existed.
  // These two numbers are exactly what a human weighs before deleting
  // knowledge, so they get their own assertion, not just "the row appears".
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Historically used, now outside the window');
    const ledger = openLedger(cwd);
    ledger.record('s-old-1', 'CONST-a', 'jit', '2026-01-01T00:00:00.000Z');
    ledger.record('s-old-2', 'CONST-a', 'jit', '2026-02-01T00:00:00.000Z');
    ledger.record('s-old-3', 'CONST-a', 'jit', '2026-06-01T00:00:00.000Z');
    ledger.record('s-new', 'PLACEHOLDER', 'jit', '2026-08-01T00:00:00.000Z');
    ledger.close();

    const { out } = run(['decay', '--sessions', '1'], cwd);
    assert.match(out, /\bCONST-a\b[\s\S]*?\b3x, last 2026-06-01\b/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('when the ledger holds fewer sessions than the requested window, the report says so', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    const { out } = run(['decay', '--sessions', '20'], cwd);
    assert.match(out, /only 1 session\(s\) recorded/);
    assert.match(out, /"cold" mostly means "new"/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('the ledger-records-injection-not-use hedge is unconditional, not suppressed once the ledger looks mature', () => {
  // A scoped, correct item is cold and ranked first even against a ledger
  // that is NOT immature (sessionsRecorded > window) — the exact state the
  // old, gated caveat went silent in, which is precisely when a reader is
  // most likely to trust the list at face value.
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Correct, but never injected');
    const ledger = openLedger(cwd);
    ledger.record('s0', 'CONST-a', 'jit', '2026-01-01T00:00:00.000Z');
    for (let i = 1; i < 10; i++) {
      ledger.record(`s${i}`, 'PLACEHOLDER', 'jit', `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`);
    }
    ledger.close();

    const { out } = run(['decay', '--sessions', '5'], cwd);
    assert.match(out, /CONST-a/);
    assert.match(out, /ledger records injection, not reading or reliance/);
    // "on this report alone", not "below on this list": at `--summary` there
    // is no list below, and the sentence pointed at nothing.
    assert.match(out, /Do not supersede or deprecate anything on this report alone/);
    // sessionsRecorded (10) >= window (5): the ledger is "mature" by the old
    // gating condition, so the OLD caveat would have been suppressed here.
    assert.doesNotMatch(out, /only \d+ session\(s\) recorded so far/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('"cold: none" distinguishes "every scoped item is warm" from "no scoped item exists at all"', () => {
  const cwd = project();
  try {
    // Case 1: a scoped item exists and is warm — the real "all clear" case.
    scoped(cwd, 'CONST-a', 'Used recently');
    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();
    const warmCase = run(['decay'], cwd).out;
    assert.match(warmCase, /cold: none — every scoped item was injected inside the window\./);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('"cold: none" on a corpus with zero scoped items says so, not "activated"', () => {
  const cwd = project();
  try {
    // Only an unscoped item exists — nothing was ever measurable as cold or
    // warm, so the message must not claim anything "activated".
    run(['add', 'constraint', 'No scope at all', '--yes'], cwd);
    const { out } = run(['decay'], cwd);
    assert.match(out, /cold: none — no scoped, normative item exists yet to measure\./);
    assert.doesNotMatch(out, /activated/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('a long id gets its own column gap instead of colliding with the type column', () => {
  const cwd = project();
  try {
    const longId = 'CONST-a-very-long-identifier-that-is-longer-than-the-column-width-itself';
    scoped(cwd, longId, 'Long id title');
    const { out } = run(['decay'], cwd);
    assert.match(out, new RegExp(`${longId}  constraint`));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('decay --all also lists the warm items', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Used recently');
    const ledger = openLedger(cwd);
    ledger.record('s1', 'CONST-a', 'jit', new Date().toISOString());
    ledger.close();

    assert.equal(/CONST-a/.test(run(['decay'], cwd).out), false);
    assert.match(run(['decay', '--all'], cwd).out, /CONST-a/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an empty corpus reports nothing to decay rather than an empty screen', () => {
  const cwd = project();
  try {
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /nothing/i);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an unrelated corpus load error is reported but does not fail decay (F2)', () => {
  const cwd = project();
  try {
    scoped(cwd, 'CONST-a', 'Never used');
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /CONST-a/);
    assert.match(out, /my_context: error/);
    assert.match(out, /CONST-broken/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('an unrelated corpus load error on an otherwise-empty report is still reported and still exits 0 (F2)', () => {
  const cwd = project();
  try {
    plantUnrelatedCorruptItem(cwd);
    const { code, out } = run(['decay'], cwd);
    assert.equal(code, 0);
    assert.match(out, /nothing/i);
    assert.match(out, /my_context: error/);
    assert.match(out, /CONST-broken/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('a non-numeric --sessions is rejected', () => {
  const cwd = project();
  try {
    const { code, out } = run(['decay', '--sessions', 'many'], cwd);
    assert.equal(code, 1);
    assert.match(out, /--sessions/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});
