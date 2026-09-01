/**
 * **The item pane belongs to the screen that opened it.**
 *
 * The owner reported it on 2026-08-27: *"there are many screens that it should
 * not appear but currently it does"*. The cause was one missing line, and it
 * was measured rather than guessed:
 *
 *     grep -c closePane src/ui/public/app.js   ->  3   (declaration, the
 *                                                       close handler, Escape)
 *     route() calls closePane                  ->  false
 *
 * `installItemPane()` delegates from the DOCUMENT, so a click on any
 * `[data-id]` anywhere opens the pane, and `pane-open` is a class on `.app` —
 * which outlives every screen. Twelve of the twenty-two screens emit no
 * `[data-id]` at all and can only INHERIT it, and they inherit the
 * three-column grid with it, so their body is squeezed to make room for a
 * panel about an item the user has navigated away from.
 *
 * The rule this file writes down: **a route change CLOSES the pane.** Not
 * hides it — closes it, so the grid returns to two columns and no state
 * carries over.
 *
 * ── WHY THIS FILE EXISTS AT ALL, GIVEN SPEC §6 ────────────────────────────
 *
 * Spec §6 puts the DOM glue in `app.js` and `screens/*.js` outside the tested
 * surface, and `test/ui/viewmodel.test.ts` says why: testing it would need a
 * browser dependency this project does not have. Every other file in
 * `test/ui/` honours that by testing what was pulled OUT of the glue —
 * `lib/viewmodel.js`, `lib/i18n.js`, `lib/bootstrap.js` — or by scanning the
 * render path's source.
 *
 * Neither answer reaches this defect. The bug is not in a pure function; it is
 * in the ORDER of two glue calls, and the only honest statement of it is
 * "open a pane on one screen, navigate, and look". A source scan asserting
 * `route()` contains the text `closePane()` would go green against a call
 * placed after the section is built, after an early `return`, or inside a
 * comment — three ways to be wrong that the reader of a scan cannot tell apart
 * from being right.
 *
 * So the shell IS driven here, and the stand-in is grown from
 * `test/ui/gaps-screen.test.ts`' — the same `element()` factory shape, the same
 * "install the global, because the module reaches for it" reasoning. What that
 * file's document could not do is the part `app.js` needs and a screen does
 * not: `getElementById`, selector queries, a parent chain for `closest()`, and
 * document-level listeners. Those four are the whole of the addition, and they
 * are the minimum that lets a click and a hash change be real events rather
 * than direct calls to the functions under test.
 *
 * **Three things keep this from being a harness that proves itself.** The
 * shipped `index.html` is what seeds the shell's elements, so a renamed
 * `#pane` fails here rather than being quietly re-invented. The screen modules
 * are stubbed but the ROUTER is not, so every assertion below runs through the
 * real `route()`. And the first test asserts the pane genuinely FILLS on a
 * click — without it, an `openItem()` that silently did nothing would make
 * every "the pane is closed" assertion below pass for the wrong reason.
 *
 * Verified by mutation: with the `closePane()` call removed from the top of
 * `route()`, three of the five tests below go red — every one that navigates,
 * and only those. The other two (the pane opens; a second click on the same
 * screen re-targets it) stay green, which is the answer they are for: this
 * closes on NAVIGATION, not on clicks, and the mutation says so as clearly as
 * the fix does.
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
 * The browser's own resolution, taught to Node — `test/ui/gaps-screen.test.ts`'
 * hook, widened by one directory (`/strings/`, which no screen imports and the
 * shell does).
 *
 * A ROOT-absolute specifier is what the browser resolves against the server's
 * document root; Node resolves it against the drive root, and on this machine
 * that is `D:\screens\parts.js` — the failure this hook exists to prevent, and
 * the one that proves the graph being imported is the shipped one rather than
 * a reconstruction of it. The hook covers the whole TRANSITIVE graph, which a
 * rewrite of `app.js`' own bytes cannot: `screens/docs.js` imports
 * `/screens/parts.js` in exactly the same form.
 */
let resolvedBrowserSpecifiers = 0;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\/(lib|screens|strings)\//.test(specifier)) {
      resolvedBrowserSpecifiers += 1;
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/* ══ THE STAND-IN DOCUMENT ═════════════════════════════════════════════════
 *
 * `test/ui/gaps-screen.test.ts`' factory, with four additions `app.js` needs
 * and a screen module does not. Deliberately no more than four: a fuller fake
 * invites assertions this file has no business making, and every method here
 * is one `app.js`, `lib/i18n.js` or `screens/docs.js` actually calls.
 */

