// @basis TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-the-transcript-is-one-document-you-scroll-not-fifty-records
/**
 * The two pure halves of the transcript viewer: the escape-sequence renderer
 * (`plan:archive seq:8`) and the scroll's arithmetic (`seq:7`).
 *
 * **Why these two and not the drawing.** `render()` touches a real document
 * and this project carries no browser dependency for `node --test` — the limit
 * every screen test in this directory states. What is left is exactly the part
 * where a mistake would be invisible in a screenshot: a scroll that is off by
 * four pixels per row looks fine and is wrong by 20,000 pixels over 4,916
 * nodes, and an escape sequence that is drawn instead of removed is one line
 * of noise in a transcript nobody reads twice. The browser half was driven in
 * Playwright in both languages and lives in `e2e/conversations.spec.ts`.
 *
 * ── THE MEASUREMENT THIS FILE IS BUILT ON ─────────────────────────────────
 *
 * `seq:8` names an ANSI-to-HTML renderer as the likely vendoring candidate and
 * asks for it to be costed. Measured on the owner's own 63,871,429-byte
 * transcript: **ONE record of 27,752 carries an escape sequence at all.** So
 * the module under test here is ~70 hand-written lines rather than a pinned
 * dependency, and the full working is in `lib/ansi.js`' own header.
 *
 * The single real record is reproduced below verbatim, because a renderer
 * tested only on invented input is a renderer tested against its author's
 * imagination.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');

registerHooks({
  resolve: (specifier, context, nextResolve) => {
    if (specifier.startsWith('/')) {
      return { url: pathToFileURL(path.join(PUBLIC, specifier)).href, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

const browserModule = async <T>(...segments: string[]): Promise<T> =>
  (await import(pathToFileURL(path.join(PUBLIC, ...segments)).href)) as T;

interface AnsiModule {
  ansiNodes: (text: string, doc: StandIn) => StandInNode[];
  stripEscapes: (text: string) => string;
  hasEscapes: (text: string) => boolean;
}

/**
 * A two-method document, which is the whole surface `ansiNodes` touches — the
 * same bargain `lib/markdown.js` makes with its own injected `doc`, and the
 * reason both can be tested without a browser.
 */
interface StandInNode {
  tag: string;
  className: string;
  textContent: string;
}
interface StandIn {
  createElement: (tag: string) => StandInNode;
  createTextNode: (text: string) => StandInNode;
}
const doc: StandIn = {
  createElement: (tag) => ({ tag, className: '', textContent: '' }),
  createTextNode: (text) => ({ tag: '#text', className: '', textContent: text }),
};

const ESC = '\u001b';
const ansi = (): Promise<AnsiModule> => browserModule<AnsiModule>('lib', 'ansi.js');

/** The whole rendered string, whatever it was split into. */
const flat = (nodes: StandInNode[]): string => nodes.map((n) => n.textContent).join('');

/* ══ THE ESCAPE RENDERER ═══════════════════════════════════════════════════ */

test('the ONE record in the owner\'s transcript that carries an escape renders as the terminal showed it', async () => {
  const { ansiNodes, hasEscapes } = await ansi();
  // Verbatim from `595db3b1-….jsonl`, the single ANSI-bearing record of
  // 27,752: a Playwright timeout quoting its own dim-styled call log.
  const real = '### Error\nTimeoutError: browserBackend.callTool: Timeout 5000ms exceeded.\n'
    + `Call log:\n${ESC}[2m  - waiting for locator('nav').locator('text=Library')${ESC}[22m\n`;
  assert.equal(hasEscapes(real), true);

  const nodes = ansiNodes(real, doc);
  assert.equal(flat(nodes), '### Error\nTimeoutError: browserBackend.callTool: Timeout 5000ms exceeded.\n'
    + "Call log:\n  - waiting for locator('nav').locator('text=Library')\n",
    'every escape byte is gone from the text — the terminal did not show them either');

  const dim = nodes.find((n) => n.className.includes('tva-dim'));
  assert.ok(dim, 'the dim run is a span, so the colour the terminal showed survives');
  assert.match(dim.textContent, /waiting for locator/);
  assert.equal(dim.tag, 'span');
});

