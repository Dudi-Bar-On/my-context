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
 * **THIS REPOSITORY IS ALREADY LARGER THAN THAT, so the sentence above is the
 * state of the screen and not a hypothesis about a bigger repository.**
 * Measured in the browser 2026-09-06 under `plan:builder seq:15`: the tester
 * arrives reading `1,298 / 1,298` over a tree of exactly **200 rows**, all lit.
 * The count tracks the repository and moves with it — it was 690 when the line
 * below was written — so the durable half of this measurement is the 200, which
 * is the constant, and the fact that it has been the smaller number for a long
 * time. Both numbers on screen are honest — `total` and the denominator are the
 * walk's own — and the reader is nonetheless shown 200 files while the line
 * above them counts thirteen hundred. Nothing on the screen says so, because the
 * sentence that would say so is a ninth `pal.` key and therefore new product
 * copy (see "WHAT THIS SCREEN COULD NOT SAY, FOR WANT OF A KEY" below). The
 * count line is what the previous measurement of this file misread as proof
 * that the cap was gone; the cap is real, and it is the ROWS it bounds.
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
import { el, errorNote, linkId, num, screenHead, spaced } from '/screens/parts.js';

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

/**
 * THE LIST OF HELP TOPICS THAT USED TO LIVE HERE, AND WHY IT DOES NOT.
 *
 * `const HELP_TOPICS = ['categories', 'scope', 'capture', 'workflow']` stood at
 * this spot, keyed off `UI_HELP_TOPICS` — the four topics the LEARN SCREEN
 * renders a corpus join for. That is not the list `mycontext help` accepts.
 * `core/teach.ts` has declared SEVEN since `cli`, `tools` and `slash` landed,
 * so this screen could not compose three commands that work, and nothing could
 * see it: the spelled four agreed with the server list it was checked against,
 * and the server list was the wrong one.
 *
 * That is this project's recurring defect in miniature — the command catalogue
 * said "38 commands" and was right on 2026-08-24 — and the fix is the one
 * `GraphBody.relationTypes` and `ItemsBody.retiredStatuses` already use: the
 * declaring module serves its own list, and this screen reads it. `/api/meta`
 * carries `helpTopics` and `statuses`, `/api/items` carries `relationTypes`,
 * and `sourceLists` below turns the three into pickers. Nothing closed is
 * spelled in this file any more.
 */

/** How long a keystroke waits before the tester asks the server. */
const GLOB_DEBOUNCE_MS = 180;

/**
 * **The picker sources that are fetched WHEN A FIELD ASKS FOR THEM, and never
 * on the way in** (owner ruling D11, 2026-09-06).
 *
 * The five reads in `render()` are paid by every visitor to this screen, and
 * that is right for the five: `id`, `category`, the draft queue, the pending
 * revisions and the two closed vocabularies are between them the pickers of
 * most of the catalogue. These two are not.
 *
 * **`/api/doctor` is the reason this mechanism exists rather than a sixth
 * await.** Measured on this repository 2026-09-06, three runs each, warm:
 *
 *     /api/config          2 / 2 / 1 ms
 *     /api/meta           18 / 18 / 15 ms
 *     /api/packs          18 / 17 / 15 ms
 *     /api/review-queue   21 / 20 / 20 ms
 *     /api/revisions      22 / 19 / 21 ms
 *     /api/tags           47 / 40 / 38 ms
 *     /api/items          74 / 47 / 54 ms
 *     /api/doctor       1011 / 743 / 650 ms
 *
 * It runs the whole check suite — that is what it is — and it is 13-20x the
 * next most expensive read on this screen. `ack` is one of twenty-seven
 * entries. Paying the better part of a second to compose `mycontext list` is
 * not a cost this screen may hide inside a `Promise.all`, and a slower corpus
 * makes it worse rather than better.
 *
 * `/api/packs` is cheap and rides the same path anyway, because *"the reason
 * this one is fetched early"* would then be a rule with one exception, and one
 * exception is how a rule stops being read.
 *
 * ── AND "WHEN A FIELD ASKS" IS NOT "WHEN A FIELD IS DRAWN" ────────────────
 *
 * The first build of this fired on `build()`, which is worse than it sounds and
 * was caught by the browser rather than by reasoning: `ack` is `PALETTE[0]` and
 * therefore the def this screen ARRIVES on, so a read fetched when its control
 * is drawn is a read every visitor to the Composer pays — the whole cost the
 * paragraph above refuses, moved one function along and hidden.
 *
 * So the trigger is USE, and use has two unambiguous forms: the reader puts the
 * cursor in the box, or the reader fills the field this one is narrowed by.
 * Landing on `#/palette` and reading the argv chips is neither, and costs
 * nothing.
 */
