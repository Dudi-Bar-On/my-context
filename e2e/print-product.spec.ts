/**
 * **The print register, on the PRODUCT — not the mockup.**
 *
 * `TASK-repaint-task-10-the-print-register`'s own finding: `styles.css`
 * literally read *"No `@media print` here"* and the only real `@media print`
 * block in this repository lived in `docs/design/web-ui-mockup.html`.
 * `e2e/print.spec.ts` proved that block worked — against the mockup, opened
 * over `file://`. It never opened `src/ui/public/`, so a person printing the
 * shipped app was never once represented by a passing test.
 *
 * This file is that missing half, scoped to the five screens this lane owns
 * (`doctor`, `decay`, `status`, `coverage`, `learn`). It asserts the same
 * three things `print.spec.ts` already established as the bar for "prints
 * correctly": the screen's own chrome (rail, header, popovers, the exit
 * banner) is gone, the register is really black-on-white (not merely a
 * declared token nothing paints through), and — the one requirement that is
 * new here rather than carried over — a collapsed `details.help` disclosure
 * is forced OPEN on paper. `STD-a-screen-explains-itself-in-plain-words-and-
 * depth-hides` puts the longer help behind a `?` so the SCREEN stays short;
 * a printout has no click to give back, so the content the `?` was hiding
 * must already be on the page.
 *
 * ── AGAINST THE LIVE CORPUS, NOT A FIXTURE ─────────────────────────────────
 *
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` — the
 * owner ruling that verification runs against this repository's own corpus
 * unless an exception is asked for and granted. No exception was asked here,
 * so this suite starts its own server over the repository root (`REPO`),
 * never `.demo-corpus` — unlike most of `e2e/`, which predates that ruling
 * and is a separate, already-flagged non-compliance this task does not own.
 *
 * `--port 0`, and the child is killed in `afterAll`: this project's standing
 * rule is that port 58888 is the owner's own running server and is never
 * touched, replaced, or raced by anything a lane starts for itself.
 */
import { test, expect } from '@playwright/test';
import path from 'node:path';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';

const REPO = path.resolve(import.meta.dirname, '..');
const SCREENS = ['doctor', 'decay', 'status', 'coverage', 'learn'];

let harness: UiHarness;

test.beforeAll(async () => {
  harness = await startUiChild(REPO);
});

test.afterAll(async () => {
  await harness.stop();
});

/** Navigates to `#/screen` and waits for the shell to be authenticated. */
async function boot(page: import('@playwright/test').Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await expect(
    page.locator('.nav').first(),
    'the app never rendered a rail button — it probably has no token',
  ).toBeVisible({ timeout: 15_000 });
}

async function openScreen(page: import('@playwright/test').Page, screen: string): Promise<void> {
  await page.evaluate((s) => { location.hash = `#/${s}`; }, screen);
  // `route()` un-hides the section synchronously and THEN awaits the screen
  // module's own render — in between, the section holds only the
  // `#screenunread` holding chip (`app.js`'s own "screen.unread" state).
  // Waiting on visibility alone races that gap; waiting on the screen's own
  // `h2` (written by every screen's `screenHead()` call) waits for the real
  // render instead.
  // The live corpus this suite runs against (per `INSTR-testing-happens-
  // against-the-current-corpus-and-an-exception`) is this repository itself
  // — orders of magnitude larger than the demo fixture most of `e2e/` reads —
  // so Coverage's own full-tree walk over it is genuinely slower than a
  // fixture-sized run; a generous timeout here is honest about that rather
  // than a symptom masked.
  await expect(page.locator(`[data-p="${screen}"] h2`)).toBeVisible({ timeout: 45_000 });
}

