// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and, RULE-drive-the-ui-through-playwright-while-doing-the-work-not
/**
 * **The maintenance tool, driven as the owner would drive it.**
 *
 * D41 spec §11, `plan:store seq:3` Task 10 step 5 — *"browser proof, BOTH
 * projects, reading Playwright's own exit code."*
 *
 * `RULE-drive-the-ui-through-playwright-while-doing-the-work-not` is why this
 * file exists at all: the node suite next door proves that `renderForm` draws
 * a `why` control and that `saveFromForm` refuses without one, and neither is
 * evidence that a person can type into the thing. This spec types into it.
 *
 * ── WHY THIS ONE BRINGS ITS OWN STORE, AND `e2e/app.ts` DOES NOT ──────────
 *
 * `app.ts` serves this repository's live corpus and is emphatic that a spec
 * which MANUFACTURES a record must not do it there: *"those records become the
 * newest rows and every latest-N reader believes them."* This spec writes
 * entries, moves them between tiers and publishes — every one of those is a
 * manufactured record — so it is `app.ts`'s own case 2: **a scratch copy of
 * the real store, served on its own server.** The shipped store is copied, not
 * invented, so what is under test is the real thing with a fixture's worth of
 * additions on top.
 *
 * The server is started IN PROCESS rather than spawned, because unlike the UI
 * server there is no nonce handshake to wait for and no CLI entry point to
 * exercise — starting it is one function call, and a child process would add a
 * readiness race for nothing.
 */
import { test as base, expect } from '@playwright/test';
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { writeManifest } from '../src/rules/manifest.ts';
import { composeEntry } from '../src/rules/schema.ts';
import { entriesDir } from '../src/rules/store.ts';
import {
  startMaintenanceServer, type RunningMaintenanceServer,
} from '../src/ui/maintenance/server.ts';
import { removeTree } from '../test/helpers/tmp.ts';

interface Tool {
  url: string;
  dir: string;
  /** Start a SECOND server over the same store with a different budget. */
  withBudget(bytes: number): Promise<string>;
}

const test = base.extend<{ tool: Tool }>({
  tool: async ({}, use) => {
    const dir = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-rules-'));
    cpSync(entriesDir(), dir, { recursive: true });
    writeManifest(dir);
    const servers: RunningMaintenanceServer[] = [];
    const first = await startMaintenanceServer({ storeDir: dir, budgetBytes: 500_000 });
    servers.push(first);
    try {
      await use({
        url: first.url,
        dir,
        withBudget: async (bytes: number): Promise<string> => {
          const extra = await startMaintenanceServer({ storeDir: dir, budgetBytes: bytes });
          servers.push(extra);
          return extra.url;
        },
      });
    } finally {
      for (const server of servers) await server.stop();
      removeTree(dir);
    }
  },
});

/** Fill one labelled control on the form. */
async function fill(page: import('@playwright/test').Page, name: string, value: string): Promise<void> {
  await page.locator(`#f-${name}`).fill(value);
}

test('the list shows the store, the budget, and which tier is counted', async ({ page, tool }) => {
  await page.goto(tool.url);
  await expect(page.locator('h1')).toHaveText('the product rule store');
  await expect(page.locator('#entries tbody tr')).not.toHaveCount(0);
  await expect(page.locator('#budget-product')).toContainText('product tier:');
  await expect(page.locator('#budget-developer')).toContainText('not');
});

test('a prohibition will not save without a why, and says so on the screen', async ({ page, tool }) => {
  await page.goto(`${tool.url}new?kind=prohibition`);

  // The form for a prohibition offers the part a prohibition owes — and the
  // label is the schema's own sentence, not a second one written here.
  await expect(page.locator('#f-why')).toBeVisible();
  await expect(page.locator('label[for="f-why"] .asks'))
    .toHaveText('why — an unreasoned prohibition gets rationalised away');

  await fill(page, 'id', 'browser-probe-prohibition');
  await fill(page, 'title', 'a prohibition typed into the browser');
  await fill(page, 'prohibition', 'never publish a store nobody looked at');
  await fill(page, 'example', 'this entry, typed by e2e/rules-maintenance.spec.ts');
  await fill(page, 'check', 'none - a fixture has nothing to measure');
  await page.locator('#save').click();

  const refusal = page.locator('#refusal');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText('why');
  // The values the owner typed survive the refusal — a form that empties itself
  // on a refusal is a form that punishes the person for the mistake.
  await expect(page.locator('#f-prohibition')).toHaveValue('never publish a store nobody looked at');

  await fill(page, 'why', 'because a store published unread is the defect this store exists to end');
  await page.locator('#save').click();

  await expect(page.locator('#notice')).toContainText('browser-probe-prohibition');
  await expect(page.locator('#entries tr[data-id="browser-probe-prohibition"]')).toBeVisible();
});

