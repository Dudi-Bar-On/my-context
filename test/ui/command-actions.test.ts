/**
 * **The one Copy-and-Execute control, drawn against a stand-in document.**
 *
 * Spec: `docs/superpowers/specs/2026-08-26-execute-a-composed-command-design.md`
 * §3.2 (which confirm a command gets), §3.3 (intent is proved per action),
 * §6.1 (everything in the catalogue runs) and §6.3 (the residual is stated in
 * the product). Plan Task 6.
 *
 * ── WHY THE CONTROL IS TESTED AND NOT THE SEVEN SCREENS ───────────────────
 *
 * Measured 2026-08-27: **nine** `navigator.clipboard.writeText` sites across
 * `screens/`, each with its own button, its own error handling and its own
 * words. Adding Execute nine times would be nine chances to get the confirm
 * wrong, and **the confirm IS the security boundary** — it is the only thing
 * between a page that never asked and a corpus mutation (§6.3). So there is one
 * control, and this file holds it to the four properties that make it a gate
 * rather than a decoration:
 *
 *   1. nothing composed OUTSIDE the catalogue may run — no id, no Execute;
 *   2. the first click renders and POSTs nothing;
 *   3. the residual reaches the reader VERBATIM, in the server's own bytes;
 *   4. a boundary command NAMES every field it changes, before → after, and a
 *      boundary command whose fields cannot be named does not run at all.
 *
 * ── WHY THE TWO SERVER IMPORTS ────────────────────────────────────────────
 *
 * `EXECUTION_RESIDUAL` and `NAMED_ENTRY_POINTS` are imported rather than
 * retyped. A hand-typed copy of either goes stale silently: the residual is
 * "these words or better" in a spec §6.3 the owner read twice, and the four
 * named entry points are the CLI's own statement of which field each of them
 * sets. This file's whole claim about the diff is that the browser's table says
 * what the CLI does — comparing it against a second copy of the CLI's table
 * would compare two guesses.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE ───────────────────────────────────
 *
 * `module.registerHooks` maps `/lib/` and `/screens/` onto `src/ui/public/`,
 * the arrangement `test/ui/gaps-screen.test.ts` settled on: the REAL bytes
 * load, unmodified, so nothing that passes here can differ from what a browser
 * runs. The stand-in `document` is installed only for the duration of a draw —
 * one left behind would make any later test in this process think it is in a
 * browser.
 *
 * ── WHAT THIS FILE CANNOT SAY ─────────────────────────────────────────────
 *
 * Spec §6's untested surface is the BROWSER. A stand-in document says which
 * elements a module builds and nothing about how they look, so the confirm's
 * contrast, its focus ring and every rule in `styles.css` are outside it.
 * `e2e/execute.spec.ts` (plan Task 7) is the only witness for those.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { EXECUTION_RESIDUAL } from '../../src/ui/execute.ts';
import { NAMED_ENTRY_POINTS } from '../../src/cli/commands/edit.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const SOURCE = readFileSync(path.join(PUBLIC, 'lib', 'command-actions.js'), 'utf8');

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
// passed. The member list is deliberately the members this control touches and
// no more: a fuller fake would invite assertions this file has no business
// making. `focus` and `tabIndex` are here for one property only — that the
// confirm can be reached and read from the keyboard.

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

interface FakeElement extends FakeNode {
  type: string;
  disabled: boolean;
  tabIndex: number;
  focused: number;
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  listeners: Record<string, ((event: unknown) => unknown)[]>;
  style: { declarations: Record<string, string>; setProperty: (n: string, v: string) => void };
  append: (...nodes: (FakeNode | string)[]) => void;
  replaceChildren: (...nodes: (FakeNode | string)[]) => void;
  setAttribute: (name: string, value: string) => void;
  addEventListener: (type: string, listener: (event: unknown) => unknown) => void;
  focus: () => void;
}

function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    className: '',
    textContent: '',
    hidden: false,
    type: '',
    disabled: false,
    tabIndex: 0,
    focused: 0,
    dataset: {},
    attributes: {},
    listeners: {},
    children: [],
    style: {
      declarations,
      setProperty: (name, value): void => { declarations[name] = value; },
    },
    append: (...nodes): void => {
      for (const child of nodes) node.children.push(typeof child === 'string' ? textNode(child) : child);
    },
    replaceChildren: (...nodes): void => {
      node.children.length = 0;
      node.append(...nodes);
    },
    setAttribute: (name, value): void => { node.attributes[name] = value; },
    addEventListener: (type, listener): void => { (node.listeners[type] ??= []).push(listener); },
    focus: (): void => { node.focused += 1; },
  };
  return node;
}

const doc = { createElement: element, createTextNode: textNode };

/** The clipboard the Copy button writes to, and the last thing written to it. */
const clipboard = { written: [] as string[], fail: null as string | null };

