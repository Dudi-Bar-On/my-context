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

// ── Buttons are selected by their ACCESSIBLE NAME, never by a class ───────
//
// This file selected the control's buttons by class until 2026-08-27, and those
// classes are gone. Nothing in `styles.css` ever selected them — the appearance
// comes from the ancestor rule `.cmdactions button` — so they carried no
// appearance and existed only as handles for these assertions, while
// `e2e/screen-parity.spec.ts` compares kinds as `tag.class1.class2` and the
// design of record draws a bare `<button>`. A classed button therefore deleted
// the kind `button` from doctor, work and capture and failed the parity gate.
//
// The replacement is the button's TEXT, which is what a screen reader and a
// Playwright `getByRole` already select by. Deliberately NOT a `data-`
// attribute: that is the same departure from the mockup wearing another name,
// and `screen-parity` would not catch the next one.

/**
 * The two labels, in the `en` table's own words. Held to that table by the
 * first test below, so a reword there fails by name rather than turning every
 * selector in this file into a silent miss.
 */
const COPY = 'Copy';
const EXEC = 'Execute';

/** The direct-child buttons of a node, as the labels a person reads. */
function buttonLabels(root: FakeNode): string[] {
  return root.children.filter((c) => c.tag === 'button').map((c) => textOf(c).trim());
}

function findButton(root: FakeNode, label: string): FakeElement {
  const all = findAll(root, (node) => node.tag === 'button' && textOf(node).trim() === label);
  assert.equal(all.length, 1, `expected exactly one button labelled "${label}", found ${all.length}`);
  return all[0] as FakeElement;
}

function findButtonMaybe(root: FakeNode, label: string): FakeElement | null {
  const all = findAll(root, (node) => node.tag === 'button' && textOf(node).trim() === label);
  return all.length === 0 ? null : (all[0] as FakeElement);
}

/**
 * Press a button and DO NOT wait for its handler to settle.
 *
 * `click` below awaits every listener, which is right for a control whose whole
 * answer has arrived — and blind to the state a reader actually spends seconds
 * looking at. This returns the handler's promise instead, so a test can assert
 * what the control shows WHILE its request is in flight, then await it.
 */
function press(node: FakeElement): Promise<void> {
  assert.equal(node.disabled, false, `${kindOf(node)} is disabled; a click would do nothing`);
  const listeners = node.listeners['click'] ?? [];
  assert.ok(listeners.length > 0, `${kindOf(node)} has no click listener`);
  return withDocument(async () => {
    for (const listener of listeners) await listener({});
  });
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
    ctx: unknown; copyBlocked?: boolean; onCopied?: () => void;
  }) => FakeElement;
  CONFIRM_ID_ARG: string;
}

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface Call { method: 'GET' | 'POST'; path: string; body?: unknown }

interface Wiring {
  /** What `GET /api/execute/confirm` answers. `null` makes it throw. */
  confirm?: Record<string, unknown> | null;
  /**
   * The sentence the confirm route refuses with, when it refuses.
   *
   * Since seq:5b the SERVER derives a boundary command's effect by running it
   * against a copy, and a command whose effect cannot be derived is refused
   * there — before a nonce is minted. So the client's §3.2 behaviour is now
   * "the confirm GET failed and I showed why", which needs a real message
   * rather than the catalogue's not-found one.
   */
  confirmError?: string;
  /**
   * Held open, so the IN-FLIGHT state can be observed.
   *
   * The confirm GET is not a lookup — it copies the corpus and runs the command
   * against the copy (`src/ui/execute-effect.ts`), measured at 5.1–7.3s on
   * `.demo-corpus`. Every other test in this file wires an answer that arrives
   * in the same microtask, which is precisely why nothing here could see the
   * seconds a real reader spends. Awaited before the answer is returned, so a
   * test can assert what the control looks like while a person is waiting.
   */
  confirmGate?: Promise<unknown>;
  /** What `GET /api/item/:id` answers, by id. A missing id throws, as the route 404s. */
  items?: Record<string, Record<string, unknown>>;
  /** What `POST /api/execute` answers. */
  outcome?: Record<string, unknown>;
  /**
   * The page's OWN language — `window.myctx.lang` in the real shell, `table.lang`
   * closed over there. Left undefined reproduces a page that never set it; the
   * control must still work (and still ask the confirm for something), which is
   * exactly the "unknown/absent" half of Task 8b's requirement — the SERVER'S
   * job to degrade, not this control's.
   */
  lang?: string;
}

