/**
 * The APP, opened against THIS REPOSITORY'S OWN CORPUS.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `mockup.ts` opens `docs/design/web-ui-mockup.html` over `file://` and says so
 * in its own first line: "WHAT IS UNDER TEST IS THE MOCKUP, not an
 * implementation." That was true and correct when `src/ui/public/` held a
 * placeholder shell. It stopped being true when the shell landed, and nobody
 * moved the suite — so on 2026-08-22 this project had 33 green browser tests,
 * 3,824 green node tests, and a page whose delivered rows rendered as a
 * diagonal fan. Every gate was green. Not one of them had opened the product.
 *
 * A suite pointed at the specification asserts that the specification is itself.
 * This one is pointed at what ships.
 *
 * ── WHY THE REAL CORPUS, AND NOT A FIXTURE ─────────────────────────────────
 *
 * Because the defect was invisible at fixture scale. The mockup carries five
 * short sample bodies; `.lit` declares `overflow-y:auto` and never scrolls
 * against them, so nothing bounds its height and nothing needs to. This
 * repository's corpus is 265 items — 213 of them tasks with real bodies — and
 * at that size the same rules grow the scene to 5,165px, which drags
 * `perspective-origin: 50% 42%` to a vanishing point 2,169px below the top of
 * the window and turns a deliberate 3.2° tilt into a fan.
 *
 * No fixture anyone would have thought to write would have caught that. The
 * corpus caught it because it is real. That is the owner's dogfooding
 * requirement working exactly as intended, and it is why this fixture reads the
 * live corpus rather than building one.
 *
 * **This is safe, and the safety is proved elsewhere rather than assumed.** The
 * UI server is a read-only surface; `test/ui/server-e2e.test.ts` snapshots every
 * byte under the workspace and compares it after a full route sweep, so "the
 * read surface changes not one byte of the corpus" is an assertion, not a
 * comment. `MYCONTEXT_E2E_CORPUS` overrides the path anyway, for the same reason
 * `MYCONTEXT_MOCKUP` exists: to point a run at a deliberately broken copy and
 * watch it go red.
 *
 * ── THE NONCE IS ONE-SHOT, SO THE TEST MUST NOT SPEND IT ───────────────────
 *
 * The server prints `http://127.0.0.1:<port>/#<nonce>` and the handoff accepts
 * that nonce exactly once. `test/ui/helpers.ts` exports `redeemNonce` because
 * the node suite exchanges it over HTTP itself — but here the APP does the
 * exchange, in `app.js`'s boot, which is the path a person actually takes. So
 * this fixture navigates to the fragment and redeems NOTHING. Calling
 * `redeemNonce` first would hand the browser a spent nonce and produce a page
 * with no token, which is a state this project has already mistaken for "the
 * server has exited".
 */
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * The corpus the app is served over. The outer repository root, not
 * `my-context/` — the plugin's own directory carries a second, near-empty
 * corpus, and a server started there answers with it instead. That has already
 * cost this project one wrong answer, and there is a rule item about it.
 */
export const CORPUS = process.env['MYCONTEXT_E2E_CORPUS'] !== undefined
  ? path.resolve(process.env['MYCONTEXT_E2E_CORPUS'])
  : path.resolve(REPO, '..');

export interface App {
  readonly page: Page;
  readonly port: number;
  /** Everything the server process has written, for a failure that needs it. */
  serverOutput: () => string;
}

/**
 * `app` starts a server over the corpus, opens the page at its nonce fragment,
 * and waits for the boot to have produced a token — never merely for `load`,
 * which fires while the page is still an empty shell.
 */
export const test = base.extend<{ app: App }>({
  app: async ({ page }, use) => {
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(CORPUS);
      const h = harness;
      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      // The handoff is a POST the page makes after load. Waiting on a rail
      // button rather than a timeout keeps this honest on a slow machine and
      // fails with a real message on a page that never authenticated.
      await expect(
        page.locator('.nav').first(),
        'the app never rendered a rail button — it probably has no token; ' +
        'check that the nonce was not spent before the browser saw it',
      ).toBeVisible({ timeout: 15_000 });
      await use({ page, port: h.port, serverOutput: () => h.output() });
    } finally {
      if (harness !== undefined) await harness.stop();
    }
  },
});

export { expect };
