import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderSelection } from '../../src/core/render.ts';
import type { FocusReport, Selection } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20', status: 'active',
    severity: 'hard', always: true, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'RDS permits 25.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

const EMPTY: Selection = {
  full: [],
  index: { normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0, ineligible: {} },
  spilled: [],
  focus: null,
  tokens: 0,
};

test('an empty selection renders nothing', () => {
  assert.equal(renderSelection(EMPTY), '');
});

test('full items render id, title and body', () => {
  const out = renderSelection({ ...EMPTY, full: [{ item: item(), tier: 'pinned' }] });
  assert.match(out, /CONST-a/);
  assert.match(out, /Pool capped at 20/);
  assert.match(out, /RDS permits 25\./);
});

test('observations render as bullets', () => {
  const withObs = item({
    observations: [{ category: 'limit', text: 'Never exceed 20', tags: ['db'], context: null }],
  });
  const out = renderSelection({ ...EMPTY, full: [{ item: withObs, tier: 'pinned' }] });
  assert.match(out, /- \[limit\] Never exceed 20/);
});

test('the index summarizes rationale as counts', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [{ id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20' }],
      counts: { lesson: 130, adr: 47 },
      drafts: 340,
      retired: 0,
      truncated: 0,
      ineligible: {},
    },
  });
  assert.match(out, /CONST-a · constraint · Pool capped at 20/);
  assert.match(out, /130 lesson/);
  assert.match(out, /47 adr/);
  assert.match(out, /340 drafts/);
});

test('a non-zero retired count is surfaced in the index', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [], counts: {}, drafts: 0, retired: 12, truncated: 0, ineligible: {},
    },
  });
  assert.match(out, /12 retired/i);
});

test('a non-zero truncated count is surfaced, not silently dropped', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [{ id: 'CONST-a', type: 'constraint', title: 'Pool capped at 20' }],
      counts: {}, drafts: 0, retired: 0, truncated: 3, ineligible: {},
    },
  });
  assert.match(out, /\+3 more/i);
});

test('spilled items are disclosed, never silent', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [{ id: 'CONST-b', tier: 'pinned', reason: 'budget exceeded' }],
  });
  assert.match(out, /1 item\(s\) omitted/i);
  assert.match(out, /CONST-b/);
});

test('an item spilled from multiple tiers is reported once, not double-counted', () => {
  const out = renderSelection({
    ...EMPTY,
    spilled: [
      { id: 'CONST-b', tier: 'pinned', reason: 'budget exceeded (pinned)' },
      { id: 'CONST-b', tier: 'index', reason: 'index budget exceeded' },
    ],
  });
  assert.match(out, /1 item\(s\) omitted/i);
  // The id should appear exactly once in the spill line, with both tiers noted.
  const matches = out.match(/CONST-b/g) ?? [];
  assert.equal(matches.length, 1);
  assert.match(out, /pinned/);
  assert.match(out, /index/);
});

test('output uses LF only', () => {
  const withCr = item({ body: 'RDS permits 25.\rSecond line.' });
  const out = renderSelection({ ...EMPTY, full: [{ item: withCr, tier: 'pinned' }] });
  assert.equal(out.includes('\r'), false);
});

test('a disabled or unknown category is surfaced, not silently dropped', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [], counts: {}, drafts: 0, retired: 0, truncated: 0,
      ineligible: { sla: 2, lesson: 1 },
    },
  });
  assert.match(out, /2 sla/);
  assert.match(out, /1 lesson/);
});

test('the injected block has no stray blank-line runs before the first item', () => {
  const out = renderSelection({ ...EMPTY, full: [{ item: item(), tier: 'pinned' }] });
  assert.equal(out.includes('\n\n\n'), false);
});

test('an item spilled only from the index tier is not re-disclosed in the spill line — already covered by "+N more"', () => {
  const out = renderSelection({
    ...EMPTY,
    index: {
      normative: [{ id: 'CONST-a', type: 'constraint', title: 'x' }],
      counts: {}, drafts: 0, retired: 0, truncated: 1, ineligible: {},
    },
    spilled: [{ id: 'CONST-b', tier: 'index', reason: 'index budget exceeded' }],
  });
  assert.match(out, /\+1 more/i);
  assert.doesNotMatch(out, /omitted from full text/i);
});

