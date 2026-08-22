/**
 * **The two degraded registers — measured in a real Chromium, not reasoned
 * about from CSS text.**
 *
 * `docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` Task 11: the
 * glass this whole direction is built out of does not survive
 * `forced-colors: active` at all, and `prefers-reduced-transparency: reduce`
 * asks for exactly the material property this direction is built out of. Both
 * are declared registers rather than left to the browser to improvise —
 * `docs/superpowers/specs/2026-08-21-web-ui-visual-direction-design.md` §8.
 *
 * Chromium supports `forcedColors` directly through Playwright's own
 * `page.emulateMedia`. `prefers-reduced-transparency` has no typed Playwright
 * option (checked against `playwright-core`'s own `.d.ts`), so those tests
 * drive it through the same CDP call the task names —
 * `Emulation.setEmulatedMedia` with a `prefers-reduced-transparency` feature —
 * which `matchMedia('(prefers-reduced-transparency: reduce)')` confirms
 * actually takes effect before any assertion runs.
 *
 * Measuring this against the file before this task's CSS existed corrected
 * two claims the plan itself made from reasoning rather than rendering:
 *
 *  - `backdrop-filter` is NOT on Chromium's forced-colors list — it measured
 *    UNCHANGED (`blur(20px) saturate(1.4)`) with forced-colors active, so it
 *    has to be dropped explicitly, the same as register 2, not left to the
 *    browser to strip.
 *  - `repeating-linear-gradient` does NOT survive forced-colors —
 *    `background-image` measured `none` on every existing hatch pattern in
 *    the file (`.ghosts .gh`, `.notrun`, `.mini i.x`, `.div-r i`,
 *    `.tokvoid`), contradicting the plan's Step 3 text. `border-style`
 *    (dashed/dotted/double) is not on the forced list and measured
 *    unchanged in the same test, which is why the four tier segments below
 *    are told apart by border pattern rather than a background one.
 */
import { test, expect } from '@playwright/test';
import { openMockup, expectNoFaults, showScreen, SCREENS } from './mockup.ts';

test.describe('forced-colors: active', () => {
  test('the pane, the rail and the header declare Canvas with a CanvasText hairline', async ({ page }) => {
    const faults = await openMockup(page);
    await page.emulateMedia({ forcedColors: 'active' });

    const read = (sel: string) => page.locator(sel).first().evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, bgImage: cs.backgroundImage, backdrop: cs.backdropFilter };
    });

    for (const sel of ['.card.pane', '.rail', '.hdr']) {
      const got = await read(sel);
      expect(got.bg, `${sel} must not fall back to the browser's own transparent default — ` +
        'measured rgba(255,255,255,0) before this rule existed, because the primitive only ever ' +
        'declared background-IMAGE, never a colour for forced-colors to fall back to').not.toMatch(/^rgba\(.*, 0\)$/);
      expect(got.bgImage, `${sel}: both gradients (gloss, tint) are stripped under forced-colors ` +
        '— declaring Canvas explicitly is the fix, not fighting the strip').toBe('none');
      expect(got.backdrop, `${sel}: backdrop-filter is NOT auto-stripped by forced-colors ` +
        '(measured unchanged on the unedited file) and must be dropped explicitly').toBe('none');
    }

    await page.emulateMedia({ forcedColors: 'none' });
    expectNoFaults(faults, 'under forced-colors');
  });

  test('the plate and the literal field get an explicit opaque surface and a hairline', async ({ page }) => {
    const faults = await openMockup(page);
    await page.emulateMedia({ forcedColors: 'active' });

    for (const sel of ['.plate', '.lit']) {
      const got = await page.locator(sel).first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bg: cs.backgroundColor, borderWidth: cs.borderTopWidth };
      });
      expect(got.bg, `${sel}: a plate with no declared border and only its own translucent wash ` +
        'reads as nothing next to a pane that has gone fully transparent').not.toMatch(/^rgba\(.*, 0\)$/);
      expect(got.borderWidth, `${sel} must draw a hairline so the data surface has an edge`).not.toBe('0px');
    }

    await page.emulateMedia({ forcedColors: 'none' });
    expectNoFaults(faults, 'reading the plate and the literal field');
  });

  test('the four tier segments keep four distinct border styles', async ({ page }) => {
    const faults = await openMockup(page);
    await showScreen(page, 'preview');
    await page.emulateMedia({ forcedColors: 'active' });

    // No single event runs all four tiers (EVENT_TIERS in the mockup's own
    // script), so this reads pinned/restored/index off 'compact' and jit off
    // 'tool' — two renders, four tiers, none skipped.
    await page.selectOption('#evsel', 'compact');
    const compact = await page.evaluate(() => {
      const out: Record<string, string> = {};
      for (const cls of ['pinned', 'restored', 'index']) {
        const el = document.querySelector(`.seg.${cls}`);
        out[cls] = el ? getComputedStyle(el).borderTopStyle : 'MISSING';
      }
      return out;
    });
    expect(compact['pinned']).toBe('solid');
    expect(compact['restored']).toBe('dotted');
    expect(compact['index']).toBe('double');

    await page.selectOption('#evsel', 'tool');
    const jitStyle = await page.evaluate(() => {
      const el = document.querySelector('.seg.jit');
      return el ? getComputedStyle(el).borderTopStyle : 'MISSING';
    });
    expect(jitStyle).toBe('dashed');

    // The point of the check: under a solid background-colour flattened to
    // one system tone, a border-style is the one signal left that still
    // tells the four apart — so no two of the four may share one.
    const all = [compact['pinned'], jitStyle, compact['restored'], compact['index']];
    expect(new Set(all).size, 'all four tiers must render a DIFFERENT border style').toBe(4);

    await page.emulateMedia({ forcedColors: 'none' });
    expectNoFaults(faults, 'switching events under forced-colors');
  });

  test('the chip glyphs survive as content, and the six icons restate their stroke', async ({ page }) => {
    const faults = await openMockup(page);
    await showScreen(page, 'preview');
    await page.emulateMedia({ forcedColors: 'active' });

    const glyph = await page.evaluate(() => {
      const chip = document.querySelector('.chip.gov');
      return chip ? getComputedStyle(chip, '::before').content : null;
    });
    expect(glyph, '`content` is exactly what forced-colors cannot strip (spec §3 primitive 6)')
      .toBe('"◆ "');

    // `CanvasText` is polarity-sensitive to `prefers-color-scheme`, measured
    // directly: the same query that gives `rgb(0, 0, 0)` with no colour
    // scheme forced gives `rgb(255, 255, 255)` once `colorScheme: 'dark'` is
    // set — and `e2e/playwright.config.ts` pins exactly that, project-wide,
    // deliberately ("Dark only… the mockup has no prefers-color-scheme
    // branch left to answer"). White-on-black is the correct read for THIS
    // suite's pinned context; it is not a different bug, and the CSS itself
    // never hardcodes a polarity either way — `stroke:CanvasText` is exactly
    // what lets it flip correctly with the OS theme it is asked about.
    const ids = ['i-refresh', 'i-copy', 'i-open', 'i-confirm', 'i-search', 'i-add'] as const;
    for (const id of ids) {
      const stroke = await page.evaluate((i) => getComputedStyle(document.getElementById(i)!).stroke, id);
      expect(stroke, `${id} must restate stroke by system colour name under forced-colors`)
        .toBe('rgb(255, 255, 255)'); // CanvasText, resolved against this suite's pinned dark colorScheme
    }

    await page.emulateMedia({ forcedColors: 'none' });
    expectNoFaults(faults, 'reading chip glyphs and icon strokes');
  });

  test('every screen still runs clean under forced-colors', async ({ page }) => {
    const faults = await openMockup(page);
    await page.emulateMedia({ forcedColors: 'active' });
    for (const screen of SCREENS) await showScreen(page, screen);
    await page.emulateMedia({ forcedColors: 'none' });
    expectNoFaults(faults, 'visiting every screen under forced-colors');
  });
});

