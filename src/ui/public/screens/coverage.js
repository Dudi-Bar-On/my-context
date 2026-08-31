/**
 * `nav.inj` — **Scope coverage**, `<section data-p="coverage">` in the design of
 * record. Every walked path, coloured by what governs it, with the detail pane
 * beside the tree.
 *
 * **Built from the mockup's markup and its own `renderTree`/`renderDet`, not
 * from the plan's Step 3 sketch.** That sketch names six string keys —
 * `coverage.truncated`, `coverage.print`, `coverage.governs`,
 * `coverage.wouldInject`, `coverage.gapDirs`, `coverage.emptyCategories` — and
 * **no string table declares one of them**, because both tables are transcribed
 * key-for-key from the design of record and it declares none either. `t()`
 * throws on a key it cannot find, so that sketch cannot render a line. It also
 * folds the gaps into this screen as two trailing paragraphs; the mockup gives
 * them their own `<section data-p="gaps">`, their own rail entry and their own
 * three-column table, and `screens/gaps.js` is that screen.
 *
 * **The tree and the detail are DATA, so each sits on `.plate` inside the
 * `.pane` its card already is** (repaint Task 7, spec §4: *"Text may float on
 * glass. Data may not."*). The mockup already marks both that way —
 * `<div class="tree plate" id="tree">` and `<div class="plate" id="det">` — and
 * `test/ui/plate-usage.test.ts` names `#tree` and `#det` among the eighteen, so
 * this file copies the marking rather than deciding it.
 *
 * **THE PER-DIRECTORY MAGNITUDE BAR** — `.mini` and its three `<i>` segments,
 * with `cov.magn`, the paragraph that explains them. The first pass of this
 * file REFUSED both; both are drawn now, and the part of that refusal that was
 * right is still standing. What the bar exists for is `cov.magn`'s own
 * sentence: *"Four categorical dots said which rows were dark; they could not
 * say how dark."*
 *
 * The mockup's `renderTree` sizes the three segments off a row of
 * `[path, depth, label, dot, governed, files, examined]`, and its `isz` writes
 * each share as a percentage of ONE denominator — which is the whole of why
 * they fill the track exactly:
 *
 *     g = governed / files    u = max(0, examined − governed) / files
 *     x = (files − examined) / files
 *
 * `magnitude()` below is that arithmetic and nothing else. A bar whose
 * segments do not sum to the track is worse than no bar: it reads as a
 * measurement and is not one.
 *
 * **`examined` equals `files` on every row this screen can build, and that is
 * a fact about the endpoint rather than a shortcut.** `/api/coverage` answers
 * the paths the walk REACHED
 * (`ui/read-model.ts` · `export function coverageFiles(` · ~1087), so every
 * path `buildTree` is ever handed was examined and `x` comes out zero. On a
 * COMPLETE walk that zero is true — the walk reached everything — and it is
 * what the mockup itself draws on six of its own seven rows.
 *
 * **On a TRUNCATED walk that zero would be a lie, and there the refusal
 * survives.** The endpoint carries one global `truncated` boolean and no path
 * list, and the read model records the ask in its own words
 * (`ui/read-model.ts` · `needs the paths `listRepoFiles` did not reach` · ~1074),
 * so no row can say how many of its files the walk missed. Painting `x` at
 * zero anyway would assert the opposite of the one thing `gaps.note` says must
 * never be folded into another. So `magnitude()` carries `unknownRemainder`,
 * and a row whose remainder is unknown does not CLAIM the zero: the segment is
 * still drawn at zero width — there is no width to draw — and the row's
 * tooltip drops the count in favour of the screen's two keyed words for the
 * state, `cov.k4` — `gaps.r2`, *"not examined — past the file limit"*. That is
 * the same pair the truncation line under the legend uses and the same pair
 * the mockup's own gaps table joins. Nothing is dropped
 * (INV-nothing-is-dropped-silently) and no number is invented.
 *
 * **The paths themselves are still missing, and this does not close that.**
 * `plan:ui1 seq:17e` — *"page or filter /api/coverage, and disclose any
 * truncation"* — stays OPEN. Disclosing that a walk stopped is not knowing
 * where it stopped.
 *
 * **WHAT THIS SCREEN STILL DOES NOT DRAW, AND WHY IT DRAWS NOTHING WEAKER IN
 * ITS PLACE** — *"Where a view cannot be drawn, stop and ask; do not draw a
 * weaker one"*:
 *
 *   - **A print button.** The plan's sketch adds one on `coverage.print`; the
 *     mockup's coverage section has no such button and no table declares the
 *     key. Print is a STYLESHEET register here (`@media print`, repaint Task
 *     10), not a control this screen owns, and the browser's own print command
 *     reaches it without a button this screen would have to invent a word for.
 *
 * The four-dot legend keeps all four of its entries, `cov.k4` included: the dot
 * IS drawn, and the legend is the mockup's own static markup. `coverageDot`
 * (`lib/viewmodel.js`) simply never returns `n` — recorded there, not hidden.
 */