// --- the focus disclosure ------------------------------------------------------
//
// **The wording is the whole feature**, so it is pinned exactly rather than by
// a `match` on a fragment: a `/hidden by focus/` assertion is satisfied by a
// sentence that says "nothing is hidden by focus", and the two counts this
// note carries are the entire reason decision Q2 could allow a hide at all.

const FOCUS_REPORT: FocusReport = {
  axes: { tags: ['billing'], categories: [], scope: [] },
  universe: 'corpus',
  hidden: ['OPENQ-x', 'LESSON-a'],
  visible: 4,
  exemptHard: [],
  dangling: [{ from: 'OPENQ-x', type: 'blocks', to: 'REQ-y', hiddenEnd: 'from' }],
};

/** The one block `renderSelection` produced for the focus, without the rest. */
function focusNote(report: FocusReport | null, over: Partial<Selection> = {}): string {
  const out = renderSelection({ ...EMPTY, ...over, focus: report });
  return (out.split('\n\n').find((b) => b.startsWith('_Focus')) ?? '').trimEnd();
}

test('the focus disclosure names the axes, the hidden count and the dangling relations', () => {
  assert.equal(
    focusNote(FOCUS_REPORT),
    '_Focus is active (tags: billing). 2 item(s) hidden by focus, 1 load-bearing ' +
    'relation(s) now dangling: OPENQ-x blocks REQ-y. Nothing is deleted: ' +
    '`mycontext focus --show` lists what is hidden, `mycontext focus --clear` restores it._',
  );
});

test('a tool-event disclosure says which universe it counted', () => {
  assert.match(
    focusNote({ ...FOCUS_REPORT, universe: 'path' }),
    /^_Focus is active \(tags: billing\)\. 2 item\(s\) that apply to this file hidden by focus, /,
  );
});

test('a focus that hides nothing still discloses, and says zero dangling', () => {
  assert.equal(
    focusNote({ ...FOCUS_REPORT, hidden: [], dangling: [] }),
    '_Focus is active (tags: billing). 0 item(s) hidden by focus, 0 load-bearing relations ' +
    'now dangling. Nothing is deleted: `mycontext focus --show` lists what is hidden, ' +
    '`mycontext focus --clear` restores it._',
  );
});

test('the hard exemption is disclosed when it fires, and absent when it does not', () => {
  assert.match(
    focusNote({ ...FOCUS_REPORT, exemptHard: ['INV-a', 'INV-b'] }),
    / 2 severity:hard item\(s\) do not match this focus and are injected anyway — focus never hides one\._$/,
  );
  assert.doesNotMatch(focusNote(FOCUS_REPORT), /severity:hard/);
});

test('at most three dangling relations are named, and the remainder is counted', () => {
  const many = ['a', 'b', 'c', 'd', 'e'].map((n) => (
    { from: `OPENQ-${n}`, type: 'blocks', to: 'REQ-y', hiddenEnd: 'from' as const }
  ));
  const note = focusNote({ ...FOCUS_REPORT, dangling: many });
  assert.match(
    note,
    /OPENQ-a blocks REQ-y; OPENQ-b blocks REQ-y; OPENQ-c blocks REQ-y \(\+2 more\)\./,
  );
  assert.doesNotMatch(note, /OPENQ-d/);
});

test('no focus, no note — an unfocused session says nothing about focus', () => {
  const out = renderSelection({ ...EMPTY, full: [{ item: item(), tier: 'pinned' }] });
  assert.equal(out.includes('Focus'), false);
});

/**
 * Order matters, and it is the one thing a reader notices before the words.
 * Both notes say "something is missing"; the focus note is the omission the
 * reader ASKED for, so it is read first and the budget's omission second.
 */
test('the focus note comes before the spill note', () => {
  const out = renderSelection({
    ...EMPTY,
    focus: FOCUS_REPORT,
    spilled: [{ id: 'CONST-b', tier: 'pinned', reason: 'budget exceeded (9 > 8)' }],
  });
  assert.ok(out.indexOf('_Focus is active') < out.indexOf('omitted from full text'));
});
