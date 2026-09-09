// @basis TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing,
// TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a,
// INV-nothing-is-dropped-silently
/**
 * **Code in a transcript, in a real browser, in both languages.**
 *
 * `TASK-inline-code-in-a-conversation-gets-a-font-change-and-nothing`, owner
 * 2026-09-08, pointing at a path his terminal had coloured: *"could you do the
 * same in the session browser?"* — then, on being asked whether he meant the
 * box, a tint, or the lot: *"Full syntax colouring in fenced blocks too.
 * everything that is colourd should apear similar in the viewer"*.
 *
 * ── WHY THIS IS A SEPARATE FILE FROM `conversations.spec.ts` ──────────────
 *
 * That file's fixture is 120 synthetic rounds shaped to make a document long
 * enough to have an unreachable end. This one needs the opposite: a SHORT
 * document whose every turn is on screen at once, holding REAL prose of the
 * owner's own, because the question it answers is not "does a rule apply" but
 * "what does 4.9 code spans per paragraph LOOK like" — and that is a question
 * about a real turn, which the item says to render before choosing between a
 * box and a tint.
 *
 * ── THE TURNS BELOW ARE REAL AND ARE COMMITTED RATHER THAN READ ───────────
 *
 * `TURNS` holds three assistant blocks taken verbatim from the owner's session
 * on 2026-09-09 — 19, 12 and 26 inline spans respectively, which are the
 * DENSEST in the file by spans per character and therefore the worst case for
 * the box. They are copied in rather than read out of `~/.claude`, so this spec
 * measures the same pixels on every machine and reads nothing that exists on
 * one. The fence fixtures beside them are the tagged fences that session
 * actually contains.
 *
 * ── WHAT THE NODE SUITE CANNOT ANSWER, WHICH IS WHY THIS EXISTS ───────────
 *
 * `test/ui/highlight.test.ts` proves the tokeniser emits the classes it
 * declares. A class that no CSS rule matches would pass every one of those
 * assertions and reach the owner as an uncoloured block. So the assertions here
 * are about COMPUTED COLOUR, about the label actually rendering, and about the
 * one thing this project has repeatedly found only in a picture: the LTR island
 * a `<pre>` is, on an RTL page, after a renderer put new inline elements inside
 * it. A leading dot at the wrong end and a Hebrew timestamp reordered to
 * "09:00 2026-09-08" both passed every assertion that was not this one.
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
 * Three real assistant turns, verbatim, chosen for inline-code DENSITY.
 * 19 spans in 767 characters, 12 in 526, 26 in 1,381.
 */
const TURNS = [
  'Both premises verified in the code. So **`mcp/6` isn\'t actually an open question** — its body '
  + 'already decides both shapes, and the code backs them:\n\n'
  + '- **`lesson`** — `--agent` genuinely records `origin: \'agent\'` (`lesson.ts:122`), with the '
  + 'trust boundary already solved. The tool always claims `agent`, because a tool call *is* a '
  + 'non-human caller. No decision left, only wiring.\n'
  + '- **`procedure`** — `activate`/`done` hardcode `origin: \'human\'` in four places '
  + '(`procedure.ts:281,294,337,387`). So the tool exposes `list`/`show`/`step` only, exactly as '
  + '`review` gets `list_drafts` with no tool for `review promote`.\n\n'
  + 'That\'s the fourth ASK item that turned out already settled. Dispatching both MCP tools as one '
  + 'lane, since they share `src/mcp/tools.ts` and `parity.ts`.',

  'Every A means something different per row, so here\'s what you actually decided.\n\n'
  + '**14 items close outright.** Seven are OVERTAKEN — close `done`, each naming what did the '
  + 'work: `walk/20` (`93920f6`), `walk/63`, `walk/34`, `walk/25`, `walk/130`, `walk/127` '
  + '(`a18b804`), and `walk/129`\'s definition half. Seven are SUPERSEDED — retired naming a '
  + 'successor: `walk/3`, `21`, `95`, `24`, `131`, plus `walk/108` and `walk/16`, which both need '
  + 'something **filed first**.\n\n'
  + '**Fifteen SPLIT items get re-cut** — part closed against a named ruling, a smaller item kept. '
  + 'Several strike specific dead clauses by name (`walk/2`\'s tree-parity rationale and `<h3>` '
  + 'constraint; `walk/121`\'s two withdrawn clauses; `walk/102`\'s nine-twelfths).\n\n'
  + '**Sixteen STAND as real work**, one of which (`walk/141`) you\'ve told to stay held until '
  + '`builder/11` closes.',

  'The new SQL reads `kind`, `session_id`, `op` as **columns**:\n\n'
  + '```sql\n'
  + 'SELECT seq FROM audit WHERE kind = \'injection\' AND session_id = ? AND op IN (…)\n'
  + '```\n\n'
  + 'But the `audit` table I inspected has only `seq, src, rec` — those fields live *inside* the '
  + '`rec` JSON. Checking whether `syncProjection` migrates the schema, since my read was before '
  + 'any sync ran.',
];

