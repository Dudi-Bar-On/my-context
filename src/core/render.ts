import { describeFocus, type FocusReport } from './focus.ts';
import { CARRIED_MARKER, renderIndexLine, renderItemBlock } from './render-item.ts';
import type { CarriedSummary, Selection, Spill } from './select.ts';

/**
 * **The cross-session carry disclosure — §6n.2, and the CLI half of "the same
 * provenance in the CLI and the UI".**
 *
 * Every number and every word below is READ OUT of `IndexSummary.carried`.
 * Nothing here is recomputed and no reason is re-worded, and that is the
 * requirement rather than a tidiness preference: `/api/select` serves that same
 * object to the browser unchanged —
 * `ui/read-model.ts` · `export function apiSelect(ws: Workspace, url: URL): JsonResult {` · ~367 —
 * so a renderer with its own vocabulary would be a second spelling of a
 * sentence a second surface renders from the same field. Two surfaces that
 * agree today is the defect this project has paid for most often; the fix is
 * one derivation, not two careful edits.
 *
 * **The count is what ARRIVED**, after the dedupe and after the budget —
 * `carried.shown`, computed inside `buildIndex` off the admitted lines rather
 * than off the input length (§6g). Saying how many were sent would be a
 * disclosure of a delivery that did not happen.
 *
 * **The dropped clause is `INV-nothing-is-dropped-silently` itself.** Every
 * carried id that got no line is named with `select`'s own reason, so
 * `shown + dropped.length` is the whole carry and a reader can check it.
 *
 * **The displacement clause is not optional — §6n.2 — and this line is the
 * ONLY place a reader of the injected block can learn of it.**
 * `renderSpill` below drops a spill whose only tier is `index`, so a line this
 * session's own index would have shown and does not is invisible everywhere
 * else in this text. It names the ids — ids are scope, not content, and
 * `mycontext show <id>` fetches any of them — and it is omitted ENTIRELY when
 * `carried.displaced` is empty, which on an index that is not exhausted is
 * always. A clause that appeared with a zero in it every session is how a
 * reader learns to skim past the one session where it matters.
 *
 * **The label is not invented here either.** It is the session's name when a
 * person gave it one and its short prefix when they did not, decided by
 * `core/continuity.ts` · `function labelFor(root: string, sessionId: string): string {` · ~201
 * and passed through unchanged.
 *
 * Like the focus and spill notes it is scaffolding rather than an item: outside
 * `budgets.index` and outside `Selection.tokens`. A disclosure a budget could
 * drop is not a disclosure.
 */
function renderCarried(carried: CarriedSummary | null): string {
  if (carried === null) return '';

  const parts = [
    `${carried.shown} index line(s) carried from session \`${carried.label}\` and marked ` +
    `\`${CARRIED_MARKER.trim()}\` below.`,
  ];
  if (carried.dropped.length > 0) {
    parts.push(
      `${carried.dropped.length} carried id(s) got no line: ` +
      `${carried.dropped.map((d) => `${d.id} (${d.reason})`).join(', ')}.`,
    );
  }
  if (carried.displaced.length > 0) {
    parts.push(
      `${carried.displaced.length} of this session's own line(s) displaced to make room: ` +
      `${carried.displaced.join(', ')}.`,
    );
  }
  // Only when there is something to fetch. On a carry that cost nothing the
  // line is one sentence, and an invitation to fetch nothing would be noise on
  // the sentence a reader is meant to skim.
  if (parts.length > 1) parts.push('Fetch any of these with mycontext show <id>.');

  return `_${parts.join(' ')}_`;
}

