/**
 * **THE SCROLL'S ARITHMETIC** — `plan:archive seq:7`, lifted out of
 * `screens/conversations.js` on 2026-09-13 under
 * `TASK-the-largest-client-file-is-seven-movable-units-around-one`.
 *
 * **Why this one moved first.** It is the only part of that file with ZERO
 * closure coupling: three pure things — an estimate, a predicate and a prefix
 * sum — that take their inputs as arguments and reach for nothing. They were
 * already `export`ed and already tested on their own by
 * `test/ui/transcript-viewer.test.ts`, whose own header says why the drawing is
 * not: *"`render()` touches a real document and this project carries no browser
 * dependency for `node --test`"*. That test imports them THROUGH
 * `screens/conversations.js` and was not changed by the move, which is the
 * proof the move took nothing with it.
 *
 * **Why `lib/` and not a second file under `screens/`.** A screen draws; this
 * computes. It holds no string, reads no `ctx` and touches no DOM, which is the
 * shape `lib/passage.js` and `lib/viewmodel.js` already have. It is worth
 * knowing that `test/ui/screen-literals.test.ts` scans `screens/*.js` and not
 * this directory, so a user-facing word must never be added here.
 *
 * **The comments came with the code, whole.** That is the constraint the map
 * of 2026-09-13 put on any split of that file: it documents why each shape was
 * chosen, cites owner rulings and measured numbers, and argues against
 * alternatives that were tried and rejected, so a split loses no institutional
 * memory only as long as the comments move with their code.
 */

/**
 * The first guess at a node's height, in pixels, before it has been drawn.
 *
 * **A guess is all this can be, and the design depends on it being replaced
 * rather than on it being right.** Every drawn row is measured and its true
 * height written back (`Scroller.measure`), so the estimate only has to be
 * good enough that the scrollbar is not absurd on first paint and that the
 * jump when a row is measured is small.
 *
 * The numbers are read off the drawn stylesheet rather than invented:
 * `--fs-1` at 14.5px on a 1.45 line-height is a ~21px line, a turn's heading
 * plus timestamp plus padding is ~58px, and a folded run is one line in a
 * bordered box, ~34px. `CHARS_PER_LINE` is the one honest fudge — prose wraps
 * at a width this function cannot see.
 */
const LINE_PX = 21;
const CHARS_PER_LINE = 92;
const TURN_CHROME_PX = 58;
const WORK_PX = 34;

export function estimateHeight(node) {
  if (node.k === 'work') return WORK_PX;
  const lines = Math.max(1, Math.ceil((node.c || 0) / CHARS_PER_LINE));
  // A `deed` is a heading, the command or the question, and the arguments
  // under it — closer to a turn than to a folded line, and its `c` is what was
  // ASKED rather than what came back, so the same arithmetic reads it.
  return TURN_CHROME_PX + Math.min(lines, 400) * LINE_PX;
}

/**
 * Does this outline node match what the reader typed?
 *
 * **It searches the WHOLE SESSION, and that is the change.** The old filter
 * matched the fifty records that happened to be loaded and the count line said
 * "Showing all {total} entries on this page" — a phrase `seq:7` singles out
 * for presuming a second page the product did not have. The outline holds
 * every node, so there is no page to be on.
 *
 * **What it can and cannot see, stated rather than implied.** The outline
 * carries each turn's OPENING (`p`, 140 characters) and the tools a run ran,
 * not every word of a 61 MB file. So this finds a turn by how it starts and by
 * what ran in it, and the count line says so in as many words. Full text
 * search over the whole transcript is a server-side index this feature does
 * not have and does not pretend to — `INV-nothing-is-dropped-silently` applies
 * to a search's reach as much as to a count's.
 */
export function matchesNode(node, needle, holds = null) {
  if (needle === '') return true;
  const hay = `${node.p ?? ''} ${(node.x ?? []).join(' ')} ${node.y ?? ''} ${node.w ?? ''}`;
  /*
   * **`holds` IS THE FIND PANEL'S OPTIONS, HANDED IN RATHER THAN IMPORTED** —
   * `semantic/9`. Case, whole word and regular expression are decided once, in
   * `lib/fold.js`, and the caller closes over them; this module stays what it
   * was, which is arithmetic and a substring test with no opinion about what a
   * match is.
   *
   * `null` is the shipped path and is byte for byte what it always did: a
   * plain lowercase `includes`, which is the OUTLINE reading — a turn's
   * opening and the tools it ran — and is deliberately simpler than the
   * whole-text scan the server answers with. The two are OR-ed by the caller
   * and each finds rows the other cannot.
   */
  if (holds !== null) return holds(hay);
  return hay.toLowerCase().includes(needle);
}

/**
 * The scroll's arithmetic, kept apart from its drawing so it can be reasoned
 * about — and tested — without a browser.
 *
 * It owns one array of heights over the VIEW (the nodes currently shown, which
 * is every node until a filter narrows it) and the running sum over them.
 * `prefix[i]` is the pixel at which view row `i` begins, so `prefix[view]` is
 * the document's whole height and a binary search over it turns a scroll
 * position into a row index.
 *
 * A plain array and a full re-sum, rather than a Fenwick tree: the owner's
 * session is 4,916 nodes, a re-sum is 4,916 additions, and it runs only when a
 * measurement actually changed something. The clever structure would be real
 * work to read and would save microseconds.
 */
export class Scroller {
  constructor(heights) {
    this.heights = heights;
    this.prefix = new Float64Array(heights.length + 1);
    this.resum();
  }

  resum() {
    const { heights, prefix } = this;
    let total = 0;
    for (let i = 0; i < heights.length; i += 1) {
      prefix[i] = total;
      total += heights[i];
    }
    prefix[heights.length] = total;
  }

  get total() { return this.prefix[this.heights.length]; }

  /** Pixel where view row `i` begins. `i === length` is the document's end. */
  top(i) { return this.prefix[Math.max(0, Math.min(i, this.heights.length))]; }

  /**
   * The first view row whose box contains pixel `y` — a binary search, so a
   * scroll over 4,916 nodes costs thirteen comparisons rather than 4,916.
   */
  at(y) {
    const { prefix, heights } = this;
    if (heights.length === 0) return 0;
    let lo = 0;
    let hi = heights.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (prefix[mid] <= y) lo = mid; else hi = mid - 1;
    }
    return lo;
  }
}
