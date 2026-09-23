// @basis TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the,
// TASK-the-find-options-the-owner-asked-for-twice-in-a-floating,
// TASK-the-find-panel-offers-regular-expressions-and-no-help-and,
// TASK-the-find-panel-s-counts-move-as-you-type-and-the-regex-mode,
// DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn,
// INV-nothing-is-dropped-silently,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a
/**
 * **THE FLOATING SEARCH PANEL** — `semantic/9`, and the owner specified the
 * shape himself: *"three different subjects on three different dialogs opend
 * from the right mouse button menu, could be a little bit transparent,
 * movable on screen, stays on screen while you can look at the viewer and
 * closed uppon clicking it's close button as a standard window."*
 *
 * ── WHY EVERY ONE OF THESE HAS TO BE A BROWSER TEST ──────────────────────
 *
 * `<dialog>.show()` versus `.showModal()` is not a fact about a function, it
 * is a fact about whether the rest of the page still answers. A drag is a
 * sequence of real pointer events against a real layout. `:modal` is a
 * pseudo-class the engine owns. And the measurement the item actually
 * requires — *"report the strip's height before and after; if it does not
 * shrink, the change has not landed"* — is a box in a rendered page.
 *
 * `test/ui/panel.test.ts` owns the frame's RULES (the store, the clamp) and
 * `test/ui/fold.test.ts` owns the option semantics. What is left is exactly
 * the part a unit test cannot see.
 *
 * ── THE FIXTURE, AND WHAT EACH PART OF IT IS FOR ─────────────────────────
 *
 *   — **Sixty long turns**, so the document really virtualises. A four-turn
 *     fixture draws every row and the whole reason this feature is
 *     server-side stops being visible.
 *   — **`Byte`, `byte` and `bytes`**, each in its own turn, so Match case and
 *     Whole word each have a number that MOVES. A fixture where an option
 *     changes nothing proves an option that does nothing.
 *   — **One Hebrew turn carrying `שורה` and the glued `השורה`**, because that
 *     is the one place Whole word means something different from what a Latin
 *     reader expects, and the panel draws a sentence about it.
 *   — **`semantic/11` added four turns and no more.** `alpha7beta
 *     alpha77beta alphabeta` is the only shape where `?` and `*` give
 *     DIFFERENT answers, so a wildcard test on it cannot pass by accident; and
 *     three turns over `tango` and `quebec` — both, one, the other — are the
 *     minimum for AND, OR and NOT to each have a number that moves. None of
 *     them holds `byte`, `offset` or a Hebrew letter, so every number
 *     `semantic/9` asserted above is unchanged.
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

const SESSION = 'sess-find-panel';
const HEB = 'שורה';
const HEB_GLUED = `ה${HEB}`;

let harness: UiHarness | undefined;
let cwd = '';
let home = '';

function transcript(): unknown[] {
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 9, 6, 0, n)).toISOString();
  const rows: unknown[] = [{ type: 'ai-title', aiTitle: 'A session to search in' }];
  const filler = 'This turn is long enough that the scroll has to virtualise it. '.repeat(24);
  for (let i = 0; i < 60; i += 1) {
    rows.push({
      type: 'user',
      message: { role: 'user', content: `question ${i} about the archive` },
      timestamp: at(i * 2),
      gitBranch: 'master',
    });
    // Three shapes of the same word, one per five turns, so Match case and
    // Whole word each have a number that moves rather than a number that
    // stays: `Byte offset` / `byte offset` / `byte offsets`.
    const word = i % 15 === 0 ? 'Byte offset'
      : i % 15 === 5 ? 'byte offset'
        : i % 15 === 10 ? 'byte offsets' : 'nothing in particular';
    rows.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: `${filler}${word} in answer ${i}. ${filler}` }] },
      timestamp: at(i * 2 + 1),
    });
  }
  rows.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: `${filler}${HEB_GLUED} וגם ${HEB}. ${filler}` }],
    },
    timestamp: at(200),
  });
  // `semantic/11`. Each of these four is the SMALLEST fixture that makes one
  // of the new answers move; see the header.
  const extra = [
    // `alpha?beta` reaches exactly one of these three and `alpha*beta` all
    // three, which is the whole difference between the two wildcards.
    'alpha7beta alpha77beta alphabeta',
    // `tango and quebec` — five characters between them, so NEAR/5 pairs them
    // and NEAR/2 does not, and the unit being CHARACTERS is what that proves.
    'tango and quebec stand together',
    'tango stands here without the other one',
    'quebec stands here without the other one',
  ];
  extra.forEach((text, i) => {
    rows.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: `${filler}${text}. ${filler}` }] },
      timestamp: at(210 + i),
    });
  });
  return rows;
}

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'myctx-panel-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'myctx-panel-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${SESSION}.jsonl`),
    `${transcript().map((r) => JSON.stringify(r)).join('\n')}\n`,
  );
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
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
  const nonce = await mintNonce(harness!.port);
  await page.goto(`http://127.0.0.1:${harness!.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await dismissSkew(page);
  await page.evaluate((s) => { location.hash = `#/conversations/${s}`; }, SESSION);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  await dismissSkew(page);
}

/**
 * **THIS PANEL, BY NAME** — `semantic/12` and `semantic/13`.
 *
 * `dialog.mcpanel` addressed exactly one element while search was the frame's
 * only caller. There are three now, so every locator below that evaluates ONE
 * element says WHICH, through the `data-panel` handle `createPanel` has
 * always written for exactly this. Six tests in this file went strict-mode
 * red the moment the navigation panel mounted, which is the handle earning
 * its place rather than a cost of the new panels.
 *
 * `dialog.mcpanel[open]` is left alone wherever it COUNTS rather than
 * evaluates: "how many panels are open" is still the question those
 * assertions ask, and the answer is still one.
 */
const SEARCH = 'dialog.mcpanel[data-panel="search"]';

/** Open the panel the way a reader does: right-click, then the Search row. */
async function openPanel(page: Page): Promise<void> {
  await page.locator('.tvrow .tvsaid').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  // Named by its keyboard shortcut rather than by its words, so this test is
  // the same test in both languages.
  await page.locator('.tvmenu .tvmenuitem[aria-keyshortcuts="/"]').click();
  await expect(page.locator(`${SEARCH}[open]`)).toHaveCount(1, { timeout: 10_000 });
}

/**
 * Type into the find box and wait past the 250 ms settle and the scan.
 *
 * **`semantic/15` GAVE THE BOX ONE HOME.** It was borrowed out of `.tvbar`
 * while this panel was open and put back when it shut; the owner then asked
 * for the controls to leave the card altogether, so the panel is opened first
 * — which is what a reader does, and what `/` does for them.
 */
async function find(page: Page, query: string): Promise<void> {
  if (await page.locator(`${SEARCH}[open]`).count() === 0) await openPanel(page);
  await page.locator(`${SEARCH} .tvfind`).fill(query);
  await page.waitForTimeout(2_500);
}

/** Tick or untick one option and wait for the re-scan it causes. */
async function option(page: Page, which: string, on: boolean): Promise<void> {
  const box = page.locator(`.${which} input`);
  if (await box.isChecked() !== on) await box.setChecked(on);
  await page.waitForTimeout(2_500);
}

/**
 * Choose one of the four ways of reading a query — `semantic/11`.
 *
 * A RADIO and not a checkbox, which is the shape of the whole change: exactly
 * one is in force and choosing one gives the previous one up, with no state to
 * set to `false`.
 */
async function mode(page: Page, which: string): Promise<void> {
  await page.locator(`.mcmode${which} input`).check();
  await page.waitForTimeout(2_500);
}

/** How many ranges are painted over the rows that are drawn right now. */
async function painted(page: Page): Promise<number> {
  return page.evaluate(() => [...(CSS.highlights.get('mycontextfind') ?? [])].length);
}

