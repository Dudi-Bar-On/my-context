// @basis TASK-the-marks-card-sits-1-3-screens-below-the-fold-under-a,
// REQ-a-bounded-list-gives-the-reader-a-way-to-reach-what-it-held,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE MARKS CARD IS REACHABLE FROM A COLD LOAD** — `anchors/8`, driven in a
 * browser at the viewport the item measured at.
 *
 * ── WHY A BROWSER, AND WHY THIS VIEWPORT ────────────────────────────────
 *
 * The item is a claim about GEOMETRY and nothing else. Its evidence is three
 * numbers taken from a running page — where each card starts and how tall it
 * is — and the closing condition is the same three numbers taken again. There
 * is no shape of unit test that can answer "how far down the page is this
 * card": it is a layout, produced by a layout engine, over a font, at a size.
 *
 * `1280x1299` rather than the config's pinned `1280x720`, because that is the
 * window the owner was looking at when he reported he could not find his marks
 * and the window the item's own table was measured in. Re-measuring at a
 * different size and reporting the result would answer a question nobody asked.
 *
 * ── AND THE SCROLLER IS `main.body`, NOT THE DOCUMENT ───────────────────
 *
 * Measured here 2026-09-15 and worth stating, because it moves every number:
 * `<body>` hides its own overflow and the shell's `.body` grid area is the
 * thing that scrolls. At 1280x1299 it is **1,116px tall** — so "the fold" on
 * this screen is 183px lower than the top of the window and 183px higher than
 * the bottom, and a test that measured against `window.innerHeight` would be
 * generous by exactly the header strip.
 *
 * ── WHAT WAS MEASURED BEFORE THE CHANGE, on this repository's own corpus ──
 *
 *     card                      the item said     measured 2026-09-15
 *     Sessions                  188, h 1,302      188, h 1,339
 *     Search what was said      1,502, h 181      1,539, h 235
 *     Points you marked         1,695, h 2,082    1,786, h 2,203
 *
 * The item's figures are a fortnight of data old and two of the three have
 * moved; the SHAPE it describes is confirmed exactly. The screen also holds
 * five cards, not the three the item names — "Reconstruct a subject" at 4,001
 * and "What has been asked before" at 4,427 — and ran to 4,529px of scroll.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

/** The window the item measured in, and the one the owner reads in. */
const VIEW = { width: 1280, height: 1299 } as const;

test.use({ viewport: VIEW });

/* == THE ARCHIVE THIS FILE REQUIRES, DECLARED RATHER THAN HOPED FOR ========
 *
 * **B4 fix round 3, 2026-09-23** (`TASK-two-browser-gates-are-red-before-any-
 * lane-touches-them-and`, `TASK-forty-six-browser-failures-are-recorded-as-
 * unknown-so-the`). Until now this file rode the ambient archive: the run's
 * frozen corpus junctions `~/.claude/projects/<this repository>` when it
 * exists (`e2e/frozen-corpus.ts`), and on the machine this file was written on
 * it does. **On a clean runner it does not**, and the Ubuntu CI job on
 * `31b8e5bd` says so in the plainest possible way — all four tests here failed
 * with `page.waitForSelector: Test timeout of 30000ms exceeded`, waiting for a
 * `.convanch` card that a workspace with no conversations can never draw.
 *
 * So the file declares what it needs, the way `e2e/item-pane.spec.ts` was
 * taught to on 2026-09-23 and `e2e/anchors.spec.ts` and
 * `e2e/conversations.spec.ts` already do: its own throwaway
 * `CLAUDE_CONFIG_DIR` with its own transcripts, indexed by the real
 * `mycontext conversation rebuild`, served by its own `startUiChild`.
 *
 * -- WHAT IT NEEDS, AND WHY EACH PART IS A NUMBER AND NOT A WISH -----------
 *
 *   MANY SESSIONS  The claim under test is that a CAP on the session list
 *                  keeps the marks card on screen. A three-session archive
 *                  puts that card above the fold with no cap at all, and this
 *                  file's own anti-vacuity guard says so — it requires the
 *                  rows region to OVERFLOW its cap. `.convlistscroll` is
 *                  `max(240px, 22vh)`, which at this file's 1,299px window is
 *                  286px, so `SESSIONS` is set well past what fits: 24 rows
 *                  overflow it several times over, and the second test's
 *                  removal proof then has a real distance to fall.
 *
 *   AT LEAST ONE MARK  The card is `.convanch` and it draws anchors. They
 *                  arrive from the automatic pass inside `conversation
 *                  rebuild`, so one session carries turns that ARE anchors by
 *                  nature — a table, and a cited normative id — exactly as
 *                  `e2e/anchors.spec.ts`' fixture does, with the
 *                  `origin: { kind: 'human' }` that `ownerTyped()`
 *                  (`src/core/anchor-pass.ts`) has required on a user record
 *                  since 2026-09-15.
 *
 * **The geometry is now this FIXTURE's rather than this repository's**, and
 * that is the trade taken deliberately. The property the item is about —
 * "from a cold load the marks card names itself on screen" — is true of any
 * archive whose session list overflows the cap, and is what every assertion
 * below states. A distance measured on one maintainer's machine is not a
 * gate, which is exactly what the runner proved.
 */
