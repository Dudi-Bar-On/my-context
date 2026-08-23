/**
 * `screens/simulate.js` — the **Budget simulator** — measured against the
 * design of record, in Node, with no browser.
 *
 * **THE LIMIT, stated first and not papered over.** Spec §6 puts the DOM glue
 * in `app.js` and `screens/*.js` outside the tested surface, and
 * `test/ui/viewmodel.test.ts`'s own header says so in the same words: *"A green
 * run here verifies the view-models, not the pixels."* Nothing below checks a
 * pixel, a stylesheet rule, an event or anything the real `Document` does that
 * a forty-line stand-in does not. What it does check is the half of this screen
 * that is a DECISION: which card is drawn, out of which endpoint's fields, with
 * which of the mockup's own marks on it — and, in the last test, exactly which
 * element KINDS the module can and cannot produce, which is the number
 * `e2e/screen-parity.spec.ts` holds a shrink-only ledger of.
 *
 * ── WHAT THIS TASK ADDED, AND WHAT IT DELIBERATELY DID NOT ────────────────
 *
 * It added the mockup's THIRD card — the spill ratio (`#ratio`, `sim.ratio` /
 * `sim.ration`), the diverging bar whose long red half names which budget is
 * too small. `screens/simulate.js` refused it when it shipped, on the grounds
 * that its source — `audit_item.role` through `topItems` — *"is the audit
 * projection, which no route in this plan exposes"*. `GET /api/watch/ratio`
 * now exposes precisely that, and its own header says it was built for this
 * chart. A refusal whose reason expired is not a standing decision.
 *
 * It did NOT add the admission staircase, the threshold ladder or the readout
 * that sits between them, and the module's header gives both reasons at
 * length. The short forms, because a reader of this file will want them:
 *
 *   - The staircase and the ladder are a SWEEP, no endpoint answers a sweep,
 *     and the N+1 alternative is an unmade request-volume decision tracked as
 *     `TASK-the-admission-staircase-needs-a-sweep-response-or-a-ruling`
 *     (`plan:ui1 seq:17c`), which is OPEN. That task also rules that
 *     `sim.stairn` and `sim.snap` *"return with it"*.
 *   - The readout's NUMBERS are all in the `/api/simulate` response this screen
 *     already reads. Its WORDS are English and Hebrew literals in the mockup's
 *     script under no `data-t`, so no key in either string table carries them,
 *     and `strings-parity` fails a key the design of record does not declare.
 *
 * Both are asserted below rather than only asserted here in prose: the last
 * test pins the kinds the module does not build, so the day either lands, THIS
 * file is what goes red and says the ledger entry may come out.
 *
 * ── HOW A BROWSER MODULE THAT IMPORTS `/screens/parts.js` IS IMPORTED ──────
 *
 * `screens/simulate.js` is a plain browser ES module and its imports are
 * ROOT-ABSOLUTE — `/lib/viewmodel.js`, `/screens/parts.js` — because that is
 * what the browser resolves against the server's document root. Node resolves
 * the same specifier against the filesystem root, which on Windows keeps the
 * parent's drive letter and does not exist. So this file registers a
 * synchronous resolve hook mapping a root-absolute specifier onto
 * `src/ui/public/`, exactly as `src/ui/server.ts` serves it — the same hook,
 * for the same reason, as `test/ui/tut-screen.test.ts` and the five other
 * screen tests. It does not fake `parts.js`: the composites under test are the
 * mockup's shapes, and a stub of them would assert this file's idea of the
 * design rather than the shipped one.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// ── The stand-in document ───────────────────────────────────────────────────

/** A stand-in node: an element, or a run of text. Text carries no tag. */
interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  children: FakeNode[];
}

function textNode(text: string): FakeNode {
  return { tag: '#text', className: '', textContent: text, children: [] };
}

/**
 * The members `screens/parts.js`, `lib/i18n.js` and `screens/simulate.js`
 * touch on an element, and no more than that on purpose: a fuller fake would
 * invite tests this file has no business running. `attributes` is a plain
 * record rather than a setter with behaviour, because the only thing anything
 * here asks of it is what was written and under which name.
 */
