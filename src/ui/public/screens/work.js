/**
 * `nav.ch` — **Review queue**, `<section data-p="work">` in the design of
 * record. TWO queues, each a stack of cards, and on every card the human takes
 * ONE decision — Accept or Reject — before anything is offered to run.
 *
 * `work.v` states the bargain the screen exists to keep — *"the diff is the
 * capability; the approval is a paste"*. The diff is what a terminal cannot
 * lay out side by side; the approval is ONE LINE, composed here and run behind
 * the one Copy-and-Execute control.
 *
 * ── THE OWNER'S RULING OF 2026-08-29, WHICH IS THIS FILE'S SHAPE ──────────
 *
 * *"review queue has only execute option but first user should accept or
 * reject only then execute."*
 *
 * What shipped composed exactly ONE outcome — `review promote-revision` — and
 * drew it on the revision queue alone. The CLI has FOUR settlements, two per
 * queue (`mycontext review` · `usage:` · promote / discard /
 * promote-revision / discard-revision), so a reader could accept a revision,
 * could not reject anything, and could reach neither half of the draft queue.
 * That was not a missing button; it was a screen that could only ever say yes.
 *
 * So every card now carries a two-button `.segbar` — **Accept** and **Reject**
 * — and the choice is what COMPOSES the line. The composed line, the sentence
 * saying what it will do, the audit op named in `help.land`, and the argv the
 * Execute confirm rebuilds all move together, because they are all derived
 * from the one `verdict` the reader picked. There is no state in which the
 * `<code>` says one thing and the button runs another.
 *
 * **Execute stays the single approval boundary.** Accept and Reject write
 * nothing on their own — they choose, and `commandActions` still owns the
 * confirm, the nonce and the run. That is deliberately NOT the same decision as
 * "should a click promote", which is the owner's to take and has not been
 * taken.
 *
 * **Accept is the opening selection rather than an empty one**, and that is a
 * measured constraint rather than a preference. `e2e/screen-parity.spec.ts`
 * holds `work: []` — an EXACT ledger that may only shrink — and the mockup's
 * work section draws `div.cmd`, `code`, `div.cmdstate` and a `button`. A card
 * that composed nothing until a reader clicked would withdraw all four from the
 * screen's opening state and need four NEW ledger entries, which that file
 * forbids outright. So the opening state is the design of record's own line —
 * the promote, byte for byte, which `test/ui/work-screen.test.ts` still pins
 * against the mockup's `<code>` — with `aria-pressed` saying which of the two
 * is selected and the other one click away. Recorded here rather than left as
 * an inference, because it is the one place this screen's behaviour is decided
 * by a test rather than by a reading.
 *
 * ── THE DRAFT QUEUE, WHICH WAS THE OTHER HALF AND WAS NEVER BUILT ────────
 *
 * `/api/review-queue` has been served since plan 2 and was read by nothing.
 * Measured on the live corpus on 2026-08-29: `mycontext review revisions` → 0
 * pending; `mycontext review list` → 1 draft pending. The screen built to show
 * what is waiting for a human drew an empty table and never mentioned the one
 * thing that was waiting.
 *
 * It is drawn now, in the same shape as a revision: one card, an id, what kind
 * of thing it is, the two outcomes, the composed line. What a draft card does
 * NOT have is a diff — a draft is not a proposal against a text in force, it is
 * a whole item that does not govern yet — and inventing a two-column table for
 * it would be drawing a comparison nobody made.
 *
 * ── A MEASURED ZERO IS DRAWN AND NAMED ───────────────────────────────────
 *
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` (hard,
 * active): *"a measured zero is drawn and named … neither is ever rendered as
 * blank."* Both queues carry a headline sentence, and both carry a second one
 * for the zero — `work.draftsEmpty`, `work.revisionsEmpty`. The empty revision
 * card keeps the column heads over an empty `<tbody>`, which is
 * `screens/gaps.js`' treatment and still right, but it no longer stands alone:
 * the heads on their own are exactly the blank that standard forbids.
 *
 * The two queues are fetched INDEPENDENTLY and each draws its own refusal. A
 * single `try` around both would let one endpoint's failure erase the other
 * queue's contents, which is the same "an empty table reports the good one"
 * mistake one level up.
 *
 * ── PER-FIELD STALENESS, WHICH IS THE ROW SHAPE AND NOT A BADGE ───────────
 *
 * `/api/revisions` decorates every field with `changed` — "a human has moved
 * this very text since the proposal was staged"
 * (`ui/read-model-work.ts` · `changed: rev.changedSince.includes(field),` · ~64).
 * The design of record does not draw that as an annotation beside a diff. It
 * REPLACES the row's two value cells: the field name takes `td.m.stale`, which
 * carries a rule down its reading-start edge, and the two cells become
 * `work.moved` / `work.blocked`
 * (`docs/design/web-ui-mockup.html` · `<td class="m stale">body <span class="chip warn" data-g="▲">stale</span></td>` · ~3286).
 *
 * That is the honest shape, not a shorter one. A stale field's proposed text
 * was written against a version that no longer exists, so drawing it against
 * the CURRENT text would show a comparison nobody ever made.
 *
 * **What Reject changes about a stale card, and it is the point.** This file
 * used to record that "a stale revision here is offered only the command that
 * will refuse" — promote refuses on a moved field, and promote was the only
 * line the screen could compose. It is no longer the only one: `review
 * discard-revision` settles a stale proposal perfectly well, and it is now one
 * click away on the card that needs it most. The `--force` promote the plan
 * wanted is still not composed, and still deliberately: the design of record
 * draws no key for it and forcing a rewrite over text a human has since changed
 * is not a decision a review screen should be able to take by accident.
 *
 * ── THE DIFF IS LINE-LEVEL, AND `work.diffn` NOW SAYS SO ──────────────────
 *
 * **Resolved by owner ruling, 2026-09-04** (`plan:rulings seq:49`,
 * `TASK-two-source-comments-are-wrong-work-diffn-and-the-15-minute`). This used
 * to record the gap as open — `work.diffn` promised *"a word-level diff"* while
 * `lineDiff` is a line-level LCS and there is no word-level diff anywhere in
 * `src/`. The ruling was to reword the sentence rather than build a second
 * diff: writing one in the browser would be the one repair worse than the gap,
 * since the line diff was moved out of the CLI view precisely so that one
 * implementation serves both surfaces
 * (`src/core/revision-diff.ts` · `a second one written in the browser would be this project's` · ~12).
 * `work.diffn` now says *"line-level"* in both tables, and nothing here composes
 * a second comparison.
 *
 * `<ins>` and `<del>` are the mockup's own elements and are used verbatim,
 * because the reason they are there is not decoration: *"both are real
 * {m:<ins>} and {m:<del>} elements, so a screen reader announces the change
 * without any added ARIA"*.
 *
 * ── ONE COMPOSED COMMAND PER CARD, AND WHY IT CARRIES `--revision` ────────
 *
 * `--revision` is never optional here. `commandFor` treats the flag as optional
 * (`src/ui/public/lib/palette-defs.js` · `flags: [{ name: 'revision', input: 'text' }, { name: 'force', boolean: true }, yes],` · ~449),
 * so a revision that arrived without one would compose a line settling
 * whichever revision the log offers first rather than the one the human just
 * read — and that is as true of the discard as of the promote, which is why the
 * guard sits in `revisionPlan` above the verdict rather than beside one of
 * them. `revisionPlan` refuses instead, and the card shows the refusal where
 * its command would have been.
 *
 * ── WHAT IS SERVED AND STILL NOT DRAWN ───────────────────────────────────
 *
 * `/api/revisions` also answers `counts`, `origin`, `stagedAt`, `stale`,
 * `itemMissing` and `changedSince`, and `/api/review-queue` answers `always`,
 * `scope`, `injected`, `phrase` and `gate`. None is drawn: the design of record
 * has no column for them, and the call `status.js` already made about eight
 * served fields on its own screen governs these too
 * (`src/ui/public/screens/status.js` · `Left unread rather than promoted into columns` · ~52).
 * They are named in this task's report rather than promoted into columns
 * nobody asked for.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
// `fieldView` and `MONO_FIELDS` moved to the shared decision layer on
// 2026-08-26 so Configure and the Execute confirm can reach them too —
// plan:walk seq:46. Re-exported below, because this screen's own tests and
// the string-key scans address them through this module.
import { fieldView, MONO_FIELDS } from '/lib/viewmodel.js';
import { helpDisclosure } from '/lib/disclosure.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import {
  BOUND_CAP_LIST, BOUND_CAP_TABLE, boundedList, el, errorNote, mono, screenHead, spaced,
} from '/screens/parts.js';

/**
 * **The four settlements, as a table of catalogue NAMES.**
 *
 * Two queues times two verdicts, and the CLI spells all four
 * (`mycontext review` · its usage block). Written as names looked up in
 * `PALETTE` rather than as four literal `['mycontext', 'review', …]` arrays: a
 * second spelling of a command whose flag set was verified against the real
 * argument parser exactly once is how the two come to disagree.
 *
 * `op` is the audit verb the run will record, and it is here rather than
 * derived from the name because `help.land` promises the reader a specific
 * `op:` to look for and a promise about the audit log has to be spelled beside
 * the command that produces it.
 */
