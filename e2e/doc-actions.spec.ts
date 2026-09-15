// @basis TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so,
// TASK-rename-has-no-cancel-and-ignores-escape-and-filtering-the,
// TASK-every-write-on-conversations-throws-focus-to-the-document,
// TASK-there-is-no-way-to-step-through-the-marks-or-through-your,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE OTHER TWO ROUTES TO EVERY ACTION ON A CONVERSATION** —
 * `TASK-a-reader-deep-in-a-document-cannot-reach-any-control-so`, driven in a
 * browser because every claim in it is about a live focus model, a real
 * keystroke or a `contextmenu` the page may or may not have suppressed, and
 * none of the three exists outside one.
 *
 * ── WHAT EACH ASSERTION IS FOR, IN THE ITEM'S OWN ORDER ──────────────────
 *
 *   1. **THE BUTTONS STAY.** The ruling is *"ALSO, not ONLY"*: a
 *      right-click-only action is `D58` from the other side. The first test
 *      below is the one that fails if a later lane decides the menu made a
 *      button redundant.
 *   2. **A SHORTCUT IS INERT INSIDE A FIELD**, and the item says in as many
 *      words that this *"must be ASSERTED, not assumed"*. It is asserted by
 *      typing a word made of nothing but bound keys into the find box and
 *      reading the field back.
 *   3. **ESCAPE STILL MEANS WHAT IT MEANT.** `confirm/5` bound it on the
 *      rename box with `stopPropagation`; the item rules a third meaning
 *      unavailable. What is measured is that the menu's Escape does not reach
 *      past the menu, and that with the menu shut the rename box answers
 *      exactly as before.
 *   4. **THE MENU IS REACHABLE WITHOUT A MOUSE** — Shift+F10, which is what a
 *      browser already sends.
 *   5. **THE NATIVE MENU SURVIVES WHERE THIS SCREEN HAS NOTHING TO OFFER.**
 *      Suppressing it costs the reader copy, open-in-new-tab and inspect.
 *   6. **THE CARET COMES BACK.** `confirm/1` measured 47 tab stops lost on a
 *      write; a menu that drops the caret re-opens that wound.
 *   7. **THE KEY IS ON THE BUTTON**, because a keyboard route nobody can
 *      discover is the same defect as a right-click-only action.
 *
 * ── WHAT WRITES, AND WHAT THAT COSTS ────────────────────────────────────
 *
 * **NOT ONE TEST BELOW COMPLETES A WRITE.** Several OPEN the row's write box —
 * that is what the `M` key and the menu's first item do — and every one of
 * them leaves it by Escape or by Cancel, which `labelWrite` documents as the
 * path that sends nothing at all. The anchor store is therefore read-only for
 * the life of this file, so `fullyParallel: true` is correct here rather than
 * merely tolerated — the opposite of `anchor-write-face.spec.ts`, which
 * carries `mode: 'default'` precisely because fourteen of its tests mutate one
 * store.
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

const SESSION = 'sess-actions';
const MARKS = 12;
const EVERY = 6;
const TURNS = 96;

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