interface FakeElement extends FakeNode {
  value: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  style: {
    declarations: Record<string, string>;
    setProperty: (name: string, value: string) => void;
  };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
}

function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    value: '',
    dataset: {},
    attributes: {},
    children: [],
    style: {
      declarations,
      setProperty: (name: string, value: string): void => { declarations[name] = value; },
    },
    append: (...nodes: (FakeNode | string)[]): void => {
      for (const child of nodes) node.children.push(typeof child === 'string' ? textNode(child) : child);
    },
    replaceChildren: (...nodes: (FakeNode | string)[]): void => {
      node.children.length = 0;
      node.append(...nodes);
    },
    setAttribute: (name: string, value: string): void => { node.attributes[name] = value; },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

// ── The modules, loaded the way the browser loads them ──────────────────────

interface SimulateModule {
  render: (root: FakeElement, ctx: unknown) => Promise<void>;
}

interface I18nModule {
  t: (
    strings: Record<string, string>,
    key: string,
    subs: Record<string, string | number>,
    document: typeof doc,
  ) => FakeNode[];
  tFlat: (strings: Record<string, string>, key: string, subs: Record<string, string | number>) => string;
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

const simulate = (): Promise<SimulateModule> => browserModule<SimulateModule>('screens', 'simulate.js');
const i18n = (): Promise<I18nModule> => browserModule<I18nModule>('lib', 'i18n.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

// ── The two responses this screen reads ─────────────────────────────────────

/**
 * `/api/simulate`, in the shape `read-model.ts` serves — `selection`,
 * `budgets`, `costs` and `tiersRun`. Only the fields `countFor` reads are
 * filled: `costs` rides along because the response carries it, and leaving it
 * out would make this fixture a claim about the endpoint that is not true.
 */
function simulateBody(
  tiersRun: string[], full: { tier: string }[], spilled: { tier: string }[],
): unknown {
  return {
    selection: {
      full, spilled, index: { normative: [], truncated: 0 },
    },
    budgets: { pinned: 2400, jit: 1800, restored: 2400, index: 900 },
    costs: [],
    tiersRun,
  };
}

/** `/api/watch/ratio`'s `rows`, exactly `RatioRow[]`. */
const RATIO_ROWS = [
  { id: 'STD-api-errors-use-problem-json', delivered: 3, spilled: 41 },
  { id: 'INV-markdown-is-the-source-of-truth', delivered: 12, spilled: 22 },
  { id: 'RULE-posix-normalized-paths', delivered: 17, spilled: 0 },
  { id: 'KNOWN-a-tally-that-filled-its-window', delivered: null, spilled: 4 },
];

/**
 * **The rich corpus**: a walked file exists, so the `tool` event runs and the
 * `jit` row is real; `jit` spills, so the fits chip is `warn` and `sim.chipn`
 * has a ratio to quote; the audit projection is fresh and holds both roles.
 *
 * Every kind this screen is CAPABLE of drawing is drawn under it. That is what
 * makes the two data-dependent ledger entries measurable rather than argued.
 */
const RICH = async (route: string): Promise<unknown> => {
  if (route === '/api/coverage') return { files: [{ path: 'src/index.ts' }] };
  if (route === '/api/watch/ratio') return { rows: RATIO_ROWS, roleWindow: 1000, truncated: true, projectionState: 'fresh' };
  if (route.startsWith('/api/simulate?')) {
    return route.includes('event=tool')
      ? simulateBody(['jit'], [{ tier: 'jit' }, { tier: 'jit' }], [{ tier: 'jit' }])
      : simulateBody(['pinned', 'restored', 'index'], [{ tier: 'pinned' }], []);
  }
  throw new Error(`the simulator asked for ${route}, which this fixture does not serve`);
};

/**
 * **The lean corpus**, and it is not hypothetical: it is `.demo-corpus`, the
 * deterministic corpus `e2e/app.ts` serves the parity gate over, as measured
 * on 2026-08-23. `/api/coverage` walks no files there, so no `tool` event can
 * run and the `jit` row — the tier this screen opens on — is drawn absent;
 * nothing spills at its configured budgets; and its audit projection is BEHIND
 * its log, which `/api/watch/ratio` answers with a 503 rather than a partial
 * history.
 */
const LEAN = async (route: string): Promise<unknown> => {
  if (route === '/api/coverage') return { files: [] };
  if (route === '/api/watch/ratio') {
    throw new Error(
      'the audit projection is behind relative to its log, and this endpoint may not catch it up',
    );
  }
  if (route.startsWith('/api/simulate?')) {
    return simulateBody(['pinned', 'restored', 'index'], [{ tier: 'pinned' }], []);
  }
  throw new Error(`the simulator asked for ${route}, which this fixture does not serve`);
};

// ── Rendering ───────────────────────────────────────────────────────────────

/**
 * Installs the stand-in `document` for the duration of one call and removes it
 * again — a global left behind would make any later test in this process think
 * it is in a browser. `screens/parts.js` reaches for the GLOBAL `document`
 * (`el()` is the mockup's own factory, argument for argument, and the mockup
 * runs in a browser), so it has to be installed rather than passed.
 */
async function withDocument<T>(body: () => Promise<T>): Promise<T> {
  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  try {
    return await body();
  } finally {
    if (!had) delete globals.document;
  }
}

interface Drawn { root: FakeElement; routes: string[] }

/** Renders into a stand-in `<section>`, recording every route the screen read. */
async function draw(api: (route: string) => Promise<unknown>, lang = 'en'): Promise<Drawn> {
  const { render } = await simulate();
  const { t, tFlat } = await i18n();
  const strings = (await table(lang)).strings;
  const routes: string[] = [];
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(strings, key, subs, doc),
    tFlat: (key: string, subs: Record<string, string | number> = {}) => tFlat(strings, key, subs),
    api: (route: string) => { routes.push(route); return api(route); },
    session: () => 'cold',
    // The screen registers one; nothing here fires it, and a stand-in that
    // threw would fail on registration rather than on use.
    onSessionChange: () => {},
  };
  const root = element('section');
  await withDocument(async () => { await render(root, ctx); });
  return { root, routes };
}

// ── Walking the result ──────────────────────────────────────────────────────

/** `tag.class1.class2`, classes sorted — `screen-parity.spec.ts`'s own form. */
function kindOf(node: FakeNode): string {
  const raw = node.className.trim();
  return raw === '' ? node.tag : `${node.tag}.${raw.split(/\s+/).sort().join('.')}`;
}

/** Every element kind under `root`, same form, text nodes excluded. */
function renderedKinds(root: FakeNode): Set<string> {
  const kinds = new Set<string>();
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text') continue;
      kinds.add(kindOf(child));
      walk(child);
    }
  };
  walk(root);
  return kinds;
}