const LAZY = {
  findings: { path: '/api/doctor', options: (body) => findingOptions(body) },
  packs: { path: '/api/packs', options: (body) => packOptions(body) },
};

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
 * The option list for one control **given what the rest of the form holds**.
 *
 * `pickerOptions` answers *what could this field ever offer*; this answers
 * *what may it offer right now*, and the two differ for exactly one reason:
 * `spec.dependsOn` names another field whose value narrows this one. `ack`'s
 * `finding` is the case that needed it — `cmdAck` takes the codes doctor
 * reports on THE CHOSEN ITEM as the vocabulary and refuses any other, so a list
 * of every code this corpus reports anywhere would be a list whose majority the
 * command will refuse. Measured 2026-09-06: 6 distinct codes across 55 items,
 * and 1-2 on any one of them.
 *
 * **Empty and "not narrowed yet" are the same list and a different sentence.**
 * With no dependency value there is nothing to narrow BY, and offering the
 * unnarrowed list would be offering the wrong thing rather than nothing — so
 * this returns `[]` and `paintSuggest` says which of the two it is drawing.
 * That is `sourceLists`' own rule about an absent body, applied one level down:
 * an empty list and a plausible-but-wrong one are not the same failure, and
 * only the first is visible to the reader.
 *
 * A row carries its dependency under `item` — the same shape `revisions` uses
 * to carry `revision` beside its value, and for the same reason: one list
 * cannot be filtered by a fact it did not bring with it.
 */
export function narrowedOptions(spec, sources, values) {
  const options = pickerOptions(spec, sources);
  if (options === null) return null;
  if (typeof spec.dependsOn !== 'string') return options;
  const on = values[spec.dependsOn];
  if (on === undefined || on === '') return [];
  return options.filter((option) => option.item === on);
}

/**
 * `/api/doctor`'s findings as `finding` options: one row per (item, code).
 *
 * **Three kinds of row are dropped, each for a reason the endpoint states
 * about itself.** A row carrying `about` is *"a NOTE ABOUT A CHECK, not a
 * finding about the corpus"* (`doctor/checks.ts`) — five of the sixty-one here
 * — and `ack` has nothing to record against one. A row with no `item` is a
 * finding about the workspace rather than about something `ack <id>` can name.
 * And a repeat of one (item, code) pair is one acknowledgement, not two: the
 * ruling is recorded per item per code, so two rows would offer the same
 * command twice. Measured on this corpus: 61 findings, 5 notes, 56 on an item,
 * 56 distinct pairs — so the de-duplication changes nothing today and is here
 * because `runChecks` is free to emit two messages under one code tomorrow.
 *
 * **An acknowledged finding is still offered**, because the mark is not a
 * filter — `--clear` withdraws a ruling and needs the same code the ruling was
 * made under. The level rides along as the hint so the box can say which kind
 * of thing is being settled without a second read.
 */
export function findingOptions(body) {
  const findings = body !== null && body !== undefined && Array.isArray(body.findings)
    ? body.findings : [];
  const seen = new Set();
  const out = [];
  for (const finding of findings) {
    if (finding === null || typeof finding !== 'object') continue;
    if (typeof finding.about === 'string') continue;
    if (typeof finding.item !== 'string' || finding.item === '') continue;
    if (typeof finding.code !== 'string' || finding.code === '') continue;
    const pair = `${finding.item} ${finding.code}`;
    if (seen.has(pair)) continue;
    seen.add(pair);
    out.push({
      value: finding.code,
      label: `${finding.code} · ${finding.level}`,
      hint: typeof finding.level === 'string' ? finding.level : '',
      item: finding.item,
    });
  }
  return out;
}

