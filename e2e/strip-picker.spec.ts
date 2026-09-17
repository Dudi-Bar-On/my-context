// @basis TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only,
// INV-nothing-is-dropped-silently,
// DEC-the-meaning-hue-budget-is-five-gold-ok-carry-crit-and-warn
/**
 * **THE STATUS BAR PICKER, DRIVEN** — `semantic/17`,
 * `TASK-the-status-bar-takes-a-ninth-of-the-window-and-the-only`.
 *
 * The owner, 2026-09-17, having declined a flat `STRIP_MAX_ROWS` change:
 * *"a status bar customization dialog that would allow the user to check which
 * elements to show … the viewer will dynamically extend it size down according
 * to the status bar occupied lines but not by defining MAX ROWS"*.
 *
 * ── WHAT ONLY A BROWSER CAN ANSWER ────────────────────────────────────────
 *
 * `test/ui/strip-picker.test.ts` owns the RULES — what a stored choice is,
 * which pill answers to which name, when a hidden field may come back. Every
 * one of them is drivable without a page and none of them is the thing the
 * owner asked for. What is here is what a unit test cannot see:
 *
 *   — **THE TRADE, MEASURED.** A row dropped is 25px of the shell's one
 *     elastic track handed to the viewer, and the point of the readout is that
 *     the number in the dialog is the number on the page.
 *   — **THE ROUND TRIP.** Unticking a whole category detaches its group from
 *     `#strip`, and a build that reads the LIVE DOM to decide what the DOM
 *     should be can never put it back. See `the round trip` below: the owner
 *     found that by using it, and a proof that asserted only the disappearance
 *     would have passed against the broken build.
 *   — **THE RETURN.** A field switched off that comes back because it has
 *     something to disclose is the item's non-negotiable half.
 *   — **BOTH LANGUAGES**, and **EVERY SCREEN**, because the bar is app-wide.
 *
 * ── AND THE CENSUS THAT KEEPS THE TABLE HONEST ────────────────────────────
 *
 * `STRIP_PICK` is a DECLARATION, and a declaration goes stale. The census
 * collects every `[data-f]` the live bar draws and fails on one the dialog has
 * no row for. It also closes the one hole the node proofs cannot reach:
 * `neverForced()` is DERIVED from `urgency: null`, so a static comparison is a
 * tautology, and a field wrongly declared to have no urgency can only be
 * caught by watching the bar draw it loud.
 *
 * ── ONE THING THIS FILE DELIBERATELY DOES NOT DO ──────────────────────────
 *
 * **It never calls `page.reload()`, and that is a finding rather than a
 * preference.** In this harness a reload re-navigates to the spent nonce, the
 * boot exchange is refused, and the page comes back as chrome with no token:
 * an empty rail, an empty `main`, and a strip of group headings with no fields
 * under them. Reproduced on 2026-09-17 against PRISTINE sources, so it is not
 * this item's doing — `e2e/strip-fields.spec.ts` is red for exactly that
 * reason today, receiving 2 fields where it floors at 10. A second page in the
 * SAME context with a fresh nonce is what this file uses instead: same
 * `localStorage` partition, real document load, real boot.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { mintNonce } from '../test/ui/helpers.ts';

/**
 * **`mintNonce` WITH A RETRY, AND THE RETRY IS A FINDING RATHER THAN A STYLE.**
 *
 * `test/ui/helpers.ts`' `mintNonce` is a bare `fetch`, and against this server
 * on Windows it intermittently answers `ECONNRESET` on a reused keep-alive
 * connection — measured 2026-09-17, three of seven tests in this file and two
 * unrelated ones in `e2e/strip.spec.ts` in the same run. A test that mints more
 * than one nonce meets it sooner, which is why this file meets it at all.
 * `connection: close` plus a short backoff is what makes a spec about the
 * status bar stop failing for a reason that has nothing to do with the status
 * bar. Reported: the retry belongs in `helpers.ts`, where every caller would
 * get it, and putting it there is not this lane's to do.
 */