function all(root: FakeNode, predicate: (node: FakeNode) => boolean): FakeNode[] {
  const found: FakeNode[] = [];
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (predicate(child)) found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

/** A node's text, its descendants folded in — what a reader would see. */
function flatText(node: FakeNode): string {
  if (node.tag === '#text') return node.textContent;
  return node.textContent + node.children.map(flatText).join('');
}

const byKind = (root: FakeNode, kind: string): FakeNode[] =>
  all(root, (node) => kindOf(node) === kind);

// ── The design of record ────────────────────────────────────────────────────

const MOCKUP = readFileSync(path.join(REPO, 'docs', 'design', 'web-ui-mockup.html'), 'utf8');

// ── The tests ───────────────────────────────────────────────────────────────

test('the spill-ratio card is the mockup\'s third card, mark for mark', async () => {
  const { root } = await draw(RICH);
  const en = (await table('en')).strings;

  // `<div class="card pane"><h3 data-t="sim.ratio"><div class="plate" id="ratio">
  //  <p class="small" style="margin-block-start:8px" data-t="sim.ration">`
  const cards = byKind(root, 'div.card.pane');
  const card = cards.at(-1)!;
  assert.equal(cards.length, 3, 'the simulator no longer draws three cards');
  assert.deepEqual(card.children.map(kindOf), ['h3', 'div.plate', 'p.small']);
  assert.equal(flatText(card.children[0]!), en['sim.ratio']);
  assert.equal(flatText(card.children[2]!), en['sim.ration'].replace(/\{m:([^}]*)\}/g, '$1'));

  // The note takes its margin through CSSOM and not a `style` attribute: the
  // server sends `style-src 'self'` with no `'unsafe-inline'`, so the mockup's
  // own `style="margin-block-start:8px"` is the one thing on this card that may
  // NOT be transcribed literally.
  const note = card.children[2] as FakeElement;
  assert.equal(note.style.declarations['margin-block-start'], '8px');
  assert.equal(note.attributes['style'], undefined);
});

