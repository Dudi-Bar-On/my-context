/**
 * `nav.ch` — **Export / import**, `<section data-p="port">` in the design of
 * record. Three cards: what an export carries, the format ladder, and the
 * three buckets an import sorts an artefact into, closing on the one line the
 * reader pastes into their own shell.
 *
 * Everything on it comes from `GET /api/port` — six rows, the audit
 * vocabulary split in two, three format rungs, three bucket names and an argv
 * — and the module behind that endpoint is the one to read first
 * (`src/ui/port-model.ts` · `The Export / import read model — the endpoint behind` · ~2).
 * This file decides only how each of those becomes the mockup's own markup;
 * every fact it draws is the server's.
 *
 * **This screen describes an act and never performs one.** There is no POST
 * anywhere in this UI, so nothing here exports: the settlement is a command
 * block the reader copies, exactly as Work composes a promote and Configure
 * composes a budget edit.
 *
 * ── THE HEAD DROPS THE `PROPOSED` BADGE, AND THE UNBUILT RUNG TAKES IT ────
 *
 * The mockup opens this section with a badge and no verdict text —
 * `<span class="verdict"><span class="prop">PROPOSED</span></span>`
 * (`docs/design/web-ui-mockup.html` · `<span class="verdict"><span class="prop">PROPOSED</span></span></div>` · ~2163)
 * — and the app does not repeat it, under the owner's ruling of 2026-08-23:
 * *"leave the mockup intact, do it only in the real … when comparing to mockup
 * the proposed word is a known diff and it is ok"*
 * (`e2e/screen-parity.spec.ts` · `// `span.prop` is an ACCEPTED DIVERGENCE, not a gap. Owner ruling 2026-08-23:` · ~172).
 * `mycontext export` ships — `test/ui/port-model.test.ts` runs a real one into
 * a temp directory and reads the artefact back — and `port.sub` was corrected
 * on the same day to say so in the mockup's own words: *"Built, and this
 * screen reports it."* A badge over that sentence would contradict it.
 *
 * `screenHead()` is therefore NOT used here: it takes a `verdictKey` and
 * prepends a glyph
 * (`src/ui/public/screens/parts.js` · `export function screenHead(ctx, root, titleKey, verdictKey, subKey, glyph = '✅') {` · ~88),
 * and there is no `port.v` in either string table to give it. The `.phd` /
 * `h2` / `.verdict` / `.psub` shape is drawn here instead, with `.verdict`
 * left EMPTY rather than deleted — the element is the design of record's and
 * the badge inside it is the one thing the ruling removes.
 *
 * **"There is no `port.v`" is a fact about the tables, not a rule, and it was
 * read as a rule.** `plan:walk seq:92` counted fifteen modules refusing to key
 * a string because `strings-parity` was believed to fail on one the design of
 * record does not declare; this screen and `packs.js` are the two its grep
 * missed, because they say *a key that does not exist* where the other thirteen
 * say *a key that may not be invented*. Same retired direction, different
 * wording. It was dropped on 2026-08-26 by
 * `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, so writing
 * `port.v` into both tables would pass the gate today.
 *
 * **It is still not written, and that is `plan:walk seq:108`'s call rather than
 * this file's.** A screen built with no sentence saying what it is good at is
 * this screen's own open question rather than a licence to invent one: a
 * verdict CLAIMS something about the product, and
 * `DEC-claude-drafts-the-mockup-and-the-owner-approves` leaves the drafting
 * with the agent and the approving with the owner. seq:108 takes `pr.v`,
 * `port.v` and `pk.v` to the owner together, which is the cheapest sitting
 * they will get on it.
 *
 * The badge is not discarded, it is MOVED to the one thing on this screen that
 * really is named and not real: the `git bundle` rung. See `RUNGS`.
 *
 * ── WHAT IS DERIVED HERE AND WHAT IS TRANSCRIBED ─────────────────────────
 *
 * Three lookup tables below (`VERDICT_CHIP`, `RUNGS`, `BUCKET_CHIP`) map a
 * SERVED name to the markup the mockup draws for it. They are transcriptions
 * of the design of record and nothing else: no row, no rung and no bucket is
 * listed here. The lists themselves arrive in the response, so a seventh audit
 * kind, a fourth root file or a third bucket reaches this screen without
 * anyone editing it — which is the whole reason the endpoint exists rather
 * than the page carrying constants
 * (`src/ui/port-model.ts` · `## Why this is a server document and not markup` · ~15).
 *
 * Every one of the three refuses to invent. An id the mockup drew no row for
 * gets its own name and an em dash where its prose would be, never a
 * neighbouring row's sentence.
 *
 * ── FOUR OF THE SEVEN DISCLOSURES ARE HONOURED BY THE DRAWING ────────────
 *
 * `/api/port` sends seven `disclosures`, and no string table declares a key
 * for any of them, so none is rendered as prose — the call `status.js` and
 * `work.js` already made about served fields the design of record has nowhere
 * to put. Four of the seven are honoured by HOW this screen draws instead:
 *
 *   - *"One rung is drawn and is not built. `built: false` says which; a
 *     screen that renders the row without reading that flag is offering a
 *     format --format refuses."* → `rungView` reads the flag and badges the
 *     row.
 *   - *"The bucket NAMES are served; the example ids beside them in the mockup
 *     are not, and cannot be."* → the Example column draws an em dash, not the
 *     mockup's three illustrations. See `bucketRow`.
 *   - *"The argv is one argument short."* → `exportCommand` composes exactly
 *     what arrived and appends nothing. See `exportCommand`.
 *   - *"`${withheld.length} of this build's ${AUDIT_KINDS.length} audit kinds
 *     do not travel, and the screen prose names three of them."* → the prose
 *     was corrected to five on 2026-08-23, and `auditChips` draws the real
 *     list from the response anyway. See `auditChips`.
 *
 * The remaining three — `manifest.json` being in an artefact and in no row,
 * the three `rebuilt` rows being hand-maintained, and the item join that drops
 * a mutation naming an item the export did not carry — are read and not drawn.
 * They are in this task's report; a screen cannot word them without a key.
 *
 * `history.importedDir` is the fourth served field this screen does not draw.
 * `port.hist` already spells the destination inside its own `{m:}` run —
 * `.audit/imported/` — and the endpoint serves `imported/`, the half of it
 * that is relative to `.audit/`. Drawing both would put one path on the screen
 * twice in two spellings, which is the exact defect the endpoint cites for
 * taking the constant from `layout.ts` in the first place. Reported.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
import { el, errorNote, spaced } from '/screens/parts.js';

/**
 * A served `verdict` → the chip the mockup draws for it.
 *
 * The vocabulary is closed at three and the endpoint's own test pins it that
 * way (`test/ui/port-model.test.ts` · `// The chip vocabulary is closed: three values and no fourth, so a screen` · ~57),
 * so this table is exhaustive by construction rather than by hope. Note that
 * `filtered` wears the SAME `chip ok` as `travels` and only its word differs
 * — the mockup's own choice, transcribed rather than tidied: a filtered
 * history still arrives, so hueing it as a warning would say the opposite.
 */
