// @basis TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and,
// TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has,
// TASK-the-open-document-follows-the-session-as-it-is-written-and,
// TASK-looking-at-the-tab-is-the-fastest-signal-a-reader-can-send,
// TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds,
// TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which,
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
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
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

/**
 * Open the one session and wait for the document to have drawn its first turn.
 *
 * **`at` defaults to `'top'` AND THAT IS NOT WHERE A SESSION OPENS ANY MORE.**
 * `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work` moved the
 * default landing to the END — that is the owner's ruling and the missing half
 * of the follow, since a document only follows a reader who is at the tail. The
 * tests that read the BEGINNING of the document — who spoke first, the first
 * timestamp, the first ANSI colours — are about the document and not about
 * where it opens, so they press Top and say so, rather than being rewritten to
 * assert on whichever turn the end happens to hold.
 *
 * `at: 'default'` is the un-pressed path, and `a session opens at its end` is
 * where the ruling itself is asserted.
 */
async function openDocument(
  page: Page, lang: 'en' | 'he', at: 'top' | 'default' = 'top',
): Promise<void> {
  await open(page, '#/conversations', lang);
  await page.locator('.convrow').first().click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  if (at === 'top') {
    await page.locator('.tvbar button.tvjump').first().click();
    await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });
  }
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
    const stamp = first.locator('time.tvat');
    await expect(stamp).toHaveAttribute('datetime', /^2026-09-08T/);

    // ── AND IT IS IN THE READER'S CLOCK, AND IT SAYS WHICH CLOCK ────────
    //
    // `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`.
    // The owner reported three hours of his session missing; nothing was
    // missing, the screen was drawing the stored UTC value with the `Z` sliced
    // off and he is UTC+3.
    //
    // `playwright.config.ts` pins `timezoneId: 'UTC'`, so the reader HERE is a
    // UTC reader and the digits do not move — which is exactly why this
    // assertion is about the MARKER. A UTC reader is the one for whom the
    // named zone looks like decoration, and dropping it is how the defect
    // comes back for everybody else. The shift itself is proven in
    // `the reader's own zone` below, which runs a browser in Asia/Jerusalem.
    //
    // The `datetime` above is unchanged and still UTC: the stored value never
    // moved, only the display.
    await expect(stamp).toHaveText('2026-09-08 09:00 GMT+0');

    // **`dir="ltr"` SURVIVES, and it now carries more than it did.** A
    // previous lane found `2026-09-08 09:00` drawn as `09:00 2026-09-08` on
    // the Hebrew page — two neutral runs reordered by the RTL paragraph — and
    // fixed it here. Naming the zone made the stamp THREE runs, so the same
    // bidi rule now has a third field to move.
    //
    // Asserted as the COMPUTED direction and not only the attribute, because
    // the attribute is the means and the direction is the property: a
    // stylesheet rule could satisfy one and break the other.
    await expect(stamp).toHaveAttribute('dir', 'ltr');
    expect(await stamp.evaluate((n) => getComputedStyle(n).direction)).toBe('ltr');

    // And the VISUAL order, which is the thing the screenshot showed and no
    // `textContent` assertion can see: bidi reorders what is painted, not what
    // is in the DOM. The first character's box must start to the LEFT of the
    // last character's, on both pages — that is false the moment the stamp is
    // allowed to inherit an RTL paragraph.
    const order = await stamp.evaluate((n) => {
      const text = n.firstChild;
      if (text === null) return null;
      const box = (from: number, to: number): DOMRect => {
        const r = document.createRange();
        r.setStart(text, from);
        r.setEnd(text, to);
        return r.getBoundingClientRect();
      };
      const len = (text.textContent ?? '').length;
      return { first: box(0, 1).left, last: box(len - 1, len).left };
    });
    expect(order).not.toBeNull();
    expect(order!.first).toBeLessThan(order!.last);

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

/* ══ seq:18 — THE READER'S OWN CLOCK, IN A BROWSER THAT IS NOT ON UTC ═════ */

/**
 * **THE THREE HOURS, REPRODUCED AND THEN GONE** —
 * `TASK-a-timestamp-is-shown-in-the-reader-s-own-zone-and-says-which`.
 *
 * Every other test in this file runs under `playwright.config.ts`'
 * `timezoneId: 'UTC'`, which is right for determinism and is also the one
 * setting under which this defect is INVISIBLE: a UTC reader sees the stored
 * value and the local value agree, so a viewer that never converts passes.
 * That is how it shipped.
 *
 * So this block moves the browser to the owner's own zone and nothing else.
 * `Asia/Jerusalem` is still a PIN — a named zone, not the machine's — so the
 * digits below are as deterministic as every other assertion here; what
 * changes is which reader they are determined for.
 *
 * The fixture's first prompt is `09:00:00Z`, so the number to look for is
 * `12:00`. If this test ever draws `09:00` again, that is the owner's report
 * of three missing hours, arriving before he does.
 */
