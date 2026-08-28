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

/**
 * `config.json` as it is on disk RIGHT NOW, validated — or a throw carrying the
 * reason, which is `resolveConfig`'s own message for a file that parses and does
 * not load, and this function's for one that does not parse.
 *
 * Extracted from `resolveWorkspace` so that `liveWorkspace` below re-reads the
 * file through the SAME code, wording included. A second reader spelled
 * separately is how `/api/config` and every other endpoint came to disagree
 * about what a config is in the first place; one function is the fix for that,
 * not a convenience.
 *
 * `null` — no workspace — resolves to pure defaults rather than throwing,
 * because that is what an absent file already did here and off-workspace is a
 * state the surfaces render rather than a failure.
 */
function loadConfig(configPath: string | null): Config {
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
  return resolveConfig(raw);
}

export function resolveWorkspace(cwd: string): Workspace {
  const projectRoot = findProjectRoot(cwd);
  const configPath = projectRoot ? path.join(projectRoot, 'config.json') : null;

  return {
    projectRoot,
    globalRoot: GLOBAL_DIR,
    dbPath: projectRoot ? path.join(projectRoot, '.index.db') : ':memory:',
    config: loadConfig(configPath),
  };
}

/**
 * One answer from `LiveWorkspace.now()`: the workspace, and whether its config
 * is the file or the last one that loaded.
 */
export interface WorkspaceNow {
  /** A fresh `Workspace` value. Never shared between two calls, deliberately — see `liveWorkspace`. */
  ws: Workspace;
  /**
   * `null` when `ws.config` IS the file as it is on disk right now.
   *
   * Otherwise the loader's message for why the file no longer loads, and
   * `ws.config` is the last config that did. This is the only way a caller can
   * tell the two apart, and a caller that shows config to a person and does not
   * say which one it is showing has re-created the disagreement this whole
   * mechanism exists to end.
   */
  configError: string | null;
}

/**
 * A workspace that RE-READS `config.json` on every ask.
 *
 * ── WHY THIS EXISTS ─────────────────────────────────────────────────────────
 *
 * `resolveWorkspace` is a photograph. A long-lived process that calls it once
 * and hands the same `Workspace` to every request is serving the config as it
 * was when it started, for the life of the process — measured on 2026-08-28,
 * with `/api/config` (which re-reads) answering `budgets.pinned: 9999` and
 * `/api/simulate` (which does not) answering `6000`, forever, after one
 * out-of-band edit. The endpoints disagreed, and every reader of `ws.config`
 * that decides admission or tier — `matchesFocus`, `injection`, `carriesFor`,
 * `select` — was deciding against the older of the two.
 *
 * The alternative already in the tree is worse rather than smaller: the UI's
 * own budget write used to patch the boot snapshot in place after writing the
 * file. That is correct for exactly ONE writer, and the mechanism it
 * establishes is "every writer remembers" — so the editor, the terminal, a
 * `git checkout` and every future writer leave the snapshot behind, in silence.
 *
 * ── WHAT IS RE-READ, AND WHAT IS NOT ────────────────────────────────────────
 *
 * The CONFIG, and only the config. `projectRoot`, `globalRoot` and `dbPath` are
 * resolved once and fixed for the life of this source, because they answer
 * "where is the corpus", and the corpus does not move under a running server —
 * while a directory walk that momentarily failed (a rename, a network mount, a
 * backup tool) would make a live server answer `no workspace here` for one
 * request and then recover, which is a new failure mode bought for nothing.
 * It also keeps the per-request cost to a small file read: measured at 60µs on
 * this repository's own corpus against a 3.1ms `/api/simulate`, so the whole
 * question of caching it is below the noise floor of a single request.
 *
 * ── THE FILE THAT NO LONGER LOADS ───────────────────────────────────────────
 *
 * `now()` NEVER THROWS, and that is a decision rather than a convenience.
 *
 * A corrupt `config.json` at START-UP still refuses the server, here, in the
 * constructor below — a safe and obvious moment, and the behaviour this project
 * already had. What must not happen is that the same corruption arriving
 * mid-session takes every endpoint down at once: the ONE screen that can show a
 * person the broken text and the message to fix it is `/api/config`, and a
 * re-resolve that threw would take that screen out first. It is also reachable
 * without anybody making a mistake — `writeBudgets` writes `config.json` with a
 * plain `writeFileSync`, so a request landing inside that write reads a
 * truncated file.
 *
 * So the last config that loaded keeps being served, and `configError` carries
 * the reason so no caller has to guess which of the two it holds. That is
 * strictly no worse than the frozen snapshot this replaces — it IS that
 * snapshot, moved from being the rule to being the fallback — and it is worse
 * than nothing only if it goes undisclosed, which is what `configError` is for.
 */
export interface LiveWorkspace {
  now(): WorkspaceNow;
}

export function liveWorkspace(cwd: string): LiveWorkspace {
  // Throws on a corrupt file, exactly as a direct `resolveWorkspace` did, and
  // for the same reason: refusing to start is the moment a person can act on.
  const base = resolveWorkspace(cwd);
  const configPath = base.projectRoot === null
    ? null
    : path.join(base.projectRoot, 'config.json');
  let lastGood: Config = base.config;

  return {
    now(): WorkspaceNow {
      let configError: string | null = null;
      try {
        // Assigned only on success: a throw leaves `lastGood` exactly as it was.
        lastGood = loadConfig(configPath);
      } catch (err) {
        configError = err instanceof Error ? err.message : String(err);
      }
      // A FRESH object every call, never `base` mutated in place. A caller that
      // wrote into `ws.config` would be writing into a value that dies with the
      // request — which is the point: there is no snapshot left to keep honest,
      // so there is nothing for a writer to remember.
      return { ws: { ...base, config: lastGood }, configError };
    },
  };
}
