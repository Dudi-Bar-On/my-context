import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

/**
 * `mycontext list` swallowed any option it did not recognise. `detailLevel`
 * and `wantsJson` refuse a malformed VALUE (`--full=maybe`), and `positionals`
 * drops every `--token` so one cannot be mistaken for the category filter —
 * but nothing anywhere refused an unrecognised NAME. So `list --ful` listed
 * the entire corpus at the default detail and exited 0.
 *
 * That is worse than an error for the specific reason this project keeps
 * re-finding: the output is plausible. A user who typed `--ful` wanting the
 * full table gets the short table, with no signal, and reads it as the answer.
 * Found while fixing the identical defect in `add`, and reported there as
 * still live here.
 */
function sandbox<T>(fn: (cwd: string) => T): T {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-list-flags-'));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function withCorpus<T>(fn: (cwd: string, lines: () => string[], run: (...a: string[]) => number) => T): T {
  return sandbox((cwd) => {
    let out: string[] = [];
    const run = (...args: string[]): number => {
      out = [];
      return runCli(args, cwd, (s) => out.push(s));
    };
    assert.equal(run('init'), 0);
    assert.equal(run('add', 'constraint', 'Pool capped at twenty', '--yes'), 0);
    return fn(cwd, () => out, run);
  });
}

test('list refuses an unrecognised option instead of listing everything', () => {
  withCorpus((_cwd, lines, run) => {
    const code = run('list', '--ful');
    assert.equal(code, 1, '`list --ful` must not exit 0');
    const text = lines().join('\n');
    assert.match(text, /unknown option "--ful"/);
    // The refusal must teach the accepted set, not merely refuse.
    assert.match(text, /--full/);
    assert.match(text, /--json/);
    // And it must not have printed the corpus anyway.
    assert.doesNotMatch(text, /Pool capped at twenty/);
  });
});

test('list still accepts every flag it advertises, and the category filter', () => {
  withCorpus((_cwd, lines, run) => {
    for (const flag of ['--full', '--short', '--summary', '--json']) {
      assert.equal(run('list', flag), 0, `${flag} must still be accepted`);
    }
    // The positional filter still works, and still works AFTER a flag —
    // the reason `positionals` is used here in the first place.
    assert.equal(run('list', '--json', 'constraint'), 0);
    assert.match(lines().join('\n'), /Pool capped at twenty/);

    assert.equal(run('list', 'constraint'), 0);
    assert.match(lines().join('\n'), /Pool capped at twenty/);

    // An unknown CATEGORY is not an unknown flag: it filters to nothing and
    // exits 0, which is a legitimate empty answer rather than a refusal.
    assert.equal(run('list', 'nosuchcategory'), 0);
    assert.doesNotMatch(lines().join('\n'), /Pool capped at twenty/);
  });
});

test('a malformed value on a known flag is still refused by detailLevel', () => {
  withCorpus((_cwd, lines, run) => {
    assert.equal(run('list', '--full=maybe'), 1);
    assert.doesNotMatch(lines().join('\n'), /unknown option/,
      'a bad value must report the value problem, not be misreported as an unknown flag');
  });
});