test.describe('the reader\'s own zone', () => {
  test.use({ timezoneId: 'Asia/Jerusalem' });

  for (const lang of ['en', 'he'] as const) {
    test(`a stamp is converted to the reader's clock and names it (${lang})`, async ({ page }) => {
      await openDocument(page, lang);

      const stamp = page.locator('.tvturn time.tvat').first();
      // THE SHIFT. Three hours, exactly the ones he reported.
      await expect(stamp).toHaveText('2026-09-08 12:00 GMT+3');
      // THE STORED VALUE DID NOT MOVE. `datetime` is still the record's own
      // UTC — a document read by a machine, or exported and read next year,
      // has the instant and not one reader's rendering of it.
      await expect(stamp).toHaveAttribute('datetime', '2026-09-08T09:00:00.000Z');

      // The LIST says the same thing about the same session. `endedAt` is the
      // fixture's last record, `09:07:59Z`, which is `12:07` on this clock —
      // the point being that a reader who looks at both surfaces is not handed
      // a subtraction to do.
      await page.evaluate(() => { location.hash = '#/conversations'; });
      await page.waitForSelector('.convrow', { timeout: 20_000 });
      await expect(page.locator('.convrow').first()).toContainText('2026-09-08 12:07 GMT+3');
    });
  }
});

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
      // The poll is one second and the append has to be noticed, read and
      // drawn after it; the default per-test budget is too tight to be honest
      // about that, and this fixture builds a whole server of its own first.
      test.setTimeout(90_000);
      await openLive(page, lang);

      // The document SAYS it is following, and at what cadence — the same
      // disclosure rule the list's "current" line follows, applied to a
      // document that would otherwise update silently or not at all.
      const follows = page.locator('p.tvfollows');
      await expect(follows).toBeVisible();
      // `seq:22` moved the cadence to one second and, with it, the sentence:
      // a `{secs}` slot cannot spell "every 1 seconds" or "כל 1 שניות" in a table
      // with no plural rule, so the number is written into both translations
      // and `test/ui/conversation-follow-cadence.test.ts` is what holds them to
      // `TIP_MS`. It also now discloses the return-to-tab tick, which is the
      // half of the following a reader is most likely to notice.
      await expect(follows).toContainText(lang === 'he' ? 'כל שנייה' : 'every second');

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

  /**
   * **THE COMPOSITION `seq:23` EXISTS FOR, asserted rather than argued.** The
   * document follows only a reader who is AT THE TAIL — `atTail()` is the gate,
   * and `seq:19`'s ruling is that a reader above the end is never dragged down.
   * While a session opened at record zero that meant the feature the owner
   * asked for did not start until he had travelled to the end himself. Nobody
   * presses anything here: the session is opened, and a turn is appended.
   */
  test('the follow is already running at the moment the session opens', async ({ page }) => {
    test.setTimeout(90_000);
    await openLive(page, 'en');
    // NO `.tvjump` CLICK. That absence is the test.
    await expect(page.locator('button.tvnew')).toBeHidden();

    const phrase = 'arrived without anybody travelling to the end first';
    appendTurn(phrase);
    await expect(page.locator('.tvscroll')).toContainText(phrase, { timeout: 30_000 });
    // AND THE READER WAS TAKEN WITH IT rather than told about it, because they
    // were at the tail from the first frame.
    await expect(page.locator('button.tvnew')).toBeHidden();
  });

  /* ══ seq:22 — HOW LONG IT ACTUALLY TAKES ═══════════════════════════════ */

  /**
   * **THE NUMBER THE OWNER ASKED ABOUT IS APPENDED-TO-ON-SCREEN, NOT THE
   * INTERVAL.** `seq:19` proved the turn arrives; his ruling on it was about
   * how long that took — *"it should occure immediate as possible"*, sharpened
   * to *"almost after it occured on the terminal — near real time"*. So these
   * two MEASURE, and the assertion is a ceiling on a measurement rather than a
   * restatement of `TIP_MS`. A 1000 ms interval that delivers in 1600 ms is not
   * what the item claims, and only a clock can tell the two apart.
   *
   * **English only, and not because Hebrew matters less.** The quantity is a
   * round trip and a tail read; nothing on the path is language-dependent, and
   * a second copy would double the wall clock of the slowest describe in this
   * file to re-measure the same server.
   *
   * **The ceilings are loose on purpose.** These run headed, several workers
   * deep, on a machine that may be running other lanes — the same contention
   * `playwright.config.ts` measured and capped workers for. A tight bound would
   * report the machine rather than the screen. The numbers are PRINTED either
   * way, so a regression shows up as a number moving even when nothing fails.
   */
  test('a turn appended while the reader watches is on screen within a second or so', async ({ page }) => {
    test.setTimeout(90_000);
    await openLive(page, 'en');
    // **NO JUMP, AND NO HUNT FOR A PLANTED PHRASE.** The document opens at its
    // end since `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`,
    // so there is nothing to press — and this describe appends to ONE shared
    // transcript from several tests, so "the last phrase" is whichever sibling
    // ran last and is not a thing a test may assert on. Being at the tail is
    // the state that matters, and the affordance is how the screen says so: it
    // appears only for a reader who is NOT at the end.
    await expect(page.locator('button.tvnew')).toBeHidden();
    // The tab is in front, which is the condition `shouldPing` gates on and
    // therefore the condition this measurement is about.
    expect(await page.evaluate(() => document.visibilityState)).toBe('visible');

    // Three appends, because ONE measures where in the poll period the append
    // happened to land as much as it measures the poll. Three spread across it
    // and the worst of them is the honest headline.
    const seen: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      const phrase = `latency probe ${i} ${Date.now()}`;
      const t0 = Date.now();
      appendTurn(phrase);
      // Polled IN THE PAGE at 25 ms, so the clock reads the screen rather than
      // the test runner's own round trips.
      await page.waitForFunction(
        (needle) => (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
        phrase,
        { polling: 25, timeout: 30_000 },
      );
      seen.push(Date.now() - t0);
      // Clear of the next probe, so two appends never share one tick.
      await page.waitForTimeout(1_500);
    }

    const worst = Math.max(...seen);
    console.log(`[seq:22] appended -> on screen, tab in front: ${seen.join(' ms, ')} ms`);
    // A CEILING, and it is the one the item's arithmetic buys: one poll period
    // plus a `/tip` plus a resumed outline read plus a paint. Four seconds is
    // deliberately generous against a contended machine — the point of the
    // bound is that a regression to the old five-second interval, or to a poll
    // that stopped running, fails here rather than reaching the owner.
    expect(worst).toBeLessThan(4_000);
  });

  /**
   * **THE RETURN TO THE TAB, which is `seq:22`'s first deliverable.** A hidden
   * tab does not ask — `shouldPing`, and that rule does not move — so
   * everything appended while the reader was away is waiting. Before this item
   * the screen then waited for the next SCHEDULED tick, and that is not one
   * interval: Chrome throttles a hidden tab's `setInterval` towards once a
   * minute, so the wait after a return was a throttled period rather than
   * `TIP_MS`. This asserts the screen answers the look in one round trip.
   *
   * ── WHY `visibilityState` IS OVERRIDDEN HERE, WHICH IS A REAL WEAKNESS ────
   *
   * The first draft of this test backgrounded the page with a second tab and
   * `bringToFront()`, and it FAILED — the page stayed `visible`. Measured
   * three ways against Playwright 1.62 on this machine, 2026-09-08, before
   * anything was stubbed:
   *
   *     context.newPage() + other.bringToFront()   both pages report `visible`
   *     window.open('_blank') from the first page  both pages report `visible`
   *     CDP Emulation.setPageVisibilityOverride    'wasn't found' — removed
   *     CDP Page.setWebLifecycleState 'frozen'     still reports `visible`
   *
   * Playwright gives every page its own top-level window rather than a tab, so
   * nothing in the harness can produce a genuinely hidden document. So the
   * property is overridden — and the override is confined to the ONE thing the
   * harness cannot do. Everything else on the path is real: the real
   * `visibilitychange` and `focus` events, the real `onLook` handler, the real
   * `shouldPing` gate reading the property, real requests to `/tip`, a real
   * append on disk and a real repaint.
   *
   * **AND THE FIRST HALF OF THIS TEST IS WHAT KEEPS THAT HONEST.** A stub that
   * the code ignored would show up as the hidden document polling anyway, so
   * the six seconds of silence below is not padding — it is the evidence that
   * the override reaches the gate at all, and it is also the assertion that
   * `seq:22` did not weaken the rule `test/ui/viewmodel.test.ts` states in
   * isolation: a tab nobody is looking at does not ask.
   *
   * What is NOT covered, said rather than implied: the browser's own
   * background-timer throttling. That is what makes the real-world wait much
   * worse than `TIP_MS` and it is exactly the part a test cannot stage.
   */
  test('a reader coming back to the tab is not made to wait for the next tick', async ({ page }) => {
    test.setTimeout(90_000);

    // Added BEFORE `openLive`'s own init script and its navigation, so the app
    // sees the overridden getter from its first line.
    await page.addInitScript(() => {
      let forced: string | null = null;
      Object.defineProperty(Document.prototype, 'visibilityState', {
        configurable: true,
        get(): string { return forced ?? 'visible'; },
      });
      Object.defineProperty(window, '__look', {
        value: (state: string | null) => {
          forced = state;
          // BOTH events, because the screen registers both and the guard that
          // stops them asking twice is the thing worth measuring.
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new Event('focus'));
        },
      });
    });

    /** Every `/tip` the page asks for, by wall clock. */
    const tips: number[] = [];
    page.on('request', (r) => { if (r.url().includes('/tip')) tips.push(Date.now()); });

    await openLive(page, 'en');
    // **NO JUMP, AND NO HUNT FOR A PLANTED PHRASE.** The document opens at its
    // end since `TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`,
    // so there is nothing to press — and this describe appends to ONE shared
    // transcript from several tests, so "the last phrase" is whichever sibling
    // ran last and is not a thing a test may assert on. Being at the tail is
    // the state that matters, and the affordance is how the screen says so: it
    // appears only for a reader who is NOT at the end.
    await expect(page.locator('button.tvnew')).toBeHidden();

    await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
      .__look('hidden'));
    expect(await page.evaluate(() => document.visibilityState)).toBe('hidden');

    const phrase = 'appended while the reader was away';
    const hiddenFrom = Date.now();
    appendTurn(phrase);
    // Six seconds — long enough that the OLD five-second interval would have
    // fired once and the new one six times, had the tab been in front.
    await page.waitForTimeout(6_000);
    const asked = tips.filter((t) => t > hiddenFrom).length;
    expect(asked, 'a hidden tab must not ask, and this is the rule seq:22 must not move').toBe(0);
    expect(await page.evaluate((needle) =>
      (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
    phrase)).toBe(false);

    const t0 = Date.now();
    await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
      .__look(null));
    await page.waitForFunction(
      (needle) => (document.querySelector('.tvscroll')?.textContent ?? '').includes(needle as string),
      phrase,
      { polling: 25, timeout: 30_000 },
    );
    const back = Date.now() - t0;
    console.log(`[seq:22] returned to tab -> on screen: ${back} ms`);
    // ONE ROUND TRIP, not one interval and certainly not one throttled
    // interval. The bound is under the 5 s the screen used to wait at BEST,
    // so a regression that deletes the two listeners cannot pass here.
    expect(back).toBeLessThan(3_000);

    // AND EXACTLY ONE ASK IN THAT FIRST MOMENT. `visibilitychange` and `focus`
    // both fired, microseconds apart, and the screen answered once — which is
    // the double-fire guard, load-bearing at a one-second interval and
    // untestable by reading the code.
    const burst = tips.filter((t) => t >= t0 && t < t0 + 300).length;
    console.log(`[seq:22] /tip requests in the 300 ms after the look: ${burst}`);
    expect(burst, 'one look, one ask — visibilitychange and focus must not both fire a tick')
      .toBe(1);
  });

  /**
   * **A BIG JUMP COUNTS RIGHT, and the item asks for this in those words:** the
   * "N new below" affordance must be correct after a long absence, not only
   * after a single turn arriving under a reader who is watching.
   *
   * The failure it guards against is not hypothetical arithmetic. `refill`
   * rebuilds the LAST node rather than skipping past it — an open `work` run
   * that the append extended is a different node now — so the increment is
   * `fresh.length - 1` and not `fresh.length`. That off-by-one is invisible
   * when one turn arrives and one node changes, and it is the whole count when
   * forty do.
   */
  test('after a long absence the count of what arrived is right, not approximately right',
    async ({ page }) => {
      test.setTimeout(120_000);
      await page.addInitScript(() => {
        let forced: string | null = null;
        Object.defineProperty(Document.prototype, 'visibilityState', {
          configurable: true,
          get(): string { return forced ?? 'visible'; },
        });
        Object.defineProperty(window, '__look', {
          value: (state: string | null) => {
            forced = state;
            document.dispatchEvent(new Event('visibilitychange'));
            window.dispatchEvent(new Event('focus'));
          },
        });
      });

      await openLive(page, 'en');
      // SCROLLED UP, which is what makes the count exist at all: a reader at
      // the tail is taken there and never sees a number.
      await page.locator('.tvbar button.tvjump').first().click();
      await expect(page.locator('.tvscroll')).toContainText('What the terminal showed', { timeout: 20_000 });

      await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
        .__look('hidden'));

      // TWENTY turns while away. Each `appendTurn` writes a `user` record and
      // an `attachment` record, and a `said` node closes any open `work` run —
      // so twenty rounds is forty nodes, and the one node that was open at the
      // end of the document is rebuilt rather than added. Forty is therefore
      // the number the screen must say.
      const many = 20;
      for (let i = 0; i < many; i += 1) appendTurn(`a turn that landed while nobody looked ${i}`);
      await page.waitForTimeout(2_000);
      await expect(page.locator('button.tvnew')).toBeHidden();

      const scrolledTo = await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop);
      await page.evaluate(() => (window as unknown as { __look: (s: string | null) => void })
        .__look(null));

      const affordance = page.locator('button.tvnew');
      await expect(affordance).toBeVisible({ timeout: 20_000 });
      const said = (await affordance.textContent() ?? '').trim();
      console.log(`[seq:22] after ${many} turns arrived unseen, the screen says: ${said}`);
      // THE NUMBER, not "a number". `{n} new below` with `n` wrong is worse
      // than no affordance, because a reader acts on it.
      expect(said).toContain(`${many * 2} new below`);

      // AND THE READER STILL DID NOT MOVE, which is `seq:19`'s ruling and does
      // not stop applying because a lot arrived at once.
      expect(await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop))
        .toBe(scrolledTo);

      await affordance.click();
      await expect(page.locator('.tvscroll'))
        .toContainText(`a turn that landed while nobody looked ${many - 1}`, { timeout: 20_000 });
      await expect(affordance).toBeHidden();
    });
});

