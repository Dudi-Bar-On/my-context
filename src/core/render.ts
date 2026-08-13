import type { Selection, Spill } from './select.ts';
import type { Item } from './types.ts';

function renderItemBlock(item: Item): string {
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

function renderIndex(selection: Selection): string {
  const { normative, counts, drafts, retired, truncated } = selection.index;
  if (
    normative.length === 0 && Object.keys(counts).length === 0 &&
    drafts === 0 && retired === 0 && truncated === 0
  ) {
    return '';
  }

  const lines: string[] = ['## my_context index'];
  for (const n of normative) lines.push(`- ${n.id} · ${n.type} · ${n.title}`);
  if (truncated > 0) lines.push(`- … +${truncated} more (fetch with mycontext query)`);

  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} ${type}`);
  if (drafts > 0) summary.push(`${drafts} drafts pending review`);
  if (retired > 0) summary.push(`${retired} retired`);
  if (summary.length) {
    lines.push('', summary.join(' · '), '→ use mycontext query to search these');
  }
  return lines.join('\n');
}

/**
 * Spill entries are per-tier: the same item id can appear once per tier that
 * dropped it (e.g. 'pinned' AND 'index'). Group by id here so the disclosure
 * reports each lost item once, listing every tier that excluded it.
 */
function groupSpillsById(spilled: Spill[]): { id: string; tiers: string[]; reasons: string[] }[] {
  const byId = new Map<string, { id: string; tiers: string[]; reasons: string[] }>();
  for (const s of spilled) {
    const existing = byId.get(s.id);
    if (existing) {
      existing.tiers.push(s.tier);
      existing.reasons.push(s.reason);
    } else {
      byId.set(s.id, { id: s.id, tiers: [s.tier], reasons: [s.reason] });
    }
  }
  return [...byId.values()];
}

function renderSpill(selection: Selection): string {
  if (selection.spilled.length === 0) return '';

  const grouped = groupSpillsById(selection.spilled);
  const items = grouped
    .map((g) => (g.tiers.length > 1 ? `${g.id} (${g.tiers.join(', ')})` : g.id))
    .join(', ');

  return (
    `_${grouped.length} item(s) omitted from full text for budget: ${items}. ` +
    `Fetch with mycontext show <id>._`
  );
}

export function renderSelection(selection: Selection): string {
  const blocks: string[] = [];

  if (selection.full.length) {
    blocks.push('## my_context — these govern this project', '');
    blocks.push(selection.full.map((e) => renderItemBlock(e.item)).join('\n\n'));
  }

  const index = renderIndex(selection);
  if (index) blocks.push(index);

  const spill = renderSpill(selection);
  if (spill) blocks.push(spill);

  return blocks.length ? blocks.join('\n\n').replace(/\r/g, '') + '\n' : '';
}
