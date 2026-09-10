// @basis TASK-a-spilled-tool-result-is-reachable-from-the-step-that, INV-nothing-is-dropped-silently
/**
 * **THE STUB IS THE CONCLUSION AND THE SPILLED FILE IS THE EVIDENCE** —
 * `plan:archive seq:30`, driven in a real browser on both pages.
 *
 * When a tool result is too large to inline, the harness writes the bytes to
 * `<session>/tool-results/<name>.txt` and leaves a `<persisted-output>` stub in
 * the record naming it. Until this item, a reader following a step met that
 * sentence and could go no further: the archive indexed neither the file nor
 * the link to it. Measured on the owner's own tree 2026-09-10 — 3,091 stubs,
 * 1,812 distinct files, 53.7 MB, every one of them resolving and every one of
 * them unreachable from the screen.
 *
 * ── WHY IT IS DRIVEN AND NOT READ OUT OF THE READ MODEL ───────────────────
 *
 * `test/ui/conversation-document.test.ts` owns the parse, the two conditions,
 * the deduplication and the route's refusals. None of that proves a reader can
 * GET to the bytes: the link is composed in `spillHref`, drawn by `spillMarks`
 * inside a fold nobody has opened yet, and served by a `kind: 'stream'` route
 * behind the security gate. The one question this file asks is the item's own —
 * can the reader open the evidence — and it is answered by opening it.
 *
 * ── BOTH PAGES, BECAUSE `stepParts` SERVES BOTH ───────────────────────────
 *
 * `spillMarks` is called from `stepParts`, which draws a step inside the app's
 * document AND inside `/lane.html`. A control that worked in one and not the
 * other would be invisible to a test that only opened the first, and the lane
 * page is where the item's own reader is — "a reader in the archive following a
 * lane's step". So the fixture spills on both sides and both are opened.
 *
 * ── AND THE MISSING FILE IS ASSERTED, NOT ASSUMED ─────────────────────────
 *
 * `seq:15` ruled three answers and never nothing; `conv.doc.laneGone` is the
 * worked example. A spilled file is pruned exactly as a lane is, so the fixture
 * carries a stub naming a file that was never written and the page is required
 * to SAY so — with the stub's own sentence still drawn beside it, because what
 * is withheld from an unreachable spill is a link, never a fact.
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

const SESSION = 'sess-spill';
const LANE = 'agent-spill';
const LANE_CALL = 'toolu_SPILL_LANE';

/** What the session's spilled file holds, and the assertion the tab is checked against. */
const SESSION_BYTES = `session evidence — שורה בעברית\n${'s'.repeat(3000)}\n`;
/** The lane's, distinct, so a page cannot pass by serving the other one's file. */
const LANE_BYTES = `lane evidence — שורה אחרת\n${'l'.repeat(1500)}\n`;

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const toolResult = (content: string): unknown[] => [{ type: 'tool_result', content }];
const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/** A `<persisted-output>` block exactly as the harness writes one. */
const stub = (file: string, said: string): string => [
  '<persisted-output>',
  `Output too large (${said}). Full output saved to: ${file}`,
  '',
  'Preview (first 2KB):',
  'the opening of what was saved',
  '</persisted-output>',
].join('\n');

