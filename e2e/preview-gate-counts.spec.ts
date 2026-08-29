/**
 * `plan:walk seq:80` — **every rung of the gate ladder says HOW MANY items
 * fail at it**, driven in a real browser against the real app.
 *
 * ── THE DEFECT, AND WHY A COUNT IS THE WHOLE OF THE FIX ────────────────────
 *
 * Owner report, 2026-08-29: *"the why not in injection preview shows only 3
 * items, spill had much more."* Measured on the live corpus of 673 items, the
 * picker offered three names and behind them stood
 *
 *     rung 1  eligible   13 items
 *     rung 2  tier      551 items
 *     rung 6  budget      1 item
 *
 * 564 failures, three names, and not one number anywhere on the card. A
 * specimen presented without its population reads as the whole set — one name
 * standing silently for 551 — which is
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` in a new
 * place.
 *
 * **The picker is not the defect and is deliberately unchanged.** One exemplar
 * per rung is the design, argued in `preview.js` itself: offering every failing
 * item would be a picker of 139 names, and the ladder is a diagnosis of ONE
 * item by construction. What was missing was the population, not a bigger
 * strip.
 *
 * ── WHY THIS TEST COMPARES AGAINST THE WIRE, NOT AGAINST A NUMBER ─────────
 *
 * A fixture with three items at each rung would prove nothing: the whole defect
 * is that 1 and 551 look identical when neither is drawn, and a test asserting
 * "a number appears" passes over a screen that draws the same number six times.
 *
 * So the ladder is recomputed HERE from the three payloads the screen itself
 * reads — `/api/items`' `gate`, `Selection.focus.hidden`, `seenFiltered` and
 * `Selection.spilled` — and every rung's drawn count is compared to its own
 * source. A count that came from the wrong rung, a count that is the corpus
 * size, and a count that is stale from the previous selection all fail
 * separately. The re-derivation is the ladder read off the WIRE rather than off
 * the module, which is the point: the two must agree.
 *
 * ── AND THE THREE THINGS A COUNT ALONE WOULD STILL GET WRONG ──────────────
 *
 *   1. **A rung with zero failures must SAY zero.** Blank is the failure mode
 *      this whole family of defects has, so a rung nothing fails at draws a
 *      measured zero in words.
 *   2. **Rung 4 must not draw a zero at all.** The per-event `matchesScope`
 *      refusal is served by no endpoint, so what that gate excludes is
 *      unmeasured rather than none, and the rung says so in those words.
 *   3. **A rung whose ids are reachable must be openable.** Rungs 1, 2 and 3
 *      list their population under the ladder; rungs 5 and 6 are already named
 *      in full under `Not delivered` and point there rather than drawing the
 *      same ids twice.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';

/** `parts.js` · `BOUND_CAP_LIST` — the display cap every list here is bounded by. */
const BOUND_CAP_LIST = 20;

/**
 * **The preview section, and only the one that is showing.**
 *
 * `route()` keeps every visited screen inside `#screen`, merely hidden, so an
 * unscoped `#gates` can read a screen nobody is looking at. This walk has
 * already produced two wrong measurements today for exactly that reason.
 */
const screen = (page: Page) => page.locator('#screen section[data-p="preview"]:not([hidden])');

/** The six gate codes, in `GATE_LADDER`'s order — the order the ladder draws. */
const GATES = ['eligible', 'tier', 'focus', 'scope', 'seen', 'budget'] as const;

interface Wire {
  items: { id: string; gate: string }[];
  hidden: string[];
  seenFiltered: string[];
  spilled: string[];
}

/**
 * The three answers the screen composed its ladder from, fetched through the
 * page's OWN door — `window.myctx.api` and `/lib/viewmodel.js`'s `selectQuery`.
 *
 * A second HTTP client in the test authenticates differently and could succeed
 * where the app fails, and a hand-written query string is a DIFFERENT question:
 * the screen sends the SELECTED session, and a cold one has a different seen
 * ledger and therefore a different rung 5.
 */
function wire(page: Page, event: string, path: string | null): Promise<Wire> {
  return page.evaluate(async ([ev, p]) => {
    const load = (specifier: string): Promise<Record<string, unknown>> => import(specifier);
    const vm = await load('/lib/viewmodel.js') as unknown as {
      selectQuery: (event: string, path: string | null, session: string) => string;
    };
    const ctx = (window as unknown as {
      myctx: { session: () => string; api: (r: string) => Promise<unknown> };
    }).myctx;
    const qs = vm.selectQuery(ev as string, p as string | null, ctx.session());
    const items = await ctx.api('/api/items') as { items: { id: string; gate: string }[] };
    const selection = await ctx.api(`/api/select?${qs}`) as {
      focus: { hidden: string[] } | null; spilled: { id: string }[];
    };
    const sim = await ctx.api(`/api/simulate?${qs}`) as { seenFiltered?: string[] };
    return {
      items: items.items.map((i) => ({ id: i.id, gate: i.gate })),
      hidden: selection.focus === null ? [] : selection.focus.hidden,
      seenFiltered: sim.seenFiltered ?? [],
      spilled: selection.spilled.map((s) => s.id),
    };
  }, [event, path] as const);
}