function transcript(): { text: string; offsets: number[] } {
  const rows: unknown[] = [];
  for (let i = 0; i < TURNS; i += 1) {
    const mine = i % EVERY === 0;
    const body = mine
      ? `Turn ${String(i).padStart(3, '0')} is a thing I typed myself and it holds no table.`
      : `Turn ${String(i).padStart(3, '0')} is an answer. It carries no pipe, no table header `
        + 'and no normative id, so the automatic pass finds nothing in it to mark.';
    rows.push({
      type: mine ? 'user' : 'assistant',
      message: {
        role: mine ? 'user' : 'assistant',
        content: mine ? body : [{ type: 'text', text: body }],
      },
      timestamp: new Date(Date.UTC(2026, 8, 10, 9, 0, i)).toISOString(),
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
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-act-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-act-cwd-'));
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
    // **RECORD 1 IS MARKED AND RECORD 0 IS NOT**, deliberately: the menu over a
    // marked turn must offer Rename and Take it back, and over an unmarked one
    // must offer Mark this point. A fixture where every turn were the same
    // would let a menu that ignores the row pass both.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      Array.from({ length: MARKS }, (_, i) => 1 + i * 8).map((record, i) => ({
        id: anchorIdFor(SESSION, null, built.offsets[record] as number),
        sessionId: SESSION,
        agentId: null,
        byteOffset: built.offsets[record] as number,
        label: `mark ${String(i).padStart(2, '0')}`,
        kind: 'note',
        origin: 'owner' as const,
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

async function openDoc(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(MARKS), { timeout: 20_000 });
  await page.locator('.tvtop').click();
  // The row the keyboard acts on is the one at the TOP of the viewport, so
  // every test below starts from a known one rather than from wherever the
  // mount's three-second hold to the end left the scroll.
  await expect(page.locator('.tvrow[data-n="0"]')).toBeVisible({ timeout: 10_000 });
}

/** Where the caret is, named the way a reader would name it. */
async function caret(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const n = document.activeElement;
    if (n === null) return 'null';
    if (n === document.body) return 'BODY';
    const cls = n.className === '' ? '' : `.${String(n.className).split(' ').join('.')}`;
    return `${n.tagName.toLowerCase()}${cls}`;
  });
}

/** Did the page suppress the browser's own menu over this element? */
async function nativeMenuSuppressed(page: Page, selector: string): Promise<boolean> {
  return await page.evaluate((which) => {
    const node = document.querySelector(which);
    if (node === null) return false;
    const event = new MouseEvent('contextmenu',
      { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
    node.dispatchEvent(event);
    return event.defaultPrevented;
  }, selector);
}

/* ══ 1 — "ALSO, NOT ONLY": THE BUTTONS ARE STILL THERE ════════════════════ */

test('every route the item names exists, and the buttons are still the discovery path', async ({ page }) => {
  await openDoc(page);
  for (const control of ['.tvfind', '.tvtop', '.tvend',
    '.tvnavmarkprev', '.tvnavmarknext', '.tvnavyouprev', '.tvnavyounext']) {
    await expect(page.locator(control),
      `${control} is gone — the ruling is ALSO, not ONLY, and a capability whose only route is `
      + 'a right-click is D58 from the other side').toBeVisible();
  }
  await expect(page.locator('.tvrow[data-n="0"] .tvanchormark'),
    'the row lost its own write button').toBeVisible();
  // And the route that no button can teach is taught in a sentence.
  await expect(page.locator('.tvmenuhint'),
    'nothing on the screen says the right-click exists, which is the exact defect the item '
    + 'describes from the other side').toBeVisible();
  await expect(page.locator('.tvmenuhint')).toContainText('Shift+F10');
});

/* ══ 2 — INERT INSIDE A FIELD ════════════════════════════════════════════ */

test('a shortcut fires nothing while a field has the caret', async ({ page }) => {
  await openDoc(page);
  const said = page.locator('.tvnavsaid');
  await page.locator('.tvnavmarknext').click();
  await expect(said).toContainText(`of ${MARKS}`, { timeout: 10_000 });
  const before = (await said.textContent() ?? '').trim();

  /*
   * **A WORD MADE OF NOTHING BUT BOUND KEYS.** `n`, `m`, `u` and `/` are every
   * character the table binds; if one of them leaked, the document would step,
   * or a write box would open, or the find box would be re-focused mid-word —
   * and the field would be missing a character.
   */
  await page.locator('.tvfind').click();
  await page.locator('.tvfind').pressSequentially('numbness/mmm');
  expect(await page.locator('.tvfind').inputValue(),
    'a shortcut ate a keystroke that belonged to the find box').toBe('numbness/mmm');
  expect(await caret(page), 'a shortcut moved the caret out of the field being typed into')
    .toContain('tvfind');
  expect((await said.textContent() ?? '').trim(),
    'the document stepped while the reader was typing a word into the search box')
    .toBe(before);
  await expect(page.locator('.tvanchorbox:not([hidden])'),
    'typing into the search box opened a write box on a turn').toHaveCount(0);
});

test('the same keys do fire when the caret is not in a field', async ({ page }) => {
  /*
   * **THE CONTROL ON THE TEST ABOVE, and it is not optional.** A binding table
   * wired to nothing passes "inert inside a field" perfectly. This is the run
   * in which the detector is shown to be able to see a red.
   */
  await openDoc(page);
  await page.locator('.tvscroll').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('n');
  await expect(page.locator('.tvnavsaid'),
    'the keyboard route does nothing at all, which would make the inertness test above vacuous')
    .toContainText(`1 of ${MARKS}`, { timeout: 10_000 });
  await page.keyboard.press('n');
  await expect(page.locator('.tvnavsaid')).toContainText(`2 of ${MARKS}`, { timeout: 10_000 });
  await page.keyboard.press('Shift+N');
  await expect(page.locator('.tvnavsaid'),
    'Shift did not reverse the walk, so the shifted binding is not reaching the table')
    .toContainText(`1 of ${MARKS}`, { timeout: 10_000 });
  await page.keyboard.press('/');
  expect(await caret(page), 'the search key did not put the caret in the search box')
    .toContain('tvfind');
});

/* ══ 3 — ESCAPE STILL MEANS WHAT IT MEANT ════════════════════════════════ */

test('Escape closes the rename box and nothing else, exactly as it did', async ({ page }) => {
  await openDoc(page);
  const row = page.locator('.tvrow[data-n="1"]');
  await row.locator('.tvanchorrename').click();
  await expect(row.locator('.tvanchorinput')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(row.locator('.tvanchorbox:not([hidden])'),
    'Escape stopped closing the rename box — confirm/5\'s whole ruling').toHaveCount(0);
  expect(await caret(page), 'Escape closed the box and dropped the caret, which is the defect '
    + 'the box\'s own cancel path was written to avoid').toContain('tvanchorrename');
  // And the menu, which is the thing that might have stolen the key, was never
  // open and is still not.
  await expect(page.locator('.tvmenu:not([hidden])'),
    'an Escape meant for the rename box opened or left open the menu').toHaveCount(0);
});

test('the menu\'s Escape closes the menu and stops there', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvnavmarknext').focus();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('.tvmenu:not([hidden])'), 'Escape did not close the menu, which is '
    + 'a keyboard trap — the defect one layer below the one this item is about').toHaveCount(0);
  /*
   * **AND THE SAME KEYSTROKE DID NOT REACH ANYTHING BEHIND IT.** This is
   * `confirm/5`'s rule — one key, one level — measured for the new listener:
   * the rename box on the row below is untouched, because Escape stopped at
   * the menu.
   */
  const row = page.locator('.tvrow[data-n="1"]');
  await row.locator('.tvanchorrename').click();
  await expect(row.locator('.tvanchorinput')).toBeVisible();
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.tvmenu:not([hidden])'),
    'Shift+F10 opened the menu from inside a field, where the native menu is the reader\'s')
    .toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(row.locator('.tvanchorbox:not([hidden])'),
    'the rename box no longer answers Escape once a menu exists on the screen').toHaveCount(0);
});

/* ══ 4 — REACHABLE WITHOUT A MOUSE ═══════════════════════════════════════ */

test('Shift+F10 opens the menu on the turn the reader is on, and focus moves into it', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvnavmarknext').focus();
  await page.keyboard.press('Shift+F10');
  const menu = page.locator('.tvmenu:not([hidden])');
  await expect(menu, 'the context-menu gesture a browser already sends does nothing, so a '
    + 'keyboard user cannot reach the menu at all').toHaveCount(1, { timeout: 10_000 });
  await expect(menu).toHaveAttribute('role', 'menu');
  expect(await caret(page), 'the menu opened without taking focus, which strands a keyboard '
    + 'user behind a dialog they cannot reach').toContain('tvmenuitem');
  // The row at the top of the viewport is record 0, which is NOT marked — so
  // the menu must offer to mark it rather than to rename it.
  await expect(menu.locator('.tvmenuitem').first(),
    'the menu does not act on the turn the reader is on').toContainText('Mark this point');
  await expect(menu.locator('.tvmenuitem').first()).toHaveAttribute('aria-keyshortcuts', 'M');
  // Arrow keys walk it, which is what `role="menu"` promises a reader.
  await page.keyboard.press('ArrowDown');
  expect(await caret(page), 'the arrow keys do not walk the menu').toContain('tvmenuitem');
  const second = (await page.evaluate(() => document.activeElement?.textContent ?? '')).trim();
  expect(second, 'ArrowDown did not move to the next item').toContain('Previous mark');
});

