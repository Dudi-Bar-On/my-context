/**
 * **Both languages, and the round trip.**
 *
 * Two regressions from this week are pinned here, because both were invisible
 * to every static check the project had and both would have been caught in
 * seconds by a browser:
 *
 *  1. **The language toggle destroyed five PROPOSED badges.** Hebrew rendered
 *     7, English 12. The badge was nested INSIDE the `data-t` element, and
 *     `applyLang` replaces that element's children wholesale — so the badge
 *     survived only if the Hebrew string happened to contain the word, which it
 *     does not. Counting the badges in one language proves nothing; the defect
 *     is the DIFFERENCE.
 *
 *  2. **`data-t-aria` labels did not change language.** `applyLang` called only
 *     `replaceChildren`, which cannot reach an attribute. Ten aria-labels stayed
 *     English in the Hebrew UI — invisible to sighted review, and invisible to a
 *     file-level checker because the English text in the file was correct.
 *
 * And the round trip, which is the general form of both: switch to Hebrew and
 * back and the English must be restored IDENTICALLY. A one-way switch that
 * quietly flattens markup passed every static check this project had.
 */
import { test, expect } from '@playwright/test';
import { expectNoFaults, openMockup, SCREENS, showScreen } from './mockup.ts';

/** `{m:x}` / `{v:n=s}` / `{mv:n=s}` reduced to the text they render. */
function stripSlots(value: string): string {
  return value.replace(/\{(mv|m|v):([^}]*)\}/g, (_all: string, kind: string, payload: string) => {
    if (kind === 'm') return payload;
    const eq = payload.indexOf('=');
    return eq < 0 ? '' : payload.slice(eq + 1);
  });
}

test('the round trip restores the English page identically', async ({ page }) => {
  const faults = await openMockup(page);

  // Every screen visited first, so the comparison covers what each screen's
  // render functions produced and not only the landing one — `applyLang` re-runs
  // renderMd, renderDet, renderAudit, paintProv and paintViews, and any one of
  // them could come back different.
  for (const screen of SCREENS) await showScreen(page, screen);
  await showScreen(page, 'preview');

  const trip = await page.evaluate(() => {
    const snap = (): string => document.querySelector('#app')!.innerHTML;
    const lang = document.querySelector<HTMLElement>('#lang')!;
    const before = snap();
    lang.click();
    const hebrewHtml = snap();
    const hebrewDir = document.documentElement.dir;
    const hebrewLang = document.documentElement.lang;
    lang.click();
    const after = snap();

    let firstDiff = -1;
    if (before !== after) {
      const n = Math.max(before.length, after.length);
      for (let i = 0; i < n; i++) {
        if (before[i] !== after[i]) { firstDiff = i; break; }
      }
    }
    return {
      identical: before === after,
      firstDiff,
      expected: firstDiff < 0 ? '' : before.slice(Math.max(0, firstDiff - 120), firstDiff + 120),
      actual: firstDiff < 0 ? '' : after.slice(Math.max(0, firstDiff - 120), firstDiff + 120),
      hebrewDir,
      hebrewLang,
      hebrewChanged: hebrewHtml !== before,
      englishDir: document.documentElement.dir,
      englishLang: document.documentElement.lang,
    };
  });

  expect(trip.hebrewDir, 'Hebrew is right-to-left').toBe('rtl');
  expect(trip.hebrewLang, 'Hebrew declares its language').toBe('he');
  expect(trip.hebrewChanged, 'the toggle must actually change the page').toBe(true);
  expect(trip.englishDir, 'coming back restores the direction').toBe('ltr');
  expect(trip.englishLang, 'coming back restores the language').toBe('en');
  expect(
    trip.identical,
    trip.identical
      ? ''
      : 'EN -> HE -> EN did not restore the page. First difference at character '
        + `${trip.firstDiff}.\n  expected: ...${trip.expected}...\n  actual:   ...${trip.actual}...`,
  ).toBe(true);

  expectNoFaults(faults, 'across the language round trip');
});

