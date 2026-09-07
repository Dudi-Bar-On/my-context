/**
 * **THE BUILDER — one set of command inputs, rendered from a catalogue entry,
 * for every command site in this UI.**
 *
 * `TASK-one-builder-component-rendered-from-a-catalogue-entry` (plan:builder
 * seq:5) and `TASK-draw-the-builder-once-in-the-mockup-as-the-pattern-every`
 * (plan:walk seq:20) are one piece of work and this file is it. The behaviour
 * they name, clause by clause, is what the four exported drawing functions
 * below do:
 *
 *   * a CLOSED VOCABULARY becomes a `<select>` — `pickerOptions` decides which
 *     fields have one, and `controlFor` builds it. **And a vocabulary with
 *     nothing in it becomes a DISABLED select rather than a picker holding one
 *     em dash**, which is the state walk/20 asks to be settled once ("a SELECT
 *     for a value with a closed set, and what it looks like disabled") instead
 *     of being re-decided per screen. `emptyPickerNote` is the sentence that
 *     goes under it, because a disabled control with no explanation is exactly
 *     the silent refusal `INV-nothing-is-dropped-silently` forbids.
 *   * FREE TEXT becomes an `<input>` CARRYING ITS FORMAT AS A PLACEHOLDER —
 *     owner instruction 2026-08-24, *"a grayed out hint in the fields as
 *     placeholder before user enter values"*. The format is `spec.format` in
 *     `lib/palette-defs.js`, which is the CLI's own spelling of it: `--extra
 *     key=value`, `--valid-from YYYY-MM-DD`, `--scope "a/**,b/**"`. It is not
 *     invented here and it is not invented there either —
 *     `test/ui/builder.test.ts` runs the real command and fails the catalogue
 *     when a declared format is absent from the command's own usage line, the
 *     same derivation `test/ui/palette-lib.test.ts` already applies to every
 *     other claim that file makes.
 *   * A REQUIRED FIELD THAT IS EMPTY IS VISIBLY REQUIRED. Two marks, and they
 *     answer two different questions: the caption's `*` says *this field is
 *     required* whatever it holds, and `aria-invalid="true"` says *and it is
 *     empty right now*. The second was correct ARIA and nothing else until
 *     this task — `styles.css` had no `[aria-invalid]` rule at all, so a
 *     sighted reader saw four ordinary boxes and an empty command area. It has
 *     one now, and `markRequired` is the single place the attribute is set.
 *   * THE STATE OF THE COPY CONTROL WHILE THE COMMAND IS INCOMPLETE.
 *     `commandFor` THROWS on a half-built command rather than composing a
 *     shorter one, so there is no `.cmd` row and nothing to copy. `paintCommand`
 *     draws `bld.incomplete` in that space — the sentence, where the command
 *     would be — instead of leaving a hole each screen fills differently. That
 *     was the Composer's `pal.incomplete` and is now the builder's, for the
 *     reason this whole file exists: it is a property of the PATTERN, not of
 *     one screen.
 *   * THE COMPOSED `.cmd` ROW ITSELF, with the house's one Copy-and-Execute
 *     control under it (`lib/command-actions.js`).
 *
 * ── WHAT `plan:builder seq:6` AND `seq:8` ADDED, 2026-09-07 ────────────────
 *
 *   * **COPY IS REFUSED UNTIL THE COMMAND PASSES, AND THE REFUSAL IS
 *     READABLE** (seq 6). `bld.incomplete` above answers one question — a
 *     REQUIRED BOX IS EMPTY — and it is the only question this component could
 *     ask on its own. The other one belongs to the CLI: `POST
 *     /api/command/check` (seq 4) runs the real argument parser and answers in
 *     the CLI's own words, and it had been built, tested and left with ZERO
 *     CALLERS since 2026-09-06. `commandChecker` is its first caller,
 *     `paintCommand`'s `check` renders the verdict, and `markRefusal` puts the
 *     mark on the field the verdict names. The item's whole point is the one
 *     sentence in it: *"a copy button that is simply ABSENT tells the reader
 *     nothing about WHY."*
 *   * **EACH BUILDER SHOWS WHAT IS LEGAL, WITHOUT LEAVING THE SCREEN**
 *     (seq 8). `commandHelp` draws one `details.help` per command site out of
 *     `GET /api/cli-help/command/:id` — what the command does, what each drawn
 *     field will accept, and one worked line. Not a word of it is written here:
 *     the item forbids *"a third description of the same commands in the
 *     browser"*, so the content is `FLAG_DECLARATIONS` and the generated
 *     coverage summary, the same records the parser enforces and the Library
 *     renders.
 *
 * ── WHERE THIS CAME FROM, AND WHY IT IS A MOVE RATHER THAN A REWRITE ───────
 *
 * Both tasks say the same thing about method: *"the Capture screen already does
 * most of this — a select for the category, inputs for title and scope, a
 * select for severity. Read `screens/capture.js` first. The job is to
 * GENERALISE what is there, not to replace it."* So nothing below is new
 * logic. `controlSpecs`, `pickerOptions`, `missingRequired`, `suggestListId`,
 * `controlFor` and `valueOf` are `screens/palette.js`' own functions, moved
 * here with their reasoning intact and re-exported from that screen so its
 * tests still ask it the questions they always asked. `labelled`/`optionEl`
 * existed TWICE — once in `palette.js` and once in `capture.js`, the second
 * with a comment saying it was "rebuilt here rather than imported" because the
 * first was private to a screen. That duplication is what a component is for,
 * and it is gone.
 *
 * ── WHAT THIS FILE IS NOT ─────────────────────────────────────────────────
 *
 * It is NOT a screen and it draws no card, no heading and no layout. A screen
 * decides where the fields go, what it fetches to fill them, and what else
 * stands beside the command; the builder decides what a field LOOKS like and
 * what the command area says. The Composer keeps its argv chips, its glob
 * tester, its tag picker and its suggestion lists, because none of those is
 * "how a command site draws its inputs" — they are that screen's own contract.
 *
 * **AND IT WAS NOT DRAWN IN THE MOCKUP, deliberately.**
 * `docs/design/web-ui-mockup.html` is a FROZEN REFERENCE since 2026-09-02
 * (`DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`), which
 * names both of this task's items and supersedes their "draw it in the mockup
 * first" instruction in as many words: *"plan:walk seq:20 is the clearest
 * case, and it INVERTS rather than dying. The builder pattern is exactly a
 * not-completely-implemented feature, so the mockup is where the builder gets
 * READ … and plan:builder seq:5 is where the builder gets BUILT."* So the
 * mockup was read — `<section data-p="capture">` and `<section
 * data-p="palette">`, their `label.small`, their `.cmd` row and its Copy
 * button — and not one byte of it was written.
 */
