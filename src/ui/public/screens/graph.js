/**
 * `nav.ev` — **Relations**, `<section data-p="graph">` in the design of record.
 * An ego-graph, not a hairball.
 *
 * **Columns by DIRECTION, which is the mockup's layout and `gr.note`'s own
 * reason for it**: *"Direction is the layout: the column decides which way the
 * relation points, so nothing has to be simulated."* `layoutGraph`
 * (`lib/viewmodel.js`) places every node by its SIGNED depth from the focus and
 * this file turns those columns into the mockup's own geometry — three columns
 * at x=8 / 345 / 682 across a 900-wide viewBox fall straight out of the even
 * spread it uses, so the numbers here are the mockup's numbers rather than a
 * second set that happens to look similar.
 *
 * **No physics, no dependency, and no re-derivation.** Both facts an edge
 * carries are the server's: `type` is the relation vocabulary and `loadBearing`
 * is `isLoadBearing(type)` called in `/api/graph`, because *"a browser `.js`
 * module cannot import a core `.ts` module and re-listing the vocabulary in the
 * client is the copied-rule defect this plan exists to prevent"*.
 *
 * **Every stroke is a CLASS, never an inline colour.** `line.setAttribute(
 * 'stroke', e.dangling ? '#a01a1a' : '#888')` in the plan's own Step 3 names two
 * colours that no longer exist in the token set, and `setAttribute` cannot read
 * a custom property. The mockup already draws edges as `path.edge.bearing` /
 * `.edge.ref` / `.edge.dangling` and nodes as `rect.node.focus` / `.missing` /
 * `.superseded` / `.more`, backed by `--edge-3`, `--ink`, `--faint`, `--gold`
 * and `--crit` — and a class is the only form `forced-colors` can restate,
 * since SVG `stroke`/`fill`
 * (`docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` · `are NOT force-adjusted in Chromium` · ~560).
 * The reconciliation note asks for `--pane-edge` on a plain edge; the mockup's
 * own `.edge` rule is `stroke:var(--edge-3)` and the mockup is the design of
 * record, so `--edge-3` stands. Neither hex appears in this file, and neither
 * appears in the mockup either.
 *
 * **Nodes carry ids, never titles** (`gr.note`), which is what keeps
 * bidi-sensitive text out of every SVG in the product. The whole chart mirrors
 * by PROJECTION rather than by transform — `X()` and `px()` below flip an
 * x-coordinate into the reading direction so the glyphs stay upright, exactly
 * as the mockup's own restored views do.
 *
 * **WHAT THIS SCREEN DOES NOT DRAW, AND THE ONE QUESTION IT CANNOT ANSWER.**
 * Every field the legend names is served — `focus` is the response's own,
 * `missing` is on the node, superseded is `status`, load-bearing is on the edge
 * and *"+N more"* is `omitted` — so nothing here is refused for want of data.
 * What the design of record does not say is **WHICH item the ego graph is drawn
 * around**: its Relations section has no picker, no `<select>` and no control of
 * any kind, and the header's own focus popup is a different thing entirely
 * (`focus.live` — `state/focus.json`, which narrows by tags, categories and
 * scope and names no item). The plan's Step 3 adds two pickers on
 * `graph.focus` / `graph.radius`, and no table declares either key. So the focus
 * is the first item by id — deterministic, and the same answer twice — and
 * choosing it is the open question this task's report raises. The radius stays
 * the endpoint's own default of 1, which is what `gr.sub` promises: *"One
 * focused item, radius 1"*.
 */
import { edgeClass, egoNodeClass, layoutGraph } from '/lib/viewmodel.js';
import { el, errorNote, screenHead, spaced } from '/screens/parts.js';

const NS = 'http://www.w3.org/2000/svg';

/** The mockup's own chart box, node box and gutters, number for number. */
const W = 900;
const NH = 22;
const NW = 210;
const MARGIN = 8;
/** The mockup's fixed height, kept as the FLOOR rather than as the value: it
 *  draws five nodes and the endpoint caps at sixty. */
