/**
 * **How the doctor looks at the repository's files, and the two different
 * answers it needs to that question.**
 *
 * A bounded, git-aware scan shared by every check that has to ask "what is
 * actually on disk here" — plus the two skip policies that are deliberately
 * NOT the same list, because a scope glob may legitimately target generated
 * output while a general scan must not waste itself walking into it.
 *
 * Split out of `checks.ts` by
 * `TASK-the-checks-file-splits-along-a-boundary-its-own-tests`. It is file
 * plumbing, not a diagnostic: nothing here decides whether anything is wrong,
 * and no `Finding` is constructed, which is exactly why it can sit below every
 * check module without a cycle.
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { relPosix } from '../core/paths.ts';

/**
 * Directories `listRepoFiles` never descends into, for its general "fast,
 * bounded scan of the repository" purpose. `checkDeadScopes` deliberately
 * does NOT use this list (see `SCOPE_SKIP_DIRS` below) — a scope glob is
 * allowed to target generated output (`dist/`, `coverage/`, ...) or the
 * workspace itself (`.my_context/`), and skipping those directories here
 * previously made `checkDeadScopes` report a live scope as dead.
 *
 * **This is a POLICY on top of `.gitignore`, not a substitute for it, since
 * 2026-09-04** (`TASK-the-screen-says-repository-and-shows-whatever-is-on-
 * disk`, rulings/62). `.my_context/` is TRACKED — only its own database
 * files are gitignored — so a walk that only consulted `.gitignore` would
 * still draw the workspace's own storage as project content; this set is
 * why it stays excluded regardless. `.demo-corpus/` is NOT listed here
 * (unlike an earlier version of this fix) because it IS gitignored
 * (`.gitignore:30`), and `listRepoFiles` below now asks git rather than
 * needing every gitignored name spelled out by hand — the owner's own
 * correction: *"do NOT just add `.demo-corpus` to `SKIP_DIRS`"*, because a
 * name-by-name list is the same defect one entry quieter every time a new
 * ignored directory appears.
 */
export const SKIP_DIRS = new Set([
  '.git', '.my_context', '.my-context', 'node_modules', 'dist', 'build', 'out',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
]);

/**
 * Directories `checkDeadScopes` never descends into. Deliberately much
 * smaller than `SKIP_DIRS`: `.git` internals can never be a meaningful scope
 * target and are large, so they stay excluded; `node_modules` is vendor
 * code no first-party constraint should realistically scope into, and can be
 * enormous, so it stays excluded too. Every directory a real constraint might
 * legitimately scope into — `.my_context/` itself, `dist/`, `build/`,
 * `coverage/`, `.next/`, and so on — is walked.
 */
export const SCOPE_SKIP_DIRS = new Set(['.git', 'node_modules']);

export const FILE_LIMIT = 20_000;

export function walkFiles(repoRoot: string, limit: number, skipDirs: ReadonlySet<string>): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.isDirectory()) {
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));
    }
  };

  walk(repoRoot);
  return out;
}

/**
 * What git itself says belongs to the working tree: every TRACKED path, plus
 * every UNTRACKED one `.gitignore` does not exclude — a brand-new file
 * nobody has `git add`ed yet is still real project content and stays in,
 * exactly as `git status` would show it. `null` only when there is no git
 * repository to ask (`git` missing from `PATH`, or `repoRoot` is not inside
 * one) — the one case `listRepoFiles` below falls back to the plain
 * filesystem walk for, so this tool keeps working on a workspace that was
 * never a git repository at all.
 *
 * **`-z`, not newline-split output.** A path holding a newline would
 * otherwise be read as two, and git's own paths are already POSIX (`/`),
 * matching `INV-posix-normalized-paths` for free rather than needing
 * `relPosix` to fix them up.
 *
 * **The cost, said out loud rather than traded away silently**
 * (`TASK-the-screen-says-repository-and-shows-whatever-is-on-disk`,
 * rulings/62): one `git` subprocess per call, on the request path
 * `/api/coverage` and doctor both run through. Measured against this
 * project's own working tree (2,019 tracked files): low tens of
 * milliseconds, dominated by process spawn rather than by git's own index
 * read, which is a flat file lookup rather than a directory recursion. That
 * is the SAME order of cost `checkCliOnPath`'s `spawnSync('which'/'where', …)`
 * already pays elsewhere in `src/doctor/` on every doctor run, not a new class
 * of expense — and it replaces a `readdirSync` recursion over the WHOLE
 * tree (now up to ~1,483 more entries per the same measurement) rather than
 * adding cost beside it.
 */
export function gitFiles(repoRoot: string): string[] | null {
  const result = spawnSync(
    'git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: repoRoot, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string') return null;
  return result.stdout.split('\0').filter((entry) => entry !== '');
}

/** Repo-relative POSIX paths of every tracked-looking file, bounded so doctor stays fast. */
export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  const tracked = gitFiles(repoRoot);
  if (tracked === null) return walkFiles(repoRoot, limit, SKIP_DIRS);
  const out: string[] = [];
  for (const rel of tracked) {
    if (out.length >= limit) break;
    // `SKIP_DIRS` still applies ON TOP of what git already excluded — see
    // that set's own docblock for why `.my_context/` needs this even though
    // git tracks it.
    if (rel.split('/').some((segment) => SKIP_DIRS.has(segment))) continue;
    out.push(rel);
  }
  return out;
}

/**
 * Same walk as `listRepoFiles`, but for `checkDeadScopes` specifically: it
 * must see everything a scope glob could legitimately name, including
 * `.my_context/` and build output, so it uses the much smaller
 * `SCOPE_SKIP_DIRS` instead of `SKIP_DIRS`.
 */
export function listFilesForScopeCheck(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  return walkFiles(repoRoot, limit, SCOPE_SKIP_DIRS);
}

export function newestMarkdownMtime(dir: string): number {
  let newest = 0;
  const walk = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      try {
        newest = Math.max(newest, statSync(full).mtimeMs);
      } catch {
        // A file deleted mid-walk is not a doctor finding.
      }
    }
  };
  walk(dir);
  return newest;
}