/**
 * `/api/packs`' records as `init --pack` options: the artefact LOCATIONS this
 * workspace has imported from, de-duplicated, in the order the records file
 * them.
 *
 * `PackRow.source` and not `name`: `--pack` takes a path and a name is not one.
 * The endpoint's own words for that field are *"the path as the importer typed
 * it, recorded verbatim"*, which is exactly the string a second `init` would
 * need. The name rides as the hint, because a reader choosing between two
 * paths is choosing between two packs and the path alone may not say which.
 *
 * Two records CAN name one path — a pack re-imported after a change is two
 * membership records — and that is one suggestion, not two.
 */
export function packOptions(body) {
  const packs = body !== null && body !== undefined && Array.isArray(body.packs) ? body.packs : [];
  const seen = new Set();
  const out = [];
  for (const pack of packs) {
    if (pack === null || typeof pack !== 'object') continue;
    if (typeof pack.source !== 'string' || pack.source === '') continue;
    if (seen.has(pack.source)) continue;
    seen.add(pack.source);
    const name = typeof pack.name === 'string' ? pack.name : '';
    out.push({
      value: pack.source,
      label: name === '' ? pack.source : `${pack.source} · ${name}`,
      hint: name,
    });
  }
  return out;
}

/**
 * The seven picker sources, from the five read bodies that carry them.
 *
 * **Three of them are CLOSED VOCABULARIES and not one of them is spelled here**
 * (owner ruling D10, 2026-09-06). `topics` is `core/teach.ts`' `HELP_TOPICS`,
 * `statuses` is `core/validate.ts`' `STATUSES`, and `relations` is
 * `searchableRelationTypes` — the closed relation vocabulary plus whatever
 * types this corpus actually carries, which is the list a READ filter must
 * accept and is why it rides `/api/items` rather than `/api/meta`. Each
 * travels on the wire from the module that declares it, for the reason
 * `GraphBody.relationTypes` states about itself: a browser module cannot
 * import a core one, and the wire is the only route from the one authority to
 * the one consumer that does not create a second copy.
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
  // A body that did not arrive degrades to an EMPTY picker, never to a spelled
  // fallback: an empty select and a wrong-but-plausible one are not the same
  // failure, and only the first is visible to the reader.
  const served = (body, field) =>
    (body !== null && body !== undefined && Array.isArray(body[field]) ? body[field] : [])
      .filter((value) => typeof value === 'string' && value !== '')
      .map((value) => ({ value, label: value }));
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
    // The three served vocabularies, in the order the module that declares each
    // one authored it. NOT sorted here: `RELATION_TYPES`' authored order is what
    // every refusal message and every other select in this product shows, and
    // `HELP_TOPICS` is "the order `mycontext help` lists them" in its own words.
    topics: served(bodies.meta, 'helpTopics'),
    statuses: served(bodies.meta, 'statuses'),
    relations: served(bodies.items, 'relationTypes'),
    // The two ON-DEMAND sources (owner ruling D11, 2026-09-06). They are built
    // here so this function is still the one place a source list is spelled,
    // and they are normally EMPTY here because their bodies are not among the
    // five `render()` awaits — see `LAZY` below for why `/api/doctor` in
    // particular cannot be a sixth: it answers in 650-1,011 ms on this corpus
    // against 15-74 ms for every other read, because it runs the whole check
    // suite, and no reader who is composing `mycontext list` should pay for it.
    // `render()` assigns over these when the fetch a `suggest` control started
    // actually lands.
    findings: findingOptions(bodies.doctor),
    packs: packOptions(bodies.packs),
  };
}

/* ── the tag box, which is a LIST and therefore not a picker source ───────── */

/**
 * **The tags a `--tags` box names, in the order it names them.**
 *
 * `tags` takes a COMMA-SEPARATED LIST, and that single fact is why it gets a
 * different control from the six sources above: `pickerOptions` feeds a
 * `<select>`, a select emits one value, and a control that composed `--tags v2`
 * where the reader ticked three would be a regression wearing a convenience's
 * clothes. So the box stays, exactly as `#focustags` does in the focus dialog,
 * and the checkboxes are derived FROM it.
 *
 * Lifted from `app.js`' `tagsInBox()` in behaviour and not in code: that one
 * reads one hard-coded element id, this one is given a value, and a shared
 * helper would have to live in `lib/` and be imported by a dialog that is
 * deliberately import-free until its popover is opened.
 */
