// @basis TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code,
// TASK-inline-code-has-no-hue-and-a-table-frame-is-drawn-at-1-71-1,
// TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a,
// DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
/**
 * **The hue on inline code, and the frame a reader can actually see.**
 *
 * `TASK-inline-code-has-no-hue-and-a-table-frame-is-drawn-at-1-71-1`, owner
 * 2026-09-09, looking at what `plan:archive seq:26` shipped: *"about color,
 * currentlly many missing almost none so it is not good enough"*, then *"the
 * tables frames are also almost not seen to dark, in general refactor it and
 * make it at least as the terminal TUI does, many words are highlited by color
 * (think it is lite purple or blue), code has different colors"*.
 *
 * ── WHY A SECOND FILE BESIDE `code-colour.spec.ts` ────────────────────────
 *
 * That file proves the FENCE half of `seq:26` — 25 tagged blocks, nine hues,
 * six tokenisers — and its fixture is three dense prose turns with no table in
 * them, because a table was not what that item was about. This one is about
 * the two things the owner then said were still wrong, and both need markup
 * that fixture does not carry: a real markdown TABLE, and inline code sitting
 * in prose that also holds a link, a rule and a bold run. Its turns are left
 * untouched rather than extended, so a failure here names this lane's change.
 *
 * ── THE MEASUREMENTS THIS FILE HOLDS TO ───────────────────────────────────
 *
 * Against `--paper` #0f0f12, and against `--sink` #101014, which is what a
 * table in this well actually sits on (the cells declare no background):
 *
 *     --edge     #3a3a45   1.71:1 / 1.69:1   WAS the table frame — half of 3.0
 *     --edge-3   #6e6e7e   3.82:1 / 3.79:1   the fence box, the rule, .tvterm
 *     #c9c6d4    --tvframe 11.40 / 11.31:1   IS the table frame
 *     #c678dd    violet    6.50:1 / 6.45:1   IS inline code
 *     #61afef    blue      8.10:1 / 8.03:1   the other candidate, and rejected
 *     #98c379    --tvfence 9.49:1 / 9.42:1   IS an untagged fence's text
 *     #e5c07b    yellow   11.08 / 10.99:1    the other candidate, and rejected
 *
 * ── AND WHAT THIS FILE GAINED ON 2026-09-09 ───────────────────────────────
 *
 * `TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code`, the
 * owner having accepted the hue (*"in general it looks better"*) and the fenced
 * syntax colouring (*"they looks good"*) and asked for two more things: the
 * table frame BRIGHTER (*"not white but near it"*), and a colour on code that
 * declared no language (*"at least different bright than white like green or
 * yello kind of as it is on the TUI"*).
 *
 * Both land inside this file rather than a new one because its fixture is
 * already the surface both were judged on — his own table turn, and an untagged
 * progress-bar fence in the probes turn. A third turn is added below carrying
 * the ledgers the tint has to be judged on, and the frame assertion below moves
 * from #6e6e7e to #c9c6d4 with the rule it pins.
 *
 * **The blue lost on separation, not on contrast.** `--carry` #8b9ce6 is spent
 * three times in this same well — `.tvtools`, `.tvarg`, `.tvresult` — and
 * measures ΔE76 17.9 from #61afef against 34.8 from #c678dd, where ~10 is the
 * floor at which two colours stop being reliably told apart. `styles.css`'s own
 * comment beside `.tvsaid .m` carries the full argument; this file measures the
 * pixels that argument predicts.
 *
 * ── AND IN BOTH LANGUAGES, BECAUSE THAT IS WHERE THE DEFECTS HAVE BEEN ────
 *
 * Adding `color` to a span cannot change a bidi run — a span at the default
 * `unicode-bidi: normal` is transparent to the algorithm and `.m` is already an
 * isolated LTR island from the global `.m,code,kbd,pre` rule. That is a claim
 * about CSS, and this project has twice found the opposite of such a claim in a
 * picture: a leading dot at the wrong end, and a Hebrew timestamp reordered to
 * "09:00 2026-09-08". So it is measured rather than reasoned about.
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

/**
 * **A real turn of the owner's own, verbatim except for a trim.**
 *
 * Taken from his session on 2026-09-09T04:00:12.177Z — the D37 status answer.
 * It is one of 243 assistant text blocks in that transcript carrying a markdown
 * table, and it holds 65 inline code spans, which makes it exactly the surface
 * the verdict was passed on: dense code spans reading as prose, over a table
 * whose ruling could not be seen.
 *
 * The trim is the SECOND of its two tables and eight of that table's rows, so
 * the fixture fits a 720px viewport and photographs in one frame. Nothing is
 * reworded, and no construct is added — the sentences, the pipes, the bold runs
 * and the backticks are his own file's bytes.
 */
const REAL_TURN = [
  '## The grand D table',
  '',
  '| D | subject | items | state |',
  '|---|---|---|---|',
  '| D6 | the citation gate | `rulings/64` | ✅ |',
  '| D8 | Hebrew RTL convention | `docsys/12` | ✅ |',
  '| D16 | the dependency budget | `governance/5` | ✅ |',
  '| D20 D21 D22 | id opens the pane · card names the command · Run removed'
  + ' | `builder/13,14,15` | ✅ |',
  '| D27 D28 | help tested for truth · both READMEs | `library/6` · `docsys/11` | 🟡 1 open each |',
  '| D29 D30 | code citing a retired item · suite off the demo corpus'
  + ' | `governance/6` · `port/100` | 🟡 |',
  '| D33 | the contradiction gate | `contra/1–3` | 🟡 1 of 3 |',
  '| **D37** | **the conversation archive** | `archive/1–39` | **🟡 27 / 39** |',
  '',
  '**Corpus-wide: 434 done, 68 open** across 26 plans. The biggest open blocks after D37 are'
  + ' `rulings` (11), `port` (6), `builder` (5), `docsys` (5) and **`loop` (5 — all of D36b–e,'
  + ' the self-improvement loop, entirely unbuilt).**',
].join('\n');

