// @basis TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and,
// REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held,
// INV-nothing-is-dropped-silently
/**
 * **THE TWO DEFECTS THAT ONLY EXIST AT SIZE**, driven in a browser over an
 * archive big enough to have them.
 *
 * `TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and` names
 * both, and neither can be seen in `e2e/anchors.spec.ts`: that fixture holds
 * two marked points and six turns, so the list never reaches a cap and the
 * document's find box never has anything to re-derive. A defect measured at
 * 684 rows needs 684 rows, which is why this file seeds its own archive rather
 * than adding to that one.
 *
 * ── WHAT WAS MEASURED, BEFORE AND AFTER, ON 2026-09-13 ────────────────────
 *
 * On a seeded 28,001-record session with 884 marked points, Chromium at
 * 1280x720:
 *
 *                                        before            after
 *   elements in `.convanchorsbox`        16,799               392
 *   the card's share of the screen         97.8%             51.7%
 *   a page control on the list                no               yes
 *   document redraws per 10 keystrokes         10                 1
 *   synchronous cost of one keystroke   4.6-23.6 ms      0.0-0.1 ms
 *
 * **And one figure did NOT reproduce.** The item records 1,097-2,017 ms per
 * keystroke. Measured here at the same record count the cost of one settled
 * keystroke in the anchors box was 340-354 ms before the paging and 300-326
 * after, of which 250 is the settle itself. The unpaged node count reproduced
 * exactly; the keystroke figure did not, and it is written down as not
 * reproduced rather than repeated.
 *
 * ── THE FIXTURE WRITES, SO IT WRITES SOMEWHERE OF ITS OWN ─────────────────
 *
 * A scratch home and a scratch workspace, per `e2e/app.ts`' case 2: a spec
 * that needs ONE SPECIFIC STATE arranges it in a workspace of its own and
 * serves THAT. The anchors arrive through `.anchors.jsonl`, which
 * `core/anchor-file.ts` calls "the one durable copy of the bookmarks and the
 * truth the `anchors` table is rebuilt from", so `conversation rebuild` puts
 * them in the table exactly as a real archive's would be.
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
import { writeAnchorFile } from '../src/core/anchor-file.ts';

const SESSION = 'sess-paged';
/**
 * Enough turns that a filter has real work to re-derive, and few enough that
 * the fixture builds in under a second. The DEFECT does not need 28,001
 * records to show — one redraw per keystroke against ten is the same count at
 * any size — and the measured numbers above were taken at the owner's scale
 * and are recorded rather than re-measured on every run.
 */
const ROUNDS = 80;
/**
 * Past `BOUND_CAP_LIST`, which is 20, by enough to make a third page. A cap
 * tripped by exactly one row would pass a paging test that could only ever
 * show one step.
 */
const ANCHORS = 47;
const CAP = 20;

function jsonl(rows: unknown[]): string {
  return rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
}

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 8, 9, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'The paged archive' });
  for (let i = 0; i < ROUNDS; i += 1) {
    rows.push({
      type: 'user',
      message: { role: 'user', content: `round ${i}: keep going` },
      timestamp: at(i * 2),
      gitBranch: 'master',
    });
    rows.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: `answer ${i}` }] },
      timestamp: at(i * 2 + 1),
    });
  }
  return rows;
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-paged-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-paged-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(session()));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // The bookmarks go into the file that is the truth, then the table is
    // re-derived from it — the direction `reconcileAnchors` takes whenever the
    // file exists, and the one a real archive is in.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      Array.from({ length: ANCHORS }, (_, i) => ({
        id: `paged${String(i).padStart(4, '0')}`,
        sessionId: SESSION,
        agentId: null,
        byteOffset: i * 32,
        label: `marked point ${i}`,
        kind: (['note', 'table', 'report', 'ruling'] as const)[i % 4] ?? 'note',
        origin: 'owner',
        at: new Date(Date.UTC(2026, 8, 8, 9, 0, i)).toISOString(),
        note: null,
      })));
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

async function open(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  // **The boot is checked HERE and not after the content wait.** `#exited` is
  // a fixed overlay the app raises when a heartbeat fails, and this file opens
  // a fresh page twelve times against one server; asserting it at the END of
  // `open` puts a twenty-second window between the boot and the check in which
  // an unrelated tick can raise it, which is how this assertion failed once in
  // a full run and passed alone. Checked at the boot it means what it says,
  // and an overlay raised later still fails every assertion below it, because
  // it physically intercepts the clicks.
  await expect(page.locator('#exited')).toBeHidden();
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
}

