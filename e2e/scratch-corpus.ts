// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-the-browser-suite-returns-to-the-real-corpus-and-the, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A DISPOSABLE TWIN OF THE LIVE CORPUS — for the specs that must WRITE, and
 * since 2026-09-11 for the specs that need a STATE this corpus no longer
 * holds.**
 *
 * ── WHY THIS EXISTS, AND WHY IT IS NOT A SECOND FIXTURE ────────────────────
 *
 * `e2e/app.ts` serves this repository's own corpus, under
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`. That
 * instruction draws one line inside itself, and this file is that line:
 *
 *     "It does not licence writing to the corpus to see what happens. … a
 *      probe must not write injection or session records, because those become
 *      the newest rows and every latest-N reader believes them."
 *
 * ── AND THE SECOND REASON, WHICH IS THE OWNER'S 2026-09-11 EXCEPTION ───────
 *
 * A spec can also need a state that is simply NOT HERE — a selection that
 * overflows, a review queue with something in it, a doctor finding that routes
 * to `run`, a session with a real injection history. All four were measured
 * absent on this repository on 2026-09-11, and 41 browser failures were that
 * and nothing else. The owner approved one exception for it, in these words:
 * *"Each of those tests makes a private throwaway copy of your corpus, puts the
 * one thing it needs into the copy, runs, and deletes the copy. Your real
 * corpus is never touched."*
 *
 * `seed` is "the one thing it needs", `e2e/seeds.ts` is the whole of what may
 * be put in, and `e2e/scratch-seeds.spec.ts` asserts the last sentence rather
 * than repeating it.
 *
 * ── THE THREE SPECS THAT CAME FIRST ────────────────────────────────────────
 *
 * Three specs were manufacturing records in whatever `CORPUS` pointed at,
 * which was safe only while `CORPUS` was a gitignored build product:
 *
 *   `live-refresh.spec.ts`    a synthetic `kind: 'mutation'` audit record, and
 *                             a REAL budget write through Configure's UI that
 *                             is never put back — `before + 111`, compounding
 *                             on every run.
 *   `preview-picks.spec.ts`   a synthetic `mutation` record.
 *   `simulate-slider.spec.ts` a real budget write, restored in a `finally` —
 *                             which is honest and still leaves the corpus
 *                             written to twice and its audit log two records
 *                             longer.
 *
 * Pointed at the live corpus those become the NEWEST ROWS of the project's own
 * history, which is precisely the litter the instruction forbids. So they do
 * not stop testing what they test; they do it on a twin.
 *
 * **This is not `.demo-corpus` returning under a new name.** The fixture was a
 * corpus AUTHORED to hold one of everything, standing in for the real one for
 * every spec at once. This is a COPY of the real one, made per test, written
 * to, and deleted — the same data, the same scale, the same items, and no
 * second answer to "what is the app looking at". It is case 2 of the three the
 * return names: *arrange the one state this test needs, in a scratch workspace
 * of its own.*
 *
 * ── WHAT IS COPIED, AND WHY IT IS THE LEAN COPY ───────────────────────────
 *
 * `composer-write-execute.spec.ts` measured this: `worthCopying` alone drags
 * `node_modules` along and costs 30 SECONDS per workspace, against 2.3s once
 * the four directories a corpus does not need are excluded. A workspace here is
 * only two things — the corpus to read and write, and the root that
 * repository-relative paths resolve against — because the server and the CLI
 * are both started from the REAL repository by absolute path.
 *
 * `.demo-corpus` stays on the exclusion list for as long as the directory
 * survives on anyone's disk: a second `.my_context` inside the tree is a second
 * corpus a walk could find.
 *
 * ── AND THE SECOND STORE ──────────────────────────────────────────────────
 *
 * `~/.my-context` is a different directory, shared by every corpus on the
 * machine, and copying the workspace does not isolate it. `env` carries the
 * throwaway `HOME`/`USERPROFILE` from `throwaway-home.ts`, which holds the
 * measurement; pass it to every child this workspace starts.
 */
import { execFileSync } from 'node:child_process';
import { test as base, expect, type Page } from '@playwright/test';
import { cpSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CORPUS } from './app.ts';
import { throwawayHome } from './throwaway-home.ts';
import { openApp } from './composer-run.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { worthCopying } from '../src/ui/execute-effect.ts';
import { DIR_NAME } from '../src/core/workspace.ts';
import type { Seed } from './seeds.ts';

const CLI = path.join(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/**
 * `worthCopying`'s own exclusions, plus the four directories a corpus does not
 * need and a copy pays 27 seconds for. Kept identical to
 * `composer-write-execute.spec.ts`' `NOT_WORTH_COPYING`, which measured it.
 */
const NOT_WORTH_COPYING = new Set([
  'node_modules', '.git', 'test-results', 'playwright-report', '.demo-corpus',
]);

const leanCopy = (source: string): boolean =>
  worthCopying(source) && !NOT_WORTH_COPYING.has(path.basename(source));

export interface Scratch {
  /** The workspace root — what `mycontext ui` is pointed at. */
  readonly root: string;
  /**
   * The directory the throwaway `HOME` lives in. Exposed so a test can assert
   * that BOTH halves of a twin are gone after `dispose`, which is the property
   * `%TEMP%` says was not holding: 118 workspace roots against 13 home boxes,
   * measured 2026-09-11.
   */
  readonly homeBox: string;
  /**
   * The `.my_context` directory inside it — what `recordAudit`'s own `root`
   * parameter expects, which is NOT the workspace. Passing the workspace
   * silently writes a stray log the running server never watches; that mistake
   * is written up in `live-refresh.spec.ts`' own history and is the reason this
   * is handed out rather than re-derived at each call site.
   */
  readonly myContextDir: string;
  /** The environment every child of this workspace gets: a throwaway `HOME`. */
  readonly env: NodeJS.ProcessEnv;
  dispose: () => void;
}

/**
 * One disposable twin of the live corpus, indexed and ready to serve.
 *
 * `seed` runs after the first `rebuild` and before the second, so a test that
 * needs one specific state — a staged revision, a draft, a spill at a lower
 * budget — arranges it through the real code and gets an index that knows about
 * it. A test that only needs somewhere safe to write passes nothing.
 */
/**
 * **Delete a temporary tree, RETRYING, because one attempt loses to Windows.**
 *
 * The line this replaces tried once and swallowed the failure, on the
 * reasoning that "a scratch directory that outlives one run is litter in
 * `%TEMP%`, never a failure of the test that made it". The first half of that
 * is true and the second half made it invisible. **Measured 2026-09-11:
 * `%TEMP%` held 118 `myctx-e2e-` workspace roots against 13 `myctx-e2eh-`
 * home boxes** — so the home box, which no process ever opens, was being
 * removed nearly every time and the workspace, which a UI server had a SQLite
 * handle on, was surviving nine times in ten. Some of the survivors are full
 * 68 MB copies of this corpus.
 *
 * The cause is the handle rather than the code: `harness.stop()` resolves when
 * the child reports exit, and Windows releases a mandatory file lock a beat
 * later. So this waits for the beat. Twelve attempts a quarter-second apart is
 * three seconds of patience against a copy that cost twenty to make, and the
 * loop stops the moment the directory is gone.
 *
 * **`Atomics.wait` rather than a promise**, because `dispose` is synchronous
 * and is called from a `finally` that a failing test also takes: making it
 * async would mean a test that threw could return before the delete had run,
 * which is the leak this exists to close.
 *
 * Returns whether the tree is actually gone, so a caller can SAY so. A leak
 * nobody is told about is how 118 of them accumulated.
 */
function removeWithRetries(dir: string): boolean {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      rmSync(dir, { recursive: true, force: true });
      return true;
    } catch {
      if (!existsSync(dir)) return true;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  return !existsSync(dir);
}

export function scratchCorpus(seed: Seed = () => {}): Scratch {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-'));
  const homeBox = mkdtempSync(path.join(tmpdir(), 'myctx-e2eh-'));
  const { env } = throwawayHome(homeBox);
  cpSync(CORPUS, root, { recursive: true, dereference: true, filter: leanCopy });
  const rebuild = (): void => {
    execFileSync(process.execPath, [CLI, 'rebuild'], {
      cwd: root, encoding: 'utf8', stdio: 'pipe', env,
    });
  };
  rebuild();
  seed(root, env);
  rebuild();
  // **AND THEN THE PROJECTION, LAST, because `rebuild` destroys it.**
  //
  // The session ledger and the audit projection live in `.index.db`, which
  // `worthCopying` excludes from the copy and `rebuild` rewrites from the
  // Markdown. So a twin whose seed ran `mycontext audit` before the final
  // rebuild has no ledger by the time a server opens it: `/api/sessions`
  // answers `ledger: "not-projected"`, `sessions: []` and `default: null`, and
  // every screen whose subject is a session draws nothing. Measured here on
  // 2026-09-11 — the seed WAS projecting, and the rebuild after it was undoing
  // that silently.
  //
  // This is the same one write `e2e/global-setup.ts` makes once for the live
  // corpus, and the same argument applies: `mycontext audit` advances a derived
  // index, authors no item and appends no record. Made here it contends with
  // nothing at all, because the corpus is this test's own.
  //
  // **TWO commands, because they build two different things.** `audit --limit
  // 1` advances the audit PROJECTION, which is what the delivery-time column
  // and the spill split read. `audit replay-ledger` projects the log's
  // injection records into the LEDGER table, which is what `/api/sessions`
  // reads — without it that route answers `ledger: "not-projected"` and an
  // empty session list, and the shell has no session to land on at all. Both
  // live in `.index.db` and both are therefore lost to the rebuild above.
  for (const args of [['audit', '--limit', '1'], ['audit', 'replay-ledger']]) {
    execFileSync(process.execPath, [CLI, ...args], {
      cwd: root, encoding: 'utf8', stdio: 'pipe', env,
    });
  }
  return {
    root,
    homeBox,
    myContextDir: path.join(root, DIR_NAME),
    env,
    dispose: () => {
      const left = [root, homeBox].filter((dir) => !removeWithRetries(dir));
      if (left.length > 0) {
        // Said out loud rather than swallowed. See `removeWithRetries`.
        process.emitWarning(
          `e2e: a throwaway corpus could not be deleted and is still in %TEMP%: ${left.join(', ')}`,
        );
      }
    },
  };
}