/** How many turns the stepper says hold the query. */
async function held(page: Page): Promise<number> {
  const text = (await page.locator('.tvnavfoundcount').textContent()) ?? '';
  const numbers = [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
  return numbers[0] ?? 0;
}

for (const lang of ['en', 'he'] as const) {
  /* ══ 1 — IT IS NOT MODAL, WHICH IS THE WHOLE POINT ═══════════════════════ */

  test(`the panel opens from the right-click menu and leaves the viewer live (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    const panel = page.locator(SEARCH);

    /*
     * **`show()` AND NEVER `showModal()`.** *"stays on screen while you can
     * look at the viewer"* — a modal dialog makes the whole page behind it
     * inert, so the viewer would be dead while the panel is open. `:modal` is
     * the engine's own answer to which one was called, and it is asserted
     * rather than inferred from the absence of a backdrop.
     */
    expect(await panel.evaluate((d) => (d as HTMLDialogElement).open)).toBe(true);
    expect(await panel.evaluate((d) => d.matches(':modal')),
      'showModal() was called, and the viewer behind this is now inert').toBe(false);

    // And the viewer really does still answer: scroll it while the panel is
    // open. A modal dialog blocks this, which is what makes it a real test of
    // the sentence above rather than a restatement of it.
    const moved = await page.locator('.tvscroll').evaluate((el) => {
      const before = el.scrollTop;
      el.scrollTop = 900;
      return el.scrollTop !== before;
    });
    expect(moved, 'the viewer did not scroll with the panel open').toBe(true);
    await expect(page.locator('dialog.mcpanel[open]'),
      'and the panel is still there after the page behind it moved').toHaveCount(1);
  });

  /* ══ 2 — THERE IS NO STRIP LEFT TO SHRINK ════════════════════════════════ */

  test(`the panel owns the find box and the card carries no strip at all (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const chrome = async (): Promise<number> => page.evaluate(() => {
      const head = document.querySelector('.tvhead')!.getBoundingClientRect();
      const well = document.querySelector('.tvscroll')!.getBoundingClientRect();
      return Math.round((well.top - head.top) * 10) / 10;
    });

    /*
     * **THE ITEM'S ACCEPTANCE TEST WAS *"if it does not shrink, the change has
     * not landed"* AND `semantic/15` RETIRED THE QUESTION.** The owner looked
     * at the result of the lend and pointed out that with every panel SHUT the
     * card had not shrunk at all, because the controls came back. So the
     * measurement is now taken with nothing open, and what it measures is that
     * the strips do not exist.
     */
    const idle = await chrome();
    console.log(`[card ${lang}] chrome above the viewer, panel shut: ${idle}px`);
    expect(await page.locator('.tvbar').count(), 'the button bar is still on the card').toBe(0);
    expect(await page.locator('.tvnav').count(), 'the stepper strip is still on the card').toBe(0);

    await find(page, 'byte offset');
    // And the controls are in the panel rather than merely gone, which is the
    // half a "did it shrink" assertion cannot tell apart from a broken build.
    const panel = page.locator(SEARCH);
    for (const which of ['.tvfind', '.tvnavfounds', '.mcpanelclear']) {
      expect(await panel.locator(which).count(), `${which} is not in the panel`).toBe(1);
    }
    /*
     * **AND THE COUNT SENTENCE IS NOT AMONG THEM, WHICH IS `semantic/15` §3.**
     * `p.tvcount` is a DISCLOSURE — it says what a search is holding back —
     * and a disclosure legible only while a panel happens to be open is the
     * defect the lend existed to prevent, arriving by the other door. It is on
     * the card, under *"Back to all sessions"*, and it is up right now because
     * the query above is hiding sections.
     */
    expect(await panel.locator('p.tvcount').count(),
      'the disclosure was moved into the panel a reader may have shut').toBe(0);
    await expect(page.locator('.tvroot > p.tvcount'),
      'the search is hiding sections and the card says nothing about it').toBeVisible();
    // The card grew to hold it, and the well gave the room up — which is the
    // outer-scroll fix working rather than the page overflowing.
    expect(await chrome(), 'the disclosure was drawn with no room made for it')
      .toBeGreaterThan(idle);
    expect(await page.evaluate(() => {
      const b = document.querySelector('.body')!;
      return b.scrollHeight <= b.clientHeight + 2;
    }), 'the card grew the page past the window instead of taking it from the well').toBe(true);
  });

  /* ══ 3 — DRAG, CLOSE, REOPEN WHERE IT WAS LEFT ═══════════════════════════ */

  test(`the panel drags, closes on its own button, and reopens where it was left (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    const panel = page.locator(SEARCH);
    const at = async (): Promise<{ left: number; top: number }> =>
      panel.evaluate((d) => {
        const b = d.getBoundingClientRect();
        return { left: Math.round(b.left), top: Math.round(b.top) };
      });

    const start = await at();
    const grip = await page.locator(`${SEARCH} .mcpanelhead`).boundingBox();
    expect(grip).not.toBeNull();
    // A real pointer drag. `mouse.move` with steps, so `pointermove` fires
    // more than once and a handler that only reads the last event is caught.
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    /*
     * **AWAY FROM THE START EDGE, AND THE SIGN IS READ OFF THE PAGE.** A
     * panel opens 24px in from the START edge, which is the LEFT in English
     * and the RIGHT in Hebrew — so one fixed physical direction runs into the
     * clamp in one of the two languages. It did, twice, in both directions,
     * and each time the test reported "the panel did not follow the pointer"
     * about a build in which it had.
     *
     * What is asserted is unchanged and is the thing that matters: the panel
     * moves by the PHYSICAL delta of the pointer, whichever way the page
     * reads. Only the headroom differs.
     */
    const rtl = await page.evaluate(() =>
      document.documentElement.getAttribute('dir') === 'rtl');
    const dx = rtl ? -120 : 120;
    await page.mouse.move(grip!.x + grip!.width / 2 + dx, grip!.y + grip!.height / 2 + 90,
      { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const dragged = await at();
    console.log(`[drag ${lang}] ${JSON.stringify(start)} -> ${JSON.stringify(dragged)} (dx ${dx})`);
    expect(dragged.left, 'the panel did not follow the pointer').toBe(start.left + dx);
    expect(dragged.top).toBe(start.top + 90);

    // **CLOSED ON ITS OWN BUTTON, AS A STANDARD WINDOW** — his words.
    await page.locator(`${SEARCH} .mcpanelclose`).click();
    await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
    /*
     * **AND NOTHING GOES HOME, BECAUSE THERE IS NOWHERE TO GO** —
     * `semantic/15`. This asserted the restore until 2026-09-17; it asserts
     * the opposite contract now, rather than being deleted, because a control
     * escaping onto the card would otherwise go unnoticed.
     */
    expect(await page.locator(`${SEARCH} .tvfind`).count(),
      'the find box left the panel when it closed').toBe(1);
    expect(await page.locator('.tvroot > .tvfind').count(),
      'the find box came back out onto the card').toBe(0);
    // And the caret is not on the body, which is the 47-tab-stop defect this
    // screen has already been repaired for once.
    expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe('BODY');

    await openPanel(page);
    expect(await at(), 'it did not come back where it was left').toEqual(dragged);
  });

  /* ══ 4 — ESCAPE, WHICH `show()` DOES NOT GIVE YOU ════════════════════════ */

  test(`Escape closes the panel, and only the panel (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **ESCAPE ONLY AUTO-CLOSES A MODAL DIALOG.** With `show()` the browser
     * sends no `cancel` and closes nothing, so this passes only because the
     * key is wired by hand. Deleting that listener reddens here and nowhere
     * else.
     */
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
    expect(await page.locator(`${SEARCH} .tvfind`).count()).toBe(1);

    // And the key still means what it meant with the panel shut: `confirm/5`
    // bound it on the rename box and `app.js` on the item pane, and this is a
    // fourth innermost thing rather than a third meaning.
    const row = page.locator('.tvrow[data-n="0"]');
    const write = row.locator('.tvanchormark');
    if (await write.count() > 0) {
      await write.click();
      await expect(row.locator('.tvanchorinput')).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(row.locator('.tvanchorbox:not([hidden])'),
        'Escape stopped closing the rename box').toHaveCount(0);
    }
  });

  /* ══ 5 — THE THREE OPTIONS, AND EACH SAYS WHAT IT CHANGED ════════════════ */

  test(`Match case narrows the answer over the whole transcript (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');
    const all = await held(page);
    // 4 turns say `Byte offset`, 4 say `byte offset`, 4 say `byte offsets`.
    expect(all, 'the fixture must hold every casing').toBe(12);

    await option(page, 'mcoptcase', true);
    const cased = await held(page);
    console.log(`[case ${lang}] ${all} -> ${cased}`);
    expect(cased, 'Match case changed nothing, so it is a control that does nothing').toBe(8);

    // **AND IT IS A COUNT OVER THE WHOLE TRANSCRIPT, NOT OVER THE ROWS
    // DRAWN** — the virtualised-DOM defect this project exists to refuse.
    expect(await page.locator('.tvrow').count()).toBeLessThan(cased);
    // The sentence that says what was traded.
    await expect(page.locator('.mcnotecase')).toBeVisible();
    await option(page, 'mcoptcase', false);
    await expect(page.locator('.mcnotecase')).toBeHidden();
  });

  test(`Whole word drops a longer word, and says what it costs in Hebrew (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');
    expect(await held(page)).toBe(12);
    await option(page, 'mcoptword', true);
    console.log(`[word ${lang}] 12 -> ${await held(page)}`);
    expect(await held(page), '`byte offsets` is not `byte offset`').toBe(8);

    // The English sentence is drawn; the Hebrew one is NOT, because the
    // query holds no Hebrew and a sentence about a particle that is not in
    // what he typed is noise.
    await expect(page.locator('.mcnoteword')).toBeVisible();
    await expect(page.locator('.mcnotewordheb')).toBeHidden();

    /*
     * **AND NOW THE HEBREW QUERY, WHICH IS THE CASE THE GRAMMAR REPORT
     * REFUSED THE OPTION OVER** (§6: *"in Hebrew it is worse than useless,
     * because the whole reason this index is trigram is that Hebrew glues
     * particles onto word fronts"*). It is true, and it is why the sentence
     * exists rather than why the control does not.
     */
    await find(page, HEB);
    await expect(page.locator('.mcnotewordheb')).toBeVisible();
    const whole = await held(page);
    await option(page, 'mcoptword', false);
    const loose = await held(page);
    console.log(`[hebrew ${lang}] whole ${whole} loose ${loose}`);
    expect(loose, 'the glued form is found without the option').toBe(1);
    expect(whole, 'and dropped with it — which is what the sentence says').toBe(1);
    // The turn is the same turn; what changes is how many times it holds it.
    const painted = await page.evaluate(() =>
      [...(CSS.highlights.get('mycontextfind') ?? [])].length);
    expect(painted, 'both the bare word and the glued one are painted').toBeGreaterThan(0);
  });

  test(`a regular expression runs, and says what it cannot do (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await mode(page, 'regex');
    await find(page, 'byte\\s+offsets?');
    expect(await held(page), 'one pattern reaches all three shapes').toBe(12);
    // The two sentences a pattern always carries: what mode this is, and that
    // it reads the text unfolded rather than the way the other mode does.
    await expect(page.locator('.mcnotere')).toBeVisible();
    await expect(page.locator('.mcnoterefold')).toBeVisible();
    // And the measurement the item asks for, on the screen.
    await expect(page.locator('.mcnotecost')).toBeVisible();
    console.log(`[regex ${lang}] ${(await page.locator('.mcnotecost').textContent())?.trim()}`);

    // **A BROKEN PATTERN IS THE ENGINE'S OWN MESSAGE**, not a rewrite of it
    // and not an empty result the reader cannot tell from "not there".
    await find(page, '[');
    await expect(page.locator('.mcnoterebad')).toBeVisible();
    await expect(page.locator('.mcnotecost'),
      'a pattern that did not compile scanned nothing, so nothing may claim a cost').toBeHidden();

    /*
     * **AND THE SHAPE THAT FROZE THE SCAN IS REFUSED BEFORE IT IS RUN.**
     * Measured on this repository's own 139 MB session on 2026-09-16:
     * `^(\w+\s?)+$` took 108,785 ms. The time budget cannot end that — it is
     * checked between spans and the freeze is inside one, in V8's regex
     * engine, which cannot be interrupted from JavaScript.
     */
    await find(page, '^(\\w+\\s?)+$');
    await expect(page.locator('.mcnoterefused')).toBeVisible();
    await expect(page.locator('.mcnoterebad'),
      'a legal pattern that was not run is not a broken one').toBeHidden();
  });

  /* ══ 6 — WHICH MATCH AM I ON ═════════════════════════════════════════════ */

  test(`the match you are standing on is not the colour of the others (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');
    const registry = async (): Promise<{ all: number; now: string[] }> => page.evaluate(() => ({
      all: [...(CSS.highlights.get('mycontextfind') ?? [])].length,
      now: [...(CSS.highlights.get('mycontextfindnow') ?? [])].map((r) => (r as Range).toString()),
    }));

    const before = await registry();
    expect(before.all, 'nothing is painted at all').toBeGreaterThan(0);
    expect(before.now,
      'a match is marked as current before the reader has stepped to one').toEqual([]);

    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(800);
    const after = await registry();
    console.log(`[current ${lang}] all ${before.all} -> ${after.all}, now ${JSON.stringify(after.now)}`);
    expect(after.now.length, 'the reader cannot see which match they are on').toBe(1);
    expect(after.now[0]?.toLowerCase()).toContain('byte offset');
    // It moved OUT of the ordinary set rather than being painted twice: one
    // range can wear one colour, and registering it in both would make which
    // one wins depend on registration order.
    expect(after.all).toBe(before.all - 1);
    expect(await page.evaluate(() => CSS.highlights.get('mycontextfindnow')?.priority)).toBe(1);

    // And it is given up the moment the reader takes the scroll back, because
    // they are no longer standing on it.
    await page.locator('.tvscroll').evaluate((el) => {
      el.dispatchEvent(new WheelEvent('wheel', { bubbles: true }));
    });
    await page.waitForTimeout(600);
    await page.locator('.tvscroll').evaluate((el) => { el.scrollTop += 40; });
    await page.waitForTimeout(600);
    expect((await registry()).now,
      'the current-match colour outlived the walk it belongs to').toEqual([]);
  });

  /* ══ 7 — FOUR WAYS TO READ A QUERY, AND EXACTLY ONE AT A TIME ════════════ */

  test(`the four modes are a radio group, so exactly one is ever in force (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **THE SHAPE, AND IT IS THE ITEM'S OWN QUESTION.** *"What must NOT happen
     * is four checkboxes tickable in combinations nobody defined."* Notepad++,
     * which the owner named, uses a radio group for exactly this; what is
     * asserted here is the property that makes it one — choosing a mode gives
     * the previous one up, with nothing to unset and no state in between.
     */
    const boxes = page.locator('.mcpanelmodes input');
    await expect(boxes).toHaveCount(4);
    const kinds = await boxes.evaluateAll((els) =>
      [...new Set(els.map((e) => (e as HTMLInputElement).type))]);
    expect(kinds, 'a mode is a radio, not a checkbox').toEqual(['radio']);
    const on = async (): Promise<string[]> => boxes.evaluateAll((els) => els
      .filter((e) => (e as HTMLInputElement).checked)
      .map((e) => (e as HTMLInputElement).value));
    expect(await on(), 'the plain mode is the one that shipped').toEqual(['normal']);
    for (const which of ['wildcard', 'logical', 'regex', 'normal']) {
      await page.locator(`.mcmode${which} input`).check();
      expect(await on(), `${which} did not take the selection alone`).toEqual([which]);
    }
    // And the two questions that are NOT about reading stay independent boxes,
    // which is the other half of the shape.
    const opts = page.locator('.mcpanelopts input');
    await expect(opts).toHaveCount(2);
    expect(await opts.evaluateAll((els) =>
      [...new Set(els.map((e) => (e as HTMLInputElement).type))])).toEqual(['checkbox']);
  });

  /* ══ 8 — WILDCARDS, AND `?` IS NOT `*` ═══════════════════════════════════ */

  test(`a wildcard is stitched from folded pieces over the whole transcript (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await mode(page, 'wildcard');

    /*
     * **THE TWO WILDCARDS GIVE DIFFERENT ANSWERS ON ONE TURN**, which is what
     * makes this a test of `?` rather than a test that something ran.
     * `alpha7beta alpha77beta alphabeta` is in one turn: `*` reaches all three
     * and `?` reaches only the one with exactly one character in the gap.
     */
    await find(page, 'alpha*beta');
    expect(await held(page), 'the star did not reach the turn').toBe(1);
    const stars = await painted(page);
    await find(page, 'alpha?beta');
    expect(await held(page)).toBe(1);
    const ones = await painted(page);
    console.log(`[wildcard ${lang}] * painted ${stars}, ? painted ${ones}`);
    expect(ones, '`?` must be exactly one character, not any run').toBeLessThan(stars);

    // **AND THE PIECES FOLD**, which is the whole reason this is not compiled
    // to a regular expression: `by?e offset` reaches every casing over the
    // whole transcript while fewer rows than that are drawn.
    await find(page, 'by?e offset');
    expect(await held(page)).toBe(12);
    expect(await page.locator('.tvrow').count()).toBeLessThan(12);
    await expect(page.locator('.mcnotewild')).toBeVisible();
    await expect(page.locator('.mcnotewildfold')).toBeVisible();
    await expect(page.locator('.mcnotecost')).toBeVisible();

    /*
     * **A WILDCARD CANNOT BE REFUSED FOR ITS SHAPE.** The star-heavy source
     * below is the shape `nestedQuantifier` refuses as a pattern; here it is
     * five literal pieces and it runs. The refusal note staying down is the
     * assertion — the item forbids showing a reader a regular expression they
     * never typed.
     */
    await find(page, '*a*a*a*a*');
    await expect(page.locator('.mcnoterefused')).toBeHidden();
    await expect(page.locator('.mcnoterebad')).toBeHidden();
  });

  /* ══ 9 — THE OPERATORS, AND WHAT THE TWO COUNTS MEAN UNDER `AND` ═════════ */

  test(`AND, OR, NOT and NEAR are answered by the scan, not by the page (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await mode(page, 'logical');

    // Three turns: one holds both, one holds each. Each operator therefore has
    // a number that MOVES, which is what a fixture has to buy.
    await find(page, 'tango AND quebec');
    expect(await held(page), 'AND must narrow to the turn holding both').toBe(1);
    const bothPainted = await painted(page);
    expect(bothPainted, 'AND paints BOTH terms — the item asks this directly')
      .toBeGreaterThanOrEqual(2);

    await find(page, 'tango OR quebec');
    expect(await held(page), 'OR is a union of the three turns').toBe(3);
    await find(page, 'tango NOT quebec');
    expect(await held(page), 'NOT keeps the left and drops the turn holding both').toBe(1);

    /*
     * **`NEAR`'s UNIT IS CHARACTERS, AND THIS IS WHERE THAT IS PINNED.**
     * `tango and quebec` has five characters between the two words, so a
     * distance of 5 pairs them and a distance of 2 does not. A build that
     * counted WORDS would pass both lines, so the pair is the assertion.
     */
    await find(page, 'tango NEAR/5 quebec');
    expect(await held(page), 'five characters apart is within five').toBe(1);
    await find(page, 'tango NEAR/2 quebec');
    expect(await held(page), 'and not within two — so the unit is characters').toBe(0);

    // **THE COUNT IS OVER THE WHOLE TRANSCRIPT**, which is the constraint the
    // item calls the hardest: a mode implemented in the page would see only
    // the rows the virtualiser drew.
    await find(page, 'byte OR question');
    expect(await held(page)).toBeGreaterThan(await page.locator('.tvrow').count());

    await expect(page.locator('.mcnotelog')).toBeVisible();
    await expect(page.locator('.mcnotelogcount')).toBeVisible();
    await expect(page.locator('.mcnotelognear')).toBeVisible();

    // **AND `LIKE` IS REFUSED BY NAME**, as the wildcard mode under another
    // spelling — not read as a word, and not an engine error either.
    await find(page, 'tango LIKE t%');
    await expect(page.locator('.mcnotewhy')).toBeVisible();
    await expect(page.locator('.mcnoterebad'),
      'there is no engine here to quote, so nothing may claim one spoke').toBeHidden();
    await expect(page.locator('.mcnotecost'),
      'nothing was searched for, so nothing may claim a cost').toBeHidden();
    // A grammar failure is a different sentence from `LIKE`, and a readable
    // query takes both down again.
    await find(page, 'tango AND');
    await expect(page.locator('.mcnotewhy')).toBeVisible();
    await find(page, 'tango AND quebec');
    await expect(page.locator('.mcnotewhy')).toBeHidden();
  });

  /* ══ 10 — THE HELP, AND EVERY EXAMPLE IN IT IS A BUTTON THAT RUNS ════════ */

  test(`the help changes with the mode and its examples run when clicked (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    const help = page.locator('.mcpanelhelp');
    await expect(help, 'the help is shut until it is asked for')
      .not.toHaveAttribute('open', /.*/);
    await help.locator('summary').click();
    await expect(help).toHaveAttribute('open', /.*/);

    // Each mode brings its own examples, and they are not the same list.
    const examples = async (): Promise<string[]> =>
      page.locator('.mcpanelegq').allTextContents();
    const plain = await examples();
    expect(plain.length).toBeGreaterThan(0);
    await mode(page, 'regex');
    const pattern = await examples();
    expect(pattern, 'the help did not follow the mode').not.toEqual(plain);
    // The help stays OPEN across a mode change: a reader who asked for it is
    // still reading it.
    await expect(help).toHaveAttribute('open', /.*/);

    /*
     * **CLICKING AN EXAMPLE PUTS IT IN THE BOX AND RUNS IT**, which the item
     * asks for in as many words. The LAST pattern example is the shape that is
     * REFUSED, and that is deliberate: it is how a reader who met the refusal
     * finds out why. Clicking it must produce the refusal and not an error.
     */
    const last = page.locator('.mcpanelegq').last();
    const text = await last.textContent();
    await last.click();
    await page.waitForTimeout(2_500);
    expect(await page.locator('.tvfind').inputValue()).toBe(text);
    await expect(page.locator('.mcnoterefused'),
      'the help example for the refusal did not produce it').toBeVisible();
    await expect(page.locator('.mcnoterebad')).toBeHidden();
    // And the sentence that says WHY it is refused is in the help itself, not
    // only in the warning under the box.
    await expect(page.locator('.mcpanelhelpbody')).toContainText('108,785');

    // A working example runs and answers. `\d+ ms` finds nothing in this
    // fixture, so the one asserted is that the query really reached the scan.
    await mode(page, 'wildcard');
    const first = page.locator('.mcpanelegq').first();
    const wild = await first.textContent();
    await first.click();
    await page.waitForTimeout(2_500);
    expect(await page.locator('.tvfind').inputValue()).toBe(wild);
    await expect(page.locator('.tvnavfoundcount')).toBeVisible();
  });

  /* ══ 10a — AND IT STAYS ON THE SCREEN, WHATEVER THE HELP ADDS ═══════════ */

  test(`the panel never runs off the bottom of the screen (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **FOUND BY LOOKING AT A SCREENSHOT**, which is the second time on this
     * panel: `reports/2026-09-16-the-find-panel.md` §5.5 is the first, a find
     * field 470 px tall that sixteen green browser tests did not care about.
     *
     * `styles.css` bounds the panel with `calc(100vh - 4rem)`, which bounds its
     * HEIGHT and not where its bottom LANDS. Opened 284 px down with the help
     * open, it was 936 px tall in a 1000 px viewport — the stepper and the
     * count line, which are the two things the reader came for, 220 px below
     * the bottom edge of a `position:fixed` box that does not scroll with the
     * page. A fixed element cannot be bounded against its own top in CSS and
     * the top is not a constant, so `lib/panel.js` writes the bound on every
     * placement.
     *
     * The help is opened first because that is what makes the panel tall
     * enough to reach the edge at all; with it shut the panel is ~406 px and
     * this assertion would pass on the broken build.
     */
    /*
     * **AND THE HELP BEING OPEN IS A PRECONDITION, SAID AS ONE** — B4 fix
     * round 3, 2026-09-23 (`TASK-two-browser-gates-are-red-before-any-lane-
     * touches-them-and`). On Ubuntu CI, and only in the `he`/`chrome` variant
     * of four, this test failed reporting a panel 162 px tall against the
     * `> 200` guard below. 162 px is not a font metric: it is the panel with
     * the help SHUT. A click that did not land, or a re-render that shut it,
     * was being reported as "the panel is too short", which is a statement
     * about the layout produced by a statement about an interaction. So the
     * click is now followed by the retrying assertion that it took, and the
     * state is re-asserted after the two actions that rebuild the panel —
     * `mode()` and `find()` — because "the help stays open across a mode
     * change" is a property this file already measures two tests up and is
     * exactly the one this test is leaning on.
     */
    const helpBox = page.locator('.mcpanelhelp');
    await page.locator('.mcpanelhelp summary').click();
    await expect(helpBox, 'the help did not open, so the panel below is the short one')
      .toHaveAttribute('open', /.*/);
    await mode(page, 'logical');
    await find(page, 'byte AND question');
    await expect(helpBox, 'the help was shut again by the mode change or the search, so the '
      + 'panel measured below is not the tall one this test is about')
      .toHaveAttribute('open', /.*/);

    /*
     * **AND IT IS DRAGGED DOWN FIRST, BECAUSE THE FIRST DRAFT OF THIS TEST
     * REDDENED NOTHING.** The proof was run — the bound deleted from
     * `lib/panel.js`, this file re-run — and it passed, because in THIS
     * fixture the bar is short and the panel opens near the top, where the
     * static `calc(100vh - 4rem)` already keeps it on screen. On the live
     * session the bar is 284 px down and that is the whole defect. So the
     * panel is put where the defect lives: as far down as the frame's own
     * clamp allows, which is `KEEP_VISIBLE_PX` from the bottom.
     */
    const grip = await page.locator(`${SEARCH} .mcpanelhead`).boundingBox();
    expect(grip).not.toBeNull();
    /*
     * **AIMED AT A FRACTION OF THE WINDOW, NOT MOVED BY A FIXED 260 px** —
     * `semantic/15`. The panel opens at the top of the WELL now rather than
     * under a strip of controls, and the strip was ~199 px tall, so a fixed
     * delta lands the panel somewhere else than it used to and the bound it is
     * measured against (`calc(100vh - top - 1rem)`) moves with it. Aiming at
     * 55% of the window says what the drag is FOR — put the panel where its
     * own bottom is the thing at risk — in a way a layout change cannot
     * silently repoint.
     */
    const seat = page.viewportSize();
    expect(seat).not.toBeNull();
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip!.x + grip!.width / 2, Math.round(seat!.height * 0.55),
      { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const fits = await page.locator(SEARCH).evaluate((d) => {
      const box = d.getBoundingClientRect();
      return { top: Math.round(box.top), bottom: Math.round(box.bottom),
        height: Math.round(box.height), content: d.scrollHeight,
        viewport: window.innerHeight, scrolls: d.scrollHeight > d.clientHeight };
    });
    console.log(`[fit ${lang}] ${JSON.stringify(fits)}`);
    expect(fits.top, 'the panel was not dragged down, so this cannot see the defect')
      .toBeGreaterThan(100);
    /*
     * **THE ANTI-VACUITY GUARD IS THE PROPERTY, NOT A PIXEL COUNT** — B4 fix
     * round 3, 2026-09-23. It used to read `fits.height > 200`, a number
     * standing in for "this panel is tall enough that the bound below had
     * something to do", and a number is the wrong instrument for that: panel
     * height is font metrics times content, and the two browsers and two
     * languages this file runs in do not agree on either.
     *
     * The property it MEANT is here instead, in the units the defect is in:
     * laid out from where it actually sits, this panel's own content reaches
     * PAST the bottom of the window. That is exactly the state
     * `lib/panel.js`'s `max-block-size` exists for — with the bound deleted,
     * `bottom` would be `top + content` and the next assertion fails. It
     * cannot be satisfied by a short panel on any font, and it does not
     * ask the help to be any particular number of pixels tall.
     */
    expect(fits.top + fits.content,
      'laid out unbounded from where it sits, this panel would still have ended above the '
      + 'bottom of the window — so the bound the next assertion is about was never under test')
      .toBeGreaterThan(fits.viewport);
    expect(fits.bottom, 'the panel runs off the bottom of the screen and cannot be scrolled to')
      .toBeLessThanOrEqual(fits.viewport);
    expect(fits.scrolls,
      'it fits by dropping content rather than by scrolling it').toBe(true);
  });

  /* ══ 10b — THE BOX READS THE WAY WHAT YOU TYPED READS ═══════════════════ */

  test(`the find box takes its direction from the query, not from the page (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **FOUND IN A HEBREW SCREENSHOT** — `semantic/11`. With the page RTL and
     * the field carrying no direction of its own, a trailing NEUTRAL resolves
     * against the paragraph: `b*t offse?` was drawn as `?b*t offse`, a pattern
     * the reader did not type, in a mode whose whole subject is punctuation.
     *
     * The field cannot be pinned LTR either — half this archive is Hebrew and
     * a Hebrew query must read right to left. `dir="auto"` reads the first
     * strong character of the VALUE, which is the only thing that knows, and
     * this test asserts BOTH directions on one field so a build that pinned
     * either one reddens.
     */
    const reads = async (): Promise<string> => page.locator('.tvfind')
      .evaluate((el) => getComputedStyle(el).direction);
    await mode(page, 'wildcard');
    await find(page, 'b*t offse?');
    expect(await reads(), 'a pattern is drawn with its punctuation moved to the other end')
      .toBe('ltr');
    await find(page, HEB);
    expect(await reads(), 'a Hebrew query stopped reading right to left').toBe('rtl');
  });

  /* ══ 11 — THE NUMBERS ARE BOLD, AND ONLY THE NUMBERS ═════════════════════ */

  test(`every quantity is bold and nothing else is (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');

    /*
     * **HIS THIRD ASK, IN HIS OWN WORDS:** *"Bold the count and other numeric
     * values you display"*. `lib/i18n.js` marks a value slot whose text is a
     * number with `data-num`, so this reaches every sentence that names a
     * quantity rather than a list of places somebody remembered to edit — and
     * it is an ATTRIBUTE rather than a class because `screen-parity.spec.ts`
     * reads the class list as the element's KIND, and reddened on a `num`
     * class for six screens whose only value slot holds a number.
     */
    const counted = page.locator('p.tvcount .v[data-num]');
    const numbers = await counted.allTextContents();
    console.log(`[bold ${lang}] ${JSON.stringify(numbers)}`);
    expect(numbers.length, 'no quantity in the count line is marked').toBeGreaterThan(3);
    for (const said of numbers) {
      expect(said, `"${said}" is marked as a number and is not one`).toMatch(/^[\d,. ]+$/);
    }
    const weight = await counted.first().evaluate((el) =>
      Number(getComputedStyle(el).fontWeight));
    const around = await page.locator('p.tvcount').evaluate((el) =>
      Number(getComputedStyle(el).fontWeight));
    expect(weight, 'the number is not heavier than the sentence around it')
      .toBeGreaterThan(around);
    // The stepper too — "N turn(s) here hold what you typed" is a quantity the
    // eye goes to, and it is drawn somewhere else entirely.
    expect(await page.locator('.tvnavfoundcount .v[data-num]').count()).toBeGreaterThan(0);

    /*
     * **AND THE CONTROL, WHICH IS THE HALF THAT MAKES THIS A PROOF.** A rule
     * that marked EVERY value slot would satisfy every line above. The
     * engine's own message about a broken pattern is a value slot and is not a
     * number, and it must carry no mark.
     */
    await mode(page, 'regex');
    await find(page, '[');
    await expect(page.locator('.mcnoterebad')).toBeVisible();
    expect(await page.locator('.mcnoterebad .v').count(),
      'the engine message must still be a value slot').toBeGreaterThan(0);
    expect(await page.locator('.mcnoterebad .v[data-num]').count(),
      'a sentence was marked as a number').toBe(0);
  });

  /* ══ 12 — THE COUNTS HAVE ONE PLACE AND DO NOT MOVE ══════════════════════ */

  test(`the counts sit under the find box and stay there whatever else changes (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **THE OWNER, 2026-09-17:** *"pleaes put the counts it a statis place up
     * under the edit search expression"*. They were the LAST two things in
     * the panel, under four groups of controls that each change height as the
     * reader works — so they slid down the panel as he typed.
     *
     * **WHAT IS ASSERTED IS THAT THE TOP DOES NOT MOVE**, not that the block
     * is in position 2 of a list. An order assertion would pass on a build
     * where something above it grew; this one is the reader's own complaint,
     * written down.
     */
    const top = async (selector: string): Promise<number> => page.locator(selector)
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const panelTop = await top(`${SEARCH} .mcpanelhead`);

    await find(page, 'byte');
    /*
     * **`p.tvcount` LEFT THIS BLOCK ON 2026-09-17** — `semantic/15` §3. It is
     * a disclosure and the owner ruled that it belongs under *"Back to all
     * sessions"*, drawn only when a filter is actually hiding something. What
     * he asked for HERE is unchanged and is what is still measured: the
     * numbers he watches keep one top whatever the panel below them does. The
     * card's own line gets the same assertion in its own place, below.
     */
    const first = { counts: await top('.mcpanelcounts'),
      stepper: await top('.mcpanelcounts .tvnavfounds'),
      sentence: await top('.tvroot > p.tvcount'), panel: panelTop };
    console.log(`[counts ${lang}] panel ${panelTop} ${JSON.stringify(first)}`);

    // Directly under the box, which is the other half of his sentence: the
    // only thing between the panel's own header and this block is the field.
    const boxBottom = await page.locator(`${SEARCH} .tvfind`)
      .evaluate((el) => Math.round(el.getBoundingClientRect().bottom));
    expect(first.counts - boxBottom,
      'the counts are not directly under the find box').toBeLessThan(24);

    /*
     * Now change every one of the four things that used to push them down: a
     * mode (which draws two or three sentences of its own), an option (one
     * more), the help (nine examples), and a query long enough to make the
     * count sentence wrap differently.
     */
    await mode(page, 'logical');
    await option(page, 'mcoptcase', true);
    await page.locator('.mcpanelhelp summary').click();
    await page.waitForTimeout(400);
    await find(page, 'byte OR question OR nothing');

    const after = { counts: await top('.mcpanelcounts'),
      stepper: await top('.mcpanelcounts .tvnavfounds'),
      sentence: await top('.tvroot > p.tvcount'), panel: await top(`${SEARCH} .mcpanelhead`) };
    console.log(`[counts ${lang}] after ${JSON.stringify(after)}`);
    /*
     * **MEASURED FROM THE PANEL'S OWN HEAD, NOT FROM THE WINDOW — corrected
     * 2026-09-23.**
     *
     * The complaint this test is written from is *"pleaes put the counts it a
     * statis place up under the edit search expression"*: they slid DOWN THE
     * PANEL as he typed. That is a distance inside the panel. A viewport top
     * additionally measures WHERE THE PANEL'S CONTENT IS SCROLLED TO, and that
     * is not the reader's complaint — it is this automation's own doing.
     *
     * **Measured, and it is deterministic rather than a flake.** `he` on
     * bundled Chromium, 5 runs out of 5, identical numbers every time, and
     * REPRODUCED AGAINST PRISTINE `HEAD` SOURCES so it is nothing this round
     * changed: opening the help grows the panel body from 310px to 876px, past
     * the `max-block-size: calc(100vh - top - 1rem)` that `placeAt`
     * (`src/ui/public/lib/panel.js:243`) writes, so the dialog becomes its own
     * scroller. `option()` and `mode()` then tick controls that are now below
     * the fold, and Playwright scrolls each one into view before clicking it —
     * so the panel's CONTENT ends 44px higher while the dialog BOX has not
     * moved at all (542 before, 542 after). Head 544 -> 500, counts
     * 615 -> 571, stepper 619 -> 575: everything moved together, by the scroll.
     *
     * **Inside the panel nothing moved**: counts 71px under the head before and
     * 71px after, stepper 75px and 75px. `en` never reaches it and Google
     * Chrome never reaches it — only the Hebrew panel on Chromium grows tall
     * enough to scroll — which is exactly the signature of a frame-of-reference
     * bug in the measurement rather than of a layout that gives way.
     *
     * So the distance is taken in the frame his sentence is in: from the
     * panel's own head, which scrolls with the block it is measuring.
     */
    expect(after.counts - after.panel,
      'the count block moved DOWN THE PANEL when the panel below it grew — his own '
      + `complaint. Head ${first.panel} -> ${after.panel}, counts ${first.counts} -> ${after.counts}`)
      .toBe(first.counts - first.panel);
    expect(after.stepper - after.panel, 'the stepper moved down the panel')
      .toBe(first.stepper - first.panel);
    /*
     * **AND WHAT IS PINNED FOR THE SENTENCE, SAID EXACTLY.** The stepper is
     * above it because `.tvnavfounds` holds only short lines and `p.tvcount`
     * wraps to between one and four; the other order lets the long one push
     * the short ones about, which is the defect wearing different clothes.
     *
     * The sentence's own top is pinned against everything BELOW the block —
     * which is what the owner reported — and not against the stepper's own
     * text changing: *"This search could not be answered…"* is two lines where
     * *"40 turn(s) here hold what you typed."* is one, and no order of these
     * three elements makes a sentence that grew by a line not move what is
     * under it. One line of slack is the honest bound; this reddens at 23 px
     * on a build where the notes were above the counts, which is the
     * measurement it exists for.
     */
    expect(Math.abs(after.sentence - first.sentence),
      'the count sentence moved by more than the line its neighbour gained')
      .toBeLessThanOrEqual(30);
  });

  /* ══ 13 — AND THE NUMBERS IN THEM ARE `--carry`, WHICH ALREADY MEANS THIS ═ */

  test(`the find counts are drawn in the meaning-hue blue and clear the contrast gate (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');
    /*
     * *"it would be nice to see them in blue so they would be more
     * observable"*. `--carry` is the blue in the five-hue budget
     * (`DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn`) and
     * it already means "this is a FACT — an unlevelled value", which is
     * exactly what a match count is. So this asserts the hue is the TOKEN and
     * not a literal: a build that spent a sixth colour on this would redden
     * here even if it looked identical.
     */
    const carry = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--carry').trim());
    expect(carry, 'the token this rests on is gone').not.toBe('');

    const measured = await page.evaluate(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 4; canvas.height = 4;
      const c2 = canvas.getContext('2d')!;
      const paint = (layers: string[]): number[] => {
        c2.clearRect(0, 0, 4, 4);
        for (const colour of layers) { c2.fillStyle = colour; c2.fillRect(0, 0, 4, 4); }
        const d = c2.getImageData(1, 1, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!];
      };
      const lum = (rgb: number[]): number => {
        const c = rgb.map((v) => {
          const s = v / 255;
          return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return (0.2126 * c[0]!) + (0.7152 * c[1]!) + (0.0722 * c[2]!);
      };
      const ground = (el: Element): number[] => {
        const layers: string[] = [];
        let node: Element | null = el;
        while (node !== null && node !== document.documentElement) {
          const bg = getComputedStyle(node).backgroundColor;
          if (bg !== 'rgba(0, 0, 0, 0)') layers.unshift(bg);
          node = node.parentElement;
        }
        layers.unshift(getComputedStyle(document.documentElement).backgroundColor);
        return paint(layers.filter((l) => l !== 'rgba(0, 0, 0, 0)'));
      };
      // `p.tvcount` is on the CARD since `semantic/15` — see §3 of that item.
      // The ground it is measured against moved with it, which is exactly why
      // this probe walks the ancestors rather than naming a token.
      const numeral = document.querySelector('.tvroot > p.tvcount .v[data-num]');
      const sentence = document.querySelector('.tvroot > p.tvcount');
      if (numeral === null || sentence === null) return null;
      const bg = ground(numeral);
      const fg = paint([getComputedStyle(numeral).color]);
      const a = lum(fg); const b = lum(bg);
      return {
        numeral: getComputedStyle(numeral).color,
        sentence: getComputedStyle(sentence).color,
        token: paint([getComputedStyle(document.documentElement)
          .getPropertyValue('--carry').trim()]),
        rgb: fg,
        ratio: Number(((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)).toFixed(2)),
      };
    });
    expect(measured, 'no marked numeral in the count line').not.toBeNull();
    console.log(`[blue ${lang}] ${JSON.stringify(measured)}`);
    expect(measured!.rgb, 'the count is not drawn in --carry').toEqual(measured!.token);
    /*
     * **THE CONTRAST GATE IS REAL ON THIS PROJECT** — `--crit` was refused on
     * a surface at a measured 4.06:1. This is the same measurement, taken on
     * the panel's real ground, which is `--panel-2` at 94% over the page.
     */
    expect(measured!.ratio, 'the blue does not clear AA on the panel ground')
      .toBeGreaterThanOrEqual(4.5);
    /*
     * **AND THE CONTROL, WHICH IS WHAT MAKES THIS A PROOF.** A build that
     * coloured the whole count LINE would satisfy every line above. The
     * sentence around the number keeps the ink it had: the hue marks the
     * quantity, exactly as the weight does, and a blue sentence would be a
     * hue spent on prose.
     */
    expect(measured!.sentence, 'the sentence went blue too, not only the number')
      .not.toBe(measured!.numeral);
  });

  /* ══ 14 — THE REGULAR-EXPRESSION REFERENCE ═══════════════════════════════ */

  test(`the pattern mode has a syntax reference that says what is refused (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * *"add a full syntax help because it is complicated and hard to
     * remember"*. Fifteen worked examples already shipped and he asked
     * anyway, so what this adds is a LOOKUP TABLE rather than a sixteenth
     * example.
     */
    const reference = page.locator('.mcpanelref');
    await expect(reference,
      'the reference is drawn for a mode that cannot read a line of it').toBeHidden();
    await mode(page, 'wildcard');
    await expect(reference).toBeHidden();
    await mode(page, 'logical');
    await expect(reference).toBeHidden();
    await mode(page, 'regex');
    await expect(reference, 'the pattern mode has no reference').toBeVisible();

    await expect(reference, 'the reference is open before it is asked for')
      .not.toHaveAttribute('open', /.*/);
    await reference.locator('summary').click();
    await expect(reference).toHaveAttribute('open', /.*/);

    // Every section the item names, and enough rows to be a reference rather
    // than a second list of examples.
    expect(await page.locator('.mcpanelrefh').count(),
      'the reference has lost a section').toBeGreaterThanOrEqual(6);
    expect(await page.locator('.mcpanelreftab tr').count()).toBeGreaterThanOrEqual(33);
    const body = page.locator('.mcpanelrefbody');
    for (const construct of ['\\d', '\\w', '\\s', '\\b', 'a{2,}', '(?:ab)', '\\1', '^', '$']) {
      expect(await page.locator('.mcpanelrefwhat .m', { hasText: construct }).count(),
        `the reference does not name ${construct}`).toBeGreaterThan(0);
    }

    /*
     * **AND IT SAYS WHAT THE SCAN REFUSES, IN THE TABLE ITSELF.** A reference
     * listing a construct this engine rejects is worse than no reference: the
     * reader would type it, be refused, and find the help had taught it to
     * them. The 108,785 ms is the measurement that bought the refusal, and it
     * is in the row rather than only in the prose above it.
     */
    await expect(body, 'the reference does not say what is refused')
      .toContainText('(X+)+');
    await expect(body, 'the refusal in the reference carries no measurement')
      .toContainText('108,785');

    /*
     * **A CONSTRUCT IS DRAWN AS IT WOULD BE TYPED, LIGATURES OFF.** Found in
     * a screenshot: this face ligates `<=` into `≤`, so `(?<=ab)` was drawn as
     * `(?≤ab)` — a character no keyboard produces, in a table whose whole job
     * is to be copied from. The text content is right either way, so the
     * assertion has to be about how it is PAINTED.
     */
    const look = page.locator('.mcpanelrefwhat .m').first();
    expect(await look.evaluate((el) => getComputedStyle(el).fontVariantLigatures),
      'a construct is drawn with ligatures, so `<=` reads as a character nobody can type')
      .toBe('none');
  });

  /* ══ 15 — AND EVERY EXAMPLE STILL RUNS ═══════════════════════════════════ */

  test(`every example in every mode runs when it is clicked (${lang})`, async ({ page }) => {
    // Twenty-one examples across four modes, each with the settle and the scan
    // after it. The default 30 s is a bound on ONE interaction and this test is
    // deliberately twenty-one of them; raised rather than thinned, because
    // which example is broken is exactly what a sample would not tell anyone.
    test.setTimeout(240_000);
    await openDocument(page, lang);
    await openPanel(page);
    await page.locator('.mcpanelhelp summary').click();
    await page.waitForTimeout(300);
    /*
     * **THE STANDING RULE FOR THIS LIST**: every example RUNS, and clicking it
     * puts it in the box. `semantic/11` had one example replaced because it
     * demonstrated nothing, and `semantic/14` added five more — so this walks
     * ALL of them in all four modes rather than the first and the last.
     *
     * What a fixture can prove is that each one reached the scan and was
     * READABLE — no engine error, no grammar refusal. Whether each finds
     * something on the owner's own archive is a different measurement, taken
     * against the live 139 MB session and recorded in the report, because a
     * 64-turn fixture cannot hold a date, an address and a run of Hebrew at
     * once without becoming a fixture about examples.
     *
     * The LAST pattern example is the shape that is refused, and it is the
     * one exception: it must produce the refusal and nothing else.
     */
    for (const which of ['normal', 'wildcard', 'logical', 'regex']) {
      await mode(page, which);
      const buttons = page.locator('.mcpanelegq');
      const total = await buttons.count();
      expect(total, `${which} has no examples`).toBeGreaterThan(2);
      for (let i = 0; i < total; i += 1) {
        const button = buttons.nth(i);
        const query = await button.textContent();
        await button.click();
        await page.waitForTimeout(2_500);
        expect(await page.locator('.tvfind').inputValue(),
          `clicking the ${which} example ${query} did not put it in the box`).toBe(query);
        const refused = which === 'regex' && i === total - 1;
        if (refused) {
          await expect(page.locator('.mcnoterefused'),
            'the last pattern example must be the refusal').toBeVisible();
          continue;
        }
        await expect(page.locator('.mcnoterebad'),
          `the ${which} example ${query} is not a pattern this engine reads`).toBeHidden();
        await expect(page.locator('.mcnotewhy'),
          `the ${which} example ${query} is not a query this mode reads`).toBeHidden();
        await expect(page.locator('.mcnoterefused'),
          `the ${which} example ${query} was refused`).toBeHidden();
        // And it really reached the scan: the stepper is the server's answer.
        await expect(page.locator('.tvnavfoundcount')).toBeVisible();
      }
    }
  });

  /* ══ 16 — THE POSITION COUNTER, WHICH MOVES AS HE STEPS ══════════════════ */

  test(`the position counter counts up as you step and back down again (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **THE OWNER, 2026-09-17:** *"when the user clicks the next match for
     * example, the 1 will become 2 then 3 etc' till 15 of 15, the same but
     * decrease for previous match"*. A LIVE POSITION, not a label.
     *
     * **WHAT IT COUNTS AGAINST IS TURNS, AND THAT IS MEASURED RATHER THAN
     * ASSUMED.** `foundStops()` is one stop per TURN and `showMatch` lands on
     * the first match inside it, so a turn holding four occurrences is one
     * stop and the other three cannot be reached by these buttons. The
     * sentence therefore says `turns` rather than leaving the reader to
     * choose between the two totals above it.
     */
    const place = async (): Promise<number[]> => {
      const text = (await page.locator('.tvnavfoundplace').textContent()) ?? '';
      return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
    };
    await find(page, 'byte');
    /*
     * **BEFORE THE FIRST STEP THERE IS NO POSITION, AND IT DOES NOT CLAIM
     * ONE.** Not `0 of 15` and not `1 of 15`: the reader is standing on none
     * of them, which is a different fact from standing on the first —
     * `nothing-to-do-and-could-not-look-are-different-answers` in the shape
     * this counter can take.
     */
    expect(await place(), 'it claims a position before anything was stepped to').toEqual([]);
    await expect(page.locator('.tvnavfoundplace')).toBeVisible();

    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(800);
    const first = await place();
    expect(first.length, 'the counter says no position after a step').toBe(2);
    expect(first[0], 'the first step is not position 1').toBe(1);
    const total = first[1]!;
    expect(total, 'the total is not a real number of stops').toBeGreaterThan(2);

    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(800);
    expect(await place(), 'Next did not advance the counter').toEqual([2, total]);
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(800);
    expect(await place()).toEqual([3, total]);
    await page.locator('.tvnavfoundprev').click();
    await page.waitForTimeout(800);
    expect(await place(), 'Previous did not count back down').toEqual([2, total]);

    /*
     * **AND IT MUST STAY HONEST WHEN THE SET CHANGES UNDER HIM.** `15 of 15`
     * becoming `15 of 3` is the shape of the bug. Ticking an option re-asks
     * the server, which is a different answer with a different number of
     * stops — and the walk is given up rather than carried across, because a
     * position in a list that no longer exists is not a position.
     */
    await option(page, 'mcoptcase', true);
    expect(await place(), 'the counter kept a place in an answer that was replaced')
      .toEqual([]);
    await option(page, 'mcoptcase', false);
    await mode(page, 'wildcard');
    expect(await place(), 'a mode change left a position standing').toEqual([]);
  });

  /* ══ 17 — AND IT STOPS AT THE END RATHER THAN WRAPPING ═══════════════════ */

  test(`the walk ends at N of N and pressing past it says so (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **ROUND ONE REFUSED WRAP-AROUND** — *"wrap is a property of a caret
     * that must keep moving; a stepper that names the end is the honest
     * version of it"* — and that refusal was made when there was no counter.
     * A counter changes the question, because `N of N` states the end
     * explicitly. **The refusal STILL HOLDS**, and this is the assertion that
     * says so: the counter stops at the last stop, the sentence names the
     * end, and nothing silently takes the reader back to the first.
     */
    await find(page, 'Byte');
    await option(page, 'mcoptcase', true);
    const place = async (): Promise<number[]> => {
      const text = (await page.locator('.tvnavfoundplace').textContent()) ?? '';
      return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
    };
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(800);
    const total = (await place())[1]!;
    expect(total, 'this fixture has no walk to reach the end of').toBeGreaterThan(1);
    for (let i = 1; i < total; i += 1) {
      await page.locator('.tvnavfoundnext').click();
      await page.waitForTimeout(400);
    }
    expect(await place(), 'the walk did not reach the last stop').toEqual([total, total]);
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(600);
    expect(await place(), 'pressing past the end wrapped, under a refusal that is on the record')
      .toEqual([total, total]);
    await expect(page.locator('.tvnavsaid'),
      'the end of the walk is not named').toBeVisible();
  });

  /* ══ 18 — THE CURRENT MATCH IS SOMEWHERE HE CAN SEE IT ═══════════════════ */

  test(`a stepped-to match lands where the reader can actually see it (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    /*
     * **THE OWNER, 2026-09-17:** *"when you highlite the current match, verify
     * it is in focus so the user could see it"*. Stepping already scrolled —
     * so the assertion cannot be "did it move". It is **"what would a click at
     * the middle of the match hit"**, which is the only question that answers
     * whether he is looking at it: `elementFromPoint` returns the TOPMOST
     * element, so a match under this floating, draggable, remembered panel
     * answers with the panel.
     *
     * The panel is dragged OVER the well first, because where it opens it
     * covers the head of the document rather than the body, and a test that
     * never puts a panel in the way cannot see the defect. That is the same
     * finding the panel-fit test records one section up, in its own words:
     * *"the first draft of this test reddened nothing"*.
     */
    await find(page, 'byte');
    const grip = await page.locator(`${SEARCH} .mcpanelhead`).boundingBox();
    expect(grip).not.toBeNull();
    const rtl = await page.evaluate(() =>
      document.documentElement.getAttribute('dir') === 'rtl');
    await page.mouse.move(grip!.x + grip!.width / 2, grip!.y + grip!.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip!.x + grip!.width / 2 + (rtl ? -200 : 200),
      grip!.y + grip!.height / 2 + 260, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(400);

    const seen = async (): Promise<{ over: string | null; reachable: boolean } | null> =>
      page.evaluate(() => {
        // `AbstractRange` is what the highlight registry is typed to hold; a
        // `Range` is what the page puts in it, and only a `Range` has a box.
        const ranges = [...(CSS.highlights.get('mycontextfindnow') ?? [])] as Range[];
        if (ranges.length === 0) return null;
        const b = ranges[0]!.getBoundingClientRect();
        if (b.width === 0 && b.height === 0) return null;
        const at = document.elementFromPoint(
          Math.round((b.left + b.right) / 2), Math.round((b.top + b.bottom) / 2));
        const well = document.querySelector('.tvscroll')!.getBoundingClientRect();
        const panel = document.querySelector('dialog.mcpanel[data-panel="search"]')!
          .getBoundingClientRect();
        return {
          over: at === null ? null : `${at.tagName}.${String(at.className).split(' ')[0]}`,
          reachable: at !== null && at.closest('.tvscroll') !== null,
          match: [Math.round(b.top), Math.round(b.bottom), Math.round(b.left), Math.round(b.right)],
          well: [Math.round(well.top), Math.round(Math.min(well.bottom, window.innerHeight))],
          panel: [Math.round(panel.top), Math.round(panel.bottom),
            Math.round(panel.left), Math.round(panel.right)],
        };
      });

    let looked = 0;
    for (let i = 0; i < 4; i += 1) {
      await page.locator('.tvnavfoundnext').click();
      await page.waitForTimeout(800);
      const answer = await seen();
      if (answer === null) continue;
      looked += 1;
      console.log(`[visible ${lang}] step ${i + 1} ${JSON.stringify(answer)}`);
      expect(answer.reachable,
        `the current match is under ${answer.over}, where the reader cannot see it`).toBe(true);
    }
    expect(looked, 'no step produced a current match, so this asserted nothing')
      .toBeGreaterThan(1);

    /*
     * ── AND THE TWO CASES THE DRAG ABOVE CANNOT REACH ────────────────────────
     *
     * Both were found by driving the live session by hand, and the removal
     * proof for each reddened NOTHING against the drag above — which is the
     * fixture failing to carry a proof's power, and it is recorded rather than
     * hidden. The geometry each needs is computed from the page instead of
     * guessed, because both are about where the panel's EDGE falls relative to
     * the match, and that is not a constant.
     *
     * **1. THE LARGER SLICE THE SCROLL CANNOT REACH.** The window is made tall
     * so the well has room either side of the panel, and the panel is put near
     * the TOP of it. The reader is then at `scrollTop` 0 on the first match:
     * the big slice is below the panel and reaching it means scrolling UP,
     * which the browser clamps. A build that takes the biggest slice without
     * asking leaves the match where it was — under the panel.
     */
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.waitForTimeout(600);
    const box = async (sel: string): Promise<DOMRect> =>
      page.locator(sel).evaluate((el) => el.getBoundingClientRect().toJSON()) as Promise<DOMRect>;
    const well = await box('.tvscroll');
    let panel = await box(SEARCH);
    const head = async (): Promise<{ x: number; y: number }> => {
      const grip2 = await page.locator(`${SEARCH} .mcpanelhead`).boundingBox();
      return { x: grip2!.x + grip2!.width / 2, y: grip2!.y + grip2!.height / 2 };
    };
    const shove = async (dx: number, dy: number): Promise<void> => {
      const from = await head();
      await page.mouse.move(from.x, from.y);
      await page.mouse.down();
      await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(400);
    };
    // 60 px of well above the panel: more than a line, far less than what is
    // left below it.
    await shove(0, Math.round(well.top + 60 - panel.top));
    // Back to the first match: retyping gives the walk up and starts it again.
    await find(page, 'byte');
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(900);
    const high = await seen();
    if (high !== null) {
      console.log(`[reach ${lang}] ${JSON.stringify(high)}`);
      expect(high.reachable,
        `the first match is under ${high.over}: the slice chosen could not be scrolled to`)
        .toBe(true);
    }

    /*
     * **2. A MATCH THAT STARTS BESIDE THE PANEL AND RUNS UNDER IT.** The panel
     * is moved so its own start edge falls INSIDE the match that is currently
     * standing. A column test that reads the collapsed caret rather than the
     * match's real box answers "this panel is not over it" about a match whose
     * second half is behind the panel.
     */
    const at = await page.evaluate(() => {
      const ranges = [...(CSS.highlights.get('mycontextfindnow') ?? [])] as Range[];
      if (ranges.length === 0) return null;
      const r = ranges[0]!.getBoundingClientRect();
      return { left: r.left, right: r.right, top: r.top };
    });
    if (at !== null && at.right - at.left > 8) {
      panel = await box(SEARCH);
      // Put the panel's leading edge a few pixels inside the match.
      const want = rtl ? at.right - 4 : at.left + 4;
      await shove(Math.round(want - (rtl ? panel.right : panel.left)), 0);
      await page.locator('.tvnavfoundnext').click();
      await page.waitForTimeout(900);
      const split = await seen();
      if (split !== null) {
        console.log(`[split ${lang}] ${JSON.stringify(split)}`);
        expect(split.reachable,
          `the current match is under ${split.over}: it starts beside the panel and runs under it`)
          .toBe(true);
      }
    }
  });

  /* ══ 19 — THE CLEAR BUTTON ═══════════════════════════════════════════════ */

  test(`Clear empties the box, the highlights and the counts, and keeps the caret (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    await find(page, 'byte offset');
    // It found something first, or clearing it proves nothing.
    expect(await painted(page), 'nothing was painted, so clearing it is not a test')
      .toBeGreaterThan(0);
    expect(await held(page)).toBeGreaterThan(0);

    const clear = page.locator('.mcpanelclear');
    await expect(clear, 'the panel has no Clear button').toBeVisible();
    await clear.click();
    await page.waitForTimeout(1_500);

    expect(await page.locator('.tvfind').inputValue(), 'the box is not empty').toBe('');
    expect(await painted(page), 'the highlights outlived the query').toBe(0);
    /*
     * **AND THE CARET IS BACK IN THE FIELD.** A reader who cleared the box is
     * about to type in it. This is not the frame's `fallbackFocus`, which is
     * about a CLOSED panel; the panel is still open here.
     */
    expect(await page.evaluate(() => document.activeElement?.className ?? ''),
      'the caret was left on the button').toContain('tvfind');
    // The counts go back to the whole-document reading rather than to zero.
    await expect(page.locator('.tvnavfoundcount')).toBeVisible();
    expect(await page.locator('.tvnavfoundplace').textContent(),
      'a position survived the query being cleared').toBe('');
  });

  /* ══ 20 — A SCAN THAT REFUSED IS NOT A SCAN THAT FOUND NOTHING ═══════════ */

  test(`a find request the server refuses is said, not drawn as a measured zero (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    /*
     * **THE OWNER'S 2026-09-17 REPORT, REPRODUCED** — *"the next match and
     * preious match stopped working after the first use that was correct"*.
     * It was not the stepper. His server on 58888 started before `semantic/9`
     * and its find route's whole vocabulary is `q`; the browser assets reload
     * on every request and a server's own modules do not, so his page was
     * today's and his scan was yesterday's, and `case`, `word` and `mode`
     * were each a 400 from it.
     *
     * The route is intercepted here to answer exactly what that server would
     * have answered, which is the only way a current build can stand in his
     * shoes. What is asserted is not the 400 — it is what the screen SAYS
     * about it: the stepper drew *"No turn here holds what you typed"* over a
     * query that holds forty, and every press answered *"There is nothing to
     * step to."*
     */
    await page.route('**/find?*', async (route) => {
      if (/[?&](case|word|mode)=/.test(route.request().url())) {
        await route.fulfill({ status: 400, contentType: 'application/json',
          body: JSON.stringify({ error: 'unknown query parameter "case".' }) });
        return;
      }
      await route.continue();
    });
    await openPanel(page);
    await find(page, 'byte');
    const before = await held(page);
    expect(before, 'the plain find must work first, or the split is invisible')
      .toBeGreaterThan(0);

    /*
     * **AND A GENUINE ZERO IS MEASURED FIRST, BECAUSE THAT IS WHAT THIS HAS TO
     * BE TOLD APART FROM.** The first draft asserted that the stepper said
     * SOMETHING, and its removal proof reddened nothing: *"No turn here holds
     * what you typed"* is also something. What the rule asks —
     * `nothing-to-do-and-could-not-look-are-different-answers` — is that the
     * two states do not draw the same sentence, so the zero is taken here and
     * the refusal is compared against it.
     */
    await find(page, 'unmistakablyabsentneedlenobodytyped');
    const zeroTotal = ((await page.locator('.tvnavfoundcount').textContent()) ?? '').trim();
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(600);
    const zeroSaid = ((await page.locator('.tvnavsaid').textContent()) ?? '').trim();
    expect(zeroTotal.length, 'a measured zero says nothing at all').toBeGreaterThan(0);

    await find(page, 'byte');
    await option(page, 'mcoptcase', true);
    /*
     * Three sentences, and each is a different reader looking in a different
     * place: the panel note, the stepper's own count, and the answer a press
     * of Next gives.
     */
    await expect(page.locator('.mcnotefailed'),
      'the panel says nothing about a search that was refused').toBeVisible();
    expect(await held(page)).toBe(0);
    const total = ((await page.locator('.tvnavfoundcount').textContent()) ?? '').trim();
    expect(total.length, 'the stepper says nothing at all').toBeGreaterThan(0);
    expect(total,
      'the stepper draws a refused scan with the same words it draws a measured zero')
      .not.toBe(zeroTotal);
    await page.locator('.tvnavfoundnext').click();
    await page.waitForTimeout(600);
    const said = ((await page.locator('.tvnavsaid').textContent()) ?? '').trim();
    expect(said.length).toBeGreaterThan(0);
    expect(said, 'the step answers a refused scan the way it answers a measured zero')
      .not.toBe(zeroSaid);

    /*
     * **AND IT COMES BACK DOWN.** A note left standing under a query that has
     * since been answered is the same defect in the other direction, which is
     * the rule `askFind`'s own `catch` was rewritten for.
     */
    await option(page, 'mcoptcase', false);
    await expect(page.locator('.mcnotefailed')).toBeHidden();
    expect(await held(page)).toBe(before);
  });
}