/**
 * One thing said in the shell's ONE live region — the nodes, and whether the
 * control asked for the interruption.
 *
 * Recorded as the RENDERED TEXT rather than as the key, deliberately. The key
 * is what the control names; what a reader is told is what the table renders
 * from it, and a test that asserted the key would pass over a key declared with
 * the wrong sentence behind it.
 */
interface Said { text: string; urgent: boolean }

/**
 * `ctx`, plus the call log every "nothing ran" assertion in this file reads.
 *
 * `tFlat` is NOT wired to throw here, unlike the screen tests': this control
 * has a real attribute sink — the confirm's accessible name — and ruling A1
 * names attributes as exactly what `tFlat` is for.
 *
 * `announce` is the shell's contract, stubbed to a log. In the browser it
 * writes into the one `aria-live` region `renderChrome()` builds; here what
 * matters is that the control reaches for it, with which sentence, and at which
 * urgency. That the region EXISTS and that its content actually changes in a
 * real browser is `e2e/announce.spec.ts`' assertion — a stub cannot prove a
 * live region, and a test that only proved the stub was called would be exactly
 * the proxy this task was filed about.
 */
async function wire(wiring: Wiring): Promise<{ ctx: unknown; calls: Call[]; said: Said[] }> {
  const i18n = await browserModule<I18nModule>('lib', 'i18n.js');
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  const calls: Call[] = [];
  const said: Said[] = [];
  const ctx = {
    announce: (nodes: FakeNode[], urgent = false): void => {
      said.push({ text: nodes.map(textOf).join(''), urgent });
    },
    t: (key: string, subs: Record<string, string | number> = {}) => i18n.t(en, key, subs, doc),
    tFlat: (key: string, subs: Record<string, string | number> = {}) => i18n.tFlat(en, key, subs),
    lang: wiring.lang,
    api: async (route: string): Promise<unknown> => {
      calls.push({ method: 'GET', path: route });
      if (route.startsWith('/api/execute/confirm')) {
        if (wiring.confirmGate !== undefined) await wiring.confirmGate;
        if (wiring.confirmError !== undefined) throw new Error(wiring.confirmError);
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
  return { ctx, calls, said };
}

const posts = (calls: Call[]): Call[] => calls.filter((c) => c.method === 'POST');

/**
 * `EXECUTION_RESIDUAL` became one sentence PER LANGUAGE in Task 8b — see the
 * import comment there — so every fixture confirm below names `.en` rather
 * than the bare constant it used to be. This file's own render never chooses
 * a language; it renders whatever `answer.residual` the wired-up `ctx.api`
 * hands back, which is what makes the language-carrying tests further down
 * meaningful: they wire a DIFFERENT `.residual` and check it comes out.
 */

/** The confirm body the server sends for a read — below the boundary. */
const DOCTOR_CONFIRM = {
  id: 'doctor', argv: ['doctor'], boundary: false,
  nonce: '0'.repeat(32), residual: EXECUTION_RESIDUAL.en,
};

/** The confirm body the server sends for `pin` — on the boundary. */
const PIN_CONFIRM = {
  id: 'pin', argv: ['pin', 'RULE-x'], boundary: true,
  nonce: 'a'.repeat(32), residual: EXECUTION_RESIDUAL.en,
  // **The effect is the SERVER'S now**, derived by running the command against
  // a throwaway copy of the corpus (`src/ui/execute-effect.ts`). The browser
  // used to compute this from a transcribed table plus its own read of
  // `/api/item/:id`; it does neither, so the shape below is what it renders.
  effect: [
    { id: 'RULE-x', kind: 'changed', fields: [{ field: 'always', before: ['false'], after: ['true'] }] },
  ],
};

/** One real item, as `GET /api/item/:id` serves it: `always` is a BOOLEAN there. */
const RULE_X = {
  id: 'RULE-x', type: 'rule', title: 'Round half to even', status: 'active',
  severity: 'soft', always: false, scope: ['src/billing/**'], tags: ['money'],
  extra: {}, body: 'Round half to even.',
};

async function draw(spec: {
  argv: string[]; id: string | null; values?: Record<string, unknown>; copyBlocked?: boolean;
  onCopied?: () => void;
}, wiring: Wiring = {}): Promise<{ root: FakeElement; calls: Call[]; said: Said[] }> {
  const { commandActions } = await browserModule<ActionsModule>('lib', 'command-actions.js');
  const { ctx, calls, said } = await wire(wiring);
  const root = await withDocument(async () => commandActions({ ...spec, ctx }));
  return { root, calls, said };
}

/* -------------------------------------------------------------------------- *
 * One control, drawn once.
 * -------------------------------------------------------------------------- */

test('the control draws BOTH actions, and each is a real, keyboard-operable button', async () => {
  const { root } = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });

  // The labels this file selects by ARE the string table's, checked here so a
  // reword fails by name instead of making every `findButton` below a miss.
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  assert.equal(en['btn.copy'], COPY);
  assert.equal(en['exec.btn'], EXEC);

  assert.equal(kindOf(root), 'div.cmdactions');
  assert.deepEqual(buttonLabels(root), [COPY, EXEC],
    'Copy and Execute are ONE control: nine screens composing a command must not grow nine '
    + 'spellings of the confirm, because the confirm is the security boundary');

  // **And both are CLASSLESS.** `e2e/screen-parity.spec.ts` compares kinds as
  // `tag.class1.class2` against the mockup, which draws a bare `<button>` here;
  // a classed one deleted the kind `button` from doctor, work and capture. The
  // classes were never what made these visible — `.cmdactions button`, the
  // ancestor rule, is — so dropping them costs no appearance. Asserted rather
  // than left to the browser gate so a reintroduction fails in milliseconds.
  assert.deepEqual(childKinds(root).filter((k) => k.startsWith('button')), ['button', 'button'],
    'these buttons carry no class: the mockup draws them bare and `.cmdactions button` '
    + 'is what styles them');

  // `type="button"` on both, because these sit inside forms on three of the
  // seven adopting screens and a bare <button> in a form submits it.
  for (const label of [COPY, EXEC]) {
    assert.equal(findButton(root, label).type, 'button', `${label} must declare type=button`);
  }
});

test('Copy still does what it always did — the composed string, verbatim', async () => {
  clipboard.written.length = 0;
  clipboard.fail = null;
  const { root, calls } = await draw({
    argv: ['mycontext', 'add', 'rule', 'two words'], id: 'add', values: { category: 'rule', title: 'two words' },
  });
  await click(findButton(root, COPY));

  assert.deepEqual(clipboard.written, ['mycontext add rule "two words"'],
    'the quoting has ONE implementation (lib/command.js) and this control uses it rather than '
    + 'growing a tenth');
  assert.deepEqual(posts(calls), [], 'copying is not running');
});

test('a copy that fails says so on screen — the platform\'s own words, unedited', async () => {
  clipboard.written.length = 0;
  clipboard.fail = 'clipboard write permission denied';
  const { root } = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });
  await click(findButton(root, COPY));
  // The platform's own words, unedited — the treatment doctor.js settled on,
  // because neither string table can carry a "Copy failed" the mockup's own
  // handler swaps in through an unkeyed ternary. This is the sighted reader's
  // half; the announcement below is the other, and neither replaces the other.
  assert.match(textOf(root), /permission denied/);
  clipboard.fail = null;
});

