/**
 * `screens/status.js` — the Status screen — measured against the design of
 * record, in Node, with no browser.
 *
 * **THE LIMIT, stated first and not papered over.** Spec §6 puts the DOM glue
 * in `app.js` and `screens/*.js` outside the tested surface, and
 * `test/ui/viewmodel.test.ts`'s own header says so in the same words: *"A green
 * run here verifies the view-models, not the pixels."* Nothing below checks a
 * pixel, a stylesheet rule, a layout or an event. What it checks is the set of
 * PROMISES this screen's own header makes, each of which is a claim about
 * elements and text rather than about rendering:
 *
 *   1. **Five rows, always** — the mockup's five keys, in the mockup's order,
 *      whatever the endpoint answered. `st.four` says *"There are four
 *      unfinished-work queues, not one"*, so a table that drew three would
 *      delete two of them silently, which is `INV-nothing-is-dropped-silently`.
 *   2. **Three real counts** — `items.total`, `reviewQueue.drafts` and
 *      `pendingRevisions.revisions`, grouped by `num`'s `en-US` rule, in the
 *      `.m` cell the mockup draws. **A real zero is `0`, never an em dash.**
 *   3. **Two em dashes** — `st.staged` and `st.ingest`, and only those two.
 *   4. **The em dash says nothing beyond itself.** No title, no aria, no
 *      second word: the cell holds one character. That is deliberate and it is
 *      also this screen's loudest open question, so it is pinned as a
 *      MEASUREMENT here rather than left in prose — the day a key exists to say
 *      WHY the number is absent, this assertion is what fails and says the cell
 *      may now carry it.
 *   5. **No invented English.** Every word on this screen comes from a string
 *      table, through `t()`, appended and never assigned; the one literal is
 *      the em dash, which is a mark and not a word.
 *   6. **The ledger entry, measured.** `render()` produces every element KIND
 *      `<section data-p="status">` produces except `b` — the bolded *four*
 *      inside `st.four`, which `lib/i18n.js`'s three-marker run grammar has no
 *      way to carry. That is the whole of `status: ['b']` in
 *      `e2e/screen-parity.spec.ts`, and the day a fourth marker lands THIS is
 *      what fails and says the entry may come out.
 *   7. **`td.small` is drawn by the app and by no part of the mockup's status
 *      section** — the other direction, which the parity gate does not check
 *      and nothing else would ever say out loud. It is the em dash cell, and it
 *      exists because the mockup invents a sample number for the two rows this
 *      server cannot count.
 *   8. **A refused read draws the endpoint's words INSTEAD of the table.**
 *   9. **Three fields of six are read.** Everything else `/api/status` serves
 *      arrives on every request and is discarded — the defect class this
 *      project has already filed once, on `InjectedLine.title` (plan:ui1
 *      seq:17f). Measured here rather than asserted in prose.
 *
 * ── HOW A BROWSER MODULE THAT IMPORTS `/screens/parts.js` IS IMPORTED ──────
 *
 * `screens/status.js` is a plain browser ES module and its one import is
 * ROOT-ABSOLUTE, because that is what the browser resolves against the server's
 * document root. Node resolves the same specifier against the filesystem root.
 * So this file registers a synchronous resolve hook (`node:module`'s
 * `registerHooks`) mapping a root-absolute specifier onto `src/ui/public/`,
 * exactly as `src/ui/server.ts` serves it — the same device
 * `test/ui/tut-screen.test.ts` uses, and for the same reason. `parts.js` is NOT
 * faked: the composites under test (`screenHead`, `spaced`, `errorNote`) are
 * the mockup's shapes, and a stub of them would assert this file's idea of the
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
const STATUS_JS = path.join(PUBLIC, 'screens', 'status.js');

const statusSource = readFileSync(STATUS_JS, 'utf8');

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
  attributes: Record<string, string>;
  children: FakeNode[];
}

function textNode(text: string): FakeNode {
  return {
    tag: '#text', className: '', textContent: text, dataset: {}, attributes: {}, children: [],
  };
}

interface FakeElement extends FakeNode {
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
  style: { declarations: Record<string, string>; setProperty: (n: string, v: string) => void };
}

/**
 * The members `screens/parts.js`, `lib/i18n.js` and `screens/status.js` touch
 * on an element, and no more than that on purpose: a fuller fake would invite
 * tests this file has no business running. `setAttribute` and `dataset` are
 * here not because this screen uses them but so that assertion 4 can prove it
 * does NOT — a cell that quietly grew a `title` would otherwise be invisible.
 */