export const VERDICT_CHIP = {
  travels: { cls: 'chip ok', glyph: '●', key: 'port.yes' },
  filtered: { cls: 'chip ok', glyph: '●', key: 'port.filtered' },
  rebuilt: { cls: 'chip warn', glyph: '▲', key: 'port.no' },
};

/**
 * A served format `id` → the rung the mockup draws for it.
 *
 * Two shapes, and the split is the mockup's. `dir` and `zip` are described in
 * prose the string tables carry (`port.f1`, `port.f3`), so their name cell is
 * a plain `<b>`. The middle rung has no name key in either table at all: the
 * mockup writes it as a literal `<b class="m">git bundle</b>`
 * (`docs/design/web-ui-mockup.html` · `<tr><td><b class="m">git bundle</b></td><td class="small" data-t="port.f2n">` · ~2187),
 * because it is a command name and a command name is not translated — the same
 * treatment `parts.js` records for tier names and `work.js` for `stale`. So
 * `label` is a literal here for exactly one rung, and `test/ui/port-screen.test.ts`
 * reads it back out of the mockup rather than trusting this line.
 *
 * **`bundle` is served `built: false`, and this screen DRAWS it, badged.**
 * `ArtefactFormat` is a two-member union
 * (`src/pack/reader.ts` · `export type ArtefactFormat = 'dir' | 'zip';` · ~67)
 * and §6n.6 dropped the rung from v2.0 rather than deferring it. Three ways to
 * render that were open (greyed, footnoted, dropped) and this is the third
 * rejected outright: dropping the row leaves a two-rung ladder under a heading
 * that says *"in order of preference"*, deletes a sentence both string tables
 * still ship (`port.f2n`), and is a silent drop —
 * `INV-nothing-is-dropped-silently` is the invariant that names it. Greying it
 * would need a rule `styles.css` does not have and this task may not add.
 *
 * So the row is drawn whole and carries `span.prop`, which is the design's own
 * mark for the exact state this rung is in — *"the PROPOSED badge the mockup
 * itself uses to mark a screen that is named but not yet real"*
 * (`src/ui/public/styles.css` · `.prop{font-size:10.5px;letter-spacing:.05em;color:var(--warn);border:1px solid var(--warn);` · ~442)
 * — placed exactly as `config.js` places it beside the `watchedDocs` note it
 * is not built for
 * (`src/ui/public/screens/config.js` · `watchedNote.append(watchedText, ' ', el('span', 'prop', 'PROPOSED'));` · ~388).
 *
 * Two costs, stated rather than hidden. `PROPOSED` is an unkeyed English
 * literal and stays English in the Hebrew UI, which is the same cost `work.js`
 * records for its `stale` chip. And `PROPOSED` reads as *coming*, where §6n.6
 * DROPPED the rung — the badge is the closest mark this design owns, not an
 * exact one. Both are in this task's report, and the ruling that settles it is
 * filed as TASK-three-rulings-the-wave-surfaced.
 */
