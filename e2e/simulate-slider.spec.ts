/**
 * **The budget simulator can reach the budget in force, and says the true one.**
 *
 * `simulate.js` built its slider from a literal — *"the mockup's own slider
 * bounds, verbatim: `min=0 max=12000 step=50`"* — and then assigned the budget
 * actually in force to `slider.value`. Assigning above an
 * `input[type=range]`'s `max` SILENTLY CLAMPS, so a budget over 12,000 drew a
 * slider reading 12,000 with nothing saying the number had been changed.
 *
 * The one screen whose job is to tell you what a budget does was showing a
 * budget nobody had set. Demonstrated as arithmetic on 2026-08-28:
 *
 *     budget 6,000   -> slider showed  6,000
 *     budget 16,000  -> slider showed 12,000   <- silently wrong
 *     budget 22,000  -> slider showed 12,000   <- silently wrong
 *
 * The owner's `pinned` had been 16,000 for the whole life of this screen, so
 * the defect was live the entire time and nothing pinned the bound in any test.
 *
 * `REQ-configure-and-the-simulator-agree-on-the-budgets-whatever` is the rule it
 * breaks: agreeing on a value is not enough if one screen cannot display it.
 *
 * **This test RESTORES the budget it writes.** `e2e/app.ts` refuses to start
 * without the one shared `.demo-corpus`, and the workers run in parallel, so a
 * spec that leaves a budget changed leaves it changed underneath every other
 * spec — the hazard `plan:execute seq:7` names in its own words. Restoring is
 * not politeness; it is the difference between a fixture and a mutation.
 */
import { expect, test } from './app.ts';

const CONFIG = '[data-p="config"]';
const SIM = '[data-p="simulate"]';

/** Comfortably above the mockup's 12,000 literal, and not a round number that
 *  could coincide with a default anywhere. */
const ABOVE_THE_LITERAL = 15_350;

test('the slider reaches a budget above the mockup literal, and shows the true value', async ({ app }, testInfo) => {
  // **ONE PROJECT, and that is a fixture decision rather than reduced coverage.**
  //
  // This spec WRITES a budget, and the two projects run in parallel against the
  // one shared `.demo-corpus` that `e2e/app.ts` refuses to start without. Run in
  // both, the two copies of this test write and restore the same `jit` value on
  // top of each other: the first run's restore lands while the second is
  // asserting, and the second fails on a number the first put back. Measured
  // exactly that way on 2026-08-28 — green on chromium, red on chrome, same
  // code, same moment.
  //
  // The subject is a DOM clamp on `input[type=range]`, which is identical in
  // both projects — `chrome` is the same engine through a different channel
  // (`e2e/playwright.config.ts`: "they are not two engines"). So a second run
  // buys no engine coverage and costs determinism.
  //
  // The real remedy is a per-spec workspace, which the harness does not offer
  // today; `e2e/live-refresh.spec.ts`'s REQ test writes the same budget and has
  // the same latent race, currently unhit because it runs alone in its file.
  test.skip(testInfo.project.name !== 'chromium',
    'writes a shared-fixture budget; see the note above');

  const { page } = app;

  // --- read what is in force, so it can be put back -------------------------
  await page.evaluate(() => { location.hash = '#/config'; });
  // **The Budgets PANE**, not the Configure screen. `plan:config seq:1` split
  // Configure into one pane per configuration subject on 2026-08-29, and three
  // of the four panes now carry the house's Copy-and-Execute control — so
  // `.confirm` and `.execresult` appear four times on this screen where they
  // appeared once, and an unscoped locator is a strict-mode violation rather
  // than a wrong element.
  const BUDGETS = `${CONFIG} [data-pane="budgets"]`;
  const jit = page.locator(`${BUDGETS} input[aria-label="budgets.jit"]`);
  await jit.waitFor({ state: 'visible', timeout: 20_000 });
  const original = await jit.inputValue();
  expect(original, 'the config screen must report a budget before this test changes one')
    .toMatch(/^\d+$/);

  try {
    await jit.fill(String(ABOVE_THE_LITERAL));
    await page.getByRole('button', { name: 'Write budgets' }).click();
    // The confirm is the approval boundary for a budget write; it is answered,
    // never bypassed. `button.go` is the control's own class — the label is a
    // translated string and selecting on it would fail in Hebrew.
    await expect(page.locator(`${BUDGETS} .confirm`)).toBeVisible({ timeout: 20_000 });
    await page.locator(`${BUDGETS} .confirm button.go`).click();
    await expect(page.locator(`${BUDGETS} .execresult`)).toBeVisible({ timeout: 20_000 });

    await page.evaluate(() => { location.hash = '#/simulate'; });
    const slider = page.locator(`${SIM} input[type="range"]`).first();
    await slider.waitFor({ state: 'visible', timeout: 20_000 });

    // The tier picker starts on `jit`, which is the tier just written.
    await expect
      .poll(async () => Number(await slider.getAttribute('max')), { timeout: 20_000 })
      .toBeGreaterThanOrEqual(ABOVE_THE_LITERAL);

    const shown = Number(await slider.inputValue());
    expect(shown, 'the slider clamped the budget in force to its literal maximum and drew a '
      + 'number nobody set. That is not a missing feature — it is the budget screen misreporting '
      + 'the budget.')
      .toBe(ABOVE_THE_LITERAL);
  } finally {
    // Put it back whatever happened above, including a failed assertion.
    await page.evaluate(() => { location.hash = '#/config'; });
    await jit.waitFor({ state: 'visible', timeout: 20_000 });
    await jit.fill(original);
    await page.getByRole('button', { name: 'Write budgets' }).click();
    await page.locator(`${BUDGETS} .confirm button.go`).click({ timeout: 20_000 }).catch(() => {});
  }
});
