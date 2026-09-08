// @basis TASK-the-transcript-is-one-document-you-scroll-not-fifty-records,
// TASK-the-viewer-renders-what-the-terminal-showed-with-its,
// TASK-a-conversation-is-rendered-as-a-document-who-spoke-when-and
/**
 * The transcript read as ONE DOCUMENT — `plan:archive seq:7`, `seq:8`, `seq:13`.
 *
 * **The one claim this file exists to make, and the only one a comment cannot
 * make instead: the document ACCOUNTS FOR EVERY RECORD.**
 *
 * A viewer that folds 27,813 records into 4,916 nodes is a viewer that could
 * be quietly dropping twenty thousand of them, and nobody reading the screen
 * would know. So the outline's nodes are asserted to TILE the record space:
 * node `k`'s `first + span` is node `k+1`'s `first`, the first begins at 0, and
 * the spans sum to the record count. That is
 * `INV-nothing-is-dropped-silently` turned into arithmetic rather than into a
 * promise, and it is checked on a fixture AND on the shape the owner's own
 * transcript has.
 *
 * The second claim is the one that makes a virtualised scroll possible at all:
 * **a seek lands where the outline said it would**, across a non-ASCII record.
 * The offsets are BYTE offsets; if they were ever computed from a decoded
 * string every offset after the first Hebrew record would be wrong, and wrong
 * silently — a wrong offset lands mid-record and reports `unreadable` rather
 * than throwing. This project's corpus is half Hebrew, so that is not a
 * hypothetical, and `a seek across a non-ASCII record lands on the record the
 * outline named` is the assertion that would catch it.
 *
 * What is NOT here: the drawing. `render()` needs a real document and this
 * project carries no browser dependency for `node --test` — the limit every
 * screen test in this directory states. The screen was driven in Playwright in
 * both languages before this file was written, and `e2e/conversations.spec.ts`
 * holds it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  DOCUMENT_WALK_CAP, WORK_RUN_CAP, buildOutline, readNodes,
  apiConversationOutline, apiConversationNodes,
} from '../../src/ui/read-model-conversation-document.ts';
import { iterateTranscript, projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const text = (t: string): unknown[] => [{ type: 'text', text: t }];
const toolUse = (name: string, input: unknown): unknown[] => [{ type: 'tool_use', name, input }];
const toolResult = (content: string, isError = false): unknown[] =>
  [{ type: 'tool_result', content, is_error: isError }];

interface Box {
  ws: Workspace;
  dir: string;
  cwd: string;
  file: (session: string) => string;
  write: (session: string, lines: unknown[]) => void;
  writeRaw: (session: string, body: string) => void;
  scan: () => void;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-convdoc-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-convdoc-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  process.env['CLAUDE_CONFIG_DIR'] = home;
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  const file = (session: string): string => path.join(dir, `${session}.jsonl`);
  return {
    ws,
    dir,
    cwd,
    file,
    write: (session, lines) => {
      writeFileSync(file(session), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
    },
    writeRaw: (session, body) => { writeFileSync(file(session), body); },
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    dispose: () => {
      delete process.env['CLAUDE_CONFIG_DIR'];
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/**
 * A session with every shape the document has to place: words on both sides,
 * a tool call and its result, book-keeping records carrying no `message` at
 * all, a line that will not parse, and — the one that matters most for the
 * offsets — Hebrew, early, so every byte offset after it is past a multi-byte
 * character.
 */
