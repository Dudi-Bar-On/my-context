/**
 * **A long item body, read floated and read dragged — in a real browser.**
 *
 * Task 5 of `docs/superpowers/plans/2026-08-27-the-item-pane-is-resizable-and-
 * can-float.md`, and the only place the feature can actually be judged. The
 * node suite drives the RULES: what a drag means, which stored values are
 * widths, which class a click toggles. None of that answers the owner's
 * question, which was about READING — *"to have a bigger window to look at it
 * because it may include a long text boddy"*. Width is a layout fact and layout
 * only exists in a browser.
 *
 * ── THE FIXTURE IS MEASURED, NOT ASSUMED ──────────────────────────────────
 *
 * The plan's own warning: *"Pick an item with a genuinely long body. The point
 * of the feature is a wall of prose; a two-line fixture would pass this test
 * and prove nothing."* So the item is chosen by asking the server how long each
 * candidate's body is and taking the longest, and the choice is then held to a
 * floor. A corpus that stopped containing a long item fails HERE, with a
 * message saying so, rather than quietly turning this file into a check that
 * 300px is wider than 290px.
 *
 * ── AND THE FLOAT BUTTON'S CONTRAST IS MEASURED HERE ──────────────────────
 *
 * `e2e/button-contrast.spec.ts` walks the command-composing screens and never
 * opens an item pane, so `#panefloat` has no box on any screen it visits and
 * its collector skips it — correctly: a button with no box is not drawn and
 * judging one would report a colour nobody can see. Rather than widen that
 * spec's named screen list (it is deliberately a list somebody must READ, and
 * "the pane" is not a screen), the same measurement is taken here, on the one
 * state where the button is actually on screen.
 *
 * The defect it guards against is the owner's, reported 2026-08-27: `styles
 * .css`'s only global button rule is `button{font:inherit;color:inherit}` —
 * colour and NO background — so a classless button takes the app's light text
 * and the user agent's near-white button face and is invisible.
 */
import { test, expect } from './app.ts';
import type { Page, Request } from '@playwright/test';

/** WCAG AA for ordinary text, and a button's label is ordinary text. */
const MIN_RATIO = 4.5;

/** `:root{--pane-w:330px}` — what shipped, and what Home restores. */
const DEFAULT_W = 330;

/**
 * A body long enough for the feature to be about anything. Roughly two screens
 * of prose at the pane's shipped width; every pinned rule in this corpus clears
 * it several times over.
 */
const LONG_ENOUGH = 3000;

/** The whole point of the gesture: the width the reader dragged to. */
const DRAGGED_W = 480;

/**
 * The screens that draw `button.linkid` — the nine that call `parts.js`' own
 * `linkId()`, in the order this walk tries them.
 *
 * Named rather than derived from the rail, the same rule `button-contrast
 * .spec.ts` states for its own list: a screen that starts linking ids later
 * should make somebody READ this and decide, not be swept in by a loop.
 */
const LINKING_SCREENS = [
  'preview', 'injected', 'learn', 'doctor', 'work', 'watch', 'proc', 'ask', 'coverage',
];

interface Choice { screen: string; id: string; chars: number }

/**
 * The chosen item, discovered ONCE per worker.
 *
 * The corpus is deterministic (`scripts/demo-corpus.ts` contains no
 * randomness), so the answer cannot differ between tests in the same run, and
 * the walk below is nine screen loads nobody should pay for five times.
 */
let chosen: Choice | null = null;

/**
 * The `/api/` calls this page has in flight, so "the fetch has come back" is a
 * FACT rather than a length of time.
 *
 * `/api/watch/stream` is excluded because it is the one request that never
 * finishes by design — the shell's single live connection, opened once and held
 * open (`app.js`, "THE SHARED LIVE STREAM"). Counting it would mean no screen
 * on this page is ever idle again.
 *
 * Keyed by `Request` rather than by a bare counter: the boot's own calls may
 * already be in flight when the first `gotoScreen` installs these listeners,
 * and their `requestfinished` would otherwise decrement a total they were never
 * added to and drive it negative. Listeners are installed ONCE per page.
 */
