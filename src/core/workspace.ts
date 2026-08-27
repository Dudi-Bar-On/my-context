import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { resolveConfig, type Config } from './config.ts';

export const DIR_NAME = '.my_context';
export const GLOBAL_DIR = path.join(homedir(), '.my-context');

export interface Workspace {
  projectRoot: string | null;
  globalRoot: string;
  dbPath: string;
  config: Config;
}

/**
 * The environment variable that names the corpus directory outright.
 *
 * ── WHY IT EXISTS ───────────────────────────────────────────────────────────
 *
 * Until 2026-08-28 the corpus was found ONLY by walking up from `cwd`, which
 * meant one lever set two different things: which corpus is read and written,
 * and what a repository-relative path like `--file docs/x.md` resolves against.
 * Nothing needed them apart until the UI's confirm did.
 *
 * `src/ui/execute-effect.ts` derives what a boundary command changes by running
 * it against a COPY of the corpus. With one lever it had to move `cwd` into
 * that copy, so the child then resolved the user's paths against a temp
 * directory: `add --file` was refused as unreadable, and a file that WAS inside
 * the repository was reported "outside this repository", naming the scratch as
 * the repository. Both reported by the owner from live confirms, and both are
 * FALSE refusals — the command runs fine.
 *
 * ── WHY THIS IS NOT A NEW CAPABILITY ────────────────────────────────────────
 *
 * It reads like a way to redirect where the corpus is read and written, and it
 * is one — but that ability already existed and always has: a caller that can
 * choose `cwd` can already choose the corpus, because that is precisely what
 * the walk below does. Anything able to set this variable can set `cwd`, so no
 * process gains reach it did not have. What changes is only that the two
 * questions can now be answered differently, which is the whole point.
 *
 * The honest residual: this is more DIRECT. The walk requires a directory that
 * actually contains `.my_context`, while this names one, so a mistyped value
 * points at a corpus rather than falling back. It is therefore validated by its
 * callers rather than trusted — `execute-effect.ts` asserts the resolution
 * lands on its own copy before it starts a child.
 *
 * Owner ruling 2026-08-27, after the two false refusals were reported.
 */
export const CORPUS_DIR_ENV = 'MYCONTEXT_CORPUS_DIR';

/**
 * The corpus directory: the override when set, otherwise the nearest
 * `.my_context` at or above `cwd`.
 *
 * `override` is a PARAMETER rather than read straight from the environment so
 * that a caller can ask what a DIFFERENT environment would resolve to without
 * mutating its own. `execute-effect.ts` needs exactly that: it checks where the
 * child it is about to spawn will land, and mutating this process to find out
 * would change the answer for everything else running in it.
 */
export function findProjectRoot(
  cwd: string,
  override: string | undefined = process.env[CORPUS_DIR_ENV],
): string | null {
  if (override !== undefined && override !== '') {
    // Absent rather than a fallback: a set-but-wrong override is a mistake to
    // report, and silently walking up from `cwd` instead would hand the caller
    // a different corpus than the one it named — which, for a dry run, is the
    // real one.
    return existsSync(override) ? path.resolve(override) : null;
  }
  let dir = path.resolve(cwd);
  for (;;) {
    if (existsSync(path.join(dir, DIR_NAME))) return path.join(dir, DIR_NAME);
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * **A global corpus, not merely the global DIRECTORY.**
 *
 * `~/.my-context` is created by surfaces that have nothing to do with the
 * corpus — the web UI writes `ui-sessions.json` there — so `existsSync` on the
 * directory answers "has anything ever used this path", which is a different
 * question and, on a machine that has run `mycontext ui`, always yes. Measured
 * on 2026-08-26: the owner's home held `.my-context/ui-sessions.json` and no
 * `items/` at all, and a check on the directory alone reported a corpus that
 * does not exist.
 *
 * `items/` is the right marker because it is what `loadLayer` reads. A global
 * root with no `items/` yields no items, so treating it as a corpus buys
 * nothing and costs the one thing that matters here: it suppresses the
 * "no corpus found" warning on a machine that genuinely has none.
 */
export function hasGlobalCorpus(globalRoot: string = GLOBAL_DIR): boolean {
  return existsSync(path.join(globalRoot, 'items'));
}

/**
 * The repository you are working IN, which is not always the corpus's parent.
 *
 * `path.dirname(ws.projectRoot)` is this project's usual spelling for "the
 * repository", and it is right whenever the corpus was FOUND by walking up from
 * where you are — which is every normal run, because that is how it is found.
 *
 * It stops being right the moment `CORPUS_DIR_ENV` points the corpus somewhere
 * else. Then the corpus's parent is wherever the copy happens to live, and
 * anything that asks "is this file inside the repository" answers against a
 * directory the user has never seen. That produced the owner's second report on
 * 2026-08-27: a file genuinely inside the repository was refused as "outside
 * this repository", naming a temp directory as the repository.
 *
 * So a path the USER typed is bounded by this instead. It deliberately ignores
 * the override — the question is where the person is, and the override answers
 * a different one. When no override is set the two are the same value, which is
 * why nine other sites can keep the shorter spelling.
 */
export function repositoryRoot(cwd: string): string | null {
  // `''`, not `undefined`. A default parameter fires on an explicit `undefined`
  // exactly as it does on an omitted argument, so `findProjectRoot(cwd,
  // undefined)` reads the environment after all — which is the opposite of what
  // this function is for, and it fails silently: the answer is simply the
  // override again. `''` is the value the walk treats as "nothing set".
  const found = findProjectRoot(cwd, '');
  return found === null ? null : path.dirname(found);
}

export function resolveWorkspace(cwd: string): Workspace {
  const projectRoot = findProjectRoot(cwd);
  const configPath = projectRoot ? path.join(projectRoot, 'config.json') : null;

  let raw: unknown = {};
  if (configPath && existsSync(configPath)) {
    try {
      raw = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (err) {
      throw new Error(
        `my_context: ${configPath} is not valid JSON: ` +
        `${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    projectRoot,
    globalRoot: GLOBAL_DIR,
    dbPath: projectRoot ? path.join(projectRoot, '.index.db') : ':memory:',
    config: resolveConfig(raw),
  };
}
