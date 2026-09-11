// @basis TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff, TASK-the-fixture-mirrors-the-mockup-s-own-scene-so-the-two-are, RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none, CONST-zero-runtime-dependencies, INSTR-testing-happens-against-the-current-corpus-and-an-exception
/**
 * **PIXEL parity — the app and the mockup rendered at ONE viewport, diffed,
 * and reported as a RANKED LIST OF DIFFERENCES rather than a number.**
 *
 * `plan:port seq:93`. Its body sets the standard this file is held to and it
 * is worth quoting rather than paraphrasing: *"EXPECT TO RULE ON A TOLERANCE,
 * and rule on it deliberately: font rasterisation differs between a headless
 * run and a real browser, and this suite runs BOTH Chromium and real Chrome. A
 * tolerance chosen to make a run green is a gate that measures nothing."*
 *
 * ── THE VIEWPORT, AND WHY THIS ONE ─────────────────────────────────────────
 *
 * **1280 × 720, at `deviceScaleFactor: 1`** — `e2e/playwright.config.ts`'s
 * pinned viewport, unchanged, for three reasons and not because it was already
 * there:
 *
 *   1. It is what every other measurement in this directory was taken at, so a
 *      finding here can be lined up against a `tree-parity` or `pane-size`
 *      finding without either being re-run.
 *   2. `styles.css` has media queries at `max-width:1000px` (`.pair`, `.two`,
 *      `.sim`) — 1280 is above all of them, so both pages are in their WIDE
 *      layout and a difference is a difference rather than one page having
 *      folded and the other not.
 *   3. `.app` is `grid-template-columns: 214px 1fr` and `grid-template-rows:
 *      46px 1fr 26px auto`, so at 1280 × 720 the rail, the header and the
 *      strip are all fully on screen and the content column is 1066 × 648.
 *      That is the FOLD — what a reader sees before scrolling — and it is the
 *      part of a screen a 1:1 judgement is actually made on.
 *
 * Below the fold is deliberately not diffed, and the reason is honesty rather
 * than cost: see the data paragraph below.
 *
 * ── WHY A WHOLE-SCREEN PIXEL DIFF WOULD BE DATA NOISE, AND WHAT IS DONE ────
 *
 * seq:93 `needs` seq:94 — *"the fixture mirrors the mockup's own scene, so the
 * two are comparable"* — and seq:94 is marked done. **Its deliverable is not
 * available to this file.** seq:94 built `.demo-corpus`, and
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`
 * retired `.demo-corpus` on 2026-09-07 in the owner's own words: *"supersede
 * the e2e tests that uses demo corpus, it should not be used anymore"*.
 * `e2e/app.ts` carries that ruling in full.
 *
 * So the precondition seq:93 was waiting for exists as an ARGUMENT and not as
 * a corpus, and the argument is still right: this repository holds 1,085 items
 * where the mockup's scene holds a handful, so an unrestricted diff of a
 * content column is a picture of how much corpus there is. It would be a large
 * red number with no defect in it.
 *
 * What this file does instead is diff **by region**, and only report the
 * regions where a difference can mean something:
 *
 *   `hdr`    the header — the same controls on both sides, data-independent
 *            except for one session label. Fully comparable.
 *   `rail`   the 214px navigation column — the specification of what screens
 *            exist. Fully comparable, and the highest-value region on the page
 *            because it is identical on all 21 screens and a reader sees it
 *            every time.
 *   `strip`  the 26px footer. Comparable in geometry; its numbers are data.
 *   `body`   the content column. Reported ONLY where the two sides draw a
 *            comparable amount (`isComparable` below), and its geometry —
 *            where the column starts, how wide it is, where the first card's
 *            top edge lands — is reported ALWAYS, because an offset column is
 *            a spacing defect no amount of data can explain.
 *
 * A screen whose body cannot be compared honestly is recorded as
 * `NOT COMPARABLE` with the node counts that say why. It is not given a number.
 *
 * ── THE TOLERANCE IS MEASURED HERE, ON THIS MACHINE, IN THIS RUN ───────────
 *
 * `the rasterisation floor is measured and not chosen` renders the SAME
 * unchanged mockup in Playwright's bundled Chromium and in Google Chrome and
 * reads what the two engines disagree about with nothing else varying. That is
 * the floor, and every threshold in the walk is stated against it. If the floor
 * ever rises above the amplitudes the walk is reporting, the walk is measuring
 * fonts and the test says so instead of passing.
 *
 * `e2e/pixel-diff.ts` carries the other half of the answer: amplitude alone
 * cannot separate a rasterisation fringe from a real difference, so SHAPE does
 * it. An antialiasing difference is one pixel wide along a glyph edge; a
 * spacing, colour or size defect is a region at least two pixels thick. The
 * erosion there deletes the first class outright.
 *
 * ── THE CORPUS ─────────────────────────────────────────────────────────────
 *
 * A seeded throwaway twin (`e2e/scratch-corpus.ts`, the owner's exception of
 * 2026-09-11), read-only, one per worker. Not because parity needs the states
 * — it needs the opposite — but because a screen that draws NOTHING cannot be
 * compared at all, and against this repository's real state several screens
 * have no drafts, no pending revision and no spill to draw. A blank screen
 * scores a small diff and means nothing. `e2e/scratch-seeds.spec.ts` asserts
 * this repository's own corpus stays byte-identical while that happens.
 */
import { chromium, test as plain } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { seededTest, expect } from './scratch-corpus.ts';
import {
  TIGHT_BUDGETS, draftInQueue, driftedSource, pendingRevision, procedures, realInjections,
  seeds, squeezeBudgets,
} from './seeds.ts';
import { MOCKUP_URL } from './mockup.ts';
import { settleScreen } from './settle.ts';
import {
  annotate, crop, decodePng, diffRasters, encodePng,
  type Cluster, type DiffResult, type Raster, type Rect,
} from './pixel-diff.ts';

const test = seededTest(seeds(
  squeezeBudgets(TIGHT_BUDGETS),
  draftInQueue(),
  pendingRevision(),
  driftedSource(),
  procedures(),
  realInjections(),
));

const REPO = path.resolve(import.meta.dirname, '..');

const OUT_ROOT = process.env['MYCONTEXT_PIXEL_PARITY_OUT'] !== undefined
  ? path.resolve(process.env['MYCONTEXT_PIXEL_PARITY_OUT'])
  : path.join(REPO, 'test-results', 'pixel-parity');

/**
 * The amplitude at which a channel difference stops being rasterisation.
 *
 * Twelve, and the number is answerable rather than chosen: `the rasterisation
 * floor is measured and not chosen` below renders the SAME unchanged mockup in
 * both engines and reports what they disagree about. **Measured twice on
 * 2026-09-11: a peak of 0/255 and a peak of 2/255.** Twelve is six times the
 * larger of those, and that test asserts the floor stays strictly under it and
 * that the engines cannot produce a single solid region at it.
 *
 * **It is not the gate**, and that is the important half. The gate is the
 * erosion in `e2e/pixel-diff.ts`, which has no dial at all: a difference one
 * pixel wide is deleted whatever its amplitude, and a difference two pixels
 * thick survives whatever its amplitude. Moving this number changes which
 * findings are *counted*, never which are *seen*.
 */
const FAINT_DELTA = 12;

/** The stated viewport. Asserted rather than assumed — see `the viewport is what this file says`. */
const VIEWPORT = { width: 1280, height: 720 } as const;

/**
 * The four regions of the shell, by CLASS rather than by id.
 *
 * The app gives them ids (`#topbar`, `#nav`, `#strip`) and the mockup does not
 * — it has `<header class="hdr">`, `<nav class="rail">`, `<footer
 * class="strip">` with no ids at all. Reaching for `#topbar` would silently
 * find nothing on the mockup side and report a missing header as a parity
 * finding, which is a measurement of the selector.
 */
const REGIONS = ['.hdr', '.rail', '.body', '.strip'] as const;
type RegionName = (typeof REGIONS)[number];