/**
 * Installs the stand-in `document` and `navigator` for one call and removes
 * them again. Nesting is safe: an inner call sees the globals already there and
 * leaves them for the outer one to remove.
 */
async function withDocument<T>(body: () => Promise<T>): Promise<T> {
  const globals = globalThis as unknown as { document?: unknown };
  const hadDoc = Object.hasOwn(globals, 'document');
  globals.document = doc;
  // `globalThis.navigator` is a getter-only accessor on Node 24 — a plain
  // assignment throws — so the stand-in is DEFINED over it and the original
  // descriptor is put back. Node's own `navigator` has no `clipboard`, so
  // without this the Copy button would fail for a reason that reads like a
  // defect in the control.
  const priorNav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', {
    configurable: true,
    value: {
      clipboard: {
        writeText: (text: string): Promise<void> => {
          if (clipboard.fail !== null) return Promise.reject(new Error(clipboard.fail));
          clipboard.written.push(text);
          return Promise.resolve();
        },
      },
    },
  });
  try {
    return await body();
  } finally {
    if (!hadDoc) delete globals.document;
    if (priorNav === undefined) delete (globalThis as unknown as { navigator?: unknown }).navigator;
    else Object.defineProperty(globalThis, 'navigator', priorNav);
  }
}

// ── Kinds, in `e2e/screen-parity.spec.ts`' own form ───────────────────────

/** `tag.class1.class2`, classes sorted — the gate's own spelling of a kind. */
function kindOf(node: FakeNode): string {
  const raw = node.className.trim();
  return raw === '' ? node.tag : `${node.tag}.${raw.split(/\s+/).sort().join('.')}`;
}

/** The kinds of a node's own children — one level, in the order they were built. */
function childKinds(root: FakeNode): string[] {
  return root.children.filter((c) => c.tag !== '#text').map(kindOf);
}