/**
 * The page, on a server of this workspace's own — the `app` fixture's shape,
 * over a corpus this test may write to.
 */
export interface IsolatedApp {
  readonly page: Page;
  readonly port: number;
  /** Where `recordAudit` and friends may write. See `Scratch.myContextDir`. */
  readonly myContextDir: string;
  /** The workspace root, for a child that must be started inside it. */
  readonly root: string;
  /** Everything the server has written since this test began. */
  serverOutput: () => string;
}

/**
 * **`test` with an `app` that owns its corpus, TEST-scoped, for a spec that
 * WRITES.**
 *
 * Deliberately the same fixture NAME and the same three members the shared
 * `app` exposes, so a spec moves onto it by changing its import rather than
 * its assertions — the change this makes to a spec should be legible as "this
 * one writes", and nothing else.
 *
 * TEST-scoped, not worker-scoped, and that is the whole difference from
 * `e2e/app.ts`. The shared server is worker-scoped precisely because a
 * READ-ONLY server has no per-test state to leak; a server whose corpus is
 * written to has nothing but per-test state, so sharing one across a worker
 * would hand the next test whatever the last one wrote.
 *
 * **A test-scoped copy costs its whole budget, measured.** Copying this corpus
 * and rebuilding it twice takes 12-20 seconds on the owner's machine, against
 * a 30-second default test timeout — so every spec on this fixture must raise
 * its own (`test.setTimeout`), and `writingSeededTest` raises the FIXTURE's
 * timeout so the setup fails as itself rather than as "test timeout exceeded"
 * pointing at a `base.extend` line, which is how it first presented.
 */