test('an entry moves between tiers from the list, both directions', async ({ page, tool }) => {
  await page.goto(tool.url);
  const row = page.locator('#entries tr[data-id="numbered-options-on-a-question-put-to-the-owner"]');
  await expect(row.locator('.tier')).toHaveText('developer');

  await row.getByRole('button', { name: 'move to product' }).click();
  await expect(row.locator('.tier')).toHaveText('product');

  await row.getByRole('button', { name: 'move to developer' }).click();
  await expect(row.locator('.tier')).toHaveText('developer');
});

test('publishing shows a diff and does nothing until it is confirmed', async ({ page, tool }) => {
  await page.goto(`${tool.url}new?kind=fact`);
  await fill(page, 'id', 'browser-probe-fact');
  await fill(page, 'title', 'a fact typed into the browser');
  await fill(page, 'truth', 'the publish screen shows a diff before anything goes out');
  await fill(page, 'breaks', 'a store is published that nobody read');
  await fill(page, 'example', 'this entry');
  await fill(page, 'check', 'none - a fixture has nothing to measure');
  await page.locator('#save').click();
  await expect(page.locator('#notice')).toBeVisible();

  await page.goto(`${tool.url}publish`);
  await expect(page.locator('#diff')).toContainText('added');
  await expect(page.locator('#diff')).toContainText('browser-probe-fact');

  // Nothing has gone out yet: the manifest still describes the store as it was.
  const manifest = (): string => readFileSync(path.join(tool.dir, 'manifest.json'), 'utf8');
  const before = manifest();
  await expect(page.locator('#confirm-publish')).toBeVisible();
  expect(manifest(), 'looking at the publish screen changed the store').toBe(before);

  await page.locator('#f-note').fill('the browser probe');
  await page.locator('#confirm-publish').click();

  await expect(page.locator('#notice')).toContainText('published store version 1');
  await expect(page.locator('#no-changes')).toBeVisible();
  expect(JSON.parse(manifest()).store.changelog[0].note).toBe('the browser probe');
});

test('an over-budget product tier refuses to publish and names what to move', async ({ page, tool }) => {
  writeFileSync(
    path.join(tool.dir, 'browser-probe-heavy.md'),
    composeEntry({
      id: 'browser-probe-heavy',
      kind: 'fact',
      tier: 'product',
      title: 'a deliberately large product entry',
      parts: {
        truth: 'x'.repeat(6000),
        breaks: 'nothing — it exists to be over budget',
        example: 'planted by e2e/rules-maintenance.spec.ts',
        check: 'none - a fixture has nothing to measure',
      },
    }),
    'utf8',
  );
  // Planted the way a PUBLISHED store holds an entry, not by writing behind the
  // tool's back: `writeEntry` refuses a store that was changed by anything else
  // (spec §13), and a fixture that trips that catch is testing the catch rather
  // than the budget. Found here, in the browser, when the tier button hung.
  writeManifest(tool.dir);
  const url = await tool.withBudget(2000);

  await page.goto(`${url}publish`);
  const refusal = page.locator('#budget-refusal');
  await expect(refusal).toBeVisible();
  await expect(refusal).toContainText('browser-probe-heavy');
  await expect(page.locator('#confirm-publish')).toHaveCount(0);

  // And the refusal is actionable on the same screen: demote, and it goes.
  await page.locator('#to-move li', { hasText: 'browser-probe-heavy' })
    .getByRole('button', { name: 'move to developer' }).click();
  await page.goto(`${url}publish`);
  await expect(page.locator('#budget-refusal')).toHaveCount(0);
  await expect(page.locator('#confirm-publish')).toBeVisible();
});

export { expect };
