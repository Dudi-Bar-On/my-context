/**
 * `nav.ch` — **Review queue**, `<section data-p="work">` in the design of
 * record. One card per pending revision, and the whole capability is the
 * three-column table inside it: `work.field` **Field**, `work.now` **In
 * force**, `work.prop` **Proposed**
 * (`docs/design/web-ui-mockup.html` · `<table><thead><tr><th data-t="work.field">Field</th>` · ~1935).
 *
 * `work.v` states the bargain the screen exists to keep — *"the diff is the
 * capability; the approval is a paste"*. The diff is what a terminal cannot
 * lay out side by side; the approval is ONE LINE the human runs in their own
 * shell. Nothing here writes, and `work.sub` says so on the screen itself.
 *
 * ── PER-FIELD STALENESS, WHICH IS THE ROW SHAPE AND NOT A BADGE ───────────
 *
 * `/api/revisions` decorates every field with `changed` — "a human has moved
 * this very text since the proposal was staged"
 * (`ui/read-model-work.ts` · `changed: rev.changedSince.includes(field),` · ~62).
 * The design of record does not draw that as an annotation beside a diff. It
 * REPLACES the row's two value cells: the field name takes `td.m.stale`, which
 * carries a rule down its reading-start edge, and the two cells become
 * `work.moved` / `work.blocked`
 * (`docs/design/web-ui-mockup.html` · `<td class="m stale">body <span class="chip warn" data-g="▲">stale</span></td>` · ~1941).
 *
 * That is the honest shape, not a shorter one. A stale field's proposed text
 * was written against a version that no longer exists, so drawing it against
 * the CURRENT text would show a comparison nobody ever made. The two sentences
 * say what is true instead: it changed since staging, and promote refuses
 * until it is re-based.
 *
 * The rule itself is `td.stale`, carried into the stylesheet with its RTL
 * mirror written beside it rather than discovered later
 * (`src/ui/public/styles.css` · `[dir="rtl"] td.stale{box-shadow:inset -2px 0 0 var(--warn)}` · ~862)
 * — the physical offset `work.diffn`'s last sentence is about.
 *
 * ── THE DIFF IS LINE-LEVEL AND `work.diffn` SAYS WORD-LEVEL ───────────────
 *
 * **Recorded, not resolved here.** `work.diffn` promises *"a word-level diff"*;
 * `lineDiff` is a line-level LCS and there is no word-level diff anywhere in
 * `src/`. Plan 2 Task 11 names this as one of two things the task "cannot
 * produce as written", and writing a second diff in the browser is the one
 * repair that would be worse than the gap: the line diff was moved out of the
 * CLI view precisely so that one implementation serves both surfaces
 * (`src/core/revision-diff.ts` · `a second one written in the browser would be this project's` · ~12).
 *
 * So the note is rendered as the mockup draws it — the same call `decay.js`
 * makes about `dec.heatn`, a caption worth keeping when the thing it describes
 * is not built — and the discrepancy is this task's report, for the owner to
 * settle. What the reader loses is precision INSIDE a changed line, never a
 * changed line: every line of both texts is still shown.
 *
 * `<ins>` and `<del>` are the mockup's own elements and are used verbatim,
 * because the reason they are there is not decoration: *"both are real
 * {m:<ins>} and {m:<del>} elements, so a screen reader announces the change
 * without any added ARIA"*. **They carry no rule in this build**: the mockup's
 * `ins{}`/`del{}` tinting (mockup ~1001-1005) was not among the families
 * carried into `styles.css`, so both render at browser defaults — an underline
 * and a strike where the design has a tinted and a struck run. Reported, not
 * fixed here, because `styles.css` is held byte-identical by `styles-parity`.
 *
 * ── ONE COMPOSED COMMAND PER CARD, AND WHY NOT THREE ──────────────────────
 *
 * The mockup composes exactly one line — the promote, carrying `--revision`
 * (`docs/design/web-ui-mockup.html` · `mycontext review promote-revision RULE-never-log-customer-email --revision REV-8c21 --yes` · ~1952)
 * — and explains the stale case in prose instead, in the `help.land`
 * disclosure: *"If the body moved first, promote refuses and names both values
 * — that refusal is the product working, not failing"* (`work.h3`).
 *
 * Plan 2 Task 11's Step 1 instead composes THREE blocks on a stale card — a
 * discard, a `--force` promote, and a warning naming the moved fields — on six
 * keys (`work.discard`, `work.forcePromote`, `work.forceWarning`,
 * `work.itemMissing`, `work.noCurrent`, `work.stale`) that **no string table
 * declares**. The design of record draws none of them, so this screen composes
 * no `--force` at all. Both halves of that are in this task's report: the
 * plan/mockup disagreement, and the fact that a stale revision here is offered
 * only the command that will refuse.
 *
 * `--revision` is never optional. `commandFor` treats the flag as optional
 * (`src/ui/public/lib/palette-defs.js` · `flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],` · ~142),
 * so a revision that arrived without one would compose a line settling
 * whichever revision the log offers first rather than the one the human just
 * read. `revisionCommand` refuses instead, and the card shows the refusal
 * where its command would have been.
 *
 * ── WHAT IS SERVED AND NOT DRAWN ──────────────────────────────────────────
 *
 * `/api/revisions` also answers `counts.revisions`/`counts.items`, `origin`,
 * `stagedAt`, `stale`, `itemMissing` and `changedSince`, and `<section
 * data-p="work">` draws none of them — no queue count, no "proposed by X at
 * T", no card-level stale banner. Left unread rather than promoted into
 * columns the design of record does not have, which is the call `status.js`
 * already made about eight served fields on its own screen
 * (`src/ui/public/screens/status.js` · `unread rather than promoted into columns the design of record does not` · ~46).
 *
 * **`/api/review-queue` is not read by this screen at all.** The plan gives
 * Work a second half — a draft queue on `work.drafts`, `work.draftsEmpty`,
 * `work.draftMeta`, `work.promoteDraft` and `work.discardDraft` — and again no
 * table declares any of those five keys, and `<section data-p="work">` draws no
 * draft. Fetching a queue in order to drop it would be a request whose answer
 * nothing on the screen can show. The endpoint, its five missing keys and the
 * disagreement are in this task's report.
 *
 * ── EMPTY IS THE REAL MARKUP WITH ZERO ROWS ───────────────────────────────
 *
 * Nothing pending draws the card and the column heads over an empty `<tbody>`,
 * the treatment `gaps.js` states for the same situation — *"No rows is the real
 * answer … drawn as the real markup with nothing in it — never as a sentence
 * congratulating the reader, which this screen has no key for and no business
 * inventing"*
 * (`src/ui/public/screens/gaps.js` · `// No rows is the real answer to a fully scoped repository, and it is drawn as` · ~82).
 * There is no `work.empty` in either table, so there is no sentence to write.
 *
 * What the empty card omits is everything that belongs to a REVISION: the
 * `<h3>` names an item and a revision id, the `.cmd` composes a settlement for
 * one, the `.cmdstate` reports that settlement's state, and the `help.land`
 * disclosure explains how that settlement lands. With nothing pending each
 * would have to be invented, and an invented id inside a `<code>` block is the
 * one thing a copy button must never offer.
 *
 * A refusal from the endpoint is drawn INSTEAD of the card, never beside an
 * empty one: a corpus with nothing pending and a read that failed are opposite
 * facts, and an empty table would report the good one.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
// `fieldView` and `MONO_FIELDS` moved to the shared decision layer on
// 2026-08-26 so Configure and the Execute confirm can reach them too —
// plan:walk seq:46. Re-exported below, because this screen's own tests and
// the string-key scans address them through this module.
import { fieldView, MONO_FIELDS } from '/lib/viewmodel.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import {
  BOUND_CAP_TABLE, boundedList, el, errorNote, mono, screenHead, spaced,
} from '/screens/parts.js';

/**
 * The catalogue entry this screen composes from — looked up once, by name, and
 * never re-declared. A second literal `['mycontext', 'review', …]` here would
 * be a second spelling of a command whose flag set was verified against the
 * real argument parser exactly once.
 */
