// @basis TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody,
// INV-nothing-is-dropped-silently
/**
 * **`assertDoor`'s `catch { return 0 }` is no longer the end of the story** —
 * `TASK-two-checks-route-their-only-disclosure-to-a-surface-nobody`.
 *
 * Two properties are asserted here and they pull in opposite directions, which
 * is why both are written down:
 *
 *  1. **The hook path is unchanged.** `assertDoor` runs inside `PreToolUse`.
 *     A rule-store fault must not make it throw, must not make it cry wolf on
 *     a reader's stderr, and must not make it claim constants were missed that
 *     nothing could count. It still returns `''` over a store it cannot read,
 *     and it still does not throw.
 *  2. **The refusal is a VALUE the door hands back, not an exception it
 *     swallows.** `readStoreAtDoor` is the read `assertDoor` performs, lifted
 *     out of the `try` so that the fault has a name, and `storeFault` is the
 *     same question with the seal added — which is what `mycontext doctor`
 *     asks (`test/doctor/rule-store.test.ts`). One resolution and one answer,
 *     for `resolveStoreDir`'s own stated reason: a second one would let the
 *     surface report about a different store from the one the door read.
 *
 * Every fixture is a store of its own under `MYCONTEXT_RULES_DIR`, never the
 * shipped one — `KNOWN-running-the-test-suite-can-leave-the-shipped-rule-store`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  RULES_DIR_ENV, assertDoor, readStoreAtDoor, storeFault,
} from '../../src/rules/deliver.ts';
import { deliveredFile } from '../../src/rules/delivered.ts';
import { writeManifest } from '../../src/rules/manifest.ts';
import { removeTree } from '../helpers/tmp.ts';

const PRODUCT_ENTRY = [
  '---',
  'id: a-body-stops-at-the-first-heading',
  'kind: fact',
  'tier: product',
  'title: a body stops at the first ## heading',
  'truth: everything from the first `## ` heading onwards is dropped when a body is stored',
  'breaks: the tail of a body is lost with no error, and the write reports success',
  'example: the 2026-09-07 item whose Observations block vanished on save',
  'check: "preventive:the write path refuses a body carrying a ## heading"',
  '---',
  '',
  'True for anyone who installs the tool.',
  '',
].join('\n');

function tmp(tag: string): string {
  return mkdtempSync(path.join(tmpdir(), `myctx-doorfault-${tag}-`));
}

/** A sound store of one product entry, sealed. */
function soundStore(): string {
  const dir = tmp('good');
  writeFileSync(path.join(dir, 'fact.md'), PRODUCT_ENTRY, 'utf8');
  writeManifest(dir);
  return dir;
}

/** A state root that is not this package, so the reader tier is `product`. */
function stateRoot(): string {
  const dir = tmp('ws');
  const root = path.join(dir, '.my_context');
  mkdirSync(root, { recursive: true });
  return root;
}

/** Point every door and assertion at `dir` for one synchronous call, and always put it back. */
function withStoreDir<T>(dir: string, fn: () => T): T {
  const before = process.env[RULES_DIR_ENV];
  process.env[RULES_DIR_ENV] = dir;
  try { return fn(); } finally {
    if (before === undefined) delete process.env[RULES_DIR_ENV];
    else process.env[RULES_DIR_ENV] = before;
  }
}

test('a store that cannot be listed is a named fault, not a silent zero', () => {
  const ws = stateRoot();
  try {
    const read = readStoreAtDoor(ws, path.join(ws, 'no-such-store'));
    assert.equal(read.applicable, 0, 'the door still counts nothing, so it still cries no wolf');
    assert.ok(read.fault, 'and the reason is carried rather than thrown away');
    assert.equal(read.fault!.kind, 'unloadable');
    assert.match(read.fault!.dir, /no-such-store/);
  } finally {
    removeTree(path.dirname(ws));
  }
});

test('a store whose every entry refuses to parse is unloadable, never an empty store', () => {
  const ws = stateRoot();
  const store = tmp('broken');
  try {
    writeFileSync(path.join(store, 'fact.md'), 'no frontmatter here at all\n', 'utf8');
    const read = readStoreAtDoor(ws, store);
    assert.equal(read.applicable, 0);
    assert.ok(read.fault, 'zero entries with a refusal is not the same fact as zero entries');
    assert.equal(read.fault!.kind, 'unloadable');
  } finally {
    removeTree(path.dirname(ws));
    removeTree(store);
  }
});

