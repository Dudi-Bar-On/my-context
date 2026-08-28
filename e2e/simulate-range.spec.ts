/**
 * **The simulator can simulate RAISING a budget, and the thumb goes where you
 * put it** — `TASK-the-slider-s-range-has-its-own-control-and-raising-a-budget`.
 *
 * ── WHAT WAS MEASURED, AND WHY IT IS NOT AN ENHANCEMENT ────────────────────
 *
 * Driven with Playwright against this repository's own corpus on 2026-08-29,
 * before any of this landed:
 *
 *     initial       min=0 max=16000 step=50 value=16000   <- thumb pinned hard right
 *     click at 40%                          value=1550
 *     click at 95%                          value=1550    <- the same rung
 *
 * Two defects in one control. The bound was `max(12000, budget in force, last
 * rung)` and the budget in force was 16,000, so `value === max` AT REST by
 * construction — the thumb could only ever travel LEFT. And the drag SNAPPED to
 * a rung, of which this corpus has eighteen, every one at or below 1,550: the
 * whole right-hand nine tenths of the track was unreachable, and two clicks a
 * third of the width apart produced the same number.
 *
 * On a screen whose subtitle reads *"Raising a budget can evict an item"* and
 * which ships a help topic titled *"Why raising a budget can remove an item"*,
 * the one direction the reader is invited to explore was the one direction the
 * control could not go. That is the screen unable to answer its own question.
 *
 * ── WHAT THIS SPEC PINS ────────────────────────────────────────────────────
 *
 * The four properties that fix is made of, in a browser, over the real DOM:
 * a free thumb, a range control that raises the bound, a bound that refuses to
 * fall below the budget in force, and the range reaching the injection
 * preview's ribbon — the third surface, and the one the task names as most
 * likely to be forgotten.
 *
 * **It writes nothing.** `e2e/simulate-slider.spec.ts` documents in full why a
 * spec that changes a budget is a spec that changes it underneath every other
 * worker on the one shared `.demo-corpus`; that spec has to write and restores
 * carefully. This one does not need to: the range maximum is client state, so
 * every assertion below is reversible by closing the page, and both projects can
 * run it in parallel with no fixture contention at all.
 */
import { expect, test } from './app.ts';

const SIM = '[data-p="simulate"]';
const PREVIEW = '[data-p="preview"]';

/** Comfortably above any budget or last rung the demo corpus can produce. */
const WIDE = 40_000;

/** A range small enough that any real budget in force exceeds it. */
const NARROW = 7;

test('the range control raises the bound, and the thumb then travels right', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });

  const slider = page.locator(`${SIM} input[type="range"]`).first();
  await slider.waitFor({ state: 'visible', timeout: 20_000 });
  const field = page.locator(`${SIM} input[aria-label="simulate.rangeMax"]`);
  await field.waitFor({ state: 'visible', timeout: 20_000 });

  // **Wait for the screen to have SETTLED, not merely to have painted.**
  // `slider.max` and `slider.value` are both assigned twice: once as the
  // mockup's literals while the tree is built, and again when `/api/simulate`
  // answers with the budgets and `/api/simulate/sweep` answers with the rungs.
  // Polling on `max` alone reads the first assignment instantly and every
  // measurement below then races the second — measured exactly that way on
  // 2026-08-29, where a click landed on 9,684 and the arriving budget put the
  // thumb back to 4,842 two frames later. The fits table and the ladder are
  // each drawn from one of those two responses, so a row in both is the signal
  // that both have landed.
  const fitsRows = page.locator(`${SIM} #simtbl tr`);
  const ladderRows = page.locator(`${SIM} #ladder > div`);
  await expect.poll(async () => await fitsRows.count(), { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(async () => await ladderRows.count(), { timeout: 20_000 }).toBeGreaterThan(0);

  // --- 1 · the step is single tokens, not the mockup's fifty ----------------
  expect(await slider.getAttribute('step'),
    'a coarse step is half of what the owner called unusable').toBe('1');

  // --- 2 · a click lands where the pointer is, not on the nearest rung ------
  const before = Number(await slider.getAttribute('max'));
  const box = (await slider.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.8, box.y + box.height / 2);
  const landed = Number(await slider.inputValue());
  // A range input's own hit geometry inset the thumb's half-width at each end,
  // so 80% of the TRACK is a few per cent off 80% of the VALUE. The tolerance
  // is for that and nothing else: a snap to this corpus's rungs misses by an
  // order of magnitude, not by five per cent.
  expect(Math.abs(landed - before * 0.8) / before,
    `a click at 80% of the track produced ${landed} against a bound of ${before}. `
    + 'Before this task the same click produced the nearest rung, which on the real corpus '
    + 'was 1,550 whether you clicked at 40% or at 95%.')
    .toBeLessThan(0.05);

  // --- 3 · the range control raises the bound, on its button and not before -
  await field.fill(String(WIDE));
  expect(Number(await slider.getAttribute('max')),
    'the field moved the bound before its button was pressed — setting a range is an act '
    + 'with a receipt, not a silent field')
    .toBe(before);

  const held = Number(await slider.inputValue());
  await page.getByRole('button', { name: 'Set range' }).click();
  await expect.poll(async () => Number(await slider.getAttribute('max')), { timeout: 10_000 })
    .toBe(WIDE);

  // The VALUE is untouched by a range change. Dragging is exploration within a
  // range; setting the range is a decision about what range is worth exploring,
  // and a control that moved both would be the conflation this task undoes.
  expect(Number(await slider.inputValue())).toBe(held);

  // --- 4 · and NOW the thumb can travel right, which is the whole point -----
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  expect(Number(await slider.inputValue()),
    'the simulator still cannot simulate RAISING a budget past the one in force')
    .toBeGreaterThan(held);

  // --- 5 · a range below the budget in force is refused by the bound --------
  // Never clamped: `slider.value` above `max` clamps silently, so a slider that
  // cannot reach the budget in force draws a number nobody set.
  await field.fill(String(NARROW));
  await page.getByRole('button', { name: 'Set range' }).click();
  await expect.poll(async () => Number(await slider.getAttribute('max')), { timeout: 10_000 })
    .toBeGreaterThan(NARROW);
});

test('a raised range reaches the injection preview ribbon', async ({ app }) => {
  const { page } = app;
  await page.evaluate(() => { location.hash = '#/simulate'; });
  const field = page.locator(`${SIM} input[aria-label="simulate.rangeMax"]`);
  await field.waitFor({ state: 'visible', timeout: 20_000 });

  // `pinned` rather than the default `jit`: the ribbon draws a labelled track
  // only for a tier the event actually RAN, and `jit` is reached by `tool`
  // alone, so a session-start preview would draw it absent and there would be
  // no label to read. The tier picker's buttons carry the tier's own name.
  await page.locator(`${SIM} #tierPick button`, { hasText: 'pinned' }).click();
  await field.fill(String(WIDE));
  await page.getByRole('button', { name: 'Set range' }).click();

  await page.evaluate(() => { location.hash = '#/preview'; });
  const ribbons = page.locator(`${PREVIEW} #ribbons`);
  await ribbons.waitFor({ state: 'visible', timeout: 20_000 });

  // The ribbon derives each track's width from its tier budget, so a raised
  // maximum has to reach `screens/preview.js` and not only `simulate.js` — the
  // owner's fourth part, and the surface the task names as most forgettable.
  await expect.poll(
    async () => await ribbons.locator('.ribbon').first().innerText(),
    { timeout: 20_000 },
  ).toContain('to 40,000');
});
