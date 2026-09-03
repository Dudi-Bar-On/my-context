// src/ui/public/lib/command-actions.js
//
// **One control carrying Copy and Execute, for every screen that composes a
// command.** Spec `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md`
// §3.2, §3.3, §6.1 and §6.3; plan `2026-08-27-execute-a-composed-command.md`
// Task 6.
//
// ── WHY ONE CONTROL, AND WHY IT WAS BUILT BEFORE ANYTHING ADOPTED IT ───────
//
// Measured 2026-08-27: NINE `navigator.clipboard.writeText` sites across
// `screens/`, each with its own button, its own error handling and its own
// words. Adding Execute nine times would be nine chances to get the confirm
// wrong — and **the confirm IS the security boundary**. §6.3 says so in those
// terms: the loopback gate proves a request came from a browser on this
// machine and never that a person asked, so the rendered confirm plus the
// single-use nonce minted by the GET that rendered it are the only things
// between a silent local page and a corpus mutation. One spelling of that, in
// one file, adopted everywhere.
//
// ── WHAT THIS FILE MAY NOT DO ─────────────────────────────────────────────
//
// **Elements are BUILT, never assigned as markup.** Assigning markup destroys
// the `.m` spans that carry `unicode-bidi:isolate`, and the server ships
// `style-src 'self'` with no `'unsafe-inline'`, so an inline style attribute is
// refused outright. Everything below goes through `createElement`, and any
// dynamic declaration would go through CSSOM.
//
// The forbidden property names are deliberately NOT spelled here.
// `test/ui/command-actions.test.ts` scans these bytes for them, and a scanner
// defeated by a file that names what the scanner looks for is the mistake
// `faint-usage.test.ts` records making on its own first run.
//
// **It composes nothing and it resolves nothing.** The argv a person reads in
// the confirm is the SERVER'S — `answer.argv`, rebuilt from the catalogue the
// browser composed from, and the argv the nonce is bound to. Rendering the
// client's own composition instead would show one command and run another,
// which is the exact defect the confirm exists to prevent.
//
// ── WHY IT LIVES IN `lib/` AND STILL REACHES `screens/parts.js` ────────────
//
// The plan placed it here because seven screens adopt it and none of them owns
// it. That makes it the one DOM builder in this directory, and it imports
// `el`/`errorNote` from `../screens/parts.js` rather than growing a second `el`
// — a second spelling of the mockup's own factory is how two surfaces come to
// disagree about what a refusal looks like. The import is RELATIVE, like
// `viewmodel.js`'s own `./command.js`, which is the form this directory already
// uses and the only one that resolves identically in a browser, in Node from a
// file URL, and inside a `data:` module.
//
// It is deliberately NOT part of the composing closure `test/ui/palette-lib.test.ts`
// scans: that closure starts at `command.js` and `palette-defs.js` and follows
// imports FORWARD, and its claim — "a module that composes commands may not
// also be able to run one" — is unchanged by a module that imports the composer
// in order to run what it composed. This file is where running lives, and it is
// the only one.
import { composeCommand } from './command.js';
import { fieldView } from './viewmodel.js';
import { el, errorNote, boundedList, BOUND_CAP_LIST } from '../screens/parts.js';

/**
 * The query parameter that carries an ARGUMENT named `id`.
 *
 * `?id=` is already spoken for on the confirm route: it names the catalogue
 * entry, while `pin`, `show`, `edit` and eleven others take an argument that is
 * also called `id`. `src/ui/execute.ts` chose `id_arg` for the second, and this
 * is the browser half of that one decision rather than a second one.
 */
export const CONFIRM_ID_ARG = 'id_arg';

/**
 * The query parameter that carries the reader's LANGUAGE — Task 8b.
 *
 * `src/ui/execute.ts` mints one `EXECUTION_RESIDUAL` sentence per language and
 * the confirm GET answers with whichever one this parameter names, because the
 * language has to reach the SERVER rather than the sentence reaching the
 * browser: a security sentence duplicated into `strings/he.js` would be a
 * security sentence that gets reworded on one side only. `CONFIRM_LANG_ARG`
 * mirrors `src/ui/execute.ts`'s own constant by name rather than by import —
 * a browser module cannot import a `.ts` file — so the two are one decision,
 * not two.
 */
const CONFIRM_LANG_ARG = 'lang';

