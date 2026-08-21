/**
 * `writeBundleDirectory` decides where a stranger's path lands on a real
 * filesystem, so every test below is either "bytes went somewhere nobody
 * chose" or "bytes that should have gone did not".
 *
 * **Read against the guards, the plan's own five tests leave five holes**, and
 * they are recorded here rather than fixed silently:
 *
 *  1. **`history.jsonl` present-and-empty is not tested at all.** The byte
 *     layout and `bundle.ts` both state the distinction as normative — absent
 *     means "history was withheld", zero bytes means "history travelled and
 *     there was none" — and a writer with `if (bytes.length > 0)` around its
 *     write passes all five of the plan's tests. Two tests below, one over a
 *     real corpus and one over a hand-built bundle, because it is the one rule
 *     handed to this task that nothing upstream can enforce for it.
 *  2. **"nothing else appears in it" cannot be checked over a file listing.**
 *     A stray EMPTY directory is invisible to one. The walk below returns
 *     files and directories, and both lists are asserted whole — the same
 *     lesson `bundle.test.ts` records about asserting a set of first segments
 *     instead of the set.
 *  3. **The determinism test the plan specifies is nearly vacuous.** Writing
 *     the same in-memory `Buffer`s into two directories is byte-identical
 *     unless the writer is nondeterministic in a way no other test could miss;
 *     the determinism of the FORMAT is `buildBundle`'s and was settled in Task
 *     5. The property with content here is that the writer ADDS NOTHING, so
 *     both trees are compared against the bundle's own bytes as well as
 *     against each other, and a separate test sends bytes a string round trip
 *     would corrupt — CR, LF, a NUL and a high byte — through it.
 *  4. **A destination that exists and is not a directory is unspecified.**
 *     `--out ../packs/acme.zip` with `--format dir` is the likeliest real
 *     typo, and without a guard it surfaces as `ENOTDIR` thrown out of
 *     `readdirSync`, which names a system call rather than a mistake.
 *  5. **"must not exist" has two meanings and the plan names one.** A link
 *     whose target is gone is `undefined` to `statSync` exactly as an absent
 *     path is, and then `mkdirSync` reports `ENOENT` about a name sitting in
 *     the directory listing. Measured on this platform rather than assumed —
 *     the first draft of this module said `EEXIST` and was wrong.
 *
 * **The set-level refusal is proved rather than assumed.** The pair
 * `items/rule/RULE-a.md` + `items/RULE/RULE-b.md` is asserted to pass
 * `refuseArtefactPath` ONE AT A TIME, and then asserted to be refused by the
 * writer. That is a proof by construction that the plural is load-bearing —
 * no per-path check of any kind can reach it — and unlike `bundle.test.ts`'s
 * version it needs no case-sensitive filesystem, because the fixture is a
 * bundle in memory rather than two directories on disk. It therefore runs, and
 * kills, on NTFS.
 *
 * **Refusals are asserted by the sentence only this guard can write**, never
 * by "it throws": `buildBundle` refuses the same path sets, so a test that
 * asserted a throw would stay green with this module's own check deleted.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createItem } from '../../src/core/mutate.ts';
import { buildBundle, type Bundle, type BundleOptions } from '../../src/pack/bundle.ts';
import { writeBundleDirectory } from '../../src/pack/dir-writer.ts';
import {
  comparePaths, refuseArtefactPath, type ExportFile,
} from '../../src/pack/layout.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** A fixed instant, so nothing in an artefact moves between two runs. */
const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);

const EXPORT_OPTS: BundleOptions = {
  kind: 'export', name: null, version: null, filters: {}, history: true, now: NOW,
};

/** Two categories, so `items/<type>/` is a tree rather than one directory. */
function corpus(box: Sandbox): void {
  createItem(box.ctx, { type: 'rule', title: 'never log a token', body: 'B' });
  createItem(box.ctx, { type: 'rule', title: 'quote the glob', body: 'B' });
  createItem(box.ctx, { type: 'standard', title: 'commit messages', body: 'B' });
}

