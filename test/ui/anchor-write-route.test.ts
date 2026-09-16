// @basis REQ-every-anchor-capability-is-reachable-from-the-screen-and-a,
// TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your,
// TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a,
// INV-nothing-is-dropped-silently
/**
 * **THE TEST THAT HOLDS THE NO-WRITES EXCEPTION.**
 *
 * `test/ui/no-writes.test.ts` names three write bindings under `src/ui/` as
 * ruled in — `markAnchor`, `unmarkAnchor` and `markAutomaticAnchors`, all in
 * `src/ui/anchor-write.ts`. That is the STATIC half: it proves which symbols
 * the directory binds and can say nothing at all about what a route DOES.
 *
 * This is the half that bounds the exception, and it is the same shape
 * `src/ui/maintenance/` already uses: an exclusion is not trusted, it is held
 * to the claim that justified it. The claim here is that an anchor write
 * touches **the anchors document and the index, and nothing else** — it is not
 * a corpus mutation, not a shell command, and it never reaches a session
 * transcript. So the corpus is hashed byte for byte before and after a whole
 * round trip through all four routes, and everything outside that pair has to
 * come back identical.
 *
 * **The day one of these routes reaches a corpus item, a config file or a
 * transcript, this goes red at the file it touched**, by name, and the
 * exception in `no-writes.test.ts` stops being true at the same moment.
 *
 * ── AND THE OTHER DIRECTION, WHICH A SNAPSHOT ALONE WOULD MISS ────────────
 *
 * A route that wrote NOTHING would also leave the corpus identical outside the
 * pair. So each write is also asserted to have happened — the row is read back
 * through the CLI's own reader, which is the surface the owner's rulings were
 * given against and the one that must agree with the screen.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync }
  from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { TOKEN_HEADER } from '../../src/ui/security.ts';
import type { RunningUiServer } from '../../src/ui/server.ts';
import { startSafeUiServer } from '../helpers/safe-ui-server.ts';
// Pins the session store out of the real `~/.my-context`; see the module.
import '../helpers/pin-sessions-dir.ts';
import { ConversationIndex } from '../../src/core/conversation-index.ts';
import { projectDirName } from '../../src/core/conversation-index.ts';

const SESSION = 'sess-ui-anchor';

/**
 * A fixture with a table turn, a ruling turn and two turns that are neither.
 *
 * Planted rather than borrowed: the sweep route's report is asserted by COUNT,
 * and a count over a corpus somebody else's test also writes is a number that
 * changes for reasons this file cannot see.
 */
const TURNS = [
  {
    type: 'user',
    message: { role: 'user', content: 'follow RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number' },
    timestamp: '2026-09-10T09:00:00.000Z',
  },
  {
    type: 'assistant',
    message: {
      role: 'assistant',
      content: [{ type: 'text', text: 'measured.\n\n| tokenizer | hits |\n| --- | --- |\n| trigram | 14 |' }],
    },
    timestamp: '2026-09-10T09:00:01.000Z',
  },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: 'the weather was ordinary' }] },
    timestamp: '2026-09-10T09:00:02.000Z',
  },
  {
    type: 'user',
    message: { role: 'user', content: 'שלום, כאן אין מזהה פריט ואין טבלה' },
    timestamp: '2026-09-10T09:00:03.000Z',
  },
];

/** Where record `n` starts, in BYTES — the only position an anchor takes. */
function offsetOf(n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(TURNS[i]), 'utf8') + 1;
  return at;
}

interface Harness {
  cwd: string;
  home: string;
  server: RunningUiServer;
  token: string;
}

async function tokenFor(server: RunningUiServer): Promise<string> {
  const nonce = new URL(server.urlWithNonce(10_000)).hash.slice(1);
  const response = await fetch(`http://127.0.0.1:${server.port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  assert.equal(response.status, 200);
  return ((await response.json()) as { token: string }).token;
}

async function withServer(
  body: (h: Harness) => Promise<void>,
  options: { indexed?: boolean } = {},
): Promise<void> {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchorui-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchorui-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    path.join(dir, `${SESSION}.jsonl`),
    TURNS.map((r) => JSON.stringify(r)).join('\n') + '\n',
  );
  const previousHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    if (options.indexed !== false) runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally {
    process.chdir(previous);
  }
  const server = await startSafeUiServer({ cwd, idleMs: 60_000 });
  try {
    await body({ cwd, home, server, token: await tokenFor(server) });
  } finally {
    await server.close();
    if (previousHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = previousHome;
    removeTree(cwd);
    removeTree(home);
  }
}

const post = (h: Harness, route: string, body: unknown): Promise<Response> =>
  fetch(`http://127.0.0.1:${h.server.port}${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: h.token },
    body: JSON.stringify(body),
  });

