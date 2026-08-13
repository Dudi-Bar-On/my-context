import { renderIndexLine, renderItemBlock } from './render-item.ts';
import type { Selection, Spill } from './select.ts';

function renderIndex(selection: Selection): string {
  const { normative, counts, drafts, retired, truncated, ineligible } = selection.index;
  const ineligibleEntries = Object.entries(ineligible).sort((a, b) => b[1] - a[1]);

  if (
    normative.length === 0 && Object.keys(counts).length === 0 &&
    drafts === 0 && retired === 0 && truncated === 0 && ineligibleEntries.length === 0
  ) {
    return '';
  }

  const lines: string[] = ['## my_context index'];
  for (const n of normative) lines.push(renderIndexLine(n));
  if (truncated > 0) lines.push(`- … +${truncated} more (fetch with mycontext show <id>)`);

  const summary = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, n]) => `${n} ${type}`);
  if (drafts > 0) summary.push(`${drafts} drafts pending review`);
  if (retired > 0) summary.push(`${retired} retired`);
  // A disabled or unknown category never deletes existing items — it drops
  // to index-only. Surfaced here, terse, so it is visible rather than silent.
  for (const [type, n] of ineligibleEntries) summary.push(`${n} ${type} (disabled/unknown category)`);
  if (summary.length) {
    lines.push('', summary.join(' · '), '→ use mycontext list or mycontext show <id> to browse these');
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
  // Entries whose ONLY tier is 'index' were never full-text candidates —
  // they are already disclosed by the index's "+N more" line, so listing
  // them again here (with the misleading "omitted from full text" wording)
  // would be redundant, not additionally informative.
  const grouped = groupSpillsById(selection.spilled)
    .filter((g) => !(g.tiers.length === 1 && g.tiers[0] === 'index'));
  if (grouped.length === 0) return '';

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
    const body = selection.full.map((e) => renderItemBlock(e.item)).join('\n\n');
    blocks.push(`## my_context — these govern this project\n\n${body}`);
  }

  const index = renderIndex(selection);
  if (index) blocks.push(index);

  const spill = renderSpill(selection);
  if (spill) blocks.push(spill);

  return blocks.length ? blocks.join('\n\n').replace(/\r/g, '') + '\n' : '';
}
