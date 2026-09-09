// @basis INV-nothing-is-dropped-silently, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **A session kept outside the project, served to the SAME viewer** —
 * `plan:archive seq:5`.
 *
 * The owner's reason for asking for this at all: *"we could use THE SAME
 * BROWSER to go over a session even if the original file is not available
 * anymore"*. So what is proved here is that it IS the same surface, not a
 * second one — the list route and the document route both answer for a session
 * whose transcript has been deleted, and neither of them was taught a new
 * shape to do it.
 *
 * ── THE THREE STATES, AND WHY EACH ASSERTION IS ABOUT TELLING THEM APART ──
 *
 * `seq:5` requires LIVE, PERSISTED AND CURRENT, and PERSISTED AND ORPHANED to
 * be distinguishable and never to blur. Each test below picks a pair and
 * asserts a field that DIFFERS between them, rather than asserting one state
 * in isolation — a row that said `'persisted'` while every other field matched
 * a live one would pass the weaker check and fail the reader.
 *
 * ── AND ONE THING THE ITEM GOT WRONG, PROVED RATHER THAN ARGUED ───────────
 *
 * The item says `rowFor` in `read-model-conversation-document.ts` must resolve
 * *"a third thing"*. It does not need to: the indexed row already carries the
 * FILE it was read from, every document route reaches the transcript through
 * that field, and the mirror pass rewrites the field. `the document route
 * serves the copy through the route it already had` is that claim run —
 * `rowFor` is untouched by `seq:4`/`seq:5` and answers for a copy anyway.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  apiConversations, type ConversationListBody,
} from '../../src/ui/read-model-conversations.ts';
import {
  apiConversationOutline, type DocOutlineBody,
} from '../../src/ui/read-model-conversation-document.ts';
import { projectDirName, rebuildConversations } from '../../src/core/conversation-index.ts';
import {
  MIRROR_DIR_ENV, advanceMirrors, mirrorPath, persistSession,
} from '../../src/core/conversation-mirror.ts';
import { Store } from '../../src/core/store.ts';
import type { Workspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const LIVE = 'cccccccc-0000-1111-2222-333333333333';
const KEPT = 'dddddddd-0000-1111-2222-444444444444';

const at = (s: number): string => new Date(Date.UTC(2026, 8, 9, 14, 0, s)).toISOString();
const turn = (n: number): unknown[] => [
  { type: 'user', message: { role: 'user', content: `ask ${n}` }, timestamp: at(n * 2) },
  {
    type: 'assistant',
    message: { role: 'assistant', content: [{ type: 'text', text: `answer ${n}` }] },
    timestamp: at(n * 2 + 1),
  },
];

interface Box {
  ws: Workspace;
  cwd: string;
  env: Record<string, string | undefined>;
  write: (session: string, lines: unknown[]) => void;
  drop: (session: string) => void;
  scan: () => void;
  copy: (session: string) => string;
  list: () => ConversationListBody;
  outline: (session: string) => DocOutlineBody;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-kept-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-kept-cwd-'));
  const kept = mkdtempSync(path.join(tmpdir(), 'myctx-kept-store-'));
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
  const env = process.env;
  return {
    ws,
    cwd,
    env,
    write: (session, lines) => writeFileSync(
      path.join(dir, `${session}.jsonl`),
      lines.map((l) => JSON.stringify(l)).join('\n') + '\n',
    ),
    drop: (session) => rmSync(path.join(dir, `${session}.jsonl`)),
    scan: () => {
      rebuildConversations(dbPath, env, cwd);
      advanceMirrors(dbPath, env, cwd);
    },
    copy: (session) => mirrorPath(env, cwd, session),
    list: () => apiConversations(
      ws, new URL('http://x/api/conversations'),
    ).body as ConversationListBody,
    outline: (session) => apiConversationOutline(
      ws, new URL(`http://x/api/conversations/${session}/outline`), { id: session },
    ).body as DocOutlineBody,
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

/**
 * LIVE against PERSISTED AND CURRENT, on one list, with the fields that
 * separate them named.
 *
 * `keptBytes` is `null` on the live row and a number on the kept one, and
 * those are different facts rather than a number and a zero: `null` is
 * "nobody asked for this to be kept" and `0` would be "a copy that holds
 * nothing", which is a state the product does not have.
 */
test('a kept session and a live one differ on the list, in the fields that say which', () => {
  const b = box();
  try {
    b.write(LIVE, turn(1));
    b.write(KEPT, [...turn(1), ...turn(2)]);
    rebuildConversations(b.ws.dbPath, b.env, b.cwd);
    persistSession(b.ws.dbPath, b.env, b.cwd, KEPT);

    const rows = new Map(b.list().conversations.map((c) => [c.sessionId, c]));
    const live = rows.get(LIVE);
    const kept = rows.get(KEPT);
    assert.ok(live !== undefined && kept !== undefined, 'both sessions are on the list');

    assert.equal(live.source, 'live');
    assert.equal(live.keptBytes, null, 'a live row claims a copy that was never asked for');
    assert.equal(live.keptAt, null);

    assert.equal(kept.source, 'persisted');
    assert.equal(kept.keptBytes, kept.fileBytes, 'the copy is not current with the file');
    assert.equal(kept.keptNote, null, 'a copy that is keeping up says it has stopped');
    assert.equal(kept.present, true);
  } finally {
    b.dispose();
  }
});

/** A copy that is behind the file says so as a MEASURED difference, not a flag. */
test('a copy that has not caught up is behind by a number the row carries', () => {
  const b = box();
  try {
    b.write(KEPT, turn(1));
    rebuildConversations(b.ws.dbPath, b.env, b.cwd);
    persistSession(b.ws.dbPath, b.env, b.cwd, KEPT);
    const copied = statSync(b.copy(KEPT)).size;

    // The transcript grows and NOTHING advances the copy — the state between
    // one assistant turn and the next.
    b.write(KEPT, [...turn(1), ...turn(2), ...turn(3)]);
    rebuildConversations(b.ws.dbPath, b.env, b.cwd);

    const row = b.list().conversations.find((c) => c.sessionId === KEPT);
    assert.ok(row !== undefined);
    assert.equal(row.keptBytes, copied);
    assert.ok(
      row.fileBytes !== null && row.fileBytes > row.keptBytes,
      'the row cannot tell a copy that is behind from one that is current',
    );
  } finally {
    b.dispose();
  }
});

/**
 * **PERSISTED AND ORPHANED, which is the state the whole feature is for.**
 *
 * `seq:11` ruled that a session whose file is gone leaves the list. `seq:5`
 * records the consequence: the copy is then the only thing that can keep it
 * visible, and without this "marked persistent" is a promise the product does
 * not keep. So the row is asserted to be PRESENT on the list, to say which
 * file it is, and — the part that matters most — to be CURRENT, because the
 * copy cannot be behind a file that no longer exists.
 */
test('a session whose transcript is gone stays on the list, as the copy', () => {
  const b = box();
  try {
    b.write(LIVE, turn(1));
    b.write(KEPT, [...turn(1), ...turn(2)]);
    rebuildConversations(b.ws.dbPath, b.env, b.cwd);
    persistSession(b.ws.dbPath, b.env, b.cwd, KEPT);

    b.drop(KEPT);
    b.drop(LIVE);
    b.scan();

    const list = b.list();
    const ids = list.conversations.map((c) => c.sessionId);
    assert.deepEqual(
      ids, [KEPT],
      'the unkept session should have left the list and the kept one should have stayed',
    );
    const row = list.conversations[0];
    assert.equal(row.source, 'exported');
    assert.equal(row.present, true, 'the copy is on disk, so the row is not a pruned one');
    assert.equal(row.staleBytes, 0, 'a copy that cannot grow is reported as behind its file');
    assert.equal(row.keptBytes, row.fileBytes);
    assert.equal(list.missing, 0);
  } finally {
    b.dispose();
  }
});

/**
 * **THE ITEM'S "third thing `rowFor` must resolve" IS NOT THERE.** The
 * document route answers for the copy with no new resolution at all, because
 * the indexed row carries the file and the mirror pass rewrote that field.
 *
 * The outline's records are compared against the LIVE outline taken before the
 * transcript was deleted, so this is "the same document", not "a document".
 */
test('the document route serves the copy through the route it already had', () => {
  const b = box();
  try {
    b.write(KEPT, [...turn(1), ...turn(2), ...turn(3)]);
    rebuildConversations(b.ws.dbPath, b.env, b.cwd);
    persistSession(b.ws.dbPath, b.env, b.cwd, KEPT);
    const before = b.outline(KEPT);
    assert.equal(before.source, 'persisted');

    b.drop(KEPT);
    b.scan();

    const after = b.outline(KEPT);
    assert.equal(after.source, 'exported', 'the document does not say which file it is reading');
    assert.equal(after.present, true);
    assert.equal(after.records, before.records, 'the copy is not the document that was there');
    assert.deepEqual(
      after.nodes.map((n) => n.k), before.nodes.map((n) => n.k),
      'the same renderer over the copy produced a different document',
    );
    assert.equal(after.bytes, before.bytes);
  } finally {
    b.dispose();
  }
});
