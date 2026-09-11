/**
 * **The entry list, with the budget shown beside it.**
 *
 * D41 spec §10 and §11.3, `plan:store seq:3` Tasks 10 and 11. The list is
 * where the budget belongs, because the budget is a fact about the SET and not
 * about any one entry: a screen that showed each entry's size and no total
 * would be a screen where nobody could answer "are we over".
 *
 * **The product tier is counted and the developer tier is not**, and the two
 * are drawn differently so that is visible rather than merely true. Spec §10:
 * *"the developer tier's total shown but NOT counted (it never reaches a user,
 * so counting it measures the wrong thing)."*
 *
 * Every size on this screen is computed by `budgetReport` at the moment the
 * screen is drawn. Nothing here reads a stored number, because there is none.
 */
import type { BudgetReport, EntrySize } from '../../../rules/manifest.ts';
import type { Entry, EntryError } from '../../../rules/schema.ts';
import { escapeHtml, nav, page } from './page.ts';

function meter(used: number, budget: number): string {
  const share = budget <= 0 ? 1 : Math.min(1, used / budget);
  const over = used > budget;
  return `<div class="meter${over ? ' over' : ''}"><span style="width:${(share * 100).toFixed(1)}%"></span></div>`;
}

function sizeRows(rows: readonly EntrySize[]): string {
  if (rows.length === 0) return '<p class="lede">none.</p>';
  return `<table><thead><tr><th>entry</th><th>bytes</th></tr></thead><tbody>${
    rows.map((row) => `<tr><td><code>${escapeHtml(row.id)}</code></td><td>${row.bytes}</td></tr>`).join('')
  }</tbody></table>`;
}

export interface ListOptions {
  entries: readonly Entry[];
  refused: readonly EntryError[];
  budget: BudgetReport;
  /** A sentence to show at the top — the outcome of the last action. */
  notice?: string;
  /** A refusal to show at the top. */
  error?: string;
  storeDir: string;
}

export function renderList(options: ListOptions): string {
  const { budget } = options;
  const blocks: string[] = [nav()];
  blocks.push('<h1>the product rule store</h1>');
  blocks.push(`<p class="lede">${escapeHtml(options.storeDir)} — this tool does not ship. `
    + 'It writes entries directly, and publishing is the gate.</p>');

  if (options.error !== undefined) {
    blocks.push(`<p class="refusal" id="refusal">${escapeHtml(options.error)}</p>`);
  }
  if (options.notice !== undefined) {
    blocks.push(`<p class="ok" id="notice">${escapeHtml(options.notice)}</p>`);
  }

  blocks.push('<h2>budget</h2>');
  blocks.push(`<p id="budget-product">product tier: <strong>${budget.product.bytes}</strong> of `
    + `${budget.budgetBytes} bytes`
    + (budget.over ? ` — <strong>${budget.overBy} over</strong>` : '')
    + '</p>');
  blocks.push(meter(budget.product.bytes, budget.budgetBytes));
  blocks.push(`<p id="budget-developer" class="lede">developer tier: `
    + `<strong>${budget.developer.bytes}</strong> bytes — shown, and <em>not</em> counted: it `
    + 'never reaches a user, so counting it would measure the wrong thing.</p>');

  blocks.push('<h2>entries</h2>');
  const bySize = new Map<string, number>();
  for (const row of [...budget.product.entries, ...budget.developer.entries]) bySize.set(row.id, row.bytes);

  if (options.entries.length === 0) {
    blocks.push('<p class="lede">the store holds no entry that parses.</p>');
  } else {
    blocks.push(`<table id="entries"><thead><tr>`
      + '<th>id</th><th>kind</th><th>tier</th><th>bytes</th><th>title</th><th></th>'
      + '</tr></thead><tbody>'
      + options.entries.map((entry) => {
        const other = entry.tier === 'product' ? 'developer' : 'product';
        return `<tr data-id="${escapeHtml(entry.id)}">`
          + `<td><a href="/edit?id=${encodeURIComponent(entry.id)}"><code>${escapeHtml(entry.id)}</code></a></td>`
          + `<td>${escapeHtml(entry.kind)}</td>`
          + `<td class="tier">${escapeHtml(entry.tier)}</td>`
          + `<td>${bySize.get(entry.id) ?? 0}</td>`
          + `<td>${escapeHtml(entry.title)}</td>`
          + '<td><form method="post" action="/tier">'
          + `<input type="hidden" name="id" value="${escapeHtml(entry.id)}">`
          + `<input type="hidden" name="tier" value="${other}">`
          + `<button type="submit" class="quiet">move to ${other}</button>`
          + '</form></td></tr>';
      }).join('')
      + '</tbody></table>');
  }

  // `INV-nothing-is-dropped-silently`: a file that did not load is NAMED here,
  // not counted and dropped. It is also the one thing on this screen a person
  // can only fix by opening the file.
  if (options.refused.length > 0) {
    blocks.push(`<h2>did not load (${options.refused.length})</h2>`);
    blocks.push(`<ul id="refused">${options.refused.map((r) =>
      `<li><code>${escapeHtml(r.id ?? r.path)}</code> — ${escapeHtml(r.error)}</li>`).join('')}</ul>`);
  }

  blocks.push('<h2>what is in each tier, largest first</h2>');
  blocks.push('<h3>product — counted</h3>');
  blocks.push(sizeRows(budget.product.entries));
  blocks.push('<h3>developer — not counted</h3>');
  blocks.push(sizeRows(budget.developer.entries));

  return page('entries', blocks.join('\n'));
}
