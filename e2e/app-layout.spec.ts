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
import type { Page } from '@playwright/test';
import { test, expect } from './app.ts';
import { SCREENS } from './mockup.ts';

interface Box { selector: string; w: number; h: number; x: number; y: number }

test('the app boots authenticated and draws the corpus, not an empty shell', async ({ app }) => {
  const { page } = app;
  // The complaint this answers, in the owner's words: "it does not include any
  // info on screen only clean background". A page that painted its background
  // and nothing else satisfied every gate we had.
  // POLLED. The fixture resolves on the rail, which is drawn before the first
  // /api response lands — and since the shell also builds the provenance bar
  // and the strip before the router runs, there is now a real window where the
  // rail exists and the screen is still empty. Sampling once measured whether
  // the fetch happened to have returned. retries are 0 by policy here, so that
  // is not flake, it is a wrong test.
  await expect
    .poll(() => page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.body') ?? document.body;
      return (body.innerText ?? '').trim().length;
    }), {
      message: 'the main region never rendered more than a background — a page with ' +
        'no content is the failure this asserts against',
      timeout: 10_000,
    })
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
 * **This carried a `test.fail()` and no longer does, which is the annotation
 * working exactly as designed.** The gap was real when it was written: the
 * mockup declared both elements (`web-ui-mockup.html` ~2369 and ~2376) and
 * `index.html` built neither, so the grid reserved 26 + 30 = 56px that nothing
 * filled. Recording it as expected-to-fail put the gap IN the suite rather than
 * in a TODO nobody reads. When `app.js` grew `renderChrome()` the test started
 * passing, which made `test.fail()` itself fail and forced this edit. It could
 * not rot into a permanently-ignored red, and it did not.
 */
