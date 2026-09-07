/**
 * **The command-line card, read in a browser, in both languages.**
 *
 * `TASK-the-help-is-tested-as-a-reader-would-use-it-every-subject` (plan D27).
 *
 * ── WHAT THIS FILE IS FOR, GIVEN THAT TWO OTHERS ALREADY TEST THIS CARD ───
 *
 * `test/ui/cli-help.test.ts` holds the ENDPOINT against the records it derives
 * from. `test/ui/cli-help-reader.test.ts` opens every one of the ~168 subjects
 * against a stand-in document and compares each drawn cell with the derivation
 * it came from. Neither of them can see a PICTURE, and every layout defect this
 * screen has shipped was found by looking at one after the assertions passed:
 *
 *   - a 600-character example line laid its `span.m` out at 2,321px, pushed
 *     `main.body`'s single auto track to 2,696px against a 1,403px viewport,
 *     and opened the page to 1,325px of horizontal overflow;
 *   - `.excmd` scrolls, and a scroll container inherits the page's direction,
 *     so under `dir="rtl"` it opened at its RIGHT edge and showed a Hebrew
 *     reader `… --items --sessions --files` with the command's own name gone
 *     off the left;
 *   - and a topic drew `##` because it was `<pre>` over Markdown.
 *
 * So this file measures the three things only a browser can answer: **what the
 * page's own width does**, **where the glyphs of a command line actually
 * start**, and **whether a document was rendered or printed** — for the worst
 * subjects rather than for a convenient one, and the worst subject is CHOSEN BY
 * MEASUREMENT here rather than named.
 *
 * ── THE CORPUS IS `.demo-corpus`, SO NO FIGURE IS WRITTEN DOWN ────────────
 *
 * `e2e/app.ts` serves the fixture corpus, where `edit`'s dynamic flag surface
 * and the category descriptions are that project's rather than this one's.
 * Every count below is therefore read from `/api/cli-help` in the page and
 * compared with the picker, never asserted against a number typed here — which
 * is the same bargain the card itself makes.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { settleScreen } from './settle.ts';

const LIB = '[data-p="library"]';
/**
 * The command-line card, addressed by WHAT IT CONTAINS. The Library holds four
 * cards and `.card.last()` silently became a different card the day the fourth
 * landed — `:has()` names a property instead of an ordering.
 */
const CARD = `${LIB} .card:has(.clihdetail)`;
const PICK = `${CARD} select`;
const PANE = `${CARD} .clihdetail`;

/** Screenshots go OUTSIDE the repository: a test run must leave no untracked
 *  artefact in the owner's tree. `SHOTS` is set by the runner's env or falls
 *  back to Playwright's own results directory, which `.gitignore` covers. */
const SHOTS = process.env['MYCONTEXT_E2E_SHOTS'] ?? path.join('test-results', 'cli-help');

async function openLibrary(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/library'; });
  const settled = await settleScreen(page, 'library', { requires: '.clihdetail' });
  expect(
    settled.settled,
    `the Library never settled — ${settled.count} elements and ${settled.inFlight} /api reads `
    + `still open after ${settled.attempts} samples. Measured nothing; failing as itself.`,
  ).toBe(true);
  await expect(page.locator(PICK)).toBeVisible({ timeout: 15_000 });
}

/**
 * Switch the console's language through the control a person uses, which
 * RELOADS the page — so the Library is re-opened afterwards, and the code-skew
 * banner a sibling lane's edit can raise on that second load is dismissed
 * exactly as `corpus-tree.spec.ts` dismisses it, and for the same reason:
 * without this the RTL screenshot is a picture of a banner.
 */
async function switchToHebrew(page: Page): Promise<void> {
  await page.locator('#lang').click();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl', { timeout: 15_000 });
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.getByRole('button').first().click().catch(() => {});
  }
  await openLibrary(page);
}

/** The endpoint's own roster, read by the PAGE so it is the same server the
 *  card was drawn from and the same session. */