/* ══ seq:20 — THE CHIP GLYPHS, MEASURED IN THE CASCADE ════════════════════ */

/**
 * **`getComputedStyle(el, '::before').content`, kept rather than thrown away.**
 * `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds` was found
 * with exactly this probe and closes by saying that whatever is chosen, this is
 * the guard — because the defect is a SPECIFICITY one and no assertion on
 * markup can see it. Every `data-g` was still in the DOM while six of the eight
 * chip kinds drew their colour's glyph instead.
 *
 * **AND IT ASSERTS THE SCOPE, WHICH IS THE RULING.** Owner ruling 2026-09-08:
 * the `data-g` comes alive on the conversation archive's chips and NOWHERE
 * else, because letting it win everywhere would change glyphs he has read for
 * weeks on Doctor, Decay, Work, Watch and Status. So the half of this test that
 * will look wrong to a future reader — an unmarked `warn` chip must still draw
 * `▲` even with a `data-g` on it — is there on purpose. Two glyph vocabularies
 * coexist deliberately; deleting that assertion is how the ruling gets quietly
 * reversed.
 */
test.describe('a conversation chip draws its own glyph, and only there', () => {
  test('the six kinds that overrode data-g honour it when a chip asks', async ({ page }) => {
    await open(page, '#/conversations', 'en');

    const drawn = await page.evaluate(() => {
      const read = (cls: string, g: string): string => {
        const span = document.createElement('span');
        span.className = cls;
        span.dataset['g'] = g;
        span.textContent = 'probe';
        document.body.append(span);
        const got = getComputedStyle(span, '::before').content;
        span.remove();
        return got;
      };
      const kinds = ['warn', 'crit', 'carry', 'ok', 'gov', 'unmeas', 'index', ''];
      const out: Record<string, { plain: string; glyphed: string }> = {};
      for (const kind of kinds) {
        out[kind === '' ? 'plain' : kind] = {
          plain: read(`chip ${kind}`.trim(), '⦸'),
          glyphed: read(`chip ${kind} glyphed`.trim(), '⦸'),
        };
      }
      return out;
    });

    // WHAT THE ITEM MEASURED, UNCHANGED: an unmarked meaning-coloured chip
    // still wears its colour's glyph, `data-g` or no `data-g`. That is the
    // ruling and not a leftover.
    expect(drawn['warn']?.plain).toContain('▲');
    expect(drawn['crit']?.plain).toContain('■');
    expect(drawn['carry']?.plain).toContain('◇');
    expect(drawn['ok']?.plain).toContain('●');
    expect(drawn['gov']?.plain).toContain('◆');
    expect(drawn['unmeas']?.plain).toContain('◌');
    // …and the two kinds that always honoured it still do.
    expect(drawn['index']?.plain).toContain('⦸');
    expect(drawn['plain']?.plain).toContain('⦸');

    // AND THE OPT-IN WINS ON ALL EIGHT. `.chip.glyphed[data-g]::before` beats
    // the colour classes on SPECIFICITY rather than on source order, which is
    // what stops a future re-ordering of the stylesheet from undoing it.
    for (const kind of Object.keys(drawn)) {
      expect(drawn[kind]?.glyphed, `chip ${kind} glyphed`).toContain('⦸');
    }
  });

  test('the marked chips the shared fixture happens to draw all honour their data-g', async ({ page }) => {
    await open(page, '#/conversations', 'en');

    // **THIS SWEEP IS A NET, NOT THE PROOF.** The shared fixture is a clean
    // session — nothing pruned, nothing capped, no failed step — so it draws
    // few marked chips or none, and a loop over an empty list asserts nothing.
    // The describe below plants a fixture that DOES draw them and is where the
    // claim is actually tested. This one is here because it costs one page load
    // and catches a marked chip that stops honouring its glyph anywhere on this
    // screen, including ones added later.
    for (const where of ['#/conversations', 'document'] as const) {
      if (where === 'document') {
        await page.locator('.convrow').first().click();
        await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
      }
      const marked = await page.evaluate(() =>
        [...document.querySelectorAll('.chip.glyphed')].map((el) => ({
          cls: el.className,
          g: (el as HTMLElement).dataset['g'] ?? '',
          before: getComputedStyle(el, '::before').content,
        })));
      for (const one of marked) {
        expect(one.g, `${one.cls} carries a data-g`).not.toBe('');
        expect(one.before, `${one.cls} draws its own data-g`).toContain(one.g);
      }
    }

    // The synthetic-turn label is the one that always worked, and it is the
    // control: `.chip.index` has no `::before` of its own, so it honours
    // `data-g` through the base rule and needs no opt-in. If this fails, the
    // base rule moved.
    const tag = page.locator('.chip.index.tvtag').first();
    if (await tag.count() > 0) {
      const before = await tag.evaluate((el) => getComputedStyle(el, '::before').content);
      expect(before).toContain('⌁');
    }
  });
});

