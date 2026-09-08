// @basis TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and,
// TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has,
// TASK-the-open-document-follows-the-session-as-it-is-written-and,
// INV-nothing-is-dropped-silently
/**
 * The conversation archive, driven in a real browser in both languages —
 * `plan:archive seq:3` for the list, and `seq:7`, `seq:8` and `seq:13` for the
 * document.
 *
 * **Why this exists as well as the two `node --test` files.** They prove the
 * endpoint and the arithmetic; this one proves the SCREEN, and this project
 * has repeatedly found real defects in a picture after every assertion had
 * passed — a tag name 897px from its own checkbox, a leading dot at the wrong
 * end under RTL, 552 detached Hebrew full stops.
 *
 * ── THE ONE THING THIS FILE EXISTS FOR ────────────────────────────────────
 *
 * The owner opened his own session and the screen said *"Showing entries 0–50
 * of 24,757"* with **no way to reach entry 51**. So the load-bearing test here
 * is `the end of the session is reachable` — it scrolls to the bottom of a
 * 480-node document and asserts the LAST turn is on screen and readable. That
 * is the defect, restated as something that fails when it comes back.
 *
 * Beside it sits its twin, `only a window of the document is ever in the DOM`,
 * because a viewer that reached the end by rendering all 27,813 records would
 * pass the first test and be unusable — the answer `seq:7` rules out by name:
 * *"one scrollable document over the whole session, with only what is on
 * screen in the DOM."*
 *
 * The server is the suite's own `startUiChild` on its own port, with the
 * sessions store pinned by `test/ui/helpers.ts`' import of
 * `pin-sessions-dir.ts` — so the owner's server on 58888 and the global record
 * at `~/.my-context/ui-server.json` are untouched. `CLAUDE_CONFIG_DIR` points
 * the scanner at a throwaway home, so no real transcript is read.
 */
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../test/helpers/tmp.ts';
import { mintNonce, startUiChild, type UiHarness } from '../test/ui/helpers.ts';
import { runCli } from '../src/cli/index.ts';
import { projectDirName } from '../src/core/conversation-index.ts';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const ESC = '\u001b';

/** Exchanges in the fixture. Enough that a window is a small fraction of it. */
const ROUNDS = 120;

/**
 * A session long enough to have an unreachable end, shaped like a real one.
 *
 * Each round is a prompt, an answer, and a run of machinery between them —
 * which is what a transcript actually looks like: on the owner's own file,
 * 62.6% of records carry no `message` at all and 2,456 of 27,813 are turns
 * somebody took.
 *
 * Three records are planted for specific assertions and are named here so a
 * reader does not have to find them: the FIRST answer carries Markdown (a
 * heading, a list, a fence and a table) for `seq:8`; one tool result deep in
 * the file carries a real ANSI sequence; and the LAST prompt carries a phrase
 * that appears nowhere else, so "the end is reachable" cannot pass by
 * accident.
 */
const LAST_PHRASE = 'the very last thing anybody asked';
const DEEP_PHRASE = 'a needle only the whole-session filter can find';

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 8, 9, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'The conversation archive' });
  for (let i = 0; i < ROUNDS; i += 1) {
    const last = i === ROUNDS - 1;
    rows.push({
      type: 'user',
      message: {
        role: 'user',
        content: last ? LAST_PHRASE : (i === 71 ? DEEP_PHRASE : `round ${i}: keep going`),
      },
      timestamp: at(i * 4),
      gitBranch: 'master',
    });
    rows.push({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: text(i === 0
          ? [
            '## What the terminal showed',
            '',
            'Rendering **formatted** text with `code`, a list and a table:',
            '',
            '- the first point',
            '- the second point',
            '',
            '```sh',
            'mycontext conversation rebuild',
            '```',
            '',
            '| column | meaning |',
            '| --- | --- |',
            '| one | the first |',
          ].join('\n')
          : `answer ${i}: קודם כול, then back to English.`),
      },
      timestamp: at(i * 4 + 1),
    });
    rows.push({ type: 'attachment', attachment: { type: 'total_tokens_reminder' } });
    rows.push({
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', name: 'Bash', input: { command: `echo ${i}`, description: `Echo round ${i}` } }],
      },
      timestamp: at(i * 4 + 2),
    });
    rows.push({
      type: 'user',
      message: {
        role: 'user',
        content: [{
          type: 'tool_result',
          content: i === 3
            ? `Call log:\n${ESC}[2m  - waiting for locator('nav')${ESC}[22m\n`
            : `round ${i} output`,
        }],
      },
      timestamp: at(i * 4 + 3),
    });
    rows.push({ type: 'queue-operation', operation: 'drain' });
  }
  return rows;
}

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
    session().map((r) => JSON.stringify(r)).join('\n') + '\n',
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
 * physically intercepted every click.
 */