async function index(page: Page): Promise<{
  subjects: { kind: string; id: string; label: string }[];
  counts: Record<string, number>;
  flagRows: number;
}> {
  return await page.evaluate(async () => {
    const response = await fetch('/api/cli-help', { credentials: 'same-origin' });
    return await response.json() as {
      subjects: { kind: string; id: string; label: string }[];
      counts: Record<string, number>;
      flagRows: number;
    };
  });
}

/**
 * Open one subject the way a reader does, and wait for the pane to BE it.
 *
 * `> h3` and not `h3`: a rendered help topic brings its own `<h3>` headings —
 * `categories` draws three — so the descendant selector matched four elements
 * and the wait failed on a card that was perfectly correct. The subject's own
 * heading is the pane's direct child, which is a structural fact rather than a
 * count.
 */
async function choose(page: Page, kind: string, id: string, label: string): Promise<void> {
  await page.locator(PICK).selectOption(`${kind}/${id}`);
  await expect(page.locator(`${PANE} > h3`)).toHaveText(label, { timeout: 15_000 });
  await expect(page.locator(`${PANE} .spill`)).toHaveCount(0);
}

/**
 * One string, out of the table THE PAGE IS USING — imported in the browser from
 * the server that served it, so no sentence is typed into this file and the
 * language in force is the one being read.
 */
function say(page: Page, key: string): Promise<string> {
  return page.evaluate(async (k) => {
    const lang = document.documentElement.lang === 'he' ? 'he' : 'en';
    const table = await import(`/strings/${lang}.js`) as { strings: Record<string, string> };
    const value = table.strings[k as string];
    if (value === undefined) throw new Error(`no string key ${k as string}`);
    return value;
  }, key);
}

/**
 * Photograph THE CARD, not the page.
 *
 * The console scrolls inside `main.body` rather than on the document, so
 * `fullPage: true` returns a picture of whatever the viewport was showing — the
 * Library's first two cards — and the command-line card, which is the fourth,
 * is not in it. Measured: five `fullPage` shots of five different subjects came
 * back as the same picture of the Documents card. An element screenshot is a
 * picture of the thing under test.
 */
