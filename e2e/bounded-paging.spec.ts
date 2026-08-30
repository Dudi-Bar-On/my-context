/**
 * **The way through a bounded list, in the browser that has to draw it.**
 *
 * `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`, owner,
 * 2026-08-27: *"I could not find a button or a different control that let the
 * user get the next or the previous batch of records"*.
 * `test/ui/bounded-list.test.ts` holds the DECISION — which rows a page carries,
 * which way "previous" goes on an append-only log, what each state says. Three
 * things it cannot hold, and they are the three this file exists for:
 *
 *  1. **Is the control VISIBLE?** `boundedList` gives its two step buttons no
 *     class, on purpose: `.bound button` styles them from their ancestor, which
 *     is the arrangement `e2e/button-contrast.spec.ts` was written to protect
 *     after the owner found a classless button rendering light-on-white. That
 *     is a question about the CASCADE, and the cascade only exists in a browser.
 *  2. **Does the keyboard actually drive it?** A `<button type="button">` is
 *     supposed to answer Tab, Enter and Space with no handler of its own. A
 *     stand-in document cannot tell you whether it does; pressing the keys can.
 *  3. **Where does focus GO when a control goes inert?** `disabled` removes a
 *     button from the tab order, and `document.activeElement` after a real
 *     `disabled = true` is the browser's own answer, not the fake's.
 *
 * ── WHY THE CONTROL IS MOUNTED RATHER THAN FOUND, AND WHAT CHANGED ────────
 *
 * **The measurement this file was written on is out of date, and the direction
 * it moved in is the one that matters.** It read, on 2026-08-27:
 *
 *     No bounded surface in the simulated corpus exceeds its own cap: the
 *     preview delivers 4 rows against BOUND_CAP_LIST of 20, the injected table
 *     0 against 50, and the pack stack holds 1.
 *
 * Re-measured over `.demo-corpus` on 2026-08-30, screen by screen, in the
 * browser:
 *
 *     preview  Delivered        6 of 20      Showing all 6.
 *     preview  Carried lines    3 of 20      Showing all 3.
 *     preview  NOT DELIVERED  136 of 20      Showing the first 20 of 136.  ← two step controls
 *     injected default          6 of 50      Showing all 6.
 *     work     Review queue    12 of 20      Showing all 12.
 *     work     Revisions        1 of 50      Showing all 1.
 *     packs                     1 of 50      Showing all 1.
 *     ask      Audit        8,565 of 50      Showing the first 50 of 8,565.  ← two step controls
 *
 * Two surfaces already cross, and neither was made to: the spill list is what a
 * corpus of seven hundred items does to five small budgets, and the Ask tab is
 * reading a real audit projection. **The first served-screen test below is
 * therefore the one `plan:port seq:94b` asked for** — the control driven
 * through the app rather than through a mounted module — and the mounted tests
 * are KEPT, exactly as that task requires, because they cover the `take: 'last'`
 * direction and the display-only wording that no one fixture session reaches.
 *
 * A third crosses since 2026-08-30 and had to be built:
 * `scripts/demo-corpus.ts` now drives one session through a full working day of
 * REAL hook payloads, so its seen file holds sixty rows against a cap of fifty.
 * It is not the default session and the shell has no picker, so
 * `e2e/injected-empty.spec.ts` reaches it the way that file already reaches the
 * cleared one.
 *
 * For the questions the corpus still offers nothing to click for — a list of
 * exactly 45 going inert at its last page, an append-only log's `take: 'last'`,
 * the Hebrew table — the same `boundedList` the five screens call is mounted
 * INSIDE the running app, on the preview section, through the app's own
 * `/screens/parts.js`, `/lib/i18n.js` and `/strings/en.js`. It is the shipped
 * module under the shipped stylesheet inside the shipped shell — every ancestor
 * rule that decides whether the buttons can be seen is the real one. Lowering a
 * cap until the fixture happened to trip it would have measured the same code
 * against a corpus this product never serves, and `screen-parity`'s header
 * names that edit as the one that makes a gate worse than nothing.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** Navigate the rail to `preview` and wait for the screen to have drawn. */
async function showPreview(page: Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('.nav[data-s="preview"]')?.click();
  });
  await page.locator('section[data-p="preview"] #deliveredRows .row')
    .first().waitFor({ state: 'visible', timeout: 20_000 });
}

/**
 * Mount a `boundedList` over `total` synthetic rows inside the preview section,
 * and hand back the selector root.
 *
 * The modules are imported by the specifiers the BROWSER resolves, which is the
 * whole point: a rewritten copy would be a different module graph, and this file
 * exists to measure the one the app runs.
 */
