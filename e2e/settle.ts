/**
 * **ONE settle, for every walk that visits a screen and then measures it.**
 *
 * ── WHAT A SETTLE HAS TO ANSWER ────────────────────────────────────────────
 *
 * "Has this screen finished drawing?" Four files asked it four different ways,
 * and each of the four was wrong in its own way at least once:
 *
 *   `screen-parity`   count stable → reported `div.scene` and `div.pair`
 *                     missing from a screen that plainly draws them.
 *   `tree-parity`     count stable + a bare `+1/-1` in-flight COUNTER, which
 *                     went NEGATIVE on the landing screen and inverted the
 *                     wait — ten screens inventoried at three nodes apiece,
 *                     green.
 *   `button-contrast` count stable → Doctor measured with zero of its buttons
 *                     drawn, because they are built after a fetch resolves.
 *   `pane-size`       count stable → every screen reported "0 linked", because
 *                     the router's holding chip is two elements that never
 *                     change.
 *
 * Those are four instances of one defect: **a settle that waits on a proxy
 * rather than on the property.** This file is the property, written once.
 *
 * ── THE THREE FACTS IT WAITS ON ────────────────────────────────────────────
 *
 *   the holding chip is GONE   `route()` writes `<p id="screenunread">` into
 *                              the section BEFORE awaiting the screen module,
 *                              deliberately, so the tallest grid row is never a
 *                              blank band (`app.js`, "AND IT SAYS SO WHILE IT
 *                              IS EMPTY"). Two elements, present from the first
 *                              frame, never changing — so "some elements exist
 *                              and the count stopped changing" is satisfied by
 *                              the chip ALONE, and a module import that outlasts
 *                              two polls is measured as a finished screen.
 *
 *                              Its removal is an EVENT IN THE RENDER rather
 *                              than a clock: every screen's `render()` opens
 *                              with `root.replaceChildren()`, uniformly — the
 *                              property `route()` itself leans on twice.
 *
 *   nothing is in flight       Six screens await an endpoint and append
 *                              afterwards, so a heading drawn synchronously is
 *                              the same trap one step along. Counted as a SET
 *                              OF REQUEST OBJECTS and not as a number: the
 *                              boot's own calls may already be in flight when
 *                              these listeners are attached, and their
 *                              `requestfinished` would otherwise decrement a
 *                              total they were never added to and drive it
 *                              negative — measured at `-1`, on the first screen
 *                              of the walk, which made `pending !== 0`
 *                              permanently false.
 *
 *                              `/api/watch/stream` is excluded because it never
 *                              finishes BY DESIGN: the shell's one live
 *                              connection, opened once and held open
 *                              (`app.js`, "THE SHARED LIVE STREAM"). Counting
 *                              it would leave this non-zero from the first
 *                              visit to Watch onward and turn every later
 *                              screen into a timeout.
 *
 *   the count stopped moving   Kept, because it is the only one of the three
 *                              that covers the microtask between a response
 *                              landing and its rows being appended.
 *
 * `requires` adds a fourth for a caller that measures a PARTICULAR kind of
 * node: `button-contrast` reads every `<button>` on the screen, and a screen
 * whose controls arrive with a later fetch has a stable count and no buttons
 * long before it is finished.
 *
 * ── IT REPORTS, IT DOES NOT ASSERT ─────────────────────────────────────────
 *
 * The caller owns the failure message, because the caller knows what the
 * measurement was FOR — `tree-parity` records an unsettled screen as NOT
 * MEASURED in its inventory rather than failing the run, and that distinction
 * would be lost if this file threw. What every caller must do is fail as
 * ITSELF when `settled` is false
 * (`LESSON-every-bound-on-waiting-must-fail-as-itself-or-a-slow-machine`):
 * falling through to the comparison reports a slow machine as a missing
 * element, which is a message about correctness produced by a clock.
 */
import type { Page, Request } from '@playwright/test';

/**
 * The `/api/` reads this page has in flight.
 *
 * Listeners are installed ONCE per page and the set is held against the page
 * itself, so two callers on one page share one truth rather than racing two
 * partial ones. A `WeakMap` so a closed page's set is collectable.
 */
const apiInFlight = new WeakMap<Page, Set<Request>>();

export function pendingApi(page: Page): Set<Request> {
  const already = apiInFlight.get(page);
  if (already !== undefined) return already;
  const live = new Set<Request>();
  apiInFlight.set(page, live);
  const counts = (r: Request): boolean =>
    r.url().includes('/api/') && !r.url().includes('/api/watch/stream');
  page.on('request', (r) => { if (counts(r)) live.add(r); });
  page.on('requestfinished', (r) => { live.delete(r); });
  page.on('requestfailed', (r) => { live.delete(r); });
  return live;
}

export interface SettleOptions {
  /** How many samples before giving up. Default 25. */
  readonly samples?: number;
  /** Milliseconds between samples. Default 400. */
  readonly interval?: number;
  /**
   * A selector, relative to the section, that must MATCH before the screen
   * counts as drawn — for a caller whose next line reads that kind of node.
   */
  readonly requires?: string;
}

export interface SettleResult {
  /** False means the bound was spent. The caller must fail as itself. */
  readonly settled: boolean;
  /** Elements under the section at the last sample. Zero means nothing drew. */
  readonly count: number;
  /** Samples spent, so a caller that traces its own walk can say how long. */
  readonly attempts: number;
  /** `/api` reads still open, for a message that says WHY it did not settle. */
  readonly inFlight: number;
}

/**
 * Wait for `[data-p="<screen>"]` to have actually finished drawing.
 *
 * The caller navigates; this only waits. Navigation is left out deliberately —
 * `button-contrast` composes a screen into a particular state and then measures
 * it, and re-navigating here would reset that state back to the empty one.
 */
export async function settleScreen(
  page: Page, screen: string, options: SettleOptions = {},
): Promise<SettleResult> {
  const samples = options.samples ?? 25;
  const interval = options.interval ?? 400;
  const requires = options.requires ?? null;
  const pending = pendingApi(page);
  let previous = -1;
  let attempts = samples;
  for (let attempt = 0; attempt < samples; attempt += 1) {
    // ONE evaluate, not two or three: every reading must come from the SAME
    // DOM snapshot, or a stale count could be paired with a fresh "the chip is
    // gone" and settle on a combination that was never simultaneously true.
    const { count, holding, has } = await page.evaluate(([s, need]) => ({
      count: document.querySelectorAll(`[data-p="${s}"] *`).length,
      holding: document.querySelector(`[data-p="${s}"] #screenunread`) !== null,
      has: need === null
        || document.querySelector(`[data-p="${s}"] ${need}`) !== null,
    }), [screen, requires] as const);
    if (!holding && has && pending.size === 0 && count > 0 && count === previous) {
      return { settled: true, count, attempts: attempt + 1, inFlight: pending.size };
    }
    previous = count;
    attempts = attempt + 1;
    await page.waitForTimeout(interval);
  }
  return { settled: false, count: previous, attempts, inFlight: pending.size };
}
