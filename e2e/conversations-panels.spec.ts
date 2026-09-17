// @basis TASK-the-navigation-controls-still-crowd-the-strip-and-they-are,
// TASK-the-copy-controls-are-four-buttons-and-a-sentence-and-they,
// TASK-the-find-options-the-owner-asked-for-twice-in-a-floating,
// TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so,
// TASK-every-write-on-conversations-throws-focus-to-the-document,
// INV-nothing-is-dropped-silently,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE NAVIGATION PANEL AND THE COPY PANEL** — `semantic/12` and
 * `semantic/13`, the second and third of the three the owner specified on
 * 2026-09-16: *"three different subjects on three different dialogs opend from
 * the right mouse button menu, could be a little bit transparent, movable on
 * screen, stays on screen while you can look at the viewer and closed uppon
 * clicking it's close button as a standard window."*
 *
 * ── WHAT THIS FILE OWNS AND WHAT IT DOES NOT ─────────────────────────────
 *
 * `test/ui/panel.test.ts` owns the FRAME's rules — the stored place, the
 * clamp, what happens when the store lies. `e2e/conversations-find-panel.
 * spec.ts` owns the SEARCH panel. Neither is repeated here. What is here is
 * the two facts that only exist once there is more than one caller:
 *
 *   — **THERE IS NO STRIP.** `semantic/12`/`13` LENT the controls, so with
 *     every panel shut the card was exactly as big as it was before any of
 *     that work. The owner looked at it and asked for the other half:
 *     *"the card itself is still big and contains all the buttons and
 *     controls that should be removed because the functions now works from
 *     the floating dialogs"*. `semantic/15` deleted `.tvbar` and `.tvnav` and
 *     gave every control ONE home, in the panel that owns its subject.
 *   — **NOTHING COMES BACK, AND THAT IS WHAT IS ASSERTED NOW.** Tests 2, 3
 *     and 5 used to prove the lend and the restore; they prove the opposite
 *     contract, and they are the reason this file was rewritten rather than
 *     deleted — a suite that stopped asserting anything about the strip would
 *     not notice a control quietly reappearing on the card.
 *   — **AND THE DISCLOSURE IS STILL SOMEWHERE.** `INV-nothing-is-dropped-
 *     silently` was what made the lend the right answer in September;
 *     `semantic/15` replaces it with a stronger one — a line under *"Back to
 *     all sessions"* drawn exactly when a filter is actually hiding
 *     something, and drawn with every panel shut. Test 3 is that.
 *
 * ── THE FIXTURE, AND WHY EACH PART OF IT IS THERE ────────────────────────
 *
 *   — **`MARKS` marked points at REAL byte offsets**, so the mark count is a
 *     number that moves rather than the empty sentence. Offsets are computed
 *     from the bytes actually written, never guessed.
 *   — **Turns of his own**, so the "N message(s) of yours here" count is real
 *     and its HIDDEN clause — the disclosure this item is about — can be
 *     driven.
 *   — **HEBREW IN THE TRANSCRIPT ITSELF**, and that is not decoration. Three
 *     separate lanes were caught in one week by ASCII-only fixtures on these
 *     very files: a byte offset computed from a character count is right
 *     until a fixture holds a two-byte character, and then every mark in the
 *     document resolves to the wrong node. `Buffer.byteLength` is what this
 *     file uses and the Hebrew is what makes that a claim rather than a
 *     coincidence.
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
import { anchorIdFor } from '../src/core/anchors.ts';

const SESSION = 'sess-three-panels';
/** How many points are marked, so the mark count is a number that moves. */
const MARKS = 12;
/** One turn in six is his, so the "your messages" count is real. */
const EVERY = 6;
const TURNS = 72;
/** The word every English turn holds, so a query narrows the document. */
const COMMON = 'archive';
/** Hebrew in the fixture. See the header: an ASCII fixture cannot carry a RED. */
const HEB = 'שורה של טקסט בעברית';

const jsonl = (rows: unknown[]): string => `${rows.map((r) => JSON.stringify(r)).join('\n')}\n`;

/** The transcript, and the byte each of its lines begins at. */
function transcript(): { text: string; offsets: number[] } {
  const rows: unknown[] = [];
  const filler = 'This turn is long enough that the well has to virtualise it. '.repeat(10);
  for (let i = 0; i < TURNS; i += 1) {
    const mine = i % EVERY === 0;
    // Every THIRD answer holds the Hebrew, so the offsets of everything after
    // it are shifted by a two-byte character and a character-count offset
    // would land on the wrong record.
    const body = mine
      ? `Turn ${String(i).padStart(3, '0')}: a question I typed about the ${COMMON}.`
      : `${filler}Turn ${String(i).padStart(3, '0')} is an answer about the ${COMMON}.`
        + `${i % 3 === 0 ? ` ${HEB}.` : ''} ${filler}`;
    rows.push({
      type: mine ? 'user' : 'assistant',
      message: {
        role: mine ? 'user' : 'assistant',
        content: mine ? body : [{ type: 'text', text: body }],
      },
      timestamp: new Date(Date.UTC(2026, 8, 12, 9, 0, i)).toISOString(),
      ...(mine ? { gitBranch: 'master' } : {}),
    });
  }
  const offsets: number[] = [];
  let at = 0;
  for (const row of rows) {
    offsets.push(at);
    at += Buffer.byteLength(JSON.stringify(row), 'utf8') + 1;
  }
  return { text: jsonl(rows), offsets };
}

let harness: UiHarness;
let cwd = '';
let home = '';

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-panels-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-panels-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const built = transcript();
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), built.text);
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // **THE ID IS DERIVED, because in this product it always is** —
    // `anchorIdFor(sessionId, agentId, byteOffset)` is what `markAnchor`
    // composes, and a hand-written id is a row nothing the product could make.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      Array.from({ length: MARKS }, (_, i) => {
        const record = 1 + (i * 5);
        return {
          id: anchorIdFor(SESSION, null, built.offsets[record] as number),
          sessionId: SESSION,
          agentId: null,
          byteOffset: built.offsets[record] as number,
          label: `mark ${String(i).padStart(2, '0')}`,
          kind: 'note',
          origin: 'owner' as const,
          at: new Date(Date.UTC(2026, 8, 11, 9, 0, i)).toISOString(),
          note: null,
        };
      }));
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

