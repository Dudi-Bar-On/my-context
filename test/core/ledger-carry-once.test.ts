/**
 * `core/ledger.ts`'s carry-once queue — the storage half of `mycontext carry`.
 *
 * The CLI's own tests (`test/cli/carry.test.ts`) cover the human-facing
 * behaviour end to end; this file is about the file itself: that it never
 * throws, that a corrupt or foreign-shaped file degrades to "nothing is
 * carried" rather than crashing the caller, and that `spendCarryOnce` really
 * is read-and-clear in one step — the property the whole one-shot contract
 * rests on.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  carryOncePath, clearCarryOnce, markCarryOnce, readCarryOnce, spendCarryOnce,
} from '../../src/core/ledger.ts';
import { removeTree } from '../helpers/tmp.ts';

function root(): { dir: string; dispose(): void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-carry-once-'));
  return { dir, dispose: () => removeTree(dir) };
}

test('reading before anything is marked yields an empty queue, not an error', () => {
  const r = root();
  try {
    assert.deepEqual(readCarryOnce(r.dir), { ids: [], error: null });
  } finally { r.dispose(); }
});

test('marking writes the id, and the file is protocol-stamped and gitignored', () => {
  const r = root();
  try {
    const result = markCarryOnce(r.dir, 'RULE-a', 'human');
    assert.deepEqual(result, { already: false, written: true, error: null });
    assert.deepEqual(readCarryOnce(r.dir), { ids: ['RULE-a'], error: null });
    const raw = JSON.parse(readFileSync(carryOncePath(r.dir), 'utf8')) as { protocol: string };
    assert.equal(raw.protocol, 'mycontext-carry-once/1');
    assert.equal(
      readFileSync(path.join(r.dir, 'state', '.gitignore'), 'utf8'), '*\n',
    );
  } finally { r.dispose(); }
});

test('marking twice is idempotent: the second call reports `already` and adds no duplicate', () => {
  const r = root();
  try {
    markCarryOnce(r.dir, 'RULE-a', 'human');
    const second = markCarryOnce(r.dir, 'RULE-a', 'human');
    assert.deepEqual(second, { already: true, written: false, error: null });
    assert.deepEqual(readCarryOnce(r.dir), { ids: ['RULE-a'], error: null });
  } finally { r.dispose(); }
});

test('marking a second, different id extends the queue in the order marked', () => {
  const r = root();
  try {
    markCarryOnce(r.dir, 'RULE-a', 'human');
    markCarryOnce(r.dir, 'RULE-b', 'human');
    assert.deepEqual(readCarryOnce(r.dir), { ids: ['RULE-a', 'RULE-b'], error: null });
  } finally { r.dispose(); }
});

test('clearing an empty queue reports no ids and still succeeds', () => {
  const r = root();
  try {
    assert.deepEqual(clearCarryOnce(r.dir), { ids: [], written: true, error: null });
  } finally { r.dispose(); }
});

test('clearing a populated queue empties it and returns exactly what was cleared', () => {
  const r = root();
  try {
    markCarryOnce(r.dir, 'RULE-a', 'human');
    markCarryOnce(r.dir, 'RULE-b', 'human');
    assert.deepEqual(clearCarryOnce(r.dir), { ids: ['RULE-a', 'RULE-b'], written: true, error: null });
    assert.deepEqual(readCarryOnce(r.dir), { ids: [], error: null });
  } finally { r.dispose(); }
});

/**
 * The one-shot contract's whole mechanism: `spendCarryOnce` returns what was
 * queued AND empties the file in the same call, so a caller that reads it
 * once — `core/inject.ts`, once per injection — cannot observe the same mark
 * twice no matter how many times it injects afterward.
 */
