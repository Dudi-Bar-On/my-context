import { realpathSync } from 'node:fs';
import path from 'node:path';

/** Convert a native path to POSIX form. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/').replace(/\\/g, '/');
}

/** POSIX path with no leading './', no trailing '/', and '..' resolved. */
export function normalizePosix(p: string): string {
  const collapsed = path.posix.normalize(toPosix(p));
  if (collapsed === '.' || collapsed === './') return '';
  return collapsed.replace(/^\.\//, '').replace(/\/+$/, '');
}

/** Layer-root-relative POSIX path. */
export function relPosix(root: string, target: string): string {
  return normalizePosix(toPosix(path.relative(root, target)));
}

const RE_SPECIAL = /[.+^${}()|[\]\\]/g;

/**
 * Compile a glob to a RegExp. Supported: `**` (zero or more segments, or one
 * or more when trailing), `*` (within a segment), `?` (one non-separator char).
 * Patterns and subjects must already be POSIX-normalized.
 */
export function globToRegExp(pattern: string): RegExp {
  const segments = normalizePosix(pattern).split('/');
  let re = '^';
  segments.forEach((seg, i) => {
    const last = i === segments.length - 1;
    if (seg === '**') {
      if (last) { re += '.+'; return; }
      re += '(?:[^/]+/)*';
      return;
    }
    re += seg.replace(RE_SPECIAL, '\\$&').replace(/\*/g, '[^/]*').replace(/\?/g, '[^/]');
    if (!last) re += '/';
  });
  return new RegExp(re + '$');
}

export function matchesAnyGlob(subject: string, patterns: string[]): boolean {
  const target = normalizePosix(subject);
  return patterns.some((p) => globToRegExp(p).test(target));
}

/**
 * Matches a whole path segment, so `src/my_context_notes.md` is not
 * protected. Covers both the project-local spelling (`.my_context`) and the
 * global-root spelling (`.my-context`), at any depth.
 */
const MANAGED_SEGMENT = /(^|\/)(\.my_context|\.my-context)(\/|$)/;

/**
 * Splits an absolute POSIX path at the managed directory, if it crosses one.
 * Shared by every hook that must recognize "this path is inside a my_context
 * workspace" (currently `pre-tool-use.ts`'s deny check and
 * `post-tool-use.ts`'s self-nudge guard) — do not re-implement this locally;
 * a re-implementation drifts (see the `.my_context/` prefix check that used
 * to live in `post-tool-use.ts` and missed a trailing separator, nested
 * workspaces, and the `.my-context` spelling).
 */
export function managedSplit(absPosix: string): { root: string; rel: string } | null {
  const match = MANAGED_SEGMENT.exec(absPosix);
  if (!match) return null;
  const end = match.index + match[1].length + match[2].length;
  return {
    root: absPosix.slice(0, end),
    rel: normalizePosix(absPosix.slice(end).replace(/^\/+/, '')),
  };
}

/**
 * True when `entryFile` (typically `import.meta.filename`) is the file
 * `argv1` (typically `process.argv[1]`) names — i.e. this module was
 * invoked directly, not merely imported.
 *
 * A plain `===` is not enough: under `npm link` on Windows, the installed
 * command is a symlink. Node resolves `import.meta.filename` through the
 * symlink to the real target, but `process.argv[1]` keeps the path as the
 * shell wrapper invoked it — the two never match, so a direct string
 * comparison silently no-ops the CLI. `realpathSync` resolves both sides
 * to the same underlying file before comparing.
 */
export function isMainEntry(entryFile: string | undefined, argv1: string | undefined): boolean {
  if (!entryFile || !argv1) return false;
  if (entryFile === argv1) return true;
  try {
    return realpathSync(entryFile) === realpathSync(argv1);
  } catch {
    return false;
  }
}
