/**
 * Strips every foreign `mycontext` shim directory out of a `PATH` string, so
 * the suite's own child processes cannot inherit the machine's global link.
 *
 * **Why this is the right place.** `checkCliOnPath` (src/doctor/cli-on-path.ts)
 * is correct: it exists to notice when `mycontext` on PATH resolves to a
 * DIFFERENT checkout than the one running, and that is exactly the owner's
 * machine's situation whenever a test spawns `doctor` from inside a fresh
 * clone sitting beside this repository — `C:/Users/UserC/AppData/Roaming/npm`
 * is on PATH, its `mycontext` link points at THIS checkout, and a clone is
 * a different one. The bug is not the check; it is that the suite hands
 * every spawned CLI child the machine's own PATH unfiltered, so a fact about
 * the machine (what the owner happens to have linked, and where) decides
 * whether the suite is green. `test/helpers/pin-rendering.ts` is the one
 * place already proven to reach every child — the `--import` preload runs in
 * the parent `node --test` process, the test runner spawns each test file
 * inheriting that process's env, and `spawnCli`/`childEnv` both build a
 * child's env by spreading `process.env` — so scrubbing PATH here, once,
 * before any test file's top-level code runs, is the same shape as pinning
 * `MYCONTEXT_ASCII` or the sessions directory there already.
 *
 * **Why only a shim pointing ELSEWHERE is removed.** A `mycontext` shim that
 * resolves to THIS checkout is harmless — it is what the owner's own machine
 * has, `checkCliOnPath` calls that state healthy, and scrubbing it anyway
 * would just be deleting a true fact about a correctly-linked machine for no
 * reason. Only a shim whose target resolves to a DIFFERENT checkout is
 * scrubbed, because that is the one case `checkCliOnPath` reports as
 * `cli_path_mismatch` (error) — the exact failure this task is about, not a
 * broader "always strip npm's global bin" rule this task was not asked for.
 *
 * **Why derived structurally instead of asking `npm config get prefix`.**
 * Spawning `npm` once per test-process start is not free, and the answer it
 * would give (an npm prefix directory) still has to be checked for a
 * `mycontext` shim before it means anything — so the shim check IS the whole
 * answer, and asking `npm` first would only add a spawn that changes nothing
 * about the result.
 *
 * Reuses `readShimTarget`/`samePath` from `src/doctor/cli-on-path.ts` rather
 * than re-implementing shim resolution — the same reading of the same shim
 * shape, so this scrub and `checkCliOnPath`'s own verdict can never disagree
 * about what a given shim resolves to.
 *
 * // @basis TASK-npm-test-goes-red-on-any-machine-whose-path-mycontext-points
 */
import { existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { OWN_CLI_ENTRY, readShimTarget, samePath } from '../../src/doctor/cli-on-path.ts';

/**
 * Shim file names `npm link`/`npm install -g` place under a bin directory it
 * manages. Both are checked on every platform — checking `mycontext.cmd` on
 * POSIX or `mycontext` on Windows just never finds a match, which is cheap
 * and keeps this list from having to branch on `process.platform` twice
 * (once here, once in the delimiter below).
 */
const SHIM_NAMES = ['mycontext', 'mycontext.cmd'];

/**
 * Returns `pathValue` with every directory removed that holds a `mycontext`
 * (or `mycontext.cmd`) shim resolving somewhere other than `ownCliEntry`'s
 * own checkout. Directories that hold no such shim, or whose shim resolves
 * right back to this checkout, are kept, in their original order.
 *
 * `ownCliEntry` defaults to this checkout's own CLI entry
 * (`OWN_CLI_ENTRY`, the same constant `checkCliOnPath` compares against) and
 * is a parameter only so the test below can point it at a fixture "checkout"
 * instead of this repository's real one.
 */
export function scrubForeignMycontextShims(
  pathValue: string,
  ownCliEntry: string = OWN_CLI_ENTRY,
): string {
  const delimiter = process.platform === 'win32' ? ';' : ':';
  const ownReal = (() => {
    try {
      return realpathSync(ownCliEntry);
    } catch {
      return ownCliEntry; // not resolvable yet (e.g. a fixture path in a test) — compare as typed
    }
  })();

  const kept = pathValue.split(delimiter).filter((dir) => {
    if (dir === '') return true; // an empty PATH segment (e.g. a trailing separator) names nothing to scrub

    const hasForeignShim = SHIM_NAMES.some((name) => {
      const candidate = path.join(dir, name);
      if (!existsSync(candidate)) return false;
      const target = readShimTarget(candidate);
      // `null` means "found, but unverifiable" — the same leftover bucket
      // `checkCliOnPath` treats as neither healthy nor a mismatch. Left on
      // PATH rather than guessed at: this scrub only removes a directory it
      // actually confirmed points elsewhere.
      return target !== null && !samePath(target, ownReal);
    });

    return !hasForeignShim;
  });

  return kept.join(delimiter);
}

// Applied on import — the whole interface, same shape as `pin-sessions-dir.ts`
// next to this file. Runs before any test file's top-level code, so every
// child a test spawns (directly, through `spawnCli`, or through
// `gen-doc-examples.ts`'s `childEnv`, which also spreads `process.env`)
// inherits the scrubbed PATH, never the machine's own.
if (process.env.PATH) {
  process.env.PATH = scrubForeignMycontextShims(process.env.PATH);
}
