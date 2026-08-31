/**
 * **A code span inside a bold run, measured as a RENDERED RUN** — `plan:walk
 * seq:94`.
 *
 * ── WHAT WAS WRONG ────────────────────────────────────────────────────────
 *
 * `screens/docs.js`' inline alternation puts code first so that a link or a
 * bold run written INSIDE backticks is not re-parsed. That is a TIE-BREAK, and
 * a regex still takes the leftmost match — so `**`x`**` went to the bold
 * branch, which set `textContent`, and the payload kept its backticks as
 * literal text and lost `.m`. With `.m` went `unicode-bidi:isolate`, which is
 * what keeps a path, a glob or a `--flag` from being laid out backwards inside
 * RTL prose. `styles.css` reserves `.m` for exactly *"Direction KNOWN ltr:
 * identifiers, paths, globs, commands, flags"*.
 *
 * It is not hypothetical and it is not off in a corner: the served `scope`
 * topic writes that shape TWICE, in the bullet list under *"When an empty scope
 * means something else"*, so both occurrences were on screen the first time
 * anyone opened Documentation. `plan:walk seq:37` then pointed
 * `screens/preview.js`' `bodyNodes()` at the same renderer, so every item body
 * writing a flag inside a bold run had the same loss.
 *
 * ── WHY IT IS MEASURED HERE AND NOT ONLY IN NODE ──────────────────────────
 *
 * `test/ui/docs-screen.test.ts` asserts that the node carries `.m`. That is a
 * CLASS NAME in a string, and a class name is not the guarantee — the
 * guarantee is three separate things, each of which has failed in this project
 * before: the class has to be on the element, the element has to survive the
 * language switch, and the rule has to still apply. `e2e/bidi.spec.ts` says so
 * in its own header and censuses `.m` and `.v` per `data-t` for that reason.
 *
 * This file is that measurement pointed at the ONE renderer whose runs are
 * built out of a document rather than out of the string table, so no `data-t`
 * census can reach them. It measures the same two properties `bidi.spec.ts`
 * measures, on the app rather than on the mockup:
 *
 *   1. the COMPUTED `unicode-bidi`/`direction` of each run, and
 *   2. the LAID-OUT order of its glyphs — the first character box strictly to
 *      the left of the last, inside a paragraph that runs the other way.
 *
 * The second is the one that cannot be faked by a stylesheet that parses: it
 * is what the reader's eye actually receives.
 *
 * ── AND THE BEFORE/AFTER, MEASURED RATHER THAN ASSERTED ───────────────────
 *
 * The last test builds the OLD renderer's output — the same text as a bare
 * text node inside the bold run, with no `.m` — beside the new one, in the same
 * container, in Hebrew, and measures both. That is the honest way to state what
 * a Hebrew reader gained: not "the backticks are gone" (they are, and that is
 * cosmetic) but that a payload beginning with a neutral character is laid out
 * in reading order instead of in the paragraph's. The probe is removed again
 * before the test ends, so nothing it did survives into another assertion.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { settleScreen } from './settle.ts';

/**
 * Every query is scoped to `[data-p="docs"]`, because the router keeps every
 * visited screen inside `#screen` and merely HIDES it — an unscoped `.m` would
 * count runs on screens nobody is looking at.
 */
const SCREEN = '[data-p="docs"]';
const OUT = `${SCREEN} #mdout`;

/** One rendered run: how the browser resolved it, and where its glyphs landed. */
interface Run {
  readonly text: string;
  readonly combo: string;
  readonly firstX: number;
  readonly lastX: number;
}

async function openDocs(page: Page): Promise<void> {
  await page.evaluate(() => { location.hash = '#/docs'; });
  // `requires` because the runs under test arrive with the `/api/help/scope`
  // fetch: a settled node count and no runs at all is the state this screen
  // holds for as long as that read is open.
  const settled = await settleScreen(page, 'docs', { requires: '#mdout b' });
  expect(
    settled.settled,
    `Documentation never settled — ${settled.count} nodes, ${settled.inFlight} reads still open. `
    + 'Failing as itself rather than reporting a slow machine as a missing element.',
  ).toBe(true);
}

