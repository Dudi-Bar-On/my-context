import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  carrySourcePath, CONTINUITY_PROTOCOL, resolveCarry, setCarrySource,
} from '../../src/core/continuity.ts';
import { appendSeen, seenFilePath } from '../../src/core/seen-file.ts';
import { setSessionName } from '../../src/core/session-names.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * Which session a new one carries from, and — the half that matters — when the
 * honest answer is `null`.
 *
 * Every case here is one of two failures. **Carrying from the wrong session**
 * puts a previous window's ids in front of this one's index under a label that
 * names the wrong afternoon. **Reporting a carry that carries nothing** is the
 * silent one: `resolveCarry` returning `{ ids: [] }` reads downstream as a
 * successful carry of zero items, and the disclosure Task 19 renders would say
 * so. Both are `INV-nothing-is-dropped-silently` seen from the source end.
 */

function root(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'myctx-carry-'));
  mkdirSync(join(dir, 'state'), { recursive: true });
  t.after(() => removeTree(dir));
  return dir;
}

/**
 * A seen file for `key`, stamped at a chosen instant.
 *
 * The mtime is SET rather than left to the clock: the default source is "the
 * most recent", and a fixture whose files land in the same filesystem tick
 * would pass or fail on timer resolution rather than on the rule.
 */
function seed(dir: string, key: string, mtime: string, ids = ['CONST-a']): void {
  appendSeen(dir, key, ids.map((id) => ({ id, tier: 'jit' as const, at: '2026-08-20T00:00:00Z' })));
  const when = new Date(mtime);
  utimesSync(seenFilePath(dir, key), when, when);
}

test('the default source is the most recent OTHER parent session', (t) => {
  const dir = root(t);
  seed(dir, 'sess-old', '2026-08-18T10:00:00Z', ['CONST-old']);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z', ['CONST-new']);

  const carry = resolveCarry(dir, 'sess-current');
  assert.equal(carry?.sessionId, 'sess-new');
  assert.deepEqual(carry?.ids, ['CONST-new']);
});

test('the current session is never its own source', (t) => {
  const dir = root(t);
  seed(dir, 'sess-old', '2026-08-18T10:00:00Z', ['CONST-old']);
  // The current session is the most recent thing in `state/` on any resume, so
  // without the exclusion the default would always be "carry from yourself" —
  // a no-op that reports success.
  seed(dir, 'sess-current', '2026-08-19T10:00:00Z', ['CONST-mine']);

  const carry = resolveCarry(dir, 'sess-current');
  assert.equal(carry?.sessionId, 'sess-old');
  assert.deepEqual(carry?.ids, ['CONST-old']);
});

test('with no other session there is nothing to carry, and that is null rather than an empty carry', (t) => {
  const dir = root(t);
  seed(dir, 'sess-current', '2026-08-19T10:00:00Z');

  assert.equal(resolveCarry(dir, 'sess-current'), null);
});

test('sibling files are never chosen as a source', (t) => {
  const dir = root(t);
  seed(dir, 'sess-old', '2026-08-18T10:00:00Z', ['CONST-old']);
  // `sanitizeSessionId` folds `::` to `__`, which is the sibling marker. A
  // subagent's dedupe file is not a session anybody can carry from: it holds
  // what ONE agent was handed, filed under a key no audit query names.
  seed(dir, 'sess-old::agent-7', '2026-08-19T10:00:00Z', ['CONST-agent']);

  const carry = resolveCarry(dir, 'sess-current');
  assert.equal(carry?.sessionId, 'sess-old');
  assert.deepEqual(carry?.ids, ['CONST-old']);
});

test('an explicit selection wins over the default', (t) => {
  const dir = root(t);
  seed(dir, 'sess-old', '2026-08-18T10:00:00Z', ['CONST-old']);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z', ['CONST-new']);

  assert.deepEqual(setCarrySource(dir, 'sess-old'), { written: true, error: null });
  const carry = resolveCarry(dir, 'sess-current');
  assert.equal(carry?.sessionId, 'sess-old');
  assert.deepEqual(carry?.ids, ['CONST-old']);
});

