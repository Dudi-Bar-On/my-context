/**
 * `plan:walk seq:56` — **the Injection preview NAMES what did not arrive**,
 * driven in a real browser against the real app.
 *
 * ── WHY A BROWSER TEST, AND WHY IT DRIVES TWO EVENTS ──────────────────────
 *
 * The complaint this closes was not that a number was wrong. It was that the
 * screen did not MOVE: *"can not see changes to why not, and also there is no
 * place ther for a list of items that did not delivered"*. The Why-not picker
 * holds one exemplar per rung, `/api/items` is sorted by id, so the same
 * specimen comes back whatever the reader changes — stability reported as
 * blindness, and correctly.
 *
 * A test that asserted the list EXISTS would pass over exactly that defect. So
 * the subject here is the difference between two selections: the list is read
 * on `session-start`, the event is driven to `tool` against a real path, and
 * the two are asserted to differ. Over `.demo-corpus` those two answers share
 * not one row — a session start spills the pinned tier and the index, a tool
 * event spills the JIT tier and nothing else — and the exemplar picker would
 * fail this assertion today.
 *
 * ── THE BAND, WHICH IS THE HALF THE RULING WAS WAITING FOR ────────────────
 *
 * `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` shipped a
 * REORDERING and left the screen unable to explain it. `Spill.band` now
 * carries the position out of `fitToBudget` itself, and the two paths below
 * are chosen so that the same corpus answers both ways:
 *
 *   `src/api/handler.ts`   `RULE-handlers-validate-at-the-boundary` declares
 *                          `src/api/**`, so band 1 is occupied, it takes the
 *                          budget, and all 111 spills say `band 2` — the
 *                          displacement, visible.
 *   `docs/architecture.md` nothing in the corpus scopes there. Band 1 is
 *                          EMPTY, the candidates were never split, and no row
 *                          carries a band at all. A marker here would be
 *                          reporting a partition nobody made.
 *
 * Both directions are asserted, because a field that is always present and a
 * field that is never present both pass a one-sided check.
 *
 * ── AND THE WIDTH ────────────────────────────────────────────────────────
 *
 * Ids in this project reach 67 characters (`core/focus.ts` ·
 * `of 67 characters**, which is why a dangling edge is two lines rather than one:` · ~482).
 * `.demo-corpus`'s longest is 66, close enough that the layout property is the
 * same one and honest to state as measured rather than as claimed. The rows
 * inherit `.row .idfull{flex:1;min-inline-size:0}` from the delivered list, so
 * a long id wraps inside its own row; the assertion is the one
 * `app-layout.spec.ts` makes for every screen, taken here with the list on
 * screen and its widest ids drawn.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** The path a scoped item names, so band 1 is occupied. */
const SCOPED_PATH = 'src/api/handler.ts';
/** A path nothing in the corpus scopes to, so the banding degenerates. */
const UNSCOPED_PATH = 'docs/architecture.md';

/** Every id the spilled list is drawing, in the order it drew them. */
const spilledIds = (page: Page): Promise<string[]> =>
  page.locator('#spilledRows .row').evaluateAll(
    (rows) => rows.map((r) => r.getAttribute('data-id') ?? ''),
  );

/** Drive the event picker to a tool event against `path`, and settle. */
async function toolEvent(page: Page, path: string): Promise<void> {
  await page.selectOption('#evsel', 'tool');
  // The path picker is built only for a tool event, and `/api/coverage` is
  // fetched once when the screen first needs it — so waiting for the control
  // is also waiting for that walk.
  await expect(page.locator('#pathsel')).toBeVisible();
  await page.selectOption('#pathsel', path);
  await expect(
    page.locator('#spilledRows .row').first(),
    'the tool event must spill something for this fixture to be measuring anything',
  ).toBeVisible();
}

