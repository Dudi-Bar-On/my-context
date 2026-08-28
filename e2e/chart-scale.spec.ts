/**
 * **Every chart draws at 1:1 — one viewBox unit is one CSS pixel — in BOTH
 * surfaces, and no chart is stretched by a factor of its own.**
 *
 * ── WHAT WENT WRONG, MEASURED ──────────────────────────────────────────────
 *
 * `svg.chart{inline-size:100%}` stretched every fixed viewBox into whatever
 * width its card happened to give it. The text does NOT stretch with it — it is
 * CSS px — so a `--fs-chart` label nominally 10px drew at a different SIZE on
 * every screen, decided by nothing but how wide that screen's card was.
 * Measured in a browser at 1440x900 over `.demo-corpus`, 2026-08-29:
 *
 *     staircase      viewBox 560x214    rendered 896x342     1.600
 *     ego graph      viewBox 900x250    rendered 1140x317    1.267
 *     recency comb   viewBox 900x2008   rendered 1140x2544   1.267
 *
 * Owner, 2026-08-28: *"the decay and relation graphics should become smaller
 * fonts and scale down, this also implies to the budget simulator too."* The
 * fonts were the half already landed (`--fs-chart` and its three siblings, at
 * `plan:walk seq:62`); **this is the other half, and it is the one that makes
 * the tokens mean what they say** — shrinking a token that is then multiplied
 * by 1.6 on one screen and 1.267 on two others only changes what gets
 * multiplied.
 *
 * ── WHY A BROWSER, AND NOT ARITHMETIC ──────────────────────────────────────
 *
 * The number this asserts is the ratio of a RENDERED width to a viewBox width,
 * and nothing outside a layout engine knows the first of those. Three fixes
 * were attempted on these graphics from measurements alone and all three were
 * wrong; the ledger of that is in the task (`plan:walk seq:47`). A unit test
 * over `styles.css` bytes would have passed against every one of them.
 *
 * ── WHY BOTH SURFACES ──────────────────────────────────────────────────────
 *
 * Chart size is PRESENTATION, so it is the mockup's
 * (`DEC-the-mockup-governs-presentation-never-behaviour-and-a`): the design of
 * record was edited first and the app follows. `styles-parity` already holds
 * the RULE byte-identical — what it cannot see is whether the two files
 * RENDER the same, because `screens/decay.js` restates `svg.chart{…}` on the
 * element through the CSSOM and an inline `inline-size:100%` there beats the
 * stylesheet. It did, and it pinned that one chart at 1.267x while the other
 * two came back at 1:1 — green stylesheet, wrong page. So both surfaces are
 * driven, and the assertion is the same number in each.
 *
 * ── AND WHY THE FUNCTIONING HALF IS HERE TOO ───────────────────────────────
 *
 * *"Usability means functioning correctly."* A chart that is legible and
 * reports the wrong thing is not fixed, and every disclosure on these three is
 * a `+N` drawn in viewBox units that a scale change moves relative to its own
 * type. So each screen also asserts the omission it must still be able to say
 * out loud: the staircase's `+N more evictions` (`plan:walk seq:62`'s density
 * fix), the ego graph's `+N more` at the 60-node cap (`gr.sub` promises it),
 * and that the comb still draws one tooth per row rather than a bucket.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './app.ts';
import { openMockup } from './mockup.ts';

/** The three screens the owner named. The pulse is deliberately not one — see below. */
const CHART_SCREENS = ['simulate', 'decay', 'graph'] as const;

interface Measured {
  /** `rendered inline size ÷ viewBox width`. The whole subject of this file. */
  readonly scale: number;
  readonly viewBox: string;
  readonly rendered: string;
  /** The card the chart sits in. A chart wider than this would clip or scroll. */
  readonly plate: number;
  readonly plateScrollsX: boolean;
}

