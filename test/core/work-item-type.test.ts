// @basis TASK-a-function-that-reads-a-task-field-accepts-any-item-and, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A function that reads a task field takes a `WorkItem`, and this file is
 * where that is a compile error rather than a convention.**
 *
 * `TASK-a-function-that-reads-a-task-field-accepts-any-item-and` measured it:
 * `taskState(item: Item)` accepted any item and answered the empty string for a
 * `requirement` — a category with no `state` field — which no caller could tell
 * apart from a task that declares `state` and has not set it. The live instance
 * is D57, closed ON THE MAP rather than on its item because *"a requirement has
 * no field to close on"*.
 *
 * **Why the assertions are `@ts-expect-error` and not `assert.throws`.**
 * `taskState` on a requirement does not throw and must not: it reads
 * `extra['state']`, finds nothing, and returns the empty string. Adding a
 * runtime guard would turn a design error into a crash in a reporting path. The
 * guarantee has to be that such a call cannot be WRITTEN, and the only
 * instrument that can hold that is the compiler — `@ts-expect-error` is itself
 * an error when the line below it compiles, so each directive fails in both
 * directions and `npm run typecheck` is what runs them.
 *
 * Removal proofs for every directive are recorded in the lane report.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveConfig } from '../../src/core/config.ts';
import {
  asWorkItem, buildTaskIndex, isWorkItem, readNeeds, taskKey, taskState, unprovenTaskState,
  workItems,
} from '../../src/core/needs.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
    requirement: {
      tier: 'normative',
      prefix: 'REQ',
      description: 'Something the product must do.',
      extraFields: [],
    },
  },
});

function item(type: string, extra: Record<string, string> = {}): Item {
  return {
    id: `${type.toUpperCase()}-x`, type, title: 'T',
    status: 'active', severity: 'soft', always: false, continuity: false,
    summary: null, summaryOf: null, summaryWas: [], acknowledged: {},
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: `items/${type}/x.md`,
  };
}

/* -------------------------------------------------------------------------- *
 * 1. The signature.
 * -------------------------------------------------------------------------- */

test('a task-field reader refuses a bare Item — three COMPILE errors', () => {
  const requirement = item('requirement');
  const index = buildTaskIndex([], CONFIG);

  // @ts-expect-error -- THE DEFECT, as it used to compile: a requirement has no
  // `state` field, and `taskState` used to answer '' for it — indistinguishable
  // from a task that declares `state` and has not set one.
  taskState(requirement);

  // @ts-expect-error -- the same for the key: a requirement has no plan and no seq.
  taskKey(requirement);

  // @ts-expect-error -- and for the dependency reading, which reads both.
  readNeeds(requirement, index);

  // The run-time half, which is the reason none of this could be a runtime
  // test: the call does not throw and must not. It answers a blank.
  assert.equal(
    unprovenTaskState(requirement), '',
    'the unproven read still answers a blank for a category with no state field — that IS the '
    + 'defect, and it is why the guarantee had to move into the signature',
  );
});

test('the proof is the only way in, and it answers honestly', () => {
  const task = asWorkItem(CONFIG, item('task', { plan: 'walk', seq: '8', state: 'Todo' }));
  const requirement = asWorkItem(CONFIG, item('requirement'));

  assert.notEqual(task, null, 'a task category declares plan, seq and state');
  assert.equal(
    requirement, null,
    'and `null` is the answer `taskState` used to hide inside an empty string: this category '
    + 'has no such field, so the question does not apply',
  );

  // With the proof in hand the readers are available and unchanged.
  assert.equal(taskState(task!), 'todo', 'still lowercased, still trimmed');
  assert.equal(taskKey(task!), 'walk/8');

  // And the guard form narrows in place.
  const candidate: Item = item('task', { plan: 'p', seq: '1', state: 'done' });
  assert.equal(isWorkItem(CONFIG, candidate), true);
  if (isWorkItem(CONFIG, candidate)) assert.equal(taskState(candidate), 'done');
});

test('workItems hands the proof onward, which is what made the change landable', () => {
  const items = [
    item('task', { plan: 'walk', seq: '7', state: 'done' }),
    item('requirement'),
  ];
  const work = workItems(items, CONFIG);
  assert.equal(work.length, 1, 'the requirement is not work');
  // No cast and no second check: the element IS a `WorkItem`, so every existing
  // `workItems(...).filter((i) => taskState(i) === ...)` call site — including
  // the three in `doctor/checks.ts`, which this lane did not touch — kept
  // compiling unchanged.
  assert.equal(taskState(work[0]!), 'done');

  // And the brand is a type: a `WorkItem` is the same object, not a wrapper.
  assert.equal(work[0], items[0], 'no copy, no wrapper — the brand erases');
});

/* -------------------------------------------------------------------------- *
 * 2. The escape, counted.
 * -------------------------------------------------------------------------- */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');

function tsFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) tsFiles(full, out);
    else if (name.endsWith('.ts')) out.push(full);
  }
  return out;
}

/**
 * **`unprovenTaskState` is the one escape, and this is its budget.**
 *
 * `core/select.ts` cannot present a `Config` — it is pure by declaration, and
 * `governs`, the exported function that reaches the read, is called from
 * `doctor/checks.ts` with one argument. So one caller reads the state without
 * proving the category, deliberately and under a name that says so.
 *
 * A budget of ONE rather than a prohibition, because a prohibition would have
 * meant either a signature change in a file this lane did not own or a silent
 * `as WorkItem` somewhere — and a cast is the same escape with no name on it.
 * What this test buys is that a SECOND one is a failing test rather than a
 * quiet return of the defect.
 */
test('unprovenTaskState has exactly one caller under src/, and it is named', () => {
  const callers = tsFiles(SRC)
    .filter((f) => path.relative(SRC, f) !== path.join('core', 'needs.ts'))
    .filter((f) => /\bunprovenTaskState\s*\(/.test(readFileSync(f, 'utf8')))
    .map((f) => path.relative(SRC, f).split(path.sep).join('/'))
    .sort();

  assert.deepEqual(
    callers, ['core/select.ts'],
    'the unproven read is an escape with a stated reason (core/select.ts holds no Config). A '
    + 'second caller is a second place where a task field is read off an item nothing proved '
    + 'is work — which is the whole of '
    + 'TASK-a-function-that-reads-a-task-field-accepts-any-item-and. Either present a Config '
    + 'and use taskState, or change this budget deliberately and say why.',
  );
});

/**
 * **ANTI-VACUITY for the test above.** A regex that matched nothing would pass
 * an empty list against a one-element expectation and fail loudly — but a regex
 * that matched the WRONG thing could pass by accident. So the detector is shown
 * to find a real call, in the file the budget names, at the line it is on.
 */
test('the caller count is measured by a detector that can see a call', () => {
  const select = readFileSync(path.join(SRC, 'core', 'select.ts'), 'utf8');
  assert.match(
    select, /unprovenTaskState\(item\)\s*!==\s*DONE_STATE/,
    'the one permitted call is in isOpenWork, comparing against DONE_STATE',
  );
  assert.doesNotMatch(
    select, /\btaskState\s*\(/,
    'and select.ts must not reach the proved reader, because it cannot present the proof',
  );
});
