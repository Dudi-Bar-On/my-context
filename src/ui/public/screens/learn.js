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
 * ── THE JOIN, PER TOPIC, AND THE ONE ROW THAT LOSES ITS CROSS-LINK ────────
 *
 * `/api/help/:topic` answers `{ topic, markdown, corpus }` with a different
 * `corpus` shape per topic, each documented on `apiHelp`. Only two of the four
 * carry an ITEM ID:
 *
 *   - `scope` → `corpus.scoped[…].id` — an item that declares one. Served.
 *   - `capture` → `corpus.recent[…].id` — served.
 *   - `categories` → `{ counts, empty }`. A tally and a list of category
 *     names. **No item id.** The mockup draws one on this row
 *     (`CONST-zero-runtime-dependencies`), and this screen cannot: an id
 *     invented from a tally would be a claim about which item demonstrates
 *     "which are normative" that nothing in the response makes. The row is
 *     drawn with its description and no cross-link, and the gap is this task's
 *     report rather than a guess.
 *   - `workflow` → `{ drafts, pendingRevisions }`. Two counts, no item id —
 *     and the mockup draws no cross-link on this row either, so the two agree.
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
      if (id !== null) cell.append(' · ', linkId(id, false));
      // No `else`: a topic whose join carries no item id shows its description
      // and stops. Drawing a placeholder there would say the corpus has
      // nothing to demonstrate it, which is a different claim from "this
      // endpoint does not carry one".
    }

    row.append(cell);
    tbody.append(row);
  }
}
