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
 * ── WHAT HAS LANDED, AND WHAT IS STILL DELIBERATELY REFUSED ───────────────
 *
 * `screens/simulate.js` now draws all four cards the mockup's `simulate`
 * section shows. The spill ratio (`#ratio`, `sim.ratio` / `sim.ration`) landed
 * first, once `GET /api/watch/ratio` exposed `audit_item.role` through
 * `topItems` — the source it had been refused over. **`plan:walk seq:7` then
 * landed the admission staircase and the threshold ladder** (`#stair`,
 * `#ladder`; `sim.stair`, `sim.stairn`, `sim.thresh`, `sim.snap`), reading the
 * one endpoint that unblocked them: `GET /api/simulate/sweep`, one server-side
 * call that runs the real selector at every cumulative candidate cost and
 * returns the whole rung list, so no N+1 round trip and no second
 * implementation of `fitToBudget` were ever needed.
 *
 * It did NOT add the readout that sits between the staircase and the ladder,
 * and the module's header gives the reason at length. The short form: its
 * NUMBERS are all in the `/api/simulate` response this screen already reads,
 * but its WORDS are English and Hebrew literals in the mockup's own script,
 * under no `data-t`, so no key in either string table carries them, and
 * `strings-parity` fails a key the design of record does not declare. That
 * refusal is unrelated to the sweep and outlives it.
 *
 * Asserted below rather than only asserted here in prose: the last test pins
 * the kinds the module does and does not build, so the day `#readout` gets a
 * `data-t`, THIS file is what goes red and says its two remaining entries may
 * come out.
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

/**
 * `document.createElementNS` — the staircase's `sv(tag, attrs)` calls it, the
 * same three-line factory `screens/graph.js` and `screens/decay.js` already
 * carry. The stand-in does not distinguish namespaces (nothing here asks it
 * to draw an HTML element and an SVG element of the same tag name), so it
 * delegates straight to `element()`.
 */
const doc = {
  createElement: element,
  createElementNS: (_ns: string, tag: string): FakeElement => element(tag),
  createTextNode: textNode,
  // `drawStair`/`drawLadder` read `document.documentElement.dir` to decide
  // whether to mirror — the same source `applyLanguage` (`app.js`) sets it
  // from in a real page. Every render here is English, so `'ltr'` is the
  // right constant rather than a stand-in for one.
  documentElement: { dir: 'ltr' },
};

// ── The modules, loaded the way the browser loads them ──────────────────────

interface LabelMark { x: number; y: number; text: string; rank: number }
interface PlacedLabel { x: number; y: number; anchor: string; text: string }

