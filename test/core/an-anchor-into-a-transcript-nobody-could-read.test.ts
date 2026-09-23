// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m14: `resolveAnchor` gave one answer to three states, and
 * the owner was told the wrong one.**
 *
 * `iterateTranscript` documents its own silence — *"a file that will not open
 * yields nothing"* — and that is the right answer for a REBUILD, which would
 * otherwise lose an archive to one bad file. It is the wrong answer for a
 * question about ONE anchor, because the empty walk arrives at `resolveAnchor`
 * shaped exactly like the walk that ran fine and found nothing at the offset.
 *
 * So three states shared one value:
 *
 *  1. a record starts at the byte and is read;
 *  2. the transcript was read and the byte is not the start of a record — what
 *     a CHARACTER offset produces, which `ResolvedAnchor.record` documents;
 *  3. the transcript could not be read at all — locked, replaced, gone from
 *     under the row.
 *
 * And `mycontext conversation anchor` says the diagnosis for (2) out loud:
 * *"nothing starts at that byte … That is what a CHARACTER offset produces on
 * this archive."* Said about (3), that sends the owner to check a number that
 * was never wrong, about a file nobody opened.
 *
 * ── HOW THE THIRD STATE IS PRODUCED HERE ──────────────────────────────────
 *
 * A DIRECTORY where the transcript was. `icacls /deny` does not bite for the
 * account this suite runs as (measured 2026-09-14 and recorded in
 * `test/review/frozen-counter-and-broken-trigger.test.ts`), so a test written
 * against a permission bit would pass by never failing. A directory in a
 * file's place refuses `openSync` on every platform this ships to.
 *
 * ── AND THE TWO CONTROLS ──────────────────────────────────────────────────
 *
 * State (2) must keep answering exactly what it answered — an offset landing
 * mid-record is not a read failure and must not start claiming to be one — and
 * state (1) must be untouched. Without both, a `resolveAnchor` that reported
 * "unreadable" for everything would pass the first test here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { markAnchor, resolveAnchor } from '../../src/core/anchors.ts';
import { Store } from '../../src/core/store.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const say = (role: 'user' | 'assistant', text: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? text : [{ type: 'text', text }] },
  timestamp: at,
  cwd: '/w',
  gitBranch: 'master',
});

interface Fixture {
  env: Record<string, string | undefined>;
  cwd: string;
  dbPath: string;
  file: string;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchorread-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchorread-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const file = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(file, [
    say('user', 'come back to this', '2026-09-01T10:00:00.000Z'),
    say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:01.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');
  return {
    env: { CLAUDE_CONFIG_DIR: home },
    cwd,
    dbPath,
    file,
    dispose: () => { removeTree(home); removeTree(cwd); },
  };
}

/** Where a record's line starts, in bytes, read from the file itself. */
function byteOf(file: string, needle: string): number {
  const text = readFileSync(file, 'utf8');
  const lineStart = text.lastIndexOf('\n', text.indexOf(needle)) + 1;
  return Buffer.byteLength(text.slice(0, lineStart));
}

/** Mark the anchor, then run `body` against a resolved copy of it. */
function marked(f: Fixture, byteOffset: number): ReturnType<typeof resolveAnchor> {
  rebuildConversations(f.dbPath, f.env, f.cwd, {});
  const index = ConversationIndex.open(f.dbPath);
  try {
    const row = markAnchor(index, { sessionId: SESSION, byteOffset, label: 'the ruling' });
    return resolveAnchor(index, row.id);
  } finally {
    index.close();
  }
}

test('a transcript that could not be read is NOT reported as a byte that holds no record', () => {
  const f = fixture();
  try {
    const at = byteOf(f.file, 'the ruling is recorded here');
    rebuildConversations(f.dbPath, f.env, f.cwd, {});
    const index = ConversationIndex.open(f.dbPath);
    try {
      const row = markAnchor(index, { sessionId: SESSION, byteOffset: at, label: 'the ruling' });
      // The row is written against a readable file; the file goes away
      // UNDER it, which is the state a locked or replaced transcript reaches.
      rmSync(f.file);
      mkdirSync(f.file);

      const resolved = resolveAnchor(index, row.id);
      assert.ok(resolved !== null, 'the anchor row itself is still there and must still resolve');
      assert.equal(resolved.record, null);
      assert.equal(
        typeof resolved.unreadable, 'string',
        'an anchor into a transcript nobody could open reports exactly what an anchor whose ' +
        'byte lands mid-record reports, and the CLI says the second one out loud — it sends ' +
        'the owner to check a number that was never wrong',
      );
      assert.ok(
        resolved.unreadable!.includes(f.file),
        'the reason does not name the transcript, so there is nothing to go and look at',
      );
    } finally {
      index.close();
    }
  } finally { f.dispose(); }
});

test('a byte that lands mid-record still answers exactly what it always answered', () => {
  // The control that matters: state (2) is a real, documented answer — what a
  // CHARACTER offset produces — and it must not start claiming to be a read
  // failure. Without this, reporting "unreadable" unconditionally goes green
  // on the test above.
  const f = fixture();
  try {
    const resolved = marked(f, byteOf(f.file, 'the ruling is recorded here') + 7);
    assert.ok(resolved !== null);
    assert.equal(resolved.record, null, 'nothing parses at a byte inside a record');
    assert.equal(
      resolved.unreadable, null,
      'a transcript that was read from end to end was reported as one that could not be read',
    );
  } finally { f.dispose(); }
});

test('an anchor that resolves is untouched', () => {
  const f = fixture();
  try {
    const resolved = marked(f, byteOf(f.file, 'the ruling is recorded here'));
    assert.ok(resolved !== null);
    assert.equal(resolved.text, 'the ruling is recorded here');
    assert.equal(resolved.unreadable, null);
  } finally { f.dispose(); }
});

/* ---------------------------------------------------------------------------
 * AND THE DISCLOSURE IS READ, IN THIS SAME CHANGE.
 *
 * A field no surface prints is the same silence one layer in — the item's own
 * third question. `mycontext conversation anchor` is the surface that said the
 * wrong thing, so it is the surface that has to say the right one.
 * ------------------------------------------------------------------------- */

test('the CLI stops telling the owner his byte was wrong about a file nobody opened', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchorcli-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchorcli-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(file, [
    say('user', 'come back to this', '2026-09-01T10:00:00.000Z'),
    say('assistant', 'the ruling is recorded here', '2026-09-01T10:00:01.000Z'),
  ].map((r) => JSON.stringify(r)).join('\n') + '\n');

  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  rebuildConversations(ws.dbPath, { ...process.env, CLAUDE_CONFIG_DIR: home }, cwd, {});

  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const out: string[] = [];
  try {
    const at = byteOf(file, 'the ruling is recorded here');
    rmSync(file);
    mkdirSync(file);

    const code = runCli(
      ['conversation', 'anchor', SESSION, String(at), '--label', 'the ruling'],
      cwd, (line: string) => out.push(line),
    );
    const said = out.join('\n');
    assert.equal(code, 0, said);
    assert.match(said, /marked/u, 'the mark is kept whatever the read did');
    assert.doesNotMatch(
      said, /CHARACTER offset/u,
      'the owner is told his byte offset is the kind that lands mid-record, about a transcript ' +
      'nothing opened — a diagnosis of a number that was never looked at',
    );
    assert.match(said, /could not be opened|could not be read/u);
  } finally {
    if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
    removeTree(home);
    removeTree(cwd);
  }
});
