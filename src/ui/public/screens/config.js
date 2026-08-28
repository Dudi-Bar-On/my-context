/**
 * `nav.ch` — **Configure**, `<section data-p="config">` in the design of record.
 * The screen whose verdict is the strongest claim in the product: `cfg.v`,
 * *"the strongest 'a terminal cannot do this'"*.
 *
 * ── IT READS EVERYTHING, AND IT WRITES EXACTLY ONE THING ───────────────────
 *
 * REWRITTEN 2026-08-27 — task `plan:budget seq:5`,
 * `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`. This screen
 * used to read only: the endpoint set it draws from still says so of itself
 * (`src/ui/read-model-config.ts` · `READS, VALIDATES and PREVIEWS; nothing writes, and nothing offers to.` · ~3),
 * and that sentence is still true of `/api/config`, `/api/config/check` and
 * `/api/config/preview` — nothing about THOSE three routes changed. What
 * changed is that the Budgets card (below) now also composes a confirm and a
 * write through `src/ui/execute.ts`'s `BUDGETS_ID` branch — the SAME
 * `GET /api/execute/confirm` / `POST /api/execute` pair every boundary
 * command on every other screen uses, not a second door into the server.
 *
 * The owner's ruling is narrow, and this file enforces the narrowness by
 * construction rather than by discipline: **the ONLY endpoint this screen can
 * reach that writes anything is `BUDGETS_ID`, and `BUDGETS_ID` writes ONLY
 * `config.json`'s `budgets` key.** `categories`, `watchedDocs`, `profile`,
 * `ui` and `handover` are still the user's file to edit by hand — the deny
 * hook (`pre-tool-use.ts`) still refuses an agent that tries, and `cfg.nocmd`
 * still quotes it on screen, rewritten to say what stays true: *"No
 * `mycontext` command edits a budget, and an agent still cannot… A person
 * can, here, behind a confirm."*
 *
 * **And a budget write is behind the same field-by-field confirm a boundary
 * CLI command gets, never a shell command.** Doctor and Coverage compose an
 * argv through `lib/command.js` and hand it to `commandActions`, which draws
 * a `<code>` line and a Copy button beside Execute; a budget write has no argv
 * and no command line to show, so it does NOT go through `commandActions` —
 * `budgetSaveControl` below is a second, narrower control, built from the same
 * three pieces (`confirmPath`, `viewsFromEffect`, `diffTable`, all exported
 * from `lib/command-actions.js` for exactly this reuse) minus the parts that
 * are meaningless for a write that runs no process: no `<code>` line, no
 * Copy, no exit code.
 *
 * ── WHAT IT CAN ASK, AND THE ONE THAT IT CANNOT ────────────────────────────
 *
 * `GET /api/config` for the read model below; `GET /api/execute/confirm` and
 * `POST /api/execute` for the Budgets card's Write control. `POST
 * /api/config/check` and `POST /api/config/preview` exist and are registered
 * (`src/ui/read-model-config.ts` · `registerRoute('POST', '/api/config/check', {` · ~362)
 * and are STILL unreachable from here — `ctx.post` exists on the screen
 * contract now (`app.js`'s `post(path, body)`, added for `execute`), but
 * nothing below calls it with either of those two paths. Every preview that
 * would need a CANDIDATE config (the delta plate, the segbar's blast panels)
 * is therefore still ABSENT rather than approximated, and this task's report
 * names it as unchanged.
 *
 * That absence is not new: the mockup binding for this task already records
 * three things it cannot produce as written
 * (`docs/superpowers/plans/2026-08-16-web-ui-2-palette-and-work.md` · `Three things this task cannot produce as written — the delta rows, three previews behind` · ~3068).
 * Two of the three are the delta plate and the segbar's blast panels, and the
 * missing POST is the mechanism behind both.
 *
 * **The `.delta` and `.blast` rules are also not in `styles.css`.** Measured:
 * the mockup declares `.delta`, `.delta .was`, `.delta .will`, `.delta .arrow`,
 * `.delta.gain`, `.delta.loss`, `.blast`, `.blast.warn`, `.blast.crit` and
 * `.blast b` in its own `<style>` — ten rules, at
 * (`docs/design/web-ui-mockup.html` · `.delta{display:flex;gap:var(--sp-2);align-items:baseline;font-size:var(--fs-1);padding-block:3px}` · ~991)
 * and ~1010 — and `src/ui/public/styles.css` carries none of the ten (grepped:
 * neither `delta` nor `blast` appears in it outside prose). Drawing those rows
 * here would emit unstyled markup — a flex row with no flex, a blast panel with
 * no border — so the pairing they exist to show is drawn where the mockup ALSO
 * draws it and where the CSS does exist: the Budgets table's `6000 → 8000` cell.
 * Carrying the eight rules across is a `styles.css` edit, which this task does
 * not own; it is in the report.
 *
 * ── WHAT IS SERVED AND DELIBERATELY NOT DRAWN ──────────────────────────────
 *
 * `resolved.ui` arrives on every response and appears nowhere below. `ui.enabled`
 * is accepted, strictly validated, documented — and read by nothing. That is
 * TASK-ui-enabled-is-accepted-strictly-validated-and-read-by (plan:rulings
 * seq:42), OPEN at the time this was written, in its own words: *"So the key
 * parses, is strictly validated, is documented, and no code reads it. A user
 * who sets it to false gets a UI anyway."* It is cited by id rather than in the
 * `file · fragment · ~line` form because it lives in the corpus at the outer
 * repository root, which is not a path inside this package. A configuration screen that drew
 * the control would be asserting the setting works, in the one surface built to
 * end exactly that kind of silence. The mockup draws no `ui` block either, so
 * nothing is lost by waiting for the ruling.
 *
 * `resolved.categories` carries `agentEdits` and `enabled` per category and this
 * screen draws neither, because `<section data-p="config">` draws neither — the
 * task's own mockup binding says the `agentEdits` string "appears zero times in
 * it". The mockup is the specification; a control it does not have is not a
 * control this file invents.
 *
 * `skippedKeys`/`skippedNotice` ARE drawn, and that is a duty rather than a
 * nicety: the field's own words are that *"a surface that shows config to a
 * human and does not print this notice has re-created the silent drop this field
 * exists to end"* (`src/ui/read-model-config.ts` · `own words that "a surface that shows config to a human and does not print` · ~63).
 * The mockup has no slot and no key for it, so it is drawn in the SERVER'S OWN
 * WORDING, unedited — the same treatment `errorNote` gives a refusal
 * (`screens/parts.js` · ``So nothing here is worded: the endpoint's own `error` text is shown as it`` · ~181)
 * — and the missing key is in the report rather than invented into both tables.
 *
 * ── THE PURE HALF, AND WHY IT IS EXPORTED ──────────────────────────────────
 *
 * `budgetRows`, `jsonBlock` and `policyPositions` take plain data and return
 * plain data: no `document`, no `ctx`, no network. They are what
 * `test/ui/config-screen.test.ts` runs under `node --test`. The DOM glue below
 * them is the stated untested surface (spec §6), and the split is what keeps
 * "which number is struck through" and "what exactly gets pasted" out of it.
 */
