/**
 * **Three Composer fields stop asking you to type what the product already
 * knows — and the control that lets them do it without taking the box away**
 * (owner ruling D11, `TASK-three-more-composer-fields-need-a-picker-and-a-picker-that`).
 *
 * ── WHAT ONLY A BROWSER CAN SAY HERE ──────────────────────────────────────
 *
 * `test/ui/palette-screen.test.ts` proves `findingOptions`, `packOptions` and
 * `narrowedOptions` compute the right lists. It cannot prove that a single
 * `<option>` reached a `<datalist>`, that the list FOLLOWS the `id` beside it
 * when that changes, or that the sentence under the box says which of the four
 * empty states the reader is looking at — all three are DOM glue, which that
 * suite's own header says it does not test.
 *
 * ── THE FOUR THINGS A PLAUSIBLE BUILD GETS WRONG ──────────────────────────
 *
 *  1. **A `<select>`.** `ack --clear` withdraws a ruling whose code doctor no
 *     longer reports (`cmdAck`: `if (!clear && !reported.includes(code))` —
 *     `--clear` is exempt from the vocabulary), and `init --pack` takes any
 *     path on disk. A closed picker composes a NARROWER command than the CLI
 *     accepts, which is the regression `--tags` was protected from in D10 for
 *     the same reason in a different shape. So this file asserts, in the
 *     browser, that a value the list does not carry still composes.
 *  2. **An unnarrowed list.** `ack <id> <code>` refuses a code doctor does not
 *     report on THAT item. A `finding` list holding every code in the corpus
 *     would offer, for any given item, mostly commands the CLI will refuse.
 *     Asserted against `/api/doctor` itself, fetched from the page, so the
 *     claim is "the same answer the command will get" rather than a fixture.
 *  3. **A silent empty list.** A `<datalist>` is invisible until the box is
 *     focused, so "no id chosen yet", "still reading", "read failed" and "this
 *     corpus has none" are one silence. Four states, four sentences, and the
 *     one the reader can act on — pick the id first — is asserted by name.
 *  4. **The width defect, reintroduced.** `label.small select` is capped at
 *     260px in `styles.css` because a 942-option `<select>`'s min-content IS
 *     its max-content and it opened the page to 3,902px. This screen now draws
 *     an `<input>` beside that `<select>`, so the guard is re-measured here:
 *     `main` must not scroll horizontally with `ack`'s form on screen.
 */
import { expect, test } from './app.ts';
import type { Page } from '@playwright/test';

const PALETTE = '[data-p="palette"]';

/**
 * How long a poll waits for a lazy suggestion list.
 *
 * Playwright's default is 5s and it is not enough here, which is a fact about
 * the READ and not about the control: `/api/doctor` runs the whole check suite
 * — 650-1,011 ms measured single-threaded on this repository's own corpus — and
 * this suite runs four workers, so four of those runs can be in flight at once
 * against one machine. A tighter bound fails as "the list never filled", which
 * reads exactly like the narrowing being broken.
 */
const DOCTOR_WAIT = { timeout: 20_000 };

/** Everything the `finding` box is claiming, read in one pass. */
async function suggest(page: Page, name: string): Promise<{
  tag: string; list: string; klass: string; options: string[]; hints: string[];
  note: string; value: string; direction: string; bidi: string;
}> {
  return page.evaluate((field) => {
    const box = document.querySelector<HTMLInputElement>(
      `[data-p="palette"] input[list="sugg-${field}"]`);
    const list = document.getElementById(`sugg-${field}`);
    // The note is the `.aside` that follows the datalist, which is how
    // `build()` places them — asserted by position rather than by an id,
    // because the position is the claim (this note belongs to this box).
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
    };
  }, name);
}

/** The composed line the Arguments card is showing. */
async function composed(page: Page): Promise<string> {
  return page.evaluate(() =>
    [...document.querySelectorAll('[data-p="palette"] .chip')].map((c) => c.textContent ?? '')
      .join(' '));
}

async function pick(page: Page, command: string): Promise<void> {
  await page.evaluate(() => { location.hash = '#/palette'; });
  const picker = page.locator(`${PALETTE} select`).first();
  // 30s and not the 15s the other specs spend on a control: this screen's five
  // fatal reads include `/api/items` over the whole fixture corpus, and the
  // FIRST test in a worker pays a cold server on top of it. A timeout here
  // reports "the Composer never drew", which is a different failure from the
  // one every assertion below is about.
  await picker.waitFor({ state: 'visible', timeout: 30_000 });
  await picker.selectOption(command);
  // **The command picker being on screen does not mean the FORM is.**
  // `render()` appends the picker, then awaits `/api/glob` for the tester's
  // file list, and only then calls `build()` — so there is a real window in
  // which the picker is visible and the def's controls do not exist yet. A
  // spec that read a control in that window failed as "MISSING", which reads
  // exactly like the control not having been built at all. The argv chips are
  // written by `recompose()` at the end of `build()`, so one of them on screen
  // is the form having been drawn.
  await page.locator(`${PALETTE} .chip`).first().waitFor({ state: 'visible', timeout: 30_000 });
}

