// @basis TASK-the-summary-is-staged-to-disk-reviewed-as-numbered-points, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **Step 7: the next injection reads the staged file and delivers it into the
 * window the owner just emptied** — `plan:restore seq:2`, design §3 and §6.
 *
 * Steps 1-5 are `test/core/restore-stage.test.ts`. This file is the other end:
 * what the injection does with what is on disk, and what it refuses to do.
 *
 *   1. **An APPROVED restore is delivered, whole.** Not summarised again, not
 *      capped, not tiered — *"NO BUDGET MANAGEMENT, owner ruling, explicit"* —
 *      so the assertion is byte-identity on a payload larger than every budget
 *      this product has.
 *   2. **A PROPOSED one is never delivered.** An agent may build; only the
 *      owner releases. This is the assertion that fails if the approval gate
 *      is ever moved, widened or defaulted.
 *   3. **It is one-shot**, exactly as `mycontext carry` is: spent by the
 *      injection that read it, and the record says so afterwards.
 *   4. **The loop guard holds across the whole round trip.** Design §6: an
 *      injected summary joins the transcript like everything else, so a later
 *      build would summarise the summary. Build, INJECT FOR REAL, put the
 *      injected text back into a transcript, build again, and assert the
 *      second build did not ingest the first — and counted what it dropped.
 *   5. **A broken staged restore costs the restore, never the injection.**
 *      `INV-hooks-fail-open`, on the one session start where a silent crash
 *      would land on a window that has just been emptied on purpose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { buildInjection } from '../../src/core/inject.ts';
import { loadStagedRestore, restoreStagingFile } from '../../src/core/restore-staging.ts';
import {
  approveStagedRestore, buildRestoreProposal, stageRestoreSummary,
} from '../../src/core/restore-stage.ts';
import { spendApprovedRestore } from '../../src/core/restore-store.ts';
import {
  SESSION_SUMMARY_MARKER, summariseTranscript,
} from '../../src/core/session-summary.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A workspace with one governing item, so an injection has something of its own to say. */
function sandbox(): { cwd: string; root: string; dispose(): void } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-restore-deliver-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const file = path.join(cwd, '.my_context', 'items', 'constraint', 'CONST-pool.md');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: CONST-pool
type: constraint
title: Pool capped at 20
status: active
severity: hard
always: true
---

# Pool capped at 20

