/**
 * `nav.ch` — **Capture**, `<section data-p="capture">` in the design of record
 * (`docs/design/web-ui-mockup.html` · `<section data-p="capture" hidden>` · ~3321).
 *
 * Its verdict is the contract, and it is one sentence long:
 * *"shows what already governs before you add another"* (`cap.v`). `cap.sub`
 * says the same thing in the terms the spec asks for — *"Composes an `add`.
 * What it contributes over the CLI is the overlap check — the items already
 * governing this scope."*
 * (`src/ui/public/strings/en.js` · `What it contributes over the CLI is the overlap check` · ~924).
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
 * (`src/ui/capture-model.ts` · `scope=<glob>[,<glob>…] is required — the same comma form --scope takes. A scope that ` · ~234).
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
 * (`src/ui/public/screens/palette.js` · ``(`category`, `--severity`) is the CLI's word rather than a translated one and`` · ~387),
 * built in the same shape it builds them
 * (`src/ui/public/screens/palette.js` · ``const caption = document.createTextNode(`${spec.name}${spec.required === true ? ' *' : ''}:`);`` · ~805).
 * No key is invented, and that is a ruling about WHAT they are rather than
 * about what a gate would allow: `category` and `--severity` are the words
 * `mycontext add` takes on a terminal, so a translated caption would name an
 * argument that does not exist. Keying them has been permitted since
 * 2026-08-26 (`DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`);
 * it is still wrong, which is the difference between a constraint and a
 * decision.
 *
 * ── THE COMMAND IS COMPOSED IN THE BROWSER, THROUGH THE ONE QUOTING RULE ───
 *
 * `/api/capture` deliberately serves no composed command, and says why at
 * length (`src/ui/capture-model.ts` · `**It does not compose the command.**` · ~15):
 * the argv shape is already in the catalogue, marked for this very screen
 * (`src/ui/public/lib/palette-defs.js` · `name: 'add', kind: 'write', base: ['mycontext', 'add'], overlap: true, boundary: true,` · ~200),
 * and quoting is one implementation with a checker over its own bytes
 * (`src/ui/public/lib/command.js` · `Command-string composition for every composed write in the UI — the ONE` · ~1).
 * A second spelling of a quoting rule is how a shell command nobody verified
 * reaches a clipboard, so `captureArgv` and `captureCommand` below are one line
 * each and neither contains a quotation mark.
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
 * (`src/ui/capture-model.ts` · ``so every row's tier is `'normative'` today. It is served anyway, because the`` · ~120),
 * and it is still rendered from `row.tier`. A screen that printed the word
 * `normative` would be asserting a property it never read, and would keep
 * printing it the day the owner widened the filter. The category and the tier
 * are the corpus's own words and are not translated, which is the ruling
 * `parts.js` records for tier names
 * (`src/ui/public/screens/parts.js` · `The tier NAME is not a translated string anywhere in the mockup` · ~577).
 *
 * **`notGoverning` is served and is DRAWN, since 2026-08-30.** It counts the
 * scope-matched items the governing filter removed — drafts, deprecated items,
 * rationale categories — and the model carries it precisely because dropping
 * them silently is what `INV-nothing-is-dropped-silently` forbids
 * (`src/ui/capture-model.ts` · `**This number has no string in the mockup, and it is served anyway.**` · ~151).
 *
 * This paragraph used to end the other way: *"There is no `cap.` key for it and
 * `strings-parity.test.ts` fails in both directions"*, leaving a bare digit or
 * invented English as the only choices and neither shipping. The second half of
 * that sentence stopped being true on 2026-08-26, when
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped the
 * invented direction; the gate compares the tables to the mockup in ONE
 * direction now and its docstring says which. `cap.notgov` is the key, in both
 * tables, and **the Capture screen can now tell a user that three drafts
 * already sit in the scope they are about to file into** — which this file
 * called its loudest open question for as long as the retired rule went
 * unre-read.
 *
 * It is drawn only when it is non-zero. A zero here is not a measured zero
 * being suppressed: `governing` is already on screen beside it, so "and none
 * were removed" is the absence of a removal notice rather than a missing fact.
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
/**
 * **THE BUILDER, WHICH THIS SCREEN IS THE MODEL FOR** (`plan:builder seq:5` /
 * `plan:walk seq:20`, 2026-09-07).
 *
 * Both tasks name this file: *"the Capture screen already does most of this — a
 * select for the category, inputs for title and scope, a select for severity.
 * Read `screens/capture.js` before designing anything: the job is to
 * GENERALISE what is there, not to replace it."* `lib/builder.js` is that
 * generalisation, and this screen now instantiates it rather than hand-rolling
 * a row of inputs.
 *
 * **The four controls are the same four**, and they are built from the SAME
 * catalogue entry that composes the command — `ADD.args` and `ADD.flags`,
 * filtered to the four this screen offers (`FIELDS`). They were built by hand
 * here, in twenty lines that reimplemented `palette.js`' `controlFor`, with a
 * private `labelled()` whose own comment said it was "rebuilt here rather than
 * imported: that function is private to that module". That is what a shared
 * component is for.
 *
 * **What this screen gains by instantiating it**, none of which it had:
 *   * `--scope`'s FORMAT as a placeholder — `a/**,b/**`, the CLI's own spelling
 *     (owner instruction 2026-08-24, "a grayed out hint in the fields as
 *     placeholder before user enter values").
 *   * a VISIBLE required mark. `aria-invalid` was already set here and
 *     `styles.css` had no rule for it, so an empty required box looked exactly
 *     like a filled optional one.
 *   * `bld.incomplete` where the command would be. This screen used to HIDE the
 *     `.cmd` row and say nothing — correct, and silent; walk/20 asks the pattern
 *     to "draw what that looks like rather than leaving each screen to decide".
 *   * a category picker that DISABLES itself when the corpus has no enabled
 *     category, rather than offering a list holding one em dash.
 */
