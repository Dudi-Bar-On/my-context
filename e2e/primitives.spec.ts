/**
 * **3D and clickability fight each other, silently — §7.1, verified in a real
 * browser rather than reasoned about from CSS text.**
 *
 * `docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` Task 3 Step 3
 * writes this exact check under `test/ui/primitives.test.ts`, using
 * `page.$` / `page.evaluate`. That cannot work there: `e2e/mockup.ts`'s own
 * header (and `e2e/playwright.config.ts`'s) explains why `e2e/` exists as a
 * directory separate from `test/` at all — a Playwright spec is not a
 * `node:test` file, `npm test`'s glob would either fail to run it or throw
 * off `check:test-glob`'s file-count parity. The hit-test needs a real
 * browser laying out a real 3D transform, which only a Playwright spec can
 * give it, so it lives here. `test/ui/primitives.test.ts` carries everything
 * about the eight primitives a static scan CAN prove instead.
 *
 * The rule this file exists to hold: **perspective goes on the container
 * (`.pair`), and nothing is ever pushed behind it with a negative
 * `translateZ`.** A `translateZ(-14px)` on a tilted child pushes it behind
 * its own parent's plane in the 3D context, and the PARENT answers
 * `elementFromPoint` at the child's own centre — not because the click
 * handler was wrong, but because the click never reached the child at all.
 *
 * Two tests, not one, for the reason `test/ui/faint-usage.test.ts` gives for
 * its own controls: a hit-test that only ever asserts success cannot be told
 * apart from a hit-test whose page never loaded. The second test recreates
 * the exact forbidden shape — its own isolated fixture, not the mockup's
 * primitive rule — and asserts the click is swallowed, so the first test's
 * green has been proven capable of red.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { openMockup, expectNoFaults } from './mockup.ts';

/**
 * Build a `.pair > .plane.l > .row` fixture out of the mockup's OWN loaded
 * stylesheet (no CSS is duplicated here) and append it to the live page,
 * positioned so its centre is unambiguous. Returns the row's centre point.
 */
async function mountTiltedRow(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const pair = document.createElement('div');
    pair.className = 'pair';
    pair.style.cssText = 'position:fixed;inset-block-start:40px;inset-inline-start:40px;' +
      'inline-size:260px;block-size:120px;z-index:9999';
    const plane = document.createElement('div');
    plane.className = 'plane l';
    plane.style.cssText = 'inline-size:100%;block-size:100%';
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'primitives-spec-row';
    row.textContent = 'hit-test row';
    plane.appendChild(row);
    pair.appendChild(plane);
    document.body.appendChild(pair);
    const r = row.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
}

async function unmountFixture(page: Page): Promise<void> {
  await page.evaluate(() => document.querySelector('.pair')?.remove());
}

test('a tilted .plane row is still clickable at its own centre', async ({ page }) => {
  const faults = await openMockup(page);
  const centre = await mountTiltedRow(page);

  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.row')?.id ?? null,
    [centre.x, centre.y] as const,
  );
  expect(hit, 'perspective sits on .pair; .plane rotates but nothing is pushed ' +
    'behind its own parent, so the row at its own centre must answer for itself')
    .toBe('primitives-spec-row');

  await unmountFixture(page);
  expectNoFaults(faults, 'building and removing the fixture');
});

test('the forbidden shape — negative translateZ on the tilted child — actually swallows the click', async ({ page }) => {
  const faults = await openMockup(page);

  // A deliberately BROKEN sibling of the primitive rule, scoped to its own
  // class so it cannot leak into `.plane` anywhere else on the page. This is
  // §7.1's defect, reconstructed on purpose so the first test's pass means
  // something.
  const centre = await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = '.pair-broken{perspective:1600px;transform-style:preserve-3d}' +
      '.plane-broken{transform:rotateY(3.2deg) translateZ(-14px);transform-style:preserve-3d}';
    document.head.appendChild(style);

    const pair = document.createElement('div');
    pair.className = 'pair-broken';
    pair.style.cssText = 'position:fixed;inset-block-start:220px;inset-inline-start:40px;' +
      'inline-size:260px;block-size:120px;z-index:9999';
    const plane = document.createElement('div');
    plane.className = 'plane-broken';
    plane.style.cssText = 'inline-size:100%;block-size:100%';
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'primitives-spec-row-broken';
    row.textContent = 'this row should NOT answer elementFromPoint';
    plane.appendChild(row);
    pair.appendChild(plane);
    document.body.appendChild(pair);
    const r = row.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });

  const hit = await page.evaluate(
    ([x, y]) => document.elementFromPoint(x, y)?.closest('.row')?.id ?? null,
    [centre.x, centre.y] as const,
  );
  expect(hit, 'a negative translateZ pushes the tilted child behind its own parent\'s ' +
    'plane, so the container — not the row — must be what elementFromPoint returns here; ' +
    'if this ever comes back "primitives-spec-row-broken" the control itself has stopped meaning anything')
    .not.toBe('primitives-spec-row-broken');

  await page.evaluate(() => {
    document.querySelector('.pair-broken')?.remove();
    document.head.querySelector('style:last-of-type')?.remove();
  });
  expectNoFaults(faults, 'building and removing the broken-control fixture');
});
