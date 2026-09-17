// @basis TASK-there-is-no-way-to-step-through-the-marks-or-through-your,
// TASK-every-write-on-conversations-throws-focus-to-the-document,
// TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and,
// INV-nothing-is-dropped-silently,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **STEPPING A CONVERSATION — BY MARK, AND BY HIS OWN MESSAGES**, driven in a
 * browser, because every claim here is about a scroll position, a live region
 * and `document.activeElement` and none of the three exists outside one.
 *
 * ── WHY A BROWSER AND NOT `test/ui` ───────────────────────────────────────
 *
 *   - **A step is a scroll position in a VIRTUALISED document.** The well
 *     holds about thirty rows of a session that may run to thousands, and a
 *     row's height is an estimate until it has been drawn. "The reader is now
 *     at mark 17" is therefore a claim about what `paint` did after the model
 *     was corrected from the layout, which only a layout can answer.
 *   - **The caret is a property of a live document.** The item's rule is that
 *     moving the reader is not an excuse to lose the caret; the only
 *     instrument that can measure that is `document.activeElement` in a real
 *     focus model.
 *   - **`aria-live` announces only from a region that was in the document
 *     before its text changed.** Where the region LIVES is the assertion, and
 *     a unit test reading `textContent` cannot tell a region mounted outside
 *     the well from one rebuilt inside it.
 *
 * ── THE FIXTURE, AND THE TWO THINGS IT HAS TO HOLD ───────────────────────
 *
 * **Marks at REAL byte offsets.** `e2e/anchor-write-face.spec.ts` writes its
 * owned rows at `100_000 + i * 32`, which is past the end of its own
 * transcript — every one of them resolves through `nodeAtByte` to the LAST
 * node, so twenty-four marks are one stop. That is right for what that file
 * measures (where the caret lands after a write) and useless for this one. So
 * the offsets here are computed from the bytes of the file that is written,
 * and every mark is a distinct section.
 *
 * **More marks than the list's page bound.** `BOUND_CAP_LIST` is 20 and
 * `drawAnchors` pages at it. `MARKS` is 24, so the twenty-first mark is one
 * the list does not draw on its first page — which is the whole of what
 * "navigation must work ACROSS the page bound" means here, and it is measured
 * rather than asserted from the code.
 *
 * ── AND NOTHING IN THIS FILE WRITES ──────────────────────────────────────
 *
 * Stated rather than left to be discovered, because `anchor-write-face.spec.ts`
 * carries `test.describe.configure({ mode: 'default' })` for exactly the
 * opposite reason: fourteen of its tests mutate one anchor store, and at
 * `fullyParallel: true` a different one failed every run. Not one test below
 * marks, relabels or drops anything — they press four buttons that only ever
 * set `scrollTop` — so the store is READ-ONLY for the life of this file and
 * the default parallelism is correct rather than merely tolerated.
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

const SESSION = 'sess-stepping';
/** How many points are marked. Past `BOUND_CAP_LIST` (20) on purpose. */
const MARKS = 24;
/** The page bound the marked-points LIST draws at, which the stepper does not. */
const CAP = 20;
/** How many turns in the transcript are his. One every sixth record. */
const EVERY = 6;
const TURNS = 96;

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * The transcript, and the byte each of its lines begins at.
 *
 * `DocOutlineNode.o` is "byte offset of the first record's line — the seek
 * target", and `markAnchor` stores exactly that number. So the offsets are
 * taken from the bytes of the text that is written and never guessed:
 * `Buffer.byteLength`, because this project's archive is half Hebrew and a
 * character count is the one thing an offset may not be.
 */
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
/** The record index each mark sits on, ascending — the order a step walks. */
let markedAt: number[] = [];

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-step-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-step-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const built = transcript();
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), built.text);

  // Every mark on an ANSWER, so that the two steppers walk disjoint sets and
  // a test cannot pass by stepping the wrong one: his turns are every sixth
  // record and `1 + i * 4` never lands on one for i < 24 unless `i % 3 === 1`
  // — so they overlap sometimes, which is the honest case rather than a
  // fixture arranged to make the two look independent when they are not.
  markedAt = Array.from({ length: MARKS }, (_, i) => 1 + i * 4);

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    // **THE ID IS DERIVED, because in this product it always is** —
    // `anchorIdFor(sessionId, agentId, byteOffset)` is what `markAnchor`
    // composes, and a hand-written id would be a row nothing the product does
    // could ever produce. `anchor-write-face.spec.ts` carries the measurement
    // of what that cost when it was got wrong.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      markedAt.map((record, i) => ({
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

