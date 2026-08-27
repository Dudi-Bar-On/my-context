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
 * The item fields whose stored value is a LIST, so that a typed comma string
 * and a stored array can be compared in the same column.
 *
 * Without this the confirm would print `- src/billing/**` beside
 * `+ src/billing/**,test/**` and leave the reader to notice that one has a
 * space after the comma and the other does not. The two columns of a diff are
 * only useful while they are in the same spelling.
 */
const LIST_FIELDS = new Set(['scope', 'tags']);

/**
 * A stored value as the lines a diff column shows.
 *
 * Deliberately NOT a second `valueLines`: `src/core/revision-diff.ts` owns that
 * one, it is server TypeScript with no browser build step behind it, and its
 * vocabulary is the four REVISION fields. This is the same idea over the item
 * fields a command sets, and it differs in one place on purpose — `extra` is
 * rendered `key=value`, which is the spelling the CLI's own `--extra` takes,
 * because this table's other column is a command argument and not a stored map.
 *
 * An empty value returns NO lines rather than one empty line, so the cell draws
 * the em dash this design already uses for "no value here" instead of a blank
 * that reads as a rendering failure.
 */
function lines(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) {
    return value.length === 0 ? [] : [[...value].map(String).sort().join(', ')];
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return keys.map((key) => `${key}=${String(value[key])}`);
  }
  const text = String(value);
  return text === '' ? [] : text.split('\n');
}

/** A typed argument as the lines the AFTER column shows, in the item's spelling. */
function afterLines(field, raw) {
  if (LIST_FIELDS.has(field)) {
    const parts = String(raw).split(',').map((part) => part.trim()).filter((part) => part !== '');
    return parts.length === 0 ? [] : [parts.sort().join(', ')];
  }
  return lines(raw) ?? [];
}

/**
 * **Which fields a command changes, and to what.** The table §3.2 needs and the
 * browser cannot derive.
 *
 * `test/ui/palette-lib.test.ts` derives the approval BOUNDARY from the real
 * argument parser, so nobody has to keep a list of which commands are gated.
 * There is no equivalent probe for *what a command writes* — that is the
 * command's body, not its argument shape — and a browser module has no build
 * step, so `NAMED_ENTRY_POINTS` in `src/cli/commands/edit.ts` cannot be
 * imported here. It is therefore transcribed, and
 * `test/ui/command-actions.test.ts` imports the CLI's own table and fails this
 * one when the two disagree, entry by entry and by name. That is the same
 * discipline `palette-defs.js`' header states for the catalogue: every claim
 * the list makes is derived somewhere else and compared against it.
 *
 * **A boundary command that is NOT in this map does not run**, and that is spec
 * §3.2 in its own words: *"A command whose effect cannot be shown that way does
 * not get a weaker confirm — it does not run."* Weighed against showing the
 * plain confirm instead, which is what a reader would prefer in the moment and
 * is exactly wrong: the plain confirm is the one for a command that changes
 * nothing that governs this project, and handing it to `add` or `supersede`
 * would make the stronger confirm's absence invisible. The failure mode of this
 * map being short is "a command you must still paste into your own shell",
 * which is where every one of them was yesterday.
 *
 * A Map rather than an object literal: the key is a catalogue id, which is
 * caller-supplied text, and `EFFECTS['__proto__']` on an object literal is not
 * a miss.
 */
export const COMMAND_EFFECTS = new Map([
  // The four named entry points onto `edit`, each of which IS one flag
  // (`src/cli/commands/edit.ts` · `NAMED_ENTRY_POINTS`). Held to that table by
  // the test, so a fifth added there fails here rather than silently getting no
  // confirm it can render.
  ['pin', () => [{ field: 'always', after: ['true'] }]],
  ['unpin', () => [{ field: 'always', after: ['false'] }]],
  ['harden', () => [{ field: 'severity', after: ['hard'] }]],
  ['soften', () => [{ field: 'severity', after: ['soft'] }]],
  // `edit` names its own fields: every argument it was given except the id it
  // is about and the `--yes` that answers its gate. Derived from the values
  // rather than from a list, so a flag the catalogue gains is covered the day
  // it is offered.
  ['edit', (values) => Object.keys(values)
    .filter((name) => name !== 'id' && name !== 'yes')
    .filter((name) => values[name] !== undefined && values[name] !== '')
    .map((name) => ({ field: name, after: afterLines(name, values[name]) }))],
]);

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
 * The fields a boundary command changes, or `null` when this control cannot say.
 *
 * **The BEFORE is read from the corpus**, never derived from the command: the
 * whole point of the column is that it says what is in force, and a value the
 * command implied would make the confirm agree with itself rather than with the
 * item. An item the read cannot reach yields `noCurrent`, which `fieldView`
 * already carries and the table already draws — a fabricated "false" there
 * would be a claim about an item this browser could not open.
 */
async function changedFields(ctx, id, values) {
  const effect = COMMAND_EFFECTS.get(id);
  if (effect === undefined) return null;
  const changes = effect(values);

  let item = null;
  const itemId = values['id'];
  if (typeof itemId === 'string' && itemId !== '') {
    try {
      const body = await ctx.api(`/api/item/${encodeURIComponent(itemId)}`);
      item = body?.item ?? null;
    } catch {
      // A 404 is a real answer here — the id names nothing yet — and it is the
      // `noCurrent` case rather than a failure of the confirm. The refusal a
      // reader needs is the one the RUN gives, in the server's own words.
      item = null;
    }
  }

  return changes.map((change) => ({
    field: change.field,
    // `changed` is the revision queue's "moved since staging", which has no
    // meaning for a command composed a moment ago. Passed false rather than
    // omitted so the shape is the served one and `fieldView` needs no branch.
    changed: false,
    noCurrent: item === null,
    diff: diffFor(item === null ? null : lines(item[change.field]), change.after),
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
    const views = answer.boundary === true ? await changedFields(ctx, id, values) : [];
    if (views === null) {
      // §3.2: a command whose effect cannot be shown does not get a weaker
      // confirm — it does not run. The nonce just minted goes unspent and
      // expires; refusing before the GET would mean asking the CLIENT's
      // boundary flag, which is the thing the line above declines to trust.
      say(...ctx.t('exec.noeffect', { command: id }));
      return;
    }

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

    if (views.length > 0) confirm.append(diffTable(ctx, views.map(fieldView)));

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