const get = (h: Harness, route: string): Promise<Response> =>
  fetch(`http://127.0.0.1:${h.server.port}${route}`, { headers: { [TOKEN_HEADER]: h.token } });

/**
 * **What an anchor write is ALLOWED to move**, and the reason each is named
 * rather than a directory being skipped.
 *
 * `.anchors.jsonl` is the truth this feature is about; `.index.db` is the
 * table rebuilt from it, and its `-wal`/`-shm` sidecars exist the moment a
 * read-only handle opens the database (`core/store.ts` records that
 * measurement). Naming four files is what makes the assertion below say
 * something: a test that excluded `.my_context/` would pass over a route that
 * rewrote every item in the corpus.
 */
const MAY_MOVE = new Set(['.anchors.jsonl', '.index.db', '.index.db-wal', '.index.db-shm']);

function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir).sort()) {
      const full = path.join(dir, entry);
      const key = prefix === '' ? entry : `${prefix}/${entry}`;
      if (statSync(full).isDirectory()) { walk(full, key); continue; }
      if (MAY_MOVE.has(key)) continue;
      out[key] = createHash('sha256').update(readFileSync(full)).digest('hex');
    }
  };
  walk(root, '');
  return out;
}

/** Every anchor the INDEX holds, read the way the CLI reads them. */
function rowsOf(cwd: string): { id: string; label: string; kind: string; origin: string }[] {
  const index = ConversationIndex.openReadOnlyChecked(path.join(cwd, '.my_context', '.index.db'));
  try {
    return index.anchorRows(null).map((r) => ({
      id: r.id, label: r.label, kind: r.kind, origin: r.origin,
    }));
  } finally { index.close(); }
}

test('a whole anchor round trip moves the anchors file and the index, and nothing else', async () => {
  await withServer(async (h) => {
    const corpus = path.join(h.cwd, '.my_context');
    const before = snapshot(corpus);
    assert.ok(Object.keys(before).length > 0,
      'the fixture corpus is empty — this assertion would be measuring nothing');

    const marked = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'the weather turn',
    });
    assert.equal(marked.status, 200);
    const id = ((await marked.json()) as { anchor: { id: string } }).anchor.id;

    assert.equal((await post(h, '/api/conversations/anchors/relabel',
      { id, label: 'renamed by hand' })).status, 200);
    assert.equal((await post(h, '/api/conversations/anchors/sweep', {})).status, 200);
    assert.equal((await post(h, '/api/conversations/anchors/drop', { id })).status, 200);

    assert.deepEqual(snapshot(corpus), before,
      'an anchor write changed something outside .anchors.jsonl and the index. The whole of '
      + 'the exception test/ui/no-writes.test.ts grants src/ui/anchor-write.ts is that an '
      + 'anchor is a row in a rebuildable index and a line in a gitignored document — never a '
      + 'corpus mutation. If that has stopped being true, the ruled write needs re-deciding, '
      + 'not this assertion loosening.');
  });
});

test('the session transcript is never touched by any of the four routes', async () => {
  await withServer(async (h) => {
    const file = path.join(h.home, 'projects', projectDirName(h.cwd), `${SESSION}.jsonl`);
    const was = createHash('sha256').update(readFileSync(file)).digest('hex');
    const wasSize = statSync(file).size;

    const marked = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(1), label: 'the table',
    });
    assert.equal(marked.status, 200);
    const id = ((await marked.json()) as { anchor: { id: string } }).anchor.id;
    await post(h, '/api/conversations/anchors/relabel', { id, label: 'still the table' });
    await post(h, '/api/conversations/anchors/sweep', {});
    await post(h, '/api/conversations/anchors/drop', { id });

    // **This is the measurement the owner's 2026-09-11 ruling rests on** — "an
    // anchor never touches the session file" — and it is asserted rather than
    // repeated. Both the bytes and the size, because a rewrite that happened
    // to be the same length is the one a hash of a truncated read would miss.
    assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'), was,
      'a route changed the transcript it marks a point in');
    assert.equal(statSync(file).size, wasSize, 'the transcript changed length');
  });
});

