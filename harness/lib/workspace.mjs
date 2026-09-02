import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));

/** Absolute path to the plugin clone under test. */
export const REPO = join(here, '..', '..', 'my-context');

/** Where disposable workspaces live. Never inside REPO. */
export const SCRATCH = resolve(join(here, '..', '.scratch'));

export const CLI = join(REPO, 'src', 'cli', 'index.ts');

export async function createWorkspace() {
  await mkdir(SCRATCH, { recursive: true });
  const ws = await mkdtemp(join(SCRATCH, 'ws-'));
  await execFileAsync(process.execPath, [CLI, 'init'], { cwd: ws });
  return ws;
}

export async function createBareWorkspace() {
  await mkdir(SCRATCH, { recursive: true });
  const ws = await mkdtemp(join(SCRATCH, 'ws-'));
  return ws;
}

export async function destroyWorkspace(dir) {
  const resolved = resolve(dir);
  if (!resolved.startsWith(SCRATCH + sep)) {
    throw new Error(`refusing to remove a path outside SCRATCH: ${dir}`);
  }
  await rm(resolved, { recursive: true, force: true });
}