const SETTLEMENT = {
  draft: {
    accept: { command: 'review promote', op: 'promote' },
    reject: { command: 'review discard', op: 'discard' },
  },
  revision: {
    accept: { command: 'review promote-revision', op: 'promote-revision' },
    reject: { command: 'review discard-revision', op: 'discard-revision' },
  },
};

/** The two verdicts, in reading order. */
const VERDICTS = ['accept', 'reject'];

/**
 * Every keyed sentence this screen looks up by VERDICT, as a THUNK.
 *
 * A lookup returning a key string would read better and would be invisible to
 * `test/ui/work-screen.test.ts`'s scanner, which finds the keys a screen names
 * by matching a literal `t(` call against this file's own bytes. A key reachable only
 * through a variable is a key that test cannot prove is declared in both
 * tables — and a key missing from the Hebrew table throws at render time, in
 * Hebrew only, which is the failure nobody sees until a reader reports a blank
 * screen. So every call site is literal.
 */
const LABEL = {
  accept: (ctx) => ctx.t('work.accept'),
  reject: (ctx) => ctx.t('work.reject'),
};

/** The sentence saying what the chosen verdict will do, per queue. */
const OUTCOME = {
  draft: {
    accept: (ctx) => ctx.t('work.promoteDraft'),
    reject: (ctx) => ctx.t('work.discardDraft'),
  },
  revision: {
    accept: (ctx) => ctx.t('work.promoteRev'),
    reject: (ctx) => ctx.t('work.discardRev'),
  },
};