/* -------------------------------------------------------------------------- *
 * The acknowledgement — plan:walk seq:31.
 *
 * **THE PROPERTY IS THE SETTLEMENT OF THE WRITE, NEVER THE CLICK.** Measured
 * 2026-08-25 on `work`, `capture` and `doctor`: after a Copy click the button's
 * label, its class list and its ARIA attributes were BYTE-IDENTICAL to before,
 * and no element anywhere in the document had changed. A reader could not tell
 * a successful copy from a click that missed.
 *
 * The repair that would have re-created the defect is a click handler that
 * announces "Copied" and then writes. So both tests below drive the CLIPBOARD
 * and read the announcement: one where the write resolves, one where it
 * rejects, with the SAME click on the same button. A handler keyed to the click
 * cannot tell those two apart, and would fail exactly one of them.
 * -------------------------------------------------------------------------- */

test('a copy that RESOLVES is announced, and it is the outcome that is announced', async () => {
  clipboard.written.length = 0;
  clipboard.fail = null;
  let flipped = 0;
  const { root, said } = await draw({
    argv: ['mycontext', 'doctor'], id: 'doctor', onCopied: () => { flipped += 1; },
  });

  // Nothing is said before the button is pressed — a live region that already
  // holds "Copied" at first paint announces a copy nobody made.
  assert.deepEqual(said, [], 'the region must be silent until something has happened');

  await click(findButton(root, COPY));

  assert.deepEqual(clipboard.written, ['mycontext doctor'], 'the write itself still happens');
  assert.deepEqual(said, [{ text: 'Copied to the clipboard.', urgent: false }],
    'one polite sentence, said once, naming the OUTCOME. A success does not argue for '
    + 'interrupting whatever a reader is already being told');
  assert.equal(flipped, 1,
    'the screen\'s own state is told too, and by the same settlement — `work.js` draws '
    + '`.cmdstate` from this and drew "copied, not yet observed landing" unconditionally before it');
});