test('marking writes a row the CLI reads back, as a note the owner made', async () => {
  await withServer(async (h) => {
    const answer = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'the weather turn',
    });
    assert.equal(answer.status, 200);
    const view = ((await answer.json()) as {
      anchor: {
        id: string; label: string; kind: string; origin: string; byteOffset: number;
        sessionId: string; sessionName: string | null; agentId: string | null;
      };
    }).anchor;
    assert.equal(view.label, 'the weather turn');
    // **`origin` is the ROUTE's and can never be the caller's**, which is the
    // property that makes the pass safe to re-run: no page can forge a row the
    // automatic pass is forbidden to read. `kind` gained a DEFAULT on
    // 2026-09-15 rather than losing its pin — a body that says nothing still
    // gets the row this route wrote before that day, and the tests below cover
    // what a body that DOES say something may ask for.
    assert.equal(view.kind, 'note');
    assert.equal(view.origin, 'owner');
    assert.equal(view.byteOffset, offsetOf(2));
    // **THE TWO FIELDS THE ROW CARRIES ONLY SO THE SCREEN CAN NAME THE
    // CONVERSATION**, asserted because a removal proof found nothing holding
    // them: `viewOf` could have answered `null` for both and every other
    // assertion here stayed green, while the card drew a bare id until its
    // next refresh — a flicker that reads as the write half and the read half
    // disagreeing when they do not.
    assert.equal(view.sessionId, SESSION);
    assert.equal(view.sessionName, null, 'nothing has named this session, and that is a fact');
    assert.equal(view.agentId, null);

    const mine = rowsOf(h.cwd).find((r) => r.id === view.id);
    assert.deepEqual(
      mine, { id: view.id, label: 'the weather turn', kind: 'note', origin: 'owner' },
      'the row the screen wrote is not the row the CLI reads — the two surfaces have come apart',
    );
  });
});

test('the same point marked twice is one row with the newer label, never two', async () => {
  await withServer(async (h) => {
    const first = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'first name',
    });
    const second = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'second name',
    });
    const a = ((await first.json()) as { anchor: { id: string } }).anchor.id;
    const b = ((await second.json()) as { anchor: { id: string } }).anchor.id;
    assert.equal(a, b, 'the id is derived from the POSITION, so one point is one row');
    const here = rowsOf(h.cwd).filter((r) => r.id === a);
    assert.equal(here.length, 1);
    assert.equal(here[0]!.label, 'second name');
  });
});

test('relabelling a point the pass marked takes it into the owner\'s hands, and says so', async () => {
  await withServer(async (h) => {
    const list = await get(h, '/api/conversations/anchors');
    const automatic = ((await list.json()) as {
      anchors: { id: string; origin: string; label: string }[];
    }).anchors.filter((a) => a.origin === 'automatic');
    assert.ok(automatic.length > 0,
      'the rebuild marked nothing automatically, so this test has no automatic row to rename '
      + 'and proves nothing about ownership');

    const answer = await post(h, '/api/conversations/anchors/relabel',
      { id: automatic[0]!.id, label: 'mine now' });
    assert.equal(answer.status, 200);
    const body = (await answer.json()) as {
      tookOwnership: boolean; anchor: { origin: string; label: string; kind: string };
    };
    // The DISCLOSURE, which is what `INV-nothing-is-dropped-silently` asks for
    // here: a rename that silently changed what the automatic pass may do to
    // this row would be a reader finding out by the row moving under them.
    assert.equal(body.tookOwnership, true);
    assert.equal(body.anchor.origin, 'owner');
    assert.equal(body.anchor.label, 'mine now');
    // The KIND is carried over, not re-derived — a rename is not a new
    // bookmark, and a kind that moved would reorder his list for a typo fix.
    assert.equal(body.anchor.kind, automatic[0]!.label === undefined ? 'note' : body.anchor.kind);

    // And the pass now leaves it exactly where it is.
    assert.equal((await post(h, '/api/conversations/anchors/sweep', {})).status, 200);
    const after = rowsOf(h.cwd).find((r) => r.id === automatic[0]!.id);
    assert.equal(after?.label, 'mine now',
      'the automatic pass overwrote a label the reader typed — which is the silent loss the '
      + 'ownership transfer exists to prevent');
  });
});