/** The catalogue entry by name, or a refusal that names what is missing. */
function settlementDef(name) {
  const def = PALETTE.find((entry) => entry.name === name);
  if (def === undefined) {
    throw new Error(`work: the command catalogue declares no "${name}"`);
  }
  return def;
}

/**
 * The line one verdict on one staged REVISION composes, and never runs.
 *
 * It goes through `commandFor` + `composeCommand` like every other composed
 * write in this UI, so the quoting has a single implementation
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1)
 * and an id carrying a space is quoted before it ever reaches a clipboard.
 *
 * It THROWS rather than composing a weaker line. `--revision` is an optional
 * flag in the catalogue for BOTH revision verbs, so a missing `revisionId`
 * would silently compose a valid command that settles whichever revision the
 * log offers first — a coin toss the reader never sees, and one that discards
 * as easily as it promotes. A missing `itemId` is refused by `commandFor`
 * itself, for the reason it refuses any required argument.
 */
export function revisionPlan(rev, verdict = 'accept') {
  const def = settlementDef(SETTLEMENT.revision[verdict].command);
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
  return { id: def.name, values, argv: commandFor(def, values) };
}

/**
 * The same, for a DRAFT — `review promote <id> --yes` or
 * `review discard <id> --yes`.
 *
 * No `--scope`, no `--severity`, no `--always`. `review promote` accepts all
 * three and this screen composes none of them: they change what the item WILL
 * say, which is an edit wearing a promotion's clothes, and a queue whose job is
 * to settle what a person already wrote is the wrong place to rewrite it. The
 * reader who wants them has the composed line and the Composer.
 */