test('the menu offers what the turn under the cursor can actually do', async ({ page }) => {
  await openDoc(page);
  // Record 1 IS marked, so its menu is Rename and Take it back — and there is
  // no "Mark this point" on it, which is the half that says the menu read the
  // row rather than listing every verb the screen has.
  await page.locator('.tvrow[data-n="1"] .tvsaid').click({ button: 'right' });
  const menu = page.locator('.tvmenu:not([hidden])');
  await expect(menu).toHaveCount(1, { timeout: 10_000 });
  const items = await menu.locator('.tvmenuitem').evaluateAll(
    (nodes) => nodes.map((n) => (n.textContent ?? '').trim()));
  console.log(`[menu] on a marked turn: ${JSON.stringify(items)}`);
  expect(items.some((i) => i.startsWith('Rename')),
    'the menu on a marked turn does not offer to rename it').toBe(true);
  expect(items.some((i) => i.startsWith('Take it back')),
    'the menu on a marked turn does not offer to take it back').toBe(true);
  expect(items.some((i) => i.startsWith('Mark this point')),
    'the menu offers to mark a turn that is already marked, which is two statements about one '
    + 'point with one of them false').toBe(false);
});

test('a menu item runs the row\'s own control, and the caret ends where that control put it', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvrow[data-n="0"] .tvsaid').click({ button: 'right' });
  const menu = page.locator('.tvmenu:not([hidden])');
  await expect(menu).toHaveCount(1, { timeout: 10_000 });
  await menu.locator('.tvmenuitem').first().click();
  await expect(page.locator('.tvmenu:not([hidden])'),
    'the menu stayed open over the box it just opened').toHaveCount(0);
  /*
   * **ONE IMPLEMENTATION, MEASURED.** The menu item ends in `.click()` on the
   * row's real button, so what opens is the same box the button opens and the
   * caret lands where `boxToggle` puts it. A menu that had reimplemented the
   * write would open something else, or nothing, or leave the caret behind.
   */
  await expect(page.locator('.tvrow[data-n="0"] .tvanchorbox:not([hidden])'),
    'the menu item did not open the row\'s write box').toHaveCount(1);
  expect(await caret(page), 'the menu item opened the box and left the caret outside it')
    .toContain('tvanchorinput');
  // Leave without writing — `labelWrite`'s cancel sends nothing at all.
  await page.keyboard.press('Escape');
  await expect(page.locator('.tvanchorbox:not([hidden])')).toHaveCount(0);
});