const SESSION: unknown[] = [
  { type: 'user', message: { role: 'user', content: 'build the archive viewer' }, timestamp: '2026-09-08T09:00:00.000Z', gitBranch: 'master' },
  { type: 'ai-title', aiTitle: 'The conversation archive' },
  { type: 'assistant', message: { role: 'assistant', content: text('קודם כול אקרא את המפרט — **one** document.') }, timestamp: '2026-09-08T09:00:01.000Z' },
  { type: 'attachment', attachment: { type: 'total_tokens_reminder' } },
  { type: 'assistant', message: { role: 'assistant', content: toolUse('Bash', { command: 'git status', description: 'Show working tree status' }) }, timestamp: '2026-09-08T09:00:02.000Z' },
  { type: 'user', message: { role: 'user', content: toolResult('nothing to commit, working tree clean') }, timestamp: '2026-09-08T09:00:03.000Z' },
  { type: 'queue-operation', operation: 'drain' },
  { type: 'assistant', message: { role: 'assistant', content: toolUse('Read', { file_path: '/tmp/spec.md' }) }, timestamp: '2026-09-08T09:00:04.000Z' },
  { type: 'user', message: { role: 'user', content: toolResult('no such file', true) }, timestamp: '2026-09-08T09:00:05.000Z' },
  { type: 'user', message: { role: 'user', content: '<task-notification>\n<task-id>abc</task-id>\n</task-notification>' }, timestamp: '2026-09-08T09:00:06.000Z' },
  { type: 'assistant', message: { role: 'assistant', content: text('Done — the index rebuilds from disk.') }, timestamp: '2026-09-08T09:00:07.000Z' },
];

/* ══ THE ARITHMETIC: NOTHING IS DROPPED ════════════════════════════════════ */

test('the outline tiles the record space exactly — every record is inside a node', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));

    assert.equal(out.records, SESSION.length, 'every line is a record');
    assert.equal(out.nodes.length, out.said + out.work, 'a node is `said` or `work`, never a third thing');

    let at = 0;
    for (let i = 0; i < out.nodes.length; i += 1) {
      const node = out.nodes[i]!;
      assert.equal(node.n, i, `node ${i} carries its own position`);
      assert.equal(node.f, at, `node ${i} begins where node ${i - 1} ended — no gap, no overlap`);
      assert.ok(node.s > 0, `node ${i} covers at least one record`);
      at += node.s;
    }
    assert.equal(at, out.records,
      'the spans SUM to the record count. A viewer that folds 27,813 records into 4,916 '
      + 'nodes could quietly drop twenty thousand of them and no reader would know; this '
      + 'sum is what makes that impossible rather than merely unlikely.');
  } finally { b.dispose(); }
});

test('a said node is one turn and a work node is a RUN — the fold that makes it readable', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));

    const said = out.nodes.filter((n) => n.k === 'said');
    // Four turns carried words: the prompt, the Hebrew answer, the task
    // notification (person-side text `classifyTurn` counts as a prompt), and
    // the closing answer.
    assert.equal(said.length, 4, 'one node per turn somebody took');
    for (const node of said) assert.equal(node.s, 1, 'a said node is never a run');

    assert.deepEqual(said.map((n) => n.w), ['you', 'claude', 'you', 'claude'],
      'the speaker is read off the turn, in document order');

    // THE FOLD. Seven records carried no words — an `ai-title`, an
    // `attachment`, a `queue-operation`, two tool calls and two tool results —
    // and they became TWO folded runs rather than seven rows: the `ai-title`
    // alone between the prompt and the answer, then the six that run together.
    // A fold per record is not a fold; it is the same list with smaller rows,
    // and it is what the owner saw as "49 folded 0-character rows".
    const work = out.nodes.filter((n) => n.k === 'work');
    assert.equal(work.length, 2, 'consecutive machinery collapses into one node');
    assert.equal(work.reduce((sum, n) => sum + n.s, 0), 7, 'and it still covers all seven records');

    const withTools = work.find((n) => n.x !== undefined && n.x.includes('Bash'));
    assert.ok(withTools, 'a folded run NAMES what ran — a fold that says only "7 steps" cannot be skimmed');
  } finally { b.dispose(); }
});

test('person-side text nobody typed is labelled, never drawn as the person speaking', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const out = buildOutline(b.file('sess-doc'));
    const tagged = out.nodes.filter((n) => n.y !== undefined);
    assert.deepEqual(tagged.map((n) => n.y), ['task-notification']);
    // It keeps its POSITION and its record. Labelling is the disclosure;
    // dropping it would renumber everything after it.
    assert.equal(tagged[0]!.k, 'said');
    assert.equal(tagged[0]!.w, 'you');
  } finally { b.dispose(); }
});