/**
 * A scratch directory, removed once the file's tests are done.
 *
 * `test.after` rather than a `process.on('exit')` handler: `tmp.ts` registers
 * its own exit listener when it is imported, and an exit listener registered
 * here would run AFTER it — so a directory this one failed to remove would be
 * appended to the leak report a moment too late to be printed.
 */
const scratch: string[] = [];
function scratchDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-dirw-'));
  scratch.push(dir);
  return dir;
}
test.after(() => {
  for (const dir of scratch) removeTree(dir);
});

/** A destination path that does not exist, inside a directory that does. */
function unusedOut(): string {
  return path.join(scratchDir(), 'out');
}

interface Tree {
  /** POSIX-relative path -> the bytes on disk, every file in the tree. */
  files: Map<string, Buffer>;
  /** POSIX-relative path of every directory in the tree, sorted. */
  dirs: string[];
}

/** Everything under `root`, files and directories both. */
function tree(root: string): Tree {
  const files = new Map<string, Buffer>();
  const dirs: string[] = [];
  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true })
      .toSorted((a, b) => comparePaths(a.name, b.name));
    for (const entry of entries) {
      const rel = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        dirs.push(rel);
        walk(full, rel);
      } else {
        files.set(rel, readFileSync(full));
      }
    }
  };
  walk(root, '');
  return { files, dirs: dirs.toSorted(comparePaths) };
}

/** The directories a path list requires, and no others. */
function impliedDirs(paths: readonly string[]): string[] {
  const seen = new Set<string>();
  for (const p of paths) {
    const segments = p.split('/');
    for (let i = 1; i < segments.length; i += 1) seen.add(segments.slice(0, i).join('/'));
  }
  return [...seen].toSorted(comparePaths);
}

/** Assert that the tree at `root` is exactly the bundle, byte for byte. */
function assertIsBundle(root: string, bundle: { files: readonly ExportFile[] }): void {
  const paths = bundle.files.map((f) => f.path);
  const found = tree(root);
  assert.deepEqual([...found.files.keys()].toSorted(comparePaths), paths.toSorted(comparePaths));
  assert.deepEqual(found.dirs, impliedDirs(paths));
  for (const file of bundle.files) {
    assert.deepEqual(found.files.get(file.path), file.bytes, `bytes differ for ${file.path}`);
  }
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('expected a refusal, got none');
}

const bytes = (s: string): Buffer => Buffer.from(s, 'utf8');
const file = (p: string, body: string): ExportFile => ({ path: p, bytes: bytes(body) });

/**
 * A bundle that is only a file list. `writeBundleDirectory` reads `files` and
 * nothing else, which is what its parameter type says, so these fixtures carry
 * nothing else — a hand-built `manifest` and `report` would be inert props
 * suggesting the writer consults them.
 */
function loose(...files: ExportFile[]): { files: ExportFile[] } {
  return { files };
}

/** A real bundle over a real corpus, disposed by the caller. */
function built(box: Sandbox, options: Partial<BundleOptions> = {}): Bundle {
  return buildBundle(box.root, box.ctx.config, { ...EXPORT_OPTS, ...options });
}

// ---------------------------------------------------------------------------
// The shape on disk
// ---------------------------------------------------------------------------

test('the directory is written in bundle shape and nothing else appears in it', () => {
  const box = sandbox();
  try {
    corpus(box);
    const bundle = built(box);
    const out = unusedOut();

    writeBundleDirectory(bundle, out);

    assertIsBundle(out, bundle);
    // Named explicitly as well as covered by the whole-tree assertion above,
    // because these four are the format and a change to them is a change to
    // what a receiver can `cp -r`.
    for (const root of ['manifest.json', 'history.jsonl', 'config.json']) {
      assert.ok(existsSync(path.join(out, root)), `${root} is missing`);
    }
    assert.ok(statSync(path.join(out, 'items', 'rule')).isDirectory());
    assert.ok(statSync(path.join(out, 'items', 'standard')).isDirectory());
  } finally {
    box.dispose();
  }
});

