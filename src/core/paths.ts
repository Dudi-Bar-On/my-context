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
 *
 * The `i` flag is load-bearing, not tidiness. NTFS and default-configured
 * APFS resolve paths case-insensitively, so `.MY_CONTEXT/items/CONST-x.md`
 * opens the very same file as `.my_context/items/CONST-x.md`. Without `i`,
 * that spelling walked past the PreToolUse write-deny with empty output and
 * exit 0 (reproduced against the hook binary), and a `mycontext rebuild`
 * afterwards indexed the forged file as an `active`, `always: true`,
 * `origin: human` constraint — the spec §7.1 draft/review gate defeated on
 * the plugin's first-target platform. Both alternatives above are already
 * lowercase, so `i` only widens the match; it cannot narrow it.
 *
 * On a case-SENSITIVE filesystem (Linux, case-sensitive APFS) `.MY_CONTEXT/`
 * is a genuinely different directory, so this now denies writes there that
 * nothing would have protected. That is over-blocking on the one path in this
 * codebase that is deliberately fail-CLOSED, and it costs a user at most an
 * unusable directory name, so it is the safe direction. It does not conflict
 * with INV-hooks-fail-open, which governs what happens when a hook *errors*
 * (return '' / allow) — not how wide the deliberate deny decision is.
 *
 * Spellings that share no characters with either alternative — a Windows 8.3
 * short name such as `MY_CON~1`, a symlink, an NTFS junction — cannot be
 * matched by any regex over the path string. Those are handled outside this
 * regex, by canonicalizing the path first: see `canonicalizeNearestExisting`
 * and its caller in `pre-tool-use.ts`'s `denyReason`.
 */
const MANAGED_SEGMENT = /(^|\/)(\.my_context|\.my-context)(\/|$)/i;

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
 * `absNative` with its longest EXISTING prefix replaced by that prefix's
 * realpath, and the not-yet-existing remainder re-appended verbatim.
 *
 * Why the prefix walk rather than a plain `realpathSync`: the caller is the
 * write-deny hook, and a `Write` names a file that does not exist yet — very
 * often inside a directory that does not exist either (`items/constraint/`
 * on a fresh workspace). `realpathSync` throws ENOENT on any such path, so
 * canonicalizing the whole string resolves nothing at all. Walking up to the
 * nearest ancestor that does exist is what makes the managed directory
 * itself — the part that DOES exist, and the part whose spelling is being
 * forged — resolve to its real name.
 *
 * `realpathSync.native` is load-bearing, not a micro-optimization. Node's
 * JavaScript `realpathSync` walks the path with lstat/readlink, which
 * resolves symlinks but leaves a Windows 8.3 short name exactly as written:
 * measured on this machine, `realpathSync('…\\MY_CON~1')` returns
 * `…\\MY_CON~1` while `realpathSync.native('…\\MY_CON~1')` returns
 * `…\\.my_context`. Only the native call goes through the OS resolver that
 * expands short names, so only the native call closes the bypass.
 *
 * Total for any string input, which the caller depends on: the only call
 * that can throw is `realpathSync` itself, and that throw is caught and
 * turned into another step up the tree. `path.dirname` shrinks the path on
 * every step until it reaches a root, where `parent === current` ends the
 * loop with the input resolved but not canonicalized — so the loop
 * terminates in at most one iteration per path segment, and an unreadable or
 * racing filesystem degrades to "returns what it was given" rather than
 * throwing.
 *
 * What it deliberately does NOT do is decide anything about the remainder.
 * The re-appended tail is the caller's spelling, uncanonicalized, because
 * there is nothing on disk to canonicalize it against.
 */
export function canonicalizeNearestExisting(absNative: string): string {
  let current = path.resolve(absNative);
  const tail: string[] = [];
  for (;;) {
    try {
      const real = realpathSync.native(current);
      return tail.length === 0 ? real : path.join(real, ...tail);
    } catch {
      const parent = path.dirname(current);
      if (parent === current) return path.resolve(absNative);
      tail.unshift(path.basename(current));
      current = parent;
    }
  }
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