test('the PROPOSED badges survive the language toggle — all twelve, in both', async ({ page }) => {
  const faults = await openMockup(page);

  // Located, not merely counted: the identity of each badge is the screen it
  // sits on, so a badge that vanishes from one screen and appears on another
  // still fails even though the total is unchanged.
  const census = (): Promise<{ count: number; texts: string[]; where: string[] }> =>
    page.evaluate(() => {
      const badges = [...document.querySelectorAll<HTMLElement>('.prop')];
      return {
        count: badges.length,
        texts: [...new Set(badges.map((b) => b.textContent ?? ''))],
        where: badges.map((b) => {
          const nav = b.closest<HTMLElement>('.nav');
          const pane = b.closest<HTMLElement>('[data-p]');
          return nav !== null ? `rail:${nav.dataset['s']}` : `screen:${pane?.dataset['p'] ?? '?'}`;
        }),
      };
    });

  const english = await census();
  await page.click('#lang');
  const hebrew = await census();
  await page.click('#lang');
  const restored = await census();

  expect(english.count, 'the mockup declares twelve PROPOSED badges').toBe(12);
  expect(english.texts, 'the label is the whole point and it is not translated').toEqual(['PROPOSED']);

  expect(
    hebrew.count,
    `Hebrew rendered ${hebrew.count} PROPOSED badge(s) where English rendered ${english.count}. `
    + 'A badge nested inside its data-t element is destroyed by replaceChildren, because the '
    + 'Hebrew string does not contain the word.',
  ).toBe(english.count);
  expect(hebrew.where, 'the same badges, on the same screens, in Hebrew').toEqual(english.where);
  expect(hebrew.texts, 'the badge reads PROPOSED in Hebrew too').toEqual(['PROPOSED']);

  expect(restored.count, 'and all twelve come back').toBe(english.count);
  expect(restored.where, 'in the same places').toEqual(english.where);

  expectNoFaults(faults, 'while toggling the language');
});

test('every aria-label changes language, because an attribute is not a child node', async ({ page }) => {
  const faults = await openMockup(page);

  const read = (): Promise<Record<string, string>> => page.evaluate(() => {
    const out: Record<string, string> = {};
    document.querySelectorAll<HTMLElement>('[data-t-aria]').forEach((el) => {
      out[el.dataset['tAria'] ?? ''] = el.getAttribute('aria-label') ?? '';
    });
    return out;
  });

  const english = await read();
  const keys = Object.keys(english);
  expect(keys.length, 'the mockup declares ten translated aria-labels').toBe(10);
  for (const k of keys) expect(english[k], `${k} has an English label`).not.toBe('');

  // The mockup's own Hebrew table is the specification for what each label must
  // become. Read from the page rather than re-typed here, and reduced by THIS
  // file's slot parser rather than the page's, so the assertion is not the
  // implementation checking itself.
  const heTable = await page.evaluate(() => {
    let table: Record<string, string> | undefined;
    try {
      table = (0, eval)('typeof HE !== "undefined" ? HE : undefined') as Record<string, string> | undefined;
    } catch { table = undefined; }
    if (table === undefined) return null;
    const out: Record<string, string> = {};
    for (const k of Object.keys(table)) if (k.startsWith('aria.')) out[k] = table[k]!;
    return out;
  });
  expect(heTable, 'the mockup must declare a reachable Hebrew string table').not.toBeNull();

  await page.click('#lang');
  const hebrew = await read();

  const stillEnglish = keys.filter((k) => hebrew[k] === english[k]);
  // Nine of the ten must visibly change. The tenth, `aria.scopepolicy`, is the
  // literal identifier `scopePolicy` in both tables — a name, not prose. With
  // the regression in place NONE of them change, so the floor is what catches it.
  expect(
    keys.length - stillEnglish.length,
    `only ${keys.length - stillEnglish.length} of ${keys.length} aria-labels changed language. `
    + `Still English: ${stillEnglish.join(', ')}. applyLang() must setAttribute on `
    + '[data-t-aria]; replaceChildren cannot reach an attribute.',
  ).toBeGreaterThanOrEqual(9);

  for (const k of keys) {
    expect(hebrew[k], `${k} must render the Hebrew table's value`).toBe(stripSlots(heTable![k]!));
  }

  await page.click('#lang');
  const restored = await read();
  expect(restored, 'and every English label comes back').toEqual(english);

  expectNoFaults(faults, 'while translating aria-labels');
});
