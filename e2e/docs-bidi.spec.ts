/**
 * **A code span inside a bold run, measured as a RENDERED RUN** — originally
 * `plan:walk seq:94`, re-pointed on 2026-09-05.
 *
 * ── WHAT IT MEASURES, AND WHY A BROWSER HAS TO ────────────────────────────
 *
 * A markdown renderer that builds a code span as a real element rather than
 * pasting it as text is the difference between a path, a glob or a `--flag`
 * being laid out in reading order inside Hebrew prose and being laid out
 * backwards. `styles.css` reserves the isolation for exactly *"Direction
 * KNOWN ltr: identifiers, paths, globs, commands, flags"*.
 *
 * `test/ui/markdown-renderer.test.ts` and `test/ui/github-render.test.ts`
 * assert that the node exists and carries the right shape. That is a CLASS
 * NAME (or a tag) in a string, and a class name is not the guarantee — the
 * guarantee is three separate things, each of which has failed in this project
 * before: the element has to be built, the rule has to still apply to it, and
 * the glyphs have to actually come out in reading order. `e2e/bidi.spec.ts`
 * says so in its own header and censuses `.m` and `.v` per `data-t` for that
 * reason.
 *
 * This file is that measurement pointed at the runs that are built out of a
 * DOCUMENT rather than out of the string table, so no `data-t` census can
 * reach them. It measures the same two properties `bidi.spec.ts` measures:
 *
 *   1. the COMPUTED `unicode-bidi`/`direction` of each run, and
 *   2. the LAID-OUT order of its glyphs — the first character box strictly to
 *      the left of the last, inside a paragraph that runs the other way.
 *
 * The second is the one that cannot be faked by a stylesheet that parses: it
 * is what the reader's eye actually receives.
 *
 * ── WHY IT MOVED OFF THE DOCUMENTATION SCREEN ─────────────────────────────
 *
 * It drove `[data-p="docs"] #mdout` — the Documentation screen rendering one
 * `mycontext help` topic inside a console card. `DEC-the-documentation-and-
 * tutorials-screens-become-one-list-and` (owner ruling, 2026-09-05) retired
 * that screen and `screens/tut.js` with it: one console page lists every
 * document and tutorial by title, and reading one happens on `/doc.html`, in a
 * new tab, rendered the way GitHub renders it.
 *
 * So the measurement follows the runs. `docs/README.he.md` is a far better
 * subject than the help topic ever was: it is a real Hebrew document, 149
 * `<div dir="rtl">` wrappers and 3,200 code spans of it, and it is the file
 * `REQ-the-two-readmes-are-the-base-of-a-documentation-system-that` calls the
 * base of the documentation system. Where the old file measured two words in
 * one served topic, this one measures the document the product is about.
 *
 * ── AND THE BEFORE/AFTER, MEASURED RATHER THAN ASSERTED ───────────────────
 *
 * The last test builds two probes carrying the SAME payload: one as an
 * unisolated bare text node inside a bold run — what a renderer that pastes
 * rather than parses produces — and one as the `<code>` element this renderer
 * builds. The payload is a flag rather than an English word on purpose:
 * `required` is strongly left-to-right in every character, so the loss is
 * latent there, while `--filter` opens with neutrals that take the PARAGRAPH's
 * direction when nothing isolates them. The probes are removed again before
 * the test ends, so nothing they did survives into another assertion.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/**
 * The standalone document page, and the document it opens.
 *
 * A QUERY and not a fragment: on `/doc.html` the fragment belongs to the
 * DOCUMENT, so `#heading` lands on a heading exactly as it does on GitHub.
 */
const DOCUMENT = '/doc.html?doc=docs%2FREADME.he.md';

/** The rendered article. Scoped, because the page's own chrome — the
 *  breadcrumb, the disclosure — is not the document. */
const OUT = 'article.ghdoc';

/** One rendered run: how the browser resolved it, and where its glyphs landed. */
interface Run {
  readonly text: string;
  readonly combo: string;
  readonly firstX: number;
  readonly lastX: number;
  /**
   * How many line boxes the run occupies.
   *
   * Load-bearing, and it was learned by measuring: 15 of this document's 3,185
   * code runs WRAP — `/mycontext:list-open-question` is longer than what is
   * left of the line it starts on — and for a wrapped run the first character
   * sits at the end of one line and the last at the start of the next, so
   * their `left` values are not comparable and the run reads as reversed when
   * it is perfectly correct. Measured 2026-09-05 in Chromium: every one of the
   * 15 had `getClientRects().length === 2` and a `top` difference of one line
   * height. So the ORDER assertion below is made over single-line runs, and
   * the ISOLATION assertion — which does not depend on layout at all — is made
   * over every one of them.
   */
  readonly lines: number;
}

/**
 * Open the Hebrew README on its own page.
 *
 * `page.goto` on the SAME ORIGIN the app fixture already authenticated: the
 * `mycontext_token` cookie is `Path=/`, `HttpOnly`, `SameSite=Strict`, so it
 * rides a same-site navigation the user started and this page needs no nonce
 * of its own. That is the property the ruling depends on, and it is exercised
 * here rather than asserted.
 */