test('a copy that REJECTS is announced as a failure, and that one interrupts', async () => {
  clipboard.written.length = 0;
  // **How the write is made to reject.** `navigator` is a getter-only accessor
  // on Node 24, so the stand-in is DEFINED over it (see `withDocument`), and its
  // `clipboard.writeText` answers `Promise.reject(new Error(clipboard.fail))`
  // whenever `fail` is set. The button is pressed exactly as in the test above:
  // the only difference is what the platform promise does, which is the only
  // difference a reader has either.
  clipboard.fail = 'clipboard write permission denied';
  let flipped = 0;
  const { root, said } = await draw({
    argv: ['mycontext', 'doctor'], id: 'doctor', onCopied: () => { flipped += 1; },
  });
  await click(findButton(root, COPY));

  assert.deepEqual(clipboard.written, [], 'nothing reached the clipboard');
  assert.deepEqual(
    said,
    [{ text: 'Copy failed. Nothing was written to the clipboard.', urgent: true }],
    'the failure names what did NOT happen. Assertive is the one interruption the ruling '
    + 'reserves for a failure, and this is why: a reader who believes the line is on their '
    + 'clipboard pastes whatever WAS on it into a shell, and a polite queue can hold that '
    + 'news until after they have',
  );
  assert.equal(flipped, 0,
    'a refused write must not flip the screen\'s state — that is the same lie one layer down');
  clipboard.fail = null;
});

test('the announcement is the SETTLEMENT and not the click — the two clicks differ', async () => {
  // The one assertion that a click-keyed handler cannot pass. Same button, same
  // press, two platform answers; if what is said were a function of the click,
  // these two sentences would be identical.
  clipboard.written.length = 0;
  clipboard.fail = null;
  const ok = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });
  await click(findButton(ok.root, COPY));

  clipboard.fail = 'the document is not focused';
  const bad = await draw({ argv: ['mycontext', 'doctor'], id: 'doctor' });
  await click(findButton(bad.root, COPY));
  clipboard.fail = null;

  assert.equal(ok.said.length, 1);
  assert.equal(bad.said.length, 1);
  assert.notEqual(ok.said[0]?.text, bad.said[0]?.text,
    'a Copy button that announces success on click has re-created the defect this task was '
    + 'filed for — this project has caught proxy-instead-of-property seven times, and a click '
    + 'is a proxy for a copy');
});

test('a composition outside the catalogue is acknowledged too — Copy alone still speaks', async () => {
  // The `id: null` branch returns EARLY, before the confirm and the result
  // region are built, and it used to carry its own second copy handler. One
  // handler now serves both branches: a reader of the Composer's uncatalogued
  // line is owed the same answer as a reader of the Review queue's.
  clipboard.written.length = 0;
  clipboard.fail = null;
  const { root, said } = await draw({ argv: ['mycontext', 'whatever'], id: null });
  assert.deepEqual(buttonLabels(root), [COPY]);
  await click(findButton(root, COPY));
  assert.deepEqual(said, [{ text: 'Copied to the clipboard.', urgent: false }]);
});

