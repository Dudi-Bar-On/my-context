/**
 * `nav.ch` — **Capture**, `<section data-p="capture">` in the design of record
 * (`docs/design/web-ui-mockup.html` · `<section data-p="capture" hidden>` · ~1967).
 *
 * Its verdict is the contract, and it is one sentence long:
 * *"shows what already governs before you add another"* (`cap.v`). `cap.sub`
 * says the same thing in the terms the spec asks for — *"Composes an `add`.
 * What it contributes over the CLI is the overlap check — the items already
 * governing this scope."*
 * (`src/ui/public/strings/en.js` · `What it contributes over the CLI is the overlap check` · ~324).
 *
 * So this screen does exactly two things, and the split between them is the
 * reason it is not a second Composer:
 *
 *   1. It asks `GET /api/capture?scope=…` what already governs a scope, and
 *      draws the answer. That is the half a terminal cannot do.
 *   2. It composes the `mycontext add` that would file the next item into that
 *      same scope — composed and copied, never run (spec §2).
 *
 * ── WHERE THE SCOPE COMES FROM, AND WHY THAT IS A CONTROL THE MOCKUP LACKS ─
 *
 * **The design of record draws no input on this screen.** Its card opens
 * `Already governing src/billing/**` and ends in a composed
 * `mycontext add constraint "…" --scope "src/billing/**" --severity hard`, and
 * nothing in `<section data-p="capture">` says where `src/billing/**`,
 * `constraint`, `"…"` or `hard` came from. In a static mockup they are sample
 * values; in a running screen they have to come from somewhere.
 *
 * They cannot come from the route. The shell reads the whole hash after `#/`
 * as the screen name
 * (`src/ui/public/app.js` · `const asked = (location.hash.replace(/^#\//, '') || 'preview');` · ~517),
 * so `#/capture?scope=src/**` resolves to no registered screen and lands on
 * the preview. They cannot come from the server either: there is no endpoint
 * that answers "the scope the user is thinking about", and `/api/capture`
 * refuses an absent one outright rather than inventing the whole corpus
 * (`src/ui/capture-model.ts` · `scope=<glob>[,<glob>…] is required — the same comma form --scope takes. A scope that ` · ~226).
 *
 * So four controls are drawn that the mockup does not have — a category, a
 * title, the scope, and a severity — and this is the loudest thing in this
 * task's report, listed in the KNOWN_GAPS ledger in the direction that names
 * elements this screen draws and the design of record does not. The
 * alternative was worse in both available forms: a hardcoded `src/billing/**`
 * would be a screen asserting a scope it never read, and drawing the card with
 * no scope at all would leave the one endpoint this screen exists for
 * permanently unreachable.
 *
 * **The captions are not English.** They are the CLI's own argument names,
 * appended as plain text nodes — the ruling `palette.js` already records for
 * exactly these controls
 * (`src/ui/public/screens/palette.js` · ``(`category`, `--severity`) is the CLI's word rather than a translated one and`` · ~332),
 * built in the same shape it builds them
 * (`src/ui/public/screens/palette.js` · ``const caption = document.createTextNode(`${spec.name}${spec.required === true ? ' *' : ''}:`);`` · ~679).
 * No key is invented, nothing is worded here, and `strings-parity.test.ts`
 * has nothing new to fail on.
 *
 * ── THE COMMAND IS COMPOSED IN THE BROWSER, THROUGH THE ONE QUOTING RULE ───
 *
 * `/api/capture` deliberately serves no composed command, and says why at
 * length (`src/ui/capture-model.ts` · `**It does not compose the command.**` · ~15):
 * the argv shape is already in the catalogue, marked for this very screen
 * (`src/ui/public/lib/palette-defs.js` · `name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true,` · ~61),
 * and quoting is one implementation with a checker over its own bytes
 * (`src/ui/public/lib/command.js` · `Command-string composition for every composed write in the UI — the ONE` · ~1).
 * A second spelling of a quoting rule is how a shell command nobody verified
 * reaches a clipboard, so `captureCommand` below is three lines and none of
 * them contains a quotation mark.
 *
 * `commandFor` throws rather than composing a half-built command
 * (`src/ui/public/lib/palette-defs.js` · ``if (arg.required) throw new Error(`${def.name}: ${arg.name} is required`);`` · ~200),
 * and that throw is honoured rather than caught and papered over: until a
 * category and a title are chosen there is no `.cmd` row and nothing to copy.
 * That is `palette.js`'s own treatment of the same throw — *"the copyable
 * command simply is not offered yet"*.
 *
 * **The composed `--scope` is the string the overlap check was asked about**,
 * not the keystrokes. `?scope=a/** , ,b/**` is four positions and two
 * patterns, and the endpoint answers about the two
 * (`src/ui/capture-model.ts` · `screen knows what it typed, and only the server knows what survived the` · ~138).
 * Composing the raw text instead would hand over a command whose scope is not
 * the scope the card above it just reported on.
 *
 * ── THREE THINGS THE SERVED ANSWER SAYS THAT THIS SCREEN MUST NOT RESTATE ──
 *
 * **The order is the server's.** `governing` arrives sorted by id and carries
 * no score to sort on
 * (`src/ui/capture-model.ts` · `Ordered by id, ascending. **Not by relevance — there is no relevance here.**` · ~143),
 * because `cap.nosim` forbids a ranking on this screen in the mockup's own
 * words. So the rows are drawn in the order they arrived and nothing here
 * touches their sequence.
 *
 * **The tier is read, never spelled.** Every row's tier is `normative` today,
 * because `injection()` refuses anything else
 * (`src/ui/capture-model.ts` · ``so every row's tier is `'normative'` today. It is served anyway, because the`` · ~121),
 * and it is still rendered from `row.tier`. A screen that printed the word
 * `normative` would be asserting a property it never read, and would keep
 * printing it the day the owner widened the filter. The category and the tier
 * are the corpus's own words and are not translated, which is the ruling
 * `parts.js` records for tier names
 * (`src/ui/public/screens/parts.js` · `The tier NAME is not a translated string anywhere in the mockup` · ~157).
 *
 * **`notGoverning` is served, and this screen cannot draw it.** It counts the
 * scope-matched items the governing filter removed — drafts, deprecated items,
 * rationale categories — and the model carries it precisely because dropping
 * them silently is what `INV-nothing-is-dropped-silently` forbids
 * (`src/ui/capture-model.ts` · `**This number has no string in the mockup, and it is served anyway.**` · ~151).
 * There is no `cap.` key for it and `strings-parity.test.ts` fails in both
 * directions, so the only renderings available are a bare number with no label
 * — which is not a fact, it is a digit — or English this file made up. Neither
 * ships. **The Capture screen still cannot tell a user that three drafts
 * already sit in the scope they are about to file into**, and that sentence is
 * this task's loudest open question rather than a thing quietly not computed.
 * `test/ui/capture-screen.test.ts` pins the absence so the day a key arrives,
 * the test that says "it is drawn nowhere" is the thing that goes red.
 *
 * ── TWO MORE SENTENCES THE TABLES DECLARE AND THIS SCREEN CANNOT PLACE ─────
 *
 * `cap.o1` and `cap.o2` are the two sample rows' second cells — *"invariant,
 * normative"* and *"standard, normative"* — and the Hebrew table translates
 * both. They are per-sample-row keys, not a vocabulary: a corpus has whatever
 * categories its config declares, and a lookup that translated two of them and
 * left the rest in English would be the defect `lib/i18n.js` records as
 * shipped, pointed the other way. So the second cell is built from the row and
 * both keys go unplaced, named in the report and asserted by name in the test.
 * The visible cost is that this cell is not translated in Hebrew.
 *
 * The mockup's `<b>scope matches</b>` inside `cap.nosim` is dropped for a
 * reason one layer down: no string in either table carries markup, so `t()`
 * has no bold run to build. `preview.carried` loses a `<b>` pair the same way.
 */
