/**
 * `nav.inj` — **Coverage gaps**, `<section data-p="gaps">` in the design of
 * record. A screen of its own, not a panel on the coverage map.
 *
 * The plan's Step 3 folds this into `coverage.js` as two trailing paragraphs on
 * two keys no table declares (`coverage.gapDirs`, `coverage.emptyCategories`).
 * The mockup gives it its own `<section>`, its own rail entry (`s.gaps`) and its
 * own three-column table — *Where / What / Next* (`th.where`, `th.what`,
 * `th.act`) — and folding it back in would drop a screen the design of record
 * shows.
 *
 * **Its subject is a NEGATIVE, which is why it cannot be a listing** (`gaps.v`:
 * *"names what is missing, which no listing can"*). The rows come from the same
 * `/api/coverage` answer the tree is built from, through `coverageGapRows`
 * (`lib/viewmodel.js`) — the shallowest directory nothing scopes, once, not its
 * whole subtree.
 *
 * **WHAT THIS SCREEN DOES NOT DRAW, AND WHY IT DRAWS NOTHING WEAKER IN ITS
 * PLACE.** The mockup's table has three row shapes and one of them is served:
 *
 *   - **The *not examined* row** — *"`vendor/` — not examined — past the file
 *     limit"* (`cov.k4` + `gaps.r2`). It names a PATH, and no endpoint carries
 *     one: `/api/coverage` answers a single global `truncated` boolean, and the
 *     read model records the ask in its own words
 *     (`ui/read-model.ts` · `needs the paths `listRepoFiles` did not reach` · ~1074).
 *     A row that said "not examined" with no `Where` would be the third state
 *     folded into nothing, which is precisely what `gaps.note` forbids.
 *     **Needs: the paths `listRepoFiles` did not reach.**
 *   - **The empty-CATEGORY rows** — *"category `open_question` — empty"*
 *     (`gaps.cat` + `gaps.r3`). **The data is served** and this screen fetches
 *     nothing for it, because the STRING cannot carry it: `gaps.cat` is
 *     `category {m:open_question}` in English and `קטגוריה {m:open_question}` in
 *     Hebrew, and an `{m:…}` run is a LITERAL — `strings/en.js`' own grammar
 *     block says so, and `strings-parity.test.ts` holds the two payloads
 *     identical for exactly that reason. So the key can name one category, the
 *     one the mockup's demo row happens to show, and there is no substitution
 *     for the others. Drawing the name alone in the `Where` cell would lose the
 *     word that tells a category apart from a directory, which is the whole
 *     content of that cell. **Needs one word changed in the design of record:
 *     `gaps.cat` written as `category {mv:name}`** — the value-slot form the
 *     tables already use for ids, paths and globs — after which
 *     `/api/help/categories`' `corpus.empty` fills it with no further work.
 *     Raised with a screenshot in this task's report; not worked around here.
 *
 * The `Next` button is drawn and does nothing, exactly as the mockup's own is:
 * it has no handler there either, and the screen it must lead to — the Composer
 * (`s.palette`, `nav.ch`) — is built by plan 2 and not registered yet. That is
 * the same treatment `index.html` gives `#focusbtn`: "the trigger renders inert
 * until it does". Composing the command here instead would break the one rule
 * `lib/command.js` states about itself — the composed string is always SHOWN
 * before it is copied — and this table has nowhere to show one.
 */
import { buildTree, coverageGapRows } from '/lib/viewmodel.js';
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'gaps.h', 'gaps.v', 'gaps.sub');

  const card = el('div', 'card pane');
  root.append(card);

  let data;
  try {
    data = await ctx.api('/api/coverage');
  } catch (error) {
    card.append(errorNote(error.message));
    return;
  }

  const table = el('table');
  const thead = el('thead');
  const headRow = el('tr');
  for (const key of ['th.where', 'th.what', 'th.act']) {
    const th = el('th');
    th.append(...ctx.t(key));
    headRow.append(th);
  }
  thead.append(headRow);
  const tbody = el('tbody');

  // No rows is the real answer to a fully scoped repository, and it is drawn as
  // the real markup with nothing in it — never as a sentence congratulating the
  // reader, which this screen has no key for and no business inventing.
  for (const gap of coverageGapRows(buildTree(data.files))) {
    const row = el('tr');
    // `.m` on the cell rather than a nested span, the way the mockup writes it:
    // `<td class="m">src/workers/</td>`. The trailing slash is the mockup's too
    // — a `Where` is a directory, and it says so before it is read.
    const where = el('td', 'm', `${gap.path}/`);
    const what = el('td', 'small');
    what.append(...ctx.t('gaps.r1', { files: gap.files }));
    const next = el('td');
    const compose = el('button', 'icon');
    compose.type = 'button';
    // The mockup's `style="inline-size:auto"`, through CSSOM — CSP forbids the
    // attribute, and the property is logical either way.
    compose.style.setProperty('inline-size', 'auto');
    compose.append(...ctx.t('btn.compose'));
    next.append(compose);
    row.append(where, what, next);
    tbody.append(row);
  }

  table.append(thead, tbody);
  const note = el('p', 'small');
  note.append(...ctx.t('gaps.note'));
  card.append(table, spaced(note));
}