export function tagsInValue(value) {
  return String(value ?? '').split(',').map((tag) => tag.trim()).filter((tag) => tag !== '');
}

/**
 * The box's value for a list of tags.
 *
 * **Joined with `,` and NO SPACE, deliberately.** That is what `--tags` takes
 * and it is what keeps the composed line inside `quoteArg`'s safe set
 * (`ui/public/lib/command.js` · `const SAFE = /^[A-Za-z0-9@%_+=:,.\/\-]+$/;` · ~24):
 * a space would quote the whole argument, which is correct and noisier to read
 * for no gain. `setTagsInBox` in `app.js` states the same rule for the same
 * reason. De-duplicated, because ticking a tag the reader already typed must
 * not compose it twice.
 */
export function joinTags(tags) {
  return [...new Set(tags)].join(',');
}

/**
 * The box's new value when one checkbox is ticked or unticked.
 *
 * ADDED to the end and REMOVED in place — the reader's own order is kept,
 * because the box is a line they can also type into and reordering it under
 * their cursor is the screen taking a step they did not ask for.
 */
export function withTag(value, tag, on) {
  const held = tagsInValue(value);
  return joinTags(on ? [...held, tag] : held.filter((held_) => held_ !== tag));
}

/**
 * **Which half of `/api/tags` this screen may offer, and which half it may only
 * NAME.**
 *
 * The endpoint serves the two classes already split — free-form and projected —
 * derived from the categories' own `projectsTo` declarations. The focus dialog
 * offers both, because a focus is a READ and a projected tag is a perfectly
 * good thing to filter on. `--tags` is a WRITE, and there the two classes are
 * not alike at all: `handWrittenProjectionError` (core/tag-projection.ts) makes
 * `mycontext edit <id> --tags plan:builder` a REFUSAL, naming the command that
 * does work. A checkbox that composed it would be a control whose only outcome
 * is an error message.
 *
 * So the free half becomes checkboxes and the projected half becomes one
 * sentence naming the prefixes and the commands that set them — drawn rather
 * than dropped, because "this screen cannot offer these" and "this corpus has
 * none of these" must not render as the same absence.
 *
 * `null` when there is nothing to say, so the caller draws no empty aside.
 */
