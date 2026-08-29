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
 * each answer is asserted to be `/api/select`'s own spill for THAT question —
 * which a panel stable against the reader's change cannot satisfy for both.
 *
 * ── MEASURED, UNMEASURED, FAILED ──────────────────────────────────────────
 *
 * The stronger sentence — *"a session start spills the pinned tier and the
 * index, a tool event spills the JIT tier, so the two answers share not one
 * row"* — is a fact about what the SELECTOR answered over a particular corpus,
 * and it is split out into its own test for that reason.
 *
 * It was written as an id-only comparison and it went red on 2026-08-29 over
 * a single id spilled from `pinned` under one selection and from `jit` under
 * the other. Both readings were right; the assertion was reading half a row.
 * A row is an item AND the tier that dropped it, and under that reading the
 * two answers do share nothing — measured, not assumed, and re-measured on
 * every run from the payload rather than restated here.
 *
 * When a later corpus makes the two selections spill from a tier they share,
 * that test SKIPS with the sentence naming what went unmeasured, rather than
 * failing for a non-defect or passing while measuring nothing. The comparison
 * against the payload above is unconditional and still catches the defect this
 * file exists for, so the skip costs one sentence and not the gate.
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
import type { Locator, Page } from '@playwright/test';

/** The path a scoped item names, so band 1 is occupied. */
const SCOPED_PATH = 'src/api/handler.ts';
/** A path nothing in the corpus scopes to, so the banding degenerates. */
const UNSCOPED_PATH = 'docs/architecture.md';

/** `parts.js` · `BOUND_CAP_LIST` — the display cap this list is bounded by. */
const BOUND_CAP_LIST = 20;

/**
 * **A drawn ROW, which is an item AND the tier that dropped it.**
 *
 * Reading `data-id` alone reads half of one. `parts.js`'s `tierChip` renders
 * the tier string itself as the chip's text (`el('span', cls, tier)`), so the
 * pair below is what the reader sees on the row and what `Spill` carries on
 * the wire — the same two facts, never a re-derivation of the second from the
 * first.
 *
 * This distinction is not a refinement. On 2026-08-29 the disjointness
 * assertion below went red over one id —
 * `RULE-a-regression-test-is-worth-nothing-until-you-have-watched-it`, spilled
 * from `pinned` on a session start and from `jit` on a tool event. Two
 * different rows about the same item, and the id-only reading could not tell
 * them apart.
 */
const spilledRows = (page: Page): Promise<string[]> =>
  spilledList(page).locator('.row').evaluateAll(
    (rows) => rows.map((r) => `${r.getAttribute('data-id') ?? ''} `
      + `${r.querySelector('.chip')?.textContent?.trim() ?? ''}`),
  );

/** One `Spill` as `/api/select` serves it. */
interface Spill { id: string; tier: string }

/**
 * **What `/api/select` says this selection spilled, read through the page's
 * own door.**
 *
 * `window.myctx.api` and `/lib/viewmodel.js`'s own `selectQuery`, for the two
 * reasons `e2e/served-shape.spec.ts`'s header sets out: a second HTTP client
 * in the test authenticates differently from the app and could succeed where
 * the app fails, and a hand-written query string is a DIFFERENT question —
 * `preview.js` composes its own with the SELECTED session, and a cold one has
 * a different seen ledger and therefore a different spill set.
 */
function spilledPayload(
  page: Page, event: string, path: string | null, cold = false,
): Promise<Spill[]> {
  return page.evaluate(async ([ev, p, isCold]) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const vm = await load('/lib/viewmodel.js') as unknown as {
      selectQuery: (event: string, path: string | null, session: string) => string;
    };
    const ctx = (window as unknown as {
      myctx: { session: () => string; api: (r: string) => Promise<unknown> };
    }).myctx;
    // `'cold'` is `selectQuery`'s own sentinel for `cold=1` and is not a session
    // id. Composed here rather than hand-written for the header's reason: a
    // hand-rolled query is a DIFFERENT question, and the screen composes its own.
    const session = isCold === true ? 'cold' : ctx.session();
    const body = await ctx.api(
      `/api/select?${vm.selectQuery(ev as string, p as string | null, session)}`,
    ) as { spilled: { id: string; tier: string }[] };
    return body.spilled.map((s) => ({ id: s.id, tier: s.tier }));
  }, [event, path, cold] as const);
}

