/**
 * The Relations screen's EDGES — the one thing the parity gate cannot check.
 *
 * `e2e/screen-parity.spec.ts` compares the KINDS of element a screen draws
 * against its mockup section. That comparison is blind twice over here. It
 * cannot see a class on an SVG element at all (`el.className` is an
 * `SVGAnimatedString`, not a string, so every node and every edge collapses to
 * the bare tag `rect` / `path`), and even if it could, a count of `path`
 * elements says nothing about whether a given edge arrives at its own two
 * nodes. A chart that drew every relation as a line from the top-left corner
 * to the bottom-right one would pass that gate exactly.
 *
 * So this file asserts the ROUTING, coordinate by coordinate, against the
 * mockup's own numbers rather than against a second set that happens to look
 * similar: three columns at x=8 / 345 / 682 in a 900-wide box, the focus row
 * at y=131 (`fY = H/2+6` in the mockup's own script), and the in/out rows at
 * the `spread()` values its `EGO` fixture produces. The fixture below is
 * ISOMORPHIC to that fixture — same focus, same five neighbours, same relation
 * types, same `more: 2` — so every expectation here is a number the design of
 * record already draws.
 *
 * ── WHY `egoDrawing` AND NOT THE DOM ──────────────────────────────────────
 *
 * Spec §6 names `screens/*.js` as the untested surface, and
 * `test/ui/work-screen.test.ts` states the rule this file follows: no stand-in
 * `document` is supplied, because supplying one lets a test drift into testing
 * the glue. `screens/graph.js` therefore computes the whole picture as data in
 * `egoDrawing()` and its `chart()` does nothing but turn that list into
 * elements — so everything worth asserting is reachable in Node, and what is
 * left in the glue is a loop over a list.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE ───────────────────────────────────
 *
 * `screens/graph.js` imports by the specifiers the BROWSER resolves
 * (`/lib/viewmodel.js`, `/screens/parts.js`), which Node would resolve from
 * the drive root. Its bytes are read, those two specifiers are rewritten to
 * `file://` URLs, and the result is imported as a `data:` module — the same
 * mechanism, and the same COUNTED rewrite, that `work-screen.test.ts` uses. A
 * rewrite that silently missed one would import a different module graph than
 * the browser runs, which is the only way this file could pass while testing
 * the wrong thing. Neither dependency touches a DOM at module scope.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const GRAPH_JS = path.join(PUBLIC, 'screens', 'graph.js');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const graphSource = readFileSync(GRAPH_JS, 'utf8');

/** `/api/graph`'s body, as `src/ui/read-model.ts` declares it. */
interface GraphNode {
  id: string; title: string | null; type: string | null;
  status: string | null; missing: boolean;
}
interface GraphEdge {
  from: string; to: string; type: string; dangling: boolean; loadBearing: boolean;
}
interface GraphBody {
  focus: string; nodes: GraphNode[]; edges: GraphEdge[]; omitted: number;
}

