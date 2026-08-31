/**
 * The focus state itself: what is on disk, what a damaged file does, and the
 * relation classification the disclosure is built on.
 *
 * The selector's behaviour is `test/core/select-focus.test.ts`; the injected
 * wording is `test/core/render.test.ts`; the commands are
 * `test/cli/focus.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readAudit } from '../../src/core/audit.ts';
import {
  RELATION_CLASSIFICATION, clearFocus, danglingEdges, describeFocus, focusErrorNote,
  focusPath, focusReportLines, isFocusActive, isLoadBearing, readFocus, relationTableLines,
  setFocus, unsetFocus, writeFocus, type FocusReport,
} from '../../src/core/focus.ts';
import { RELATION_TYPES } from '../../src/core/relations.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-focus-'));
  mkdirSync(path.join(dir, '.my_context'), { recursive: true });
  return path.join(dir, '.my_context');
}

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

test('a focus round-trips through the file', () => {
  const home = root();
  try {
    setFocus(home, { tags: ['billing'], categories: ['rule'], scope: ['src/api/**'] }, 'human');
    const state = readFocus(home);
    assert.equal(state.error, null);
    assert.deepEqual(state.focus?.tags, ['billing']);
    assert.deepEqual(state.focus?.categories, ['rule']);
    assert.deepEqual(state.focus?.scope, ['src/api/**']);
    assert.equal(state.focus?.setBy, 'human');
  } finally {
    removeTree(path.dirname(home));
  }
});

test('no focus file is not an error — it is the common answer', () => {
  const home = root();
  try {
    const state = readFocus(home);
    assert.equal(state.focus, null);
    assert.equal(
      state.error, null,
      'a workspace with no focus must not report an error: every tool call reads this, and ' +
      'an error there would put a note in every injection in every unfocused workspace',
    );
  } finally {
    removeTree(path.dirname(home));
  }
});

/**
 * The failure that must never be silent. A damaged focus file means the
 * narrowing the user asked for is NOT in effect, and the wide injection they
 * then see is indistinguishable from "my focus was wrong" unless something
 * says otherwise.
 *
 * Both halves are asserted: it fails OPEN (nothing hidden, so a session is
 * never broken by a file the user can delete), AND it reports.
 */
test('a damaged focus file fails open and says so, rather than either throwing or going quiet', () => {
  const home = root();
  try {
    mkdirSync(path.join(home, 'state'), { recursive: true });
    writeFileSync(focusPath(home), '{ not json', 'utf8');
    const state = readFocus(home);
    assert.equal(state.focus, null, 'a damaged focus must hide nothing');
    assert.notEqual(state.error, null, 'a damaged focus must not read as "no focus"');
    const note = focusErrorNote(state.error);
    assert.match(note, /`\.my_context\/state\/focus\.json`/);
    assert.match(note, /NO focus is in effect and nothing is hidden/);
    assert.match(note, /mycontext focus --clear/);
  } finally {
    removeTree(path.dirname(home));
  }
});

test('a focus file from another protocol is refused rather than half-read', () => {
  const home = root();
  try {
    mkdirSync(path.join(home, 'state'), { recursive: true });
    writeFileSync(focusPath(home), JSON.stringify({ protocol: 'other@9', tags: ['x'] }), 'utf8');
    const state = readFocus(home);
    assert.equal(state.focus, null);
    assert.match(state.error!, /declares protocol "other@9"/);
  } finally {
    removeTree(path.dirname(home));
  }
});

test('no note at all when the focus file is fine — the note is for failures only', () => {
  assert.equal(focusErrorNote(null), '');
});

test('clearing removes the file and reports whether there was one', () => {
  const home = root();
  try {
    assert.equal(clearFocus(home), false, 'clearing nothing must report nothing, not success');
    writeFocus(home, { tags: ['a'], categories: [], scope: [], setAt: 'now', setBy: 'human' });
    assert.equal(clearFocus(home), true);
    assert.equal(readFocus(home).focus, null);
  } finally {
    removeTree(path.dirname(home));
  }
});

/**
 * A focus change is a mutation-shaped event and is recorded as one — under its
 * own kind, with its origin. Without the origin, a model narrowing its own
 * context is indistinguishable in the log from the user doing it.
 */
test('setting and clearing a focus are both audited, with the origin that did it', () => {
  const home = root();
  try {
    setFocus(home, { tags: ['billing'], categories: [], scope: [] }, 'agent');
    unsetFocus(home, 'human');
    const records = readAudit(home);
    assert.deepEqual(records.map((r) => [r.kind, r.op, r.origin]), [
      ['focus', 'focus-set', 'agent'],
      ['focus', 'focus-clear', 'human'],
    ]);
    assert.equal(records[0].note, 'tags: billing');
    assert.equal(
      records[0].itemId, undefined,
      'a focus change touches no item, so it must not carry one — `--item X` would answer wrongly',
    );
  } finally {
    removeTree(path.dirname(home));
  }
});