async function nonce(port: number): Promise<string> {
  let last: unknown = null;
  for (let attempt = 0; attempt < 6; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/nonce`,
        { method: 'POST', headers: { connection: 'close' } });
      if (response.status !== 200) throw new Error(`nonce mint refused: ${response.status}`);
      return ((await response.json()) as { nonce: string }).nonce;
    } catch (error) {
      last = error;
      await new Promise((done) => { setTimeout(done, 400); });
    }
  }
  throw last instanceof Error ? last : new Error('nonce mint failed');
}
void mintNonce;

/** The one panel this file addresses, by the handle `createPanel` writes. */
const PANEL = 'dialog[data-panel="stripfields"]';

const SAMPLE = (used: number, size: number, pct: number) => ({
  receivedAt: new Date().toISOString(), model: 'Claude', version: '1.0.0',
  context: { state: 'known', usedTokens: used, windowSize: size, percent: pct },
});
const body = (pct: number, five: number, seven: number) => ({
  session: 's', sample: SAMPLE(Math.round(pct * 10_000), 1_000_000, pct),
  mycontext: { tokens: 264_500, injections: 3, unrecorded: 0 }, mycontextError: null,
  handover: {
    verdict: 'not-asked', path: null, askedAt: null, writtenAt: null, thresholdPercent: 85,
  },
  rateLimits: {
    fiveHour: { usedPercent: five, resetsAt: Math.floor(Date.now() / 1000) + 7_200 },
    sevenDay: { usedPercent: seven, resetsAt: Math.floor(Date.now() / 1000) + 140_000 },
  },
  costUsd: 3742.3, warmPercent: 99.9, elapsedMs: 5_040_000,
  sessionName: 'my-context V2.0.0', focus: 'plan:walk', focusRead: true,
  modes: { effort: 'high', thinking: true, fastMode: null, exceeds200k: true },
  lastAudit: { row: { op: 'subagent-stop', at: new Date().toISOString() } },
});

/**
 * A real document load in the SAME storage partition — see this file's header
 * for why it is not `page.reload()`. Returns the new page; the caller owns it.
 */
async function freshPage(page: Page, port: number, lang?: 'en' | 'he'): Promise<Page> {
  const next = await page.context().newPage();
  if (lang !== undefined) {
    await next.addInitScript((l) => {
      try { localStorage.setItem('myctx-lang', l as string); } catch { /* private mode */ }
    }, lang);
  }
  // **BROUGHT TO THE FRONT BEFORE IT IS WAITED ON, AND THAT IS NOT COSMETIC.**
  // A page opened behind the fixture's own is BACKGROUNDED: the engine throttles
  // its `requestAnimationFrame`, and `fitStrip` is coalesced onto exactly that —
  // so the bar can sit unfilled and unfitted for as long as the tab is hidden.
  // Measured on 2026-09-17: the English run of the trade test read 2 visible
  // fields off a bar the Hebrew run read 25 off, from the same code, because the
  // two happened to be scheduled differently.
  await next.bringToFront();
  const fresh = await nonce(port);
  await next.goto(`http://127.0.0.1:${port}/#${fresh}`);
  await next.waitForSelector('#strip .striprow', { timeout: 20_000 });
  // The bar fills from three separate calls; the row count is not settled until
  // the last of them has landed and `fitStrip` has re-dealt the groups. Waited
  // on the CONTENT rather than on a clock wherever it can be: a timeout is a
  // guess and a condition is a measurement.
  await next.waitForFunction(
    () => [...document.querySelectorAll('#strip [data-f]')]
      .filter((e) => e.getClientRects().length > 0).length >= 6,
    undefined, { timeout: 20_000 },
  ).catch(() => { /* the floor below reports it with the number it actually saw */ });
  await next.waitForTimeout(1_500);
  return next;
}

/** Right-click the bar, which is the ONE gesture that opens this. */
async function openPicker(page: Page): Promise<void> {
  const box = await page.locator('#strip').boundingBox();
  if (box === null) throw new Error('the strip has no box — the shell did not render');
  await page.mouse.click(box.x + Math.min(200, box.width / 2), box.y + 8, { button: 'right' });
  await expect(page.locator(PANEL)).toHaveAttribute('open', '', { timeout: 5_000 });
}

/** The bar's cost, off the page rather than out of the dialog. */
const measure = (page: Page) => page.evaluate(() => {
  const strip = document.getElementById('strip');
  const pane = document.getElementById('screen') ?? document.querySelector('.body');
  const box = (el: Element | null) => (el === null
    ? 0 : Math.round(el.getBoundingClientRect().height));
  return {
    rows: document.querySelectorAll('#strip .striprow').length,
    strip: box(strip),
    viewer: box(pane),
    shown: [...document.querySelectorAll('#strip [data-f]')]
      .filter((e) => e.getClientRects().length > 0).length,
    groups: document.querySelectorAll('#strip .sgrp').length,
  };
});

test('the picker opens by right-clicking the bar, on every screen, and the '
  + 'document behind it stays live', async ({ app }) => {
  const { page } = app;
  await page.waitForSelector('#strip .striprow', { timeout: 20_000 });

  // **THE STRIP IS APP-WIDE, so the gesture must be.** Four screens, which is
  // the item's own floor: the board, the conversation viewer and two others.
  // An app-wide setting inside ONE screen's context menu would be hidden from
  // the other nineteen, which is why it is not there.
  for (const route of ['', '#/conversations', '#/doctor', '#/status']) {
    await page.evaluate((r) => { location.hash = r; }, route);
    await page.waitForTimeout(700);
    await openPicker(page);
    await expect(page.locator(PANEL)).toHaveCount(1);
    // NON-MODAL, which is `lib/panel.js`'s whole technical crux: the page
    // behind must still answer. A settings panel that froze the screen it
    // annotates would be worse than no panel at all.
    const modal = await page.evaluate(
      (sel) => document.querySelector(sel)?.matches(':modal') === true, PANEL);
    expect(modal, `the picker went modal on ${route || 'the board'}`).toBe(false);
    // Escape, hand-wired, because `show()` does not get it for free.
    await page.keyboard.press('Escape');
    await expect(page.locator(PANEL)).not.toHaveAttribute('open', '');
  }
});

test('every field the bar draws has a row in the picker, and no row is loud '
  + 'while claiming it can never return', async ({ app }) => {
  // Four mocked states plus a live one, each a real document load and a real
  // boot. The default 30s is a budget for one page, not five.
  test.setTimeout(180_000);
  const { page } = app;
  const seen = new Map<string, boolean>();

  // Four states, so a field that only appears at one level is still reached —
  // the same walk `e2e/strip-fields.spec.ts` makes, for the same reason. The
  // route is on the CONTEXT so a freshly opened page inherits it.
  const census = async (pct: number, five: number, seven: number) => {
    await page.context().unrouteAll({ behavior: 'ignoreErrors' });
    await page.context().route('**/api/watch/context*', (r) => r.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify(body(pct, five, seven)),
    }));
    const next = await freshPage(page, app.port);
    await next.setViewportSize({ width: 2273, height: 900 });
    await next.waitForTimeout(700);
    const found = await next.evaluate(() => {
      const LOUD = ['warning', 'critical', 'warn', 'crit'];
      const out: { key: string; loud: boolean }[] = [];
      for (const host of ['hdrrepo', 'strip']) {
        const root = document.getElementById(host);
        if (root === null) continue;
        for (const el of root.querySelectorAll('[data-f]')) {
          const e = el as HTMLElement;
          if (e.parentElement?.closest('[data-f]') !== null) continue;
          const lab = e.querySelector(':scope > .ulab') as HTMLElement | null;
          const named = lab?.dataset.k ?? '';
          const key = named.startsWith('strip.grp.')
            ? named.slice('strip.grp.'.length) : (e.dataset.f ?? '');
          if (key === '') continue;
          out.push({
            key,
            loud: LOUD.some((c) => e.classList.contains(c))
              || e.querySelector(LOUD.map((c) => `.${c}`).join(',')) !== null
              || e.dataset.u === '1',
          });
        }
      }
      return out;
    });
    for (const f of found) seen.set(f.key, (seen.get(f.key) ?? false) || f.loud);
    await next.close();
  };
  for (const [pct, five, seven] of [[45, 5, 59], [65, 5, 59], [75, 72, 59], [88, 72, 95]] as const) {
    await census(pct, five, seven);
  }

  // ── THE VACUITY FLOOR. Every set contains the empty set, so a selector that
  // stopped matching would make both assertions below pass while reading
  // nothing — silently, and for as long as nobody looked.
  expect(seen.size, 'the bar declared too few fields for this to be reading it')
    .toBeGreaterThanOrEqual(15);

  await page.context().unrouteAll({ behavior: 'ignoreErrors' });
  const live = await freshPage(page, app.port);
  await live.setViewportSize({ width: 1440, height: 900 });
  await openPicker(live);
  const rows = await live.evaluate((sel) => {
    const panel = document.querySelector(sel);
    return [...(panel?.querySelectorAll('input[type=checkbox][data-f]') ?? [])]
      .map((b) => (b as HTMLElement).dataset.f ?? '');
  }, PANEL);

  const missing = [...seen.keys()].filter((k) => !rows.includes(k));
  expect(missing, 'the bar draws these and the picker offers no row for them').toEqual([]);

  // ── AND THE HOLE THE STATIC PROOFS CANNOT REACH. A pill that actually turns
  // loud while the dialog promises it can never come back is the dialog making
  // a promise the field cannot keep.
  const never = await live.evaluate((sel) => [
    ...document.querySelectorAll(`${sel} .stripickopt`)]
    .filter((row) => row.querySelector('.stripickurg') === null)
    .map((row) => (row.querySelector('input[data-f]') as HTMLElement | null)?.dataset.f ?? '')
    .filter((k) => k !== ''), PANEL);
  expect(never.length, 'no row claims it can never return, which makes this vacuous')
    .toBeGreaterThan(0);
  const lying = never.filter((k) => seen.get(k) === true);
  expect(lying, 'the picker says these can never force themselves back, and the bar '
    + 'drew every one of them loud').toEqual([]);
  await live.close();
});