test('a bar is the mockup\'s four cells, normalised over the largest count in the table', async () => {
  const { root } = await draw(RICH);
  const rows = byKind(root, 'div.div-row');
  // Four data rows and the key row beneath them.
  assert.equal(rows.length, RATIO_ROWS.length + 1);

  const first = rows[0]!;
  assert.deepEqual(first.children.map(kindOf), ['span.div-name', 'div.div-l', 'div.div-r', 'span.div-n']);
  assert.equal(first.children[0]!.textContent, 'STD-api-errors-use-problem-json');
  // `.div-name` ellipsises, so the full id has to survive in the `title`.
  assert.equal((first.children[0] as FakeElement).attributes['title'], 'STD-api-errors-use-problem-json');
  assert.equal(flatText(first.children[3]!), '3/41');

  // 41 is the largest count in EITHER half of ANY row, so it sets the scale for
  // both halves of every row — which is what `sim.ration` promises ("both
  // normalised to the largest count in the table") and is the whole difference
  // between a chart you can read across rows and four rows drawn against
  // themselves. A per-row maximum would put a full-width bar on every line.
  const width = (half: FakeNode): string | undefined =>
    (half.children[0] as FakeElement | undefined)?.style.declarations['inline-size'];
  assert.equal(width(first.children[1]!), `${(3 / 41) * 100}%`);
  assert.equal(width(first.children[2]!), '100%');
  assert.equal(width(rows[1]!.children[1]!), `${(12 / 41) * 100}%`);
});

test('a zero half draws no bar, and an unmeasured half draws no bar and says so', async () => {
  const { root } = await draw(RICH);
  const rows = byKind(root, 'div.div-row');

  // `RULE-posix-normalized-paths` spilled zero times. The mockup draws no `<i>`
  // for it, and neither does this: `.div-r i` carries a border and a hatch, so
  // a zero-width one is a mark on the screen where nothing happened.
  const zero = rows[2]!;
  assert.equal(flatText(zero.children[3]!), '17/0');
  assert.deepEqual(zero.children[2]!.children, []);
  assert.equal(zero.children[1]!.children.length, 1, 'the delivered half of a zero-spill row still draws');

  // A `null` is the OTHER thing: `spillRatio` answers `null` where a role tally
  // filled its window, so the count is below a cutoff and UNKNOWN. Drawing it
  // as a zero-length bar would put a full delivered history on screen as an
  // empty one — the silent drop this project keeps paying for. `—` is the same
  // mark the fits table already uses for a tier neither event reached.
  const unmeasured = rows[3]!;
  assert.equal(flatText(unmeasured.children[3]!), '—/4');
  assert.deepEqual(unmeasured.children[1]!.children, []);
  assert.equal(unmeasured.children[2]!.children.length, 1);
});

