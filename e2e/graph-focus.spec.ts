/**
 * **The Relations focus picker, in a browser, because until 2026-08-30 there
 * was nothing to see.**
 *
 * `plan:walk seq:87` said the screen owed one thing — *"NOTHING CHOOSES THE
 * FOCUS"* — and said in the same breath that it could not be judged, because
 * `.demo-corpus` carried no relation at all: the app drew ONE node and a legend
 * against the mockup's seven nodes and five labelled edges, and eleven of
 * graph's twelve tree-parity findings were that fixture rather than that
 * screen. The fixture gained a real ego graph on 2026-08-30
 * (`plan:port seq:94`, `plan:walk seq:44`), so a spec that drives the picker is
 * writable for the first time and this is it.
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
 * previous picture. `requires` is given the new focus's own node label, which
 * cannot be on screen until the new response has been drawn.
 */
import { test, expect } from './app.ts';
import { settleScreen } from './settle.ts';

/**
 * **The first item by id in `.demo-corpus`, which is also the richest ego graph
 * in it** — 60 nodes, 59 edges, 7 omitted, measured 2026-08-31 by calling
 * `apiGraph` against that corpus directly. It is what the screen draws when a
 * reader touches nothing, and it is the default the picker opens on.
 */
const DEFAULT_FOCUS = 'CONST-a-correction-records-the-class-of-error-not-only-the';

/**
 * A DIFFERENT focus with a small, unambiguous neighbourhood: 2 nodes, 1 edge,
 * nothing omitted. Chosen small on purpose — the whole point of the assertion
 * is that the picture is not the one above, and 2-vs-60 is a difference no
 * flake can manufacture.
 */
const OTHER_FOCUS = 'CONST-the-pool-is-capped-at-20-connections';

/** `text.nid` truncates at 28 characters, the mockup's own cut. */
const label = (id: string): string => (id.length > 28 ? `${id.slice(0, 27)}…` : id);

test.describe('the Relations focus picker', () => {
  test('opens on the first item by id and draws that item\'s ego graph', async ({ app }) => {
    const { page } = app;
    await page.goto(`${page.url().split('#')[0]}#/graph`);
    const settle = await settleScreen(page, 'graph', { requires: 'svg.chart' });
    expect(settle.settled,
      `the Relations screen never settled (${settle.attempts} samples, ${settle.inFlight} in `
      + 'flight). Reported as itself: falling through would report a slow machine as a missing '
      + 'picker.').toBe(true);

    const picker = page.locator('[data-p="graph"] select#egofocus');
    await expect(picker).toHaveCount(1);
    // Every item in the corpus is offerable — the defect was that the focus was
    // "an accident of the item list's order", and a picker over a subset would
    // be the same accident with a control on it.
    const options = await picker.locator('option').count();
    expect(options).toBeGreaterThan(100);

    // **The default is unchanged.** A reader who touches nothing sees what this
    // screen has always drawn: `items.items[0].id`.
    await expect(picker).toHaveValue(DEFAULT_FOCUS);
    await expect(page.locator('[data-p="graph"] p.small').filter({ hasText: 'focus=' }))
      .toHaveText(new RegExp(`^focus=${DEFAULT_FOCUS} · radius=1 `));

    // The label is the string table's, not a literal, and it names the control.
    const labelled = page.locator('[data-p="graph"] label[for="egofocus"]');
    await expect(labelled).toHaveCount(1);
    expect((await labelled.textContent())?.trim().length).toBeGreaterThan(0);

    // **An id is data, and `.m` cannot reach inside an `<option>`.** Without
    // this the list reorders under `א`.
    await expect(picker).toHaveAttribute('dir', 'ltr');
  });

  test('choosing a different item redraws the chart and the readout for THAT item', async ({ app }) => {
    const { page } = app;
    await page.goto(`${page.url().split('#')[0]}#/graph`);
    expect((await settleScreen(page, 'graph', { requires: 'svg.chart' })).settled).toBe(true);

    const section = page.locator('[data-p="graph"]');
    const before = {
      rects: await section.locator('svg.chart rect').count(),
      paths: await section.locator('svg.chart path').count(),
      readout: await section.locator('p.small').filter({ hasText: 'focus=' }).textContent(),
    };
    // The fixture's own ego graph, and the reason this spec could not be
    // written before 2026-08-30: 60 nodes, 59 edges, 7 omitted. The `+N more`
    // node is a 61st rect.
    expect(before.rects).toBeGreaterThan(50);
    expect(before.paths).toBeGreaterThan(50);
    expect(before.readout).toContain(`focus=${DEFAULT_FOCUS}`);

    // **No POST, no nonce, no confirm.** Recorded across the interaction rather
    // than asserted afterwards: a write would be gone from the DOM by the time
    // anything could look for it.
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() !== 'GET') writes.push(`${request.method()} ${request.url()}`);
    });

    await section.locator('select#egofocus').selectOption(OTHER_FOCUS);

    // `requires` is the NEW focus's own node label: the chip is long gone and a
    // stable element count would be satisfied by the picture that is still on
    // screen. This cannot be true until the refetch has been drawn.
    const settle = await settleScreen(page, 'graph', { requires: 'svg.chart rect.node.focus' });
    expect(settle.settled, 'the redraw never settled after the focus changed').toBe(true);
    await expect(section.locator('svg.chart text.nid').first())
      .toHaveText(label(OTHER_FOCUS));

    // **The picture is a different picture.** 2 nodes and 1 edge against 60 and
    // 59 — a difference no flake produces.
    expect(await section.locator('svg.chart rect').count()).toBe(2);
    expect(await section.locator('svg.chart path').count()).toBe(1);

    // **And the readout is about the item it is now drawing.** A stale readout
    // under a fresh chart is the failure this screen's `foot` container exists
    // to make impossible — it names a focus, a node count and an omitted count,
    // and every one of them would be a lie about the picture above it.
    const readouts = section.locator('p.small').filter({ hasText: 'focus=' });
    await expect(readouts).toHaveCount(1);
    await expect(readouts).toHaveText(
      new RegExp(`^focus=${OTHER_FOCUS} · radius=1 · nodes=2 · edges=1 · drawn=1 · omitted=0$`),
    );

    expect(writes, 'the focus picker is a READ: changing what you look at writes nothing')
      .toEqual([]);
  });

  test('going back to the first item restores the first picture — the same answer twice', async ({ app }) => {
    const { page } = app;
    await page.goto(`${page.url().split('#')[0]}#/graph`);
    expect((await settleScreen(page, 'graph', { requires: 'svg.chart' })).settled).toBe(true);
    const section = page.locator('[data-p="graph"]');

    await section.locator('select#egofocus').selectOption(OTHER_FOCUS);
    expect((await settleScreen(page, 'graph', { requires: 'svg.chart' })).settled).toBe(true);
    expect(await section.locator('svg.chart rect').count()).toBe(2);

    await section.locator('select#egofocus').selectOption(DEFAULT_FOCUS);
    expect((await settleScreen(page, 'graph', { requires: 'svg.chart' })).settled).toBe(true);

    // `layoutGraph` is deterministic and `/api/graph` walks the same corpus, so
    // the same id twice is the same picture twice. A picker that accumulated
    // state — an appended chart, a second readout — would show it here.
    await expect(section.locator('p.small').filter({ hasText: 'focus=' })).toHaveCount(1);
    await expect(section.locator('svg.chart')).toHaveCount(1);
    await expect(section.locator('p.small').filter({ hasText: 'focus=' }))
      .toHaveText(new RegExp(`^focus=${DEFAULT_FOCUS} `));
  });
});
