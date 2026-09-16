// @basis TASK-typing-three-dots-finds-half-of-what-it-should-and-a-hit-you,
// INV-nothing-is-dropped-silently,
// REQ-the-conversation-archive-is-a-terminal-you-can-scroll-not-a
/**
 * **THE FIND BAR'S BROWSER HALF** — `semantic/8`, owner ruling 2026-09-16:
 * *"every found search result in my viewer should be highlited"*.
 *
 * ── WHY THIS CANNOT BE A `node --test` FILE ──────────────────────────────
 *
 * Everything asserted here is a fact about a LIVE LAYOUT. `CSS.highlights` is
 * a browser registry, a `Range` is a position in a rendered tree, and the one
 * claim the whole design rests on — *a highlight survives the virtualiser
 * recycling the row it is in* — is only meaningful where rows are really
 * evicted and really rebuilt. `test/ui/fold.test.ts` owns the matcher and
 * `test/core/conversation-search.test.ts` owns the scan; what is left is
 * exactly the part a screenshot would not catch.
 *
 * ── THE FIXTURE, AND WHAT EACH PART OF IT IS FOR ─────────────────────────
 *
 *   — **It contains `…` and never `...`.** That is the removal proof for
 *     the folding, carried by the fixture itself: a build that dropped
 *     `.normalize('NFKD')` has nothing at all to find, so the assertion
 *     cannot pass for the wrong reason.
 *   — **It is 60 long turns.** The document virtualises on height, so a
 *     fixture of four short turns would draw every row at once and the
 *     eviction test would assert nothing. The turns are long enough that the
 *     rows on screen are a small part of them.
 *   — **One turn is Hebrew**, because half this corpus is and the find bar is
 *     driven in both languages below.
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

const SESSION = 'sess-find';
/** The character this product writes 3,062 times and nobody types. */
const ELLIPSIS = '…';
/** A Hebrew word this fixture carries, with the glued front particle beside it. */
const HEB = 'שורה';
const HEB_GLUED = `ה${HEB}`;

let harness: UiHarness | undefined;
let cwd = '';
let home = '';

function transcript(): unknown[] {
  const at = (n: number): string => new Date(Date.UTC(2026, 8, 9, 6, 0, n)).toISOString();
  const rows: unknown[] = [{ type: 'ai-title', aiTitle: 'A session to find things in' }];
  const filler = 'This turn is long enough that the scroll has to virtualise it. '.repeat(24);
  for (let i = 0; i < 60; i += 1) {
    rows.push({
      type: 'user',
      message: { role: 'user', content: `question ${i} about the archive` },
      timestamp: at(i * 2),
      gitBranch: 'master',
    });
    const body = i % 5 === 0
      ? `${filler}the head of it${ELLIPSIS}and the rest of answer ${i}. ${filler}`
      : `${filler}answer ${i} with nothing in particular to find. ${filler}`;
    rows.push({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: body }] },
      timestamp: at(i * 2 + 1),
    });
  }
  // The Hebrew turn, carrying the bare word and the glued form.
  rows.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: `${filler}${HEB_GLUED} וגם ${HEB}. ${filler}` }],
    },
    timestamp: at(200),
  });
  /*
   * **THE PARAGRAPH BOUNDARY.** A row's text is read by walking its text
   * nodes and JOINING them, because Markdown splits a sentence the moment it
   * carries emphasis. Joined blindly, the last word of one paragraph and the
   * first of the next become one string and `zebraquagga` would be "found" in
   * a gap that has no text in it. These two paragraphs are that trap, and the
   * test below asserts the trap is not sprung.
   */
  rows.push({
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: `${filler}ends with zebra

quagga begins it. ${filler}` }],
    },
    timestamp: at(202),
  });
  return rows;
}

