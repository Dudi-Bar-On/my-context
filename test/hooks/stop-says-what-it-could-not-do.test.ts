// @basis TASK-four-failure-states-are-modelled-in-the-type-and-read-by, TASK-one-unreadable-transcript-directory-empties-the-conversation, TASK-a-transient-read-error-permanently-breaks-a-conversation, INV-nothing-is-dropped-silently, INV-hooks-fail-open
/**
 * **Four failure states that were modelled in the type and read by nothing,
 * plus the two the archive pass could not report.**
 *
 * `Stop`'s audit row is where a per-turn failure becomes findable. What it
 * could not say, and now can:
 *
 *  - the automatic anchor pass FAILED. `TurnAnchors` models it, and its own
 *    docblock says `failed` and `stood-down` are opposites — *"one is a defect
 *    and the other is the budget working"* — while only `stood-down` had a
 *    clause. So a failed pass looked like an ordinary quiet turn.
 *  - `ConversationRefresh.anchors` was written, returned, and read by nothing
 *    in `src/` or `test/`. It carries the one table no rebuild can re-derive.
 *  - the handover ask was withheld at high occupancy because the latch would
 *    not write, and nothing said so on any channel.
 *  - the transcript directory could not be read (`removed` used to be the
 *    whole archive, reported as sessions "no longer on disk").
 *  - a mark the mirror pass did nothing to, because a file would not answer.
 *
 * ── WHY `refreshNote` IS DRIVEN DIRECTLY ───────────────────────────────────
 *
 * It is a pure function over a report, and the report's failure states are
 * precisely what a real run will not produce on demand. `stop-conversation-
 * refresh.test.ts` already drives it this way for the states it covers; these
 * are the ones it did not.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { latchPath } from '../../src/core/handover-ask.ts';
import { writeTee } from '../../src/core/statusline-tee.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { observeAndRecord } from '../../src/hooks/observe.ts';
import { STOP, refreshNote, type ConversationRefresh } from '../../src/hooks/stop.ts';
import type { RebuildReport } from '../../src/core/conversation-index.ts';
import type { MirrorReport } from '../../src/core/conversation-mirror.ts';
import { removeTree } from '../helpers/tmp.ts';

const roots: string[] = [];
after(() => { for (const root of roots) removeTree(root); });

/** A report in which NOTHING moved — every clause below is what was added to it. */
const QUIET: RebuildReport = {
  dir: '/w', found: 1, scanned: 0, appended: 0, skipped: 1, removed: 0,
  unreadable: null, truncated: [], bytesRead: 0, ms: 2,
  subagents: {
    found: 0, scanned: 0, appended: 0, skipped: 0, removed: 0,
    truncated: [], unlinked: 0, bytesRead: 0,
  },
};

const QUIET_MIRROR: MirrorReport = {
  dir: '/kept', marked: 1, advanced: 0, bytesWritten: 0,
  orphaned: [], broken: [], cleared: [], unreadable: [],
  redacted: [], redactedBytesWritten: 0, ms: 1,
};

function note(over: Partial<ConversationRefresh>): string {
  return refreshNote({ ...QUIET, ...over } as ConversationRefresh);
}

/* ══ 1. THE ANCHOR PASS THAT FAILED ════════════════════════════════════════ */

test('a quiet turn is still silent — the baseline every clause below is measured against', () => {
  assert.equal(note({}), '');
  assert.equal(
    note({ autoAnchors: { did: 'ran', report: null as never } }), '',
    'a pass that ran and found nothing is the ordinary turn',
  );
});

test('an anchor pass that FAILED gets a clause, beside the stand-down it was confused with', () => {
  const failed = note({ autoAnchors: { did: 'failed' } });
  assert.match(failed, /automatic anchor pass FAILED/);
  assert.match(failed, /not marked/, 'the clause must say what it cost');
  assert.match(failed, /next turn will try again/, 'and whether it recovers on its own');

  // The stand-down still says its own, different thing. A clause that covered
  // both would put a defect and the budget working under one sentence.
  const stood = note({ autoAnchors: { did: 'stood-down', leftMs: 120 } });
  assert.match(stood, /stood down with 120ms/);
  assert.doesNotMatch(stood, /FAILED/);
});

test('an ABSENT autoAnchors is not a failure, because nobody measured one', () => {
  // `refreshNote` defaults a missing field to `{ did: 'failed' }` so its own
  // extraction has one shape to handle. That default is a convenience, not a
  // measurement, and turning it into a reported failure would be exactly the
  // unmeasured-drawn-as-measured defect in the line that exists to stop it.
  assert.equal(note({ autoAnchors: undefined }), '');
});

/* ══ 2. THE ANCHORS FILE, WRITTEN AND RETURNED AND READ BY NOTHING ═════════ */

test('the turn that writes .anchors.jsonl for the first time says so — once per corpus', () => {
  const adopted = note({ anchors: { direction: 'adopted', rows: 565 } });
  assert.match(adopted, /565 anchor\(s\) were written into `\.anchors\.jsonl` for the first time/);
  assert.match(adopted, /no rebuild can re-derive/);
});

test('the ordinary reconciliation stays silent, and a FAILED one does not', () => {
  assert.equal(
    note({ anchors: { direction: 'restored', rows: 565 } }), '',
    'restored is every turn after the first, and a per-turn clause is a clause nobody reads',
  );
  assert.equal(
    note({ anchors: { direction: 'none', rows: 0 } }), '',
    'a :memory: run has no file to hold; that is a fact about the run, not the turn',
  );
  const failed = note({ anchors: null });
  assert.match(failed, /anchors file could not be reconciled/);
  assert.match(failed, /an index deleted before the next turn would lose/);
});