/**
 * The `.m` runs the markdown renderer built INSIDE a bold run, with the two
 * facts that matter about each.
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
        ...boxes(el),
      };
    });
  }, selector);
}

test('a code span inside a bold run renders as an isolated monospace run, in English', async ({ app }) => {
  const { page } = app;
  await openDocs(page);

  const runs = await readRuns(page, `${OUT} b .m`);
  const texts = runs.map((r) => r.text);
  // The two the served topic writes. Named rather than counted, so a topic that
  // grows a third does not fail this and a topic that loses these does.
  expect(
    texts,
    'the served scope topic writes `required` and `inert` inside bold runs; neither reached '
    + 'the page as a monospace run, which is the defect this file exists for',
  ).toEqual(expect.arrayContaining(['required', 'inert']));
  // And the backticks are consumed, exactly as they are anywhere else a code
  // span is drawn. A run still carrying them is the old paste-as-text branch.
  for (const run of runs) {
    expect(run.text, 'a code span still carrying its backticks was never parsed').not.toContain('`');
  }
  expect([...new Set(runs.map((r) => r.combo))]).toEqual(['isolate/ltr']);
});

test('and it stays isolated and in reading order inside Hebrew prose', async ({ app }) => {
  const { page } = app;
  await openDocs(page);
  const english = await readRuns(page, `${OUT} b .m`);

  // `#lang` writes the preference and RELOADS, and the reload lands on the
  // default screen — the nonce fragment died on the first load. So the screen
  // is re-opened rather than assumed to survive.
  await page.click('#lang');
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await openDocs(page);

  const hebrew = await readRuns(page, `${OUT} b .m`);

  // The count assertion `bidi.spec.ts` makes per `data-t`, made here per
  // renderer: a run lost on the switch is an identifier laid out backwards, and
  // nothing in the file says so. Both directions — a run GAINED is as wrong.
  expect(
    hebrew.map((r) => r.text),
    'Hebrew must draw the same monospace runs English does',
  ).toEqual(english.map((r) => r.text));
  expect(
    [...new Set(hebrew.map((r) => r.combo))],
    'every run must stay isolated AND ltr inside RTL prose — this is the direction that '
    + 'breaks, and it breaks silently',
  ).toEqual(['isolate/ltr']);

  // The characters actually came out in reading order. "isolate resolving
  // correctly" and "the glyphs landing correctly" are two different claims.
  const reversed = hebrew.filter((r) => r.text.length > 1 && r.firstX >= r.lastX).map((r) => r.text);
  expect(
    reversed,
    'these runs rendered with their first character to the right of their last — they are '
    + 'being laid out in the paragraph direction instead of their own',
  ).toEqual([]);
});

/**
 * **What the fix bought a Hebrew reader, measured against what it replaced.**
 *
 * Two probes are appended to the rendered document, in Hebrew, carrying the
 * SAME payload: one as the old branch produced it — a bare text node inside the
 * `<b>` — and one as the new branch produces it, a `span.m`. The payload is a
 * flag rather than one of the topic's own two words on purpose: `required` is
 * strongly left-to-right in every character, so the loss is latent there, while
 * `--filter` opens with neutrals that take the PARAGRAPH's direction when
 * nothing isolates them. That is the shape `styles.css` reserves `.m` for, and
 * it is all over the item corpus this renderer now also serves.
 */
test('the run the old branch produced is laid out backwards; the one this branch produces is not', async ({ app }) => {
  const { page } = app;
  await page.click('#lang');
  await expect(page.locator('.nav').first()).toBeVisible({ timeout: 20_000 });
  await openDocs(page);

  await page.evaluate(() => {
    const out = document.querySelector('[data-p="docs"] #mdout')!;
    const line = document.createElement('p');
    line.id = 'bidi-probe';
    const was = document.createElement('b');
    was.id = 'probe-was';
    was.append(document.createTextNode('--filter=a'));
    const now = document.createElement('b');
    now.id = 'probe-now';
    const run = document.createElement('span');
    run.className = 'm';
    run.append(document.createTextNode('--filter=a'));
    now.append(run);
    line.append(was, ' ', now);
    out.append(line);
  });

  const [was] = await readRuns(page, '#probe-was');
  const [now] = await readRuns(page, '#probe-now .m');
  expect(was, 'the probe for the old branch was not built').toBeDefined();
  expect(now, 'the probe for this branch was not built').toBeDefined();

  expect(
    was!.firstX,
    'the unisolated run must be the DEFECT — if this is already in reading order the '
    + 'probe is measuring nothing and the comparison below is vacuous',
  ).toBeGreaterThan(was!.lastX);
  expect(
    now!.firstX,
    'the same payload inside `.m` must read left to right — this is the whole of what a '
    + 'Hebrew reader gained',
  ).toBeLessThan(now!.lastX);

  await page.evaluate(() => { document.getElementById('bidi-probe')?.remove(); });
});
