// @basis TASK-there-is-no-version-flag-and-the-argued-alternative-refuses
/**
 * `mycontext --version` / `-v` — `hooks/35`, task 3.1 (`B6`).
 *
 * The item this rests on measured that there was no way to ask the tool which
 * version it was running, and that the argued substitute — `status --json` —
 * REFUSES outside a workspace ("no workspace here"). `--version` is the fix:
 * it has to answer before `resolveWorkspace` runs, because the first second
 * after an install is exactly the moment there is no workspace yet (D55).
 *
 * **Why this spawns a real process rather than calling `runCli` in-process.**
 * `runCli`/`dispatchCli` is the right seam for almost every other CLI test,
 * but this flag's whole point is what happens BEFORE any workspace exists —
 * including a `cwd` this process itself never `chdir`s into — and it has to
 * be provable from outside a workspace exactly as a fresh install would be
 * run: `node <bin>`. `test/cli/experimental-warning.test.ts` already answered
 * the adjacent question ("what does invoking the shebang's own flags change
 * about behaviour?") the same way, so the flag-parsing here is copied from it
 * rather than re-derived, for the same reason that file gives: the shebang is
 * the one line that actually ships, and retyping its flags would drift from
 * it silently the day it changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { VERSION } from '../../src/core/version.ts';
import { CLI_ENTRY } from '../helpers/spawn-cli.ts';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(import.meta.dirname, '..', '..');

/**
 * The shebang's own flags, PARSED rather than retyped — see
 * `experimental-warning.test.ts` for why a second spelling of this flag would
 * itself be the defect this project keeps finding.
 */
function shebangFlags(): string[] {
  const shebang = readFileSync(path.join(REPO, 'src', 'cli', 'index.ts'), 'utf8').split('\n')[0];
  const flags = shebang.replace(/^#!\s*\/usr\/bin\/env\s+-S\s+node\s*/, '').trim().split(/\s+/).filter(Boolean);
  assert.ok(flags.length >= 1, `the shebang carries no node flags to reuse: ${shebang}`);
  return flags;
}

interface Run { status: number | null; stdout: string; stderr: string }

/** `mycontext <argv>` launched the way the shebang launches it, in `cwd`. */
function run(argv: string[], cwd: string): Run {
  const r = spawnSync(process.execPath, [...shebangFlags(), CLI_ENTRY, ...argv], {
    cwd, encoding: 'utf8',
  });
  return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
}

/** A directory that has never seen `mycontext init` — no `.my_context` at all. */
function noWorkspace(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-version-'));
}

test('--version prints VERSION and exits 0 outside any workspace', () => {
  const cwd = noWorkspace();
  try {
    const r = run(['--version'], cwd);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(r.stdout, VERSION + '\n');
  } finally {
    removeTree(cwd);
  }
});

test('--version prints VERSION and exits 0 inside a real workspace (this repository)', () => {
  const r = run(['--version'], REPO);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout, VERSION + '\n');
});

test('-v is the same flag as --version, outside a workspace', () => {
  const cwd = noWorkspace();
  try {
    const r = run(['-v'], cwd);
    assert.equal(r.status, 0, `stderr: ${r.stderr}`);
    assert.equal(r.stdout, VERSION + '\n');
  } finally {
    removeTree(cwd);
  }
});

test('-v is the same flag as --version, inside this repository', () => {
  const r = run(['-v'], REPO);
  assert.equal(r.status, 0, `stderr: ${r.stderr}`);
  assert.equal(r.stdout, VERSION + '\n');
});

/**
 * `--version` is a COMMAND, not a prefix: it does not eat whatever follows
 * it. Answering `VERSION` for `--version foo` would let a typo like
 * `mycontext --version status` silently print a version instead of running
 * `status`. Exercised from outside a workspace too, because the refusal path
 * (unregistered "command" name, ordinary "unknown command" dispatch) is the
 * same one every other bad command line takes, workspace or none.
 */
test('--version with a trailing argument is refused with the usage banner, not swallowed as a prefix', () => {
  const cwd = noWorkspace();
  try {
    const r = run(['--version', 'status'], cwd);
    assert.equal(r.status, 1);
    assert.match(r.stdout, /unknown command "--version"/);
    assert.match(r.stdout, /usage: mycontext <command> \[args\]/);
    assert.doesNotMatch(r.stdout, new RegExp(VERSION.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    removeTree(cwd);
  }
});

test('-v with a trailing argument is refused the same way', () => {
  const r = run(['-v', 'status'], REPO);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /unknown command "-v"/);
  assert.match(r.stdout, /usage: mycontext <command> \[args\]/);
});