const PROMOTE_REVISION = PALETTE.find((def) => def.name === 'review promote-revision');


/**
 * The one line this card offers, composed and never run.
 *
 * It goes through `commandFor` + `composeCommand` like every other composed
 * write in this UI, so the quoting has a single implementation
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1)
 * and an id carrying a space is quoted before it ever reaches a clipboard.
 *
 * It THROWS rather than composing a weaker line. `--revision` is an optional
 * flag in the catalogue, so a missing `revisionId` would silently compose
 * `mycontext review promote-revision <id> --yes` — a valid command that
 * settles whichever revision the log offers first, which on a queue of two is
 * a coin toss the reader never sees. A missing `itemId` is refused by
 * `commandFor` itself, for the reason it refuses any required argument.
 */
export function revisionPlan(rev) {
  if (PROMOTE_REVISION === undefined) {
    throw new Error('work: the command catalogue declares no "review promote-revision"');
  }
  if (typeof rev.revisionId !== 'string' || rev.revisionId === '') {
    throw new Error('work: a revision with no revisionId composes no settlement — the pasted '
      + 'line must name the revision that was read, not the one the log offers first');
  }
  const values = { id: rev.itemId, revision: rev.revisionId, yes: true };
  // The argv is the CATALOGUE'S composition of these values, and the confirm
  // will show the SERVER'S composition of the same id and the same values
  // through the same `commandFor`. That is one computation rendered twice
  // rather than two that happen to agree — which is the only form in which
  // "the line you read is the line that runs" is a fact rather than a hope.
  return { id: PROMOTE_REVISION.name, values, argv: commandFor(PROMOTE_REVISION, values) };
}