/* ══ 3. THE ARCHIVE THAT WAS NOT MEASURED ═════════════════════════════════ */

test('an unreadable transcript directory says so INSTEAD of blaming deleted files', () => {
  const said = note({ unreadable: 'EACCES: permission denied' });
  assert.match(said, /could not be read \(EACCES: permission denied\)/);
  assert.match(said, /NO indexed session was dropped/);
  assert.match(said, /are still indexed and are not gone/);
  // The sentence the item is named for must NOT appear: it is confident,
  // specific, and its cause is wrong.
  assert.doesNotMatch(said, /no longer on disk/);
});

test('and a directory that WAS read still reports what it genuinely dropped', () => {
  // Anti-vacuity for the clause above: the removal sentence is correct when the
  // archive really was measured, and must survive.
  const said = note({ removed: 2 });
  assert.match(said, /2 indexed session\(s\) no longer on disk/);
  assert.doesNotMatch(said, /could not be read/);
});

/* ══ 4. THE MIRROR MARKS NOTHING HAPPENED TO ══════════════════════════════ */

test('a mark the mirror pass could not check is named, and named as untouched', () => {
  const said = note({
    mirror: {
      ...QUIET_MIRROR,
      unreadable: [{ sessionId: 's-one', why: 'the copy is on disk and is not a file' }],
    },
  });
  assert.match(said, /1 mark\(s\) left untouched because a file would not answer/);
  assert.match(said, /s-one/);
  assert.match(said, /nothing dropped, nothing stamped, retried next turn/);
});

test('a mirror pass with nothing wrong is silent about unreadable marks', () => {
  assert.equal(note({ mirror: QUIET_MIRROR }), '');
});

/* ══ 5. THE HANDOVER ASK WITHHELD BY AN UNWRITABLE LATCH ══════════════════ */

function sandbox(): { cwd: string; root: string; session: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-stop-latch-'));
  roots.push(cwd);
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot;
  assert.ok(root, 'the sandbox has no workspace');
  const file = path.join(root, 'config.json');
  const raw = existsSync(file)
    ? JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>
    : {};
  writeFileSync(
    file,
    JSON.stringify({ ...raw, handover: { path: 'reports/H.md', thresholdPercent: 70 } }, null, 2),
    'utf8',
  );
  return { cwd, root, session: 'sess-latch' };
}

function sampleAt(percent: number, window = 200_000): Record<string, unknown> {
  return {
    context_window: {
      context_window_size: window,
      current_usage: {
        input_tokens: (window * percent) / 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0,
      },
    },
  };
}

/** One assistant turn, with the status-line bridge at `percent`. */
function runStop(sb: { cwd: string; root: string; session: string }, percent: number): {
  stdout: string; stderr: string;
} {
  assert.deepEqual(
    writeTee(sb.root, { session_id: sb.session, ...sampleAt(percent) }, new Date().toISOString()),
    { written: true }, 'the status-line fixture was not written',
  );
  let stderr = '';
  const realWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    stderr += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8');
    return true;
  }) as typeof process.stderr.write;
  let outcome: { stdout: string };
  try {
    outcome = observeAndRecord(
      STOP,
      { session_id: sb.session, cwd: sb.cwd, hook_event_name: 'Stop', stop_hook_active: false },
      sb.cwd,
    );
  } finally { process.stderr.write = realWrite; }
  return { stdout: outcome.stdout, stderr };
}

/**
 * Block the latch by putting a DIRECTORY where its file goes, and prove the
 * obstruction landed. `icacls /deny` does not bite for the account this suite
 * runs as (measured 2026-09-14), so a permission-based fixture would pass by
 * never failing.
 */
function blockLatch(root: string, session: string): void {
  const file = latchPath(root, session);
  mkdirSync(path.dirname(file), { recursive: true });
  mkdirSync(file, { recursive: true });
  let threw = false;
  try { writeFileSync(file, '{}', 'utf8'); } catch { threw = true; }
  assert.equal(threw, true, 'the obstruction did not land — the latch is still writable');
}

test('an ask withheld because the latch will not write SAYS SO', () => {
  const sb = sandbox();
  blockLatch(sb.root, sb.session);
  const turn = runStop(sb, 91);
  // The ask itself is still withheld — that decision is not being reopened.
  assert.equal(
    turn.stdout, '',
    'an ask with no latch behind it repeats on every turn, which is the loop',
  );
  assert.match(turn.stderr, /the handover ask was WITHHELD/);
  assert.match(turn.stderr, /could not be written/);
  assert.match(turn.stderr, /reports\/H\.md/, 'the person has to be told WHICH document');
  assert.match(turn.stderr, /do it by hand, now/);
  assert.match(turn.stderr, /Nothing was blocked\./);
});

test('an ask that latched normally says nothing on stderr and DOES ask', () => {
  // Anti-vacuity: without this, writing the withheld line unconditionally
  // would leave the test above green.
  const sb = sandbox();
  const turn = runStop(sb, 91);
  assert.notEqual(turn.stdout, '', 'the ask did not go out, so this proves nothing');
  assert.doesNotMatch(turn.stderr, /WITHHELD/);
});
