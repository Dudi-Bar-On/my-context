/**
 * **One button floats the item pane over the page, and Escape steps back.**
 *
 * Task 3 of `docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-
 * can-float.md`, from the owner's own sentence on 2026-08-27: *"add a button on
 * it's top right corner to make it floating popup in order to have a bigger
 * window to look at it because it may include a long text boddy"*.
 *
 * ── THE DISTINCTION THIS FILE EXISTS TO HOLD ──────────────────────────────
 *
 * Dragging the pane wider is a PREFERENCE and it persists (`pane-resize.test
 * .ts`). Floating it is a MODE: somebody has hit a 4,000-word rule, wants the
 * screen for a moment, and wants their layout back. A mode that persisted
 * would greet the next reader with a page-covering panel they never asked for,
 * so **nothing about the float is written down** — asserted below rather than
 * left to be inferred from the absence of a `setItem`.
 *
 * ── IT IS AN EXPANDED PANE, NOT A MODAL ───────────────────────────────────
 *
 * No backdrop, no focus trap, no `<dialog showModal>`; the rail and the body
 * stay visible and usable behind it, and Escape steps back ONE level. A modal
 * would take the whole screen hostage to solve a reading-width problem. The
 * plan names `<dialog showModal>` as "the obvious way to get there by
 * accident", so this file refuses it by name.
 *
 * ── WHY THIS FILE CARRIES ITS OWN COPY OF THE SHELL HARNESS ───────────────
 *
 * `test/ui/pane-route.test.ts` built the first one and its header argues the
 * case at length: the defect lives in the ORDER of glue calls, and a source
 * scan asserting that `app.js` CONTAINS some text goes green against a call
 * placed after an early return. The same is true here — "one Escape un-floats
 * and the second closes" is a statement about two listeners in sequence.
 *
 * The copy is deliberate and narrower: this file never navigates, so it needs
 * no router assertions, and it opens the pane by firing a delegated click at a
 * detached `button.linkid` rather than by attaching one to a live screen.
 * Folding the two harnesses into a shared helper is a real cleanup and is NOT
 * done here: `pane-route.test.ts` is a gate on a defect the owner reported
 * today, and rewriting it to import a new module is a change to a passing gate
 * made for a reason that has nothing to do with the gate.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const INDEX = readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const CSS = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
const APP_JS = readFileSync(path.join(PUBLIC, 'app.js'), 'utf8');

/** The browser's root-absolute specifiers, taught to Node — pane-route's hook. */
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (/^\/(lib|screens|strings)\//.test(specifier)) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

/* ══ THE STAND-IN DOCUMENT ═════════════════════════════════════════════════ */

interface FakeEvent { target?: FakeElement; key?: string }

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
  setPointerCapture: (id: number) => void;
  releasePointerCapture: (id: number) => void;
  querySelector: (selector: string) => FakeElement | null;
  querySelectorAll: (selector: string) => FakeElement[];
  closest: (selector: string) => FakeElement | null;
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
    setPointerCapture: (): void => {},
    releasePointerCapture: (): void => {},
    querySelector: (selector: string): FakeElement | null =>
      descendants(node).find((el) => matches(el, selector)) ?? null,
    querySelectorAll: (selector: string): FakeElement[] =>
      descendants(node).filter((el) => matches(el, selector)),
    closest: (selector: string): FakeElement | null => {
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

function attributeOf(node: FakeElement, name: string): string | null {
  if (name === 'id') return node.id === '' ? null : node.id;
  if (name === 'class') return node.className === '' ? null : node.className;
  if (name.startsWith('data-')) {
    const key = name.slice(5).replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
    if (Object.hasOwn(node.dataset, key)) return node.dataset[key] ?? null;
  }
  return node.attributes[name] ?? null;
}

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
 * Every id the shipped shell carries, with the ones authored `hidden` hidden
 * and the ones authored with attributes carrying them.
 *
 * The ATTRIBUTES matter here in a way they did not for `pane-route.test.ts`:
 * `#panefloat` ships with `aria-pressed="false"`, and a harness that invented
 * the element without it would let a missing initial state pass.
 */
function shellElements(): FakeElement[] {
  const out: FakeElement[] = [];
  for (const [, tag, attrs] of INDEX.matchAll(/<([a-z][a-z0-9]*)\b([^>]*)>/g)) {
    const raw = attrs ?? '';
    const id = /\bid="([^"]+)"/.exec(raw)?.[1];
    if (id === undefined) continue;
    const el = element(tag ?? '');
    el.id = id;
    el.hidden = /\bhidden(?=[\s>])|\bhidden$/.test(raw);
    for (const [, name, value] of raw.matchAll(/([\w-]+)="([^"]*)"/g)) {
      if (name === 'id') continue;
      if (name === 'class') el.className = value ?? '';
      else el.attributes[name ?? ''] = value ?? '';
    }
    out.push(el);
  }
  return out;
}

