// @basis TASK-an-export-offers-to-swap-secrets-for-obvious-fakes-and-never, INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **`GET /api/conversations/:id/secrets` — the read the checkbox form draws
 * from.** `plan:archive seq:46`, step 3's read half.
 *
 * ── WHAT IS WORTH PROVING HERE ────────────────────────────────────────────
 *
 *   1. **It is a READ.** The endpoint scans and reports and produces no file,
 *      which is asserted by taking a byte snapshot of the mirror directory
 *      across the call rather than by trusting the code. `src/ui/` write
 *      bindings are held to an exact set of one by
 *      `test/ui/no-writes.test.ts`; this is the runtime half of the same
 *      claim, for the one endpoint that most looks like it might write.
 *   2. **NOTHING IS TICKED until somebody has chosen.** `accepted` is `false`
 *      for every candidate on a session with no plan, and `chosen` is `null`.
 *      That is the owner's rule at the point a form could most easily break
 *      it by being helpful.
 *   3. **No credential reaches the payload.** The body is serialised and
 *      asserted not to contain the values the scan found — the property that,
 *      if it ever failed, would put a secret into a browser tab and into
 *      whatever the reader is screen-sharing.
 *   4. **A standing choice comes back ticked**, so a reader who chose
 *      yesterday is not shown an empty form today.
 *   5. **Every empty state is itself**: never scanned, no such session, and a
 *      session where nothing matched are three different answers.
 *
 * **Every credential here is synthetic** and says `NOT-REAL` in its own body.
 * Nothing is read out of the live corpus or out of a real transcript.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversationSecrets, type ConversationSecretsBody,
} from '../../src/ui/read-model-conversations.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import { MIRROR_DIR_ENV, mirrorPath, persistSession } from '../../src/core/conversation-mirror.ts';
import { chooseRedactions } from '../../src/core/conversation-redaction.ts';
import { candidateId } from '../../src/core/conversation-secrets.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'eeeeeeee-0000-1111-2222-777777777777';

/** Synthetic. Neither is a real credential; both are shaped so the scan proposes them. */
const FAKE_KEY = 'sk-ant-api03-NOT-REAL-2222222222222222222222';
const FAKE_TOKEN = 'ghp_NOTREALNOTREALNOTREALNOTREAL2222';

