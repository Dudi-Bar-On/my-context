// @basis TASK-the-six-kinds-a-mark-can-carry-have-no-reader-so-you-cannot,
// TASK-every-row-in-the-mark-list-links-with-the-same-word-because,
// TASK-there-is-no-way-to-step-through-the-marks-or-through-your,
// TASK-684-anchors-render-unpaged-as-92-percent-of-the-document-and,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// INV-nothing-is-dropped-silently,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE KINDS GET A READER, AND THE MARK LIST STOPS SAYING ONE WORD TWENTY-FOUR
 * TIMES** — `anchors/6` and `anchors/7`, driven in a browser.
 *
 * ── WHY THE TWO ITEMS SHARE ONE FILE, WHICH IS ABOUT THE FIXTURE ─────────
 *
 * They need the SAME archive, and it is `anchors/7`'s own sentence: *"on a
 * list where 24 marks sit in one conversation, all 24 rows read the same
 * word."* Twenty-four marks in one session, spread across six kinds, is
 * simultaneously the list `anchors/7` is about and the document `anchors/6`
 * filters. Building it twice would be two fixtures that could drift about what
 * "the same conversation" means, and two servers for one archive.
 *
 * ── WHY A BROWSER, PER ITEM ─────────────────────────────────────────────
 *
 *   - **`anchors/6` is a claim about a BAR'S HEIGHT.** The item's one hard
 *     constraint is that the filter must not become twelve buttons on a bar
 *     measured at one line, and it instructs the lane to *"measure the bar
 *     afterwards and report its height, the way the stepper did"*. A height is
 *     a layout, and only a layout can answer it.
 *   - **`anchors/6` is also a claim about a live region and a scroll
 *     position** — the same three reasons `doc-navigation.spec.ts` gives at
 *     length for the walk it filters.
 *   - **`anchors/7` is a claim about an ACCESSIBLE NAME.** The item says in as
 *     many words that 24 links reading alike is worse to a screen reader than
 *     on screen; the accessible name is computed by the browser from the
 *     markup, and reading `textContent` in Node would not be the same
 *     question.
 *
 * ── AND NOTHING IN THIS FILE WRITES ─────────────────────────────────────
 *
 * Stated rather than left to be discovered, because `anchor-write-face.spec.ts`
 * carries `test.describe.configure({ mode: 'default' })` for exactly the
 * opposite reason. Not one test below marks, relabels or drops anything: they
 * change a `<select>`, press two buttons that only ever set `scrollTop`, and
 * read a list. The anchor store is READ-ONLY for the life of this file, so the
 * default `fullyParallel: true` is correct rather than merely tolerated.
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

const SESSION = 'sess-kinds';
/** How many points are marked. `anchors/7`'s own number, and past the list's bound. */
const MARKS = 24;
/** The page bound the marked-points LIST draws at. `BOUND_CAP_LIST`. */
const CAP = 20;
/** How many turns are his. One every sixth record. */
const EVERY = 6;
const TURNS = 96;

/**
 * The six kinds, dealt round-robin, so every one of them has exactly four
 * marks and no test can pass by picking the only populated kind.
 *
 * They are `OWNER_KIND_CHOICES` — what he may choose by hand — because those
 * are the six the item is about. The automatic pass's own kinds (`table`,
 * `report`, `ruling`) are deliberately absent here: whether the select reaches
 * them is a separate claim and this fixture would answer it by accident.
 */
