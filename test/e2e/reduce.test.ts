// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff, TASK-the-fixture-mirrors-the-mockup-s-own-scene-so-the-two-are
/**
 * **THE JUDGEMENT INSIDE `e2e/reduce.ts`, DRIVEN AS PLAIN FUNCTION CALLS.**
 *
 * The reducer's whole risk is that it manufactures a defect: a sample that
 * drops one end of a relation invents an `orphan_relation`, a sample that
 * drops a `needs` target invents a `needs_unresolved`, and a file reduction
 * that deletes the last file a `scope:` glob matches invents a `dead_scope`.
 * The pixel-parity walk would then report the reduction as a parity finding,
 * and a reader would go looking for it in `styles.css`.
 *
 * **The `needs` case is not hypothetical and is why this file exists.**
 * Measured on a reduced twin of this repository, 2026-09-11: a first version
 * grouped items over relations alone and its twin answered two
 * `needs_unresolved` findings — `archive/47` and `builder/1b` — against a live
 * corpus that answers **none** (81 findings that day, not one of that code).
 *
 * Pure calls rather than a twin, for `test/core/needs.test.ts`' reason: the
 * selection does no I/O, so a fixture workspace would only add a way for these
 * cases to fail for a reason that is not about the selection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chooseFiles, chooseItems, dependencyComponents } from '../../e2e/reduce.ts';
import type { Item, Relation } from '../../src/core/types.ts';

let n = 0;
function item(over: Partial<Item> = {}): Item {
  n += 1;
  return {
    id: `TASK-${n}`, type: 'task', title: `T${n}`,
    status: 'active', severity: 'soft', always: false, continuity: false,
    summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/task/TASK-${n}.md`,
    ...over,
  };
}

const rel = (target: string): Relation => ({ type: 'supersedes', target });

const BUDGET = { items: 6, filesPerGlob: 1 } as const;

/** Every id in `component`, sorted, so a component can be compared by value. */
function componentOf(groups: string[][], id: string): string[] {
  return groups.find((g) => g.includes(id)) ?? [];
}

/* ══ 1 · THE COMPONENT GRAPH ═══════════════════════════════════════════════ */

test('two items joined by a relation are one component, so a sample cannot take only one of them', () => {
  const a = item({ id: 'A', relations: [rel('B')] });
  const b = item({ id: 'B' });
  const alone = item({ id: 'C' });
  assert.deepEqual(
    componentOf(dependencyComponents([a, b, alone]), 'A'), ['A', 'B'],
    'a relation must make its two ends inseparable. If it does not, chooseItems can keep the '
    + 'source and drop the target, and the twin answers an orphan_relation finding this '
    + "repository's own corpus does not have.",
  );
});

test('two items joined by needs are one component, which relations alone do not see', () => {
  // The measured failure: `needs` names a `plan/seq`, not an id, so a graph
  // built from `relations` alone leaves the pair separable.
  const waiter = item({ id: 'WAITER', extra: { plan: 'port', seq: '93', needs: 'port/94' } });
  const blocker = item({ id: 'BLOCKER', extra: { plan: 'port', seq: '94' } });
  assert.deepEqual(
    componentOf(dependencyComponents([waiter, blocker]), 'WAITER'), ['BLOCKER', 'WAITER'],
    'needs must join the two ends. Without this the reduced twin answered needs_unresolved for '
    + 'archive/47 and builder/1b, which no live corpus finding corresponds to.',
  );
});

test('a needs ref answered only by a SUPERSEDED item joins nothing, exactly as workItems reads it', () => {
  // `workItems` excludes superseded from the task index, so a reference
  // answered only by a superseded item is `unresolved` to doctor whether the
  // sample keeps it or not. Joining to it would spend budget buying nothing —
  // and, worse, would make the component sizes disagree with the index the
  // finding is actually computed against.
  const waiter = item({ id: 'WAITER', extra: { plan: 'port', seq: '93', needs: 'port/94' } });
  const replaced = item({
    id: 'REPLACED', status: 'superseded', extra: { plan: 'port', seq: '94' },
  });
  assert.deepEqual(
    dependencyComponents([waiter, replaced]).map((g) => g.length).sort(), [1, 1],
    'a superseded target is not what answers a needs reference, and a component graph that '
    + 'said otherwise would be reading a different index from the check it exists to protect.',
  );
});