export function draftPlan(draft, verdict = 'accept') {
  const def = settlementDef(SETTLEMENT.draft[verdict].command);
  const values = { id: draft.id, yes: true };
  return { id: def.name, values, argv: commandFor(def, values) };
}

/**
 * The same settlement as the string a reader sees.
 *
 * Split from the plans because the Copy-and-Execute control takes an ARGV and
 * an id — a string cannot be executed — and a screen carrying a string beside
 * the argv as an independent value is exactly the drift the confirm exists to
 * prevent.
 */
export function revisionCommand(rev, verdict) {
  return composeCommand(revisionPlan(rev, verdict).argv);
}

/** The same, for a draft. */
export function draftCommand(draft, verdict) {
  return composeCommand(draftPlan(draft, verdict).argv);
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
 * gives it no `data-t`. The same asymmetry `doctor.js` transcribes for its
 * `error`/`warning` card headings, and the same open question with it: the word
 * stays English in the Hebrew UI. `data-g` is the mockup's attribute and is set
 * for fidelity; the glyph itself comes from `.chip.warn::before`, so it is
 * written once, in CSS.
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
 * **All four settlements are in the catalogue, so every card passes a real id
 * and every card offers Execute.** All four are `boundary: true`, so §3.2 gives
 * them the stronger confirm, and since `plan:execute seq:5b` the effect behind
 * that confirm is DERIVED by the server running the command against a throwaway
 * copy of the corpus — which is the only mechanism that could ever have covered
 * these four, because what a promotion changes is a property of the corpus and
 * not of the argv.
 *
 * The control is a SIBLING of `.cmd` and the pair is a fragment, not a wrapping
 * `<div>`: `.cmdactions button` carries its own background so the control does
 * not depend on which container it lands in.
 */
function commandRow(ctx, plan, onCopied) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(plan.argv)));
  block.append(box, commandActions({
    argv: plan.argv, id: plan.id, values: plan.values, ctx, onCopied,
  }));
  return block;
}

/**
 * `<div class="cmdstate">` — the state of THIS card's command, which until now
 * was a sentence about a copy that had not happened.
 *
 * ── THE DEFECT, AND IT WAS THE STRING BEING TRUE OF THE WRONG MOMENT ───────
 *
 * `work.state` is *"copied, not yet observed landing"*, and it was drawn
 * unconditionally — beside a command nobody had copied, from the first paint of
 * every card. `plan:walk seq:81` reported it and could not repair it in lane:
 * `state.armed` was the only `state.*` key either table declared, so there was
 * no second state to swap to and no key with which to say the true thing. This
 * task adds the two keys and the state behind them.
 *
 * **Two states, and the FIRST one is the opening state.** Before a copy the
 * chip is `state.uncopied` on `.chip.unmeas` — the neutral face, not `--warn`'s
 * — for exactly the argument `app.js`'s own `stateChip()` records: a thing that
 * has simply not happened yet is not a warning, and a reader who learns that
 * "not copied" looks like "armed" stops being able to read either. After the
 * clipboard write RESOLVES it becomes the design of record's own `.chip.warn`
 * `▲` `state.armed` / `work.state`, byte for byte.
 *
 * **`span.chip.warn` does not leave the screen by this.** `e2e/screen-parity.spec.ts`
 * holds `work: []` — an exact ledger that may only shrink — and the mockup
 * draws that kind twice in this section: here, and on the stale field's own
 * chip, which `scripts/demo-corpus.ts` stages a revision specifically to
 * produce. The second is what keeps the kind present in the opening state.
 *
 * **The flip is driven by the clipboard promise, not by the click.** `markCopied`
 * is handed to `commandActions` as `onCopied` and is called when the write
 * settles clean. A state flipped on click would say "copied" for a write the
 * browser refused, which is the same lie one layer down from the one this task
 * exists to end.
 *
 * Returns the box and the flip together, because the caller needs both and a
 * second lookup by class is how the two come apart.
 */