import { composeCommand } from '/lib/command.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';

/**
 * The one catalogue entry this screen composes. `overlap: true` is the
 * catalogue's own marking for this screen and nothing else reads it, which is
 * why the test pins it rather than trusting this sentence.
 */
export const ADD = PALETTE.find((def) => def.name === 'add');

/**
 * `palette.js`'s debounce, to the millisecond
 * (`src/ui/public/screens/palette.js` · `const GLOB_DEBOUNCE_MS = 180;` · ~148).
 * One glob input on two screens firing a server round trip at two different
 * rhythms would be a difference no reader could explain.
 */
export const CAPTURE_DEBOUNCE_MS = 180;

/** The mockup's own mark for "no value here", used as the blank option. */
const ABSENT = '—';

/**
 * The endpoint's parse, character for character
 * (`src/ui/capture-model.ts` · `const patterns = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');` · ~223).
 *
 * It is spelled here and not only there because the screen has to know
 * whether it holds a QUESTION before it sends one: a box holding `" , "` is
 * an empty scope, and asking about it earns a 400 whose message is about the
 * caller rather than about the corpus. The test asserts the two parses agree
 * by running the real endpoint over a real workspace, so this is a copy that
 * cannot drift in silence.
 */
export function scopePatterns(raw) {
  return String(raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
}

/**
 * `GET /api/capture?scope=a/**,b/**` — the comma form `--scope` takes, encoded
 * once. Refuses an empty pattern list rather than composing a request the
 * endpoint would answer with a 400: the refusal belongs where the emptiness is
 * known, not one round trip later.
 */
export function capturePath(patterns) {
  if (patterns.length === 0) {
    throw new Error('capturePath: an empty scope is not a question the overlap check can answer');
  }
  return `/api/capture?scope=${encodeURIComponent(patterns.join(','))}`;
}

/**
 * The category picker's options, from `/api/config`'s resolved view
 * (`src/ui/read-model-config.ts` · `name: c.name, prefix: c.prefix, tier: c.tier, enabled: c.enabled,` · ~79).
 *
 * Disabled categories are dropped for `palette.js`'s reason, which is about
 * the CLI rather than about tidiness
 * (`src/ui/public/screens/palette.js` · `A disabled category cannot receive an item, so offering it would compose` · ~245).
 * Names are the corpus's own words and are not translated.
 */
export function categoryOptions(config) {
  const resolved = config === null || config === undefined ? null : config.resolved;
  const categories = resolved !== null && resolved !== undefined && Array.isArray(resolved.categories)
    ? resolved.categories : [];
  return categories.filter((c) => c.enabled === true).map((c) => c.name);
}

/**
 * `--severity`'s closed vocabulary, READ OFF THE CATALOGUE rather than spelled
 * here. `test/ui/palette-lib.test.ts` probes the real argument parser and
 * fails the catalogue when it advertises a flag the command refuses, so the
 * list below is checked against the CLI; a copy of it here would not be.
 */
export function severityOptions() {
  const flag = ADD.flags.find((candidate) => candidate.name === 'severity');
  return flag === undefined || !Array.isArray(flag.options) ? [] : flag.options;
}

/**
 * The `add` this screen composes. Three lines, no quoting: `commandFor` builds
 * the argv the catalogue declares and `composeCommand` is the one place a
 * value is ever wrapped in quotes.
 *
 * It throws on a half-built capture, and the caller does not catch it into a
 * weaker command — an `add` missing its category is not a shorter `add`, it is
 * a different one.
 */
export function captureCommand(values) {
  return composeCommand(commandFor(ADD, values));
}

/**
 * One row of the mockup's table, which has exactly two cells
 * (`docs/design/web-ui-mockup.html` · `<tr><td class="m">INV-prices-are-integer-cents</td><td class="small" data-t="cap.o1">invariant, normative</td></tr>` · ~1975).
 *
 * `detail` is the category and the tier in that order, which is the order both
 * `cap.o1` and `cap.o2` put them in. The comma and the space are punctuation;
 * every word in the string came off the response.
 */
export function rowCells(row) {
  return { id: row.id, detail: `${row.type}, ${row.tier}` };
}

/* ── the DOM half, which is the stated untested surface (spec §6) ──────────── */

/**
 * `palette.js`'s `<label class="small">caption control</label>`, rebuilt here
 * rather than imported: that function is private to that module, and a screen
 * reaching into another screen's internals is a coupling neither file
 * declares. The caption arrives as a TEXT NODE and never through `ctx.t` —
 * see the header for why an argument name is not a translated string.
 */
function labelled(caption, control) {
  const label = el('label', 'small');
  label.append(document.createTextNode(caption), ' ', control);
  return label;
}

function optionEl(value, label) {
  const node = document.createElement('option');
  node.value = value;
  node.textContent = label;
  return node;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'cap.h', 'cap.v', 'cap.sub');

  const card = el('div', 'card pane');
  root.append(card);

  // ONE read at render, and it is not the overlap check: the category picker
  // is real or this screen composes nothing. `palette.js` takes the same line
  // about the same failure — a composer drawn over an empty picker and a
  // corpus with no categories in it are different facts and must not share a
  // rendering. The overlap check itself is asked later, per scope.
  let config;
  try {
    config = await ctx.api('/api/config');
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }
  const usable = config !== null && typeof config === 'object';
  const resolved = usable ? config.resolved : null;
  if (resolved === null || resolved === undefined) {
    // `apiConfigGet` leaves `resolved` null only after setting one of these two
    // to a real sentence (`src/ui/read-model-config.ts` · `if (parseError === null) {` · ~143),
    // so there is always the server's own wording to show and none of it is
    // invented here — `errorNote`'s standing rule.
    card.append(errorNote(usable
      ? String(config.parseError ?? config.resolveError) : String(config)));
    return;
  }

  // --- the four controls the mockup does not have (see the header) ---------

  const category = document.createElement('select');
  category.append(optionEl('', ABSENT));
  for (const name of categoryOptions(config)) category.append(optionEl(name, name));

  const title = document.createElement('input');
  title.type = 'text';

  // `.globin` is the glob input's class on the Composer, and a scope pattern is
  // the same kind of value typed into the same kind of box. The mockup's own
  // `id="globin"` is deliberately NOT copied: screens stack in the DOM and stay
  // there hidden, so a second element carrying that id would collide with the
  // Composer's the moment both have been visited.
  const scope = el('input', 'globin');
  scope.spellcheck = false;
  scope.autocomplete = 'off';

  const severity = document.createElement('select');
  severity.append(optionEl('', ABSENT));
  for (const name of severityOptions()) severity.append(optionEl(name, name));

  // `required` and `aria-invalid` and nothing else. The plan declared a
  // "required inputs are missing" sentence; neither table ever gained the key,
  // so the marking is native semantics a screen reader already words — the
  // same call `palette.js` records making for the same missing string.
  for (const control of [category, title, scope]) control.required = true;

  card.append(
    labelled('category *:', category),
    labelled('title *:', title),
    // Marked required although the catalogue has `--scope` as an optional flag:
    // optional to `mycontext add`, and the whole question on this screen.
    labelled('scope *:', scope),
    labelled('severity:', severity),
  );

  // --- the card the mockup draws, in its order ----------------------------

  const head = el('h3');
  const table = el('table');
  const tbody = el('tbody');
  table.append(tbody);
  const nosim = el('p', 'small');
  nosim.append(...ctx.t('cap.nosim'));
  const cmd = el('div', 'cmd');
  const code = el('code');
  const copy = el('button');
  copy.type = 'button';
  copy.append(...ctx.t('btn.copy'));
  cmd.append(code, copy);
  const warn = el('p', 'cmdnote');
  warn.append(...ctx.t('cap.warn'));
  card.append(head, table, spaced(nosim), cmd, warn);

  // A copy that fails says so in the platform's own words; a copy that works
  // says nothing. `work.js` settled that treatment and records the reason: the
  // mockup swaps the label through an unkeyed ternary in its own script, so
  // neither string table can carry "Copied" and inventing it here would fail
  // the parity check (`src/ui/public/screens/work.js` · `silent and failure is loud, which is the right way round for a button whose` · ~326).
  copy.addEventListener('click', () => {
    // Composed, never run. The user's own shell is the only thing that ever
    // executes this, which is what keeps their Bash deny rules able to see it.
    navigator.clipboard.writeText(code.textContent).catch((error) => {
      cmd.after(errorNote(error && error.message ? error.message : String(error)));
    });
  });

  // --- what the two halves do when something changes ----------------------

  let refusal = null;
  const clearRefusal = () => {
    if (refusal !== null) { refusal.remove(); refusal = null; }
  };
  // Drawn INSTEAD of the card's answer, never beside an empty one: a scope
  // nothing governs and a read the server refused are two facts, and an empty
  // table would report neither. `status.js` and `gaps.js` draw the same line.
  const refuse = (message) => {
    clearRefusal();
    head.hidden = true;
    table.hidden = true;
    refusal = errorNote(message);
    head.before(refusal);
  };

  function recompose() {
    const patterns = scopePatterns(scope.value);
    const values = {
      category: category.value === '' ? undefined : category.value,
      title: title.value === '' ? undefined : title.value,
      scope: patterns.length === 0 ? undefined : patterns.join(','),
      severity: severity.value === '' ? undefined : severity.value,
    };
    for (const [control, value] of [
      [category, values.category], [title, values.title], [scope, values.scope],
    ]) {
      control.setAttribute('aria-invalid', String(value === undefined));
    }
    let command = null;
    try {
      command = captureCommand(values);
    } catch {
      // `commandFor`'s refusal, honoured: a capture missing its category or
      // its title has no command yet, and half of one must not be copyable.
      command = null;
    }
    // Hidden rather than emptied, for `palette.js`'s reason about the same
    // shape: an empty `<p>` still carries its own block margin, and a
    // paragraph-shaped hole reads as a sentence that failed to load.
    code.textContent = command === null ? '' : command;
    cmd.hidden = command === null;
    warn.hidden = command === null;
  }

  // Every answer carries the number of the request that asked for it. Two
  // keystrokes 200ms apart are two round trips, and the SECOND one is the
  // question on screen — without this, a slow first answer landing last would
  // repaint the card with a scope the box no longer holds.
  let asked = 0;
  let timer = null;

  async function look() {
    const patterns = scopePatterns(scope.value);
    if (patterns.length === 0) {
      // Not an error and not an empty result: no question has been asked yet.
      // The heading is `Already governing {mv:scope}` and there is no scope to
      // put in it, so the heading and its table stand down rather than
      // rendering a sentence with a hole where its subject goes.
      clearRefusal();
      head.replaceChildren();
      tbody.replaceChildren();
      head.hidden = true;
      table.hidden = true;
      return;
    }
    const mine = ++asked;
    let body;
    try {
      body = await ctx.api(capturePath(patterns));
    } catch (error) {
      if (mine !== asked) return;
      refuse(error.message);
      return;
    }
    if (mine !== asked) return;
    clearRefusal();
    // The heading shows what the SERVER parsed, which is the echo's whole
    // purpose: a scope typed with a stray comma reads back as the patterns it
    // was actually answered about. `{mv:scope}` builds the mockup's own
    // `<span class="m v">` (`src/ui/public/lib/i18n.js` · `else if (marker === 'mv') out.push(run('m v', value(payload))); // a value, same treatment` · ~72).
    head.replaceChildren(...ctx.t('cap.already', { scope: body.scope.join(', ') }));
    tbody.replaceChildren(...body.governing.map((row) => {
      const cells = rowCells(row);
      const tr = el('tr');
      tr.append(el('td', 'm', cells.id), el('td', 'small', cells.detail));
      return tr;
    }));
    head.hidden = false;
    table.hidden = false;
    // `body.notGoverning` arrives here and is deliberately not read: see the
    // header. There is no key for it and no wordless rendering of a count that
    // is a fact rather than a digit.
  }

  scope.addEventListener('input', () => {
    recompose();
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void look(); }, CAPTURE_DEBOUNCE_MS);
  });
  title.addEventListener('input', recompose);
  category.addEventListener('change', recompose);
  severity.addEventListener('change', recompose);

  recompose();
  head.hidden = true;
  table.hidden = true;
}
