// @basis TASK-the-find-options-the-owner-asked-for-twice-in-a-floating,
// INV-nothing-is-dropped-silently,
// CONST-node-24-no-build-step,
// CONST-zero-runtime-dependencies
/**
 * **THE FLOATING PANEL'S RULES** — `src/ui/public/lib/panel.js`, `semantic/9`.
 *
 * This is the FIRST dialog in this product. Measured before it was written:
 * no `showModal`, no `<dialog>` and no dialog styling anywhere under
 * `src/ui/public/`. So there was nothing to be consistent with, and what
 * lands is the house pattern for the two panels that follow — navigation and
 * copy — which is why the frame is a module with rules rather than a box
 * built into one screen.
 *
 * ── WHAT IS HERE AND WHAT IS DELIBERATELY NOT ────────────────────────────
 *
 * Here: the three things that are DECISIONS rather than pixels — what a
 * stored place is, what happens when the store lies or refuses, and where a
 * panel lands when the window it was dragged on is not the window it is
 * opened on. Every one of them is reachable without a browser and every one
 * of them is a way the feature can silently stop working.
 *
 * Not here: `show()` vs `showModal()`, the drag, Escape, the close button and
 * the bring-to-front. Those are facts about a live layout and a live event
 * loop, and `e2e/conversations-find-panel.spec.ts` drives every one of them
 * in both languages — including a real pointer drag, a close, and a reopen at
 * the place it was left. Spec §6's standing limit applies: a green run here
 * verifies the rules, not the pixels.
 *
 * ── THE ITEM'S OWN CONSTRAINT, AND IT IS WHY THE STORE TESTS EXIST ───────
 *
 * *"each remembers where it was dragged, per viewer, in `localStorage` — and
 * the page must render correctly when that read throws or returns nothing,
 * which it does in a private window."* A panel is a convenience; a
 * convenience may not take the product down with it, which is the rule
 * `lib/pane-resize.js` already states in those words.
 */
import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

const PANEL = new URL('../../src/ui/public/lib/panel.js', import.meta.url).href;

interface Place { start: number; top: number }
const { placeKey, readPlace, writePlace, clampPlace } = (await import(PANEL)) as {
  placeKey: (name: string) => string;
  readPlace: (storage: unknown, name: string) => Place | null;
  writePlace: (storage: unknown, name: string, place: Place) => void;
  clampPlace: (
    place: Place, panel: { w: number; h: number }, view: { w: number; h: number },
  ) => Place;
};

/** A store that works. */
function store(seed: Record<string, string> = {}): {
  getItem: (k: string) => string | null;
  setItem: (k: string, v: string) => void;
  seen: Record<string, string>;
} {
  const seen: Record<string, string> = { ...seed };
  return {
    seen,
    getItem: (k) => (k in seen ? seen[k]! : null),
    setItem: (k, v) => { seen[k] = v; },
  };
}

/** A store that refuses, which is what a private window is. */
const angry = {
  getItem(): string { throw new Error('SecurityError'); },
  setItem(): void { throw new Error('QuotaExceededError'); },
};

describe('a panel remembers where it was dragged, per viewer', () => {
  it('keys each panel by its own name, so three panels are three places', () => {
    assert.equal(placeKey('search'), 'mycontext.panel.search');
    assert.notEqual(placeKey('search'), placeKey('navigate'));
  });

  it('writes and reads back the place it was given', () => {
    const s = store();
    writePlace(s, 'search', { start: 376, top: 182 });
    assert.deepEqual(readPlace(s, 'search'), { start: 376, top: 182 });
    assert.equal(readPlace(s, 'navigate'), null, 'and one panel does not read another\'s place');
  });
});

