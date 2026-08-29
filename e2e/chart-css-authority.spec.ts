/**
 * **`styles.css` is the only thing that styles a chart, and this measures that
 * on the rendered element rather than believing the source.**
 *
 * ── WHAT WENT WRONG, TWICE, IN ONE DAY ─────────────────────────────────────
 *
 * `screens/decay.js` restated the shell's `svg.chart` rules on the element
 * through the CSSOM. An inline declaration outranks the stylesheet AND the
 * mockup, and `styles-parity` compares those two byte for byte — so it is
 * blind, by construction, to a third copy applied at runtime. Green gate,
 * correct stylesheet, wrong page:
 *
 *   `plan:walk seq:62`  the four chart type sizes were restored behind new
 *                       tokens. The comb's inline `font-size` won, so it alone
 *                       would have kept the large type.
 *   `plan:walk seq:47`  `svg.chart` moved `inline-size:100%` →
 *                       `max-inline-size:100%`. The comb's inline copy won:
 *                       staircase 1.000, ego graph 1.000, comb **1.267**.
 *
 * ── WHY THIS FILE ASSERTS WHAT IT ASSERTS ──────────────────────────────────
 *
 * A test that greps `screens/decay.js` for `style.` would prove nothing about
 * the page: the same defect can be built by string concatenation, by a shared
 * helper, or by a screen nobody thought to grep. `scripts/check-cssom-
 * restatement.ts` is the source-level half and it says so about its own holes.
 * This half never reads a module. It measures COMPUTED values off the rendered
 * element, and it asks the only question that actually matters:
 *
 *     **if the stylesheet moves, does this chart move with it?**
 *
 * So the stylesheet is DRIVEN. A probe rule is appended to the shipped
 * `styles.css` through `insertRule` — the sheet's own cascade, not a new
 * `<style>` element, which `style-src 'self'` would refuse anyway — and every
 * chart on the screen must follow it. An element carrying its own copy of the
 * declaration will not, and that is the failure this file is for. The rules
 * are removed again afterwards; nothing is written to disk and no fixture is
 * edited.
 *
 * **The positive control is the point of the file, not a flourish.** The last
 * test puts the deleted restatement back on the live element and asserts the
 * probe STOPS binding. Without it, a probe that silently stopped applying — a
 * renamed stylesheet, a chart that never drew — would read exactly like a
 * clean page. Measured both ways against the live corpus on 2026-08-29:
 *
 *     clean       comb 617px wide, mono 9.5px  ->  probed 120px, mono 31px
 *     restated    comb 617px wide, mono 9.5px  ->  probed 617px, mono 9.5px
 *
 * `.pulse svg` is excluded by construction rather than by name, exactly as
 * `chart-scale.spec.ts` excludes it: the filter drops any chart whose own
 * rules give it a `block-size` other than `auto`, which is the activity pulse
 * and nothing else. It is a ribbon with no `<text>` at all.
 */
import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { test } from './app.ts';

/** The three screens that draw a fixed-viewBox chart. */
const CHART_SCREENS = ['simulate', 'graph', 'decay'] as const;

/** Values distinctive enough that no real rule could produce them by accident. */
const PROBE_TEXT_PX = 29;
const PROBE_MONO_PX = 31;
const PROBE_WIDTH_PX = 120;

interface Chart {
  readonly viewBox: string;
  /** The chart root's own computed box, all of it owned by `svg.chart{…}`. */
  readonly display: string;
  readonly maxInlineSize: string;
  readonly overflow: string;
  /** Rendered inline size, in CSS pixels. */
  readonly width: number;
  /** An unclassed `<text>`: what `svg.chart text{…}` alone decides. */
  readonly textFontSize: string | null;
  readonly textFontFamily: string | null;
  readonly textFill: string | null;
  /** A `<text class="mono">`, where the screen draws one. */
  readonly monoFontSize: string | null;
}

/** Every fixed-size `svg.chart` on the visible screen, measured. */
function measure(page: Page): Promise<Chart[]> {
  return page.evaluate(() => {
    const out: Chart[] = [];
    document.querySelectorAll('svg.chart').forEach((svg) => {
      const rect = svg.getBoundingClientRect();
      if (rect.width === 0) return;
      const cs = getComputedStyle(svg);
      if (cs.blockSize === '100%') return;
      const text = svg.querySelector('text:not([class])');
      const mono = svg.querySelector('text.mono');
      out.push({
        viewBox: svg.getAttribute('viewBox') ?? '',
        display: cs.display,
        maxInlineSize: cs.maxInlineSize,
        overflow: cs.overflow,
        width: Number(rect.width.toFixed(1)),
        textFontSize: text === null ? null : getComputedStyle(text).fontSize,
        textFontFamily: text === null ? null : getComputedStyle(text).fontFamily,
        textFill: text === null ? null : getComputedStyle(text).fill,
        monoFontSize: mono === null ? null : getComputedStyle(mono).fontSize,
      });
    });
    return out;
  }) as Promise<Chart[]>;
}

