// @basis TASK-inline-code-has-no-hue-and-a-table-frame-is-drawn-at-1-71-1,
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
 *     --edge-3   #6e6e7e   3.82:1 / 3.79:1   IS the table frame
 *     #c678dd    violet    6.50:1 / 6.45:1   IS inline code
 *     #61afef    blue      8.10:1 / 8.03:1   the other candidate, and rejected
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

/** A slash command, which the doc builder marks synthetic and draws as `.tvterm`. */
const SYNTHETIC = '<command-name>/graphify</command-name>\n<command-args>archive</command-args>';

const PROMPT = 'where is the archive plan';

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 9, 4, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'A table, and the words in it' });
  const said = [REAL_TURN, PROBES];
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

  /* ══ THE FRAME, AT 3.79:1 INSTEAD OF 1.69:1 ══════════════════════════════ */

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
    // `--edge-3`, not `--edge`. #3a3a45 measured 1.69:1 here and is the frame
    // the owner said he could not see.
    expect(drawn.border).toBe(rgb('#6e6e7e'));
    expect(drawn.ground).toBe(rgb('#101014'));
    // WCAG 1.4.11: a non-text boundary a reader must see owes 3.0:1. The old
    // token paid 1.69. Asserted as a NUMBER so a future repoint of either
    // token fails here rather than in the owner's eyes.
    const got = ratio(drawn.border, drawn.ground);
    expect(got, `table ruling measures ${got.toFixed(2)}:1`).toBeGreaterThanOrEqual(3);
    expect(ratio(rgb('#3a3a45'), drawn.ground)).toBeLessThan(2);
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
  // And the frame change is free on paper: the print `:root` already flattened
  // BOTH `--edge` and `--edge-3` to #000, so raising one to the other is
  // invisible there by construction rather than by a second measurement.
  expect(printed.cell).toBe('rgb(0, 0, 0)');

  await page.emulateMedia({ media: 'screen' });
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
