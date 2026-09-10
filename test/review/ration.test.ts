// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen,
// INV-nothing-is-dropped-silently
//
// §10, and the half of it that MODIFIES an owner ruling rather than carrying
// one out. He chose an age-coloured count; the research the spec cites says an
// age-coloured count is a PRESSURE mechanism, and that past a reviewer's
// capacity more escalation makes the system less safe. So the colour stays and
// the queue gains a ceiling.
//
// What is asserted here is the pair of properties that make the ceiling a
// RATION rather than a filter:
//
//   1. past the ceiling a pass creates NOTHING and says which of the two
//      rations stopped it — `held` and `rationed` are different facts with
//      different remedies, and folding them would tell a reader to wait for a
//      next pass that is never coming;
//   2. capture CONTINUES — the report still accounts for every observation,
//      and the sightings ledger still accrues, because "proposals wait" is not
//      "observations are discarded".
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { propose, readSightings, NO_QUEUE_CEILING } from '../../src/review/propose.ts';
import { DEFAULT_REVIEW } from '../../src/core/config.ts';
import { createItem } from '../../src/core/mutate.ts';
import { reviewQueue } from '../../src/core/select.ts';
import type { PassInput, Point } from '../../src/review/input.ts';
import { sandbox } from '../helpers/workspace.ts';

/** A checkable observation about a named file — the one tier this build authors. */
function point(n: number): Point {
  return {
    category: 'measurement', who: 'person', source: 'C:/t/lane.jsonl', recordIndex: n,
    at: '2026-09-11T00:00:00.000Z',
    text: `Run npm run check:basis before landing scripts/gate-${n}.ts, because the gate reads `
      + `every test file's declared basis and a file that declares none passes silently.`,
  };
}

function input(points: Point[]): PassInput {
  return {
    points, readTo: 0, sources: ['C:/t/lane.jsonl'], whole: true, skipped: [],
    readBytes: 0, records: points.length, unreadable: 0, briefPoints: 0, ms: 0,
  };
}

/** `n` drafts already waiting for a person, through the ordinary write path. */
function fillQueue(ctx: Parameters<typeof createItem>[0], n: number): void {
  for (let i = 0; i < n; i++) {
    createItem(ctx, {
      type: 'task', title: `waiting ${i}`, summary: `Something already pending, number ${i}.`,
      body: 'A draft nobody has settled yet.', origin: 'review',
    });
  }
}

test('the per-pass ration caps what is written and holds the rest for the next pass', async () => {
  const s = sandbox();
  try {
    const out = await propose(input([point(1), point(2), point(3)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 1, queueCeiling: NO_QUEUE_CEILING,
    });
    assert.equal(out.created.length, 1, 'the ration bounds VOLUME');
    assert.equal(out.rationed, 2, 'and what it held back is counted, never dropped');
    assert.equal(
      out.held, null,
      'the QUEUE was not the reason — a reader must be able to tell "come back next pass" from ' +
      '"nothing will be proposed until you work this down"',
    );
  } finally {
    s.dispose();
  }
});

test('with the queue at the ceiling a pass creates nothing and says so', async () => {
  const s = sandbox();
  try {
    fillQueue(s.ctx, 3);
    assert.equal(reviewQueue(s.ctx.store.all()).length, 3);

    const out = await propose(input([point(1), point(2)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5, queueCeiling: 3,
    });

    assert.equal(out.created.length, 0, 'past the ceiling a pass writes nothing at all');
    assert.deepEqual(out.held, { pending: 3, ceiling: 3 }, 'and it says which ration stopped it');
    assert.equal(out.rationed, 2, 'every candidate it would have written is still counted');
    assert.match(out.because.join(' '), /held: 3 item\(s\) already waiting/);
    assert.match(
      out.because.join(' '), /capture\s+continues and proposals wait/,
      'the ceiling holds proposals; it does not discard observations',
    );
    assert.equal(
      reviewQueue(s.ctx.store.all()).length, 3,
      'the queue is exactly as it was — the ceiling is a ration on the write, not on the read',
    );
  } finally {
    s.dispose();
  }
});

test('capture continues past the ceiling: the report and the sightings ledger both accrue', async () => {
  const s = sandbox();
  try {
    fillQueue(s.ctx, 2);
    const out = await propose(input([point(1), point(2), point(3)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5, queueCeiling: 2,
    });

    assert.equal(out.considered, 3, 'the denominator is what was read, never what was written');
    assert.equal(
      out.created.length + out.rationed + out.screened + out.empty + out.suppressed
      + out.declined + out.irrelevant + out.unauthored.check + out.unauthored.rule
      + out.unauthored.lesson,
      out.considered,
      'every observation is still accounted for under a ceiling — nothing is dropped silently',
    );
    assert.ok(
      readSightings(s.root).length > 0,
      'recurrence keeps accruing while proposals wait, or a claim seen under a full queue would ' +
      'arrive unconfirmed forever once the queue drains',
    );
  } finally {
    s.dispose();
  }
});

test('a queue below the ceiling proposes normally, and the ceiling is exclusive of nothing', async () => {
  const s = sandbox();
  try {
    fillQueue(s.ctx, 2);
    const out = await propose(input([point(1)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5, queueCeiling: 3,
    });
    assert.equal(out.held, null, 'two waiting against a ceiling of three is not full');
    assert.equal(out.created.length, 1);
  } finally {
    s.dispose();
  }
});

test('a ceiling of 0 is the ceiling set to nothing, and is not a second kill switch', async () => {
  // `maxProposalsPerPass: 0` already reads this way in `core/config.ts`, and
  // the symmetry is the argument: §11's rule is ONE switch for one subsystem,
  // and the switch is `review.enabled`. A ration set to nothing still reads,
  // still reports and still notes sightings; a switch turned off spawns no
  // child at all. These two tests are the difference, stated on the ceiling.
  const s = sandbox();
  try {
    const out = await propose(input([point(1)]), {
      workspace: s.root, ctx: s.ctx, sessionId: 'one', max: 5, queueCeiling: 0,
    });
    assert.equal(out.created.length, 0);
    assert.deepEqual(out.held, { pending: 0, ceiling: 0 });
    assert.equal(out.considered, 1, 'it still read the session');
    assert.ok(readSightings(s.root).length > 0, 'and still recorded what it saw');
  } finally {
    s.dispose();
  }
});

test('the shipped ceiling is one session at full ration, and is a live number', () => {
  // 15 = §11's printed `maxProposalsPerPass: 5` × its `maxFiresPerSession: 3`.
  // Asserted against the object rather than against the literal so that a
  // change to either factor has to be made deliberately here as well.
  assert.equal(DEFAULT_REVIEW.queueCeiling, 15);
  assert.equal(
    DEFAULT_REVIEW.queueCeiling, 5 * DEFAULT_REVIEW.maxFiresPerSession,
    'the ceiling is one session at §11\'s ration — if a full session\'s worth is still pending, ' +
    'the queue is not being worked, and the answer to that is to stop adding to it',
  );
  assert.equal(
    DEFAULT_REVIEW.maxProposalsPerPass, 0,
    'the ration still ships at 0, so the ceiling governs nothing until the owner raises it',
  );
});