/**
 * **THE CHIPS THE ITEM NAMED, DRAWN BY THE SCREEN RATHER THAN BY A PROBE.**
 *
 * The probe above proves the CASCADE; this proves the SCREEN uses it, and the
 * two are different claims — a `data-g` can render perfectly on a chip no call
 * site ever marks. It needs a fixture of its own because the shared session is
 * clean: `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds`
 * lists six dead call sites and not one of them fires on a healthy transcript.
 *
 * So this plants the two that can be made to happen without a new feature:
 *   - a PRUNED row — indexed, then the file deleted, which is what the harness
 *     does to a real transcript and the reason `export` exists at all. `chip
 *     warn` with `data-g="⦸"`, which used to draw `▲`.
 *   - a FAILED STEP — a `tool_result` carrying `is_error`, which is the one
 *     field `shapeOf` reads for it. `chip crit` with `data-g="⚠"`, which used
 *     to draw `■`.
 *
 * **AND A BEHIND ROW, WHICH IS THE CONTROL AND THE POINT.** Appending to the
 * indexed session after the rebuild puts an UNMARKED `chip warn` on the same
 * list as the marked one. Two `warn` chips, side by side, drawing two different
 * glyphs — `▲` and `⦸` — is the owner's ruling as a picture: `data-g` comes
 * alive where a chip asks for it and the colour vocabulary is untouched
 * everywhere else.
 *
 * The two dead call sites this cannot reach are `conv.scanCapped` (needs a
 * 256 MB transcript) and `conv.exported` (needs the export `plan:archive`
 * seq:4/5 has not shipped — `source` is hard-coded `'live'` in
 * `conversation-index.ts` today, so no row can carry it yet).
 */