test('each owned screen prints itself: chrome gone, register black-on-white, disclosures open',
  async ({ page }) => {
    test.setTimeout(120_000); // five screens, each waited on individually — see openScreen()
    await boot(page);

    for (const screen of SCREENS) {
      await openScreen(page, screen);
      await page.emulateMedia({ media: 'print' });

      const sheet = await page.evaluate((s) => {
        const displayOf = (sel: string): string => {
          const el = document.querySelector(sel);
          return el === null ? '(absent)' : getComputedStyle(el).display;
        };
        const mine = document.querySelector<HTMLElement>(`[data-p="${s}"]`)!;
        const root = getComputedStyle(document.documentElement);
        const token = (name: string): string => root.getPropertyValue(name).trim();
        const helpboxes = [...mine.querySelectorAll<HTMLElement>('details.help > .helpbox')];
        return {
          height: Math.round(mine.getBoundingClientRect().height),
          text: mine.innerText.trim().length,
          rail: displayOf('.rail'),
          hdr: displayOf('.hdr'),
          pop: displayOf('#sesspop'),
          banner: displayOf('#exited'),
          bodyBg: getComputedStyle(document.body).backgroundColor,
          bodyColor: getComputedStyle(document.body).color,
          tokenInk: token('--ink'),
          tokenGold: token('--gold'),
          tokenCrit: token('--crit'),
          helpboxCount: helpboxes.length,
          helpboxDisplays: helpboxes.map((h) => getComputedStyle(h).display),
          anyDetailsOpen: [...mine.querySelectorAll('details.help')].map((d) => d.hasAttribute('open')),
        };
      }, screen);

      expect(sheet.height, `"${screen}" printed a blank page`).toBeGreaterThan(50);
      expect(sheet.text, `"${screen}" printed with no text`).toBeGreaterThan(20);
      expect(sheet.rail, `"${screen}": the rail is navigation, not content`).toBe('none');
      expect(sheet.hdr, `"${screen}": the header is chrome`).toBe('none');
      expect(sheet.pop, `"${screen}": a popover must never reach paper`).toBe('none');
      expect(sheet.banner, `"${screen}": the exit banner must never reach paper`).toBe('none');
      expect(sheet.bodyBg, `"${screen}" must print on white`).toBe('rgb(255, 255, 255)');
      expect(sheet.bodyColor, `"${screen}" must print in black`).toBe('rgb(0, 0, 0)');
      expect(sheet.tokenInk, `"${screen}": --ink must be the print register's black`).toBe('#000');
      expect(sheet.tokenGold, `"${screen}": --gold must be the print register's black`).toBe('#000');
      expect(sheet.tokenCrit, `"${screen}": --crit must be the print register's black`).toBe('#000');

      // Not every screen's data happens to render a disclosure on this corpus
      // (a `?` is conditional on there being extra content to hide), so this
      // only asserts the ones that DO exist are forced open — never that one
      // must exist on every screen.
      for (const display of sheet.helpboxDisplays) {
        expect(display, `"${screen}": a collapsed "?" must not hide content on paper`)
          .not.toBe('none');
      }

      await page.emulateMedia({ media: 'screen' });
    }
  });

test('coverage always carries at least one disclosure, and it prints open even when closed on screen',
  async ({ page }) => {
    await boot(page);
    await openScreen(page, 'coverage');
    // `h2` renders synchronously; the disclosures render only after
    // `/api/coverage` (and `/api/help/categories`) resolve — waited for
    // explicitly rather than assumed to have landed by the time `h2` did.
    await expect(page.locator('details.help').first()).toBeAttached({ timeout: 15_000 });

    // On screen: every `details.help` on Coverage starts closed (native
    // `<details>` default), which is the whole point of the `?` convention —
    // confirmed here so the print assertion below is proving something.
    const closedOnScreen = await page.evaluate(() =>
      [...document.querySelectorAll('details.help')].every((d) => !d.hasAttribute('open')));
    expect(closedOnScreen, 'a disclosure that already renders open cannot prove print forces it')
      .toBe(true);

    await page.emulateMedia({ media: 'print' });
    const printed = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll<HTMLElement>('details.help > .helpbox')];
      const details = [...document.querySelectorAll<HTMLDetailsElement>('details.help')];
      return {
        count: boxes.length,
        displays: boxes.map((b) => getComputedStyle(b).display),
        // A real laid-out box, not `.innerText` — `<details>`'s own hidden
        // content can read back an empty rendered-text string even once its
        // `display` is forced to `block`, in a way a genuine layout box
        // (non-zero height, actually painting its own text nodes) does not.
        anyRendered: boxes.some((b) => b.getBoundingClientRect().height > 0
          && (b.textContent ?? '').trim().length > 0),
        // **The real mechanism, checked directly rather than inferred from
        // geometry.** Measured 2026-09-05: a closed `<details>` hides its
        // content through the browser's OWN internal mechanism, not through
        // an ordinary `display:none` on the child — `getBoundingClientRect()`
        // and `textContent` both read back real, non-zero values for a box
        // that still paints nothing at all. `details.help>.helpbox{display:
        // block!important}` alone passed the two checks above and produced a
        // blank printout; only setting the `<details>` element's own `open`
        // property (`lib/disclosure.js`'s print-media listener) actually
        // works. So this is the assertion that would have caught that —
        // every disclosure's `open` is genuinely `true` under print.
        allOpen: details.every((d) => d.open === true),
      };
    });
    expect(printed.count, 'coverage should carry at least one disclosure on this corpus')
      .toBeGreaterThan(0);
    for (const d of printed.displays) expect(d).not.toBe('none');
    expect(printed.anyRendered, 'the forced-open box must actually lay out and carry text')
      .toBe(true);
    expect(printed.allOpen, 'every details.help must have its own `open` property set under print')
      .toBe(true);
    await page.emulateMedia({ media: 'screen' });
    // Restored, not left open: a reader who printed with these closed gets
    // them back closed once the print is over — `lib/disclosure.js`'s own
    // stated behaviour, checked here rather than assumed.
    const restored = await page.evaluate(() =>
      [...document.querySelectorAll('details.help')].every((d) => !d.hasAttribute('open')));
    expect(restored, 'a disclosure the reader had closed was left open after the print media ended')
      .toBe(true);
  });