export const RUNGS = {
  dir: { nameKey: 'port.f1', label: null, noteKey: 'port.f1n' },
  bundle: { nameKey: null, label: 'git bundle', noteKey: 'port.f2n' },
  zip: { nameKey: 'port.f3', label: null, noteKey: 'port.f3n' },
};

/**
 * A served bucket name → the chip the mockup draws for it. The names are
 * `Buckets`' own keys, pinned to that interface at compile time by the
 * endpoint and measured against `bucketise`'s real return value by its test
 * (`test/ui/port-model.test.ts` · `assert.deepEqual(bodyOf(dir).buckets, Object.keys(bucketise([], () => null)));` · ~153).
 *
 * The three chips are `ok` / `warn` / `gov`, which is a real ordering and not
 * decoration: a new item is uncontested, a same-id-different-content item is
 * the collision, and an identical item is the one an import can leave alone.
 */
export const BUCKET_CHIP = {
  new: { cls: 'chip ok', glyph: '●', key: 'port.b1' },
  changed: { cls: 'chip warn', glyph: '▲', key: 'port.b2' },
  identical: { cls: 'chip gov', glyph: '◆', key: 'port.b3' },
};

/**
 * One served format rung, as the two cells the table draws it in.
 *
 * A rung whose id is in `RUNGS` gets the mockup's row. A rung whose id is NOT
 * gets its own id as the name — in `.m`, because an identifier is a token and
 * not prose — and `noteKey: null`, which `rungRow` draws as the em dash this
 * design already uses for "no value here" (`status.js` draws one for a count
 * nobody measured, `work.js` for a field with nothing to diff against).
 *
 * That branch is the one that matters. A third artefact format is a change to
 * `ArtefactFormat`, which the endpoint fails to COMPILE on rather than serving
 * quietly, so the branch should be unreachable in a build that type-checks —
 * but "should be unreachable" is not a reason to fall back to a neighbouring
 * rung's sentence, which is how a screen comes to describe `tar` as
 * *"canonical. Readable, diffable"*.
 */
export function rungView(format) {
  const id = typeof format?.id === 'string' ? format.id : '';
  const known = Object.hasOwn(RUNGS, id) ? RUNGS[id] : null;
  return {
    id,
    nameKey: known === null ? null : known.nameKey,
    label: known === null ? id : known.label,
    noteKey: known === null ? null : known.noteKey,
    // `built !== false` and not `built === true`: a response that omitted the
    // flag entirely is a response this screen cannot call unbuilt, and badging
    // a shipped format as PROPOSED is the worse of the two mistakes. The
    // endpoint always sends it; this is what happens if it ever stops.
    badge: format?.built === false,
  };
}

/**
 * One served bucket, as the chip the mockup draws — or `null` for a name the
 * design of record has no chip for.
 *
 * `null` is drawn as the bucket's own name in a `.m` cell rather than as a
 * bare `.chip`, and that is a legibility ruling this project already took:
 * unmodified `.chip` sets near-black text with no background, invisible on a
 * near-black panel, and the owner's fix on 2026-08-23 was to stop drawing it
 * (`e2e/screen-parity.spec.ts` · `// nobody can read is a label that is not there.` · ~193).
 * A name nobody can read would be a fourth bucket dropped silently.
 */