test('ack offers the codes doctor reports on the item beside it, and no others', async ({ app }) => {
  const { page } = app;
  await pick(page, 'ack');

  // 1. It is a BOX with a list, not a picker. The class is `.suggin` — which
  //    joins `.tagin`'s own selector list, the treatment this product already
  //    declares for "a machine value taken by hand: mono, LTR and isolated".
  const before = await suggest(page, 'finding');
  expect(before.tag, 'a <select> here would take the --clear escape hatch away').toBe('INPUT');
  expect(before.list).toBe('sugg-finding');
  expect(before.klass).toContain('suggin');

  // 2. Nothing is offered before an id is chosen, and the sentence says which
  //    of the four empties this is. TWO of them are legitimate at this instant
  //    and the test says so rather than pinning a race: `/api/doctor` is
  //    fetched only because this def asked for it, so on a cold screen the
  //    honest sentence is "reading", and it becomes "choose id first" when the
  //    650-1,011 ms answer lands. Asserting one would fail on the other for a
  //    reason that is the feature working.
  expect(before.options).toEqual([]);
  await expect.poll(async () => (await suggest(page, 'finding')).note,
    { message: 'the box never settled on the sentence for "nothing chosen yet"' })
    .toMatch(/id/);
  const settled = await suggest(page, 'finding');
  expect(settled.note.toLowerCase()).toContain('first');
  expect(settled.options, 'an unnarrowed list would offer codes `ack` refuses for any id')
    .toEqual([]);

  // 3. The list is the command's own vocabulary. `/api/doctor` is asked from
  //    the page, through the page's own credential, so this compares the
  //    screen against the endpoint rather than against a remembered fixture.
  const reported = await page.evaluate(async () => {
    const body = await (await fetch('/api/doctor', { credentials: 'same-origin' })).json();
    const byItem = new Map<string, string[]>();
    for (const f of body.findings as { code: string; item?: string; about?: string }[]) {
      if (typeof f.about === 'string') continue;
      if (typeof f.item !== 'string' || f.item === '') continue;
      const codes = byItem.get(f.item) ?? [];
      if (!codes.includes(f.code)) codes.push(f.code);
      byItem.set(f.item, codes);
    }
    // An item the Composer's own `id` picker can actually select, so this is a
    // command a reader could really compose and not a corpus fact alone.
    // The ids the `id` box OFFERS, read off its own `<datalist>`. It was a
    // `<select>` until 2026-09-07 and this read was `select.options`; the
    // ruling that made it a box did not change what "an id this reader could
    // pick" means, only where the options live.
    const offered = new Set([...document.querySelectorAll<HTMLOptionElement>(
      '#sugg-id option')].map((o) => o.value));
    const chosen = [...byItem.entries()].find(([id]) => offered.has(id));
    return chosen === undefined ? null : { id: chosen[0], codes: chosen[1] };
  });
  expect(reported, 'the fixture corpus reports no finding on any selectable item — '
    + 'this spec measures nothing without one').not.toBeNull();

  const idBox = page.locator(`${PALETTE} input[list="sugg-id"]`).first();
  await idBox.fill(reported!.id);
  await expect.poll(async () => (await suggest(page, 'finding')).options.length, DOCTOR_WAIT)
    .toBeGreaterThan(0);

  const filled = await suggest(page, 'finding');
  expect(filled.options.sort(), 'the list must be exactly what `ack <id> <code>` will accept')
    .toEqual([...reported!.codes].sort());
  // The level rides as the hint, so the box says which kind of thing is being
  // settled without a second read.
  for (const hint of filled.hints) expect(['error', 'warn', 'info']).toContain(hint);
  expect(filled.note).toContain(String(reported!.codes.length));

  // 4. Picking one composes the command. `fill` and not `selectOption` — the
  //    control is an input, and what a datalist pick does to it is set `.value`
  //    and fire `input`, which is exactly what this is.
  await page.locator(`${PALETTE} input[list="sugg-finding"]`).fill(reported!.codes[0]!);
  const line = await composed(page);
  expect(line).toContain(reported!.id);
  expect(line).toContain(reported!.codes[0]!);

  // 5. THE ESCAPE HATCH. A code doctor does not report on this item still
  //    composes, because `ack --clear` needs exactly that and a picker would
  //    have refused it. This is the whole reason the field is a box.
  const orphan = 'a_check_that_was_retired';
  expect(filled.options).not.toContain(orphan);
  await page.locator(`${PALETTE} input[list="sugg-finding"]`).fill(orphan);
  expect(await composed(page)).toContain(orphan);

  // 6. The width guard. `styles.css` caps `label.small select` at 260px because
  //    a 942-option picker opened this page to 3,902px; the new control must not
  //    put it back.
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    return { scroll: main.scrollWidth, client: main.clientWidth };
  });
  expect(overflow.scroll, `main scrolls ${overflow.scroll}px against ${overflow.client}px`)
    .toBeLessThanOrEqual(overflow.client + 1);
});

