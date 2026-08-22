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