export function bucketView(name) {
  return Object.hasOwn(BUCKET_CHIP, name) ? BUCKET_CHIP[name] : null;
}

/**
 * The audit vocabulary, split, **from the response and never from a list
 * written here**.
 *
 * This is the anti-drift half of the screen and the reason it is a function
 * rather than six lines of markup. `port.hist` names the withheld kinds in
 * prose — it named THREE until 2026-08-23 and the build had five, which is the
 * drift the endpoint was built to end. The sentence is corrected now and the
 * sentence is still prose: the day a seventh kind lands it will be wrong
 * again, and no test can catch a sentence. These chips cannot go stale,
 * because they are `history.carries` and `history.withheld` and the endpoint
 * derives the second by subtracting the first from the audit vocabulary
 * itself.
 *
 * They are drawn beside the sentence rather than instead of it: the prose says
 * WHY the filter exists, the chips say what it currently does, and the day the
 * two disagree the reader can see it on the screen instead of finding out from
 * an artefact.
 *
 * The chip TEXT is the kind's own identifier and is deliberately not
 * translated — the treatment `parts.js` records for tier names: *"the config's
 * own keys and the selector's own words"*. The hues reuse the travels table's
 * own vocabulary, `ok` for what carries and `warn` for what does not, so the
 * two tables on this card mean the same thing by the same colour.
 */
export function auditChips(history) {
  const list = (value) => (Array.isArray(value) ? value.filter((k) => typeof k === 'string') : []);
  return [
    ...list(history?.carries).map((kind) => ({ kind, cls: 'chip ok', glyph: '●' })),
    ...list(history?.withheld).map((kind) => ({ kind, cls: 'chip warn', glyph: '▲' })),
  ];
}

/**
 * The one line this screen offers, composed and never run — and **one argument
 * short on purpose**.
 *
 * `command.argv` arrives as `mycontext export --out` and stops there. The CLI
 * refuses to default the destination, in as many words: *"an artefact written
 * into whatever directory the command happened to be run from is the one
 * destination nobody chose"*. The mockup's copy block shows a complete line
 * with a dated path
 * (`docs/design/web-ui-mockup.html` · `<div class="cmd"><code>mycontext export --out ../shared/context-2026-08-19</code>` · ~2202),
 * and that path is an ILLUSTRATION. Pasting it here would hand the reader a
 * command that looks ready to run and writes somewhere they did not pick,
 * which is worse than an obviously incomplete one — the reader can see the
 * flag has no value and supply theirs.
 *
 * It goes through `composeCommand`, which is the ONE place quoting lives
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1).
 * Nothing in this argv needs a quote today; that is not the point. A second
 * quoting implementation written here, for a three-token line, is how the two
 * come to disagree on the day one of them carries a path with a space.
 *
 * It THROWS rather than composing a weaker line, the same refusal
 * `revisionCommand` makes: an argv this screen did not receive is not an argv
 * it may guess at, and the card shows the refusal where its command would be.
 */
export function exportArgv(body) {
  const argv = body?.command?.argv;
  if (!Array.isArray(argv) || argv.length === 0) {
    throw new Error('port: /api/port sent no command.argv — this screen composes the export line '
      + 'the server supplied and does not assemble one of its own');
  }
  return argv;
}

/**
 * The same line as the string a reader sees. Split from `exportArgv` because
 * the Copy-and-Execute control takes an ARGV — a string cannot be executed, and
 * a screen holding both as independent values is exactly the drift the confirm
 * exists to prevent. One source, two renderings of it.
 */
export function exportCommand(body) {
  return composeCommand(exportArgv(body));
}

/**
 * `.phd` + `h2` + empty `.verdict`, then `.psub` — `screenHead()`'s shape,
 * written out here because this screen has no verdict key to give it and no
 * badge to keep. See this file's header for both halves of that.
 */
function portHead(ctx, root) {
  const phd = el('div', 'phd');
  const heading = el('h2');
  heading.append(...ctx.t('port.h'));
  phd.append(heading, el('span', 'verdict'));
  const sub = el('p', 'psub');
  sub.append(...ctx.t('port.sub'));
  root.append(phd, sub);
}

