/**
 * `nav.ch` — **Composer**, `<section data-p="palette">` in the design of
 * record. Not "command palette": `pal.h` is *Composer* in both string tables,
 * and the rail label is `s.palette` → *Composer* too. The plan's own title is
 * "the command palette screen"; the mockup is the appearance authority and it
 * never uses that phrase on the screen, so neither does this file's output.
 *
 * Its verdict is the contract: *"real pickers and a live glob tester"*
 * (`pal.v`). Both halves are read from the running corpus — the item ids, the
 * categories, the drafts and the pending revisions are fetched, and the glob
 * tester's matching is done by the server through the very cache the selector
 * uses. Nothing on this screen is a canned example.
 *
 * ── WHAT THIS SCREEN MAY DO WITH A COMMAND, AND WHAT IT MAY NOT ───────────
 *
 * Spec §2, and `lib/palette-defs.js`' own header: **writes are COMPOSED AND
 * COPIED, never run.** What a human settles from this page is a string they
 * paste into their own shell, where their `permissions.deny` rules can still
 * see it. That is the whole reason `lib/command.js` exists and the reason
 * `test/ui/palette-lib.test.ts` scans its bytes for anything that could run,
 * send or navigate. Reads are different in kind and are executed here: they
 * fetch the endpoint that already serves the answer, or navigate to the screen
 * that already renders it.
 *
 * **The catalogue decides what is offerable, and this screen never widens it.**
 * Every control below is built from a `def.args`/`def.flags` entry in
 * `PALETTE`, so a flag the catalogue withholds cannot appear here by accident.
 * That is load-bearing rather than tidy: `review promote --all --pack <name>`
 * is a real flag pair, deliberately not offered, and the reason is written down
 * beside it (`test/ui/palette-lib.test.ts` · `bulk promotion: --all --pack <name> settles every draft a pack imported in one ` · ~694).
 * A free-text "extra flags" box on this screen would put it back within one
 * keystroke of a checkbox, which is the decision that task says is the owner's
 * and not a fill-in. `offeredFlagNames()` below exists so a test can pin that
 * from outside rather than trusting this paragraph.
 *
 * **A flag can be withheld from THIS screen without being withheld from the
 * product.** Since 2026-09-03 the catalogue carries a third field list,
 * `flagsNotOffered`, holding fields `commandFor` composes and this screen never
 * draws — `mycontext ack --all --code <code> --count <n>`, the bulk settlement
 * the owner approved as a DOCTOR CARD control, per code group
 * (`DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`). Doctor
 * draws it beside the count, the level and a sentence naming what the ruling
 * covers; the Composer draws no findings at all, so the same checkbox here would
 * settle a class nobody has looked at. That is the approval-boundary ruling
 * already recorded against `review promote --all --pack`, and the reason for
 * this trio is filed beside it in `FLAGS_NOT_OFFERED`. The mechanism is in
 * `lib/palette-defs.js` above `commandFor`; what belongs on THIS side is that
 * `controlSpecs()` reads `def.args` and `def.flags` and has no third case, so
 * the withheld list cannot reach a control by being forgotten about.
 *
 * ── THE TWO THINGS THE MOCKUP DRAWS THAT NOTHING ELSE SPECIFIES ────────────
 *
 * **1. The Arguments card.** Every argv element is its own chip, so a value
 * carrying shell syntax is visible *before* it reaches a clipboard (`pal.sub`,
 * in those words). The offending chip is `.chip.crit` and copying is refused
 * with `pal.block`, which states the reason the obvious fix does not work:
 * double-quoting does not neutralise `$(…)`, because a POSIX shell substitutes
 * inside double quotes. `quoteArg` passes a value through bare when it matches
 * one closed character set (`ui/public/lib/command.js` · `const SAFE = /^[A-Za-z0-9@%_+=:,.\/\-]+$/;` · ~24)
 * and otherwise wraps it in `"…"`, escaping backslash and quote and nothing
 * else — correct for the characters it names and no defence at all against
 * expansion. So the refusal lives here, at the point of copy, and it is drawn
 * rather than merely enforced.
 *
 * **2. The glob tester.** A pattern input, a live count, and a tree of the
 * repository's files with the matches lit as you type. `pal.globn` argues for
 * the tree over a bare number: *"a count you cannot inspect is a count you
 * cannot trust: the empty result and the nearly-empty result look identical
 * until you can see which files"*.
 *
 * **The truly-empty result is now named, not merely shown as a zero.**
 * `TASK-nine-facts-the-new-read-models-serve-that-no-string-key-can` raised it:
 * a real pattern that matches nothing is exactly what `doctor` reports as
 * `dead_scope`, and this tester could draw the zero and never say what an item
 * scoped there would actually get — nothing. `pal.globDead` is that sentence,
 * appended below `pal.globn` whenever a NON-EMPTY pattern answers zero — the
 * resting state before anyone has typed is also `total === 0` and is not this
 * finding, which is why `paintGlob` is guarded on the pattern too.
 *
 * **"Lit as you type" is plain English here, not the `.lit` primitive.** That
 * name is reserved for the literal field (repaint spec §3 primitive 3), a
 * different mechanism, and the two must not be confused by a shared class. The
 * mockup's own markup is `<div>`/`<div class="hit">` inside `.globtree`
 * (`docs/design/web-ui-mockup.html` · `<div class="globtree plate" id="globtree"></div>` · ~3361),
 * and that is what this builds.
 *
 * ── WHY THE MATCHING IS A SERVER ROUND TRIP PER KEYSTROKE ──────────────────
 *
 * `pal.globn` claims matching "goes through the same `globToRegExp` cache the
 * selector uses, over `listRepoFiles`". A browser-side glob implementation
 * would make that sentence false the day the two spellings disagreed — and
 * this repository has already paid for a second spelling of a closed rule more
 * than once. `/api/glob` IS that cache, exposed, and its docblock names itself
 * the one legitimate `matchesAnyGlob` call in this UI because the question it
 * answers is about a PATTERN and not about what governs a file
 * (`src/ui/read-model-work.ts` · ` * is "which files match this pattern" — a question about a pattern, not about` · ~232).
 * So the file list is fetched once with the universal pattern, the matches are
 * fetched again per (debounced) keystroke, and the only thing computed in the
 * browser is set membership — which is not a second opinion about globbing.
 *
 * **The list is capped at 200 files by the endpoint** and there is no paging
 * parameter (`src/ui/read-model-work.ts` · `const GLOB_SAMPLE_CAP = 200;` · ~224).
 * On a repository larger than that, `pal.globn`'s "every file in the
 * repository" is true of the COUNT — `total` is exact — and not of the tree.
 * Reported rather than papered over: nothing here invents a row it was not
 * sent, and nothing here re-walks the repository to fill one in.
 *
 * ── WHAT THIS SCREEN COULD NOT SAY, FOR WANT OF A KEY ──────────────────────
 *
 * The string tables carry exactly eight `pal.` keys and no more. This
 * paragraph said a ninth "cannot be invented here" because
 * `strings-parity.test.ts` "fails in both directions". It fails in ONE, and has
 * since 2026-08-26 —
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped the
 * invented direction and the gate's own docstring says so. Re-measured
 * 2026-08-30 under `plan:walk seq:92`.
 *
 * **A ninth key is therefore allowed, and none of the three below is written,
 * for a reason that outlives the gate: not one of them is English on a Hebrew
 * page.** Each is already drawn as data or answered by native semantics, so a
 * new key would be new product COPY — the owner's to approve under
 * `DEC-claude-drafts-the-mockup-and-the-owner-approves` — rather than a
 * translation defect to close. The three, with what each draws today:
 *
 *   - **The live count line.** The mockup fills `#globcount` from a hard-coded
 *     English/Hebrew ternary in its own script, not from its string table —
 *     "7 of 21 files match.", "Type a pattern to see what it catches.", and a
 *     `span.refusal` for the empty result. None of the three is a key, and
 *     `.refusal` is not among the classes carried into `styles.css` either. So
 *     the aria-live line here carries the two NUMBERS and nothing else, in the
 *     mockup's own monospace `en-US` grouping, and `pal.globn` immediately
 *     below says what they are — it takes the live match count in its own
 *     `{matches}` slot, which is what the mockup marks `data-v="matches"`.
 *   - **"Required inputs are missing."** The plan declares `palette.incomplete`
 *     for it; the tables never gained the key. A required control that is empty
 *     is marked with `required` and `aria-invalid` instead — native semantics a
 *     screen reader already words, and no English this file made up.
 *   - **"This one is ungated."** `lesson-accept` is on the approval boundary
 *     and takes no `--yes` at all, and the catalogue marks it `ungated` so a
 *     screen can say so instead of drawing a confirmation that does not exist.
 *     There is no key for that sentence. The absence is at least not a lie:
 *     the def advertises no `yes` flag, so no checkbox is drawn.
 *
 * ── ONE DISAGREEMENT BETWEEN THE MOCKUP AND THE REPAINT NOTE ──────────────
 *
 * The ui2 Task 12 reconciliation says the argv chip row is data and "when
 * built" should sit on `.plate`. The mockup's own markup for that row is a
 * bare `<p>` (`docs/design/web-ui-mockup.html` · `<p><span class="chip ok" data-g="●">mycontext</span> <span class="chip ok" data-g="●">add</span>` · ~3348),
 * and `styles.css` is held byte-identical to it. The mockup is the appearance
 * authority, so the bare `<p>` is what ships and the disagreement is reported
 * rather than settled here. The glob tree carries `.plate` because the mockup
 * gives it one; on that the two agree.
 */
