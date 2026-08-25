/**
 * **`screens/gaps.js` drawn against a stand-in document, and measured against
 * the design of record — because the browser gate cannot measure it here.**
 *
 * ── WHY THIS FILE EXISTS AT ALL ────────────────────────────────────────────
 *
 * `e2e/screen-parity.spec.ts` compares every KIND of element the mockup's
 * `<section data-p="gaps">` draws against what the app draws, and holds the
 * difference in a shrink-only ledger. That gate is the authority, and this file
 * does not replace it. What it does is answer the one question the gate is
 * structurally unable to answer: **is a listed gap missing because the CODE
 * cannot draw it, or because the CORPUS gave it nothing to draw?**
 *
 * The gate runs over `.demo-corpus` (`e2e/app.ts` · `the simulated corpus is missing at` · ~110),
 * and that corpus contains `.my_context` and NO REPOSITORY FILES. So
 * `/api/coverage` answers `files: []`, `buildTree` builds an empty root, and
 * `coverageGapRows` names no directory — which is exactly why `td`, `td.m`,
 * `td.small`, `span.v` and `button.icon` sit in that ledger. Every one of them
 * is built by the loop in `screens/gaps.js`, and none of them has anything to
 * be built from. `e2e/app.ts`' own header already names this class of error —
 * *"a parity gate measured against a different corpus reports code gaps that
 * are only data gaps"* — and its answer, a fixture corpus, is somebody else's
 * task (`plan:port seq:9`, and `plan:port seq:99` after it).
 *
 * This file is the cheap half of that answer, in Node, today: it renders the
 * screen TWICE — once from a body that holds a gap, once from a body shaped
 * exactly like `.demo-corpus`' — and asserts the kind set both times. The first
 * render proves the code; the second reproduces the ledger entry line for line,
 * so a change that breaks the empty-corpus rendering fails here rather than in
 * a browser suite this file's own project forbids most agents from running.
 *
 * ── HOW A TYPESCRIPT TEST IMPORTS A BROWSER SCREEN MODULE ─────────────────
 *
 * `screens/gaps.js` imports `'/lib/viewmodel.js'` and `'/screens/parts.js'` —
 * SERVER-ABSOLUTE specifiers, because the browser loads every screen from the
 * UI server's document root and that is the form `app.js`' `SCREENS` table
 * uses. To Node's resolver that is the root of the current drive.
 * `module.registerHooks` maps the two prefixes back onto `src/ui/public/`, so
 * the REAL bytes load, unmodified — the arrangement `test/ui/ask-screen.test.ts`
 * settled on (`test/ui/ask-screen.test.ts` · `maps that one prefix back onto` · ~32),
 * and preferred over rewriting the source into a `data:` module because nothing
 * that passes here can then differ from what a browser runs.
 *
 * Importing the module is itself an assertion: a screen that touched `document`
 * at module scope rather than inside `render()` would throw before the first
 * test ran.
 *
 * ── WHAT THIS FILE STILL CANNOT SAY ───────────────────────────────────────
 *
 * Spec §6's untested surface is the BROWSER — layout, styles, events, bidi. A
 * stand-in document says which elements a module builds and nothing about how
 * they look, so `.m`'s `unicode-bidi:isolate`, the `inline-size:auto` this file
 * asserts is set through CSSOM, and every rule in `styles.css` are outside it.
 * The screenshot and `e2e/screen-parity.spec.ts` remain the only witnesses for
 * those.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('/screens/') || specifier.startsWith('/lib/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

// ── The stand-in document ─────────────────────────────────────────────────
//
// `screens/parts.js` reaches for the GLOBAL `document` — `el()` is the mockup's
// own factory, argument for argument — so the stand-in is installed rather than
// passed, and removed again immediately: a `document` left behind would make any
// later test in this process think it is in a browser.

/** A stand-in node: an element, or a run of text. Text carries no class. */
interface FakeNode {
  tag: string;
  className: string;
  textContent: string;
  hidden: boolean;
  children: FakeNode[];
}

