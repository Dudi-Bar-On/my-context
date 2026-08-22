/**
 * **The print stylesheet, which has already shipped printing a blank page —
 * and, separately, shipped printing the dark theme's own colours.**
 *
 * The previous pass hid every screen but Coverage under `@media print` and then
 * never un-hid it, so Ctrl+P produced a blank sheet. That is not a defect any
 * file-level check can see: the rules were well-formed, the selectors were
 * valid, and the sheet was exactly what it said it was. It was simply wrong
 * about which screen you were on.
 *
 * The fix in the mockup is `[data-p].printing`, applied by `go()` to whichever
 * screen is showing. So the test is: emulate print media, and on EVERY ONE of
 * the twenty-one screens assert that the screen you are on is the screen that
 * would come out of the printer — laid out, with text, and with the chrome
 * (rail, header, popovers, provenance strip, the error banner) gone.
 *
 * Twenty-one, not one, for exactly the reason the defect existed: the rule that
 * un-hides one screen is not evidence about any other.
 *
 * **`bodyBg`/`bodyColor` were never enough, and stayed green through 246
 * contrast failures to prove it.** `body{background:#fff;color:#000}` is the
 * one rule the old print block carried, and it says nothing about `.psub`,
 * `.chip`, a table cell or any of the other places colour actually gets
 * painted — those still read `var(--ink)`/`var(--dim)`/`var(--gold)` etc.,
 * the SCREEN'S light-on-dark values, on a suddenly-white page. So this suite
 * now also asserts the declared print REGISTER itself — the custom
 * properties every rule in the file paints through — and one rendered
 * element's actual computed colour, which is the thing a token assertion
 * alone still cannot see (a correctly-declared token painting nothing, if
 * some rule stopped reading it, would pass a token check and fail a person).
 */
import { test, expect } from '@playwright/test';
import { SCREENS, expectNoFaults, openMockup, showScreen } from './mockup.ts';

test('every screen prints itself, and only itself', async ({ page }) => {
  const faults = await openMockup(page);
  await page.emulateMedia({ media: 'print' });

  for (const screen of SCREENS) {
    await showScreen(page, screen);

    const sheet = await page.evaluate((s) => {
      const mine = document.querySelector<HTMLElement>(`[data-p="${s}"]`)!;
      const box = mine.getBoundingClientRect();
      const shownOthers = [...document.querySelectorAll<HTMLElement>('[data-p]')]
        .filter((x) => x.dataset['p'] !== s && x.getBoundingClientRect().height > 0)
        .map((x) => x.dataset['p'] ?? '?');
      const displayOf = (sel: string): string => {
        const el = document.querySelector(sel);
        return el === null ? '(absent)' : getComputedStyle(el).display;
      };
      const root = getComputedStyle(document.documentElement);
      const token = (name: string): string => root.getPropertyValue(name).trim();
      // A representative rendered element, not just the token declaration:
      // `.psub` (the screen's own subtitle, one per screen) paints its colour
      // from `var(--dim)` rather than inheriting `body`'s, so this is the
      // check that would have caught the token existing but nothing actually
      // reading it.
      const psub = mine.querySelector<HTMLElement>('.psub');
      return {
        height: Math.round(box.height),
        width: Math.round(box.width),
        display: getComputedStyle(mine).display,
        text: mine.innerText.trim().length,
        shownOthers,
        rail: displayOf('.rail'),
        top: displayOf('.hdr'),
        prov: displayOf('.prov'),
        pop: displayOf('#sesspop'),
        banner: displayOf('#exited'),
        // The page must not print white-on-white or on a dark ground.
        bodyBg: getComputedStyle(document.body).backgroundColor,
        bodyColor: getComputedStyle(document.body).color,
        // The declared print register (spec §7.3, plan Task 10 step 2):
        // every one of the five meaning hues and all three ink steps
        // collapse to black, because printing from the dark theme measured
        // 246 contrast failures and there is no light theme to fall back to.
        // `--faint` is checked here too — it never paints text at any size
        // on screen either (enforced separately by check-faint-usage.ts),
        // but it does paint the "not run" hatch, which must still read as a
        // hatch and not a smudge on white.
        tokenGround: token('--ground'),
        tokenInk: token('--ink'),
        tokenDim: token('--dim'),
        tokenFaint: token('--faint'),
        tokenGold: token('--gold'),
        tokenOk: token('--ok'),
        tokenWarn: token('--warn'),
        tokenCrit: token('--crit'),
        tokenCarry: token('--carry'),
        psubColor: psub === null ? '(absent)' : getComputedStyle(psub).color,
      };
    }, screen);

    expect(sheet.display, `"${screen}" must be displayed under print media`).not.toBe('none');
    expect(sheet.height, `"${screen}" printed a blank page — zero height`).toBeGreaterThan(100);
    expect(sheet.width, `"${screen}" printed with no width`).toBeGreaterThan(100);
    expect(sheet.text, `"${screen}" printed with no text on it`).toBeGreaterThan(150);
    expect(sheet.shownOthers, `"${screen}" printed other screens alongside it`).toEqual([]);

    expect(sheet.rail, `"${screen}": the rail is navigation, not content`).toBe('none');
    expect(sheet.top, `"${screen}": the header is chrome`).toBe('none');
    expect(sheet.prov, `"${screen}": the provenance strip is chrome`).toBe('none');
    expect(sheet.pop, `"${screen}": a popover must never reach paper`).toBe('none');
    expect(sheet.banner, `"${screen}": the error banner must never reach paper`).toBe('none');

    expect(sheet.bodyBg, `"${screen}" must print on white`).toBe('rgb(255, 255, 255)');
    expect(sheet.bodyColor, `"${screen}" must print in black`).toBe('rgb(0, 0, 0)');

    expect(sheet.tokenGround, `"${screen}": the print register's ground must be white`).toBe('#fff');
    for (const [name, value] of [
      ['--ink', sheet.tokenInk], ['--dim', sheet.tokenDim], ['--faint', sheet.tokenFaint],
      ['--gold', sheet.tokenGold], ['--ok', sheet.tokenOk], ['--warn', sheet.tokenWarn],
      ['--crit', sheet.tokenCrit], ['--carry', sheet.tokenCarry],
    ] as const) {
      expect(value, `"${screen}": ${name} must be the print register's black, not the screen's colour`)
        .toBe('#000');
    }
    expect(sheet.psubColor, `"${screen}": its own subtitle must actually render in ink, not just declare the token`)
      .toBe('rgb(0, 0, 0)');
  }

  await page.emulateMedia({ media: 'screen' });
  expectNoFaults(faults, 'while printing every screen');
});

