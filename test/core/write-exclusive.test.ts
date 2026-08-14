/**
 * The deterministic half of the create-race fix. `create-concurrency.test.ts`
 * exercises it with real concurrent processes, but a concurrency test is a
 * probabilistic detector — a green run means the race did not happen to lose
 * anything, not that it cannot. These tests assert the actual guarantee that
 * makes the concurrent case safe, without any timing at all: an exclusive
 * write REFUSES an existing target instead of overwriting it, and says so
 * with a code the caller can branch on.
 *
 * Both constructions are covered: the `linkSync` one, and the
 * `openSync(target, 'wx')` fallback a filesystem without hard links falls
 * back to. The fallback used to be reachable only on such a filesystem,
 * which CI (NTFS, ext4) cannot provide — the same problem
 * `test/fixtures/force-linksync-failure.ts` solves for the ingest lock, and
 * solved the same way: `fs.linkSync` is monkeypatched, which works because
 * `rebuild.ts` calls it as `fs.linkSync` (a property read at call time)
 * rather than through a named import bound once at module load.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isItemExistsError, writeItem } from '../../src/core/rebuild.ts';
import { parseItem } from '../../src/core/item.ts';
import type { Item } from '../../src/core/types.ts';

function root(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-excl-'));
  mkdirSync(path.join(dir, 'items', 'lesson'), { recursive: true });
  return dir;
}

function item(id: string, body: string): Item {
  return {
    id, type: 'lesson', title: 'A title', status: 'active', severity: 'soft', always: false,
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: '2026-01-01', validUntil: null, checksum: '',
    extra: {}, body, observations: [], relations: [],
    layer: 'project', filePath: `items/lesson/${id}.md`,
  };
}

function strayTempFiles(dir: string): string[] {
  return readdirSync(path.join(dir, 'items', 'lesson')).filter((n) => n.includes('.tmp-'));
}

test('an exclusive write creates the file, complete, with no temp file left behind', () => {
  const dir = root();
  try {
    const written = writeItem(dir, item('A', 'the body'), { exclusive: true });
    const raw = readFileSync(written, 'utf8');
    const parsed = parseItem(raw, 'items/lesson/A.md', 'project');
    assert.equal(parsed.body, 'the body');
    assert.notEqual(parsed.checksum, '', 'the checksum must be stamped, not left empty');
    assert.deepEqual(strayTempFiles(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an exclusive write refuses an existing target and does not touch its content', () => {
  const dir = root();
  try {
    writeItem(dir, item('A', 'the first body'), { exclusive: true });
    const before = readFileSync(path.join(dir, 'items', 'lesson', 'A.md'), 'utf8');

    let caught: unknown;
    try {
      writeItem(dir, item('A', 'the second body'), { exclusive: true });
    } catch (err) {
      caught = err;
    }
    assert.ok(caught, 'the second exclusive write must not succeed');
    assert.ok(isItemExistsError(caught), `expected an item-exists error, got ${String(caught)}`);

    assert.equal(readFileSync(path.join(dir, 'items', 'lesson', 'A.md'), 'utf8'), before);
    assert.deepEqual(strayTempFiles(dir), [], 'a refused write must not leave a temp file behind');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a NON-exclusive write still overwrites — update/supersede/link depend on it', () => {
  const dir = root();
  try {
    writeItem(dir, item('A', 'the first body'), { exclusive: true });
    writeItem(dir, item('A', 'the second body'));
    const parsed = parseItem(readFileSync(path.join(dir, 'items', 'lesson', 'A.md'), 'utf8'), 'x', 'project');
    assert.equal(parsed.body, 'the second body');
    assert.deepEqual(strayTempFiles(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('an exclusive write refuses a target that exists but was not written by us', () => {
  // The guard is on the FILE, not on anything this process remembers writing
  // — that is the whole point: the racer that loses did not write it.
  const dir = root();
  try {
    writeFileSync(path.join(dir, 'items', 'lesson', 'A.md'), 'not even an item\n', 'utf8');
    assert.throws(
      () => writeItem(dir, item('A', 'body'), { exclusive: true }),
      (err: unknown) => isItemExistsError(err),
    );
    assert.equal(readFileSync(path.join(dir, 'items', 'lesson', 'A.md'), 'utf8'), 'not even an item\n');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('on a filesystem with no hard links, the fallback still creates and still refuses', () => {
  // `hardLinksSupported` in rebuild.ts is a process-wide latch, so this test
  // permanently switches the rest of THIS process to the fallback. That is
  // fine — it runs in its own file, and the assertions below are exactly the
  // ones the linkSync path made above, so both constructions are held to the
  // same contract. `linkSync` is restored anyway so the failure is not
  // mistaken for a real one if this file ever grows more tests.
  const dir = root();
  const realLinkSync = fs.linkSync;
  fs.linkSync = () => {
    const err = new Error('EPERM: operation not permitted, link') as NodeJS.ErrnoException;
    err.code = 'EPERM';
    throw err;
  };
  try {
    const written = writeItem(dir, item('B', 'fallback body'), { exclusive: true });
    assert.equal(parseItem(readFileSync(written, 'utf8'), 'x', 'project').body, 'fallback body');
    assert.deepEqual(strayTempFiles(dir), []);

    assert.throws(
      () => writeItem(dir, item('B', 'another body'), { exclusive: true }),
      (err: unknown) => isItemExistsError(err),
      'the fallback construction must be exclusive too, or the latch silently disables the guard',
    );
    assert.equal(parseItem(readFileSync(written, 'utf8'), 'x', 'project').body, 'fallback body');
  } finally {
    fs.linkSync = realLinkSync;
    rmSync(dir, { recursive: true, force: true });
  }
});
