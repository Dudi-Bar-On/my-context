// @basis TASK-make-the-queue-workable-and-impossible-to-rot-unseen,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// INV-nothing-is-dropped-silently
//
// §10, and the item's own words: "THE INDICATOR DRAWS NOTHING AT ZERO. An
// indicator that shows something when there is nothing pending trains a reader
// to ignore it." So the zero is asserted as SILENCE — `reviewChip` returning
// `null` — and it is asserted on the shared function rather than on either
// surface, because the whole point of the shared function is that neither
// surface gets to spell the rule again.
//
// The colour is asserted to key on the AGE OF THE OLDEST and never on the
// count: twelve drafts from today must stay quiet and three from six weeks ago
// must not, and a count-keyed chip cannot tell those apart.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  AGEING_DAYS, NOTHING_PENDING, oldestAgeDays, pendingReview, queueAge, reviewChip, STALE_DAYS,
} from '../../src/review/pending.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const DAY = 86_400_000;
const NOW = Date.parse('2026-09-11T12:00:00.000Z');

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'review-pending-'));
}

/** A draft, in exactly the two fields `reviewQueue` filters on plus its date. */
function draft(id: string, validFrom: string | null): Item {
  return {
    id, type: 'task', title: id, status: 'draft', layer: 'project',
    severity: 'soft', always: false, scope: [], tags: [], summary: '', body: '',
    origin: 'review', validFrom, validUntil: null,
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    checksum: '', filePath: `.drafts/task/${id}.md`, relations: [], extra: {},
  } as unknown as Item;
}