import {
  CHECK_REFUSED, captionFor, commandChecker, commandHelp, controlFor, controlSpecs,
  emptyPickerNote, labelled, markRefusal, markRequired, missingRequired, paintCommand,
  readValues,
} from '/lib/builder.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { el, errorNote, num, screenHead, spaced } from '/screens/parts.js';

/**
 * The one catalogue entry this screen composes. `overlap: true` is the
 * catalogue's own marking for this screen and nothing else reads it, which is
 * why the test pins it rather than trusting this sentence.
 */
export const ADD = PALETTE.find((def) => def.name === 'add');

/**
 * `palette.js`'s debounce, to the millisecond
 * (`src/ui/public/screens/palette.js` · `const GLOB_DEBOUNCE_MS = 180;` · ~187).
 * One glob input on two screens firing a server round trip at two different
 * rhythms would be a difference no reader could explain.
 */
export const CAPTURE_DEBOUNCE_MS = 180;

/**
 * `ABSENT` — the mockup's own mark for "no value here", used as every picker's
 * blank option — lived here and lives in `lib/builder.js` now. It was declared
 * in two screens with two comments saying the same thing, which is the
 * duplication this task exists to end.
 */

/**
 * The endpoint's parse, character for character
 * (`src/ui/capture-model.ts` · `const patterns = (raw ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');` · ~231).
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
 * (`src/ui/public/screens/palette.js` · `A disabled category cannot receive an item, so offering it would compose` · ~300).
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
export function captureArgv(values) {
  return commandFor(ADD, values);
}

/**
 * The same capture as the string a reader sees.
 *
 * Split from `captureArgv` because the shared Copy control is built around an
 * ARGV rather than around a string. Both entry points refuse a half-built
 * capture, because the refusal is `commandFor`'s and neither of these has been
 * given a chance to soften it: an `add` missing its category is not a shorter
 * `add`, it is a different one.
 */
export function captureCommand(values) {
  return composeCommand(captureArgv(values));
}

/**
 * One row of the mockup's table, which has exactly two cells
 * (`docs/design/web-ui-mockup.html` · `<tr><td class="m">INV-prices-are-integer-cents</td><td class="small" data-t="cap.o1">invariant, normative</td></tr>` · ~3329).
 *
 * `detail` is the category and the tier in that order, which is the order both
 * `cap.o1` and `cap.o2` put them in. The comma and the space are punctuation;
 * every word in the string came off the response.
 */