/** `app.js` with its twenty-one screen routes stubbed — pane-route's rewrite. */
function rewrittenAppJs(): string {
  let routes = 0;
  const rewritten = APP_JS.replace(/import\('\/screens\/([a-z]+)\.js'\)/g, () => {
    routes += 1;
    return "import('data:text/javascript,export%20async%20function%20render(){}')";
  });
  assert.ok(routes >= 21, `expected app.js to register 21+ screen routes, rewrote ${routes}`);
  assert.doesNotMatch(rewritten, /import\('\/screens\//,
    'a screen route survived the rewrite');
  return rewritten;
}

/* ══ THE PAGE AROUND IT ════════════════════════════════════════════════════ */

interface Store {
  writes: Record<string, string>;
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  removeItem: (k: string) => void;
}

interface Harness {
  openItem: (id: string) => Promise<void>;
  click: (id: string) => Promise<void>;
  press: (key: string) => void;
  app: () => FakeElement;
  pane: () => FakeElement;
  button: () => FakeElement;
  store: Store;
}

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
  },
  injection: { phrase: 'governs every session' },
});

function respond(body: unknown): Response {
  return { ok: true, status: 200, json: async (): Promise<unknown> => body } as unknown as Response;
}

const tick = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

/**
 * Booted ONCE, for `pane-route.test.ts`' reason: `app.js` runs `main()` at
 * module scope and a `data:` module with the same bytes is cached, so a second
 * import would return the first module without re-running anything. Each test
 * closes the pane it opened instead, which is what a reader does anyway.
 */
let booted: Promise<Harness> | null = null;

async function boot(): Promise<Harness> {
  booted ??= (async (): Promise<Harness> => {
    const docListeners: Record<string, ((event: FakeEvent) => void)[]> = {};
    const root = element('html');
    const body = element('body');
    root.append(body);

    const seeded = shellElements();
    assert.ok(seeded.some((e) => e.id === 'panefloat'),
      'the shipped index.html carries no #panefloat — this harness is seeded from it, so every '
      + 'assertion below would be about a control the product does not ship');
    for (const el of seeded) body.append(el);

    const writes: Record<string, string> = {};
    const store: Store = {
      writes,
      getItem: (): string | null => null,
      setItem: (k: string, v: string): void => { writes[k] = v; },
      removeItem: (k: string): void => { delete writes[k]; },
    };

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
    };

    const fetchFake = async (target: string): Promise<Response> => {
      const item = /^\/api\/item\/([^/]+)$/.exec(target);
      if (item !== null) return respond(itemPayload(decodeURIComponent(item[1] ?? '')));
      if (/^\/api\/item\/[^/]+\/history$/.test(target)) return respond({ weeks: null });
      if (target === '/api/sessions') return respond({ sessions: [], default: null });
      if (target === '/api/meta') return respond({ git: null });
      if (target === '/api/status') {
        return respond({
          health: { errors: 0, warnings: 0 },
          pendingRevisions: { revisions: 0 },
          items: { total: 3 },
        });
      }
      return { ok: false, status: 404, json: async (): Promise<unknown> => ({}) } as unknown as Response;
    };

    const define = (name: string, value: unknown): void => {
      Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
    };
    define('document', document);
    define('location', { hash: '#/coverage', pathname: '/', reload: (): void => {} });
    define('history', { replaceState: (): void => {} });
    define('navigator', { language: 'en' });
    define('localStorage', store);
    define('sessionStorage', { getItem: (): null => null, setItem: (): void => {}, removeItem: (): void => {} });
    define('fetch', fetchFake);
    define('window', { addEventListener: (): void => {} });
    const realSetInterval = globalThis.setInterval;
    define('setInterval', (fn: () => void, ms: number): unknown => {
      const timer = realSetInterval(fn, ms);
      timer.unref();
      return timer;
    });

    await import('data:text/javascript,' + encodeURIComponent(rewrittenAppJs()));
    for (let turn = 0; turn < 60; turn += 1) await tick();

    const byId = (id: string): FakeElement => {
      const el = document.getElementById(id);
      assert.notEqual(el, null, `the shell has no #${id}`);
      return el as FakeElement;
    };
    const fire = (type: string, event: FakeEvent): void => {
      for (const listener of docListeners[type] ?? []) listener(event);
    };

    return {
      openItem: async (id: string): Promise<void> => {
        // Built the way `screens/parts.js`' linkId() builds one, and clicked on
        // its INNER span, as a real click almost always lands.
        const link = element('button');
        link.className = 'linkid';
        link.dataset.id = id;
        const slug = element('span');
        slug.className = 'idslug';
        link.append(slug);
        byId('screen').append(link);
        fire('click', { target: slug });
        for (let turn = 0; turn < 20; turn += 1) await tick();
      },
      click: async (id: string): Promise<void> => {
        fire('click', { target: byId(id) });
        for (let turn = 0; turn < 5; turn += 1) await tick();
      },
      press: (key: string): void => { fire('keydown', { key }); },
      app: (): FakeElement => byId('app'),
      pane: (): FakeElement => byId('pane'),
      button: (): FakeElement => byId('panefloat'),
      store,
    };
  })();
  return await booted;
}