function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    dataset: {},
    attributes: {},
    children: [],
    append: (...nodes) => {
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    replaceChildren: (...nodes) => {
      node.children.length = 0;
      for (const n of nodes) node.children.push(typeof n === 'string' ? textNode(n) : n);
    },
    setAttribute: (name, value) => { node.attributes[name] = value; },
    style: { declarations, setProperty: (n, v) => { declarations[n] = v; } },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

/** What a real `textContent` would read: this node's own text, then its children's. */
function textOf(node: FakeNode): string {
  return node.textContent + node.children.map(textOf).join('');
}

function descendants(node: FakeNode): FakeNode[] {
  return node.children.flatMap((child) => [child, ...descendants(child)]);
}

// ── The modules, loaded the way the browser loads them ──────────────────────

interface StatusModule {
  render: (root: FakeElement, ctx: unknown) => Promise<void>;
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

const statusScreen = (): Promise<StatusModule> =>
  browserModule<StatusModule>('screens', 'status.js');
const i18n = (): Promise<I18nModule> => browserModule<I18nModule>('lib', 'i18n.js');
const table = (lang: string): Promise<{ strings: Record<string, string> }> =>
  browserModule<{ strings: Record<string, string> }>('strings', `${lang}.js`);

/**
 * Renders into a stand-in `<section>` with the stand-in `document` installed.
 *
 * `screens/parts.js` reaches for the GLOBAL `document` — `el()` is the mockup's
 * own factory, argument for argument, and the mockup runs in a browser — so the
 * stand-in is installed rather than passed, and removed again immediately: a
 * global left behind would make any later test in this process think it is in a
 * browser.
 *
 * **Four members of `ctx` throw.** This screen reads ONE endpoint and does
 * nothing else: it opens no stream, joins no session, navigates nowhere and
 * flattens no string into an attribute. A future edit reaching for one fails
 * here with that sentence rather than silently acquiring a dependency the
 * screen's header denies it has.
 */
async function draw(api: (route: string) => Promise<unknown>): Promise<FakeElement> {
  const { render } = await statusScreen();
  const { t } = await i18n();
  const en = (await table('en')).strings;
  const refuse = (name: string) => () => {
    throw new Error(`status must not use ctx.${name}`);
  };
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => t(en, key, subs, doc),
    api,
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
  return root;
}

/** The `<tr>` elements of the one table, in document order. */
function rowsOf(root: FakeNode): FakeNode[] {
  return descendants(root).filter((node) => node.tag === 'tr');
}

// ── The design of record, parsed ────────────────────────────────────────────

const MOCKUP = readFileSync(path.join(REPO, 'docs', 'design', 'web-ui-mockup.html'), 'utf8');

/**
 * `<section data-p="status">`'s INNER html — the opening tag excluded, because
 * `e2e/screen-parity.spec.ts` compares `root.querySelectorAll('*')` and the
 * section itself is the root on both sides.
 */
function statusSection(): string {
  const open = MOCKUP.indexOf('<section data-p="status"');
  assert.notEqual(open, -1, 'the mockup no longer has a <section data-p="status">');
  const end = MOCKUP.indexOf('</section>', open);
  assert.notEqual(end, -1, "the mockup's status section is unterminated");
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

/** Every element kind `render()` built, same form. */
function renderedKinds(root: FakeNode): string[] {
  const kinds = new Set<string>();
  for (const node of descendants(root)) {
    if (node.tag === '#text') continue;
    const raw = node.className.trim();
    kinds.add(raw === '' ? node.tag : `${node.tag}.${raw.split(/\s+/).sort().join('.')}`);
  }
  return [...kinds].sort();
}

/** The five rows the mockup draws: label key, and the class its value cell wears. */
function mockupRows(): { key: string; valueClass: string; value: string }[] {
  const section = statusSection();
  const body = section.slice(
    section.indexOf('<tbody>') + '<tbody>'.length, section.indexOf('</tbody>'));
  const rows: { key: string; valueClass: string; value: string }[] = [];
  for (const row of body.matchAll(/<tr>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1]!.matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/g)];
    assert.equal(cells.length, 2, `a status row has ${cells.length} cells, not two: ${row[1]!}`);
    const key = attr(cells[0]![1]!, 'data-t');
    assert.ok(key, `a status row's label cell carries no data-t: ${cells[0]![0]!}`);
    rows.push({
      key,
      valueClass: (attr(cells[1]![1]!, 'class') ?? '').trim(),
      value: cells[1]![2]!.trim(),
    });
  }
  return rows;
}

// ── A served body, instrumented ─────────────────────────────────────────────

/** Which dotted paths of the served body the screen actually read. */
const READS: string[] = [];

/**
 * The same object, with every property replaced by a recording getter. Nested
 * objects are wrapped first, so `status.items.total` records `items` and then
 * `items.total` and the two are distinguishable.
 */
function recording<T extends object>(prefix: string, value: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, member] of Object.entries(value)) {
    const wrapped = (member !== null && typeof member === 'object')
      ? recording(`${prefix}${key}.`, member as object)
      : member;
    Object.defineProperty(out, key, {
      enumerable: true,
      get: () => { READS.push(`${prefix}${key}`); return wrapped; },
    });
  }
  return out as T;
}

