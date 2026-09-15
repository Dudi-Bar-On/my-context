/**
 * Argv: `<file> <code>`
 *
 * Monkeypatches `node:fs`'s `statSync` to throw `<code>` for `<file>` and only
 * for it, then prints what `healTornTail` and `appendJsonlLine` answer, as one
 * JSON line each.
 *
 * **Why a fixture process and not an inline stub.** `icacls /deny` does not
 * bite for this account; a directory in place of the log makes `statSync`
 * SUCCEED with size 0; and a file used as a directory component answers
 * `ENOENT` on Windows rather than `ENOTDIR`. So no arrangement of the real
 * filesystem produces a non-`ENOENT` stat failure on this platform, and the
 * branch that tells "I could not look" from "there was nothing to heal" would
 * otherwise be written and never exercised. Same solution, same reason, as
 * `test/fixtures/force-linksync-failure.ts` — and in its own process, so no
 * other test in the suite can see the patched `fs`.
 *
 * It is scoped to ONE path deliberately: `ensureLogDir` and the append itself
 * must keep working, so that what the parent reads is the discrimination and
 * not a process in which nothing works.
 */
import fs from 'node:fs';
import { appendJsonlLine, healTornTail } from '../../src/core/jsonl-log.ts';

const [file, code] = process.argv.slice(2);

const real = fs.statSync;
// `Object.defineProperty`, not `fs.statSync = …`: the property is declared
// read-only on the type, and the point of this fixture is to replace the exact
// call `isTorn` makes through the namespace.
Object.defineProperty(fs, 'statSync', { value: ((target: string, ...rest: unknown[]) => {
  if (String(target) === file) {
    const err = new Error(`${code}: forced, stat '${file}'`) as NodeJS.ErrnoException;
    err.code = code;
    throw err;
  }
  return (real as (...a: unknown[]) => unknown)(target, ...rest);
}) as typeof fs.statSync, configurable: true, writable: true });

process.stdout.write(`${JSON.stringify(healTornTail(file!))}\n`);
try {
  appendJsonlLine(process.argv[4] ?? '.', file!, { appended: true });
  process.stdout.write(`${JSON.stringify({ appended: true })}\n`);
} catch (err) {
  process.stdout.write(`${JSON.stringify({ refused: err instanceof Error ? err.message : String(err) })}\n`);
}
