// @basis TASK-a-counter-that-can-no-longer-be-written-reads-as-not-enough, TASK-four-failure-states-are-modelled-in-the-type-and-read-by, INV-nothing-is-dropped-silently, INV-hooks-fail-open
/**
 * **A count that is FROZEN is not a count that is low, and a trigger that
 * threw is not a trigger that is switched off.**
 *
 * Two failures from the same class, both in this one decision:
 *
 *  1. `bumpCounter` has always returned `written`, and its only caller dropped
 *     it. With `state/` unwritable, every turn printed *"review: no pass — 0
 *     of 25 tool call(s)"*. That is a true statement about the file. A reader
 *     takes it as *not enough activity yet*. The truth is that the subsystem
 *     can never fire again, and nothing anywhere said so.
 *  2. `reviewTrigger`'s catch returned `null`, and `null` on that function
 *     means OFF — so a bug bought itself the silence the kill switch earned.
 *
 * ── HOW THE COUNTER IS FROZEN, AND WHY IT IS THIS SHAPE ────────────────────
 *
 * `state/review-counter.json` is created as a DIRECTORY. `writeCounter` then
 * writes its temp file successfully and the RENAME onto a directory refuses,
 * which is the ordinary Windows shape of this failure and the one
 * `review-counter.ts` already documents; `readCounter`'s `readFileSync` on the
 * same path refuses too, so the count reads 0 forever. No permission bit is
 * involved: `icacls /deny` does not bite for the account this suite runs as
 * (measured 2026-09-14), so a test written against one would pass by never
 * failing.
 *
 * ── THE COST OF THE PROBE, ASSERTED RATHER THAN CLAIMED ────────────────────
 *
 * The fix asks the question by WRITING the state it just read. The last test
 * here holds that to its two promises: a healthy workspace's numbers are
 * unchanged by having been asked, and a workspace with the loop off is never
 * asked at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { reviewNote, reviewTrigger } from '../../src/review/trigger.ts';
import { bumpCounter, readCounter, reviewCounterPath } from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

function project(review: Record<string, unknown> | null): {
  cwd: string; root: string; transcript: string;
} {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-frozen-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  if (review !== null) {
    writeFileSync(
      path.join(root, 'config.json'),
      `${JSON.stringify({ profile: 'standard', review }, null, 2)}\n`,
    );
  }
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

/**
 * Freeze the counter, and PROVE the obstruction landed before asserting
 * anything about it — a setup that silently did nothing reports green for the
 * wrong reason.
 */
function freezeCounter(root: string): void {
  const file = reviewCounterPath(root);
  mkdirSync(file, { recursive: true });
  const before = readCounter(root);
  bumpCounter(root, 's-1');
  assert.deepEqual(
    readCounter(root), before,
    'the obstruction did not land — the counter still moves, so this proves nothing',
  );
}

test('a counter that can no longer be written says FROZEN, not "not enough yet"', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 25 });
  try {
    freezeCounter(root);
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision?.fire, false, 'a frozen counter must still not fire a pass');
    assert.equal(calls.length, 0);
    // The sentence itself, and the three things it has to carry: the file, the
    // word that separates frozen from low, and the consequence.
    assert.match(decision?.because ?? '', /cannot be written/);
    // **The PATH, and it was added because a mutation found it missing.**
    // Blanking the `${reviewCounterPath(root)}` interpolation left every other
    // assertion here green, so the row would have told a reader that "the
    // review counter" cannot be written without saying which file to look at —
    // and this row is the only place that fact is ever recorded.
    assert.ok(
      (decision?.because ?? '').includes(reviewCounterPath(root)),
      'the sentence does not name the file, so the reader has nothing to go and fix',
    );
    assert.match(decision?.because ?? '', /FROZEN/);
    assert.match(decision?.because ?? '', /no pass can become due/);
    // And it must NOT be the old sentence, which is the whole defect.
    assert.doesNotMatch(
      decision?.because ?? '', /0 of 25 tool call\(s\) since the last pass/,
      'the row still reads as "not enough activity yet", which is the defect',
    );
    assert.match(reviewNote(decision), /review: no pass/);
  } finally { removeTree(cwd); }
});

