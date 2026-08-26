/**
 * `screens/ask.js`'s decisions, tested in Node.
 *
 * **THE LIMIT, stated rather than papered over (spec §6).** The DOM rendering
 * in `render()` has no test here and deliberately so — that needs a browser
 * this project does not depend on. What IS tested is everything `render()`
 * does not decide for itself: which query parameter a filter row becomes,
 * which rows an answer produces, which of the result table's three states is
 * true, and which chip a role wears. None of that lives inside the glue, so
 * none of it is inside the gap.
 *
 * The Watch screen keeps the same decisions in `lib/viewmodel.js`, which
 * `test/ui/viewmodel.test.ts` imports directly. That file belongs to another
 * task, so Ask's pure half is exported from the screen module instead and
 * imported here — named in this task's report as the thing to fold into
 * `lib/viewmodel.js` when one task owns both.
 *
 * ── HOW A TYPESCRIPT TEST IMPORTS A BROWSER SCREEN MODULE ─────────────────
 *
 * Two obstacles, and the same reasoning `test/ui/viewmodel.test.ts`'s own
 * header sets down for the first:
 *
 *   1. **The specifier.** These modules are plain ES modules, untyped and
 *      outside `tsconfig.json`'s `include`, so the browser and `node --test`
 *      load the same bytes with no build step. A bare relative `import()` of
 *      a `.js` file does not type-check with `allowJs` off — TS7016 — and a
 *      `file://` URL specifier is also the only form that survives a Windows
 *      path.
 *   2. **`/screens/parts.js`.** Every screen imports the shared factories by
 *      the ABSOLUTE path the browser serves them at, which to Node's resolver
 *      is the root of the current drive. `module.registerHooks` (Node 22.15+,
 *      and this repo is on 24) maps that one prefix back onto
 *      `src/ui/public/` so the REAL bytes load, unmodified — no copy, no
 *      rewritten source, nothing that could pass here and fail in a browser.
 *      The hooks are process-wide, and `node --test` gives every test file its
 *      own process, so the mapping cannot leak into another file's run.
 *
 * Importing the module at all is itself an assertion: a screen that touched
 * `document` at module scope — rather than inside `render()` — would throw
 * here before the first test ran.
 *
 * ── THE ONE TEST THAT CROSSES THE WIRE ────────────────────────────────────
 *
 * The last section builds a real corpus and calls the real endpoint functions
 * with the paths `queryPath` composes. A screen that spells a parameter the
 * endpoint does not accept gets a 400 and an empty table, and nothing else in
 * this suite would notice: `unknownParams`' allow-lists live in
 * `src/ui/ask-model.ts` and the field names live in the screen, which is
 * exactly the two-spellings-of-one-name shape this project keeps finding.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { apiAskAudit, apiAskCorpus } from '../../src/ui/ask-model.ts';

const PUBLIC = path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public');

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('/screens/') || specifier.startsWith('/lib/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/** One entry of a value select: what is sent, and what is shown. */
interface Choice { value: string; label: string }

/** One line of the result table, in the design's three columns. */
interface Row {
  at: string | null;
  item: string | null;
  linkable: boolean;
  role: string | null;
  count: number | null;
}

/**
 * Hand-declared rather than generated, so it is an assertion in its own
 * right: this is the screen's published interface, and a module that drifts
 * from it fails here rather than in a browser nobody type-checks.
 */