test('a sound store is no fault at all, and the count is the count', () => {
  const ws = stateRoot();
  const store = soundStore();
  try {
    const read = readStoreAtDoor(ws, store);
    assert.equal(read.fault, null);
    assert.equal(read.applicable, 1, 'the one product entry applies in a stranger workspace');
    assert.equal(storeFault(ws, store), null, 'and the seal agrees');
  } finally {
    removeTree(path.dirname(ws));
    removeTree(store);
  }
});

test('the seal is the doctor half and the door never pays for it', () => {
  const ws = stateRoot();
  const store = soundStore();
  try {
    writeFileSync(path.join(store, 'manifest.json'), '{ this is not json', 'utf8');
    // The DOOR reads entries only: the entry still parses, so it counts 1 and
    // has nothing to report. That is the attribution argument report 3 called
    // sound, and it is left standing.
    const read = readStoreAtDoor(ws, store);
    assert.equal(read.applicable, 1);
    assert.equal(read.fault, null);
    // The SEAL is where the fault is, and `storeFault` is the question doctor
    // asks of the same directory.
    const fault = storeFault(ws, store);
    assert.ok(fault);
    assert.equal(fault!.kind, 'unsealed');
  } finally {
    removeTree(path.dirname(ws));
    removeTree(store);
  }
});

/**
 * **The `missed` row says which zero it is** — the write-path half of
 * `STD-a-measured-zero-is-drawn-and-named`.
 *
 * `assertDelivered` records *"N constant(s) would have applied"* beside every
 * missed door, and spec §8.2 counts those rows. With `assertDoor` answering
 * `0` for a store it could not read, the row asserted a measurement nobody
 * took — and that row is the only durable trace the assertion leaves. The
 * sentence is still withheld (the count is still `0`, so no wolf is cried),
 * and only the RECORD changed.
 */
test('the missed row records that the store could not be read, never a zero nobody measured', () => {
  const ws = stateRoot();
  try {
    const key = 'a-session-with-no-door';
    withStoreDir(path.join(ws, 'no-such-store'), () => {
      assert.equal(assertDoor(ws, key), '', 'still no sentence: nothing could be missed');
    });
    const rows = readFileSync(deliveredFile(ws), 'utf8')
      .split('\n').filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as { kind: string; key: string; note?: string });
    const missed = rows.find((r) => r.kind === 'missed' && r.key === key);
    assert.ok(missed, 'the row is still written — "no door ran for this key" is what §8.2 counts');
    assert.match(missed!.note ?? '', /could not be read/);
    assert.match(missed!.note ?? '', /UNMEASURED rather than zero/);
    assert.doesNotMatch(missed!.note ?? '', /^.*\b0 constant\(s\) would have applied/,
      'the sentence that reads as a measurement must not be what a broken store leaves behind');
  } finally {
    removeTree(path.dirname(ws));
  }
});

test('a sound store still records the count it actually measured', () => {
  const ws = stateRoot();
  const store = soundStore();
  try {
    const key = 'a-session-with-a-readable-store';
    withStoreDir(store, () => { assertDoor(ws, key); });
    const rows = readFileSync(deliveredFile(ws), 'utf8')
      .split('\n').filter((l) => l.trim() !== '')
      .map((l) => JSON.parse(l) as { kind: string; key: string; note?: string });
    const missed = rows.find((r) => r.kind === 'missed' && r.key === key);
    assert.ok(missed);
    assert.match(missed!.note ?? '', /1 constant\(s\) would have applied/,
      'non-vacuity: the measured wording is still what a readable store produces');
  } finally {
    removeTree(path.dirname(ws));
    removeTree(store);
  }
});

test('assertDoor still returns the empty sentence over a store it cannot read, and never throws', () => {
  const ws = stateRoot();
  try {
    // The property the hook depends on: a rule-store fault may not fail
    // `PreToolUse`, and may not tell a reader they missed constants that
    // nothing could count.
    const before = process.env[RULES_DIR_ENV];
    process.env[RULES_DIR_ENV] = path.join(ws, 'no-such-store');
    try {
      assert.equal(assertDoor(ws, 'a-session-key'), '');
    } finally {
      if (before === undefined) delete process.env[RULES_DIR_ENV];
      else process.env[RULES_DIR_ENV] = before;
    }
  } finally {
    removeTree(path.dirname(ws));
  }
});
