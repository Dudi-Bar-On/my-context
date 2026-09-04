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
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';

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
  /**
   * Everything the server process has written SINCE THIS TEST BEGAN, for a
   * failure that needs it — never the whole worker-lifetime buffer. See the
   * `app` fixture's own docblock for why that distinction is load-bearing now.
   */
  serverOutput: () => string;
}

/**
 * `app` starts a server over the corpus, opens the page at its nonce fragment,
 * and waits for the boot to have produced a token — never merely for `load`,
 * which fires while the page is still an empty shell.
 *
 * **The audit projection is synced ONCE for the whole suite, and not here.**
 *
 * This fixture used to run `mycontext audit --limit 1` before starting each
 * server, because reading `.demo-corpus` appends `access` records and a
 * projection behind its log makes the read surface refuse — eighteen of
 * twenty-one screens rendered that refusal where their content belongs on
 * 2026-08-24, and a tree-parity inventory was taken against exactly that.
 * That reasoning holds. The FREQUENCY was the defect.
 *
 * `mycontext audit` is a write. Run per fixture, with four workers, it wrote
 * `.audit/audit.db` while sibling servers were reading it through a
 * deliberately timeout-less read-only door, and the loser rendered `database
 * is locked` / `disk I/O error` into whichever card was mid-fetch. Measured on
 * `item-pane.spec.ts` at the default worker count: 2 of 12 runs failed with
 * the write here, 0 of 12 with it moved out. It is the source of most of the
 * "known e2e contention" list, which had already hidden one real failure.
 *
 * `e2e/global-setup.ts` now does it once, before any worker starts, and
 * carries the full argument and the measurement. **This fixture only READS**,
 * and it must stay that way: the projection is kept current during the run by
 * `recordAudit`, which projects every record on the path that appends it, so
 * one sync at the top is enough and a second one per test buys nothing but
 * contention.
 *
 * ── THE SERVER IS NOW STARTED ONCE PER WORKER, NOT ONCE PER TEST ───────────
 *
 * `TASK-the-e2e-app-fixture-spawns-a-fresh-ui-server-for-every-test`
 * (`plan:walk seq:133`). The paragraph above is the reason this is safe: a
 * read-only server has no per-test state a shared instance could leak between
 * tests, so spawning a fresh one for every test bought nothing but the cost
 * of spawning it — a Node process, an opened SQLite handle, and up to 15s of
 * auth wait, times 41 of 61 spec files. `server` below is the WORKER-scoped
 * half (Playwright's second `extend` type parameter, since a worker-scoped
 * fixture cannot depend on the test-scoped `page`); `app` stays test-scoped
 * and does only what a single test needs: get its own `page` onto the shared
 * server's page, authenticated.
 *
 * **The nonce is one-shot, and the server is not.** `startUiChild`'s printed
 * nonce is spent by whichever test navigates with it first; every test after
 * that would be carrying a spent nonce to a fresh, token-less `page` — the
 * exact "locked-out tab" `POST /api/nonce` exists to recover, except here
 * every test but the first would hit it. So `app` does not reuse the
 * server's startup nonce at all: it mints its own, every test, through
 * `mintNonce` (`test/ui/helpers.ts`) — the same route `mycontext ui --nonce`
 * uses for the identical reason. One request, ~milliseconds, well inside the
 * fixture's own auth-wait budget.
 *
 * **`serverOutput` used to return the whole buffer, and that stopped being
 * safe the moment the server outlived one test.** With one server per
 * worker, `h.output()` accumulates across every test that worker runs, so an
 * unscoped read could hand a failing test another test's log lines — a worse
 * flake than the runtime this change removes. `app` snapshots the buffer's
 * length at the START of each test and `serverOutput` returns only what was
 * appended after that point, before the test touched the server at all.
 * (Checked: nothing in `e2e/` currently calls `app.serverOutput()` — the
 * `App` interface exposes it for a future failure investigation, not a
 * present caller — so this is a correctness fix for the contract, not a
 * behaviour change any spec today observes.)
 */
export const test = base.extend<{ app: App }, { server: UiHarness }>({
  server: [async ({}, use) => {
    const harness = await startUiChild(CORPUS);
    try {
      await use(harness);
    } finally {
      await harness.stop();
    }
  }, { scope: 'worker' }],

  app: async ({ page, server }, use) => {
    // Snapshotted before this test does anything to the shared server, so the
    // delta below is exactly what THIS test's own traffic produced.
    const outputAtStart = server.output().length;
    const nonce = await mintNonce(server.port);
    await page.goto(`http://127.0.0.1:${server.port}/#${nonce}`);
    // The handoff is a POST the page makes after load. Waiting on a rail
    // button rather than a timeout keeps this honest on a slow machine and
    // fails with a real message on a page that never authenticated.
    await expect(
      page.locator('.nav').first(),
      'the app never rendered a rail button — it probably has no token; ' +
      'check that the nonce was not spent before the browser saw it',
    ).toBeVisible({ timeout: 15_000 });
    // **Found, empirically, once the server started outliving one test.**
    //
    // `src/core/code-identity.ts` stamps the SHA1 content of every file
    // `src/ui/server.ts` reaches (transitively — `read-model.ts` reaches
    // `src/doctor/checks.ts`, among others) at server start, and every `/api`
    // answer that follows carries `staleCode: true` the moment any of those
    // files' CONTENT on disk changes underneath it — correctly: this is a real
    // product feature (`plan:live seq:12`), not a bug, and `app.js` latches a
    // banner over the whole page for it (`ex.codeSkew`, `#exited`), on purpose,
    // because the remedy is a restart a reader has to perform.
    //
    // A server that lives for ONE TEST is stamped and torn down inside a few
    // seconds, so the odds of a source file changing under it were never
    // worth naming. A server that lives for a WHOLE WORKER — 20-plus specs,
    // several minutes — is a wide-open window, and this repository is worked
    // in concurrent lanes that edit files reachable from that scope while a
    // headed suite runs beside them. Measured here: `src/doctor/checks.ts`
    // (owned by a sibling lane, not touched by this change) changed content
    // mid-run, `read-model.ts` pulls it into the server's scope, and every
    // test after that instant in that worker loaded with `#exited` covering
    // the page — `session-picker.spec.ts`'s dialog-focus test failed on a
    // click the banner physically intercepted, nothing to do with dialogs.
    //
    // The banner is truthful and the underlying feature is untouched by this;
    // what changed is that the FIXTURE now needs to not let another lane's
    // unrelated edit fail a test that isn't about code freshness. So: if the
    // page loaded with the skew banner already up, dismiss it exactly as a
    // person would (`ex.ok`) before handing the page to the test. A test that
    // deliberately wants to assert the banner's own behaviour would not get it
    // from this shared, long-lived server anyway — same reasoning as
    // `doctor-settle.spec.ts` and friends, which bring their own.
    const skew = page.locator('#exited:not([hidden])');
    if (await skew.isVisible().catch(() => false)) {
      await skew.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
    }
    await use({
      page,
      port: server.port,
      serverOutput: () => server.output().slice(outputAtStart),
    });
  },
});

export { expect };
