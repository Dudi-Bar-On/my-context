/**
 * `nav.ch` — **Template packs**, `<section data-p="packs">` in the design of
 * record, over `GET /api/packs`.
 *
 * The mockup draws four cards of prose and one example command and lists no
 * pack. This screen draws those cards — from the ENDPOINT wherever the
 * endpoint answers, which is three of them — and then appends the half the
 * mockup could not draw because nothing served it: the packs that are actually
 * in this workspace, joined to the corpus as it is now. `packs-model.ts` states
 * why that half exists at all: served without it *"this screen is an explainer
 * with a copy button"*
 * (`src/ui/packs-model.ts` · `copy button, which is the judgement `/api/help/:topic` already made about` · ~38).
 *
 * ── THE UNTRUSTED STRING, AND HOW IT IS DRAWN ─────────────────────────────
 *
 * **`packs[].name` is attacker-controlled text and this screen is the surface
 * that has to survive it.** `screenPackMeta` screens the MANIFEST's name, but
 * `pack import --name <text>` overrides it after `planImport` has already run
 * — measured 2026-08-23: a `--name` carrying U+202E RIGHT-TO-LEFT OVERRIDE
 * exits 0 and is written into `import.json` verbatim, and so is one carrying a
 * newline. The read model reports that and deliberately does not screen on the
 * read path, because a finding there *"could only refuse to serve one, which
 * hides a pack instead of naming a bad name"*, and it ends by naming this
 * file's duty:
 * (`src/ui/packs-model.ts` · `accepted. The screen this feeds must treat `name` as untrusted text.` · ~288).
 *
 * So every string this response read off disk goes through `isolated()` — a
 * `<bdi class="m">` — and NOTHING is stripped, replaced or refused here. The
 * value shown is the value stored, which is the only rendering a person can
 * act on: a name they cannot see is a name they cannot pass to
 * `review promote --all --pack`.
 *
 * The isolation is anchored TWICE, on purpose:
 *
 *   - the `<bdi>` ELEMENT carries `unicode-bidi: isolate` from the HTML user-
 *     agent stylesheet, and `styles.css` carries the mockup's own rule for it
 *     (`src/ui/public/styles.css` · `bdi{unicode-bidi:isolate}` · ~420) under
 *     the heading *"Direction UNKNOWN: anything read off disk or out of the
 *     corpus"* — which is exactly what a pack name is;
 *   - the `.m` CLASS adds `direction:ltr` on top of a second
 *     `unicode-bidi:isolate`
 *     (`src/ui/public/screens/parts.js` · `/** A monospace, direction-known run. `.m` is `direction:ltr; unicode-bidi:isolate`. *` · ~38),
 *     which pins the run's BASE direction so a leading control character
 *     cannot decide it, and marks the name as what it is: the token
 *     `review promote --all --pack` matches.
 *
 * Either anchor alone would contain an unpaired RLO/LRO inside the run; both
 * together mean the containment survives a class rename or an element swap
 * rather than depending on one of them. What isolation buys is precise and
 * worth stating: an override inside the name can still reorder the NAME, and
 * cannot reorder one glyph of the row, the card, or the page around it. The
 * newline is defused by a different property of the medium — HTML collapses it
 * to a space inside a `<bdi>` that no rule gives `white-space:pre` — so the
 * *"second line of a report"* `refusePackName` refuses on the manifest path
 * cannot be forged here at all.
 *
 * `test/ui/packs-screen.test.ts` holds both halves: `isolated()` takes its
 * `doc` as an argument, the arrangement `lib/i18n.js`'s `t()` uses so
 * `node --test` can pass a two-method stand-in, and a source guard asserts
 * `pack.name` reaches no other renderer.
 *
 * ── WHAT THE DESIGN OF RECORD GOT WRONG, AND WHAT THIS DRAWS INSTEAD ──────
 *
 * **`pk.trust` paired `init --pack` with `active`.** Both routes land `draft`
 * — one `applyImport` behind both surfaces, its create input hard-coding the
 * status
 * (`src/ui/packs-model.ts` · `**Both are `draft`, and the mockup says one of them is `active`.** The` · ~155).
 * The mockup and both string tables have since been corrected to say `draft`
 * twice, and this screen still does not read those two keys: the chip's text
 * is `landing.initPack` / `landing.packImport` as SERVED, so the day the build
 * lands something else the screen says so instead of continuing to print a
 * translated word. `pk.active` and `pk.draft` are therefore the two `pk.` keys
 * this screen does not place, which its test pins as a set rather than leaving
 * to be noticed.
 *
 * The chip's CLASS is the mockup's `chip warn` on both rows, unconditionally.
 * The colour is an appearance decision and the mockup is the appearance
 * authority; the WORD is the measurement. Nothing here maps a status to a
 * colour, because no such mapping is served and inventing one would be this
 * file deciding that `active` is a success.
 *
 * ── FIVE CONFIG KEYS, NOT THE TWO THAT WERE DRAWN ─────────────────────────
 *
 * `carries[]` answers all five top-level config keys, computed by
 * `refusePackConfig` itself; the mockup drew `budgets` and `watchedDocs`. One
 * row per served entry, in the order served — *"a table filtered to the rows
 * somebody had already thought of is the silent drop this project bans"*
 * (`src/ui/packs-model.ts` · `**All five keys, not the two the mockup draws.** The set is the loader's, and` · ~123).
 *
 * The row LABEL follows the mockup's own split, which is not uniform and is
 * transcribed rather than tidied: `categories` takes the translated
 * `pk.cats` ("category configuration"), every other key takes a bare `.m` cell
 * holding the key itself
 * (`docs/design/web-ui-mockup.html` · `<tr><td class="m">watchedDocs</td><td><span class="chip warn" data-g="&#9650;" data-t="pk.never">never</span></td></tr>` · ~3628).
 * A config key is not English — it is what the reader types into their own
 * `config.json` — and that is why the mockup draws three of the four as
 * literals in both languages.
 *
 * `items/**` is drawn FIRST and is static, exactly as the mockup draws it. The
 * read model refuses to serve it and is right to — *"it is not a config key,
 * and 'a pack's items travel' is a restatement of what a pack IS"*
 * (`src/ui/packs-model.ts` · `reads. `items/**` is deliberately NOT a row: it is not a config key, and "a` · ~131)
 * — but the task's standing rule for this pass is that where no endpoint
 * answers, the mockup's static content is rendered rather than dropped. It is
 * the only row in the table nobody measured, and this file's report says so.
 *
 * **`carries[].refusals` is served and NOT drawn.** Each refusing key carries
 * `refusePackConfig`'s own sentences, and the card the mockup drew is exactly
 * `h3 + table + p.small` — `pk.line` IS the design of record's answer to "why",
 * in both languages. Four paragraphs of untranslated server English under a
 * two-column table would be a card the design of record does not have. Left
 * unread and reported, the call `status.js` records for its own eight served
 * fields
 * (`src/ui/public/screens/status.js` · `unread rather than promoted into columns the design of record does not` · ~46).
 * `artefact.protocol`, `artefact.manifest` and `artefact.meaning` are unread
 * for the same reason: `pk.theatre` is the fifth surface saying `meaning`, and
 * the other two have no row in `pk.man` to sit in.
 *
 * ── THE PACK LIST: LABELS THAT ARE NOT ENGLISH ────────────────────────────
 *
 * No string key exists for `missing`, `quarantined` or `dropped`. All three are
 * served and all three are real, and inventing a key is forbidden — so the
 * labels in a pack's table are **the endpoint's own field paths**, drawn in a
 * `.m` cell: `manifestFiles`, `items.total`, `items.byStatus.draft`, `missing`,
 * `historyRecords`, `quarantined`. That is the same treatment the mockup gives
 * `budgets` and `watchedDocs` one card up, applied to the same kind of thing: a
 * key, not a sentence, identical in English and Hebrew. It is a judgement and
 * not a rule, and the alternative it was weighed against — leaving the three
 * counts undrawn — loses a fact the reader has no other way to learn: nothing
 * will ever offer to promote a quarantined row, and `pack list` never mentions
 * one.
 *
 * `dropped[]` needs no such judgement. It arrives with the server's OWN
 * sentence, and that sentence is rendered verbatim through `errorNote` — the
 * treatment `parts.js` already gives an endpoint's `error` text, *"the seen
 * file's own words, not a paraphrase"*.
 *
 * **`kind: 'export'` rows are NOT filtered.** An export imported under `--name`
 * is a member of this list, the read model carries it deliberately — *"hiding
 * it would be a filter with no disclosure"*
 * (`src/ui/packs-model.ts` · `**No paging, no cap, no filter.** Every record `readImportRecords` returns is` · ~403)
 * — and this screen draws every row it is sent, with `kind` as the first line
 * of every card so an export is labelled rather than assumed. The heading over
 * them says "Template packs" and one of them may not be a template pack; that
 * is a wording question for the owner, and a screen that quietly answered it
 * with a filter would have deleted a pack from the reader's own workspace.
 *
 * ── WHAT IS NOT DRAWN FROM THE SECTION ────────────────────────────────────
 *
 * `span.verdict` and `span.prop`. The mockup's `.phd` closes with
 * `<span class="verdict"><span class="prop">PROPOSED</span></span>` — no glyph
 * and no `data-t`, because the badge is a SCOPE marker rather than a verdict,
 * and this task's own record retires it: *"Approved for implementation by the
 * owner on 2026-08-22; the mockup's PROPOSED badge is retired as a scope
 * marker."* No `pk.v` exists in either string table to put in its place, and an
 * empty `.verdict` drawn to satisfy a kind count would be parity theatre.
 *
 * **"No `pk.v` exists" is the state of the tables, not a prohibition — and this
 * file read it as one.** It is the second of the two sites `plan:walk seq:92`'s
 * grep missed (`screens/port.js` is the other), because both phrase the retired
 * `strings-parity` premise as *a key that does not exist* rather than *a key
 * that may not be invented*. The invented direction was dropped on 2026-08-26
 * by `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, so `pk.v`
 * could be written into both tables today and the gate would pass. It is not
 * written here because a verdict claims what a screen is GOOD AT, and
 * `DEC-claude-drafts-the-mockup-and-the-owner-approves` reserves that approval
 * to the owner — `plan:walk seq:108` takes all three verdicts to them at once.
 * Both
 * kinds are in this task's report for the `KNOWN_GAPS` ledger. That is also why
 * this file writes its own heading instead of calling `screenHead`, which
 * requires a verdict key.
 *
 * ── ONE REFUSAL, DRAWN INSTEAD OF EVERYTHING ──────────────────────────────
 *
 * Every card on this screen is fed by the response — the trust table by
 * `landing`, the carries table by `carries`, the pack cards by `packs`, and the
 * manifest card sits beneath a `pk.theatre` that paraphrases `artefact.meaning`.
 * So a refusal is drawn INSTEAD of the body and never beside an empty one, the
 * rule `status.js`, `doctor.js` and `work.js` all keep: a workspace with no
 * packs and a read that failed are opposite facts, and the explainer cards
 * standing alone would report the good one.
 */
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
import {
  BOUND_CAP_TABLE, boundedList, el, errorNote, idFull, mono, num, spaced,
} from '/screens/parts.js';