import { composeCommand } from './command.js';
import { commandActions } from './command-actions.js';
import { helpDisclosure } from './disclosure.js';
import { el } from '../screens/parts.js';

/** The mockup's own mark for "no value here", used as every picker's blank option. */
export const ABSENT = '—';

/**
 * Every control a def offers, args before flags — the order `commandFor`
 * composes them in, so the form reads in the order the command does.
 *
 * **`def.flagsNotOffered` is absent here on purpose and by construction.** This
 * function is the whole population of a form, so the two lists it names are the
 * two lists a reader can be offered; a field the catalogue files under
 * `flagsNotOffered` has nowhere to appear. Written as an explicit pair rather
 * than as a filter over one merged list, because a filter is a rule that can be
 * relaxed by one predicate and this is meant to be a rule that has to be
 * rewritten. `commandFor` still composes the withheld fields — the Doctor card
 * needs `ack --all --code <c> --count <n>` — and that asymmetry is the point.
 */
export function controlSpecs(def) {
  return [...def.args, ...def.flags];
}

/**
 * The specs a caller means, whether it passed a def or a list.
 *
 * A screen may draw FEWER fields than a def offers — Capture draws four of
 * `add`'s eleven — and then the question "what is still missing" is about the
 * fields on screen rather than about the catalogue entry. Both callers exist,
 * so both spellings are accepted rather than one of them being made to wrap
 * the other at every call site.
 */
function specsOf(defOrSpecs) {
  return Array.isArray(defOrSpecs) ? defOrSpecs : controlSpecs(defOrSpecs);
}

/**
 * The required inputs that are still empty. `commandFor` throws rather than
 * composing a half-built command, and this is the same question asked without
 * the throw, so the form can mark the controls the throw is about.
 */
export function missingRequired(defOrSpecs, values) {
  return specsOf(defOrSpecs)
    .filter((spec) => spec.required === true)
    .filter((spec) => values[spec.name] === undefined || values[spec.name] === '')
    .map((spec) => spec.name);
}

/**
 * The option list for one control, or `null` when it is not a picker at all.
 * A `source` is corpus data fetched at render; `options` is a closed
 * vocabulary the catalogue spells; everything else is a free input or a
 * checkbox and gets no list.
 */
export function pickerOptions(spec, sources) {
  if (typeof spec.source === 'string') return sources[spec.source] ?? [];
  if (Array.isArray(spec.options)) return spec.options.map((value) => ({ value, label: value }));
  return null;
}

/**
 * The `id` of the `<datalist>` a `suggest` control reads, from the field's own
 * name. One form is on screen at a time and `controlSpecs` cannot repeat a
 * name within it — `commandFor` reads one values bag, so two fields of one name
 * could not be composed at all — so this is unique by construction rather than
 * by a counter.
 */
export function suggestListId(name) {
  return `sugg-${name}`;
}

/**
 * **The FORMAT a free-text field carries into its placeholder, or `null`.**
 *
 * `spec.format` is the CLI's own spelling — `kind=text`, `key=value`,
 * `YYYY-MM-DD`, `a/**,b/**`, `REV-...` — and a field with no format gets NO
 * placeholder rather than an invented hint. That refusal is the same one
 * `screens/config.js` already makes for the same owner instruction: its three
 * free-text fields carry the value IN FORCE as their placeholder, which is a
 * fact the server reported, and a box with nothing true to say says nothing.
 *
 * A boolean has no text box to hint at, and a picker's blank option already
 * IS its hint, so both answer `null` whatever the catalogue says.
 */
export function formatOf(spec) {
  if (spec.boolean === true) return null;
  if (typeof spec.format !== 'string' || spec.format === '') return null;
  return spec.format;
}

/**
 * A labelled control, the mockup's `<label class="small">` shape
 * (`docs/design/web-ui-mockup.html` · `<label class="small" for="globin" data-t="pal.pattern">Scope pattern</label>` · ~3357).
 *
 * `parts` is a NODE LIST, never a string, because a translated caption arrives
 * from `ctx.t()` as nodes and must stay that way — `label.append(ctx.tFlat(k))`
 * would flatten the `{m:…}` runs a caption may carry, which is owner ruling A1
 * and the defect `lib/i18n.js` records as shipped. A control's own name
 * (`category`, `--severity`) is the CLI's word rather than a translated one and
 * arrives here as a plain text node, the same call `parts.js` makes about tier
 * names.
 */
export function labelled(parts, control) {
  const label = el('label', 'small');
  label.append(...parts, ' ', control);
  return label;
}

/**
 * A field's caption: its own CLI name, an asterisk when it is required, a
 * colon. **The asterisk is the first half of "visibly required"** and it is
 * present whether or not the box is empty; `markRequired` supplies the second
 * half, which is about the value.
 *
 * A TEXT NODE and not a keyed string, and that is a ruling about WHAT it is
 * rather than about what a gate would allow: `category` and `--severity` are
 * the words `mycontext add` takes on a terminal, so a translated caption would
 * name an argument that does not exist.
 */
