/**
 * `nav.inj` — **Scope coverage**, `<section data-p="coverage">` in the design of
 * record. Every walked path, coloured by what governs it, with the detail pane
 * beside the tree.
 *
 * **Redesigned 2026-09-04**, `TASK-scope-coverage-summarises-first-and-shows-
 * detail-on-demand` (seq:21) and `TASK-coverage-gaps-folds-into-scope-coverage-
 * keeping-the-one-fact` (seq:22), against the owner-approved mockup
 * `reports/2026-09-04-scope-coverage-redesign-mockup.html` — approved in his own
 * words: *"looked at the mockup and it's fine exact what required including the
 * help and the screen refactor, approve it"*.
 *
 * **The problem, measured on this project's own corpus (2026-09-04, this
 * lane's own re-measurement — the task bodies' "6,236 rows / 184,246px" is a
 * STALE, roughly fourfold-overstated figure from an earlier pass and is not
 * repeated here): the tree drew every row expanded with no collapse, the
 * pinned card was 36 ids in one unbroken paragraph mixing seven kinds, and
 * opening any folder listed dozens of near-identical governing ids because
 * almost every governing item in this corpus is unscoped and matches every
 * folder alike.**
 *
 * **One principle, applied three times** (the tree, the pinned card, the
 * "what governs" card): anything past ~8 rows gets a short counted summary
 * that is always visible, grouped by KIND — `groupByKind()`
 * (`lib/viewmodel.js`), the id's own prefix up to its first `-` — with the
 * full list behind the ONE shared disclosure this product now has,
 * `lib/disclosure.js`'s `helpDisclosure()`. This file is that component's
 * first caller.
 *
 * **`TASK-coverage-gaps-folds-into-scope-coverage-keeping-the-one-fact`
 * (seq:22) retires `screens/gaps.js`.** Of its three row-kinds, only the
 * empty-CATEGORY list was ever real on a corpus this project ships with — the
 * ungoverned-directory row is arithmetically unreachable under this project's
 * `global` scope policy (85+ unscoped normative items govern every path), and
 * the "not examined" notice duplicates, byte for byte, the sentence this
 * screen's own truncation line already carries. Both are DROPPED, not moved.
 * The one live fact — N of the shipped categories hold nothing — becomes the
 * "Categories with nothing in them" card at the foot of this screen, fed by
 * `/api/help/categories`' `corpus.empty`, the same endpoint `gaps.js` read.
 *
 * `gaps.r2` stays declared and used HERE unchanged (the truncation line below,
 * paired with `cov.k4`) — that is `coverage.js`'s own copy, not the duplicate
 * that was dropped from `gaps.js`.
 */
import {
  buildTree, coverageDot, coverageGaps, coverageIsEmpty, groupByKind, treeRows,
} from '/lib/viewmodel.js';
import { composeCommand } from '/lib/command.js';
import { commandActions } from '/lib/command-actions.js';
import { helpDisclosure } from '/lib/disclosure.js';
import {
  el, errorNote, linkId, mono, num, screenHead, spaced,
} from '/screens/parts.js';

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
 * of them is a measurement or an absence. Unchanged by the 2026-09-04
 * redesign — the bar is not one of the three things that redesign touches.
 *
 * See the pre-redesign history of this function (git blame) for the fuller
 * account of `unknownRemainder`, the clamp at `total`, and the zero-file row;
 * nothing about the arithmetic changed.
 */
