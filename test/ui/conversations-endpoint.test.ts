// @basis TASK-the-archive-shows-what-is-on-disk-now-because-nothing-has,
// TASK-a-subagent-is-opened-from-the-turn-that-dispatched-it-and,
// TASK-the-list-is-browsable-filter-search-and-duration-across,
// TASK-a-pruned-session-is-a-row-that-says-so-not-a-row-that,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// INV-nothing-is-dropped-silently
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
  appendFileSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversation, apiConversations, apiConversationSubagents, CONVERSATION_LIST_CAP,
  CONVERSATION_QUERY_CAP,
  CONVERSATION_RECORD_CAP, CONVERSATION_RECORD_DEFAULT, CONVERSATION_TEXT_CAP,
  type ConversationBody, type ConversationListBody, type SubagentListBody,
} from '../../src/ui/read-model-conversations.ts';
import { apiConversationOutline } from '../../src/ui/read-model-conversation-document.ts';
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
  for (const path of [
    '/api/conversations', '/api/conversations/:id', '/api/conversations/:id/subagents',
  ]) {
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
  /** A subagent transcript plus the sidecar the harness writes beside it. */
  lane: (session: string, agentId: string, meta: unknown, lines: unknown[]) => void;
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
    lane: (session, agentId, meta, lines) => {
      const under = path.join(dir, session, 'subagents');
      mkdirSync(under, { recursive: true });
      writeFileSync(
        path.join(under, `${agentId}.jsonl`),
        lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
      );
      if (meta !== null) {
        writeFileSync(path.join(under, `${agentId}.meta.json`), JSON.stringify(meta));
      }
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

/**
 * **THE WINDOW IS ONE TURN WIDE, NOT ZERO — and this test is why
 * `plan:archive seq:11`'s ruling could not be carried out as written.**
 *
 * That item records an owner ruling of 2026-09-07: a pruned session does NOT
 * stay in the archive, `removeMissing` stays, and — this is the part that was
 * wrong — `present: false`, the pruned chip and the 200-body branch are "DEAD
 * CODE to remove rather than a state to make reachable".
 *
 * They are reachable, and they were reachable while that sentence was being
 * written: this test had been green since `plan:archive seq:2` and constructs
 * the state in three lines. `removeMissing` runs during a REBUILD. The list is
 * served from the index BETWEEN rebuilds, and `summarise` stats each file at
 * request time. So a transcript deleted after a scan is disclosed on the list
 * until the next refresh, which on this build is the end of the reader's next
 * assistant turn.
 *
 * Both halves are asserted here now, because the ruling is right about the
 * second and the item is wrong only about the first:
 *
 *   1. Before a rebuild, the row is served with `present: false` and the
 *      document answers 200 with the reason in a sentence.
 *   2. After a rebuild, the row is GONE. `removeMissing` does what the owner
 *      ruled, and the disclosure above is a window rather than a permanent
 *      state.
 *
 * Deleting the read half would have left the row on the list for that window
 * with nothing marking it, opening onto a document that cannot load — which is
 * `INV-nothing-is-dropped-silently` failing at the one moment it exists for.
 */
test('a transcript deleted between two rebuilds is disclosed, then dropped', () => {
  const b = box();
  try {
    b.write('gone', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    b.scan();
    // The harness prunes it AFTER the scan.
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

    // ── AND THEN THE RULING TAKES EFFECT ──────────────────────────────────
    b.scan();
    const after = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.deepEqual(after.conversations, [],
      'the owner ruled that the archive holds only sessions that still exist, so the next '
      + 'rebuild drops the row — the disclosure above is a window, not a kept state');
    assert.equal(after.missing, 0, 'and nothing is left to count as missing');
  } finally { b.dispose(); }
});

/**
 * **A cache that is behind must say so, and saying so must not be a write.**
 *
 * The defect this endpoint had: it served rows scanned on 2026-09-07T04:03
 * while the transcript beneath them had grown 11,231,042 bytes past, and there
 * was NO FIELD anywhere in the answer from which a screen could have noticed.
 * The archive was over a day stale in front of the owner and looked exactly
 * like an archive that was current.
 *
 * Both halves are asserted, and the second is the one that makes the first
 * affordable. `staleBytes` is a subtraction over the `stat` this endpoint
 * already ran to answer `present` — so the disclosure opens no transcript,
 * runs no scan, and leaves the corpus byte for byte where it found it, which
 * is the only kind of disclosure a read-only surface is allowed to make.
 */
test('a stale archive reports how far behind it is, and reports it without writing', () => {
  const b = box();
  try {
    b.write('live', [
      { type: 'user', message: { role: 'user', content: 'hi' }, timestamp: '2026-09-01T10:00:00.000Z' },
    ]);
    b.scan();

    const current = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(current.stale, 0, 'a freshly scanned archive is not behind');
    assert.equal(current.staleBytes, 0);
    assert.equal(current.conversations[0]?.staleBytes, 0);
    assert.equal(
      current.conversations[0]?.fileBytes, statSync(path.join(b.dir, 'live.jsonl')).size,
      'and the row carries what the file measures NOW, beside what the scan read',
    );

    // The session keeps going, which is what a live transcript does. Nothing
    // runs a rebuild — which, until `plan:archive seq:14`, nothing ever did.
    const grew = JSON.stringify({
      type: 'assistant', message: { role: 'assistant', content: text('and again') },
      timestamp: '2026-09-02T10:00:00.000Z',
    }) + '\n';
    appendFileSync(path.join(b.dir, 'live.jsonl'), grew);

    const before = snapshot(path.join(b.cwd, '.my_context'));
    const dbBefore = statSync(b.ws.dbPath).size;

    const behind = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(behind.stale, 1, 'the list says one session has moved past its row');
    assert.equal(
      behind.staleBytes, Buffer.byteLength(grew),
      'by exactly the bytes it grew — a number, so a screen can say "N behind" rather than "stale"',
    );
    assert.equal(behind.conversations[0]?.staleBytes, Buffer.byteLength(grew));
    // The counts are still the OLD ones, and that is correct: this endpoint
    // serves the index. What changed is that it now says so.
    assert.equal(behind.conversations[0]?.records, 1);

    assert.deepEqual(
      snapshot(path.join(b.cwd, '.my_context')), before,
      'reporting staleness changed not one byte of the corpus',
    );
    assert.equal(statSync(b.ws.dbPath).size, dbBefore, 'and did not grow the index either');
  } finally { b.dispose(); }
});

/**
 * A pruned transcript is ABSENT, not behind. Two states, two fields, and
 * collapsing them would put a "refresh this" prompt on a session whose file no
 * refresh can ever bring back.
 */
test('a pruned transcript is reported as absent and never as stale', () => {
  const b = box();
  try {
    b.write('gone', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    b.scan();
    rmSync(path.join(b.dir, 'gone.jsonl'));

    const list = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(list.conversations[0]?.present, false);
    assert.equal(list.conversations[0]?.fileBytes, null, 'there is no file to measure');
    assert.equal(list.conversations[0]?.staleBytes, 0);
    assert.equal(list.missing, 1);
    assert.equal(list.stale, 0, 'a deleted transcript is not an index that is behind');
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
 *
 * ── THIS SURVIVED THE OWNER'S NO-CAP RULING, AND HERE IS WHY ──────────────
 *
 * On 2026-09-08 he ruled *"if there is a size restriction it must be removed,
 * i want no restriction or limitation"*, reading the DOCUMENT view's own
 * disclosure off his screen. `read-model-conversation-document.ts` lost both
 * of its text caps that day and `test/ui/conversation-document.test.ts` now
 * asserts the opposite claim — a 90,000-character turn served whole.
 *
 * **That ruling does not reach this test, and `seq:7`'s body says so in as
 * many words**: *"Deleting the cap while still shipping whole pages would hand
 * a 64 MB session to a browser in one response."* This endpoint is the
 * whole-page one — `?limit=&offset=` over records, `CONVERSATION_RECORD_CAP`
 * of them at a time — and the cap it keeps is what makes that shape honest.
 * The document endpoint could drop its caps because it ships a WINDOW seeked
 * to by byte offset, and its own header carries the measurement.
 *
 * So the two tests are not a contradiction, and neither is stale: they are
 * one claim about two delivery shapes. **If this endpoint is ever pointed at
 * a screen again, that is the moment to re-ask the owner** — nothing in the
 * product calls it today (`screens/conversations.js` asks only
 * `/api/conversations`, `/outline` and `/nodes`), which is a fact worth
 * knowing before anyone spends a ruling on it.
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

/* ══ THE LANES A SESSION DISPATCHED ════════════════════════════════════════ */

/**
 * `plan:archive seq:12`. The session holds each lane's REPORT; the lane
 * transcripts hold its REASONING — 615.3 MB of it against 65 MB of session,
 * measured in this workspace on 2026-09-08 — and until this shipped the
 * archive saw none of them.
 */

const laneMeta = (toolUseId: string, extra: Record<string, unknown> = {}): unknown => ({
  agentType: 'general-purpose', description: 'a lane brief', toolUseId, spawnDepth: 1, ...extra,
});

test('a session lists the lanes it dispatched, each carrying the tool call that made it', () => {
  const b = box();
  try {
    b.write('sess-lanes', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_ONE', name: 'Agent', input: { prompt: 'a lane brief' } }] }, timestamp: '2026-09-08T09:00:01.000Z' },
    ]);
    b.lane('sess-lanes', 'agent-one', laneMeta('toolu_ONE'), [
      { type: 'user', message: { role: 'user', content: 'a lane brief' }, timestamp: '2026-09-08T09:00:02.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: text('the working') }, timestamp: '2026-09-08T09:00:03.000Z' },
    ]);
    b.lane('sess-lanes', 'agent-two', laneMeta('toolu_TWO', {
      parentAgentId: 'one', spawnDepth: 2, model: 'opus', isFork: true,
    }), [
      { type: 'assistant', message: { role: 'assistant', content: text('deeper') }, timestamp: '2026-09-08T09:00:04.000Z' },
    ]);
    b.scan();

    const result = apiConversationSubagents(b.ws, new URL('http://x/'), { id: 'sess-lanes' });
    assert.equal(result.status, 200);
    const body = result.body as SubagentListBody;
    assert.equal(body.total, 2);
    assert.equal(body.indexed, true);
    assert.equal(body.missing, 0);
    assert.equal(body.unlinked, 0);

    const one = body.subagents.find((s) => s.agentId === 'agent-one')!;
    // **THE LINK `plan:archive seq:15` FOLLOWS.** The same id appears on the
    // `Agent` tool_use in the session transcript above, so a screen goes from
    // the TURN to the TRANSCRIPT with no correlation of its own to invent.
    assert.equal(one.toolUseId, 'toolu_ONE');
    assert.equal(one.parentAgentId, null, 'null means the SESSION dispatched it');
    assert.equal(one.spawnDepth, 1);
    assert.equal(one.description, 'a lane brief', 'the dispatcher\'s own words, never fabricated');
    assert.equal(one.present, true);
    assert.equal(one.staleBytes, 0);

    const two = body.subagents.find((s) => s.agentId === 'agent-two')!;
    assert.equal(
      two.parentAgentId, 'one',
      'a lane dispatched by a LANE names it — its `Agent` call is in that lane\'s transcript '
      + 'and not in the session\'s. Measured: 43 of 254 in this workspace.',
    );
    assert.equal(two.spawnDepth, 2);
    assert.equal(two.isFork, true);
    assert.equal(two.model, 'opus');

    // Oldest first — the order the session dispatched them, which is the order
    // a reader follows. The opposite of the SESSIONS list, deliberately.
    assert.deepEqual(body.subagents.map((s) => s.agentId), ['agent-one', 'agent-two']);
  } finally { b.dispose(); }
});

test('the sessions list says how many lanes each session owns, and a measured zero is zero', () => {
  const b = box();
  try {
    b.write('sess-with', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ]);
    b.write('sess-without', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T08:00:00.000Z' },
    ]);
    b.lane('sess-with', 'agent-a', laneMeta('toolu_A'), [
      { type: 'assistant', message: { role: 'assistant', content: text('x') }, timestamp: '2026-09-08T09:00:01.000Z' },
    ]);
    b.scan();

    const body = apiConversations(b.ws, new URL('http://x/')).body as ConversationListBody;
    const withLanes = body.conversations.find((c) => c.sessionId === 'sess-with')!;
    const without = body.conversations.find((c) => c.sessionId === 'sess-without')!;
    assert.equal(withLanes.subagents, 1);
    assert.equal(
      without.subagents, 0,
      'a session that dispatched none carries the NUMBER zero, not an absent field — every row '
      + 'on this list is answerable without a second request',
    );
  } finally { b.dispose(); }
});

test('an unlinked lane is served and counted, because only its link is missing', () => {
  const b = box();
  try {
    b.write('sess-unlinked', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ]);
    b.lane('sess-unlinked', 'agent-nometa', null, [
      { type: 'assistant', message: { role: 'assistant', content: text('worked anyway') }, timestamp: '2026-09-08T09:00:01.000Z' },
    ]);
    b.scan();

    const body = apiConversationSubagents(
      b.ws, new URL('http://x/'), { id: 'sess-unlinked' },
    ).body as SubagentListBody;
    assert.equal(body.total, 1, 'still served');
    assert.equal(
      body.unlinked, 1,
      'and DISCLOSED. A lane nothing can open from a turn is exactly what seq:15 needs told '
      + 'about, and a silent zero would look like a session that dispatched none.',
    );
    assert.equal(body.subagents[0]!.toolUseId, null);
    assert.ok(body.subagents[0]!.records > 0, 'the reasoning is still readable');
  } finally { b.dispose(); }
});

test('a session that dispatched none answers an empty list rather than a 404 or a throw', () => {
  const b = box();
  try {
    b.write('sess-none', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ]);
    b.scan();
    const body = apiConversationSubagents(
      b.ws, new URL('http://x/'), { id: 'sess-none' },
    ).body as SubagentListBody;
    assert.equal(body.total, 0);
    assert.equal(body.indexed, true, 'the index EXISTS and this session simply dispatched none');
    assert.equal(body.bytes, 0);
  } finally { b.dispose(); }
});

test('the subagents route refuses a parameter it does not act on', () => {
  const b = box();
  try {
    b.write('sess-p', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ]);
    b.scan();
    // A parameter accepted and ignored would silently answer a different
    // question — this module's own rule, applied to the new route.
    const bad = apiConversationSubagents(b.ws, new URL('http://x/?limit=5'), { id: 'sess-p' });
    assert.equal(bad.status, 400);
    assert.match(String((bad.body as { error: string }).error), /unknown parameter "limit"/);
  } finally { b.dispose(); }
});

test('a lane opens through the SAME document renderer, so there is no second viewer', () => {
  const b = box();
  try {
    b.write('sess-doc', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
    ]);
    b.lane('sess-doc', 'agent-doc', laneMeta('toolu_D', { description: 'the lane brief' }), [
      { type: 'user', message: { role: 'user', content: 'the brief' }, timestamp: '2026-09-08T09:00:01.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: text('the reasoning') }, timestamp: '2026-09-08T09:00:02.000Z' },
    ]);
    b.scan();

    // `plan:archive seq:15` requires "THE SAME RENDERER … A subagent
    // transcript is the same kind of thing and must not grow a second viewer."
    // Every document route reaches its file through one `rowFor`, so teaching
    // that to resolve a lane makes outline/nodes/tip all work on one.
    const out = apiConversationOutline(b.ws, new URL('http://x/'), { id: 'agent-doc' });
    assert.equal(out.status, 200);
    const body = out.body as { title: string | null; titleSource: string | null; source: string };
    assert.equal(
      body.title, 'the lane brief',
      'a lane has NO title and structurally cannot have one — 0 `ai-title` records across all '
      + '253 real transcripts and no custom-title.json anywhere. The dispatcher\'s description '
      + 'is the recorded name it does have.',
    );
    assert.equal(body.titleSource, 'agent', 'and a reader is owed WHICH kind of name that is');
    assert.equal(body.source, 'subagent');

    // A session is still resolved first, so a lane can never shadow one.
    assert.equal(
      apiConversationOutline(b.ws, new URL('http://x/'), { id: 'sess-doc' }).status, 200,
    );
    const missing = apiConversationOutline(b.ws, new URL('http://x/'), { id: 'agent-nope' });
    assert.equal(missing.status, 404);
    assert.match(
      String((missing.body as { error: string }).error), /conversation or subagent/,
      'the refusal names both id spaces, because a reader who mistyped either should be told '
      + 'which two things were looked for',
    );
  } finally { b.dispose(); }
});

/**
 * **THE TRAP `plan:archive seq:15` IS MOST EXPOSED TO, AND IT IS A FIFTH OF
 * THE LANES.**
 *
 * A lane dispatched from inside another lane has its `Agent` call in THAT
 * lane's transcript, so a document opened on a lane has dispatching turns of
 * its own. Its rows are still filed under the SESSION — `subagents.session_id`
 * is the owning session at every depth — so asking this route for a lane id
 * would answer an empty list, every link on that page would be missing, and
 * the page would look exactly like a lane that dispatched nothing.
 *
 * Measured in this workspace on 2026-09-08: 43 of 254 lanes are at depth 2.
 */
test('asking for a LANE answers the owning session\'s whole roster, so depth 2 still links', () => {
  const b = box();
  try {
    b.write('sess-deep', [
      { type: 'user', message: { role: 'user', content: 'go' }, timestamp: '2026-09-08T09:00:00.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_TOP', name: 'Agent', input: { prompt: 'the outer lane' } }] }, timestamp: '2026-09-08T09:00:01.000Z' },
    ]);
    // The outer lane, dispatched by the session. Its own transcript carries the
    // `Agent` call that made the inner one — which is exactly why the session's
    // records cannot answer for it.
    b.lane('sess-deep', 'agent-outer', laneMeta('toolu_TOP', { description: 'the outer lane' }), [
      { type: 'user', message: { role: 'user', content: 'the outer lane' }, timestamp: '2026-09-08T09:00:02.000Z' },
      { type: 'assistant', message: { role: 'assistant', content: [{ type: 'tool_use', id: 'toolu_INNER', name: 'Agent', input: { prompt: 'the inner lane' } }] }, timestamp: '2026-09-08T09:00:03.000Z' },
    ]);
    b.lane('sess-deep', 'agent-inner', laneMeta('toolu_INNER', {
      description: 'the inner lane', parentAgentId: 'outer', spawnDepth: 2,
    }), [
      { type: 'assistant', message: { role: 'assistant', content: text('the deep working') }, timestamp: '2026-09-08T09:00:04.000Z' },
    ]);
    b.scan();

    const forLane = apiConversationSubagents(
      b.ws, new URL('http://x/'), { id: 'agent-outer' },
    ).body as SubagentListBody;

    assert.equal(forLane.sessionId, 'agent-outer', 'what was asked for is echoed unchanged');
    assert.equal(
      forLane.ownerSessionId, 'sess-deep',
      'and the roster says whose it is — a lane page needs this to name where it came from, and '
      + 'showing its own id there would point a reader back at the page they are on',
    );
    assert.equal(forLane.total, 2, 'the whole tree, not the lane\'s own children');
    const inner = forLane.subagents.find((s) => s.agentId === 'agent-inner')!;
    assert.equal(
      inner.toolUseId, 'toolu_INNER',
      'the id of an `Agent` call that lives in `agent-outer.jsonl` and NOWHERE in the session — '
      + 'this is the row that would have been missing, and the link with it',
    );
    assert.equal(inner.spawnDepth, 2);

    // The session's own answer is unchanged, and it is the SAME set: a
    // `tool_use` id is unique across the tree, so one map serves a document at
    // any depth and the screen needs no notion of depth at all.
    const forSession = apiConversationSubagents(
      b.ws, new URL('http://x/'), { id: 'sess-deep' },
    ).body as SubagentListBody;
    assert.equal(forSession.ownerSessionId, 'sess-deep');
    assert.deepEqual(
      forSession.subagents.map((s) => s.agentId).sort(),
      forLane.subagents.map((s) => s.agentId).sort(),
    );

    // An id that names NEITHER is not resolved to something else: it answers
    // for itself, empty, the way a session that dispatched none does.
    const unknown = apiConversationSubagents(
      b.ws, new URL('http://x/'), { id: 'agent-nope' },
    ).body as SubagentListBody;
    assert.equal(unknown.ownerSessionId, 'agent-nope');
    assert.equal(unknown.total, 0);
  } finally { b.dispose(); }
});

