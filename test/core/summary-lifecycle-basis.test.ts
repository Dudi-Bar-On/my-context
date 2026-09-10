// @basis TASK-a-lifecycle-note-makes-an-item-s-summary-read-stale-because, DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing, INV-nothing-is-dropped-silently
/**
 * **Retiring an item must not make its summary read stale — and a substantive
 * observation must still make it read stale.**
 *
 * D43, owner ruling 2026-09-10. `SUMMARY_BASIS.observations` is `summarised`,
 * and retiring an item WRITES an observation onto it: `updateItem`'s
 * stand-down note (`retirement`) and `supersedeItem`'s two notes
 * (`supersession`). So correctly retiring or replacing an item moved its
 * summary basis and `doctor` reported `summary_stale` on an item whose meaning
 * had not changed. `LIFECYCLE_OBSERVATION_CATEGORIES` (core/content-hash.ts)
 * is the repair, and it is the exclusion `WORKFLOW_EXTRA_KEYS` already makes
 * inside `extra`, applied one field over.
 *
 * The defect was LATENT when this file was written — `doctor` reported zero
 * `summary_stale` findings on this repository's own corpus, because the two
 * live ones had been re-affirmed on 2026-09-09 by passing the same sentence
 * back verbatim. It is therefore reproduced here rather than observed, through
 * the same supported doors a person uses.
 *
 * Four properties, and the third is the one that keeps this repair from being
 * the same defect facing the other way:
 *
 *  1. **A retirement through either door leaves the summary `current`** —
 *     `mycontext edit --status deprecated` on a pinned or `hard` item, and
 *     `supersedeItem` on both the retiree and the replacement.
 *  2. **The exclusion is by CATEGORY and the categories are the ones the
 *     writers actually mint** — asserted against what the real write paths
 *     produce, not against a copy of the list.
 *  3. **A SUBSTANTIVE observation still moves the basis.** Widening
 *     `observations` to `unsummarised` wholesale would let a real change pass
 *     without ever marking a summary stale, silently. It must not.
 *  4. **Content IDENTITY still sees the lifecycle note.** The cut is inside
 *     `itemSummaryBasis` only, exactly as `WORKFLOW_EXTRA_KEYS`' is —
 *     `itemContentHash` and `createItem`'s dedupe are untouched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isLifecycleObservation, itemContentHash, itemSummaryBasis, summaryState,
} from '../../src/core/content-hash.ts';
import { createItem, supersedeItem, updateItem } from '../../src/core/mutate.ts';
import { checkSummary } from '../../src/doctor/checks.ts';
import type { Item, Observation } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const PLAIN = 'Close the ledger before midnight so the opening balance is complete.';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

/** A rule with a summary, `hard` and pinned — so that retiring it actually
 * trips `standDownFields` and the note gets written. A soft, unpinned item is
 * retired without a stand-down note at all, which is why the pre-existing
 * retirement test in `summary.test.ts` never saw this. */
function governing(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Close the nightly ledger before midnight',
    body: "The nightly ledger is closed before midnight local time, or the next day's opening "
      + 'balance is computed from a partial set of entries.',
    status: 'active',
    origin: 'human',
    severity: 'hard',
    always: true,
    summary: PLAIN,
    distinct: box.ctx.store.all().filter((i) => i.type === 'rule').map((i) => i.id),
    ...extra,
  }).id;
}

function observationsOf(box: Sandbox, id: string): Observation[] {
  return itemOf(box, id).observations;
}

// --- 1. the reproduction, through both supported doors ----------------------

test('retiring a governing item with `--status deprecated` leaves its summary current', () => {
  const box = sandbox();
  try {
    const id = governing(box);
    assert.equal(summaryState(itemOf(box, id)), 'current', 'a fresh summary is never born stale');

    updateItem(box.ctx, { id, status: 'deprecated', origin: 'human' });

    // The note IS written — this repair does not work by not recording the
    // stand-down (`INV-nothing-is-dropped-silently`), it works by not counting
    // it toward what the summary describes.
    const notes = observationsOf(box, id).filter((o) => o.category === 'retirement');
    assert.equal(notes.length, 1, 'the stand-down must still record itself on the item');
    assert.match(notes[0].text, /Stood down on /);

    assert.equal(summaryState(itemOf(box, id)), 'current',
      'retiring an item through a supported door changed nothing about what it SAYS, so a '
      + 'summary written against it still describes it');
    assert.equal(checkSummary(box.ctx.store.all()).filter((f) => f.code === 'summary_stale').length,
      0, '`doctor` is the surface this is measured on, and it must report nothing');
  } finally { box.dispose(); }
});