test('clearing a focus that is not there records nothing', () => {
  const home = root();
  try {
    unsetFocus(home, 'human');
    assert.deepEqual(readAudit(home), []);
  } finally {
    removeTree(path.dirname(home));
  }
});

test('an empty focus is not active, so it narrows nothing', () => {
  assert.equal(isFocusActive({ tags: [], categories: [], scope: [] }), false);
  assert.equal(isFocusActive({ tags: ['a'], categories: [], scope: [] }), true);
  assert.equal(isFocusActive(null), false);
});

test('the axes are described in the order they are applied', () => {
  assert.equal(
    describeFocus({ tags: ['a', 'b'], categories: ['rule'], scope: ['src/**'] }),
    'tags: a, b · categories: rule · scope: src/**',
  );
  assert.equal(describeFocus({ tags: [], categories: [], scope: [] }), 'no axes set');
});

// --- the classification ------------------------------------------------------

test('load-bearing and referential are classified as documented, in both directions', () => {
  for (const type of [
    'blocks', 'unblocks', 'depends_on', 'constrains', 'answers', 'enforces', 'enforced_by',
    'refines',
  ]) {
    assert.equal(isLoadBearing(type), true, `${type} must be load-bearing`);
  }
  for (const type of [
    'derived_from', 'relates_to', 'links_to', 'discovered_by', 'produced', 'mitigates',
    'supersedes', 'superseded_by',
  ]) {
    assert.equal(isLoadBearing(type), false, `${type} must be referential`);
  }
});

/**
 * The direction that matters. `isLoadBearing` answers from a table, and a
 * table lookup that defaulted to `false` would silently drop exactly the edge
 * the open question was written about — an unfamiliar relation type is the one
 * this code knows least about.
 */
test('an unrecognised relation type counts as load-bearing rather than being dropped', () => {
  assert.equal(RELATION_CLASSIFICATION.invented_by_someone, undefined);
  assert.equal(isLoadBearing('invented_by_someone'), true);
});

/**
 * The disagreement between the closed enum and the corpus, executed rather
 * than asserted in a comment: every member of `RELATION_TYPES` is classified,
 * and the classification also covers types the enum does not have — which is
 * the whole reason it is a superset. If they were ever reconciled, the second
 * assertion is what would notice.
 */
test('every relation the enum allows is classified, and the table is a strict superset', () => {
  for (const type of RELATION_TYPES) {
    assert.ok(RELATION_CLASSIFICATION[type], `${type} is in RELATION_TYPES but unclassified`);
  }
  const beyond = Object.keys(RELATION_CLASSIFICATION).filter((t) => !RELATION_TYPES.includes(t));
  assert.deepEqual(
    beyond.toSorted(),
    ['answers', 'depends_on', 'discovered_by', 'enforced_by', 'enforces', 'produced',
      'superseded_by', 'unblocks'],
    'the classification covers relation types this corpus carries that `link_items` would ' +
    'refuse. If that list changed, the enum and the corpus moved — say which, and update ' +
    'both READMEs, rather than editing this assertion to match.',
  );
});

test('the relation table names both classes and the default for an unlisted one', () => {
  const text = relationTableLines().join('\n');
  assert.match(text, /^ {2}blocks {2,}load-bearing$/m);
  assert.match(text, /^ {2}derived_from {2,}referential$/m);
  assert.match(text, /An unlisted relation type counts as load-bearing\./);
});

// --- dangling edges ----------------------------------------------------------

const OPENQ = item({
  id: 'OPENQ-x', type: 'open_question', tags: ['design'],
  relations: [{ type: 'blocks', target: 'REQ-y' }],
});
const REQ = item({ id: 'REQ-y', type: 'requirement', tags: ['billing'] });

test('a hidden item that blocks a visible one is a dangling edge — the case that motivated this', () => {
  assert.deepEqual(danglingEdges([REQ], [OPENQ]), [
    { from: 'OPENQ-x', type: 'blocks', to: 'REQ-y', hiddenEnd: 'from' },
  ]);
});

test('a visible item pointing at a hidden one dangles too, with the other end named', () => {
  const visible = item({ id: 'REQ-y', relations: [{ type: 'depends_on', target: 'DEC-z' }] });
  const hidden = item({ id: 'DEC-z' });
  assert.deepEqual(danglingEdges([visible], [hidden]), [
    { from: 'REQ-y', type: 'depends_on', to: 'DEC-z', hiddenEnd: 'to' },
  ]);
});

