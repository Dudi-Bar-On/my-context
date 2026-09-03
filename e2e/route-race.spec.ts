/**
 * **THE ROUTE RACE: an Execute must refresh the screen the reader is looking
 * at, and not one that merely finished rendering later.**
 *
 * ── THE DEFECT, MEASURED BEFORE THIS FILE EXISTED ──────────────────────────
 *
 * `route()` in `src/ui/public/app.js` opens with `teardownLiveScreen()` and
 * ends with `setupLiveScreen(name, mod, section)`, which writes
 * `currentScreenRefresh` — the closure `noteExecuteSettled` calls to redraw the
 * screen a command was run on. Between those two points it AWAITS twice (the
 * dynamic import, then the render), and it is entered from `hashchange` as
 * `void route()`. Nothing stood between them, so when a hash change started a
 * second route while the first was still rendering, whichever route finished
 * LAST took the slot — not the one whose screen is on screen.
 *
 * That is not a coin toss, which is why it was reproducible: `doctor` is one
 * `/api/doctor` and the landing `preview` is five sequential fetches, so
 * preview finishes second every time. Measured 2026-09-03: after
 * `POST /api/execute` taken on the VISIBLE Doctor screen the page fetched
 * `select`, `simulate`, `items`, `coverage`, `injection-history` — preview's
 * endpoint set — and not one `/api/doctor`, while the ruling the reader had
 * just made sat correct on disk, in the index and in the read model.
 * `e2e/doctor-outcome.spec.ts` had to reach Doctor by RELOADING rather than by
 * changing the hash, and its own comment says so and names this file's job.
 *
 * The cost in the product is plain: any reader who clicks a rail button while
 * the landing screen is still loading gets a screen whose Execute refreshes
 * something else, so the thing they just did appears not to have happened.
 *
 * ── WHY IT DRIVES `window.myctx.executeSettled` RATHER THAN A REAL RUN ─────
 *
 * Because the property under test is the ROUTER's, not the command runner's.
 * `executeSettled` is the shell's own documented door — `app.js` exposes
 * `noteExecuteSettled` on it, and `lib/command-actions.js` calls exactly this
 * once `POST /api/execute` has settled — so pressing it here drives the same
 * closure a real run drives, one line further along. `e2e/execute.spec.ts` and
 * `e2e/doctor-outcome.spec.ts` already own "a real run really writes"; each of
 * them needs a disposable copy of the corpus and minutes of wall clock to say
 * it. This file needs neither, because it does not write: it asks WHICH SCREEN
 * the shell redraws, and the answer is a network log.
 *
 * `e2e/ctx-post.spec.ts` establishes the technique (drive `window.myctx` as a
 * screen does, over the real page).
 *
 * ── HOW THE RACE IS MADE TO HAPPEN RATHER THAN HOPED FOR ──────────────────
 *
 * Two hash writes, the second fired from a timer so it lands INSIDE the first
 * route's render rather than beside it, and then three preconditions asserted
 * as states — because a test for a race that quietly failed to open the race
 * window is a green line that measures nothing:
 *
 *   1. `/api/doctor` was requested at all (the second route really ran);
 *   2. a preview-only read FINISHED AFTER it (the first route was still in
 *      flight when the second started, and finished last — the exact condition
 *      that used to hand it the slot);
 *   3. Doctor is the visible section and preview is hidden.
 *
 * Only then is the refresh driven, and only then does the assertion mean what
 * it says.
 */
import { test, expect } from './app.ts';
import type { Route } from '@playwright/test';
import { pendingApi, settleScreen } from './settle.ts';

/**
 * Reads that ONLY the injection-preview screen makes.
 *
 * Deliberately excludes `/api/coverage`, which preview does fetch and which the
 * RAIL also fetches on every `paintRailCounts()` — and `noteExecuteSettled`
 * calls `paintRailCounts()` itself, so a coverage read after the refresh proves
 * nothing about which screen was redrawn. `/api/status`, `/api/meta`,
 * `/api/ping`, `/api/sessions`, `/api/watch/*` and `/api/item/*` are the
 * shell's own and are excluded for the same reason.
 */
