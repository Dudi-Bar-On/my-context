/**
 * `readArtefact` is the first thing in this product that opens bytes a
 * STRANGER wrote, so every test here is about something arriving that the
 * writer would never have produced.
 *
 * Three of them are the ones worth reading twice:
 *
 *  1. **The two rungs are compared to each other, not to a fixture.** A
 *     directory and a ZIP written from one bundle must read back with the
 *     same items, the same manifest and the same history. A fixture would
 *     only prove each reader agrees with whatever was recorded the day it was
 *     written; comparing the rungs proves the FORMAT is one format. The test
 *     also asserts the two lists are non-empty, because `deepEqual` over two
 *     empty arrays is the shape of a test that passes when both readers
 *     return nothing.
 *  2. **The traversal case is a real hostile archive.** The ZIP is written
 *     legally and then its entry name is overwritten, byte for byte, with one
 *     that walks out of the artefact — `writeZip` refuses such a name on the
 *     way out, so a hostile archive cannot be produced any other way, and a
 *     test that skipped the patch would be asserting the writer's rule
 *     against the writer.
 *  3. **The symlink case uses a junction on Windows.** A `'dir'` symlink
 *     needs SeCreateSymbolicLink there and a junction needs nothing, so this
 *     test runs on the platform whose failure mode it is about rather than
 *     skipping itself into permanent greenness.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import { buildBundle, type Bundle, type BundleOptions } from '../../src/pack/bundle.ts';
import {
  HISTORY_NAME, MANIFEST_NAME, PACK_HISTORY_PROTOCOL, type ExportFile,
} from '../../src/pack/layout.ts';
import { buildManifest, renderManifest } from '../../src/pack/manifest.ts';
import { readArtefact, sniffFormat } from '../../src/pack/reader.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import { writeZip } from '../../src/pack/zip.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** A fixed instant, so nothing in an artefact moves between two runs. */
const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);

const PACK_OPTS: BundleOptions = {
  kind: 'pack', name: 'acme security', version: '2026-08 rev 3',
  filters: {}, history: true, now: NOW,
};

/** A scratch directory to write artefacts into, removed by the caller. */
function tempDir(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-read-'));
}

/** Four items across three categories, so an artefact has something in it. */
function corpus(box: Sandbox): void {
  createItem(box.ctx, { type: 'rule', title: 'a first rule', body: 'B' });
  createItem(box.ctx, { type: 'rule', title: 'a second rule', body: 'B' });
  createItem(box.ctx, { type: 'standard', title: 'a standard', body: 'B', tags: ['ops'] });
  createItem(box.ctx, { type: 'lesson', title: 'a lesson', body: 'B' });
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  return assert.fail('expected a refusal, got none');
}

/** The one item path in a bundle, for the tests that damage exactly one file. */
function anItemPath(bundle: Bundle): string {
  const found = bundle.files.find((f) => f.path.startsWith('items/'));
  assert.ok(found !== undefined, 'the fixture bundle carries no items');
  return found.path;
}

/** An artefact directory on disk, and the bundle it was written from. */
function writtenDirectory(box: Sandbox, out: string): Bundle {
  const bundle = buildBundle(box.root, box.ctx.config, PACK_OPTS);
  writeBundleDirectory(bundle, out);
  return bundle;
}

// ---------------------------------------------------------------------------
// The two rungs are one format
// ---------------------------------------------------------------------------

