// @basis TASK-a-declined-claim-comes-back-when-a-later-pass-words-it, INV-nothing-is-dropped-silently, CONST-node-24-no-build-step
//
// **EVERY EXISTING DECLINE TEST EXERCISES THE LEDGER WITH THE CLAIM STRING IT
// JUST WROTE**, and that is the fixture carrying the proof's power: it passes
// forever while the mechanism decays in the field. It decayed. The owner
// declined four drafts on 2026-09-15 between 09:39Z and 09:41Z and a pass
// re-created two of them at 09:06Z+25min — same titles, same targets, same
// FILENAMES — and did it a third time at 10:57Z while this was being measured.
//
// So nothing here replays a stored key. Every suppression asserted below is
// proved by running `propose` TWICE, over two different transcripts in two
// different sessions, where the second says the same thing in different
// surrounding words — which is what a later pass actually does.
//
// **AND THE TEST NAMES WHICH GATE DID THE WORK.** The fuzzy claim gate is
// asserted to MISS on the same input the exact gate catches, because a test
// that only asserted "it was suppressed" would go green again the day somebody
// widened `NEAR_CLAIM_THRESHOLD` instead — which is the change this item
// explicitly refuses until the score distribution is measured across many
// declines rather than two.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { claimKey, claimScore, NEAR_CLAIM_THRESHOLD } from '../../src/review/claim.ts';
import { declineDraft } from '../../src/review/decline.ts';
import {
  alreadyDeclined, declinedAtSameId, declinedFamily, readDeclines, recordDecline,
} from '../../src/review/declined.ts';
import { NO_QUEUE_CEILING, propose } from '../../src/review/propose.ts';
import { slugify } from '../../src/core/slug.ts';
import type { PassInput, Point } from '../../src/review/input.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * One claim sentence. It is the ONLY thing the two transcripts below share,
 * and it is what both passes select — which is the whole field mechanism: a
 * later session quotes the same finding surrounded by different prose.
 */
const SENTENCE =
  'The suite test/scripts/handover-check.test.ts fails on the handover, and nothing asserts it.';

/** The first session's words. */
const TEXT_A = `${SENTENCE} I noticed it while chasing an unrelated red in the rule store lane, `
  + 'and the reproduction took three runs because the fixture seeds a corpus that already '
  + 'carries a dangling pointer.';

/** A LATER session's words about the same thing. Nothing but `SENTENCE` is shared. */
const TEXT_B = 'Picking up the CI triage from yesterday afternoon. '
  + `${SENTENCE} Nobody has filed anything, and the workflow file was rewritten twice last week `
  + 'without anyone noticing the gap in coverage.';

function point(text: string, over: Partial<Point> = {}): Point {
  return {
    category: 'measurement', who: 'model', source: 'C:/t/a.jsonl', recordIndex: 7,
    at: '2026-09-11T00:00:00.000Z', text, ...over,
  };
}

function input(points: Point[]): PassInput {
  return {
    points, readTo: 0, sources: ['C:/t/a.jsonl'], whole: true, skipped: [],
    readBytes: 0, records: points.length, unreadable: 0, briefPoints: 0, ms: 0,
  };
}

/* ══ THE FIELD FAILURE, RUN END TO END ═════════════════════════════════════ */

test('a claim declined in one pass is NOT re-created by a later pass in different words',
  async () => {
    const s = sandbox();
    try {
      const first = await propose(input([point(TEXT_A)]), {
        workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
        queueCeiling: NO_QUEUE_CEILING,
      });
      // ANTI-VACUITY: a pass that proposed nothing would make every assertion
      // below true about an empty queue.
      assert.equal(first.created.length, 1, 'the first pass proposed nothing to decline');
      const draft = s.ctx.store.get(first.created[0]!) as Item;

      // The production decline path, not a hand-written ledger row: what is
      // being tested is whether what `declineDraft` WRITES is what `propose`
      // can READ, and a fabricated row would answer a different question.
      declineDraft(s.ctx, draft, 'the workflow line buys nothing');
      const ledger = readDeclines(s.root);
      assert.equal(ledger.length, 1);
      assert.equal(ledger[0]?.id, draft.id, 'the decline did not record the filename it freed');

      const second = await propose(input([
        point(TEXT_B, { source: 'C:/t/b.jsonl', recordIndex: 41 }),
      ]), {
        workspace: s.root, ctx: s.ctx, sessionId: 'session-two', max: 5,
        queueCeiling: NO_QUEUE_CEILING,
      });

      assert.deepEqual(second.created, [],
        'a later pass re-created a draft the owner had already declined');
      assert.equal(second.declined, 1, 'it was dropped, but not as a decline');
      assert.ok(
        second.because.some((line) => line.includes('declined before')),
        `the pass did not say WHY it dropped it: ${JSON.stringify(second.because)}`,
      );
    } finally {
      s.dispose();
    }
  });

