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
 * ── THE JOIN, PER TOPIC, AND WHAT MAY BE DRAWN AS A DEMONSTRATION ────────
 *
 * `/api/help/:topic` answers `{ topic, markdown, corpus }` with a different
 * `corpus` shape per topic, each documented on `apiHelp`. Only two of the four
 * carry item ids at all:
 *
 *   - `scope` → `corpus.scoped[…]` — every item that declares one, in
 *     `store.all()` order, which is `ORDER BY id`.
 *   - `capture` → `corpus.recent[…]` — the five most recent by FILE
 *     MODIFICATION TIME, the only recency signal that exists (`Item` carries
 *     no creation timestamp).
 *   - `categories` → `{ counts, empty }`. A tally and a list of category
 *     names. **No item id.** An id invented from a tally would be a claim
 *     about which item demonstrates "which are normative" that nothing in the
 *     response makes — `TASK-learn-the-categories-row-cannot-draw-the-cross-
 *     link-its-own` ruled that out by name.
 *   - `workflow` → `{ drafts, pendingRevisions }`. Two counts, no item id.
 *
 * **Carrying an id is not the same as demonstrating a topic, and taking the
 * first one was the defect** — `TASK-learn-cross-links-a-superseded-item-and-
 * a-closed-task-and`, found 2026-09-05 by reading the live DOM. `scope`
 * linked `DEC-focus-discloses-and-allows-rather-than-refusing-to-hide`, whose
 * own pane says `not injected (status "superseded")`: a decision that stopped
 * governing two days earlier, offered as the illustration of how scope works.
 * `capture` linked a TASK, closed as done within the hour. Neither ordering
 * above ranks how well an item TEACHES anything — `list[0]` was picking by
 * alphabet on one row and by `touch` on the other.
 *
 * **So the row picks, and the two facts it picks on are not in the help
 * response.** `corpus.scoped[…]` carries `{ id, title, scope }` and
 * `corpus.recent[…]` carries `{ id, title, mtime }` — no status, no category.
 * Both are read from the endpoints that own them, ONCE for the whole table
 * rather than once per row:
 *
 *   - `/api/items` — `ItemSummary.status` and `.type`, for every item.
 *   - `/api/config` — `resolved.categories[…].tier`. Which categories are
 *     normative is CONFIG, not a property of six names spelled out in a
 *     comment here: a project may declare a category with a tier, and a
 *     hand-copied list of "the normative ones" in this file would be a second
 *     authority free to drift from the first. Same argument
 *     `ItemsBody.retiredStatuses` makes for putting a closed set on the wire.
 *
 * `pickId()` is then the whole rule, walked over the join's own order:
 *
 *   1. an id this corpus does not hold is not drawn — nothing about it can be
 *      checked, and an unverifiable link is what this task removed;
 *   2. `status` must be `active`. Superseded, deprecated, validated and draft
 *      items are all excluded — the first half of the defect;
 *   3. a `task` is never drawn. A task is a piece of work, and a finished one
 *      demonstrates nothing about how the product is meant to be used — the
 *      second half;
 *   4. the NORMATIVE tier wins outright. A rule, constraint, invariant,
 *      instruction, requirement or standard says how something works, which is
 *      what these rows claim to illustrate; a rationale item says why a
 *      decision was taken. So the scan runs the WHOLE list looking for a
 *      normative candidate before it settles for a rationale one, rather than
 *      stopping at the first merely-admissible entry;
 *   5. and when nothing survives, the row draws the `◌` mark. Never blank.
 *
 * **Every one of the four rows therefore ends in exactly one of two states: a
 * named ACTIVE item, or the `◌` unmeasured mark.** `workflow` was the row
 * breaking that — no id, no mark, no text at all, a silent nothing a reader
 * cannot tell from a bug, which is precisely what
 * `INV-nothing-is-dropped-silently` exists to forbid. The mark is the ONE `◌`
 * primitive `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
 * governs, already spent by `coverage.js`, `doctor.js`, `watch.js` and
 * `injected.js` for exactly this fact (a thing that was not measured, never
 * rendered blank), reused here rather than a fifth convention. On the
 * `categories` row it is not "zero" — `counts` and `empty` are real, measured
 * numbers, drawn as `ln.c`'s description — it is that no SINGLE item was ever
 * going to answer "which one shows this is normative", so none is claimed.
 *
 * **The distinction this file used to draw between `categories` (marked) and
 * `workflow` (silent) did not survive contact with the screen.** The argument
 * on record was that `categories` had a promise to retract, because the mockup
 * once drew an invented id there, and `workflow` never made one. But the
 * promise is the SUBTITLE's — *"The four help topics, each linked to the items
 * in this corpus that demonstrate it"* — and a subtitle makes its promise for
 * every row under it. A row that answers it with nothing at all is the silent
 * drop, not a modest abstention.
 *
 * **The `capture` row's cross-link takes no label with it.** `apiHelp` warns
 * that `recent` is ordered by file modification time and that *"the label has
 * to carry that condition, and the mockup has no string for it"*. This row
 * therefore claims no recency: it shows one item from this corpus that was
 * captured into it, which is what `ln.p` (*"what to write down, and when"*) is
 * illustrated by. The mtime ordering decides which candidates are CONSIDERED,
 * deterministically, and is never stated on screen because there is no key to
 * state it with.
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

/**
 * The tier whose items say how something WORKS, which is what these rows
 * claim to illustrate. Compared against `/api/config`'s own answer for a
 * category, never against a list of category names kept here.
 */
const NORMATIVE = 'normative';

/**
 * The one category no row ever links to, whatever its tier.
 *
 * A task is a piece of work. `TASK-injection-preview-rung-4-of-the-gate-
 * ladder-can-never-be` was drawn on the `capture` row and closed as done
 * within the hour, so the screen was teaching "what to write down, and when"
 * from a finished piece of work. Every OTHER rationale category is admitted,
 * but only after the whole list has been searched for a normative one.
 */
const NEVER_LINKED = 'task';

/**
 * The two facts a cross-link is checked against, read once for the whole
 * table: `status` and `type` per item, and `tier` per category.
 *
 * Throws with the server's own sentence when either read fails or when
 * `/api/config` answers 200 with `resolved: null` — the shape it takes when
 * the file on disk does not load and the server is serving the last good
 * config. Unverifiable is not the same as absent: a row that cannot check an
 * id draws the reason (see `render()`), never the id and never the `◌` mark,
 * which would claim a measurement nobody made.
 */
async function selectionIndex(ctx) {
  const [itemsBody, configBody] = await Promise.all([
    ctx.api('/api/items'),
    ctx.api('/api/config'),
  ]);

  const items = new Map();
  const served = itemsBody === null || typeof itemsBody !== 'object' ? null : itemsBody.items;
  if (!Array.isArray(served)) throw new Error('/api/items served no items array');
  for (const item of served) {
    if (item !== null && typeof item === 'object' && typeof item.id === 'string') {
      items.set(item.id, item);
    }
  }

  const resolved = configBody === null || typeof configBody !== 'object' ? null : configBody.resolved;
  const categories = resolved === null || typeof resolved !== 'object' ? null : resolved.categories;
  if (!Array.isArray(categories)) {
    // `servingLastGood`: the loader's own sentence is the only thing that says
    // WHICH break this is, so it is what travels into the row.
    const why = (configBody && (configBody.parseError ?? configBody.resolveError)) ?? null;
    throw new Error(why === null
      ? '/api/config served no resolved categories, so no tier can be read'
      : why);
  }
  const tiers = new Map();
  for (const category of categories) {
    if (category !== null && typeof category === 'object' && typeof category.name === 'string') {
      tiers.set(category.name, category.tier);
    }
  }

  return { items, tiers };
}

/**
 * The id this topic's join demonstrates the topic with, or `null` where none
 * of its candidates does. The five numbered steps in this file's header are
 * this function, in order.
 *
 * The whole list is walked even after an admissible rationale candidate is
 * found, because the normative tier wins OUTRIGHT rather than by position:
 * `scoped` is `ORDER BY id` and `recent` is `mtime`, and stopping at the first
 * admissible entry would be picking by alphabet or by `touch` again — a
 * quieter version of the same defect.
 */
function pickId(corpus, field, index) {
  if (field === null || corpus === null || typeof corpus !== 'object') return null;
  const list = corpus[field];
  if (!Array.isArray(list) || list.length === 0) return null;

  let rationale = null;
  for (const entry of list) {
    const id = entry === null || typeof entry !== 'object' ? null : entry.id;
    if (typeof id !== 'string' || id === '') continue;
    const item = index.items.get(id);
    // An id `/api/items` does not carry cannot be checked for either fact, so
    // it is not drawn. `/api/items` is EVERY item — drafts, rationale-tier
    // items and disabled categories included — so this is a genuinely absent
    // item and not a filter disagreeing with the join.
    if (item === undefined) continue;
    if (item.status !== 'active') continue;
    if (item.type === NEVER_LINKED) continue;
    if (index.tiers.get(item.type) === NORMATIVE) return id;
    if (rationale === null) rationale = id;
  }
  return rationale;
}

/**
 * A row's honest reply to having no item to point at —
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`'s `◌`
 * primitive, already spent by `coverage.js`, `doctor.js`, `watch.js` and
 * `injected.js` for the same fact and reused here rather than a fifth
 * convention. Drawn on ANY of the four rows: the two whose join carries no id
 * at all, and either of the other two when nothing in its list survives
 * `pickId()`. See this file's header for why `workflow` no longer draws
 * nothing instead.
 */
