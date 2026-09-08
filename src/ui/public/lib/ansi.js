// Terminal escape sequences, turned into nodes — the small half of
// `plan:archive seq:8`, and the half whose SIZE is the whole argument.
//
// ── THE MEASUREMENT THAT DECIDED THIS, AND THE LEAD IT CONTRADICTS ────────
//
// `seq:8` requires the transcript to be measured before the renderer is
// designed — "whether they carry ANSI escapes, pre-rendered text, or
// structured blocks decides this entire task" — and names the likely answer:
// "An ANSI-to-HTML renderer is the obvious candidate; cost it against writing
// one, and say which and why."
//
// Measured on the owner's own transcript, 2026-09-08, 63,871,429 bytes and
// 27,752 records:
//
//     text carrying an ANSI escape sequence            1 record
//     `rendered` fields on `attachment` records    3,684, none with ANSI
//     text carrying a Markdown fence                 175 records
//     text carrying box-drawing characters           103 records
//
// **One record in 27,752.** It is a Playwright timeout quoting its own
// dim-styled call log: `\u001b[2m  - waiting for locator('nav')…\u001b[22m`.
// The transcript is not a terminal capture; it is structured JSON whose text
// blocks hold Markdown. That is the contradiction reported rather than worked
// around, and it moves the weight of `seq:8` onto `lib/markdown.js` — already
// vendored, already pinned, already gated.
//
// ── THE COST, BOTH WAYS ───────────────────────────────────────────────────
//
// So what is left for ANSI is small, and vendoring for it was priced:
//
//     vendor a library     ~9-14 KB of pinned bytes, a new VENDOR.md row with
//                          a byte count and a SHA-256, a re-fetch recipe, a
//                          `FORBIDDEN` scan, and an upgrade ritual — all of it
//                          standing behind 0.004% of records
//     write it here        this file, which a reviewer can read end to end
//
// **Written, not vendored.** The vendor path is real and this project uses it
// where it earns its keep — markdown-it replaced a hand-written renderer that
// put 84% of README.md inside a `<pre>` and lost all 29 tables, which is a
// library doing something genuinely hard. Colouring SGR runs is not that.
//
// ── WHAT IT MUST DO EVEN WHEN NOTHING IS COLOURED ─────────────────────────
//
// The second job is the one that matters on every record rather than on one:
// **escape sequences that are not SGR must be REMOVED, not drawn.** A cursor
// move or a screen clear rendered as literal text puts `[2J` and `[1;1H` in
// the middle of a reader's tool output — which is what "as close as it could
// be to what was seen on the terminal" rules out, since the terminal did not
// show those either.
//
// ── NO COLOUR IS SPELLED HERE ─────────────────────────────────────────────
//
// Every span gets a CLASS and never an inline colour. `styles.css` owns the
// palette in one block scoped to `.tvterm`, which is the discipline
// `VENDOR.md` records for Web Awesome — "one block scoped to `wa-tree` so the
// foreign vocabulary cannot leak onto a screen". A sixteen-colour terminal
// palette is exactly such a foreign vocabulary: it cannot come out of this
// product's five budgeted meaning hues, and it must not leak into them.

/**
 * Every escape sequence, SGR and otherwise.
 *
 * Two alternatives, in this order: CSI (`ESC [ … final`) which is where SGR
 * lives, and everything else worth removing — OSC strings (`ESC ] … BEL` or
 * `ESC ] … ESC \`), and the one- and two-byte escapes. The order matters
 * because CSI must win over the bare-escape branch.
 */
const ESCAPE = /\u001b(?:\[([0-9;:?]*)([ -/]*)([@-~])|\][^\u0007\u001b]*(?:\u0007|\u001b\\)|[@-Z\\-_])/g;

/**
 * SGR parameter → class suffix, for the codes a transcript plausibly carries.
 *
 * Deliberately NOT the whole of ECMA-48. Codes nobody writes cost a rule in
 * `styles.css` and a line here and buy nothing; an unlisted code simply leaves
 * the run's styling unchanged, which is the safe direction — text renders in
 * the reader's own ink rather than in a colour this table guessed at.
 */
const FOREGROUND = {
  30: 'k', 31: 'r', 32: 'g', 33: 'y', 34: 'b', 35: 'm', 36: 'c', 37: 'w',
  90: 'K', 91: 'R', 92: 'G', 93: 'Y', 94: 'B', 95: 'M', 96: 'C', 97: 'W',
};
const BACKGROUND = {
  40: 'k', 41: 'r', 42: 'g', 43: 'y', 44: 'b', 45: 'm', 46: 'c', 47: 'w',
  100: 'K', 101: 'R', 102: 'G', 103: 'Y', 104: 'B', 105: 'M', 106: 'C', 107: 'W',
};

/** A fresh, styleless run. `0` returns here and so does the start of a string. */
function blank() {
  return { fg: null, bg: null, bold: false, dim: false, italic: false, under: false };
}

function same(a, b) {
  return a.fg === b.fg && a.bg === b.bg && a.bold === b.bold && a.dim === b.dim
    && a.italic === b.italic && a.under === b.under;
}

