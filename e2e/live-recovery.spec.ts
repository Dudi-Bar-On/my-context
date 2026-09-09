// @basis TASK-the-stream-s-fault-has-a-fix-but-not-yet-a-demonstrated,
// TASK-the-open-document-follows-the-session-as-it-is-written-and
/**
 * **THE FEED COMES BACK WITHOUT AN F5, WHICH IS THE HALF `app-restart.spec.ts`
 * DOES NOT COVER.**
 *
 * That file proves a tab open across a restart still works AFTER A PLAIN
 * RELOAD. This one proves the case the owner actually reported on 2026-09-09:
 *
 *   "once in a while, the viewer stops to get updates, i'm getting a messeage
 *    in the bottom in orange color and the only thing that resolves it is
 *    refreshing the page"
 *
 * ── WHY IT HAPPENS, AND IT IS OUR OWN WINDOW ────────────────────────────────
 *
 * `restartStaleServer` replaces the server after a commit and
 * `closeAllConnections()` drops the feed — about EIGHT SECONDS with nothing
 * listening. Two gates then compounded inside it, either alone enough to strand
 * the page until a reload:
 *
 *   1. `stopLiveLook()` was called on BOTH failure paths — `api()`'s catch and
 *      `stream()`'s fetch catch — stopping the look tick, which is the only
 *      thing that puts the feed back.
 *   2. `reopenLiveStream()` refuses while `liveEstablished` is false, so a
 *      reopen that threw before any `hello` was treated as a REFUSAL and never
 *      retried.
 *
 * The second gate is right for a REFUSAL — the server answering no, which costs
 * a `ui-refused` audit write per glance — and wrong for a server never REACHED,
 * which served no request and can hold no audit line. `liveUnreachable` is that
 * distinction.
 *
 * ── WHAT THIS TEST WATCHES, AND WHY IT IS NOT THE CHIP ──────────────────────
 *
 * The obvious probe is `#livestate`, the orange `watch.streamNotLive` chip. It
 * was tried first and IT IS VACUOUS: dropping the server does not always land a
 * `fault` FRAME on the page — the stream simply ends — so the chip can stay
 * hidden throughout and an assertion that it is hidden passes over the bug. It
 * did: this test passed against the unfixed `app.js` on its first run, which is
 * the only reason the probe was changed.
 *
 * So it watches the RESPONSES instead. A recovered feed is a NEW `200` on
 * `/api/watch/stream` after the restart, and that is a fact no rendering
 * accident can fake. Under the old code the count after the restart is zero,
 * because the look tick that would have asked was cancelled by the failed
 * attempt made while the port was closed.
 *
 * `visibilitychange` and `focus` are the pair `attachLook` listens for
 * (`lib/heartbeat.js`), and they are the reader's own act — which is the whole
 * of why §2 is not violated by leaving the look tick running. Nothing here
 * reconnects behind anybody's back.
 *
 * Rests on `plan:live seq:22`'s look tick, which is also where the defect is
 * recorded, and on `plan:archive seq:19`'s live document.
 */
import { test as base, expect } from '@playwright/test';
import { spawnUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { startOnSafePort } from '../test/ui/unsafe-ports.ts';
import { CORPUS } from './app.ts';

/** The reader looks at the tab. Both events, because that is the pair one return fires. */
async function look(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new Event('focus'));
  });
}

base('a dropped feed comes back when the reader looks, with no reload', async ({ page }) => {
  let first: UiHarness | null = null;
  let second: UiHarness | null = null;

  // Every ACCEPTED stream, in order. A refusal or a dead connect is not one.
  const opened: number[] = [];
  page.on('response', (res) => {
    if (res.url().includes('/api/watch/stream') && res.status() === 200) opened.push(Date.now());
  });
  // AND EVERY DOCUMENT LOAD, because "with no reload" is the other half of the
  // claim and it should be measured rather than assumed. A reload fires `load`
  // again; a recovery that reloads is not this recovery.
  let loads = 0;
  page.on('load', () => { loads += 1; });

  try {
    // Screened for Chrome's restricted list like every other server this suite
    // opens; the restart reuses this exact port, so screening the first is
    // enough for both. A different port would be a different origin and would
    // prove nothing about the case that hurt.
    first = await startOnSafePort(() => spawnUiChild(CORPUS, ['--port', '0']));
    const port = first.port;
    const opening = `http://127.0.0.1:${port}/#${first.nonce}`;

    await page.goto(opening);
    await expect(page.locator('#screen')).toBeVisible();

    // **THE FEED MUST BE PROVEN UP BEFORE IT IS DROPPED**, or the rest of this
    // test is a claim about a page that never connected — the vacuous shape
    // this project keeps catching itself in, and the shape the first version of
    // this very test had.
    await expect.poll(() => opened.length, {
      message: 'no stream was accepted on the first load — there was no feed to lose',
    }).toBeGreaterThan(0);
    const before = opened.length;
    // What the address bar settled to once the nonce was redeemed and stripped.
    const settled = page.url();

    await first.stop();
    first = null;

    // **LOOKS WHILE THE SERVER IS STILL DOWN, AND THIS IS THE STEP THAT USED TO
    // BE FATAL.** The reopen's `fetch` throws against a closed port, and the old
    // code answered by calling `stopLiveLook()`, cancelling the mechanism the
    // rest of this test depends on.
    //
    // IT HAS TO KEEP LOOKING UNTIL THE PAGE HAS NOTICED, and that is not
    // pedantry — it is the second vacuous version of this test. A single look
    // fired immediately after `stop()` lands while `liveClosed` is still false,
    // so `reopenLiveStream()` returns at its "still running" guard, no `fetch`
    // is attempted, and the fatal path never runs. The test then passed against
    // the unfixed `app.js` a second time. A drop takes a moment to reach the
    // page; the reader's glance has to arrive after it, which is exactly the
    // real sequence — he looks back at the tab some seconds later.
    const deadline = Date.now() + 5_000;
    let attempted = false;
    while (Date.now() < deadline && !attempted) {
      await look(page);
      // `#exited` is raised by the same catch that used to cancel the look tick,
      // so its appearance IS the proof that a reopen was attempted and failed
      // against the closed port — the state the old code could not leave.
      attempted = await page.locator('#exited').isVisible();
      if (!attempted) await page.waitForTimeout(200);
    }
    expect(attempted, 'the page never noticed the server was gone, so the fatal path never ran '
      + 'and this test would prove nothing').toBe(true);

    second = await spawnUiChild(CORPUS, ['--port', String(port)]);

    // The reader looks again. No reload, no navigation, no timer.
    await expect.poll(
      async () => {
        await look(page);
        return opened.length;
      },
      {
        message: 'no stream was accepted after the restart: the page is stranded until F5, '
          + 'which is the defect the owner reported',
        timeout: 20_000,
      },
    ).toBeGreaterThan(before);

    // AND THE READER WAS NEVER MOVED — measured two ways, because this is the
    // half that distinguishes the fix from the workaround it replaces.
    //
    // The URL is compared against what it SETTLED to after boot, not against
    // the address that was typed: the page redeems the nonce and strips the
    // fragment, so `opening` is not what a reader is looking at a moment later.
    // Asserting the typed address here failed on exactly that, which is worth
    // leaving on the record — the redemption is correct and the assertion was
    // not.
    expect(page.url()).toBe(settled);
    expect(loads, 'the page reloaded, which is the workaround rather than the fix').toBe(1);
  } finally {
    if (second !== null) await second.stop();
    if (first !== null) await first.stop();
  }
});
