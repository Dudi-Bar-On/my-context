// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m7, the first half: `readCounter` answered `{...FRESH}` for
 * a state file it could not read.**
 *
 * `core/review-counter.ts` argues its type check at length — *"a half-read
 * state file is worse than no state file, because the half that survives is a
 * ration the trigger would obey"* — and the argument is for the SHAPE. It is
 * not an argument for the CONFLATION, which is what report 3 names: zeros for
 * a file that was never written and zeros for a file that is there and could
 * not be used are the same three numbers, and one of them is a measurement.
 *
 * **What the conflation costs is the ration, not the count.** `fires` reading
 * `0` for an unreadable file restores a session's whole budget: the gate at
 * `trigger.ts` step 4 lets the pass through, `resetCounter` writes `fires: 1`
 * over whatever was really there, and a session that had spent its ration gets
 * another one on every turn the file stays unreadable. The verdict the hook
 * records for that turn says *"0 of 25 tool call(s) since the last pass"* —
 * true about the numbers it holds, and silent about the fact that it does not
 * hold the session's numbers at all.
 *
 * ── THE DISCLOSURE ROUTE IS THE ONE ALREADY THERE ─────────────────────────
 *
 * No new channel. `TriggerVerdict.because` is the sentence
 * `TASK-a-counter-that-can-no-longer-be-written-reads-as-not-enough` already
 * built for the frozen-counter case, and it already travels into the audit row
 * the hook was writing anyway. This rides it, exactly as `FROZEN` does.
 *
 * ── AND NO FILE AT ALL IS NOT A FAILURE ───────────────────────────────────
 *
 * The last test is the anti-vacuity half and it is the one that keeps this
 * honest: the first turn of every session in the world reads no counter file,
 * and if that reported "could not be read" the sentence would appear
 * everywhere and mean nothing. Only a file that EXISTS and could not be turned
 * into a state is a disclosure — the item's own first question, *is the
 * condition IDENTIFIED*.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { reviewTrigger } from '../../src/review/trigger.ts';
import { bumpCounter, readCounter, reviewCounterPath } from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

function project(review: Record<string, unknown>): {
  cwd: string; root: string; transcript: string;
} {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-unread-counter-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  writeFileSync(
    path.join(root, 'config.json'),
    `${JSON.stringify({ profile: 'standard', review }, null, 2)}\n`,
  );
  // `state/` is created by the first write the counter makes; these tests
  // plant the file instead, so they make the directory themselves.
  mkdirSync(path.dirname(reviewCounterPath(root)), { recursive: true });
  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript, `${record('something was decided', '2026-09-10T01:00:00Z')}\n`, 'utf8');
  return { cwd, root, transcript };
}

/** A `spawn` stand-in that records rather than starting anything. */
function recordingSpawn(): { calls: unknown[][]; fn: any } {
  const calls: unknown[][] = [];
  const fn = (command: string, args: string[], options: unknown) => {
    calls.push([command, args, options]);
    return { pid: 4242, on: () => {}, unref: () => {} };
  };
  return { calls, fn };
}

test('a counter file that is there and will not parse is NAMED, not read as zero', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 25 });
  try {
    // Written by hand rather than corrupted through the API, because the
    // subject is a file this process did not produce: a torn write, a half
    // flush, an editor that saved over it.
    writeFileSync(reviewCounterPath(root), '{"calls": 12, "fires": 3, "sessi', 'utf8');

    const state = readCounter(root);
    assert.equal(state.calls, 0, 'the numbers are still the honest zeros');
    assert.ok(
      state.unread !== null,
      'the state is three zeros with nothing saying they were not measured',
    );
    assert.ok(
      state.unread!.includes(reviewCounterPath(root)),
      'the reason does not name the file, so the reader has nothing to go and look at',
    );

    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision?.fire, false);
    assert.equal(calls.length, 0);
    // The row the hook writes has to carry it. Without this the whole fix is a
    // field nobody reads, which is the defect one layer up.
    assert.ok(
      (decision?.because ?? '').includes(reviewCounterPath(root)),
      'the recorded verdict still reads as a measured count of zero',
    );
    assert.match(decision?.because ?? '', /could not be read/);
  } finally { removeTree(cwd); }
});

test('an unreadable counter does not silently hand the session a fresh ration', () => {
  // The ration gate is the one that matters, and it is the one a measured zero
  // walks straight through: `fires: 0` for a file nobody could read is a
  // budget restored on the strength of nothing.
  const { cwd, root, transcript } = project(
    { enabled: true, everyNToolCalls: 1, maxFiresPerSession: 1 },
  );
  try {
    writeFileSync(reviewCounterPath(root), '[1, 2, 3]\n', 'utf8');
    const { fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.ok(
      (decision?.because ?? '').includes(reviewCounterPath(root)),
      'a pass was decided on a ration read out of a file nobody could read, and the row is silent',
    );
  } finally { removeTree(cwd); }
});

test('a counter that reads cleanly says nothing, and no file at all is not a failure', () => {
  // Two controls in one, and both are needed: a sentence that appears on every
  // healthy turn is a sentence with no information in it, and the FIRST turn of
  // every session in the world reads no counter file at all.
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 25 });
  try {
    assert.equal(
      readCounter(root).unread, null,
      'no counter file has ever been written here — that is absence, not a failure',
    );
    bumpCounter(root, 's-1');
    assert.equal(readCounter(root).unread, null, 'a counter this process just wrote reads clean');

    const { fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.match(decision?.because ?? '', /1 of 25 tool call\(s\) since the last pass/);
    assert.doesNotMatch(decision?.because ?? '', /could not be read/);
  } finally { removeTree(cwd); }
});
