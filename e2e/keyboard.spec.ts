/**
 * **Keyboard and focus, in both writing directions.**
 *
 * Mirroring a UI is where keyboard order goes wrong, and it goes wrong quietly:
 * the page still looks right, every control is still reachable with a mouse,
 * and only someone driving it from the keyboard in Hebrew finds out. The
 * mockup mirrors by LOGICAL properties and by projection, never by
 * `transform: scale(-1,1)` — so tab order is DOM order and must be the SAME
 * sequence in both directions. That is the assertion: not "focus works", but
 * "focus visits the same controls in the same order whichever way the page
 * reads".
 *
 * The focus ring is measured rather than assumed. `:focus-visible { outline: 2px
 * solid var(--gold) }` is one rule, and a rule that stops matching leaves a
 * keyboard user with no idea where they are — with nothing in the file to say so.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { expectNoFaults, openMockup, MOCKUP_URL } from './mockup.ts';

/** Identity of the focused element, plus whether it is visibly focused. */
async function focused(page: Page): Promise<{ id: string; ring: string; visible: boolean }> {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (el === null || el === document.body) return { id: '(body)', ring: '', visible: false };
    const cs = getComputedStyle(el);
    const nav = el.dataset['s'];
    return {
      id: el.id !== '' ? `#${el.id}` : nav !== undefined ? `nav:${nav}` : `${el.tagName.toLowerCase()}.${el.className}`,
      ring: `${cs.outlineStyle} ${cs.outlineWidth}`,
      visible: el.matches(':focus-visible'),
    };
  });
}

/**
 * Tab `steps` times from the top of a FRESHLY LOADED document and record where
 * focus lands.
 *
 * Freshly loaded, not merely blurred: `blur()` clears `document.activeElement`
 * but leaves the sequential focus navigation starting point where it was, so a
 * second walk in the same document silently resumes from wherever the first one
 * stopped — and the two directions would then be compared from different
 * origins, which is a bug in the test rather than in the page.
 */
async function tabSequence(page: Page, steps: number): Promise<{ id: string; ring: string; visible: boolean }[]> {
  const seen: { id: string; ring: string; visible: boolean }[] = [];
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab');
    seen.push(await focused(page));
  }
  return seen;
}

test('tab order and the focus ring are the same in both writing directions', async ({ page }) => {
  const faults = await openMockup(page);

  const ltr = await tabSequence(page, 12);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('ltr');

  // Reload, then switch language with a PROGRAMMATIC click, which dispatches the
  // event without moving focus. Clicking the toggle for real would leave focus
  // on it and start the Hebrew walk one control further along.
  await page.goto(MOCKUP_URL);
  await page.evaluate(() => document.querySelector<HTMLElement>('#lang')!.click());
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  const rtl = await tabSequence(page, 12);

  expect(
    rtl.map((f) => f.id),
    'tab order is DOM order and must not change when the page mirrors. A UI mirrored '
    + 'with a transform instead of logical properties reverses it, and only a keyboard '
    + 'user in Hebrew ever finds out.',
  ).toEqual(ltr.map((f) => f.id));

  for (const step of [...ltr, ...rtl]) {
    expect(step.id, 'focus must not fall off the document').not.toBe('(body)');
    expect(step.visible, `${step.id} must be :focus-visible when reached by keyboard`).toBe(true);
    expect(step.ring, `${step.id} must draw the 2px focus outline`).toBe('solid 2px');
  }

  // And the first stop is the top of the header in both, not something the
  // mirror moved to the end.
  expect(ltr[0]!.id).toBe('#focusbtn');
  expect(rtl[0]!.id).toBe('#focusbtn');

  expectNoFaults(faults, 'while tabbing through the page');
});

test('a popover takes focus, and Escape gives it back — in both directions', async ({ page }) => {
  const faults = await openMockup(page);

  for (const dir of ['ltr', 'rtl'] as const) {
    if (dir === 'rtl') await page.click('#lang');
    expect(await page.evaluate(() => document.documentElement.dir), 'direction under test').toBe(dir);

    for (const [btn, pop] of [['#sessbtn', '#sesspop'], ['#focusbtn', '#focuspop']] as const) {
      await page.click(btn);
      const open = await page.evaluate(([b, p]) => ({
        hidden: document.querySelector<HTMLElement>(p)!.hidden,
        expanded: document.querySelector(b)!.getAttribute('aria-expanded'),
        focusInside: document.activeElement?.closest(p) !== null,
      }), [btn, pop] as [string, string]);

      expect(open.hidden, `${dir}: ${pop} opens`).toBe(false);
      expect(open.expanded, `${dir}: ${btn} announces it is expanded`).toBe('true');
      expect(open.focusInside, `${dir}: focus moves into ${pop}, or a keyboard user is stranded`).toBe(true);

      await page.keyboard.press('Escape');
      const closed = await page.evaluate((p) => document.querySelector<HTMLElement>(p)!.hidden, pop);
      expect(closed, `${dir}: Escape closes ${pop}`).toBe(true);
    }

    // Only one popover at a time — opening the second must close the first.
    await page.click('#sessbtn');
    await page.click('#focusbtn');
    const exclusive = await page.evaluate(() => ({
      sess: document.querySelector<HTMLElement>('#sesspop')!.hidden,
      focus: document.querySelector<HTMLElement>('#focuspop')!.hidden,
    }));
    expect(exclusive.sess, `${dir}: opening one popover closes the other`).toBe(true);
    expect(exclusive.focus, `${dir}: and the new one is open`).toBe(false);
    await page.keyboard.press('Escape');
  }

  await page.click('#lang');
  expectNoFaults(faults, 'while driving the popovers from the keyboard');
});

test('a screen can be reached and opened without a mouse, in both directions', async ({ page }) => {
  const faults = await openMockup(page);

  for (const dir of ['ltr', 'rtl'] as const) {
    if (dir === 'rtl') await page.click('#lang');

    await page.evaluate(() => document.querySelector<HTMLElement>('.nav[data-s="doctor"]')!.focus());
    await page.keyboard.press('Enter');
    const viaEnter = await page.evaluate(() => ({
      current: document.querySelector('.nav[data-s="doctor"]')!.getAttribute('aria-current'),
      shown: !document.querySelector<HTMLElement>('[data-p="doctor"]')!.hidden,
      focusKept: (document.activeElement as HTMLElement).dataset['s'],
    }));
    expect(viaEnter.current, `${dir}: Enter marks the rail entry current`).toBe('page');
    expect(viaEnter.shown, `${dir}: Enter opens the screen`).toBe(true);
    expect(viaEnter.focusKept, `${dir}: focus stays on the control that was activated`).toBe('doctor');

    await page.evaluate(() => document.querySelector<HTMLElement>('.nav[data-s="decay"]')!.focus());
    await page.keyboard.press('Space');
    expect(
      await page.evaluate(() => !document.querySelector<HTMLElement>('[data-p="decay"]')!.hidden),
      `${dir}: Space activates a button too`,
    ).toBe(true);

    await page.evaluate(() => document.querySelector<HTMLElement>('.nav[data-s="preview"]')!.click());
  }

  await page.click('#lang');
  expectNoFaults(faults, 'while opening screens from the keyboard');
});
