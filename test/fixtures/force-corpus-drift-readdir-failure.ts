/**
 * Argv: `<projectRoot> <blindDirSuffix|->`
 *
 * Runs the real `measureCorpusDrift` with `fs.readdirSync` forced to fail with
 * `EACCES` for every directory whose path ends in `<blindDirSuffix>` — or with
 * nothing forced at all when the suffix is `-`, which is the CONTROL: the same
 * corpus, the same sweep, and the answer must be a measurement.
 *
 * Prints one JSON line: the whole `CorpusDrift` answer.
 *
 * **Why a fixture process.** The same finding
 * `test/fixtures/force-readdir-failure.ts` and
 * `test/fixtures/force-stat-failure.ts` already record: `icacls /deny` does not
 * bite for this account, and on win32 a `readdir` of a path that is not there
 * answers `ENOENT` — which IS absence, and which this sweep is right to treat
 * as "not evidence". A file where a directory belongs is not reachable either,
 * because `newestMtime` only pushes an entry whose `isDirectory()` is true. So
 * no arrangement of the real filesystem produces the REFUSAL this branch is
 * about, and the difference between "there is nothing newer under here" and "I
 * could not look under here" would be written and never exercised.
 *
 * In its own process, so no other test sees the patched `fs`.
 */
import fs from 'node:fs';
import { measureCorpusDrift } from '../../src/core/corpus-drift.ts';

const [projectRoot, blind] = process.argv.slice(2);
if (projectRoot === undefined || blind === undefined) {
  process.stderr.write(
    'force-corpus-drift-readdir-failure: needs <projectRoot> <blindDirSuffix|->, got '
    + `${JSON.stringify(process.argv.slice(2))}\n`,
  );
  process.exit(2);
}

if (blind !== '-') {
  const real = fs.readdirSync;
  // `Object.defineProperty`, not `fs.readdirSync = …`: the property is declared
  // read-only on the type, and the point is to replace the exact call the sweep
  // makes through the namespace.
  Object.defineProperty(fs, 'readdirSync', {
    value: ((dir: string, ...rest: unknown[]) => {
      if (String(dir).replace(/\\/gu, '/').endsWith(blind)) {
        const err = new Error(`EACCES: forced, scandir '${dir}'`) as NodeJS.ErrnoException;
        err.code = 'EACCES';
        throw err;
      }
      return (real as (...a: unknown[]) => unknown)(dir, ...rest);
    }) as typeof fs.readdirSync,
    configurable: true,
    writable: true,
  });
}

process.stdout.write(`${JSON.stringify(measureCorpusDrift(projectRoot))}\n`);