const apiInFlight = new WeakMap<Page, Set<Request>>();
function pendingApi(page: Page): Set<Request> {
  const already = apiInFlight.get(page);
  if (already !== undefined) return already;
  const live = new Set<Request>();
  apiInFlight.set(page, live);
  const counts = (r: Request): boolean =>
    r.url().includes('/api/') && !r.url().includes('/api/watch/stream');
  page.on('request', (r) => { if (counts(r)) live.add(r); });
  page.on('requestfinished', (r) => { live.delete(r); });
  page.on('requestfailed', (r) => { live.delete(r); });
  return live;
}

/**
 * Navigate, then wait until the screen has ACTUALLY FINISHED DRAWING.
 *
 * ── WHY THIS IS NOT "THE COUNT STOPPED CHANGING" ANY MORE ─────────────────
 *
 * It was, copied from `button-contrast.spec.ts` — but only that spec's
 * STABILITY half, without its existence half. That worked for exactly as long
 * as `route()` left the section EMPTY while a screen's module imported and
 * fetched: an empty section counts zero elements, `now > 0` was false, and the
 * loop kept polling until the real content arrived.
 *
 * On 2026-08-29 `route()` stopped keeping that silence. It now writes a holding
 * chip — `<p id="screenunread">` carrying `screen.unread`, "not read yet" —
 * into the section BEFORE awaiting the screen module, deliberately, so the
 * tallest row on the page is never a band of nothing (`app.js`, "AND IT SAYS SO
 * WHILE IT IS EMPTY"). Two elements. Present from the first frame. Never
 * changing. So `now > 0 && now === previous` became TRUE ON THE SECOND POLL,
 * ~600ms in, with nothing drawn but the holding chip — and `discover()` counted
 * `button.linkid` on a screen that had not rendered yet and found none, on all
 * nine, every time the render took longer than one poll. Measured in a real
 * browser on 2026-08-29 against this repository's own corpus: with this settle,
 * every screen reports 0 linked; waiting for the property instead, the same
 * nine screens report preview 16, injected 50, doctor 59, coverage 80.
 *
 * Nothing about the app was wrong. The measurement was.
 *
 * So this waits for the two facts the next line actually depends on:
 *
 *   the holding chip is GONE     Every screen's `render()` opens with
 *                                `root.replaceChildren()`, uniformly — the
 *                                property `route()` itself leans on twice. Its
 *                                removal is the render having STARTED, and it
 *                                is an event in the render, not a clock.
 *   nothing is in flight         Six screens await an endpoint and append
 *                                afterwards, so a heading drawn synchronously
 *                                is the same trap one step along: `doctor` is
 *                                the screen `button-contrast.spec.ts` records
 *                                being measured half-drawn for this reason.
 *
 * plus the original stability poll, which covers the microtask between a
 * response landing and its rows being appended.
 *
 * **And the bound fails as ITSELF.** Falling through to report "0 linked" for a
 * screen that was still loading is how this failure read as a product defect
 * for two days —
 * `LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine`.
 */
async function gotoScreen(page: Page, screen: string): Promise<void> {
  const pending = pendingApi(page);
  await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
  let previous = -1;
  let settled = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    // One evaluate, not two: both readings must come from the SAME DOM
    // snapshot, or a stale count could be paired with a fresh "the chip is
    // gone" and settle on a combination that was never simultaneously true.
    const { count, holding } = await page.evaluate((s) => ({
      count: document.querySelectorAll(`[data-p="${s}"] *`).length,
      holding: document.querySelector(`[data-p="${s}"] #screenunread`) !== null,
    }), screen);
    if (!holding && pending.size === 0 && count > 0 && count === previous) {
      settled = true;
      break;
    }
    previous = count;
    await page.waitForTimeout(300);
  }
  expect(settled,
    `${screen}: still loading after 40 samples over 12s — NOT measured. Anything this walk `
    + 'says about the screen would be a statement about a half-drawn page. Run this spec '
    + 'alone before believing it.').toBe(true);
}

/**
 * Find the longest item body anything in this app links to, and say where.
 *
 * **The fixture is measured, not named.** A hard-coded id is one corpus
 * rebuild away from being a two-line note, and the plan's warning is exactly
 * that: *"a two-line fixture would pass this test and prove nothing"*. The
 * lengths are read through the page's OWN `api()` — the same door, the same
 * token — rather than by opening twenty panes and measuring each.
 *
 * The walk stops at the first screen that clears the floor. It is looking for
 * an item long enough to make the feature mean something, not for the longest
 * item in the corpus.
 */
