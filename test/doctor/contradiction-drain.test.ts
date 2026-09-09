// @basis TASK-the-contradictions-already-in-the-corpus-are-found-and,
//        TASK-a-new-governing-item-is-checked-against-the-ones-already

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  checkCorpusContradictions, CONTRADICTION_DRAIN_PER_ITEM,
} from '../../src/doctor/checks.ts';
import {
  CONTRADICTION_PROTOCOL, CONTRADICTION_THRESHOLD, overlapParts, OVERLAP_THRESHOLD,
} from '../../src/core/overlap.ts';
import { contradictionLogPath, verdictsDir } from '../../src/core/verdict-store.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * `plan:contra seq:3` / contradiction-gate design §9 — THE DRAIN.
 *
 * Three properties are what this file exists to pin, and the first is in the
 * item's own title:
 *
 *  1. **REPORTED, NEVER GATED.** Every finding is `info`, which keeps it off
 *     `exitCode` (which reads `counts.errors`). A gate that fires on a large
 *     pre-existing population is a gate people mute, and a muted gate has
 *     stopped gating — measured twice in the week this was written.
 *  2. **The gate's rulings are honoured, and they LAPSE.** §9: *"a pair already
 *     ruled distinct must not be reported here either, and a verdict that has
 *     lapsed because one item changed meaning SHOULD be. Otherwise the drain and
 *     the gate would disagree about the same pair."* Both directions are below.
 *  3. **The jaccard floor.** Measured on the real corpus: of the 82 pairs that
 *     clear `CONTRADICTION_THRESHOLD`, 72 involve one 808-token pinned reference
 *     item whose jaccard with each partner is 0.13–0.16. Without the floor the
 *     report is 88% one long item.
 */
function base(over: Partial<Item> & { id: string; type: string; body: string }): Item {
  return {
    title: over.id, status: 'active', severity: 'soft', always: false,
    continuity: false, summary: 'A summary.', summaryOf: 'basis-of-this-item',
    summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra: {},
    steps: [], observations: [], relations: [], layer: 'project',
    filePath: `items/${over.type}/${over.id}.md`,
    ...over,
  };
}

/**
 * Two bodies that share most of their vocabulary, so the pair clears BOTH
 * cutoffs — the gate's score and the drain's jaccard floor. Asserted rather
 * than assumed: a fixture that silently stopped clearing a threshold would make
 * every test below vacuous, which is the exact failure this project has been
 * bitten by.
 */
const SHARED = 'The console opens the project knowledge files through a separate door with its own '
  + 'lock, and every reader holds that door open while the corpus is being served to them.';
const ALSO = 'The console opens the project knowledge files through a separate door with its own '
  + 'key, and no reader holds that door open once the corpus has been served to them.';

function pair(): Item[] {
  return [
    base({ id: 'RULE-the-door-is-held-open', type: 'rule', body: SHARED }),
    base({ id: 'RULE-the-door-is-not-held-open', type: 'rule', body: ALSO }),
  ];
}

test('the fixture pair really does clear both cutoffs — nothing below is vacuous', () => {
  const [a, b] = pair();
  const parts = overlapParts(a!, b!);
  assert.ok(parts.score >= CONTRADICTION_THRESHOLD, `score ${parts.score}`);
  assert.ok(parts.jaccard >= OVERLAP_THRESHOLD, `jaccard ${parts.jaccard}`);
});

function emptyRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'mycontext-drain-'));
}

/** A ruling, written the way the gate writes one. */
function recordVerdict(root: string, row: Record<string, unknown>): void {
  mkdirSync(verdictsDir(root), { recursive: true });
  writeFileSync(
    contradictionLogPath(root),
    `${JSON.stringify({ protocol: CONTRADICTION_PROTOCOL, verdict: 'distinct', ...row })}\n`,
    'utf8',
  );
}

test('two governing items about one subject are reported — at info, and NEVER as an error', () => {
  const root = emptyRoot();
  try {
    const findings = checkCorpusContradictions(root, pair());
    const pairs = findings.filter((f) => f.code === 'contradiction_pair');
    assert.equal(pairs.length, 1);
    // The title of the item this implements: reported, never gated. `exitCode`
    // reads `counts.errors`, so `info` is the whole of that promise.
    assert.ok(findings.every((f) => f.level === 'info'), 'every finding is info');
    assert.equal(pairs[0]!.item, 'RULE-the-door-is-held-open');
    assert.match(pairs[0]!.message, /may contradict RULE-the-door-is-not-held-open/);
    // Both halves of the measurement are printed, so a reader can see which one
    // carried the pair.
    assert.match(pairs[0]!.message, /Overlap 0\.\d\d, of which jaccard 0\.\d\d/);
    assert.match(pairs[0]!.message, /Nothing in this product can tell you whether these conflict/);
  } finally {
    removeTree(root);
  }
});

test('the coverage line is emitted once, names the counts, and says it is a floor', () => {
  const root = emptyRoot();
  try {
    const findings = checkCorpusContradictions(root, pair());
    const limits = findings.filter((f) => f.code === 'contradiction_drain_limits');
    assert.equal(limits.length, 1, 'once per run, never beside each finding');
    assert.equal(limits[0]!.about, 'contradiction_pair');
    assert.match(limits[0]!.message, /^1 pair\(s\) of the 2 item\(s\) that currently govern/);
    assert.match(limits[0]!.message, /This NEVER gates/);
    // The measurement that stops this being read as a census of contradictions.
    assert.match(limits[0]!.message, /scores 0\.267/);
    assert.match(limits[0]!.message, /"None found" is not "none present"/);
  } finally {
    removeTree(root);
  }
});