for (const lang of ['en', 'he'] as const) {
  test(`unticking drops rows and hands the pixels to the viewer — ${lang}`, async ({ app }) => {
    const { page } = app;
    const tab = await freshPage(page, app.port, lang);
    await tab.setViewportSize({ width: 1280, height: 900 });
    await tab.waitForTimeout(600);
    expect(await tab.evaluate(() => document.documentElement.getAttribute('dir')))
      .toBe(lang === 'he' ? 'rtl' : 'ltr');

    const before = await measure(tab);
    expect(before.rows, 'the bar drew no rows at all').toBeGreaterThanOrEqual(2);
    // ── A VACUITY FLOOR, AND A LOW ONE ON PURPOSE. This harness intermittently
    // boots a page whose API calls are refused, leaving the bar as headings
    // over nothing — measured on 2026-09-17 in one of two language runs of this
    // same test. The floor says "there is a bar here to configure"; everything
    // below is a RELATIVE claim, so it means the same thing on a full bar and a
    // sparse one.
    expect(before.shown, 'the bar drew almost no fields — it probably has no token')
      .toBeGreaterThanOrEqual(6);

    await openPicker(tab);
    // **THE GROUPS COME OFF THE BAR, NOT OUT OF A LIST HERE.** Naming four by
    // hand measured the fixture rather than the feature: a group the payload
    // left empty keeps its place by design, so unticking it changes nothing and
    // the assertions below would be about nothing. Every group that HAS fields
    // is unticked except the first, which keeps the bar from becoming a case
    // nobody ships.
    const withFields: string[] = await tab.evaluate((sel) => [
      ...document.querySelectorAll(`${sel} .stripickall`)]
      .map((all) => (all as HTMLElement).dataset.g ?? '')
      .filter((key) => {
        const group = document.querySelector(`#strip .sgrp-${key}`);
        return group !== null && group.querySelectorAll('[data-f]').length > 0;
      }), PANEL);
    expect(withFields.length, 'fewer than two groups on the bar carry any field')
      .toBeGreaterThanOrEqual(2);
    for (const group of withFields.slice(1)) {
      await tab.locator(`${PANEL} .stripickall[data-g="${group}"]`).uncheck();
      await tab.waitForTimeout(350);
    }
    await tab.waitForTimeout(700);
    const after = await measure(tab);

    // **THE TRADE, AND IT IS THE WHOLE FEATURE.** Fewer fields, fewer rows, a
    // shorter bar, and every pixel of the difference lands in the one elastic
    // track — which is why nothing had to be written to make the viewer grow.
    expect(after.shown, 'no field left the bar').toBeLessThan(before.shown);
    expect(after.groups, 'a group emptied of every field kept its heading')
      .toBeLessThan(before.groups);
    expect(after.strip, 'the bar did not get shorter').toBeLessThan(before.strip);
    expect(after.viewer, 'the viewer did not take the pixels the bar gave up')
      .toBeGreaterThan(before.viewer);
    expect(before.strip - after.strip, 'the bar shrank and the viewer did not grow by as much')
      .toBe(after.viewer - before.viewer);

    // **THE READOUT IS THE MEASUREMENT AND NOT A SECOND ARITHMETIC.** It puts
    // the trade in front of the reader at the moment he makes it, and a number
    // that disagreed with the page would be worse than no number.
    const said = await tab.locator(`${PANEL} .stripicksay`).textContent();
    expect(said ?? '').toContain(String(after.viewer));
    expect(said ?? '').toContain(String(after.strip));

    // **AND IT SURVIVES THE PAGE.** A preference, not a view mode — which is
    // why this is the opposite answer from `#panefloat`, whose own record says
    // a float that survived a reload "would greet the next reader with a
    // page-covering panel they never asked for". A field selection greets him
    // with the bar he chose.
    const again = await freshPage(page, app.port, lang);
    await again.setViewportSize({ width: 1280, height: 900 });
    await again.waitForTimeout(600);
    const reloaded = await measure(again);
    expect(reloaded.shown, 'the choice did not survive the page').toBe(after.shown);
    expect(reloaded.rows).toBe(after.rows);
    await again.close();
    await tab.close();
  });
}

