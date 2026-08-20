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
 *
 * **The upstream verdict is always a comparison against
 * `refs/remotes/origin/<branch>`, never against the branch's own configured
 * upstream — and on a branch that tracks anything but `origin` it can be
 * confidently wrong.** That is a limitation of this reader, not a detail of
 * it; `GitInfo.upstream` below says exactly how it goes wrong, and anyone
 * about to believe an `in-sync` or a `differs` should read it there first.
 */
export interface GitInfo {
  /**
   * The branch HEAD names, or null when there is no branch to name: a
   * detached HEAD, or a HEAD this reader could not understand at all — see
   * `detached`, which tells those two apart.
   */
  branch: string | null;
  /** Full hex hash, or null when it cannot be resolved from files. */
  commit: string | null;
  /**
   * How the local tip compares to `refs/remotes/origin/<branch>` — and to
   * nothing else. **Read this before trusting the value.**
   *
   * This reader never learns which remote the branch actually tracks. That is
   * `branch.<name>.remote` / `.merge` in `.git/config`, and reading it means
   * parsing INI — a fourth file format for a decoration, which the plan
   * rejected and this module goes on rejecting. `origin` is assumed instead.
   * So on a branch tracking a fork, a second remote, or nothing at all, the
   * value is wrong in one of two ways:
   *
   * - **`no-upstream` where an upstream exists.** There is no
   *   `origin/<branch>` file, so this reports no upstream — while the branch
   *   does have one, on a remote this reader cannot see. An understatement,
   *   and at least one that reads as ignorance.
   * - **`in-sync` or `differs` against a ref that is not the upstream.** If
   *   some unrelated `origin/<branch>` happens to exist — and for shared
   *   names (`main`, `master`, `dev`) it usually does — the comparison runs
   *   against that instead, and returns a confident verdict about two commits
   *   with nothing to do with each other. This is the dangerous one: a wrong
   *   answer shaped exactly like a right one, which neither a caller nor a
   *   reader of the strip can tell from the real thing. The test named "the
   *   comparison target is ALWAYS origin/<branch>" pins this behaviour so it
   *   stays a known limitation rather than becoming a surprise.
   *
   * Precisely, then, the four values mean:
   *
   * - `in-sync` — the local tip and `origin/<branch>` are the same hash.
   * - `differs` — both were read, and they are not the same hash.
   * - `no-upstream` — there is no `origin/<branch>` to compare with. Says
   *   nothing about the local tip, and nothing about any other remote.
   * - `unknown` — the local tip could not be read, so no comparison happened
   *   and there is no verdict to give. The strip has words for exactly this
   *   (`strip.unknownTip`, "the local tip could not be read").
   *
   * None of them means "up to date with your upstream". The strip's own
   * labels say `origin/{branch}` for the same reason: what is claimed is what
   * is compared.
   *
   * Spec §4 fixes the vocabulary in the other direction too: no ahead/behind
   * counts, because those need a revision walk and this reader only reads
   * files.
   */
  upstream: 'in-sync' | 'differs' | 'no-upstream' | 'unknown';
  /**
   * True only when HEAD *names a commit* — a real detached HEAD, with that
   * commit in `commit`. It is never a guess.
   *
   * A HEAD that is neither `ref: refs/heads/<name>` nor a hash — empty after
   * a torn write, `ref: refs/tags/v1.0.2`, a spelling from some future git —
   * used to report `detached: true` with `commit: null`. "Detached" is a
   * statement about the repository, and on that path the reader has
   * established nothing except that HEAD said something it does not
   * understand, so the statement was made on no evidence. That shape is now
   * `{ branch: null, commit: null, upstream: 'unknown', detached: false }`,
   * and it is the one shape where `branch === null` and `detached === false`
   * hold together. A caller must not read `detached: false` there as "on a
   * branch": check `branch` first, and let `upstream: 'unknown'` be what
   * gets rendered.
   */
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
 *
 * A HEAD that is *present but unintelligible* is a different answer, and
 * deliberately: the repository is plainly there, so "not a git repository"
 * would be as much of a false claim as "detached" was. That case comes back
 * as a GitInfo whose every field says the same thing — nothing is known about
 * the local tip. See `GitInfo.detached`.
 */
export function readGitInfo(repoRoot: string): GitInfo | null {
  const gitDir = resolveGitDir(repoRoot);
  if (gitDir === null) return null;
  const head = readText(path.join(gitDir, 'HEAD'));
  if (head === null) return null;

  const refMatch = head.match(/^ref:\s*refs\/heads\/(.+?)\s*$/m);
  if (!refMatch) {
    const hash = head.trim();
    // Two different findings, which used to be reported as one. A HEAD
    // holding a hash IS a detached HEAD and this says so, with the commit it
    // read. A HEAD holding anything else establishes only that the local tip
    // could not be read — so that is all this reports, in the state the strip
    // already has a sentence for, with no claim of detachment behind it. See
    // `GitInfo.detached`.
    if (!HASH_RE.test(hash)) {
      return { branch: null, commit: null, upstream: 'unknown', detached: false };
    }
    return { branch: null, commit: hash, upstream: 'no-upstream', detached: true };
  }

  const branch = refMatch[1];
  const commonDir = resolveCommonDir(gitDir);
  const commit = resolveRef(commonDir, `refs/heads/${branch}`);
  // Spec §4 names the comparison target in its own words: "differs from
  // `origin/<branch>`". The remote name is fixed to `origin` because reading
  // the branch's real remote needs `.git/config` INI parsing — a fourth file
  // format for a decoration — and the strip's own label (plan 3) names
  // origin/<branch> explicitly, so what is compared is what is claimed.
  //
  // THE COST OF THAT, STATED WHERE IT IS PAID: on a branch tracking a fork or
  // a second remote this line reads the wrong ref. If no `origin/<branch>`
  // exists the answer is `no-upstream` — an understatement. If one exists but
  // is unrelated, the verdict below is computed against it anyway and comes
  // out `in-sync` or `differs` with nothing to mark it as a guess. The full
  // account, and the test that pins it, are on `GitInfo.upstream`.
  const upstreamTip = resolveRef(commonDir, `refs/remotes/origin/${branch}`);
  const upstream: GitInfo['upstream'] =
    upstreamTip === null ? 'no-upstream'
    : upstreamTip === commit ? 'in-sync'
    : 'differs';
  return { branch, commit, upstream, detached: false };
}