function textNode(text: string): FakeNode {
  return { tag: '#text', className: '', textContent: text, hidden: false, children: [] };
}

/**
 * The members `screens/gaps.js`, `screens/parts.js` and `lib/i18n.js` touch on
 * an element, and deliberately no more: a fuller fake would invite assertions
 * this file has no business making. `listeners` is here for one assertion only
 * — that the Compose button has none — and `attributes` for its opposite, that
 * no `style="…"` attribute is ever written.
 */
interface FakeElement extends FakeNode {
  type: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  listeners: Record<string, unknown[]>;
  style: { declarations: Record<string, string>; setProperty: (n: string, v: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: unknown) => void;
}

function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    hidden: false,
    type: '',
    dataset: {},
    attributes: {},
    listeners: {},
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
    addEventListener: (type: string, listener: unknown): void => {
      (node.listeners[type] ??= []).push(listener);
    },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

/**
 * Installs the stand-in `document` for the duration of one call and removes it
 * again. Nesting is safe: an inner call sees the global already there and
 * leaves it for the outer one to remove.
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

// ── Kinds, in `e2e/screen-parity.spec.ts`' own form ───────────────────────

/** `tag.class1.class2`, classes sorted — the gate's own spelling of a kind. */
function kindOf(tag: string, className: string): string {
  const raw = className.trim();
  return raw === '' ? tag : `${tag}.${raw.split(/\s+/).sort().join('.')}`;
}

/** Every kind under a rendered root, text nodes and hidden subtrees excluded. */
function renderedKinds(root: FakeNode): string[] {
  const kinds = new Set<string>();
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text' || child.hidden === true) continue;
      kinds.add(kindOf(child.tag, child.className));
      walk(child);
    }
  };
  walk(root);
  return [...kinds].sort();
}

/**
 * Every kind `<section data-p="gaps">` draws, read out of the design of record.
 *
 * The section is markup and nothing else — no `hidden` descendant, no closed
 * `<details>`, no `<tbody>` filled by script — so unlike the Ask screen's
 * equivalent this needs none of the three corrections that one carries. What it
 * does still need is to be checked: a parser that silently returned an empty
 * set would make every "the mockup draws this and the app does not" assertion
 * below pass by drawing nothing, which is the failure shape this whole gate
 * exists to end. So the first test asserts the parse itself.
 */
function mockupKinds(): string[] {
  const mockup = readFileSync(MOCKUP, 'utf8');
  const open = mockup.indexOf('<section data-p="gaps"');
  assert.notEqual(open, -1, 'the mockup no longer has a <section data-p="gaps">');
  const close = mockup.indexOf('</section>', open);
  const section = mockup.slice(mockup.indexOf('>', open) + 1, close);

  const kinds = new Set<string>();
  for (const match of section.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/g)) {
    if (match[1] === '/') continue;
    const className = (/class="([^"]*)"/.exec(match[3] ?? '')?.[1] ?? '').trim();
    kinds.add(kindOf(match[2] ?? '', className));
  }
  return [...kinds].sort();
}

// ── The shell's contract, as much of it as this screen may touch ──────────

interface I18nModule {
  t: (
    strings: Record<string, string>, key: string,
    subs: Record<string, string | number>, document: typeof doc,
  ) => FakeNode[];
}

interface GapsModule { render: (root: unknown, ctx: unknown) => Promise<void> }