test.describe('the archive draws its own glyphs where the item said it did not', () => {
  let glyphs: UiHarness;
  let glyphCwd: string;
  let glyphHome: string;

  test.beforeAll(async () => {
    glyphHome = mkdtempSync(path.join(tmpdir(), 'e2e-glyph-home-'));
    glyphCwd = mkdtempSync(path.join(tmpdir(), 'e2e-glyph-cwd-'));
    const dir = path.join(glyphHome, 'projects', projectDirName(glyphCwd));
    mkdirSync(dir, { recursive: true });

    const at = (s: number): string => new Date(Date.UTC(2026, 8, 8, 13, 0, s)).toISOString();
    const kept = path.join(dir, 'sess-glyph-kept.jsonl');
    writeFileSync(kept, [
      { type: 'user', message: { role: 'user', content: 'the session with a failed step' }, timestamp: at(0) },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Bash', input: { command: 'exit 1' } }] },
        timestamp: at(1),
      },
      {
        type: 'user',
        message: { role: 'user', content: [{ type: 'tool_result', is_error: true, content: 'command failed' }] },
        timestamp: at(2),
      },
      {
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'that step did not work' }] },
        timestamp: at(3),
      },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');

    const gone = path.join(dir, 'sess-glyph-pruned.jsonl');
    writeFileSync(gone, [
      { type: 'user', message: { role: 'user', content: 'the session the harness later pruned' }, timestamp: at(10) },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'and its answer' }] }, timestamp: at(11) },
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');

    process.env['CLAUDE_CONFIG_DIR'] = glyphHome;
    const previous = process.cwd();
    process.chdir(glyphCwd);
    try {
      runCli(['init'], glyphCwd, () => {});
      runCli(['conversation', 'rebuild'], glyphCwd, () => {});
    } finally {
      process.chdir(previous);
    }

    // AFTER the index was built, and never rebuilt — which is exactly how the
    // owner's own archive gets into both of these states.
    rmSync(gone);
    appendFileSync(kept, JSON.stringify({
      type: 'user',
      message: { role: 'user', content: `written after the index was built ${'.'.repeat(2000)}` },
      timestamp: at(20),
    }) + '\n');

    glyphs = await startUiChild(glyphCwd);
  });

  test.afterAll(async () => {
    await glyphs?.stop();
    delete process.env['CLAUDE_CONFIG_DIR'];
    if (glyphCwd) removeTree(glyphCwd);
    if (glyphHome) removeTree(glyphHome);
  });

  const openGlyphs = async (page: Page): Promise<void> => {
    await page.addInitScript(() => {
      try { localStorage.setItem('myctx-lang', 'en'); } catch { /* private mode */ }
    });
    const nonce = await mintNonce(glyphs.port);
    await page.goto(`http://127.0.0.1:${glyphs.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.evaluate(() => { location.hash = '#/conversations'; });
    await page.waitForSelector('.convrow', { timeout: 20_000 });
    await expect(page.locator('#exited')).toBeHidden();
  };

  test('two warn chips on one list draw two different glyphs', async ({ page }) => {
    await openGlyphs(page);

    const pruned = page.locator('.convrow .chip.warn.glyphed');
    await expect(pruned).toHaveCount(1);
    await expect(pruned).toContainText('File deleted');
    // THE ASSERTION THE ITEM ASKED FOR, made the way it asked: read the
    // cascade, not the markup. `⦸` was in the DOM before this fix too.
    expect(await pruned.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('⦸');

    // THE CONTROL, on the same screen and in the same colour. An unmarked warn
    // chip still wears `▲`, which is the ruling: the archive's chips changed
    // and the vocabulary the owner reads everywhere else did not.
    const behind = page.locator('.convrow .chip.warn:not(.glyphed)');
    await expect(behind).toHaveCount(1);
    await expect(behind).toContainText('Behind by');
    expect(await behind.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('▲');

    await page.screenshot({ path: 'e2e/screens/conversations-glyphs-en.png', fullPage: true });
  });

  test('a failed step wears a warning sign and not the crit square', async ({ page }) => {
    await openGlyphs(page);
    // The row picked by a CHIP rather than by a title: a row's title is the
    // model's own, and this fixture never gave the model a chance to name one.
    await page.locator('.convrow')
      .filter({ has: page.locator('.chip.warn:not(.glyphed)') }).first().click();
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

    const bad = page.locator('.tvwork .chip.crit.glyphed').first();
    await expect(bad).toBeVisible({ timeout: 20_000 });
    await expect(bad).toContainText('failed');
    expect(await bad.evaluate((el) => getComputedStyle(el, '::before').content))
      .toContain('⚠');
    // `■` is what it drew before the opt-in existed. Naming it here is what
    // makes this test fail loudly if the scoping is ever "tidied" away.
    expect(await bad.evaluate((el) => getComputedStyle(el, '::before').content))
      .not.toContain('■');
  });
});

/* ══ seq:23 — A SESSION OPENS WHERE THE WORK IS ═══════════════════════════ */

/**
 * **`TASK-a-session-opens-at-its-end-because-the-end-is-where-the-work`.** Owner
 * ruling 2026-09-08: *"when the session is opened in conversation, scroll it to
 * the end by default."* Until then `mountDocument` finished by calling
 * `applyFilter()`, which contains `scroll.scrollTop = 0`, so every session
 * opened at record zero — on the owner's own session, 28,998 records from where
 * he works.
 *
 * **The three tests here are the three ways this goes wrong**, and each is a
 * trap the item named before the code was written:
 *   - the landing is a SUM OF ESTIMATES at mount, so setting `scrollTop` once
 *     lands somewhere that stops being the end the moment the first rows are
 *     measured. Held with `stickUntil`, the way `refill` holds its own.
 *   - the mount path and the FILTER path used to share that one line, and the
 *     filter wants the opposite end. Typing a query must still go to the top.
 *   - a hold is not a pin. A reader who opens a session and scrolls up has said
 *     something, and `seq:19`'s ruling — do not move a reader who is above the
 *     end — does not stop applying in the first three seconds.
 */
test.describe('a session opens at its end', () => {
  for (const lang of ['en', 'he'] as const) {
    test(`the last turn is on screen without anybody pressing End (${lang})`, async ({ page }) => {
      await openDocument(page, lang, 'default');

      // THE RULING, as the reader meets it: the newest turn is in the well.
      await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

      // AND IT HELD. This is the assertion that fails if the landing is set
      // once and hoped for: `scroller.total` is a sum of ESTIMATES at mount and
      // moves under the reader as rows are measured and bodies arrive, so a
      // check taken immediately would pass on a document that has already
      // drifted a screenful up by the time anybody looks. Measured against the
      // well's own scroll box, after the settling window.
      await page.waitForTimeout(1_500);
      const landed = await page.locator('.tvscroll').evaluate((n) => {
        const el = n as HTMLElement;
        return { top: el.scrollTop, max: el.scrollHeight - el.clientHeight };
      });
      expect(landed.max, 'the fixture must be taller than the well, or this proves nothing')
        .toBeGreaterThan(500);
      expect(landed.max - landed.top).toBeLessThan(4);

      // AND THE DISCLOSURE UNDER IT IS READ AND KEPT, in both languages. The
      // cadence sentence lost its `{secs}` slot in `seq:22` — a table with no
      // plural rule cannot spell "every 1 seconds" — so the number is written
      // into the prose, and this is where a human being can look at the result
      // rather than at an assertion about it.
      const follows = page.locator('p.tvfollows');
      console.log(`[seq:22] the note (${lang}): ${(await follows.textContent() ?? '').trim()}`);
      await follows.screenshot({ path: `e2e/screens/conversations-follows-note-${lang}.png` });

      await page.screenshot({
        path: `e2e/screens/conversations-opens-at-end-${lang}.png`, fullPage: true,
      });
    });
  }

  test('typing a query still goes to the top, which is where matches are read from', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    await expect(page.locator('.tvscroll')).toContainText(LAST_PHRASE, { timeout: 20_000 });

    // TRAP ONE. `applyFilter` is the input handler as well as the old mount
    // path, and resetting to the top on a filter change is CORRECT. If this
    // ever lands at the bottom, the two paths have been re-joined.
    await page.locator('.tvfind').fill('round 3:');
    await expect(page.locator('.tvscroll')).toContainText('round 3:', { timeout: 20_000 });
    await page.waitForTimeout(1_500);
    expect(await page.locator('.tvscroll').evaluate((n) => (n as HTMLElement).scrollTop)).toBe(0);
  });

  test('a reader who scrolls up as it opens is obeyed, not held', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    const well = page.locator('.tvscroll');
    await expect(well).toContainText(LAST_PHRASE, { timeout: 20_000 });

    /**
     * **THE GAP FROM THE END, never an absolute `scrollTop`.** Two measured
     * failures put it this way. `scroller.total` GROWS while rows are measured
     * and bodies arrive, so an absolute number taken before the document
     * settled compared against a maximum taken after it read as "still at the
     * end" when the reader had moved (chrome, 22508.5 against a 22474
     * maximum). A distance from the end is immune to the total moving.
     */
    const gap = async (): Promise<number> => well.evaluate((n) => {
      const el = n as HTMLElement;
      return (el.scrollHeight - el.clientHeight) - el.scrollTop;
    });

    // **`locator.press`, NOT `keyboard.press` AND NOT `mouse.wheel`.** Both of
    // the cheaper spellings were tried and both failed on the `chrome` project
    // while passing on `chromium`: a single large wheel delta is clamped (170
    // px of a 22,497 px document), and a bare `keyboard.press` goes to whatever
    // holds focus — which is not necessarily the well, and a key that never
    // reaches the well is not the `keydown` this hold listens for. `press` on
    // the locator focuses it first. Pressed repeatedly because one PageUp is
    // one viewport of a document that is still measuring itself.
    await expect.poll(async () => {
      await well.press('PageUp');
      return gap();
    }, {
      timeout: 20_000,
      message: 'PageUp on the well must actually move the reader off the end, or the assertion '
        + 'below proves nothing',
    }).toBeGreaterThan(400);

    // AND THEY STAY THERE. The mount hold is a CEILING released by the reader's
    // own input — `wheel`, `keydown`, `pointerdown` — exactly as the follow's
    // is. If this fails, opening a session has become a pin, which is the wrong
    // `seq:19` in the other direction.
    await page.waitForTimeout(2_000);
    expect(await gap(), 'a reader who took the scroll must not be dragged back to the end')
      .toBeGreaterThan(400);
  });

  test('Top and End still do what they say, with the default moved', async ({ page }) => {
    await openDocument(page, 'en', 'default');
    const well = page.locator('.tvscroll');

    // TOP, pressed INSIDE the hold window. The three release listeners are on
    // the WELL and this button is in the bar above it, so without the handler
    // clearing the hold itself the next paint would put the reader straight
    // back at the end. Top matters more, not less, once the default moves.
    await page.locator('.tvbar button.tvjump').first().click();
    await expect(well).toContainText('What the terminal showed', { timeout: 20_000 });
    await page.waitForTimeout(1_500);
    expect(await well.evaluate((n) => (n as HTMLElement).scrollTop)).toBe(0);

    await page.locator('.tvbar button.tvjump').last().click();
    await expect(well).toContainText(LAST_PHRASE, { timeout: 20_000 });
  });
});