test('the two spellings of the synthetic rule agree, so the copy cannot drift', () => {
  // `read-model-conversation-document.ts` says in its own docblock that
  // `syntheticLabel` is a SECOND spelling of `syntheticKind` in
  // `core/session-summary.ts`, and that the repair is one exported predicate
  // belonging to whoever next opens that file. Until then this is what keeps
  // the copy honest: both are read off disk and their prefix lists compared.
  const mine = readFileSync(path.join(REPO, 'src', 'ui', 'read-model-conversation-document.ts'), 'utf8');
  const theirs = readFileSync(path.join(REPO, 'src', 'core', 'session-summary.ts'), 'utf8');
  const prefixes = (src: string, fn: string): string[] => {
    const at = src.indexOf(fn);
    assert.notEqual(at, -1, `${fn} is gone — this comparison is stale, not passing`);
    const body = src.slice(at, at + 1400);
    return [...body.matchAll(/startsWith\('([^']+)'\)/g)].map((m) => m[1]!).sort();
  };
  assert.deepEqual(
    prefixes(mine, 'function syntheticLabel'),
    prefixes(theirs, 'function syntheticKind'),
    'the archive and the session-summary reader disagree about what a person typed. '
    + 'They are two spellings of one rule and both are measured on the same transcript; '
    + 'fix the copy, or export the predicate and delete this test.');
});

/* ══ THE SEEK: WHY A VIRTUALISED SCROLL IS POSSIBLE ════════════════════════ */

test('a seek across a non-ASCII record lands on the record the outline named', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);

    // The Hebrew answer is record 2, so every node after it sits past a
    // multi-byte character. A character offset would be short by one byte per
    // Hebrew letter here and would land mid-record — reported as `unreadable`
    // rather than thrown, which is the silent failure this asserts away.
    const later = out.nodes.filter((n) => n.f > 2);
    assert.ok(later.length >= 3, 'the fixture has nodes past the non-ASCII record');

    for (const node of later) {
      const walk = iterateTranscript(file, { startByte: node.o, startIndex: node.f });
      const first = walk.next();
      walk.return(undefined);
      assert.equal(first.done, false, `node ${node.n} seeks to a record`);
      assert.equal(first.value!.index, node.f, `node ${node.n} lands on the record it named`);
      assert.equal(first.value!.byteOffset, node.o, 'and at the byte it named');
      assert.notEqual(first.value!.record, null,
        `node ${node.n}'s offset lands on a line start, not inside one — a character `
        + 'offset would land here and report `unreadable`');
    }
  } finally { b.dispose(); }
});

test('readNodes rebuilds exactly the nodes the outline promised, from the middle', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);

    const start = out.nodes[2]!;
    const got = readNodes(file, { at: start.o, from: start.f, node: start.n, count: 3 });
    assert.equal(got.length, 3);
    for (let i = 0; i < got.length; i += 1) {
      const promised = out.nodes[start.n + i]!;
      assert.equal(got[i]!.n, promised.n);
      assert.equal(got[i]!.kind, promised.k);
      assert.equal(got[i]!.who, promised.w);
      assert.equal(got[i]!.first, promised.f, 'the window agrees with the outline about records');
      assert.equal(got[i]!.span, promised.s);
    }
  } finally { b.dispose(); }
});

