// @basis TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// INV-hooks-fail-open, INV-nothing-is-dropped-silently
//
// The two assertions here that are not conveniences:
//   - `Stop` returns without waiting. That is the hook where a person is
//     staring at a prompt, and it is asserted rather than assumed.
//   - the kill switch KILLS: with `enabled: false` no child is spawned AT ALL.
//     Upstream's issue #82708 shipped a switch that did not, because a second
//     path created anyway — so the assertion is about the spawn, never about
//     what the child did once it existed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { passReportPath, runPass, spawnPass } from '../../src/review/pass.ts';
import { reviewNote, reviewTrigger } from '../../src/review/trigger.ts';
import { NO_QUEUE_CEILING } from '../../src/review/propose.ts';
import { bumpCounter, readCounter } from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

const RULING = 'The owner ruling is that the pass reads and reports and creates nothing, ' +
  'because a loop that writes before it is trusted is a loop nobody can turn off.';

function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

/** A workspace with a `review` block, and a transcript beside it. */
function project(review: Record<string, unknown> | null, lines: string[] = [record(RULING, '2026-09-10T01:00:00Z')]): {
  cwd: string; root: string; transcript: string;
} {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-pass-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  if (review !== null) {
    writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({ profile: 'standard', review }, null, 2) + '\n',
    );
  }
  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript, lines.map((l) => `${l}\n`).join(''), 'utf8');
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

// ── THE PASS ITSELF ────────────────────────────────────────────────────────

test('the pass writes a report and creates NOTHING', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    const before = runCli(['list'], cwd, () => {});
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(report.dryRun, true);
    assert.deepEqual(report.created, [], 'phase 2 creates nothing, and it is a FIELD not a promise');
    assert.ok(existsSync(passReportPath(root)));
    assert.equal(before, runCli(['list'], cwd, () => {}), 'the corpus listing changed');
  } finally { removeTree(cwd); }
});

test('the report leads with what it read, and the wholeness line is a field', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    const report = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(report.whole, true);
    assert.match(report.wholeness, /^read WHOLE:/);
    assert.ok(report.records >= 1);
    assert.ok(report.points.length >= 1);
    assert.match(report.rubric.because, /.+/, 'the rubric verdict is recorded either way');
    const onDisk = JSON.parse(readFileSync(passReportPath(root), 'utf8')) as { wholeness: string };
    assert.equal(onDisk.wholeness, report.wholeness);
  } finally { removeTree(cwd); }
});

test('a second pass sends only the new stretch, and says where it stopped', async () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    const first = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    });
    writeFileSync(
      transcript,
      readFileSync(transcript, 'utf8') + `${record(RULING, '2026-09-10T02:00:00Z')}\n`,
      'utf8',
    );
    const second = await runPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(second.sinceByte, first.readTo, 'the second pass resumed where the first stopped');
    assert.ok(second.readTo > first.readTo);
    assert.equal(second.records, 2, 'and it READ both records, having returned only one');
    assert.ok(second.points.every((p) => p.recordIndex >= 1));
  } finally { removeTree(cwd); }
});

test('a pass over a transcript that is not there reports the shortfall, not an empty session', async () => {
  const { cwd, root } = project({ enabled: true });
  try {
    const report = await runPass({
      workspace: root, transcript: path.join(cwd, 'gone.jsonl'), sessionId: 's-1',
      subagentDir: null, includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(report.whole, false);
    assert.match(report.wholeness, /NOT read whole/);
    assert.match(report.wholeness, /FLOOR/);
  } finally { removeTree(cwd); }
});

// ── THE SPAWN ──────────────────────────────────────────────────────────────

test('the child is detached, silent, and unref’ed', () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    const { calls, fn } = recordingSpawn();
    const outcome = spawnPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: true, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    }, fn);
    assert.equal(outcome.spawned, true);
    assert.equal(calls.length, 1);
    const options = calls[0]?.[2] as { detached?: boolean; stdio?: string };
    assert.equal(options.detached, true, 'a child that is not detached dies with the hook');
    assert.equal(options.stdio, 'ignore', 'a child holding a pipe holds the hook open');
  } finally { removeTree(cwd); }
});

test('a spawn that cannot start is a reported failure, never a throw', () => {
  const { cwd, root, transcript } = project({ enabled: true });
  try {
    // `pid === undefined` is what Node actually gives for an exec failure — see
    // `openBrowser`'s header, which measured it on v24.14.0. A fake that THREW
    // would prove the wrong control flow, which is the mistake that header records.
    const fn: any = () => ({ pid: undefined, on: () => {}, unref: () => {} });
    const outcome = spawnPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null,
      includeSubagents: true, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
    }, fn);
    assert.equal(outcome.spawned, false);
    assert.match(outcome.why ?? '', /could not be started/);
  } finally { removeTree(cwd); }
});

// ── THE KILL SWITCH ────────────────────────────────────────────────────────