/** A stand-in node. Text is an element with the tag `#text` and no children. */
interface FakeElement {
  tag: string;
  id: string;
  className: string;
  textContent: string;
  title: string;
  type: string;
  hidden: boolean;
  onclick: (() => void) | null;
  parent: FakeElement | null;
  children: FakeElement[];
  dataset: Record<string, string>;
  attributes: Record<string, string>;
  listeners: Record<string, ((event: FakeEvent) => void)[]>;
  classList: {
    add: (name: string) => void;
    remove: (name: string) => void;
    contains: (name: string) => boolean;
  };
  style: {
    declarations: Record<string, string>;
    setProperty: (n: string, v: string) => void;
    getPropertyValue: (n: string) => string;
  };
  append: (...nodes: (FakeElement | string)[]) => void;
  replaceChildren: (...nodes: (FakeElement | string)[]) => void;
  remove: () => void;
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (type: string, listener: (event: FakeEvent) => void) => void;
  querySelector: (selector: string) => FakeElement | null;
  querySelectorAll: (selector: string) => FakeElement[];
  closest: (selector: string) => FakeElement | null;
}

/**
 * What a listener is handed. `app.js` reads `target` and `key`; the two
 * pointer fields are what `lib/pane-resize.js` reads off a drag, added with the
 * width assertion at the foot of this file. `preventDefault` is deliberately
 * absent — both modules call it as `event.preventDefault?.()`, so its absence
 * is exercised here rather than papered over.
 */
interface FakeEvent {
  target: FakeElement;
  key?: string;
  clientX?: number;
  pointerId?: number;
}

function element(tag: string): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    tag,
    id: '',
    className: '',
    textContent: '',
    title: '',
    type: '',
    hidden: false,
    onclick: null,
    parent: null,
    children: [],
    dataset: {},
    attributes: {},
    listeners: {},
    classList: {
      // Backed by `className` rather than by a set of its own: `app.js` writes
      // both — `button.className = 'nav'` and `app.classList.add('pane-open')`
      // — and two stores would let one of them lie about the other.
      add: (name: string): void => {
        const names = classNames(node);
        if (!names.includes(name)) node.className = [...names, name].join(' ');
      },
      remove: (name: string): void => {
        node.className = classNames(node).filter((n) => n !== name).join(' ');
      },
      contains: (name: string): boolean => classNames(node).includes(name),
    },
    style: {
      declarations,
      setProperty: (name: string, value: string): void => { declarations[name] = value; },
      // Added with the two assertions at the foot of this file: the remembered
      // WIDTH is an inline custom property on `.app`, so reading it back is how
      // "a preference survives a route change" is stated at all.
      getPropertyValue: (name: string): string => declarations[name] ?? '',
    },
    append: (...nodes: (FakeElement | string)[]): void => {
      for (const child of nodes) {
        const el = typeof child === 'string' ? textNode(child) : child;
        el.parent = node;
        node.children.push(el);
      }
    },
    replaceChildren: (...nodes: (FakeElement | string)[]): void => {
      node.children.length = 0;
      node.append(...nodes);
    },
    remove: (): void => {
      const siblings = node.parent?.children;
      if (siblings === undefined) return;
      const at = siblings.indexOf(node);
      if (at !== -1) siblings.splice(at, 1);
      node.parent = null;
    },
    setAttribute: (name: string, value: string): void => { node.attributes[name] = value; },
    getAttribute: (name: string): string | null => attributeOf(node, name),
    addEventListener: (type: string, listener: (event: FakeEvent) => void): void => {
      (node.listeners[type] ??= []).push(listener);
    },
    querySelector: (selector: string): FakeElement | null =>
      descendants(node).find((el) => matches(el, selector)) ?? null,
    querySelectorAll: (selector: string): FakeElement[] =>
      descendants(node).filter((el) => matches(el, selector)),
    closest: (selector: string): FakeElement | null => {
      // Self first, then up — the real contract, and the one that matters:
      // `installItemPane` calls `closest('[data-id]')` on a click that usually
      // lands on `.idkind`/`.idslug` INSIDE the button rather than on it.
      for (let el: FakeElement | null = node; el !== null; el = el.parent) {
        if (matches(el, selector)) return el;
      }
      return null;
    },
  };
  return node;
}

function textNode(text: string): FakeElement {
  const node = element('#text');
  node.textContent = text;
  return node;
}

const classNames = (node: FakeElement): string[] =>
  node.className.trim() === '' ? [] : node.className.trim().split(/\s+/);

/** Every descendant, document order, text nodes excluded. */
function descendants(root: FakeElement): FakeElement[] {
  const out: FakeElement[] = [];
  const walk = (node: FakeElement): void => {
    for (const child of node.children) {
      if (child.tag === '#text') continue;
      out.push(child);
      walk(child);
    }
  };
  walk(root);
  return out;
}

/**
 * One attribute's value. `id` and `class` are read off the PROPERTIES, and
 * `data-*` off `dataset`, because that is where `app.js` writes them —
 * `section.dataset.p = name`, `button.className = 'nav'`. An attribute map
 * consulted alone would answer `null` for every one of them.
 */