async function dismissSkew(page: Page): Promise<void> {
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.locator('button').first().click().catch(() => {});
  }
}

async function openDocument(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await dismissSkew(page);
  await page.evaluate((s) => { location.hash = `#/conversations/${s}`; }, SESSION);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  await dismissSkew(page);
  // The counts arrive one fetch after the mount. Waiting for the NUMBER rather
  // than for the element is what makes the assertions below about a loaded
  // document rather than about a race.
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(MARKS), { timeout: 20_000 });
}

/**
 * Open one panel the way a reader does: right-click a turn, then the row.
 *
 * **ANCHORED ON THE SEARCH ROW, WHICH IS THE ONE ROW THAT NAMES ITSELF.**
 * `conv.find.open` carries `aria-keyshortcuts="/"`, so it can be found in
 * either language without reading its words — which is how
 * `e2e/conversations-find-panel.spec.ts` already addresses it. The other two
 * panels deliberately have no key of their own (see the menu's own note), so
 * they are addressed by their POSITION beside it: search, navigate, copy, in
 * the order the owner named them. That ordering is itself asserted, in test 6,
 * by the three panels the three rows actually open.
 *
 * It cannot be the LAST three rows: the kind radios are appended after them
 * whenever a document holds more than one kind of mark.
 */
const PANEL_AFTER_SEARCH = { search: 0, navigate: 1, copy: 2 };

async function openPanel(page: Page, which: 'search' | 'navigate' | 'copy'): Promise<void> {
  // A live selection is the one case the menu deliberately yields to the
  // browser's own, so it is cleared before the gesture rather than after a
  // confusing failure.
  await page.evaluate(() => { document.getSelection()?.removeAllRanges(); });
  await page.locator('.tvrow .tvsaid').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  const rows = page.locator('.tvmenu .tvmenuitem');
  const at = await rows.evaluateAll((els) =>
    els.findIndex((el) => el.getAttribute('aria-keyshortcuts') === '/'));
  expect(at, 'the search row is not in the menu, so the panel rows cannot be found')
    .toBeGreaterThanOrEqual(0);
  await rows.nth(at + PANEL_AFTER_SEARCH[which]).click();
  await expect(page.locator(`dialog.mcpanel[data-panel="${which}"][open]`))
    .toHaveCount(1, { timeout: 10_000 });
}

/**
 * **THE CHROME ABOVE THE VIEWER, FROM `.tvhead`** — the metric `semantic/15`
 * fixes on, because the two lanes before it used different ones and their
 * numbers could not be compared. `.tvbar` no longer exists, so the old
 * bar-relative reading is not a number this build can produce at all; the
 * successor is the whole distance from the top of the card to the top of the
 * well, which is what the owner is looking at.
 */
const chromeAboveViewer = (page: Page): Promise<number> =>
  page.evaluate(() => {
    const head = document.querySelector('.tvhead')!.getBoundingClientRect();
    const well = document.querySelector('.tvscroll')!.getBoundingClientRect();
    return Math.round((well.top - head.top) * 10) / 10;
  });

/** The find box, wherever it is. Since `semantic/15` it is in the panel. */
const findBox = (page: Page) =>
  page.locator('dialog.mcpanel[data-panel="search"] .tvfind');

/**
 * **TO THE TOP, THROUGH THE PANEL THAT NOW OWNS `Top`, AND SHUT AGAIN.**
 *
 * The well opens at the END of the document (`redraw('end')`), so a reader who
 * presses N there is already past the last mark and gets *"Nothing is marked
 * after this point"* — the correct answer and a useless measurement. `Top` was
 * a `.tvjump` in `.tvbar` until `semantic/15`; it is in the step panel now,
 * and the panel is shut again because every keyboard assertion below is about
 * what happens with NOTHING open.
 */
async function toTop(page: Page): Promise<void> {
  await openPanel(page, 'navigate');
  await page.locator('dialog.mcpanel[data-panel="navigate"] .tvtop').click();
  await page.locator('dialog.mcpanel[data-panel="navigate"] .mcpanelclose').click();
  await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
  await page.waitForTimeout(700);
}