/**
 * The three constructs the real turn above does not happen to contain, kept in
 * their own turn and marked as constructed rather than mixed into his words:
 * a link whose label IS inline code, a thematic break, and a bold run.
 *
 * The link matters beyond tidiness. `.tvsaid .m` is (0,2,0) and `.tvsaid a` is
 * (0,1,1), so the code tint would out-specify the link's `--gold` — a
 * decoration repainting a BUDGETED MEANING HUE, which is the one thing the
 * palette discipline in `styles.css` exists to stop.
 */
const PROBES = [
  'A link whose label is code: [`src/ui/public/styles.css`](https://example.com/styles) —',
  'and **a bold run** beside `--edge-3`, the token the frame now spends.',
  '',
  '---',
  '',
  'Below the rule, one more span: `mycontext ready --plan archive`.',
  '',
  '```',
  'done     406  ████████████████░░░░  80%',
  '```',
].join('\n');

/**
 * **The turn the TINT has to be judged on, and it is deliberately not code.**
 *
 * The item is explicit that the honest test of a uniform tint is a LEDGER
 * rather than a source listing, because that is what most untagged fences in
 * this corpus are: of the 167 untagged blocks on the owner's own transcript, at
 * most 19 are code at all — the rest are command output, aligned ledgers,
 * timelines and counts tables. If a green counts table reads as source, the
 * tint is wrong, and the picture rather than this comment is what says so.
 *
 * So the four fences here are the four cases, in one frame:
 *
 *   1. A counts table — `lib/highlight.js`' own re-measurement, verbatim.
 *   2. A progress-bar block, the shape `mycontext ready` prints.
 *   3. One of the ~19 untagged blocks that really IS code.
 *   4. A ```` ```bash ```` fence that DECLARED itself, so the flat tint and the
 *      nine-hue palette are photographed side by side and "one flat colour
 *      against several" can be checked by eye rather than asserted.
 */
const LEDGERS = [
  'The counts, as `lib/highlight.js` re-measured them:',
  '',
  '```',
  '                                  this file        the item table',
  '    assistant text blocks           2,108               2,060',
  '    inline code spans              10,249              10,047',
  '    FENCED BLOCKS                     185                 370',
  '    with a language tag                25                  25',
  '    with NO language tag              160  (86.5%)        345',
  '```',
  '',
  'and the plan, the way `mycontext ready` prints it:',
  '',
  '```',
  'done     406  ████████████████░░░░  80%',
  'open      68  ███░░░░░░░░░░░░░░░░░  13%',
  'held      36  █░░░░░░░░░░░░░░░░░░░   7%',
  '```',
  '',
  'One of the ~19 untagged blocks that really is code:',
  '',
  '```',
  'node src/cli/index.ts show TASK-the-table-frames-want-to-be-near-white',
  '```',
  '',
  'And one that said what it was, for comparison:',
  '',
  '```bash',
  '# 25 of 192 fences declared a language',
  "export MYCTX_LANG='he'",
  'npx playwright test --config e2e/playwright.config.ts code-hue',
  'echo $HOME',
  '```',
].join('\n');

/** A slash command, which the doc builder marks synthetic and draws as `.tvterm`. */
const SYNTHETIC = '<command-name>/graphify</command-name>\n<command-args>archive</command-args>';

const PROMPT = 'where is the archive plan';

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 9, 4, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'A table, and the words in it' });
  const said = [REAL_TURN, PROBES, LEDGERS];
  for (let i = 0; i < said.length; i += 1) {
    rows.push({
      type: 'user',
      message: { role: 'user', content: i === 0 ? PROMPT : `round ${i}` },
      timestamp: at(i * 4),
      gitBranch: 'master',
    });
    rows.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: said[i] }] },
      timestamp: at(i * 4 + 1),
    });
  }
  rows.push({
    type: 'user',
    message: { role: 'user', content: SYNTHETIC },
    timestamp: at(20),
    gitBranch: 'master',
  });
  return rows;
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-hue-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-hue-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'sess-hue.jsonl'),
    `${session().map((r) => JSON.stringify(r)).join('\n')}\n`,
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

/**
 * The code-skew banner, dismissed the way a person would — the reasoning is
 * `e2e/code-colour.spec.ts`' verbatim and is not re-derived here: a sibling
 * lane saving one of the files `src/ui/server.ts` transitively reaches makes
 * every `/api` answer carry `staleCode: true`, and the resulting fixed banner
 * physically intercepts the row click below. The button is reached by POSITION,
 * because this spec runs in both languages and the label is a string-table key.
 */
async function dismissSkew(page: Page): Promise<void> {
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.locator('button').first().click().catch(() => {});
  }
}

/** The archive, open on the one session, in one language, in one page load. */
async function openDocument(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await dismissSkew(page);
  await page.evaluate(() => { location.hash = '#/conversations'; });
  await page.waitForSelector('.convrow', { timeout: 20_000 });
  await dismissSkew(page);
  await page.locator('.convrow').first().click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  // **Top, and it is not decoration.** A session OPENS AT ITS END and re-pins
  // the well to the tail on every paint until `stickUntil` expires, so a scroll
  // performed inside that window is undone and every screenshot taken in it is
  // a byte-identical tail image with all assertions green. Pressing Top clears
  // `stickUntil`, which is the handler's own first statement.
  await page.locator('button.tvtop').click();
  await expect(page.locator('.tvscroll')).toContainText('The grand D table', { timeout: 20_000 });
}