/**
 * The same settlement as the string a reader sees.
 *
 * Split from `revisionPlan` because the Copy-and-Execute control takes an ARGV
 * and an id — a string cannot be executed — and a screen carrying a string
 * beside the argv as an independent value is exactly the drift the confirm
 * exists to prevent.
 */
export function revisionCommand(rev) {
  return composeCommand(revisionPlan(rev).argv);
}

/**
 * Text lines into one cell. The `<br>` between them is this file's one
 * addition to the mockup's markup: every value it samples is a single line,
 * and a body routinely is not. The alternative — newline text nodes — collapses
 * to spaces in HTML and would run five changed lines together as one sentence.
 */
function appendLines(parent, lines) {
  lines.forEach((text, index) => {
    if (index > 0) parent.append(el('br'));
    parent.append(document.createTextNode(text));
  });
}

/** The same, for diff runs: `-` struck, `+` tinted, context plain. */
function appendRuns(parent, runs) {
  runs.forEach((run, index) => {
    if (index > 0) parent.append(el('br'));
    if (run.mark === '-') parent.append(el('del', null, run.text));
    else if (run.mark === '+') parent.append(el('ins', null, run.text));
    else parent.append(document.createTextNode(run.text));
  });
}

/**
 * A value cell. `.m` puts the run's direction on the CELL, exactly as the
 * mockup writes it; prose wraps a `<bdi>` inside a bare `<td>` instead, which
 * isolates the value's direction from the sentence around it without claiming
 * it is monospace data.
 */
function valueCell(isMono, fill) {
  if (isMono) {
    const cell = el('td', 'm');
    fill(cell);
    return cell;
  }
  const cell = el('td');
  const isolated = el('bdi');
  fill(isolated);
  cell.append(isolated);
  return cell;
}