async function mount(
  page: Page, total: number, spec: Record<string, unknown>, language: 'en' | 'he' = 'en',
): Promise<string> {
  await page.evaluate(async ([count, listSpec, lang]) => {
    // The specifier is held in a variable so that TypeScript, which resolves a
    // LITERAL `import('/screens/parts.js')` against the file system and finds
    // the drive root, leaves it alone. It is the browser that resolves these,
    // and it resolves them against the server — which is the whole reason this
    // file imports them in this form rather than through a rewritten copy.
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const parts = await load('/screens/parts.js') as unknown as {
      boundedList: (ctx: unknown, host: unknown, items: unknown[],
        draw: (item: unknown) => unknown, spec: unknown) => HTMLElement;
    };
    const i18n = await load('/lib/i18n.js') as unknown as {
      t: (strings: unknown, key: string, subs: unknown) => Node[];
    };
    const table = await load(`/strings/${lang as string}.js`) as unknown as
      { strings: Record<string, string> };
    const ctx = {
      t: (key: string, subs: Record<string, unknown> = {}) => i18n.t(table.strings, key, subs),
    };
    const scene = document.querySelector('section[data-p="preview"]')!;
    document.getElementById('probe')?.remove();
    const card = document.createElement('div');
    card.id = 'probe';
    card.className = 'card';
    const host = document.createElement('div');
    host.className = 'rows';
    const items = Array.from({ length: count as number }, (_, i) => `row-${i + 1}`);
    const bound = parts.boundedList(ctx, host, items, (item) => {
      const row = document.createElement('div');
      row.className = 'row';
      row.textContent = String(item);
      return row;
    }, listSpec);
    card.append(host, bound);
    scene.prepend(card);
  }, [total, spec, language] as const);
  return '#probe';
}

const line = (root: string): string => `${root} .bound p`;
const step = (root: string, which: 'prev' | 'next'): string =>
  `${root} .bound button[data-step="${which}"]`;

/* ══ CONDITION 3, AGAINST THE REAL CORPUS ════════════════════════════════ */

test('the delivered list holds back nothing in this corpus, and therefore draws no paging control', async ({ app }) => {
  await showPreview(app.page);
  const bound = app.page.locator('section[data-p="preview"] #deliveredRows + .bound');
  await expect(bound, 'the delivered list still declares its bound').toBeVisible();
  // Six rows against a cap of twenty is not a truncation. The list two cards
  // down IS truncated — 136 against the same cap — which is why this test names
  // `#deliveredRows` rather than the screen: the two states now sit on one
  // screen, and that is the pair a reader has to be able to tell apart.
  await expect(bound.locator('p'), 'a delivery smaller than the cap is not a truncation')
    .toHaveText(/Showing all \d+\./);
  // ABSENT, not hidden and not disabled. *An inert control is the same lie as a
  // blank screen* is the requirement's own sentence, and a hidden button is
  // still a node in the document that a reader cannot use.
  await expect(bound.locator('button[data-step]'),
    'a list showing everything must not offer a way to somewhere else').toHaveCount(0);
});

/* ══ THE WAY THROUGH, ON A SERVED SCREEN, OVER THE PRODUCT'S OWN DATA ════ */

test('Not delivered holds rows back, and the control walks them without a mounted module', async ({ app }) => {
  await showPreview(app.page);
  // `drawSpilled` appends its bound directly after `#spilledRows`, the same
  // arrangement `#deliveredRows` has above.
  const bound = app.page.locator('section[data-p="preview"] #spilledRows + .bound');
  const boundLine = bound.locator('p');
  await expect(bound, 'the spill list declares its bound').toBeVisible();

  // **Non-vacuity, and it is the whole point of this test.** A corpus whose
  // spill list fits inside the cap would pass every assertion below by drawing
  // nothing, which is exactly the hole `plan:port seq:94b` was filed for: *a
  // feature the demo corpus cannot demonstrate looks exactly like a feature
  // that does not work.*
  await expect(boundLine,
    'the spill list must exceed BOUND_CAP_LIST for anything below to mean anything. If this '
    + 'reads "Showing all N", no served screen in this corpus holds a row back and the paging '
    + 'control is once again untested outside a mounted module — which is the state '
    + '`TASK-the-demo-corpus-cannot-trip-a-single-list-bound-so-paging-is` records.')
    .toHaveText(/Showing the first 20 of \d+/);

  const rows = app.page.locator('section[data-p="preview"] #spilledRows .row');
  await expect(rows, 'the page is the cap, not the whole list').toHaveCount(20);
  const firstOnPageOne = await rows.first().getAttribute('data-id');

  // ABSENT versus DISABLED, in both directions, on arrival: there is nothing
  // before the first page and there is something after it.
  await expect(bound.locator('button[data-step="prev"]'),
    'the first page has nothing before it').toBeDisabled();
  await expect(bound.locator('button[data-step="next"]')).toBeEnabled();

  await bound.locator('button[data-step="next"]').click();
  await expect(boundLine,
    'the line must say WHERE the reader is, on served data as on mounted data')
    .toHaveText(/Rows 21–40 of \d+/);
  await expect(rows.first(),
    'the second page must be different rows, not the same twenty re-rendered')
    .not.toHaveAttribute('data-id', firstOnPageOne ?? '');

  // **The rows are still the product's**, which a mounted list cannot check:
  // every one of them is an id the shell's delegated handler will open, so a
  // page reached by the control is as usable as the page it opened on.
  await expect(rows.first()).toHaveAttribute('data-id', /.+/);

  // Forward AND back — *a reader who steps past what they wanted must be able
  // to return.*
  await bound.locator('button[data-step="prev"]').click();
  await expect(boundLine).toHaveText(/Showing the first 20 of \d+/);
  await expect(rows.first()).toHaveAttribute('data-id', firstOnPageOne ?? '');
});

