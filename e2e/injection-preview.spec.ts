/**
 * **The injection preview's row ↔ block linkage — hit-tested, not read off the
 * CSS.**
 *
 * `docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` Task 6 composes
 * the hero screen: a tilted `.pane` of `.row`s on the left, a tilted `.pane`
 * holding a `.lit` of `.blk`s on the right. Selecting a row is the screen's
 * whole job — "you are never looking at a rule without seeing the text it
 * produced, and never looking at injected text without seeing which rule
 * produced it" — and the row only earns the right to move (§3 #2, the only
 * primitive that moves) because clicking it does exactly that.
 *
 * Two things a static scan of the stylesheet cannot prove, the same split
 * `e2e/primitives.spec.ts` draws for its own hit-test:
 *
 *  1. **The click actually reaches the row at its own centre.** Both planes
 *     sit inside `.pair`'s `perspective` and `.plane.l`/`.plane.r` tilt with
 *     `rotateY` — real 3D, and §7.1 is explicit that 3D and clickability fight
 *     each other silently unless hit-tested in a real browser.
 *  2. **The linkage itself**: the clicked row ends up `aria-pressed="true"`
 *     and lifted the way `:hover` lifts it, its paired `.blk` reaches opacity
 *     1, and every other `.blk` sits at exactly .42 — not lower, the owner's
 *     ruling, because below that two items cannot be compared.
 */
import { test, expect } from '@playwright/test';
import { expectNoFaults, openMockup } from './mockup.ts';

test('clicking a row in the tilted left plane actually reaches the row', async ({ page }) => {
  const faults = await openMockup(page);

  const row = page.locator('#deliveredRows .row[data-choice="RULE-never-log-customer-email"]');
  const box = await row.boundingBox();
  if (!box) throw new Error('the row must have a layout box to hit-test');
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  const hitId = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.row')?.getAttribute('data-choice') ?? null,
    [centre.x, centre.y] as const,
  );
  expect(hitId, '.pair carries the perspective and .plane only rotates — nothing is pushed '
    + 'behind its own parent, so the row at its own centre must answer for itself (§7.1)')
    .toBe('RULE-never-log-customer-email');

  expectNoFaults(faults, 'locating the tilted row');
});

test('selecting a row lifts it, lights its block, and dims every other block to exactly .42', async ({ page }) => {
  const faults = await openMockup(page);

  const ids = [
    'CONST-postgres-pool-capped-at-20', 'CONST-zero-runtime-dependencies',
    'RULE-never-log-customer-email', 'INV-prices-are-integer-cents',
  ] as const;
  const row = (id: string) => page.locator(`#deliveredRows .row[data-choice="${id}"]`);
  const blk = (id: string) => page.locator(`#deliveredLit .blk[data-for="${id}"]`);

  // Before any click: the first item is selected by default, so the screen
  // never shows a rule without its text on first paint.
  await expect(row('CONST-postgres-pool-capped-at-20')).toHaveAttribute('aria-pressed', 'true');
  await expect(blk('CONST-postgres-pool-capped-at-20')).toHaveCSS('opacity', '1');

  const target = 'RULE-never-log-customer-email';
  await row(target).click();

  // `toHaveCSS`/`toHaveAttribute` poll until they match or time out, which is
  // the point: `opacity` animates over `--dur-act` under
  // `prefers-reduced-motion:no-preference` (the browser's default), so a
  // single `getComputedStyle` snapshot taken right after `click()` races the
  // transition and reads the pre-click value — this is not a fixed sleep
  // widened to paper over a flake, it is waiting on the actual end state.
  await expect(row(target), 'the clicked row is held selected').toHaveAttribute('aria-pressed', 'true');
  const liftedTransform = await row(target).evaluate((el) => getComputedStyle(el).transform);
  expect(liftedTransform, 'the selected row is lifted the same way :hover lifts it').not.toBe('none');

  const pressedCount = await page.locator('#deliveredRows .row[aria-pressed="true"]').count();
  expect(pressedCount, 'exactly one row is held selected at a time').toBe(1);

  await expect(blk(target), 'the selected block reaches full opacity').toHaveCSS('opacity', '1');
  for (const id of ids.filter((i) => i !== target)) {
    await expect(blk(id), `block ${id} must dim to exactly .42 — at .32 two items cannot be compared`)
      .toHaveCSS('opacity', '0.42');
  }

  expectNoFaults(faults, 'selecting a row');
});