/**
 * One row of the diff table — and, for a stale field, a DIFFERENT row. See
 * this file's header for why the two value cells are replaced rather than
 * annotated.
 *
 * The chip's text is the literal `stale`, not a key: the design of record
 * gives it no `data-t`, and adding one would fail `strings-parity` in the
 * direction that names it — a key in a table that the mockup does not declare.
 * The same asymmetry `doctor.js` transcribes for its `error`/`warning` card
 * headings, and the same open question with it: the word stays English in the
 * Hebrew UI. `data-g` is the mockup's attribute and is set for fidelity; the
 * glyph itself comes from `.chip.warn::before`, so it is written once, in CSS.
 */
function fieldRow(ctx, view) {
  const row = el('tr');

  if (view.stale) {
    const name = el('td', 'm stale', `${view.field} `);
    const chip = el('span', 'chip warn', 'stale');
    chip.dataset.g = '▲';
    name.append(chip);
    const moved = el('td', 'small');
    moved.append(...ctx.t('work.moved'));
    const blocked = el('td', 'small');
    blocked.append(...ctx.t('work.blocked'));
    row.append(name, moved, blocked);
    return row;
  }

  const current = view.current.length === 0
    ? el('td', 'small', '—')
    : valueCell(view.mono, (into) => appendLines(into, view.current));
  const proposed = valueCell(view.mono, (into) => appendRuns(into, view.proposed));
  row.append(el('td', 'm', view.field), current, proposed);
  return row;
}

/**
 * `<table><thead>…</thead><tbody>` — the three column heads and the body the
 * caller fills. Returned as a pair because the empty card draws the same head
 * over no rows at all, and a second spelling of three `<th>`s is how the two
 * cases come to disagree about their own columns.
 */
function diffTable(ctx) {
  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['work.field', 'work.now', 'work.prop']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = el('tbody');
  table.append(thead, tbody);
  return { table, tbody };
}

/**
 * `<div class="cmd"><code>…</code></div>` followed by the ONE Copy-and-Execute
 * control.
 *
 * **The hand-rolled Copy button is gone**, and with it the "Copied"/"Copy
 * failed" pair this file recorded owing the mockup: it was one of nine copy
 * buttons across `screens/`, and adding Execute nine times would have been nine
 * chances to get the confirm wrong — the confirm being the security boundary.
 *
 * **`review promote-revision` IS in the catalogue, so this screen passes its
 * real id and the control offers Execute.** It is on the approval boundary, so
 * §3.2 gives it the stronger confirm; `COMMAND_EFFECTS` does not yet know what
 * a revision promotion changes field by field, so today that confirm declines
 * rather than weakening — *"a command whose effect cannot be shown that way
 * does not get a weaker confirm; it does not run"*. Passing a null id to hide
 * the button instead was weighed and refused: it would make this line look like
 * `procedure done`, which is outside the catalogue for a completely different
 * reason, and it would hide the one place the product says why it declines.
 *
 * The control is a SIBLING of `.cmd` and the pair is a fragment, not a wrapping
 * `<div>`: `.cmdactions button` carries its own background so the control does
 * not depend on which container it lands in, and a classless container is the
 * other half of the defect that left the Composer's read button rendering as
 * light text on the user agent's near-white button face.
 */
function commandRow(ctx, plan) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(plan.argv)));
  block.append(box, commandActions({
    argv: plan.argv, id: plan.id, values: plan.values, ctx,
  }));
  return block;
}

/**
 * `<div class="cmdstate">` — the armed chip and its sentence.
 *
 * **Drawn unconditionally, as the design of record draws it, and that is an
 * open question rather than a settled reading.** `work.state` is *"copied, not
 * yet observed landing"*, which describes the state AFTER a copy; the mockup
 * shows it beside a command nobody has copied yet, because a mockup shows one
 * state of every widget it carries. `state.armed` is the only `state.*` key
 * either table declares and `.cmdstate` has exactly one use in the whole design
 * of record, so there is no second state to swap to and no key with which to
 * say "not yet copied". Raised in this task's report.
 */