function commandState(ctx) {
  const box = el('div', 'cmdstate');

  const paint = (copied) => {
    box.replaceChildren();
    // Two whole `el` calls rather than one carrying a ternary class. The class
    // scan in `test/ui/work-screen.test.ts` reads this file's bytes for a
    // literal class argument and pins the `chip warn` pair as a whole attribute
    // value; a class assembled in an expression is invisible to it. The gate is
    // right to insist — a chip that took `chip` without `warn` draws the wrong
    // thing — so the code is written where the gate can read it.
    const chip = copied ? el('span', 'chip warn') : el('span', 'chip unmeas');
    chip.dataset.g = copied ? '▲' : '◌';
    chip.append(...(copied ? ctx.t('state.armed') : ctx.t('state.uncopied')));
    const note = el('span', 'small');
    note.append(...(copied ? ctx.t('work.state') : ctx.t('work.uncopied')));
    box.append(chip, note);
  };

  paint(false);
  return { box, markCopied: () => paint(true) };
}

/**
 * `<details class="help"><summary>…<div class="helpbox">` — the mockup's own
 * disclosure widget, carrying the sentences that say how a paste is known to
 * have landed: run it yourself, and look for the audit record.
 *
 * **Built through `lib/disclosure.js`'s `helpDisclosure`, not hand-built.**
 * This was the fourth hand-rolled `<details class="help">…</details>` in
 * `screens/` — `coverage.js`, `decay.js` and `doctor.js` had already moved
 * onto the one shared component (`lib/disclosure.js` · "Four call sites, one
 * shape, never factored" · ~15) — and a second shape for the same `?` is
 * exactly the defect that factoring exists to end. Nothing about the markup
 * changes: `helpDisclosure` builds the identical
 * `<details class="help"><summary>…</summary><div class="helpbox">…</div></details>`.
 *
 * **`work.h2` names the op the CHOSEN verdict will write, not a fixed one.** It
 * used to spell `op: promote-revision` as a literal, which was true of the only
 * command this screen could compose and became false the moment there were
 * four. A receipt sentence naming the wrong verb is worse than no receipt
 * sentence: it sends a reader to `mycontext audit --op promote-revision` to
 * look for a discard that is not there, and they conclude the run failed.
 *
 * `work.h3` is drawn on a REVISION card only. It is about promote refusing over
 * a moved field, which is a fact about the revision queue; a draft has no text
 * in force to have moved.
 *
 * The mockup bolds the opening run of each — `<b>Run it in your own shell.</b>`
 * — and `lib/i18n.js`'s `{b:}` marker carries that now.
 */
function landingHelp(ctx, kind, spec) {
  const first = el('span');
  first.append(...ctx.t('work.h1'));
  const receipt = el('span');
  receipt.append(...ctx.t('work.h2', { op: spec.op }));
  const body = [first, receipt];

  if (kind === 'revision') {
    const refusal = el('span');
    refusal.append(...ctx.t('work.h3'));
    body.push(refusal);
  }
  return helpDisclosure(ctx, 'help.land', body);
}

/**
 * **The decision, and everything downstream of it.**
 *
 * `<div class="segbar">` with two `<button aria-pressed>` is the house's own
 * two-state picker — `styles.css` gives `.segbar button[aria-pressed="true"]`
 * the gold selected face, which is the sheet's one existing vocabulary for "one
 * of these is chosen". The design of record has no visual for Reject at all
 * (it composes a single promote and explains everything else in prose), so this
 * is a choice made here rather than transcribed, and it is made by reusing a
 * shape the stylesheet already ships instead of inventing a class nothing
 * styles.
 *
 * `role="group"` with `aria-label` names the pair, because two buttons whose
 * meaning is "which of us is selected" are a group and not two unrelated
 * controls. `aria-pressed` rather than `aria-checked`: these are toggle
 * buttons, not radios in a form, and `.segbar`'s own rule keys off `pressed`.
 *
 * **`body` is rebuilt on every press, not patched.** The composed line, the
 * outcome sentence, the audit op and the whole Copy-and-Execute control — nonce
 * handler, confirm and result region included — all belong to ONE verdict.
 * Rewriting the `<code>` in place and leaving the control alone is precisely
 * the "shows one command and runs another" defect the confirm exists to
 * prevent, arriving from the other side. Replacing the subtree also discards
 * any confirm the previous verdict had opened, which is the correct answer to
 * "I changed my mind while a dialog was up".
 *
 * `plan` is built INSIDE the repaint and inside a `try`: a card that cannot
 * compose one verdict can usually still compose the other, and losing the whole
 * card — its diff, which is the thing worth reading — to one missing field
 * would drop its reviewable half.
 */