function attributeOf(node: FakeElement, name: string): string | null {
  if (name === 'id') return node.id === '' ? null : node.id;
  if (name === 'class') return node.className === '' ? null : node.className;
  if (name.startsWith('data-')) {
    const key = name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (Object.hasOwn(node.dataset, key)) return node.dataset[key] ?? null;
  }
  return node.attributes[name] ?? null;
}

/**
 * A compound selector — tag, `#id`, `.class`, `[attr]`, `[attr="value"]` — and
 * no combinators. That is exactly the vocabulary `app.js` uses
 * (`.nav[data-s="gaps"]`, `[data-p="coverage"]`, `[data-t]`, `#paneclose`,
 * `[data-id]`, `.cnt`), and a descendant combinator this file cannot parse
 * would be a silent `null` rather than a failure, so the parse is asserted
 * below instead of being trusted.
 */
function matches(node: FakeElement, selector: string): boolean {
  const tag = /^[a-z][a-z0-9]*/i.exec(selector);
  if (tag !== null && node.tag !== tag[0]) return false;
  for (const [, id] of selector.matchAll(/#([\w-]+)/g)) if (node.id !== id) return false;
  for (const [, cls] of selector.matchAll(/\.([\w-]+)/g)) {
    if (cls !== undefined && !classNames(node).includes(cls)) return false;
  }
  for (const [, name, value] of selector.matchAll(/\[([\w-]+)(?:="([^"]*)")?\]/g)) {
    const held = attributeOf(node, name ?? '');
    if (held === null) return false;
    if (value !== undefined && held !== value) return false;
  }
  return true;
}

/* ══ THE SHELL, SEEDED FROM THE SHIPPED index.html ═════════════════════════ */

/**
 * Every `id` the shipped shell carries, in document order, with the ones
 * authored `hidden` starting hidden.
 *
 * Read from `index.html` rather than hand-listed, and that is the point: this
 * file asserts things about `#pane` and `#app`, and a rename in the shell that
 * left this list behind would produce a harness testing elements the product
 * no longer has. The elements are seeded FLAT under one `<body>` — the shell's
 * real nesting is not something anything below depends on, and inventing a
 * parser for it would be a second, worse `index.html`.
 */
function shellIds(): { id: string; tag: string; hidden: boolean }[] {
  const html = readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
  const found: { id: string; tag: string; hidden: boolean }[] = [];
  for (const [, tag, attrs] of html.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)) {
    const id = /\bid="([^"]+)"/.exec(attrs ?? '')?.[1];
    if (id === undefined) continue;
    found.push({ id, tag: tag ?? '', hidden: /\bhidden(?=[\s>])|\bhidden$/.test(attrs ?? '') });
  }
  return found;
}

/* ══ app.js, WITH ITS TWENTY-ONE ROUTES STUBBED ════════════════════════════
 *
 * `test/ui/coverage-screen.test.ts`' pattern — "the module's own bytes are
 * read, [its specifiers are rewritten], and the result is imported as a `data:`
 * module. The rewrite is COUNTED and the result re-checked, because a rewrite
 * that silently missed one would import a different module graph than the
 * browser runs."
 *
 * Here the rewrite is ONE thing only: the twenty-one DYNAMIC screen imports
 * inside `SCREENS` are pointed at a stub. Not to make the harness lighter —
 * because a screen's `render()` would draw a whole screen against this
 * stand-in and turn a failure about NAVIGATION into a failure about a table.
 * The router, the pane and the document delegation are the real code; what a
 * screen paints is another file's test. Everything else `app.js` imports is
 * the shipped module, resolved by the hook above.
 *
 * `/screens/docs.js` is deliberately NOT stubbed where `app.js` imports it
 * STATICALLY: that import is `markdownNodes`, which the pane runs on an item
 * body, and stubbing it would hollow out the very thing the first test looks
 * at. The two are told apart by form — `import('…')` is a route, `from '…'` is
 * a dependency — which is the whole reason this replacement is anchored to the
 * call form.
 */

/** A screen module that records that the router reached it, and draws nothing. */
const stubScreen = (name: string): string => 'data:text/javascript,' + encodeURIComponent(
  'export async function render() {'
  + ` globalThis.__paneRoute.rendered.push(${JSON.stringify(name)}); }`,
);