/* ══ 5 — THE NATIVE MENU SURVIVES WHERE THIS SCREEN HAS NOTHING ═══════════ */

test('the browser keeps its own menu everywhere this screen has no action', async ({ page }) => {
  await openDoc(page);
  const overATurn = await nativeMenuSuppressed(page, '.tvrow[data-n="0"] .tvsaid');
  const overTheBar = await nativeMenuSuppressed(page, '.tvnavmarknext');
  const overTheField = await nativeMenuSuppressed(page, '.tvfind');
  const outsideTheWell = await nativeMenuSuppressed(page, '.tvcount');
  console.log(`[native] turn=${overATurn} bar=${overTheBar} field=${overTheField} `
    + `outside=${outsideTheWell}`);
  expect(overATurn, 'the right-click over a turn does nothing, so the third route does not '
    + 'exist').toBe(true);
  // **THE ITEM'S THIRD CONSTRAINT.** Suppressing the native menu costs the
  // reader copy, open-in-new-tab and inspect, so it is suppressed ONLY where
  // this screen genuinely has actions.
  expect(overTheBar, 'the native menu was taken over the navigation bar, where this screen '
    + 'offers nothing in its place').toBe(false);
  expect(overTheField, 'the native menu was taken inside a text field, where it is cut, copy '
    + 'and paste and there is no version of this screen\'s menu that replaces it').toBe(false);
  expect(outsideTheWell, 'the native menu was taken outside the document entirely').toBe(false);
});

