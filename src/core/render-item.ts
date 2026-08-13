import type { Item } from './types.ts';

/**
 * Renders a single item's full-text block, exactly as it appears in the
 * injected context. Shared by `render.ts` (actual output) and `select.ts`
 * (`itemCost`, so budgeting can never drift from what is actually rendered).
 * Pure — no I/O — so `select` stays I/O-free.
 */
export function renderItemBlock(item: Item): string {
  const lines = [`### ${item.id} · ${item.type} · ${item.title}`];
  if (item.body) lines.push('', item.body);
  if (item.observations.length) {
    lines.push('');
    for (const o of item.observations) {
      const tags = o.tags.map((t) => ` #${t}`).join('');
      const ctx = o.context ? ` (${o.context})` : '';
      lines.push(`- [${o.category}] ${o.text}${tags}${ctx}`);
    }
  }
  if (item.scope.length) lines.push('', `_scope: ${item.scope.join(', ')}_`);
  return lines.join('\n');
}

/**
 * Renders a single index-summary line for a normative item. Shared so
 * `select.ts`'s index-budget accounting never drifts from what `render.ts`
 * actually emits.
 */
export function renderIndexLine(entry: { id: string; type: string; title: string }): string {
  return `- ${entry.id} · ${entry.type} · ${entry.title}`;
}
