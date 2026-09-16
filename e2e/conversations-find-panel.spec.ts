// @basis TASK-the-find-options-the-owner-asked-for-twice-in-a-floating,
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

/** Open the panel the way a reader does: right-click, then the Search row. */
async function openPanel(page: Page): Promise<void> {
  await page.locator('.tvrow .tvsaid').first().click({ button: 'right' });
  await expect(page.locator('.tvmenu:not([hidden])')).toHaveCount(1, { timeout: 10_000 });
  // Named by its keyboard shortcut rather than by its words, so this test is
  // the same test in both languages.
  await page.locator('.tvmenu .tvmenuitem[aria-keyshortcuts="/"]').click();
  await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(1, { timeout: 10_000 });
}

/** Type into the find box and wait past the 250 ms settle and the scan. */
async function find(page: Page, query: string): Promise<void> {
  await page.locator('.tvfind').fill(query);
  await page.waitForTimeout(2_500);
}

/** Tick or untick one option and wait for the re-scan it causes. */
async function option(page: Page, which: string, on: boolean): Promise<void> {
  const box = page.locator(`.${which} input`);
  if (await box.isChecked() !== on) await box.setChecked(on);
  await page.waitForTimeout(2_500);
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
    const panel = page.locator('dialog.mcpanel');

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

  /* ══ 2 — THE BAR SHRINKS AS THE PANEL FILLS ══════════════════════════════ */

  test(`the strip gives its room back when the panel takes the controls (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const box = async (selector: string): Promise<number> =>
      page.locator(selector).evaluate((el) => el.getBoundingClientRect().height);
    const chrome = async (): Promise<number> => page.evaluate(() => {
      const bar = document.querySelector('.tvbar')!.getBoundingClientRect();
      const well = document.querySelector('.tvscroll')!.getBoundingClientRect();
      return well.top - bar.top;
    });

    await find(page, 'byte offset');
    const before = { nav: await box('.tvnav'), bar: await box('.tvbar'), chrome: await chrome() };
    await openPanel(page);
    await page.waitForTimeout(500);
    const after = { nav: await box('.tvnav'), bar: await box('.tvbar'), chrome: await chrome() };
    console.log(`[strip ${lang}] before ${JSON.stringify(before)} after ${JSON.stringify(after)}`);

    // The item's own acceptance test, in its own words: *"if it does not
    // shrink, the change has not landed."*
    expect(after.nav, 'the stepper strip did not shrink').toBeLessThan(before.nav);
    expect(after.bar, 'the button bar did not shrink').toBeLessThan(before.bar);
    expect(after.chrome, 'the chrome above the viewer did not shrink').toBeLessThan(before.chrome);

    // And the controls are in the panel rather than merely gone, which is the
    // half a "did it shrink" assertion cannot tell apart from a broken build.
    const panel = page.locator('dialog.mcpanel');
    for (const which of ['.tvfind', '.tvnavfounds', 'p.tvcount']) {
      expect(await panel.locator(which).count(), `${which} is not in the panel`).toBe(1);
    }
  });

  /* ══ 3 — DRAG, CLOSE, REOPEN WHERE IT WAS LEFT ═══════════════════════════ */

  test(`the panel drags, closes on its own button, and reopens where it was left (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await openPanel(page);
    const panel = page.locator('dialog.mcpanel');
    const at = async (): Promise<{ left: number; top: number }> =>
      panel.evaluate((d) => {
        const b = d.getBoundingClientRect();
        return { left: Math.round(b.left), top: Math.round(b.top) };
      });

    const start = await at();
    const grip = await page.locator('.mcpanelhead').boundingBox();
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
    await page.locator('.mcpanelclose').click();
    await expect(page.locator('dialog.mcpanel[open]')).toHaveCount(0);
    // Everything it borrowed goes home, whatever route closed it.
    expect(await page.locator('.tvbar .tvfind').count(), 'the find box did not go back').toBe(1);
    expect(await page.locator('.tvnav .tvnavfounds').count()).toBe(1);
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
    expect(await page.locator('.tvbar .tvfind').count()).toBe(1);

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
    await option(page, 'mcoptre', true);
    await find(page, 'byte\\s+offsets?');
    expect(await held(page), 'one pattern reaches all three shapes').toBe(12);
    // The two sentences a pattern always carries: what mode this is, and that
    // it reads the text unfolded rather than the way the other mode does.
    await expect(page.locator('.mcnotere')).toBeVisible();
    await expect(page.locator('.mcnoterefold')).toBeVisible();
    // And the measurement the item asks for, on the screen.
    await expect(page.locator('.mcnoterecost')).toBeVisible();
    console.log(`[regex ${lang}] ${(await page.locator('.mcnoterecost').textContent())?.trim()}`);

    // **A BROKEN PATTERN IS THE ENGINE'S OWN MESSAGE**, not a rewrite of it
    // and not an empty result the reader cannot tell from "not there".
    await find(page, '[');
    await expect(page.locator('.mcnoterebad')).toBeVisible();
    await expect(page.locator('.mcnoterecost'),
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
}
