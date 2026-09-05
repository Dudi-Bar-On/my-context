/**
 * `screens/learn.js` — the Learn screen — measured against the design of
 * record, in Node, with no browser.
 *
 * **THE LIMIT, first.** Spec §6 puts the DOM glue in `app.js` and
 * `screens/*.js` outside the tested surface, and `test/ui/viewmodel.test.ts`
 * says so in its own header: *"A green run here verifies the view-models, not
 * the pixels."* Nothing below checks a pixel, a stylesheet rule, a layout or
 * an event. What it checks is the half of this screen that is a DECISION —
 * which four topics, joined to which field, and **which runs are marked as
 * machine text** — resolved against `docs/design/web-ui-mockup.html` itself
 * rather than against a copy of it typed out here.
 *
 * ── WHY THE MARKING IS WORTH A TEST FILE OF ITS OWN ───────────────────────
 *
 * `.m` is `direction:ltr; unicode-bidi:isolate` (`styles.css` ~262), and what
 * that is worth was measured in the Hebrew page rather than assumed: a value
 * whose first and last characters are both strong left-to-right does not
 * reorder without it (`INV-prices-are-integer-cents` renders identically
 * marked and unmarked, only in a different font), and a value with a NEUTRAL
 * at either end does (`src/**`, `(2 pinned)`, an id with a leading hyphen —
 * each reads right-to-left unmarked). Today's two ids are the first kind. The
 * mark is what stops that being luck: `firstId()` draws whatever the endpoint
 * carries, so the guarantee has to live in the code and not in the corpus.
 *
 * That is why the mark is asserted PER RUN and not only in the aggregate, and
 * why the kind comparison runs over both string tables — a screen that is
 * correct in English and wrong in Hebrew is the failure this project keeps
 * having.
 *
 * That is the gap this file's task closed: `e2e/screen-parity.spec.ts`'
 * `KNOWN_GAPS` listed `span.m` for `learn`, because the screen drew its
 * cross-linked ids as `linkId()` buttons where the mockup draws a bare
 * `mono()` run. `i` outlived it by two days — the mockup italicises one word
 * inside `ln.sub`, and `lib/i18n.js`'s run grammar had `{m:}`, `{mv:}` and
 * `{name}` and no emphasis marker, so no string table could carry it. Both
 * halves of that have since gone: the grammar gained `{b:}` and `{i:}` on
 * 2026-08-25, English was populated from the mockup's own markup the same
 * day, Hebrew followed on 2026-08-27 under
 * `DEC-hebrew-gets-the-same-emphasis-english-does`, and `KNOWN_GAPS.learn` is
 * now `[]`. **So assertion 4 below has changed sides.** It used to record the
 * debt — English drawing the italic, Hebrew not — and it now records the debt
 * being PAID: both languages are held to the mockup's full list, and a Hebrew
 * render that loses `i` is a dropped emphasis run rather than a translation
 * nobody has got to yet.
 *
 * **The id shape flipped a second time on 2026-09-05, and `KNOWN_GAPS.learn`
 * stayed `[]` through it.** The `span.m` this paragraph describes above was
 * itself a deliberate choice made while `aside#pane` did not exist — kept
 * once the pane shipped (`aa34358`, 2026-08-23) only because nobody came back
 * to ask whether it still should be. `TASK-learn-the-categories-row-cannot-
 * draw-the-cross-link-its-own` asked: Learn's two ids are now
 * `button.linkid.m`, the shape the other seven screens draw, and the mockup
 * moved with the screen — both sides of every assertion below changed
 * together, so the gap stayed shut rather than reopening on one side.
 *
 * ── HOW A BROWSER MODULE THAT IMPORTS `/screens/parts.js` IS IMPORTED ─────
 *
 * `screens/learn.js` is a plain browser ES module and its one import is
 * ROOT-ABSOLUTE — `/screens/parts.js` — because that is what the browser
 * resolves against the server's document root. Node resolves the same
 * specifier against the filesystem root: on Windows the WHATWG parser keeps
 * the parent's drive letter, so it becomes `D:/screens/parts.js`, which does
 * not exist. So this file registers a synchronous resolve hook
 * (`node:module`'s `registerHooks`, Node ≥22.15) mapping a root-absolute
 * specifier onto `src/ui/public/`, which is exactly what `src/ui/server.ts`
 * serves it as — the same arrangement `test/ui/tut-screen.test.ts` uses, and
 * for the same reason. It does not fake `parts.js`: `mono()` and `screenHead()`
 * are the mockup's own shapes, and a stub of them would assert this file's
 * idea of the design rather than the shipped one.
 *
 * The hook is in-process and each test file runs in its own process, so
 * nothing here reaches another test.
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
  dataset: Record<string, string>;
  children: FakeNode[];
}

function textNode(text: string): FakeNode {
  return { tag: '#text', className: '', textContent: text, dataset: {}, children: [] };
}

/**
 * The members `screens/parts.js` and `lib/i18n.js` touch on an element:
 * `className`, `textContent`, `dataset`, `append`, and the `replaceChildren`
 * `render()` opens with. No more than that, on purpose — a fuller fake would
 * invite tests this file has no business running.
 */
