import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readSessionNames, sessionNamesPath, setSessionName, SESSION_NAMES_PROTOCOL,
} from '../../src/core/session-names.ts';
import { removeTree } from '../helpers/tmp.ts';

const WRITER = fileURLToPath(new URL('../fixtures/session-name-writer.ts', import.meta.url));

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-session-names-'));
  t.after(() => removeTree(dir));
  return dir;
}

test('a name round-trips under the session id it was written with', (t) => {
  const dir = root(t);
  const written = setSessionName(dir, 'sess-abcdef01', 'release notes');
  assert.deepEqual(written, { written: true, error: null });

  const state = readSessionNames(dir);
  assert.equal(state.error, null);
  const entry = state.names.get('sess-abcdef01');
  assert.equal(entry?.name, 'release notes');
  assert.match(entry?.at ?? '', /^\d{4}-\d{2}-\d{2}T/);
});

test('the key is the RAW session id, unsanitized — this file is not keyed by filename', (t) => {
  const dir = root(t);
  // `sanitizeSessionId` would fold this to a filename-safe spelling; the store
  // is one JSON file keyed by the id the hooks actually receive, so the id
  // must come back byte for byte.
  const raw = '../weird id/with:colons';
  assert.equal(setSessionName(dir, raw, 'the odd one').written, true);
  assert.equal(readSessionNames(dir).names.get(raw)?.name, 'the odd one');
});

test('a second name for the same session replaces the first — one name per session', (t) => {
  const dir = root(t);
  setSessionName(dir, 's1', 'first');
  assert.equal(setSessionName(dir, 's1', 'second').written, true);
  const state = readSessionNames(dir);
  assert.equal(state.names.size, 1);
  assert.equal(state.names.get('s1')?.name, 'second');
});

test('naming a second session leaves the first one alone', (t) => {
  const dir = root(t);
  setSessionName(dir, 's1', 'one');
  setSessionName(dir, 's2', 'two');
  const state = readSessionNames(dir);
  assert.equal(state.names.get('s1')?.name, 'one');
  assert.equal(state.names.get('s2')?.name, 'two');
});

test('an empty name is refused, and nothing is written', (t) => {
  const dir = root(t);
  const result = setSessionName(dir, 's1', '');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /empty/i);
  assert.equal(existsSync(sessionNamesPath(dir)), false);
});

test('a whitespace-only name is refused — it would render as an empty cell', (t) => {
  const dir = root(t);
  const result = setSessionName(dir, 's1', '   ');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /empty/i);
  assert.equal(readSessionNames(dir).names.size, 0);
});

test('a name longer than 64 characters is refused, with the length in the message', (t) => {
  const dir = root(t);
  const long = 'x'.repeat(65);
  const result = setSessionName(dir, 's1', long);
  assert.equal(result.written, false);
  // Both numbers: the limit, and what was actually passed. A refusal that
  // names only the limit leaves the caller counting characters by hand.
  assert.match(result.error ?? '', /65/);
  assert.match(result.error ?? '', /64/);
  assert.equal(readSessionNames(dir).names.size, 0);
});

test('exactly 64 characters is accepted — the limit is inclusive', (t) => {
  const dir = root(t);
  assert.equal(setSessionName(dir, 's1', 'y'.repeat(64)).written, true);
});

test('a newline in a name is refused', (t) => {
  const dir = root(t);
  const result = setSessionName(dir, 's1', 'release\nnotes');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /control character|newline|tab/i);
  assert.equal(readSessionNames(dir).names.size, 0);
});

test('a tab in a name is refused', (t) => {
  const dir = root(t);
  const result = setSessionName(dir, 's1', 'release\tnotes');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /control character|newline|tab/i);
});

test('any other control character in a name is refused', (t) => {
  const dir = root(t);
  const result = setSessionName(dir, 's1', 'release\u0007notes');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /control character|newline|tab/i);
});

test('a name already held by a DIFFERENT session is refused, naming the holder', (t) => {
  const dir = root(t);
  setSessionName(dir, 'sess-holder', 'release notes');
  const result = setSessionName(dir, 'sess-other', 'release notes');
  assert.equal(result.written, false);
  assert.match(result.error ?? '', /sess-holder/);
  // The way out is stated, not left to be guessed: renaming the holder frees
  // the name. Refusing at write is what lets every selector treat a name as
  // unambiguous.
  assert.match(result.error ?? '', /renam/i);
  assert.equal(readSessionNames(dir).names.get('sess-other'), undefined);
});

test('re-writing a session its own current name is not a duplicate', (t) => {
  const dir = root(t);
  setSessionName(dir, 's1', 'release notes');
  assert.equal(setSessionName(dir, 's1', 'release notes').written, true);
});

test('a missing store is an empty map, not an error', (t) => {
  const state = readSessionNames(root(t));
  assert.equal(state.error, null);
  assert.equal(state.names.size, 0);
});

