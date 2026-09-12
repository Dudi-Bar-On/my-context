// @basis TASK-a-fold-spends-eleven-lines-saying-some-bookkeeping-happened,
// TASK-the-count-of-helper-agents-is-not-a-link-so-the-only-way-to,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-a-subagent-is-opened-from-the-turn-that-dispatched-it-and,
// TASK-the-row-where-a-lane-reports-back-cannot-say-whose-report-it,
// INV-nothing-is-dropped-silently
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
  laneHref: (agentId: string) => string;
  /** `plan:archive seq:51` — the app's own route, which a lane no longer uses. */
  sessionHref: (id: string) => string;
  laneIndex: (body: unknown) => {
    byCall: Map<string, { agentId: string }>;
    /** `plan:archive seq:49` - the same rows keyed by the lane's own id. */
    byAgent: Map<string | null, { agentId: string; records: number }>;
    total: number;
    unlinked: number;
    owner: string | null;
    read: boolean;
  };
  /** `plan:archive seq:39` — does this record draw anything at all? */
  saysNothing: (step: unknown) => boolean;
  /** `plan:archive seq:41` — the roster's own three pure halves. */
  laneKey: (id: unknown) => string | null;
  rosterOrder: (lanes: unknown) => {
    lane: { agentId: string }; depth: number; children: number;
  }[];
  laneMatches: (lane: unknown, needle: string) => boolean;
  /** `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a` — the
   * address of one marked point, and the read of it. */
  anchorHref: (anchor: { sessionId: string; agentId: string | null; byteOffset: number }) => string;
  anchorFromHash: (hash: string) => { sessionId: string; byteOffset: number } | null;
  rosterHref: (sessionId: string) => string;
  rosterFromHash: (hash: string) => string | null;
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

/* ══ THE LANES A DOCUMENT CAN OPEN ═════════════════════════════════════════ */

/**
 * `plan:archive seq:15`. The screen joins a turn to a lane on a value BOTH
 * SIDES ALREADY RECORDED — the `tool_use` block's `id`, which the lane's
 * sidecar carries as `toolUseId`. These three tests hold the two halves of
 * that join that can be wrong without anybody seeing it in a screenshot: a
 * lane that cannot be linked being silently dropped, and a roster that failed
 * to load being mistaken for a session that dispatched nothing.
 */
test('a lane is keyed by the call that dispatched it, and an unlinkable one is counted not dropped', async () => {
  const { laneIndex } = await viewer();
  const index = laneIndex({
    sessionId: 'sess-1',
    ownerSessionId: 'sess-1',
    total: 3,
    unlinked: 1,
    subagents: [
      { agentId: 'agent-one', toolUseId: 'toolu_ONE', records: 40, present: true },
      { agentId: 'agent-two', toolUseId: 'toolu_TWO', records: 12, present: false },
      // The sidecar was unreadable. It has a transcript worth reading and NO
      // turn to hang it on, so it must not be in the map — and the count that
      // says so must survive, or a reader sees a document with no links and
      // cannot tell that from a session that dispatched nothing.
      { agentId: 'agent-three', toolUseId: null, records: 7, present: true },
    ],
  });

  assert.equal(index.read, true);
  assert.equal(index.byCall.size, 2, 'only the two lanes a turn can actually name');
  assert.equal(index.byCall.get('toolu_ONE')?.agentId, 'agent-one');
  assert.equal(index.byCall.get('toolu_TWO')?.agentId, 'agent-two');
  assert.equal(index.byCall.has('toolu_MISSING'), false);
  assert.equal(index.total, 3, 'the roster is three even though two are reachable');
  assert.equal(index.unlinked, 1, 'INV-nothing-is-dropped-silently: the page says this number');

  // **AND BY THE LANE'S OWN ID** - `plan:archive seq:49`. The turn where a
  // lane REPORTED BACK names it by `<task-id>` and carries no `tool_use` id,
  // so `byCall` cannot answer for it. Every row is keyed here, including the
  // one whose sidecar was unreadable: nothing dispatched it that this document
  // can see, and its report still names it.
  assert.equal(index.byAgent.size, 3, 'every lane, not only the linkable ones');
  assert.equal(index.byAgent.get('agent-three')?.records, 7,
    'a lane with no dispatching call is still reachable from the row it reported on');
});

