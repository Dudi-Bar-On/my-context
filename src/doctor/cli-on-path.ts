/**
 * **The one check that asks a question about the MACHINE instead of about the
 * corpus — which is why it has always been the odd one out.**
 *
 * `checkCliOnPath` answers "is `mycontext` on this PATH, and is it THIS
 * checkout's copy". Its answer differs between two clones of the same
 * repository, so unlike every other check it is not a property of the corpus
 * at all. That difference was already recorded in three places before this
 * module existed: `cmdDoctor` calls it directly and folds it into its own exit
 * code without folding it into `findings`/`counts`; `runChecks`' other callers
 * (`status`, `ack`, the UI health widget) never run it and never could; and
 * `test/doctor/registry-membership.test.ts` names it in `EXCLUDED` with that
 * reason spelled out.
 *
 * So the module boundary here is not a new judgement — it is the one the code
 * had already made three times without ever getting a file of its own.
 * `TASK-the-checks-file-splits-along-a-boundary-its-own-tests` gave it one, and
 * `test/doctor/cli-on-path.test.ts` was already its dedicated test.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTHING, PERSON, type Finding } from './finding.ts';

/**
 * **The word every documented command begins with, checked against what this
 * machine's shell would actually do with it.**
 *
 * `package.json` names `mycontext` as this project's `bin`, and from that one
 * fact every README, the skill, and all 24 UI palette entries treat the word
 * as something a shell can run — 262 documented invocations of it, by the
 * count in `KNOWN-every-command-the-product-tells-a-user-to-run-begins-with-a`.
 * That was false on the owner's own machine for the whole life of this
 * project: the package was never linked, so `mycontext` resolved to nothing,
 * and nothing anywhere said so. It was found by a person typing one and
 * reading `command not found`. This check exists so the NEXT machine where
 * that is true hears it from `doctor`, not from a failed command.
 *
 * There are three answers, not two, and they are not the same finding:
 *
 *  - **Resolves to this workspace's own CLI.** Healthy — the word runs the
 *    code sitting in this checkout, exactly as every doc assumes. No finding,
 *    the same silence `checkDeadScopes` and `checkIndexFreshness` return on a
 *    clean corpus.
 *  - **Does not resolve at all.** Loud and self-evident — the same
 *    `command not found` the owner hit — so every documented command is
 *    wrong, but a person finds out on the first one they try. `warn`: nothing
 *    about the CORPUS is broken, and CI commonly runs this very command via
 *    `node src/cli/index.ts doctor` without ever linking `mycontext` onto
 *    PATH at all — making this `error` would fail a healthy corpus on an
 *    unrelated environment fact, the same reasoning `index_not_ignored` and
 *    `corpus_size_fallback_ceiling` are `warn` rather than `error` for.
 *  - **Resolves to something else** — a different checkout, a different
 *    version, or a stale link left over from one. `error`, and the one this
 *    check exists to catch: `src/ui/execute.ts`'s `CLI_ENTRY` comment names
 *    exactly this as "the case that matters — not this project at all", and
 *    it is SILENT. A person runs `mycontext review` believing it reads this
 *    corpus and it reads a different one, with nothing on screen to say so —
 *    the same shape of harm `tag_projection_drift` is `error` for: not a
 *    corpus defect, but a WRONG ANSWER given with no error attached. Reported
 *    as healthy, this would be worse than not having the check at all.
 *
 * A fourth outcome — **cannot tell** — is not a defect either, and must never
 * be silence or a crash (`runChecks`'s own `check_failed` catch-all exists
 * for exactly the failure mode of a check finding out the hard way). It fires
 * when the platform's own lookup tool can't be run at all, or when something
 * resolves on PATH but doctor cannot see through it to a target — `info`,
 * the same register `index_missing` uses for "this cannot be answered right
 * now", not for "something is wrong".
 *
 * **Why the platform's own lookup, not a hand-rolled `PATH` walk:** a
 * reimplementation can disagree with the shell asking the same question —
 * different rules for extensions, different rules for which directory wins a
 * tie — and a disagreement there is indistinguishable from a bug in this
 * check. `where` (Windows) and `which -a` (POSIX) are what `cmd.exe`,
 * PowerShell and a POSIX shell are themselves built on; this defers to them
 * rather than re-deriving their answer.
 *
 * **Resolving a shim to what it actually runs — the part that only exists on
 * Windows.** On POSIX, `mycontext` on PATH can be a real symlink straight to
 * `src/cli/index.ts`, and `realpathSync` alone resolves it. On Windows the
 * target is never the file itself: `npm link` writes a `.cmd` (and a `.ps1`,
 * and a POSIX-shaped shell script for Git Bash) that WRAPS `node` and a
 * relative path — verified by reading this machine's own linked shim, which
 * launches `node "%dp0%\node_modules\mycontext\src\cli\index.ts" %*`.
 * `realpathSync` cannot see through that text to the file it names, so this
 * reads the shim itself and pulls out the `node_modules/<pkg>/<path>`
 * segment every npm-generated shim embeds (the `.cmd`, `.ps1`, and POSIX
 * templates all carry it, in that literal shape, regardless of npm version),
 * resolves it relative to the shim's own directory, and `realpathSync`s the
 * result — which is also what collapses the `npm link` symlink at
 * `node_modules/mycontext` back to this checkout, the same symlink verified
 * by hand while building this check (`node_modules/mycontext -> …/my-context`).
 *
 * **What this cannot establish:** a candidate too large to be a text shim
 * (`SHIM_MAX_BYTES`, comfortably above every real npm-generated shim's
 * actual size) or one that has vanished between the platform lookup
 * reporting it and this check reading it is reported as "found, target
 * unverifiable", never guessed at as either healthy or a mismatch — this
 * check trades "some candidates are opaque to it" for "never asserts a fact
 * about a target it never actually looked at". A SMALL file with no
 * `node_modules/…` marker in it (an unrelated program small enough to read,
 * or a genuine POSIX symlink straight to a CLI file with no wrapper at all)
 * is instead compared BY PATH directly — its own resolved location either
 * matches this checkout's CLI or it does not, and either answer is a real
 * fact about a real file this check actually read, not a guess.
 */