function rewrittenAppJs(): string {
  const source = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

  let routes = 0;
  const rewritten = source.replace(/import\('\/screens\/([a-z]+)\.js'\)/g, (_, name: string) => {
    routes += 1;
    return `import(${JSON.stringify(stubScreen(name))})`;
  });

  // 21 registered screens, plus the file header's own comment quoting the
  // loader form — `() => import('/screens/x.js')`. That comment is rewritten
  // with them and it changes nothing, which is cheaper than a comment-
  // stripping pass: `app.js` carries regex literals containing `//`
  // (`/^#\//`), and a stripper that mangled one would break the router this
  // file exists to drive.
  assert.ok(routes >= 21, `expected app.js to register 21+ screen routes, rewrote ${routes}`);
  assert.doesNotMatch(rewritten, /import\('\/screens\//,
    'a screen route survived the rewrite — the real screen would render against this stand-in, '
    + 'and a failure about navigation would arrive dressed as a failure about a table');
  return rewritten;
}

/* ══ THE PAGE AROUND IT ════════════════════════════════════════════════════ */

interface Store { getItem: (k: string) => string | null; setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void }

interface FakeLocation { hash: string; pathname: string; port: string; reload: () => void }

/**
 * The port this stand-in server answers on, and the port the marker cookie
 * below names. Any number: what matters is that the two AGREE.
 *
 * `app.js`' `credentialHeld()` (since `plan:walk seq:85`) declines to send a
 * request the gate's answer to is already known — no token in memory, none in
 * `sessionStorage`, and no `mycontext_cred` marker for THIS origin means the
 * page holds nothing and a request would only append a `ui-refused` audit
 * record. This harness's `fetchFake` answers every read as an AUTHENTICATED
 * server does, which is the page it has always been standing in for; before
 * that gate existed the harness could leave the credential implicit, and now
 * it has to say so. Nothing here is about credentials — the claims are the
 * pane and the router — so the state is set once and never varied.
 */
const FAKE_PORT = '4111';

interface Harness {
  /** Set the hash and fire `hashchange`, then wait for the router to land. */
  goTo: (hash: string) => Promise<void>;
  /** Click a `button.linkid[data-id]` on the current screen, as a screen draws one. */
  openItem: (id: string) => Promise<void>;
  /** Click one of the shell's own controls, through the document delegation. */
  click: (id: string) => Promise<void>;
  /** A whole pointer gesture on `#panegrip`. Negative `dx` is inline-start. */
  drag: (dx: number) => void;
  app: () => FakeElement;
  pane: () => FakeElement;
  paneId: () => string;
  paneBody: () => FakeElement;
  /** Any element of the shell, by id — for the pane's summary block. */
  el: (id: string) => FakeElement;
}

/**
 * The four summary shapes, keyed by the id a test opens — everything else about
 * the payload is the same, so a test names one id and gets exactly one variable.
 *
 * `SUM-none` is the case that must render as ABSENT: `summary` is optional on
 * `Item`, and the sixteen superseded and deprecated items in this project's own
 * corpus carry none. `SUM-stale` and `SUM-unanch` are the two states in which
 * the sentence is still SERVED and must not be read as current.
 */
const SUMMARY_CASES: Record<string, { summary: string | null; summaryState: string }> = {
  'SUM-none': { summary: null, summaryState: 'absent' },
  'SUM-current': { summary: 'A plain sentence saying what this is.', summaryState: 'current' },
  'SUM-stale': { summary: 'A plain sentence saying what this WAS.', summaryState: 'stale' },
  'SUM-unanch': { summary: 'A sentence with no basis behind it.', summaryState: 'unanchored' },
};

/** The item every test opens. One shape, answered for whatever id is asked. */
const itemPayload = (id: string): unknown => ({
  item: {
    id,
    title: `${id} title`,
    type: 'rule',
    status: 'active',
    severity: 'high',
    scope: ['src/'],
    filePath: `items/rule/${id}.md`,
    body: 'A body long enough to be a paragraph.',
    always: id === 'SUM-current',
    continuity: false,
    origin: 'human',
    validUntil: null,
    extra: id === 'SUM-current' ? { directive: 'do' } : {},
    ...(SUMMARY_CASES[id] === undefined ? {} : { summary: SUMMARY_CASES[id]!.summary }),
  },
  injection: { phrase: 'governs every session' },
  ...(SUMMARY_CASES[id] === undefined
    ? {}
    : { summaryState: SUMMARY_CASES[id]!.summaryState }),
});

/** `null` history: the ABSENT projection, which the pane says rather than draws. */
const historyPayload = (): unknown => ({ weeks: null });

function respond(body: unknown): Response {
  return { ok: true, status: 200, json: async (): Promise<unknown> => body } as unknown as Response;
}

/**
 * The whole shell, booted once.
 *
 * ONCE, not per test: `app.js` runs `main()` at module scope and a `data:`
 * module with the same bytes is cached, so a second `import()` would return
 * the first module without re-running anything — a per-test boot would be a
 * lie that looked like isolation. Every test starts with its own `goTo()`
 * instead, which is the same thing a reader does with a tab.
 */
let booted: Promise<Harness> | null = null;

const tick = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

async function boot(): Promise<Harness> {
  booted ??= (async (): Promise<Harness> => {
    const rendered: string[] = [];
    const hashListeners: (() => void)[] = [];
    const docListeners: Record<string, ((event: FakeEvent) => void)[]> = {};

    const root = element('html');
    const body = element('body');
    root.append(body);
    const seeded = shellIds();
    assert.ok(seeded.some((e) => e.id === 'pane' && e.hidden),
      'the shipped index.html no longer carries a `hidden` #pane — this harness is seeded from '
      + 'it, so the shell it stands in for has moved and every assertion below is about nothing');
    for (const { id, tag, hidden } of seeded) {
      const el = element(tag);
      el.id = id;
      el.hidden = hidden;
      body.append(el);
    }

    const document = {
      documentElement: root,
      visibilityState: 'visible',
      createElement: element,
      createTextNode: textNode,
      getElementById: (id: string): FakeElement | null =>
        descendants(root).find((el) => el.id === id) ?? null,
      querySelector: (selector: string): FakeElement | null => root.querySelector(selector),
      querySelectorAll: (selector: string): FakeElement[] => root.querySelectorAll(selector),
      addEventListener: (type: string, listener: (event: FakeEvent) => void): void => {
        (docListeners[type] ??= []).push(listener);
      },
      // The handoff's script-readable marker (`security.ts`'s
      // `CREDENTIAL_COOKIE`), naming the port above. The token cookie beside it
      // in a real browser is `HttpOnly` and would not appear here even if this
      // were a real document — which is exactly why the marker exists.
      cookie: `mycontext_cred=${FAKE_PORT}`,
    };

    const location: FakeLocation =
      { hash: '', pathname: '/', port: FAKE_PORT, reload: (): void => {} };
    const storage = (): Store => ({
      getItem: (): string | null => null,
      setItem: (): void => {},
      removeItem: (): void => {},
    });

    const fetchFake = async (target: string): Promise<Response> => {
      const item = /^\/api\/item\/([^/]+)$/.exec(target);
      if (item !== null) return respond(itemPayload(decodeURIComponent(item[1] ?? '')));
      if (/^\/api\/item\/[^/]+\/history$/.test(target)) return respond(historyPayload());
      if (target === '/api/sessions') return respond({ sessions: [], default: null });
      if (target === '/api/meta') return respond({ git: null });
      if (target === '/api/status') {
        return respond({
          health: { errors: 0, warnings: 0 },
          pendingRevisions: { revisions: 0 },
          items: { total: 3 },
        });
      }
      if (target === '/api/coverage') return respond({ files: [] });
      // Never silently 200: an endpoint this harness forgot must look like a
      // refusal the shell handles, not like data it can believe.
      //
      // `plan:live seq:3`: `route()` now subscribes every routed screen to
      // the shared live stream (`/api/watch/stream`) on its behalf, so this
      // file's own navigation reaches this fallback for a real request for
      // the first time. `refusalDetail()` (`app.js`) reads `response.text()`
      // on ANY non-ok response, so the fallback needs one to actually BE "a
      // refusal the shell handles", not a shape only `.json()` ever exercised.
      return {
        ok: false, status: 404,
        json: async (): Promise<unknown> => ({}),
        text: async (): Promise<string> => '',
      } as unknown as Response;
    };

    /**
     * The globals, installed and LEFT INSTALLED for the file.
     *
     * The screen stand-ins remove theirs after each call, so a later test in
     * the same process does not think it is in a browser. That is not
     * available here: `app.js`' `main()` and its two document listeners ARE
     * the thing under test and they live for as long as the module does.
     * `node --test` runs each FILE in its own process, which is the isolation
     * this file gets instead — the same fact `test/ui/execute-route.test.ts`
     * depends on for its route table.
     */
    const define = (name: string, value: unknown): void => {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    };
    define('document', document);
    define('location', location);
    define('history', { replaceState: (): void => {} });
    define('navigator', { language: 'en' });
    define('localStorage', storage());
    define('sessionStorage', storage());
    define('fetch', fetchFake);
    define('window', {
      addEventListener: (type: string, listener: () => void): void => {
        if (type === 'hashchange') hashListeners.push(listener);
      },
    });
    // The heartbeat is a 60s `setInterval` the shell never stops on its own,
    // and a live timer keeps the runner's process alive after the last
    // assertion. Unref'd rather than stubbed out: the real call still runs, so
    // an ordering change in `main()` that moved it would still be exercised.
    const realSetInterval = globalThis.setInterval;
    define('setInterval', (fn: () => void, ms: number): unknown => {
      const timer = realSetInterval(fn, ms);
      timer.unref();
      return timer;
    });
    (globalThis as unknown as { __paneRoute: { rendered: string[] } }).__paneRoute = { rendered };

    await import('data:text/javascript,' + encodeURIComponent(rewrittenAppJs()));
    assert.ok(resolvedBrowserSpecifiers >= 5,
      `the shell imported ${resolvedBrowserSpecifiers} browser modules through the hook — `
      + 'if that is zero the graph resolved some other way and this is not the shipped shell');

    /** Wait for the router to finish one navigation, or say that it never did. */
    const settle = async (was: number, what: string): Promise<void> => {
      for (let turn = 0; turn < 200 && rendered.length === was; turn += 1) await tick();
      assert.notEqual(rendered.length, was, `route() never rendered a screen for ${what}`);
      // The router has returned; the pane's own two requests are behind it.
      for (let turn = 0; turn < 10; turn += 1) await tick();
    };

    await settle(0, 'the boot');

    const byId = (id: string): FakeElement => {
      const el = document.getElementById(id);
      assert.notEqual(el, null, `the shell has no #${id}`);
      return el as FakeElement;
    };

    const fire = (type: string, event: FakeEvent): void => {
      for (const listener of docListeners[type] ?? []) listener(event);
    };

    return {
      goTo: async (hash: string): Promise<void> => {
        const was = rendered.length;
        location.hash = hash;
        // Through the listener `installNonceRedemption()` registered, not by
        // calling `route()`: the hashchange path is the only way a screen
        // change reaches the router in the browser, and it is where the fix
        // has to hold.
        for (const listener of hashListeners) listener();
        await settle(was, hash);
      },
      openItem: async (id: string): Promise<void> => {
        // Built the way `screens/parts.js`' linkId() builds one, and appended
        // to the live screen, so the click is delegated from the document
        // exactly as a real one is.
        const link = element('button');
        link.className = 'linkid';
        link.dataset.id = id;
        const slug = element('span');
        slug.className = 'idslug';
        link.append(slug);
        byId('screen').querySelectorAll('[data-p]').filter((s) => !s.hidden)[0]?.append(link);
        // The click lands on the INNER span, as a real one almost always does.
        fire('click', { target: slug });
        for (let turn = 0; turn < 20; turn += 1) await tick();
      },
      click: async (id: string): Promise<void> => {
        fire('click', { target: byId(id) });
        for (let turn = 0; turn < 5; turn += 1) await tick();
      },
      drag: (dx: number): void => {
        // Straight at the handle's OWN listeners, because that is where
        // `lib/pane-resize.js` binds them — the whole point of
        // `setPointerCapture` is that these never go near the document.
        const handle = byId('panegrip');
        const at = 900;
        const send = (type: string, clientX: number): void => {
          for (const listener of handle.listeners[type] ?? []) {
            listener({ target: handle, pointerId: 7, clientX });
          }
        };
        send('pointerdown', at);
        send('pointermove', at + dx);
        send('pointerup', at + dx);
      },
      app: (): FakeElement => byId('app'),
      pane: (): FakeElement => byId('pane'),
      paneId: (): string => byId('paneid').textContent,
      paneBody: (): FakeElement => byId('panebody'),
      el: (id: string): FakeElement => byId(id),
    };
  })();
  return await booted;
}

/* ══ THE TESTS ═════════════════════════════════════════════════════════════ */

/**
 * The anti-vacuum test, and it runs first for that reason.
 *
 * Everything below asserts that a pane is CLOSED. All of it would pass against
 * a harness whose click did nothing at all — which is the one way this file
 * could be green and worthless. So the opening gesture is proved once, here.
 */
test('the harness really opens the pane: a delegated click fills it and widens the grid', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');

  assert.equal(ui.pane().hidden, false);
  assert.ok(ui.app().classList.contains('pane-open'), 'pane-open is what makes the grid three columns');
  assert.equal(ui.paneId(), 'RULE-x');
  assert.equal(ui.paneBody().children.length, 1, 'the item body is rendered into #panebody');
  assert.equal(ui.paneBody().children[0]?.tag, 'bdi', 'corpus text sits inside <bdi> — pane.well');
});

