// @basis TASK-an-unreadable-items-subdirectory-removes-a-whole-corpus, INV-nothing-is-dropped-silently, INV-hooks-fail-open
//
// **REPRODUCED BEFORE IT WAS REPAIRED.** The item was filed `inferred`: the
// branch had been read and an unreadable directory had never been created. It
// was created — `icacls /deny (RX)` on `items/rule` of a three-item corpus, in
// a fresh process, with `readdirSync` proving the denial had landed — and the
// load returned ONE item instead of three with `errors.length === 0`. So the
// premise held and this is a repair, not a false-premise close.
//
// WHAT IS ASSERTED, and it is three propositions rather than one:
//
//   1. **Disclosed.** A directory the walk cannot enter produces a `LoadError`
//      naming that directory. It produced none, while a broken SYMLINK in the
//      same loop produced one — which is what made it a defect rather than an
//      oversight: the docstring already said "never skipped in silence".
//   2. **Still open.** The load does not throw and does not stop. Everything
//      outside the unreadable subtree is still loaded. This is
//      `KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses`
//      applied again — keep failing open, but disclose — and it is asserted
//      because a repair that turned this into a throw would satisfy (1) and
//      break `INV-hooks-fail-open`.
//   3. **`ENOENT` stays silent.** `loadLayer` walks `.drafts/` on every
//      workspace, and today no workspace has one. A disclosure that fires on
//      the clean path of the whole product is a disclosure nobody reads.
//
// ON THE MECHANISM USED HERE. Denying read on a nested directory is an ACL
// (Windows) or a `chmod` (POSIX) and neither is available in every environment
// this suite runs in — so that case PROVES THE DENIAL LANDED with a
// `readdirSync` probe first and skips, named, when it did not. It is never
// green over an unexercised branch. The portable case below it makes the top
// of the walk unreadable by putting a FILE where `items/` goes, which reaches
// the identical `catch` with no privilege at all, so the branch is covered
// even where the denial is refused.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, mkdtempSync, readdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { loadLayer, type LoadError } from '../../src/core/rebuild.ts';
import { removeTree } from '../helpers/tmp.ts';

function fixture(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'myctx-unwalkable-'));
  mkdirSync(path.join(root, 'items', 'rule'), { recursive: true });
  mkdirSync(path.join(root, 'items', 'note'), { recursive: true });
  write(root, 'rule', 'RULE-a');
  write(root, 'rule', 'RULE-b');
  write(root, 'note', 'NOTE-c');
  return root;
}

function write(root: string, type: string, id: string): void {
  writeFileSync(path.join(root, 'items', type, `${id}.md`),
    `---\nid: ${id}\ntype: ${type === 'rule' ? 'rule' : 'note'}\ntitle: ${id}\n`
    + `status: active\nseverity: soft\nalways: false\nsummary: a fixture\nscope: []\ntags: []\n`
    + `origin: human\nvalid_from: 2026-01-01\n---\n\n# ${id}\n\nbody\n`, 'utf8');
}

/** Deny read on `dir`, and answer whether the denial actually took effect. */
function denyRead(dir: string): boolean {
  try {
    if (process.platform === 'win32') {
      const user = os.userInfo().username;
      execFileSync('icacls', [dir, '/deny', `${user}:(RX)`], { stdio: 'pipe' });
      execFileSync('icacls', [dir, '/deny', 'Everyone:(RX)'], { stdio: 'pipe' });
    } else {
      chmodSync(dir, 0o000);
    }
  } catch { return false; }
  // PROVE THE REMOVAL LANDED. A denial that was applied and does not bite —
  // an elevated token, a sandbox that intercepts the filesystem, a root test
  // runner — would otherwise let every assertion below pass over an
  // unexercised branch, which is the exact shape this item is about.
  try { readdirSync(dir); return false; } catch { return true; }
}

function undeny(dir: string): void {
  try {
    if (process.platform === 'win32') {
      const user = os.userInfo().username;
      execFileSync('icacls', [dir, '/remove:d', user, 'Everyone'], { stdio: 'pipe' });
    } else {
      chmodSync(dir, 0o755);
    }
  } catch { /* the tree is a throwaway; removeTree carries the rest */ }
}

