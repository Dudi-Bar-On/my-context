import { existsSync } from 'node:fs';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const execFileAsync = promisify(execFile);

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Absolute path to the plugin clone under test — the repository this harness
 * lives in.
 *
 * It read `join(here, '..', '..', 'my-context')` until 2026-09-14, from a
 * layout where `harness/` sat BESIDE the clone. `harness/` is inside the
 * clone, so that resolved to `<repo>/my-context`, a directory that has never
 * existed — and nothing said so, because everything that consumes this path
 * treats a failed spawn as an empty result. `harness/baseline.mjs` printed
 * "baseline matches the pin" and exited 0 in under a second without running a
 * test, and every case in `harness/self-test/` failed with MODULE_NOT_FOUND.
 *
 * Checked rather than assumed, at import, because this is the one value in the
 * harness that every other file's correctness rests on: a wrong path here is
 * not an error anywhere, it is silence everywhere.
 */
export const REPO = resolve(join(here, '..', '..'));
if (!existsSync(join(REPO, 'package.json'))) {
  throw new Error(
    `harness: ${REPO} holds no package.json, so it is not the plugin clone. Every case in this `
    + 'harness would spawn into nothing and report a result it never measured.',
  );
}

/** Where disposable workspaces live. Never inside REPO. */
/**
 * Where disposable workspaces live. NEVER inside REPO, which is the property
 * `harness/self-test/workspace.test.mjs` asserts in as many words.
 *
 * It read `join(here, '..', '.scratch')` — `<repo>/harness/.scratch` — which
 * was outside the clone only under the old layout where `harness/` sat BESIDE
 * it. Once `REPO` was corrected to the repository this file lives in, that put
 * every throwaway workspace INSIDE the tree under test: a `mycontext` command
 * run in one would resolve the repository's own `.my_context` as an outer
 * workspace, and `doctor` calls that `nested_corpus`. The self-test caught it
 * the moment the path above stopped being wrong.
 *
 * The OS temp directory, with the `myctx-` prefix the rest of this project
 * uses: `.github/workflows/ci.yml`'s leaked-workspace step collects
 * `$TEMP/myctx-*` older than thirty minutes, so a killed harness run is swept
 * by the same machinery as a killed suite run rather than needing its own.
 */
export const SCRATCH = resolve(join(tmpdir(), 'myctx-harness-scratch'));

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
