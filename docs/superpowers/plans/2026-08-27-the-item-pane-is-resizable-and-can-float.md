# The item pane is resizable and can float Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The item detail pane stops being a fixed 330px slot. It can be dragged wider, and one button in its top-right corner floats it over the page at a size a long body is actually readable in.

**Architecture:** The width becomes a CSS custom property on `.app` instead of a literal in a grid template, which is the whole of the first task and the reason the other three are small. A drag handle and the arrow keys write that property. Floating swaps one class: the pane leaves the grid, the grid returns to two columns so the body does not keep a hole where the pane was, and Escape or the same button puts it back.

**Tech Stack:** Node >= 24 built-ins only, browser ES modules, no framework. **No `innerHTML` anywhere** and **CSSOM only** — the page ships under `style-src 'self'`, so a style is set through `element.style.setProperty` or a stylesheet rule and never through markup. `node:test` for the view logic, Playwright for the gesture.

**Spec:** none. The design is in §1 and §2 below; it is small enough that a separate document would only be a second place to keep it current.

## Global Constraints

- No `innerHTML`, no `document.write`, no dynamic evaluation. Elements are built with `createElement`.
- Every user-visible string is a key in BOTH `en.js` and `he.js`. A key in one and not the other fails `strings-parity` in the direction that names it.
- Every new control is reachable and operable from the keyboard, and announces what it is.
- `prefers-reduced-motion` is honoured by anything that animates.
- The pane must keep working when nothing is stored and when storage throws.
- Run the whole suite with `npm test` and the browser suite with `npm run test:e2e`. **Never run either from a subagent**, and stop every server you have running before the e2e gate.

---

## 1. What is wrong, measured

`styles.css` ~310:

```css
.app.pane-open{grid-template-columns:214px 1fr 330px;
  grid-template-areas:"top top top" "rail body pane" "prov prov prov" "strip strip strip"}
```

**330 pixels, written as a literal, for every item in the corpus.** `#pane` gets
`overflow-y:auto` and nothing else, so an item whose body is a page of prose —
which most of the normative ones are — is read through a column narrower than a
phone. The owner asked for this on 2026-08-27 in exactly those terms: *"it may
include a long text boddy"*.

The pane draws a `.well` around `div.md#panebody` and renders real Markdown into
it, so the content is already good; the container is the defect.

## 2. Two answers, because they are for two different complaints

The owner offered both — *"resize the right pane to enlarge it or to add a button
on it's top right corner to make it floating popup"* — and they are not
alternatives. They answer different-sized versions of the same problem, so both
ship:

- **Drag, for a working width.** Somebody reading item after item wants the pane
  a bit wider and wants it to STAY that way. That is a preference, and it
  persists.
- **Float, for one long body.** Somebody who has hit a 4,000-word rule wants the
  whole screen for a moment and wants their layout back afterwards. That is a
  mode, and it does not persist.

**Why this is buildable now and would not have been on 2026-08-25.** The owner
ruled on 2026-08-26 that **the app is what is built** and the mockup is history
plus a gap list: the app→mockup direction was dropped from `strings-parity` and
from nine per-screen class checks. A pane the mockup never drew, with two
controls and two string keys the mockup never declared, would have failed those
gates in the INVENTED direction before that ruling. It does not now, and the gap
direction still fails, so the mockup can still catch what the app is missing.

---

### Task 1: The width is a variable, not a literal

**Files:**
- Modify: `src/ui/public/styles.css`
- Test: `test/ui/pane-width.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `--pane-w`, declared on `:root` with the value `330px` and read by `.app.pane-open`.

This task changes NO behaviour. It is separated for exactly that reason: a
reviewer can confirm the layout is untouched without reading a drag handler, and
the two tasks after it are then three lines each.

- [ ] **Step 1: Write the failing test**

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CSS = readFileSync(
  path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'styles.css'), 'utf8',
);

test('the pane width is a custom property with the shipped default', () => {
  assert.match(CSS, /--pane-w:\s*330px/,
    'the default moved. 330px is what shipped; a change to it is a design change.');
});

test('the grid reads the property and no longer carries the literal', () => {
  const rule = /\.app\.pane-open\{grid-template-columns:214px 1fr var\(--pane-w\)/;
  assert.match(CSS, rule);
  assert.doesNotMatch(CSS, /grid-template-columns:214px 1fr 330px/,
    'a second copy of the width would drift from the property the handle writes');
});

test('the width is BOUNDED in CSS, not only in the handler', () => {
  // A stored value from an older build, a corrupted store, or a handler bug
  // must not be able to leave the body with no room. `clamp` is the floor and
  // ceiling that holds whatever anything writes into the property.
  assert.match(CSS, /clamp\(\s*280px/);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/pane-width.test.ts`