/**
 * **`preview.js`'s `rungOf`, recomputed from the wire.** Six lines, in ladder
 * order, because the order IS the partition: an item hidden by focus AND
 * unaffordable belongs to rung 3, which is where `select` would have stopped.
 */
function expectedCounts(w: Wire): number[] {
  const hidden = new Set(w.hidden);
  const seen = new Set(w.seenFiltered);
  const spilled = new Set(w.spilled);
  const counts = [0, 0, 0, 0, 0, 0];
  for (const item of w.items) {
    if (item.gate === 'eligible') counts[0]! += 1;
    else if (item.gate === 'tier') counts[1]! += 1;
    else if (hidden.has(item.id)) counts[2]! += 1;
    else if (item.gate === 'scope') counts[3]! += 1;
    else if (seen.has(item.id)) counts[4]! += 1;
    else if (spilled.has(item.id)) counts[5]! += 1;
  }
  return counts;
}

/**
 * **Wait for the LANDING RENDER before asking the page anything.**
 *
 * The house pattern on this screen (`preview-spilled.spec.ts`'s `toolEvent`),
 * and for the reason recorded there: the preview's own boot render awaits
 * `/api/select`, `/api/simulate` and `/api/items` together, and driving or
 * reading the screen while that wave is in flight measures a screen still
 * building. Fifteen seconds rather than the default five, matching
 * `e2e/app.ts`'s own wait on the rail: this suite runs several servers over one
 * corpus and a first paint genuinely takes longer than five seconds under that
 * contention — measured here, as `#gates .rung` resolving to 0 for the whole
 * five while the endpoints answered perfectly well.
 */
async function landed(page: Page): Promise<void> {
  await expect(
    screen(page).locator('#gates .rung'),
    'the landing render never drew the gate ladder, so everything below would be measuring '
    + 'a screen that is still building',
  ).toHaveCount(6, { timeout: 15_000 });
}

/** The tally sentence each rung leads with — the first `<span>` of its `.q` cell. */
const tallies = (page: Page): Promise<string[]> =>
  screen(page).locator('#gates .rung').evaluateAll(
    (rungs) => rungs.map((r) => r.querySelector('.q > span')?.textContent?.trim() ?? ''),
  );

/** The leading count in a tally sentence, or `null` where it names no number. */
function drawn(sentence: string): number | null {
  const hit = /^([\d,]+) item/.exec(sentence);
  return hit === null ? null : Number(hit[1]!.replaceAll(',', ''));
}