/**
 * The turn whose words contain `phrase`, brought into the well and returned.
 *
 * `scrollIntoViewIfNeeded` cannot be used: `.tvrow` is `position:absolute`
 * inside a virtualised scroller, so asking the browser to scroll a row into
 * view fires the scroll handler, which rebuilds the window and DETACHES the
 * node being scrolled to. The well is driven by `scrollTop` instead, and the
 * row is then parked by its own `offsetTop` — the offset the viewer itself
 * wrote, so nothing has a second opinion about where a row is.
 */
async function said(page: Page, phrase: string) {
  const well = page.locator('.tvscroll');
  const settle = (): Promise<unknown> => well.evaluate(() => new Promise(
    (done) => { requestAnimationFrame(() => requestAnimationFrame(() => done(null))); }));
  const { height, step } = await well.evaluate((el) => ({
    height: el.scrollHeight, step: Math.max(el.clientHeight / 2, 80),
  }));
  for (let top = 0; top <= height + step; top += step) {
    await well.evaluate((el, t) => { el.scrollTop = t as number; }, top);
    await settle();
    if (await page.locator('.tvsaid', { hasText: phrase }).count() === 0) continue;
    const rowTop = await page.locator('.tvsaid', { hasText: phrase }).first()
      .evaluate((el) => {
        const row = el.closest('.tvrow');
        return row === null ? null : (row as HTMLElement).offsetTop;
      });
    if (rowTop !== null) {
      await well.evaluate((el, t) => { el.scrollTop = t as number; }, rowTop);
      await settle();
    }
    const body = page.locator('.tvsaid', { hasText: phrase }).first();
    await body.waitFor({ state: 'attached', timeout: 10_000 });
    return body;
  }
  throw new Error(`no turn holding ${JSON.stringify(phrase)} could be brought into the well`);
}

/**
 * The WELL, photographed — never the turn, and never `fullPage`.
 *
 * `page.screenshot({fullPage:true})` RESIZES the viewport, which re-renders the
 * document and rebuilds the virtual window; an element screenshot of a `.tvrow`
 * asks the browser to scroll it into view first, which is the same fight `said`
 * documents. The well is a fixed box that does not move, and `said` has already
 * parked the turn at the top of it.
 */
async function shot(page: Page, phrase: string, file: string, extra = 0): Promise<void> {
  await said(page, phrase);
  if (extra !== 0) {
    await page.locator('.tvscroll').evaluate((el, n) => { el.scrollTop += n as number; }, extra);
    await page.locator('.tvscroll').evaluate(() => new Promise(
      (done) => { requestAnimationFrame(() => requestAnimationFrame(() => done(null))); }));
  }
  await page.locator('.tvscroll').screenshot({ path: `e2e/screens/${file}.png` });
}

/**
 * The visible box of a locator INSIDE the well, as a screenshot clip.
 *
 * `boundingBox()` alone is not that. The well is a fixed-height scroller and a
 * table parked at its top can be taller than it, so the element's own box runs
 * on past the well's bottom edge — and a clip taken from it photographs the
 * app's own card chrome beneath. That is not hypothetical: it put 38 rows of
 * `--panel` #17171c, `--panel-2` #1d1d24 and `--rule` #262630 into a crop that
 * was supposed to hold a table, which is exactly the class of defect this
 * file's other traps are about — an assertion measuring the wrong pixels.
 */
async function wellClip(page: Page, target: ReturnType<Page['locator']>): Promise<{
  x: number; y: number; width: number; height: number;
}> {
  const inner = await target.boundingBox();
  const well = await page.locator('.tvscroll').boundingBox();
  if (inner === null || well === null) throw new Error('nothing to clip');
  const top = Math.max(inner.y, well.y);
  const bottom = Math.min(inner.y + inner.height, well.y + well.height);
  const start = Math.max(inner.x, well.x);
  const end = Math.min(inner.x + inner.width, well.x + well.width);
  if (bottom - top < 40 || end - start < 40) throw new Error('the clip is not on screen');
  return { x: start, y: top, width: end - start, height: bottom - top };
}

/** `#rrggbb` as the browser reports it. */
const rgb = (hex: string): string => {
  const n = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return `rgb(${n[0]}, ${n[1]}, ${n[2]})`;
};

/**
 * WCAG 2.x relative-luminance contrast between two `rgb(r, g, b)` strings, so
 * the ratio this lane claims is computed from what the browser actually
 * PAINTED rather than from the hex a rule was written with. A token repointed
 * elsewhere, or a rule that never applied, changes this number.
 */