test('the returned paths are absolute, in bundle order, and each names the file it claims', () => {
  const box = sandbox();
  try {
    corpus(box);
    const bundle = built(box);
    const out = unusedOut();

    const written = writeBundleDirectory(bundle, out);

    // `path.join`, not string concatenation: Win32 opens `D:\out/items/x.md`
    // quite happily, so a writer that concatenated would produce a correct
    // TREE and a return value with two spellings of the separator in it.
    assert.deepEqual(
      written,
      bundle.files.map((f) => path.join(path.resolve(out), ...f.path.split('/'))),
    );
    for (const p of written) {
      assert.ok(path.isAbsolute(p), `${p} is not absolute`);
      assert.ok(statSync(p).isFile(), `${p} is not a file`);
    }
  } finally {
    box.dispose();
  }
});

test('a relative destination is resolved, so the returned paths are absolute either way', () => {
  const out = path.join(scratchDir(), 'out');
  const relative = path.relative(process.cwd(), out);
  const bundle = loose(file('config.json', '{}\n'));

  const written = writeBundleDirectory(bundle, relative);

  assert.deepEqual(written, [path.join(out, 'config.json')]);
  assert.equal(readFileSync(path.join(out, 'config.json'), 'utf8'), '{}\n');
});

test('the destination\'s missing parents are created', () => {
  const out = path.join(scratchDir(), 'a', 'b', 'packs');
  const bundle = loose(file('config.json', '{}\n'), file('items/rule/RULE-a.md', 'body'));

  writeBundleDirectory(bundle, out);

  assertIsBundle(out, bundle);
});

test('a bundle with no files still creates the destination — "wrote nothing" is not "wrote nowhere"', () => {
  const out = unusedOut();

  const written = writeBundleDirectory(loose(), out);

  assert.deepEqual(written, []);
  // Without this the caller reports "wrote 0 files to <out>" and names a
  // directory that is not there, and `readArtefact(out)` fails with ENOENT
  // rather than with the sentence about a missing manifest.
  assert.ok(statSync(out).isDirectory());
  assert.deepEqual(readdirSync(out), []);
});

// ---------------------------------------------------------------------------
// The bytes, unaltered
// ---------------------------------------------------------------------------

test('writing twice into two directories produces byte-identical trees for one bundle', () => {
  const box = sandbox();
  try {
    corpus(box);
    const bundle = built(box);
    const first = unusedOut();
    const second = unusedOut();

    writeBundleDirectory(bundle, first);
    writeBundleDirectory(bundle, second);

    const a = tree(first);
    const b = tree(second);
    assert.deepEqual([...a.files.keys()], [...b.files.keys()]);
    assert.deepEqual(a.dirs, b.dirs);
    for (const [p, buf] of a.files) assert.deepEqual(b.files.get(p), buf);
    // And both against the bundle, which is the half with content: two trees
    // that agree with each other and not with the bundle would be a writer
    // that transforms deterministically, which is exactly the failure a
    // self-comparison cannot see.
    assertIsBundle(first, bundle);
    assertIsBundle(second, bundle);
  } finally {
    box.dispose();
  }
});

test('bytes are copied verbatim — no newline translation, no BOM, no truncation at a NUL', () => {
  const out = unusedOut();
  // Every byte a string round trip mangles: a lone CR, a CRLF, a NUL (written
  // as a number so this source file holds no NUL of its own), a high byte that
  // is not valid UTF-8 on its own, and no trailing newline.
  const awkward = Buffer.from([0x61, 0x0d, 0x0a, 0x62, 0x0d, 0x63, 0x00, 0xff, 0x64]);
  const bundle = loose(
    { path: 'config.json', bytes: awkward },
    { path: 'history.jsonl', bytes: Buffer.from('\u{1F600}\n', 'utf8') },
  );

  writeBundleDirectory(bundle, out);

  assert.deepEqual(readFileSync(path.join(out, 'config.json')), awkward);
  assert.deepEqual(readFileSync(path.join(out, 'history.jsonl')), Buffer.from('\u{1F600}\n', 'utf8'));
});

// ---------------------------------------------------------------------------
// history.jsonl: present-and-empty is not absent
// ---------------------------------------------------------------------------

