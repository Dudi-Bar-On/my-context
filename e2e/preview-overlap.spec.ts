/**
 * `plan:walk seq:72` — **the Injection preview holds ONE render, and it is the
 * one the reader last asked for.**
 *
 * ── THE DEFECT THIS FILE EXISTS FOR ────────────────────────────────────────
 *
 * `screens/preview.js`'s `show()` used to clear `out`, then await
 * `/api/select` and `/api/simulate`, and only then `draw()` — which APPENDS.
 * Two overlapping calls therefore each cleared an already-empty container and
 * each appended a full render, and the screen ended up holding two
 * `#spilledRows`, two Delivered cards and two `#ribbons`, one per selection,
 * both on screen at once.
 *
 * It had been shipping for as long as the screen had. It was invisible because
 * `e2e/preview-spilled.spec.ts` reads `#spilledRows` through a `.last()` that
 * was added as a MITIGATION, with the cause written into the file — a
 * deliberate workaround, not a selector preference. A workaround is not a gate:
 * nothing was failing on the doubling itself, so nothing was going to fix it.
 * This file is that gate.
 *
 * ── WHY IT DRIVES TWO CHANGES IN ONE SYNCHRONOUS TURN ──────────────────────
 *
 * Because a race asserted by timing is a race asserted by luck. Both `change`
 * events are dispatched inside ONE `page.evaluate` callback, so both `show()`
 * calls run to their first `await` before the browser can turn — the overlap
 * is constructed, not waited for, and this test measures the same thing on a
 * fast machine and a loaded one.
 *
 * That is not a synthetic gesture either. It is what the app does to itself:
 * `render()` subscribes to `ctx.onSessionChange` and the shell used to fire
 * every listener on every read of `/api/sessions` whether or not the session
 * had moved, while `onSessionChange` pushed listeners and never removed them.
 * A reader changing the event picker while a session refresh lands is exactly
 * two `show()` calls in one turn.
 *
 * ── RED BEFORE GREEN ───────────────────────────────────────────────────────
 *
 * Measured 2026-08-29, `chromium` and `chrome`, with the guard removed from
 * `show()` and the clear put back at the top: `two selections in flight leave
 * ONE render` fails on the counts — two of each card — on every run. With the
 * guard in place it passes on every run. The counts are read AFTER both
 * answers have landed (the responses are counted, not slept on), so a pass is
 * a measurement of the settled screen and not of a window before the second
 * append.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** The three cards a full render draws, each of which used to be drawn twice. */
interface Cards {
  spilled: number;
  delivered: number;
  ribbons: number;
}

/** What the preview section is holding right now. */
function cards(page: Page): Promise<Cards> {
  return page.evaluate(() => {
    const section = document.querySelector('section[data-p="preview"]');
    const count = (selector: string): number =>
      section === null ? -1 : section.querySelectorAll(selector).length;
    return {
      spilled: count('#spilledRows'),
      delivered: count('#deliveredRows'),
      ribbons: count('#ribbons'),
    };
  });
}

/** `Spill` as `/api/select` serves it, read through the page's own door. */
function spilledPayload(page: Page, event: string): Promise<string[]> {
  return page.evaluate(async (ev) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const vm = await load('/lib/viewmodel.js') as unknown as {
      selectQuery: (event: string, path: string | null, session: string) => string;
    };
    const ctx = (window as unknown as {
      myctx: { session: () => string; api: (r: string) => Promise<unknown> };
    }).myctx;
    const body = await ctx.api(
      `/api/select?${vm.selectQuery(ev, null, ctx.session())}`,
    ) as { spilled: { id: string; tier: string }[] };
    return body.spilled.map((s) => `${s.id} ${s.tier}`);
  }, event);
}

/** `parts.js` · `BOUND_CAP_LIST` — the display cap the spilled list is drawn under. */
const BOUND_CAP_LIST = 20;