test('the suggestion list follows the id it depends on, and empties with it', async ({ app }) => {
  const { page } = app;
  await pick(page, 'ack');

  const pairs = await page.evaluate(async () => {
    const body = await (await fetch('/api/doctor', { credentials: 'same-origin' })).json();
    const byItem = new Map<string, string[]>();
    for (const f of body.findings as { code: string; item?: string; about?: string }[]) {
      if (typeof f.about === 'string' || typeof f.item !== 'string' || f.item === '') continue;
      const codes = byItem.get(f.item) ?? [];
      if (!codes.includes(f.code)) codes.push(f.code);
      byItem.set(f.item, codes);
    }
    // The ids the `id` box OFFERS, read off its own `<datalist>`. It was a
    // `<select>` until 2026-09-07 and this read was `select.options`; the
    // ruling that made it a box did not change what "an id this reader could
    // pick" means, only where the options live.
    const offered = new Set([...document.querySelectorAll<HTMLOptionElement>(
      '#sugg-id option')].map((o) => o.value));
    // TWO items whose reported codes DIFFER, so "the list changed" cannot pass
    // by accident on two items that happen to carry the same finding.
    const usable = [...byItem.entries()].filter(([id]) => offered.has(id));
    for (const [idA, codesA] of usable) {
      const other = usable.find(([idB, codesB]) =>
        idB !== idA && [...codesB].sort().join() !== [...codesA].sort().join());
      if (other !== undefined) return { a: { id: idA, codes: codesA }, b: { id: other[0], codes: other[1] } };
    }
    return null;
  });
  expect(pairs, 'need two items with different reported codes to measure the narrowing')
    .not.toBeNull();

  const idBox = page.locator(`${PALETTE} input[list="sugg-id"]`).first();
  await idBox.fill(pairs!.a.id);
  await expect.poll(async () => (await suggest(page, 'finding')).options.sort().join(), DOCTOR_WAIT)
    .toBe([...pairs!.a.codes].sort().join());

  await idBox.fill(pairs!.b.id);
  await expect.poll(async () => (await suggest(page, 'finding')).options.sort().join(), DOCTOR_WAIT)
    .toBe([...pairs!.b.codes].sort().join());

  // Back to nothing chosen: the list empties rather than keeping the last
  // item's codes, which would be offering an answer to a question nobody asked.
  await idBox.fill('');
  await expect.poll(async () => (await suggest(page, 'finding')).options.length).toBe(0);
});

