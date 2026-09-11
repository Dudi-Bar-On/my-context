// @basis TASK-five-browser-assertions-pin-a-number-that-only-holds-while,
// INSTR-testing-happens-against-the-current-corpus-and-an-exception,
// INV-nothing-is-dropped-silently
/**
 * **The Relations focus picker, in a browser, because until 2026-08-30 there
 * was nothing to see.**
 *
 * `plan:walk seq:87` said the screen owed one thing — *"NOTHING CHOOSES THE
 * FOCUS"* — and said in the same breath that it could not be judged, because
 * the corpus it then read carried no relation at all: the app drew ONE node and
 * a legend against the mockup's seven nodes and five labelled edges, and eleven
 * of graph's twelve tree-parity findings were that corpus rather than that
 * screen. A real ego graph arrived on 2026-08-30 (`plan:port seq:94`,
 * `plan:walk seq:44`), so a spec that drives the picker became writable and this
 * is it.
 *
 * ── WHAT IT MEASURES, AND WHY A NODE TEST CANNOT ──────────────────────────
 *
 * `test/ui/graph-screen.test.ts` owns everything `egoDrawing` decides — every
 * coordinate, every class, every truncation — with no `document` in the room.
 * What it cannot reach is the picker itself: a `<select>`, a `change` event and
 * a refetch are the DOM glue spec §6 names as the untested surface. So this
 * file asserts exactly the things that only exist in a browser — that the
 * control is there, that changing it changes the picture, and that the readout
 * under it names the focus it is now about rather than the one it used to be.
 *
 * **The picker is a READ and this file proves it stays one.** No POST is made,
 * no confirm is crossed, and no nonce is spent: `plan:walk seq:87`'s ruling is
 * that choosing what to look at needs no approval boundary, and the network
 * assertion below is what would notice a later edit disagreeing.
 *
 * ── NOTHING HERE WRITES AN ID OR A COUNT DOWN — `plan:archive seq:54` ──────
 *
 * Until 2026-09-10 this file opened on two constants:
 *
 *     const DEFAULT_FOCUS = 'CONST-a-correction-records-the-class-of-error-not-only-the';
 *     const OTHER_FOCUS   = 'CONST-the-pool-is-capped-at-20-connections';
 *
 * — "the first item by id in `.demo-corpus`, 60 nodes and 59 edges" and "a
 * different focus with 2 nodes and 1 edge", both MEASURED ON 2026-08-31 against
 * a corpus that was RETIRED on 2026-09-07 (`e2e/app.ts`, under
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception`).
 * Measured against this repository's own corpus on 2026-09-10: the first item
 * the picker offers is `ADR-build-rather-than-adopt` and it draws 2 nodes and 1
 * edge, and `CONST-the-pool-is-capped-at-20-connections` **is not in the corpus
 * at all** — `selectOption` timed out on an option that could never appear. All
 * four tests in this file failed, and not one of them failed about the screen.
 *
 * So every id and every count below is DERIVED from what the page is showing,
 * and what is asserted are the relations this screen's own code establishes:
 *
 *   the default is the first thing offered   `graph.js` picks
 *       `items.items.find((i) => qualifies(i) && !isRetired(i))` and the picker
 *       `fill()`s from the same predicate over the same array in the same
 *       order, so the opening value IS the first `<option>`. A default the
 *       picker does not list is the `<select>`-on-one-item / chart-on-another
 *       defect this spec caught once already, and it is caught here without
 *       naming either item.
 *
 *   the picture IS its own readout           `readout()` composes
 *       `focus · radius · nodes · edges · drawn [· filtered] · omitted`, and
 *       the SVG is drawn from the same layout object: one `<path>` per drawn
 *       edge, one `<rect>` per placed node, plus one more for `+N more`
 *       whenever anything was omitted. `paths === drawn` and
 *       `rects === nodes + (omitted ? 1 : 0)` are equalities that hold on any
 *       corpus and fail the moment a number and its picture part — which is the
 *       one thing this screen has to be trusted about.
 *
 *   the chart is centred on the id it names  `rect.node.focus` inside the
 *       `g.nodehit[data-id]` the readout states.
 *
 * A count that only holds while nobody is working is not a property of the
 * product. A count that must equal another count the same screen drew is.
 *
 * ── SCOPING, AND THE ONE SETTLE ───────────────────────────────────────────
 *
 * Every query is scoped to `[data-p="graph"]`: the router keeps every visited
 * screen inside `#screen`, merely hidden, so an unscoped `select` would find
 * the Preview screen's event picker. And the wait is `settleScreen` — six
 * hand-rolled settles were deleted from this suite and this file does not write
 * a seventh.
 *
 * `settleScreen` waits for the holding chip to go and for the in-flight set to
 * empty, which is exactly the property a refetch needs too: the `change`
 * handler's `/api/graph` request is in that set from the moment it is issued.
 * What it also needs is a `requires` that is true only AFTER the redraw — the
 * chip is long gone by then and a stable count would be satisfied by the
 * previous picture. `requires` is therefore the NEW focus's own
 * `g.nodehit[data-id="…"]`, which cannot be in the document until the new
 * response has been drawn. (It used to be `svg.chart rect.node.focus`, which
 * the OLD picture also satisfies — a settle that the state before the change
 * already answers is not a settle.)
 */