test('a blocked copy is refused at the button, and Execute is still offered', async () => {
  const { root } = await draw({
    argv: ['mycontext', 'add', 'rule', 'the $(echo X) way'], id: 'add', copyBlocked: true,
    values: { category: 'rule', title: 'the $(echo X) way' },
  });
  assert.equal(findButton(root, COPY).disabled, true,
    'a blocked command must not be one click from a clipboard — pal.block says why in the same breath');
  // And Execute is NOT blocked by the same measurement, which is the whole
  // asymmetry: a paste reaches a SHELL, where $(…) substitutes; an execution
  // reaches execFile with an argv array, where it is an ordinary literal.
  assert.equal(findButton(root, EXEC).disabled, false);
});

/* -------------------------------------------------------------------------- *
 * The catalogue is the whole of what may run.
 * -------------------------------------------------------------------------- */

test('an entry with NO catalogue id gets Copy alone — nothing outside the catalogue runs', async () => {
  const { root } = await draw({ argv: ['mycontext', 'whatever'], id: null });
  assert.deepEqual(buttonLabels(root), [COPY]);
  assert.equal(findButtonMaybe(root, EXEC), null,
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
  await click(findButton(root, EXEC));

  const confirm = findOne(root, 'div.confirm');
  assert.equal(confirm.hidden, false, 'the confirm must be rendered, not merely built');
  assert.match(textOf(confirm), /mycontext doctor/,
    'the confirm names the resolved command; the string a person reads and the argv that runs '
    + 'are the same thing, which is the one property the whole route exists to keep');
  assert.deepEqual(posts(calls), [],
    'a POST on the first click would make the confirm a receipt rather than a gate');
});

/**
 * **THE SECONDS BETWEEN THE PRESS AND THE CONFIRM — 2026-09-01.**
 *
 * The confirm GET is a dry run, not a lookup: it copies the corpus and runs the
 * command against the copy (`src/ui/execute-effect.ts`), measured at 5.1–7.3s
 * on `.demo-corpus`. Nothing in this file could see that, because every other
 * wiring here answers in the same microtask — so the control spent those
 * seconds unchanged, and `e2e/execute.spec.ts:256` went red reporting the
 * control's entire visible state as `"CopyExecute"`: a request in flight and a
 * broken button look exactly alike.
 *
 * Two properties, and the second is the one with teeth. Execute stayed LIVE for
 * the whole wait, so a second press started a second full-corpus dry run and
 * minted a second nonce on the route this file calls the security boundary.
 */
test('while the confirm is in flight the control SAYS SO, and Execute is disarmed', async () => {
  let release = (): void => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' },
    { confirm: DOCTOR_CONFIRM, confirmGate: gate },
  );
  const en = (await browserModule<{ strings: Record<string, string> }>('strings', 'en.js')).strings;
  const exec = findButton(root, EXEC);

  // Pressed and NOT awaited — the whole point is the state part-way through.
  const inFlight = press(exec);
  await Promise.resolve();

  const waiting = findOne(root, 'div.execresult');
  assert.equal(waiting.hidden, false,
    'a reader who pressed Execute must be told the wait exists; five seconds of an unchanged '
    + 'control is indistinguishable from a control that did nothing');
  assert.equal(textOf(waiting).trim(), en['exec.checking']!.trim(),
    'the waiting sentence is the string table\'s, not one spelled in the module');
  assert.equal(exec.disabled, true,
    'Execute must be disarmed while its own request is in flight: a second press is a second '
    + 'dry run and a SECOND NONCE minted on the approval boundary');
  assert.equal(calls.length, 1, 'exactly one confirm GET has been made');

  release();
  await inFlight;

  assert.equal(exec.disabled, false, 'the button must come back — the wait ended');
  assert.equal(findOne(root, 'div.execresult').hidden, true,
    'the waiting sentence is CLEARED by the answer; left standing above the confirm it would '
    + 'still be claiming to be checking');
  assert.equal(findOne(root, 'div.confirm').hidden, false, 'and the confirm it waited for is up');
});

test('a refused confirm replaces the waiting sentence and re-arms Execute', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'nope'], id: 'nope' }, { confirm: null },
  );
  const exec = findButton(root, EXEC);
  await click(exec);

  const shown = textOf(findOne(root, 'div.execresult'));
  assert.match(shown, /is in the catalogue/, 'the server\'s refusal, in its own words');
  assert.ok(!shown.includes('takes a few seconds'),
    'the reason REPLACES the waiting sentence rather than stacking under it');
  assert.equal(exec.disabled, false,
    'a refusal is a state to leave: a control that stays dead until the screen is redrawn '
    + 'turns one refused command into a dead screen');
});