export function captionFor(spec) {
  return document.createTextNode(`${spec.name}${spec.required === true ? ' *' : ''}:`);
}

export function optionEl(value, label) {
  const option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  return option;
}

/**
 * The control for one arg or flag. A picker where the catalogue names a source
 * or a closed vocabulary, a checkbox for a boolean switch, a textarea for a
 * body, a text input otherwise — and `input.globin` for a `glob`, which is the
 * glob tester's own input rather than a second box saying the same thing.
 *
 * `options` is the CALLER'S half of the shape, and it exists because two
 * screens legitimately draw the same `glob` field differently. The Composer's
 * is the tester's own box — it carries `id="globin"`, an `aria-describedby`
 * pointing at the live count beside it, and the universal pattern as its
 * opening value — while Capture's is a scope the reader must type and must NOT
 * carry that id, because screens stack in the DOM and stay there hidden, so a
 * second element carrying it would collide the moment both have been visited.
 * Passing those three in beats branching on the screen's name here.
 *
 * ── **`input: 'suggest'` IS A BOX WITH A LIST**, and it is the D11 answer to
 * "picker or free text" (owner ruling 2026-09-06).
 *
 * `<input list>` + `<datalist>` rather than a `<select>` or a hand-written
 * widget, and the three reasons are the three constraints the ruling set:
 *
 *   - **The escape hatch survives.** Every field that got one has a value the
 *     command accepts and the list cannot know: `ack --clear` withdraws a
 *     ruling whose code doctor no longer reports, and `init --pack` takes any
 *     path on disk. A `<select>` would have composed a narrower command than
 *     the CLI accepts.
 *   - **Keyboard and RTL are the browser's, not ours.** A `<div role=
 *     "combobox">` owes arrow/Home/End/type-ahead, `aria-activedescendant`,
 *     and a popup that opens on the correct side under `dir="rtl"`. This owes
 *     none of them: it is an `<input>`, so it is in the tab order, and the
 *     suggestion popup is UA chrome that already follows the document's
 *     direction.
 *   - **It cannot reproduce the width defect.** `label.small select` is capped
 *     at 260px in `styles.css` because a select's min-content IS its
 *     max-content — a 942-option picker opened the page to 3,902px. An
 *     `<input>` has no such floor: its box is its box and the suggestions are
 *     drawn in a popup outside the layout entirely.
 *
 * ── **AN EMPTY VOCABULARY IS A DISABLED PICKER**, new with this component ──
 *
 * `pickerOptions` answers `[]` for a source the corpus has nothing in — no
 * draft in the review queue, no pending revision, no imported pack. Until this
 * file that drew an ENABLED `<select>` holding one option, the em dash, which
 * is a control that looks operable, is not, and says nothing about why. The
 * `<select>` is disabled now and `emptyPickerNote` says what the list is empty
 * OF, which is the state walk/20 asked to be settled once for every screen
 * rather than per screen.
 *
 * It is deliberately NOT extended to `suggest` boxes. Their whole ruling is
 * that the box takes a value the list cannot know, so an empty list is a box
 * with no suggestions rather than a field with nothing to say — and disabling
 * it would remove the escape hatch that is the reason those fields are boxes.
 */
export function controlFor(spec, sources, onChange, options = {}) {
  const format = formatOf(spec);
  if (spec.input === 'suggest') {
    const box = document.createElement('input');
    box.type = 'text';
    box.className = 'suggin';
    box.spellcheck = false;
    box.autocomplete = 'off';
    box.setAttribute('list', suggestListId(spec.name));
    if (format !== null) box.setAttribute('placeholder', format);
    if (spec.required === true) box.required = true;
    box.addEventListener('input', onChange);
    return box;
  }
  const picker = pickerOptions(spec, sources);
  if (picker !== null) {
    const select = document.createElement('select');
    // The blank option is the ABSENT value, not a default. `commandFor` skips
    // an empty optional and throws on an empty required one, so "—" composes
    // nothing rather than composing the first thing in the list.
    select.append(optionEl('', ABSENT));
    for (const option of picker) select.append(optionEl(option.value, option.label));
    // Nothing to choose is not the same as choosing nothing; see the header.
    select.disabled = picker.length === 0;
    select.addEventListener('change', onChange);
    return select;
  }
  if (spec.boolean === true) {
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.addEventListener('change', onChange);
    return box;
  }
  const control = spec.input === 'textarea'
    ? document.createElement('textarea')
    : document.createElement('input');
  // **`type="text"` EXPLICITLY, and it is load-bearing rather than tidy.** An
  // `<input>` with no `type` attribute behaves as text and does not MATCH
  // `input[type="text"]`, which is how `e2e/capture-execute.spec.ts` finds the
  // title box. `capture.js` set it and `palette.js` did not, so the two screens
  // built two subtly different elements for one catalogue field — exactly the
  // divergence this component exists to end, caught by the browser rather than
  // by reading either file.
  if (spec.input !== 'textarea') control.type = 'text';
  if (spec.input === 'glob') {
    control.className = 'globin';
    control.spellcheck = false;
    control.autocomplete = 'off';
    if (typeof options.globId === 'string') control.id = options.globId;
    if (typeof options.describedBy === 'string') {
      control.setAttribute('aria-describedby', options.describedBy);
    }
    if (typeof options.value === 'string') control.value = options.value;
  }
  // `.tagin` is the treatment `#focustags` already carries and `.globin` before
  // it: mono, LTR and bidi-ISOLATED, because a comma-separated tag list is a
  // machine value and must read left-to-right inside a Hebrew page without
  // reordering the words around it. The picker that fills it is built by the
  // SCREEN rather than here — this function returns ONE control, and `valueOf`
  // reads exactly this element, which is what keeps the box the model.
  if (spec.input === 'tags') {
    control.className = 'tagin';
    control.spellcheck = false;
    control.autocomplete = 'off';
  }
  // **The placeholder, and the one thing it must never be.** It is set only
  // when the box is EMPTY of a real value — a `glob` control the caller seeded
  // shows its seed — because a placeholder that never appears is a hint nobody
  // reads and a placeholder over a value is not a thing browsers draw at all.
  if (format !== null && control.value === '') control.setAttribute('placeholder', format);
  if (spec.required === true) control.required = true;
  control.addEventListener('input', onChange);
  return control;
}