import {
  buildTree, coverageDot, coverageIsEmpty, treeRows,
} from '/lib/viewmodel.js';
import { composeCommand } from '/lib/command.js';
// The ONE Copy control, adopted here on 2026-08-31. This screen was the ninth
// hand-rolled clipboard site — it swapped the button's own label to `Copied` or
// `Copy failed` for 1.5s, two English literals the string tables could not carry
// and the only half of a pair `test/ui/screen-literals.test.ts` could see. A label
// swap is also a message a reader has to be LOOKING at the button to receive,
// which is the defect `plan:walk seq:31` is about; the shared control announces
// the outcome in the shell's live region instead.
import { commandActions } from '/lib/command-actions.js';
import { el, errorNote, linkId, mono, screenHead, spaced } from '/screens/parts.js';

/**
 * The mockup's own empty-state command, composed through the ONE module that
 * owns quoting rather than spelled as a literal — `mycontext add constraint "…"
 * --scope "src/**"`. `lib/command.js` never runs anything; a settlement is a
 * string the reader pastes into their own shell.
 */
const EMPTY_ARGV = ['mycontext', 'add', 'constraint', '…', '--scope', 'src/**'];
const EMPTY_COMMAND = composeCommand(EMPTY_ARGV);

/**
 * The mockup's `.tree button` indent, continued past the two depths its
 * stylesheet spells. `padding-inline:5px` is the base, `data-depth="1"` is 19px
 * and `data-depth="2"` is 33px — a 14px step — and a real repository is deeper
 * than the mockup's three-level demo. `data-depth` is set on every row either
 * way, so the stylesheet keeps the depths it owns; only depths past its last
 * rule are given the same step through CSSOM, which is what CSP permits and a
 * `style` attribute is not.
 */
const DEPTH_STYLED = 2;
const INDENT_BASE = 5;
const INDENT_STEP = 14;

/**
 * One row's magnitude: the three shares `.mini` paints, and whether the third
 * of them is a measurement or an absence.
 *
 * **The counts and the shares are returned together on purpose.** The shares
 * are what the bar is sized with and the counts are what the tooltip says, and
 * a screen that derived one from the other twice is a screen where the picture
 * and the words can disagree. `governedCount` and `fileCount` come off
 * `buildTree`'s roll-up, so the bar and the `.covn` count beside it are the
 * same fact drawn two ways rather than two answers to one question.
 *
 * **`unexamined` is zero, and `unknownRemainder` is what stops that being a
 * claim.** Every path in the tree came out of the walk (see this file's
 * header); on a complete walk zero is the true count, and on a truncated one
 * the true count is unavailable — not zero. The caller must not paint the
 * difference away, and `renderMini` below is where it does not.
 *
 * **A zero-file row divides by nothing and draws nothing.** `buildTree` cannot
 * produce one — a directory node exists only because a file needed it — but
 * `0/0` is `NaN`, `inline-size:NaN%` is an unparsable declaration, and the
 * segment would keep whatever width it last had. The empty track is the
 * correct picture for "no files rolled up here" and it is drawn deliberately.
 *
 * **`governed` is clamped to `total` for the same reason `budgetBar` clamps at
 * 100** (`lib/viewmodel.js`): a segment wider than its track is hidden by
 * `.mini`'s `overflow:hidden`, so an over-count would draw a full gold bar and
 * look like a fully-governed directory. The roll-up cannot produce one; if it
 * ever does, the shares still sum to the track and the counts still say what
 * happened.
 *
 * **This belongs in `lib/viewmodel.js`**, beside `buildTree` and
 * `coverageDot`, by that file's own rule that nothing decidable is decided in
 * the glue. It is exported from the screen because this task owns
 * `screens/coverage.js` and not that file. Raised in this task's report.
 */
export function magnitude(node, truncated) {
  const total = node.fileCount;
  const governed = Math.min(node.governedCount, total);
  const ungoverned = total - governed;
  // The walk reached every path it reported, so the third count is zero. What
  // that zero MEANS is the caller's problem, and `unknownRemainder` is it.
  const unexamined = 0;
  const share = (n) => (total === 0 ? 0 : (n / total) * 100);
  return {
    total,
    governed,
    ungoverned,
    unexamined,
    unknownRemainder: truncated === true,
    g: share(governed),
    u: share(ungoverned),
    x: share(unexamined),
  };
}