/**
 * **WHICH GATE DID THE WORK, stated as an assertion rather than left to be
 * assumed.**
 *
 * The test above would pass just as well if somebody dropped
 * `NEAR_CLAIM_THRESHOLD` to 0.2 and deleted the exact gate. The item this
 * rests on refuses that change in as many words — two pairs is not a
 * distribution, and suppressing a genuinely NEW claim is worse than
 * re-proposing an old one, because the owner never sees it and nothing tells
 * him. So the fuzzy gate is asserted to MISS, at a measured score, and the
 * exact gate is asserted to catch the same input.
 */
test('the fuzzy claim gate MISSES this and the exact filename gate is what catches it',
  async () => {
    const s = sandbox();
    try {
      const first = await propose(input([point(TEXT_A)]), {
        workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
        queueCeiling: NO_QUEUE_CEILING,
      });
      assert.equal(first.created.length, 1, 'the first pass proposed nothing to decline');
      const draft = s.ctx.store.get(first.created[0]!) as Item;
      const target = draft.scope[0] ?? null;
      declineDraft(s.ctx, draft, null);
      const stored = readDeclines(s.root)[0]!;

      // The key `propose.ts` builds for the LATER pass: title plus that pass's
      // own transcript text. Spelled exactly as `propose.ts` spells it.
      const laterKey = claimKey(draft.title, TEXT_B, target);

      const score = claimScore(laterKey, stored.claim);
      assert.ok(score < NEAR_CLAIM_THRESHOLD,
        `the fuzzy gate now scores ${score.toFixed(3)} >= ${NEAR_CLAIM_THRESHOLD} on this pair, ` +
        'so this test no longer proves the exact gate is load-bearing — re-derive it');
      assert.equal(alreadyDeclined(s.root, laterKey, target), null,
        'the fuzzy gate caught this, so nothing here says the exact gate does anything');

      // And the exact gate, on the same input.
      const caught = declinedAtSameId(s.root, slugify(draft.title), target);
      assert.notEqual(caught, null, 'the exact filename gate let a declined claim back in');
      assert.equal(caught?.id, draft.id);
    } finally {
      s.dispose();
    }
  });

/**
 * **AND THE OTHER PROPOSER IS NOT A WAY AROUND IT.** The model path goes
 * through the same gates in the same order by design (`propose.ts`'s own
 * header: "the model's answers are put through the SAME gates"), so a decline
 * that only bound the deterministic proposer would be a decline the pass could
 * escape by composing the claim instead of selecting it.
 */
