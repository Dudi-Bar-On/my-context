/**
 * **Reload must always work. Every time, by any route, forever.**
 *
 * Owner ruling, 2026-08-22: "the refresh issue should not exist anymore, don't
 * matter what refresh will show the page correct, if there is a security issue
 * it should be solved in a way that will not destruct the page view."
 *
 * The failure being closed out: the server prints
 * `http://127.0.0.1:<port>/#<nonce>` and the handoff redeems that nonce EXACTLY
 * ONCE. A reload re-sends the same fragment — fragments survive reloads — but
 * the nonce is spent, so the second load authenticated with nothing. The page
 * then showed "The server has exited", which was false; the server was fine and
 * the page simply had no token. A person cannot tell those apart, and one of
 * them is not a real problem.
 *
 * A screenshot spends the nonce too, which is how this cost the owner a look.
 *
 * These tests reload REPEATEDLY rather than once. Once proves a fallback fired;
 * the requirement is that it keeps firing, and a token that survives exactly one
 * reload is a bug with a longer fuse.
 */
import { test, expect } from './app.ts';

/** Rendered means a rail AND real content, never merely a 200. */
async function expectRendered(page: import('@playwright/test').Page, when: string): Promise<void> {
  await expect(page.locator('.nav').first(), `${when}: no rail`).toBeVisible({ timeout: 10_000 });
  // POLLED, not sampled once. The rail is static markup and appears before
  // the first /api response lands, so reading innerText the instant .nav is
  // visible measures whether the fetch happened to have returned yet. Under
  // seven parallel workers it sometimes had not, and the test failed for a
  // reason that had nothing to do with what it asserts. retries are 0 here by
  // deliberate policy, so a racy test is not a nuisance — it is a lie.
  await expect
    .poll(() => page.evaluate(() => {
      const body = document.querySelector<HTMLElement>('.body') ?? document.body;
      return (body.innerText ?? '').trim().length;
    }), {
      message: `${when}: the page never rendered more than a shell`,
      timeout: 10_000,
    })
    .toBeGreaterThan(200);
  const banner = page.locator('#exited');
  if (await banner.count() > 0) {
    await expect(banner, `${when}: showed the server-exited banner while the server was running`)
      .toBeHidden();
  }
}

test('the page survives repeated reloads with the nonce already spent', async ({ app }) => {
  const { page } = app;
  await expectRendered(page, 'first load');
  for (let i = 1; i <= 3; i++) {
    await page.reload();
    await expectRendered(page, `reload ${i}`);
  }
});

test('the page survives a reload to the bare URL, with no fragment at all', async ({ app }) => {
  const { page } = app;
  await expectRendered(page, 'first load');
  // What a person gets when they retype the address, or when the browser drops
  // the fragment. There is no nonce to fall back on here at all.
  await page.goto(`http://127.0.0.1:${app.port}/`);
  await expectRendered(page, 'bare URL');
});

/**
 * **A page with NO credential at all still draws its rail and runs its
 * router.** The fifth distinct cause of "the screen is blank", measured with
 * the owner looking at it on 2026-08-23.
 *
 * Every other test in this file authenticates first and then reloads, so the
 * cookie carries them. None of them could reach the state a person actually
 * meets after the server restarts: a tab holding a stale token, or none.
 * `main()` awaited `loadSessions()` bare, that call rejected with a 401, and
 * the rejection escaped `main()` — so `renderNav()`, `route()`, the heartbeat
 * and the `hashchange` listener all never ran. The header and footer strip had
 * already been drawn, so the result was not an empty document; it was a chrome
 * around an empty rail, which reads like a broken router and is not one.
 *
 * Two consequences made it worse than a missing session name, and both are
 * covered by the single assertion below. Without the heartbeat the page issues
 * no `/api` request ever again, and `IdleMonitor` reaps the server fifteen
 * minutes later — the lockout starves the timer that then kills the server.
 * And the `hashchange` listener, whose whole purpose is to redeem a nonce
 * pasted into a locked-out page, was registered AFTER the failing line: the
 * remedy was installed after the call that fails when the remedy is needed.
 *
 * **BOTH credentials have to go, and finding that out is why this test has
 * teeth.** Written first with `clearCookies()` alone, it passed against a
 * deliberately reverted `app.js` — because the token also lives in
 * `sessionStorage` (`rememberToken`), so the page still had one, `/api/sessions`
 * still answered 200, and the failing line never failed. A regression test that
 * cannot reproduce the regression is worse than none: it reports the defect
 * fixed forever. Clearing both reaches the state a person actually meets, and
 * the mutation then fails it.
 */
test('with no credential at all, the rail still renders and the router still runs', async ({ app }) => {
  const { page } = app;
  await expectRendered(page, 'first load');

  // The cookie is the server's; sessionStorage is the tab's. A person meets
  // this state when the server restarts — the cookie it issued is gone and the
  // stored token is stale — and neither half alone reproduces it.
  await page.context().clearCookies();
  await page.evaluate(() => { sessionStorage.clear(); });
  await page.goto(`http://127.0.0.1:${app.port}/`);

  // The rail is the assertion. It is built by `renderNav()`, which runs after
  // the call that used to throw, and it needs no credential of its own — the
  // screen list is a constant. An empty rail here means the boot aborted.
  await expect(page.locator('.nav').first(),
    'no credential: the rail did not render, so main() aborted before renderNav()')
    .toBeVisible({ timeout: 15_000 });
  const railCount = await page.locator('.nav').count();
  expect(railCount, 'no credential: the rail must list every screen, as it does when authenticated')
    .toBeGreaterThan(15);

  // And the router ran: a screen section exists, even though every call inside
  // it refused. A screen that draws its own refusal is the correct degraded
  // state; a body with no section at all is the defect.
  await expect(page.locator('[data-p]').first(),
    'no credential: the router never created a screen section')
    .toBeAttached({ timeout: 15_000 });
});

test('a second tab on the same origin is not locked out', async ({ app }) => {
  const { page } = app;
  await expectRendered(page, 'first load');
  const second = await page.context().newPage();
  try {
    await second.goto(`http://127.0.0.1:${app.port}/`);
    await expectRendered(second, 'second tab');
  } finally {
    await second.close();
  }
});