/** `<span class="chip ok" data-g="●">travels</span>` — the mockup's chip, whole.
 *
 * `data-g` is set for fidelity with the design of record and carries nothing:
 * the glyph itself comes from `.chip.ok::before`, so it is written once, in
 * CSS. Same arrangement, same reason, as `work.js`'s stale chip. */
function chip(ctx, spec) {
  const span = el('span', spec.cls);
  span.dataset.g = spec.glyph;
  span.append(...ctx.t(spec.key));
  return span;
}

/** The same chip with a LITERAL label — an audit kind's own identifier, which
 * no string table declares and none should. See `auditChips`. */
function literalChip(spec) {
  const span = el('span', spec.cls, spec.kind);
  span.dataset.g = spec.glyph;
  return span;
}

/**
 * `<tr><td class="m">items/**</td><td><span class="chip …"></td></tr>`.
 *
 * A verdict the table has no chip for is drawn as its own word in a `.m` cell
 * — a fourth verdict is data this screen received and cannot dress, and
 * showing it plainly is the only reading that neither drops the row nor
 * mislabels it. The endpoint's test pins the vocabulary at three, so this is
 * the same kind of unreachable-but-honest branch as `rungView`'s.
 */
function travelsRow(ctx, row) {
  const tr = el('tr');
  const path = el('td', 'm', typeof row?.path === 'string' ? row.path : '');
  const verdict = row?.verdict;
  if (Object.hasOwn(VERDICT_CHIP, verdict)) {
    const cell = el('td');
    cell.append(chip(ctx, VERDICT_CHIP[verdict]));
    tr.append(path, cell);
  } else {
    tr.append(path, el('td', 'm', String(verdict ?? '')));
  }
  return tr;
}

/**
 * `<tr><td><b>A plain directory</b></td><td class="small">canonical…</td></tr>`,
 * plus the badge when the rung is not built.
 *
 * The badge sits INSIDE the name cell, after a space, exactly as `config.js`
 * appends it after its note — a sibling of the name and never a child of it,
 * because a translated element's children are replaced wholesale from the
 * string table and would take a nested badge with them.
 */
function rungRow(ctx, view) {
  const tr = el('tr');
  const nameCell = el('td');
  // `.m` on the name when it is a literal identifier rather than a translated
  // phrase — the mockup's own split between `<b data-t="port.f1">` and
  // `<b class="m">git bundle</b>`.
  const name = view.nameKey === null ? el('b', 'm', view.label) : el('b');
  if (view.nameKey !== null) name.append(...ctx.t(view.nameKey));
  nameCell.append(name);
  if (view.badge) nameCell.append(' ', el('span', 'prop', 'PROPOSED'));

  const note = el('td', 'small');
  if (view.noteKey === null) note.append('—');
  else note.append(...ctx.t(view.noteKey));

  tr.append(nameCell, note);
  return tr;
}

/**
 * `<tr><td><span class="chip ok">new</span></td><td class="small">—</td></tr>`.
 *
 * **The Example column is an em dash, and the mockup's three ids are not
 * drawn.** They are illustrations — `STD-api-errors-use-problem-json` and the
 * two beside it are not in this corpus and are not in the response, and the
 * endpoint says so in the words this row honours: *"Sorting real ids into
 * buckets needs an artefact to have ARRIVED and to be read from a path, and
 * this surface reads nothing a browser names."* There is no `/api/port`
 * request that takes an artefact, and there is no POST anywhere in this UI, so
 * there is no state of this build in which those cells hold data.
 *
 * The column HEAD stays, because the column is the design of record's and the
 * day an import surface exists it fills. The em dash is this design's own mark
 * for "no value here" and the treatment `status.js` settled on for the two
 * queue counts its endpoint cannot answer. What the em dash cannot say is WHY
 * — no key exists for it — and that is the same open question `status.js`
 * calls its loudest.
 */
function bucketRow(ctx, name) {
  const tr = el('tr');
  const spec = bucketView(name);
  const label = el('td');
  if (spec === null) label.append(el('span', 'm', String(name ?? '')));
  else label.append(chip(ctx, spec));
  tr.append(label, el('td', 'small', '—'));
  return tr;
}