async function shoot(page: Page, name: string): Promise<void> {
  // The card is brought into view and the VIEWPORT is photographed — an element
  // screenshot of something taller than its own scroll container comes back
  // mostly black, and what is wanted here is the reader's field of view anyway.
  await page.locator(`${PANE} > h3`).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

/** The page's own horizontal overflow, in CSS pixels. Zero, or the page is
 *  wider than the window and a reader is scrolling sideways to read prose. */
function overflow(page: Page): Promise<number> {
  return page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

/* ══ THE PICKER IS THE ENDPOINT'S ROSTER, AND NOTHING ELSE ═════════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`the picker offers every subject the endpoint serves, in four groups (${lang})`, async ({
    app,
  }) => {
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const drawn = await page.evaluate((selector) => {
      const select = document.querySelector<HTMLSelectElement>(selector);
      return {
        options: [...(select?.querySelectorAll('option') ?? [])].map((o) => o.value),
        groups: [...(select?.querySelectorAll('optgroup') ?? [])].map((g) => g.label),
      };
    }, PICK);

    // One placeholder plus one option per subject — no more, and no fewer. The
    // picker GROUPS by kind, so the endpoint's roster is regrouped in the
    // picker's own kind order before it is compared: the drawn order is the
    // card's, and the drawn MEMBERSHIP is the endpoint's.
    expect(drawn.options[0], 'the first option is the "choose a subject" placeholder').toBe('');
    const kinds = [...new Set(body.subjects.map((s) => s.kind))];
    const grouped = drawn.options.slice(1).map((value) => value.slice(0, value.indexOf('/')));
    expect([...new Set(grouped)].length, 'every kind is drawn as one contiguous group')
      .toBe(kinds.length);
    for (const kind of kinds) {
      expect(drawn.options.filter((v) => v.startsWith(`${kind}/`)),
        `the ${kind} group must be the endpoint's own list for that kind, in its own order`)
        .toEqual(body.subjects.filter((s) => s.kind === kind).map((s) => `${s.kind}/${s.id}`));
    }
    expect(drawn.groups.length, 'four kinds, four groups — a group with no rows is not drawn')
      .toBe(4);
    // And the headline sentence carries the endpoint's five figures rather than
    // any number this page could hold.
    // The card's OWN paragraphs (`>`, so nothing inside the detail pane), and
    // of those the one carrying figures — a property rather than an ordering.
    // The other two, the sub-heading and the withheld notice, carry no digit in
    // either language, which is what makes that a filter and not a guess.
    const counts = await page.locator(`${CARD} > p.small`)
      .filter({ hasText: /\d/ }).first().innerText();
    for (const figure of [
      body.counts['command'], body.counts['slash'], body.counts['tool'], body.counts['topic'],
      body.flagRows,
    ]) {
      expect(counts, `the card's headline sentence must print ${figure}`)
        .toContain(String(figure));
    }
  });
}

/* ══ THE PAGE DOES NOT OPEN SIDEWAYS — THE 1,325px DEFECT ══════════════════ */

/**
 * **The worst subject, chosen by measuring rather than by being named.**
 *
 * Every command is opened and the widest laid-out `.excmd` on each is recorded;
 * the page's own horizontal overflow is read at every step. A command line is
 * allowed to be 2,300px long — it SCROLLS, because a shell command broken
 * across lines mid-flag is one nobody can copy — but the page it sits on is
 * not allowed to grow with it.
 *
 * Run in both languages because the failure was found in Hebrew: the same
 * content, laid out in a right-to-left grid, is a different measurement.
 */
for (const lang of ['en', 'he'] as const) {
  test(`no subject opens the page sideways, however long its command line (${lang})`, async ({
    app,
  }) => {
    test.slow();
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const commands = body.subjects.filter((s) => s.kind === 'command');
    expect(commands.length, 'the fixture must serve a real command roster').toBeGreaterThan(30);

    const overflows: string[] = [];
    let widest = { id: '', line: 0 };
    for (const subject of commands) {
      await choose(page, subject.kind, subject.id, subject.label);
      const measured = await page.evaluate((selector) => ({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        line: Math.max(0, ...[...document.querySelectorAll(`${selector} .excmd .m`)]
          .map((n) => Math.round(n.getBoundingClientRect().width))),
      }), PANE);
      if (measured.overflow > 0) {
        overflows.push(`${subject.id}: ${measured.overflow}px`);
      }
      if (measured.line > widest.line) widest = { id: subject.id, line: measured.line };
    }

    expect(widest.line,
      'no command drew a line wide enough for this to be a bound at all — the measurement is '
      + 'about a line that OVERFLOWS ITS OWN CONTAINER, and none did').toBeGreaterThan(600);
    expect(overflows,
      'these subjects made the PAGE wider than the window. A command line may be 2,300px long '
      + 'and scroll inside itself; the page it sits on may not grow with it. This shipped once '
      + `at 1,325px, found by looking at a picture. Widest line here: ${widest.id} at `
      + `${widest.line}px.`).toEqual([]);

    // Re-opened before the picture is taken: the walk above ends on whatever
    // command sorts last, and a screenshot named for the widest line has to be
    // a picture of it.
    const worst = commands.find((s) => s.id === widest.id);
    await choose(page, 'command', widest.id, worst!.label);
    await shoot(page, `widest-${widest.id}-${lang}`);
  });
}

/* ══ A COMMAND LINE OPENS AT ITS OWN NAME, IN BOTH DIRECTIONS ══════════════ */

/**
 * **`.excmd` is a scroll container, and a scroll container inherits the page's
 * direction.**
 *
 * Under `dir="rtl"` its origin is the RIGHT edge, so a Hebrew reader opened
 * `mycontext audit` and was shown the TAIL of the line with the command's own
 * name off-screen to the left. The repair was `line.dir = 'ltr'`, and this is
 * the measurement that would catch its removal: the FIRST glyph of the line —
 * `mycontext` — must be inside the container's own box, at its left edge, in
 * both languages.
 *
 * A computed `direction` is asserted too, because that is the property, but it
 * is the glyph position that is the reader's experience.
 */
for (const lang of ['en', 'he'] as const) {
  test(`a command line opens at the command's own name, not at its tail (${lang})`, async ({
    app,
  }) => {
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    // `audit` is the subject the defect was found on: eleven parameters, and a
    // composed line long enough to overflow its own container.
    const audit = body.subjects.find((s) => s.kind === 'command' && s.id === 'audit');
    expect(audit, 'the fixture serves no `audit` command — this measurement has no subject')
      .toBeTruthy();
    await choose(page, 'command', 'audit', audit!.label);

    const measured = await page.evaluate((selector) => {
      const lines = [...document.querySelectorAll<HTMLElement>(`${selector} .excmd`)];
      return lines.map((line) => {
        const style = getComputedStyle(line);
        const inner = line.querySelector('.m');
        const range = document.createRange();
        const text = inner?.firstChild;
        let firstGlyphX = Number.NaN;
        if (text !== null && text !== undefined) {
          range.setStart(text, 0);
          range.setEnd(text, Math.min(9, text.textContent?.length ?? 0));
          firstGlyphX = range.getBoundingClientRect().left;
        }
        const box = line.getBoundingClientRect();
        return {
          text: (inner?.textContent ?? '').slice(0, 40),
          direction: style.direction,
          overflowX: style.overflowX,
          scrollLeft: Math.round(line.scrollLeft),
          scrollWidth: Math.round(line.scrollWidth),
          clientWidth: Math.round(line.clientWidth),
          firstGlyphX: Math.round(firstGlyphX),
          boxLeft: Math.round(box.left),
          boxRight: Math.round(box.right),
        };
      });
    }, PANE);

    expect(measured.length, '`audit` drew no command line at all').toBeGreaterThan(0);
    const scrolling = measured.filter((line) => line.scrollWidth > line.clientWidth + 1);
    expect(scrolling.length,
      'no line on `audit` is wider than its own container, so the RTL scroll-origin defect has '
      + 'no subject here and this test is measuring nothing').toBeGreaterThan(0);

    for (const line of measured) {
      expect(line.direction, `"${line.text}" is a shell command and is left-to-right in both `
        + 'languages — the container is TOLD so rather than the layout being worked around')
        .toBe('ltr');
      expect(line.overflowX, `"${line.text}" must scroll rather than wrap: a command broken `
        + 'across lines mid-flag is a command a reader cannot copy').not.toBe('visible');
      expect(line.scrollLeft, `"${line.text}" did not open at its own start`).toBe(0);
      // The command's own name is INSIDE the container's box, at its reading
      // start. This is the assertion the `dir` attribute exists to satisfy, and
      // it is made about glyphs rather than about a property.
      expect(line.firstGlyphX,
        `the first word of "${line.text}" is laid out at ${line.firstGlyphX}, outside its own `
        + `container (${line.boxLeft}…${line.boxRight}). Under RTL the container opens at its `
        + 'RIGHT edge, which is how a Hebrew reader was shown the tail of the line and never '
        + 'its name.').toBeGreaterThanOrEqual(line.boxLeft - 1);
      expect(line.firstGlyphX).toBeLessThan(line.boxRight);
    }

    await shoot(page, `audit-line-${lang}`);
  });
}

/* ══ A TOPIC IS A RENDERED DOCUMENT, NOT A PASTE ═══════════════════════════ */

/**
 * The `##` defect, measured where it happened: on the page. Every topic the
 * card serves is opened, and each must draw real heading elements and must not
 * put a heading line on screen as prose.
 */
for (const lang of ['en', 'he'] as const) {
  test(`every help topic is drawn as a document, with headings (${lang})`, async ({ app }) => {
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const topics = body.subjects.filter((s) => s.kind === 'topic');
    expect(topics.length, 'the card serves no topics at all').toBeGreaterThan(0);

    const bad: string[] = [];
    for (const topic of topics) {
      await choose(page, topic.kind, topic.id, topic.label);
      // WAIT FOR THE BODY, do not assume `choose` left one.
      //
      // This was the assertion's own defect and it cost a morning. `choose`
      // returns when the picker has moved; the detail is fetched and rendered
      // after that, and `slash` is the largest topic served — 13,278 characters
      // against `workflow`'s 10,804. Every smaller topic won the race and
      // `slash` lost it, so the suite reported "no rendered body" for a body
      // the endpoint serves and `markdownNodes` renders into 24 nodes with
      // zero refusals. Both facts were measured before this line was written.
      //
      // It failed IDENTICALLY over the simulated corpus and over the live one,
      // which is what proves it is timing rather than data — a fixture gap
      // would have moved when the corpus did.
      // Wait on `.topicbody` SPECIFICALLY, which is what the measurement reads.
      // A first attempt waited on the pane and passed on the PREVIOUS topic's
      // headings while `.topicbody` was still absent — a wait that watches a
      // different element from the one under test is not a wait at all.
      await page.waitForFunction(
        (sel) => {
          const el = document.querySelector(`${sel} .topicbody`);
          return el !== null && el.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
        },
        PANE,
        { timeout: 15_000 },
      );
      const measured = await page.evaluate((selector) => {
        const body_ = document.querySelector(`${selector} .topicbody`);
        const blocks = [...(body_?.querySelectorAll('p, pre') ?? [])];
        return {
          present: body_ !== null,
          md: body_?.classList.contains('md') ?? false,
          headings: body_?.querySelectorAll('h1, h2, h3, h4, h5, h6').length ?? 0,
          printed: blocks
            .map((n) => (n.textContent ?? '').split('\n')[0]?.trim() ?? '')
            .filter((first) => /^#{1,6}\s/.test(first)),
          overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        };
      }, PANE);
      if (!measured.present) bad.push(`${topic.id}: no rendered body`);
      else if (!measured.md) bad.push(`${topic.id}: the body does not wear the console's .md class`);
      else if (measured.headings === 0) bad.push(`${topic.id}: not one heading element`);
      if (measured.printed.length > 0) {
        bad.push(`${topic.id}: drew the heading line ${JSON.stringify(measured.printed[0])} as prose`);
      }
      if (measured.overflow > 0) bad.push(`${topic.id}: ${measured.overflow}px of page overflow`);
    }
    expect(bad, 'a topic is being printed rather than rendered, or is widening the page. The '
      + 'first shipped once already — correct output of the wrong thing, which every render '
      + 'test passes').toEqual([]);

    await choose(page, 'topic', topics[0]!.id, topics[0]!.label);
    await shoot(page, `topic-${topics[0]!.id}-${lang}`);
  });
}

/* ══ THE THREE SHAPES A "WHAT IT TAKES" SECTION CAN HAVE ═══════════════════ */

/**
 * One subject of every kind, opened and photographed — and with it the two
 * MEASURED ABSENCES this card exists to keep apart: a command that takes no
 * switch at all, and the one shortcut that takes no argument. Both draw a
 * SENTENCE where a table would be, because "takes nothing" and "nobody wrote it
 * down" are different facts and a blank section says neither.
 */
for (const lang of ['en', 'he'] as const) {
  test(`every kind draws its own shape, and an absence is a sentence (${lang})`, async ({
    app,
  }) => {
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const find = (kind: string, id: string) =>
      body.subjects.find((s) => s.kind === kind && s.id === id);

    // A command with a flag table, and one with none at all.
    const flagged = body.subjects.find((s) => s.kind === 'command' && s.id === 'audit');
    await choose(page, 'command', flagged!.id, flagged!.label);
    await expect(page.locator(`${PANE} table.flagtable`).first()).toBeVisible();
    expect(await overflow(page)).toBe(0);

    const flagless = find('command', 'show');
    expect(flagless, 'the fixture serves no `show` — the flagless case has no subject').toBeTruthy();
    await choose(page, 'command', 'show', flagless!.label);
    await expect(page.locator(`${PANE} table.flagtable`)).toHaveCount(0);
    // The absence is a SENTENCE, and it is the card's own — read out of the
    // string table the page is using rather than typed here.
    await expect(page.locator(PANE)).toContainText(await say(page, 'clih.noflags'));

    // The one shortcut that genuinely takes no argument.
    const load = find('slash', 'LoadMyContext');
    if (load !== undefined) {
      await choose(page, 'slash', 'LoadMyContext', load.label);
      // The other measured absence: "Takes no argument." — a different fact
      // from "nobody wrote it down", and the only shortcut of the 91 for which
      // it is true.
      await expect(page.locator(PANE)).toContainText(await say(page, 'clih.slashnoargs'));
      expect(await overflow(page)).toBe(0);
      await shoot(page, `slash-noargs-${lang}`);
    }

    // A tool, with its schema's own argument table — and specifically the third
    // measured absence on this card: an argument whose SCHEMA declares no
    // description. 21 of the 109 argument rows are in that state, and they were
    // a blank cell under a column headed "what it does" until 2026-09-07. The
    // subject is found by asking the schemas rather than by naming one.
    const undeclared = await page.evaluate(async () => {
      const response = await fetch('/api/cli-help', { credentials: 'same-origin' });
      const roster = await response.json() as { subjects: { kind: string; id: string }[] };
      for (const row of roster.subjects.filter((s) => s.kind === 'tool')) {
        const one = await fetch(`/api/cli-help/tool/${row.id}`, { credentials: 'same-origin' });
        const detail = await one.json() as { args: { note: string }[] };
        if (detail.args.some((a) => a.note === '')) return row.id;
      }
      return null;
    });
    const tool = body.subjects.find((s) => s.kind === 'tool' && s.id === (undeclared ?? ''))
      ?? body.subjects.find((s) => s.kind === 'tool');
    await choose(page, tool!.kind, tool!.id, tool!.label);
    if (undeclared !== null) {
      // The absence is a SENTENCE, not a blank third cell.
      await expect(page.locator(`${PANE} table.flagtable`))
        .toContainText(await say(page, 'clih.argnodesc'));
      const blank = await page.evaluate((selector) => [...document
        .querySelectorAll(`${selector} table.flagtable tr`)]
        .map((tr) => [...tr.querySelectorAll('td')].at(-1))
        .filter((cell) => cell !== undefined && (cell.textContent ?? '').trim() === '').length,
      PANE);
      expect(blank, 'a tool argument drew an EMPTY "what it does" cell. A CLI flag in that '
        + 'state is refused outright; this column may not be a hole either').toBe(0);
    }
    expect(await overflow(page)).toBe(0);
    await shoot(page, `tool-${tool!.id}-${lang}`);
  });
}

/* ══ A CROSS-REFERENCE MOVES THE PICKER ════════════════════════════════════ */

/**
 * Following a link must move the SELECT, not paint the pane behind its back:
 * the picker is the address of this card, and a reader who arrived at
 * `mycontext review` through `/mycontext:discard` has to be able to see where
 * they are. Driven through a real click, in a real browser, in both languages —
 * a `button.crumb` inside RTL prose is also where a link's own hit area has
 * gone wrong before.
 */
for (const lang of ['en', 'he'] as const) {
  test(`following a shortcut's cross-reference moves the picker (${lang})`, async ({ app }) => {
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const discard = body.subjects.find((s) => s.kind === 'slash' && s.id === 'discard');
    expect(discard, 'the fixture ships no `/mycontext:discard`').toBeTruthy();
    await choose(page, 'slash', 'discard', discard!.label);

    const link = page.locator(`${PANE} button.crumb`).first();
    await expect(link).toBeVisible();
    const target = (await link.innerText()).trim();
    await link.click();

    await expect(page.locator(`${PANE} h3`)).toHaveText(target, { timeout: 15_000 });
    await expect(page.locator(PICK)).toHaveValue(/^command\//);
    expect(await overflow(page),
      'arriving at a command through a link must not widen the page either').toBe(0);
    await shoot(page, `crossref-${lang}`);
  });
}

/* ══ NO SENTENCE ON THIS CARD LOSES ITS OWN PUNCTUATION ════════════════════ */

/**
 * **`.precedence` rather than `precedence.` — the defect this file was written
 * to find, found.**
 *
 * Everything on this card that is not a string-table key is text this app did
 * not choose the language of: a flag's declaration, a tool's schema
 * description, a category's own sentence, a whole help topic. On the Hebrew
 * page all of it sits inside an RTL flow, and a trailing full stop after Latin
 * text is a NEUTRAL character — the bidi algorithm gives it the paragraph's
 * direction and lays it out at the other end of the line.
 *
 * MEASURED here on 2026-09-07, before `dir="auto"` was applied: on `mycontext
 * add` the period closing `--body`'s note landed 70px to the LEFT of the `e`
 * before it, on the same line, with nothing in between; 15 of 15 note cells on
 * that command, 16 of 16 on `audit`, and 41 runs on the `capture` topic alone.
 * Every other assertion in this file and in both node suites passed throughout.
 *
 * So the measurement is a RANGE over the last two characters of every text
 * node: if the final `.` `:` `!` or `?` is laid out on the same line as the
 * character before it and to the far side of it, that run has lost its
 * punctuation. It is made over EVERY subject, because this is a property of the
 * screen rather than of any one card, and in both languages, because a Hebrew
 * category description on the English page is the same failure mirrored.
 */
for (const lang of ['en', 'he'] as const) {
  test(`no sentence on this card loses its own punctuation (${lang})`, async ({ app }) => {
    test.setTimeout(300_000);
    const { page } = app;
    await openLibrary(page);
    if (lang === 'he') await switchToHebrew(page);

    const body = await index(page);
    const broken: string[] = [];
    let runs = 0;
    for (const subject of body.subjects) {
      await choose(page, subject.kind, subject.id, subject.label);
      const measured = await page.evaluate((selector) => {
        const found: string[] = [];
        let seen = 0;
        const pane = document.querySelector(selector);
        if (pane === null) return { found, seen };
        const walker = document.createTreeWalker(pane, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
          const text = node as Text;
          const raw = (text.textContent ?? '').replace(/\s+$/, '');
          // Long enough to be a sentence rather than a separator, and ending in
          // the punctuation that goes missing.
          if (raw.length < 13 || !/[.:!?]$/.test(raw)) continue;
          seen += 1;
          const end = document.createRange();
          end.setStart(text, raw.length - 1); end.setEnd(text, raw.length);
          const before = document.createRange();
          before.setStart(text, raw.length - 2); before.setEnd(text, raw.length - 1);
          const a = end.getBoundingClientRect();
          const b = before.getBoundingClientRect();
          // Same line, and the punctuation is not adjacent to the character it
          // follows — on either side, so this reads the same in both languages.
          if (Math.round(a.top) !== Math.round(b.top)) continue;
          const detached = a.right < b.left - 2 || a.left > b.right + 2;
          if (detached) found.push(`${raw.slice(-42)} (${Math.round(Math.abs(a.left - b.left))}px away)`);
        }
        return { found, seen };
      }, PANE);
      runs += measured.seen;
      for (const one of measured.found) broken.push(`${subject.kind}/${subject.id}: ${one}`);
    }

    expect(runs, 'no sentence long enough to measure was found on the whole card')
      .toBeGreaterThan(400);
    expect(broken.slice(0, 12),
      `${broken.length} of ${runs} sentences on this card render their closing punctuation `
      + 'detached from the word it follows. That is the ".Reading the spec first" defect — a '
      + 'run of text in a language the page did not choose, taking the paragraph direction '
      + 'instead of its own. The repair is `dir="auto"` on the run, which is what '
      + '`conversations.js` already does and says why.').toEqual([]);
  });
}