test('--none yields null, and is not the same state as never having chosen', (t) => {
  const dir = root(t);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z');

  assert.equal(resolveCarry(dir, 'sess-current')?.sessionId, 'sess-new');
  assert.deepEqual(setCarrySource(dir, null), { written: true, error: null });
  assert.equal(resolveCarry(dir, 'sess-current'), null,
    'an explicit "carry nothing" is honoured rather than falling through to the default');

  const stored = JSON.parse(readFileSync(carrySourcePath(dir), 'utf8'));
  assert.equal(stored.protocol, CONTINUITY_PROTOCOL);
  assert.equal(stored.source, null);
});

test('a corrupt continuity.json degrades to the default and never throws', (t) => {
  const dir = root(t);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z', ['CONST-new']);

  for (const body of ['{not json', '[]', '{"protocol":"other/9","source":"sess-new"}',
    '{"protocol":"mycontext-continuity/1","source":42}']) {
    writeFileSync(carrySourcePath(dir), body, 'utf8');
    const carry = resolveCarry(dir, 'sess-current');
    assert.equal(carry?.sessionId, 'sess-new', `degraded wrongly for ${body}`);
  }
});

test('a source whose seen file is gone yields null rather than an empty carry that claims success', (t) => {
  const dir = root(t);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z');
  // `state/` is swept at 30 days by mtime, so a session the audit log still
  // names can have nothing left on disk. Answering `{ ids: [] }` would be a
  // carry that reports success and delivers nothing.
  setCarrySource(dir, 'sess-swept');

  assert.equal(resolveCarry(dir, 'sess-current'), null);
});

test('an unreadable seen file is nothing to carry, not an empty carry', (t) => {
  const dir = root(t);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z');
  writeFileSync(seenFilePath(dir, 'sess-new'), '{"protocol":"nonsense/0"}\n', 'utf8');

  assert.equal(resolveCarry(dir, 'sess-current'), null);
});

test('an explicitly chosen current session is refused too — carrying from yourself is never a carry', (t) => {
  const dir = root(t);
  seed(dir, 'sess-current', '2026-08-19T10:00:00Z');
  setCarrySource(dir, 'sess-current');

  assert.equal(resolveCarry(dir, 'sess-current'), null);
});

test('the label is the session name when it has one, and its short prefix when it does not', (t) => {
  const dir = root(t);
  seed(dir, '9e5b6b17-c186-4c93-a0a5-775b4eccd9e7', '2026-08-19T10:00:00Z');

  assert.equal(resolveCarry(dir, 'sess-current')?.label, '9e5b6b17',
    'nothing is invented for an unnamed session — the short prefix is a poor label and an ' +
    'honest one');

  setSessionName(dir, '9e5b6b17-c186-4c93-a0a5-775b4eccd9e7', 'auth-refactor');
  assert.equal(resolveCarry(dir, 'sess-current')?.label, 'auth-refactor');
});

test('a null current session id still resolves — the manual path has no id to exclude', (t) => {
  const dir = root(t);
  seed(dir, 'sess-new', '2026-08-19T10:00:00Z', ['CONST-new']);

  assert.deepEqual(resolveCarry(dir, null)?.ids, ['CONST-new']);
});

test('resolveCarry never throws, whatever state/ is', (t) => {
  const dir = root(t);
  // No `state/` at all — a workspace where no hook has ever run.
  const bare = mkdtempSync(join(tmpdir(), 'myctx-carry-bare-'));
  t.after(() => removeTree(bare));

  assert.equal(resolveCarry(bare, 'sess-current'), null);
  assert.equal(resolveCarry(dir, 'sess-current'), null);
  assert.equal(resolveCarry('', null), null);
});

test('setCarrySource refuses an empty id rather than writing one nothing can reach', (t) => {
  const dir = root(t);
  const write = setCarrySource(dir, '');
  assert.equal(write.written, false);
  assert.match(write.error ?? '', /my_context: /);
});

test('the carry source is gitignored — a session id never travels with the corpus', (t) => {
  const dir = root(t);
  setCarrySource(dir, 'sess-new');

  assert.equal(carrySourcePath(dir), join(dir, 'state', 'continuity.json'));
  assert.equal(readFileSync(join(dir, 'state', '.gitignore'), 'utf8'), '*\n');
});
