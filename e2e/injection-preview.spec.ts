/**
 * **The injection preview's delivered rows — hit-tested, not read off the CSS.**
 *
 * ── WHAT THIS FILE USED TO ASSERT, AND WHY IT DOES NOT ────────────────────
 *
 * Until 2026-08-26 this measured repaint Task 6's ROW ↔ BLOCK LINKAGE: a
 * tilted `.pane` of `.row`s on the left, a tilted `.pane` holding a `.lit` of
 * `.blk`s on the right, and selecting a row lit its paired block to opacity 1
 * while every other block sat at exactly .58. Two assertions a static scan of
 * the stylesheet could not make — that a click reached a row inside `.pair`'s
 * 3D context at all (§7.1: 3D and clickability fight each other silently), and
 * that the linkage fired.
 *
 * **The design of record removed that plane**, owner-approved, on the same day.
 * It was the only untitled card in the product and it duplicated the item
 * detail pane, which draws the same body plus type, status, tier, scope,
 * governs, file and the twelve-week sparkline. Delivered and Why-not went back
 * side by side in `.two`, the pre-repaint layout, and a row now opens the pane.
 *
 * So the linkage assertions are gone because the linkage is gone — NOT because
 * they were failing and were quieter to delete. What replaced them measures the
 * behaviour that replaced it, at the same depth and in a real browser:
 *
 *  1. **A click reaches the row at its own centre.** Worth keeping even with
 *     the 3D gone: `.row` is the one primitive that moves, and `elementFromPoint`
 *     at the row's own centre is the only proof that the thing which moves is
 *     also the thing which answers.
 *  2. **The row carries `data-id`, so the shell's delegated handler opens the
 *     pane.** That is the whole replacement for the linkage — one behaviour,
 *     one listener, shared by every id in the product — and if a row ever loses
 *     the attribute it goes back to being a button that does nothing, which is
 *     the defect the owner reported twice before the pane existed.
 */
import { test, expect } from '@playwright/test';
import { expectNoFaults, openMockup } from './mockup.ts';

const TARGET = 'RULE-never-log-customer-email';

test('clicking a delivered row reaches the row at its own centre', async ({ page }) => {
  const faults = await openMockup(page);

  const row = page.locator(`#deliveredRows .row[data-id="${TARGET}"]`);
  const box = await row.boundingBox();
  if (!box) throw new Error('the row must have a layout box to hit-test');
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const hitId = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.row')?.getAttribute('data-id') ?? null,
    [centre.x, centre.y] as const,
  );
  expect(hitId, 'the row is the one primitive that moves, so the element that answers at its '
    + 'own centre must be the row itself and not a parent that lifted over it')
    .toBe(TARGET);

  expectNoFaults(faults, 'locating the delivered row');
});

test('a delivered row opens the item detail pane, filled with that item', async ({ page }) => {
  const faults = await openMockup(page);

  const pane = page.locator('#pane');
  await expect(pane, 'the pane starts closed').toBeHidden();

  await page.locator(`#deliveredRows .row[data-id="${TARGET}"]`).click();

  await expect(pane, 'a row carries data-id, so the shell\'s delegated handler opens the pane — '
    + 'the same path every other id in the product takes').toBeVisible();
  await expect(page.locator('#paneid'), 'the pane shows the id that was clicked, not the one that '
    + 'happened to be open before').toHaveText(TARGET);

  // The grid gains its third column, which is what makes the pane a column
  // rather than an overlay sitting on top of the screen it describes.
  await expect(page.locator('#app')).toHaveClass(/pane-open/);

  expectNoFaults(faults, 'opening the pane from a delivered row');
});

test('every delivered row can open the pane, not only the first', async ({ page }) => {
  const faults = await openMockup(page);

  const ids = await page.locator('#deliveredRows .row').evaluateAll(
    (rows) => rows.map((r) => r.getAttribute('data-id')),
  );
  expect(ids.length, 'the delivered card must render its rows to be worth measuring')
    .toBeGreaterThan(1);
  expect(ids.every((id) => id !== null && id !== ''),
    'a row without data-id is a button that does nothing — the defect the owner reported twice')
    .toBe(true);

  for (const id of ids) {
    await page.locator(`#deliveredRows .row[data-id="${id}"]`).click();
    await expect(page.locator('#paneid'), `row ${id} must open its OWN item`).toHaveText(id!);
  }

  expectNoFaults(faults, 'opening the pane from every delivered row');
});
