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

/**
 * The comb, scoped the way `measure` is: the decay screen's own section, not
 * whichever `svg.chart` happens to be first in a document that keeps every
 * screen it has ever drawn.
 */
const COMB = '#screen [data-p="decay"]:not([hidden]) svg.chart';

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

/**
 * Every fixed-size `svg.chart` **inside `screen`'s own section**, measured.
 *
 * ── IT WAS NOT SCOPED, AND SO IT MEASURED ONE CHART THREE TIMES ────────────
 *
 * `app.js` builds a section per screen inside `#screen` and hides the ones
 * that are not current (`for (const other of body.querySelectorAll('[data-p]'))
 * other.hidden = other !== section`), so a routed-away screen's chart stays in
 * the document. A bare `document.querySelectorAll('svg.chart')` reaches it, and
 * the zero-width guard below does not save a poll that runs in the same turn as
 * the click: the outgoing screen is still laid out.
 *
 * Every per-screen test in this file opens ONE screen on a fresh page, so none
 * of them could see it. The first test walks all three on one page, and it was
 * reading the staircase three times over. Its own failure message printed the
 * proof and nobody had a reason to look at it:
 *
 *     simulate 0 0 560 214 | graph 0 0 560 214 | decay 0 0 560 214
 *
 * — three screens, one viewBox, and the comb is 900 wide. Scoping the query to
 * `[data-p="<screen>"]:not([hidden])` is what makes "all three screens agree"
 * a statement about three screens.
 */