const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 15, 0, s)).toISOString();
const say = (who: 'user' | 'assistant', body: string, s: number): unknown => ({
  type: who,
  message: { role: who, content: who === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at(s),
});

interface Box {
  ws: Workspace;
  cwd: string;
  kept: string;
  write: (lines: unknown[]) => void;
  scan: () => void;
  mirror: () => string;
  ask: (id?: string) => ConversationSecretsBody;
  snapshot: () => string;
  dispose: () => void;
}

function box(lines?: unknown[]): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-secr-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-secr-cwd-'));
  const kept = mkdtempSync(path.join(tmpdir(), 'myctx-secr-kept-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  const priorMirror = process.env[MIRROR_DIR_ENV];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  process.env[MIRROR_DIR_ENV] = kept;
  mkdirSync(path.join(cwd, '.my_context'), { recursive: true });
  const ws = { projectRoot: path.join(cwd, '.my_context'), dbPath } as unknown as Workspace;

  const write = (rows: unknown[]): void => writeFileSync(
    path.join(dir, `${SESSION}.jsonl`), rows.map((l) => JSON.stringify(l)).join('\n') + '\n',
  );
  write(lines ?? [
    say('user', `use ${FAKE_KEY} to call it`, 1),
    say('assistant', `and ${FAKE_TOKEN} for the repo`, 2),
    say('user', `still ${FAKE_KEY}`, 3),
  ]);

  return {
    ws,
    cwd,
    kept,
    write,
    scan: () => { rebuildConversations(dbPath, process.env, cwd, {}); },
    mirror: () => mirrorPath(process.env, cwd, SESSION),
    ask: (id = SESSION) => apiConversationSecrets(
      ws, new URL(`http://x/api/conversations/${id}/secrets`), { id },
    ).body as ConversationSecretsBody,
    // Every byte under the mirror root, so "this endpoint wrote nothing" is a
    // measurement rather than a reading of the code.
    snapshot: () => readdirSync(kept, { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => {
        const file = path.join(e.parentPath, e.name);
        return `${path.relative(kept, file)}:${readFileSync(file).length}`;
      })
      .sort().join('|'),
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      if (priorMirror === undefined) delete process.env[MIRROR_DIR_ENV];
      else process.env[MIRROR_DIR_ENV] = priorMirror;
      removeTree(home);
      removeTree(cwd);
      removeTree(kept);
    },
  };
}

test('the endpoint proposes candidates and writes nothing', () => {
  const b = box();
  try {
    b.scan();
    persistSession(b.ws.dbPath, process.env, b.cwd, SESSION);
    const before = b.snapshot();
    const body = b.ask();
    assert.equal(body.indexed, true);
    assert.equal(body.total, 2, 'one candidate per distinct value, not per occurrence');
    assert.equal(b.snapshot(), before, 'a READ endpoint produced or changed a file');
  } finally { b.dispose(); }
});

test('nothing is ticked until somebody has chosen', () => {
  const b = box();
  try {
    b.scan();
    const body = b.ask();
    assert.equal(body.chosen, null);
    assert.deepEqual(
      body.candidates.map((c) => c.accepted), [false, false],
      'a pre-ticked box would be this product deciding on his behalf and calling it a default',
    );
  } finally { b.dispose(); }
});

test('no candidate carries the value it found', () => {
  const b = box();
  try {
    b.scan();
    const serialised = JSON.stringify(b.ask());
    for (const value of [FAKE_KEY, FAKE_TOKEN]) {
      assert.equal(serialised.includes(value), false,
        'the browser payload carries a credential whole; it must carry only a mask');
    }
    assert.ok(serialised.includes('sk-a'), 'and the mask still shows enough prefix to judge by');
  } finally { b.dispose(); }
});

test('a candidate carries what a person needs in order to judge it', () => {
  const b = box();
  try {
    b.scan();
    const key = b.ask().candidates.find((c) => c.shape === 'anthropic-key');
    assert.ok(key, 'the Anthropic-shaped value was not proposed');
    assert.equal(key.id, candidateId('anthropic-key', FAKE_KEY));
    assert.equal(key.occurrences, 2);
    assert.deepEqual(key.records, [0, 2]);
    assert.ok(key.paths.length > 0, 'a candidate a form cannot locate');
    assert.ok(key.contexts.length > 0, 'a candidate a form cannot label');
    assert.match(key.placeholder, /^FAKE-anthropic-key-[0-9a-f]{12}-NOT-A-REAL-VALUE$/);
  } finally { b.dispose(); }
});

test('the shapes come back as a legend, saying which are the 2026-09-08 thirteen', () => {
  const b = box();
  try {
    b.scan();
    const shapes = b.ask().shapes;
    assert.equal(shapes.filter((s) => !s.added).length, 13);
    assert.ok(shapes.some((s) => s.added), 'the thirteen are a starting set, not the finished one');
    assert.equal(
      JSON.stringify(shapes).includes('pattern'), false,
      'a regex is not a fact a reader can use, and it is not served',
    );
  } finally { b.dispose(); }
});

test('a standing choice comes back ticked, so a form redraws what was chosen', () => {
  const b = box();
  try {
    b.scan();
    persistSession(b.ws.dbPath, process.env, b.cwd, SESSION);
    const id = candidateId('anthropic-key', FAKE_KEY);
    chooseRedactions(b.mirror(), SESSION, [id]);

    const body = b.ask();
    assert.ok(body.chosen);
    assert.deepEqual(body.chosen.accepted, [id]);
    assert.equal(body.chosen.replaced, 2);
    assert.equal(body.kept, true);
    assert.equal(body.candidates.find((c) => c.id === id)?.accepted, true);
    assert.equal(
      body.candidates.filter((c) => c.accepted).length, 1,
      'exactly the chosen one comes back ticked, and nothing else',
    );
  } finally { b.dispose(); }
});

test('a session where nothing matched is a measured zero and not a promise', () => {
  const b = box([say('user', 'nothing interesting at all', 1)]);
  try {
    b.scan();
    const body = b.ask();
    assert.equal(body.indexed, true);
    assert.equal(body.total, 0);
    assert.equal(body.records, 1, 'the file WAS read — that is what makes the zero measured');
    assert.ok(body.shapes.length > 0, 'and the reader is told how many shapes found nothing');
  } finally { b.dispose(); }
});

test('never scanned and no such session are two different answers', () => {
  const b = box();
  try {
    const never = b.ask();
    assert.equal(never.indexed, false, 'nobody has scanned this workspace');
    assert.equal(never.rebuild, 'mycontext conversation rebuild');

    b.scan();
    const missing = b.ask('ffffffff-0000-0000-0000-000000000000');
    assert.equal(missing.indexed, true, 'the index exists; this session is not in it');
    assert.equal(missing.total, 0);
    assert.equal(missing.file, null);
  } finally { b.dispose(); }
});

test('an unknown query parameter is refused rather than ignored', () => {
  const b = box();
  try {
    b.scan();
    const result = apiConversationSecrets(
      b.ws, new URL(`http://x/api/conversations/${SESSION}/secrets?limit=3`), { id: SESSION },
    );
    assert.equal(result.status, 400);
  } finally { b.dispose(); }
});