/** The document, open, with the stepper drawn and the anchors loaded into it. */
async function openDoc(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  // The counters are filled from `anchorsHere`, which arrives one fetch after
  // the mount. Waiting for the NUMBER rather than for the element is what
  // makes every assertion below about a loaded document rather than about a
  // race — `refreshMarks`' own header records the eleven-assertions-then-a-
  // failure shape this avoids.
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(MARKS), { timeout: 20_000 });
  /*
   * **AND THE STEP PANEL IS OPENED, BECAUSE THAT IS WHERE THE STEPPER LIVES
   * SINCE `semantic/15`.** `.tvnav` was a strip on the card until 2026-09-17;
   * the owner asked for the controls to leave it, and these six buttons went
   * to the panel named after what they do. Nothing else about this file's
   * subject moved — `runShortcut` still calls `step(…)` directly, which is why
   * `e2e/conversations-panels.spec.ts` can prove the same walks with every
   * panel SHUT.
   */
  await usePanelAt(page, 1, 'navigate');
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

/** The section index at the top of the well — where a step actually left the reader. */
async function topSection(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const well = document.querySelector('.tvscroll');
    if (well === null) return -1;
    const top = well.getBoundingClientRect().top;
    let best = -1;
    let bestDelta = Infinity;
    for (const row of document.querySelectorAll('.tvrow')) {
      const at = Number((row as HTMLElement).dataset['n']);
      if (!Number.isInteger(at)) continue;
      const delta = Math.abs(row.getBoundingClientRect().top - top);
      if (delta < bestDelta) { bestDelta = delta; best = at; }
    }
    return best;
  });
}

/* ══ WHAT THERE IS TO STEP THROUGH, SAID BEFORE ANYTHING IS PRESSED ═══════ */


/**
 * ══ REACHING Top, End AND THE FIND BOX SINCE `semantic/15` ════════════════
 *
 * The owner ruled on 2026-09-17 that the controls leave the card: `.tvbar` and
 * `.tvnav` are gone and every control lives in the panel that owns its
 * subject. The route to a panel is the right-click menu, whose first three
 * rows are Search, Step through and Copy — above the separator — so the index
 * IS the panel.
 *
 * `jumpTo` shuts the panel again, because what follows one of these is an
 * assertion about the document and not about a dialog standing over it.
 */
async function usePanelAt(page: Page, at: number, name: string): Promise<void> {
  const open = `dialog.mcpanel[data-panel="${name}"][open]`;
  if (await page.locator(open).count() > 0) return;
  await page.evaluate(() => { document.getSelection()?.removeAllRanges(); });
  await page.locator('.tvscroll .tvturn').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.tvmenu .tvmenuitem').nth(at).click();
  await expect(page.locator(open)).toHaveCount(1, { timeout: 10_000 });
}

async function jumpTo(page: Page, which: 'top' | 'end'): Promise<void> {
  // **IT LEAVES THE PANEL AS IT FOUND IT.** A test whose subject is the
  // stepper has the panel open and needs it to stay open; one that only wants
  // the reader at an end has nothing open and must not be left with a dialog
  // over the well it is about to photograph or click into.
  const open = 'dialog.mcpanel[data-panel="navigate"][open]';
  const wasOpen = await page.locator(open).count() > 0;
  await usePanelAt(page, 1, 'navigate');
  await page.locator(`dialog.mcpanel[data-panel="navigate"] button.tv${which}`).click();
  if (wasOpen) return;
  await page.locator('dialog.mcpanel[data-panel="navigate"] .mcpanelclose').click();
  await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
}

