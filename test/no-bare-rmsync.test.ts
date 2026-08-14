import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Structural guard for the temp-cleanup flake, in the shape this ledger says
 * these fixes have to take: not "fix the call sites the flake happened to
 * land on", but make there be ONE place and fail if a call site stops using
 * it.
 *
 * The defect: 403 test call sites ended with a bare
 * `rmSync(dir, { recursive: true, force: true })`. `force: true` suppresses
 * "does not exist" and nothing else — `maxRetries` defaults to 0 — so on
 * Windows any still-open handle inside the tree (SQLite's `-wal`/`-shm`
 * released asynchronously after `close()`, a spawned child's cwd, Defender)
 * threw `EPERM` from a cleanup line and failed whichever test was unlucky.
 * Measured: 1 failure in 5 full-suite runs, on a test that touches neither
 * SQLite nor child processes. A red suite makes every mutation reading
 * worthless, so this is a hole in the suite's whole purpose, not cosmetic.
 *
 * `test/helpers/tmp.ts`'s `removeTree` is the one owner. This test is what
 * stops the 404th call site from being written by hand.
 */

const TEST_ROOT = fileURLToPath(new URL('.', import.meta.url));
/** The helper itself is the one legitimate caller. */
const OWNER = path.join('helpers', 'tmp.ts');

function testFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) testFiles(p, out);
    else if (p.endsWith('.ts')) out.push(p);
  }
  return out;
}

test('no test file removes a tree with a bare rmSync — removeTree is the one owner', () => {
  const offenders: string[] = [];
  for (const file of testFiles(TEST_ROOT)) {
    if (file.endsWith(OWNER)) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      // Comment lines are skipped, or this file's own explanation of the
      // defect would be its first offender. Crude but exact for this repo:
      // no offending call has ever shared a line with a trailing comment.
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/rmSync\([^)]*recursive:\s*true/.test(line)) {
        offenders.push(`${path.relative(TEST_ROOT, file)}:${i + 1}: ${line.trim()}`);
      }
    });
  }
  assert.deepEqual(
    offenders, [],
    'these lines remove a directory tree without the retry budget Windows needs — import ' +
    '`removeTree` from `test/helpers/tmp.ts` instead:\n' + offenders.join('\n'),
  );
});

test('removeTree actually asks for retries, which is the whole point of it existing', () => {
  // Without this the guard above is satisfied by a helper that forwards the
  // same bare options — one indirection, same flake.
  const source = readFileSync(path.join(TEST_ROOT, OWNER), 'utf8');
  assert.match(source, /maxRetries:\s*\d+/);
  assert.match(source, /retryDelay:\s*\d+/);
});