/**
 * The tagged fences, in one turn, so a single screenshot carries all six
 * tokenisers. Each body is real: the `ts`, `bash`, `yaml`, `js`, `json` and
 * `diff` fences measured on the owner's own session.
 *
 * The two UNTAGGED blocks at the end are the control, and they are the common
 * case: 160 of the 185 fenced blocks in that session declare nothing, and both
 * of these are what those blocks actually hold — a ledger and a measurement
 * table, which are not code in any language.
 */
const FENCES = [
  'Six languages, and two blocks that said nothing:',
  '',
  '```ts',
  'const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) };',
  '```',
  '',
  '```bash',
  '# the flags the owner ran',
  'mycontext config categories.task.extraFields --unset progress,last_change --yes',
  'tail -n 6 .my_context/.audit/audit.jsonl | cut -c1-60',
  'node ${CLAUDE_PLUGIN_ROOT}/src/mcp/server.ts',
  '```',
  '',
  '```js',
  'export const test = base.extend<{ app: App }>({',
  '  app: async ({ page }, use) => {',
  '    harness = await startUiChild(CORPUS);   // spawns a whole UI server',
  '  },',
  '});',
  '```',
  '',
  '```json',
  '{"kind":"mutation","op":"update","fields":["extra.state","tags"],"enabled":true,"n":15}',
  '```',
  '',
  '```yaml',
  'plan: hooks          # extra, undeclared, unvalidated',
  'seq: "16"',
  'state: todo',
  '```',
  '',
  '```diff',
  '--- a/one.ts',
  '+++ b/one.ts',
  '-  Its plan, sequence, state and progress live in extra fields',
  '+  Its plan, sequence and state live in extra fields',
  '```',
  '',
  '```',
  'body_disagrees_with_meta (34)  [info]  1 acknowledged',
  'citation_form (35)             [info]',
  '```',
  '',
  '```',
  'done     406  ████████████████░░░░  80%',
  'types: user=28  assistant=54  system=5  attachment=51',
  '```',
].join('\n');

/** A fence declaring a language nothing here tokenises — labelled, not coloured. */
const UNHANDLED = 'A language with no tokeniser here:\n\n```python\nprint("hello")\n```';

const PROMPT = 'show me the code the way the terminal draws it';

function session(): unknown[] {
  const rows: unknown[] = [];
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 8, 9, 0, n)).toISOString();
  rows.push({ type: 'ai-title', aiTitle: 'Code in a transcript' });
  const said = [...TURNS, FENCES, UNHANDLED];
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
  return rows;
}