test('the round trip: a category unticked comes BACK when it is ticked again, '
  + 'and a hidden field in it still forces itself onto the bar', async ({ app }) => {
  /*
   * ── THE DEFECT THIS EXISTS FOR, IN THE OWNER'S WORDS ────────────────────
   *
   * 2026-09-17, driving the first build: *"when you deselect a category after
   * reselction the fields does not come back and are not displayable again"*.
   *
   * Unticking every field in a group makes `stripGroupsOf` drop it, so
   * `layoutStrip` never appends it and the group is DETACHED from `#strip`. A
   * build whose `applyStripChoice` walks the live DOM can never reach those
   * pills again — their `.stripoff` is never removed, the group stays dropped,
   * and the choice is PERSISTED, so it survived a reload with no route back
   * but the reset link. It also killed the urgency return for the whole group,
   * because `applyStripChoice` is the function that adds `.stripback`.
   *
   * **THE ASSERTION IS THE ROUND TRIP AND NOT THE FIRST HALF OF IT.** A test
   * that only checked the group disappearing passes against the broken build.
   */
  const { page } = app;
  const tab = await freshPage(page, app.port);
  await tab.setViewportSize({ width: 1280, height: 1000 });
  await tab.waitForTimeout(600);

  const groupState = (name: string) => tab.evaluate((n) => {
    const g = document.querySelector(`#strip .sgrp-${n}`);
    return {
      attached: g !== null,
      visible: (g?.getClientRects().length ?? 0) > 0,
      shown: [...document.querySelectorAll('#strip [data-f]')]
        .filter((e) => e.getClientRects().length > 0).length,
    };
  }, name);

  await openPicker(tab);
  /*
   * **THE GROUP IS CHOSEN FROM THE BAR, NOT NAMED HERE**, and the difference
   * is what makes this test mean the same thing on every corpus. Only a group
   * that HAS fields and whose fields are none of them urgent can actually
   * empty — a group holding an urgent field keeps that field and never
   * detaches, and a group the payload left with no fields at all keeps its
   * place on purpose (see `stripGroupsOf`). Naming COST worked on a live
   * server and did not in a harness whose context payload is absent, which is
   * a test that was measuring the fixture rather than the feature.
   */
  const drawnKeys = (sel: string) => tab.evaluate((panel) => {
    // The picker key a pill answers to — the same derivation `pickKeyOf` makes,
    // spelled here because a browser context cannot import the module.
    const keyOf = (e: Element) => {
      const lab = e.querySelector(':scope > .ulab') as HTMLElement | null;
      const named = lab?.dataset.k ?? '';
      return named.startsWith('strip.grp.')
        ? named.slice('strip.grp.'.length) : ((e as HTMLElement).dataset.f ?? '');
    };
    const out: Record<string, string[]> = {};
    for (const all of document.querySelectorAll(`${panel} .stripickall`)) {
      const group = (all as HTMLElement).dataset.g ?? '';
      const host = document.querySelector(`#strip .sgrp-${group}`);
      if (host === null) continue;
      const keys = new Set<string>();
      for (const pill of host.querySelectorAll('[data-f]')) {
        if (pill.parentElement?.closest('[data-f]') !== null) continue;
        if (pill.getClientRects().length === 0) continue;
        const key = keyOf(pill);
        if (key !== '') keys.add(key);
      }
      out[group] = [...keys];
    }
    return out;
  }, sel);

  /*
   * **THE GROUP IS CHOSEN FROM THE BAR, NOT NAMED HERE**, and the difference is
   * what makes this test mean the same thing on every corpus. Naming COST
   * worked against a live server and did not in a harness whose context payload
   * is absent — a test that was measuring the fixture rather than the feature.
   *
   * TWO conditions, and each is load-bearing:
   *
   *   — **at least two distinct picker KEYS drawn**, so one can be unticked
   *     without emptying the group. Two PILLS is not enough: MODEL draws two
   *     and they answer to one name, so unticking it takes both.
   *   — **no field in it urgent**, because a group holding an urgent field
   *     keeps that field and can never detach — and detachment is the whole
   *     defect this test exists for.
   */
  const bar = await drawnKeys(PANEL);
  const target = await tab.evaluate((args) => {
    const [panel, drawn] = args as [string, Record<string, string[]>];
    for (const all of document.querySelectorAll(`${panel} .stripickall`)) {
      const key = (all as HTMLElement).dataset.g ?? '';
      if ((drawn[key] ?? []).length < 2) continue;
      const rows = [...(all.closest('.stripickgrp')?.nextElementSibling
        ?.querySelectorAll('.stripickopt') ?? [])];
      if (rows.some((r) => r.querySelector('.stripickurg') !== null)) continue;
      return key;
    }
    return null;
  }, [PANEL, bar]);
  expect(target, 'no group on this bar can be emptied, so the round trip cannot be driven '
    + 'here — the fixture, not the feature').not.toBeNull();

  const start = await groupState(target!);
  expect(start.attached, `the ${target} group is not on this bar to begin with`).toBe(true);

  /*
   * ── FIRST, ONE FIELD ON ITS OWN, WHICH IS THE CASE THE STYLESHEET CARRIES.
   *
   * A whole category leaves the bar by DETACHMENT — `stripGroupsOf` stops
   * dealing the group a row — so it would disappear even if no rule hid
   * anything. A single field inside a group that is still drawn is the only
   * case where `display:none` is the whole mechanism, and a proof that skipped
   * it went green against a build whose hiding rule had stopped matching.
   * Found by a removal proof that reddened NOTHING, which is what those are for.
   */
  const first = bar[target!][0];
  await tab.locator(`${PANEL} input[data-f="${first}"]`).uncheck();
  await tab.waitForTimeout(700);
  const soloed = await tab.evaluate((args) => {
    const [key] = args as [string];
    const group = document.querySelector(`#strip .sgrp-${key}`);
    const off = [...(group?.querySelectorAll('[data-f].stripoff') ?? [])];
    return {
      groupStillDrawn: (group?.getClientRects().length ?? 0) > 0,
      hidden: off.length,
      painted: off.filter((e) => e.getClientRects().length > 0).length,
    };
  }, [target!]);
  expect(soloed.groupStillDrawn, 'unticking one field took its whole group off the bar')
    .toBe(true);
  expect(soloed.hidden, 'unticking one field marked nothing off').toBeGreaterThan(0);
  expect(soloed.painted, 'a field the reader switched off is still drawn on the bar')
    .toBe(0);
  await tab.locator(`${PANEL} input[data-f="${first}"]`).check();
  await tab.waitForTimeout(700);

  await tab.locator(`${PANEL} .stripickall[data-g="${target}"]`).uncheck();
  await tab.waitForTimeout(800);
  const gone = await groupState(target!);
  expect(gone.attached, 'unticking every field in a group left its heading standing')
    .toBe(false);
  expect(gone.shown).toBeLessThan(start.shown);

  await tab.locator(`${PANEL} .stripickall[data-g="${target}"]`).check();
  await tab.waitForTimeout(800);
  const back = await groupState(target!);
  expect(back.attached, 'the group never came back — the DOM was read to decide what the '
    + 'DOM should be, so a detached group is unreachable').toBe(true);
  expect(back.visible, 'the group came back detached-looking: attached but not drawn')
    .toBe(true);
  expect(back.shown, 'the fields did not come back with their group').toBe(start.shown);

  // ── AND THE URGENCY RETURN STILL WORKS AFTER A WHOLE-CATEGORY UNTICK.
  //
  // The corpus group holds the doctor count, which is marked urgent where
  // `doctorNoticeCount` is already called. Unticking the WHOLE category is the
  // case the broken build could not survive: with the group detached, nothing
  // would ever add `.stripback`, and `91 doctor notices` would go silent for
  // good. That is `INV-nothing-is-dropped-silently` failing inside the feature
  // built to honour it.
  const urgent = await tab.evaluate(
    () => document.querySelector('#strip [data-f="doctor-notices"]')?.getAttribute('data-u'));
  expect(urgent, 'this corpus has no doctor findings, so the return cannot be driven here')
    .toBe('1');
  await tab.locator(`${PANEL} .stripickall[data-g="corpus"]`).uncheck();
  await tab.waitForTimeout(800);
  const kept = await tab.evaluate(() => {
    const el = document.querySelector('#strip [data-f="doctor-notices"]');
    return {
      back: el?.classList.contains('stripback') ?? false,
      visible: (el?.getClientRects().length ?? 0) > 0,
      grouped: el?.closest('#strip .sgrp-corpus') !== null,
      border: el === null ? '' : getComputedStyle(el).borderTopStyle,
    };
  });
  expect(kept.visible, 'a field with findings behind it went silent when its whole '
    + 'category was unticked').toBe(true);
  expect(kept.back, 'it came back unmarked, which reads as the preference misbehaving')
    .toBe(true);
  expect(kept.grouped, 'it came back outside its own group').toBe(true);
  // **THE MARK IS ON THE BAR AND NOT ONLY IN THE DIALOG.** A dotted outline in
  // the field's OWN ink: a shape, not a sixth hue
  // (`DEC-the-meaning-hue-budget-is-five`), so the outline says "this is back"
  // without saying anything about how bad it is. Removing it is a silent
  // regression — the field would return looking exactly like one that was
  // never hidden, which is the reading this whole branch exists to prevent.
  expect(kept.border, 'a field that forced itself back is drawn like one that was never '
    + 'hidden').toBe('dotted');
  await tab.close();
});

