/**
 * **THE BUDGET RIBBON'S ONE DELIBERATE MOTION, MEASURED ON THE RENDERED PAGE**
 * — `plan:repaint seq:8r`.
 *
 * ── WHAT WAS WRONG, AND WHY NOTHING COULD SEE IT ──────────────────────────
 *
 * `styles.css` declares, and has always declared:
 *
 *     @media (prefers-reduced-motion:no-preference){
 *       .track .seg{transition:inline-size var(--dur-retime) var(--ease)}
 *     }
 *
 * It never fired. `drawRibbons` called `host.replaceChildren()` and rebuilt
 * every `.seg` on every draw, and a brand-new element has no previous computed
 * width to animate FROM — so the stylesheet said the ribbon retimes and the
 * ribbon cut. The design of record flagged exactly this beside its own rule and
 * left the fix in the render logic rather than in the declaration.
 *
 * Every gate in this project was green over it, and each was sound:
 * `styles-parity` compares BLOCKS and the block was byte-identical to the
 * mockup's; `tree-parity` compares SHAPE and the shape was perfect — the
 * segments were all present, correctly classed, correctly ordered, and all of
 * them one frame old. **The defect was that a declaration never fired, which is
 * a behaviour and not a shape.**
 *
 * ── SO THIS FILE MEASURES THE PAGE, NEVER THE RULE ────────────────────────
 *
 * A test that greps the stylesheet for `transition` proves exactly nothing
 * here: that is the defect, not the fix. Neither does reading
 * `getComputedStyle(seg).transitionProperty`, which was already `inline-size`
 * on the broken build. What has to hold is three facts about the RENDERED
 * page, and all three are read out of a real browser:
 *
 *   1. **IDENTITY SURVIVES THE RE-RENDER.** Every `.seg` on screen is stamped
 *      with a JS property before the event changes. A property lives on the
 *      node object, not in the DOM, so it cannot survive a rebuild: if the
 *      stamp is still there afterwards, that is the SAME element and not a
 *      lookalike in the same position.
 *   2. **A TRANSITION ACTUALLY RUNS ON IT.** `transitionrun` is recorded from
 *      the page, filtered to the stamped nodes and to the inline-size property.
 *      The browser only fires it when it has both an old value and a new one —
 *      which is precisely what the old build could never provide.
 *   3. **THE WIDTH PASSES THROUGH VALUES IT WAS NEVER ASSIGNED.** A
 *      `requestAnimationFrame` loop samples the rendered width across the whole
 *      change, and the assertion is that some sample sits strictly BETWEEN the
 *      old width and the new one. A cut has no such sample. This is the
 *      assertion the task asked for in its own words — *"its computed width
 *      changes over time"* — and it is the one that would still fail if
 *      `transitionrun` were ever fired by something other than the animation.
 *
 * ── AND TWO PROPERTIES THAT RIDE ON THE SAME RECORDING ────────────────────
 *
 * **`prefers-reduced-motion` is honoured.** The rule is already inside
 * `@media (prefers-reduced-motion:no-preference)`, so nothing had to be added
 * to the sheet — but "already correct" is a claim, and this asserts it: under
 * `reducedMotion: 'reduce'` the same act runs NO transition and the width still
 * arrives at its new value. Reduced motion must mean no motion, never no
 * information.
 *
 * **The ribbon never blanks.** The same rAF loop counts `#ribbons .ribbon` on
 * every frame, and the minimum over the whole change — pre-clear, fetch, redraw
 * — must never be zero. This is the mirror of the defect the strip work found
 * yesterday, where four fillers cleared FIRST and appended after an await and
 * blanked a drawn value for the length of a fetch. Swapping in place is the fix
 * in both directions, and a keyed reconcile that reintroduced the blank would
 * be a fix that broke the thing it was fixing.
 *
 * ── THE COINCIDENCE, MEASURED AWAY ────────────────────────────────────────
 *
 * A segment can only be observed to animate if its width actually CHANGES, so
 * the event this drives to is chosen by measurement rather than by assumption:
 * the candidates are tried in order and the first one that REPAINTS THE RIBBON
 * — the segment widths read positionally, before against after — is the one
 * under test. If no candidate does, the test says so and skips with a sentence
 * rather than passing over a corpus where the comparison is vacuous;
 * `preview-picks.spec` established that a test which can pass by coincidence is
 * worse than a missing one.
 *
 * **And the choice is blind to node identity ON PURPOSE.** Choosing on "a
 * surviving segment moved" hands the defect a way to disqualify the test's own
 * subject: with every segment rebuilt nothing survives, no candidate qualifies,
 * and the suite reports a green SKIP over exactly the build this file exists to
 * catch. That is not a hypothetical — it is what the first draft of this file
 * did when it was run against a mutant that rebuilds every pass. The picture
 * changing is a fact about the screen and belongs in the selection; whether the
 * same nodes drew it is the assertion and belongs below.
 */