export function rowCells(row) {
  return { id: row.id, detail: `${row.type}, ${row.tier}` };
}

/**
 * **THE FOUR FIELDS THIS SCREEN OFFERS, BY NAME, OUT OF `add`'s ELEVEN.**
 *
 * Named rather than counted, and ordered rather than filtered in place: this
 * is the answer to *what does Capture ask for*, which is a decision, and a
 * predicate over the catalogue would let a twelfth field arrive here the day
 * somebody added one to `mycontext add`. `controlSpecs(ADD)` is the population
 * and this is the choice out of it, so a field renamed in the catalogue fails
 * `specsFor()` below rather than disappearing from the screen in silence.
 *
 * `scope` is REQUIRED here and optional in the catalogue, which is not a
 * disagreement: it is optional to `mycontext add`, and it is the whole question
 * on this screen — the overlap check has nothing to ask about without it. The
 * override is spelled here, beside the choice it belongs to.
 */
export const FIELDS = ['category', 'title', 'scope', 'severity'];
const REQUIRED_HERE = new Set(['category', 'title', 'scope']);

/**
 * The four specs, in this screen's order, with the `scope` override applied.
 *
 * Fails loudly on a name the catalogue does not have: a form that silently drew
 * three controls because a field was renamed would compose a different command
 * from the one this screen is about.
 */
export function specsFor(def) {
  const byName = new Map(controlSpecs(def).map((spec) => [spec.name, spec]));
  return FIELDS.map((name) => {
    const spec = byName.get(name);
    if (spec === undefined) throw new Error(`capture: ${def.name} has no ${name} field`);
    return REQUIRED_HERE.has(name) ? { ...spec, required: true } : spec;
  });
}

