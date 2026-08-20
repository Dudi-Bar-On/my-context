/**
 * **Bidi isolation survives — counted, in both directions, not eyeballed.**
 *
 * An LTR identifier inside RTL prose is the one thing a screenshot cannot
 * settle and a file-level checker cannot reach. A glob such as `src/billing/*`
 * sitting in a Hebrew sentence renders with its segments reversed unless the
 * element around it isolates it, and "unless the element around it" is a
 * COMPUTED style: the
 * class has to be on the element, the element has to exist after the language
 * switch, and the rule has to still apply. Three separate things, each of which
 * has failed here.
 *
 * The mechanism the mockup uses, and therefore what this measures:
 *
 *   - English keeps its `.m` spans as CLONED NODES, so a toggle cannot flatten
 *     them (an earlier pass captured English as a STRING and lost seven of them
 *     on the first toggle, permanently).
 *   - Hebrew builds `{m:…}` and `{mv:…}` runs as REAL span elements, so the
 *     isolation exists in Hebrew and not only in English — which is the way
 *     round it was broken before.
 *
 * So the assertion is a COUNT, per string key, in both directions: the same key
 * must produce the same number of isolated runs in English and in Hebrew. 368
 * keys, checked both ways, and any single one that differs names itself.
 */
import { test, expect } from '@playwright/test';
import { expectNoFaults, openMockup, SCREENS, showScreen } from './mockup.ts';

/** `unicode-bidi`/`direction` as the browser actually resolved them. */
interface Resolved { readonly combos: string[]; readonly count: number }

test('every isolated run computes as isolated, in both writing directions', async ({ page }) => {
  const faults = await openMockup(page);

  const measure = (): Promise<{ mono: Resolved; bdi: Resolved; value: Resolved; dir: string }> =>
    page.evaluate(() => {
      const resolve = (selector: string) => {
        const combos = new Set<string>();
        const nodes = document.querySelectorAll(selector);
        nodes.forEach((el) => {
          const cs = getComputedStyle(el);
          combos.add(`${cs.unicodeBidi}/${cs.direction}`);
        });
        return { combos: [...combos].sort(), count: nodes.length };
      };
      return {
        mono: resolve('.m'),
        bdi: resolve('bdi'),
        value: resolve('.v'),
        dir: document.documentElement.dir,
      };
    });

  const ltr = await measure();
  expect(ltr.dir).toBe('ltr');
  // A monospace literal is direction-KNOWN-ltr: an identifier, a path, a flag.
  expect(ltr.mono.combos, 'every .m is isolated and forced ltr in English').toEqual(['isolate/ltr']);
  expect(ltr.mono.count, 'the mockup draws 220 monospace literals in English').toBe(220);
  // `bdi` is direction-UNKNOWN: read off disk or out of the corpus.
  expect(ltr.bdi.combos, 'every bdi is isolated').toEqual(['isolate/ltr']);
  expect(ltr.value.combos, 'every value slot is isolated').toEqual(['isolate/ltr']);

  await page.click('#lang');
  const rtl = await measure();
  expect(rtl.dir).toBe('rtl');
  expect(
    rtl.mono.combos,
    'every .m must stay isolated AND ltr inside Hebrew prose — this is the direction '
    + 'that breaks, and it breaks silently',
  ).toEqual(['isolate/ltr']);
  expect(rtl.bdi.combos, 'every bdi stays isolated in Hebrew').toEqual(['isolate/ltr']);
  // A bare `.v` takes its direction from the surrounding prose — that is correct,
  // it is a value whose direction is unknown. What it must never lose is the
  // isolation. `.m.v` (a monospace value slot) is additionally forced ltr.
  expect(
    rtl.value.combos.every((c) => c.startsWith('isolate/')),
    'every value slot stays isolated in Hebrew',
  ).toBe(true);
  expect(rtl.value.combos, 'and a monospace value slot is still forced ltr').toContain('isolate/ltr');

  await page.click('#lang');
  const back = await measure();
  expect(back.mono.count, 'and the English isolation count comes back').toBe(ltr.mono.count);
  expect(back.mono.combos, 'unchanged').toEqual(ltr.mono.combos);

  expectNoFaults(faults, 'while measuring bidi isolation');
});

