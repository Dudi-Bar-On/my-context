// @basis TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated, TASK-one-dead-stream-is-announced-on-every-screen-for-ever-and-a, TASK-a-refresh-keeps-the-reader-s-place-or-it-asks
/**
 * **OUR OWN SERVER KILLS THE FEED, AND THE READER LOOKING AT THE TAB PUTS IT
 * BACK — WITHOUT MOVING HIM.** `plan:live seq:22`.
 *
 * ── THE CAUSE, MEASURED, SO NOBODY RE-DERIVES IT FROM THIS FILE ───────────
 *
 * The owner reported *"the live feed is not running — reload to reconnect"*
 * repeatedly. On 2026-09-09 the one measurement that settles a half-closed
 * pair was taken on his live 58888:
 *
 *     127.0.0.1:1148  -> 127.0.0.1:58888   CLOSE_WAIT   chrome.exe pid 18968
 *     127.0.0.1:58888 -> 127.0.0.1:1148    FIN_WAIT_2   node.exe   pid 184220
 *
 * `FIN_WAIT_2` is held by the side that SENT the FIN. The server closed it,
 * and the closer is `restartStaleServer` (`src/core/ui-server-upkeep.ts`)
 * replacing a listening server whose code has gone stale — which during active
 * development is after every commit; six restarts in one night, a down/up
 * cycle every 14-15 minutes. `server.closeAllConnections()` is the FIN. So
 * this file stages the real thing: a server killed under a live page and a new
 * one on the same port, which is exactly what that hook does.
 *
 * ── WHY IT IS NOT `app-restart.spec.ts` ───────────────────────────────────
 *
 * That file proves a page RELOADED across a restart still works — the
 * credential half, and it is green. This one proves the page that is NOT
 * reloaded recovers, which is the case the owner is actually in: he is reading
 * when the hook fires, and a reload would cost him everything
 * `plan:archive seq:19`, `22`, `23` and `plan:live seq:15` exist to protect.
 * The marker assertion below is that difference, stated as a measurement.
 *
 * ── THE OVERRIDE, AND THE WEAKNESS IT ADMITS ──────────────────────────────
 *
 * `visibilityState` is overridden on `Document.prototype`. A genuinely hidden
 * tab is NOT reachable in Playwright: `e2e/conversations.spec.ts` measured
 * four ways on 2026-09-08 — `context.newPage()` + `bringToFront()`,
 * `window.open('_blank')`, CDP `Emulation.setPageVisibilityOverride` (removed
 * from the protocol) and CDP `Page.setWebLifecycleState 'frozen'` — and every
 * page stayed `visible`, because Playwright gives each page its own top-level
 * window rather than a tab. So the override is confined to that one property;
 * the events are real, the listeners are `heartbeat.js`'s real ones, the
 * `shouldPing` gate really reads the property, and the requests are real. The
 * hidden half is kept honest the way `plan:archive seq:22` kept it honest:
 * by asserting ZERO stream requests across a real interval while hidden.
 *
 * ── THE CORPUS ────────────────────────────────────────────────────────────
 *
 * A temporary one, following `e2e/live-stream.spec.ts` — the file whose
 * subject this is — and for its reason: this test APPENDS to the audit log to
 * prove the reopened feed is carrying records, and the current corpus is the
 * owner's own.
 */