const H_MIN = 250;
/** Vertical room `spread()` leaves for the column captions and the last row. */
const H_PAD = 56;
/** Room per row past the point where `H_MIN` stops being enough. */
const ROW = 26;
/** The mockup's own id truncation — an ego graph is read, not audited. */
const ID_MAX = 28;

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'gr.h', 'gr.v', 'gr.sub');

  const card = el('div', 'card pane');
  const box = el('div', 'plate');
  box.id = 'ego';
  card.append(box, legend(ctx), spaced(note(ctx)));
  root.append(card);

  let items;
  try {
    items = await ctx.api('/api/items');
  } catch (error) {
    box.append(errorNote(error.message));
    return;
  }
  // A corpus with no items has no ego to draw and no error to report. The card,
  // the legend and the note are the real markup; the plate holds nothing.
  if (items.items.length === 0) return;

  let data;
  try {
    data = await ctx.api(`/api/graph?focus=${encodeURIComponent(items.items[0].id)}`);
  } catch (error) {
    box.append(errorNote(error.message));
    return;
  }

  box.append(drawEgo(ctx, data));
}

/** `sv(tag, attrs)` — the mockup's own SVG factory, argument for argument. */
function sv(tag, attrs) {
  const node = document.createElementNS(NS, tag);
  for (const key of Object.keys(attrs)) node.setAttribute(key, String(attrs[key]));
  return node;
}

function svText(attrs, text) {
  const node = sv('text', attrs);
  node.textContent = text;
  return node;
}

