/**
 * **The `key` field — the last of D11's three — and the sentence it has to say
 * when every candidate has already been ruled on**
 * (`TASK-three-more-composer-fields-need-a-picker-and-a-picker-that`,
 * `plan:builder seq:10`).
 *
 * ── WHY THIS FIELD WAS THE ONE D11 COULD NOT BUILD ────────────────────────
 *
 * The ruling described `key` as *"the staged lesson's own keys — already
 * fetched for the `id` picker sitting next to it, so the data is on the page
 * already"*. Neither half was true: `id` was `input: 'text'` with no picker
 * beside it, and nothing in this server served a staged lesson at all, because
 * `listStaging` lived in `lesson/derive.ts` which value-imports `createItem`
 * from `core/mutate.ts` — the boundary `test/ui/no-writes.test.ts` enforces.
 * `GET /api/staging` and `lesson/staging.ts` are that boundary answered, and
 * this file is the wiring on the other side of it.
 *
 * ── WHAT ONLY A BROWSER CAN SAY HERE ──────────────────────────────────────
 *
 * `test/ui/palette-screen.test.ts` proves `stagingLessonOptions`,
 * `stagingKeyOptions`, `narrowedOptions` and `offeredAway` compute the right
 * lists — including, against the real endpoint over this repository's own
 * staging directory, that every candidate here is `accepted`. It cannot prove
 * that two boxes were drawn, that ONE fetch fills both of them, that the `key`
 * list follows the `id` beside it, or that the reader is told WHICH empty they
 * are looking at. All four are DOM glue, which that suite's header says it does
 * not test.
 *
 * ── THE DEFECT THIS FILE EXISTS TO CATCH ──────────────────────────────────
 *
 * **An empty control and a broken endpoint look identical.** Measured on this
 * repository 2026-09-07: five staging files, eleven candidates, ALL ELEVEN
 * `accepted` — zero pending, zero discarded. `lesson-accept` refuses an
 * accepted or discarded candidate and `lesson-discard` refuses an accepted
 * one, so a list filtered to what either command will actually take offers
 * NOTHING on this corpus. A box that drew that silence would be
 * indistinguishable from `/api/staging` returning 500, and the reader would
 * conclude the wrong thing about their own corpus. So the screen has to SAY
 * *"every candidate here has already been ruled on"*, and that sentence is
 * what this file is mostly about.
 *
 * ── WHY ONE TEST STUBS THE ENDPOINT, SAID PLAINLY ─────────────────────────
 *
 * `.demo-corpus` — the fixture every spec here runs against, for
 * `e2e/app.ts`'s stated reasons — has NO `.staging` directory at all, so it can
 * only ever reach the "nothing is staged anywhere" state. That state is
 * asserted first, unstubbed, because it is what the served corpus really
 * answers. The ruled-on state is then reached by routing `/api/staging` to
 * **the real endpoint's real answer over this repository's own staging
 * files**, computed in Node by calling `apiStaging` itself: the body is not
 * invented, it is the one `mycontext ui` serves in this checkout, carried to a
 * page whose corpus does not have it. What is stubbed is WHICH corpus answers,
 * never WHAT the answer looks like.
 */
import { expect, test } from './app.ts';
import type { Page } from '@playwright/test';
import path from 'node:path';
import { apiStaging } from '../src/ui/read-model-staging.ts';

const PALETTE = '[data-p="palette"]';
const SHOTS = path.join(import.meta.dirname, '..', 'test-results', 'composer-staging');

/**
 * `GET /api/staging`'s REAL answer over this repository's own corpus.
 *
 * Read through `apiStaging` rather than by parsing `.staging/*.json` here, so
 * the body a routed test hands the page is byte-for-byte the shape the server
 * produces — including `counts`, `skipped` and `malformed`, which a
 * hand-written fixture would have quietly omitted. `projectRoot` is the
 * `.my_context` directory itself, not the repository root: `stagingDir` is
 * `path.join(root, '.staging')`.
 *
 * A READ. `apiStaging` writes nothing, which is `test/ui/no-writes.test.ts`'s
 * subject, so this needs no workspace of its own.
 */
function realStagingBody(): {
  lessons: { lessonId: string; pending: number; candidates: number }[];
  candidates: { key: string; lessonId: string; state: string; title: string }[];
  counts: { pending: number; accepted: number; discarded: number };
} {
  const root = path.join(import.meta.dirname, '..', '.my_context');
  const answer = apiStaging({ projectRoot: root } as never, new URL('http://x/api/staging'));
  return answer.body as never;
}