import { composeCommand } from '/lib/command.js';
// The ONE Copy-and-Execute control (plan Task 6). This screen is the first of
// seven to adopt it, and it no longer builds a copy button of its own: nine
// hand-rolled copy sites were measured across `screens/` on 2026-08-27, and
// adding Execute to each of them would have been nine chances to get the
// confirm wrong — the confirm being the security boundary (§6.3).
import { commandActions } from '/lib/command-actions.js';
import { PALETTE, commandFor, runnableFor } from '/lib/palette-defs.js';
import { el, errorNote, num, screenHead, spaced } from '/screens/parts.js';

/**
 * `mycontext help <topic>`' four topics, which are a closed vocabulary this
 * server owns (`src/ui/read-model.ts` · `export const UI_HELP_TOPICS: UiHelpTopic[] = ['categories', 'scope', 'capture', 'workflow'];` · ~3085).
 * There is no endpoint that lists them — `/api/help/:topic` answers one at a
 * time — so the list is spelled here, in the same order, exactly as
 * `screens/learn.js` spells it for the same reason.
 */
const HELP_TOPICS = ['categories', 'scope', 'capture', 'workflow'];

/**
 * The pattern that matches every file the walk reached. `globToRegExp` turns a
 * trailing `**` into `.+` (`src/core/paths.ts` · `if (last) { re += '.+'; return; }` · ~58),
 * so this is the repository, not a sample of it — which is precisely the tree
 * `pal.globn` describes. It is also the tester's opening value, so the screen
 * arrives showing what the mockup's arrives showing: a lit tree rather than an
 * empty box. A seeded pattern DOES flow into the composed argv when the chosen
 * command takes a `--scope`, exactly as the mockup's seeded `src/billing/**`
 * flows into its own chip row — and it is the most visible argument on the
 * screen when it does, which is the whole point of drawing argv as chips.
 */