test('the print stylesheet works in Hebrew as well', async ({ page }) => {
  const faults = await openMockup(page);
  await page.click('#lang');
  await page.emulateMedia({ media: 'print' });

  for (const screen of SCREENS) {
    await showScreen(page, screen);
    const sheet = await page.evaluate((s) => {
      const mine = document.querySelector<HTMLElement>(`[data-p="${s}"]`)!;
      return {
        height: Math.round(mine.getBoundingClientRect().height),
        text: mine.innerText.trim().length,
        dir: document.documentElement.dir,
      };
    }, screen);
    expect(sheet.dir).toBe('rtl');
    expect(sheet.height, `"${screen}" printed blank in Hebrew`).toBeGreaterThan(100);
    expect(sheet.text, `"${screen}" printed with no text in Hebrew`).toBeGreaterThan(150);
  }

  await page.emulateMedia({ media: 'screen' });
  expectNoFaults(faults, 'while printing every screen in Hebrew');
});

test('the item pane prints with the screen rather than disappearing', async ({ page }) => {
  const faults = await openMockup(page);
  await showScreen(page, 'preview');

  // Opening an item is how the pane appears; the print sheet keeps it, because
  // the thing you were reading is the thing you meant to print.
  await page.click('.linkid[data-id="CONST-zero-runtime-dependencies"]');
  expect(
    await page.evaluate(() => document.querySelector<HTMLElement>('#pane')!.hidden),
    'the pane opens on screen',
  ).toBe(false);

  await page.emulateMedia({ media: 'print' });
  const printed = await page.evaluate(() => {
    const pane = document.querySelector<HTMLElement>('#pane')!;
    return {
      display: getComputedStyle(pane).display,
      height: Math.round(pane.getBoundingClientRect().height),
      text: pane.innerText.trim().length,
    };
  });
  expect(printed.display, 'the pane is content and must print').toBe('block');
  expect(printed.height, 'and must not print blank').toBeGreaterThan(50);
  expect(printed.text, 'and must carry its text onto the paper').toBeGreaterThan(50);

  await page.emulateMedia({ media: 'screen' });
  expectNoFaults(faults, 'while printing the item pane');
});
