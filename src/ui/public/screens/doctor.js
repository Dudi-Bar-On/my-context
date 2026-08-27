/**
 * `nav.ev` — **Doctor**, `<section data-p="doctor">` in the design of record.
 * `runChecks`' findings, kept whole: *"a findings list flattened to 'exit 1'
 * is what a terminal loses"* (`doc.v`).
 *
 * **Three cards, one per LEVEL, each row carrying its code — the mockup's
 * arrangement, not the plan's.** The plan's Step 3 sketch builds one
 * `<section>` per CODE with a `<ul>` inside it; `<section data-p="doctor">`
 * builds `<div class="card pane">` per level — `error`, `warning`, `notice` —
 * each holding a `<table>` whose first cell is the code. Both readings satisfy
 * `doc.sub` (*"Grouped by finding code, three levels kept distinct"*), and the
 * mockup is the specification, so the levels are the cards and the grouping by
 * code is the ROW ORDER inside each one: `groupFindings` orders the codes
 * worst-first and this file walks that order three times, once per level.
 *
 * **The three levels are given no hue, and that is the mockup's answer to the
 * question the plan raised.** The reconciliation note worried that `.gap` and
 * `.spill` both retarget to `--crit` post-repaint and would collapse `error`
 * and `warn` into one colour — true, and the reason this screen uses neither.
 * What it uses instead is what the mockup uses: a card per level with the
 * level's NAME in its heading. That survives `forced-colors`, survives print,
 * survives a reader who does not know the palette — and it is the same
 * argument the repaint spec makes against category glyphs one section earlier,
 * `docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md` · `A glyph beside it repeats what the reader has already been told` · ~191.
 * A `.chip.crit` on every row of a card headed `error` is exactly that
 * repetition. The five meaning hues are therefore unused here, deliberately,
 * and this task's report says so rather than leaving it to be discovered.
 *
 * **The message is the CHECKER'S OWN TEXT.** `doc.d1`…`doc.d5` in the string
 * tables are the mockup's sample sentences for five specific findings, three
 * of which name checks that do not exist yet (they wear the mockup's own
 * `PROPOSED` badge). A real `Finding.message` is composed at run time from the
 * paths, checksums and counts of THIS corpus and cannot be translated by a
 * lookup; rendering `doc.d1` beside a `source_drift` about a different file
 * would be a caption contradicting its own subject. Same treatment every other
 * endpoint string in this UI gets: the producer's words, unedited.
 *
 * **Unedited, and ISOLATED where he QUOTED a machine literal.** The mockup's
 * own `dead_scope` cell reads `scope <span class="m v">src/billing/**</span>
 * matches no file`: the glob is lifted out of the sentence and isolated,
 * because a glob inside prose reorders in an RTL page
 * (`e2e/bidi.spec.ts` · `renders with its segments reversed` · ~6). This
 * screen cannot draw that span's `.v` half — `lib/i18n.js` builds `m v` for an
 * `{mv:}` SLOT and only for one, and nothing here substitutes a value into a
 * translated string. What it has is a literal the PRODUCER wrote, which is the
 * other half of the same pair
 * (`src/ui/public/lib/i18n.js` · `out.push(run('m', payload));` · ~71), and
 * `.m` is precisely what the stylesheet reserves for one
 * (`src/ui/public/styles.css` · `Direction KNOWN ltr: identifiers, paths, globs, commands, flags.` · ~261).
 * So `messageRuns` isolates what he quoted and changes not one character of
 * what he wrote.
 *
 * **The repair command is composed and never run** (spec §4). Which codes get
 * one, and why most do not, is `repairCommandFor`'s docstring — established by
 * reading `src/doctor/checks.ts`'s messages and then the usage banner of every
 * command those messages name. One `.cmd` row per DISTINCT command per card,
 * in the order the rows above it first asked for one, because the mockup draws
 * the commands under the table rather than inside it and two rows sharing a
 * code share a command.
 *
 * **A card whose findings compose nothing draws no `.cmd`, and that is the
 * design of record's own answer rather than a hole in this file.** The
 * mockup's warning card carries a `dead_scope` row and composes NO command for
 * it — the `.cmd` under that card belongs to `watched_docs_no_match`, one of
 * the three PROPOSED checks this build does not have. Measured 2026-08-23
 * against `.demo-corpus`, the corpus `e2e/screen-parity.spec.ts` runs over:
 * `/api/doctor` answers three findings, all `dead_scope`, all `warn`, so the
 * screen draws three cards, three rows and, correctly, not one `.cmd`. That —
 * and not a missing implementation — is why `div.cmd`, `code` and `button` sit
 * in that gate's ledger for this screen; `commandRow` below has built all
 * three since the screen was written, and `screens/work.js` cites it as the
 * precedent for its own.
 *
 * **A clean corpus draws three empty cards, not an empty screen.** Owner
 * ruling: empty renders the real markup with zero rows. A refusal is the other
 * case, and is drawn INSTEAD of the data, in the endpoint's own words.
 */
