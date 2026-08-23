/**
 * **A tab that was open when the server restarted still works, in a browser.**
 *
 * `test/ui/session-continuity.test.ts` proves the mechanism over real HTTP with
 * two real servers. This file proves the thing the owner actually met: a page
 * they had open, a server restarted underneath it, and a reload.
 *
 * It is a separate file from `app-refresh.spec.ts` because it cannot use the
 * `app` fixture at all — that fixture owns one server for the life of the test,
 * and the case under test is the SECOND server. Everything here is hand-managed
 * for that reason.
 *
 * Why a browser test when the HTTP one is green: because every earlier fix for
 * this was green somewhere and still broken where the owner was looking. The
 * page has its own copy of the credential rules — an in-memory token, a
 * `sessionStorage` copy, a cookie it cannot read, and a banner — and "the
 * server would accept the cookie" is not the same claim as "the page recovers".
 * Three separate defects lived in exactly that gap.
 */
import { test as base, expect } from '@playwright/test';
import { spawnUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { CORPUS } from './app.ts';

/** Rendered means a rail AND real content, never merely a 200. */
async function expectRendered(page: import('@playwright/test').Page, when: string): Promise<void> {
  await expect(page.locator('.nav').first(), `${when}: no rail`).toBeVisible({ timeout: 15_000 });
  await expect
    .poll(() => page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.body') ?? document.body;
      return (body.innerText ?? '').trim().length;
    }), { message: `${when}: the page never rendered more than a shell`, timeout: 15_000 })
    .toBeGreaterThan(200);
}

base('a page open across a server restart recovers on a plain reload', async ({ page }) => {
  let first: UiHarness | null = null;
  let second: UiHarness | null = null;
  try {
    first = await spawnUiChild(CORPUS, ['--port', '0']);
    const port = first.port;

    // The path a person takes: open the printed link, let the PAGE redeem the
    // nonce in its own boot. Redeeming it here would hand the browser a spent
    // one, which is a different state and one this project has already mistaken
    // for "the server has exited".
    await page.goto(`http://127.0.0.1:${port}/#${first.nonce}`);
    await expectRendered(page, 'first load');

    // The restart. Same port, because that is what a person types again — and
    // the same port is precisely what makes the browser still hold a cookie for
    // this origin. A different port would be a different origin and would prove
    // nothing about the case that hurt.
    await first.stop();
    first = null;
    second = await spawnUiChild(CORPUS, ['--port', String(port)]);

    // No fragment. The nonce died with the first load, and the second server
    // has never issued this browser anything of its own — the cookie is the
    // whole credential, and it was minted by a process that no longer exists.
    await page.goto(`http://127.0.0.1:${port}/`);
    await expectRendered(page, 'after the restart');

    // **And the page must not be claiming otherwise while showing real data.**
    // A banner that outlives its cause is its own defect: it teaches the reader
    // to ignore the next one, which is how the real 401 went unnoticed.
    const banner = page.locator('#exited');
    if (await banner.count() > 0) {
      await expect(banner, 'after the restart: the page rendered but still says it is not connected')
        .toBeHidden();
    }

    // A second reload, because a credential that survives exactly one reload is
    // this bug again with a longer fuse — the same reasoning `app-refresh.spec.ts`
    // gives for reloading repeatedly rather than once.
    await page.reload();
    await expectRendered(page, 'reload after the restart');
  } finally {
    if (second !== null) await second.stop();
    if (first !== null) await first.stop();
  }
});
