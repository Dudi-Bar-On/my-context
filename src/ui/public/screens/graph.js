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
 * **WHO CHOOSES THE FOCUS — ANSWERED 2026-08-31, AND IT IS A READ.**
 * Every field the legend names is served — `focus` is the response's own,
 * `missing` is on the node, superseded is `status`, load-bearing is on the edge
 * and *"+N more"* is `omitted` — so nothing here is refused for want of data.
 * What was missing was the one thing the design of record does not say:
 * **WHICH item the ego graph is drawn around.** The screen fetched `/api/items`
 * and took element zero, so it could only ever draw one item's neighbourhood
 * and which one was an accident of the list's order.
 *
 * **There is a picker now** — `gr.focus`, a `<label>` and a `<select>` of every
 * id `/api/items` answers, above the plate. Changing it refetches
 * `/api/graph?focus=…` and redraws the chart and the readout, and NOTHING
 * ELSE: it writes nothing, composes nothing and confirms nothing, because
 * choosing what to look at is a READ. There is no compose-then-execute control
 * here and there is no approval boundary to cross, which is the same reason
 * `coverage.js` needs none for its tree.
 *
 * **The default is unchanged and deliberately so.** The picker opens on the
 * first item by id — the same answer twice, the same answer the screen has
 * always given — so a reader who touches nothing sees what they saw before.
 *
 * **`gr.focus`, not the plan sketch's `graph.focus`.** Every string this screen
 * names is in its own `gr.` namespace, and `test/ui/graph-screen.test.ts` holds
 * *"the screen names every `gr.*` key the tables declare, and invents none"* in
 * BOTH directions — a `graph.` key would sit outside the only gate that would
 * ever notice it going unused or undeclared. The WORDING is unapproved copy
 * drafted here and reported as such.
 *
 * **`graph.radius` is NOT declared, and that is the task's own ruling rather
 * than an omission.** Radius stays the endpoint's default of 1, which is what
 * `gr.sub` promises — *"One focused item, radius 1"* — and it is SENT rather
 * than relied on, so the readout names the horizon it actually asked for
 * instead of quoting a default from memory. A radius control is a second
 * question and it is settled the other way.
 *
 * The header's own focus popup remains a different thing entirely
 * (`focus.live` — `state/focus.json`, which narrows injection by tags,
 * categories and scope and names no item at all).
 *
 * **EVERY DECISION IS IN `egoDrawing`, AND NOTHING IS DECIDED IN THE GLUE.**
 * Spec §6 names `screens/*.js` as the untested surface, so this file computes
 * the entire picture — every coordinate, every class, every truncation — as
 * plain data first, and `chart()` does nothing but turn that list into
 * elements. `test/ui/graph-screen.test.ts` drives `egoDrawing` with no
 * `document` in the room and pins the routing against the mockup's own
 * numbers, which is the only way to check the one thing a kind count cannot:
 * an edge either arrives at its own two nodes or it does not.
 *
 * **NOTHING IS DROPPED IN SILENCE.** Three ends were loose. A *dangling*
 * relation is drawn, not swallowed — the server answers `missing: true` on the
 * node and `dangling: true` on the edge, so it is a `path.edge.dangling`
 * arriving at a `rect.node.missing` and the legend names both. A relation
 * whose target lies past the radius is never SENT (`/api/graph` stops the walk
 * at the horizon) and one whose target the 60-node cap refused is dropped
 * server-side with that node — neither is knowable from this response, so the
 * readout states `radius` and `omitted` outright rather than letting the
 * reader assume the picture is the whole corpus. And an edge this layout
 * cannot place — an endpoint absent from `nodes`, which a well-formed response
 * never contains — used to be `continue`d away without a trace; it is now
 * counted and reported as the defect it would be.
 */