Body text.
`);
  return { cwd, root: path.join(cwd, '.my_context'), dispose: () => removeTree(cwd) };
}

function answer(text: string, at = '2026-09-07T10:00:00.000Z'): unknown {
  return { type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

function transcript(lines: unknown[]): { file: string; dir: string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-restore-tx-'));
  const file = path.join(dir, 'session.jsonl');
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  return { file, dir, dispose: () => removeTree(dir) };
}

const MATERIAL: unknown[] = [
  answer('We ruled that the index is derived, because losing it costs time and never knowledge.'),
  answer('I was wrong about the filter: it is structural, not a whitelist of record types.'),
  answer('Measured: of 24,757 records, 15,788 carry no message object at all — 64% of the file.'),
  answer('We tried a global top-60 and it failed: 45 of 60 slots went to measurements.'),
  answer('Still open: whether thinking blocks should be scored, and that waits on the owner.'),
];

/** Build, stage and approve in one step — steps 2 to 5, as the owner would drive them. */
function approved(root: string, file: string, payload?: string): { key: string; payload: string } {
  const built = buildRestoreProposal(file);
  const proposal = payload === undefined ? built : { ...built, payload };
  const staged = stageRestoreSummary(root, proposal);
  assert.equal(staged.verified, true, 'the stage must verify before anything else is asserted');
  const approval = approveStagedRestore(root, staged.key, 'human', proposal);
  assert.equal(approval.safeToClear, true, 'the approval must verify too');
  return { key: staged.key, payload: proposal.payload };
}

/* ── 1. an approved restore reaches the next injection, whole ─────────────── */

test('the injection after a clear delivers the approved summary, byte for byte', () => {
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    // A payload far past every tier in this product: the item forbids a cap,
    // a tier and a trim by name, so the assertion is identity and not "most
    // of it arrived".
    const huge = `${buildRestoreProposal(t.file).payload}\n${'restored detail. '.repeat(20_000)}`;
    const { payload } = approved(ws.root, t.file, huge);

    const text = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'session-after-the-clear',
    });
    assert.ok(text.includes(payload),
      'the staged payload must arrive in full — no cap, no tier, no trim');
    assert.ok(text.includes('Pool capped at 20'),
      'and the rest of the injection still happens: a restore is an addition, not a replacement');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 2. never automatic: a proposed restore is not delivered ──────────────── */

test('a staged restore the owner has not approved is never delivered', () => {
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const proposal = buildRestoreProposal(t.file);
    const staged = stageRestoreSummary(ws.root, proposal);

    const text = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'session-after-the-clear',
    });
    assert.equal(text.includes(proposal.payload), false,
      'an agent may build a summary; releasing it into a window is the owner\'s act alone');
    assert.equal(loadStagedRestore(ws.root, staged.key)?.state, 'proposed',
      'and the injection must not have spent it either');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 3. one-shot, exactly as `mycontext carry` is one-shot ────────────────── */

test('a delivered restore is spent: the next session start does not receive it again', () => {
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { key, payload } = approved(ws.root, t.file);

    const first = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'first-window',
    });
    assert.ok(first.includes(payload));

    const record = loadStagedRestore(ws.root, key);
    assert.equal(record?.state, 'delivered');
    assert.equal(record?.deliveredTo, 'first-window',
      'the record says which window received it, so a reader can tell a spend from a loss');

    const second = buildInjection(ws.cwd, {
      event: 'session-start', source: 'startup', sessionId: 'second-window',
    });
    assert.equal(second.includes(payload), false,
      'the window it was built for is no longer empty; a second delivery would be noise');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('spendApprovedRestore is read-and-spend in one call, and the second call finds nothing', () => {
  // The property the whole one-shot contract rests on, asserted directly on
  // the function `core/inject.ts` calls — `spendCarryOnce`'s own test makes
  // the same assertion about the carry queue for the same reason.
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { key, payload } = approved(ws.root, t.file);
    const first = spendApprovedRestore(ws.root, 'a-window');
    assert.equal(first.payload, payload);
    assert.equal(first.key, key);
    assert.equal(first.error, null);

    const second = spendApprovedRestore(ws.root, 'a-window');
    assert.deepEqual(second, { payload: null, key: null, error: null });
  } finally {
    t.dispose();
    ws.dispose();
  }
});

/* ── 4. the loop guard, across the whole round trip ───────────────────────── */

test('build, inject, build again: the second build does not ingest the first summary', () => {
  // Design §6, end to end rather than on a hand-made string. The first build
  // is staged, approved and INJECTED by the real injection; whatever that
  // injection produced is then written into a transcript, exactly as the
  // harness would once the model had read it; and the second build is run over
  // that transcript.
  const ws = sandbox();
  const first = transcript(MATERIAL);
  let second: { file: string; dir: string; dispose: () => void } | null = null;
  try {
    const { payload } = approved(ws.root, first.file);
    const injected = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'the-fresh-window',
    });
    assert.ok(injected.includes(payload), 'the round trip is vacuous unless the payload arrived');
    assert.ok(injected.includes(SESSION_SUMMARY_MARKER),
      'and the marker must survive the injection, or the loop guard has nothing to see');

    // The injected block joins the new session's transcript, because everything
    // does. Both sides of the exchange, as a real session records them.
    second = transcript([...MATERIAL, answer(injected)]);
    const again = summariseTranscript(second.file);

    assert.equal(again.coverage.droppedOwnSummary, 1,
      'the record carrying the injected summary must be dropped BY THE GUARD and counted');
    assert.equal(again.coverage.textRecords, MATERIAL.length,
      'and only the original material survives — a summary of a summary is the silent ' +
      'compounding §6 exists to stop');
    for (const point of again.points) {
      assert.equal(point.text.includes(SESSION_SUMMARY_MARKER), false,
        'no point may be lifted out of our own payload');
    }
  } finally {
    second?.dispose();
    first.dispose();
    ws.dispose();
  }
});

/* ── 4b. the delivery must not drag the archive onto the injection path ───── */

test('the restore delivery does not put the conversation index on the injection path', () => {
  // MEASURED, and it is why `core/restore-store.ts` exists as its own file.
  // `restore-stage.ts` imports `core/session-summary.ts`, which VALUE-IMPORTS
  // `classifyTurn` from `core/conversation-index.ts` — `node:sqlite` and the
  // whole archive index. Importing the spend from there made every session
  // start in this product load the archive to find out whether a summary was
  // waiting, which is exactly the property `buildInjectionResult` is built
  // around: *the database is not on the injection-critical path*.
  //
  // The walk drops type-only edges, because those are erased at runtime and
  // are free.
  const repo = path.resolve(import.meta.dirname, '../..');
  const files = new Set<string>();
  const queue = [path.join(repo, 'src', 'core', 'inject.ts')];
  const push = (from: string, spec: string): void => {
    if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(from), spec));
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*(['"])([^'"]+)\3/g)) {
      if (m[1] === undefined) push(file, m[4]!);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*(['"])([^'"]+)\1/g)) push(file, m[2]!);
  }
  const reachable = [...files].map((f) => path.relative(repo, f).split(path.sep).join('/'));

  // Anti-vacuity: the walk must actually reach the restore delivery, or every
  // assertion below passes against a graph that resolved nothing.
  assert.ok(reachable.includes('src/core/restore-store.ts'),
    `the walk did not reach the restore delivery at all — it found ${reachable.join(', ')}`);
  assert.equal(reachable.includes('src/core/conversation-index.ts'), false,
    'the injection now loads the conversation index. Whatever needed it belongs in ' +
    '`core/restore-stage.ts`, which a person calls, not on the path every session start takes.');
  assert.equal(reachable.includes('src/core/session-summary.ts'), false,
    'the injection now loads the 1,300-line summary reader and its cue tables to find out ' +
    'whether a one-line file exists.');
  // `node:sqlite` itself is NOT asserted absent, and the reason is worth
  // writing down rather than leaving as a gap: `inject.ts` imports `Store` for
  // its own best-effort index refresh, which is deliberate and guarded
  // (`HOOK_OPEN_PROFILE`, its own try/catch, dropped without prejudice when the
  // lock is held). The claim here is narrower and is the one that was actually
  // violated: the RESTORE must not be what drags a second index in.
});

/* ── 5. fail open: a broken restore costs the restore, never the injection ── */

test('a corrupt staged restore costs the delivery and leaves the injection standing', () => {
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { key } = approved(ws.root, t.file);
    writeFileSync(restoreStagingFile(ws.root, key), '{ not json at all', 'utf8');

    const text = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'a-window',
    });
    assert.ok(text.includes('Pool capped at 20'),
      'a knowledge base that breaks a session is worse than one that says nothing');
    assert.ok(text.includes('a staged session restore could not be delivered'),
      'and the loss is DISCLOSED rather than swallowed — INV-nothing-is-dropped-silently. ' +
      '"your summary did not arrive" is indistinguishable from "you staged nothing" unless ' +
      `something says so. Block was:\n${text}`);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('a restore is not delivered to a subagent, and not on a compaction', () => {
  // A subagent's window was never cleared by the owner and a compaction is the
  // same window continuing — the restore tier is already re-delivering what
  // that window held. Both are the cross-session carry's own exclusions, for
  // the reasons `core/inject.ts` states there.
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { key, payload } = approved(ws.root, t.file);

    const toSubagent = buildInjection(ws.cwd, {
      event: 'subagent', sessionId: 'parent', dedupeKey: 'parent::child', agentId: 'child',
    });
    assert.equal(toSubagent.includes(payload), false);

    const onCompact = buildInjection(ws.cwd, {
      event: 'session-start', source: 'compact', sessionId: 'same-window',
    });
    assert.equal(onCompact.includes(payload), false);

    assert.equal(loadStagedRestore(ws.root, key)?.state, 'approved',
      'and neither event may SPEND it: the owner\'s next clean window is still owed it');
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('the delivered block says where it came from, so unattributed text never arrives', () => {
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { payload } = approved(ws.root, t.file);
    const text = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'a-window',
    });
    const at = text.indexOf(payload);
    assert.ok(at > 0, 'the payload must be present for its frame to be checkable');
    const frame = text.slice(0, at);
    assert.ok(/approved/i.test(frame) && /transcript/i.test(frame),
      'a block with no account of where it came from reads as an out-of-band injection, which ' +
      `is the correct reading of unattributed text in a context window. Frame was: ${frame.slice(-400)}`);
  } finally {
    t.dispose();
    ws.dispose();
  }
});

test('the staged record on disk is what was read back, not a copy held in memory', () => {
  // Anti-vacuity for every assertion above that reads the record: the injection
  // must be reaching the FILE. Replace the payload on disk between the approval
  // and the injection and the injection must deliver what is on disk.
  const ws = sandbox();
  const t = transcript(MATERIAL);
  try {
    const { key } = approved(ws.root, t.file);
    const file = restoreStagingFile(ws.root, key);
    const record = JSON.parse(readFileSync(file, 'utf8'));
    record.payload = `[${SESSION_SUMMARY_MARKER}] a payload only the disk knows about`;
    writeFileSync(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8');

    const text = buildInjection(ws.cwd, {
      event: 'session-start', source: 'clear', sessionId: 'a-window',
    });
    assert.ok(text.includes('a payload only the disk knows about'),
      'the injection reads the file — which is the whole reason staging survives a clear');
  } finally {
    t.dispose();
    ws.dispose();
  }
});