test('the key row borrows two keys that exist rather than inventing two that do not', async () => {
  const { root } = await draw(RICH);
  const en = (await table('en')).strings;
  const he = (await table('he')).strings;

  const key = byKind(root, 'div.div-row').at(-1)!;
  // An empty cell, the two words under their own halves, an empty cell — the
  // mockup's own `key.append(el('span'), el('span','div-n',…), el('span',null,…), el('span'))`.
  assert.deepEqual(key.children.map(kindOf), ['span', 'span.div-n', 'span', 'span']);
  assert.equal(flatText(key.children[1]!), en['preview.delivered']);
  assert.equal(flatText(key.children[2]!), en['sim.spills']);

  // The mockup writes both words as bare literals in its script, under no
  // `data-t`, so this screen has no key of its own for them and may not invent
  // one — `strings-parity.test.ts` fails a key the design of record does not
  // declare. These two are already declared, already on screen elsewhere, and
  // in HEBREW they are the mockup's legend VERBATIM. That last part is what
  // makes the borrowing faithful rather than convenient, so it is measured
  // against the mockup here instead of asserted in prose.
  const legendWord = (english: string): string => {
    const found = new RegExp(`HEB\\?'([^']*)':'${english}'`).exec(MOCKUP);
    assert.ok(found, `the mockup's renderRatio no longer writes '${english}'`);
    return found[1]!;
  };
  assert.equal(he['preview.delivered'], legendWord('delivered'));
  assert.equal(he['sim.spills'], legendWord('spilled'));
  for (const k of ['preview.delivered', 'sim.spills', 'sim.ratio', 'sim.ration']) {
    assert.ok(Object.hasOwn(en, k), `en.js does not declare ${k}`);
    assert.ok(Object.hasOwn(he, k), `he.js does not declare ${k}`);
  }
});

test('the ratio is read once, and follows neither the slider nor the tier picker', async () => {
  const { routes } = await draw(RICH);
  // History does not change when a budget does. One request, and the two
  // `/api/simulate` calls beside it are the fits table's, not this card's.
  assert.equal(routes.filter((r) => r === '/api/watch/ratio').length, 1);
  assert.equal(routes.filter((r) => r.startsWith('/api/simulate?')).length, 2);
});

test('a refused projection draws the server\'s words INSTEAD of the bars, and leaves the table standing', async () => {
  const { root } = await draw(LEAN);

  // `.plate` holds the refusal and nothing else. An endpoint that refused and a
  // projection holding no spills are two facts; the second draws an empty
  // plate, which is why the refusal may not be drawn beside one.
  const plate = byKind(root, 'div.card.pane').at(-1)!.children[1]!;
  assert.deepEqual(plate.children.map(kindOf), ['p.small.spill']);
  assert.match(flatText(plate.children[0]!), /the audit projection is behind/);
  assert.equal(byKind(root, 'div.div-row').length, 0);

  // The fits table is served by a DIFFERENT endpoint reading a DIFFERENT store
  // and is still perfectly true. A shared catch would have blanked it.
  assert.equal(byKind(root, 'tbody')[0]!.children.length, 4);
});

test('an empty projection draws an empty plate and no legend — absence is not a refusal', async () => {
  const { root } = await draw(async (route) => (
    route === '/api/watch/ratio'
      ? { rows: [], roleWindow: 1000, truncated: false, projectionState: 'absent' }
      : LEAN(route)
  ));
  const plate = byKind(root, 'div.card.pane').at(-1)!.children[1]!;
  // Not a refusal note, and not a legend for bars that are not there.
  assert.deepEqual(plate.children, []);
});

/**
 * **The ledger, as a set of literals, in both directions.**
 *
 * `e2e/screen-parity.spec.ts` records twenty-two element kinds absent from this
 * screen and fails BOTH ways: a gap it does not list is a regression, and an
 * entry that is no longer missing is a ledger that rotted. It measures a real
 * browser over `.demo-corpus`, which this file cannot do and does not pretend
 * to. What it CAN do is name, per kind, which of three things is true — and
 * that is the distinction `plan:port seq:98` exists to make and which the spec
 * says has not been done for most entries.
 *
 * So the twenty-two are partitioned here, exhaustively, and the partition is
 * checked against two renders:
 *
 *   CLOSED — built unconditionally by this task's card.
 *   DATA   — the module builds them, and whether they APPEAR depends on the
 *            corpus. Both are drawn under `RICH` and neither under `LEAN`,
 *            which is the proof: no code changed between those two renders.
 *   ABSENT — the module cannot build them at all. The staircase, the ladder,
 *            the readout, and the two emphasis runs no string table can carry.
 *
 * The three lists must together be exactly the twenty-two, and each must hold
 * of both renders. When the sweep ruling lands, or a fourth run marker, or the
 * `#readout` gets a `data-t`, THIS is the assertion that goes red and says the
 * ledger entry may come out.
 */
