/**
 * `screens/tut.js` — the Tutorials screen — measured against the design of
 * record, in Node, with no browser.
 *
 * **THE LIMIT, stated first and not papered over.** Spec §6 puts the DOM glue
 * in `app.js` and `screens/*.js` outside the tested surface, and
 * `test/ui/viewmodel.test.ts`'s own header says so in the same words: *"A
 * green run here verifies the view-models, not the pixels."* Nothing below
 * checks a pixel, a stylesheet rule, a layout, an event or anything the real
 * `Document` does that a twenty-line stand-in does not. What it does check is
 * the half of this screen that is a DECISION rather than a rendering, and on
 * this screen that half is unusually large: with no plan behind it, the
 * mockup's own markup is the entire specification, so every claim the module
 * makes about it — which six tutorials, in which order, written in which
 * language, under which keys — is a claim this file resolves against
 * `docs/design/web-ui-mockup.html` itself rather than against a copy of it
 * typed out here.
 *
 * ── HOW A BROWSER MODULE THAT IMPORTS `/screens/parts.js` IS IMPORTED ─────
 *
 * `screens/tut.js` is a plain browser ES module and its one import is
 * ROOT-ABSOLUTE — `/screens/parts.js` — because that is what the browser
 * resolves against the server's document root. Node resolves the same
 * specifier against the filesystem root: on Windows the WHATWG parser keeps
 * the parent's drive letter, so it becomes `D:/screens/parts.js`, which does
 * not exist. `viewmodel.test.ts`'s `file://` URL specifier is therefore
 * necessary and not sufficient here — it gets `tut.js` loaded, and `tut.js`'s
 * own import then fails.
 *
 * So this file registers a synchronous resolve hook (`node:module`'s
 * `registerHooks`, Node ≥22.15) that maps a root-absolute specifier onto
 * `src/ui/public/`, which is exactly what `src/ui/server.ts` serves it as.
 * Two things this deliberately does NOT do: it does not touch the screen
 * module (a dynamic `await import('/screens/parts.js')` inside `render()`
 * would make this file's job easier and make the screen the odd one out among
 * eleven), and it does not fake `parts.js` (the composites under test —
 * `screenHead`, `spaced` — are the mockup's shapes, and a stub of them would
 * assert this file's idea of the design rather than the shipped one). The
 * hook is in-process and each test file runs in its own process, so nothing
 * here reaches another test.
 *
 * ── WHAT IS TESTED, AND WHY EACH ONE COULD FAIL FOR A REAL REASON ─────────
 *
 *   1. The six rows ARE the mockup's six rows — key for key, state for state,
 *      in its order. This is the assertion the screen exists to keep true.
 *   2. The header row is the mockup's: two translated keys, then two
 *      untranslated language tags.
 *   3. `cellSpec` draws the mockup's own chip (`class="chip warn"`,
 *      `data-g="▲"`, `tu.todo`) and its own ✅, and REFUSES anything else.
 *   4. Every `tu.` key the module names is declared in BOTH string tables, and
 *      the set is exactly the set the mockup's section declares — the same
 *      check `viewmodel.test.ts` runs over `app.js`, for the same reason:
 *      `t()` throws on a key it cannot find, so a typo blanks the screen.
 *   5. `render()` over a stand-in document produces every element KIND the
 *      mockup's section produces, except `b`. That is the ledger entry this
 *      task reports to `e2e/screen-parity.spec.ts`, measured here rather than
 *      asserted in prose — and it is the closest this file comes to the
 *      untested surface, so read what it is: a shape comparison over fake
 *      nodes, not a rendering. The real comparison, over a real browser and a
 *      real stylesheet, is that spec's and stays that spec's.
 *
 * The same `render()` call also pins that this screen READS NOTHING: the `ctx`
 * it is given throws from `api`, `stream`, `session`, `navigate` and `tFlat`,
 * and only `t` is real. `/api/help/:topic` serves four topics and
 * `mycontext help` knows seven; none of them is a tutorial, and the screen's
 * header explains that at length.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

/**
 * The document root, resolved the way the server resolves it
 * (`src/ui/server.ts` · `registerRoute('GET', '/api/help/:topic', {` · ~157 is
 * the API half; the static half serves this directory). Only root-absolute
 * specifiers are intercepted — every `node:` and relative import in this file
 * still goes through `nextResolve`.
 */
registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

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
 * The four methods `screens/parts.js` and `lib/i18n.js` touch on an element —
 * `className`, `textContent`, `dataset`, `append` — plus the two `spaced()`
 * and `render()` need, `style.setProperty` and `replaceChildren`. No more than
 * that, on purpose: a fuller fake would invite tests this file has no business
 * running.
 */