test('a directory and a zip written from the same bundle read back identically', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const bundle = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    const dirOut = path.join(dir, 'as-directory');
    const zipOut = path.join(dir, 'as-archive.zip');
    writeBundleDirectory(bundle, dirOut);
    writeFileSync(zipOut, writeZip(bundle.files));

    const a = readArtefact(dirOut);
    const b = readArtefact(zipOut);

    assert.equal(a.format, 'dir');
    assert.equal(b.format, 'zip');
    assert.equal(a.source, dirOut);
    assert.equal(b.source, zipOut);

    // Non-empty first: two readers that both returned nothing would satisfy
    // every `deepEqual` below without either of them reading anything.
    assert.equal(a.items.length, 4);
    assert.ok(a.history.length > 0, 'the fixture carries no history to compare');

    assert.deepEqual(a.items, b.items);
    assert.deepEqual(a.manifest, b.manifest);
    assert.deepEqual(a.history, b.history);
    assert.deepEqual(a.unknownHistory, b.unknownHistory);
    assert.deepEqual(a.config, b.config);
    assert.deepEqual(a.verification, { missing: [], extra: [], mismatched: [] });
    assert.deepEqual(b.verification, { missing: [], extra: [], mismatched: [] });
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// Manifest verification, which is a refusal and never a warning
// ---------------------------------------------------------------------------

test('a tampered item file fails manifest verification and the read is refused', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const out = path.join(dir, 'artefact');
    const bundle = writtenDirectory(box, out);
    const target = anItemPath(bundle);
    const onDisk = path.join(out, ...target.split('/'));
    // One word changed, the same length: the file is still a legal item and
    // still parses, so nothing but the digest can notice.
    writeFileSync(onDisk, readFileSync(onDisk, 'utf8').replace('\nB\n', '\nX\n'), 'utf8');

    const message = refusalOf(() => readArtefact(out));
    assert.match(message, /^my_context: /);
    assert.match(message, new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    assert.match(message, /not the bytes that were hashed/);
    assert.match(message, /not partially imported/);
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

test('a missing manifest is refused, and the message says which file it looked for', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const out = path.join(dir, 'artefact');
    writtenDirectory(box, out);
    rmSync(path.join(out, MANIFEST_NAME));

    const message = refusalOf(() => readArtefact(out));
    assert.match(message, /^my_context: /);
    assert.match(message, /manifest\.json/);
    // The other files are still there, so "there is nothing here" would be
    // the wrong sentence and this asserts it is not the one being said.
    assert.doesNotMatch(message, /is empty/);
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

test('a file the manifest does not list is reported as extra and refused', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const out = path.join(dir, 'artefact');
    writtenDirectory(box, out);
    const smuggled = 'items/rule/RULE-not-listed.md';
    writeFileSync(path.join(out, ...smuggled.split('/')), '# not in the manifest\n', 'utf8');

    const message = refusalOf(() => readArtefact(out));
    assert.match(message, /^my_context: /);
    assert.match(message, /RULE-not-listed\.md/);
    assert.match(message, /the manifest does not list/);
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// The walk, which is the one walk in this module and therefore the one place
// a traversal could be introduced
// ---------------------------------------------------------------------------

test('a symlink inside the artefact directory is refused by name, never followed', () => {
  const box = sandbox();
  const dir = tempDir();
  const elsewhere = tempDir();
  try {
    corpus(box);
    const out = path.join(dir, 'artefact');
    writtenDirectory(box, out);
    mkdirSync(path.join(elsewhere, 'secrets'), { recursive: true });
    writeFileSync(path.join(elsewhere, 'secrets', 'RULE-private.md'), '# private\n', 'utf8');
    // A junction on Windows, an ordinary symlink elsewhere — the junction is
    // the portable choice there, because a `'dir'` symlink needs
    // SeCreateSymbolicLink and a junction needs nothing.
    symlinkSync(
      path.join(elsewhere, 'secrets'),
      path.join(out, 'items', 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir',
    );

    const message = refusalOf(() => readArtefact(out));
    assert.match(message, /^my_context: /);
    assert.match(message, /items\/linked/);
    assert.match(message, /link/);
    assert.match(message, /never followed/);
    // The proof it was not followed: nothing behind the link is named.
    assert.doesNotMatch(message, /RULE-private/);
  } finally {
    box.dispose();
    removeTree(dir);
    removeTree(elsewhere);
  }
});

test('a path escaping the artefact root is refused before it is opened', () => {
  const dir = tempDir();
  try {
    // Exactly as many bytes as the legal name it replaces, so the archive's
    // own offsets still resolve and the ONLY thing wrong with it is where the
    // entry says it wants to land.
    const legal = 'items/xx/RULE-a.md';
    const escape = '../../../RULE-a.md';
    assert.equal(Buffer.byteLength(legal), Buffer.byteLength(escape));

    const files: ExportFile[] = [
      { path: 'config.json', bytes: Buffer.from('{}\n', 'utf8') },
      { path: legal, bytes: Buffer.from('# an item\n', 'utf8') },
    ];
    const patched = Buffer.from(
      writeZip(files).toString('latin1').replaceAll(legal, escape),
      'latin1',
    );
    const zipOut = path.join(dir, 'hostile.zip');
    writeFileSync(zipOut, patched);

    const message = refusalOf(() => readArtefact(zipOut));
    assert.match(message, /^my_context: /);
    assert.match(message, /walks out of the artefact/);
    assert.match(message, /No entry was decompressed/);
    // Nothing landed where the name pointed.
    assert.throws(() => readFileSync(path.join(dir, 'RULE-a.md')), /ENOENT/);
  } finally {
    removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// The sniff
// ---------------------------------------------------------------------------

test('sniffFormat names what it found rather than guessing', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const out = path.join(dir, 'artefact');
    const bundle = writtenDirectory(box, out);
    const zipOut = path.join(dir, 'artefact.zip');
    writeFileSync(zipOut, writeZip(bundle.files));

    assert.equal(sniffFormat(out), 'dir');
    assert.equal(sniffFormat(zipOut), 'zip');

    const someTextFile = path.join(dir, 'notes.md');
    writeFileSync(someTextFile, '# hello\n\nthis is not an artefact\n', 'utf8');
    assert.throws(() => sniffFormat(someTextFile), /my_context: .*not a mycontext export/);
    // "what it found", literally: the bytes that were there, not a guess at
    // what the file might have been meant to be.
    assert.throws(() => sniffFormat(someTextFile), /23 20 68 65/);
    assert.throws(() => sniffFormat(path.join(dir, 'nowhere')), /my_context: .*nowhere/);
  } finally {
    box.dispose();
    removeTree(dir);
  }
});

// ---------------------------------------------------------------------------
// The history split
// ---------------------------------------------------------------------------

test('a history carrying an unknown op reads back with the record in unknownHistory', () => {
  const box = sandbox();
  const dir = tempDir();
  try {
    corpus(box);
    const bundle = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    const known = {
      protocol: PACK_HISTORY_PROTOCOL,
      at: '2026-08-20T12:00:00.000Z',
      kind: 'mutation',
      op: 'create',
      itemId: 'RULE-a-first-rule',
    };
    // `teleport` is not in `MUTATION_OPS`, which is version skew rather than
    // damage: a newer build's op is kept aside and counted, never dropped.
    const unknown = { ...known, op: 'teleport' };
    const history = Buffer.from(
      `${JSON.stringify(known)}\n${JSON.stringify(unknown)}\n`, 'utf8',
    );

    const files = bundle.files
      .filter((f) => f.path !== MANIFEST_NAME && f.path !== HISTORY_NAME)
      .concat([{ path: HISTORY_NAME, bytes: history }]);
    const manifest = buildManifest(files, {
      kind: 'pack', name: 'acme security', version: '2026-08 rev 3', now: NOW,
    });
    const out = path.join(dir, 'artefact');
    writeBundleDirectory(
      { files: [...files, { path: MANIFEST_NAME, bytes: renderManifest(manifest) }] },
      out,
    );

    const artefact = readArtefact(out);
    assert.equal(artefact.history.length, 1);
    assert.equal(artefact.history[0].op, 'create');
    assert.equal(artefact.unknownHistory.length, 1);
    assert.equal(artefact.unknownHistory[0].row.op, 'teleport');
    // Verbatim, in file order: the row is kept as it arrived, not repaired
    // into something this build recognises.
    assert.deepEqual(artefact.unknownHistory[0].row, unknown);
    // ...and with the line of `history.jsonl` it is on, which is the second of
    // the two rows written above.
    assert.equal(artefact.unknownHistory[0].line, 2);
  } finally {
    box.dispose();
    removeTree(dir);
  }
});