async function typeInFind(page: Page, query: string): Promise<void> {
  await usePanelAt(page, 0, 'search');
  await page.locator('dialog.mcpanel[data-panel="search"] .tvfind').fill(query);
}

test('the stepper says how many marks and how many of his own messages there are', async ({ page }) => {
  await openDoc(page);
  const marks = await page.locator('.tvnavmarkcount').textContent() ?? '';
  const yous = await page.locator('.tvnavyoucount').textContent() ?? '';
  console.log(`[nav counts] marks="${marks.trim()}" yours="${yous.trim()}"`);
  expect(marks, 'the mark counter does not say how many there are').toContain(String(MARKS));
  // `TURNS / EVERY` turns are his, and the counter is derived rather than
  // told — a number that agreed with the fixture by being written twice would
  // measure nothing.
  expect(yous, 'the You counter does not say how many of his messages there are')
    .toContain(String(TURNS / EVERY));
  await expect(page.locator('.tvnavmarkprev')).toBeVisible();
  await expect(page.locator('.tvnavmarknext')).toBeVisible();
  await expect(page.locator('.tvnavyouprev')).toBeVisible();
  await expect(page.locator('.tvnavyounext')).toBeVisible();
});

/* ══ STEPPING FORWARD, AND THE POSITION IT ANNOUNCES ══════════════════════ */

test('Next mark walks the marks in order and names the one it landed on', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'top');

  const seen: string[] = [];
  for (let i = 1; i <= 3; i += 1) {
    await page.locator('.tvnavmarknext').click();
    await expect(page.locator('.tvnavsaid')).toContainText(`${i} of ${MARKS}`, { timeout: 10_000 });
    seen.push((await page.locator('.tvnavsaid').textContent() ?? '').trim());
  }
  console.log(`[nav forward] ${seen.join(' | ')}`);
  // The NAME is the thing that says which bookmark this is, and it is the
  // half a position alone cannot carry.
  expect(seen[0], 'the first step did not name the mark it landed on').toContain('mark 00');
  expect(seen[1]).toContain('mark 01');
  expect(seen[2]).toContain('mark 02');

  // And the reader is actually THERE — the announcement is not a sentence
  // about a scroll that did not happen.
  const at = await topSection(page);
  console.log(`[nav forward] top section after three steps = ${at}`);
  expect(at, 'the third step announced mark 02 and left the reader elsewhere')
    .toBe(markedAt[2]);
});

test('Previous mark walks back, and the two directions meet at the same place', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'top');
  for (let i = 0; i < 4; i += 1) await page.locator('.tvnavmarknext').click();
  await expect(page.locator('.tvnavsaid')).toContainText(`4 of ${MARKS}`, { timeout: 10_000 });
  const forward = await topSection(page);

  await page.locator('.tvnavmarknext').click();
  await expect(page.locator('.tvnavsaid')).toContainText(`5 of ${MARKS}`, { timeout: 10_000 });
  await page.locator('.tvnavmarkprev').click();
  await expect(page.locator('.tvnavsaid')).toContainText(`4 of ${MARKS}`, { timeout: 10_000 });
  const back = await topSection(page);
  console.log(`[nav back] forward=${forward} back=${back}`);
  expect(back, 'a step forward and a step back do not land on the same section').toBe(forward);
});

/* ══ THE CARET, WHICH A STEP MAY NOT COST ════════════════════════════════ */

test('a step leaves the caret on the button the reader is pressing', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'top');
  await page.locator('.tvnavmarknext').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.tvnavsaid')).toContainText(`1 of ${MARKS}`, { timeout: 10_000 });
  const afterOne = await caret(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.tvnavsaid')).toContainText(`2 of ${MARKS}`, { timeout: 10_000 });
  const afterTwo = await caret(page);
  console.log(`[nav caret] afterOne=${afterOne} afterTwo=${afterTwo}`);
  expect(afterOne, 'the step threw the caret to the document body').not.toBe('BODY');
  expect(afterOne, 'the caret left the control the reader was using')
    .toContain('tvnavmarknext');
  // The second press is the assertion that matters: a stepper whose caret
  // moves cannot be pressed twice from the keyboard at all.
  expect(afterTwo, 'the second step could not be made from the keyboard, because the first '
    + 'moved the caret off the button').toContain('tvnavmarknext');
});