/**
 * `plan:archive seq:49`, and the SAME asymmetry `laneKey` was written for one
 * screen over.
 *
 * A task notification writes the id BARE - `a44d31ad683f4cb06` - and the
 * roster reads `agentId` off the file name, `agent-a44d31ad683f4cb06.jsonl`.
 * A map keyed by the raw `agentId` would therefore answer nothing for every
 * one of the 187 rows on the owner's session where a lane reported back, and
 * would answer it SILENTLY: the row would draw "there is nothing to open"
 * beside a transcript that is sitting on disk. So the key goes through
 * `laneKey`, which is `plan:archive seq:48`'s normalisation at the reader and
 * the only place in this file that prepends anything.
 */
test('a lane is reachable by the bare id its own report names it with', async () => {
  const { laneIndex, laneKey } = await viewer();
  const index = laneIndex({
    sessionId: 'sess-1',
    ownerSessionId: 'sess-1',
    total: 1,
    unlinked: 0,
    subagents: [
      { agentId: 'agent-a44d31ad683f4cb06', toolUseId: 'toolu_ONE', records: 40, present: true },
    ],
  });

  // What the payload carries, put through the one normaliser.
  assert.equal(index.byAgent.get(laneKey('a44d31ad683f4cb06'))?.records, 40);
  assert.equal(index.byAgent.has('a44d31ad683f4cb06'), false,
    'the bare id is NOT a key of its own - one spelling, normalised at the reader');
});

test('a roster that failed to read is NOT an empty one, and says which it is', async () => {
  const { laneIndex } = await viewer();

  // The refusal path — `ctx.api` threw and the screen caught it into `null`,
  // the same shape `doc.js` gives a document roster it could not fetch.
  const refused = laneIndex(null);
  assert.equal(refused.read, false, 'so `conv.doc.lanesUnread` is drawn');
  assert.equal(refused.byCall.size, 0);
  assert.equal(refused.owner, null);

  // A session that genuinely dispatched none. Identical to the reader unless
  // these two states are told apart HERE, which is the whole reason `read` is
  // a field rather than `byCall.size === 0`.
  const none = laneIndex({ sessionId: 's', ownerSessionId: 's', subagents: [], total: 0, unlinked: 0 });
  assert.equal(none.read, true, 'nothing is drawn: there is nothing to disclose');
  assert.equal(none.byCall.size, 0);
});

test('a lane document keeps the OWNING session, which is not its own id — the depth-2 trap', async () => {
  const { laneIndex, laneHref, sessionHref } = await viewer();

  // The document is `agent-parent`; the roster answered for it is the whole
  // SESSION's, because a lane at depth 2 is filed under the session and its
  // `Agent` call is a record inside this lane's own transcript. 43 of this
  // workspace's 254 lanes are that shape.
  const index = laneIndex({
    sessionId: 'agent-parent',
    ownerSessionId: 'sess-owner',
    total: 1,
    unlinked: 0,
    subagents: [{ agentId: 'agent-child', toolUseId: 'toolu_DEEP', records: 9, present: true }],
  });
  assert.equal(
    index.owner, 'sess-owner',
    'a lane page that showed its own id as the session it came from would be pointing a reader '
    + 'back at the page they are on',
  );
  assert.equal(index.byCall.get('toolu_DEEP')?.agentId, 'agent-child');

  // ── TWO ADDRESSES SINCE `seq:51`, AND THE SPLIT IS THE RULING ──────────
  //
  // Owner ruling 2026-09-09: only a LANE opens bare, and his own SESSION keeps
  // the rail, the strip and the header. So a lane's address is a page of its
  // own and a session's is the app's route, and the two are separate functions
  // rather than one with a flag — the shape follows from WHAT is being opened.
  // They still share one renderer: `/lane.js` imports `mountDocument` from this
  // very module, which is `seq:15`'s "the same renderer, whichever shape wins"
  // spent rather than restated.
  assert.equal(laneHref('agent-child'), '/lane.html?id=agent-child');
  assert.equal(
    laneHref('a b/c'), '/lane.html?id=a%20b%2Fc',
    'an id goes into the query encoded, so nothing in it can be read as another parameter',
  );

  // The SESSION address is root-absolute, and that is load-bearing rather than
  // tidy: `a.tvlanehome` is written on `/lane.html` too, where a bare
  // `#/conversations/<id>` would resolve against the lane window itself and
  // point the reader back at the page they are on.
  assert.equal(sessionHref('sess-owner'), '/#/conversations/sess-owner');
  assert.equal(sessionHref('a b/c'), '/#/conversations/a%20b%2Fc');
});