/**
 * A string this response read off disk, isolated and shown verbatim.
 *
 * See this file's header for why the element and the class BOTH carry the
 * isolation, and for what isolation does and does not buy. `doc` is an
 * argument rather than a closed-over global for the reason `lib/i18n.js` gives
 * for `t()`'s: *"`doc` exists so `node --test` can pass a two-method stand-in;
 * the browser never passes it"*. The DOM half of this screen has no test, by
 * spec §6; this one decision does, because it is the one a hostile input
 * attacks.
 *
 * `String(text)` and not a guard: a field the endpoint typed as a string
 * arriving as something else is a defect in the response, and rendering
 * `undefined` where a name goes is a visible defect rather than a blank cell.
 */
export function isolated(text, doc = globalThis.document) {
  const node = doc.createElement('bdi');
  node.className = 'm';
  node.textContent = String(text);
  return node;
}

/**
 * The mockup's `pk.what` rows that carry a TRANSLATED label rather than the
 * config key itself. Its own split, transcribed: one entry, because the mockup
 * translates exactly one of the four rows it drew.
 */
const CARRIES_LABEL = { categories: 'pk.cats' };

/**
 * The `pk.what` table's rows: the mockup's unmeasured `items/**` row, then one
 * row per served entry, in the order served.
 *
 * Pure, and exported, so `test/ui/packs-screen.test.ts` can hold the thing the
 * task left open — that five served keys produce five rows. A filter here is
 * the silent drop, and a filter here is now a red test.
 */