/**
 * **How long a twin may take to build, before the failure is reported as the
 * FIXTURE's rather than the test's.**
 *
 * Measured on the owner's machine 2026-09-11: the copy alone is ~6s (the
 * corpus is 1,085 items and the repository around it), and `mycontext rebuild`
 * is ~2.9s and runs twice, once before the seed so the seed's own CLI calls
 * have an index and once after so the server serves what was seeded. Add the
 * seed's own commands and a hook run and it reaches twenty seconds.
 *
 * The default fixture timeout is the 30-second test timeout, and when the setup
 * overran it Playwright reported "Fixture timeout exceeded during setup"
 * pointing at the `base.extend` line — a message about this file rather than
 * about the corpus copy, which is exactly the kind of failure that gets read as
 * flakiness. Three minutes is not a licence to be slow; it is enough room that
 * a twin which genuinely cannot be built says so as itself.
 */
const SETUP_BUDGET = 180_000;

export const isolatedTest = writingSeededTest();

/**
 * **`isolatedTest`, with ONE NAMED STATE put into the copy first — for a spec
 * that WRITES to the corpus it is served.**
 *
 * This is the owner's exception, spelled as a function: *"Each of those tests
 * makes a private throwaway copy of your corpus, puts the one thing it needs
 * into the copy, runs, and deletes the copy."* The `seed` argument is "the one
 * thing it needs", and it is passed at the TOP OF THE SPEC so a reader sees
 * what that file requires without opening anything else:
 *
 *     const test = writingSeededTest(staleRevision());
 *
 * That legibility is the whole repair. `.demo-corpus` held one of everything,
 * so a spec asserting a spilled list and a spec asserting an empty one read
 * identically — and when the fixture went away, 41 browser failures had to be
 * re-diagnosed one at a time because no spec said what it had been leaning on.
 *
 * **The copy is deleted in a `finally`**, so a failing test leaks nothing: a
 * stray copy of a 1,085-item corpus per test is its own defect.
 */
