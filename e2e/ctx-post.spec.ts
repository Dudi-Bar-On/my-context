/**
 * **The shell can POST, and a screen can reach the three routes that were
 * registered, tested and unreachable from the page.**
 *
 * `POST /api/config/check`, `POST /api/config/preview` and `POST /api/overlap`
 * have been live and covered by the node suite since they landed, and no screen
 * could call one: `api()` took a path and nothing else, and the token is closed
 * over inside `app.js`, so a hand-rolled `fetch` from a screen would carry no
 * credential and be refused by the gate — which would be the gate working. The
 * Configure screen ships a DISABLED scope-policy segbar for exactly this
 * reason, and the Composer cannot call the overlap scorer at all.
 *
 * ── WHY THIS DRIVES `window.myctx`, AND NOT `fetch` ───────────────────────
 *
 * `e2e/app-refresh.spec.ts` records the lesson in its own words: a test written
 * with a bare `fetch` passed against an `app.js` with the fix deliberately
 * removed, "because a raw fetch never touches the module-level `token` and so
 * proves only that the server accepts a cookie, which was never in doubt." The
 * claim here is the same shape and about the same subject — the CLIENT — so
 * every call below goes through the shell's own method, from inside the page,
 * exactly as a screen would make it.
 *
 * ── WHY THE COOKIE IS CLEARED FIRST, WHICH IS WHAT GIVES THIS TEETH ───────
 *
 * A page that has authenticated holds TWO credentials: the `mycontext_token`
 * cookie the handoff set, and the `sessionStorage` copy `app.js` reads on boot.
 * With the cookie present the browser attaches it to every request, so a POST
 * that forgot the `X-Mycontext-Token` header would still be answered 200 and
 * this file would be green against a shell that sends no credential at all.
 *
 * Clearing the cookie and reloading leaves the stored token as the ONLY
 * credential, and the only way it can reach the server is the header `app.js`
 * attaches. Verified by mutation, 2026-08-23: with the token header dropped
 * from `request()`, the first test below fails with `401` instead of passing —
 * and with the cookie left in place it stayed GREEN under the same mutation,
 * which is the false pass this paragraph exists to stop someone reintroducing.
 *
 * ── WHAT EACH TEST DISCRIMINATES ──────────────────────────────────────────
 *
 * The METHOD: `/api/config/check` is registered for POST only, and `matchRoute`
 * answers a bare 404 for any other verb. A shell that sent GET could not
 * produce the answer below, so `ok: true` IS the proof the request was a POST.
 *
 * The BODY: the candidate carries `budgets.pinned: 4242` and the default is
 * 6000, so `resolved.budgets.pinned === 4242` can only come from a body that
 * arrived, was parsed as JSON, and was answered by `resolveConfig` itself.
 *
 * The REFUSAL: the gate's refusals carry the STATUS AND NOTHING ELSE (ruling
 * A4) — `sendRefusal` writes a status line and calls `res.end()` with no body
 * and no content-type. `response.json()` on that throws, so the last test
 * asserts the thrown message is a bare status rather than a parse error, which
 * is the branch a copy-pasted second implementation loses first.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** The shell's surface, as a screen sees it on `window.myctx`. */
interface Shell {
  api(path: string): Promise<unknown>;
  post(path: string, body?: unknown): Promise<unknown>;
}

/** What a call through the shell did: the parsed answer, or the thrown message. */
type Outcome =
  | { readonly ok: true; readonly data: unknown }
  | { readonly ok: false; readonly message: string };

/**
 * Wait for the shell to have published `ctx.post`, then call it from inside the
 * page. Polled rather than sampled once: `window.myctx` is assigned partway
 * through `main()`, and a rail button can be on screen before the assignment
 * lands under parallel workers. A racy browser test is a lie, and `retries` is
 * 0 here by deliberate policy.
 */
async function postThroughShell(page: Page, path: string, body?: unknown): Promise<Outcome> {
  await expect
    .poll(() => page.evaluate(() => {
      const shell = (window as unknown as { myctx?: Partial<Shell> }).myctx;
      return typeof shell?.post === 'function';
    }), { message: 'the shell never published ctx.post', timeout: 15_000 })
    .toBe(true);
  return await page.evaluate(async (args: { path: string; body: unknown; hasBody: boolean }) => {
    const shell = (window as unknown as { myctx: Shell }).myctx;
    try {
      // Called with ONE argument when there is no body, so the shell meets the
      // real omitted-body case rather than an explicit `undefined`.
      const data = args.hasBody
        ? await shell.post(args.path, args.body)
        : await shell.post(args.path);
      return { ok: true as const, data };
    } catch (err) {
      return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
    }
  }, { path, body, hasBody: body !== undefined });
}

/** Drop the cookie, keep the stored token, and come back on the bare URL. */
async function onlyTheStoredToken(page: Page, port: number): Promise<void> {
  await expect(page.locator('.nav').first(), 'first load: no rail').toBeVisible({ timeout: 15_000 });
  await page.context().clearCookies();
  await page.goto(`http://127.0.0.1:${port}/`);
  await expect(page.locator('.nav').first(), 'after clearing the cookie: no rail')
    .toBeVisible({ timeout: 15_000 });
}

