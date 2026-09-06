/**
 * The conversation archive, driven in a real browser in both languages —
 * `plan:archive seq:3`.
 *
 * **Why this exists as well as `test/ui/conversations-endpoint.test.ts`.**
 * That file proves the endpoint; this one proves the SCREEN, and six lanes
 * this week found real defects in a picture after every assertion had passed.
 * The three things only a browser can answer here:
 *
 *   1. **Prompts really are distinguishable from answers and from machinery**,
 *      by more than colour — a chip with a glyph and a word, and a border
 *      accent, both present at once.
 *   2. **Machinery really is folded**, as a native `<details>` a keyboard can
 *      open, rather than a `<div>` with a click handler.
 *   3. **The Hebrew page really is Hebrew**, with the accent on the correct
 *      edge under `dir="rtl"` and no Latin run left where a key was missed.
 *
 * The server is the suite's own `startUiChild` on its own port, with the
 * sessions store pinned by `test/ui/helpers.ts`' import of
 * `pin-sessions-dir.ts` — so the owner's server on 58888 and the global record
 * at `~/.my-context/ui-server.json` are untouched. `CLAUDE_CONFIG_DIR` points
 * the scanner at a throwaway home, so no real transcript is read.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];

/** A session with one of each kind, so the screen has all three to draw. */
const SESSION = [
  { type: 'user', message: { role: 'user', content: 'add the archive screen' }, timestamp: '2026-09-05T09:00:00.000Z', gitBranch: 'master' },
  { type: 'ai-title', aiTitle: 'The conversation archive' },
  { type: 'assistant', message: { role: 'assistant', content: text('Reading the spec first.') }, timestamp: '2026-09-05T09:00:01.000Z' },
  { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] }, timestamp: '2026-09-05T09:00:02.000Z' },
  { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'the spec, all 231 lines of it' }] }, timestamp: '2026-09-05T09:00:03.000Z' },
  { type: 'assistant', message: { role: 'assistant', content: text('Done — the index rebuilds from disk.') }, timestamp: '2026-09-05T09:00:04.000Z' },
];

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-conv-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-conv-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'sess-archive.jsonl'),
    SESSION.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // The index is built by a CLI WRITE, because the server cannot build it.
    // That is the whole read/write split, exercised here the way a user meets
    // it: run the command, then reload the screen.
    runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally {
    process.chdir(previous);
  }
  harness = await startUiChild(cwd);
});

test.afterAll(async () => {
  await harness?.stop();
  delete process.env['CLAUDE_CONFIG_DIR'];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
});

/**
 * Open the app at a hash, in one language — in ONE page load.
 *
 * The language is planted by `addInitScript` before any of the app's own code
 * runs, rather than set and then navigated to. The first draft loaded the page
 * twice (set `localStorage`, then go again), and the second navigation aborted
 * the first page's in-flight heartbeat: the app reads a rejected fetch as
 * "the server has exited" and raises `#exited`, a fixed overlay that then
 * physically intercepted every click. Four tests failed for a banner rather
 * than for anything they were about — the same shape as the skew banner
 * `TASK-a-server-older-than-the-data-on-disk-calls-the-audit-log` records.
 */
