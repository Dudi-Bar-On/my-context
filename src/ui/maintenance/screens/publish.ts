/**
 * **The publish screen: a diff, and a question.**
 *
 * D41 spec §12.2, `plan:store seq:3` Task 12. *"Shows a diff of what changes,
 * and asks before it goes. Publishing is outward-facing and hard to reverse."*
 *
 * The confirm button is absent — not disabled — when the plan carries a
 * refusal. A disabled control is a control somebody re-enables in a console;
 * an absent one has nothing to re-enable, and the refusal that replaced it is
 * the sentence saying what to move instead.
 */
import type { PublishPlan } from '../../../rules/manifest.ts';
import { escapeHtml, nav, page } from './page.ts';

export interface PublishOptions {
  plan: PublishPlan;
  storeDir: string;
  /** The outcome of a publish that just happened. */
  notice?: string;
  /** A refusal from an attempted publish, which may not be the budget's. */
  error?: string;
}

const HOW: Record<string, string> = { added: '+', changed: '~', removed: '-' };
const CLASS: Record<string, string> = { added: 'add', changed: '', removed: 'del' };

export function renderPublish(options: PublishOptions): string {
  const { plan } = options;
  const blocks: string[] = [nav()];
  blocks.push('<h1>publish</h1>');
  blocks.push(`<p class="lede">${escapeHtml(options.storeDir)} — store version `
    + `<strong>${plan.fromVersion}</strong>. Publishing regenerates the integrity manifest and `
    + 'cuts the next store version; it is how an install learns anything changed.</p>');

  if (options.error !== undefined) {
    blocks.push(`<p class="refusal" id="refusal">${escapeHtml(options.error)}</p>`);
  }
  if (options.notice !== undefined) {
    blocks.push(`<p class="ok" id="notice">${escapeHtml(options.notice)}</p>`);
  }

  blocks.push('<h2>what would change</h2>');
  if (plan.changes.length === 0) {
    blocks.push('<p class="lede" id="no-changes">nothing: the store on disk is the store that '
      + 'was published.</p>');
  } else {
    blocks.push(`<div class="diff" id="diff">${plan.changes.map((change) =>
      `<div class="${CLASS[change.how]}">${HOW[change.how]} ${escapeHtml(change.how)} `
      + `<code>${escapeHtml(change.id)}</code> <span class="lede">${escapeHtml(change.file)}</span></div>`,
    ).join('')}</div>`);
  }

  blocks.push('<h2>budget</h2>');
  blocks.push(`<p id="budget-product">product tier: <strong>${plan.budget.product.bytes}</strong> `
    + `of ${plan.budget.budgetBytes} bytes`
    + (plan.budget.over ? ` — <strong>${plan.budget.overBy} over</strong>` : ' — inside budget')
    + '</p>');

  if (plan.refusal !== null) {
    // **The machine gate** (spec §10). It is here, where a user never is, and
    // never at load: an install that refused on size would be an outage the
    // person hitting it could do nothing about.
    blocks.push(`<p class="refusal" id="budget-refusal">${escapeHtml(plan.refusal)}</p>`);
    blocks.push('<h2>what to move</h2>');
    blocks.push(`<ul id="to-move">${plan.toMove.map((row) =>
      `<li><code>${escapeHtml(row.id)}</code> — ${row.bytes} bytes. `
      + '<form method="post" action="/tier" style="display:inline">'
      + `<input type="hidden" name="id" value="${escapeHtml(row.id)}">`
      + '<input type="hidden" name="tier" value="developer">'
      + '<button type="submit" class="quiet">move to developer</button></form></li>').join('')}</ul>`);
    return page('publish', blocks.join('\n'));
  }

  if (plan.changes.length === 0) return page('publish', blocks.join('\n'));

  blocks.push('<h2>publish it?</h2>');
  blocks.push('<form method="post" action="/publish">'
    + '<label for="f-note">note<span class="asks">what this publish is for — it goes in the '
    + 'changelog row</span></label>'
    + '<input id="f-note" name="note" value="">'
    + `<button type="submit" id="confirm-publish">publish store version ${plan.toVersion}</button>`
    + '</form>');

  return page('publish', blocks.join('\n'));
}
