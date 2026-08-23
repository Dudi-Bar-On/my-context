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
import { existsSync } from 'node:fs';
import path from 'node:path';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * The corpus the app is served over: **`.demo-corpus`, the simulated one**,
 * since 2026-08-23.
 *
 * ── WHY THIS MOVED OFF THE LIVE CORPUS ────────────────────────────────────
 *
 * It used to be the outer repository root — the project's own live corpus, on
 * the reasoning that testing over real data is stronger than testing over a
 * fixture. It is, for everything except a gate whose whole output is a LIST OF
 * WHAT IS MISSING. `screen-parity.spec.ts` compares each screen to its mockup
 * section and holds the gaps in a shrink-only ledger; over a live corpus that
 * ledger records what the corpus happened to contain on the day it was
 * written, and every later run measures a different day.
 *
 * Measured, both ways, on 2026-08-23 with seventeen screens built:
 *
 *   over the LIVE corpus   `ask` reports 17 absent kinds and `work` 17 more —
 *                          every one of them present in the code and unreachable
 *                          because that corpus has no pending revision and its
 *                          audit projection holds nothing the Ask tab can query.
 *                          `preview` reports 11, because there is no undelivered
 *                          session to preview.
 *   over `.demo-corpus`    `ask` reports one, `work` none, `preview` three.
 *
 * Not one of those differences is a line of code. This is
 * `TASK-the-parity-gate-needs-a-fixture-corpus-holding-one-record-of` (plan:port
 * seq:9) answered, and it follows the owner's standing ruling that the UI is
 * developed against the simulated corpus until the screens are finished
 * (`DEC-the-ui-is-developed-against-a-simulated-corpus-until-the`). `plan:port
 * seq:99`, the last UI task, moves it back — and the point of moving it back is
 * precisely to find what a fixture hid.
 *
 * **Dogfooding is not abandoned by this.** The demo corpus is written BY the
 * real code — the hooks write its injections, `mycontext focus` writes its focus
 * record, `stageRevision` stages its one revision — and only the clock is
 * synthetic. It is also deterministic: `scripts/demo-corpus.ts` contains no
 * randomness, so two builds produce the same corpus and the ledger measures the
 * code rather than the day.
 *
 * **It refuses rather than falling back.** `.demo-corpus` is gitignored, so a
 * fresh checkout does not have it. Silently serving the live corpus instead
 * would produce exactly the failure above — thirty-odd phantom gaps and no hint
 * why — so a missing corpus is an error naming the one command that builds it.
 * `MYCONTEXT_E2E_CORPUS` still overrides everything, for the same reason
 * `MYCONTEXT_MOCKUP` exists: to point a run at a deliberately broken copy and
 * watch it go red.
 */
export const CORPUS = ((): string => {
  const override = process.env['MYCONTEXT_E2E_CORPUS'];
  if (override !== undefined) return path.resolve(override);
  const demo = path.join(REPO, '.demo-corpus');
  if (!existsSync(path.join(demo, '.my_context'))) {
    throw new Error(
      `e2e: the simulated corpus is missing at ${demo}. It is gitignored and deterministic — ` +
      'build it with `node scripts/demo-corpus.ts` from my-context/, then run this suite ' +
      'again. Refused rather than falling back to the live corpus, because a parity gate ' +
      'measured against a different corpus reports code gaps that are only data gaps. Set ' +
      'MYCONTEXT_E2E_CORPUS to point somewhere else deliberately.',
    );
  }
  return demo;
})();

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