function ratio(a: string, b: string): number {
  const lum = (css: string): number => {
    const parts = css.match(/\d+(?:\.\d+)?/g);
    if (parts === null || parts.length < 3) throw new Error(`not a colour: ${css}`);
    const c = parts.slice(0, 3).map((p) => {
      const v = Number(p) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/* ══ THE HUE, WHICH IS 10,249 SPANS AGAINST 25 TAGGED FENCES ═══════════════ */

for (const lang of ['en', 'he'] as const) {
  test(`inline code carries the violet, on a real turn of his own (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'The grand D table');

    const spans = body.locator('span.m');
    // Fourteen in the trimmed turn; asserted as a shape, because the excerpt
    // could be re-trimmed and the claim is about colour, not about a count.
    expect(await spans.count()).toBeGreaterThan(10);

    const paint = await spans.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { colour: s.color, background: s.backgroundColor, family: s.fontFamily };
    });
    // #c678dd — the terminal's own keyword violet, already declared on
    // `.tvterm .tva-fm` and on `--tvh-keyword`. Nothing new entered the product.
    expect(paint.colour).toBe(rgb('#c678dd'));
    // The box `seq:26` shipped is KEPT: the hue is added beside it, not
    // instead of it, so a span still reads as a literal with colour off.
    expect(paint.background).toBe(rgb('#0f0f12'));
    expect(paint.family).toContain('Geist Mono');

    // 6.50:1 against the box's own ground — measured from the paint, not from
    // the stylesheet. Well clear of 4.5:1 for body text at `--fs-1` × .87.
    expect(ratio(paint.colour, paint.background)).toBeGreaterThan(4.5);

    // AND THE HUE IS NOT THE PROSE COLOUR, which is the whole complaint:
    // "almost none" was true because a span differed from its sentence in
    // typeface alone once the 1.71:1 box is discounted.
    const prose = await body.evaluate((el) => getComputedStyle(el).color);
    expect(prose).toBe(rgb('#f0eef6'));
    expect(paint.colour).not.toBe(prose);

    await shot(page, 'The grand D table', `hue-real-table-turn-${lang}`);
  });

  /* ══ THE FRAME, AT 11.31:1 INSTEAD OF 1.69:1 ═════════════════════════════ */

  test(`a table's ruling clears the 3:1 a reader needs (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'The grand D table');

    const cells = body.locator('td');
    expect(await cells.count()).toBeGreaterThan(20);

    const drawn = await cells.first().evaluate((el) => {
      // The GROUND a cell sits on: the cell declares no background of its own,
      // so the colour a reader sees behind the ruling is the first painted
      // ancestor's — the well's `--sink`. Walked rather than assumed.
      let node: HTMLElement | null = el as HTMLElement;
      let ground = 'rgba(0, 0, 0, 0)';
      while (node !== null) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') { ground = bg; break; }
        node = node.parentElement;
      }
      return { border: getComputedStyle(el).borderTopColor, width: getComputedStyle(el).borderTopWidth, ground };
    });

    expect(drawn.width).toBe('1px');
    // `--tvframe` #c9c6d4, at HIS number. `seq:38` moved this from `--edge`
    // #3a3a45 (1.69:1) to `--edge-3` #6e6e7e (3.79:1); he looked at that and
    // said *"brighter than the current color not white but near it"*, which is
    // the 11:1 end of the ramp and not the 3:1 end.
    expect(drawn.border).toBe(rgb('#c9c6d4'));
    expect(drawn.ground).toBe(rgb('#101014'));
    // WCAG 1.4.11: a non-text boundary a reader must see owes 3.0:1. The
    // original token paid 1.69. Asserted as a NUMBER so a future repoint of
    // either token fails here rather than in the owner's eyes.
    const got = ratio(drawn.border, drawn.ground);
    expect(got, `table ruling measures ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    expect(got, `table ruling measures ${got.toFixed(2)}:1`).toBeGreaterThan(11);
    expect(ratio(rgb('#3a3a45'), drawn.ground)).toBeLessThan(2);
    // AND IT IS STILL NOT WHITE, which is half of what he asked for and the
    // half a number can check. `--ink` #f0eef6 is the prose at 16.51:1; the
    // frame stops five points short of it, so the grid is never brighter than
    // the words it rules.
    const prose = await body.evaluate((el) => getComputedStyle(el).color);
    expect(prose).toBe(rgb('#f0eef6'));
    expect(drawn.border).not.toBe(prose);
    expect(got).toBeLessThan(ratio(prose, drawn.ground));
  });

  /* ══ THE TINT ON A FENCE THAT DECLARED NOTHING ═══════════════════════════ */

  test(`an untagged fence is tinted, and it is one flat colour (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'The counts, as');

    // Four fences in this turn: three that declared nothing, one that said
    // `bash`. The split is the whole design, so it is asserted rather than
    // assumed — a renderer change that started emitting `data-lang` for every
    // fence would otherwise turn this test green over the wrong pixels.
    const flat = body.locator('pre:not([data-lang])');
    const tagged = body.locator('pre[data-lang]');
    expect(await flat.count()).toBe(3);
    expect(await tagged.count()).toBe(1);

    const painted = await flat.evaluateAll(
      (els) => els.map((el) => {
        const s = getComputedStyle(el as HTMLElement);
        return { colour: s.color, background: s.backgroundColor, family: s.fontFamily };
      }));
    for (const p of painted) {
      // #98c379 — the terminal's own green, already declared on `.tva-fg` and
      // on `--tvh-string`. Nothing new entered the product.
      expect(p.colour).toBe(rgb('#98c379'));
      // The box `seq:26` shipped is KEPT beneath the tint.
      expect(p.background).toBe(rgb('#0f0f12'));
      expect(p.family).toContain('Geist Mono');
      // 9.49:1 on the fence's own fill — clear of 4.5:1 for body text.
      expect(ratio(p.colour, p.background)).toBeGreaterThan(4.5);
    }

    // ONE COLOUR, NOT NINE. A tinted block holds no token spans at all, so it
    // cannot be making a claim about any token in it — which is the entire
    // reason this is not syntax colouring and cannot lie the way a guess would.
    expect(await flat.locator('span').count()).toBe(0);
    const shades = new Set(painted.map((p) => p.colour));
    expect(shades.size).toBe(1);

    // AND IT DOES NOT READ AS TAGGED. The tagged fence is LABELLED and carries
    // several hues; the flat ones carry no label and one hue. Both halves of
    // that distinction are checked, because either alone would be weaker than
    // what `seq:26` deliberately paired.
    const label = await tagged.first().evaluate(
      (el) => getComputedStyle(el, '::before').content);
    expect(label).toContain('bash');
    const taggedHues = await tagged.first().evaluateAll(
      (els) => [...(els[0] as HTMLElement).querySelectorAll('span')]
        .map((n) => getComputedStyle(n).color));
    expect(taggedHues.length).toBeGreaterThan(2);
    expect(new Set(taggedHues).size).toBeGreaterThan(1);
    const flatLabel = await flat.first().evaluate(
      (el) => getComputedStyle(el, '::before').content);
    expect(flatLabel).toBe('none');
  });

  test(`the tint reaches no prose, no cell and no tagged fence (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'The counts, as');

    // The prose around the fences is untouched: the tint is a property on
    // `.tvsaid` read by ONE selector, not an inherited colour.
    const prose = await body.evaluate((el) => getComputedStyle(el).color);
    expect(prose).toBe(rgb('#f0eef6'));

    // The green is scoped to `.tvsaid` and cannot be read outside it, the same
    // way `--tvcode` cannot. A `<pre>` in the page chrome — `.tvterm` is one,
    // and so is any help transcript — must be untouched, or the tint has become
    // a sixth product-wide hue.
    const strays = await page.evaluate(() => [...document.querySelectorAll('pre')]
      .filter((el) => el.closest('.tvsaid') === null)
      .map((el) => getComputedStyle(el).color));
    expect(strays.length).toBeGreaterThan(0);
    for (const colour of strays) expect(colour).not.toBe('rgb(152, 195, 121)');

    // And the property itself is unreadable outside the element that declares
    // it, which is the mechanism the whole scoping argument rests on.
    const outside = await page.evaluate(
      () => getComputedStyle(document.documentElement).getPropertyValue('--tvfence').trim());
    expect(outside).toBe('');
  });

  test(`a fence, a rule and terminal output take the same frame (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const probes = await said(page, 'Below the rule, one more span');

    // The author's own thematic break, which the terminal draws and this
    // viewer drew at 1.71:1.
    const rule = await probes.locator('hr').evaluate(
      (el) => getComputedStyle(el).borderBlockStartColor);
    expect(rule).toBe(rgb('#6e6e7e'));

    // The fence box. Its `--paper` fill is #0f0f12 inside the well's #101014 —
    // a 0.4% luminance step — so the border was the only thing saying where
    // code began and ended, and at 1.71:1 it said it to nobody.
    const fence = await probes.locator('pre').first().evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopColor, background: s.backgroundColor, overflow: s.overflowX };
    });
    expect(fence.border).toBe(rgb('#6e6e7e'));
    // Untouched, and said so: the box, the fill and its own scroller are what
    // `seq:26` left and this lane did not "fix".
    expect(fence.background).toBe(rgb('#0f0f12'));
    expect(fence.overflow).toBe('auto');

    // Terminal output — the slash-command turn, drawn by `termBody`. The same
    // box as a fence, so it takes the same frame rather than staying at the
    // token the fence just left.
    const term = page.locator('.tvterm').first();
    await term.waitFor({ state: 'attached', timeout: 10_000 });
    const box = await term.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: s.borderTopColor, background: s.backgroundColor };
    });
    expect(box.border).toBe(rgb('#6e6e7e'));
    expect(box.background).toBe(rgb('#0f0f12'));
  });

  /* ══ WHAT MUST NOT MOVE ═════════════════════════════════════════════════ */

  test(`a link keeps its meaning hue through a code label (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const probes = await said(page, 'A link whose label is code');

    const label = probes.locator('a span.m').first();
    await expect(label).toHaveText('src/ui/public/styles.css');
    // `--gold` is one of the five budgeted meaning hues and inside `.tvsaid` it
    // means "a link". The code tint is a decoration and must not repaint it,
    // even though its selector is the more specific of the two.
    await expect(label).toHaveCSS('color', rgb('#eab308'));
    // The underline is the second channel, and it is what survives print.
    await expect(probes.locator('a').first()).toHaveCSS('text-decoration-line', 'underline');

    // Bold is 700 here and 600 before, matching `.tva-bold` in the same well.
    // It is NOT brightened: `--ink` #f0eef6 is already the palette's brightest
    // step (16.64:1), 0.4 points from the terminal's own bright white, so
    // there is no headroom a hue would not have to invent.
    const bold = probes.locator('b').first();
    await expect(bold).toHaveCSS('font-weight', '700');
    await expect(bold).toHaveCSS('color', rgb('#f0eef6'));
  });

  test(`the hue reaches no prose outside the archive's own body (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await said(page, 'The grand D table');
    // The boundary the item asked to have STATED: `.tvsaid` and nothing wider.
    // A `.m` the string table renders in the page chrome is the same class and
    // must be untouched, or the tint has become a sixth product-wide hue.
    const strays = await page.evaluate(() => [...document.querySelectorAll('.m')]
      .filter((el) => el.closest('.tvsaid') === null)
      .map((el) => getComputedStyle(el).color));
    for (const colour of strays) expect(colour).not.toBe('rgb(198, 120, 221)');
    // Sanity: the filter above found the archive's own spans, so the previous
    // loop was not vacuous by accident of an empty page.
    expect(await page.locator('.tvsaid span.m').count()).toBeGreaterThan(10);
  });
}