/**
 * The text of a node and everything under it.
 *
 * `FakeElement.textContent` is a plain FIELD, so it holds only what was
 * assigned directly — and every translated string in the shell arrives as
 * appended NODES, never as an assigned string (owner ruling A1: `t()` returns
 * Node[] for every key, because a string cannot carry the `.m` isolation an
 * identifier needs). Reading the field alone therefore reports `''` for exactly
 * the sentences these tests are about.
 */
function textOf(node: FakeElement): string {
  return node.children.length === 0
    ? node.textContent
    : node.children.map(textOf).join('');
}

/* ── THE SUMMARY, `plan:walk seq:119` phase 3 ──────────────────────────────
 *
 * Every active item in this corpus carries a `summary` — one plain sentence
 * saying what it IS — and until 2026-09-01 no screen in the product drew one.
 * These four tests are the four states that display has to get right, and the
 * middle two are the ones with teeth: a summary the item has outgrown is still
 * shown (nothing here is dropped silently) and must never be shown as current.
 */

test('the pane draws the item summary, and draws it ABOVE the six <dl> facts', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('SUM-current');

  assert.equal(ui.el('panesummary').hidden, false, 'the summary is on screen');
  assert.equal(ui.el('panesummary').textContent, 'A plain sentence saying what this is.');
  assert.equal(ui.el('panesummary').className, 'itemsum',
    'a CURRENT summary carries no staleness class — the rule down its edge would be a lie');
  assert.equal(ui.el('panestale').hidden, true,
    'nothing to disclose, so no empty warning beside a perfectly good summary');

  // Where the block SITS is asserted separately, against the markup — this
  // harness seeds every id flat under one `<body>`, so its child order is the
  // harness's and not the shell's.

  // The chips: `always` and the category's own `directive`. Not the six the
  // `<dl>` already carries eight pixels below — see `fillPaneSummary`.
  const chips = ui.el('paneprops');
  assert.equal(chips.hidden, false);
  assert.deepEqual(chips.children.map((c) => c.className), ['chip gov', 'chip index'],
    'always earns the gov register and the category field the neutral one; no new hue is spent');
  assert.deepEqual(chips.children.map((c) => c.dataset.g), ['◆', '◇'],
    'every chip carries a glyph as well as a word — colour is never the only carrier');
  assert.equal(textOf(chips.children[1]!), 'directive: do',
    'a category field is CORPUS text on both sides, never a key this app invented a label for');
});

