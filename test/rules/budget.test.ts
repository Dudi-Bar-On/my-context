// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and
/**
 * **THE BUDGET IS GOVERNED AT MAINTENANCE AND ENFORCED AT PUBLISH — and the
 * two halves are in one file so nobody reads one without the other.**
 *
 * D41 spec §10, `plan:store seq:3` Task 11. The plan asks for exactly that
 * arrangement, and the reason is the sentence the governing item opens with:
 *
 * > *A user's install NEVER refuses on size, because a user cannot fix a store
 * > that grew. Publishing refuses instead and names what to move.*
 *
 * A test file holding only the publish refusal would read as "size is
 * enforced" and invite somebody to enforce it one layer down, where it would
 * be a self-inflicted outage in somebody else's workspace. So the refusal and
 * the never-refuse live together, and the never-refuse is asserted twice: once
 * behaviourally, by delivering an over-budget store and counting what came
 * out, and once structurally, by walking the imports of the two modules a
 * user's install actually runs.
 *
 * **Per-entry size is computed, never persisted** (spec §10: *"a persisted size
 * is a cache that goes stale silently"*). That is asserted by CHANGING a file
 * on disk and asking again with nothing regenerated in between — a stored
 * number would answer with yesterday's — and separately by looking for a size
 * anywhere on disk.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, cpSync, mkdtempSync, readFileSync, readdirSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DEFAULT_BUDGET_BYTES, budgetReport, planPublish, writeManifest,
} from '../../src/rules/manifest.ts';
import { composeEntry } from '../../src/rules/schema.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';
import { renderRules } from '../../src/rules/deliver.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

function withStore(fn: (dir: string) => void): void {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-budget-'));
  cpSync(entriesDir(), dir, { recursive: true });
  writeManifest(dir);
  try { fn(dir); } finally { removeTree(dir); }
}

/** A `fact` of roughly `bytes` bytes, in `tier`. */
function plant(dir: string, id: string, tier: 'product' | 'developer', bytes: number): void {
  const filler = 'x'.repeat(Math.max(1, bytes));
  const text = composeEntry({
    id,
    kind: 'fact',
    tier,
    title: `a planted ${tier} fact`,
    parts: {
      truth: filler,
      breaks: 'nothing — this entry exists to take up room',
      example: 'planted by test/rules/budget.test.ts',
      check: 'none - a planted fixture has nothing to measure',
    },
  });
  writeFileSync(path.join(dir, `${id}.md`), text, 'utf8');
  writeManifest(dir);
}

/* ══ 1. PUBLISH REFUSES OVER BUDGET, AND NAMES WHAT TO MOVE ════════════════ */

test('publishing refuses when the product tier is over budget, and names what to move', () => {
  withStore((dir) => {
    plant(dir, 'planted-big-product', 'product', 4000);
    const plan = planPublish(dir, { budgetBytes: 2000 });

    assert.notEqual(
      plan.refusal, null,
      'publishing a product tier over budget was allowed. Spec §10: "the publish step fails ' +
      'when the production tier is over budget and names what to move." A human gate on a ' +
      'machine problem is the shape that already failed for the corpus tier budgets.',
    );
    assert.ok(
      plan.toMove.some((row) => row.id === 'planted-big-product'),
      `the refusal named ${JSON.stringify(plan.toMove.map((r) => r.id))} as what to move, and ` +
      `not the entry that is actually over: a refusal that does not say what to do is a refusal ` +
      `somebody works around.`,
    );
    assert.match(
      plan.refusal ?? '', /planted-big-product/,
      'the refusal sentence itself does not name an entry to move',
    );
  });
});

test('publishing is allowed when the product tier is inside budget', () => {
  withStore((dir) => {
    plant(dir, 'planted-small-product', 'product', 100);
    const plan = planPublish(dir, { budgetBytes: 500_000 });
    assert.equal(
      plan.refusal, null,
      `publishing was refused inside budget (${plan.budget.product.bytes} of ` +
      `${plan.budget.budgetBytes} bytes), so the refusal above is not about the budget`,
    );
  });
});

/* ══ 2. A USER'S INSTALL NEVER REFUSES ON SIZE ═════════════════════════════ */

test('a user\'s install delivers an over-budget store WHOLE, and refuses nothing', () => {
  withStore((dir) => {
    plant(dir, 'planted-big-product', 'product', 40_000);
    const report = budgetReport(dir, 1000);
    assert.equal(report.over, true, 'the store under test is not actually over budget');

    // The user's path, exactly: load, then render. Nothing in it is handed a budget.
    const set = loadRules(dir, false);
    assert.deepEqual(
      set.refused.map((r) => r.id ?? r.path), [],
      'loading an over-budget store refused an entry. A user cannot fix a store that grew — ' +
      'the outage would be ours and the pain theirs.',
    );
    assert.ok(
      set.entries.some((e) => e.id === 'planted-big-product'),
      'the over-budget entry was dropped from the loaded set',
    );
    const delivery = renderRules(set);
    assert.deepEqual(delivery.refused, [], 'the delivered block reported a refusal');
    assert.ok(
      delivery.text.includes('planted-big-product'),
      'the over-budget entry was not delivered. Spec §10: "in a user\'s install, everything in ' +
      'the store is injected, no exception."',
    );
  });
});

