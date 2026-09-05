/**
 * `nav.read` — **Learn**, `<section data-p="learn">` in the design of record.
 * The four help topics, each joined to an item in THIS corpus.
 *
 * **The title is `Learn` (`ln.h`), not "Help"**, and the verdict is ⚠️: §4
 * passed this screen conditionally, and `ln.v` names the condition — *"the
 * corpus cross-links earn it"*. Without the join it is a documentation viewer
 * and should be cut.
 *
 * ── WHAT THE MOCKUP DRAWS, WHICH IS NOT WHAT THE PLAN SKETCHES ────────────
 *
 * `<section data-p="learn">` is ONE card holding a four-row table: the topic
 * name in monospace, then a small cell carrying the topic's one-line
 * description (`ln.c`, `ln.s`, `ln.p`, `ln.w`) and, on two of the four rows, a
 * monospace item id from this corpus.
 *
 * The plan's Step 3 sketch is a different screen entirely — a `<select>`, an
 * `<article>` of rendered markdown and an `<aside>` of corpus links — and it
 * cannot be built as written on four separate counts:
 *
 *   1. It names four keys no table declares (`learn.corpusLinks`,
 *      `learn.recentCaptures`, `coverage.emptyCategories`, plus
 *      `status.drafts`/`status.revisions`, whose real spellings are `st.*`).
 *      `t()` throws on a key it cannot find, so the screen would render
 *      nothing at all. The mockup declares none of them and the mockup wins.
 *   2. It assigns `doc.innerHTML = renderMarkdown(...)`, which destroys the
 *      `.m` spans carrying `unicode-bidi:isolate` — the standing rule this
 *      whole UI is written around.
 *   3. The markdown surface in the design of record is `<section
 *      data-p="docs">` (`dv.*`, `#mdout`), a screen this plan assigns to no
 *      nav group. Learn's own mockup contains no prose element of any kind.
 *   4. `dv.mdnote` rules the string form out where markdown IS drawn: *"no
 *      HTML string is ever produced, so there is nothing to sanitise."*
 *
 * So this file draws the table, and `renderMarkdown` is not written. See
 * `lib/viewmodel.js`'s header.
 *
 * ── THE JOIN, PER TOPIC, AND THE ONE ROW THAT HAS NO ITEM TO POINT AT ─────
 *
 * `/api/help/:topic` answers `{ topic, markdown, corpus }` with a different
 * `corpus` shape per topic, each documented on `apiHelp`. Only two of the four
 * carry an ITEM ID:
 *
 *   - `scope` → `corpus.scoped[…].id` — an item that declares one. Served.
 *   - `capture` → `corpus.recent[…].id` — served.
 *   - `categories` → `{ counts, empty }`. A tally and a list of category
 *     names. **No item id.** An id invented from a tally would be a claim
 *     about which item demonstrates "which are normative" that nothing in the
 *     response makes — `TASK-learn-the-categories-row-cannot-draw-the-cross-
 *     link-its-own` ruled that out by name. The mockup used to draw one here
 *     anyway (`CONST-zero-runtime-dependencies`, invented, not served) and
 *     that was the defect: a reader could not tell an illustrated join from a
 *     real one. **The row now says so instead of guessing** — the ONE `◌`
 *     primitive `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 *     governs, already spent by `coverage.js`, `doctor.js`, `watch.js` and
 *     `injected.js` for exactly this fact (a thing that was not measured,
 *     never rendered blank), reused here rather than a fourth convention. It
 *     is not "zero" — `counts` and `empty` are real, measured numbers, drawn
 *     as `ln.c`'s description — it is that no SINGLE item was ever going to
 *     answer "which one shows this is normative", so none is claimed.
 *   - `workflow` → `{ drafts, pendingRevisions }`. Two counts, no item id —
 *     and the mockup draws no cross-link and no `◌` note on this row either.
 *     The difference from `categories` is real: `workflow` never claimed a
 *     join and drawing an explicit "unmeasured" mark over a row nobody ever
 *     promised one on would be inventing a *different* claim nothing asked
 *     for. `categories` gets the mark because the mockup used to draw a join
 *     there and that promise needed an honest retraction, not a silent one.
 *
 * **The `capture` row gains a cross-link the mockup does not draw, and takes
 * no label with it.** `apiHelp` warns that `recent` is ordered by FILE
 * MODIFICATION TIME — the only recency signal that exists, since `Item` has no
 * creation timestamp — and that *"the label has to carry that condition, and
 * the mockup has no string for it"*. This row therefore claims no recency: it
 * shows one item from this corpus that was captured into it, which is what
 * `ln.p` (*"what to write down, and when"*) is illustrated by. The mtime
 * ordering decides WHICH one deterministically and is never stated on screen,
 * because there is no key to state it with.
 *
 * **One id per row, because the mockup has room for one.** `scoped` and
 * `recent` are lists; the design of record shows a single id after a `·`. A
 * "+N more" affordance would need a key that does not exist.
 *
 * **`markdown` is fetched and not drawn.** It is the largest field in each of
 * the four responses and the design of record's Learn screen has nowhere to
 * put it — reported, not repurposed.
 *
 * ── HOW A VALUE IS MARKED AS MACHINE TEXT, AND WHY THE ID IS A BUTTON ─────
 *
 * This section marks a value as machine text in exactly two shapes, and this
 * file draws both of them:
 *
 *   - the TOPIC NAME, `<td class="m">categories</td>` — the cell itself
 *     carries the mark, four times;
 *   - the CROSS-LINKED ID, `<button class="linkid m" data-id="…">…</button>`
 *     — `linkId()`, twice.
 *
 * **`.m` is `direction:ltr; unicode-bidi:isolate`, not a font choice — and
 * what it buys here was MEASURED, not assumed.** Rendered into the Hebrew
 * (`dir="rtl"`) page against the shipped stylesheet, a value whose first and
 * last characters are both strong left-to-right reads the same way marked or
 * unmarked: `INV-prices-are-integer-cents` and
 * `CONST-postgres-pool-capped-at-20` do not reorder at all, and dropping the
 * mark changes only the font. A value whose first or last character is a
 * NEUTRAL does reorder — `src/**`, `(2 pinned)` and an id with a leading
 * hyphen each read right-to-left unmarked and left-to-right marked, the run
 * jumping to the far side of the sentence.
 *
 * So the mark is neither decoration nor a live defect on today's two ids. It
 * is what makes the rendering a property of the CODE rather than of which
 * items this corpus happens to hold: `firstId()` hands this cell whatever
 * `/api/help/:topic` carries, and the day that is a slug with a neutral at
 * either end, an unmarked run breaks the sentence around it. Every
 * machine-text run is therefore marked where it is DRAWN, not where somebody
 * looked at it once and it happened to be fine.
 *
 * **The id is now a `button.linkid.m`, the shape every other cross-linked id
 * in the app draws — this screen no longer carries the one exception.** It
 * used to be a plain `span.m`, and the reason on record was current when it
 * was written and then stopped being true without anyone coming back to
 * update it: *"the item detail pane `parts.js`' `linkId()` delegates to has
 * not been built … every `linkId` in this app is inert."* **It shipped 2.5
 * hours later, the same day** (`aa34358`, 2026-08-23 — `index.html` gained
 * `aside#pane`, `app.js` wired the delegated click). The comment above
 * outlived the gap it described by more than two weeks before anyone
 * noticed: `ask` already drew its ids as buttons for exactly this pane;
 * `coverage`, `doctor`, `injected`, `preview` and `watch` do too; **Learn's
 * two ids were the only inert ones left in the product.** `linkId(id, false)`
 * — unsplit, matching the plain run every OTHER table-row id in the mockup
 * draws (`docs/design/web-ui-mockup.html`'s audit and doctor tables), rather
 * than the `idkind`/`idslug` split the mockup's carried-item card uses. Click
 * one and `aside#pane` opens on it, the same as everywhere else.
 */
