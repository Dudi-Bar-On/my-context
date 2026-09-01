import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import {
  buildTaskIndex, isWorkCategory, parseNeeds, readNeeds, readyReport, refStatus, taskKey,
  taskState, workItems,
} from '../../src/core/needs.ts';
import type { Item } from '../../src/core/types.ts';

/**
 * The pure half of `needs`, exercised as plain function calls — the same
 * discipline `test/core/progress.test.ts` keeps, and for the same reason: the
 * module does no I/O, so a fixture workspace would only add a way for these
 * cases to fail for a reason that is not about dependencies.
 */

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
});

/** The same config with `needs` NOT declared — the state this project's corpus
 * is in until the category declaration lands. Every reader below must behave
 * identically under it, because a field written into the frontmatter is on
 * disk and readable whether or not the category advertises it. */
const CONFIG_WITHOUT_NEEDS = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority'],
    },
  },
});

let n = 0;
function task(extra: Record<string, string>, over: Partial<Item> = {}): Item {
  n++;
  return {
    id: `TASK-${extra.plan ?? 'p'}-${extra.seq ?? n}-${n}`, type: 'task', title: `T${n}`,
    status: 'active', severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, acknowledged: {},
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/task/TASK-${n}.md`,
    ...over,
  };
}

test('parseNeeds splits on commas, trims, lowercases and de-duplicates', () => {
  const parsed = parseNeeds(' Walk/7 , port/6,walk/7 ,, ');
  assert.deepEqual(parsed.refs, ['walk/7', 'port/6']);
  assert.deepEqual(parsed.malformed, []);
});

test('parseNeeds keeps a malformed entry rather than dropping it', () => {
  // The whole point of the field is that nothing goes unnoticed. An entry
  // that cannot be read is still the author saying something holds this task.
  const parsed = parseNeeds('walk/7, seq:8, the/45/extra, /9, plan/');
  assert.deepEqual(parsed.refs, ['walk/7']);
  assert.deepEqual(parsed.malformed, ['seq:8', 'the/45/extra', '/9', 'plan/']);
});

test('parseNeeds of an absent field is empty, not an error', () => {
  assert.deepEqual(parseNeeds(undefined), { refs: [], malformed: [] });
  assert.deepEqual(parseNeeds(''), { refs: [], malformed: [] });
});

test('a shape-valid reference to a plan that does not exist is NOT malformed', () => {
  // The ruling: shape, never existence. `the/45` — the false positive the
  // regex migration produced — parses fine and is answered later by
  // `refStatus` as unresolved, which is a note.
  assert.deepEqual(parseNeeds('the/45'), { refs: ['the/45'], malformed: [] });
});

test('isWorkCategory asks the config for plan, seq and state — not for the name "task"', () => {
  assert.equal(isWorkCategory(CONFIG, 'task'), true);
  assert.equal(isWorkCategory(CONFIG, 'constraint'), false);
  assert.equal(isWorkCategory(CONFIG, 'nope'), false);
  // The prototype hazard `resolveCategory` and `tierOf` both document.
  assert.equal(isWorkCategory(CONFIG, 'constructor'), false);
  // A category is work-planning when it declares the three fields, whether or
  // not it has yet been given `needs`.
  assert.equal(isWorkCategory(CONFIG_WITHOUT_NEEDS, 'task'), true);
});

test('taskKey needs both halves and taskState lowercases', () => {
  assert.equal(taskKey(task({ plan: 'Walk', seq: '8' })), 'walk/8');
  assert.equal(taskKey(task({ plan: 'walk' })), null);
  assert.equal(taskKey(task({ seq: '8' })), null);
  assert.equal(taskState(task({ state: 'Done' })), 'done');
  assert.equal(taskState(task({})), '');
});

test('workItems excludes superseded tasks and non-work categories', () => {
  const items = [
    task({ plan: 'walk', seq: '7', state: 'done' }),
    task({ plan: 'walk', seq: '8', state: 'todo' }, { status: 'superseded' }),
    task({ plan: 'walk', seq: '9', state: 'todo' }, { type: 'constraint' }),
  ];
  const kept = workItems(items, CONFIG);
  assert.deepEqual(kept.map((i) => taskKey(i)), ['walk/7']);
});

test('one plan/seq can name several tasks, and all of them must be done', () => {
  // Measured on this project's corpus 2026-08-28: six live tasks share
  // `ui3/11x`. Treating the key as unique would let a reference resolve to
  // whichever one happened to be first and under-report the blocker.
  const items = [
    task({ plan: 'ui3', seq: '11x', state: 'done' }),
    task({ plan: 'ui3', seq: '11x', state: 'todo' }),
  ];
  const index = buildTaskIndex(items, CONFIG);
  assert.equal(index.get('ui3/11x')?.length, 2);
  assert.equal(refStatus('ui3/11x', index), 'pending');

  const allDone = buildTaskIndex(
    [task({ plan: 'ui3', seq: '11x', state: 'done' }), task({ plan: 'ui3', seq: '11x', state: 'done' })],
    CONFIG,
  );
  assert.equal(refStatus('ui3/11x', allDone), 'satisfied');
});

test('a reference nothing answers to is unresolved, not pending', () => {
  const index = buildTaskIndex([task({ plan: 'walk', seq: '7', state: 'done' })], CONFIG);
  assert.equal(refStatus('the/45', index), 'unresolved');
  assert.equal(refStatus('walk/7', index), 'satisfied');
});

test('readNeeds sorts one item\'s references into satisfied, pending and unresolved', () => {
  const corpus = [
    task({ plan: 'walk', seq: '7', state: 'done' }),
    task({ plan: 'port', seq: '6', state: 'todo' }),
  ];
  const index = buildTaskIndex(corpus, CONFIG);
  const reading = readNeeds(
    task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7, port/6, the/45, seq:9' }),
    index,
  );
  assert.deepEqual(reading.satisfied, ['walk/7']);
  assert.deepEqual(reading.pending, ['port/6']);
  assert.deepEqual(reading.unresolved, ['the/45']);
  assert.deepEqual(reading.malformed, ['seq:9']);
});

test('readNeeds reads the field whether or not the category declares it', () => {
  // The field is on disk. A reader that consulted `extraFields` first would go
  // silent on exactly the corpus this feature was built for — one whose items
  // carry `needs` before the category declaration lands.
  const corpus = [task({ plan: 'walk', seq: '7', state: 'done' })];
  for (const config of [CONFIG, CONFIG_WITHOUT_NEEDS]) {
    const index = buildTaskIndex(corpus, config);
    const reading = readNeeds(
      task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' }), index,
    );
    assert.deepEqual(reading.satisfied, ['walk/7']);
  }
});

test('readyReport: a blocked task whose needs are all done IS ready — the seq:8 case', () => {
  const seq8 = task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7', priority: '1' });
  const report = readyReport([task({ plan: 'walk', seq: '7', state: 'done' }), seq8], CONFIG);
  assert.deepEqual(report.ready.map((r) => r.item.id), [seq8.id]);
  assert.deepEqual(report.held, []);
});

test('readyReport holds a task whose blocker has not landed', () => {
  const seq7 = task({ plan: 'walk', seq: '7', state: 'todo' });
  const seq8 = task({ plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' });
  const report = readyReport([seq7, seq8], CONFIG);
  // `seq:7` is itself ready — nothing holds it — and `seq:8` is not.
  assert.deepEqual(report.ready.map((r) => r.item.id), [seq7.id]);
  assert.deepEqual(report.held.map((r) => [r.item.id, r.reason]), [[seq8.id, 'pending']]);
});

test('readyReport holds a blocked task that names nothing, and lists an unblocked one', () => {
  const blocked = task({ plan: 'walk', seq: '1h', state: 'blocked' });
  const open = task({ plan: 'walk', seq: '2', state: 'todo' });
  const report = readyReport([blocked, open], CONFIG);
  assert.deepEqual(report.ready.map((r) => r.item.id), [open.id]);
  assert.deepEqual(report.held.map((r) => r.reason), ['blocked_without_needs']);
});

test('readyReport holds unresolved and malformed separately, and never as an error', () => {
  const forward = task({ plan: 'walk', seq: '3', state: 'todo', needs: 'the/45' });
  const broken = task({ plan: 'walk', seq: '4', state: 'todo', needs: 'seq:9' });
  const report = readyReport([forward, broken], CONFIG);
  assert.deepEqual(
    report.held.map((r) => [r.item.id, r.reason]),
    [[forward.id, 'unresolved'], [broken.id, 'malformed']],
  );
});

test('readyReport excludes done tasks and counts the rest as open', () => {
  const report = readyReport([
    task({ plan: 'walk', seq: '1', state: 'done' }),
    task({ plan: 'walk', seq: '2', state: 'todo' }),
    task({ plan: 'walk', seq: '3', state: 'doing' }),
  ], CONFIG);
  assert.equal(report.open, 2);
  assert.deepEqual(report.ready.map((r) => r.reading.state), ['todo', 'doing']);
});

test('readyReport sorts by priority first, then plan, then seq NUMERICALLY', () => {
  const report = readyReport([
    task({ plan: 'walk', seq: '10', state: 'todo', priority: '2' }),
    task({ plan: 'walk', seq: '9', state: 'todo', priority: '2' }),
    task({ plan: 'port', seq: '1', state: 'todo', priority: '2' }),
    task({ plan: 'walk', seq: '1', state: 'todo', priority: '1' }),
    task({ plan: 'walk', seq: '2', state: 'todo' }),
  ], CONFIG);
  assert.deepEqual(
    report.ready.map((r) => `${r.item.extra.plan}/${r.item.extra.seq}`),
    // priority 1, then the three at priority 2 (port before walk, 9 before
    // 10 — a string compare would put 10 first), then the unprioritised one
    // last rather than first.
    ['walk/1', 'port/1', 'walk/9', 'walk/10', 'walk/2'],
  );
});

test('a superseded blocker does not hold its dependent forever', () => {
  const dependent = task({ plan: 'walk', seq: '8', state: 'todo', needs: 'walk/7' });
  const report = readyReport([
    task({ plan: 'walk', seq: '7', state: 'todo' }, { status: 'superseded' }),
    dependent,
  ], CONFIG);
  // The blocker was REPLACED, so it is not in the index at all and the
  // reference reads as unresolved — held, and reported, rather than pending
  // on something that will never land.
  assert.deepEqual(report.held.map((r) => r.reason), ['unresolved']);
});