/** The same pair `spilledRows` reads off the screen, taken from the payload. */
const asRows = (spills: Spill[]): string[] => spills.map((s) => `${s.id} ${s.tier}`);

/**
 * **The spilled list the screen drew LAST — and `last` is a known app defect
 * written down, not a selector preference.**
 *
 * `preview.js`'s `show()` opens with `out.replaceChildren()` and only then
 * awaits `/api/select` and `/api/simulate`; `draw()` APPENDS what comes back.
 * There is no in-flight guard, so two overlapping `show()` calls each clear an
 * already-empty container and then each append a FULL render — the screen ends
 * up holding two `#spilledRows`, two Delivered cards and two ribbons, one per
 * selection. Driving `#evsel` and then `#pathsel` starts exactly two.
 *
 * Measured 2026-08-29 over unchanged files, driving both pickers and then
 * counting `document.querySelectorAll('#spilledRows')`: two lists on roughly a
 * third of runs, sometimes transiently and sometimes for good. That is why
 * `a spilled row says which band it was offered in` was ALREADY red on one run
 * in three under the task's own baseline command, and on four runs out of four
 * with this spec run by itself — a pre-existing flake with a cause, not
 * weather.
 *
 * **The repair belongs in `src/ui/public/screens/preview.js` and was reported
 * rather than made here** (`src/**` was another lane). Until it landed, every
 * read below was scoped to ONE card, so an assertion compared one render
 * against one payload instead of two renders against either.
 *
 * **The scoping cannot hide what it works around.** These assertions compare
 * the card they read against `/api/select`'s answer for the CURRENT selection,
 * so reading the wrong render fails outright rather than passing quietly; and
 * the duplicate `#spilledRows` itself is visible to `app-layout.spec.ts` and
 * `screen-parity.spec.ts`, which read the whole screen.
 *
 * ── THE REPAIR HAS LANDED, AND THIS `.last()` IS NOW REDUNDANT ────────────
 *
 * 2026-08-29, `TASK-the-preview-can-hold-two-renders-at-once-and-session`:
 * `show()` carries a generation guard, its clear moved to where the answer
 * arrives, and `ctx.onSessionChange` answers an unsubscribe that `render()`
 * calls — so `#spilledRows` cannot be drawn twice and `.last()` and `.first()`
 * now select the same node. `e2e/preview-overlap.spec.ts` is the gate on that,
 * and it was watched red before it was watched green.
 *
 * **KEPT, and deliberately.** Removing it would delete the written record of a
 * defect that shipped for months behind exactly this workaround, and it would
 * cost nothing to keep: a scoped read of a single card is the same read. It is
 * REDUNDANT, not wrong, and it is left as the belt beside the braces —
 * `preview-overlap.spec.ts` fails on a second card, and these assertions keep
 * comparing whatever they read against the payload for the current selection,
 * so neither test can pass over a regression by leaning on the other.
 */
const spilledList = (page: Page): Locator => page.locator('#spilledRows').last();

/** Drive the event picker to a tool event against `path`, and settle. */
async function toolEvent(page: Page, path: string): Promise<void> {
  // The LANDING render first. Driving `#evsel` while the screen's own boot
  // render is still in flight is one more way to start the overlapping
  // `show()` above — and the two tests that happened to read the landing list
  // before touching a control were passing for that reason rather than by
  // design.
  await expect(
    spilledList(page).locator('.row').first(),
    'the landing render never drew a row, so the control below would be driven against a '
    + 'screen still building',
  ).toBeVisible();
  await page.selectOption('#evsel', 'tool');
  // The path picker is built only for a tool event, and `/api/coverage` is
  // fetched once when the screen first needs it — so waiting for the control
  // is also waiting for that walk.
  await expect(page.locator('#pathsel')).toBeVisible();
  await page.selectOption('#pathsel', path);
  await expect(
    spilledList(page).locator('.row').first(),
    'the tool event must spill something for this fixture to be measuring anything',
  ).toBeVisible();
}