/**
 * `GET /api/status`' body, field for field as `StatusBody` declares it
 * (`src/ui/read-model.ts`). The three numbers this screen draws are given
 * values no default and no hard-coded literal would produce; `revisions` is `0`
 * on purpose, because a real count of zero and a count this server does not
 * carry are two different facts and the screen must draw them differently.
 */
const BODY = (): Record<string, unknown> => ({
  version: '9.9.9',
  profile: 'minimal',
  items: {
    total: 4321,
    byCategory: { rule: 30, task: 273 },
    byStatus: { active: 338, draft: 1 },
    byOrigin: { human: 340, agent: 4 },
  },
  reviewQueue: { drafts: 7, always: 2, globalLayerDrafts: 1 },
  pendingRevisions: { revisions: 0, items: 0 },
  health: { errors: 5, warnings: 3, infos: 1 },
});

/** The top-level fields `StatusBody` declares, read off the interface itself. */
function servedFields(): string[] {
  const source = readFileSync(path.join(REPO, 'src', 'ui', 'read-model.ts'), 'utf8');
  const open = source.indexOf('export interface StatusBody {');
  assert.notEqual(open, -1, 'read-model.ts no longer declares StatusBody');
  const brace = source.indexOf('{', open);
  let depth = 0;
  let end = -1;
  for (let i = brace; i < source.length; i++) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) { end = i; break; }
    }
  }
  assert.notEqual(end, -1, 'StatusBody is never closed');
  // Top level only: a field declared inside a nested `{ … }` belongs to that
  // field, not to the body.
  const fields: string[] = [];
  let nesting = 0;
  for (const line of source.slice(brace + 1, end).split('\n')) {
    const name = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/.exec(line);
    if (nesting === 0 && name !== null) fields.push(name[1]!);
    nesting += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
  }
  return fields;
}

/* -------------------------------------------------------------------------- *
 * 1 — five rows, always, and they are the mockup's five in the mockup's order.
 * -------------------------------------------------------------------------- */

test("the five rows are the mockup's five, in its order and with its labels", async () => {
  const drawn = mockupRows();
  assert.equal(drawn.length, 5,
    `the mockup draws ${drawn.length} status rows, not five — the design of record moved and `
    + '`st.four` ("There are four unfinished-work queues, not one") moved with it');
  assert.deepEqual(drawn.map((row) => row.key),
    ['st.items', 'st.drafts', 'st.pending', 'st.staged', 'st.ingest']);

  const en = (await table('en')).strings;
  const root = await draw(async () => BODY());
  const rows = rowsOf(root);
  assert.equal(rows.length, 5,
    `the screen drew ${rows.length} rows. Five is not a maximum: three of five would delete two `
    + 'of the four queues from a screen whose only sentence is that there are four of them, and '
    + 'delete them silently — INV-nothing-is-dropped-silently.');
  // The LABEL is compared, not a key scraped out of the source: what a reader
  // sees is the English string, and a row wired to the wrong key would pass a
  // source scan and fail here.
  assert.deepEqual(
    rows.map((row) => textOf(row.children[0]!)),
    drawn.map((row) => en[row.key]!),
  );
});

/* -------------------------------------------------------------------------- *
 * 2, 3 — three real counts and two em dashes.
 * -------------------------------------------------------------------------- */