test('the confirm SHOWS THE SERVER\'S argv, not the string the client composed', async () => {
  // The client's argv and the server's disagree here on purpose. The server
  // rebuilds from its own catalogue (§3.1) and the nonce is bound to THAT; a
  // confirm rendering the client's version would show one command and run
  // another, which is the exact defect the confirm exists to prevent.
  const { root } = await draw(
    { argv: ['mycontext', 'doctor', '--stale'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
  const shown = textOf(findOne(root, 'div.confirm'));
  assert.match(shown, /mycontext doctor/);
  assert.ok(!shown.includes('--stale'), 'the confirm must show what the SERVER resolved');
});

/**
 * MOVED from `'the confirm carries the residual VERBATIM, in the words §6.3
 * chose'`, which pinned `EXECUTION_RESIDUAL` back when that was one string
 * shared by every reader. Task 8b made it one sentence per language, spelled
 * once in `src/ui/execute.ts` and never duplicated into a string table — so
 * this control still renders `answer.residual` exactly as the server sent it
 * (that half of the old test is unchanged below, still pinned to `.en` byte
 * for byte), and the language it ASKS for is a new, separate property, tested
 * just after this one rather than folded into it: this test is "the control
 * renders what it is given" and the next is "the control asks in the reader's
 * own language", and conflating them would make a failure in either look like
 * a failure in both.
 */
test('the confirm carries the residual VERBATIM, in the words §6.3 chose', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
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
  assert.ok(shown.includes(EXECUTION_RESIDUAL.en),
    'the residual is spelled once per language, on the server, and rendered as it arrived');
});

test('a Hebrew residual is rendered VERBATIM too — this control does not retranslate what the server sent', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' },
    { confirm: { ...DOCTOR_CONFIRM, residual: EXECUTION_RESIDUAL.he }, lang: 'he' },
  );
  await click(findButton(root, EXEC));
  const shown = textOf(findOne(root, 'div.confirm'));
  assert.ok(shown.includes(EXECUTION_RESIDUAL.he),
    'the control has no opinion about language — it prints `answer.residual` exactly, whichever '
    + 'sentence the server chose to send');
});

/**
 * **The language reaches the SERVER; the sentence never reaches the browser.**
 * This is the client half of Task 8b's requirement — the confirm GET must
 * carry the reader's language so the server can answer with the matching
 * residual, and this control is the only place in the browser that knows to
 * ask. Nothing here checks what the SERVER does with `lang=he` — that is
 * `test/ui/execute-route.test.ts`'s job, over real HTTP; this only checks that
 * the request this control sends carries it.
 */
test('the confirm request carries the reader\'s language as ?lang=', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM, lang: 'he' },
  );
  await click(findButton(root, EXEC));
  const confirmCall = calls.find((c) => c.path.startsWith('/api/execute/confirm'));
  assert.ok(confirmCall !== undefined, 'the click must have asked the confirm route something');
  assert.match(confirmCall!.path, /[?&]lang=he(&|$)/,
    'the language reaches the SERVER — this is the query string it reads it off of '
    + '(CONFIRM_LANG_ARG, mirrored by name in src/ui/execute.ts and this file)');
});

test('the confirm request omits ?lang= when the page has none — never sends the literal string "undefined"', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
  const confirmCall = calls.find((c) => c.path.startsWith('/api/execute/confirm'));
  assert.ok(confirmCall !== undefined, 'the click must have asked the confirm route something');
  assert.ok(!confirmCall!.path.includes('lang='),
    'a page with no language must not send one the server would have to guess belongs to a '
    + 'real, unsupported locale rather than to "nobody said"');
});

test('the confirm announces what it is, and can be reached and left from the keyboard', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));

  // **The property is unchanged and the mechanism moved.** "Before" is still
  // what is in force in the corpus — but it is now read by the SERVER, which
  // dry-runs the command against a copy and reports both columns. So the
  // browser must make NO item read of its own: a second read would be a second
  // answer about the same item, and the two can disagree.
  assert.deepEqual(calls.map((c) => c.path).filter((path) => path.startsWith('/api/item/')),
    [],
    'the browser no longer reads the item: "before" arrives with the confirm, derived from '
    + 'the corpus the command will actually touch');
  const diff = findOne(root, 'table.diff');
  assert.match(textOf(diff), /false/,
    'and it is RENDERED — the server said "before: [false]" and that is what the column shows');
});