test('two selections in flight leave ONE render on screen, and it is the newer one', async ({ app }) => {
  const { page } = app;

  // The landing render, so the overlap below is driven against a screen that
  // has finished rather than one still building.
  await expect(
    page.locator('#spilledRows .row').first(),
    'the landing render never drew a row, so there is no settled screen to overlap',
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('#spilledRows'), 'the landing render alone is one card')
    .toHaveCount(1);

  // Every answer this overlap will produce, counted at the wire. Waiting on
  // these rather than on a timeout is what makes the assertion below a
  // statement about the SETTLED screen: until both selections have been
  // answered, "one card" is a window and not a result.
  const answered: string[] = [];
  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('/api/select?') || url.includes('/api/simulate?')) answered.push(url);
  });

  // ── THE OVERLAP, CONSTRUCTED ────────────────────────────────────────────
  //
  // Two `change` events in one synchronous callback. `show()` reads `#evsel`
  // at its first line and then awaits, so the first call is committed to
  // `session-start` and the second to `compact` before either can resolve —
  // two full renders in flight over two different selections, which is the
  // exact shape that used to leave two of every card.
  await page.evaluate(() => {
    const picker = document.getElementById('evsel') as HTMLSelectElement;
    picker.value = 'session-start';
    picker.dispatchEvent(new Event('change'));
    picker.value = 'compact';
    picker.dispatchEvent(new Event('change'));
  });

  // Two selections, two endpoints each. `/api/items` is cached by the render
  // and is not asked again, which is why only these two are counted.
  await expect
    .poll(() => answered.length, {
      message: 'both selections must be answered before the screen is read — otherwise '
        + '"one card" is a window before the second append rather than the settled state',
      timeout: 15_000,
    })
    .toBeGreaterThanOrEqual(4);
  // The last answer has landed; `draw()` runs off its microtask. A settle here
  // is what lets the counts below be an assertion about the finished screen —
  // and it is what makes the unfixed code go RED rather than racing green.
  await expect
    .poll(async () => JSON.stringify(await cards(page)), { timeout: 20_000 })
    .toBe(JSON.stringify({ spilled: 1, delivered: 1, ribbons: 1 }));

  // Stated again as a plain read, so a failure names the numbers rather than a
  // JSON string that timed out.
  expect(
    await cards(page),
    'two overlapping `show()` calls each cleared an already-empty container and each appended '
    + 'a full render, so the screen held two spilled lists, two Delivered cards and two '
    + 'ribbons — one per selection, both on screen',
  ).toEqual({ spilled: 1, delivered: 1, ribbons: 1 });

  // ── AND THE SURVIVOR IS THE NEWER SELECTION ─────────────────────────────
  //
  // NEWEST wins, not fastest. A guard that kept whichever answer arrived first
  // would leave one card and the wrong one in it — a screen showing the
  // reader's previous question under their current picker — and would pass
  // every count above. So the drawn rows are compared against `/api/select`'s
  // answer for `compact`, which is the selection the reader last asked for.
  const drawn = await page.locator('#spilledRows .row').evaluateAll(
    (rows) => rows.map((r) => `${r.getAttribute('data-id') ?? ''} `
      + `${r.querySelector('.chip')?.textContent?.trim() ?? ''}`),
  );
  const compact = await spilledPayload(page, 'compact');
  expect(
    drawn,
    'the second change is the question the reader is looking at, so the render that survives '
    + 'must be its answer — a first-wins guard leaves one card holding the previous selection',
  ).toEqual(compact.slice(0, BOUND_CAP_LIST));
});

/**
 * **The other half: a session change starts ONE render per screen, however
 * many times that screen has been rendered.**
 *
 * `ctx.onSessionChange` used to be `sessionListeners.push(fn)` — no
 * unsubscribe existed, and `render()` runs again on every return to the route
 * and on every live refresh. Three visits to `#/preview` left three listeners,
 * so one session change started three `show()` calls, which is three
 * `/api/select` requests for one answer and (before the guard above) up to
 * three renders on screen.
 *
 * ── HOW A SESSION CHANGE IS REACHED FROM A TEST ───────────────────────────
 *
 * Through the app's own door, and only that door. `loadSessions()` is called
 * from `main()` and from the nonce-redemption handler, so pasting a nonce into
 * a LIVE page is the one way a running tab reads `/api/sessions` twice. The
 * handoff is intercepted and answered with the token the page ALREADY holds —
 * read out of `sessionStorage`, where `rememberToken` puts it — so the
 * redemption succeeds without spending a real nonce and without leaving the
 * page authenticated as something else. `/api/sessions` is intercepted for the
 * same turn and answered with a different default, which is the change.
 *
 * ── RED BEFORE GREEN ──────────────────────────────────────────────────────
 *
 * Measured 2026-08-29 on both browser projects. With `onSessionChange` back to
 * `push` and `loadSessions` firing unconditionally: FOUR `/api/select`
 * requests — three from the accumulated listeners plus the one `route()`'s own
 * re-render makes. With the unsubscribe and the on-change guard: two, and the
 * count does not move when the screen is visited more times.
 */