test('three rows carry a real count and two carry an em dash — and a real zero is a zero', async () => {
  const root = await draw(async () => BODY());
  const cells = rowsOf(root).map((row) => row.children[1]!);
  assert.deepEqual(
    cells.map((cell) => [cell.className, textOf(cell)]),
    [
      // `num`'s `en-US` grouping, which the mockup gives its own reason for: a
      // number that changes its separators with the UI language is a second
      // thing to reconcile for no reader's benefit.
      ['m', '4,321'],
      ['m', '7'],
      // `pendingRevisions.revisions` is 0 in the served body above. `null` is
      // "this server does not carry the number"; zero is a measurement, and the
      // screen must not blur them.
      ['m', '0'],
      ['small', '—'],
      ['small', '—'],
    ],
  );
  // The two em dashes are on the two rows the endpoint cannot fill, and on no
  // other. Stated by label as well as by position, so a transposition fails.
  const en = (await table('en')).strings;
  assert.deepEqual(
    rowsOf(root).filter((row) => textOf(row.children[1]!) === '—')
      .map((row) => textOf(row.children[0]!)),
    [en['st.staged']!, en['st.ingest']!],
  );
});

test('every count the server carries is drawn, whatever its value — zero included', async () => {
  const body = BODY();
  (body.items as Record<string, unknown>).total = 0;
  (body.reviewQueue as Record<string, unknown>).drafts = 0;
  (body.pendingRevisions as Record<string, unknown>).revisions = 0;
  const root = await draw(async () => body);
  const cells = rowsOf(root).map((row) => row.children[1]!);
  assert.deepEqual(cells.map((cell) => [cell.className, textOf(cell)]), [
    ['m', '0'], ['m', '0'], ['m', '0'], ['small', '—'], ['small', '—'],
  ], 'an empty corpus reports three zeros and two em dashes — never five em dashes, which would '
    + 'report neither fact');
});

/* -------------------------------------------------------------------------- *
 * 4 — what the em dash can and cannot say.
 * -------------------------------------------------------------------------- */

test('the em dash cell holds one character and asserts nothing else — no title, no aria, no word', async () => {
  const root = await draw(async () => BODY());
  const dashes = rowsOf(root).map((row) => row.children[1]!)
    .filter((cell) => cell.className === 'small');
  assert.equal(dashes.length, 2, 'the two unfillable rows are no longer the two `.small` cells');
  for (const cell of dashes) {
    assert.equal(textOf(cell), '—');
    assert.equal(cell.children.length, 0, 'the em dash cell grew a child element');
    assert.deepEqual(cell.attributes, {},
      'the em dash cell carries an attribute. If that is a `title` or an `aria-label` saying WHY '
      + 'the number is absent, it is English hard-coded into a screen module and no string table '
      + 'declares it — see TASK-the-status-screen-is-missing-one-element-kind.');
    assert.deepEqual(cell.dataset, {});
  }
  // The measurement behind this screen's loudest open question: the mark the
  // design of record uses for "no value here" is the SAME mark on both rows and
  // on the doctor finding that names no item, so a reader learns that no number
  // is asserted and cannot learn why. Saying why needs a KEY, and adding one to
  // a table the mockup does not declare fails `strings-parity` in the direction
  // that names it. The mockup changes first.
  const en = (await table('en')).strings;
  const he = (await table('he')).strings;
  assert.deepEqual(Object.keys(en).filter((k) => k.startsWith('st.')).sort(), [
    'st.drafts', 'st.four', 'st.h', 'st.ingest', 'st.items',
    'st.pending', 'st.staged', 'st.sub', 'st.v',
  ], 'the nine keys this screen has. A tenth is a new sentence on this screen — and if it is the '
    + 'one that explains the em dash, this assertion is what says the cell may now draw it.');
  assert.deepEqual(Object.keys(en).filter((k) => k.startsWith('st.')).sort(),
    Object.keys(he).filter((k) => k.startsWith('st.')).sort());
});

/* -------------------------------------------------------------------------- *
 * 5 — no invented English.
 * -------------------------------------------------------------------------- */

