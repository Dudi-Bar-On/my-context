/**
 * `Selection.tokens` and the injection record's `tokens` field: the estimated
 * token count the budget was actually charged, frozen at injection time.
 *
 * Three properties, each pinned because each is the point:
 *
 *  1. **The number is the budget's own arithmetic** — the sum of the chars/4
 *     estimates over every admitted full-text block (with its separator) and
 *     every index line, and nothing else. Not the whole rendered output: the
 *     scaffolding around the blocks is un-budgeted and excluded.
 *  2. **Spilled items contribute nothing.** The field says what was delivered,
 *     and a spill is the record of what was not.
 *  3. **Absence survives the projection.** A record written before the field
 *     existed must come back from the SQLite projection still WITHOUT it —
 *     "not recorded" and 0 are different answers, and a storage layer that
 *     conflates them has silently dropped the distinction every read surface
 *     depends on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { recordAudit } from '../../src/core/audit.ts';
import { openProjection, queryProjection, syncProjection } from '../../src/core/audit-db.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { renderIndexLine, renderItemBlock } from '../../src/core/render-item.ts';
import { estimateTokens, select } from '../../src/core/select.ts';
import type { Item } from '../../src/core/types.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'CONST-a', type: 'constraint', title: 'A constraint', status: 'active',
    severity: 'soft', always: false, continuity: false, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'body', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/constraint/CONST-a.md',
    ...over,
  };
}

/** Exactly `itemCost` in select.ts: the rendered block plus its separator. */
function blockCost(i: Item): number {
  return estimateTokens(renderItemBlock(i)) + estimateTokens('\n\n');
}

function lineCost(i: Item): number {
  return estimateTokens(renderIndexLine({ id: i.id, type: i.type, title: i.title }));
}

test('Selection.tokens is the sum the budget was charged: admitted blocks plus index lines', () => {
  const pinnedA = item({ id: 'CONST-a', always: true });
  const pinnedB = item({ id: 'RULE-b', type: 'rule', title: 'A rule', always: true, continuity: false, body: 'Do it.' });
  const indexed = item({ id: 'CONST-c', title: 'Only an index line' });

  const sel = select([pinnedA, pinnedB, indexed], { event: 'session-start' }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id).sort(), ['CONST-a', 'RULE-b']);
  assert.deepEqual(sel.index.normative.map((n) => n.id), ['CONST-c']);
  assert.equal(
    sel.tokens,
    blockCost(pinnedA) + blockCost(pinnedB) + lineCost(indexed),
    'tokens must be exactly what fitToBudget and buildIndex charged, nothing more or less',
  );
});

test('a tool-event selection counts only the JIT blocks — there is no index to count', () => {
  const scoped = item({ id: 'CONST-s', scope: ['src/**'] });
  const sel = select([scoped], { event: 'tool', path: 'src/db/writer.ts' }, CONFIG);
  assert.deepEqual(sel.full.map((e) => e.item.id), ['CONST-s']);
  assert.equal(sel.tokens, blockCost(scoped));
});

test('spilled items contribute nothing, and an empty selection measures zero', () => {
  // A pinned budget nothing fits and an index budget nothing fits: everything
  // spills, nothing is delivered, and the honest measurement of that is 0 —
  // which is precisely why an OLD record's absent field must never read as 0.
  const cfg = resolveConfig({ budgets: { pinned: 1, index: 0 } });
  const sel = select([item({ always: true })], { event: 'session-start' }, cfg);
  assert.deepEqual(sel.full, []);
  assert.ok(sel.spilled.length > 0, 'nothing spilled, so this case proves nothing');
  assert.equal(sel.tokens, 0);

  assert.equal(select([], { event: 'session-start' }, CONFIG).tokens, 0);
});

test('the projection preserves tokens where recorded and ABSENCE where not', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-audit-tokens-'));
  try {
    // An old record, as written before the field existed.
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'old', hook: 'PreToolUse',
      at: '2026-08-14T10:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'jit' }],
    });
    // A new one, carrying the estimate the budget was charged.
    recordAudit(root, {
      kind: 'injection', op: 'jit', sessionId: 'new', hook: 'PreToolUse',
      at: '2026-08-15T10:00:00.000Z', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 123,
    });

    const db = openProjection(root);
    try {
      syncProjection(root, db);
      const [oldRec, newRec] = queryProjection(db, {});
      assert.equal(newRec.tokens, 123, 'the recorded estimate did not survive the projection');
      assert.equal(
        'tokens' in oldRec, false,
        'a pre-field record came back with a tokens property — absent means "not recorded", ' +
        'and materializing it (even as undefined or 0) turns unknown into a measurement',
      );
    } finally { db.close(); }
  } finally { removeTree(root); }
});