/** `<div class="cmd"><code>…</code><button>Copy</button></div>`.
 *
 * The hand-rolled Copy button that used to live here is gone: it was one of
 * nine across `screens/`, and adding Execute nine times would have been nine
 * chances to get the confirm wrong. `lib/command-actions.js` is the one
 * spelling, and the "Copied"/"Copy failed" labels this button owed the mockup
 * are its problem now.
 *
 * The control is a SIBLING of `.cmd` rather than a child: `.cmdactions button`
 * carries its own background precisely so the control does not depend on which
 * container it lands in, and the only global button rule sets colour and no
 * background — which is how the Composer's read button came to render as light
 * text on the user agent's near-white button face. A fragment rather than a
 * wrapping `<div>`, because a classless container is the other half of that
 * same defect. */
function commandRow(ctx, argv) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(argv)));
  // **`id: null` — Copy alone, and here that is the answer twice over.**
  //
  // `mycontext export` is not in the command catalogue, and the client sends a
  // catalogue id and never a command (§3.1), so there is nothing for the server
  // to rebuild. That alone settles it.
  //
  // The second reason survives the catalogue gaining an entry: **this line is
  // deliberately one argument short**. `--out` arrives with no destination
  // because the CLI refuses to default one — *"an artefact written into
  // whatever directory the command happened to be run from is the one
  // destination nobody chose"* — and an Execute button on it could only refuse,
  // or run somewhere the reader did not pick. Weighed against offering Execute
  // and letting the server's refusal explain itself, which puts the reader one
  // click from a dialog whose whole content is that the button should not have
  // been there.
  block.append(box, commandActions({ argv, id: null, values: {}, ctx }));
  return block;
}

export async function render(root, ctx) {
  root.replaceChildren();
  portHead(ctx, root);

  let body;
  try {
    body = await ctx.api('/api/port');
  } catch (error) {
    // Drawn INSTEAD of the three cards, never beside empty ones. Every table
    // on this screen is data; a workspace that answers and a read that failed
    // are opposite facts, and three empty tables under three headings would
    // report the good one. `/api/port` 404s off-workspace with its own
    // sentence, and that sentence is worth more than a blank ladder.
    root.append(errorNote(error.message));
    return;
  }

  const two = el('div', 'two');
  root.append(two);

  // ── What travels ────────────────────────────────────────────────────────
  const travels = el('div', 'card pane');
  const travelsHead = el('h3');
  travelsHead.append(...ctx.t('port.what'));
  const travelsTable = el('table');
  const travelsBody = el('tbody');
  for (const row of Array.isArray(body.travels) ? body.travels : []) {
    travelsBody.append(travelsRow(ctx, row));
  }
  travelsTable.append(travelsBody);

  const hist = el('p', 'small');
  hist.append(...ctx.t('port.hist'));

  // The prose's claim, measured — see `auditChips`. A second `p.small` in a
  // card the mockup gives one: no new element KIND, and the kinds inside it
  // (`span.chip.ok`, `span.chip.warn`) are the ones the table above already
  // draws. Recorded in this task's report as content the mockup does not have.
  const kinds = el('p', 'small');
  for (const spec of auditChips(body.history)) kinds.append(literalChip(spec), ' ');
  travels.append(travelsHead, travelsTable, spaced(hist), spaced(kinds));

  // ── The format, in order of preference ──────────────────────────────────
  const formats = el('div', 'card pane');
  const formatsHead = el('h3');
  formatsHead.append(...ctx.t('port.fmt'));
  const formatsTable = el('table');
  const formatsBody = el('tbody');
  for (const format of Array.isArray(body.formats) ? body.formats : []) {
    formatsBody.append(rungRow(ctx, rungView(format)));
  }
  formatsTable.append(formatsBody);
  const git = el('p', 'small');
  git.append(...ctx.t('port.git'));
  formats.append(formatsHead, formatsTable, spaced(git));

  two.append(travels, formats);

  // ── On import — three buckets ───────────────────────────────────────────
  const collide = el('div', 'card pane');
  const collideHead = el('h3');
  collideHead.append(...ctx.t('port.coll'));
  const collideTable = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['th.bucket', 'th.example']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const collideBody = el('tbody');
  for (const name of Array.isArray(body.buckets) ? body.buckets : []) {
    collideBody.append(bucketRow(ctx, name));
  }
  collideTable.append(thead, collideBody);
  collide.append(collideHead, collideTable);

  // The command block, or the refusal where it would have been — the card's
  // other half is still worth reading, so a missing argv costs the line and
  // not the screen. `work.js` makes the same call about a revision it cannot
  // settle.
  try {
    collide.append(commandRow(ctx, exportArgv(body)));
  } catch (error) {
    collide.append(errorNote(error.message));
  }

  root.append(collide);
}