/* ══ WHAT A FOLD DRAWS AND WHAT IT COUNTS ══════════════════════════════════
 *
 * `plan:archive seq:39`. The owner was shown a fold of eleven rows of which
 * eight could never hold anything and ruled: COUNT THEM AS ONE LINE. The item
 * then names the one thing that had to be decided rather than assumed —
 * WHICH records qualify, DERIVED and not listed — and this is that decision
 * under test, in the only place it can be measured without a browser.
 *
 * The list-of-names spelling was measured before it was rejected. On the
 * owner's own transcript, 2026-09-09, 32,610 records: **50 distinct
 * `type · subtype` keys appear inside folds and 26 of them carry records that
 * draw nothing**, against the eight names the item was raised on.
 */
test('a record qualifies for the collapsed line by DRAWING NOTHING, never by its name', async () => {
  const { saysNothing } = await viewer();
  const bare = {
    index: 31_360, type: 'mode', subtype: null, tool: null, detail: null,
    text: '', input: [], toolUseId: null, failed: false, blocks: [], unreadable: false,
  };
  assert.equal(saysNothing(bare), true, 'the eight the owner was shown');
  // A type nobody has seen yet qualifies on the same test, which is the whole
  // reason the test is derived: a list of eight names rots on the ninth.
  assert.equal(saysNothing({ ...bare, type: 'a-harness-field-invented-tomorrow' }), true);

  // Every clause is one thing `stepParts` would have put on the screen.
  assert.equal(saysNothing({ ...bare, text: 'output' }), false, 'text');
  assert.equal(saysNothing({ ...bare, input: [{ name: 'file_path', value: 'x' }] }), false, 'input');
  assert.equal(saysNothing({ ...bare, detail: 'ran the suite' }), false, 'detail');
  assert.equal(saysNothing({ ...bare, unreadable: true }), false, 'the would-not-parse chip');
  assert.equal(saysNothing({ ...bare, failed: true }), false, 'a failure is counted on the summary');
  assert.equal(
    saysNothing({ ...bare, toolUseId: 'toolu_1' }), false,
    'a step that dispatched a lane carries the only link to that transcript',
  );

  // **THINKING IS NOT COLLAPSED, and this is the correction to the item.**
  // Claude Code writes no reasoning text to a transcript, so such a record's
  // `text` is empty for ever — 2,158 of them in this session. They record
  // that reasoning HAPPENED, which the fold already discloses in its own
  // sentence, and folding them under "nothing but their type" would be false.
  assert.equal(saysNothing({ ...bare, blocks: ['thinking'] }), false);
});

/* ══ THE ROSTER ════════════════════════════════════════════════════════════
 *
 * `plan:archive seq:41`. The owner ruled the shape — A FLAT LIST WITH THE
 * CHILDREN INDENTED, NOT A FOLDER TREE — on a measurement: 221 lanes at depth
 * 1, 43 at depth 2, and only SEVENTEEN of 264 with any children at all.
 */