test('no English is invented: the one literal on this screen is the em dash', async () => {
  // Every third argument to `el(tag, cls, txt)` in the module — the only place
  // a screen can put a word on the page without going through `t()`.
  const literals = [...statusSource.matchAll(/\bel\('[a-z0-9]+',\s*'[^']*',\s*'([^']*)'\)/g)]
    .map((m) => m[1]!);
  assert.deepEqual(literals, ['—'],
    'a screen module wrote text that no string table carries. The em dash is a MARK, not a word, '
    + 'and it is the only one this screen is allowed.');
  assert.ok(!/textContent\s*=\s*ctx\.t/.test(statusSource),
    't() returns Node[] (owner ruling A1); assigning one renders [object Object]');
  assert.ok(!/innerHTML/.test(statusSource),
    'innerHTML has no legitimate use in a screen module — it destroys the .m spans that carry '
    + 'the direction isolation');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(statusSource),
    'the screen appends no translated nodes at all — the scans above are checking nothing');
});

test("every st. key the screen names is declared in both tables, and it is the mockup's set", async () => {
  const named = new Set([...statusSource.matchAll(/'(st\.[A-Za-z0-9]+)'/g)].map((m) => m[1]!));
  const drawn = new Set(
    [...statusSection().matchAll(/data-t="(st\.[A-Za-z0-9]+)"/g)].map((m) => m[1]!));
  assert.ok(named.size > 0, 'the module names no st. keys at all');
  // Both directions. A key in the mockup the module never names is a sentence
  // of the design of record that silently does not render; a key the module
  // names that the mockup does not declare is one `strings-parity.test.ts`
  // would fail on next.
  assert.deepEqual([...named].sort(), [...drawn].sort());

  const en = (await table('en')).strings;
  const he = (await table('he')).strings;
  for (const key of named) {
    assert.ok(Object.hasOwn(en, key), `en.js does not declare ${key}`);
    assert.ok(Object.hasOwn(he, key), `he.js does not declare ${key}`);
  }
});

/* -------------------------------------------------------------------------- *
 * 6, 7 — the ledger entry, measured, and the divergence the gate cannot see.
 * -------------------------------------------------------------------------- */

test('render draws every kind the mockup draws, and the bold run among them', async () => {
  const root = await draw(async () => BODY());
  const drawn = kindsOf(statusSection());
  const built = renderedKinds(root);

  // **The fourth marker landed, so this list is empty and the ledger entry is
  // gone.** `b` is `st.four`'s bolded "four"; it was absent because the run
  // grammar had `{m:}`, `{mv:}` and `{name}` and no emphasis marker, which was
  // the WHOLE of `status: ['b']` in `e2e/screen-parity.spec.ts`. The previous
  // version of this assertion said in as many words that the day a fourth
  // marker landed it would fail and the entry could come out. It did, on
  // 2026-08-25, and it has.
  assert.ok(drawn.includes('b'), 'the mockup no longer bolds a run inside st.four');

  // **A new, DELIBERATE entry: bare `span`.** The mockup's verdict is
  // `<span class="verdict">⚠️ <span data-t="st.v">…</span></span>` — the
  // inner span carries no class, which is the "span" kind this filters out
  // below. This screen's own verdict span is now `<span class="chip warn">`
  // (`TASK-ui1-task-19-doctor-decay-status-and-learn-screens`'s VERIFIED
  // PARTIAL pass, 2026-08-26 — a real verdict chip, not the frozen mockup's
  // bare span holding an emoji beside it), so the built page draws
  // `span.chip.warn` where the mockup draws bare `span`, and never the mockup's
  // own kind. Written down rather than silently passed over, the same
  // treatment `b` got above while it was still a real gap.
  assert.deepEqual(drawn.filter((kind) => !built.includes(kind) && kind !== 'span'), [],
    'a kind the mockup draws is missing from the render. This list used to hold `b` for a '
    + 'grammar limit that no longer exists, and now holds only the verdict span -> chip swap '
    + 'above — a name here beyond those two is a real gap.');

  // **THE OTHER DIRECTION IS NO LONGER ASSERTED — owner's ruling, 2026-09-02.**
  // *"Some app features could not appear in the mockup because they are newer
  // than it and it's ok and normal"*, and the mockup is a frozen reference that
  // is read and never written. This was an EXACT ledger of the kinds the app
  // draws and the design of record does not, so any new element on this screen
  // failed here until someone wrote it down — and with the mockup frozen the
  // only other green route was editing a file that may not be edited.
  //
  // LOST: nothing counts what this screen draws beyond the design of record.
  // KEPT: the gap direction, asserted above, and by `e2e/screen-parity.spec.ts`.
  //
  // The divergence it recorded stays as prose, because it is still true and
  // still worth knowing: `td.small` is the em dash cell — the mockup writes all
  // five value cells as `td.m` because it invents a sample number for the two
  // rows this server cannot count, and the app draws the design's own mark for
  // "no value here" instead.
  void 'td.small';

  // **The verdict is a `.chip`, not the mockup's bare ⚠️ — a deliberate
  // divergence from the frozen mockup, same ruling as the "other direction"
  // note above ("some app features could not appear in the mockup because
  // they are newer than it and it's ok and normal").** `TASK-ui1-task-19-
  // doctor-decay-status-and-learn-screens`'s own VERIFIED PARTIAL pass
  // (2026-08-26) named this screen specifically as NOT MET while the emoji
  // stood: "a real verdict chip is the `.chip` primitive with a meaning hue,
  // not an emoji." Status is still one of only two screens in the rail whose
  // verdict is not a plain pass (Learn is the other, and keeps its emoji —
  // this reconciliation named Status alone).
  const builtVerdict = descendants(root).find((n) => n.className === 'verdict')!;
  const chip = builtVerdict.children[0]! as FakeElement;
  assert.equal(chip.className, 'chip warn',
    'the verdict must be a .chip carrying a meaning hue, not the bare glyph');
  const en = (await table('en')).strings;
  assert.equal(textOf(chip), en['st.v'],
    "the chip's own text is the verdict sentence — nothing left for a sibling span to hold");
  assert.ok(!/[⚠✅]/.test(textOf(builtVerdict)),
    'the emoji must be gone entirely, not merely joined by the chip');

  // The note takes its margin through CSSOM and not a `style` attribute: the
  // server sends `style-src 'self'` with no `'unsafe-inline'`, so the mockup's
  // own `style="margin-block-start:8px"` is the one thing on this screen that
  // may NOT be transcribed literally.
  const card = root.children.find((child) => child.className === 'card pane')! as FakeElement;
  const note = card.children.find((child) => child.tag === 'p')! as FakeElement;
  assert.equal(note.style.declarations['margin-block-start'], '8px');
});