export function carriesRows(carries) {
  const rows = [{
    key: 'items/**',
    labelKey: null,
    // Static: no endpoint answers it and the read model explains why. Drawn
    // because the mockup draws it, marked because it is the one row on this
    // card nobody measured.
    measured: false,
    travels: true,
  }];
  for (const row of carries) {
    rows.push({
      key: row.key,
      labelKey: CARRIES_LABEL[row.key] ?? null,
      measured: true,
      travels: row.travels === true,
    });
  }
  return rows;
}

/**
 * One pack's table: `{ label, text }` or `{ label, count }`, plus the one row
 * that carries both a count and the ids behind it.
 *
 * `label` is the endpoint's own field PATH and never a sentence — see this
 * file's header. `name` is deliberately absent: it is the card's heading, and
 * a name repeated in the table would be a second place the untrusted string is
 * rendered, which is a second place to get its isolation wrong.
 *
 * `byStatus` expands to one row per status PRESENT, which is the shape the
 * endpoint serves — *"a zero invented for the other four would be this module
 * deciding which statuses a screen should draw"*. Sorted, because
 * `Object.keys` order is insertion order over ids and would reorder the table
 * when an unrelated item changed status.
 *
 * `missing` is drawn even when empty, and so are `quarantined` and
 * `historyRecords`: a row that disappears at zero cannot be told apart from a
 * row this build never had.
 */