/** Everything one `suggest` box is claiming, read in one pass. */
async function suggest(page: Page, name: string): Promise<{
  tag: string; list: string; klass: string; options: string[]; hints: string[];
  note: string; value: string; direction: string; bidi: string; wired: string | null;
}> {
  return page.evaluate((field) => {
    const box = document.querySelector<HTMLInputElement>(
      `[data-p="palette"] input[list="sugg-${field}"]`);
    const list = document.getElementById(`sugg-${field}`);
    const note = list?.nextElementSibling;
    const style = box === null ? null : getComputedStyle(box);
    return {
      tag: box === null ? 'MISSING' : box.tagName,
      list: box?.getAttribute('list') ?? '',
      klass: box?.className ?? '',
      options: [...(list?.querySelectorAll('option') ?? [])].map((o) => o.value),
      hints: [...(list?.querySelectorAll('option') ?? [])].map((o) => o.textContent ?? ''),
      note: note?.textContent ?? '',
      value: box?.value ?? '',
      direction: style?.direction ?? '',
      bidi: style?.unicodeBidi ?? '',
      // The IDL property, which resolves only when the id names a real
      // `<datalist>` in the same tree — the attribute alone survives a typo.
      wired: box?.list?.id ?? null,
    };
  }, name);
}

/** The composed line the Arguments card is showing. */
async function composed(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-p="palette"] .chip')].map((c) => c.textContent ?? '')
      .join(' '));
}

/** Drive the Composer to one command, and wait for its FORM rather than its picker. */
async function pick(page: Page, command: string): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator(`${PALETTE} select`).first();
  await picker.waitFor({ state: 'visible', timeout: 30_000 });
  await picker.selectOption(command);
  // The picker being visible does not mean the form is: `render()` awaits
  // `/api/glob` between them. An argv chip is `build()` having finished.
  await page.locator(`${PALETTE} .chip`).first().waitFor({ state: 'visible', timeout: 30_000 });
}

test('both lesson fields are boxes, and the served corpus says it has nothing staged', async ({ app }) => {
  const { page } = app;
  const asked: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname === '/api/staging') asked.push('/api/staging');
  });

  await pick(page, 'lesson-accept');

  // 1. TWO boxes, not two pickers and not the two bare text inputs these were
  //    before the endpoint landed. `.suggin` is the treatment this product
  //    already declares for a machine value taken by hand — mono, LTR and
  //    bidi-isolated — which a lesson id and a candidate key both are.
  const id = await suggest(page, 'id');
  const key = await suggest(page, 'key');
  expect(id.tag, 'the lesson id must be a box with a list').toBe('INPUT');
  expect(key.tag, 'the key must be a box with a list').toBe('INPUT');
  expect(id.klass).toContain('suggin');
  expect(key.klass).toContain('suggin');
  expect(id.wired, 'the id datalist is not associated — its popup would never open')
    .toBe('sugg-id');
  expect(key.wired).toBe('sugg-key');

  // 2. Nothing is fetched by ARRIVING. `/api/staging` walks a directory, and
  //    the rule this screen already keeps for `/api/doctor` and `/api/packs`
  //    is that a read is paid by the reader who asked for it.
  await page.waitForTimeout(300);
  expect(asked, 'drawing the form fetched the staging directory').toEqual([]);

  // 3. The `key` box says "answer the id first" and NOT "there is nothing" —
  //    with no lesson chosen there is nothing to narrow BY, so an unnarrowed
  //    list would be offering the wrong thing rather than nothing.
  expect(key.options).toEqual([]);
  expect(key.note.toLowerCase()).toContain('id');
  expect(key.note.toLowerCase()).toContain('first');

  // 4. The cursor arriving in the id box IS the ask, and it fetches ONCE —
  //    `stagingLessons` and `stagingKeys` are two sources out of one body, and
  //    a second GET here would be the same five files read twice.
  await page.locator(`${PALETTE} input[list="sugg-id"]`).focus();
  await expect.poll(async () => (await suggest(page, 'id')).note,
    { message: 'the id box never settled on a sentence' })
    .not.toMatch(/load when you use/i);
  await page.waitForTimeout(300);
  expect(asked.length, 'two sources out of one body must be one read').toBe(1);

  // 5. **This corpus really has none**, and the box says so in the sentence for
  //    an empty list rather than by drawing an invisible one. `.demo-corpus`
  //    has no `.staging` directory at all — `e2e/app.ts` explains why the
  //    fixture is what it is — so this is the honest answer here.
  const served = await page.evaluate(async () =>
    (await (await fetch('/api/staging', { credentials: 'same-origin' })).json()).lessons.length);
  const settled = await suggest(page, 'id');
  expect(settled.options.length).toBe(served);
  if (served === 0) {
    expect(settled.note.toLowerCase(),
      'an empty list must still say the command composes').toContain('type');
  } else {
    expect(settled.note).toContain(String(served));
  }

  // 6. And it still composes. Both fields are hints and neither is a
  //    vocabulary: `lesson-accept` refuses an unknown lesson ("nothing staged
  //    for …") and an unknown key ("staging for … has no candidate"), so the
  //    refusal lives where it can see the disk.
  await page.locator(`${PALETTE} input[list="sugg-id"]`).fill('LESSON-typed-by-hand');
  await page.locator(`${PALETTE} input[list="sugg-key"]`).fill('a-key-nobody-staged');
  const line = await composed(page);
  expect(line).toContain('LESSON-typed-by-hand');
  expect(line).toContain('a-key-nobody-staged');

  await page.screenshot({ path: path.join(SHOTS, 'en-empty-corpus.png'), fullPage: true });
});