async function openDocument(page: Page): Promise<void> {
  await page.goto(new URL(DOCUMENT, page.url()).href);
  // The article is empty until the read answers, so the wait is for a run, not
  // for the element that will hold it.
  await expect(page.locator(`${OUT} code`).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator(OUT)).toHaveAttribute('dir', 'rtl');
}

/**
 * The code runs the renderer built, with the facts that matter about each.
 *
 * A `Range` over the text node rather than the element's own box: the element
 * box is a rectangle either way round, and what is being measured is where the
 * CHARACTERS went.
 */
function readRuns(page: Page, selector: string): Promise<Run[]> {
  return page.evaluate((sel) => {
    const boxes = (el: HTMLElement): { firstX: number; lastX: number } => {
      const text = el.firstChild;
      if (text === null || text.nodeType !== Node.TEXT_NODE) return { firstX: 0, lastX: 0 };
      const n = (text.textContent ?? '').length;
      const range = document.createRange();
      range.setStart(text, 0); range.setEnd(text, 1);
      const first = range.getBoundingClientRect().left;
      range.setStart(text, n - 1); range.setEnd(text, n);
      const last = range.getBoundingClientRect().left;
      return { firstX: first, lastX: last };
    };
    return [...document.querySelectorAll<HTMLElement>(sel)].map((el) => {
      const cs = getComputedStyle(el);
      return {
        text: el.textContent ?? '',
        combo: `${cs.unicodeBidi}/${cs.direction}`,
        lines: el.getClientRects().length,
        ...boxes(el),
      };
    });
  }, selector);
}

test('a code span inside a bold run is a real element, isolated and left to right', async ({ app }) => {
  const { page } = app;
  await openDocument(page);

  const runs = await readRuns(page, `${OUT} strong code`);
  expect(
    runs.length,
    'the Hebrew README writes code spans inside bold runs throughout; none reached the page '
    + 'as a code element, which is the defect this file exists for',
  ).toBeGreaterThan(0);
  // The backticks are consumed, exactly as they are anywhere a code span is
  // drawn. A run still carrying them was pasted as text, never parsed.
  for (const run of runs) {
    expect(run.text, 'a code span still carrying its backticks was never parsed').not.toContain('`');
  }
  expect([...new Set(runs.map((r) => r.combo))]).toEqual(['isolate/ltr']);
});

test('every code run in the RTL document stays isolated and in reading order', async ({ app }) => {
  const { page } = app;
  await openDocument(page);

  const runs = await readRuns(page, `${OUT} code`);
  expect(runs.length, 'the document renders thousands of code spans').toBeGreaterThan(100);

  // This is the direction that breaks, and it breaks silently.
  expect(
    [...new Set(runs.map((r) => r.combo))],
    'every code run must be isolated AND ltr inside RTL prose',
  ).toEqual(['isolate/ltr']);

  // The characters actually came out in reading order. "isolate resolving
  // correctly" and "the glyphs landing correctly" are two different claims.
  const measurable = runs.filter((r) => r.text.length > 1 && r.lines === 1);
  expect(
    measurable.length,
    'every code run in this document wrapped, so the order assertion below measured nothing',
  ).toBeGreaterThan(100);
  const reversed = measurable.filter((r) => r.firstX >= r.lastX).map((r) => r.text);
  expect(
    reversed.slice(0, 10),
    'these runs rendered with their first character to the right of their last — they are '
    + 'being laid out in the paragraph direction instead of their own',
  ).toEqual([]);
});

test('the run an unisolated renderer produces is laid out backwards; this one is not', async ({ app }) => {
  const { page } = app;
  await openDocument(page);

  await page.evaluate(() => {
    const out = document.querySelector('article.ghdoc')!;
    const line = document.createElement('p');
    line.id = 'bidi-probe';
    const was = document.createElement('strong');
    was.id = 'probe-was';
    was.append(document.createTextNode('--filter=a'));
    const now = document.createElement('strong');
    now.id = 'probe-now';
    const run = document.createElement('code');
    run.append(document.createTextNode('--filter=a'));
    now.append(run);
    line.append(was, ' ', now);
    out.append(line);
  });

  const [was] = await readRuns(page, '#probe-was');
  const [now] = await readRuns(page, '#probe-now code');
  expect(was, 'the probe for the unisolated run was not built').toBeDefined();
  expect(now, 'the probe for this renderer was not built').toBeDefined();

  expect(
    was!.firstX,
    'the unisolated run must be the DEFECT — if this is already in reading order the '
    + 'probe is measuring nothing and the comparison below is vacuous',
  ).toBeGreaterThan(was!.lastX);
  expect(
    now!.firstX,
    'the same payload inside a code element must read left to right — this is the whole of '
    + 'what a Hebrew reader gained',
  ).toBeLessThan(now!.lastX);

  await page.evaluate(() => { document.getElementById('bidi-probe')?.remove(); });
});
