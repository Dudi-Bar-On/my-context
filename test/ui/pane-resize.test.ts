/**
 * **The item pane can be dragged wider, driven from the keyboard, and remembers it.**
 *
 * Task 2 of `docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-
 * can-float.md`. The owner asked for it on 2026-08-27 in his own words:
 * *"resize the right pane to enlarge it … because it may include a long text
 * boddy"*.
 *
 * ── WHAT IS UNDER TEST, AND WHAT IS DELIBERATELY NOT ──────────────────────
 *
 * `lib/pane-resize.js` was pulled out of `app.js` for the reason every other
 * `lib/` module was: spec §6 puts the DOM glue outside the tested surface, so
 * the RULE — what a drag of 120px means, which stored values are widths, what
 * a keystroke does — lives in a module a `node:test` file can drive. What is
 * NOT tested here is where the handle sits on screen; that is a browser
 * question and `e2e/pane-size.spec.ts` asks it.
 *
 * ── WHY THE HANDLE IS SEEDED FROM THE SHIPPED index.html ──────────────────
 *
 * The static ARIA — `role`, `aria-orientation`, `aria-controls`, `tabindex` —
 * is authored in the markup, not written by this module, because a control
 * that is a separator is a fact about the document rather than a thing a
 * script decides. A test that BUILT its own handle with those attributes would
 * assert that this file can spell them. So the handle here is parsed out of
 * the shipped `index.html`: delete `role="separator"` from the markup and this
 * file goes red, which is the only version of the assertion worth having.
 *
 * `aria-valuenow` is the exception and is written by the module, because it is
 * the one attribute that changes.
 *
 * ── THE STORAGE TESTS ARE THE POINT, NOT THE TRIMMING ─────────────────────
 *
 * Remembering a width is a CONVENIENCE. The pane is the PRODUCT. A stored
 * value that is not a width, and a `localStorage` that throws on being touched
 * at all — a private window, blocked site data, a full quota — must both end
 * with a working pane at the shipped default, and neither may take the pane
 * down with it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const SOURCE = readFileSync(path.join(PUBLIC, 'lib', 'pane-resize.js'), 'utf8');
const INDEX = readFileSync(path.join(PUBLIC, 'index.html'), 'utf8');
const CSS = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');

/**
 * The URL form, not a relative specifier — `test/ui/viewmodel.test.ts`'s rule,
 * and its reason: a relative `import()` of an untyped `.js` type-checks as
 * TS2307/TS7016 with `allowJs` off, and this project has `allowJs` off.
 */
const { installPaneResize } = await import(
  new URL('../../src/ui/public/lib/pane-resize.js', import.meta.url).href
) as { installPaneResize: (root: unknown, storage?: unknown, doc?: unknown) => void };

/* ══ A STAND-IN DOCUMENT, NO LARGER THAN THE MODULE TOUCHES ════════════════
 *
 * Four things and no more: attributes, a class-free `style` that records what
 * was set, element-level listeners, and `getElementById`. A fuller fake invites
 * assertions this file has no business making.
 */

interface FakeEvent {
  key?: string;
  clientX?: number;
  pointerId?: number;
  preventDefault: () => void;
  defaultPrevented: boolean;
}

interface FakeElement {
  id: string;
  tabIndex: number;
  attributes: Record<string, string>;
  listeners: Record<string, ((event: FakeEvent) => void)[]>;
  captured: number[];
  released: number[];
  style: {
    declarations: Record<string, string>;
    setProperty: (name: string, value: string) => void;
    getPropertyValue: (name: string) => string;
  };
  setAttribute: (name: string, value: string) => void;
  getAttribute: (name: string) => string | null;
  addEventListener: (type: string, listener: (event: FakeEvent) => void) => void;
  setPointerCapture: (pointerId: number) => void;
  releasePointerCapture: (pointerId: number) => void;
}

function element(attributes: Record<string, string> = {}): FakeElement {
  const declarations: Record<string, string> = {};
  const node: FakeElement = {
    id: attributes['id'] ?? '',
    // The DOM's own reflection of `tabindex`, which is what a caller reads.
    tabIndex: attributes['tabindex'] === undefined ? -1 : Number(attributes['tabindex']),
    attributes: { ...attributes },
    listeners: {},
    captured: [],
    released: [],
    style: {
      declarations,
      setProperty: (name: string, value: string): void => { declarations[name] = value; },
      getPropertyValue: (name: string): string => declarations[name] ?? '',
    },
    setAttribute: (name: string, value: string): void => { node.attributes[name] = value; },
    getAttribute: (name: string): string | null => node.attributes[name] ?? null,
    addEventListener: (type: string, listener: (event: FakeEvent) => void): void => {
      (node.listeners[type] ??= []).push(listener);
    },
    setPointerCapture: (pointerId: number): void => { node.captured.push(pointerId); },
    releasePointerCapture: (pointerId: number): void => { node.released.push(pointerId); },
  };
  return node;
}