test('ctx.post reaches a POST-only route, carrying a JSON body and the page\'s own token',
  async ({ app }) => {
    const { page } = app;
    await onlyTheStoredToken(page, app.port);

    const outcome = await postThroughShell(page, '/api/config/check',
      { candidate: { budgets: { pinned: 4242 } } });

    expect(outcome.ok
      ? 'ok'
      : `ctx.post threw "${outcome.message}" — with the cookie cleared, the stored token can `
        + 'only reach the server in the header app.js attaches, so a refusal here means the '
        + 'shell sent no credential (401), or sent the wrong verb (404: this route is POST only)',
    ).toBe('ok');

    const data = (outcome as { data: Record<string, unknown> }).data;
    expect(data['ok'], 'the endpoint answered, but not with its success shape').toBe(true);
    const resolved = data['resolved'] as { budgets?: Record<string, unknown> } | undefined;
    expect(resolved?.budgets?.['pinned'],
      'the candidate never reached resolveConfig: 6000 is the DEFAULT, so this answer was '
      + 'computed without the body the shell was supposed to send')
      .toBe(4242);
    expect(Array.isArray(data['dropped']), 'no `dropped` list, so this is not this endpoint')
      .toBe(true);
  });

/**
 * **A config the resolver refuses is a 200 with `ok: false`, and the shell must
 * hand that back rather than throw.** The endpoint's own rule: the question was
 * answered, and "no, and here is why" is its success case. A shell that treated
 * every unhappy answer as a failure would leave the Configure screen unable to
 * show the refusal wording it exists to show.
 */
test('a candidate the resolver refuses comes back as an answer, not as an exception',
  async ({ app }) => {
    const { page } = app;
    await onlyTheStoredToken(page, app.port);

    const outcome = await postThroughShell(page, '/api/config/check', { candidate: 'nope' });

    expect(outcome.ok ? 'ok' : `ctx.post threw "${(outcome as { message: string }).message}"`)
      .toBe('ok');
    const data = (outcome as { data: Record<string, unknown> }).data;
    expect(data['ok'], 'a refused candidate must answer ok:false, not ok:true').toBe(false);
    // resolveConfig's own message, verbatim — the property that makes the
    // editor's wording identical to the CLI's by construction. A different
    // candidate produced a different sentence, which no stub could have faked.
    expect(String(data['error']), 'the refusal did not carry resolveConfig\'s own wording')
      .toContain('not an object');
  });

/**
 * **An empty POST is answered by the route's own 400, and the shell reads that
 * body.** `server.ts` parses the request body with `JSON.parse(await
 * readBody(req))` and leaves it `undefined` when that throws, so a POST with no
 * body reaches the handler as `undefined` and earns the 400 that names the
 * field it wanted. This is the "there IS a body, so read it" half of the
 * refusal handling — and it also pins that omitting the argument sends no body
 * rather than the string `"undefined"`.
 */
test('a POST with no body is refused with the message that names the field', async ({ app }) => {
  const { page } = app;
  await onlyTheStoredToken(page, app.port);

  const outcome = await postThroughShell(page, '/api/config/check');

  expect(outcome.ok, 'an empty POST must be refused, not answered').toBe(false);
  expect((outcome as { message: string }).message,
    'the 400 carries a JSON `error` and the shell did not read it — a thrown bare status here '
    + 'means the body was skipped, and the caller is told a number instead of the reason')
    .toContain('takes a JSON body');
});

/**
 * **The gate's refusal carries no body at all, and that must not become a JSON
 * parse error.** This is the branch a copy-pasted second implementation loses
 * first, and losing it turns a clean 403 into `Unexpected end of JSON input` —
 * a mystery thrown outside the network `catch`, from a request that was refused
 * for a completely ordinary reason.
 */
test('a refusal with no body at all throws the bare status, never a parse error',
  async ({ app }) => {
    const { page } = app;
    await expect(page.locator('.nav').first(), 'first load: no rail')
      .toBeVisible({ timeout: 15_000 });

    // Exactly what a person meets after the server restarts on the same port:
    // a stored token this server never issued, and no cookie either.
    await page.context().clearCookies();
    await page.evaluate(() => {
      sessionStorage.setItem('myctx-token', 'deadbeefdeadbeefdeadbeefdeadbeef');
    });
    await page.goto(`http://127.0.0.1:${app.port}/`);

    const outcome = await postThroughShell(page, '/api/config/check', { candidate: {} });

    expect(outcome.ok, 'a POST with a dead token and no cookie must be refused').toBe(false);
    const message = (outcome as { message: string }).message;
    // 403 if the dead token was still in memory when this call went out, 401 if
    // the boot's own refusal had already dropped it and the request went bare.
    // Both are the gate answering with a status and nothing else; which one it
    // is is not this test's claim.
    expect(message,
      'the shell did not survive an EMPTY refusal body: `response.json()` on one throws, and it '
      + 'throws outside the network catch, so a clean refusal is reported as a parse failure')
      .toMatch(/^(401|403)$/);
  });