/** Every kind under a root, text nodes and hidden subtrees excluded. */
function renderedKinds(root: FakeNode): string[] {
  const kinds = new Set<string>();
  const walk = (node: FakeNode): void => {
    for (const child of node.children) {
      if (child.tag === '#text' || child.hidden === true) continue;
      kinds.add(kindOf(child));
      walk(child);
    }
  };
  walk(root);
  return [...kinds].sort();
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

function findOne(root: FakeNode, kind: string): FakeElement {
  const all = findAll(root, (node) => kindOf(node) === kind);
  assert.equal(all.length, 1, `expected exactly one ${kind}, found ${all.length}`);
  return all[0] as FakeElement;
}

function findMaybe(root: FakeNode, kind: string): FakeElement | null {
  const all = findAll(root, (node) => kindOf(node) === kind);
  return all.length === 0 ? null : (all[0] as FakeElement);
}

/** Click a button the way a mouse or a keyboard would — its own listener. */
async function click(node: FakeElement): Promise<void> {
  assert.equal(node.disabled, false, `${kindOf(node)} is disabled; a click would do nothing`);
  const listeners = node.listeners['click'] ?? [];
  assert.ok(listeners.length > 0, `${kindOf(node)} has no click listener`);
  await withDocument(async () => {
    for (const listener of listeners) await listener({});
  });
}

// ── The shell's contract, as much of it as this control may touch ─────────

interface I18nModule {
  t: (
    strings: Record<string, string>, key: string,
    subs: Record<string, string | number>, document: typeof doc,
  ) => FakeNode[];
  tFlat: (strings: Record<string, string>, key: string, subs?: Record<string, string | number>) => string;
  slots: (template: string) => string[];
}

interface ActionsModule {
  commandActions: (spec: {
    argv: string[]; id: string | null; values?: Record<string, unknown>;
    ctx: unknown; copyBlocked?: boolean;
  }) => FakeElement;
  COMMAND_EFFECTS: Map<string, (values: Record<string, unknown>) => { field: string; after: string[] }[]>;
  CONFIRM_ID_ARG: string;
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface Call { method: 'GET' | 'POST'; path: string; body?: unknown }

interface Wiring {
  /** What `GET /api/execute/confirm` answers. `null` makes it throw. */
  confirm?: Record<string, unknown> | null;
  /** What `GET /api/item/:id` answers, by id. A missing id throws, as the route 404s. */
  items?: Record<string, Record<string, unknown>>;
  /** What `POST /api/execute` answers. */
  outcome?: Record<string, unknown>;
}

/**
 * `ctx`, plus the call log every "nothing ran" assertion in this file reads.
 *
 * `tFlat` is NOT wired to throw here, unlike the screen tests': this control
 * has a real attribute sink — the confirm's accessible name — and ruling A1
 * names attributes as exactly what `tFlat` is for.
 */
async function wire(wiring: Wiring): Promise<{ ctx: unknown; calls: Call[] }> {
  const i18n = await browserModule<I18nModule>('lib', 'i18n.js');
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  const calls: Call[] = [];
  const ctx = {
    t: (key: string, subs: Record<string, string | number> = {}) => i18n.t(en, key, subs, doc),
    tFlat: (key: string, subs: Record<string, string | number> = {}) => i18n.tFlat(en, key, subs),
    api: async (route: string): Promise<unknown> => {
      calls.push({ method: 'GET', path: route });
      if (route.startsWith('/api/execute/confirm')) {
        if (wiring.confirm === null || wiring.confirm === undefined) {
          throw new Error('no command named "nope" is in the catalogue');
        }
        return wiring.confirm;
      }
      const item = /^\/api\/item\/(.+)$/.exec(route);
      if (item !== null) {
        const found = (wiring.items ?? {})[decodeURIComponent(item[1] ?? '')];
        if (found === undefined) throw new Error(`no item ${item[1]} in this corpus`);
        return { item: found };
      }
      throw new Error(`this control asked for ${route}, which nothing wired it to read`);
    },
    post: async (route: string, body: unknown): Promise<unknown> => {
      calls.push({ method: 'POST', path: route, body });
      return wiring.outcome ?? { id: 'doctor', argv: ['doctor'], exitCode: 0, durationMs: 3, stdout: '', stderr: '' };
    },
  };
  return { ctx, calls };
}

const posts = (calls: Call[]): Call[] => calls.filter((c) => c.method === 'POST');

/** The confirm body the server sends for a read — below the boundary. */
const DOCTOR_CONFIRM = {
  id: 'doctor', argv: ['doctor'], boundary: false,
  nonce: '0'.repeat(32), residual: EXECUTION_RESIDUAL,
};

/** The confirm body the server sends for `pin` — on the boundary. */
const PIN_CONFIRM = {
  id: 'pin', argv: ['pin', 'RULE-x'], boundary: true,
  nonce: 'a'.repeat(32), residual: EXECUTION_RESIDUAL,
};

/** One real item, as `GET /api/item/:id` serves it: `always` is a BOOLEAN there. */
const RULE_X = {
  id: 'RULE-x', type: 'rule', title: 'Round half to even', status: 'active',
  severity: 'soft', always: false, scope: ['src/billing/**'], tags: ['money'],
  extra: {}, body: 'Round half to even.',
};

async function draw(spec: {
  argv: string[]; id: string | null; values?: Record<string, unknown>; copyBlocked?: boolean;
}, wiring: Wiring = {}): Promise<{ root: FakeElement; calls: Call[] }> {
  const { commandActions } = await browserModule<ActionsModule>('lib', 'command-actions.js');
  const { ctx, calls } = await wire(wiring);
  const root = await withDocument(async () => commandActions({ ...spec, ctx }));
  return { root, calls };
}

/* -------------------------------------------------------------------------- *
 * One control, drawn once.
 * -------------------------------------------------------------------------- */

test('the control draws BOTH actions, and each is a real, keyboard-operable button', async () => {
  const { root } = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });

  assert.equal(kindOf(root), 'div.cmdactions');
  assert.deepEqual(childKinds(root).filter((k) => k.startsWith('button')),
    ['button.copy', 'button.exec'],
    'Copy and Execute are ONE control: nine screens composing a command must not grow nine '
    + 'spellings of the confirm, because the confirm is the security boundary');

  // `type="button"` on both, because these sit inside forms on three of the
  // seven adopting screens and a bare <button> in a form submits it.
  for (const kind of ['button.copy', 'button.exec']) {
    assert.equal(findOne(root, kind).type, 'button', `${kind} must declare type=button`);
  }
});