const SESSIONS = 24;
const ANCHOR_SESSION = 'sess-marks-anchored';

const TABLE_TURN = [
  'Here is what was measured.',
  '',
  '| tokenizer | hits |',
  '| --- | --- |',
  '| trigram | 14 |',
  '| unicode61 | 0 |',
].join('\n');

const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';

const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
  ...(role === 'user' ? { origin: { kind: 'human' }, promptSource: 'typed' } : {}),
});

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-marks-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-marks-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  // The session that carries the marks. Two turns that ARE anchors by nature
  // and one that is not, so a pass that marked everything would show here.
  writeFileSync(path.join(dir, `${ANCHOR_SESSION}.jsonl`), jsonl([
    say('user', `follow ${RULING} here`, '2026-09-10T09:00:00.000Z'),
    say('assistant', TABLE_TURN, '2026-09-10T09:00:01.000Z'),
    say('assistant', 'the weather in the afternoon was ordinary and worth nothing',
      '2026-09-10T09:00:02.000Z'),
  ]));

  // ...and the rest of the list, which exists to be longer than the cap.
  for (let i = 0; i < SESSIONS - 1; i += 1) {
    const day = String(10 + (i % 18)).padStart(2, '0');
    const hour = String(i % 10).padStart(2, '0');
    writeFileSync(path.join(dir, `sess-marks-${String(i).padStart(2, '0')}.jsonl`), jsonl([
      say('user', `session ${i}: what did we decide about the ${i}th question`,
        `2026-08-${day}T${hour}:00:00.000Z`),
      say('assistant', `Nothing was decided in session ${i}. It exists so that the session `
        + 'list is longer than the cap this file measures.',
      `2026-08-${day}T${hour}:00:01.000Z`),
    ]));
  }

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // The index, the words and the automatic anchors all arrive from this one
    // CLI write, which is how a person meets them.
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

/** Boot the app against this file's own server, authenticated. */
async function open(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await expect(page.locator('.nav').first(),
    'the app never rendered a rail button - it probably has no token')
    .toBeVisible({ timeout: 15_000 });
}

interface Geometry {
  /** `main.body`'s own visible height — the fold, in the only units that matter. */
  readonly foldHeight: number;
  /** How far the scroller is from the top of the window. */
  readonly foldTop: number;
  /** The marks card's top, in window coordinates, from a cold load. */
  readonly marksTop: number;
  /** Its HEADING's bottom edge — the last pixel of "Points you marked". */
  readonly marksHeadBottom: number;
  /** Every card, in order, with its heading. */
  readonly cards: readonly { head: string; top: number; height: number }[];
  /** The whole scrollable length of the screen. */
  readonly scrollHeight: number;
  /** The session rows region: what it shows, and what it holds. */
  readonly rows: { clientHeight: number; scrollHeight: number; count: number } | null;
  /** How far the scroller has actually been moved. Zero is what "cold" means. */
  readonly scrollTop: number;
}