test('an unreadable items subdirectory is disclosed, and the rest of the corpus still loads', (t) => {
  const root = fixture();
  const denied = path.join(root, 'items', 'rule');
  try {
    const clean: LoadError[] = [];
    assert.equal(loadLayer(root, 'project', clean).length, 3, 'the fixture loads three before anything is denied');
    assert.equal(clean.length, 0, 'and reports nothing, so a later error cannot be background noise');

    if (!denyRead(denied)) {
      t.skip('read cannot be denied on a directory in this environment (elevated token or sandboxed fs)');
      return;
    }

    const errors: LoadError[] = [];
    const items = loadLayer(root, 'project', errors);

    assert.equal(errors.length, 1, 'the layer that vanished is reported exactly once');
    assert.equal(errors[0]?.file, 'items/rule', 'and the DIRECTORY is named, not some file inside it');
    assert.match(
      String(errors[0]?.message), /directory could not be read/,
      'the message says what kind of thing failed — "could not be read" over a path a reader '
      + 'will look for as a file is a worse answer than none',
    );
    assert.match(
      String(errors[0]?.message), /MISSING from this load/,
      'and says the consequence: a whole subtree is gone, which is not what one bad file means',
    );

    assert.deepEqual(
      items.map((i) => i.id), ['NOTE-c'],
      'FAILING OPEN: the readable half of the corpus is still loaded and nothing threw',
    );
  } finally {
    undeny(denied);
    removeTree(root);
  }
});

test('an items directory that cannot be read AT ALL is disclosed rather than read as an empty corpus', () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'myctx-unwalkable-'));
  try {
    // A FILE where `items/` belongs: `realpathSync` succeeds and `readdirSync`
    // raises ENOTDIR, which is the same `catch` the denial above reaches and
    // needs no privilege, so this branch is covered in every environment.
    writeFileSync(path.join(root, 'items'), 'not a directory\n', 'utf8');
    const errors: LoadError[] = [];
    const items = loadLayer(root, 'project', errors);
    assert.equal(items.length, 0);
    assert.equal(errors.length, 1, 'an empty corpus and an unreadable one must not answer identically');
    assert.equal(errors[0]?.file, 'items');
    assert.match(String(errors[0]?.message), /directory could not be read/);
  } finally {
    removeTree(root);
  }
});

test('a workspace with no .drafts/ reports nothing — absence is not a failure to read', () => {
  const root = fixture();
  try {
    assert.equal(
      readdirSync(root).includes('.drafts'), false,
      'the premise of this test: loadLayer walks .drafts/ unconditionally and it is not there',
    );
    const errors: LoadError[] = [];
    assert.equal(loadLayer(root, 'project', errors).length, 3);
    assert.deepEqual(
      errors, [],
      'ENOENT is carved out deliberately: every workspace today lacks .drafts/, and a load error '
      + 'on the clean path of the whole product is one nobody would read by the second week',
    );
  } finally {
    removeTree(root);
  }
});

test('a directory whose path cannot even be RESOLVED is disclosed too, not only one that cannot be listed', (t) => {
  // `walk` has TWO ways to give up before it lists anything — `realpathSync`
  // and `readdirSync` — and each used to `return out` in silence. The tests
  // above reach only the second: a denied or non-directory path still
  // RESOLVES. A removal proof said so, in as many words: reverting the
  // `realpathSync` disclosure alone left every other assertion in this file
  // green. So the first one is covered here, by a symlink cycle, which is the
  // one non-ENOENT resolution failure that can be built without privilege
  // beyond making a link at all.
  const root = mkdtempSync(path.join(os.tmpdir(), 'myctx-unwalkable-'));
  try {
    try {
      symlinkSync(path.join(root, 'b'), path.join(root, 'a'), 'dir');
      symlinkSync(path.join(root, 'a'), path.join(root, 'b'), 'dir');
      symlinkSync(path.join(root, 'a'), path.join(root, 'items'), 'dir');
    } catch {
      t.skip('symlink creation requires elevated privileges in this environment');
      return;
    }
    // PROVE THE FIXTURE BITES before believing anything the assertions say.
    let looped = false;
    try { readdirSync(path.join(root, 'items')); } catch { looped = true; }
    if (!looped) { t.skip('this filesystem resolves the cycle rather than refusing it'); return; }

    const errors: LoadError[] = [];
    const items = loadLayer(root, 'project', errors);
    assert.equal(items.length, 0);
    assert.equal(errors.length, 1, 'an items/ that cannot be resolved is not an empty corpus');
    assert.equal(errors[0]?.file, 'items');
    assert.match(String(errors[0]?.message), /directory could not be read/);
    assert.match(
      String(errors[0]?.message), /ELOOP|ENOTDIR|EPERM|EACCES/,
      'the errno reaches the reader — "could not be read" alone names no repair',
    );
  } finally {
    removeTree(root);
  }
});