/* -------------------------------------------------------------------------- *
 * 8 — a refused read, and the endpoint's own words.
 * -------------------------------------------------------------------------- */

test("a refused read draws the endpoint's own words INSTEAD of the table", async () => {
  const root = await draw(async () => { throw new Error('index is not readable'); });
  const kinds = renderedKinds(root);
  assert.ok(!kinds.includes('table'),
    'an empty table beside an error reports two things and means neither: a corpus of zero items '
    + 'and a status read that failed are different facts');
  assert.ok(!kinds.includes('tr'));
  const note = descendants(root).find((n) => n.className === 'small spill');
  assert.ok(note, 'the refusal is not drawn at all — the screen is blank and says nothing');
  assert.equal(textOf(note), 'index is not readable',
    "the endpoint's own error text, not a paraphrase and not an invented key");
});

/* -------------------------------------------------------------------------- *
 * 9 — what is served, and what is read.
 * -------------------------------------------------------------------------- */

test('the screen reads three fields of the six /api/status serves, and the rest arrive unread', async () => {
  // The fixture body's own top level is checked against the SERVER's contract
  // rather than assumed: a field added to `StatusBody` and drawn by nobody is
  // the defect class this project has already filed once, on
  // `InjectedLine.title` (plan:ui1 seq:17f).
  assert.deepEqual(Object.keys(BODY()), servedFields(),
    '`StatusBody` in src/ui/read-model.ts gained or lost a top-level field. If it gained one, '
    + 'either a screen draws it or it is a served field nobody reads.');

  READS.length = 0;
  await draw(async () => recording('', BODY()));
  assert.deepEqual([...new Set(READS)].sort(), [
    'items', 'items.total',
    'pendingRevisions', 'pendingRevisions.revisions',
    'reviewQueue', 'reviewQueue.drafts',
  ], 'the three counts this server can answer, and nothing else. `version`, `profile`, '
    + '`items.byCategory`/`byStatus`/`byOrigin`, `reviewQueue.always`, '
    + '`reviewQueue.globalLayerDrafts`, `pendingRevisions.items` and the whole `health` tally '
    + 'arrive on every request and are discarded — the mockup draws none of them, and this is '
    + 'the measurement of that, not a permission to start.');
});
