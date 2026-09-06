/**
 * **The staleness assertion, at the moment the handover is CONSUMED.**
 * `plan:handover seq:17`, owner ruling 2026-09-06.
 *
 * `SessionStart` is the one hook whose stdout Claude Code appends to the
 * model's context verbatim, so it is the only place a claim about the handover
 * can reach the reader who is about to believe it. These tests spawn the hook
 * as a process for `session-start-handover.test.ts`'s reason — the task is
 * which STREAM a given outcome lands on, and an in-process call collapses that
 * to one return value.
 *
 * **NOTHING HERE TOUCHES A LIVE LATCH.** Every fixture is a fresh `mkdtemp`
 * root with a fabricated session id. A latch under `.my_context/state/` is a
 * REAL file that a running session reads: stamping one in this repository's own
 * corpus would put a false ask on the owner's status line and could fire a
 * spurious handover ask in his session. The last test in this file asserts the
 * other half of that — that the hook itself writes nothing into `state/`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { ASK_LATCH_SUFFIX, NO_LATCH } from '../../src/core/handover-ask.ts';
import { removeTree } from '../helpers/tmp.ts';

const HOOK = fileURLToPath(new URL('../../src/hooks/session-start.ts', import.meta.url));

const HANDOVER_REL = 'reports/H.md';
const BODY = '### ⏭ NOW\nthe lane on builder/13 is currently running';

/** The session the hook is told it is. Fabricated, and never a real one. */
const SESSION = 'fixture-session-a';

interface Run { stdout: string; stderr: string }

function sandbox(t: { after(fn: () => void): void }, configure = true): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-how-'));
  t.after(() => removeTree(cwd));
  runCli(['init'], cwd, () => {});
  if (configure) {
    const configPath = path.join(cwd, '.my_context', 'config.json');
    const config = JSON.parse(readFileSync(configPath, 'utf8')) as Record<string, unknown>;
    config.handover = { path: HANDOVER_REL };
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
  return cwd;
}

/**
 * Writes the handover and returns its mtime, FLOORED to whole milliseconds —
 * the fixed point every ask below is placed around.
 *
 * The floor is load-bearing rather than tidy. `mtimeMs` carries sub-millisecond
 * precision on NTFS, while an `askedAt` is an ISO-8601 string that cannot, so
 * an ask placed at `mtimeMs - 180_000` parses back a fraction of a millisecond
 * LATE and the gap measures 179,999.6 ms — which `coarseDuration` floors to
 * `2m`. Flooring here makes every gap at least the interval it was asked for,
 * so the assertions below are about the wording and never about a rounding edge.
 */
function writeHandover(cwd: string, body = BODY): number {
  const file = path.join(cwd, ...HANDOVER_REL.split('/'));
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, body, 'utf8');
  return Math.floor(statSync(file).mtimeMs);
}

/**
 * Stamps a latch for `sessionId` in the FIXTURE's `state/`.
 *
 * Written field by field off `NO_LATCH` rather than as a hand-rolled object, so
 * a ninth field added to `AskLatch` cannot leave this fixture writing a shape
 * the reader silently treats as pristine.
 */