test('“show everything again” restores the bar he had before he opened the '
  + 'dialog, ceiling included', async ({ app }) => {
  /*
   * **`null` IS NOT `[]`, AND THE RESET LINK IS WHERE THAT BITES.** An empty
   * SELECTION is still a selection, so `stripRowCap` goes on letting the bar
   * take every row its content measurably needs — and a control that says
   * "show everything again" would hand the reader a TALLER bar than the one he
   * started with. Measured on this corpus at 1280px: four rows and 99px
   * before, five rows and 124px after, with the same fields on it.
   */
  const { page } = app;
  const tab = await freshPage(page, app.port);
  await tab.setViewportSize({ width: 1280, height: 1000 });
  await tab.waitForTimeout(600);
  const before = await measure(tab);

  await openPicker(tab);
  // Any group the bar is actually drawing, chosen from the bar for the reason
  // the round trip chooses one: a named group that the payload left empty
  // would make this assert nothing.
  const some = await tab.evaluate((sel) => {
    for (const all of document.querySelectorAll(`${sel} .stripickall`)) {
      const key = (all as HTMLElement).dataset.g ?? '';
      const group = document.querySelector(`#strip .sgrp-${key}`);
      if (group !== null && group.querySelectorAll('[data-f]').length > 0) return key;
    }
    return null;
  }, PANEL);
  expect(some, 'the bar is drawing no fields at all').not.toBeNull();
  await tab.locator(`${PANEL} .stripickall[data-g="${some}"]`).uncheck();
  await tab.waitForTimeout(800);
  expect((await measure(tab)).shown).toBeLessThan(before.shown);

  await tab.locator(`${PANEL} .stripickreset`).click();
  await tab.waitForTimeout(800);
  const after = await measure(tab);
  expect(after.shown, 'reset did not bring every field back').toBe(before.shown);
  expect(after.rows, 'reset left the row ceiling lifted').toBe(before.rows);
  expect(after.strip, 'reset left a taller bar than the one he started with')
    .toBe(before.strip);
  expect(after.viewer).toBe(before.viewer);
  const stored = await tab.evaluate(() => {
    try { return localStorage.getItem('mycontext.strip.fields'); } catch { return 'THREW'; }
  });
  expect(stored, 'reset wrote an empty selection instead of forgetting the choice')
    .toBeNull();
  await tab.close();
});

