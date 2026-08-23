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
 * **WHAT THIS SCREEN DOES NOT DRAW, WHY IT DRAWS NO WEAKER ROW IN ITS PLACE,
 * AND WHAT IT SAYS INSTEAD.** The mockup's table has three row shapes and one
 * of them is served:
 *
 *   - **The *not examined* row** — *"`vendor/` — not examined — past the file
 *     limit"* (`cov.k4` + `gaps.r2`). It names a PATH, and no endpoint carries
 *     one: `/api/coverage` answers a single global `truncated` boolean, and the
 *     read model records the ask in its own words
 *     (`ui/read-model.ts` · `needs the paths `listRepoFiles` did not reach` · ~1074).
 *     A row that said "not examined" with no `Where` would be the third state
 *     folded into nothing, which is precisely what `gaps.note` forbids.
 *     **Needs: the paths `listRepoFiles` did not reach.**
 *
 *     **What IS served is the boolean, and this screen now says it** — as a
 *     `p.small` under the table rather than as a row, which is the treatment
 *     `screens/coverage.js` already gives the identical fact with the
 *     identical two keys
 *     (`screens/coverage.js` · `The walk stopped short, and that is disclosed rather than left to be` · ~290).
 *     Dropping it was an `INV-nothing-is-dropped-silently` failure in the one
 *     place it costs most: a gaps table computed from a truncated walk names
 *     fewer directories than the repository has, and a reader who is not told
 *     reads the short list as the whole answer. Two things it deliberately is
 *     NOT. It is not a fourth key — a sentence worded here would be a string
 *     the design of record does not declare, which `strings-parity.test.ts`
 *     fails in the direction that names it. And it does not close
 *     `TASK-page-or-filter-api-coverage-and-disclose-any-truncation`
 *     (plan:ui1 seq:17e), which asks the ENDPOINT to carry HOW MANY paths were
 *     left out; this discloses the flag that is already served, and a flag is
 *     not a count.
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
 *     **Re-measured 2026-08-23**, by calling `apiHelp` directly: `corpus.empty`
 *     answers SIXTEEN categories over `.demo-corpus` and FIFTEEN over this
 *     project's own, `open_question` among them both. So the shape the string
 *     can name is one row, and the shape it cannot is fifteen — which is the
 *     whole argument against drawing the one and calling the table done.
 *
 * **THE ROW SHAPE THAT *IS* SERVED STILL DRAWS NOTHING HERE, AND THAT IS THE
 * CORPUS RATHER THAN THE CODE.** Measured the same day by calling `apiCoverage`
 * directly over both corpora. `.demo-corpus` — the one `e2e/app.ts` serves the
 * parity gate, and therefore the one every entry in its ledger is measured
 * against — contains `.my_context` and *no repository files at all*, so
 * `/api/coverage` answers `files: []`, `buildTree` builds an empty root and
 * `coverageGapRows` returns none. This project's own corpus walks 872 files and
 * also returns none, for the opposite reason: enough of its 344 items are
 * unscoped under a `global`/`required` policy that every path is governed, and
 * `coverageGaps` only names a directory whose `governedCount` is zero.
 *
 * So `td.m`, `td.small`, `td`, `span.v` and `button.icon` sit in
 * `e2e/screen-parity.spec.ts`'s `gaps` entry as DATA, not as code. The loop
 * below builds all five and has since it was written; there is nothing on
 * either corpus for it to build them from. `test/ui/gaps-screen.test.ts`
 * renders them from a body that *does* hold a gap, which is the proof a ledger
 * measured over one corpus cannot carry — and it renders the empty body too, so
 * the ledger entry itself is pinned in Node rather than only in a browser.
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
  card.append(table);

  // The walk stopped short, and the table says so rather than leaving it to be
  // inferred from a short list of directories. `truncated` is the ONE fact
  // `/api/coverage` carries about the third state, and reading `data.files`
  // without it is `INV-nothing-is-dropped-silently` failing: the rows above are
  // then a gap list over PART of the repository presented as a gap list over
  // the repository.
  //
  // The keys, and their joining, are `screens/coverage.js`' verbatim rather
  // than a second spelling invented here — `<b>` + `cov.k4`, an em dash, then
  // `gaps.r2` — which is itself the mockup's own pairing for this fact, read
  // out of the row this screen cannot build
  // (`docs/design/web-ui-mockup.html` · `<b data-t="cov.k4">not examined</b> — <span data-t="gaps.r2">past the file limit</span>` · ~1527).
  // No path is named, because none is served; no third key is invented,
  // because the design of record declares none.
  //
  // **A `p` under the table and not a `tr` inside it.** `gaps.note` is the rule
  // — *"a third state, never folded into 'gap'"* — and every row of this table
  // is a gap. A `<tr>` whose `Where` cell was empty would put the third state
  // in the gap list and say nothing about where it applies, which is both
  // halves of what that note forbids.
  if (data.truncated) {
    const stopped = el('p', 'small');
    const what = el('b');
    what.append(...ctx.t('cov.k4'));
    const why = el('span');
    why.append(...ctx.t('gaps.r2'));
    stopped.append(what, ' — ', why);
    card.append(spaced(stopped));
  }

  const note = el('p', 'small');
  note.append(...ctx.t('gaps.note'));
  card.append(spaced(note));
}
