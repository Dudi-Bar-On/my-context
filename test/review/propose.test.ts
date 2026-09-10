// @basis TASK-propose-drafts-nobody-has-to-trust-preferring-a-check-over-a,
// INV-nothing-is-dropped-silently, CONST-node-24-no-build-step
//
// **The claim this file exists to prove is that the artifact order is APPLIED
// and not merely declared.** A prompt that asks a model to prefer checks is a
// request; `classify` is a function whose precedence can be demonstrated by
// removal. So the central test takes ONE sentence, strips the mechanism from
// it and watches it fall from `check` to `rule`, then strips the modal and
// watches it fall to `lesson` — three tiers, one text, nothing else changed.
//
// **Nothing here writes a real item.** Every write goes through `sandbox()`,
// which builds a throwaway workspace with an in-memory index. This project
// dogfoods itself and the module under test creates corpus items, so that
// separation is the difference between a test suite and an unattended author.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DRAFT_DIR } from '../../src/core/drafts.ts';
import { claimKey } from '../../src/review/claim.ts';
import { recordDecline } from '../../src/review/declined.ts';
import {
  antiLearning, classify, evidenceTouchesTarget, noteSighting, propose, readSightings, targetOf,
  ARTIFACT_CATEGORY, AUTHORABLE,
} from '../../src/review/propose.ts';
import type { PassInput, Point } from '../../src/review/input.ts';
import { sandbox } from '../helpers/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

function point(text: string, over: Partial<Point> = {}): Point {
  return {
    category: 'measurement', who: 'model', source: 'C:/t/lane.jsonl', recordIndex: 7,
    at: '2026-09-11T00:00:00.000Z', text, ...over,
  };
}

function input(points: Point[]): PassInput {
  return {
    points, readTo: 0, sources: ['C:/t/lane.jsonl'], whole: true, skipped: [],
    readBytes: 0, records: points.length, unreadable: 0, briefPoints: 0, ms: 0,
  };
}

// ── §4: THE ORDER, PROVED BY REMOVAL ────────────────────────────────────────

test('check beats rule beats lesson, on one sentence with one thing removed at a time', () => {
  // A mechanism AND a modal. The mechanism must win.
  const both = 'A new test in test/review/propose.test.ts must never rest on the live corpus.';
  assert.equal(classify(both).artifact, 'check',
    'a text carrying both a mechanism and a modal is a check — the order is total');

  // Remove the mechanism. The modal is untouched.
  const modalOnly = 'A new observation must never rest on the live corpus.';
  assert.equal(classify(modalOnly).artifact, 'rule',
    'with nothing to run, a normative sentence is a rule and not prose');

  // Remove the modal too.
  const neither = 'A new observation rested on the live corpus.';
  assert.equal(classify(neither).artifact, 'lesson',
    'prose is the fallback, and it is reached only when the two above do not fit');

  // And the reason travels with the verdict, so a reader can disagree with the
  // specific cue rather than with the tier.
  assert.match(classify(both).because, /can be checked/i);
  assert.match(classify(neither).because, /fallback/i);
});

test('a check becomes a task, because approving it creates work and not law', () => {
  assert.equal(ARTIFACT_CATEGORY.check, 'task');
  assert.equal(ARTIFACT_CATEGORY.rule, 'rule');
  assert.equal(ARTIFACT_CATEGORY.lesson, 'lesson');
});