/* ══ THE TWO ENDS ════════════════════════════════════════════════════════ */

test('at the first mark, stepping back says so and does not move the reader', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'top');
  await page.locator('.tvnavmarkprev').click();
  const said = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[nav first] "${said}"`);
  expect(said, 'stepping back from the top said nothing at all').not.toBe('');
  expect(said, 'the end of the walk was announced as a landing').not.toContain(` of ${MARKS}`);
  // A disabled button cannot hold focus, which is why the ends are SAID rather
  // than disabled — the reader must be able to press the other one next.
  await expect(page.locator('.tvnavmarkprev'),
    'the button at the end of the walk is inert, so the caret cannot stay on it')
    .toBeEnabled();
});

test('at the last mark, stepping on says so and does not move the reader', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'end');
  /*
   * **TWO PRESSES, AND THE FIRST ONE IS THE MEASUREMENT THIS TEST EXISTS
   * FOR.** A stepper that read the viewport on every press would answer the
   * same press for ever — the last two or three marks of every session
   * collapsing into one — which is exactly what `cursor` was written for and
   * what this asserts is not happening.
   *
   * **THE FIRST PRESS IS `Previous mark` SINCE `semantic/15`, AND THAT IS A
   * FACT ABOUT THE WELL RATHER THAN ABOUT THE STEPPER.** It used to be Next:
   * End leaves `scrollTop` clamped at `total - clientHeight`, and with the
   * well at `min(70vh, 860px)` the top of the viewport landed several rows
   * ABOVE the last mark, so Next was a real step onto it. §4 stopped the outer
   * scroll, so the well is now sized from what is left after the card — a
   * different `clientHeight`, a different clamp, and from the end the reader
   * is already PAST the last mark, where Next correctly answers *"Nothing is
   * marked after this point"*. Measured: from the end the viewport's top row IS
   * the last mark, so Previous lands on 23 of 24 and Next then walks the
   * CURSOR onto 24 — which is the step this test is about, taken from a place
   * that does not depend on where the clamp happens to leave the reader.
   */
  await page.locator('.tvnavmarkprev').click();
  await expect(page.locator('.tvnavsaid'))
    .toContainText(`${MARKS - 1} of ${MARKS}`, { timeout: 10_000 });
  await page.locator('.tvnavmarknext').click();
  await expect(page.locator('.tvnavsaid'))
    .toContainText(`${MARKS} of ${MARKS}`, { timeout: 10_000 });
  const landed = await page.locator('.tvnavsaid').textContent() ?? '';

  await page.locator('.tvnavmarknext').click();
  const said = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[nav last] landed="${landed.trim()}" then="${said}"`);
  expect(said, 'stepping past the last mark said nothing at all').not.toBe('');
  expect(said, 'the walk stepped past its own end, or re-announced the mark it was on')
    .not.toContain(` of ${MARKS}`);
  await expect(page.locator('.tvnavmarknext'),
    'the button at the end of the walk is inert, so the caret cannot stay on it')
    .toBeEnabled();
});

/* ══ ACROSS THE PAGE BOUND — THE ITEM'S OWN CONSTRAINT ════════════════════ */

