/**
 * `plan:live seq:1` — "the shell owns ONE stream, and screens subscribe to
 * it". `watch.js` proved the OLD shape works (`e2e/watch-feed.spec.ts`, still
 * green after this task); this file is the browser proof for the NEW surface
 * the task actually asked for, which no screen exercises end-to-end on its
 * own: that the connection is opened once and shared rather than once per
 * subscriber, that a screen's subscription is filtered by RECORD KIND and not
 * by which screen it is, and that a dead stream is drawn as dead on whatever
 * screen happens to be showing when it dies — not only on `watch.js`, which is
 * the one screen today with its own account of the same fact.
 *
 * `window.myctx.subscribeStream` is called directly through `page.evaluate`
 * where a screen cannot supply the case: the kind-filtering question needs two
 * subscribers wanting DIFFERENT kinds at the same moment, and no pair of
 * screens is guaranteed to give that. RULE-a-ui-change-is-not-done-until-a
 * -browser-test-drives-it asks for a browser driving the real surface, not a
 * second re-implementation of it in Node. The other two questions drive the
 * shell the way a reader actually would — navigate to Watch, then navigate
 * AWAY from it — because the whole point of a shell-owned fault is that it
 * must survive not being looked at.
 *
 * **`plan:live seq:11`, 2026-08-29.** The first test used to attach its
 * `request` listener inside the test body and then count the requests that
 * arrived after visiting Watch. That is a race, not a measurement: the shell
 * opens its one connection during the INITIAL load, before the body ever runs
 * (measured — see `shelled` below), so the count it read was "did my listener
 * beat the load", and it failed 2 of 6 alone while the behaviour under test was
 * working correctly. The counting now starts before `goto`, and the same fact
 * is asserted a second way — on the identity of the opening frame a late
 * subscriber is replayed — so neither reading depends on when a listener was
 * attached.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdtempSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { recordAudit, auditLogPath } from '../src/core/audit.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

interface Fixture {
  page: Page;
  corpus: string;
  streamRequests: string[];
}

/** A corpus, its projection built, and a server over it — the shell alone. */
async function shelled(page: Page, body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-live-stream-'));
  const corpus = path.join(dir, DIR_NAME);
  /**
   * **Attached BEFORE `goto`, and that is the whole of `plan:live seq:11`.**
   *
   * The shell opens its one connection during the INITIAL load — the landing
   * screen is `preview` (`app.js` · `location.hash.replace(/^#\//, '') || 'preview'`
   * · ~1975), `preview` declares kinds in `SCREEN_INVALIDATION`, and `route()`
   * subscribes on its behalf through `setupLiveScreen`, whose first
   * `subscribeStream()` call is what runs `ensureLiveStream()`. Measured
   * 2026-08-29 on both browser projects: the request for
   * `/api/watch/stream?backlog=N` fires ~40ms after `page.goto()` resolves and
   * ~40ms BEFORE the rail's first button becomes visible. That measurement read
   * `backlog=20`; the bound is now `SHARED_STREAM_BACKLOG` (200), raised
   * 2026-09-04 because 20 records missed a whole backfilled lane. Only the
   * number changed — the timing this docblock is about did not, and no
   * assertion here reads the value.
   *
   * A listener attached inside the test body — i.e. after `goto` AND after the
   * `.nav` wait below — therefore races that request and usually loses. That is
   * exactly what made this file fail 2 of 6 alone and pass 16/16 beside
   * `app-refresh.spec.ts`: another spec running first changes the warm-up
   * timing, the request lands after the attach, and the old assertion passed
   * for a reason that had nothing to do with the property it names.
   *
   * Counting from here makes the count total-for-the-page rather than
   * since-the-last-navigation, which is the only quantity "the shell opens the
   * stream ONCE" was ever a claim about.
   */
  const streamRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/watch/stream')) streamRequests.push(req.url());
  });
  let harness: UiHarness | undefined;
  try {
    expect(runCli(['init'], dir, () => {}), 'fixture command failed: init').toBe(0);
    expect(runCli(['audit'], dir, () => {}), 'fixture command failed: audit').toBe(0);
    harness = await startUiChild(dir);
    const h = harness;
    await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token',
    ).toBeVisible({ timeout: 15_000 });
    await body({ page, corpus, streamRequests });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

