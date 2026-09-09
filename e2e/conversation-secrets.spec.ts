// @basis TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never,
// INV-nothing-is-dropped-silently,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **The form with checkboxes, driven in a real browser** — `plan:archive
 * seq:46`, step 3, in the owner's own words: *"we'll show the user a form with
 * checkboxes and user could mark what to be replaced if it required."*
 *
 * ── WHY THIS EXISTS AS WELL AS THE `node --test` FILES ────────────────────
 *
 * They prove the endpoint and the arithmetic. This proves the SCREEN, and the
 * three things it proves are things no unit test can see:
 *
 *   1. **NOTHING IS TICKED, in the DOM the reader actually gets.** Asserted as
 *      a count of `:checked` inputs, not as a field on a payload. This is the
 *      owner's rule — an export he did not read must be byte-faithful — at the
 *      one place a form could break it by being helpful, and a form that
 *      pre-ticked "the obvious ones" would look thoughtful and be wrong.
 *   2. **The command appears only when something is ticked, and carries
 *      exactly what was ticked.** The composed line is read off the page, so
 *      "the screen composes and the CLI runs" is a measurement rather than a
 *      claim about a function.
 *   3. **No credential is in the PANEL.** The panel is read back whole and
 *      asserted not to contain the values planted in the transcript. The
 *      transcript below it DOES draw them, and must — `plan:archive seq:27` is
 *      closed on the ruling that a viewer which hid what `cat` already printed
 *      would be lying about the record it claims to be. What is new here is
 *      the derived list, so the derived list is what must not hold a value.
 *
 * **Every credential in this file is synthetic** and says `NOT-REAL` in its
 * own body. Nothing is read out of the live corpus or a real transcript.
 *
 * The server is the suite's own `startUiChild` on its own port and
 * `CLAUDE_CONFIG_DIR` points at a throwaway home, so the owner's server on
 * 58888 and his real transcripts are untouched.
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
import { MIRROR_DIR_ENV } from '../src/core/conversation-mirror.ts';

const DIRTY = 'sess-secrets-dirty';
const CLEAN = 'sess-secrets-clean';

/** Synthetic. Neither is a real credential; both are shaped so the scan proposes them. */
const FAKE_KEY = 'sk-ant-api03-NOT-REAL-3333333333333333333333';
const FAKE_TOKEN = 'ghp_NOTREALNOTREALNOTREALNOTREAL3333';

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 17, 0, s)).toISOString();

let harness: UiHarness;
let cwd: string;
let home: string;
let kept: string;

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'e2e-secr-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'e2e-secr-cwd-'));
  kept = mkdtempSync(path.join(tmpdir(), 'e2e-secr-store-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });

  // A session with two DISTINCT values, one of them twice — so the list has
  // something to count and something to get wrong.
  writeFileSync(path.join(dir, `${DIRTY}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: `call it with ${FAKE_KEY}` }, timestamp: at(0) },
    { type: 'assistant', message: { role: 'assistant', content: text(`and ${FAKE_TOKEN} for the repo`) }, timestamp: at(1) },
    { type: 'user', message: { role: 'user', content: `still ${FAKE_KEY} here` }, timestamp: at(2) },
  ]));

  // And one with nothing credential-shaped in it, so the measured zero has a
  // document of its own to be drawn on.
  writeFileSync(path.join(dir, `${CLEAN}.jsonl`), jsonl([
    { type: 'user', message: { role: 'user', content: 'nothing interesting in this one' }, timestamp: at(10) },
    { type: 'assistant', message: { role: 'assistant', content: text('nothing here either') }, timestamp: at(11) },
  ]));

  process.env['CLAUDE_CONFIG_DIR'] = home;
  process.env[MIRROR_DIR_ENV] = kept;
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
  delete process.env[MIRROR_DIR_ENV];
  if (cwd) removeTree(cwd);
  if (home) removeTree(home);
  if (kept) removeTree(kept);
});

/** Open one session's document, in one language, and open the fold. */
async function openDoc(page: Page, session: string, lang: 'en' | 'he' = 'en'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness.port);
  await page.goto(`http://127.0.0.1:${harness.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await page.evaluate((h) => { location.hash = h as string; }, `#/conversations/${session}`);
  await page.waitForSelector('details.convsecrets', { timeout: 20_000 });
  await expect(page.locator('#exited')).toBeHidden();
}

/**
 * **THE FOLD IS CLOSED ON ARRIVAL, AND THE SCAN HAS NOT RUN.**
 *
 * It costs a read of the whole session — 2.6 s on the owner's 83.6 MB live
 * one, measured 2026-09-09 — and a reader who came to read a conversation did
 * not ask for it. A `<details>` that arrived open would spend that on every
 * document opened, for ever, on behalf of a question nobody asked.
 */
test('the fold arrives closed, and opening it is what runs the scan', async ({ page }) => {
  await openDoc(page, DIRTY);
  const fold = page.locator('details.convsecrets');
  expect(await fold.evaluate((el) => (el as HTMLDetailsElement).open)).toBe(false);
  await expect(page.locator('.convsecr')).toHaveCount(0);

  await fold.locator('summary').click();
  await expect(page.locator('.convsecr')).toHaveCount(2, { timeout: 20_000 });
});

/**
 * The load-bearing test of this file. It is a COUNT of checked inputs in the
 * DOM the reader is given, because "nothing is ticked by default" is a claim
 * about the picture and not about a payload.
 */