Expected: FAIL — the literal is still in the grid template.

- [ ] **Step 3: Make the change**

```css
:root{ --pane-w:330px }

.app.pane-open{grid-template-columns:214px 1fr clamp(280px, var(--pane-w), 70vw);
  grid-template-areas:"top top top" "rail body pane" "prov prov prov" "strip strip strip"}
```

`clamp` in the TEMPLATE rather than in the handler, deliberately: a value written
by anything at all — a stale store, a future feature, a bug — cannot squeeze the
body out of the window, and the guarantee does not depend on the code that
happens to be writing it today.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/pane-width.test.ts test/ui/styles-parity.test.ts`

> **THIS STEP PREDICTED WRONG, and the correction is worth more than the fix.**
> It said `styles-parity` stays green because "only the value moved". There is no
> such category in that gate. `.app.pane-open` is in `SCREEN_SELECTORS`, which is
> compared **byte-identically in both directions**, so any change to the value
> fails — invented or not. The 2026-08-26 ruling dropped the app→mockup direction
> from `strings-parity` and from nine per-screen CLASS checks; it did **not**
> touch this file's rule-body comparison, and reading it as covered would have
> been that ruling stretched somewhere it was never taken.
>
> Two answers were possible: move the mockup, or take `.app.pane-open` off the
> byte-identical list because its width is now app-owned state. **The mockup
> moved** (drafted 2026-08-27, awaiting the owner under the pen ruling), because
> it keeps the gate whole and keeps 1:1 true — and it renders identically, since
> `--pane-w` is 330px and the clamp resolves to 330px.
>
> Taking the selector off the list remains the argument to make if the owner
> declines: a design of record genuinely cannot mirror a value the user owns and
> remembers. It is not the cheaper answer, only the other one.

Expected after the mockup moves: PASS, 215 assertions.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/styles.css test/ui/pane-width.test.ts
git commit -m "ui: the pane's width becomes a property, clamped where nothing can escape it"
```

---

### Task 2: Drag it, or use the arrow keys

**Files:**
- Create: `src/ui/public/lib/pane-resize.js`
- Modify: `src/ui/public/index.html` (one element), `src/ui/public/app.js` (one call), `src/ui/public/styles.css`, `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js`
- Test: `test/ui/pane-resize.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `export function installPaneResize(root, storage)` — `root` is `.app`, `storage` is a `Storage`-shaped object defaulting to `localStorage`.

- [ ] **Step 1: Write the failing test**

```ts
test('the handle is a separator that says what it controls and where it is', () => {
  const { handle } = install();
  assert.equal(handle.getAttribute('role'), 'separator');
  assert.equal(handle.getAttribute('aria-orientation'), 'vertical');
  assert.equal(handle.getAttribute('aria-controls'), 'pane');
  assert.equal(handle.tabIndex, 0);
  assert.equal(handle.getAttribute('aria-valuenow'), '330');
});

test('dragging inline-start widens the pane, and the property is what moves', () => {
  const { root, handle } = install();
  drag(handle, -120);
  assert.equal(root.style.getPropertyValue('--pane-w'), '450px');
});

test('the arrow keys move it too, in steps a person can aim', () => {
  const { root, handle } = install();
  key(handle, 'ArrowLeft');
  assert.equal(root.style.getPropertyValue('--pane-w'), '346px');
  key(handle, 'ArrowRight');
  assert.equal(root.style.getPropertyValue('--pane-w'), '330px');
});