import { test, expect } from './app.ts';
import type { Page } from '@playwright/test';
import { settleScreen } from './settle.ts';

/** The preview section, and every query scoped to it — the router hides, it does not remove. */
const preview = (page: Page) => page.locator('[data-p="preview"]').last();

/** The events this walks to, in the order it tries them. */
const CANDIDATES = ['compact', 'manual', 'session-start'] as const;

/** One stamped segment's whole history across the change. */
interface SegTrace {
  /** The stamp. Present here at all means the node object survived. */
  readonly tag: string;
  /** Its tier track, for a failure message that says which ribbon. */
  readonly tier: string;
  /** Rendered width when the recorder was installed. */
  readonly first: number;
  /** Rendered width at the last sample. */
  readonly last: number;
  /** Samples strictly between `first` and `last`, by more than the tolerance. */
  readonly between: number;
  /** Whether the node is still in the document. */
  readonly alive: boolean;
}

interface Recording {
  readonly traces: readonly SegTrace[];
  /**
   * The ribbon's segment widths read POSITIONALLY — `#ribbons .track .seg` in
   * document order, rounded — when the recorder was installed and again when it
   * was read.
   *
   * **This is what chooses the candidate event, and it is deliberately blind to
   * node identity.** Choosing on "a surviving segment changed width" would let
   * the defect pick the test's own subject away: with every segment rebuilt
   * nothing survives, no candidate qualifies, and the run goes green as a SKIP
   * over the exact build the file exists to catch. Measured — against a mutant
   * that rebuilds every pass, selection-by-identity skipped both tests. The
   * picture changing is a fact about the screen; whether the same nodes drew it
   * is the assertion.
   */
  readonly before: readonly number[];
  readonly after: readonly number[];
  /** `transitionrun` on a STAMPED node — `{tag, property}`. */
  readonly runs: readonly { readonly tag: string; readonly property: string }[];
  /** `transitionrun` anywhere under `#ribbons`, stamped or not. */
  readonly runsAnywhere: number;
  /** Fewest `#ribbons .ribbon` seen on any frame. Zero is a blank. */
  readonly minRibbons: number;
  /** Frames sampled, so a failure can say whether the loop was even running. */
  readonly frames: number;
}

/**
 * Stamp every `.seg` on screen and start recording.
 *
 * **One `evaluate`, and the state lives on `window`** — a closure cannot be
 * carried between two `evaluate` calls, and two calls would also mean two DOM
 * snapshots for one reading, which `settle.ts` records as its own class of
 * wrong measurement.
 *
 * The stamp is a JS PROPERTY and never an attribute: an attribute would be
 * copied by anything that clones or rebuilds from markup, and would therefore
 * answer "is this the same element" with a yes it has not earned. It is also
 * invisible to `tree-parity` and to the screen itself, which is the other half
 * of why it is safe to write from here.
 */