test('a choice lifts the row ceiling: what he ticked is drawn, never silently '
  + 'cut', async ({ app }) => {
  /*
   * **`STRIP_MAX_ROWS` IS A FALLBACK AGAIN, WHICH IS WHAT ITS OWN DOCBLOCK
   * ALWAYS SAID IT WAS.** It governs a reader who has never opened the picker.
   * Once he has chosen, what he ticked wins: *"if a selection needs five rows,
   * draw five and SAY SO"*, because a cap that silently overrides a selection
   * is the same defect as a count that vanishes.
   *
   * **THE VACUITY GUARD IS THE FIRST HALF OF THIS TEST.** On a wide enough
   * window, or a corpus with less on the bar, the default is not cut at all and
   * lifting the ceiling changes nothing — the assertion would then pass against
   * a build that never lifts it. So the clipped verdict is read off the dialog
   * FIRST (`data-clipped`, written where `stripDeficit` is already consulted,
   * so nothing here re-derives it), and the claim is only made where there is
   * something to claim.
   */
  const { page } = app;
  // **A FULL PAYLOAD AT A NARROW WIDTH**, so the cut is large and deterministic
  // rather than whatever this corpus happens to produce. The fattest of the
  // four states `e2e/strip-fields.spec.ts` walks, at 1100px.
  await page.context().unrouteAll({ behavior: 'ignoreErrors' });
  await page.context().route('**/api/watch/context*', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify(body(88, 72, 95)),
  }));
  const tab = await freshPage(page, app.port);
  await tab.setViewportSize({ width: 1100, height: 1000 });
  await tab.waitForTimeout(900);
  const before = await measure(tab);

  await openPicker(tab);
  const clipped = await tab.locator(`${PANEL} .stripicksay`).getAttribute('data-clipped');
  test.skip(clipped !== '1', 'the default bar is not cut at this width on this corpus, so '
    + 'there is no ceiling for a choice to lift — recorded rather than asserted away');

  // The smallest possible CHOICE: untick one field and tick it straight back.
  // Nothing is hidden, so any change in the row count is the ceiling moving and
  // nothing else.
  const one = await tab.evaluate((sel) => (document
    .querySelector(`${sel} input[type=checkbox][data-f]`) as HTMLElement | null)?.dataset.f ?? null,
  PANEL);
  expect(one, 'the picker offered no field to tick').not.toBeNull();
  await tab.locator(`${PANEL} input[data-f="${one}"]`).uncheck();
  await tab.waitForTimeout(400);
  await tab.locator(`${PANEL} input[data-f="${one}"]`).check();
  await tab.waitForTimeout(800);

  const after = await measure(tab);
  expect(after.shown, 'a field is missing after ticking everything back').toBe(before.shown);
  /*
   * **AND THE ONE CASE NO BLACK-BOX TEST CAN SEPARATE, SAID OUT LOUD.** If an
   * extra row would buy nothing — a group whose own content is wider than the
   * whole bar cannot be helped by moving it, and `fitStrip` hands such a row
   * back — then a capped bar and an uncapped one draw the same thing. The
   * fixture above is chosen to avoid that case rather than to hide it: a full
   * payload at 1100px cuts the identity subject by more than one group's
   * worth, which is exactly where another row helps.
   */
  expect(after.rows, 'the bar was cut at the ceiling and a made choice did not lift it — '
    + 'what he ticked is being silently overridden').toBeGreaterThan(before.rows);
  // And the cost of that is DISCLOSED, not discovered later by looking at a
  // smaller viewer.
  const said = await tab.locator(`${PANEL} .stripicksay`).textContent();
  expect(said ?? '').toContain(String(after.rows));
  expect(said ?? '').toContain(String(after.strip));
  await tab.close();
});

