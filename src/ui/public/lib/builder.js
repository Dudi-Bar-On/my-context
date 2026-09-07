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
 */
export function paintCommand(host, {
  argv, missing, ctx, id = null, values = {}, copyBlocked = false, ids, extra = [],
}) {
  host.replaceChildren();
  if (missing.length > 0) {
    // Drawn where the command would be, so the space is never blank. Every
    // required control is marked beside it; this is the sentence that says
    // what the marks add up to.
    const note = el('p', 'small');
    note.append(...ctx.t('bld.incomplete'));
    host.append(note);
    return null;
  }
  const cmd = el('div', 'cmd');
  cmd.append(el('code', null, composeCommand(argv)));
  host.append(cmd);
  const actions = commandActions({ argv, id, values, ctx, copyBlocked, ids });
  host.append(actions, ...extra);
  return actions;
}