test.beforeAll(async () => {
  home = mkdtempSync(path.join(tmpdir(), 'myctx-find-home-'));
  cwd = mkdtempSync(path.join(tmpdir(), 'myctx-find-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${SESSION}.jsonl`),
    `${transcript().map((r) => JSON.stringify(r)).join('\n')}\n`,
  );
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    runCli(['init'], cwd, () => {});
    // `conversation rebuild` builds the PROSE INDEX as well as the rows, and
    // the find endpoint reads that index rather than the transcript.
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

/** The code-skew banner, dismissed the way a person would. */
async function dismissSkew(page: Page): Promise<void> {
  const skew = page.locator('#exited:not([hidden])');
  if (await skew.isVisible().catch(() => false)) {
    await skew.locator('button').first().click().catch(() => {});
  }
}

async function openDocument(page: Page, lang: 'en' | 'he'): Promise<void> {
  await page.addInitScript((l) => {
    try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
  }, lang);
  const nonce = await mintNonce(harness!.port);
  await page.goto(`http://127.0.0.1:${harness!.port}/#${nonce}`);
  await page.waitForSelector('.rail', { timeout: 20_000 });
  await dismissSkew(page);
  await page.evaluate((s) => { location.hash = `#/conversations/${s}`; }, SESSION);
  await page.waitForSelector('.tvscroll .tvturn', { timeout: 20_000 });
  await dismissSkew(page);
}

/** What the page has registered to paint, read out of the browser's own registry. */
async function painted(page: Page): Promise<{ texts: string[]; live: boolean; collapsed: number }> {
  return page.evaluate(() => {
    const ranges = [...(CSS.highlights.get('mycontextfind') ?? [])] as Range[];
    return {
      texts: ranges.map((r) => r.toString()),
      live: ranges.every((r) => r.startContainer.isConnected && r.startContainer.nodeType === 3),
      collapsed: ranges.filter((r) => r.collapsed).length,
    };
  });
}

/** Type into the find box and wait past the 250 ms settle and the scan. */
async function find(page: Page, query: string): Promise<void> {
  await page.locator('.tvfind').click();
  await page.locator('.tvfind').fill(query);
  // Past the 250 ms settle, the round trip and the scan.
  await page.waitForTimeout(2_500);
}

for (const lang of ['en', 'he'] as const) {
  test(`typing three dots highlights the ellipsis the archive wrote (${lang})`, async ({ page }) => {
    await openDocument(page, lang);

    // THE REMOVAL PROOF, TAKEN IN THE BROWSER: the drawn document holds no
    // literal `...` anywhere, so nothing below can pass without the folding.
    const literal = await page.locator('.tvscroll').evaluate(
      (el) => (el.textContent ?? '').includes('...'),
    );
    expect(literal, 'the fixture must carry no literal three dots').toBe(false);

    await find(page, '...');
    const hits = await painted(page);
    expect(hits.texts.length).toBeGreaterThan(0);
    expect(new Set(hits.texts)).toEqual(new Set([ELLIPSIS]));
    expect(hits.live, 'every painted range is a live text node').toBe(true);
    expect(hits.collapsed).toBe(0);
  });

  test(`the count says what it counts, over the whole transcript (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await find(page, '...');

    // 12 of the 60 answers carry the ellipsis (every fifth, 0..55), and that
    // is a number no walk of the DOM could reach: the rows are not all drawn.
    const drawn = await page.locator('.tvrow').count();
    const line = (await page.locator('p.tvcount').textContent()) ?? '';
    /*
     * **READ AS WHOLE NUMBERS, NOT AS SUBSTRINGS.** The first draft of this
     * test asserted `toContain('12')` on a line that also carries `121`, so
     * it could not fail — the count could have been anything and the string
     * `121` would have satisfied it. Every number on the line is pulled out
     * and compared as a number instead.
     */
    const numbers = [...line.matchAll(/\d+/g)].map((m) => Number(m[0]));
    expect(numbers, 'twelve answers in sixty carry the ellipsis').toContain(12);
    // 60 questions + 60 answers + the Hebrew turn + the paragraph turn. It is
    // written out rather than derived so that a fixture change has to come
    // here and say what it did to the scope this line discloses.
    expect(numbers, 'and the line says how many turns of words were read').toContain(122);
    expect(drawn, 'and fewer rows than that are on the screen').toBeLessThan(12);

    // The stepper's own counter is the short form of the same number, and it
    // is read the same way for the same reason.
    const short = (await page.locator('.tvnavfoundcount').textContent()) ?? '';
    expect([...short.matchAll(/\d+/g)].map((m) => Number(m[0]))).toEqual([12]);
  });

  test(`the stepper walks the matches and says where it is (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await find(page, '...');
    // The sentence is "Match {n} of {total}" in both languages, so the two
    // numbers in it ARE the position and the total — asserted as numbers,
    // because `toContainText('1')` is satisfied by the `12` beside it.
    const said = async (): Promise<number[]> => {
      const text = (await page.locator('.tvnavsaid').textContent()) ?? '';
      return [...text.matchAll(/\d+/g)].map((m) => Number(m[0]));
    };
    await page.locator('.tvnavfoundnext').click();
    await expect(page.locator('.tvnavsaid')).toBeVisible();
    expect(await said()).toEqual([1, 12]);
    await page.locator('.tvnavfoundnext').click();
    await expect.poll(said).toEqual([2, 12]);
    await page.locator('.tvnavfoundprev').click();
    await expect.poll(said).toEqual([1, 12]);
  });

  test(`a highlighted row scrolled out and back is highlighted again (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await find(page, '...');
    const before = await painted(page);
    expect(before.texts.length).toBeGreaterThan(0);

    // **THE CLAIM THE WHOLE DESIGN RESTS ON.** The rows really are removed
    // from the DOM here — `paint` evicts anything outside its window — and a
    // `Range` into an evicted row does NOT go inert: the DOM collapses it to
    // its former parent, so a registry kept across this would hold collapsed
    // ranges that paint nothing while `CSS.highlights.has(…)` still answers
    // true. Rebuilding from `live` on every paint is what makes this pass.
    const away = await page.locator('.tvscroll').evaluate((el) => {
      const first = el.querySelector('.tvrow');
      el.scrollTop = el.scrollHeight;
      return first !== null;
    });
    expect(away).toBe(true);
    await page.waitForTimeout(1_200);

    await page.locator('.tvscroll').evaluate((el) => { el.scrollTop = 0; });
    await page.waitForTimeout(1_200);
    const back = await painted(page);
    expect(back.texts.length).toBeGreaterThan(0);
    expect(new Set(back.texts)).toEqual(new Set([ELLIPSIS]));
    expect(back.live, 'and not one of them is a range into a row that was thrown away').toBe(true);
    expect(back.collapsed).toBe(0);
  });

  test(`a Hebrew word is found with its glued front particle (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await find(page, HEB);
    const hits = await painted(page);
    // Two: the bare word, and the one the particle is glued to. That is the
    // substring reading, which is why the index under this is `trigram` and
    // why nothing here assumes a word boundary.
    expect(hits.texts.length).toBe(2);
    expect(new Set(hits.texts)).toEqual(new Set([HEB]));
    expect(hits.live).toBe(true);
    await expect(page.locator('.tvnavfoundcount')).toContainText('1');
  });

  test(`a match cannot run from one paragraph into the next (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    // Both halves are really there, and really adjacent in the joined text —
    // so an implementation with no block rule finds this and this test reddens.
    await find(page, 'zebra');
    expect((await painted(page)).texts).toEqual(['zebra']);
    await find(page, 'quagga');
    expect((await painted(page)).texts).toEqual(['quagga']);
    await find(page, 'zebraquagga');
    expect((await painted(page)).texts, 'the gap between two paragraphs is not text').toEqual([]);
  });

  test(`clearing the box takes every highlight back down (${lang})`, async ({ page }) => {
    await openDocument(page, lang);
    await find(page, '...');
    expect((await painted(page)).texts.length).toBeGreaterThan(0);
    await find(page, '');
    const cleared = await page.evaluate(() => CSS.highlights.has('mycontextfind'));
    expect(cleared, 'the registry entry is deleted, not left holding stale ranges').toBe(false);
  });
}