test('the roster walks parents then children, and the two sides spell an id differently', async () => {
  const { rosterOrder, laneKey } = await viewer();

  // **THE DEFECT THIS FOUND.** `agentId` is read off the file name and carries
  // `agent-`; `parentAgentId` is copied out of the sidecar and does not. This
  // is the first code that ever joined them. Measured on this workspace,
  // 2026-09-09: 43 rows carry a parent, 0 of them matched an `agentId`, and
  // 43 of 43 matched once `agent-` was prepended.
  assert.equal(laneKey('a1'), 'agent-a1');
  assert.equal(laneKey('agent-a1'), 'agent-a1', 'already-prefixed is left alone');
  assert.equal(laneKey(''), null);
  assert.equal(laneKey(null), null);

  const order = rosterOrder([
    { agentId: 'agent-a', parentAgentId: null },
    { agentId: 'agent-b', parentAgentId: null },
    { agentId: 'agent-b1', parentAgentId: 'b' },
    { agentId: 'agent-b2', parentAgentId: 'b' },
    { agentId: 'agent-c', parentAgentId: null },
  ]);
  assert.deepEqual(order.map((r) => r.lane.agentId),
    ['agent-a', 'agent-b', 'agent-b1', 'agent-b2', 'agent-c'],
    'a child is drawn under its own parent, not at the end of the list');
  assert.deepEqual(order.map((r) => r.depth), [1, 1, 2, 2, 1]);
  assert.deepEqual(order.map((r) => r.children), [0, 2, 0, 0, 0],
    'and the parent carries the count, the way a session row already does');
});

test('the roster loses no lane to a parent it cannot resolve, or to a cycle', async () => {
  const { rosterOrder } = await viewer();

  // A lane whose parent is not in this answer is drawn at the top level rather
  // than left out of the walk — `INV-nothing-is-dropped-silently`.
  const orphan = rosterOrder([
    { agentId: 'agent-a', parentAgentId: null },
    { agentId: 'agent-lost', parentAgentId: 'somebody-else' },
  ]);
  assert.deepEqual(orphan.map((r) => r.lane.agentId), ['agent-a', 'agent-lost']);
  assert.deepEqual(orphan.map((r) => r.depth), [1, 1]);

  // A row naming itself as its own parent would recurse for ever, and this
  // list is drawn from an index a rebuild writes rather than from this file.
  const self = rosterOrder([{ agentId: 'agent-x', parentAgentId: 'x' }]);
  assert.deepEqual(self.map((r) => r.lane.agentId), ['agent-x']);
  assert.equal(self.length, 1);

  // Two lanes each claiming the other: nothing may vanish.
  const cycle = rosterOrder([
    { agentId: 'agent-p', parentAgentId: 'q' },
    { agentId: 'agent-q', parentAgentId: 'p' },
  ]);
  assert.equal(cycle.length, 2, 'a cycle costs the nesting, never a row');
  assert.equal(rosterOrder(null).length, 0);
  assert.equal(rosterOrder([null, undefined]).length, 0);
});

test('the roster has an address of its own, and it cannot be read as a session id', async () => {
  const { rosterHref, rosterFromHash, sessionFromHash } = await viewer();

  // `app.js`' `screenFromHash` splits at the FIRST `/` and hands the rest to
  // this module, saying so in as many words — so a second segment reaches the
  // screen with no change to the shell's router.
  const href = rosterHref('sess-1');
  assert.equal(href, '#/conversations/lanes/sess-1');
  assert.equal(rosterFromHash(href), 'sess-1');
  assert.equal(rosterFromHash('#/conversations/sess-1'), null, 'a session is not a roster');
  assert.equal(rosterFromHash('#/conversations'), null);
  assert.equal(rosterFromHash('#/conversations/lanes/'), null, 'an empty id is not an address');
  assert.equal(
    rosterFromHash(rosterHref('a b/c')), 'a b/c',
    'an id goes into the hash encoded and comes back whole',
  );
  assert.equal(
    sessionFromHash(href), 'lanes/sess-1',
    'and the older reader still answers what it always did, which is why the roster is '
    + 'taken FIRST in render()',
  );
});

