import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { appendJsonlLine } from '../../src/core/jsonl-log.ts';
import {
  pendingRevisionCounts, pendingRevisionSummaries, revisionDir, revisionLogPath,
  REVISION_PROTOCOL,
} from '../../src/core/revision-log.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * `src/core/revision-log.ts` — the read half of the staged-revision log,
 * extracted from `revision.ts` (web-ui plan 1, Task 6).
 *
 * The reason it is a separate module is the first test below and nothing else:
 * `revision.ts` imports `updateItem` from `mutate.ts` at runtime, so a
 * read-only surface that wants to COUNT the pending queue cannot import from
 * there without putting every write path — stage, promote, discard, and
 * `updateItem` itself — into its own import graph. The behaviour of everything
 * here is pinned by `test/core/revision.test.ts` and the rest of the suite,
 * which still reach these functions through `revision.ts`'s re-exports; this
 * file pins the boundary and the one function that is new.
 */

/** The record `stageRevision` appends, written through the same serializer
 * (`appendJsonlLine`, via `appendLine` in revision.ts) that the product uses. */
function stageLine(root: string, revisionId: string, itemId: string, at: string): void {
  appendJsonlLine(revisionDir(root), revisionLogPath(root), {
    protocol: REVISION_PROTOCOL,
    op: 'stage',
    revisionId,
    itemId,
    at,
    changes: { body: 'Avoid logging customer email addresses unless it is necessary.' },
    base: { body: 'Never log a customer email address, anywhere, at any level.' },
    origin: 'agent',
  });
}

/** The record `discardRevision` appends. */
function discardLine(root: string, revisionId: string, itemId: string, at: string): void {
  appendJsonlLine(revisionDir(root), revisionLogPath(root), {
    protocol: REVISION_PROTOCOL,
    op: 'discard',
    revisionId,
    itemId,
    at,
    reason: 'not the wording we want',
  });
}

test('revision-log.ts imports nothing from mutate.ts or revision.ts — the reason it exists', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'core', 'revision-log.ts'), 'utf8');
  assert.doesNotMatch(source, /from '\.\/mutate\.ts'/);
  assert.doesNotMatch(source, /from '\.\/revision\.ts'/);
});

test('an absent log means no pending revisions; a staged line means one; a discard settles it', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-revlog-'));
  try {
    assert.deepEqual(pendingRevisionSummaries(root), []);

    stageLine(root, 'REV-0a1b2c3d4e5f', 'RULE-do-not-log-customer-email', '2026-08-16T10:00:00.000Z');
    assert.deepEqual(
      pendingRevisionSummaries(root),
      [{ revisionId: 'REV-0a1b2c3d4e5f', itemId: 'RULE-do-not-log-customer-email' }],
    );

    discardLine(root, 'REV-0a1b2c3d4e5f', 'RULE-do-not-log-customer-email', '2026-08-16T10:05:00.000Z');
    assert.deepEqual(pendingRevisionSummaries(root), []);
  } finally {
    removeTree(root);
  }
});

test('pendingRevisionCounts counts revisions and distinct items', () => {
  assert.deepEqual(
    pendingRevisionCounts([{ itemId: 'A' }, { itemId: 'A' }, { itemId: 'B' }]),
    { revisions: 3, items: 2 },
  );
});