function settlementBlock(ctx, kind, planFor) {
  const block = document.createDocumentFragment();
  const bar = el('div', 'segbar');
  bar.setAttribute('role', 'group');
  bar.setAttribute('aria-label', ctx.tFlat('work.outcome'));
  const body = el('div');
  const buttons = [];
  let chosen = 'accept';

  const paint = () => {
    for (const [verdict, button] of buttons) {
      button.setAttribute('aria-pressed', String(verdict === chosen));
    }
    const spec = SETTLEMENT[kind][chosen];
    body.replaceChildren();
    let plan;
    try {
      plan = planFor(chosen);
    } catch (error) {
      body.append(errorNote(error.message));
      return;
    }
    const outcome = el('p', 'small');
    outcome.append(...OUTCOME[kind][chosen](ctx));
    // Built before the command row so the row can be handed the flip. Both
    // belong to ONE verdict and are discarded together on the next press —
    // a `.cmdstate` reading "copied" above a line the reader has just changed
    // would be the screen saying one thing and running another, arriving from
    // the side the confirm does not guard.
    const state = commandState(ctx);
    body.append(
      spaced(outcome), commandRow(ctx, plan, state.markCopied), state.box,
      landingHelp(ctx, kind, spec),
    );
  };

  for (const verdict of VERDICTS) {
    const button = el('button');
    button.type = 'button';
    // Read by `e2e/` to press one verdict without depending on its WORDING,
    // which changes with the reader's language. The same reason `parts.js`
    // stamps `data-step` on its two paging controls.
    button.dataset.verdict = verdict;
    button.append(...LABEL[verdict](ctx));
    button.addEventListener('click', () => {
      if (chosen === verdict) return;
      chosen = verdict;
      paint();
    });
    buttons.push([verdict, button]);
    bar.append(button);
  }

  paint();
  block.append(bar, body);
  return block;
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
  // Which queue a card belongs to, for a reader of the DOM rather than of the
  // screen: `e2e/execute.spec.ts` presses Execute on "the Review queue's"
  // control, and with two queues on one screen `.cmdactions` first() is no
  // longer an unambiguous way to name one.
  card.dataset.queue = 'revision';
  const { table, tbody } = diffTable(ctx);
  for (const field of rev.fields) tbody.append(fieldRow(ctx, fieldView(field)));

  const note = el('p', 'small');
  note.append(...ctx.t('work.diffn'));
  card.append(revisionHead(rev), table, spaced(note));
  card.append(settlementBlock(ctx, 'revision', (verdict) => revisionPlan(rev, verdict)));
  return card;
}

/**
 * One pending draft: what it is, what it says, and the two ways to settle it.
 *
 * No diff table. A draft is not a proposal against a text in force — it is a
 * whole item that does not govern yet — so there is no "In force" column to
 * fill, and drawing three heads over an em dash would state a comparison that
 * was never made. What stands in its place is the title, which is the thing a
 * person actually decides on, isolated in a `<bdi>` because it is authored text
 * and may be in either direction.
 */
function draftCard(ctx, draft) {
  const card = el('div', 'card pane');
  card.dataset.queue = 'draft';

  const head = el('h3');
  head.append(mono(draft.id));
  card.append(head);

  const title = el('p');
  const isolated = el('bdi');
  isolated.textContent = typeof draft.title === 'string' ? draft.title : '';
  title.append(isolated);
  card.append(title);

  const meta = el('p', 'small');
  meta.append(...ctx.t('work.draftMeta', {
    type: draft.type ?? '—', severity: draft.severity ?? '—', origin: draft.origin ?? '—',
  }));
  card.append(spaced(meta));

  card.append(settlementBlock(ctx, 'draft', (verdict) => draftPlan(draft, verdict)));
  return card;
}