/**
 * `prefers-reduced-transparency` has no typed Playwright `emulateMedia`
 * option, so this arms the CDP feature BEFORE navigation (the same order
 * `Emulation.setEmulatedMedia` is documented to need for a feature to be
 * active from first paint) and returns the fault collector `openMockup`
 * would otherwise have set up itself.
 */
async function openMockupReducedTransparency(page: import('@playwright/test').Page) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedMedia', {
    media: 'screen',
    features: [{ name: 'prefers-reduced-transparency', value: 'reduce' }],
  });
  return openMockup(page);
}

test.describe('prefers-reduced-transparency: reduce', () => {
  test('the pane, the rail and the header compute an opaque background and drop backdrop-filter', async ({ page }) => {
    const faults = await openMockupReducedTransparency(page);

    const matches = await page.evaluate(() => matchMedia('(prefers-reduced-transparency: reduce)').matches);
    expect(matches, 'the emulation must actually take effect before anything below means something').toBe(true);

    for (const sel of ['.card.pane', '.rail', '.hdr']) {
      const got = await page.locator(sel).first().evaluate((el) => {
        const cs = getComputedStyle(el);
        return { bgImage: cs.backgroundImage, backdrop: cs.backdropFilter };
      });
      // --pane-tint's opaque values (#12141c / #101219 — spec-given hex,
      // Task 11 Step 4) serialise as rgb(), never rgba(); the translucent
      // tint this register replaces was rgba(9, 10, 16, .56–.64).
      expect(got.bgImage, `${sel}: --pane-tint must be fully opaque under this register`)
        .toContain('rgb(18, 20, 28)');
      expect(got.bgImage, `${sel}: the OLD translucent tint must be gone`)
        .not.toContain('rgba(9, 10, 16');
      expect(got.backdrop, `${sel}: backdrop-filter must be dropped, matching every consumer of ` +
        'the shared .pane,.rail,.hdr material rule — not .pane alone').toBe('none');
    }

    expectNoFaults(faults, 'under reduced transparency');
  });

  test('the plate goes fully opaque, and the lift (box-shadow) is untouched', async ({ page }) => {
    const faultsBaseline = await openMockup(page);
    const baselineShadow = await page.locator('.card.pane').first()
      .evaluate((el) => getComputedStyle(el).boxShadow);
    expectNoFaults(faultsBaseline, 'reading the baseline lift');

    const faults = await openMockupReducedTransparency(page);
    const after = await page.evaluate(() => {
      const pane = document.querySelector('.card.pane')!;
      const plate = document.querySelector('.plate');
      return {
        boxShadow: getComputedStyle(pane).boxShadow,
        plateBg: plate ? getComputedStyle(plate).backgroundColor : null,
      };
    });
    expect(after.plateBg, '--plate must be fully opaque — no rgba() alpha left').not.toMatch(/rgba\(/);
    expect(after.boxShadow, 'the lift (box-shadow) is explicitly untouched by this register — ' +
      '"nothing else changes" (Task 11 Step 4)').toBe(baselineShadow);

    expectNoFaults(faults, 'under reduced transparency');
  });

  test('every screen still runs clean under reduced transparency', async ({ page }) => {
    const faults = await openMockupReducedTransparency(page);
    for (const screen of SCREENS) await showScreen(page, screen);
    expectNoFaults(faults, 'visiting every screen under reduced transparency');
  });
});