import { confirmPath, diffTable, viewsFromEffect } from '/lib/command-actions.js';
import { fieldView } from '/lib/viewmodel.js';
import {
  el, errorNote, mono, raiseSimRange, screenHead, spaced,
} from '/screens/parts.js';


/**
 * The reserved catalogue-shaped id `src/ui/execute.ts` reads as "the budgets
 * branch, not a catalogue command" — `BUDGETS_ID` there, respelled here
 * because a browser module cannot import a `.ts` constant. The two are one
 * decision, not two, the same relationship `CONFIRM_LANG_ARG` already has
 * between that file and `lib/command-actions.js`. It is not, and must never
 * become, a `palette-defs.js` entry: `test/ui/execute-budgets-route.test.ts`
 * asserts the catalogue names nothing by this id.
 */
const BUDGET_ID = 'config:budgets';

/**
 * The category whose `scopePolicy` the third card is about.
 *
 * The mockup hard-codes one: `<h3><span class="m">categories.lesson.scopePolicy</span></h3>`.
 * `lesson` is a real catalogue category (measured: present in the resolved
 * config of this repository and of `.demo-corpus`, both on the `standard`
 * profile), so the design of record's own subject is used rather than a
 * category picked here — and if a config ever resolves without it,
 * `policyPositions` answers `null` and the card is not drawn at all rather than
 * heading itself with a category that does not exist.
 */