/* ══ THE MARKED POINTS LIST IS BOUNDED ════════════════════════════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`the marked points draw one page, not all of them (${lang})`, async ({ page }) => {
    await open(page, lang);
    const box = page.locator('.convanchorsbox');

    // The claim the item makes is about the DOM, so the assertion is about the
    // DOM: 47 rows of 17-19 elements each is what made this card 92% of the
    // page, and one page of them is not.
    await expect(box.locator('.convanchor'),
      `${ANCHORS} marked points draw ${CAP} rows, not ${ANCHORS}`).toHaveCount(CAP);
    const elements = await box.evaluate((n) => n.querySelectorAll('*').length);
    expect(elements, 'one page of rows is a fraction of the whole list').toBeLessThan(700);

    // **AND THE ONES IT HELD BACK ARE REACHABLE.**
    // `REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held`: a
    // list that caps and offers nothing is the defect this file's own header
    // opens with — "Showing entries 0-50 of 24,757 with NO WAY TO REACH ENTRY
    // 51" — and it is what a discarded `boundedList` return value produces.
    const bound = box.locator('.bound');
    await expect(bound, 'the capped list declares its bound').toBeVisible();
    await expect(bound.locator('p'), 'the bound line says how many there are')
      .toContainText(String(ANCHORS));
    await expect(bound.locator('button[data-step="prev"]'),
      'there is nowhere before the first page').toBeDisabled();
    await expect(bound.locator('button[data-step="next"]')).toBeEnabled();
  });

  test(`a page step shows rows the first page did not (${lang})`, async ({ page }) => {
    await open(page, lang);
    const box = page.locator('.convanchorsbox');
    const first = await box.locator('.convanchorlabel').allInnerTexts();

    await box.locator('.bound button[data-step="next"]').click();
    const second = await box.locator('.convanchorlabel').allInnerTexts();
    expect(second, 'a step lands on a page of its own').not.toEqual(first);
    expect(second.length, 'a middle page is still one page').toBe(CAP);
    // Row numbers rather than "the first N", which has stopped being true.
    await expect(box.locator('.bound p')).toContainText(`21`);

    await box.locator('.bound button[data-step="prev"]').click();
    expect(await box.locator('.convanchorlabel').allInnerTexts(),
      'the step back returns the page it came from').toEqual(first);

    // The escape hatch is still the escape hatch: everything, on request.
    await box.locator('.bound button:not([data-step])').click();
    await expect(box.locator('.convanchor'),
      'show-all is the reader asking for the whole list and getting it')
      .toHaveCount(ANCHORS);
  });
}

test('narrowing the list says what it narrowed, not only what survived', async ({ page }) => {
  await open(page, 'en');
  const count = page.locator('.convanchcount');
  await expect(count).toContainText(String(ANCHORS));

  // The second half of the item: a filtered list read "1 marked." where every
  // other list in the product says "the first N of M", so a reader who
  // narrowed lost the size of the thing they were narrowing.
  await page.locator('input.convanchfind').fill('marked point 31');
  await expect(page.locator('.convanchorsbox .convanchor')).toHaveCount(1, { timeout: 20_000 });
  await expect(count, 'the narrowed count still carries the whole')
    .toContainText(`1 of ${ANCHORS}`);
});

/* ══ THE DOCUMENT'S FIND BOX SETTLES ══════════════════════════════════════ */

test('typing a query redraws the document once, not once per character', async ({ page }) => {
  await open(page, 'en');
  await page.locator('.convrow').first().click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  // Past the mount's own hold to the end, so what is counted is the typing.
  await page.waitForTimeout(4_000);

  /**
   * **Every re-derivation of the view rewrites the count line wholesale**
   * (`reView` calls `count.replaceChildren`), so a mutation there is one whole
   * redraw of the document — every drawn row torn out and rebuilt, the reader
   * thrown back to the top, the marked passage discarded. Counting mutations
   * is counting redraws, which is the thing the settle exists to bound.
   */
  const redraws = await page.evaluate(async () => {
    const input = document.querySelector('input.tvfind') as HTMLInputElement | null;
    const line = document.querySelector('p.tvcount');
    if (input === null || line === null) return -1;
    let seen = 0;
    const watch = new MutationObserver(() => { seen += 1; });
    watch.observe(line, { childList: true });
    const needle = 'keep going';
    for (let i = 1; i <= needle.length; i += 1) {
      input.value = needle.slice(0, i);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      // About the gap between two keystrokes for a person typing at speed.
      await new Promise((r) => { setTimeout(r, 120); });
    }
    await new Promise((r) => { setTimeout(r, 1_500); });
    watch.disconnect();
    return seen;
  });

  expect(redraws, 'ten characters typed at speed are one search, not ten')
    .toBeLessThanOrEqual(2);
  expect(redraws, 'and the search still happened').toBeGreaterThan(0);
  // The answer is the one the last character asked for, not an earlier one.
  await expect(page.locator('p.tvcount')).toContainText(String(ROUNDS));
});