function measure(page: Page, screen: string): Promise<Chart[]> {
  return page.evaluate((s) => {
    const out: Chart[] = [];
    document.querySelectorAll(`#screen [data-p="${s}"]:not([hidden]) svg.chart`).forEach((svg) => {
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
  }, screen) as Promise<Chart[]>;
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
      charts = await measure(page, screen);
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
async function charts(page: Page, screen: string, why: string): Promise<Chart[]> {
  let seen: Chart[] = [];
  await expect
    .poll(async () => {
      seen = await measure(page, screen);
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
      () => charts(app.page, screen, `${screen}: the probe lost the chart it was measuring`),
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
    await charts(app.page, 'decay', 'the comb vanished under the probe, before the control could be set');
    await app.page.evaluate((comb) => {
      const svg = document.querySelector<SVGElement>(comb);
      if (svg === null) throw new Error('the comb is not on the page');
      // `screens/decay.js` as it stood before 2026-08-29, verbatim.
      svg.style.setProperty('max-inline-size', '100%');
      svg.querySelectorAll<SVGElement>('text.mono').forEach((t) => {
        t.style.setProperty('font-size', 'var(--fs-chart-mono)');
      });
    }, COMB);
    return measure(app.page, 'decay');
  });
  await app.page.evaluate((comb) => {
    const svg = document.querySelector<SVGElement>(comb);
    svg?.style.removeProperty('max-inline-size');
    svg?.querySelectorAll<SVGElement>('text.mono').forEach((t) => t.style.removeProperty('font-size'));
  }, COMB);

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

/* ── PER-MARK COLOUR, WHICH THE SHARED TEXT RULE USED TO ERASE ──────────────
 *
 * `svg.chart text{fill:var(--dim)}` is an AUTHOR rule. A `fill=` on a `<text>`
 * is a PRESENTATION attribute, and presentation attributes lose to author
 * rules — so for six days every per-mark colour the charts drew was computed,
 * written into the DOM, and then thrown away by the cascade. Measured on the
 * live corpus 2026-08-29, before the fix:
 *
 *     decay     `window 20`   asked var(--warn)   rendered rgb(169,166,184)
 *     decay     `never`       asked var(--crit)   rendered rgb(169,166,184)
 *     decay     109 ids       asked var(--ink)    rendered rgb(169,166,184)
 *     simulate  `16,000`      asked var(--gold)   rendered rgb(169,166,184)
 *
 * 112 marks asking for a colour, 112 rendering the same grey.
 *
 * **So these tests assert the COMPUTED fill of a named mark, never the
 * presence of a rule.** Grepping `screens/decay.js` for `var(--warn)` was true
 * the whole time the chart was grey; it is the one thing that proves nothing
 * here. The token values are not hardcoded either — they are resolved from the
 * live sheet through a probe element, so a theme that redefines `--warn` moves
 * the expectation with it instead of reddening the gate.
 */

/** The five colours a chart mark may spend, resolved from the live sheet. */
function tokens(page: Page): Promise<Record<string, string>> {
  return page.evaluate((names) => {
    // A span coloured through the CSSOM: custom properties inherit from
    // `:root`, so this reads what the SHEET means by `--warn` right now rather
    // than what a test file remembers it meaning.
    const probe = document.createElement('span');
    probe.setAttribute('aria-hidden', 'true');
    document.body.append(probe);
    const out: Record<string, string> = {};
    for (const name of names) {
      probe.style.setProperty('color', `var(--${name})`);
      out[name] = getComputedStyle(probe).color;
    }
    probe.remove();
    return out;
  }, ['dim', 'ink', 'warn', 'crit', 'gold']) as Promise<Record<string, string>>;
}

interface Mark {
  /** The `class` attribute exactly as the screen wrote it, `''` when unclassed. */
  readonly cls: string;
  /** A `fill=` presentation attribute, which no mark may carry any more. */
  readonly fillAttr: string | null;
  readonly fill: string;
  readonly text: string;
}

/** Every `<text>` on `screen`'s own fixed-size charts, with its computed fill. */
function textMarks(page: Page, screen: string): Promise<Mark[]> {
  return page.evaluate((s) => {
    const out: Mark[] = [];
    document.querySelectorAll(`#screen [data-p="${s}"]:not([hidden]) svg.chart`).forEach((svg) => {
      // The same two exclusions `measure()` makes, for the same two reasons: a
      // routed-away screen leaves its chart in the document at zero width, and
      // `.pulse svg` is excluded by its own `block-size` rather than by name.
      // The pulse draws no `<text>` at all, so it contributes nothing either way.
      if (svg.getBoundingClientRect().width === 0) return;
      if (getComputedStyle(svg).blockSize === '100%') return;
      svg.querySelectorAll('text').forEach((t) => {
        out.push({
          cls: t.getAttribute('class') ?? '',
          fillAttr: t.getAttribute('fill'),
          fill: getComputedStyle(t).fill,
          text: (t.textContent ?? '').slice(0, 32),
        });
      });
    });
    return out;
  }, screen) as Promise<Mark[]>;
}

/** The poll-on-the-measurement `chartsOn` uses, for labels rather than boxes. */
async function marksOn(page: Page, screen: string): Promise<Mark[]> {
  let seen: Mark[] = [];
  await expect
    .poll(async () => {
      await page.evaluate((s) => {
        const btn = document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`);
        if (btn === null) throw new Error(`no rail button for screen ${s}`);
        if (location.hash !== `#/${s}`) btn.click();
      }, screen);
      seen = await textMarks(page, screen);
      return seen.length;
    }, {
      timeout: 20_000,
      message:
        `${screen} never drew a chart label, so nothing here was measured. Either the screen `
        + 'refused or it broke, and neither is something this file may pass over.',
    })
    .toBeGreaterThan(0);
  return seen;
}

/**
 * The colour a mark's CLASS asks for — the whole vocabulary, in one place.
 *
 * `nid more` is read before `nid` because that is what the stylesheet says
 * (`svg.chart text.nid.more` is more specific than `svg.chart text.nid`); a
 * table that read them the other way round would agree with a page whose rules
 * were in the wrong order.
 */
function asks(cls: string): string {
  const has = (c: string): boolean => cls.split(/\s+/).includes(c);
  if (has('nid') && has('more')) return 'warn';
  if (has('warn')) return 'warn';
  if (has('crit')) return 'crit';
  if (has('gold')) return 'gold';
  if (has('ink') || has('nid')) return 'ink';
  // `.rel` and every unclassed mark: the shared rule's own `--dim`, which this
  // fix deliberately did not move — the reason it is a class list and not a
  // deletion of that declaration.
  return 'dim';
}

interface Placed extends Mark { readonly screen: string }

function evidenceOf(marks: readonly Placed[]): string {
  return marks
    .map((m) => `${m.screen} ${JSON.stringify(m.text)} class=${JSON.stringify(m.cls)} `
      + `asks --${asks(m.cls)} renders ${m.fill}`)
    .join(' | ');
}

test('every chart mark renders the colour its class asks for', async ({ app }) => {
  const want = await tokens(app.page);
  const all: Placed[] = [];
  for (const screen of CHART_SCREENS) {
    for (const mark of await marksOn(app.page, screen)) all.push({ screen, ...mark });
  }

  // **The defect's own shape, as a regression guard.** A `fill=` attribute on a
  // `<text>` cannot win against `svg.chart text{fill:…}`, so writing one is
  // writing a colour the reader will never see.
  const attributed = all.filter((m) => m.fillAttr !== null);
  expect(
    attributed.length,
    'a chart wrote a mark\'s colour as a `fill` presentation attribute, which loses to the '
    + 'author rule `svg.chart text{fill:var(--dim)}` and renders grey. Put a class on the mark '
    + `and a rule in styles.css instead: ${evidenceOf(attributed)}`,
  ).toBe(0);

  const wrong = all.filter((m) => m.fill !== want[asks(m.cls)]);
  expect(
    wrong.length,
    `a chart mark did not render the colour its class asks for: ${evidenceOf(wrong)}`,
  ).toBe(0);

  // Presence, per kind. Without it the assertion above passes on a page that
  // drew no coloured mark at all, which is exactly the state being fixed.
  const kinds = [...new Set(all.map((m) => asks(m.cls)))];
  for (const kind of ['warn', 'crit', 'ink', 'gold', 'dim']) {
    expect(
      kinds,
      `no visible chart mark spends --${kind}, so nothing here proved it renders: `
      + evidenceOf(all),
    ).toContain(kind);
  }

  // And the three screens agree about the unclassed default.
  const defaults = [...new Set(all.filter((m) => asks(m.cls) === 'dim').map((m) => m.fill))];
  expect(
    defaults,
    `the chart screens disagree about the unclassed default: ${evidenceOf(all)}`,
  ).toEqual([want.dim]);
});

/** `underProbe`'s shape for one rule: the crit tone driven to a chosen value. */
async function underCritProbe<T>(page: Page, colour: string, body: () => Promise<T>): Promise<T> {
  await page.evaluate((c) => {
    const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
    if (sheet === undefined) {
      throw new Error(
        'the shipped styles.css is not among document.styleSheets, so there is no sheet to '
        + 'drive. This is a broken probe, not a clean page: fail rather than report green.',
      );
    }
    sheet.insertRule(`svg.chart text.crit{fill:${c}}`, sheet.cssRules.length);
  }, colour);
  try {
    return await body();
  } finally {
    await page.evaluate(() => {
      const sheet = [...document.styleSheets].find((s) => (s.href ?? '').endsWith('/styles.css'));
      if (sheet === undefined) return;
      sheet.deleteRule(sheet.cssRules.length - 1);
    });
  }
}

test('the stylesheet still owns a mark colour — driven, not read', async ({ app }) => {
  // The test above would pass just as well if the colours came back as
  // attributes. This one moves the SHEET and requires the marks to follow: an
  // element carrying its own copy would not, which is the method of this file.
  const PROBE_CRIT = 'rgb(1, 2, 3)';
  const before = await marksOn(app.page, 'decay');
  expect(
    before.filter((m) => asks(m.cls) === 'crit').length,
    'the comb drew no --crit mark, so the probe below would prove nothing',
  ).toBeGreaterThan(0);

  const want = await tokens(app.page);
  const after = await underCritProbe(app.page, PROBE_CRIT, async () => {
    let seen: Mark[] = [];
    await expect
      .poll(async () => { seen = await textMarks(app.page, 'decay'); return seen.length; },
        { timeout: 20_000, message: 'the probe lost the comb it was measuring' })
      .toBeGreaterThan(0);
    return seen;
  });

  const placed = after.map((m) => ({ screen: 'decay', ...m }));
  const crit = placed.filter((m) => asks(m.cls) === 'crit');
  expect(crit.length, `the probe lost the comb's --crit marks: ${evidenceOf(placed)}`)
    .toBeGreaterThan(0);
  for (const mark of crit) {
    expect(
      mark.fill,
      `the stylesheet moved svg.chart text.crit to ${PROBE_CRIT} and this mark did not follow, `
      + `so it is carrying its own copy of a colour styles.css owns: ${evidenceOf(placed)}`,
    ).toBe(PROBE_CRIT);
  }
  for (const mark of placed.filter((m) => asks(m.cls) === 'dim')) {
    expect(
      mark.fill,
      'an unclassed mark moved with a rule that names .crit, so the classes are not doing the '
      + `work this fix says they do: ${evidenceOf(placed)}`,
    ).toBe(want.dim);
  }
});