/** The `bin` name `package.json` declares — see the module comment above. */
export const CLI_BIN_NAME = 'mycontext';

/**
 * This checkout's own CLI entry, resolved from THIS FILE rather than looked
 * up — the same non-negotiable `src/ui/execute.ts` states for its own
 * `CLI_ENTRY`: "Never a `mycontext` found on PATH: what is on PATH is
 * whatever the user last installed... Resolved from `import.meta.url` so it
 * moves with the file and cannot drift into a string somebody has to
 * remember to update." This module lives one level deeper than `execute.ts`
 * does (`src/doctor/` vs `src/ui/`), and the relative path is identical
 * either way — both are one `..` below `src/`.
 */
export const OWN_CLI_ENTRY = fileURLToPath(new URL('../cli/index.ts', import.meta.url));

/** Longest shim `readShimTarget` will read whole. Every shim actually seen —
 * npm's `.cmd`, `.ps1`, and POSIX templates — is a few hundred bytes; a
 * `mycontext` on PATH bigger than this is almost certainly a compiled binary,
 * not a text wrapper, and reading it in full would be pure waste. */
export const SHIM_MAX_BYTES = 8_192;

/**
 * Resolves `candidate` (a path `defaultCliLookup` returned) as far toward its
 * real target as this check can establish, in two steps:
 *
 *  1. `realpathSync` — resolves ordinary symlinks, which is the whole answer
 *     on a POSIX box where `mycontext` links straight to the CLI file.
 *  2. If step 1 didn't land on something ending in the CLI's own basename,
 *     the result is read as TEXT and searched for an embedded
 *     `node_modules/<pkg>/<path>` segment — the shape every npm-generated
 *     shim (`.cmd`, `.ps1`, POSIX) carries, verified against this machine's
 *     own linked shim while this check was built. Found, it is resolved
 *     relative to the shim's own directory and `realpathSync`d in turn,
 *     which is also what collapses an `npm link` symlink sitting inside
 *     `node_modules`.
 *
 * Returns `null` when neither step lands on a readable target — a candidate
 * that IS on PATH but that this cannot see through, reported by the caller as
 * "found, but unverifiable" rather than guessed at either way.
 */