async function open(page: Page, hash: string, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  // A FRESH nonce per page. `harness.nonce` is the one the server printed at
  // start and it is SINGLE-USE: reusing it across tests made the second and
  // later redemptions fail, the tab lose its token, and the next fetch reject
  // — which the app reports as `#exited`, a fixed overlay that then intercepts
  // every click. Three tests failed for that and none of them was about it.
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash.replace(/^#/, '#'));
  await page.waitForSelector('.convrow, .convrec, .spill', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

for (const lang of ['en', 'he'] as const) {
  test(`the list names each session and its counts (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);

    await expect(page.locator('html')).toHaveAttribute('dir', lang === 'he' ? 'rtl' : 'ltr');
    const row = page.locator('.convrow').first();
    await expect(row).toBeVisible();
    await expect(row).toContainText('The conversation archive');
    // The title came from the model, and the screen says so rather than
    // letting it read as a name a person chose.
    await expect(row).toContainText(lang === 'he' ? 'המודל' : 'the model');
    await expect(row).toContainText('master');

    await page.screenshot({ path: `e2e/screens/conversations-list-${lang}.png`, fullPage: true });
  });

  test(`a transcript marks prompts, answers and machinery apart (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.convrec');

    // 1. Distinct by MORE than colour: the accent border AND a chip carrying a
    //    glyph and a keyed word.
    await expect(page.locator('.convrec.kind-prompt')).toHaveCount(1);
    await expect(page.locator('.convrec.kind-answer')).toHaveCount(2);
    // THREE, not two: the `ai-title` record is machinery as well as the tool
    // call and the tool result. It is a record in the file, so it occupies a
    // position in the answer and is folded and named — dropping it would
    // renumber everything after it and hide that anything was there
    // (INV-nothing-is-dropped-silently). Expecting two was this test being
    // wrong about the file, not the screen being wrong about the record.
    await expect(page.locator('.convrec.kind-machinery')).toHaveCount(3);
    await expect(page.locator('.convrec.kind-prompt .chip').first())
      .toHaveAttribute('data-g', '▸');

    // The accent really is painted, and it really is on the reading edge.
    const side = await page.locator('.convrec.kind-prompt').first().evaluate((node) => {
      const style = getComputedStyle(node as Element);
      return {
        width: style.borderInlineStartWidth,
        colour: style.borderInlineStartColor,
        left: style.borderLeftWidth,
        right: style.borderRightWidth,
      };
    });
    expect(side.width).toBe('3px');
    expect(side.colour).not.toBe('rgba(0, 0, 0, 0)');
    // Under RTL the logical start edge is the RIGHT one. This is the assertion
    // that would catch a physical `border-left` written by habit.
    if (lang === 'he') expect(side.right).toBe('3px');
    else expect(side.left).toBe('3px');

    // A record's text infers its OWN direction. Without this an English turn
    // on the Hebrew page renders its full stop at the wrong end — seen in the
    // screenshot, after every other assertion here had passed.
    await expect(page.locator('.convrec.kind-prompt .convtext'))
      .toHaveAttribute('dir', 'auto');

    // 2. Machinery is FOLDED, and it is a real <details> — so Enter opens it
    //    and print expands it, with no key handler of our own.
    // The TOOL RESULT's fold specifically — the first machinery row is the
    // `ai-title` book-keeping record, which is folded and named too.
    const fold = page.locator('.convrec.kind-machinery details.convfold')
      .filter({ hasText: 'tool_result' });
    await expect(fold).toHaveCount(1);
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(false);
    await fold.locator('summary').focus();
    await page.keyboard.press('Enter');
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);
    await expect(fold).toContainText('the spec, all 231 lines of it');

    // A prompt is NOT folded — the reader came for it.
    await expect(page.locator('.convrec.kind-prompt details')).toHaveCount(0);
    await expect(page.locator('.convrec.kind-prompt')).toContainText('add the archive screen');

    await page.screenshot({
      path: `e2e/screens/conversations-transcript-${lang}.png`, fullPage: true,
    });
  });

  test(`search narrows the loaded window and says how many matched (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.convrec');

    const before = await page.locator('.convrec:visible').count();
    expect(before).toBe(6);

    await page.locator('input.filter').fill('archive screen');
    await expect(page.locator('.convrec:visible')).toHaveCount(1);
    // The count line is `aria-live`, so a screen reader is told too.
    // The screen's OWN count line, not the shell's `#announce` region, which
    // also carries aria-live and is empty here.
    const count = page.locator('p.convcount');
    await expect(count).toHaveAttribute('aria-live', 'polite');
    await expect(count).toContainText('1');

    // Clearing restores every row — the filter toggles `hidden` and never
    // rebuilds, so nothing a reader opened is spent by typing.
    await page.locator('input.filter').fill('');
    await expect(page.locator('.convrec:visible')).toHaveCount(6);

    await page.screenshot({ path: `e2e/screens/conversations-search-${lang}.png`, fullPage: true });
  });
}

test('the screen is reachable from the rail, under Read', async ({ page }) => {
  await open(page, '#/conversations', 'en');
  const nav = page.locator('.nav[href="#/conversations"], .nav').filter({ hasText: 'Conversations' });
  await expect(nav.first()).toBeVisible();
  await expect(page.locator('.nav[aria-current="page"]')).toContainText('Conversations');
});