async function discover(page: Page): Promise<Choice> {
  if (chosen !== null) return chosen;
  let best: Choice = { screen: '(none)', id: '', chars: -1 };
  const walked: string[] = [];
  for (const screen of LINKING_SCREENS) {
    await gotoScreen(page, screen);
    const found = await page.evaluate(async (name) => {
      const ids = [...new Set(
        [...document.querySelectorAll(`[data-p="${name}"] button.linkid`)]
          .map((b) => (b as HTMLElement).dataset['id'])
          .filter((id): id is string => typeof id === 'string' && id !== ''),
      )];
      const api = (globalThis as unknown as {
        myctx: { api: (u: string) => Promise<{ item?: { body?: string } }> };
      }).myctx.api;
      let top = { id: '', chars: -1 };
      for (const id of ids) {
        try {
          const data = await api(`/api/item/${encodeURIComponent(id)}`);
          const chars = (data.item?.body ?? '').length;
          if (chars > top.chars) top = { id, chars };
        } catch { /* an item the endpoint refuses is not a candidate */ }
      }
      return { ...top, linked: ids.length };
    }, screen);
    walked.push(`${screen}:${found.linked} linked, longest ${Math.max(found.chars, 0)}`);
    if (found.chars > best.chars) best = { screen, id: found.id, chars: found.chars };
    if (best.chars > LONG_ENOUGH) break;
  }

  expect(best.chars,
    `no screen links an item with a body over ${LONG_ENOUGH} characters — walked `
    + `${walked.join(' · ')}. This spec is about reading a WALL OF PROSE in a wider pane; `
    + 'against a two-line fixture every assertion below would pass and prove nothing. '
    + 'Rebuild the demo corpus (`node scripts/demo-corpus.ts`), or add a screen that links '
    + 'one of the pinned rules — several run to a page.')
    .toBeGreaterThan(LONG_ENOUGH);

  chosen = best;
  return best;
}

/** Open the chosen item's pane, and wait until it has actually FILLED. */
async function openLongestItem(page: Page): Promise<Choice> {
  const pick = await discover(page);
  await gotoScreen(page, pick.screen);
  await page.locator(`[data-p="${pick.screen}"] button.linkid[data-id="${pick.id}"]`)
    .first().click();
  await expect(page.locator('#pane')).toBeVisible({ timeout: 15_000 });
  // Filled, not merely open: a pane stuck on its holding state has no body to
  // measure the width of.
  await expect.poll(() => page.locator('#panetype').textContent(), { timeout: 15_000 })
    .not.toBe('…');
  await expect(page.locator('#panebody bdi')).toBeAttached();
  return pick;
}

/** The width of one element's box, or a failure that names the element. */
async function widthOf(page: Page, selector: string): Promise<number> {
  const box = await page.locator(selector).boundingBox();
  expect(box, `${selector} has no box — it is not being drawn`).not.toBeNull();
  return box!.width;
}

/**
 * Walk the tab order until `id` has focus, or fail saying how far it got.
 *
 * Bounded, and the bound fails as ITSELF rather than falling through to an
 * assertion about focus — a control that is simply not reachable and one that
 * is 200 stops away are different defects and must not report as the same one.
 */
async function tabTo(page: Page, id: string): Promise<void> {
  const seen: string[] = [];
  for (let step = 0; step < 200; step += 1) {
    await page.keyboard.press('Tab');
    const at = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id ?? '');
    if (at === id) return;
    if (at !== '' && !seen.includes(at)) seen.push(at);
  }
  throw new Error(
    `#${id} was never reached in 200 Tab presses — it is not in the keyboard sequence. `
    + `Identified stops along the way: ${seen.join(', ') || '(none carried an id)'}`);
}

/** A real pointer drag of the handle, `dx` CSS pixels along the inline axis. */
async function dragHandle(page: Page, dx: number): Promise<void> {
  const grip = page.locator('#panegrip');
  await expect(grip, 'the drag handle is not drawn beside an open pane').toBeVisible();
  const box = await grip.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  // Two moves, not one: a single move can be coalesced into the press on some
  // platforms, and a drag that never emits a `pointermove` proves nothing.
  await page.mouse.move(x + dx / 2, y, { steps: 5 });
  await page.mouse.move(x + dx, y, { steps: 5 });
  await page.mouse.up();
}

