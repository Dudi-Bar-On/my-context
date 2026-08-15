import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync, rmSync, readFileSync, readdirSync, mkdirSync, writeFileSync, symlinkSync,
  lstatSync, readlinkSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Store } from '../../src/core/store.ts';
import { loadLayer, writeItem, rebuild, retryOnTransientFsError, type LoadError } from '../../src/core/rebuild.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { removeTree } from '../helpers/tmp.ts';

const CONFIG = resolveConfig({});

function tempRoot(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-'));
}

// checksum is the real computed checksum of this item's semantic content
// (see computeItemChecksum) — deliberately correct, not a placeholder, so
// that checksum verification in loadLayer never flags these fixtures as
// tampered. (The digit-only-checksum-survives-as-a-string case is covered
// separately, via parseItem directly, in item.test.ts.)
const ITEM = `---
id: CONST-a
type: constraint
title: A constraint
status: active
severity: hard
always: true
scope:
  - "src/**"
tags: [db]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: null
valid_until: null
checksum: f870bed1ef73aee8
---

# A constraint

Some prose.

## Observations
- [limit] Never exceed 20 #db

## Relations
- supersedes [[CONST-old]]
`;

test('loadLayer reads items with POSIX-relative paths', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const items = loadLayer(root, 'project');
  assert.equal(items.length, 1);
  assert.equal(items[0].filePath, 'items/constraint/CONST-a.md');
  assert.equal(items[0].filePath.includes('\\'), false);
  removeTree(root);
});

test('rebuild is lossless — files to DB to files is byte-identical', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const file = path.join(root, 'items', 'constraint', 'CONST-a.md');
  const canonical = renderItem(parseItem(ITEM, 'items/constraint/CONST-a.md', 'project'));
  writeFileSync(file, canonical);

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root }, CONFIG);
  assert.equal(result.loaded, 1);
  assert.deepEqual(result.errors, []);

  for (const item of store.all()) writeItem(root, item);
  assert.equal(readFileSync(file, 'utf8'), canonical);

  store.close();
  removeTree(root);
});

test('rebuild replaces the layer rather than accumulating', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);

  const store = Store.open(':memory:');
  rebuild(store, { project: root }, CONFIG);
  rmSync(path.join(root, 'items', 'constraint', 'CONST-a.md'));
  rebuild(store, { project: root }, CONFIG);
  assert.equal(store.all().length, 0);

  store.close();
  removeTree(root);
});

test('a malformed item is reported and does not abort the rebuild', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  writeFileSync(path.join(root, 'items', 'constraint', 'broken.md'), 'no frontmatter here');

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root }, CONFIG);
  assert.equal(result.loaded, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].file, /broken\.md$/);

  store.close();
  removeTree(root);
});

test('writeItem writes atomically and creates parent directories', () => {
  const root = tempRoot();
  const item = parseItem(ITEM, 'items/constraint/CONST-a.md', 'project');
  const written = writeItem(root, item);
  assert.equal(readFileSync(written, 'utf8'), renderItem(item));
  const siblingNames = readdirSync(path.dirname(written));
  assert.equal(siblingNames.some((name) => name.includes('.tmp-')), false);
  removeTree(root);
});

test('rebuild is lossless for a raw hand-authored file — normalized on first write, stable thereafter', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const file = path.join(root, 'items', 'constraint', 'CONST-a.md');
  // Write the raw fixture as authored, NOT pre-canonicalized. This proves
  // the round trip stabilizes a hand-authored file onto its canonical form,
  // rather than merely proving the canonical form is a fixed point.
  writeFileSync(file, ITEM);
  const canonical = renderItem(parseItem(ITEM, 'items/constraint/CONST-a.md', 'project'));

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root }, CONFIG);
  assert.equal(result.loaded, 1);
  assert.deepEqual(result.errors, []);

  for (const item of store.all()) writeItem(root, item);
  assert.equal(readFileSync(file, 'utf8'), canonical);

  store.close();
  removeTree(root);
});