test('the sweep reports what it changed, and a second run reports nothing', async () => {
  await withServer(async (h) => {
    // The rebuild in the harness already ran the pass, so the FIRST run here
    // is already the second — which is the idempotence claim, measured rather
    // than quoted.
    const first = await post(h, '/api/conversations/anchors/sweep', {});
    assert.equal(first.status, 200);
    const one = ((await first.json()) as {
      report: { marked: number; dropped: number; relabelled: number; found: number };
    }).report;
    assert.deepEqual(
      { marked: one.marked, dropped: one.dropped, relabelled: one.relabelled },
      { marked: 0, dropped: 0, relabelled: 0 },
      'a run immediately after a rebuild changed something, so the pass is not idempotent and '
      + 'a button that runs it is not honest',
    );
    assert.ok(one.found > 0,
      'the pass recognised nothing at all, so the zeros above are the zeros of a pass that did '
      + 'not run rather than of one with nothing to do');
  });
});

/**
 * **`{ plan: true }` — THE FIRST PRESS, ANSWERED WITHOUT BEING PERFORMED.**
 *
 * `TASK-a-user-who-installs-mycontext-mid-project-has-conversations`: the
 * first press of the sweep button in a repository whose conversations predate
 * this plugin marks a whole history at once — 1,213 points measured
 * 2026-09-16 over a foreign project's real archive on this machine. The screen
 * therefore asks what it WOULD do before it does it, and this holds the route
 * half of that.
 *
 * FINDING (green): a planning POST answers with the same counts the run
 * produces, split by kind, and changes no row; the default `{}` POST is
 * untouched, which is what every other assertion in this file still sends.
 *
 * **BORROWED POWER, disclosed:** what is in the archive here is the harness's
 * fixture and the counts are the pass's own. The claim held is the DIFFERENCE
 * between the two calls, which is why the same numbers are read twice.
 */
test('a planning sweep answers with the counts and writes nothing', async () => {
  await withServer(async (h) => {
    const before = rowsOf(h.cwd);
    const planned = await post(h, '/api/conversations/anchors/sweep', { plan: true });
    assert.equal(planned.status, 200);
    const body = (await planned.json()) as {
      firstRun: boolean;
      report: { planned: boolean; found: number; byKind: Record<string, number> };
    };
    assert.equal(body.report.planned, true, 'the report says it is a plan');
    assert.ok(body.report.found > 0,
      'the plan recognised nothing at all, so "wrote nothing" below would be the nothing of a '
      + 'pass that never ran');
    assert.equal(
      Object.values(body.report.byKind).reduce((a, b) => a + b, 0), 0,
      'the harness already ran the pass, so a plan here has nothing NEW to offer — and the '
      + 'per-kind split is still present rather than absent',
    );
    assert.deepEqual(rowsOf(h.cwd), before, 'and not one row moved');
    assert.equal(body.firstRun, false,
      'the harness has marked rows already, so this press is not a first one — which is what '
      + 'the screen reads to decide whether to ask');
  });
});

test('the sweep takes back what it no longer recognises, and never a row the reader made', async () => {
  await withServer(async (h) => {
    // A point the grammar does not recognise, marked BY HAND. The pass reads
    // back only what it owns, so this must survive a sweep untouched — the
    // `origin: owner` rule, driven through the route rather than the CLI.
    const byHand = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'ordinary prose',
    });
    const id = ((await byHand.json()) as { anchor: { id: string } }).anchor.id;
    assert.equal((await post(h, '/api/conversations/anchors/sweep', {})).status, 200);
    const kept = rowsOf(h.cwd).find((r) => r.id === id);
    assert.deepEqual(
      kept, { id, label: 'ordinary prose', kind: 'note', origin: 'owner' },
      'the automatic pass touched a point the reader marked at a turn its grammar does not '
      + 'recognise. That is the one thing the pass may never do.',
    );
  });
});

test('dropping a point that is already gone is an answer, not a failure', async () => {
  await withServer(async (h) => {
    const marked = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'briefly',
    });
    const id = ((await marked.json()) as { anchor: { id: string } }).anchor.id;

    const gone = await post(h, '/api/conversations/anchors/drop', { id });
    assert.equal(gone.status, 200);
    assert.equal(((await gone.json()) as { dropped: boolean }).dropped, true);

    const again = await post(h, '/api/conversations/anchors/drop', { id });
    assert.equal(again.status, 200,
      'a second drop answered a failure status. A stale list clicked twice is the ordinary '
      + 'case, and reporting it as an error would make an idempotent removal look broken.');
    assert.equal(((await again.json()) as { dropped: boolean }).dropped, false);

    assert.equal(rowsOf(h.cwd).filter((r) => r.id === id).length, 0);
  });
});