/**
 * Open Conversations from a cold load and read the geometry.
 *
 * **Nothing here scrolls anything**, which is the whole claim: `scrollTop` is
 * returned so the assertions can say, from the page's own report, that the
 * numbers they are about to use were taken before any gesture.
 */
async function geometry(page: Page): Promise<Geometry> {
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanch', { timeout: 30_000 });
  // The marks card is drawn before its rows arrive, and a card measured while
  // its list is still empty is a card 2,000px shorter than the one a reader
  // sees. Wait for the CONTENT, not for the box.
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 30_000 });
  await page.waitForSelector('.convresults .rows .convrow', { timeout: 30_000 });
  return await page.evaluate(() => {
    const body = document.querySelector('main.body');
    const marks = document.querySelector('.convanch');
    const rows = document.querySelector('.convresults .rows');
    const seen = new Set<Element>();
    const cards: { head: string; top: number; height: number }[] = [];
    // Scoped to the CURRENT screen's own section: the router keeps every screen
    // it has ever drawn inside `#screen` and merely hides the others, so a bare
    // query reaches four screens' cards and attributes them all to this one.
    const screen = document.querySelector('[data-p="conversations"]:not([hidden])')
      ?? document.querySelector('#screen') ?? document.body;
    for (const card of screen.querySelectorAll('.card.pane')) {
      if (seen.has(card)) continue;
      seen.add(card);
      const box = card.getBoundingClientRect();
      if (box.height === 0) continue;
      cards.push({
        head: (card.querySelector('h3')?.textContent ?? '').trim(),
        top: Math.round(box.top), height: Math.round(box.height),
      });
    }
    return {
      foldHeight: body === null ? -1 : body.clientHeight,
      foldTop: body === null ? -1 : Math.round(body.getBoundingClientRect().top),
      marksTop: marks === null ? -1 : Math.round(marks.getBoundingClientRect().top),
      marksHeadBottom: marks === null ? -1
        : Math.round(marks.querySelector('h3')?.getBoundingClientRect().bottom ?? -1),
      cards,
      scrollHeight: body === null ? -1 : body.scrollHeight,
      rows: rows === null ? null : {
        clientHeight: rows.clientHeight,
        scrollHeight: rows.scrollHeight,
        count: rows.querySelectorAll('.convrow').length,
      },
      scrollTop: body === null ? -1 : Math.round(body.scrollTop),
    };
  });
}

/* ══ THE MEASUREMENT THAT CLOSES THE ITEM ═════════════════════════════════ */

