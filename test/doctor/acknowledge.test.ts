/**
 * **`Item.acknowledged` — a person's ruling on a doctor finding, and the anchor
 * that stops the ruling outliving what it ruled on** (owner ruling 2026-08-27;
 * the argument is on `src/core/acknowledge.ts`).
 *
 * Five properties, each a distinct way the feature could look right and be
 * wrong:
 *
 *  1. **An item nobody has ruled on is untouched — byte for byte and hash for
 *     hash.** Every item in every corpus predates this field. `summary` and
 *     `continuity` are the precedent, and this is the gate that matters, so it
 *     is tested first.
 *  2. **The acknowledgement LAPSES when the content moves.** This is the whole
 *     feature. A flag that survived a rewrite of the body it certified would be
 *     strictly worse than no mechanism: the finding that would have asked for a
 *     second reading would instead report as already settled.
 *  3. **It is not a silencer.** The finding is still computed, still returned by
 *     `runChecks`, still counted by `summarize`, and still moves the exit code
 *     exactly as much as its level always did. Only the MARK is new.
 *  4. **`markAcknowledged` is general.** It keys on `Finding.code` + `item` and
 *     knows nothing about which check produced the finding, so a check written
 *     tomorrow is acknowledgeable the day it ships.
 *  5. **Only a person can write one, and only for a finding that exists.**
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  acknowledgementState, clearAcknowledgement, isAcknowledged, parseAcknowledged,
  renderAcknowledged, stampAcknowledgement,
} from '../../src/core/acknowledge.ts';
import { itemContentHash } from '../../src/core/content-hash.ts';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { acknowledgeFinding, createItem, updateItem } from '../../src/core/mutate.ts';
import { markAcknowledged, REMEDY, type Finding } from '../../src/doctor/checks.ts';
import { acknowledgedCount, summarize } from '../../src/cli/commands/doctor.ts';
import type { Item } from '../../src/core/types.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** A body whose own wording retracts its premise, so `checkBodyAgreement`
 *  reports `body_disagrees_with_meta` and NO edit to the item can clear it —
 *  the measured case the ruling exists for. */
const RETRACTING_BODY =
  'THE PREMISE HERE IS RETRACTED. This rule no longer holds in the form its title claims.';

function itemOf(box: Sandbox, id: string): Item {
  return box.ctx.store.get(id)!;
}

function fileOf(box: Sandbox, id: string): string {
  return readFileSync(path.join(box.root, itemOf(box, id).filePath), 'utf8');
}

function rule(box: Sandbox, extra: Record<string, unknown> = {}): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body: RETRACTING_BODY,
    status: 'active',
    origin: 'human',
    ...extra,
  }).id;
}

// --- 1. an item with no acknowledgement is byte- and hash-identical ---------

test('an item nobody has ruled on writes no acknowledged line and hashes as before', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const text = fileOf(box, id);
    assert.doesNotMatch(text, /^acknowledged:/m,
      'an unconditional `acknowledged: []` line would be added to every item in every corpus ' +
      'on the next write — the byte-identical round trip broken for all of them at once');

    // And the hash: the key must be absent from `computeItemChecksum`'s shape
    // entirely, not present-and-empty. Present-and-empty moves every recorded
    // checksum in every corpus in one act.
    const item = itemOf(box, id);
    const withField = { ...item, acknowledged: {} };
    assert.equal(computeItemChecksum(withField), computeItemChecksum(item));
    assert.equal(item.checksum, computeItemChecksum(item));
  } finally { box.dispose(); }
});

test('an acknowledged item round-trips byte for byte, and its checksum covers the field', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    const text = fileOf(box, id);
    assert.match(text, /^acknowledged:\n {2}- body_disagrees_with_meta@[0-9a-f]{16}$/m);

    const reparsed = parseItem(text, itemOf(box, id).filePath, 'project');
    assert.equal(renderItem(reparsed), text, 'INV-markdown-is-the-source-of-truth');
    assert.deepEqual(reparsed.acknowledged, itemOf(box, id).acknowledged);
    assert.equal(computeItemChecksum(reparsed), reparsed.checksum,
      'the recorded checksum must cover the acknowledgement, or a hand edit could re-anchor a ' +
      'lapsed ruling to the current hash with nothing reporting it');

    // The forgery this coverage exists to catch, made explicit.
    const forged = { ...reparsed, acknowledged: { some_other_code: 'deadbeefdeadbeef' } };
    assert.notEqual(computeItemChecksum(forged), forged.checksum);
  } finally { box.dispose(); }
});

