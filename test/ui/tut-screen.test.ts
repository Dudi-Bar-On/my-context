/**
 * `screens/tut.js` — the Tutorials screen — measured against the design of
 * record, in Node, with no browser.
 *
 * **THE LIMIT, stated first and not papered over.** Spec §6 puts the DOM glue
 * in `app.js` and `screens/*.js` outside the tested surface, and
 * `test/ui/viewmodel.test.ts`'s own header says so in the same words: *"A
 * green run here verifies the view-models, not the pixels."* Nothing below
 * checks a pixel, a stylesheet rule, a layout, an event or anything the real
 * `Document` does that a twenty-line stand-in does not.
 *
 * **What changed since this file was first written.** The screen used to hard
 * -code its twelve EN/HE cells and read no endpoint at all —
 * `TASK-no-endpoint-serves-tutorial-state-so-twelve-cells-are-hard` records
 * why that was a claim nobody had checked. It now awaits `GET /api/tutorials`
 * and draws whatever it answers; the actual computation is `read-model.ts`'s
 * `apiTutorials`, pinned against this repository in
 * `test/ui/tutorials-endpoint.test.ts`, not here. What is still this file's to
 * hold is everything the mockup itself settles: which six tutorials, in which
 * order, under which keys, and what shape each of the three cell states draws.
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
 * `screenHead`, `spaced`, `errorNote` — are the mockup's shapes, and a stub of
 * them would assert this file's idea of the design rather than the shipped
 * one). The hook is in-process and each test file runs in its own process, so
 * nothing here reaches another test.
 *
 * ── WHAT IS TESTED, AND WHY EACH ONE COULD FAIL FOR A REAL REASON ─────────
 *
 *   1. `TUTORIAL_ROWS` names the mockup's six rows — key for key, in its
 *      order. This is the CONTENT half of the screen's promise.
 *   2. The header row is the mockup's: two translated keys, then two
 *      untranslated language tags.
 *   3. `cellSpec` draws the mockup's own chip for `TODO` (`class="chip warn"`,
 *      `data-g="▲"`, `tu.todo`), its own ✅ for `DONE`, the shared unmeasured
 *      primitive for `UNMEASURED` (`class="chip unmeas"`, `data-g="◌"`,
 *      `strip.unmeasured` — the same key and shape `doctor.js`, `watch.js` and
 *      `app.js` already draw), and REFUSES anything else.
 *   4. Every `tu.` key the module names is declared in BOTH string tables, and
 *      the set is exactly the set the mockup's section declares — the same
 *      check `viewmodel.test.ts` runs over `app.js`, for the same reason:
 *      `t()` throws on a key it cannot find, so a typo blanks the screen.
 *      `strip.unmeasured`, the one key this screen borrows rather than owns,
 *      is checked the same way, separately.
 *   5. `render()`, fed the endpoint's OWN shape through a stub `ctx.api`,
 *      produces every element KIND the mockup's section produces when the
 *      states match the mockup's, except `b`. That is the ledger entry this
 *      task reports to `e2e/screen-parity.spec.ts`, measured here rather than
 *      asserted in prose.
 *   6. `render()` draws the `unmeasured` chip's shape when the endpoint
 *      answers it, and draws the endpoint's own refusal message — never a
 *      table beside it — when the call rejects.
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
 * (`src/ui/server.ts` · `registerRoute('GET', '/api/help/:topic', {` · ~169 is
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

interface TutorialRow { title: string; job: string }
interface TutorialRowState { en: string; he: string }

interface TutModule {
  DONE: string;
  TODO: string;
  UNMEASURED: string;
  TUTORIAL_ROWS: TutorialRow[];
  HEAD_KEYS: string[];
  LANG_COLUMNS: string[];
  cellSpec: (state: string) => { kind: string; glyph: string; className?: string; key?: string };
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
 * (`e2e/screen-parity.spec.ts` · `for (const el of root.querySelectorAll<HTMLElement>('*'))` · ~61).
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

/** The mockup's `<tbody>`, row by row, as `{ title, job }` KEYS. */
function mockupRows(): TutorialRow[] {
  const section = tutSection();
  const body = section.slice(section.indexOf('<tbody>') + '<tbody>'.length, section.indexOf('</tbody>'));
  const rows: TutorialRow[] = [];
  for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    assert.equal(cells.length, 4, `a tut row has ${cells.length} cells, not four: ${row[1]!}`);
    rows.push({ title: attr(cells[0]![1]!, 'data-t')!, job: attr(cells[1]![1]!, 'data-t')! });
  }
  return rows;
}

