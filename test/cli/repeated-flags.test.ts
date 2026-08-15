import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A repeated value flag is refused on EVERY command, not only on the one where
 * it was found.
 *
 * `mycontext add --scope` was the reported defect: given three times, it kept
 * the first and reported success. But `flag()` (registry.ts) was the thing
 * that returned the first match and said nothing about the rest, and eleven
 * other call sites read it — `supersede --by`, `supersede --reason`,
 * `query --limit`, `decay --sessions`, `context --file`, `ingest --anchor`,
 * `review --type`, `review promote --severity`, and the four `lesson-accept`
 * edits. Every one of them had the same silent first-occurrence-wins
 * behaviour. The fix is in `flag()` itself, so this file exercises commands
 * that were never edited: if someone re-introduces the old "return the first
 * match" implementation, these go red without any command-specific test
 * having to exist.
 *
 * Each case here is a SINGLE-valued flag, where refusing is the honest answer.
 * The list-valued ones (`--scope`, `--tags`) collect instead, and are pinned
 * where they are used: `test/cli/add-flags.test.ts` and
 * `test/cli/review.test.ts`.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-repeat-'));
  try {
    runCli(['init'], cwd, () => {});
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

const CASES: [string, string[], RegExp][] = [
  ['supersede --by', ['supersede', 'CONST-a', '--by', 'CONST-b', '--by', 'CONST-c', '--yes'],
    /--by was given 2 times/],
  ['query --limit',
    ['query', '--limit', '5', '--limit', '10', 'SELECT id FROM items'],
    /--limit was given 2 times/],
  ['decay --sessions', ['decay', '--sessions', '5', '--sessions', '10'],
    /--sessions was given 2 times/],
  ['review list --type', ['review', 'list', '--type', 'rule', '--type', 'constraint'],
    /--type was given 2 times/],
];

for (const [name, args, expected] of CASES) {
  test(`${name} refuses a repeat instead of keeping the first`, () => {
    withProject((cwd) => {
      const { code, out } = run(args, cwd);
      assert.equal(code, 1, out);
      assert.match(out, expected);
    });
  });
}

test('a single occurrence of each of those flags still works exactly as before', () => {
  // The refusal must be about the REPEAT, not about the flag: a guard that
  // rejected the flag outright would pass every assertion above while
  // breaking every real invocation.
  withProject((cwd) => {
    for (const args of [
      ['query', '--limit', '5', 'SELECT id FROM items'],
      ['decay', '--sessions', '5'],
      ['review', 'list', '--type', 'rule'],
    ]) {
      const { code, out } = run(args, cwd);
      assert.equal(code, 0, `${args.join(' ')}:\n${out}`);
    }
  });
});