function element(tag: string): FakeNode & {
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: () => void;
} {
  const node = {
    tag,
    className: '',
    textContent: '',
    dataset: {} as Record<string, string>,
    children: [] as FakeNode[],
    append: (...nodes: (FakeNode | string)[]): void => {
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    replaceChildren: (): void => { node.children.length = 0; },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

// ── The modules under test ──────────────────────────────────────────────────

interface LearnModule {
  render: (root: ReturnType<typeof element>, ctx: unknown) => Promise<void>;
}

interface I18nModule {
  t: (
    strings: Record<string, string>,
    key: string,
    subs: Record<string, string | number>,
    document: typeof doc,
  ) => FakeNode[];
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

const learn = (): Promise<LearnModule> => browserModule<LearnModule>('screens', 'learn.js');
const i18n = (): Promise<I18nModule> => browserModule<I18nModule>('lib', 'i18n.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

const SOURCE = readFileSync(path.join(PUBLIC, 'screens', 'learn.js'), 'utf8');

// ── The design of record, parsed ────────────────────────────────────────────

const MOCKUP = readFileSync(path.join(REPO, 'docs', 'design', 'web-ui-mockup.html'), 'utf8');

/**
 * `<section data-p="learn">`'s INNER html — the opening tag excluded, because
 * `e2e/screen-parity.spec.ts` compares `root.querySelectorAll('*')` and the
 * section itself is the root on both sides
 * (`e2e/screen-parity.spec.ts` · `for (const el of root.querySelectorAll<HTMLElement>('*'))` · ~61).
 */
function learnSection(): string {
  const open = MOCKUP.indexOf('<section data-p="learn"');
  assert.notEqual(open, -1, 'the mockup no longer has a <section data-p="learn">');
  const end = MOCKUP.indexOf('</section>', open);
  assert.notEqual(end, -1, "the mockup's learn section is unterminated");
  return MOCKUP.slice(MOCKUP.indexOf('>', open) + 1, end);
}

/** One attribute out of a raw tag body, or `null` where it carries none. */
function attr(tagBody: string, name: string): string | null {
  const found = new RegExp(`${name}="([^"]*)"`).exec(tagBody);
  return found === null ? null : found[1]!;
}

/** `tag.class1.class2`, classes sorted — `screen-parity.spec.ts`'s own form. */
function kindsOf(html: string): string[] {
  const kinds = new Set<string>();
  for (const tag of html.matchAll(/<([a-z][a-z0-9]*)([^>]*)>/g)) {
    const raw = (attr(tag[2]!, 'class') ?? '').trim();
    kinds.add(raw === '' ? tag[1]! : `${tag[1]!}.${raw.split(/\s+/).sort().join('.')}`);
  }
  return [...kinds].sort();
}

/** Every element in a rendered tree, flattened, in document order, root excluded. */
function elementsOf(root: FakeNode): FakeNode[] {
  const found: FakeNode[] = [];
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text') continue;
      found.push(child);
      walk(child);
    }
  };
  walk(root);
  return found;
}

/** Every element kind a rendered tree builds, same form as `kindsOf`. */
function renderedKinds(root: FakeNode): string[] {
  const kinds = elementsOf(root).map((node) => {
    const raw = node.className.trim();
    return raw === '' ? node.tag : `${node.tag}.${raw.split(/\s+/).sort().join('.')}`;
  });
  return [...new Set(kinds)].sort();
}

/** The text a node carries, children included, in document order. */
function textOf(node: FakeNode): string {
  return node.children.length > 0 ? node.children.map(textOf).join('') : node.textContent;
}

// ── The corpus joins, one canned body per topic ─────────────────────────────

/**
 * The four `/api/help/:topic` bodies, in the shapes `apiHelp` documents and
 * builds (`src/ui/read-model.ts` · `export function apiHelp(` · ~1750).
 * `markdown` is present and non-trivial on every one because the screen fetches
 * it and draws none of it — a claim worth being able to break.
 */
const HELP: Record<string, unknown> = {
  categories: {
    topic: 'categories',
    markdown: '# Categories\n\nwhich are normative.\n',
    corpus: { counts: { CONST: 2, INV: 1 }, empty: ['DEC'] },
  },
  // **The scope join is the defect's own shape.** `scoped` is `store.all()`
  // order — `ORDER BY id` — so the first entry is whichever id sorts first,
  // and on this project's live corpus that was a SUPERSEDED decision. Then a
  // task, then an active rationale item, and only fourth an active normative
  // one. `pickId()` has to walk past the first three to be right, and a rule
  // that stopped at the first admissible entry would stop at the decision.
  scope: {
    topic: 'scope',
    markdown: '# Scope\n\nhow scope restricts.\n',
    corpus: {
      scoped: [
        { id: 'DEC-focus-discloses-and-allows-rather-than-refusing-to-hide', title: 'focus discloses', scope: ['src/**'] },
        { id: 'TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be', title: 'rung 4', scope: ['src/**'] },
        { id: 'DEC-index-lists-only-what-is-not-already-injected', title: 'index lists', scope: ['src/**'] },
        { id: 'INV-prices-are-integer-cents', title: 'prices are integer cents', scope: ['src/**'] },
        { id: 'RULE-never-log-customer-email', title: 'never log customer email', scope: ['src/**'] },
      ],
      unscoped: [{ id: 'ADR-markdown-plus-disposable-index', title: 'markdown', policy: 'optional' }],
    },
  },
  capture: {
    topic: 'capture',
    markdown: '# Capture\n\nwhat to write down.\n',
    corpus: {
      recent: [
        { id: 'CONST-zero-runtime-dependencies', title: 'zero runtime dependencies', mtime: '2026-08-23T09:14:02.000Z' },
      ],
    },
  },
  workflow: {
    topic: 'workflow',
    markdown: '# Workflow\n\nthe queue.\n',
    corpus: { drafts: 1, pendingRevisions: { open: 2 } },
  },
};

/**
 * The two rows the joins above give an id to, in the module's own order.
 *
 * Both are what the SELECTION RULE returns, not what the list happens to put
 * first: `scope`'s list opens with a superseded decision, a task and an active
 * rationale item, and the invariant below is fourth.
 */
const APP_CROSS_LINKS = ['INV-prices-are-integer-cents', 'CONST-zero-runtime-dependencies'];

// ── The two facts a cross-link is checked against ──────────────────────────

/**
 * `/api/items`' `items`, cut to the three fields `pickId()` reads — `id`,
 * `type`, `status`. Every id the joins above name is here, because an id
 * `/api/items` does not carry is one the screen cannot check and therefore
 * does not draw; a fixture that quietly omitted one would be testing that
 * branch by accident instead of the rule.
 */
const CORPUS = [
  { id: 'ADR-markdown-plus-disposable-index', type: 'adr', status: 'active' },
  { id: 'CONST-zero-runtime-dependencies', type: 'constraint', status: 'active' },
  { id: 'DEC-focus-discloses-and-allows-rather-than-refusing-to-hide', type: 'decision', status: 'superseded' },
  { id: 'DEC-index-lists-only-what-is-not-already-injected', type: 'decision', status: 'active' },
  { id: 'INV-prices-are-integer-cents', type: 'invariant', status: 'active' },
  { id: 'RULE-never-log-customer-email', type: 'rule', status: 'active' },
  { id: 'TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be', type: 'task', status: 'active' },
];

/**
 * `/api/config`'s `resolved.categories`, cut to `name` and `tier`. These are
 * `core/categories.ts`' own tiers for the six categories the fixtures use —
 * the screen asks the endpoint rather than carrying a list of "the normative
 * ones", so the fixture is where the tier vocabulary is written down here.
 */
const TIERS = [
  { name: 'adr', tier: 'rationale' },
  { name: 'constraint', tier: 'normative' },
  { name: 'decision', tier: 'rationale' },
  { name: 'invariant', tier: 'normative' },
  { name: 'rule', tier: 'normative' },
  { name: 'task', tier: 'rationale' },
];

/**
 * The two shared reads, keyed by ROUTE rather than by topic: they are asked
 * once for the whole table, before any help endpoint, and a test that wants
 * one of them to fail omits its key.
 */
const SHARED: Record<string, unknown> = {
  '/api/items': {
    items: CORPUS,
    retiredStatuses: ['deprecated', 'superseded', 'validated'],
  },
  '/api/config': {
    path: '/tmp/.my_context/config.json',
    exists: true,
    raw: {},
    parseError: null,
    resolveError: null,
    resolved: { profile: 'standard', categories: TIERS },
    servingLastGood: false,
  },
};

interface RenderResult { root: FakeNode; asked: string[] }

/**
 * `render()` over the stand-in, in one language, against a given set of
 * bodies. `api` records what was asked for; everything else on the contract
 * throws, so a future edit that reaches for a stream or a POST fails here with
 * that sentence rather than silently acquiring a dependency.
 */
async function renderLearn(
  lang: 'en' | 'he',
  bodies: Record<string, unknown> = HELP,
  shared: Record<string, unknown> = SHARED,
): Promise<RenderResult> {
  const { render } = await learn();
  const { t } = await i18n();
  const strings = (await table(lang)).strings;

  const asked: string[] = [];
  const refuse = (name: string) => () => {
    throw new Error(`learn must not use ctx.${name}`);
  };
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(strings, key, subs, doc),
    api: async (route: string): Promise<unknown> => {
      asked.push(route);
      // The two shared reads first, by route: they are not help topics, and a
      // fixture that omits one is asking what the screen does when the fact a
      // cross-link is checked against cannot be read at all.
      if (route === '/api/items' || route === '/api/config') {
        const body = shared[route];
        if (body === undefined) throw new Error(`${route} is unavailable`);
        return body;
      }
      const topic = route.slice(route.lastIndexOf('/') + 1);
      const body = bodies[topic];
      // The endpoint's own 404 wording, close enough to matter: `errorNote`
      // shows the server's sentence verbatim, so a test that invented a
      // friendlier one would not be testing the shipped path.
      if (body === undefined) throw new Error(`no help topic "${topic}" — topics served here: ${Object.keys(bodies).join(', ')}.`);
      return body;
    },
    stream: refuse('stream'),
    session: refuse('session'),
    navigate: refuse('navigate'),
    tFlat: refuse('tFlat'),
  };

  // `screens/parts.js` reaches for the GLOBAL `document` — `el()` is the
  // mockup's own factory, argument for argument, and the mockup runs in a
  // browser. `lib/i18n.js` takes an injected `doc` and `parts.js` does not, so
  // the stand-in has to be installed rather than passed. Removed again
  // immediately: a global left behind would make any later test in this
  // process think it is in a browser.
  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  const root = element('section');
  try {
    await render(root, ctx);
  } finally {
    if (!had) delete globals.document;
  }
  return { root, asked };
}

// ── 1. The table of topics IS the mockup's table ────────────────────────────

/**
 * The `TOPICS` constant is not exported — the screen's DOM glue is the untested
 * surface, and widening its exports to let a test look at a constant would be
 * this file changing the module to suit itself. So it is read out of the
 * source, exactly as `test/ui/docs-screen.test.ts` reads `CONTENTS`.
 */
test('the four topics are the mockup\'s four, in its order, each with its own description key', async () => {
  const declared = [...SOURCE.matchAll(/\{ topic: '([a-z]+)', key: '(ln\.[a-z]+)', link: (null|'[a-z]+') \}/g)]
    .map((m) => ({ topic: m[1]!, key: m[2]!, link: m[3]! }));
  assert.deepEqual(declared, [
    { topic: 'categories', key: 'ln.c', link: 'null' },
    { topic: 'scope', key: 'ln.s', link: "'scoped'" },
    { topic: 'capture', key: 'ln.p', link: "'recent'" },
    { topic: 'workflow', key: 'ln.w', link: 'null' },
  ]);

  // And the same four names, in the same order, are what the mockup writes in
  // its monospace first column. A row reordered in one file and not the other
  // is the failure this catches.
  const drawn = [...learnSection().matchAll(/<td class="m">([a-z]+)<\/td>/g)].map((m) => m[1]!);
  assert.deepEqual(drawn, declared.map((entry) => entry.topic));
});

// ── 2. Every string key is declared, in both tables, and is the mockup's set ─

test('every ln. key the module names is the mockup\'s, and both string tables declare it', async () => {
  // QUOTED keys only. The header discusses `ln.c` and friends in backticks,
  // and a scan that read those would pass on a key the code never reaches —
  // the same discrimination `viewmodel.test.ts` makes over `app.js`.
  const named = new Set([...SOURCE.matchAll(/'(ln\.[A-Za-z0-9]+)'/g)].map((m) => m[1]!));
  const drawn = new Set([...learnSection().matchAll(/data-t="(ln\.[A-Za-z0-9]+)"/g)].map((m) => m[1]!));
  assert.ok(named.size > 0, 'the module names no ln. keys at all');
  // ONE direction, and which one is an owner ruling rather than a convenience.
  //
  // `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written` (2026-09-02)
  // says the drawing is read and never written, and that the product may run
  // AHEAD of it without that being a fault — only the mockup-ahead direction is
  // a finding. So:
  //
  //   a key the MOCKUP declares that the module never names  -> a piece of the
  //     screen that was drawn and not built. Still a defect. Still asserted.
  //   a key the MODULE names that the mockup does not declare -> the app ahead
  //     of a frozen drawing. Not a fault, and asserting it would forbid the
  //     screen from ever gaining a string again without editing a file the
  //     owner has forbidden anyone to edit.
  //
  // This test used to assert equality, and it went red the moment the mockup
  // was restored to its frozen state on 2026-09-05: `ln.cUnmeasured` is real,
  // shipped, translated in both tables, and drawn by the screen — it is simply
  // newer than the drawing. The equality was asserting the wrong thing, and
  // the freeze is what makes that visible.
  //
  // The other half of the old comment was already false: the "app string with
  // no mockup entry" direction was dropped from `strings-parity.test.ts` on
  // 2026-08-26, so nothing downstream fails on it either.
  const missing = [...drawn].filter((key) => !named.has(key)).sort();
  assert.deepEqual(missing, [],
    'the mockup declares these ln. keys and the module names none of them — drawn but not built');

  const en = (await table('en')).strings;
  const he = (await table('he')).strings;
  for (const key of named) {
    assert.ok(Object.hasOwn(en, key), `en.js does not declare ${key}`);
    assert.ok(Object.hasOwn(he, key), `he.js does not declare ${key}`);
  }
});

// ── 3. The screen reads the four endpoints and nothing else ────────────────

test('the screen GETs one help endpoint per topic, and touches no other part of the contract', async () => {
  const { asked } = await renderLearn('en');
  // The two shared reads come FIRST and come ONCE — `status`/`type` and the
  // category tiers are the same two facts for all four rows, and asking them
  // per row would be up to eight requests for one answer, two of them made by
  // rows whose join carries no id at all.
  assert.deepEqual(asked, [
    '/api/items', '/api/config',
    '/api/help/categories', '/api/help/scope', '/api/help/capture', '/api/help/workflow',
  ]);
});

// ── 4. The kinds: everything the mockup draws, the italic run included ─────

/**
 * The parity measurement `e2e/screen-parity.spec.ts` makes in a browser, made
 * here over fake nodes. Read it for what it is — a shape comparison, not a
 * rendering; the real one is that spec's and stays that spec's.
 *
 * The equality is EXACT in both directions, which is stronger than the gate:
 * the gate only fails on a kind the mockup draws and the app does not, so a
 * kind the app invents is recorded there in prose and nowhere in code. Here it
 * fails, and the failure names it.
 */
test('both languages draw the italic run — the Hebrew emphasis has landed', async () => {
  // **A tripwire on a FROZEN file, not a parity assertion.** The mockup is read
  // and never written (`DEC-the-mockup-is-a-frozen-reference-it-is-read-never-
  // written`), so this list should now never change again: if it does, someone
  // wrote to a file the owner has forbidden anyone to write to, and that is
  // what this assertion catches.
  //
  // Two kinds here are DELIBERATELY behind the app and must stay that way. The
  // screen draws `button.linkid.m` where the drawing has `span.m`, and draws a
  // `span.chip.unmeas` the drawing has no equivalent for at all — both landed
  // with `walk/88` on 2026-09-05. Under the freeze the app running ahead is not
  // a fault, so those two belong in the app-side assertions below and not in
  // this list. This list is what the DRAWING says.
  const drawn = kindsOf(learnSection());
  assert.deepEqual(drawn, [
    'div.card.pane', 'div.phd', 'h2', 'i', 'p.psub', 'span',
    'span.m', 'span.verdict', 'table', 'tbody', 'td.m', 'td.small', 'tr',
  ], 'the frozen mockup section changed shape — it is read-only, so this should be impossible');

  // **The two languages differed HERE for two days, and this assertion was the
  // record of the debt. It is now the record of the debt being PAID.** `i` is
  // `ln.sub`'s italicised "this". The grammar gained `{b:}` and `{i:}` on
  // 2026-08-25 and English was populated from the mockup's own markup, where
  // every `<b>` and `<i>` says exactly where emphasis goes.
  //
  // Hebrew was NOT, and not by oversight: the mockup's `const HE` table is
  // plain strings with no markup in any of them, so there is no source for
  // where a Hebrew sentence puts its stress, and placing it by pattern-matching
  // the language would be guessing. Owner ruling
  // (DEC-hebrew-gets-the-same-emphasis-english-does): Hebrew GETS the emphasis,
  // from the owner. He released the 57 placements on 2026-08-27 and they were
  // written into `he.js` the same day, `ln.sub` among them.
  //
  // So BOTH branches expect the SCREEN's full list, italic included — the
  // screen's own, not the drawing's. They differ by exactly what `walk/88`
  // changed on 2026-09-05: the ids became `button.linkid.m` where the drawing
  // still shows an inert `span.m`, and the unmeasured rows gained a
  // `span.chip.unmeas` the drawing has no equivalent for. The mockup is frozen
  // and the app may run ahead of it, so those belong here and not in the
  // tripwire above.
  //
  // Note this is an UPGRADE and not an addition: `span.m` did not survive
  // alongside the button, it became the button. So a plain superset check
  // against the drawing would read the substitution as a missing kind and go
  // red on correct work — which is why the two lists are stated separately and
  // neither is derived from the other.
  //
  // What both branches still hold is `i`: if the Hebrew branch loses it, an
  // emphasis run has been dropped from the Hebrew table — that is a regression,
  // not a pending translation.
  const built = [
    'button.linkid.m', 'div.card.pane', 'div.phd', 'h2', 'i', 'p.psub', 'span',
    'span.chip.unmeas', 'span.verdict', 'table', 'tbody', 'td.m', 'td.small', 'tr',
  ];
  const { root: enRoot } = await renderLearn('en');
  assert.deepEqual(renderedKinds(enRoot), built,
    'the English render no longer draws the screen\'s own kinds, italic included');
  const { root: heRoot } = await renderLearn('he');
  assert.deepEqual(renderedKinds(heRoot), built,
    'the Hebrew render no longer draws the italic run. `ln.sub` carries `{i:}` in he.js as of '
    + '2026-08-27; losing it is a dropped emphasis run, not unfinished work.');
  // The one kind the drawing has and the screen does not, stated rather than
  // asserted away: `span.m`, which BECAME `button.linkid.m`. Naming it here is
  // what stops the next reader from "fixing" the difference in the wrong
  // direction — by editing a frozen file, or by demoting a working button back
  // to inert text.
  assert.deepEqual(drawn.filter((kind) => !built.includes(kind)), ['span.m'],
    'the drawing and the screen now differ by something other than the walk/88 upgrade');

  // And the italic really is in `ln.sub`, in BOTH tables: it is carried in the
  // string values, never in the screen, so neither language can drift from the
  // mockup's own decision about where the stress falls.
  const sub = learnSection().slice(learnSection().indexOf('<p class="psub"'));
  assert.match(sub.slice(0, sub.indexOf('</p>')), /<i>this<\/i>/);
  const en = (await table('en')).strings;
  assert.match(en['ln.sub']!, /\{i:/,
    'ln.sub lost its italic marker — the English emphasis is carried in the string table now, '
    + 'and the mockup is the source for where it goes');
  const he = (await table('he')).strings;
  assert.match(he['ln.sub']!, /\{i:/,
    'the HEBREW ln.sub lost its emphasis marker. It was placed on 2026-08-27 on `הזה`, the '
    + 'demonstrative that carries the same argument English puts on "this".');
});

// ── 5. Machine text is MARKED, which is the whole of this task ─────────────

/**
 * Every value on this screen that is machine text, checked per run rather than
 * in the aggregate, in Hebrew as well as English. `.m` is
 * `direction:ltr; unicode-bidi:isolate`; without it the `·` this screen writes
 * before a cross-link resolves against the paragraph direction and lands on
 * the wrong side of the id.
 *
 * The cross-linked id is a `button.linkid.m` now, not a `span.m` — Learn's two
 * ids used to be the one exception in the product; this task made them click
 * like the other seven screens' ids do. `.m` still carries the isolation the
 * measurement below is about; the shape carrying it changed.
 */
test('every machine-text run carries .m — the topic names and the clickable cross-linked ids', async () => {
  for (const lang of ['en', 'he'] as const) {
    const { root } = await renderLearn(lang);
    const elements = elementsOf(root);

    // The topic name: four cells, each `<td class="m">`, exactly as the mockup
    // writes them. They are `UI_HELP_TOPICS`' own values and what
    // `mycontext help <topic>` takes on the command line — never translated,
    // and identical in both languages.
    const topicCells = elements.filter((node) => node.tag === 'td' && node.className === 'm');
    assert.deepEqual(topicCells.map(textOf), ['categories', 'scope', 'capture', 'workflow'],
      `${lang}: the topic column is not four marked, untranslated topic names`);

    // The cross-linked id: a `button.linkid.m`, the mockup's own shape now,
    // one per row whose join carries one — and it carries the id a click on it
    // would open, in `dataset.id`, the same contract every other screen's id
    // button honours.
    const runs = elements.filter((node) => node.tag === 'button' && node.className === 'linkid m');
    assert.deepEqual(runs.map(textOf), APP_CROSS_LINKS,
      `${lang}: the corpus ids are not drawn as clickable marked monospace runs`);
    assert.deepEqual(runs.map((r) => r.dataset.id), APP_CROSS_LINKS,
      `${lang}: a cross-linked button does not carry the id a click on it would open`);

    // The separator is a SIBLING of the run, never inside it — the mockup's own
    // arrangement. Pulled inside, it joins the isolate and is laid out as part
    // of the identifier, which in the Hebrew page puts it at the far end of the
    // id instead of between the description and it.
    for (const run of runs) {
      assert.equal(run.children.length, 1, 'an id button holds one text child and nothing else');
      assert.equal(run.children[0]!.tag, '#text');
    }
    const cells = elements.filter((node) => node.tag === 'td' && node.className === 'small');
    const linked = cells.filter((cell) => cell.children.some((c) => c.className === 'linkid m'));
    assert.equal(linked.length, 2, `${lang}: two of the four rows carry a clickable cross-link`);
    for (const cell of linked) {
      const marker = cell.children.findIndex((child) => child.className === 'linkid m');
      assert.equal(cell.children[marker - 1]!.tag, '#text');
      assert.equal(cell.children[marker - 1]!.textContent, ' · ',
        'the separator sits beside the run, unmarked and outside the isolate');
    }
  }
});

// ── 6. Every row is a named ACTIVE item or the ◌ mark. Never neither ───────

/** The `<tr>`s, in the module's order. */
function rowsOf(root: FakeNode): FakeNode[] {
  return elementsOf(root).filter((node) => node.tag === 'tr');
}

/** The clickable id this row draws, or `null`. */
function linkOf(row: FakeNode): string | null {
  const button = elementsOf(row).find((n) => n.tag === 'button' && n.className === 'linkid m');
  return button === undefined ? null : textOf(button);
}

/** The `◌` chip this row draws, or `null`. */
function markOf(row: FakeNode): FakeNode | null {
  return elementsOf(row).find((n) => n.tag === 'span' && n.className === 'chip unmeas') ?? null;
}

/**
 * **THE assertion `TASK-learn-cross-links-a-superseded-item-and-a-closed-task-
 * and` exists for, and the one that stops this regressing quietly.**
 *
 * The screen's subtitle promises *"The four help topics, each linked to the
 * items in this corpus that demonstrate it"* — a promise a subtitle makes for
 * every row under it. So there are exactly two honest endings: a named item,
 * or the `◌` mark saying no suitable one was found. `workflow` was ending in
 * neither — no id, no mark, no text at all — which is the silent drop
 * `INV-nothing-is-dropped-silently` forbids, and it is invisible to every
 * assertion that only checks the rows that DO link.
 *
 * Both languages, because a mark drawn from a string table can be lost in one
 * of them.
 */
test('every row ends in exactly one of two states: a named item, or the ◌ mark', async () => {
  for (const lang of ['en', 'he'] as const) {
    const { root } = await renderLearn(lang);
    const rows = rowsOf(root);
    assert.equal(rows.length, 4);
    for (const row of rows) {
      const topic = textOf(row.children[0]!);
      const link = linkOf(row);
      const mark = markOf(row);
      assert.notEqual(link === null && mark === null, true,
        `${lang}: the ${topic} row drew neither an item nor the ◌ mark — that is the silent drop`);
      assert.notEqual(link !== null && mark !== null, true,
        `${lang}: the ${topic} row drew both an item and the ◌ mark, which say opposite things`);
      // Whichever it drew, it is introduced by the mockup's separator — the
      // description, then ` · `, then the one run.
      assert.equal(textOf(row.children[1]!).includes(' · '), true,
        `${lang}: the ${topic} row lost the separator before its answer`);
      if (mark !== null) {
        assert.equal(mark.dataset.g, '◌');
        assert.equal(textOf(mark) !== '', true, `${lang}: the ${topic} row's mark is unlabelled`);
      }
    }
  }
});

/**
 * Which row is in which state, against the fixtures — the four-row reading the
 * task took off the live screen, now made in code.
 *
 * The mockup USED TO draw an invented id on its categories row
 * (`CONST-zero-runtime-dependencies`) — the one place the app's cross-links
 * and the mockup's sat on different rows. `TASK-learn-the-categories-row-
 * cannot-draw-the-cross-link-its-own` closed that: the mockup draws the same
 * honest `◌` mark the app draws, and the two agree.
 */
test('categories and workflow draw the ◌ mark; scope and capture draw the item the rule picked', async () => {
  const { root } = await renderLearn('en');
  const rows = rowsOf(root);

  assert.deepEqual(rows.map((row) => [textOf(row.children[0]!), linkOf(row)]), [
    ['categories', null],
    ['scope', 'INV-prices-are-integer-cents'],
    ['capture', 'CONST-zero-runtime-dependencies'],
    ['workflow', null],
  ]);

  // The two unlinked rows are MARKED, with the same `◌` primitive
  // `coverage.js`, `doctor.js`, `watch.js` and `injected.js` already spend on
  // "this was not measured", never a fifth convention. `workflow` is the row
  // that used to draw nothing here.
  for (const topic of ['categories', 'workflow']) {
    const row = rows.find((r) => textOf(r.children[0]!) === topic)!;
    const mark = markOf(row);
    assert.notEqual(mark, null, `${topic} does not draw the ◌ unmeasured chip`);
    assert.equal(mark!.dataset.g, '◌');
    assert.equal(textOf(mark!), 'no single item represents this');
  }

  // **The drawing carries no clickable ids at all, and that is the expected
  // state rather than a disagreement.** It renders every id as an inert
  // `span.m`; the screen renders `button.linkid.m`, which is what every other
  // id on every other screen is, and what `walk/88` landed on 2026-09-05.
  //
  // The mockup is frozen (`DEC-the-mockup-is-a-frozen-reference-it-is-read-
  // never-written`) and the app is allowed to run ahead of it, so this asserts
  // the FREEZE — the drawing still has no `linkid` in this section — rather
  // than a parity that would now demand editing a read-only file. Which rows
  // carry an id, and which id, is asserted above against the real endpoints,
  // where that fact actually lives.
  const mockupLinked = [...learnSection().matchAll(/<tr><td class="m">([a-z]+)<\/td><td class="small">([^]*?)<\/tr>/g)]
    .filter((m) => m[2]!.includes('class="linkid m"'))
    .map((m) => m[1]!);
  assert.deepEqual(mockupLinked, [],
    'the frozen mockup grew a linkid button — it is read-only, so this should be impossible');
});

// ── 6b. The selection rule itself, one exclusion at a time ────────────────

/**
 * **The three faults the task names, each pinned separately**, because a rule
 * that got the right answer for one reason would still be wrong.
 *
 * The `scope` fixture's list is the live corpus' own shape: a superseded
 * decision first (`ORDER BY id` put it there), then a task, then an ACTIVE
 * rationale item, then the invariant. Every earlier candidate has to be
 * rejected for its own reason for the fourth to be the answer.
 */
test('the pick skips a superseded item, skips a task, and prefers the normative tier', async () => {
  const { root } = await renderLearn('en');
  const scope = rowsOf(root).find((row) => textOf(row.children[0]!) === 'scope')!;
  assert.equal(linkOf(scope), 'INV-prices-are-integer-cents',
    'the scope row did not walk past the superseded decision, the task and the active decision');

  // Each exclusion on its own, as the ONLY candidate — so a pass here cannot
  // come from a later entry rescuing the row.
  const only = async (id: string): Promise<string | null> => {
    const { root: r } = await renderLearn('en', {
      ...HELP,
      scope: { topic: 'scope', markdown: '', corpus: { scoped: [{ id, title: 't', scope: ['src/**'] }], unscoped: [] } },
    });
    return linkOf(rowsOf(r).find((row) => textOf(row.children[0]!) === 'scope')!);
  };
  assert.equal(await only('DEC-focus-discloses-and-allows-rather-than-refusing-to-hide'), null,
    'a superseded item was drawn as a demonstration of how scope works');
  assert.equal(await only('TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be'), null,
    'a task was drawn — a task is a piece of work, not a demonstration');
  assert.equal(await only('MISSING-not-in-this-corpus'), null,
    'an id /api/items does not carry was drawn, so neither fact about it was checked');
  // A rationale item is not refused — it is OUTRANKED. On its own it is the
  // best available answer and is drawn, which is why the preference has to be
  // measured against a list rather than against one entry.
  assert.equal(await only('DEC-index-lists-only-what-is-not-already-injected'),
    'DEC-index-lists-only-what-is-not-already-injected');

  // And a list in which nothing survives ends in the mark, not in blank space.
  const { root: none } = await renderLearn('en', {
    ...HELP,
    scope: {
      topic: 'scope',
      markdown: '',
      corpus: {
        scoped: [
          { id: 'DEC-focus-discloses-and-allows-rather-than-refusing-to-hide', title: 'a', scope: ['src/**'] },
          { id: 'TASK-injection-preview-rung-4-of-the-gate-ladder-can-never-be', title: 'b', scope: ['src/**'] },
        ],
        unscoped: [],
      },
    },
  });
  const empty = rowsOf(none).find((row) => textOf(row.children[0]!) === 'scope')!;
  assert.equal(linkOf(empty), null);
  assert.notEqual(markOf(empty), null, 'a join whose every candidate was excluded drew blank space');
});

/** An empty list, and an entry whose `id` is not a usable string, are the same answer. */
test('an empty or malformed join is not a cross-link', async () => {
  const empty = await renderLearn('en', {
    ...HELP,
    scope: { topic: 'scope', markdown: '', corpus: { scoped: [], unscoped: [] } },
    capture: { topic: 'capture', markdown: '', corpus: { recent: [{ id: '', title: 'x' }] } },
  });
  assert.deepEqual(
    elementsOf(empty.root).filter((n) => n.tag === 'button' && n.className === 'linkid m').map(textOf), []);
  // And all four rows still end somewhere: an unusable join is the mark.
  assert.equal(rowsOf(empty.root).filter((row) => markOf(row) !== null).length, 4);

  const wrong = await renderLearn('en', {
    ...HELP,
    scope: { topic: 'scope', markdown: '', corpus: null },
    capture: { topic: 'capture', markdown: '', corpus: { recent: [{ id: 7 }] } },
  });
  assert.deepEqual(
    elementsOf(wrong.root).filter((n) => n.tag === 'button' && n.className === 'linkid m').map(textOf), []);
  assert.equal(rowsOf(wrong.root).filter((row) => markOf(row) !== null).length, 4);
});

/**
 * **Unverifiable is not the same as absent.** When `/api/items` or
 * `/api/config` cannot be read, the two facts a cross-link is checked against
 * are unknown — so a linked row draws the reason rather than an unchecked id
 * (which is the defect) or the `◌` mark (which would claim a search was run
 * and found nothing). The two rows whose join carries no id at all never
 * depended on that read and are unaffected.
 */
test('a failed shared read costs the linked rows their id and says so — it never guesses', async () => {
  for (const missing of ['/api/items', '/api/config']) {
    const shared = { ...SHARED };
    delete shared[missing];
    const { root } = await renderLearn('en', HELP, shared);
    const rows = rowsOf(root);

    assert.deepEqual(rows.map(linkOf), [null, null, null, null],
      `${missing} was unreadable and an unchecked id was drawn anyway`);
    // categories and workflow are still marked; scope and capture are not —
    // they carry the server's sentence instead.
    assert.deepEqual(rows.map((row) => markOf(row) !== null), [true, false, false, true]);
    const spills = elementsOf(root).filter((node) => node.className === 'small spill');
    assert.equal(spills.length, 2);
    for (const spill of spills) assert.match(textOf(spill), new RegExp(`${missing} is unavailable`));
  }
});

// ── 7. A refused topic replaces that row's cross-link, never the table ─────

test('a refusal is drawn per row, in the server\'s own words, and the other three rows still answer', async () => {
  const { root } = await renderLearn('en', { categories: HELP['categories'], scope: HELP['scope'] });
  const spills = elementsOf(root).filter((node) => node.className === 'small spill');
  assert.equal(spills.length, 2, 'capture and workflow were refused; categories and scope answered');
  assert.deepEqual(spills.map((node) => node.tag), ['p', 'p']);
  for (const spill of spills) {
    assert.match(textOf(spill), /^no help topic "(capture|workflow)" — topics served here: /,
      'the endpoint\'s own sentence is shown as it arrived, not paraphrased');
  }
  // Still four rows: a refusal is one row's news, not the table's.
  assert.equal(elementsOf(root).filter((node) => node.tag === 'tr').length, 4);
  // And the row that DID answer still drew its marked, clickable id.
  assert.deepEqual(
    elementsOf(root).filter((n) => n.tag === 'button' && n.className === 'linkid m').map(textOf),
    ['INV-prices-are-integer-cents']);
});

// ── 8. The heading, and the verdict that is not the other twenty screens' ──

test('the screen opens with the mockup\'s ⚠️ verdict, the glyph outside the translated span', async () => {
  const { root } = await renderLearn('en');
  const phd = root.children.find((child) => child.className === 'phd')!;
  const verdict = phd.children.find((child) => child.className === 'verdict')!;
  // The glyph is a SIBLING of the translated span, never inside it: a
  // translated element's children are replaced wholesale from the string table,
  // which knows nothing of a glyph someone nested inside one.
  assert.equal(verdict.children[0]!.tag, '#text');
  assert.equal(verdict.children[0]!.textContent, '⚠️ ');
  assert.equal(verdict.children[1]!.tag, 'span');
  assert.equal(verdict.children[1]!.className, '');
  // And it is the mockup's glyph for THIS screen — nineteen of twenty-one open
  // ✅, and `status` and `learn` open ⚠️.
  assert.match(learnSection(), /<span class="verdict">⚠️ <span data-t="ln\.v">/);
});