export function packRows(pack) {
  const rows = [
    { label: 'kind', text: pack.kind },
    { label: 'version', text: pack.version },
    { label: 'source', text: pack.source },
    { label: 'importedAt', text: pack.importedAt },
    { label: 'manifestFiles', count: pack.manifestFiles },
    { label: 'items.total', count: pack.items.total },
  ];
  for (const status of Object.keys(pack.items.byStatus).toSorted()) {
    rows.push({ label: `items.byStatus.${status}`, count: pack.items.byStatus[status] });
  }
  // Named and not merely counted, which is the endpoint's own ruling about
  // this field: a bare count is a number the reader has to trust.
  rows.push({ label: 'missing', count: pack.missing.length, ids: pack.missing });
  rows.push({ label: 'historyRecords', count: pack.historyRecords });
  rows.push({ label: 'quarantined', count: pack.quarantined });
  return rows;
}

/**
 * The mockup's one example command, composed through the ONE quoting
 * implementation rather than written out as a literal a second time.
 *
 * Every argument is `SAFE` under `quoteArg`, so this composes byte-identical
 * to the `<code>` the design of record draws
 * (`docs/design/web-ui-mockup.html` · `<div class="cmd"><code>mycontext init --pack ../packs/regulated-industry</code>` · ~3649),
 * and the test pins it to that line read out of the mockup rather than to a
 * copy of it here.
 */
export const IMPORT_ARGV = ['mycontext', 'init', '--pack', '../packs/regulated-industry'];

export function importCommand() {
  return composeCommand(IMPORT_ARGV);
}

/**
 * `<div class="cmd"><code>…</code></div>` followed by the ONE Copy-and-Execute
 * control.
 *
 * **The transcribed copy button is gone.** This file used to say it was
 * transcribed from `doctor.js`/`work.js` "because a fourth spelling in
 * `parts.js` is a refactor this task does not own" — that refactor is now owned
 * and done, in `lib/command-actions.js`, because adding Execute to nine
 * transcriptions would have been nine chances to get the confirm wrong and the
 * confirm is the security boundary.
 *
 * **`id: null`, and this screen is one of the two places that is the ANSWER
 * rather than a shortfall.** `mycontext init` is not in the command catalogue —
 * it is the command that is run before there is a workspace for this UI to be
 * served from, so there was never anything for the catalogue to carry — and the
 * client sends a catalogue id, never a command. With no id there is nothing for
 * the server to rebuild, so the control draws Copy alone. Weighed against
 * passing the nearest id to get an Execute button, which is exactly how a
 * different command ships behind a confirm that looks right.
 *
 * A fragment rather than a wrapping `<div>`: `.cmd` is the mockup's element and
 * `.cmdactions` is the control's own, and a classless container between them is
 * precisely what made the Composer's read button invisible on 2026-08-27 —
 * `.cmdactions button` carries its own background so that it does not matter
 * which of six containers it lands in, and nesting it inside `.cmd` would quietly
 * make it matter again.
 */