const PREVIEW_ONLY = ['/api/select', '/api/simulate', '/api/items', '/api/injection-history'];

/** The one read the Doctor screen makes, and nothing else in the app makes it. */
const DOCTOR_READ = '/api/doctor';

const isPreviewRead = (url: string): boolean => PREVIEW_ONLY.some((e) => url.includes(e));

test('an Execute refreshes the screen the reader is on, not a route it outlasted', async ({ app }) => {
  const { page } = app;

  // The `/api` reads this page has open, from the one helper that owns that
  // question — reused here so the wait below is on the property (nothing is in
  // flight) rather than on a clock.
  const pending = pendingApi(page);

  // ── A BASELINE, so the race below is exactly two routes and not three. The
  // fixture opens on the landing screen; let it finish before racing it.
  const landed = await settleScreen(page, 'preview');
  expect(
    landed.settled,
    `the landing screen never finished drawing (${landed.attempts} samples, ${landed.count} nodes, `
    + `${landed.inFlight} reads still open), so this test never reached the state it races from`,
  ).toBe(true);

  // ── THE NETWORK LOG. Ordered by the BROWSER, not by this process: the
  // preconditions below compare when reads finished relative to one another,
  // and a flag flipped in Node after an `evaluate` resolves would be a
  // statement about CDP latency.
  const started: string[] = [];
  const finished: string[] = [];
  const counts = (url: string): boolean =>
    url.includes('/api/') && !url.includes('/api/watch/stream');
  page.on('request', (r) => { if (counts(r.url())) started.push(r.url()); });
  page.on('requestfinished', (r) => { if (counts(r.url())) finished.push(r.url()); });

  // ── THE LOSING ROUTE IS MADE TO FINISH LAST, rather than left to a clock.
  //
  // The defect is "whichever route finishes LAST takes `currentScreenRefresh`",
  // so a test that does not FIX which one that is measures the machine. Run
  // without this, the two projects disagreed on the same commit: `chromium`
  // finished preview second (the racing state) and `chrome` finished it first
  // (not the racing state) — and a suite where the defect only appears in one
  // browser on one day is the thing this project already refuses to call flake.
  //
  // `/api/simulate` is one of the three reads preview AWAITS inside `render()`
  // (`preview.js`: `Promise.all([select, simulate, ensureItems()])`), so
  // delaying it delays the losing route's completion and nothing else.
  // `/api/injection-history` would have been the wrong choice and was rejected:
  // preview fires it `void`, deliberately, so the route does not wait on it and
  // slowing it changes no ordering at all.
  //
  // A slow endpoint is not a contrivance — it is what the parallel suite
  // produces on a loaded machine, which is where this defect was first seen.
  // Installed after the baseline so the baseline is not slowed, and taken back
  // before the act so the measurement below is not.
  const slowSimulate = async (r: Route): Promise<void> => {
    await new Promise((resolve) => { setTimeout(resolve, 1_500); });
    await r.continue();
  };
  await page.route('**/api/simulate*', slowSimulate);

  // ── THE RACE. `location.hash` twice, the second from a `setTimeout` so it is
  // a SEPARATE task: the first hashchange has by then run `route()`'s whole
  // synchronous head and is inside its render, which is the state the defect
  // needs. Writing both in one task would instead race the module cache — a
  // cached dynamic import resolves on a microtask, ahead of the second
  // hashchange task, and the window would close before it opened.
  //
  // 50ms rather than 0: long enough that preview is provably into its fetches,
  // far short of the seconds those five sequential reads take over this corpus.
  await page.evaluate(() => new Promise<void>((resolve) => {
    location.hash = '#/preview';
    setTimeout(() => { location.hash = '#/doctor'; resolve(); }, 50);
  }));

  // Doctor is what the reader is now looking at; wait for it as such. This also
  // waits for `pending` to empty, which is preview's losing render too, so both
  // routes have finished by the time the preconditions are read.
  const shown = await settleScreen(page, 'doctor');
  expect(
    shown.settled,
    `the Doctor screen never finished drawing after the hash change (${shown.attempts} samples, `
    + `${shown.count} nodes, ${shown.inFlight} reads still open)`,
  ).toBe(true);

  // ── PRECONDITION 1: the second route really ran.
  expect(
    finished.filter((u) => u.includes(DOCTOR_READ)).length,
    `no ${DOCTOR_READ} was requested at all, so the second route never rendered and there was `
    + `no race to lose. Reads seen: ${finished.join(', ')}`,
  ).toBeGreaterThan(0);

  // ── PRECONDITION 2: the FIRST route was still in flight when the second
  // started, and it finished LAST. That ordering is the whole defect: the last
  // route to finish used to take `currentScreenRefresh`.
  const doctorAt = finished.findIndex((u) => u.includes(DOCTOR_READ));
  const lastPreviewAt = finished.reduce((at, u, i) => (isPreviewRead(u) ? i : at), -1);
  expect(
    lastPreviewAt,
    'no preview-only read finished after `#/doctor` was requested, so the landing screen had '
    + 'already finished rendering and the race window never opened — this test would then pass '
    + `over a page that was never in the racing state. Reads, in finishing order: ${finished.join(', ')}`,
  ).toBeGreaterThan(doctorAt);

  // ── PRECONDITION 3: and Doctor is the screen a reader can see.
  const visible = await page.evaluate(() => {
    const sections = [...document.querySelectorAll('#screen [data-p]')];
    return sections.filter((s) => !(s as HTMLElement).hidden).map((s) => (s as HTMLElement).dataset['p'] ?? '');
  });
  expect(
    visible,
    'the visible section is what the reader is looking at, and the whole assertion below is about '
    + 'the shell agreeing with it',
  ).toEqual(['doctor']);

  // The lever has done its work; the measurement below should read the app at
  // its own speed.
  await page.unroute('**/api/simulate*', slowSimulate);

  // ── THE ACT: the shell is told a run this page started has settled — the
  // same door `lib/command-actions.js` opens after `POST /api/execute`.
  const before = started.length;
  await page.evaluate(() => {
    const shell = (window as unknown as { myctx: { executeSettled: (node: null) => void } }).myctx;
    shell.executeSettled(null);
  });

  // Bounded, and it fails as ITSELF rather than falling through to the
  // comparison: an empty log is "nothing was refreshed", which is a different
  // report from "the wrong screen was refreshed".
  let quiet = 0;
  for (let sample = 0; sample < 40; sample += 1) {
    await page.waitForTimeout(250);
    if (pending.size === 0 && started.length > before) { quiet += 1; if (quiet >= 2) break; }
    else quiet = 0;
  }
  const refreshed = started.slice(before);
  expect(
    refreshed.length,
    'the settled run refreshed nothing at all — the shell held no screen refresh to call',
  ).toBeGreaterThan(0);

  // ── THE ASSERTION THIS FILE EXISTS FOR.
  expect(
    refreshed.filter((u) => u.includes(DOCTOR_READ)).length,
    `the run was taken on the VISIBLE Doctor screen and the shell did not refetch ${DOCTOR_READ}. `
    + `It fetched: ${refreshed.join(', ')}. That is app.js's route race: the losing route finished `
    + 'last and its `setupLiveScreen` overwrote `currentScreenRefresh` with a redraw of a screen '
    + 'nobody is looking at.',
  ).toBeGreaterThan(0);
  expect(
    refreshed.filter(isPreviewRead),
    'the run was taken on Doctor and the shell redrew the injection preview — the screen whose '
    + 'route the reader superseded, which merely finished rendering later. Reads after the run: '
    + `${refreshed.join(', ')}`,
  ).toEqual([]);
});