test('a healthy workspace still gets the plain interval sentence', () => {
  // Anti-vacuity: without this, deleting the probe's condition and reporting
  // FROZEN unconditionally would leave the test above green.
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 25 });
  try {
    bumpCounter(root, 's-1');
    const { fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.match(decision?.because ?? '', /1 of 25 tool call\(s\) since the last pass/);
    assert.doesNotMatch(decision?.because ?? '', /FROZEN/);
  } finally { removeTree(cwd); }
});

test('the probe writes back what it read and changes no number', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 25 });
  try {
    bumpCounter(root, 's-1');
    bumpCounter(root, 's-1');
    const before = readCounter(root);
    const { fn } = recordingSpawn();
    reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn);
    assert.deepEqual(
      readCounter(root), before,
      'the probe moved the count it was only asking about',
    );
  } finally { removeTree(cwd); }
});

test('with the loop off, nothing is probed and no state file appears', () => {
  // §11's kill switch: off writes NOTHING — not a zeroed counter file, not a
  // directory. The probe sits past gate 3, and this is what holds it there.
  const { cwd, root, transcript } = project({ enabled: false, everyNToolCalls: 1 });
  try {
    const { fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision, null);
    assert.equal(
      existsSync(reviewCounterPath(root)), false,
      'the switch is off and the subsystem left a trace anyway',
    );
  } finally { removeTree(cwd); }
});

/* ══ THE TRIGGER THAT THREW ════════════════════════════════════════════════ */

test('a trigger that throws past the switch reports a FAULT, not silence', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 1 });
  try {
    bumpCounter(root, 's-1');
    // **The throw is injected through `env`, and NOT through `spawnFn`.**
    // `spawnPass` catches a spawn failure itself and answers
    // `{ spawned: false, why }` — measured here first, where a throwing
    // `spawnFn` produced `fire: true` and never reached the catch. `env` is
    // read at `subagentDir`, which is past the kill switch and inside the
    // work, so this throws where a bug would.
    const boom = new Proxy({}, {
      get(): never { throw new Error('the environment exploded'); },
    }) as Record<string, string | undefined>;
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', undefined, boom,
    );
    assert.notEqual(
      decision, null,
      '`null` means OFF on this function, so a thrown bug answering `null` is silent',
    );
    assert.equal(decision?.fire, false);
    assert.match(decision?.because ?? '', /could not decide/);
    assert.match(decision?.because ?? '', /the environment exploded/);
    assert.match(decision?.because ?? '', /not the kill switch/);
    // And it reaches the row, which is the only durable place it can be read.
    assert.match(reviewNote(decision), /review: no pass — the trigger could not decide/);
  } finally { removeTree(cwd); }
});

/**
 * **A workspace the trigger cannot even locate stays silent** — gates 1 and 2,
 * which run on every directory on the machine including every one that never
 * heard of this feature.
 *
 * ── WHAT THIS TEST DOES NOT PROVE, SAID OUT LOUD ───────────────────────────
 *
 * It does not exercise the catch. Measured by removal on 2026-09-14: replacing
 * `if (!switchedOn) return null` with `if (false) return null` left this test
 * GREEN, because nothing here throws — gate 2's `findProjectRoot` returns
 * `null` and the function takes its ordinary early return.
 *
 * **That branch is defensive and is currently unreachable**, and the reason is
 * worth recording rather than leaving for somebody to rediscover: neither call
 * above the switch can throw. `findProjectRoot` is a directory walk over
 * `existsSync`, and `workspaceConfigAt` is `resolveWorkspace` inside its own
 * `try`/`catch` returning `null` (`core/handover-ask.ts`). So there is no seam
 * a test can push a throw through at that point, and the guard exists for the
 * edit that adds one — at which moment this comment is what says what it is
 * for.
 */
test('a workspace the trigger cannot even locate is silent on both channels', () => {
  const bare = mkdtempSync(path.join(tmpdir(), 'myctx-nowhere-'));
  try {
    const decision = reviewTrigger({ cwd: bare, session_id: 's-1' }, 'Stop');
    assert.equal(decision, null);
    assert.equal(reviewNote(decision), '');
  } finally { removeTree(bare); }
});