test('Copy still does what it always did — the composed string, verbatim', async () => {
  clipboard.written.length = 0;
  clipboard.fail = null;
  const { root, calls } = await draw({
    argv: ['mycontext', 'add', 'rule', 'two words'], id: 'add', values: { category: 'rule', title: 'two words' },
  });
  await click(findOne(root, 'button.copy'));

  assert.deepEqual(clipboard.written, ['mycontext add rule "two words"'],
    'the quoting has ONE implementation (lib/command.js) and this control uses it rather than '
    + 'growing a tenth');
  assert.deepEqual(posts(calls), [], 'copying is not running');
});

test('a copy that fails says so — success is silent, failure is loud', async () => {
  clipboard.written.length = 0;
  clipboard.fail = 'clipboard write permission denied';
  const { root } = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });
  await click(findOne(root, 'button.copy'));
  // The platform's own words, unedited — the treatment doctor.js settled on,
  // because neither string table can carry a "Copy failed" the mockup's own
  // handler swaps in through an unkeyed ternary.
  assert.match(textOf(root), /permission denied/);
  clipboard.fail = null;
});

test('a blocked copy is refused at the button, and Execute is still offered', async () => {
  const { root } = await draw({
    argv: ['mycontext', 'add', 'rule', 'the $(echo X) way'], id: 'add', copyBlocked: true,
    values: { category: 'rule', title: 'the $(echo X) way' },
  });
  assert.equal(findOne(root, 'button.copy').disabled, true,
    'a blocked command must not be one click from a clipboard — pal.block says why in the same breath');
  // And Execute is NOT blocked by the same measurement, which is the whole
  // asymmetry: a paste reaches a SHELL, where $(…) substitutes; an execution
  // reaches execFile with an argv array, where it is an ordinary literal.
  assert.equal(findOne(root, 'button.exec').disabled, false);
});

/* -------------------------------------------------------------------------- *
 * The catalogue is the whole of what may run.
 * -------------------------------------------------------------------------- */

test('an entry with NO catalogue id gets Copy alone — nothing outside the catalogue runs', async () => {
  const { root } = await draw({ argv: ['mycontext', 'whatever'], id: null });
  assert.deepEqual(childKinds(root).filter((k) => k.startsWith('button')), ['button.copy']);
  assert.equal(findMaybe(root, 'button.exec'), null,
    'the client sends a catalogue id and never a command (§3.1); a composition the catalogue '
    + 'cannot name has nothing the server would rebuild');
});

/* -------------------------------------------------------------------------- *
 * The confirm, and the run that does not happen until it is answered.
 * -------------------------------------------------------------------------- */