/* ══ PRINT, WHERE COLOUR IS NO CHANNEL AT ALL ══════════════════════════════ */

/**
 * `#c678dd` measures **2.94:1 on white**, so on the print register's paper it
 * is not a quiet colour — it is unreadable. The `@media print` block flattens
 * it the same way it flattens the nine fence hues and every meaning hue above
 * them, in ONE line, which is why the value is a custom property rather than a
 * literal inside `.tvsaid .m`.
 */
test('the inline hue flattens to black on paper, and the frame costs nothing there', async ({ page }) => {
  await openDocument(page, 'en');
  const body = await said(page, 'The grand D table');
  await page.emulateMedia({ media: 'print' });

  const printed = await body.evaluate((el) => {
    const span = el.querySelector('span.m') as HTMLElement;
    const cell = el.querySelector('td') as HTMLElement;
    return {
      code: getComputedStyle(span).color,
      codeBg: getComputedStyle(span).backgroundColor,
      face: getComputedStyle(span).fontFamily,
      cell: getComputedStyle(cell).borderTopColor,
    };
  });
  expect(printed.code).toBe('rgb(0, 0, 0)');
  expect(printed.codeBg).toBe(rgb('#ffffff'));
  // The span keeps its box and its face, so a printed transcript still shows
  // WHERE code was once the hue is gone — colour was never the only channel.
  expect(printed.face).toContain('Geist Mono');
  // The frame is now a LITERAL on `.tvsaid` rather than `--edge-3`, so the
  // print `:root`'s flattening of the two edge tokens no longer reaches it.
  // #c9c6d4 measures 1.68:1 on white — a ruling that has vanished — so it is
  // flattened on `.tvsaid`'s own line beside the code hue.
  expect(printed.cell).toBe('rgb(0, 0, 0)');
  expect(ratio(rgb('#c9c6d4'), rgb('#ffffff'))).toBeLessThan(2);

  await page.emulateMedia({ media: 'screen' });
});