test('the spilled list names items and costs, bounded, in the selector\'s own order', async ({ app }) => {
  const { page } = app;

  const rows = spilledList(page).locator('.row');
  await expect(rows.first(), 'the landing event spills at these budgets').toBeVisible();
  await expect(rows, 'the display cap is 20, as it is on the delivered list').toHaveCount(20);

  // Every row NAMES its item and carries the tier that dropped it. `data-id`
  // is what routes the click to the shell's own pane — a row without it is a
  // button that does nothing.
  // **`:scope >`, and it is not a tidy-up.** The row's own runs are its DIRECT
  // children — the id, the band where one was made, and the cost. Since the When
  // column landed (2026-08-29) the row also holds a `span.small` whose
  // `{mv:at}` and `{mv:tier}` slots render as nested `.m v` elements, so an
  // unscoped `.m` walk reads five runs where the row has three and "the last
  // one is the cost" becomes "the last one is a tier name". The assertion below
  // is about the row's own shape and now says so.
  const shape = await rows.evaluateAll((all) => all.map((r) => ({
    id: r.getAttribute('data-id') ?? '',
    chips: r.querySelectorAll('.chip').length,
    mono: [...r.querySelectorAll(':scope > .m')].map((m) => m.textContent ?? ''),
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
  //
  // **Anchored to the list and taken FIRST**, because the card now holds two
  // bounded lists: the spills, and under them the items the `seen` gate removed.
  // `.last()` on an unanchored `#spilledRows ~ .bound p` reads the second one,
  // which is a true sentence about a different list.
  await expect(spilledList(page).locator('~ .bound').first().locator('p')).toHaveText(
    /Showing the first 20 of \d+, in the order the selector considered them\./,
  );
});

/**
 * **The list follows the SELECTION, and it is the endpoint's own answer to it.**
 *
 * This is the measured half, and it runs on every corpus. `not.toEqual` alone
 * says the two answers differ; it cannot say the second one is RIGHT. A panel
 * that redrew from a stale payload, or drew the right rows in the wrong order,
 * or dropped one, satisfies "different" perfectly.
 *
 * So each selection is compared against what `/api/select` says that selection
 * spilled, capped where `boundedList` caps it — the relationship
 * `e2e/served-shape.spec.ts` establishes for Delivered, taken here for the
 * card that names what did NOT arrive. `not.toEqual` stays, as the
 * anti-vacuity guard it now is: if the two selections ever answered
 * identically, the two comparisons above would both pass over exactly the
 * exemplar picker's defect.
 */
test('the list CHANGES with the selection — the defect this card exists to end', async ({ app }) => {
  const { page } = app;

  await expect(spilledList(page).locator('.row').first()).toBeVisible();
  const atStart = await spilledRows(page);
  const startSpills = await spilledPayload(page, 'session-start', null);
  expect(atStart.length, 'a session start spills at these budgets').toBeGreaterThan(0);
  expect(
    atStart,
    `the landing card drew ${atStart.length} rows; \`/api/select\` spilled `
    + `${startSpills.length} items on a session start and the display cap is ${BOUND_CAP_LIST}. `
    + 'A card that names what did not arrive has to name what THIS selection did not deliver, '
    + 'in the order the selector considered them',
  ).toEqual(asRows(startSpills).slice(0, BOUND_CAP_LIST));

  await toolEvent(page, SCOPED_PATH);
  const atTool = await spilledRows(page);
  const toolSpills = await spilledPayload(page, 'tool', SCOPED_PATH);
  expect(
    atTool,
    `after the selection moved to a tool event on \`${SCOPED_PATH}\` the card drew `
    + `${atTool.length} rows; \`/api/select\` spilled ${toolSpills.length} items for THAT `
    + 'question. A panel stable against precisely the change the reader is making is the '
    + 'exemplar picker\'s defect restated',
  ).toEqual(asRows(toolSpills).slice(0, BOUND_CAP_LIST));

  expect(
    atTool,
    'the same list under a different event is the exemplar picker\'s defect restated — a '
    + 'panel stable against precisely the change the reader is making. It is also this test\'s '
    + 'anti-vacuity guard: two identical payloads would satisfy both comparisons above while '
    + 'measuring nothing about the selection',
  ).not.toEqual(atStart);
});

/**
 * **The tier claim — MEASURED where the selector reached different tiers, and
 * declared unmeasured where it did not.**
 *
 * The sentence this asserts is a fact about the SELECTOR: a session start
 * spills the pinned tier and the index, a tool event spills the JIT tier, and
 * a screen that re-read for the new selection therefore shares no row with
 * itself. Measured 2026-08-29 over `.demo-corpus`: `{pinned, index}` against
 * `{jit}`, and not one `(id, tier)` pair in common.
 *
 * **That premise is data, not code, and the test says which it got.** If a
 * later corpus, budget or event default makes the two selections spill from a
 * tier they share, then two rows about the same item under the same tier are
 * an ORDINARY answer and their overlap says nothing about whether the screen
 * re-read. This test then skips carrying that sentence, rather than failing —
 * a gate red for a non-defect is a gate people learn to discount
 * (`KNOWN-every-hook-invocation-prints-an-experimentalwarning`) — and rather
 * than passing, which would report a measurement it did not take.
 *
 * **The precondition is read from the PAYLOAD, never from the screen.** It has
 * to be: a screen that ignored the selection draws the session-start rows
 * under both, so its own tiers would look "shared" and the skip would fire on
 * exactly the defect this file exists to catch. `/api/select` is asked
 * directly, so the condition describes what the selector answered and the
 * assertion describes what the screen drew.
 *
 * **The test above still fails on that defect regardless**, which is what
 * keeps this one from being a way out: a skip here removes one sentence, not
 * the gate.
 */
test('a session start and a tool event share no spilled row, where they reached different tiers', async ({ app }) => {
  const { page } = app;

  await expect(spilledList(page).locator('.row').first()).toBeVisible();
  const startSpills = await spilledPayload(page, 'session-start', null);
  const toolSpills = await spilledPayload(page, 'tool', SCOPED_PATH);

  const startTiers = [...new Set(startSpills.map((s) => s.tier))];
  const toolTiers = [...new Set(toolSpills.map((s) => s.tier))];
  const sharedTiers = toolTiers.filter((t) => startTiers.includes(t));
  const unmeasured = 'a session start spills the pinned tier and the index; a tool event spills '
    + 'the JIT tier, so over this corpus the two answers share no row at all — but today they '
    + `share the tier${sharedTiers.length === 1 ? '' : 's'} ${JSON.stringify(sharedTiers)} `
    + `(session start: ${JSON.stringify(startTiers)}, tool event: ${JSON.stringify(toolTiers)}). `
    + 'Two rows about one item under one tier are an ordinary answer, so an overlap between the '
    + 'two lists would say nothing about whether the screen re-read. NOT measured: that the '
    + 'spilled list shares no row across the two selections.';
  // Recorded on the run even when the case IS exercised, so "measured" and
  // "unmeasured" are both visible in the report rather than only the absence
  // of a failure. `test.skip` throws, so this is pushed first.
  test.info().annotations.push({
    type: sharedTiers.length > 0 ? 'unmeasured' : 'measured',
    description: sharedTiers.length > 0
      ? unmeasured
      : `session start spilled ${JSON.stringify(startTiers)} and the tool event `
        + `${JSON.stringify(toolTiers)} — disjoint, so the row comparison is exercised`,
  });
  test.skip(sharedTiers.length > 0, unmeasured);

  const atStart = await spilledRows(page);
  await toolEvent(page, SCOPED_PATH);
  const atTool = await spilledRows(page);

  expect(
    atTool.filter((row) => atStart.includes(row)),
    'a session start spills the pinned tier and the index; a tool event spills the JIT tier, '
    + `which \`/api/select\` confirms for this run (${JSON.stringify(startTiers)} against `
    + `${JSON.stringify(toolTiers)}). The two drawn lists must therefore share no row — a row `
    + 'being an item AND the tier that dropped it, which is what the reader sees. A shared row '
    + 'here is a panel that did not re-read for the new selection',
  ).toEqual([]);
});

test('a spilled row says which band it was offered in, and only where a band was made', async ({ app }) => {
  const { page } = app;

  await toolEvent(page, SCOPED_PATH);
  const banded = await spilledList(page).locator('.row').evaluateAll(
    (rows) => rows.map((r) => [...r.querySelectorAll('.m')]
      .map((m) => m.textContent ?? '').filter((t) => t.startsWith('band '))),
  );
  expect(
    banded.every((b) => b.length === 1 && b[0] === 'band 2'),
    'a scoped item names this path, so band 1 took the budget and every spill was offered '
    + 'second. The marker is read off `Spill.band`, never re-derived from the item and the path',
  ).toBe(true);

  await page.selectOption('#pathsel', UNSCOPED_PATH);
  await expect(spilledList(page).locator('.row').first()).toBeVisible();
  const unbanded = await spilledList(page).locator('.row').evaluateAll(
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
    longest: Math.max(...[...([...document.querySelectorAll('#spilledRows')].at(-1)
      ?.querySelectorAll('.row') ?? [])].map((r) => (r.getAttribute('data-id') ?? '').length)),
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

  const first = spilledList(page).locator('.row').first();
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

/* ══════════════════════════════════════════════════════════════════════════ *
 * THE WARM QUESTION AND THE COLD ONE — `plan:walk`, 2026-08-29
 *
 * **Why nothing above caught the defect this section closes.** Every test before
 * this line reads whatever the screen happened to be asking, and until
 * 2026-08-29 the screen could only ask ONE thing: `preview.js` contained the
 * string `cold` zero times, so it always sent `session=<id>`. `/api/select` has
 * always served both questions and refuses a request carrying neither or both —
 * the cold answer was reachable from `curl` and from nowhere in the product.
 *
 * And no unit test could see it either, for a reason worth writing down: **every
 * fixture in the node suite is a cold corpus**, so the panel tested green while
 * being structurally unreachable in the app. Measured on the project's own live
 * corpus, same event, same focus, only that parameter differing — warm answered
 * `full: 1, spilled: 0`, cold answered `full: 23, spilled: 1`, and 106 items had
 * been removed at the `seen` gate and named in NO field of any response.
 *
 * So the subject here is the DIFFERENCE between the two questions, driven
 * through the control a reader actually has, with each answer compared against
 * the endpoints' own answer for that question.
 * ══════════════════════════════════════════════════════════════════════════ */

/** The question strip's two buttons — the warm default and the cold question. */
const qButton = (page: Page, which: 'live' | 'cold'): Locator =>
  page.locator(`#qpick button[data-q="${which}"]`).last();

/** The `seen`-gate list, scoped exactly as `spilledList` is and for its reason. */
const seenList = (page: Page): Locator => page.locator('#seenRows').last();

/** The card that holds both lists, for the sentences drawn between them. */
const notDelivered = (page: Page): Locator =>
  page.locator('#spilledRows').last().locator('..');

/** The current session id, as the shell resolved it. */
const sessionOf = (page: Page): Promise<string> => page.evaluate(
  () => (window as unknown as { myctx: { session: () => string } }).myctx.session(),
);

/** What `/api/simulate` says about this question, read through the page's own door. */
function simulatePayload(page: Page, event: string, path: string | null, cold: boolean): Promise<{
  full: number; spilled: number; seenFiltered: string[];
}> {
  return page.evaluate(async ([ev, p, isCold]) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const vm = await load('/lib/viewmodel.js') as unknown as {
      selectQuery: (event: string, path: string | null, session: string) => string;
    };
    const ctx = (window as unknown as {
      myctx: { session: () => string; api: (r: string) => Promise<unknown> };
    }).myctx;
    const qs = vm.selectQuery(ev as string, p as string | null,
      isCold === true ? 'cold' : ctx.session());
    const body = await ctx.api(`/api/simulate?${qs}`) as {
      selection: { full: unknown[]; spilled: unknown[] }; seenFiltered: string[];
    };
    return {
      full: body.selection.full.length,
      spilled: body.selection.spilled.length,
      seenFiltered: body.seenFiltered,
    };
  }, [event, path, cold] as const);
}

/** Drive the question strip, and wait for the answer rather than for the click. */
async function ask(page: Page, which: 'live' | 'cold'): Promise<void> {
  await expect(
    spilledList(page).locator('.row').first(),
    'the landing render never drew a row, so the control below would be driven against a screen '
    + 'still building',
  ).toBeVisible();
  await qButton(page, which).click();
  await expect(qButton(page, which)).toHaveAttribute('aria-pressed', 'true');
  await expect(spilledList(page).locator('.row').first()).toBeVisible();
}

/**
 * **The whole defect in one test: the screen can ask both questions, it says
 * which one it is answering, and each answer is that question's own.**
 *
 * The anti-vacuity guard is the one the spill list already uses a level up — the
 * two answers must DIFFER. On this corpus a warm session start spills 135 and a
 * cold one 139; if a later corpus made them coincide, both comparisons would
 * pass while measuring nothing about the control, so the difference is asserted
 * rather than assumed.
 */
test('the preview asks the warm question by default and the cold one on request, and says which', async ({ app }) => {
  const { page } = app;

  await expect(spilledList(page).locator('.row').first()).toBeVisible();
  await expect(
    qButton(page, 'live'),
    'the DEFAULT does not move. This screen promises "exactly what Claude gets", and warm is the '
    + 'honest answer to that promise — cold is a second, equally legitimate question and must '
    + 'never be silently substituted for the first',
  ).toHaveAttribute('aria-pressed', 'true');
  await expect(qButton(page, 'cold')).toHaveAttribute('aria-pressed', 'false');
  await expect(
    qButton(page, 'live'),
    'the warm option is labelled with the session it is about — a reader who cannot tell which '
    + 'of the two questions is on screen is worse off than one who could only see the first',
  ).toContainText(await sessionOf(page));

  const warmPayload = await simulatePayload(page, 'session-start', null, false);
  const warmRows = await spilledRows(page);
  expect(
    warmRows,
    'the landing card answers the WARM question, which is what the default claims',
  ).toEqual(asRows(await spilledPayload(page, 'session-start', null)).slice(0, BOUND_CAP_LIST));

  await ask(page, 'cold');
  const coldPayload = await simulatePayload(page, 'session-start', null, true);
  const coldRows = await spilledRows(page);

  test.info().annotations.push({
    type: 'measured',
    description: `session-start · warm (session=${await sessionOf(page)}): full ${warmPayload.full}`
      + `, spilled ${warmPayload.spilled}, seenFiltered ${warmPayload.seenFiltered.length} · `
      + `cold (cold=1): full ${coldPayload.full}, spilled ${coldPayload.spilled}, `
      + `seenFiltered ${coldPayload.seenFiltered.length}`,
  });

  expect(
    coldPayload.spilled,
    'a cold window has been shown nothing, so nothing is removed at the `seen` gate and more '
    + 'candidates reach the budget. Two identical answers would satisfy every comparison here '
    + 'while measuring nothing about the control',
  ).not.toEqual(warmPayload.spilled);
  expect(
    coldRows,
    'the cold view must draw the COLD selection\'s spills — a control that changes the label and '
    + 'not the query is the exemplar picker\'s defect wearing a new hat',
  ).toEqual(asRows(await spilledPayload(page, 'session-start', null, true)).slice(0, BOUND_CAP_LIST));

  // **The DRAWN spill rows are deliberately NOT compared against each other**,
  // and the reason is measured rather than assumed. On this corpus the two
  // answers spill 135 and 139 items and the difference is at the tail: the
  // pinned tier spills the same items first under both questions, so the capped
  // first twenty coincide while the answers differ by four. A `not.toEqual` on
  // the visible rows would be red for a screen that is behaving correctly.
  //
  // What IS visibly different, on every corpus where the gate removed anything,
  // is the `seen` list — and the test below asserts it in both directions.
  expect(
    warmPayload.seenFiltered.length,
    'the warm question must actually remove something at the `seen` gate for the two views to '
    + 'differ at all',
  ).toBeGreaterThan(coldPayload.seenFiltered.length);
  expect(coldPayload.seenFiltered, 'a brand-new window has been shown nothing').toEqual([]);
});

/**
 * **Rung 5 accounted for: the count on screen is the endpoint's own, and the
 * rows under it are its ids.**
 *
 * Before this, a warm preview drew *Delivered N · Not delivered 0* and the items
 * the `seen` gate had removed appeared nowhere at all — a measured zero standing
 * in for a fact nobody had measured, which is what
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` forbids and
 * why the owner read the panel as broken rather than as empty.
 */
test('the warm view NAMES what the seen gate removed, and the cold view names the zero', async ({ app }) => {
  const { page } = app;
  await expect(spilledList(page).locator('.row').first()).toBeVisible();

  const warm = await simulatePayload(page, 'session-start', null, false);
  expect(
    warm.seenFiltered.length,
    'this corpus must hold a session that has actually been delivered something, or the whole '
    + 'subject of this test is absent. `.demo-corpus` writes real seen files through the real '
    + 'hooks; a corpus without one measures nothing here',
  ).toBeGreaterThan(0);

  const drawn = await seenList(page).locator('.row').evaluateAll(
    (rows) => rows.map((r) => r.getAttribute('data-id') ?? ''),
  );
  expect(
    drawn,
    'the rows under "Filtered before budgeting" are the ids `/api/simulate` says the gate '
    + 'removed, capped where every other list on this screen is capped',
  ).toEqual(warm.seenFiltered.slice(0, BOUND_CAP_LIST));

  // The SENTENCE carries the whole count and not the drawn one: a card naming 20
  // where the gate removed 106 would be the display cap reported as a fact.
  await expect(notDelivered(page)).toContainText(
    new RegExp(`${warm.seenFiltered.length} item\\(s\\) reached the seen gate`),
  );

  // A row is a ROUTE, like every other id in this product.
  const first = seenList(page).locator('.row').first();
  const id = await first.getAttribute('data-id');
  await first.click();
  await expect(page.locator('#paneid')).toHaveText(id!);

  await ask(page, 'cold');
  await expect(
    seenList(page).locator('.row'),
    'a brand-new window has been shown nothing, so the gate removes nothing and there is no list',
  ).toHaveCount(0);
  await expect(
    notDelivered(page),
    'and the zero is NAMED rather than left as an absent list — which emptiness this is, in words',
  ).toContainText('Nothing was removed at the seen gate');
});

/**
 * **Rung 5 of the gate ladder BINDS**, which it never could before: the `seen`
 * set was resolved server-side and rode on no response, so this screen's own
 * docblock recorded the rung as one that "simply never binds".
 *
 * Warm only. On a cold preview the gate removes nothing, so no item can fail
 * there and the absence is the correct answer rather than a regression — which
 * is also why the hole survived so long: cold was the only question the screen
 * could ask.
 */
test('the gate ladder can now bind at rung 5, and does so only on the warm question', async ({ app }) => {
  const { page } = app;
  await expect(spilledList(page).locator('.row').first()).toBeVisible();

  const warm = await simulatePayload(page, 'session-start', null, false);
  expect(warm.seenFiltered.length, 'nothing filtered means nothing to bind at rung 5')
    .toBeGreaterThan(0);

  // The picker offers one exemplar per rung; the rung-5 specimen is an id the
  // endpoint named, never one this screen guessed at.
  const specimens = await page.locator('#gatepick').last().locator('button')
    .evaluateAll((all) => all.map((b) => b.textContent?.trim() ?? ''));
  const rung5 = specimens.find((id) => warm.seenFiltered.includes(id));
  expect(
    rung5,
    'the exemplar picker must offer an item that failed at `seen` — one of the ids '
    + '`/api/simulate` says the gate removed',
  ).toBeDefined();

  await page.locator('#gatepick').last().locator('button', { hasText: rung5! }).first().click();
  const rungs = await page.locator('#gates').last().locator('.rung')
    .evaluateAll((all) => all.map((r) => r.className));
  expect(
    rungs,
    'rungs 1-4 passed, rung 5 binds, rung 6 was not reached — the order IS the explanation, and '
    + 'a `seen` item that bound at `budget` would be reporting where the selector did not stop',
  ).toEqual(['rung pass', 'rung pass', 'rung pass', 'rung pass', 'rung binds', 'rung after']);
});

/**
 * **The When is the PAST, and the screen says so once per card rather than
 * leaving it to be inferred per row.**
 *
 * A preview is a simulation: nothing on the screen is being injected as the
 * reader looks at it. A per-item instant is therefore a different fact from the
 * row it sits on — the last time this item really was delivered, or really did
 * spill — and two rows in one preview can be weeks apart and both be right. If
 * the copy let a reader take it for a property of the current selection, the
 * column would be worse than absent.
 */
test('every delivered and spilled row carries a When, and the card names it as the past', async ({ app }) => {
  const { page } = app;
  await expect(spilledList(page).locator('.row').first()).toBeVisible();

  // **Wait for the SECOND paint, and wait for it explicitly.** The selection is
  // drawn first and the When a moment later, once `/api/injection-history`
  // answers — deliberately, so that reading the audit projection never delays
  // the screen's own subject (`screens/preview.js`, `show()`). `evaluateAll`
  // takes an instantaneous snapshot and does not retry, so a read taken on the
  // first paint would find no When and fail for the wrong reason.
  await expect(page.locator('#deliveredRows').last().locator('..')).toContainText(
    'The When on each row is the past, not this preview.',
  );

  for (const [what, list] of [
    ['delivered', page.locator('#deliveredRows').last()],
    ['spilled', spilledList(page)],
  ] as const) {
    const whens = await list.locator('.row').evaluateAll(
      (rows) => rows.map((r) => [...r.querySelectorAll('span.small')]
        .map((s) => s.textContent ?? '').join(' ').trim()),
    );
    expect(whens.length, `${what} must draw rows for this to measure anything`).toBeGreaterThan(0);
    expect(
      whens.filter((w) => !/^(last delivered .+ · .+|last spilled .+ · .+|never delivered|never spilled before)$/.test(w)),
      `every ${what} row must carry an instant with the tier it was recorded at, or the measured `
      + 'absence named. An empty cell reads as a rendering failure; "never delivered" is a fact '
      + 'the projection actually holds, and it is the more informative half of this column',
    ).toEqual([]);
    // Said once per CARD, in the reader's own language, because a stale reading
    // that looks like a live one is a defect this project has already shipped
    // once — and on both cards, because either can be read on its own.
    await expect(list.locator('..')).toContainText(
      'The When on each row is the past, not this preview.',
    );
  }
});

/**
 * **A projection that refuses costs the When column and NOT the selection.**
 *
 * `audit_item` is a projection and it is allowed to be `behind`, `diverged` or
 * `damaged`; a read surface may not catch it up, because syncing is a write. So
 * the times ride on their own endpoint, with their own fetch and their own
 * catch — folded into `/api/simulate`, a projection one record behind would
 * refuse this landing screen outright, which is strictly worse than the gap the
 * column was added to close.
 *
 * Driven by refusing the route at the network, which is the only deterministic
 * way in: making the real projection stale means writing to the corpus, and this
 * suite reads it.
 */
test('a refused audit projection costs the When column and leaves the selection standing', async ({ app }) => {
  const { page } = app;
  await page.route('**/api/injection-history*', (route) => route.fulfill({
    status: 503,
    contentType: 'application/json',
    body: JSON.stringify({
      error: 'the audit projection is behind relative to its log, and this endpoint may not catch '
        + 'it up: syncing is a write.',
      projectionState: 'behind',
    }),
  }));
  await page.reload();
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 15_000 });

  await expect(
    spilledList(page).locator('.row').first(),
    'the selection is a different fact from the log, and it must still be drawn in full',
  ).toBeVisible();
  const card = page.locator('#deliveredRows').last().locator('..');
  await expect(card).toContainText('Delivery times unavailable');
  await expect(
    card,
    'and it says WHY, in the server\'s own words rather than a shrug',
  ).toContainText('behind relative to its log');
  expect(
    await card.locator('.row').evaluateAll(
      (rows) => rows.flatMap((r) => [...r.querySelectorAll('span.small')]
        .map((s) => s.textContent ?? '')),
    ),
    'no row invents a time it does not have, and none draws a dash the reader would have to '
    + 'decode — the sentence above the list is the whole disclosure',
  ).toEqual([]);
});