test('with candidates on the wire, the key box says they have all been ruled on', async ({ app }) => {
  const { page } = app;
  const body = realStagingBody();
  test.skip(body.lessons.length === 0,
    'this repository stages no lesson candidates, so there is no ruled-on state to drive');

  await page.route('**/api/staging', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
  }));
  await pick(page, 'lesson-accept');

  // The id list is the lessons this workspace has staging for, in the
  // endpoint's own order, and carries NO count in the hint: a `<datalist>`
  // draws `value` + `hint`, and a count phrase there would be English prose
  // standing in a Hebrew page.
  await page.locator(`${PALETTE} input[list="sugg-id"]`).focus();
  await expect.poll(async () => (await suggest(page, 'id')).options.length,
    { message: 'the id list never filled from the routed body' })
    .toBe(body.lessons.length);
  const ids = await suggest(page, 'id');
  expect(ids.options).toEqual(body.lessons.map((l) => l.lessonId));
  expect([...new Set(ids.hints)]).toEqual(['']);

  // **THE STATE THIS TEST EXISTS FOR.** Every candidate on this corpus is
  // `accepted`, and both commands refuse one — so the filtered list is empty
  // AND the reader is told why, with the number of candidates that exist.
  const lesson = body.lessons[0]!;
  const mine = body.candidates.filter((c) => c.lessonId === lesson.lessonId);
  const takeable = mine.filter((c) => c.state === 'pending');
  await page.locator(`${PALETTE} input[list="sugg-id"]`).fill(lesson.lessonId);

  await expect.poll(async () => (await suggest(page, 'key')).note,
    { message: 'the key box never moved off "choose the id first"' })
    .not.toMatch(/first/i);
  const keys = await suggest(page, 'key');
  expect(keys.options, 'the key list must be exactly what the command will accept')
    .toEqual(takeable.map((c) => c.key));

  if (takeable.length === 0) {
    // The whole point: NOT the generic "this corpus has nothing to offer",
    // which is also what a broken endpoint would produce.
    expect(keys.note, 'an empty key box must name the ruling, not shrug')
      .toContain(String(mine.length));
    expect(keys.note.toLowerCase()).toMatch(/accepted|discarded/);
    expect(keys.note.toLowerCase(),
      'the ruled-on sentence must not be the generic empty one')
      .not.toContain('nothing to offer');
  } else {
    expect(keys.note).toContain(String(takeable.length));
    expect(keys.hints, 'the candidate title is what a reader chooses between')
      .toEqual(takeable.map((c) => c.title));
  }

  // The escape hatch, which is why this is a box: a key the list does not
  // carry still composes, and the CLI is what refuses it.
  const ruled = mine[0]!.key;
  expect(keys.options).not.toContain(ruled);
  await page.locator(`${PALETTE} input[list="sugg-key"]`).fill(ruled);
  const line = await composed(page);
  expect(line).toContain(lesson.lessonId);
  expect(line).toContain(ruled);

  // The width guard the whole D11 control choice turns on: `label.small select`
  // is capped at 260px because a 942-option `<select>`'s min-content IS its
  // max-content and it opened this page to 3,902px. Two more boxes must not
  // put it back.
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    return { scroll: main.scrollWidth, client: main.clientWidth };
  });
  expect(overflow.scroll, `main scrolls ${overflow.scroll}px against ${overflow.client}px`)
    .toBeLessThanOrEqual(overflow.client + 1);

  await page.screenshot({ path: path.join(SHOTS, 'en-ruled-on.png'), fullPage: true });
});

