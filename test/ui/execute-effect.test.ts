/**
 * The dry run that tells a confirm what a boundary command will change.
 *
 * `src/ui/execute-effect.ts`, `plan:execute seq:5b`. Owner ruling 2026-08-27:
 * derive the effect by RUNNING the command against a scratch copy rather than
 * by having each command declare what it writes.
 *
 * ── WHAT IS ASSERTED HERE, AND WHY IT IS SHAPED THIS WAY ────────────────────
 *
 * The module runs a real write command, so two of its properties are not about
 * output at all: what it copies, and where the child can reach. Both are
 * asserted as INVARIANTS rather than by staging the failure.
 *
 * The copy filter is the clearer case. The defect it fixes was reported by the
 * owner from a live confirm — `EDOM, The process cannot access the file because
 * another process has locked a portion of the file`, on `.index.db`, held open
 * by the running UI server. Reproducing that means holding a mandatory
 * Windows lock at the moment of a copy, which a single process cannot schedule
 * and which does not exist on other platforms. A test that tried would pass
 * sometimes, which is worse than none.
 *
 * The property the broken code lacked is exact and needs no timing: the index
 * is never copied. That is violated by the old filter on every platform and
 * every run, and satisfied by the new one always.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  cpSync, mkdtempSync, mkdirSync, readdirSync, readFileSync, symlinkSync, unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  EffectRefusal,
  deriveEffect,
  effectBetween,
  worthCopying,
} from '../../src/ui/execute-effect.ts';
import { removeTree } from '../helpers/tmp.ts';

const CLI = fileURLToPath(new URL('../../src/cli/index.ts', import.meta.url));

const scratches: string[] = [];
after(() => {
  for (const dir of scratches) removeTree(dir);
});

/** A real workspace with one item in it, torn down at the end of the file. */
function project(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-effect-test-'));
  scratches.push(dir);
  execFileSync(process.execPath, [CLI, 'init'], { cwd: dir, stdio: 'ignore' });
  execFileSync(
    process.execPath,
    [CLI, 'add', 'rule', 'a rule to change', '--body', 'a body', '--yes'],
    { cwd: dir, stdio: 'ignore' },
  );
  return dir;
}

/* -------------------------------------------------------------------------- *
 * What is copied, which is less than the corpus holds.
 * -------------------------------------------------------------------------- */

test('the SQLite index is never copied — it is locked, and it is disposable', () => {
  // Reported by the owner 2026-08-27 from a live confirm: cpSync hit EDOM on
  // `.index.db` because the running UI server holds it open, and on Windows
  // that lock is mandatory. Every boundary command became un-runnable for as
  // long as a server was up, which is always.
  assert.equal(worthCopying('/w/.my_context/.index.db'), false);
  // The sidecars go with it. A `-wal` or `-shm` without its database is worse
  // than neither: it describes changes to a file that is not there.
  assert.equal(worthCopying('/w/.my_context/.index.db-wal'), false);
  assert.equal(worthCopying('/w/.my_context/.index.db-shm'), false);

  // Skipping it is not a workaround. INV-markdown-is-the-source-of-truth makes
  // the index disposable — "delete the index, it rebuilds" is the documented
  // recovery — so the markdown alone IS the corpus and the child rebuilds what
  // it needs inside its own copy.
  assert.equal(worthCopying('/w/.my_context/items/rule/RULE-x.md'), true,
    'the markdown is the corpus and must always be copied');
  assert.equal(worthCopying('/w/.my_context/config.json'), true,
    'config decides what a command is allowed to do, so the copy must carry it');
});

test('the audit log is not copied — this run is discarded and it is the largest thing here', () => {
  assert.equal(worthCopying('/w/.my_context/.audit'), false);
  // The REAL execution's rows are written by `execute.ts` against the real log
  // and are untouched by this: skipping the copy loses nothing a reader wants.
  assert.equal(worthCopying('/w/.my_context/state'), true);
});

test('the filter is WIRED to the copy, not merely correct beside it', () => {
  // The two tests above check `worthCopying` in isolation, and on their own they
  // are not enough: delete `filter: worthCopying` from the copy call and both
  // still pass, with the filter correct, unused, and the owner's EDOM back.
  // That is this project's most expensive recurring shape — a check that
  // measures what it was pointed at and is silent about what it missed — so the
  // wiring is asserted through the copy seam.
  let seen: ((source: string) => boolean) | null = null;
  const dir = project();
  deriveEffect(
    path.join(dir, '.my_context'),
    dir,
    CLI,
    ['status'],
    () => {},                                   // no child: the copy is the subject
    (from, to, options) => { seen = options.filter; cpSync(from, to, options); },
  );

  assert.notEqual(seen, null, 'deriveEffect did not copy at all');
  const filter = seen as unknown as (source: string) => boolean;
  assert.equal(filter('/w/.my_context/.index.db'), false,
    'the copy ran without a filter that excludes the locked index, which is the defect');
  assert.equal(filter('/w/.my_context/items/rule/R.md'), true,
    'and the filter it was given must still carry the markdown, or the copy is not a corpus');
});