test('spendCarryOnce reads and clears atomically: a second call returns nothing', () => {
  const r = root();
  try {
    markCarryOnce(r.dir, 'RULE-a', 'human');
    markCarryOnce(r.dir, 'RULE-b', 'human');
    assert.deepEqual(spendCarryOnce(r.dir), { ids: ['RULE-a', 'RULE-b'], error: null });
    assert.deepEqual(spendCarryOnce(r.dir), { ids: [], error: null });
    assert.deepEqual(readCarryOnce(r.dir), { ids: [], error: null });
  } finally { r.dispose(); }
});

test('spendCarryOnce on an empty queue is a true no-op — nothing is written', () => {
  const r = root();
  try {
    // No `state/` directory exists at all yet; spending must not create one.
    spendCarryOnce(r.dir);
    assert.equal(existsSync(path.join(r.dir, 'state')), false);
  } finally { r.dispose(); }
});

/* ---------------------------------------------------------------------------
 * Never throws, and degrades to "nothing carried" — `INV-hooks-fail-open`'s
 * direction, the same one every other state file in `state/` takes.
 * ------------------------------------------------------------------------- */

function writeRaw(dir: string, body: string): void {
  mkdirSync(path.join(dir, 'state'), { recursive: true });
  writeFileSync(carryOncePath(dir), body, 'utf8');
}

test('a file that is not JSON degrades to an empty queue, with the reason named', () => {
  const r = root();
  try {
    writeRaw(r.dir, 'not json at all');
    const { ids, error } = readCarryOnce(r.dir);
    assert.deepEqual(ids, []);
    assert.match(error ?? '', /not valid JSON/);
  } finally { r.dispose(); }
});

test('a JSON array (not an object) degrades to an empty queue', () => {
  const r = root();
  try {
    writeRaw(r.dir, '[1, 2, 3]');
    const { ids, error } = readCarryOnce(r.dir);
    assert.deepEqual(ids, []);
    assert.match(error ?? '', /is not a JSON object/);
  } finally { r.dispose(); }
});

test('the wrong protocol string degrades to an empty queue, and never silently upgrades', () => {
  const r = root();
  try {
    writeRaw(r.dir, JSON.stringify({ protocol: 'mycontext-carry-once/2', ids: [{ id: 'RULE-a' }] }));
    const { ids, error } = readCarryOnce(r.dir);
    assert.deepEqual(ids, []);
    assert.match(error ?? '', /declares protocol/);
  } finally { r.dispose(); }
});

test('a missing "ids" array degrades to an empty queue rather than throwing on .map', () => {
  const r = root();
  try {
    writeRaw(r.dir, JSON.stringify({ protocol: 'mycontext-carry-once/1' }));
    const { ids, error } = readCarryOnce(r.dir);
    assert.deepEqual(ids, []);
    assert.match(error ?? '', /carries no usable "ids"/);
  } finally { r.dispose(); }
});

test('an entry with no string id is silently dropped, not thrown on', () => {
  const r = root();
  try {
    writeRaw(r.dir, JSON.stringify({
      protocol: 'mycontext-carry-once/1',
      ids: [{ id: 'RULE-a' }, { note: 'missing an id field' }, 'not even an object', 42],
    }));
    assert.deepEqual(readCarryOnce(r.dir), { ids: ['RULE-a'], error: null });
  } finally { r.dispose(); }
});

test('spendCarryOnce on a corrupt file spends nothing and reports the error, never throws', () => {
  const r = root();
  try {
    writeRaw(r.dir, '{ broken');
    const { ids, error } = spendCarryOnce(r.dir);
    assert.deepEqual(ids, []);
    assert.ok(error, 'a corrupt file must surface an error rather than silently spending nothing');
  } finally { r.dispose(); }
});

test('markCarryOnce against a corrupt file starts a fresh queue rather than throwing', () => {
  const r = root();
  try {
    writeRaw(r.dir, '{ broken');
    const result = markCarryOnce(r.dir, 'RULE-a', 'human');
    assert.equal(result.written, true);
    assert.deepEqual(readCarryOnce(r.dir), { ids: ['RULE-a'], error: null });
  } finally { r.dispose(); }
});