export const SP_CATEGORY = 'lesson';

/**
 * The Budgets table's five rows: `{ key, was, will }`, where `was` is `null`
 * when the file changes nothing and the built-in default is what runs.
 *
 * **The pair is the row** — `cfg.deltan`'s whole argument, in the mockup's own
 * words: *"Each row is the pair, not the direction alone… 'What was it before'
 * is half of 'what changes'."* Here `was` is the SHIPPED DEFAULT and `will` is
 * what this config resolves to, which is a different pairing from the mockup's
 * (its `6000 → 8000` is an edit in flight, and an edit in flight needs
 * `POST /api/config/preview`). It is the one before→after `GET /api/config`
 * can actually answer, and it answers it exactly: `meta.defaultBudgets` is
 * `DEFAULT_BUDGETS` itself, passed through
 * (`src/ui/read-model-config.ts` · `  defaultBudgets: DEFAULT_BUDGETS,` · ~107).
 *
 * The key ORDER comes from the defaults object, never from a list written here:
 * `BUDGET_KEYS` is derived from `DEFAULT_BUDGETS` on the server too
 * (`src/core/config.ts` · `const BUDGET_KEYS = Object.keys(DEFAULT_BUDGETS) as (keyof Budgets)[];` · ~525),
 * so a sixth budget appears in this table the day it is added and no second
 * spelling of the tier list has to be found and edited.
 */
export function budgetRows(budgets, defaults) {
  const resolved = budgets ?? {};
  return Object.keys(defaults ?? {}).map((key) => {
    const fallback = defaults[key];
    const will = resolved[key] === undefined ? fallback : resolved[key];
    return { key, was: will === fallback ? null : fallback, will };
  });
}

/**
 * One top-level block of `config.json`, as text to paste — `  "budgets": {…}`,
 * indented exactly as `<section data-p="config">`'s two `<pre class="m">`
 * blocks are, two spaces in, because the block is pasted INTO an object.
 *
 * `JSON.stringify(value, null, 2)` and then one extra indent on every line but
 * the first: that is what makes `"pinned"` land at four spaces and the closing
 * brace at two, which is the mockup's own shape and is asserted against the
 * mockup's bytes in `test/ui/config-screen.test.ts`.
 *
 * The KEY goes through `JSON.stringify` as well. It is a constant at both call
 * sites, so nothing here needs escaping today — and a composer that hand-wrote
 * its own quotes would be the one place in this file that could emit invalid
 * JSON for a value it did not expect.
 */
export function jsonBlock(key, value) {
  const body = JSON.stringify(value, null, 2).split('\n').join('\n  ');
  return `  ${JSON.stringify(key)}: ${body}`;
}

/**
 * The segbar's three positions for one category: `{ name, current, positions }`
 * with exactly one `pressed`, or `null` when the resolved config has no such
 * category.
 *
 * The three values are `meta.scopePolicies`, in the server's DECLARATION ORDER,
 * which is user-facing rather than incidental — the CLI's refusals list them in
 * that order (`src/ui/read-model-config.ts` · `are passed through in DECLARATION ORDER,` · ~96).
 * A picker that sorted them would teach a different vocabulary from the one the
 * refusal prints. The mockup happens to draw `global`/`required`/`inert`, which
 * is that order — checked, not assumed.
 *
 * `current` is what the CONFIG resolves to, so the pressed position is a
 * READING and not a selection: moving it would have to answer "and what would
 * that do to this corpus", which is `POST /api/config/preview` and is the
 * card's absent half. See `render` for what that costs the control.
 */
export function policyPositions(categories, policies, name) {
  const category = (categories ?? []).find((c) => c.name === name);
  if (category === undefined) return null;
  return {
    name,
    current: category.scopePolicy,
    positions: (policies ?? []).map((value) => ({ value, pressed: value === category.scopePolicy })),
  };
}