function drawEgo(ctx, data) {
  // Mirroring is by PROJECTION, not by transform: `scale(-1,1)` would reverse
  // the digits too. The page direction is `<html dir>`, which `applyLanguage`
  // sets from the string table itself — a layout fact, not a translated one.
  const rtl = document.documentElement.dir === 'rtl';
  const X = (u) => (rtl ? W - u : u);
  const px = (x, width) => (rtl ? W - x - width : x);

  const placed = layoutGraph(data.nodes, data.edges, data.focus);
  const byId = new Map(data.nodes.map((node) => [node.id, node]));
  const columns = Math.max(...placed.map((p) => p.x)) + 1;
  // The "+N more" node is a ROW in the last column, exactly as the mockup adds
  // it to its own `out` column, so it counts toward that column's height.
  const perColumn = new Array(columns).fill(0);
  for (const p of placed) perColumn[p.x] += 1;
  if (data.omitted > 0) perColumn[columns - 1] += 1;
  const height = Math.max(H_MIN, H_PAD + Math.max(...perColumn) * ROW);

  // One column is centred; two or more spread evenly across the box. At three
  // columns this is the mockup's own 8 / 345 / 682.
  const colX = (index) => (columns === 1
    ? (W - NW) / 2
    : MARGIN + index * ((W - NW - MARGIN * 2) / (columns - 1)));
  const spread = (count, index) => {
    const gap = (height - H_PAD) / Math.max(count, 1);
    return 34 + gap * index + gap / 2;
  };

  const kids = [];

  // The column captions. `gr.lfocus` is a declared key and is used for the
  // middle one; the two direction captions are written in the mockup's own
  // script as unkeyed `HEB ? … : …` ternaries, so they are transcribed as its
  // English and raised in this task's report — dropping them would leave the
  // reader unable to tell which column points which way, which is the entire
  // claim this layout makes. An SVG `<text>` cannot hold an element, so `tFlat`
  // is the sink here whatever the renderer does.
  const CAPTION = {
    '-1': 'these point at the focus',
    '1': 'the focus points at these',
  };
  const captionSeen = new Set();
  for (const p of placed) {
    if (captionSeen.has(p.x)) continue;
    captionSeen.add(p.x);
    const caption = p.depth === 0 ? ctx.tFlat('gr.lfocus') : CAPTION[String(Math.sign(p.depth))];
    if (caption === undefined) continue;
    kids.push(svText(
      { x: X(colX(p.x) + NW / 2), y: 16, 'text-anchor': 'middle' }, caption,
    ));
  }

  // Rows within a column, in `layoutGraph`'s (relation type, id) order.
  const yOf = (p) => spread(perColumn[p.x], p.y);

  // EDGES FIRST, so a node box is never drawn under its own connectors.
  for (const edge of data.edges) {
    const a = placed.find((p) => p.id === edge.from);
    const b = placed.find((p) => p.id === edge.to);
    if (a === undefined || b === undefined) continue;
    // From the right-hand side of the earlier column to the left-hand side of
    // the later one, so the curve leaves and arrives at a box edge.
    const forward = a.x <= b.x;
    const x1 = forward ? colX(a.x) + NW : colX(a.x);
    const x2 = forward ? colX(b.x) : colX(b.x) + NW;
    const y1 = yOf(a);
    const y2 = yOf(b);
    const mx = (x1 + x2) / 2;
    kids.push(sv('path', {
      class: `edge ${edgeClass(edge)}`,
      d: `M ${X(x1)} ${y1} C ${X(mx)} ${y1} ${X(mx)} ${y2} ${X(x2)} ${y2}`,
    }));
    // Every edge carries its relation TYPE, because "broken" and "how much it
    // matters" are two different facts (`gr.note`). A relation type is the
    // vocabulary's own word and is not translated anywhere in the mockup.
    kids.push(svText(
      { x: X(mx), y: (y1 + y2) / 2 - 5, 'text-anchor': 'middle', class: 'rel' }, edge.type,
    ));
  }

  for (const p of placed) {
    const node = byId.get(p.id);
    const y = yOf(p);
    const state = egoNodeClass(node, data.focus);
    kids.push(sv('rect', {
      class: state === '' ? 'node' : `node ${state}`,
      x: px(colX(p.x), NW), y: y - NH / 2, width: NW, height: NH, rx: 4,
    }));
    kids.push(svText(
      { x: X(colX(p.x) + NW / 2), y: y + 3.5, 'text-anchor': 'middle', class: 'nid' },
      p.id.length > ID_MAX ? `${p.id.slice(0, ID_MAX - 1)}…` : p.id,
    ));
  }

  // The cap dropped nodes, and saying so is not optional — `gr.sub` promises
  // "a hard cap of 60 nodes with an explicit '+N more'". The mockup writes the
  // word `more` as an unkeyed ternary and paints it with an inline
  // `fill:'var(--warn)'`; a custom property cannot resolve in a presentation
  // attribute, and the repaint's rule is a class either way, so the fill is
  // left to the stylesheet through `text.nid.more` and only the word is
  // transcribed. Raised in this task's report with the other five.
  if (data.omitted > 0) {
    const lastColumn = columns - 1;
    const y = spread(perColumn[lastColumn], perColumn[lastColumn] - 1);
    kids.push(sv('rect', {
      class: 'node more', x: px(colX(lastColumn), NW), y: y - NH / 2,
      width: NW, height: NH, rx: 4,
    }));
    kids.push(svText(
      { x: X(colX(lastColumn) + NW / 2), y: y + 3.5, 'text-anchor': 'middle', class: 'nid more' },
      `+${data.omitted} more`,
    ));
  }

  const svg = sv('svg', {
    viewBox: `0 0 ${W} ${height}`,
    class: 'chart',
    role: 'img',
    // An accessible name is an ATTRIBUTE, so no element could survive here and
    // no key declares this sentence: the mockup writes it as a ternary too.
    'aria-label': 'Relation ego-graph: columns by direction, relation type on every edge',
  });
  for (const kid of kids) svg.append(kid);
  return svg;
}

/**
 * The six legend entries, in the mockup's own order: three NODE states drawn as
 * `<i>` swatches, then three EDGE classes drawn as `<span class="ln">` rules.
 *
 * The swatch is a SIBLING of the translated span, never inside it — a
 * translated element's children are replaced wholesale from the string table,
 * which knows nothing of a swatch someone nested in one.
 */
function legend(ctx) {
  const wrap = el('div', 'legend');
  const entries = [
    ['i', 'focusn', 'gr.lfocus'],
    ['i', 'missn', 'gr.lmiss'],
    ['i', 'supn', 'gr.lsup'],
    ['span', 'ln bearing', 'gr.lbear'],
    ['span', 'ln ref', 'gr.lref'],
    ['span', 'ln dang', 'gr.ldang'],
  ];
  for (const [tag, cls, key] of entries) {
    const entry = el('span');
    const label = el('span');
    label.append(...ctx.t(key));
    entry.append(el(tag, cls), label);
    wrap.append(entry);
  }
  return wrap;
}

function note(ctx) {
  const p = el('p', 'small');
  p.append(...ctx.t('gr.note'));
  return p;
}