/**
 * Every `svg.chart` on the visible screen, measured.
 *
 * `.pulse svg` is EXCLUDED by construction rather than by name: the filter
 * drops any chart whose own rules give it a `block-size` other than `auto`,
 * which is exactly the activity pulse and nothing else. The pulse is a ribbon
 * with `preserveAspectRatio: none` and **no `<text>` at all**, so there is no
 * type on it for a scale factor to distort — and its 34-unit box rendering
 * into eight device pixels is the design of record's own measured intent
 * (`screens/watch.js`, and `#pulse` renders at the same eight in the mockup).
 * Asserting 1:1 on it would assert the opposite of what it is for.
 */
async function charts(page: Page): Promise<Measured[]> {
  return page.evaluate(() => {
    const out: Measured[] = [];
    document.querySelectorAll('svg.chart').forEach((svg) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      if (getComputedStyle(svg).blockSize === '100%') return;
      const box = (svg.getAttribute('viewBox') ?? '').split(/\s+/).map(Number);
      const plate = svg.parentElement as HTMLElement;
      out.push({
        scale: Number((rect.width / (box[2] ?? 1)).toFixed(3)),
        viewBox: svg.getAttribute('viewBox') ?? '',
        rendered: `${rect.width.toFixed(1)}x${rect.height.toFixed(1)}`,
        plate: Number(plate.getBoundingClientRect().width.toFixed(1)),
        plateScrollsX: plate.scrollWidth > plate.clientWidth + 1,
      });
    });
    return out;
  }) as Promise<Measured[]>;
}

/** The `<text>` this chart draws, flattened — the disclosures live in here. */
function chartText(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll('svg.chart text')].map((t) => t.textContent ?? ''));
}

/**
 * Open a screen from the rail and come back when its chart is DRAWN.
 *
 * **Polled rather than awaited once, and that is not belt-and-braces.** A
 * screen's previous occupant leaves its own `svg.chart` in the document at zero
 * width, so `toBeVisible()` on the last one can resolve against a chart that is
 * on its way out while the new screen is still fetching. Measured failing
 * exactly once under four parallel workers on the `chrome` project, and green
 * alone — the signature of every spec on this directory's contention list. A
 * poll on the MEASUREMENT rather than on an element is the fix: it cannot
 * resolve until the thing this file asserts about exists.
 */
async function chartsOn(page: Page, screen: string): Promise<Measured[]> {
  await page.evaluate((s) => {
    const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
    if (btn === null) throw new Error(`no rail button for screen ${s}`);
    btn.click();
  }, screen);
  let measured: Measured[] = [];
  await expect
    .poll(async () => {
      measured = await charts(page);
      return measured.length;
    }, {
      timeout: 20_000,
      message:
        `${screen} never drew a chart. Either the screen refused (its endpoint answers a ` +
        'degraded corpus) or it broke — both are visible in the trace, and neither is ' +
        'something this file may pass over: the whole assertion is a rendered width.',
    })
    .toBeGreaterThan(0);
  return measured;
}

test('the app draws every chart at 1:1, never a factor of its own', async ({ app }) => {
  const seen: string[] = [];
  for (const screen of CHART_SCREENS) {
    const measured = await chartsOn(app.page, screen);
    for (const chart of measured) {
      seen.push(`${screen} ${chart.viewBox} -> ${chart.rendered} = ${chart.scale}`);
      // The chart never grows past its own viewBox. Below the design width the
      // cap binds and it shrinks instead, which is the only case where the
      // factor is not 1 — and it can only ever be SMALLER, so a token never
      // renders larger than the number it states.
      expect(
        chart.scale,
        `${screen}: a chart is stretched past its own viewBox — ${chart.viewBox} rendered ` +
        `${chart.rendered} in a ${chart.plate}px plate. That is the defect this file exists ` +
        `for: the text does not stretch with the box, so --fs-chart stops meaning 10px. ` +
        `All measured: ${seen.join(' | ')}`,
      ).toBeLessThanOrEqual(1);
      expect(chart.scale, `${screen}: chart is not 1:1 — ${seen.join(' | ')}`).toBe(1);
      // Bounding must not buy the scale back with a scroll. `plan:walk seq:47`
      // names this outright for the comb, which is 2,008 units tall.
      expect(chart.plateScrollsX, `${screen}: the chart's own plate scrolls sideways`).toBe(false);
    }
  }
  // Every screen agreeing on 1 is the invariant; the list is the evidence.
  expect(seen.length, seen.join(' | ')).toBeGreaterThanOrEqual(CHART_SCREENS.length);

  const overflow = await app.page.evaluate(() => {
    const d = document.documentElement;
    return d.scrollWidth > d.clientWidth ? `${d.scrollWidth}>${d.clientWidth}` : null;
  });
  expect(overflow, 'a chart pushed the page into a horizontal scroll').toBeNull();
});