/**
 * **The summary block is ABOVE the `<dl>`, in the shipped shell AND in the
 * design of record — asserted on the markup, because that is where the order
 * lives.**
 *
 * The `<dl>`'s six rows (type, status, tier, scope, governs, file) answer *does
 * this apply to me*. The summary answers *what is this*, and the second question
 * is not worth asking until the first has an answer — which is why "above the
 * body" was not enough and the block went above the facts as well.
 *
 * Both files, because presentation changes go into the mockup first: a block
 * moved in one and not the other is how a design of record stops being one.
 */
test('the summary block sits above the <dl>, in index.html and in the mockup alike', () => {
  const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
  for (const [label, file] of [
    ['index.html', path.join(PUBLIC, 'index.html')],
    ['the mockup', MOCKUP],
  ] as const) {
    const html = readFileSync(file, 'utf8');
    const pane = html.indexOf('<aside class="pane" id="pane"');
    assert.notEqual(pane, -1, `${label}: no item pane to place the summary in`);
    const after = (needle: string): number => {
      const at = html.indexOf(needle, pane);
      assert.notEqual(at, -1, `${label}: the pane does not contain ${needle}`);
      return at;
    };
    const title = after('id="panetitle"');
    const summary = after('id="panesummary"');
    const stale = after('id="panestale"');
    const props = after('id="paneprops"');
    // The `<dl>` that OPENS the definition list, not the two words `<dl>` in
    // the comment above the summary block — which is exactly what a bare
    // `indexOf('<dl>')` finds, and it finds it in the wrong place.
    const dl = html.slice(pane).search(/<dl>\s*<dt/) + pane;
    assert.ok(dl > pane, `${label}: the pane has no <dl><dt> to place the summary above`);
    assert.ok(title < summary, `${label}: the title comes first`);
    assert.ok(summary < stale, `${label}: the disclosure sits under the sentence it is about`);
    assert.ok(stale < props, `${label}: then the chips`);
    assert.ok(props < dl, `${label}: and all of it above the six <dl> facts`);
  }
});

