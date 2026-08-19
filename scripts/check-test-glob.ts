#!/usr/bin/env node
/**
 * **The suite must reach every test file, and a green run must mean it did.**
 *
 * `RULE-quote-the-test-glob` records the measurement: unquoted,
 * `node --test test/**\/*.test.ts` runs through `sh` on Linux CI, which
 * expands `**` as `*` without globstar — **2 of 4 test files executed, exit
 * code 0.** A green matrix over half a suite. Single quotes do not help
 * either, because `cmd.exe` does not strip them, so the pattern reaches node
 * with the quotes still attached and matches nothing.
 *
 * That failure is invisible by construction: nothing in the output says "119
 * files were skipped", because from the runner's point of view they were never
 * named. The only way to notice is to compare what ran against what exists,
 * which is what this does.
 *
 * Two checks, and the first is the one that actually prevents the failure:
 *
 * 1. **The glob in `package.json` is double-quoted.** This is the control.
 *    With the quotes, the pattern reaches node intact and node does the
 *    globbing on every platform.
 * 2. **The pattern resolves to every `*.test.ts` under `test/`.** This is the
 *    corroboration, and it catches a different mistake: a pattern that is
 *    quoted correctly but no longer matches the tree, which is what happens
 *    the first time someone adds a directory level.
 *
 * Run by `npm run check:test-glob`, and by both workflows before `npm test`,
 * because a check that runs after the suite tells you the suite you already
 * trusted was wrong.
 */

import { globSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/** Every `*.test.ts` under `test/`, found by walking rather than by globbing. */
function walk(dir: string, out: string[]): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (entry.endsWith('.test.ts')) out.push(full);
  }
  return out;
}

function main(): number {
  const pkg = JSON.parse(readFileSync(path.join(REPO, 'package.json'), 'utf8')) as
    { scripts?: Record<string, string> };
  const script = pkg.scripts?.test;
  if (script === undefined) {
    process.stderr.write('my_context: package.json has no "test" script.\n');
    return 1;
  }

  // 1. The quoting, which is the control.
  const quoted = /"[^"]*\*\*[^"]*"/.test(script);
  if (!quoted) {
    process.stderr.write(
      'my_context: the test glob in package.json is not DOUBLE-quoted.\n' +
      `  scripts.test = ${script}\n` +
      '  Unquoted, `sh` on Linux expands `**` as `*` — measured at 2 of 4 files run, exit 0.\n' +
      '  Single quotes do not work either: cmd.exe does not strip them.\n' +
      '  See RULE-quote-the-test-glob.\n',
    );
    return 1;
  }

  // 2. The count parity, which corroborates it.
  const m = /"([^"]*\*\*[^"]*)"/.exec(script);
  const pattern = m![1]!;
  // `fs.globSync` is what `node --test` uses for a pattern argument, so this
  // resolves it the same way the runner would rather than reimplementing it.
  const matched = globSync(pattern).filter((f) => f.endsWith('.test.ts'));
  const onDisk = walk(path.join(REPO, 'test'), []);

  if (matched.length !== onDisk.length) {
    process.stderr.write(
      `my_context: the test glob reaches ${matched.length} file(s); ` +
      `${onDisk.length} exist under test/.\n` +
      `  pattern: ${pattern}\n` +
      '  A run over the smaller set can still exit 0, which is the whole hazard.\n' +
      '  See RULE-quote-the-test-glob.\n',
    );
    return 1;
  }

  process.stdout.write(
    `test glob is double-quoted and reaches all ${onDisk.length} test file(s).\n`,
  );
  return 0;
}

process.exit(main());
