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
 * holding the joined `title` — the response does carry one — and both the
 * mockup and the endpoint's own contract rule that out in the same words:
 * *"No join invents a column."* The title is left unread here rather than
 * silently promoted to a column the design of record does not draw; reported to
 * the owner as the loose end it is.
 *
 * **One row per DELIVERY, in the file's own order.** Nothing is sorted, grouped
 * or collapsed: a second delivery of an item is a second row, and an item the
 * corpus no longer holds keeps its row, because the injection still happened.
 */
import { el, errorNote, linkId, screenHead, spaced, tierChip } from '/screens/parts.js';

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

    // A cold session has no id, so there is no seen file to read and nothing to
    // ask about. The table is drawn with no rows rather than replaced by a
    // sentence: a brand-new session has received nothing, which is what an empty
    // table says, and the mockup declares no zero-data view for this screen for
    // a sentence to be transcribed from. Recorded as an open question.
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
      for (const line of data.lines) {
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
        tbody.append(row);
      }
    }

    const note = el('p', 'small');
    note.append(...ctx.t('inj.note'));
    card.append(table, spaced(note));
  }

  ctx.onSessionChange(() => { void show(); });
  await show();
}