export const EVERY_FILE = '**';

/** How long a keystroke waits before the tester asks the server. */
const GLOB_DEBOUNCE_MS = 180;

/**
 * **The two characters a double-quoted POSIX word still expands.**
 *
 * `quoteArg` wraps an unsafe value in `"…"` and escapes backslash and quote.
 * Inside those quotes a shell still substitutes `$` — command substitution
 * `$(…)`, parameter expansion `${…}` and a bare `$VAR` alike — and still runs
 * a backtick pair. PowerShell expands `$` and treats the backtick as its
 * escape character. So the test is the CHARACTERS, not the three syntaxes:
 * matching `$(` alone would pass `"$HOME/keys"` through as safe, and it is
 * not.
 *
 * It over-refuses, deliberately and visibly. A title reading "cost in $USD"
 * is blocked, and the screen says why in `pal.block` rather than quietly
 * composing something whose meaning depends on the reader's environment.
 * Refusing to copy costs a rewrite; copying costs whatever the substitution
 * evaluated to.
 */
export const SHELL_ACTIVE = /[$`]/;

/** True when this argv element would still be live inside `quoteArg`'s quotes. */
export function shellUnsafe(value) {
  return typeof value === 'string' && SHELL_ACTIVE.test(value);
}

/** One chip per argv element, each knowing whether it is the offending one. */
export function argvChips(argv) {
  return argv.map((value) => ({ value, unsafe: shellUnsafe(value) }));
}

/** `pal.block`'s condition: any single unsafe element blocks the whole copy. */
export function copyBlocked(argv) {
  return argv.some(shellUnsafe);
}

/**
 * Every control a def offers, args before flags — the order `commandFor`
 * composes them in, so the form reads in the order the command does.
 *
 * **`def.flagsNotOffered` is absent here on purpose and by construction.** This
 * function is the whole population of the form, so the two lists it names are
 * the two lists a reader can be offered; a field the catalogue files under
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
 * The flag names this screen will draw a control for, for one def.
 *
 * `def.flags` and not every flag the entry can compose: this is the answer to
 * *what does the Composer offer*, which is a different question from *what can
 * this command take*. `test/ui/palette-screen.test.ts` asks it of the whole
 * catalogue and requires that no `--all` or `--pack` comes back.
 */
export function offeredFlagNames(def) {
  return def.flags.map((flag) => flag.name);
}

/**
 * The required inputs that are still empty. `commandFor` throws rather than
 * composing a half-built command, and this is the same question asked without
 * the throw, so the form can mark the controls the throw is about.
 */
export function missingRequired(def, values) {
  return controlSpecs(def)
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
 * The five picker sources, from the four read bodies that carry them.
 *
 * **Labels are built here and never translated.** An id, a category name, a
 * draft title and a revision id are the corpus's own words — the same ruling
 * `parts.js`' `TIERCHIP` records for tier names — so `tFlat` has no business
 * near them.
 *
 * A revision option carries its `revision` alongside, because
 * `review promote-revision` takes the ITEM as its operand and the revision as
 * a flag: picking "the one I just read" and composing "the oldest" would be
 * the same command with a different meaning, settled silently. The DOM half
 * fills `--revision` from this when it is still empty.
 */
export function sourceLists(bodies) {
  const items = bodies.items && Array.isArray(bodies.items.items) ? bodies.items.items : [];
  const resolved = bodies.config === null || bodies.config === undefined ? null : bodies.config.resolved;
  const categories = resolved !== null && resolved !== undefined && Array.isArray(resolved.categories)
    ? resolved.categories : [];
  const drafts = bodies.queue && Array.isArray(bodies.queue.drafts) ? bodies.queue.drafts : [];
  const revisions = bodies.revisions && Array.isArray(bodies.revisions.revisions)
    ? bodies.revisions.revisions : [];
  return {
    items: items.map((item) => ({ value: item.id, label: `${item.id} — ${item.title}` })),
    // A disabled category cannot receive an item, so offering it would compose
    // a command the CLI refuses. The config's own `enabled` is the authority.
    categories: categories.filter((c) => c.enabled === true)
      .map((c) => ({ value: c.name, label: c.name })),
    drafts: drafts.map((d) => ({ value: d.id, label: `${d.id} — ${d.title}` })),
    revisions: revisions.map((r) => ({
      value: r.itemId, label: `${r.itemId} · ${r.revisionId}`, revision: r.revisionId,
    })),
    topics: HELP_TOPICS.map((topic) => ({ value: topic, label: topic })),
  };
}

/** The revision id a revisions-sourced pick names, or `null`. */
export function revisionFor(sources, itemId) {
  const hit = (sources.revisions ?? []).find((option) => option.value === itemId);
  return hit === undefined ? null : hit.revision;
}

/**
 * What running a READ means for this def: fetch the endpoint that serves the
 * answer, or navigate to the screen that renders it. A write has neither, and
 * gets `null` — there is no third branch here, and that is the composed-not-
 * executed rule expressed as a shape rather than as a check.
 */
export function readTarget(def, values) {
  if (def.kind !== 'read') return null;
  if (typeof def.endpoint === 'function') return { kind: 'fetch', path: def.endpoint(values) };
  if (typeof def.screen === 'string') return { kind: 'navigate', hash: def.screen };
  return null;
}

/**
 * The rows a read answered, from the two body shapes the read defs reach:
 * `/api/items` and `/api/search` answer `{ items }`, `/api/item/:id` answers
 * `{ item }`. `total` is the endpoint's own when it sends one — a search that
 * matched 300 and returned 50 must not report 50 — and `truncated` is carried
 * rather than inferred, for the reason `apiSearch` states about itself: a
 * capped answer and a complete one must not be the same document.
 */
export function resultRows(body) {
  if (body !== null && typeof body === 'object' && Array.isArray(body.items)) {
    return {
      rows: body.items,
      total: typeof body.total === 'number' ? body.total : body.items.length,
      truncated: body.truncated === true,
    };
  }
  if (body !== null && typeof body === 'object'
    && body.item !== null && typeof body.item === 'object' && typeof body.item.id === 'string') {
    return { rows: [body.item], total: 1, truncated: false };
  }
  return { rows: [], total: 0, truncated: false };
}

/** The file tree with the matched paths lit. Set membership, never a glob. */
export function globRows(files, matched) {
  const lit = new Set(matched);
  return files.map((path) => ({ path, hit: lit.has(path) }));
}

/* ── the DOM half, which is the stated untested surface (spec §6) ──────────── */

/** The mockup's `<span class="chip ok" data-g="●">`, and its `crit` twin. */
function argvChip(chip) {
  const span = el('span', chip.unsafe ? 'chip crit' : 'chip ok');
  // `.chip::before{content:attr(data-g) " "}` — the glyph is data, not CSS, so
  // one class can carry two marks. `✕` is the mockup's own for the blocked
  // chip, and it is NOT `.chip.crit`'s default `■`.
  span.dataset.g = chip.unsafe ? '✕' : '●';
  // `<bdi>` on every chip, where the mockup draws one on the offending chip
  // alone. Its other value chip (`src/**`) holds arbitrary text too, and this
  // page is `dir="rtl"` in Hebrew: an id, a glob or a title with a leading
  // digit reorders around neighbouring punctuation without isolation. Same
  // element, same kind, one fewer way to be wrong.
  const bdi = document.createElement('bdi');
  bdi.textContent = chip.value;
  span.append(bdi);
  return span;
}

/**
 * A labelled control, the mockup's `<label class="small">` shape.
 *
 * `parts` is a NODE LIST, never a string, because a translated caption arrives
 * from `ctx.t()` as nodes and must stay that way — `label.append(ctx.tFlat(k))`
 * would flatten the `{m:…}` runs a caption may carry, which is owner ruling A1
 * and the defect `lib/i18n.js` records as shipped. A control's own name
 * (`category`, `--severity`) is the CLI's word rather than a translated one and
 * arrives here as a plain text node, the same call `parts.js` makes about tier
 * names.
 */
function labelled(parts, control) {
  const label = el('label', 'small');
  label.append(...parts, ' ', control);
  return label;
}

function optionEl(value, label) {
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
 */
function controlFor(spec, sources, onChange) {
  const options = pickerOptions(spec, sources);
  if (options !== null) {
    const select = document.createElement('select');
    // The blank option is the ABSENT value, not a default. `commandFor` skips
    // an empty optional and throws on an empty required one, so "—" composes
    // nothing rather than composing the first thing in the list.
    select.append(optionEl('', '—'));
    for (const option of options) select.append(optionEl(option.value, option.label));
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
  if (spec.input === 'glob') {
    control.className = 'globin';
    control.id = 'globin';
    control.spellcheck = false;
    control.autocomplete = 'off';
    control.setAttribute('aria-describedby', 'globcount');
    control.value = EVERY_FILE;
  }
  if (spec.required === true) control.required = true;
  control.addEventListener('input', onChange);
  return control;
}

/** What one control currently holds, in `commandFor`'s vocabulary. */
function valueOf(control, spec) {
  if (spec.boolean === true) return control.checked === true ? true : undefined;
  return control.value === '' ? undefined : control.value;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'pal.h', 'pal.v', 'pal.sub');

  const card = el('div', 'card pane');
  root.append(card);

  // Four reads, because the pickers are real: ids, the resolved categories,
  // the draft queue and the pending revisions are all corpus facts. One
  // failure takes the screen, in the server's own words — the same treatment
  // `status.js` and `gaps.js` give a refused read, and for the same reason: a
  // composer drawn over four empty pickers and a corpus with nothing in it are
  // different facts and must not share a rendering.
  let bodies;
  try {
    const [items, config, queue, revisions] = await Promise.all([
      ctx.api('/api/items'),
      ctx.api('/api/config'),
      ctx.api('/api/review-queue'),
      ctx.api('/api/revisions'),
    ]);
    bodies = { items, config, queue, revisions };
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }
  const sources = sourceLists(bodies);

  // --- the command picker, and the form the chosen def declares -------------

  const picker = document.createElement('select');
  for (const def of PALETTE) picker.append(optionEl(def.name, `${def.name} · ${def.kind}`));
  // `btn.compose` — *Compose* — is the caption, and it is a REUSED key rather
  // than a new one. The reason recorded here was that
  // `strings-parity.test.ts` "fails in both directions"; it fails in one, and
  // has since 2026-08-26. The reuse stands on its own merits: it is the same
  // word the gaps screen's button uses for the same act ("compose a command"),
  // and choosing WHAT to compose is what this picker does — a second spelling
  // of one word is how two screens come to disagree about it. The plan's
  // `palette.pick` — *Command* — is a THIRD name for one control and is still
  // not added, now as a choice rather than as a refusal.
  card.append(labelled(ctx.t('btn.compose'), picker));

  const form = el('div');
  const argvHead = el('h3');
  argvHead.append(...ctx.t('pal.argv'));
  const chipRow = el('p');
  const blockNote = el('p', 'small');
  const cmdBox = el('div');
  card.append(form, argvHead, chipRow, blockNote, cmdBox);

  // --- the glob tester, the mockup's nested card ----------------------------

  const globCard = el('div', 'card');
  // The mockup's `style="margin-block-start:10px;box-shadow:none;border:1px
  // solid var(--rule)"`, through CSSOM: the server sends `style-src 'self'`
  // with no `'unsafe-inline'`, so the attribute the mockup may write is one
  // this code may not.
  globCard.style.setProperty('margin-block-start', '10px');
  globCard.style.setProperty('box-shadow', 'none');
  globCard.style.setProperty('border', '1px solid var(--rule)');
  const globHead = el('h3');
  globHead.append(...ctx.t('pal.glob'));
  const globCount = el('p', 'small');
  globCount.id = 'globcount';
  globCount.setAttribute('aria-live', 'polite');
  const globTree = el('div', 'globtree plate');
  globTree.id = 'globtree';
  const globNote = el('p', 'small');
  globCard.append(globHead);
  card.append(globCard);

  // The repository's own file list, fetched once. A refusal here empties the
  // tester and says so in the server's words; it must not take the composer
  // with it, because composing a command does not depend on it. The note is
  // held rather than appended, because `build()` rebuilds this card's children
  // on every command change and would otherwise wipe it on the first one.
  let files = [];
  // The repository's SIZE, which is not `files.length`: measured against this
  // repository the walk answers `total: 690` and sends 200 of them. The
  // denominator has to be the number of files that exist, or "177 / 200" would
  // report a search of the window as a search of the corpus.
  let fileTotal = 0;
  let globError = null;
  try {
    const universe = await ctx.api(`/api/glob?pattern=${encodeURIComponent(EVERY_FILE)}`);
    files = Array.isArray(universe.sample) ? universe.sample : [];
    fileTotal = typeof universe.total === 'number' ? universe.total : files.length;
  } catch (error) {
    globError = errorNote(error.message);
  }

  /** Rising per request, so a slow answer cannot overwrite a newer one. */
  let globToken = 0;
  let globTimer = null;

  function paintGlob(rows, total, pattern) {
    globTree.replaceChildren(...rows.map((row) => el('div', row.hit ? 'hit' : null, row.path)));
    // Two numbers and no prose: the sentence the mockup prints here is not in
    // either string table (see this file's header), and `num` is the mockup's
    // own `en-US` grouping — a count that changed its separators with the UI
    // language would be a second thing to reconcile for no reader's benefit.
    globCount.replaceChildren(el('span', 'm', `${num(total)} / ${num(fileTotal)}`));
    globNote.replaceChildren(...ctx.t('pal.globn', { matches: num(total) }));
    // **The empty-result sentence, keyed since this task** — a real pattern
    // that matches no file is exactly what `doctor` reports as `dead_scope`,
    // and until now this screen could show the zero and never say what it
    // means: an item scoped there would govern nothing. Guarded on `pattern`
    // rather than on `total` alone, because `total === 0` is also the resting
    // state before anyone has typed a pattern at all, and that is not a
    // finding — it is an empty box nobody has asked a question of yet.
    if (pattern !== '' && total === 0) {
      globNote.append(' ', ...ctx.t('pal.globDead'));
    }
  }

  function testGlob(pattern) {
    clearTimeout(globTimer);
    const mine = ++globToken;
    if (pattern === '') {
      paintGlob(globRows(files, []), 0, '');
      return;
    }
    // The opening pattern is the one already answered: the universe fetch above
    // IS `/api/glob?pattern=**`, so asking again would be a second request for
    // a response already in hand — and, worse, the tree would spend the
    // debounce unlit on every arrival at this screen for an answer that was
    // never in doubt. Painted synchronously instead, from the same bytes.
    if (pattern === EVERY_FILE) {
      paintGlob(globRows(files, files), fileTotal, pattern);
      return;
    }
    globTimer = setTimeout(async () => {
      let answer;
      try {
        answer = await ctx.api(`/api/glob?pattern=${encodeURIComponent(pattern)}`);
      } catch {
        // A pattern is refused mid-typing on the way to a good one — `src/**,`
        // has an empty second term and 400s. That is a keystroke, not an error
        // state, and drawing a refusal for it would make the tester unusable
        // for exactly the patterns it exists to help write.
        return;
      }
      if (mine !== globToken || !globTree.isConnected) return;
      paintGlob(globRows(files, answer.sample ?? []), answer.total ?? 0, pattern);
    }, GLOB_DEBOUNCE_MS);
  }

  // --- building one def's form, and recomposing on every change ------------

  const controls = new Map();

  function currentValues() {
    const values = {};
    for (const [name, entry] of controls) {
      const value = valueOf(entry.control, entry.spec);
      if (value !== undefined) values[name] = value;
    }
    return values;
  }

  function recompose() {
    const def = PALETTE.find((candidate) => candidate.name === picker.value);
    const values = currentValues();

    // A revisions pick names an ITEM; `--revision` is what makes the pasted
    // line settle the revision the human read rather than the oldest. Filled
    // only when empty, so a deliberate override is never clobbered.
    const revisionEntry = controls.get('revision');
    const idSpec = def.args.find((spec) => spec.source === 'revisions');
    if (revisionEntry !== undefined && idSpec !== undefined && values.revision === undefined) {
      const revision = revisionFor(sources, values[idSpec.name]);
      if (revision !== null) {
        revisionEntry.control.value = revision;
        values.revision = revision;
      }
    }

    const missing = new Set(missingRequired(def, values));
    for (const [name, entry] of controls) {
      if (entry.spec.required === true) entry.control.setAttribute('aria-invalid', String(missing.has(name)));
    }

    // `commandFor` throws rather than composing a half-built command. The base
    // is still certain — it is the def's own words — so the chip row shows what
    // IS decided and the copyable command simply is not offered yet.
    let argv;
    try {
      argv = commandFor(def, values);
    } catch {
      argv = [...def.base];
    }
    const complete = missing.size === 0;
    const blocked = copyBlocked(argv);

    chipRow.replaceChildren(...argvChips(argv).map(argvChip));
    // Hidden rather than emptied when nothing is blocked: an empty `<p>` still
    // carries its own block margin, and a paragraph-shaped hole under the
    // chips reads as a sentence that failed to load.
    blockNote.replaceChildren();
    blockNote.hidden = !blocked;
    if (blocked) blockNote.append(...ctx.t('pal.block'));

    cmdBox.replaceChildren();
    if (!complete) {
      // **The only sentence this screen owed and did not have.** Every
      // required control already carries `aria-invalid` — correct ARIA, and
      // silent for a sighted reader: nothing on screen said WHY the command
      // box stayed empty. `pal.incomplete` is that sentence, drawn where the
      // command would otherwise be.
      const note = el('p', 'small');
      note.append(...ctx.t('pal.incomplete'));
      cmdBox.append(note);
      return;
    }

    const command = composeCommand(argv);
    const cmd = el('div', 'cmd');
    cmd.append(el('code', null, command));
    cmdBox.append(cmd);

    // **Copy and Execute, from the one control.** The copy refusal travels with
    // it as `copyBlocked` rather than as a disabled button this screen builds:
    // the measurement (`copyBlocked(argv)`, above) is the Composer's, and the
    // rendering of it is every screen's. Execute is deliberately NOT blocked by
    // the same measurement — a paste reaches a SHELL, where `$(…)` substitutes,
    // while an execution reaches `execFile` with an argv array, where it is an
    // ordinary literal.
    // **`id` is the entry's name only if the entry may RUN, and this line is
    // where the Composer stopped being the widest door in the product.**
    //
    // It read `id: def.name` for every def, which was correct for exactly as
    // long as membership in `PALETTE` was itself the execution licence. Owner
    // ruling D2 (2026-09-06) split the two, so three entries now compose here
    // and run nowhere; passing their name would draw an Execute button whose
    // only possible outcome is the server's refusal, which is a worse answer
    // than no button. `commandActions` needs no change to do this — a null id
    // has always meant Copy alone, and it has always been an ASSERTION rather
    // than a shortfall ("Nothing composed outside the catalogue may run").
    //
    // This is courtesy, not the boundary. `execute-catalogue.ts` refuses the
    // same ids on the server, and it would refuse them if this line were wrong.
    const runnable = runnableFor(def);
    cmdBox.append(commandActions({
      argv, id: runnable ? def.name : null, values, ctx, copyBlocked: blocked,
    }));
    if (!runnable) {
      // Said once, where the missing button would be. A reader who has just
      // composed a correct command and been given one control instead of two is
      // owed the reason, and "this one is yours to run" is a different sentence
      // from every refusal in this UI — nothing failed.
      const note = el('p', 'small');
      note.append(...ctx.t('pal.copyOnly'));
      cmdBox.append(note);
    }

    if (def.kind === 'write') {
      // **`cap.warn` is no longer drawn here, and that is §6.1 rather than an
      // omission.** It says *"This is a write. Run it in your own shell."* —
      // which was true of every write this UI composed until 2026-08-26, and is
      // now false beside a button that runs it. The owner's ruling widened §3.2
      // so that boundary-crossing commands execute behind the STRONGER confirm
      // rather than being refused, and a sentence telling the reader the
      // opposite of what the control beside it does is worse than no sentence.
      // The key was kept in both tables for Capture, which composed and copied
      // only. That ended on 2026-08-27: `plan:execute seq:6c` gave Capture
      // Execute too, so the sentence is false on the last screen that drew it
      // and `cap.warn` is gone from both tables, from the mockup and from both
      // stylesheets along with `p.cmdnote`, its only element.
      return;
    }

    const target = readTarget(def, values);
    if (target === null) return;
    // **The read action is a THIRD sibling of Copy and Execute, and it is drawn
    // in the same container for a reason the owner reported on 2026-08-27:**
    // this button was appended to `cmdBox`, which is a classless `<div>`, and
    // the only global button rule is `button{font:inherit;color:inherit}` — it
    // takes the app's LIGHT colour and sets NO background, so the button fell
    // back to the UA's own near-white button face and rendered as light text on
    // white. It was invisible, and only for READS, because `run` exists only
    // where `readTarget` is non-null. `.cmdactions` carries its own background,
    // which is also what makes the shared control safe to drop into seven
    // different containers.
    const runRow = el('div', 'cmdactions');
    const run = el('button');
    run.type = 'button';
    // **`pal.run`, not the Ask screen's `ask.run`.** Both used to read "Run",
    // and both still do — but they were the SAME key, so an edit meant for
    // one screen would have silently changed the other, and no test in this
    // project would have noticed: the key sets would still match and both
    // screens would still render a string. `TASK-the-six-palette-keys-the-plan-declares-and-neither-table`
    // names the general risk; this is the fix, key by key.
    run.append(...ctx.t('pal.run'));
    const results = el('div');
    run.addEventListener('click', async () => {
      if (target.kind === 'navigate') {
        ctx.navigate(target.hash);
        return;
      }
      results.replaceChildren();
      let body;
      try {
        body = await ctx.api(target.path);
      } catch (error) {
        // A read this screen composed and the server refused — an all-absent
        // `search`, say, which `apiSearch` answers by naming `/api/items` as
        // the question actually being asked. Its words, not a paraphrase.
        results.append(errorNote(error.message));
        return;
      }
      const answer = resultRows(body);
      const table = el('table');
      const caption = el('caption');
      caption.append(...ctx.t(answer.rows.length === 0 ? 'pal.noRows' : 'pal.rows', { rows: num(answer.total) }));
      const thead = el('thead');
      const headRow = el('tr');
      const th = el('th');
      th.append(...ctx.t('pal.item'));
      headRow.append(th);
      thead.append(headRow);
      const tbody = el('tbody');
      for (const row of answer.rows) {
        const tr = el('tr');
        tr.append(el('td', 'm', row.id));
        tbody.append(tr);
      }
      table.append(caption, thead, tbody);
      results.append(table);
      if (answer.truncated) {
        const capped = el('p', 'small');
        capped.append(...ctx.t('pal.truncated', { rows: num(answer.rows.length) }));
        results.append(capped);
      }
    });
    runRow.append(run);
    cmdBox.append(runRow, results);
  }

  function build() {
    const def = PALETTE.find((candidate) => candidate.name === picker.value);
    form.replaceChildren();
    controls.clear();
    let globControl = null;

    for (const spec of controlSpecs(def)) {
      const control = controlFor(spec, sources, () => {
        if (spec.input === 'glob') testGlob(control.value.trim());
        recompose();
      });
      controls.set(spec.name, { control, spec });
      if (spec.input === 'glob') {
        globControl = control;
        continue; // its home is the tester card, not the form list
      }
      const caption = document.createTextNode(`${spec.name}${spec.required === true ? ' *' : ''}:`);
      form.append(labelled([caption], control));
    }

    // The tester always draws, exactly as the mockup always draws it. When the
    // chosen command takes a `--scope` its input IS that control, so the
    // pattern being tested is the pattern being composed rather than a second
    // box that happens to look the same. When it does not, the input is the
    // tester's own and feeds nothing.
    if (globControl === null) {
      globControl = document.createElement('input');
      globControl.className = 'globin';
      globControl.id = 'globin';
      globControl.spellcheck = false;
      globControl.autocomplete = 'off';
      globControl.setAttribute('aria-describedby', 'globcount');
      globControl.value = EVERY_FILE;
      globControl.addEventListener('input', () => testGlob(globControl.value.trim()));
    }
    const globLabel = el('label', 'small');
    globLabel.setAttribute('for', 'globin');
    globLabel.append(...ctx.t('pal.pattern'));
    // The mockup wraps the input in a bare `<div>` so it takes a line of its
    // own under the label rather than sitting beside it.
    const globWrap = el('div');
    globWrap.append(globControl);
    globCard.replaceChildren(globHead, globLabel, globWrap, globCount, globTree, spaced(globNote));
    if (globError !== null) globCard.append(globError);

    testGlob(globControl.value.trim());
    recompose();
  }

  picker.addEventListener('change', build);
  build();
}
