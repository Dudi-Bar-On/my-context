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
 * `mono()` run. The remaining entry is `i` alone — the mockup italicises one
 * word inside `ln.sub` and `lib/i18n.js`'s run grammar has `{m:}`, `{mv:}`
 * and `{name}` and no emphasis marker, so no string table can carry it.
 * `assertions 4 and 6` below are what will fail the day either of those two
 * facts changes.
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
 * (`e2e/screen-parity.spec.ts` · `for (const el of root.querySelectorAll<HTMLElement>('*'))` · ~62).
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
 * builds (`src/ui/read-model.ts` · `export function apiHelp(` · ~1531).
 * `markdown` is present and non-trivial on every one because the screen fetches
 * it and draws none of it — a claim worth being able to break.
 */
const HELP: Record<string, unknown> = {
  categories: {
    topic: 'categories',
    markdown: '# Categories\n\nwhich are normative.\n',
    corpus: { counts: { CONST: 2, INV: 1 }, empty: ['DEC'] },
  },
  scope: {
    topic: 'scope',
    markdown: '# Scope\n\nhow scope restricts.\n',
    corpus: {
      scoped: [
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

/** The two rows the joins above give an id to, in the module's own order. */
const APP_CROSS_LINKS = ['INV-prices-are-integer-cents', 'CONST-zero-runtime-dependencies'];

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
  // Both directions. A key in the mockup the module never names is a piece of
  // the screen that was not built; a key the module names that the mockup does
  // not declare is a key `strings-parity.test.ts` would fail on next.
  assert.deepEqual([...named].sort(), [...drawn].sort());

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
  assert.deepEqual(asked, [
    '/api/help/categories', '/api/help/scope', '/api/help/capture', '/api/help/workflow',
  ]);
});

// ── 4. The kinds: everything the mockup draws except the italic run ────────

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
  const drawn = kindsOf(learnSection());
  assert.deepEqual(drawn, [
    'div.card.pane', 'div.phd', 'h2', 'i', 'p.psub', 'span', 'span.m', 'span.verdict',
    'table', 'tbody', 'td.m', 'td.small', 'tr',
  ], 'the mockup section changed shape — re-measure before touching the screen');

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
  // So BOTH branches expect the mockup's full list now, italic included. If the
  // Hebrew branch loses `i` again, an emphasis run has been dropped from the
  // Hebrew table — that is a regression, not a pending translation.
  const { root: enRoot } = await renderLearn('en');
  assert.deepEqual(renderedKinds(enRoot), drawn,
    'the English render no longer draws exactly the mockup\'s kinds, italic included');
  const { root: heRoot } = await renderLearn('he');
  assert.deepEqual(renderedKinds(heRoot), drawn,
    'the Hebrew render no longer draws the italic run. `ln.sub` carries `{i:}` in he.js as of '
    + '2026-08-27; losing it is a dropped emphasis run, not unfinished work.');

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
 */
test('every machine-text run carries .m — the topic names and the cross-linked ids', async () => {
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

    // The cross-linked id: a `span.m`, the mockup's own shape, one per row
    // whose join carries one.
    const runs = elements.filter((node) => node.tag === 'span' && node.className === 'm');
    assert.deepEqual(runs.map(textOf), APP_CROSS_LINKS,
      `${lang}: the corpus ids are not drawn as marked monospace runs`);

    // The separator is a SIBLING of the run, never inside it — the mockup's own
    // arrangement. Pulled inside, it joins the isolate and is laid out as part
    // of the identifier, which in the Hebrew page puts it at the far end of the
    // id instead of between the description and it.
    for (const run of runs) {
      assert.equal(run.children.length, 0, 'an id run holds text and nothing else');
    }
    const cells = elements.filter((node) => node.tag === 'td' && node.className === 'small');
    const linked = cells.filter((cell) => cell.children.some((c) => c.className === 'm'));
    assert.equal(linked.length, 2, `${lang}: two of the four rows carry a cross-link`);
    for (const cell of linked) {
      const marker = cell.children.findIndex((child) => child.className === 'm');
      assert.equal(cell.children[marker - 1]!.tag, '#text');
      assert.equal(cell.children[marker - 1]!.textContent, ' · ',
        'the separator sits beside the run, unmarked and outside the isolate');
    }
  }
});

// ── 6. The rows with no id draw no cross-link, and no placeholder ──────────

/**
 * `categories` answers `{ counts, empty }` and `workflow` answers
 * `{ drafts, pendingRevisions }`. Neither carries an item id, and the module's
 * header says why inventing one would be a claim the response does not make.
 * The mockup DOES draw an id on its categories row
 * (`CONST-zero-runtime-dependencies`) — so this is the one place the app's
 * cross-links and the mockup's sit on different rows, and that divergence is
 * pinned here rather than left to be rediscovered.
 */
test('a row whose join carries no item id draws its description and stops', async () => {
  const { root } = await renderLearn('en');
  const rows = elementsOf(root).filter((node) => node.tag === 'tr');
  assert.equal(rows.length, 4);

  const linkedRows = rows
    .filter((row) => elementsOf(row).some((node) => node.className === 'm' && node.tag === 'span'))
    .map((row) => textOf(row.children[0]!));
  assert.deepEqual(linkedRows, ['scope', 'capture']);

  // The mockup's own two, for the record: they are NOT the same two.
  const mockupLinked = [...learnSection().matchAll(/<td class="m">([a-z]+)<\/td><td class="small">/g)]
    .map((m) => m[1]!);
  assert.deepEqual(mockupLinked, ['categories', 'scope'],
    'the mockup cross-links categories and scope; the endpoints carry ids for scope and capture');

  // No placeholder, no dash, no empty run: the unlinked rows are the description
  // and nothing after it.
  for (const row of rows) {
    const topic = textOf(row.children[0]!);
    if (topic === 'scope' || topic === 'capture') continue;
    assert.equal(textOf(row.children[1]!).includes('·'), false,
      `${topic} drew a separator with nothing after it`);
  }
});

/** An empty list, and an entry whose `id` is not a usable string, are the same answer. */
test('an empty or malformed join is not a cross-link', async () => {
  const empty = await renderLearn('en', {
    ...HELP,
    scope: { topic: 'scope', markdown: '', corpus: { scoped: [], unscoped: [] } },
    capture: { topic: 'capture', markdown: '', corpus: { recent: [{ id: '', title: 'x' }] } },
  });
  assert.deepEqual(
    elementsOf(empty.root).filter((n) => n.tag === 'span' && n.className === 'm').map(textOf), []);

  const wrong = await renderLearn('en', {
    ...HELP,
    scope: { topic: 'scope', markdown: '', corpus: null },
    capture: { topic: 'capture', markdown: '', corpus: { recent: [{ id: 7 }] } },
  });
  assert.deepEqual(
    elementsOf(wrong.root).filter((n) => n.tag === 'span' && n.className === 'm').map(textOf), []);
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
  // And the row that DID answer still drew its marked id.
  assert.deepEqual(
    elementsOf(root).filter((n) => n.tag === 'span' && n.className === 'm').map(textOf),
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