export function writingSeededTest(seed: Seed = () => {}) {
  return base.extend<{ app: IsolatedApp }>({
    app: [async ({ page }, use) => {
      const scratch = scratchCorpus(seed);
      const harness = await startUiChild(scratch.root, [], scratch.env);
      try {
        await openApp(page, harness);
        await use({
          page,
          port: harness.port,
          myContextDir: scratch.myContextDir,
          root: scratch.root,
          serverOutput: () => harness.output(),
        });
      } finally {
        await harness.stop();
        scratch.dispose();
      }
    }, { timeout: SETUP_BUDGET }],
  });
}

/**
 * **ONE seeded twin per WORKER, for the specs that only READ it.**
 *
 * `e2e/app.ts` made exactly this move for the shared server on 2026-09-09 and
 * its reasoning transfers whole: *"a read-only server has no per-test state a
 * shared instance could leak between tests, so spawning a fresh one for every
 * test bought nothing but the cost of spawning it."* Here the cost is far
 * larger than a spawn — a copy of a 1,085-item corpus plus two rebuilds, 12-20
 * seconds, MEASURED — and `preview-spilled.spec.ts` alone has eleven tests. Per
 * test that is four minutes of copying per browser project to reach the same
 * eleven read-only pages.
 *
 * **The line between this and `writingSeededTest` is whether the spec WRITES**,
 * and it is the only thing that decides which a spec takes. A spec that presses
 * Execute, drags a budget, or drives a settlement takes the test-scoped one;
 * everything else takes this. Getting it wrong in the unsafe direction is
 * visible rather than subtle: the next test in the same worker inherits the
 * write, and the corpus the seed describes is no longer the corpus under it.
 *
 * **The nonce is one-shot and the server is not**, so — exactly as `app.ts`
 * does, and for the identical reason — this mints a FRESH nonce per test
 * through `POST /api/nonce` rather than reusing the one the server printed at
 * startup. Reusing it would hand every test after the first a spent nonce and a
 * token-less page, which is the "locked-out tab" that route exists to recover.
 */
export function seededTest(seed: Seed = () => {}) {
  return base.extend<{ app: IsolatedApp }, { twin: { scratch: Scratch; harness: UiHarness } }>({
    twin: [async ({}, use) => {
      const scratch = scratchCorpus(seed);
      const harness = await startUiChild(scratch.root, [], scratch.env);
      try {
        await use({ scratch, harness });
      } finally {
        await harness.stop();
        scratch.dispose();
      }
    }, { scope: 'worker', timeout: SETUP_BUDGET }],

    app: async ({ page, twin }, use) => {
      const { harness, scratch } = twin;
      const outputAtStart = harness.output().length;
      await openSeeded(page, harness);
      await use({
        page,
        port: harness.port,
        myContextDir: scratch.myContextDir,
        root: scratch.root,
        serverOutput: () => harness.output().slice(outputAtStart),
      });
    },
  });
}

/**
 * **Open a page on a twin's server, on a nonce MINTED FOR THIS TEST.**
 *
 * `composer-run.ts`'s `openApp` navigates to `harness.nonce` — the one the
 * server printed at startup — which is right for a server one test owns start
 * to finish and wrong for one a WORKER owns. The nonce is redeemed exactly
 * once, so the second test to call it arrives with a spent nonce and a
 * token-less page, and every later `window.myctx.api` call hangs until the test
 * times out with no message about credentials at all. Measured here on
 * 2026-09-11, on the second test of `scratch-seeds.spec.ts`.
 *
 * `POST /api/nonce` is the product's own recovery route for exactly that
 * state, and `e2e/app.ts` mints through it per test for the identical reason.
 */
export async function openSeeded(page: Page, harness: UiHarness): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await expect(
    page.locator('.nav').first(),
    'the seeded twin never rendered a rail button — it probably has no token; check that the '
    + 'nonce was not spent before the browser saw it',
  ).toBeVisible({ timeout: 30_000 });
  // Another lane editing a file the server's code-identity stamp covers latches
  // the skew banner over the whole page. `e2e/app.ts` carries the measurement;
  // the remedy is the one a person performs.
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.getByRole('button', { name: 'OK', exact: true }).click().catch(() => {});
  }
}

export { expect };