/**
 * The tint on the same argument: #98c379 measures **2.02:1 on white**, so on
 * paper it is not a quiet colour either. It flattens with the nine syntax hues
 * and the inline violet, and an untagged fence prints as the plain preformatted
 * text it always was — colour was the only channel it ever had, which is the
 * same thing the nine hues say about themselves.
 */
test('the untagged tint flattens to black on paper', async ({ page }) => {
  await openDocument(page, 'en');
  const body = await said(page, 'The counts, as');
  await page.emulateMedia({ media: 'print' });

  const printed = await body.locator('pre:not([data-lang])').first().evaluate((el) => {
    const s = getComputedStyle(el as HTMLElement);
    return { colour: s.color, background: s.backgroundColor, family: s.fontFamily };
  });
  expect(printed.colour).toBe('rgb(0, 0, 0)');
  expect(printed.background).toBe(rgb('#ffffff'));
  // The block keeps its face and its box, so a printed transcript still shows
  // where the fence was once the tint is gone.
  expect(printed.family).toContain('Geist Mono');
  expect(ratio(rgb('#98c379'), rgb('#ffffff'))).toBeLessThan(2.5);

  await page.emulateMedia({ media: 'screen' });
});

/* ══ THE TWO PICTURES THE OWNER PICKS FROM ═════════════════════════════════ */

/**
 * **His number and the safe one, on the same real table, in the same frame.**
 *
 * The item asks for this rather than for an argument, and the reason is that
 * the hazard is real and cannot be settled by arithmetic: a frame at 11.31:1
 * competes with body text at 16.51:1, and this well draws 300 tables carrying
 * 1,950 body rows on his own session, so a near-white grid can become the
 * loudest thing on the screen. `--dim` #a9a6b8 at 7.99:1 is twice today's
 * brightness and still recedes.
 *
 * The alternative is painted by overriding the ONE property the rule reads —
 * which is only possible because `--tvframe` is a property on `.tvsaid` rather
 * than a literal inside the rule, and is therefore also a check that the
 * scoping is what the stylesheet claims. The shipped value is restored and
 * re-measured afterwards, so this test cannot leave the page lying.
 */
test('both frame candidates are photographed on his own table', async ({ page }) => {
  await openDocument(page, 'en');
  const body = await said(page, 'The grand D table');
  const cell = body.locator('td').first();

  const set = async (value: string | null): Promise<string> => {
    await page.evaluate((v) => {
      for (const el of document.querySelectorAll('.tvsaid')) {
        if (v === null) (el as HTMLElement).style.removeProperty('--tvframe');
        else (el as HTMLElement).style.setProperty('--tvframe', v as string);
      }
    }, value);
    return cell.evaluate((el) => getComputedStyle(el).borderTopColor);
  };

  /**
   * A TIGHT CROP OF THE TABLE BESIDE THE WHOLE WELL, and the second one is not
   * decoration: at well scale a 1px ruling is a hairline, and #c9c6d4 against
   * #a9a6b8 is a difference of 3.3 contrast points spread over single pixels —
   * the two full-well shots differ by 5 bytes of PNG. Cropped to the table's
   * own box the lines are the same pixels at a far larger share of the frame,
   * which is what makes the two candidates comparable by eye at all.
   *
   * `page.screenshot({clip})` and NOT `locator.screenshot()`: an element shot
   * asks the browser to scroll the element into view, and `.tvrow` is absolute
   * inside a virtualised scroller, so that fires the scroll handler, rebuilds
   * the window and detaches the node being photographed. `said` has already
   * parked the row, so the box it reports is on screen and a clip needs no
   * scroll at all.
   */
  const table = body.locator('table').first();
  const crop = async (file: string): Promise<void> => {
    await page.screenshot({
      path: `e2e/screens/${file}.png`, clip: await wellClip(page, table),
    });
  };

  // HIS NUMBER, which is what ships.
  expect(await set(null)).toBe(rgb('#c9c6d4'));
  await page.locator('.tvscroll').screenshot({ path: 'e2e/screens/frame-near-white-en.png' });
  await crop('frame-near-white-table-en');

  // `--dim`, the step that is twice today's brightness and still recedes.
  expect(await set('#a9a6b8')).toBe(rgb('#a9a6b8'));
  await page.locator('.tvscroll').screenshot({ path: 'e2e/screens/frame-dim-en.png' });
  await crop('frame-dim-table-en');

  // And the one it moved FROM, so the picture carries the whole ramp the owner
  // has now judged twice: 3.79:1, 7.99:1 and 11.31:1 on the same table.
  expect(await set('#6e6e7e')).toBe(rgb('#6e6e7e'));
  await crop('frame-edge3-table-en');

  // And the page is left as it ships, measured rather than assumed.
  expect(await set(null)).toBe(rgb('#c9c6d4'));
});