/**
 * **The Budgets card's Write control — a second, narrower control beside
 * `commandActions`, not a reuse of it.**
 *
 * `commandActions` draws a `<code>` line (the argv) and a Copy button beside
 * Execute, because every OTHER boundary control on this UI composes a CLI
 * command. A budget write composes nothing of the kind — there is no argv, no
 * shell line, nothing to copy — so drawing it here would show a fake command
 * line for the one write this product deliberately keeps out of the CLI's
 * reach (`cfg.nocmd`). What IS shared, imported rather than re-implemented,
 * is the three pieces that do not depend on there being a command:
 * `confirmPath` (the SAME query-string shape `GET /api/execute/confirm`
 * reads, `id` plus values plus `?lang=`), `viewsFromEffect` (the server's
 * `effect` reshaped for `fieldView`) and `diffTable` (the field/in-force/
 * proposed table, headed by `exec.changes`, that every other confirm already
 * draws through). One nonce is minted for this whole page, and it is minted
 * where it always is — the confirm GET `execute.ts` answers — never here.
 *
 * `inputs` is `{ [budgetKey]: <input type=number>, … }`, read at the moment
 * Write is clicked so the values sent are whatever the fields hold THEN, not
 * whatever `budgetRows` computed when the screen loaded. On success every
 * input the write actually changed is updated to the server's own `after`
 * value, so the field a reader is looking at reflects what `config.json` now
 * says without a full-screen reload.
 */