import { groupFindings } from '/lib/viewmodel.js';
import { composeCommand } from '/lib/command.js';
import { PALETTE, commandFor } from '/lib/palette-defs.js';
import { commandActions } from '/lib/command-actions.js';
import { el, errorNote, linkId, mono, screenHead, spaced } from '/screens/parts.js';

/**
 * The catalogue, by name. A Map rather than a repeated `PALETTE.find`, because
 * three of this screen's four repairs are looked up and a linear scan per
 * finding is a scan per row of a table that can be long.
 */
const CATALOGUE = new Map(PALETTE.map((def) => [def.name, def]));

/**
 * A repair that IS a catalogue entry: the id the server will rebuild from, the
 * values it will rebuild with, and the argv composed by the CATALOGUE'S OWN
 * `commandFor` — the same function `src/ui/execute-catalogue.ts` resolves with.
 *
 * Composing here through the entry rather than through a literal argv is what
 * makes the line a reader sees and the line the server runs one computation
 * instead of two that happen to agree today. Weighed against writing the three
 * argvs out, which is shorter and reads fine — and is exactly how a screen ends
 * up showing `mycontext refresh X` above a confirm that names something else.
 */
function catalogued(id, values) {
  const def = CATALOGUE.get(id);
  if (def === undefined) {
    // Not a refusal a reader can act on — the catalogue shipped without an
    // entry this screen names — so it is a bug, and it fails loudly rather
    // than degrading into a Copy-only control that looks deliberate.
    throw new Error(`doctor: the command catalogue declares no "${id}"`);
  }
  return { id, values, argv: commandFor(def, values) };
}

/**
 * **The repair a finding code earns, as the thing the control takes.**
 *
 * `lib/viewmodel.js`' `repairCommandFor` is where this decision was established
 * and argued — which codes earn a line, and why most do not: a message that
 * asks for a file edit is not a line anyone can paste. It answers a STRING, and
 * a string cannot be executed. The client sends an id and a value bag and never
 * a command (spec §3.1), so the same decision is carried here in that shape,
 * and `test/ui/doctor-screen.test.ts` holds the two equal code by code — a
 * screen that quietly grew its own table would still draw a `.cmd` and still
 * look right.
 *
 * **`audit --files` names NO id, deliberately.** `PALETTE` carries no `audit`
 * entry, so there is nothing for the server to rebuild; `commandActions` draws
 * Copy alone for a null id, and that is the correct outcome rather than a gap
 * to work around. Naming a nearby id instead would put a different command
 * behind a confirm that looked right.
 */
export function repairFor(code, item) {
  if (code === 'index_stale') return catalogued('rebuild', {});
  if (code === 'audit_log_size') {
    return { id: null, values: {}, argv: ['mycontext', 'audit', '--files'] };
  }
  if (code === 'corpus_size_fallback_ceiling') return catalogued('decay', {});
  if (code === 'source_drift' && typeof item === 'string' && item !== '') {
    // **`yes: true`, and without it this command cannot run at all.**
    //
    // Owner-reported 2026-08-28, twice, from this screen:
    //
    //     about to refresh: item REF-… checksum af12674273859b85 -> 244cac0d…
    //     my_context: refusing without confirmation — stdin is not interactive.
    //     Rerun with --yes to confirm, or run this from an interactive terminal.
    //
    // `refresh` REPLACES an item's whole body, so it gates on a human. The gate
    // reads stdin, and a command run from this UI is a child process with no
    // terminal — so it computes the change, prints it, and refuses. The dry run
    // that derives the confirm hits the same wall first, so the confirm never
    // renders either: the button was dead in both directions.
    //
    // **This does not imply the confirmation, it MOVES it.** The catalogue's
    // rule is that `--yes` on the approval boundary is SHOWN, never implied, and
    // it is shown: it is in the argv this composes, so it appears in the `<code>`
    // the reader reads and in the confirm's own copy of the resolved command. The
    // human confirmation is the confirm dialog — that is the entire feature — and
    // the flag is how that decision reaches a process that has no terminal to ask
    // through. Omitting it does not preserve a gate; it removes the command.
    //
    // `work.js` already composes its boundary command this way (`revisionPlan`,
    // `yes: true`). This line was the only one that did not.
    return catalogued('refresh', { id: item, yes: true });
  }
  return null;
}