/* -------------------------------------------------------------------------- *
 * The safety property, and the refusal that replaces a guess.
 * -------------------------------------------------------------------------- */

test('a corpus that cannot be copied is refused rather than run', () => {
  // **This was named for the pre-spawn resolution guard, and its own comment
  // admitted it measured the copy instead.** Review 2026-08-28 established the
  // guard could not fail at all: with a non-empty override `findProjectRoot`
  // returns `path.resolve(override)` unconditionally, so it compared a value to
  // itself. The guard is gone; this keeps only the claim it was actually making,
  // under a name that says so.
  assert.throws(
    () => deriveEffect(path.join(tmpdir(), 'myctx-does-not-exist-at-all'),
      path.join(tmpdir(), 'myctx-does-not-exist-at-all'), CLI, ['status']),
    EffectRefusal,
    'a corpus that cannot be copied must refuse, never proceed against whatever cwd resolves to',
  );
});

/**
 * **The Critical of 2026-08-28.**
 *
 * `cpSync` preserves symlinks by default. `rebuild.ts` records that item files
 * may be symlinks, and `writeItem` `realpathSync`-resolves before renaming, so
 * it writes THROUGH one. The scratch therefore held a link pointing back into
 * the real corpus, and pressing Execute — the click that only OPENS the dialog —
 * rewrote the real item before the reader saw anything. The confirm then drew a
 * normal-looking diff, because it read back through the same link, and Cancel
 * left the change in place. No audit row: the dry run's `.audit` is the
 * scratch's, and is deleted with it.
 *
 * Reproduced exactly on this machine before the fix.
 */
test('a symlinked item does not leak the write out of the scratch', (t) => {
  const dir = project();
  const corpus = path.join(dir, '.my_context');
  const real = path.join(corpus, 'items', 'rule', 'RULE-a-rule-to-change.md');
  const store = path.join(dir, 'outside-the-corpus.md');
  writeFileSync(store, readFileSync(real, 'utf8'));
  unlinkSync(real);
  try {
    symlinkSync(store, real, 'file');
  } catch {
    // Windows without developer mode refuses symlink creation. SKIPPED and said
    // so: a test that quietly passed here would report this guard as covered on
    // a machine that never exercised it.
    t.skip('this platform refuses symlink creation, so the case cannot be built');
    return;
  }

  const before = readFileSync(store, 'utf8');
  const effect = deriveEffect(corpus, dir, CLI, ['pin', 'RULE-a-rule-to-change', '--yes']);

  assert.equal(effect.length, 1, 'the effect is still derived — the copy absorbed the write');
  assert.equal(readFileSync(store, 'utf8'), before,
    'the dry run wrote THROUGH the symlink into the real corpus. Not a missing feature: the '
    + 'confirm dialog mutating what it was opened to describe, before anyone read it.');
});

test('a symlink surviving the copy is refused — the guard, not the fix', (t) => {
  const dir = project();
  const corpus = path.join(dir, '.my_context');
  const real = path.join(corpus, 'items', 'rule', 'RULE-a-rule-to-change.md');
  const store = path.join(dir, 'outside-2.md');
  writeFileSync(store, readFileSync(real, 'utf8'));
  unlinkSync(real);
  try {
    symlinkSync(store, real, 'file');
  } catch {
    t.skip('this platform refuses symlink creation, so the case cannot be built');
    return;
  }

  // Copy WITHOUT `dereference`, which is exactly the defect that shipped, so
  // the guard is proven rather than masked by the fix standing in front of it.
  assert.throws(
    () => deriveEffect(corpus, dir, CLI, ['pin', 'RULE-a-rule-to-change', '--yes'], undefined,
      (from, to, options) => { cpSync(from, to, { recursive: true, filter: options.filter }); }),
    (error) => {
      assert.ok(error instanceof EffectRefusal);
      assert.match(error.message, /symlink/i,
        'the refusal must name what it found, or the next reader cannot act on it');
      return true;
    },
  );
});