// --- 2. the anchor: it lapses when the content moves ------------------------

test('an acknowledgement is anchored to the content it was made against', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    assert.equal(acknowledgementState(itemOf(box, id), 'body_disagrees_with_meta'), 'none');

    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    const acked = itemOf(box, id);
    assert.equal(acknowledgementState(acked, 'body_disagrees_with_meta'), 'current');
    assert.equal(acked.acknowledged.body_disagrees_with_meta, itemContentHash(acked),
      'the stored value is the identity of the content that was ruled on, not a flag');
  } finally { box.dispose(); }
});

test('editing the body LAPSES the acknowledgement, and the finding is open again', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    updateItem(box.ctx, {
      id, origin: 'human',
      body: `${RETRACTING_BODY} And something else entirely is now claimed here.`,
    });
    const moved = itemOf(box, id);
    assert.equal(acknowledgementState(moved, 'body_disagrees_with_meta'), 'lapsed',
      'an acknowledgement that outlived the body it certified would report a body nobody has ' +
      'read as one already judged — strictly worse than having no mechanism at all');
    assert.equal(isAcknowledged(moved, 'body_disagrees_with_meta'), false);
  } finally { box.dispose(); }
});

test('the acknowledgement survives its OWN write — the anchor is not self-invalidating', () => {
  // `acknowledged` is deliberately absent from `ContentShape`. If it were part
  // of it, `stampAcknowledgement` would move the very hash it had just
  // recorded, and every acknowledgement would be born lapsed.
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    acknowledgeFinding(box.ctx, { id, code: 'summary_stale' , on: true });
    const item = itemOf(box, id);
    assert.equal(acknowledgementState(item, 'body_disagrees_with_meta'), 'current',
      'the second acknowledgement moved the first one\'s anchor');
    assert.equal(acknowledgementState(item, 'summary_stale'), 'current');
  } finally { box.dispose(); }
});

test('re-acknowledging a lapsed ruling re-anchors it to the content in front of the person', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    updateItem(box.ctx, { id, origin: 'human', body: `${RETRACTING_BODY} Now reworded.` });
    const result = acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    assert.match(result.message, /lapsed/,
      'the message must say the previous ruling had lapsed — re-reading is a different act ' +
      'from ruling for the first time');
    assert.equal(acknowledgementState(itemOf(box, id), 'body_disagrees_with_meta'), 'current');
  } finally { box.dispose(); }
});

test('withdrawing removes it, and withdrawing what is not there writes nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    const nothing = acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta', on: false });
    assert.match(nothing.message, /Nothing was written/);
    assert.doesNotMatch(fileOf(box, id), /^acknowledged:/m);

    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta', on: false });
    assert.deepEqual(itemOf(box, id).acknowledged, {});
    assert.doesNotMatch(fileOf(box, id), /^acknowledged:/m,
      'the last acknowledgement removed must take the frontmatter line with it, or the item ' +
      'never returns to the shape it had before anybody ruled on anything');
  } finally { box.dispose(); }
});

// --- 3. it marks, it does not filter ---------------------------------------

const FINDINGS = (): Finding[] => [
  { level: 'info', code: 'body_disagrees_with_meta', item: 'RULE-x', message: 'a', remedy: REMEDY.ACK },
  { level: 'warn', code: 'summary_stale', item: 'RULE-x', message: 'b', remedy: REMEDY.ACK },
  { level: 'info', code: 'body_review_limits', message: 'the standing note, with no item', remedy: REMEDY.NOTHING },
];

function markedAgainst(item: Item): Finding[] {
  const findings = FINDINGS();
  markAcknowledged(findings, [item]);
  return findings;
}

test('an acknowledged finding is still reported, still counted, and merely marked', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    const item = { ...itemOf(box, id), id: 'RULE-x' };
    // `id` is rewritten so the synthetic findings above address this item; the
    // anchor is over CONTENT, and `id` is not part of `ContentShape`.
    const findings = markedAgainst(item);

    assert.equal(findings.length, 3, 'nothing may be removed');
    assert.equal(findings[0].acknowledged, true);
    assert.equal(findings[1].acknowledged, undefined, 'only the code that was ruled on is marked');
    assert.equal(findings[2].acknowledged, undefined, 'a finding with no item cannot be marked');

    const counts = summarize(findings);
    assert.deepEqual(counts, { errors: 0, warnings: 1, infos: 2 },
      'the level tally must not shrink — an acknowledged finding is still a finding');
    assert.equal(acknowledgedCount(findings), 1);
  } finally { box.dispose(); }
});