/* ══ THE SHELL'S OWN SHAPE ═════════════════════════════════════════════════ */

/** The three ids inside the pane's head row, in the order the markup writes them. */
function paneHeadIds(): string[] {
  const pane = INDEX.indexOf('<aside class="pane" id="pane"');
  assert.notEqual(pane, -1, 'no #pane in the shell');
  const headEnd = INDEX.indexOf('</div>', pane);
  assert.notEqual(headEnd, -1, 'the pane head row is not closed');
  const head = INDEX.slice(pane, headEnd);
  return [...head.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1] ?? '').filter((id) => id !== 'pane');
}

test('the button sits in the pane head, before the close button', async () => {
  assert.deepEqual(paneHeadIds(), ['paneid', 'panefloat', 'paneclose'],
    'Close stays LAST — it is the destructive one and it keeps its corner. A new control '
    + 'appended after it would move the ✕ every reader already aims at.');
  // And it is a real button, not a div wearing a click handler.
  const tag = /<button\b[^>]*\bid="panefloat"[^>]*>/.exec(INDEX)?.[0];
  assert.ok(tag !== undefined, '#panefloat is not a <button>');
  assert.match(tag, /class="icon"/,
    'THE DEFECT REPORTED ON 2026-08-27: styles.css\'s only global button rule is '
    + '`button{font:inherit;color:inherit}` — colour and NO background — so a classless '
    + 'button takes the app\'s light text and the user agent\'s near-white button face and '
    + 'is invisible. `.icon` is what gives this one `background:var(--sink)`.');
  assert.match(tag, /data-t-aria="aria\.panefloat"/, 'the label must be translated, not fixed');
  assert.match(tag, /aria-pressed="false"/, 'a toggle with no initial state is announced as none');
});

test('.icon — the class this button leans on — really does paint a background', () => {
  const rule = /^\.icon\{[^}]*\}/m.exec(CSS)?.[0];
  assert.ok(rule !== undefined, 'styles.css declares no .icon rule');
  assert.match(rule, /background:var\(--sink\)/,
    'if `.icon` ever stops painting, #panefloat becomes the owner\'s invisible button');
});

test('the grid returns to TWO columns while it floats', () => {
  // Otherwise the body keeps a 330px hole where the pane used to be, and giving
  // the body its width back was the entire point of floating.
  const rule = /^\.app\.pane-open\.pane-float\{[^}]*\}/m.exec(CSS)?.[0];
  assert.ok(rule !== undefined, 'styles.css declares no .app.pane-open.pane-float rule');
  assert.match(rule, /grid-template-columns:214px 1fr[;}]/);
  assert.match(rule, /grid-template-areas:"top top" "rail body"/);
});

