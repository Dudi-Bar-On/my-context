/**
 * `GET /api/conversations` and `GET /api/conversations/:id` — `plan:archive
 * seq:2`.
 *
 * **Three claims are worth testing here and everything else is scaffolding.**
 *
 *   1. **The read-only import graph did not widen.** This module reaches
 *      exactly one project file besides itself, and `nothing this endpoint can
 *      reach can write or start a process` walks the real graph and fails if a
 *      writer, the CLI entry or a spawner ever becomes reachable — with a
 *      control that proves the walk can still FAIL. `no-writes.test.ts` owns
 *      the whole-server version; this is the same idea aimed at one pair of
 *      routes, and it exists because the server's graph LEGITIMATELY contains
 *      `execute.ts`.
 *   2. **The endpoint cannot build the index it reads.** Not a promise in a
 *      comment: `serving a corpus that was never scanned creates nothing`
 *      snapshots the workspace, serves both routes against a corpus with no
 *      conversation tables, and asserts the bytes are identical afterwards.
 *      That is the one property a read model most wants to break here — the
 *      index does not exist until a CLI write makes it, and "helpfully"
 *      building one would be a write from the read-only surface.
 *   3. **A capped answer and a complete one do not look the same.** Every
 *      bound is asserted with its disclosure in the same breath, in BOTH
 *      directions, because a test that only checked the short answer would
 *      pass on an endpoint that truncated in silence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversation, apiConversations, CONVERSATION_LIST_CAP, CONVERSATION_RECORD_CAP,
  CONVERSATION_RECORD_DEFAULT, CONVERSATION_TEXT_CAP,
  type ConversationBody, type ConversationListBody,
} from '../../src/ui/read-model-conversations.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { registeredRoutes } from '../../src/ui/routes.ts';
import { registerReadRoutes } from '../../src/ui/server.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '../..');
const rel = (f: string): string => path.relative(REPO, f).split(path.sep).join('/');

/* ── the graph walk, `staging-endpoint.test.ts`' pair, unchanged ─────────── */