test('a byte offset, a label and a transcript that exists are each required by name', async () => {
  await withServer(async (h) => {
    const cases: { body: unknown; status: number; says: RegExp }[] = [
      { body: { agentId: null, byteOffset: 0, label: 'x' }, status: 400, says: /sessionId/ },
      {
        body: { sessionId: SESSION, byteOffset: 'twelve', label: 'x' },
        status: 400,
        // The refusal names BYTES rather than saying "invalid", because a
        // character offset is the mistake this archive's Hebrew makes certain
        // and it reads as unreadable instead of throwing.
        says: /BYTES/,
      },
      { body: { sessionId: SESSION, byteOffset: -1, label: 'x' }, status: 400, says: /BYTES/ },
      { body: { sessionId: SESSION, byteOffset: 0, label: '   ' }, status: 400, says: /label/ },
      {
        body: { sessionId: SESSION, byteOffset: 0, label: 'x'.repeat(501) },
        status: 400,
        says: /500/,
      },
      {
        body: { sessionId: 'no-such-session', byteOffset: 0, label: 'x' },
        status: 404,
        says: /no transcript/,
      },
    ];
    for (const probe of cases) {
      const answer = await post(h, '/api/conversations/anchors/mark', probe.body);
      assert.equal(answer.status, probe.status, JSON.stringify(probe.body));
      assert.match(((await answer.json()) as { error: string }).error, probe.says);
    }
  });
});

test('a workspace nobody has scanned is answered as itself, and no database is created', async () => {
  await withServer(async (h) => {
    const db = path.join(h.cwd, '.my_context', '.index.db');
    let existed = true;
    try { statSync(db); } catch { existed = false; }
    assert.equal(existed, false,
      'the fixture already holds an index, so this test cannot say whether a write route '
      + 'would have created one');

    for (const [route, body] of [
      ['/api/conversations/anchors/mark',
        { sessionId: SESSION, agentId: null, byteOffset: 0, label: 'x' }],
      ['/api/conversations/anchors/relabel', { id: 'whatever', label: 'x' }],
      ['/api/conversations/anchors/drop', { id: 'whatever' }],
      ['/api/conversations/anchors/sweep', {}],
    ] as [string, unknown][]) {
      const answer = await post(h, route, body);
      assert.equal(answer.status, 200, route);
      assert.equal(((await answer.json()) as { indexed: boolean }).indexed, false, route);
    }

    // **`ConversationIndex.open` creates the tables**, so a handler that
    // reached for a writable handle first would turn the archive on by way of
    // a bookmark — and the end-of-turn refresh, which gates on those tables
    // existing, would start reading this machine's transcripts.
    let created = true;
    try { statSync(db); } catch { created = false; }
    assert.equal(created, false,
      'an anchor write created the conversation index. Marking a bookmark is not a way to turn '
      + 'the archive on — cli/commands/conversation.ts refuses the same thing in the same words.');
  }, { indexed: false });
});

/* ══ A LANE: THE HALF THE DOCUMENT COULD NOT ANSWER ON ITS OWN ════════════ */

/**
 * **An anchor row is keyed by `(sessionId, agentId, byteOffset)`, and a lane
 * document knows only ONE of those two ids.**
 *
 * `subagentAsRow` puts the LANE's id in `sessionId` — correct for a document,
 * and wrong for a bookmark — and `/lane.html` fetches no roster at all, so a
 * viewer marking a point while reading a lane had nothing to file it under.
 * The outline now carries `ownerSessionId` beside it, and these two tests are
 * the pair that holds that: the field says the right thing, and a mark made
 * with it lands where the CLI would have put it.
 */