test('the spilled list names items and costs, bounded, in the selector\'s own order', async ({ app }) => {
  const { page } = app;

  const rows = page.locator('#spilledRows .row');
  await expect(rows.first(), 'the landing event spills at these budgets').toBeVisible();
  await expect(rows, 'the display cap is 20, as it is on the delivered list').toHaveCount(20);

  // Every row NAMES its item and carries the tier that dropped it. `data-id`
  // is what routes the click to the shell's own pane — a row without it is a
  // button that does nothing.
  const shape = await rows.evaluateAll((all) => all.map((r) => ({
    id: r.getAttribute('data-id') ?? '',
    chips: r.querySelectorAll('.chip').length,
    mono: [...r.querySelectorAll('.m')].map((m) => m.textContent ?? ''),
  })));
  expect(shape.every((r) => r.id !== ''), 'every row names its item').toBe(true);
  expect(shape.every((r) => r.chips === 1), 'every row carries exactly one tier chip').toBe(true);
  // The id itself is a `.m` run, then the cost: a spilled row is never a name
  // with no price, which is the whole answer to "was my budget too small".
  expect(
    shape.every((r) => r.mono.length >= 2 && /^[\d,]+$|^—$/.test(r.mono[r.mono.length - 1]!)),
    'each row ends in a token count, or in the dash an index line takes because per-line '
    + 'index costs are served by no endpoint',
  ).toBe(true);

  // The bound says what it is holding back, and says it in the CONSIDERED
  // wording — these rows were not admitted, which is the card's whole subject.
  await expect(page.locator('#spilledRows ~ .bound p').first()).toHaveText(
    /Showing the first 20 of \d+, in the order the selector considered them\./,
  );
});

test('the list CHANGES with the selection — the defect this card exists to end', async ({ app }) => {
  const { page } = app;

  await expect(page.locator('#spilledRows .row').first()).toBeVisible();
  const atStart = await spilledIds(page);
  expect(atStart.length, 'a session start spills at these budgets').toBeGreaterThan(0);

  await toolEvent(page, SCOPED_PATH);
  const atTool = await spilledIds(page);

  expect(
    atTool,
    'the same list under a different event is the exemplar picker\'s defect restated — a '
    + 'panel stable against precisely the change the reader is making',
  ).not.toEqual(atStart);
  expect(
    atTool.filter((id) => atStart.includes(id)),
    'a session start spills the pinned tier and the index; a tool event spills the JIT tier. '
    + 'Over this corpus the two answers share no row at all',
  ).toEqual([]);
});

test('a spilled row says which band it was offered in, and only where a band was made', async ({ app }) => {
  const { page } = app;

  await toolEvent(page, SCOPED_PATH);
  const banded = await page.locator('#spilledRows .row').evaluateAll(
    (rows) => rows.map((r) => [...r.querySelectorAll('.m')]
      .map((m) => m.textContent ?? '').filter((t) => t.startsWith('band '))),
  );
  expect(
    banded.every((b) => b.length === 1 && b[0] === 'band 2'),
    'a scoped item names this path, so band 1 took the budget and every spill was offered '
    + 'second. The marker is read off `Spill.band`, never re-derived from the item and the path',
  ).toBe(true);

  await page.selectOption('#pathsel', UNSCOPED_PATH);
  await expect(page.locator('#spilledRows .row').first()).toBeVisible();
  const unbanded = await page.locator('#spilledRows .row').evaluateAll(
    (rows) => rows.flatMap((r) => [...r.querySelectorAll('.m')]
      .map((m) => m.textContent ?? '').filter((t) => t.startsWith('band '))),
  );
  expect(
    unbanded,
    'nothing scopes to this path, so band 1 is empty, the candidates were never split, and a '
    + 'band marker would report a partition the selector did not make',
  ).toEqual([]);
});

test('a full-length id does not scroll the page sideways', async ({ app }) => {
  const { page } = app;
  await toolEvent(page, SCOPED_PATH);

  const measured = await page.evaluate(() => ({
    longest: Math.max(...[...document.querySelectorAll('#spilledRows .row')]
      .map((r) => (r.getAttribute('data-id') ?? '').length)),
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(
    measured.longest,
    'this assertion is only worth making over ids at real length — the corpus\'s longest is 66 '
    + 'and the project\'s reach 67',
  ).toBeGreaterThanOrEqual(60);
  // One pixel of slack, as `app-layout.spec.ts` takes: a fractional layout
  // width rounds up and is not a bug.
  expect(
    measured.scrollWidth,
    'a 66-character id in a list of them must wrap inside its own row; wide content scrolls in '
    + 'its own container, never the document',
  ).toBeLessThanOrEqual(measured.clientWidth + 1);
});

test('a spilled row opens the item, so the list is a route and not a readout', async ({ app }) => {
  const { page } = app;

  const first = page.locator('#spilledRows .row').first();
  await expect(first).toBeVisible();
  const id = await first.getAttribute('data-id');
  await first.click();

  await expect(
    page.locator('#pane'),
    'a row carries data-id, so the shell\'s delegated handler opens the pane — the same path '
    + 'every other id in this product takes',
  ).toBeVisible();
  await expect(page.locator('#paneid')).toHaveText(id!);
});
