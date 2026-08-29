/**
 * **Chart type renders at the size its token states — the same size on every
 * screen and in both surfaces.**
 *
 * ── THE COMPLAINT THIS ANSWERS, AND WHY IT TOOK FOUR ROUNDS ────────────────
 *
 * Owner, four times across 2026-08-28: *"the graph staircase and others uses
 * very big font"*, *"they must change the font and lines width much smaller"*,
 * *"Decay and Relations, the font is too big"*, *"the decay and relation
 * graphics should become smaller fonts and scale down"*.
 *
 * Three fixes were attempted and two of them were made without loading the
 * page. The ledger is in `plan:walk seq:47` and `seq:62`; the short version is
 * that the defect had two halves and each fix addressed one of them:
 *
 *   1. the chart ramp had been pulled up 2px by a PROSE repaint, because
 *      `svg.chart text` read `--fs-00`. Fixed at `seq:62` by giving charts
 *      their own tokens — `--fs-chart` 10px, `--fs-chart-mono` 9.5px,
 *      `--fs-chart-nid` 9px, `--fs-chart-rel` 8px.
 *   2. `svg.chart{inline-size:100%}` then stretched each fixed viewBox by a
 *      DIFFERENT factor per screen — 1.600 on the staircase, 1.267 on the ego
 *      graph and the comb — while the text, being CSS px, did not stretch with
 *      it. Fixed by `max-inline-size`, and asserted by `chart-scale.spec.ts`.
 *
 * **`seq:62` closed leaving one thing open, in its own words**: *"the full
 * per-screen census of computed font sizes across both surfaces, and a browser
 * test asserting them"*. This is that test. `test/ui/styles-parity.test.ts`
 * already pins the four `svg.chart text*` rules byte-for-byte in both files —
 * what nothing held was whether they RENDER at those numbers, which is the only
 * question the owner was ever asking, and the one a stylesheet test cannot
 * answer. Every wrong fix in this thread would have passed a stylesheet test.
 *
 * ── WHAT IS ASSERTED ───────────────────────────────────────────────────────
 *
 * Every `<text>` in every chart on Decay, Relations and the Budget simulator,
 * in the app and in the design of record, computes to the size its class
 * selects — and the two surfaces agree screen by screen. The second half is
 * the one that matters: the owner's sharpest description of the defect was
 * text *"nominally identical"* rendering at different sizes on different
 * screens, which no single-screen assertion can see.
 */
import { expect, test } from './app.ts';
import type { Page } from '@playwright/test';
import { openMockup, showScreen } from './mockup.ts';
import { settleScreen } from './settle.ts';

/** The three screens the owner named, and the ones that draw `<text>`. */
const SCREENS = ['decay', 'graph', 'simulate'] as const;

/**
 * The four chart tokens, as the four rules in `styles.css` spend them.
 *
 * Ordered MOST specific first, because the class list decides which applies and
 * the stylesheet's own source order does the same: `svg.chart text.rel` and
 * `text.nid` are declared after `text.mono`, all three at specificity (0,2,1).
 * The colour classes (`.ink`, `.gold`, `.warn`, `.crit`) set `fill` only and
 * never a size, which is why they are absent here and why a `mono ink` label
 * is expected at the mono size.
 */
const RAMP: readonly (readonly [string, number])[] = [
  ['rel', 8], ['nid', 9], ['mono', 9.5],
];
const BASE = 10;

/**
 * Vacuity guards. Per screen it is ONE — a Relations focus with no relations
 * legitimately draws one box and its id, and the demo corpus's first item is
 * exactly that, measured at two labels — so the honest floor is the TOTAL and
 * the requirement that more than one step of the ramp was actually exercised.
 * Without the second, a run where every chart drew only bare `<text>` would
 * assert nothing about `--fs-chart-mono`, `-nid` or `-rel`.
 */
const FLOOR_PER_SCREEN = 1;
const FLOOR_TOTAL = 20;
const FLOOR_STEPS = 2;

interface Label {
  readonly cls: string;
  readonly px: number;
  readonly want: number;
}

/** Every chart `<text>` on the visible screen, with the size its class selects. */
function labels(page: Page, ramp: readonly (readonly [string, number])[], base: number):
Promise<Label[]> {
  return page.evaluate(([pairs, fallback]) => {
    const out: { cls: string; px: number; want: number }[] = [];
    for (const el of document.querySelectorAll('svg.chart text')) {
      // The router keeps every visited screen in the document, merely hidden, so
      // a zero-width box is a previous screen's chart and not this one's.
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      const cls = (el.getAttribute('class') ?? '').trim();
      const has = new Set(cls.split(/\s+/));
      const hit = pairs.find(([name]) => has.has(name));
      out.push({
        cls: cls === '' ? '(none)' : cls,
        px: Number.parseFloat(getComputedStyle(el).fontSize),
        want: hit === undefined ? fallback : hit[1],
      });
    }
    return out;
  }, [ramp, base] as const) as Promise<Label[]>;
}