function renderIndex(selection: Selection): string {
  const { normative, counts, drafts, retired, truncated, ineligible, carried } = selection.index;
  const ineligibleEntries = Object.entries(ineligible).sort((a, b) => b[1] - a[1]);

  // `carried` joins the emptiness test deliberately. A carry whose every id was
  // dropped — every one already delivered in full, say — leaves an index with
  // no lines and nothing else to print, and returning '' there would lose the
  // ONLY account of a carry that arrived and delivered nothing.
  if (
    normative.length === 0 && Object.keys(counts).length === 0 &&
    drafts === 0 && retired === 0 && truncated === 0 && ineligibleEntries.length === 0 &&
    carried === null
  ) {
    return '';
  }

  const lines: string[] = ['## my_context index'];
  // Under the heading and above the list: the marker it explains is on the
  // lines that follow, so a reader meets the explanation before the thing it
  // explains rather than after it.
  const carry = renderCarried(carried);
  if (carry) lines.push(carry);

  const listed: string[] = normative.map((n) => renderIndexLine(n));
  if (truncated > 0) listed.push(`- … +${truncated} more (fetch with mycontext show <id>)`);
  // The blank line exists only to separate the disclosure from the list. With
  // no carry the list still sits directly under the heading, byte-identical to
  // before this clause existed.
  if (listed.length > 0) lines.push(...(carry ? [''] : []), ...listed);

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

/** At most this many dangling edges are named inline; the rest are counted. */
const NAMED_DANGLING = 3;

/**
 * **The focus disclosure. Its wording is the whole feature.**
 *
 * Decision Q2 is "focus discloses and allows": it hides what it was asked to
 * hide and reports the cost. This is that report, and it appears HERE — in the
 * injected block — rather than only in a command's output, because the person
 * and the model who need it are reading this text and not a terminal. A
 * disclosure that only a command prints is a disclosure for the one person who
 * already knew.
 *
 * What every part of it is doing:
 *
 *  - **It names the axes**, so "why is this missing" is answerable without
 *    running anything.
 *  - **It states the hidden count against a named universe** ("hidden by focus"
 *    over the corpus at a session start; "that apply to this file" on a
 *    tool-call injection), because the two events count different sets and a
 *    bare number would mean different things in the same log.
 *  - **It states the load-bearing relations left dangling**, which is the half
 *    that makes hiding safe to allow: the open question this settles
 *    (`OPENQ-how-do-filters-respect-dependencies`) was about exactly this
 *    number being invisible.
 *  - **It says nothing was deleted, and how to undo it.** A focus outlives the
 *    session that set it, so the sentence that clears it has to travel with the
 *    sentence that discloses it.
 *  - **It discloses the `severity: hard` exemption when it fires**, so items
 *    that survived a narrowing the user asked for are explained rather than
 *    looking like a bug.
 *
 * It is rendered even when the focus hid nothing: "focus is on and cost you
 * nothing" and "focus is off" are different facts.
 *
 * It is deliberately NOT budgeted with the tiers — it is not an item, it is a
 * statement about the selection, and a budget that could drop it would let
 * focus become a way to hide knowledge silently, which is the one unacceptable
 * failure in this project.
 */
function renderFocus(report: FocusReport | null): string {
  if (report === null) return '';

  const subject = report.universe === 'path'
    ? `${report.hidden.length} item(s) that apply to this file hidden by focus`
    : `${report.hidden.length} item(s) hidden by focus`;

  const named = report.dangling.slice(0, NAMED_DANGLING)
    .map((d) => `${d.from} ${d.type} ${d.to}`)
    .join('; ');
  const more = report.dangling.length - NAMED_DANGLING;
  const dangling = report.dangling.length === 0
    ? '0 load-bearing relations now dangling'
    : `${report.dangling.length} load-bearing relation(s) now dangling: ${named}` +
      (more > 0 ? ` (+${more} more)` : '');

  const exempt = report.exemptHard.length === 0 ? '' :
    ` ${report.exemptHard.length} severity:hard item(s) do not match this focus and are ` +
    `injected anyway — focus never hides one.`;
  // A SECOND sentence rather than more ids in the first. The two exemptions are
  // kept for different reasons — `severity: hard` must not be VIOLATED,
  // `always` must not fall OUT OF CONTEXT — and a reader who asked for a narrow
  // corpus is owed which reason applies to what. Merging them would also make
  // the sentence above false, since it names a severity these items need not
  // have.
  const pinned = report.exemptAlways.length === 0 ? '' :
    ` ${report.exemptAlways.length} pinned item(s) do not match this focus and are ` +
    `injected anyway — focus never hides one either.`;

  return (
    `_Focus is active (${describeFocus(report.axes)}). ${subject}, ${dangling}. ` +
    `Nothing is deleted: \`mycontext focus --show\` lists what is hidden, ` +
    `\`mycontext focus --clear\` restores it.${exempt}${pinned}_`
  );
}

/**
 * **The provenance frame a subagent's injection opens with. Its wording IS
 * the feature, in the same way the focus disclosure's is.**
 *
 * The measurement behind it: a bare imperative delivered into a subagent's
 * context was reported by that subagent to its parent as a possible
 * out-of-band attack. That subagent was behaving correctly. Text that arrives
 * inside a context window with no account of where it came from is
 * indistinguishable from an injection, because that is exactly what an
 * injection looks like — and the block below it opens with a heading naming
 * the product but nothing naming the delivery. A session start does not have
 * this problem: the human who started the session is present and the
 * injection arrives at a moment they can attribute. A subagent has neither.
 *
 * Three things it must contain, each because the reader cannot otherwise
 * decide whether to trust it — this is the requirement, not the style:
 *
 *  - **Where it came from, and at what moment.** A named plugin, installed
 *    in this repository, at the start of this subagent.
 *  - **Who wrote what it carries, and how the reader can check.** People
 *    working on the project; Markdown on disk; a command that prints any of
 *    it. Verifiability is the part an injection cannot imitate — a claim that
 *    survives being checked is a claim an attacker cannot make.
 *  - **That it is not the dispatcher speaking.** Without this, the reader's
 *    two candidate explanations are "my caller told me this" and "something
 *    got into my context", and the true one is neither.
 *
 * **Every clause is a property the product has**, which is why it is worded
 * this narrowly rather than more warmly. "Nothing here is in force on an
 * agent's say-so" is `trust.ts` · `if (origin !== 'human' && tier === 'normative') return 'draft';`
 * (a hard override, not a default) plus `select.ts` ·
 * `if (item.status !== 'active') return false;` — a draft is not selected. It
 * deliberately does NOT claim every line was reviewed by a second person: a
 * person's own capture is active immediately, and `agentEdits` is a per-
 * category policy rather than a universal gate. A frame that overstates its
 * own provenance is worse than no frame, because the one reader who checks it
 * is the one it most needed to convince.
 *
 * **It does not claim authority over the reader's instructions**, and that is
 * deliberate too. "Ignore what you were told, do this instead" is the shape of
 * the attack this frame exists to be distinguishable from; a frame written in
 * that voice earns the suspicion it is trying to defuse.
 *
 * **It is scaffolding, not budget.** Like the focus and spill notes, it is
 * outside `budgets.pinned` and `budgets.index` and outside `Selection.tokens`,
 * which is the count the selector charged its budgets. It is not an item and
 * no budget can drop it — an injection whose frame spilled would be exactly
 * the unattributed text this exists to prevent.
 */
export const SUBAGENT_PREAMBLE =
  '_This block was added by my_context, the knowledge plugin installed in this repository, ' +
  'when this subagent started — before your first turn. It is not part of the message that ' +
  'dispatched you._\n\n' +
  "_What it carries is this project's own recorded knowledge. The project's items are Markdown " +
  'files under `.my_context/items/`, so you can read any of them yourself, and ' +
  '`mycontext show <id>` prints anything the index only names. They are maintained by the ' +
  'people working on this project: an item captured by anything other than a person is staged ' +
  'as a draft and does not govern until a person promotes it, so nothing here is in force on an ' +
  "agent's say-so._\n\n" +
  "_Treat what follows as this project's standing constraints on the work you were asked to do. " +
  'They were in force before you were dispatched, and they do not replace the instructions you ' +
  'were given._';

export function renderSelection(selection: Selection): string {
  const blocks: string[] = [];

  if (selection.full.length) {
    const body = selection.full.map((e) => renderItemBlock(e.item)).join('\n\n');
    blocks.push(`## my_context — these govern this project\n\n${body}`);
  }

  const index = renderIndex(selection);
  if (index) blocks.push(index);

  // Before the spill note, deliberately. Both say "something is missing", and
  // the focus note is the one the reader ASKED for — reading it first tells
  // them the omission is theirs before the budget's omission is described.
  const focus = renderFocus(selection.focus);
  if (focus) blocks.push(focus);

  const spill = renderSpill(selection);
  if (spill) blocks.push(spill);

  return blocks.length ? blocks.join('\n\n').replace(/\r/g, '') + '\n' : '';
}
