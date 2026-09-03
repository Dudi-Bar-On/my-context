/**
 * **The focus dialog offers the tags it could focus on, with the count each one
 * would include** — `REQ-the-focus-dialog-offers-the-tags-it-could-focus-on-with-the`.
 *
 * Owner request, 2026-09-02, in his own words: *"i would like to have such a
 * generated check box list with the item counts in the dialog so user could
 * select there and not have to remember them"*. Owner ruling on presentation,
 * 2026-09-04: **free-form tags as checkboxes, projected tags behind their
 * prefix.**
 *
 * ── WHY A BROWSER, AND WHY THIS FILE IS NOT `focus-picker.spec.ts` ────────
 *
 * That file drives the DIALOG — it opens, it is keyboard-correct, it composes
 * three lines and it writes nothing. This one drives the PICKER, which is a
 * different claim and a newer one: that the tags a reader is offered are the
 * tags this corpus really carries, that their counts are real, and that the
 * two classes are drawn as two controls rather than as one unusable list. The
 * node suite cannot see any of it — spec §6, the DOM glue is untested there —
 * and `/api/tags` answering correctly proves nothing about whether a single
 * checkbox reached the screen.
 *
 * ── THE THREE THINGS A PLAUSIBLE BUILD GETS WRONG ─────────────────────────
 *
 *  1. **A flat list.** `seq:` alone is 206 values on this fixture. A picker
 *     that put every tag in one checkbox column would be green on "the tags
 *     are offered" and useless to a person.
 *  2. **AND instead of OR.** `core/select.ts` matches an item carrying ANY of
 *     the chosen tags (`focus.tags.some(…)`), and the requirement warns in
 *     those words that "a picker that reads as AND would silently narrow to
 *     nothing". A checkbox list is read as AND by default, so the sentence
 *     saying otherwise is asserted, not assumed.
 *  3. **A second source of truth.** The box and the picker must be one list.
 *     Asserted in BOTH directions below — a tick reaches the box, and a
 *     keystroke reaches the ticks.
 */
import { test, expect } from './app.ts';

/** Everything the picker is claiming, read in one pass. */
async function picker(page: import('@playwright/test').Page): Promise<{
  boxes: number; checked: string[]; selects: string[]; seqOptions: number;
  seqCheckboxes: number; box: string; line: string; counts: string[]; title: string;
}> {
  return page.evaluate(() => {
    const host = document.getElementById('focuspick')!;
    const all = [...host.querySelectorAll('input[type="checkbox"][data-tag]')];
    return {
      boxes: all.length,
      checked: all.filter((b) => (b as HTMLInputElement).checked)
        .map((b) => (b as HTMLElement).dataset['tag'] ?? ''),
      selects: [...host.querySelectorAll('select[data-prefix]')]
        .map((s) => (s as HTMLElement).dataset['prefix'] ?? ''),
      seqOptions: (host.querySelector('select[data-prefix="seq"]') as HTMLSelectElement | null)
        ?.options.length ?? 0,
      // The measurement that makes claim 1 above testable: a projected value
      // must NOT also be a checkbox.
      seqCheckboxes: all.filter((b) => ((b as HTMLElement).dataset['tag'] ?? '')
        .startsWith('seq:')).length,
      box: (document.getElementById('focustags') as HTMLInputElement).value,
      line: document.getElementById('focusargv')?.textContent ?? '',
      // The two spans READ SEPARATELY, not the row's textContent: the row is a
      // flex line with no whitespace between its children, so `v2` and `678`
      // concatenate to `v2678` there and a regex over it would be asserting
      // against a string no reader ever sees.
      counts: [...host.querySelectorAll('.tagpick')].slice(0, 3).map((row) =>
        `${row.querySelector('.tagname')?.textContent ?? ''}|${row.querySelector('.tagn')?.textContent ?? ''}`),
      title: host.querySelector<HTMLElement>('.tagpick')?.title ?? '',
    };
  });
}