test('with review off, NO CHILD IS SPAWNED AT ALL', () => {
  // `everyNToolCalls: 1` on the second case is deliberate: with the default
  // interval the counter gate would decline first, and this test would stay
  // green with the switch removed — measured, on 2026-09-10, by removing it.
  // The switch has to be the ONLY thing standing between the payload and a
  // spawn, or the assertion is about the interval.
  const cases: (Record<string, unknown> | null)[] = [null, { enabled: false, everyNToolCalls: 1 }];
  for (const review of cases) {
    const { cwd, root, transcript } = project(review);
    try {
      bumpCounter(root, 's-1');
      const { calls, fn } = recordingSpawn();
      const decision = reviewTrigger(
        { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
      );
      assert.equal(decision, null, 'the switch is off, so there is no verdict to report');
      assert.equal(calls.length, 0, 'THE KILL SWITCH DID NOT KILL — a child was spawned');
      assert.equal(reviewNote(decision), '', 'and it says nothing in the row either');
    } finally { removeTree(cwd); }
  }
});

test('with review off the counter is not even spent', () => {
  const { cwd, root, transcript } = project({ enabled: false, everyNToolCalls: 1 });
  try {
    bumpCounter(root, 's-1');
    const { fn } = recordingSpawn();
    reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn);
    assert.equal(readCounter(root).fires, 0);
    assert.equal(readCounter(root).calls, 1, 'the switch does not consume state either');
  } finally { removeTree(cwd); }
});

// ── THE TRIGGER'S GATES ────────────────────────────────────────────────────

test('under the interval, it declines and says how far off it is', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 5 });
  try {
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision?.fire, false);
    assert.equal(calls.length, 0);
    assert.match(decision?.because ?? '', /1 of 5 tool call/);
    assert.match(reviewNote(decision), /no pass/);
  } finally { removeTree(cwd); }
});

test('over the interval, it fires once and spends a fire', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 2 });
  try {
    bumpCounter(root, 's-1');
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision?.fire, true);
    assert.equal(decision?.spawned, true);
    assert.equal(calls.length, 1);
    assert.equal(readCounter(root).calls, 0, 'the interval restarts');
    assert.equal(readCounter(root).fires, 1, 'and the ration is one down');
    assert.match(reviewNote(decision), /pass 1 of the session started/);
  } finally { removeTree(cwd); }
});

test('the ration is a hard stop, and it says so', () => {
  const { cwd, root, transcript } = project({
    enabled: true, everyNToolCalls: 1, maxFiresPerSession: 1,
  });
  try {
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    assert.equal(reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn)?.fire, true);
    bumpCounter(root, 's-1');
    const second = reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn);
    assert.equal(second?.fire, false);
    assert.equal(calls.length, 1, 'the ration was not enforced — a second child was spawned');
    assert.match(second?.because ?? '', /ration of 1 pass\(es\) is spent/);
  } finally { removeTree(cwd); }
});

test('a lane finishing does not fire the parent’s pass', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 1 });
  try {
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript, agent_id: 'agent-a1' }, 'Stop', fn,
    );
    assert.equal(decision, null);
    assert.equal(
      calls.length, 0,
      'a fan-out of ten lanes would otherwise be ten passes over one transcript, at once',
    );
  } finally { removeTree(cwd); }
});

test('PreCompact waives the interval, because the window is about to go', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 500 });
  try {
    bumpCounter(root, 's-1');
    const stop = recordingSpawn();
    assert.equal(
      reviewTrigger({ cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', stop.fn)?.fire,
      false, 'far under the interval, Stop must decline',
    );
    const pre = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'PreCompact', pre.fn,
    );
    assert.equal(decision?.fire, true);
    assert.equal(pre.calls.length, 1);
    assert.match(decision?.because ?? '', /about to be compacted/);
  } finally { removeTree(cwd); }
});

test('onPreCompact: false leaves PreCompact under the same interval as Stop', () => {
  const { cwd, root, transcript } = project({
    enabled: true, everyNToolCalls: 500, onPreCompact: false,
  });
  try {
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'PreCompact', fn,
    );
    assert.equal(decision?.fire, false);
    assert.equal(calls.length, 0);
  } finally { removeTree(cwd); }
});

test('nothing new since the last pass is not worth a fire', () => {
  const { cwd, root, transcript } = project({ enabled: true, everyNToolCalls: 1 });
  try {
    mkdirSync(path.join(root, 'state'), { recursive: true });
    const bytes = readFileSync(transcript).length;
    writeFileSync(
      passReportPath(root),
      JSON.stringify({ readTo: bytes, dryRun: true }, null, 2),
      'utf8',
    );
    bumpCounter(root, 's-1');
    const { calls, fn } = recordingSpawn();
    const decision = reviewTrigger(
      { cwd, session_id: 's-1', transcript_path: transcript }, 'Stop', fn,
    );
    assert.equal(decision?.fire, false);
    assert.equal(calls.length, 0);
    assert.match(decision?.because ?? '', /no new bytes/);
    assert.equal(readCounter(root).fires, 0, 'and a declined consideration costs no ration');
  } finally { removeTree(cwd); }
});
