/**
 * **Empty and error states — where invented UI usually hides.**
 *
 * A screen with data in it is the screen someone looked at. The zero-data view
 * and the server-has-gone banner are the ones nobody opens, so they are the ones
 * that rot, and they are the ones a mockup is most likely to describe without
 * actually drawing.
 *
 * Three distinct states are pinned here, and the mockup is emphatic that they
 * are three and not one:
 *
 *   - **Nothing governs this project yet** — a new workspace. Said once, in one
 *     sentence, not repeated per row.
 *   - **Nothing is scoped here** — a directory no item scopes, which still has
 *     the pinned items applying to it.
 *   - **Not examined** — past the file limit. Explicitly NOT the same claim as
 *     "nothing governs it", and the mockup says so in the copy.
 *
 * The error banner is reached through its own code path rather than by
 * un-hiding the element: `setInterval` counts 60 beats of 900 ms and only then
 * shows it. Playwright's clock is installed before load and run forward, so the
 * banner appears because the page decided to show it — which is the only version
 * of this test that proves anything.
 */
import { test, expect } from '@playwright/test';
import { expectNoFaults, openMockup, showScreen, watchForFaults, MOCKUP_URL } from './mockup.ts';

test('the zero-data view is a real view, in both languages', async ({ page }) => {
  const faults = await openMockup(page);
  await showScreen(page, 'coverage');

  const before = await page.evaluate(() => ({
    empty: document.querySelector<HTMLElement>('#covempty')!.hidden,
    full: document.querySelector<HTMLElement>('#covfull')!.hidden,
    pressed: document.querySelector('#empty')!.getAttribute('aria-pressed'),
  }));
  expect(before, 'the populated view is what you land on').toEqual({
    empty: true, full: false, pressed: 'false',
  });

  await page.click('#empty');
  const on = await page.evaluate(() => ({
    empty: document.querySelector<HTMLElement>('#covempty')!.hidden,
    full: document.querySelector<HTMLElement>('#covfull')!.hidden,
    pressed: document.querySelector('#empty')!.getAttribute('aria-pressed'),
    text: document.querySelector<HTMLElement>('#covempty')!.innerText.trim(),
    box: document.querySelector<HTMLElement>('#covempty')!.getBoundingClientRect().height,
    // The empty state offers the command that fixes it. A dead end is the defect.
    commands: document.querySelectorAll('#covempty .cmd code').length,
  }));

  expect(on.pressed, 'the toggle announces its state').toBe('true');
  expect(on.empty, 'the zero-data view is shown').toBe(false);
  expect(on.full, 'and the populated one is put away').toBe(true);
  expect(on.box, 'a state that renders nothing is not a state').toBeGreaterThan(0);
  expect(on.text).toContain('Nothing governs this project yet');
  expect(on.commands, 'the empty state must offer a way out of it').toBeGreaterThan(0);

  // The same view in Hebrew: the point of an empty state is that someone who
  // cannot read English still gets told what to do.
  await page.click('#lang');
  const hebrew = await page.evaluate(() => ({
    text: document.querySelector<HTMLElement>('#covempty')!.innerText.trim(),
    hidden: document.querySelector<HTMLElement>('#covempty')!.hidden,
    box: document.querySelector<HTMLElement>('#covempty')!.getBoundingClientRect().height,
  }));
  expect(hebrew.hidden, 'the zero-data view survives the language switch').toBe(false);
  expect(hebrew.box, 'and still draws').toBeGreaterThan(0);
  expect(hebrew.text, 'and is translated').not.toBe(on.text);
  expect(/[֐-׿]/.test(hebrew.text), 'in actual Hebrew').toBe(true);

  await page.click('#lang');
  await page.click('#empty');
  expectNoFaults(faults, 'while toggling the zero-data view');
});