describe('a store that lies, refuses or is empty leaves the panel usable', () => {
  /**
   * **THE ITEM NAMES THIS ONE, so it is first.** A private window throws on
   * the property ACCESS, before any method is called; a page that let that
   * escape would fail on the machines least able to report it.
   */
  it('a store that throws is no place at all, not an exception', () => {
    assert.equal(readPlace(angry, 'search'), null);
    // And writing to it is silent. The assertion is that this line returns.
    writePlace(angry, 'search', { start: 10, top: 10 });
  });

  it('no store at all is no place at all', () => {
    assert.equal(readPlace(null, 'search'), null);
    assert.equal(readPlace(undefined, 'search'), null);
    writePlace(null, 'search', { start: 10, top: 10 });
  });

  it('nothing stored is no place, which is every first open', () => {
    assert.equal(readPlace(store(), 'search'), null);
    assert.equal(readPlace(store({ 'mycontext.panel.search': '' }), 'search'), null);
  });

  /**
   * Somebody else's value under this key, or half a write. Not an error to
   * report to a reader: the panel simply opens where it opens.
   */
  it('a value that is not JSON is no place', () => {
    assert.equal(readPlace(store({ 'mycontext.panel.search': 'left:10px' }), 'search'), null);
    assert.equal(readPlace(store({ 'mycontext.panel.search': '{oops' }), 'search'), null);
  });

  /**
   * **`Number.isFinite` AND NOT A BARE `typeof`**, and each line below is one
   * of the two reasons.
   */
  it('a value that is JSON but not two numbers is no place', () => {
    const at = (raw: string): Place | null =>
      readPlace(store({ 'mycontext.panel.search': raw }), 'search');
    // `typeof null === 'object'`, and `null >= 0` is TRUE, so a `typeof`
    // guard passes this and a clamp happily pins the panel at zero.
    assert.equal(at('{"start":null,"top":10}'), null);
    assert.equal(at('null'), null);
    assert.equal(at('[376,182]'), null, 'an array is not a place, however many numbers it holds');
    assert.equal(at('{"start":376}'), null, 'half a place is not a place');
    assert.equal(at('{"start":"376","top":"182"}'), null, 'and a string is not a number');
    // `'1e999'` parses to Infinity, which passes every `>=` anyone would
    // write and clamps to a viewport-sized number rather than being refused.
    assert.equal(at('{"start":1e999,"top":10}'), null);
    assert.equal(at('{"start":0,"top":null}'), null);
  });

  it('a place is rounded, because a fraction of a pixel is not a position', () => {
    assert.deepEqual(
      readPlace(store({ 'mycontext.panel.search': '{"start":376.4,"top":181.6}' }), 'search'),
      { start: 376, top: 182 },
    );
  });
});

describe('a panel opens on the screen, whatever the store says', () => {
  const panel = { w: 448, h: 475 };
  const wide = { w: 2560, h: 1440 };
  const small = { w: 1280, h: 800 };

  it('leaves a place that fits exactly where it is', () => {
    assert.deepEqual(clampPlace({ start: 376, top: 182 }, panel, small), { start: 376, top: 182 });
  });

  /**
   * **THE CASE THE RULE EXISTS FOR.** The reader dragged this to the right of
   * a 2560-wide monitor and is now on a laptop. Without the clamp the panel
   * is off the screen and the feature has silently vanished — there is no
   * error, no empty state, and nothing to click to get it back.
   */
  it('pulls a panel dragged on a wider screen back onto a narrower one', () => {
    const dragged = clampPlace({ start: 2000, top: 1200 }, panel, wide);
    assert.deepEqual(dragged, { start: 2000, top: 1200 }, 'it fitted on the screen it was on');
    const carried = clampPlace(dragged, panel, small);
    assert.equal(carried.start, small.w - panel.w);
    assert.ok(carried.top < small.h, 'and its header is on the screen it is opened on');
  });

  it('never lets a panel go off the start edge or above the top', () => {
    assert.deepEqual(clampPlace({ start: -500, top: -500 }, panel, small), { start: 0, top: 0 });
  });

  it('keeps a grab handle visible at the bottom, so a drag can be undone', () => {
    const low = clampPlace({ start: 0, top: 100000 }, panel, small);
    assert.ok(low.top < small.h, 'the title bar must stay reachable');
    assert.ok(small.h - low.top >= 48, 'and by enough of it to grab');
  });

  /**
   * A panel WIDER than the window clamps to the START edge rather than to a
   * negative number: the start edge is where the title and the close button
   * are, and those are the two things a reader needs when a panel does not
   * fit.
   */
  it('a panel wider than the window keeps its own start edge on screen', () => {
    const huge = { w: 2000, h: 400 };
    assert.equal(clampPlace({ start: 300, top: 10 }, huge, small).start, 0);
  });

  it('rounds, so what is written to the store is what the next viewport reads', () => {
    const at = clampPlace({ start: 10.5, top: 20.4 }, panel, small);
    assert.equal(at.start, Math.round(at.start));
    assert.equal(at.top, Math.round(at.top));
  });
});