interface AskModule {
  // `negatable` is gone with the fake negation it gated — see the block below.
  filterParam: (
    field: string, operator: string, value: string,
  ) => [string, string] | [string, string, true] | null;
  queryPath: (mode: string, field: string, operator: string, value: string) => string;
  clockOf: (at: string) => string;
  corpusRows: (rows: Record<string, unknown>[]) => Row[];
  auditRows: (records: Record<string, unknown>[]) => Row[];
  summaryRows: (report: string, role: string | null, rows: Record<string, unknown>[]) => Row[];
  tableState: (count: number, truncated: boolean) => string;
  roleChip: (role: string | null) => [string, string];
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

async function ask(): Promise<AskModule> {
  const file = path.join(PUBLIC, 'screens', 'ask.js');
  return (await import(pathToFileURL(file).href)) as unknown as AskModule;
}

const LAYERS: Choice[] = [
  { value: 'project', label: 'project' }, { value: 'global', label: 'global' },
];
const BOOLEANS: Choice[] = [{ value: '1', label: 'true' }, { value: '0', label: 'false' }];
const KINDS: Choice[] = ['mutation', 'injection', 'hook', 'focus', 'access', 'progress']
  .map((value) => ({ value, label: value }));

// ── The operator ──────────────────────────────────────────────────────────
//
// **`is not` had no server behind it until 2026-08-26, and now it does.**
//
// What stood here tested the two honest ways to handle a control the builders
// could not serve — rewrite the negation as the other member's equality where
// the vocabulary was closed and exhaustive, or refuse it — and, above all, that
// the third way was never taken: sending `is` for `is not` and presenting the
// answer as though the question had not changed.
//
// That third way is still the thing that must never happen, and it is now
// impossible by construction rather than by refusal: `corpusSelect` emits `<>`
// (and `NOT LIKE` for the substring field), so there is no field this screen can
// offer that the server cannot negate. `negatable`, `NEGATABLE_FIELDS` and the
// `'unserved'` return are all gone.
//
// The reasoning those tests carried is not lost — `ask.js` keeps it where
// `NEGATABLE_FIELDS` used to live, because WHY the other fields could never be
// faked is the argument for having fixed the builders instead of widening the
// fake.

test('filterParam flags a negation rather than rewriting the value', async () => {
  const { filterParam } = await ask();
  // The value is untouched and a third member carries the negation. Before
  // this, `['layer','project']` with `is not` came back as `['layer','global']`
  // — correct for a two-member list and a lie on any wider one.
  assert.deepEqual(filterParam('layer', 'is not', 'project'), ['layer', 'project', true]);
  assert.deepEqual(filterParam('layer', 'is', 'project'), ['layer', 'project']);
});

test('a wide-open vocabulary negates too — the case that used to be refused', async () => {
  const { filterParam } = await ask();
  // THE ASSERTION THIS FILE USED TO MAKE THE OTHER WAY. `kind` has six members
  // and "not injection" is five of them, which no equality can express; it was
  // returned as 'unserved' and the control greyed out. It is now a real query.
  assert.deepEqual(filterParam('kind', 'is not', 'injection'), ['kind', 'injection', true]);
  assert.deepEqual(filterParam('type', 'is not', 'rule'), ['type', 'rule', true]);
  assert.deepEqual(filterParam('title', 'is not', 'cents'), ['title', 'cents', true]);
});

test('(any) is no filter at all, whichever operator is showing', async () => {
  const { filterParam } = await ask();
  assert.equal(filterParam('kind', 'is', ''), null);
  // "is not (any)" is not a question either, so it is not an unserved one.
  assert.equal(filterParam('kind', 'is not', ''), null);
});

// ── The request ───────────────────────────────────────────────────────────

test('queryPath asks the tab\'s own endpoint, and asks nothing when nothing is filtered', async () => {
  const { queryPath } = await ask();
  assert.equal(queryPath('corpus', 'type', 'is', ''), '/api/ask/corpus');
  assert.equal(queryPath('audit', 'kind', 'is', ''), '/api/ask/audit');
  assert.equal(queryPath('corpus', 'type', 'is', 'rule'), '/api/ask/corpus?type=rule');
  assert.equal(queryPath('audit', 'kind', 'is', 'injection'), '/api/ask/audit?kind=injection');
});

test('queryPath encodes the value, so a title fragment cannot become a second parameter', async () => {
  const { queryPath } = await ask();
  const composed = queryPath('corpus', 'title', 'is', 'cents & pence?x=1');
  const parsed = new URL(composed, 'http://127.0.0.1:1');
  assert.equal(parsed.pathname, '/api/ask/corpus');
  assert.equal(parsed.searchParams.get('title'), 'cents & pence?x=1');
  assert.equal([...parsed.searchParams.keys()].length, 1, 'one parameter went out, not two');
});

test('queryPath sends the field NAME to negate, never an operator', async () => {
  const { queryPath } = await ask();
  // `not=<field>`, and the server maps that onto `<>` itself. No operator token
  // and no fragment of SQL crosses the wire, which is what
  // CONST-no-http-route-accepts-sql asks of this screen.
  assert.equal(queryPath('corpus', 'layer', 'is not', 'project'),
    '/api/ask/corpus?layer=project&not=layer');
  // The case that used to come back 'unserved'.
  assert.equal(queryPath('audit', 'kind', 'is not', 'focus'),
    '/api/ask/audit?kind=focus&not=kind');
});

// ── The At column ─────────────────────────────────────────────────────────

test('an instant becomes a wall clock; a stamp with no zone is left exactly as it arrived', async () => {
  const { clockOf } = await ask();
  // A real UTC instant — an audit record's `at`, which is ISO-8601 by
  // declaration. The rendered clock is the RUNNING MACHINE'S, so the shape is
  // asserted rather than the digits: pinning them would pin a timezone.
  assert.match(clockOf('2026-08-23T05:21:54.000Z'), /^\d\d:\d\d:\d\d$/);
  assert.match(clockOf('2026-08-23T05:21:54+03:00'), /^\d\d:\d\d:\d\d$/);
  // The index's `updated_at`, which carries no zone at all. `new Date()` would
  // read it as LOCAL time and the clock would be off by the machine's offset —
  // a timestamp shifted by an hour and presented as if it had been measured.
  assert.equal(clockOf('2026-08-23 05:21:54'), '2026-08-23 05:21:54');
  // A stamp this build cannot parse is the record's own bytes, which are the
  // last true thing left.
  assert.equal(clockOf('not a date'), 'not a date');
});

// ── The rows ──────────────────────────────────────────────────────────────

test('corpus rows carry the index write time and a linkable id', async () => {
  const { corpusRows } = await ask();
  const rows = corpusRows([
    { id: 'RULE-a', type: 'rule', updated_at: '2026-08-23 05:21:54' },
    { id: 'DEC-b', type: 'decision', updated_at: '2026-08-22 01:00:00' },
  ]);
  assert.deepEqual(rows, [
    { at: '2026-08-23 05:21:54', item: 'RULE-a', linkable: true, role: null, count: null },
    { at: '2026-08-22 01:00:00', item: 'DEC-b', linkable: true, role: null, count: null },
  ]);
});

test('one audit record becomes one row per item it names, in that item\'s role', async () => {
  const { auditRows } = await ask();
  const rows = auditRows([{
    at: '2026-08-23T09:22:41.000Z', kind: 'injection', op: 'jit',
    injected: [{ id: 'INV-prices-are-integer-cents', tier: 'jit' }],
    spilled: [{ id: 'STD-api-errors-use-problem-json', tier: 'jit', reason: 'budget' }],
  }]);
  // The mockup's own sample, exactly: two rows at one timestamp, one injected
  // and one spilled.
  assert.deepEqual(rows.map((row) => [row.item, row.role]), [
    ['INV-prices-are-integer-cents', 'injected'],
    ['STD-api-errors-use-problem-json', 'spilled'],
  ]);
  assert.deepEqual(new Set(rows.map((row) => row.at)), new Set(['2026-08-23T09:22:41.000Z']));
});

test('a mutation names its subject, and the three roles are the projection\'s own', async () => {
  const { auditRows } = await ask();
  const rows = auditRows([{ at: 'A', kind: 'mutation', op: 'create', itemId: 'RULE-x', origin: 'human' }]);
  assert.deepEqual(rows, [
    { at: 'A', item: 'RULE-x', linkable: true, role: 'subject', count: null },
  ]);
});

test('a record that names no item still gets a row', async () => {
  const { auditRows } = await ask();
  // A hook action, a session-start, a focus change: a real record with a real
  // timestamp and no item. An item-shaped table that dropped it would drop it
  // silently, which is the one thing this corpus's own invariant forbids.
  const rows = auditRows([{ at: 'A', kind: 'hook', op: 'session-start', sessionId: 's1' }]);
  assert.deepEqual(rows, [{ at: 'A', item: null, linkable: false, role: null, count: null }]);
});

test('audit rows read newest first, against the oldest-first order the endpoint sends', async () => {
  const { auditRows } = await ask();
  // `filterSelect` takes the newest n in descending order and reverses them,
  // so the wire order is oldest-first; every reading surface turns it around.
  const rows = auditRows([
    { at: '1', kind: 'hook', op: 'jit' },
    { at: '2', kind: 'hook', op: 'jit' },
    { at: '3', kind: 'hook', op: 'jit' },
  ]);
  assert.deepEqual(rows.map((row) => row.at), ['3', '2', '1']);
});

test('a predefined report keeps its count, and claims a role only where it has one', async () => {
  const { summaryRows } = await ask();
  const spilled = summaryRows('items', 'spilled', [{ label: 'STD-x', count: 12, last: 'A' }]);
  assert.deepEqual(spilled, [
    { at: 'A', item: 'STD-x', linkable: true, role: 'spilled', count: 12 },
  ]);
  // `report=items` with no role is a different question — every role at once —
  // and claims none of them.
  assert.equal(summaryRows('items', null, [{ label: 'STD-x', count: 3, last: 'A' }])[0]!.role, null);
  // An op name and a session id are not item ids: a linkid on one would
  // resolve to no item at all.
  assert.equal(summaryRows('ops', null, [{ label: 'create', count: 9, last: 'A' }])[0]!.linkable, false);
  assert.equal(summaryRows('sessions', null, [{ label: 's-1', count: 9, last: 'A' }])[0]!.linkable, false);
});

// ── The table's three states ──────────────────────────────────────────────

test('truncation is a property of the answer, never of a row count that happens to equal the cap', async () => {
  const { tableState } = await ask();
  assert.equal(tableState(2, false), 'rows');
  assert.equal(tableState(0, false), 'none');
  assert.equal(tableState(100, true), 'truncated');
  // 100 rows and no probe row is a COMPLETE answer of exactly 100.
  assert.equal(tableState(100, false), 'rows');
});

test('the role chip uses the mockup\'s two hues and invents no third', async () => {
  const { roleChip } = await ask();
  assert.deepEqual(roleChip('injected'), ['chip ok', '●']);
  assert.deepEqual(roleChip('spilled'), ['chip warn', '▲']);
  // `subject` is the projection's third role and the mockup gives it no hue,
  // so it takes the neutral chip — never bare `.chip`, which is the one that
  // renders near-black text on a near-black panel.
  assert.deepEqual(roleChip('subject'), ['chip index', '◇']);
  assert.deepEqual(roleChip(null), ['chip index', '◇']);
});

// ── The string keys ───────────────────────────────────────────────────────

test('every string key the screen names is declared in BOTH tables', async () => {
  // `t()` THROWS on a missing key, and the DOM glue that calls it has no test:
  // a mistyped key blanks the whole screen at runtime rather than mislabelling
  // one line. This is the check that catches it before a browser does.
  const source = readFileSync(path.join(PUBLIC, 'screens', 'ask.js'), 'utf8');
  const keys = [...source.matchAll(/'((?:ask|aria|th)\.[A-Za-z0-9.]+)'/g)].map((m) => m[1]!);
  assert.ok(keys.length >= 20, `expected the screen to name its keys; found ${keys.length}`);
  const load = async (lang: string): Promise<{ strings: Record<string, string> }> => {
    const file = path.join(PUBLIC, 'strings', `${lang}.js`);
    return (await import(pathToFileURL(file).href)) as { strings: Record<string, string> };
  };
  const en = await load('en');
  const he = await load('he');
  for (const key of new Set(keys)) {
    assert.ok(key in en.strings, `${key} is missing from the English table`);
    assert.ok(key in he.strings, `${key} is missing from the Hebrew table`);
  }
});

// ── The request the endpoint actually accepts ─────────────────────────────

function workspace(): { dir: string; done: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ask-screen-'));
  const quiet = (): void => {};
  assert.equal(runCli(['init'], dir, quiet), 0, 'fixture command failed: init');
  // `--yes`: a rule is a governing item and `add` refuses to create one
  // without confirmation when stdin is not interactive, which it never is
  // under the test runner.
  assert.equal(
    runCli(['add', 'rule', 'Money is an integer number of cents', '--body', 'B.', '--yes'], dir, quiet),
    0, 'fixture command failed: add rule',
  );
  return { dir, done: () => removeTree(dir) };
}

function asUrl(composed: string): URL {
  return new URL(composed, 'http://127.0.0.1:1');
}

test('every filter the screen can compose is one the endpoint accepts', async () => {
  const { queryPath } = await ask();
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // One realistic value per field, in the field's own vocabulary — which is
    // what the screen offers, because it derives its lists from the corpus and
    // from the records rather than writing them down.
    const corpus: [string, string][] = [
      ['type', 'rule'], ['status', 'active'], ['layer', 'project'],
      ['always', '1'], ['scoped', '0'], ['title', 'Money'],
    ];
    for (const [field, value] of corpus) {
      const composed = queryPath('corpus', field, 'is', value);
      const result = apiAskCorpus(ws, asUrl(composed));
      assert.equal(result.status, 200, `${composed} was refused: ${JSON.stringify(result.body)}`);
    }
    const audit: [string, string][] = [
      ['kind', 'injection'], ['op', 'create'], ['origin', 'human'],
      ['item', 'RULE-money-is-an-integer-number-of-cents'],
    ];
    for (const [field, value] of audit) {
      const composed = queryPath('audit', field, 'is', value);
      const result = apiAskAudit(ws, asUrl(composed));
      // 200 with no records: this fixture never runs `mycontext audit`, so the
      // projection is `absent` — an empty state, not a fault, and not a 400.
      assert.equal(result.status, 200, `${composed} was refused: ${JSON.stringify(result.body)}`);
    }
  } finally { done(); }
});