/** `mono=9.5x107, (none)=10x110` — the census line a reader can act on. */
function census(seen: Label[]): string {
  const rolled = new Map<string, number>();
  for (const l of seen) {
    const key = `${l.cls}=${l.px}px`;
    rolled.set(key, (rolled.get(key) ?? 0) + 1);
  }
  return [...rolled].map(([k, n]) => `${k}x${n}`).sort().join(' ');
}

/** What the surface renders, per screen, as a comparable census string. */
async function surveyApp(page: Page): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const all: Label[] = [];
  for (const screen of SCREENS) {
    await page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
    const settled = await settleScreen(page, screen, { requires: 'svg.chart text' });
    expect(settled.settled,
      `${screen} never settled with a chart label on it (${settled.count} nodes, ` +
      `${settled.inFlight} reads in flight) — a slow machine must not be reported as type size`,
    ).toBe(true);
    const seen = await labels(page, RAMP, BASE);
    expect(seen.length, `${screen} drew no chart labels at all`)
      .toBeGreaterThanOrEqual(FLOOR_PER_SCREEN);
    all.push(...seen);
    const wrong = seen.filter((l) => l.px !== l.want);
    expect(wrong.map((l) => `${screen}: text.${l.cls} rendered ${l.px}px, token says ${l.want}px`),
      `chart type on ${screen} does not render at its token. Census: ${census(seen)}`,
    ).toEqual([]);
    out[screen] = census(seen.map((l) => ({ ...l, cls: l.cls })));
  }
  expectExercised(all, 'the app');
  return out;
}

/**
 * The measurement must be able to SEE the defect before a pass means anything.
 * Both halves fail as themselves rather than passing over a thin corpus.
 */
function expectExercised(all: readonly Label[], where: string): void {
  expect(all.length, `${where} drew ${all.length} chart labels across all three screens — under ` +
    `${FLOOR_TOTAL} this spec cannot see a ramp defect and must not report one absent`)
    .toBeGreaterThanOrEqual(FLOOR_TOTAL);
  const steps = new Set(all.map((l) => l.want));
  expect(steps.size, `${where} exercised only ${[...steps].join('/')}px of the four-step chart ` +
    'ramp; a pass here would say nothing about the other tokens')
    .toBeGreaterThanOrEqual(FLOOR_STEPS);
}

test('the app renders every chart label at the size its token states', async ({ app }) => {
  await surveyApp(app.page);
});

test('the design of record renders the same ramp, screen for screen', async ({ page }) => {
  await openMockup(page);
  const sizes: Record<string, Set<string>> = {};
  const all: Label[] = [];
  for (const screen of SCREENS) {
    await showScreen(page, screen);
    // Scoped to THIS screen's section: the mockup keeps every section in the
    // document too, and `svg.chart text` unscoped resolves to a hidden one.
    await expect(page.locator(`[data-p="${screen}"] svg.chart text`).first()).toBeVisible();
    const seen = await labels(page, RAMP, BASE);
    expect(seen.length, `the mockup's ${screen} drew no chart labels`)
      .toBeGreaterThanOrEqual(FLOOR_PER_SCREEN);
    all.push(...seen);
    const wrong = seen.filter((l) => l.px !== l.want);
    expect(wrong.map((l) => `${screen}: text.${l.cls} rendered ${l.px}px, token says ${l.want}px`),
      `chart type on the design of record's ${screen} does not render at its token. ` +
      `Census: ${census(seen)}`,
    ).toEqual([]);
    // Per CLASS, so the comparison below is about SIZES and never about how many
    // rows a corpus happens to hold — the app's comb draws 107 teeth where the
    // mockup's fixture draws ten, and that difference is data, not typography.
    sizes[screen] = new Set(seen.map((l) => `${l.cls.split(/\s+/).sort().join('.')}=${l.px}px`));
  }
  expectExercised(all, 'the design of record');
  // The invariant the owner actually named: the same class is the same size
  // everywhere. Collapsed across the three screens, each class must resolve to
  // exactly one number.
  const perClass = new Map<string, Set<number>>();
  for (const set of Object.values(sizes)) {
    for (const entry of set) {
      const [cls, px] = entry.split('=');
      const bucket = perClass.get(cls!) ?? new Set<number>();
      bucket.add(Number.parseFloat(px!));
      perClass.set(cls!, bucket);
    }
  }
  const disagreeing = [...perClass]
    .filter(([, values]) => values.size > 1)
    .map(([cls, values]) => `${cls}: ${[...values].join('px, ')}px`);
  expect(disagreeing,
    'the same chart class renders at different sizes on different screens — which is the defect ' +
    'in the owner\'s own words, "text that is nominally identical renders at different sizes on ' +
    'different screens"',
  ).toEqual([]);
});