function stampAsk(cwd: string, sessionId: string, percent: number, askedAtMs: number): void {
  const dir = path.join(cwd, '.my_context', 'state');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${sessionId}${ASK_LATCH_SUFFIX}`),
    JSON.stringify({
      ...NO_LATCH,
      askedAtThreshold: 85,
      askedAtPercent: percent,
      askedAt: new Date(askedAtMs).toISOString(),
      asks: 1,
    }),
    'utf8',
  );
}

function runHook(cwd: string, source: string, sessionId: string = SESSION): Run {
  const run = spawnSync(
    process.execPath,
    ['--disable-warning=ExperimentalWarning', HOOK],
    {
      input: JSON.stringify({
        session_id: sessionId, source, cwd, hook_event_name: 'SessionStart',
      }),
      encoding: 'utf8',
    },
  );
  // INV-hooks-fail-open, on every run: this branch now reads a directory as
  // well as a file, and a handover note that can fail a session start is worse
  // than one that is never delivered.
  assert.equal(run.status, 0, `the hook exited ${run.status}\n${run.stderr}`);
  return { stdout: run.stdout, stderr: run.stderr };
}

test('a compaction: the ask is in THIS session\'s latch, and the percent is quoted', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  // Three minutes BEFORE the write: an ask that was answered.
  stampAsk(cwd, SESSION, 96, written - 3 * 60_000);
  const run = runHook(cwd, 'compact');

  assert.match(run.stdout, /the lane on builder\/13 is currently running/,
    'the handover itself must still be delivered — this line is an appendix, not a replacement');
  assert.match(run.stdout, /READ THIS AS HISTORY/);
  assert.match(run.stdout, /went out at 96% of a context window, 3m before the write/,
    'the record is quoted — the ask\'s percent and the gap to the write — and nothing is inferred');
  assert.match(run.stdout, /That window has ENDED — a compaction just rebuilt this one/);
  assert.match(run.stdout, /"currently"/,
    'the value is naming the CLAUSES that are historical, in the words a handover uses');
  // The order is the whole point: the warning follows the text it is about.
  assert.ok(
    run.stdout.indexOf('currently running') < run.stdout.indexOf('READ THIS AS HISTORY'),
  );
});

test('a fresh session id: the ask is found under the PREVIOUS session\'s name', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  // `/clear`, `startup` and `fork` all mint a new id, so the latch that matters
  // is never the one this hook is keyed on. Two of them, so the scan has to
  // pick the LATER one rather than the first it reads.
  stampAsk(cwd, 'older-session', 41, written - 4 * 60 * 60_000);
  stampAsk(cwd, 'writing-session', 99, written - 120_000);
  const run = runHook(cwd, 'clear', 'a-brand-new-id');

  assert.match(run.stdout, /went out at 99% of a context window, 2m before the write/,
    'the most recent recorded ask wins; 41% belongs to a window two windows ago');
  assert.doesNotMatch(run.stdout, /41%/);
  assert.match(run.stdout, /a \/clear just started this one/);
});

test('an ask NEWER than the file says so, and says what is missing', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  // Asked two hours AFTER the last write: `checkHandoverAsk`'s `ignored`, seen
  // from the reading end. The extra second is the floor's other half — the real
  // mtime is a fraction above `written`, so the interval is asked for from above.
  stampAsk(cwd, SESSION, 98, written + 2 * 60 * 60_000 + 1_000);
  const run = runHook(cwd, 'compact');

  assert.match(run.stdout, /READ THIS AS HISTORY, AND AS INCOMPLETE/);
  // The interval stated must be the one that was MEASURED — the last write to
  // the ask — and not "not written in the 2h since", which names the ask-to-now
  // interval this function is never given.
  assert.match(
    run.stdout,
    /asked for at 98% of a context window, and this file was last written 2h BEFORE that ask/,
  );
  assert.doesNotMatch(run.stdout, /in the 2h since/);
  assert.match(run.stdout, /its last stretch was never written down at all/,
    'this is worse than merely old and the wording must not collapse the two');
});

test('no recorded ask: the percentage is refused, never defaulted', (t) => {
  const cwd = sandbox(t);
  writeHandover(cwd);
  const run = runHook(cwd, 'startup');

  assert.match(run.stdout, /How full the context window was when this was written is NOT recorded/);
  assert.match(run.stdout, /no number is invented for it here/,
    'a wrong percentage is worse than no sentence, because the sentence would be believed');
  assert.doesNotMatch(run.stdout, /\d+% of a context window/, 'nothing may be quoted as a reading');
  // The load-bearing claim survives the missing number, because it rests on the
  // EVENT and not on a measurement.
  assert.match(run.stdout, /it was written before this window — this one has just started/);
  assert.match(run.stdout, /is a claim about a session that is OVER/);
});

test('a latch with an ask and no percent is not quoted — it is a pre-seq:12 file', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  const dir = path.join(cwd, '.my_context', 'state');
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${SESSION}${ASK_LATCH_SUFFIX}`),
    JSON.stringify({ askedAtThreshold: 85, askedAt: new Date(written - 60_000).toISOString(), asks: 1 }),
    'utf8',
  );
  const run = runHook(cwd, 'compact');

  // `readLatch` back-fills `askedAtPercent` from the threshold for such a file.
  // That back-fill is right for deciding whether to ask again and wrong for
  // quoting as "the occupancy it was written at", so this path must not quote it.
  assert.doesNotMatch(run.stdout, /85% of a context window/);
  assert.match(run.stdout, /is NOT recorded/);
});