test('lesson-discard filters the same way, and both boxes are Hebrew prose around LTR values', async ({ app }) => {
  const { page } = app;
  const body = realStagingBody();
  test.skip(body.lessons.length === 0, 'no staged candidates to drive');

  await page.route('**/api/staging', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body),
  }));

  // `#lang` RELOADS the page, so this is a fresh document — which is exactly
  // why the lists are proved to fill again below rather than assumed to
  // survive. The route survives the reload; it is bound to the page.
  await pick(page, 'lesson-discard');
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await pick(page, 'lesson-discard');

  const lesson = body.lessons[0]!;
  const mine = body.candidates.filter((c) => c.lessonId === lesson.lessonId);
  const takeable = mine.filter((c) => c.state === 'pending');

  await page.locator(`${PALETTE} input[list="sugg-id"]`).focus();
  await expect.poll(async () => (await suggest(page, 'id')).options.length)
    .toBe(body.lessons.length);
  await page.locator(`${PALETTE} input[list="sugg-id"]`).fill(lesson.lessonId);
  await expect.poll(async () => (await suggest(page, 'key')).note).not.toMatch(/first/i);

  const keys = await suggest(page, 'key');
  expect(keys.options, '`lesson-discard` refuses an accepted candidate too')
    .toEqual(takeable.map((c) => c.key));
  // TRANSLATED, not the English sentence left standing. Asserted as "carries a
  // Hebrew letter" rather than as the wording: pinning the sentence here would
  // make every copy edit a red spec in another file's subject, and
  // `strings-parity.test.ts` already holds the key sets equal.
  expect(keys.note, 'the sentence under the key box must be Hebrew on a Hebrew page')
    .toMatch(/[֐-׿]/);
  if (takeable.length === 0) expect(keys.note).toContain(String(mine.length));

  // The BOXES stay machine values: LTR and isolated inside RTL prose, so a
  // lesson id full of hyphens cannot reorder the Hebrew around it.
  const id = await suggest(page, 'id');
  expect(id.direction).toBe('ltr');
  expect(id.bidi).toMatch(/isolate/);
  expect(keys.direction).toBe('ltr');
  expect(keys.bidi).toMatch(/isolate/);

  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    return { scroll: main.scrollWidth, client: main.clientWidth };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);

  await page.screenshot({ path: path.join(SHOTS, 'he-ruled-on.png'), fullPage: true });
});

/**
 * **The id field across the nine commands that take one** — builder/16's half,
 * measured where the defect was: the page's own width.
 *
 * Eleven fields sourced from `items` became boxes on 2026-09-07
 * (`TASK-a-long-picker-becomes-a-filtering-box-and-the-id-field-stops`). The
 * `<select>` they replaced is why `label.small select` is capped at 260px in
 * `styles.css`: a 942-option picker's min-content IS its max-content, and it
 * opened this page to 3,902px. An `<input>` has no such floor.
 */
test('the id field is a filtering box on every command that takes one', async ({ app }) => {
  const { page } = app;
  const widths: string[] = [];

  for (const command of ['pin', 'harden', 'supersede', 'show', 'refresh']) {
    await pick(page, command);
    const box = await suggest(page, 'id');
    expect(box.tag, `${command}'s id is not a box`).toBe('INPUT');
    expect(box.wired, `${command}'s id datalist is not associated`).toBe('sugg-id');
    // The list is the corpus's items and the hint is the title — the half a
    // `<select>`'s label used to carry and a `<datalist>` row would otherwise
    // have lost.
    expect(box.options.length, `${command} offers no ids at all`).toBeGreaterThan(0);
    expect(box.hints.filter((h) => h !== '').length,
      `${command}'s suggestions carry no titles, so a reader picks by id alone`)
      .toBeGreaterThan(0);
    const overflow = await page.evaluate(() => {
      const main = document.querySelector('main')!;
      return { scroll: main.scrollWidth, client: main.clientWidth };
    });
    widths.push(`${command}: ${overflow.scroll}/${overflow.client}`);
    expect(overflow.scroll, `${command} scrolls the page sideways: ${widths.join(', ')}`)
      .toBeLessThanOrEqual(overflow.client + 1);
  }

  // `supersede` draws TWO item boxes — `<id>` and `--by` — and they share one
  // datalist id only if `suggestListId` is wrong. Each names its own field.
  await pick(page, 'supersede');
  const by = await suggest(page, 'by');
  expect(by.tag).toBe('INPUT');
  expect(by.wired).toBe('sugg-by');

  await page.screenshot({ path: path.join(SHOTS, 'en-id-box.png'), fullPage: true });
});