const KINDS = ['note', 'decision', 'question', 'defect', 'evidence', 'todo'];
/** How many marks each kind therefore carries. 24 / 6. */
const PER_KIND = MARKS / KINDS.length;

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * The transcript, and the byte each of its lines begins at.
 *
 * `Buffer.byteLength`, never a character count, for `doc-navigation.spec.ts`'s
 * stated reason: this project's archive is half Hebrew and an offset is the
 * one thing a character count may not be.
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
  home = mkdtempSync(path.join(tmpdir(), 'e2e-kind-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-kind-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const built = transcript();
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), built.text);
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
    // could ever produce.
    writeAnchorFile(path.join(cwd, '.my_context', '.anchors.jsonl'),
      markedAt.map((record, i) => ({
        id: anchorIdFor(SESSION, null, built.offsets[record] as number),
        sessionId: SESSION,
        agentId: null,
        byteOffset: built.offsets[record] as number,
        label: `mark ${String(i).padStart(2, '0')}`,
        kind: KINDS[i % KINDS.length] as string,
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

/** The archive screen, with the marked-points list drawn. */
async function openArchive(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convanchorsbox .convanchor', { timeout: 20_000 });
}

/** The document, with the stepper drawn and the anchors loaded into it. */
async function openDoc(page: Page): Promise<void> {
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((id) => { location.hash = `#/conversations/${id}`; }, SESSION);
  await page.waitForSelector('.tvscroll', { timeout: 20_000 });
  // Waiting for the NUMBER rather than for the element, so every assertion
  // below is about a loaded document rather than about a race.
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(MARKS), { timeout: 20_000 });
  /*
   * **AND THE STEP PANEL IS OPENED, BECAUSE THAT IS WHERE THE KIND PICKER
   * LIVES SINCE `semantic/15`.** It was a `<select>` on `.tvnav` until
   * 2026-09-17; the owner asked for the controls to leave the card, and the
   * picker went with the walk it narrows. Nothing else about this file's
   * subject moved: one `markKind`, one walk, one cursor, one select.
   */
  await page.locator('.tvscroll .tvturn').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  await page.locator('.tvmenu .tvmenuitem').nth(1).click();
  await expect(page.locator('dialog.mcpanel[data-panel="navigate"][open]'))
    .toHaveCount(1, { timeout: 10_000 });
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

/* ══ anchors/6 — THE KINDS GET A READER ═══════════════════════════════════ */


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

test('the walk can be narrowed to one kind, and the choices are the kinds this document holds', async ({ page }) => {
  await openDoc(page);
  const options = await page.locator('.tvnavkind option').evaluateAll(
    (nodes) => nodes.map((n) => (n as HTMLOptionElement).value));
  console.log(`[kinds] the select offers ${JSON.stringify(options)}`);
  // The empty value is "every kind" — the state the walk opens in, and the one
  // a reader must always be able to get back to.
  expect(options[0], 'the select does not open on every kind, so a reader who narrows the walk '
    + 'has no stated way back to all of it').toBe('');
  expect(options.slice(1).sort(), 'the select offers a kind this conversation does not hold, or '
    + 'is missing one it does — a choice that can only ever answer "nothing" is the measured-'
    + 'zero rule pointed at a <select>').toEqual([...KINDS].sort());
});

test('the count says what it counts, and the number changes with it', async ({ page }) => {
  await openDoc(page);
  const everyKind = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();
  await page.locator('.tvnavkind').selectOption('defect');
  await expect(page.locator('.tvnavmarkcount'), 'the counter never noticed the filter')
    .not.toHaveText(everyKind, { timeout: 10_000 });
  const filtered = (await page.locator('.tvnavmarkcount').textContent() ?? '').trim();
  console.log(`[kinds] every="${everyKind}" | filtered="${filtered}"`);
  expect(everyKind, 'the unfiltered counter does not report every mark').toContain(String(MARKS));
  expect(filtered, 'the filtered counter does not report the marks of that kind')
    .toContain(String(PER_KIND));
  // **THE ITEM'S OWN SENTENCE.** *"'3 of 24' when filtered to defects is a lie
  // unless the sentence says defects."* A number whose meaning silently
  // changed is the defect `confirm/3` was about, and this is the assertion
  // that it did not.
  expect(filtered, 'the count changed its meaning without saying so — the same "4" stands for '
    + 'every mark one second and every defect the next').toContain('a defect');
});

test('a filtered walk stops only on that kind, and names the kind at every landing', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvnavkind').selectOption('defect');
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(PER_KIND), { timeout: 10_000 });
  await jumpTo(page, 'top');

  const landed: string[] = [];
  const sections: number[] = [];
  for (let i = 1; i <= PER_KIND; i += 1) {
    await page.locator('.tvnavmarknext').click();
    await expect(page.locator('.tvnavsaid'))
      .toContainText(`${i} of ${PER_KIND}`, { timeout: 10_000 });
    landed.push((await page.locator('.tvnavsaid').textContent() ?? '').trim());
    sections.push(await topSection(page));
  }
  console.log(`[kinds] ${landed.join(' | ')}`);
  console.log(`[kinds] sections ${JSON.stringify(sections)}`);
  for (const said of landed) {
    expect(said, 'a landing announced a position without saying what it is a position IN')
      .toContain('a defect');
  }
  // **THE SECTIONS ARE THE DEFECTS, read off the fixture rather than off the
  // announcement**: a walk that stopped on every mark would still count to
  // four and say "of 4" four times. `KINDS[i % 6] === 'defect'` at i = 3, 9,
  // 15, 21, so these are the records those four marks sit on.
  const wanted = markedAt.filter((_, i) => KINDS[i % KINDS.length] === 'defect');
  expect(sections, 'the filtered walk stopped somewhere other than on the marks of that kind')
    .toEqual(wanted);
});

test('the end of a filtered walk says which kind has run out, and the button stays live', async ({ page }) => {
  await openDoc(page);
  await page.locator('.tvnavkind').selectOption('question');
  await expect(page.locator('.tvnavmarkcount')).toContainText(String(PER_KIND), { timeout: 10_000 });
  await jumpTo(page, 'top');
  await page.locator('.tvnavmarkprev').click();
  const said = (await page.locator('.tvnavsaid').textContent() ?? '').trim();
  console.log(`[kinds] at the first of a kind: "${said}"`);
  expect(said, 'stepping back from the top of a filtered walk said nothing at all').not.toBe('');
  expect(said, 'the end of the walk was announced as a landing')
    .not.toContain(` of ${PER_KIND}`);
  // **"Nothing is marked before this point" is FALSE under a filter**, because
  // twenty marks of other kinds are. The sentence has to carry the kind or it
  // is the count defect one sentence along.
  expect(said, 'the end of a filtered walk claimed nothing at all is marked here, which is '
    + 'false: twenty marks of other kinds are').toContain('a question');
  // A disabled button cannot hold focus, which is why the ends are SAID.
  await expect(page.locator('.tvnavmarkprev'),
    'the button at the end of the walk is inert, so the caret cannot stay on it').toBeEnabled();
});

test('it is a filter over the walk that exists, not a second walk beside it', async ({ page }) => {
  await openDoc(page);
  // **THE ITEM'S OWN CONSTRAINT, ASSERTED AS A COUNT OF CONTROLS**: *"It must
  // reuse that walk rather than grow a second one — two walks that can
  // disagree about where the reader is would be worse than no filter."* One
  // pair of mark buttons, one live region, one count.
  await expect(page.locator('.tvnavmarknext'), 'a second Next mark exists, so there are two '
    + 'walks that can disagree about where the reader is').toHaveCount(1);
  await expect(page.locator('.tvnavmarkprev')).toHaveCount(1);
  await expect(page.locator('.tvnavsaid')).toHaveCount(1);
  await expect(page.locator('.tvnavkind'), 'the filter is more than one control, which is the '
    + 'twelve-buttons shape the item forbids').toHaveCount(1);
});

test('the panel the filter joined is measured, and the filter did not cost it a line', async ({ page }) => {
  await openDoc(page);
  /*
   * **THE MEASUREMENT THE ITEM ASKED FOR, TAKEN THE WAY THE STEPPER LANE TOOK
   * ITS OWN**: *"the lane measures the bar afterwards and reports its height,
   * the way the stepper did."*
   *
   * It is a REMOVAL measurement rather than a threshold, because a threshold
   * would be an absolute number about a layout and would either be met by
   * accident or break on a font change. The surface is measured as shipped,
   * then with the select taken out of the DOM — which is the element set it
   * had before `anchors/6` — and put back in a `finally`. The claim is the
   * item's claim: the filter did not cost a line.
   *
   * **THE SURFACE IS THE STEP PANEL'S BODY SINCE `semantic/15`**, because
   * `.tvnav` no longer exists: the controls left the card. The claim being
   * tested is unchanged — the picker shares a row with the buttons it
   * narrows rather than taking one of its own.
   */
  const measured = await page.evaluate(() => {
    const nav = document.querySelector(
      'dialog.mcpanel[data-panel="navigate"] .tvnavmarks') as HTMLElement;
    const pick = document.querySelector('.tvnavkind') as HTMLElement;
    const parent = pick.parentElement as HTMLElement;
    const next = pick.nextSibling;
    const height = (): number => Math.round(nav.getBoundingClientRect().height);
    /*
     * **LINES, COUNTED AS DISTINCT TOPS OF THE GROUP'S OWN CHILDREN.** The
     * claim being tested is *"the filter did not cost it a line"*, and a
     * pixel equality was the wrong spelling of it even before the surface
     * changed: a `<select>` is a couple of pixels taller than a `.tvjump`
     * whatever else happens, and that is not a line.
     */
    const lines = (): number => {
      /*
       * **TOPS CLUSTERED, NOT COUNTED.** The comment this replaces said it
       * already: the group's own children sit on different baselines — a
       * `<select>`, a chip, two buttons and two counts — so distinct tops
       * report five rows where a reader sees two. Anything within 12 px of
       * another top is the SAME row; a real wrap moves a child by the full
       * height of a control.
       */
      const tops = [...nav.children]
        .map((c) => c.getBoundingClientRect().top).sort((a, b) => a - b);
      let rows = 0;
      let at = -Infinity;
      for (const top of tops) {
        if (top - at > 12) { rows += 1; at = top; }
      }
      return rows;
    };
    const shipped = height();
    const shippedLines = lines();
    try {
      pick.remove();
      return {
        shipped,
        shippedLines,
        without: height(),
        withoutLines: lines(),
        // The TOP of each child, rather than a count alone: the raw numbers
        // are reported so the reader of the log can see the wrap.
        tops: [...nav.children].map((c) => `${(c as HTMLElement).className.split(' ').pop()}`
          + `@${Math.round(c.getBoundingClientRect().top)}`),
      };
    } finally {
      parent.insertBefore(pick, next);
    }
  });
  console.log(`[kinds] the mark group is ${measured.shipped}px on ${measured.shippedLines} `
    + `line(s) with the filter and ${measured.without}px on ${measured.withoutLines} without it; `
    + `its children sit at ${measured.tops.join(' ')}`);
  expect(measured.shipped, 'the group collapsed to nothing, so this measures nothing')
    .toBeGreaterThan(0);
  expect(measured.shippedLines, 'the filter put the mark group on another line — which is the '
    + 'one thing the item forbids, and the reason it is a select rather than twelve buttons')
    .toBe(measured.withoutLines);
  /*
   * **AND WHAT IT DOES COST IS SAID RATHER THAN ASSERTED AWAY.** `semantic/15`
   * moved this group off a full-width strip into a 448 px panel, and the
   * `<select>`'s own box is taller than the buttons beside it: measured at 57
   * px against 49 px in `e2e/`'s fixture, ON ONE LINE. Eight pixels is the
   * control's height and not a wrap, so the item's claim holds; the number is
   * on the lane's report rather than hidden behind an equality that would have
   * had to be loosened to a range nobody could read.
   */
  expect(measured.shipped - measured.without,
    'the filter cost the group a whole line of height, which is a wrap by another name')
    .toBeLessThan(19);
});

/* ══ anchors/7 — THE MARK LIST STOPS SAYING ONE WORD PER ROW ══════════════ */

test('every row in the mark list links with a different word', async ({ page }) => {
  await openArchive(page);
  const drawn = await page.locator('.convanchorsbox .convanchor').count();
  expect(drawn, 'the list is not paged in this fixture, so this measures the wrong list')
    .toBe(CAP);
  const texts = await page.locator('.convanchorsbox .convanchoropen').evaluateAll(
    (nodes) => nodes.map((n) => (n.textContent ?? '').trim()));
  const distinct = new Set(texts);
  console.log(`[label] ${texts.length} links, ${distinct.size} distinct — e.g. ${texts[0]}`);
  // **THE WHOLE ITEM, IN ONE NUMBER.** Every one of these marks is in the SAME
  // conversation, so a link whose text is the session name is the same word on
  // all twenty rows and none of them says where it goes.
  expect(distinct.size, 'two rows of the mark list link with the same word, on a list where '
    + 'every mark is in one conversation — so the link says nothing that tells one row from '
    + 'the next').toBe(texts.length);
});

test('the accessible name differs too, which is where 24 alike is worse', async ({ page }) => {
  await openArchive(page);
  /*
   * **THE NAME THE BROWSER COMPUTES, not the attribute this screen wrote.**
   * `ariaSnapshot` renders the accessibility tree, so what is read below is
   * what a screen reader would be handed — which is the whole point of the
   * item's last paragraph. Reading `aria-label` back would be asserting that
   * the code does what the code says.
   */
  const snapshot = await page.locator('.convanchorsbox').ariaSnapshot();
  const names = [...snapshot.matchAll(/- link "([^"]*)"/g)].map((m) => (m[1] ?? '').trim());
  console.log(`[label] ${names.length} named links; the first is "${names[0]}"`);
  expect(names.length, 'the accessibility tree carries no links at all, so this measures '
    + 'nothing').toBe(await page.locator('.convanchorsbox .convanchoropen').count());
  expect(names.filter((n) => n !== '').length,
    'a link answered with no accessible name at all').toBe(names.length);
  // The item: *"the accessible name is what a screen reader announces — 24
  // links reading alike is worse there than on screen, where at least the
  // surrounding row differs."* Out of its row, the name is all there is.
  expect(new Set(names).size, 'two links announce the same name to a screen reader, and out of '
    + 'its row a link has nothing else to tell it apart by').toBe(names.length);
  /*
   * **AND THE NAME CARRIES BOTH FACTS, which is what makes it a NAME rather
   * than merely a unique string.** The measurement that forced this assertion:
   * with the `aria-label` deleted, the name falls back to the link's own text
   * — which is the byte, and is already distinct — so the test above stayed
   * green over a link that no longer said WHICH conversation it opens. Out of
   * its row that is exactly the half a screen reader has no other way to get.
   */
  const thin = names.filter((n) => !n.includes(SESSION.slice(0, 8))
    || !/\d{3,}/.test(n));
  expect(thin, 'a link announces a position with no conversation, or a conversation with no '
    + 'position — out of its row, a screen reader has neither from anywhere else').toEqual([]);
});

test('the fix did not grow a control — the row still has exactly one way in', async ({ page }) => {
  await openArchive(page);
  const perRow = await page.locator('.convanchorsbox .convanchor').evaluateAll(
    (rows) => rows.map((r) => r.querySelectorAll('a').length));
  console.log(`[label] links per row: ${JSON.stringify([...new Set(perRow)])}`);
  // **THE PREVIOUS LANE'S JUDGEMENT, HELD.** It refused to add a second
  // control beside one that already worked, and the item says the refusal
  // stands: *"If the fix grows a control, it has gone wrong."*
  expect(new Set(perRow), 'a row carries a number of links other than one — a second control '
    + 'beside one that already does the job is D58 exactly').toEqual(new Set([1]));
  // And the conversation's name did not go missing when it stopped being the
  // link: `INV-nothing-is-dropped-silently` applied to a row rather than a list.
  await expect(page.locator('.convanchorsbox .convanchor').first().locator('.convanchorsession'),
    'the conversation name was removed rather than moved, so the row no longer says which '
    + 'conversation the mark is in').toContainText(SESSION.slice(0, 8));
});

/**
 * **BORROWED POWER, DISCLOSED.** This asserts the address the relabelled link
 * carries, and NOT that following it lands the document on the point —
 * `e2e/anchors.spec.ts` drives that end to end and is where a broken landing
 * would be caught first. What is measured here is the one thing `anchors/7`
 * could have broken: the item is about the TEXT, so the assertion that matters
 * is that the text changed and the address did not.
 */
test('the address is unchanged — the label moved, the control did not', async ({ page }) => {
  await openArchive(page);
  const hrefs = await page.locator('.convanchorsbox .convanchoropen').evaluateAll(
    (nodes) => nodes.map((n) => n.getAttribute('href') ?? ''));
  console.log(`[label] first address: ${hrefs[0]}`);
  const shaped = hrefs.filter((h) => new RegExp(`^/#/conversations/at/${SESSION}/\\d+$`).test(h));
  expect(shaped.length, 'a go-to link stopped carrying the byte the anchor stores')
    .toBe(hrefs.length);
});