test('a never-opened item pane does not print an empty template', async ({ page }) => {
  // The mockup's own print rule for the pane is unconditional
  // (`.pane{display:block!important}`), which is safe THERE — the mockup
  // never ships a closed `aside.pane#pane` for it to force open. This shell
  // does (`hidden` by default), and the unconditional rule outranks that
  // `[hidden]` — measured 2026-09-05, it printed an empty field-label
  // template on every Coverage printout whether or not a reader had ever
  // opened an item. `.pane:not([hidden])` is the fix; this is the regression
  // test for it.
  await boot(page);
  await openScreen(page, 'coverage');
  const paneHiddenOnScreen = await page.evaluate(() =>
    document.getElementById('pane')?.hasAttribute('hidden') ?? null);
  expect(paneHiddenOnScreen, 'the pane must be absent from the DOM or already hidden pre-open')
    .not.toBe(false);

  await page.emulateMedia({ media: 'print' });
  const printedDisplay = await page.evaluate(() => {
    const pane = document.getElementById('pane');
    return pane === null ? '(absent)' : getComputedStyle(pane).display;
  });
  expect(printedDisplay, 'a pane nobody opened must not be forced onto the printout')
    .toBe('none');
  await page.emulateMedia({ media: 'screen' });
});

test('an item pane the reader DID open still prints, open or not it stays gone otherwise', async ({ page }) => {
  await boot(page);
  await openScreen(page, 'coverage');
  // "What governs" draws real `linkId()` buttons (`data-id="…"`), but behind
  // its own `help.showIds` disclosure — closed by default, same as every
  // other one on this screen — so the button is not clickable until that is
  // opened first.
  const summary = page.locator('[data-p="coverage"] details.help > summary').last();
  await summary.waitFor({ timeout: 20_000 });
  await summary.click();
  const idButton = page.locator('[data-p="coverage"] button.linkid[data-id]').first();
  await idButton.waitFor({ timeout: 20_000 });
  await idButton.click();
  await expect(page.locator('#pane')).not.toHaveAttribute('hidden', '', { timeout: 10_000 });

  await page.emulateMedia({ media: 'print' });
  const opened = await page.evaluate(() => {
    const pane = document.getElementById('pane')!;
    return {
      display: getComputedStyle(pane).display,
      height: Math.round(pane.getBoundingClientRect().height),
      text: pane.innerText.trim().length,
    };
  });
  expect(opened.display, 'the pane the reader opened must print').toBe('block');
  expect(opened.height, 'and must not print blank').toBeGreaterThan(20);
  expect(opened.text, 'and must carry its text onto the paper').toBeGreaterThan(20);
  await page.emulateMedia({ media: 'screen' });
});

test('the print register also works in Hebrew', async ({ page }) => {
  await boot(page);
  await openScreen(page, 'coverage');
  await page.click('#lang');
  // `#lang` writes the preference and reloads; the reload lands on the
  // default screen, so the route is re-armed here rather than assumed.
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await openScreen(page, 'coverage');

  await page.emulateMedia({ media: 'print' });
  const sheet = await page.evaluate(() => {
    const mine = document.querySelector<HTMLElement>('[data-p="coverage"]')!;
    return {
      dir: document.documentElement.dir,
      height: Math.round(mine.getBoundingClientRect().height),
      text: mine.innerText.trim().length,
      bodyBg: getComputedStyle(document.body).backgroundColor,
      rail: getComputedStyle(document.querySelector('.rail')!).display,
    };
  });
  expect(sheet.dir).toBe('rtl');
  expect(sheet.height, 'printed blank in Hebrew').toBeGreaterThan(50);
  expect(sheet.text, 'printed with no text in Hebrew').toBeGreaterThan(20);
  expect(sheet.bodyBg, 'must print on white in Hebrew too').toBe('rgb(255, 255, 255)');
  expect(sheet.rail, 'the rail is chrome in Hebrew too').toBe('none');
  await page.emulateMedia({ media: 'screen' });
});