test('an item the corpus does not have leaves the BEFORE column empty rather than inventing one', async () => {
  const { root } = await draw(
    { argv: ['mycontext', 'pin', 'RULE-gone'], id: 'pin', values: { id: 'RULE-gone' } },
    {
      // `before: null` is the server saying the item does not exist — a fact it
      // establishes by running the command, not a guess the browser makes from
      // a failed read of its own. That distinction is the point of this test:
      // "I could not fetch it" and "there is nothing there" are different, and
      // only the second may empty the column.
      confirm: {
        ...PIN_CONFIRM,
        argv: ['pin', 'RULE-gone'],
        effect: [{
          id: 'RULE-gone',
          kind: 'created',
          fields: [{ field: 'always', before: null, after: ['true'] }],
        }],
      },
      items: {},
    },
  );
  await click(findButton(root, EXEC));
  const diff = findOne(root, 'table.diff');
  assert.match(textOf(diff), /always/, 'the field is still named');
  assert.ok(renderedKinds(diff).includes('ins'), 'and so is what would be written');
  assert.ok(!renderedKinds(diff).includes('del'),
    'there is nothing to strike through, and a fabricated "false" would be a claim about an '
    + 'item this browser could not read');
});

test('a BOUNDARY command that changes nothing SAYS so — a blank is not an answer', async () => {
  // Owner-reported 2026-08-28 from the Doctor screen. `repair` on a clean corpus
  // derives an effect of zero items, and the confirm drew the residual, the
  // command, and nothing else — correct, and identical on screen to "we could
  // not show you what it changes".
  //
  // The blank IS trustworthy: a derivation that cannot answer throws, which is a
  // 400 from the confirm GET, so a rendered confirm means the command ran
  // against a copy and touched nothing. The reader cannot know that by looking.
  //
  // This case had NO test at all, which is why it shipped: every other boundary
  // test here drives a populated `effect`.
  const { root } = await draw(
    { argv: ['mycontext', 'repair'], id: 'repair', values: {} },
    {
      confirm: {
        id: 'repair', argv: ['repair'], boundary: true,
        nonce: 'c'.repeat(32), residual: EXECUTION_RESIDUAL.en,
        effect: [],
      },
    },
  );
  await click(findButton(root, EXEC));
  const confirm = findOne(root, 'div.confirm');

  assert.equal(findMaybe(confirm, 'table.diff'), null,
    'there is nothing to tabulate: no item changed');
  assert.notEqual(findMaybe(confirm, 'p.effect-none'), null,
    'but the confirm must SAY that no item changed. Silence here reads exactly like the '
    + 'derivation having failed, and those are different facts.');
  assert.match(textOf(confirm), /changes nothing/i);

  // The retired sentence must not come back with it: it said the command "does
  // not run", which is the opposite claim and is now false.
  assert.doesNotMatch(textOf(confirm), /not offered here|own shell/i,
    'exec.noeffect was retired in seq:5b and says the opposite of what is true here');

  // And it is still a write behind a real confirm — the sentence explains the
  // empty table, it does not downgrade the gate.
  assert.notEqual(findButtonMaybe(confirm, 'Run it'), null,
    'a command that changes nothing today is still a write, and still runs behind the confirm');
});

test('a command BELOW the boundary gets the plain confirm and NO diff', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
  const confirm = findOne(root, 'div.confirm');

  assert.equal(findMaybe(confirm, 'table.diff'), null,
    'a read gets a plain confirm naming the command and its resolved argv; a diff of nothing '
    + 'would be ceremony that teaches the reader to click past the one that matters');
  assert.match(textOf(confirm), /mycontext doctor/);
  assert.deepEqual(calls.filter((c) => c.path.startsWith('/api/item/')), [],
    'no item is read for a command that changes no item');
});

