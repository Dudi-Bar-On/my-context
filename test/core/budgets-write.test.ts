/**
 * `src/core/budgets-write.ts` — the one writer behind
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`, task
 * `plan:budget seq:5`.
 *
 * Three things this file has to prove, because the task named them as
 * non-negotiable: a positive integer or a refusal naming what was wrong,
 * never a clamp; BUDGETS ONLY, so every other top-level `config.json` key
 * survives a write untouched; and the diff is real before/after VALUES, not a
 * file-level "(this file) → (is rewritten)".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sandbox } from '../helpers/workspace.ts';
import { DEFAULT_BUDGETS } from '../../src/core/config.ts';
import {
  BudgetRefusal, currentBudgets, diffBudgets, diffBudgetsAgainstDisk, parseProposedBudgets,
  requirePositiveIntegerBudget, writeBudgets,
} from '../../src/core/budgets-write.ts';

/* -------------------------------------------------------------------------- *
 * requirePositiveIntegerBudget — a positive integer or a refusal, never a clamp.
 * -------------------------------------------------------------------------- */

test('a positive integer, as a number, is accepted', () => {
  assert.equal(requirePositiveIntegerBudget('pinned', 22_000), 22_000);
});

test('a positive integer, as a digit-only string (the query-string shape), is accepted', () => {
  assert.equal(requirePositiveIntegerBudget('pinned', '22000'), 22_000);
});

for (const bad of [0, -1, 1.5, NaN, Infinity, '0', '-1', '1.5', 'abc', '22000x', true, null, [1], {}]) {
  test(`${JSON.stringify(bad)} is refused, naming the key and what was sent — never clamped`, () => {
    assert.throws(() => requirePositiveIntegerBudget('pinned', bad), (err: Error) => {
      assert.ok(err instanceof BudgetRefusal);
      assert.match(err.message, /budgets\.pinned must be a positive integer/);
      assert.ok(err.message.includes(JSON.stringify(bad)), 'the refusal must name what was refused');
      return true;
    });
  });
}

/* -------------------------------------------------------------------------- *
 * parseProposedBudgets — unknown keys refused, not dropped.
 * -------------------------------------------------------------------------- */

test('every declared budget key is accepted', () => {
  const out = parseProposedBudgets({ pinned: 1, jit: 2, restored: 3, continuity: 5, index: 4 });
  assert.deepEqual(out, { pinned: 1, jit: 2, restored: 3, continuity: 5, index: 4 });
});

test('an unknown key is refused rather than silently dropped', () => {
  assert.throws(() => parseProposedBudgets({ pined: 22_000 }), (err: Error) => {
    assert.ok(err instanceof BudgetRefusal);
    assert.match(err.message, /"pined" is not a budget this screen writes/);
    assert.match(err.message, /pinned, jit, restored, continuity, index/);
    return true;
  });
});

test('categories, watchedDocs, profile and ui are refused as keys — BUDGETS ONLY', () => {
  for (const key of ['categories', 'watchedDocs', 'profile', 'ui', 'handover']) {
    assert.throws(() => parseProposedBudgets({ [key]: 1 }), BudgetRefusal, key);
  }
});

/* -------------------------------------------------------------------------- *
 * diffBudgets — only the keys that actually differ, before -> after.
 * -------------------------------------------------------------------------- */

test('a proposal equal to the current value produces no diff row', () => {
  assert.deepEqual(diffBudgets(DEFAULT_BUDGETS, { pinned: DEFAULT_BUDGETS.pinned }), []);
});

test('the diff carries real numbers, not a file-level placeholder', () => {
  const diff = diffBudgets(DEFAULT_BUDGETS, { pinned: 22_000, jit: 8_000 });
  assert.deepEqual(diff, [
    { field: 'budgets.pinned', before: DEFAULT_BUDGETS.pinned, after: 22_000 },
    { field: 'budgets.jit', before: DEFAULT_BUDGETS.jit, after: 8_000 },
  ]);
});

/* -------------------------------------------------------------------------- *
 * currentBudgets / diffBudgetsAgainstDisk — fresh off disk, never a snapshot.
 * -------------------------------------------------------------------------- */

test('an absent config.json resolves to the shipped defaults', () => {
  const box = sandbox();
  try {
    assert.deepEqual(currentBudgets(box.root).budgets, DEFAULT_BUDGETS);
  } finally { box.dispose(); }
});

test('a config.json that does not parse is a BudgetRefusal naming the loader\'s own words', () => {
  const box = sandbox();
  try {
    writeFileSync(path.join(box.root, 'config.json'), '{ this is not json', 'utf8');
    assert.throws(() => currentBudgets(box.root), BudgetRefusal);
  } finally { box.dispose(); }
});