import { el, errorNote, linkId, screenHead } from '/screens/parts.js';

/**
 * The four topics in the mockup's own order, each with the description key it
 * draws beside it. The topic NAMES are literals, not translated strings: they
 * are `UI_HELP_TOPICS`' own values, they are what `mycontext help <topic>`
 * takes on the command line, and the mockup draws them in `.m` for exactly
 * that reason.
 *
 * `link` names the field in this topic's `corpus` join that carries item ids,
 * or `null` where the join carries none. It is a data table rather than four
 * branches so that "which topics have no cross-link" is one thing to read.
 */
const TOPICS = [
  { topic: 'categories', key: 'ln.c', link: null },
  { topic: 'scope', key: 'ln.s', link: 'scoped' },
  { topic: 'capture', key: 'ln.p', link: 'recent' },
  { topic: 'workflow', key: 'ln.w', link: null },
];

/** The first id in a topic's list join, or `null` for an empty corpus. */
function firstId(corpus, field) {
  if (field === null || corpus === null || typeof corpus !== 'object') return null;
  const list = corpus[field];
  if (!Array.isArray(list) || list.length === 0) return null;
  const id = list[0].id;
  return typeof id === 'string' && id !== '' ? id : null;
}

/**
 * The `categories` row's honest reply to having no item to point at —
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`'s `◌`
 * primitive, already spent by `coverage.js`, `doctor.js`, `watch.js` and
 * `injected.js` for the same fact and reused here rather than a fourth
 * convention. See this file's header for why `categories` gets this mark and
 * `workflow` — the other topic with no item id — does not.
 */
