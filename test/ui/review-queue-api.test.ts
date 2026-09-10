// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen,
// INV-nothing-is-dropped-silently
//
// Design §7, on the endpoint the review screen draws a row from.
//
// **The one thing this file exists to pin is that the brief travels WITH the
// row.** "No model call on this surface" is the phase's hard rule, and the
// mechanism that makes it keepable is that nothing has to be composed at read
// time: `briefOf` wrote the brief when the pass had the transcript, `createItem`
// stored it as the draft's body, and this endpoint hands it over with the
// count. A screen that had to fetch it separately would be one refactor away
// from fetching it from a model instead.
//
// The second half is the DOOR: the row carries the draft's `filePath`, and
// that path is servable — a draft under `.drafts/` opens in the right pane
// like any other item, because `isCorpusFilePath` admits both of the corpus's
// walk roots since `plan:loop seq:4`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { createItem } from '../../src/core/mutate.ts';
import { openRebuiltStore } from '../../src/core/open-store.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { apiReviewQueue, BRIEF_MAX_CHARS } from '../../src/ui/read-model-work.ts';
import { apiCorpusFile } from '../../src/ui/read-model.ts';
import { isCorpusFilePath } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

interface Row {
  id: string; origin: string; brief: string; briefTruncated: boolean;
  filePath: string; validFrom: string | null; deletesOnDecline: boolean;
}

/** A workspace holding one review-pass draft and one ingest draft. */
function corpus(brief: string): { cwd: string; ws: Workspace } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-queue-api-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const ws = resolveWorkspace(cwd);
  const opened = openRebuiltStore(ws);
  try {
    const ctx = { root: ws.projectRoot!, store: opened.store, config: ws.config };
    createItem(ctx, {
      type: 'task', title: 'check basis admits a test that declares none',
      summary: 'The basis gate passes a test file carrying no @basis line at all.',
      body: brief, origin: 'review', scope: ['scripts/gate-basis.ts'],
    });
    createItem(ctx, {
      type: 'lesson', title: 'a lesson somebody typed',
      summary: 'Authored by a person, so declining it retires it rather than deleting it.',
      body: 'A draft with a body that is not a review brief.', origin: 'ingest', status: 'draft',
    });
  } finally {
    opened.store.close();
  }
  return { cwd, ws };
}

function rows(ws: Workspace): Row[] {
  const result = apiReviewQueue(ws, new URL('http://127.0.0.1/api/review-queue'));
  assert.equal(result.status, 200);
  return (result.body as { drafts: Row[] }).drafts;
}

test('the review brief arrives with the row, whole, and nothing composes it here', () => {
  const brief = 'A draft from the self-improvement pass. It governs nothing and is not committed.\n'
    + 'Proposed as a task to BUILD a check rather than as a rule to obey.';
  const { cwd, ws } = corpus(brief);
  try {
    const proposal = rows(ws).find((r) => r.origin === 'review');
    assert.ok(proposal, 'the pass\'s draft must be in the queue');
    assert.equal(proposal.brief, brief, 'the brief is served verbatim, with the count');
    assert.equal(proposal.briefTruncated, false);
    assert.ok(
      proposal.validFrom !== null,
      'and the date the age indicator is keyed on rides with it, so the row need not derive one',
    );
  } finally {
    removeTree(cwd);
  }
});

test('a brief longer than the bound is cut AND says it was cut', () => {
  const { cwd, ws } = corpus('x'.repeat(BRIEF_MAX_CHARS + 500));
  try {
    const proposal = rows(ws).find((r) => r.origin === 'review');
    assert.ok(proposal);
    assert.equal(proposal.brief.length, BRIEF_MAX_CHARS);
    assert.equal(
      proposal.briefTruncated, true,
      'a silently short brief on the one screen a person decides from is the worst place in ' +
      'this product for a quiet drop',
    );
  } finally {
    removeTree(cwd);
  }
});

test('the row says whether settling it DELETES the draft or retires it', () => {
  const { cwd, ws } = corpus('brief');
  try {
    const all = rows(ws);
    const proposal = all.find((r) => r.origin === 'review');
    const authored = all.find((r) => r.origin === 'ingest');
    assert.ok(proposal && authored);
    assert.equal(proposal.deletesOnDecline, true, '§8: a declined proposal is deleted');
    assert.equal(
      authored.deletesOnDecline, false,
      'a draft a person or an ingest wrote is deprecated and kept as a trail — one sentence ' +
      'over both would be the screen promising the opposite of what its button does',
    );
  } finally {
    removeTree(cwd);
  }
});

test('the row is a DOOR: a draft\'s own file is servable, frontmatter apart from body', () => {
  const { cwd, ws } = corpus('the brief, in the body, where the pass put it');
  try {
    const proposal = rows(ws).find((r) => r.origin === 'review');
    assert.ok(proposal);
    assert.match(proposal.filePath, /^\.drafts\//, 'a review draft lands in the gitignored region');
    assert.ok(
      isCorpusFilePath(proposal.filePath),
      'and that region is inside the served boundary — `loadLayer` walks it as a second root, ' +
      'so refusing it would have been the predicate keeping a rule after its reason expired',
    );

    const file = apiCorpusFile(
      ws, new URL('http://127.0.0.1/api/corpus/x'), { id: proposal.filePath },
    );
    assert.equal(file.status, 200, JSON.stringify(file.body));
    const body = file.body as { frontmatter: string | null; markdown: string; bytes: number };
    assert.match(String(body.frontmatter), /origin: review/);
    assert.match(body.markdown, /the brief, in the body/);
    assert.ok(body.bytes > 0);
  } finally {
    removeTree(cwd);
  }
});

test('widening to .drafts/ did not widen to the state directories beside it', () => {
  // The draft region is one gitignored directory, not all of them. A predicate
  // that admitted "anything under a dot-directory" would have handed out the
  // revision log, the staging files and the verdicts with the same change.
  for (const outside of [
    '.staging/lesson/x.md', '.revisions/revisions.jsonl', '.verdicts/v.md',
    'state/index.db', '.audit/audit.jsonl', 'config.json',
  ]) {
    assert.equal(isCorpusFilePath(outside), false, `admitted ${outside}`);
  }
});