test('a sequence that is not SGR is REMOVED, never drawn — the terminal showed nothing either', async () => {
  const { ansiNodes, stripEscapes } = await ansi();
  const noisy = `${ESC}[2J${ESC}[1;1Hclean${ESC}[K line${ESC}]0;a title\u0007 end`;
  assert.equal(flat(ansiNodes(noisy, doc)), 'clean line end');
  assert.equal(stripEscapes(noisy), 'clean line end');
  // A cursor move rendered as literal text puts `[2J` in the middle of a
  // reader's tool output, which is the failure this whole module exists to
  // avoid on records that carry NO colour at all.
  assert.doesNotMatch(flat(ansiNodes(noisy, doc)), /\[2J|\[1;1H/);
});

test('colour, weight and reset are honoured, and every span is a CLASS never an inline colour', async () => {
  const { ansiNodes } = await ansi();
  const nodes = ansiNodes(`plain${ESC}[1;31mloud${ESC}[0mplain again`, doc);
  assert.equal(flat(nodes), 'plainloudplain again');

  const loud = nodes.find((n) => n.textContent === 'loud')!;
  assert.match(loud.className, /tva-fr/, 'red is a class');
  assert.match(loud.className, /tva-bold/, 'and bold is another');
  assert.equal(Object.prototype.hasOwnProperty.call(loud, 'style'), false,
    'no inline colour is ever written: `styles.css` owns the sixteen-colour palette in one '
    + 'block scoped to `.tvterm`, so the foreign vocabulary cannot leak onto a screen');

  // `0` really resets, so the tail is a bare text node rather than a styled
  // span that happens to look right.
  const tail = nodes[nodes.length - 1]!;
  assert.equal(tail.tag, '#text');
  assert.equal(tail.textContent, 'plain again');
});

test('a 256-colour introducer is consumed whole, so an unsupported colour is uncoloured and never wrong', async () => {
  const { ansiNodes } = await ansi();
  // `38;5;196` is ONE colour. A loop that read it as three codes would see
  // "38, then 5, then 196" and paint the run whatever 196 mapped to — a wrong
  // colour, which is worse than none.
  const nodes = ansiNodes(`${ESC}[38;5;196mred-ish${ESC}[0m${ESC}[38;2;10;20;30mtrue-colour`, doc);
  assert.equal(flat(nodes), 'red-ishtrue-colour');
  for (const node of nodes) {
    assert.doesNotMatch(node.className, /tva-f/, 'no foreground class is guessed at');
  }
});

test('text with no escapes at all is left exactly as it is', async () => {
  const { ansiNodes, hasEscapes, stripEscapes } = await ansi();
  // The common path, and by a long way: 27,751 records of 27,752.
  const ordinary = 'nothing to commit, working tree clean\n  a [bracket] and a 0m that is not an escape';
  assert.equal(hasEscapes(ordinary), false);
  assert.equal(stripEscapes(ordinary), ordinary);
  const nodes = ansiNodes(ordinary, doc);
  assert.equal(flat(nodes), ordinary);
  assert.equal(nodes.length, 1);
  assert.equal(nodes[0]!.tag, '#text');
});

/* ══ THE SCROLL'S ARITHMETIC ═══════════════════════════════════════════════ */

interface ViewerModule {
  Scroller: new (heights: number[]) => {
    total: number;
    top: (i: number) => number;
    at: (y: number) => number;
    heights: number[];
    resum: () => void;
  };
  estimateHeight: (node: { k: string; c: number }) => number;
  matchesNode: (node: Record<string, unknown>, needle: string) => boolean;
  sessionFromHash: (hash: string) => string | null;
}
const viewer = (): Promise<ViewerModule> => browserModule<ViewerModule>('screens', 'conversations.js');

test('the scroll turns a pixel into a row in thirteen comparisons, not four thousand', async () => {
  const { Scroller } = await viewer();
  const s = new Scroller([10, 20, 30, 40]);
  assert.equal(s.total, 100);
  assert.equal(s.top(0), 0);
  assert.equal(s.top(1), 10);
  assert.equal(s.top(4), 100, 'one past the last row is the document\'s end');

  assert.equal(s.at(0), 0);
  assert.equal(s.at(9), 0);
  assert.equal(s.at(10), 1, 'a row owns its own first pixel');
  assert.equal(s.at(59), 2);
  assert.equal(s.at(60), 3);
  assert.equal(s.at(10_000), 3, 'past the end is the last row, never an index off the array');
});

test('the scroll survives an empty document and a single row', async () => {
  const { Scroller } = await viewer();
  // A filter that matches nothing leaves an empty view, and a scroll that
  // divided by its own length would throw exactly there.
  const none = new Scroller([]);
  assert.equal(none.total, 0);
  assert.equal(none.at(0), 0);
  assert.equal(none.at(500), 0);
  const one = new Scroller([42]);
  assert.equal(one.total, 42);
  assert.equal(one.at(41), 0);
  assert.equal(one.at(43), 0);
});

test('a measured height replaces an estimate and the sum follows', async () => {
  const { Scroller } = await viewer();
  const s = new Scroller([10, 20, 30]);
  assert.equal(s.top(2), 30);
  s.heights[0] = 100;
  s.resum();
  assert.equal(s.top(2), 120, 'everything below a corrected row moves by exactly the correction');
  assert.equal(s.total, 150);
});

test('the first guess at a height grows with the words, and a fold is one line', async () => {
  const { estimateHeight } = await viewer();
  const fold = estimateHeight({ k: 'work', c: 40_000 });
  assert.ok(fold < 60, 'a folded run is one line however much it hides — that IS the fold');
  const short = estimateHeight({ k: 'said', c: 20 });
  const long = estimateHeight({ k: 'said', c: 4_000 });
  assert.ok(long > short, 'a longer turn is guessed taller');
  assert.ok(estimateHeight({ k: 'said', c: 0 }) >= short - 1,
    'a turn with no words still has a heading, so it is never zero-height');
  // A 60,000-character turn must not produce a spacer the browser refuses to
  // lay out; the cap is what keeps the guess sane until the measurement lands.
  assert.ok(estimateHeight({ k: 'said', c: 10_000_000 }) < 10_000);
});

test('the filter reads the whole session, not a loaded page', async () => {
  const { matchesNode } = await viewer();
  const turn = { k: 'said', w: 'you', p: 'build the archive viewer', c: 24 };
  const run = { k: 'work', x: ['Bash ×4', 'Read'], s: 6, c: 0 };

  assert.equal(matchesNode(turn, ''), true, 'an empty needle is the whole document');
  assert.equal(matchesNode(turn, 'archive'), true);
  assert.equal(matchesNode(turn, 'ARCHIVE'.toLowerCase()), true);
  assert.equal(matchesNode(turn, 'nothing here'), false);
  // The tools a run ran are searchable too — "where did I run Bash" is a real
  // question about a session, and the outline is the only place that can
  // answer it without reading 61 MB again.
  assert.equal(matchesNode(run, 'bash'), true);
  assert.equal(matchesNode(run, 'grep'), false);
  // A synthetic label is matchable, so "show me the background tasks" works.
  assert.equal(matchesNode({ k: 'said', w: 'you', y: 'task-notification' }, 'task-notification'), true);
});

test('the session id is read off the hash, and an empty one is no session', async () => {
  const { sessionFromHash } = await viewer();
  assert.equal(sessionFromHash('#/conversations'), null);
  assert.equal(sessionFromHash('#/conversations/'), null);
  assert.equal(sessionFromHash('#/conversations/abc-123'), 'abc-123');
  assert.equal(sessionFromHash('#/conversations/a%20b'), 'a b');
});