/* ── plan:archive seq:10 — the list is browsable ──────────────────────────── */

/**
 * **The list narrows, and every clause of the narrowing is refused when it is
 * malformed rather than accepted and ignored** — `plan:archive seq:10`.
 *
 * The item's complaint is exact: `/api/conversations` accepted `limit` and
 * `offset` ONLY and "actively REFUSES any other parameter, so this cannot be
 * added client-side and the endpoint must move first". These are the
 * parameters it moved to, and the refusals are asserted in the same breath as
 * the acceptances, because an endpoint that quietly ignored `?since=last week`
 * would answer the unfiltered question and look right doing it.
 */
test('the list narrows by branch, date and text, and each malformed clause is refused', () => {
  const b = box();
  try {
    b.write('old', [
      { type: 'user', timestamp: '2026-09-01T10:00:00.000Z', gitBranch: 'main',
        message: { role: 'user', content: 'the first session' } },
      { type: 'assistant', timestamp: '2026-09-01T10:05:00.000Z', gitBranch: 'main',
        message: { role: 'assistant', content: text('done') } },
    ]);
    b.write('new', [
      { type: 'user', timestamp: '2026-09-05T10:00:00.000Z', gitBranch: 'topic',
        message: { role: 'user', content: 'the second session' } },
      { type: 'assistant', timestamp: '2026-09-05T11:30:00.000Z', gitBranch: 'topic',
        message: { role: 'assistant', content: text('done') } },
    ]);
    b.scan();

    const all = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(all.total, 2);
    assert.equal(all.matching, 2, 'with no filter, matching IS the total');
    assert.deepEqual(all.filter, { q: null, branch: null, since: null, until: null });
    assert.deepEqual(all.branches, ['main', 'topic'],
      'every branch the ARCHIVE holds, so the chooser cannot offer a branch that does not '
      + 'exist and cannot drop the one being filtered by');

    const onBranch = apiConversations(b.ws, url('?branch=topic')).body as ConversationListBody;
    assert.deepEqual(onBranch.conversations.map((c) => c.sessionId), ['new']);
    assert.equal(onBranch.total, 2, 'the archive is still two sessions');
    assert.equal(onBranch.matching, 1, 'and one of them answered');
    assert.equal(onBranch.omitted, 0,
      'omitted counts against what MATCHED, so conversations.length + omitted is the size of '
      + 'the answer and no two fields disagree');
    assert.deepEqual(onBranch.branches, ['main', 'topic'],
      'and the chooser still offers both — a control that erased itself on first use would be '
      + 'a filter a reader could not undo');

    // Both bounds are inclusive of their whole day, which is the only reading
    // that does not turn on a zone the server does not have.
    const since = apiConversations(b.ws, url('?since=2026-09-05')).body as ConversationListBody;
    assert.deepEqual(since.conversations.map((c) => c.sessionId), ['new']);
    const until = apiConversations(b.ws, url('?until=2026-09-01')).body as ConversationListBody;
    assert.deepEqual(until.conversations.map((c) => c.sessionId), ['old']);
    const day = apiConversations(
      b.ws, url('?since=2026-09-05&until=2026-09-05'),
    ).body as ConversationListBody;
    assert.deepEqual(day.conversations.map((c) => c.sessionId), ['new'],
      'a single day includes every instant of it at both ends');

    const byText = apiConversations(b.ws, url('?q=TOPIC')).body as ConversationListBody;
    assert.deepEqual(byText.conversations.map((c) => c.sessionId), ['new'],
      'the branch is searched, and case is not a distinction a reader intended');
    const byId = apiConversations(b.ws, url('?q=old')).body as ConversationListBody;
    assert.deepEqual(byId.conversations.map((c) => c.sessionId), ['old'],
      'the id is searched, because it is what every other surface addresses a session by');

    // ── AND THE REFUSALS ────────────────────────────────────────────────────
    const refusals: [string, string][] = [
      ['?since=last%20week', 'a date this endpoint cannot read'],
      ['?until=2026-9-5', 'a date written loosely'],
      ['?q=', 'an empty search is a question, answered here as no question at all'],
      ['?branch=', 'and so is an empty branch'],
      ['?sort=duration', 'a parameter this endpoint does not act on'],
    ];
    for (const [query, why] of refusals) {
      const answer = apiConversations(b.ws, url(query));
      assert.equal(answer.status, 400, `${query} must be refused — ${why}`);
    }
    const long = apiConversations(b.ws, url(`?q=${'x'.repeat(CONVERSATION_QUERY_CAP + 1)}`));
    assert.equal(long.status, 400, 'a term past the cap is refused with the cap named');
  } finally { b.dispose(); }
});