/** What one control currently holds, in `commandFor`'s vocabulary. */
export function valueOf(control, spec) {
  if (spec.boolean === true) return control.checked === true ? true : undefined;
  return control.value === '' ? undefined : control.value;
}

/**
 * Every drawn control's value, as the bag `commandFor` reads.
 *
 * `controls` is the `Map<name, {control, spec}>` a screen fills as it builds
 * its form — the shape `screens/palette.js` has always kept — so this is the
 * one place a form is READ and `valueOf` has one caller.
 */
export function readValues(controls) {
  const values = {};
  for (const [name, entry] of controls) {
    const value = valueOf(entry.control, entry.spec);
    if (value !== undefined) values[name] = value;
  }
  return values;
}

/**
 * **The second half of "visibly required": mark the required controls that are
 * empty RIGHT NOW, and answer which they were.**
 *
 * `aria-invalid` on the control itself, which is what a screen reader words and
 * what `styles.css` now paints — `input[aria-invalid="true"]` and its siblings
 * carry the same inset warn rule `td.stale` already spends on a field that
 * needs looking at. Set on every required control on every paint, `false`
 * included: an attribute that is only ever added is an attribute that never
 * comes off once a reader fills the box.
 */
export function markRequired(defOrSpecs, controls, values) {
  const missing = missingRequired(defOrSpecs, values);
  const empty = new Set(missing);
  for (const [name, entry] of controls) {
    if (entry.spec.required !== true) continue;
    entry.control.setAttribute('aria-invalid', String(empty.has(name)));
  }
  return missing;
}

/**
 * The sentence under a picker whose vocabulary is empty, or `null` when there
 * is nothing to say.
 *
 * `p.aside` is the shape the Composer's suggestion notes already use, so this
 * adds no selector `styles.css` would have to gain. The field's own name goes
 * into the sentence as the CLI's word, unfixed and untranslated, for
 * `captionFor`'s reason.
 */
export function emptyPickerNote(ctx, spec, sources) {
  const picker = pickerOptions(spec, sources);
  if (picker === null || picker.length > 0) return null;
  if (spec.input === 'suggest') return null;
  const note = el('p', 'aside');
  note.append(...ctx.t('bld.noopts', { field: spec.name }));
  return note;
}

/**
 * **A RUN OF TEXT THIS APP DID NOT CHOOSE THE LANGUAGE OF.**
 *
 * The CLI's own refusal, a flag's declared note, a command's generated summary:
 * every one of them is English written elsewhere, and on the Hebrew page all of
 * it sits inside an RTL flow where an English sentence renders its trailing
 * full stop at the WRONG END — `.precedence` rather than `precedence.`
 *
 * `dir="auto"` is `screens/cli-help.js`' own repair for exactly this, measured
 * there in Chromium on 2026-09-07 (the period closing one note laid out 70px to
 * the LEFT of the letter before it). The browser infers the direction from the
 * run's first strong character, so an English refusal reads left-to-right and a
 * Hebrew category description reads right-to-left, on either page. Applied to
 * the RUN rather than to the paragraph, so the keyed sentence beside it keeps
 * the page's own direction.
 */
export function foreignRun(text) {
  const run = el('span');
  run.setAttribute('dir', 'auto');
  run.append(String(text ?? ''));
  return run;
}

/* ══ builder/6 — COPY IS REFUSED UNTIL THE COMMAND PASSES ══════════════════ */

/**
 * The four states a composed line can be in as far as the CLI's own parser is
 * concerned. Exported as constants rather than spelled at each comparison,
 * because `plan:builder seq:11` (D12) asserts them by name and a typo in a
 * string literal is a branch that silently never runs.
 */
export const CHECK_PENDING = 'pending';
export const CHECK_PASSED = 'passed';
export const CHECK_REFUSED = 'refused';
export const CHECK_UNREADABLE = 'unreadable';

/**
 * How long a form stays still before its line is sent to the checker.
 *
 * `capture.js`' own `CAPTURE_DEBOUNCE_MS` is 200 for the overlap read; this is
 * shorter because the answer gates a CONTROL rather than filling a card, and a
 * Copy button that stays refused after the reader has stopped typing reads as
 * broken rather than as careful.
 */
export const CHECK_DEBOUNCE_MS = 180;