test('from a cold load the marks card is on the screen, with nothing scrolled', async ({ page }) => {
  await open(page);
  const at = await geometry(page);
  const fold = at.foldTop + at.foldHeight;
  console.log(`[reach] scroller main.body is ${at.foldHeight}px tall, starting at ${at.foldTop}; `
    + `the fold is therefore at ${fold}. Screen scrolls ${at.scrollHeight}px.`);
  for (const card of at.cards) {
    console.log(`[reach]   ${String(card.top).padStart(5)}  h ${String(card.height).padStart(5)}  ${card.head}`);
  }

  // **COLD MEANS COLD.** A number taken after something scrolled would be a
  // measurement of this test rather than of the screen.
  expect(at.scrollTop, 'the scroller had already moved before anything was measured, so every '
    + 'number in this test is about a page somebody had already navigated')
    .toBe(0);

  // ANTI-VACUITY, and it is the one that matters here: on a corpus with three
  // sessions the marks card would be above the fold with no cap at all, and
  // this test would pass over a screen the change never touched.
  expect(
    at.rows,
    'there is no session rows region at all, so the thing this item is about is not on the page',
  ).not.toBeNull();
  expect(
    at.rows!.scrollHeight,
    `the session list holds ${at.rows!.count} rows in ${at.rows!.scrollHeight}px and the cap is `
    + `${at.rows!.clientHeight}px — it does not overflow, so this corpus cannot exercise the `
    + 'defect and a green result here says nothing about it',
  ).toBeGreaterThan(at.rows!.clientHeight + 1);

  /*
   * **THE PROPERTY IS THAT THE CARD NAMES ITSELF ON SCREEN, not that its top
   * edge clears the fold by some particular number.** A distance is this
   * corpus's — a reader whose search card is one line taller has a smaller one
   * — and pinning it would make a data change look like a regression. What the
   * item is actually about is a reader who "could not find his marks": what
   * answers that is being able to SEE, with nothing moved, that there is a card
   * called "Points you marked" and where it is. So the assertion is on the
   * HEADING's last pixel, and the distance is printed rather than asserted.
   */
  expect(
    at.marksHeadBottom,
    `the marks card's heading ends at ${at.marksHeadBottom} and the fold is at ${fold}: it is `
    + `${at.marksHeadBottom - fold}px past the bottom of the screen from a cold load, so a `
    + 'reader who opens Conversations is shown a session picker and nothing else. That is the '
    + 'defect the owner reported — 1,156 marks drawing correctly, and unreachable.',
  ).toBeLessThanOrEqual(fold);
  console.log(`[reach] marks card top ${at.marksTop}, heading ends ${at.marksHeadBottom}, `
    + `fold ${fold} — ${fold - at.marksTop}px of the card is on screen from a cold load.`);
});

/**
 * **THE DETECTOR CAN SEE A RED, PROVED IN THE SAME RUN** — the discipline's
 * third clause, and the only honest way to read the test above.
 *
 * The cap is one declaration. This finds THAT rule in the live stylesheet,
 * removes it, and re-measures: if the marks card does not fall back below the
 * fold, then the number above was produced by something other than the change
 * and the green result is borrowed.
 *
 * **It deletes from the CSSOM rather than editing a file**, so the mutation is
 * scoped to one page in one browser, dies with it, and cannot leave a repaired
 * stylesheet behind for a sibling spec — the reason `INSTR-…` refuses a suite
 * that writes what it tests.
 */
test('and it falls back under the fold the moment the cap is removed', async ({ page }) => {
  await open(page);
  const before = await geometry(page);
  const fold = before.foldTop + before.foldHeight;

  const removed = await page.evaluate(() => {
    let gone = 0;
    for (const sheet of document.styleSheets) {
      let rules: CSSRuleList;
      try { rules = sheet.cssRules; } catch { continue; }
      for (let i = rules.length - 1; i >= 0; i -= 1) {
        const rule = rules[i];
        if (rule instanceof CSSStyleRule && rule.selectorText.includes('.convlistscroll')
          && rule.style.getPropertyValue('max-block-size') !== '') {
          sheet.deleteRule(i);
          gone += 1;
        }
      }
    }
    return gone;
  });
  // **THE REMOVAL LANDED**, asserted before anything is concluded from it. A
  // mutation that silently matched nothing would make the assertion below a
  // second reading of the unchanged page.
  expect(removed, 'no rule capping `.convlistscroll` was found in the live stylesheet, so '
    + 'nothing was removed and the re-measurement below is of the same page').toBe(1);

  await expect
    .poll(async () => (await geometry(page)).marksHeadBottom, { timeout: 10_000 })
    .toBeGreaterThan(fold);
  const after = await geometry(page);
  console.log(`[reach] cap removed: marks card ${before.marksTop} -> ${after.marksTop} `
    + `(fold ${fold}); session rows ${before.rows?.clientHeight} -> ${after.rows?.clientHeight}px.`);
  expect(after.rows!.clientHeight, 'the rows region did not grow when its cap was deleted, so '
    + 'the rule that was removed was not the one doing the work')
    .toBeGreaterThan(before.rows!.clientHeight);
});

