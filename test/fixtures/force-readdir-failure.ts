/**
 * Argv: `<cwd> <cliEntry> <blindDirSuffix|-> <argv...>`
 *
 * Derives the effect of a command through the real `deriveEffect`, with
 * `fs.readdirSync` forced to fail with `EACCES` for the first directory whose
 * path ends in `<blindDirSuffix>` — or with nothing forced at all when the
 * suffix is `-`, which is the CONTROL: the same corpus, the same command, and
 * the refusal must not appear.
 *
 * Prints one JSON line: `{ refused: <message> }` or `{ effect: <count> }`.
 *
 * **Why a fixture process.** `icacls /deny` does not bite for this account, a
 * directory in place of a file makes `statSync` succeed, and a Windows
 * `readdir` of a path that is not there answers `ENOENT` — which IS absence.
 * So no arrangement of the real filesystem produces a non-`ENOENT` `readdir`
 * failure here, and the branch that tells "there is nothing under this
 * directory" from "I could not walk it" would otherwise be unprovable. Same
 * device, same reason, as `test/fixtures/force-linksync-failure.ts`, and in
 * its own process so no other test sees the patched `fs`.
 *
 * The suffix is matched rather than an absolute path because the directory
 * being blinded lives inside a scratch copy `deriveEffect` makes itself, under
 * a name no caller can know in advance.
 */
import fs from 'node:fs';
import { EffectRefusal, deriveEffect } from '../../src/ui/execute-effect.ts';
import { DIR_NAME } from '../../src/core/workspace.ts';
import path from 'node:path';

const [cwd, cliEntry, blind, ...argv] = process.argv.slice(2);

if (blind !== '-') {
  const real = fs.readdirSync;
  Object.defineProperty(fs, 'readdirSync', {
    value: ((dir: string, ...rest: unknown[]) => {
      if (String(dir).replace(/\\/gu, '/').endsWith(blind!)) {
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

try {
  const effect = deriveEffect(path.join(cwd!, DIR_NAME), cwd!, cliEntry!, argv);
  process.stdout.write(`${JSON.stringify({ effect: effect.length })}\n`);
} catch (err) {
  process.stdout.write(`${JSON.stringify({
    refused: err instanceof Error ? err.message : String(err),
    isEffectRefusal: err instanceof EffectRefusal,
  })}\n`);
}