/**
 * **The verdict source: would the CLI accept the line this form is composing?**
 *
 * `TASK-copy-is-refused-until-the-command-passes-and-the-refusal-is`
 * (plan:builder seq:6). Its instruction is that the refusal to show is *"the
 * CLI'S OWN REFUSAL TEXT"* from seq 4 — `POST /api/command/check`, which had
 * been built, tested and left with ZERO CALLERS in any screen since 2026-09-06.
 * This is its first one.
 *
 * ── WHY A VERDICT OBJECT RATHER THAN A PROMISE PER PAINT ──────────────────
 *
 * `recompose()` is SYNCHRONOUS and runs on every keystroke; the check is a
 * round trip. So the paint reads a verdict that is already settled, or draws
 * the pending state and is called again when one arrives — the same shape
 * `paintSuggest` uses for its lazy sources, and for the same reason: a screen
 * that awaited the answer would be a form that stops accepting keystrokes.
 *
 * ── ONE SETTLED VERDICT, KEYED ON THE EXACT ARGV ──────────────────────────
 *
 * Not a cache of many, and not a key cleverer than the whole line. The
 * endpoint's own header says it checks flag NAMES, so a key made of the command
 * and its flag set would be sound TODAY and would silently go stale the day the
 * endpoint checked one more thing — a caching rule that has to be re-derived
 * from someone else's contract is a caching rule that will be wrong once. The
 * whole argv cannot be wrong, and holding ONE settled verdict rather than a map
 * means there is no eviction policy to get wrong either. A reader who types a
 * character and deletes it pays one more round trip to a loopback route that
 * opens no store and spawns no process.
 *
 * ── THE FOUR STATES, AND WHY THE FAILED READ ALLOWS THE COPY ──────────────
 *
 * `CHECK_REFUSED` and `CHECK_PENDING` both hold the Copy control: the line has
 * not passed, and "not yet" and "no" are both "not". `CHECK_UNREADABLE` does
 * NOT, and that asymmetry is deliberate — the check failing is THIS app's
 * failure, and refusing a reader their own composed line because our own
 * endpoint fell over would be a refusal with no unblocking condition they could
 * act on. It says so instead, in the server's own words.
 *
 * `onSettled` is the screen's own recompose. It fires only when the answer is
 * still about the line the form holds, so an answer overtaken by a keystroke
 * repaints nothing.
 */
export function commandChecker(ctx, onSettled) {
  /** The line the form is composing right now, as its own JSON. */
  let wanted = null;
  /** The line `verdict` is about — never assumed to be `wanted`. */
  let settledLine = null;
  let verdict = null;
  let timer = null;

  function send(line, argv) {
    void (async () => {
      let answer;
      try {
        const body = await ctx.post('/api/command/check', { argv });
        answer = body.ok === true
          ? {
            state: CHECK_PASSED,
            command: body.command ?? null,
            unchecked: Array.isArray(body.unchecked) ? body.unchecked : [],
          }
          : {
            state: CHECK_REFUSED,
            // The CLI's own sentence, unedited. A second, weaker wording
            // composed for the browser would waste the effort this project has
            // spent making the first one good — seq 4's own argument.
            error: String(body.error ?? ''),
            flag: typeof body.flag === 'string' ? body.flag : null,
            command: body.command ?? null,
          };
      } catch (error) {
        answer = { state: CHECK_UNREADABLE, error: error.message };
      }
      // Overtaken by a keystroke: the answer is true of a line nobody is
      // looking at, so it is dropped rather than painted over the current one.
      if (line !== wanted) return;
      settledLine = line;
      verdict = answer;
      onSettled();
    })();
  }

  return {
    /**
     * The verdict for this argv, or `null` when there is no command to check.
     * Asks for one, debounced, when this line has not been asked about.
     */
    verdictFor(argv) {
      if (!Array.isArray(argv) || argv.length < 2) { wanted = null; return null; }
      const line = JSON.stringify(argv);
      if (line === settledLine) return verdict;
      if (line !== wanted) {
        wanted = line;
        if (timer !== null) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          if (wanted === line) send(line, argv);
        }, CHECK_DEBOUNCE_MS);
      }
      return { state: CHECK_PENDING };
    },
    /** For a screen that is being torn down, and for a test that must not leak a timer. */
    stop() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      wanted = null;
    },
  };
}

/**
 * **The other half of seq 6: the refusal, next to the field that caused it.**
 *
 * The item asks for the CLI's sentence *"next to the field that caused it where
 * that can be determined"*, and `POST /api/command/check` is what makes that
 * determinable rather than guessed: an `unknown-option` verdict carries `flag`,
 * the flag's own name, which is exactly the key `controls` is built under.
 * Where the verdict names no flag — an unknown command, an unknown subcommand —
 * nothing is marked, because a mark on an arbitrary field would be worse than
 * the sentence in the command area alone.
 *
 * Two effects, and they are the two `markRequired` already established for the
 * other kind of "this field is why": `aria-invalid` on the control, which is
 * what a screen reader words and what `styles.css` paints as an inset `--warn`
 * bar, and a short keyed sentence under it. The sentence is `p.aside.bldwhy` —
 * `.aside` is the register every note under a control on these screens already
 * uses, and `.bldwhy` is a marker this function removes by, so a refusal that
 * moves from one field to another leaves nothing behind on the first.
 *
 * **It runs AFTER `markRequired` and only ever clears what that did not set.**
 * An empty required box and a refused flag are two different facts wearing one
 * attribute; the required half owns every control the def marks required, and
 * this half owns the rest. Clearing indiscriminately here would take the
 * empty-required marks off on every paint that had a verdict.
 *
 * Answers the control it marked, or `null`.
 */
export function markRefusal(ctx, controls, refusal) {
  const flag = refusal === null || refusal === undefined ? null : refusal.flag;
  for (const [name, entry] of controls) {
    const holder = entry.control.closest('label') ?? entry.control;
    const after = holder.nextElementSibling;
    if (after !== null && after.classList.contains('bldwhy')) after.remove();
    if (entry.spec.required !== true && name !== flag) entry.control.removeAttribute('aria-invalid');
  }
  if (typeof flag !== 'string') return null;
  const entry = controls.get(flag);
  if (entry === undefined) return null;
  entry.control.setAttribute('aria-invalid', 'true');
  const holder = entry.control.closest('label') ?? entry.control;
  if (holder.parentNode === null) return entry.control;
  const note = el('p', 'aside bldwhy');
  note.append(...ctx.t('bld.refusedhere'));
  holder.after(note);
  return entry.control;
}

/* ══ builder/8 — EACH BUILDER SHOWS WHAT IS LEGAL ══════════════════════════ */