/** One routed relation. `d` is the SVG path, `cls` the legend's line style. */
interface DrawnEdge {
  from: string; to: string; type: string; cls: string; d: string;
  labelX: number; labelY: number;
}
interface DrawnNode {
  id: string; cls: string; x: number; y: number; width: number; height: number;
  labelX: number; labelY: number; label: string;
}
interface Drawing {
  width: number; height: number; columns: number;
  captions: { depth: number; x: number; y: number }[];
  edges: DrawnEdge[];
  nodes: DrawnNode[];
  more: DrawnNode | null;
  undrawnEdges: number;
  undrawnNodes: number;
}

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface GraphModule {
  egoDrawing: (data: GraphBody, rtl?: boolean) => Drawing;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

/** `from '/lib/viewmodel.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function graphModule(): Promise<GraphModule> {
  let rewritten = 0;
  const text = graphSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 2,
    'expected graph.js to import two browser modules (/lib/viewmodel.js, /screens/parts.js); '
    + `the rewrite matched ${rewritten}. A specifier this pattern cannot see is a module Node `
    + 'would resolve from the drive root, and the import below would fail for a reason that '
    + 'reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as GraphModule;
}

/**
 * **The mockup's own `EGO`, as `/api/graph` would answer it.**
 *
 * Five neighbours around one focus, two pointing at it and three pointed at,
 * one of them dangling and one superseded, with two nodes past the cap. Every
 * expectation in this file is derived from the mockup's script over exactly
 * this shape, so a coordinate that stops matching is a divergence from the
 * design of record rather than from a private opinion about geometry.
 *
 * `loadBearing` and `dangling` are the SERVER's two facts and are written here
 * as the server would compute them (`isLoadBearing('derived_from')` and
 * `isLoadBearing('constrains')` are true, `relates_to` and `refines` are not),
 * never re-derived in the browser — which is the copied-rule defect the whole
 * `/api/graph` contract exists to prevent.
 */
const FOCUS = 'INV-prices-are-integer-cents';
const DEC = 'DEC-money-type-is-integer-cents';
const STD_FLOAT = 'STD-money-never-float';
const RULE_HALF = 'RULE-round-half-even';
const ADR = 'ADR-markdown-plus-disposable-index';
const STD_API = 'STD-api-errors-use-problem-json';

const node = (id: string, over: Partial<GraphNode> = {}): GraphNode => ({
  id, title: id, type: 'rule', status: 'active', missing: false, ...over,
});

function egoBody(): GraphBody {
  return {
    focus: FOCUS,
    nodes: [
      node(FOCUS), node(DEC), node(STD_FLOAT),
      node(RULE_HALF, { title: null, type: null, status: null, missing: true }),
      node(ADR, { status: 'superseded' }),
      node(STD_API),
    ],
    edges: [
      { from: DEC, to: FOCUS, type: 'derived_from', dangling: false, loadBearing: true },
      { from: STD_FLOAT, to: FOCUS, type: 'constrains', dangling: false, loadBearing: true },
      { from: FOCUS, to: RULE_HALF, type: 'constrains', dangling: true, loadBearing: true },
      { from: FOCUS, to: ADR, type: 'relates_to', dangling: false, loadBearing: false },
      { from: FOCUS, to: STD_API, type: 'refines', dangling: false, loadBearing: false },
    ],
    omitted: 2,
  };
}

const edgeTo = (drawing: Drawing, from: string, to: string): DrawnEdge => {
  const found = drawing.edges.filter((e) => e.from === from && e.to === to);
  assert.equal(found.length, 1,
    `expected exactly one drawn edge ${from} -> ${to}; got ${found.length}. `
    + `Drawn: ${JSON.stringify(drawing.edges.map((e) => `${e.from}->${e.to}`))}`);
  return found[0]!;
};

const nodeAt = (drawing: Drawing, id: string): DrawnNode => {
  const found = drawing.nodes.find((n) => n.id === id);
  assert.ok(found !== undefined, `no node drawn for ${id}`);
  return found;
};

/** `M x1 y1 C mx y1 mx y2 x2 y2` taken apart, so the ENDS can be asserted. */
function endpoints(d: string): { x1: number; y1: number; x2: number; y2: number; mx: number } {
  const m = /^M (-?[\d.]+) (-?[\d.]+) C (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+)$/
    .exec(d);
  assert.ok(m !== null, `not the mockup's own cubic form: ${JSON.stringify(d)}`);
  const n = m.slice(1).map(Number);
  assert.equal(n[1], n[3],
    `the first control point must sit on the start row (a flat departure); d=${d}`);
  assert.equal(n[5], n[7],
    `the second control point must sit on the arrival row (a flat arrival); d=${d}`);
  assert.equal(n[2], n[4], `both control points share one x in the mockup's routing; d=${d}`);
  return { x1: n[0]!, y1: n[1]!, mx: n[2]!, x2: n[6]!, y2: n[7]! };
}

test('graph.js exports the drawing and the screen entry point', async () => {
  const mod = await graphModule();
  assert.equal(typeof mod.egoDrawing, 'function');
  assert.equal(typeof mod.render, 'function');
});

test('the ego graph is the mockup\'s own geometry, number for number', async () => {
  const { egoDrawing } = await graphModule();
  const drawing = egoDrawing(egoBody());

  // `W=900`, `H=250`, three columns: the mockup's `renderEgo` constants.
  assert.equal(drawing.width, 900);
  assert.equal(drawing.height, 250);
  assert.equal(drawing.columns, 3);

  // The mockup's `inX / fX / outX`, produced by the even spread rather than
  // copied — a node's LEFT edge is its column's x.
  assert.equal(nodeAt(drawing, STD_FLOAT).x, 8);
  assert.equal(nodeAt(drawing, FOCUS).x, 345);
  assert.equal(nodeAt(drawing, RULE_HALF).x, 682);

  // `fY = H/2 + 6` — the focus row, alone in its column.
  assert.equal(nodeAt(drawing, FOCUS).y + nodeAt(drawing, FOCUS).height / 2, 131);
  // `spread(2, i)` and `spread(4, i)`, the mockup's own two column heights.
  const rowOf = (id: string): number => nodeAt(drawing, id).y + nodeAt(drawing, id).height / 2;
  assert.deepEqual([rowOf(STD_FLOAT), rowOf(DEC)], [82.5, 179.5]);
  assert.deepEqual([rowOf(RULE_HALF), rowOf(STD_API), rowOf(ADR)], [58.25, 106.75, 155.25]);

  // The "+N more" node is a ROW in the last column and takes the fourth slot.
  assert.ok(drawing.more !== null, 'omitted=2 and no "+N more" node was drawn');
  assert.equal(drawing.more.label, '+2 more');
  assert.equal(drawing.more.x, 682);
  assert.equal(drawing.more.y + drawing.more.height / 2, 203.75);
});

test('every edge leaves its own node and arrives at its own target', async () => {
  const { egoDrawing } = await graphModule();
  const body = egoBody();
  const drawing = egoDrawing(body);

  // Nothing served is missing from the drawing, and nothing is invented.
  assert.equal(drawing.edges.length, body.edges.length);
  assert.equal(drawing.undrawnEdges, 0);
  assert.equal(drawing.undrawnNodes, 0);

  // **The assertion this whole file exists for.** For each served relation, the
  // curve starts on the TRAILING side of the from-node's box and ends on the
  // LEADING side of the to-node's box, on those two nodes' own rows. A
  // mis-routed edge — from swapped with to, a row read off the wrong node, an
  // endpoint taken from the response's array order instead of the layout's —
  // moves one of these four numbers and fails here.
  for (const served of body.edges) {
    const drawn = edgeTo(drawing, served.from, served.to);
    const a = nodeAt(drawing, served.from);
    const b = nodeAt(drawing, served.to);
    const { x1, y1, x2, y2, mx } = endpoints(drawn.d);
    const forward = a.x <= b.x;
    assert.equal(x1, forward ? a.x + a.width : a.x,
      `${served.from} -> ${served.to} does not leave the from-node's box edge`);
    assert.equal(x2, forward ? b.x : b.x + b.width,
      `${served.from} -> ${served.to} does not arrive at the to-node's box edge`);
    assert.equal(y1, a.y + a.height / 2,
      `${served.from} -> ${served.to} leaves a row that is not the from-node's`);
    assert.equal(y2, b.y + b.height / 2,
      `${served.from} -> ${served.to} arrives on a row that is not the to-node's`);
    assert.equal(mx, (x1 + x2) / 2, 'the control x is the midpoint of the two box edges');
    // The relation type rides on the curve, halfway along and 5 above it.
    assert.equal(drawn.type, served.type);
    assert.equal(drawn.labelX, mx);
    assert.equal(drawn.labelY, (y1 + y2) / 2 - 5);
  }

  // The four literal paths the mockup's own `edgeAt` writes for this fixture.
  assert.equal(edgeTo(drawing, DEC, FOCUS).d, 'M 218 179.5 C 281.5 179.5 281.5 131 345 131');
  assert.equal(edgeTo(drawing, STD_FLOAT, FOCUS).d, 'M 218 82.5 C 281.5 82.5 281.5 131 345 131');
  assert.equal(edgeTo(drawing, FOCUS, RULE_HALF).d,
    'M 555 131 C 618.5 131 618.5 58.25 682 58.25');
  assert.equal(edgeTo(drawing, FOCUS, ADR).d, 'M 555 131 C 618.5 131 618.5 155.25 682 155.25');
});

test('severity is a class on the edge, and it is the legend\'s three and no fourth', async () => {
  const { egoDrawing } = await graphModule();
  const body = egoBody();
  const drawing = egoDrawing(body);

  // `dangling` outranks `bearing`: a broken load-bearing relation is drawn as
  // broken. `RULE-round-half-even` is both, and must come out dangling.
  assert.equal(edgeTo(drawing, FOCUS, RULE_HALF).cls, 'edge dangling');
  assert.equal(edgeTo(drawing, DEC, FOCUS).cls, 'edge bearing');
  assert.equal(edgeTo(drawing, STD_FLOAT, FOCUS).cls, 'edge bearing');
  assert.equal(edgeTo(drawing, FOCUS, ADR).cls, 'edge ref');
  assert.equal(edgeTo(drawing, FOCUS, STD_API).cls, 'edge ref');

  // Nothing carries an inline stroke, and no class outside the legend's three
  // reaches the stylesheet — `svg.chart .edge.bearing/.ref/.dangling` are the
  // only edge rules the design of record declares.
  const LEGEND = new Set(['edge bearing', 'edge ref', 'edge dangling']);
  for (const drawn of drawing.edges) {
    assert.ok(LEGEND.has(drawn.cls), `edge class outside the legend: ${drawn.cls}`);
    assert.ok(!('stroke' in drawn) && !('style' in drawn),
      'an edge carries a class, never a colour');
  }

  // The node states the legend names, read off the response's own fields.
  assert.equal(nodeAt(drawing, FOCUS).cls, 'node focus');
  assert.equal(nodeAt(drawing, RULE_HALF).cls, 'node missing');
  assert.equal(nodeAt(drawing, ADR).cls, 'node superseded');
  assert.equal(nodeAt(drawing, STD_API).cls, 'node');
});

test('a dangling relation is drawn at both ends, never dropped', async () => {
  const { egoDrawing } = await graphModule();
  const drawing = egoDrawing(egoBody());

  // The server's two facts about a broken relation are `missing: true` on the
  // node and `dangling: true` on the edge, and BOTH are on the chart: the
  // dashed crit line and the dashed crit box it arrives at. This is why
  // `gr.note` says the dangling edges need no separate table.
  const edge = edgeTo(drawing, FOCUS, RULE_HALF);
  const target = nodeAt(drawing, RULE_HALF);
  assert.equal(edge.cls, 'edge dangling');
  assert.equal(target.cls, 'node missing');
  assert.equal(endpoints(edge.d).y2, target.y + target.height / 2,
    'the dangling edge does not arrive at the missing node it names');
  assert.equal(target.label, RULE_HALF, 'the missing target is named by its own id');
});

test('an endpoint no column holds is counted, not silently dropped', async () => {
  const { egoDrawing } = await graphModule();
  const body = egoBody();
  // An edge naming an id this response does not carry as a node. A well-formed
  // `/api/graph` body never contains one — the walk adds a node before it adds
  // the edge that found it — so this is the malformed case, and the screen's
  // obligation is to say so rather than to draw four of five relations and
  // look complete.
  body.edges.push({
    from: FOCUS, to: 'GHOST-not-in-nodes', type: 'relates_to',
    dangling: false, loadBearing: false,
  });
  const drawing = egoDrawing(body);
  assert.equal(drawing.edges.length, 5, 'the unroutable edge must not be drawn');
  assert.equal(drawing.undrawnEdges, 1, 'the unroutable edge must be counted');
  assert.equal(drawing.undrawnNodes, 0);

  // And the mirror: a node the walk from the focus never reaches has no column
  // either, and is counted on its own tally.
  const orphaned = egoBody();
  orphaned.nodes.push(node('ORPHAN-reachable-by-nothing'));
  const second = egoDrawing(orphaned);
  assert.equal(second.undrawnNodes, 1, 'the unreachable node must be counted');
  assert.equal(second.nodes.length, 6, 'and must not be drawn at a guessed coordinate');
});

test('a focus with no relations draws one node, no edges, and nothing lost', async () => {
  const { egoDrawing } = await graphModule();
  // The corpus this project develops against answers exactly this for its first
  // item by id: one node, zero edges. It is the shape the readout beside the
  // chart exists to explain — `edges=0` next to `radius=1` is what separates
  // "this item has no relations" from "this screen cannot draw edges".
  const drawing = egoDrawing({
    focus: FOCUS, nodes: [node(FOCUS)], edges: [], omitted: 0,
  });
  assert.equal(drawing.columns, 1);
  assert.equal(drawing.edges.length, 0);
  assert.equal(drawing.nodes.length, 1);
  assert.equal(drawing.more, null);
  assert.equal(drawing.undrawnEdges, 0);
  assert.equal(drawing.undrawnNodes, 0);
  // One column is CENTRED rather than left at x=8 — `(W - NW) / 2`.
  assert.equal(nodeAt(drawing, FOCUS).x, 345);
  assert.equal(drawing.captions.length, 1);
  assert.equal(drawing.captions[0]!.depth, 0, 'the lone column is the focus column');
});

test('RTL mirrors by projection: x flips, rows do not', async () => {
  const { egoDrawing } = await graphModule();
  const ltr = egoDrawing(egoBody(), false);
  const rtl = egoDrawing(egoBody(), true);

  // A node box is placed by its own width (`px`), so the left edge of the
  // in-column lands where the right edge of the box would be in the mirror.
  assert.equal(nodeAt(ltr, STD_FLOAT).x, 8);
  assert.equal(nodeAt(rtl, STD_FLOAT).x, 900 - 8 - 210);
  // Rows are untouched by direction.
  assert.equal(nodeAt(rtl, STD_FLOAT).y, nodeAt(ltr, STD_FLOAT).y);

  // The edge's two ends are the same two ends, projected — the digits stay
  // upright because nothing is transformed, only computed.
  const there = endpoints(edgeTo(ltr, DEC, FOCUS).d);
  const here = endpoints(edgeTo(rtl, DEC, FOCUS).d);
  assert.equal(here.x1, 900 - there.x1);
  assert.equal(here.x2, 900 - there.x2);
  assert.equal(here.y1, there.y1);
  assert.equal(here.y2, there.y2);
  assert.equal(here.mx, 900 - there.mx);
  // Same relation, same class: direction is layout, never severity.
  assert.equal(edgeTo(rtl, DEC, FOCUS).cls, edgeTo(ltr, DEC, FOCUS).cls);
});

test('an id longer than the mockup\'s truncation is cut the mockup\'s way', async () => {
  const { egoDrawing } = await graphModule();
  const drawing = egoDrawing(egoBody());
  // `id.length > 28 ? id.slice(0, 27) + '…' : id`, verbatim from `nodeAt` in
  // the mockup's own script.
  assert.equal(nodeAt(drawing, ADR).label, `${ADR.slice(0, 27)}…`);
  assert.equal(nodeAt(drawing, ADR).label.length, 28);
  // Exactly 28 characters is NOT truncated — the boundary the mockup draws.
  assert.equal(FOCUS.length, 28);
  assert.equal(nodeAt(drawing, FOCUS).label, FOCUS);
});

test('the screen names every gr.* key the tables declare, and invents none', async () => {
  const en = readFileSync(path.join(PUBLIC, 'strings', 'en.js'), 'utf8');
  const he = readFileSync(path.join(PUBLIC, 'strings', 'he.js'), 'utf8');
  const declared = (table: string): Set<string> => new Set(
    [...table.matchAll(/^\s*'(gr\.[a-z]+)':/gm)].map((m) => m[1]!),
  );
  const enKeys = declared(en);
  assert.deepEqual([...enKeys].sort(), [...declared(he)].sort(),
    'the two string tables disagree about which gr.* keys exist');

  const used = new Set([...graphSource.matchAll(/'(gr\.[a-z]+)'/g)].map((m) => m[1]!));
  for (const key of used) {
    assert.ok(enKeys.has(key), `graph.js names ${key}, which no table declares`);
  }
  for (const key of enKeys) {
    assert.ok(used.has(key), `${key} is declared and this screen never places it`);
  }
});

/* -------------------------------------------------------------------------- *
 * The focus picker — `plan:walk seq:87`.
 *
 * The picker BUILDS elements, so most of what it is can only be seen in a
 * browser: `e2e/graph-focus.spec.ts` drives it against the real fixture and is
 * the authority on what it does. What is checkable here without a `document`
 * is what the SOURCE commits to — that it is a read, that it is wired to the
 * event a keyboard user does not fire on the way past, and that its label is a
 * declared key rather than a literal.
 * -------------------------------------------------------------------------- */

test('the focus picker is a READ: a select, a change handler, and nothing that writes', () => {
  // A `<select>` and a `<label>` for it. Without the `htmlFor` the label names
  // nothing to a screen reader and the control is unlabelled in both languages.
  assert.match(graphSource, /el\('select'\)/,
    'the focus is chosen by a <select>; nothing else on this screen chooses it');
  assert.match(graphSource, /\.htmlFor = 'egofocus'/,
    'the label must name the select, or the picker is unlabelled to a screen reader');
  assert.match(graphSource, /picker\.id = 'egofocus'/);

  // **`change`, not `input`.** A `<select>` fires `input` on every arrow key
  // while its list is open, so `input` would fetch one graph per keystroke on
  // the way to the id the reader was walking towards.
  assert.match(graphSource, /addEventListener\('change'/,
    'the picker listens on change; input fires once per arrow key inside an open list');
  assert.ok(!/addEventListener\('input'/.test(graphSource),
    'an input listener on a <select> refetches on every keystroke through the list');

  // **It writes nothing.** Choosing what to look at is a read, so there is no
  // approval boundary here to cross — and building a compose-then-execute
  // control for it would teach a reader that this screen can change their
  // corpus. `ctx.api` is a GET-only surface on this screen and stays one.
  for (const forbidden of ['commandActions', 'composeCommand', 'method:', 'POST']) {
    assert.ok(!graphSource.includes(forbidden),
      `graph.js names ${forbidden}: the focus picker is a READ and this screen still has no `
      + 'write of any kind');
  }
});

test('the picker is worded by a declared key, and the id inside it is isolated', () => {
  // `gr.focus`, not a literal. The both-directions test above already holds it
  // against both tables; this is the placement.
  assert.match(graphSource, /ctx\.t\('gr\.focus'\)/,
    'the picker label is a string-table key, not an English literal');

  // **An `<option>` cannot hold a `<span>`**, so the bidi isolation every id on
  // this screen gets from `.m` cannot be built out of elements here. `dir` is
  // the attribute form of the same guarantee, and without it a list of ids
  // reorders inside the RTL page.
  assert.match(graphSource, /picker\.dir = 'ltr'/,
    'an id list in a <select> under `א` needs dir="ltr" — .m cannot reach inside an <option>');

  // Ids and never titles, which is `gr.note`'s rule for this whole screen held
  // one element further out than the SVG.
  assert.ok(!/option[\s\S]{0,120}\.title\b/.test(graphSource),
    'an option carries the id alone: gr.note is "Nodes carry ids, not titles"');
});

test('the default focus is unchanged — the first item by id, and the same answer twice', () => {
  assert.match(graphSource, /draw\(items\.items\[0\]\.id\)/,
    'the picker opens on the first item by id, which is what this screen has always drawn: a '
    + 'reader who touches nothing must see what they saw before');
  // The radius is settled and is NOT offerable — `gr.sub` promises "radius 1"
  // and `plan:walk seq:87` rules the question closed. A second picker here
  // would need a second key, and neither table declares one. Counted rather
  // than pattern-matched on a name: the file's own header discusses
  // `graph.radius` by name to say it is deliberately absent.
  assert.equal((graphSource.match(/el\('select'\)/g) ?? []).length, 1,
    'this screen offers ONE control and it chooses the focus; radius stays the endpoint '
    + 'default of 1, which is a separate question settled the other way');
  assert.ok(!/ctx\.t\('gr\.radius'\)/.test(graphSource),
    'no radius string is placed, because neither table declares one');
  assert.match(graphSource, /const RADIUS = 1;/,
    'the radius this screen asks for is a constant it names, and it is sent rather than '
    + 'relied on so the readout states the horizon it actually asked for');
});

test('a focus change replaces the drawing and the readout, and never leaves a stale one', () => {
  // The plate and the foot are emptied at the TOP of the redraw, before the
  // fetch. A refetch that refuses must not leave the previous picture's
  // `focus=…  nodes=…  omitted=…` underneath a refusal about a different id.
  const draw = /const draw = async \(focus\) => \{([\s\S]*?)\n  \};/.exec(graphSource);
  assert.ok(draw !== null, 'graph.js no longer redraws through a single `draw(focus)`');
  const body = draw[1]!;
  const clears = body.indexOf('box.replaceChildren()');
  const footClears = body.indexOf('foot.replaceChildren()');
  const fetches = body.indexOf('ctx.api(');
  assert.ok(clears !== -1 && footClears !== -1 && fetches !== -1);
  assert.ok(clears < fetches && footClears < fetches,
    'the plate and the foot are cleared before the request, so a refusal cannot stand under '
    + 'the previous focus\'s readout');
  assert.match(body, /focus=\$\{encodeURIComponent\(focus\)\}/,
    'the chosen id is what is asked for, and it is encoded');
});

test('no translated string is assigned, and every legend class is the mockup\'s', async () => {
  // Owner ruling A1: `ctx.t()` returns nodes and is APPENDED. A screen that
  // assigns one has flattened its `{m:}` runs into text.
  assert.ok(!/(textContent|innerHTML)\s*=\s*[^;]*ctx\.t\(/.test(graphSource),
    'a translated string is assigned rather than appended (ruling A1)');
  // `tFlat` is for attribute and text-only sinks; here that is the SVG caption
  // and the chart's `aria-label`, neither of which can hold an element.
  assert.ok(!/innerHTML/.test(graphSource), 'graph.js must never touch innerHTML');
  // Measured: this screen needs no CSS of its own. Every class it writes is one
  // the mockup's `<section data-p="graph">` or its stylesheet already declares.
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="graph"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="graph"] section');
  const section = html.slice(start, html.indexOf('</section>', start));
  for (const cls of ['legend', 'focusn', 'missn', 'supn', 'ln bearing', 'ln ref', 'ln dang']) {
    assert.ok(section.includes(`"${cls}"`), `the mockup's graph section has no .${cls}`);
  }
  for (const rule of [
    'svg.chart .node{', 'svg.chart .node.focus{', 'svg.chart .node.missing{',
    'svg.chart .node.superseded{', 'svg.chart .node.more{', 'svg.chart .edge{',
    'svg.chart .edge.bearing{', 'svg.chart .edge.ref{', 'svg.chart .edge.dangling{',
    'svg.chart text.nid{', 'svg.chart text.rel{',
  ]) {
    assert.ok(html.includes(rule),
      `the design of record no longer declares ${rule} — the class this screen writes for it `
      + 'would reach no rule at all, and an SVG with no fill rule paints solid black');
  }
});