export function readShimTarget(
  candidate: string,
  readFile: (p: string, enc: 'utf8') => string = (p, enc) => readFileSync(p, enc),
  realpath: (p: string) => string = realpathSync,
): string | null {
  let real: string;
  try {
    real = realpath(candidate);
  } catch {
    real = candidate;
  }

  let size = 0;
  try {
    size = statSync(real).size;
  } catch {
    return null; // the candidate does not exist to be read — nothing to resolve
  }
  if (size > SHIM_MAX_BYTES) return null; // almost certainly a binary, not a text shim

  let text: string;
  try {
    text = readFile(real, 'utf8');
  } catch {
    return null;
  }

  const at = text.search(/node_modules[\\/]/);
  if (at === -1) return real; // not a wrapper shape — `real` itself is the answer

  const rest = text.slice(at);
  const stop = rest.search(/["'\r\n]/);
  const segment = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  if (!segment) return real;

  const parts = segment.split(/[\\/]/).filter(Boolean);
  const absolute = path.join(path.dirname(real), ...parts);
  try {
    return realpath(absolute);
  } catch {
    return absolute; // could not confirm it exists; still the best available answer
  }
}

/** What the platform's own lookup reports for `name`: every path on PATH a
 * shell could resolve it to, in the order the platform itself returns them.
 * Injected by `checkCliOnPath`'s caller in tests so no test has to touch the
 * real `PATH` environment variable to exercise this check. */
export type CliLookup = (name: string) => string[];

/**
 * The real lookup: `where` on Windows, `which -a` on POSIX — see the module
 * comment on why a platform tool rather than a hand-rolled `PATH` walk. A
 * nonzero exit with no output is a normal, DETERMINATE "not found" (both
 * tools do this) and is returned as `[]`, not thrown. Only `result.error` —
 * the lookup tool itself could not be started at all — is thrown, so the
 * caller can tell "asked and the answer is no" apart from "could not ask".
 */
export function defaultCliLookup(name: string): string[] {
  const result = process.platform === 'win32'
    ? spawnSync('where', [name], { encoding: 'utf8', windowsHide: true })
    : spawnSync('which', ['-a', name], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return (result.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Windows paths are case-insensitive and `realpathSync` does not normalize
 * drive-letter casing; POSIX paths are compared verbatim. This is a native
 * filesystem-path comparison, not a stored corpus path, so it deliberately
 * does not go through `relPosix` (INV-posix-normalized-paths governs paths
 * that cross into the database or a glob match — this crosses into neither). */
export function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Walks up from `fromFile` looking for the nearest `package.json`, so the
 * "not on PATH" remedy can name the directory `npm link` should be run from
 * without assuming a fixed number of directories between the CLI entry and
 * the package root. Bounded the way every other walk in this file is; falls
 * back to `fromFile`'s own directory if none is found within the bound, which
 * only degrades the remedy's wording, never throws. */
export function nearestPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(fromFile);
}

export function checkCliOnPath(
  ownCliEntry: string = OWN_CLI_ENTRY,
  lookup: CliLookup = defaultCliLookup,
): Finding[] {
  let candidates: string[];
  try {
    candidates = lookup(CLI_BIN_NAME);
  } catch (err) {
    return [{
      level: 'info', code: 'cli_lookup_failed',
      remedy: NOTHING,
      message:
        `could not determine whether \`${CLI_BIN_NAME}\` resolves on this machine's PATH: the ` +
        `platform lookup itself could not be run (${err instanceof Error ? err.message : String(err)}). ` +
        `This is a gap in what doctor could check, not a corpus problem — it means doctor cannot ` +
        `tell you whether the commands this project prints would actually run here.`,
    }];
  }

  if (candidates.length === 0) {
    const packageRoot = nearestPackageRoot(ownCliEntry);
    return [{
      level: 'warn', code: 'cli_not_on_path',
      remedy: PERSON,
      message:
        `\`${CLI_BIN_NAME}\` — the word every documented command in this project's READMEs and ` +
        `skill begins with, and what every UI palette entry composes — does not resolve on this ` +
        `machine's PATH. Exactly as typed, every one of those commands, and the UI's Copy button, ` +
        `would fail with "command not found". Run \`npm link\` from ${packageRoot} to provide it, ` +
        `or use \`node ${ownCliEntry} <args>\` until then — the fallback the README already documents.`,
    }];
  }

  const ownReal = (() => {
    try { return realpathSync(ownCliEntry); } catch { return ownCliEntry; }
  })();

  // Every candidate ends up in exactly one of three buckets: `matched` (its
  // target IS this checkout), `mismatch` (readable, and a DIFFERENT target —
  // the worst state, so its presence short-circuits below regardless of
  // what any other candidate said), or neither, which can only mean
  // `readShimTarget` returned `null` for every one of them — "found on
  // PATH, target unverifiable" is exactly that leftover case, not a third
  // flag tracked alongside these two.
  let matched = false;
  let mismatch: { candidate: string; target: string } | undefined;

  for (const candidate of candidates) {
    const target = readShimTarget(candidate);
    if (target === null) continue;
    if (samePath(target, ownReal)) matched = true;
    else mismatch ??= { candidate, target };
  }

  if (mismatch) {
    return [{
      level: 'error', code: 'cli_path_mismatch',
      remedy: PERSON,
      message:
        `\`${CLI_BIN_NAME}\` on this machine's PATH — "${mismatch.candidate}" — resolves to ` +
        `"${mismatch.target}", NOT this workspace's own CLI ("${ownReal}"). This is worse than ` +
        `not resolving at all: every documented command a person runs as \`${CLI_BIN_NAME} …\` ` +
        `silently drives a DIFFERENT checkout or version, with nothing on screen to say so. Run ` +
        `\`npm link\` from ${nearestPackageRoot(ownCliEntry)} to point it back at this checkout, ` +
        `after confirming what the other target is and that overwriting its link is intended.`,
    }];
  }

  if (matched) return [];

  return [{
    level: 'info', code: 'cli_path_unverifiable',
    remedy: NOTHING,
    message:
      `\`${CLI_BIN_NAME}\` resolves on PATH to ${candidates.map((c) => `"${c}"`).join(', ')}, but ` +
      `doctor could not read through ${candidates.length === 1 ? 'it' : 'any of them'} to the CLI ` +
      `script it actually runs — not shaped like an npm-generated shim, and not a symlink to a ` +
      `readable target. It may be this workspace's own CLI behind a wrapper doctor does not ` +
      `recognize, or a completely different program; this check cannot tell which.`,
  }];
}