test('corrupt JSON degrades to an empty map plus an error, and never throws', (t) => {
  const dir = root(t);
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(sessionNamesPath(dir), '{"protocol": "mycontext-sess', 'utf8');
  let state!: ReturnType<typeof readSessionNames>;
  assert.doesNotThrow(() => { state = readSessionNames(dir); });
  assert.equal(state.names.size, 0);
  assert.match(state.error ?? '', /JSON/);
});

test('a store declaring another protocol is an error, not silently reinterpreted', (t) => {
  const dir = root(t);
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(sessionNamesPath(dir),
    JSON.stringify({ protocol: 'something-else/9', names: { s1: { name: 'x', at: 'T' } } }),
    'utf8');
  const state = readSessionNames(dir);
  assert.equal(state.names.size, 0);
  assert.match(state.error ?? '', /protocol/);
  assert.match(state.error ?? '', new RegExp(SESSION_NAMES_PROTOCOL));
});

test('a malformed entry is dropped and disclosed, the readable ones survive', (t) => {
  const dir = root(t);
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(sessionNamesPath(dir), JSON.stringify({
    protocol: SESSION_NAMES_PROTOCOL,
    names: { good: { name: 'kept', at: 'T0' }, bad: { at: 'T0' } },
  }), 'utf8');
  const state = readSessionNames(dir);
  assert.equal(state.names.get('good')?.name, 'kept');
  assert.equal(state.names.get('bad'), undefined);
  assert.match(state.error ?? '', /bad/);
});

test('the store is gitignored — a session name never travels with the corpus', (t) => {
  const dir = root(t);
  // `state/` may have no `.gitignore` yet: nothing else has written a
  // snapshot in this workspace, and a session id reaching git is a session
  // identifier travelling with the corpus.
  setSessionName(dir, 's1', 'release notes');
  const ignore = path.join(dir, 'state', '.gitignore');
  assert.equal(existsSync(ignore), true);
  assert.equal(readFileSync(ignore, 'utf8'), '*\n');
});

test('the store is written under state/session-names.json', (t) => {
  const dir = root(t);
  assert.equal(sessionNamesPath(dir), path.join(dir, 'state', 'session-names.json'));
  setSessionName(dir, 's1', 'release notes');
  assert.equal(existsSync(sessionNamesPath(dir)), true);
});

test('no temp file is left behind by a successful write', (t) => {
  const dir = root(t);
  setSessionName(dir, 's1', 'release notes');
  const strays = readdirSync(path.join(dir, 'state')).filter((n) => n.includes('.tmp-'));
  assert.deepEqual(strays, []);
});

/**
 * Two processes at once, and what this store does and does not promise.
 *
 * Six children write six DIFFERENT session ids simultaneously and every entry
 * has to survive: a read-modify-write with no serialization loses whichever
 * writer read first, silently, which is the one failure this project rules
 * out. Two more children then write the SAME id, and the promise there is
 * weaker and is stated rather than glossed: last writer wins. One of the two
 * names is on disk afterwards and the other is gone — what must not happen is
 * that the ENTRY disappears, or that the file is left unreadable.
 */
test('concurrent writes from separate processes lose no entry', async (t) => {
  const dir = root(t);
  const ids = ['s1', 's2', 's3', 's4', 's5', 's6'];

  const run = (id: string, name: string): Promise<{ code: number; err: string }> =>
    new Promise((resolve) => {
      const child = spawn(
        process.execPath,
        ['--disable-warning=ExperimentalWarning', WRITER, dir, id, name],
        { stdio: ['ignore', 'ignore', 'pipe'] },
      );
      let err = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => { err += chunk; });
      child.on('close', (code) => resolve({ code: code ?? 1, err }));
    });

  const results = await Promise.all(ids.map((id) => run(id, `name for ${id}`)));
  for (const [i, result] of results.entries()) {
    assert.equal(result.code, 0, `writer ${ids[i]} failed: ${result.err}`);
  }

  const state = readSessionNames(dir);
  assert.equal(state.error, null, `the store was left unreadable: ${state.error}`);
  assert.deepEqual([...state.names.keys()].sort(), ids,
    'a concurrent writer\'s entry was lost — the read-modify-write is not serialized');

  // The same id from two processes at once. Last writer wins; the test says
  // so rather than pretending the store merges.
  const [a, b] = await Promise.all([run('same', 'from A'), run('same', 'from B')]);
  assert.equal(a.code, 0, a.err);
  assert.equal(b.code, 0, b.err);
  const after = readSessionNames(dir);
  assert.equal(after.error, null);
  const won = after.names.get('same')?.name;
  assert.ok(won === 'from A' || won === 'from B',
    `the entry for "same" is ${JSON.stringify(won)} — one of the two writers should have won`);
  assert.deepEqual([...after.names.keys()].sort(), [...ids, 'same'].sort(),
    'the earlier entries did not survive the contended write');
});