test('a negated filter runs as a REAL `<>`, and the SQL on screen says so', async () => {
  const { queryPath } = await ask();
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    const composed = queryPath('corpus', 'layer', 'is not', 'global');
    // The value is the one the reader chose. Before 2026-08-26 this path read
    // `?layer=project` — the OTHER member, substituted here on the client — and
    // the SQL pane showed `layer = ?` for a question that said "is not".
    assert.equal(composed, '/api/ask/corpus?layer=global&not=layer');
    const result = apiAskCorpus(ws, asUrl(composed));
    assert.equal(result.status, 200);
    const body = result.body as { sql: string; params: unknown[]; rows: unknown[] };
    // **The pane shows what RAN, and what ran is the negation itself.** That is
    // the whole promise of this screen: `ask.sqlCaption` calls it "the SQL this
    // answer ran", and a rewritten equality made that sentence true of the
    // statement and false of the question.
    assert.match(body.sql, /WHERE layer <> \?/);
    assert.equal(body.params[0], 'global', 'the value is bound, and it is the one on screen');
    assert.ok(body.rows.length > 0, 'the negation still answers');
  } finally { done(); }
});

test('a negation on a WIDE field is served — the case that was refused outright', async () => {
  const { queryPath } = await ask();
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // `type` has as many values as the corpus has categories, so no equality
    // could ever have expressed "not a rule". This used to be 'unserved'.
    const composed = queryPath('corpus', 'type', 'is not', 'rule');
    const result = apiAskCorpus(ws, asUrl(composed));
    assert.equal(result.status, 200);
    const body = result.body as { sql: string; params: unknown[] };
    assert.match(body.sql, /WHERE type <> \?/);
    assert.equal(body.params[0], 'rule');
  } finally { done(); }
});