test('a folded run carries its steps, its tool detail and its failure', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);
    const run = out.nodes.find((n) => n.k === 'work' && (n.x ?? []).some((t) => t.startsWith('Bash')))!;
    const [body] = readNodes(file, { at: run.o, from: run.f, node: run.n, count: 1 });

    assert.equal(body!.kind, 'work');
    assert.equal(body!.steps.length, run.s, 'every record in the run is a step — nothing folded away twice');

    const bash = body!.steps.find((s) => s.tool === 'Bash')!;
    // A fold that says `Bash` forty times cannot be skimmed. 2,123 of the
    // owner's 3,014 tool calls are Bash, so the DETAIL is what makes the
    // summary readable — the call's own `description`, read off its arguments.
    assert.equal(bash.detail, 'Show working tree status');

    const result = body!.steps.find((s) => s.blocks.includes('tool_result'))!;
    assert.match(result.text, /working tree clean/, 'a tool result keeps its output');

    // Book-keeping records carry no message and no text, and they are still
    // steps: a reader who cannot see that a record was there cannot know one
    // was skipped.
    assert.ok(body!.steps.some((s) => s.type === 'ai-title' || s.type === 'attachment'
      || s.type === 'queue-operation'), 'a record with no message is a named step, never a gap');
  } finally { b.dispose(); }
});

test('a tool that failed is carried as failed, not as an ordinary step', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    const file = b.file('sess-doc');
    const out = buildOutline(file);
    let failed = 0;
    for (const node of out.nodes.filter((n) => n.k === 'work')) {
      const [body] = readNodes(file, { at: node.o, from: node.f, node: node.n, count: 1 });
      failed += body!.steps.filter((s) => s.failed).length;
    }
    assert.equal(failed, 1, 'the one `is_error` result is the one marked');
  } finally { b.dispose(); }
});

test('a run longer than the cap splits, and the split still tiles', () => {
  const b = box();
  try {
    const lines: unknown[] = [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ];
    // Three caps' worth of machinery and one word at the end.
    for (let i = 0; i < WORK_RUN_CAP * 3; i += 1) lines.push({ type: 'attachment', attachment: { type: 'x' } });
    lines.push({ type: 'assistant', message: { role: 'assistant', content: text('done') }, timestamp: '2026-09-08T09:01:00.000Z' });
    b.write('sess-long', lines);

    const out = buildOutline(b.file('sess-long'));
    const work = out.nodes.filter((n) => n.k === 'work');
    assert.equal(work.length, 3, 'a run longer than the cap becomes consecutive runs');
    for (const node of work) {
      assert.ok(node.s <= WORK_RUN_CAP,
        'no fold holds more than the cap — a fold nobody can open is worse than two folds');
    }
    let at = 0;
    for (const node of out.nodes) { assert.equal(node.f, at); at += node.s; }
    assert.equal(at, out.records, 'splitting a run does not lose a record');
  } finally { b.dispose(); }
});

test('a line that will not parse is a visible step, never a silent skip', () => {
  const b = box();
  try {
    b.writeRaw('sess-bad', [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello' }, timestamp: '2026-09-08T09:00:00.000Z' }),
      '{ this is not json',
      JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: text('hi') }, timestamp: '2026-09-08T09:00:01.000Z' }),
    ].join('\n') + '\n');

    const out = buildOutline(b.file('sess-bad'));
    assert.equal(out.records, 3, 'the bad line is a record — it occupies a position in the file');
    assert.equal(out.cursor.unreadable, 1, 'and it is counted as unreadable');

    const run = out.nodes.find((n) => n.k === 'work')!;
    const [body] = readNodes(b.file('sess-bad'), { at: run.o, from: run.f, node: run.n, count: 1 });
    assert.equal(body!.steps.length, 1);
    assert.equal(body!.steps[0]!.unreadable, true, 'the gap is drawn as a gap');
  } finally { b.dispose(); }
});

/* ══ THE ROUTES ════════════════════════════════════════════════════════════ */

test('both document routes are registered, so a page can actually reach them', () => {
  registerReadRoutes();
  const paths = registeredRoutes().map((r) => `${r.method} ${r.path}`);
  assert.ok(paths.includes('GET /api/conversations/:id/outline'), paths.join('\n'));
  assert.ok(paths.includes('GET /api/conversations/:id/nodes'), paths.join('\n'));
});