test('the dialog offers this corpus\'s real tags, counted, in their two classes', async ({ app }) => {
  const { page } = app;

  // Counted from before the dialog is even opened, for `focus-picker.spec.ts`'s
  // reason: the picker reads a new endpoint, and a picker that WROTE while
  // offering a choice would be the approval boundary routed around.
  const methods: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/')) methods.push(request.method());
  });

  await page.click('#focusbtn');
  // The read is fired by the OPEN, so the first paint is the not-yet-read
  // state and the rows arrive after it. Waited on by the thing under test
  // rather than by a timeout.
  await page.locator('#focuspick .tagpick').first().waitFor();

  const first = await picker(page);

  // ── 1 · THE TWO CLASSES ARE TWO CONTROLS ───────────────────────────────
  expect(first.selects, 'every prefix a category PROJECTS gets a control of its own, derived '
    + 'from the categories\' `projectsTo` declarations rather than listed anywhere')
    .toEqual(['plan', 'seq', 'state']);
  expect(first.seqOptions, 'the `seq:` values live inside their select — this is the whole '
    + 'reason they are not checkboxes').toBeGreaterThan(50);
  expect(first.seqCheckboxes, 'and NOT ONE of them is a checkbox. A flat list mixing two '
    + 'hundred generated `seq:` values with `v2` and `ui` is the presentation the owner ruled '
    + 'against, and it is the one a plausible build produces').toBe(0);
  expect(first.boxes, 'the free-form tags are the checkboxes, and there are many of them')
    .toBeGreaterThan(20);
  expect(first.checked, 'nothing is ticked before the reader ticks anything').toEqual([]);

  // ── 2 · THE COUNTS ARE REAL, AND THE SECOND NUMBER IS DISCLOSED ────────
  //
  // Every row carries a number, and the number is not the same number as the
  // one a focus would inject: a focus never hides a hard rule or a pinned item,
  // so `visible` exceeds `items` by that floor. Both travel; the row shows the
  // discriminating one and names the other.
  for (const row of first.counts) {
    expect(row, `"${row}" must be a tag and a whole number of items`).toMatch(/^\S+\|[0-9]+$/);
    expect(Number(row.split('|')[1]), 'and the count must be a real one, never a placeholder 0 '
      + '— every tag offered here is a tag some eligible item carries').toBeGreaterThan(0);
  }
  expect(first.title, 'the row must disclose what focusing on it would actually inject, which '
    + 'is NOT the count on screen').toMatch(/item\(s\) carry .+ injects \d+ of \d+ eligible/);

  // ── 3 · THE OR IS ON SCREEN ────────────────────────────────────────────
  //
  // `matchesFocus` accepts an item carrying ANY of the chosen tags. A reader
  // taking the list as AND would tick three and expect a narrower session than
  // they get, which is the silent failure the requirement names.
  await expect(page.locator('#focuspick .aside').last(),
    'a checkbox list reads as AND unless it says otherwise, and the tag axis is OR')
    .toContainText(/any one/i);

  // ── 4 · A TICK REACHES THE COMPOSED LINE ───────────────────────────────
  const tag = await page.locator('#focuspick input[type="checkbox"][data-tag]').first()
    .getAttribute('data-tag');
  await page.click(`#focuspick .tagpick:has(input[data-tag="${tag}"])`);
  const ticked = await picker(page);
  expect(ticked.checked, 'the tag the reader ticked is the ticked one').toEqual([tag]);
  expect(ticked.box, 'and it reached the box, which is this dialog\'s ONE list of tags')
    .toBe(tag);
  expect(ticked.line, 'and the box reached the composed line, with the confirmation the write '
    + 'form now needs').toBe(`mycontext focus --tag ${tag} --yes`);

  // ── 5 · AND A KEYSTROKE REACHES THE TICKS, which is the other direction ─
  //
  // The box is the model and the picker is a view onto it. Without this, a
  // reader who types a tag by hand sees an unticked checkbox for a tag that IS
  // in the line — two controls disagreeing about one list.
  await page.fill('#focustags', '');
  expect((await picker(page)).checked, 'clearing the box unticks what it named').toEqual([]);
  await page.fill('#focustags', tag!);
  expect((await picker(page)).checked, 'and typing it back ticks it again').toEqual([tag]);

  // ── 6 · A PROJECTED PICK REPLACES, NEVER ADDS ──────────────────────────
  //
  // A projected tag is generated from a field that holds ONE value
  // (`core/tag-projection.ts`, `reconcileTags`). A select that added would
  // compose `--tag plan:a,plan:b`, which the CLI accepts and which asks for
  // items in EITHER plan — a different question from the one the control
  // appears to ask, and one nothing on screen would reveal.
  const plans = page.locator('#focuspick select[data-prefix="plan"]');
  await plans.selectOption({ index: 1 });
  const one = await picker(page);
  const chosen = one.box.split(',').filter((t) => t.startsWith('plan:'));
  expect(chosen, 'exactly one plan token after one choice').toHaveLength(1);
  await plans.selectOption({ index: 2 });
  const two = await picker(page);
  const after = two.box.split(',').filter((t) => t.startsWith('plan:'));
  expect(after, 'a SECOND choice replaces the first rather than adding beside it')
    .toHaveLength(1);
  expect(after[0], 'and it is the one just chosen').not.toBe(chosen[0]);
  expect(two.box.split(',')).toContain(tag);

  // Back to "any" removes the token and leaves the free-form ticks alone.
  await plans.selectOption({ index: 0 });
  const cleared = await picker(page);
  expect(cleared.box.split(',').filter((t) => t.startsWith('plan:')), 'and "(any)" removes it')
    .toEqual([]);
  expect(cleared.checked, 'without disturbing the checkboxes').toEqual([tag]);

  // ── 7 · NOTHING WROTE ──────────────────────────────────────────────────
  expect([...new Set(methods)],
    'THE PICKER OFFERS AND DOES NOT WRITE. Every request made while a vocabulary was read and '
    + 'six choices were composed must be a GET.').not.toContain('POST');

  await page.keyboard.press('Escape');
});

