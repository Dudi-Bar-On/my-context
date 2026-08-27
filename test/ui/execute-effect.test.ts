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
import { cpSync, mkdtempSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
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

test('a scratch that does not resolve to itself is refused rather than run', () => {
  // `findProjectRoot` walks UP from cwd with no environment override, so a
  // scratch nested under a corpus would send the child to the REAL one. The
  // check is made with that same function; here the corpus does not exist at
  // all, so the copy fails and nothing is run.
  assert.throws(
    () => deriveEffect(path.join(tmpdir(), 'myctx-does-not-exist-at-all'),
      path.join(tmpdir(), 'myctx-does-not-exist-at-all'), CLI, ['status']),
    EffectRefusal,
    'a corpus that cannot be copied must refuse, never proceed against whatever cwd resolves to',
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
});