function commandRow(ctx, argv) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(argv)));
  block.append(box, commandActions({ argv, id: null, values: {}, ctx }));
  return block;
}

/** `<span class="chip …" data-g="…">text</span>` — the mockup's chip, verbatim. */
function chip(cls, glyph) {
  const node = el('span', cls);
  // `data-g` is the mockup's attribute and is set for fidelity; the glyph
  // itself is painted by `.chip.warn::before`, so it is written once, in CSS.
  node.dataset.g = glyph;
  return node;
}

/** A `<tr>` of two cells, the shape every table on this screen is made of. */
function row(first, second) {
  const tr = el('tr');
  tr.append(first, second);
  return tr;
}

/**
 * `pk.trust` — where an imported item lands, on each of the two routes.
 *
 * The route names are `.m` literals exactly as the mockup writes them: they are
 * command lines, not prose, and no `data-t` marks either.
 */
function trustCard(ctx, landing) {
  const card = el('div', 'card pane');
  const head = el('h3');
  head.append(...ctx.t('pk.trust'));

  const tbody = el('tbody');
  for (const [route, status] of [['init --pack', landing.initPack], ['pack import', landing.packImport]]) {
    const left = el('td');
    left.append(mono(route));
    const right = el('td');
    // The SERVED status, not `pk.active`/`pk.draft`. See this file's header:
    // the two keys say "draft" today because the build does, and a screen that
    // printed the key would go on saying it if the build stopped.
    const badge = chip('chip warn', '▲');
    badge.append(document.createTextNode(status));
    right.append(badge);
    tbody.append(row(left, right));
  }
  const table = el('table');
  table.append(tbody);

  const note = el('p', 'small');
  note.append(...ctx.t('pk.trustn'));
  card.append(head, table, spaced(note));
  return card;
}

/** `pk.what` — one row per served config key, plus the mockup's static one. */
function carriesCard(ctx, carries) {
  const card = el('div', 'card pane');
  const head = el('h3');
  head.append(...ctx.t('pk.what'));

  const tbody = el('tbody');
  for (const entry of carriesRows(carries)) {
    const left = entry.labelKey === null ? el('td', 'm', entry.key) : el('td');
    if (entry.labelKey !== null) left.append(...ctx.t(entry.labelKey));
    const right = el('td');
    const badge = entry.travels ? chip('chip ok', '●') : chip('chip warn', '▲');
    badge.append(...ctx.t(entry.travels ? 'port.yes' : 'pk.never'));
    right.append(badge);
    tbody.append(row(left, right));
  }
  const table = el('table');
  table.append(tbody);

  const note = el('p', 'small');
  note.append(...ctx.t('pk.line'));
  card.append(head, table, spaced(note));
  return card;
}

/**
 * `pk.man` — the four rows of the mockup's integrity table, all four static.
 *
 * `sha256` is the mockup's own literal and stays one. The read model refuses to
 * serve it and explains why in words this file will not repeat by writing a
 * second copy: *"Serving a hand-written `"sha256"` here would be a second place
 * the algorithm is written down, free to disagree with the one that hashes."*
 * Drawing the design of record's literal on the page it belongs to is not that
 * second place — it is the transcription this task was asked for — and the row
 * being unmeasured is in the report.
 */
function manifestCard(ctx) {
  const card = el('div', 'card pane');
  const head = el('h3');
  head.append(...ctx.t('pk.man'));

  const tbody = el('tbody');
  const digestLabel = el('td');
  digestLabel.append(...ctx.t('pk.m1'));
  const digestValue = el('td', 'small');
  const bold = el('b');
  bold.append(...ctx.t('pk.m1n'));
  digestValue.append(mono('sha256'), ', ', bold);
  tbody.append(row(digestLabel, digestValue));

  for (const [labelKey, valueKey] of [['pk.m2', 'pk.m2n'], ['pk.m3', 'pk.m3n'], ['pk.m4', 'pk.m4n']]) {
    const label = el('td');
    label.append(...ctx.t(labelKey));
    const value = el('td', 'small');
    value.append(...ctx.t(valueKey));
    tbody.append(row(label, value));
  }
  const table = el('table');
  table.append(tbody);

  const note = el('p', 'small');
  note.append(...ctx.t('pk.theatre'));
  card.append(head, table, spaced(note), commandRow(ctx, IMPORT_ARGV));
  return card;
}