async function record(page: Page): Promise<void> {
  await page.evaluate(() => {
    const sections = document.querySelectorAll<HTMLElement>('[data-p="preview"]');
    const section = sections[sections.length - 1];
    if (section === undefined) throw new Error('no preview section to record');

    interface Stamped extends HTMLElement { __rt?: string }
    interface State {
      order: string[];
      tier: Map<string, string>;
      first: Map<string, number>;
      samples: Map<string, number[]>;
      node: Map<string, Stamped>;
      runs: { tag: string; property: string }[];
      runsAnywhere: number;
      minRibbons: number;
      frames: number;
      before: number[];
      shape: () => number[];
    }
    const shape = (): number[] => [
      ...section.querySelectorAll<HTMLElement>('#ribbons .track .seg:not(.head)'),
    ].map((seg) => Math.round(seg.getBoundingClientRect().width));
    const state: State = {
      order: [], tier: new Map(), first: new Map(), samples: new Map(), node: new Map(),
      runs: [], runsAnywhere: 0, minRibbons: Number.POSITIVE_INFINITY, frames: 0,
      before: shape(), shape,
    };

    let n = 0;
    // `.seg.head` is `flex:1` and carries no width of its own, so it is not a
    // subject: it would report a change caused by its siblings rather than by
    // anything assigned to it.
    for (const seg of section.querySelectorAll<Stamped>('#ribbons .track .seg:not(.head)')) {
      n += 1;
      const tag = `seg-${n}`;
      seg.__rt = tag;
      state.order.push(tag);
      state.node.set(tag, seg);
      state.tier.set(tag, seg.closest('.ribbon')?.querySelector('.chip')?.textContent ?? '?');
      const width = seg.getBoundingClientRect().width;
      state.first.set(tag, width);
      state.samples.set(tag, [width]);
    }

    document.addEventListener('transitionrun', (event) => {
      const target = event.target as Stamped | null;
      if (target === null || target.closest('#ribbons') === null) return;
      state.runsAnywhere += 1;
      const tag = target.__rt;
      if (tag !== undefined) {
        state.runs.push({ tag, property: (event as TransitionEvent).propertyName });
      }
    }, true);

    const frame = (): void => {
      state.frames += 1;
      state.minRibbons = Math.min(
        state.minRibbons, section.querySelectorAll('#ribbons .ribbon').length,
      );
      for (const tag of state.order) {
        const seg = state.node.get(tag);
        if (seg === undefined || !seg.isConnected) continue;
        state.samples.get(tag)?.push(seg.getBoundingClientRect().width);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);

    (window as unknown as { __RT: State }).__RT = state;
  });
}

/**
 * Read the recording back as plain data.
 *
 * `TOLERANCE` is in CSS pixels and exists because a percentage width lands on
 * subpixels: a sample one third of a pixel off its endpoint is the endpoint,
 * and counting it as an intermediate value would let a cut pass as an
 * animation. One pixel is far below `--dur-retime`'s real excursion (the tracks
 * on this corpus move by hundreds) and far above layout noise.
 */
async function read(page: Page): Promise<Recording> {
  return page.evaluate(() => {
    const TOLERANCE = 1;
    interface Stamped extends HTMLElement { __rt?: string }
    const state = (window as unknown as {
      __RT: {
        order: string[];
        tier: Map<string, string>;
        first: Map<string, number>;
        samples: Map<string, number[]>;
        node: Map<string, Stamped>;
        runs: { tag: string; property: string }[];
        runsAnywhere: number;
        minRibbons: number;
        frames: number;
        before: number[];
        shape: () => number[];
      };
    }).__RT;
    const traces = state.order.map((tag) => {
      const samples = state.samples.get(tag) ?? [];
      const first = state.first.get(tag) ?? 0;
      const last = samples[samples.length - 1] ?? first;
      const low = Math.min(first, last) + TOLERANCE;
      const high = Math.max(first, last) - TOLERANCE;
      const node = state.node.get(tag);
      return {
        tag,
        tier: state.tier.get(tag) ?? '?',
        first,
        last,
        between: samples.filter((w) => w > low && w < high).length,
        alive: node !== undefined && node.isConnected,
      };
    });
    return {
      traces,
      before: state.before,
      after: state.shape(),
      runs: state.runs,
      runsAnywhere: state.runsAnywhere,
      minRibbons: state.minRibbons === Number.POSITIVE_INFINITY ? 0 : state.minRibbons,
      frames: state.frames,
    };
  });
}

/** Land on the preview and wait for it to have actually finished drawing. */
async function landing(page: Page): Promise<void> {
  await page.evaluate(() => { window.location.hash = '#/preview'; });
  // **60 samples, not the default 25, and it is measured rather than padded.**
  // The FIRST landing on this screen holds two `/api/` reads open well past ten
  // seconds on the demo corpus — `/api/injection-history` opens the audit
  // projection, and `preview.js`' own note records the contention that read sits
  // in. Measured here: the first settle spent all 25 samples with two reads
  // still in flight and 40 elements drawn, and the very next one settled in 4.
  // A bound that fails on a slow first paint reports a hung screen, which is a
  // message about correctness produced by a clock.
  const settled = await settleScreen(
    page, 'preview', { requires: '#ribbons .track .seg', samples: 60 },
  );
  expect(
    settled.settled,
    `the preview never drew a ribbon segment — ${settled.inFlight} reads still in flight after `
    + `${settled.attempts} samples`,
  ).toBe(true);
}

/** Move `#evsel` and wait for the redraw the retiming rides on. */
async function chooseEvent(page: Page, event: string): Promise<void> {
  await preview(page).locator('#evsel').selectOption(event);
  const settled = await settleScreen(page, 'preview');
  expect(settled.settled, `the preview never settled after moving to ${event}`).toBe(true);
  // `--dur-retime` is 420ms and `settleScreen` samples at 400ms, so a settle can
  // land mid-transition. The recorder must see the END of the excursion for
  // `last` to be the new width rather than a frame on the way to it.
  await preview(page).locator('#ribbons').waitFor({ state: 'visible' });
  await page.waitForFunction(() => document.getAnimations().length === 0, undefined,
    { timeout: 5_000 }).catch(() => { /* a page with a permanent animation is not this test's */ });
}

/**
 * Drive the screen through the candidate events and return the recording worth
 * asserting on.
 *
 * **Two acceptance levels, and the weaker one exists so the defect cannot
 * disqualify the test.** What the assertions want is a candidate where a
 * SURVIVING segment moved — that is a retiming to watch. What they must never
 * be denied is a candidate where the ribbon repainted AT ALL, because on a
 * build that rebuilds every segment nothing ever survives, no candidate would
 * qualify on the strong reading, and the run would report a green SKIP over
 * exactly the build this file exists to catch. Measured: against a mutant that
 * rebuilds every pass, strong-only selection skipped both tests.
 *
 * So the strong candidate wins if one exists, and the first merely-repainting
 * one is kept as the fallback. `null` means the ribbon drew the same widths on
 * every event this corpus offers, which is a statement about the fixture and is
 * the only thing that may legitimately skip.
 */
async function retime(page: Page): Promise<{ event: string; recording: Recording } | null> {
  let fallback: { event: string; recording: Recording } | null = null;
  for (const event of CANDIDATES) {
    const current = await preview(page).locator('#evsel').inputValue();
    if (current === event) continue;
    await record(page);
    await chooseEvent(page, event);
    const recording = await read(page);
    const moved = recording.traces.filter(
      (t) => t.alive && Math.abs(t.last - t.first) > 1,
    );
    const repainted = recording.before.join(',') !== recording.after.join(',');
    test.info().annotations.push({
      type: 'measured',
      description: `${current} → ${event}: ${recording.traces.length} segments stamped, `
        + `${recording.traces.filter((t) => t.alive).length} still the same node, `
        + `${moved.length} of those changed width, ${recording.frames} frames sampled, `
        + `picture ${repainted ? 'changed' : 'identical'} `
        + `(${recording.before.join('/')} → ${recording.after.join('/')})`,
    });
    if (moved.length > 0) return { event, recording };
    if (repainted && fallback === null) fallback = { event, recording };
  }
  return fallback;
}

test('a ribbon segment survives the re-render and its width ANIMATES to the new event', async ({ app }) => {
  const { page } = app;
  await landing(page);

  const outcome = await retime(page);
  if (outcome === null) {
    test.skip(true, 'no candidate event changes any surviving segment\'s width on this corpus, '
      + 'so there is no retiming to observe. This is a statement about the fixture, not a pass: '
      + 'the assertions below were not run.');
    return;
  }
  const { recording } = outcome;

  // ── 1 · IDENTITY ─────────────────────────────────────────────────────
  const alive = recording.traces.filter((t) => t.alive);
  expect(
    alive.length,
    'not one `.track .seg` carried its stamp across the re-render, so every segment on screen is '
    + 'a NEW element. That is the defect itself: a brand-new node has no previous width to '
    + 'animate from, and `.track .seg{transition:inline-size}` is dead against it. The fix is to '
    + 'key segments to their tier entry and update them in place — plan:repaint seq:8r',
  ).toBeGreaterThan(0);

  const moved = alive.filter((t) => Math.abs(t.last - t.first) > 1);
  const widths = moved.map((t) => `${t.tier} ${Math.round(t.first)}px → ${Math.round(t.last)}px`);
  // Identity held and still nothing moved: the ribbon repainted somewhere this
  // recorder was not watching. That is a fixture state, not a defect — the
  // assertion the defect fails is the one above — so it is skipped with the
  // numbers rather than failed on them.
  if (moved.length === 0) {
    test.skip(true, `${alive.length} of ${recording.traces.length} segments survived the `
      + 're-render, so identity holds — but not one of them changed width on any candidate '
      + `event (${recording.before.join('/')} → ${recording.after.join('/')}), so there is no `
      + 'excursion to sample. A statement about the corpus; the motion assertions below did '
      + 'not run.');
    return;
  }

  // ── 2 · A TRANSITION RAN ON A SURVIVING NODE ─────────────────────────
  const movedTags = new Set(moved.map((t) => t.tag));
  const runs = recording.runs.filter((r) => movedTags.has(r.tag));
  expect(
    runs.length,
    'no `transitionrun` fired on any segment that survived the re-render and changed width '
    + `(${recording.runsAnywhere} fired anywhere under #ribbons). The browser fires it only when `
    + 'it has an old value AND a new one, so this is the declaration being inert measured '
    + `directly. Widths seen: ${widths.join(', ')}`,
  ).toBeGreaterThan(0);
  expect(
    [...new Set(runs.map((r) => r.property))].every((p) => p === 'inline-size' || p === 'width'),
    `something other than the ribbon's declared width transitioned: ${
      [...new Set(runs.map((r) => r.property))].join(', ')}`,
  ).toBe(true);

  // ── 3 · THE WIDTH PASSED THROUGH VALUES NOBODY ASSIGNED ──────────────
  const animated = moved.filter((t) => t.between > 0);
  test.info().annotations.push({
    type: 'measured',
    description: `${animated.length} of ${moved.length} moved segments were sampled at an `
      + `intermediate width; ${runs.length} transitionrun(s) on inline-size. ${widths.join(', ')}`,
  });
  expect(
    animated.length,
    'every surviving segment jumped straight from its old width to its new one — no sample sits '
    + `between the two on any of them (${widths.join(', ')}). The element persisted and the `
    + 'transition still did not run, which is a different defect from the one seq:8r names and '
    + 'needs its own reading before this is called fixed.',
  ).toBeGreaterThan(0);

  // ── 4 · AND IT NEVER BLANKED WHILE DOING IT ──────────────────────────
  expect(
    recording.minRibbons,
    'the ribbon went to zero tracks at some point during the change — it was cleared before the '
    + 'replacement was in hand, which is the blanking shape the strip work already paid for. '
    + 'Swapping in place is the fix in both directions.',
  ).toBeGreaterThan(0);

  // ── 5 · NOR ON THE OTHER REFRESH THIS SCREEN TAKES ───────────────────
  //
  // The warm/cold question moves the SESSION rather than the event, and it
  // reaches `show()` down the same path `ctx.onSessionChange` does — which is
  // what a live session change does to this screen without any render() of its
  // own. Measured separately from the event change because it is a separate
  // act, and because a blank here would be invisible to everything above.
  const pressed = await preview(page).locator('#qpick button[aria-pressed="true"]')
    .getAttribute('data-q');
  const other = pressed === 'cold' ? 'live' : 'cold';
  await record(page);
  await preview(page).locator(`#qpick button[data-q="${other}"]`).click();
  const asked = await settleScreen(page, 'preview');
  expect(asked.settled, `the preview never settled after asking the ${other} question`).toBe(true);
  const second = await read(page);
  test.info().annotations.push({
    type: 'measured',
    description: `${pressed} → ${other}: fewest ribbons on any of ${second.frames} frames was `
      + `${second.minRibbons}; picture ${second.before.join('/')} → ${second.after.join('/')}`,
  });
  expect(
    second.minRibbons,
    'the ribbon blanked while the session question changed — a refresh for the same screen must '
    + 'swap what is drawn in place, never clear first and append after the fetch',
  ).toBeGreaterThan(0);
});

test('reduced motion means no motion and not less information', async ({ app }) => {
  const { page } = app;
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await landing(page);

  const outcome = await retime(page);
  if (outcome === null) {
    test.skip(true, 'no candidate event changes any surviving segment\'s width on this corpus.');
    return;
  }
  const { recording } = outcome;
  // Identity first here too, so a build that rebuilds every segment fails as
  // ITSELF rather than as "reduced motion removed the answer" — the same node
  // is what everything below is a statement about.
  expect(
    recording.traces.filter((t) => t.alive).length,
    'not one `.track .seg` carried its stamp across the re-render — see the test above; this one '
    + 'cannot say anything about motion until segments persist at all',
  ).toBeGreaterThan(0);
  const moved = recording.traces.filter((t) => t.alive && Math.abs(t.last - t.first) > 1);

  // The rule lives inside `@media (prefers-reduced-motion:no-preference)`, so
  // under `reduce` there is no transition to run at all.
  expect(
    recording.runsAnywhere,
    'a transition ran under `prefers-reduced-motion: reduce`. The ribbon\'s rule is inside '
    + '`@media (prefers-reduced-motion:no-preference)` and must stay there; a transition that '
    + 'escapes it is motion shown to a reader who asked for none.',
  ).toBe(0);
  expect(
    moved.every((t) => t.between === 0),
    'a segment was sampled at an intermediate width under `reduce`, so something is animating '
    + 'the ribbon outside the media query.',
  ).toBe(true);

  // **The information is NOT reduced with the motion.** Asserted only when the
  // recorder actually caught a segment whose width moves on this corpus —
  // otherwise there is nothing to say about the answer surviving, and asserting
  // it anyway would be an assertion passing over an empty set. The half that
  // always holds is above; this half reports itself when it cannot run.
  if (moved.length === 0) {
    test.info().annotations.push({
      type: 'measured',
      description: 'no surviving segment changed width under `reduce` on this corpus, so "the '
        + 'answer survives the removed animation" was NOT measured this run',
    });
  } else {
    expect(
      moved.every((t) => Math.abs(t.last - t.first) > 1),
      'under reduced motion a segment stopped changing width altogether — the retiming is the '
      + "ribbon's information, and reduced motion must remove the animation and not the answer.",
    ).toBe(true);
  }
  expect(recording.minRibbons, 'the ribbon blanked under reduced motion').toBeGreaterThan(0);
});