/**
 * The `FlagView` rows that belong to the entry a screen is drawing, by flag
 * name — flat command, per-workspace `edit`, or the one subcommand of a
 * subcommand command.
 *
 * `GET /api/cli-help/command/:id` answers about `review`, not about `review
 * promote`, because `review` is what the CLI dispatches. The Composer's
 * catalogue names the subcommand in `def.base[2]`, so the screen passes it and
 * this picks the row set the reader is actually filling in. Without that, the
 * `promote` form would be explained with the union of every `review`
 * subcommand's flags, which is a table that is wrong about the screen it is on.
 */
function flagViewsOf(help, subcommand) {
  if (Array.isArray(help.subcommands)) {
    const chosen = help.subcommands.find((row) => row.subcommand === subcommand);
    return new Map((chosen?.flags ?? []).map((view) => [view.flag, view]));
  }
  return new Map((Array.isArray(help.flags) ? help.flags : []).map((view) => [view.flag, view]));
}

/** The worked line that belongs beside those rows, or `null`. */
function workedLineOf(help, subcommand) {
  const worked = Array.isArray(help.worked) ? help.worked : [];
  if (Array.isArray(help.subcommands)) {
    // `read-model-cli-help.ts` composes `worked` by the SAME `Object.entries`
    // walk it composes `subcommands` by, so row *i* of one is the line of row
    // *i* of the other. Read by index rather than by re-deriving the order.
    const i = help.subcommands.findIndex((row) => row.subcommand === subcommand);
    return i >= 0 ? worked[i] ?? null : null;
  }
  return worked[0] ?? null;
}

/**
 * **WHAT MAY BE PUT IN ONE FIELD, in one sentence, from a record.**
 *
 * Six answers and every one of them is read off something: `FLAG_DECLARATIONS`
 * through `/api/cli-help` (`values`, `source`, `format`+`example`, and whether
 * the flag takes a value at all), and the Composer's own catalogue for a
 * POSITIONAL, which the flag declarations do not cover and which
 * `test/ui/builder.test.ts` already derives from the command's usage line.
 *
 * The order is deliberate: a closed set beats a shape, and a shape beats "the
 * command decides". `bld.hopen` is the honest floor rather than an invented
 * hint — the same refusal `formatOf` makes when a field has no format.
 */
function legality(ctx, spec, view) {
  const values = view?.values ?? (Array.isArray(spec.options) ? spec.options : null);
  if (Array.isArray(values) && values.length > 0) {
    return ctx.t('bld.hone', { values: values.join(', ') });
  }
  const source = view?.source ?? spec.source;
  if (typeof source === 'string' && source !== '') return ctx.t('bld.hsource', { source });
  if (typeof view?.format === 'string' && typeof view?.example === 'string') {
    return ctx.t('bld.hformat', { format: view.format, example: view.example });
  }
  const shape = formatOf(spec);
  if (shape !== null) return ctx.t('bld.hshape', { format: shape });
  if (view?.takesValue === false || spec.boolean === true) return ctx.t('bld.hswitch');
  return ctx.t('bld.hopen');
}

/**
 * **THE DISCLOSURE THAT SAYS WHAT IS LEGAL, WITHOUT LEAVING THE SCREEN.**
 *
 * `TASK-each-builder-shows-what-is-legal-without-leaving-the-screen`
 * (plan:builder seq:8), owner instruction 2026-08-24: *"there are missing help
 * examples on those screens and the user does not know what is the correct
 * format what is legal and what is not"*.
 *
 * ── NOT ONE SENTENCE HERE IS WRITTEN BY THIS FILE ─────────────────────────
 *
 * The item's binding warning is *"do not write a third description of the same
 * commands in the browser — that is precisely the drift this plan is about"*.
 * So every word of content below comes off `GET /api/cli-help/command/:id`,
 * which reads `COMMAND_FLAGS`, `FLAG_DECLARATIONS` and `editFlagSurface(config)`
 * — the same records the parser enforces and the same ones the Library's
 * command-line screen renders. What this function contributes is the eight
 * keyed CONNECTIVES ("one of", "takes", "a switch") and the layout. A flag
 * gains a note in `core/command-flags.ts` and it reaches this disclosure with
 * nobody editing a catalogue, which is `builder/2`'s DERIVE-DO-NOT-COPY rule
 * one surface along.
 *
 * ── AND IT USES THE AFFORDANCE THAT ALREADY EXISTS ────────────────────────
 *
 * The item: *"follow the mockup's existing affordance for this rather than
 * inventing one: `details.help` with its `.helpbox` is already the design of
 * record's answer to 'explain this without leaving the screen', and it is
 * already carried in `styles.css`"*. `lib/disclosure.js` is that shape built
 * once, with the print rule that forces every one of them open on paper, so
 * this is a call rather than a fifth hand-rolled `<details>`.
 *
 * ── ONLY THE FIELDS THIS SCREEN DREW ──────────────────────────────────────
 *
 * `specs` is the screen's own list, which is why Capture's disclosure explains
 * four fields and not `add`'s eleven. A help card that explained flags the
 * reader cannot see would be the Library's job done badly in the Composer's
 * space; the Library is where the whole surface is read.
 *
 * `help` is `null` when the read was refused — a keyed sentence saying so and
 * naming that nothing about the command changed, rather than a disclosure that
 * opens onto nothing.
 */