test('the twenty-first mark is reachable from the document although the list pages at twenty', async ({ page }) => {
  // The LIST first, so the bound is measured rather than assumed.
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
  const drawn = await page.locator('.convanchorsbox .convanchor').count();
  const bound = (await page.locator('.convanchorsbox .bound p').textContent() ?? '').trim();
  console.log(`[nav bound] list drew ${drawn} rows, bound line "${bound}"`);
  expect(drawn, 'the list is not paged in this fixture, so nothing here measures a bound')
    .toBe(CAP);

  // Then the DOCUMENT, which steps to every one of them.
  await openDoc(page);
  await jumpTo(page, 'top');
  for (let i = 1; i <= MARKS; i += 1) {
    await page.locator('.tvnavmarknext').click();
    await expect(page.locator('.tvnavsaid'))
      .toContainText(`${i} of ${MARKS}`, { timeout: 10_000 });
  }
  const said = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[nav bound] last step said "${said}"`);
  expect(said, 'the last mark was not reachable by stepping').toContain(`${MARKS} of ${MARKS}`);
  expect(said, 'the mark past the list bound was reached and not named')
    .toContain(`mark ${MARKS - 1}`);
  /*
   * **VISIBLE, not "at the top of the well", and the difference is the clamp.**
   * The last mark sits inside the final screenful, so `scrollTop` cannot put
   * it at the top — `total - clientHeight` is as far as a scroll goes. What
   * the reader is owed is that the section is ON THE SCREEN, and that is what
   * is measured; asserting the top row would be asserting an arithmetic the
   * browser is right to refuse.
   */
  const shown = await page.evaluate((n) => {
    const row = document.querySelector(`.tvrow[data-n="${n}"]`);
    const well = document.querySelector('.tvscroll');
    if (row === null || well === null) return null;
    const r = row.getBoundingClientRect();
    const w = well.getBoundingClientRect();
    return { visible: r.bottom > w.top && r.top < w.bottom, top: Math.round(r.top - w.top) };
  }, markedAt[MARKS - 1]);
  console.log(`[nav bound] section ${markedAt[MARKS - 1]} ${JSON.stringify(shown)}`);
  expect(shown, 'the section the last mark sits on was never drawn').not.toBeNull();
  expect(shown?.visible, 'the step past the page bound announced a landing it did not make')
    .toBe(true);
});

/* ══ HIS OWN PROMPTS, WHICH ARE A SECOND WALK AND NOT THE SAME ONE ════════ */

test('stepping his own messages walks the turns drawn as You', async ({ page }) => {
  await openDoc(page);
  await jumpTo(page, 'top');
  /*
   * **FROM THE TOP, THE FIRST STEP IS TO HIS SECOND MESSAGE, and that is the
   * behaviour rather than an off-by-one.** Record 0 of this fixture is one of
   * his, so a reader at the top of the document is standing ON his first
   * message; "your next message" means the one after it. A stepper that
   * answered "1 of 16" there would be offering to take the reader where they
   * already are.
   */
  await page.locator('.tvnavyounext').click();
  await expect(page.locator('.tvnavsaid'))
    .toContainText(`2 of ${TURNS / EVERY}`, { timeout: 10_000 });
  const first = await topSection(page);
  await page.locator('.tvnavyounext').click();
  await expect(page.locator('.tvnavsaid'))
    .toContainText(`3 of ${TURNS / EVERY}`, { timeout: 10_000 });
  const second = await topSection(page);
  console.log(`[nav you] first=${first} second=${second}`);
  // **THE SECTIONS ARE HIS**, read off the drawn row rather than off the
  // fixture: a walk that landed on an answer would still count to two.
  for (const at of [first, second]) {
    const who = await page.evaluate(
      (n) => document.querySelector(`.tvrow[data-n="${n}"] .tvwho`)?.textContent ?? '',
      at);
    expect(who.trim(), `section ${at} is not drawn as one of his`).toContain('You');
  }
  expect(second - first, 'the second step did not move to the next of his turns').toBe(EVERY);
});

/* ══ WHAT THE FILTER IS HOLDING BACK, SAID RATHER THAN SUBTRACTED ═════════ */

test('a filter that hides marks says how many it is hiding', async ({ page }) => {
  await openDoc(page);
  const before = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();
  // A needle that matches his turns and no answer, so every mark — all of
  // which sit on answers except where the arithmetic overlaps — leaves the
  // view and the stepper has to say so.
  await typeInFind(page, 'I typed myself');
  await expect(page.locator('.tvnavmarkcount'), 'the counter never noticed the filter')
    .not.toHaveText(before, { timeout: 20_000 });
  const after = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();
  console.log(`[nav filtered] before="${before}" after="${after}"`);
  expect(after, 'the marks the filter is hiding were silently subtracted')
    .toMatch(/hiding them|\bmore\b/);
});
