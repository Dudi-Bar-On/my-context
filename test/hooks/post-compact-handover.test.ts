/**
 * **What `PostCompact` does with the handover, and what it deliberately does
 * not do with it.**
 *
 * The hook RESOLVES the handover and RECORDS what it found. It does not
 * deliver it and it could not: build 2.1.239 declares no `hookSpecificOutput`
 * variant for this event, so a `PostCompact` hook's stdout becomes a
 * user-facing banner appended to the compaction message and the model never
 * sees a byte of it. `SessionStart` is the tier that speaks (spec §2). So the
 * assertion this file exists for is the one that says **stdout is STILL
 * EMPTY** after the hook has read a handover file end to end — the split
 * across two hooks is not a preference, and a future change that "helpfully"
 * prints the block here would be caught by exactly one test in the suite.
 *
 * ── WHY `off` AND `missing` ARE ASSERTED SEPARATELY ────────────────────────
 *
 * They are different facts and only one of them is a defect:
 *
 *  - `off` — no `handover` key. Nobody promised anything, so nothing is owed.
 *  - `missing` — a key names a file that is not there. **An agreement broke.**
 *    The whole feature exists because a handover was maintained for nine days
 *    and nothing read it; a mechanism that finds nothing and reports it as
 *    "not configured" reproduces that failure one layer down, in the log that
 *    is supposed to be the evidence.
 *
 * A collapse of the second into the first is invisible to any assertion that
 * only checks "there is a state", which is why the `missing` test asserts the
 * value and not merely its presence.
 *
 * ── WHAT IS NOT ASSERTED HERE ──────────────────────────────────────────────
 *
 * The reading itself. `readHandover` owns the marker rule, the budget and the
 * section boundary, and `test/core/handover.test.ts` owns those assertions;
 * repeating them here would test the same function twice and pin this hook to
 * a bounding rule that is not its business. What this file pins is the hook's
 * side of the contract: which path, which state, how big, and silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { readAudit, type AuditRecord } from '../../src/core/audit.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import { findProjectRoot } from '../../src/core/workspace.ts';
import { recordPostCompact } from '../../src/hooks/post-compact.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'sess-post-compact-handover';
const HOOK = fileURLToPath(new URL('../../src/hooks/post-compact.ts', import.meta.url));

/**
 * U+23ED, written as an escape and never as the literal glyph:
 * `npm run check:text-files` gates non-ASCII in source, and the escape is the
 * only spelling that survives a terminal, a diff and a patch unchanged.
 */
const MARKER = '\u23ED';

/** Three lines, so `handoverLines` has an answer a reader can count by eye. */
const HANDOVER = [`### ${MARKER} NOW`, 'a', 'b'].join('\n');

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-post-compact-handover-'));
  runCli(['init'], cwd, () => {});
  t.after(() => removeTree(cwd));
  return cwd;
}

/**
 * `findProjectRoot`, not `resolveWorkspace`, for the reason the hook itself
 * gives: the latter THROWS on a `config.json` that is not valid JSON, and one
 * of the tests below deliberately writes exactly that. A harness that cannot
 * reach the log of a broken workspace cannot check that the workspace was
 * still recorded.
 */
function root(cwd: string): string {
  return findProjectRoot(cwd)!;
}

/** The repo root is the parent of `.my_context` — where `handover.path` is relative to. */
function repo(cwd: string): string {
  return path.dirname(root(cwd));
}

/** Merges a `handover` value into the `config.json` `init` just wrote. */
function configure(cwd: string, handover: unknown): void {
  const file = path.join(root(cwd), 'config.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  writeFileSync(file, `${JSON.stringify({ ...raw, handover }, null, 2)}\n`, 'utf8');
}

function writeHandover(cwd: string, body: string): void {
  mkdirSync(path.join(repo(cwd), 'reports'), { recursive: true });
  writeFileSync(path.join(repo(cwd), 'reports', 'H.md'), body, 'utf8');
}

function payload(cwd: string, over: Record<string, unknown> = {}) {
  return {
    hook_event_name: 'PostCompact', session_id: SESSION, cwd,
    trigger: 'auto', compact_summary: 'The user was working on CONST-a.',
    ...over,
  };
}

function rows(cwd: string): AuditRecord[] {
  return readAudit(root(cwd)).filter((r) => r.op === 'post-compact');
}

/** Runs the hook in-process and returns the single row it wrote. */
function postCompactRow(cwd: string, over: Record<string, unknown> = {}): AuditRecord {
  recordPostCompact(payload(cwd, over), cwd);
  const written = rows(cwd);
  assert.equal(written.length, 1, 'the hook recorded no post-compact row at all');
  return written[0];
}

test('the post-compact row records which handover was resolved, and its size', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/H.md' });
  writeHandover(cwd, HANDOVER);

  const row = postCompactRow(cwd);
  assert.equal(row.handoverState, 'read');
  assert.equal(row.handoverPath, 'reports/H.md');
  assert.equal(row.handoverLines, 3);
});

/**
 * The count is the FILE's, not the delivered block's.
 *
 * `readHandover` returns both, and this row records `totalLines` deliberately:
 * what a reader of the log wants to know is how big the document being carried
 * across compactions actually is, and how much of it any one session was
 * handed is `SessionStart`'s question, answered in the block that session
 * received. Recording the delivered count here would put a number in the log
 * that describes a delivery this hook did not make.
 */
