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
