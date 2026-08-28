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
 * for the first two questions: no second screen exists yet to subscribe from,
 * and RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it asks for a
 * browser driving the real surface, not a second re-implementation of it in
 * Node. The third question drives the shell the way a reader actually would —
 * navigate to Watch, then navigate AWAY from it — because the whole point of
 * a shell-owned fault is that it must survive not being looked at.
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
}

/** A corpus, its projection built, and a server over it — the shell alone. */
async function shelled(page: Page, body: (fixture: Fixture) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-live-stream-'));
  const corpus = path.join(dir, DIR_NAME);
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
    await body({ page, corpus });
  } finally {
    if (harness !== undefined) await harness.stop();
    removeTree(dir);
  }
}

test('the shell opens the stream ONCE — a second subscriber reuses the same connection', async ({ page }) => {
  await shelled(page, async ({ page: p }) => {
    const streamRequests: string[] = [];
    p.on('request', (req) => {
      if (req.url().includes('/api/watch/stream')) streamRequests.push(req.url());
    });

    // The FIRST subscriber, exactly the way `watch.js` becomes one: visiting
    // the screen that wants the feed. This is what opens the connection.
    await p.evaluate(() => { location.hash = '#/watch'; });
    await expect.poll(() => streamRequests.length, {
      message: 'visiting Watch never opened the shared stream at all',
      timeout: 15_000,
    }).toBeGreaterThan(0);
    const openedAfterFirst = streamRequests.length;
    expect(openedAfterFirst, 'more than one request opened for the FIRST subscriber alone').toBe(1);

    // A SECOND subscriber, registered directly against the shell's own door —
    // no second screen exists yet to prove this from, which is exactly why
    // this task built the door rather than a second copy of `ctx.stream()`.
    await p.evaluate(() => {
      // @ts-expect-error — window.myctx is the plain-JS screen contract.
      const unsub = window.myctx.subscribeStream(['mutation'], () => {});
      // @ts-expect-error — same reason.
      window.__unsub2 = unsub;
    });

    // Give the page a moment it does not need: if a second connection were
    // opened it would show up as a second `request` event almost immediately,
    // and this asserts NONE arrived rather than merely that none has yet.
    await p.waitForTimeout(500);
    expect(
      streamRequests.length,
      'a second subscriber opened a SECOND connection — the shared stream is not shared',
    ).toBe(openedAfterFirst);
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