test('`not` naming a field the query does not filter on is refused, not ignored', async () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // A dropped filter answers a WIDER question and presents it as the answer —
    // `?not=status` with no `status=` would return every row while claiming to
    // have excluded something.
    assert.equal(apiAskCorpus(ws, asUrl('/api/ask/corpus?not=status')).status, 400);
    // And a name outside the closed set never reaches the builder.
    assert.equal(apiAskCorpus(ws, asUrl('/api/ask/corpus?type=rule&not=id')).status, 400);
  } finally { done(); }
});

test('the endpoint refuses a value outside the vocabulary — which is why the screen derives one', async () => {
  const { dir, done } = workspace();
  try {
    const ws = resolveWorkspace(dir);
    // A select can only offer a vocabulary, and this is what happens to
    // anything else: the endpoint validates against its own declaration and
    // answers 400. A screen that typed its own list would drift into this.
    assert.equal(apiAskCorpus(ws, asUrl('/api/ask/corpus?status=bogus')).status, 400);
    assert.equal(apiAskAudit(ws, asUrl('/api/ask/audit?kind=bogus')).status, 400);
  } finally { done(); }
});

// ── The screen, drawn against a stand-in document ─────────────────────────
//
// Spec §6's rendering gap is about the BROWSER — layout, styles, events — and
// not about which elements a module builds. `screens/parts.js` reaches for the
// global `document` (it is the mockup's own factory, argument for argument),
// so the stand-in is installed rather than passed, and removed again
// immediately: a `document` left behind would make any later test in this
// process think it is in a browser.

