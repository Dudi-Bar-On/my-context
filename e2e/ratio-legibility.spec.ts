/**
 * **"Selected, then not delivered" shows the WHOLE id, in both surfaces, and
 * still never scrolls the page sideways.**
 *
 * ── WHAT WAS MEASURED, AND IN WHICH SURFACE ────────────────────────────────
 *
 * Owner, 2026-08-28, from the running UI: *"budget simulator, selected not
 * delivered, the items is too short — extend them so the full text will be
 * seen"* (`plan:walk seq:47`, item 1).
 *
 * The task's own first question is whether that is a parity gap or a design
 * change, and the two take opposite fixes. Driven in a browser at 1280x720 —
 * the viewport this config pins — over `.demo-corpus` and over the design of
 * record, 2026-08-29, BEFORE the change:
 *
 *     surface   ids        `.div-name` track   needed        clipped
 *     app       58-66 ch   168px               452-515px     10 of 10
 *     mockup    29-35 ch   168px               226-273px      6 of 6
 *
 * **Both.** `.div-row`'s name track was `minmax(96px,168px)` byte-identically
 * in `styles.css` and in the mockup, and the design's OWN six fixtures already
 * ellipsised in it. So this is not the app diverging from the design — it is
 * the design unable to hold a real id, and the fix goes into the mockup first
 * with `styles.css` following, per `DEC-the-mockup-governs-presentation-never-
 * behaviour-and-a`. That is the same order `cap.warn` and `cfg.nocmd` moved in.
 *
 * It is also, again, the shape this corpus keeps recording: a layout validated
 * against fixtures a third the length of the data. `.div-name` carried a
 * `title` and the full text was always in the DOM, so nothing was lost — it was
 * unreadable without a hover, and every id in this corpus opens with a shared
 * type prefix, so the ~21 characters that survived the ellipsis were the least
 * distinguishing ones.
 *
 * ── WHAT WAS DECIDED, AND WHAT WAS REFUSED ─────────────────────────────────
 *
 * `plan:walk seq:47`'s ruling: a truncated row must not merely be WIDENED —
 * wrap, scroll in its own container, or bound it with a disclosure, and say
 * which. **It wraps.** `.div-name` drops `white-space:nowrap` and its ellipsis
 * and takes `overflow-wrap:anywhere`; the track cap moves 168px -> 288px, which
 * is the width at which a 67-character id (the longest this corpus holds, and
 * the length `e2e/bidi.spec.ts` already records as the reason a dangling-edge
 * row puts each id on its own line) lands on exactly two lines.
 *
 *   * NOT widened alone. 515px of a ~1,125px row would halve both bar halves,
 *     and the row would clip again on any narrower card. Widening is what makes
 *     the wrap land on two lines instead of four; it is not the fix by itself.
 *   * NOT a per-row scroller. Ten horizontal scrollbars put the content back
 *     behind an interaction, and a diverging bar whose whole point is
 *     comparison ACROSS rows stops aligning the moment each row scrolls.
 *   * NOT a disclosure. `title` is already the disclosure and it is exactly
 *     what failed: the owner was reading the screen, not hovering it.
 *
 * The four-column grammar survives, which matters because the legend row
 * underneath labels those columns — asserted below, not assumed. And because
 * the track is still `minmax(96px,…)` and the id may break at any character, a
 * narrow card spends a line rather than a horizontal scrollbar.
 *
 * ── WHY THIS IS A BROWSER SPEC AND NOT A STYLESHEET TEST ───────────────────
 *
 * `test/ui/styles-parity.test.ts` holds `.div-row` and `.div-name` byte-
 * identical in both files, and it would have passed against every one of the
 * three sizing fixes this thread got wrong. What it cannot see is whether a
 * rendered id FITS, which is a fact about a layout engine and a font. The
 * property asserted here is `scrollWidth <= clientWidth` on a real element —
 * the same measurement the defect was found with.
 */
import { expect, test } from './app.ts';
import type { Page } from '@playwright/test';
import { openMockup, showScreen } from './mockup.ts';
import { settleScreen } from './settle.ts';

const SIM = '[data-p="simulate"]';