test('a referential edge does not dangle — a rule derived from a hidden lesson still stands', () => {
  const visible = item({ id: 'RULE-a', relations: [{ type: 'derived_from', target: 'LESSON-b' }] });
  assert.deepEqual(danglingEdges([visible], [item({ id: 'LESSON-b' })]), []);
});

test('an edge between two hidden items is not reported — nothing on screen depends on it', () => {
  const a = item({ id: 'A', relations: [{ type: 'blocks', target: 'B' }] });
  assert.deepEqual(danglingEdges([], [a, item({ id: 'B' })]), []);
});

test('an edge to an id in neither set is not reported — that is an orphan, not focus', () => {
  const visible = item({ id: 'A', relations: [{ type: 'blocks', target: 'GONE' }] });
  assert.deepEqual(danglingEdges([visible], [item({ id: 'B' })]), []);
});

test('the same edge seen from both ends is reported once', () => {
  const visible = item({ id: 'A', relations: [{ type: 'blocks', target: 'B' }] });
  const hidden = item({ id: 'B', relations: [{ type: 'blocks', target: 'A' }] });
  const edges = danglingEdges([visible], [hidden]);
  assert.equal(edges.length, 2, 'A→B and B→A are two different claims and both are reported');
  assert.deepEqual(edges.map((e) => `${e.from} ${e.type} ${e.to}`), ['A blocks B', 'B blocks A']);
});

// --- the report ---------------------------------------------------------------

/** 67 characters — the hostile id length the report budget is measured at. */
const LONG = `REQ-${'x'.repeat(63)}`;

test('every report line holds the 100-column budget at hostile id length', () => {
  assert.equal(LONG.length, 67);
  const report: FocusReport = {
    axes: { tags: ['billing'], categories: [], scope: [] },
    universe: 'corpus',
    hidden: [LONG, `${LONG}2`],
    visible: 4,
    exemptHard: [LONG],
    exemptAlways: [], exemptContinuity: [],
    dangling: [{ from: LONG, type: 'depends_on', to: `${LONG}2`, hiddenEnd: 'to' }],
  };
  for (const line of focusReportLines(report)) {
    assert.ok(
      line.length <= 100,
      `${line.length} columns: ${line}. A dangling edge puts each id on its own line ` +
      `precisely because two 67-character ids on one line cannot fit.`,
    );
  }
});

test('the report caps its lists and discloses the remainder rather than truncating quietly', () => {
  const many = Array.from({ length: 14 }, (_, i) => `RULE-${i}`);
  const text = focusReportLines({
    axes: { tags: ['a'], categories: [], scope: [] },
    universe: 'corpus', hidden: many, visible: 1, exemptHard: [], exemptAlways: [], exemptContinuity: [], dangling: [],
  }, 10).join('\n');
  assert.match(text, /… \+4 more \(--json lists every one\)/);
});

test('the report names which universe it counted', () => {
  const base = {
    axes: { tags: ['a'], categories: [], scope: [] },
    hidden: ['RULE-a'], visible: 2, exemptHard: [], exemptAlways: [], exemptContinuity: [], dangling: [],
  };
  assert.match(
    focusReportLines({ ...base, universe: 'corpus' }).join('\n'),
    /2 item\(s\) in focus, 1 hidden by focus \(of the eligible corpus\)\./,
  );
  assert.match(
    focusReportLines({ ...base, universe: 'path' }).join('\n'),
    /2 item\(s\) in focus, 1 hidden by focus \(of the items that apply to this path\)\./,
  );
});

test('a focus that hides nothing still says zero dangling rather than staying silent', () => {
  const text = focusReportLines({
    axes: { tags: ['a'], categories: [], scope: [] },
    universe: 'corpus', hidden: [], visible: 9, exemptHard: [], exemptAlways: [], exemptContinuity: [], dangling: [],
  }).join('\n');
  assert.match(text, /0 load-bearing relations dangling\./);
  assert.doesNotMatch(text, /hidden by focus — still in the corpus/);
});

test('the written file carries its protocol, so a later format change is detectable', () => {
  const home = root();
  try {
    writeFocus(home, { tags: ['a'], categories: [], scope: [], setAt: 'now', setBy: 'human' });
    const raw = JSON.parse(readFileSync(focusPath(home), 'utf8')) as { protocol: string };
    assert.equal(raw.protocol, 'my_context/focus@1');
  } finally {
    removeTree(path.dirname(home));
  }
});
