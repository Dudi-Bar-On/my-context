/**
 * **The bare URL says it has no credential — not "no data".**
 *
 * `KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it`, owner-
 * measured 2026-08-28: `http://127.0.0.1:<port>/` — the address a person
 * bookmarks, types from memory, or picks out of history — rendered the full
 * rail, every section heading and every explanatory sentence with every data
 * region empty, and none of `nonce`, `mycontext ui`, `token`, `restart`,
 * `terminal`, `expired` anywhere on the page. A locked-out page and an empty
 * corpus were indistinguishable, which is the failure this file pins closed.
 *
 * `sess.nocred` (`app.js`'s `route()`, gated by the module-level `noCredential`
 * — set alongside `sessionValue`, cleared only where `loadSessions()` gets a
 * real answer) is the fix: one sentence, appended into the content area the
 * reader already has open, naming the actual cause and the actual command.
 *
 * **ANTI-VACUITY IS WHAT THIS FILE IS FOR, not a side assertion.** The first
 * test is the authenticated case and it must show NOTHING — a statement that
 * is on screen whether or not it is true is furniture, not information, and
 * proves nothing about the state it claims to report. The second test is the
 * reproduction from the corpus item, unmodified: a bare visit, no fragment,
 * no cookie, no stored token.
 */
import { test as base, expect } from '@playwright/test';
import { spawnUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { startOnSafePort } from '../test/ui/unsafe-ports.ts';
import { test, CORPUS } from './app.ts';

/** The command the notice must name, exactly — `mycontext ui --nonce`. */
const COMMAND = 'mycontext ui --nonce';

test('an authenticated page never shows the no-credential notice', async ({ app }) => {
  const { page } = app;
  // `app` redeems a real nonce during boot (app.ts's own fixture), so this is
  // the ordinary, working case — corpus present, credential present. The
  // notice is gated on `noCredential`, which `loadSessions()` clears the
  // moment a real answer comes back, so it must never reach the page here.
  await expect(page.locator('.nav').first(), 'no rail — the fixture itself did not authenticate')
    .toBeVisible({ timeout: 15_000 });
  await expect(
    page.locator('p.small.spill', { hasText: COMMAND }),
    'an authenticated page must not claim it has no credential — that sentence ' +
    'is reserved for the state `loadSessions()` never reached',
  ).toHaveCount(0);
  await expect(page.getByText(COMMAND, { exact: false })).toHaveCount(0);
});

/** Rendered means a rail, never merely a 200 — the same bar every other spec in this suite uses. */
async function expectRendered(page: import('@playwright/test').Page, when: string): Promise<void> {
  await expect(page.locator('.nav').first(), `${when}: no rail`).toBeVisible({ timeout: 15_000 });
}

base('the bare URL, with no fragment and no prior credential, names its own cause', async ({ page }) => {
  let harness: UiHarness | undefined;
  try {
    // `spawnUiChild` rather than `startUiChild` because this test must NOT
    // redeem the nonce — but the port still has to be one a browser will open,
    // so the safe-port screen `startUiChild` carries is applied here by hand
    // (`TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with`,
    // plan:walk seq:82). Without it this spec dies on `net::ERR_UNSAFE_PORT`
    // with nothing said about the notice it exists to measure.
    harness = await startOnSafePort(() => spawnUiChild(CORPUS, ['--port', '0']));
    const port = harness.port;

    // The reproduction from the corpus item, unmodified: the address alone,
    // never the printed link. This browser has redeemed no nonce and holds no
    // cookie for this origin — the exact state a bookmark or a retyped address
    // produces.
    await page.goto(`http://127.0.0.1:${port}/`);
    await expectRendered(page, 'bare URL');

    // Fact 1: it says NO CREDENTIAL, not no data. `errorNote`/`.spill`
    // elsewhere in this shell prints a refusal in the server's own words; this
    // is the shell's own sentence, appended once by route() after whichever
    // screen (here `preview`, the landing route) drew its own empty content.
    //
    // Located by `p.small.spill` filtered on the command text, not by
    // `getByText('This page has no credential')`: that phrase is ALSO the
    // full text of the nested `<b>` run, and Playwright's text engine returns
    // the innermost matching element — the `<b>`, not the `<p>` around it —
    // so `.textContent()` on it would silently see only the bold lead-in and
    // never reach the fragment/command sentences that follow it.
    const notice = page.locator('p.small.spill', { hasText: COMMAND });
    await expect(notice, 'the bare URL rendered but never said it has no credential — the exact ' +
      'defect KNOWN-the-bare-server-url-renders-the-whole-app-and-never-says-it names')
      .toBeVisible({ timeout: 15_000 });

    const fullText = (await notice.textContent()) ?? '';
    expect(fullText, 'the notice must say it has no CREDENTIAL, not that it has no data')
      .toContain('This page has no credential');
    // Fact 2 and 3 together: the fragment-is-the-credential explanation and
    // the actual command, in the SAME element — a reader who sees the
    // sentence sees the whole answer, not half of it elsewhere on the page.
    expect(fullText, 'the notice must explain why a bookmark or a reload cannot recover the ' +
      'credential — the fragment, not the bare address, is what carries it')
      .toMatch(/fragment/i);
    expect(fullText, 'the notice must name the exact command a reader can run, not "restart the ' +
      'server" or a vague pointer').toContain(COMMAND);

    // And the command is drawn in a monospace, bidi-isolated run — `{m:...}`
    // in the string table — not flattened text, the same discipline
    // `e2e/bidi.spec.ts` holds the mockup to.
    const commandRun = notice.locator('.m', { hasText: COMMAND });
    await expect(commandRun, 'the command must be its own isolated .m run, not plain prose')
      .toHaveCount(1);

    // Hebrew too — requirement is BOTH string tables, not just the one this
    // suite happens to load first. The toggle reloads by design (app.js's
    // langButton.onclick), so this waits for the rail again rather than for
    // `load`, which fires on an interstitial document — and a fresh boot with
    // still no credential is exactly what re-proves this rather than assuming
    // it survives a reload untested.
    await page.click('#lang');
    await expectRendered(page, 'after the language toggle');
    const hebrewNotice = page.locator('p.small.spill', { hasText: COMMAND });
    // The Hebrew sentence carries the same literal command — `{m:...}` keeps
    // an identifier untranslated in both languages, and strings-parity.test.ts
    // is what pins the two tables to matching {m:} slots key for key.
    await expect(hebrewNotice, 'the Hebrew page must show the same notice, naming the same command')
      .toBeVisible({ timeout: 15_000 });
    const hebrewCommandRun = hebrewNotice.locator('.m', { hasText: COMMAND });
    await expect(hebrewCommandRun, 'and the command stays an isolated .m run in Hebrew too')
      .toHaveCount(1);
  } finally {
    if (harness !== undefined) await harness.stop();
  }
});