interface Box extends Rect { readonly present: boolean }

/** Every region's box, plus the current screen section's, in one DOM read. */
async function boxes(page: Page, screen: string): Promise<Record<string, Box>> {
  return await page.evaluate(([regions, name]) => {
    const read = (selector: string): Box => {
      const el = document.querySelector(selector);
      if (el === null) return { present: false, x: 0, y: 0, width: 0, height: 0 };
      const r = el.getBoundingClientRect();
      return {
        present: true,
        x: Math.round(r.x * 100) / 100, y: Math.round(r.y * 100) / 100,
        width: Math.round(r.width * 100) / 100, height: Math.round(r.height * 100) / 100,
      };
    };
    const out: Record<string, Box> = {};
    for (const selector of regions) out[selector] = read(selector);
    out['section'] = read(`[data-p="${name}"]`);
    // The first card inside the section: where content actually begins, which
    // is the one spacing fact a reader notices before any other.
    out['firstCard'] = read(`[data-p="${name}"] .card`);
    return out;
  }, [REGIONS as readonly string[], screen] as const) as Record<string, Box>;
}

/** Clip a region box to the viewport, so a screenshot clip is always legal. */
function clipped(box: Box): Rect | null {
  if (!box.present) return null;
  const x = Math.max(0, Math.floor(box.x));
  const y = Math.max(0, Math.floor(box.y));
  const right = Math.min(VIEWPORT.width, Math.ceil(box.x + box.width));
  const bottom = Math.min(VIEWPORT.height, Math.ceil(box.y + box.height));
  if (right <= x || bottom <= y) return null;
  return { x, y, width: right - x, height: bottom - y };
}

/** The rail as each side declares it — the specification of what screens exist. */
async function rail(page: Page): Promise<string[]> {
  return await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.nav')].map((b) => b.dataset['s'] ?? ''));
}

/** Every `[data-p]` section each side has, in document order. */
async function panes(page: Page): Promise<string[]> {
  return await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-p]')].map((p) => p.dataset['p'] ?? ''));
}

async function shot(page: Page): Promise<Raster> {
  return decodePng(await page.screenshot({ animations: 'disabled', caret: 'hide' }));
}

/**
 * **DISMISS THE MODAL BANNER BEFORE EVERY CAPTURE — and say whether there was
 * one, because on the mockup side there always eventually is.**
 *
 * ── THE FINDING THIS EXISTS FOR, WHICH NEARLY POISONED THE WHOLE FILE ──────
 *
 * `docs/design/web-ui-mockup.html`, in its own demo script:
 *
 *     setInterval(()=>{ if(++beats===60) $('#exited').hidden=false; },900);
 *
 * **The mockup raises its "The server has exited" banner 54 seconds after
 * load, unconditionally.** It is a demonstration of the banner and it is
 * correct for the mockup to do it — the banner is part of the design and
 * something has to show it.
 *
 * It is fatal to any instrument that holds ONE mockup page open across a walk.
 * This walk takes about two and a half minutes for twenty-one screens, so from
 * roughly the eighth screen onward every mockup screenshot carried a 340px red
 * modal and a 44px black shadow over the middle of the content column —
 * `position:fixed; inset:0; margin:auto`, dead centre, exactly where a
 * content-column diff looks.
 *
 * It was caught because the cluster naming said so: `elementFromPoint` at the
 * centre of the biggest difference on `learn` reported `div.banner` with
 * `color: rgb(239, 68, 68)` on the mockup side and a plain `section` on the
 * app's. **The pixel count alone would never have said this** — it would have
 * reported a large solid region on two-thirds of the screens, which is what a
 * real defect looks like, and a reviewer would have gone looking for it in
 * `styles.css`.
 *
 * ── AND THE REMEDY IS THE PAGE'S OWN ───────────────────────────────────────
 *
 * Not `hidden = true` from outside, and emphatically not an edit to the
 * mockup: `DEC-the-mockup-is-a-frozen-reference-it-is-read-never-written`, and
 * the owner's design of record is not adjusted to make a test convenient. The
 * banner carries a dismiss button, `#exdismiss`, whose own handler ALSO resets
 * `beats` to zero — so clicking it is both the thing a reader does and the
 * thing that buys the walk another 54 seconds. `e2e/app.ts` dismisses the app's
 * skew banner the identical way and for the identical reason.
 *
 * Returns whether one was showing, so a capture taken under a banner can be
 * reported rather than silently repaired.
 */
async function quiesce(page: Page): Promise<'clear' | 'dismissed' | 'STILL UP'> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const state = await page.evaluate(() => {
      const banner = document.querySelector<HTMLElement>('.banner:not([hidden])');
      if (banner === null) return 'clear';
      // **`#exdismiss` BY ID, never `button.icon`.** A selector list returns
      // the first match in DOCUMENT ORDER, not the first selector that
      // matches — and `#exrefresh` is a `button.icon` that stands BEFORE
      // `#exdismiss` inside this banner. `'#exdismiss, button.icon'` therefore
      // clicked the hidden refresh button on every screen, reported "dismissed"
      // and left the modal standing over twelve captures. Measured 2026-09-11;
      // the run looked repaired and was not.
      const dismiss = banner.querySelector<HTMLElement>('#exdismiss');
      if (dismiss === null) return 'STILL UP';
      dismiss.click();
      return 'dismissed';
    });
    if (state === 'clear') return attempt === 0 ? 'clear' : 'dismissed';
    if (state === 'STILL UP') return 'STILL UP';
    await page.waitForTimeout(60);
  }
  // Verified, not assumed: the click is only a dismissal if the banner went.
  const gone = await page.evaluate(() =>
    document.querySelector('.banner:not([hidden])') === null);
  return gone ? 'dismissed' : 'STILL UP';
}