test('a live selection keeps the browser\'s menu, because the reader means Copy', async ({ page }) => {
  await openDoc(page);
  const withSelection = await page.evaluate(() => {
    const p = document.querySelector('.tvrow[data-n="0"] .tvsaid');
    const range = document.createRange();
    range.selectNodeContents(p as Node);
    const selection = document.getSelection();
    try {
      selection?.removeAllRanges();
      selection?.addRange(range);
      const event = new MouseEvent('contextmenu',
        { bubbles: true, cancelable: true, clientX: 200, clientY: 200 });
      (p as Element).dispatchEvent(event);
      return event.defaultPrevented;
    } finally {
      selection?.removeAllRanges();
    }
  });
  console.log(`[native] over a live selection, suppressed=${withSelection}`);
  /*
   * **THE THREE COPY CONTROLS IN THE BAR EXIST FOR EXACTLY THIS MOMENT.** A
   * reader who has just dragged across a turn and right-clicked means Copy;
   * taking that gesture to offer them a bookmark would be this feature
   * stealing the gesture it was built beside.
   */
  expect(withSelection, 'the native menu was taken over a live selection, which costs the '
    + 'reader the Copy the three copy controls in the bar exist for').toBe(false);
  // And the control: with the selection dropped, the same element answers.
  expect(await nativeMenuSuppressed(page, '.tvrow[data-n="0"] .tvsaid'),
    'the same element suppresses nothing with no selection either, so the assertion above '
    + 'measured a menu that never works').toBe(true);
});

/* ══ 6 — THE CARET COMES BACK ════════════════════════════════════════════ */

test('closing the menu hands the caret back where it came from', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvnavmarknext').focus();
  const before = await caret(page);
  await page.keyboard.press('Shift+F10');
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  const inside = await caret(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(0);
  const after = await caret(page);
  console.log(`[caret] before=${before} inside=${inside} after=${after}`);
  expect(after, 'the menu dropped the caret to the document body on the way out — confirm/1 '
    + 'measured that at 47 tab stops on this screen').not.toBe('BODY');
  expect(after, 'the caret did not go back to the control the menu was opened from')
    .toBe(before);
});

test('a menu opened from the well leaves the caret in the well, not on the body', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvrow[data-n="0"] .tvsaid').click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.keyboard.press('Escape');
  const after = await caret(page);
  console.log(`[caret] after a right-click menu was dismissed: ${after}`);
  expect(after, 'a menu opened by right-click left the caret nowhere, so a reader who had been '
    + 'tabbing is back at the top of the page').not.toBe('BODY');
});

/* ══ 7 — THE KEY IS ON THE BUTTON ════════════════════════════════════════ */

test('every control that has a key says so, on the button and to a screen reader', async ({ page }) => {
  await openDoc(page);
  const shown = await page.evaluate(() => {
    const named: Record<string, { text: string; keys: string | null; title: string }> = {};
    for (const which of ['.tvfind', '.tvnavmarkprev', '.tvnavmarknext',
      '.tvnavyouprev', '.tvnavyounext', '.tvrow[data-n="0"] .tvanchormark']) {
      const node = document.querySelector(which) as HTMLElement | null;
      if (node === null) continue;
      named[which] = {
        text: (node.querySelector('.tvkey')?.textContent ?? '').trim(),
        keys: node.getAttribute('aria-keyshortcuts'),
        title: node.title,
      };
    }
    return named;
  });
  console.log(`[keys] ${JSON.stringify(shown)}`);
  const silent = Object.entries(shown)
    .filter(([, v]) => v.keys === null || v.keys === '' || v.title === '')
    .map(([k]) => k);
  expect(silent, 'a control with a keyboard route does not say what its key is. A keyboard '
    + 'route nobody can discover is the same defect as a right-click-only action — the item\'s '
    + 'own closing sentence.').toEqual([]);
  // The chip is drawn on the BUTTONS (a text field cannot carry a child), and
  // it is `aria-hidden` so the shortcut is announced as a shortcut rather than
  // read as part of the control's name.
  const chipless = Object.entries(shown)
    .filter(([k, v]) => k !== '.tvfind' && v.text === '').map(([k]) => k);
  expect(chipless, 'a button carries its key only in a tooltip, so a reader who does not hover '
    + 'never learns the fast path').toEqual([]);
  await expect(page.locator('.tvnavmarknext .tvkey'))
    .toHaveAttribute('aria-hidden', 'true');
});