test('a boundary command whose effect CANNOT be derived does not run — §3.2, in those words', async () => {
  // Spec §3.2: "A command whose effect cannot be shown that way does not get a
  // weaker confirm — it does not run."
  //
  // **Where that is enforced changed with seq:5b, and it moved EARLIER.** It
  // used to be here: the browser looked the command up in a transcribed table,
  // found nothing, and declined — after the GET had already minted a nonce. The
  // server now derives the effect by running the command against a copy, and
  // refuses the confirm itself when it cannot, WITHOUT minting. So the client's
  // job is no longer to decide; it is to show the reason and run nothing.
  const { root, calls } = await draw(
    { argv: ['mycontext', 'refresh', 'RULE-x'], id: 'refresh', values: { id: 'RULE-x' } },
    { confirmError: 'my_context: RULE-x is not a file snapshot and cannot be refreshed.' },
  );
  await click(findButton(root, EXEC));

  assert.equal(findOne(root, 'div.confirm').hidden, true, 'no weaker confirm is offered');
  assert.deepEqual(posts(calls), [], 'and nothing runs');
  assert.match(textOf(root), /cannot be refreshed/,
    "the reader is given the CLI's own sentence about why, not a generic refusal composed here");
});

/* -------------------------------------------------------------------------- *
 * The run, and the state a refusal leaves.
 * -------------------------------------------------------------------------- */

test('answering the confirm POSTs the id, the values and the nonce — and never an argv', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'doctor'], id: 'doctor' }, { confirm: DOCTOR_CONFIRM },
  );
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
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
  await click(findButton(root, EXEC));
  await click(findOne(root, 'button.go'));
  assert.match(textOf(findOne(root, 'div.execresult')), /could not be written/,
    'an execute row with no execute-done beside it MEANS a run that never returned; a swallowed '
    + 'note would leave the log making a specific and false statement');
});

test('a confirm the server refuses is shown, and nothing runs', async () => {
  const { root, calls } = await draw(
    { argv: ['mycontext', 'nope'], id: 'nope' }, { confirm: null },
  );
  await click(findButton(root, EXEC));
  assert.match(textOf(root), /is in the catalogue/, 'the server\'s refusal, in its own words');
  assert.deepEqual(posts(calls), []);
});

/* -------------------------------------------------------------------------- *
 * The claims this module makes about the CLI, held against the CLI.
 * -------------------------------------------------------------------------- */

test('the browser declares no command effects at all — the derivation belongs to the server', async () => {
  // **RETIRED, WITH THE REASONING INVERTED — plan:execute seq:5b.**
  //
  // Two tests stood here. They held a browser-side `COMMAND_EFFECTS` table
  // honest against the CLI's own `NAMED_ENTRY_POINTS`, entry by entry, because
  // the browser could not import that table — there is no build step — so it
  // was transcribed, and a transcription needs a gate.
  //
  // The table is gone. It could only ever describe an effect derivable from a
  // command's ARGUMENTS, which is why it covered five commands and left nine
  // refused, and why it could never have covered `repair` (re-stamps however
  // many items are stale) or `supersede` (touches two items, recording the
  // relation on both sides). `src/ui/execute-effect.ts` now derives the effect
  // by running the command against a throwaway copy of the corpus.
  //
  // So the property those tests protected — "the browser's idea of what a
  // command writes agrees with the CLI's" — is not weakened here. It is
  // VACUOUS: the browser no longer has an idea. What replaces it is the
  // condition that keeps it vacuous, because a fast-path table reintroduced
  // beside the derivation would be a second spelling again, and the one that
  // went stale would be the one guarding the confirm.
  const mod = await browserModule<Record<string, unknown>>('lib', 'command-actions.js');
  assert.equal(mod['COMMAND_EFFECTS'], undefined,
    'the browser must not carry a table of what each command writes: it cannot derive one, so '
    + 'any such table is a transcription, and this one guarded the confirm');

  // A DECLARATION, not a mention. The comment that replaced the table names it,
  // deliberately, so the next reader learns what was removed and why — and a
  // scan for the bare word would be defeated by that comment. This file's own
  // header already records the lesson: "a scanner defeated by a file that names
  // what the scanner looks for is the mistake `faint-usage.test.ts` records
  // making on its own first run."
  assert.doesNotMatch(SOURCE, /(?:const|let|var)\s+COMMAND_EFFECTS\b/,
    'and no second spelling of it is DECLARED in the source, under that name');
  assert.doesNotMatch(SOURCE, /new Map\(\[/,
    'nor under another: a table of commands built here at all is the shape that went stale');
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
