/**
 * The mutation harness's own guard rails, driven as a real process against a
 * real throwaway git repository.
 *
 * Every assertion here is one of the seven escapes this repository has already
 * paid for: a restore that ran over uncommitted work, and a probe that reached
 * `.my_context/`. A unit test over the argument parser would pin neither, so
 * these spawn `scripts/mutate.ts` and read the tree afterwards with `git`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs, trackedChanges } from '../../scripts/mutate.ts';
import { removeTree } from '../helpers/tmp.ts';

const HARNESS = fileURLToPath(new URL('../../scripts/mutate.ts', import.meta.url));

const GUARDED = 'export function guard(n) { if (n > 10) throw new Error("too big"); return n; }\n';

/** Passes when the guard is intact, fails when it is not — the killer. */
const KILLER = `
import assert from 'node:assert/strict';
import { guard } from './src/guard.mjs';
assert.throws(() => guard(11));
`;

/** Passes either way — the control that must be reported as SURVIVED. */
const BLIND = `
import assert from 'node:assert/strict';
import { guard } from './src/guard.mjs';
assert.equal(guard(1), 1);
`;

function git(cwd: string, args: string[]): { code: number; stdout: string } {
  const result = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' });
  return { code: result.status ?? -1, stdout: result.stdout ?? '' };
}

interface Repo {
  cwd: string;
  read(rel: string): string;
  porcelain(): string;
  dispose(): void;
}

function repo(): Repo {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mutate-'));
  git(cwd, ['init', '-q', '-b', 'main']);
  git(cwd, ['config', 'user.email', 'probe@example.invalid']);
  git(cwd, ['config', 'user.name', 'Probe']);
  git(cwd, ['config', 'commit.gpgsign', 'false']);

  mkdirSync(path.join(cwd, 'src'), { recursive: true });
  mkdirSync(path.join(cwd, '.my_context', 'items'), { recursive: true });
  writeFileSync(path.join(cwd, 'src', 'guard.mjs'), GUARDED, 'utf8');
  writeFileSync(path.join(cwd, 'killer.mjs'), KILLER, 'utf8');
  writeFileSync(path.join(cwd, 'blind.mjs'), BLIND, 'utf8');
  writeFileSync(path.join(cwd, '.my_context', 'items', 'RULE-x.md'), '# a corpus item\n', 'utf8');
  git(cwd, ['add', '-A']);
  git(cwd, ['commit', '-qm', 'base']);

  return {
    cwd,
    read: (rel) => readFileSync(path.join(cwd, rel), 'utf8'),
    porcelain: () => git(cwd, ['status', '--porcelain']).stdout,
    dispose: () => removeTree(cwd),
  };
}

function run(cwd: string, args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [HARNESS, ...args], { cwd, encoding: 'utf8' });
  return { code: result.status ?? -1, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

const BREAK = ['--file', 'src/guard.mjs', '--from', 'n > 10', '--to', 'n > 1000'];
const kill = ['--', process.execPath, 'killer.mjs'];
const survive = ['--', process.execPath, 'blind.mjs'];

test('a mutant a test notices is reported KILLED, and the file comes back byte-identical', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, [...BREAK, ...kill]);
    assert.equal(result.code, 0, `expected KILLED (exit 0): ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /KILLED/);
    assert.equal(fx.read('src/guard.mjs'), GUARDED, 'the mutant must not survive the run on disk');
    assert.equal(fx.porcelain(), '', 'the tree must be clean afterwards');
  } finally { fx.dispose(); }
});

test('a mutant nothing notices is reported SURVIVED, and still restored', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, [...BREAK, ...survive]);
    assert.equal(result.code, 1, `expected SURVIVED (exit 1): ${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /SURVIVED/);
    assert.equal(fx.read('src/guard.mjs'), GUARDED);
    assert.equal(fx.porcelain(), '');
  } finally { fx.dispose(); }
});

/**
 * The escape this harness exists for. Three agents lost uncommitted work to a
 * revert that could not tell their fix from the mutant; the fix is to refuse
 * before anything is written, not to revert more carefully.
 */
