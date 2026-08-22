/**
 * `nav.ev` — **Status**, `<section data-p="status">` in the design of record.
 * §4's recorded EXCEPTION: a table, kept as a table, claiming nothing more.
 *
 * **Not the landing screen.** `st.sub` says so in the mockup's own words —
 * *"Not the landing screen, and no longer justified by being one. It is where
 * the header's corpus counts lead."* The shell already routes `#/` to the
 * injection preview (`app.js`'s `route()`), so nothing here has to argue it.
 *
 * **Its verdict is ⚠️, not ✅**, and it is the only screen in `nav.ev` that is.
 * A table is what the spec accepts here rather than what it wants, and the
 * warning glyph is that concession drawn. See `screenHead` for why this is
 * still an emoji and not a `.chip`.
 *
 * ── FIVE ROWS, THREE OF WHICH THIS SERVER CAN COUNT ───────────────────────
 *
 * The mockup draws five, and `st.four` explains why they share one table:
 * *"There are four unfinished-work queues, not one."* `/api/status` answers
 * the first three — `items.total`, `reviewQueue.drafts` and
 * `pendingRevisions.revisions`. It does not answer `st.staged` (staged
 * lessons) or `st.ingest` (unfinished ingests), and **that is a boundary
 * ruling rather than a missing field**: the two counts come from `listStaging`
 * (`lesson/derive.ts`) and `listSessions` + `pendingAnchors`
 * (`ingest/session.ts`), and `lesson/derive.ts` imports `createItem` from
 * `core/mutate.ts` — so serving them would put the mutation surface into this
 * server's runtime import graph for the first time and turn
 * `test/ui/no-writes.test.ts` red. The endpoint reported that rather than
 * doing it (`ui/read-model.ts` · `Two rows the mockup's status screen draws and this body cannot fill.` · ~672).
 *
 * **So both rows are DRAWN, with an em dash where the number would be.** Three
 * of five rows would delete two of the four queues from a screen whose only
 * sentence is that there are four of them — and would delete them silently,
 * which is the failure this project names `INV-nothing-is-dropped-silently`.
 * The em dash is the design of record's own mark for "no value here" (it draws
 * one for the doctor finding that names no item), so the row stays, the label
 * stays, and no number is asserted that nobody measured. What the em dash
 * cannot say is WHY — no string table declares a key for it — and that is this
 * task's loudest open question.
 *
 * **What is NOT drawn, though it is served.** `version`, `profile`,
 * `items.byCategory`/`byStatus`/`byOrigin`, `reviewQueue.always`,
 * `reviewQueue.globalLayerDrafts` and the `health` tally all arrive in this
 * response and appear nowhere in `<section data-p="status">`. The plan's Step
 * 3 sketch draws three of them as extra `<table>`s and a `mycontext <version>`
 * line; the mockup draws none, and the mockup is the specification. Left
 * unread rather than promoted into columns the design of record does not
 * have — the same call `injected.js` made about its joined titles.
 *
 * **Counts sit on glass, not on a plate, and that is deliberate.**
 * `test/ui/plate-usage.test.ts` names the eighteen graphical views the plate
 * rule covers and excludes this table by name: *"Static reference tables with
 * no computed quantity … status's counts … are also outside this eighteen"*.
 * Decay's two charts are inside it (`#comb`, `#heat`); these five numbers are
 * not, because nothing here is a mark whose position or size carries meaning.
 */
import { el, errorNote, num, screenHead, spaced } from '/screens/parts.js';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'st.h', 'st.v', 'st.sub', '⚠️');

  const card = el('div', 'card pane');
  root.append(card);

  let status;
  try {
    status = await ctx.api('/api/status');
  } catch (error) {
    // Instead of the table, never beside an empty one: a corpus of zero items
    // and a status read that failed are two facts, and five em dashes would
    // report neither.
    card.append(errorNote(error.message));
    return;
  }

  // `null` is "this server does not carry the number", NOT zero. The two rows
  // that hold it are the two above; every other row is a real count, and a
  // real count of zero renders as `0`.
  const rows = [
    ['st.items', status.items.total],
    ['st.drafts', status.reviewQueue.drafts],
    ['st.pending', status.pendingRevisions.revisions],
    ['st.staged', null],
    ['st.ingest', null],
  ];

  const table = el('table');
  const tbody = el('tbody');
  for (const [key, value] of rows) {
    const row = el('tr');
    const label = el('td');
    label.append(...ctx.t(key));
    // `.m` is the mockup's monospace, direction-known run — a count is data,
    // not prose, and reads left-to-right inside a right-to-left page. `num`
    // is the mockup's own `en-US` grouping, for the same reason it gives:
    // a number that changes its separators with the UI language is a second
    // thing to reconcile for no reader's benefit.
    row.append(label, value === null ? el('td', 'small', '—') : el('td', 'm', num(value)));
    tbody.append(row);
  }
  table.append(tbody);

  const note = el('p', 'small');
  note.append(...ctx.t('st.four'));
  card.append(table, spaced(note));
}
