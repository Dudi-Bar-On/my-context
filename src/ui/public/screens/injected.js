/**
 * `nav.inj` — **Injected now**, `<section data-p="injected">` in the design of
 * record. Live state for the selected session, from the SEEN FILE.
 *
 * Not a hypothetical, and **not `Ledger.seen`** — the screen says its own source
 * twice, in `inj.sub` and again in `inj.note`, because the Ledger's copy is a
 * replayed projection nothing here updates and it would show a different
 * number. `/api/session/:session/injected` reads the file; this screen draws
 * what it read and joins nothing.
 *
 * **Three columns, and no fourth.** `th.item` / `th.tier` / `th.when`, each
 * straight off a `SeenLine`. The plan's Step 3 sketch appends a fourth cell
 * holding a joined `title`, and both the mockup and the endpoint's own contract
 * rule that out in the same words: *"No join invents a column."* That is still
 * the design fact, and it is why the fourth cell was never drawn.
 *
 * **The join itself is now GONE, and the loose end with it.** The response used
 * to carry the `title` anyway — joined per line out of the corpus — and this
 * screen left it unread rather than promote it into a column the design of
 * record does not have. It was reported to the owner as the loose end it was,
 * and on 2026-08-26 the owner ruled it CUT (plan:ui1 seq:17f): a repo-wide
 * search found ZERO readers of the field in `src/ui/public/`, `src/mcp/` and
 * `src/cli/`, and serving it cost a full `SELECT` plus a `JSON.parse` of every
 * item's whole JSON blob on every request. `src/ui/read-model.ts` ·
 * `export type InjectedLine = SeenLine;` · ~566 holds the removal. So the rule
 * above no longer has anything to refuse: a line of this response IS the three
 * columns, and there is nothing left to leave unread.
 *
 * **One row per DELIVERY, in the file's own order.** Nothing is sorted, grouped
 * or collapsed: a second delivery of an item is a second row, and an item the
 * corpus no longer holds keeps its row, because the injection still happened.
 */
import {
  BOUND_CAP_TABLE, boundedList, el, errorNote, linkId, screenHead, spaced, tierChip,
} from '/screens/parts.js';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'inj.h', 'inj.v', 'inj.sub');

  const card = el('div', 'card pane');
  root.append(card);

  async function show() {
    card.replaceChildren();
    const session = ctx.session();

    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    for (const key of ['th.item', 'th.tier', 'th.when']) {
      const th = el('th');
      th.append(...ctx.t(key));
      headRow.append(th);
    }
    thead.append(headRow);
    const tbody = el('tbody');
    table.append(thead, tbody);
    // Null for a cold session: there is no seen file, so there is no list to
    // bound and nothing truthful a bound line could say about one.
    let bound = null;
    // Which of the three states this render is in — see the note below. `null`
    // until the fetch settles, so the cold path falls through with it unset.
    let zeroKey = 'inj.noSession';

    // **THREE STATES, AND UNTIL 2026-08-26 TWO OF THEM WERE THE SAME PIXELS.**
    //
    // This screen can be in one of three conditions, and the older comment here
    // conflated the first two — both rendered as a bare table head, which is
    // the blank `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
    // forbids outright:
    //
    //   NOT MEASURED   no session is selected, so no seen file was read. The
    //                  screen knows nothing about what was injected.
    //   MEASURED ZERO  a seen file was read and holds no lines. This session
    //                  exists and has received nothing yet.
    //   REFUSED        the read failed, and the seen file's own words are
    //                  passed on below — already handled, and unchanged.
    //
    // The first two are DIFFERENT FACTS about the world and a reader who cannot
    // tell them apart cannot tell "nothing has happened" from "I am not looking
    // at anything". The keys say which is which; `inj.noSession` names the
    // distinction out loud rather than leaving it to be inferred.
    //
    // The old comment closed with "the mockup declares no zero-data view for
    // this screen for a sentence to be transcribed from. Recorded as an open
    // question." That was true under the 1:1 rule and is not a reason any more:
    // `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`.
    if (session !== null && session !== 'cold') {
      let data;
      try {
        data = await ctx.api(`/api/session/${encodeURIComponent(session)}/injected`);
      } catch (error) {
        card.append(errorNote(error.message));
        return;
      }
      // A read error is DISCLOSED BEFORE the rows, never rendered as "nothing
      // was injected" — an unreadable seen file and an empty one are two facts,
      // and this is the only surface that passes that string on. It is the seen
      // file's own words, not a paraphrase: the mockup declares no key for this
      // state on any screen, and inventing one would fail the tables' parity
      // with the design of record.
      if (data.error !== null && data.error !== undefined) {
        card.append(errorNote(data.error));
      }
      // **A record, so it bounds by TIME** — every line carries `at`, which is
      // the When column beside it. `take: 'last'` because the seen file is an
      // APPEND log: its most recent lines are at the end, and slicing the head
      // would show the oldest under a sentence promising the newest. The
      // survivors keep the file's own order, so only the table's membership
      // changes and never its direction — which is what the header above means
      // by "one row per DELIVERY, in the file's own order".
      bound = boundedList(ctx, tbody, data.lines, (line) => {
        const row = el('tr');
        const item = el('td');
        // The FULL id as text, the way the mockup draws it in this table —
        // the split `.idkind`/`.idslug` treatment belongs to the preview's
        // rows, and this column is narrow enough that the id is the label.
        item.append(linkId(line.id, false));
        const tier = el('td');
        tier.append(tierChip(line.tier));
        const when = el('td', 'm small', line.at);
        row.append(item, tier, when);
        return row;
      }, { cap: BOUND_CAP_TABLE, order: 'recent', take: 'last' });
      // A seen file that WAS read and holds nothing. Distinct from the cold
      // case above it — and silent when the read REFUSED, because `errorNote`
      // has already said so in the seen file's own words and two explanations
      // of one absence is worse than none. An unreadable seen file is not a
      // zero, and must never be drawn as one.
      const refused = data.error !== null && data.error !== undefined;
      zeroKey = !refused && data.lines.length === 0 ? 'inj.zeroLines' : null;
    }

    const note = el('p', 'small');
    note.append(...ctx.t('inj.note'));
    // The bound line cannot live inside the `<table>` — a `<div>` is not a row
    // — so it sits between the table and the note, still directly under the
    // last row a reader sees.
    card.append(table);
    if (bound !== null) card.append(bound);
    // Under the table, where a reader reaches the end of it and finds no rows.
    // Never beside a refusal: `errorNote` was appended before the table and
    // carries the seen file's own words, and two explanations of one absence
    // is worse than none.
    if (zeroKey !== null) {
      const zero = el('p', 'small');
      zero.append(...ctx.t(zeroKey));
      card.append(spaced(zero));
    }
    card.append(spaced(note));
  }

  ctx.onSessionChange(() => { void show(); });
  await show();
}
