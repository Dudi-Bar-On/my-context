import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { openProjection, syncProjection } from '../../src/core/audit-db.ts';
import { recordAudit } from '../../src/core/audit.ts';
import { contextEpochStart, rebuiltFromSummaryAt } from '../../src/core/context-share.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **TASK-a-session-resumed-after-a-restart-is-treated-as-carrying-no.**
 *
 * `contextEpochStart` used to answer "never compacted" (`null`, no `since`
 * bound) for ANY session with no `pre-compact` row — right for a session that
 * really has held everything it was ever injected, wrong for one whose window
 * was rebuilt from a compaction summary at a resume that never fired
 * `PreCompact` at all (the platform performs that rebuild while REOPENING a
 * transcript, not while a hook-instrumented process is running against it).
 *
 * These tests exercise the fix directly: `rebuiltFromSummaryAt`'s read of the
 * one signal Claude Code itself writes at that moment — a transcript line
 * shaped `{ isCompactSummary: true, timestamp, sessionId }` — and
 * `contextEpochStart`'s use of it exactly when (and only when) no
 * `pre-compact` row already answers the question.
 */

function sandboxRoot(): { outer: string; root: string } {
  const outer = mkdtempSync(path.join(tmpdir(), 'myctx-epoch-'));
  return { outer, root: path.join(outer, '.my_context') };
}

/** A minimal transcript file with one `isCompactSummary` line among others. */
function transcriptFixture(
  dir: string, sessionId: string, lines: Array<Record<string, unknown>>,
): string {
  const file = path.join(dir, `${sessionId}.jsonl`);
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  return file;
}

function summaryLine(sessionId: string, timestamp: string): Record<string, unknown> {
  return {
    parentUuid: 'p1', isSidechain: false, type: 'user', isCompactSummary: true,
    uuid: 'u1', timestamp, sessionId, session_id: sessionId,
    message: {
      role: 'user',
      content: 'This session is being continued from a previous conversation that ran out of ' +
        'context. The summary below covers the earlier portion of the conversation.',
    },
  };
}

function ordinaryLine(sessionId: string, timestamp: string, content: string): Record<string, unknown> {
  return {
    parentUuid: 'p0', isSidechain: false, type: 'user', uuid: 'u0', timestamp,
    sessionId, session_id: sessionId, message: { role: 'user', content },
  };
}

test('rebuiltFromSummaryAt reads the timestamp off a real isCompactSummary transcript line', () => {
  const { outer } = sandboxRoot();
  try {
    const transcript = transcriptFixture(outer, 's1', [
      ordinaryLine('s1', '2026-09-01T00:00:00.000Z', 'hello'),
      summaryLine('s1', '2026-09-03T12:00:00.000Z'),
      ordinaryLine('s1', '2026-09-03T12:05:00.000Z', 'continuing'),
    ]);
    assert.equal(rebuiltFromSummaryAt(transcript, 's1'), '2026-09-03T12:00:00.000Z');
  } finally {
    removeTree(outer);
  }
});

test('rebuiltFromSummaryAt returns the LATEST rebuild when a session was rebuilt more than once', () => {
  const { outer } = sandboxRoot();
  try {
    const transcript = transcriptFixture(outer, 's1', [
      summaryLine('s1', '2026-09-01T00:00:00.000Z'),
      ordinaryLine('s1', '2026-09-01T00:05:00.000Z', 'a'),
      summaryLine('s1', '2026-09-04T09:00:00.000Z'),
      ordinaryLine('s1', '2026-09-04T09:05:00.000Z', 'b'),
    ]);
    assert.equal(rebuiltFromSummaryAt(transcript, 's1'), '2026-09-04T09:00:00.000Z');
  } finally {
    removeTree(outer);
  }
});

test('rebuiltFromSummaryAt ignores a summary line for a DIFFERENT session id', () => {
  const { outer } = sandboxRoot();
  try {
    const transcript = transcriptFixture(outer, 'other', [
      summaryLine('other-session', '2026-09-03T12:00:00.000Z'),
    ]);
    assert.equal(rebuiltFromSummaryAt(transcript, 's1'), null);
  } finally {
    removeTree(outer);
  }
});