/**
 * **The transcribed COMMAND_EFFECTS table is gone, and that is the point of
 * plan:execute seq:5b.**
 *
 * It lived here because a browser cannot derive what a command writes — that
 * is the command's body, not its argument shape, and there is no build step
 * to import it through. So it declared the effect of five commands (pin,
 * unpin, harden, soften, edit) and every other boundary command was REFUSED a
 * confirm and therefore refused a run: add, supersede, refresh, repair,
 * lesson-accept and the four review verbs.
 *
 * The derivation moved to the server (`src/ui/execute-effect.ts`), which runs
 * the real command against a throwaway copy of the corpus and reports what
 * actually changed. That covers all nine, and it covers the two no table could
 * have expressed: `repair` re-stamps however many items are stale, and
 * `supersede` touches TWO items, recording the relation on both sides.
 *
 * Not kept as a fast path beside the derivation. Two spellings of what a
 * command writes is exactly the drift `palette-defs.js` records this repository
 * paying for four times, and the one that would go stale is the one guarding
 * the confirm.
 */

/**
 * The confirm's URL. The values go on the query string in the shape
 * `src/ui/execute.ts` reads them back — which is the SAME `resolveCommand` the
 * POST goes through, so there is exactly one place an argv is built either way.
 *
 * `lang` rides the same query string, deliberately not folded into `values`:
 * it names the READER, not an argument of the command, and `valuesFromQuery`
 * on the server excludes it from the catalogue's fields for exactly that
 * reason — a command with no declared `lang` argument must not see one arrive
 * and refuse the confirm over it. Omitted when `lang` is not a known table
 * (`undefined`, or anything that is not the string the page's own `ctx.lang`
 * holds), so a caller that has none gets the server's English default rather
 * than a query string naming a language nobody asked for.
 */
export function confirmPath(id, values, lang) {
  const query = new URLSearchParams();
  query.set('id', id);
  if (typeof lang === 'string' && lang !== '') query.set(CONFIRM_LANG_ARG, lang);
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined || value === '') continue;
    query.set(name === 'id' ? CONFIRM_ID_ARG : name, String(value));
  }
  return `/api/execute/confirm?${query.toString()}`;
}

/**
 * One field's before and after, as the served diff shape `fieldView` reads.
 *
 * The marks are all-minus-then-all-plus rather than an LCS. That is not a
 * cheaper diff — it is `lineDiff`'s OWN fallback shape, the one it returns when
 * the comparison would be too large, so the renderer already draws it. An LCS
 * lives in `src/core/revision-diff.ts` and cannot be imported here; writing a
 * second one for values that are one or two lines long would be a second
 * opinion about the same bytes for no reader's benefit.
 */
function diffFor(before, after) {
  if (before === null) return after.map((text) => ({ mark: '+', text }));
  const same = before.length === after.length && before.every((text, i) => text === after[i]);
  if (same) return before.map((text) => ({ mark: ' ', text }));
  return [
    ...before.map((text) => ({ mark: '-', text })),
    ...after.map((text) => ({ mark: '+', text })),
  ];
}

/**
 * The server's effect, in the view shape `fieldView` reads.
 *
 * **The BEFORE is still what is in force in the corpus, and this file no longer
 * establishes that.** The server dry-runs the command against a throwaway copy
 * and reports both columns, so "before" is read from the corpus the command
 * will actually touch — one read, at the moment that matters, rather than this
 * browser taking a second one that could disagree with it.
 *
 * What is left here is a mapping and nothing more. It invents no value: a
 * `before` the server did not send stays absent, because a fabricated "false"
 * would be a claim about an item nobody looked at.
 */
export function viewsFromEffect(effect) {
  return effect.map((item) => ({
    id: item.id,
    kind: item.kind,
    views: item.fields.map((change) => ({
      field: change.field,
      // `changed` is the revision queue's "moved since staging", which has no
      // meaning for a command composed a moment ago. Passed false rather than
      // omitted so the shape is the served one and `fieldView` needs no branch.
      changed: false,
      // The server says so by sending `before: null`, which it does only for an
      // item that did not exist. The browser no longer GUESSES this from a 404
      // on its own read: that read could fail for reasons that have nothing to
      // do with the item existing, and "I could not fetch it" was being drawn
      // as "there is nothing there".
      noCurrent: change.before === null,
      diff: diffFor(change.before, change.after ?? []),
    })),
  }));
}

/* -------------------------------------------------------------------------- *
 * The drawing.
 * -------------------------------------------------------------------------- */

