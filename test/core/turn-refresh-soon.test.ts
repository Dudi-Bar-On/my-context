/**
 * @basis RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
 *
 * RESTS ON: none, with a reason. There is no item — the owner asked for this
 * change directly on 2026-09-16 and said not to file it: *"i want you to
 * improve it now - do not file it just improve"*. The argument it has to keep
 * is written in `src/core/turn-refresh-soon.ts`'s header and is asserted here
 * rather than cited.
 *
 * It DOES rest on one store entry, and that one is load-bearing:
 * `nothing-to-do-and-could-not-look-are-different-answers`. Three of the tests
 * below exist only because of it.
 *
 * WHAT THIS IS ABOUT. `stopConversationRefresh` used to run in exactly one
 * place — the `Stop` hook — so the index scan, the mirror and the anchor pass
 * all happened at end of turn. Measured on the turn that prompted the change:
 * 85 records and 277,601 bytes were written between a table appearing and its
 * mark existing. `PostToolUse` now asks a cheap question after every tool call
 * and spawns the same refresh detached when the answer is yes.
 *
 * WHY THE DECISION IS A PURE FUNCTION. `refreshSoonDecision` takes the size
 * already read, so every branch is reachable from a test — including
 * `could-not-look`, which no portable filesystem trick produces reliably on
 * both Windows and POSIX. The reading half is tested through `refreshSoonCheck`
 * against real files.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  REFRESH_SOON_GAP_MS, REFRESH_SOON_GROWTH_BYTES,
  refreshSoonCheck, refreshSoonDecision, refreshSoonStatePath,
  readRefreshSoonState, writeRefreshSoonState,
} from '../../src/core/turn-refresh-soon.ts';

const NOW = 1_700_000_000_000;
const base = { at: NOW - REFRESH_SOON_GAP_MS - 1, size: 1_000_000 };

test('a transcript that grew enough, long enough ago, is due', () => {
  const got = refreshSoonDecision({
    size: base.size + REFRESH_SOON_GROWTH_BYTES, state: base, now: NOW,
  });
  assert.equal(got.due, true,
    'this is the whole feature: a long turn gets its refresh while it is still running');
  assert.equal(got.due === true ? got.grown : -1, REFRESH_SOON_GROWTH_BYTES);
});

test('a tick inside the gap is not due, however much the transcript grew', () => {
  const got = refreshSoonDecision({
    size: base.size + 10_000_000,
    state: { ...base, at: NOW - 1 },
    now: NOW,
  });
  assert.equal(got.due, false,
    'PostToolUse fired 85 times in one measured turn; without this bound a busy turn '
    + 'would spawn a refresh per tool call');
  assert.equal(got.due === false ? got.why : '', 'too-soon');
});

test('a tick that waited long enough but saw almost no growth is not due', () => {
  const got = refreshSoonDecision({
    size: base.size + REFRESH_SOON_GROWTH_BYTES - 1, state: base, now: NOW,
  });
  assert.equal(got.due, false,
    'a turn that emits one short answer and waits must cost nothing; Stop still catches it');
  assert.equal(got.due === false ? got.why : '', 'too-little');
});

/**
 * **A SHRINK IS NOT GROWTH, AND THE SIGN IS THE ASSERTION.**
 *
 * A transcript only ever appends, so a smaller one is a REPLACED one — these
 * offsets describe a different file. That is `Stop`'s business (it has a whole
 * `shrank` branch for it) and never a reason to spawn from here. Written as
 * its own test because `Math.max(0, grown)` is the obvious wrong repair and it
 * would pass every other test in this file.
 */
test('a transcript that SHRANK is never due — a replacement is not growth', () => {
  const got = refreshSoonDecision({ size: 10, state: base, now: NOW });
  assert.equal(got.due, false);
  assert.equal(got.due === false ? got.why : '', 'too-little');
});

/**
 * **THE THREE ANSWERS, AND THEY MAY NEVER SHARE A VALUE** —
 * `nothing-to-do-and-could-not-look-are-different-answers`.
 *
 * `could-not-look` is a stat that refused for a reason that is not absence:
 * this tick learned NOTHING about the transcript. Reporting it as `too-little`
 * would tell the caller the file had not grown, which is a claim about the
 * world that nobody measured. `absent` is the measured zero — a session the
 * harness pruned. Both are `due: false` and that is correct; what must differ
 * is the REASON, because only one of them means "ask again and you may learn
 * something".
 */
test('a stat that could not look is a different answer from one that measured nothing', () => {
  const blind = refreshSoonDecision({ size: null, state: base, now: NOW });
  const gone = refreshSoonDecision({ size: 'absent', state: base, now: NOW });
  const quiet = refreshSoonDecision({ size: base.size, state: base, now: NOW });

  assert.equal(blind.due === false ? blind.why : '', 'could-not-look');
  assert.equal(gone.due === false ? gone.why : '', 'absent');
  assert.equal(quiet.due === false ? quiet.why : '', 'too-little');

  const whys = new Set([blind, gone, quiet].map((d) => (d.due === false ? d.why : 'due')));
  assert.equal(whys.size, 3,
    'three states, three values — collapsing any two of them is the defect the store entry names');
});