/** Fire one event at an element, the way the browser fires it at a listener. */
function fire(el: FakeElement, type: string, fields: Partial<FakeEvent> = {}): FakeEvent {
  const event: FakeEvent = {
    preventDefault: (): void => { event.defaultPrevented = true; },
    defaultPrevented: false,
    ...fields,
  } as FakeEvent;
  event.preventDefault = (): void => { event.defaultPrevented = true; };
  for (const listener of el.listeners[type] ?? []) listener(event);
  return event;
}

/**
 * The handle's authored attributes, read out of the shipped `index.html`.
 *
 * A rename or a dropped ARIA attribute in the markup fails HERE rather than
 * being quietly re-invented by a hand-written fixture.
 */
function shippedHandleAttributes(): Record<string, string> {
  const tag = /<div\b[^>]*\bid="panegrip"[^>]*>/.exec(INDEX)?.[0];
  assert.ok(tag !== undefined,
    'index.html carries no <div id="panegrip"> — the shell has moved and every assertion '
    + 'below is about a control the product does not ship');
  const attributes: Record<string, string> = {};
  for (const [, name, value] of tag.matchAll(/([\w-]+)="([^"]*)"/g)) {
    attributes[name ?? ''] = value ?? '';
  }
  return attributes;
}

interface Store {
  data: Record<string, string>;
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

function fakeStorage(seed: Record<string, string> = {}): Store {
  const data: Record<string, string> = { ...seed };
  return {
    data,
    getItem: (key: string): string | null => data[key] ?? null,
    setItem: (key: string, value: string): void => { data[key] = value; },
    removeItem: (key: string): void => { delete data[key]; },
  };
}

/** Every door slammed: the private window, the blocked site, the full quota. */
function throwingStorage(): Store {
  const boom = (): never => { throw new DOMException('denied', 'SecurityError'); };
  return {
    data: {},
    getItem: boom,
    setItem: boom,
    removeItem: boom,
  } as unknown as Store;
}

interface Installed { root: FakeElement; handle: FakeElement; store: Store }

function install(options: { storage?: Store; dir?: string } = {}): Installed {
  const store = options.storage ?? fakeStorage();
  const root = element({ id: 'app', class: 'app' });
  const handle = element(shippedHandleAttributes());
  const documentElement = element({ dir: options.dir ?? 'ltr' });
  const doc = {
    documentElement,
    getElementById: (id: string): FakeElement | null => (id === 'panegrip' ? handle : null),
  };
  installPaneResize(root, store, doc);
  return { root, handle, store };
}

/** A pointer gesture, start to finish. Negative `dx` is inline-start in LTR. */
function drag(handle: FakeElement, dx: number): void {
  const from = 900;
  fire(handle, 'pointerdown', { pointerId: 7, clientX: from });
  fire(handle, 'pointermove', { pointerId: 7, clientX: from + dx });
  fire(handle, 'pointerup', { pointerId: 7, clientX: from + dx });
}

const key = (handle: FakeElement, name: string): FakeEvent =>
  fire(handle, 'keydown', { key: name });

const widthOf = (root: FakeElement): string => root.style.getPropertyValue('--pane-w');

/* ══ THE TESTS ═════════════════════════════════════════════════════════════ */

test('the handle is a separator that says what it controls and where it is', () => {
  const { handle } = install();
  assert.equal(handle.getAttribute('role'), 'separator');
  assert.equal(handle.getAttribute('aria-orientation'), 'vertical');
  assert.equal(handle.getAttribute('aria-controls'), 'pane');
  assert.equal(handle.tabIndex, 0, 'a separator nobody can focus is a mouse-only control');
  assert.equal(handle.getAttribute('aria-valuenow'), '330');
  // Without a min and a max a `separator` with a value is announced against
  // ARIA's own defaults of 0..100, so "330" would be read as far past the end.
  assert.equal(handle.getAttribute('aria-valuemin'), '280');
  assert.equal(handle.getAttribute('aria-valuemax'), '4000');
});

test('the handle carries a translated label rather than a hard-coded one', () => {
  const { handle } = install();
  assert.equal(handle.getAttribute('data-t-aria'), 'aria.panegrip');
});

test('dragging inline-start widens the pane, and the property is what moves', () => {
  const { root, handle } = install();
  drag(handle, -120);
  assert.equal(widthOf(root), '450px');
});

test('dragging inline-end narrows it, and the floor is the CSS floor', () => {
  const { root, handle } = install();
  drag(handle, 400);
  assert.equal(widthOf(root), '280px',
    'the writer stops where clamp() stops, so aria-valuenow and the store never '
    + 'disagree with what is drawn');
});

test('the drag is inverted in a mirrored page, because inline-start is', () => {
  // The pane is on the inline-END of the grid in both directions. Reading
  // clientX without asking the document which way it reads would make the
  // handle push the wrong way for every Hebrew reader — and nothing else in
  // this product would notice.
  const { root, handle } = install({ dir: 'rtl' });
  drag(handle, 120);
  assert.equal(widthOf(root), '450px');
});

test('aria-valuenow follows the width, so a screen reader is told the same number', () => {
  const { root, handle } = install();
  drag(handle, -120);
  assert.equal(widthOf(root), '450px');
  assert.equal(handle.getAttribute('aria-valuenow'), '450');
});

test('the arrow keys move it too, in steps a person can aim', () => {
  const { root, handle } = install();
  const left = key(handle, 'ArrowLeft');
  assert.equal(widthOf(root), '346px');
  assert.equal(left.defaultPrevented, true,
    'an unhandled ArrowLeft scrolls the page out from under the control');
  key(handle, 'ArrowRight');
  assert.equal(widthOf(root), '330px');
});

test('a key the handle does not own is left alone for the page', () => {
  const { root, handle } = install();
  const tab = key(handle, 'Tab');
  assert.equal(widthOf(root), '330px');
  assert.equal(tab.defaultPrevented, false, 'swallowing Tab would trap focus on the handle');
});

test('Home restores the shipped default, so a bad drag is one keystroke to undo', () => {
  const { root, handle } = install();
  drag(handle, -900);
  key(handle, 'Home');
  assert.equal(widthOf(root), '330px');
});

test('the width is REMEMBERED, and it is the only thing stored', () => {
  const { root, handle, store } = install();
  drag(handle, -120);
  assert.equal(widthOf(root), '450px');
  assert.deepEqual(Object.keys(store.data), ['mycontext.pane.w']);
  assert.equal(store.data['mycontext.pane.w'], '450');
});

test('the keyboard remembers it too — the same preference, reached differently', () => {
  const { store, handle } = install();
  key(handle, 'ArrowLeft');
  assert.equal(store.data['mycontext.pane.w'], '346');
});

test('a stored width is applied on the next load', () => {
  const { root, handle } = install({ storage: fakeStorage({ 'mycontext.pane.w': '520' }) });
  assert.equal(widthOf(root), '520px');
  assert.equal(handle.getAttribute('aria-valuenow'), '520');
});

test('a stored value that is not a width is IGNORED, never applied', () => {
  // `1e999` is the one that matters: `Number.parseInt` reads it as 1 and
  // `Number('1e999')` is Infinity, which passes every `<=` written against it.
  for (const bad of ['', 'wide', '-40', 'NaN', '1e999', '99999999', '330px', '{}']) {
    const { root } = install({ storage: fakeStorage({ 'mycontext.pane.w': bad }) });
    assert.equal(widthOf(root), '330px', bad);
  }
});

test('storage that THROWS does not break the pane', () => {
  // A private window, site data blocked, a quota that is full. The pane is the
  // product; remembering a width is a convenience, and a convenience may not
  // take the product down with it.
  const { root, handle } = install({ storage: throwingStorage() });
  assert.equal(widthOf(root), '330px');
  drag(handle, -120);
  assert.equal(widthOf(root), '450px');
  key(handle, 'Home');
  assert.equal(widthOf(root), '330px');
});

test('no storage at all is a working pane, not a thrown boot', () => {
  // `globalThis.localStorage` is not merely empty in a sandboxed frame — READING
  // the property throws, before any method is called on it.
  const root = element({ id: 'app' });
  const handle = element(shippedHandleAttributes());
  const doc = {
    documentElement: element({ dir: 'ltr' }),
    getElementById: (id: string): FakeElement | null => (id === 'panegrip' ? handle : null),
  };
  installPaneResize(root, null, doc);
  assert.equal(widthOf(root), '330px');
  drag(handle, -120);
  assert.equal(widthOf(root), '450px');
});

test('a shell with no handle still gets the remembered width', () => {
  // The handle is CSS-hidden until the pane opens and could be absent in a
  // future shell; the remembered width belongs to the layout either way.
  const root = element({ id: 'app' });
  const doc = {
    documentElement: element({ dir: 'ltr' }),
    getElementById: (): FakeElement | null => null,
  };
  installPaneResize(root, fakeStorage({ 'mycontext.pane.w': '520' }), doc);
  assert.equal(widthOf(root), '520px');
});

test('the pointer is CAPTURED, so a pointer that leaves the window still ends the drag', () => {
  const { root, handle } = install();
  fire(handle, 'pointerdown', { pointerId: 7, clientX: 900 });
  assert.deepEqual(handle.captured, [7],
    'without setPointerCapture the events stop the moment the pointer leaves the strip, '
    + 'and the pane is left mid-drag');
  fire(handle, 'pointermove', { pointerId: 7, clientX: 780 });
  assert.equal(widthOf(root), '450px');
  fire(handle, 'pointerup', { pointerId: 7, clientX: 780 });
  // And a move AFTER the gesture ended must not still be resizing.
  fire(handle, 'pointermove', { pointerId: 7, clientX: 300 });
  assert.equal(widthOf(root), '450px', 'the drag outlived its own pointerup');
});

test('a cancelled pointer ends the drag as cleanly as a released one', () => {
  const { root, handle } = install();
  fire(handle, 'pointerdown', { pointerId: 7, clientX: 900 });
  fire(handle, 'pointermove', { pointerId: 7, clientX: 780 });
  fire(handle, 'pointercancel', { pointerId: 7 });
  fire(handle, 'pointermove', { pointerId: 7, clientX: 300 });
  assert.equal(widthOf(root), '450px');
});

test('a pointermove with no gesture behind it changes nothing', () => {
  const { root, handle } = install();
  fire(handle, 'pointermove', { pointerId: 7, clientX: 100 });
  assert.equal(widthOf(root), '330px');
});

test('the module listens on the HANDLE and never on the document', () => {
  // Not a style preference. A `mousemove` listener on the document is the shape
  // that survives its own gesture — the pointer leaves the window, no `mouseup`
  // is ever delivered, and the pane resizes with every later mouse move.
  assert.match(SOURCE, /setPointerCapture/);
  assert.doesNotMatch(SOURCE, /document\.addEventListener/);
  // The LISTENER, not the word: the module's own comment names `mousemove` to
  // say why it is refused, and a scan that could not tell the two apart would
  // have to be answered by deleting the explanation.
  assert.doesNotMatch(SOURCE, /addEventListener\(\s*['"]mouse/);
});

test('the module writes no markup and evaluates nothing — CSP: style-src \'self\'', () => {
  assert.doesNotMatch(SOURCE, /innerHTML|outerHTML|document\.write|insertAdjacentHTML/);
  // CSSOM only: `setProperty`, never a `style="…"` attribute assembled as text.
  assert.doesNotMatch(SOURCE, /setAttribute\(\s*['"]style['"]/);
});

/* ══ THE PARTS THAT ONLY EXIST IN THE SHELL ════════════════════════════════ */

test('the handle ships in index.html immediately before the pane it controls', () => {
  const grip = INDEX.indexOf('id="panegrip"');
  const pane = INDEX.indexOf('<aside class="pane" id="pane"');
  assert.ok(grip !== -1, 'no #panegrip in the shell');
  assert.ok(pane !== -1, 'no #pane in the shell');
  assert.ok(grip < pane,
    'the handle sits on the pane\'s inline-start edge, so it comes before it in DOM order — '
    + 'which is also the tab order a keyboard user walks');
});

test('the handle draws a FOCUS RING of its own, because the global one skips it', () => {
  // `:where(button,a,input,select,summary):focus-visible` is the app's one focus
  // rule and a `div[role=separator]` matches none of those five. A control that
  // can be focused and shows nothing is a control a keyboard user cannot find.
  const rule = /^\.panegrip:focus-visible\{[^}]*outline:[^}]*\}/m.exec(CSS)?.[0];
  assert.ok(rule !== undefined, 'styles.css declares no .panegrip:focus-visible rule');
  assert.match(rule, /var\(--gold\)/,
    'the same gold ring every other focusable control in this product draws');
});

test('the handle is not in the layout — or the tab order — while there is no pane', () => {
  // `grid-area:pane` against `.app`'s two-column template names no area at all,
  // so an always-displayed handle would be auto-placed into some other cell.
  assert.match(CSS, /^\.panegrip\{[^}]*display:none/m);
  assert.match(CSS, /^\.app\.pane-open \.panegrip\{[^}]*display:block/m);
});