function element(tag: string): FakeNode & {
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: () => void;
  style: { declarations: Record<string, string>; setProperty: (name: string, value: string) => void };
} {
  const declarations: Record<string, string> = {};
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
    style: {
      declarations,
      setProperty: (name: string, value: string): void => { declarations[name] = value; },
    },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

interface TutorialRow { title: string; job: string; en: string; he: string }

interface TutModule {
  DONE: string;
  TODO: string;
  TUTORIALS: TutorialRow[];
  HEAD_KEYS: string[];
  LANG_COLUMNS: string[];
  cellSpec: (state: string) => { kind: string; glyph: string; className?: string; key?: string };
  render: (root: ReturnType<typeof element>, ctx: unknown) => void;
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

const tut = (): Promise<TutModule> => browserModule<TutModule>('screens', 'tut.js');
const i18n = (): Promise<I18nModule> => browserModule<I18nModule>('lib', 'i18n.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

// ── The design of record, parsed ────────────────────────────────────────────

const MOCKUP = readFileSync(path.join(REPO, 'docs', 'design', 'web-ui-mockup.html'), 'utf8');

/**
 * `<section data-p="tut">`'s INNER html — the opening tag excluded, because
 * `e2e/screen-parity.spec.ts` compares `root.querySelectorAll('*')` and the
 * section itself is the root on both sides
 * (`e2e/screen-parity.spec.ts` · `for (const el of root.querySelectorAll<HTMLElement>('*'))` · ~62).
 */
function tutSection(): string {
  const open = MOCKUP.indexOf('<section data-p="tut"');
  assert.notEqual(open, -1, 'the mockup no longer has a <section data-p="tut">');
  const end = MOCKUP.indexOf('</section>', open);
  assert.notEqual(end, -1, 'the mockup\'s tut section is unterminated');
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

/** Every element kind the module's `render()` builds, same form. */
function renderedKinds(root: FakeNode): string[] {
  const kinds = new Set<string>();
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text') continue;
      const raw = child.className.trim();
      kinds.add(raw === '' ? child.tag : `${child.tag}.${raw.split(/\s+/).sort().join('.')}`);
      walk(child);
    }
  };
  walk(root);
  return [...kinds].sort();
}

/** The chip the mockup draws in a "to write" cell, as attributes. */
function mockupChip(): { className: string; glyph: string; key: string } {
  const found = /<span class="([^"]*)" data-g="([^"]*)" data-t="([^"]*)">/.exec(tutSection());
  assert.ok(found, 'the mockup\'s tut section no longer draws a chip');
  return { className: found[1]!, glyph: found[2]!, key: found[3]! };
}

/**
 * The mockup's `<tbody>`, row by row, as the module's own row shape.
 *
 * A cell is `done` when it holds the bare ✅ and `todo` when it holds the
 * chip; there is no third reading, and a cell that is neither fails here
 * rather than being classified as one of the two.
 */
function mockupRows(): TutorialRow[] {
  const section = tutSection();
  const body = section.slice(section.indexOf('<tbody>') + '<tbody>'.length, section.indexOf('</tbody>'));
  const rows: TutorialRow[] = [];
  for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    assert.equal(cells.length, 4, `a tut row has ${cells.length} cells, not four: ${row[1]!}`);
    const state = (html: string): string => {
      if (html.trim() === '✅') return 'done';
      const key = attr(html, 'data-t');
      assert.equal(key, 'tu.todo', `a language cell is neither ✅ nor the tu.todo chip: ${html}`);
      return 'todo';
    };
    rows.push({
      title: attr(cells[0]![1]!, 'data-t')!,
      job: attr(cells[1]![1]!, 'data-t')!,
      en: state(cells[2]![2]!),
      he: state(cells[3]![2]!),
    });
  }
  return rows;
}

// ── The tests ───────────────────────────────────────────────────────────────

test('the six tutorials are the mockup\'s six, in its order and with its states', async () => {
  const { TUTORIALS } = await tut();
  const drawn = mockupRows();
  assert.equal(drawn.length, 6, 'the mockup no longer draws six tutorials');
  // deepEqual over the whole table rather than field by field: a transposed
  // pair of jobs, a row in the wrong place and a ✅ where the mockup draws a
  // chip are the three ways this can go wrong, and one comparison catches all
  // three with the diff printed.
  assert.deepEqual(TUTORIALS, drawn);
  // Five of six Hebrew cells and one English cell read "to write" — the count
  // the spec's §4 correction states in prose, held here as a number so that a
  // row quietly flipped to ✅ fails even if it flipped in both files.
  assert.equal(TUTORIALS.filter((row) => row.en === 'todo').length, 1);
  assert.equal(TUTORIALS.filter((row) => row.he === 'todo').length, 6);
});