import { test, expect } from './app.ts';
import type { Locator, Page } from '@playwright/test';
import { settleScreen } from './settle.ts';

/** `text.nid` truncates at 28 characters, the mockup's own cut. */
const label = (id: string): string => (id.length > 28 ? `${id.slice(0, 27)}…` : id);

/** The numbers `readout()` composes, read back off the line the screen drew. */
interface Readout {
  focus: string;
  /** `RADIUS` in `graph.js`, and the `radius=` this screen asks `/api/graph`
   *  for. A constant of the CODE, not a fact about the corpus — which is why
   *  it is still asserted by value below where nothing else is. */
  radius: number;
  nodes: number;
  edges: number;
  drawn: number;
  filtered: number;
  omitted: number;
}

/**
 * `readout()`'s own composition (`src/ui/public/screens/graph.js`), matched
 * whole rather than searched: a readout that has stopped carrying one of its
 * fields is a readout this file must fail on, not one it should quietly read
 * four numbers out of.
 */
const READOUT =
  /^focus=(\S+) · radius=(\d+) · nodes=(\d+) · edges=(\d+) · drawn=(\d+)(?: · filtered=(\d+))? · omitted=(\d+)$/;

const readoutLine = (section: Locator): Locator =>
  section.locator('p.small').filter({ hasText: 'focus=' });

async function readoutOf(section: Locator): Promise<Readout> {
  await expect(readoutLine(section),
    'the screen drew more than one readout, or none — a second one under one chart is the '
    + 'stale-readout defect the `foot` container exists to make impossible').toHaveCount(1);
  const line = (await readoutLine(section).innerText()).trim();
  const m = READOUT.exec(line);
  expect(m, `the readout is not the line readout() composes: "${line}"`).not.toBeNull();
  return {
    focus: m![1]!,
    radius: Number(m![2]),
    nodes: Number(m![3]),
    edges: Number(m![4]),
    drawn: Number(m![5]),
    filtered: Number(m![6] ?? '0'),
    omitted: Number(m![7]),
  };
}

/** The ids the picker is OFFERING, in its own order. */
const offered = (picker: Locator): Promise<string[]> =>
  picker.locator('option')
    .evaluateAll((nodes) => nodes.map((n) => (n as HTMLOptionElement).value));

/**
 * **THE RELATION, and it is what replaced `rects > 50` and `rects === 2`.**
 *
 * Reads the readout, then requires the drawing to be the same fact. Everything
 * it compares is a pair of numbers the SCREEN produced in the same render, so
 * it is as true of a two-node corpus as of a sixty-node one — and it is false
 * the moment the count and the picture part, which no fixed number could have
 * noticed.
 */
async function picture(section: Locator): Promise<Readout> {
  const said = await readoutOf(section);
  // The one number still written down, and it is the screen's own constant
  // rather than the day's corpus: `graph.js` requests `radius=RADIUS` and
  // `readout()` states it back. A screen that quietly widened its walk would
  // otherwise be indistinguishable from a corpus that grew.
  expect(said.radius, 'the readout states a radius the screen did not ask for').toBe(1);
  await expect(
    section.locator('p.spill').filter({ hasText: 'could not place' }),
    'the ego layout could not place part of the response, so the counts below would be '
    + 'measured against a drawing already known to be short',
  ).toHaveCount(0);
  expect(await section.locator('svg.chart path').count(),
    'one <path> per drawn edge: the picture and its own `drawn=` are the same fact')
    .toBe(said.drawn);
  expect(await section.locator('svg.chart rect').count(),
    'one <rect> per node the layout placed, plus one for the `+N more` node whenever '
    + '`omitted` is not zero')
    .toBe(said.nodes + (said.omitted > 0 ? 1 : 0));
  await expect(
    section.locator(`svg.chart g.nodehit[data-id="${said.focus}"] rect.node.focus`),
    'the chart is centred on the id the readout names — a readout about one item over a '
    + 'picture of another is exactly what this screen may not do',
  ).toHaveCount(1);
  return said;
}