test('the box is reachable and pickable from the keyboard alone', async ({ app }) => {
  const { page } = app;
  await pick(page, 'ack');

  // **This is the constraint the ruling named**: a `<select>` is in the tab
  // order and keyboard-operable for free, and a `div[role="combobox"]` is not —
  // it owes arrow/Home/End/type-ahead, `aria-activedescendant` and a popup that
  // opens on the right side under RTL, all hand-written. An `<input list>` owes
  // none of it, and this test is what turns that claim into a measurement.
  const idBox = page.locator(`${PALETTE} input[list="sugg-id"]`).first();
  const found = await page.evaluate(async () => {
    const body = await (await fetch('/api/doctor', { credentials: 'same-origin' })).json();
    // The ids the `id` box OFFERS, read off its own `<datalist>`. It was a
    // `<select>` until 2026-09-07 and this read was `select.options`; the
    // ruling that made it a box did not change what "an id this reader could
    // pick" means, only where the options live.
    const offered = new Set([...document.querySelectorAll<HTMLOptionElement>(
      '#sugg-id option')].map((o) => o.value));
    const hit = (body.findings as { code: string; item?: string; about?: string }[])
      .find((f) => typeof f.about !== 'string' && typeof f.item === 'string'
        && f.item !== '' && offered.has(f.item));
    return hit === undefined ? null : { id: hit.item!, code: hit.code };
  });
  expect(found).not.toBeNull();
  await idBox.fill(found!.id);
  await expect.poll(async () => (await suggest(page, 'finding')).options.length, DOCTOR_WAIT)
    .toBeGreaterThan(0);

  // Reached by TAB from the control before it — never by a click.
  await idBox.focus();
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    return { tag: el?.tagName ?? '', list: el?.getAttribute('list') ?? '' };
  });
  expect(focused, 'Tab from `id` must land on the finding box').toEqual(
    { tag: 'INPUT', list: 'sugg-finding' });

  // **The browser has ACCEPTED the wiring**, which is the strongest thing an
  // automated test can say about a `<datalist>` and is worth more than the
  // attribute being present: `HTMLInputElement.list` is an IDL property that
  // resolves to the element only when the id names a real `<datalist>` in the
  // same tree. A typo in `suggestListId`, a datalist appended outside the form,
  // or a duplicate id all leave the attribute intact and this null.
  const wired = await page.evaluate(() => {
    const box = document.querySelector<HTMLInputElement>(
      '[data-p="palette"] input[list="sugg-finding"]')!;
    return { id: box.list?.id ?? null, options: box.list?.options.length ?? -1 };
  });
  expect(wired.id, 'the datalist is not associated — the popup would never open')
    .toBe('sugg-finding');
  expect(wired.options).toBeGreaterThan(0);

  // ── WHAT THIS TEST DELIBERATELY DOES NOT ASSERT, AND WHY ────────────────
  //
  // Pressing ArrowDown twice and Enter, which is how a person takes a
  // suggestion, does NOT move the value under automation. Measured 2026-09-06
  // in BOTH projects and headed as well as headless: the value stays `''`
  // while the datalist holds two options. That is not a defect in this
  // control — the suggestion popup is UA chrome painted outside the page, so
  // CDP-synthesised key events never reach it, and a Playwright screenshot
  // cannot photograph it either. Asserting it would mean asserting something
  // false about the product to make a test pass.
  //
  // What IS asserted instead is the whole of what the page owns: the box is in
  // the tab order, the list is associated and populated, and setting the value
  // — which is exactly what a UA pick does, `.value` plus an `input` event —
  // composes the command.
  await page.locator(`${PALETTE} input[list="sugg-finding"]`).fill(found!.code);
  expect(await composed(page)).toContain(found!.code);
});

test('the check suite is read only when a field asks for it', async ({ app }) => {
  const { page } = app;
  const asked: string[] = [];
  page.on('request', (request) => {
    const path = new URL(request.url()).pathname;
    if (path === '/api/doctor' || path === '/api/packs') asked.push(path);
  });

  // Measured on this repository 2026-09-06: `/api/doctor` answers in
  // 650-1,011 ms because it runs the whole check suite, against 15-74 ms for
  // every other read this screen makes. A reader who is not composing `ack`
  // must not pay it, and "must not" is only a claim until something counts.
  //
  // **`ack` is `PALETTE[0]`, so ARRIVING on this screen draws its form.** That
  // is why "fetched when the control is built" is not lazy at all, and why the
  // first pass of this feature failed here rather than in review.
  await pick(page, 'ack');
  await pick(page, 'list');
  await page.waitForTimeout(500);
  expect(asked, 'landing on the Composer made it run the whole check suite')
    .toEqual([]);

  // It IS read the moment the field is USED — here by answering the id it is
  // narrowed by, which is unambiguous intent to compose this command.
  await pick(page, 'ack');
  const idBox = page.locator(`${PALETTE} input[list="sugg-id"]`).first();
  const id = await idBox.evaluate((box) =>
    (box as HTMLInputElement).list?.options[0]?.value ?? '');
  expect(id, 'the id box offers nothing, so nothing here measures the trigger')
    .not.toBe('');
  await idBox.fill(id);
  await expect.poll(async () => asked.filter((p) => p === '/api/doctor').length, DOCTOR_WAIT).toBe(1);

  // And exactly once for the visit: switching away and back must not re-run a
  // 650 ms check suite, which is the cost the architecture review flagged about
  // the id picker with a much bigger constant.
  await pick(page, 'list');
  await pick(page, 'ack');
  await page.locator(`${PALETTE} input[list="sugg-id"]`).first().fill(id);
  await page.locator(`${PALETTE} input[list="sugg-finding"]`).focus();
  await page.waitForTimeout(500);
  expect(asked.filter((p) => p === '/api/doctor').length).toBe(1);
});