/**
 * The mockup's `<tbody>`, row by row, as `{ en, he }` STATES — `done` for a
 * bare ✅, `todo` for the `tu.todo` chip. Used only to feed `render()` the
 * mockup's OWN states through a stub `ctx.api`, so the kind-parity test below
 * measures the code against states the design of record actually draws,
 * rather than against a state (`unmeasured`) the mockup predates.
 */
function mockupStates(): TutorialRowState[] {
  const section = tutSection();
  const body = section.slice(section.indexOf('<tbody>') + '<tbody>'.length, section.indexOf('</tbody>'));
  const states: TutorialRowState[] = [];
  for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    const state = (html: string): string => {
      if (html.trim() === '✅') return 'done';
      const key = attr(html, 'data-t');
      assert.equal(key, 'tu.todo', `a language cell is neither ✅ nor the tu.todo chip: ${html}`);
      return 'todo';
    };
    states.push({ en: state(cells[2]![2]!), he: state(cells[3]![2]!) });
  }
  return states;
}

/** The mockup's `"to write"` chip, as attributes. */
function mockupChip(): { className: string; glyph: string; key: string } {
  const found = /<span class="([^"]*)" data-g="([^"]*)" data-t="([^"]*)">/.exec(tutSection());
  assert.ok(found, 'the mockup\'s tut section no longer draws a chip');
  return { className: found[1]!, glyph: found[2]!, key: found[3]! };
}

// ── The tests ───────────────────────────────────────────────────────────────

test('TUTORIAL_ROWS names the mockup\'s six rows, in its order', async () => {
  const { TUTORIAL_ROWS } = await tut();
  const drawn = mockupRows();
  assert.equal(drawn.length, 6, 'the mockup no longer draws six tutorials');
  assert.deepEqual(TUTORIAL_ROWS, drawn);
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
  assert.deepEqual(LANG_COLUMNS, literals);
});

test('cellSpec draws the mockup\'s chip, the shared unmeasured primitive, and refuses anything else', async () => {
  const { DONE, TODO, UNMEASURED, cellSpec } = await tut();
  const chip = mockupChip();
  assert.deepEqual(cellSpec(DONE), { kind: 'glyph', glyph: '✅' });
  assert.deepEqual(cellSpec(TODO), {
    kind: 'chip', className: chip.className, glyph: chip.glyph, key: chip.key,
  });
  // The shared `.chip.unmeas` primitive — `doctor.js`'s, `watch.js`'s and
  // `app.js`'s own shape, reused rather than given a fourth spelling.
  assert.deepEqual(cellSpec(UNMEASURED), {
    kind: 'chip', className: 'chip unmeas', glyph: '◌', key: 'strip.unmeasured',
  });
  // The refusal is the point: a default branch here would draw a false
  // statement about the repository rather than fail loudly.
  assert.throws(() => cellSpec('partly'), /unknown language-cell state/);
  assert.throws(() => cellSpec(''), /unknown language-cell state/);
});

test('every tu. key the module names is declared in both tables, and it is the mockup\'s set', async () => {
  const source = readFileSync(path.join(PUBLIC, 'screens', 'tut.js'), 'utf8');
  // QUOTED keys only. The header comment discusses `tu.todo` and friends in
  // backticks, and a scan that read those would pass on a key the code never
  // reaches — the same discrimination `viewmodel.test.ts` makes over `app.js`.
  const named = new Set([...source.matchAll(/'(tu\.[A-Za-z0-9]+)'/g)].map((m) => m[1]!));
  const drawn = new Set([...tutSection().matchAll(/data-t="(tu\.[A-Za-z0-9]+)"/g)].map((m) => m[1]!));
  assert.ok(named.size > 0, 'the module names no tu. keys at all');
  assert.deepEqual([...named].sort(), [...drawn].sort());

  const en = (await table('en')).strings;
  const he = (await table('he')).strings;
  for (const key of named) {
    assert.ok(Object.hasOwn(en, key), `en.js does not declare ${key}`);
    assert.ok(Object.hasOwn(he, key), `he.js does not declare ${key}`);
  }
  // `strip.unmeasured` is `app.js`'s key, borrowed rather than owned here — so
  // it does not match the `tu.` prefix the scan above looks for, and is
  // checked on its own line for the same reason the others are.
  assert.ok(Object.hasOwn(en, 'strip.unmeasured'), 'en.js does not declare strip.unmeasured');
  assert.ok(Object.hasOwn(he, 'strip.unmeasured'), 'he.js does not declare strip.unmeasured');
});

