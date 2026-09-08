// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-the-browser-suite-returns-to-the-real-corpus-and-the, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **A DISPOSABLE TWIN OF THE LIVE CORPUS, for the specs that must WRITE.**
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
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CORPUS } from './app.ts';
import { throwawayHome } from './throwaway-home.ts';
import { openApp } from './composer-run.ts';
import { startUiChild } from '../test/ui/helpers.ts';
import { worthCopying } from '../src/ui/execute-effect.ts';
import { DIR_NAME } from '../src/core/workspace.ts';

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
export function scratchCorpus(seed: (root: string) => void = () => {}): Scratch {
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
  seed(root);
  rebuild();
  return {
    root,
    myContextDir: path.join(root, DIR_NAME),
    env,
    dispose: () => {
      for (const dir of [root, homeBox]) {
        // Windows holds SQLite handles open a moment after the child exits;
        // a scratch directory that outlives one run is litter in `%TEMP%`,
        // never a failure of the test that made it.
        try { rmSync(dir, { recursive: true, force: true }); } catch { /* Windows lock */ }
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
 * **`test` with an `app` that owns its corpus.**
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
 */
export const isolatedTest = base.extend<{ app: IsolatedApp }>({
  app: async ({ page }, use) => {
    const scratch = scratchCorpus();
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
  },
});

export { expect };