test('a corpus with nothing to compare reports nothing at all, including no coverage line', () => {
  const root = emptyRoot();
  try {
    assert.deepEqual(checkCorpusContradictions(root, []), []);
    assert.deepEqual(
      checkCorpusContradictions(root, [base({ id: 'RULE-a', type: 'rule', body: SHARED })]),
      [],
    );
  } finally {
    removeTree(root);
  }
});

test('only items that currently GOVERN and are in scope are compared', () => {
  const root = emptyRoot();
  try {
    // `superseded` does not govern.
    const retired = pair();
    retired[1]!.status = 'superseded';
    assert.deepEqual(checkCorpusContradictions(root, retired), []);
    // A `note` is not one of the categories that can contradict, and is not
    // pinned, so it is out of §3's scope.
    const note = pair();
    note[1]!.type = 'note';
    assert.deepEqual(checkCorpusContradictions(root, note), []);
    // Pinning it puts it back in scope whatever its category — §3's derived half.
    note[1]!.always = true;
    assert.equal(
      checkCorpusContradictions(root, note).filter((f) => f.code === 'contradiction_pair').length,
      1,
    );
  } finally {
    removeTree(root);
  }
});

test('§9: a pair the GATE already settled is not reported here either', () => {
  const root = emptyRoot();
  try {
    const items = pair();
    recordVerdict(root, {
      a: 'RULE-the-door-is-held-open', b: 'RULE-the-door-is-not-held-open',
      aBasis: 'basis-of-this-item', bBasis: 'basis-of-this-item',
      ruledAt: '2026-09-10T00:00:00.000Z', ruledBy: 'human',
    });
    assert.deepEqual(checkCorpusContradictions(root, items), []);
  } finally {
    removeTree(root);
  }
});

test('§9: a verdict that has LAPSED because one item changed meaning is reported again', () => {
  const root = emptyRoot();
  try {
    const items = pair();
    recordVerdict(root, {
      a: 'RULE-the-door-is-held-open', b: 'RULE-the-door-is-not-held-open',
      // The ruling was made against what the SECOND item used to say.
      aBasis: 'basis-of-this-item', bBasis: 'what-it-used-to-say',
      ruledAt: '2026-09-10T00:00:00.000Z', ruledBy: 'human',
    });
    const findings = checkCorpusContradictions(root, items);
    assert.equal(findings.filter((f) => f.code === 'contradiction_pair').length, 1);
  } finally {
    removeTree(root);
  }
});

test('a verdict recorded in the other id order still settles the pair', () => {
  const root = emptyRoot();
  try {
    recordVerdict(root, {
      // `pairKey` orders ids lexicographically; a row stored the other way round
      // must resolve to the same pair, or the same ruling would read as two.
      a: 'RULE-the-door-is-not-held-open', b: 'RULE-the-door-is-held-open',
      aBasis: 'basis-of-this-item', bBasis: 'basis-of-this-item',
      ruledAt: '2026-09-10T00:00:00.000Z', ruledBy: 'human',
    });
    assert.deepEqual(checkCorpusContradictions(root, pair()), []);
  } finally {
    removeTree(root);
  }
});

test('THE JACCARD FLOOR: a pair carried by LENGTH alone is counted and dropped, not reported', () => {
  const root = emptyRoot();
  try {
    // A long body that contains a short one's whole vocabulary: containment is
    // near 1, so `overlapScore` clears the gate's cutoff, while jaccard stays
    // far below `OVERLAP_THRESHOLD`. This is the 72-of-82 shape on the real
    // corpus, reproduced in nine words and a paragraph.
    const short = base({ id: 'RULE-a-short-one', type: 'rule', body: 'The door holds the lock.' });
    const long = base({
      id: 'RULE-a-long-one', type: 'rule',
      body: `The door holds the lock. ${Array.from(
        { length: 60 }, (_, n) => `sentence${n} about something else entirely and unrelated`,
      ).join(' ')}`,
    });
    const parts = overlapParts(short, long);
    assert.ok(parts.score >= CONTRADICTION_THRESHOLD, `score ${parts.score}`);
    assert.ok(parts.jaccard < OVERLAP_THRESHOLD, `jaccard ${parts.jaccard}`);

    const findings = checkCorpusContradictions(root, [short, long]);
    assert.deepEqual(findings.filter((f) => f.code === 'contradiction_pair'), []);
    assert.deepEqual(findings, [], 'nothing shown means no coverage line either');
  } finally {
    removeTree(root);
  }
});

test('one item cannot fill the report — at most one finding per item', () => {
  const root = emptyRoot();
  try {
    // Three items all about one subject: three pairs, but the per-item cap lets
    // the first pair through and withholds the two that reuse its members.
    const items = [
      base({ id: 'RULE-aaa', type: 'rule', body: SHARED }),
      base({ id: 'RULE-bbb', type: 'rule', body: ALSO }),
      base({ id: 'RULE-ccc', type: 'rule', body: `${SHARED} And one more clause.` }),
    ];
    const pairs = checkCorpusContradictions(root, items)
      .filter((f) => f.code === 'contradiction_pair');
    assert.equal(CONTRADICTION_DRAIN_PER_ITEM, 1);
    assert.equal(pairs.length, 1);
    const limits = checkCorpusContradictions(root, items)
      .find((f) => f.code === 'contradiction_drain_limits')!;
    assert.match(limits.message, /3 pair\(s\) of the 3 item\(s\)/);
    assert.match(limits.message, /1 of the remaining 3 are shown/);
  } finally {
    removeTree(root);
  }
});