const CLOSED = ['h3'];

const DATA = [
  // The diverging bars: present when `/api/watch/ratio` answers with rows,
  // absent when the projection is behind (503) or was never built (no rows).
  'div.div-l', 'div.div-r', 'div.div-row', 'i', 'span.div-n', 'span.div-name',
  // The fits chip in its spilled state, and `sim.chipn`'s two `{v}` runs. The
  // chip needs a tier that spills; the runs need the DRAGGED tier to have been
  // reached by one of the two events, and `jit` is reached only by `tool`,
  // which needs a walked file.
  'span.chip.warn', 'span.v',
];

const ABSENT = [
  // The staircase: an SVG chart of a sweep no endpoint answers.
  'circle', 'line', 'path', 'svg', 'text',
  // Its card and the two columns inside it, the ladder, and the readout that
  // sits between them — all of them wait on the same ruling.
  'div', 'div.at', 'div.card.pane.sim', 'div.ev', 'div.ladder.plate',
  'div.readout', 'div.small',
  // `lib/i18n.js`'s run grammar has `{m:}`, `{mv:}` and `{name}` and NO
  // emphasis marker, so a mockup string whose English bolds or italicises a run
  // renders flat and no string table can carry the difference. `b` is six runs
  // across `sim.sub`, `sim.stairn`, `sim.snap`, `sim.chipn`, `sim.evict` and
  // `sim.ration`; tracked as
  // TASK-the-string-grammar-has-no-bold-run-so-three-of-the-mockup.
  //
  // **`i` is NOT here, and that is a correction rather than an omission.** It
  // reads as the same defect and is not one: the mockup's simulate section
  // italicises nothing. Every `<i>` on this screen is a BAR — `.div-l i` and
  // `.div-r i` are the two halves of the diverging chart — so `i` is a graphic
  // this task built, and it sits under DATA above with the rest of that card.
  'b',
];

test('the twenty-two ledger kinds partition into closed, data-dependent and absent', async () => {
  const rich = renderedKinds((await draw(RICH)).root);
  const lean = renderedKinds((await draw(LEAN)).root);

  // The partition is exhaustive and disjoint, checked against the ledger's own
  // twenty-two so that a name dropped from one list cannot hide in another.
  const LEDGER = [
    'b', 'circle', 'div', 'div.at', 'div.card.pane.sim', 'div.div-l', 'div.div-r',
    'div.div-row', 'div.ev', 'div.ladder.plate', 'div.readout', 'div.small', 'h3',
    'i', 'line', 'path', 'span.chip.warn', 'span.div-n', 'span.div-name', 'span.v',
    'svg', 'text',
  ];
  assert.deepEqual([...CLOSED, ...DATA, ...ABSENT].sort(), [...LEDGER].sort());

  for (const kind of CLOSED) {
    assert.ok(rich.has(kind), `${kind} is listed CLOSED but the rich render does not draw it`);
    assert.ok(lean.has(kind), `${kind} is listed CLOSED but a lean corpus loses it — it is DATA`);
  }
  for (const kind of DATA) {
    assert.ok(rich.has(kind), `${kind} is listed DATA but no corpus draws it — it is ABSENT`);
    assert.ok(!lean.has(kind), `${kind} is listed DATA but is drawn regardless — it is CLOSED`);
  }
  for (const kind of ABSENT) {
    assert.ok(!rich.has(kind), `${kind} is listed ABSENT but the module now draws it`);
  }
});