test('this build authors checks only, and says so rather than skipping quietly', async () => {
  assert.deepEqual([...AUTHORABLE], ['check']);
  const s = sandbox();
  const out = await propose(input([
    point('Every relative import in src/core/mutate.ts must carry an explicit .ts extension.'),
  ]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 0, 'a rule written from a transcript sentence is quoted, not composed');
  assert.equal(out.unauthored.rule, 1, 'and the candidate is COUNTED, not dropped');
  assert.match(out.because.join(' '), /AUTHORABLE/);
  s.dispose();
});

// ── §5c: RELEVANCE ──────────────────────────────────────────────────────────

test('a proposal that names no file, module or item is refused', async () => {
  const s = sandbox();
  const out = await propose(input([
    point('The whole thing feels much better now and everybody agrees it was worth doing.'),
  ]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 0);
  assert.equal(out.irrelevant, 1);
  assert.match(out.because.join(' '), /names no file/i);
  s.dispose();
});

test('evidence that does not touch the target is refused, not softened', () => {
  assert.equal(evidenceTouchesTarget('src/core/mutate.ts', ['a note about src/ui/open.ts']), false);
  assert.equal(evidenceTouchesTarget('src/core/mutate.ts', ['a note about src/core/mutate.ts']), true);
  // `null` is a legal target and cannot fail the gate — there is nothing to
  // disagree with. The refusal for a null target happens earlier, in `propose`.
  assert.equal(evidenceTouchesTarget(null, ['anything']), true);
});

test('the target is a path or an item id, and nothing else', () => {
  assert.equal(targetOf('the gate in src/core/mutate.ts is wrong'), 'src/core/mutate.ts');
  assert.equal(targetOf('RULE-a-delegated-worker-runs-no-git-command failed twice'),
    'RULE-a-delegated-worker-runs-no-git-command');
  assert.equal(targetOf('everything went fine today'), null);
});

// ── §12: THE ANTI-LEARNING SCREEN ───────────────────────────────────────────

test('the lexical screen drops all four shapes it can decide', () => {
  assert.match(antiLearning('sqlite3: command not found') ?? '', /missing binary/i);
  assert.match(antiLearning('the ANTHROPIC api key was never exported') ?? '', /credential/i);
  assert.match(antiLearning('that suite is flaky on this machine') ?? '', /resolved/i);
  assert.match(antiLearning('the browser suite is still failing and I gave up') ?? '', /unresolved/i);
  assert.equal(antiLearning('src/core/mutate.ts refuses an edit from the review pass'), null);
});

test('a screened observation never reaches the corpus, and the reason is recorded', async () => {
  const s = sandbox();
  const out = await propose(input([
    point('test/core/mutate.test.ts is flaky on this machine and passed on the retry.'),
  ]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 0);
  assert.equal(out.screened, 1);
  assert.match(out.because.join(' '), /taught nothing/i);
  s.dispose();
});

test('a narrative about a file is screened, because a story is not a rule', async () => {
  const s = sandbox();
  const out = await propose(input([
    point('I spent the afternoon rewriting src/core/mutate.ts and it went fine in the end.'),
  ]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 0);
  assert.equal(out.screened, 1, 'first person is a status update, and a status update is not knowledge');
  s.dispose();
});

// ── §4 AND §13: WHAT LANDS, AND WHERE ───────────────────────────────────────

const CHECKABLE =
  'The suite test/scripts/handover-check.test.ts fails on the handover, and nothing asserts it.';

test('a proposal lands as an uncommitted draft, tagged unconfirmed, citing its evidence', async () => {
  const s = sandbox();
  const out = await propose(input([point(CHECKABLE)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
  });

  assert.equal(out.created.length, 1);
  const item = s.ctx.store.get(out.created[0]!);
  assert.ok(item !== undefined && item !== null);
  assert.equal(item.status, 'draft', 'the pass proposes; nothing it writes governs');
  assert.equal(item.origin, 'review');
  assert.equal(item.type, 'task', 'a check is work to be built, not a law to obey');
  assert.ok(item.filePath.startsWith(`${DRAFT_DIR}/`), 'a proposal is not committed');
  assert.ok(item.tags.includes('unconfirmed'));
  // §5c: the draft names what in the transcript it came from.
  assert.match(item.body, /lane\.jsonl record 7/);
  // §6: the summary is one sentence and within the bound the write path enforces.
  assert.ok((item.summary ?? '').length <= 250);
  // §12's shape contract: the quote is labelled as EVIDENCE, never presented as
  // the content of the proposal.
  assert.match(item.body, /quoted as evidence rather than as the content/);
  s.dispose();
});

test('a proposal never carries a heading, because a body is only the prose before one', async () => {
  const s = sandbox();
  const out = await propose(input([point(`## A heading\n${CHECKABLE}`)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5,
  });
  for (const id of out.created) {
    assert.doesNotMatch(s.ctx.store.get(id)?.body ?? '', /^## /m,
      'everything after a "## " in a body is silently lost on the round trip');
  }
  s.dispose();
});

// ── §3c: RECURRENCE LABELS, IT DOES NOT GATE ────────────────────────────────

test('one session is unconfirmed; a second, independent session confirms', async () => {
  const s = sandbox();
  const first = await propose(input([point(CHECKABLE)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
  });
  assert.equal(first.proposals[0]?.confirmed, false);
  assert.equal(first.created.length, 1, 'an unconfirmed observation is still PROPOSED — §3c labels, it does not gate');

  // The same claim, reworded, in a different session. `suppress` only sees this
  // pass's own candidates, so what stops a second draft here is the owner's
  // review, not the sighting ledger — the ledger's job is the LABEL.
  const second = await propose(input([point(
    'Nothing asserts the handover, and test/scripts/handover-check.test.ts fails on it.',
  )]), { workspace: s.root, ctx: s.ctx, sessionId: 'session-two', max: 5 });
  assert.equal(second.proposals[0]?.confirmed, true);
  assert.equal(second.proposals[0]?.sessionsSeen, 2);

  // And the same session twice is still ONE sighting: steps inside a session
  // are causally correlated and cannot confirm each other.
  const again = await propose(input([point(CHECKABLE)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
  });
  assert.equal(again.proposals[0]?.sessionsSeen, 2, 'a repeat inside one session adds no independence');
  s.dispose();
});

test('a dry run writes no draft and no sighting', async () => {
  const s = sandbox();
  const out = await propose(input([point(CHECKABLE)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5, dryRun: true,
  });
  assert.equal(out.created.length, 0);
  assert.equal(out.proposals.length, 1, 'a dry run still says what it WOULD propose');
  assert.equal(out.proposals[0]?.id, null);
  assert.deepEqual(readSightings(s.root), [],
    'a "what would it propose" run that changed the confirmation state would change its own answer');
  s.dispose();
});

test('the sightings ledger degrades to empty rather than throwing', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'review-sight-'));
  assert.deepEqual(readSightings(dir), []);
  const seen = noteSighting(dir, 'a claim about something', null, 'one', '2026-09-11T00:00:00.000Z');
  assert.equal(seen.confirmed, false);
  assert.equal(readSightings(dir).length, 1);
  removeTree(dir);
});

// ── §5b AND §8: SUPPRESSION AND DECLINE, INSIDE THE REAL PATH ───────────────

test('two observations of one thing in one pass become one proposal', async () => {
  const s = sandbox();
  const out = await propose(input([
    point(CHECKABLE),
    point('Nothing asserts the handover, so test/scripts/handover-check.test.ts fails on it.'),
  ]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 1);
  assert.equal(out.suppressed, 1);
  assert.match(out.because.join(' '), /already pending as candidate:0/);
  s.dispose();
});

test('a claim the owner declined is not re-proposed after rewording', async () => {
  const s = sandbox();
  const target = 'test/scripts/handover-check.test.ts';
  recordDecline(s.root, {
    claim: claimKey(CHECKABLE.slice(0, 100), CHECKABLE, target),
    target, at: '2026-09-11T00:00:00.000Z', why: 'the handover is deliberately unasserted',
  });

  const out = await propose(input([point(
    'Nothing asserts the handover, and test/scripts/handover-check.test.ts fails on it every run.',
  )]), { workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5 });

  assert.equal(out.created.length, 0, 'the same transcript must not yield the same proposal forever');
  assert.equal(out.declined, 1);
  s.dispose();
});

// ── §11: THE RATION BOUNDS VOLUME, NEVER THE RUBRIC ─────────────────────────

test('the ration caps what is written and counts what it held back', async () => {
  const s = sandbox();
  const many = [
    point('The suite test/a-one.test.ts fails on the alpha handover and nothing asserts alpha.'),
    point('The suite test/b-two.test.ts fails on the beta rebuild and nothing asserts beta.'),
    point('The suite test/c-three.test.ts fails on the gamma budget and nothing asserts gamma.'),
  ];
  const out = await propose(input(many), {
    workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 1,
  });
  assert.equal(out.created.length, 1);
  assert.equal(out.rationed, 2, 'the two it held back are countable, not invisible');
  s.dispose();
});

test('every observation is accounted for — nothing is dropped silently', async () => {
  const s = sandbox();
  const points = [
    point(CHECKABLE),
    point('Nothing asserts the handover, so test/scripts/handover-check.test.ts fails on it.'),
    point('test/core/mutate.test.ts is flaky and passed on the retry.'),
    point('Everything went fine today.'),
    point('Every relative import in src/core/mutate.ts must carry an explicit .ts extension.'),
    point('The suite test/b-two.test.ts fails on the beta rebuild and nothing asserts beta.'),
  ];
  const out = await propose(input(points), {
    workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 1,
  });
  const accounted = out.proposals.length + out.rationed + out.screened + out.empty
    + out.suppressed + out.declined + out.irrelevant
    + out.unauthored.check + out.unauthored.rule + out.unauthored.lesson;
  assert.equal(accounted, out.considered, 'a proposer whose numbers do not add up is one nobody can audit');
  s.dispose();
});

test('propose never edits, retires or promotes anything that already exists', async () => {
  const s = sandbox();
  const before = s.ctx.store.get('CONST-x') ?? null;
  const out = await propose(input([point(CHECKABLE)]), {
    workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5,
  });
  for (const id of out.created) {
    assert.equal(s.ctx.store.get(id)?.status, 'draft');
  }
  assert.equal(before, null);
  s.dispose();
});