/* ══ THE CONTROL IS VISIBLE, WHICH ONLY A CASCADE CAN SAY ════════════════ */

test('both step controls are visible and painted by .bound button, not by the user agent', async ({ app }) => {
  await showPreview(app.page);
  const root = await mount(app.page, 120, { cap: 20, order: 'admitted' });

  for (const which of ['prev', 'next'] as const) {
    const button = app.page.locator(step(root, which));
    await expect(button, `${which} must be on screen`).toBeVisible();
    // The measurement `button-contrast.spec.ts` takes, for the reason it takes
    // it: `styles.css`' only global button rule sets `color` and NOT
    // `background`, so a button outside a styling ancestor takes the app's
    // light text and Chrome's near-white `buttonface` — invisible, and
    // invisible precisely because the half-reset succeeded at one half. These
    // two carry no class of their own, so `.bound button` is the only rule
    // that can save them, and this is the assertion that it does.
    const painted = await button.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { background: cs.backgroundColor, border: cs.borderTopWidth };
    });
    expect(painted.background,
      `${which} fell back to the user agent's button face — it is outside .bound, or that rule `
      + 'stopped matching').not.toBe('rgba(0, 0, 0, 0)');
    expect(painted.border, `${which} lost the .bound button border`).not.toBe('0px');
  }
});

/* ══ CONDITIONS 1, 2 AND 4, DRIVEN FROM THE KEYBOARD ════════════════════ */

test('Tab reaches the control and Enter moves the page — no key handler of our own', async ({ app }) => {
  await showPreview(app.page);
  const root = await mount(app.page, 120, { cap: 20, order: 'admitted' });

  await expect(app.page.locator(line(root)))
    .toHaveText('Showing the first 20 of 120, in the order the selector admitted them.');

  // Focused rather than clicked, then driven with the keys a real reader
  // presses. `<button type="button">` is supposed to answer both with no
  // listener beyond `click`; this is the assertion that the element choice
  // carried its own keyboard support rather than needing one.
  await app.page.locator(step(root, 'next')).focus();
  await expect(app.page.locator(step(root, 'next'))).toBeFocused();
  await app.page.keyboard.press('Enter');
  await expect(app.page.locator(line(root)),
    'the line must say WHERE the reader is — a position, not merely that more exists')
    .toHaveText(/Rows 21–40 of 120,.*20 before this page, 80 after it\./);
  await expect(app.page.locator(`${root} .row`).first()).toHaveText('row-21');

  await app.page.keyboard.press('Space');
  await expect(app.page.locator(line(root))).toHaveText(/Rows 41–60 of 120/);

  // Forward AND back: *a reader who steps past what they wanted must be able
  // to return*.
  await app.page.locator(step(root, 'prev')).focus();
  await app.page.keyboard.press('Enter');
  await expect(app.page.locator(line(root))).toHaveText(/Rows 21–40 of 120/);
  await app.page.keyboard.press('Enter');
  await expect(app.page.locator(line(root)))
    .toHaveText('Showing the first 20 of 120, in the order the selector admitted them.');
});