test('the picker reflects in Hebrew and remembers a drag from the RIGHT edge',
  async ({ app }) => {
    const { page } = app;
    const tab = await freshPage(page, app.port, 'he');
    await tab.setViewportSize({ width: 1440, height: 900 });
    await tab.waitForTimeout(600);
    await openPicker(tab);

    // The two columns are the bar's own subjects, and in a right-to-left page
    // IDENTITY is the one on the RIGHT — for free, because the grid is laid out
    // in logical properties and nothing here writes `left` or `right`.
    const order = await tab.evaluate((sel) => {
      const cols = [...document.querySelectorAll(`${sel} .stripickcol`)];
      return cols.map((c) => ({
        s: (c as HTMLElement).dataset.s ?? '',
        x: Math.round(c.getBoundingClientRect().left),
      }));
    }, PANEL);
    expect(order).toHaveLength(2);
    const identity = order.find((c) => c.s === 'identity')!;
    const state = order.find((c) => c.s === 'state')!;
    expect(identity.x, 'the identity column did not reflect to the right edge in Hebrew')
      .toBeGreaterThan(state.x);

    const head = tab.locator(`${PANEL} .mcpanelhead`);
    const from = await head.boundingBox();
    if (from === null) throw new Error('the panel header has no box');
    await tab.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
    await tab.mouse.down();
    await tab.mouse.move(from.x + from.width / 2 - 120, from.y + from.height / 2 + 60,
      { steps: 8 });
    await tab.mouse.up();
    await tab.waitForTimeout(300);

    // **THE STORED PLACE IS LOGICAL, AND IN HEBREW THAT IS THE RIGHT EDGE.**
    // `lib/panel.js` converts the physical delta once, at the boundary; this
    // asserts the conversion happened rather than re-deriving it, which is the
    // division `test/ui/panel.test.ts` and this file already keep.
    const seen = await tab.evaluate(() => {
      const d = document.querySelector('dialog[data-panel="stripfields"]') as HTMLElement;
      const r = d.getBoundingClientRect();
      let raw: string | null = null;
      try { raw = localStorage.getItem('mycontext.panel.stripfields'); } catch { raw = null; }
      return {
        stored: raw === null ? null : JSON.parse(raw) as { start: number; top: number },
        right: r.right,
        view: document.documentElement.clientWidth,
      };
    });
    expect(seen.stored, 'the drag stored nothing').not.toBeNull();
    expect(Math.round(seen.view - seen.right), 'the stored start was measured from the LEFT '
      + 'edge in a right-to-left page').toBe(Math.round(seen.stored!.start));
    await tab.close();
  });