test('the header row is the mockup\'s: two translated keys, then EN and HE as literals', async () => {
  const { HEAD_KEYS, LANG_COLUMNS } = await tut();
  const section = tutSection();
  const head = section.slice(section.indexOf('<thead>'), section.indexOf('</thead>'));
  const translated: string[] = [];
  const literals: string[] = [];
  for (const th of head.matchAll(/<th([^>]*)>([^<]*)<\/th>/g)) {
    const key = attr(th[1]!, 'data-t');
    if (key === null) literals.push(th[2]!);
    else translated.push(key);
  }
  assert.deepEqual(HEAD_KEYS, translated);
  // The two language tags carry no `data-t` in the mockup and no key in either
  // string table, so they stay `EN` and `HE` in the Hebrew UI. That is the
  // design of record's ruling, pinned here so the day a key appears for them
  // this test is what says the module may now use it.
  assert.deepEqual(LANG_COLUMNS, literals);
});

test('cellSpec draws the mockup\'s own chip and its own glyph, and refuses anything else', async () => {
  const { DONE, TODO, cellSpec } = await tut();
  const chip = mockupChip();
  assert.deepEqual(cellSpec(DONE), { kind: 'glyph', glyph: '✅' });
  assert.deepEqual(cellSpec(TODO), {
    kind: 'chip', className: chip.className, glyph: chip.glyph, key: chip.key,
  });
  // The refusal is the point: a default branch here would draw a ✅ over a
  // tutorial nobody wrote, which is a false statement about the repository
  // rather than a rendering defect.
  assert.throws(() => cellSpec('partly'), /unknown language-cell state/);
  assert.throws(() => cellSpec(''), /unknown language-cell state/);
});

test('every string key the module names is declared in both tables, and it is the mockup\'s set', async () => {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'tut.js'), 'utf8');
  // QUOTED keys only. The header comment discusses `tu.todo` and friends in
  // backticks, and a scan that read those would pass on a key the code never
  // reaches — the same discrimination `viewmodel.test.ts` makes over `app.js`.
  const named = new Set([...source.matchAll(/'(tu\.[A-Za-z0-9]+)'/g)].map((m) => m[1]!));
  const drawn = new Set([...tutSection().matchAll(/data-t="(tu\.[A-Za-z0-9]+)"/g)].map((m) => m[1]!));
  assert.ok(named.size > 0, 'the module names no tu. keys at all');
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

test('render draws every kind the mockup draws, except the bold run no table can carry', async () => {
  const { render } = await tut();
  const { t } = await i18n();
  const en = (await table('en')).strings;

  // `t` is the only member of the contract this screen may touch: it reads no
  // endpoint, opens no stream and navigates nowhere. The other five throw, so
  // a future edit that reaches for one fails here with that sentence rather
  // than silently acquiring a dependency the screen's header denies it has.
  const refuse = (name: string) => () => {
    throw new Error(`tut must not use ctx.${name}`);
  };
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(en, key, subs, doc),
    api: refuse('api'),
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
    render(root, ctx);
  } finally {
    if (!had) delete globals.document;
  }

  const drawn = kindsOf(tutSection());
  const built = renderedKinds(root);
  // **The fourth marker landed, so the filter is gone.** `b` is `tu.gap`'s
  // bolded "to write". The run grammar had three markers and no emphasis one,
  // so no string table could carry it; `{b:}` and `{i:}` landed 2026-08-25 and
  // English was populated from the mockup's own markup. The previous version of
  // this assertion said in as many words that the day a fourth marker landed it
  // would fail and the ledger entry could come out. It did, and it has.
  assert.deepEqual(built, drawn,
    'the render no longer draws exactly the mockup\'s kinds. This used to exclude `b` for a '
    + 'grammar limit that no longer exists, so a difference here now is a real one.');
  assert.ok(drawn.includes('b'), 'the mockup no longer bolds a run inside tu.gap');

  // The gap note gets its margin through CSSOM and not a `style` attribute:
  // the server sends `style-src 'self'` with no `'unsafe-inline'`, so the
  // mockup's own `style="margin-block-start:8px"` is the one thing on this
  // screen that may NOT be transcribed literally.
  const card = root.children.find((child) => child.className === 'card pane')!;
  const note = card.children.find((child) => child.tag === 'p')! as ReturnType<typeof element>;
  assert.equal(note.style.declarations['margin-block-start'], '8px');
});
