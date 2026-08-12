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