function commandState(ctx) {
  const box = el('div', 'cmdstate');
  const chip = el('span', 'chip warn');
  chip.dataset.g = '▲';
  chip.append(...ctx.t('state.armed'));
  const note = el('span', 'small');
  note.append(...ctx.t('work.state'));
  box.append(chip, note);
  return box;
}

/**
 * `<details class="help"><summary>…<div class="helpbox">` — the mockup's own
 * disclosure widget, here carrying the three sentences that say how a paste is
 * known to have landed: run it yourself, look for the `promote-revision` audit
 * record, and read a refusal as the product working.
 *
 * The mockup bolds the opening run of each — `<b>Run it in your own shell.</b>`
 * — and no string table can carry that: `lib/i18n.js`'s run grammar has three
 * markers (`{m:}`, `{mv:}`, `{name}`) and no emphasis marker. Identical in kind
 * to the bold runs already missing from watch, decay, doctor and status, and
 * tracked with them; `.helpbox b` even has a rule in `styles.css` waiting for
 * one.
 */
function landingHelp(ctx) {
  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.land'));
  const box = el('div', 'helpbox');
  for (const key of ['work.h1', 'work.h2', 'work.h3']) {
    const line = el('span');
    line.append(...ctx.t(key));
    box.append(line);
  }
  help.append(summary, box);
  return help;
}

/**
 * `<h3><span class="m">…</span> · <span class="m">…</span></h3>` — the item and
 * the revision, both as plain `.m` runs. NOT `linkId`: the mockup writes
 * `<span class="m">` on this heading where it writes `button.linkid` elsewhere,
 * and a button opening the item detail pane would be a control the design of
 * record does not put here.
 */
function revisionHead(rev) {
  const head = el('h3');
  head.append(mono(rev.itemId), ' · ', mono(rev.revisionId));
  return head;
}

function revisionCard(ctx, rev) {
  const card = el('div', 'card pane');
  const { table, tbody } = diffTable(ctx);
  for (const field of rev.fields) tbody.append(fieldRow(ctx, fieldView(field)));

  const note = el('p', 'small');
  note.append(...ctx.t('work.diffn'));
  card.append(revisionHead(rev), table, spaced(note));

  // A revision that cannot be settled still shows its diff — reading it is the
  // point — with the refusal standing where the command would have been.
  // Losing the whole card to one missing field would drop its reviewable half.
  let plan;
  try {
    plan = revisionPlan(rev);
  } catch (error) {
    card.append(errorNote(error.message));
    return card;
  }
  card.append(commandRow(ctx, plan), commandState(ctx), landingHelp(ctx));
  return card;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'work.h', 'work.v', 'work.sub');

  let data;
  try {
    data = await ctx.api('/api/revisions');
  } catch (error) {
    root.append(errorNote(error.message));
    return;
  }

  const revisions = Array.isArray(data.revisions) ? data.revisions : [];
  if (revisions.length === 0) {
    // The column heads over an empty body — see this file's header. Nothing is
    // worded in the empty case, because no table declares a sentence for it.
    const card = el('div', 'card pane');
    const { table } = diffTable(ctx);
    const note = el('p', 'small');
    note.append(...ctx.t('work.diffn'));
    card.append(table, spaced(note));
    root.append(card);
    return;
  }

  // **A record: the revision log stamps each staging**, so the queue bounds by
  // time. `take: 'last'` because that log is append-only — the newest
  // revisions sit at its end. The stack keeps the log's own order, so a reader
  // who knows the queue does not find it reversed under them.
  const stack = el('div');
  const bound = boundedList(ctx, stack, revisions, (rev) => revisionCard(ctx, rev),
    { cap: BOUND_CAP_TABLE, order: 'recent', take: 'last' });
  root.append(stack, bound);
}

export { fieldView, MONO_FIELDS };