/**
 * **HALF OF A COLLAPSED RULING IS NOT PAINTED IN THE TOKEN'S COLOUR, and that
 * corrects both this item's table and `seq:38`'s.**
 *
 * Every ratio either item quotes for the table frame was computed from the HEX
 * A RULE WAS WRITTEN WITH. Sampled out of the actual PNG instead, one table's
 * ruling is two colours, in a stable 57/43 split — 5,319 pixels of the token
 * and 4,043 pixels of a **flat 50% blend of the token over the ground**:
 *
 *                        the token   its painted half   share below 3.0
 *     --edge-3 #6e6e7e      3.79:1        1.82:1        43% of the ruling
 *     --dim    #a9a6b8      7.99:1        2.85:1        43% of the ruling
 *     --tvframe #c9c6d4    11.31:1        3.62:1        NONE
 *
 * The cause is `border-collapse:collapse` over rows whose heights are not whole
 * device pixels (`--sp-1`/`--sp-2` padding on a 1.6 line-height at `--fs-0`),
 * so the browser antialiases each 1px collapsed edge across two device rows at
 * half intensity each. It is not a defect and it is not fixable by a colour.
 *
 * WHAT IT MEANS IS THAT `seq:38` DID NOT ACTUALLY DELIVER A 3:1 FRAME. It
 * delivered 3.79:1 on 57% of the ruling and 1.82:1 on the rest — and 1.82 is
 * within a rounding error of the `--edge` #3a3a45 the owner said he could not
 * see. That is the most likely reason he looked at it and still asked for
 * brighter, and it is why his number is not merely taste: **#c9c6d4 is the
 * first step on this ramp at which EVERY pixel of the ruling clears 3.0:1.**
 * `--dim`'s half measures 2.85 and would still fail.
 *
 * THE RULING IS FOUND BY GEOMETRY AND NOT BY COLOUR, and the first attempt at
 * this test got that wrong in a way worth recording: `--tvframe` and the ground
 * are both near-greys, so "this pixel lies on the ground→frame line" is very
 * nearly "this pixel is grey" and it swept up the antialiasing of the `--dim`
 * header text as though it were part of the frame. A collapsed horizontal
 * border is the only thing in a table that spans its whole width, so the rows
 * are found by span instead — which also means a different device scale factor
 * changes the split this finds and not the claim it checks.
 */