export function projectedAside(vocabulary) {
  const groups = vocabulary !== null && vocabulary !== undefined
    && Array.isArray(vocabulary.projected) ? vocabulary.projected : [];
  if (groups.length === 0) return null;
  const commands = new Set();
  for (const group of groups) {
    for (const command of Array.isArray(group.commands) ? group.commands : []) commands.add(command);
  }
  return {
    prefixes: groups.map((group) => `${group.prefix}:`).join(' '),
    cmds: [...commands].join(' · '),
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
 * The control for one arg or flag. A picker where the catalogue names a source
 * or a closed vocabulary, a checkbox for a boolean switch, a textarea for a
 * body, a text input otherwise — and `input.globin` for a `glob`, which is the
 * glob tester's own input rather than a second box saying the same thing.
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
 *     the CLI accepts. This is the `--tags` box's rule — *"the box is the
 *     model; what the reader picks is written into the line they can also
 *     type"* — reached by a control the browser draws instead of by a
 *     checkbox list this file draws.
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
 * `.suggin` JOINS `.tagin`'s selector list in `styles.css` rather than getting
 * a rule of its own. Its own rule says what that treatment is for — *"the other
 * place this product takes a machine value by hand: mono, LTR and ISOLATED, so
 * it reads left-to-right inside a Hebrew page"* — and a doctor code and a pack
 * path are exactly that. One declaration differs and is overridden beside it:
 * the width, because `label.small` is inline and a full-width control strands
 * its own caption on the line above. That was found by looking at the rendered
 * screen and not by reading the rule.
 */
function controlFor(spec, sources, onChange) {
  if (spec.input === 'suggest') {
    const box = document.createElement('input');
    box.className = 'suggin';
    box.spellcheck = false;
    box.autocomplete = 'off';
    box.setAttribute('list', suggestListId(spec.name));
    if (spec.required === true) box.required = true;
    box.addEventListener('input', onChange);
    return box;
  }
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
  // `.tagin` is the treatment `#focustags` already carries and `.globin` before
  // it: mono, LTR and bidi-ISOLATED, because a comma-separated tag list is a
  // machine value and must read left-to-right inside a Hebrew page without
  // reordering the words around it. The picker that fills it is built in
  // `build()` below rather than here — this function returns ONE control, and
  // `valueOf` reads exactly this element, which is what keeps the box the model.
  if (spec.input === 'tags') {
    control.className = 'tagin';
    control.spellcheck = false;
    control.autocomplete = 'off';
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

  // FIVE reads, because the pickers are real: ids, the resolved categories, the
  // draft queue and the pending revisions are all corpus facts, and `/api/meta`
  // is the two closed vocabularies this screen used to spell into itself. One
  // failure takes the screen, in the server's own words — the same treatment
  // `status.js` and `gaps.js` give a refused read, and for the same reason: a
  // composer drawn over empty pickers and a corpus with nothing in it are
  // different facts and must not share a rendering.
  //
  // `/api/meta` earns its place in the fatal set rather than being tacked on
  // beside the tolerant reads below: it costs no corpus walk (it answers from
  // module-level declarations, a git call and two stat sweeps), it is the read
  // every other screen already makes, and a Composer whose `--status` and
  // `topic` selects were silently empty would offer a reader two controls that
  // look like a corpus with no statuses in it.
  let bodies;
  try {
    const [items, config, queue, revisions, meta] = await Promise.all([
      ctx.api('/api/items'),
      ctx.api('/api/config'),
      ctx.api('/api/review-queue'),
      ctx.api('/api/revisions'),
      ctx.api('/api/meta'),
    ]);
    bodies = { items, config, queue, revisions, meta };
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }
  const sources = sourceLists(bodies);

  /**
   * **The corpus's whole id list, as a set, built ONCE per visit to this
   * screen** — the index an executed command's TEXT output is resolved against
   * (`TASK-an-id-in-a-composer-result-opens-the-item-pane-the-same-as`,
   * population 2, where the id is prose in an ASCII table rather than a field
   * on a row).
   *
   * `sources.items` is `/api/items`' whole answer — every item, sorted by id,
   * uncapped, and accepting no filter — which `render()` has already fetched
   * above to build this screen's pickers. So the recogniser costs no request:
   * the Composer is the one screen in this product that has already paid for
   * the corpus's id list, and that is why the set is handed to the shared
   * Copy-and-Execute control from here rather than invented inside it.
   *
   * **Hoisted out of `recompose()` deliberately.** That function runs on every
   * `input` event, and rebuilding a 965-element set per keystroke would be a
   * cost that grows with the corpus for an answer that cannot change while the
   * screen is up. An id the executed command itself CREATES is therefore not in
   * it and degrades to plain text — which is the direction the task asks a miss
   * to fall in, and the next render re-reads `/api/items` anyway.
   */
  const itemIds = new Set(sources.items.map((option) => option.value));

  /**
   * The tag vocabulary `/api/tags` last answered, or `null` before it answers.
   *
   * **`null` and `{ free: [], projected: [] }` are different states and both
   * are drawn**, which is the obligation `app.js`' focus picker records and
   * this one inherits: the first says "not read yet", the second says "this
   * corpus has no tags", and one empty box would be indistinguishable from
   * either. That is only an honest distinction if the read is allowed to be
   * outstanding while the form draws — so it is started here and NOT awaited,
   * and `paintTagPicker` runs again when it lands.
   *
   * **Tolerant, unlike the five above.** Composing `mycontext add --tags` does
   * not depend on knowing which tags exist; the box takes anything typed into
   * it either way. A refused read costs the reader the checkboxes and says so,
   * exactly as `globError` costs them the file tree.
   */
  let tagVocabulary = null;
  let tagVocabularyError = null;

  /**
   * What each `LAZY` source is doing right now: absent (nobody has asked),
   * `'reading'`, `'ready'`, or the `Error` the read failed with.
   *
   * **Three states and not two, for `tagVocabulary`'s own reason**, one level
   * along: "not asked yet", "asked and still outstanding" and "this corpus has
   * none" are three different facts about an empty suggestion list, and a
   * reader who cannot tell them apart cannot tell a slow server from a clean
   * corpus. `paintSuggest` draws a different sentence for each.
   *
   * The fetch is started ONCE per source per visit to the screen and the
   * answer is kept for the rest of it. A `<select>` rebuilt on every command
   * switch is what the architecture review flagged as the cost that grows with
   * the corpus; re-running a 650 ms check suite on every switch would be the
   * same mistake with a bigger constant.
   */
  const lazyState = new Map();

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
  // repository the walk answers `total: 1299` and sends 200 of them
  // (2026-09-06, `plan:builder seq:15`; it read 690 when this line was written
  // and the gap between the two is the only reason the number is dated). The
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

  /* ── THE TAG PICKER, and the one rule that makes it safe ─────────────────
   *
   * Owner ruling D10, 2026-09-06, and it follows the focus dialog because the
   * owner named that dialog as the shape: **the composed line stays the source
   * of truth.** `markTagPicks()` derives every checkbox FROM the box on every
   * paint and never the reverse, so a tag typed by hand ticks its box, a tag
   * deleted by hand unticks it, and a redraw cannot disagree with the argv this
   * screen is showing. `app.js`' `markFocusPicks()` states the same rule.
   *
   * It also keeps the escape hatch a picker alone would take away: a tag no
   * item carries yet cannot be ticked, and can still be typed.
   */

  /** The `input: 'tags'` control this form drew, and its picker host, or null. */
  let tagsEntry = null;

  /** Tick every box the box's own list names. Derived, never remembered. */
  function markTagPicks() {
    if (tagsEntry === null) return;
    const chosen = new Set(tagsInValue(tagsEntry.control.value));
    for (const box of tagsEntry.host.querySelectorAll('input[type="checkbox"][data-tag]')) {
      box.checked = chosen.has(box.dataset.tag);
    }
  }

  /** One free-form tag as a checkbox, with the number of items carrying it. */
  function tagRow(count) {
    const row = el('label', 'tagpick');
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset.tag = count.tag;
    // `change` and not `click`: a checkbox reached by keyboard fires no click on
    // some platforms and always fires change. The handler writes the BOX and
    // then recomposes; `recompose()` re-marks from the box, so this element's
    // own `checked` is overwritten by the value it just produced rather than
    // being trusted as state of its own.
    box.addEventListener('change', () => {
      tagsEntry.control.value = withTag(tagsEntry.control.value, count.tag, box.checked);
      recompose();
    });
    const name = el('span', 'tagname');
    name.textContent = count.tag;
    const number = el('span', 'tagn');
    number.textContent = num(count.items);
    // The corpus's own count, in the corpus's own words. The focus dialog's
    // tooltip additionally names how many items a FOCUS on the tag would
    // inject; that number is about an injection and there is no injection here,
    // so the sentence stops where the fact stops.
    row.title = ctx.tFlat('pal.tagn', { items: num(count.items), tag: count.tag });
    row.append(box, name, number);
    return row;
  }

  function paintTagPicker() {
    if (tagsEntry === null) return;
    const aside = (key, subs) => {
      const note = el('p', 'aside');
      note.append(...ctx.t(key, subs));
      return note;
    };
    if (tagVocabularyError !== null) {
      tagsEntry.host.replaceChildren(aside('pal.tagpickerr'));
      return;
    }
    if (tagVocabulary === null) {
      tagsEntry.host.replaceChildren(aside('pal.tagpicking'));
      return;
    }
    const free = Array.isArray(tagVocabulary.free) ? tagVocabulary.free : [];
    const eligible = typeof tagVocabulary.eligible === 'number' ? tagVocabulary.eligible : 0;
    const nodes = [];
    if (free.length === 0) {
      nodes.push(aside('pal.tagpickn'));
    } else {
      nodes.push(aside('pal.tagfree', { n: num(free.length), eligible: num(eligible) }));
      const list = el('div', 'tagpicks');
      list.append(...free.map(tagRow));
      nodes.push(list);
    }
    // The projected half, NAMED rather than offered — see `projectedAside`.
    const projected = projectedAside(tagVocabulary);
    if (projected !== null) nodes.push(aside('pal.tagproj', projected));
    tagsEntry.host.replaceChildren(...nodes);
    markTagPicks();
  }

  // Started, not awaited. See `tagVocabulary` above for why the outstanding
  // state has to be reachable, and `readFocusVocabulary` in `app.js` for the
  // reason a failed read is KEPT and drawn rather than swallowed into an empty
  // list nobody can tell from a corpus with no tags.
  void (async () => {
    try {
      tagVocabulary = await ctx.api('/api/tags');
      tagVocabularyError = null;
    } catch (error) {
      tagVocabulary = null;
      tagVocabularyError = error;
    }
    if (root.isConnected) paintTagPicker();
  })();

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

  /* ── the suggestion lists behind the `suggest` boxes ───────────────────── */

  /** One per `input: 'suggest'` control this form drew: its `<datalist>` and note. */
  let suggestEntries = [];

  /**
   * Ask for a lazy source, once. Tolerant, like `/api/tags` and unlike the five
   * fatal reads: a `suggest` box takes whatever is typed into it either way, so
   * a refused read costs the reader the suggestions and says so — it must not
   * cost them the command.
   */
  function startLazy(source) {
    if (typeof source !== 'string' || LAZY[source] === undefined) return;
    if (lazyState.has(source)) return;
    lazyState.set(source, 'reading');
    void (async () => {
      try {
        const body = await ctx.api(LAZY[source].path);
        sources[source] = LAZY[source].options(body);
        lazyState.set(source, 'ready');
      } catch (error) {
        sources[source] = [];
        lazyState.set(source, error);
      }
      if (root.isConnected) paintSuggest();
    })();
  }

  /**
   * Refill every `<datalist>` on the form from the source as it stands now, and
   * say in words what the reader is being offered.
   *
   * **The note is not decoration.** A `<datalist>` is invisible: an empty one
   * and a full one look identical until the box is focused, so without a
   * sentence beside it "nothing is offered" and "the read failed" and "pick the
   * item first" are one silence. That is `pal.tagpickerr`/`pal.tagpicking`'s
   * argument about the tag picker, and it is stronger here because the tag
   * picker at least draws its own emptiness.
   *
   * Called from `recompose()`, which runs on every change to any control —
   * including the `id` a `dependsOn` field is narrowed by, which is the whole
   * reason it is refilled rather than built once in `build()`.
   */
  function paintSuggest(values) {
    if (suggestEntries.length === 0) return;
    const held = values === undefined ? currentValues() : values;
    for (const entry of suggestEntries) {
      const options = narrowedOptions(entry.spec, sources, held) ?? [];
      // **Rebuilt only when the LIST changed, not on every keystroke.**
      // `recompose()` runs on every `input` event, and this function runs from
      // it; replacing the `<option>` children of a `<datalist>` whose popup is
      // open is a repaint the reader sees under the cursor they are typing at.
      // The signature is the values themselves rather than a length — a
      // dependency change can swap one code for another without changing the
      // count — and the join is safe because a doctor code and a pack path
      // cannot contain a newline.
      const drawn = options.map((option) => option.value).join('\n');
      if (entry.drawn !== drawn) {
        entry.drawn = drawn;
        entry.list.replaceChildren(...options.map((option) => optionEl(option.value, option.hint ?? '')));
      }
      const note = (key, subs) => entry.note.replaceChildren(...ctx.t(key, subs));
      // **The unanswered dependency is checked FIRST, before the read's own
      // state**, because it is the only one of the six the reader can act on:
      // "choose the id" is an instruction and "still reading" is an apology.
      // It is also what keeps the fetch honest — with no id there is nothing to
      // narrow by, so a `finding` list would be empty however the read went.
      const on = entry.spec.dependsOn;
      if (typeof on === 'string') {
        if (held[on] === undefined || held[on] === '') { note('pal.suggneed', { field: on }); continue; }
        // Filling the dependency IS asking for the list, and it is the ONLY
        // ask this function makes. A field with no dependency has nothing to
        // fill, so for it every paint would be an ask and the read would be
        // eager again wearing a lazy function's name — which is exactly the
        // defect the browser caught the first time. Its ask is the `focus`
        // handler in `build()` and nothing else. Read AFTER the ask, so the
        // paint that starts the fetch is the paint that says "reading" rather
        // than one repaint behind it.
        startLazy(entry.spec.source);
      }
      const state = lazyState.get(entry.spec.source);
      if (state instanceof Error) { note('pal.suggerr'); continue; }
      if (state === 'reading') { note('pal.suggreading'); continue; }
      if (state === undefined) { note('pal.suggidle'); continue; }
      if (options.length > 0) { note('pal.sugg', { n: num(options.length) }); continue; }
      note('pal.suggn');
    }
  }

  function recompose() {
    const def = PALETTE.find((candidate) => candidate.name === picker.value);
    const values = currentValues();

    // **Every paint, and before any of the early returns below.** The tag
    // checkboxes are DERIVED from the box, so they are re-marked whenever this
    // screen re-reads it — including on a paint that ends early because a
    // required input is still empty. Marking them only on the complete path
    // would leave a hand-typed tag unticked until the command happened to
    // compose, which is the disagreement `markFocusPicks` exists to rule out.
    markTagPicks();

    // Same paragraph, same reason, for the suggestion lists: `ack`'s `finding`
    // is narrowed BY the `id` beside it, so the list has to follow the id on
    // the paint the id changed on — including a paint that ends early because
    // `finding` itself is still empty, which is every paint until it is filled.
    paintSuggest(values);

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
      // `ids` is the index an executed command's TEXT output is resolved
      // against — see `itemIds` above for what it is and why it is built once.
      argv, id: runnable ? def.name : null, values, ctx, copyBlocked: blocked,
      ids: itemIds,
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
        // **The id OPENS**, and this is population 1 of
        // `TASK-an-id-in-a-composer-result-opens-the-item-pane-the-same-as`:
        // exact, because `row.id` is a FIELD of the object the cell is built
        // from and not a string parsed out of anything. `linkId()` is the shape
        // every other screen's id already wears — `button.linkid` carrying
        // `data-id`, which `app.js`' one delegated document listener
        // (`installItemPane`) already answers. Nothing is wired here: the
        // Composer simply stopped being the one screen that drew an id as inert
        // text. `split: false` because a result row is a list of ids rather
        // than the carried-item card the `.idkind`/`.idslug` split was drawn
        // for, which is the same call `ask.js`, `doctor.js` and `coverage.js`
        // make in the same position.
        //
        // The `<td class="m">` stays and the button goes INSIDE it: the cell's
        // own kind is what `e2e/screen-parity.spec.ts` compares, and dropping
        // `.m` from it to let the button carry the mono face would delete a
        // kind the design of record draws.
        const cell = el('td', 'm');
        cell.append(typeof row.id === 'string' && row.id !== '' ? linkId(row.id, false) : '—');
        tr.append(cell);
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
    // Cleared before the loop, not after: a def with no `tags` field must leave
    // no picker host from the def before it, and `markTagPicks` reads this.
    tagsEntry = null;
    // Same rule for the suggestion lists, and the same failure it prevents: a
    // `<datalist>` left over from the previous def is a list still attached to
    // an element `form.replaceChildren()` has already detached, and
    // `paintSuggest` would keep filling it forever.
    suggestEntries = [];

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
      // The picker sits UNDER its box rather than replacing it, because the box
      // is the model: what the reader ticks is written into the line they can
      // also type, and both are on screen at once so neither can be a surprise.
      if (spec.input === 'tags') {
        const host = el('div', 'tagpicker');
        tagsEntry = { control, host };
        form.append(host);
        paintTagPicker();
      }
      // The same shape for a `suggest` box: the list the browser offers, and a
      // sentence under it saying what is in the list. The `<datalist>` is not
      // drawn — every UA styles it `display:none` — so its position in the form
      // is arbitrary and it is put beside the note it belongs to rather than at
      // the end, where a later reader would have to work out which box owns it.
      if (spec.input === 'suggest') {
        const list = document.createElement('datalist');
        list.id = suggestListId(spec.name);
        const note = el('p', 'aside');
        form.append(list, note);
        suggestEntries.push({ spec, list, note, drawn: null });
        // **The cursor arriving in the box is the reader asking for the list**,
        // and it is deliberately not `build()` doing the asking: `ack` is the
        // def this screen arrives on, so a fetch started when the control is
        // DRAWN is a fetch every visitor pays. `focus` and not `click`, so a
        // reader who tabs here gets the same list a reader who clicks does.
        control.addEventListener('focus', () => {
          startLazy(spec.source);
          paintSuggest();
        });
      }
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