test('a zero-byte history.jsonl is written rather than skipped', () => {
  const out = unusedOut();
  const bundle = loose(
    { path: 'history.jsonl', bytes: Buffer.alloc(0) },
    file('config.json', '{}\n'),
  );

  writeBundleDirectory(bundle, out);

  const target = path.join(out, 'history.jsonl');
  assert.ok(existsSync(target), 'an empty history.jsonl was not created');
  assert.equal(statSync(target).size, 0);
});

test('history: true with nothing to say and history: false are different trees on disk', () => {
  const box = sandbox();
  try {
    corpus(box);
    // A tag no item carries selects nothing, so the id set is empty and no
    // mutation record joins to it — `history: true` with nothing to say.
    const filters = { tag: 'no-item-carries-this' };
    const carried = built(box, { filters, history: true });
    const withheld = built(box, { filters, history: false });
    const a = unusedOut();
    const b = unusedOut();

    writeBundleDirectory(carried, a);
    writeBundleDirectory(withheld, b);

    assert.equal(statSync(path.join(a, 'history.jsonl')).size, 0,
      'history travelled and there was none — the file is present and empty');
    assert.equal(existsSync(path.join(b, 'history.jsonl')), false,
      'history was withheld — the file is absent');
  } finally {
    box.dispose();
  }
});

// ---------------------------------------------------------------------------
// The destination
// ---------------------------------------------------------------------------

test('an existing non-empty directory is refused, and nothing is written', () => {
  const out = path.join(scratchDir(), 'out');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'keep.md'), 'mine\n');
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /already holds 1 entry \("keep\.md"\)/);
  assert.match(message, /which of these files did I just write/);
  assert.match(message, /Nothing was written\./);
  // The existing content is untouched, and it is the only thing there.
  assert.deepEqual(readdirSync(out), ['keep.md']);
  assert.equal(readFileSync(path.join(out, 'keep.md'), 'utf8'), 'mine\n');
});

test('a destination holding more entries than the refusal names says how many it did not name', () => {
  const out = path.join(scratchDir(), 'out');
  mkdirSync(out, { recursive: true });
  for (const n of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) writeFileSync(path.join(out, n), 'x');
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  // The count is the whole point of the clause: five names are enough to
  // recognise the directory, and a sentence that stopped at five without
  // saying so would understate what is in the way.
  assert.match(message, /already holds 7 entries \("a", "b", "c", "d", "e", and 2 more\)/);
});

test('a destination holding only a dot-prefixed entry is still non-empty', () => {
  const out = path.join(scratchDir(), 'out');
  mkdirSync(path.join(out, '.git'), { recursive: true });
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  // A rule that skipped dot-prefixed entries would let an artefact travel
  // with a `.git` inside it, which `cp -r` copies and the reader reports as
  // `extra` on the far side.
  assert.match(message, /already holds 1 entry \("\.git"\)/);
  assert.deepEqual(readdirSync(out), ['.git']);
});

test('an existing empty directory is accepted', () => {
  const out = path.join(scratchDir(), 'out');
  mkdirSync(out, { recursive: true });
  const bundle = loose(file('config.json', '{}\n'), file('items/rule/RULE-a.md', 'body'));

  writeBundleDirectory(bundle, out);

  assertIsBundle(out, bundle);
});

test('a destination that exists as a file is refused as a file, not as an unreadable directory', () => {
  const dir = scratchDir();
  const out = path.join(dir, 'acme.zip');
  writeFileSync(out, 'not a directory\n');
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /already exists and is not a directory/);
  // `--out acme.zip --format dir` is the typo this catches, and the errno
  // `readdirSync` would have thrown names a system call rather than a mistake.
  assert.doesNotMatch(message, /ENOTDIR/);
  assert.equal(readFileSync(out, 'utf8'), 'not a directory\n');
});