/** One pending revision in the log's own shape, staged at `at`. */
function stage(dir: string, revisionId: string, at: string): void {
  const file = path.join(dir, '.revisions', 'revisions.jsonl');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({
    protocol: 'my_context/revision@1', op: 'stage', revisionId,
    itemId: 'RULE-x', changes: { body: 'new' }, base: { body: 'old' },
    origin: 'agent', at,
  })}\n`, { flag: 'a' });
}

test('an empty queue draws nothing at all', () => {
  const dir = root();
  try {
    const view = pendingReview(dir, []);
    assert.deepEqual(view, NOTHING_PENDING);
    assert.equal(
      reviewChip(view, NOW), null,
      'an indicator that draws at zero trains a reader to ignore it — 74 of 74 doctor findings',
    );
    assert.equal(reviewChip(null, NOW), null, 'an unmeasurable queue draws nothing either');
  } finally {
    removeTree(dir);
  }
});

test('a queue that could not be read is not the same fact as an empty one', () => {
  // The type keeps them apart: `null` is "nothing was measured", and
  // `NOTHING_PENDING` is a measured zero. Both draw nothing on the bar; only
  // one of them can be reported as "the queue is clear".
  assert.notEqual(NOTHING_PENDING.total, null);
  assert.equal(reviewChip(null, NOW), null);
});

test('twelve drafts from today are quiet, and three from six weeks ago are not', () => {
  const dir = root();
  try {
    const today = new Date(NOW).toISOString().slice(0, 10);
    const busy = pendingReview(dir, Array.from({ length: 12 }, (_, i) => draft(`T-${i}`, today)));
    const busyChip = reviewChip(busy, NOW);
    assert.ok(busyChip);
    assert.equal(busyChip.count, 12);
    assert.equal(busyChip.age, 'fresh', 'a productive session must not be coloured as rot');

    const old = new Date(NOW - 42 * DAY).toISOString().slice(0, 10);
    const landfill = pendingReview(dir, [draft('A', old), draft('B', old), draft('C', old)]);
    const landfillChip = reviewChip(landfill, NOW);
    assert.ok(landfillChip);
    assert.equal(landfillChip.count, 3);
    assert.equal(landfillChip.age, 'stale');
    // The count is the SMALLER of the two and the colour is the louder one.
    // That inversion is the whole argument for keying on age.
    assert.ok(landfillChip.count < busyChip.count);
  } finally {
    removeTree(dir);
  }
});

test('the colour is keyed on the oldest, not on the newest or the average', () => {
  const dir = root();
  try {
    const today = new Date(NOW).toISOString().slice(0, 10);
    const ancient = new Date(NOW - (STALE_DAYS + 5) * DAY).toISOString().slice(0, 10);
    const view = pendingReview(dir, [
      draft('new-1', today), draft('new-2', today), draft('new-3', today), draft('old', ancient),
    ]);
    assert.equal(queueAge(view, NOW), 'stale', 'one ancient draft among three fresh is landfill');
    assert.equal(oldestAgeDays(view, NOW), STALE_DAYS + 5);
    assert.equal(view.oldestAt, ancient);
  } finally {
    removeTree(dir);
  }
});

test('the bands step exactly where the corpus measured them', () => {
  const dir = root();
  try {
    const at = (days: number): string => new Date(NOW - days * DAY).toISOString().slice(0, 10);
    const age = (days: number): string => queueAge(pendingReview(dir, [draft('x', at(days))]), NOW);
    assert.equal(age(AGEING_DAYS - 1), 'fresh', 'inside the stretch that made it');
    assert.equal(age(AGEING_DAYS), 'ageing', 'it survived a night; nobody settled it in session');
    assert.equal(age(STALE_DAYS - 1), 'ageing');
    assert.equal(
      age(STALE_DAYS), 'stale',
      'past the longest settle this corpus has ever completed (9.6 days, 2026-08-29)',
    );
  } finally {
    removeTree(dir);
  }
});

test('both queues are counted, and a pending revision dates the chip too', () => {
  const dir = root();
  try {
    stage(dir, 'REV-1', new Date(NOW - (STALE_DAYS + 1) * DAY).toISOString());
    const view = pendingReview(dir, [draft('fresh', new Date(NOW).toISOString().slice(0, 10))]);
    assert.equal(view.drafts, 1);
    assert.equal(view.revisions, 1);
    assert.equal(view.total, 2, 'the split queue is two lists and one count');
    assert.equal(queueAge(view, NOW), 'stale', 'the oldest thing pending is the revision');
  } finally {
    removeTree(dir);
  }
});

test('an undated pending draft is counted, and is never evidence of youth', () => {
  const dir = root();
  try {
    const view = pendingReview(dir, [draft('undated', null), draft('bad', 'not-a-date')]);
    assert.equal(view.total, 2);
    assert.equal(view.undated, 2, 'nothing is dropped silently, including out of a denominator');
    assert.equal(view.oldestAt, null);
    assert.equal(oldestAgeDays(view, NOW), null);
    assert.equal(queueAge(view, NOW), 'ageing', 'an unreadable date must make a reader look');
    const chip = reviewChip(view, NOW);
    assert.ok(chip);
    assert.equal(chip.days, null, 'a chip may say a count without claiming an age');
  } finally {
    removeTree(dir);
  }
});

test('a non-draft, a non-project draft and a retired item are not pending', () => {
  const dir = root();
  try {
    const active = { ...draft('active', '2026-01-01'), status: 'active' } as Item;
    const global = { ...draft('global', '2026-01-01'), layer: 'global' } as Item;
    const view = pendingReview(dir, [active, global]);
    assert.equal(
      view.total, 0,
      'the queue filter is `reviewQueue`, layer clause included — three of four surfaces once ' +
      'omitted it and reported a queue the reader could not act on',
    );
    assert.equal(reviewChip(view, NOW), null);
  } finally {
    removeTree(dir);
  }
});

test('a pending revision dates the CHIP and never the drafts half', () => {
  // The defect this split exists for: `mycontext status --json` publishes a
  // `reviewQueue` block whose every other field counts drafts, and it was
  // given the combined `oldestAt` — so staging a revision, which creates no
  // item and is in no listing of items, moved a number in the drafts summary.
  const dir = root();
  try {
    const staged = new Date(NOW - (STALE_DAYS + 1) * DAY).toISOString();
    stage(dir, 'REV-1', staged);
    const view = pendingReview(dir, []);
    assert.equal(view.drafts, 0);
    assert.equal(view.oldestAt, staged, 'the combined view is what colours a chip counting both');
    assert.deepEqual(
      view.draftsOnly, { oldestAt: null, undated: 0 },
      'and the drafts half is untouched by it — no draft exists, so it has no age at all',
    );
    assert.equal(
      queueAge(view.draftsOnly, NOW), 'fresh',
      'the same verdict function answers for either half, so the two cannot drift apart',
    );
  } finally {
    removeTree(dir);
  }
});

test('the drafts half carries its own oldest and its own undated count', () => {
  const dir = root();
  try {
    stage(dir, 'REV-1', new Date(NOW - (STALE_DAYS + 1) * DAY).toISOString());
    const old = new Date(NOW - 3 * DAY).toISOString().slice(0, 10);
    const view = pendingReview(dir, [draft('old', old), draft('undated', null)]);
    assert.deepEqual(view.draftsOnly, { oldestAt: old, undated: 1 });
    assert.equal(
      view.undated, 1,
      'the combined count is the same undated draft, counted once and not twice',
    );
  } finally {
    removeTree(dir);
  }
});