/**
 * The mockup's three cards, in its order, each with the heading it draws.
 *
 * `error` and `warning` are LITERALS with no `data-t` in the design of record;
 * only the third is keyed (`doc.notice`). That asymmetry is the mockup's and
 * is transcribed rather than corrected — adding `doc.error`/`doc.warning` to
 * the tables would fail `test/ui/strings-parity.test.ts` in the direction that
 * names it: a key in a table that the design of record does not declare. It
 * means two of the three card headings stay English in the Hebrew UI, which is
 * an open question for the owner and not a decision taken here.
 *
 * The heading is also not the level VALUE: `runChecks` emits `warn` and
 * `info`, the mockup writes "warning" and "notice". The level is the join key,
 * the heading is the label, and they are allowed to differ.
 */
const CARDS = [
  { level: 'error', literal: 'error', key: null },
  { level: 'warn', literal: 'warning', key: null },
  { level: 'info', literal: null, key: 'doc.notice' },
];

/**
 * One card's rows: every finding at this LEVEL, in `groupFindings`' order.
 *
 * Lifted out of `render` rather than left inside it because THREE decisions
 * live here and spec §6 puts DOM glue outside what any test can reach — which
 * findings a card claims, the order they arrive in, and whether a row names an
 * item at all. `screens/work.js` took the same cut for the same reason
 * (`fieldView`), and `test/ui/doctor-screen.test.ts` reads all three without
 * standing up a `document`.
 *
 * **`item` is normalised to `null` HERE, once.** A `Finding` may omit it, and
 * an empty string is the same fact as an absent one — `linkId('')` would
 * compose a button that opens the detail pane for no item at all. Both become
 * `null`, which is what the em dash below and `repairCommandFor` each read,
 * rather than two spellings of absence drifting apart in two loops.
 */
export function cardRows(groups, level) {
  const rows = [];
  for (const [code, findings] of groups) {
    for (const finding of findings) {
      if (finding.level !== level) continue;
      const named = typeof finding.item === 'string' && finding.item !== '';
      rows.push({ code, item: named ? finding.item : null, message: finding.message });
    }
  }
  return rows;
}

/**
 * The DISTINCT repair commands one card offers, in the order its rows first
 * asked for them.
 *
 * Nothing here builds a command string. Which code earns one is
 * `repairCommandFor`'s decision and the composition is `lib/command.js`'s, the
 * one place quoting lives in this UI
 * (`src/ui/public/lib/command.js` · `// Command-string composition for every composed write in the UI — the ONE` · ~1),
 * so an id carrying a space is escaped once rather than in a second spelling
 * invented here. `test/ui/doctor-screen.test.ts` pins both halves — the line
 * against the mockup's own `<code>`, and the quoting against an id with a
 * space — because a screen that quietly grew its own composer would still draw
 * a `.cmd` and still look right.
 */
export function cardCommands(rows) {
  const repairs = [];
  const seen = new Set();
  for (const row of rows) {
    const repair = repairFor(row.code, row.item);
    if (repair === null) continue;
    // Deduped by the composed LINE rather than by the id: two `source_drift`
    // rows about different items are two different repairs under one id, and
    // deduping by id would drop the second item's refresh silently.
    const line = composeCommand(repair.argv);
    if (seen.has(line)) continue;
    seen.add(line);
    repairs.push(repair);
  }
  return repairs;
}

/** A literal the checker delimited: `"a glob"` or `` `a command` ``. */
const QUOTED_LITERAL = /"([^"\n]+)"|`([^`\n]+)`/g;

/**
 * The checker's sentence split at the literals HE marked — text, run, text —
 * so the cell can isolate those and nothing else.
 *
 * **The rule is the producer's own punctuation, never a guess at what looks
 * like a path.** Every message in `src/doctor/checks.ts` that embeds a value
 * wraps it in double quotes
 * (`src/doctor/checks.ts` · `scope glob "${glob}" matches no file in the repository.` · ~396)
 * and every message that names a command wraps it in backticks. A heuristic
 * over slashes and asterisks would isolate half a sentence the first time one
 * of them writes "and/or", and it would have to be re-guessed every time a
 * check is added; a delimiter the producer typed is a fact about the message
 * rather than an inference from it.
 *
 * **The delimiters STAY.** They are his characters, and this screen shows his
 * words unedited — only the isolation is added. Joining the runs reproduces
 * the message byte for byte, which is the first thing the test asserts and the
 * only thing that makes "unedited" checkable rather than claimed.
 *
 * An unbalanced quote matches nothing and falls through to one text run, which
 * is exactly what this screen drew before. The failure mode is the old
 * behaviour, never a dropped clause.
 */
export function messageRuns(message) {
  const text = typeof message === 'string' ? message : String(message ?? '');
  const runs = [];
  let last = 0;
  QUOTED_LITERAL.lastIndex = 0;
  for (let m = QUOTED_LITERAL.exec(text); m !== null; m = QUOTED_LITERAL.exec(text)) {
    const literal = m[1] === undefined ? m[2] : m[1];
    // The OPENING delimiter belongs to the text before the run and the closing
    // one to the text after it, so both survive as his characters.
    const open = m.index + 1;
    if (open > last) runs.push({ mono: false, text: text.slice(last, open) });
    runs.push({ mono: true, text: literal });
    last = open + literal.length;
  }
  if (last < text.length) runs.push({ mono: false, text: text.slice(last) });
  return runs;
}