export function commandHelp(ctx, help, specs, subcommand = null) {
  const body = [];
  if (help === null || help === undefined) {
    const note = el('p', 'aside');
    note.append(...ctx.t('bld.helpnone'));
    body.push(note);
    return helpDisclosure(ctx, 'bld.help', body);
  }
  // What the command DOES — `readCommandSummaries()`' own sentence, generated
  // from the CLI/UI coverage document. `null` where that could not be read, and
  // then no paragraph rather than a blank one.
  if (typeof help.what === 'string' && help.what !== '') {
    const what = el('p', 'aside');
    what.append(foreignRun(help.what));
    body.push(what);
  }
  const views = flagViewsOf(help, subcommand);
  // Exclusivity, from `FlagDeclaration.group` — and named by the MEMBERS a
  // reader can see rather than by the group's internal identifier, because
  // `detail` is a word in this codebase and `--full, --short, --summary` is the
  // answer to "why can I not have both".
  const groups = new Map();
  for (const spec of specs) {
    const group = views.get(spec.name)?.group;
    if (typeof group !== 'string') continue;
    groups.set(group, [...(groups.get(group) ?? []), spec.name]);
  }
  for (const spec of specs) {
    const view = views.get(spec.name);
    const row = el('p', 'aside');
    // The field's own CLI name, mono and unfixed — `captionFor`'s ruling, for
    // `captionFor`'s reason: `--severity` is the word the terminal takes.
    row.append(el('b', 'm', spec.name), ' — ', ...legality(ctx, spec, view));
    const group = view?.group;
    const members = typeof group === 'string' ? groups.get(group) ?? [] : [];
    if (members.length > 1) row.append(' ', ...ctx.t('bld.hgroup', { flags: members.join(', ') }));
    if (typeof view?.note === 'string' && view.note !== '') row.append(' ', foreignRun(view.note));
    body.push(row);
  }
  const worked = workedLineOf(help, subcommand);
  const example = worked === null || typeof worked.command !== 'string'
    ? [] : [el('code', 'm', worked.command)];
  return helpDisclosure(ctx, 'bld.help', body, { example });
}

/* ══ builder/17 — THE CHOSEN VALUE IS READ BACK, AT FULL WIDTH ═════════════ */

/**
 * The paragraph a `suggest` box echoes its chosen value into. Built empty and
 * hidden; `paintEcho` fills it.
 */
export function echoLine() {
  const line = el('p', 'sugecho');
  line.hidden = true;
  return line;
}

/**
 * **WHAT YOU PICKED, UNDER THE BOX, AT FULL WIDTH** (plan:builder seq:17).
 *
 * ── THE MEASUREMENT, AND WHY THE OBVIOUS FIX IS THE WRONG ONE ─────────────
 *
 * The item measured it: 986 ids in this corpus, 58 characters on average and 67
 * at the longest, needing about 615px; `.card .suggin` renders at about 318px
 * (`src/ui/public/styles.css` · `.card .suggin{inline-size:min(320px,100%);min-inline-size:0}`). So less than
 * half a typical id is visible — and under `dir="rtl"` the box is bidi-isolated
 * and LTR, so what shows is the TAIL, which is the LEAST distinguishing part
 * because every id in a category shares its prefix. Filtering works; reading
 * back what you chose does not, *"and that is the half nobody weighed"*.
 *
 * **Widening the control is the trap, and it is ruled out rather than merely
 * not chosen.** The owner's ruling, taken 2026-09-07: echo the value
 * underneath, do not widen the box. This screen has been broken twice by a
 * control wider than its column — a 942-option `<select>` at 3,902px, and a
 * 600-character example line at 1,325px of overflow — and a 615px box on a card
 * that also holds a two-column form is the third attempt at the same mistake.
 * A paragraph under the control has no shrink-to-fit floor at all: it wraps.
 * The item's own words for the size of this: *"a paragraph rather than a layout
 * fight"*.
 *
 * ── AND THE HINT COMES WITH IT ────────────────────────────────────────────
 *
 * `<datalist>` rows already carry the item's TITLE as their hint, and the
 * browser stops showing it the moment the popup closes. So the echo carries it
 * too — in a `<bdi>`, because a title is corpus text whose language this app
 * did not choose, while the id beside it is a machine value and stays LTR
 * through `{mv:value}`. A typed value the list does not carry echoes alone and
 * says nothing about being unlisted: the escape hatch is the D11 ruling, not a
 * mistake to warn about.
 */
export function paintEcho(node, ctx, value, hint) {
  node.replaceChildren();
  if (typeof value !== 'string' || value === '') {
    node.hidden = true;
    return node;
  }
  node.hidden = false;
  node.append(...ctx.t('bld.picked', { value }));
  if (typeof hint === 'string' && hint !== '') {
    const title = document.createElement('bdi');
    title.append(hint);
    node.append(' — ', title);
  }
  return node;
}

/**
 * **THE COMMAND AREA — the `.cmd` row and the Copy control, or the sentence
 * that says why there is neither.**
 *
 * This is the clause walk/20 puts most plainly: *"the state of the COPY
 * control while the command is incomplete. The Capture screen already behaves
 * correctly here — `captureCommand` THROWS on a half-built capture so there is
 * no `.cmd` row and nothing to copy — and the pattern should draw what that
 * looks like rather than leaving each screen to decide."* Capture decided to
 * HIDE the row and say nothing; the Composer decided to draw `pal.incomplete`.
 * Both were defensible and they were two answers to one question. This is the
 * one answer, and it is the Composer's, because a reader owed an empty command
 * box is owed the reason for it.
 *
 * `host` is emptied and refilled rather than mutated in place, and that is not
 * tidiness: `commandActions` closes over the argv it was given, so a control
 * left standing while the `<code>` above it changed would put a command from
 * two keystrokes ago on the clipboard.
 *
 * `extra` is the caller's own nodes, appended after the control — the
 * Composer's `pal.copyOnly` note is the one that exists. It is a parameter
 * rather than a branch here because "this entry is not licensed to run" is a
 * fact about the catalogue that the screen already reads.
 *
 * Answers the `.cmdactions` element when it drew one, and `null` when the
 * command is incomplete — so a caller that wants to reach the control it just
 * asked for does not have to query the DOM for it.
 *
 * ── `check` — THE CLI'S OWN VERDICT ON THIS LINE (plan:builder seq:6) ──────
 *
 * `commandChecker`'s answer, or `null` for a caller that does not check at all.
 * It decides three things here and they are three because the item asks for
 * three: whether the Copy control is offered, WHY it is not, and in whose
 * words. The refusal is drawn UNDER the composed line rather than instead of it
 * — a reader owed a reason is also owed the line the reason is about, and
 * hiding it would be the "copy button that is simply absent" this item exists
 * to end, wearing a sentence.
 *
 * **A refusal draws no `.cmdactions` at all, Execute included.** `copyBlocked`
 * disables Copy alone, deliberately, because a paste reaches a shell where
 * `$(…)` substitutes while `execFile` takes it as a literal — that argument is
 * about a SAFE line spelled dangerously. This is a line the parser says the CLI
 * would refuse, and offering to run it would be offering a button whose only
 * possible outcome is the same refusal from further away.
 *
 * **A passed line still says what was not checked**, in one sentence, because
 * `read-model-command.ts` asks for exactly that: *"a checker that answers
 * `ok: true` without saying what it looked at invites the caller to read it as
 * 'this command will do what the form says' … an over-read `true` is worse than
 * a refusal: it is a green light for a line nobody checked."*
 */