/* ══ AND NOTHING WAS HIDDEN TO ACHIEVE IT ═════════════════════════════════ */

test('every session the list held is still in it, reachable inside the card', async ({ page }) => {
  await open(page);
  const at = await geometry(page);
  // The item forbids option 2 (marks first) outright and warns against option 1
  // (collapse past a few rows) for HIDING a list some readers scan. A cap that
  // truncated instead of scrolling would be option 1 wearing option 4's name.
  const bound = (await page.locator('.convresults .bound p').first().textContent() ?? '').trim();
  console.log(`[reach] ${at.rows!.count} rows drawn, bound line reads "${bound}"`);
  expect(at.rows!.count, 'the capped list drew no rows at all').toBeGreaterThan(0);
  expect(
    bound,
    'the bound line no longer reports the number of rows actually drawn, so the height cap has '
    + 'changed what the list CONTAINS rather than only what it shows at once',
  ).toContain(String(at.rows!.count));

  // The last row is reachable by scrolling INSIDE the card — the whole of what
  // "scrolls inside its own card" means, and the thing a truncation could not do.
  const reached = await page.evaluate(() => {
    const rows = document.querySelector('.convresults .rows');
    if (rows === null) return null;
    const last = rows.querySelector('.convrow:last-of-type');
    const before = rows.scrollTop;
    rows.scrollTop = rows.scrollHeight;
    const box = last === null ? null : last.getBoundingClientRect();
    const frame = rows.getBoundingClientRect();
    return {
      moved: rows.scrollTop > before,
      lastVisible: box !== null && box.bottom <= frame.bottom + 1 && box.top >= frame.top - 1,
    };
  });
  expect(reached, 'the rows region vanished mid-test').not.toBeNull();
  expect(reached!.moved, 'the card did not scroll at all, so its rows are capped and '
    + 'unreachable — which is the defect this change was made to remove, moved inward').toBe(true);
  expect(reached!.lastVisible, 'the last session is not reachable by scrolling inside the card')
    .toBe(true);
});

test('the bounded list is keyboard-operable, because it is now a scroll region', async ({ page }) => {
  await open(page);
  await geometry(page);
  // A scroller a wheel can move and a keyboard cannot is a list half this
  // product's readers cannot reach — `.tvscroll`'s own reason for the same
  // three attributes.
  const shape = await page.evaluate(() => {
    const rows = document.querySelector<HTMLElement>('.convresults .rows');
    if (rows === null) return null;
    return {
      tabIndex: rows.tabIndex,
      role: rows.getAttribute('role'),
      label: rows.getAttribute('aria-label') ?? '',
    };
  });
  expect(shape, 'no rows region').not.toBeNull();
  expect(shape!.tabIndex, 'the scroll region is not focusable, so a keyboard cannot scroll it')
    .toBe(0);
  expect(shape!.role, 'the scroll region has no role, so a screen reader announces it as nothing')
    .toBe('region');
  expect(shape!.label.length, 'the scroll region has no accessible name, so it is announced as '
    + '"region" and a reader is told only that something is there').toBeGreaterThan(0);

  const moved = await page.evaluate(async () => {
    const rows = document.querySelector<HTMLElement>('.convresults .rows');
    if (rows === null) return false;
    rows.scrollTop = 0;
    rows.focus();
    return document.activeElement === rows;
  });
  expect(moved, 'the rows region refused focus').toBe(true);
  await page.keyboard.press('PageDown');
  await expect.poll(async () => await page.evaluate(
    () => document.querySelector('.convresults .rows')?.scrollTop ?? 0,
  ), { timeout: 5_000 }).toBeGreaterThan(0);
});