function budgetSaveControl(ctx, inputs) {
  const root = el('div', 'cmdactions');
  const save = el('button');
  save.type = 'button';
  save.append(...ctx.t('cfg.savebtn'));
  root.append(save);

  const confirmBox = el('div', 'confirm');
  confirmBox.hidden = true;
  confirmBox.setAttribute('role', 'group');
  confirmBox.setAttribute('aria-label', ctx.tFlat('cfg.saveh'));
  // Focusable but not in the tab order — `commandActions`' own reason: focus
  // moves here when the confirm opens so its label and the residual are
  // announced before either button is reached.
  confirmBox.tabIndex = -1;

  const result = el('div', 'execresult');
  result.hidden = true;
  result.setAttribute('role', 'status');

  root.append(confirmBox, result);

  const say = (...nodes) => { result.replaceChildren(...nodes); result.hidden = false; };
  const dismiss = () => { confirmBox.replaceChildren(); confirmBox.hidden = true; };

  save.addEventListener('click', async () => {
    result.replaceChildren();
    result.hidden = true;
    dismiss();

    const values = {};
    for (const [key, input] of Object.entries(inputs)) values[key] = input.value;

    // The nonce is minted HERE and nowhere else — by the GET that renders
    // this confirm — the same property `commandActions` states and the same
    // route that mints it: `src/ui/execute.ts`'s `handleConfirm`, whichever
    // branch a caller's `id` selects.
    let answer;
    try {
      answer = await ctx.api(confirmPath(BUDGET_ID, values, ctx.lang));
    } catch (error) {
      say(errorNote(error && error.message ? error.message : String(error)));
      return;
    }

    const items = viewsFromEffect(answer.effect ?? []);
    confirmBox.replaceChildren();
    confirmBox.append(el('p', 'residual', String(answer.residual ?? '')));
    // One table, no per-item heading: unlike a catalogue command, which may
    // touch several items, a budget write is always exactly one thing —
    // `config.json` — so naming it above the table would say nothing a reader
    // does not already know from the screen they are on.
    for (const item of items) confirmBox.append(diffTable(ctx, item.views.map(fieldView)));

    const go = el('button', 'go');
    go.type = 'button';
    go.append(...ctx.t('cfg.saveg'));
    const cancel = el('button', 'cancel');
    cancel.type = 'button';
    cancel.append(...ctx.t('exec.cancel'));
    confirmBox.append(go, cancel);

    cancel.addEventListener('click', dismiss);
    confirmBox.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') dismiss();
    });

    go.addEventListener('click', async () => {
      // One click, one write: the nonce is single-use.
      go.disabled = true;
      dismiss();
      let outcome;
      try {
        outcome = await ctx.post('/api/execute', { id: BUDGET_ID, values, nonce: answer.nonce });
      } catch (error) {
        say(errorNote(error && error.message ? error.message : String(error)));
        return;
      }
      say(el('span', null, ctx.tFlat('cfg.saved')));
      if (typeof outcome?.auditNote === 'string' && outcome.auditNote !== '') {
        result.append(errorNote(outcome.auditNote));
      }
      // Every field the write actually changed is set to its new value —
      // `outcome.diff`, the SAME `BudgetFieldDiff[]` the confirm rendered, so
      // the field a reader is looking at updates to what the file now says
      // without a full-screen reload that would wipe the message just shown.
      // `cfg.h2`'s receipt ("returning to the tab shows the new value") is
      // still true on a fresh navigation, which re-fetches from disk regardless.
      for (const change of Array.isArray(outcome?.diff) ? outcome.diff : []) {
        const key = String(change.field).replace(/^budgets\./, '');
        const input = inputs[key];
        if (input) input.value = String(change.after);
        // **"Raising a budget past the limit raises the limit"**, performed from
        // this side of it. `raiseSimRange` only ever raises, and does nothing at
        // all where no range has been set — there the simulator's derived bound
        // already carries the budget in force as one of its own terms, so there
        // is nothing here that could be out of step.
        raiseSimRange(key, Number(change.after));
      }
    });

    confirmBox.hidden = false;
    confirmBox.focus();
  });

  return root;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'cfg.h', 'cfg.v', 'cfg.sub');

  let config;
  try {
    // Fresh from disk on every call, by the endpoint's own design — which is
    // what `cfg.h2` promises the reader as the receipt: *"this screen re-reads
    // config.json from disk on every load, so returning to the tab shows the
    // new value"*. Nothing is cached here; `render` runs per navigation.
    config = await ctx.api('/api/config');
  } catch (error) {
    // INSTEAD of the four cards, never beside them. A config that could not be
    // read and a config with nothing unusual in it are opposite facts, and four
    // cards of defaults would report the second one.
    root.append(errorNote(error.message));
    return;
  }

  // A file that does not parse, and a file that does not load, are FIELDS here
  // rather than 500s — the endpoint carries them precisely so this screen can
  // show the text to fix. Both are hard stops: `resolved` is null in the first
  // case and null in the second, so there is nothing to draw underneath.
  //
  // The wording is the LOADER'S, verbatim and unworded, because no string table
  // declares a key for either (`configure.parseError`/`configure.resolveError`
  // are the plan's names for keys that were never added, and adding them would
  // fail `test/ui/strings-parity.test.ts` in the direction that names a key the
  // design of record does not declare). `errorNote` is the established
  // treatment; the missing keys are this task's report.
  if (config.parseError !== null) {
    root.append(errorNote(config.parseError));
    return;
  }
  if (config.resolveError !== null) {
    root.append(errorNote(config.resolveError));
    return;
  }
  const resolved = config.resolved;

  // R14.2's disclosure, in the one sentence `skippedKeyNotice` composes. Drawn
  // above the cards because it is about the FILE rather than about any one
  // setting, and drawn at all because the alternative is the silent drop the
  // field exists to end. Empty for every config this build fully understands,
  // which is nearly all of them — measured empty on `.demo-corpus`.
  if (resolved.skippedKeys.length > 0) {
    root.append(el('p', 'small', resolved.skippedNotice));
  }

  const two = el('div', 'two');
  root.append(two);

  // ── Card 1: Budgets ───────────────────────────────────────────────────────
  // The mockup's table, row for row: `<td class="m">jit</td>` and a value cell
  // that is either the number or the PAIR, `6000 → <b>8000</b>`.
  //
  // Numbers are drawn WITHOUT group separators, which is the mockup's own
  // choice here and not an oversight of `num()`: `<section data-p="config">`
  // writes `6000` in this table and `6,000` in the delta plate. The table is
  // the file's literal value — the digits a user types into `config.json` — and
  // a separator in that cell would be a number they cannot paste back.
  const budgetCard = el('div', 'card pane');
  const budgetHead = el('h3');
  budgetHead.append(...ctx.t('cfg.budgets'));
  const budgetTable = el('table');
  const budgetBody = el('tbody');
  // One `<input type="number">` per row, in the third column — the field this
  // task adds. `min="1"` and `step="1"` are a UX hint only; the SERVER is the
  // validator (`requirePositiveIntegerBudget`, `src/core/budgets-write.ts`),
  // refusing by name rather than clamping, and a browser that skipped this
  // attribute would still be refused correctly. Pre-filled with `row.will` —
  // what the file resolves to right now — never `row.was`, the default.
  const budgetInputs = {};
  for (const row of budgetRows(resolved.budgets, config.meta.defaultBudgets)) {
    const tr = el('tr');
    const value = el('td', 'm');
    if (row.was === null) {
      value.append(String(row.will));
    } else {
      // `<b>` on the value in force, exactly as the mockup bolds the new half
      // of its pair: the default is context, the resolved value is what runs.
      value.append(`${row.was} → `, el('b', null, String(row.will)));
    }
    const input = el('input', 'm');
    input.type = 'number';
    input.min = '1';
    input.step = '1';
    input.value = String(row.will);
    input.setAttribute('aria-label', `budgets.${row.key}`);
    budgetInputs[row.key] = input;
    const editCell = el('td');
    editCell.append(input);
    tr.append(el('td', 'm', row.key), value, editCell);
    budgetBody.append(tr);
  }
  budgetTable.append(budgetBody);
  budgetCard.append(budgetHead, budgetTable, budgetSaveControl(ctx, budgetInputs));

  // ── Card 2: What changes ──────────────────────────────────────────────────
  // The plate is EMPTY, and that is the honest state rather than an omission.
  // Its rows are a before→after of an edit in flight — `STD-api-errors…
  // spilled → delivered` — computed by `POST /api/config/preview` running the
  // real selector twice. No edit can be in flight on a screen whose fetcher
  // cannot POST, so there is nothing to put in it; and the six `.delta*` rules
  // are absent from `styles.css` besides (header). The note stays, because it
  // is the design of record's argument for the shape and it is still true of
  // the pair drawn in the Budgets card beside it.
  const effectCard = el('div', 'card pane');
  const effectHead = el('h3');
  effectHead.append(...ctx.t('cfg.effect'));
  const deltaPlate = el('div', 'plate');
  deltaPlate.id = 'cfgdelta';
  const deltaNote = el('p', 'small');
  deltaNote.append(...ctx.t('cfg.deltan'));
  effectCard.append(effectHead, deltaPlate, spaced(deltaNote));

  two.append(budgetCard, effectCard);

  // ── Card 3: categories.<lesson>.scopePolicy ───────────────────────────────
  //
  // **The segbar is a READING, not a control, and it says so by being
  // disabled.** In the mockup each position swaps in a blast panel whose border
  // and count ARE the blast radius (`cfg.spn`), and the count is exact because
  // `scopePolicyFor` computes it over the real corpus — server-side, in
  // `POST /api/config/preview`. This screen cannot ask that question, so the
  // three positions carry only what `GET /api/config` knows: which one the
  // config resolves to. A live-looking control that answered a click with
  // nothing would be worse than a dead one — and estimating the radius in the
  // browser is the exact thing `cfg.spn` rules out ("computable exactly rather
  // than estimated"). `#spout` is left empty for the same reason `#cfgdelta` is.
  const positions = policyPositions(resolved.categories, config.meta.scopePolicies, SP_CATEGORY);
  if (positions !== null) {
    const spCard = el('div', 'card pane');
    const spHead = el('h3');
    // `.m`, not a translated string: `categories.lesson.scopePolicy` is the
    // config file's own path to the value, and the mockup draws it as a mono
    // literal in both languages.
    spHead.append(mono(`categories.${positions.name}.scopePolicy`));
    const bar = el('div', 'segbar');
    bar.id = 'spbar';
    bar.setAttribute('role', 'group');
    // An attribute cannot hold an element, which is the sink `tFlat` exists
    // for — and `aria.scopepolicy` is the key the mockup itself hangs on this
    // bar (`data-t-aria="aria.scopepolicy"`).
    bar.setAttribute('aria-label', ctx.tFlat('aria.scopepolicy'));
    for (const position of positions.positions) {
      const button = el('button', null, position.value);
      button.type = 'button';
      button.disabled = true;
      button.setAttribute('aria-pressed', String(position.pressed));
      bar.append(button);
    }
    const spPlate = el('div', 'plate');
    spPlate.id = 'spout';
    const spNote = el('p', 'small');
    spNote.append(...ctx.t('cfg.spn'));
    spCard.append(spHead, bar, spPlate, spaced(spNote));
    root.append(spCard);
  }

  // ── Card 4: Apply this ────────────────────────────────────────────────────
  const applyCard = el('div', 'card pane');
  const applyHead = el('h3');
  applyHead.append(...ctx.t('cfg.apply'));
  const nocmd = el('p', 'small');
  nocmd.append(...ctx.t('cfg.nocmd'));

  // The block as it stands, ready to be edited and pasted back — not a patch.
  // The mockup's `pre` carries `-`/`+` lines because it is showing a pending
  // edit; with no candidate there is no diff, and inventing `-`/`+` markers
  // around identical lines would draw a change nobody made. What survives is
  // the thing `cfg.nocmd` says this screen is for: "this is the edit, not a
  // command" — the exact text of the section a user has to touch, so the digits
  // they change are the only thing they have to type.
  const budgetsText = jsonBlock('budgets', resolved.budgets);
  const budgetsPre = el('pre', 'm', budgetsText);

  // `<div class="cmd"><code>…</code><button>Copy the patch</button></div>` — the
  // mockup's compose-and-copy row, with the ABSOLUTE path the endpoint reports
  // rather than the mockup's abbreviated `.my_context/config.json`: `path` is
  // the file this server actually read, and a workspace elsewhere on disk makes
  // the abbreviation a guess.
  //
  // A copy that fails says so, in the platform's own words — the treatment
  // `screens/doctor.js` established (`commandRow`), for the reason it records:
  // the mockup's own "Copied"/"Copy failed" label swap is an unkeyed ternary in
  // its script, so neither string table can carry it and inventing the two keys
  // here would fail the parity check.
  const cmd = el('div', 'cmd');
  const code = el('code', null, config.path);
  const copy = el('button');
  copy.type = 'button';
  copy.append(...ctx.t('btn.copypatch'));
  copy.onclick = () => {
    // Composed and copied, never applied. The user's own editor is the only
    // thing that ever writes this file — which is what keeps the deny hook's
    // rule about `.my_context/config.json` true of this UI as well.
    navigator.clipboard.writeText(budgetsText).catch((error) => {
      cmd.after(errorNote(error && error.message ? error.message : String(error)));
    });
  };
  cmd.append(code, copy);

  const watchedHead = el('h3');
  watchedHead.append(...ctx.t('cfg.watched'));
  // The mockup's `style="margin-block-start:14px"` — 14px and not `spaced`'s
  // 8px — set through CSSOM, never as an attribute: the server sends
  // `style-src 'self'` with no `'unsafe-inline'`, so a `style="…"` attribute
  // would be blocked. Logical property, as everywhere else in this UI.
  watchedHead.style.setProperty('margin-block-start', '14px');

  const watchedNote = el('p', 'small');
  const watchedText = el('span');
  watchedText.append(...ctx.t('cfg.watchednote'));
  // `PROPOSED` is an unkeyed literal in the design of record and the badge is
  // KEPT rather than dropped: the note describes `init` writing what the
  // repository actually has, and `DEFAULT_WATCHED_DOCS` is still the fixed
  // three-path list it argues against (`src/core/config.ts` · `export const DEFAULT_WATCHED_DOCS = [` · ~79)
  // — measured: `.demo-corpus` resolves to exactly those three. The app's own
  // rule is that a built feature drops the badge; this one is not built.
  watchedNote.append(watchedText, ' ', el('span', 'prop', 'PROPOSED'));
  const watchedPre = el('pre', 'm', jsonBlock('watchedDocs', resolved.watchedDocs));

  const help = el('details', 'help');
  const summary = el('summary');
  summary.append(...ctx.t('help.land'));
  const helpBox = el('div', 'helpbox');
  const landed = el('span');
  landed.append(...ctx.t('cfg.h1'));
  const receipt = el('span');
  receipt.append(...ctx.t('cfg.h2'));
  helpBox.append(landed, receipt);
  help.append(summary, helpBox);

  applyCard.append(applyHead, nocmd, budgetsPre, cmd, watchedHead, watchedNote, watchedPre, help);
  root.append(applyCard);
}