test('Home restores the shipped default, so a bad drag is one keystroke to undo', () => {
  const { root, handle } = install();
  drag(handle, -900);
  key(handle, 'Home');
  assert.equal(root.style.getPropertyValue('--pane-w'), '330px');
});

test('the width is REMEMBERED, and it is the only thing stored', () => {
  const store = fakeStorage();
  install({ storage: store });
  drag(handleOf(), -120);
  assert.deepEqual(Object.keys(store.data), ['mycontext.pane.w']);
  assert.equal(store.data['mycontext.pane.w'], '450');
});

test('a stored width is applied on the next load', () => {
  const { root } = install({ storage: fakeStorage({ 'mycontext.pane.w': '520' }) });
  assert.equal(root.style.getPropertyValue('--pane-w'), '520px');
});

test('a stored value that is not a width is IGNORED, never applied', () => {
  for (const bad of ['', 'wide', '-40', 'NaN', '1e999', '99999999']) {
    const { root } = install({ storage: fakeStorage({ 'mycontext.pane.w': bad }) });
    assert.equal(root.style.getPropertyValue('--pane-w'), '330px', bad);
  }
});

test('storage that THROWS does not break the pane', () => {
  // A private window, site data blocked, a quota that is full. The pane is the
  // product; remembering a width is a convenience, and a convenience may not
  // take the product down with it.
  const { root } = install({ storage: throwingStorage() });
  assert.equal(root.style.getPropertyValue('--pane-w'), '330px');
  drag(handleOf(), -120);
  assert.equal(root.style.getPropertyValue('--pane-w'), '450px');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/pane-resize.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

The handle is one element in `index.html`, immediately before `<aside id="pane">`:

```html
<div class="panegrip" id="panegrip" role="separator" aria-orientation="vertical"
     aria-controls="pane" tabindex="0" data-t-aria="aria.panegrip"></div>
```

and in `styles.css` a 6px column-edge strip with `cursor:col-resize` and a
visible `:focus-visible` ring — a control that can be focused and shows nothing
is a control a keyboard user cannot find.

The module:

```js
const KEY = 'mycontext.pane.w';
const DEFAULT_W = 330;
const MIN_W = 280;
const STEP = 16;

/** The stored width, or null for anything that is not one. */
function stored(storage) {
  try {
    const raw = storage.getItem(KEY);
    if (raw === null) return null;
    const n = Number.parseInt(raw, 10);
    // `Number.isSafeInteger` and not `isFinite`: '1e999' parses to Infinity and
    // an infinite width passes every comparison below it.
    return Number.isSafeInteger(n) && n >= MIN_W && n <= 4000 ? n : null;
  } catch { return null; }
}
```

`setWidth` writes `root.style.setProperty('--pane-w', px + 'px')` and mirrors the
number into `aria-valuenow`, then tries to store it inside a `try`. Dragging
uses `pointerdown` + `setPointerCapture` — not `mousemove` on the document —
so a pointer that leaves the window still ends the drag.

The CSS `clamp` from Task 1 is what actually bounds the layout; `MIN_W` here is
so that `aria-valuenow` and the stored number never disagree with what is drawn.

New string keys, both tables: `aria.panegrip` — English *"Resize the item pane"*,
Hebrew *"שינוי רוחב חלונית הפריט"*.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/pane-resize.test.ts test/ui/strings-parity.test.ts`
Expected: PASS, 8 tests plus the string tables agreeing.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/lib/pane-resize.js src/ui/public/index.html src/ui/public/app.js src/ui/public/styles.css src/ui/public/strings/ test/ui/pane-resize.test.ts
git commit -m "ui: the item pane can be dragged wider, with the keyboard too, and remembers it"
```

---

### Task 3: One button floats it

**Files:**
- Modify: `src/ui/public/index.html`, `src/ui/public/app.js`, `src/ui/public/styles.css`, `src/ui/public/strings/en.js`, `src/ui/public/strings/he.js`
- Test: `test/ui/pane-float.test.ts`

**Interfaces:**
- Consumes: `paneEls()` and `closePane()` in `app.js`.
- Produces: the `pane-float` class on `.app`, and `#panefloat`, the button.

- [ ] **Step 1: Write the failing test**

```ts
test('the button sits in the pane head, before the close button', () => {
  const head = paneHead();
  const kinds = [...head.children].map((el) => el.id);
  assert.deepEqual(kinds, ['paneid', 'panefloat', 'paneclose'],
    'Close stays last — it is the destructive one and it keeps its corner');
});

test('it toggles the float class on the app, and nothing else', () => {
  click('#panefloat');
  assert.ok(app().classList.contains('pane-float'));
  assert.ok(app().classList.contains('pane-open'), 'floating is a mode of being open');
  click('#panefloat');
  assert.ok(!app().classList.contains('pane-float'));
});

test('the grid returns to TWO columns while it floats', () => {
  // Otherwise the body keeps a 330px hole where the pane used to be, and the
  // point of floating was to give the body its width back.
  assert.match(cssFor('.app.pane-open.pane-float'), /grid-template-columns:214px 1fr;/);
});

test('Escape restores it before it closes the pane', () => {
  click('#panefloat');
  press('Escape');
  assert.ok(!app().classList.contains('pane-float'));
  assert.ok(app().classList.contains('pane-open'), 'one Escape, one step back');
  press('Escape');
  assert.ok(!app().classList.contains('pane-open'));
});

test('closing the pane while floating leaves no float class behind', () => {
  click('#panefloat');
  click('#paneclose');
  assert.ok(!app().classList.contains('pane-float'));
  assert.ok(!app().classList.contains('pane-open'));
});

test('the button says which state it will put you in, not which state you are in', () => {
  assert.equal(button().getAttribute('aria-pressed'), 'false');
  click('#panefloat');
  assert.equal(button().getAttribute('aria-pressed'), 'true');
});

test('the float is NOT remembered — a mode is not a preference', () => {
  const store = fakeStorage();
  install({ storage: store });
  click('#panefloat');
  assert.equal(store.data['mycontext.pane.float'], undefined);
});

test('opening a different item keeps the float, because that is the reading posture', () => {
  click('#panefloat');
  openItem('RULE-other');
  assert.ok(app().classList.contains('pane-float'));
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/pane-float.test.ts`
Expected: FAIL — there is no `#panefloat`.

- [ ] **Step 3: Write the implementation**

```css
.app.pane-open.pane-float{grid-template-columns:214px 1fr;
  grid-template-areas:"top top" "rail body" "prov prov" "strip strip"}
.pane-float #pane{position:fixed;inset-block:56px 44px;inset-inline:auto var(--sp-3);
  inline-size:min(920px, calc(100vw - 260px));z-index:40;
  border:1px solid var(--rule);border-radius:var(--r-md);
  box-shadow:0 12px 32px rgb(0 0 0/.45)}
```

**It is an EXPANDED pane, not a modal**, and that is a decision rather than an
omission: the rail and the body stay visible and usable behind it, there is no
backdrop and no focus trap, and Escape steps back one level. A modal would take
the screen hostage to solve a reading-width problem, and this product already
has a rule about refusals being states to leave.

`installItemPane`'s existing Escape handler gains one branch BEFORE its
`closePane()`, so one Escape un-floats and the second closes. `closePane()`
clears both classes, so no state survives a close.

New string keys, both tables: `aria.panefloat` — English *"Expand the item pane"*,
Hebrew *"הרחבת חלונית הפריט"*.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/`
Expected: PASS. `e2e/screen-parity.spec.ts` may now see `button.icon#panefloat` on
screens that open a pane — the app→mockup direction was dropped on 2026-08-26, so
a control the mockup never drew no longer fails it. **If it does fail, read the
message**: it will be the GAP direction, which is a real answer.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/index.html src/ui/public/app.js src/ui/public/styles.css src/ui/public/strings/ test/ui/pane-float.test.ts
git commit -m "ui: one button floats the item pane over the page, and Escape steps back"
```

---

### Task 4: The pane belongs to the screen that opened it

**Files:**
- Modify: `src/ui/public/app.js`
- Test: `test/ui/pane-route.test.ts`

**Interfaces:**
- Consumes: `closePane()` and `route()` in `app.js`.
- Produces: nothing new.

**THE DEFECT, MEASURED.** The owner reported it on 2026-08-27: *"there are many
screens that it should not appear but currently it does"*. The cause is one
missing line and it is not a guess —

```
grep -c closePane src/ui/public/app.js   →  3   (declaration, the ✕ handler, Escape)
route() calls closePane                  →  false
```

`installItemPane` delegates from the DOCUMENT, so a click on any `[data-id]`
opens the pane; **`route()` never closes it.** `pane-open` is a class on `.app`,
and `.app` outlives every screen. So the pane opened from Coverage is still there
on Simulate, on Configure, on Tutorials — **twelve of the twenty-two screens emit
no `[data-id]` at all** (`ask`, `capture`, `config`, `coverage`, `decay`, `docs`,
`doctor`, `gaps`, `graph`, `injected`, `learn`, `packs`, `palette`, `preview`,
`port`, `proc`, `simulate`, `status`, `tut`, `watch`, `work` — ten of them can
open it, the rest can only inherit it), and every one of those inherits an item
pane it has no way to have opened and no relationship to.

It is also why the layout looks wrong on those screens: `pane-open` is what
switches `.app` to three columns, so the body is squeezed to make room for a
panel about an item from a screen the user has left.

**The rule this task writes down: the pane belongs to the screen that opened it.**
A route change closes it. Not hidden — CLOSED, so the grid goes back to two
columns and nothing carries over.

- [ ] **Step 1: Write the failing test**

```ts
test('navigating away CLOSES the pane, and the grid goes back to two columns', async () => {
  await goTo('#/coverage');
  openItem('RULE-x');
  assert.ok(app().classList.contains('pane-open'));
  await goTo('#/simulate');
  assert.ok(!app().classList.contains('pane-open'),
    'the pane opened on one screen was still open on a screen that cannot open one');
  assert.equal(paneEl().hidden, true);
});

test('a screen that emits no [data-id] cannot end up showing a pane at all', async () => {
  // The twelve that can only inherit it. Named rather than counted: a screen
  // that gains a linkid later should make somebody read this list, not slip
  // past a number.
  for (const screen of ['simulate', 'config', 'tut', 'gaps', 'graph', 'status', 'port',
                        'packs', 'capture', 'palette', 'docs', 'decay']) {
    await goTo('#/coverage');
    openItem('RULE-x');
    await goTo(`#/${screen}`);
    assert.ok(!app().classList.contains('pane-open'), screen);
  }
});

test('re-opening on the SAME screen is untouched — this closes on navigation, not on clicks', async () => {
  await goTo('#/coverage');
  openItem('RULE-x');
  openItem('RULE-y');
  assert.ok(app().classList.contains('pane-open'));
  assert.equal(paneId(), 'RULE-y');
});

test('the float mode does not survive navigation either', async () => {
  await goTo('#/coverage');
  openItem('RULE-x');
  click('#panefloat');
  await goTo('#/simulate');
  assert.ok(!app().classList.contains('pane-float'));
});

test('the remembered WIDTH does survive it — a preference is not a mode', async () => {
  await goTo('#/coverage');
  openItem('RULE-x');
  drag(handleOf(), -120);
  await goTo('#/simulate');
  await goTo('#/coverage');
  openItem('RULE-x');
  assert.equal(app().style.getPropertyValue('--pane-w'), '450px');
});
```

The last two are the pair that makes this task coherent with Task 2 and Task 3:
the same navigation that discards a MODE keeps a PREFERENCE, and the tests say
which is which rather than leaving it to be inferred.

- [ ] **Step 2: Run it to make sure it fails**

Run: `node --test test/ui/pane-route.test.ts`
Expected: FAIL — the pane is still open after the second navigation.

- [ ] **Step 3: Write the implementation**

One call, at the TOP of `route()`, before the section is built:

```js
// The pane belongs to the screen that opened it. `installItemPane` delegates
// from the document and `pane-open` is a class on `.app`, which outlives every
// screen — so without this the pane opened on Coverage is still there on
// Simulate, squeezing the body to three columns for an item the user has
// navigated away from. Twelve of the twenty-two screens emit no `[data-id]` at
// all and could only ever inherit it.
closePane();
```

Nothing else changes. `closePane()` already clears `pane-open`, sets `hidden`
and — after Task 3 — clears `pane-float`, so one call restores every part of the
state.

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `node --test test/ui/`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/public/app.js test/ui/pane-route.test.ts
git commit -m "ui: the item pane belongs to the screen that opened it, and a route change closes it"
```

---

### Task 5: Look at it, with a body long enough to matter

**Files:**
- Create: `e2e/pane-size.spec.ts`
- Modify: `README.md`, `docs/README.he.md`

- [ ] **Step 1: Write the browser test**

```ts
test('a long body is readable floated, and the layout comes back', async ({ page }) => {
  await open(page, '#/coverage');
  await page.locator('[data-id]').first().click();
  const narrow = await page.locator('#panebody').boundingBox();
  await page.getByRole('button', { name: /expand/i }).click();
  const wide = await page.locator('#panebody').boundingBox();
  expect(wide.width).toBeGreaterThan(narrow.width * 2);
  await page.keyboard.press('Escape');
  expect((await page.locator('#panebody').boundingBox()).width).toBeCloseTo(narrow.width, 0);
});

test('the handle drags, and the width survives a reload', async ({ page }) => {
  await open(page, '#/coverage');
  await page.locator('[data-id]').first().click();
  await drag(page, '#panegrip', -150);
  const widened = await page.locator('#pane').boundingBox();
  await page.reload();
  await page.locator('[data-id]').first().click();
  expect((await page.locator('#pane').boundingBox()).width).toBeCloseTo(widened.width, 0);
});

test('the keyboard alone can do both', async ({ page }) => {
  await open(page, '#/coverage');
  await page.locator('[data-id]').first().click();
  await page.locator('#panegrip').focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Home');
  await page.getByRole('button', { name: /expand/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.app')).toHaveClass(/pane-float/);
});
```

**Pick an item with a genuinely long body.** The point of the feature is a wall
of prose; a two-line fixture would pass this test and prove nothing. Use one of
the pinned rules — several run to a page.

- [ ] **Step 2: Run it, and LOOK at it**

Stop every UI server you have running first. Run: `npm run test:e2e -- pane-size`

Then open it yourself and read a long item both ways.
`RULE-a-ui-change-is-not-verified-until-someone-has-looked-at-it`: *"looking, as
a human does, is part of your test. It does not pass if a human cannot see what
you think they should see."*

- [ ] **Step 3: Document it in both READMEs**

`test/docs/parity.test.ts` holds the two to the same sections. Two sentences: the
pane can be dragged and the width is remembered per browser; the button floats it
and Escape steps back.

- [ ] **Step 4: Run every gate the way the project runs it**

```bash
npm run typecheck && npm test && npm run check:text-files && npm run check:retired && npm run check:test-glob && npm run verify:citations && npm run test:e2e
```

- [ ] **Step 5: Commit**

```bash
git add e2e/pane-size.spec.ts README.md docs/README.he.md
git commit -m "e2e: a long body read floated and dragged, and the width survives a reload"
```

---

## Self-review

**Coverage.** §1's literal is Task 1. §2's two answers are Tasks 2 and 3, and each
carries the reason it is a preference or a mode — which is what decides whether it
persists. Task 4 is the defect the owner reported in the same breath, and it is
where that distinction earns itself: navigation discards the mode and keeps the
preference. The keyboard requirement is asserted in Tasks 2, 3 and 5. The
storage-failure requirement is Task 2's last test. The reduced-motion constraint
costs nothing here because nothing animates; if a transition is added to the float,
it goes behind the media query in the same commit.

**Placeholders.** None. Every code step carries code.

**Type consistency.** `--pane-w` is produced in Task 1 and written in Task 2.
`pane-float` is produced in Task 3 and asserted in Tasks 4 and 5.
`installPaneResize` keeps its name in Tasks 2 and 5.

**One thing an executor must not do.** Do not make the floating pane a modal with
a backdrop and a focus trap. It was considered and refused in Task 3 for a stated
reason, and a `<dialog showModal>` would be the obvious way to get there by
accident.