async function open(page: Page, hash: string, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  // A FRESH nonce per page. `harness.nonce` is the one the server printed at
  // start and it is SINGLE-USE.
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash.replace(/^#/, '#'));
  await page.waitForSelector('.convrow, .tvturn, .spill', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/** Open the one session and wait for the document to have drawn its first turn. */
async function openDocument(page: Page, lang: 'en' | 'he'): Promise<void> {
  await open(page, '#/conversations', lang);
  await page.locator('.convrow').first().click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
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

  /* ══ seq:13 — THE DOCUMENT SKELETON ════════════════════════════════════ */

  test(`the session reads as a document: who spoke, when, machinery folded (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // A HEADING PER TURN, naming the speaker — the shape the owner supplied by
    // example. `<h4>` inside a `<header>`, not a styled div: a document a
    // screen reader walks wants headings.
    const first = page.locator('.tvturn').first();
    await expect(first.locator('h4.tvname')).toBeVisible();
    await expect(first.locator('h4.tvname'))
      .toHaveText(lang === 'he' ? 'אתם' : 'You');

    // THE TIMESTAMP ON ITS OWN, beneath the speaker, machine-readable.
    await expect(first.locator('time.tvat')).toHaveAttribute('datetime', /^2026-09-08T/);

    // Distinct by MORE than colour: a glyph beside the accent, so the
    // distinction survives a monochrome print and a colour-blind reader.
    await expect(first.locator('.tvmark')).toHaveAttribute('data-g', '▸');
    await expect(page.locator('.tvturn.tvclaude .tvmark').first())
      .toHaveAttribute('data-g', '◆');

    // THE FOLD, which is what `seq:13` adds to `seq:7`: a RUN of machinery as
    // ONE line, not one row per record. Four records sit between every pair of
    // turns in this fixture and they draw as a single `<details>`.
    //
    // NOT `.tvwork` first: the document's very first node is the lone
    // `ai-title` record that sits before the first prompt, which is a run of
    // ONE and names no tool. Asserting on it was this test being wrong about
    // the fixture rather than the screen being wrong about the record — and it
    // is worth keeping the distinction, because a one-record run is a real
    // shape the viewer has to draw.
    const fold = page.locator('.tvwork').filter({ hasText: 'Bash' }).first();
    await expect(fold).toBeVisible();
    await expect(fold.locator('summary .tvmark')).toHaveAttribute('data-g', '⚙');
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(false);
    // It NAMES what ran — a fold that says only "4 steps" cannot be skimmed.
    await expect(fold.locator('.tvtools')).toContainText('Bash');

    // A real <details>: Enter opens it, with no key handler of our own.
    await fold.locator('summary').focus();
    await page.keyboard.press('Enter');
    expect(await fold.evaluate((n) => (n as HTMLDetailsElement).open)).toBe(true);
    // And opening it shows every record in the run, book-keeping included —
    // a reader who cannot see that a record was there cannot know one was
    // skipped.
    await expect(fold.locator('.tvstep')).toHaveCount(4);
    // The steps are in RECORD order, so the run opens on the `attachment` the
    // harness filed before the tool call — not on the tool call. That order is
    // the point: a step's number is the record's own index in the file, the
    // one the list screen and the endpoint both count in.
    await expect(fold.locator('.tvstep').first()).toContainText('attachment');
    await expect(fold).toContainText('Echo round');
    await expect(fold.locator('.tvstep .tvdetail').first()).toContainText('Echo round');

    // A TURN IS NOT FOLDED — the reader came for it.
    await expect(page.locator('.tvturn details.tvwork')).toHaveCount(0);

    // NOTHING ON THIS SCREEN CLAIMS A SIZE LIMIT — `seq:7`'s remainder, and
    // the sentence he was reading when he ruled it out. It stood under the
    // scroll and said "A turn longer than 60000 characters is shown up to
    // there and says so; tool output, up to 4000." Both caps are gone from the
    // read model, so the disclosure went with them and NO row may carry a
    // "shown N of M characters" line either.
    const viewer = page.locator('.tvroot');
    await expect(viewer).not.toContainText(lang === 'he' ? 'תור ארוך מ' : 'is shown up to there');
    await expect(viewer).not.toContainText(lang === 'he' ? 'מוצגים' : 'The rest is in the file');
    await expect(page.locator('.tvcut')).toHaveCount(0);

    await page.screenshot({
      path: `e2e/screens/conversations-document-${lang}.png`, fullPage: true,
    });
  });

  /* ══ seq:14 — THE LIST SAYS WHERE IT STANDS, EVEN WHEN IT IS FINE ══════ */

  test(`the list says it is current when nothing has grown (${lang})`, async ({ page }) => {
    await open(page, '#/conversations', lang);

    // **Drawn when the list is CURRENT as well as when it is behind, and that
    // is the rule rather than a nicety.** `seq:14`'s defect was an archive
    // that was over a day stale in front of the owner with nothing saying so;
    // a screen that only speaks up when something is wrong leaves a reader
    // unable to tell a fresh list from a check that has stopped running, which
    // is precisely the state that feature was in. This fixture is rebuilt and
    // never appended to, so the answer here is "current".
    //
    // Scoped to the card that HOLDS THE LIST rather than to `.pane`: the shell
    // draws several, and one of them is the item detail aside.
    const card = page.locator('.card.pane').filter({ has: page.locator('.convrow') });
    await expect(card).toContainText(
      lang === 'he' ? 'מעודכן מול כל קובץ בדיסק' : 'Current with every file on disk');

    // …and nothing claims otherwise. The behind chip and the behind line are
    // the two things that must NOT be here.
    await expect(page.locator('.convrow .chip.warn')).toHaveCount(0);
    await expect(card).not.toContainText(
      lang === 'he' ? 'גדלו מאז הקריאה האחרונה' : 'have grown since they were last read');
  });

  /* ══ seq:7 — ONE SCROLL, AND AN END YOU CAN REACH ══════════════════════ */

  test(`the end of the session is reachable — the defect this replaces (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // The screen used to say "Showing entries 0–50 of 24,757" and there was no
    // way to reach entry 51. There is now no page at all: the count line
    // describes the WHOLE session.
    const count = page.locator('p.tvcount');
    await expect(count).toHaveAttribute('aria-live', 'polite');
    await expect(count).toContainText(String(ROUNDS * 2));

    // Scroll to the very end and read the last thing anybody said.
    //
    // SCOPED TO `.tvbar`, and the scoping is load-bearing rather than tidy:
    // `plan:archive seq:19` added a third `button.tvjump` — the "N new below"
    // affordance, which lives outside the bar and is HIDDEN until turns arrive
    // — so `.last()` began resolving to a control that is correctly invisible
    // and the click waited for it for ever. A test that names the button it
    // means cannot be broken by a button it does not.
    await page.locator('.tvbar button.tvjump').last().click();
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // …and back to the top, to the first thing.
    await page.locator('.tvbar button.tvjump').first().click();
    await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
  });

  test(`only a window of the document is ever in the DOM (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // 480 nodes over 721 records. A viewer that reached the end by drawing all
    // of them would pass the test above and be unusable, which is the answer
    // `seq:7` rules out by name.
    const drawn = await page.locator('.tvscroll .tvrow').count();
    expect(drawn).toBeGreaterThan(0);
    expect(drawn).toBeLessThan(80);

    // The scrollbar still describes the whole document: the container is as
    // tall as the model says the whole session is, and the drawn rows are
    // positioned inside it — so the reader scrolls one continuous surface
    // rather than a window that ends.
    const geometry = await page.locator('.tvscroll').evaluate((n) => ({
      scrollHeight: (n as HTMLElement).scrollHeight,
      clientHeight: (n as HTMLElement).clientHeight,
    }));
    expect(geometry.scrollHeight).toBeGreaterThan(geometry.clientHeight * 5);

    // Scrolling into the middle keeps the DOM the same size — the window
    // moves, it does not grow.
    await page.locator('.tvscroll').evaluate((n) => {
      (n as HTMLElement).scrollTop = (n as HTMLElement).scrollHeight / 2;
    });
    await page.waitForTimeout(400);
    const mid = await page.locator('.tvscroll .tvrow').count();
    expect(mid).toBeLessThan(80);
  });

  test(`content is on screen at every depth, not only at the two ends (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // **THE GUARD FOR THE DEFECT THE FIXTURE COULD NOT FIND.** Driven on the
    // owner's real 61 MB session, the well drew COMPLETELY BLANK at four of
    // seven scroll positions: thirteen rows in the DOM, none of them on
    // screen, no error anywhere. Both tests above passed the whole time — one
    // scrolls to the very end, the other counts rows in the DOM, and neither
    // asks the only question that matters, which is whether the reader can SEE
    // anything.
    //
    // The cause was two positions for one row: the scroller's model and the
    // layout's own, which disagree until every drawn row has been measured.
    // `mountDocument` now positions rows FROM the model, so there is one
    // position; this is what fails if that ever stops being true.
    const blank = await page.evaluate(async () => {
      const well = document.querySelector('.tvscroll') as HTMLElement;
      const out: number[] = [];
      for (const frac of [0, 0.2, 0.4, 0.5, 0.6, 0.8, 0.95, 1]) {
        well.scrollTop = Math.round(well.scrollHeight * frac);
        let seen = 0;
        for (let i = 0; i < 40; i += 1) {
          await new Promise((r) => { setTimeout(r, 150); });
          const box = well.getBoundingClientRect();
          const rows = [...well.querySelectorAll('.tvrow')];
          const visible = rows.filter((row) => {
            const b = row.getBoundingClientRect();
            return b.bottom > box.top + 1 && b.top < box.bottom - 1;
          });
          seen = visible.length;
          if (seen > 0 && !visible.some((row) => row.classList.contains('tvwait'))) break;
        }
        if (seen === 0) out.push(frac);
      }
      return out;
    });
    expect(blank, 'the well drew nothing at these fractions of the document — a virtualised '
      + 'scroll that reaches the end and shows nothing on the way is not a document')
      .toEqual([]);
  });

  /* ══ seq:8 — WHAT THE TERMINAL SHOWED ══════════════════════════════════ */

  test(`a turn renders with its formatting, and terminal colour survives (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // MARKDOWN, not plain text in a box. Measured on the owner's transcript:
    // 175 records carry a fence and ONE carries an ANSI escape, which is why
    // the renderer is the vendored tokeniser and not an ANSI library.
    const said = page.locator('.tvturn.tvclaude .tvsaid').first();
    // `h3`, not `h2`, and that is the renderer's own documented policy rather
    // than a surprise: `lib/markdown.js`' console policy nests a document's
    // headings under the card's own by `min(level + 1, 4)`, which
    // `lib/vendor/VENDOR.md` records as the difference between it and the
    // GitHub view. A turn is content inside a page, so it inherits that.
    await expect(said.locator('h3')).toHaveText('What the terminal showed');
    // `<b>`, not `<strong>`: the console policy's `strong_open` case builds
    // `b`, and the GitHub policy in the same module builds `strong`. Asserted
    // on the RENDERED element, which is how the stylesheet was found to be
    // styling a tag this renderer never emits.
    await expect(said.locator('b')).toHaveText('formatted');
    // Inline code is `<span class="m">` and a fence is a BARE `<pre>` — the
    // console policy's own shapes, not the GitHub policy's `<code>`. These two
    // assertions are what found two dead rules in the stylesheet.
    await expect(said.locator('span.m').first()).toHaveText('code');
    await expect(said.locator('pre')).toContainText('mycontext conversation rebuild');
    await expect(said.locator('table th').first()).toHaveText('column');
    await expect(said.locator('li')).toHaveCount(2);

    // `dir="auto"` is load-bearing: an English turn in the Hebrew page's RTL
    // flow renders its trailing full stop at the WRONG END without it.
    await expect(said).toHaveAttribute('dir', 'auto');

    // ANSI: the escape bytes are gone and the colour they carried is a span.
    await page.locator('.tvscroll').evaluate((n) => { (n as HTMLElement).scrollTop = 1600; });
    await page.waitForTimeout(500);
    const opened = page.locator('.tvwork').first();
    await opened.locator('summary').click();
    // Scoped to the fold this test OPENED. `.tvterm` first on the page resolves
    // inside whichever fold happens to be earliest in the window — and a closed
    // `<details>` hides its contents, so the assertion was waiting on an element
    // that is correctly invisible.
    await expect(opened.locator('.tvterm').first()).toBeVisible();
    const escaped = await page.locator('.tvscroll').innerText();
    expect(escaped).not.toContain('\u001b');
    expect(escaped).not.toContain('[22m');
  });

  /* ══ THE FILTER, WHICH NOW SEES THE WHOLE SESSION ══════════════════════ */

  test(`the filter reads the whole session, not a loaded page (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // The needle is in round 71 of 120 — far past any window that was ever
    // loaded, and far past the fifty records the old screen could search.
    await page.locator('input.tvfind').fill('needle only the whole-session');
    await expect(page.locator('.tvscroll')).toContainText(DEEP_PHRASE, { timeout: 20_000 });
    await expect(page.locator('p.tvcount')).toContainText('1');

    await page.locator('input.tvfind').fill('nothing at all matches this');
    await expect(page.locator('p.tvcount'))
      .toContainText(lang === 'he' ? 'שום דבר' : 'Nothing in this session matches');

    await page.locator('input.tvfind').fill('');
    await expect(page.locator('p.tvcount')).toContainText(String(ROUNDS * 2));

    await page.screenshot({ path: `e2e/screens/conversations-search-${lang}.png`, fullPage: true });
  });

  /* ══ THE RTL EDGE, WHICH THIS PROJECT HAS BEEN BURNED BY ═══════════════ */

  test(`the turn accent sits on the reading edge, in this language (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    const side = await page.locator('.tvturn').first().evaluate((node) => {
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
    // that catches a physical `border-left` written by habit.
    if (lang === 'he') expect(side.right).toBe('3px');
    else expect(side.left).toBe('3px');

    // Nothing in the viewer resolves to a PHYSICAL text alignment — the rule
    // `styles.css`' own header states and `app-layout.spec.ts` enforces on the
    // audit screen. Checked here because this block is new CSS.
    const physical = await page.locator('.tvroot').evaluate((root) => {
      const bad: string[] = [];
      for (const node of [root, ...root.querySelectorAll('*')]) {
        const align = getComputedStyle(node).textAlign;
        if (align === 'left' || align === 'right') bad.push(`${node.className}:${align}`);
      }
      return bad;
    });
    expect(physical, 'a physical text-align in the viewer is a defect under RTL').toEqual([]);

    // And no key is left untranslated: the document's own furniture is in this
    // language, not English wearing a Hebrew page.
    const bar = await page.locator('.tvbar').innerText();
    if (lang === 'he') expect(bar).not.toMatch(/Top|End/);
  });
}

test('the screen is reachable from the rail, under Read', async ({ page }) => {
  await open(page, '#/conversations', 'en');
  const nav = page.locator('.nav[href="#/conversations"], .nav').filter({ hasText: 'Conversations' });
  await expect(nav.first()).toBeVisible();
  await expect(page.locator('.nav[aria-current="page"]')).toContainText('Conversations');
});

/* ══ seq:14 — THE STALENESS LINE, IN A BROWSER ════════════════════════════ */

/**
 * **The deliverable `seq:14` closed without, and named in its own closure as
 * still owed.** That lane built `conv.behind`, `conv.behindRow`,
 * `conv.current`, `conv.refreshedBy` and `staleBytes` on the endpoint, in both
 * languages, and did not touch this file: *"the staleness line is built … and
 * has NO browser test … It is a required deliverable of the next lane on this
 * screen."*
 *
 * **It gets a harness of its own, and that is not caution — it is the only
 * shape that works.** The fixture the rest of this file shares is planted with
 * a last phrase that `the end of the session is reachable` asserts on;
 * appending to it to make the index stale would move that phrase off the end
 * and break the one test this whole file exists for. So: its own home, its own
 * cwd, its own transcript, its own server.
 *
 * The staleness is produced the way the owner's own was — by APPENDING to a
 * transcript AFTER the index was built, and never rebuilding. `seq:14`'s
 * refresh fires on the Stop hook, which no browser test runs, so the index
 * here stays exactly as stale as it was made.
 */
test.describe('the archive says how far behind it is', () => {
  let stale: UiHarness;
  let staleCwd: string;
  let staleHome: string;
  /** Bytes the transcript grew by after the index was built. */
  let grewBy = 0;

  test.beforeAll(async () => {
    staleHome = mkdtempSync(path.join(tmpdir(), 'e2e-stale-home-'));
    staleCwd = mkdtempSync(path.join(tmpdir(), 'e2e-stale-cwd-'));
    const dir = path.join(staleHome, 'projects', projectDirName(staleCwd));
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'sess-stale.jsonl');
    // A short session — this test is about the LIST, not the document.
    writeFileSync(file, session().slice(0, 61).map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = staleHome;
    const previous = process.cwd();
    process.chdir(staleCwd);
    try {
      runCli(['init'], staleCwd, () => {});
      runCli(['conversation', 'rebuild'], staleCwd, () => {});
    } finally {
      process.chdir(previous);
    }

    // THE APPEND, after the rebuild and with nothing to refresh it. Sized to
    // land in kilobytes rather than bytes, so the screen's own `sizeText`
    // renders a unit a reader recognises and the assertion below can name it.
    const grew = [];
    for (let i = 0; i < 30; i += 1) {
      grew.push({
        type: 'user',
        message: { role: 'user', content: `written after the index was built (${i}) ${'.'.repeat(200)}` },
        timestamp: new Date(Date.UTC(2026, 8, 8, 10, 0, i)).toISOString(),
      });
    }
    const added = grew.map((r) => JSON.stringify(r)).join('\n') + '\n';
    grewBy = Buffer.byteLength(added);
    appendFileSync(file, added);

    stale = await startUiChild(staleCwd);
  });

  test.afterAll(async () => {
    await stale?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (staleCwd) removeTree(staleCwd);
    if (staleHome) removeTree(staleHome);
  });

  for (const lang of ['en', 'he'] as const) {
    test(`the list says it is behind, by how much, and who fixes it (${lang})`, async ({ page }) => {
      await page.addInitScript((l) => {
        try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
      }, lang);
      const nonce = await mintNonce(stale.port);
      await page.goto(`http://127.0.0.1:${stale.port}/#${nonce}`);
      await page.waitForSelector('.rail', { timeout: 20_000 });
      await page.evaluate(() => { location.hash = '#/conversations'; });
      await page.waitForSelector('.convrow', { timeout: 20_000 });
      await expect(page.locator('#exited')).toBeHidden();

      expect(grewBy).toBeGreaterThan(1024);

      // Scoped to the card that holds the list: the shell draws `.spill`
      // paragraphs of its own — the credential note, the refusal wording — and
      // an unscoped locator resolves to four of them.
      const card = page.locator('.card.pane').filter({ has: page.locator('.convrow') });

      // THE LIST-LEVEL LINE. It names the amount, because "this list is a bit
      // old" is not a fact anybody can act on — the owner's was 11,231,042
      // bytes behind and the screen said nothing at all.
      const behind = card.locator('p.spill');
      await expect(behind).toContainText(
        lang === 'he' ? 'גדלו מאז הקריאה האחרונה' : 'have grown since they were last read');
      await expect(behind).toContainText('KB');

      // WHO REFRESHES IT, and the command a person can run instead of waiting.
      // Composed, never run: this server writes nothing, which is the whole
      // reason the index can be stale in the first place.
      await expect(card).toContainText(
        lang === 'he' ? 'מתרעננת בסוף כל תור' : 'refreshed at the end of each of your turns');
      await expect(card.locator('p.convcmd')).toContainText('mycontext conversation rebuild');

      // THE PER-ROW CHIP. An aggregate line above the list cannot say WHICH
      // session is behind, and a reader scanning a list of sessions has to be
      // able to tell.
      const chip = page.locator('.convrow .chip.warn');
      await expect(chip).toHaveCount(1);
      await expect(chip).toContainText(lang === 'he' ? 'מפגר' : 'Behind by');
      await expect(chip).toContainText('KB');

      // And the fresh half is NOT also drawn. Two lines claiming opposite
      // things about one list is worse than either alone.
      await expect(card).not.toContainText(
        lang === 'he' ? 'מעודכן מול כל קובץ בדיסק' : 'Current with every file on disk');

      await page.screenshot({
        path: `e2e/screens/conversations-stale-${lang}.png`, fullPage: true,
      });
    });
  }
});