function categoriesUnmeasured(ctx) {
  const chip = el('span', 'chip unmeas');
  chip.dataset.g = '◌';
  chip.append(...ctx.t('ln.cUnmeasured'));
  return chip;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'ln.h', 'ln.v', 'ln.sub', '⚠️');

  const card = el('div', 'card pane');
  const table = el('table');
  const tbody = el('tbody');
  table.append(tbody);
  card.append(table);
  root.append(card);

  for (const entry of TOPICS) {
    const row = el('tr');
    row.append(el('td', 'm', entry.topic));

    const cell = el('td', 'small');
    cell.append(...ctx.t(entry.key));

    let body = null;
    let failure = null;
    try {
      body = await ctx.api(`/api/help/${encodeURIComponent(entry.topic)}`);
    } catch (error) {
      failure = error.message;
    }

    if (failure !== null) {
      // Per ROW, because the failure is per topic: `/api/help/:topic` answers
      // a 404 that names which of the two things went wrong (an unknown topic,
      // or a real `mycontext help` topic this screen does not join), and that
      // sentence is worth more than a blank cell. It replaces this row's
      // cross-link, never the whole table — the other three topics answered.
      cell.append(errorNote(failure));
    } else {
      const id = firstId(body.corpus, entry.link);
      // `linkId()`, which is `<button class="linkid m">` — the shape every
      // other cross-linked id in this app draws, reaching the same item
      // detail pane a click on any of them opens. See this file's header for
      // the measurement behind `.m` and for why this used to be a plain span.
      if (id !== null) {
        cell.append(' · ', linkId(id, false));
      } else if (entry.topic === 'categories') {
        // The one row that once drew an invented id and now draws the honest
        // fact instead: no single item was ever going to answer this.
        cell.append(' · ', categoriesUnmeasured(ctx));
      }
      // No further `else`: `workflow` is the other topic whose join carries no
      // item id, and it never claimed one — drawing a mark there would invent
      // a different claim nothing asked for. See this file's header.
    }

    row.append(cell);
    tbody.append(row);
  }
}