function lane(f: Harness): { agentId: string; byteOffset: number } {
  const under = path.join(
    path.dirname(path.join(f.home, 'projects', projectDirName(f.cwd), `${SESSION}.jsonl`)),
    SESSION, 'subagents');
  mkdirSync(under, { recursive: true });
  const agentId = 'agent-anchor-lane';
  writeFileSync(path.join(under, `${agentId}.jsonl`),
    JSON.stringify({
      type: 'assistant',
      message: { role: 'assistant', content: [{ type: 'text', text: 'a lane said something' }] },
      timestamp: '2026-09-10T10:01:00.000Z',
    }) + '\n');
  writeFileSync(path.join(under, `${agentId}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: 'the anchor lane',
    toolUseId: 'toolu_anchor_lane', spawnDepth: 1,
  }));
  const previous = process.cwd();
  process.chdir(f.cwd);
  try { runCli(['conversation', 'rebuild'], f.cwd, () => {}); } finally { process.chdir(previous); }
  return { agentId, byteOffset: 0 };
}

test('a lane document says which SESSION its bookmarks belong to, not its own id', async () => {
  await withServer(async (h) => {
    const { agentId } = lane(h);
    const outline = await (await get(h, `/api/conversations/${agentId}/outline`)).json() as
      { sessionId: string; source: string; ownerSessionId: string };
    assert.equal(outline.source, 'subagent');
    assert.equal(outline.sessionId, agentId, 'the document is still addressed by its own id');
    assert.equal(outline.ownerSessionId, SESSION,
      'a lane document that answered its own id here would file every point marked in it under '
      + 'a session that does not exist — and /lane.html fetches no roster to correct it from');

    // A SESSION answers its own id, so the viewer reads one field rather than
    // writing a branch it could get wrong.
    const own = await (await get(h, `/api/conversations/${SESSION}/outline`)).json() as
      { ownerSessionId: string };
    assert.equal(own.ownerSessionId, SESSION);
  });
});

test('a point marked inside a lane is filed under the lane AND its owning session', async () => {
  await withServer(async (h) => {
    const { agentId, byteOffset } = lane(h);
    const answer = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId, byteOffset, label: 'what the lane said',
    });
    assert.equal(answer.status, 200);
    const view = ((await answer.json()) as {
      anchor: { id: string; sessionId: string; agentId: string | null };
    }).anchor;
    assert.equal(view.sessionId, SESSION);
    assert.equal(view.agentId, agentId);

    const index = ConversationIndex.openReadOnlyChecked(
      path.join(h.cwd, '.my_context', '.index.db'));
    try {
      const row = index.anchorRow(view.id);
      assert.equal(row?.agentId, agentId,
        'the lane half of the key was lost, so the point resolves against the session transcript '
        + 'and reads as unreadable — the offset lands mid-record in a file it was never in');
      // `anchorsFor` returns a session's lanes' anchors with its own, which is
      // why the list on the screen shows it at all.
      assert.equal(index.anchorRows(SESSION).some((r) => r.id === view.id), true);
    } finally { index.close(); }
  });
});

/* ══ HIS OWN INPUT OPTIONS — `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your` ══ */

/**
 * **The defect he named:** *"does the user have the same input options so it
 * will be documented it is marked anchores?"* — and the answer was no. A
 * hand-made mark was pinned to `kind: 'note'`, he could type a label and
 * nothing else, and he had made ONE mark in 750 while the pass recorded a
 * kind, a byte, a session, an agent and an instant for every one of its own.
 *
 * The three tests below are the fix and its boundary, in that order: he can
 * say what it is and add a detail; he cannot reach the pass's own vocabulary;
 * and a relabel does not eat what he wrote.
 */
test('he can say what kind of thing it is, in his own words, and add a detail', async () => {
  await withServer(async (h) => {
    const answer = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION,
      agentId: null,
      byteOffset: offsetOf(2),
      label: 'the weather turn',
      kind: 'question',
      note: 'why is this here at all — check before the next pass runs',
    });
    // Read ONCE — a `Response` body is consumed by the first reader, so
    // putting `await answer.text()` in an assertion message is how a 200 test
    // fails with "Body is unusable" instead of with what went wrong.
    const payload = (await answer.json()) as {
      anchor: { kind: string; origin: string; note: string | null; laneName: string | null };
    };
    assert.equal(answer.status, 200, JSON.stringify(payload));
    const view = payload.anchor;
    assert.equal(view.kind, 'question', 'his word for what it is, kept');
    assert.equal(
      view.note, 'why is this here at all — check before the next pass runs',
      'and the sentence that did not fit in the label',
    );
    assert.equal(
      view.origin, 'owner',
      'AND `origin` IS STILL THE ROUTE\'S. The vocabulary he gained does not let a request '
      + 'choose which half of §7 the row belongs to — that pin is what makes the automatic '
      + 'pass safe to re-run and it is not being traded away for this.',
    );
    assert.equal(
      view.laneName, null,
      'the main session marked this one, and that is a fact rather than a missing lane name',
    );

    const index = ConversationIndex.openReadOnlyChecked(
      path.join(h.cwd, '.my_context', '.index.db'),
    );
    try {
      const row = index.anchorRows(null).find((r) => r.kind === 'question');
      assert.equal(
        row?.note, 'why is this here at all — check before the next pass runs',
        'the detail reached the ROW and not only the answer — a field that lived in the '
        + 'response alone would be a capability the screen describes rather than has',
      );
    } finally { index.close(); }
  });
});

test('a request cannot ask for a kind the automatic pass writes', async () => {
  await withServer(async (h) => {
    for (const kind of ['table', 'ruling']) {
      const refused = await post(h, '/api/conversations/anchors/mark', {
        sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'forged', kind,
      });
      assert.equal(
        refused.status, 400,
        `a request asked for kind "${kind}" and the route allowed it. The owner's vocabulary `
        + 'is kept DISJOINT from the automatic one so that reconciliation can never mistake a '
        + 'bookmark he made for one it made.',
      );
      const body = (await refused.json()) as { error?: string };
      assert.match(
        body.error ?? '', /note, decision, question, defect, evidence, todo/,
        'and the refusal NAMES what he may say instead — a 400 that does not is a door with no '
        + 'handle on it',
      );
    }

    const nonsense = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'x', kind: 'whatever',
    });
    assert.equal(nonsense.status, 400, 'and a word this build has no meaning for is refused too');

    assert.deepEqual(
      rowsOf(h.cwd).filter((r) => r.label === 'forged' || r.label === 'x'), [],
      'AND NOTHING WAS WRITTEN. A route that refused with a 400 after putting the row in would '
      + 'be the same defect wearing a status code.',
    );

    // The anti-vacuity half: the same route, one word different, succeeds.
    const allowed = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION, agentId: null, byteOffset: offsetOf(2), label: 'kept', kind: 'evidence',
    });
    assert.equal(
      allowed.status, 200,
      'without this the three refusals above are green on a route that refuses everything, '
      + 'which would leave him exactly where the item found him',
    );
  });
});