test('handoverLines counts the whole file, not the section that would be delivered', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/H.md' });
  const lines = [`### ${MARKER} NOW`, 'do it', '### LATER'];
  for (let i = 0; i < 40; i += 1) lines.push(`filler ${i}`);
  writeHandover(cwd, lines.join('\n'));

  const row = postCompactRow(cwd);
  assert.equal(row.handoverState, 'read');
  assert.equal(
    row.handoverLines, lines.length,
    'the row recorded the delivered lines, so the log understates the document by the ' +
    'exact amount the reader would need to go and look at',
  );
});

/**
 * THE DISTINCTION THIS TASK EXISTS FOR. A configured file that is not there is
 * a BROKEN AGREEMENT, and reporting it as "nobody configured one" is the same
 * silence the whole feature was written to end.
 */
test('a missing handover is recorded as missing, not as absent', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/gone.md' });

  const row = postCompactRow(cwd);
  assert.equal(
    row.handoverState, 'missing',
    'a configured handover that is not on disk was recorded as though nobody had ' +
    'configured one — the one reading that hides a broken agreement',
  );
  assert.equal(
    row.handoverPath, 'reports/gone.md',
    'the path is what makes the row actionable: without it the reader knows something ' +
    'is missing and not which file to go and look for',
  );
  assert.equal(
    row.handoverLines, undefined,
    'a file that was never read has no line count, and 0 would be a measurement',
  );
});

test('no handover key records off, and writes no path', (t) => {
  const cwd = sandbox(t);

  const row = postCompactRow(cwd);
  assert.equal(row.handoverState, 'off');
  assert.equal(
    row.handoverPath, undefined,
    'a path was recorded for a project that named no handover, which invents a file',
  );
  assert.equal(row.handoverLines, undefined);
});

/**
 * **THE POINT OF THE TASK.**
 *
 * The hook is run as the platform runs it — a real process, a real payload on
 * stdin — with a handover it can read sitting on disk. It must resolve it, it
 * must record it, and it must say NOTHING: on this event stdout is a banner
 * printed to the user after every compaction, and the model never receives it
 * either way. The row is asserted in the same test so that "silent" cannot be
 * passed by a hook that simply did nothing.
 */
test('post-compact still writes NOTHING to stdout', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/H.md' });
  writeHandover(cwd, HANDOVER);

  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', HOOK],
    { cwd, input: JSON.stringify(payload(cwd)), encoding: 'utf8' },
  );

  assert.equal(run.status, 0, 'INV-hooks-fail-open: a compaction may never be failed');
  assert.equal(
    run.stdout, '',
    'a PostCompact hook\'s stdout becomes "PostCompact [...] completed successfully: <output>", ' +
    'a banner shown to the USER after every compaction — and the model never sees it. The ' +
    'handover is delivered by SessionStart; anything printed here is noise the reader did ' +
    'not ask for.',
  );
  assert.equal(
    run.stderr, '',
    'stderr on this event is folded into the same user-facing message, and is reserved for ' +
    'the parse-error disclosure',
  );
  assert.equal(
    rows(cwd)[0].handoverState, 'read',
    'the hook was silent because it did nothing, which is not the same as being silent ' +
    'about what it resolved',
  );
});

/**
 * An audit note is SCOPE, never CONTENT — the rule the summary already
 * follows in `post-compact.test.ts`. A handover is prose a person wrote for
 * their own team, and the log is a file that travels between machines.
 */
test('the row records the handover\'s size and never a line of its text', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/H.md' });
  writeHandover(cwd, [`### ${MARKER} NOW`, 'SECRET-HANDOVER-TEXT'].join('\n'));

  const row = postCompactRow(cwd);
  assert.equal(
    JSON.stringify(row).includes('SECRET-HANDOVER-TEXT'), false,
    'the handover document reached the audit log',
  );
});

/**
 * The three counts this hook already recorded are the measurement it was
 * written for, and resolving a handover beside them may not perturb them.
 */
test('the counts the hook already recorded are unchanged by the handover reading', (t) => {
  const cwd = sandbox(t);
  configure(cwd, { path: 'reports/H.md' });
  writeHandover(cwd, HANDOVER);
  writeSnapshot(root(cwd), SESSION, ['CONST-a', 'CONST-b', 'CONST-c']);

  const outcome = recordPostCompact(payload(cwd), cwd);
  assert.equal(outcome?.trigger, 'auto');
  assert.equal(outcome?.captured, 3);
  assert.equal(outcome?.survived, 1);
  assert.equal(outcome?.restored, 0);

  const note = rows(cwd)[0].note ?? '';
  assert.match(note, /^trigger=auto;/);
  assert.match(note, /snapshot 3 id\(s\), 0 re-delivered by the restore tier/);
  assert.match(note, /1 still named in the summary/);
});

/**
 * A workspace whose `config.json` is not valid JSON is still a workspace whose
 * compaction must be recorded — the reason this hook uses `findProjectRoot`
 * rather than `resolveWorkspace` in the first place.
 *
 * What it must NOT do is answer `off`. Nobody looked, and `off` is the claim
 * that somebody looked and found no `handover` key. Absent is absent
 * (`STD-absent-vs-zero`), and the reason a field cannot carry goes in the
 * note, which is where the reader is told which file to fix.
 */
test('a config that cannot be read records the compaction and claims no handover state', (t) => {
  const cwd = sandbox(t);
  writeFileSync(path.join(root(cwd), 'config.json'), '{ this is not JSON', 'utf8');

  const row = postCompactRow(cwd);
  assert.equal(
    row.handoverState, undefined,
    'a config nobody could read was reported as a project with no handover configured',
  );
  assert.equal(row.handoverPath, undefined);
  assert.match(row.note ?? '', /handover unknown/i);
});