test('a LAPSED acknowledgement marks nothing', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta' });
    updateItem(box.ctx, { id, origin: 'human', body: `${RETRACTING_BODY} Reworded.` });
    const findings = markedAgainst({ ...itemOf(box, id), id: 'RULE-x' });
    assert.equal(findings[0].acknowledged, undefined);
    assert.equal(acknowledgedCount(findings), 0);
  } finally { box.dispose(); }
});

test('markAcknowledged names no check — any code on any item is markable', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    // A code no check in this repository emits. `markAcknowledged` must still
    // honour it: the mechanism is general, and the refusal that keeps invented
    // codes out of the corpus lives at the CLI boundary, not here.
    acknowledgeFinding(box.ctx, { id, code: 'a_check_written_tomorrow' });
    const findings: Finding[] = [
      { level: 'error', code: 'a_check_written_tomorrow', item: 'RULE-x', message: 'z', remedy: REMEDY.ACK },
    ];
    markAcknowledged(findings, [{ ...itemOf(box, id), id: 'RULE-x' }]);
    assert.equal(findings[0].acknowledged, true);
    // And the exit code is untouched: acknowledging distinguishes, it does not
    // silence, so an `error` still fails the run.
    assert.equal(summarize(findings).errors, 1);
  } finally { box.dispose(); }
});

test('an id no longer in the corpus marks nothing rather than throwing', () => {
  const findings = FINDINGS();
  markAcknowledged(findings, []);
  assert.deepEqual(findings.map((f) => f.acknowledged), [undefined, undefined, undefined]);
});

// --- 4. only a person, and only for a finding that exists -------------------

test('an origin that is not a person is refused', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    for (const origin of ['agent', 'ingest'] as const) {
      assert.throws(
        () => acknowledgeFinding(box.ctx, { id, code: 'body_disagrees_with_meta', origin }),
        /only a person can acknowledge/,
        `origin "${origin}" was accepted; the ruling is that nothing is silenced by the ` +
        'machine, and that sentence is only true if the write refuses the machine',
      );
    }
    assert.deepEqual(itemOf(box, id).acknowledged, {});
  } finally { box.dispose(); }
});

test('a value that is not a finding code is refused, and the refusal teaches', () => {
  const box = sandbox();
  try {
    const id = rule(box);
    assert.throws(
      () => acknowledgeFinding(box.ctx, { id, code: 'Body Disagrees' }),
      /is not a doctor finding code.*body_disagrees_with_meta/s,
    );
  } finally { box.dispose(); }
});

// --- 5. the frontmatter projection -----------------------------------------

test('the frontmatter list is code-ordered, and an unreadable entry is dropped rather than stored', () => {
  assert.deepEqual(
    renderAcknowledged({ zebra: 'ffffffffffffffff', alpha: '0000000000000000' }),
    ['alpha@0000000000000000', 'zebra@ffffffffffffffff'],
    'a MAP has no meaningful key order, and a fixed one is what keeps renderItem byte-stable ' +
    'when a second acknowledgement is added to an item that already had one',
  );
  assert.deepEqual(
    parseAcknowledged(['a@1111111111111111', 'no-separator', '@2222', 'trailing@']),
    { a: '1111111111111111' },
    'an unreadable entry is dropped: kept as some string it would compare unequal to the ' +
    'item\'s real hash forever, which is `lapsed`, which is a REPORTED finding — nothing is ' +
    'hidden by failing to read one',
  );
});

test('stamp and clear are the only writers, and they agree with the state reader', () => {
  const item = {
    acknowledged: {}, title: 'T', body: 'B', type: 'rule', steps: [], severity: 'soft',
    always: false, continuity: false, scope: [], tags: [], observations: [], relations: [],
    extra: {},
  } as unknown as Item;
  stampAcknowledgement(item, 'summary_stale');
  assert.equal(acknowledgementState(item, 'summary_stale'), 'current');
  assert.equal(clearAcknowledgement(item, 'summary_stale'), true);
  assert.equal(acknowledgementState(item, 'summary_stale'), 'none');
  assert.equal(clearAcknowledgement(item, 'summary_stale'), false,
    'the return value says which happened, because the CLI reports it');
});