export function magnitude(node, truncated) {
  const total = node.fileCount;
  const governed = Math.min(node.governedCount, total);
  const ungoverned = total - governed;
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

/** `<div class="mini"><i class="g"><i class="u"><i class="x"></div>` — unchanged. */
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

/**
 * `<span class="catchip">KIND · N</span>` for each kind `groupByKind` found —
 * the counted summary that is ALWAYS visible, in the mockup's own class and
 * separator. No string key: a kind is the id's own literal prefix (`RULE`,
 * `CONST`, …), the same unkeyed vocabulary this product already gives ids,
 * tier names and category names, and the digit is a digit.
 */
function kindChips(groups) {
  const line = el('p');
  for (const { kind, count } of groups) line.append(el('span', 'catchip', `${kind} · ${count}`));
  return line;
}

/** `id -> its kind`, the grouping key `groupByKind` itself uses, exposed for the id lists below. */
function kindOf(id) {
  const cut = id.indexOf('-');
  return cut === -1 ? id : id.slice(0, cut);
}

/**
 * The full member list `groupByKind`'s chips summarise — headed by kind, one
 * `renderId` call per id — for the ONE disclosure (`help.showIds`) each card
 * uses to hold it. `renderId` differs between the two callers: the pinned
 * card draws each id as a plain mono run (this screen's own long-standing
 * choice — pinned ids were never links here), the "what governs" card draws
 * each id as the same `linkId` button its old per-row table always did, so a
 * reader can still open an item's own pane from here.
 */
function groupedIdsBody(ids, groups, renderId) {
  const byKind = new Map();
  for (const id of ids) {
    const kind = kindOf(id);
    if (!byKind.has(kind)) byKind.set(kind, []);
    byKind.get(kind).push(id);
  }
  const body = [];
  groups.forEach(({ kind, count }) => {
    const p = el('p', 'small');
    p.append(el('b', null, `${kind} (${count})`), ' ');
    byKind.get(kind).forEach((id, index) => {
      if (index > 0) p.append(' · ');
      p.append(renderId(id));
    });
    body.push(p);
  });
  return body;
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

  // --- The zero-data view, which is drawn rather than omitted -------------
  if (coverageIsEmpty(data)) {
    root.append(emptyView(ctx));
    return;
  }

  const tree = buildTree(data.files);
  const rows = treeRows(tree);
  const gapCount = coverageGaps(tree).length;

  // The empty CATEGORIES, from the same endpoint `gaps.js` read
  // (`/api/help/categories`), fetched in its OWN try so a refusal here costs
  // only the category card and not the tree above it.
  let catEmpty = [];
  let catTotal = null;
  let catRefusal = null;
  try {
    const help = await ctx.api('/api/help/categories');
    const served = help === null || typeof help !== 'object' ? null : help.corpus;
    if (served === null || typeof served !== 'object' || !Array.isArray(served.empty)
      || served.counts === null || typeof served.counts !== 'object') {
      catRefusal = new Error('coverage: /api/help/categories answered 200 without corpus.empty/'
        + 'counts — the empty-category card below would be an absence drawn as a full corpus');
    } else {
      catEmpty = served.empty;
      catTotal = catEmpty.length + Object.keys(served.counts).length;
    }
  } catch (error) {
    catRefusal = error;
  }

  // --- The status line — files covered / gaps / empty categories, always ---
  // visible, one sentence, ahead of everything below it.
  const status = el('div', 'status');
  status.append(...ctx.t('cov.status', {
    covered: num(tree.governedCount),
    total: num(tree.fileCount),
    gaps: num(gapCount),
    catEmpty: catTotal === null ? '?' : num(catEmpty.length),
    catTotal: catTotal === null ? '?' : num(catTotal),
  }));
  root.append(status);

  // --- Pinned — hoisted, never coloured per path, grouped by kind ---------
  const pinCard = el('div', 'card pane');
  const pinH = el('h3');
  pinH.append(...ctx.t('cov.pin', { n: num(data.pinned.length) }));
  const pinNote = el('p', 'small');
  pinNote.append(...ctx.t('cov.pinNote'));
  pinCard.append(pinH, pinNote);
  if (data.pinned.length > 0) {
    const pinGroups = groupByKind(data.pinned);
    pinCard.append(
      kindChips(pinGroups),
      helpDisclosure(ctx, 'help.showIds', groupedIdsBody(data.pinned, pinGroups, mono)),
    );
  }
  const pinHelpBody = el('span');
  pinHelpBody.append(...ctx.t('cov.pinhelp'));
  pinCard.append(helpDisclosure(ctx, 'help.whyTree', [pinHelpBody]));
  root.append(pinCard);

  const full = el('div');
  full.id = 'covfull';
  root.append(full);
  const two = el('div', 'two');
  full.append(two);

  // --- The repository tree — collapsed to top-level folders, plus a filter -
  const treeCard = el('div', 'card pane');
  const treeH = el('h3');
  treeH.append(...ctx.t('cov.tree'));
  const filterLine = el('p', 'small');
  const filterInput = el('input', 'filter');
  filterInput.type = 'text';
  filterInput.placeholder = ctx.tFlat('cov.tree.filter');
  filterInput.setAttribute('aria-label', ctx.tFlat('cov.tree.filter'));
  filterLine.append(filterInput);
  const treeBox = el('div', 'tree plate');
  treeBox.id = 'tree';
  treeBox.setAttribute('role', 'tree');
  const magnBody = el('span');
  magnBody.append(...ctx.t('cov.magn'));
  treeCard.append(treeH, filterLine, treeBox,
    spaced(helpDisclosure(ctx, 'help.whyMagnitude', [magnBody])),
    spaced(legend(ctx)));
  if (data.truncated) {
    const stopped = el('p', 'small');
    const what = el('b');
    what.append(...ctx.t('cov.k4'));
    const why = el('span');
    why.append(...ctx.t('gaps.r2'));
    stopped.append(what, ' — ', why);
    treeCard.append(spaced(stopped));
  }

  // --- What governs the selected path, grouped by kind --------------------
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

  function renderDet(node) {
    detFile.textContent = node.children.length > 0 ? `${node.path}/` : node.path;
    detBox.replaceChildren();
    const groups = groupByKind(node.governs);
    const summary = el('p', 'small');
    summary.append(...ctx.t('cov.gov.summary', {
      n: num(node.governs.length), c: num(groups.length),
    }));
    detBox.append(summary);
    if (node.governs.length > 0) {
      detBox.append(
        kindChips(groups),
        helpDisclosure(ctx, 'help.showIds',
          groupedIdsBody(node.governs, groups, (id) => linkId(id, false))),
      );
    }
  }

  // --- Rows: built once, visibility driven by collapse state + filter -----
  //
  // **The toggle is its own `<button>`, a SIBLING of the treeitem button
  // inside a non-interactive `<span class="row">` wrapper — never a `<span>`
  // with a click handler living INSIDE the treeitem button.** A `<button>`
  // nested inside another `<button>` is invalid HTML and, in every browser
  // that renders it anyway, the inner one is not independently reachable by
  // Tab — a pointer-only control, which `STD-a-screen-explains-itself-in-
  // plain-words-and-depth-hides`'s own keyboard requirement and this task's
  // "keyboard reachable, not pointer-only" both forbid. Two real buttons,
  // siblings, are each in the normal tab order on their own.
  //
  // `openDirs` starts EMPTY, which is why the tree opens collapsed to
  // top-level folders and not the reverse: `applyVisibility()`'s no-filter
  // branch hides a depth>0 row unless every one of its ancestor directories
  // is IN this set, and an empty set satisfies that for no ancestor at all.
  const openDirs = new Set();
  let filterValue = '';
  const entries = rows.map(({ node, depth }) => {
    const row = el('span', 'row');
    const isDir = node.children.length > 0;
    let toggle = null;
    if (isDir) {
      toggle = el('button', 'toggle', '▸');
      toggle.type = 'button';
      // Not a `title`/label restating the glyph: `aria-expanded` is the
      // property assistive tech reads for a disclosure control, and the
      // glyph is the sighted copy of the same fact, updated in the same
      // handler so the two can never disagree.
      toggle.setAttribute('aria-expanded', 'false');
      toggle.addEventListener('click', () => {
        const open = !openDirs.has(node.path);
        if (open) openDirs.add(node.path); else openDirs.delete(node.path);
        toggle.textContent = open ? '▾' : '▸';
        toggle.setAttribute('aria-expanded', String(open));
        applyVisibility();
      });
      row.append(toggle);
    }
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
    button.append(
      el('span', `dot ${coverageDot(node)}`),
      el('span', 'nm', isDir ? `${node.name}/` : node.name),
      renderMini(ctx, magnitude(node, data.truncated)),
      el('span', 'covn', `${node.governedCount}/${node.fileCount}`),
    );
    // Selecting a row (to see what governs it) and expanding it are two
    // different acts — a reader opening the detail pane for a folder should
    // not also be forced to expand it, and vice versa. The toggle above
    // handles the second; this handles only the first.
    button.addEventListener('click', () => {
      for (const other of entries) other.button.setAttribute('aria-selected', 'false');
      button.setAttribute('aria-selected', 'true');
      renderDet(node);
    });
    row.append(button);
    // Every proper ancestor directory path, root excluded — what must be OPEN
    // for this row to show when no filter is active.
    const ancestors = [];
    const segments = node.path.split('/');
    for (let i = 1; i < segments.length; i++) ancestors.push(segments.slice(0, i).join('/'));
    treeBox.append(row);
    return {
      row, button, node, depth, ancestors,
    };
  });

  // **The filter and the collapse state are independent, and clearing the
  // filter returns the reader to whatever THEY had expanded** — `openDirs`
  // is never touched by typing or clearing the filter input, only by the
  // toggle buttons. A reader who opens two folders, filters to check a
  // third, then clears the filter, gets their two folders back open rather
  // than a tree that silently forgot what they had done.
  function applyVisibility() {
    const needle = filterValue.trim().toLowerCase();
    for (const entry of entries) {
      entry.row.hidden = needle !== ''
        ? !entry.node.path.toLowerCase().includes(needle)
        : entry.depth > 0 && !entry.ancestors.every((a) => openDirs.has(a));
    }
  }
  filterInput.addEventListener('input', () => {
    filterValue = filterInput.value;
    applyVisibility();
  });
  applyVisibility();

  // The mockup opens with a row already selected and its detail drawn. The
  // first row is that row here: deterministic, and the top of the tree is the
  // widest answer the screen has.
  if (entries.length > 0) {
    entries[0].button.setAttribute('aria-selected', 'true');
    renderDet(entries[0].node);
  }

  // --- Categories with nothing in them — the one fact `gaps.js` was for ---
  const catCard = el('div', 'card pane');
  const catH = el('h3');
  catH.append(...ctx.t('cov.emptycat.h'));
  catCard.append(catH);
  if (catRefusal !== null) {
    catCard.append(errorNote(catRefusal.message));
  } else if (catEmpty.length === 0) {
    // `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` — reusing
    // the ONE `◌` primitive this product already draws for exactly this state
    // (`screens/doctor.js` · `el('span', 'chip unmeas')` · ~775), never a
    // second glyph invented here.
    const zero = el('span', 'chip unmeas');
    zero.dataset.g = '◌';
    zero.append(...ctx.t('cov.emptycat.none'));
    const p = el('p', 'small');
    p.append(zero);
    catCard.append(p);
  } else {
    const line = el('p');
    for (const category of catEmpty) line.append(el('span', 'catchip', category));
    catCard.append(line);
  }
  root.append(catCard);
}

/** The four dots, in the mockup's own order and with its own separators. */
function legend(ctx) {
  const line = el('p', 'small');
  const keys = [['g', 'cov.k1'], ['o', 'cov.k2'], ['w', 'cov.k3'], ['n', 'cov.k4']];
  keys.forEach(([dot, key], index) => {
    const swatch = el('span', `dot ${dot}`);
    swatch.style.setProperty('display', 'inline-block');
    const label = el(index === keys.length - 1 ? 'b' : 'span');
    label.append(...ctx.t(key));
    if (index > 0) line.append(' · ');
    line.append(swatch, ' ', label);
  });
  return line;
}

/**
 * `#covempty` — *"Nothing governs this project yet"*, said ONCE.
 * Unchanged by the 2026-09-04 redesign.
 */
function emptyView(ctx) {
  const box = el('div', 'empty');
  const headline = el('b');
  headline.append(...ctx.t('cov.e1'));
  const note = el('p', 'small');
  note.append(...ctx.t('cov.e2'));

  const cmd = el('div', 'cmd');
  cmd.append(el('code', null, EMPTY_COMMAND));

  box.append(headline, note, cmd, commandActions({ argv: EMPTY_ARGV, id: null, ctx }));
  const wrap = el('div');
  wrap.id = 'covempty';
  wrap.append(box);
  return wrap;
}