import { edgeClass, egoNodeClass, layoutGraph } from '/lib/viewmodel.js';
import { el, errorNote, mono, screenHead, spaced } from '/screens/parts.js';

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
/** The baseline the mockup writes its three column captions on. */
const CAPTION_Y = 16;
/**
 * The radius this screen asks for. It is also `/api/graph`'s own default, and
 * is sent anyway: the readout tells the reader how far the picture reaches,
 * and a screen that reads that number off a server default it never named
 * would be repeating a fact rather than stating one.
 */
const RADIUS = 1;

export async function render(root, ctx) {
  root.replaceChildren();
  screenHead(ctx, root, 'gr.h', 'gr.v', 'gr.sub');

  const card = el('div', 'card pane');
  const box = el('div', 'plate');
  box.id = 'ego';
  // The readout and any refusal live in their own container so a focus change
  // can replace exactly them. Rebuilding the whole card would rebuild the
  // picker, and a `<select>` replaced mid-interaction takes the keyboard focus
  // and the open list down with it.
  const foot = el('div');
  card.append(box, legend(ctx), spaced(note(ctx)), foot);
  root.append(card);

  let items;
  try {
    items = await ctx.api('/api/items');
  } catch (error) {
    box.append(errorNote(error.message));
    return;
  }
  // A corpus with no items has no ego to draw and no error to report. The card,
  // the legend and the note are the real markup; the plate holds nothing. No
  // picker either — an empty `<select>` is a control offering nothing.
  if (items.items.length === 0) return;

  /**
   * Draw the ego graph around one id, replacing the plate and the foot.
   *
   * Every refusal lands in the PLATE, where the chart would have been, and the
   * foot is emptied with it: a stale readout under a failed refetch would name
   * a focus, a node count and an omitted count belonging to the previous
   * picture, which is worse than no readout at all.
   */
  const draw = async (focus) => {
    box.replaceChildren();
    foot.replaceChildren();
    let data;
    try {
      data = await ctx.api(
        `/api/graph?focus=${encodeURIComponent(focus)}&radius=${RADIUS}`,
      );
    } catch (error) {
      box.append(errorNote(error.message));
      return;
    }

    // Mirroring is by PROJECTION, not by transform: `scale(-1,1)` would reverse
    // the digits too. The page direction is `<html dir>`, which `applyLanguage`
    // sets from the string table itself — a layout fact, not a translated one,
    // and the one piece of the drawing that has to be read from the document.
    // Re-read per draw rather than closed over: the language can change between
    // one focus and the next without this screen being rebuilt.
    const drawing = egoDrawing(data, document.documentElement.dir === 'rtl');
    box.append(chart(ctx, drawing));
    foot.append(spaced(readout(data, drawing)));
    // An endpoint no column holds is a response this layout cannot honour, and
    // the one thing it must not do is quietly draw the rest. Reported in the
    // refusal register the screen already uses for a server that said no.
    const lost = drawing.undrawnEdges + drawing.undrawnNodes;
    if (lost > 0) {
      foot.append(errorNote(
        `${drawing.undrawnEdges} edge(s) and ${drawing.undrawnNodes} node(s) in this response ` +
        'name an id the ego layout could not place, and are not in the drawing above',
      ));
    }
  };

  // The picker goes ABOVE the plate, because it decides what the plate holds.
  // The default is the first item by id — what this screen has always drawn.
  card.insertBefore(focusPicker(ctx, items.items, draw), box);
  await draw(items.items[0].id);
}

/**
 * **The focus picker. It is a READ and it is built like one.**
 *
 * A `<label>` and a `<select>`, and nothing else: no compose block, no confirm,
 * no Execute. Choosing which item to look at writes nothing, so there is no
 * approval boundary here to cross and building one would teach a reader that
 * this screen can change their corpus.
 *
 * **Every option is an id and nothing else**, which is `gr.note`'s rule for
 * this whole screen — *"Nodes carry ids, not titles"* — held one element
 * further out than the SVG. An `<option>` cannot hold a `<span>`, so the
 * isolation an id needs inside RTL prose cannot be built out of elements here;
 * `dir="ltr"` on the `<select>` is the attribute form of the same thing, and it
 * is why the served `title` is not appended beside the id.
 *
 * **`change`, not `input`.** A `<select>` fires `input` on every keyboard
 * arrow while the list is open, so `input` would fetch a graph per keystroke
 * on the way to the id a reader was actually walking towards.
 *
 * The bar's layout is set through CSSOM: the server sends `style-src 'self'`
 * with no `'unsafe-inline'`, so no `style` attribute can be written here — the
 * constraint `parts.js` records for its own `spaced()`.
 */