function unmeasuredMark(ctx) {
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

  // ONE read of `status`, `type` and `tier` for the whole table, before the
  // loop, because every row asks the same two questions of the same two
  // endpoints. A per-row read would be up to eight requests to learn one fact
  // twice, and the two rows whose join carries no id would make them for
  // nothing.
  let index = null;
  let indexFailure = null;
  try {
    index = await selectionIndex(ctx);
  } catch (error) {
    indexFailure = error.message;
  }

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
    } else if (entry.link !== null && index === null) {
      // The shared read failed, so this row's candidates cannot be checked for
      // status or tier. It draws the reason — never an unchecked id, and never
      // the `◌` mark, which asserts that a search was RUN and found nothing.
      // The two rows whose join carries no ids at all are unaffected: their
      // answer never depended on this read.
      cell.append(errorNote(indexFailure));
    } else {
      const id = pickId(body.corpus, entry.link, index);
      // `linkId()`, which is `<button class="linkid m">` — the shape every
      // other cross-linked id in this app draws, reaching the same item
      // detail pane a click on any of them opens. See this file's header for
      // the measurement behind `.m` and for why this used to be a plain span.
      //
      // And the `else` is the whole of what walk/138 added: EVERY row ends in
      // one of these two states, an active named item or the honest mark. A
      // row that drew neither is the silent drop `INV-nothing-is-dropped-
      // silently` forbids, and `workflow` was drawing it.
      cell.append(' · ', id !== null ? linkId(id, false) : unmeasuredMark(ctx));
    }

    row.append(cell);
    tbody.append(row);
  }
}