test('a dirty tree is refused, and nothing is mutated', () => {
  const fx = repo();
  try {
    const inProgress = GUARDED + '// a fix I have not committed yet\n';
    writeFileSync(path.join(fx.cwd, 'src', 'guard.mjs'), inProgress, 'utf8');

    const result = run(fx.cwd, [...BREAK, ...kill]);
    assert.equal(result.code, 2, `expected a refusal: ${result.stdout}${result.stderr}`);
    assert.match(result.stderr, /refusing to mutate/);
    assert.match(result.stderr, /Commit them first/);
    assert.equal(fx.read('src/guard.mjs'), inProgress, 'the uncommitted work must still be there');
  } finally { fx.dispose(); }
});

test('a dirty file elsewhere in the tree is refused too, not just the target', () => {
  const fx = repo();
  try {
    writeFileSync(path.join(fx.cwd, 'blind.mjs'), BLIND + '// edited\n', 'utf8');
    const result = run(fx.cwd, [...BREAK, ...kill]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /blind\.mjs/);
    assert.equal(fx.read('src/guard.mjs'), GUARDED, 'nothing was mutated');
  } finally { fx.dispose(); }
});

/** An untracked file is not at risk from a restore, so it does not block a run. */
test('an untracked file elsewhere does not block a run', () => {
  const fx = repo();
  try {
    writeFileSync(path.join(fx.cwd, 'scratch.txt'), 'notes\n', 'utf8');
    const result = run(fx.cwd, [...BREAK, ...kill]);
    assert.equal(result.code, 0, `${result.stdout}${result.stderr}`);
    assert.equal(fx.read('scratch.txt'), 'notes\n', 'and it is still there afterwards');
  } finally { fx.dispose(); }
});

test('an untracked TARGET is refused — there would be nothing committed to fall back to', () => {
  const fx = repo();
  try {
    writeFileSync(path.join(fx.cwd, 'src', 'new.js'), 'const x = 1;\n', 'utf8');
    const result = run(fx.cwd, ['--file', 'src/new.js', '--from', 'x = 1', '--to', 'x = 2', ...kill]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /git does not track it/);
    assert.equal(fx.read('src/new.js'), 'const x = 1;\n');
  } finally { fx.dispose(); }
});

/** The other half of the escape record: twice a probe reached the real corpus. */
test('a path under .my_context/ is refused whatever the arguments say', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, [
      '--file', '.my_context/items/RULE-x.md', '--from', 'corpus', '--to', 'gone', ...kill,
    ]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /dogfooded corpus/);
    assert.equal(fx.read('.my_context/items/RULE-x.md'), '# a corpus item\n');
  } finally { fx.dispose(); }
});

test('a path outside the repository is refused', () => {
  const fx = repo();
  const outside = mkdtempSync(path.join(tmpdir(), 'myctx-outside-'));
  try {
    writeFileSync(path.join(outside, 'f.txt'), 'hello\n', 'utf8');
    const result = run(fx.cwd, [
      '--file', path.join(outside, 'f.txt'), '--from', 'hello', '--to', 'bye', ...kill,
    ]);
    assert.notEqual(result.code, 0);
    assert.equal(readFileSync(path.join(outside, 'f.txt'), 'utf8'), 'hello\n');
  } finally { fx.dispose(); removeTree(outside); }
});

test('a --from that does not appear refuses instead of running a probe that proves nothing', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, ['--file', 'src/guard.mjs', '--from', 'nowhere at all', '--to', 'x', ...kill]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /was not found/);
    assert.equal(fx.porcelain(), '');
  } finally { fx.dispose(); }
});

test('an ambiguous --from refuses rather than guessing which occurrence was meant', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, ['--file', 'src/guard.mjs', '--from', 'n', '--to', 'm', ...kill]);
    assert.equal(result.code, 2);
    assert.match(result.stderr, /appears \d+ times/);
    assert.equal(fx.read('src/guard.mjs'), GUARDED);
  } finally { fx.dispose(); }
});