test('an item with no summary draws no summary — absent is absent, not an empty line', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('SUM-none');

  assert.equal(ui.el('panesummary').hidden, true, 'no box, no blank line, no dash');
  assert.equal(ui.el('panesummary').textContent, '');
  assert.equal(ui.el('panestale').hidden, true);
  assert.equal(ui.el('paneprops').hidden, true,
    'and no empty chip strip either: this item earns none of the four');
});

test('a STALE summary is shown, and shown as stale — in three carriers, not one', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('SUM-stale');

  assert.equal(ui.el('panesummary').hidden, false,
    'the sentence is still drawn — INV-nothing-is-dropped-silently');
  assert.equal(ui.el('panesummary').textContent, 'A plain sentence saying what this WAS.');
  assert.equal(ui.el('panesummary').className, 'itemsum stale', 'carrier 1: the rule down its edge');
  assert.equal(ui.el('panestale').hidden, false, 'carrier 2: the sentence saying what happened');
  assert.match(textOf(ui.el('panestale')), /changed after/,
    'and it says the item MOVED, which is the fact — not merely that something is wrong');
  const chips = ui.el('paneprops');
  assert.equal(chips.children[0]?.className, 'chip warn',
    'carrier 3: the word, FIRST, because it qualifies every chip after it');
  assert.equal(textOf(chips.children[0]!), 'stale summary');
});

