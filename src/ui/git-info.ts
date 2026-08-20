import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Branch, commit and upstream state, read from `.git` AS FILES — no shell-out,
 * no `git` binary, no porcelain parsing (spec §4, Watch). The vocabulary is
 * deliberately three-valued: ahead/behind counts need a revision walk, which
 * is not a file read, so 'differs' is as precise as this reader can honestly be.
 *
 * `.git` itself is a DIRECTORY in a normal checkout and a FILE in a worktree
 * (`gitdir: <path>`, absolute or relative to the checkout root). In a
 * worktree the per-worktree gitdir holds HEAD, and a `commondir` file names
 * the shared .git (relative to the gitdir) where refs/ and packed-refs live.
 * This repository is developed in worktrees, so the file shape is the one
 * this function will meet first.
 *
 * Every path this module touches is opened for reading only. Nothing here
 * writes into a `.git` directory, including the one belonging to a sibling
 * worktree reached through `commondir`.
 */
export interface GitInfo {
  /** null when HEAD is detached. */
  branch: string | null;
  /** Full hex hash, or null when it cannot be resolved from files. */
  commit: string | null;
  /**
   * Spec §4 fixes the vocabulary: no ahead/behind counts, because those need
   * a revision walk and this reader only reads files.
   */
  upstream: 'in-sync' | 'differs' | 'no-upstream';
  detached: boolean;
}

function readText(file: string): string | null {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

/** The per-checkout git directory: `.git` as a directory, or resolved through `.git` the file. */
function resolveGitDir(repoRoot: string): string | null {
  const dotGit = path.join(repoRoot, '.git');
  let stats;
  try {
    stats = statSync(dotGit);
  } catch {
    return null;
  }
  if (stats.isDirectory()) return dotGit;
  const content = readText(dotGit);
  const match = content?.match(/^gitdir:\s*(.+?)\s*$/m);
  if (!match) return null;
  // `path.resolve(repoRoot, …)` and not `path.resolve(…)`: git writes an
  // absolute path by default, but `git worktree add --relative-paths` and
  // every submodule write a path relative to the checkout root. On Windows
  // the absolute form carries a drive letter and forward slashes
  // (`D:/repos/x/.git/worktrees/y`), which `path.win32.resolve` already
  // treats as absolute — so the same call covers both shapes on both
  // platforms, and neither is joined onto the wrong base.
  return path.resolve(repoRoot, match[1]);
}

/** Where refs/ and packed-refs live: the gitdir itself, or the worktree's commondir. */
function resolveCommonDir(gitDir: string): string {
  const common = readText(path.join(gitDir, 'commondir'));
  if (common === null) return gitDir;
  return path.resolve(gitDir, common.trim());
}

/** sha1 (40) or sha256 (64) — the only two object-id widths git has. */
const HASH_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;

/** A loose ref file, else the packed-refs line for `ref`, else null. */
function resolveRef(commonDir: string, ref: string): string | null {
  // Split on '/' and re-join with path.join: a ref name is always POSIX, and
  // `v2/ui1-t4` is a directory plus a file on disk, never one filename.
  const loose = readText(path.join(commonDir, ...ref.split('/')));
  if (loose !== null) {
    const hash = loose.trim();
    return HASH_RE.test(hash) ? hash : null;
  }
  const packed = readText(path.join(commonDir, 'packed-refs'));
  if (packed === null) return null;
  for (const line of packed.split('\n')) {
    if (line.startsWith('#') || line.startsWith('^')) continue;
    const [hash, name] = line.trim().split(/\s+/);
    if (name === ref && hash !== undefined && HASH_RE.test(hash)) return hash;
  }
  return null;
}

/**
 * Read `repoRoot`'s branch, commit and upstream state, or null when `repoRoot`
 * is not a git checkout.
 *
 * Null is also the answer when `.git` exists but cannot be read as one — a
 * `.git` file with no `gitdir:` line, or a gitdir with no HEAD — because the
 * caller's question is "which branch is this corpus on", and a shape this
 * reader does not understand has no honest answer to it. It never throws.
 */
export function readGitInfo(repoRoot: string): GitInfo | null {
  const gitDir = resolveGitDir(repoRoot);
  if (gitDir === null) return null;
  const head = readText(path.join(gitDir, 'HEAD'));
  if (head === null) return null;

  const refMatch = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/m);
  if (!refMatch) {
    const hash = head.trim();
    return {
      branch: null,
      commit: HASH_RE.test(hash) ? hash : null,
      upstream: 'no-upstream',
      detached: true,
    };
  }

  const branch = refMatch[1];
  const commonDir = resolveCommonDir(gitDir);
  const commit = resolveRef(commonDir, `refs/heads/${branch}`);
  // Spec §4 names the comparison target in its own words: "differs from
  // `origin/<branch>`". The remote name is fixed to `origin` because reading
  // the branch's real remote needs `.git/config` INI parsing — a fourth file
  // format for a decoration — and the strip's own label (plan 3) names
  // origin/<branch> explicitly, so what is compared is what is claimed.
  const upstreamTip = resolveRef(commonDir, `refs/remotes/origin/${branch}`);
  const upstream: GitInfo['upstream'] =
    upstreamTip === null ? 'no-upstream'
    : upstreamTip === commit ? 'in-sync'
    : 'differs';
  return { branch, commit, upstream, detached: false };
}
