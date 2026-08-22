/**
 * Layout invariants for the SHIPPED app, asserted as shapes rather than as a
 * pinned image (owner's instruction, 2026-08-21: "assert shapes, not a pinned
 * snapshot").
 *
 * ── WHY NOT A SCREENSHOT BASELINE, AT LEAST NOT FIRST ──────────────────────
 *
 * Because a baseline would not have caught the bug that caused this file to be
 * written. `toHaveScreenshot()` writes the baseline on its first run: had it
 * been adopted the day before, it would have recorded the diagonal fan as the
 * reference and passed, in green, forever. A pixel baseline can only tell you
 * that today looks like the day you accepted it — so it is worth exactly as
 * much as the look you gave it that day, and it belongs AFTER a human has
 * confirmed the page, never instead of one.
 *
 * These assertions need no reference image, so they can be written while the
 * page is still wrong and go red against it — which is how each one below was
 * checked before it was trusted.
 *
 * ── THE ONE THAT MATTERS ───────────────────────────────────────────────────
 *
 * `perspective-origin` is resolved against the PERSPECTIVE ELEMENT'S OWN BOX.
 * `.pair` sets `perspective:1600px; perspective-origin:50% 42%`, which is a
 * vanishing point 42% of the way down itself. Bounded to a window, that is the
 * subtle 3.2° tilt the design asks for. Unbounded — `.lit` declares
 * `overflow-y:auto` but nothing constrains its height, so 213 real task bodies
 * grew the scene to 5,165px — 42% lands 2,169px below the top of the viewport,
 * the vanishing point leaves the screen entirely, and the tilt opens into a fan.
 *
 * Measured on the running app at 1280x720 before the fix:
 *
 *     pair height   5165px      perspective-origin  669px 2169px
 *     viewport       720px      planeL matrix3d sin 0.0558  (3.2°, correct)
 *
 * The transform was never wrong. The container height was. So the invariant is
 * not "rows line up" — under a deliberate 3.2° rotation they must NOT line up
 * exactly — it is that an element which establishes a perspective has to fit in
 * the window it is seen through.
 */
import { test, expect } from './app.ts';
import { SCREENS } from './mockup.ts';

interface Box { selector: string; w: number; h: number; x: number; y: number }

test('the app boots authenticated and draws the corpus, not an empty shell', async ({ app }) => {
  const { page } = app;
  // The complaint this answers, in the owner's words: "it does not include any
  // info on screen only clean background". A page that painted its background
  // and nothing else satisfied every gate we had.
  const text = await page.evaluate(() => {
    const body = document.querySelector<HTMLElement>('.body') ?? document.body;
    return (body.innerText ?? '').trim();
  });
  expect(text.length, `the main region rendered ${text.length} characters of text — ` +
    'a page with a background and no content is the failure this asserts against')
    .toBeGreaterThan(200);

  // An exit banner while the server is plainly alive means the page lost its
  // token and said the wrong thing about why.
  const exited = page.locator('#exited');
  if (await exited.count() > 0) {
    await expect(exited, 'the app showed the server-exited banner while the server was running')
      .toBeHidden();
  }
});

test('no element establishing a perspective is taller than the viewport', async ({ app }) => {
  const { page } = app;
  const offenders = await page.evaluate(() => {
    const out: Box[] = [];
    const vh = window.innerHeight;
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const cs = getComputedStyle(el);
      if (cs.perspective === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.height > vh) {
        out.push({
          selector: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
          w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y),
        });
      }
    }
    return out;
  });
  expect(offenders, 'a perspective element taller than the window puts its own ' +
    'perspective-origin off-screen, which turns a subtle tilt into a fan — see this file\'s header')
    .toEqual([]);
});

test('the page never scrolls sideways on any screen', async ({ app }) => {
  const { page } = app;
  const bad: { screen: string; scrollWidth: number; clientWidth: number }[] = [];
  for (const screen of SCREENS) {
    const reached = await page.evaluate((s) => {
      const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
      if (btn === null) return false;
      btn.click();
      return true;
    }, screen);
    if (!reached) continue;
    const m = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    // One pixel of slack: a fractional layout width rounds up and is not a bug.
    if (m.scrollWidth > m.clientWidth + 1) bad.push({ screen, ...m });
  }
  expect(bad, 'these screens overflow horizontally; wide content must scroll ' +
    'inside its own container, never the document').toEqual([]);
});

/**
 * **A band of nothing is a missing element, not a styling slip.**
 *
 * `.app` is a four-row grid — `46px 1fr 26px 30px`, areas `top`, `body`,
 * `prov`, `strip`. The grid faithfully reserves all four rows whether or not
 * anything is built to sit in them, so an unbuilt area does not collapse: it
 * renders as a strip of bare `.app`, through which the body's gradient shows.
 * That is what the owner was looking at on 2026-08-22 — 56px of teal across the
 * bottom of the window, which is exactly `26 + 30`.
 *
 * Written generically rather than as "prov and strip must exist", because the
 * defect is the empty band and the next one will be in a different row.
 *
 * `test.fail()` because the gap is REAL and still open: the mockup declares
 * both elements (`web-ui-mockup.html` ~2369 and ~2376) and `index.html` builds
 * neither. Marking it expected-to-fail keeps the suite honest in both
 * directions — the gap is recorded IN the suite rather than in a TODO nobody
 * reads, and the day someone builds them this test PASSES, which makes
 * `test.fail()` itself fail and forces this annotation to be removed. It cannot
 * rot into a permanently-ignored red.
 */
test('every row of the app shell is occupied — no empty band', async ({ app }) => {
  test.fail();
  const gaps = await app.page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>('.app');
    if (shell === null) return [{ from: 0, to: 0, note: 'no .app element at all' }];
    const box = shell.getBoundingClientRect();
    const spans = [...shell.children]
      .map((c) => c.getBoundingClientRect())
      .filter((r) => r.height > 0 && r.width > 0)
      .map((r) => ({ top: r.top - box.top, bottom: r.bottom - box.top }))
      .sort((a, b) => a.top - b.top);
    const out: { from: number; to: number; note: string }[] = [];
    let covered = 0;
    for (const s of spans) {
      // A gap only counts if it is big enough for a person to see it.
      if (s.top - covered > 8) {
        out.push({ from: Math.round(covered), to: Math.round(s.top), note: 'uncovered band' });
      }
      covered = Math.max(covered, s.bottom);
    }
    if (box.height - covered > 8) {
      out.push({ from: Math.round(covered), to: Math.round(box.height), note: 'uncovered tail' });
    }
    return out;
  });
  expect(gaps, 'the shell grid reserves a row that nothing is built to fill').toEqual([]);
});