test('Execute opens a confirm and runs NOTHING — the first click POSTs nothing at all', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));

  const confirm = findOne(root, 'div.confirm');
  assert.equal(confirm.hidden, false, 'the confirm must be rendered, not merely built');
  assert.match(textOf(confirm), /mycontext doctor/,
    'the confirm names the resolved command; the string a person reads and the argv that runs '
    + 'are the same thing, which is the one property the whole route exists to keep');
  assert.deepEqual(posts(calls), [],
    'a POST on the first click would make the confirm a receipt rather than a gate');
});

test('the confirm SHOWS THE SERVER\'S argv, not the string the client composed', async () => {
  // The client's argv and the server's disagree here on purpose. The server
  // rebuilds from its own catalogue (§3.1) and the nonce is bound to THAT; a
  // confirm rendering the client's version would show one command and run
  // another, which is the exact defect the confirm exists to prevent.
  const { root } = await draw(
    { argv: ['mycontext', 'doctor', '--stale'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));
  const shown = textOf(findOne(root, 'div.confirm'));
  assert.match(shown, /mycontext doctor/);
  assert.ok(!shown.includes('--stale'), 'the confirm must show what the SERVER resolved');
});

test('the confirm carries the residual VERBATIM, in the words §6.3 chose', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));
  const shown = textOf(findOne(root, 'div.confirm'));

  // The LITERAL sentence, not "a residual field was rendered". §6.3 makes these
  // words the deliverable: the gate proves a request came from a browser on
  // this machine and never that a person asked, and that limit is written where
  // a reader MEETS it rather than where a reader could look it up.
  assert.match(shown, /This runs on your machine, now\./);
  assert.match(shown, /The UI can tell it came from your browser — not that you asked\./);
  assert.match(shown, /Only run what you recognise here\./);
  // And byte for byte against the server's own constant, so a reword on one
  // side alone fails here rather than shipping two residuals.
  assert.ok(shown.includes(EXECUTION_RESIDUAL),
    'the residual is spelled once, on the server, and rendered as it arrived');
});

test('the confirm announces what it is, and can be reached and left from the keyboard', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));
  const confirm = findOne(root, 'div.confirm');

  assert.equal(confirm.attributes['role'], 'group');
  assert.ok((confirm.attributes['aria-label'] ?? '').length > 0,
    'a confirm with no accessible name is a region a screen reader announces as "group"');
  assert.equal(confirm.tabIndex, -1);
  assert.equal(confirm.focused, 1,
    'focus moves INTO the confirm so its label and the residual are read before either button '
    + 'is reached — deliberately not onto "Run it", which Enter would then fire');

  const escape = confirm.listeners['keydown'] ?? [];
  assert.ok(escape.length > 0, 'Escape must dismiss the confirm');
});

test('cancelling runs nothing and spends nothing', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'pin', 'RULE-x'], id: 'pin', values: { id: 'RULE-x' } },
    { confirm: PIN_CONFIRM, items: { 'RULE-x': RULE_X } },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.cancel'));

  assert.equal(findOne(root, 'div.confirm').hidden, true);
  assert.deepEqual(posts(calls), [],
    'a cancel that spent the nonce would make "no" cost the same as "yes"');
});

/* -------------------------------------------------------------------------- *
 * Which confirm a command gets — §3.2, as widened by §6.1.
 * -------------------------------------------------------------------------- */

test('a BOUNDARY command shows a field-by-field diff, naming the field and both values', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'pin', 'RULE-x'], id: 'pin', values: { id: 'RULE-x' } },
    { confirm: PIN_CONFIRM, items: { 'RULE-x': RULE_X } },
  );
  await click(findOne(root, 'button.exec'));
  const confirm = findOne(root, 'div.confirm');

  assert.ok(renderedKinds(confirm).includes('table.diff'),
    'on or above the boundary a command must NAME every field that changes, before → after');
  const diff = findOne(confirm, 'table.diff');
  assert.match(textOf(diff), /always/, 'the field pin changes');
  assert.match(textOf(diff), /false/, 'what is in force now, read from the item itself');
  assert.match(textOf(diff), /true/, 'what would be in force after');

  // The `-` and `+` runs are the mockup's own marks for the two, and the
  // reason the cell can carry both: `<del>` is what is in force, `<ins>` is not.
  const kinds = renderedKinds(diff);
  assert.ok(kinds.includes('del'), 'the value being replaced is struck');
  assert.ok(kinds.includes('ins'), 'the value replacing it is marked as an addition');
});