test('the outline endpoint serves the whole document and says how far it read', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const got = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-doc/outline'), { id: 'sess-doc' });
    assert.equal(got.status, 200);
    const body = got.body as {
      present: boolean; records: number; said: number; work: number;
      nodes: unknown[]; truncated: boolean; walkedBytes: number; uncounted: string | null;
    };
    assert.equal(body.present, true);
    assert.equal(body.records, SESSION.length);
    assert.equal(body.said + body.work, body.nodes.length);
    assert.equal(body.truncated, false);
    assert.equal(body.uncounted, null, 'a whole walk has nothing to explain away');
    assert.ok(body.walkedBytes > 0, 'and it says how many bytes it read');
  } finally { b.dispose(); }
});

test('the node endpoint refuses a parameter it cannot act on, and one that is not a number', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const call = (q: string) => apiConversationNodes(
      b.ws, new URL(`http://localhost/api/conversations/sess-doc/nodes${q}`), { id: 'sess-doc' });

    assert.equal(call('?limit=5').status, 400, 'a parameter this route does not take is refused');
    assert.equal(call('?at=-1').status, 400, 'a negative offset is not digits');
    assert.equal(call('?count=many').status, 400);
    assert.equal(call('?at=0&from=0&node=0&count=2').status, 200);
  } finally { b.dispose(); }
});

test('an offset past the end of a growing file is an empty window, not a crash', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    // The transcript grows while it is read — the owner's grew 2.7 MB during
    // this build — so a client holding a minute-old outline asking about a
    // byte that no longer means what it did is a legitimate question, and it
    // gets an empty answer it can re-ask rather than a 500.
    const got = apiConversationNodes(
      b.ws,
      new URL('http://localhost/api/conversations/sess-doc/nodes?at=999999999&from=0&node=0&count=4'),
      { id: 'sess-doc' });
    assert.equal(got.status, 200);
    assert.deepEqual((got.body as { nodes: unknown[] }).nodes, []);
  } finally { b.dispose(); }
});

test('a pruned session is served as a pruned session, never as a failure', () => {
  const b = box();
  try {
    b.write('sess-gone', SESSION);
    b.scan();
    // The harness prunes transcripts and this archive reads them in place
    // rather than copying, so what is gone is gone — and that is a STATE the
    // document reports, with the reason, not an error that reads as damage.
    removeTree(b.file('sess-gone'));
    const got = apiConversationOutline(
      b.ws, new URL('http://localhost/api/conversations/sess-gone/outline'), { id: 'sess-gone' });
    assert.equal(got.status, 200);
    const body = got.body as { present: boolean; nodes: unknown[]; uncounted: string | null };
    assert.equal(body.present, false);
    assert.deepEqual(body.nodes, []);
    assert.match(String(body.uncounted), /no longer on disk/);
  } finally { b.dispose(); }
});

test('an unknown session is a 404 that names the id as data, never as markup', () => {
  const b = box();
  try {
    b.write('sess-doc', SESSION);
    b.scan();
    const got = apiConversationOutline(
      b.ws,
      new URL('http://localhost/api/conversations/x/outline'),
      { id: '<script>canary-9f3a2b</script>' });
    assert.equal(got.status, 404);
    // The id IS named — a refusal a reader cannot act on is its own defect —
    // but it lands in a JSON string field, never in markup, and the screen
    // appends it as a text node. The wording is
    // `read-model-conversations.ts`' own, deliberately, so a reader who meets
    // both endpoints meets one sentence.
    assert.equal(typeof (got.body as { error: string }).error, 'string');
    assert.match((got.body as { error: string }).error, /no indexed conversation/);
  } finally { b.dispose(); }
});

test('the outline reads as far as the index does, so the two screens cannot disagree', () => {
  // `DOCUMENT_WALK_CAP` is `MAX_SCAN_BYTES` and NOT the record endpoint's
  // 64 MB `CONVERSATION_WALK_CAP`. The owner's transcript was 61 MB when this
  // was written and passed 64 MB during the build, so a smaller cap here would
  // have made the document stop before the counts the LIST screen shows for
  // the same file — two screens disagreeing about one transcript.
  assert.equal(DOCUMENT_WALK_CAP, 256 * 1024 * 1024);
});