test('a command with no mutation, and a mutation with no command, are both refused', () => {
  const fx = repo();
  try {
    assert.match(run(fx.cwd, [...kill]).stderr, /nothing to mutate/);
    assert.match(run(fx.cwd, [...BREAK]).stderr, /no command to run/);
    assert.equal(fx.porcelain(), '');
  } finally { fx.dispose(); }
});

/**
 * A multi-file mutant is restored as a unit. A claim made on several surfaces
 * needs every surface broken at once, and every one of them put back — a
 * partial restore is a mutant left in the tree wearing a passing suite.
 */
test('two files mutated in one run are both restored', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, [
      '--file', 'src/guard.mjs', '--from', 'n > 10', '--to', 'n > 1000',
      '--file', 'blind.mjs', '--from', 'guard(1), 1', '--to', 'guard(1), 1 /* mutated */',
      ...kill,
    ]);
    assert.equal(result.code, 0, `${result.stdout}${result.stderr}`);
    assert.equal(fx.porcelain(), '', 'both files must be back');
  } finally { fx.dispose(); }
});

/**
 * The hard-kill path: no `finally`, no signal handler. What survives is the
 * journal, and the next run must refuse rather than mutate a tree that is
 * already holding a mutant.
 */
test('a journal left by a killed run blocks the next run, and --restore clears it', () => {
  const fx = repo();
  try {
    const gitDir = git(fx.cwd, ['rev-parse', '--absolute-git-dir']).stdout.trim();
    const journal = path.join(gitDir, 'mycontext-mutation.json');
    writeFileSync(path.join(fx.cwd, 'src', 'guard.mjs'), GUARDED.replace('n > 10', 'n > 1000'), 'utf8');
    writeFileSync(journal, JSON.stringify({
      head: git(fx.cwd, ['rev-parse', 'HEAD']).stdout.trim(),
      startedAt: '2026-08-16T00:00:00.000Z',
      pid: 4242,
      command: ['node', 'killer.mjs'],
      files: [{ path: 'src/guard.mjs', original: GUARDED }],
    }), 'utf8');

    const blocked = run(fx.cwd, [...BREAK, ...kill]);
    assert.equal(blocked.code, 2);
    assert.match(blocked.stderr, /left a mutation in flight/);

    const status = run(fx.cwd, ['--status']);
    assert.equal(status.code, 1);
    assert.match(status.stdout, /src\/guard\.mjs/);

    const restored = run(fx.cwd, ['--restore']);
    assert.equal(restored.code, 0, `${restored.stdout}${restored.stderr}`);
    assert.equal(fx.read('src/guard.mjs'), GUARDED);
    assert.equal(existsSync(journal), false, 'a cleared journal must not block the next run');
    assert.equal(run(fx.cwd, [...BREAK, ...kill]).code, 0, 'and the next run works');
  } finally { fx.dispose(); }
});

test('--status says so plainly when nothing is in flight', () => {
  const fx = repo();
  try {
    const result = run(fx.cwd, ['--status']);
    assert.equal(result.code, 0);
    assert.match(result.stdout, /no mutation in flight/);
  } finally { fx.dispose(); }
});

test('trackedChanges ignores untracked lines and nothing else', () => {
  assert.deepEqual(trackedChanges(''), []);
  assert.deepEqual(trackedChanges('?? scratch.txt\n'), []);
  assert.deepEqual(trackedChanges(' M src/a.ts\n?? b.txt\nA  src/c.ts\n'), [' M src/a.ts', 'A  src/c.ts']);
});

test('parseArgs binds --from/--to to the --file that opened the group', () => {
  const parsed = parseArgs([
    '--file', 'a.ts', '--from', 'x', '--to', 'y',
    '--file', 'b.ts', '--from', 'p', '--all',
    '--', 'node', '--test',
  ]);
  assert.deepEqual(parsed.edits, [
    { file: 'a.ts', from: 'x', to: 'y', all: false },
    { file: 'b.ts', from: 'p', to: '', all: true },
  ]);
  assert.deepEqual(parsed.command, ['node', '--test']);
  assert.throws(() => parseArgs(['--from', 'x']), /must follow a --file/);
  assert.throws(() => parseArgs(['--file']), /needs a value/);
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});