test('init --pack offers the artefact locations this workspace imported from', async ({ app }) => {
  const { page } = app;
  await pick(page, 'init');

  const served = await page.evaluate(async () => {
    const body = await (await fetch('/api/packs', { credentials: 'same-origin' })).json();
    return [...new Set((body.packs as { source?: string }[])
      .map((p) => p.source).filter((s): s is string => typeof s === 'string' && s !== ''))];
  });

  // Before the cursor arrives the list has not been asked for, and the note
  // says so rather than claiming this corpus has nothing.
  const idle = await suggest(page, 'pack');
  expect(idle.tag).toBe('INPUT');
  expect(idle.options).toEqual([]);
  expect(idle.note.length, 'an unasked list must still say what it is').toBeGreaterThan(0);

  await page.locator(`${PALETTE} input[list="sugg-pack"]`).focus();
  await expect.poll(async () => (await suggest(page, 'pack')).options.length, DOCTOR_WAIT)
    .toBe(served.length);
  const box = await suggest(page, 'pack');
  expect(box.options.sort()).toEqual([...served].sort());
  // Empty and non-empty are DIFFERENT SENTENCES, and both say the box still
  // works — `--pack` takes any path and this list can only ever be a hint.
  if (served.length === 0) expect(box.note.toLowerCase()).toContain('type');
  else expect(box.note).toContain(String(served.length));

  // Whatever the list holds, a path outside it composes.
  await page.locator(`${PALETTE} input[list="sugg-pack"]`).fill('../packs/somewhere-else');
  expect(await composed(page)).toContain('../packs/somewhere-else');
});

test('the suggestion box is Hebrew prose around an LTR value, and still fills', async ({ app }) => {
  const { page } = app;
  await pick(page, 'ack');
  // `#lang` RELOADS the page (`app.js`: `location.reload()` beside the toggle),
  // so this is a fresh document and not a re-render — which is exactly why the
  // list has to be proved to fill again below rather than assumed to survive.
  await page.click('#lang');
  await expect(page.locator('html')).toHaveAttribute('lang', 'he');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await pick(page, 'ack');
  const he = await suggest(page, 'finding');
  expect(he.tag).toBe('INPUT');
  // The note is TRANSLATED, not the English sentence left standing. Asserted as
  // "contains a Hebrew letter" rather than as the sentence itself: pinning the
  // wording here would make every copy edit a red spec in another file's
  // subject, and `strings-parity.test.ts` already holds the key sets equal.
  expect(he.note, 'the aside under the box must be Hebrew on a Hebrew page')
    .toMatch(/[֐-׿]/);
  // And the BOX is still a machine value: LTR and isolated inside RTL prose, so
  // a doctor code with an underscore cannot reorder the sentence around it.
  expect(he.direction).toBe('ltr');
  expect(he.bidi).toMatch(/isolate/);

  // The list still fills in Hebrew — the narrowing is not a side effect of the
  // English render path.
  const reported = await page.evaluate(async () => {
    const body = await (await fetch('/api/doctor', { credentials: 'same-origin' })).json();
    // The ids the `id` box OFFERS, read off its own `<datalist>`. It was a
    // `<select>` until 2026-09-07 and this read was `select.options`; the
    // ruling that made it a box did not change what "an id this reader could
    // pick" means, only where the options live.
    const offered = new Set([...document.querySelectorAll<HTMLOptionElement>(
      '#sugg-id option')].map((o) => o.value));
    const hit = (body.findings as { code: string; item?: string; about?: string }[])
      .find((f) => typeof f.about !== 'string' && typeof f.item === 'string'
        && f.item !== '' && offered.has(f.item));
    return hit === undefined ? null : { id: hit.item!, code: hit.code };
  });
  expect(reported).not.toBeNull();
  await page.locator(`${PALETTE} input[list="sugg-id"]`).first().fill(reported!.id);
  await expect.poll(async () => (await suggest(page, 'finding')).options, DOCTOR_WAIT)
    .toContain(reported!.code);

  // The width guard again, under RTL: a Hebrew page lays the same controls out
  // on the other axis origin and a box that overflowed would overflow the
  // other way.
  const overflow = await page.evaluate(() => {
    const main = document.querySelector('main')!;
    return { scroll: main.scrollWidth, client: main.clientWidth };
  });
  expect(overflow.scroll).toBeLessThanOrEqual(overflow.client + 1);
});
