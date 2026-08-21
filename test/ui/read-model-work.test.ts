import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createItem } from '../../src/core/mutate.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';
import { stageIn } from '../helpers/revisions.ts';
import { apiRevisions, apiReviewQueue } from '../../src/ui/read-model-work.ts';

/**
 * A real workspace built through the real CLI (plan 1's fixture pattern).
 *
 * Two deviations from the plan's sketch, both established by executing it:
 * `add` refuses without `--yes` when stdin is not interactive ("refusing
 * without confirmation"), and `--always` is not an `add` option at all — it is
 * set afterwards by `edit --always=true`, exactly as `test/ui/read-model.test.ts`
 * does. Cleanup is `removeTree`, the one owner of test temp-directory removal;
 * a bare `rmSync` here is what `test/no-bare-rmsync.test.ts` fails on.
 */
function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-work-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', 'rule', 'Always use POSIX paths', '--scope', 'src/**', '--body', 'Use POSIX.', '--yes']);
  run(['add', 'rule', 'Pin me', '--body', 'Pinned body.', '--yes']);
  run(['edit', 'RULE-pin-me', '--always=true', '--yes']);
  return { dir, done: () => removeTree(dir) };
}

test('/api/revisions: empty log answers zero counts and an empty list', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const result = apiRevisions(ws, new URL('http://x/api/revisions'));
    assert.equal(result.status, 200);
    assert.deepEqual(result.body, { counts: { revisions: 0, items: 0 }, revisions: [] });
  } finally { done(); }
});

test('/api/revisions: a staged revision arrives as a per-field diff; a human edit marks it stale', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // Staged through the REAL staging path: `stageIn` (test/helpers/revisions.ts)
    // builds a real MutationContext over the workspace on disk and calls the
    // real `stageRevision`, which is how test/cli/review-revisions.test.ts and
    // test/core/revision*.test.ts stage one. So this test reads a log the
    // product wrote, not one the test invented.
    stageIn(dir, 'RULE-always-use-posix-paths', { body: 'Use POSIX paths everywhere.' });
    const fresh = apiRevisions(ws, new URL('http://x/api/revisions'));
    const body = fresh.body as {
      counts: { revisions: number; items: number };
      revisions: {
        itemId: string; stale: boolean; itemTitle: string | null;
        fields: { field: string; changed: boolean; diff: { mark: string; text: string }[] }[];
      }[];
    };
    assert.equal(body.counts.revisions, 1);
    const rev = body.revisions[0];
    assert.equal(rev.stale, false);
    assert.equal(rev.itemTitle, 'Always use POSIX paths');
    const bodyField = rev.fields.find((f) => f.field === 'body');
    assert.ok(bodyField);
    assert.ok(bodyField!.diff.some((l) => l.mark === '-' && l.text === 'Use POSIX.'));
    assert.ok(bodyField!.diff.some((l) => l.mark === '+' && l.text === 'Use POSIX paths everywhere.'));

    // A human edit to the same field, via the real CLI:
    runCli(['edit', rev.itemId, '--body', 'Humanly rewritten.', '--yes'], dir, () => {});
    const after = apiRevisions(ws, new URL('http://x/api/revisions'));
    const staleRev = (after.body as typeof body).revisions[0];
    assert.equal(staleRev.stale, true);
    assert.equal(staleRev.fields.find((f) => f.field === 'body')?.changed, true);
  } finally { done(); }
});

test('/api/review-queue lists project-layer drafts with their injection verdicts', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const empty = apiReviewQueue(ws, new URL('http://x/api/review-queue'));
    assert.deepEqual(empty.body, { drafts: [] }); // CLI adds stamp origin human → active

    // A draft arrives the way real drafts arrive: a non-human origin captured
    // through the `trustedStatus` gate (core/trust.ts — a normative category
    // authored by anything but a human is demoted to `draft`), created the way
    // test/core/agent-edits.test.ts creates one. The store is the workspace's
    // own index rather than a `:memory:` one, because the endpoint reads what
    // is on disk.
    const store = Store.open(ws.dbPath);
    try {
      const created = createItem({ root: ws.projectRoot!, store, config: ws.config }, {
        type: 'rule', title: 'A drafted rule', body: 'Proposed by an agent.', origin: 'agent',
      });
      assert.equal(created.status, 'draft', 'the trustedStatus gate must have demoted it');
    } finally { store.close(); }

    const result = apiReviewQueue(ws, new URL('http://x/api/review-queue'));
    const drafts = (result.body as { drafts: { id: string; injected: boolean; phrase: string }[] }).drafts;
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].id, 'RULE-a-drafted-rule');
    assert.equal(drafts[0].injected, false); // a draft is in no injection tier
    assert.equal(drafts[0].phrase, 'not injected (status "draft")');
  } finally { done(); }
});

test('both endpoints refuse unknown parameters', () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    assert.equal(apiRevisions(ws, new URL('http://x/api/revisions?full=1')).status, 400);
    assert.equal(apiReviewQueue(ws, new URL('http://x/api/review-queue?type=rule')).status, 400);
  } finally { done(); }
});