test('the bound line is the live region, so the move is announced where it is stated', async ({ app }) => {
  await showPreview(app.page);
  const root = await mount(app.page, 120, { cap: 20, order: 'admitted' });
  await expect(app.page.locator(line(root))).toHaveAttribute('aria-live', 'polite');
  // The announcement is the SAME text the sighted reader gets, which is the
  // reason no second region exists to drift out of step with this one.
  await app.page.locator(step(root, 'next')).click();
  await expect(app.page.locator(line(root))).toHaveText(/Rows 21–40 of 120/);
});

test('a control that goes inert hands its focus to the live one, in the browser\'s own words', async ({ app }) => {
  await showPreview(app.page);
  const root = await mount(app.page, 45, { cap: 20, order: 'admitted' });

  const next = app.page.locator(step(root, 'next'));
  await next.focus();
  await app.page.keyboard.press('Enter');
  await app.page.keyboard.press('Enter');
  await expect(next, 'the last page is reached, so Next has nowhere to go').toBeDisabled();
  // `document.activeElement` after a REAL `disabled = true`, which is the half
  // no stand-in can answer: a disabled button is out of the tab order, and a
  // keyboard reader who was standing on it would otherwise be returned to the
  // top of the document with no way back to the list they were reading.
  await expect(app.page.locator(step(root, 'prev'))).toBeFocused();
});

/* ══ take: 'last' — PREVIOUS MEANS OLDER, IN A REAL BROWSER ═════════════ */

test('on an append-only list Previous shows OLDER rows and Next is refused at the newest end', async ({ app }) => {
  await showPreview(app.page);
  // `packs`, `work` and `injected` all read append-only logs and all pass
  // `take: 'last'`; the opening page is the END of the array. Getting this
  // backwards shows the wrong end of the log under a sentence naming the right
  // one, and the reader has no way to tell.
  const root = await mount(app.page, 120, { cap: 50, order: 'recent', take: 'last' });

  await expect(app.page.locator(line(root))).toHaveText('Showing the 50 most recent of 120.');
  await expect(app.page.locator(`${root} .row`).first()).toHaveText('row-71');
  await expect(app.page.locator(step(root, 'next')),
    'nothing is newer than the opening page of an append-only log').toBeDisabled();

  await app.page.locator(step(root, 'prev')).click();
  await expect(app.page.locator(`${root} .row`).first(),
    'Previous on an append-only log means OLDER').toHaveText('row-21');
  await expect(app.page.locator(line(root)))
    .toHaveText(/Rows 21–70 of 120.*20 before this page, 50 after it\./);
  await expect(app.page.locator(step(root, 'next'))).toBeEnabled();
});

/* ══ THE ONE THING NOT TO LOSE ══════════════════════════════════════════ */

test('a display cap says it is a display cap on every page, in both languages', async ({ app }) => {
  await showPreview(app.page);
  const root = await mount(app.page, 47, { cap: 20, order: 'admitted', displayOnly: true });

  const promise = 'A display limit. All 47 were in the injection — none were dropped.';
  await expect(app.page.locator(line(root))).toContainText(promise);
  await app.page.locator(step(root, 'next')).click();
  // The preview's whole promise is *exactly what Claude gets*. "Rows 21–40 of
  // 47" reads as "you were given rows 21 to 40" at least as readily as
  // "showing 20 of 47" read as "you were given 20" — more so, because a page
  // number is what a reader has learned means *the rest is elsewhere*.
  await expect(app.page.locator(line(root)),
    'moving through a DISPLAY cap is not moving through what was delivered, and the sentence '
    + 'has to keep saying so on every page').toContainText(promise);

  // Hebrew is not a second implementation, but it IS a second table, and a key
  // added to one of them is the failure this project keeps a parity test for.
  //
  // Re-mounted after the toggle rather than translated in place, because the
  // toggle RELOADS: `app.js` writes the choice to localStorage and calls
  // `location.reload()`, and the boot then reads its token back out of
  // sessionStorage. That is the app's own behaviour and not something to work
  // around — every real bounded list is rebuilt by exactly that path — so the
  // reload is waited for rather than raced.
  await Promise.all([
    app.page.waitForLoadState('load'),
    app.page.evaluate(() => { document.querySelector<HTMLElement>('#lang')?.click(); }),
  ]);
  await expect(app.page.locator('.nav').first(),
    'the page came back from the reload without a token').toBeVisible({ timeout: 15_000 });
  await showPreview(app.page);
  const hebrew = await mount(app.page, 47, { cap: 20, order: 'admitted', displayOnly: true }, 'he');
  await app.page.locator(step(hebrew, 'next')).click();
  const said = await app.page.locator(line(hebrew)).textContent();
  expect(said ?? '', 'the paged bound line fell back to English in the Hebrew UI')
    .toMatch(/שורות/);
});