test('every row of the app shell is occupied — no empty band', async ({ app }) => {
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

/**
 * **Row labels start at the same place, because a ragged left edge reads as a
 * skew even when nothing is skewed.**
 *
 * The owner reported the delivered cards as "still skewed" after the scene was
 * bounded and the fan was gone. Measured, nothing was: `.plane.l`'s transform
 * was `matrix3d(0.998441, …, -0.0558215, …)` — sin 0.0558, exactly the 3.2° the
 * design asks for — and every `.idfull` BOX began at x=248.
 *
 * What differed was where the GLYPHS began inside those boxes: 307, 330, 337,
 * 330, 307 for five labels of different lengths. Symmetric in and back out,
 * which is the signature of centring, not of a tilt. `.row` is a `<button>` and
 * the UA stylesheet centres button text; neither the mockup nor `styles.css`
 * overrides it, though both override exactly this on `.nav` (~352), which is
 * also a button. The mockup carries the same gap — its sample ids are short
 * enough that nobody saw it.
 *
 * Asserted on the RENDERED TEXT rather than on the computed `text-align`,
 * because the property is the current cause and not the requirement. A future
 * change that centres these some other way — padding, justify-content, a
 * pseudo-element — would leave `text-align: start` in place and still produce
 * the ragged edge the owner is looking at. A Range around the contents measures
 * where the glyphs actually are.
 */
test('delivered row labels begin at one left edge, so nothing reads as a skew', async ({ app }) => {
  // Wait for the rows THEMSELVES, not merely for the shell. The fixture
  // resolves on the rail, which is static markup drawn before the first
  // /api response lands; measuring here without waiting samples whether the
  // fetch happened to have returned. It usually had — and under the full
  // suite’s parallel load, once, it had not. retries are 0 by policy, so a
  // test that passes three times alone and fails in the pack is not flaky,
  // it is wrong.
  await app.page.locator('#deliveredRows .row').nth(1).waitFor({ state: 'visible', timeout: 10_000 });
  const starts = await app.page.evaluate(() => {
    const out: number[] = [];
    for (const row of document.querySelectorAll<HTMLElement>('#deliveredRows .row')) {
      const label = row.querySelector<HTMLElement>('.idfull');
      if (label === null) continue;
      const range = document.createRange();
      range.selectNodeContents(label);
      out.push(Math.round(range.getBoundingClientRect().x));
    }
    return out;
  });
  expect(starts.length, 'no delivered rows rendered — this would pass vacuously').toBeGreaterThan(1);
  // The planes carry a 3.2° rotateY, so two rows at different heights are not
  // required to agree to the pixel. They ARE required to agree to within a few:
  // centring five ids of different lengths spread them over 30px.
  const spread = Math.max(...starts) - Math.min(...starts);
  expect(spread, `row labels start at ${starts.join(', ')} — a spread this wide is ` +
    'centring, and it reads as a diagonal').toBeLessThanOrEqual(4);
});

/**
 * **Nothing INSIDE a perspective may be taller than the perspective itself.**
 *
 * The companion to the assertion above, and the one that would have caught what
 * that one missed. Bounding `.pair` with `max-block-size` made `.pair` measure a
 * well-behaved 418px and satisfied "no perspective element is taller than the
 * viewport" completely — while `.plane.l` INSIDE it measured 5797px, because a
 * grid with no declared rows auto-sizes its implicit row to content and a cap
 * on the container simply lets the row overflow.
 *
 * The owner's report was "still tilted", and they were right: 3.2° applied to
 * an element that tall shears it wherever you look. The mockup renders the same
 * rule correctly, so the design was never in question — only whether the app
 * matched it.
 *
 * Stated over descendants rather than over `.plane` by name, because the defect
 * is "the scene escaped its frame" and the next escape will be some other box.
 */
test('nothing inside a perspective element is taller than that element', async ({ app }) => {
  const escaped = await app.page.evaluate(() => {
    const out: { perspective: string; child: string; theirs: number; mine: number }[] = [];
    for (const host of document.querySelectorAll<HTMLElement>('*')) {
      if (getComputedStyle(host).perspective === 'none') continue;
      // **offsetHeight, NOT getBoundingClientRect().** The rect of a transformed
      // element is the AXIS-ALIGNED BOX OF ITS PROJECTION, and `.plane.l` is
      // rotated 3.2° under a 1600px perspective, so its near edge scales up and
      // the rect comes back a few pixels taller than the element is. Measured
      // here: pair 418, plane rect 421. That 3px is the projection, not an
      // overflow, and widening the tolerance to swallow it would have been
      // tuning the test until it agreed with me.
      //
      // The question this asks is whether the LAYOUT BOX escaped its frame,
      // which is what shears when rotated. offsetHeight answers exactly that
      // and ignores the transform.
      const mine = host.offsetHeight;
      const name = (e: Element) => `${e.tagName.toLowerCase()}.${[...e.classList].join('.')}`;
      // Is anything between this child and the perspective host a scroller? If
      // so the child is ALLOWED to be taller: that is what a scroller is for,
      // and `.blk` inside `.lit` is 1875px against a 418px pane BY DESIGN.
      // Only overflow that nothing has agreed to contain gets rotated.
      const contained = (child: HTMLElement): boolean => {
        for (let p = child.parentElement; p !== null && p !== host; p = p.parentElement) {
          const o = getComputedStyle(p).overflowY;
          if (o === 'auto' || o === 'scroll' || o === 'hidden') return true;
        }
        return false;
      };
      for (const child of host.querySelectorAll<HTMLElement>('*')) {
        if (contained(child)) continue;
        const theirs = child.offsetHeight;
        // 2px for a border or a fractional layout height.
        if (theirs > mine + 2) {
          out.push({
            perspective: name(host), child: name(child),
            theirs, mine,
          });
        }
      }
    }
    // One line per offending CHILD would print a subtree; the outermost is the
    // one to fix and the rest follow from it.
    return out.slice(0, 5);
  });
  expect(escaped, 'a box inside a perspective is taller than the perspective, so the ' +
    'rotation shears it — bound the grid ROW, not only the container').toEqual([]);
});

/**
 * ── THE AUDIT STREAM SCREEN (`data-p="watch"`, ui3 Task 11) ────────────────
 *
 * Five assertions, every one of them written and watched go RED against the
 * unbuilt screen before the screen existed — which is the only thing that
 * makes them evidence. On `master` the rail's `watch` button carries
 * `PROPOSED` and has no click handler, so `showWatch()` below times out and
 * four of the five fail for the same true reason: there is no screen.
 *
 * They measure SHAPES, per the header of this file. Nothing here pins a
 * pixel, a string or a record count — the corpus this runs over is live, its
 * audit log grows while the suite runs, and an assertion that depended on how
 * many records landed today would be a clock, not a test.
 */

/** Navigate the rail to `watch` and wait for the card the screen builds. */
async function showWatch(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.nav[data-s="watch"]')?.click();
  });
  await page.locator('section[data-p="watch"] .card.pane')
    .first().waitFor({ state: 'visible', timeout: 15_000 });
}