test('a long body is readable floated, and the layout comes back', async ({ app }) => {
  test.setTimeout(120_000);
  const { page } = app;

  const opened = await openLongestItem(page);
  const narrow = await widthOf(page, '#panebody');

  await page.getByRole('button', { name: /expand/i }).click();
  await expect(page.locator('.app')).toHaveClass(/pane-float/);
  const wide = await widthOf(page, '#panebody');

  expect(wide,
    `${opened.id} (${opened.chars} characters) is read through ${Math.round(narrow)}px `
    + `docked and ${Math.round(wide)}px floated. The owner asked for "a bigger window to `
    + 'look at it"; less than double is not one.')
    .toBeGreaterThan(narrow * 2);

  // **NOT A MODAL.** The rail and the body stay visible and usable behind it —
  // that was a decision, not an omission, and it is the one thing about this
  // feature a screenshot cannot tell you from a `<dialog showModal>`.
  await expect(page.locator('#nav')).toBeVisible();
  await expect(page.locator('#screen')).toBeVisible();
  expect(await page.evaluate(() => document.querySelectorAll('dialog').length),
    'a <dialog> appeared — this is an expanded pane, not a modal').toBe(0);

  // And the body got its width back, which was the point of dropping the third
  // grid column rather than merely covering it.
  const bodyFloated = await widthOf(page, '#screen');
  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).not.toHaveClass(/pane-float/);
  await expect(page.locator('#pane'), 'one Escape, one step back — the pane is still open')
    .toBeVisible();
  const bodyDocked = await widthOf(page, '#screen');
  expect(bodyFloated,
    'floating must give the body the pane\'s column back, or the reader has traded a narrow '
    + 'pane for a narrow pane AND a hole').toBeGreaterThan(bodyDocked);

  expect(await widthOf(page, '#panebody')).toBeCloseTo(narrow, 0);

  // The second Escape closes it. Two gestures, two levels.
  await page.keyboard.press('Escape');
  await expect(page.locator('#pane')).toBeHidden();
});

test('the float button can be READ — the defect of 2026-08-27, measured on the pane', async ({ app }) => {
  test.setTimeout(120_000);
  const { page } = app;
  await openLongestItem(page);

  const report = await page.evaluate(() => {
    const parse = (value: string): { r: number; g: number; b: number; a: number } | null => {
      const m = /rgba?\(([^)]+)\)/.exec(value);
      if (m === null) return null;
      const parts = (m[1] ?? '').split(',').map((n) => Number.parseFloat(n.trim()));
      return { r: parts[0] ?? 0, g: parts[1] ?? 0, b: parts[2] ?? 0, a: parts.length > 3 ? (parts[3] ?? 1) : 1 };
    };
    const luminance = ({ r, g, b }: { r: number; g: number; b: number }): number => {
      const chan = (c: number): number => {
        const s = c / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
    };
    // A transparent button shows its nearest painted ancestor, so walking up is
    // not a nicety: reading a transparent button's own value would call it white.
    const effectiveBackground = (el: Element): { r: number; g: number; b: number } => {
      for (let node: Element | null = el; node !== null; node = node.parentElement) {
        const bg = parse(getComputedStyle(node).backgroundColor);
        if (bg !== null && bg.a > 0.99) return bg;
      }
      return { r: 255, g: 255, b: 255 };
    };
    const out: { id: string; color: string; background: string; ratio: number }[] = [];
    for (const id of ['panefloat', 'paneclose']) {
      const el = document.getElementById(id);
      if (el === null) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const cs = getComputedStyle(el);
      const fg = parse(cs.color);
      if (fg === null) continue;
      const lf = luminance(fg);
      const lb = luminance(effectiveBackground(el));
      out.push({
        id,
        color: cs.color,
        background: cs.backgroundColor,
        ratio: Math.round(((Math.max(lf, lb) + 0.05) / (Math.min(lf, lb) + 0.05)) * 100) / 100,
      });
    }
    return out;
  });

  // Anti-vacuity, the same guard `button-contrast.spec.ts` carries: if the pane
  // never opened, an empty list would pass by looking at nothing.
  expect(report.map((b) => b.id),
    'the pane\'s own buttons were not drawn — nothing was measured').toEqual(['panefloat', 'paneclose']);

  for (const b of report) {
    expect(b.ratio,
      `#${b.id}: ${b.ratio}:1 (${b.color} on ${b.background}), needs ${MIN_RATIO}:1. The usual `
      + 'cause is a CLASSLESS <button>: the only global rule is `button{font:inherit;'
      + 'color:inherit}`, which sets colour and NOT background, so the button takes the app\'s '
      + 'light text and the user agent\'s light button face.')
      .toBeGreaterThanOrEqual(MIN_RATIO);
  }
});

