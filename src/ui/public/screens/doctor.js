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
 * **The repair command is composed and never run** (spec §4). Which codes get
 * one, and why most do not, is `repairCommandFor`'s docstring — established by
 * reading `src/doctor/checks.ts`'s messages and then the usage banner of every
 * command those messages name. One `.cmd` row per DISTINCT command per card,
 * in the order the rows above it first asked for one, because the mockup draws
 * the commands under the table rather than inside it and two rows sharing a
 * code share a command.
 *
 * **A clean corpus draws three empty cards, not an empty screen.** Owner
 * ruling: empty renders the real markup with zero rows. A refusal is the other
 * case, and is drawn INSTEAD of the data, in the endpoint's own words.
 */
import { groupFindings, repairCommandFor } from '/lib/viewmodel.js';
import { el, errorNote, linkId, screenHead } from '/screens/parts.js';

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
 * `<div class="cmd"><code>…</code><button>Copy</button></div>` — the mockup's
 * compose-and-copy row.
 *
 * **A copy that fails says so, and says it in the platform's own words.** The
 * mockup's handler swaps the button's label to "Copied"/"Copy failed" through
 * a `HEB ? … : …` ternary in script — unkeyed, so neither string table can
 * carry it and the parity check cannot see it, which is precisely the defect
 * the mockup records having fixed elsewhere in itself. Inventing the two keys
 * here would fail that parity check; staying silent on failure would drop a
 * failure silently. So the success path is silent and the failure path renders
 * the DOMException's own message, the treatment `errorNote` already gives an
 * endpoint refusal. Recorded as an open question: this button owes the mockup
 * two keys.
 */
function commandRow(ctx, command) {
  const box = el('div', 'cmd');
  const code = el('code', null, command);
  const copy = el('button');
  copy.type = 'button';
  copy.append(...ctx.t('btn.copy'));
  copy.onclick = () => {
    // Composed, never run: this hands the string to the clipboard and stops.
    // The user's own shell is the only thing that ever executes it, which is
    // what keeps their Bash permission rules matching command strings (§7).
    navigator.clipboard.writeText(command).catch((error) => {
      box.after(errorNote(error && error.message ? error.message : String(error)));
    });
  };
  box.append(code, copy);
  return box;
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
    const commands = [];

    for (const [code, findings] of groups) {
      for (const finding of findings) {
        if (finding.level !== card.level) continue;
        const row = el('tr');
        row.append(el('td', 'm', code));

        // `item` is OPTIONAL on a Finding and its absence is real —
        // `watched_docs_no_match` and `audit_log_size` name none. The mockup
        // draws an em dash for exactly that row, which is this design's own
        // mark for "no value here"; an empty cell would read as a bug.
        const named = typeof finding.item === 'string' && finding.item !== '';
        const who = named ? el('td') : el('td', 'small', '—');
        if (named) who.append(linkId(finding.item, false));

        row.append(who, el('td', 'small', finding.message));
        tbody.append(row);

        const repair = repairCommandFor(code, named ? finding.item : null);
        if (repair !== null && !commands.includes(repair)) commands.push(repair);
      }
    }

    table.append(tbody);
    pane.append(heading, table);
    for (const command of commands) pane.append(commandRow(ctx, command));
    root.append(pane);
  }
}