/** A queue's headline sentence — the count, or the named zero. */
function queueLine(ctx, nodes) {
  const line = el('p', 'small');
  line.append(...nodes);
  return spaced(line);
}

/**
 * The draft half. Its own fetch and its own refusal, so a failure here cannot
 * erase the revision queue below it.
 */
async function drawDrafts(root, ctx) {
  let data;
  try {
    data = await ctx.api('/api/review-queue');
  } catch (error) {
    // The refusal, and NO headline sentence. Both `work.drafts` and
    // `work.draftsEmpty` state a measured count, and a read that failed has
    // measured nothing — clause 2 of `STD-a-measured-zero-is-drawn`: an
    // unmeasured thing is named as unmeasured, never rendered as a zero. The
    // error note is that naming.
    root.append(errorNote(error.message));
    return;
  }
  const drafts = Array.isArray(data.drafts) ? data.drafts : [];
  if (drafts.length === 0) {
    root.append(queueLine(ctx, ctx.t('work.draftsEmpty')));
    return;
  }
  root.append(queueLine(ctx, ctx.t('work.drafts', { n: String(drafts.length) })));
  const stack = el('div');
  // `order: 'position'` — the review queue is the STORE'S order, which is a
  // property of the corpus and not a time series. `'recent'` would promise a
  // newest-first reading this answer does not carry, which is the claim
  // `parts.js` added that fourth order key to stop screens making.
  const bound = boundedList(ctx, stack, drafts, (draft) => draftCard(ctx, draft),
    { cap: BOUND_CAP_LIST, order: 'position' });
  root.append(stack, bound);
}

/**
 * The revision half — unchanged in shape, and now introduced by a sentence
 * that says how many are waiting.
 */
async function drawRevisions(root, ctx) {
  let data;
  try {
    data = await ctx.api('/api/revisions');
  } catch (error) {
    // No headline, for the reason `drawDrafts` states: a failed read has
    // measured nothing, and both headline keys claim a count.
    root.append(errorNote(error.message));
    return;
  }

  const revisions = Array.isArray(data.revisions) ? data.revisions : [];
  if (revisions.length === 0) {
    // The column heads over an empty body — `screens/gaps.js`' treatment, and
    // still right — but no longer on their own. `STD-a-measured-zero-is-drawn`
    // is what the bare heads were failing: a table with no rows and no sentence
    // is indistinguishable from a table that failed to load.
    root.append(queueLine(ctx, ctx.t('work.revisionsEmpty')));
    const card = el('div', 'card pane');
    card.dataset.queue = 'revision';
    const { table } = diffTable(ctx);
    const note = el('p', 'small');
    note.append(...ctx.t('work.diffn'));
    card.append(table, spaced(note));
    root.append(card);
    return;
  }

  root.append(queueLine(ctx, ctx.t('work.revisions', { n: String(revisions.length) })));
  // **A record: the revision log stamps each staging**, so the queue bounds by
  // time. `take: 'last'` because that log is append-only — the newest
  // revisions sit at its end. The stack keeps the log's own order, so a reader
  // who knows the queue does not find it reversed under them.
  const stack = el('div');
  const bound = boundedList(ctx, stack, revisions, (rev) => revisionCard(ctx, rev),
    { cap: BOUND_CAP_TABLE, order: 'recent', take: 'last' });
  root.append(stack, bound);
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'work.h', 'work.v', 'work.sub');
  // Drafts first: it is the queue `mycontext review` shows by default, and the
  // one the owner's report was about — a screen whose first card is the thing
  // waiting for a decision. Sequential rather than `Promise.all` so the two
  // sections land in a fixed order however the two fetches race.
  await drawDrafts(root, ctx);
  await drawRevisions(root, ctx);
}

export { fieldView, MONO_FIELDS };