/** `<td class="small">` — the message, with its quoted literals isolated. */
function messageCell(message) {
  const cell = el('td', 'small');
  for (const run of messageRuns(message)) {
    cell.append(run.mono ? mono(run.text) : document.createTextNode(run.text));
  }
  return cell;
}

/**
 * `<div class="cmd"><code>…</code></div>` — the mockup's command row — followed
 * by the ONE Copy-and-Execute control.
 *
 * **The hand-rolled Copy button is gone, and that is the point of the task
 * rather than a tidy-up.** It was one of nine across `screens/`, each with its
 * own error handling and its own words; adding Execute nine times would have
 * been nine chances to get the confirm wrong, and the confirm is the security
 * boundary. `lib/command-actions.js` is the one spelling, and the two keys this
 * button used to owe the mockup are its problem now, not this screen's.
 *
 * **The control is a SIBLING of `.cmd`, not a child of it, and that is the
 * defect the owner reported on 2026-08-27 rather than a layout preference.**
 * `styles.css`'s only global button rule is `button{font:inherit;color:inherit}`
 * — colour and NO background — so a button's readability comes from an ancestor
 * rule. `.cmd button` is why the old Copy looked right; `.cmdactions button`
 * carries its own background precisely so the shared control does not depend on
 * which of six containers it lands in. Nesting it inside `.cmd` would work
 * today and would quietly reintroduce that dependency, and `.cmd` is a
 * one-line flex row that the confirm's table and residual do not fit in.
 *
 * A fragment, because the mockup's `.cmd` is one element and the control is
 * another: wrapping them in a new `<div>` would invent a class the design of
 * record does not draw, or a classless one — and a classless container is
 * exactly what made the Composer's read button invisible.
 */
function commandRow(ctx, repair) {
  const block = document.createDocumentFragment();
  const box = el('div', 'cmd');
  box.append(el('code', null, composeCommand(repair.argv)));
  block.append(box, commandActions({
    argv: repair.argv, id: repair.id, values: repair.values, ctx,
  }));
  return block;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'doc.h', 'doc.v', 'doc.sub');

  let data;
  try {
    data = await ctx.api('/api/doctor');
  } catch (error) {
    // Drawn INSTEAD of the three cards, never beside them: a doctor that could
    // not run and a corpus with no findings are opposite facts, and three
    // empty cards would report the good one.
    root.append(errorNote(error.message));
    return;
  }

  const groups = groupFindings(data.findings);

  for (const card of CARDS) {
    const pane = el('div', 'card pane');
    const heading = el('h3');
    if (card.key === null) heading.append(card.literal);
    else heading.append(...ctx.t(card.key));

    const table = el('table');
    const tbody = el('tbody');
    const rows = cardRows(groups, card.level);

    for (const row of rows) {
      const tr = el('tr');
      tr.append(el('td', 'm', row.code));

      // `item` is OPTIONAL on a Finding and its absence is real —
      // `watched_docs_no_match` and `audit_log_size` name none. The mockup
      // draws an em dash for exactly that row, which is this design's own
      // mark for "no value here"; an empty cell would read as a bug.
      const who = row.item === null ? el('td', 'small', '—') : el('td');
      if (row.item !== null) who.append(linkId(row.item, false));

      tr.append(who, messageCell(row.message));
      tbody.append(tr);
    }

    table.append(tbody);
    pane.append(heading, table);

    // **A LEVEL WITH NO FINDINGS SAYS SO.** Until 2026-08-26 an empty level
    // rendered as a heading over an empty `<tbody>` and nothing else — a card
    // headed `error` containing nothing, which reads AS an error rather than as
    // the absence of one (`plan:walk seq:34`).
    //
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`: a
    // measured zero is drawn and named, and is never blank. This IS a measured
    // zero — `runChecks` ran and this level had none — and it is reachable only
    // here, because a doctor that could not run takes the `errorNote` branch
    // above INSTEAD of the cards. So the two facts cannot be confused: a
    // refusal replaces the cards, an empty level names itself inside one.
    //
    // The owner ruling at the head of this file is untouched: "a clean corpus
    // draws three empty cards, not an empty screen". The card still draws. What
    // it no longer does is stay silent inside.
    if (rows.length === 0) {
      const zero = el('p', 'small');
      zero.append(...ctx.t('doc.zero'));
      pane.append(spaced(zero));
    }

    for (const repair of cardCommands(rows)) pane.append(commandRow(ctx, repair));
    root.append(pane);
  }
}