/** Open Relations and wait for it to have drawn a chart. */
async function openGraph(page: Page): Promise<void> {
  await page.goto(`${page.url().split('#')[0]}#/graph`);
  const settle = await settleScreen(page, 'graph', { requires: 'svg.chart' });
  expect(settle.settled,
    `the Relations screen never settled (${settle.attempts} samples, ${settle.inFlight} in `
    + 'flight). Reported as itself: falling through would report a slow machine as a missing '
    + 'picker.').toBe(true);
}

test.describe('the Relations focus picker', () => {
  test('opens on the first item the picker offers, and draws its ego graph', async ({ app }) => {
    const { page } = app;
    await openGraph(page);

    const section = page.locator('[data-p="graph"]');
    const picker = section.locator('select#egofocus');
    await expect(picker).toHaveCount(1);

    // ── EVERY ITEM IS REACHABLE. NOT EVERY ITEM IS LISTED. ──────────────────
    //
    // This read `expect(options).toBeGreaterThan(100)` until 2026-09-01, on the
    // reasoning that "a picker over a subset would be the same accident with a
    // control on it". The owner has since looked at the product and ruled the
    // other way: *"i see many relations that has only an item in the center of
    // the screen, these are items without relations, they should at least be
    // filtered or disabled because they make the selection list long without any
    // added value"*.
    //
    // **The intent of the old assertion is kept and is what is asserted now.**
    // What it was protecting is that no item becomes UNREACHABLE through a
    // control that quietly offers less than the corpus holds — and that still
    // holds, because the hidden ones are counted out loud under the picker and
    // one click puts every one of them back. A shorter list is not the defect;
    // a shorter list nobody is told about is.
    const options = await offered(picker);
    const shown = options.length;
    expect(shown, 'the picker offers nothing, so nothing below measures the screen')
      .toBeGreaterThan(0);

    // TWO reasons, TWO counts, TWO controls. An item is missing from this list
    // because it has no relation of a kept type, or because it is retired, and a
    // reader who cannot tell which cannot trust the list — so one combined "N
    // hidden" is forbidden and both lines are asserted separately.
    const unrelated = section.locator('p.small')
      .filter({ hasText: /have no relations of the types you kept/ });
    const retired = section.locator('p.small')
      .filter({ hasText: /retired item\(s\) are not listed/ });
    await expect(unrelated, 'the picker must SAY how many items it is not listing for want of a '
      + 'relation of a kept type — INV-nothing-is-dropped-silently').toHaveCount(1);
    await expect(retired, 'and how many it is not listing because they are retired, separately: '
      + 'a combined count would make the list untrustworthy without saying why').toHaveCount(1);

    // …and the way back for each, which is what makes an omission a disclosure
    // rather than a loss. Retired first: it is the smaller set and its control
    // must not disturb the other count.
    await retired.locator('button').click();
    await expect.poll(async () => picker.locator('option').count(),
      { message: 'listing the retired items must add them to the picker' })
      .toBeGreaterThan(shown);
    await retired.locator('button').click();
    await expect.poll(async () => picker.locator('option').count()).toBe(shown);

    await unrelated.locator('button').click();
    await expect.poll(async () => picker.locator('option').count(),
      { message: 'listing the unrelated items must restore the full corpus to the picker' })
      .toBeGreaterThan(shown);
    expect(await picker.locator('option').count(),
      'with nothing held back for want of a relation, the picker reaches the whole corpus')
      .toBeGreaterThan(100);
    await unrelated.locator('button').click();
    await expect.poll(async () => picker.locator('option').count()).toBe(shown);

    // **THE DEFAULT IS THE FIRST THING THE PICKER OFFERS**, and that is a
    // property of the code rather than a fact about today's corpus: `render()`
    // chooses `items.items.find((i) => qualifies(i) && !isRetired(i))` and
    // `fill()` builds the list from the same predicate over the same array in
    // the same order. A default the picker does not list would put the
    // `<select>` on one item and the chart on another.
    await expect(picker,
      'the screen opened on an item other than the first one its own picker offers')
      .toHaveValue(options[0]!);
    const said = await picture(section);
    expect(said.focus,
      'the readout names a different item from the one the control is set to')
      .toBe(options[0]!);

    // The label is the string table's, not a literal, and it names the control.
    const labelled = section.locator('label[for="egofocus"]');
    await expect(labelled).toHaveCount(1);
    expect((await labelled.textContent())?.trim().length).toBeGreaterThan(0);

    // **An id is data, and `.m` cannot reach inside an `<option>`.** Without
    // this the list reorders under `א`.
    await expect(picker).toHaveAttribute('dir', 'ltr');
  });

  test('choosing a different item redraws the chart and the readout for THAT item', async ({ app }) => {
    const { page } = app;
    await openGraph(page);

    const section = page.locator('[data-p="graph"]');
    const picker = section.locator('select#egofocus');
    const options = await offered(picker);
    expect(options.length,
      'the picker offers fewer than two items, so there is no different item to choose and '
      + 'this test would prove nothing').toBeGreaterThan(1);
    const first = options[0]!;
    // The LAST offered id rather than a named one: it is the furthest thing in
    // the list from the default, it is derived from the control itself, and it
    // cannot go missing the way a written-down id did.
    const other = options[options.length - 1]!;

    const before = await picture(section);
    expect(before.focus, 'the screen did not open on the first item offered').toBe(first);

    // **No POST, no nonce, no confirm.** Recorded across the interaction rather
    // than asserted afterwards: a write would be gone from the DOM by the time
    // anything could look for it.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });

    await picker.selectOption(other);

    // `requires` is the NEW focus's own node, which cannot be in the document
    // until the refetch has been drawn — see the header on why the old
    // `rect.node.focus` was satisfied by the picture already on screen.
    const settle = await settleScreen(page, 'graph', {
      requires: `svg.chart g.nodehit[data-id="${other}"]`,
    });
    expect(settle.settled, 'the redraw never settled after the focus changed').toBe(true);

    // **THE PICTURE IS THE OTHER ITEM'S PICTURE**, said three ways: the readout
    // names it, the focus node carries its id, and the item that WAS the focus
    // is no longer at the centre. Not "2 rects against 60" — that was a fact
    // about one corpus on one day, and it is what this file failed on.
    const after = await picture(section);
    expect(after.focus, 'the readout still names the item the reader left').toBe(other);
    await expect(section.locator(`svg.chart g.nodehit[data-id="${other}"] text.nid`),
      'the focus node is labelled with its own id, elided at the cut the mockup uses')
      .toHaveText(label(other));
    await expect(
      section.locator(`svg.chart g.nodehit[data-id="${first}"] rect.node.focus`),
      'the item the reader left is still drawn as the focus — the chart did not move',
    ).toHaveCount(0);

    expect(writes, 'the focus picker is a READ: changing what you look at writes nothing')
      .toEqual([]);
  });

  test('going back to the first item restores the first picture — the same answer twice', async ({ app }) => {
    const { page } = app;
    await openGraph(page);
    const section = page.locator('[data-p="graph"]');
    const picker = section.locator('select#egofocus');
    const options = await offered(picker);
    expect(options.length, 'two items are needed to leave one and come back to it')
      .toBeGreaterThan(1);
    const first = options[0]!;
    const other = options[options.length - 1]!;

    const opening = await picture(section);

    await picker.selectOption(other);
    expect((await settleScreen(page, 'graph', {
      requires: `svg.chart g.nodehit[data-id="${other}"]`,
    })).settled).toBe(true);
    expect((await picture(section)).focus).toBe(other);

    await picker.selectOption(first);
    expect((await settleScreen(page, 'graph', {
      requires: `svg.chart g.nodehit[data-id="${first}"]`,
    })).settled).toBe(true);

    // `layoutGraph` is deterministic and `/api/graph` walks the same corpus, so
    // the same id twice is the same picture twice. A picker that accumulated
    // state — an appended chart, a second readout — would show it here, and so
    // would a redraw that lost an edge on the way back.
    await expect(readoutLine(section)).toHaveCount(1);
    await expect(section.locator('svg.chart')).toHaveCount(1);
    expect(await picture(section),
      'the same id twice must be the same picture twice, number for number')
      .toEqual(opening);
  });

  /**
   * **THE FILTER MUST REACH THE DRAWING AND NOT ONLY THE COUNT — 2026-09-01.**
   *
   * Measured at 2273px on the real corpus, with every relation type off: the
   * readout said `drawn=0 · filtered=2` and the plate held both nodes anyway.
   * The screen wrote its refusal into the plate CORRECTLY and synchronously —
   * a snapshot taken in the same tick as the click had the sentence and no SVG
   * — and then the drawing came back over it a frame later, because `fitChart`
   * had registered a draw against the plate and its `ResizeObserver` restamped
   * that registration when replacing the SVG with a sentence changed the
   * plate's size. The readout survived only because it lives in a container no
   * observer watches. The number and the picture disagreed about the same fact
   * on the one screen whose whole job is showing what relates to what.
   *
   * **ONLY A BROWSER CAN HOLD THIS.** The repaint is a frame late, so a
   * synchronous assertion passes against the defect — which is exactly how it
   * shipped. `test/ui/graph-screen.test.ts` pins the structure that makes the
   * repaint impossible (which host is width-watched); this pins the outcome,
   * and it waits before it looks. `toHaveCount(0)` alone would be satisfied by
   * the good frame before the bad one, so the absence is asserted AFTER a
   * settle and then held across a second reading.
   */
  test('with every relation type off, the plate says so and draws nothing at all', async ({ app }) => {
    const { page } = app;
    await openGraph(page);
    const section = page.locator('[data-p="graph"]');
    const picker = section.locator('select#egofocus');
    const offeredCount = await picker.locator('option').count();
    expect(offeredCount, 'the default state must offer items, or this test proves nothing')
      .toBeGreaterThan(0);
    // The focus IN FORCE when the reader reached for the filter — read off the
    // control rather than written down, because what `All` has to restore is
    // the reader's own selection and not a particular id.
    const inForce = await picker.inputValue();

    await section.locator('#egotypes button').filter({ hasText: /^None$/ }).click();

    // The refusal is there…
    const said = section.locator('#ego p.small');
    await expect(said, 'an all-off filter must SAY what happened where the chart was — an empty '
      + 'plate reads as a broken screen').toHaveCount(1);

    // …and the drawing is NOT, and still is not once every observer has had its
    // frame. This is the assertion the defect fails.
    await expect(section.locator('#ego svg.chart')).toHaveCount(0);
    await page.waitForTimeout(750);
    await expect(section.locator('#ego svg.chart'),
      'the drawing came BACK after the plate was told there was nothing to draw — a stale '
      + 'chart registration is being repainted over the refusal').toHaveCount(0);
    await expect(section.locator('#ego [data-id]'),
      'the plate still carries node ids: the filter reached the count and not the drawing')
      .toHaveCount(0);

    // **The readout is unchanged and remains the honest one.** `drawn=0` was
    // always right; it is the picture that was wrong, and nothing here talks
    // the number up to match an SVG.
    const off = await readoutOf(section);
    expect(off.drawn, 'with no type kept there is nothing to draw and the readout must say so')
      .toBe(0);
    expect(off.focus, 'the readout is still about the item in force').toBe(inForce);

    // **The second half: the picker stops offering what it cannot draw.** It
    // went on offering — and selecting — the item in force while the line
    // beneath it said every item in the corpus was excluded.
    await expect(picker.locator('option')).toHaveCount(0);
    await expect(picker).toBeDisabled();

    // And the way back is the one that was already there. `All` restores the
    // list, the selection the reader had, and the drawing — in that order of
    // importance: a restored list with a different item selected would be the
    // control/drawing disagreement this suite already caught once.
    await section.locator('#egotypes button').filter({ hasText: /^All$/ }).click();
    expect((await settleScreen(page, 'graph', { requires: 'svg.chart' })).settled).toBe(true);
    await expect(picker).toBeEnabled();
    await expect(picker.locator('option')).toHaveCount(offeredCount);
    await expect(picker, 'All restored the list with a different item selected')
      .toHaveValue(inForce);
    await expect(section.locator('#ego svg.chart')).toHaveCount(1);
    expect((await picture(section)).focus,
      'the restored picture is of the item the reader had, not of whatever sorts first')
      .toBe(inForce);
  });
});