test('every pixel of the ruling clears 3:1, and not only the token', async ({ page }) => {
  await openDocument(page, 'en');
  const body = await said(page, 'The grand D table');
  // `page.screenshot({clip})` and not `locator.screenshot()`, for the reason
  // `said` carries: an element shot scrolls, and a scroll detaches the row.
  const png = await page.screenshot({
    clip: await wellClip(page, body.locator('table').first()),
  });
  const found = await page.evaluate(async ({ url, ground, frame }) => {
    const img = new Image();
    img.src = url;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no 2d context');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const key = (x: number, y: number): string => {
      const i = (y * canvas.width + x) * 4;
      return `${data[i]},${data[i + 1]},${data[i + 2]}`;
    };
    const groundKey = ground.join(',');
    // A RULING ROW passes TWO tests, and neither is sufficient alone. It spans
    // most of the table's width — only a collapsed horizontal border does that;
    // a row of text is mostly ground and a chip is a few cells wide. AND its
    // colour is at least a quarter of the way from the ground to the frame,
    // which rejects the app's own dark surfaces if a clip ever slips off the
    // well again. The colour test alone was tried first and is not enough:
    // `--tvframe` and the ground are both near-greys, so "lies between them"
    // is nearly "is grey" and it swept up antialiased `--dim` header text.
    const rows: { colour: number[]; pixels: number; y: number }[] = [];
    for (let y = 0; y < canvas.height; y += 1) {
      const tally = new Map<string, number>();
      for (let x = 0; x < canvas.width; x += 1) {
        const k = key(x, y);
        tally.set(k, (tally.get(k) ?? 0) + 1);
      }
      const [top, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0]!;
      if (top === groundKey) continue;
      if (n / canvas.width < 0.6) continue;
      const colour = top.split(',').map(Number);
      const f = (colour[0]! - ground[0]!) / (frame[0]! - ground[0]!);
      if (f < 0.25) continue;
      rows.push({ colour, pixels: n, y });
    }
    // Grouped by the colour they are painted in, brightest last.
    const byColour = new Map<string, { colour: number[]; pixels: number; rows: number }>();
    for (const row of rows) {
      const k = row.colour.join(',');
      const seen = byColour.get(k) ?? { colour: row.colour, pixels: 0, rows: 0 };
      seen.pixels += row.pixels;
      seen.rows += 1;
      byColour.set(k, seen);
    }
    return [...byColour.values()].sort((a, b) => a.colour[0]! - b.colour[0]!);
  }, {
    url: `data:image/png;base64,${png.toString('base64')}`,
    ground: [0x10, 0x10, 0x14],
    frame: [0xc9, 0xc6, 0xd4],
  });

  const asCss = (c: number[]): string => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  const ground = rgb('#101014');
  const shown = found.map((f) => `${asCss(f.colour)} on ${f.rows} rows `
    + `(${ratio(asCss(f.colour), ground).toFixed(2)}:1)`).join('; ');

  // TWO populations, not one — the test would be vacuous if the blend were not
  // in the paint, and the whole finding is that it is.
  expect(found.length, `ruling rows: ${shown}`).toBeGreaterThanOrEqual(2);
  const full = found[found.length - 1]!;
  const part = found[0]!;
  expect(full.colour, `ruling rows: ${shown}`).toEqual([0xc9, 0xc6, 0xd4]);
  expect(part.rows, `ruling rows: ${shown}`).toBeGreaterThan(2);
  expect(full.rows, `ruling rows: ${shown}`).toBeGreaterThan(2);

  const dim = ratio(asCss(part.colour), ground);
  const bright = ratio(asCss(full.colour), ground);
  expect(bright, `the token paints ${bright.toFixed(2)}:1`).toBeGreaterThan(11);
  // THE CLAIM. The darkest ROW of the ruling clears 3.0:1 — which `--dim`
  // (2.85 at the same blend) and `--edge-3` (1.82) do not.
  expect(dim, `the half-painted ruling measures ${dim.toFixed(2)}:1 — ${shown}`)
    .toBeGreaterThan(3);
  const halfOf = (hex: string): string => {
    const g = [0x10, 0x10, 0x14];
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    return `rgb(${g.map((v, i) => Math.round(v + (c[i]! - v) / 2)).join(', ')})`;
  };
  expect(ratio(halfOf('#a9a6b8'), ground)).toBeLessThan(3);
  expect(ratio(halfOf('#6e6e7e'), ground)).toBeLessThan(2);
});

/**
 * The tint, photographed on the thing it has to survive: a counts table and a
 * progress-bar block, with a tagged `bash` fence in the same frame so one flat
 * colour and nine can be compared by eye. If the green ledger reads as source,
 * the tint is wrong — and that is a judgement about a picture, which is why the
 * picture is produced here rather than a number.
 */
test('the tint is photographed on a ledger, not on code', async ({ page }) => {
  await openDocument(page, 'en');
  // The counts table and the progress bars, which are what 148 of the 167
  // untagged fences on his transcript actually are.
  await shot(page, 'The counts, as', 'fence-tint-ledger-en');
  // And the same turn scrolled on, so ONE FLAT COLOUR and NINE are in the same
  // frame: the tagged `bash` fence below carries its label and its palette, the
  // untagged block above it carries neither. This is the picture the claim
  // "it must not read as tagged" is actually settled by.
  await shot(page, 'The counts, as', 'fence-tint-vs-tagged-en', 330);
});

/* ══ RTL, WHICH IS WHERE THIS PROJECT HAS FOUND ITS REAL DEFECTS ═══════════ */

/**
 * A colour cannot reorder text — and this project has twice been wrong about a
 * claim of that shape, so it is measured. The table is the harder case of the
 * two: a `<table>` is NOT inside an LTR island, so its cells lay out in the
 * page's own direction and its inline code spans are isolated runs inside RTL
 * flow. If adding `color` had changed anything about isolation, the cell text
 * would differ between the two languages here.
 */
test('a coloured span inside a table reads identically under rtl', async ({ page }) => {
  const read = async (lang: 'en' | 'he'): Promise<{
    text: string; spanDir: string; spanBidi: string; colour: string; order: number[];
  }> => {
    await openDocument(page, lang);
    const body = await said(page, 'The grand D table');
    return body.evaluate((el) => {
      const row = el.querySelectorAll('tbody tr')[0] as HTMLElement;
      const span = row.querySelector('span.m') as HTMLElement;
      const s = getComputedStyle(span);
      return {
        text: (row.textContent ?? '').replace(/\s+/g, ' ').trim(),
        spanDir: s.direction,
        spanBidi: s.unicodeBidi,
        colour: s.color,
        order: [...row.querySelectorAll('span.m')].map(
          (n) => Math.round((n as HTMLElement).getBoundingClientRect().width)),
      };
    });
  };

  const ltr = await read('en');
  const rtl = await read('he');

  expect(rtl.text).toBe(ltr.text);
  expect(rtl.text).toContain('rulings/64');
  // `.m` inherits the global isolation and this lane added only `color`.
  expect(rtl.spanDir).toBe('ltr');
  expect(rtl.spanBidi).toBe('isolate');
  expect(ltr.spanDir).toBe('ltr');
  // The hue is the same on both pages: it is not a themed or directional token.
  expect(rtl.colour).toBe(ltr.colour);
  expect(rtl.colour).toBe('rgb(198, 120, 221)');
  // A span that had been given a new bidi run would also have been re-measured;
  // identical widths say the boxes are the boxes they were.
  expect(rtl.order).toEqual(ltr.order);
});