test('a session change starts one render per screen, not one per past render', async ({ app }) => {
  const { page } = app;

  await expect(page.locator('#spilledRows .row').first()).toBeVisible({ timeout: 30_000 });

  // The session the shell landed on, and a DIFFERENT one to move it to. The
  // second is a real id off `/api/sessions` wherever the corpus has one, so
  // the re-render below asks a question the server can actually answer.
  const sessions = await page.evaluate(async () => {
    const ctx = (window as unknown as {
      myctx: { api: (r: string) => Promise<unknown> };
    }).myctx;
    return await ctx.api('/api/sessions') as {
      sessions: { sessionId: string }[]; default: string | null;
    };
  });
  const landed = await page.evaluate(
    () => (window as unknown as { myctx: { session: () => string } }).myctx.session(),
  );
  const moved = sessions.sessions.map((s) => s.sessionId).find((id) => id !== landed);
  expect(
    moved,
    'this corpus serves fewer than two sessions, so there is no session CHANGE to make and '
    + 'this test would measure nothing',
  ).toBeDefined();

  // Three renders of the preview, which is three listeners under the old
  // contract and one under the new one. Away and back, through the router.
  for (let visit = 0; visit < 2; visit += 1) {
    await page.evaluate(() => { location.hash = '#/coverage'; });
    await expect(page.locator('section[data-p="coverage"]')).toBeVisible({ timeout: 30_000 });
    await page.evaluate(() => { location.hash = '#/preview'; });
    await expect(page.locator('#spilledRows .row').first()).toBeVisible({ timeout: 30_000 });
  }

  // The page's own token, so the intercepted handoff hands back exactly what
  // the tab is already using and every later request still authenticates.
  const token = await page.evaluate(() => sessionStorage.getItem('myctx-token'));
  expect(token, 'the tab holds no token, so a redemption could not be simulated').not.toBeNull();

  await page.route('**/api/handoff', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ token }),
  }));
  await page.route('**/api/sessions', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ ...sessions, default: moved }),
  }));

  const selects: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/select?')) selects.push(request.url());
  });

  // A nonce pasted into a live page: `hashchange`, redeem, re-read the
  // sessions, re-route. The hex is arbitrary — the handoff is intercepted.
  await page.evaluate(() => { location.hash = '#0123456789abcdef'; });
  await expect(
    page.locator('#sesslbl'),
    'the shell never moved to the other session, so no session CHANGE was delivered and the '
    + 'count below is about nothing',
  ).toHaveText(moved!, { timeout: 15_000 });

  // The redemption's own re-render, landed. Waited for rather than slept
  // through: every request this redemption is going to make has been made by
  // the time the screen it produced is on screen, so the count below is taken
  // over a settled page and means the same thing on a loaded machine.
  const drawn = page.locator('section[data-p="preview"] #spilledRows');
  await expect(drawn, 'the preview never redrew after the session moved')
    .toHaveCount(1, { timeout: 30_000 });
  await expect(drawn.locator('.row').first()).toBeVisible({ timeout: 30_000 });
  // And then until the requests stop arriving, so a slow straggler is counted
  // rather than missed — an undercount here would report the defect as fixed.
  for (let settled = -1; settled !== selects.length;) {
    settled = selects.length;
    await page.waitForTimeout(750);
  }

  // `route()` re-renders the preview after a redemption, and that render makes
  // its own `/api/select` call. So two is the floor and the ceiling: one for
  // the session change delivered to the ONE listener the screen holds, one for
  // the re-route. A third would be a listener left behind by a past render.
  expect(
    selects.length,
    `the preview was rendered three times before the session moved, and it asked /api/select `
    + `${selects.length} times for one change. A session listener that is never removed `
    + 'accumulates one per render, so the count grows with how often the reader has visited '
    + 'the screen — which is the half of this defect that makes the overlap common',
  ).toBeLessThanOrEqual(2);

  // And still one render on screen, which is the two halves meeting: the
  // re-route and the session change were two renders in flight over one
  // container, and only the newer of them drew.
  expect(await cards(page)).toEqual({ spilled: 1, delivered: 1, ribbons: 1 });
});