/** Text lines into one cell, `<br>` between them — `work.js`' own treatment. */
function appendLines(parent, texts) {
  texts.forEach((text, index) => {
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
 * `<table class="diff">` — the field, what is in force, what would be.
 *
 * The three column heads are `work.field`/`work.now`/`work.prop`, reused rather
 * than re-keyed: the Review queue's diff and this one answer the same question
 * about the same corpus, and two spellings of three column heads is how they
 * come to disagree. The `<caption>` is what gives the table its accessible
 * name, which is how a screen reader announces the one region of this confirm
 * that carries the security surface.
 */
export function diffTable(ctx, views) {
  const table = el('table', 'diff');
  const caption = el('caption');
  caption.append(...ctx.t('exec.changes'));
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['work.field', 'work.now', 'work.prop']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = el('tbody');
  for (const view of views) {
    const row = el('tr');
    const current = view.current.length === 0
      ? el('td', 'small', '—')
      : valueCell(view.mono, (into) => appendLines(into, view.current));
    const proposed = valueCell(view.mono, (into) => appendRuns(into, view.proposed));
    row.append(el('td', 'm', view.field), current, proposed);
    tbody.append(row);
  }
  table.append(caption, thead, tbody);
  return table;
}

/**
 * A value cell. `.m` puts the run's direction on the CELL, exactly as the
 * design of record writes it; prose wraps a `<bdi>` inside a bare `<td>`, which
 * isolates the value's direction without claiming it is monospace data.
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
 * **Copy and Execute, together, for one composed command.**
 *
 * `argv` is the command as the screen composed it — the leading `mycontext`
 * included, because that is what a human types and what Copy hands to a shell.
 * `id` is the catalogue entry it came from, or `null` for a composition the
 * catalogue cannot name: **that one gets Copy alone**, because the client sends
 * an id and never a command (§3.1) and there is nothing for the server to
 * rebuild. `values` is the bag `commandFor` was given. `copyBlocked` is the
 * composing screen's own refusal — the Composer blocks a copy whose argument
 * carries `$(…)` — and it disables COPY only, deliberately: a paste reaches a
 * shell, where the substitution is live, while an execution reaches `execFile`
 * with an argv array, where it is an ordinary literal.
 *
 * **`onCopied` is called when the clipboard write RESOLVES, and never on the
 * click.** A screen drawing a state beside this control — `work.js`'s
 * `.cmdstate` is the one — has to learn that a copy actually happened, and the
 * only honest moment to learn it is the settlement of the promise. A click is
 * a proxy for a copy: the write can be refused by permissions, by a page that
 * is not focused, or by a browser with no clipboard at all, and a state
 * flipped on click would say "copied" for every one of those.
 */
export function commandActions({ argv, id, values = {}, ctx, copyBlocked = false, onCopied }) {
  const root = el('div', 'cmdactions');
  const composed = composeCommand(argv);

  /**
   * **THE CONTROL'S OWN IDENTITY, so the outcome of a run can be put back ON
   * THE ROW IT WAS RUN FROM after the redraw that run causes.**
   *
   * Measured in Chrome on 2026-09-03, on a Doctor pane 4,000px tall carrying
   * 820 of these controls: press Execute, confirm, "Run it", and the run works
   * end to end — `POST /api/execute` answers 200 with `exitCode: 0` — while the
   * one piece of feedback the product gives lands at `top: -3974px`,
   * `inView: false`, and is still there fourteen seconds later. `app.js`'s
   * `attachExecuteOutcome` was doing `section.prepend(...)`, which is the top of
   * a screen the reader is nowhere near, and the page's scroller is an INNER
   * container so `window.scrollY` never moved off 0 to say so.
   *
   * The CONFIRM had this right all along: it renders inline, in the row, where
   * the button that opened it is. The outcome is the answer to the question
   * that confirm asked and belongs in the same place. It could not GET back
   * there because the redraw discards the node the outcome sits in and builds a
   * fresh, anonymous one, so the shell had nothing to aim at.
   *
   * This is that aim. The composed line is the key because it is already this
   * product's identity for a control — `screens/doctor.js`'s `cardCommands`
   * dedupes its shared repair blocks by exactly this string, for exactly the
   * reason that two rows about different items are two different commands. It
   * is stable across a redraw (the same row composes the same line), it needs
   * no second spelling of an id and a value bag, and it is a `data-` attribute
   * rather than a class so `e2e/screen-parity.spec.ts`, which compares element
   * KINDS as `tag.class1.class2`, sees no new kind.
   *
   * Written for EVERY control including the Copy-only one (`id === null`),
   * because the branch below returns before Execute exists and a key that is
   * present on some controls and absent on others is a key nothing can trust.
   */
  root.dataset.cmdkey = composed;

  // **CLASSLESS, and that is the design of record's own shape.** Nothing in
  // `styles.css` selects `.copy` or `.exec` — grepped, zero occurrences — so the
  // appearance comes entirely from the ANCESTOR rule `.cmdactions button`, which
  // this element is inside. The classes carried no appearance and existed only
  // as test selectors, and `e2e/screen-parity.spec.ts` compares KINDS
  // (`tag.class1.class2`) against the mockup, where the control's buttons are
  // bare `<button>` — so `button.copy` deleted the kind `button` from doctor,
  // work and capture. Weighed against keeping the classes and widening the
  // ledger: the ledger is for a departure worth defending, and a selector the
  // stylesheet never uses is not one. Tests select by the button's TEXT instead.
  const copy = el('button');
  copy.type = 'button';
  copy.append(...ctx.t('btn.copy'));
  // The refusal is the button's own state, not a dialog after the fact: a
  // blocked command must not be one click from a clipboard.
  copy.disabled = copyBlocked;
  root.append(copy);

  /**
   * **The copy, and the only two things it can end as.**
   *
   * Written once and shared by both branches below, because the branch is
   * about whether a command may RUN and the acknowledgement is the same
   * either way — a composition the catalogue cannot name is still copied, and
   * a reader still has to be told whether it worked.
   *
   * `then(onOk, onFail)` rather than `.then().catch()`: a `catch` chained
   * after the success handler would also swallow anything the success handler
   * threw and report a working copy as a failed one.
   *
   * **What is announced is the SETTLEMENT, not the click.** This project has
   * caught the proxy-instead-of-property mistake seven times, and a Copy
   * button that says "Copied" from its own click handler is the eighth: the
   * write is asynchronous and permission-gated, and the click is over long
   * before the browser has decided.
   */
  const onCopyClick = (fail) => () => {
    navigator.clipboard.writeText(composed).then(
      () => {
        // The keyed sentence goes to the ONE live region the shell owns; the
        // screen's own state, if it draws one, is told separately. Nothing is
        // written into the button: swapping its label for 1.5s — the mockup's
        // handler, and `coverage.js`'s until this task — is a message a reader
        // has to be looking at the button to receive, and this defect is
        // precisely about the reader who is not.
        ctx.announce?.(ctx.t('live.copied'));
        onCopied?.();
      },
      (error) => {
        // Assertive, and this is the interruption the ruling reserves for a
        // failure: a reader who believes the line is on their clipboard will
        // paste whatever WAS on it into a shell, and a polite queue can hold
        // that news until after they have.
        ctx.announce?.(ctx.t('live.copyFailed'), true);
        // And the platform's own words stay on screen, unedited, for the
        // reader who is looking — the announcement says WHAT happened, this
        // says why, and neither is a substitute for the other.
        fail(error);
      },
    );
  };

  // Nothing composed outside the catalogue may run. Asserted, not assumed.
  if (typeof id !== 'string' || id === '') {
    copy.addEventListener('click', onCopyClick((error) => root.append(errorNote(message(error)))));
    return root;
  }

  // Classless for the same reason as Copy above, and safe for the same reason:
  // `.cmdactions button` is the ancestor rule that gives it its background.
  const exec = el('button');
  exec.type = 'button';
  exec.append(...ctx.t('exec.btn'));

  // Built once and hidden, rather than created on demand and removed: a node
  // that exists from the start is a node the shell's language toggle can find,
  // and `hidden` is what every other conditional block in this UI uses.
  const confirm = el('div', 'confirm');
  confirm.hidden = true;
  confirm.setAttribute('role', 'group');
  confirm.setAttribute('aria-label', ctx.tFlat('exec.h'));
  // Focusable but not in the tab order: focus is MOVED here when the confirm
  // opens so its label and the residual are announced before either button is
  // reached — deliberately not onto "Run it", which Enter would then fire.
  confirm.tabIndex = -1;

  const result = el('div', 'execresult');
  result.hidden = true;
  // The exit code is the answer to the question the click asked. A polite live
  // region is how a reader who is not watching the button hears it.
  result.setAttribute('role', 'status');
  // **And the same key on the region itself**, because this node is the one the
  // shell CARRIES across the redraw — `ctx.executeSettled(result)` hands it over
  // and the control it came from is gone by the time it is handed back. The key
  // travels with the node, so `attachExecuteOutcome` can find the row again
  // without the shell holding a reference to a detached element's old parent.
  result.dataset.cmdkey = composed;

  root.append(exec, confirm, result);

  const say = (...nodes) => {
    result.replaceChildren(...nodes);
    result.hidden = false;
  };
  const dismiss = () => {
    confirm.replaceChildren();
    confirm.hidden = true;
  };

  copy.addEventListener('click', onCopyClick((error) => say(errorNote(message(error)))));

  exec.addEventListener('click', async () => {
    result.replaceChildren();
    result.hidden = true;
    dismiss();

    /**
     * **THE WAIT IS SAID OUT LOUD, AND THE BUTTON IS DISARMED FOR ITS
     * DURATION** — found 2026-09-01 from a red `e2e/execute.spec.ts:256`.
     *
     * The confirm GET is not a lookup. Since `plan:execute seq:5b` it DERIVES
     * the effect by copying the whole corpus to a scratch directory and running
     * the command there (`src/ui/execute-effect.ts` · `deriveEffect`), and that
     * costs real seconds. Measured on `.demo-corpus` (804 files, 15 MB) on the
     * owner's machine, `review promote-revision`, three runs:
     *
     *     total 5.1s / 6.4s / 7.3s   =  copy 1.8–2.5s
     *                                +  child 2.7–2.8s
     *                                +  snapshot/scan/rm ~1.8–2.1s
     *
     * Until this block existed, ALL of that happened behind a control that
     * changed in no way whatsoever: no pending state, no disabled button,
     * nothing in the result region. A reader pressed Execute and watched five
     * to nine seconds of nothing, which is indistinguishable from a control
     * that is broken — and `e2e/execute.spec.ts:256` recorded exactly that
     * indistinguishability, failing with `Received string: "CopyExecute"` on a
     * page where the request was simply still in flight.
     *
     * The disable is not decoration either. Execute stayed live for the whole
     * wait, so an impatient second press started a SECOND full-corpus dry run
     * and minted a SECOND nonce — on the one route this file calls "the
     * security boundary", and the one whose whole design is that a nonce is
     * minted by the GET that renders the confirm. One press, one mint.
     *
     * The sentence goes into `result`, which already carries `role="status"`,
     * so a reader who is not watching the button is told as well as shown — the
     * same standard the copy announcement is held to a few lines above. And it
     * is CLEARED rather than left standing: on the answer, by the reset below;
     * on a refusal, by the `say()` that replaces it with the reason.
     */
    exec.disabled = true;
    say(...ctx.t('exec.checking'));

    // The nonce is minted HERE and nowhere else — by the GET that renders the
    // confirm — so a page that never rendered one cannot spend one.
    let answer;
    try {
      answer = await ctx.api(confirmPath(id, values, ctx.lang));
    } catch (error) {
      say(errorNote(message(error)));
      return;
    } finally {
      // Re-armed on BOTH paths, and in a `finally` so a refusal is a state a
      // reader can leave by pressing the button again rather than a control
      // that stays dead until the screen is redrawn.
      exec.disabled = false;
    }

    // The question the pending sentence asked has been answered, so it goes:
    // left standing it would sit above the confirm still claiming to be
    // checking, which is the same class of false statement as the blank the
    // `exec.nochange` branch below exists to replace.
    result.replaceChildren();
    result.hidden = true;

    // **The SERVER's boundary flag, not the catalogue's copy of it.** Both are
    // derived from the same measurement, and consulting the client's would be a
    // second classification with its own way of going stale — on the one
    // decision that chooses how much a person is shown.
    // **The effect is the SERVER's, derived by running the command against a
    // throwaway copy of the corpus** (`src/ui/execute-effect.ts`). The browser
    // no longer carries a table of what each command writes: it could not
    // derive one — that is the command's body, not its argument shape — so it
    // transcribed five commands and refused the other nine.
    //
    // §3.2 is now enforced on the server and one step earlier. A command whose
    // effect cannot be derived is refused by the confirm GET itself, WITHOUT
    // minting a nonce, and the `catch` above draws the reason — which is the
    // CLI's own sentence about why it would not run. So there is no longer a
    // "views === null" branch here: reaching this line means the effect is
    // known, and an empty one means the command changes no item rather than
    // that nobody could tell.
    const effect = answer.boundary === true ? (answer.effect ?? []) : [];
    const items = viewsFromEffect(effect);

    confirm.replaceChildren();
    // The residual, as the server sent it, in the words §6.3 chose — and, as
    // of Task 8b, in the READER'S language: this control asked for it with
    // `?lang=` set to `ctx.lang`, and `src/ui/execute.ts` answered with the
    // matching sentence from its per-language `EXECUTION_RESIDUAL`. Still NOT
    // a string-table key: the sentence is spelled once per language on the
    // server, never duplicated into `strings/en.js` or `strings/he.js`, because
    // a security sentence with two spellings is one that gets reworded on one
    // side only. Unlike `work.js`'s `stale` chip — the precedent for staying
    // English, which this sentence no longer follows — a reader who cannot
    // read this one still gets the button, so the asymmetry that was
    // acceptable there was not acceptable here.
    confirm.append(el('p', 'residual', String(answer.residual ?? '')));

    const commandBox = el('div', 'cmd');
    commandBox.append(el('code', null, composeCommand(['mycontext', ...(answer.argv ?? [])])));
    confirm.append(commandBox);

    // One table per item the command touches, each headed by the item it is
    // about. `supersede` reaches TWO items — it retires one and records the
    // relation on both — and a single flat table of field rows would say which
    // fields change without saying which item each belongs to. That is the
    // absent-versus-zero standard applied to the confirm: a row naming a field
    // and not its item is a true statement that reads as a complete one.
    // **An empty effect is a STATEMENT, and it has to be made out loud.**
    //
    // Owner-reported 2026-08-28 from the Doctor screen, whose command is
    // `repair`: with the corpus clean, `repair` derives an effect of zero items
    // and the confirm drew the residual, the command, and nothing else. Correct,
    // and indistinguishable from "we could not show you what it changes".
    //
    // The blank is in fact trustworthy — a derivation that cannot answer throws
    // an `EffectRefusal`, which is a 400 from the confirm GET and never reaches
    // this branch, so reaching here means the command RAN against a copy and
    // touched nothing. But a reader cannot know that by looking, and this is the
    // absent-versus-zero standard applied to the reader instead of to a query.
    //
    // It was also a regression in legibility that no test caught: before the
    // server derived effects, this command was refused LOUDLY with a sentence
    // naming the reason; afterwards it succeeded silently. Every test drove the
    // populated case, so nothing failed.
    //
    // NOT `exec.noeffect`, which was retired with the browser-side table: that
    // sentence said the command "does not run", which is the opposite claim and
    // is now false.
    if (answer.boundary === true && items.length === 0) {
      const nothing = el('p', 'effect-none');
      nothing.append(...ctx.t('exec.nochange'));
      confirm.append(nothing);
    }

    for (const item of items) {
      const heading = el('p', 'effect-item');
      heading.append(...ctx.t(`exec.item.${item.kind}`, { id: item.id }));
      confirm.append(heading);
      confirm.append(diffTable(ctx, item.views.map(fieldView)));
    }

    const go = el('button', 'go');
    go.type = 'button';
    go.append(...ctx.t('exec.go'));
    const cancel = el('button', 'cancel');
    cancel.type = 'button';
    cancel.append(...ctx.t('exec.cancel'));
    confirm.append(go, cancel);

    cancel.addEventListener('click', dismiss);
    // Escape is the other way out, because a confirm a keyboard can open and
    // not close is a confirm that has to be answered to be left.
    confirm.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dismiss();
    });

    go.addEventListener('click', async () => {
      // One click, one run: the nonce is single-use and a second attempt is a
      // 403, so a double click would report a refusal for a run that worked.
      go.disabled = true;
      dismiss();
      let outcome;
      // Before the POST, not after it: `ui/execute.ts` appends the `execute`
      // row BEFORE it runs anything, so the first record of the pair is already
      // travelling down the stream while this awaits. Without this the shell
      // offers the reader a refresh for the act they are in the middle of —
      // measured in a browser on 2026-08-31, about 1.5s after Run was pressed.
      ctx.executeStarted?.();
      try {
        outcome = await ctx.post('/api/execute', { id, values, nonce: answer.nonce });
      } catch (error) {
        say(errorNote(message(error)));
        // The run may still have happened — a network failure reading the
        // RESPONSE says nothing about whether the server ran the command — so
        // the screen is refreshed here too. It settles on what is true rather
        // than on what this browser managed to read back.
        ctx.executeSettled?.(result);
        return;
      }
      report(ctx, say, outcome);
      // ── **AND THE SCREEN IT WAS RUN ON REDRAWS** — `plan:walk seq:120`,
      // owner report 2026-08-31: an item settled from the Review queue stayed
      // in the queue and the rail's gold count never moved.
      //
      // AFTER `report`, never before: `report` is what writes the exit code and
      // the stderr into `result`, and the shell carries THAT node across the
      // redraw. Announcing the settle first would hand the shell an empty
      // region and the reader would lose the answer to "what did that do".
      //
      // The shell owns what happens next, and deliberately: whether a screen
      // may be rebuilt in place is `SCREEN_INVALIDATION`'s question and the
      // rail is not this control's to repaint. This says WHAT HAPPENED — a run
      // this page started, through this page's own approval boundary, has
      // finished — and nothing about what should be redrawn because of it.
      //
      // `?.` because a screen rendered by a test harness has no shell, the same
      // guard `announce()` carries for the same reason.
      ctx.executeSettled?.(result);
    });

    confirm.hidden = false;
    confirm.focus();
  });

  return root;
}

/**
 * What happened, shown rather than swallowed.
 *
 * **A non-zero exit is reported.** A refusal is a state to leave, and a UI that
 * hid one would leave a person believing a command they watched had done
 * something. `exitCode: null` is NOT drawn as a code at all: "we stopped
 * watching" and "it succeeded" are different facts and only one of them is
 * reassuring. The `error` and `auditNote` fields are the server's own sentences
 * and are shown unedited — an `execute` row with no `execute-done` beside it
 * MEANS a run that never returned, so a swallowed note would leave the audit
 * log making a specific and false statement about this run.
 *
 * ── AND STDOUT, WHICH IS THE ANSWER AND WAS NOT DRAWN AT ALL ──────────────
 *
 * Owner, 2026-09-03: *"in warning there is `mycontext ack REF-… dead_scope`,
 * clicked execute, clicked run it but nothing has changed"*. The run was
 * correct and the report was not. `POST /api/execute` had answered 200 with
 *
 *     my_context: REF-… already acknowledges "dead_scope" against its current
 *     content. Nothing was written.
 *
 * on `stdout`, and this function appended exactly one node — a green
 * `exit code 0` — because the word `stdout` appeared nowhere in this file. So
 * the product did the right thing, said so, and the client threw the sentence
 * away. A green exit code over a discarded answer is worse than silence: it
 * tells the reader the command succeeded at doing nothing they can name.
 *
 * `execute-effect.ts` already states the rule this now follows — *"stdout is
 * where the answer usually is … the CLI writes its own refusals to stdout with
 * a `my_context:` prefix, so reading only stderr discards exactly [that
 * sentence]"*.
 *
 * ── WHY `stderr` STAYS WHERE IT WAS: NON-ZERO EXITS ONLY, UNEDITED ────────
 *
 * Weighed three ways, and the existing condition wins on all three:
 *
 *   - **Always showing it** would put Node's own `ExperimentalWarning: SQLite
 *     is an experimental feature…` plus its `(Use --trace-warnings …)` line
 *     under EVERY clean run in this product. That is the runtime talking about
 *     itself, not the command answering the person, and a reader who learns to
 *     skip this region on every successful run is the exact failure the fix
 *     above exists to end.
 *   - **Filtering it here** — dropping the known noise and keeping the rest —
 *     would be a SECOND spelling of `execute-effect.ts`'s `withoutRuntimeNoise`,
 *     in a browser module that cannot import it. This codebase has recorded
 *     that mistake by name more than once, and the copy that went stale would
 *     be the one deciding what a reader is allowed to see.
 *   - **Showing it only on a non-zero or unobserved exit** is what the line
 *     below already did, and it is right: an exit of 0 IS the command saying it
 *     succeeded, and its answer is on stdout. When it did not succeed, stderr
 *     is usually the whole explanation, and it is passed through unedited.
 *
 * So stderr is untouched by this change. The defect was never that stderr was
 * hidden; it was that stdout was never shown.
 */
function report(ctx, say, outcome) {
  const exitCode = outcome?.exitCode;
  const clean = exitCode === 0;
  const nodes = [];

  const code = el('span', clean ? 'exitcode' : 'exitcode bad');
  if (typeof exitCode === 'number') code.append(...ctx.t('exec.exit', { code: String(exitCode) }));
  else code.append(...ctx.t('exec.noexit'));
  nodes.push(code);

  // Before the refusal notes below, and after the code: what the command SAID
  // is the answer to "what did that do", and a reader stops at the first thing
  // that answers it. Drawn on every ending, clean or not — a command that
  // printed a sentence and then exited 1 printed that sentence on purpose.
  nodes.push(...saidNodes(ctx, outcome?.stdout));

  if (typeof outcome?.error === 'string' && outcome.error !== '') {
    nodes.push(errorNote(outcome.error));
  }
  const stderr = typeof outcome?.stderr === 'string' ? outcome.stderr.trim() : '';
  if (!clean && stderr !== '') nodes.push(errorNote(stderr));
  if (typeof outcome?.auditNote === 'string' && outcome.auditNote !== '') {
    nodes.push(errorNote(outcome.auditNote));
  }
  say(...nodes);
}

/**
 * The command's own output, as the command laid it out, bounded the way every
 * other list in this product is bounded.
 *
 * Returns `[]` for a run that printed nothing — and that is a real answer
 * rather than a gap. `STD-a-measured-zero-is-drawn-and-named` governs a MEASURED
 * zero on a surface whose subject is the zero; here the exit code beside it is
 * already the whole statement, and a "this command said nothing" line under
 * every `pin`, `unpin` and `focus` would be a second sentence saying what the
 * first one said.
 *
 * ── WHY A `<pre class="lit">` AND NOT A PARAGRAPH ─────────────────────────
 *
 * **Whitespace is content here.** `mycontext doctor` aligns codes into columns
 * and `mycontext show` prints front matter; a `<p>` collapses every run of
 * spaces and every blank line, which turns a table into prose and loses the
 * only thing the alignment was for.
 *
 * `.lit` is the design of record's own PRIMITIVES §3 field, described there in
 * these words: *"the literal field: a darker field inside the pane, for the
 * machine's own voice."* That is exactly what this is, so no class is invented.
 * `<pre>` on top of it is not decoration either: `styles.css` ~405 gives
 * `pre` the mono face, `direction:ltr` and `unicode-bidi:isolate`, which is what
 * keeps a command's English output readable inside the Hebrew page instead of
 * reordered by the bidi algorithm.
 *
 * Three CSSOM declarations, and each buys something the shipped rules do not:
 *
 *   `white-space: pre-wrap`  `<pre>`'s own `pre` keeps the bytes and REFUSES to
 *                            wrap. `.pane` is `overflow:hidden`, so a 145-column
 *                            line — which is what `ack`'s answer is — would be
 *                            clipped and unreachable rather than merely wide.
 *                            `pre-wrap` keeps every byte and wraps anyway.
 *   `overflow-wrap: anywhere` and the same again for one unbroken token: an
 *                            absolute path or an item id longer than the cell.
 *                            The stylesheet already spells this exact remedy at
 *                            `.div-name`.
 *   `margin-block`           the UA gives `<pre>` `1em 0`, which is a physical
 *                            pair and a size from nowhere. Replaced with the
 *                            stylesheet's own spacing token.
 *
 * Set through the CSSOM and never as an attribute — the page ships
 * `style-src 'self'` with no `'unsafe-inline'` — which is the treatment
 * `screens/parts.js`'s `spaced` established and `screens/doctor.js` follows.
 *
 * ── AND WHY `boundedList` RATHER THAN A TRUNCATION ────────────────────────
 *
 * `REQ-every-list-and-table-declares-what-leaves-it-and-when-and-says`, and
 * `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held` behind it:
 * a surface that drops rows and says nothing cannot be told apart from one that
 * is showing everything, and declaring the bound is necessary but not
 * sufficient — the reader needs a way through. Output is a list of lines, the
 * whole of it is already in hand, so "show all" and the two steppers are a
 * re-render over data legitimately held and no new fetch is introduced.
 *
 * `order: 'position'` because lines have no timestamp and were not selected by
 * anything: they are in the order the command printed them, and `list.positionOf`
 * ("Showing the first {shown} of {total}.") is the one sentence that claims
 * nothing more than that. `BOUND_CAP_LIST` and not `BOUND_CAP_TABLE`, because
 * this region is a transient answer pinned beside the row it was run from, not
 * a screen's own scrolling table — twenty lines is already deep next to a
 * table row, and reusing a declared constant beats inventing a third number.
 *
 * Lines are TEXT NODES, not one element each. An empty element has no height,
 * so a per-line `<div>` would silently swallow every blank line the command
 * printed — collapsing whitespace by a different route. Joined with `\n` under
 * `pre-wrap`, a blank line is a blank line. `i === 0` rather than a trailing
 * newline on every line, so the block does not end in a fabricated blank one;
 * `i` is the index within the drawn window, which is exactly the right question.
 */
function saidNodes(ctx, stdout) {
  const text = typeof stdout === 'string' ? stdout : '';
  // Trailing whitespace only: the final newline is the stream's terminator
  // rather than a line the command wrote. Leading and interior blank lines are
  // the command's own layout and survive.
  const said = text.replace(/\s+$/u, '');
  if (said === '') return [];

  const label = el('p', 'small');
  label.append(...ctx.t('exec.said'));

  const field = el('pre', 'lit');
  field.style.setProperty('white-space', 'pre-wrap');
  field.style.setProperty('overflow-wrap', 'anywhere');
  field.style.setProperty('margin-block', 'var(--sp-1) 0');

  // `\r\n` is what a Windows child writes and `\n` is what the page draws; the
  // carriage return is a line TERMINATOR, not a character of the line, and
  // leaving it in renders as a stray glyph in some fonts.
  const lines = said.split('\n').map((line) => line.replace(/\r$/u, ''));
  const bound = boundedList(
    ctx, field, lines,
    (line, i) => document.createTextNode(i === 0 ? line : `\n${line}`),
    { cap: BOUND_CAP_LIST, order: 'position' },
  );
  return [label, field, bound];
}

/** A thrown thing as the sentence it carries — the platform's words, unedited. */
function message(error) {
  return error && error.message ? error.message : String(error);
}