test('an item whose upsert throws is recorded as a LoadError and does not prevent others from loading', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  writeFileSync(
    path.join(root, 'items', 'constraint', 'CONST-b.md'),
    // Also blank the checksum: it was computed for CONST-a's content, so
    // carrying it over verbatim onto CONST-b's (id-modified) content would
    // trip the checksum-mismatch LoadError this test isn't about.
    ITEM.replace('id: CONST-a', 'id: CONST-b').replace('checksum: f870bed1ef73aee8', 'checksum: null'),
  );

  const store = Store.open(':memory:');
  const originalUpsert = store.upsert.bind(store);
  // Stub the instance method (not Store itself) so one item's upsert fails
  // deterministically while the store's real behaviour is otherwise unchanged.
  (store as unknown as { upsert: typeof store.upsert }).upsert = ((item) => {
    if (item.id === 'CONST-b') throw new Error('simulated store failure');
    originalUpsert(item);
  }) as typeof store.upsert;

  const result = rebuild(store, { project: root }, CONFIG);
  assert.equal(result.loaded, 1);
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].file, /CONST-b\.md$/);
  assert.equal(store.get('CONST-a') !== null, true);
  assert.equal(store.get('CONST-b'), null);

  store.close();
  removeTree(root);
});

test('two files declaring the same id produce a LoadError naming both paths, first-by-sorted-order wins', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  // Same id in both files' frontmatter; filenames sort deterministically.
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a-1.md'), ITEM);
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a-2.md'), ITEM);

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);

  assert.equal(items.length, 1);
  assert.equal(items[0].filePath, 'items/constraint/CONST-a-1.md');
  assert.equal(errors.length, 1);
  assert.equal(errors[0].file, 'items/constraint/CONST-a-2.md');
  assert.match(errors[0].message, /CONST-a/);
  assert.match(errors[0].message, /CONST-a-1\.md/);
  assert.match(errors[0].message, /CONST-a-2\.md/);

  removeTree(root);
});

test('writeItem writes through a symlinked item file, leaving the link intact', (t) => {
  const root = tempRoot();
  const outside = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const real = path.join(outside, 'real-item.md');
  writeFileSync(real, ITEM);
  const link = path.join(root, 'items', 'constraint', 'CONST-a.md');
  try {
    symlinkSync(real, link);
  } catch (err) {
    if (skipIfEperm(err, () => { removeTree(root); removeTree(outside); }, t)) return;
  }

  const item = parseItem(ITEM, 'items/constraint/CONST-a.md', 'project');
  const modified = { ...item, title: 'A modified constraint' };
  const written = writeItem(root, modified);

  // The link itself is untouched — still a symlink, still pointing at `real`.
  assert.equal(lstatSync(link).isSymbolicLink(), true);
  assert.equal(readlinkSync(link), real);

  // The content landed on the real file the link points at, visible through
  // both the link and the real path.
  const rendered = readFileSync(written, 'utf8');
  assert.match(rendered, /A modified constraint/);
  assert.equal(readFileSync(link, 'utf8'), rendered);
  assert.equal(readFileSync(real, 'utf8'), rendered);

  removeTree(root);
  removeTree(outside);
});

function skipIfEperm(err: unknown, cleanup: () => void, t: { skip: (msg?: string) => void }): boolean {
  if ((err as NodeJS.ErrnoException).code !== 'EPERM') { cleanup(); throw err; }
  cleanup();
  t.skip('symlink creation requires elevated privileges in this environment');
  return true;
}

test('a symlinked item file is loaded, not silently skipped', (t) => {
  const root = tempRoot();
  const outside = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const real = path.join(outside, 'real-item.md');
  writeFileSync(real, ITEM);
  const link = path.join(root, 'items', 'constraint', 'CONST-a.md');
  try {
    symlinkSync(real, link);
  } catch (err) {
    if (skipIfEperm(err, () => { removeTree(root); removeTree(outside); }, t)) return;
  }

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'CONST-a');
  assert.deepEqual(errors, []);

  removeTree(root);
  removeTree(outside);
});