/**
 * **The dialog fits, and the control at the bottom of it is reachable.**
 *
 * `.pop` is absolutely positioned at `inset-block-start:42px` and grew freely.
 * With three prefix selects, a scrolling tag list and the composed line, the
 * dialog ran past the bottom of the suite's own pinned 720px viewport and took
 * Copy with it — a picker nobody can act on. Bounded in `styles.css` and
 * measured here rather than eyeballed, because the failure is invisible to
 * every assertion above: each of them passes on an element that is off screen.
 */
test('the picker does not push the dialog past the viewport', async ({ app }) => {
  const { page } = app;
  await page.click('#focusbtn');
  await page.locator('#focuspick .tagpick').first().waitFor();

  const fit = await page.evaluate(() => {
    const pop = document.getElementById('focuspop')!.getBoundingClientRect();
    const copy = document.querySelector('#focusact .cmdactions button')!.getBoundingClientRect();
    return {
      popBottom: pop.bottom, copyBottom: copy.bottom, copyTop: copy.top,
      viewport: window.innerHeight,
      pageScrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(fit.popBottom, 'the dialog must end inside the window').toBeLessThanOrEqual(fit.viewport);
  expect(fit.copyTop, 'and the control it composes for must be on screen').toBeGreaterThan(0);
  expect(fit.copyBottom, 'both edges of it').toBeLessThanOrEqual(fit.viewport);
  expect(fit.pageScrollX, 'and a 400px dialog holding a 206-option select must not widen the page')
    .toBe(0);

  await page.keyboard.press('Escape');
});