test('a destination that is a link with no target is named as one, not reported as absent', () => {
  const dir = scratchDir();
  const out = path.join(dir, 'packs');
  // A junction on Windows, an ordinary symlink elsewhere. The junction is the
  // portable choice there: a `'dir'` symlink needs SeCreateSymbolicLink, and a
  // junction needs nothing — which is also why Node reports a plain moved
  // directory as a symbolic link on that platform.
  symlinkSync(path.join(dir, 'nowhere'), out, process.platform === 'win32' ? 'junction' : 'dir');
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  // Measured, not assumed: `statSync` follows the link and reports nothing
  // there, so without this branch `mkdirSync` says "no such file or directory"
  // about a name that is plainly in the listing.
  assert.equal(statSync(out, { throwIfNoEntry: false }), undefined);
  assert.deepEqual(readdirSync(dir), ['packs']);
  assert.match(message, /is a link whose target does not exist/);
  assert.doesNotMatch(message, /ENOENT/);
});

test('an empty destination path is refused by name rather than resolved to the working directory', () => {
  const bundle = loose(file('config.json', '{}\n'));

  const message = refusalOf(() => writeBundleDirectory(bundle, ''));

  assert.match(message, /names no destination/);
  assert.match(message, /current working directory/);
});

// ---------------------------------------------------------------------------
// The path set — refused before the filesystem is touched
// ---------------------------------------------------------------------------

test('a bundle carrying an illegal path is refused before any file is created', () => {
  const out = unusedOut();
  // A legal corpus file: `loadLayer` walks `items/` recursively, so an item
  // parked under a year directory really does arrive with this `filePath`.
  const bundle = loose(
    file('config.json', '{}\n'),
    file('items/rule/2026/RULE-x.md', 'body'),
  );

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /this artefact cannot be written as a directory/);
  assert.match(message, /items\/rule\/2026\/RULE-x\.md/);
  assert.match(message, /the destination was not created, read or opened/);
  // The strongest available reading of "nothing was written": the destination
  // does not exist, so the refusal happened before the filesystem was
  // consulted at all rather than part-way through a loop.
  assert.equal(existsSync(out), false);
});

test('a traversing path is refused, and the directory above the destination is untouched', () => {
  const dir = scratchDir();
  const out = path.join(dir, 'out');
  const bundle = loose(file('config.json', '{}\n'), file('../escaped.md', 'body'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /walks out of the artefact/);
  assert.equal(existsSync(out), false);
  assert.deepEqual(readdirSync(dir), []);
});

test('a case collision no per-path check can see is refused here, on any filesystem', () => {
  const out = unusedOut();
  const colliding = ['items/rule/RULE-a.md', 'items/RULE/RULE-b.md'];
  // The proof that the PLURAL is doing the work: each path is legal on its
  // own, so no per-path check of any kind can reach this pair. The fixture is
  // a bundle in memory rather than two directories on disk, which is why this
  // runs on NTFS — where the equivalent corpus fixture cannot exist, because
  // `items/rule/` and `items/RULE/` are one directory there.
  for (const p of colliding) assert.equal(refuseArtefactPath(p), null);

  const bundle = loose(file('config.json', '{}\n'), ...colliding.map((p) => file(p, 'body')));
  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /differ only by case/);
  assert.match(message, /items\/rule/);
  assert.match(message, /items\/RULE/);
  assert.equal(existsSync(out), false);
});

test('one path listed twice is refused — a tree would silently hold one fewer file', () => {
  const out = unusedOut();
  const bundle = loose(
    file('items/rule/RULE-a.md', 'first'),
    file('items/rule/RULE-a.md', 'second'),
  );

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  assert.match(message, /is listed twice/);
  assert.equal(existsSync(out), false);
});

test('the path set is refused before the destination, so a bad bundle never names a good one', () => {
  const out = path.join(scratchDir(), 'out');
  mkdirSync(out, { recursive: true });
  writeFileSync(path.join(out, 'keep.md'), 'mine\n');
  const bundle = loose(file('items/rule/2026/RULE-x.md', 'body'));

  const message = refusalOf(() => writeBundleDirectory(bundle, out));

  // Both rules are broken. The one reported is the bundle's, because it is
  // true wherever the artefact is written and the author has to fix it either
  // way; reporting the destination first would send them to rename a
  // directory and hit the real problem on the next attempt.
  assert.match(message, /this artefact cannot be written as a directory/);
  assert.doesNotMatch(message, /already holds/);
  assert.deepEqual(readdirSync(out), ['keep.md']);
});