test('a symlinked items subtree is walked, not silently skipped', (t) => {
  const root = tempRoot();
  const outsideDir = tempRoot();
  mkdirSync(path.join(root, 'items'), { recursive: true });
  mkdirSync(path.join(outsideDir, 'constraint'), { recursive: true });
  writeFileSync(path.join(outsideDir, 'constraint', 'CONST-a.md'), ITEM);
  const link = path.join(root, 'items', 'constraint');
  try {
    symlinkSync(outsideDir + path.sep + 'constraint', link, 'junction');
  } catch (err) {
    if (skipIfEperm(err, () => { removeTree(root); removeTree(outsideDir); }, t)) return;
  }

  const items = loadLayer(root, 'project');
  assert.equal(items.length, 1);
  assert.equal(items[0].id, 'CONST-a');

  removeTree(root);
  removeTree(outsideDir);
});

test('a broken symlink produces a LoadError, never a silent skip', (t) => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const missing = path.join(root, 'nowhere.md');
  const link = path.join(root, 'items', 'constraint', 'CONST-broken.md');
  try {
    symlinkSync(missing, link);
  } catch (err) {
    if (skipIfEperm(err, () => removeTree(root), t)) return;
  }

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);
  assert.equal(items.length, 0);
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /symlink/i);

  removeTree(root);
});

test('a symlink pointing at an already-walked ancestor is not walked twice', (t) => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(root, 'items', 'constraint', 'CONST-a.md'), ITEM);
  // items/link -> items: an ordinary-directory ancestor, not a symlink target,
  // so only the visitedRealDirs seeding on every directory (not just on
  // symlinked ones) can catch this.
  const link = path.join(root, 'items', 'link');
  try {
    symlinkSync(path.join(root, 'items'), link, 'junction');
  } catch (err) {
    if (skipIfEperm(err, () => removeTree(root), t)) return;
  }

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);
  assert.equal(items.length, 1, 'CONST-a is loaded exactly once, not once per traversal path');
  assert.deepEqual(errors, [], 'no duplicate-id error is produced');

  removeTree(root);
});

test('an item whose type is absent from config produces a LoadError but is still indexed, not dropped', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'sla'), { recursive: true });
  writeFileSync(
    path.join(root, 'items', 'sla', 'SLA-a.md'),
    ITEM.replace('id: CONST-a', 'id: SLA-a').replace('type: constraint', 'type: sla')
      .replace('checksum: f870bed1ef73aee8', 'checksum: null'),
  );

  const store = Store.open(':memory:');
  const result = rebuild(store, { project: root }, CONFIG);
  assert.equal(result.loaded, 1, 'the item is still indexed despite the unknown type');
  assert.equal(result.errors.length, 1);
  assert.match(result.errors[0].message, /unknown type|not defined in config/i);
  assert.equal(store.get('SLA-a') !== null, true);

  store.close();
  removeTree(root);
});

/**
 * F4. The same test as above, with the one type name that made the check
 * answer the wrong way round. `config.categories['constructor']` is a bare
 * index into a plain object, so it resolves through `Object.prototype` to
 * `Object.prototype.constructor` — truthy — and the "not defined in
 * config.categories" error was never raised. The item was indexed with no
 * integrity signal at all, while `isEligible` (select.ts) still, correctly,
 * refused to select it: silently invisible, the exact outcome this check
 * exists to prevent. `Object.hasOwn` is the fix, and the fifth time this
 * codebase has needed it.
 *
 * `toString` and `hasOwnProperty` are here for the same reason and behave
 * identically; `__proto__` is deliberately NOT — the parsed `item.type` is a
 * plain string either way, but `config.categories['__proto__']` reads the
 * prototype slot rather than a property, which is a different mechanism and
 * would make this fixture assert two things at once.
 */