/**
 * **The rail button stops advertising a screen that now exists.** The badge is
 * computed from `Object.hasOwn(SCREENS, name)` in `app.js`'s `renderNav`, so
 * this fails until the loader is registered — and it is the one assertion here
 * that fails for a reason a screenshot cannot show, because the badge is nine
 * characters wide in a rail of twenty-one entries.
 */
test('the rail no longer badges watch as PROPOSED', async ({ app }) => {
  const badges = await app.page.locator('.nav[data-s="watch"] .prop').count();
  expect(badges, 'watch has a module now; the rail must stop saying it is proposed')
    .toBe(0);
});

/**
 * **The screen draws its own furniture, and the live region SAYS something.**
 *
 * `#alive` is an `aria-live="polite"` region. An empty one is the worst
 * possible state: a screen reader announces nothing, and a sighted reader sees
 * a stream that may be connected, may be waiting, may have faulted — the four
 * states `watch.shown` / `watch.streamWaiting` / `watch.streamFault` /
 * `watch.resync` exist precisely because "a stream with nothing arriving looks
 * broken, a stream that stops looks correct".
 */
test('the audit stream screen draws its pulse, its filters and a live region that speaks', async ({ app }) => {
  const { page } = app;
  await showWatch(page);
  const read = () => page.evaluate(() => {
    const section = document.querySelector<HTMLElement>('section[data-p="watch"]');
    const alive = section?.querySelector<HTMLElement>('#alive') ?? null;
    return {
      pulse: section?.querySelector('#pulse') !== null,
      filters: section?.querySelector('#wfilters button') !== null,
      table: section?.querySelector('#atbl') !== null,
      aliveLive: alive?.getAttribute('aria-live') ?? null,
      aliveSaid: (alive?.innerText ?? '').trim().length,
      text: (section?.innerText ?? '').trim().length,
    };
  });
  // POLLED, for the reason the boot assertion above is: the card is appended
  // before the screen's first /api call resolves, so sampling once measures
  // whether the fetch happened to have returned. retries are 0 by policy here,
  // so that is not flake — it is a wrong test.
  await expect
    .poll(async () => (await read()).text, {
      message: 'the watch screen never rendered more than its heading',
      timeout: 10_000,
    })
    .toBeGreaterThan(200);
  const shape = await read();
  expect(shape, 'the watch screen must draw the mockup’s pulse, filter row, table and live region')
    .toMatchObject({ pulse: true, filters: true, table: true, aliveLive: 'polite' });
  expect(shape.aliveSaid, 'the aria-live region rendered empty — it has four states and must be in one')
    .toBeGreaterThan(0);
  expect(shape.text, 'the screen rendered little more than its heading').toBeGreaterThan(200);
});

/**
 * **No element paints `rgb(240, 240, 240)`.**
 *
 * That colour is the UA's `buttonface`: a `<button>` with no rule matching it.
 * It is not a hypothetical here — 957 of them were measured on the coverage
 * screen on 2026-08-22, a wall of white rectangles 5,843px tall, and the
 * stopgap element rule in `styles.css` was written for exactly that. This
 * screen is the next place it could happen: the filter row is one `<button>`
 * per audit kind, DERIVED from the server rather than written down, so a kind
 * that arrives later arrives as a new button nobody styled.
 *
 * Asserted over the whole document while `watch` is showing, not over the
 * section alone, so the rail and the header are covered by the same sweep.
 */