/**
 * The mockup's `isz` — a segment's share of the track, written through CSSOM.
 * `setAttribute('style', …)` is what the shipped CSP forbids and what the
 * mockup is exempt from (`screens/parts.js`' header); the declaration is the
 * same one either way, and it is LOGICAL, so the bar mirrors with the tree.
 */
function sized(segment, pct) {
  segment.style.setProperty('inline-size', `${pct}%`);
  return segment;
}

/**
 * `<div class="mini"><i class="g"><i class="u"><i class="x"></div>` — the
 * mockup's own three segments, in its own order, sized off ONE `magnitude()`.
 *
 * **The tooltip is the mockup's `mini.title` and it is where the truncated
 * walk gets said out loud.** The mockup writes it as an unkeyed English
 * ternary in its own script — `gov+' governed · '+…+' with no rule · '+…+'
 * not examined'` — so no table declares a key for those two words, and they
 * are transcribed as its literals here the same way `preview.js` transcribes
 * its own segment tooltips. Keys first in the mockup, then in both tables:
 * raised in this task's report rather than invented at this call site.
 *
 * The THIRD clause is not transcribed when the walk stopped short. A row whose
 * unreached count is unknown gets the two keyed strings this screen already
 * pairs for exactly that state — `cov.k4` — `gaps.r2` — instead of a `0` it
 * cannot stand behind. `tFlat` because a `title` is an attribute sink; `t()`
 * returns nodes and an attribute cannot hold one.
 */