test('the handle drags, and the width survives a reload', async ({ app }) => {
  test.setTimeout(120_000);
  const { page } = app;
  await openLongestItem(page);

  const shipped = await widthOf(page, '#pane');
  expect(shipped, 'the pane did not open at its shipped default').toBeCloseTo(DEFAULT_W, 0);

  await dragHandle(page, -(DRAGGED_W - DEFAULT_W));
  const widened = await widthOf(page, '#pane');
  expect(widened, 'the drag did not move the pane at all').toBeGreaterThan(shipped + 100);
  await expect(page.locator('#panegrip')).toHaveAttribute('aria-valuenow', String(Math.round(widened)));

  // **A PREFERENCE, so it comes back.** Somebody reading item after item chose
  // a working width once and must not be asked again on the next page load.
  await page.reload();
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await openLongestItem(page);
  expect(await widthOf(page, '#pane'),
    'the remembered width did not come back — a preference that is forgotten on reload is not '
    + 'a preference').toBeCloseTo(widened, 0);

  // And Home is the one keystroke back, which is why a bad drag is cheap.
  await page.locator('#panegrip').focus();
  await page.keyboard.press('Home');
  expect(await widthOf(page, '#pane')).toBeCloseTo(DEFAULT_W, 0);
});

test('the keyboard alone can do both, and can SEE where it is', async ({ app }) => {
  test.setTimeout(120_000);
  const { page } = app;
  await openLongestItem(page);

  // **Reached by pressing Tab, not by calling `.focus()`.** `:focus-visible` is
  // a statement about HOW focus arrived: a scripted `.focus()` leaves the
  // browser's last interaction modality at "mouse", so the ring correctly does
  // not draw and a test built on it would be asserting the wrong thing about
  // the right element. This is the walk a keyboard user actually makes.
  await tabTo(page, 'panegrip');
  // **The ring is measured, not assumed.** The app's one focus rule is
  // `:where(button,a,input,select,summary):focus-visible` and a
  // `div[role=separator]` matches none of the five — so this control needs a
  // rule of its own, and a control that can be focused and shows nothing is one
  // a keyboard user cannot find.
  const ring = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null) return null;
    const cs = getComputedStyle(el);
    return {
      id: el.id,
      visible: el.matches(':focus-visible'),
      outline: `${cs.outlineStyle} ${cs.outlineWidth}`,
    };
  });
  expect(ring?.id, 'the handle did not take focus — it is not keyboard reachable').toBe('panegrip');
  expect(ring?.visible, '#panegrip must be :focus-visible when reached from the keyboard').toBe(true);
  expect(ring?.outline, '#panegrip draws no focus ring').toBe('solid 2px');

  const before = await widthOf(page, '#pane');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('ArrowLeft');
  const stepped = await widthOf(page, '#pane');
  expect(stepped, 'ArrowLeft must widen the pane in aimable steps').toBeGreaterThan(before);

  await page.keyboard.press('Home');
  expect(await widthOf(page, '#pane'), 'Home restores the shipped default')
    .toBeCloseTo(DEFAULT_W, 0);

  await page.getByRole('button', { name: /expand/i }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.app')).toHaveClass(/pane-float/);
  await expect(page.locator('#panefloat')).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('Escape');
  await expect(page.locator('.app')).not.toHaveClass(/pane-float/);
  await expect(page.locator('#panefloat')).toHaveAttribute('aria-pressed', 'false');
});

test('the pane belongs to the screen that opened it, floating or not', async ({ app }) => {
  test.setTimeout(120_000);
  const { page } = app;
  await openLongestItem(page);
  await page.getByRole('button', { name: /expand/i }).click();
  await expect(page.locator('.app')).toHaveClass(/pane-float/);

  // `simulate` emits no `[data-id]` at all: it could only ever INHERIT a pane.
  // Task 4's rule, seen in a browser rather than through a stand-in document —
  // and with the float on, which is the state where inheriting one is worst.
  await page.evaluate(() => { location.hash = '#/simulate'; });
  await expect(page.locator('#pane')).toBeHidden({ timeout: 15_000 });
  await expect(page.locator('.app')).not.toHaveClass(/pane-float/);
});