test('nothing is ticked, and no command is offered until something is', async ({ page }) => {
  await openDoc(page, DIRTY);
  await page.locator('details.convsecrets summary').click();
  await expect(page.locator('.convsecr')).toHaveCount(2, { timeout: 20_000 });

  await expect(page.locator('.convsecrtick:checked')).toHaveCount(0);
  await expect(page.locator('.convsecrnothing')).toHaveCount(1);
  await expect(page.locator('.convsecrcmd .cmd')).toHaveCount(0);

  // One tick, and the line appears carrying that id and no other.
  const first = page.locator('.convsecrtick').first();
  const id = await first.inputValue();
  await first.check();
  await expect(page.locator('.convsecrcmd .cmd code')).toHaveCount(1);
  const line = await page.locator('.convsecrcmd .cmd code').innerText();
  expect(line).toContain('conversation persist');
  expect(line).toContain('--replace');
  expect(line).toContain(id);
  const other = await page.locator('.convsecrtick').nth(1).inputValue();
  expect(line).not.toContain(other);

  // And unticking takes it back. A choice that could only ever grow would be a
  // form that decides for the reader one click at a time.
  await first.uncheck();
  await expect(page.locator('.convsecrcmd .cmd')).toHaveCount(0);
  await expect(page.locator('.convsecrnothing')).toHaveCount(1);

  await page.screenshot({ path: 'e2e/screens/conversation-secrets-en.png' });
});

/**
 * **NO CREDENTIAL IS IN THE PANEL.** The whole panel is read back — the fold
 * open, both candidates drawn, a box ticked and the command composed — and
 * neither planted value appears anywhere in it.
 *
 * **THE PANEL, and deliberately not the page.** The transcript below it draws
 * the conversation itself, and the conversation is where these values were
 * planted, so the document renders them — as it must. `plan:archive seq:27`
 * is closed on exactly that ruling in the owner's own words: the content is
 * his, the same bytes are already in a file in his home, and a viewer that
 * hid what `cat` already printed would be lying about the record it claims to
 * be. What this feature adds is a SECOND COPY at a stable path outside the
 * project, and this panel is where a person decides what goes into it. So the
 * assertion that means something is about the panel: the thing that must not
 * hold a credential is the LIST OF CANDIDATES, because that list is derived,
 * is new, and would be new exposure.
 */
test('the panel shows a mask and never a value', async ({ page }) => {
  await openDoc(page, DIRTY);
  await page.locator('details.convsecrets summary').click();
  await expect(page.locator('.convsecr')).toHaveCount(2, { timeout: 20_000 });
  await page.locator('.convsecrtick').first().check();

  const shown = await page.locator('details.convsecrets').innerText();
  expect(shown).not.toContain('sk-ant-api03-NOT-REAL-3333333333333333333333');
  expect(shown).not.toContain('ghp_NOTREALNOTREALNOTREALNOTREAL3333');
  // The mask is still informative — the prefix is what tells one vendor from
  // another, and the count is what tells a real credential from a one-off.
  expect(shown).toContain('sk-a');
  expect(shown).toContain('2 times');
  // And the stand-in is shown BEFORE the choice, not discovered afterwards.
  expect(shown).toMatch(/FAKE-anthropic-key-[0-9a-f]{12}-NOT-A-REAL-VALUE/);
});

/**
 * A session where nothing matched draws the measured zero and says it is not a
 * promise — `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`,
 * and the half of it this feature most needs: a credential that looks like an
 * ordinary word is missed by every shape, and a clean list that read as a
 * clean session would be exactly the silent reassurance the design refuses.
 */
test('a session with nothing credential-shaped draws the zero and disclaims it', async ({ page }) => {
  await openDoc(page, CLEAN);
  await page.locator('details.convsecrets summary').click();
  await expect(page.locator('.convsecrnone')).toHaveCount(1, { timeout: 20_000 });
  await expect(page.locator('.convsecr')).toHaveCount(0);
  const shown = await page.locator('.convsecrnone').innerText();
  expect(shown).toContain('NOT a promise');
});

/**
 * The panel in Hebrew, RTL. Not a translation check — `strings-parity` does
 * that — but the check this project keeps finding real defects with: that the
 * screen is drawn at all in the other direction, with its controls present.
 */
test('the form is drawn in Hebrew, right to left', async ({ page }) => {
  await openDoc(page, DIRTY, 'he');
  await page.locator('details.convsecrets summary').click();
  await expect(page.locator('.convsecr')).toHaveCount(2, { timeout: 20_000 });
  await expect(page.locator('.convsecrtick:checked')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dir)).toBe('rtl');
  await page.locator('.convsecrtick').first().check();
  await expect(page.locator('.convsecrcmd .cmd code')).toHaveCount(1);
  // The COMMAND is never translated, and it is asserted WHOLE rather than by
  // a substring: it is a shell line a reader copies into a terminal, so what
  // has to survive the RTL page is the BYTES, and a bidi reordering that lost
  // the space before `--replace` would be invisible in a `toContain`.
  const id = await page.locator('.convsecrtick').first().inputValue();
  expect(await page.locator('.convsecrcmd .cmd code').innerText())
    .toBe(`mycontext conversation persist ${DIRTY} --replace ${id}`);
  await page.screenshot({ path: 'e2e/screens/conversation-secrets-he.png' });
});