function renderMini(ctx, mag) {
  const mini = el('div', 'mini');
  mini.append(
    sized(el('i', 'g'), mag.g),
    sized(el('i', 'u'), mag.u),
    sized(el('i', 'x'), mag.x),
  );
  const counted = `${mag.governed} governed · ${mag.ungoverned} with no rule`;
  mini.title = mag.unknownRemainder
    ? `${counted} · ${ctx.tFlat('cov.k4')} — ${ctx.tFlat('gaps.r2')}`
    : `${counted} · ${mag.unexamined} not examined`;
  return mini;
}

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'cov.h', 'cov.v', 'cov.sub');

  let data;
  try {
    data = await ctx.api('/api/coverage');
  } catch (error) {
    // The endpoint's own words, drawn INSTEAD of the view and never beside an
    // empty one: a refusal and a corpus that governs nothing are two facts.
    root.append(errorNote(error.message));
    return;
  }

  // --- Pinned — hoisted, never coloured per path --------------------------
  // `cov.pinhelp` is the reason this card exists: an `always:true` item governs
  // every path, and colouring it per path "is why a directory that is governed
  // used to render as a gap". `/api/coverage` hoists them server-side, so this
  // draws the hoist rather than performing it.
  const pinCard = el('div', 'card pane');
  const pinH = el('h3');
  pinH.append(...ctx.t('cov.pin'));
  const pinLine = el('p', 'small');
  // The chip's text is a count plus the tier's own name, which is a literal
  // everywhere in this product — `parts.js`' TIERCHIP records why: "the tier
  // NAME is not a translated string anywhere in the mockup".
  const pinChip = el('span', 'chip gov', `${data.pinned.length} pinned`);
  pinChip.dataset.g = '◆';
  pinLine.append(pinChip);
  data.pinned.forEach((id, index) => {
    pinLine.append(index === 0 ? ' ' : ' · ', mono(id));
  });
  const pinHelp = el('details', 'help');
  const pinSummary = el('summary');
  pinSummary.append(...ctx.t('help.whyTree'));
  const pinBox = el('div', 'helpbox');
  const pinText = el('span');
  pinText.append(...ctx.t('cov.pinhelp'));
  pinBox.append(pinText);
  pinHelp.append(pinSummary, pinBox);
  pinCard.append(pinH, pinLine, pinHelp);
  root.append(pinCard);

  // --- The zero-data view, which is drawn rather than omitted -------------
  if (coverageIsEmpty(data)) {
    root.append(emptyView(ctx));
    return;
  }

  const tree = buildTree(data.files);
  const itemsById = new Map(data.items.map((item) => [item.id, item]));
  const rows = treeRows(tree);

  // `<div id="covfull">` — the mockup's own wrapper around the populated view,
  // the sibling of `#covempty`. The mockup swaps the two with its `∅` toggle;
  // this screen decides between them from the data instead (`coverageIsEmpty`,
  // above), which is why only one of the two is ever built. The wrapper is
  // still the mockup's, and `e2e/states.spec.ts` reads both ids there.
  const full = el('div');
  full.id = 'covfull';
  root.append(full);
  const two = el('div', 'two');
  full.append(two);

  // --- The repository tree ------------------------------------------------
  const treeCard = el('div', 'card pane');
  const treeH = el('h3');
  treeH.append(...ctx.t('cov.tree'));
  const treeBox = el('div', 'tree plate');
  treeBox.id = 'tree';
  treeBox.setAttribute('role', 'tree');
  // `cov.magn` — the design of record's own account of the bar, in the slot the
  // mockup gives it: between the tree and the four-dot legend. It was withheld
  // while the bar was withheld, on the grounds that a paragraph describing a
  // bar that is not there is worse than the missing bar. The bar is there.
  const magn = el('p', 'small');
  magn.append(...ctx.t('cov.magn'));
  treeCard.append(treeH, treeBox, spaced(magn), spaced(legend(ctx)));
  // The walk stopped short, and that is disclosed rather than left to be
  // inferred from a short tree. The two keys are the mockup's own pairing for
  // this fact, joined the way its gaps table joins them:
  // `<b data-t="cov.k4">not examined</b> — <span data-t="gaps.r2">past the
  // file limit</span>`. No third key is invented, and no path is named,
  // because no path is served.
  if (data.truncated) {
    const stopped = el('p', 'small');
    const what = el('b');
    what.append(...ctx.t('cov.k4'));
    const why = el('span');
    why.append(...ctx.t('gaps.r2'));
    stopped.append(what, ' — ', why);
    treeCard.append(spaced(stopped));
  }

  // --- What governs the selected path -------------------------------------
  const detCard = el('div', 'card pane');
  const detH = el('h3');
  const detTitle = el('span');
  detTitle.append(...ctx.t('cov.gov'));
  const detFile = el('span', 'm');
  detFile.id = 'detf';
  detH.append(detTitle, ' ', detFile);
  const detBox = el('div', 'plate');
  detBox.id = 'det';
  detCard.append(detH, detBox);

  two.append(treeCard, detCard);

  /**
   * The detail table — the mockup's `renderDet`, one row per governing item.
   *
   * **The second column is the item's DECLARED SCOPE, not the glob that
   * matched.** `matchesScope` ran on the server and `/api/coverage` reports the
   * ids it admitted, never which of an item's globs did the admitting; asking
   * that question in the browser would be a second matcher, which this screen's
   * own subtitle forbids — *"through `matchesScope` and `injection()`, never a
   * bare glob match"*. An item with an empty scope governs by category policy
   * rather than by a glob, so it shows `injection()`'s own phrase, which is the
   * sentence `mycontext edit` prints for the same item.
   *
   * **A path nothing governs renders the table with no rows**, which is the
   * ruled treatment of empty: the real markup, zero rows. The mockup's script
   * writes two unkeyed sentences for that state and neither table declares
   * them; a sentence invented here would be an untranslated one.
   */
  function renderDet(node) {
    // The same spelling the tree row uses, trailing slash and all: the heading
    // names the row that is selected, and two spellings of one path on one
    // screen is how a reader comes to wonder whether they are two paths.
    detFile.textContent = node.children.length > 0 ? `${node.path}/` : node.path;
    detBox.replaceChildren();
    const table = el('table');
    const thead = el('thead');
    const headRow = el('tr');
    const itemTh = el('th');
    itemTh.append(...ctx.t('th.item'));
    const whyTh = el('th');
    // The mockup's second header is written inside its own script as an
    // unkeyed `HEB ? … : 'why it applies'` ternary, so the design of record
    // declares no key for it. `th.what` is the nearest word the shared table-
    // header vocabulary does declare, and it is translated; the exact wording
    // is an open question for the owner, raised in this task's report rather
    // than settled here with an invented key.
    whyTh.append(...ctx.t('th.what'));
    headRow.append(itemTh, whyTh);
    thead.append(headRow);
    const tbody = el('tbody');
    for (const id of node.governs) {
      const item = itemsById.get(id);
      const row = el('tr');
      const idCell = el('td');
      // The full id as text, the way the mockup's own `renderDet` draws it
      // (`btn.textContent = id`) — the split `.idkind`/`.idslug` treatment
      // belongs to the preview's rows.
      idCell.append(linkId(id, false));
      const whyCell = el('td');
      if (item === undefined) whyCell.append(mono(id));
      else if (item.scope.length > 0) whyCell.append(mono(item.scope.join(' ')));
      else whyCell.append(el('span', 'small', item.phrase));
      row.append(idCell, whyCell);
      tbody.append(row);
    }
    table.append(thead, tbody);
    detBox.append(table);
  }

  const buttons = [];
  for (const { node, depth } of rows) {
    const button = el('button');
    button.type = 'button';
    button.setAttribute('role', 'treeitem');
    button.dataset.f = node.path;
    button.dataset.depth = String(depth);
    button.setAttribute('aria-selected', 'false');
    if (depth > DEPTH_STYLED) {
      button.style.setProperty(
        'padding-inline-start', `${INDENT_BASE + INDENT_STEP * depth}px`,
      );
    }
    // A directory keeps its trailing slash, exactly as the mockup's own rows
    // do (`src/`, `src/billing/`) — the one glance that tells a directory from
    // a file before the dot or the count is read.
    const isDir = node.children.length > 0;
    // The mockup's own order — dot, name, bar, count — and its own division of
    // labour: the dot is the CATEGORY (its shape survives monochrome), the bar
    // is the magnitude, the count is the same magnitude in figures for anyone
    // the bar is too small for.
    button.append(
      el('span', `dot ${coverageDot(node)}`),
      el('span', 'nm', isDir ? `${node.name}/` : node.name),
      renderMini(ctx, magnitude(node, data.truncated)),
      el('span', 'covn', `${node.governedCount}/${node.fileCount}`),
    );
    button.addEventListener('click', () => {
      for (const other of buttons) other.setAttribute('aria-selected', 'false');
      button.setAttribute('aria-selected', 'true');
      renderDet(node);
    });
    buttons.push(button);
    treeBox.append(button);
  }

  // The mockup opens with a row already selected and its detail drawn. The
  // first row is that row here: deterministic, and the top of the tree is the
  // widest answer the screen has.
  if (rows.length > 0) {
    buttons[0].setAttribute('aria-selected', 'true');
    renderDet(rows[0].node);
  }
}