function write(project: string, name: string, bytes: Buffer): string {
  const dir = path.join(OUT_ROOT, project);
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  writeFileSync(file, bytes);
  return file;
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE INSTRUMENT, BEFORE ANY FINDING IT PRODUCES
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * **The viewport this file names is the viewport it measures at.**
 *
 * The header states 1280 × 720 at scale 1 and every threshold below is stated
 * against that geometry. A config change that moved it would leave this file's
 * prose describing a measurement nobody took — which is precisely the defect
 * this project has recorded as "a comment asserting the opposite of the code".
 */
/**
 * **THE DIFF ENGINE'S OWN SELF-CHECK — one probe per claim it makes, and no
 * browser involved.**
 *
 * `tree-parity.spec.ts` opens with the same move and says why: *"A prior
 * version of the kinds gate read `el.className`, which on an SVG element is an
 * `SVGAnimatedString` … The gate was green the entire time."* An instrument
 * that nothing probes is a place for a silent wrong answer, and this one makes
 * four claims that the rest of the file leans on entirely:
 *
 *   (a) two identical rasters differ in NOTHING. Without this, every case
 *       below is passed by a differ that always says "different".
 *   (b) a SOLID BLOCK is found, at its true box, with the mean colour of each
 *       side. That is the finding shape the whole walk reports.
 *   (c) a ONE-PIXEL HAIRLINE is counted as `strong` and survives as ZERO
 *       `solid` — the erosion doing exactly its job, which is what lets the
 *       walk ignore glyph-edge rasterisation without a tolerance dial.
 *   (d) a LOW-AMPLITUDE FIELD — the gradient dither that is measured on the
 *       real page — is `faint` and never reaches the erosion at all. Shape and
 *       amplitude are two different filters and (c) and (d) are what prove
 *       neither one is carrying the other.
 *
 * And (e): the PNG round-trip, because every raster in this file arrives
 * through `decodePng` and a decoder that dropped a channel would make every
 * colour finding above a fiction.
 */
plain('the diff engine sees each kind of difference, and only those', () => {
  const W = 64;
  const H = 48;
  const make = (paint: (x: number, y: number) => [number, number, number]): Raster => {
    const data = new Uint8Array(W * H * 4);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const [r, g, b] = paint(x, y);
        const p = (y * W + x) * 4;
        data[p] = r; data[p + 1] = g; data[p + 2] = b; data[p + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  };
  const ground = (x: number, y: number): [number, number, number] =>
    [(x * 3) & 0xff, (y * 5) & 0xff, 40];
  const control = make(ground);

  // (e) the round trip, first, because everything else is read through it.
  const round = decodePng(encodePng(control));
  expect({ w: round.width, h: round.height }, 'the PNG round trip changed the size').toEqual({ w: W, h: H });
  expect(Buffer.from(round.data).equals(Buffer.from(control.data)),
    'a raster written and read back is not the same raster — every colour this file reports '
    + 'is then a fiction').toBe(true);

  // (a) identical is identical.
  expect(
    diffRasters(control, make(ground), { faintDelta: 0 }).different,
    'two identical rasters differ in something — a differ that always reports a difference '
    + 'proves nothing by reporting one',
  ).toBe(0);

  // (b) a solid block, at its box, with both means.
  const block = diffRasters(control, make((x, y) =>
    (x >= 20 && x < 30 && y >= 10 && y < 20) ? [255, 0, 0] : ground(x, y)));
  expect(block.clusters.length, 'a 10x10 block must be reported as exactly one region').toBe(1);
  const found = block.clusters[0]!;
  expect(
    { x: found.x, y: found.y, width: found.width, height: found.height, right: found.right },
    'the region must be reported at its true box with the colour of each side',
  ).toEqual({ x: 20, y: 10, width: 10, height: 10, right: '#ff0000' });

  // (c) a one-pixel hairline: loud, and erased by the erosion.
  const hairline = diffRasters(control, make((x, y) =>
    y === 24 ? [255, 255, 255] : ground(x, y)));
  expect(hairline.strong, 'a full-width hairline must be seen as strong').toBe(W);
  expect(
    { solid: hairline.solid, regions: hairline.clusters.length },
    'a difference ONE pixel thick is what antialiasing looks like, and the erosion must '
    + 'delete it however loud it is — this is the half of the gate that has no dial',
  ).toEqual({ solid: 0, regions: 0 });

  // (d) a low-amplitude field: a big SOLID area, forgiven on amplitude alone.
  // This is the gradient dither measured on the real page — 4.6% of a viewport
  // at 2/255 — and the erosion cannot touch it, which is precisely why
  // `FAINT_DELTA` exists beside the erosion rather than instead of it.
  const dithered = diffRasters(control, make((x, y) => {
    const [r, g, b] = ground(x, y);
    return x < 40 && y < 30 ? [(r + 2) & 0xff, g, b] : [r, g, b];
  }), { faintDelta: FAINT_DELTA });
  expect(dithered.different, 'the probe painted nothing').toBeGreaterThan(1000);
  expect(
    { strong: dithered.strong, solid: dithered.solid },
    `a solid 40x30 field differing by 2/255 must be faint at a ${FAINT_DELTA}/255 threshold — `
    + 'it is two pixels thick everywhere, so the erosion alone would report all of it',
  ).toEqual({ strong: 0, solid: 0 });
});

plain('the viewport is what this file says it is', async ({ page }) => {
  const seen = page.viewportSize();
  expect(seen, 'a pixel parity run with no viewport is a run at an unknown size').not.toBeNull();
  expect(seen, 'this file is written against 1280x720 and says so in its header')
    .toEqual({ width: VIEWPORT.width, height: VIEWPORT.height });
  const scale = await page.evaluate(() => window.devicePixelRatio);
  expect(scale, 'a scale factor other than 1 makes every pixel measurement below a lie')
    .toBe(1);
});

/**
 * **THE INSTRUMENT'S OWN NOISE FLOOR — the same page, twice, one browser, one
 * second apart.**
 *
 * Without this, every number below could be produced by a decoder that returns
 * garbage: a comparison that always reports a difference proves nothing by
 * reporting one. The whole path is exercised — `page.screenshot` → `decodePng`
 * → `diffRasters`.
 *
 * ── WHAT IT MEASURED, AND WHY IT CHANGED WHAT THIS FILE ASSERTS ────────────
 *
 * **2026-09-11: ONE UNCHANGED PAGE, ONE BROWSER, TWO CONSECUTIVE CAPTURES —
 * 42,289 pixels move, 4.6% of the viewport, in three regions of 13,911, 6,094
 * and 3,428 pixels.** The largest is 630 × 415. It is not a stray pixel and it
 * is not the decoder: the two regions' mean colours are `#171d31` and
 * `#161d31`, one step apart on one channel, and the PEAK over the whole frame
 * is **2/255**.
 *
 * That is Skia dithering the mockup's gradients, re-seeded per raster. It is
 * invisible — two parts in 255 — and it is enormous by area, which is exactly
 * the combination a naive pixel gate cannot survive. This file asserted
 * `solid === 0` at zero tolerance for one run, and this test went red on it:
 * **erosion removes a one-pixel FRINGE, and a gradient's dither is a solid
 * FIELD.** Shape alone was not enough; amplitude was carrying half the work
 * all along and this is what proved it.
 *
 * ── SO THE ASSERTION IS MADE AT THE WALK'S OWN CRITERION ───────────────────
 *
 * The walk reports a finding when a difference is BOTH louder than
 * `FAINT_DELTA` AND at least two pixels thick. That conjunction is the gate,
 * so it is the thing this test has to clear: at `FAINT_DELTA` the dither is
 * `faint` and never reaches the erosion at all, and the instrument's own noise
 * is provably incapable of producing a single reported finding.
 *
 * The zero-tolerance reading is kept and PRINTED rather than dropped, because
 * it is the number that says what the instrument is actually doing, and
 * because a run where it changed shape would be worth seeing.
 *
 * ── AND IT LINES UP WITH THE CROSS-ENGINE FLOOR, WHICH IS THE POINT ────────
 *
 * The next test renders the same page in Chromium and in real Chrome and
 * measures 42,291 pixels at a peak of 2 — the same dither, the same amplitude,
 * two pixels apart in count. **The two engines agree with each other exactly as
 * well as one engine agrees with itself.** seq:93 was written expecting a
 * rasterisation penalty between headless Chromium and real Chrome and expecting
 * a tolerance to be ruled on for it; measured here, headed, at this viewport,
 * THERE IS NO SUCH PENALTY TO RULE ON.
 */
plain('the same page against itself produces nothing a person could see', async ({ page }) => {
  await page.goto(MOCKUP_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
  const once = await shot(page);
  const twice = await shot(page);
  // `minCluster: 1` so even a single-pixel survivor would be LOCATED rather
  // than counted — a floor that rises must say where it rose.
  const raw = diffRasters(once, twice, { faintDelta: 0, minCluster: 1 });
  const governing = diffRasters(once, twice, { faintDelta: FAINT_DELTA });
  console.log(`[pixel-parity] INSTRUMENT NOISE FLOOR (same page, same browser, twice): ${
    JSON.stringify({
      atZeroTolerance: {
        different: raw.different, peak: raw.peak, solid: raw.solid,
        regions: raw.clusters.length, largest: raw.clusters.slice(0, 3),
      },
      atTheWalksOwnThreshold: {
        faintDelta: FAINT_DELTA, strong: governing.strong, solid: governing.solid,
      },
    })}`);
  expect(raw.compared, 'the screenshot decoded to nothing').toBe(VIEWPORT.width * VIEWPORT.height);
  expect(
    governing.solid,
    'the same unchanged page rendered twice produced a difference that passes BOTH halves of '
    + `the walk's criterion — louder than ${FAINT_DELTA}/255 and at least two pixels thick. `
    + 'Every finding below is produced by that same test, so this one would be the instrument '
    + 'rather than the product.',
  ).toBe(0);
  expect(
    raw.peak,
    'the same unchanged page rendered twice moved a channel by more than a dither step — '
    + 'something on the page is live, and the walk is sampling it mid-change',
  ).toBeLessThanOrEqual(4);
});

/**
 * **THE TOLERANCE, MEASURED. This is seq:93's own warning, answered.**
 *
 * One unchanged page — the mockup, over `file://`, no server, no corpus, no
 * data — rendered by Playwright's bundled Chromium and by GOOGLE CHROME, at
 * the same viewport, same colour scheme, same locale, same time zone. Nothing
 * varies but the engine. What they disagree about IS the rasterisation floor,
 * and it is read off the machine the run is on rather than chosen.
 *
 * **It runs in one project only**, and launches the other engine itself. The
 * alternative — writing a PNG per project and diffing them afterwards — makes
 * the measurement depend on two runs completing in an order nothing enforces.
 *
 * **The browser it launches, it closes**, in a `finally`, because a dying test
 * does not take a spawned browser with it on Windows.
 *
 * WHAT THE NUMBER IS FOR: `faintDelta` in the walk is set from it, and the walk
 * additionally asserts that the floor stays BELOW the amplitudes it reports.
 * A floor that rose to meet them would mean the walk had become a measurement
 * of fonts, and this test failing is the correct outcome then.
 */
plain('the rasterisation floor is measured and not chosen', async ({ page }, info) => {
  plain.skip(info.project.name !== 'chromium', 'launches the second engine itself; runs once');
  plain.setTimeout(120_000);

  await page.goto(MOCKUP_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(400);
  const bundled = await shot(page);

  let other: Browser | null = null;
  let real: Raster;
  try {
    other = await chromium.launch({ channel: 'chrome', headless: false });
    const context = await other.newContext({
      viewport: { ...VIEWPORT }, deviceScaleFactor: 1,
      colorScheme: 'dark', locale: 'en-US', timezoneId: 'UTC',
    });
    const chromePage = await context.newPage();
    await chromePage.goto(MOCKUP_URL);
    await chromePage.waitForLoadState('domcontentloaded');
    await chromePage.waitForTimeout(400);
    real = await shot(chromePage);
  } finally {
    // Kill what was spawned, on success and on failure alike.
    if (other !== null) await other.close().catch(() => {});
  }

  // TWO readings of the same pair, because they answer two questions.
  //
  //   `raw`      `faintDelta: 0` — nothing forgiven, every moved channel
  //              counted. This is what the engines disagree about, entire.
  //   `governing` `faintDelta: FAINT_DELTA` — the walk's own setting. What the
  //              walk would report if the app were a byte-perfect mockup.
  //
  // The second is the one that decides whether the walk is measuring fonts,
  // and it is the honest form of "rule on a tolerance": the tolerance is
  // stated, and then the engines are asked whether they can reach it.
  const floor = diffRasters(real, bundled, { faintDelta: 0, minCluster: 30 });
  const governing = diffRasters(real, bundled, { faintDelta: FAINT_DELTA });
  const report = {
    comparedPixels: floor.compared,
    pixelsThatMoved: floor.different,
    share: `${((floor.different / floor.compared) * 100).toFixed(3)}%`,
    peakChannelDelta: floor.peak,
    solidRegionsAtZeroTolerance: floor.clusters.length,
    solidPixelsAtZeroTolerance: floor.solid,
    atTheWalksOwnThreshold: {
      faintDelta: FAINT_DELTA,
      strong: governing.strong,
      solid: governing.solid,
      regions: governing.clusters.length,
    },
    largest: floor.clusters.slice(0, 4),
  };
  console.log(`[pixel-parity] RASTERISATION FLOOR (chrome vs chromium, same unchanged mockup):\n${
    JSON.stringify(report, null, 2)}`);
  write('floor', 'floor.json', Buffer.from(JSON.stringify(report, null, 2)));
  write('floor', 'floor.png', encodePng(annotate(real, bundled, floor.clusters)));

  // The measurement is the point; these two assertions only refuse a floor so
  // large that the walk below would be reporting fonts. Stated as bounds on
  // the FLOOR, never as a tolerance applied to a finding.
  //
  // **MEASURED TWICE ON 2026-09-11, and the two readings are worth keeping.**
  // One run reported ZERO pixels moved; the next reported 42,291 (4.6% of the
  // page) at a PEAK OF 2/255, in twelve large flat regions whose mean colours
  // agree to a single channel step — gradient dithering, decided per launch,
  // invisible to a person and to the walk alike. So the engines do not
  // disagree reproducibly about anything, and where they disagree at all they
  // disagree by two parts in 255.
  //
  // That is the ruling seq:93 asked for, and it is an ANSWER rather than a
  // dial: `FAINT_DELTA` is 12, six times the largest disagreement ever
  // measured here, and `atTheWalksOwnThreshold` below asserts the engines
  // cannot reach it at all.
  // **SIZE FIRST, and it used to be `solid` and used to be second.**
  //
  // `expect(governing.solid).toBe(0)` stood here and it could never have gone
  // red: `solid` requires a delta above `FAINT_DELTA`, the line above already
  // requires the PEAK delta to be below `FAINT_DELTA`, and the peak is the
  // maximum of the same deltas. So `peak < FAINT_DELTA` implies `strong === 0`
  // implies `solid === 0`, and the second line was a restatement of the first
  // that would fail only after the first had already failed. Found by trying to
  // break it on purpose and being unable to.
  //
  // It is also why this line comes FIRST. Any change that makes the two
  // captures differently sized also moves the layout inside them, so the
  // peak assertion below fires on the same mutation — put second, this one
  // could never be REACHED either, which is the same defect wearing a
  // different hat. Measured: a proof run at a 1024x768 viewport failed on
  // the peak line and never got here.
  //
  // What is NOT implied, and is worth its own line: that the two engines
  // produced the same-sized image at all. A capture that came back at a
  // different size would silently reduce the comparison to an overlap, and
  // every number above would then describe a smaller page than the one this
  // file says it measures.
  expect(
    floor.sizes,
    'the two engines returned differently sized captures of the same page at the same '
    + 'viewport, so the floor above was measured over an overlap rather than over the page',
  ).toBeNull();
  expect(
    floor.peak,
    `the two engines disagree by up to ${floor.peak}/255 on an unchanged page. At or above `
    + `${FAINT_DELTA} the walk's amplitude test can no longer separate a rasterisation `
    + 'difference from a colour defect, and the walk is measuring fonts.',
  ).toBeLessThan(FAINT_DELTA);
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE RAIL — THE ONE COMPARISON THAT IS THE SAME ON EVERY SCREEN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * **What screens each side says exist**, read from both rails and both sets of
 * sections, before any picture is taken.
 *
 * This is not a pixel measurement and it is here anyway, because it decides
 * what the pixel walk is even able to compare: a screen one side has and the
 * other does not cannot be diffed, and reporting its absence as "a large
 * difference in the content column" would bury the actual fact.
 */
test('both sides declare the same screens, or say which they do not', async ({ app }, info) => {
  const mockupPage = await app.page.context().newPage();
  try {
    await mockupPage.goto(MOCKUP_URL);
    await mockupPage.waitForLoadState('domcontentloaded');
    const declared = {
      mockupRail: await rail(mockupPage),
      mockupPanes: await panes(mockupPage),
      appRail: await rail(app.page),
      appPanes: await panes(app.page),
    };
    const onlyMockup = declared.mockupRail.filter((s) => !declared.appRail.includes(s));
    const onlyApp = declared.appRail.filter((s) => !declared.mockupRail.includes(s));

    /**
     * **Where each rail button actually SITS, on both sides.**
     *
     * The pixel walk reports the rail as ~20,000 solid pixels on every screen
     * and that number is true and useless: one missing entry near the top
     * shifts every button under it, and a diff has no way to say "shifted" —
     * it says "different" in eleven places. The offset per button is the same
     * fact in a form someone can act on, and it is data-independent.
     */
    const railBoxes = async (page: Page): Promise<Record<string, { y: number; h: number }>> =>
      await page.evaluate(() => {
        const out: Record<string, { y: number; h: number }> = {};
        for (const b of document.querySelectorAll<HTMLElement>('.nav')) {
          const r = b.getBoundingClientRect();
          out[b.dataset['s'] ?? ''] = {
            y: Math.round(r.y * 10) / 10, h: Math.round(r.height * 10) / 10,
          };
        }
        return out;
      });
    const appBoxes = await railBoxes(app.page);
    const mockBoxes = await railBoxes(mockupPage);
    const offsets = declared.mockupRail
      .filter((s) => appBoxes[s] !== undefined)
      .map((s) => ({
        screen: s, appY: appBoxes[s]!.y, mockupY: mockBoxes[s]!.y,
        offset: Math.round((appBoxes[s]!.y - mockBoxes[s]!.y) * 10) / 10,
        appHeight: appBoxes[s]!.h, mockupHeight: mockBoxes[s]!.h,
      }));

    const finding = {
      mockupRailCount: declared.mockupRail.length,
      appRailCount: declared.appRail.length,
      inMockupRailOnly: onlyMockup,
      inAppRailOnly: onlyApp,
      mockupRail: declared.mockupRail,
      appRail: declared.appRail,
      appPanesRendered: declared.appPanes,
      buttonOffsets: offsets.filter((o) => Math.abs(o.offset) >= 0.5),
      buttonHeights: {
        app: [...new Set(offsets.map((o) => o.appHeight))],
        mockup: [...new Set(offsets.map((o) => o.mockupHeight))],
      },
    };
    console.log(`[pixel-parity] RAIL DECLARATION:\n${JSON.stringify(finding, null, 2)}`);
    write(info.project.name, 'rail.json', Buffer.from(JSON.stringify(finding, null, 2)));

    // Reported, not asserted away. The rail divergence is `plan:port seq:98`'s
    // to rule on, and an assertion here would only make this file red for a
    // fact `runs.spec.ts` already reports.
    //
    // **One assertion, not two, and the missing one is deliberate.** A line
    // reading `expect(declared.appRail.length).toBeGreaterThan(0)` stood here
    // and it could never have failed: `openSeeded` (`e2e/scratch-corpus.ts`)
    // waits for `.nav` to be VISIBLE, with its own message, before this test
    // body starts. An app with no rail fails there, thirty seconds earlier, and
    // this line would never be reached — so it was an assertion that could
    // only ever be green, which is the shape this project has recorded as a
    // gate measuring nothing. The mockup side is a real assertion: nothing
    // upstream has looked at the mockup's rail.
    expect(declared.mockupRail.length,
      'the mockup rail drew no buttons — the design of record declares no screens, and every '
      + '"NOT IN APP RAIL" verdict below would be vacuous').toBeGreaterThan(0);
  } finally {
    await mockupPage.close();
  }
});

/**
 * **THE DESIGN TOKENS, RESOLVED, ON BOTH SIDES — spacing, colour, size and
 * weight at their source rather than at their consequence.**
 *
 * A pixel diff finds a block that is the wrong colour. This finds out WHY, and
 * it finds it once for the whole product instead of twenty-one times: every
 * spacing, colour and type decision in `styles.css` runs through a custom
 * property on `:root`, so one token that differs is a difference on every
 * screen that uses it — and a pixel walk reports that as twenty-one separate
 * findings with no way to notice they are one.
 *
 * It is also the half of "spacing, colour, weight" that is completely
 * data-independent: `--sp-3` does not care how many items the corpus holds.
 *
 * **This is NOT `styles-parity`.** That gate compares CSS TEXT, block by
 * block, and seq:93's own body records what it misses — *"`styles-parity`
 * carries CSS byte-identically, but only for the selectors it is handed"*.
 * This compares what the BROWSER RESOLVED, so a token overridden later in the
 * cascade, or shadowed by a second `:root` block, or never carried across at
 * all, shows up as a value and not as an absent selector.
 */
test('the design tokens resolve to the same values on both sides', async ({ app }, info) => {
  const mockupPage = await app.page.context().newPage();
  try {
    await mockupPage.goto(MOCKUP_URL);
    await mockupPage.waitForLoadState('domcontentloaded');

    // Token NAMES are read from the page's own stylesheets rather than listed
    // here, for `e2e/mockup.ts`'s reason: a list written down goes stale the
    // next time a token is added, and fails for the wrong reason.
    const tokens = async (page: Page): Promise<Record<string, string>> =>
      await page.evaluate(() => {
        const names = new Set<string>();
        for (const sheet of document.styleSheets) {
          let rules: CSSRuleList;
          try { rules = sheet.cssRules; } catch { continue; }
          for (const rule of rules) {
            if (!(rule instanceof CSSStyleRule)) continue;
            for (const property of rule.style) {
              if (property.startsWith('--')) names.add(property);
            }
          }
        }
        const resolved = getComputedStyle(document.documentElement);
        const out: Record<string, string> = {};
        for (const name of [...names].sort()) {
          out[name] = resolved.getPropertyValue(name).trim();
        }
        return out;
      });

    const appTokens = await tokens(app.page);
    const mockTokens = await tokens(mockupPage);
    const names = [...new Set([...Object.keys(appTokens), ...Object.keys(mockTokens)])].sort();
    const differ = names
      .filter((n) => (appTokens[n] ?? '(absent)') !== (mockTokens[n] ?? '(absent)'))
      .map((n) => ({ token: n, app: appTokens[n] ?? '(absent)', mockup: mockTokens[n] ?? '(absent)' }));

    const finding = {
      tokensInApp: Object.keys(appTokens).length,
      tokensInMockup: Object.keys(mockTokens).length,
      differing: differ.length,
      differences: differ,
    };
    console.log(`[pixel-parity] DESIGN TOKENS:\n${JSON.stringify(finding, null, 2)}`);
    write(info.project.name, 'tokens.json', Buffer.from(JSON.stringify(finding, null, 2)));

    // Reported, not gated — `plan:port seq:98` rules on the list. What IS
    // asserted is that the measurement happened: zero tokens read from either
    // side means the stylesheets were unreachable and the empty difference
    // list would be a false all-clear.
    expect(Object.keys(appTokens).length,
      'no custom properties were readable from the app — probably a cross-origin stylesheet, '
      + 'and an empty difference list would then be a false all-clear').toBeGreaterThan(10);
    expect(Object.keys(mockTokens).length,
      'no custom properties were readable from the mockup').toBeGreaterThan(10);
  } finally {
    await mockupPage.close();
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · THE WALK
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * **What is actually AT a cluster, on each side — the step that turns a box
 * into a finding.**
 *
 * "A 1006×192 region at (244, 153) is #0e101a in the app and #1b1e38 in the
 * mockup" is already better than a count, and it is still a coordinate.
 * `elementFromPoint` at the centre of the box makes it a sentence about an
 * element: `div.card > svg.chart`, with the colour, the font and the padding
 * the browser actually resolved for it. That is what a person fixes.
 *
 * Read from BOTH pages at the same page coordinate, because the question is
 * what a reader looking at that spot sees on each.
 */
const AT_POINT = (point: readonly [number, number]): unknown => {
  const el = document.elementFromPoint(point[0], point[1]);
  if (el === null) return null;
  const style = getComputedStyle(el);
  const chain: string[] = [];
  for (let node: Element | null = el; node !== null && chain.length < 4; node = node.parentElement) {
    const classes = typeof node.className === 'string' && node.className.length > 0
      ? `.${node.className.trim().split(/\s+/).join('.')}` : '';
    chain.unshift(`${node.tagName.toLowerCase()}${classes}`);
    if (node.hasAttribute('data-p')) break;
  }
  return {
    what: chain.join(' > '),
    colour: style.color,
    background: style.backgroundColor,
    font: `${style.fontWeight} ${style.fontSize}/${style.lineHeight}`,
    padding: style.padding,
    border: style.border === '' ? style.borderTopWidth : style.border,
    radius: style.borderRadius,
  };
};

interface AtPoint {
  readonly what: string; readonly colour: string; readonly background: string;
  readonly font: string; readonly padding: string; readonly border: string;
  readonly radius: string;
}

/** A cluster, plus what stands at its centre on each side. */
interface NamedCluster extends Cluster {
  readonly pageX: number;
  readonly pageY: number;
  readonly app: AtPoint | null;
  readonly mockup: AtPoint | null;
}

interface RegionFinding {
  readonly region: RegionName | 'section';
  readonly appBox: Box;
  readonly mockBox: Box;
  /** Geometry differences in px, in words. Always produced. */
  readonly geometry: string[];
  /** The pixel diff, when both sides had a comparable box. */
  readonly pixels: {
    readonly comparedAt: Rect;
    readonly different: number;
    readonly faint: number;
    readonly strong: number;
    readonly solid: number;
    readonly peak: number;
    readonly clusters: readonly NamedCluster[];
  } | null;
  readonly skipped: string | null;
}

interface ScreenFinding {
  readonly screen: string;
  readonly inAppRail: boolean;
  readonly appNodes: number;
  readonly mockNodes: number;
  readonly settled: boolean;
  readonly bodyComparable: boolean;
  readonly bodyReason: string;
  readonly regions: RegionFinding[];
  /** Elements the app draws more than once that the mockup draws once. */
  readonly duplicates: string[];
  readonly note: string | null;
}

/** Geometry, in the words a person would use. */
function geometryWords(app: Box, mock: Box, what: string): string[] {
  const out: string[] = [];
  if (!app.present && !mock.present) return [`${what}: neither side has one`];
  if (!app.present) return [`${what}: the app has none; the mockup's is ${mock.width}x${mock.height} at (${mock.x}, ${mock.y})`];
  if (!mock.present) return [`${what}: the mockup has none; the app's is ${app.width}x${app.height} at (${app.x}, ${app.y})`];
  const say = (label: string, a: number, m: number, unit = 'px'): void => {
    const delta = Math.round((a - m) * 100) / 100;
    if (Math.abs(delta) < 0.5) return;
    out.push(`${what} ${label}: app ${a}${unit}, mockup ${m}${unit} — ${
      delta > 0 ? `${delta} too wide/low` : `${-delta} too narrow/high`}`);
  };
  say('width', app.width, mock.width);
  say('height', app.height, mock.height);
  say('left edge', app.x, mock.x);
  say('top edge', app.y, mock.y);
  return out;
}

/**
 * **Is this screen's content column honestly comparable?**
 *
 * Not a tolerance and not a threshold on the diff — a statement about the
 * SCENE. If one side draws three times the elements of the other, the two are
 * not drawing the same picture and a pixel count over them is a picture of how
 * much corpus there is. seq:94's body names exactly this: *"this corpus draws
 * 200 ask rows against the mockup's 2, 50 audit rows against 7, 26 coverage
 * buttons against 7. Nothing about those diffs is a defect and all of them are
 * red pixels."*
 */
function bodyComparable(appNodes: number, mockNodes: number): { ok: boolean; why: string } {
  if (appNodes === 0) return { ok: false, why: 'the app drew nothing in this section' };
  if (mockNodes === 0) return { ok: false, why: 'the mockup has no section for this screen' };
  const ratio = appNodes / mockNodes;
  if (ratio > 2 || ratio < 0.5) {
    return {
      ok: false,
      why: `the app draws ${appNodes} nodes against the mockup's ${mockNodes} (${
        ratio.toFixed(2)}x) — a pixel count over two different scenes measures the corpus`,
    };
  }
  return { ok: true, why: `${appNodes} nodes against ${mockNodes} (${ratio.toFixed(2)}x)` };
}

test('the walk: every screen, one viewport, region by region', async ({ app }, info) => {
  // **Bounded, and the bound is a budget rather than a hope.** 21 screens x
  // two pages x a settle loop, plus a 1280x720 decode and diff per region.
  // Measured shape: the settle loop dominates at 400ms a sample.
  test.setTimeout(600_000);
  const project = info.project.name;

  const mockupPage = await app.page.context().newPage();
  const findings: ScreenFinding[] = [];
  try {
    await mockupPage.goto(MOCKUP_URL);
    await mockupPage.waitForLoadState('domcontentloaded');

    const mockupRail = await rail(mockupPage);
    const appRail = await rail(app.page);

    // **The mockup's rail is walked, not the app's**, because the mockup is the
    // design of record: a screen the design names and the app does not have is
    // the finding, and walking the app's rail would hide it by construction.
    for (const screen of mockupRail) {
      // **THE MOCKUP IS RELOADED FOR EVERY SCREEN, and the reason is a timer
      // rather than tidiness.**
      //
      // `web-ui-mockup.html` runs `setInterval(()=>{ if(++beats===60)
      // $('#exited').hidden=false; },900)` — the design of record raises its
      // own "server has exited" banner 54 seconds after load, to demonstrate
      // the banner. A walk that holds ONE mockup page open for two and a half
      // minutes is therefore capturing a 340px red modal, dead centre, over
      // the content column, from about the eighth screen onward.
      //
      // Dismissing it through its own button also works (`beats` resets to
      // zero in that handler) and `quiesce` still does that as a check — but a
      // reload is the version that cannot be got subtly wrong, and getting it
      // subtly wrong is exactly what happened first: a selector list picked the
      // hidden REFRESH button instead of the dismiss button, reported success,
      // and left twelve captures contaminated while the report said they had
      // been repaired.
      //
      // It costs a local `file://` load per screen and buys a design of record
      // in the state its author drew it in.
      await mockupPage.goto(MOCKUP_URL);
      await mockupPage.waitForLoadState('domcontentloaded');
      await mockupPage.evaluate((s) => {
        document.querySelector<HTMLElement>(`.nav[data-s="${s}"]`)?.click();
      }, screen);
      // The mockup's own transitions run on `hidden`; sample after they settle.
      await mockupPage.waitForTimeout(320);
      const mockNodes = await mockupPage.evaluate((s) =>
        document.querySelectorAll(`[data-p="${s}"] *`).length, screen);

      const inAppRail = appRail.includes(screen);
      await app.page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
      const walk = await settleScreen(app.page, screen, { samples: 16 });
      const appNodes = walk.count;

      // **BEFORE the boxes and before the pictures.** A modal on either side
      // moves nothing (it is `position:fixed`) but covers the middle of the
      // content column, and a capture taken under one is a capture of the
      // modal. See `quiesce`.
      const bannered = {
        app: await quiesce(app.page),
        mockup: await quiesce(mockupPage),
      };
      if (bannered.app !== 'clear' || bannered.mockup !== 'clear') {
        await app.page.waitForTimeout(120);
      }

      const [appBoxes, mockBoxes] = await Promise.all([
        boxes(app.page, screen), boxes(mockupPage, screen),
      ]);
      const appShot = await shot(app.page);
      const mockShot = await shot(mockupPage);

      const comparable = bodyComparable(appNodes, mockNodes);
      const regions: RegionFinding[] = [];

      for (const region of [...REGIONS, 'section'] as const) {
        const key = region === 'section' ? 'section' : region;
        const a = appBoxes[key]!;
        const m = mockBoxes[key]!;
        const geometry = geometryWords(a, m, region);
        // The body and the section are the data-dependent halves; the header,
        // the rail and the strip are not.
        const dataDependent = region === '.body' || region === 'section';
        if (dataDependent && !comparable.ok) {
          regions.push({
            region, appBox: a, mockBox: m, geometry, pixels: null,
            skipped: `NOT COMPARABLE — ${comparable.why}`,
          });
          continue;
        }
        const appClip = clipped(a);
        const mockClip = clipped(m);
        if (appClip === null || mockClip === null) {
          regions.push({
            region, appBox: a, mockBox: m, geometry, pixels: null,
            skipped: 'one side has no on-screen box for this region',
          });
          continue;
        }
        // **THE INTERSECTION, in page coordinates, and not the smaller box at
        // the earlier origin.**
        //
        // This was min-origin-and-min-size for one run, and it produced a
        // finding that was entirely an artefact: the app's strip stands at
        // y=637 and the mockup's at y=665, so the crop compared 55 rows of the
        // app's FOOTER against 55 rows of the mockup's CONTENT and reported
        // 13,739 solid pixels on all 21 screens. Two boxes that do not occupy
        // the same place are a GEOMETRY finding — `geometry` above has already
        // said so, in px, in words — and pixels taken across the offset are a
        // second, false report of the same fact.
        const x0 = Math.max(appClip.x, mockClip.x);
        const y0 = Math.max(appClip.y, mockClip.y);
        const at: Rect = {
          x: x0, y: y0,
          width: Math.min(appClip.x + appClip.width, mockClip.x + mockClip.width) - x0,
          height: Math.min(appClip.y + appClip.height, mockClip.y + mockClip.height) - y0,
        };
        const smaller = Math.min(
          appClip.width * appClip.height, mockClip.width * mockClip.height,
        );
        // **AND THE ORIGINS MUST AGREE**, which overlap area alone does not
        // check. The app's strip stands at y=637 and the mockup's at y=665:
        // the mockup's box lies wholly inside the app's, so the overlap is
        // 100% of the smaller and the area test passes — while every element
        // inside is 28px out of step, and the diff pairs the app's second
        // strip row against the mockup's first. It reported ~12,900 solid
        // pixels on all twenty-one screens and named mismatched elements with
        // confident colour differences between them, all of it one 28px
        // offset wearing twenty-one disguises.
        //
        // Content flows from a box's top-left, so a shared origin is what
        // makes "the same place on both sides" true. Different heights are
        // fine — `.body` is 565px against 593px and still compares honestly,
        // because both start at y=46.
        const offset = Math.max(
          Math.abs(appClip.x - mockClip.x), Math.abs(appClip.y - mockClip.y),
        );
        if (at.width <= 0 || at.height <= 0 || (at.width * at.height) / smaller < 0.6
          || offset > 2) {
          regions.push({
            region, appBox: a, mockBox: m, geometry, pixels: null,
            skipped: offset > 2
              ? `the two boxes are ${offset}px out of step — this is the geometry finding above, `
                + 'and pixels taken across the offset would report it a second time as a set of '
                + 'colour differences between elements that are not the same elements'
              : 'the two boxes barely overlap — this is a geometry finding, and pixels '
                + 'across the offset would report it a second time as a colour difference',
          });
          continue;
        }
        const left = crop(appShot, at);
        const right = crop(mockShot, at);
        const diff: DiffResult = diffRasters(left, right, { faintDelta: FAINT_DELTA });
        // Name the four largest. Four rather than all twelve because each is
        // two cross-page round trips and the tail of a cluster list is speckle.
        const named: NamedCluster[] = [];
        for (const c of diff.clusters) {
          const pageX = Math.round(c.x + at.x + c.width / 2);
          const pageY = Math.round(c.y + at.y + c.height / 2);
          const base = { ...c, pageX, pageY };
          if (named.length >= 4) { named.push({ ...base, app: null, mockup: null }); continue; }
          const [appAt, mockAt] = await Promise.all([
            app.page.evaluate(AT_POINT, [pageX, pageY] as const),
            mockupPage.evaluate(AT_POINT, [pageX, pageY] as const),
          ]);
          named.push({
            ...base, app: appAt as AtPoint | null, mockup: mockAt as AtPoint | null,
          });
        }
        regions.push({
          region, appBox: a, mockBox: m, geometry, skipped: null,
          pixels: {
            comparedAt: at, different: diff.different, faint: diff.faint,
            strong: diff.strong, solid: diff.solid, peak: diff.peak,
            clusters: named,
          },
        });
        // **A PICTURE BESIDE EVERY FINDING, app on the left and mockup on the
        // right, each solid region boxed in red on BOTH sides.**
        //
        // `RULE-1-1-with-the-mockup-and-the-owner-says-when-it-is-done`: the
        // owner certifies, not the agent and not the gate. A JSON number is
        // not something a person can certify against, and `plan:port seq:98`'s
        // own account of what worked says the same thing about the tree
        // inventory — *"The instrument was a page, not a list … The owner read
        // the screens; the walker only said where to look."*
        //
        // `.body` and `section` were excluded here for one run, on the
        // reasoning that they are large. They are also where every finding
        // worth looking at lives, so the exclusion removed the pictures for
        // exactly the regions this file exists to produce.
        if (diff.solid > 0) {
          write(project, `${screen}${region === 'section' ? '-section' : region.replace('.', '-')}.png`,
            encodePng(annotate(left, right, diff.clusters)));
        }
      }

      // **A duplicate-render census, taken while both pages are open.**
      // Three duplicate renders were already in hand when this file was
      // written (`.convfilter`/`input.convfind` on Conversations, two rows on
      // one `data-cmdkey` on Doctor). Rather than assert those three, this
      // asks the general question on every screen: what does the app draw
      // twice that the mockup draws once?
      const duplicates = await app.page.evaluate((s) => {
        const section = document.querySelector(`[data-p="${s}"]`);
        if (section === null) return [];
        const out: string[] = [];
        /**
         * **WHERE a repeat lives, because that is what decides whether it is a
         * defect.** One record shown in two different cards — a spilled item
         * that is also in the selection, say — is the product working. The
         * SAME card drawn twice is the duplicate-render defect
         * `preview-overlap` exists for. A count cannot tell those apart and a
         * path can, so each repeat carries the container chain of every
         * occurrence and whether those chains are identical.
         */
        const chain = (el: Element): string => {
          const parts: string[] = [];
          for (let n: Element | null = el; n !== null && parts.length < 5; n = n.parentElement) {
            const cls = typeof n.className === 'string' && n.className.length > 0
              ? `.${n.className.trim().split(/\s+/).slice(0, 3).join('.')}` : '';
            parts.unshift(`${n.tagName.toLowerCase()}${cls}`);
            if (n.hasAttribute('data-p')) break;
          }
          return parts.join('>');
        };
        const tally = (label: string, pairs: [string, Element | null][], cap = 8): void => {
          const counts = new Map<string, Element[]>();
          for (const [v, el] of pairs) {
            const list = counts.get(v) ?? [];
            if (el !== null) list.push(el);
            counts.set(v, [...list]);
          }
          const repeats = [...counts]
            .filter(([v]) => pairs.filter(([w]) => w === v).length > 1)
            .sort((a, b) => b[1].length - a[1].length);
          for (const [v, els] of repeats.slice(0, cap)) {
            const n = pairs.filter(([w]) => w === v).length;
            const chains = [...new Set(els.map((e) => chain(e)))];
            // **Careful with the words here.** One chain means the two
            // occurrences sit in containers of the same SHAPE — two rows of
            // one table, say — which is usually the product working: two
            // findings can cite one item. Two chains mean one is nested inside
            // the other, or they are in different cards; that is where both a
            // legitimate cross-reference and a real duplicate render live. The
            // census reports the shape and lets the reader decide; calling
            // either one a defect from here would be the gate deciding.
            const verdict = els.length < 2 ? ''
              : chains.length === 1
                ? ` — two containers of the same shape (${chains[0]})`
                : ` — different containers (${chains.join(' | ')})`;
            out.push(`${label} "${v.length > 80 ? `${v.slice(0, 80)}…` : v}" x${n}${verdict}`);
          }
          if (repeats.length > cap) {
            out.push(`${label}: and ${repeats.length - cap} more values drawn more than once`);
          }
        };

        // A duplicate id is a defect with no reading that makes it correct.
        tally('id', [...section.querySelectorAll('[id]')]
          .map((e): [string, Element] => [e.id, e]));

        // **The data keys, with ENUMERATIONS FILTERED OUT — and the filter
        // calibrates itself rather than naming attributes.**
        //
        // A first version tallied every `data-*` and reported `data-g="◆" x27`
        // and `data-depth="2" x1251` as duplicate renders. They are nothing of
        // the kind: `data-g` is a glyph and `data-depth` is a tree level, and
        // both are supposed to repeat. What separates them from `data-id` is
        // not the attribute NAME — hard-coding a list of those is a second
        // place to be wrong — but the SHAPE OF THE KEY: an enumeration takes a
        // handful of values across many elements, and an identifier takes a
        // different value for every element it is on. So a key whose distinct
        // values number no more than eight is an enumeration on this screen
        // and is skipped; a key with many distinct values is an identifier,
        // and a repeated value there means one record drawn twice.
        const byKey = new Map<string, [string, Element][]>();
        for (const el of section.querySelectorAll<HTMLElement>('*')) {
          for (const name of Object.keys(el.dataset)) {
            if (name === 'p') continue;
            const list = byKey.get(name) ?? [];
            list.push([el.dataset[name] ?? '', el]);
            byKey.set(name, list);
          }
        }
        for (const [name, pairs] of byKey) {
          if (new Set(pairs.map(([v]) => v)).size <= 8) continue;
          tally(`data-${name}`, pairs);
        }

        // A card is a container with a heading; two cards under one heading is
        // the shape both known duplicate renders take.
        tally('card heading', [...section.querySelectorAll('.card')]
          .map((c): [string, Element] =>
            [(c.querySelector('h2,h3,h4')?.textContent ?? '').trim(), c])
          .filter(([t]) => t.length > 0));
        return out;
      }, screen);

      const notes: string[] = [];
      if (!inAppRail) notes.push('the design of record names this screen; the app rail does not');
      if (bannered.mockup !== 'clear') {
        notes.push('the mockup had raised its own demo "server has exited" banner '
          + '(web-ui-mockup.html, the `beats===60` interval) — '
          + (bannered.mockup === 'dismissed'
            ? 'dismissed through its own button before the capture'
            : 'AND IT COULD NOT BE DISMISSED, so this screen\'s pixels are the banner'));
      }
      if (bannered.app !== 'clear') {
        notes.push(`THE APP had a modal banner up before this capture (${bannered.app}) — that `
          + 'is the app\'s own state and not a demo timer; worth reading `serverOutput`');
      }
      findings.push({
        screen, inAppRail, appNodes, mockNodes, settled: walk.settled,
        bodyComparable: comparable.ok, bodyReason: comparable.why,
        regions, duplicates,
        note: notes.length === 0 ? null : notes.join('; '),
      });
    }
  } finally {
    await mockupPage.close();
  }

  const dir = path.join(OUT_ROOT, project);
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'walk.json'), JSON.stringify(findings, null, 2));
  writeFileSync(path.join(dir, 'walk.md'), asMarkdown(findings, project));
  console.log(`[pixel-parity] ${project}: walked ${findings.length} screens → ${dir}`);
  console.log(summarise(findings));

  // **This file ends at an inventory**, exactly as `tree-parity.spec.ts` does
  // and for the owner's stated reason: a gate written before he has seen the
  // list decides the fix order by accident. So the only assertions are the
  // ones that would make the inventory a LIE.
  const unsettled = findings.filter((f) => f.inAppRail && !f.settled).map((f) => f.screen);
  expect(unsettled,
    'a screen that never finished drawing was screenshotted mid-render, and every pixel '
    + 'difference reported for it is a measurement of the clock')
    .toEqual([]);
  expect(findings.length, 'the mockup rail declared no screens to walk').toBeGreaterThan(0);
});


function summarise(findings: readonly ScreenFinding[]): string {
  const lines: string[] = [];
  for (const f of findings) {
    const geo = f.regions.flatMap((r) => r.geometry);
    const solid = f.regions
      .filter((r) => r.pixels !== null && r.pixels.solid > 0)
      .map((r) => `${r.region}=${r.pixels!.solid}px/${r.pixels!.clusters.length}reg`);
    const bits = [
      `${f.screen}${f.inAppRail ? '' : ' [NOT IN APP RAIL]'}`,
      `nodes ${f.appNodes}/${f.mockNodes}`,
      f.bodyComparable ? 'body COMPARABLE' : 'body NOT COMPARABLE',
      geo.length > 0 ? `geom ${geo.length}` : '',
      solid.length > 0 ? `solid ${solid.join(' ')}` : '',
      f.duplicates.length > 0 ? `DUP ${f.duplicates.length}` : '',
    ].filter((s) => s !== '');
    lines.push(`  ${bits.join(' · ')}`);
    if (f.note !== null) lines.push(`      NOTE ${f.note}`);
    for (const g of geo) lines.push(`      GEOM ${g}`);
    for (const d of f.duplicates) lines.push(`      DUP  ${d}`);
  }
  return lines.join('\n');
}

function asMarkdown(findings: readonly ScreenFinding[], project: string): string {
  const out: string[] = [
    `# Pixel parity — ${project} — 1280x720, deviceScaleFactor 1`,
    '',
    'App on a seeded throwaway twin of this repository\'s corpus; mockup over `file://`.',
    'Regions compared at a shared origin and size. `solid` counts pixels surviving the',
    'erosion in `e2e/pixel-diff.ts` — a one-pixel rasterisation fringe cannot reach it.',
    '',
  ];
  for (const f of findings) {
    out.push(`## ${f.screen}`, '');
    if (f.note !== null) out.push(`**NOTE:** ${f.note}`, '');
    out.push(`- nodes: app ${f.appNodes}, mockup ${f.mockNodes}`);
    out.push(`- body: ${f.bodyComparable ? 'COMPARABLE' : 'NOT COMPARABLE'} — ${f.bodyReason}`);
    if (f.duplicates.length > 0) {
      out.push('- **drawn more than once by the app:**');
      for (const d of f.duplicates) out.push(`  - ${d}`);
    }
    out.push('');
    for (const r of f.regions) {
      const head = `### ${f.screen} · ${r.region}`;
      const body: string[] = [];
      for (const g of r.geometry) body.push(`- GEOMETRY: ${g}`);
      if (r.skipped !== null) body.push(`- ${r.skipped}`);
      else if (r.pixels !== null) {
        const p = r.pixels;
        body.push(`- compared ${p.comparedAt.width}x${p.comparedAt.height} at (${
          p.comparedAt.x}, ${p.comparedAt.y})`);
        body.push(`- moved: ${p.different} px (${p.faint} faint, ${p.strong} strong, ${
          p.solid} solid), peak ${p.peak}/255`);
        // **Cluster coordinates are PAGE coordinates**, not crop-relative.
        // They were crop-relative for one run and a reader cannot find a
        // region that way — "at (10, 0)" in the footer crop is at (10, 637) on
        // the screen, and the whole point of a box is that someone can go and
        // look at it.
        for (const c of p.clusters) {
          body.push(`- SOLID ${c.width}x${c.height} at page (${c.x + p.comparedAt.x}, ${
            c.y + p.comparedAt.y}), ${c.pixels} px — app mean ${c.left}, mockup mean ${c.right}`);
          if (c.app === null && c.mockup === null) continue;
          body.push(`  - at its centre (${c.pageX}, ${c.pageY}):`);
          body.push(`    - app:    ${c.app === null ? 'nothing' : c.app.what}`);
          body.push(`    - mockup: ${c.mockup === null ? 'nothing' : c.mockup.what}`);
          if (c.app !== null && c.mockup !== null) {
            for (const key of ['colour', 'background', 'font', 'padding', 'border', 'radius'] as const) {
              if (c.app[key] === c.mockup[key]) continue;
              body.push(`    - ${key}: app \`${c.app[key]}\` vs mockup \`${c.mockup[key]}\``);
            }
          }
        }
      }
      if (body.length > 0) out.push(head, '', ...body, '');
    }
  }
  return out.join('\n');
}