test('the design of record draws its own charts at the same 1:1', async ({ page }) => {
  await openMockup(page);
  for (const screen of CHART_SCREENS) {
    const measured = await chartsOn(page, screen);
    for (const chart of measured) {
      expect(
        chart.scale,
        `the mockup's ${screen} chart is not 1:1 — ${chart.viewBox} rendered ${chart.rendered}. ` +
        'The app follows this file, so a stretched chart here is the app about to be stretched.',
      ).toBe(1);
    }
  }
});

test('the staircase still discloses the evictions it did not label', async ({ app }) => {
  await chartsOn(app.page, 'simulate');
  const text = await chartText(app.page);
  // `.demo-corpus` sweeps hundreds of rungs, so the callout cap binds and the
  // remainder MUST be said. This is `plan:walk seq:62`'s density fix, and it is
  // asserted here because it is drawn in viewBox units — the units this file
  // just changed the meaning of.
  expect(
    text.some((t) => /^\+[\d,]+ more evictions$/.test(t)),
    `no "+N more evictions" on the staircase over the demo corpus; drawn text: ${text.join('|')}`,
  ).toBe(true);
  // Three at most, or they have stopped being callouts. The cap is CALLOUTS in
  // screens/simulate.js and the sketch's own rule: annotate the notable.
  expect(text.filter((t) => t === 'eviction').length).toBeLessThanOrEqual(3);
});

test('the ego graph keeps its 60-node cap and says what it refused', async ({ app }) => {
  // The demo corpus's first item has no relations, so the cap cannot fire over
  // it — and a cap asserted only where it never binds is not asserted. The
  // response is served instead: `/api/graph`'s own body shape, capped at
  // GRAPH_NODE_CAP with `omitted` set, which is exactly what the endpoint sends
  // when the walk found more. What is under test is the DRAWING of that answer.
  const focus = 'CONST-a-synthetic-focus-for-the-cap';
  await app.page.route('**/api/graph*', async (route) => {
    const nodes = [{ id: focus, title: 'focus', type: 'constraint', status: 'active', missing: false }];
    const edges = [];
    for (let i = 0; i < 59; i += 1) {
      const id = `RULE-a-synthetic-neighbour-number-${String(i).padStart(3, '0')}`;
      nodes.push({ id, title: 't', type: 'rule', status: 'active', missing: i % 11 === 0 });
      const inbound = i % 2 === 0;
      edges.push({
        from: inbound ? id : focus,
        to: inbound ? focus : id,
        type: i % 3 === 0 ? 'constrains' : 'relates_to',
        dangling: i % 11 === 0,
        loadBearing: i % 3 === 0,
      });
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ focus, nodes, edges, omitted: 147 }),
    });
  });
  const measured = await chartsOn(app.page, 'graph');

  // 60 nodes plus the "+N more" node that stands in the column it was cut from.
  await expect(app.page.locator('svg.chart rect.node')).toHaveCount(61);
  await expect(app.page.locator('svg.chart rect.node.more')).toHaveCount(1);
  expect(await chartText(app.page)).toContain('+147 more');

  // And the taller drawing is still 1:1 and still inside its plate.
  for (const chart of measured) {
    expect(chart.scale, `a 60-node ego graph is not 1:1: ${chart.rendered}`).toBe(1);
    expect(chart.plateScrollsX).toBe(false);
  }
});