/**
 * One pack in this workspace. The heading is the pack's own NAME and nothing
 * else — the untrusted string, isolated, and the only place it is rendered.
 */
function packCard(pack) {
  const card = el('div', 'card pane');
  const head = el('h3');
  head.append(isolated(pack.name));

  const tbody = el('tbody');
  for (const entry of packRows(pack)) {
    const left = el('td', 'm', entry.label);
    // The em dash is the design of record's own mark for "no value here"
    // (`status.js` draws one for a count nothing measured). An empty `<bdi>`
    // would render as a blank cell, which reads as a defect rather than as the
    // fact `version` carries for an export imported under `--name`. It is
    // drawn as `td.small` — the cell the mockup already has for a dim value —
    // and not as a `span.small` inside a bare `td`, which would be one more
    // element kind on the KNOWN_GAPS ledger's other column for no gain.
    const empty = entry.text === '';
    const right = empty ? el('td', 'small', '—') : el('td');
    if (empty) {
      // The cell IS the mark; there is nothing to put inside it.
    } else if (Object.hasOwn(entry, 'text')) {
      right.append(isolated(entry.text));
    } else {
      right.append(mono(num(entry.count)));
      // Every id, uncapped — the list is already bounded by one import's own
      // membership, and a cap would be a truncation to disclose.
      for (const id of entry.ids ?? []) right.append(' ', idFull(id));
    }
    tbody.append(row(left, right));
  }
  const table = el('table');
  table.append(tbody);
  card.append(head, table);
  return card;
}

/**
 * `dropped[]` — `readImportRecords`' own silence, made visible.
 *
 * The card carries no `<h3>`: there is no key for one and the entries are not a
 * category anyone named. Each note is the SERVER'S sentence, verbatim, with the
 * directory it is about isolated in front of it — the same treatment
 * `errorNote` gives an endpoint refusal, and for the same reason. `.spill` is
 * `--crit` and that is the right register: a directory under `.audit/imported/`
 * with no `import.json` is a half-imported pack nothing will ever offer to
 * promote.
 */
function droppedCard(dropped) {
  const card = el('div', 'card pane');
  for (const drop of dropped) {
    const note = errorNote(drop.message);
    note.prepend(isolated(drop.where), ' ');
    card.append(note);
  }
  return card;
}

export async function render(root, ctx) {
  root.replaceChildren();

  // The mockup's `.phd`, minus the `.verdict`/`.prop` pair the task retired.
  // `screenHead` is not called because it REQUIRES a verdict key and this
  // screen has none to give it; see this file's header.
  const phd = el('div', 'phd');
  const title = el('h2');
  title.append(...ctx.t('pk.h'));
  phd.append(title);
  const sub = el('p', 'psub');
  sub.append(...ctx.t('pk.sub'));
  root.append(phd, sub);

  let body;
  try {
    body = await ctx.api('/api/packs');
  } catch (error) {
    // Instead of the body, never beside it. A corrupt import record reaches
    // here as the server's 500 carrying `readImportRecords`' own sentence, and
    // that sentence is what the reader needs; four cards of prose about packs
    // in general, drawn beside it, would bury it.
    root.append(errorNote(error && error.message ? error.message : String(error)));
    return;
  }

  const two = el('div', 'two');
  two.append(trustCard(ctx, body.landing), carriesCard(ctx, body.carries));
  root.append(two, manifestCard(ctx));

  // **Every row served, in the order served** — that part is unchanged and is
  // the response's own contract, `kind: 'export'` rows included. What is new is
  // that the stack now DECLARES its bound instead of growing without one. A
  // pack import IS a record (`.audit/imported/` stamps each), so it bounds by
  // time; `take: 'last'` because that directory is read in append order.
  const stack = el('div');
  const bound = boundedList(ctx, stack, body.packs, (pack) => packCard(pack),
    { cap: BOUND_CAP_TABLE, order: 'recent', take: 'last' });
  root.append(stack, bound);
  if (body.dropped.length > 0) root.append(droppedCard(body.dropped));
}