test('the roster filter reads the brief, the type and the id — never a transcript', async () => {
  const { laneMatches } = await viewer();
  const lane = {
    agentId: 'agent-a1', agentType: 'Explore', description: 'Enumerate bulk precedents',
  };
  assert.equal(laneMatches(lane, ''), true, 'an empty box is the whole roster');
  assert.equal(laneMatches(lane, 'bulk'), true, 'the brief, which is a lane’s only real name');
  assert.equal(laneMatches(lane, 'explore'), true, 'the type, folded to lower case');
  assert.equal(laneMatches(lane, 'agent-a1'), true, 'the id, for a reader holding one');
  assert.equal(laneMatches(lane, 'nothing here'), false);
  assert.equal(
    laneMatches({ agentId: 'agent-b', agentType: null, description: null }, 'b'), true,
    'a lane with no brief is still findable by its id rather than unreachable',
  );
});

/* ══ THE ADDRESS OF A MARKED POINT ═════════════════════════════════════════
 *
 * `REQ-every-anchor-capability-is-reachable-from-the-screen-and-a`,
 * capability 4 — "GO TO, opening the document at the marked point", owner
 * ruling 2026-09-12.
 *
 * Pure and exported for this file's own stated bargain: the two halves of the
 * viewer a mistake would be invisible in a screenshot. An address that dropped
 * its byte still opens the right document, at the wrong place, and looks
 * entirely correct — which is exactly the shape the browser cannot catch by
 * eye. The browser half is driven in `e2e/anchors.spec.ts`, in both languages.
 */

test('a marked point has an address, and it carries the byte the anchor stores', async () => {
  const { anchorHref, laneHref } = await viewer();

  // A SESSION opens in the app, root-absolute for `sessionHref`'s reason: this
  // control is also drawn on `/lane.html`, where a bare fragment would address
  // the lane window itself.
  assert.equal(
    anchorHref({ sessionId: 'sess-a', agentId: null, byteOffset: 4096 }),
    '/#/conversations/at/sess-a/4096',
  );
  // A LANE opens bare, at `laneHref`'s address with the byte beside the id —
  // the same query string, because a fragment on a viewer page is not the
  // shell router's to spend.
  assert.equal(
    anchorHref({ sessionId: 'sess-a', agentId: 'agent-b', byteOffset: 77 }),
    `${laneHref('agent-b')}&at=77`,
  );
  // **BYTE 0 IS AN ADDRESS**, and it is the first turn of every conversation —
  // the one a falsy check would drop. `anchorsFor` returns it, the CLI marks
  // it, and an address builder that tested `byteOffset ? … : …` would send a
  // reader to the end of the document instead.
  assert.equal(
    anchorHref({ sessionId: 'sess-a', agentId: null, byteOffset: 0 }),
    '/#/conversations/at/sess-a/0',
  );
});

test('the address is read back, and anything that is not one is not one', async () => {
  const { anchorFromHash } = await viewer();
  assert.deepEqual(
    anchorFromHash('#/conversations/at/sess-a/4096'),
    { sessionId: 'sess-a', byteOffset: 4096 },
  );
  assert.deepEqual(
    anchorFromHash('#/conversations/at/sess-a/0'),
    { sessionId: 'sess-a', byteOffset: 0 },
    'byte 0 read back as an address, not as the absence of one',
  );
  // **THE THREE ADDRESSES THIS SCREEN NOW HAS MUST NOT READ AS EACH OTHER.**
  // `app.js` splits at the first `/` and hands the rest here untouched, so
  // every one of these reaches this module and only these two functions know
  // what the extra segments mean.
  assert.equal(anchorFromHash('#/conversations/sess-a'), null, 'a plain session document');
  assert.equal(anchorFromHash('#/conversations/lanes/sess-a'), null, 'the roster');
  assert.equal(anchorFromHash('#/conversations'), null, 'the list');
  // A hand-edited address is refused rather than resolved to a guess: a byte
  // that is not digits would be `NaN`, and `nodeAtByte(NaN)` answers -1 for
  // every node — a document that opened nowhere and said nothing.
  assert.equal(anchorFromHash('#/conversations/at/sess-a/many'), null);
  assert.equal(anchorFromHash('#/conversations/at/sess-a/'), null);
  assert.equal(anchorFromHash('#/conversations/at//12'), null);
});