for (const type of ['constructor', 'toString', 'hasOwnProperty', 'valueOf']) {
  test(`an item typed "${type}" is reported as an unknown type, not swallowed by Object.prototype`, () => {
    const root = tempRoot();
    mkdirSync(path.join(root, 'items', type), { recursive: true });
    writeFileSync(
      path.join(root, 'items', type, 'PROTO-a.md'),
      ITEM.replace('id: CONST-a', 'id: PROTO-a').replace('type: constraint', `type: ${type}`)
        .replace('checksum: f870bed1ef73aee8', 'checksum: null'),
    );

    const store = Store.open(':memory:');
    try {
      const result = rebuild(store, { project: root }, CONFIG);
      assert.equal(result.loaded, 1, 'the item is still indexed — reporting is not dropping');
      assert.equal(
        result.errors.length, 1,
        `type "${type}" produced no integrity error: ${JSON.stringify(result.errors)}`,
      );
      assert.match(result.errors[0].message, /not defined in\s+config\.categories/);
      assert.ok(result.errors[0].message.includes(type), 'the error must name the offending type');
      assert.notEqual(store.get('PROTO-a'), null);
    } finally {
      store.close();
      removeTree(root);
    }
  });
}

test('a checksum mismatch is reported as a LoadError, without making the item unreadable', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  // Same content as ITEM but a tampered checksum.
  writeFileSync(
    path.join(root, 'items', 'constraint', 'CONST-a.md'),
    ITEM.replace('checksum: f870bed1ef73aee8', 'checksum: 1111111111111111'),
  );

  const errors: LoadError[] = [];
  const items = loadLayer(root, 'project', errors);
  assert.equal(items.length, 1, 'the item is reported, not made unreadable');
  assert.equal(errors.length, 1);
  assert.match(errors[0].message, /checksum mismatch/i);

  removeTree(root);
});

test('an item with no checksum recorded is not flagged — nothing to verify against', () => {
  const root = tempRoot();
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  writeFileSync(
    path.join(root, 'items', 'constraint', 'CONST-a.md'),
    ITEM.replace('checksum: f870bed1ef73aee8', 'checksum: null'),
  );

  const errors: LoadError[] = [];
  loadLayer(root, 'project', errors);
  assert.deepEqual(errors, []);

  removeTree(root);
});

test('writeItem computes a real checksum for an item that had none', () => {
  const root = tempRoot();
  const item = parseItem(ITEM, 'items/constraint/CONST-a.md', 'project');
  const blank = { ...item, checksum: '' };
  const written = writeItem(root, blank);
  const onDisk = readFileSync(written, 'utf8');
  assert.doesNotMatch(onDisk, /checksum: ""/);
  assert.match(onDisk, /checksum: [0-9a-f]{16}/);

  // And it round-trips clean through checksum verification.
  const errors: LoadError[] = [];
  loadLayer(root, 'project', errors);
  assert.deepEqual(errors, []);

  removeTree(root);
});

/** Builds an Error carrying an errno-style `code`, the shape every check in
 * `retryOnTransientFsError` (and the real `renameSync`) actually inspects. */
function errnoError(code: string): NodeJS.ErrnoException {
  const err = new Error(code) as NodeJS.ErrnoException;
  err.code = code;
  return err;
}

// A genuine Windows EPERM from a real competing file handle cannot be
// manufactured reliably in a unit test on any platform — the failure
// requires another process (or the OS's own indexer/AV) to hold the
// destination open at the exact instant renameSync runs, which no unit test
// can force. So the retry/backoff/give-up behaviour is exercised directly
// against `retryOnTransientFsError` with a fake, fully-controlled operation
// instead of trying to reproduce the real race with real files.