/** The four dots, in the mockup's own order and with its own separators. */
function legend(ctx) {
  const line = el('p', 'small');
  const keys = [['g', 'cov.k1'], ['o', 'cov.k2'], ['w', 'cov.k3'], ['n', 'cov.k4']];
  keys.forEach(([dot, key], index) => {
    const swatch = el('span', `dot ${dot}`);
    // The mockup writes `style="display:inline-block"` on each swatch; CSP
    // forbids the attribute in the shipped app, so the same declaration goes
    // through CSSOM. `.dot` is a flex child in a tree row and an inline run
    // here, which is why the mockup overrides it in exactly this one place.
    swatch.style.setProperty('display', 'inline-block');
    // The last entry is bold in the mockup — "not examined" is the state the
    // screen most often has to say is NOT what a reader is looking at.
    const label = el(index === keys.length - 1 ? 'b' : 'span');
    label.append(...ctx.t(key));
    if (index > 0) line.append(' · ');
    line.append(swatch, ' ', label);
  });
  return line;
}

/**
 * `#covempty` — *"Nothing governs this project yet"*, said ONCE.
 *
 * Drawn, never omitted: `cov.e2` is the whole argument for it — *"That is the
 * normal state of a new workspace, not a wall of warnings. One sentence, said
 * once — not repeated per row."*
 */
function emptyView(ctx) {
  const box = el('div', 'empty');
  const headline = el('b');
  headline.append(...ctx.t('cov.e1'));
  const note = el('p', 'small');
  note.append(...ctx.t('cov.e2'));

  const cmd = el('div', 'cmd');
  cmd.append(el('code', null, EMPTY_COMMAND));

  // **`id: null`, so this gets Copy and no Execute, and that is the honest
  // answer rather than a caution.** The design of record's empty-state line is
  // `mycontext add constraint “…” --scope “src/**”` — a TEMPLATE with an ellipsis
  // where the text goes. There is no catalogue entry the server could rebuild
  // it from and nothing here a reader could sensibly run unedited, and the
  // control's own rule is that nothing outside the catalogue may run.
  //
  // The button moves OUT of `div.cmd` and into the control's `div.cmdactions`
  // beside it, which is where every other screen's is; the mockup draws it
  // inside, and `.cmdactions button` carries its own background so the pair
  // reads the same either way.
  box.append(headline, note, cmd, commandActions({ argv: EMPTY_ARGV, id: null, ctx }));
  const wrap = el('div');
  wrap.id = 'covempty';
  wrap.append(box);
  return wrap;
}