/** A stand-in node: an element, or a run of text. Text carries no tag. */
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
 * The members `screens/parts.js`, `lib/i18n.js` and `screens/ask.js` touch on
 * an element, and no more than that on purpose: a fuller fake would invite
 * tests this file has no business running. `value` starts empty because that
 * is what a `<select>` with no options reads as, which is the state
 * `paintFields()` meets on its first call.
 */
interface FakeElement extends FakeNode {
  parent: FakeElement | null;
  value: string;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  listeners: Record<string, ((event: { target: FakeElement }) => void)[]>;
  style: { declarations: Record<string, string>; setProperty: (name: string, value: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  replaceWith: (other: FakeElement) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: (event: { target: FakeElement }) => void) => void;
  closest: (selector: string) => FakeElement | null;
}

function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    hidden: false,
    value: '',
    parent: null,
    dataset: {},
    attributes: {},
    listeners: {},
    children: [],
    style: {
      declarations,
      setProperty: (name: string, value: string): void => { declarations[name] = value; },
    },
    append: (...nodes: (FakeNode | string)[]): void => {
      for (const child of nodes) {
        if (typeof child === 'string') node.children.push(textNode(child));
        else {
          (child as FakeElement).parent = node;
          node.children.push(child);
        }
      }
    },
    replaceChildren: (...nodes: (FakeNode | string)[]): void => {
      node.children.length = 0;
      node.append(...nodes);
    },
    replaceWith: (other: FakeElement): void => {
      const parent = node.parent;
      if (parent === null) return;
      parent.children[parent.children.indexOf(node)] = other;
      other.parent = parent;
    },
    setAttribute: (name: string, value: string): void => { node.attributes[name] = value; },
    addEventListener: (type: string, listener: (event: { target: FakeElement }) => void): void => {
      (node.listeners[type] ??= []).push(listener);
    },
    // ONE selector, and a throw for anything else. `screens/ask.js`'s tab strip
    // delegates with `event.target.closest('button[data-tab]')`; a fake that
    // answered `null` to a selector it could not parse would turn a broken
    // handler into a test that quietly passes.
    closest: (selector: string): FakeElement | null => {
      assert.equal(selector, 'button[data-tab]', `the fake DOM cannot match ${selector}`);
      for (let at: FakeElement | null = node; at !== null; at = at.parent) {
        if (at.tag === 'button' && at.dataset['tab'] !== undefined) return at;
      }
      return null;
    },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

interface I18nModule {
  t: (
    strings: Record<string, string>, key: string,
    subs: Record<string, string | number>, document: typeof doc,
  ) => FakeNode[];
  tFlat: (strings: Record<string, string>, key: string, subs?: Record<string, string | number>) => string;
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

/** `tag.class1.class2`, classes sorted — `e2e/screen-parity.spec.ts`'s own form. */
function kindOf(tag: string, className: string): string {
  const raw = className.trim();
  return raw === '' ? tag : `${tag}.${raw.split(/\s+/).sort().join('.')}`;
}

/**
 * Every kind `render()` built that a reader can SEE — the same filter the
 * parity gate applies in a browser (`el.offsetParent === null` catches
 * `display:none` and every ancestor's `[hidden]`). A closed `<details>` shows
 * its summary and hides its box, and nothing here ever opens one.
 */
function renderedKinds(root: FakeNode): string[] {
  const kinds = new Set<string>();
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text' || child.hidden === true) continue;
      kinds.add(kindOf(child.tag, child.className));
      if (child.tag === 'details') {
        for (const inner of child.children) if (inner.tag === 'summary') kinds.add('summary');
        continue;
      }
      walk(child);
    }
  };
  walk(root);
  return [...kinds].sort();
}