/* ══ seq:19 — THE DOCUMENT FOLLOWS A SESSION STILL BEING WRITTEN ══════════ */

/**
 * **A test cannot use the live session, and `seq:19` says why:** *"the session
 * on screen may be the session writing the record of it being on screen. The
 * document grows BECAUSE it is being looked at."* So this describe writes its
 * own transcript and appends to it itself, and watches its own append arrive.
 *
 * The two cases are the two halves of the owner's condition — *"if i am at the
 * end of the file i could see the changes live near real time asap"* — which
 * binds in both directions: at the tail, follow; scrolled up, DO NOT MOVE.
 */
test.describe('the open document follows the session as it is written', () => {
  let live: UiHarness;
  let liveCwd: string;
  let liveHome: string;
  let liveFile: string;
  let clock = 0;

  /** One prompt and one answer, appended to the file the browser is reading. */
  const appendTurn = (phrase: string): void => {
    clock += 1;
    appendFileSync(liveFile, [
      {
        type: 'user',
        message: { role: 'user', content: phrase },
        timestamp: new Date(Date.UTC(2026, 8, 8, 11, 0, clock)).toISOString(),
      },
      { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  };

  test.beforeAll(async () => {
    liveHome = mkdtempSync(path.join(tmpdir(), 'e2e-live-home-'));
    liveCwd = mkdtempSync(path.join(tmpdir(), 'e2e-live-cwd-'));
    const dir = path.join(liveHome, 'projects', projectDirName(liveCwd));
    mkdirSync(dir, { recursive: true });
    liveFile = path.join(dir, 'sess-live.jsonl');
    // Long enough that the document does not fit the viewport, which is what
    // makes "scrolled up" a state this fixture can actually be in.
    writeFileSync(liveFile, session().map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = liveHome;
    const previous = process.cwd();
    process.chdir(liveCwd);
    try {
      runCli(['init'], liveCwd, () => {});
      runCli(['conversation', 'rebuild'], liveCwd, () => {});
    } finally {
      process.chdir(previous);
    }
    live = await startUiChild(liveCwd);
  });

  test.afterAll(async () => {
    await live?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (liveCwd) removeTree(liveCwd);
    if (liveHome) removeTree(liveHome);
  });

  const openLive = async (page: Page, lang: 'en' | 'he'): Promise<void> => {
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(live.port);
    await page.goto(`http://127.0.0.1:${live.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await page.locator('.convrow').first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  for (const lang of ['en', 'he'] as const) {
    test(`at the end of the file, a new turn arrives on its own (${lang})`, async ({ page }) => {
      // The poll is five seconds and the append has to be noticed, read and
      // drawn after it; the default per-test budget is too tight to be honest
      // about that.
      test.setTimeout(90_000);
      await openLive(page, lang);

      // The document SAYS it is following, and at what cadence — the same
      // disclosure rule the list's "current" line follows, applied to a
      // document that would otherwise update silently or not at all.
      const follows = page.locator('p.tvfollows');
      await expect(follows).toBeVisible();
      await expect(follows).toContainText(lang === 'he' ? '5' : 'every 5 seconds');

      await page.locator('.tvbar button.tvjump').last().click();
      await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

      const phrase = `written while the browser was open ${lang}`;
      appendTurn(phrase);

      // NOBODY RELOADED. The document is the same page load it was, and the
      // turn arrives at the bottom on its own — which is the whole request.
      await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 60_000 });

      // AND THE READER IS LOOKING AT IT, not merely holding it in the DOM.
      //
      // Measured against the WELL and not against the browser viewport, which
      // is what `toBeInViewport()` asks and what failed here first: the
      // document well is taller than the window on this fixture, so its own
      // bottom rows are correctly outside the page's viewport while being
      // exactly where the reader's eye is inside the scroll. The band that
      // matters is `.tvscroll`'s, which is the same comparison `content is on
      // screen at every depth, not only at the two ends` makes for the same
      // reason.
      await expect.poll(async () => page.evaluate((needle) => {
        const well = document.querySelector('.tvscroll') as HTMLElement | null;
        if (well === null) return 'no well';
        const box = well.getBoundingClientRect();
        const row = [...well.querySelectorAll('.tvturn')]
          .find((one) => (one.textContent ?? '').includes(needle as string));
        if (row === undefined) return 'not drawn';
        const seen = row.getBoundingClientRect();
        return seen.bottom > box.top + 1 && seen.top < box.bottom - 1 ? 'in the well' : 'off screen';
      }, phrase), {
        timeout: 20_000,
        message: 'a reader who was at the end when a turn arrived must be looking at it, not '
          + 'holding it somewhere below the fold',
      }).toBe('in the well');

      await page.screenshot({
        path: `e2e/screens/conversations-follow-${lang}.png`, fullPage: true,
      });
    });

    test(`a reader who has scrolled up is told, not dragged (${lang})`, async ({ page }) => {
      test.setTimeout(90_000);
      await openLive(page, lang);

      await page.locator('.tvbar button.tvjump').first().click();
      await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
      const before = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);

      const phrase = `arrived while they were reading the top ${lang}`;
      appendTurn(phrase);

      // THE AFFORDANCE, not the jump. `seq:19`: "A reader dragged to the
      // bottom mid-sentence has been punished for reading."
      const affordance = page.locator('button.tvnew');
      await expect(affordance).toBeVisible({ timeout: 60_000 });
      await expect(affordance).toContainText(lang === 'he' ? 'חדשים למטה' : 'new below');

      // AND THE READER DID NOT MOVE. This is the assertion the whole item
      // turns on; everything above it is the plumbing that makes it possible.
      const after = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);
      expect(after).toBe(before);
      await expect(page.locator('.tvscroll')).not.toContainText(phrase);

      // …and taking the offer goes to it.
      await affordance.click();
      await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 20_000 });
      await expect(affordance).toBeHidden();
    });
  }
});