/**
 * The longest id this corpus is known to hold. Below this the assertion is
 * VACUOUS — a name column that fits nothing still passes over short ids — so
 * the specs fail as themselves rather than passing over a corpus that cannot
 * exercise the defect.
 */
const LONG_ID = 55;

interface Name {
  readonly text: string;
  readonly chars: number;
  /** Rendered box, so a wrapped id reports the height its lines actually took. */
  readonly box: string;
  /** The property. False means some of the id is not on the screen. */
  readonly clipped: boolean;
}

/** Every `.div-name` on the visible screen, measured as rendered. */
function names(page: Page, scope: string): Promise<Name[]> {
  return page.evaluate((sel) => [...document.querySelectorAll(`${sel} .div-row .div-name`)]
    .map((el) => {
      const box = el.getBoundingClientRect();
      return {
        text: el.textContent ?? '',
        chars: (el.textContent ?? '').length,
        box: `${box.width.toFixed(1)}x${box.height.toFixed(1)}`,
        clipped: el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1,
      };
    }), scope) as Promise<Name[]>;
}

/** `documentElement` wider than the viewport, or null. The ruling's hard bound. */
function sidewaysScroll(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth > d.clientWidth ? `${d.scrollWidth}>${d.clientWidth}` : null;
  });
}

test('the app shows every spill-ratio id in full', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });
  // The rows arrive with `/api/watch/ratio`, which is a SECOND fetch after the
  // screen paints — `requires` is what makes this wait for the thing measured
  // rather than for the heading above it.
  const settled = await settleScreen(page, 'simulate', { requires: '.div-row .div-name' });
  expect(settled.settled,
    `the Budget simulator never settled (${settled.count} nodes, ${settled.inFlight} reads in ` +
    'flight). Measuring an unsettled screen reports a slow machine as a layout defect.',
  ).toBe(true);

  const measured = await names(page, SIM);
  expect(measured.length, 'no spill-ratio rows drew at all').toBeGreaterThan(0);

  const longest = Math.max(...measured.map((n) => n.chars));
  expect(longest,
    `the longest id on this screen is ${longest} characters. Under ${LONG_ID} this spec cannot ` +
    'see the defect it exists for — a 168px column passes over short ids — so it fails here ' +
    'rather than reporting a corpus as a fix.',
  ).toBeGreaterThanOrEqual(LONG_ID);

  const clipped = measured.filter((n) => n.clipped);
  expect(clipped.map((n) => `${n.text} (${n.chars} ch in ${n.box})`),
    'a spill-ratio id is still cut off. The owner asked for the full text to be visible on the ' +
    'screen; a `title` is not that.',
  ).toEqual([]);

  // The legend row under the bars labels the columns, so the columns have to
  // still BE columns. Its cells are compared to the first data row's by their
  // x offsets — the grid working, measured rather than assumed.
  const aligned = await page.evaluate((sel) => {
    const rows = [...document.querySelectorAll(`${sel} .div-row`)];
    const xs = (row: Element): number[] =>
      [...row.children].map((c) => Math.round(c.getBoundingClientRect().x));
    return { data: xs(rows[0]!), key: xs(rows[rows.length - 1]!) };
  }, SIM);
  expect(aligned.key,
    'the legend row stopped lining up with the bars it labels',
  ).toEqual(aligned.data);

  expect(await sidewaysScroll(page),
    'the widened name column pushed the page into a horizontal scroll, which `plan:walk seq:47` ' +
    'forbids outright',
  ).toBeNull();
});

test('the design of record shows its own spill-ratio ids in full', async ({ page }) => {
  // The mockup is where this change was made first, and a design that clips its
  // own fixtures is the app about to clip real ids again.
  await openMockup(page);
  await showScreen(page, 'simulate');
  await expect(page.locator(`${SIM} .div-row .div-name`).first()).toBeVisible();

  const measured = await names(page, SIM);
  expect(measured.length, 'the mockup drew no spill-ratio rows').toBeGreaterThan(0);
  expect(measured.filter((n) => n.clipped).map((n) => `${n.text} (${n.chars} ch in ${n.box})`),
    'the design of record clips its own ratio ids',
  ).toEqual([]);
  expect(await sidewaysScroll(page), 'the mockup scrolls sideways').toBeNull();
});