/**
 * Every kind `<section data-p="ask">` shows, read out of the design of record.
 *
 * Three corrections to a naive tag scan, each of which the browser makes for
 * itself and a regex does not:
 *
 *   1. **`hidden` hides a subtree.** `#qfc`, `#qvc` and `#askcorpusnote` carry
 *      the attribute, and `renderQ` hides the two `#qstate` spans on the state
 *      it draws first. Their descendants are not shown either.
 *   2. **A closed `<details>` shows only its summary.** Both disclosures are
 *      closed at load, so `div.helpbox` and everything under it — including
 *      `span.prop` and four `span.m` runs — is not on screen.
 *   3. **`#qres` is filled by script.** The markup's `<tbody>` is empty and
 *      `renderQ()` puts two sample rows in it before a reader ever sees the
 *      page, so a scan of the markup alone misses six kinds that ARE shown.
 */
function mockupKinds(): string[] {
  const mockup = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'docs', 'design', 'web-ui-mockup.html'), 'utf8',
  );
  const open = mockup.indexOf('<section data-p="ask"');
  assert.notEqual(open, -1, 'the mockup no longer has a <section data-p="ask">');
  const close = mockup.indexOf('</section>', open);
  const section = mockup.slice(mockup.indexOf('>', open) + 1, close);

  const HIDDEN_KEYS = new Set(['ask.truncated', 'ask.noRows']);
  const VOID = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'use']);
  const kinds = new Set<string>();
  const stack: { tag: string; skip: boolean }[] = [];
  for (const match of section.matchAll(/<(\/?)([a-z][a-z0-9]*)([^>]*)>/g)) {
    const tag = match[2]!;
    if (match[1] === '/') {
      while (stack.length > 0 && stack.pop()!.tag !== tag) { /* unwind to the open tag */ }
      continue;
    }
    const body = match[3]!;
    const className = (/class="([^"]*)"/.exec(body)?.[1] ?? '').trim();
    const hidden = /\shidden(\s|=|$)/.test(body)
      || HIDDEN_KEYS.has(/data-t="([^"]*)"/.exec(body)?.[1] ?? '');
    const buried = stack.some((opened) => opened.skip)
      || (stack.at(-1)?.tag === 'details' && tag !== 'summary');
    if (!buried && !hidden) kinds.add(kindOf(tag, className));
    if (!VOID.has(tag) && !body.trim().endsWith('/')) stack.push({ tag, skip: buried || hidden });
  }
  // The two rows `renderQ` builds: `c1.className='m small'`, the item as
  // `mono(i)`, and the role as `chip ok` / `chip warn`.
  for (const kind of ['tr', 'td', 'td.m.small', 'span.m', 'span.chip.ok', 'span.chip.warn']) {
    kinds.add(kind);
  }
  return [...kinds].sort();
}

/** The one injection and the one mutation that put all three roles on screen. */
const RECORDS = [
  {
    at: '2026-08-23T09:22:40.000Z', kind: 'mutation', op: 'create',
    itemId: 'RULE-money-is-an-integer-number-of-cents', origin: 'human',
  },
  {
    at: '2026-08-23T09:22:41.000Z', kind: 'injection', op: 'session-start', sessionId: 's-1',
    injected: [{ id: 'INV-prices-are-integer-cents', tier: 'pinned' }],
    spilled: [{ id: 'STD-api-errors-use-problem-json', tier: 'jit', reason: 'budget' }],
  },
];

const ITEMS = {
  items: [{
    id: 'RULE-money-is-an-integer-number-of-cents', type: 'rule',
    title: 'Money is an integer number of cents', status: 'active',
  }],
};

const AUDIT_BODY = {
  records: RECORDS,
  sql: 'SELECT json(rec) AS rec FROM (\n  SELECT seq, rec FROM audit ORDER BY seq DESC LIMIT ?\n) ORDER BY seq ASC',
  params: [200],
  projectionState: 'fresh',
};

/** The shell's contract, as much of it as this screen is allowed to touch. */
async function context(api: (route: string) => Promise<unknown>): Promise<{
  t: (key: string, subs?: Record<string, string | number>) => FakeNode[];
  tFlat: (key: string, subs?: Record<string, string | number>) => string;
  api: (route: string) => Promise<unknown>;
}> {
  const i18n = await browserModule<I18nModule>('lib', 'i18n.js');
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  return {
    t: (key, subs = {}) => i18n.t(en, key, subs, doc),
    tFlat: (key, subs = {}) => i18n.tFlat(en, key, subs),
    api,
  };
}