/* ══ 2 · THE SAMPLE ════════════════════════════════════════════════════════ */

test('a chosen component is kept ENTIRE — never a slice of one', () => {
  const chain = [
    item({ id: 'L1', type: 'rule', relations: [rel('L2')] }),
    item({ id: 'L2', type: 'rule', relations: [rel('L3')] }),
    item({ id: 'L3', type: 'rule' }),
  ];
  const singles = Array.from({ length: 20 }, (_, i) => item({ id: `S${i}`, type: 'note' }));
  const keep = chooseItems([...chain, ...singles], { items: 8, filesPerGlob: 1 });
  const taken = ['L1', 'L2', 'L3'].filter((id) => keep.has(id));
  assert.ok(
    taken.length === 0 || taken.length === 3,
    `a component must be all in or all out; this sample took ${taken.join(', ')}. A partial `
    + 'component is exactly the orphan_relation the reduction must not manufacture.',
  );
});

test('every category with an item keeps at least one, so no screen reads a reduction as an absence', () => {
  const corpus = [
    ...Array.from({ length: 30 }, (_, i) => item({ id: `T${i}`, type: 'task' })),
    ...Array.from({ length: 5 }, (_, i) => item({ id: `R${i}`, type: 'rule' })),
    item({ id: 'Q1', type: 'open_question' }),
  ];
  const keep = chooseItems(corpus, { items: 6, filesPerGlob: 1 });
  const kinds = new Set(corpus.filter((i) => keep.has(i.id)).map((i) => i.type));
  assert.deepEqual(
    [...kinds].sort(), ['open_question', 'rule', 'task'],
    'the palette, coverage and capture screens all draw the category vocabulary. A sample that '
    + 'spent its whole budget on `task` would make those screens report an absence the corpus '
    + 'does not have.',
  );
});

test('a pinned item is taken before an unpinned one in the same category', () => {
  const corpus = [
    item({ id: 'AAA-unpinned', type: 'rule' }),
    item({ id: 'ZZZ-pinned', type: 'rule', always: true }),
  ];
  const keep = chooseItems(corpus, { items: 1, filesPerGlob: 1 });
  assert.deepEqual(
    [...keep], ['ZZZ-pinned'],
    'the pinned tier has to have something to deliver, and id order alone would have taken the '
    + 'unpinned one. Coverage draws the pinned card, preview and simulate deliver the tier.',
  );
});

/* ══ 3 · THE FILE REDUCTION ════════════════════════════════════════════════ */

test('every scope glob of a kept item keeps a file it really matches, so no dead_scope is invented', () => {
  const walked = ['src/core/select.ts', 'src/cli/index.ts', 'e2e/app.ts', 'reports/X.md'];
  const kept = [item({ id: 'A', scope: ['src/cli/**', 'e2e/**'] })];
  const files = chooseFiles(walked, kept, BUDGET);
  assert.deepEqual(
    [...files].sort(), ['e2e/app.ts', 'src/cli/index.ts'],
    'checkDeadScopes reports a scope glob matching no file. Deleting the repository around a '
    + 'kept item would turn every one of its globs dead and the walk would report the '
    + "reduction as twenty-one screens' worth of defect.",
  );
});

test('a kept item\'s source_file survives, so no source_missing is invented', () => {
  const walked = ['docs/a.md', 'docs/b.md'];
  const kept = [item({ id: 'A', sourceFile: 'docs/b.md', sourceChecksum: 'abc' })];
  assert.ok(
    chooseFiles(walked, kept, BUDGET).has('docs/b.md'),
    'a reference item whose snapshotted document was deleted answers source_missing, which is '
    + 'an error-level finding the owner\'s corpus does not carry for that item.',
  );
});

test('the file reduction is BOUNDED — it does not keep the tree it was asked to shrink', () => {
  const walked = Array.from({ length: 400 }, (_, i) => `src/core/f${i}.ts`);
  const kept = [item({ id: 'A', scope: ['src/core/**'] })];
  assert.equal(
    chooseFiles(walked, kept, BUDGET).size, 1,
    'one file per glob is the whole point: a glob that kept every match would leave the '
    + 'coverage screen drawing 1,543 rows against the design\'s handful, which is the refusal '
    + 'this reduction exists to lift.',
  );
});