/**
 * Open a screen from the rail and come back when its chart is DRAWN.
 *
 * Polled on the MEASUREMENT rather than on an element, for the reason
 * `chart-scale.spec.ts` records: a screen's previous occupant leaves its own
 * `svg.chart` in the document at zero width, so waiting on a locator can
 * resolve against a chart on its way out while the new screen is still
 * fetching.
 */
async function chartsOn(page: Page, screen: string): Promise<Chart[]> {
  let charts: Chart[] = [];
  await expect
    .poll(async () => {
      // The click is INSIDE the poll and is guarded by the hash, so it fires
      // once and only re-fires if the route never took. A rail click issued
      // before `app.js` has wired the handler is a click that never happened,
      // and the whole timeout after it would be spent waiting for a navigation
      // nobody asked for.
      //
      // **It must not do more than that.** An earlier draft cleared the hash
      // first, to force a route that had been lost, and re-entering `route()`
      // on every poll tick started a fetch that cancelled the render before it
      // finished: under `--repeat-each=3` this file failed four times out of
      // eighteen and `chart-scale.spec.ts`, doing the plain thing, passed
      // twenty-four out of twenty-four. Retrying a render is not free.
      await page.evaluate((s) => {
        const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
        if (btn === null) throw new Error(`no rail button for screen ${s}`);
        if (location.hash !== `#/${s}`) btn.click();
      }, screen);
      charts = await measure(page);
      return charts.length;
    }, {
      timeout: 20_000,
      message:
        `${screen} never drew a chart, so nothing here was measured. Either the screen refused `
        + '(its endpoint answers a degraded corpus) or it broke — and neither is something this '
        + 'file may pass over: every assertion in it is a computed value off a rendered element.',
    })
    .toBeGreaterThan(0);
  return charts;
}

/**
 * The same measurement, polled without navigating.
 *
 * A screen redraws itself when the live stream says its data moved, and a
 * redraw empties the plate for a frame. Under parallel workers this file
 * measured exactly that and reported "the probe lost the chart" — a race in
 * the harness wearing the costume of the defect it hunts. Polling the
 * MEASUREMENT rather than snapshotting it once is the fix, and it cannot mask
 * a real failure: what it waits for is a chart existing, not a chart passing.
 */
async function charts(page: Page, why: string): Promise<Chart[]> {
  let seen: Chart[] = [];
  await expect
    .poll(async () => {
      seen = await measure(page);
      return seen.length;
    }, { timeout: 20_000, message: why })
    .toBeGreaterThan(0);
  return seen;
}

/** Append probe rules to the shipped stylesheet, run `body`, then remove them. */
async function underProbe<T>(page: Page, body: () => Promise<T>): Promise<T> {
  const installed = await page.evaluate(([textPx, monoPx, widthPx]) => {
    const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
    if (sheet === undefined) {
      throw new Error(
        'the shipped styles.css is not among document.styleSheets, so there is no sheet to '
        + 'drive. This is a broken probe, not a clean page: fail rather than report green.',
      );
    }
    const rules = [
      `svg.chart{max-inline-size:${widthPx}px}`,
      `svg.chart text{font-size:${textPx}px}`,
      `svg.chart text.mono{font-size:${monoPx}px}`,
    ];
    for (const rule of rules) sheet.insertRule(rule, sheet.cssRules.length);
    return rules.length;
  }, [PROBE_TEXT_PX, PROBE_MONO_PX, PROBE_WIDTH_PX]);
  try {
    return await body();
  } finally {
    await page.evaluate((n) => {
      const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
      if (sheet === undefined) return;
      for (let i = 0; i < n; i += 1) sheet.deleteRule(sheet.cssRules.length - 1);
    }, installed);
  }
}

test('every chart reads its box and its type from the same stylesheet', async ({ app }) => {
  const seen: Record<string, Chart[]> = {};
  for (const screen of CHART_SCREENS) seen[screen] = await chartsOn(app.page, screen);

  const evidence = Object.entries(seen)
    .flatMap(([screen, charts]) => charts.map(
      (c) => `${screen} ${c.viewBox} display=${c.display} max=${c.maxInlineSize} `
        + `overflow=${c.overflow} text=${c.textFontSize}/${c.textFill}`,
    ))
    .join(' | ');

  // The comb is the one that carried a private copy of all of this. Every
  // number below is the stylesheet's, so every chart must report the same.
  const all = Object.values(seen).flat();
  for (const chart of all) {
    expect(chart.display, `a chart's display is not the stylesheet's: ${evidence}`).toBe('block');
    expect(chart.maxInlineSize, `a chart's scale bound is not the stylesheet's: ${evidence}`).toBe('100%');
    expect(chart.overflow, `a chart's overflow is not the stylesheet's: ${evidence}`).toBe('visible');
  }

  const typed = all.filter((c) => c.textFontSize !== null);
  expect(typed.length, `no chart drew an unclassed <text>: ${evidence}`).toBeGreaterThanOrEqual(2);
  const sizes = new Set(typed.map((c) => c.textFontSize));
  const families = new Set(typed.map((c) => c.textFontFamily));
  const fills = new Set(typed.map((c) => c.textFill));
  expect(
    [...sizes],
    'the charts disagree on --fs-chart, which can only mean one of them is not reading it from '
    + `styles.css: ${evidence}`,
  ).toHaveLength(1);
  expect([...families], `the charts disagree on the chart font: ${evidence}`).toHaveLength(1);
  expect([...fills], `the charts disagree on the chart ink: ${evidence}`).toHaveLength(1);
});

