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
 * **The tradeoff this makes, written down because it was raised in review and
 * belongs somewhere more durable than the thread that raised it.** `PATH` is
 * a list of DIRECTORIES, not a list of files — there is no such thing as
 * removing one shim from an entry while keeping the entry on PATH for
 * everything else in it. So when a directory is removed because it holds a
 * foreign `mycontext`, whatever ELSE that directory holds — `npm.cmd`,
 * `npx.cmd`, another package's global link — goes with it, for every CLI
 * child this suite spawns, for the duration of the run only (this mutates
 * `process.env.PATH` in THIS process; nothing is written to the machine's
 * real environment, and a shell started outside this run is unaffected).
 *
 * Measured on this machine (`where npm`, and directory listings of both):
 * `npm`/`npx` resolve to `C:\Program Files\nodejs\`, entirely separate from
 * `C:\Users\UserC\AppData\Roaming\npm` — the npm global-PREFIX directory,
 * where `npm link`/`npm install -g` put PACKAGE shims (`mycontext.cmd` here)
 * but not npm itself. Removing the prefix directory here does not touch
 * `npm`/`npx` at all. That separation is this machine's install layout, not a
 * law — a setup where the global prefix bin dir IS where `npm`/`npx` resolve
 * from too (a portable or nvm-style Node install, among others) would lose
 * both for the run's children the moment that same directory holds a foreign
 * `mycontext` shim.
 *
 * Whether that scenario ever actually bites depends on whether anything this
 * suite spawns calls `npm`/`npx` by bare name at all — checked by grepping
 * every `execSync`/`execFileSync`/`spawnSync`/`spawn` call in `test/`, `src/`,
 * `scripts/` and `e2e/` for a first argument starting with `npm` or `npx`.
 * Exactly one call in the whole repository does:
 * `test/rules/maintenance-absent.test.ts:66`'s
 * `execSync('npm pack --dry-run --json', …)`, run once at that file's
 * top-level load — so on the machine layout where the two directories
 * collide, THAT specific test would also fail on this scrub, not only the
 * doctor-dependent ones this task set out to fix.
 *
 * **Why directory-level removal stands anyway, rather than a narrower
 * per-file scrub or a shadow.** A per-file removal is not a `PATH` operation
 * at all — `PATH` cannot say "this directory, minus one name in it" — so the
 * only narrower alternative on the table is shadowing: prepend a clean
 * directory ahead of the foreign one instead of removing it, so the FIRST
 * `mycontext` a shell would resolve is harmless. That does not satisfy
 * `checkCliOnPath`: its loop over candidates (`src/doctor/cli-on-path.ts`,
 * the `for (const candidate of candidates)` loop building `mismatch ??= …`)
 * inspects EVERY path `where mycontext` returns, not only the first, and
 * sets `mismatch` off ANY of them resolving elsewhere — so a foreign shim
 * later in the list still trips `cli_path_mismatch` even with a healthy one
 * shadowing it in front. Removal is the only lever that actually changes
 * what `checkCliOnPath` sees. The npm/npx exposure above is accepted, not
 * unnoticed: it is narrower than the bug this task fixes (one measured
 * call-site, only on a colliding install layout, only for the run's
 * children) and the alternative (leaving PATH unscrubbed) is the 49-failure
 * defect this whole file exists to close.
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
