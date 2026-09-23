// @basis TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
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
import { seededTest, expect } from './scratch-corpus.ts';
import { realInjections } from './seeds.ts';
import { settleScreen } from './settle.ts';

/**
 * **WHAT THIS FILE REQUIRES: a session that has actually been delivered to, so
 * that some screen draws an item id.** Declared here, arranged by the fixture,
 * rather than hoped for — `e2e/scratch-corpus.ts`'s whole reason for existing.
 *
 * ── WHY IT STOPPED BEING TRUE OF THE AMBIENT CORPUS ───────────────────────
 *
 * Every test below needs ONE `button.linkid` to click. The preview's linkids
 * are the CARRIED block (`screens/preview.js`, `.carrieditem`), and carried
 * means "delivered to this session earlier" — so a session that has carried
 * nothing draws none, which `app-layout.spec.ts`'s own carry test already
 * treats as a legitimate state rather than a failure.
 *
 * Until 2026-09-23 this file rode the live machine's accumulated session
 * state and that state happened to contain a delivery. `e2e/frozen-corpus.ts`
 * then sandboxed the session state per run — deliberately, under `rulings/114`,
 * so that a red is attributable and a local run agrees with a fresh clone —
 * and a clean checkout has NO delivery history at all. Measured on the full
 * gate that night: *"no button.linkid rendered on the boot screen or on any of
 * injected, doctor, learn, coverage or decay"*, on a corpus holding 1,116
 * items. Nothing about the product had changed; the state this file was
 * leaning on had simply stopped being ambient.
 *
 * `realInjections()` is that state, PRODUCED rather than authored: the real
 * hooks are fed the real payloads on stdin in a private copy of this corpus,
 * which is deleted when the worker ends. **No `squeezeBudgets`**, for the same
 * reason `injected-empty.spec.ts` gives: at the real budgets a session start
 * delivers ~45 items, and it is the delivery that draws the ids.
 *
 * `seededTest` and not `writingSeededTest`, because nothing here writes: every
 * test opens a pane, reads it and closes it.
 */
const test = seededTest(realInjections());

/**
 * The walk visits up to six screens and each one may take a settle, so the
 * 30-second default is the wrong bound to fail against — it would report "test
 * timeout" where the interesting sentence is which screens drew what. The twin
 * itself is worker-scoped and charged to the fixture's own budget.
 */
test.beforeEach(() => { test.setTimeout(120_000); });

/**
 * The screen that was found to draw an id, remembered for the worker.
 *
 * The twin is worker-scoped and its corpus cannot move under these tests, so
 * the answer cannot differ between them — and the walk is up to six screen
 * loads nobody should pay for four times. Same move, same reason, as
 * `pane-size.spec.ts`' own `chosen`.
 */
let linkingScreen: string | null = null;

/** The first id button on the injection preview — the screen the owner was on.
 *
 * **Scoped to `#screen`, since 2026-08-31.** `.linkid` is the shell's link-button
 * primitive and the status strip started using it that day, for the two corpus
 * doors the owner ruled in (the doctor notice count and the review queue). An
 * unscoped `button.linkid` therefore resolves to a STRIP control, whose click
 * routes to another screen instead of opening the item pane — so this helper
 * would hand every test below a button that cannot do the thing they measure.
 *
 * The same hazard one container along is already written down at
 * `an id on a different screen opens the pane too`: the router keeps every
 * visited screen in the DOM, so an unscoped selector finds whichever screen was
 * visited first. The fix is the same one, applied at the shell boundary.
 */
async function firstLink(page: import('@playwright/test').Page) {
  /*
   * **THE SCREEN IS DISCOVERED, NOT ASSUMED — corrected 2026-09-23**, and the
   * move is the one `an id on a different screen opens the pane too` below
   * already makes, in its own words: *"WHICH of them renders one depends on
   * what the corpus holds … Hard-coding a screen made this test skip, and a
   * skipped test proves nothing about the property it is named for."* The same
   * is true of the screen the app happens to BOOT on, which is what this
   * helper was trusting.
   *
   * It stopped being true the moment the browser suite started from the
   * session state a clean checkout has (`e2e/frozen-corpus.ts`): the
   * preview's `linkid`s are the CARRIED block, and a session that has carried
   * nothing draws none — which `app-layout.spec.ts`'s own carry test already
   * treats as a legitimate state rather than a failure. Measured on the full
   * gate, 2026-09-23: *"no button.linkid rendered"*, three tests, both
   * projects, on a corpus holding 1,116 items.
   *
   * So the property is measured where the product offers it. This is not a
   * weaker assertion — every test below still requires a real `linkid` to
   * exist and to open the pane; what it no longer requires is that a
   * particular screen be the one holding it.
   *
   * **AND IT WAITS FOR THE SCREEN TO HAVE DRAWN, corrected 2026-09-23 (B4).**
   * The first cut of this walk asked `candidate.isVisible({ timeout })`, and
   * `isVisible()` does not retry — the option is inert. So each screen was
   * inspected in the same tick as its section attached, which is the tick
   * `route()` writes its holding chip into and nothing else, and the walk
   * reported "no linkid anywhere" after looking at five empty sections. The
   * settle is `e2e/settle.ts`' shared one, with the linkid named as the thing
   * that must have MATCHED — the same instrument `pane-size.spec.ts` uses to
   * walk the same screens for the same reason.
   */
  const walked: string[] = [];
  let link = null;
  for (const screen of linkingScreen === null
    ? ['preview', 'injected', 'doctor', 'learn', 'coverage', 'decay']
    : [linkingScreen]) {
    await page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
    await expect(page.locator(`[data-p="${screen}"]`)).toBeAttached({ timeout: 10_000 });
    const candidate = page.locator(`[data-p="${screen}"] button.linkid`).first();
    const { settled, count } = await settleScreen(page, screen, { requires: 'button.linkid' });
    const found = await candidate.count();
    walked.push(`${screen}: ${settled ? 'drew' : 'never settled'}, ${count} nodes, ${found} linkid`);
    if (found > 0) { linkingScreen = screen; link = candidate; break; }
  }
  expect(link, 'no button.linkid rendered on any of preview, injected, doctor, learn, coverage '
    + `or decay, so this test cannot measure what it is for — walked ${walked.join(' · ')}. The `
    + 'twin is seeded with `realInjections()` precisely so that the preview has a CARRIED block '
    + 'to draw ids from; if it drew none, the seed did not take').not.toBeNull();
  return link!;
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
  // **And it must be a DIFFERENT screen from the one the first click was on.**
  // `firstLink` now discovers its screen rather than assuming the preview, so
  // the list it chose from has to be the list this walk excludes, or a run
  // where it picked `coverage` would measure `coverage` twice and call the
  // second reading a route change.
  for (const screen of ['preview', 'injected', 'doctor', 'learn', 'coverage', 'decay']
    .filter((name) => name !== linkingScreen)) {
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
