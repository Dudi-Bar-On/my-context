/**
 * **The Configure screen writes the budget, behind the diff a boundary
 * command gets — proven in a real browser.**
 *
 * Task `plan:budget seq:5`, `DEC-the-ui-writes-budgets-and-the-simulator-always-meant-to`.
 * `test/ui/execute-budgets-route.test.ts` already proves the SERVER: the
 * `BUDGETS_ID` branch's shape, the nonce, the refusals, the audit row. What no
 * server test can prove is that the number a person TYPES into the Budgets
 * table is the number that lands in `config.json` — that is the screen, the
 * confirm and the write agreeing, and it only exists in a browser
 * (`RULE-a-ui-change-is-not-done-until-a-browser-test-drives-it`).
 *
 * ── WHY THIS FILE GETS ITS OWN ISOLATED WORKSPACE ───────────────────────────
 *
 * This test WRITES `config.json` for real. `e2e/execute.spec.ts`'s header has
 * the whole argument for why a real mutation gets a disposable `mkdtemp`
 * workspace and its own server rather than restoring the shared
 * `.demo-corpus` in place — a spec that mutated the fixture other parallel
 * specs measure against corrupted the ground under them twice in one week.
 * This file follows the same shape, minus the corpus copy: a budget write
 * needs no items at all, only a `config.json`, so the workspace here is a bare
 * `mycontext init` rather than a copy of `.demo-corpus`.
 *
 * Selectors follow `capture-execute.spec.ts`'s house style: every screen
 * addressed through its own `[data-p="…"]` region, buttons selected by TEXT
 * because they are deliberately classless.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test as base } from '@playwright/test';
import { startUiChild, type UiHarness } from '../test/ui/helpers.ts';

const CLI = path.resolve(import.meta.dirname, '..', 'src', 'cli', 'index.ts');

/**
 * **The Budgets PANE, not the Configure screen.**
 *
 * `plan:config seq:1` split Configure into one pane per configuration subject
 * on 2026-08-29, and three of the four panes now carry a composed command line
 * and the house's Copy-and-Execute control — which means `.confirm` and
 * `.execresult` appear four times on this screen where they used to appear
 * once. Every selector below that was `[data-p="config"] .thing` addresses the
 * pane instead: `data-pane` is stamped by `composerPane` for exactly this, and
 * a `.first()` would have gone on quietly picking whichever pane rendered
 * first rather than the one this file is about.
 */
const BUDGETS = '[data-p="config"] [data-pane="budgets"]';

/** A bare, freshly-initialised workspace — no items, only `.my_context/config.json`. */
function makeBudgetsWorkspace(): string {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-budgets-'));
  execFileSync(process.execPath, [CLI, 'init'], { cwd: root, encoding: 'utf8', stdio: 'pipe' });
  return root;
}

const configJsonPath = (root: string): string => path.join(root, '.my_context', 'config.json');

base('a proposed budget shows as a real value in the confirm, and lands in config.json',
  async ({ page }) => {
    base.setTimeout(60_000);
    const root = makeBudgetsWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(root);
      const h = harness;

      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      await expect(
        page.locator('.nav').first(),
        'the isolated server never rendered a rail button — it probably has no token',
      ).toBeVisible({ timeout: 15_000 });

      await page.evaluate(() => { location.hash = '#/config'; });
      const pinnedInput = page.locator(`${BUDGETS} input[aria-label="budgets.pinned"]`);
      await pinnedInput.waitFor({ state: 'visible', timeout: 15_000 });

      // The shipped default, drawn into the field the same way `budgetRows`
      // draws it into the read-only cell beside it.
      await expect(pinnedInput).toHaveValue('6000');

      await pinnedInput.fill('22000');
      await page.getByRole('button', { name: 'Write budgets', exact: true }).click();

      // The confirm's field-by-field diff — real values, not a file-level
      // placeholder. This is the exact thing the task named as insufficient
      // about `execute-effect.ts`'s `elsewhereInCorpus` for a non-item write.
      const confirm = page.locator(`${BUDGETS} .confirm`);
      await confirm.waitFor({ state: 'visible', timeout: 15_000 });
      await expect(confirm).toContainText('budgets.pinned');
      await expect(confirm).toContainText('6000');
      await expect(confirm).toContainText('22000');
      // The same security residual every boundary confirm on this UI carries —
      // reused, not reworded a second time.
      await expect(confirm).toContainText('not that you asked');

      await confirm.getByRole('button', { name: 'Write it', exact: true }).click();

      await expect(
        page.locator(`${BUDGETS} .execresult`),
        'the write must report back — "Written to config.json."',
      ).toContainText('config.json');

      const onDisk = JSON.parse(readFileSync(configJsonPath(root), 'utf8')) as {
        budgets: Record<string, number>;
      };
      expect(onDisk.budgets.pinned).toBe(22_000);

      // A successful write updates the field in place to the server's own
      // `after` value — not the value the closure captured before the write.
      await expect(page.locator(`${BUDGETS} input[aria-label="budgets.pinned"]`)).toHaveValue('22000');
    } finally {
      if (harness !== undefined) await harness.stop();
      try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  });

base('a value that is not a positive integer is refused — no confirm, no write, no CLI reached',
  async ({ page }) => {
    base.setTimeout(60_000);
    const root = makeBudgetsWorkspace();
    let harness: UiHarness | undefined;
    try {
      harness = await startUiChild(root);
      const h = harness;
      await page.goto(`http://127.0.0.1:${h.port}/#${h.nonce}`);
      await expect(page.locator('.nav').first()).toBeVisible({ timeout: 15_000 });
      await page.evaluate(() => { location.hash = '#/config'; });

      const pinnedInput = page.locator(`${BUDGETS} input[aria-label="budgets.pinned"]`);
      await pinnedInput.waitFor({ state: 'visible', timeout: 15_000 });
      await pinnedInput.fill('-1');
      await page.getByRole('button', { name: 'Write budgets', exact: true }).click();

      await expect(
        page.locator(`${BUDGETS} .execresult`),
        'a negative budget must be refused, naming what was wrong — never silently clamped',
      ).toContainText('positive integer', { timeout: 15_000 });
      await expect(page.locator(`${BUDGETS} .confirm`)).toBeHidden();

      const onDisk = JSON.parse(readFileSync(configJsonPath(root), 'utf8')) as {
        budgets?: Record<string, number>;
      };
      expect(onDisk.budgets?.pinned).toBeUndefined();
    } finally {
      if (harness !== undefined) await harness.stop();
      try { rmSync(root, { recursive: true, force: true }); } catch { /* best-effort cleanup */ }
    }
  });