test('the shell opens the stream ONCE — a second subscriber reuses the same connection', async ({ page }) => {
  await shelled(page, async ({ page: p, streamRequests }) => {
    // ONE connection for the page, opened by whichever subscriber came first —
    // here the landing screen, during the load `shelled` just did. `streamRequests`
    // has been collecting since before `goto` (see its comment), so this is a
    // count of every stream request the page has EVER made, not of the ones that
    // happened to arrive after a listener won a race.
    await expect.poll(() => streamRequests.length, {
      message: 'the shell never opened the shared stream at all',
      timeout: 15_000,
    }).toBeGreaterThan(0);
    expect(
      streamRequests.length,
      'the shell opened more than one connection before a single screen was even visited',
    ).toBe(1);

    // A subscriber registered against the shell's own door, BEFORE Watch is
    // visited, so it holds the `hello` of whatever connection is running now.
    await p.evaluate(() => {
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      window.__helloEarly = [];
      // @ts-expect-error — same reason.
      window.myctx.subscribeStream(['mutation'], (event, data) => {
        // @ts-expect-error — same reason.
        if (event === 'hello') window.__helloEarly.push(data);
      });
    });
    await expect.poll(
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      () => p.evaluate(() => window.__helloEarly.length),
      { message: 'the shared stream never delivered its opening frame', timeout: 15_000 },
    ).toBeGreaterThan(0);
    expect(
      streamRequests.length,
      "a subscriber registered at the shell's own door opened a SECOND connection — "
      + '`ensureLiveStream` is not the once-ever gate it claims to be',
    ).toBe(1);

    // A SECOND subscriber, the ordinary way a reader makes one: visit the screen
    // that wants the feed. `watch.js` subscribes on mount — and must reuse the
    // connection the landing screen already opened rather than open its own.
    await p.evaluate(() => { location.hash = '#/watch'; });
    await expect(p.locator('[data-p="watch"]')).toBeVisible({ timeout: 15_000 });

    // A THIRD subscriber, registered directly against the door, because the
    // count must not move for a subscriber that is not a screen either.
    await p.evaluate(() => {
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      window.__helloLate = [];
      // @ts-expect-error — same reason.
      window.__unsub3 = window.myctx.subscribeStream(['mutation'], (event, data) => {
        // @ts-expect-error — same reason.
        if (event === 'hello') window.__helloLate.push(data);
      });
    });

    // Give the page a moment it does not need: a second connection would show up
    // as a second `request` event almost immediately, and this asserts NONE
    // arrived rather than merely that none has yet.
    await p.waitForTimeout(500);
    expect(
      streamRequests.length,
      'a second subscriber opened a SECOND connection — the shared stream is not shared',
    ).toBe(1);

    // And the same fact stated as IDENTITY rather than as a count, which is
    // what survives if the shell ever learns to reconnect: the late subscriber
    // was replayed the very object the early one was handed. `hello` fires
    // exactly once per connection (spec §2: no reconnect, ever), so a second
    // connection would have overwritten `liveHello` with a frame of its own and
    // these two would be different objects.
    const sameHello = await p.evaluate(() =>
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      window.__helloLate.length === 1 && window.__helloLate[0] === window.__helloEarly[0]);
    expect(
      sameHello,
      'a late subscriber was handed a DIFFERENT opening frame — it joined a second '
      + 'connection rather than the one that was already running',
    ).toBe(true);
  });
});