let harness: UiHarness;
let cwd: string;
let home: string;
let sessionSpill: string;
let laneSpill: string;
let prunedSpill: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-spill-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-spill-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  // The harness's own spill directory, beside the transcript and NOT under a
  // temp scratchpad — `seq:30` corrects `seq:12` on exactly this point.
  const spills = path.join(dir, SESSION, 'tool-results');
  mkdirSync(spills, { recursive: true });
  sessionSpill = path.join(spills, 'b0h3g5h55.txt');
  laneSpill = path.join(spills, 'hook-toolu_LANE-1-additionalContext.txt');
  // Named by a stub and never written. The prune this page has to disclose.
  prunedSpill = path.join(spills, 'bpruned0x.txt');
  writeFileSync(sessionSpill, SESSION_BYTES);
  writeFileSync(laneSpill, LANE_BYTES);

  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'sweep the tree and report' }, timestamp: '2026-09-10T09:00:00.000Z' },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: LANE_CALL, name: 'Agent', input: { prompt: 'sweep it' } }],
      },
      timestamp: '2026-09-10T09:00:01.000Z',
    },
    { type: 'user', message: { role: 'user', content: toolResult(stub(sessionSpill, '146.3KB')) }, timestamp: '2026-09-10T09:00:02.000Z' },
    { type: 'user', message: { role: 'user', content: toolResult(stub(prunedSpill, '2.1MB')) }, timestamp: '2026-09-10T09:00:03.000Z' },
    { type: 'assistant', message: { role: 'assistant', content: text('the sweep is done') }, timestamp: '2026-09-10T09:00:04.000Z' },
  ]));

  const lanes = path.join(dir, SESSION, 'subagents');
  mkdirSync(lanes, { recursive: true });
  writeFileSync(path.join(lanes, `${LANE}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'sweep it' }, timestamp: '2026-09-10T09:00:01.500Z' },
    { type: 'user', message: { role: 'user', content: toolResult(stub(laneSpill, '95.7KB')) }, timestamp: '2026-09-10T09:00:01.700Z' },
    { type: 'assistant', message: { role: 'assistant', content: text('swept') }, timestamp: '2026-09-10T09:00:01.900Z' },
  ]));
  writeFileSync(path.join(lanes, `${LANE}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: 'Sweep the tree',
    toolUseId: LANE_CALL, spawnDepth: 1,
  }));

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
 * One page load at a hash, in one language.
 *
 * **THE WAIT IS SCOPED TO THE VISIBLE SCREEN, and that is this project's own
 * repair rather than a precaution.** `e2e/conversations.spec.ts`' `open` carries
 * the finding in full: `app.js` keeps every visited screen inside `#screen`,
 * merely HIDDEN, so an unscoped `waitForSelector` can lock onto a match that
 * will never become visible and wait out its whole timeout while the screen the
 * reader is on has long since drawn. It was seen there as a rotating handful of
 * failures per run — 15 of 66, then 11, then 6 of 132, never twice the same
 * test — and this file reproduced it once, on its own first serial run under
 * load, by spelling the wait the unscoped way.
 *
 * `/lane.html` needs no such scoping and does not get it: it has no rail and no
 * router, so its document is the only thing on the page. That is `seq:51`'s
 * bare window doing exactly what it was built to do.
 */