/**
 * **And the same shape ONE LEVEL UP: two `render()` calls for one section.**
 *
 * `preview.js`'s defect was inside a screen, in a loader the screen re-enters
 * itself. The identical defect sits in the ROUTER, and the sweep this task
 * asked for is what found it. Every screen's `render()` opens with
 * `root.replaceChildren()` — `app.js` says so twice in its own comments — and
 * six of them then await an endpoint and append to `root` afterwards
 * (`config`, `coverage`, `doctor`, `packs`, `port`, `work`). Two overlapping
 * `render()` calls on one section each clear an already-empty section and each
 * append a whole screen.
 *
 * Both doors are real. `hashchange` calls `void route()`, so three hash writes
 * in one turn start three routes; and `setupLiveScreen`'s refresh calls
 * `render()` without awaiting it, deliberately, so a second record arriving
 * during a slow render starts a second one.
 *
 * ── RED BEFORE GREEN ──────────────────────────────────────────────────────
 *
 * Measured 2026-08-29 over `.demo-corpus`, before `renderScreen` existed:
 * three hash writes in one turn left Coverage holding NINE `<h3>` where one
 * render draws three, and two un-awaited `render()` calls left SIX. After:
 * three and three.
 *
 * Coverage is the specimen because it is the plainest of the six — one
 * `/api/coverage` read between the clear and the append, and headings that are
 * countable without knowing anything about what the corpus holds.
 */
test('two routes to one screen in one turn leave ONE render, not two', async ({ app }) => {
  const { page } = app;
  await expect(page.locator('#spilledRows .row').first()).toBeVisible({ timeout: 30_000 });

  /** The headings `[data-p="coverage"]` is holding. One render draws a fixed set. */
  const headings = (): Promise<number> => page.evaluate(
    () => document.querySelectorAll('[data-p="coverage"] h3').length,
  );

  // The baseline, from a single ordinary navigation — read rather than
  // asserted as a literal, so this test does not go red the day a card is
  // added to Coverage for a reason that has nothing to do with it.
  await page.evaluate(() => { location.hash = '#/coverage'; });
  await expect(page.locator('[data-p="coverage"] h3').first())
    .toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(2_000);
  const one = await headings();
  expect(one, 'Coverage drew no heading at all, so there is no baseline to compare against')
    .toBeGreaterThan(0);

  // ── DOOR ONE: three routes in one synchronous turn ──────────────────────
  await page.evaluate(() => {
    location.hash = '#/preview';
    location.hash = '#/coverage';
    location.hash = '#/preview';
    location.hash = '#/coverage';
  });
  await expect(page.locator('[data-p="coverage"] h3').first())
    .toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(3_000);
  expect(
    await headings(),
    `Coverage drew ${one} heading(s) on one render. Two routes to it inside one turn each `
    + 'cleared an already-empty section and each appended a whole screen, so the section held '
    + 'two of everything — the same defect as the preview\'s, one level up in the router',
  ).toBe(one);


  // ── DOOR TWO: THE SAME BURST, WITH THE ENDPOINT MADE SLOW ───────────────
  //
  // The burst above is only a race while the fetch outlives the next route. On
  // localhost `/api/coverage` answers in single-digit milliseconds, so a green
  // there could be a machine that was simply too fast to overlap — which is
  // the shape of a test that measures nothing. Throttled to a second and a
  // half, the second route is guaranteed to start inside the first render's
  // fetch, and the assertion is then about the queue rather than about timing.
  //
  // This is also the live refresh's own shape. `setupLiveScreen`'s `act()`
  // calls the screen's `render()` WITHOUT awaiting it, deliberately, so two
  // records arriving a debounce apart during a slow read are exactly two
  // renders in flight over one section.
  await page.route('**/api/coverage*', async (route) => {
    await new Promise((resolve) => { setTimeout(resolve, 1_500); });
    await route.fallback();
  });
  await page.evaluate(() => { location.hash = '#/preview'; });
  await expect(page.locator('section[data-p="preview"]')).toBeVisible({ timeout: 30_000 });
  await page.evaluate(() => {
    location.hash = '#/coverage';
    location.hash = '#/preview';
    location.hash = '#/coverage';
  });
  await expect(page.locator('[data-p="coverage"] h3').first())
    .toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(6_000);
  expect(
    await headings(),
    'the second route started while the first render was still reading /api/coverage, which is '
    + 'the live refresh\'s own shape — an un-awaited render() over a slow endpoint. Two of them '
    + 'on one section each cleared it empty and each appended a whole screen',
  ).toBe(one);
});