test('a supersession leaves BOTH the retiree and the replacement current', () => {
  const box = sandbox();
  try {
    const old = governing(box);
    const replacement = governing(box, {
      title: 'Close the nightly ledger before 23:00',
      summary: 'Close the ledger an hour before midnight so late entries still land.',
    });
    supersedeItem(box.ctx, {
      id: old,
      by: replacement,
      origin: 'human',
      reason: 'the midnight cut-off left no room for a late entry to be corrected',
    });

    assert.deepEqual(
      observationsOf(box, old).map((o) => o.category), ['supersession'],
      "the retiree's stand-down note is still recorded",
    );
    assert.deepEqual(
      observationsOf(box, replacement).map((o) => o.category), ['supersession'],
      "the replacement's `Replaces <id>: <reason>` note is still recorded",
    );

    assert.equal(summaryState(itemOf(box, old)), 'current',
      'this half is OLDER than the stand-down note: `supersedeItem` has moved the retiree\'s '
      + 'basis on every replacement this corpus has ever recorded');
    assert.equal(summaryState(itemOf(box, replacement)), 'current',
      'and the reason observation did the same to the replacement');
  } finally { box.dispose(); }
});

// --- 2. the categories are the ones the writers actually mint ---------------

test('every observation the lifecycle write paths mint is excluded by name', () => {
  const box = sandbox();
  try {
    const retired = governing(box);
    updateItem(box.ctx, { id: retired, status: 'deprecated', origin: 'human' });

    const old = governing(box, { title: 'Reconcile the ledger every morning' });
    const replacement = governing(box, { title: 'Reconcile the ledger twice a day' });
    supersedeItem(box.ctx, { id: old, by: replacement, origin: 'human', reason: 'once was not enough' });

    // Driven from what the real paths PRODUCED rather than from a second copy
    // of the category list: a writer that starts minting a third lifecycle
    // category reddens this without anybody remembering to update a fixture.
    for (const id of [retired, old, replacement]) {
      const notes = observationsOf(box, id);
      assert.ok(notes.length > 0, `${id} recorded no lifecycle note at all`);
      for (const note of notes) {
        assert.ok(isLifecycleObservation(note),
          `${id} carries a lifecycle note in category "${note.category}", which `
          + '`LIFECYCLE_OBSERVATION_CATEGORIES` does not name — so retiring an item through '
          + 'that path still makes its summary read stale');
      }
    }
  } finally { box.dispose(); }
});

// --- 3. a SUBSTANTIVE observation still moves the basis ---------------------

/** One observation, appended to a copy of an item. `UpdateInput` carries no
 * `observations` field — an observation is added at capture, or by an ingest
 * apply, never by `mycontext edit` — so the substantive half is asserted where
 * the decision actually lives, on `itemSummaryBasis` itself. Passing an
 * unsupported key to `updateItem` would have been silently ignored, and the
 * assertion would have passed for the wrong reason. */
function plus(item: Item, o: Observation): Item {
  return { ...item, observations: [...item.observations, o] };
}

test('a substantive observation still moves the basis', () => {
  // The guard against fixing this in the other direction. Widening
  // `SUMMARY_BASIS.observations` to `unsummarised` would pass every test above
  // and would let a real change to what an item asserts pass unflagged —
  // silently, which is worse than the defect being repaired.
  const box = sandbox();
  try {
    const item = itemOf(box, governing(box));
    const basis = itemSummaryBasis(item);
    for (const category of ['limit', 'edge_case', 'evidence', 'rule', 'note', 'history']) {
      const moved = plus(item, {
        category,
        text: 'A ledger with no entries after 18:00 may be closed early.',
        tags: [],
        context: null,
      });
      assert.notEqual(itemSummaryBasis(moved), basis,
        `an observation in category "${category}" is part of what the item asserts — a summary `
        + 'that counts three limits is wrong at four, and the basis must say so');
      assert.equal(summaryState(moved), 'stale',
        `and the verdict a reader sees for "${category}" must be stale, not current`);
    }
  } finally { box.dispose(); }
});

test('a lifecycle note added beside a substantive one does not hide it', () => {
  const box = sandbox();
  try {
    const id = governing(box);
    // The item is retired first, so the lifecycle note is genuinely on it and
    // in front of the substantive one in the list.
    updateItem(box.ctx, { id, status: 'deprecated', origin: 'human' });
    const retired = itemOf(box, id);
    assert.equal(summaryState(retired), 'current');
    assert.equal(retired.observations.length, 1);

    const withLimit = plus(retired, {
      category: 'limit', text: 'Weekends are excluded.', tags: [], context: null,
    });
    assert.equal(summaryState(withLimit), 'stale',
      'a lifecycle note is invisible to the basis; it does not launder the observations that '
      + 'follow it');
  } finally { box.dispose(); }
});

// --- 4. content IDENTITY still sees the note --------------------------------

test('the cut is inside itemSummaryBasis only — content identity still sees the note', () => {
  const box = sandbox();
  try {
    const id = governing(box);
    const before = itemOf(box, id);
    const identityBefore = itemContentHash(before);
    const basisBefore = itemSummaryBasis(before);

    updateItem(box.ctx, { id, status: 'deprecated', origin: 'human' });
    const after = itemOf(box, id);

    assert.notEqual(itemContentHash(after), identityBefore,
      'two items that differ only in a stand-down note are still different CONTENT — '
      + '`createItem`\'s dedupe must not fold them together');
    assert.equal(itemSummaryBasis(after), basisBefore,
      'and they are the same thing for what a SUMMARY has to describe');
  } finally { box.dispose(); }
});