/**
 * Installs the stand-in `document` for the duration of one call and removes it
 * again — a global left behind would make any later test in this process think
 * it is in a browser. Nesting is safe: an inner call sees the global already
 * there and leaves it for the outer one to remove.
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

/** Renders into a stand-in `<section>`. */
async function draw(api: (route: string) => Promise<unknown>): Promise<FakeElement> {
  const { render } = await ask();
  const ctx = await context(api);
  const root = element('section');
  await withDocument(async () => { await render(root, ctx); });
  return root;
}

function find(root: FakeNode, predicate: (node: FakeNode) => boolean): FakeNode | null {
  for (const child of root.children) {
    if (predicate(child)) return child;
    const deeper = find(child, predicate);
    if (deeper !== null) return deeper;
  }
  return null;
}

const FRESH = async (route: string): Promise<unknown> => {
  if (route === '/api/items') return ITEMS;
  if (route.startsWith('/api/watch/volume')) {
    return {
      buckets: [{
        start: '2026-08-23T09:22:00.000Z',
        total: 0,
        byKind: { mutation: 0, injection: 0, hook: 0, focus: 0, access: 0, progress: 0 },
      }],
      projectionState: 'fresh',
    };
  }
  if (route.startsWith('/api/ask/audit')) return AUDIT_BODY;
  throw new Error(`the screen asked for ${route}, which this fixture does not serve`);
};

test('render draws every kind the mockup draws, and invents only what it means to', async () => {
  const root = await draw(FRESH);
  const drawn = mockupKinds();
  const built = renderedKinds(root);

  // **This list was `['b']` and is now empty.** `b` was the mockup's
  // `<b>Shown, never typed.</b>` inside `ask.sqln` and its three siblings, and
  // it was absent for one reason: `lib/i18n.js`'s run grammar had three
  // markers — `{m:}`, `{mv:}`, `{name}` — and no emphasis one, so no string
  // table could carry it. `{b:}` and `{i:}` landed 2026-08-25 and the run
  // renders. Nothing is missing from this screen now.
  assert.deepEqual(drawn.filter((kind) => !built.includes(kind)), [],
    'a kind the mockup draws is missing from the render — emphasis is carryable now, so a '
    + 'name here is a real gap rather than the grammar limit this list used to hold');

  // Two kinds this screen draws that the mockup does not, both deliberate and
  // both in this task's report. `button.linkid.m` is what every id on every
  // shipped screen is — the mockup draws a bare `span.m` in the item cell and
  // the app-wide convention is the button that reaches the item pane.
  // `span.chip.index` is the neutral chip for the projection's third role,
  // `subject`, which the mockup never draws and gives no hue.
  assert.deepEqual(
    built.filter((kind) => !drawn.includes(kind)),
    ['button.linkid.m', 'span.chip.index'],
  );
});

test('the SQL pane shows the server\'s own statement, verbatim, with its parameters', async () => {
  const root = await draw(FRESH);
  const pane = find(root, (node) => node.tag === 'pre')!;
  // The mockup's own spelling — `-- parameters: ['injection']` — not the
  // plan's `-- params:`.
  assert.equal(pane.textContent, `${AUDIT_BODY.sql}\n-- parameters: [200]`);
});

test('the mockup\'s inline styles are set through CSSOM, never as a style attribute', async () => {
  // The server sends `style-src 'self'` with no `'unsafe-inline'`, so the
  // mockup's `style="display:flex;…"` on the filter row is the one thing on
  // this screen that may not be transcribed literally.
  const root = await draw(FRESH);
  const card = root.children.find((node) => node.className === 'card pane')!;
  const row = card.children.find((node) => node.tag === 'div' && node.className === '') as FakeElement;
  assert.equal(row.style.declarations['display'], 'flex');
  assert.equal(row.style.declarations['flex-wrap'], 'wrap');
});

test('a refused query draws the server\'s words INSTEAD of the data, never beside an empty table', async () => {
  const REFUSAL = 'the audit projection is behind relative to its log, and this endpoint may not '
    + 'catch it up. Run `mycontext audit` to build it';
  const root = await draw(async (route) => {
    if (route === '/api/items') return ITEMS;
    throw new Error(REFUSAL);
  });
  const kinds = renderedKinds(root);
  // `errorNote`'s own shape, carrying the endpoint's own sentence — which
  // names the state AND the command that repairs it, and no string table
  // declares one that could say either.
  const note = find(root, (node) => node.className === 'small spill')!;
  assert.equal(note.textContent, REFUSAL);
  // An endpoint that refused and a corpus that matched nothing are two facts.
  // A table with headers and no rows under a caption reading "0 rows" would
  // report the second when the first is what happened.
  assert.ok(!kinds.includes('table'), 'the table is not drawn beside a refusal');
  assert.ok(!kinds.includes('pre.m'), 'no SQL pane: the refusal carried no statement to show');
});