async function open(page: Page, hash: string, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash);
  await page.waitForSelector('[data-p]:not([hidden]) .tvscroll .tvturn', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/**
 * Open every fold on the page. The stub lives in a `work` node, which is closed
 * until a reader opens it — the same gesture `lane-link-face.spec.ts` makes for
 * the lane link, and the reason both files keep a tiny fixture: nothing here is
 * about scrolling, so the whole document is in the DOM and every fold is
 * reachable without one.
 */
async function openFolds(page: Page, on: string): Promise<void> {
  // SCOPED TO THE DOCUMENT, and to the fold's own summary class. A bare
  // `details` selector also finds the shell's rail disclosures, which are not
  // on screen on the app page and hang a click for thirty seconds — the lane
  // page has no rail (`seq:51`), so an unscoped helper passes there and fails
  // on the page it was written for.
  //
  // `on` is the visible-screen prefix — see `open` for why the app page needs
  // one and `/lane.html` does not.
  const summaries = page.locator(`${on}.tvscroll summary.tvworksum`);
  for (let i = 0; i < await summaries.count(); i += 1) await summaries.nth(i).click();
}

/**
 * The visible screen on the APP page. Every locator in the session test is
 * prefixed with it, for the reason `open` records: a hidden pane's copy of a
 * row is still in the DOM, so a page-wide locator can wait on something the
 * reader cannot see, or count one row twice.
 */
const ON = '[data-p]:not([hidden]) ';

/**
 * **THE WHOLE CLAIM, AND IT IS ASSERTED BY OPENING THE FILE.**
 *
 * A new tab at the link's own address, which is what the `<a target="_blank">`
 * actually does — and the token rides on the context's cookie, so this is the
 * path a person takes rather than a request built by the test.
 */
async function opensTheEvidence(page: Page, href: string, expected: string): Promise<void> {
  const tab = await page.context().newPage();
  try {
    const answer = await tab.goto(`http://127.0.0.1:${harness.port}${href}`);
    expect(answer?.status(), 'the evidence is served, not refused').toBe(200);
    expect(answer?.headers()['content-type']).toBe('text/plain; charset=utf-8');
    // The BYTES, whole. `textContent` of the rendered plain-text document is
    // what a reader can select and copy, and it must be the file — not a
    // preview of it, which is the thing the transcript already had.
    const shown = await tab.evaluate(() => document.body.textContent ?? '');
    expect(shown, 'every byte, uncut — a cap here would rebuild the wall').toContain(expected);
  } finally {
    await tab.close();
  }
}

for (const lang of ['en', 'he'] as const) {
  test(`a step's spilled tool result opens from the session document (${lang})`, async ({ page }) => {
    await open(page, `#/conversations/${SESSION}`, lang);
    await openFolds(page, ON);

    const links = page.locator(`${ON}a.tvspill`);
    await expect(links, 'the step that names a spilled file draws the way to it')
      .toHaveCount(1);
    const href = await links.first().getAttribute('href');
    expect(href, 'the address carries the path the transcript recorded')
      .toBe(`/api/spill?file=${encodeURIComponent(sessionSpill)}`);
    await expect(links.first(), 'and says what the file measures now')
      .toContainText('KB');

    await opensTheEvidence(page, href!, 'session evidence');

    // ── THE PRUNED ONE IS SAID, NOT SWALLOWED ────────────────────────────
    // `INV-nothing-is-dropped-silently`. Two stubs on this page, one link, and
    // the second one accounted for in words.
    await expect(page.locator(`${ON}.tvspillgone`), 'a spilled file that is gone is disclosed')
      .toHaveCount(1);
    // AND THE FACT SURVIVES: what is withheld from an unreachable spill is the
    // control, never the record. The stub's own sentence — absolute path
    // included — is still on the page for the reader to act on themselves.
    await expect(page.locator(`${ON}.tvscroll`), 'the record still names what it named')
      .toContainText(prunedSpill);

    await page.locator(`${ON}.tvscroll`).screenshot({ path: `e2e/screens/spill-session-${lang}.png` });
  });

  test(`a lane's own spilled tool result opens from the bare lane window (${lang})`, async ({ page }) => {
    // `/lane.html` DIRECTLY, which is what `laneLink`'s new tab opens. This is
    // the reader `seq:30` describes — following a lane's step — and the page
    // reaches `spillMarks` through the same `stepParts` the app does.
    await page.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
    const nonce = await mintNonce(harness.port);
    await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
    await page.waitForSelector('.rail', { timeout: 20_000 });
    await page.goto(`http://127.0.0.1:${harness.port}/lane.html?id=${LANE}`);
    await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
    await openFolds(page, '');

    const links = page.locator('a.tvspill');
    await expect(links, 'the lane page draws it too — one renderer, two pages')
      .toHaveCount(1);
    const href = await links.first().getAttribute('href');
    expect(href, 'root-absolute, so it means the same thing on /lane.html as on /')
      .toBe(`/api/spill?file=${encodeURIComponent(laneSpill)}`);

    await opensTheEvidence(page, href!, 'lane evidence');
    await page.locator('.tvscroll').screenshot({ path: `e2e/screens/spill-lane-${lang}.png` });
  });
}