/* ── the DOM half, which is the stated untested surface (spec §6) ──────────── */

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
    // to a real sentence (`src/ui/read-model-config.ts` · `if (parseError === null) {` · ~178),
    // so there is always the server's own wording to show and none of it is
    // invented here — `errorNote`'s standing rule.
    card.append(errorNote(usable
      ? String(config.parseError ?? config.resolveError) : String(config)));
    return;
  }

  // --- the four controls the mockup does not have (see the header) ---------
  //
  // **BUILT BY THE BUILDER, from the catalogue entry this screen composes.**
  // Twenty lines of hand-rolled `document.createElement` stood here and are
  // gone: what a `category` looks like is `lib/builder.js`' answer now, and it
  // is the same answer the Composer gets. The three things this screen still
  // decides are the three it is entitled to — WHICH fields (`FIELDS`), which
  // of them are required HERE (`specsFor`), and what happens when one changes.
  //
  // `sources.categories` is `/api/config`'s resolved view rather than a fetch
  // of its own, and `severity`'s vocabulary is the catalogue's own `options`,
  // so `controlFor` needs no branch for this screen: it reads the spec.

  // Every answer carries the number of the request that asked for it. Two
  // keystrokes 200ms apart are two round trips, and the SECOND one is the
  // question on screen — without this, a slow first answer landing last would
  // repaint the card with a scope the box no longer holds. Declared ABOVE the
  // controls rather than beside `look()`, because the scope box's own change
  // handler is what schedules the round trip and it is built in the loop below.
  let asked = 0;
  let timer = null;

  const sources = {
    categories: categoryOptions(config).map((name) => ({ value: name, label: name })),
  };
  const specs = specsFor(ADD);
  const controls = new Map();
  for (const spec of specs) {
    // `input: 'glob'` with NO `globId`: `.globin` is the glob input's class on
    // the Composer, and a scope pattern is the same kind of value typed into
    // the same kind of box, but the mockup's `id="globin"` is deliberately not
    // copied — screens stack in the DOM and stay there hidden, so a second
    // element carrying that id would collide with the Composer's the moment
    // both have been visited. The builder takes that id as a parameter for
    // exactly this reason.
    const control = controlFor(spec, sources, () => {
      recompose();
      if (spec.name !== 'scope') return;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void look(); }, CAPTURE_DEBOUNCE_MS);
    });
    controls.set(spec.name, { control, spec });
    card.append(labelled([captionFor(spec)], control));
    // A closed vocabulary with nothing in it is a DISABLED picker and a
    // sentence naming the field it belongs to. A corpus whose config enables no
    // category is exactly that, and this screen used to draw an operable-looking
    // list holding one em dash.
    const empty = emptyPickerNote(ctx, spec, sources);
    if (empty !== null) card.append(empty);
  }
  const scope = controls.get('scope').control;

  // --- the card the mockup draws, in its order ----------------------------

  const head = el('h3');
  const table = el('table');
  const tbody = el('tbody');
  table.append(tbody);
  const nosim = el('p', 'small');
  nosim.append(...ctx.t('cap.nosim'));
  // What the governing filter REMOVED, under the table of what it kept. Its own
  // paragraph rather than a cell, because it is a fact about the answer and not
  // a row in it — the treatment `gaps.js` gives its truncation disclosure.
  const notgov = el('p', 'small');
  notgov.hidden = true;
  // **The command area is one host the builder fills**, rather than a `.cmd`
  // row this screen hides and a control it appends after it. `paintCommand`
  // draws the row, the Copy-and-Execute control and — while a required input
  // is empty — `bld.incomplete` in place of both.
  const cmdBox = el('div');
  // **WHAT IS LEGAL, WITHOUT LEAVING THE SCREEN** (`plan:builder seq:8`). One
  // `details.help` explaining the FOUR fields this screen draws — not `add`'s
  // eleven, because a help card about controls the reader cannot see is the
  // Library's job done badly in Capture's space. Drawn by the builder out of
  // `/api/cli-help/command/add`, so every word of it is `FLAG_DECLARATIONS`
  // and the generated command summary rather than a third description written
  // here.
  const helpBox = el('div');
  card.append(head, table, notgov, spaced(nosim), helpBox, cmdBox);

  /**
   * **The CLI's own verdict on the composed line** (`plan:builder seq:6`). The
   * screen's part is one line — hand the checker the argv, repaint when it
   * answers; when to ask and what to hold while waiting are the builder's,
   * because they are properties of every command site and not of this one.
   */
  const checker = commandChecker(ctx, () => { if (root.isConnected) recompose(); });

  // Tolerant, like the overlap read is not: a refused help read costs the
  // reader an explanation and `commandHelp(null)` says so, but it must not cost
  // them the capture, which composes and copies either way.
  void (async () => {
    let body = null;
    try {
      body = await ctx.api('/api/cli-help/command/add');
    } catch { /* the keyed sentence, not a blank disclosure. */ }
    if (!root.isConnected) return;
    helpBox.replaceChildren(commandHelp(ctx, body, specs));
  })();

  /**
   * **THE COPY CONTROL IS REBUILT ON EVERY RECOMPOSITION, and that is
   * `paintCommand`'s rule rather than this screen's.**
   *
   * `commandActions` is built AROUND one command — it closes over the argv it
   * was given — and this screen's command changes on every keystroke. A control
   * left in place while the `<code>` above it changed would put a capture from
   * two keystrokes ago on the clipboard, which is worse than the hand-rolled
   * button it replaces rather than better. `paintCommand` empties its host and
   * refills it, so the argv on the clipboard is the argv on screen.
   *
   * **Capture composes `add`, and it OFFERS to run it — the decision, taken.**
   *
   * This screen was the one place `id: null` was a choice rather than a
   * consequence of the catalogue. `add` has always been in the catalogue; what
   * stood in the way was `cap.warn` — *"This is a write. Run it in your own
   * shell."* — a sentence of the DESIGN OF RECORD, drawn in the mockup's own
   * capture section, which is false the moment a button beside it runs the
   * command. Both could not stand, and choosing between them changed what the
   * mockup draws, so it was the owner's call and was reported rather than taken.
   *
   * **Ruled 2026-08-27** (`DEC-cap-warn-is-dropped-and-capture-gains-execute-the-other`):
   * drop the sentence, offer Execute. So `cap.warn` is gone from this screen,
   * from both string tables, from the mockup and from the two stylesheets —
   * `p.cmdnote` had exactly one author on either side — and it leaves
   * `KNOWN_GAPS.capture` in `screen-parity.spec.ts`, which makes that ledger
   * SHORTER.
   *
   * **What made waiting free until then is also gone.** `add` is on the approval
   * boundary, and the browser's old `COMMAND_EFFECTS` table could not say what
   * it writes, so an Execute button here would have minted a nonce and then
   * declined — a true sentence traded for a control that could not act.
   * `plan:execute seq:5b` moved the derivation to the server, which runs the
   * command against a throwaway copy. Measured that day: `add` derives in about
   * 1.3 s as one created item with every field named, with and without
   * `--yes` alike, so this screen's existing values need nothing added to them.
   */

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
    notgov.hidden = true;
    refusal = errorNote(message);
    head.before(refusal);
  };

  function recompose() {
    const values = readValues(controls);
    // **The composed `--scope` is the string the overlap check was asked
    // about**, not the keystrokes. `?scope=a/** , ,b/**` is four positions and
    // two patterns, and the endpoint answers about the two; composing the raw
    // text instead would hand over a command whose scope is not the scope the
    // card above it just reported on. So the box's value is re-read through the
    // endpoint's own parse before it reaches the values bag — the one place
    // this screen edits what the builder read.
    const patterns = scopePatterns(scope.value);
    if (patterns.length === 0) delete values.scope; else values.scope = patterns.join(',');

    // **TWO REQUIRED SETS, AND THEY ARE NOT THE SAME QUESTION.** This is the
    // one place this screen does not simply hand the builder a def, and the
    // distinction is worth stating because collapsing it would change what
    // Capture composes.
    //
    //   `specs` is what THIS SCREEN asks of the reader, `--scope` included:
    //   the overlap check has nothing to ask about without one, so an empty
    //   scope box is a field still to fill and is marked as such.
    //
    //   `ADD` is what the COMMAND requires. `mycontext add` takes `--scope` as
    //   an optional flag, so a capture with a category and a title is a
    //   complete, runnable command whether or not the reader has typed a scope,
    //   and refusing to compose it would be this screen inventing a CLI rule.
    //
    // So the marks come from the first and the command area from the second.
    // Before the builder these were the same two facts, expressed as an
    // `aria-invalid` loop over three controls and a `try/catch` around
    // `captureArgv`; nothing about what composes has changed.
    markRequired(specs, controls, values);
    const missing = missingRequired(ADD, values);
    let argv = null;
    try {
      argv = captureArgv(values);
    } catch {
      // `commandFor`'s refusal, honoured: a capture missing its category or
      // its title has no command yet, and half of one must not be copyable.
      argv = null;
    }
    // **THE CLI'S OWN VERDICT ON THE LINE** (`plan:builder seq:6`), asked only
    // once there IS a line: a half-built capture is already answered by
    // `bld.incomplete`, and asking the parser about it would produce a refusal
    // about a sentence the reader has not finished writing.
    const check = argv === null || missing.length > 0 ? null : checker.verdictFor(argv);
    markRefusal(ctx, controls, check !== null && check.state === CHECK_REFUSED ? check : null);
    // The throw is the authority, and `missing` is the same fact asked without
    // it: if the two ever disagreed, `paintCommand` would still be handed a
    // reason not to compose rather than a null argv to compose from.
    paintCommand(cmdBox, {
      argv, missing: argv === null && missing.length === 0 ? ['title'] : missing,
      ctx, id: 'add', values, check,
    });
  }

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
      notgov.hidden = true;
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
    // `notGoverning` — the count the governing filter took out. Coerced through
    // `Number` and tested for a positive integer rather than truthiness: a
    // response that omits the field and a response that sends zero are the same
    // fact here, and neither draws a sentence about nothing.
    const removed = Number(body.notGoverning);
    if (Number.isFinite(removed) && removed > 0) {
      notgov.replaceChildren(...ctx.t('cap.notgov', { n: num(removed) }));
      notgov.hidden = false;
    } else {
      notgov.replaceChildren();
      notgov.hidden = true;
    }
  }

  recompose();
  head.hidden = true;
  table.hidden = true;
}