test('"nothing is scoped here" and "not examined" are different states and say so', async ({ page }) => {
  const faults = await openMockup(page);
  await showScreen(page, 'coverage');

  const read = async (file: string): Promise<string> => {
    await page.click(`[role="treeitem"][data-f="${file}"]`);
    return page.evaluate(() => document.querySelector<HTMLElement>('#det')!.innerText.trim());
  };

  const scoped = await read('src/billing/prices.js');
  expect(scoped, 'a governed file lists what governs it').toContain('INV-prices-are-integer-cents');

  const nothingScoped = await read('src/workers/');
  expect(nothingScoped).toContain('Nothing is scoped here');
  expect(nothingScoped, 'because the pinned items still apply, and saying otherwise is a lie')
    .toContain('pinned');

  const notExamined = await read('vendor/');
  expect(notExamined).toContain('Not examined');
  expect(
    notExamined,
    'the mockup insists these are not the same claim: a file the walk did not reach '
    + 'is not a file nothing governs',
  ).toContain('nothing governs it');

  expect(nothingScoped, 'and the two states must not render the same text').not.toBe(notExamined);

  // Both empty states must survive the language switch with content in them.
  await page.click('#lang');
  const hebrew = await page.evaluate(() => document.querySelector<HTMLElement>('#det')!.innerText.trim());
  expect(hebrew.length, 'the empty state renders in Hebrew as well').toBeGreaterThan(10);
  expect(/[֐-׿]/.test(hebrew), 'in actual Hebrew').toBe(true);
  await page.click('#lang');

  expectNoFaults(faults, 'while reading the empty coverage states');
});

test('the server-exited banner appears on its own schedule and can be dismissed', async ({ page }) => {
  // The clock is installed before load, so the page's own setInterval is the
  // thing being driven. Un-hiding the element by hand would test the CSS and
  // nothing else.
  await page.clock.install();
  const faults = watchForFaults(page);
  await page.goto(MOCKUP_URL);

  expect(
    await page.evaluate(() => document.querySelector<HTMLElement>('#exited')!.hidden),
    'nothing has gone wrong yet',
  ).toBe(true);

  // 60 beats of 900 ms.
  await page.clock.runFor(54_000);

  const shown = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('#exited')!;
    return {
      hidden: el.hidden,
      role: el.getAttribute('role'),
      text: el.innerText.trim(),
      height: el.getBoundingClientRect().height,
      // The banner must tell you how to get the server back, not just that it left.
      command: el.querySelector('code, .m')?.textContent ?? '',
    };
  });

  expect(shown.hidden, 'the page must notice the server is gone').toBe(false);
  expect(shown.role, 'an error state must be announced, not merely drawn').toBe('alert');
  expect(shown.height, 'and it must actually occupy the screen').toBeGreaterThan(0);
  expect(shown.text).toContain('The server has exited');
  expect(shown.command, 'and name the command that starts it again').toBe('mycontext ui');

  await page.click('#exdismiss');
  expect(
    await page.evaluate(() => document.querySelector<HTMLElement>('#exited')!.hidden),
    'and it must be dismissible — an alert that cannot be closed is a wall',
  ).toBe(true);

  expectNoFaults(faults, 'while the server-exited banner came and went');
});

test('the error banner is translated too', async ({ page }) => {
  await page.clock.install();
  const faults = watchForFaults(page);
  await page.goto(MOCKUP_URL);
  await page.click('#lang');
  await page.clock.runFor(54_000);

  const hebrew = await page.evaluate(() => {
    const el = document.querySelector<HTMLElement>('#exited')!;
    return { hidden: el.hidden, text: el.innerText.trim(), dir: document.documentElement.dir };
  });
  expect(hebrew.hidden).toBe(false);
  expect(hebrew.dir).toBe('rtl');
  expect(/[֐-׿]/.test(hebrew.text), 'the alert speaks the reader’s language').toBe(true);
  // `mycontext ui` is product vocabulary and stays in Latin script even here.
  expect(hebrew.text, 'and still names the command').toContain('mycontext ui');

  expectNoFaults(faults, 'while the Hebrew error banner appeared');
});
