/**
 * **The print stylesheet, which has already shipped printing a blank page.**
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