test('rebuiltFromSummaryAt is safe on a missing path, a directory, and a transcript with no marker', () => {
  const { outer } = sandboxRoot();
  try {
    assert.equal(rebuiltFromSummaryAt(path.join(outer, 'nope.jsonl'), 's1'), null);
    assert.equal(rebuiltFromSummaryAt(outer, 's1'), null); // a directory, not a file
    const transcript = transcriptFixture(outer, 's1', [
      ordinaryLine('s1', '2026-09-01T00:00:00.000Z', 'nothing special here'),
    ]);
    assert.equal(rebuiltFromSummaryAt(transcript, 's1'), null);
  } finally {
    removeTree(outer);
  }
});

test('rebuiltFromSummaryAt never throws on a malformed line', () => {
  const { outer } = sandboxRoot();
  try {
    const file = path.join(outer, 'bad.jsonl');
    writeFileSync(file, '{not json at all\n{"isCompactSummary": true, "timestamp": 42}\n', 'utf8');
    assert.equal(rebuiltFromSummaryAt(file, 's1'), null);
  } finally {
    removeTree(outer);
  }
});

/**
 * **RED before the fix, GREEN after it.** Before `contextEpochStart` grew its
 * third argument, this scenario returned `null` regardless of the transcript
 * — the exact defect: a session with no `pre-compact` row and a transcript
 * that shows it was rebuilt from a summary was read as "never compacted",
 * carrying pre-resume tokens as resident when they were actually gone.
 */
test('contextEpochStart resets the epoch at a resume-rebuild when there is no pre-compact row at all', () => {
  const { outer, root } = sandboxRoot();
  try {
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 400000,
      at: '2026-08-20T00:00:00.000Z',
    });
    const summaryAt = '2026-09-03T12:00:00.000Z';
    const transcript = transcriptFixture(outer, 's1', [
      ordinaryLine('s1', '2026-08-20T00:00:01.000Z', 'earlier conversation'),
      summaryLine('s1', summaryAt),
    ]);

    const db = openProjection(root);
    try {
      syncProjection(root, db);
      // No transcript path handed in: unchanged from before this fix.
      assert.equal(contextEpochStart(db, 's1'), null);
      // With the transcript: the resume-rebuild is the epoch boundary.
      assert.equal(contextEpochStart(db, 's1', transcript), summaryAt);
    } finally {
      db.close();
    }
  } finally {
    removeTree(outer);
  }
});

test('contextEpochStart prefers an existing pre-compact row over the transcript — no regression for the already-instrumented case', () => {
  const { outer, root } = sandboxRoot();
  try {
    const preCompactAt = '2026-09-01T00:00:00.000Z';
    recordAudit(root, {
      kind: 'hook', op: 'pre-compact', sessionId: 's1', hook: 'PreCompact', at: preCompactAt,
    });
    // A LATER transcript marker exists too (the disclosed remaining gap named
    // in `contextEpochStart`'s own docblock: a session that also compacted
    // live keeps THAT boundary even if a later resume rebuilt it again).
    const transcript = transcriptFixture(outer, 's1', [
      summaryLine('s1', '2026-09-04T00:00:00.000Z'),
    ]);
    const db = openProjection(root);
    try {
      syncProjection(root, db);
      assert.equal(contextEpochStart(db, 's1', transcript), preCompactAt);
    } finally {
      db.close();
    }
  } finally {
    removeTree(outer);
  }
});

test('contextEpochStart with no pre-compact row and no transcript marker still returns null — unchanged', () => {
  const { outer, root } = sandboxRoot();
  try {
    recordAudit(root, {
      kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
      injected: [{ id: 'RULE-a', tier: 'pinned' }], tokens: 100,
    });
    const transcript = transcriptFixture(outer, 's1', [
      ordinaryLine('s1', '2026-09-01T00:00:00.000Z', 'nothing to see here'),
    ]);
    const db = openProjection(root);
    try {
      syncProjection(root, db);
      assert.equal(contextEpochStart(db, 's1', transcript), null);
      assert.equal(contextEpochStart(db, 's1'), null);
    } finally {
      db.close();
    }
  } finally {
    removeTree(outer);
  }
});