for (const lang of ['en', 'he'] as const) {
  /* ══ 1 — BOTH OPEN FROM THE MENU AND NEITHER MAKES THE PAGE INERT ═══════ */

  test(`the navigation and copy panels open from the right-click menu and leave the viewer live (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    for (const which of ['navigate', 'copy'] as const) {
      await openPanel(page, which);
      const panel = page.locator(`dialog.mcpanel[data-panel="${which}"]`);
      /*
       * **`show()` AND NEVER `showModal()`.** *"stays on screen while you can
       * look at the viewer"* — a modal dialog makes the page behind it inert,
       * so the viewer would be dead while the panel is open. `:modal` is the
       * engine's own answer to which call was made.
       */
      expect(await panel.evaluate((d) => (d as HTMLDialogElement).open)).toBe(true);
      expect(await panel.evaluate((d) => d.matches(':modal')),
        `${which}: showModal() was called and the viewer behind it is now inert`).toBe(false);
    }
    // And the viewer really answers with BOTH open, which a modal blocks.
    const moved = await page.locator('.tvscroll').evaluate((el) => {
      const before = el.scrollTop;
      el.scrollTop = 900;
      return el.scrollTop !== before;
    });
    expect(moved, 'the viewer did not scroll with two panels open').toBe(true);
    await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(2);
  });

  /* ══ 2 — THE CARD GIVES UP ITS CONTROLS, AND THEY DO NOT COME BACK ═════ */

  test(`the card carries no control strip at all, and every control is in the panel that owns it (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **THE OWNER'S OWN ACCEPTANCE TEST, RE-AIMED.** `semantic/12` asked "did
     * the strip shrink"; he answered that on 2026-09-17 by pointing out that
     * with every panel SHUT it had not shrunk at all, because the controls
     * were lent rather than moved. So what is asserted here is the stronger
     * thing: the strips are not short, they are NOT THERE, and they are not
     * there in the state he was looking at — nothing open.
     */
    const idle = await chromeAboveViewer(page);
    console.log(`[card ${lang}] chrome above the viewer, every panel shut: ${idle}px`);
    expect(await page.locator('.tvbar').count(),
      'the button bar is still on the card').toBe(0);
    expect(await page.locator('.tvnav').count(),
      'the stepper strip is still on the card').toBe(0);
    expect(await page.locator('p.tvmenuhint').count(),
      'the right-click instruction line is still on the card').toBe(0);
    expect(await page.locator('p.tvcopyhint').count(),
      'the copy instruction line is still on the card').toBe(0);
    expect(await page.locator('.tvcopyh').count(),
      'the copy caption is still drawn — the panel header is the same words').toBe(0);

    /*
     * **AND THE CARD IS THE HEAD, A COLLAPSED FOLD, AND THE WELL.** Named
     * rather than counted, so that a control creeping back is a red line and
     * not a number nobody reads. `p.tvcount` and `p.tvnavsaid` are on the card
     * too and are `hidden` until they have something to say; `[hidden]
     * {display:none}` gives them no height, which is why the sum below is only
     * the two visible boxes.
     */
    const stack = await page.evaluate(() => [...document.querySelectorAll('.tvroot > *')]
      .filter((el) => (el as HTMLElement).offsetParent !== null
        && el.getBoundingClientRect().height > 0)
      .map((el) => el.className));
    console.log(`[card ${lang}] what is drawn above and below the well: ${JSON.stringify(stack)}`);
    for (const gone of ['tvbar', 'tvnav ', 'tvmenuhint', 'tvcopyhint']) {
      expect(stack.join(' | ').includes(gone), `${gone} is drawn on the card`).toBe(false);
    }

    // And each control is IN the panel it belongs to rather than merely gone,
    // which is the half a "did it shrink" assertion cannot tell from a break.
    for (const which of ['search', 'navigate', 'copy'] as const) await openPanel(page, which);
    const inPanel = async (which: string, selector: string): Promise<number> =>
      page.locator(`dialog.mcpanel[data-panel="${which}"]`).locator(selector).count();
    for (const selector of ['.tvfind', '.tvnavfounds', '.mcpanelclear']) {
      expect(await inPanel('search', selector), `${selector} is not in the search panel`).toBe(1);
    }
    for (const selector of ['.tvnavh', '.tvnavmarks', '.tvnavyous', '.tvtop', '.tvend',
      '.tvwhole']) {
      expect(await inPanel('navigate', selector), `${selector} is not in the step panel`).toBe(1);
    }
    for (const selector of ['.tvcopymsg', '.tvcopyseen', '.tvcopyraw', '.tvrecall', 'p.tvcopied']) {
      expect(await inPanel('copy', selector), `${selector} is not in the copy panel`).toBe(1);
    }
    /*
     * **AND THE PANEL SAYS EACH THING ONCE.** `.tvcopyh` used to be lent into
     * this panel and removed again on every open, purely so that the caption
     * did not stand beside a header reading the same words. `semantic/15`
     * deleted the element instead; this is what would notice it coming back.
     */
    expect(await inPanel('copy', '.tvcopyh'),
      'the caption is drawn again inside a panel whose header is the same words').toBe(0);

    /*
     * ── AND NOTHING COMES HOME, WHICH IS THE WHOLE OF THIS ITEM ──────────
     *
     * Every panel is shut again and the card is measured a second time. Under
     * the lend, this is the measurement that was IDENTICAL to the one before
     * the panels were opened — because the controls came back. It must now be
     * identical for the opposite reason: there is nowhere for them to come
     * back to.
     */
    for (const which of ['search', 'navigate', 'copy'] as const) {
      await page.locator(`dialog.mcpanel[data-panel="${which}"] .mcpanelclose`).click();
      await expect(page.locator(`dialog.mcpanel[data-panel="${which}"][open]`)).toHaveCount(0);
    }
    expect(await page.locator('.tvbar').count(),
      'the button bar came back when the panels closed').toBe(0);
    expect(await page.locator('.tvnav').count(),
      'the stepper strip came back when the panels closed').toBe(0);
    expect(await chromeAboveViewer(page),
      'the card grew after the panels were opened and shut').toBe(idle);
  });

  /* ══ 3 — THE DISCLOSURE IS ON THE CARD, AND ONLY WHEN IT HAS ONE ═══════ */

  test(`the line under Back to all sessions appears when a filter is hiding something and at no other time (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const line = page.locator('p.tvcount');

    /*
     * **THE ORDINARY CARD CARRIES NO COUNT LINE.** The owner chose this shape
     * from three: *"only when they have something to disclose"*. A plain
     * total — "641 marked point(s) here." — hides nothing from anybody and
     * lives in the step panel.
     */
    expect(await line.evaluate((el) => (el as HTMLElement).hidden),
      'the card draws a count line with nothing filtered').toBe(true);

    /*
     * **AND IT IS UNDER THE "Back to all sessions" BUTTON**, which is where he
     * put it: *"bring the text under the \"Back to all sessions\" button,
     * then under it open the viewer"*.
     */
    const order = await page.evaluate(() => {
      const kids = [...document.querySelectorAll('.tvroot > *')].map((el) => el.className);
      return { head: kids.indexOf('tvhead'), count: kids.indexOf('tvcount') };
    });
    expect(order.count, 'the disclosure is not on the card at all').toBeGreaterThan(-1);
    expect(order.count, 'the disclosure is not under the head that holds Back')
      .toBe(order.head + 1);

    /*
     * **NOW HIDE SOMETHING.** `INV-nothing-is-dropped-silently` is what this
     * line discharges, so the one state that matters is: a search is holding
     * turns back, EVERY PANEL IS SHUT, and the reader is told.
     */
    await openPanel(page, 'search');
    await findBox(page).fill(COMMON);
    await page.waitForTimeout(2_500);
    await page.locator('dialog.mcpanel[data-panel="search"] .mcpanelclose').click();
    await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);

    expect(await line.evaluate((el) => (el as HTMLElement).hidden),
      'a search is hiding turns and the card says nothing about it, with every panel shut')
      .toBe(false);
    const said = (await line.textContent() ?? '').trim();
    console.log(`[disclosure ${lang}] ${said}`);
    expect(said, 'the disclosure names no number at all').toMatch(/\d/);

    /*
     * **AND THE CONDITION IS "IS SOMETHING HIDDEN", NEVER "IS A PANEL OPEN".**
     * This is the item's own sentence and it is the one way this could be
     * built wrong while looking right: opening the panel must not take the
     * disclosure down, because the search is still hiding the same turns.
     */
    await openPanel(page, 'navigate');
    expect(await line.evaluate((el) => (el as HTMLElement).hidden),
      'the disclosure hid because a panel opened, which is the same defect wearing a '
      + 'different trigger').toBe(false);
    expect((await line.textContent() ?? '').trim(),
      'the disclosure changed because a panel opened').toBe(said);

    // And it goes down again when nothing is hidden — a line that stayed up
    // saying "0 hidden" is the measured-zero rule pointed the wrong way.
    await openPanel(page, 'search');
    await findBox(page).fill('');
    await page.waitForTimeout(2_500);
    expect(await line.evaluate((el) => (el as HTMLElement).hidden),
      'the disclosure stayed up after the search was cleared').toBe(true);
  });

  /* ══ 3a — THE VIEWER ON THE WHOLE SCREEN ══════════════════════════════ */

  test(`the viewer expands to the whole screen and comes back, and the panels survive it (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **`semantic/15` §5, AND THE PATTERN IS `#panefloat`.** The owner:
     * *"you can make the viewer to apear on the whole screen in a simmilar way
     * you did it for the items in the right pane"*. `index.html:322` is the
     * control he means — `class="icon"`, `aria-pressed`, `⤢` — `app.js`'s
     * `setPaneFloat` is the mode, and a mode is not written down.
     *
     * **AND HIS CLARIFICATION, WHICH IS WHAT THE SECOND HALF OF THIS TEST IS
     * FOR:** *"the difference is that the right pane could be totally closed
     * while the viewer should only retund to be displayd as embeded but not
     * closed"*. The item pane's toolbar is TWO controls; the viewer gets the
     * first and never the second. There are exactly two states.
     */
    const wide = page.locator('button.tvwide');
    const shell = (): Promise<Record<string, string>> => page.evaluate(() => ({
      hdr: getComputedStyle(document.querySelector('.hdr')!).display,
      rail: getComputedStyle(document.querySelector('.rail')!).display,
      prov: getComputedStyle(document.querySelector('.prov')!).display,
      strip: getComputedStyle(document.querySelector('.strip')!).display,
      cls: document.getElementById('app')!.className,
    }));
    const well = (): Promise<{ w: number; h: number }> => page.locator('.tvscroll')
      .evaluate((n) => {
        const b = n.getBoundingClientRect();
        return { w: Math.round(b.width), h: Math.round(b.height) };
      });
    const fits = (): Promise<boolean> => page.evaluate(() => {
      const b = document.querySelector('.body')!;
      return b.scrollHeight <= b.clientHeight + 2;
    });

    // Three panels open BEFORE the expansion, because what has to survive it
    // is their open state, their place and their being inside the window.
    for (const which of ['search', 'navigate', 'copy'] as const) await openPanel(page, which);
    const place = (): Promise<unknown[]> => page.evaluate(() => {
      const vw = document.documentElement.clientWidth;
      return [...document.querySelectorAll('dialog.mcpanel')].map((d) => {
        const r = d.getBoundingClientRect();
        return {
          p: (d as HTMLElement).dataset['panel'],
          open: (d as HTMLDialogElement).open,
          // The place is LOGICAL: measured from the right edge in Hebrew,
          // which is the frame's own rule and the one `semantic/12` proved.
          start: Math.round(document.documentElement.getAttribute('dir') === 'rtl'
            ? vw - r.right : r.left),
          top: Math.round(r.top),
          inside: r.top >= 0 && r.left >= 0 && r.right <= vw + 1
            && r.top <= window.innerHeight,
        };
      });
    });

    const before = { shell: await shell(), well: await well(), panels: await place() };
    expect(await wide.getAttribute('aria-pressed')).toBe('false');
    expect(before.shell['hdr'], 'the shell is already hidden, so this measures nothing')
      .not.toBe('none');

    await wide.click();
    const during = { shell: await shell(), well: await well(), panels: await place() };
    console.log(`[wide ${lang}] well ${JSON.stringify(before.well)} -> `
      + `${JSON.stringify(during.well)}`);

    // ── THE EXPANSION ────────────────────────────────────────────────────
    for (const part of ['hdr', 'rail', 'prov', 'strip']) {
      expect(during.shell[part], `${part} is still drawn in the expanded state`).toBe('none');
    }
    expect(during.shell['cls']).toContain('doc-wide');
    expect(await wide.getAttribute('aria-pressed'), 'the control does not report its own state')
      .toBe('true');
    expect(during.well.h, 'the viewer did not get taller').toBeGreaterThan(before.well.h);
    expect(during.well.w, 'the viewer did not get wider').toBeGreaterThan(before.well.w);
    /*
     * **AND §4 HOLDS IN BOTH STATES, WHICH THE ITEM ASKS FOR BY NAME.**
     * Expansion changes the height `.body` gives `.tvroot`, which is exactly
     * the dimension the outer-scroll bug lived in.
     */
    expect(await fits(), 'the expanded layout overflows `.body`, which is the outer scroll back')
      .toBe(true);

    // ── THE PANELS ───────────────────────────────────────────────────────
    expect(during.panels, 'a panel moved, closed or was stranded by the expansion')
      .toEqual(before.panels);

    // ── AND THERE IS NO WAY TO REMOVE THE VIEWER ─────────────────────────
    /*
     * The item pane can close because the list behind it is still there. The
     * conversation viewer IS the screen — closing it would leave nothing to
     * return to — so it gets `#panefloat` and never `#paneclose`. The two
     * labels are the only thing telling a screen-reader user which state they
     * are in, and `aria-pressed` is the only state this button carries.
     */
    const controls = await page.locator('.tvroot > .tvhead button')
      .evaluateAll((els) => els.map((e) => e.className));
    console.log(`[wide ${lang}] the head's controls: ${JSON.stringify(controls)}`);
    expect(controls.some((c) => c.includes('tvclose')),
      'the viewer grew a control that removes it, which is a state with no way back').toBe(false);
    await expect(page.locator('.tvroot'), 'the viewer is gone rather than expanded')
      .toHaveCount(1);
    const expandedLabel = await wide.getAttribute('aria-label') ?? '';
    expect(expandedLabel, 'the expanded state has no accessible name at all').not.toBe('');

    // ── AND BACK, ON THE SAME CONTROL ────────────────────────────────────
    await wide.click();
    const after = { shell: await shell(), well: await well(), panels: await place() };
    expect(after.shell, 'the console did not come back').toEqual(before.shell);
    expect(after.well, 'the viewer did not go back to its embedded size').toEqual(before.well);
    expect(after.panels, 'a panel moved on the way back').toEqual(before.panels);
    expect(await wide.getAttribute('aria-pressed')).toBe('false');
    /*
     * **THE LABEL FOLLOWS `aria-pressed`, AND THAT IS THE WHOLE OF WHAT A
     * SCREEN-READER USER GETS.** Two states, two sentences, and the one that
     * describes the expanded state names what RETURNS — the rest of the
     * console — rather than saying the viewer closes.
     */
    const embeddedLabel = await wide.getAttribute('aria-label') ?? '';
    expect(embeddedLabel, 'the label did not follow the state').not.toBe(expandedLabel);
    expect(await wide.getAttribute('title'), 'the tooltip and the accessible name disagree')
      .toBe(embeddedLabel);
    expect(await fits(), 'the embedded layout overflows `.body`').toBe(true);
  });

  /* ══ 3b — AND THE MODE DOES NOT OUTLIVE THE DOCUMENT ═══════════════════ */

  test(`leaving an expanded document brings the console back (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **THE DEFECT THIS CATCHES IS A TRAP WITH NO WAY OUT.** `doc-wide` hides
     * the header, the rail, the provenance line and the status strip. Left
     * standing after *"Back to all sessions"*, that is a sessions LIST with no
     * shell around it and no control anywhere to bring the shell back — the
     * toggle went with the document. Measured on the owner's own session
     * before the guard was written: the class survived the route change and
     * the console stayed gone.
     *
     * A MODE IS NOT REMEMBERED, either — `setPaneFloat`'s own rule — so
     * re-opening a document must NOT come back expanded.
     */
    await page.locator('button.tvwide').click();
    expect(await page.evaluate(() => document.getElementById('app')!.className))
      .toContain('doc-wide');

    await page.locator('button.tvback').click();
    await page.waitForSelector('[data-p]:not([hidden]) .convrow', { timeout: 20_000 });
    const back = await page.evaluate(() => ({
      cls: document.getElementById('app')!.className,
      hdr: getComputedStyle(document.querySelector('.hdr')!).display,
      rail: getComputedStyle(document.querySelector('.rail')!).display,
      strip: getComputedStyle(document.querySelector('.strip')!).display,
      viewer: document.querySelectorAll('.body > section:not([hidden]) > .tvroot').length,
    }));
    console.log(`[wide ${lang}] after Back: ${JSON.stringify(back)}`);
    expect(back.viewer, 'still on the document, so this proves nothing').toBe(0);
    expect(back.cls, 'the expanded mode outlived the document it belongs to')
      .not.toContain('doc-wide');
    for (const part of [back.hdr, back.rail, back.strip]) {
      expect(part, 'the console did not come back when the document was left').not.toBe('none');
    }

    // And the mode is not remembered: the next document opens embedded.
    await page.locator('.convrowopen').first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    expect(await page.locator('button.tvwide').getAttribute('aria-pressed'),
      'the expanded mode was remembered, which is the one thing a MODE must not be').toBe('false');
  });

  /* ══ 4 — DRAG, CLOSE, REOPEN WHERE IT WAS LEFT ═════════════════════════ */

  test(`the navigation panel drags, closes on its own button, and reopens where it was left (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page, 'navigate');
    const panel = page.locator('dialog.mcpanel[data-panel="navigate"]');
    const at = async (): Promise<{ left: number; top: number }> => panel.evaluate((d) => {
      const b = d.getBoundingClientRect();
      return { left: Math.round(b.left), top: Math.round(b.top) };
    });

    const start = await at();
    const grip = await panel.locator('.mcpanelhead').boundingBox();
    expect(grip).not.toBeNull();
    await page.mouse.move(grip!.x + (grip!.width / 2), grip!.y + (grip!.height / 2));
    await page.mouse.down();
    /*
     * **AWAY FROM THE START EDGE, AND THE SIGN IS READ OFF THE PAGE.** A
     * panel opens inset from the START edge, which is the LEFT in English and
     * the RIGHT in Hebrew, so one fixed physical direction runs into the
     * clamp in one of the two languages. What is asserted is unchanged: the
     * panel moves by the PHYSICAL delta of the pointer, whichever way the
     * page reads.
     */
    const rtl = await page.evaluate(() =>
      document.documentElement.getAttribute('dir') === 'rtl');
    const dx = rtl ? -140 : 140;
    /*
     * **DOWN AND NOT UP, AND THAT IS THE CLAMP RATHER THAN A PREFERENCE.**
     * Written as `- 80` first and it reddened the day the strip changed
     * height: this panel opens under the bar, and when the bar is short the
     * panel's own top is less than 80, so dragging up asks for a negative
     * `top` and `clampPlace` correctly refuses it. The assertion then reports
     * "the panel did not follow the pointer" about a build in which it did.
     * There is always room below; `KEEP_VISIBLE_PX` is the only floor there.
     */
    await page.mouse.move(grip!.x + (grip!.width / 2) + dx, grip!.y + (grip!.height / 2) + 90,
      { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const dragged = await at();
    console.log(`[drag ${lang}] ${JSON.stringify(start)} -> ${JSON.stringify(dragged)} (dx ${dx})`);
    expect(dragged.left, 'the panel did not follow the pointer').toBe(start.left + dx);
    expect(dragged.top).toBe(start.top + 90);

    // **CLOSED ON ITS OWN BUTTON, AS A STANDARD WINDOW** — his words.
    await panel.locator('.mcpanelclose').click();
    await expect(page.locator('dialog.mcpanel[data-panel="navigate"][open]')).toHaveCount(0);
    /*
     * **AND THE CONTROLS STAY IN IT** — `semantic/15`. This used to assert the
     * opposite, that each child was back in `.tvnav`; there is no `.tvnav`,
     * and a closed panel is where these live now. The assertion is kept
     * pointing the other way rather than deleted, because a control that
     * silently escaped its panel on close would otherwise go unnoticed.
     */
    for (const selector of ['.tvnavh', '.tvnavmarks', '.tvnavyous']) {
      expect(await panel.locator(selector).count(), `${selector} left the panel on close`)
        .toBe(1);
      expect(await page.locator(`.tvroot > ${selector}`).count(),
        `${selector} came back out onto the card`).toBe(0);
    }
    // And the caret is not on the body, which is the 47-tab-stop defect this
    // screen has already been repaired for once.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

    await openPanel(page, 'navigate');
    expect(await at(), 'it did not come back where it was left').toEqual(dragged);
  });

  /* ══ 5 — THREE PANELS OPEN AND SHUT, AND THE CARD IS UNCHANGED ════════ */

  test(`opening and closing all three panels changes nothing about the card (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **THIS USED TO BE THE `NotFoundError` CASE, AND `semantic/15` DELETED
     * THE MECHANISM THAT COULD THROW IT.** With the borrow recorded as
     * `(parent, nextSibling)`, `youGroup` was put back before `foundGroup` —
     * which the SEARCH panel was holding — and `insertBefore` threw inside
     * `onClose`, the one path every route out shares. There is no borrow, no
     * restore and no `onClose` on any of the three panels now, so the failure
     * is not reachable.
     *
     * What replaces it is the assertion that would catch the opposite mistake:
     * a panel that, on close, PUT SOMETHING BACK onto a card that is supposed
     * to have given it up. Three panels are opened and shut in the order they
     * were opened, and the card's own children are compared before and after.
     */
    const order = (selector: string): Promise<string[]> => page.evaluate((sel) => [
      ...(document.querySelector(sel as string)?.children ?? []),
    ].map((c) => c.className), selector);

    const rootBefore = await order('.tvroot');

    await openPanel(page, 'search');
    await openPanel(page, 'navigate');
    await openPanel(page, 'copy');

    expect(await order('.tvroot'),
      'opening the panels changed the card, so something is still being lent out of it')
      .toEqual(rootBefore);

    for (const which of ['search', 'navigate', 'copy'] as const) {
      await page.locator(`dialog.mcpanel[data-panel="${which}"] .mcpanelclose`).click();
      await expect(page.locator(`dialog.mcpanel[data-panel="${which}"][open]`)).toHaveCount(0);
    }

    expect(await order('.tvroot'),
      'closing the panels put something back on the card')
      .toEqual(rootBefore);
    // And the caret is never left on the body — the 47-tab-stop defect. Each
    // of the three now hands it to the well, because the control each used to
    // hand it to is inside the dialog that just closed.
    expect(await page.evaluate(() => document.activeElement?.className)).toContain('tvscroll');
  });

  /* ══ 6 — THE CASCADE ══════════════════════════════════════════════════ */

  test(`three panels opened for the first time do not land on top of each other (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * Found by looking at a screenshot of all three open, and nothing else
     * could have found it: "the panel is open" is true of a panel completely
     * covered by another one, with no header left to grab it by.
     */
    for (const which of ['search', 'navigate', 'copy'] as const) await openPanel(page, which);
    const heads = await page.locator('.mcpanelhead').evaluateAll((els) => els
      .filter((el) => el.closest('dialog')?.hasAttribute('open') === true)
      .map((el) => {
        const b = el.getBoundingClientRect();
        return { x: Math.round(b.left), y: Math.round(b.top) };
      }));
    expect(heads.length).toBe(3);
    const seen = new Set(heads.map((h) => `${h.x},${h.y}`));
    expect(seen.size, 'two panels opened at the same point').toBe(3);
  });

  /* ══ 7 — THE COPY PANEL SAYS WHY THE CONTROLS ARE GREY, AND COPIES ═════ */

  test(`the copy panel explains the disabled controls, arms them when a passage is marked, and reports what it took (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page, 'copy');
    const panel = page.locator('dialog.mcpanel[data-panel="copy"]');

    /*
     * **THE ITEM'S OWN POINT.** *"Three of the four are disabled until
     * something is selected, which is honest and invisible: a reader who has
     * selected nothing sees four greyed controls and no reason."* The strip
     * had no room for the reason. The panel has.
     */
    await expect(panel.locator('.mccopyneed')).toBeVisible();
    await expect(panel.locator('.tvcopymsg')).toBeDisabled();
    // Each control carries its own sentence — the item: *"the sentence is the
    // subject, not the buttons"*.
    expect(await panel.locator('.mccopychoice').count(),
      'the four controls are not each drawn with their own sentence').toBe(4);
    expect(await panel.locator('.mccopysay').count()).toBe(4);
    // And the fourth is under a heading that says it is not a copy at all.
    await expect(panel.locator('.mccopynot')).toBeVisible();

    // Mark a passage with the panel OPEN, which is the order this panel asks
    // for: the menu yields to the browser's own over a live selection, so a
    // reader opens it first and marks second.
    await page.evaluate(() => {
      const row = document.querySelector('.tvrow');
      const range = document.createRange();
      range.selectNodeContents(row!);
      const selection = document.getSelection()!;
      selection.removeAllRanges();
      selection.addRange(range);
    });
    await expect(panel.locator('.tvcopymsg')).toBeEnabled({ timeout: 10_000 });
    await expect(panel.locator('.mccopyneed'),
      'the reason is still up after the reason stopped being true').toBeHidden();

    // **AND THE REPORT LANDS WHERE THE READER IS STANDING.** `p.tvcopied` is
    // lent to the panel, so a copy made from inside it says what it took
    // inside it rather than behind it.
    await panel.locator('.tvcopymsg').click();
    await expect(panel.locator('p.tvcopied')).not.toBeEmpty({ timeout: 15_000 });
    const clip = await page.locator('pre.tvclip').evaluate((n) => n.textContent ?? '');
    expect(clip.length, 'nothing was put on the clipboard').toBeGreaterThan(0);
  });

  /* ══ 8 — ONE STEPPING STANDARD, THREE WALKS ═══════════════════════════ */

  test(`every walk counts where you are, moves the count under your finger, and takes it down when you scroll away (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **THE OWNER'S ADDITION TO `semantic/12`, 2026-09-17**: *"because you are
     * still 3 dialogs, apply the same behaviour of highliting the current for
     * Marks and Messages as navigation standard behaviour"*.
     *
     * `semantic/14` built the counter and the current-item emphasis for the
     * MATCH walk first. This asserts that marks and messages got the SAME one
     * — `drawPlace`, `paintStanding` and `revealBox`, each with three callers
     * — rather than a second and third spelling of it. Three implementations
     * that drifted is what produced the inconsistency he noticed.
     */
    const place = async (which: 'mark' | 'you'): Promise<string> =>
      (await page.locator(`.tvnav${which}place`).textContent()) ?? '';

    // **BEFORE THE FIRST STEP THERE IS NO PLACE, AND IT SAYS SO IN WORDS.**
    // `0 of 15` is a lie — there is no zeroth mark — and `1 of 15` claims a
    // position the reader has not taken. So the idle state names the button.
    expect(await place('mark'), 'the mark walk claims a position before any step')
      .not.toMatch(/\d/);
    expect(await place('you'), 'the message walk claims a position before any step')
      .not.toMatch(/\d/);

    // The well opens at the END. See test 9: a walk started there is already
    // past everything and the numbers cannot move.
    await toTop(page);

    const numbers = (text: string): number[] =>
      [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));

    await page.keyboard.press('n');
    await page.waitForTimeout(700);
    const first = numbers(await place('mark'));
    expect(first[0], 'the first step is not the first mark').toBe(1);
    expect(first[1], 'the place does not name how many there are').toBe(MARKS);

    await page.keyboard.press('n');
    await page.waitForTimeout(700);
    expect(numbers(await place('mark'))[0], 'the count did not move under the finger').toBe(2);

    // **AND IT COUNTS BACK DOWN**, which is the half a forward-only assertion
    // cannot tell from a counter that is really a step tally.
    await page.keyboard.press('Shift+N');
    await page.waitForTimeout(700);
    expect(numbers(await place('mark'))[0], 'Previous did not count back down').toBe(1);

    // The message walk is the SAME mechanism with a different argument, and it
    // keeps its own place: stepping marks must not move the message counter.
    const marksAt = await place('mark');
    await page.keyboard.press('u');
    await page.waitForTimeout(700);
    expect(numbers(await place('you'))[0], 'the message walk has no place of its own')
      .toBeGreaterThan(0);
    expect(await place('mark'), 'stepping messages moved the mark walk’s place')
      .toBe(marksAt);

    /*
     * **AND SCROLLING AWAY BY HAND TAKES EVERY POSITION DOWN.** `endWalk`
     * throws the walk away on a wheel, and a position that outlived it would
     * be a second thing on the screen contradicting the stepper — the rule
     * `foundNow` already followed one control along. Found by driving it: the
     * cursors and the emphasis were cleared and the sentences were not.
     */
    await page.locator('.tvscroll').evaluate((el) =>
      el.dispatchEvent(new WheelEvent('wheel', { bubbles: true })));
    await page.waitForTimeout(500);
    expect(await place('mark'), 'a position outlived the walk it described').not.toMatch(/\d/);
    expect(await place('you'), 'a position outlived the walk it described').not.toMatch(/\d/);
  });

  /* ══ 9 — THE ONE YOU ARE STANDING ON IS MARKED, AND IS NOT UNDER A PANEL ═ */

  test(`the turn a walk lands on is marked out, is announced as the current one, and is not left under a panel (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await toTop(page);

    const standing = (): Promise<string[]> => page.locator('.tvrownow')
      .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset['n'] ?? ''));

    expect((await standing()).length, 'something is marked as current before any step').toBe(0);

    await page.keyboard.press('n');
    await page.waitForTimeout(800);
    const one = await standing();
    expect(one.length, 'nothing is marked as the one the reader is standing on').toBe(1);
    // **NOT COLOUR ALONE.** The outline is what a sighted reader sees;
    // `aria-current="location"` is what everybody else gets, and it is on the
    // same element rather than on a sibling that could drift from it.
    expect(await page.locator('.tvrownow').getAttribute('aria-current')).toBe('location');
    expect(await page.locator('[aria-current="location"]').count(),
      'more than one turn claims to be the one the reader is on').toBe(1);

    await page.keyboard.press('n');
    await page.waitForTimeout(800);
    const two = await standing();
    expect(two.length).toBe(1);
    expect(two[0], 'the emphasis did not move with the walk').not.toBe(one[0]);

    /*
     * **AND IT IS NOT UNDER A FLOATING PANEL** — the third thing the owner
     * asked for: *"verify it is in focus so the user could see it"*. Landing
     * is not the same as being seen. `landOn` used to scroll the row to the
     * TOP of the well, which is exactly where a panel opened under the bar
     * sits, so a mark stepped to landed perfectly underneath one.
     *
     * `revealBox` is `semantic/14`'s, written for the match walk, and this is
     * the same function rather than a second one.
     */
    await openPanel(page, 'navigate');
    /*
     * **FOUR PRESSES AND NOT ONE, AND THAT IS A REAL LIMIT RATHER THAN A
     * FLAKY TEST.** Written as one press first, and it reddened — correctly.
     * At the very TOP of a document there is nothing above to scroll, so a
     * target the panel covers cannot be pushed below it: reaching the free
     * band would mean a negative `scrollTop`. `revealBox` already says so in
     * its own words — *"nothing the panels leave can be reached … the reader
     * drags the panel aside, which is the affordance a floating panel has"* —
     * and falls back to the old landing, which is no worse than before any of
     * this existed. What is asserted here is therefore the claim that is
     * actually true: once the walk is away from the top, where the scroll CAN
     * reach a free band, it does.
     */
    for (let press = 0; press < 4; press += 1) {
      await page.keyboard.press('n');
      await page.waitForTimeout(600);
    }
    await page.waitForTimeout(400);
    const clear = await page.evaluate(() => {
      const row = document.querySelector('.tvrownow');
      if (row === null) return { found: false, covered: true };
      const box = row.getBoundingClientRect();
      const well = document.querySelector('.tvscroll')!.getBoundingClientRect();
      const seen = Math.max(well.top, 0);
      const under = Math.min(well.bottom, window.innerHeight || well.bottom);
      // The first line of the row is what the walk aims at, so that is what
      // has to be clear: a turn taller than the well can never be wholly free.
      const head = { top: box.top, bottom: Math.min(box.bottom, box.top + 24) };
      if (head.bottom <= seen || head.top >= under) return { found: true, covered: true };
      for (const d of document.querySelectorAll('dialog.mcpanel[open]')) {
        const over = d.getBoundingClientRect();
        if (box.right < over.left || box.left > over.right) continue;
        if (head.bottom > over.top && head.top < over.bottom) return { found: true, covered: true };
      }
      return { found: true, covered: false };
    });
    expect(clear.found, 'the walk lost its place when a panel opened').toBe(true);
    expect(clear.covered,
      'the turn the reader was stepped to is underneath a panel, where they cannot see it')
      .toBe(false);

    /*
     * **AND THE EMPHASIS SURVIVES THE ROW BEING EVICTED AND REBUILT.**
     *
     * This was written after a mutation that removed `paintStanding()` from
     * the end of `rebuild()` reddened NOTHING — which is the most valuable
     * thing a removal run produces, and it meant the guard was either dead or
     * untested. Driven by hand on the live session it is neither: a row that
     * leaves the window is REMOVED, and coming back it is a new element with
     * none of the old one's attributes.
     *
     * The scroll is PROGRAMMATIC on purpose. `endWalk` throws the walk away on
     * a wheel, a key or a pointer in the well — a reader's own gestures — and
     * a test that scrolled by any of those would be asserting that the
     * emphasis is gone, which it should be. What survives an eviction is what
     * the page does to ITSELF: a body arriving, a new turn, a re-measure.
     */
    const at = await page.locator('.tvrownow').evaluate((el) =>
      (el as HTMLElement).dataset['n'] ?? '');
    const home = await page.locator('.tvscroll').evaluate((el) => {
      const was = el.scrollTop;
      el.scrollTop = el.scrollHeight;
      return was;
    });
    await page.waitForTimeout(900);
    expect(await page.locator('.tvrownow').count(),
      'the fixture is too small to evict the row, so this proves nothing').toBe(0);
    await page.locator('.tvscroll').evaluate((el, was) => { el.scrollTop = was as number; }, home);
    await page.waitForTimeout(1200);
    expect(await page.locator('.tvrownow').count(),
      'the emphasis did not come back when the row was rebuilt').toBe(1);
    expect(await page.locator('.tvrownow').evaluate((el) =>
      (el as HTMLElement).dataset['n'] ?? ''),
    'the emphasis came back on a different turn').toBe(at);
  });

  /* ══ 10 — A CONTROL THAT MOVED DID NOT VANISH FROM THE KEYBOARD ════════ */

  test(`every key still acts with all three panels shut, and with them open (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const said = (): Promise<string> =>
      page.locator('.tvnavsaid').evaluate((el) => el.textContent ?? '');

    /*
     * The item's first "must not regress": *"a control that MOVES into a
     * panel must not vanish from the keyboard while the panel is shut."*
     * `runShortcut` has always called `step(…)` and `cycleKind(…)` directly
     * rather than through these buttons, and this is what holds that true.
     */
    /*
     * **TO THE TOP FIRST, AND THAT IS NOT SETUP NOISE.** The well opens at the
     * END of the document — `redraw('end')` — so a reader who presses N there
     * is already past the last mark and gets *"Nothing is marked after this
     * point"*, which is the correct answer and a useless measurement. Written
     * the other way first, and it reddened here in both languages.
     */
    await toTop(page);
    await page.keyboard.press('n');
    await expect(page.locator('.tvnavsaid')).toBeVisible({ timeout: 10_000 });
    const first = await said();
    expect(first, 'N did not step to a mark with every panel shut').not.toBe('');

    await page.keyboard.press('n');
    await page.waitForTimeout(400);
    expect(await said(), 'the second N did not move').not.toBe(first);

    const kind = await page.locator('.tvnavkind').inputValue();
    await page.keyboard.press('k');
    await page.waitForTimeout(400);
    expect(await page.locator('.tvnavkind').inputValue(),
      'K did not change the kind the walk is over').not.toBe(kind);

    // And with the panel OPEN the same keys still act, on the same controls,
    // which are now inside it.
    await openPanel(page, 'navigate');
    const inPanel = await said();
    await page.keyboard.press('u');
    await page.waitForTimeout(600);
    expect(await said(), 'U did not step to one of his messages with the panel open')
      .not.toBe(inPanel);
    /*
     * **AND THE LIVE REGION IS ON THE CARD, NOT IN THE PANEL** — `semantic/15`
     * reversed `semantic/12` on this one element, deliberately. Every other
     * control MOVED into the panel; this one may not, because a landing
     * announced into a closed `<dialog>` makes `N`, `Shift+N`, `U` and
     * `Shift+U` — which must act with every panel shut — look like keys that
     * do nothing. It is drawn under the disclosure line, at the top of a card
     * that no longer scrolls away, and it is legible in both states.
     */
    expect(await page.locator('dialog.mcpanel[data-panel="navigate"] .tvnavsaid').count(),
      'the live region moved into the panel, so a step made with every panel shut is '
      + 'announced into a closed dialog').toBe(0);
    expect(await page.locator('.tvroot > .tvnavsaid').count(),
      'the live region is not on the card either, so a step is announced nowhere').toBe(1);
  });
}
