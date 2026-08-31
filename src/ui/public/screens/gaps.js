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
 *     NOT. It is not a fourth key — and the reason recorded here was wrong for
 *     three days. It said a sentence worded here "would be a string the design
 *     of record does not declare, which `strings-parity.test.ts` fails in the
 *     direction that names it";
 *     `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap` dropped
 *     that direction on 2026-08-26 and the gate's docstring says so.
 *     Re-measured 2026-08-30: a fourth key would pass. It is still not written,
 *     because nothing here is left unworded — `cov.k4` and `gaps.r2` are both
 *     declared, both translated and both on screen, so this disclosure already
 *     reads in Hebrew. A fourth key would be a BETTER sentence, which is
 *     product copy for the owner rather than a defect to fix. And it does not
 *     close
 *     `TASK-page-or-filter-api-coverage-and-disclose-any-truncation`
 *     (plan:ui1 seq:17e), which asks the ENDPOINT to carry HOW MANY paths were
 *     left out; this discloses the flag that is already served, and a flag is
 *     not a count.
 *   - **The empty-CATEGORY rows** — *"category `open_question` — empty"*
 *     (`gaps.cat` + `gaps.r3`). **DRAWN SINCE 2026-08-31, and the fix was the
 *     one word this file had been asking for.** `gaps.cat` was
 *     `category {m:open_question}` in English and `קטגוריה {m:open_question}` in
 *     Hebrew. An `{m:…}` run is a LITERAL — `strings/en.js`' own grammar block
 *     says so, and `strings-parity.test.ts` holds the two payloads identical
 *     for exactly that reason — so the key could name ONE category, the one the
 *     mockup's demo row happens to show, and there was no substitution for the
 *     others. It is `category {mv:name}` now, the value-slot form the tables
 *     already use for ids, paths and globs, and `/api/help/categories`'
 *     `corpus.empty` fills the rows.
 *
 *     **The blocker was a mockup edit and it stopped being one.** `{mv:name}`
 *     went into the grammar under `plan:rulings seq:12` and the tables were
 *     regenerated under `seq:15`; the mockup still writes the `{m:}` form and
 *     is HISTORY under
 *     `DEC-the-app-is-what-is-built-the-mockup-is-history-and-a-gap`, so it is
 *     not edited here. `strings-parity`'s surviving directions are unmoved: the
 *     two tables carry the same `{mv:name}` slot and the same (now empty)
 *     `{m:…}` list, and the mockup still declares the key.
 *
 *     **Measured 2026-08-23** by calling `apiHelp` directly: `corpus.empty`
 *     answers SIXTEEN categories over `.demo-corpus` and FIFTEEN over this
 *     project's own, `open_question` among them both — which is why drawing the
 *     one the literal could name and calling the table done was never an
 *     option.
 *
 *     **The bare name is still not drawn, and that was never the fallback.**
 *     `gaps.cat` keeps the word *category* around the slot: this table puts
 *     directories and categories in one `Where` column, and that word is the
 *     only thing telling them apart.
 *
 *     **A second request, and a refusal costs the category rows alone.**
 *     `/api/help/categories` is fetched beside `/api/coverage` rather than
 *     inside its `try`, so a coverage answer with a help refusal still draws
 *     every directory row and says what it lost, and the reverse holds too.
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
 * So `td.m`, `span.v` and `button.icon` sit in `e2e/screen-parity.spec.ts`'s
 * `gaps` entry as DATA, not as code. The loop below builds all three and has
 * since it was written; there is nothing on either corpus for it to build them
 * from. `test/ui/gaps-screen.test.ts` renders them from a body that *does* hold
 * a gap, which is the proof a ledger measured over one corpus cannot carry —
 * and it renders the empty body too, so the ledger entry itself is pinned in
 * Node rather than only in a browser.
 *
 * **`td`, `td.small` and `span.m` left that entry on 2026-08-31**, closed by
 * the empty-category rows: every corpus this gate runs over has empty
 * categories, so those three now draw on the fixture the ledger is measured
 * against. `span.m` closes at one remove — `{mv:name}` renders `span.m.v`, the
 * value form, where the mockup's frozen demo row writes a bare `span.m` around
 * a literal. That is the kind the mockup draws and the app does not, and it is
 * the only one left on this screen.
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

  // The empty CATEGORIES, from the endpoint that already answers them
  // (`read-model.ts` · `          empty: Object.values(ws.config.categories)` · ~2119).
  //
  // **Its own try, and its own refusal.** A help route that says no costs this
  // table its category rows and nothing else: the directory rows above are a
  // different question answered by a different endpoint, and losing them to
  // this one would drop rows that were served. The refusal is drawn under the
  // table rather than swallowed — an empty category list and a read that failed
  // are opposite facts, and a table that just got shorter would report the
  // first while the second is true.
  let empty = [];
  let helpRefusal = null;
  try {
    const help = await ctx.api('/api/help/categories');
    const served = help === null || typeof help !== 'object' ? null : help.corpus;
    // A 200 whose shape is not the contract is a refusal wearing a success
    // status. Said so, rather than drawn as a corpus with no empty category —
    // which is a real and different answer.
    if (served === null || typeof served !== 'object' || !Array.isArray(served.empty)) {
      helpRefusal = new Error('gaps: /api/help/categories answered 200 without corpus.empty — '
        + 'the empty-category rows below would be an absence drawn as a full corpus');
    } else {
      empty = served.empty;
    }
  } catch (error) {
    helpRefusal = error;
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

  // **The empty-CATEGORY rows, after the directories.** `gaps.cat` carries the
  // word *category* around the slot for the reason this file's header gives:
  // the `Where` column holds both kinds, and the word is the only thing that
  // tells them apart. The cell is a BARE `td`, which is what the mockup writes
  // for this row — the name is a value inside the sentence, not the cell.
  //
  // `Next` is an empty `<td>`, again the mockup's: there is no command to
  // compose for a category that holds nothing. A `Compose` button here would
  // offer a control with nothing behind it, which is worse than the blank the
  // design of record draws.
  for (const category of empty) {
    const row = el('tr');
    const where = el('td');
    // `{ name: category }` and not the shorthand: the slot-supply scanners in
    // `viewmodel.test.ts` and `proc-screen.test.ts` read the argument object as
    // TEXT and match `name:`, so a shorthand property is a slot they cannot see
    // supplied — and an unsupplied slot is what t() throws on.
    where.append(...ctx.t('gaps.cat', { name: category }));
    const what = el('td', 'small');
    what.append(...ctx.t('gaps.r3'));
    row.append(where, what, el('td'));
    tbody.append(row);
  }

  table.append(thead, tbody);
  card.append(table);

  // Named where the rows would have been, never left to a short table.
  if (helpRefusal !== null) card.append(errorNote(helpRefusal.message));

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