/**
 * The structural half, and it fails a day earlier than the behavioural one: a
 * budget wired into the load or render path is a refusal waiting for a store
 * one byte larger, and until that byte arrives the test above stays green.
 */
test('nothing on the delivery path can even reach the budget', () => {
  const IMPORT = /(?:^|\n)\s*(?:import|export)\s[^;]*?from\s*['"](\.[^'"]+)['"]/g;
  const closure = (entry: string): Set<string> => {
    const seen = new Set<string>();
    const queue = [path.resolve(entry)];
    while (queue.length > 0) {
      const file = queue.pop()!;
      if (seen.has(file)) continue;
      seen.add(file);
      let text: string;
      try { text = readFileSync(file, 'utf8'); } catch { continue; }
      IMPORT.lastIndex = 0;
      for (const match of text.matchAll(IMPORT)) queue.push(path.resolve(path.dirname(file), match[1]));
    }
    return seen;
  };

  // Anti-vacuity: the walk must actually reach something, or its silence is free.
  const delivery = closure(path.join(REPO, 'src', 'rules', 'deliver.ts'));
  assert.ok(delivery.size > 3, `the closure of deliver.ts is ${delivery.size} modules; the walk is broken`);

  for (const entry of ['src/rules/store.ts', 'src/rules/deliver.ts']) {
    const reached = closure(path.join(REPO, ...entry.split('/')));
    const budget = [...reached].filter((m) => m.endsWith(path.join('rules', 'manifest.ts')));
    assert.deepEqual(
      budget.map((m) => path.relative(REPO, m)), [],
      `${entry} can reach manifest.ts, where the budget lives. Spec §13 already keeps the ` +
      `integrity catch off the read path for the same reason — "loadRules never calls this and ` +
      `must never call it" — and the budget is the one refusal a user can do nothing about.`,
    );
  }
});

/* ══ 3. PER-ENTRY SIZE IS COMPUTED, NEVER PERSISTED ════════════════════════ */

test('a size that changed on disk is the size reported, with nothing regenerated', () => {
  withStore((dir) => {
    plant(dir, 'planted-small-product', 'product', 100);
    const before = budgetReport(dir).product.bytes;
    const added = '\nAnd a paragraph appended after the size was first reported.\n';
    appendFileSync(path.join(dir, 'planted-small-product.md'), added, 'utf8');

    const after = budgetReport(dir).product.bytes;
    assert.equal(
      after - before, Buffer.byteLength(added, 'utf8'),
      'the reported size did not move by exactly what was appended, so it came from somewhere ' +
      'other than the file. A persisted size is a cache that goes stale silently (spec §10).',
    );
  });
});

test('no size is written to any entry file or to the manifest', () => {
  withStore((dir) => {
    plant(dir, 'planted-small-product', 'product', 100);
    budgetReport(dir);
    for (const name of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
      const fence = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path.join(dir, name), 'utf8'));
      assert.ok(fence !== null, `${name} has no frontmatter`);
      const keys = fence[1].split(/\r?\n/)
        .map((line) => /^([A-Za-z_][A-Za-z0-9_]*):/.exec(line)?.[1])
        .filter((key): key is string => key !== undefined);
      const sizes = keys.filter((key) => /^(size|bytes|length|chars)$/i.test(key));
      assert.deepEqual(sizes, [], `${name} persists ${sizes.join(', ')}`);
    }
    const manifest = readFileSync(path.join(dir, 'manifest.json'), 'utf8');
    assert.equal(
      /"(size|bytes|length|chars)"\s*:/i.test(manifest), false,
      'the manifest persists a size. It is regenerated at publish and read at load, so a size ' +
      'in it is stale for the whole interval in between.',
    );
  });
});

/* ══ 4. ONLY THE PRODUCT TIER COUNTS ══════════════════════════════════════ */

test('the developer tier is reported and NOT counted against the budget', () => {
  withStore((dir) => {
    plant(dir, 'planted-big-developer', 'developer', 40_000);
    const report = budgetReport(dir, 5000);

    assert.ok(
      report.developer.bytes > report.budgetBytes,
      `the planted developer entry is only ${report.developer.bytes} bytes against a budget of ` +
      `${report.budgetBytes}, so "not counted" proves nothing here`,
    );
    assert.equal(
      report.over, false,
      'a developer-tier entry pushed the store over budget. It never reaches a user, so ' +
      'counting it measures the wrong thing (spec §10).',
    );
    assert.ok(
      report.developer.entries.some((e) => e.id === 'planted-big-developer'),
      'the developer tier was not reported at all. It is shown but not counted, not hidden.',
    );
    assert.equal(
      report.product.entries.some((e) => e.id === 'planted-big-developer'), false,
      'a developer entry was counted in the product tier',
    );
  });
});

test('the default budget is a number the caller may replace, not a constant in the code', () => {
  withStore((dir) => {
    assert.equal(budgetReport(dir).budgetBytes, DEFAULT_BUDGET_BYTES);
    assert.equal(
      budgetReport(dir, 7).budgetBytes, 7,
      'the budget could not be changed by the caller. Spec §10: "the budget is changeable by ' +
      'the owner, not a constant in the code."',
    );
  });
});