test('nothing on the audit stream screen paints the UA buttonface', async ({ app }) => {
  const { page } = app;
  await showWatch(page);
  const bare = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (getComputedStyle(el).backgroundColor !== 'rgb(240, 240, 240)') continue;
      out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} "${(el.textContent ?? '').slice(0, 20)}"`);
    }
    return out.slice(0, 8);
  });
  expect(bare, 'these elements fell back to the UA button chrome — a bare <button> ' +
    'draws nothing of its own, see styles.css’s stopgap rule').toEqual([]);
});

/**
 * **The pulse fills its plate's CONTENT box exactly.**
 *
 * `.pulse` is a fixed 34px box, and `.pulse.plate` spends 12px of padding on
 * each side of it plus a 1px border — so the chart's own area is **eight
 * pixels**, and the 900x34 viewBox is squeezed into it by
 * `preserveAspectRatio="none"`. That is not a defect to be asserted away: the
 * design of record draws its own pulse at exactly the same eight, measured in
 * both files on 2026-08-22 (`#pulse` host 34, svg 8, padding 12px 13px,
 * box-sizing border-box, in the mockup and in the app alike).
 *
 * So the invariant is not a MINIMUM height — an earlier version of this
 * assertion demanded 20px, which the design itself fails — it is that the SVG
 * resolves to the box it is given. Both failure modes are silent: an unsized
 * inline SVG falls back to a 150px intrinsic height and overflows a plate that
 * clips it, losing its tallest columns; one that resolves to zero is a chart
 * that renders as nothing at all.
 */
test('the activity pulse fills its plate exactly, neither collapsed nor overflowing', async ({ app }) => {
  const { page } = app;
  await showWatch(page);
  const box = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('#pulse');
    if (host === null) return null;
    const svg = host.querySelector<SVGElement>('svg');
    const cs = getComputedStyle(host);
    return {
      hostH: Math.round(host.getBoundingClientRect().height),
      // The area the chart is actually given: `clientHeight` is inside the
      // border, and the plate's padding comes out of it too.
      contentH: host.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom),
      contentW: host.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
      svgH: svg === null ? null : svg.getBoundingClientRect().height,
      svgW: svg === null ? null : svg.getBoundingClientRect().width,
    };
  });
  expect(box, 'there is no #pulse element at all').not.toBeNull();
  expect(box!.hostH, 'the pulse plate collapsed').toBeGreaterThan(20);
  expect(box!.contentH, 'the plate left the chart no room at all').toBeGreaterThan(4);
  // The SVG is only drawn when the volume endpoint answers; when it refuses,
  // the plate carries the refusal beside it instead and there is no chart to
  // measure. Both are correct — what is not correct is a chart that misses its
  // box in either direction.
  if (box!.svgH !== null) {
    expect(Math.abs(box!.svgH! - box!.contentH),
      `the pulse SVG is ${box!.svgH}px in a ${box!.contentH}px content box — an inline SVG that ` +
      'does not resolve to its box falls back to a 150px intrinsic height and is clipped')
      .toBeLessThanOrEqual(1);
    expect(Math.abs(box!.svgW! - box!.contentW)).toBeLessThanOrEqual(1);
  }
});

/**
 * **`text-align: left` is a defect, not a style** (spec §3): a physical
 * direction draws correctly in English and backwards in Hebrew, and this
 * project ships both from one stylesheet. `start` is the same thing that
 * survives `dir="rtl"`.
 *
 * Swept over the whole document with `watch` showing, because the screen's own
 * table, its filter row and its regime rules are all new surfaces where a
 * physical value could enter — and because the UA sheet is where one usually
 * does.
 */
test('nothing on the audit stream screen resolves to a physical text-align', async ({ app }) => {
  const { page } = app;
  await showWatch(page);
  const physical = await page.evaluate(() => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>('*')) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const a = getComputedStyle(el).textAlign;
      if (a === 'left' || a === 'right') {
        out.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} -> ${a}`);
      }
    }
    return out.slice(0, 8);
  });
  expect(physical, 'a physical text-align mirrors wrongly in RTL — use start/end')
    .toEqual([]);
});
