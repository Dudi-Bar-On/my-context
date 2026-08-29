/**
 * Playwright's configuration, and the reason this directory exists at all.
 *
 * **Why `e2e/` and not `test/`.** `npm test` runs `node --test` over a
 * double-star glob rooted at `test/`, so ANY `*.test.ts` placed under `test/`
 * is executed by `node:test` — and a Playwright spec is not a `node:test`
 * file, so it would fail there. `scripts/check-test-glob.ts` makes that worse
 * in a useful way: it WALKS `test/` for `*.test.ts` and compares the count
 * against what the glob resolves, so a Playwright file under `test/` would
 * either be run by the wrong runner or break the parity check. A sibling
 * directory keeps both runners honest — `check:test-glob` still reports the
 * same 159 files it did before this directory existed.
 *
 * `*.spec.ts`, not `*.test.ts`, for the same reason twice over: even if these
 * files were later moved, the suffix alone keeps them out of the `node:test`
 * glob.
 *
 * **Determinism.** `test/helpers/pin-rendering.ts` pins the ambient rendering
 * environment for the node suite because CI and a developer's terminal
 * disagreed and the suite was green on every machine that could run it
 * locally. The same argument applies to a browser, which reads far more
 * ambient state than a terminal does — colour scheme, locale, time zone and
 * viewport are all pinned here so that a layout assertion means the same thing
 * on a hosted runner as it does on the owner's workstation.
 *
 * **Two projects, and they are not two engines.** `chromium` is Playwright's
 * bundled build; `chrome` is GOOGLE CHROME ITSELF, via `channel: 'chrome'`.
 *
 * Owner ruling, 2026-08-22: it "also must occur correct on the chrome browser".
 * That is not pedantry. Bundled Chromium and shipped Chrome differ in exactly
 * the places this app lives — proprietary codecs, PDF and print, component
 * updates, and the enterprise policies a real profile carries. A page can be
 * green on Chromium and wrong in the browser the owner actually opens, and the
 * browser the owner actually opens is the one that decides whether it works.
 *
 * `chrome` needs no extra download: it drives the installed Chrome. If none is
 * installed the project fails LOUDLY at launch rather than skipping, which is
 * the correct outcome for a requirement stated as "must".
 *
 * Still no Firefox or WebKit: nobody has asked what this page does in Gecko,
 * and each is a real download. Adding one is a line here if that changes.
 *
 * **The browsers are a separate download.** `@playwright/test@1.62` declares no
 * install hook, so `npm ci` installs the package and NOT the ~275 MB of browser
 * binaries. `npm run test:e2e:install` fetches them. CI, which never runs
 * headed, can halve that with `playwright install --only-shell chromium`.
 */
import { defineConfig } from '@playwright/test';

export default defineConfig({
  // The config lives beside the specs, so `testDir` is this directory.
  testDir: '.',
  testMatch: '*.spec.ts',

  /**
   * **The one write the suite makes, made once, before any worker starts.**
   *
   * `e2e/app.ts` used to bring the audit projection up to date inside every
   * fixture, and `mycontext audit` is a write: four workers therefore wrote
   * `.demo-corpus/.audit/audit.db` while sibling servers read it, and the
   * losers rendered `database is locked` / `disk I/O error` into whichever
   * card was mid-fetch. That is the source of most of the "known e2e
   * contention" list, and that list had already hidden a real failure
   * (`plan:walk seq:74`).
   *
   * Once here, the fixtures only read, and `recordAudit` keeps the projection
   * current during the run from the write path it already owns. Measured on
   * `item-pane.spec.ts` at the default worker count: 2 of 12 runs failed
   * before, 0 of 12 after. `e2e/global-setup.ts` carries the whole argument.
   *
   * Deliberately NOT solved by lowering `workers` below: hiding contention
   * costs everyone's wall clock and leaves the next writer to rediscover it.
   * The cap below is a separate, earlier finding about headed browsers, and it
   * stays for its own reasons.
   */
  globalSetup: './global-setup.ts',

  fullyParallel: true,
  /**
   * **Capped, because the default was buying nothing and costing determinism.**
   *
   * Playwright defaults to half the logical cores — ten on the owner's
   * twenty-core machine — and this suite runs HEADED by the 2026-08-22 ruling
   * below. Ten headed Chrome instances is already heavy, and since
   * `plan:execute seq:5b` every boundary confirm additionally spawns a node
   * process that copies the whole corpus (618 items in the demo fixture) to a
   * temporary directory.
   *
   * **Measured 2026-08-28, same code, same machine, minutes apart:**
   *
   *   - default (10 workers): FIVE failures — `screen-parity`, `app-layout`,
   *     `button-contrast` and two `execute` specs. Every one of them passed in
   *     isolation afterwards, on both browser projects.
   *   - `--workers=4`: 186 passed, 0 failed.
   *   - Wall clock: 2.7 min against 2.9 min. Essentially identical.
   *
   * So the machine was already saturated at four, and workers five through ten
   * added timing noise and no speed. Seven different specs had failed this way
   * across the day, each passing alone, and the cause was read as flakiness —
   * twice by me, in writing — before anyone varied the parallelism.
   *
   * A percentage rather than `4`, so a smaller machine scales down with it.
   * This sits beside `retries: 0` for the same reason: a suite that only passes
   * because it was allowed a second attempt has told you something and buried
   * it. Contention is a real defect in a test run, not weather.
   */
  workers: '20%',
  // A `.only` left in a spec silently reduces the suite to one test and exits
  // 0 — the same class of failure as an unquoted test glob, and refused here
  // for the same reason.
  forbidOnly: process.env['CI'] !== undefined,
  // No retries. A browser test that passes on the second attempt is a test
  // that has told you something, and burying it is how a flake becomes
  // permanent.
  retries: 0,
  reporter: [['list']],

  // **HEADED unless this is CI.** Owner ruling, 2026-08-22: "when you use
  // playwright do not use it headless, i want to see the debug and test
  // activities you make."
  //
  // This is not a preference about windows. This project's whole current
  // problem was an agent reporting green numbers over a page nobody had looked
  // at, and a headless run is that failure with a browser attached — the work
  // happens where the owner cannot see it, and the only evidence left is a
  // number I chose to report. Headed, the run is watchable while it happens.
  //
  // Keyed on CI rather than hard-coded, because a hosted runner has no display
  // and would fail to launch. `forbidOnly` above already keys on the same
  // variable, so this adds no new assumption about the environment.
  use: {
    headless: process.env['CI'] !== undefined,
    // Pinned, for the same reason pin-rendering.ts pins the terminal. Dark
    // only as of the visual repaint (2026-08-21): the mockup has no
    // prefers-color-scheme branch left to answer, so 'light' emulation was
    // testing a light theme that no longer exists — the print-from-dark
    // defect went unseen for exactly this reason. There is no separate
    // per-project colorScheme to remove; this is the one place it was set.
    colorScheme: 'dark',
    locale: 'en-US',
    timezoneId: 'UTC',
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    // Kept only for a failure, because a trace of a green run is 2 MB nobody
    // will open.
    trace: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    // Google Chrome as installed on this machine, not the bundled build.
    { name: 'chrome', use: { browserName: 'chromium', channel: 'chrome' } },
  ],
});