/**
 * **THE FIRST TICK OF A SESSION RECORDS A BASELINE AND SPAWNS NOTHING.**
 *
 * Without this, every session would pay a refresh on its first tool call — the
 * moment the index is least likely to be behind and the machine is busiest.
 * The cost of not spawning is nil: `Stop` has always refreshed at end of turn.
 */
test('no baseline means record one, not spawn one', () => {
  const got = refreshSoonDecision({ size: 5_000_000, state: null, now: NOW });
  assert.equal(got.due, false);
  assert.equal(got.due === false ? got.why : '', 'too-soon');
});

test('refreshSoonCheck reads a real file, writes the baseline, and becomes due on the next tick', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-soon-'));
  try {
    const transcript = path.join(root, 'session.jsonl');
    writeFileSync(transcript, 'x'.repeat(1_000));
    const sessionId = 'sess-1';

    const first = refreshSoonCheck({
      transcriptPath: transcript, projectRoot: root, sessionId, now: NOW,
    });
    assert.equal(first.due, false, 'first tick takes the baseline');
    const state = readRefreshSoonState(refreshSoonStatePath(root, sessionId));
    assert.notEqual(state, null, 'and it must actually be written, or no tick is ever due');
    assert.equal(state?.size, 1_000);

    // Not enough growth yet, even though the gap has passed.
    writeFileSync(transcript, 'x'.repeat(1_000 + REFRESH_SOON_GROWTH_BYTES - 1));
    const second = refreshSoonCheck({
      transcriptPath: transcript, projectRoot: root, sessionId, now: NOW + REFRESH_SOON_GAP_MS + 1,
    });
    assert.equal(second.due, false);

    writeFileSync(transcript, 'x'.repeat(1_000 + REFRESH_SOON_GROWTH_BYTES));
    const third = refreshSoonCheck({
      transcriptPath: transcript, projectRoot: root, sessionId, now: NOW + REFRESH_SOON_GAP_MS + 2,
    });
    assert.equal(third.due, true, 'grown enough, waited long enough');

    const moved = readRefreshSoonState(refreshSoonStatePath(root, sessionId));
    assert.equal(moved?.size, 1_000 + REFRESH_SOON_GROWTH_BYTES,
      'the baseline moves ON THE SPAWN, so the next gap is measured from this refresh');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * **AND THE READER MUST MAKE THE SAME DISTINCTION THE DECIDER DOES.**
 *
 * Found by a removal proof that reddened NOTHING: collapsing `sizeOf`'s ENOENT
 * branch into `null` — "a pruned transcript is a stat that refused" — left
 * every test above green, because they all hand `refreshSoonDecision` a size
 * that was already read. Their power was borrowed from a caller none of them
 * exercised. So this one goes through the real filesystem with a real missing
 * file and asserts the reason that comes back.
 */
test('a transcript that is not there reads as absent, never as could-not-look', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-soon-'));
  try {
    const sessionId = 'sess-gone';
    // A baseline, so the gap and growth branches cannot be what answers.
    writeRefreshSoonState(refreshSoonStatePath(root, sessionId),
      { size: 1_000, at: NOW - REFRESH_SOON_GAP_MS - 1 });
    const got = refreshSoonCheck({
      transcriptPath: path.join(root, 'never-written.jsonl'),
      projectRoot: root, sessionId, now: NOW,
    });
    assert.equal(got.due, false);
    assert.equal(got.due === false ? got.why : '', 'absent',
      'ENOENT is the only errno that means absence; every other refusal is a tick that '
      + 'did not learn, and the two must not share a value');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * A payload with no transcript path is not an error and not a growth
 * measurement — it is a firing this feature has nothing to say about.
 */
test('a payload with no transcript path is answered as such, not as nothing-to-do', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-soon-'));
  try {
    const got = refreshSoonCheck({
      transcriptPath: undefined, projectRoot: root, sessionId: 'sess-2', now: NOW,
    });
    assert.equal(got.due, false);
    assert.equal(got.due === false ? got.why : '', 'no-transcript-path');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

/**
 * **A HOOK MAY NOT FAIL BECAUSE A CONVENIENCE FILE WOULD NOT WRITE** —
 * `INV-hooks-fail-open`. The state file is an optimisation; losing it costs
 * latency and nothing else, because `Stop` still refreshes at end of turn.
 */
test('an unwritable state directory does not throw', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-refresh-soon-'));
  try {
    // `state` as a FILE where a directory must go: mkdir then refuses.
    mkdirSync(root, { recursive: true });
    writeFileSync(path.join(root, 'state'), 'not a directory');
    assert.doesNotThrow(() => {
      writeRefreshSoonState(refreshSoonStatePath(root, 'sess-3'), { size: 1, at: NOW });
    });
    assert.doesNotThrow(() => {
      refreshSoonCheck({
        transcriptPath: path.join(root, 'nope.jsonl'), projectRoot: root,
        sessionId: 'sess-3', now: NOW,
      });
    });
  } finally { rmSync(root, { recursive: true, force: true }); }
});