import { test, expect } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { spawnUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { startOnSafePort } from '../test/ui/unsafe-ports.ts';
import { runCli } from '../src/cli/index.ts';
import { recordAudit } from '../src/core/audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

interface LookWindow { __look: (state: string | null) => void }
interface MarkWindow { __mark: string | undefined }

test('the feed comes back when the reader looks at the tab, and the page does not move', async ({ page }) => {
  test.setTimeout(120_000);

  // Before `goto`, so the app sees the overridden getter from its first line.
  await page.addInitScript(() => {
    let forced: string | null = null;
    Object.defineProperty(Document.prototype, 'visibilityState', {
      configurable: true,
      get(): string { return forced ?? 'visible'; },
    });
    Object.defineProperty(window, '__look', {
      value: (state: string | null) => {
        forced = state;
        // BOTH events, because `startLookTicks` registers both and the guard
        // that stops them firing twice is part of what is being measured.
        document.dispatchEvent(new Event('visibilitychange'));
        window.dispatchEvent(new Event('focus'));
      },
    });
  });

  /** Every `/api/watch/stream` the page opens, by wall clock. */
  const opened: number[] = [];
  const answered: number[] = [];
  page.on('request', (r) => { if (r.url().includes('/api/watch/stream')) opened.push(Date.now()); });
  page.on('response', (r) => { if (r.url().includes('/api/watch/stream')) answered.push(Date.now()); });

  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-live-reopen-'));
  const corpus = path.join(dir, DIR_NAME);
  let first: UiHarness | null = null;
  let second: UiHarness | null = null;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    expect(runCli(['audit'], dir, () => {}), 'fixture command failed: audit').toBe(0);

    // **Through `startOnSafePort`, because the RESTART has to reuse this exact
    // port** — the same reasoning `app-restart.spec.ts` records: a port from
    // Chrome's restricted list dies on the navigation with
    // `net::ERR_UNSAFE_PORT` and no assertion behind it. Screening the first
    // port screens both; the second server is handed the same number.
    first = await startOnSafePort(() => spawnUiChild(dir, ['--port', '0']));
    const port = first.port;

    await page.goto(`http://127.0.0.1:${port}/#${first.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => { location.hash = '#/watch'; });
    await expect(page.locator('[data-p="watch"]')).toBeVisible({ timeout: 15_000 });

    await expect.poll(() => opened.length, {
      message: 'the shell never opened the shared stream at all', timeout: 15_000,
    }).toBe(1);
    await expect(page.locator('#livestate'), 'a live feed must say nothing').toBeHidden();

    // **THE READER'S PLACE, made into something a test can check.** A reload
    // would take this with it, and the whole of the owner's instruction —
    // *"refresh the page on the same event"* — is the version that does.
    await page.evaluate(() => { (window as unknown as MarkWindow).__mark = 'still-here'; });

    // The tab goes to the background. A reader who has left is the state the
    // §2 assertion below is about.
    await page.evaluate(() => (window as unknown as LookWindow).__look('hidden'));
    expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');

    // ── THE RESTART, SHAPED LIKE `restartStaleServer` ────────────────────
    await first.stop();
    first = null;
    second = await spawnUiChild(dir, ['--port', String(port)]);

    // The page notices, and it notices while hidden: the socket dies whether
    // anyone is looking or not, and `plan:live seq:21`'s sticky chip is what
    // says so. This is also the proof the drop actually happened, so the
    // recovery below is a recovery and not a stream that never died.
    await expect(
      page.locator('#livestate'),
      'the server was replaced under the page and the strip said nothing',
    ).toBeVisible({ timeout: 20_000 });

    // **§2, ASSERTED RATHER THAN CLAIMED.** A hidden tab is looked at — both
    // events, at a document reporting `hidden` — and opens NOTHING. A reopen
    // that ignored `shouldPing` would hold the server up for a tab nobody is
    // reading, which is the daemon by another name §2 forbids.
    const hiddenFrom = Date.now();
    await page.evaluate(() => (window as unknown as LookWindow).__look('hidden'));
    await page.waitForTimeout(3_000);
    expect(
      opened.filter((t) => t > hiddenFrom).length,
      'a hidden tab reopened the stream — the §2 visibility gate is not in front of the look tick',
    ).toBe(0);

    // ── THE READER COMES BACK ────────────────────────────────────────────
    const t0 = Date.now();
    await page.evaluate(() => (window as unknown as LookWindow).__look(null));
    await expect
      .poll(() => opened.filter((t) => t >= t0).length,
        { intervals: [10, 10, 25, 25, 50], timeout: 30_000 })
      .toBeGreaterThan(0);
    const asked = (opened.find((t) => t >= t0) as number) - t0;
    await expect
      .poll(() => answered.filter((t) => t >= t0).length,
        { intervals: [10, 10, 25, 25, 50], timeout: 30_000 })
      .toBeGreaterThan(0);
    const live = (answered.find((t) => t >= t0) as number) - t0;
    console.log(`[live/22] look -> stream reopened: asked ${asked} ms, answered ${live} ms`);
    // One round trip on loopback. The bound is loose because it is a bound and
    // not the measurement; the numbers above are the measurement.
    expect(asked, 'a look must reopen the stream at once, not on the next anything').toBeLessThan(3_000);

    // EXACTLY ONE. `visibilitychange` and `focus` both fired microseconds
    // apart, and `plan:live seq:1` allows one connection.
    await page.waitForTimeout(500);
    expect(
      opened.filter((t) => t >= t0).length,
      'one return to the tab opened more than one connection — the shared stream is not shared',
    ).toBe(1);

    // ── AND THE PAGE IS WHERE HE LEFT IT ─────────────────────────────────
    //
    // If this ever fails, the reopen has become a reload and the four items
    // that guarantee a reader is never moved have been quietly reversed.
    expect(
      await page.evaluate(() => (window as unknown as MarkWindow).__mark),
      'the page was RELOADED rather than the stream reopened — the reader lost his place, '
      + 'his folds, his filter and his scroll position',
    ).toBe('still-here');
    expect(await page.evaluate(() => location.hash)).toBe('#/watch');

    // ── THE CHIP COMES DOWN, BECAUSE THE FEED IS RUNNING ─────────────────
    await expect(
      page.locator('#livestate'),
      'the feed is live again and the strip still says it is not',
    ).toBeHidden({ timeout: 15_000 });

    // ── AND IT IS CARRYING RECORDS, WHICH IS THE ONLY PROOF THAT MATTERS ──
    //
    // A 200 on a stream request says the server answered. A record arriving
    // says the feed is a feed.
    await page.evaluate(() => {
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      window.__after = [];
      // @ts-expect-error — same reason.
      window.myctx.subscribeStream(['mutation'], (event: string, data: unknown) => {
        // @ts-expect-error — same reason.
        if (event === 'record') window.__after.push(data);
      });
    });
    recordAudit(corpus, {
      kind: 'mutation', op: 'create', origin: 'human',
      itemId: 'RULE-the-feed-came-back', fields: ['body'],
    });
    await expect.poll(
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      () => page.evaluate(() => window.__after.length),
      {
        message: 'the reopened stream never delivered a record written after it reopened — '
          + 'the connection is up and the feed is not',
        timeout: 20_000,
      },
    ).toBeGreaterThan(0);
  } finally {
    if (second !== null) await second.stop();
    if (first !== null) await first.stop();
    removeTree(dir);
  }
});
