import { test } from 'node:test';
import assert from 'node:assert/strict';
import { itemCost, estimateTokens, select } from '../../src/core/select.ts';
import { renderItemBlock } from '../../src/core/render-item.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

function item(overrides: Partial<Item> = {}): Item {
  return {
    id: 'RULE-example', type: 'rule', title: 'Example', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: 'Body text.', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/RULE-example.md',
    ...overrides,
  };
}

test('itemCost is the rendered block plus the block separator — the figure select budgets with', () => {
  const i = item();
  assert.equal(itemCost(i), estimateTokens(renderItemBlock(i)) + estimateTokens('\n\n'));
});

test('an item spills exactly when itemCost says it cannot fit', () => {
  const i = item({ always: true });
  const config = resolveConfig({ budgets: { pinned: itemCost(i) - 1 } });
  const sel = select([i], { event: 'session-start' }, config);
  assert.equal(sel.full.length, 0);
  assert.equal(sel.spilled.some((s) => s.id === i.id), true);

  const roomy = resolveConfig({ budgets: { pinned: itemCost(i) } });
  const sel2 = select([i], { event: 'session-start' }, roomy);
  assert.equal(sel2.full.length, 1);
});