test('every rung carries the count of items that fail there, names its specimen with it, and opens the rungs whose ids are reachable', async ({ app }) => {
  const { page } = app;
  await landed(page);

  const served = await wire(page, 'session-start', null);
  const counts = expectedCounts(served);
  const said = await tallies(page);

  // Reported rather than only asserted: this is the measurement the task is
  // for, and it is what a reader of the run learns the corpus's shape from.
  const table = GATES.map((g, i) => `rung ${i + 1} ${g}=${counts[i]}`).join(' · ');
  console.log(`[gate ladder] ${table}`);
  test.info().annotations.push({ type: 'gate counts', description: table });

  for (const [i, gate] of GATES.entries()) {
    const sentence = said[i]!;
    if (i === 3) {
      // Rung 4 never takes a plain number and never takes a zero: the
      // per-event refusal is on no endpoint, so its population is part
      // measured and part unmeasured, and the sentence has to say which.
      expect(sentence, `rung 4 (${gate}) must name its unknown rather than draw a zero`)
        .toMatch(/at the item level/);
      expect(sentence).toMatch(/unmeasured/);
      expect(drawn(sentence), 'and it still reports the half that IS measured')
        .toBe(counts[3]);
      continue;
    }
    if (counts[i] === 0) {
      expect(sentence, `rung ${i + 1} (${gate}) fails nothing and must say so, not go blank`)
        .toMatch(/^No item fails at this gate\./);
      continue;
    }
    expect(drawn(sentence), `rung ${i + 1} (${gate}) must report its own population`)
      .toBe(counts[i]);
  }

  // **The counts are per-rung facts, not one number repeated.** The defect was
  // that 1 and 551 looked identical because neither was drawn; a screen that
  // drew the corpus size on every rung would satisfy "a number appears" and
  // fail here.
  const measured = counts.filter((n) => n > 0);
  expect(measured.length, 'the fixture must fail at least one gate to be measuring anything')
    .toBeGreaterThan(0);
  const total = counts.reduce((sum, n) => sum + n, 0);
  expect(total, 'and no rung may claim the whole corpus')
    .toBeLessThanOrEqual(served.items.length);

  // ── THE PICKER NAMES EACH SPECIMEN WITH THE SIZE OF WHAT IT STANDS FOR ──
  //
  // **Folded into this test rather than given its own**, and the reason is the
  // harness rather than the subject: every `test` starts its own UI server over
  // one shared corpus, and this suite's own known contention — several servers
  // reading `.audit/audit.db` while a sibling writes it — is what makes a
  // preview render fail outright. Four fixtures for four readings of one
  // landing render bought four chances at that and no extra coverage; the
  // assertions below are unchanged and are made against the same render.
  //
  // The strip holds one exemplar per rung that has any failure — unchanged, and
  // the ruling this task did not re-open.
  const failing = counts.flatMap((n, i) => (n > 0 ? [i] : []));

  const buttons = screen(page).locator('#gatepick button');
  await expect(buttons, 'one button per rung that anything fails at, and no more')
    .toHaveCount(failing.length);

  const labels = await buttons.evaluateAll((all) => all.map((b) => ({
    id: b.querySelector('.v')?.textContent?.trim() ?? '',
    tally: b.querySelector('.small')?.textContent?.trim() ?? '',
  })));
  for (const [slot, rung] of failing.entries()) {
    const label = labels[slot]!;
    expect(label.id, 'a button still names one specimen by id').not.toBe('');
    const hit = /first of ([\d,]+)/.exec(label.tally);
    expect(hit, `the button for rung ${rung + 1} must say how many it stands for, and said `
      + `"${label.tally}"`).not.toBeNull();
    expect(Number(hit![1]!.replaceAll(',', '')), `rung ${rung + 1}'s button count`)
      .toBe(counts[rung]);
    if (rung === 3) {
      expect(label.tally, 'rung 4 names its number as the measured half only')
        .toMatch(/measured/);
    }
  }

  // ── AND A RUNG WHOSE IDS ARE REACHABLE OPENS ITS LIST ──────────────────
  //
  // Same render, same reason as above.
  const rows = screen(page).locator('#gateRows .row');
  for (const [slot, rung] of failing.entries()) {
    await buttons.nth(slot).click();
    // Rungs 1, 2 and 3 are named nowhere else on this screen and are listed
    // here. Rungs 5 and 6 are already named in full under `Not delivered` —
    // with the tier and the price a bare id could not carry — and rung 4's
    // population is only half measured, so neither draws a list.
    if (rung <= 2) {
      const shown = Math.min(counts[rung]!, BOUND_CAP_LIST);
      await expect(rows, `rung ${rung + 1} lists its population, bounded at ${BOUND_CAP_LIST}`)
        .toHaveCount(shown);
      const ids = await rows.evaluateAll((all) => all.map((r) => r.getAttribute('data-id') ?? ''));
      expect(ids.every((id) => id !== ''),
        'every row names its item, so the shell\'s delegated handler can open the pane')
        .toBe(true);
      // The house's one bounded list, in the order that claims nothing about
      // why these ids are in this sequence — they are in `/api/items`' id order.
      const bound = screen(page).locator('#gateRows ~ .bound p').first();
      await expect(bound).toHaveText(counts[rung]! > BOUND_CAP_LIST
        ? new RegExp(`Showing the first ${BOUND_CAP_LIST} of ${counts[rung]}\\.`)
        : new RegExp(`Showing all ${counts[rung]}\\.`));
      continue;
    }
    await expect(rows, `rung ${rung + 1} draws no list of its own`).toHaveCount(0);
    const sentence = (await tallies(page))[rung]!;
    if (rung === 3) expect(sentence).toMatch(/no list of them can be drawn here/);
    else expect(sentence, `rung ${rung + 1} must say where its list already is`)
      .toMatch(/Not delivered/);
  }
});

/**
 * **The counts follow the SELECTION.** Rungs 3, 5 and 6 are read out of the
 * answer to the reader's own question, so driving the event to a tool event
 * against a real path re-asks it — and a card that reported the same numbers
 * for both would be the stability the owner reported as blindness, one axis
 * along from the picker.
 */
test('the counts are re-read when the question moves', async ({ app }) => {
  const { page } = app;
  await landed(page);
  const landing = await tallies(page);

  await page.selectOption('#evsel', 'tool');
  await expect(screen(page).locator('#pathsel')).toBeVisible();
  const path = await page.locator('#pathsel option').first().getAttribute('value');
  expect(path, 'the fixture must offer a file to preview a tool event against').not.toBeNull();
  await page.selectOption('#pathsel', path!);

  const counts = expectedCounts(await wire(page, 'tool', path));
  await expect
    .poll(async () => (await tallies(page)).map(drawn), {
      message: 'the ladder must report the tool event\'s own population, not the landing one',
    })
    .toEqual(counts.map((n, i) => (n === 0 && i !== 3 ? null : n)));

  // Said out loud, because a test that measured two identical answers would
  // pass while proving nothing about movement.
  const after = await tallies(page);
  console.log(`[gate ladder · tool ${path}] `
    + `${GATES.map((g, i) => `rung ${i + 1} ${g}=${counts[i]}`).join(' · ')}`);
  if (JSON.stringify(after) === JSON.stringify(landing)) {
    test.info().annotations.push({
      type: 'unmeasured',
      description: 'this corpus answers the session-start and the tool event with the same '
        + 'ladder, so the movement of the counts went unmeasured on this run — the equality '
        + 'against the tool event\'s own payload above still held',
    });
  }
});