test('a summary with no basis at all reads as unanchored, never as current', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('SUM-unanch');

  // `unanchored` is unreachable through any write path in this product and is
  // reachable by hand-editing a file — which is exactly the case that must not
  // read as current. It is a stale summary with a different reason, and it is
  // told apart from `stale` here so a reader learns which one they have.
  assert.equal(ui.el('panesummary').className, 'itemsum stale');
  assert.equal(textOf(ui.el('paneprops').children[0]!), 'unanchored summary');
  assert.match(textOf(ui.el('panestale')), /no record of what it was written against/);
});

test('navigating away CLOSES the pane, and the grid goes back to two columns', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');
  assert.ok(ui.app().classList.contains('pane-open'));

  await ui.goTo('#/simulate');
  assert.ok(!ui.app().classList.contains('pane-open'),
    'the pane opened on one screen was still open on a screen that cannot open one');
  assert.equal(ui.pane().hidden, true,
    'hidden as well as unclassed: a pane left visible outside the grid is the same defect wearing '
    + 'a different marker');
});

/**
 * The twelve that can only INHERIT a pane.
 *
 * Named rather than counted, deliberately: a screen that gains a `[data-id]`
 * later should make somebody read this list, not slip past a number that still
 * happens to be twelve.
 */
const NO_LINKID = ['simulate', 'config', 'tut', 'gaps', 'graph', 'status',
  'port', 'packs', 'capture', 'palette', 'docs', 'decay'];

test('a screen that emits no [data-id] cannot end up showing a pane at all', async () => {
  const ui = await boot();
  for (const screen of NO_LINKID) {
    await ui.goTo('#/coverage');
    await ui.openItem('RULE-x');
    assert.ok(ui.app().classList.contains('pane-open'), `precondition: open before leaving for ${screen}`);

    await ui.goTo(`#/${screen}`);
    assert.ok(!ui.app().classList.contains('pane-open'), screen);
    assert.equal(ui.pane().hidden, true, screen);
  }
});

test('re-opening on the SAME screen is untouched — this closes on navigation, not on clicks', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');
  await ui.openItem('RULE-y');

  assert.ok(ui.app().classList.contains('pane-open'),
    'a second click on the same screen must not close what the first click opened');
  assert.equal(ui.pane().hidden, false);
  assert.equal(ui.paneId(), 'RULE-y');
});

test('opening it, leaving, and coming back leaves it CLOSED', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');
  await ui.goTo('#/simulate');
  await ui.goTo('#/coverage');

  // Returning to the screen that opened it is not re-opening it. The pane
  // belongs to a CLICK, not to a screen's remembered state — there is nothing
  // to restore and nothing that would know which item to restore.
  assert.ok(!ui.app().classList.contains('pane-open'));
  assert.equal(ui.pane().hidden, true);
});

/* ══ THE PAIR — A MODE IS DISCARDED, A PREFERENCE IS KEPT ══════════════════
 *
 * Parked here on 2026-08-27 as a NAMED GAP, and filled in on the same day by
 * Tasks 2 and 3 (`lib/pane-resize.js`, `#panegrip`, `#panefloat` and the
 * `pane-float` class). The note that stood here is worth keeping in one line
 * because it was right: writing these before the feature existed would have
 * given one vacuous green and one red for the wrong reason —
 * `assert.ok(!contains('pane-float'))` passes against a build that has never
 * heard of floating.
 *
 * **They belong in THIS file and not in those two.** `pane-resize.test.ts` is
 * about a handle and `pane-float.test.ts` is about a button, and neither of
 * them navigates. Navigation is the only place where the difference between a
 * preference and a mode is observable at all, so this is the file that has to
 * state it.
 */

test('the float mode does not survive navigation either', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');
  await ui.click('panefloat');
  assert.ok(ui.app().classList.contains('pane-float'), 'precondition: the pane is floating');

  await ui.goTo('#/simulate');
  assert.ok(!ui.app().classList.contains('pane-float'),
    'a float that outlived the screen that opened it is a fixed, page-covering panel about an '
    + 'item the reader has navigated away from — the reported defect, wearing its worst face');
  assert.ok(!ui.app().classList.contains('pane-open'));
  assert.equal(ui.pane().hidden, true);
});

test('the remembered WIDTH does survive it — a preference is not a mode', async () => {
  const ui = await boot();
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');
  ui.drag(-120);
  assert.equal(ui.app().style.getPropertyValue('--pane-w'), '450px',
    'precondition: the handle actually moved the property');

  await ui.goTo('#/simulate');
  await ui.goTo('#/coverage');
  await ui.openItem('RULE-x');

  // THE POINT OF THE PAIR. The same navigation that threw the float away keeps
  // this, because somebody reading item after item chose a working width once
  // and must not be asked again on every screen. `closePane()` clears the MODE
  // and deliberately does not touch `--pane-w`.
  assert.equal(ui.app().style.getPropertyValue('--pane-w'), '450px');
});