test('retryOnTransientFsError retries a transient EPERM and succeeds once the operation stops failing', () => {
  let calls = 0;
  const result = retryOnTransientFsError(() => {
    calls++;
    if (calls <= 2) throw errnoError('EPERM');
    return 'ok';
  });
  assert.equal(result, 'ok');
  // Not just "it eventually returned 'ok'" — asserting the call count is
  // what actually distinguishes a helper that retries from one that
  // happened to succeed on a first, unretried call.
  assert.equal(calls, 3);
});

test('retryOnTransientFsError rethrows immediately, without retrying, on an unrelated error code', () => {
  let calls = 0;
  const err = errnoError('ENOENT');
  assert.throws(() => {
    retryOnTransientFsError(() => {
      calls++;
      throw err;
    });
  }, (thrown: unknown) => thrown === err);
  // Exactly one call: retrying a genuine failure (missing directory, real
  // permissions error) would just make it slower, and this is the assertion
  // that would fail if the code check were ever loosened or dropped.
  assert.equal(calls, 1);
});

test('retryOnTransientFsError rethrows the original error, unchanged, once attempts are exhausted', () => {
  let calls = 0;
  const err = errnoError('EBUSY');
  assert.throws(() => {
    retryOnTransientFsError(() => {
      calls++;
      throw err;
    }, 3);
  }, (thrown: unknown) => thrown === err);
  // Exactly the requested attempt count — not fewer (giving up early) and
  // not more (retrying past the caller's own bound).
  assert.equal(calls, 3);
});

// --- Cross-layer id collisions (spec §5.1: "On conflicting id, project wins") ---

/** Writes `ITEM` into `root`, with `id`/`title` substituted, so two layers can
 * be given genuinely different content under the same id. */
function writeLayerItem(root: string, id: string, title: string): void {
  mkdirSync(path.join(root, 'items', 'constraint'), { recursive: true });
  const item = parseItem(ITEM, `items/constraint/${id}.md`, 'project');
  item.id = id;
  item.title = title;
  writeItem(root, item);
}

test('on a conflicting id the project layer wins, not the global one', () => {
  const project = tempRoot();
  const global = tempRoot();
  writeLayerItem(project, 'CONST-dup', 'The project copy');
  writeLayerItem(global, 'CONST-dup', 'The global copy');

  const store = Store.open(':memory:');
  rebuild(store, { project, global }, CONFIG);

  const survivor = store.get('CONST-dup')!;
  assert.equal(survivor.layer, 'project');
  assert.equal(survivor.title, 'The project copy');

  store.close();
  removeTree(project);
  removeTree(global);
});

test('a cross-layer duplicate id is reported, not resolved in silence', () => {
  const project = tempRoot();
  const global = tempRoot();
  writeLayerItem(project, 'CONST-dup', 'The project copy');
  writeLayerItem(global, 'CONST-dup', 'The global copy');

  const store = Store.open(':memory:');
  // `loadLayer`'s own duplicate check is per-layer, so before this a
  // cross-layer collision produced no error at all: two items loaded, one row
  // survived, `errors: []`.
  const { loaded, errors } = rebuild(store, { project, global }, CONFIG);
  assert.equal(loaded, 2);
  assert.equal(errors.length, 1, JSON.stringify(errors));
  assert.match(errors[0].message, /CONST-dup/);
  assert.match(errors[0].message, /global/);
  assert.match(errors[0].message, /project/);

  store.close();
  removeTree(project);
  removeTree(global);
});

test('non-colliding ids across layers produce no cross-layer error', () => {
  const project = tempRoot();
  const global = tempRoot();
  writeLayerItem(project, 'CONST-p', 'Project only');
  writeLayerItem(global, 'CONST-g', 'Global only');

  const store = Store.open(':memory:');
  const { loaded, errors } = rebuild(store, { project, global }, CONFIG);
  assert.equal(loaded, 2);
  assert.deepEqual(errors, []);
  assert.equal(store.get('CONST-p')!.layer, 'project');
  assert.equal(store.get('CONST-g')!.layer, 'global');

  store.close();
  removeTree(project);
  removeTree(global);
});