export function paintCommand(host, {
  argv, missing, ctx, id = null, values = {}, copyBlocked = false, ids, extra = [],
  check = null,
}) {
  const pending = check !== null && check.state === CHECK_PENDING;
  const refused = check !== null && check.state === CHECK_REFUSED;
  // `missing` is the authority and the null argv is the same fact asked without
  // it — Capture reaches here with `argv: null` when `commandFor` threw, and
  // both spellings must land on the sentence rather than on `composeCommand`.
  const composed = missing.length > 0 || !Array.isArray(argv) ? null : composeCommand(argv);

  // ── A COMMAND AREA IN THE MIDDLE OF A CONFIRMATION IS NOT REDRAWN ────────
  //
  // **Found in a browser, and it was a real defect rather than a test's
  // fussiness.** Until seq 6 every repaint of this host was caused by the
  // reader's own keystroke, so emptying it could not take anything away that
  // the same keystroke had not already invalidated. The CHECK is the first
  // repaint nobody asked for: its verdict lands about `CHECK_DEBOUNCE_MS`
  // after the last edit, which is exactly the window in which a person fills
  // the last field and immediately presses Execute. `commandActions` renders
  // its confirm INLINE, inside this host — deliberately, so the question is
  // asked where the button that asked it is — so `host.replaceChildren()`
  // deleted the confirmation out from under them.
  //
  // Measured on `e2e/execute.spec.ts`'s boundary-command test: seven of its
  // tests failed, and all seven passed again the moment the verdict was
  // prevented from landing during the run.
  //
  // So: when the line has not changed and this host is holding an OPEN confirm
  // or an execution outcome, the controls stand and only the check's own
  // sentence is refreshed. `dataset.cmdkey` is `commandActions`' own identity
  // for a control — the composed line — so "the same line" is its answer and
  // not a second opinion. Both are `hidden` until they have something to say,
  // which is why the selector tests for that rather than for their presence.
  //
  // A REFUSAL still redraws, and that is the one case worth taking the control
  // away for: a line the parser says the CLI would refuse must not keep an
  // Execute button, and a confirm standing over it would be asking the reader
  // to approve something that cannot succeed.
  const standing = host.querySelector('.cmdactions');
  const mid = standing !== null
    && standing.querySelector('.confirm:not([hidden]), .execresult:not([hidden])') !== null;
  if (composed !== null && !refused && mid && standing.dataset.cmdkey === composed) {
    // The first direct-child `<button>` is Copy — `commandActions` appends it
    // before Execute, the confirm and the result, and every button after it is
    // inside one of those. Classless by that file's own ruling, so position is
    // the only handle there is.
    const copy = standing.querySelector(':scope > button');
    if (copy !== null) copy.disabled = copyBlocked || pending;
    paintCheckNote(host, ctx, check);
    return standing;
  }

  host.replaceChildren();
  if (composed === null) {
    // Drawn where the command would be, so the space is never blank. Every
    // required control is marked beside it; this is the sentence that says
    // what the marks add up to.
    const note = el('p', 'small');
    note.append(...ctx.t('bld.incomplete'));
    host.append(note);
    return null;
  }
  const cmd = el('div', 'cmd');
  cmd.append(el('code', null, composed));
  host.append(cmd);
  if (refused) {
    const note = el('p', 'small spill');
    note.append(...ctx.t('bld.refused'), ' ', foreignRun(check.error));
    host.append(note, ...extra);
    return null;
  }
  const actions = commandActions({
    argv, id, values, ctx, copyBlocked: copyBlocked || pending, ids,
  });
  host.append(actions);
  paintCheckNote(host, ctx, check);
  host.append(...extra);
  return actions;
}

/**
 * The one sentence the check leaves under the controls, replacing whatever it
 * left there last time.
 *
 * Its own function because it is written on two paths — a full redraw, and the
 * refresh that leaves an open confirm standing — and a second copy of the
 * three-way branch is how the two paths come to say different things about one
 * verdict. `p.aside.bldcheck` rather than a bare `p.aside`: this host also
 * carries the Composer's `pal.copyOnly` note in `extra`, and a selector that
 * could not tell them apart would delete that one instead.
 */
function paintCheckNote(host, ctx, check) {
  for (const old of host.querySelectorAll('.bldcheck')) old.remove();
  if (check === null) return;
  const note = el('p', 'aside bldcheck');
  if (check.state === CHECK_PENDING) note.append(...ctx.t('bld.checking'));
  else if (check.state === CHECK_UNREADABLE) {
    note.append(...ctx.t('bld.uncheckable'), ' ', foreignRun(check.error));
  } else note.append(...ctx.t('bld.checked'));
  host.append(note);
}