test('the diff\'s BEFORE comes from the corpus, not from the command', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'pin', 'RULE-x'], id: 'pin', values: { id: 'RULE-x' } },
    { confirm: PIN_CONFIRM, items: { 'RULE-x': RULE_X } },
  );
  // `assert.equal(length)` rather than `deepEqual(calls, [])`: the latter
  // narrows `calls` to `never[]` for the rest of the function and typecheck
  // then refuses the assertion that matters.
  assert.equal(calls.length, 0, 'nothing is read until Execute is clicked');
  await click(findOne(root, 'button.exec'));

  assert.deepEqual(calls.map((c) => c.path).filter((p) => p.startsWith('/api/item/')),
    ['/api/item/RULE-x'],
    '"before" is what is in force in the corpus. Deriving it from the command instead would '
    + 'make the confirm agree with itself rather than with the item');
});

test('an item the corpus does not have leaves the BEFORE column empty rather than inventing one', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'pin', 'RULE-gone'], id: 'pin', values: { id: 'RULE-gone' } },
    { confirm: { ...PIN_CONFIRM, argv: ['pin', 'RULE-gone'] }, items: {} },
  );
  await click(findOne(root, 'button.exec'));
  const diff = findOne(root, 'table.diff');
  assert.match(textOf(diff), /always/, 'the field is still named');
  assert.ok(renderedKinds(diff).includes('ins'), 'and so is what would be written');
  assert.ok(!renderedKinds(diff).includes('del'),
    'there is nothing to strike through, and a fabricated "false" would be a claim about an '
    + 'item this browser could not read');
});

test('a command BELOW the boundary gets the plain confirm and NO diff', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));
  const confirm = findOne(root, 'div.confirm');

  assert.equal(findMaybe(confirm, 'table.diff'), null,
    'a read gets a plain confirm naming the command and its resolved argv; a diff of nothing '
    + 'would be ceremony that teaches the reader to click past the one that matters');
  assert.match(textOf(confirm), /mycontext doctor/);
  assert.deepEqual(calls.filter((c) => c.path.startsWith('/api/item/')), [],
    'no item is read for a command that changes no item');
});

test('a boundary command whose fields CANNOT be named does not run — §3.2, in those words', async () => {
  // `add` creates an item; `supersede` retires one through a path this control
  // cannot state field by field. Spec §3.2: "A command whose effect cannot be
  // shown that way does not get a weaker confirm — it does not run."
  const { root, calls } = await draw(
    { argv: ['mycontext', 'supersede', 'RULE-x', '--by', 'RULE-y'], id: 'supersede',
      values: { id: 'RULE-x', by: 'RULE-y' } },
    {
      confirm: { id: 'supersede', argv: ['supersede', 'RULE-x', '--by', 'RULE-y'], boundary: true,
        nonce: 'b'.repeat(32), residual: EXECUTION_RESIDUAL },
      items: { 'RULE-x': RULE_X },
    },
  );
  await click(findOne(root, 'button.exec'));

  assert.equal(findOne(root, 'div.confirm').hidden, true, 'no weaker confirm is offered');
  assert.deepEqual(posts(calls), [], 'and nothing runs');
  assert.match(textOf(root), /supersede/,
    'the refusal names the command, so a reader knows which one is unclassified rather than '
    + 'believing the button is broken');
});

/* -------------------------------------------------------------------------- *
 * The run, and the state a refusal leaves.
 * -------------------------------------------------------------------------- */

test('answering the confirm POSTs the id, the values and the nonce — and never an argv', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.go'));

  assert.equal(posts(calls).length, 1);
  const sent = posts(calls)[0]!;
  assert.equal(sent.path, '/api/execute');
  assert.deepEqual(sent.body, { id: 'doctor', values: {}, nonce: DOCTOR_CONFIRM.nonce });
  assert.ok(!Object.hasOwn(sent.body as object, 'argv'),
    'the server refuses a body carrying an argv, and it is right to: a client that sends one '
    + 'has misunderstood the contract');
});