test('an absent projection says so in the server\'s word, and never says "no rows matched"', async () => {
  const root = await draw(async (route) => {
    if (route === '/api/items') return ITEMS;
    if (route.startsWith('/api/watch/volume')) return { buckets: [], projectionState: 'absent' };
    if (route.startsWith('/api/ask/audit')) {
      return {
        records: [], sql: 'SELECT json(rec) AS rec FROM audit ORDER BY seq ASC',
        params: [], projectionState: 'absent',
      };
    }
    throw new Error(`unexpected ${route}`);
  });
  // Zero records because nobody has built a projection is not zero records
  // because nothing matched. The first is a state; the second is a claim about
  // a log this answer never read.
  const chip = find(root, (node) => node.className === 'chip warn')!;
  assert.equal(chip.textContent, 'absent');
  assert.equal(find(root, (node) => node.textContent === 'no rows matched'), null);
});

/**
 * The corpus tab, reached the way a reader reaches it: by clicking.
 *
 * The stand-in grows exactly two members for this — a listener registry and
 * the one-selector `closest` the tab handler calls — because the alternative
 * is leaving half the screen untested. Everything the corpus tab does that
 * the audit tab does not (a keyed field list, the `updated_at` note, the
 * corpus endpoint) lives behind that click.
 */
function click(container: FakeElement, target: FakeElement): void {
  for (const listener of container.listeners['click'] ?? []) {
    listener({ target });
  }
}

/** Lets every immediately-resolved promise the handler started settle. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 3; turn++) await new Promise((resolve) => { setTimeout(resolve, 0); });
}

const CORPUS_BODY = {
  rows: [{
    id: 'RULE-money-is-an-integer-number-of-cents', type: 'rule',
    title: 'Money is an integer number of cents', status: 'active',
    always: 1, has_scope: 0, layer: 'project',
    file_path: 'items/rule/RULE-money-is-an-integer-number-of-cents.md',
    updated_at: '2026-08-23 05:21:54',
  }],
  sql: 'SELECT id, type, title, status, always, has_scope, layer, file_path, updated_at\nFROM items\nORDER BY id\nLIMIT ?',
  params: [101],
  truncated: false,
};

test('clicking Corpus asks the corpus endpoint, keys its field names and hangs the updated_at note', async () => {
  const asked: string[] = [];
  // The click renders too, so the stand-in document has to outlive `draw`.
  await withDocument(async () => {
    const root = await draw(async (route) => {
      asked.push(route);
      if (route.startsWith('/api/ask/corpus')) return CORPUS_BODY;
      return FRESH(route);
    });
    const card = root.children.find((node) => node.className === 'card pane')! as FakeElement;
    const tabs = card.children.find((node) => node.className === 'segbar')! as FakeElement;
    const corpusTab = tabs.children.find(
      (node) => (node as FakeElement).dataset['tab'] === 'corpus',
    )! as FakeElement;

    click(tabs, corpusTab);
    await settle();

    assert.ok(asked.includes('/api/ask/corpus'), `the corpus tab never asked for it: ${asked.join(', ')}`);
    assert.equal(corpusTab.attributes['aria-pressed'], 'true');
    assert.equal(
      (tabs.children.find((node) => (node as FakeElement).dataset['tab'] === 'audit') as FakeElement)
        .attributes['aria-pressed'],
      'false',
    );

    // The six corpus field names are PROSE and are keyed; the four audit ones
    // are the projection's own column names and are literals. This is the
    // assertion that says the keyed half reached the right six strings.
    const fieldSelect = card.children
      .flatMap((node) => node.children)
      .find((node) => node.tag === 'select')!;
    assert.deepEqual(
      fieldSelect.children.map((child) => child.children.map((run) => run.textContent).join('')),
      ['Category', 'Status', 'Layer', 'Pinned (always)', 'Has scope', 'Title contains'],
    );

    // The trap note is a property of THIS query and hangs on this tab alone.
    //
    // Found by its BOLD run rather than by a text node beginning
    // `' is index write time'`. That text was one node until 2026-08-25, when
    // `ask.updatedAtTrap` gained `{b:index write time}` and the run split into
    // `' is '`, a `<b>`, and the rest — so the old predicate matched nothing and
    // the test died on a null. The bold is the stabler landmark: it is the
    // phrase the design of record emphasises, and it moves only if the mockup
    // does.
    // Read through `children` and not `textContent`: this file's fake element
    // keeps `textContent` as a plain FIELD, so a `<b>` that `t()` filled by
    // `append` reads back as the empty string it was constructed with. The
    // words are in its children.
    const note = find(root, (node) => node.children.some(
      (run) => run.tag === 'b'
        && run.children.map((word) => word.textContent).join('') === 'index write time',
    ))!;
    assert.equal(note.hidden, false);

    // `updated_at` reaches the At column exactly as the index wrote it — see
    // `clockOf`: it carries no zone, so it is not reduced to a wall clock.
    const at = find(root, (node) => node.className === 'm small')!;
    assert.equal(at.textContent, '2026-08-23 05:21:54');
  });
});
