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
import { el, errorNote } from '../screens/parts.js';

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
 */
function confirmPath(id, values) {
  const query = new URLSearchParams();
  query.set('id', id);
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
function viewsFromEffect(effect) {
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
function diffTable(ctx, views) {
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
 */
export function commandActions({ argv, id, values = {}, ctx, copyBlocked = false }) {
  const root = el('div', 'cmdactions');
  const composed = composeCommand(argv);

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

  // Nothing composed outside the catalogue may run. Asserted, not assumed.
  if (typeof id !== 'string' || id === '') {
    copy.addEventListener('click', () => {
      navigator.clipboard.writeText(composed).catch((error) => root.append(errorNote(message(error))));
    });
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

  root.append(exec, confirm, result);

  const say = (...nodes) => {
    result.replaceChildren(...nodes);
    result.hidden = false;
  };
  const dismiss = () => {
    confirm.replaceChildren();
    confirm.hidden = true;
  };

  copy.addEventListener('click', () => {
    navigator.clipboard.writeText(composed).catch((error) => say(errorNote(message(error))));
  });

  exec.addEventListener('click', async () => {
    result.replaceChildren();
    result.hidden = true;
    dismiss();

    // The nonce is minted HERE and nowhere else — by the GET that renders the
    // confirm — so a page that never rendered one cannot spend one.
    let answer;
    try {
      answer = await ctx.api(confirmPath(id, values));
    } catch (error) {
      say(errorNote(message(error)));
      return;
    }

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
    // The residual, as the server sent it, in the words §6.3 chose. NOT a
    // string-table key: `src/ui/execute.ts` spells it once and a sentence
    // duplicated into the browser is a sentence that gets reworded on one side
    // only. The cost is that it stays English in the Hebrew UI — the same
    // asymmetry `work.js` records for its `stale` chip, and reported with it.
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
      try {
        outcome = await ctx.post('/api/execute', { id, values, nonce: answer.nonce });
      } catch (error) {
        say(errorNote(message(error)));
        return;
      }
      report(ctx, say, outcome);
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
 */
function report(ctx, say, outcome) {
  const exitCode = outcome?.exitCode;
  const clean = exitCode === 0;
  const nodes = [];

  const code = el('span', clean ? 'exitcode' : 'exitcode bad');
  if (typeof exitCode === 'number') code.append(...ctx.t('exec.exit', { code: String(exitCode) }));
  else code.append(...ctx.t('exec.noexit'));
  nodes.push(code);

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

/** A thrown thing as the sentence it carries — the platform's words, unedited. */
function message(error) {
  return error && error.message ? error.message : String(error);
}