test('a latch whose filename is not a lower-case id is still found by the scan', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  // `sanitizeSessionId` (ledger's) passes a lower-case id through and FOLDS
  // everything else to `<base>-<digest>`, so it is NOT idempotent: a scan that
  // rebuilt the path from the filename would append a second digest and open
  // nothing. This is the shape that would have gone unnoticed for years —
  // Claude Code issues lower-case UUIDs — and it fails as "no ask was ever
  // recorded", which is the reassuring wrong answer rather than an error.
  stampAsk(cwd, 'Session-With-Capitals-a1b2c3d4e5f6', 93, written - 7 * 60_000);
  const run = runHook(cwd, 'startup', 'a-brand-new-id');

  assert.match(run.stdout, /went out at 93% of a context window, 7m before the write/);
});

test('resume is untouched: no handover, and therefore no note about one', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  stampAsk(cwd, SESSION, 96, written - 60_000);
  const run = runHook(cwd, 'resume');

  assert.doesNotMatch(run.stdout, /READ THIS AS HISTORY/,
    'resume keeps the window it had; nothing is delivered, so nothing may be asserted about it');
  assert.doesNotMatch(run.stdout, /currently running/);
});

test('an unconfigured handover stays silent, note included', (t) => {
  const cwd = sandbox(t, false);
  writeHandover(cwd);
  const run = runHook(cwd, 'compact');

  assert.doesNotMatch(run.stdout, /READ THIS AS HISTORY/);
  assert.doesNotMatch(run.stderr, /READ THIS AS HISTORY/);
});

test('a configured handover that is MISSING gets no note in context', (t) => {
  const cwd = sandbox(t);
  const run = runHook(cwd, 'compact');

  assert.match(run.stderr, /reports\/H\.md/, 'the broken agreement is still disclosed to the user');
  assert.doesNotMatch(run.stdout, /READ THIS AS HISTORY/,
    'nothing was delivered, so there is nothing to call history');
});

test('THE WRITE PATH IS UNTOUCHED: the hook stamps nothing into state/', (t) => {
  const cwd = sandbox(t);
  const written = writeHandover(cwd);
  stampAsk(cwd, SESSION, 96, written - 60_000);
  const dir = path.join(cwd, '.my_context', 'state');
  const digest = (): string => readdirSync(dir).sort()
    .map((n) => `${n}:${readFileSync(path.join(dir, n), 'utf8')}`).join('\n');

  const before = digest();
  const run = runHook(cwd, 'compact');
  const after = digest();

  assert.match(run.stdout, /READ THIS AS HISTORY/, 'the note fired, so this is a live comparison');
  // The whole constraint that outranks this feature: a handover is written at
  // high occupancy by an assistant with almost no room left, and this must not
  // add an obligation to that side. A read path that stamped a latch — or reset
  // one — would be doing exactly that, and it would also put a false ask on a
  // status line.
  assert.equal(after, before, 'the read path wrote to state/; it must only read');
});