test('each string key produces the same number of isolated runs in Hebrew as in English', async ({ page }) => {
  const faults = await openMockup(page);
  for (const screen of SCREENS) await showScreen(page, screen);

  // One entry per ELEMENT, in document order — not one per key. 368 elements
  // carry only 341 distinct keys, because a string is allowed to be used twice,
  // and collapsing them would quietly stop checking 27 of them.
  const census = (): Promise<string[]> => page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('[data-t]')].map((el, i) =>
      // `.m` counted separately from `.v`, because they are different guarantees:
      // a monospace literal is product vocabulary, a value slot is runtime data.
      `${i} | ${el.dataset['t'] ?? ''} | ${el.querySelectorAll('.m').length}m/${el.querySelectorAll('.v').length}v`));

  const english = await census();
  expect(english.length, 'the mockup declares 368 translated elements').toBe(368);

  await page.click('#lang');
  const hebrew = await census();

  expect(hebrew.length, 'no translated element appeared or disappeared in Hebrew')
    .toBe(english.length);

  // Both directions: an element that GAINED runs in Hebrew is as wrong as one
  // that lost them, and neither shows up in a count of the whole page.
  const mismatched = english
    .map((row, i) => [row, hebrew[i] ?? '(missing)'] as const)
    .filter(([en, he]) => en !== he)
    .map(([en, he]) => {
      const [, key, enRuns] = en.split(' | ');
      const heRuns = he.split(' | ')[2] ?? '(missing)';
      return `${key}: en=${enRuns} he=${heRuns}`;
    });
  expect(
    mismatched,
    'these keys render a different number of isolated runs in Hebrew than in English. '
    + 'An LTR identifier that loses its span inside RTL prose reads backwards, and nothing '
    + 'in the file says so.',
  ).toEqual([]);

  await page.click('#lang');
  expect(await census(), 'and the English census is restored exactly').toEqual(english);

  expectNoFaults(faults, 'while counting isolated runs');
});

test('an identifier inside Hebrew prose is laid out left to right', async ({ page }) => {
  const faults = await openMockup(page);
  await page.click('#lang');

  // Computed style says the rule applies. This says the characters actually
  // came out in reading order: the first character box of a `.m` run must sit
  // to the LEFT of its last, even though the paragraph around it runs the other
  // way. Measured, because "isolate" resolving correctly and the glyphs landing
  // correctly are two different claims.
  //
  // Only a shown screen has boxes to measure, so every screen is visited and the
  // measurements accumulated — the landing screen alone offers ten runs.
  const measureVisible = (): Promise<{ text: string; firstX: number; lastX: number }[]> =>
    page.evaluate(() => {
    const runs = [...document.querySelectorAll<HTMLElement>('.m')]
      .filter((el) => {
        const t = (el.textContent ?? '').trim();
        const r = el.getBoundingClientRect();
        return el.childNodes.length === 1
          && el.firstChild!.nodeType === Node.TEXT_NODE
          && t.length > 6 && r.width > 0 && r.height < 40
          && /^[!-~]+$/.test(t);
      })
      .slice(0, 40);
    return runs.map((el) => {
      const text = el.firstChild!;
      const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, 1);
      const first = range.getBoundingClientRect();
      const n = (text.textContent ?? '').length;
      range.setStart(text, n - 1); range.setEnd(text, n);
      const last = range.getBoundingClientRect();
      return { text: el.textContent ?? '', firstX: first.left, lastX: last.left };
    });
  });

  const laidOut: { text: string; firstX: number; lastX: number }[] = [];
  for (const screen of SCREENS) {
    await showScreen(page, screen);
    laidOut.push(...await measureVisible());
  }

  expect(laidOut.length, 'there must be ascii identifiers to measure').toBeGreaterThan(100);
  const reversed = laidOut.filter((r) => r.firstX >= r.lastX).map((r) => r.text);
  expect(
    reversed,
    'these identifiers rendered with their first character to the right of their last — '
    + 'they are being laid out in the paragraph direction instead of their own',
  ).toEqual([]);

  expectNoFaults(faults, 'while measuring identifier layout in Hebrew');
});