test('a claim declined from a deterministic draft is refused on the MODEL path too', async () => {
  const s = sandbox();
  try {
    const first = await propose(input([point(TEXT_A)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'session-one', max: 5,
      queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(first.created.length, 1, 'the first pass proposed nothing to decline');
    const draft = s.ctx.store.get(first.created[0]!) as Item;
    const target = draft.scope[0] ?? null;
    assert.notEqual(target, null, 'the fixture draft names no target, so the gate cannot apply');
    declineDraft(s.ctx, draft, null);

    // The model composes the SAME claim in its own words — a different brief,
    // a different session, a different record. Only the title survives, which
    // is what decides the filename.
    const second = await propose(input([point(TEXT_B, { source: 'C:/t/b.jsonl', recordIndex: 41 })]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'session-two', max: 5,
      queueCeiling: NO_QUEUE_CEILING,
      modelCandidates: [{
        artifact: 'check', target: target as string, title: draft.title,
        summary: draft.title.slice(0, 120),
        // **LONG, AND DELIBERATELY SO.** A short brief makes the model's claim
        // key title-dominated, and a title-dominated key scores high enough
        // against the stored one that the FUZZY gate catches it — measured,
        // and it made an earlier version of this test vacuous: removing the
        // model-path gate left it green. Filling the 24-token cap with the
        // brief's own vocabulary is what puts this candidate where the field
        // failure actually lives, below the threshold and above nothing.
        brief: 'A workflow job would run the dependency budget audit against the shipped '
          + 'manifest on every push, comparing the declared ceiling with what the lockfile '
          + 'resolves, and would fail the build whenever a transitive package appears that '
          + 'nobody declared. Today that comparison happens only when somebody remembers to '
          + 'run it locally, so a regression reaches main and is discovered days later by a '
          + 'reader who notices the number changed.',
        evidence: [{ source: 'C:/t/b.jsonl', recordIndex: 41 }],
      }],
    });

    assert.deepEqual(second.created, [],
      'the model path re-created a draft the owner had already declined');
    // **THE MODEL'S OWN COUNTER, not the pass total.** The deterministic path
    // refuses this claim on its own, so `second.declined` is >= 1 whatever the
    // model path does — an assertion on the total would be green for a build
    // with no model gate at all, which is exactly how the first draft of this
    // test managed to prove nothing.
    assert.equal(second.model?.declined, 1,
      'the model path did not refuse a claim the owner had declined');
    assert.equal(second.model?.ranked, 0, 'the model candidate reached the ration anyway');
  } finally {
    s.dispose();
  }
});

/* ══ THE GATE'S OWN BOUNDARIES, ONE REMOVED CONDITION AT A TIME ════════════ */

test('the id family is one name — a re-proposal cannot escape into the -2 suffix', () => {
  const s = sandbox();
  try {
    // Measured on the owner's own state: he declined
    // `…-if-corpus-plans-has-plan` AND `…-has-plan-2` within ninety seconds.
    // A gate on the literal id would hand the next re-proposal the suffix.
    recordDecline(s.root, {
      claim: 'x :: alpha beta gamma', target: 'x', at: '2026-09-15T09:40:16.391Z', why: null,
      id: 'TASK-a-claim-the-owner-declined-2',
    });
    assert.equal(declinedFamily('TASK-a-claim-the-owner-declined-2'),
      'TASK-a-claim-the-owner-declined');
    assert.notEqual(
      declinedAtSameId(s.root, 'a-claim-the-owner-declined', 'x'), null,
      'a decline recorded at -2 does not cover the base name it belongs to',
    );
    assert.notEqual(
      declinedAtSameId(s.root, 'a-claim-the-owner-declined-3', 'x'), null,
      'the next sibling in the family escaped the gate',
    );
  } finally {
    s.dispose();
  }
});

test('THE TARGET IS AN EXACT GATE HERE TOO — the same words about a different file pass', () => {
  const s = sandbox();
  try {
    recordDecline(s.root, {
      claim: 'styles.css :: alpha beta gamma', target: 'styles.css',
      at: '2026-09-15T09:40:16.391Z', why: null, id: 'TASK-the-file-is-never-loaded',
    });
    // Same slug, different target. §5b's own example: "the same words about a
    // different target" are a different claim, and an id carries no target, so
    // without this gate one declined filename would silence the claim about
    // every other file in the repository.
    assert.equal(declinedAtSameId(s.root, 'the-file-is-never-loaded', 'app.js'), null,
      'a decline about styles.css suppressed a claim about app.js');
    assert.equal(declinedAtSameId(s.root, 'the-file-is-never-loaded', null), null,
      'a decline with a target suppressed a claim that names none');
    // ANTI-VACUITY: the same call with the target it was declined under DOES
    // match, so the two `null`s above are the target gate and not a typo.
    assert.notEqual(declinedAtSameId(s.root, 'the-file-is-never-loaded', 'styles.css'), null);
  } finally {
    s.dispose();
  }
});

test('a ledger written before this field existed still answers, and is not dropped', () => {
  const s = sandbox();
  try {
    // Exactly the four rows on the owner's disk at 09:41Z: no `id` anywhere,
    // because the field did not exist when they were written. A build that
    // refused them would forget declines he actually made.
    recordDecline(s.root, {
      claim: 'scripts/check-handover.ts :: alpha beta gamma',
      target: 'scripts/check-handover.ts', at: '2026-09-15T09:39:40.255Z', why: null,
    });
    const kept = readDeclines(s.root);
    assert.equal(kept.length, 1, 'a row with no id was dropped from the ledger');
    assert.equal(kept[0]?.id, null, 'absent and null are not the same thing here');
    // It still answers the FUZZY question — the half that never needed an id.
    assert.notEqual(
      alreadyDeclined(s.root, 'scripts/check-handover.ts :: alpha beta gamma',
        'scripts/check-handover.ts'),
      null, 'an id-less row stopped working as a decline at all');
    // And it simply does not answer the exact one, which is honest: it never
    // recorded a filename, so it cannot claim one.
    assert.equal(declinedAtSameId(s.root, 'anything-at-all', 'scripts/check-handover.ts'), null);
  } finally {
    s.dispose();
  }
});