/**
 * One test PER SCREEN rather than one loop over three.
 *
 * Not cosmetic. A test that opens three screens and probes each spends three
 * server round trips inside a single 30-second budget, and under four parallel
 * workers this machine loses that race often enough to matter — the failure
 * arrives as "never drew a chart", which is contention wearing the costume of
 * the defect. Split, each screen gets its own budget and a failure names the
 * screen in its title instead of in a string.
 */
for (const screen of CHART_SCREENS) {
  test(`a change to styles.css moves the ${screen} chart with it`, async ({ app }) => {
    const before = await chartsOn(app.page, screen);
    const after = await underProbe(
      app.page,
      () => charts(app.page, `${screen}: the probe lost the chart it was measuring`),
    );
    expect(after.length, `${screen}: the probe lost a chart it was measuring`).toBe(before.length);

    for (const [i, chart] of after.entries()) {
      const was = before[i]!;
      expect(
        chart.width,
        `${screen}: the stylesheet bounded svg.chart at ${PROBE_WIDTH_PX}px and this chart `
        + `stayed at ${chart.width}px (was ${was.width}px, viewBox ${chart.viewBox}). It is `
        + 'carrying its own inline copy of a declaration styles.css owns, which is exactly how '
        + 'the recency comb rendered at 1.267 while the other two rendered 1:1 — with a green '
        + 'styles-parity, because that gate compares rule bodies and cannot see a third copy '
        + 'applied at runtime.',
      ).toBeLessThanOrEqual(PROBE_WIDTH_PX);

      if (was.textFontSize !== null) {
        expect(
          chart.textFontSize,
          `${screen}: the stylesheet moved svg.chart text to ${PROBE_TEXT_PX}px and this chart's `
          + `text stayed at ${chart.textFontSize} (was ${was.textFontSize}). This is plan:walk `
          + 'seq:62: one chart keeping the old type while every other chart shrank.',
        ).toBe(`${PROBE_TEXT_PX}px`);
      }
      if (was.monoFontSize !== null) {
        expect(
          chart.monoFontSize,
          `${screen}: the stylesheet moved svg.chart text.mono to ${PROBE_MONO_PX}px and the ids `
          + `stayed at ${chart.monoFontSize} (was ${was.monoFontSize}).`,
        ).toBe(`${PROBE_MONO_PX}px`);
      }
    }
  });
}

test('the probe can still fail — the restatement put back, and detected', async ({ app }) => {
  // Without this, a probe that had quietly stopped applying would read exactly
  // like a page with nothing to find. So the defect is recreated on the live
  // element, in the deleted code's own words, and the test above is shown
  // going red against it.
  await chartsOn(app.page, 'decay');
  const restated = await underProbe(app.page, async () => {
    // Wait for the comb to be settled under the probe FIRST, so the element the
    // restatement lands on is the one that gets measured — a redraw between the
    // two would silently measure a clean chart and pass for the wrong reason.
    await charts(app.page, 'the comb vanished under the probe, before the control could be set');
    await app.page.evaluate(() => {
      const svg = document.querySelector<SVGElement>('svg.chart');
      if (svg === null) throw new Error('the comb is not on the page');
      // `screens/decay.js` as it stood before 2026-08-29, verbatim.
      svg.style.setProperty('max-inline-size', '100%');
      svg.querySelectorAll<SVGElement>('text.mono').forEach((t) => {
        t.style.setProperty('font-size', 'var(--fs-chart-mono)');
      });
    });
    return measure(app.page);
  });
  await app.page.evaluate(() => {
    const svg = document.querySelector<SVGElement>('svg.chart');
    svg?.style.removeProperty('max-inline-size');
    svg?.querySelectorAll<SVGElement>('text.mono').forEach((t) => t.style.removeProperty('font-size'));
  });

  const comb = restated[0];
  expect(comb, 'the comb was not measured under the restatement').toBeDefined();
  expect(
    comb!.width,
    'the restatement was put back and the chart obeyed the stylesheet anyway — which means the '
    + 'probe is not binding and the test above proves nothing. Fix the probe, not this line.',
  ).toBeGreaterThan(PROBE_WIDTH_PX);
  if (comb!.monoFontSize !== null) {
    expect(comb!.monoFontSize, 'the inline font-size did not win, so the probe is not binding')
      .not.toBe(`${PROBE_MONO_PX}px`);
  }
});