test('the result is SHOWN — a clean run reports its exit code', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' },
    { confirm: DOCTOR_CONFIRM, outcome: { id: 'doctor', argv: ['doctor'], exitCode: 0, durationMs: 9, stdout: 'ok', stderr: '' } },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.go'));

  const result = findOne(root, 'div.execresult');
  assert.equal(result.hidden, false);
  assert.match(textOf(result), /exit 0/);
  assert.equal(result.attributes['role'], 'status',
    'the exit code is the answer to the question the click asked; a live region is how a '
    + 'reader who is not watching the button hears it');
});

test('a NON-ZERO exit is reported with its stderr — a refusal is a state to leave', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'supersede', 'NOPE'], id: 'doctor' },
    {
      confirm: DOCTOR_CONFIRM,
      outcome: {
        id: 'doctor', argv: ['doctor'], exitCode: 2, durationMs: 40,
        stdout: '', stderr: 'no item NOPE in this corpus',
      },
    },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.go'));

  const result = findOne(root, 'div.execresult');
  assert.match(textOf(result), /exit 2/);
  assert.match(textOf(result), /no item NOPE in this corpus/,
    'a UI that hid the stderr would leave a person believing a command they watched had done '
    + 'something');
  assert.ok(renderedKinds(result).includes('span.bad.exitcode'),
    'and the code is marked as a failure, not only printed');
});

test('a run that never returned is not reported as a success', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'rebuild'], id: 'rebuild' },
    {
      confirm: { ...DOCTOR_CONFIRM, id: 'rebuild', argv: ['rebuild'] },
      outcome: {
        id: 'rebuild', argv: ['rebuild'], exitCode: null, durationMs: 60_000,
        stdout: '', stderr: '', error: 'the command timed out after 60000 ms and was killed',
      },
    },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.go'));

  const shown = textOf(findOne(root, 'div.execresult'));
  assert.ok(!/exit 0/.test(shown),
    '"we stopped watching" and "it succeeded" are different facts and only one is reassuring');
  assert.match(shown, /timed out/, 'the server\'s own words, unedited');
});

test('the audit note is surfaced — a log that cannot record how a run ended says so', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' },
    {
      confirm: DOCTOR_CONFIRM,
      outcome: {
        id: 'doctor', argv: ['doctor'], exitCode: 0, durationMs: 5, stdout: '', stderr: '',
        auditNote: 'the completion record for this run could not be written (EACCES).',
      },
    },
  );
  await click(findOne(root, 'button.exec'));
  await click(findOne(root, 'button.go'));
  assert.match(textOf(findOne(root, 'div.execresult')), /could not be written/,
    'an execute row with no execute-done beside it MEANS a run that never returned; a swallowed '
    + 'note would leave the log making a specific and false statement');
});

test('a confirm the server refuses is shown, and nothing runs', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'nope'], id: 'nope' }, { confirm: null },
  );
  await click(findOne(root, 'button.exec'));
  assert.match(textOf(root), /is in the catalogue/, 'the server\'s refusal, in its own words');
  assert.deepEqual(posts(calls), []);
});

/* -------------------------------------------------------------------------- *
 * The claims this module makes about the CLI, held against the CLI.
 * -------------------------------------------------------------------------- */

test('the four named entry points\' declared effects agree with the CLI\'s own table', async () => {
  const { COMMAND_EFFECTS } = await browserModule<ActionsModule>('lib', 'command-actions.js');

  // `NAMED_ENTRY_POINTS` is the CLI's statement that `pin` IS
  // `edit <id> --always=true`. The browser cannot import it — there is no build
  // step — so it is transcribed, and this is what holds the transcription
  // honest. A fifth entry point added there with no effect declared here fails
  // right here, by name.
  for (const entry of NAMED_ENTRY_POINTS) {
    const effect = COMMAND_EFFECTS.get(entry.name);
    assert.ok(effect !== undefined,
      `${entry.name} is a named entry point onto edit and this control declares no effect for `
      + 'it, so its confirm would have no fields to name and it would not run');
    const [field, value] = entry.sets.replace(/^--/, '').split('=');
    assert.deepEqual(effect({}), [{ field, after: [value] }],
      `${entry.name} sets ${entry.sets}; the confirm must say exactly that and nothing else`);
  }
});