test('a command that cannot complete is a refusal carrying the CLI’s own sentence', () => {
  const dir = project();
  // `refresh` on an item that holds no snapshot exits non-zero and explains
  // itself. That explanation must reach the reader: the first version of this
  // module used `stdio: 'ignore'` and produced "the command did not complete"
  // with nothing after it, identical whether the argument was wrong or the
  // corpus was broken.
  assert.throws(
    () => deriveEffect(path.join(dir, '.my_context'), dir, CLI,
      ['refresh', 'RULE-a-rule-to-change', '--yes']),
    (error: unknown) => {
      assert.ok(error instanceof EffectRefusal);
      assert.match(error.message, /snapshot|source file/i,
        'the refusal must carry the command’s own words, not a sentence composed here');
      return true;
    },
  );
});

test('the real corpus is untouched — the command runs against the copy and nowhere else', () => {
  const dir = project();
  const corpus = path.join(dir, '.my_context');
  const before = readdirSync(path.join(corpus, 'items', 'rule')).sort();

  const effect = deriveEffect(corpus, dir, CLI,
    ['add', 'note', 'a note the dry run creates', '--body', 'b', '--yes']);

  assert.equal(effect.length, 1, 'the command creates exactly one item');
  assert.equal(effect[0]?.kind, 'created');
  assert.deepEqual(readdirSync(path.join(corpus, 'items', 'rule')).sort(), before,
    'the dry run must leave the real corpus byte-for-byte as it found it');
  assert.equal(
    readdirSync(path.join(corpus, 'items')).includes('note'), false,
    'and it must not have created the note here — that is the whole point of the copy',
  );
});

test('a repository-relative path means what the user typed, not what the copy contains', () => {
  // The owner reported this twice from live confirms on 2026-08-27:
  //
  //   add --file my-context/README.md
  //     -> "could not be read ... resolved relative to the directory you ran
  //         the command in"
  //   a reference capture
  //     -> "is outside this repository (a temp directory, named as the repo)"
  //
  // Both were FALSE refusals naming a temp directory as the repository. The
  // cause was that one `cwd` set both the corpus and the path root, so moving
  // `cwd` into the copy moved the user's paths with it. The child now runs at
  // the REAL repository with CORPUS_DIR_ENV pointing at the copy.
  const dir = project();
  writeFileSync(path.join(dir, 'a-file-in-the-repo.md'), '# captured\n\nbody\n');

  const effect = deriveEffect(path.join(dir, '.my_context'), dir, CLI,
    ['add', 'note', 'from a repo file', '--file', 'a-file-in-the-repo.md', '--yes']);

  assert.equal(effect.length, 1, 'the capture must succeed: the file is right where the user said');
  assert.equal(effect[0]?.kind, 'created');
  assert.ok(effect[0]?.fields.some((f) => f.field === 'sourceFile'),
    'and it records where it came from, which is the whole point of a --file capture');
});

test('a STORED repository-relative path resolves too — refresh, the second site', () => {
  // Found by the Task 7 implementer on 2026-08-28, driving Doctor's own repair
  // from a browser. It is the SECOND site of the defect fixed at the first
  // (`src/cli/index.ts`, `add --file`) two hours earlier and missed here.
  //
  // The two are not the same path in the code and they are the same bug:
  // `add --file` bounds a path the USER typed, `refresh` bounds one the ITEM
  // stored. Both are repository-relative, both were resolved against
  // `path.dirname(root)`, and both therefore looked inside the scratch copy the
  // moment the corpus was redirected. Fixing one and not the other is what a
  // grep for a single spelling gets you.
  const dir = project();
  const corpus = path.join(dir, '.my_context');
  writeFileSync(path.join(dir, 'snapshotted.md'), '# one' + "\\n" + "\\n" + 'first' + "\\n");
  execFileSync(process.execPath,
    [CLI, 'add', 'note', 'a snapshot', '--file', 'snapshotted.md', '--yes'],
    { cwd: dir, stdio: 'ignore' });

  // Move the file on, so refresh has something to report.
  writeFileSync(path.join(dir, 'snapshotted.md'), '# one' + "\\n" + "\\n" + 'second' + "\\n");

  const effect = deriveEffect(corpus, dir, CLI, ['refresh', 'NOTE-a-snapshot', '--yes']);

  assert.equal(effect.length, 1,
    'refresh must FIND the stored source file. Resolved against the copy it cannot, and the '
    + 'confirm then refuses a command that would have worked — a false refusal, which is the '
    + 'one thing §3.2 must never produce.');
  assert.equal(effect[0]?.kind, 'changed');
  assert.ok(effect[0]?.fields.some((f) => f.field === 'body'),
    'and it reports the new body, which is the whole point of a refresh');
});