test('subscription is by RECORD KIND — a screen that asks for one kind never hears another', async ({ page }) => {
  await shelled(page, async ({ page: p, corpus }) => {
    await p.evaluate(() => { location.hash = '#/watch'; });
    await expect(page.locator('[data-p="watch"]')).toBeVisible({ timeout: 15_000 });

    // Two subscribers, two DIFFERENT kinds, collected separately — proving the
    // fan-out filters by the record's own `kind` rather than delivering every
    // record to every listener and leaving the filtering to the screen.
    await p.evaluate(() => {
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      window.__mutations = [];
      // @ts-expect-error — same.
      window.__injections = [];
      // @ts-expect-error — same.
      window.myctx.subscribeStream(['mutation'], (event: string, data: unknown) => {
        // @ts-expect-error — same.
        if (event === 'record') window.__mutations.push(data);
      });
      // @ts-expect-error — same.
      window.myctx.subscribeStream(['injection'], (event: string, data: unknown) => {
        // @ts-expect-error — same.
        if (event === 'record') window.__injections.push(data);
      });
    });

    recordAudit(corpus, {
      kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-kind-fanout', fields: ['body'],
    });

    await expect.poll(
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      () => p.evaluate(() => window.__mutations.length),
      { message: 'the mutation subscriber never heard the mutation record it asked for', timeout: 15_000 },
    ).toBeGreaterThan(0);

    // The injection-only subscriber must have heard NOTHING — the record that
    // arrived was a `mutation`, and it asked for neither that kind nor `'*'`.
    // @ts-expect-error — window.myctx is the plain-JS screen contract.
    const injectionsSeen = await p.evaluate(() => window.__injections.length);
    expect(
      injectionsSeen,
      'a subscriber that asked for `injection` records was handed a `mutation` one — the fan-out is not filtering by kind',
    ).toBe(0);
  });
});

test('a dead stream is drawn as dead on whatever screen is showing — not only on Watch', async ({ page }) => {
  await shelled(page, async ({ page: p, corpus }) => {
    // Open the shared connection the ordinary way: visit Watch, which
    // subscribes and, as a side effect, opens the shell's one stream.
    await p.evaluate(() => { location.hash = '#/watch'; });
    await expect(page.locator('[data-p="watch"]')).toBeVisible({ timeout: 15_000 });

    // Quiet before it dies: the chrome-level indicator must not cry wolf on a
    // stream that is merely idle — STD-a-measured-zero-is-drawn-and-named-an
    // -unmeasured-thing-is cuts both ways.
    await expect(page.locator('#livestate')).toBeHidden();

    // Navigate AWAY from Watch. The connection stays open (that is the whole
    // point of "opened once, shared"); nothing about this screen has ever
    // rendered a stream fault, so if the reader learns the stream died at
    // all, it can only be the shell that told them.
    await p.evaluate(() => { location.hash = '#/status'; });
    await expect(page.locator('[data-p="status"]')).toBeVisible();
    await expect(page.locator('#livestate')).toBeHidden();

    // A damaged line in the JSONL, appended AFTER the connection opened so it
    // is caught by the running poll rather than the opening backlog scan —
    // the same technique `test/ui/watch-model.test.ts` uses to force a
    // refusal, aimed here at the STREAM's own mid-run fault path
    // (`ui/watch-model.ts`'s `streamHandler` — `tail.poll()` throws, the
    // server sends `event: fault` and ends the response; nothing reconnects).
    appendFileSync(auditLogPath(corpus), '{"this":"is not an audit record"}\n');

    await expect(
      page.locator('#livestate'),
      'the stream faulted and NOTHING on the status screen said so — a dead stream '
      + 'that only Watch can report is invisible on every one of the other twenty screens',
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('#livestate')).toContainText(/refused to continue/i);

    // And it survives navigating again — a fact the reader was already told
    // must not be un-said by visiting a third screen.
    await p.evaluate(() => { location.hash = '#/preview'; });
    await expect(page.locator('#livestate')).toBeVisible();
  });
});