function focusPicker(ctx, items, draw) {
  const bar = el('div');
  bar.style.setProperty('display', 'flex');
  bar.style.setProperty('gap', '8px');
  bar.style.setProperty('align-items', 'center');
  bar.style.setProperty('flex-wrap', 'wrap');
  bar.style.setProperty('margin-block-end', '8px');

  const label = el('label', 'small');
  label.htmlFor = 'egofocus';
  label.append(...ctx.t('gr.focus'));

  const picker = el('select');
  picker.id = 'egofocus';
  // An id is data, not prose. `.m`'s `direction:ltr` cannot reach inside an
  // `<option>`, and this attribute is what keeps the list readable under `א`.
  picker.dir = 'ltr';
  for (const item of items) {
    const option = el('option', null, item.id);
    option.value = item.id;
    picker.append(option);
  }
  picker.addEventListener('change', () => { void draw(picker.value); });

  bar.append(label, picker);
  return bar;
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

/**
 * **The whole picture, as data, before one element exists.**
 *
 * `data` is `/api/graph`'s body verbatim and `rtl` is the page direction; the
 * return value is every coordinate, class and label the chart will carry, plus
 * the count of anything the response named and this layout could not place.
 * No `document` is touched, which is what lets `test/ui/graph-screen.test.ts`
 * assert that an edge leaves its OWN node's box and arrives at its OWN
 * target's — the fact a parity gate counting element kinds is blind to.
 *
 * **Both facts on an edge are the server's** (`type` is the relation
 * vocabulary, `loadBearing` is `isLoadBearing(type)` called in `/api/graph`),
 * and `edgeClass` turns the pair into the legend's three line styles here in
 * the browser without re-listing one word of that vocabulary.
 */
export function egoDrawing(data, rtl = false) {
  const X = (u) => (rtl ? W - u : u);
  const px = (x, width) => (rtl ? W - x - width : x);

  const placed = layoutGraph(data.nodes, data.edges, data.focus);
  // `at` is the whole reason an edge can find its ends: `layoutGraph` answers
  // in ITS order, not the response's, so an edge's two ids are resolved
  // through this index rather than by position in either array.
  const at = new Map(placed.map((p) => [p.id, p]));
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

  // Rows within a column, in `layoutGraph`'s (relation type, id) order.
  const yOf = (p) => spread(perColumn[p.x], p.y);

  // The column captions, one per occupied column, carrying the SIGNED depth
  // rather than a sentence: the middle one is the declared key `gr.lfocus` and
  // only `chart()` holds a `ctx` to resolve it with.
  const captions = [];
  const captionSeen = new Set();
  for (const p of placed) {
    if (captionSeen.has(p.x)) continue;
    captionSeen.add(p.x);
    captions.push({ depth: Math.sign(p.depth), x: X(colX(p.x) + NW / 2), y: CAPTION_Y });
  }

  // **HOW AN EDGE FINDS ITS TWO ENDPOINTS.** `edge.from` and `edge.to` are ids,
  // and each is looked up in `at` to get the column/row the layout gave THAT
  // id — never an index into `data.nodes`, whose order is the server's walk
  // order and not the layout's. The curve then leaves the trailing side of the
  // earlier column's box and arrives at the leading side of the later one, so
  // both ends land on a box edge rather than under a label; `forward` is what
  // makes that true for a relation that points leftward as well as rightward.
  const edges = [];
  let undrawnEdges = 0;
  for (const edge of data.edges) {
    const a = at.get(edge.from);
    const b = at.get(edge.to);
    // An id no column holds cannot be routed to, and guessing a coordinate for
    // it would draw a line to a place nothing is. Counted, and said out loud
    // by `render` — the previous `continue` lost it without a trace.
    if (a === undefined || b === undefined) { undrawnEdges += 1; continue; }
    const forward = a.x <= b.x;
    const x1 = forward ? colX(a.x) + NW : colX(a.x);
    const x2 = forward ? colX(b.x) : colX(b.x) + NW;
    const y1 = yOf(a);
    const y2 = yOf(b);
    const mx = (x1 + x2) / 2;
    edges.push({
      from: edge.from,
      to: edge.to,
      // Every edge carries its relation TYPE, because "broken" and "how much it
      // matters" are two different facts (`gr.note`). A relation type is the
      // vocabulary's own word and is not translated anywhere in the mockup.
      type: edge.type,
      cls: `edge ${edgeClass(edge)}`,
      d: `M ${X(x1)} ${y1} C ${X(mx)} ${y1} ${X(mx)} ${y2} ${X(x2)} ${y2}`,
      labelX: X(mx),
      labelY: (y1 + y2) / 2 - 5,
    });
  }

  const nodes = [];
  for (const p of placed) {
    // `layoutGraph` places the focus whether or not the response listed it, and
    // an unlisted id is exactly the "target not in corpus" the legend names —
    // so it is drawn as MISSING rather than read off an undefined.
    const node = byId.get(p.id) ?? { id: p.id, status: null, missing: true };
    const y = yOf(p);
    const state = egoNodeClass(node, data.focus);
    nodes.push({
      id: p.id,
      cls: state === '' ? 'node' : `node ${state}`,
      x: px(colX(p.x), NW), y: y - NH / 2, width: NW, height: NH,
      labelX: X(colX(p.x) + NW / 2), labelY: y + 3.5,
      label: p.id.length > ID_MAX ? `${p.id.slice(0, ID_MAX - 1)}…` : p.id,
    });
  }
  // A served node the walk from the focus never reaches has no column either.
  // Same rule as an unroutable edge: counted, never quietly absent.
  const undrawnNodes = data.nodes.filter((node) => !at.has(node.id)).length;

  // The cap dropped nodes, and saying so is not optional — `gr.sub` promises
  // "a hard cap of 60 nodes with an explicit '+N more'". The mockup writes the
  // word `more` as an unkeyed ternary and paints it with an inline
  // `fill:'var(--warn)'`; the fill is left to the stylesheet through
  // `text.nid.more` and only the word is transcribed.
  //
  // **The class was right and the rule was missing.** The original reason given
  // here — "a custom property cannot resolve in a presentation attribute" — is
  // not true, and was measured false on the live corpus 2026-08-29: the comb's
  // `<circle fill="var(--gold)">` computes rgb(232,195,104). What is true is
  // stronger: a presentation attribute loses to `svg.chart text{fill:var(
  // --dim)}`, so an attribute here would have drawn grey no matter what it
  // named. `text.nid.more` itself was never declared until 2026-08-29
  // (`styles.css` ~1563), so this word drew as an ordinary id until then.
  let more = null;
  if (data.omitted > 0) {
    const lastColumn = columns - 1;
    const y = spread(perColumn[lastColumn], perColumn[lastColumn] - 1);
    more = {
      cls: 'node more',
      x: px(colX(lastColumn), NW), y: y - NH / 2, width: NW, height: NH,
      labelX: X(colX(lastColumn) + NW / 2), labelY: y + 3.5,
      label: `+${data.omitted} more`,
    };
  }

  return { width: W, height, columns, captions, edges, nodes, more, undrawnEdges, undrawnNodes };
}

/**
 * The drawing turned into elements, and nothing else decided here.
 *
 * EDGES FIRST, so a node box is never drawn under its own connectors — the
 * mockup's own order, and the reason `egoDrawing` keeps the two lists apart.
 */
function chart(ctx, drawing) {
  const svg = sv('svg', {
    viewBox: `0 0 ${drawing.width} ${drawing.height}`,
    // `width`/`height` ARE THE CHART'S NATURAL SIZE, and they are load-bearing.
    // `svg.chart` says `max-inline-size:100%` and no longer `inline-size:100%`,
    // so the used width is this element's own INTRINSIC width — which is what
    // these two presentation attributes supply. Without them an `<svg>` that
    // carries only a viewBox has a ratio and no intrinsic size and the browser
    // falls back to 300x150. The mockup's `chart()` factory writes the same two
    // (mockup ~4193); `block-size:auto` in the stylesheet overrides the height
    // one on purpose, so the ratio is recomputed on the narrow-card case.
    width: drawing.width,
    height: drawing.height,
    class: 'chart',
    role: 'img',
    // An accessible name is an ATTRIBUTE, so no element could survive here and
    // no key declares this sentence: the mockup writes it as a ternary too.
    'aria-label': 'Relation ego-graph: columns by direction, relation type on every edge',
  });

  // `gr.lfocus` is a declared key and is used for the middle column; the two
  // direction captions are written in the mockup's own script as unkeyed
  // `HEB ? … : …` ternaries, so they are transcribed as its English and raised
  // in this task's report — dropping them would leave the reader unable to tell
  // which column points which way, which is the entire claim this layout makes.
  // An SVG `<text>` cannot hold an element, so `tFlat` is the sink here whatever
  // the renderer does.
  const CAPTION = {
    '-1': 'these point at the focus',
    '1': 'the focus points at these',
  };
  for (const caption of drawing.captions) {
    const text = caption.depth === 0 ? ctx.tFlat('gr.lfocus') : CAPTION[String(caption.depth)];
    if (text === undefined) continue;
    svg.append(svText({ x: caption.x, y: caption.y, 'text-anchor': 'middle' }, text));
  }

  for (const edge of drawing.edges) {
    svg.append(sv('path', { class: edge.cls, d: edge.d }));
    svg.append(svText(
      { x: edge.labelX, y: edge.labelY, 'text-anchor': 'middle', class: 'rel' }, edge.type,
    ));
  }

  for (const node of [...drawing.nodes, ...(drawing.more === null ? [] : [drawing.more])]) {
    svg.append(sv('rect', {
      class: node.cls, x: node.x, y: node.y, width: node.width, height: node.height, rx: 4,
    }));
    svg.append(svText(
      {
        x: node.labelX, y: node.labelY, 'text-anchor': 'middle',
        class: node.cls === 'node more' ? 'nid more' : 'nid',
      },
      node.label,
    ));
  }
  return svg;
}

/**
 * **What this picture is of, and how far it reaches.**
 *
 * Five numbers in the endpoint's own vocabulary — `focus`, `radius`, `nodes`,
 * `edges`, `omitted` — and not one translated word, for the same reason a
 * relation type is drawn untranslated: these are `/api/graph`'s parameter and
 * field names, literals rather than prose, so no string key is invented for
 * them and neither table gains one.
 *
 * It exists because three different absences look identical without it. A
 * focus with no relations draws one box; a focus whose neighbours all sit past
 * `radius=1` draws one box; a screen whose edge code was never written draws
 * one box. `edges=0` beside `radius=1` separates the first two from the third
 * on sight, and `omitted` says outright that a graph is a partial view — the
 * one thing the "+N more" node cannot say when the cap dropped nothing.
 *
 * One `span.m` rather than five: `.m` is `direction:ltr; unicode-bidi:isolate`,
 * and an id set loose in an RTL paragraph is the bidi defect this whole screen
 * keeps titles out of its SVG to avoid.
 */
function readout(data, drawing) {
  const p = el('p', 'small');
  p.append(mono(
    `focus=${data.focus} · radius=${RADIUS} · nodes=${data.nodes.length}` +
    ` · edges=${data.edges.length} · drawn=${drawing.edges.length} · omitted=${data.omitted}`,
  ));
  return p;
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