interface SimulateModule {
  render: (root: FakeElement, ctx: unknown) => Promise<void>;
  /** The two density decisions, pinned with no `document` in the room. */
  axisTicks: (max: number, span: number) => number[];
  placeLabels: (
    marks: LabelMark[], left: number, right: number, off: number, cap: number,
  ) => { labels: PlacedLabel[]; omitted: number };
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

/** `/api/simulate/sweep`'s body, exactly `apiSimulateSweep` serves. */
function sweepBody(
  tier: string, rungs: { threshold: number; count: number; evicted: string[] }[],
): unknown {
  return { tier, tiersRun: [tier], candidateCount: rungs.length, truncated: false, rungs };
}

/**
 * A three-rung sweep with a genuine eviction (2 → 1) — the mockup's own demo
 * shape, *"more budget, fewer items"* — and a LAST rung past the 12,000 floor
 * and the 1,800 `jit` budget `simulateBody` fixes below, so the slider-bound
 * test can tell "the sweep set the bound" from "the floor or the budget in
 * force happened to be large enough anyway".
 */
const JIT_RUNGS = [
  { threshold: 0, count: 0, evicted: [] },
  { threshold: 600, count: 2, evicted: [] },
  { threshold: 15_000, count: 1, evicted: ['RULE-crowded-out-by-the-big-one'] },
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
  // The screen opens on `jit`, and only `jit` is ever asked for here — the
  // other three tiers' sweeps are exercised by `read-model.test.ts` directly
  // against the real endpoint, not re-fixtured a second time in this file.
  if (route.startsWith('/api/simulate/sweep?')) {
    if (!route.includes('tier=jit')) {
      throw new Error(`this fixture only sweeps jit; asked for ${route}`);
    }
    return sweepBody('jit', JIT_RUNGS);
  }
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

/**
 * Renders into a stand-in `<section>`, recording every route the screen read.
 *
 * `interact`, when given, runs AFTER the initial render has fully settled and
 * BEFORE the stand-in `document` is torn down — the only place a test can
 * fire `slider.oninput()` or a tier button's `onclick()` and have the DOM
 * calls those handlers make (`el()`, `sv()`, `document.documentElement.dir`)
 * land on a live stand-in rather than on `undefined`. Its own async work is
 * drained the same one-macrotask-turn way the initial render's is, for the
 * same reason.
 */
async function draw(
  api: (route: string) => Promise<unknown>, lang = 'en',
  interact?: (root: FakeElement) => void,
): Promise<Drawn> {
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
  await withDocument(async () => {
    await render(root, ctx);
    // `render()` fires `runSweep()` (and, before it, the ratio fetch) WITHOUT
    // awaiting them — deliberately, so a slow or failed sweep never holds up
    // the fits table `render()` itself already served. Both must still settle
    // here, before `withDocument`'s `finally` tears the stand-in `document`
    // down: a continuation that fired after teardown reads `document` as
    // `undefined` and throws from inside a promise nothing here is holding,
    // which surfaces as an unhandled rejection attributed to a LATER test
    // rather than a failure of this one. One macrotask turn is enough — the
    // fixtures below have no real I/O latency, so every `await ctx.api(...)`
    // they touch resolves within a microtask of being called.
    await new Promise((resolve) => { setTimeout(resolve, 0); });
    if (interact !== undefined) {
      interact(root);
      // `slider.oninput` debounces its own `run()` behind a real 150ms
      // `setTimeout` (`pending = setTimeout(...)`), which a bare 0ms flush
      // does not wait out — that timer firing AFTER `document` is torn down
      // below is exactly the delayed-`ReferenceError` this margin exists to
      // prevent. 200ms clears it with room to spare.
      await new Promise((resolve) => { setTimeout(resolve, 200); });
    }
  });
  return { root, routes };
}

// ── Walking the result ──────────────────────────────────────────────────────

/**
 * `tag.class1.class2`, classes sorted — `screen-parity.spec.ts`'s own form,
 * `getAttribute('class')` and all: an HTML element built by `el(tag, cls)`
 * carries its class on `.className`, but `sv(tag, attrs)` sets `class` the
 * same way every other SVG attribute is set — `setAttribute` — because a real
 * SVG element's `.className` is an `SVGAnimatedString`, not a plain string,
 * which is the exact defect `COLLECT_KINDS`'s own header measured and fixed
 * in the real gate on 2026-08-23. This stand-in would reproduce that defect
 * (reading every `<svg>`, `<path>`, `<line>`, `<circle>` and `<text>` here as
 * bare and classless) if it read only `.className`.
 */
function kindOf(node: FakeNode): string {
  const attrs = (node as Partial<FakeElement>).attributes;
  const raw = (attrs?.['class'] ?? node.className).trim();
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
  const { tFlat } = await i18n();

  // `<div class="card pane"><h3 data-t="sim.ratio"><div class="plate" id="ratio">
  //  <p class="small" style="margin-block-start:8px" data-t="sim.ration">`
  //
  // TWO or "card pane", not three: `plan:walk seq:7` gave the staircase and
  // ladder their own `<div class="card pane sim">` — a DIFFERENT kind
  // (`div.card.pane.sim`, asserted in the ledger test below), because the
  // mockup draws it with a third class the other two cards do not carry. The
  // fits table and this ratio card are what is left in the bare `card pane`
  // bucket, and this card is still the LAST of them.
  const cards = byKind(root, 'div.card.pane');
  const card = cards.at(-1)!;
  assert.equal(cards.length, 2, 'the simulator no longer draws two bare "card pane" cards');
  assert.deepEqual(card.children.map(kindOf), ['h3', 'div.plate', 'p.small']);
  assert.equal(flatText(card.children[0]!), en['sim.ratio']);
  // `tFlat` and not a local `replace(/\{m:…\}/)`: that hand-rolled flattener
  // knew one marker of five, so the day emphasis landed it compared rendered
  // text against a template still carrying `{b:…}` and failed for a reason
  // that had nothing to do with this card. The grammar has one parser.
  assert.equal(flatText(card.children[2]!), tFlat(en, 'sim.ration', {}));

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
  // and is still perfectly true. A shared catch would have blanked it. One row
  // per tier in `TIERS`, which is five since the continuity tier landed.
  assert.equal(byKind(root, 'tbody')[0]!.children.length, 5);
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

// ── The sweep: the staircase, the ladder, snapping and the slider bound ─────

/**
 * `JIT_RUNGS`'s three thresholds, `sim.snap`'s promise made concrete:
 * *"the slider snaps to rungs — dragging lands on meaning rather than on
 * {offrung}"*. Dragging to 900 (nearer 600 than 15,000 or 0) must land
 * exactly on 600, and dragging to 15,000 minus one token must land on 600
 * too, not on 15,000 — the snap picks the CLOSEST rung, not the next one up.
 */
test('the slider snaps to the nearest rung on every drag tick', async () => {
  const results: string[] = [];
  await draw(RICH, 'en', (root) => {
    const slider = byKind(root, 'input')[0] as unknown as { value: string; oninput: () => void };
    assert.ok(slider !== undefined, 'no <input> was drawn');

    slider.value = '900';
    slider.oninput();
    results.push(slider.value);

    slider.value = '9000';
    slider.oninput();
    results.push(slider.value);

    slider.value = '300';
    slider.oninput();
    results.push(slider.value);
  });
  assert.deepEqual(results, ['600', '15000', '0'], [
    '900 is closer to 600 than to 0 or 15,000;',
    '9000 is closer to 15,000 than to 600;',
    '300 is equidistant from 0 and 600 and falls to the first candidate — ',
    "Array.reduce's own tie rule, the same one the mockup's renderStair inherits.",
  ].join(' '));
});

/**
 * `sliderMaxFor`'s three terms, exercised through the one seam that assigns
 * them (`applyBound`) rather than through the private function itself.
 * `JIT_RUNGS`'s last rung (15,000) is larger than both the 12,000 floor and
 * the 1,800 `jit` budget `simulateBody` fixes — deliberately, so this proves
 * the SWEEP actually set the bound rather than one of the other two terms
 * happening to be large enough on their own.
 */
test('the slider bound is the swept last rung once it exceeds the floor and the budget in force', async () => {
  const { root } = await draw(RICH);
  const slider = byKind(root, 'input')[0] as unknown as { max: string };
  assert.equal(slider.max, '15000');
});

/**
 * The ladder, row for row: three rungs in `JIT_RUNGS`, in ascending order,
 * the middle one carrying no eviction and the last one carrying the mark
 * `sim.snap` promises — *"A red rung is an eviction: more budget, fewer
 * items."* `.at` marks whichever rung is at or below the budget being
 * dragged; the screen opens on `budgets.jit` (1,800 from `simulateBody`),
 * which sits between the second and third rung, so the SECOND rung — not the
 * third — is the one currently in force.
 */
test('the ladder draws one row per rung, the eviction in red and the current one gold', async () => {
  const { root } = await draw(RICH);
  const rows = byKind(root, 'div.ladder.plate')[0]!.children;
  assert.equal(rows.length, JIT_RUNGS.length);

  assert.deepEqual(rows.map(kindOf), ['div', 'div.at', 'div.ev']);
  assert.deepEqual(rows.map((r) => flatText(r)), ['00 items', '6002 items', '15,000▼ 1 items']);
});

/* ── DENSITY — `plan:walk seq:62` ────────────────────────────────────────────
   The staircase drew a y tick per integer and the word `eviction` once per
   eviction, unconditionally. Measured in a browser at 1440x900 against three
   corpora, at an identical 1.6x render scale in every one:

       surface           rungs   y ticks   eviction words   overlapping pairs
       the mockup            6         7                1                   0
       this repository      18        19              ~15                many
       .demo-corpus       ~400        43              169                1881

   Scale was eliminated first and is not the defect. The two functions below
   are the fix, and they are pure functions of numbers precisely so this file
   can hold them to it — the same reason `screens/graph.js` exports
   `egoDrawing` and `screens/decay.js` exports `combTicks`. The rendering
   tests that follow then check that the staircase actually calls them, which
   a unit test of the helpers alone would not.
   ─────────────────────────────────────────────────────────────────────────── */

/**
 * **The design of record's own case must not move**, and this is the assertion
 * that says so: at the mockup's six rungs the step is 1 and the answer is
 * `0..6`, which is the unconditional loop the change replaced, value for
 * value. Everything past that is the thinning.
 */
test('the y axis thins to a nice step, and does not thin the mockup\'s own six', async () => {
  const { axisTicks } = await simulate();
  const span = 162; // STAIR_H - STAIR_PT - STAIR_PB

  assert.deepEqual(axisTicks(6, span), [0, 1, 2, 3, 4, 5, 6]);
  assert.deepEqual(axisTicks(1, span), [0, 1]);
  assert.deepEqual(axisTicks(8, span), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  // Eighteen — the shape the owner photographed. Nineteen ticks become five.
  assert.deepEqual(axisTicks(18, span), [0, 5, 10, 15, 18]);
  // Four hundred and two — `.demo-corpus`. The last multiple is dropped rather
  // than printed two units from the maximum.
  assert.deepEqual(axisTicks(402, span), [0, 50, 100, 150, 200, 250, 300, 350, 402]);
  // A maximum that IS a multiple is not repeated.
  assert.deepEqual(axisTicks(40, span), [0, 5, 10, 15, 20, 25, 30, 35, 40]);

  // Whatever the count, no two ticks are closer than TICKGAP, the maximum is
  // always drawn, and the axis never runs away with itself.
  for (let max = 1; max <= 600; max += 1) {
    const ticks = axisTicks(max, span);
    assert.equal(ticks[0], 0, `axis for ${max} does not start at 0`);
    assert.equal(ticks[ticks.length - 1], max, `axis for ${max} does not reach its maximum`);
    assert.ok(ticks.length <= 10, `axis for ${max} drew ${ticks.length} ticks`);
    for (let i = 1; i < ticks.length; i += 1) {
      const gap = ((ticks[i]! - ticks[i - 1]!) * span) / max;
      assert.ok(gap >= 20, `axis for ${max} put ${ticks[i - 1]} and ${ticks[i]} ${gap} apart`);
    }
  }
});

/**
 * The annotation rule, in the two halves that matter: **no two labels may
 * overlap** — which is the defect, stated as a property — and **nothing is
 * dropped in silence**, so `omitted` accounts for every mark that did not get
 * one. The `rank` ordering is what decides which survive, so the biggest drops
 * keep their word rather than whichever came first along the axis.
 */
test('eviction labels are capped, collision-free, inside the plot, and counted', async () => {
  const { placeLabels } = await simulate();
  const [left, right, off, cap] = [32, 546, 7, 3];

  // One mark is the mockup's own picture: it is labelled, and nothing is owed.
  const one = placeLabels([{ x: 300, y: 90, text: 'eviction', rank: 1 }], left, right, off, cap);
  assert.equal(one.omitted, 0);
  assert.deepEqual(one.labels, [{ x: 307, y: 90, anchor: 'start', text: 'eviction' }]);

  // A hundred and sixty-nine of them, all at one height — the `.demo-corpus`
  // shape. Three words, a hundred and sixty-six accounted for, none touching.
  const many = [];
  for (let i = 0; i < 169; i += 1) many.push({ x: 40 + i * 3, y: 90, text: 'eviction', rank: i % 4 });
  const dense = placeLabels(many, left, right, off, cap);
  assert.equal(dense.labels.length, cap);
  assert.equal(dense.omitted, 169 - cap);
  for (let i = 0; i < dense.labels.length; i += 1) {
    for (let j = i + 1; j < dense.labels.length; j += 1) {
      const a = dense.labels[i]!;
      const b = dense.labels[j]!;
      const box = (l: PlacedLabel): [number, number] => (l.anchor === 'start'
        ? [l.x, l.x + l.text.length * 6]
        : [l.x - l.text.length * 6, l.x]);
      const [a1, a2] = box(a);
      const [b1, b2] = box(b);
      assert.ok(a2 <= b1 || b2 <= a1 || Math.abs(a.y - b.y) >= 12,
        `${JSON.stringify(a)} and ${JSON.stringify(b)} overlap`);
    }
  }

  // The rank decides, not the axis order: the one drop worth naming keeps its
  // word even though five nearer the origin were offered first.
  const ranked = placeLabels(
    [0, 1, 2, 3, 4, 5].map((i) => ({ x: 40 + i * 8, y: 90, text: 'eviction', rank: i === 5 ? 9 : 1 })),
    left, right, off, 1,
  );
  assert.deepEqual(ranked.labels.map((l) => l.x), [40 + 5 * 8 + off]);

  // A mark against the reading end turns its label around rather than running
  // it off the chart — `screens/decay.js`'s `badpinOutward` rule.
  const edge = placeLabels([{ x: 540, y: 90, text: 'eviction', rank: 1 }], left, right, off, cap);
  assert.deepEqual(edge.labels, [{ x: 533, y: 90, anchor: 'end', text: 'eviction' }]);

  // And one with room on neither side is given up rather than drawn wrong.
  const boxed = placeLabels([{ x: 100, y: 90, text: 'eviction', rank: 1 }], 90, 110, off, cap);
  assert.deepEqual(boxed.labels, []);
  assert.equal(boxed.omitted, 1);
});

/** A sweep dense enough to need thinning, built the way a real one arrives. */
function denseRungs(steps: number): { threshold: number; count: number; evicted: string[] }[] {
  const rungs = [{ threshold: 0, count: 0, evicted: [] as string[] }];
  let count = 0;
  for (let i = 1; i <= steps; i += 1) {
    const down = i % 3 === 0 && count > 1;
    count = down ? count - 1 : count + 1;
    rungs.push({
      threshold: i * 280,
      count,
      evicted: down ? [`RULE-crowded-out-at-rung-${i}`] : [],
    });
  }
  return rungs;
}

/**
 * The staircase over a real-sized sweep, drawn: this is what a unit test of
 * `axisTicks` and `placeLabels` on their own cannot say, and it is the half
 * the browser suite has never covered — `e2e/*.spec.ts` drives `openMockup()`,
 * whose staircase is six hand-authored sample points, so the app has never
 * been photographed drawing a chart over a corpus with many rungs.
 */
test('a dense sweep draws a thinned axis, three callouts and the count of the rest', async () => {
  const rungs = denseRungs(48);
  const evictions = rungs.filter((r) => r.evicted.length > 0).length;
  assert.ok(evictions >= 15, `the fixture must be dense; it has ${evictions} evictions`);

  const { root } = await draw(async (route) => (route.startsWith('/api/simulate/sweep?')
    ? sweepBody('jit', rungs)
    : RICH(route)));

  const svg = byKind(root, 'svg.chart')[0] as FakeElement | undefined;
  assert.ok(svg !== undefined, 'no staircase was drawn');
  // Every eviction keeps its MARKER — the marker is the datum. Only the word
  // is rationed.
  assert.equal(all(svg, (n) => n.tag === 'circle').length, evictions);

  const words = all(svg, (n) => n.textContent === 'eviction');
  assert.equal(words.length, 3, 'the callout cap is three');

  const foot = all(svg, (n) => n.textContent.endsWith(' more evictions'));
  assert.deepEqual(foot.map((n) => n.textContent), [`+${evictions - 3} more evictions`]);
  // The disclosure gets a row of its own, so the plot's own geometry is
  // untouched by having something to say.
  assert.equal(svg.attributes['viewBox'], '0 0 560 214');

  // The y axis: nine ticks at most for seventeen admitted, never eighteen.
  // `text.mono` separates them from the eviction callouts, which carry no
  // class, and `text-anchor` from the x axis's own (`middle`) and from the
  // dragged budget's label (`start`).
  const maxN = Math.max(...rungs.map((r) => r.count));
  const yTicks = all(svg, (n) => kindOf(n) === 'text.mono'
    && (n as Partial<FakeElement>).attributes?.['text-anchor'] === 'end');
  assert.ok(yTicks.length <= 9, `the y axis drew ${yTicks.length} ticks for ${maxN} items`);
  assert.equal(yTicks[yTicks.length - 1]!.textContent, String(maxN));
});

/**
 * And the design of record's own picture, unmoved: three rungs, one eviction,
 * the word beside it, no disclosure line, and the `0 0 560 200` viewBox this
 * chart has always carried. A density rule that changed THIS would be a
 * regression against `docs/design/web-ui-mockup.md`'s appearance rule.
 */
test('a sparse sweep is drawn exactly as it was before the density rule', async () => {
  const { root } = await draw(RICH);
  const svg = byKind(root, 'svg.chart')[0] as FakeElement | undefined;
  assert.ok(svg !== undefined, 'no staircase was drawn');

  assert.equal(svg.attributes['viewBox'], '0 0 560 200');
  assert.equal(all(svg, (n) => n.textContent === 'eviction').length, 1);
  assert.deepEqual(all(svg, (n) => n.textContent.endsWith(' more evictions')), []);
  // `JIT_RUNGS` tops out at two admitted, so the axis is 0, 1, 2 — untouched.
  assert.deepEqual(
    all(svg, (n) => kindOf(n) === 'text.mono'
      && (n as Partial<FakeElement>).attributes?.['text-anchor'] === 'end')
      .map((n) => n.textContent),
    ['0', '1', '2'],
  );
});

/**
 * The `index` tier never asks the server for a sweep at all — it is out of
 * scope by construction (`apiSimulateSweep` refuses it; per-line costs, not
 * per-item), and the screen draws its own absent state locally rather than
 * sending a request the endpoint would 400 on.
 */
test('the index tier never requests a sweep, and draws the staircase absent', async () => {
  const { root, routes } = await draw(async (route) => {
    // The screen opens on `jit`, so ITS sweep is expected and legitimate —
    // only a sweep naming `tier=index` is the defect this test exists to
    // catch, and the fixture throws on exactly that one.
    if (route.startsWith('/api/simulate/sweep') && route.includes('tier=index')) {
      throw new Error(`the index tier must never request a sweep; asked for ${route}`);
    }
    return RICH(route);
  }, 'en', (drawnRoot) => {
    const tierPick = byKind(drawnRoot, 'div.segbar')[0]!;
    const indexButton = tierPick.children.find((c) => flatText(c) === 'index') as
      { onclick: () => void } | undefined;
    assert.ok(indexButton !== undefined, 'no index button was drawn');
    indexButton.onclick();
  });

  assert.deepEqual(routes.filter((r) => r.includes('tier=index')), []);
  assert.deepEqual(byKind(root, 'div.ladder.plate')[0]!.children, []);
});

/**
 * **The ledger, as a set of literals, in both directions.**
 *
 * `e2e/screen-parity.spec.ts` records element kinds absent from this screen
 * and fails BOTH ways: a gap it does not list is a regression, and an entry
 * that is no longer missing is a ledger that rotted. It measures a real
 * browser over `.demo-corpus`, which this file cannot do and does not pretend
 * to. What it CAN do is name, per kind, which of three things is true — and
 * that is the distinction `plan:port seq:98` exists to make.
 *
 * **`plan:walk seq:7` landed the staircase and the ladder**, so the twenty-one
 * this file used to partition move almost entirely out of ABSENT: only the
 * readout — refused for its own, separate reason, unchanged by this task — and
 * `div.small`, which is that readout's own "next in at …" line and nothing
 * else on this screen, are still ones the module cannot build at all.
 *
 * So the twenty-one are partitioned here, exhaustively, and the partition is
 * checked against two renders:
 *
 *   CLOSED — built unconditionally by this task's card.
 *   DATA   — the module builds them, and whether they APPEAR depends on the
 *            corpus. Both are drawn under `RICH` and neither under `LEAN`,
 *            which is the proof: no code changed between those two renders.
 *            `RICH`'s `jit` sweep carries a genuine eviction, which is what
 *            lets `div.ev` and the eviction mark's `circle`/bare `text` join
 *            this bucket rather than CLOSED — a sweep with no eviction in it
 *            would draw the staircase and the ladder and still owe those
 *            three kinds nothing.
 *   ABSENT — the module cannot build them at all: the readout, and the one
 *            line that lives only inside it.
 *
 * The three lists must together be exactly the twenty-one, and each must hold
 * of both renders. The day `#readout` gets a `data-t`, THIS is the assertion
 * that goes red and says the last two entries may come out.
 */
const CLOSED = [
  'h3',
  // The staircase and ladder's own containers, built once per render whether
  // or not any tier has a candidate to sweep: the two plain columns
  // (`stairCol`, `ladderCol`), the card that holds them, and the ladder's own
  // (always-present, sometimes-empty) plate.
  'div', 'div.card.pane.sim', 'div.ladder.plate',
  // `sim.snap`'s own `{offrung}` — the mockup's illustrative "6,050" — is
  // supplied UNCONDITIONALLY (`render`'s own header explains why a static
  // illustrative number is correct here rather than one derived from data),
  // so this is the one `<span class="v">` that does not wait on `sim.chipn`'s
  // live ratio. `span.v` therefore moved out of DATA the day the ladder's own
  // note started rendering: a kind is CLOSED the moment ANY one of its
  // callers draws it unconditionally, whatever the others still depend on.
  'span.v',
];

const DATA = [
  // The diverging bars: present when `/api/watch/ratio` answers with rows,
  // absent when the projection is behind (503) or was never built (no rows).
  'div.div-l', 'div.div-r', 'div.div-row', 'i', 'span.div-n', 'span.div-name',
  // The fits chip in its spilled state — `sim.chipn`'s own two `{v}` runs
  // join `span.v` above now that it is CLOSED for an unrelated reason; this
  // chip still needs a tier that spills, which needs the DRAGGED tier to have
  // been reached by one of the two events, and `jit` is reached only by
  // `tool`, which needs a walked file.
  'span.chip.warn',
  // The staircase itself: an SVG built from `GET /api/simulate/sweep`'s
  // `rungs`, drawn only once a tier actually has candidates to sweep (`jit`
  // needs the same walked file the fits table's `jit` row needs) — `LEAN`
  // draws none of it, for the same underlying reason it draws no `jit` row.
  // Bare `circle` and bare `text` specifically: the mockup's eviction mark is
  // an UNCLASSED `<circle>` and its "eviction" label an UNCLASSED `<text>`
  // (`renderStair`, mockup ~4087-4090) — every OTHER text run on this chart
  // carries `.mono` — so both need `RICH`'s sweep to contain a genuine
  // eviction, not merely a non-empty one.
  'circle', 'text',
  // The ladder's rows: `.ev` is a rung whose count fell from the one before
  // it, and `.at` is the highest rung at or below the budget being dragged.
  // `.at` needs only a non-empty sweep; `.ev`, like the eviction mark above,
  // needs a genuine eviction in it.
  'div.at', 'div.ev',
];

const ABSENT = [
  // The readout between the staircase and the ladder — refused for the
  // reason the module header gives at length, unchanged by this task: its
  // WORDS are unkeyed English/Hebrew literals in the mockup's own script,
  // under no `data-t`, so no key in either string table carries them.
  'div.readout',
  // The readout's own "next in at …" line, and nowhere else on this screen
  // that class is drawn — it is absent for exactly the reason its parent is.
  'div.small',
  // **Bare `svg`, `line` and `path` — structurally, not by omission.** Every
  // `<svg>`, `<line>` and `<path>` `renderStair` ever draws carries a class
  // (`chart`; `axis`, `defline` or `nowline`; `step` — mockup ~3890-4095,
  // checked exhaustively: there is no classless call to `sv('svg'|'line'|
  // 'path', …)` anywhere in the mockup's script), and this module copies that
  // rather than inventing a bare instance the design of record does not draw.
  // So these three kinds can never legitimately appear as BARE tags from a
  // correct build — closing `line.axis`/`line.defline`/`line.nowline`/
  // `svg.chart`/`path.step` (which this task did) is the real completion of
  // the gap the bare forms were standing in for. Recorded in this task's
  // report rather than silently reclassified: `e2e/screen-parity.spec.ts`'s
  // own `KNOWN_GAPS.simulate` still lists these three bare forms alongside
  // the classed ones it added on 2026-08-23 for the SAME elements, which
  // reads as the same stale-measurement artifact this comment describes.
  'svg', 'line', 'path',
];

test('the twenty-one ledger kinds partition into closed, data-dependent and absent', async () => {
  const rich = renderedKinds((await draw(RICH)).root);
  const lean = renderedKinds((await draw(LEAN)).root);

  // The partition is exhaustive and disjoint, checked against the ledger's own
  // twenty-one so that a name dropped from one list cannot hide in another.
  const LEDGER = [
    'circle', 'div', 'div.at', 'div.card.pane.sim', 'div.div-l', 'div.div-r',
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