/**
 * Fold one SGR sequence's parameters into the running style.
 *
 * `38`/`48` — the 256-colour and 24-bit forms — are CONSUMED rather than
 * ignored: their arguments follow in the same sequence, and leaving them to
 * the loop would read `38;5;196` as "38, then colour 5, then colour 196" and
 * paint the run the wrong colour. Recognising the introducer and skipping its
 * arguments is what keeps an unsupported colour uncoloured instead of wrong.
 */
function applySgr(style, params) {
  const codes = params === '' ? [0] : params.split(';').map((p) => Number(p.split(':')[0] || 0));
  for (let i = 0; i < codes.length; i += 1) {
    const code = codes[i];
    if (code === 0) { Object.assign(style, blank()); continue; }
    if (code === 1) { style.bold = true; continue; }
    if (code === 2) { style.dim = true; continue; }
    if (code === 3) { style.italic = true; continue; }
    if (code === 4) { style.under = true; continue; }
    if (code === 22) { style.bold = false; style.dim = false; continue; }
    if (code === 23) { style.italic = false; continue; }
    if (code === 24) { style.under = false; continue; }
    if (code === 39) { style.fg = null; continue; }
    if (code === 49) { style.bg = null; continue; }
    if (code === 38 || code === 48) {
      // `38;5;n` is one argument, `38;2;r;g;b` is three. Both are skipped
      // whole; neither is painted, because a 256-colour cube is a palette this
      // viewer does not carry and a wrong colour is worse than none.
      const form = codes[i + 1];
      i += form === 5 ? 2 : form === 2 ? 4 : 1;
      continue;
    }
    if (FOREGROUND[code] !== undefined) { style.fg = FOREGROUND[code]; continue; }
    if (BACKGROUND[code] !== undefined) { style.bg = BACKGROUND[code]; }
  }
}

/** The class list one style wears, or `''` for a run wearing nothing. */
function classesFor(style) {
  const out = [];
  if (style.fg !== null) out.push(`tva-f${style.fg}`);
  if (style.bg !== null) out.push(`tva-b${style.bg}`);
  if (style.bold) out.push('tva-bold');
  if (style.dim) out.push('tva-dim');
  if (style.italic) out.push('tva-it');
  if (style.under) out.push('tva-un');
  return out.join(' ');
}

/**
 * Does this text carry anything this module would change?
 *
 * Cheap, and asked before the work: on the owner's transcript this answers
 * `false` 27,751 times out of 27,752, so the whole of the walk below runs
 * once. A caller that skips straight to `textContent` on a `false` is doing
 * the right thing.
 */
export function hasEscapes(text) {
  return String(text).includes('\u001b');
}

/**
 * `text` → an array of nodes, colours honoured and every other escape removed.
 *
 * `doc` is injected for the reason `lib/markdown.js` gives for the same
 * parameter: it is the only thing here that touches the document, so
 * `node --test` can pass a two-method stand-in and this logic is testable
 * without a browser.
 *
 * **No HTML string is produced anywhere in this function**, which is the same
 * structural guarantee `lib/sanitize.js` names: there is nothing to sanitise
 * because there is nothing to parse. Terminal output is arbitrary text a tool
 * emitted, and it reaches the page through `createTextNode` only.
 */
export function ansiNodes(text, doc) {
  const src = String(text);
  const nodes = [];
  const style = blank();
  let at = 0;

  const push = (chunk) => {
    if (chunk === '') return;
    const classes = classesFor(style);
    if (classes === '') { nodes.push(doc.createTextNode(chunk)); return; }
    const span = doc.createElement('span');
    span.className = classes;
    span.textContent = chunk;
    nodes.push(span);
  };

  ESCAPE.lastIndex = 0;
  for (;;) {
    const match = ESCAPE.exec(src);
    if (match === null) break;
    push(src.slice(at, match.index));
    at = match.index + match[0].length;
    // `m` is SGR — the only sequence that paints. Every other final byte is a
    // cursor move, an erase, a mode switch or an OS command: the terminal
    // acted on it and showed nothing, so this shows nothing too.
    if (match[3] === 'm' && match[2] === '') applySgr(style, match[1] ?? '');
  }
  push(src.slice(at));

  // A run of nodes wearing identical styling is left as it is rather than
  // merged: the walk already emits one node per run, and two adjacent spans
  // can only differ, so there is nothing to coalesce. Recorded because "why
  // no merge pass" is the first question a reader asks here.
  return nodes;
}

/**
 * The same text with every escape sequence gone and nothing coloured.
 *
 * Used where a colour would be noise rather than information — a fold's
 * one-line summary, and the text a filter matches against. A reader searching
 * for `waiting for locator` must not miss it because a `\u001b[2m` sits in the
 * middle of the phrase, which is exactly what a raw `includes` would do.
 */
export function stripEscapes(text) {
  return String(text).replace(ESCAPE, '');
}

export { same as sameStyleForTest, blank as blankStyleForTest };