let harness: UiHarness;
let cwd: string;
let home: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-code-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-code-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, 'sess-code.jsonl'),
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
 * **THE CODE-SKEW BANNER, DISMISSED THE WAY A PERSON WOULD.**
 *
 * This file's server lives for the whole spec — twenty tests across two browser
 * projects — and `src/core/code-identity.ts` stamps every file `src/ui/server
 * .ts` transitively reaches at start, so a SIBLING LANE editing one of those
 * while this runs makes every `/api` answer carry `staleCode: true`. `app.js`
 * then latches `#exited` over the whole page, on purpose, and that fixed banner
 * physically intercepts the row click below — which is how this spec failed 6
 * of 20 once, on a click, with nothing wrong with the code under test. A
 * sibling lane's `test/ui/transcript-viewer.test.ts` edit landed mid-run and
 * was visible in `git status` while it happened.
 *
 * `e2e/app.ts` hit the identical thing on `session-picker.spec.ts` and answers
 * it the identical way, and the reasoning is copied rather than re-derived: the
 * banner is TRUTHFUL and the feature it reports is untouched, but a spec about
 * syntax colour must not be failed by another lane's unrelated save. A spec
 * that wanted to assert the banner's own behaviour would bring its own
 * short-lived server, exactly as `doctor-settle.spec.ts` does.
 *
 * The button is reached by POSITION and not by name, because this spec runs in
 * both languages and the label is a string-table entry.
 *
 * **`#exited` is therefore not asserted hidden here.** The skew does not clear
 * — every later answer carries the same flag and the banner re-latches — so an
 * assertion would be asserting that no sibling lane is working, which is not a
 * fact about this feature.
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
  // **Top, and it is not decoration.** A session OPENS AT ITS END, and for a
  // short window after opening every repaint re-pins the well to the tail —
  // `paint`'s `if (stickUntil > Date.now()) scroll.scrollTop = scroller.total`.
  // Any scroll this spec performs inside that window is undone on the next
  // paint, which is how the first draft photographed the same tail nine times
  // with every assertion green. Pressing Top clears `stickUntil`, which is the
  // handler's own first statement, so the reader — and this spec — owns the
  // position from here on.
  await page.locator('button.tvtop').click();
  await expect(page.locator('.tvscroll')).toContainText('Both premises verified', { timeout: 20_000 });
}

/**
 * The turn whose words contain `phrase`, brought into the well and returned.
 *
 * **`scrollIntoViewIfNeeded` does not work here, and that is a property of the
 * viewer rather than of Playwright.** `.tvrow` is `position:absolute` inside a
 * virtualised scroller: asking the browser to scroll a row into view fires the
 * scroll handler, which rebuilds the window and detaches the very node that was
 * being scrolled to — so the locator re-resolves to a fresh node that is once
 * again outside the box, and the two fight until the timeout. Measured: 14
 * resolutions of the same selector, `viewport ratio 0` every time.
 *
 * So the WELL is driven instead of the row: `scrollTop` is set, the viewer
 * rebuilds from its own model, and only then is the row measured — against the
 * well's rectangle rather than the page's, because a row inside an
 * `overflow:auto` box can be on the page and clipped out of the box.
 */
