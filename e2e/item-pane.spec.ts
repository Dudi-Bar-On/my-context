/**
 * **Clicking an id opens the item detail pane.**
 *
 * The gap this closes, reported by the owner twice: every `button.linkid` in
 * the product was inert. `parts.js`'s `linkId()` wrote them on every screen and
 * its header said the shell would delegate the click — a division of labour
 * where one half was never built, so an id rendered as a button, hovered like a
 * link, and did nothing at all.
 *
 * **Why no gate caught it, which is the part worth keeping.** `styles-parity`
 * compares the selectors it is given, and `#pane` was not among them BECAUSE
 * THE APP HAD NO `#pane` — there was nothing to measure, so nobody wrote the
 * assertion. `plan:repaint seq:9c` had already rescoped that entire CSS block
 * from `.pane` to `#pane` after a collision with `.card.pane`: real work, on
 * the mockup, for an element the app did not have. A whole element the app
 * never built is invisible to a parity gate in both directions.
 *
 * So this file asserts BEHAVIOUR, not shape. Parity now covers the six rules;
 * what parity structurally cannot cover is whether the click does anything.
 */
import { test, expect } from './app.ts';

/** The first id button on the injection preview — the screen the owner was on. */
async function firstLink(page: import('@playwright/test').Page) {
  const link = page.locator('button.linkid').first();
  await expect(link, 'no button.linkid rendered — this test cannot measure what it is for')
    .toBeVisible({ timeout: 15_000 });
  return link;
}

test('clicking an id opens the pane, fills it, and widens the grid', async ({ app }) => {
  const { page } = app;
  const pane = page.locator('#pane');
  await expect(pane, 'the pane is visible before anything was clicked').toBeHidden();

  const link = await firstLink(page);
  const clickedId = (await link.textContent() ?? '').trim();
  await link.click();

  await expect(pane, 'the pane did not open — this is the defect: every linkid was inert')
    .toBeVisible({ timeout: 10_000 });

  // The id is the one thing that must be right: a pane showing another item's
  // fields under this id is worse than one that failed to open.
  await expect(page.locator('#paneid')).toHaveText(clickedId);

  // And it FILLED. The dl starts at '…' and must resolve to real values; a
  // pane stuck on its holding state is an open pane that answered nothing.
  await expect
    .poll(() => page.locator('#panetype').textContent(), {
      message: 'the pane opened but #panetype never left its holding state',
      timeout: 10_000,
    })
    .not.toBe('…');
  await expect(page.locator('#panetype'), 'the type row is empty').not.toHaveText('—');

  // The body rendered through the ONE markdown renderer, inside a <bdi>.
  await expect(page.locator('#panebody bdi'), 'the body is not inside a <bdi>')
    .toBeAttached();

  // **The grid actually widened.** Hiding versus showing the aside is only half
  // of it: `.app.pane-open` is what turns two columns into three, and without
  // the class the pane would be laid out on top of the body rather than beside
  // it. Asserted as a computed column count, not as a class name, because the
  // class is the mechanism and the columns are the requirement.
  const columns = await page.evaluate(() => {
    const app = document.getElementById('app');
    return app === null ? '' : getComputedStyle(app).gridTemplateColumns;
  });
  expect(columns.split(/\s+/).filter(Boolean).length,
    `the grid still has two columns (${columns}) — .app.pane-open did not apply, so the pane `
    + 'is not beside the body')
    .toBe(3);
});

test('the close button shuts the pane and gives the column back', async ({ app }) => {
  const { page } = app;
  (await firstLink(page)).click();
  await expect(page.locator('#pane')).toBeVisible({ timeout: 10_000 });

  await page.locator('#paneclose').click();
  await expect(page.locator('#pane'), 'close did not hide the pane').toBeHidden();

  // The column must go too. A hidden aside with `.app.pane-open` still on
  // leaves a 330px empty band down the right of every screen — invisible, and
  // still taking a third of the window.
  const columns = await page.evaluate(() => {
    const app = document.getElementById('app');
    return app === null ? '' : getComputedStyle(app).gridTemplateColumns;
  });
  expect(columns.split(/\s+/).filter(Boolean).length,
    `the pane closed but the grid kept three columns (${columns}) — an empty band is left behind`)
    .toBe(2);
});

test('Escape closes the pane, as it does every other overlay', async ({ app }) => {
  const { page } = app;
  (await firstLink(page)).click();
  await expect(page.locator('#pane')).toBeVisible({ timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#pane'), 'Escape did not close the pane').toBeHidden();
});

/**
 * **The delegation survives a route change**, which is the reason the listener
 * is on `document` and not on the buttons.
 *
 * Every screen rebuilds its whole subtree on every route and on every language
 * change. Per-button listeners would have to be re-bound by twenty-one screens
 * and one of them would forget — and the failure would look exactly like this
 * test failing on the second screen and passing on the first.
 */
test('an id on a different screen opens the pane too', async ({ app }) => {
  const { page } = app;
  (await firstLink(page)).click();
  await expect(page.locator('#pane')).toBeVisible({ timeout: 10_000 });
  await page.locator('#paneclose').click();

  // **The screen is DISCOVERED, not named.** `styles-parity` records that
  // linkids are built on four screens besides the preview — injected, the
  // coverage detail pane, doctor and learn — but WHICH of them renders one
  // depends on what the corpus holds, and against `.demo-corpus` `injected`
  // renders none. Hard-coding a screen made this test skip, and a skipped test
  // proves nothing about the property it is named for.
  //
  // `#/name`, with the slash: `route()` reads
  // `location.hash.replace(/^#\//, '')`, so a bare `#injected` matches no
  // screen key and silently falls back to the preview — which would have made
  // this pass while measuring the first screen twice.
  let link = null;
  for (const screen of ['injected', 'doctor', 'learn', 'coverage', 'decay']) {
    await page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
    await expect(page.locator(`[data-p="${screen}"]`)).toBeAttached({ timeout: 10_000 });
    // **Scoped to the section, because screens STACK.** `route()` leaves every
    // visited screen in the DOM as a sibling `<section data-p="…">` and flips
    // `hidden`, so an unscoped `button.linkid` resolves to the PREVIEW's first
    // button — still present, now hidden. Written unscoped first, and it failed
    // here for that reason rather than for the reason this test is about.
    const candidate = page.locator(`[data-p="${screen}"] button.linkid`).first();
    // **Wait for the screen to have DRAWN, not merely to have been attached.**
    // `route()` appends the `<section>` and only then awaits a dynamic import
    // and a fetch, so counting the moment the section attaches counts an empty
    // element — and this loop would then move on to the next screen and
    // eventually report that no screen renders a linkid at all.
    //
    // It measured nothing for exactly that reason on 2026-08-25: `doctor`
    // renders one and `coverage` renders three against this fixture, and the
    // loop walked past both. The race was always here; a fixture change moved
    // the timing enough to lose it, which is the only kind of luck a
    // time-dependent assertion ever has.
    //
    // Attached rather than visible: a linkid inside a card below the fold is
    // still an id this test can click, and `.first()` on a hidden-by-scroll
    // element is not a failure of the property under test.
    try {
      await candidate.waitFor({ state: 'attached', timeout: 4_000 });
    } catch { continue; }
    if (await candidate.count() > 0) { link = candidate; break; }
  }
  expect(link, 'no screen besides the preview rendered a single button.linkid, so the '
    + 'cross-screen claim cannot be measured against this corpus at all').not.toBeNull();
  await link!.click();
  await expect(page.locator('#pane'),
    'the pane opened on the first screen and not the second: the listener did not survive a route')
    .toBeVisible({ timeout: 10_000 });
});