test('the corpus still cannot be reached, even though cwd is now the real repository', () => {
  // The safety property survives the fix, and this is where it could have been
  // lost: `cwd` at the real repository would resolve to the REAL corpus by the
  // upward walk. Only CORPUS_DIR_ENV sends the child to the copy, so the check
  // that it does is the check that this module is still safe.
  const dir = project();
  const corpus = path.join(dir, '.my_context');
  const rules = () => readdirSync(path.join(corpus, 'items', 'rule')).sort();
  const before = rules();

  deriveEffect(corpus, dir, CLI, ['add', 'rule', 'written only to the copy', '--body', 'b', '--yes']);

  assert.deepEqual(rules(), before,
    'the child ran at the real repository root and must STILL have written only to the copy');
});

/* -------------------------------------------------------------------------- *
 * The diff, including the state that must never be an empty row list.
 * -------------------------------------------------------------------------- */

const ITEM = (id: string, always: string): string =>
  `---\nid: ${id}\ntype: rule\ntitle: t\nstatus: active\nseverity: soft\n`
  + `always: ${always}\nscope: []\ntags: []\norigin: human\nsource_file: null\n`
  + `source_anchor: null\nsource_checksum: null\nvalid_from: 2026-01-01\n`
  + `valid_until: null\nchecksum: abc\n---\n\n# t\n\nbody\n`;

test('a changed field is named with both of its values', () => {
  const effect = effectBetween(
    new Map([['rule/R.md', ITEM('RULE-r', 'false')]]),
    new Map([['rule/R.md', ITEM('RULE-r', 'true')]]),
  );
  assert.equal(effect.length, 1);
  assert.equal(effect[0]?.kind, 'changed');
  assert.deepEqual(effect[0]?.fields, [{ field: 'always', before: ['false'], after: ['true'] }]);
});

test('a created item reports before: null, which is how the confirm empties that column', () => {
  const effect = effectBetween(new Map(), new Map([['rule/R.md', ITEM('RULE-r', 'true')]]));
  assert.equal(effect[0]?.kind, 'created');
  for (const field of effect[0]?.fields ?? []) {
    assert.equal(field.before, null,
      'null is the SERVER saying the item did not exist. The browser used to infer this from a '
      + 'failed read of its own, which conflated "I could not fetch it" with "there is nothing '
      + 'there" — different facts, and only the second may empty the column.');
  }
});

test('a file that changed with no shown field still reports a row, never an empty list', () => {
  // The one outcome the task names as unacceptable: "an empty diff beside a
  // command that changes something is the worst outcome available here."
  // `checksum` is deliberately not shown, so a checksum-only rewrite is exactly
  // this case.
  const before = ITEM('RULE-r', 'true');
  const effect = effectBetween(
    new Map([['rule/R.md', before]]),
    new Map([['rule/R.md', before.replace('checksum: abc', 'checksum: def')]]),
  );
  assert.equal(effect.length, 1, 'the file changed, so it must be reported');
  assert.equal(effect[0]?.fields.length, 1,
    'and with a row saying so, rather than an item carrying no rows at all');
  assert.equal(effect[0]?.fields[0]?.field, 'file');
});

test('an unchanged corpus yields an empty effect, and that means "changed nothing"', () => {
  const same = new Map([['rule/R.md', ITEM('RULE-r', 'true')]]);
  assert.deepEqual(effectBetween(same, new Map(same)), [],
    'empty means the command ran and changed no item. "Could not tell" is an EffectRefusal, '
    + 'and the two must never be spelled the same way.');
});

test('a directory that is not a corpus is refused, not treated as an empty one', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-not-a-corpus-'));
  scratches.push(dir);
  mkdirSync(path.join(dir, 'items'), { recursive: true });
  writeFileSync(path.join(dir, 'items', 'stray.md'), 'not an item at all\n');
  assert.throws(() => deriveEffect(dir, path.dirname(dir), CLI, ['status']), EffectRefusal);

  // Review 2026-08-28 established the case above passed because `status` exits
  // non-zero on an unparseable file, not because anything guarded the shape.
  // This is the guard that DOES: a copy holding no item files is refused, so an
  // empty effect can never mean "the copy did not happen" — which the confirm
  // would render as "This changes nothing".
  const empty = mkdtempSync(path.join(tmpdir(), 'myctx-empty-corpus-'));
  scratches.push(empty);
  mkdirSync(path.join(empty, 'items'), { recursive: true });
  assert.throws(
    () => deriveEffect(empty, path.dirname(empty), CLI, ['status']),
    (error) => {
      assert.ok(error instanceof EffectRefusal);
      assert.match(error.message, /no item files/i);
      return true;
    },
  );
});