test('relabelling keeps the detail he wrote unless he clears it himself', async () => {
  await withServer(async (h) => {
    const made = await post(h, '/api/conversations/anchors/mark', {
      sessionId: SESSION,
      agentId: null,
      byteOffset: offsetOf(2),
      label: 'a typo hree',
      kind: 'defect',
      note: 'the paragraph he did not want to type twice',
    });
    const id = ((await made.json()) as { anchor: { id: string } }).anchor.id;

    const fixed = await post(h, '/api/conversations/anchors/relabel', {
      id, label: 'a typo here',
    });
    assert.equal(fixed.status, 200);
    const after = ((await fixed.json()) as {
      anchor: { label: string; kind: string; note: string | null };
    }).anchor;
    assert.equal(after.label, 'a typo here');
    assert.equal(
      after.note, 'the paragraph he did not want to type twice',
      'AN ABSENT `note` CARRIES THE EXISTING ONE OVER. A relabel that reset it would erase a '
      + 'paragraph every time he fixed a typo, which is `INV-nothing-is-dropped-silently` in '
      + 'the direction that costs the most.',
    );
    assert.equal(after.kind, 'defect', 'and the kind is his own and is carried over too');

    // The anti-vacuity half, and the other state: an EXPLICIT null clears it.
    // Without this, "absent carries over" is green on a route that ignores the
    // field entirely, which would leave him unable to take a detail back.
    const cleared = await post(h, '/api/conversations/anchors/relabel', {
      id, label: 'a typo here', note: null, kind: 'note',
    });
    const now = ((await cleared.json()) as {
      anchor: { note: string | null; kind: string };
    }).anchor;
    assert.equal(now.note, null, 'an explicit null is a clear, and is distinct from saying '
      + 'nothing at all');
    assert.equal(now.kind, 'note', 'and a given kind is taken, from his vocabulary');

    const refused = await post(h, '/api/conversations/anchors/relabel', {
      id, label: 'a typo here', kind: 'table',
    });
    assert.equal(
      refused.status, 400,
      'and relabel guards the vocabulary exactly as mark does — the only edit path an anchor '
      + 'has must not be the way round the boundary',
    );
  });
});