test('render, fed the mockup\'s own states, draws every kind the mockup draws except the bold run', async () => {
  const { render } = await tut();
  const { t } = await i18n();
  const en = (await table('en')).strings;
  const states = mockupStates();

  const refuse = (name: string) => () => {
    throw new Error(`tut must not use ctx.${name}`);
  };
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(en, key, subs, doc),
    api: async (path: string) => {
      assert.equal(path, '/api/tutorials');
      return { tutorials: states };
    },
    stream: refuse('stream'),
    session: refuse('session'),
    navigate: refuse('navigate'),
    tFlat: refuse('tFlat'),
  };

  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  const root = element('section');
  try {
    await render(root, ctx);
  } finally {
    if (!had) delete globals.document;
  }

  const drawn = kindsOf(tutSection());
  const built = renderedKinds(root);
  assert.deepEqual(built, drawn,
    'the render no longer draws exactly the mockup\'s kinds, fed the mockup\'s own states.');
  assert.ok(drawn.includes('b'), 'the mockup no longer bolds a run inside tu.gap');

  const card = root.children.find((child) => child.className === 'card pane')!;
  const note = card.children.find((child) => child.tag === 'p')! as ReturnType<typeof element>;
  assert.equal(note.style.declarations['margin-block-start'], '8px');
});

test('render draws the unmeasured chip\'s shape when the endpoint answers it', async () => {
  const { render, UNMEASURED } = await tut();
  const { t } = await i18n();
  const en = (await table('en')).strings;

  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(en, key, subs, doc),
    api: async () => ({
      tutorials: Array.from({ length: 6 }, () => ({ en: UNMEASURED, he: UNMEASURED })),
    }),
    stream: () => { throw new Error('unused'); },
    session: () => { throw new Error('unused'); },
    navigate: () => { throw new Error('unused'); },
    tFlat: () => { throw new Error('unused'); },
  };

  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  const root = element('section');
  try {
    await render(root, ctx);
  } finally {
    if (!had) delete globals.document;
  }

  const card = root.children.find((c) => c.className === 'card pane')!;
  const table_ = card.children.find((c) => c.tag === 'table')!;
  const tbody = table_.children.find((c) => c.tag === 'tbody')!;
  for (const row of tbody.children) {
    for (const cell of row.children.slice(2)) {
      const chip = cell.children[0]!;
      assert.equal(chip.className, 'chip unmeas');
      assert.equal(chip.dataset['g'], '◌');
    }
  }
});

test('render draws the endpoint\'s own refusal instead of a table, and nothing else', async () => {
  const { render } = await tut();
  const { t } = await i18n();
  const en = (await table('en')).strings;
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(en, key, subs, doc),
    api: async () => { throw new Error('mycontext ui: /api/tutorials refused — corpus unreadable'); },
    stream: () => { throw new Error('unused'); },
    session: () => { throw new Error('unused'); },
    navigate: () => { throw new Error('unused'); },
    tFlat: () => { throw new Error('unused'); },
  };

  const globals = globalThis as unknown as { document?: unknown };
  const had = Object.hasOwn(globals, 'document');
  globals.document = doc;
  const root = element('section');
  try {
    await render(root, ctx);
  } finally {
    if (!had) delete globals.document;
  }

  assert.equal(root.children.filter((c) => c.tag === 'table').length, 0,
    'a refusal must not be drawn beside a table — the two are different facts');
  const note = root.children.find((c) => c.className === 'small spill');
  assert.ok(note, 'the endpoint\'s refusal must be drawn');
  assert.equal(note!.textContent, 'mycontext ui: /api/tutorials refused — corpus unreadable');
});
