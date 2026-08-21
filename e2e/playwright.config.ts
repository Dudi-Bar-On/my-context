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
 * **One browser.** Chromium only. The mockup's own header says the shipped app
 * serves this page itself under `style-src 'self'; script-src 'self'`; this
 * suite is about whether the page RUNS and what it DRAWS, not about vendor
 * differences, and a second engine would triple the browser download for a
 * question nobody has asked. Adding Firefox or WebKit is one line if that
 * changes.
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

  fullyParallel: true,
  // A `.only` left in a spec silently reduces the suite to one test and exits
  // 0 — the same class of failure as an unquoted test glob, and refused here
  // for the same reason.
  forbidOnly: process.env['CI'] !== undefined,
  // No retries. A browser test that passes on the second attempt is a test
  // that has told you something, and burying it is how a flake becomes
  // permanent.
  retries: 0,
  reporter: [['list']],

  use: {
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

  projects: [{ name: 'chromium', use: { browserName: 'chromium' } }],
});