interface ViewModelModule {
  buildTree: (files: CoverageFile[]) => unknown;
  coverageGapRows: (tree: unknown) => { path: string; files: number }[];
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

/**
 * `ctx`, with `tFlat` wired to THROW.
 *
 * Owner ruling A1 (`src/ui/public/app.js` · `the ONLY renderer` · ~41 —
 * and `lib/i18n.js`'s own header at length): `t()` returns Node[] and is the
 * only renderer; `tFlat` is for attribute and text-only sinks, and "a caller
 * reaching for this to fill an ELEMENT is the bug". **This screen has no
 * attribute sink at all** — no `aria-label`, no `title`, no `<option>` — so
 * every call to `tFlat` from it is that bug, and the fake makes it a failure
 * rather than a review finding.
 */
async function context(api: (route: string) => Promise<unknown>): Promise<unknown> {
  const i18n = await browserModule<I18nModule>('lib', 'i18n.js');
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  return {
    t: (key: string, subs: Record<string, string | number> = {}) => i18n.t(en, key, subs, doc),
    tFlat: (key: string): string => {
      assert.fail(`ruling A1: screens/gaps.js filled an element with tFlat("${key}") — `
        + 'this screen has no attribute sink, so ctx.t() is what fills one');
    },
    api,
  };
}

interface CoverageFile { path: string; governs: string[] }
interface CoverageBody {
  files: CoverageFile[];
  pinned: string[];
  items: unknown[];
  truncated: boolean;
}

/** Renders into a stand-in `<section>`, served the given `/api/coverage` body. */
async function draw(body: CoverageBody): Promise<FakeElement> {
  return await drawFrom(async (route) => {
    assert.equal(route, '/api/coverage', 'this screen reads one endpoint and no other');
    return body;
  });
}

async function drawFrom(api: (route: string) => Promise<unknown>): Promise<FakeElement> {
  const { render } = await browserModule<GapsModule>('screens', 'gaps.js');
  const ctx = await context(api);
  const root = element('section');
  await withDocument(async () => { await render(root, ctx); });
  return root;
}

/** The text a node carries — appended children, or a `textContent` set directly. */
function textOf(node: FakeNode): string {
  return node.children.length > 0 ? node.children.map(textOf).join('') : node.textContent;
}

function findAll(root: FakeNode, predicate: (node: FakeNode) => boolean): FakeNode[] {
  const out: FakeNode[] = [];
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (predicate(child)) out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

function findOne(root: FakeNode, predicate: (node: FakeNode) => boolean): FakeNode {
  const all = findAll(root, predicate);
  assert.equal(all.length, 1, `expected exactly one match, found ${all.length}`);
  return all[0]!;
}

/**
 * **A walk with two ungoverned directories in it, and one that is governed.**
 *
 * The two are the mockup's own — `src/workers/` and `vendor/` — because the row
 * this screen builds is compared to the row the mockup draws and a fixture that
 * renamed them would make the comparison harder to read for no gain.
 * `src/workers/` carries three files, which is the count `gaps.r1`'s
 * `{files}` slot shows there.
 *
 * `src/api/handler.ts` is governed and is NOT decoration: without it `src`
 * itself would be ungoverned and `coverageGaps` would name `src` alone — the
 * shallowest-directory rule working — and the table would have one row instead
 * of two. The fixture has to make the rule visible rather than accidentally
 * step around it.
 *
 * `truncated: true` is the walk hitting `COVERAGE_FILE_LIMIT`. Neither corpus
 * this project serves does (both answer `false`), so it is set here or the
 * disclosure is never rendered anywhere.
 */
const WITH_GAPS: CoverageBody = {
  files: [
    { path: 'src/api/handler.ts', governs: ['RULE-handlers-validate-at-the-boundary'] },
    { path: 'src/workers/queue.ts', governs: [] },
    { path: 'src/workers/retry.ts', governs: [] },
    { path: 'src/workers/spawn.ts', governs: [] },
    { path: 'vendor/lib/pool.js', governs: [] },
  ],
  pinned: [],
  items: [],
  truncated: false,
};

const WITH_GAPS_TRUNCATED: CoverageBody = { ...WITH_GAPS, truncated: true };

/**
 * **`.demo-corpus`' answer, byte for byte in shape.** Measured 2026-08-23 by
 * calling `apiCoverage` against it: `files: []`, because that corpus holds
 * `.my_context` and no repository files at all. `pinned` and `items` are not
 * empty there — six and nineteen — but this screen reads neither, and a fixture
 * that filled them would suggest it did.
 */
const NOTHING_TO_DRAW: CoverageBody = { files: [], pinned: [], items: [], truncated: false };

/**
 * **The ledger entry for `gaps` in `e2e/screen-parity.spec.ts`, restated.**
 *
 * Not imported: that file is a Playwright spec and importing it here would drag
 * `@playwright/test` into `node --test`. Restated deliberately, and the test
 * below is what keeps the two spellings honest — it derives this same list from
 * the mockup and a `.demo-corpus`-shaped render, so the day the gate's entry
 * shrinks and this one does not, this file fails and names the difference.
 */
// `b` came OUT on 2026-08-25: the run grammar gained `{b:}` and `{i:}`, so a
// string table can carry emphasis and the screen draws the bold it could not.
const KNOWN_GAPS_GAPS = ['button.icon', 'span.m', 'span.v', 'td', 'td.m', 'td.small'];

// ── The parser, checked before anything is measured with it ───────────────

test('the mockup section parses to the nineteen kinds it draws', () => {
  assert.deepEqual(mockupKinds(), [
    'b', 'button.icon', 'div.card.pane', 'div.phd', 'h2', 'p.psub', 'p.small',
    'span', 'span.m', 'span.v', 'span.verdict', 'table', 'tbody', 'td', 'td.m',
    'td.small', 'th', 'thead', 'tr',
  ]);
});

// ── The screen, over data that has something to draw ──────────────────────

test('given a gap to draw, the screen draws every kind the mockup does but the category name', async () => {
  const root = await draw(WITH_GAPS_TRUNCATED);
  const drawn = mockupKinds();
  const built = renderedKinds(root);

  // **`span.m` is the one kind left, and it is a STRING-TABLE gap.** The
  // mockup's third row shape is `<td data-t="gaps.cat">category <span
  // class="m">open_question</span></td>`, and `gaps.cat` is
  // `category {m:open_question}` — an `{m:…}` run is a LITERAL by `lib/i18n.js`'
  // own grammar, so the key can name the one category the mockup's demo row
  // happens to show and there is no substitution for the fifteen others this
  // corpus actually has empty. `screens/gaps.js`' header states the fix
  // (`gaps.cat` written as `category {mv:name}`, one word in the design of
  // record); until it lands, drawing the row would either repeat one category's
  // name for every row or drop the word that tells a category from a directory.
  assert.deepEqual(
    drawn.filter((kind) => !built.includes(kind)), ['span.m'],
    'the only kind this screen may still be missing is the empty-category name',
  );

  // And nothing the mockup does not draw. `p.small.spill` — `errorNote` — is
  // the one kind this screen can build that the mockup has no counterpart for,
  // and it is drawn INSTEAD of all of this; the refusal test below is where it
  // belongs.
  assert.deepEqual(
    built.filter((kind) => !drawn.includes(kind)), [],
    'this screen invents no element the design of record does not draw',
  );
});

test('every gap the view model names is drawn, in its order, and none is dropped', async () => {
  const viewmodel = await browserModule<ViewModelModule>('lib', 'viewmodel.js');
  const expected = viewmodel.coverageGapRows(viewmodel.buildTree(WITH_GAPS.files));
  // The shallowest ungoverned directory, once, not its subtree — `src/workers`
  // rather than three files, and `vendor` rather than `vendor/lib`.
  assert.deepEqual(expected, [{ path: 'src/workers', files: 3 }, { path: 'vendor', files: 1 }]);

  const root = await draw(WITH_GAPS);
  const body = findOne(root, (node) => node.tag === 'tbody');
  assert.equal(body.children.length, expected.length, 'one row per gap, and no row without one');
  assert.deepEqual(
    body.children.map((row) => textOf(row.children[0]!)),
    // The trailing slash is the mockup's: a `Where` is a directory and says so
    // before it is read.
    ['src/workers/', 'vendor/'],
  );
  assert.deepEqual(
    body.children.map((row) => textOf(row.children[1]!)),
    ['3 files, no item scopes here', '1 files, no item scopes here'],
  );
});

test('ruling A1: the file count arrives as a span.v NODE, never flattened into text', async () => {
  const root = await draw(WITH_GAPS);
  const what = findAll(root, (node) => kindOf(node.tag, node.className) === 'td.small')[0]!;
  // `gaps.r1` is `{files} files, no item scopes here` — a plain `{name}` run,
  // which `lib/i18n.js` builds as `span.v`: the bidi isolation without the
  // monospace, exactly what the mockup's `<span class="v" data-v="files">3` is.
  // Assigning the same sentence with `textContent` would read identically and
  // lose the span, which is the defect ruling A1 exists for — and the fake
  // `tFlat` above fails the other half of the same mistake.
  const slot = what.children.find((child) => child.tag === 'span');
  assert.ok(slot !== undefined, 'the {files} substitution must survive as an element');
  assert.equal(slot.className, 'v');
  assert.equal(slot.textContent, '3');
});

test('the Compose button is the mockup\'s icon button, styled through CSSOM and inert', async () => {
  const root = await draw(WITH_GAPS);
  const compose = findAll(root, (node) => kindOf(node.tag, node.className) === 'button.icon')[0]!;
  assert.equal(textOf(compose), 'Compose');

  // The server sends `style-src 'self'` with no `'unsafe-inline'`, so the
  // mockup's `style="inline-size:auto"` is the one thing here that may not be
  // transcribed literally. The declaration is set through CSSOM, which CSP does
  // not gate, and the attribute is never written.
  const element = compose as FakeElement;
  assert.equal(element.style.declarations['inline-size'], 'auto');
  assert.equal(element.attributes['style'], undefined, 'CSP forbids a style attribute');
  assert.equal(element.type, 'button', 'a button inside nothing still must not submit');

  // Inert, exactly as the mockup's own is: it has no handler there either, and
  // the screen it must lead to — the Composer — is another plan's. Wiring one
  // here would compose a command with nowhere to SHOW it before it is copied,
  // which is the one rule `lib/command.js` states about itself.
  assert.deepEqual(element.listeners, {}, 'the trigger renders inert until it does');
});

// ── The screen, over the corpus the parity gate actually serves ───────────

test('over a corpus with no ungoverned directory, the ledger entry is exactly what it says', async () => {
  const root = await draw(NOTHING_TO_DRAW);
  const missing = mockupKinds().filter((kind) => !renderedKinds(root).includes(kind));

  // **This is `e2e/screen-parity.spec.ts`' `gaps` entry, reproduced in Node.**
  // Five of the seven — `td`, `td.m`, `td.small`, `span.v`, `button.icon` — are
  // drawn by the test above from the same code and a body that has a gap in it,
  // so they are DATA. `span.m` is the string table. `b` is both at once: the
  // mockup draws it twice, as `<b data-t="cov.k4">` in the not-examined row
  // (which this screen renders when `truncated` is true, and no corpus here
  // makes it true) and as a bold run INSIDE `gaps.note`, which `lib/i18n.js`'
  // grammar has no marker for and no string table can carry.
  //
  // When this list and the gate's disagree, one of them is stale. Change both.
  assert.deepEqual(missing, KNOWN_GAPS_GAPS);
});

test('no rows is drawn as the real markup with nothing in it, never as a sentence', async () => {
  const root = await draw(NOTHING_TO_DRAW);
  const built = renderedKinds(root);
  for (const kind of ['table', 'thead', 'tbody', 'tr', 'th']) {
    assert.ok(built.includes(kind), `${kind} is drawn whether or not there is a row`);
  }
  assert.equal(findOne(root, (node) => node.tag === 'tbody').children.length, 0);
  assert.deepEqual(
    findAll(root, (node) => node.tag === 'th').map(textOf), ['Where', 'What', 'Next'],
  );
  // The one paragraph is `gaps.note`. A congratulation on a fully scoped
  // repository would be a sentence no table declares, and this screen has no
  // business inventing one.
  assert.deepEqual(
    findAll(root, (node) => kindOf(node.tag, node.className) === 'p.small').map(textOf),
    ['Not examined is a third state, never folded into "gap". A file the walk did not reach '
      + 'is not a file nothing governs.'],
  );
});

// ── The third state, which is disclosed and never folded into a gap ───────

test('a truncated walk is disclosed in the mockup\'s own two keys', async () => {
  const root = await draw(WITH_GAPS_TRUNCATED);
  const said = findAll(root, (node) => kindOf(node.tag, node.className) === 'p.small').map(textOf);
  assert.ok(
    said.includes('not examined — past the file limit'),
    'the walk stopped short and the gaps list is therefore partial: INV-nothing-is-dropped-'
    + `silently says the table must say so. Paragraphs found: ${JSON.stringify(said)}`,
  );
  // `<b>` + `cov.k4`, an em dash, then `gaps.r2` — `screens/coverage.js`'
  // spelling of the same fact, and the mockup's own pairing of the same two
  // keys in the row this screen cannot build. A third key worded here would be
  // a string the design of record does not declare.
  //
  // **TWO bold runs now, and the second is not a defect.** `gaps.note` opens
  // with `{b:Not examined}` since the run grammar gained `{b:}` and `{i:}` on
  // 2026-08-25 and English was populated from the mockup's own markup. The one
  // this test is about is the DISCLOSURE's, lower case, beside `cov.k4`. Both
  // are asserted rather than one located, so a third appearing is reported
  // instead of quietly satisfying a `findOne` that no longer means what it did.
  const bolds = findAll(root, (node) => node.tag === 'b').map(textOf).sort();
  assert.deepEqual(bolds, ['Not examined', 'not examined'],
    'the bold runs on this screen are the disclosure\'s lower-case one beside cov.k4 and '
    + 'gaps.note\'s capitalised one; anything else is a run the mockup does not draw');
});

test('the not-examined state is never a row in a table whose every row is a gap', async () => {
  const root = await draw(WITH_GAPS_TRUNCATED);
  const body = findOne(root, (node) => node.tag === 'tbody');
  assert.equal(body.children.length, 2, 'the two gaps, and no third row for the third state');
  assert.equal(
    findAll(body, (node) => node.tag === 'b').length, 0,
    '`gaps.note`: a third state, never folded into "gap". No path is served for its Where, and '
    + 'a row with an empty Where would fold it into nothing instead',
  );
});

test('a walk that did NOT stop short says nothing about a limit it never reached', async () => {
  const root = await draw(WITH_GAPS);
  assert.equal(
    findAll(root, (node) => textOf(node).includes('past the file limit')).length, 0,
    'truncated:false means the walk was complete — disclosing a limit anyway would be the '
    + 'third state invented rather than reported',
  );
});

// ── The refusal ───────────────────────────────────────────────────────────

test('a refused endpoint is drawn in the server\'s own words, INSTEAD of the table', async () => {
  const REFUSAL = 'the index is out of date relative to the corpus, and this endpoint may not '
    + 'rebuild it. Run `mycontext reindex`';
  const root = await drawFrom(async () => { throw new Error(REFUSAL); });

  // `errorNote`'s own shape, carrying the endpoint's sentence as it arrived: no
  // string table declares a wording for this on any of these screens, and
  // inventing one fails `strings-parity.test.ts` in the direction that names it.
  const note = findOne(root, (node) => kindOf(node.tag, node.className) === 'p.small.spill');
  assert.equal(textOf(note), REFUSAL);

  // An endpoint that refused and a repository with no gaps are two facts, and
  // an empty table under a refusal reports the second when the first happened.
  const built = renderedKinds(root);
  assert.ok(!built.includes('table'), 'the table is not drawn beside a refusal');
  // The heading still is: the screen is identifiable while it is failing.
  assert.ok(built.includes('div.phd'), 'the refusal replaces the data, not the screen');
});