async function said(page: Page, phrase: string) {
  const well = page.locator('.tvscroll');
  // TWO frames, because the viewer rebuilds its window from a scroll event and
  // the rebuild lands on the next paint. Checking the DOM in the same tick as
  // the assignment reads the PREVIOUS window, which is what made the first
  // version of this loop walk the whole document and find nothing.
  const settle = (): Promise<unknown> => well.evaluate(() => new Promise(
    (done) => { requestAnimationFrame(() => requestAnimationFrame(() => done(null))); }));
  const { height, step } = await well.evaluate((el) => ({
    height: el.scrollHeight, step: Math.max(el.clientHeight / 2, 80),
  }));
  for (let top = 0; top <= height + step; top += step) {
    await well.evaluate((el, t) => { el.scrollTop = t as number; }, top);
    await settle();
    if (await page.locator('.tvsaid', { hasText: phrase }).count() === 0) continue;
    // Found. Now park the turn's own row AT the top of the well, using the
    // offset the viewer itself wrote onto the row — `.tvrow` is absolutely
    // positioned inside `.tvinner` from the scroller's model, so its
    // `offsetTop` IS the scrollTop that puts it at the top of the box. No
    // second opinion about where a row is, which is the property
    // `mountDocument` was built for.
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
 * The WELL, photographed — never the turn.
 *
 * An element screenshot of a `.tvrow` asks the browser to scroll it into view
 * first, which is the same fight `said` above documents; the first draft of
 * this spec did that and photographed a DIFFERENT turn than the one it had
 * located, with every assertion green. The well is a fixed box that does not
 * move, so it is the thing to photograph, and `said` has already put the turn
 * at the top of it.
 */
async function shot(
  page: Page, phrase: string, file: string, extra = 0,
): Promise<void> {
  await said(page, phrase);
  // `extra` is for a turn TALLER than the well: `said` parks its top at the
  // top of the box, so the rest of it needs one more nudge to be photographed.
  // The fences turn is ~1,000px in a ~500px well, which is two pictures.
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

/* ══ THE INLINE SPAN, WHICH IS THE CASE BY TWO ORDERS OF MAGNITUDE ═════════ */

for (const lang of ['en', 'he'] as const) {
  /**
   * **10,249 spans against 185 fences.** The thing the owner pointed at is also
   * the thing that occurs most, and it needs no highlighter at all — only the
   * treatment `.tvsaid .m` already carries.
   *
   * This asserts the box is REALLY THERE on a real turn, because the item
   * describes it as absent: it says `markdown.js` "makes a `code` element, with
   * NO class". That is true of `githubNodes`, which draws `/doc.html`; the
   * archive is drawn by `markdownNodes`, whose `code_inline` branch has emitted
   * `span.m` since the renderer was vendored in `52f74e4`. The gap the item
   * describes was already closed before this lane opened, and the assertion is
   * here so it stays closed rather than because it was made to pass.
   */
  test(`inline code wears the app's own literal box, on a real turn (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'Both premises verified in the code');

    const spans = body.locator('span.m');
    // Nineteen in this turn; the assertion is on the shape, not on the count,
    // because the fixture's own text could be re-trimmed.
    expect(await spans.count()).toBeGreaterThan(15);
    // Inline code is `.m`, never a bare `<code>`: `markdownNodes`' own
    // `code_inline` branch, and the reason the box applies at all.
    await expect(body.locator('code')).toHaveCount(0);

    const box = await spans.first().evaluate((el) => {
      const s = getComputedStyle(el);
      return {
        background: s.backgroundColor,
        border: s.borderTopWidth,
        radius: s.borderTopLeftRadius,
        pad: s.paddingInlineStart,
        family: s.fontFamily,
      };
    });
    expect(box.background).toBe(rgb('#0f0f12'));
    expect(box.border).toBe('1px');
    expect(box.radius).toBe('3px');
    expect(box.pad).toBe('4px');
    expect(box.family).toContain('Geist Mono');

    // THE PICTURE, which is what the item asked to be looked at before
    // choosing between the box and a tint. Element screenshots, not
    // `fullPage` — a full-page shot resizes the viewport and re-renders.
    await shot(page, 'Both premises verified in the code', `code-inline-dense-${lang}`);
    await shot(page, 'Every A means something different', `code-inline-densest-${lang}`);
  });

  /* ══ THE FENCE THAT SAID WHAT IT WAS ══════════════════════════════════════ */

  test(`a fence that declares a language is labelled and coloured (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'Six languages, and two blocks');

    // Six declared, two undeclared, in one turn.
    await expect(body.locator('pre[data-lang]')).toHaveCount(6);
    await expect(body.locator('pre:not([data-lang])')).toHaveCount(2);
    expect(await body.locator('pre[data-lang]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('data-lang')))).toEqual(
      ['ts', 'bash', 'js', 'json', 'yaml', 'diff']);

    // THE LABEL: the author's own word, drawn by `::before` from the attribute.
    const label = await body.locator('pre[data-lang]').first()
      .evaluate((el) => getComputedStyle(el, '::before').content);
    expect(label).toBe('"ts"');

    // THE COLOUR, computed — nine hues, every one byte-identical to a colour
    // `.tvterm` already declares, so nothing new entered the product.
    const ts = body.locator('pre[data-lang="ts"]');
    await expect(ts.locator('.tvh-k').first()).toHaveCSS('color', rgb('#c678dd'));
    await expect(ts.locator('.tvh-t').first()).toHaveCSS('color', rgb('#e5c07b'));
    await expect(ts.locator('.tvh-f').first()).toHaveCSS('color', rgb('#61afef'));

    const bash = body.locator('pre[data-lang="bash"]');
    await expect(bash.locator('.tvh-c').first()).toHaveCSS('color', rgb('#7f8c9b'));
    await expect(bash.locator('.tvh-a').first()).toHaveCSS('color', rgb('#56b6c2'));
    await expect(bash.locator('.tvh-v').first()).toHaveCSS('color', rgb('#e06c75'));

    const json = body.locator('pre[data-lang="json"]');
    await expect(json.locator('.tvh-p').first()).toHaveCSS('color', rgb('#e06c75'));
    await expect(json.locator('.tvh-s').first()).toHaveCSS('color', rgb('#98c379'));
    await expect(json.locator('.tvh-n').first()).toHaveCSS('color', rgb('#d19a66'));

    const diff = body.locator('pre[data-lang="diff"]');
    await expect(diff.locator('.tvh-add').first()).toHaveCSS('color', rgb('#98c379'));
    await expect(diff.locator('.tvh-del').first()).toHaveCSS('color', rgb('#e06c75'));
    await expect(diff.locator('.tvh-meta').first()).toHaveCSS('color', rgb('#61afef'));

    await shot(page, 'Six languages, and two blocks', `code-fences-${lang}`);
    await shot(page, 'Six languages, and two blocks', `code-fences-tail-${lang}`, 470);
  });

  /**
   * **THE 86.5%, AND THE DECISION THAT THEY GET NO MARK — AND WHAT MOVED.**
   *
   * 160 of 185 fenced blocks in the owner's session declare nothing, and both
   * control blocks here are what those blocks actually hold — a ledger and a
   * counts table, which are not code in any language. They carry NO chip, NO
   * label and NO token span, and that half of the decision is unchanged: the
   * signal is drawn on the other side, where the label appears on the 25 that
   * declared something, so colour and label arrive together.
   *
   * WHAT MOVED IS THE INK, by owner ruling on 2026-09-09 —
   * `TASK-the-table-frames-want-to-be-near-white-and-an-untagged-code`:
   * *"at least different bright than white like green or yello kind of as it is
   * on the TUI"*. This test used to assert these blocks were `--ink` #f0eef6,
   * the prose colour, and that assertion was the thing he objected to. They now
   * take `--tvfence` #98c379 — ONE flat colour, not a palette, so it makes no
   * claim about any token and the "no auto-detection" ruling is untouched. The
   * distinction from a tagged fence is asserted below and is what `seq:26`
   * deliberately paired: one colour and no label against nine and a label.
   * `e2e/code-hue.spec.ts` carries the measurements and the ledger picture.
   */
  test(`a fence that declares nothing is tinted, and unmarked (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'Six languages, and two blocks');
    const plain = body.locator('pre:not([data-lang])');

    await expect(plain).toHaveCount(2);
    // No token was invented: nothing guessed at what these blocks are.
    await expect(plain.locator('[class^="tvh-"]')).toHaveCount(0);
    for (let i = 0; i < 2; i += 1) {
      const shown = await plain.nth(i).evaluate((el) => ({
        before: getComputedStyle(el, '::before').content,
        background: getComputedStyle(el).backgroundColor,
        overflow: getComputedStyle(el).overflowX,
        colour: getComputedStyle(el).color,
      }));
      expect(shown.before, 'no marker on the common case').toBe('none');
      expect(shown.background).toBe(rgb('#0f0f12'));
      expect(shown.overflow).toBe('auto');
      // #98c379, the terminal's own green — one flat tint, and NOT `--ink`
      // #f0eef6, which is what this line asserted until the ruling above.
      expect(shown.colour).toBe(rgb('#98c379'));
      expect(shown.colour).not.toBe(rgb('#f0eef6'));
    }
    // The bar chart and the box-drawing characters survive verbatim: this is
    // the text a highlighter would have had to guess at, and nothing did.
    await expect(plain.nth(1)).toContainText('████████████████░░░░  80%');
  });

  test(`a declared language with no tokeniser is named, not coloured (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    const body = await said(page, 'A language with no tokeniser here');
    const pre = body.locator('pre[data-lang="python"]');
    await expect(pre).toHaveCount(1);
    // The reader is TOLD what it said, so an uncoloured block is legible as
    // "nothing here reads python" rather than as "colouring is broken".
    expect(await pre.evaluate((el) => getComputedStyle(el, '::before').content)).toBe('"python"');
    await expect(pre.locator('[class^="tvh-"]')).toHaveCount(0);
    await expect(pre).toContainText('print("hello")');
    // NOT COLOURED BY SYNTAX, and still not `--ink`. Before the 2026-09-09
    // ruling this was the same colour as the prose; leaving it there once
    // untagged fences were tinted would have made the one block that DID say
    // what it was the least marked block in the well. It takes the same flat
    // tint as a block that declared nothing — "nothing coloured this" — and its
    // label remains the thing that says it declared something.
    await expect(pre).toHaveCSS('color', rgb('#98c379'));
  });
}

/* ══ RTL, WHICH IS WHERE THIS PROJECT HAS FOUND ITS REAL DEFECTS ═══════════ */

/**
 * **A token wrapper is a new inline element inside an LTR island on an RTL
 * page** — the exact shape that once produced a leading dot at the wrong end
 * and a Hebrew timestamp reordered to "09:00 2026-09-08". A `<span>` at the
 * default `unicode-bidi: normal` is transparent to the bidi algorithm, so
 * splitting a line into spans cannot reorder it; setting `isolate` on a token
 * WOULD, by making every token its own bidi run. Nothing does. This measures
 * that rather than trusting it.
 */
test('a coloured fence reads identically under rtl, character for character', async ({ page }) => {
  const read = async (lang: 'en' | 'he'): Promise<{
    text: string; label: string; dir: string; bidi: string; order: number[];
  }> => {
    await openDocument(page, lang);
    const body = await said(page, 'Six languages, and two blocks');
    return body.locator('pre[data-lang="ts"]').evaluate((el) => ({
      // The block's own words, tokens and all. If a span reordered anything,
      // this string differs between the two runs.
      text: el.textContent ?? '',
      label: getComputedStyle(el, '::before').content,
      dir: getComputedStyle(el).direction,
      // A token must NOT isolate: that is what would make it its own bidi run.
      bidi: getComputedStyle(el.querySelector('.tvh-k') as Element).unicodeBidi,
      // The left edge of every token, in DOM order. On a correctly isolated
      // LTR island this is non-decreasing in both languages.
      order: [...el.querySelectorAll('span')].map((s) => Math.round(
        (s as HTMLElement).getBoundingClientRect().left)),
    }));
  };

  const ltr = await read('en');
  const rtl = await read('he');

  expect(rtl.text).toBe(ltr.text);
  expect(rtl.text).toContain('const withChecksum: Item = { ...item, checksum:');
  expect(rtl.label).toBe(ltr.label);
  expect(rtl.dir).toBe('ltr');
  expect(ltr.dir).toBe('ltr');
  expect(rtl.bidi).toBe('normal');
  expect(rtl.order.length).toBe(ltr.order.length);
  // Non-decreasing on ONE line — the fence is a single line, so a token that
  // had been given its own bidi run would jump backwards here.
  for (let i = 1; i < rtl.order.length; i += 1) {
    expect(rtl.order[i]!, `token ${i} moved leftwards under rtl`)
      .toBeGreaterThanOrEqual(rtl.order[i - 1]!);
  }
});

/**
 * The same question one layer down, on the construct the owner actually
 * pointed at: an inline `.m` span, sitting inside Hebrew-page prose.
 */
test('an inline literal keeps its own order inside an rtl paragraph', async ({ page }) => {
  await openDocument(page, 'he');
  const body = await said(page, 'Both premises verified in the code');
  const one = body.locator('span.m', { hasText: 'src/mcp/tools.ts' }).first();
  await expect(one).toHaveText('src/mcp/tools.ts');
  const shown = await one.evaluate((el) => ({
    dir: getComputedStyle(el).direction,
    bidi: getComputedStyle(el).unicodeBidi,
  }));
  // `.m` inherits the global `.m,code,kbd,pre` isolation, which is what keeps a
  // path from reordering mid-sentence. That is EXISTING behaviour and is
  // asserted here because this lane added siblings inside the same island.
  expect(shown.dir).toBe('ltr');
  expect(shown.bidi).toBe('isolate');
  await shot(page, 'Both premises verified in the code', 'code-inline-rtl-paragraph');
});