/**
 * **The archive is mostly LANES, so a search that read only session titles
 * would be a control with almost nothing to match.**
 *
 * Measured on this workspace 2026-09-09: 2 sessions against 259 subagent
 * transcripts. The question a reader actually has — "which session dispatched
 * the lane about the index?" — is precisely the one the two session rows
 * cannot answer, so a session reaches the list through its lanes and the row
 * says how many matched.
 *
 * `null` versus `0` is asserted in both directions, because they are different
 * facts: nothing was searched for, against searched and none of this session's
 * lanes matched.
 */
test('a session is found through its lanes, and the row says how many matched', () => {
  const b = box();
  try {
    b.write('host', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    b.lane('host', 'agent-one',
      { description: 'measure the conversation index', agentType: 'fork' },
      [{ type: 'user', message: { role: 'user', content: 'go' } }]);
    b.lane('host', 'agent-two',
      { description: 'draw the archive list', agentType: 'general' },
      [{ type: 'user', message: { role: 'user', content: 'go' } }]);
    b.write('other', [{ type: 'user', message: { role: 'user', content: 'hi' } }]);
    b.scan();

    const none = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(none.conversations[0]?.matchedLanes, null,
      'no term was given, so there is no count — which is a different fact from a count of zero');

    const hit = apiConversations(b.ws, url('?q=index')).body as ConversationListBody;
    assert.deepEqual(hit.conversations.map((c) => c.sessionId), ['host'],
      'the session is on the list because a LANE matched, and nothing on its own row did');
    assert.equal(hit.conversations[0]?.matchedLanes, 1,
      'and the count is the only thing on the row explaining why it is there');

    const byType = apiConversations(b.ws, url('?q=fork')).body as ConversationListBody;
    assert.equal(byType.conversations[0]?.matchedLanes, 1, 'the agent type is searched too');

    const byId = apiConversations(b.ws, url('?q=host')).body as ConversationListBody;
    assert.equal(byId.conversations[0]?.matchedLanes, 0,
      'searched, and none of its lanes matched — a measured zero on a row that reached the '
      + 'list through its own id');

    // A wildcard typed into a find box is a literal, not a query language.
    const literal = apiConversations(b.ws, url('?q=%25')).body as ConversationListBody;
    assert.equal(literal.matching, 0,
      'a bare % matches nothing, because it is escaped — otherwise it would match every row '
      + 'and look exactly like a real answer');
  } finally { b.dispose(); }
});

/**
 * **Duration is arithmetic on two stamps the row already carries** — the item
 * says so itself — and the interesting part is the three answers, not the
 * subtraction.
 */
test('duration is served for a session that has both stamps, and is absent otherwise', () => {
  const b = box();
  try {
    b.write('timed', [
      { type: 'user', timestamp: '2026-09-01T10:00:00.000Z',
        message: { role: 'user', content: 'start' } },
      { type: 'assistant', timestamp: '2026-09-01T11:30:00.000Z',
        message: { role: 'assistant', content: text('end') } },
    ]);
    b.write('untimed', [{ type: 'user', message: { role: 'user', content: 'no stamps at all' } }]);
    b.scan();

    const body = apiConversations(b.ws, url()).body as ConversationListBody;
    const timed = body.conversations.find((c) => c.sessionId === 'timed');
    assert.equal(timed?.durationMs, 90 * 60 * 1000, 'ninety minutes, to the millisecond');

    const untimed = body.conversations.find((c) => c.sessionId === 'untimed');
    assert.equal(untimed?.durationMs, null,
      'a transcript that carried no timestamp has no duration — and `0` would be a session '
      + 'that lasted no time, which is a different fact '
      + '(STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is)');
  } finally { b.dispose(); }
});

/**
 * **A date bound cannot place a row with no end time, so those rows are
 * dropped — and a drop is counted where the reader can see it.**
 *
 * `INV-nothing-is-dropped-silently`. Without `undated`, a reader who set a
 * date would be shown a shorter list with no way to learn that a session had
 * been excluded for a reason that has nothing to do with the dates they chose.
 */
test('a session with no end time is excluded by a date bound, and that is counted', () => {
  const b = box();
  try {
    b.write('dated', [
      { type: 'user', timestamp: '2026-09-01T10:00:00.000Z',
        message: { role: 'user', content: 'a' } },
    ]);
    b.write('undated', [{ type: 'user', message: { role: 'user', content: 'b' } }]);
    b.scan();

    const open = apiConversations(b.ws, url()).body as ConversationListBody;
    assert.equal(open.matching, 2, 'both are on the unfiltered list');
    assert.equal(open.undated, 0,
      'and no date was asked for, so this is a fact about a filter that excluded nothing');

    const bounded = apiConversations(
      b.ws, url('?since=2026-01-01'),
    ).body as ConversationListBody;
    assert.deepEqual(bounded.conversations.map((c) => c.sessionId), ['dated']);
    assert.equal(bounded.undated, 1,
      'the one that could not be placed is COUNTED, not merely missing');
  } finally { b.dispose(); }
});
