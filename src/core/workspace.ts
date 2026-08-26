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

/** Walk upward from cwd looking for a `.my_context` directory. */
export function findProjectRoot(cwd: string): string | null {
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
