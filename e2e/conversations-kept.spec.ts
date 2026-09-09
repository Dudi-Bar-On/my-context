// @basis INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// TASK-a-pruned-session-s-lane-rows-are-never-swept-so-an-exported
/**
 * **A KEPT COPY, DRIVEN IN A REAL BROWSER** — `plan:archive seq:4`/`seq:5`.
 *
 * ── WHY THIS FILE HAD TO EXIST BEFORE ANY OF IT COULD BE SEEN ─────────────
 *
 * `e2e/conversations.spec.ts`' glyph block records, in its own words, the two
 * chips it could not reach: *"`conv.exported` (needs the export `plan:archive`
 * seq:4/5 has not shipped — `source` is hard-coded `'live'` in
 * `conversation-index.ts` today, so no row can carry it yet)"*. Three separate
 * lanes reported that chip as dead-but-not-wrong. `source` now carries three
 * values, so the chip is reachable, and a chip nobody has ever seen drawn is
 * exactly the thing this repository has twice found shipping invisible —
 * `TASK-a-chip-s-data-g-never-renders-on-six-of-the-eight-chip-kinds`, and the
 * Clear button that shipped at contrast 1.0.
 *
 * ── THE THREE STATES ARE ON ONE LIST, ON PURPOSE ──────────────────────────
 *
 * `seq:5` requires LIVE, PERSISTED AND CURRENT and PERSISTED AND ORPHANED to
 * be distinguishable AT A GLANCE and never to blur, so the fixture puts all
 * three on one screen and every assertion is a comparison between rows rather
 * than a claim about one. A test that opened three fixtures in turn would pass
 * on a screen that drew the same chip for all three.
 *
 * ── AND THE PAINT IS READ FROM THE CASCADE, NOT FROM THE MARKUP ───────────
 *
 * `.chip.carry.glyphed[data-g]` puts `⎘` in the DOM; whether the browser draws
 * it is a question about `::before` and the two-class rules that beat a
 * one-class one. So the glyph is read with `getComputedStyle(el, '::before')`,
 * which is the assertion the chip item asked for and the only one that would
 * have caught the defect it was filed about.
 *
 * The fixture is small and static: nothing here is about scrolling or
 * virtualisation, which `e2e/conversations.spec.ts` owns on a 120-round
 * document. This file asks what a reader can TELL from the screen.
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
import { MIRROR_DIR_ENV } from '../src/core/conversation-mirror.ts';

const LIVE = 'sess-kept-live';
const CURRENT = 'sess-kept-current';
const ORPHAN = 'sess-kept-orphan';

const LANE_CALL = 'toolu_KEPT_LANE';
const UNKEPT_CALL = 'toolu_KEPT_NOLANE';
const LANE_BRIEF = 'go and read the thing';
const ORPHAN_PHRASE = 'the turn that only the copy still holds';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 16, 0, s)).toISOString();

let harness: UiHarness;
let cwd: string;
let home: string;
let kept: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-kept-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-kept-cwd-'));
  kept = mkdtempSync(path.join(tmpdir(), 'e2e-kept-store-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  // 1. An ordinary session nobody asked to keep — the control.
  writeFileSync(path.join(dir, `${LIVE}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'the session nobody keeps' }, timestamp: at(0) },
    { type: 'assistant', message: { role: 'assistant', content: text('and its answer') }, timestamp: at(1) },
  ]));

  // 2. A session kept, whose transcript is still here.
  writeFileSync(path.join(dir, `${CURRENT}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'the session that is kept and still here' }, timestamp: at(10) },
    { type: 'assistant', message: { role: 'assistant', content: text('answered while both files exist') }, timestamp: at(11) },
  ]));

  // 3. A session kept, whose transcript is deleted afterwards — and which
  //    DISPATCHED A LANE, so the document has a step whose lane was never part
  //    of the copy. That is the case `seq:5` names: a link that silently does
  //    nothing is worse than one that says the lane was not included.
  writeFileSync(path.join(dir, `${ORPHAN}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'the session the harness later pruned' }, timestamp: at(20) },
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: LANE_CALL, name: 'Agent', input: { prompt: LANE_BRIEF } }],
      },
      timestamp: at(21),
    },
    // A SECOND `Agent` call whose lane this workspace never indexed — the
    // harness prunes lane transcripts far more aggressively than sessions, so
    // a dispatching turn with no lane behind it is the ordinary case and not a
    // contrivance. It is what makes the two answers below distinguishable on
    // ONE document.
    {
      type: 'assistant',
      message: {
        role: 'assistant',
        content: [{ type: 'tool_use', id: UNKEPT_CALL, name: 'Agent', input: { prompt: 'the lane nobody kept' } }],
      },
      timestamp: at(22),
    },
    { type: 'assistant', message: { role: 'assistant', content: text(ORPHAN_PHRASE) }, timestamp: at(23) },
  ]));
  const lanes = path.join(dir, ORPHAN, 'subagents');
  mkdirSync(lanes, { recursive: true });
  writeFileSync(path.join(lanes, 'agent-kept.jsonl'), jsonl([
    { type: 'user', message: { role: 'user', content: LANE_BRIEF }, timestamp: at(23) },
    { type: 'assistant', message: { role: 'assistant', content: text('read it') }, timestamp: at(24) },
  ]));
  writeFileSync(path.join(lanes, 'agent-kept.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'Read the thing', toolUseId: LANE_CALL, spawnDepth: 1,
  }));

  // A SECOND LANE, INDEXED AND THEN PRUNED — `plan:archive seq:35`, whose
  // `openableSubagents` had nothing drawing it until now.
  //
  // Its `toolUseId` matches NO step of the document on purpose: the two
  // dispatching turns above are already the subject of the last test in this
  // file, and a lane answering `UNKEPT_CALL` would turn that test's `.tvcut`
  // into a gone-link and change what it measures. This lane exists only as a
  // ROW — which is exactly the state the item is about, a row outliving the
  // file it names.
  writeFileSync(path.join(lanes, 'agent-gone.jsonl'), jsonl([
    { type: 'user', message: { role: 'user', content: 'the lane whose file goes' }, timestamp: at(25) },
    { type: 'assistant', message: { role: 'assistant', content: text('read while it was here') }, timestamp: at(26) },
  ]));
  writeFileSync(path.join(lanes, 'agent-gone.meta.json'), JSON.stringify({
    agentType: 'general-purpose', description: 'The lane whose transcript was pruned',
    toolUseId: 'toolu_KEPT_GONE', spawnDepth: 1,
  }));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  process.env[MIRROR_DIR_ENV] = kept;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    runCli(['conversation', 'rebuild'], cwd, () => {});
    runCli(['conversation', 'persist', CURRENT, '--yes'], cwd, () => {});
    runCli(['conversation', 'persist', ORPHAN, '--yes'], cwd, () => {});

    // The harness prunes the transcript. The mark is the only thing that can
    // keep the session visible now, which is the whole of `seq:5`.
    rmSync(path.join(dir, `${ORPHAN}.jsonl`));
    // And one of its two lanes goes with it. `removeMissingSubagents` is
    // scoped to sessions FOUND on disk, so the rebuild below cannot sweep this
    // row — which is `plan:archive seq:35`'s finding, not a contrivance: the
    // row stays for ever and the list must not advertise it as openable.
    rmSync(path.join(lanes, 'agent-gone.jsonl'));
    runCli(['conversation', 'rebuild'], cwd, () => {});

    // And the kept-and-present one grows AFTER the last rebuild, so the copy
    // really is behind — the ordinary state between one assistant turn and the
    // next, and the one a reader has to be able to see. A rebuild after this
    // point would advance the copy and erase the very thing under test.
    appendFileSync(path.join(dir, `${CURRENT}.jsonl`), JSON.stringify({
      type: 'user',
      message: { role: 'user', content: `typed after the copy was taken ${'.'.repeat(2000)}` },
      timestamp: at(12),
    }) + '\n');
  } finally {
    process.chdir(previous);
  }

  harness = await startUiChild(cwd);
});

test.afterAll(async () => {
  await harness?.stop();
  delete process.env['CLAUDE_CONFIG_DIR'];
  delete process.env[MIRROR_DIR_ENV];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
  if (kept) removeTree(kept);
});

/** One page load, at a hash, in one language — `conversations.spec.ts`' `open`. */
async function open(page: Page, hash: string, lang: 'en' | 'he' = 'en'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, hash);
  await page.waitForSelector('.convrow, .tvturn', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

test('three sessions, three states, and the list tells them apart', async ({ page }) => {
  await open(page, '#/conversations');
  await expect(page.locator('.convrow')).toHaveCount(3);

  // THE CHIP THAT COULD NOT BE DRAWN UNTIL NOW. Two rows carry it and one
  // does not, which is the comparison — a screen that drew it on all three
  // would pass a per-row assertion and fail the reader.
  const copies = page.locator('.convrow .chip.carry.glyphed');
  await expect(copies).toHaveCount(2);

  // And they do not say the same thing. `Exported copy` is the row whose
  // original is gone; `Kept outside the project` is the row where both files
  // exist. Blurring these is the error `seq:5` names.
  await expect(page.locator('.convrow .chip.carry.glyphed', { hasText: 'Exported copy' }))
    .toHaveCount(1);
  await expect(page.locator('.convrow .chip.carry.glyphed', { hasText: 'Kept outside' }))
    .toHaveCount(1);

  // THE PAINT, read from the cascade rather than from `data-g`. `⎘` has been
  // in this markup since seq:1 and has never once been rendered.
  const drawn = await copies.first().evaluate(
    (el) => getComputedStyle(el, '::before').content,
  );
  expect(drawn).toContain('⎘');

  // AND IT IS VISIBLE, which is a different question from being in the DOM —
  // a control shipped at contrast 1.0 passed every assertion about its class
  // on 2026-09-08. Foreground and background are compared as the browser
  // resolved them.
  const paint = await copies.first().evaluate((el) => {
    const s = getComputedStyle(el as HTMLElement);
    return { color: s.color, background: s.backgroundColor };
  });
  expect(paint.color).not.toBe(paint.background);

  await page.screenshot({ path: 'e2e/screens/conversations-kept-en.png' });
});

/**
 * The copy that is BEHIND its file says so as a number, beside the copy chip
 * and not instead of it. Two facts, two marks.
 */
test('a copy that has not caught up says how far behind it is', async ({ page }) => {
  await open(page, '#/conversations');
  const row = page.locator('.convrow').filter({ hasText: 'Kept outside' });
  await expect(row).toHaveCount(1);
  // TWO warn chips, and they say different things: the INDEX is behind the
  // file (`Behind by`) and the COPY is behind it too (`not copied yet`). They
  // are separate measurements of separate distances and neither substitutes
  // for the other, so the row is filtered rather than read as one chip.
  await expect(row.locator('.chip.warn').filter({ hasText: 'not copied yet' }))
    .toHaveCount(1);
  // The orphaned row must NOT carry it: a copy whose original is gone cannot
  // be behind anything, and saying so would be a warning about nothing.
  const orphan = page.locator('.convrow').filter({ hasText: 'Exported copy' });
  await expect(orphan.locator('.chip.warn')).toHaveCount(0);
});

/**
 * **A ROW MAY NOT ADVERTISE LANES THAT CANNOT BE OPENED** — `plan:archive
 * seq:35`, which built `openableSubagents` and left the screen drawing the raw
 * row count because `screens/conversations.js` was held by another lane.
 *
 * The two numbers are asserted TOGETHER and on one row: the count is true of
 * the recording, the second is true of the archive right now, and a screen
 * that had replaced the first with the second would pass a test that asked
 * only "does it say 1". The control is the row beside it — the live sessions
 * dispatched no lanes and must say nothing at all, because "0 helper agents"
 * on every ordinary row is the noise this clause is conditional to avoid.
 *
 * Non-vacuity, proved rather than asserted: with the `openableSubagents`
 * branch removed from `drawRow`, this test fails on `1 still on disk` and the
 * row reads `2 helper agents` alone.
 */
test('a row says how many of its lanes are still on disk, when that is fewer', async ({ page }) => {
  await open(page, '#/conversations');
  const orphan = page.locator('.convrow').filter({ hasText: 'Exported copy' });
  await expect(orphan).toHaveCount(1);

  const meta = orphan.locator('p.convmeta');
  await expect(meta).toContainText('2 helper agents');
  await expect(meta).toContainText('1 still on disk');

  // The rows whose lanes are all present say only the count — no second
  // number, because there is nothing for a reader to act on.
  const others = page.locator('.convrow').filter({ hasNotText: 'Exported copy' });
  await expect(others).toHaveCount(2);
  await expect(others.locator('p.convmeta').filter({ hasText: 'still on disk' })).toHaveCount(0);

  await page.screenshot({ path: 'e2e/screens/conversations-kept-openable-en.png' });
});

/**
 * **THE DOCUMENT, WHICH IS THE SAME VIEWER READING A DIFFERENT FILE.**
 *
 * The owner's reason for asking for `seq:5` at all: *"we could use THE SAME
 * BROWSER to go over a session even if the original file is not available
 * anymore"*. So the turn is asserted to be ON SCREEN — the copy is being read
 * and rendered, not merely listed.
 */
test('an exported conversation opens in the viewer, and says it is the copy', async ({ page }) => {
  await open(page, '#/conversations');
  await page.locator('.convrow').filter({ hasText: 'Exported copy' }).click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  await expect(page.locator('.tvscroll')).toContainText(ORPHAN_PHRASE, { timeout: 20_000 });

  // It says WHICH of the three files a reader is holding, on the page, because
  // a document opened in a tab of its own has no list beside it.
  const note = page.locator('p.tvkept');
  await expect(note).toBeVisible();
  await expect(note).toContainText('KEPT COPY');
  await expect(note).toContainText('no longer on your disk');

  // AND IT DOES NOT FOLLOW. A copy cannot grow, so polling it would ask a
  // question whose answer cannot change — and `tick`'s own replacement branch
  // would stop the document on any touch of the file's mtime.
  const follows = page.locator('p.tvfollows');
  await expect(follows).toBeVisible();
  await expect(follows).toContainText('cannot grow');
  await expect(follows).not.toContainText('every second');

  await page.screenshot({ path: 'e2e/screens/conversations-kept-doc-en.png' });
});

/**
 * **A LINK THAT SILENTLY DOES NOTHING IS WORSE THAN ONE THAT SAYS WHY** —
 * `INV-nothing-is-dropped-silently`, and `seq:5`'s own question about a lane
 * whose target was not exported.
 *
 * The fold is opened and the step that dispatched the lane is read. In a live
 * document that step carries an `a.tvlane` opening the lane in a new tab; here
 * the lane was never part of the copy, so what it carries is a sentence saying
 * so — and NOT a link, which is the half that would be a lie.
 */
test('a dispatching step with no lane behind it says so, in a copy', async ({ page }) => {
  await open(page, '#/conversations');
  await page.locator('.convrow').filter({ hasText: 'Exported copy' }).click();
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });

  // The `Agent` call is promoted out of the fold only for shell commands and
  // questions, so this one is inside a `work` fold: open it. `<details>` is a
  // real element and clicking its summary is how a reader opens it.
  const fold = page.locator('.tvscroll details').first();
  await expect(fold).toBeVisible({ timeout: 20_000 });
  await fold.locator('summary.tvworksum').click();
  await expect(fold).toHaveJSProperty('open', true);

  // TWO dispatching steps, TWO different answers, in one fold. The lane whose
  // transcript is still on disk keeps its link — a copy does not make a
  // readable file unreadable — and the one this workspace never indexed says
  // so instead of drawing nothing.
  await expect(fold.locator('a.tvlane')).toHaveCount(1);
  await expect(fold.locator('.tvcut')).toHaveCount(1);
  await expect(fold.locator('.tvcut')).toContainText('not in the copy');
});