test('a config.json with an invalid budgets value is a BudgetRefusal, not a crash', () => {
  const box = sandbox();
  try {
    writeFileSync(
      path.join(box.root, 'config.json'),
      JSON.stringify({ budgets: { pinned: -1 } }),
      'utf8',
    );
    assert.throws(() => currentBudgets(box.root), BudgetRefusal);
  } finally { box.dispose(); }
});

test('diffBudgetsAgainstDisk reads config.json FRESH, not a snapshot taken earlier', () => {
  const box = sandbox();
  try {
    const before = diffBudgetsAgainstDisk(box.root, { pinned: 22_000 });
    assert.deepEqual(before, [{ field: 'budgets.pinned', before: DEFAULT_BUDGETS.pinned, after: 22_000 }]);

    // The file changes UNDER this process — the same fact `writeBudgets` below
    // depends on when it reads immediately before writing.
    writeFileSync(
      path.join(box.root, 'config.json'),
      JSON.stringify({ budgets: { pinned: 22_000 } }),
      'utf8',
    );
    assert.deepEqual(diffBudgetsAgainstDisk(box.root, { pinned: 22_000 }), [],
      'the same proposal against the NEW disk state must diff to nothing');
  } finally { box.dispose(); }
});

/* -------------------------------------------------------------------------- *
 * writeBudgets — the write itself. BUDGETS ONLY, and a no-op writes nothing.
 * -------------------------------------------------------------------------- */

test('writeBudgets changes exactly budgets, and every sibling top-level key survives untouched', () => {
  const box = sandbox();
  try {
    writeFileSync(
      path.join(box.root, 'config.json'),
      JSON.stringify({
        profile: 'standard',
        categories: { lesson: { scopePolicy: 'inert' } },
        watchedDocs: ['README.md'],
        ui: { enabled: true },
        budgets: { pinned: 6000 },
      }, null, 2),
      'utf8',
    );

    const diff = writeBudgets(box.root, { pinned: 22_000, jit: 9_000 });
    assert.deepEqual(diff, [
      { field: 'budgets.pinned', before: 6000, after: 22_000 },
      { field: 'budgets.jit', before: DEFAULT_BUDGETS.jit, after: 9_000 },
    ]);

    const onDisk = JSON.parse(readFileSync(path.join(box.root, 'config.json'), 'utf8'));
    assert.deepEqual(onDisk.budgets, { ...DEFAULT_BUDGETS, pinned: 22_000, jit: 9_000 });
    // BUDGETS ONLY: every other top-level key is exactly what it was.
    assert.equal(onDisk.profile, 'standard');
    assert.deepEqual(onDisk.categories, { lesson: { scopePolicy: 'inert' } });
    assert.deepEqual(onDisk.watchedDocs, ['README.md']);
    assert.deepEqual(onDisk.ui, { enabled: true });
  } finally { box.dispose(); }
});

test('writeBudgets against config.json as `mycontext init` leaves it touches only budgets', () => {
  const box = sandbox();
  try {
    const beforeRaw = JSON.parse(readFileSync(path.join(box.root, 'config.json'), 'utf8')) as Record<string, unknown>;
    const diff = writeBudgets(box.root, { pinned: 22_000 });
    assert.deepEqual(diff, [{ field: 'budgets.pinned', before: DEFAULT_BUDGETS.pinned, after: 22_000 }]);
    const onDisk = JSON.parse(readFileSync(path.join(box.root, 'config.json'), 'utf8')) as Record<string, unknown>;
    assert.deepEqual(onDisk.budgets, { ...DEFAULT_BUDGETS, pinned: 22_000 });
    // Every key `init` wrote other than `budgets` survives byte-for-byte.
    for (const key of Object.keys(beforeRaw)) {
      if (key === 'budgets') continue;
      assert.deepEqual(onDisk[key], beforeRaw[key], `init's own "${key}" must survive untouched`);
    }
  } finally { box.dispose(); }
});

test('a proposal equal to the current value writes NOTHING — a no-op is not a rewrite', () => {
  const box = sandbox();
  try {
    writeFileSync(
      path.join(box.root, 'config.json'),
      JSON.stringify({ budgets: { pinned: 6000 } }, null, 2),
      'utf8',
    );
    const before = readFileSync(path.join(box.root, 'config.json'), 'utf8');
    const diff = writeBudgets(box.root, { pinned: 6000 });
    assert.deepEqual(diff, []);
    assert.equal(readFileSync(path.join(box.root, 'config.json'), 'utf8'), before);
  } finally { box.dispose(); }
});

test('the written file ends with exactly one trailing newline, matching every other writer', () => {
  const box = sandbox();
  try {
    writeBudgets(box.root, { pinned: 22_000 });
    const raw = readFileSync(path.join(box.root, 'config.json'), 'utf8');
    assert.ok(raw.endsWith('}\n'));
    assert.ok(!raw.endsWith('}\n\n'));
  } finally { box.dispose(); }
});