test('the floating pane leaves the grid and is given a readable measure', () => {
  const rule = /^\.pane-float #pane\{[^}]*\}/m.exec(CSS)?.[0];
  assert.ok(rule !== undefined, 'styles.css declares no .pane-float #pane rule');
  assert.match(rule, /position:fixed/);
  assert.match(rule, /inline-size:min\(/,
    'a floating pane pinned to the full window is a wall of text, not a readable one');
});

test('IT IS NOT A MODAL — no dialog, no backdrop, no focus trap', () => {
  // Considered and refused: the rail and the body stay visible and usable
  // behind it, because a modal would take the screen hostage to solve a
  // reading-width problem. `<dialog showModal>` is the obvious way to get there
  // by accident, so it is refused BY NAME rather than merely not written.
  assert.doesNotMatch(APP_JS, /showModal|\.inert\b|<dialog/);
  assert.doesNotMatch(INDEX, /<dialog/);
  assert.doesNotMatch(CSS, /::backdrop/);
  assert.doesNotMatch(CSS, /^\.pane-float #pane\{[^}]*inset:0[^}]*\}/m);
});

/* ══ THE BEHAVIOUR ═════════════════════════════════════════════════════════ */

/**
 * The anti-vacuum test, first for `pane-route.test.ts`' reason: every assertion
 * below about a class being ABSENT would pass against a harness whose click did
 * nothing at all.
 */
test('the harness really opens the pane: a delegated click fills it', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  assert.equal(ui.pane().hidden, false);
  assert.ok(ui.app().classList.contains('pane-open'));
});

test('it toggles the float class on the app, and nothing else', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');

  await ui.click('panefloat');
  assert.ok(ui.app().classList.contains('pane-float'));
  assert.ok(ui.app().classList.contains('pane-open'), 'floating is a mode of being OPEN');
  assert.equal(ui.pane().hidden, false);

  await ui.click('panefloat');
  assert.ok(!ui.app().classList.contains('pane-float'));
  assert.ok(ui.app().classList.contains('pane-open'), 'un-floating is not closing');
});

test('the button reports its own state, so a toggle is announced as a toggle', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  assert.equal(ui.button().getAttribute('aria-pressed'), 'false');
  await ui.click('panefloat');
  assert.equal(ui.button().getAttribute('aria-pressed'), 'true');
  await ui.click('panefloat');
  assert.equal(ui.button().getAttribute('aria-pressed'), 'false');
});

test('Escape restores it before it closes the pane', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  await ui.click('panefloat');

  ui.press('Escape');
  assert.ok(!ui.app().classList.contains('pane-float'));
  assert.ok(ui.app().classList.contains('pane-open'), 'one Escape, one step back');

  ui.press('Escape');
  assert.ok(!ui.app().classList.contains('pane-open'));
  assert.equal(ui.pane().hidden, true);
});

test('closing the pane while floating leaves no float class behind', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  await ui.click('panefloat');

  await ui.click('paneclose');
  assert.ok(!ui.app().classList.contains('pane-float'),
    'a float left on a closed pane is a two-column grid wearing a fixed panel');
  assert.ok(!ui.app().classList.contains('pane-open'));
  assert.equal(ui.button().getAttribute('aria-pressed'), 'false',
    'the button must not still claim to be pressed after the pane it floats is gone');
});

test('the float is NOT remembered — a mode is not a preference', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  await ui.click('panefloat');
  assert.deepEqual(Object.keys(ui.store.writes).filter((k) => k.includes('float')), [],
    'a float that survived a reload would greet the next reader with a page-covering panel '
    + 'they never asked for');
  ui.press('Escape');
  ui.press('Escape');
});

test('opening a different item keeps the float, because that is the reading posture', async () => {
  const ui = await boot();
  await ui.openItem('RULE-x');
  await ui.click('panefloat');
  await ui.openItem('RULE-other');
  assert.ok(ui.app().classList.contains('pane-float'),
    'somebody reading long items one after another asked for the big window ONCE');
  ui.press('Escape');
  ui.press('Escape');
});