/** `command-check.test.ts` · `graphFrom`, verbatim. Type-only edges included. */
function crudeGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(/(?:from|import)\s*\(?\s*(['"])([^'"]+)\1/g)) {
      const spec = m[2];
      if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
      else bare.add(spec);
    }
  }
  return { files, bare };
}

/** The same walk with erased statements dropped — "reachable" means LOADED. */
function runtimeGraph(entry: string): { files: Set<string>; bare: Set<string> } {
  const files = new Set<string>();
  const bare = new Set<string>();
  const queue = [entry];
  const push = (file: string, spec: string): void => {
    if (spec.startsWith('.')) queue.push(path.resolve(path.dirname(file), spec));
    else bare.add(spec);
  };
  while (queue.length > 0) {
    const file = queue.shift() as string;
    if (files.has(file)) continue;
    files.add(file);
    const source = readFileSync(file, 'utf8');
    for (const m of source.matchAll(
      /(?:^|\n)\s*import\s+(type\s+)?([^;]*?)from\s*(['"])([^'"]+)\3/g)) {
      if (m[1] === undefined) push(file, m[4]);
    }
    for (const m of source.matchAll(/(?:^|\n)\s*import\s*(['"])([^'"]+)\1/g)) push(file, m[2]);
    for (const m of source.matchAll(/\bimport\s*\(\s*(['"])([^'"]+)\1/g)) push(file, m[2]);
  }
  return { files, bare };
}

const ENDPOINT = path.join(REPO, 'src', 'ui', 'read-model-conversations.ts');
const INDEX_MODULE = path.join(REPO, 'src', 'core', 'conversation-index.ts');

/**
 * Modules that write. `core/persist.ts` and `core/mutate.ts` put item Markdown
 * on disk; `core/store.ts` is banned here even though `no-writes.test.ts`
 * allows `src/ui/` to bind `Store` for `openReadOnlyChecked` — this pair has no
 * business with the item index at all, and admitting the class would admit
 * `Store.open`'s corruption `rmSync` into a graph whose whole claim is that it
 * cannot create anything.
 */
const FORBIDDEN_WRITERS = [
  'src/core/mutate.ts', 'src/core/persist.ts', 'src/core/store.ts', 'src/core/rebuild.ts',
  'src/core/audit.ts', 'src/core/jsonl-log.ts',
];
/** `command-check.test.ts`' set, unchanged — this endpoint answers, it does not act. */
const FORBIDDEN_SPAWNERS = [
  'src/ui/execute.ts', 'src/ui/execute-catalogue.ts', 'src/ui/execute-effect.ts',
  'src/ui/execute-nonce.ts', 'src/cli/index.ts',
];
const FORBIDDEN_BARE = ['node:child_process', 'child_process'];

test('the index module this endpoint reads through loads nothing from this project', () => {
  const { files, bare } = runtimeGraph(INDEX_MODULE);
  assert.deepEqual(
    [...files].map(rel).sort(), ['src/core/conversation-index.ts'],
    'core/conversation-index.ts must load NOTHING but itself at runtime. That is what lets a '
    + 'read-only surface reach the conversation index at all, and it is the property a later '
    + 'convenience import would quietly spend.',
  );
  assert.deepEqual(
    [...bare].sort(), ['node:fs', 'node:os', 'node:path', 'node:sqlite'],
    'the index module grew a bare import. Every one of these is a platform module with no '
    + 'project code behind it; a new one is a new graph to re-examine.',
  );
});

test('nothing this endpoint can reach can write or start a process', () => {
  const runtime = runtimeGraph(ENDPOINT);
  const crude = crudeGraph(ENDPOINT);

  // Anti-vacuity: a walk that resolved nothing would pass every assertion
  // below, which is the failure mode this whole test guards against elsewhere.
  assert.ok(
    runtime.files.size >= 2,
    `the runtime walk reached ${runtime.files.size} files from read-model-conversations.ts. It `
    + 'imports more than that, so the specifier pattern has stopped matching and this test now '
    + 'proves nothing.',
  );

  const reachable = [...runtime.files].map(rel);
  assert.deepEqual(
    FORBIDDEN_WRITERS.filter((m) => reachable.includes(m)), [],
    'this endpoint can now LOAD a module that writes. The conversation index is created by a '
    + 'CLI write on purpose: a read surface that could build it would be the read-only '
    + 'guarantee failing at the one place this feature most wants to break it.',
  );

  // The spawner check runs on the CRUDE graph, where over-approximating can
  // only make the gate stricter — `command-check.test.ts`' own reasoning.
  const crudeReachable = [...crude.files].map(rel);
  assert.deepEqual(
    FORBIDDEN_SPAWNERS.filter((m) => crudeReachable.includes(m)), [],
    'the conversation endpoint can reach a module that runs commands. It answers; it does not '
    + 'act. Whatever needed this import belongs behind POST /api/execute.',
  );
  assert.deepEqual(
    FORBIDDEN_BARE.filter((m) => crude.bare.has(m)), [],
    'a module reachable from the conversation endpoint imports a process spawner.',
  );

  // The walk is proved able to FAIL, on a module that really does spawn.
  const control = crudeGraph(path.join(REPO, 'src', 'ui', 'execute.ts'));
  assert.ok(
    FORBIDDEN_BARE.some((m) => control.bare.has(m)),
    'the detector no longer notices `node:child_process` in a module that plainly imports it, '
    + 'so the assertions above are green for the wrong reason.',
  );
});

test('both routes are registered, so a page can actually reach them', () => {
  registerReadRoutes();
  const routes = registeredRoutes();
  for (const path of ['/api/conversations', '/api/conversations/:id']) {
    assert.ok(
      routes.some((r) => r.method === 'GET' && r.path === path),
      `${path} has a read model and nothing serves it. \`registerConversationRoutes\` must be `
      + 'called from `registerReadRoutes`, for the same two reasons the calls beside it give — '
      + 'a model that answers is not a route that is served, and `server-e2e.test.ts`\'s sweep '
      + 'accepts a 404.',
    );
  }
});

/* ── the fixture ─────────────────────────────────────────────────────────── */

interface Box {
  ws: Workspace;
  dir: string;
  cwd: string;
  write: (session: string, lines: unknown[]) => void;
  scan: () => void;
  dispose: () => void;
}

const text = (t: string): unknown[] => [{ type: 'text', text: t }];

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-convapi-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-convapi-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  process.env['CLAUDE_CONFIG_DIR'] = home;

  // `projectRoot` is the `.my_context` DIRECTORY in a real workspace, not the
  // repository root — `workspaceCwd` takes its parent. The fixture is built
  // the same way so the endpoint is exercised on the real shape.
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;
  return {
    ws,
    dir,
    cwd,
    write: (session, lines) => {
      writeFileSync(
        path.join(dir, `${session}.jsonl`),
        lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      );
    },
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    dispose: () => {
      delete process.env['CLAUDE_CONFIG_DIR'];
      removeTree(home);
      removeTree(cwd);
    },
  };
}

const url = (q = ''): URL => new URL(`http://localhost/api/conversations${q}`);

/** Every file under a directory with its bytes — the corpus, byte for byte. */
function snapshot(root: string): Record<string, number> {
  const out: Record<string, number> = {};
  const walk = (at: string): void => {
    for (const name of readdirSync(at)) {
      const full = path.join(at, name);
      const stat = statSync(full);
      // WAL and SHM are the two sidecars `server-e2e.test.ts` excludes, for
      // its own reason: a read through SQLite legitimately moves them.
      if (stat.isDirectory()) walk(full);
      else if (!name.endsWith('-wal') && !name.endsWith('-shm')) out[rel(full)] = stat.size;
    }
  };
  walk(root);
  return out;
}

/* ── the claims ──────────────────────────────────────────────────────────── */

/**
 * **The property the whole read/write split exists for, measured rather than
 * promised.**
 */
test('serving a corpus that was never scanned creates nothing', () => {
  const b = box();
  try {
    b.write('a1', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    const before = snapshot(b.cwd);

    const list = apiConversations(b.ws, url());
    assert.equal(list.status, 200, 'a corpus nobody scanned is a state, not an error — and a '
      + '400 would fail server-e2e.test.ts\'s sweep, which accepts 200 and 404 only');
    const body = list.body as ConversationListBody;
    assert.equal(body.indexed, false);
    assert.deepEqual(body.conversations, []);
    assert.equal(body.total, 0);
    assert.ok(body.dir.length > 0, 'it names where it looked, so "nothing here" can be told '
      + 'from "looked in the wrong place"');
    assert.equal(body.rebuild, 'mycontext conversation rebuild',
      'the command that would fill it — composed, never run');

    const one = apiConversation(b.ws, url(), { id: 'a1' });
    assert.equal(one.status, 404, 'nothing is indexed, so this session is not known here');

    assert.deepEqual(
      snapshot(b.cwd), before,
      'a SERVED READ created or grew a file. The conversation index is built by a CLI write on '
      + 'purpose, and a read model that built its own would be exactly the write this '
      + 'read-only server promises it cannot make.',
    );
  } finally { b.dispose(); }
});

test('an indexed but empty archive is a different answer from an unscanned one', () => {
  const b = box();
  try {
    b.scan();
    const body = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(body.indexed, true, 'the scan RAN — that is a measured zero');
    assert.equal(body.total, 0);
    assert.deepEqual(body.conversations, []);
  } finally { b.dispose(); }
});

test('the list is bounded, and says what it held back in both directions', () => {
  const b = box();
  try {
    for (let i = 0; i < 5; i++) {
      b.write(`s${i}`, [
        { type: 'user', message: { role: 'user', content: 'hi' }, timestamp: `2026-09-0${i + 1}T00:00:00.000Z` },
      ]);
    }
    b.scan();

    const whole = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(whole.total, 5);
    assert.equal(whole.conversations.length, 5);
    assert.equal(whole.omitted, 0, 'nothing was held back, and the field says zero rather than '
      + 'being absent — a reader must be able to tell a complete answer from an unbounded one');
    assert.equal(whole.more, false);

    const page = apiConversations(b.ws, url('?limit=2&offset=1')).body as ConversationListBody;
    assert.equal(page.conversations.length, 2);
    assert.equal(page.total, 5);
    assert.equal(page.omitted, 3,
      'omitted counts the row offset skipped AS WELL AS the two past the limit, so '
      + 'conversations.length + omitted is the total and no second field can disagree with it');
    assert.equal(page.more, true);

    const tail = apiConversations(b.ws, url('?limit=2&offset=4')).body as ConversationListBody;
    assert.equal(tail.more, false, 'the last page says so');

    // The cap is a ceiling a caller cannot raise past.
    const greedy = apiConversations(b.ws, url('?limit=99999')).body as ConversationListBody;
    assert.equal(greedy.limit, CONVERSATION_LIST_CAP,
      'the answer states the cap actually applied, never the one that was asked for');
  } finally { b.dispose(); }
});

test('a pruned transcript is served as a pruned transcript, not as a failure', () => {
  const b = box();
  try {
    b.write('gone', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    b.scan();
    // The harness prunes it AFTER the scan — the state the spec names as the
    // strongest argument for export.
    rmSync(path.join(b.dir, 'gone.jsonl'));

    const list = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(list.conversations.length, 1, 'the row is still indexed');
    assert.equal(list.conversations[0]?.present, false);
    assert.equal(list.missing, 1, 'and the list counts it, so the screen can say so');

    const one = apiConversation(b.ws, url(), { id: 'gone' });
    assert.equal(one.status, 200, 'a pruned session is an answer, not a 404 — everything the '
      + 'index remembers about it is still true');
    const body = one.body as ConversationBody;
    assert.equal(body.present, false);
    assert.deepEqual(body.records, []);
    assert.equal(body.total, null, 'there is nothing to count');
    assert.ok((body.uncounted ?? '').includes('no longer on disk'),
      'and the reason is a sentence, not a flag — an empty records array with no explanation '
      + 'is indistinguishable from an empty conversation');
  } finally { b.dispose(); }
});

test('prompts, answers and machinery are told apart on the CONTENT, not the role', () => {
  const b = box();
  try {
    b.write('a1', [
      { type: 'user', message: { role: 'user', content: 'do the thing' } },
      { type: 'assistant', message: { role: 'assistant', content: text('on it') } },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', name: 'Read' }] } },
      { type: 'user', message: { role: 'user', content: [{ type: 'tool_result', content: 'file body' }] } },
    ]);
    b.scan();

    const body = apiConversation(b.ws, url(), { id: 'a1' }).body as ConversationBody;
    assert.deepEqual(
      body.records.map((r) => r.kind), ['prompt', 'answer', 'machinery', 'machinery'],
      'the owner asked for prompts to be visually distinguishable from answers and output, and '
      + 'this is the field a screen keys on. Role would have called the tool_result a prompt — '
      + 'measured on the real 52 MB transcript, 2,504 of 2,954 role-"user" records are tool '
      + 'results.',
    );
    assert.equal(body.records[2]?.tool, 'Read', 'machinery names the tool, so it can be folded '
      + 'and still say what it was');
    assert.equal(body.records[0]?.text, 'do the thing');
    assert.equal(body.records[3]?.text, 'file body', 'a tool result still carries its text — it '
      + 'is folded by the screen, not dropped by the endpoint');
  } finally { b.dispose(); }
});

/**
 * **The bound that matters most, and both halves of it.**
 *
 * A transcript is large — 52 MB measured on this project — and an endpoint
 * that will hand back everything is a way to take the server down by clicking
 * a link. Asserting only that the answer is short would pass on an endpoint
 * that truncated in silence.
 */
test('a long record is clipped AND SAYS SO, and a short one is not marked', () => {
  const b = box();
  try {
    b.write('a1', [
      { type: 'assistant', message: { role: 'assistant', content: text('x'.repeat(CONVERSATION_TEXT_CAP + 500)) } },
      { type: 'assistant', message: { role: 'assistant', content: text('short') } },
    ]);
    b.scan();

    const body = apiConversation(b.ws, url(), { id: 'a1' }).body as ConversationBody;
    const long = body.records[0];
    const short = body.records[1];
    assert.ok(long !== undefined && short !== undefined);

    assert.equal(long.text.length, CONVERSATION_TEXT_CAP, 'clipped to the cap');
    assert.equal(long.textTruncated, true);
    assert.equal(long.totalChars, CONVERSATION_TEXT_CAP + 500,
      'and it carries its REAL length, so a reader can see how much is not here');

    assert.equal(short.textTruncated, false,
      'a complete record must NOT be marked. A capped answer and a complete one must not look '
      + 'the same, and that is a claim about both of them.');
    assert.equal(short.totalChars, short.text.length);
    assert.equal(body.textCap, CONVERSATION_TEXT_CAP, 'the bound is in the answer, not only in '
      + 'the source');
  } finally { b.dispose(); }
});

test('the record window is bounded, and the answer accounts for what is outside it', () => {
  const b = box();
  try {
    const many: unknown[] = [];
    for (let i = 0; i < 12; i++) {
      many.push({ type: 'user', message: { role: 'user', content: `turn ${i}` } });
    }
    b.write('a1', many);
    b.scan();

    const page = apiConversation(b.ws, url('?limit=4&offset=3'), { id: 'a1' })
      .body as ConversationBody;
    assert.equal(page.records.length, 4);
    assert.deepEqual(page.records.map((r) => r.index), [3, 4, 5, 6],
      'the window is asked for by record position and the answer carries those positions, so a '
      + 'reader paging through never has to infer where they are');
    assert.equal(page.total, 12, 'the walk counted the whole file, so a total exists');
    assert.equal(page.omitted, 8);
    assert.equal(page.more, true);
    assert.equal(page.truncated, false);
    assert.equal(page.uncounted, null, 'nothing prevented the count');

    const greedy = apiConversation(b.ws, url('?limit=99999'), { id: 'a1' })
      .body as ConversationBody;
    assert.equal(greedy.limit, CONVERSATION_RECORD_CAP,
      'the cap is a ceiling a caller cannot raise past, and the answer states the one applied');

    const bare = apiConversation(b.ws, url(), { id: 'a1' }).body as ConversationBody;
    assert.equal(bare.limit, CONVERSATION_RECORD_DEFAULT);
  } finally { b.dispose(); }
});

test('an unreadable line is served as a visible gap, never skipped', () => {
  const b = box();
  try {
    writeFileSync(path.join(b.dir, 'a1.jsonl'), [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'one' } }),
      '{ not json at all',
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'two' } }),
    ].join('\n') + '\n');
    b.scan();

    const body = apiConversation(b.ws, url(), { id: 'a1' }).body as ConversationBody;
    assert.equal(body.records.length, 3,
      'the damaged line occupies a position in the answer. Skipping it would renumber every '
      + 'record after it and hide that anything was lost — INV-nothing-is-dropped-silently.');
    assert.equal(body.records[1]?.unreadable, true);
    assert.equal(body.records[2]?.text, 'two', 'the record AFTER the damage is intact');
  } finally { b.dispose(); }
});

test('a parameter this pair does not act on is refused, in both spellings', () => {
  const b = box();
  try {
    b.scan();
    for (const bad of ['?nosuchparam=1', '?limit=1&limit=2', '?limit=abc', '?offset=-1']) {
      assert.equal(
        apiConversations(b.ws, url(bad)).status, 400,
        `${bad} was accepted. A parameter accepted and ignored silently answers a different `
        + 'question, and `?limit=` read as zero is an empty page nobody requested.',
      );
      assert.equal(apiConversation(b.ws, url(bad), { id: 'x' }).status, 400, bad);
    }
  } finally { b.dispose(); }
});

test('an unknown session id is a 404 that does not echo the id back as markup', () => {
  const b = box();
  try {
    b.scan();
    const answer = apiConversation(b.ws, url(), { id: '<script>canary-9f3a2b</script>' });
    assert.equal(answer.status, 404);
    // The id IS named — a refusal a reader cannot act on is its own defect —
    // but it lands in a JSON string field, never in markup, and the screen
    // appends it as a text node.
    assert.equal(typeof (answer.body as { error: string }).error, 'string');
  } finally { b.dispose(); }
});