test('`edit`\'s effect names every field its own arguments name, and no others', async () => {
  const { COMMAND_EFFECTS } = await browserModule<ActionsModule>('lib', 'command-actions.js');
  const effect = COMMAND_EFFECTS.get('edit');
  assert.ok(effect !== undefined);

  assert.deepEqual(effect({ id: 'RULE-x', title: 'New title', severity: 'hard' }),
    [{ field: 'title', after: ['New title'] }, { field: 'severity', after: ['hard'] }],
    'the id is not a field that changes, and a flag nobody filled changes nothing');
  assert.deepEqual(effect({ id: 'RULE-x', yes: true }), [],
    '--yes answers the gate; it is not a field');
  // A list-valued field is normalised to the corpus\'s own spelling so that the
  // before and after columns are comparable rather than merely adjacent.
  assert.deepEqual(effect({ id: 'RULE-x', tags: 'money,billing' }),
    [{ field: 'tags', after: ['billing, money'] }]);
});

/* -------------------------------------------------------------------------- *
 * The bytes.
 * -------------------------------------------------------------------------- */

test('the diff is drawn by fieldView — this control builds no second one', async () => {
  // `viewmodel.js`'s fieldView was lifted into lib/ on 2026-08-26 (plan:walk
  // seq:46) for exactly this. A second implementation would be a second opinion
  // about which lines are in force, on the surface where that question decides
  // whether a person understood what they authorised.
  assert.match(SOURCE, /\bfieldView\b/);
  assert.match(SOURCE, /from '\.\/viewmodel\.js'/,
    'imported from the shared decision layer, not copied');
});

test('no innerHTML, ever — the page ships with no unsafe-inline anywhere', async () => {
  assert.ok(!/innerHTML|outerHTML|insertAdjacentHTML|document\.write/.test(SOURCE),
    'assigning markup destroys the .m spans that carry unicode-bidi:isolate, and the server '
    + 'sends style-src \'self\' with no \'unsafe-inline\'');
  assert.ok(!/\.style\s*=|setAttribute\(\s*['"]style['"]/.test(SOURCE),
    'a style="…" attribute is refused by the CSP this product ships under; CSSOM only');
});

test('every string key this control names is declared in both tables, with its slots supplied', async () => {
  const i18n = await browserModule<I18nModule>('lib', 'i18n.js');
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  const he = (await browserModule<{ strings: Record<string, string> }>('strings', 'he.js')).strings;

  const named = [...SOURCE.matchAll(/ctx\.t(?:Flat)?\('([^']+)'(,\s*\{([^}]*)\})?\)/g)];
  assert.ok(named.length > 0, 'no ctx.t() call found — the scan is looking at the wrong file');

  const missing: string[] = [];
  const unsupplied: string[] = [];
  for (const [, key, , subs] of named) {
    if (!Object.hasOwn(en, key!)) { missing.push(`en:${key}`); continue; }
    if (!Object.hasOwn(he, key!)) { missing.push(`he:${key}`); continue; }
    const supplied = new Set([...(subs ?? '').matchAll(/([A-Za-z][A-Za-z0-9]*)\s*:/g)].map((m) => m[1]!));
    for (const slot of i18n.slots(en[key!]!)) {
      if (!supplied.has(slot)) unsupplied.push(`${key} needs {${slot}}`);
    }
  }
  assert.deepEqual(missing, [], 'a key in one table and not the other fails strings-parity');
  assert.deepEqual(unsupplied, [], 'a missing substitution puts braces on the screen');
});
